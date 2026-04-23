/**
 * Client-side venue geocoding for on-demand Maps link generation
 * Fetches coordinates only when user clicks the map emoji
 */

interface MapboxGeocodeResponse {
  features: Array<{
    center: [number, number]; // [longitude, latitude]
    place_name: string;
    relevance: number; // 0–1 match confidence
  }>;
}

/** Full geocoding result including place name and match confidence. */
export interface GeocodingResult {
  lat: number;
  lng: number;
  placeName: string;
  relevance: number;
}

/**
 * Geocode with full result details.
 * Accepts an optional proximity bias (city center) so ambiguous venue names
 * resolve to the correct city. Used by ItineraryMapLayer.
 */
export async function geocodeVenueDetailed(
  venueName: string,
  cityHint?: string,
  proximity?: { lat: number; lng: number },
): Promise<GeocodingResult | undefined> {
  if (!venueName || venueName.trim().length === 0) return undefined;

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.warn('⚠️ VITE_MAPBOX_TOKEN not set');
    return undefined;
  }

  try {
    const query = cityHint ? `${venueName}, ${cityHint}` : venueName;
    const encodedQuery = encodeURIComponent(query);
    const params = new URLSearchParams({ limit: '1', access_token: mapboxToken });
    if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?${params}`,
    );

    if (!response.ok) {
      console.error(`Mapbox geocoding error: ${response.statusText}`);
      return undefined;
    }

    const data: MapboxGeocodeResponse = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return {
        lat: latitude,
        lng: longitude,
        placeName: data.features[0].place_name,
        relevance: data.features[0].relevance,
      };
    }

    return undefined;
  } catch (error) {
    console.error(`Geocoding error for "${venueName}":`, error);
    return undefined;
  }
}

/**
 * Geocode a venue name to get coordinates (called on-demand).
 * Returns [lat, lng] for backward compatibility with existing callers.
 */
export async function geocodeVenue(
  venueName: string,
  cityHint?: string,
): Promise<[number, number] | undefined> {
  const result = await geocodeVenueDetailed(venueName, cityHint);
  if (!result) return undefined;
  return [result.lat, result.lng];
}

/**
 * Generate Google Maps URL from coordinates or venue name
 */
export function generateGoogleMapsURL(
  coordinates?: [number, number],
  venueName?: string
): string {
  if (coordinates) {
    const [lat, lng] = coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  if (venueName) {
    return `https://www.google.com/maps/search/${encodeURIComponent(venueName)}`;
  }

  return '';
}

/**
 * Generate Apple Maps URL from coordinates or venue name
 */
export function generateAppleMapsURL(
  coordinates?: [number, number],
  venueName?: string
): string {
  if (coordinates) {
    const [lat, lng] = coordinates;
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(venueName || 'Location')}`;
  }

  if (venueName) {
    return `https://maps.apple.com/?q=${encodeURIComponent(venueName)}`;
  }

  return '';
}
