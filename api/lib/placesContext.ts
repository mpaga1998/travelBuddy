/**
 * B1: Mapbox Places API integration for itinerary grounding.
 *
 * Before calling OpenAI, we fetch real nearby restaurants, cafés, and
 * attractions for each trip location via the Mapbox Geocoding + Search Box
 * APIs. These verified results are injected into the prompt so the model
 * cites real venues instead of hallucinating plausible-sounding ones.
 *
 * The Mapbox public token is already used client-side; on the server we read
 * it from VITE_MAPBOX_TOKEN (same env var, different runtime context).
 *
 * All network calls are best-effort: any fetch failure silently omits that
 * location from the context so generation still proceeds.
 */

const MAPBOX_TOKEN = process.env.VITE_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN ?? '';

/** How long to wait for a single Mapbox request before giving up. */
const FETCH_TIMEOUT_MS = 2000;

/** Max POI results to fetch per category per location. */
const RESULTS_PER_CATEGORY = 8;

export interface NearbyPlace {
  name: string;
  category: string;
  address: string;
}

export interface LocationPlaces {
  location: string;
  restaurants: NearbyPlace[];
  cafes: NearbyPlace[];
  attractions: NearbyPlace[];
}

export interface PlacesContext {
  byLocation: LocationPlaces[];
  /** Geocoded coordinates for each location — shared with communityPins to avoid double geocoding. */
  geocodedCoords: Map<string, { lat: number; lng: number }>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface GeocodedPoint {
  lat: number;
  lng: number;
}

/**
 * Geocode a human-readable location string to lat/lng via Mapbox Geocoding v5.
 * Returns null on any failure so callers can gracefully skip.
 */
async function geocodeLocation(location: string): Promise<GeocodedPoint | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const query = encodeURIComponent(location.split(',')[0].trim());
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=1&types=place,region,country`;

    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) return null;

    const data = await res.json() as {
      features?: Array<{ center?: [number, number] }>;
    };
    const center = data.features?.[0]?.center;
    if (!center) return null;
    return { lng: center[0], lat: center[1] };
  } catch {
    return null;
  }
}

/**
 * Fetch nearby POIs of a given Mapbox category around a lat/lng.
 * Uses the Mapbox Search Box category endpoint (v1).
 */
async function fetchNearbyCategory(
  category: string,
  lat: number,
  lng: number
): Promise<NearbyPlace[]> {
  if (!MAPBOX_TOKEN) return [];
  try {
    const url =
      `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&proximity=${lng},${lat}` +
      `&limit=${RESULTS_PER_CATEGORY}`;

    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];

    const data = await res.json() as {
      features?: Array<{
        properties?: {
          name?: string;
          poi_category?: string[];
          full_address?: string;
          address?: string;
          place_formatted?: string;
        };
      }>;
    };

    return (data.features ?? [])
      .filter((f) => f.properties?.name)
      .map((f) => {
        const p = f.properties!;
        return {
          name: p.name ?? '',
          category: p.poi_category?.[0] ?? category,
          address: p.full_address ?? p.address ?? p.place_formatted ?? '',
        };
      });
  } catch {
    return [];
  }
}

/** fetch() with a hard timeout that resolves to a 408-like rejection on expiry. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * For each unique location in the trip (arrival, stops, departure), fetch
 * verified nearby restaurants, cafés, and attractions via Mapbox.
 *
 * Locations are de-duplicated so a trip that starts and ends in the same city
 * only fires one geocode + search round-trip.
 *
 * All requests for a single location's three categories run in parallel;
 * all locations run in parallel too (usually 1–3 locations per trip).
 */
export async function fetchPlacesContext(
  arrivalLocation: string,
  departureLocation: string,
  stops?: string[]
): Promise<PlacesContext> {
  if (!MAPBOX_TOKEN) {
    console.warn('[placesContext] No Mapbox token — skipping places fetch');
    return { byLocation: [], geocodedCoords: new Map() };
  }

  // De-duplicate locations (case-insensitive first-segment comparison)
  const seen = new Set<string>();
  const uniqueLocations: string[] = [];
  for (const loc of [arrivalLocation, ...(stops ?? []), departureLocation]) {
    const key = loc.split(',')[0].trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLocations.push(loc);
    }
  }

  const geocodedCoords = new Map<string, { lat: number; lng: number }>();

  const results = await Promise.all(
    uniqueLocations.map(async (location): Promise<LocationPlaces | null> => {
      const coords = await geocodeLocation(location);
      if (!coords) return null;

      geocodedCoords.set(location, coords);

      const [restaurants, cafes, attractions] = await Promise.all([
        fetchNearbyCategory('restaurant', coords.lat, coords.lng),
        fetchNearbyCategory('cafe', coords.lat, coords.lng),
        fetchNearbyCategory('attraction', coords.lat, coords.lng),
      ]);

      return { location, restaurants, cafes, attractions };
    })
  );

  return {
    byLocation: results.filter((r): r is LocationPlaces => r !== null),
    geocodedCoords,
  };
}

/**
 * Render the places context as a prompt-ready markdown block.
 * Returns empty string if context is empty or Mapbox had no results.
 */
export function renderPlacesContext(ctx: PlacesContext): string {
  if (!ctx.byLocation.length) return '';

  const sections: string[] = [];

  for (const loc of ctx.byLocation) {
    const cityName = loc.location.split(',')[0].trim();
    const hasAny =
      loc.restaurants.length || loc.cafes.length || loc.attractions.length;
    if (!hasAny) continue;

    const lines: string[] = [
      `**📍 Verified nearby options for ${cityName} — use these; do not invent others:**`,
    ];

    if (loc.restaurants.length) {
      lines.push('- *Restaurants:*');
      for (const p of loc.restaurants) {
        lines.push(`  - ${p.name}${p.address ? ` (${p.address})` : ''}`);
      }
    }
    if (loc.cafes.length) {
      lines.push('- *Cafés:*');
      for (const p of loc.cafes) {
        lines.push(`  - ${p.name}${p.address ? ` (${p.address})` : ''}`);
      }
    }
    if (loc.attractions.length) {
      lines.push('- *Attractions:*');
      for (const p of loc.attractions) {
        lines.push(`  - ${p.name}${p.address ? ` (${p.address})` : ''}`);
      }
    }

    sections.push(lines.join('\n'));
  }

  if (!sections.length) return '';

  return (
    sections.join('\n\n') +
    '\n\n> When suggesting restaurants or attractions, prefer names from the lists above. You may supplement with other real, well-known venues, but never fabricate venue names.\n'
  );
}
