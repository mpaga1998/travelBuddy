import { createClient } from '@supabase/supabase-js';

let supabaseServerInstance: any = null;

function initSupabase() {
  if (supabaseServerInstance) return supabaseServerInstance;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  console.log('🔍 [SUPABASE] Checking environment:');
  console.log('📌 VITE_SUPABASE_URL:', supabaseUrl ? '✅ present' : '❌ missing');
  console.log('📌 VITE_SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅ present' : '❌ missing');
  console.log('📌 VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ present' : '❌ missing');

  if (!supabaseUrl) {
    throw new Error('❌ Missing VITE_SUPABASE_URL - add to .env.local or Vercel Environment Variables');
  }

  if (!supabaseServiceKey && !supabaseAnonKey) {
    throw new Error('❌ Missing Supabase keys - need VITE_SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY in .env.local');
  }

  const apiKey = supabaseServiceKey || supabaseAnonKey;

  supabaseServerInstance = createClient(supabaseUrl, apiKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✅ Supabase server client initialized');
  console.log('🔑 Using:', supabaseServiceKey ? 'SERVICE_KEY (bypass RLS)' : 'ANON_KEY (respects RLS)');

  return supabaseServerInstance;
}

export { initSupabase };
