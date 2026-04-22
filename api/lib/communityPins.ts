/**
 * B2: Community pins injection for itinerary grounding.
 *
 * Queries the Supabase `pins` table for community-submitted spots within
 * ~15 km of each trip location. These are injected into the prompt tagged
 * as "💎 From Backpack Map travelers" so the model can weave real community
 * recommendations into the generated itinerary.
 *
 * This is the app's unique angle: no other AI itinerary tool can say
 * "your fellow travelers recommend this specific noodle stall in Osh."
 *
 * Uses a bounding-box filter (no PostGIS required). The service-role
 * Supabase client already in supabaseServer.ts bypasses RLS for this read.
 * All failures are best-effort — if Supabase is unavailable, generation
 * proceeds without community context.
 */

import { initSupabase } from './supabaseServer.js';

/** ~0.135 degrees ≈ 15 km at mid-latitudes. */
const BBOX_DEGREES = 0.135;

/** Max total pins to pass to the prompt across all locations. */
const MAX_TOTAL_PINS = 12;

/** Map from user interest strings to pin category values. */
const INTEREST_TO_CATEGORY: Record<string, string[]> = {
  'food': ['food'],
  'food & dining': ['food'],
  'nightlife': ['nightlife'],
  'sightseeing': ['sight'],
  'sights': ['sight'],
  'shopping': ['shop'],
  'beach': ['beach'],
  'nature': ['other', 'sight'],
  'adventure': ['other', 'sight'],
  'culture': ['sight', 'other'],
  'art': ['sight', 'other'],
  'history': ['sight', 'other'],
};

export interface CommunityPin {
  name: string;
  category: string;
  location: string; // city/area label
  contributor?: string; // createdByLabel if traveler
  lat: number;
  lng: number;
}

export interface CommunityPinsContext {
  pins: CommunityPin[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface LatLng { lat: number; lng: number }

/**
 * Derive the categories to filter by from the user's interests array.
 * Returns undefined (= all categories) if no mapping is found.
 */
function resolveCategories(interests?: string[]): string[] | undefined {
  if (!interests?.length) return undefined;
  const cats = new Set<string>();
  for (const interest of interests) {
    const mapped = INTEREST_TO_CATEGORY[interest.toLowerCase()];
    if (mapped) mapped.forEach((c) => cats.add(c));
  }
  return cats.size > 0 ? Array.from(cats) : undefined;
}

/**
 * Query pins within a bounding box around a point.
 * Returns up to `limit` pins ordered by likes + bookmarks descending.
 */
async function queryPinsNear(
  point: LatLng,
  categories: string[] | undefined,
  limit: number
): Promise<CommunityPin[]> {
  try {
    const supabase = initSupabase();

    let query = supabase
      .from('pins')
      .select('id, title, category, lat, lng, bookmark_count, profiles(username, role, hostel_name)')
      .gte('lat', point.lat - BBOX_DEGREES)
      .lte('lat', point.lat + BBOX_DEGREES)
      .gte('lng', point.lng - BBOX_DEGREES)
      .lte('lng', point.lng + BBOX_DEGREES)
      .order('bookmark_count', { ascending: false })
      .limit(limit);

    if (categories?.length) {
      query = query.in('category', categories);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[communityPins] Supabase query error:', error.message);
      return [];
    }

    return (data ?? []).map((row: {
      title: string;
      category: string;
      lat: number;
      lng: number;
      bookmark_count?: number;
      profiles?: { username?: string; role?: string; hostel_name?: string } | null;
    }) => {
      const profile = row.profiles;
      const isHostel = profile?.role === 'hostel';
      const contributorLabel = isHostel
        ? undefined // don't attribute to hostels
        : profile?.username ?? undefined;
      return {
        name: row.title,
        category: row.category,
        location: '',
        contributor: contributorLabel,
        lat: row.lat,
        lng: row.lng,
      };
    });
  } catch (err) {
    console.warn('[communityPins] Unexpected error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch community pins near each trip location from the Supabase `pins` table.
 *
 * Requires pre-geocoded coordinates for each location (reuse results from
 * placesContext geocoding where possible). Locations that fail to geocode
 * are silently skipped.
 *
 * `geocodedLocations` is a map of { locationString → { lat, lng } }.
 */
export async function fetchCommunityPins(
  geocodedLocations: Map<string, LatLng>,
  interests?: string[]
): Promise<CommunityPinsContext> {
  if (!geocodedLocations.size) return { pins: [] };

  const categories = resolveCategories(interests);

  // Divide the budget evenly across locations (at least 1 per location)
  const perLocation = Math.max(1, Math.floor(MAX_TOTAL_PINS / geocodedLocations.size));

  const allPins: CommunityPin[] = [];
  const seen = new Set<string>(); // deduplicate by lowercase name

  for (const [locationLabel, coords] of geocodedLocations) {
    const pins = await queryPinsNear(coords, categories, perLocation + 2); // +2 for dedup headroom
    const cityName = locationLabel.split(',')[0].trim();

    for (const pin of pins) {
      const key = pin.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      allPins.push({ ...pin, location: cityName });
      if (allPins.length >= MAX_TOTAL_PINS) break;
    }
    if (allPins.length >= MAX_TOTAL_PINS) break;
  }

  return { pins: allPins };
}

/**
 * Render the community pins context as a prompt-ready markdown block.
 * Returns empty string if no pins were found.
 */
export function renderCommunityPinsContext(ctx: CommunityPinsContext): string {
  if (!ctx.pins.length) return '';

  const lines: string[] = [
    '**💎 Backpack Map community picks — weave 1–2 per day; preserve the exact names:**',
  ];

  for (const pin of ctx.pins) {
    const contributor = pin.contributor ? ` — shared by ${pin.contributor}` : ' — shared by a traveler';
    lines.push(`- "${pin.name}" (${pin.category}, ${pin.location})${contributor}`);
  }

  lines.push(
    '',
    '> When including a community pin, use the exact name above and note it as a traveler recommendation.'
  );

  return lines.join('\n') + '\n';
}
