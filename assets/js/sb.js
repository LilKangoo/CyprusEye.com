import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://daoohnbnnowmmcizgvrq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjkwNDksImV4cCI6MjA3NjM0NTA0OX0.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

if (typeof window !== 'undefined') {
  window.__SB__ = sb;
  window.getSupabase = () => sb;

  if (typeof window.CE_AUTH !== 'object' || window.CE_AUTH === null) {
    window.CE_AUTH = {};
  }

  if (typeof window.CE_AUTH.setSupabaseClient === 'function') {
    try {
      window.CE_AUTH.setSupabaseClient(sb);
    } catch (error) {
      console.warn('[CE] Nie udało się przekazać klienta Supabase do CE_AUTH.', error);
    }
  } else {
    window.CE_AUTH.supabase = sb;
  }
}
