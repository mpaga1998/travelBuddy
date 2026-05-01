-- Phase 5.4: notifications.
--
-- Creates a `notifications` table and three SECURITY DEFINER triggers that
-- write into it whenever someone likes a pin, bookmarks a pin, or follows
-- another user. All triggers self-skip when the actor is the recipient
-- (no "you liked your own pin" notifications) and dedupe duplicates so a
-- like → unlike → like sequence doesn't pile up two notifications on the
-- author. RLS gates SELECT/UPDATE/DELETE to the recipient.
--
-- Run manually in the Supabase SQL editor.

-- ── 1. notifications table ────────────────────────────────────────────────
--
-- recipient_id and actor_id both reference profiles(id) (not auth.users)
-- so PostgREST embedded relations work out of the box and we can join the
-- actor's username/handle/avatar in a single query. profiles.id is itself
-- a FK to auth.users(id) ON DELETE CASCADE, so deleting a user still
-- cleans up their notifications via that chain.
--
-- pin_id is nullable: follow notifications have no associated pin.

CREATE TABLE IF NOT EXISTS notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind          text        NOT NULL CHECK (kind IN ('like', 'bookmark', 'follow')),
  pin_id        uuid        REFERENCES pins(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,

  -- Pin-related kinds must carry a pin_id; follow must not.
  CONSTRAINT notifications_pin_id_shape CHECK (
    (kind IN ('like', 'bookmark') AND pin_id IS NOT NULL)
    OR (kind = 'follow' AND pin_id IS NULL)
  )
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────
--
-- recipient_id + created_at desc covers the inbox-style read pattern
-- (newest first for one user). The unread-count query benefits from a
-- partial index on read_at IS NULL.

CREATE INDEX IF NOT EXISTS notifications_recipient_recent_idx
  ON notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON notifications (recipient_id)
  WHERE read_at IS NULL;

-- ── 3. RLS ────────────────────────────────────────────────────────────────
--
-- Triggers run as SECURITY DEFINER (table owner) and bypass RLS for
-- INSERTs, so we don't need an INSERT policy here.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- UPDATE allows the recipient to flip read_at — used by markAllAsRead.
-- The WITH CHECK clause prevents a recipient from re-assigning the row
-- to someone else.
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());

-- ── 4. Trigger: like notifications ────────────────────────────────────────
--
-- Fires on INSERT or UPDATE of pin_reactions where the resulting kind is
-- 'like'. We listen to UPDATE because toggleReaction in pinApi.ts upserts
-- when switching from dislike → like, so a like can arrive via either
-- TG_OP. We skip the case where it was already a like (UPDATE with no
-- transition), self-likes, and duplicates.

CREATE OR REPLACE FUNCTION fn_notify_pin_like()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
BEGIN
  IF NEW.kind <> 'like' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.kind = 'like' THEN
    RETURN NEW; -- already a like, no transition
  END IF;

  SELECT created_by INTO v_author_id FROM pins WHERE id = NEW.pin_id;
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE recipient_id = v_author_id
      AND actor_id = NEW.user_id
      AND kind = 'like'
      AND pin_id = NEW.pin_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, actor_id, kind, pin_id)
    VALUES (v_author_id, NEW.user_id, 'like', NEW.pin_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pin_like ON pin_reactions;
CREATE TRIGGER trg_notify_pin_like
  AFTER INSERT OR UPDATE ON pin_reactions
  FOR EACH ROW EXECUTE FUNCTION fn_notify_pin_like();

-- ── 5. Trigger: bookmark notifications ────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_notify_pin_bookmark()
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

  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE recipient_id = v_author_id
      AND actor_id = NEW.user_id
      AND kind = 'bookmark'
      AND pin_id = NEW.pin_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, actor_id, kind, pin_id)
    VALUES (v_author_id, NEW.user_id, 'bookmark', NEW.pin_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pin_bookmark ON pin_bookmarks;
CREATE TRIGGER trg_notify_pin_bookmark
  AFTER INSERT ON pin_bookmarks
  FOR EACH ROW EXECUTE FUNCTION fn_notify_pin_bookmark();

-- ── 6. Trigger: follow notifications ──────────────────────────────────────
--
-- The follows table's CHECK already prevents self-follows, so we don't
-- need to skip them here. Dedup-on-toggle still matters: A follows B,
-- unfollows, follows again — B should see one notification, not two.

CREATE OR REPLACE FUNCTION fn_notify_follow()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE recipient_id = NEW.followee_id
      AND actor_id = NEW.follower_id
      AND kind = 'follow'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, actor_id, kind)
    VALUES (NEW.followee_id, NEW.follower_id, 'follow');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION fn_notify_follow();
