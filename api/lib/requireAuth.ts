import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initSupabase } from './supabaseServer.js';

/**
 * Authenticated user attached to the request after `requireAuth` succeeds.
 * Intentionally minimal — add fields only when a downstream handler actually needs them.
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Extract a bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearerToken(authHeader: string | string[] | undefined): string | null {
  if (!authHeader) return null;
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Verify a Supabase JWT on the incoming Vercel serverless request.
 *
 * - On success: returns the authenticated user `{ id, email }`.
 * - On failure: writes a 401 (or 500 if Supabase fails to init) to `res` and returns `null`.
 *
 * Handlers MUST check for `null` and stop processing. Never trust `userId` from the
 * request body or query string — always use the returned `user.id`.
 *
 * Usage:
 *   const user = await requireAuth(req, res);
 *   if (!user) return; // response already sent
 *   // ... use user.id ...
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> {
  const token = extractBearerToken(req.headers['authorization']);

  if (!token) {
    console.warn('🔐 [AUTH] Missing or malformed Authorization header on', req.method, req.url);
    res.status(401).json({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Authorization: Bearer <token>',
    });
    return null;
  }

  let supabase;
  try {
    supabase = initSupabase();
  } catch (e) {
    console.error('🔐 [AUTH] Supabase client failed to initialize:', e);
    res.status(500).json({
      success: false,
      error: 'Auth backend not configured',
    });
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      console.warn('🔐 [AUTH] Token rejected:', error?.message ?? 'no user returned');
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };
  } catch (e) {
    console.error('🔐 [AUTH] Unexpected error verifying token:', e);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
    return null;
  }
}
