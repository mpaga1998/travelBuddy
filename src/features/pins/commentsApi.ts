import { supabase } from '../../lib/supabaseClient';

/**
 * 5.5: pin comments — read + write helpers.
 *
 * Comments are world-readable on any visible pin (RLS policy
 * pin_comments_select_all USING (true)). INSERT and DELETE are gated to
 * the comment's own user. Notifications to the pin author are emitted by
 * the SECURITY DEFINER trigger on pin_comments INSERT — clients don't
 * need to do anything extra.
 *
 * Body length is server-enforced via a CHECK constraint (1–1000 chars).
 * The client validates locally too so we can show a friendly error before
 * the round-trip, but the DB constraint is the source of truth.
 */

export interface PinComment {
  id: string;
  pinId: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorUsername: string;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  authorRole: 'traveler' | 'hostel';
  authorHostelName: string | null;
}

interface DbCommentRow {
  id: string;
  pin_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: {
    username: string | null;
    handle: string | null;
    avatar_url: string | null;
    role: 'traveler' | 'hostel' | null;
    hostel_name: string | null;
  } | null;
}

const SELECT = `
  id, pin_id, user_id, body, created_at,
  author:profiles!user_id(username, handle, avatar_url, role, hostel_name)
`;

export const COMMENT_MAX_LENGTH = 1000;

function mapRow(row: DbCommentRow): PinComment {
  return {
    id: row.id,
    pinId: row.pin_id,
    body: row.body,
    createdAt: row.created_at,
    authorId: row.user_id,
    authorUsername: row.author?.username ?? 'Traveler',
    authorHandle: row.author?.handle ?? null,
    authorAvatarUrl: row.author?.avatar_url ?? null,
    authorRole: row.author?.role ?? 'traveler',
    authorHostelName: row.author?.hostel_name ?? null,
  };
}

/**
 * List comments on a pin, oldest first (typical thread order). Caps at 200
 * — enough that single-pin threads never need pagination at this scale;
 * if a viral pin ever crosses that, we'll add cursor pagination then.
 */
export async function fetchComments(pinId: string): Promise<PinComment[]> {
  const { data, error } = await supabase
    .from('pin_comments')
    .select(SELECT)
    .eq('pin_id', pinId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.warn('[comments] fetch failed:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as DbCommentRow[]).map(mapRow);
}

/**
 * Add a comment. Returns the newly-created row (joined with the author
 * profile so the caller can append it to the local list without a refetch).
 *
 * Body validation mirrors the DB CHECK; we surface the user-friendly
 * messages instead of waiting for the 23514 violation to bubble up.
 */
export async function addComment(pinId: string, body: string): Promise<PinComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.`);
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const me = userData.user;
  if (!me) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pin_comments')
    .insert({ pin_id: pinId, user_id: me.id, body: trimmed })
    .select(SELECT)
    .single();

  if (error) throw error;
  return mapRow(data as unknown as DbCommentRow);
}

/**
 * Delete one of your own comments. RLS prevents deleting someone else's
 * (the DELETE policy is USING (user_id = auth.uid())) — passing a foreign
 * comment id will return success with 0 rows affected, which is fine.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const me = userData.user;
  if (!me) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('pin_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', me.id);

  if (error) throw error;
}
