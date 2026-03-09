/**
 * Trip context computation utility
 * Centralizes all trip-related calculations and derivations
 * Ensures deterministic, type-safe trip analysis
 */

import { NormalizedTripInput } from '../types/trip';
import { parseISODate, calculateNights } from './date';

export interface TripContext {
  // Parsed and validated dates
  arrivalDate: Date;
  departureDate: Date;

  // Date strings for reference
  arrivalDateStr: string; // YYYY-MM-DD
  departureDateStr: string; // YYYY-MM-DD

  // Duration calculations
  /**
   * Number of nights: The count of nights you'll sleep during the trip.
   * Example: arrive Mon, depart Wed = 2 nights (Mon night, Tue night)
   * Calculation: departureDate - arrivalDate in days
   */
  totalNights: number;

  /**
   * Number of calendar days: Inclusive count of all days from arrival to departure.
   * Example: arrive Mon, depart Wed = 3 calendar days (Mon, Tue, Wed)
   * Calculation: (departureDate - arrivalDate) + 1
   * Use this for: "Your 7-day trip"
   * Use totalNights for: "You'll stay 6 nights"
   */
  totalCalendarDays: number;

  /**
   * The last date you'll spend a night (arrival date + (totalNights - 1))
   * This is the night before departure.
   * Example: arrive Apr 7, depart Apr 10 = lastOvernightDate is Apr 9 (3rd night)
   */
  lastOvernightDate: Date;
  lastOvernightDateStr: string;

  // Locations
  arrivalLocation: string;
  departureLocation: string;
  sameArrivalDepartureLocation: boolean;

  // Trip categorization
  /**
   * Category based on total nights:
   * - 'short': 1-3 nights
   * - 'medium': 4-7 nights
   * - 'long': 8+ nights
   */
  tripLengthCategory: 'short' | 'medium' | 'long';

  // Additional metrics for prompt building
  isMultiCity: boolean; // whether stops are defined
  stopCount: number; // number of stops
}

/**
 * Compute comprehensive trip context from normalized input
 * @param input Normalized and validated TripInput
 * @returns TripContext with all computed values
 * @throws Error if date parsing fails (should not happen after validation)
 */
export function computeTripContext(input: NormalizedTripInput): TripContext {
  // Parse dates safely (validation already confirmed format, but be defensive)
  const arrivalDate = parseISODate(input.arrival.date);
  const departureDate = parseISODate(input.departure.date);

  // Validate ordering (should pass validation already, but defensive coding)
  if (departureDate <= arrivalDate) {
    throw new Error(
      `Invalid trip duration: departure (${input.departure.date}) must be after arrival (${input.arrival.date})`
    );
  }

  // Calculate nights and calendar days
  const totalNights = calculateNights(arrivalDate, departureDate);
  const totalCalendarDays = totalNights + 1;

  // Calculate last overnight date
  const lastOvernightDate = new Date(arrivalDate);
  lastOvernightDate.setDate(lastOvernightDate.getDate() + totalNights - 1);

  // Determine trip length category
  let tripLengthCategory: 'short' | 'medium' | 'long';
  if (totalNights <= 3) {
    tripLengthCategory = 'short';
  } else if (totalNights <= 7) {
    tripLengthCategory = 'medium';
  } else {
    tripLengthCategory = 'long';
  }

  // Normalize locations
  const arrivalLocation = input.arrival.location.trim();
  const departureLocation = input.departure.location.trim();
  const sameArrivalDepartureLocation =
    arrivalLocation.toLowerCase() === departureLocation.toLowerCase();

  // Multi-city analysis
  const stopCount = input.stops?.length ?? 0;
  const isMultiCity = stopCount > 0;

  // Format dates for reference
  const arrivalDateStr = input.arrival.date;
  const departureDateStr = input.departure.date;
  const lastOvernightDateStr = formatDateToISO(lastOvernightDate);

  return {
    arrivalDate,
    departureDate,
    arrivalDateStr,
    departureDateStr,
    totalNights,
    totalCalendarDays,
    lastOvernightDate,
    lastOvernightDateStr,
    arrivalLocation,
    departureLocation,
    sameArrivalDepartureLocation,
    tripLengthCategory,
    isMultiCity,
    stopCount,
  };
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to describe trip duration in human-readable form
 */
export function describeTripDuration(context: TripContext): string {
  const { totalNights, totalCalendarDays } = context;
  return `${totalCalendarDays}-day trip (${totalNights} nights)`;
}

/**
 * Helper to describe trip structure
 */
export function describeTripStructure(context: TripContext): string {
  const parts: string[] = [];

  parts.push(
    `${context.arrivalLocation} → ${context.departureLocation}`
  );

  if (context.isMultiCity) {
    parts.push(`with ${context.stopCount} stop${context.stopCount === 1 ? '' : 's'}`);
  }

  if (context.sameArrivalDepartureLocation) {
    parts.push('(circular route)');
  }

  return parts.join(' ');
}
