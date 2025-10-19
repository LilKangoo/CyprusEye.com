import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureSupabaseMeta, getSupabaseConfig } from "./config.js";

ensureSupabaseMeta();

const diagnostics = {
  issues: [],
  log(level = 'info', code = 'info', message = '', detail = null) {
    const entry = {
      timestamp: Date.now(),
      level,
      code,
      message,
      detail,
    };
    this.issues.push(entry);
    if (this.issues.length > 20) {
      this.issues.shift();
    }
    const logger = console[level] || console.log;
    if (detail !== null && detail !== undefined) {
      logger.call(console, `[auth:${code}] ${message}`, detail);
    } else {
      logger.call(console, `[auth:${code}] ${message}`);
    }
  },
};

const enabled = (document.querySelector('meta[name="ce-auth"]')?.content || 'on') === 'on';

diagnostics.log('info', 'boot-start', 'Inicjalizacja modułu logowania CE_AUTH');

const AUTH_PAGE_PATH = '/auth/';
const loginButtonSelectors = ['#loginBtn', '[data-login-button]'];
let loginButtonUpdater = () => {};
let lastKnownUser = null;
let previousUserId = null;

function determineDefaultLabels() {
  const lang = (document.documentElement?.lang || 'pl').toLowerCase();
  if (lang.startsWith('en')) {
    return { signedOut: 'Log in', signedIn: 'Log out' };
  }
  return { signedOut: 'Zaloguj', signedIn: 'Wyloguj' };
}

function setupLoginButtons(supabase) {
  const defaults = determineDefaultLabels();

  function findButtons() {
    const buttons = [];
    loginButtonSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }
        if (!buttons.includes(element)) {
          buttons.push(element);
        }
      });
    });
    return buttons;
  }

  function setDisabled(button, disabled) {
    if (button instanceof HTMLButtonElement) {
      button.disabled = disabled;
    }
    if (disabled) {
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.removeAttribute('aria-disabled');
    }
  }

  function getLabel(button, state) {
    if (state === 'signed-in') {
      return button.dataset.loginLabelSignedIn || defaults.signedIn;
    }
    return button.dataset.loginLabelSignedOut || defaults.signedOut;
  }

  function applyLoggedOut(button) {
    const label = getLabel(button, 'signed-out');
    button.textContent = label;
    button.dataset.loginState = 'signed-out';
    button.dataset.loginProcessing = 'false';
    setDisabled(button, false);

    if (button instanceof HTMLAnchorElement) {
      button.setAttribute('href', AUTH_PAGE_PATH);
      button.onclick = null;
    } else {
      button.setAttribute('type', 'button');
      button.onclick = (event) => {
        event.preventDefault();
        window.location.href = AUTH_PAGE_PATH;
      };
    }
  }

  function applyLoggedIn(button) {
    const label = getLabel(button, 'signed-in');
    button.textContent = label;
    button.dataset.loginState = 'signed-in';
    button.dataset.loginProcessing = 'false';
    setDisabled(button, false);

    if (button instanceof HTMLAnchorElement) {
      button.removeAttribute('href');
    }

    button.onclick = async (event) => {
      event.preventDefault();
      if (!supabase) {
        window.location.reload();
        return;
      }
      if (button.dataset.loginProcessing === 'true') {
        return;
      }
      button.dataset.loginProcessing = 'true';
      setDisabled(button, true);
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
        window.location.reload();
      } catch (error) {
        console.error('Błąd podczas wylogowywania użytkownika Supabase', error);
        button.dataset.loginProcessing = 'false';
        setDisabled(button, false);
      }
    };
  }

  loginButtonUpdater = (user) => {
    const buttons = findButtons();
    if (!buttons.length) {
      return;
    }
    buttons.forEach((button) => {
      if (user) {
        applyLoggedIn(button);
      } else {
        applyLoggedOut(button);
      }
    });
  };

  const refresh = () => loginButtonUpdater(lastKnownUser);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  } else {
    refresh();
  }
}

function applyAuthVisibility(user) {
  const isLoggedIn = Boolean(user);
  document.querySelectorAll('[data-auth-visible]').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const mode = element.dataset.authVisible || '';
    if (mode === 'signed-in' || mode === 'authenticated') {
      element.hidden = !isLoggedIn;
      if (isLoggedIn) {
        element.removeAttribute('aria-hidden');
      } else {
        element.setAttribute('aria-hidden', 'true');
      }
    } else if (mode === 'guest' || mode === 'signed-out') {
      element.hidden = isLoggedIn;
      if (isLoggedIn) {
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.removeAttribute('aria-hidden');
      }
    }
  });
}

function exposeAuthApi(api) {
  const payload = { ...api, diagnostics };
  Object.defineProperty(payload, 'authError', {
    configurable: true,
    enumerable: true,
    get() {
      return document.documentElement.dataset.authError || null;
    },
  });
  window.CE_AUTH = payload;
  window.__CE_AUTH_DIAGNOSTICS = diagnostics;
  document.dispatchEvent(new CustomEvent('ce-auth-ready', { detail: payload }));
}

let supabaseClient = null;

if (!enabled) {
  diagnostics.log('warn', 'auth-disabled', 'Logowanie wyłączone przez meta ce-auth=off.');
  setupLoginButtons(null);
  lastKnownUser = null;
  applyAuthVisibility(null);
  loginButtonUpdater(null);
  exposeAuthApi({ enabled: false, reason: 'disabled' });
} else {
  const supabaseConfig = getSupabaseConfig(document, {
    logWarnings: true,
  });
  const { url: SUPABASE_URL, anon: SUPABASE_ANON, publishable: SUPABASE_PUB } = supabaseConfig;

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('Konfiguracja Supabase: brak wymaganych danych po zastosowaniu domyślnych wartości');
    diagnostics.log('error', 'config-missing', 'Brak prawidłowych wartości supabase-url lub supabase-anon.', {
      url: SUPABASE_URL,
      anon: Boolean(SUPABASE_ANON),
    });
    document.documentElement.dataset.authError = 'config-missing';
    setupLoginButtons(null);
    lastKnownUser = null;
    applyAuthVisibility(null);
    loginButtonUpdater(null);
    exposeAuthApi({ enabled: false, reason: 'config-missing' });
  } else {
    diagnostics.log('info', 'config-loaded', 'Załadowano konfigurację Supabase.', {
      source: supabaseConfig.source,
      usingDefaults: Boolean(supabaseConfig.usingDefaults),
    });
    if (supabaseConfig.usingDefaults) {
      diagnostics.log(
        'warn',
        'config-defaults',
        'Wykryto użycie domyślnych kluczy Supabase – zalecana aktualizacja konfiguracji.',
      );
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: {
        headers: SUPABASE_PUB
          ? { "x-application-name": "CyprusEye", "x-publishable-key": SUPABASE_PUB }
          : { "x-application-name": "CyprusEye" },
      },
    });
    diagnostics.log('info', 'client-created', 'Zainicjowano klienta Supabase.');

    setupLoginButtons(supabaseClient);

    async function session() {
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
          throw error;
        }
        return data.session;
      } catch (error) {
        diagnostics.log('warn', 'session-fetch-failed', 'Nie udało się odczytać sesji Supabase.', {
          message: error?.message,
          status: error?.status,
        });
        throw error;
      }
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
      try {
        const s = await session();
        if (!s) {
          openAuthModalFallback();
          return false;
        }
        return true;
      } catch (error) {
        diagnostics.log('warn', 'require-auth-failed', 'Nie udało się potwierdzić sesji przed żądaną akcją.', {
          message: error?.message,
          status: error?.status,
        });
        openAuthModalFallback();
        return false;
      }
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
      lastKnownUser = user;
      const userId = user?.id || null;
      if (userId !== previousUserId) {
        previousUserId = userId;
        diagnostics.log(
          'info',
          userId ? 'user-authenticated' : 'user-signed-out',
          userId ? 'Supabase potwierdził zalogowanego użytkownika.' : 'Brak aktywnej sesji Supabase.',
          userId ? { id: userId } : undefined,
        );
      }
      if (userId) {
        delete document.documentElement.dataset.authError;
      }
      applyAuthVisibility(user);
      loginButtonUpdater(user);
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
      diagnostics.log('error', 'initial-user-failed', 'Nie udało się pobrać danych użytkownika podczas inicjalizacji.', {
        message: error?.message,
        status: error?.status,
      });
      if (typeof error?.message === 'string' && error.message.toLowerCase().includes('invalid api key')) {
        document.documentElement.dataset.authError = 'invalid-api-key';
        diagnostics.log('error', 'invalid-api-key', 'Supabase zwrócił błąd "Invalid API key" podczas startu.');
      }
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
