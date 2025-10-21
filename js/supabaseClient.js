/* supabaseClient.js */
(() => {
  const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  const SUPABASE_URL = getMeta('supabase-url');
  const SUPABASE_ANON = getMeta('supabase-anon');

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[CE] Supabase meta tags missing');
  }

  const existingClient = window.__SB__ || null;
  let sb = existingClient;

  if (!sb && window.supabase?.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  window.__SB__ = sb || null;
  window.getSupabase = () => window.__SB__;

  const existingAuth = typeof window.CE_AUTH === 'object' && window.CE_AUTH !== null ? window.CE_AUTH : {};
  const listeners = existingAuth.__listeners instanceof Set ? existingAuth.__listeners : new Set();
  let currentSession = existingAuth.__currentSession || null;
  let userKnown = Boolean(existingAuth.__userKnown);
  let currentUser = userKnown ? existingAuth.__currentUser || null : null;
  let lastReadyClient = existingAuth.__readyClient || null;
  let readyDispatched = Boolean(existingAuth.__readyDispatched);

  const notifyListeners = (user, detail) => {
    listeners.forEach((listener) => {
      if (typeof listener !== 'function') {
        return;
      }
      try {
        listener(user, detail);
      } catch (error) {
        console.error('[CE_AUTH] listener error', error);
      }
    });
  };

  const ceAuth = existingAuth;
  ceAuth.__listeners = listeners;
  ceAuth.__currentSession = currentSession;
  ceAuth.__currentUser = currentUser;
  ceAuth.__userKnown = userKnown;
  ceAuth.__readyClient = lastReadyClient;
  ceAuth.__readyDispatched = readyDispatched;

  if (typeof ceAuth.getSession !== 'function') {
    ceAuth.getSession = () => currentSession;
  }

  if (typeof ceAuth.getUser !== 'function') {
    ceAuth.getUser = () => (userKnown ? currentUser : null);
  }

  ceAuth.onAuthStateChange = (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    listeners.add(callback);
    if (userKnown) {
      try {
        callback(currentUser, { session: currentSession });
      } catch (error) {
        console.error('[CE_AUTH] listener error', error);
      }
    }

    return () => {
      listeners.delete(callback);
    };
  };

  ceAuth.updateSession = (session, detail = {}) => {
    currentSession = session || null;
    currentUser = currentSession?.user ?? null;
    userKnown = true;
    ceAuth.__currentSession = currentSession;
    ceAuth.__currentUser = currentUser;
    ceAuth.__userKnown = true;
    const payload = { ...detail, session: currentSession };
    notifyListeners(currentUser, payload);
  };

  const dispatchReady = () => {
    if (!ceAuth.supabase || typeof document === 'undefined') {
      return;
    }
    if (readyDispatched && ceAuth.supabase === lastReadyClient) {
      return;
    }

    readyDispatched = true;
    lastReadyClient = ceAuth.supabase;
    ceAuth.__readyClient = lastReadyClient;
    ceAuth.__readyDispatched = readyDispatched;

    try {
      document.dispatchEvent(new CustomEvent('ce-auth-ready', { detail: ceAuth }));
    } catch (error) {
      console.warn('[CE] Nie udało się wysłać zdarzenia ce-auth-ready.', error);
    }
  };

  ceAuth.setSupabaseClient = (client) => {
    ceAuth.supabase = client || null;
    window.__SB__ = ceAuth.supabase;
    window.getSupabase = () => window.__SB__;
    if (client) {
      dispatchReady();
    }
  };

  if (typeof ceAuth.notifyReady !== 'function') {
    ceAuth.notifyReady = dispatchReady;
  }

  if (!('supabase' in ceAuth)) {
    ceAuth.supabase = null;
  }

  window.CE_AUTH = ceAuth;

  if (sb) {
    ceAuth.setSupabaseClient(sb);
  }
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
