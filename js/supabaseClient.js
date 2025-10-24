import { sb as sharedClient } from '/assets/js/sb.js';

/* supabaseClient.js */
(() => {
  const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  const SUPABASE_URL = getMeta('supabase-url');
  const SUPABASE_ANON = getMeta('supabase-anon');

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[CE] Supabase meta tags missing');
  }

  const existingClient = window.__SB__ || sharedClient || null;
  let sb = existingClient;

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

  const applySupabaseClient = (client) => {
    sb = client || null;
    window.__SB__ = client || null;
    ceAuth.supabase = client || null;
  };

  const ensureSupabaseClient = () => {
    if (sb) {
      if (ceAuth.supabase !== sb) {
        applySupabaseClient(sb);
      }
      dispatchReady();
      return sb;
    }

    if (sharedClient) {
      applySupabaseClient(sharedClient);
      sb = sharedClient;
      dispatchReady();
      return sb;
    }

    if (window.__SB__) {
      applySupabaseClient(window.__SB__);
      if (sb) {
        dispatchReady();
      }
      return sb;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON) {
      return null;
    }

    if (!window.supabase?.createClient) {
      return null;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    applySupabaseClient(client);
    dispatchReady();
    return client;
  };

  ceAuth.setSupabaseClient = (client) => {
    applySupabaseClient(client || null);
    if (client) {
      dispatchReady();
    }
  };

  window.getSupabase = () => ensureSupabaseClient();

  if (typeof ceAuth.notifyReady !== 'function') {
    ceAuth.notifyReady = dispatchReady;
  }

  if (!('supabase' in ceAuth)) {
    ceAuth.supabase = null;
  }

  const ensureError = (error, fallbackMessage) => {
    if (error instanceof Error) {
      return error;
    }
    if (error && typeof error === 'object' && typeof error.message === 'string') {
      return new Error(error.message);
    }
    if (typeof error === 'string' && error) {
      return new Error(error);
    }
    return new Error(fallbackMessage);
  };

  ceAuth.signIn = async function signIn(email, password) {
    const client = this?.supabase || ceAuth.supabase || window.getSupabase?.();
    if (!client?.auth?.signInWithPassword) {
      return { data: null, error: ensureError(null, 'Brak klienta Supabase') };
    }

    try {
      const result = await client.auth.signInWithPassword({
        email: typeof email === 'string' ? email.trim() : '',
        password,
      });
      return result ?? { data: null, error: null };
    } catch (error) {
      return { data: null, error: ensureError(error, 'Nie udało się zalogować') };
    }
  };

  ceAuth.signUp = async function signUp(email, password, name, redirect) {
    const client = this?.supabase || ceAuth.supabase || window.getSupabase?.();
    if (!client?.auth?.signUp) {
      return { data: null, error: ensureError(null, 'Brak klienta Supabase') };
    }

    const sanitizedEmail = typeof email === 'string' ? email.trim() : '';
    const sanitizedName = typeof name === 'string' ? name.trim() : '';
    const emailRedirectTo = redirect || 'https://cypruseye.com/auth/';

    try {
      const result = await client.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          data: { name: sanitizedName },
          emailRedirectTo,
        },
      });
      return result ?? { data: null, error: null };
    } catch (error) {
      return { data: null, error: ensureError(error, 'Nie udało się utworzyć konta') };
    }
  };

  window.CE_AUTH = ceAuth;

  const resolvedClient = ensureSupabaseClient();

  if (!resolvedClient) {
    const MAX_ATTEMPTS = 200;
    const INTERVAL_MS = 25;
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (ensureSupabaseClient()) {
        window.clearInterval(intervalId);
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        window.clearInterval(intervalId);
        console.warn('[CE] Supabase client not ready after waiting for script load.');
      }
    }, INTERVAL_MS);

    const handleReady = () => {
      if (ensureSupabaseClient()) {
        window.clearInterval(intervalId);
      }
    };

    window.addEventListener('load', handleReady, { once: true });

    const supabaseScript = document.querySelector('script[src*="@supabase/supabase-js"]');
    if (supabaseScript) {
      supabaseScript.addEventListener('load', handleReady, { once: true });
      supabaseScript.addEventListener(
        'error',
        () => {
          console.error('[CE] Supabase library failed to load.');
        },
        { once: true },
      );
    }
  }
  if (sharedClient) {
    applySupabaseClient(sharedClient);
    dispatchReady();
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
