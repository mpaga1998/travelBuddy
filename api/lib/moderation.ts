/**
 * 4.4: Content moderation against OpenAI's free moderation endpoint.
 *
 * Runs user-supplied free text (pin title/description, itinerary notes,
 * desiredAttractions) through `omni-moderation-latest` before any expensive
 * downstream work. Catches obvious harassment, hate, sexual, self-harm, and
 * violence-against-people content before it lands in Supabase or burns
 * gpt-4o-mini tokens.
 *
 * Design choices:
 *   - Fails OPEN. Any error — network blip, OpenAI outage, missing API key,
 *     malformed response — is logged and returns `{ flagged: false }`. We
 *     don't want a third-party hiccup to block pin creation for a real user.
 *     Same rationale as api/lib/rateLimit.ts which fails open on DB error.
 *   - No retry. Moderation latency stacks onto user-perceived latency. One
 *     shot, fail open if it hangs.
 *   - Empty / whitespace input short-circuits with no API call.
 *   - Returned categories are for server-side logging + future admin
 *     tooling. The user-facing rejection message is deliberately generic so
 *     we don't enumerate ban-evasion paths.
 */

import OpenAI from 'openai';

// Module-level lazy singleton mirrors api/lib/openai.ts. Two clients in the
// same Node process is fine — the SDK is just an HTTP wrapper, no shared
// state matters and the cost is negligible.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ModerationResult {
  flagged: boolean;
  /** Names of categories that came back true. Empty when flagged === false. */
  categories?: string[];
}

/** User-facing message returned when content is rejected. */
export const MODERATION_REJECTION_MESSAGE =
  'Your input contains content that violates our community guidelines. Please revise and try again.';

/**
 * Run text through OpenAI moderation. Returns { flagged, categories }.
 * Whitespace-only input short-circuits to not-flagged with no network call.
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const trimmed = text?.trim();
  if (!trimmed) return { flagged: false };

  // No key configured → fail open and warn loudly so it surfaces in logs.
  if (!process.env.OPENAI_API_KEY) {
    console.warn('🛡️ [MODERATION] OPENAI_API_KEY not set; skipping moderation (fail open)');
    return { flagged: false };
  }

  try {
    const result = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: trimmed,
    });

    const first = result.results?.[0];
    if (!first) {
      console.warn('🛡️ [MODERATION] Empty results array; failing open');
      return { flagged: false };
    }

    if (!first.flagged) return { flagged: false };

    // Collect names of every category that came back true.
    const categories = Object.entries(first.categories ?? {})
      .filter(([, on]) => Boolean(on))
      .map(([name]) => name);

    console.warn(
      '🛡️ [MODERATION] Content flagged:',
      categories.join(', ') || '(no categories)'
    );
    return { flagged: true, categories };
  } catch (err) {
    // Network error, rate limit, parse failure — fail open.
    console.warn(
      '🛡️ [MODERATION] Endpoint failed (failing open):',
      err instanceof Error ? err.message : err
    );
    return { flagged: false };
  }
}
