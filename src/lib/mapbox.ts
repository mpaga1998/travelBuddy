/**
 * Reverse geocode coordinates to get location name using Mapbox Geocoding API
 * @param lng Longitude
 * @param lat Latitude
 * @returns Location name (e.g., "Central Park", "Restaurant Name") or empty string if not found
 */
export async function getLocationNameFromCoordinates(
  lng: number,
  lat: number
): Promise<string> {
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string;
    if (!token) {
      console.warn("⚠️ VITE_MAPBOX_TOKEN not set");
      return "";
    }

    // Mapbox Geocoding API: https://docs.mapbox.com/api/search/geocoding/
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=poi,place,address&limit=1&access_token=${token}`
    );

    if (!response.ok) {
      console.error("❌ Mapbox Geocoding API error:", response.statusText);
      return "";
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      
      // Try to get the most relevant name
      // Priority: text (short name) > place_name (full name with address)
      const name = feature.text || feature.place_name || "";
      
      console.log(`✅ Location found: "${name}"`);
      return name;
    }

    console.log("⚠️ No location found for coordinates");
    return "";
  } catch (error) {
    console.error("❌ Error reverse geocoding:", error);
    return "";
  }
}
