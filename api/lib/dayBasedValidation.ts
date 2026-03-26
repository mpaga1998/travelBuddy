/**
 * Day-based itinerary validation
 * Ensures logical consistency: no teleportation, proper location flow, realistic pacing
 */

import { StructuredItinerary } from './itinerarySchema.js';
import { TripInput } from './types.js';
import { calculateNights } from './inputValidation.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Realistic travel times between major Italian cities (in hours)
const REALISTIC_TRAVEL_TIMES: Record<string, Record<string, number>> = {
  'milano': { 'venice': 2.5, 'firenze': 2, 'como': 1, 'rome': 3 },
  'venice': { 'milano': 2.5, 'firenze': 3.5, 'rome': 4 },
  'firenze': { 'milano': 2, 'venice': 3.5, 'rome': 2.5 },
  'como': { 'milano': 1, 'venice': 3, 'firenze': 2.5 },
  'rome': { 'milano': 3, 'venice': 4, 'firenze': 2.5 },
};

/**
 * Parse duration string to hours (e.g., "1.5 hours" → 1.5, "2 hours 30 mins" → 2.5)
 */
function parseDurationToHours(duration: string): number {
  if (!duration) return 0;
  
  const hourMatch = duration.match(/(\d+(?:\.\d+)?)\s*hour/i);
  const minMatch = duration.match(/(\d+)\s*min/i);
  
  let hours = hourMatch ? parseFloat(hourMatch[1]) : 0;
  const mins = minMatch ? parseInt(minMatch[1]) : 0;
  
  return hours + mins / 60;
}

/**
 * Get max daily activity hours based on travel pace
 */
function getMaxDailyHours(pace?: string): number {
  switch (pace) {
    case 'relaxed':
      return 5;
    case 'active':
      return 9;
    case 'moderate':
    default:
      return 7;
  }
}

/**
 * Get realistic travel time or undefined if no known route
 */
function getRealisticTravelTime(from: string, to: string): number | undefined {
  const fromNorm = from.toLowerCase().trim();
  const toNorm = to.toLowerCase().trim();
  
  if (fromNorm === toNorm) return 0;
  
  const fromRoutes = REALISTIC_TRAVEL_TIMES[fromNorm];
  if (!fromRoutes) return undefined;
  
  return fromRoutes[toNorm];
}

/**
 * Normalize city name for comparison: "Milano, Milan, Italy" -> "milano"
 */
function normalizeCity(city: string): string {
  if (!city) return '';
  return city.split(',')[0].trim().toLowerCase();
}

export function validateDayBasedItinerary(
  itinerary: StructuredItinerary,
  input: TripInput
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedNights = calculateNights(input);
  const maxDailyHours = getMaxDailyHours(input.travelPace);

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

  // 2a. DAY COUNT VALIDATION - Must match calendar days
  const expectedDays = expectedNights + 1; // 3 nights = 4 calendar days
  const actualDays = itinerary.days?.length || 0;
  if (actualDays !== expectedDays) {
    errors.push(
      `Day count mismatch: generated ${actualDays} days, but there are ${expectedDays} calendar days in the trip (${expectedNights} nights sleep = ${expectedDays} days)`
    );
  }

  // 2b. TIMING VALIDATION - Enforce arrival/departure time constraints
  const firstDay = itinerary.days?.[0];
  const lastDay = itinerary.days?.[itinerary.days.length - 1];

  if (firstDay && input.arrival.time) {
    const morningActivities = firstDay.activities?.filter(a => a.time === 'morning') || [];
    const afternoonActivities = firstDay.activities?.filter(a => a.time === 'afternoon') || [];
    const nightActivities = firstDay.activities?.filter(a => a.time === 'night') || [];
    
    if (input.arrival.time === 'morning') {
      // Morning arrival: afternoon + night allowed (NOT morning)
      if (morningActivities.length > 0) {
        errors.push(`Day 1 violation: User arrives in MORNING but has ${morningActivities.length} morning activities. Morning is used for arrival/travel. REMOVE all morning activities. Allow only afternoon + night.`);
      }
    } else if (input.arrival.time === 'afternoon') {
      // Afternoon arrival: night only (NOT morning, NOT afternoon)
      if (morningActivities.length > 0 || afternoonActivities.length > 0) {
        errors.push(`Day 1 violation: User arrives in AFTERNOON but has ${morningActivities.length} morning + ${afternoonActivities.length} afternoon activities. User needs afternoon to settle in. REMOVE all morning & afternoon activities. Allow NIGHT ONLY.`);
      }
    } else if (input.arrival.time === 'night') {
      // Night arrival: check-in only (NOT morning, NOT afternoon, ONLY check-in at night)
      if (morningActivities.length > 0 || afternoonActivities.length > 0) {
        errors.push(`Day 1 violation: User arrives at NIGHT but has ${morningActivities.length} morning + ${afternoonActivities.length} afternoon activities. REMOVE all daytime activities. Allow ONLY check-in/rest activity (1 night activity).`);
      }
      // Check that night activities are only check-in related
      const sightseeingAtNight = nightActivities.filter(a =>
        !a.description?.toLowerCase().includes('arrive') &&
        !a.description?.toLowerCase().includes('check') &&
        !a.description?.toLowerCase().includes('rest') &&
        !a.description?.toLowerCase().includes('accommodation') &&
        !a.description?.toLowerCase().includes('hotel') &&
        !a.description?.toLowerCase().includes('settle')
      ) || [];
      if (sightseeingAtNight.length > 0) {
        errors.push(`Day 1 violation: User arrives at night but has ${sightseeingAtNight.length} sightseeing activities. Night arrival = check-in only. Remove: ${sightseeingAtNight.map(a => `"${a.description?.substring(0, 25)}..."`).join(', ')}`);
      }
    }
  }

  if (lastDay && input.departure.time) {
    const morningActivities = lastDay.activities?.filter(a => a.time === 'morning') || [];
    const afternoonActivities = lastDay.activities?.filter(a => a.time === 'afternoon') || [];
    const nightActivities = lastDay.activities?.filter(a => a.time === 'night' && !a.description?.toLowerCase().includes('depart')) || [];
    
    if (input.departure.time === 'morning') {
      // Morning departure: NO activities (just depart)
      if (morningActivities.length > 0 || afternoonActivities.length > 0 || nightActivities.length > 0) {
        errors.push(`Final day violation: User departs in MORNING but has ${morningActivities.length} morning + ${afternoonActivities.length} afternoon + ${nightActivities.length} night activities. NO time for activities. Final day must ONLY be departure/travel to station. REMOVE all activities.`);
      }
    } else if (input.departure.time === 'afternoon') {
      // Afternoon departure: morning only (NOT afternoon, NOT night)
      if (afternoonActivities.length > 0 || nightActivities.length > 0) {
        errors.push(`Final day violation: User departs in AFTERNOON but has ${afternoonActivities.length} afternoon + ${nightActivities.length} night activities. Afternoon is reserved for travel/departure. Allow MORNING ONLY, then travel. REMOVE all afternoon/night activities.`);
      }
    } else if (input.departure.time === 'night') {
      // Night departure: morning + afternoon allowed (NOT night except departure)
      if (nightActivities.length > 0) {
        errors.push(`Final day violation: User departs at NIGHT but has ${nightActivities.length} night activities. Night is reserved for travel/departure. Allow MORNING + AFTERNOON only. REMOVE all night activities (except final departure).`);
      }
    }
  }

  // 3. Validate each day
  const visitedLocations = new Set<string>();
  let currentLocation = normalizeCity(input.arrival.location);
  visitedLocations.add(currentLocation);

  itinerary.days?.forEach((day, dayIdx) => {
    if (!day.activities || day.activities.length === 0) {
      errors.push(`Day ${day.dayNumber}: must have at least one activity`);
      return;
    }

    // Track locations and times for this day
    const dayLocations = new Set<string>();
    let totalActivityHours = 0;
    let hasTravel = false;
    let travelTimeThisDay = 0;

    // Check each activity
    day.activities.forEach((activity, actIdx) => {
      // Validate location
      if (!activity.location) {
        errors.push(
          `Day ${day.dayNumber}, Activity ${actIdx + 1}: missing location`
        );
        return;
      }

      const activityLocation = normalizeCity(activity.location);
      dayLocations.add(activityLocation);

      // Validate time
      if (!['morning', 'afternoon', 'night'].includes(activity.time)) {
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

      // Parse duration
      const activityHours = parseDurationToHours(activity.durationEstimate);

      if (activity.isTravel) {
        hasTravel = true;
        travelTimeThisDay += activityHours;

        // Validate travel times are realistic
        if (activity.travelMode && actIdx > 0) {
          const prevActivity = day.activities[actIdx - 1];
          if (prevActivity && !prevActivity.isTravel) {
            const fromCity = normalizeCity(prevActivity.location);
            const toCity = normalizeCity(activity.location);
            const realisticTime = getRealisticTravelTime(fromCity, toCity);

            if (
              realisticTime !== undefined &&
              Math.abs(activityHours - realisticTime) > 0.5
            ) {
              warnings.push(
                `Day ${day.dayNumber}: Travel from ${prevActivity.location} to ${activity.location} estimated ${activityHours}h, but realistic time is ~${realisticTime.toFixed(1)}h`
              );
            }
          }
        }

        if (!activity.travelMode) {
          warnings.push(
            `Day ${day.dayNumber}: travel activity missing mode (train/bus/flight)`
          );
        }
        if (!activity.costEstimate) {
          warnings.push(
            `Day ${day.dayNumber}: travel activity missing cost estimate`
          );
        }
      }

      totalActivityHours += activityHours;
    });

    // Check daily pacing
    if (totalActivityHours > maxDailyHours + 0.5) {
      // Allow 30min buffer for rounding
      errors.push(
        `Day ${day.dayNumber}: Total activity time is ${totalActivityHours.toFixed(1)} hours, but maximum for ${input.travelPace || 'moderate'} pace is ${maxDailyHours} hours. This is too packed.`
      );
    } else if (totalActivityHours > maxDailyHours) {
      warnings.push(
        `Day ${day.dayNumber}: Total activity time is ${totalActivityHours.toFixed(1)} hours, approaching the ${maxDailyHours}-hour limit for ${input.travelPace || 'moderate'} pace`
      );
    }

    // Validate location flow: each subsequent activity must be in a location we're in or traveled to
    let activityLocation = currentLocation;
    for (let i = 0; i < day.activities.length; i++) {
      const activity = day.activities[i];
      const nextLocation = normalizeCity(activity.location);

      if (activity.isTravel) {
        // Travel activity moves us to a new location
        activityLocation = nextLocation;
        visitedLocations.add(nextLocation);
      } else {
        // Non-travel activity must be in current location or in a location where travel just happened
        if (
          nextLocation !== activityLocation &&
          !visitedLocations.has(nextLocation) &&
          (i === 0 || !day.activities[i - 1]?.isTravel)
        ) {
          errors.push(
            `Day ${day.dayNumber}: activity "${activity.description}" is in ${activity.location} but you're currently in ${activityLocation}. Need travel activity to reach ${activity.location}`
          );
        }
        activityLocation = nextLocation;
      }
    }

    // Update current location for next day
    currentLocation = activityLocation;

    // Validate sleep location
    if (day.sleep) {
      const sleepLocation = normalizeCity(day.sleep.location);
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
        allActivityLocations.add(normalizeCity(activity.location));
      });
    });

    input.stops.forEach((stop) => {
      const stopNorm = normalizeCity(stop);
      const found = Array.from(allActivityLocations).some(
        (loc) =>
          loc.includes(stopNorm) ||
          stopNorm.includes(loc) ||
          loc === stopNorm
      );

      if (!found) {
        errors.push(`Required stop "${stop}" not included in itinerary`);
      }
    });
  }

  // 5. Check ends at departure location
  if (itinerary.days && itinerary.days.length > 0) {
    const lastDay = itinerary.days[itinerary.days.length - 1];
    if (lastDay.activities && lastDay.activities.length > 0) {
      const lastActivityLocation = normalizeCity(
        lastDay.activities[lastDay.activities.length - 1].location
      );
      const departureLower = normalizeCity(input.departure.location);

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
