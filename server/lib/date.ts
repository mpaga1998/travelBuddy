/**
 * Parse ISO 8601 date string (YYYY-MM-DD) and return a Date object.
 * This avoids timezone issues by using explicit year/month/day parsing.
 */
export function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object as "Month Day(th), Year" (e.g., "April 7th, 2026")
 */
export function formatDateReadable(date: Date): string {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${monthNames[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
}

/**
 * Calculate the number of nights between two dates.
 * Example: Arriving April 7, departing April 9 = 2 nights (7-8 and 8-9)
 */
export function calculateNights(arrivalDate: Date, departureDate: Date): number {
  return Math.max(1, Math.round((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)));
}
