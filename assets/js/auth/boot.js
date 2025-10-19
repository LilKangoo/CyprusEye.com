import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enabled = (document.querySelector('meta[name="ce-auth"]')?.content || 'on') === 'on';

const AUTH_PAGE_PATH = '/auth/';
const loginButtonSelectors = ['#loginBtn', '[data-login-button]'];
let loginButtonUpdater = () => {};
let lastKnownUser = null;

function getMeta(name) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  return meta ? meta.content.trim() : "";
}

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
  window.CE_AUTH = api;
  document.dispatchEvent(new CustomEvent('ce-auth-ready', { detail: api }));
}

let supabaseClient = null;

if (!enabled) {
  setupLoginButtons(null);
  lastKnownUser = null;
  applyAuthVisibility(null);
  loginButtonUpdater(null);
  exposeAuthApi({ enabled: false });
} else {
  const SUPABASE_URL = getMeta("supabase-url");
  const SUPABASE_ANON = getMeta("supabase-anon");
  const SUPABASE_PUB = getMeta("supabase-publishable");

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)) {
    console.error("Konfiguracja Supabase: nieprawidłowy URL");
    setupLoginButtons(null);
    lastKnownUser = null;
    applyAuthVisibility(null);
    loginButtonUpdater(null);
    exposeAuthApi({ enabled: false });
  } else if (!SUPABASE_ANON || SUPABASE_ANON.split(".").length !== 3) {
    console.error("Konfiguracja Supabase: brak lub zły anon key");
    setupLoginButtons(null);
    lastKnownUser = null;
    applyAuthVisibility(null);
    loginButtonUpdater(null);
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

    setupLoginButtons(supabaseClient);

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
      lastKnownUser = user;
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
