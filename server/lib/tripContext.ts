import { TripInput } from './types/trip';
import { parseISODate } from './date';

/**
 * Categorizes trips by duration for different prompt strategies.
 */
export type TripLengthCategory = 'short' | 'medium' | 'long';

/**
 * Normalized trip context computed from TripInput.
 * All calculations are deterministic and based on parsed dates.
 */
export interface TripContext {
  // Parsed and validated dates
  arrivalDate: Date;
  departureDate: Date;

  // Duration calculations
  // NIGHTS: number of overnight stays (if arriving Apr 7, departing Apr 9 = 2 nights: 7→8, 8→9)
  // DAYS: calendar days including both arrival and departure (Apr 7, 8, 9 = 3 days)
  totalNights: number;
  totalCalendarDays: number;

  // The last night they spend at the destination (day before departure)
  // Example: if departing Apr 9, lastOvernightDate is Apr 8
  lastOvernightDate: Date;

  // Locations
  arrivalLocation: string;
  departureLocation: string;
  sameArrivalDepartureLocation: boolean;

  // Trip strategy category
  tripLengthCategory: TripLengthCategory;

  // Travel pace preference (relaxed, moderate, active)
  travelPace: 'relaxed' | 'moderate' | 'active';

  // Original input for reference
  sourceInput: TripInput;
}

/**
 * Determine trip length category based on number of nights.
 * - short: 1-3 nights (quick weekend getaway)
 * - medium: 4-7 nights (typical week-ish trip)
 * - long: 8+ nights (extended travel)
 */
function categorizeTrip(nights: number): TripLengthCategory {
  if (nights <= 3) return 'short';
  if (nights <= 7) return 'medium';
  return 'long';
}

/**
 * Add days to a Date object, returning a new Date.
 * Safe: works with JS Date arithmetic.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Compute the number of nights between two dates.
 * Nights = full overnight periods.
 * Example: Apr 7 → Apr 9 = 2 nights (7→8 and 8→9)
 */
function computeNights(arrival: Date, departure: Date): number {
  const millisPerDay = 1000 * 60 * 60 * 24;
  const diffMs = departure.getTime() - arrival.getTime();
  return Math.round(diffMs / millisPerDay);
}

/**
 * Compute the number of calendar days inclusive of both arrival and departure.
 * Example: Apr 7 → Apr 9 = 3 calendar days (7, 8, 9)
 */
function computeCalendarDays(arrival: Date, departure: Date): number {
  return computeNights(arrival, departure) + 1;
}

/**
 * Compute the last night the traveler spends at the destination.
 * If departing Apr 9, the last overnight is Apr 8 → Apr 9 (night of Apr 8).
 * This is departure date minus 1 day.
 */
function computeLastOvernightDate(departure: Date): Date {
  return addDays(departure, -1);
}

/**
 * Build a normalized TripContext from validated TripInput.
 * All calculations are deterministic and based on parsed dates.
 *
 * @param input - Validated and normalized TripInput
 * @returns TripContext with all trip math pre-calculated
 */
export function buildTripContext(input: TripInput): TripContext {
  const arrivalDate = parseISODate(input.arrival.date);
  const departureDate = parseISODate(input.departure.date);

  const totalNights = computeNights(arrivalDate, departureDate);
  const totalCalendarDays = computeCalendarDays(arrivalDate, departureDate);
  const lastOvernightDate = computeLastOvernightDate(departureDate);

  const sameArrivalDepartureLocation =
    input.arrival.location.toLowerCase() === input.departure.location.toLowerCase();

  return {
    arrivalDate,
    departureDate,
    totalNights,
    totalCalendarDays,
    lastOvernightDate,
    arrivalLocation: input.arrival.location,
    departureLocation: input.departure.location,
    sameArrivalDepartureLocation,
    tripLengthCategory: categorizeTrip(totalNights),
    travelPace: input.travelPace || 'moderate',
    sourceInput: input,
  };
}
