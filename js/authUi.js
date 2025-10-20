import { sb } from './supabaseClient.js';

const GUEST_STORAGE_KEY = 'ce_guest';

let booting = false;
let booted = false;
let bootPromise = null;
let toastTimer = null;

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

function ensureToastElement() {
  let el = document.querySelector('[data-auth=toast]');
  if (!el) {
    el = document.createElement('div');
    el.dataset.auth = 'toast';
    el.className = 'auth-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    const parent = document.body || document.documentElement;
    if (parent) {
      parent.appendChild(el);
    } else {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          const fallbackParent = document.body || document.documentElement;
          fallbackParent?.appendChild(el);
        },
        { once: true },
      );
    }
  }
  return el;
}

function showAuthSpinner(on) {
  const spinner = document.querySelector('[data-auth=spinner]');
  if (spinner) {
    spinner.classList.toggle('is-visible', !!on);
  }
  if (on) {
    setDocumentAuthState('loading');
    const badge = document.querySelector('#auth-state');
    if (badge) {
      badge.dataset.state = 'loading';
      badge.textContent = 'Łączenie…';
    }
  }
}

function showAuthToast(message, type = 'info') {
  if (!message) {
    return;
  }

  const el = ensureToastElement();
  el.textContent = message;
  el.dataset.tone = type;
  el.classList.add('is-visible');
  if (type === 'error') {
    el.classList.add('is-error');
    el.setAttribute('aria-live', 'assertive');
  } else {
    el.classList.remove('is-error');
    el.setAttribute('aria-live', 'polite');
  }

  if (toastTimer) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }

  toastTimer = window.setTimeout(() => {
    el.classList.remove('is-visible');
    el.removeAttribute('data-tone');
    el.textContent = '';
    toastTimer = null;
  }, 5000);
}

function withBusy(button, fn) {
  if (typeof fn !== 'function') {
    return Promise.resolve();
  }

  return (async () => {
    const isButton = button instanceof HTMLButtonElement;
    if (isButton) {
      if (button.disabled) {
        return;
      }
      button.disabled = true;
    }

    try {
      return await fn();
    } finally {
      if (isButton) {
        button.disabled = false;
      }
    }
  })();
}

function ensureOnlineOrThrow() {
  if (isOffline()) {
    throw new Error('Brak internetu. Spróbuj ponownie.');
  }
}

export function bootAuth() {
  if (bootPromise) {
    return bootPromise;
  }

  booting = true;
  showAuthSpinner(true);

  bootPromise = (async () => {
    let shouldReset = false;
    try {
      if (isOffline()) {
        const state = (window.CE_STATE = window.CE_STATE || {});
        state.session = null;
        state.profile = null;
        state.guest = readGuestState();
        state.authError = new Error('OFFLINE');
        showAuthToast('Brak internetu. Spróbuj ponownie.', 'error');
        updateAuthUI();
        shouldReset = true;
        return null;
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
      const state = (window.CE_STATE = window.CE_STATE || {});
      state.session = session;
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
      return session;
    } catch (error) {
      const offline = isOffline();
      const state = (window.CE_STATE = window.CE_STATE || {});
      state.authError = error;
      showAuthToast(
        offline
          ? 'Brak internetu. Spróbuj ponownie.'
          : error?.message === 'AUTH_TIMEOUT'
          ? 'Problem z połączeniem logowania.'
          : `Błąd logowania: ${error?.message || error}`,
        'error',
      );
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
  const session = state.session || null;
  const guestState = getGuestState();
  const isLogged = !!session;
  const isGuest = !isLogged && !!guestState?.active;

  document.querySelectorAll('[data-auth=login]').forEach((el) => {
    el.hidden = isLogged || isGuest;
  });
  document.querySelectorAll('[data-auth=logout]').forEach((el) => {
    el.hidden = !(isLogged || isGuest);
  });

  const badge = document.querySelector('#auth-state');
  if (badge) {
    badge.textContent = isLogged ? 'Zalogowany' : isGuest ? 'Gość' : 'Niezalogowany';
    badge.dataset.state = isLogged ? 'authenticated' : isGuest ? 'guest' : 'guest';
  }

  setDocumentAuthState(isLogged ? 'authenticated' : isGuest ? 'guest' : 'guest');

  document.querySelectorAll('[data-gated=true]').forEach((el) => {
    el.hidden = !isLogged;
  });

  document.querySelectorAll('[data-auth-guest-note]').forEach((el) => {
    if (isGuest) {
      el.hidden = false;
      el.textContent = 'Grasz jako gość — postęp zapisany lokalnie na tym urządzeniu.';
    } else {
      el.hidden = true;
    }
  });
}

document.querySelectorAll('[data-auth=logout]').forEach((el) =>
  el.addEventListener('click', async () => {
    await sb.auth.signOut();
    clearGuestState();
    window.CE_STATE = {};
    updateAuthUI();
    location.assign('/');
  }),
);

const loginForm = document.querySelector('#form-login');
if (loginForm instanceof HTMLFormElement) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const submitter =
      event.submitter instanceof HTMLButtonElement
        ? event.submitter
        : loginForm.querySelector('button[type="submit"]');

    withBusy(submitter, async () => {
      ensureOnlineOrThrow();

      const email = loginForm.email?.value?.trim();
      const password = loginForm.password?.value;

      if (!email || !password) {
        throw new Error('Podaj adres e-mail i hasło.');
      }

      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      await bootAuth();
      location.assign('/');
    }).catch((error) => {
      showAuthToast(error?.message || 'Błąd logowania', 'error');
    });
  });
}

const registerForm = document.querySelector('#form-register');
if (registerForm instanceof HTMLFormElement) {
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const submitter =
      event.submitter instanceof HTMLButtonElement
        ? event.submitter
        : registerForm.querySelector('button[type="submit"]');

    withBusy(submitter, async () => {
      ensureOnlineOrThrow();

      const firstName = registerForm.firstName?.value?.trim();
      const email = registerForm.email?.value?.trim();
      const password = registerForm.password?.value;
      const passwordConfirm = registerForm.passwordConfirm?.value;

      if (!email || !password) {
        throw new Error('Podaj adres e-mail i hasło.');
      }

      if (password !== passwordConfirm) {
        throw new Error('Hasła nie są takie same.');
      }

      const { error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: firstName || undefined,
          },
        },
      });

      if (error) {
        throw error;
      }

      showAuthToast('Sprawdź skrzynkę e-mail, aby potwierdzić konto.', 'info');
      await bootAuth();
    }).catch((error) => {
      showAuthToast(error?.message || 'Błąd rejestracji', 'error');
    });
  });
}
