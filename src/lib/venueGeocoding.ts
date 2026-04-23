/**
 * Client-side venue geocoding for on-demand Maps link generation
 * Fetches coordinates only when user clicks the map emoji
 */

interface MapboxGeocodeResponse {
  features: Array<{
    center: [number, number]; // [longitude, latitude]
    place_name: string;
  }>;
}

/**
 * Geocode a venue name to get coordinates (called on-demand)
 */
export async function geocodeVenue(
  venueName: string,
  cityHint?: string
): Promise<[number, number] | undefined> {
  if (!venueName || venueName.trim().length === 0) {
    return undefined;
  }

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.warn('⚠️ VITE_MAPBOX_TOKEN not set');
    return undefined;
  }

  try {
    const query = cityHint ? `${venueName}, ${cityHint}` : venueName;
    const encodedQuery = encodeURIComponent(query);

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?limit=1&access_token=${mapboxToken}`
    );

    if (!response.ok) {
      console.error(`Mapbox geocoding error: ${response.statusText}`);
      return undefined;
    }

    const data: MapboxGeocodeResponse = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return [latitude, longitude]; // Return [lat, lng] format
    }

    return undefined;
  } catch (error) {
    console.error(`Geocoding error for "${venueName}":`, error);
    return undefined;
  }
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
