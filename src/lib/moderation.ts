import { supabase } from './supabaseClient';

/**
 * 4.4: Client-side bridge to /api/moderate.
 *
 * Pre-flights user-supplied text against OpenAI moderation before the client
 * inserts a pin into Supabase (since pins are inserted directly from the
 * browser, not through a serverless route). Itinerary generation moderates
 * inline on the server — see api/itinerary.ts.
 *
 * Fails OPEN on any client-side error (no session, network down, server 5xx)
 * to match the server-side fail-open policy in api/lib/moderation.ts. The
 * thinking: a third-party hiccup should never block a real user from
 * creating content. Genuine bad content is rare; outage minutes are common.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/** User-facing message when content is rejected. Mirrors the server constant. */
export const MODERATION_REJECTION_MESSAGE =
  'Your input contains content that violates our community guidelines. Please revise and try again.';

/**
 * Returns true if the text is allowed (not flagged), false if rejected.
 * Empty / whitespace input is always allowed (no network call).
 *
 * Callers should toast the user with `MODERATION_REJECTION_MESSAGE` when
 * this returns false and abort the create flow.
 */
export async function checkContentAllowed(text: string): Promise<boolean> {
  if (!text?.trim()) return true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      // No session → server would 401. Treat as allowed; the actual
      // create call will surface a clearer "not signed in" error.
      console.warn('[moderation] No session; skipping check (fail open)');
      return true;
    }

    const res = await fetch(`${API_BASE}/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.warn('[moderation] Server returned', res.status, '— failing open');
      return true;
    }

    const data = (await res.json()) as { flagged?: boolean };
    return !data.flagged;
  } catch (err) {
    console.warn('[moderation] Client error (failing open):', err);
    return true;
  }
}
