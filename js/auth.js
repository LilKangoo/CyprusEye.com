import { bootAuth, updateAuthUI } from './authUi.js';
import { showErr, showInfo, showOk } from './authMessages.js';
import { loadProfileForUser } from './profile.js';

const sb = window.getSupabase();

const $ = (selector, root = document) => root.querySelector(selector);
const PASSWORD_RESET_REDIRECT = 'https://cypruseye.com/reset/';
const VERIFICATION_REDIRECT = 'https://cypruseye.com/auth/';
let lastAuthEmail = '';
const SUPABASE_RETURN_PARAMS = new Set([
  'access_token',
  'token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_hash',
  'type',
  'code',
  'error',
  'error_description',
  'provider_token',
  'provider_refresh_token',
  'state',
]);

function parseSupabaseReturnParams() {
  if (typeof window === 'undefined') {
    return null;
  }

  let currentUrl;
  try {
    currentUrl = new URL(window.location.href);
  } catch (error) {
    console.warn('Nie udało się odczytać adresu URL dla Supabase.', error);
    return null;
  }

  const searchParams = new URLSearchParams(currentUrl.search);
  const rawHash = currentUrl.hash?.startsWith('#') ? currentUrl.hash.slice(1) : currentUrl.hash;
  let hashSource = rawHash || '';
  let hashPrefix = '';

  if (hashSource.startsWith('/?')) {
    hashSource = hashSource.slice(2);
  } else if (hashSource.startsWith('?')) {
    hashSource = hashSource.slice(1);
  } else {
    const questionIndex = hashSource.indexOf('?');
    if (questionIndex !== -1) {
      hashPrefix = hashSource.slice(0, questionIndex);
      hashSource = hashSource.slice(questionIndex + 1);
    }
  }

  const hashParams = hashSource && hashSource.includes('=') ? new URLSearchParams(hashSource) : null;
  const typeValue = (searchParams.get('type') || hashParams?.get('type') || '').toLowerCase();

  return { currentUrl, searchParams, rawHash, hashParams, hashPrefix, typeValue };
}

function stripSupabaseReturnParams(parsed) {
  if (!parsed) {
    return false;
  }

  const { currentUrl, searchParams, hashParams, rawHash, hashPrefix } = parsed;
  let updated = false;

  SUPABASE_RETURN_PARAMS.forEach((key) => {
    if (searchParams.has(key)) {
      searchParams.delete(key);
      updated = true;
    }
  });

  let cleanedHash = '';
  if (hashParams) {
    SUPABASE_RETURN_PARAMS.forEach((key) => {
      if (hashParams.has(key)) {
        hashParams.delete(key);
        updated = true;
      }
    });
    cleanedHash = hashParams.toString();
    if (hashPrefix) {
      cleanedHash = cleanedHash ? `${hashPrefix}?${cleanedHash}` : hashPrefix;
    }
    if (!cleanedHash && rawHash) {
      updated = true;
    }
  }

  const cleanedSearch = searchParams.toString();
  if (!updated) {
    return false;
  }

  const searchPart = cleanedSearch ? `?${cleanedSearch}` : '';
  const hashPart = cleanedHash ? `#${cleanedHash}` : '';
  const newUrl = `${currentUrl.pathname}${searchPart}${hashPart}`;

  try {
    window.history.replaceState(window.history.state, document.title, newUrl);
  } catch (error) {
    console.warn('Nie udało się wyczyścić parametrów Supabase z adresu URL.', error);
  }

  return true;
}

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

const AUTH_REDIRECT_TARGETS = new Set(['/', '/account/']);

function normalizeRedirectTarget(target) {
  if (!target || typeof target !== 'string') {
    return null;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (AUTH_REDIRECT_TARGETS.has(trimmed)) {
    return trimmed;
  }
  if (AUTH_REDIRECT_TARGETS.has(lower)) {
    return lower;
  }
  if (lower === 'account' || lower === '/account') {
    return '/account/';
  }
  if (lower === 'home' || lower === 'index' || lower === './' || lower === '.') {
    return '/';
  }
  if (lower === '//account') {
    return '/account/';
  }
  if (lower === '//') {
    return '/';
  }

  return null;
}

function pickDatasetRedirect(source) {
  if (!source || typeof source.dataset !== 'object') {
    return null;
  }
  return normalizeRedirectTarget(source.dataset.authRedirect);
}

function resolvePostAuthRedirect(...preferred) {
  for (const candidate of preferred) {
    const normalized = normalizeRedirectTarget(candidate);
    if (normalized) {
      return normalized;
    }
  }

  try {
    const meta = document.querySelector('meta[name="ce-auth-redirect"]');
    if (meta?.content) {
      const metaRedirect = normalizeRedirectTarget(meta.content);
      if (metaRedirect) {
        return metaRedirect;
      }
    }
  } catch (error) {
    console.warn('Nie udało się odczytać meta ce-auth-redirect.', error);
  }

  const searchRedirect = (() => {
    try {
      const url = new URL(window.location.href);
      return normalizeRedirectTarget(url.searchParams.get('redirect'));
    } catch (error) {
      console.warn('Nie udało się sparsować adresu URL pod kątem redirect.', error);
      return null;
    }
  })();
  if (searchRedirect) {
    return searchRedirect;
  }

  const docRedirect = pickDatasetRedirect(document.documentElement);
  if (docRedirect) {
    return docRedirect;
  }

  const bodyRedirect = pickDatasetRedirect(document.body);
  if (bodyRedirect) {
    return bodyRedirect;
  }

  return window.location.pathname.startsWith('/account') ? '/account/' : '/';
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


async function requestPasswordReset(email) {
  const normalized = email?.trim();
  if (!normalized) {
    throw new Error('Nieprawidłowy adres e-mail resetu hasła.');
  }

  return sb.auth.resetPasswordForEmail(normalized, {
    redirectTo: PASSWORD_RESET_REDIRECT,
  });
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

function friendlyErrorMessage(message) {
  const fallback = 'Spróbuj ponownie później.';
  const map = {
    'Invalid login credentials': 'Błędny e-mail lub hasło.',
    'Email not confirmed': 'Potwierdź e-mail przed logowaniem.',
    'User already registered': 'Ten adres e-mail jest już zarejestrowany.',
    'Invalid email': 'Podaj poprawny e-mail.',
    'Reset password token has expired or is invalid': 'Link resetujący wygasł. Poproś o nowy.',
  };

  const raw = typeof message === 'string' ? message.trim() : '';
  if (!raw) {
    return fallback;
  }
  if (map[raw]) {
    return map[raw];
  }

  if (/https?:\/\//i.test(raw) || /stack/i.test(raw) || raw.includes('\n')) {
    return fallback;
  }

  if (raw.length > 160) {
    return `${raw.slice(0, 157)}…`;
  }

  return raw;
}

async function handleAuth(result, okMsg, redirectHint) {
  const { error } = result || {};
  if (error) {
    const message = friendlyErrorMessage(error.message || '');
    showErr(`Nie udało się: ${message}`);
    return { success: false, error };
  }

  hideResendVerification();
  showOk(okMsg);
  try {
    await refreshSessionAndProfile();
    updateAuthUI();
  } catch (refreshError) {
    const message = friendlyErrorMessage(refreshError?.message || 'Odświeżenie sesji po logowaniu.');
    showErr(`Nie udało się: ${message}`);
    console.warn('Nie udało się odświeżyć sesji po logowaniu.', refreshError);
  }

  try {
    await bootAuth();
  } catch (bootError) {
    console.warn('Nie udało się ponownie zainicjalizować bootAuth po logowaniu.', bootError);
  }

  const redirectTarget = resolvePostAuthRedirect(redirectHint);
  const state = (window.CE_STATE = window.CE_STATE || {});
  state.postAuthRedirect = redirectTarget;

  try {
    document.dispatchEvent(
      new CustomEvent('ce-auth:post-login', {
        detail: { redirectTarget },
      }),
    );
  } catch (dispatchError) {
    console.warn('Nie udało się powiadomić o zakończeniu logowania.', dispatchError);
  }

  return { success: true, data: result?.data ?? null, redirectTarget };
}

function parseRegisterPayload(form) {
  const email = form.email?.value?.trim() || '';
  const password = form.password?.value || '';
  const firstName = form.firstName?.value?.trim() || '';
  const confirm = form.passwordConfirm?.value || '';

  if (!email) {
    showErr('Podaj poprawny e-mail.');
    return null;
  }

  if (!password) {
    showErr('Podaj hasło.');
    return null;
  }

  if (!firstName) {
    showErr('Podaj imię, aby utworzyć konto.');
    return null;
  }

  if (confirm && confirm !== password) {
    showErr('Hasła nie są identyczne.');
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
    const message = friendlyErrorMessage(error?.message || 'Nie udało się pobrać sesji Supabase.');
    showErr(`Nie udało się: ${message}`);
    console.warn('Nie udało się pobrać sesji Supabase.', error);
  }

  const state = { session, guest, profile: null };

  if (session?.user?.id) {
    try {
      state.profile = await loadProfileForUser(session.user);
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
  if (!email) {
    showErr('Podaj poprawny e-mail.');
    return;
  }

  if (!password) {
    showErr('Podaj hasło.');
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
    showInfo('Łączenie z logowaniem…');
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      const outcome = await handleAuth(
        { data, error },
        'Zalogowano.',
        submitButton?.dataset?.authRedirect || form.dataset?.authRedirect || '/account/',
      );
      if (!outcome?.success && error?.message === 'Email not confirmed') {
        showResendVerification(email);
      }
    } catch (error) {
      const message = friendlyErrorMessage(error?.message || 'Nie udało się zalogować.');
      showErr(`Nie udało się: ${message}`);
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

  const emailField = form.email;
  if (emailField instanceof HTMLInputElement) {
    emailField.value = emailField.value.trim();
  }

  const firstNameField = form.firstName;
  if (firstNameField instanceof HTMLInputElement) {
    firstNameField.value = firstNameField.value.trim();
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

  if (submitButton instanceof HTMLButtonElement && submitButton.disabled) {
    return;
  }

  await withBusy(submitButton, async () => {
    setFormBusy(form, true);
    showInfo('Tworzenie konta…');
    try {
      const { data, error } = await sb.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: { name: payload.firstName?.trim() || '' },
          emailRedirectTo: VERIFICATION_REDIRECT,
        },
      });
      if (error) {
        const message = friendlyErrorMessage(error.message);
        showErr(`Nie udało się: ${message}`);
        if (error.message === 'Email not confirmed') {
          showResendVerification(payload.email);
        }
        return;
      }

      if (data?.user) {
        try {
          await refreshSessionAndProfile();
          updateAuthUI();
        } catch (profileError) {
          console.warn('Nie udało się odświeżyć stanu po rejestracji.', profileError);
        }
        try {
          await bootAuth();
        } catch (bootError) {
          console.warn('Nie udało się ponownie zainicjalizować bootAuth po rejestracji.', bootError);
        }
      }

      showOk('E-mail potwierdzający wysłany.');
    } catch (error) {
      const message = friendlyErrorMessage(error?.message || 'Wystąpił błąd rejestracji.');
      showErr(`Nie udało się: ${message}`);
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
    showErr('Podaj poprawny e-mail.');
    return;
  }

  const submitButton =
    event.submitter instanceof HTMLButtonElement
      ? event.submitter
      : form.querySelector('button[type="submit"]');

  await withBusy(submitButton, async () => {
    setFormBusy(form, true);
    try {
      await requestPasswordReset(email);
      showOk('Sprawdź skrzynkę – link do resetu wysłany.');
      lastAuthEmail = email;
      const dialog = $('#resetPasswordDialog');
      closeResetDialog(dialog);
    } catch (error) {
      const message = friendlyErrorMessage(error?.message || 'Nie udało się wysłać resetu hasła.');
      showErr(`Nie udało się: ${message}`);
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
    showErr('Podaj poprawny e-mail.');
    return;
  }

  await withBusy(button instanceof HTMLButtonElement ? button : null, async () => {
    try {
      await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect } });
      showOk('E-mail potwierdzający wysłany.');
      hideResendVerification();
    } catch (error) {
      const message = friendlyErrorMessage(error?.message || 'Nie udało się wysłać linku potwierdzającego.');
      showErr(`Nie udało się: ${message}`);
    }
  });
});

function handleSupabaseVerificationReturn() {
  const parsed = parseSupabaseReturnParams();
  if (!parsed || parsed.typeValue !== 'signup') {
    return;
  }

  showOk('E-mail potwierdzony. Możesz się zalogować.', 6500);
  stripSupabaseReturnParams(parsed);
}

function handleSupabaseRecoveryReturn(onDetected) {
  const parsed = parseSupabaseReturnParams();
  if (!parsed || parsed.typeValue !== 'recovery') {
    return;
  }

  if (typeof onDetected === 'function') {
    try {
      onDetected(parsed);
    } catch (error) {
      const message = friendlyErrorMessage(error?.message || 'Błąd podczas obsługi resetu Supabase.');
      showErr(`Nie udało się: ${message}`);
      console.warn('Błąd podczas obsługi resetu Supabase.', error);
    }
  }

  stripSupabaseReturnParams(parsed);
}

function initResetPage() {
  const form = document.getElementById('resetForm');
  const messageEl = document.getElementById('resetMessage');

  if (!(form instanceof HTMLFormElement) || !messageEl) {
    handleSupabaseRecoveryReturn();
    return;
  }

  const emailField = form.querySelector('input[name="email"]');
  const passwordField = form.querySelector('input[name="newPassword"]');
  const confirmField = form.querySelector('input[name="newPasswordConfirm"]');
  const passwordSection = form.querySelector('[data-reset-section="password"]');
  const submitButton = form.querySelector('button[type="submit"]');
  const defaultSubmitLabel = submitButton?.textContent?.trim() || 'Wyślij link resetujący';
  const recoverySubmitLabel = submitButton?.dataset?.resetLabel?.trim() || 'Ustaw nowe hasło';

  let hasRecoverySession = false;

  function setResetMessage(msg, tone = 'info') {
    if (!messageEl) {
      return;
    }

    if (!msg) {
      messageEl.textContent = '';
      messageEl.removeAttribute('data-tone');
      messageEl.setAttribute('aria-live', 'polite');
      return;
    }

    messageEl.textContent = msg;
    if (tone) {
      messageEl.dataset.tone = tone;
    } else {
      messageEl.removeAttribute('data-tone');
    }
    messageEl.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  }

  function togglePasswordSection(visible) {
    if (!passwordSection) {
      return;
    }

    passwordSection.hidden = !visible;
    passwordSection.querySelectorAll('input').forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.disabled = !visible;
        if (!visible) {
          input.value = '';
        }
      }
    });
  }

  function applyResetSession(session, { announce = false } = {}) {
    const user = session?.user || null;
    hasRecoverySession = Boolean(user);

    togglePasswordSection(hasRecoverySession);

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.textContent = hasRecoverySession ? recoverySubmitLabel : defaultSubmitLabel;
    }

    if (emailField instanceof HTMLInputElement) {
      if (user?.email) {
        emailField.value = user.email;
      }
      if (hasRecoverySession) {
        emailField.setAttribute('readonly', 'true');
      } else {
        emailField.removeAttribute('readonly');
      }
    }

    if (announce && hasRecoverySession && !messageEl.textContent) {
      setResetMessage('Link potwierdzony. Ustaw nowe hasło.', 'info');
    }
  }

  async function syncResetSession({ announce = false } = {}) {
    let session = null;
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) {
        throw error;
      }
      session = data?.session ?? null;
    } catch (error) {
      console.warn('Nie udało się pobrać sesji Supabase dla resetu hasła.', error);
    }

    applyResetSession(session, { announce });
    return session;
  }

  handleSupabaseRecoveryReturn(() => {
    if (!messageEl.textContent) {
      setResetMessage('Link potwierdzony. Ustaw nowe hasło.', 'info');
    }
  });

  void syncResetSession({ announce: true });

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      applyResetSession(session, { announce: event === 'PASSWORD_RECOVERY' });
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (emailField instanceof HTMLInputElement) {
      emailField.value = emailField.value.trim();
    }

    const submitter =
      event.submitter instanceof HTMLButtonElement
        ? event.submitter
        : submitButton instanceof HTMLButtonElement
        ? submitButton
        : null;

    const email = emailField instanceof HTMLInputElement ? emailField.value.trim() : '';
    const newPassword = passwordField instanceof HTMLInputElement ? passwordField.value : '';
    const confirmPassword = confirmField instanceof HTMLInputElement ? confirmField.value : '';
    const recoveryActive = hasRecoverySession;

    await withBusy(submitter, async () => {
      setFormBusy(form, true);
      try {
        if (recoveryActive) {
          if (!newPassword || newPassword.length < 6) {
            setResetMessage('Podaj nowe hasło (min. 6 znaków).', 'error');
            return;
          }

          if (newPassword !== confirmPassword) {
            setResetMessage('Hasła nie są identyczne.', 'error');
            return;
          }

          setResetMessage('Aktualizowanie hasła…', 'info');
          const {
            data: { session } = { session: null },
            error,
          } = await sb.auth.updateUser({ password: newPassword });

          if (error) {
            setResetMessage(friendlyErrorMessage(error.message || 'Nie udało się zaktualizować hasła.'), 'error');
            return;
          }

          setResetMessage('Hasło zostało zaktualizowane. Możesz się zalogować.', 'success');

          if (passwordField instanceof HTMLInputElement) {
            passwordField.value = '';
          }
          if (confirmField instanceof HTMLInputElement) {
            confirmField.value = '';
          }

          try {
            await refreshSessionAndProfile();
            updateAuthUI();
          } catch (refreshError) {
            console.warn('Nie udało się odświeżyć stanu po zmianie hasła.', refreshError);
          }

          await syncResetSession();
          return;
        }

        if (!email) {
          setResetMessage('Podaj adres e-mail, aby zresetować hasło.', 'error');
          return;
        }

        setResetMessage('Wysyłanie linku resetującego…', 'info');
        try {
          await requestPasswordReset(email);
          lastAuthEmail = email;
          setResetMessage('Sprawdź skrzynkę e-mail i postępuj zgodnie z instrukcjami.', 'success');
        } catch (error) {
          setResetMessage(friendlyErrorMessage(error.message || 'Nie udało się wysłać resetu hasła.'), 'error');
        }
      } finally {
        setFormBusy(form, false);
      }
    });
  });
}

function handleAuthDomReady() {
  handleSupabaseVerificationReturn();
  initResetPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleAuthDomReady, { once: true });
} else {
  handleAuthDomReady();
}

setState({ status: 'loading', guest: readGuestState(), session: null });
refreshSessionAndProfile()
  .then(() => {
    updateAuthUI();
  })
  .catch((error) => {
    const message = friendlyErrorMessage(error?.message || 'Błąd podczas inicjalizacji stanu logowania.');
    showErr(`Nie udało się: ${message}`);
    console.warn('Błąd podczas inicjalizacji stanu logowania.', error);
    updateAuthUI();
  });

sb.auth.onAuthStateChange(async () => {
  await refreshSessionAndProfile();
  updateAuthUI();
});
