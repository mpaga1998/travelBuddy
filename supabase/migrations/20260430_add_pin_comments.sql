-- Phase 5.5: pin comments.
--
-- Adds:
--   - pin_comments table (pin_id, user_id, body, created_at, updated_at)
--     with a body length CHECK (1–1000 chars).
--   - pins.comment_count cached column maintained by AFTER INSERT/DELETE
--     triggers (same shape as pin_reports / follows counters).
--   - 'comment' kind added to notifications + a trigger that fires on
--     pin_comments INSERT to notify the pin's author. Unlike like/bookmark,
--     comment notifications are NOT deduped — each comment is a distinct
--     event, even from the same user.
--   - RLS: SELECT open (comments on a public pin are public), INSERT/UPDATE/
--     DELETE limited to user_id = auth.uid().
--
-- Run manually in the Supabase SQL editor.

-- ── 1. pin_comments table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pin_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id      uuid        NOT NULL REFERENCES pins(id)     ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pin_comments_body_length CHECK (char_length(body) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS pin_comments_pin_id_idx
  ON pin_comments (pin_id, created_at);
CREATE INDEX IF NOT EXISTS pin_comments_user_id_idx
  ON pin_comments (user_id);

-- ── 2. pins.comment_count + triggers ──────────────────────────────────────

ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION fn_increment_comment_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE pins SET comment_count = comment_count + 1 WHERE id = NEW.pin_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_decrement_comment_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE pins SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.pin_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pin_comments_insert ON pin_comments;
CREATE TRIGGER trg_pin_comments_insert
  AFTER INSERT ON pin_comments
  FOR EACH ROW EXECUTE FUNCTION fn_increment_comment_count();

DROP TRIGGER IF EXISTS trg_pin_comments_delete ON pin_comments;
CREATE TRIGGER trg_pin_comments_delete
  AFTER DELETE ON pin_comments
  FOR EACH ROW EXECUTE FUNCTION fn_decrement_comment_count();

-- ── 3. Extend notifications.kind to include 'comment' ─────────────────────
--
-- The 5.4 migration created the kind CHECK with three values; we drop and
-- recreate it so 'comment' is allowed. Same for the pin_id shape check —
-- comment notifications carry a pin_id like like/bookmark.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_kind_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('like', 'bookmark', 'follow', 'comment'));

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_pin_id_shape;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_pin_id_shape
  CHECK (
    (kind IN ('like', 'bookmark', 'comment') AND pin_id IS NOT NULL)
    OR (kind = 'follow' AND pin_id IS NULL)
  );

-- ── 4. Trigger: comment notifications ─────────────────────────────────────
--
-- Fires on every pin_comments INSERT. Skips self-comments. Does NOT dedupe:
-- if user A leaves three comments on B's pin, B gets three notifications.
-- Each comment is a distinct event the author should be aware of.

CREATE OR REPLACE FUNCTION fn_notify_pin_comment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
BEGIN
  SELECT created_by INTO v_author_id FROM pins WHERE id = NEW.pin_id;
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, actor_id, kind, pin_id)
    VALUES (v_author_id, NEW.user_id, 'comment', NEW.pin_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pin_comment ON pin_comments;
CREATE TRIGGER trg_notify_pin_comment
  AFTER INSERT ON pin_comments
  FOR EACH ROW EXECUTE FUNCTION fn_notify_pin_comment();

-- ── 5. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE pin_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pin_comments_select_all" ON pin_comments;
CREATE POLICY "pin_comments_select_all"
  ON pin_comments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pin_comments_insert_own" ON pin_comments;
CREATE POLICY "pin_comments_insert_own"
  ON pin_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pin_comments_update_own" ON pin_comments;
CREATE POLICY "pin_comments_update_own"
  ON pin_comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pin_comments_delete_own" ON pin_comments;
CREATE POLICY "pin_comments_delete_own"
  ON pin_comments
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
