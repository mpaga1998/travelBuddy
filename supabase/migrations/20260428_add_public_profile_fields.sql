-- Phase 5.1: public profile pages.
--
-- Adds:
--   - profiles.handle  — unique URL slug, used in /u/:handle. Nullable so
--     existing accounts don't break; users pick one when they edit profile.
--   - profiles.bio     — short blurb, capped at 280 chars (Twitter-shaped).
--   - itineraries.is_public — opt-in sharing flag. Default false so saved
--     itineraries stay private by default. Public profiles only show
--     itineraries that the owner has flipped to public.
--
-- Run manually in the Supabase SQL editor.

-- ── 1. profiles.handle ────────────────────────────────────────────────────
-- Format: 3–30 chars, lowercase letters / digits / underscore / hyphen.
-- Reserved handles (admin, api, settings, etc.) are enforced in the app
-- (src/features/profile/handleValidation.ts), not here, so we can update
-- the reserved list without a migration.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS handle text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_handle_format_chk'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_handle_format_chk
      CHECK (handle IS NULL OR handle ~ '^[a-z0-9_-]{3,30}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique_idx
  ON profiles (handle)
  WHERE handle IS NOT NULL;

-- ── 2. profiles.bio ───────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bio_length_chk'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_bio_length_chk
      CHECK (bio IS NULL OR char_length(bio) <= 280);
  END IF;
END $$;

-- ── 3. itineraries.is_public ──────────────────────────────────────────────

ALTER TABLE itineraries
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS itineraries_is_public_idx
  ON itineraries (is_public)
  WHERE is_public = true;

-- ── 4. RLS update on itineraries ──────────────────────────────────────────
--
-- Replace the "Users can view own itineraries" policy so SELECT also
-- succeeds when is_public = true. Owners still see their private ones via
-- the user_id = auth.uid() branch. Public visitors (anon + other users)
-- only see is_public = true rows.

DROP POLICY IF EXISTS "Users can view own itineraries" ON itineraries;

CREATE POLICY "itineraries_select_own_or_public"
  ON itineraries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_public = true
  );

-- The INSERT and DELETE policies from 20260401_add_itineraries.sql remain
-- intact — only SELECT widened.
