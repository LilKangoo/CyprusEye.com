import { waitForAuthReady, updateAuthUI } from '/js/authUi.js';

const GUEST_STORAGE_KEY = 'ce_guest';
const DEFAULT_LOGIN_TARGET = '/auth/';
const DEFAULT_GUEST_TARGET = '/';

function readGuestState() {
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        active: Boolean(parsed.active),
        since: Number.isFinite(parsed.since) ? parsed.since : Date.now(),
      };
    }
  } catch (error) {
    console.warn('[auth-ui] Nie udało się odczytać trybu gościa.', error);
  }
  return null;
}

function persistGuestState(state) {
  try {
    if (state) {
      window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[auth-ui] Nie udało się zapisać trybu gościa.', error);
  }
}

function applyUi() {
  try {
    updateAuthUI();
  } catch (error) {
    console.warn('[auth-ui] Nie udało się odświeżyć UI logowania.', error);
  }
}

function getRedirectTarget(element, fallback) {
  if (!element || typeof element !== 'object') {
    return fallback;
  }
  const dataset = 'dataset' in element ? element.dataset : undefined;
  const target = dataset?.authRedirect || dataset?.authUrl || dataset?.authTarget;
  if (typeof target === 'string' && target.trim()) {
    return target.trim();
  }
  return fallback;
}

function activateGuestMode(redirectTarget) {
  const guestState = { active: true, since: Date.now() };
  persistGuestState(guestState);
  const state = (window.CE_STATE = window.CE_STATE || {});
  state.session = null;
  state.profile = null;
  state.guest = guestState;
  state.status = 'guest';
  applyUi();
  try {
    document.dispatchEvent(new CustomEvent('ce-auth:state', { detail: { ...state } }));
  } catch (error) {
    console.warn('[auth-ui] Nie udało się wysłać zdarzenia stanu logowania.', error);
  }
  if (redirectTarget) {
    window.location.assign(redirectTarget);
  }
}

function isLoginActionElement(element) {
  if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement) {
    return true;
  }
  if (element instanceof HTMLElement) {
    const role = element.getAttribute('role');
    if (typeof role === 'string' && role.toLowerCase() === 'button') {
      return true;
    }
  }
  return false;
}

function setupLoginButtons() {
  document.querySelectorAll('[data-auth="login"]').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    if (element.dataset.authLoginReady === 'true' || element.dataset.authLoginStatic === 'true') {
      return;
    }
    if (!isLoginActionElement(element)) {
      return;
    }

    element.dataset.authLoginReady = 'true';
    element.addEventListener('click', (event) => {
      if (event) {
        event.preventDefault();
      }
      const target = getRedirectTarget(element, DEFAULT_LOGIN_TARGET);
      if (target) {
        window.location.assign(target);
      }
    });
  });
}

function setupGuestButtons() {
  document.querySelectorAll('[data-auth="guest"]').forEach((element) => {
    if (!(element instanceof HTMLElement) || element.dataset.authGuestReady === 'true') {
      return;
    }
    element.dataset.authGuestReady = 'true';
    element.addEventListener('click', (event) => {
      if (event) {
        event.preventDefault();
      }
      const target = getRedirectTarget(element, DEFAULT_GUEST_TARGET);
      activateGuestMode(target);
    });
  });
}

function setupLogoutButtons() {
  document.querySelectorAll('[data-auth="logout"]').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const target = getRedirectTarget(element, DEFAULT_GUEST_TARGET);
    if (!element.dataset.authRedirect && target) {
      element.dataset.authRedirect = target;
    }
  });
}

function observeAuthChanges() {
  document.addEventListener('ce-auth:state', applyUi);
  window.addEventListener('storage', (event) => {
    if (event.key === GUEST_STORAGE_KEY) {
      const state = (window.CE_STATE = window.CE_STATE || {});
      state.guest = readGuestState();
      applyUi();
    }
  });
}

setupLoginButtons();
setupGuestButtons();
setupLogoutButtons();
observeAuthChanges();

waitForAuthReady()
  .catch((error) => {
    console.warn('[auth-ui] Nie udało się zainicjalizować modułu auth.', error);
  })
  .finally(() => {
    applyUi();
  });

applyUi();
