import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function readMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
}

function createSupabase() {
  const url = readMeta('supabase-url');
  const anon = readMeta('supabase-anon');
  const publishable = readMeta('supabase-publishable');

  if (!url || !anon) {
    throw new Error('Brak konfiguracji Supabase: ustaw meta supabase-url i supabase-anon.');
  }

  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      multiTab: true,
    },
    global: {
      headers: publishable
        ? { 'x-application-name': 'CyprusEye', 'x-publishable-key': publishable }
        : { 'x-application-name': 'CyprusEye' },
    },
  });
}

const existingClient = window.CE_AUTH?.supabase;
export const sb = existingClient ?? createSupabase();

if (window.CE_AUTH) {
  if (!window.CE_AUTH.supabase) {
    window.CE_AUTH.supabase = sb;
  }
} else {
  window.CE_AUTH = { supabase: sb };
}

export default sb;
