import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 [SUPABASE] Checking environment:');
console.log('📌 VITE_SUPABASE_URL:', supabaseUrl ? '✅ present' : '❌ missing');
console.log('📌 VITE_SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅ present' : '❌ missing');
console.log('📌 VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ present' : '❌ missing');

if (!supabaseUrl) {
  throw new Error('❌ Missing VITE_SUPABASE_URL - add to .env.local or Vercel settings');
}

if (!supabaseServiceKey && !supabaseAnonKey) {
  throw new Error('❌ Missing Supabase keys - need VITE_SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY in .env.local or Vercel settings');
}

// Use service key if available (bypasses RLS for admin operations)
// Otherwise use anon key (respects RLS policies)
const apiKey = supabaseServiceKey || supabaseAnonKey;

export const supabaseServer = createClient(supabaseUrl, apiKey!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log('✅ Supabase server client initialized');
console.log('🔑 Using:', supabaseServiceKey ? 'SERVICE_KEY (admin/bypass RLS)' : 'ANON_KEY (respects RLS)');
