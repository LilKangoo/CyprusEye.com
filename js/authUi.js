import { setAria, showErr } from './authMessages.js';

const GUEST_STORAGE_KEY = 'ce_guest';

const sb = window.getSupabase();
const ceAuth = typeof window !== 'undefined' && window.CE_AUTH ? window.CE_AUTH : null;

if (ceAuth?.setSupabaseClient) {
  ceAuth.setSupabaseClient(sb || null);
} else if (ceAuth) {
  ceAuth.supabase = sb || null;
}

let booting = false;
let booted = false;
let bootPromise = null;
let authSubscription = null;
let sessionSyncPromise = null;

function isOffline() {
  try {
    if (typeof navigator === 'undefined') {
      return false;
    }
    if (!('onLine' in navigator)) {
      return false;
    }
    return navigator.onLine === false;
  } catch (error) {
    console.warn('Nie udało się odczytać stanu połączenia.', error);
    return false;
  }
}

function sanitizeAuthError(detail) {
  const raw =
    typeof detail === 'string'
      ? detail.trim()
      : typeof detail?.message === 'string'
      ? detail.message.trim()
      : '';

  if (!raw) {
    return 'Spróbuj ponownie później.';
  }

  if (/https?:\/\//i.test(raw) || /stack/i.test(raw) || raw.includes('\n')) {
    return 'Spróbuj ponownie później.';
  }

  if (raw.length > 160) {
    return `${raw.slice(0, 157)}…`;
  }

  return raw;
}

const readyFallback = () => window.CE_STATE?.session ?? null;

function setDocumentAuthState(state) {
  const root = document.documentElement;
  if (root) {
    root.dataset.authState = state;
  }
}

const withTimeout = (promise, ms = 4000) => {
  let timerId = null;
  const timeout = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      reject(new Error('AUTH_TIMEOUT'));
    }, ms);
  });
  const trackedPromise = Promise.resolve(promise);
  return Promise.race([
    trackedPromise.finally(() => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    }),
    timeout,
  ]);
};

function readGuestState() {
  try {
    const storage = window.localStorage;
    const raw = storage?.getItem ? storage.getItem(GUEST_STORAGE_KEY) : null;
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          active: Boolean(parsed.active),
          since: Number.isFinite(parsed.since) ? parsed.since : Date.now(),
        };
      }
    } catch (parseError) {
      console.warn('Nie udało się sparsować stanu trybu gościa.', parseError);
    }
  } catch (error) {
    console.warn('Nie udało się odczytać stanu trybu gościa.', error);
  }
  return null;
}

function clearGuestState() {
  try {
    const storage = window.localStorage;
    storage?.removeItem?.(GUEST_STORAGE_KEY);
  } catch (error) {
    console.warn('Nie udało się usunąć stanu trybu gościa.', error);
  }
}

function getGuestState() {
  const state = window.CE_STATE || {};
  return state.guest ?? readGuestState();
}

function showAuthSpinner(on) {
  const spinner = document.querySelector('[data-auth=spinner]');
  if (spinner) {
    spinner.classList.toggle('is-visible', !!on);
  }

  const actions = document.getElementById('auth-actions');
  if (actions instanceof HTMLElement) {
    if (on) {
      actions.dataset.state = 'loading';
      actions.setAttribute('aria-busy', 'true');
    } else {
      if (actions.dataset.state === 'loading') {
        delete actions.dataset.state;
      }
      actions.removeAttribute('aria-busy');
    }
  }

  if (on) {
    setDocumentAuthState('loading');
  }
}

function toggleVisibility(element, visible) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.hidden = !visible;
  element.classList.toggle('hidden', !visible);
  if (!visible) {
    element.setAttribute('aria-hidden', 'true');
  } else {
    element.removeAttribute('aria-hidden');
  }
}

function getDisplayNameFromState(state) {
  if (!state) {
    return '';
  }

  const profileName = typeof state.profile?.name === 'string' ? state.profile.name.trim() : '';
  if (profileName) {
    return profileName;
  }

  const user = state.session?.user || null;
  const metadata = (user && typeof user.user_metadata === 'object' && user.user_metadata) || {};
  const metadataNameCandidates = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
    metadata.username,
    metadata.preferred_username,
  ];

  for (const candidate of metadataNameCandidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  if (email) {
    return email;
  }

  return 'Gracz';
}

function syncSession(session, detail = {}) {
  const previous = sessionSyncPromise || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => applySession(session || null, detail));

  sessionSyncPromise = next.finally(() => {
    if (sessionSyncPromise === next) {
      sessionSyncPromise = null;
    }
  });

  return next;
}

async function applySession(session, detail = {}) {
  const state = (window.CE_STATE = window.CE_STATE || {});
  state.session = session || null;
  state.profile = null;
  state.guest = null;
  delete state.authError;

  if (session?.user?.id) {
    clearGuestState();
    try {
      const { data: profile, error } = await withTimeout(
        sb.from('profiles').select('id,email,name,xp,level,updated_at').single(),
        3000,
      );
      if (!error && profile) {
        state.profile = profile;
      }
    } catch (profileError) {
      console.warn('Nie udało się pobrać profilu użytkownika.', profileError);
    }
  } else {
    state.guest = readGuestState();
  }

  updateAuthUI();
  ceAuth?.updateSession?.(session, detail);
  return state.session;
}

async function handleAuthStateChange(sessionChange, detail = {}) {
  try {
    await syncSession(sessionChange || null, detail);
  } catch (error) {
    console.warn('Nie udało się zaktualizować stanu logowania po zmianie.', error);
  }
}

function ensureAuthSubscription() {
  if (authSubscription) {
    return;
  }
  try {
    const { data } = sb.auth.onAuthStateChange((event, sessionChange) => {
      handleAuthStateChange(sessionChange, { reason: 'subscription', event });
    });
    authSubscription = data?.subscription || null;
  } catch (error) {
    console.warn('Nie udało się włączyć nasłuchiwania zmian logowania.', error);
  }
}

async function loadAuthSession() {
  if (isOffline()) {
    const state = (window.CE_STATE = window.CE_STATE || {});
    state.session = null;
    state.profile = null;
    state.guest = readGuestState();
    state.authError = new Error('OFFLINE');
    showErr('Nie udało się: Brak internetu. Spróbuj ponownie.');
    updateAuthUI();
    ceAuth?.updateSession?.(null, { reason: 'load-auth-session', status: 'offline' });
    return { session: null, shouldReset: true };
  }

  try {
    const hashParams = new URLSearchParams(location.hash.slice(1));
    if (hashParams.get('access_token')) {
      history.replaceState({}, '', location.pathname);
    }
  } catch (error) {
    console.warn('Nie udało się oczyścić parametrów logowania w adresie URL.', error);
  }

  const sessionPromise = sb.auth.getSession().then((result) => result?.data?.session || null);

  const onceAuthEvent = new Promise((resolve) => {
    const { data } = sb.auth.onAuthStateChange((_event, sessionChange) => {
      try {
        data?.subscription?.unsubscribe();
      } catch (error) {
        console.warn('Nie udało się odpiąć nasłuchiwania zdarzeń logowania.', error);
      }
      resolve(sessionChange || null);
    });
    window.setTimeout(() => {
      try {
        data?.subscription?.unsubscribe();
      } catch (error) {
        console.warn('Nie udało się awaryjnie odpiąć nasłuchiwania zdarzeń logowania.', error);
      }
      resolve(null);
    }, 1500);
  });

  const session = await withTimeout(Promise.race([sessionPromise, onceAuthEvent]));
  await syncSession(session, { reason: 'load-auth-session', status: 'ok' });
  return { session, shouldReset: false };
}

export function bootAuth() {
  if (bootPromise) {
    return bootPromise;
  }

  ensureAuthSubscription();
  booting = true;
  showAuthSpinner(true);

  bootPromise = (async () => {
    let shouldReset = false;
    try {
      const { session, shouldReset: resetBoot } = await loadAuthSession();
      if (resetBoot) {
        shouldReset = true;
      }
      return session;
    } catch (error) {
      const offline = isOffline();
      const state = (window.CE_STATE = window.CE_STATE || {});
      state.authError = error;
      const message = offline
        ? 'Brak internetu. Spróbuj ponownie.'
        : error?.message === 'AUTH_TIMEOUT'
        ? 'Problem z połączeniem logowania.'
        : sanitizeAuthError(error);
      showErr(`Nie udało się: ${message}`);
      updateAuthUI();
      shouldReset = true;
      throw error;
    } finally {
      showAuthSpinner(false);
      booting = false;
      if (shouldReset || isOffline()) {
        booted = false;
        bootPromise = null;
      } else {
        booted = true;
      }
    }
  })();

  return bootPromise;
}

export function waitForAuthReady() {
  if (bootPromise) {
    return bootPromise;
  }
  if (booted && !booting) {
    return Promise.resolve(readyFallback());
  }
  return bootAuth();
}

export function updateAuthUI() {
  const state = window.CE_STATE || {};
  const isLogged = !!state.session;
  const guestState = getGuestState();
  const isGuest = !isLogged && !!guestState?.active;
  const documentState = isLogged ? 'authenticated' : 'guest';

  setDocumentAuthState(documentState);

  const updateGroupVisibility = (selector, visible) => {
    document.querySelectorAll(selector).forEach((element) => {
      toggleVisibility(element, visible);
    });
  };

  updateGroupVisibility('[data-auth=login]', !isLogged);
  updateGroupVisibility('[data-auth=guest]', isGuest);
  updateGroupVisibility('[data-auth=logout]', isLogged);
  updateGroupVisibility('[data-auth=user-only]', isLogged);
  updateGroupVisibility('[data-auth=guest-only]', isGuest);
  updateGroupVisibility('[data-auth=anon-only]', !isLogged && !isGuest);

  const displayName = isLogged ? getDisplayNameFromState(state) : '';
  document.querySelectorAll('[data-auth=user-name]').forEach((element) => {
    if (element instanceof HTMLElement) {
      element.textContent = displayName;
    }
  });

  const actions = document.getElementById('auth-actions');
  if (actions instanceof HTMLElement) {
    const actionsState = isLogged ? 'authenticated' : isGuest ? 'guest' : 'anonymous';
    actions.dataset.state = actionsState;
    if (actionsState !== 'loading') {
      actions.removeAttribute('aria-busy');
    }
    actions.classList.toggle('is-authenticated', isLogged);
    actions.classList.toggle('is-guest', isGuest && !isLogged);
    if (!isLogged && !isGuest) {
      actions.classList.remove('is-authenticated', 'is-guest');
    }
  }

  document.querySelectorAll('[data-gated=true]').forEach((element) => {
    toggleVisibility(element, isLogged);
  });

  document.querySelectorAll('[data-auth-guest-note]').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const shouldShow = isGuest && !isLogged;
    toggleVisibility(element, shouldShow);
    if (shouldShow) {
      element.textContent = 'Grasz jako gość — postęp zapisany lokalnie na tym urządzeniu.';
    }
  });
}

function clearAuthMessage() {
  setAria('');
}

function setupAuthTabs() {
  const tabButtons = Array.from(document.querySelectorAll('[data-auth-tab]'));
  if (!tabButtons.length) {
    return;
  }

  const panels = new Map();
  tabButtons.forEach((button) => {
    const tabId = button.dataset.authTab || '';
    if (!tabId) {
      return;
    }
    const panel = document.querySelector(`[data-auth-panel="${tabId}"]`);
    panels.set(tabId, panel instanceof HTMLElement ? panel : null);
  });

  let activeTab =
    tabButtons.find((button) => button.classList.contains('is-active'))?.dataset.authTab ||
    tabButtons[0]?.dataset.authTab ||
    null;

  const activate = (tabId, { focus = false } = {}) => {
    if (!tabId || !panels.has(tabId)) {
      const fallback = tabButtons[0]?.dataset.authTab || null;
      if (!fallback) {
        return;
      }
      tabId = fallback;
    }

    activeTab = tabId;

    tabButtons.forEach((button) => {
      const isActive = button.dataset.authTab === tabId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
      if (isActive && focus) {
        button.focus();
      }
    });

    panels.forEach((panel, id) => {
      if (!panel) {
        return;
      }
      const isActive = id === tabId;
      panel.classList.toggle('is-active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    clearAuthMessage();
  };

  const focusByOffset = (offset) => {
    if (!tabButtons.length) {
      return;
    }
    const currentIndex = tabButtons.findIndex((button) => button.dataset.authTab === activeTab);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (baseIndex + offset + tabButtons.length) % tabButtons.length;
    const nextTab = tabButtons[nextIndex]?.dataset.authTab || '';
    if (nextTab) {
      activate(nextTab, { focus: true });
    }
  };

  tabButtons.forEach((button) => {
    if (button.dataset.authTabReady === 'true') {
      return;
    }
    button.dataset.authTabReady = 'true';

    button.addEventListener('click', () => {
      const tabId = button.dataset.authTab || '';
      if (tabId) {
        activate(tabId);
      }
    });

    button.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          focusByOffset(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          focusByOffset(1);
          break;
        case 'Home':
          event.preventDefault();
          if (tabButtons[0]?.dataset.authTab) {
            activate(tabButtons[0].dataset.authTab, { focus: true });
          }
          break;
        case 'End':
          event.preventDefault();
          if (tabButtons[tabButtons.length - 1]?.dataset.authTab) {
            activate(tabButtons[tabButtons.length - 1].dataset.authTab, { focus: true });
          }
          break;
        default:
          break;
      }
    });
  });

  if (activeTab) {
    activate(activeTab);
  }
}

function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

onReady(() => {
  setupAuthTabs();
});

document.querySelectorAll('[data-auth=logout]').forEach((el) => {
  if (!(el instanceof HTMLElement) || el.dataset.authLogoutReady === 'true') {
    return;
  }
  el.dataset.authLogoutReady = 'true';
  el.addEventListener('click', async () => {
    await sb.auth.signOut();
    clearGuestState();
    window.CE_STATE = {};
    updateAuthUI();
    const redirectTarget = el.dataset.authRedirect || '/';
    if (redirectTarget) {
      location.assign(redirectTarget);
    }
  });
});

if (typeof window !== 'undefined') {
  window.bootAuth = bootAuth;
  window.updateAuthUI = updateAuthUI;
}
