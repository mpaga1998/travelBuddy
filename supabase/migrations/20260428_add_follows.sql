-- Phase 5.2: follow system.
--
-- Adds:
--   - follows table (follower_id, followee_id, created_at) with a self-follow
--     CHECK and a unique constraint on the pair.
--   - profiles.followers_count + profiles.following_count, maintained by
--     SECURITY DEFINER triggers on AFTER INSERT/DELETE so reads are O(1).
--   - RLS: SELECT open (the relationship graph is public, like Twitter/X),
--     INSERT/DELETE constrained to follower_id = auth.uid().
--
-- Run manually in the Supabase SQL editor.

-- ── 1. profiles: cached counts ────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS followers_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

-- ── 2. follows table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follows (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- one follow row per (follower → followee) pair
  CONSTRAINT follows_one_per_pair UNIQUE (follower_id, followee_id),

  -- can't follow yourself
  CONSTRAINT follows_no_self CHECK (follower_id <> followee_id)
);

-- ── 3. Indexes for fast lookups in both directions ───────────────────────

CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_followee_id_idx ON follows (followee_id);

-- ── 4. Triggers to maintain cached counts ─────────────────────────────────
--
-- SECURITY DEFINER + SET search_path = public so the UPDATE on profiles
-- always succeeds regardless of the inserting user's RLS permissions on
-- the profiles table. Mirror the pattern used by the pin_reports triggers
-- in 20260426_add_pin_reports.sql.

CREATE OR REPLACE FUNCTION fn_increment_follow_counts()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.followee_id;
  UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_decrement_follow_counts()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.followee_id;
  UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_follows_insert ON follows;
CREATE TRIGGER trg_follows_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION fn_increment_follow_counts();

DROP TRIGGER IF EXISTS trg_follows_delete ON follows;
CREATE TRIGGER trg_follows_delete
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION fn_decrement_follow_counts();

-- ── 5. RLS on follows ─────────────────────────────────────────────────────

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- The relationship graph is intentionally public — clients need to read it
-- to render "Following" / "Follows you" badges, and follower lists at /u/:handle
-- (planned for later phases). Counts are denormalized to profiles, so most
-- reads will hit profiles directly; this policy covers "is X following Y"
-- queries from the follow button.
DROP POLICY IF EXISTS "follows_select_all" ON follows;
CREATE POLICY "follows_select_all"
  ON follows
  FOR SELECT
  USING (true);

-- Authenticated users may only insert follows where follower_id = auth.uid().
-- The CHECK constraint on the table prevents self-follows independently.
DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own"
  ON follows
  FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

-- Users may only delete their own follow rows (i.e. unfollow).
DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own"
  ON follows
  FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());
