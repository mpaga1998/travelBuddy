/**
 * Thin wrapper around Vercel Web Analytics.
 *
 * Safe to call unconditionally — it no-ops when:
 *   - Running locally outside a Vercel deployment.
 *   - The @vercel/analytics SDK hasn't activated yet.
 *   - Any runtime error occurs inside the call (wrapped in try/catch).
 *
 * Do NOT capture PII as props (no user IDs, emails, content text, etc.).
 */
import { track as vercelTrack } from '@vercel/analytics';

export type AnalyticsEvent =
  | 'signup'
  | 'pin_created'
  | 'itinerary_generated'
  | 'itinerary_saved'
  | 'follow_added'
  | 'pin_reported';

export function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  try {
    vercelTrack(event, props ?? {});
  } catch {
    // Analytics failures must never surface to the user.
  }
}
