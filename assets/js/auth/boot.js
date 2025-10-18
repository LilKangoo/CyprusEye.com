import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enabled = (document.querySelector('meta[name="ce-auth"]')?.content || 'on') === 'on';

function getMeta(name) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  return meta ? meta.content.trim() : "";
}

function exposeAuthApi(api) {
  window.CE_AUTH = api;
  document.dispatchEvent(new CustomEvent('ce-auth-ready', { detail: api }));
}

let supabaseClient = null;

if (!enabled) {
  exposeAuthApi({ enabled: false });
} else {
  const SUPABASE_URL = getMeta("supabase-url");
  const SUPABASE_ANON = getMeta("supabase-anon");
  const SUPABASE_PUB = getMeta("supabase-publishable");

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)) {
    console.error("Konfiguracja Supabase: nieprawidłowy URL");
    exposeAuthApi({ enabled: false });
  } else if (!SUPABASE_ANON || SUPABASE_ANON.split(".").length !== 3) {
    console.error("Konfiguracja Supabase: brak lub zły anon key");
    exposeAuthApi({ enabled: false });
  } else {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: {
        headers: SUPABASE_PUB
          ? { "x-application-name": "CyprusEye", "x-publishable-key": SUPABASE_PUB }
          : { "x-application-name": "CyprusEye" },
      },
    });

    async function session() {
      return (await supabaseClient.auth.getSession()).data.session;
    }

    function openAuthModalFallback() {
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
        return;
      }
      if (typeof window.__authModalController?.open === 'function') {
        window.__authModalController.open();
      }
    }

    async function requireAuthOrRedirect() {
      const s = await session();
      if (!s) {
        openAuthModalFallback();
        return false;
      }
      return true;
    }

    function bindAuthLinks() {
      document.querySelectorAll('[data-require-auth]').forEach((el) => {
        el.addEventListener(
          'click',
          async (event) => {
            const s = await session();
            if (!s) {
              event.preventDefault();
              openAuthModalFallback();
            }
          },
          { passive: false },
        );
      });
    }

    const listeners = new Set();

    function notifyAuthListeners(user) {
      listeners.forEach((listener) => {
        try {
          listener(user);
        } catch (error) {
          console.error('Auth listener error', error);
        }
      });
      document.dispatchEvent(new CustomEvent('ce-auth-state-change', { detail: { user } }));
    }

    supabaseClient.auth.onAuthStateChange((_event, authSession) => {
      const user = authSession?.user || null;
      notifyAuthListeners(user);
    });

    let initialUser = null;
    try {
      const { data, error } = await supabaseClient.auth.getUser();
      if (error) {
        throw error;
      }
      initialUser = data?.user || null;
    } catch (error) {
      console.warn('Początkowe pobieranie użytkownika Supabase nie powiodło się:', error);
    }
    notifyAuthListeners(initialUser);

    exposeAuthApi({
      enabled: true,
      supabase: supabaseClient,
      session,
      requireAuthOrRedirect,
      onAuthStateChange(callback) {
        if (typeof callback !== 'function') {
          return () => {};
        }
        listeners.add(callback);
        return () => listeners.delete(callback);
      },
    });

    function initAuth() {
      bindAuthLinks();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAuth);
    } else {
      initAuth();
    }
  }
}

export { supabaseClient as supabase };
