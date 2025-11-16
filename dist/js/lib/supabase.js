/**
 * Supabase Client Initialization
 * Uses VITE_* environment variables from Cloudflare Pages build
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Get environment variables from import.meta.env (Vite/Cloudflare Pages)
const getEnvVar = (key) => {
  // Try import.meta.env first (build-time)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  // Fallback to window (runtime injection by Cloudflare)
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    return window.__ENV__[key];
  }
  return null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  });
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
}

// Create Supabase client with proper auth headers
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'cypruseye-auth-token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  }
});

// Export for compatibility
export default supabase;

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.__supabase__ = supabase;
  window.__supabaseConfig__ = {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey
  };
}
