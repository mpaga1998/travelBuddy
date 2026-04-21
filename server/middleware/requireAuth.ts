import type { Request, Response, NextFunction } from 'express';
import { initSupabase } from '../lib/supabaseServer';

/**
 * Authenticated user attached to the request by `requireAuth`.
 * Kept intentionally minimal — add fields as downstream handlers need them.
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
}

// Augment Express's Request so `req.user` is typed everywhere downstream.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Extract a bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Express middleware that verifies a Supabase JWT on the incoming request.
 *
 * On success: attaches `req.user = { id, email }` (verified from the token) and calls next().
 * On failure: responds 401 and does NOT call next().
 *
 * Never trust `userId` from the request body or query string downstream — always read
 * `req.user.id` after this middleware has run.
 *
 * Usage:
 *   router.post('/save', requireAuth, handler)
 *   // or app.use('/api/protected', requireAuth, router)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req.header('authorization'));

  if (!token) {
    console.warn('🔐 [AUTH] Missing or malformed Authorization header on', req.method, req.originalUrl);
    res.status(401).json({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Authorization: Bearer <token>',
    });
    return;
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
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      console.warn('🔐 [AUTH] Token rejected:', error?.message ?? 'no user returned');
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };

    next();
  } catch (e) {
    console.error('🔐 [AUTH] Unexpected error verifying token:', e);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}
