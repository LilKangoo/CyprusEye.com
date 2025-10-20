const AUTH_STATE = {
  LOADING: 'loading',
  GUEST: 'guest',
  AUTHENTICATED: 'authenticated',
};

function createAuthCopy() {
  const lang = (document.documentElement?.lang || 'pl').toLowerCase();
  const key = lang.startsWith('en') ? 'en' : 'pl';
  const copies = {
    pl: {
      status: {
        loading: 'Łączenie z logowaniem…',
        guest: 'Grasz jako gość',
        authenticated: (name) => `Zalogowano jako ${name}`,
        disabled: 'Tryb gościa — logowanie chwilowo niedostępne',
        invalidConfig: 'Logowanie wyłączone – konfiguracja wymaga uwagi',
        network: 'Logowanie niedostępne – sprawdź połączenie',
        unavailableShort: 'Logowanie niedostępne',
      },
      info: {
        loginConnecting: 'Łączenie z kontem…',
        registerCreating: 'Tworzenie konta i profilu…',
        resetSending: 'Wysyłamy link resetujący…',
      },
      success: {
        loginRedirect: 'Witaj ponownie! Otwieramy panel gracza.',
        registerCheckEmail: 'Konto utworzone! Sprawdź e-mail, aby potwierdzić adres.',
        resetEmailSent: 'Sprawdź skrzynkę e-mail — wysłaliśmy link do resetu hasła.',
        guestMode: 'Grasz teraz jako gość. Możesz wrócić i utworzyć konto w dowolnym momencie.',
      },
      errors: {
        loginMissingCredentials: 'Podaj adres e-mail i hasło, aby się zalogować.',
        loginInvalidCredentials: 'Nieprawidłowy e-mail lub hasło. Spróbuj ponownie.',
        loginInvalidConfig: 'Logowanie jest chwilowo niedostępne – skontaktuj się z administratorem serwisu.',
        loginNetwork: 'Nie udało się połączyć z serwerem logowania. Sprawdź internet i spróbuj ponownie.',
        loginUnknown: 'Nie udało się zalogować. Spróbuj ponownie później.',
        registerMissingFirstName: 'Podaj imię, aby utworzyć konto.',
        registerFirstNameShort: 'Imię powinno mieć co najmniej 2 znaki.',
        registerMissingCredentials: 'Podaj adres e-mail i hasło, aby utworzyć konto.',
        registerPasswordShort: 'Hasło powinno mieć co najmniej 8 znaków.',
        registerPasswordMismatch: 'Hasła nie są identyczne. Spróbuj ponownie.',
        registerUnknown: 'Nie udało się utworzyć konta. Spróbuj ponownie.',
        registerUnavailable: 'Rejestracja jest chwilowo niedostępna. Spróbuj ponownie później.',
        resetMissingEmail: 'Podaj adres e-mail, aby wysłać link do resetu.',
        resetUnknown: 'Nie udało się wysłać linku resetującego. Spróbuj ponownie później.',
        unavailable: 'Logowanie jest obecnie wyłączone. Spróbuj ponownie później.',
        unavailableShort: 'Logowanie niedostępne',
      },
    },
    en: {
      status: {
        loading: 'Connecting to sign-in…',
        guest: 'You are playing as a guest',
        authenticated: (name) => `Signed in as ${name}`,
        disabled: 'Guest mode — sign-in is temporarily unavailable',
        invalidConfig: 'Sign-in disabled – configuration requires attention',
        network: 'Sign-in unavailable – check your connection',
        unavailableShort: 'Sign-in unavailable',
      },
      info: {
        loginConnecting: 'Signing you in…',
        registerCreating: 'Creating your account and profile…',
        resetSending: 'Sending reset link…',
      },
      success: {
        loginRedirect: 'Welcome back! Redirecting to the player hub.',
        registerCheckEmail: 'Account created! Check your inbox to confirm your email.',
        resetEmailSent: 'Check your inbox — we sent a password reset link.',
        guestMode: 'You are now playing as a guest. You can create an account any time.',
      },
      errors: {
        loginMissingCredentials: 'Enter your email address and password to sign in.',
        loginInvalidCredentials: 'Incorrect email or password. Try again.',
        loginInvalidConfig: 'Sign-in is temporarily unavailable — please contact the administrator.',
        loginNetwork: 'Unable to reach the sign-in service. Check your connection and try again.',
        loginUnknown: 'Sign-in failed. Please try again later.',
        registerMissingFirstName: 'Enter your first name to create an account.',
        registerFirstNameShort: 'Your first name should have at least 2 characters.',
        registerMissingCredentials: 'Enter your email address and password to create an account.',
        registerPasswordShort: 'The password must have at least 8 characters.',
        registerPasswordMismatch: 'The passwords do not match. Try again.',
        registerUnknown: 'We could not create your account. Please try again.',
        registerUnavailable: 'Sign-up is temporarily unavailable. Please try again later.',
        resetMissingEmail: 'Enter your email address to send a reset link.',
        resetUnknown: 'We could not send the reset link. Please try again later.',
        unavailable: 'Sign-in is currently disabled. Please try again later.',
        unavailableShort: 'Sign-in unavailable',
      },
    },
  };
  return copies[key];
}

const TEXT = createAuthCopy();

function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function waitForAuthApi() {
  return new Promise((resolve) => {
    if (window.CE_AUTH) {
      resolve(window.CE_AUTH);
      return;
    }

    const handleReady = (event) => {
      resolve(event.detail || window.CE_AUTH || {});
    };

    document.addEventListener('ce-auth-ready', handleReady, { once: true });
  });
}

ready(() => {
  const tabButtons = Array.from(document.querySelectorAll('[data-auth-tab]'));
  const panels = new Map(
    tabButtons.map((button) => {
      const tabId = button.dataset.authTab;
      const panel = tabId ? document.querySelector(`[data-auth-panel="${tabId}"]`) : null;
      return [tabId || '', panel || null];
    }),
  );

  let currentTab = tabButtons[0]?.dataset.authTab || 'login';

  const authMessageEl = document.getElementById('authMessage');
  const statusBadge = document.getElementById('authStatusBadge');
  const accountCta = document.getElementById('authAccountCta');
  const accountName = document.getElementById('authAccountName');

  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');
  const loginForgotPassword = document.getElementById('loginForgotPassword');
  const guestPlayButton = document.getElementById('btn-guest');
  const loginHandledExternally =
    loginForm instanceof HTMLFormElement && loginForm.dataset.ceAuthHandler === 'supabase';
  const registerHandledExternally =
    registerForm instanceof HTMLFormElement && registerForm.dataset.ceAuthHandler === 'supabase';
  const guestHandledExternally =
    guestPlayButton instanceof HTMLButtonElement && guestPlayButton.dataset.ceAuthHandler === 'supabase';

  function setActiveTab(tabId, { focus = false } = {}) {
    if (!panels.has(tabId)) {
      tabId = tabButtons[0]?.dataset.authTab || currentTab;
    }
    currentTab = tabId;

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
      if (!panel) return;
      const isActive = id === tabId;
      panel.classList.toggle('is-active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (authMessageEl) {
      authMessageEl.textContent = '';
      authMessageEl.removeAttribute('data-tone');
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.authTab;
      if (!tabId) return;
      setActiveTab(tabId, { focus: false });
    });
  });

  setActiveTab(currentTab);

  const supabaseMetaUrl = document.querySelector('meta[name="supabase-url"]')?.content?.trim();
  const supabaseMetaAnon = document.querySelector('meta[name="supabase-anon"]')?.content?.trim();

  function setAuthMessage(message = '', tone = 'info') {
    if (!authMessageEl) return;
    authMessageEl.textContent = message;
    if (message) {
      authMessageEl.dataset.tone = tone;
    } else {
      authMessageEl.removeAttribute('data-tone');
    }
  }

  function setStatusBadge(state, message) {
    if (!statusBadge) return;
    statusBadge.dataset.state = state;
    statusBadge.textContent = message;
  }

  function disableFormControls(form, disabled) {
    if (!(form instanceof HTMLFormElement)) return;
    form.querySelectorAll('input, button').forEach((element) => {
      if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
        element.disabled = disabled;
      }
    });
  }

  function getField(form, selector) {
    if (!(form instanceof HTMLFormElement)) {
      return null;
    }
    const field = form.querySelector(selector);
    return field instanceof HTMLInputElement ? field : null;
  }

  function readLoginConfig(form) {
    if (!(form instanceof HTMLFormElement)) {
      return {
        mode: 'hybrid',
        fallback: 'supabase',
        endpoint: '/api/login',
      };
    }

    const dataset = form.dataset || {};
    const mode = (dataset.loginMode || 'hybrid').toLowerCase();
    const fallback = (dataset.loginFallback || 'supabase').toLowerCase();
    const action = (form.getAttribute('action') || '').trim();
    const endpoint = (dataset.loginEndpoint || action || '/api/login').trim() || '/api/login';

    return { mode, fallback, endpoint };
  }

  function shouldUseApiLogin(mode) {
    if (!mode) return true;
    const normalized = mode.toLowerCase();
    if (normalized === 'supabase') {
      return false;
    }
    return true;
  }

  function allowSupabaseFallback(fallback) {
    const normalized = (fallback || '').toLowerCase();
    return normalized !== 'none';
  }

  function adaptApiUser(user) {
    if (!user || typeof user !== 'object') {
      return null;
    }

    const metadata = {};
    const nameCandidates = [];
    if (typeof user.name === 'string' && user.name.trim()) {
      nameCandidates.push(user.name.trim());
    }
    if (typeof user.displayName === 'string' && user.displayName.trim()) {
      nameCandidates.push(user.displayName.trim());
    }
    if (typeof user.firstName === 'string' && user.firstName.trim()) {
      nameCandidates.push(user.firstName.trim());
      metadata.first_name = user.firstName.trim();
    }
    const resolvedName = nameCandidates.find((value) => value);
    if (resolvedName) {
      metadata.name = resolvedName;
      metadata.full_name = resolvedName;
      metadata.display_name = resolvedName;
    }
    if (typeof user.username === 'string' && user.username.trim()) {
      metadata.username = user.username.trim();
    }

    return {
      ...user,
      email: typeof user.email === 'string' ? user.email : '',
      user_metadata: metadata,
    };
  }

  function extractApiSession(payload, user, fallbackEmail = '') {
    const target = payload && typeof payload === 'object' ? payload : {};
    const nestedSession =
      target.session && typeof target.session === 'object' ? target.session : {};

    const tokenCandidates = [
      target.token,
      target.access_token,
      nestedSession.access_token,
      nestedSession.token,
    ];
    const refreshCandidates = [target.refresh_token, nestedSession.refresh_token];
    const expiresCandidates = [
      target.expires_at,
      target.expiresAt,
      nestedSession.expires_at,
      nestedSession.expiresAt,
    ];

    const token = tokenCandidates.find((candidate) => typeof candidate === 'string' && candidate) || null;
    const refreshToken =
      refreshCandidates.find((candidate) => typeof candidate === 'string' && candidate) || null;

    let expiresAt = null;
    for (const candidate of expiresCandidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        expiresAt = candidate;
        break;
      }
      if (typeof candidate === 'string' && candidate) {
        expiresAt = candidate;
        break;
      }
    }

    let normalizedUser = user && typeof user === 'object' ? user : null;
    if (!normalizedUser && (token || refreshToken)) {
      normalizedUser = {
        id:
          typeof nestedSession.user?.id === 'string'
            ? nestedSession.user.id
            : typeof target.user?.id === 'string'
            ? target.user.id
            : `api-${Date.now()}`,
        email:
          typeof user?.email === 'string'
            ? user.email
            : typeof target.email === 'string'
            ? target.email
            : typeof fallbackEmail === 'string'
            ? fallbackEmail
            : '',
        user_metadata:
          typeof user?.user_metadata === 'object' && user.user_metadata
            ? user.user_metadata
            : {},
      };
    }

    if (!normalizedUser && !token && !refreshToken) {
      return null;
    }

    return {
      user: normalizedUser,
      token,
      refreshToken,
      expiresAt,
      source: 'api',
      createdAt: Date.now(),
    };
  }

  async function loginWithApi(credentials, { endpoint }) {
    const target = endpoint || '/api/login';
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      let payload = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          payload = await response.json();
        } catch (parseError) {
          payload = null;
        }
      } else {
        const text = await response.text();
        if (text) {
          payload = { message: text };
        }
      }

      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === 'string'
            ? payload.error
            : typeof payload?.message === 'string'
            ? payload.message
            : '';

        let message = errorMessage || TEXT.errors.loginUnknown;
        if (response.status === 400 || response.status === 401) {
          message = TEXT.errors.loginInvalidCredentials;
        } else if (response.status >= 500) {
          message = TEXT.errors.loginNetwork;
        }

        return {
          ok: false,
          status: response.status,
          message,
          payload,
        };
      }

      return {
        ok: true,
        status: response.status,
        payload,
        user: payload?.user || null,
      };
    } catch (error) {
      console.warn('Błąd podczas logowania za pomocą API', error);
      return {
        ok: false,
        status: 0,
        message: TEXT.errors.loginNetwork,
        error,
      };
    }
  }

  function describeUser(user) {
    if (!user) return '';
    const metadata = user.user_metadata || {};
    if (typeof metadata.name === 'string' && metadata.name.trim()) {
      return metadata.name.trim();
    }
    if (typeof metadata.full_name === 'string' && metadata.full_name.trim()) {
      return metadata.full_name.trim();
    }
    if (typeof metadata.display_name === 'string' && metadata.display_name.trim()) {
      return metadata.display_name.trim();
    }
    if (typeof metadata.username === 'string' && metadata.username.trim()) {
      return metadata.username.trim();
    }
    if (typeof user.name === 'string' && user.name.trim()) {
      return user.name.trim();
    }
    if (typeof user.displayName === 'string' && user.displayName.trim()) {
      return user.displayName.trim();
    }
    if (typeof user.firstName === 'string' && user.firstName.trim()) {
      return user.firstName.trim();
    }
    if (typeof user.email === 'string' && user.email.trim()) {
      return user.email.trim();
    }
    const fallbackLanguageName = (document.documentElement?.lang || '').toLowerCase().startsWith('en')
      ? 'Your account'
      : 'Twoje konto';
    return fallbackLanguageName;
  }

  function resolveSupabaseError(error, context = 'login') {
    const fallbackByContext = {
      login: TEXT.errors.loginUnknown,
      register: TEXT.errors.registerUnknown,
      reset: TEXT.errors.resetUnknown,
    };
    const fallback = fallbackByContext[context] || TEXT.errors.loginUnknown;
    const globalAuthError = window.CE_AUTH?.authError || document.documentElement.dataset.authError || '';
    if (globalAuthError === 'config-missing') {
      return TEXT.errors.loginInvalidConfig;
    }
    if (globalAuthError === 'invalid-api-key') {
      return TEXT.errors.unavailableShort;
    }
    if (!error) {
      return fallback;
    }
    const message = typeof error.message === 'string' ? error.message.trim() : '';
    const lowered = message.toLowerCase();
    const status = typeof error.status === 'number' ? error.status : Number(error.status) || null;
    const code = typeof error.code === 'string' ? error.code : '';

    if (lowered.includes('invalid api key') || code === 'invalid_api_key') {
      return TEXT.errors.loginInvalidConfig;
    }

    if (
      context === 'login' &&
      (lowered.includes('invalid login credentials') ||
        lowered.includes('invalid email or password') ||
        code === 'invalid_grant' ||
        status === 400 ||
        status === 401)
    ) {
      return TEXT.errors.loginInvalidCredentials;
    }

    if (
      error instanceof TypeError ||
      lowered.includes('network error') ||
      lowered.includes('failed to fetch') ||
      lowered.includes('network request failed')
    ) {
      return TEXT.errors.loginNetwork;
    }

    if (status === 0) {
      return TEXT.errors.loginNetwork;
    }

    if (message) {
      return message;
    }

    return fallback;
  }

  function updateAccountCta(user) {
    if (!accountCta) return;
    if (user) {
      accountCta.hidden = false;
      if (accountName) {
        accountName.textContent = describeUser(user);
      }
    } else {
      accountCta.hidden = true;
      if (accountName) {
        accountName.textContent = '';
      }
    }
  }

  function updateAuthState(state, message) {
    setStatusBadge(state, message);
    document.documentElement.dataset.authState = state;
  }

  function setFormsDisabledState(disabled) {
    if (!loginHandledExternally) {
      disableFormControls(loginForm, disabled);
    }
    if (!registerHandledExternally) {
      disableFormControls(registerForm, disabled);
    }
    if (loginForgotPassword instanceof HTMLButtonElement) {
      loginForgotPassword.disabled = disabled;
    }
  }

  const AUTH_ERROR_UI = {
    'invalid-api-key': {
      message: TEXT.errors.unavailableShort,
      status: TEXT.status.unavailableShort,
    },
    'config-missing': { message: TEXT.errors.loginInvalidConfig, status: TEXT.status.invalidConfig },
    network: { message: TEXT.errors.loginNetwork, status: TEXT.status.network },
    disabled: { message: TEXT.errors.unavailable, status: TEXT.status.disabled },
    'init-failed': { message: TEXT.errors.unavailable, status: TEXT.status.disabled },
    default: { message: TEXT.errors.unavailable, status: TEXT.status.disabled },
  };

  let globalAuthErrorActive = false;

  function applyGlobalAuthErrorState(code = '') {
    const normalized = typeof code === 'string' && code ? code.trim().toLowerCase() : '';
    if (normalized) {
      document.documentElement.dataset.authError = normalized;
    }
    const datasetCode = (document.documentElement.dataset.authError || '').trim().toLowerCase();
    const display = AUTH_ERROR_UI[datasetCode] || AUTH_ERROR_UI.default;
    globalAuthErrorActive = true;
    setFormsDisabledState(true);
    setAuthMessage(display.message, 'error');
    updateAuthState(AUTH_STATE.GUEST, display.status);
  }

  function clearGlobalAuthErrorState() {
    const hasDatasetError = Boolean(document.documentElement.dataset.authError);
    if (!globalAuthErrorActive && !hasDatasetError) {
      setFormsDisabledState(false);
      return;
    }
    globalAuthErrorActive = false;
    delete document.documentElement.dataset.authError;
    setFormsDisabledState(false);
    if (authMessageEl?.dataset.tone === 'error') {
      setAuthMessage('');
    }
    updateAuthState(AUTH_STATE.LOADING, TEXT.status.loading);
  }

  function handleAuthUser(user) {
    if (user) {
      updateAuthState(AUTH_STATE.AUTHENTICATED, TEXT.status.authenticated(describeUser(user)));
      updateAccountCta(user);
    } else {
      updateAuthState(AUTH_STATE.GUEST, TEXT.status.guest);
      updateAccountCta(null);
    }
  }

  function handleMissingSupabaseConfig() {
    console.error('Brak konfiguracji Supabase: wymagane meta supabase-url lub supabase-anon.');
    applyGlobalAuthErrorState('config-missing');
  }

  const initialAuthError = (document.documentElement.dataset.authError || '').trim();
  if (initialAuthError) {
    applyGlobalAuthErrorState(initialAuthError);
  } else {
    setFormsDisabledState(false);
  }

  document.addEventListener('ce-auth:status', (event) => {
    const detail = event?.detail;
    const status = typeof detail === 'string' ? detail : detail?.status || '';
    const code =
      typeof detail === 'object' && detail
        ? detail.code || detail.error || detail.reason || ''
        : '';
    if (status === 'online') {
      clearGlobalAuthErrorState();
    } else if (status === 'error') {
      applyGlobalAuthErrorState(code);
    }
  });

  if (!supabaseMetaUrl || !supabaseMetaAnon) {
    handleMissingSupabaseConfig();
    return;
  }

  if (!globalAuthErrorActive) {
    updateAuthState(AUTH_STATE.LOADING, TEXT.status.loading);
  }

  waitForAuthApi().then(async (authApi) => {
    if (!authApi || authApi.enabled === false || !authApi.supabase) {
      const authError = authApi?.authError || document.documentElement.dataset.authError || '';
      const issues = Array.isArray(authApi?.diagnostics?.issues) ? authApi.diagnostics.issues : [];
      const lastIssue = issues.length ? issues[issues.length - 1] : null;
      let errorCode = authError || '';
      if (!errorCode && typeof authApi?.reason === 'string') {
        errorCode = authApi.reason;
      }
      if (!errorCode && lastIssue?.code === 'session-fetch-failed') {
        errorCode = 'network';
      }
      applyGlobalAuthErrorState(errorCode);
      return;
    }

    const supabase = authApi.supabase;

    if (typeof authApi.onAuthStateChange === 'function') {
      authApi.onAuthStateChange((user) => {
        handleAuthUser(user);
      });
    }

    try {
      const currentSession = await authApi.session?.();
      handleAuthUser(currentSession?.user || null);
    } catch (error) {
      console.warn('Nie udało się pobrać sesji logowania:', error);
      handleAuthUser(null);
    }

    if (loginHandledExternally) {
      return;
    }
    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!(loginForm instanceof HTMLFormElement)) return;

      const emailInput = getField(loginForm, '#loginEmail');
      const passwordInput = getField(loginForm, '#loginPassword');
      if (!emailInput || !passwordInput) return;

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        setAuthMessage(TEXT.errors.loginMissingCredentials, 'error');
        emailInput.focus();
        return;
      }

      const loginConfig = readLoginConfig(loginForm);
      const useApiLogin = shouldUseApiLogin(loginConfig.mode);
      const supabaseAvailable = Boolean(supabase?.auth?.signInWithPassword);
      const fallbackMode = (loginConfig.fallback || '').toLowerCase();
      const fallbackEnabled = allowSupabaseFallback(fallbackMode);
      const requireApiSuccess = (loginConfig.mode || '').toLowerCase() === 'api';

      const submitButton = loginForm.querySelector('button[type="submit"]');
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.dataset.loading = 'true';
        submitButton.setAttribute('aria-busy', 'true');
      }
      if (loginForgotPassword instanceof HTMLButtonElement) {
        loginForgotPassword.disabled = true;
      }

      setAuthMessage(TEXT.info.loginConnecting, 'info');
      updateAuthState(AUTH_STATE.LOADING, TEXT.status.loading);

      let loginCompleted = false;
      let continueToSupabase = supabaseAvailable && (!useApiLogin || fallbackMode !== 'none');
      let abortAfterApiFailure = false;

      try {
        if (useApiLogin) {
          const apiResult = await loginWithApi({ email, password }, loginConfig);

          if (!apiResult.ok) {
            const serverError = apiResult.status >= 500 && apiResult.status < 600;
            const fallbackAllowed =
              !requireApiSuccess && fallbackEnabled && supabaseAvailable && !serverError;

            continueToSupabase = fallbackAllowed;

            if (typeof authApi.clearManualSession === 'function') {
              authApi.clearManualSession({ silent: false });
            } else {
              try {
                localStorage.removeItem('wakacjecypr-session');
              } catch (storageError) {
                console.warn('Nie udało się wyczyścić sesji API z localStorage', storageError);
              }
            }

            if (!fallbackAllowed) {
              setAuthMessage(apiResult.message, 'error');
              handleAuthUser(null);
              abortAfterApiFailure = true;
              continueToSupabase = false;
            }
          } else {
            const apiUser = adaptApiUser(apiResult.user);
            const apiSession = extractApiSession(apiResult.payload, apiUser, email);
            const resolvedUser = apiSession?.user || apiUser;
            if (!supabaseAvailable || fallbackMode === 'none') {
              if (resolvedUser) {
                handleAuthUser(resolvedUser);
              }
              if (apiSession) {
                if (typeof authApi.setManualSession === 'function') {
                  authApi.setManualSession(apiSession);
                } else {
                  try {
                    localStorage.setItem('wakacjecypr-session', JSON.stringify(apiSession));
                  } catch (storageError) {
                    console.warn('Nie udało się zapisać sesji API w localStorage', storageError);
                  }
                }
              }
              setAuthMessage(TEXT.success.loginRedirect, 'success');
              loginForm.reset();
              setTimeout(() => {
                window.location.href = '/account/';
              }, 1200);
              loginCompleted = true;
              continueToSupabase = false;
            }
          }
        }

        if (!loginCompleted && continueToSupabase && supabaseAvailable) {
          if (typeof authApi.clearManualSession === 'function') {
            authApi.clearManualSession({ silent: false });
          } else {
            try {
              localStorage.removeItem('wakacjecypr-session');
            } catch (storageError) {
              console.warn('Nie udało się wyczyścić sesji API przed logowaniem Supabase', storageError);
            }
          }
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            throw error;
          }
          setAuthMessage(TEXT.success.loginRedirect, 'success');
          loginForm.reset();
          setTimeout(() => {
            window.location.href = '/account/';
          }, 1200);
          loginCompleted = true;
        }
      } catch (error) {
        const message = resolveSupabaseError(error, 'login');
        setAuthMessage(message, 'error');
        handleAuthUser(null);
        if (typeof authApi.clearManualSession === 'function') {
          authApi.clearManualSession({ silent: false });
        } else {
          try {
            localStorage.removeItem('wakacjecypr-session');
          } catch (storageError) {
            console.warn('Nie udało się wyczyścić sesji API po błędzie logowania', storageError);
          }
        }
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
          submitButton.removeAttribute('data-loading');
          submitButton.removeAttribute('aria-busy');
        }
        if (loginForgotPassword instanceof HTMLButtonElement) {
          loginForgotPassword.disabled = false;
        }
      }

      if (abortAfterApiFailure || loginCompleted) {
        return;
      }
    });

    if (registerHandledExternally) {
      return;
    }
    registerForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!(registerForm instanceof HTMLFormElement)) return;

      const emailInput = getField(registerForm, '#registerEmail');
      const passwordInput = getField(registerForm, '#registerPassword');
      const confirmInput = registerPasswordConfirm instanceof HTMLInputElement ? registerPasswordConfirm : null;
      const firstNameInput = getField(registerForm, '#registerFirstName');

      if (!emailInput || !passwordInput || !confirmInput || !firstNameInput) {
        setAuthMessage('Formularz rejestracji jest niepełny. Odśwież stronę i spróbuj ponownie.', 'error');
        return;
      }

      const firstName = firstNameInput.value.trim();
      if (!firstName) {
        setAuthMessage(TEXT.errors.registerMissingFirstName, 'error');
        firstNameInput.focus();
        return;
      }

      if (firstName.length < 2) {
        setAuthMessage(TEXT.errors.registerFirstNameShort, 'error');
        firstNameInput.focus();
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirm = confirmInput.value;

      if (!email || !password) {
        setAuthMessage(TEXT.errors.registerMissingCredentials, 'error');
        emailInput.focus();
        return;
      }

      if (password.length < 8) {
        setAuthMessage(TEXT.errors.registerPasswordShort, 'error');
        passwordInput.focus();
        return;
      }

      if (password !== confirm) {
        setAuthMessage(TEXT.errors.registerPasswordMismatch, 'error');
        confirmInput.focus();
        return;
      }

      const submitButton = registerForm.querySelector('button[type="submit"]');
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.dataset.loading = 'true';
        submitButton.setAttribute('aria-busy', 'true');
      }

      setAuthMessage(TEXT.info.registerCreating, 'info');

      try {
        const redirectTo = `${window.location.origin}/auth/callback/`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              name: firstName,
              display_name: firstName,
              full_name: firstName,
              first_name: firstName,
            },
          },
        });
        if (error) {
          throw error;
        }
        if (data?.user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({
                name: firstName,
                email,
              })
              .eq('id', data.user.id);
          } catch (profileError) {
            console.warn('Nie udało się zapisać profilu użytkownika podczas rejestracji', profileError);
          }
        }
        registerForm.reset();
        setAuthMessage(TEXT.success.registerCheckEmail, 'success');
        setActiveTab('login', { focus: true });
      } catch (error) {
        const message = resolveSupabaseError(error, 'register');
        setAuthMessage(message, 'error');
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
          submitButton.removeAttribute('data-loading');
          submitButton.removeAttribute('aria-busy');
        }
      }
    });

    if (loginForgotPassword instanceof HTMLButtonElement) {
      if (!document.getElementById('resetPasswordDialog')) {
        loginForgotPassword.addEventListener('click', async (event) => {
          event.preventDefault();
          if (!(loginForm instanceof HTMLFormElement)) return;

          const emailInput = getField(loginForm, '#loginEmail');
          if (!emailInput) {
            setAuthMessage(TEXT.errors.resetMissingEmail, 'error');
            return;
          }

          const email = emailInput.value.trim();
          if (!email) {
            setAuthMessage(TEXT.errors.resetMissingEmail, 'error');
            emailInput.focus();
            return;
          }

          loginForgotPassword.disabled = true;
          setAuthMessage(TEXT.info.resetSending, 'info');

          try {
            const redirectTo = `${window.location.origin}/reset/`;
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) {
              throw error;
            }
            setAuthMessage(TEXT.success.resetEmailSent, 'success');
          } catch (error) {
            const message = resolveSupabaseError(error, 'reset');
            setAuthMessage(message, 'error');
          } finally {
            loginForgotPassword.disabled = false;
          }
        });
      }
    }

    if (guestHandledExternally) {
      return;
    }
    guestPlayButton?.addEventListener('click', async () => {
      if (supabase?.auth?.signOut) {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.warn('Wylogowanie przed trybem gościa nie powiodło się:', error);
        }
      }
      if (typeof authApi.clearManualSession === 'function') {
        authApi.clearManualSession({ silent: false });
      } else {
        try {
          localStorage.removeItem('wakacjecypr-session');
        } catch (storageError) {
          console.warn('Nie udało się wyczyścić sesji podczas przejścia do trybu gościa', storageError);
        }
      }
      setAuthMessage(TEXT.success.guestMode, 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 900);
    });
  });
});
