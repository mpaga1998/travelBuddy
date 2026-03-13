/**
 * Post-processing: geocode all venues in itinerary after validation
 * Converts venue names to coordinates for precise Maps links
 */

import { StructuredItinerary } from './itinerarySchema.js';
import { geocodeVenue } from './mapboxGeocoding.js';

/**
 * Geocode all venue names in itinerary to get coordinates
 * Runs after validation, non-blocking (failures don't break itinerary)
 */
export async function geocodeItineraryVenues(
  itinerary: StructuredItinerary
): Promise<void> {
  console.log('🗺️ Geocoding venue names to coordinates...');

  const geocodingPromises: Promise<void>[] = [];

  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      if (activity.venueName && !activity.coordinates && !activity.isTravel) {
        const promise = (async () => {
          try {
            const coordinates = await geocodeVenue(activity.venueName, activity.location);
            if (coordinates) {
              activity.coordinates = coordinates;
              console.log(`✅ Geocoded: ${activity.venueName} → [${coordinates[0]}, ${coordinates[1]}]`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to geocode ${activity.venueName}:`, error);
            // Non-blocking: continue without coordinates
          }
        })();

        geocodingPromises.push(promise);
      }
    }
  }

  // Wait for all geocoding requests to complete
  if (geocodingPromises.length > 0) {
    await Promise.all(geocodingPromises);
    console.log(`🗺️ Geocoding complete: ${geocodingPromises.length} venues processed`);
  }
}
