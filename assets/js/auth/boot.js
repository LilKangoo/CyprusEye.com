import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enabled = (document.querySelector('meta[name="ce-auth"]')?.content || 'on') === 'on';
if (!enabled) { window.CE_AUTH = { enabled:false }; export {}; }

function getMeta(name) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  return meta ? meta.content.trim() : "";
}

const SUPABASE_URL  = getMeta("supabase-url");
const SUPABASE_ANON = getMeta("supabase-anon");
const SUPABASE_PUB  = getMeta("supabase-publishable");

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
      : { "x-application-name": "CyprusEye" }
  }
});

async function session() { return (await supabase.auth.getSession()).data.session; }
async function requireAuthOrRedirect(target = '/account') {
  const s = await session();
  if (!s) window.location.href = '/auth';
  return !!s;
}
function bindAuthLinks() {
  document.querySelectorAll('[data-require-auth]').forEach(el => {
    el.addEventListener('click', async (e) => {
      const s = await session();
      if (!s) { e.preventDefault(); window.location.href = '/auth'; }
    }, { passive:false });
  });
}
function uiAuthState(isLoggedIn) {
  const loginBtn = document.getElementById('openAuthModal');
  const logoutBtn = document.getElementById('logoutBtn');
  if (loginBtn) loginBtn.hidden = !!isLoggedIn;
  if (logoutBtn) logoutBtn.hidden = !isLoggedIn;
}

supabase.auth.onAuthStateChange((_event, session) => {
  const user = session?.user || null;
  uiAuthState(!!user);
});

(await supabase.auth.getUser()).data.user ? uiAuthState(true) : uiAuthState(false);

window.CE_AUTH = { enabled:true, supabase, session, requireAuthOrRedirect };

function initAuth() {
  bindAuthLinks();
  const loginBtn = document.getElementById('openAuthModal');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/auth';
    });
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
