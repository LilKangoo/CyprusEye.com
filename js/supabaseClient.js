import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_CONFIG } from './config.js'

export const sb = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SUPABASE_CONFIG.storageKey,
    storage: window.localStorage,
    flowType: 'pkce',
    multiTab: true,
  },
})

if (typeof window !== 'undefined') {
  window.sb = sb
  window.__SB__ = sb
  if (typeof window.getSupabase !== 'function') {
    window.getSupabase = () => sb
  }
}
