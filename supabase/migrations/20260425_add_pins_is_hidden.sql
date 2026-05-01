-- Phase 4.3: auto-hide pins that accumulate enough reports.
--
-- Run manually in the Supabase SQL editor.

-- ── 1. Add is_hidden column to pins ──────────────────────────────────────

ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- ── 2. Trigger function: auto-hide when report_count crosses threshold ───
--
-- SECURITY DEFINER + SET search_path = public: runs as db owner so the
-- UPDATE on pins always succeeds regardless of the calling user's RLS.
--
-- Threshold is a local constant — change the single value here to tune it.
--
-- We intentionally do NOT un-hide when reports are deleted. Restoring a
-- hidden pin is an admin decision (Phase 4.5).

CREATE OR REPLACE FUNCTION fn_auto_hide_pin_on_reports()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_threshold CONSTANT integer := 3;
BEGIN
  UPDATE pins
  SET is_hidden = true
  WHERE id = NEW.pin_id
    AND report_count >= v_threshold
    AND is_hidden = false;   -- skip the write if already hidden (no-op guard)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_hide_pin ON pin_reports;
CREATE TRIGGER trg_auto_hide_pin
  AFTER INSERT ON pin_reports
  FOR EACH ROW EXECUTE FUNCTION fn_auto_hide_pin_on_reports();

-- ── 3. Index to make the is_hidden filter cheap on the pins table ─────────

CREATE INDEX IF NOT EXISTS pins_is_hidden_idx ON pins (is_hidden)
  WHERE is_hidden = false;   -- partial index — only the visible-pin fast path matters
