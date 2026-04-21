import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { TripInput, ItineraryResponse } from './lib/types.js';
import { generateItinerary } from './lib/openai.js';
import { generateSuggestions } from './lib/itineraryRefinement.js';
import { initSupabase } from './lib/supabaseServer.js';
import { requireAuth } from './lib/requireAuth.js';
import { validateBodySize } from './lib/validateBodySize.js';
import { enforceRateLimit, ITINERARY_RATE_LIMIT } from './lib/rateLimit.js';

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

    // Fetch firstName server-side from the verified user's profile.
    const firstName = await fetchFirstName(user.id);

    // Generate itinerary
    console.log('⏱️ [TIMING] Starting itinerary generation...');
    const itinerary = await generateItinerary(tripInput, { firstName });
    const generationTime = Date.now() - routeStartTime;

    console.log(`⏱️ [TIMING] API TOTAL TIME: ${generationTime}ms (${(generationTime / 1000).toFixed(2)}s)`);

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

    const response: ItineraryResponse = {
      success: false,
      itinerary: '',
      error: errorMessage,
      ...(suggestions.length > 0 && { suggestions }),
    };
    res.status(statusCode).json(response);
  }
}
