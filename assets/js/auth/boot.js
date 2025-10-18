import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enabled = (document.querySelector('meta[name="ce-auth"]')?.content || 'on') === 'on';
if (!enabled) { window.CE_AUTH = { enabled:false }; export {}; }

const URL = document.querySelector('meta[name="supabase-url"]').content;
const KEY = document.querySelector('meta[name="supabase-anon"]').content;

const supabase = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });

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
supabase.auth.onAuthStateChange((_e,_s)=>{ /* miejsce na przyszłe aktualizacje UI */ });

window.CE_AUTH = { enabled:true, supabase, session, requireAuthOrRedirect };
bindAuthLinks();
