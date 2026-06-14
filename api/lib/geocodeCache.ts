/**
 * Geocoding cache — Supabase-backed, cross-user.
 *
 * Wraps Mapbox geocoding lookups so identical place strings are only
 * resolved once per 90 days. All operations are best-effort: any DB
 * failure is logged and silently swallowed so geocoding still proceeds.
 */

import { initSupabase } from './supabaseServer.js';
import { logger } from './log.js';

/** Normalise a place string to a stable cache key. */
function normaliseKey(place: string): string {
  return place.toLowerCase().trim();
}

/**
 * Return cached coordinates for `place`, or null if not cached / expired.
 * Cache entries older than 90 days are treated as misses.
 */
export async function getCachedGeocode(
  place: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const supabase = initSupabase();
    const { data, error } = await supabase
      .from('geocode_cache')
      .select('lat, lng, created_at')
      .eq('place_key', normaliseKey(place))
      .single();

    if (error || !data) return null;

    // 90-day TTL check
    const age = Date.now() - new Date(data.created_at as string).getTime();
    if (age > 90 * 24 * 60 * 60 * 1000) return null;

    return { lat: data.lat as number, lng: data.lng as number };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, place }, 'GEOCACHE: read failed');
    return null;
  }
}

/**
 * Persist geocoded coordinates for `place`.
 * Uses upsert so re-geocoding an existing entry simply refreshes `created_at`.
 */
export async function setCachedGeocode(
  place: string,
  lat: number,
  lng: number,
): Promise<void> {
  try {
    const supabase = initSupabase();
    const { error } = await supabase
      .from('geocode_cache')
      .upsert(
        { place_key: normaliseKey(place), lat, lng, created_at: new Date().toISOString() },
        { onConflict: 'place_key' },
      );
    if (error) {
      logger.warn({ err: error.message, place }, 'GEOCACHE: write failed');
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, place }, 'GEOCACHE: write threw');
  }
}
