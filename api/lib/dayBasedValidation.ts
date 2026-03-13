/**
 * Validation for day-based itineraries
 */

import { StructuredItinerary } from './itinerarySchema.js';
import { TripInput } from './types.js';

export function validateDayBasedItinerary(
  itinerary: StructuredItinerary,
  input: TripInput
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check night allocation
  let totalSleeped = 0;
  itinerary.days.forEach((day) => {
    if (day.sleep) {
      totalSleeped++;
    }
  });

  if (totalSleeped !== itinerary.constraints.nightsAllocated) {
    errors.push(
      `Night count mismatch: ${totalSleeped} sleeps allocated, but ${itinerary.constraints.nightsAllocated} nights available`
    );
  }

  // 2. Check all activities have locations
  itinerary.days.forEach((day) => {
    day.activities.forEach((activity, idx) => {
      if (!activity.location?.trim()) {
        errors.push(
          `Day ${day.dayNumber}, Activity ${idx + 1}: missing location`
        );
      }
      if (!activity.description?.trim()) {
        errors.push(
          `Day ${day.dayNumber}, Activity ${idx + 1}: missing description`
        );
      }
      if (!activity.durationEstimate?.trim()) {
        warnings.push(
          `Day ${day.dayNumber}, Activity ${idx + 1}: missing duration estimate`
        );
      }
    });
  });

  // 3. Check travel activities are properly marked
  itinerary.days.forEach((day) => {
    day.activities.forEach((activity, idx) => {
      // If it looks like travel, should be marked
      if (
        activity.description.toLowerCase().includes('travel') ||
        activity.description.toLowerCase().includes('train') ||
        activity.description.toLowerCase().includes('bus')
      ) {
        if (!activity.isTravel) {
          warnings.push(
            `Day ${day.dayNumber}, Activity ${idx + 1}: appears to be travel but not marked with isTravel: true`
          );
        }
      }
    });
  });

  // 4. Check user-requested stops are visited
  if (input.stops && input.stops.length > 0) {
    const allLocations = new Set<string>();
    itinerary.days.forEach((day) => {
      day.activities.forEach((activity) => {
        allLocations.add(activity.location.toLowerCase().trim());
      });
      if (day.sleep) {
        allLocations.add(day.sleep.location.toLowerCase().trim());
      }
    });

    const requestedStops = input.stops.map((s) => s.toLowerCase().trim());
    for (const requestedStop of requestedStops) {
      const found = Array.from(allLocations).some(
        (loc) =>
          loc.includes(requestedStop) || requestedStop.includes(loc)
      );
      if (!found) {
        errors.push(
          `Missing requested stop: "${input.stops[requestedStops.indexOf(requestedStop)]}" not found in itinerary`
        );
      }
    }
  }

  // 5. Check arrival location on first day
  if (itinerary.days.length > 0) {
    const firstDayLocations = new Set(
      itinerary.days[0].activities.map((a) => a.location.toLowerCase().trim())
    );
    const arrivalLower = input.arrival.location.toLowerCase().trim();
    
    // First activity should be in or lead to arrival location
    const startsInArrival = Array.from(firstDayLocations).some(
      (loc) => loc.includes(arrivalLower) || arrivalLower.includes(loc)
    );

    if (!startsInArrival) {
      warnings.push(
        `First day doesn't start in ${input.arrival.location} - ensure you arrive there first`
      );
    }
  }

  // 6. Check departure location on last day
  if (itinerary.days.length > 0) {
    const lastDay = itinerary.days[itinerary.days.length - 1];
    const lastDayLocations = new Set(
      lastDay.activities.map((a) => a.location.toLowerCase().trim())
    );
    const departureLower = input.departure.location.toLowerCase().trim();
    
    // Must end in or travel to departure location
    const endsInDeparture = Array.from(lastDayLocations).some(
      (loc) => loc.includes(departureLower) || departureLower.includes(loc)
    );

    if (!endsInDeparture) {
      errors.push(
        `Itinerary must end in ${input.departure.location} but last day activities are in: ${Array.from(lastDayLocations).join(', ')}`
      );
    }
  }

  // 7. Check sleep locations are valid
  itinerary.days.forEach((day) => {
    if (day.sleep && day.sleep.location) {
      // Sleep location should match one of the day's activity locations
      const dayLocations = new Set(
        day.activities.map((a) => a.location.toLowerCase().trim())
      );
      const sleepLower = day.sleep.location.toLowerCase().trim();
      
      const sleepValid = Array.from(dayLocations).some(
        (loc) => loc.includes(sleepLower) || sleepLower.includes(loc)
      );

      if (!sleepValid) {
        errors.push(
          `Day ${day.dayNumber}: Cannot sleep in ${day.sleep.location} - not visited that day. Day locations: ${Array.from(dayLocations).join(', ')}`
        );
      }
    }
  });

  // 8. Check logical day flow (no teleportation)
  let currentLocation: string | null = null;

  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];

    for (let actIdx = 0; actIdx < day.activities.length; actIdx++) {
      const activity = day.activities[actIdx];

      // If previous activity exists, check location continuity
      if (currentLocation && currentLocation !== activity.location.toLowerCase().trim()) {
        // Check if previous activity was travel TO this location
        let foundTravel = false;
        if (actIdx > 0) {
          const prevActivity = day.activities[actIdx - 1];
          if (prevActivity.isTravel && prevActivity.location.toLowerCase().includes(activity.location.toLowerCase())) {
            foundTravel = true;
          }
        }

        if (!foundTravel) {
          // Could be legitimate if same city (e.g., "Milano" vs "Milano, Milan, Italy")
          const currentNoCountry = currentLocation.split(',')[0].toLowerCase().trim();
          const nextNoCountry = activity.location.split(',')[0].toLowerCase().trim();
          
          if (currentNoCountry !== nextNoCountry) {
            warnings.push(
              `Day ${day.dayNumber}: Possible location jump from ${currentLocation} to ${activity.location} without explicit travel activity`
            );
          }
        }
      }

      currentLocation = activity.location.toLowerCase().trim();
    }

    // Update location from sleep
    if (day.sleep) {
      currentLocation = day.sleep.location.toLowerCase().trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
