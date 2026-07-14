/**
 * Itinerary cache — Supabase-backed, per-user, 24-hour TTL.
 *
 * Protects against browser refresh and accidental double-submit.
 * The cache key is a SHA-256 hash of the normalised TripInput so that
 * minor formatting differences (whitespace, case) still hit the same entry.
 *
 * firstName is intentionally excluded from the key: the cached markdown
 * was generated with the user's name already embedded, and the same user
 * always gets the same name, so this is safe and avoids false misses.
 *
 * All operations are best-effort — any DB failure is logged and swallowed
 * so generation always proceeds normally.
 */

import { createHash } from 'crypto';
import { initSupabase } from './supabaseServer.js';
import { logger } from './log.js';
import type { TripInput } from './types.js';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Trip key
// ---------------------------------------------------------------------------

interface NormalisedTrip {
  arrivalDate: string;
  arrivalLocation: string;
  arrivalTime: string | undefined;
  departureDate: string;
  departureLocation: string;
  departureTime: string | undefined;
  stops: string[];
  budget: string | undefined;
  travelPace: string | undefined;
  tripType: string | undefined;
  interests: string[];
  desiredAttractions: string[];
  notes: string | undefined;
}

function normaliseTrip(input: TripInput): NormalisedTrip {
  return {
    arrivalDate:        input.arrival.date,
    arrivalLocation:    input.arrival.location.toLowerCase().trim(),
    arrivalTime:        input.arrival.time,
    departureDate:      input.departure.date,
    departureLocation:  input.departure.location.toLowerCase().trim(),
    departureTime:      input.departure.time,
    stops:              [...(input.stops ?? [])].map((s) => s.toLowerCase().trim()).sort(),
    budget:             input.budget,
    travelPace:         input.travelPace,
    tripType:           input.tripType,
    interests:          [...(input.interests ?? [])].map((i) => i.toLowerCase().trim()).sort(),
    desiredAttractions: [...(input.desiredAttractions ?? [])].map((a) => a.toLowerCase().trim()).sort(),
    notes:              input.notes?.toLowerCase().trim() || undefined,
  };
}

/**
 * Deterministic SHA-256 key for a trip.
 * Same trip parameters always produce the same 64-char hex string.
 */
export function buildTripKey(input: TripInput): string {
  const normalised = normaliseTrip(input);
  return createHash('sha256').update(JSON.stringify(normalised)).digest('hex');
}

// ---------------------------------------------------------------------------
// Cache read / write
// ---------------------------------------------------------------------------

/**
 * Return a cached itinerary markdown for this user + trip, or null on miss/expiry.
 */
export async function getCachedItinerary(
  userId: string,
  tripKey: string,
): Promise<string | null> {
  try {
    const supabase = initSupabase();
    const { data, error } = await supabase
      .from('itinerary_cache')
      .select('markdown, created_at')
      .eq('user_id', userId)
      .eq('trip_key', tripKey)
      .single();

    if (error || !data) {
      // P1: log misses too — hit-rate (hits / hits+misses) is a margin lever
      // for the unit-economics table; every hit is a free itinerary.
      logger.info({ userId, tripKey: tripKey.slice(0, 8) }, 'ITINERARY_CACHE: miss');
      return null;
    }

    // 24-hour TTL check
    const age = Date.now() - new Date(data.created_at as string).getTime();
    if (age > TTL_MS) {
      logger.info({ userId, tripKey: tripKey.slice(0, 8) }, 'ITINERARY_CACHE: miss (expired)');
      return null;
    }

    logger.info({ userId, tripKey: tripKey.slice(0, 8) }, 'ITINERARY_CACHE: hit');
    return data.markdown as string;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'ITINERARY_CACHE: read failed');
    return null;
  }
}

/**
 * Persist a generated itinerary for this user + trip.
 * Upserts so a re-generated itinerary replaces the stale one.
 */
export async function setCachedItinerary(
  userId: string,
  tripKey: string,
  markdown: string,
): Promise<void> {
  try {
    const supabase = initSupabase();
    const { error } = await supabase
      .from('itinerary_cache')
      .upsert(
        {
          user_id:    userId,
          trip_key:   tripKey,
          markdown,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,trip_key' },
      );
    if (error) {
      logger.warn({ err: error.message }, 'ITINERARY_CACHE: write failed');
    } else {
      logger.info({ userId, tripKey: tripKey.slice(0, 8) }, 'ITINERARY_CACHE: written');
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'ITINERARY_CACHE: write threw');
  }
}
