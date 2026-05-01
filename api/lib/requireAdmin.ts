import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, type AuthenticatedUser } from './requireAuth.js';
import { initSupabase } from './supabaseServer.js';

/**
 * 4.5: Verify the caller is signed in AND has profiles.is_admin = true.
 *
 * Wraps requireAuth — on any failure path the response has already been
 * written (401 for missing/bad token, 403 for non-admin, 500 for backend
 * issues). Handlers MUST check for null and return immediately.
 *
 * Why service-role:
 *   The is_admin lookup uses the service-role Supabase client so the check
 *   bypasses RLS on profiles. Reading the calling user's own row is allowed
 *   by `profiles_select_public` anyway, but we want the admin check to be
 *   authoritative regardless of how those policies evolve.
 *
 * Why 403 (not 404) for non-admin:
 *   The caller is authenticated, just not authorized. 403 is the correct
 *   status. The admin route in the frontend separately renders a 404-style
 *   page so the URL doesn't reveal that /admin exists to the curious.
 */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> {
  const user = await requireAuth(req, res);
  if (!user) return null;

  let supabase;
  try {
    supabase = initSupabase();
  } catch (e) {
    console.error('🛡️ [ADMIN] Supabase client failed to initialize:', e);
    res.status(500).json({ success: false, error: 'Auth backend not configured' });
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('🛡️ [ADMIN] is_admin lookup failed:', error.message);
      res.status(403).json({ success: false, error: 'Forbidden' });
      return null;
    }

    if (!data?.is_admin) {
      // Not an admin. 403 with a deliberately generic message — don't
      // confirm or deny that admin tooling exists.
      res.status(403).json({ success: false, error: 'Forbidden' });
      return null;
    }

    return user;
  } catch (e) {
    console.error('🛡️ [ADMIN] Unexpected error verifying admin status:', e);
    res.status(403).json({ success: false, error: 'Forbidden' });
    return null;
  }
}
