-- Phase 4.1: pin reports table + denormalized report_count on pins.
--
-- Run manually in the Supabase SQL editor — this file is NOT applied
-- automatically.

-- ── 1. profiles: is_admin column (gates the admin SELECT policy below) ────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ── 2. pins: denormalized report count for cheap client-side filtering ────

ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

-- ── 3. pin_reports table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pin_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id       uuid        NOT NULL REFERENCES pins(id)       ON DELETE CASCADE,
  reporter_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- one report per user per pin
  CONSTRAINT pin_reports_one_per_user UNIQUE (pin_id, reporter_id)
);

-- ── 4. Index for fast aggregation and join lookups on pin_id ──────────────

CREATE INDEX IF NOT EXISTS pin_reports_pin_id_idx ON pin_reports (pin_id);

-- ── 5. Trigger functions to maintain pins.report_count ───────────────────
--
-- SECURITY DEFINER so the UPDATE on pins.report_count always succeeds
-- regardless of the inserting user's RLS permissions on the pins table.
-- SET search_path pins the function to the public schema to avoid
-- search-path injection attacks.

CREATE OR REPLACE FUNCTION fn_increment_report_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE pins SET report_count = report_count + 1 WHERE id = NEW.pin_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_decrement_report_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE pins SET report_count = GREATEST(report_count - 1, 0) WHERE id = OLD.pin_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pin_reports_insert ON pin_reports;
CREATE TRIGGER trg_pin_reports_insert
  AFTER INSERT ON pin_reports
  FOR EACH ROW EXECUTE FUNCTION fn_increment_report_count();

DROP TRIGGER IF EXISTS trg_pin_reports_delete ON pin_reports;
CREATE TRIGGER trg_pin_reports_delete
  AFTER DELETE ON pin_reports
  FOR EACH ROW EXECUTE FUNCTION fn_decrement_report_count();

-- ── 6. RLS on pin_reports ─────────────────────────────────────────────────

ALTER TABLE pin_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users may insert only their own reports.
CREATE POLICY "pin_reports_insert_own"
  ON pin_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- A user may read their own reports.
-- Admins (profiles.is_admin = true) may read all reports.
-- EXISTS avoids an error if the calling user has no profile row yet.
CREATE POLICY "pin_reports_select_own_or_admin"
  ON pin_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );
