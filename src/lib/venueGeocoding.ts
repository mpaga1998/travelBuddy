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
    // Do NOT embed cityHint in the query string — if the venue isn't in Mapbox's
    // index, appending ", Milan" causes every failed query to return the city
    // centroid instead of undefined, stacking all unfound pins at the same point.
    // Proximity bias alone is the correct signal.
    const query = venueName;
    const encodedQuery = encodeURIComponent(query);
    const params = new URLSearchParams({ limit: '1', access_token: mapboxToken });
    if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);
    // cityHint is kept as a parameter for call-site clarity but is no longer
    // embedded in the query. Suppress the unused-var lint warning:
    void cityHint;

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

/**
 * Returns true when the user is on iOS or Mac Safari — i.e., Apple Maps is preferred.
 */
function isAppleMapsPreferred(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS devices
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // macOS Safari (not wrapped in Chromium/Edge)
  if (
    navigator.platform?.startsWith('Mac') &&
    /Safari/.test(ua) &&
    !/Chrome|Chromium|Edg/.test(ua)
  ) return true;
  return false;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function openMapsUrl(url: string): void {
  // Always open in a new tab/window. On iOS, window.open with a custom scheme
  // (maps://) or Apple Maps URL causes iOS to hand off to the Maps app while
  // keeping the current page alive. Using window.location.href would navigate
  // away from the SPA, making it look like a redirect to the home page on return.
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Platform-aware venue open:
 * - iOS / Mac Safari  → Apple Maps (maps:// on iOS, https://maps.apple.com on desktop)
 * - Everything else   → Google Maps search
 *
 * Attempts geocoding first for a precise coordinates URL.
 * Falls back to a search-by-name URL when geocoding fails or returns nothing.
 */
export async function openVenueInMaps(venueName: string, city: string): Promise<void> {
  const apple = isAppleMapsPreferred();
  const ios = isIOS();
  const query = city ? `${venueName} ${city}` : venueName;

  try {
    const result = await geocodeVenueDetailed(venueName, city);

    if (result) {
      const url = apple
        ? generateAppleMapsURL([result.lat, result.lng], venueName)
        : generateGoogleMapsURL([result.lat, result.lng], venueName);
      openMapsUrl(url);
      return;
    }
  } catch {
    // fall through to search fallback
  }

  // Fallback: open a search URL without coordinates
  const encodedQuery = encodeURIComponent(query);
  const fallbackUrl = apple
    ? (ios
        ? `maps://?q=${encodedQuery}`
        : `https://maps.apple.com/?q=${encodedQuery}`)
    : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  openMapsUrl(fallbackUrl);
}

/**
 * Mobile-safe venue open that works within a user-gesture context.
 *
 * Mobile browsers block window.open inside async callbacks (popup blocker).
 * This function opens the window synchronously with a Google Maps search URL,
 * then async-upgrades it to a precise coordinates URL after geocoding.
 *
 * Call this directly from an onClick handler (not inside a promise chain).
 */
export function openVenueInMapsSync(venueName: string, city: string): void {
  const apple = isAppleMapsPreferred();
  const ios = isIOS();
  const query = city ? `${venueName} ${city}` : venueName;
  const encodedQuery = encodeURIComponent(query);

  // Build the synchronous fallback URL (no geocoding needed).
  const fallbackUrl = apple
    ? (ios ? `maps://?q=${encodedQuery}` : `https://maps.apple.com/?q=${encodedQuery}`)
    : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  // Open synchronously inside the user gesture — this is allowed by all browsers.
  const win = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');

  // Async-upgrade: geocode and navigate the already-open tab to a precise URL.
  if (win) {
    geocodeVenueDetailed(venueName, city)
      .then((result) => {
        if (result && !win.closed) {
          const preciseUrl = apple
            ? generateAppleMapsURL([result.lat, result.lng], venueName)
            : generateGoogleMapsURL([result.lat, result.lng], venueName);
          // On iOS, Apple Maps deep link must be opened fresh; close the fallback tab.
          if (apple && ios) {
            window.open(preciseUrl, '_blank', 'noopener,noreferrer');
            win.close();
          } else {
            win.location.href = preciseUrl;
          }
        }
      })
      .catch(() => { /* keep fallback tab open */ });
  }
}
