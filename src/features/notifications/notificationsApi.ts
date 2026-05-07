import { supabase } from '../../lib/supabaseClient';

/**
 * 5.4: Notifications reads + mark-as-read mutation.
 *
 * Inserts are written exclusively by SECURITY DEFINER triggers on
 * pin_reactions / pin_bookmarks / follows — clients never write directly.
 * RLS gates SELECT/UPDATE/DELETE to recipient_id = auth.uid().
 *
 * The actor profile is joined inline via the FK (notifications.actor_id →
 * profiles.id). Pin title is joined when pin_id is set. Both joins return
 * arrays in PostgREST's generated types even though the FKs are
 * single-valued — we cast through `unknown` like elsewhere in the codebase
 * (see api/lib/communityPins.ts and src/features/pins/pinApi.ts for the
 * same pattern).
 */

export type NotificationKind = 'like' | 'bookmark' | 'follow' | 'comment';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  /** ISO timestamp the recipient marked it read; null while unread. */
  readAt: string | null;
  // Actor (the user who did the thing).
  actorId: string;
  actorUsername: string;
  actorHandle: string | null;
  actorAvatarUrl: string | null;
  actorRole: 'traveler' | 'hostel';
  actorHostelName: string | null;
  // Pin context — only present for like/bookmark/comment.
  pinId: string | null;
  pinTitle: string | null;
  pinLat: number | null;
  pinLng: number | null;
}

interface DbNotificationRow {
  id: string;
  kind: NotificationKind;
  created_at: string;
  read_at: string | null;
  actor_id: string;
  pin_id: string | null;
  actor: {
    username: string | null;
    handle: string | null;
    avatar_url: string | null;
    role: 'traveler' | 'hostel' | null;
    hostel_name: string | null;
  } | null;
  pin: {
    title: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

const SELECT = `
  id, kind, created_at, read_at, actor_id, pin_id,
  actor:profiles!actor_id(username, handle, avatar_url, role, hostel_name),
  pin:pins!pin_id(title, lat, lng)
`;

function mapRow(row: DbNotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    createdAt: row.created_at,
    readAt: row.read_at,
    actorId: row.actor_id,
    actorUsername: row.actor?.username ?? 'Traveler',
    actorHandle: row.actor?.handle ?? null,
    actorAvatarUrl: row.actor?.avatar_url ?? null,
    actorRole: row.actor?.role ?? 'traveler',
    actorHostelName: row.actor?.hostel_name ?? null,
    pinId: row.pin_id,
    pinTitle: row.pin?.title ?? null,
    pinLat: row.pin?.lat ?? null,
    pinLng: row.pin?.lng ?? null,
  };
}

/**
 * Fetch up to `limit` recent notifications for the current user, newest first.
 * Returns [] for unauthenticated callers.
 */
export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[notifications] fetch failed:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as DbNotificationRow[]).map(mapRow);
}

/**
 * Returns the number of unread notifications for the current user.
 * Returns 0 for unauthenticated callers and on any failure (defensive — we'd
 * rather hide a stale badge than show a wrong count).
 */
export async function countUnread(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) {
    console.warn('[notifications] unread count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Mark every unread notification for the current user as read. Idempotent —
 * if there's nothing to mark, the UPDATE affects 0 rows and returns success.
 *
 * RLS already pins this to the caller's own rows; we still pass through
 * `.is('read_at', null)` so we don't generate a no-op UPDATE on already-read
 * notifications (cheaper write).
 */
export async function markAllAsRead(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user;
  if (!me) return;

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me.id)
    .is('read_at', null);

  if (error) throw error;
}

/**
 * Mark a single notification as read by id. No-op if already read.
 * RLS pins this to the current user's own rows.
 */
export async function markOneAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) throw error;
}
