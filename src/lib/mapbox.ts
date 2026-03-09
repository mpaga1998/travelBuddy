/**
 * Reverse geocode coordinates to get location name using OpenStreetMap Nominatim
 * Better POI coverage than Mapbox for reverse geocoding
 * @param lng Longitude
 * @param lat Latitude
 * @returns Location name (e.g., "Central Park", "Restaurant Name") or empty string if not found
 */
export async function getLocationNameFromCoordinates(
  lng: number,
  lat: number
): Promise<string> {
  try {
    // OpenStreetMap Nominatim API: https://nominatim.org/
    // address_details=1 returns detailed address with POI info
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&address_details=1&zoom=18`
    );

    if (!response.ok) {
      console.error("❌ Nominatim API error:", response.statusText);
      return "";
    }

    const data = await response.json();

    if (data) {
      // Try to get POI name first (most detailed)
      const name =
        data.address?.amenity ||  // restaurant, shop, museum, etc.
        data.address?.leisure ||  // park, playground, etc.
        data.address?.tourism ||  // attraction, monument, etc.
        data.address?.historic || // historic building
        data.name ||              // fallback to general name
        "";

      if (name) {
        console.log(`✅ Location found: "${name}"`);
        return name;
      }
    }

    console.log("⚠️ No location found for coordinates");
    return "";
  } catch (error) {
    console.error("❌ Error reverse geocoding:", error);
    return "";
  }
}
