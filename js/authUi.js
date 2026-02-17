import { setAria, showErr } from './authMessages.js';
import { loadProfileForUser } from './profile.js';
import { getStoredReferralCode, processReferralAfterRegistration } from './referral.js';

// Guest mode removed

function detectUiLanguage() {
  const forced = (document.body?.dataset?.forceLanguage || '').toLowerCase();
  if (forced) return forced;

  const docLang = (document.documentElement?.lang || '').toLowerCase();
  if (docLang) return docLang;

  const navLang = (navigator.language || '').toLowerCase();
  if (navLang) return navLang;

  return 'en';
}

function t(en, pl) {
  const lang = detectUiLanguage();
  return lang.startsWith('pl') ? pl : en;
}

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
    return t('Please try again later.', 'Spróbuj ponownie później.');
  }

  if (/https?:\/\//i.test(raw) || /stack/i.test(raw) || raw.includes('\n')) {
    return t('Please try again later.', 'Spróbuj ponownie później.');
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

function closeAuthModalIfOpen({ restoreFocus = true } = {}) {
  const controller = window.__authModalController;
  if (controller && typeof controller.isOpen === 'function' && controller.isOpen()) {
    try {
      controller.close({ restoreFocus });
    } catch (error) {
      console.warn('[auth-ui] Nie udało się zamknąć okna logowania.', error);
    }
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

async function loadProfileWithRetry(user) {
  if (!user?.id) {
    return null;
  }

  try {
    return await withTimeout(loadProfileForUser(user), 7000);
  } catch (error) {
    if (error?.message !== 'AUTH_TIMEOUT') {
      throw error;
    }
  }

  try {
    return await withTimeout(loadProfileForUser(user), 12000);
  } catch (error) {
    if (error?.message !== 'AUTH_TIMEOUT') {
      throw error;
    }
  }

  return null;
}

// Guest mode removed - function no longer needed

// Guest mode removed - function no longer needed

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

const AUTH_CONFIRMATION_TEMPLATE = `
  <div class="auth-confirmation__badge" aria-hidden="true">✅</div>
  <h2 class="auth-confirmation__title" data-i18n="auth.confirmation.title">${t('Signed in successfully!', 'Zalogowano pomyślnie!')}</h2>
  <p class="auth-confirmation__user">
    <span data-i18n="auth.confirmation.userLabel">${t('Signed in as', 'Zalogowany jako')}</span>
    <strong data-auth="user-name"></strong>
  </p>
  <p class="auth-confirmation__message" data-i18n="auth.confirmation.info">
    ${t('You can now use all features of WakacjeCypr Quest.', 'Możesz teraz korzystać z wszystkich funkcji WakacjeCypr Quest.')}
  </p>
  <p class="auth-confirmation__hint" data-i18n="auth.confirmation.dismissHint">
    ${t('Click anywhere to dismiss this message.', 'Kliknij gdziekolwiek, aby zamknąć to powiadomienie.')}
  </p>
`;

const AUTH_SUCCESS_OVERLAY_TEMPLATE = `
  <div
    class="auth-success-overlay__inner"
    role="alertdialog"
    aria-modal="true"
    aria-live="assertive"
    tabindex="-1"
    data-auth-success-focus
  >
    <div class="auth-success-overlay__badge" aria-hidden="true">✅</div>
    <h2 class="auth-success-overlay__title" data-i18n="auth.confirmation.title">
      ${t('Signed in successfully!', 'Zalogowano pomyślnie!')}
    </h2>
    <p class="auth-success-overlay__user">
      <span data-i18n="auth.confirmation.userLabel">${t('Signed in as', 'Zalogowany jako')}</span>
      <strong data-auth-success-name></strong>
    </p>
    <p class="auth-success-overlay__message" data-i18n="auth.confirmation.info">
      ${t('You can now use all features of WakacjeCypr Quest.', 'Możesz teraz korzystać z wszystkich funkcji WakacjeCypr Quest.')}
    </p>
    <p class="auth-success-overlay__hint" data-i18n="auth.confirmation.dismissHint">
      ${t('Click anywhere to dismiss this message.', 'Kliknij gdziekolwiek, aby zamknąć to powiadomienie.')}
    </p>
  </div>
`;

function applyAuthConfirmationTranslations(element) {
  const i18n = window.appI18n;
  const language = i18n?.language;
  if (!i18n || typeof i18n.setLanguage !== 'function' || !language) {
    return;
  }
  try {
    i18n.setLanguage(language, { persist: false, updateUrl: false });
  } catch (error) {
    console.warn('[auth-ui] Nie udało się odświeżyć tłumaczeń sekcji potwierdzenia.', error);
  }
}

function createAuthConfirmationElement(doc = document) {
  const section = doc.createElement('section');
  section.className = 'auth-confirmation';
  section.dataset.authConfirmation = 'true';
  section.dataset.auth = 'user-only';
  section.setAttribute('hidden', '');
  section.innerHTML = AUTH_CONFIRMATION_TEMPLATE.trim();
  return section;
}

function ensureAuthConfirmation(root) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  let confirmation = root.querySelector('[data-auth-confirmation]');
  if (!confirmation) {
    confirmation = createAuthConfirmationElement(root.ownerDocument || document);
    root.prepend(confirmation);
    applyAuthConfirmationTranslations(confirmation);
  }
  return confirmation;
}

let authSuccessOverlay = null;
let authSuccessPreviousFocus = null;
let authSuccessKeydownHandler = null;

function ensureAuthSuccessOverlay(doc = document) {
  if (authSuccessOverlay instanceof HTMLElement && authSuccessOverlay.isConnected) {
    return authSuccessOverlay;
  }

  const ownerDocument = doc instanceof Document ? doc : document;
  if (!ownerDocument?.body) {
    return authSuccessOverlay instanceof HTMLElement ? authSuccessOverlay : null;
  }

  const existing = ownerDocument.querySelector('[data-auth-success-overlay]');
  if (existing instanceof HTMLElement) {
    authSuccessOverlay = existing;
    return authSuccessOverlay;
  }

  const overlay = ownerDocument.createElement('div');
  overlay.className = 'auth-success-overlay';
  overlay.dataset.authSuccessOverlay = 'true';
  overlay.setAttribute('hidden', '');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = AUTH_SUCCESS_OVERLAY_TEMPLATE.trim();

  overlay.addEventListener('click', () => {
    hideAuthSuccessOverlay();
  });

  ownerDocument.body.append(overlay);
  applyAuthConfirmationTranslations(overlay);

  authSuccessOverlay = overlay;
  return authSuccessOverlay;
}

function updateAuthSuccessOverlayUser(state = window.CE_STATE || {}) {
  const overlay = ensureAuthSuccessOverlay();
  if (!(overlay instanceof HTMLElement)) {
    return;
  }

  const nameElement = overlay.querySelector('[data-auth-success-name]');
  if (!(nameElement instanceof HTMLElement)) {
    return;
  }

  const name = getDisplayNameFromState(state);
  nameElement.textContent = name;
}

function hideAuthSuccessOverlay({ restoreFocus = true } = {}) {
  const overlay = ensureAuthSuccessOverlay();
  if (!(overlay instanceof HTMLElement)) {
    return;
  }

  overlay.classList.remove('is-visible');
  overlay.dataset.visible = 'false';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('hidden', '');

  closeAuthModalIfOpen({ restoreFocus });

  if (authSuccessKeydownHandler) {
    document.removeEventListener('keydown', authSuccessKeydownHandler, true);
    authSuccessKeydownHandler = null;
  }

  if (restoreFocus && authSuccessPreviousFocus instanceof HTMLElement) {
    try {
      authSuccessPreviousFocus.focus({ preventScroll: true });
    } catch {
      // ignore focus errors
    }
  }

  authSuccessPreviousFocus = null;
}

function showAuthSuccessOverlay(state = window.CE_STATE || {}) {
  const overlay = ensureAuthSuccessOverlay();
  if (!(overlay instanceof HTMLElement)) {
    return null;
  }

  updateAuthSuccessOverlayUser(state);

  authSuccessPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('is-visible');
  overlay.dataset.visible = 'true';

  const focusTarget = overlay.querySelector('[data-auth-success-focus]');
  if (focusTarget instanceof HTMLElement) {
    window.setTimeout(() => {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        // ignore focus errors
      }
    }, 0);
  }

  const handleKeydown = (event) => {
    if (!overlay.classList.contains('is-visible')) {
      return;
    }
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      hideAuthSuccessOverlay();
    }
  };

  if (authSuccessKeydownHandler) {
    document.removeEventListener('keydown', authSuccessKeydownHandler, true);
  }

  authSuccessKeydownHandler = handleKeydown;
  document.addEventListener('keydown', authSuccessKeydownHandler, true);

  return overlay;
}

function syncConfirmationLink(element, state, fallback = '/') {
  if (!(element instanceof HTMLElement)) {
    return fallback;
  }
  const dataset = element.dataset || {};
  if (!dataset.authRedirectBase) {
    const datasetTarget = typeof dataset.authRedirect === 'string' ? dataset.authRedirect.trim() : '';
    const hrefTarget =
      element instanceof HTMLAnchorElement ? (element.getAttribute('href') || '').trim() : '';
    dataset.authRedirectBase = datasetTarget || hrefTarget || fallback;
  }
  const baseTarget = dataset.authRedirectBase || fallback;
  const mode = dataset.authRedirectMode || '';
  const stateTarget =
    typeof state.postAuthRedirect === 'string' && state.postAuthRedirect.trim()
      ? state.postAuthRedirect.trim()
      : '';
  const resolved = mode === 'static' ? baseTarget : stateTarget || baseTarget || fallback;
  dataset.authRedirectResolved = resolved;
  if (element instanceof HTMLAnchorElement) {
    element.setAttribute('href', resolved);
  } else {
    dataset.authRedirect = resolved;
  }
  return resolved;
}

function getResolvedConfirmationTarget(element, state) {
  const target = syncConfirmationLink(element, state, '/');
  return target && typeof target === 'string' ? target : '/';
}

function findConfirmationTrigger(event) {
  if (!event) {
    return null;
  }

  const directTarget = event.target;
  if (directTarget instanceof HTMLElement) {
    const closest = directTarget.closest('[data-auth-confirmation-link]');
    if (closest instanceof HTMLElement) {
      return closest;
    }
  }

  if (typeof event.composedPath === 'function') {
    const path = event.composedPath();
    for (const node of path) {
      if (node instanceof HTMLElement && node.matches('[data-auth-confirmation-link]')) {
        return node;
      }
    }
  }

  return null;
}

function navigateToAuthRedirect(target) {
  const destination = typeof target === 'string' && target.trim() ? target.trim() : '';
  if (!destination) {
    return;
  }

  const performNavigation = () => {
    try {
      window.location.assign(destination);
    } catch {
      try {
        window.location.href = destination;
      } catch (hrefError) {
        console.warn('[auth-ui] Nie udało się przejść do strony po zalogowaniu.', hrefError);
      }
    }
  };

  window.setTimeout(performNavigation, 0);
}

function shouldBypassConfirmationNavigation(event, trigger) {
  if (!(trigger instanceof HTMLElement)) {
    return true;
  }

  if (!(event instanceof MouseEvent)) {
    return false;
  }

  if (event.button !== 0) {
    return true;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return true;
  }

  return false;
}

function handleConfirmationClick(event) {
  const trigger = findConfirmationTrigger(event);
  if (!(trigger instanceof HTMLElement)) {
    return;
  }

  const state = window.CE_STATE || {};
  const redirectTarget = getResolvedConfirmationTarget(trigger, state);

  const bypassNavigation = shouldBypassConfirmationNavigation(event, trigger);

  if (!bypassNavigation) {
    if (trigger instanceof HTMLAnchorElement) {
      event.preventDefault();
    }
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    } else {
      event.stopPropagation();
    }
  }

  closeAuthModalIfOpen({ restoreFocus: true });

  if (!bypassNavigation) {
    navigateToAuthRedirect(redirectTarget);
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
  delete state.authError;

  updateAuthUI();
  ceAuth?.updateSession?.(session, detail);

  if (session?.user?.id) {
    try {
      const profile = await loadProfileWithRetry(session.user);
      state.profile = profile || null;
    } catch (profileError) {
      console.warn('Nie udało się pobrać profilu użytkownika.', profileError);
    }

    updateAuthUI();
  }
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

      if (event === 'SIGNED_IN') {
        try {
          const provider = String(sessionChange?.user?.app_metadata?.provider || '').trim().toLowerCase();
          const providers = Array.isArray(sessionChange?.user?.app_metadata?.providers)
            ? sessionChange.user.app_metadata.providers
            : [];
          const isGoogleUser =
            provider === 'google' ||
            providers.some((entry) => String(entry || '').trim().toLowerCase() === 'google');
          if (isGoogleUser) {
            return;
          }

          const referralCode = getStoredReferralCode();
          const userId = sessionChange?.user?.id;
          if (referralCode && userId) {
            void processReferralAfterRegistration(userId);
          }
        } catch (_e) {
        }
      }
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
    state.authError = new Error('OFFLINE');
    showErr(
      `${t('Failed', 'Nie udało się')}: ${t('No internet connection. Please try again.', 'Brak internetu. Spróbuj ponownie.')}`,
    );
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

  // KRYTYCZNE: Najpierw sprawdź custom storage przed Supabase
  const ceAuthGlobal = window.CE_AUTH || {};
  let persistedSnapshot = null;
  try {
    if (typeof ceAuthGlobal.readPersistedSession === 'function') {
      persistedSnapshot = ceAuthGlobal.readPersistedSession();
      if (persistedSnapshot?.session && typeof ceAuthGlobal.applyPersistedSession === 'function') {
        ceAuthGlobal.applyPersistedSession(persistedSnapshot, { emitEvent: false });
        console.log('[auth-ui] Przywrócono sesję z custom storage');
      }
    }
  } catch (error) {
    console.warn('Nie udało się przywrócić sesji z custom storage:', error);
  }

  try {
    const snapshotSession = persistedSnapshot?.session;
    const token = typeof snapshotSession?.access_token === 'string' ? snapshotSession.access_token.trim() : '';
    const refresh = typeof snapshotSession?.refresh_token === 'string' ? snapshotSession.refresh_token.trim() : '';
    if (token && refresh) {
      const { data: currentSessionData } = await sb.auth.getSession();
      if (!currentSessionData?.session) {
        const { data: setData } = await sb.auth.setSession({ access_token: token, refresh_token: refresh });
        if (setData?.session) {
          persistedSnapshot = { ...(persistedSnapshot || {}), session: setData.session };
        }
      }
    }
  } catch (error) {
    console.warn('[auth-ui] Nie udało się zsynchronizować sesji Supabase z custom storage:', error);
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

  let session = null;
  try {
    session = await withTimeout(Promise.race([sessionPromise, onceAuthEvent]));
  } catch (error) {
    if (error?.message === 'AUTH_TIMEOUT') {
      session = null;
    } else {
      throw error;
    }
  }
  
  // Jeśli znaleźliśmy sesję, użyj jej; jeśli nie, użyj persisted snapshot
  const finalSession = session || persistedSnapshot?.session || null;
  
  await syncSession(finalSession, { reason: 'load-auth-session', status: 'ok' });
  return { session: finalSession, shouldReset: false };
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
        ? t('No internet connection. Please try again.', 'Brak internetu. Spróbuj ponownie.')
        : error?.message === 'AUTH_TIMEOUT'
        ? t('Sign-in connection problem.', 'Problem z połączeniem logowania.')
        : sanitizeAuthError(error);
      showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
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
  const isGuest = !!state.guest?.active && !isLogged;
  const documentState = isLogged ? 'authenticated' : isGuest ? 'guest' : 'anonymous';

  if (isLogged) {
    updateAuthSuccessOverlayUser(state);
  } else {
    hideAuthSuccessOverlay({ restoreFocus: false });
  }

  setDocumentAuthState(documentState);

  if (!isLogged && state.postAuthRedirect) {
    delete state.postAuthRedirect;
  }

  document.querySelectorAll('[data-auth-view-root]').forEach((root) => {
    if (!(root instanceof HTMLElement)) {
      return;
    }
    ensureAuthConfirmation(root);
    if (isLogged) {
      root.classList.add('auth-modal__content--signed-in');
    } else {
      root.classList.remove('auth-modal__content--signed-in');
    }
  });

  const updateGroupVisibility = (selector, visible) => {
    document.querySelectorAll(selector).forEach((element) => {
      toggleVisibility(element, visible);
    });
  };

  updateGroupVisibility('[data-auth=login]', !isLogged);
  updateGroupVisibility('[data-auth=logout]', isLogged);
  updateGroupVisibility('[data-auth=user-only]', isLogged);
  updateGroupVisibility('[data-auth=anon-only]', !isLogged);
  updateGroupVisibility('[data-auth=guest-only]', isGuest);

  const displayName = isLogged ? getDisplayNameFromState(state) : '';
  document.querySelectorAll('[data-auth=user-name]').forEach((element) => {
    if (element instanceof HTMLElement) {
      element.textContent = displayName;
    }
  });

  const actions = document.getElementById('auth-actions');
  if (actions instanceof HTMLElement) {
    const actionsState = isLogged ? 'authenticated' : 'anonymous';
    actions.dataset.state = actionsState;
    if (actionsState !== 'loading') {
      actions.removeAttribute('aria-busy');
    }
    actions.classList.toggle('is-authenticated', isLogged);
  }

  document.querySelectorAll('[data-gated=true]').forEach((element) => {
    toggleVisibility(element, isLogged);
  });

  // Guest notes removed

  document.querySelectorAll('[data-auth-confirmation-link]').forEach((element) => {
    syncConfirmationLink(element, state, '/');
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

document.addEventListener('click', handleConfirmationClick, { capture: true });

document.addEventListener('ce-auth:post-login', () => {
  const overlay = showAuthSuccessOverlay();
  if (overlay instanceof HTMLElement) {
    return;
  }

  window.setTimeout(() => {
    const primary = document.querySelector('[data-auth-confirmation-link]');
    if (primary instanceof HTMLElement && typeof primary.focus === 'function') {
      try {
        primary.focus({ preventScroll: false });
      } catch {
        // ignore focus errors
      }
    }
  }, 0);
});

document.querySelectorAll('[data-auth=logout]').forEach((el) => {
  if (!(el instanceof HTMLElement) || el.dataset.authLogoutReady === 'true') {
    return;
  }
  el.dataset.authLogoutReady = 'true';
  el.addEventListener('click', async () => {
    await sb.auth.signOut();
    ceAuth?.persistSession?.(null);
    try {
      window.localStorage.removeItem('ce_guest');
    } catch {
      // ignore
    }
    window.CE_STATE = {};
    updateAuthUI();
    
    // Check if we should redirect
    const redirectTarget = el.dataset.authRedirect;
    
    // If data-auth-redirect is explicitly set (even to empty string), use it
    // If not set and we're on community page, stay on the same page
    // Otherwise, redirect to home
    if (redirectTarget !== undefined) {
      // Explicit redirect set (could be empty string to stay on page)
      if (redirectTarget) {
        location.assign(redirectTarget);
      }
      // If empty string, stay on current page (reload to update UI)
      else {
        location.reload();
      }
    } else if (window.location.pathname.includes('community')) {
      // On community page without explicit redirect - reload to stay here
      location.reload();
    } else {
      // Default behavior - go to home
      location.assign('/');
    }
  });
});

if (typeof window !== 'undefined') {
  window.bootAuth = bootAuth;
  window.waitForAuthReady = waitForAuthReady;
  window.updateAuthUI = updateAuthUI;
  
  // Automatyczna inicjalizacja przy załadowaniu strony
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootAuth().catch((error) => {
        console.warn('[auth-ui] Błąd podczas automatycznej inicjalizacji auth:', error);
      });
    });
  } else {
    // Dokument już załadowany, uruchom natychmiast
    bootAuth().catch((error) => {
      console.warn('[auth-ui] Błąd podczas automatycznej inicjalizacji auth:', error);
    });
  }
}
