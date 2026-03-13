/**
 * Day-based itinerary validation
 * Ensures logical consistency: no teleportation, activities in visited locations, proper location flow
 */

import { StructuredItinerary } from './itinerarySchema.js';
import { TripInput } from './types.js';
import { calculateNights } from './inputValidation.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDayBasedItinerary(
  itinerary: StructuredItinerary,
  input: TripInput
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedNights = calculateNights(input);

  // 1. Basic structure checks
  if (!itinerary.days || itinerary.days.length === 0) {
    errors.push('Itinerary must have at least one day');
  }

  if (!itinerary.constraints) {
    errors.push('Missing constraints object');
  }

  // 2. Night count validation
  if (itinerary.constraints?.nightsAllocated !== expectedNights - 1) {
    errors.push(
      `Night count mismatch: allocated ${itinerary.constraints?.nightsAllocated}, expected ${expectedNights - 1}`
    );
  }

  // 3. Validate each day
  const visitedLocations = new Set<string>();
  let currentLocation = input.arrival.location.toLowerCase().trim();
  visitedLocations.add(currentLocation);

  itinerary.days?.forEach((day, dayIdx) => {
    if (!day.activities || day.activities.length === 0) {
      errors.push(`Day ${day.dayNumber}: must have at least one activity`);
      return;
    }

    // Track locations visited on this day
    const dayLocations = new Set<string>();

    // Check each activity
    day.activities.forEach((activity, actIdx) => {
      // Validate location
      if (!activity.location) {
        errors.push(
          `Day ${day.dayNumber}, Activity ${actIdx + 1}: missing location`
        );
        return;
      }

      const activityLocation = activity.location.toLowerCase().trim();
      dayLocations.add(activityLocation);

      // Validate time
      if (!['morning', 'afternoon', 'evening'].includes(activity.time)) {
        errors.push(
          `Day ${day.dayNumber}: invalid time "${activity.time}"`
        );
      }

      // Validate description
      if (!activity.description?.trim()) {
        errors.push(
          `Day ${day.dayNumber}, Activity ${actIdx + 1}: missing description`
        );
      }

      // Track travel activities
      if (activity.isTravel) {
        if (!activity.travelMode) {
          warnings.push(
            `Day ${day.dayNumber}: travel activity missing mode`
          );
        }
        if (!activity.costEstimate) {
          warnings.push(
            `Day ${day.dayNumber}: travel activity missing cost estimate`
          );
        }
      }
    });

    // Validate location flow: each subsequent activity must be in a location we're in or traveled to
    let activityLocation = currentLocation;
    for (let i = 0; i < day.activities.length; i++) {
      const activity = day.activities[i];
      const nextLocation = activity.location.toLowerCase().trim();

      if (activity.isTravel) {
        // Travel activity moves us to a new location
        activityLocation = nextLocation;
        visitedLocations.add(nextLocation);
      } else {
        // Non-travel activity must be in current location or in a location where travel just happened
        if (nextLocation !== activityLocation && 
            !visitedLocations.has(nextLocation) &&
            (i === 0 || !day.activities[i - 1]?.isTravel)) {
          errors.push(
            `Day ${day.dayNumber}: activity "${activity.description}" is in ${activity.location} but you're currently in ${currentLocation}. Need travel activity to reach ${activity.location}`
          );
        }
        activityLocation = nextLocation;
      }
    }

    // Update current location for next day
    currentLocation = activityLocation;

    // Validate sleep location
    if (day.sleep) {
      const sleepLocation = day.sleep.location.toLowerCase().trim();
      if (!dayLocations.has(sleepLocation)) {
        errors.push(
          `Day ${day.dayNumber}: can't sleep in ${day.sleep.location} - you weren't there that day`
        );
      }
    }
  });

  // 4. Check user-requested stops were visited
  if (input.stops && input.stops.length > 0) {
    const allActivityLocations = new Set<string>();
    itinerary.days?.forEach((day) => {
      day.activities?.forEach((activity) => {
        allActivityLocations.add(activity.location.toLowerCase().trim());
      });
    });

    input.stops.forEach((stop) => {
      const stopLower = stop.toLowerCase().trim();
      const found = Array.from(allActivityLocations).some(
        (loc) =>
          loc.includes(stopLower) ||
          stopLower.includes(loc) ||
          loc === stopLower
      );

      if (!found) {
        errors.push(
          `Required stop "${stop}" not included in itinerary`
        );
      }
    });
  }

  // 5. Check ends at departure location
  if (itinerary.days && itinerary.days.length > 0) {
    const lastDay = itinerary.days[itinerary.days.length - 1];
    if (lastDay.activities && lastDay.activities.length > 0) {
      const lastActivityLocation = lastDay.activities[
        lastDay.activities.length - 1
      ].location.toLowerCase().trim();
      const departureLower = input.departure.location.toLowerCase().trim();

      if (
        !lastActivityLocation.includes(departureLower) &&
        !departureLower.includes(lastActivityLocation)
      ) {
        errors.push(
          `Itinerary must end in ${input.departure.location} (departure location) but last activity is in ${lastDay.activities[lastDay.activities.length - 1].location}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
