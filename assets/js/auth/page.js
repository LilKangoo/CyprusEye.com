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
      },
      info: {
        loginConnecting: 'Łączenie z kontem…',
        registerCheckingUsername: 'Sprawdzamy nazwę użytkownika…',
        registerCreating: 'Tworzenie konta…',
        resetSending: 'Wysyłamy link resetujący…',
      },
      success: {
        loginRedirect: 'Witaj ponownie! Przekierowujemy do panelu.',
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
        registerMissingUsername: 'Wybierz nazwę użytkownika.',
        registerUsernameInvalid:
          'Nazwa użytkownika może zawierać litery, cyfry, kropki, myślniki i podkreślenia (3-30 znaków).',
        registerUsernameTaken: 'Wybrana nazwa użytkownika jest już zajęta. Wybierz inną.',
        registerUsernameUnknown: 'Nie udało się potwierdzić dostępności nazwy użytkownika. Spróbuj ponownie.',
        registerMissingCredentials: 'Podaj adres e-mail i hasło, aby utworzyć konto.',
        registerPasswordShort: 'Hasło powinno mieć co najmniej 8 znaków.',
        registerPasswordMismatch: 'Hasła nie są identyczne. Spróbuj ponownie.',
        registerUnknown: 'Nie udało się utworzyć konta. Spróbuj ponownie.',
        registerUnavailable: 'Rejestracja jest chwilowo niedostępna. Spróbuj ponownie później.',
        resetMissingEmail: 'Podaj adres e-mail, aby wysłać link do resetu.',
        resetUnknown: 'Nie udało się wysłać linku resetującego. Spróbuj ponownie później.',
        unavailable: 'Logowanie jest obecnie wyłączone. Spróbuj ponownie później.',
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
      },
      info: {
        loginConnecting: 'Signing you in…',
        registerCheckingUsername: 'Checking username availability…',
        registerCreating: 'Creating your account…',
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
        registerMissingUsername: 'Choose a username.',
        registerUsernameInvalid:
          'The username can include letters, digits, dots, dashes and underscores (3-30 characters).',
        registerUsernameTaken: 'This username is already taken. Pick another one.',
        registerUsernameUnknown: 'We could not verify the username availability. Try again.',
        registerMissingCredentials: 'Enter your email address and password to create an account.',
        registerPasswordShort: 'The password must have at least 8 characters.',
        registerPasswordMismatch: 'The passwords do not match. Try again.',
        registerUnknown: 'We could not create your account. Please try again.',
        registerUnavailable: 'Sign-up is temporarily unavailable. Please try again later.',
        resetMissingEmail: 'Enter your email address to send a reset link.',
        resetUnknown: 'We could not send the reset link. Please try again later.',
        unavailable: 'Sign-in is currently disabled. Please try again later.',
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

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');
  const loginForgotPassword = document.getElementById('loginForgotPassword');
  const guestPlayButton = document.getElementById('guestPlayButton');

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

  const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/i;

  function describeUser(user) {
    if (!user) return '';
    const metadata = user.user_metadata || {};
    if (typeof metadata.username === 'string' && metadata.username.trim()) {
      return metadata.username.trim();
    }
    if (typeof metadata.display_name === 'string' && metadata.display_name.trim()) {
      return metadata.display_name.trim();
    }
    if (typeof metadata.full_name === 'string' && metadata.full_name.trim()) {
      return metadata.full_name.trim();
    }
    if (typeof metadata.name === 'string' && metadata.name.trim()) {
      return metadata.name.trim();
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
    if (globalAuthError === 'config-missing' || globalAuthError === 'invalid-api-key') {
      return TEXT.errors.loginInvalidConfig;
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

  function handleAuthUser(user) {
    if (user) {
      updateAuthState(AUTH_STATE.AUTHENTICATED, TEXT.status.authenticated(describeUser(user)));
      updateAccountCta(user);
    } else {
      updateAuthState(AUTH_STATE.GUEST, TEXT.status.guest);
      updateAccountCta(null);
    }
  }

  updateAuthState(AUTH_STATE.LOADING, TEXT.status.loading);

  waitForAuthApi().then(async (authApi) => {
    if (!authApi || authApi.enabled === false || !authApi.supabase) {
      const authError = authApi?.authError || document.documentElement.dataset.authError || '';
      const issues = Array.isArray(authApi?.diagnostics?.issues) ? authApi.diagnostics.issues : [];
      const lastIssue = issues.length ? issues[issues.length - 1] : null;
      let message = TEXT.errors.unavailable;
      let statusMessage = TEXT.status.disabled;
      if (authError === 'config-missing' || authApi?.reason === 'config-missing') {
        message = TEXT.errors.loginInvalidConfig;
        statusMessage = TEXT.status.invalidConfig;
      } else if (authError === 'invalid-api-key') {
        message = TEXT.errors.loginInvalidConfig;
        statusMessage = TEXT.status.invalidConfig;
      } else if (lastIssue?.code === 'session-fetch-failed') {
        message = TEXT.errors.loginNetwork;
        statusMessage = TEXT.status.network;
      }
      updateAuthState(AUTH_STATE.GUEST, statusMessage);
      setAuthMessage(message, 'error');
      disableFormControls(loginForm, true);
      disableFormControls(registerForm, true);
      if (loginForgotPassword instanceof HTMLButtonElement) {
        loginForgotPassword.disabled = true;
      }
      return;
    }

    const supabase = authApi.supabase;

    async function isUsernameTaken(username, { excludeUserId = null } = {}) {
      if (!usernamePattern.test(username)) {
        return true;
      }

      const normalized = username.trim().toLowerCase();

      try {
        let query = supabase.from('profiles').select('id').ilike('username', normalized).limit(1);
        if (excludeUserId) {
          query = query.neq('id', excludeUserId);
        }
        const { data, error } = await query.maybeSingle();
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        return Boolean(data?.id);
      } catch (error) {
        console.warn('Nie udało się zweryfikować dostępności nazwy użytkownika', error);
        throw new Error('Nie udało się potwierdzić dostępności nazwy użytkownika. Spróbuj ponownie.');
      }
    }

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

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
        setAuthMessage(TEXT.success.loginRedirect, 'success');
        loginForm.reset();
        setTimeout(() => {
          window.location.href = '/account/';
        }, 1200);
      } catch (error) {
        const message = resolveSupabaseError(error, 'login');
        setAuthMessage(message, 'error');
        handleAuthUser(null);
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
    });

    registerForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!(registerForm instanceof HTMLFormElement)) return;

      const emailInput = getField(registerForm, '#registerEmail');
      const passwordInput = getField(registerForm, '#registerPassword');
      const confirmInput = registerPasswordConfirm instanceof HTMLInputElement ? registerPasswordConfirm : null;
      const firstNameInput = getField(registerForm, '#registerFirstName');
      const usernameInput = getField(registerForm, '#registerUsername');

      if (!emailInput || !passwordInput || !confirmInput || !firstNameInput || !usernameInput) {
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

      const username = usernameInput.value.trim();
      if (!username) {
        setAuthMessage(TEXT.errors.registerMissingUsername, 'error');
        usernameInput.focus();
        return;
      }

      if (!usernamePattern.test(username)) {
        setAuthMessage(TEXT.errors.registerUsernameInvalid, 'error');
        usernameInput.focus();
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

      try {
        setAuthMessage(TEXT.info.registerCheckingUsername, 'info');
        const taken = await isUsernameTaken(username);
        if (taken) {
          setAuthMessage(TEXT.errors.registerUsernameTaken, 'error');
          usernameInput.focus();
          return;
        }
      } catch (error) {
        const message = error && typeof error.message === 'string' && error.message
          ? error.message
          : TEXT.errors.registerUsernameUnknown;
        setAuthMessage(message, 'error');
        return;
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
              display_name: firstName,
              first_name: firstName,
              username,
              username_normalized: username.toLowerCase(),
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
              .upsert(
                {
                  id: data.user.id,
                  display_name: firstName,
                  first_name: firstName,
                  username,
                },
                { onConflict: 'id' },
              );
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

    guestPlayButton?.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('Wylogowanie przed trybem gościa nie powiodło się:', error);
      }
      localStorage.removeItem('wakacjecypr-session');
      setAuthMessage(TEXT.success.guestMode, 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 900);
    });
  });
});
