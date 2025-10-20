import { sb } from './supabaseClient.js';
import { updateAuthUI } from './authUi.js';

const $ = (selector, root = document) => root.querySelector(selector);
const PASSWORD_RESET_REDIRECT = 'https://cypruseye.com/auth/callback';
const VERIFICATION_REDIRECT = 'https://cypruseye.com/auth/';
let toastTimer = null;
let lastAuthEmail = '';

function readGuestState() {
  try {
    const raw = localStorage.getItem('ce_guest');
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
    console.warn('Nie udało się odczytać trybu gościa.', error);
  }
  return null;
}

function setDocumentAuthState(state) {
  const root = document.documentElement;
  if (root) {
    root.dataset.authState = state;
  }
}

function setState(next) {
  window.CE_STATE = {
    session: null,
    guest: null,
    profile: null,
    status: 'loading',
    ...(window.CE_STATE || {}),
    ...next,
  };
  if (next?.status) {
    setDocumentAuthState(next.status);
  }
}

function clearToast() {
  const messageEl = $('#authMessage');
  if (!messageEl) {
    return;
  }
  messageEl.textContent = '';
  messageEl.removeAttribute('data-tone');
  messageEl.removeAttribute('aria-live');
}

function getResendVerificationElements() {
  return {
    container: $('#authResendVerification'),
    button: $('#btn-resend-verification'),
  };
}

function hideResendVerification() {
  const { container, button } = getResendVerificationElements();
  if (container) {
    container.hidden = true;
  }
  if (button) {
    delete button.dataset.email;
    delete button.dataset.redirect;
    button.disabled = false;
  }
}

function showResendVerification(email) {
  const normalized = email?.trim();
  if (!normalized) {
    hideResendVerification();
    return;
  }
  const { container, button } = getResendVerificationElements();
  if (container) {
    container.hidden = false;
  }
  if (button) {
    button.dataset.email = normalized;
    button.dataset.redirect = VERIFICATION_REDIRECT;
  }
}

function showToast(msg, type = 'info') {
  const messageEl = $('#authMessage');
  if (!messageEl) {
    return;
  }

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  if (!msg) {
    clearToast();
    return;
  }

  messageEl.textContent = msg;
  messageEl.dataset.tone = type;
  messageEl.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  toastTimer = window.setTimeout(() => {
    clearToast();
  }, 6000);
}

async function withBusy(button, fn) {
  if (typeof fn !== 'function') {
    return;
  }

  if (!(button instanceof HTMLButtonElement)) {
    return await fn();
  }

  if (button.disabled) {
    return;
  }

  button.disabled = true;
  button.dataset.busy = 'true';
  try {
    return await fn();
  } finally {
    delete button.dataset.busy;
    button.disabled = false;
  }
}

function setFormBusy(form, busy) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  form.classList.toggle('is-loading', busy);
  form.querySelectorAll('input, button').forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
      el.disabled = busy;
    }
  });
}

function normalizeErrorMessage(message) {
  const map = {
    'Invalid login credentials': 'Błędny e-mail lub hasło.',
    'Email not confirmed': 'Potwierdź e-mail przed logowaniem.',
    'User already registered': 'Ten adres e-mail jest już zarejestrowany.',
  };
  if (message && map[message]) {
    return map[message];
  }
  if (message) {
    return `Błąd: ${message}`;
  }
  return 'Wystąpił nieznany błąd.';
}

async function handleAuth(result, okMsg) {
  const { error } = result || {};
  if (error) {
    showToast(normalizeErrorMessage(error.message || 'Nieznany błąd.'), 'error');
    return { success: false, error };
  }

  hideResendVerification();
  showToast(okMsg, 'success');
  try {
    const state = await refreshSessionAndProfile();
    updateAuthUI();
    if (state?.session?.user) {
      window.setTimeout(() => {
        window.location.assign('/');
      }, 400);
    }
  } catch (refreshError) {
    console.error('Nie udało się odświeżyć sesji po logowaniu.', refreshError);
  }
  return { success: true, data: result?.data ?? null };
}

function parseRegisterPayload(form) {
  const email = form.email?.value?.trim() || '';
  const password = form.password?.value || '';
  const firstName = form.firstName?.value?.trim() || '';
  const confirm = form.passwordConfirm?.value || '';

  if (!email || !password) {
    showToast('Podaj adres e-mail i hasło.', 'error');
    return null;
  }

  if (!firstName) {
    showToast('Podaj imię, aby utworzyć konto.', 'error');
    return null;
  }

  if (confirm && confirm !== password) {
    showToast('Hasła nie są identyczne.', 'error');
    return null;
  }

  return { email, password, firstName };
}

function ensureGuestState(state) {
  try {
    if (state) {
      localStorage.setItem('ce_guest', JSON.stringify(state));
    } else {
      localStorage.removeItem('ce_guest');
    }
  } catch (error) {
    console.warn('Nie udało się zapisać trybu gościa.', error);
  }
}

export async function refreshSessionAndProfile() {
  const guest = readGuestState();
  let session = null;

  try {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      throw error;
    }
    session = data?.session ?? null;
  } catch (error) {
    console.error('Nie udało się pobrać sesji Supabase.', error);
  }

  const state = { session, guest, profile: null };

  if (session?.user?.id) {
    try {
      const { data: prof, error: profileError } = await sb
        .from('profiles')
        .select('id,email,name,xp,level')
        .single();
      if (profileError) {
        throw profileError;
      }
      state.profile = prof || null;
      ensureGuestState(null);
      state.guest = null;
    } catch (profileError) {
      console.warn('Nie udało się pobrać profilu użytkownika.', profileError);
      state.profile = null;
    }
  }

  const status = session?.user ? 'authenticated' : state.guest?.active ? 'guest' : 'guest';
  setState({ ...state, status });
  document.dispatchEvent(new CustomEvent('ce-auth:state', { detail: window.CE_STATE }));
  return window.CE_STATE;
}

$('#form-login')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const email = form.email?.value?.trim() || '';
  const password = form.password?.value || '';
  if (!email || !password) {
    showToast('Podaj adres e-mail i hasło.', 'error');
    return;
  }

  lastAuthEmail = email;
  hideResendVerification();

  const submitButton =
    event.submitter instanceof HTMLButtonElement
      ? event.submitter
      : form.querySelector('button[type="submit"]');

  await withBusy(submitButton, async () => {
    setFormBusy(form, true);
    showToast('Łączenie z logowaniem…', 'info');
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      const outcome = await handleAuth({ data, error }, 'Zalogowano pomyślnie.');
      if (!outcome?.success && error?.message === 'Email not confirmed') {
        showResendVerification(email);
      }
    } catch (error) {
      showToast(normalizeErrorMessage(error.message || 'Nieznany błąd logowania.'), 'error');
      if (error?.message === 'Email not confirmed') {
        showResendVerification(email);
      }
    } finally {
      setFormBusy(form, false);
    }
  });
});

$('#form-register')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const payload = parseRegisterPayload(form);
  if (!payload) {
    return;
  }

  lastAuthEmail = payload.email;
  hideResendVerification();

  const submitButton =
    event.submitter instanceof HTMLButtonElement
      ? event.submitter
      : form.querySelector('button[type="submit"]');

  await withBusy(submitButton, async () => {
    setFormBusy(form, true);
    showToast('Tworzenie konta…', 'info');
    try {
      const { data, error } = await sb.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: { data: { name: payload.firstName } },
      });
      const outcome = await handleAuth({ data, error }, 'Sprawdź e-mail i potwierdź konto.');
      if (!outcome?.success && error?.message === 'Email not confirmed') {
        showResendVerification(payload.email);
      }
    } catch (error) {
      showToast(normalizeErrorMessage(error.message || 'Nieznany błąd rejestracji.'), 'error');
      if (error?.message === 'Email not confirmed') {
        showResendVerification(payload.email);
      }
    } finally {
      setFormBusy(form, false);
    }
  });
});

$('#btn-guest')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  void withBusy(button instanceof HTMLButtonElement ? button : null, async () => {
    const guestState = { active: true, since: Date.now() };
    ensureGuestState(guestState);
    setState({ session: null, profile: null, guest: guestState, status: 'guest' });
    updateAuthUI();
    window.location.assign('/');
  });
});

function closeResetDialog(dialog) {
  if (!dialog) {
    return;
  }
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.setAttribute('hidden', 'true');
  }
}

function openResetDialog() {
  const dialog = $('#resetPasswordDialog');
  if (!dialog) {
    return;
  }

  const emailField = dialog.querySelector('input[name="email"]');
  if (emailField instanceof HTMLInputElement && lastAuthEmail) {
    emailField.value = lastAuthEmail;
  }

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.removeAttribute('hidden');
  }

  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      closeResetDialog(dialog);
    },
    { once: true }
  );
}

$('#loginForgotPassword')?.addEventListener('click', (event) => {
  event.preventDefault();
  openResetDialog();
});

$('#btn-reset-close')?.addEventListener('click', (event) => {
  event.preventDefault();
  const dialog = $('#resetPasswordDialog');
  closeResetDialog(dialog);
});

$('#btn-reset-cancel')?.addEventListener('click', (event) => {
  event.preventDefault();
  const dialog = $('#resetPasswordDialog');
  closeResetDialog(dialog);
});

$('#form-reset-password')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const email = form.email?.value?.trim() || '';
  if (!email) {
    showToast('Podaj adres e-mail, aby zresetować hasło.', 'error');
    return;
  }

  const submitButton =
    event.submitter instanceof HTMLButtonElement
      ? event.submitter
      : form.querySelector('button[type="submit"]');

  await withBusy(submitButton, async () => {
    setFormBusy(form, true);
    try {
      await sb.auth.resetPasswordForEmail(email, {
        redirectTo: PASSWORD_RESET_REDIRECT,
      });
      showToast('Sprawdź skrzynkę e-mail i postępuj zgodnie z instrukcjami.', 'success');
      lastAuthEmail = email;
      const dialog = $('#resetPasswordDialog');
      closeResetDialog(dialog);
    } catch (error) {
      showToast(normalizeErrorMessage(error.message || 'Nie udało się wysłać resetu hasła.'), 'error');
    } finally {
      setFormBusy(form, false);
    }
  });
});

$('#btn-resend-verification')?.addEventListener('click', async (event) => {
  event.preventDefault();
  const button = event.currentTarget;
  const email = button instanceof HTMLButtonElement ? button.dataset.email || lastAuthEmail : lastAuthEmail;
  const redirect =
    button instanceof HTMLButtonElement && button.dataset.redirect ? button.dataset.redirect : VERIFICATION_REDIRECT;
  if (!email) {
    showToast('Podaj adres e-mail w formularzu logowania, aby wysłać link.', 'error');
    return;
  }

  await withBusy(button instanceof HTMLButtonElement ? button : null, async () => {
    try {
      await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect } });
      showToast('Nowy link potwierdzający został wysłany.', 'success');
      hideResendVerification();
    } catch (error) {
      showToast(normalizeErrorMessage(error.message || 'Nie udało się wysłać linku potwierdzającego.'), 'error');
    }
  });
});

setState({ status: 'loading', guest: readGuestState(), session: null });
refreshSessionAndProfile()
  .then(() => {
    updateAuthUI();
  })
  .catch((error) => {
    console.error('Błąd podczas inicjalizacji stanu logowania.', error);
    updateAuthUI();
  });

sb.auth.onAuthStateChange(async () => {
  await refreshSessionAndProfile();
  updateAuthUI();
});
