-- Per-user rate-limit event log.
--
-- Used by api/lib/rateLimit.ts to enforce a sliding-window cap (default:
-- 10 itineraries/user/hour) on expensive endpoints like /api/itinerary.
--
-- Each allowed request inserts one row. The limiter counts rows in the
-- window on the next request and rejects if count >= limit.
--
-- Access model: RLS is enabled with NO policies. That means anon and
-- authenticated clients can't touch this table — only the service_role
-- key (used by api/lib/supabaseServer.ts) can read/write it. That's the
-- intended design: rate-limit state should never be client-readable.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: every lookup is (user_id, bucket, created_at >= cutoff).
-- DESC on created_at keeps the index aligned with the limiter's ORDER BY.
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_bucket_time
  ON public.rate_limits (user_id, bucket, created_at DESC);

-- Lock down to service_role only.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated. service_role bypasses RLS.

-- Cleanup strategy: rows older than 24h serve no purpose (longest window we
-- plan to use is 1h). Run this weekly via pg_cron or a Supabase scheduled
-- function. Safe to run ad-hoc too.
--
--   DELETE FROM public.rate_limits WHERE created_at < NOW() - INTERVAL '24 hours';
