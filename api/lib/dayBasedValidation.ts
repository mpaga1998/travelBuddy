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
 * Normalize city name for comparison
 */
function normalizeCity(city: string): string {
  return city.toLowerCase().trim();
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
    const morningActivities = firstDay.activities?.filter(a => a.time === 'morning' && !a.isTravel) || [];
    const afternoonActivities = firstDay.activities?.filter(a => a.time === 'afternoon') || [];
    
    if (input.arrival.time === 'afternoon' && morningActivities.length > 0) {
      errors.push(
        `Day 1 violation: User arrives in afternoon but has ${morningActivities.length} morning activities. REMOVE all morning activities.`
      );
    }
    
    if (input.arrival.time === 'night') {
      // For night arrival, allow only check-in/arrival activities, reject sightseeing
      const sightseeingActivities = firstDay.activities?.filter(a => 
        !a.isTravel && 
        !a.description?.toLowerCase().includes('arrive') && 
        !a.description?.toLowerCase().includes('rest') && 
        !a.description?.toLowerCase().includes('accommodation') && 
        !a.description?.toLowerCase().includes('check')
      ) || [];
      
      if (sightseeingActivities.length > 0) {
        errors.push(
          `Day 1 violation: User arrives at night but has ${sightseeingActivities.length} sightseeing activities (${sightseeingActivities.map(a => `"${a.description?.substring(0, 30)}..."`).join(', ')}). Day 1 should ONLY have arrival/check-in, no tourist activities. Move all sightseeing to Day 2.`
        );
      }
    }
  }

  if (lastDay && input.departure.time) {
    const afternoonActivities = lastDay.activities?.filter(a => a.time === 'afternoon') || [];
    const eveningActivities = lastDay.activities?.filter(a => a.time === 'evening') || [];
    
    // Debug logging
    if (input.departure.time === 'afternoon' || input.departure.time === 'morning') {
      console.log(`⏰ Final day validation: departure="${input.departure.time}", lastDay activities:`, {
        afternoon: afternoonActivities.length,
        evening: eveningActivities.length,
      });
    }
    
    if (input.departure.time === 'morning') {
      if (afternoonActivities.length > 0 || eveningActivities.length > 0) {
        errors.push(
          `Final day violation: User departs in morning but has ${afternoonActivities.length + eveningActivities.length} afternoon/evening activities. REMOVE all afternoon/evening activities.`
        );
      }
    }
    
    if (input.departure.time === 'afternoon' && eveningActivities.length > 0) {
      errors.push(
        `Final day violation: User departs in afternoon but has ${eveningActivities.length} evening activities (${eveningActivities.map(a => `"${a.description?.substring(0, 30)}..."`).join(', ')}). REMOVE all evening activities. User must depart by afternoon.`
      );
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
