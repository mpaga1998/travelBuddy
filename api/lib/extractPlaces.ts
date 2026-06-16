/**
 * D1: Post-generation place extraction + geocoding.
 *
 * After the itinerary markdown is fully streamed, a focused second OpenAI
 * call extracts every concrete named venue (restaurant, museum, bar, monument,
 * hostel, transport terminal) as a structured JSON array. Each entry is then
 * geocoded via Mapbox, biased to the arrival location so ambiguous names
 * resolve to the right city.
 *
 * The result is persisted in the `itinerary_places` Supabase table so the
 * frontend can fetch and display them as a map layer without re-running the
 * extraction.
 *
 * Everything here is best-effort and non-blocking: failures are logged and
 * silently ignored so the itinerary response is never held up.
 */

import OpenAI from 'openai';
import { initSupabase } from './supabaseServer.js';
import { logger } from './log.js';
import { getCachedGeocode, setCachedGeocode } from './geocodeCache.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAPBOX_TOKEN = process.env.VITE_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN ?? '';
const GEOCODE_TIMEOUT_MS = 2000;

export type PlaceType = 'food' | 'sight' | 'nightlife' | 'shop' | 'transport' | 'accommodation';

export interface ExtractedPlace {
  name: string;
  day: number;
  type: PlaceType;
  context: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// OpenAI extraction
// ---------------------------------------------------------------------------

export interface RawPlace {
  name: string;
  day: number;
  type: string;
  context: string;
}

const EXTRACTION_SYSTEM = `You are a JSON extraction assistant. Extract every specifically named place from a travel itinerary. Only include places with a proper name (not generic descriptions like "a local café"). Return ONLY a JSON array, no prose, no markdown fences.`;

const EXTRACTION_USER = (markdown: string) =>
  `Extract all named places from this itinerary. For each place return:\n` +
  `- name: exact name as written\n` +
  `- day: day number (integer)\n` +
  `- type: one of "food" | "sight" | "nightlife" | "shop" | "transport" | "accommodation"\n` +
  `- context: the single sentence from the itinerary that mentions it\n\n` +
  `Itinerary:\n${markdown.slice(0, 12000)}`; // cap to avoid excessive token use

/**
 * Pure: strip markdown fences from a raw LLM response and parse it as a
 * RawPlace array. Returns an empty array on any parse or validation error.
 * Exported for unit testing.
 */
export function parseRawPlacesJson(raw: string): RawPlace[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[])
      .filter(
        (p) =>
          p !== null &&
          typeof p === 'object' &&
          typeof (p as Record<string, unknown>).name === 'string' &&
          (typeof (p as Record<string, unknown>).day === 'number' ||
            typeof (p as Record<string, unknown>).day === 'string') &&
          typeof (p as Record<string, unknown>).type === 'string' &&
          typeof (p as Record<string, unknown>).context === 'string'
      )
      .map((p): RawPlace => {
        const rec = p as Record<string, unknown>;
        return {
          name: rec.name as string,
          day: Number(rec.day) || 1,
          type: rec.type as string,
          context: rec.context as string,
        };
      });
  } catch {
    logger.warn({ sample: cleaned.slice(0, 200) }, 'EXTRACT: JSON parse failed');
    return [];
  }
}

async function extractPlacesFromMarkdown(markdown: string): Promise<RawPlace[]> {
  const model = process.env.OPENAI_FALLBACK_MODEL || 'gpt-5.4-mini';
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM },
      { role: 'user', content: EXTRACTION_USER(markdown) },
    ],
    max_completion_tokens: 4000,
    // temperature is not supported by reasoning models (gpt-5.x); omit it.
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? '[]';
  return parseRawPlacesJson(raw);
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/** Exported for unit testing. Bias is optional — omit for unbiased global search. */
export async function geocodePlace(
  name: string,
  biasLat?: number,
  biasLng?: number
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;

  // Cache check — venue names are stable; avoid repeat Mapbox calls.
  const cacheKey = `venue:${name}`;
  const cached = await getCachedGeocode(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const hasBias = biasLat != null && biasLng != null;
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=1` +
      (hasBias ? `&proximity=${biasLng},${biasLat}` : '');
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
    const coords = json.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const result = { lat: coords[1], lng: coords[0] };
    // Fire-and-forget cache write.
    void setCachedGeocode(cacheKey, result.lat, result.lng);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Supabase persistence
// ---------------------------------------------------------------------------

async function persistPlaces(itineraryId: string, places: ExtractedPlace[]): Promise<void> {
  if (!places.length) return;
  const supabase = initSupabase();
  const rows = places.map((p) => ({
    itinerary_id: itineraryId,
    name: p.name,
    day: p.day,
    type: p.type,
    context: p.context,
    lat: p.lat,
    lng: p.lng,
  }));
  const { error } = await supabase.from('itinerary_places').insert(rows);
  if (error) {
    logger.warn({ err: error.message }, 'EXTRACT: Supabase insert failed');
  } else {
    logger.info({ count: rows.length, itineraryId }, 'EXTRACT: Persisted places');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract and geocode places from a markdown itinerary without persisting.
 * Called by the /api/itinerary/extract endpoint.
 */
export async function extractPlacesOnly(
  markdown: string,
  biasLat: number,
  biasLng: number
): Promise<ExtractedPlace[]> {
  const raw = await extractPlacesFromMarkdown(markdown);
  const settled = await Promise.allSettled(
    raw.map(async (p): Promise<ExtractedPlace | null> => {
      const coords = await geocodePlace(p.name, biasLat, biasLng);
      if (!coords) return null;
      const validTypes: PlaceType[] = ['food', 'sight', 'nightlife', 'shop', 'transport', 'accommodation'];
      const type: PlaceType = validTypes.includes(p.type as PlaceType)
        ? (p.type as PlaceType)
        : 'sight';
      return { name: p.name, day: p.day, type, context: p.context, ...coords };
    })
  );
  return settled
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((p): p is ExtractedPlace => p !== null);
}

/**
 * Extract, geocode, and persist places for a completed itinerary.
 * Called after the stream ends — does not block the HTTP response.
 * Returns the extracted places so the save handler can attach the ID.
 *
 * @param itineraryId  UUID from the `itineraries` table row.
 * @param markdown     Full itinerary text.
 * @param biasLat/Lng  Arrival city coords for geocoding proximity bias.
 */
export async function extractAndPersistPlaces(
  itineraryId: string,
  markdown: string,
  biasLat: number,
  biasLng: number
): Promise<ExtractedPlace[]> {
  try {
    logger.info({ itineraryId }, 'EXTRACT: Starting extraction');
    const places = await extractPlacesOnly(markdown, biasLat, biasLng);
    logger.info({ count: places.length }, 'EXTRACT: Geocoded places');
    await persistPlaces(itineraryId, places);
    return places;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'EXTRACT: top-level failure');
    return [];
  }
}

/**
 * Fetch previously extracted places for an itinerary from Supabase.
 * Used by the client-facing GET endpoint.
 */
export async function fetchPlacesForItinerary(itineraryId: string): Promise<ExtractedPlace[]> {
  const supabase = initSupabase();
  const { data, error } = await supabase
    .from('itinerary_places')
    .select('name, day, type, context, lat, lng')
    .eq('itinerary_id', itineraryId)
    .order('day', { ascending: true });

  if (error) {
    logger.warn({ err: error.message }, 'EXTRACT: fetch failed');
    return [];
  }
  return (data ?? []) as ExtractedPlace[];
}

// =============================================================================
// B1.3: Social place extraction
// =============================================================================
// Separate from the itinerary pipeline: different prompt (no `day` field,
// adds `city` + `confidence`), different return type, no Supabase persistence.
// The itinerary functions above are unchanged for backward compatibility.

export type SocialConfidence = 'high' | 'medium' | 'low';

/** Raw extraction result from the LLM for a social caption. */
export interface RawSocialPlace {
  name: string;
  /** City / area hint extracted from the caption — used for Mapbox proximity bias. */
  city?: string;
  type: string;
  context: string;
  confidence: SocialConfidence;
}

/** Geocoded, ready-to-display candidate returned to the frontend. */
export interface SocialCandidate {
  name: string;
  lat: number;
  lng: number;
  type: PlaceType;
  context: string;
  confidence: SocialConfidence;
  /** City / area hint if the caption mentioned one. */
  city?: string;
}

const SOCIAL_EXTRACTION_SYSTEM =
  `You are a place-extraction assistant. Extract every specifically named place from a social media caption. ` +
  `Only include places with a proper name (a specific restaurant, landmark, beach, hotel, neighbourhood, etc.) — ` +
  `not vague descriptions like "a little café" or "some viewpoint". Return ONLY a JSON array, no prose, no markdown fences.`;

const SOCIAL_EXTRACTION_USER = (caption: string) =>
  `Extract all named places from this social media caption. For each return:\n` +
  `- name: the exact place name (as written or clearly implied)\n` +
  `- city: the city or area it's in (omit if unknown)\n` +
  `- type: one of "food" | "sight" | "nightlife" | "shop" | "accommodation" | "other"\n` +
  `- context: the phrase or sentence that mentions this place\n` +
  `- confidence: "high" (specific named venue) | "medium" (named neighbourhood/area) | "low" (only city implied)\n\n` +
  `Caption:\n${caption.slice(0, 4000)}`;

/**
 * Parse the raw LLM JSON for social places. Returns [] on any error.
 * Exported for unit testing.
 */
export function parseRawSocialPlacesJson(raw: string): RawSocialPlace[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[])
      .filter(
        (p) =>
          p !== null &&
          typeof p === 'object' &&
          typeof (p as Record<string, unknown>).name === 'string' &&
          typeof (p as Record<string, unknown>).type === 'string' &&
          typeof (p as Record<string, unknown>).context === 'string'
      )
      .map((p): RawSocialPlace => {
        const rec = p as Record<string, unknown>;
        const conf = rec.confidence;
        return {
          name: rec.name as string,
          city: typeof rec.city === 'string' ? rec.city : undefined,
          type: rec.type as string,
          context: rec.context as string,
          confidence:
            conf === 'high' || conf === 'medium' || conf === 'low' ? conf : 'medium',
        };
      });
  } catch {
    logger.warn({ sample: cleaned.slice(0, 200) }, 'SOCIAL_EXTRACT: JSON parse failed');
    return [];
  }
}

/** Call the LLM to extract raw place candidates from a social caption. */
async function extractRawSocialPlaces(caption: string): Promise<RawSocialPlace[]> {
  const model = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SOCIAL_EXTRACTION_SYSTEM },
      { role: 'user', content: SOCIAL_EXTRACTION_USER(caption) },
    ],
    max_completion_tokens: 1500,
  });
  const raw = response.choices[0]?.message?.content?.trim() ?? '[]';
  return parseRawSocialPlacesJson(raw);
}

/**
 * Extract named places from a social caption and geocode each one.
 *
 * Uses the `city` field extracted by the LLM as a Mapbox proximity bias so
 * "Café Central" resolves to Vienna rather than some other city.
 * City geocodes are deduplicated within the call so a caption mentioning
 * the same city many times only fires one extra Mapbox request.
 *
 * Best-effort: places that fail to geocode are silently dropped.
 */
export async function extractAndGeocodeSocialPlaces(
  caption: string
): Promise<SocialCandidate[]> {
  if (!caption.trim()) return [];

  const rawPlaces = await extractRawSocialPlaces(caption);
  if (!rawPlaces.length) return [];

  // Pre-geocode unique city names so we reuse coords across places in the same city.
  const cityCoordCache = new Map<string, { lat: number; lng: number } | null>();
  const uniqueCities = [...new Set(rawPlaces.map((p) => p.city).filter(Boolean) as string[])];
  await Promise.all(
    uniqueCities.map(async (city) => {
      // Prefer the geocode cache; fall back to a fresh Mapbox call.
      const cached = await getCachedGeocode(city).catch(() => null);
      if (cached) { cityCoordCache.set(city, cached); return; }
      const coords = await geocodePlace(city); // unbiased — it IS the city
      cityCoordCache.set(city, coords);
      if (coords) void setCachedGeocode(city, coords.lat, coords.lng);
    })
  );

  const settled = await Promise.allSettled(
    rawPlaces.map(async (p): Promise<SocialCandidate | null> => {
      const cityCoords = p.city ? cityCoordCache.get(p.city) : undefined;
      const coords = await geocodePlace(
        p.name,
        cityCoords?.lat,
        cityCoords?.lng
      );
      if (!coords) return null;

      const validTypes: PlaceType[] = [
        'food', 'sight', 'nightlife', 'shop', 'transport', 'accommodation',
      ];
      const type: PlaceType = validTypes.includes(p.type as PlaceType)
        ? (p.type as PlaceType)
        : 'sight';

      return {
        name: p.name,
        lat: coords.lat,
        lng: coords.lng,
        type,
        context: p.context,
        confidence: p.confidence,
        city: p.city,
      };
    })
  );

  return settled
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((c): c is SocialCandidate => c !== null);
}
