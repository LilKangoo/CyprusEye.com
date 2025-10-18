import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enabled = (document.querySelector('meta[name="ce-auth"]')?.content || 'on') === 'on';
if (!enabled) { window.CE_AUTH = { enabled: false }; export {}; }

function getMeta(name) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  return meta ? meta.content.trim() : "";
}

const SUPABASE_URL = getMeta("supabase-url");
const SUPABASE_ANON = getMeta("supabase-anon");
const SUPABASE_PUB = getMeta("supabase-publishable");

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)) {
  throw new Error("Konfiguracja Supabase: nieprawidłowy URL");
}
if (!SUPABASE_ANON || SUPABASE_ANON.split(".").length !== 3) {
  throw new Error("Konfiguracja Supabase: brak lub zły anon key");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: {
    headers: SUPABASE_PUB
      ? { "x-application-name": "CyprusEye", "x-publishable-key": SUPABASE_PUB }
      : { "x-application-name": "CyprusEye" },
  },
});

async function session() {
  return (await supabase.auth.getSession()).data.session;
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

supabase.auth.onAuthStateChange((_event, authSession) => {
  const user = authSession?.user || null;
  notifyAuthListeners(user);
});

const { data: initialUserData } = await supabase.auth.getUser();
notifyAuthListeners(initialUserData.user || null);

window.CE_AUTH = {
  enabled: true,
  supabase,
  session,
  requireAuthOrRedirect,
  onAuthStateChange(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};

function initAuth() {
  bindAuthLinks();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
