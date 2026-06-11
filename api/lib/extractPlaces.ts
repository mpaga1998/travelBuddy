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

/** Exported for unit testing. */
export async function geocodePlace(
  name: string,
  biasLat: number,
  biasLng: number
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=1&proximity=${biasLng},${biasLat}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
    const coords = json.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    return { lat: coords[1], lng: coords[0] };
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
