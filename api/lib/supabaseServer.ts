import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseServerInstance: SupabaseClient | null = null;

/**
 * Lazy-init a single Supabase client for server-side use in Vercel serverless functions.
 *
 * Prefers VITE_SUPABASE_SERVICE_KEY (bypasses RLS) when present, falling back to
 * VITE_SUPABASE_ANON_KEY. Callers that need to act *as* a specific user should pass
 * that user's JWT to `.auth.getUser(token)` rather than relying on the client's
 * default session (sessions are disabled here by design).
 */
export function initSupabase(): SupabaseClient {
  if (supabaseServerInstance) return supabaseServerInstance;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL - add to .env.local or Vercel Environment Variables');
  }

  if (!supabaseServiceKey && !supabaseAnonKey) {
    throw new Error('Missing Supabase keys - need VITE_SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY');
  }

  const apiKey = supabaseServiceKey || supabaseAnonKey!;

  supabaseServerInstance = createClient(supabaseUrl, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseServerInstance;
}
