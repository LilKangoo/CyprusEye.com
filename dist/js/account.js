import { waitForAuthReady, updateAuthUI } from './authUi.js';
import { refreshSessionAndProfile } from './auth.js';
import { getMyProfile, updateMyName, updateMyUsername, uploadAvatar, removeAvatar } from './profile.js';
import { myXpEvents } from './xp.js';

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/i;

const selectors = {
  message: document.querySelector('[data-account-message]'),
  loading: document.querySelector('[data-account-loading]'),
  content: document.querySelector('[data-account-content]'),
  email: document.querySelector('[data-account-email]'),
  username: document.querySelector('[data-account-username]'),
  nameDisplay: document.querySelector('[data-account-name]'),
  xp: document.querySelector('[data-account-xp]'),
  level: document.querySelector('[data-account-level]'),
  updated: document.querySelector('[data-account-updated]'),
  avatarImg: document.querySelector('#profileAvatarImg'),
  avatarUploadInput: document.querySelector('#avatarUpload'),
  avatarUploadBtn: document.querySelector('#btnUploadAvatar'),
  avatarRemoveBtn: document.querySelector('#btnRemoveAvatar'),
  usernameForm: document.querySelector('#form-account-username'),
  usernameInput: document.querySelector('#profile-username'),
  nameForm: document.querySelector('#form-account-name'),
  nameInput: document.querySelector('#profile-name'),
  passwordForm: document.querySelector('#form-account-password'),
  passwordCurrent: document.querySelector('#password-current'),
  passwordNew: document.querySelector('#password-new'),
  passwordConfirm: document.querySelector('#password-confirm'),
  xpList: document.querySelector('#xp-events'),
  xpEmpty: document.querySelector('#xp-empty'),
};

function getTabs() {
  return Array.from(document.querySelectorAll('[data-account-tab]'));
}

function getPanels() {
  return Array.from(document.querySelectorAll('[data-account-panel]'));
}

function getSupabaseClient() {
  if (typeof window.getSupabase === 'function') {
    try {
      return window.getSupabase();
    } catch (error) {
      console.warn('Nie udało się pobrać klienta Supabase.', error);
    }
  }
  return null;
}

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

function setLoading(isLoading) {
  const { loading, content } = selectors;
  if (loading) {
    loading.hidden = !isLoading;
  }
  if (content) {
    content.hidden = !!isLoading;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function renderProfile(profile) {
  const { email, username, nameDisplay, xp, level, updated, usernameInput, nameInput, avatarImg, avatarRemoveBtn } = selectors;
  if (email) {
    email.textContent = profile?.email ?? '—';
  }
  if (username) {
    username.textContent = profile?.username ? profile.username : '—';
  }
  if (nameDisplay) {
    nameDisplay.textContent = profile?.name ? profile.name : '—';
  }
  if (xp) {
    xp.textContent = typeof profile?.xp === 'number' ? profile.xp.toString() : '0';
  }
  if (level) {
    level.textContent = typeof profile?.level === 'number' ? profile.level.toString() : '0';
  }
  if (updated) {
    updated.textContent = formatDate(profile?.updated_at);
  }
  if (usernameInput) {
    usernameInput.value = typeof profile?.username === 'string' ? profile.username : '';
  }
  if (nameInput && typeof profile?.name === 'string') {
    nameInput.value = profile.name;
  } else if (nameInput) {
    nameInput.value = '';
  }
  
  // Avatar
  if (avatarImg) {
    const avatarUrl = profile?.avatar_url;
    if (avatarUrl) {
      avatarImg.src = avatarUrl;
      avatarImg.alt = `Avatar użytkownika ${profile?.name || profile?.username || ''}`;
    } else {
      avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e0e7ff'/%3E%3Cpath d='M50 45c8.284 0 15-6.716 15-15s-6.716-15-15-15-15 6.716-15 15 6.716 15 15 15zM20 75c0-16.569 13.431-30 30-30s30 13.431 30 30v10H20V75z' fill='%233b82f6'/%3E%3C/svg%3E";
      avatarImg.alt = 'Domyślny avatar';
    }
  }
  
  // Pokaż/ukryj przycisk usuwania avatara
  if (avatarRemoveBtn) {
    if (profile?.avatar_url) {
      avatarRemoveBtn.hidden = false;
    } else {
      avatarRemoveBtn.hidden = true;
    }
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
  const slice = Array.isArray(events) ? events.slice(0, 10) : [];
  if (!slice.length) {
    xpList.hidden = true;
    xpEmpty.hidden = false;
    return;
  }

  xpList.hidden = false;
  xpEmpty.hidden = true;
  slice.forEach((event) => {
    xpList.appendChild(createXpItem(event));
  });
}

async function withBusy(button, fn) {
  if (typeof fn !== 'function') return;
  const target =
    button instanceof HTMLButtonElement || button instanceof HTMLInputElement ? button : null;
  if (target) {
    if (target.disabled) {
      return;
    }
    target.disabled = true;
    target.dataset.busy = 'true';
  }
  try {
    return await fn();
  } finally {
    if (target) {
      delete target.dataset.busy;
      target.disabled = false;
    }
  }
}

function updateProfileState(profile) {
  window.CE_STATE = { ...(window.CE_STATE || {}), profile };
}

async function syncSession() {
  try {
    await refreshSessionAndProfile();
    updateAuthUI();
  } catch (error) {
    console.warn('Nie udało się odświeżyć stanu logowania.', error);
  }
}

function updateTabHash(tabId) {
  if (typeof window === 'undefined' || !window.history?.replaceState) {
    return;
  }
  try {
    const { pathname, search } = window.location;
    const hash = tabId && tabId !== 'stats' ? `#${tabId}` : '';
    window.history.replaceState(window.history.state, document.title, `${pathname}${search}${hash}`);
  } catch (error) {
    console.warn('Nie udało się zaktualizować adresu URL dla zakładki konta.', error);
  }
}

function setActiveTab(tabId) {
  const tabs = getTabs();
  const panels = getPanels();
  if (!tabs.length) {
    return null;
  }

  const available = tabs
    .map((tab) => (tab.dataset.accountTab || '').toLowerCase())
    .filter(Boolean);
  const normalized = typeof tabId === 'string' ? tabId.toLowerCase() : '';
  const target = available.includes(normalized) ? normalized : available[0];

  tabs.forEach((tab) => {
    const id = (tab.dataset.accountTab || '').toLowerCase();
    const isActive = id === target;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  panels.forEach((panel) => {
    const id = (panel.dataset.accountPanel || '').toLowerCase();
    const isActive = id === target;
    panel.classList.toggle('is-active', isActive);
    if (isActive) {
      panel.removeAttribute('hidden');
    } else if (!panel.hasAttribute('hidden')) {
      panel.setAttribute('hidden', '');
    }
  });

  updateTabHash(target);
  return target;
}

function resolveInitialTab() {
  if (typeof window === 'undefined') {
    return null;
  }
  const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : '';
  return hash || null;
}

function bindTabs() {
  const tabs = getTabs();
  if (!tabs.length) {
    return;
  }

  const focusTabByIndex = (index) => {
    if (!tabs.length) return;
    const normalizedIndex = ((index % tabs.length) + tabs.length) % tabs.length;
    const tab = tabs[normalizedIndex];
    if (tab) {
      const active = setActiveTab(tab.dataset.accountTab || '');
      if (active !== null) {
        tab.focus();
      }
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      setActiveTab(tab.dataset.accountTab || '');
    });

    tab.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          focusTabByIndex(index + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          focusTabByIndex(index - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusTabByIndex(0);
          break;
        case 'End':
          event.preventDefault();
          focusTabByIndex(tabs.length - 1);
          break;
        default:
          break;
      }
    });
  });
}

async function loadAccountData() {
  setLoading(true);
  try {
    const [profile, events] = await Promise.all([getMyProfile(), myXpEvents()]);
    updateProfileState(profile);
    renderProfile(profile);
    renderXpEvents(events);
    setMessage('');
  } catch (error) {
    console.error('Nie udało się wczytać danych konta.', error);
    setMessage(
      `Nie udało się wczytać danych konta: ${error?.message || 'spróbuj ponownie później.'}`,
      'error',
    );
  } finally {
    setLoading(false);
  }
}

function bindNameForm() {
  const { nameForm, nameInput } = selectors;
  if (!nameForm || !nameInput) {
    return;
  }

  nameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const submitButton = nameForm.querySelector('button[type="submit"]');
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

    withBusy(submitButton, async () => {
      try {
        const updatedProfile = await updateMyName(nextName);
        renderProfile(updatedProfile);
        updateProfileState(updatedProfile);
        setMessage('Imię zostało zaktualizowane.', 'success');
        await syncSession();
      } catch (error) {
        console.error('Nie udało się zaktualizować imienia.', error);
        setMessage(
          `Nie udało się zapisać imienia: ${error?.message || 'spróbuj ponownie.'}`,
          'error',
        );
      }
    });
  });
}

function bindUsernameForm() {
  const { usernameForm, usernameInput } = selectors;
  if (!usernameForm || !usernameInput) {
    return;
  }

  usernameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const submitButton = usernameForm.querySelector('button[type="submit"]');
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

    withBusy(submitButton, async () => {
      try {
        const updatedProfile = await updateMyUsername(nextUsername);
        const sb = getSupabaseClient();
        if (sb) {
          try {
            await sb.auth.updateUser({ data: { username: nextUsername } });
          } catch (metadataError) {
            console.warn('Nie udało się zaktualizować metadanych nazwy użytkownika.', metadataError);
          }
        }
        renderProfile(updatedProfile);
        updateProfileState(updatedProfile);
        setMessage('Nazwa użytkownika została zaktualizowana.', 'success');
        await syncSession();
      } catch (error) {
        console.error('Nie udało się zaktualizować nazwy użytkownika.', error);
        const code = error?.code ? String(error.code) : '';
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

function bindPasswordForm() {
  const { passwordForm, passwordCurrent, passwordNew, passwordConfirm } = selectors;
  if (!passwordForm || !passwordCurrent || !passwordNew || !passwordConfirm) {
    return;
  }

  passwordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const submitButton = passwordForm.querySelector('button[type="submit"]');
    const currentPassword = passwordCurrent.value;
    const newPassword = passwordNew.value;
    const confirmPassword = passwordConfirm.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('Uzupełnij wszystkie pola hasła.', 'error');
      if (!currentPassword) {
        passwordCurrent.focus();
      } else if (!newPassword) {
        passwordNew.focus();
      } else {
        passwordConfirm.focus();
      }
      return;
    }

    if (newPassword.length < 8) {
      setMessage('Hasło powinno mieć co najmniej 8 znaków.', 'error');
      passwordNew.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Nowe hasła nie są identyczne.', 'error');
      passwordConfirm.focus();
      return;
    }

    withBusy(submitButton, async () => {
      const sb = getSupabaseClient();
      if (!sb) {
        setMessage('Nie udało się połączyć z usługą logowania. Spróbuj ponownie później.', 'error');
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await sb.auth.getUser();
        if (userError) {
          throw userError;
        }
        if (!user?.email) {
          throw new Error('Nie udało się pobrać adresu e-mail konta.');
        }

        const { error: reauthError } = await sb.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (reauthError) {
          const invalid = new Error('INVALID_CURRENT_PASSWORD');
          invalid.code = 'invalid-current-password';
          throw invalid;
        }

        const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
        if (updateError) {
          throw updateError;
        }

        passwordForm.reset();
        setMessage('Hasło zostało zaktualizowane.', 'success');
        await syncSession();
      } catch (error) {
        console.error('Nie udało się zaktualizować hasła.', error);
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

        setMessage(
          `Nie udało się zaktualizować hasła: ${error?.message || 'spróbuj ponownie.'}`,
          'error',
        );
      }
    });
  });
}

function bindAvatarUpload() {
  const { avatarUploadInput, avatarUploadBtn, avatarRemoveBtn, avatarImg } = selectors;
  
  if (!avatarUploadInput || !avatarUploadBtn) {
    return;
  }

  // Kliknięcie przycisku otwiera selektor plików
  avatarUploadBtn.addEventListener('click', () => {
    avatarUploadInput.click();
  });

  // Upload pliku
  avatarUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await withBusy(avatarUploadBtn, async () => {
      try {
        setMessage('Przesyłanie zdjęcia...', 'info');
        const updatedProfile = await uploadAvatar(file);
        renderProfile(updatedProfile);
        updateProfileState(updatedProfile);
        setMessage('Zdjęcie profilowe zostało zaktualizowane.', 'success');
        await syncSession();
      } catch (error) {
        console.error('Nie udało się przesłać zdjęcia:', error);
        setMessage(`Nie udało się: ${error?.message || 'spróbuj ponownie'}`, 'error');
      } finally {
        // Wyczyść input żeby można było ponownie wybrać ten sam plik
        avatarUploadInput.value = '';
      }
    });
  });

  // Usuwanie avatara
  if (avatarRemoveBtn) {
    avatarRemoveBtn.addEventListener('click', async () => {
      if (!confirm('Czy na pewno chcesz usunąć zdjęcie profilowe?')) {
        return;
      }

      await withBusy(avatarRemoveBtn, async () => {
        try {
          setMessage('Usuwanie zdjęcia...', 'info');
          const updatedProfile = await removeAvatar();
          renderProfile(updatedProfile);
          updateProfileState(updatedProfile);
          setMessage('Zdjęcie profilowe zostało usunięte.', 'success');
          await syncSession();
        } catch (error) {
          console.error('Nie udało się usunąć zdjęcia:', error);
          setMessage(`Nie udało się: ${error?.message || 'spróbuj ponownie'}`, 'error');
        }
      });
    });
  }
}

async function ensureAuthenticated() {
  try {
    await waitForAuthReady();
  } catch (error) {
    console.error('Błąd inicjalizacji modułów uwierzytelniania.', error);
    setMessage('Nie udało się zainicjować modułu logowania.', 'error');
  }

  const state = window.CE_STATE || {};
  if (!state.session?.user) {
    window.location.replace('/auth/');
    return false;
  }
  return true;
}

async function init() {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) {
    return;
  }
  const initialTab = resolveInitialTab() || 'stats';
  setActiveTab(initialTab);
  bindTabs();
  bindUsernameForm();
  bindNameForm();
  bindPasswordForm();
  bindAvatarUpload();
  await loadAccountData();
}

init();
