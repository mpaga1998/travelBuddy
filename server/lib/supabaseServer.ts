import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY; // Service key for server operations
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY; // Anon key for RLS policies

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL env var');
}

if (!supabaseServiceKey && !supabaseAnonKey) {
  throw new Error('Missing Supabase keys: need either VITE_SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY');
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
console.log('🔑 Using:', supabaseServiceKey ? 'SERVICE_KEY (admin)' : 'ANON_KEY (RLS)');
