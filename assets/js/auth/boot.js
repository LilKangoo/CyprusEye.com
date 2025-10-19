import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureSupabaseMeta, getSupabaseConfig, readSupabaseConfig } from "./config.js";

ensureSupabaseMeta();

const diagnostics = {
  source: null,
  lastError: null,
  issues: [],
  setSource(value) {
    this.source = value || null;
  },
  setLastError(error) {
    if (!error) {
      this.lastError = null;
      return;
    }
    const normalized = {
      code: typeof error.code === "string" ? error.code : undefined,
      message: typeof error.message === "string" ? error.message : undefined,
      status:
        typeof error.status === "number"
          ? error.status
          : Number.isFinite(Number(error.status))
          ? Number(error.status)
          : undefined,
    };
    this.lastError = normalized;
  },
  log(level = "info", code = "info", message = "", detail = null) {
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

Object.defineProperties(diagnostics, {
  issues: { enumerable: false },
  log: { enumerable: false },
  setSource: { enumerable: false },
  setLastError: { enumerable: false },
});

if (typeof window !== "undefined") {
  window.__CE_AUTH_DIAGNOSTICS = diagnostics;
}

function emitAuthStatus(status, extra = {}) {
  document.dispatchEvent(
    new CustomEvent("ce-auth:status", { detail: { status, ...extra } }),
  );
}

const enabled =
  (document.querySelector('meta[name="ce-auth"]')?.content || "on") === "on";

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
  const initialConfig = getSupabaseConfig(document, {
    logWarnings: true,
  });
  diagnostics.setSource(initialConfig.source);

  if (!initialConfig.url || !initialConfig.anon) {
    console.error('Konfiguracja Supabase: brak wymaganych danych po zastosowaniu domyślnych wartości');
    diagnostics.log('error', 'config-missing', 'Brak prawidłowych wartości supabase-url lub supabase-anon.', {
      url: initialConfig.url,
      anon: Boolean(initialConfig.anon),
    });
    document.documentElement.dataset.authError = "config-missing";
    diagnostics.setLastError({ code: "config-missing" });
    emitAuthStatus("error", { code: "config-missing" });
    setupLoginButtons(null);
    lastKnownUser = null;
    applyAuthVisibility(null);
    loginButtonUpdater(null);
    exposeAuthApi({ enabled: false, reason: 'config-missing' });
  } else {
    diagnostics.log('info', 'config-loaded', 'Załadowano konfigurację Supabase.', {
      source: initialConfig.source,
      usingDefaults: Boolean(initialConfig.usingDefaults),
    });
    if (initialConfig.usingDefaults) {
      diagnostics.log(
        'warn',
        'config-defaults',
        'Wykryto użycie domyślnych kluczy Supabase – zalecana aktualizacja konfiguracji.',
      );
    }

    async function bootstrapSupabase(config) {
      let activeConfig = config;
      let lastError = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        diagnostics.setSource(activeConfig.source);
        const client = createClient(activeConfig.url, activeConfig.anon, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          global: {
            headers: activeConfig.publishable
              ? { "x-application-name": "CyprusEye", "x-publishable-key": activeConfig.publishable }
              : { "x-application-name": "CyprusEye" },
          },
        });
        diagnostics.log('info', 'client-created', 'Zainicjowano klienta Supabase.', {
          attempt: attempt + 1,
          source: activeConfig.source,
          usingDefaults: Boolean(activeConfig.usingDefaults),
        });

        try {
          const { data, error } = await client.auth.getUser();
          if (error) {
            throw error;
          }
          delete document.documentElement.dataset.authError;
          diagnostics.setSource(activeConfig.source);
          diagnostics.setLastError(null);
          emitAuthStatus("online", { source: activeConfig.source });
          diagnostics.log('info', 'initial-user-success', 'Pomyślnie pobrano dane użytkownika podczas inicjalizacji.');
          return { client, user: data?.user || null, config: activeConfig, invalidApiKey: false };
        } catch (error) {
          lastError = error;
          diagnostics.setLastError({
            code: error?.code,
            message: error?.message,
            status: error?.status,
          });
          diagnostics.log('error', 'initial-user-failed', 'Nie udało się pobrać danych użytkownika podczas inicjalizacji.', {
            message: error?.message,
            status: error?.status,
          });
          const message = String(error?.message || '').toLowerCase();
          const isInvalidKey = message.includes('invalid api key');
          if (isInvalidKey && attempt === 0) {
            diagnostics.log('error', 'invalid-api-key', 'Supabase zwrócił błąd "Invalid API key" podczas startu.');
            const rawConfig = readSupabaseConfig(document, window);
            const refreshedConfig = getSupabaseConfig(document, { logWarnings: true });
            const changed =
              refreshedConfig.url !== activeConfig.url ||
              refreshedConfig.anon !== activeConfig.anon ||
              refreshedConfig.publishable !== activeConfig.publishable;
            diagnostics.log('info', 'config-refresh', 'Ponowne wczytanie konfiguracji Supabase po błędzie invalid-api-key.', {
              previous: {
                url: activeConfig.url,
                anon: Boolean(activeConfig.anon),
                publishable: Boolean(activeConfig.publishable),
              },
              next: {
                url: refreshedConfig.url,
                anon: Boolean(refreshedConfig.anon),
                publishable: Boolean(refreshedConfig.publishable),
              },
              source: rawConfig.source,
              changed,
            });
            diagnostics.setSource(refreshedConfig.source);
            activeConfig = refreshedConfig;
            continue;
          }
          return {
            client: null,
            user: null,
            config: activeConfig,
            error,
            invalidApiKey: isInvalidKey,
          };
        }
      }

      const invalidApiKey = String(lastError?.message || '').toLowerCase().includes('invalid api key');
      return { client: null, user: null, config: activeConfig, error: lastError, invalidApiKey };
    }

    const { client, user: initialUser, invalidApiKey } = await bootstrapSupabase(initialConfig);

    if (!client) {
      if (invalidApiKey) {
        document.documentElement.dataset.authError = 'invalid-api-key';
        diagnostics.setLastError({ code: 'invalid-api-key' });
        emitAuthStatus('error', { code: 'invalid-api-key' });
      } else {
        if (!document.documentElement.dataset.authError) {
          document.documentElement.dataset.authError = 'init-failed';
        }
        diagnostics.setLastError({ code: 'init-failed' });
        emitAuthStatus('error', { code: document.documentElement.dataset.authError });
      }
      setupLoginButtons(null);
      lastKnownUser = null;
      applyAuthVisibility(null);
      loginButtonUpdater(null);
      exposeAuthApi({
        enabled: false,
        reason: invalidApiKey ? 'invalid-api-key' : 'init-failed',
        supabase: null,
        session: async () => null,
        requireAuthOrRedirect: async () => false,
        onAuthStateChange() {
          return () => {};
        },
      });
    } else {
      supabaseClient = client;

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

      notifyAuthListeners(initialUser);

      diagnostics.setLastError(null);
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
}

export { supabaseClient as supabase };
