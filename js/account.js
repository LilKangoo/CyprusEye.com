import { waitForAuthReady, updateAuthUI } from './authUi.js';
import { refreshSessionAndProfile } from './auth.js';
import { getMyProfile, updateMyName } from './profile.js';
import { myXpEvents } from './xp.js';

const selectors = {
  message: document.querySelector('[data-account-message]'),
  loading: document.querySelector('[data-account-loading]'),
  content: document.querySelector('[data-account-content]'),
  email: document.querySelector('[data-account-email]'),
  xp: document.querySelector('[data-account-xp]'),
  level: document.querySelector('[data-account-level]'),
  updated: document.querySelector('[data-account-updated]'),
  nameForm: document.querySelector('#form-account-name'),
  nameInput: document.querySelector('#profile-name'),
  xpList: document.querySelector('#xp-events'),
  xpEmpty: document.querySelector('#xp-empty'),
};

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
  const { email, xp, level, updated, nameInput } = selectors;
  if (email) {
    email.textContent = profile?.email ?? '—';
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
  if (nameInput && typeof profile?.name === 'string') {
    nameInput.value = profile.name;
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
  const target = button instanceof HTMLButtonElement ? button : null;
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

async function loadAccountData() {
  setLoading(true);
  try {
    const [profile, events] = await Promise.all([getMyProfile(), myXpEvents()]);
    window.CE_STATE = { ...(window.CE_STATE || {}), profile };
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
      return;
    }

    withBusy(submitButton, async () => {
      try {
        const updatedProfile = await updateMyName(nextName);
        renderProfile(updatedProfile);
        window.CE_STATE = { ...(window.CE_STATE || {}), profile: updatedProfile };
        setMessage('Imię zostało zaktualizowane.', 'success');
        await refreshSessionAndProfile();
        updateAuthUI();
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
  bindNameForm();
  await loadAccountData();
}

init();
