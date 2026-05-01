import { supabase } from '../../lib/supabaseClient';

/**
 * 5.3: Activity feed reads.
 *
 * Approach: two queries.
 *   1. Pull the list of followee_ids for the current user from `follows`.
 *   2. Query `pins` where created_by IN (those ids) AND is_hidden = false,
 *      newest first, with cursor pagination on created_at.
 *
 * Two queries instead of one PostgREST IN-subquery because the latter would
 * hit RLS twice and PostgREST nested filtering is awkward; two roundtrips
 * stay simple and both queries are O(log n) on indexed columns.
 *
 * Both queries are anon-RLS-aware: follows.SELECT is open, pins are publicly
 * readable when not hidden.
 *
 * Pagination: cursor is the ISO `created_at` of the oldest item in the
 * current batch. Pass it as `before` to the next call to fetch the slice
 * older than that. Returns nextCursor=null when there's nothing more.
 */

export interface FeedPin {
  id: string;
  title: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  imageUrls: string[];
  bookmarkCount: number;
  createdAt: string;
  authorId: string;
  authorUsername: string;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  authorRole: 'traveler' | 'hostel';
  authorHostelName: string | null;
}

export interface FeedPage {
  pins: FeedPin[];
  /** ISO timestamp to pass to the next fetchFeed call as `before`. Null at end. */
  nextCursor: string | null;
  /** True when the caller follows zero people — UI shows a different empty state. */
  noFollows: boolean;
}

interface DbFeedPinRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  lat: number;
  lng: number;
  image_urls: string[] | null;
  bookmark_count: number | null;
  created_at: string;
  created_by: string;
  profiles?: {
    username: string | null;
    handle: string | null;
    avatar_url: string | null;
    role: 'traveler' | 'hostel' | null;
    hostel_name: string | null;
  } | null;
}

const PAGE_SIZE = 20;

const SELECT = `
  id, title, description, category, lat, lng, image_urls, bookmark_count,
  created_at, created_by,
  profiles:created_by (username, handle, avatar_url, role, hostel_name)
`;

/**
 * Fetch one page of feed items. Pass `before` as the previous page's
 * nextCursor to walk backwards in time.
 */
export async function fetchFeed(before?: string): Promise<FeedPage> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user;
  if (!me) {
    return { pins: [], nextCursor: null, noFollows: false };
  }

  // 1. Who do I follow?
  const { data: followsData, error: followsErr } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', me.id);

  if (followsErr) {
    console.warn('[feed] follows lookup failed:', followsErr.message);
    return { pins: [], nextCursor: null, noFollows: false };
  }

  const followeeIds = (followsData ?? []).map((f) => f.followee_id as string);
  if (followeeIds.length === 0) {
    return { pins: [], nextCursor: null, noFollows: true };
  }

  // 2. Their visible pins, newest first, optionally before the cursor.
  let q = supabase
    .from('pins')
    .select(SELECT)
    .in('created_by', followeeIds)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (before) {
    // Strict < so the cursor row itself isn't repeated on the next page.
    q = q.lt('created_at', before);
  }

  const { data, error } = await q;
  if (error) {
    console.warn('[feed] pin lookup failed:', error.message);
    return { pins: [], nextCursor: null, noFollows: false };
  }

  const rows = (data ?? []) as unknown as DbFeedPinRow[];
  const pins: FeedPin[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    imageUrls: row.image_urls ?? [],
    bookmarkCount: row.bookmark_count ?? 0,
    createdAt: row.created_at,
    authorId: row.created_by,
    authorUsername: row.profiles?.username ?? 'Traveler',
    authorHandle: row.profiles?.handle ?? null,
    authorAvatarUrl: row.profiles?.avatar_url ?? null,
    authorRole: row.profiles?.role ?? 'traveler',
    authorHostelName: row.profiles?.hostel_name ?? null,
  }));

  // Cursor advances only when we got a full page. A short page means we've
  // walked off the end of the timeline.
  const nextCursor = pins.length === PAGE_SIZE ? pins[pins.length - 1].createdAt : null;

  return { pins, nextCursor, noFollows: false };
}
