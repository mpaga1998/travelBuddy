/**
 * Date formatting and calculation utilities
 */

/**
 * Format a Date object as "Month Day(th), Year"
 * Example: "April 7th, 2024" or "December 25th, 2024"
 */
export function formatDate(date: Date): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const day = date.getDate();
  const suffix = getSuffix(day);

  return `${monthNames[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
}

/**
 * Get ordinal suffix for a day (st, nd, rd, th)
 */
function getSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

/**
 * Parse ISO date string (YYYY-MM-DD) into Date object
 */
export function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate number of nights between two dates
 * Example: April 7 to April 9 = 2 nights
 */
export function calculateNights(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Determine if trip is "long" (>5 days) for different prompt styles
 */
export function isLongTrip(nights: number): boolean {
  return nights > 5;
}
