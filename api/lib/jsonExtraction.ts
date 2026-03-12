/**
 * JSON extraction from LLM responses and structured itinerary validation
 */

import { StructuredItinerary } from './itinerarySchema.js';
import { TripInput } from './types.js';
import { calculateNights } from './inputValidation.js';

export class ExtractionError extends Error {
  constructor(
    message: string,
    public rawResponse: string
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[],
    public warnings: string[],
    public itinerary?: StructuredItinerary
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Extract JSON from LLM response (handles markdown code blocks)
 */
export function extractJSON(text: string): StructuredItinerary {
  // First try: JSON in markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      return parsed as StructuredItinerary;
    } catch (e) {
      throw new ExtractionError(
        `Failed to parse JSON from code block: ${(e as Error).message}`,
        text
      );
    }
  }

  // Second try: raw JSON
  try {
    const parsed = JSON.parse(text.trim());
    return parsed as StructuredItinerary;
  } catch (e) {
    throw new ExtractionError(
      `Response is not valid JSON: ${(e as Error).message}`,
      text
    );
  }
}

/**
 * Validate structurally extracted itinerary against constraints
 */
export function validateStructuredItinerary(
  itinerary: StructuredItinerary,
  input: TripInput
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const expectedNights = calculateNights(input);

  // 1. Night count check
  if (itinerary.constraints.nightsAllocated !== expectedNights) {
    errors.push(
      `Night count mismatch: itinerary allocates ${itinerary.constraints.nightsAllocated} nights, but ${expectedNights} are available`
    );
  }

  // 1b. User-requested stops validation
  if (input.stops && input.stops.length > 0) {
    const generatedLocations = itinerary.stops.map(s => s.location.toLowerCase().trim());
    const requestedStops = input.stops.map(s => s.toLowerCase().trim());
    
    for (const requestedStop of requestedStops) {
      const found = generatedLocations.some(loc => loc.includes(requestedStop) || requestedStop.includes(loc));
      if (!found) {
        errors.push(
          `Missing requested stop: "${input.stops[requestedStops.indexOf(requestedStop)]}" was not included in the itinerary`
        );
      }
    }
  }

  // 2. Feasibility flag consistency
  if (!itinerary.feasible && !itinerary.feasibilityNotes) {
    warnings.push(
      'Itinerary marked as infeasible but no explanation provided'
    );
  }

  if (itinerary.feasible && !itinerary.stops.length) {
    errors.push('Feasible itinerary must have at least one stop');
  }

  // 3. Stop-level validation
  itinerary.stops.forEach((stop, idx) => {
    const stopNum = idx + 1;

    if (!stop.location?.trim()) {
      errors.push(`Stop ${stopNum}: missing location name`);
    }

    if (stop.totalNights < 1) {
      errors.push(
        `Stop "${stop.location}": must have at least 1 night, got ${stop.totalNights}`
      );
    }

    if (stop.days.length === 0) {
      errors.push(
        `Stop "${stop.location}": must have at least 1 day defined`
      );
    }

    // Validate day structure
    stop.days.forEach((day, dayIdx) => {
      if (day.dayNumber < 1) {
        errors.push(
          `Stop "${stop.location}", Day ${dayIdx + 1}: dayNumber must be >= 1`
        );
      }

      if (!day.location) {
        errors.push(
          `Stop "${stop.location}", Day ${day.dayNumber}: missing location`
        );
      }

      if (day.activities.length === 0) {
        errors.push(
          `Stop "${stop.location}", Day ${day.dayNumber}: must have at least 1 activity`
        );
      }

      // Validate activities
      day.activities.forEach((activity, actIdx) => {
        if (!['morning', 'afternoon', 'evening'].includes(activity.time)) {
          errors.push(
            `Stop "${stop.location}", Day ${day.dayNumber}, Activity ${actIdx + 1}: invalid time "${activity.time}"`
          );
        }

        if (!activity.description?.trim()) {
          errors.push(
            `Stop "${stop.location}", Day ${day.dayNumber}, Activity ${actIdx + 1}: missing description`
          );
        }

        if (!activity.durationEstimate?.trim()) {
          warnings.push(
            `Stop "${stop.location}", Day ${day.dayNumber}: activity missing duration estimate`
          );
        }
      });
    });
  });

  // 4. Constraint validation
  if (itinerary.constraints.startDate !== input.arrival.date) {
    errors.push(
      `Start date mismatch: expected ${input.arrival.date}, got ${itinerary.constraints.startDate}`
    );
  }

  if (itinerary.constraints.endDate !== input.departure.date) {
    errors.push(
      `End date mismatch: expected ${input.departure.date}, got ${itinerary.constraints.endDate}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
