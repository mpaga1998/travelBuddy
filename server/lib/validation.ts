import { TripInput } from './types/trip';

export function validateTripInput(input: TripInput): { valid: boolean; error?: string } {
  if (!input.arrival?.date || !input.departure?.date) {
    return {
      valid: false,
      error: 'Arrival and departure dates are required',
    };
  }

  if (!input.arrival.location || !input.departure.location) {
    return {
      valid: false,
      error: 'Arrival and departure locations are required',
    };
  }

  if (!Array.isArray(input.desiredAttractions)) {
    return {
      valid: false,
      error: 'desiredAttractions must be an array',
    };
  }

  return { valid: true };
}
