import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { TripInput, ItineraryResponse } from './lib/types.js';
import { generateItinerary } from './lib/openai.js';
import { generateSuggestions } from './lib/itineraryRefinement.js';
import { initSupabase } from './lib/supabaseServer.js';
import { requireAuth } from './lib/requireAuth.js';
import { validateBodySize } from './lib/validateBodySize.js';
import { enforceRateLimit, ITINERARY_RATE_LIMIT } from './lib/rateLimit.js';
import { buildTravelContext } from './lib/travelContext.js';
import { fetchPlacesContext } from './lib/placesContext.js';
import { fetchCommunityPins } from './lib/communityPins.js';
import { fetchWeatherContext } from './lib/weatherContext.js';
import { buildPracticalContext } from './lib/practicalContext.js';
import { buildBudgetContext } from './lib/budgetContext.js';

// Load environment variables
dotenv.config();

/**
 * Look up the authenticated user's first name from the profiles table.
 * Best-effort: returns undefined on any failure (RLS, missing row, DB down).
 * Used for prompt personalization only — never for authorization.
 */
async function fetchFirstName(userId: string): Promise<string | undefined> {
  try {
    const supabase = initSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('⚠️ [ITINERARY] profile lookup failed:', error.message);
      return undefined;
    }
    return data?.first_name || undefined;
  } catch (e) {
    console.warn('⚠️ [ITINERARY] profile lookup threw:', e instanceof Error ? e.message : e);
    return undefined;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    const response: ItineraryResponse = {
      success: false,
      itinerary: '',
      error: 'Method not allowed',
    };
    res.status(405).json(response);
    return;
  }

  // 🔐 Verify JWT. On failure, requireAuth already wrote the 401 — we just bail.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 📦 Reject oversized payloads before doing any real work. 413 on too big.
  if (!validateBodySize(req, res)) return;

  // 🚦 Per-user rate limit (protects OpenAI bill). 429 on breach.
  if (!(await enforceRateLimit(user.id, res, ITINERARY_RATE_LIMIT))) return;

  try {
    const routeStartTime = Date.now();

    // Whitelist ONLY trip-related body fields. Any userId / userFirstName the client
    // sends is ignored — those come from the verified JWT + the profiles table.
    const body = (req.body ?? {}) as Partial<TripInput>;
    const tripInput: TripInput = {
      arrival: body.arrival!,
      departure: body.departure!,
      stops: body.stops,
      desiredAttractions: body.desiredAttractions,
      travelPace: body.travelPace,
      interests: body.interests,
      budget: body.budget,
      notes: body.notes,
    };

    console.log('📝 [API] Received itinerary request:', {
      userId: user.id,
      arrival: `${tripInput.arrival?.location} on ${tripInput.arrival?.date} at ${tripInput.arrival?.time || 'unspecified'}`,
      departure: `${tripInput.departure?.location} on ${tripInput.departure?.date} at ${tripInput.departure?.time || 'unspecified'}`,
      stops: tripInput.stops,
      attractions: tripInput.desiredAttractions,
      pace: tripInput.travelPace,
      budget: tripInput.budget,
    });

    // Validation
    if (!tripInput.arrival?.date || !tripInput.departure?.date) {
      const response: ItineraryResponse = {
        success: false,
        itinerary: '',
        error: 'Arrival and departure dates are required',
      };
      res.status(400).json(response);
      return;
    }

    // Kick off the profile lookup immediately so it runs in parallel with
    // any remaining pre-flight work. We only await it right before the
    // generator call actually needs firstName.
    const firstNamePromise = fetchFirstName(user.id);

    // Build the destination context (country / currency / units / holidays /
    // religious periods / transport hints) synchronously — it's just lookups,
    // no I/O. Pass all locations so multi-country trips get per-country hints.
    const allLocations = [
      tripInput.arrival.location,
      ...(tripInput.stops ?? []),
      tripInput.departure.location,
    ];
    const travelContext = buildTravelContext(
      tripInput.arrival.location,
      tripInput.arrival.date,
      tripInput.departure.date,
      allLocations
    );
    console.log('🌍 [TRAVEL CONTEXT]', {
      country: travelContext.countryName,
      currency: travelContext.currency,
      units: travelContext.units,
      holidays: travelContext.holidays.length,
      religiousPeriods: travelContext.religiousPeriods.length,
      transportHints: travelContext.transportHints.length,
    });

    // B1 + B2: Fetch real nearby places; share geocoded coords with community pins
    // to avoid a second round of Mapbox geocoding. Both are best-effort —
    // failures silently return empty contexts so generation always proceeds.
    const placesContext = await fetchPlacesContext(
      tripInput.arrival.location,
      tripInput.departure.location,
      tripInput.stops
    );
    const communityPinsContext = await fetchCommunityPins(
      placesContext.geocodedCoords,
      tripInput.interests
    );
    console.log('📍 [PLACES]', placesContext.byLocation.map((l) => `${l.location.split(',')[0]}: ${l.restaurants.length}r/${l.cafes.length}c/${l.attractions.length}a`));
    console.log('💎 [COMMUNITY PINS]', communityPinsContext.pins.length, 'pins found');

    // C1: Weather — runs in parallel with community-pins fetch above; reuses
    // geocoded coords from B1 so no extra Mapbox calls are needed. Best-effort.
    const arrivalCoords = placesContext.geocodedCoords.get(tripInput.arrival.location);
    const weatherContext = arrivalCoords
      ? await fetchWeatherContext(
          tripInput.arrival.location,
          arrivalCoords.lat,
          arrivalCoords.lng,
          tripInput.arrival.date
        )
      : undefined;

    // C2 + C3: Synchronous static lookups — zero I/O, no latency impact.
    const practicalContext = buildPracticalContext(
      travelContext.countryIso2,
      travelContext.countryName
    );
    const budgetContext = buildBudgetContext(
      travelContext.countryIso2,
      travelContext.countryName,
      tripInput.budget as 'budget' | 'mid-range' | 'luxury' | undefined,
      travelContext.currency
    );
    console.log('🧳 [PRACTICAL]', practicalContext ? `${practicalContext.countryName} found` : 'no data');
    console.log('💰 [BUDGET CAL]', budgetContext ? `${budgetContext.countryName} ${budgetContext.costBand}` : 'no data');

    // If the client asked for streaming (default for our UI), push tokens as
    // they arrive. Otherwise fall back to the old JSON-blob response for any
    // legacy caller. The client opts in via Accept: text/plain, which our
    // itineraryApi.ts sets.
    const wantsStream = (req.headers.accept ?? '').includes('text/plain');

    if (wantsStream) {
      // text/plain + chunked transfer encoding. We ignore the shape of
      // ItineraryResponse here and write raw tokens — the client reads them
      // off a ReadableStream.
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.status(200);
      // Flush headers so the client sees the 200 before the first token.
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }

      const firstName = await firstNamePromise;
      console.log('⏱️ [TIMING] Starting itinerary stream...');

      await generateItinerary(tripInput, {
        firstName,
        travelContext,
        placesContext,
        communityPinsContext,
        weatherContext,
        practicalContext,
        budgetContext,
        onToken: (delta) => {
          res.write(delta);
        },
      });

      const generationTime = Date.now() - routeStartTime;
      console.log(
        `⏱️ [TIMING] API TOTAL TIME: ${generationTime}ms (${(generationTime / 1000).toFixed(2)}s)`
      );
      res.end();
      return;
    }

    // Legacy JSON path — buffer the full result, return one response.
    const firstName = await firstNamePromise;
    console.log('⏱️ [TIMING] Starting itinerary generation (non-stream)...');
    const itinerary = await generateItinerary(tripInput, { firstName, travelContext, placesContext, communityPinsContext, weatherContext, practicalContext, budgetContext });
    const generationTime = Date.now() - routeStartTime;
    console.log(
      `⏱️ [TIMING] API TOTAL TIME: ${generationTime}ms (${(generationTime / 1000).toFixed(2)}s)`
    );

    const response: ItineraryResponse = {
      success: true,
      itinerary,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Itinerary generation error:', error);

    let statusCode = 500;
    let errorMessage = 'Failed to generate itinerary';
    let suggestions: string[] = [];

    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        statusCode = 400;
        errorMessage = error.message;

        // Generate helpful suggestions based on error context
        const context = (error as any).context;
        if (context && req.body) {
          suggestions = generateSuggestions(req.body as TripInput, context);
        }
      } else {
        errorMessage = error.message;
      }
    }

    // If we've already started streaming the body, we can't send a JSON
    // error response — headers are committed. Best we can do is append an
    // error marker the client will pick up and close the stream.
    if (res.headersSent) {
      try {
        res.write(`\n\n__ITINERARY_ERROR__:${errorMessage}`);
      } catch {
        /* socket might already be gone */
      }
      res.end();
      return;
    }

    const response: ItineraryResponse = {
      success: false,
      itinerary: '',
      error: errorMessage,
      ...(suggestions.length > 0 && { suggestions }),
    };
    res.status(statusCode).json(response);
  }
}
