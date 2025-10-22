import { waitForAuthReady, updateAuthUI as refreshAuthUi } from '/js/authUi.js';
import { refreshSessionAndProfile } from '/js/auth.js';
import { getMyProfile, updateMyName, updateMyUsername } from '/js/profile.js';
import { myXpEvents } from '/js/xp.js';

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/i;

const modal = document.getElementById('accountModal');
if (!modal || modal.dataset.ceAccountEnhanced !== 'true') {
  // Nothing to enhance – fallback to legacy behaviour.
} else {
  const selectors = {
    message: modal.querySelector('[data-account-message]'),
    loading: modal.querySelector('[data-account-loading]'),
    content: modal.querySelector('[data-account-content]'),
    email: modal.querySelector('[data-account-email]'),
    username: modal.querySelector('[data-account-username]'),
    nameDisplay: modal.querySelector('[data-account-name]'),
    xp: modal.querySelector('[data-account-xp]'),
    level: modal.querySelector('[data-account-level]'),
    updated: modal.querySelector('[data-account-updated]'),
    xpList: modal.querySelector('#accountXpEvents'),
    xpEmpty: modal.querySelector('#accountXpEmpty'),
    usernameForm: modal.querySelector('#accountUsernameForm'),
    usernameInput: modal.querySelector('#accountUsernameInput'),
    nameForm: modal.querySelector('#accountNameForm'),
    nameInput: modal.querySelector('#accountNameInput'),
    passwordForm: modal.querySelector('#accountPasswordForm'),
    passwordCurrent: modal.querySelector('#accountCurrentPassword'),
    passwordNew: modal.querySelector('#accountNewPassword'),
    passwordConfirm: modal.querySelector('#accountConfirmPassword'),
    guestNote: modal.querySelector('[data-account-guest-note]'),
  };

  let initialized = false;
  let loadPromise = null;

  const isModalOpen = () => !modal.hidden && modal.classList.contains('visible');

  function setMessage(text = '', tone = 'info') {
    const { message } = selectors;
    if (!message) return;
    if (!text) {
      message.hidden = true;
      message.textContent = '';
      message.removeAttribute('data-tone');
      return;
    }
    message.hidden = false;
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function setLoading(on) {
    const { loading, content } = selectors;
    if (loading) {
      loading.hidden = !on;
    }
    if (content) {
      content.hidden = !!on;
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderProfile(profile) {
    const { email, username, nameDisplay, xp, level, updated, usernameInput, nameInput } = selectors;
    if (email) {
      email.textContent = profile?.email ?? '—';
    }
    if (username) {
      username.textContent = profile?.username ?? '—';
    }
    if (nameDisplay) {
      nameDisplay.textContent = profile?.name ?? '—';
    }
    if (xp) {
      xp.textContent = typeof profile?.xp === 'number' ? profile.xp.toString() : '0';
    }
    if (level) {
      level.textContent = typeof profile?.level === 'number' ? profile.level.toString() : '0';
    }
    if (updated) {
      updated.textContent = formatDate(profile?.updated_at || profile?.updatedAt);
    }
    if (usernameInput) {
      usernameInput.value = typeof profile?.username === 'string' ? profile.username : '';
    }
    if (nameInput) {
      nameInput.value = typeof profile?.name === 'string' ? profile.name : '';
    }
  }

  function createXpItem(event) {
    const item = document.createElement('li');
    item.className = 'xp-item';

    const reason = document.createElement('span');
    reason.className = 'xp-item__reason';
    reason.textContent = event?.reason || 'Zdarzenie';

    const delta = document.createElement('span');
    delta.className = 'xp-item__delta';
    const deltaValue = Number(event?.xp_delta) || 0;
    delta.textContent = `${deltaValue > 0 ? '+' : ''}${deltaValue} XP`;

    const when = document.createElement('span');
    when.className = 'xp-item__date';
    when.textContent = formatDate(event?.created_at);

    item.append(reason, delta, when);
    return item;
  }

  function renderXpEvents(events = []) {
    const { xpList, xpEmpty } = selectors;
    if (!xpList || !xpEmpty) {
      return;
    }

    xpList.innerHTML = '';
    const list = Array.isArray(events) ? events.slice(0, 10) : [];
    if (!list.length) {
      xpList.hidden = true;
      xpEmpty.hidden = false;
      return;
    }

    xpList.hidden = false;
    xpEmpty.hidden = true;
    list.forEach((event) => xpList.appendChild(createXpItem(event)));
  }

  function setFormsEnabled(enabled) {
    const forms = [selectors.usernameForm, selectors.nameForm, selectors.passwordForm];
    forms.forEach((form) => {
      if (!(form instanceof HTMLFormElement)) {
        return;
      }
      form.classList.toggle('is-disabled', !enabled);
      form.querySelectorAll('input, button').forEach((element) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) {
          element.disabled = !enabled;
        }
      });
    });
  }

  function getSupabaseClient() {
    if (typeof window.getSupabase === 'function') {
      try {
        return window.getSupabase();
      } catch (error) {
        console.warn('[account-modal] Nie udało się pobrać klienta Supabase.', error);
      }
    }
    return null;
  }

  async function withBusy(target, fn) {
    if (!target || typeof fn !== 'function') {
      return;
    }
    if (target.disabled) {
      return;
    }
    target.disabled = true;
    target.dataset.busy = 'true';
    try {
      return await fn();
    } finally {
      delete target.dataset.busy;
      target.disabled = false;
    }
  }

  function updateProfileState(profile) {
    const state = (window.CE_STATE = { ...(window.CE_STATE || {}), profile });
    try {
      refreshAuthUi();
    } catch (error) {
      console.warn('[account-modal] Nie udało się odświeżyć interfejsu logowania.', error);
    }
    const appApi = window.CE_APP;
    if (appApi?.refreshAuthUi) {
      try {
        appApi.refreshAuthUi();
      } catch (error) {
        console.warn('[account-modal] Nie udało się odświeżyć interfejsu gry.', error);
      }
    }
    return state;
  }

  async function loadAccountData() {
    const state = window.CE_STATE || {};
    if (!state.session?.user) {
      renderProfile(null);
      renderXpEvents([]);
      setFormsEnabled(false);
      return;
    }

    if (loadPromise) {
      return loadPromise;
    }

    setLoading(true);
    loadPromise = (async () => {
      try {
        const [profile, events] = await Promise.all([getMyProfile(), myXpEvents()]);
        renderProfile(profile);
        renderXpEvents(events);
        updateProfileState(profile);
        setMessage('');
      } catch (error) {
        console.error('[account-modal] Nie udało się wczytać danych konta.', error);
        const message = error?.message ? String(error.message) : 'spróbuj ponownie później.';
        setMessage(`Nie udało się wczytać danych konta: ${message}`, 'error');
      } finally {
        setLoading(false);
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  function applyAuthState(authState) {
    const isLogged = !!authState?.session?.user;
    const isGuest = authState?.guest?.active && !isLogged;

    setFormsEnabled(isLogged);
    if (selectors.guestNote) {
      selectors.guestNote.hidden = !isGuest;
    }

    if (!isLogged) {
      setLoading(false);
      renderProfile(null);
      renderXpEvents([]);
      if (isModalOpen()) {
        setMessage('Zaloguj się, aby zarządzać kontem.', 'info');
      } else {
        setMessage('');
      }
    }
  }

  async function ensureInitialized() {
    if (initialized) {
      return;
    }
    try {
      await waitForAuthReady();
    } catch (error) {
      console.warn('[account-modal] Nie udało się zainicjalizować modułu logowania.', error);
    }

    const state = window.CE_STATE || {};
    applyAuthState(state);
    bindForms();
    initialized = true;
  }

  function bindForms() {
    const { usernameForm, usernameInput, nameForm, nameInput, passwordForm, passwordCurrent, passwordNew, passwordConfirm } = selectors;

    if (usernameForm && usernameInput) {
      usernameForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitter = usernameForm.querySelector('button[type="submit"]');
        const nextUsername = usernameInput.value.trim();
        if (!nextUsername) {
          setMessage('Wpisz nazwę użytkownika, aby zapisać zmiany.', 'error');
          usernameInput.focus();
          return;
        }
        if (!USERNAME_PATTERN.test(nextUsername)) {
          setMessage(
            'Nazwa użytkownika może zawierać litery, cyfry, kropki, myślniki i podkreślenia (3–30 znaków).',
            'error',
          );
          usernameInput.focus();
          return;
        }

        withBusy(submitter, async () => {
          try {
            const profile = await updateMyUsername(nextUsername);
            const client = getSupabaseClient();
            if (client) {
              try {
                await client.auth.updateUser({ data: { username: nextUsername } });
              } catch (metadataError) {
                console.warn('[account-modal] Nie udało się zaktualizować metadanych nazwy użytkownika.', metadataError);
              }
            }
            renderProfile(profile);
            updateProfileState(profile);
            setMessage('Nazwa użytkownika została zaktualizowana.', 'success');
            await refreshSessionAndProfile();
          } catch (error) {
            console.error('[account-modal] Nie udało się zaktualizować nazwy użytkownika.', error);
            const code = String(error?.code || '').toLowerCase();
            const message = String(error?.message || '').toLowerCase();
            if (code === '23505' || message.includes('duplicate') || message.includes('already exists')) {
              setMessage('Wybrana nazwa użytkownika jest już zajęta. Wybierz inną.', 'error');
              usernameInput.focus();
              return;
            }
            setMessage(
              `Nie udało się zapisać nazwy użytkownika: ${error?.message || 'spróbuj ponownie.'}`,
              'error',
            );
          }
        });
      });
    }

    if (nameForm && nameInput) {
      nameForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitter = nameForm.querySelector('button[type="submit"]');
        const nextName = nameInput.value.trim();
        if (!nextName) {
          setMessage('Wpisz imię, aby zapisać zmiany.', 'error');
          nameInput.focus();
          return;
        }
        if (nextName.length < 2) {
          setMessage('Imię powinno mieć co najmniej 2 znaki.', 'error');
          nameInput.focus();
          return;
        }

        withBusy(submitter, async () => {
          try {
            const profile = await updateMyName(nextName);
            renderProfile(profile);
            updateProfileState(profile);
            setMessage('Imię zostało zaktualizowane.', 'success');
            await refreshSessionAndProfile();
          } catch (error) {
            console.error('[account-modal] Nie udało się zaktualizować imienia.', error);
            setMessage(`Nie udało się zapisać imienia: ${error?.message || 'spróbuj ponownie.'}`, 'error');
          }
        });
      });
    }

    if (passwordForm && passwordCurrent && passwordNew && passwordConfirm) {
      passwordForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitter = passwordForm.querySelector('button[type="submit"]');
        const currentValue = passwordCurrent.value;
        const newValue = passwordNew.value;
        const confirmValue = passwordConfirm.value;

        if (!currentValue || !newValue || !confirmValue) {
          setMessage('Uzupełnij wszystkie pola hasła.', 'error');
          if (!currentValue) {
            passwordCurrent.focus();
          } else if (!newValue) {
            passwordNew.focus();
          } else {
            passwordConfirm.focus();
          }
          return;
        }

        if (newValue.length < 8) {
          setMessage('Hasło powinno mieć co najmniej 8 znaków.', 'error');
          passwordNew.focus();
          return;
        }

        if (newValue !== confirmValue) {
          setMessage('Nowe hasła nie są identyczne.', 'error');
          passwordConfirm.focus();
          return;
        }

        withBusy(submitter, async () => {
          const client = getSupabaseClient();
          if (!client) {
            setMessage('Nie udało się połączyć z usługą logowania. Spróbuj ponownie później.', 'error');
            return;
          }

          try {
            const {
              data: { user },
              error,
            } = await client.auth.getUser();
            if (error) {
              throw error;
            }
            if (!user?.email) {
              throw new Error('Nie udało się pobrać adresu e-mail konta.');
            }

            const { error: reauthError } = await client.auth.signInWithPassword({
              email: user.email,
              password: currentValue,
            });
            if (reauthError) {
              const invalid = new Error('INVALID_CURRENT_PASSWORD');
              invalid.code = 'invalid-current-password';
              throw invalid;
            }

            const { error: updateError } = await client.auth.updateUser({ password: newValue });
            if (updateError) {
              throw updateError;
            }

            passwordForm.reset();
            setMessage('Hasło zostało zaktualizowane.', 'success');
            await refreshSessionAndProfile();
          } catch (error) {
            console.error('[account-modal] Nie udało się zaktualizować hasła.', error);
            const code = String(error?.code || '').toLowerCase();
            const message = String(error?.message || '').toLowerCase();
            if (code === 'invalid-current-password' || message.includes('invalid login credentials')) {
              setMessage('Obecne hasło jest nieprawidłowe.', 'error');
              passwordCurrent.focus();
              return;
            }
            if (message.includes('not authenticated')) {
              setMessage('Sesja wygasła. Zaloguj się ponownie, aby zmienić hasło.', 'error');
              return;
            }
            setMessage(`Nie udało się zaktualizować hasła: ${error?.message || 'spróbuj ponownie.'}`, 'error');
          }
        });
      });
    }
  }

  document.addEventListener('ce-account:opened', async () => {
    await ensureInitialized();
    const state = window.CE_STATE || {};
    applyAuthState(state);
    if (state.session?.user) {
      await loadAccountData();
    }
  });

  document.addEventListener('ce-account:closed', () => {
    setLoading(false);
    loadPromise = null;
  });

  document.addEventListener('ce-auth:state', (event) => {
    applyAuthState(event.detail);
    if (isModalOpen() && event.detail?.session?.user) {
      void loadAccountData();
    }
  });

  // Apply initial state without waiting for modal interaction.
  applyAuthState(window.CE_STATE || {});
}

