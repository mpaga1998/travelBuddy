/**
 * Mapbox Geocoding utility for converting venue names to coordinates
 * Used to generate precise Google Maps / Apple Maps links
 */

interface MapboxGeocodeResponse {
  type: string;
  query: string[];
  features: Array<{
    id: string;
    type: string;
    place_name: string;
    center: [number, number]; // [longitude, latitude]
    geometry: { type: string; coordinates: [number, number] };
    properties?: Record<string, unknown>;
  }>;
}

/**
 * Geocode a venue name to get coordinates using Mapbox API
 * Restricted to Italy for accuracy
 */
export async function geocodeVenue(
  venueName: string,
  cityHint?: string
): Promise<[number, number] | null> {
  if (!venueName || venueName.trim().length === 0) {
    return null;
  }

  // Use environment variable for API key
  const mapboxToken = process.env.VITE_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.warn('⚠️ MAPBOX_TOKEN not set, skipping geocoding');
    return null;
  }

  try {
    // Include city hint in query for better accuracy
    const query = cityHint ? `${venueName}, ${cityHint}, Italy` : `${venueName}, Italy`;
    const encodedQuery = encodeURIComponent(query);

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?country=IT&limit=1&access_token=${mapboxToken}`
    );

    if (!response.ok) {
      console.error(`❌ Mapbox geocoding error: ${response.statusText}`);
      return null;
    }

    const data: MapboxGeocodeResponse = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return [latitude, longitude]; // Return [lat, lng] format
    }

    console.warn(`⚠️ No results found for: ${venueName}`);
    return null;
  } catch (error) {
    console.error(`❌ Geocoding error for "${venueName}":`, error);
    return null;
  }
}

/**
 * Generate Google Maps search URL from coordinates or venue name
 */
export function generateGoogleMapsURL(
  coordinates?: [number, number],
  venueName?: string
): string {
  if (coordinates) {
    // Use direct coordinates for most accurate link
    const [lat, lng] = coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  if (venueName) {
    // Fallback to search by name
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

/**
 * Generate both Google Maps and Apple Maps URLs
 */
export function generateMapsLinks(
  coordinates?: [number, number],
  venueName?: string
): { google: string; apple: string } {
  return {
    google: generateGoogleMapsURL(coordinates, venueName),
    apple: generateAppleMapsURL(coordinates, venueName),
  };
}
