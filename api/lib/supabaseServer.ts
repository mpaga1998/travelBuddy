import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseServerInstance: SupabaseClient | null = null;

/**
 * Lazy-init a single Supabase client for server-side use in Vercel serverless functions.
 *
 * Key selection (first match wins):
 *   1. SUPABASE_SERVICE_ROLE_KEY          - canonical name, bypasses RLS (use this in prod)
 *   2. VITE_SUPABASE_SERVICE_KEY          - deprecated legacy name, bypasses RLS
 *   3. VITE_SUPABASE_ANON_KEY             - fallback, respects RLS
 *
 * The VITE_ prefix on the legacy name is a footgun: Vite will bundle any VITE_-prefixed
 * env var into the browser if referenced from src/. Migrate to SUPABASE_SERVICE_ROLE_KEY
 * (no prefix = server-only by convention).
 *
 * In production we fail closed if no service-role key is set - the anon-key fallback
 * was fine when RLS was the only gate, but now that handlers rely on bypassing RLS for
 * cross-user reads (e.g. profile lookups), silently degrading is dangerous.
 *
 * Callers that need to act *as* a specific user should pass that user's JWT to
 * .auth.getUser(token) (see requireAuth) rather than relying on the client default
 * session (sessions are disabled here by design).
 */
export function initSupabase(): SupabaseClient {
  if (supabaseServerInstance) return supabaseServerInstance;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_KEY; // legacy fallback
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL - add to .env.local or Vercel Environment Variables');
  }

  const isProd = process.env.VERCEL_ENV === 'production';

  if (!serviceRoleKey && !anonKey) {
    throw new Error(
      'Missing Supabase keys - need SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY'
    );
  }

  if (!serviceRoleKey && isProd) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY in production. Refusing to fall back to anon key - ' +
        'backend handlers now rely on bypassing RLS (e.g. server-side profile lookups). ' +
        'Add SUPABASE_SERVICE_ROLE_KEY in Vercel -> Settings -> Environment Variables.'
    );
  }

  if (!serviceRoleKey) {
    console.warn(
      '[SUPABASE] No SUPABASE_SERVICE_ROLE_KEY - falling back to anon key. ' +
        'This is only OK for local dev. Cross-user lookups (e.g. fetchFirstName) will fail silently under RLS.'
    );
  }

  if (process.env.VITE_SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '[SUPABASE] Using deprecated VITE_SUPABASE_SERVICE_KEY. Please rename to ' +
        'SUPABASE_SERVICE_ROLE_KEY in your env config - the VITE_ prefix risks bundling ' +
        'the key into the browser.'
    );
  }

  const apiKey = serviceRoleKey || anonKey!;

  supabaseServerInstance = createClient(supabaseUrl, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseServerInstance;
}
