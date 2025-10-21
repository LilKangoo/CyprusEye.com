/* supabaseClient.js */
(() => {
  if (window.__SB__) return;
  const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  const SUPABASE_URL = getMeta('supabase-url');
  const SUPABASE_ANON = getMeta('supabase-anon');

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[CE] Supabase meta tags missing');
  }

  const sb = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  window.__SB__ = sb;
  window.getSupabase = () => window.__SB__;
})();

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const bootResult = window?.bootAuth?.();
      if (bootResult?.then) {
        bootResult
          .then(() => window?.updateAuthUI?.())
          .catch(() => window?.updateAuthUI?.());
      } else {
        window?.updateAuthUI?.();
      }
    } catch (error) {
      console.warn('[CE] Nie udało się zainicjalizować bootAuth po załadowaniu DOM.', error);
    }
  });
}

export {};
