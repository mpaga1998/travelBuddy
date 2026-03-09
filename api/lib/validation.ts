/**
 * Input validation and normalization for trip planning requests
 */

import {
  TripInput,
  NormalizedTripInput,
  ValidationError,
  ValidationResult,
} from '../types/trip';
import { parseISODate } from './date';

/**
 * Validate and normalize TripInput
 * Returns either valid normalized data or array of validation errors
 */
export function validateAndNormalizeTripInput(
  input: unknown
): ValidationResult {
  const errors: ValidationError[] = [];

  // Basic type check
  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'root',
          message: 'Request body must be a JSON object',
        },
      ],
    };
  }

  const data = input as Record<string, unknown>;

  // Validate and collect errors
  validateDates(data, errors);
  validateLocations(data, errors);
  validateAttractions(data, errors);
  validateOptionalStrings(data, errors);
  validateOptionalArrays(data, errors);
  validateEnums(data, errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Normalize and return
  const normalized = normalizeInput(data as TripInput);
  return { valid: true, data: normalized };
}

/**
 * Validate arrival and departure dates
 */
function validateDates(data: Record<string, unknown>, errors: ValidationError[]): void {
  const arrival = data.arrival as any;
  const departure = data.departure as any;

  // Check dates exist
  if (!arrival?.date) {
    errors.push({
      field: 'arrival.date',
      message: 'Arrival date is required (format: YYYY-MM-DD)',
    });
  } else if (!isValidISODate(arrival.date)) {
    errors.push({
      field: 'arrival.date',
      message: `Invalid date format "${arrival.date}". Expected YYYY-MM-DD (e.g., 2024-04-07)`,
    });
  }

  if (!departure?.date) {
    errors.push({
      field: 'departure.date',
      message: 'Departure date is required (format: YYYY-MM-DD)',
    });
  } else if (!isValidISODate(departure.date)) {
    errors.push({
      field: 'departure.date',
      message: `Invalid date format "${departure.date}". Expected YYYY-MM-DD (e.g., 2024-04-09)`,
    });
  }

  // Check departure is after arrival (only if both are valid)
  if (isValidISODate(arrival?.date) && isValidISODate(departure?.date)) {
    const arrivalDate = parseISODate(arrival.date);
    const departureDate = parseISODate(departure.date);

    if (departureDate <= arrivalDate) {
      errors.push({
        field: 'departure.date',
        message: `Departure date must be after arrival date (arrival: ${arrival.date}, departure: ${departure.date})`,
      });
    }
  }
}

/**
 * Validate locations are non-empty strings
 */
function validateLocations(data: Record<string, unknown>, errors: ValidationError[]): void {
  const arrival = data.arrival as any;
  const departure = data.departure as any;

  if (!arrival?.location || typeof arrival.location !== 'string' || !arrival.location.trim()) {
    errors.push({
      field: 'arrival.location',
      message: 'Arrival location is required and must be a non-empty string',
    });
  }

  if (!departure?.location || typeof departure.location !== 'string' || !departure.location.trim()) {
    errors.push({
      field: 'departure.location',
      message: 'Departure location is required and must be a non-empty string',
    });
  }
}

/**
 * Validate desiredAttractions is an array
 */
function validateAttractions(data: Record<string, unknown>, errors: ValidationError[]): void {
  if (data.desiredAttractions !== undefined) {
    if (!Array.isArray(data.desiredAttractions)) {
      errors.push({
        field: 'desiredAttractions',
        message: 'desiredAttractions must be an array of strings',
      });
    } else if (!data.desiredAttractions.every((item) => typeof item === 'string')) {
      errors.push({
        field: 'desiredAttractions',
        message: 'desiredAttractions must contain only strings',
      });
    }
  } else {
    // desiredAttractions is required but can be empty
    errors.push({
      field: 'desiredAttractions',
      message: 'desiredAttractions is required (can be an empty array)',
    });
  }
}

/**
 * Validate optional string fields: notes, userFirstName, userId
 */
function validateOptionalStrings(
  data: Record<string, unknown>,
  errors: ValidationError[]
): void {
  const stringFields = ['notes', 'userFirstName', 'userId'] as const;

  for (const field of stringFields) {
    if (data[field] !== undefined && typeof data[field] !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string if provided`,
      });
    }
  }
}

/**
 * Validate optional array fields: stops, interests
 */
function validateOptionalArrays(
  data: Record<string, unknown>,
  errors: ValidationError[]
): void {
  const arrayFields = ['stops', 'interests'] as const;

  for (const field of arrayFields) {
    if (data[field] !== undefined) {
      if (!Array.isArray(data[field])) {
        errors.push({
          field,
          message: `${field} must be an array if provided`,
        });
      } else if (!data[field]!.every((item) => typeof item === 'string')) {
        errors.push({
          field,
          message: `${field} must contain only strings`,
        });
      }
    }
  }
}

/**
 * Validate enum fields: travelPace, budget
 */
function validateEnums(data: Record<string, unknown>, errors: ValidationError[]): void {
  const validPaces = ['relaxed', 'moderate', 'active'];
  const validBudgets = ['budget', 'mid-range', 'luxury'];

  if (data.travelPace !== undefined && !validPaces.includes(data.travelPace as string)) {
    errors.push({
      field: 'travelPace',
      message: `travelPace must be one of: ${validPaces.join(', ')} (got: "${data.travelPace}")`,
    });
  }

  if (data.budget !== undefined && !validBudgets.includes(data.budget as string)) {
    errors.push({
      field: 'budget',
      message: `budget must be one of: ${validBudgets.join(', ')} (got: "${data.budget}")`,
    });
  }
}

/**
 * Check if a string is a valid ISO date (YYYY-MM-DD)
 */
function isValidISODate(dateString: unknown): dateString is string {
  if (typeof dateString !== 'string') return false;

  // Check format YYYY-MM-DD
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(dateString)) return false;

  // Check if it parses to a valid date
  try {
    const date = parseISODate(dateString);
    // Check if the parsed date matches the input (catches invalid dates like 2024-02-30)
    const reconstructed = dateString.split('-').map(Number);
    return (
      date.getFullYear() === reconstructed[0] &&
      date.getMonth() === reconstructed[1] - 1 &&
      date.getDate() === reconstructed[2]
    );
  } catch {
    return false;
  }
}

/**
 * Normalize input: trim strings, clean arrays, apply defaults
 */
function normalizeInput(input: TripInput): NormalizedTripInput {
  return {
    userId: input.userId?.trim() || undefined,
    userFirstName: input.userFirstName?.trim() || undefined,
    arrival: {
      date: input.arrival.date,
      location: input.arrival.location.trim(),
    },
    departure: {
      date: input.departure.date,
      location: input.departure.location.trim(),
    },
    stops: input.stops?.map((s) => s.trim()).filter((s) => s.length > 0),
    desiredAttractions: input.desiredAttractions
      .map((a) => a.trim())
      .filter((a) => a.length > 0),
    travelPace: input.travelPace || 'moderate',
    interests: input.interests
      ?.map((i) => i.trim())
      .filter((i) => i.length > 0),
    budget: input.budget,
    notes: input.notes?.trim() || undefined,
  };
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  const message = errors.map((e) => `• ${e.field}: ${e.message}`).join('\n');
  return `Validation failed:\n${message}`;
}
