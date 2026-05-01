import { supabase } from '../../lib/supabaseClient';

/**
 * 5.2: Follow / unfollow primitives.
 *
 * The `follows` table holds raw edges; cached counts live on profiles
 * (followers_count / following_count) and are maintained by triggers, so
 * read paths never have to aggregate. RLS gates writes to follower_id =
 * auth.uid(). Self-follow is blocked by a CHECK on the table.
 */

/**
 * Follow `userId`. Idempotent for the caller's UX — if the row already
 * exists (unique-violation 23505) we swallow the error so the caller can
 * trust the post-condition: "I am now following this user."
 *
 * Throws on auth failure or any non-23505 DB error.
 */
export async function followUser(userId: string): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const me = userData.user;
  if (!me) throw new Error('Not authenticated');
  if (me.id === userId) throw new Error("You can't follow yourself.");

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: me.id, followee_id: userId });

  // 23505 = unique violation. Already following — treat as success.
  if (error && (error as { code?: string }).code !== '23505') {
    throw error;
  }
}

/**
 * Unfollow `userId`. Idempotent — deleting a row that doesn't exist returns
 * silently (RLS makes "delete a follow you don't own" a no-op rather than
 * an error, which is the behavior we want).
 */
export async function unfollowUser(userId: string): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const me = userData.user;
  if (!me) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', me.id)
    .eq('followee_id', userId);

  if (error) throw error;
}

/**
 * Returns true if the caller is currently following `userId`. Returns false
 * for unauthenticated callers and on any failure (we'd rather hide the
 * "Following" state than show a wrong one). Self-checks short-circuit to
 * false — the UI never shows a follow button on your own profile, but
 * defensive belt-and-suspenders.
 */
export async function isFollowing(userId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user;
  if (!me) return false;
  if (me.id === userId) return false;

  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', me.id)
    .eq('followee_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[followApi] isFollowing check failed:', error.message);
    return false;
  }
  return !!data;
}
