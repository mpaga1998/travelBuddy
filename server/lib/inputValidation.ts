/**
 * Input validation for trip planning requests
 */

import { TripInput } from '../services/openaiService';

export interface ValidationError {
  field: string;
  message: string;
}

export function calculateNights(input: TripInput): number {
  const arrival = new Date(input.arrival.date);
  const departure = new Date(input.departure.date);
  return Math.ceil(
    (departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function validateTripInput(input: TripInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!input.arrival) {
    errors.push({ field: 'arrival', message: 'Required' });
    return errors;
  }

  if (!input.departure) {
    errors.push({ field: 'departure', message: 'Required' });
    return errors;
  }

  // Date validation
  let arrival: Date;
  let departure: Date;

  try {
    arrival = new Date(input.arrival.date);
    departure = new Date(input.departure.date);

    if (isNaN(arrival.getTime())) {
      errors.push({
        field: 'arrival.date',
        message: 'Invalid date format (use YYYY-MM-DD)',
      });
    }

    if (isNaN(departure.getTime())) {
      errors.push({
        field: 'departure.date',
        message: 'Invalid date format (use YYYY-MM-DD)',
      });
    }

    if (errors.length === 0) {
      const nights = calculateNights(input);

      if (nights < 1) {
        errors.push({
          field: 'dates',
          message: 'Departure must be after arrival',
        });
      }

      if (nights > 365) {
        errors.push({
          field: 'dates',
          message: 'Trip too long (max 365 days)',
        });
      }
    }
  } catch (e) {
    errors.push({
      field: 'dates',
      message: 'Error parsing dates',
    });
    return errors;
  }

  // Location validation
  if (!input.arrival.location?.trim()) {
    errors.push({
      field: 'arrival.location',
      message: 'Arrival location required',
    });
  }

  if (!input.departure.location?.trim()) {
    errors.push({
      field: 'departure.location',
      message: 'Departure location required',
    });
  }

  // Attractions validation
  if (
    !input.desiredAttractions ||
    input.desiredAttractions.length === 0
  ) {
    errors.push({
      field: 'desiredAttractions',
      message: 'At least one desired attraction is required',
    });
  }

  // Optional: validate pace
  if (
    input.travelPace &&
    !['relaxed', 'moderate', 'active'].includes(input.travelPace)
  ) {
    errors.push({
      field: 'travelPace',
      message: 'Must be one of: relaxed, moderate, active',
    });
  }

  // Optional: validate budget
  if (
    input.budget &&
    !['budget', 'mid-range', 'luxury'].includes(input.budget)
  ) {
    errors.push({
      field: 'budget',
      message: 'Must be one of: budget, mid-range, luxury',
    });
  }

  return errors;
}
