import type { VercelResponse } from '@vercel/node';
import { initSupabase } from './supabaseServer.js';

/**
 * Per-user sliding-window rate limiter backed by a Supabase table.
 *
 * Chosen over Upstash/Redis to avoid introducing a new vendor — we're already
 * deep in Supabase and an LLM-generation cap doesn't need sub-millisecond latency.
 *
 * Algorithm (sliding window, event-log style):
 *   1. Count rows for (user_id, bucket) with created_at >= now - windowMs.
 *   2. If count >= limit → reject, computing retryAfter from the oldest in-window row.
 *   3. Else → insert a new row and allow.
 *
 * Trade-offs:
 *   - Two concurrent requests can each see count=limit-1 and both insert, letting
 *     one extra through. Acceptable for a 10/hour cap on OpenAI calls; if you ever
 *     need strict limits, switch to a SECURITY DEFINER RPC that does count+insert
 *     in a single transaction, or move to Redis.
 *   - No background cleanup here. The index keeps reads fast; run a weekly cron
 *     (or pg_cron) to delete rows older than 24h — see SQL in the 1.6 runbook.
 *
 * Requires the `rate_limits` table — see migrations/20260421_add_rate_limits.sql.
 * Uses the service-role Supabase client, so it bypasses RLS (the table has none).
 */

export interface RateLimitResult {
  ok: boolean;
  /** How many requests the user has left in the current window (0 if rejected). */
  remaining: number;
  /** If rejected, seconds until the oldest in-window request falls off. */
  retryAfterSec?: number;
}

export interface RateLimitOptions {
  /** Logical key to separate limits for different endpoints (e.g. "itinerary"). */
  bucket: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Check and consume one request against the user's rate limit.
 *
 * Returns `{ ok: true }` and records the request on allow.
 * Returns `{ ok: false, retryAfterSec }` on deny — caller should 429.
 *
 * On DB failure this fails **open** (allows the request). For a cost-protection
 * limiter this is the right call: never lock a paying user out because Supabase
 * hiccuped. Fail-closed variants are better for abuse-prevention limiters.
 */
export async function checkRateLimit(
  userId: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { bucket, limit, windowMs } = options;
  const now = Date.now();
  const cutoffIso = new Date(now - windowMs).toISOString();

  try {
    const supabase = initSupabase();

    // 1) Count events in the current window.
    const { data: recent, error: selectErr } = await supabase
      .from('rate_limits')
      .select('created_at')
      .eq('user_id', userId)
      .eq('bucket', bucket)
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: true });

    if (selectErr) {
      console.warn('🚦 [RATE] Select failed, failing open:', selectErr.message);
      return { ok: true, remaining: limit };
    }

    const count = recent?.length ?? 0;

    if (count >= limit) {
      // Oldest row dictates when the window slides enough to free up a slot.
      const oldest = recent![0].created_at as string;
      const oldestMs = new Date(oldest).getTime();
      const retryAfterSec = Math.max(
        1,
        Math.ceil((oldestMs + windowMs - now) / 1000)
      );
      return { ok: false, remaining: 0, retryAfterSec };
    }

    // 2) Record this request. Don't await-fail the whole call if the insert
    //    errors — we already authorized it.
    const { error: insertErr } = await supabase
      .from('rate_limits')
      .insert({ user_id: userId, bucket });

    if (insertErr) {
      console.warn('🚦 [RATE] Insert failed (request still allowed):', insertErr.message);
    }

    return { ok: true, remaining: Math.max(0, limit - count - 1) };
  } catch (e) {
    console.warn('🚦 [RATE] Unexpected error, failing open:', e instanceof Error ? e.message : e);
    return { ok: true, remaining: limit };
  }
}

/**
 * Convenience wrapper: check the limit and, on reject, write a 429 with
 * Retry-After headers and return `false`. Same contract as `requireAuth` and
 * `validateBodySize` so handlers can compose them cleanly:
 *
 *   const user = await requireAuth(req, res);
 *   if (!user) return;
 *   if (!validateBodySize(req, res)) return;
 *   if (!(await enforceRateLimit(user.id, res, ITINERARY_LIMIT))) return;
 */
export async function enforceRateLimit(
  userId: string,
  res: VercelResponse,
  options: RateLimitOptions
): Promise<boolean> {
  const result = await checkRateLimit(userId, options);

  // Always expose remaining quota — useful for client-side UX even on allow.
  res.setHeader('X-RateLimit-Limit', String(options.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));

  if (!result.ok) {
    const retry = result.retryAfterSec ?? 60;
    res.setHeader('Retry-After', String(retry));
    console.warn(
      `🚦 [RATE] Denied user=${userId} bucket=${options.bucket} retryAfter=${retry}s`
    );
    res.status(429).json({
      success: false,
      error: `Rate limit exceeded. Try again in ${retry} seconds.`,
      retryAfterSec: retry,
    });
    return false;
  }

  return true;
}

/** Pre-built config for the itinerary-generation endpoint. */
export const ITINERARY_RATE_LIMIT: RateLimitOptions = {
  bucket: 'itinerary',
  limit: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
};
