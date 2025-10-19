const AUTH_STATE = {
  LOADING: 'loading',
  GUEST: 'guest',
  AUTHENTICATED: 'authenticated',
};

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
    return 'Twoje konto';
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
      updateAuthState(AUTH_STATE.AUTHENTICATED, `Zalogowano jako ${describeUser(user)}`);
      updateAccountCta(user);
    } else {
      updateAuthState(AUTH_STATE.GUEST, 'Grasz jako gość');
      updateAccountCta(null);
    }
  }

  updateAuthState(AUTH_STATE.LOADING, 'Łączenie z logowaniem…');

  waitForAuthApi().then(async (authApi) => {
    if (!authApi || authApi.enabled === false || !authApi.supabase) {
      updateAuthState(AUTH_STATE.GUEST, 'Tryb gościa — logowanie chwilowo niedostępne');
      setAuthMessage('Logowanie jest obecnie wyłączone. Spróbuj ponownie później.', 'error');
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
        setAuthMessage('Podaj adres e-mail i hasło, aby się zalogować.', 'error');
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

      setAuthMessage('Łączenie z kontem…', 'info');
      updateAuthState(AUTH_STATE.LOADING, 'Logowanie…');

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
        setAuthMessage('Witaj ponownie! Przekierowujemy do panelu.', 'success');
        loginForm.reset();
        setTimeout(() => {
          window.location.href = '/account/';
        }, 1200);
      } catch (error) {
        const message = error && typeof error.message === 'string' && error.message
          ? error.message
          : 'Nie udało się zalogować. Spróbuj ponownie.';
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
        setAuthMessage('Podaj imię, aby utworzyć konto.', 'error');
        firstNameInput.focus();
        return;
      }

      if (firstName.length < 2) {
        setAuthMessage('Imię powinno mieć co najmniej 2 znaki.', 'error');
        firstNameInput.focus();
        return;
      }

      const username = usernameInput.value.trim();
      if (!username) {
        setAuthMessage('Wybierz nazwę użytkownika.', 'error');
        usernameInput.focus();
        return;
      }

      if (!usernamePattern.test(username)) {
        setAuthMessage('Nazwa użytkownika może zawierać litery, cyfry, kropki, myślniki i podkreślenia (3-30 znaków).', 'error');
        usernameInput.focus();
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirm = confirmInput.value;

      if (!email || !password) {
        setAuthMessage('Podaj adres e-mail i hasło, aby utworzyć konto.', 'error');
        emailInput.focus();
        return;
      }

      if (password.length < 8) {
        setAuthMessage('Hasło powinno mieć co najmniej 8 znaków.', 'error');
        passwordInput.focus();
        return;
      }

      if (password !== confirm) {
        setAuthMessage('Hasła nie są identyczne. Spróbuj ponownie.', 'error');
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
        setAuthMessage('Sprawdzamy nazwę użytkownika…', 'info');
        const taken = await isUsernameTaken(username);
        if (taken) {
          setAuthMessage('Wybrana nazwa użytkownika jest już zajęta. Wybierz inną.', 'error');
          usernameInput.focus();
          return;
        }
      } catch (error) {
        const message = error && typeof error.message === 'string' && error.message
          ? error.message
          : 'Nie udało się potwierdzić dostępności nazwy użytkownika. Spróbuj ponownie.';
        setAuthMessage(message, 'error');
        return;
      }

      setAuthMessage('Tworzenie konta…', 'info');

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
        setAuthMessage('Konto utworzone! Sprawdź e-mail, aby potwierdzić adres.', 'success');
        setActiveTab('login', { focus: true });
      } catch (error) {
        const message = error && typeof error.message === 'string' && error.message
          ? error.message
          : 'Nie udało się utworzyć konta. Spróbuj ponownie.';
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
          setAuthMessage('Podaj adres e-mail, aby wysłać link do resetu.', 'error');
          return;
        }

        const email = emailInput.value.trim();
        if (!email) {
          setAuthMessage('Podaj adres e-mail, aby wysłać link do resetu.', 'error');
          emailInput.focus();
          return;
        }

        loginForgotPassword.disabled = true;
        setAuthMessage('Wysyłamy link resetujący…', 'info');

        try {
          const redirectTo = `${window.location.origin}/reset/`;
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
          if (error) {
            throw error;
          }
          setAuthMessage('Sprawdź skrzynkę e-mail — wysłaliśmy link do resetu hasła.', 'success');
        } catch (error) {
          const message = error && typeof error.message === 'string' && error.message
            ? error.message
            : 'Nie udało się wysłać linku resetującego. Spróbuj ponownie później.';
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
      setAuthMessage('Grasz teraz jako gość. Możesz wrócić i utworzyć konto w dowolnym momencie.', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 900);
    });
  });
});
