import { bootAuth, updateAuthUI } from './authUi.js?v=3';
import { showErr, showInfo, showOk } from './authMessages.js';
import { loadProfileForUser } from './profile.js';
import { URLS } from './config.js';
import {
  processReferralAfterRegistration,
  getStoredReferralCode,
  setStoredReferralCode,
  clearStoredReferralCode,
} from './referral.js';

const sb = window.getSupabase();
const ceAuthGlobal = typeof window !== 'undefined' ? (window.CE_AUTH = window.CE_AUTH || {}) : null;
const IS_PASSWORD_RESET_CALLBACK =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback');

const GOOGLE_OAUTH_REDIRECT = 'https://cypruseye.com/auth/';
const POST_AUTH_REDIRECT = '/';
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 15;
const OAUTH_COMPLETION_DRAFT_KEY = 'ce_oauth_register_draft_v1';
const OAUTH_COMPLETION_META_KEY = 'oauth_registration_completed';
const OAUTH_COMPLETION_LOCAL_PREFIX = 'ce_oauth_completed_user_';

let oauthCompletionModal = null;
let oauthCompletionSubmitting = false;
let oauthCompletionRedirectTarget = POST_AUTH_REDIRECT;

function isOAuthCompletionMarked(user) {
  const value = user?.user_metadata?.[OAUTH_COMPLETION_META_KEY];
  if (value === true || String(value).toLowerCase() === 'true' || value === 1) return true;
  try {
    const userId = String(user?.id || '').trim();
    if (!userId) return false;
    return window.localStorage.getItem(`${OAUTH_COMPLETION_LOCAL_PREFIX}${userId}`) === '1';
  } catch (_e) {
    return false;
  }
}

function markOAuthCompletionLocal(userId) {
  try {
    const id = String(userId || '').trim();
    if (!id) return;
    window.localStorage.setItem(`${OAUTH_COMPLETION_LOCAL_PREFIX}${id}`, '1');
  } catch (_e) {
  }
}

function clearOAuthCompletionLocal(userId) {
  try {
    const id = String(userId || '').trim();
    if (!id) return;
    window.localStorage.removeItem(`${OAUTH_COMPLETION_LOCAL_PREFIX}${id}`);
  } catch (_e) {
  }
}

function createCallbackResetLayout() {
  const body = document.body;
  if (!body) return;

  body.classList.add('auth-page');
  body.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'auth-page__container';
  container.innerHTML = `
    <header class="auth-page__header">
      <h1 class="auth-page__title">${t('Set a new password', 'Ustaw nowe hasło')}</h1>
      <p class="auth-page__subtitle">
        ${t(
          'Enter a new password to finish the account recovery process.',
          'Wpisz nowe hasło, aby zakończyć proces odzyskiwania konta.',
        )}
      </p>
    </header>
    <main class="auth-page__content">
      <div id="authMessage" class="auth-message" role="status" aria-live="polite"></div>
      <form id="form-password-update" class="auth-form" novalidate>
        <p id="resetMessage" class="auth-message" role="status" aria-live="polite">
          ${t('Checking recovery link…', 'Sprawdzamy link odzyskiwania…')}
        </p>
        <label for="resetNewPassword">${t('New password', 'Nowe hasło')}</label>
        <input
          id="resetNewPassword"
          name="password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
        />
        <label for="resetNewPasswordConfirm">${t('Confirm password', 'Powtórz hasło')}</label>
        <input
          id="resetNewPasswordConfirm"
          name="passwordConfirm"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
        />
        <div class="auth-form__actions">
          <button type="submit" class="btn btn--primary">${t('Save new password', 'Zapisz nowe hasło')}</button>
          <button type="button" class="auth-form__link" id="resetBackToAuth">
            ${t('Back to sign in', 'Wróć do logowania')}
          </button>
        </div>
      </form>
    </main>
  `;

  body.appendChild(container);
}

function setCallbackMessage(text, tone = 'info') {
  const messageEl = document.getElementById('resetMessage');
  if (!messageEl) return;
  messageEl.textContent = text || '';
  if (tone) {
    messageEl.dataset.tone = tone;
    messageEl.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  } else {
    messageEl.removeAttribute('data-tone');
    messageEl.removeAttribute('aria-live');
  }
}

function setCallbackFormDisabled(disabled) {
  const form = document.getElementById('form-password-update');
  if (!(form instanceof HTMLFormElement)) return;
  form.querySelectorAll('input, button').forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
      el.disabled = disabled;
    }
  });
}

async function applyCallbackSessionFromHash() {
  const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
  if (!hash) {
    return;
  }

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
}

async function ensureCallbackRecoverySession() {
  setCallbackMessage(t('Checking recovery link…', 'Sprawdzamy link odzyskiwania…'), 'info');
  setCallbackFormDisabled(true);

  try {
    await applyCallbackSessionFromHash();
    const { data, error } = await sb.auth.getSession();
    if (error) {
      throw error;
    }
    const session = data?.session;
    if (!session?.user) {
      setCallbackMessage(
        t('The recovery link is invalid or has expired.', 'Link odzyskiwania jest nieprawidłowy lub wygasł.'),
        'error',
      );
      return false;
    }
    setCallbackFormDisabled(false);
    setCallbackMessage(t('Enter a new password for your account.', 'Wprowadź nowe hasło dla swojego konta.'), 'info');
    return true;
  } catch (error) {
    console.error('Nie udało się zweryfikować linku resetu hasła.', error);
    setCallbackMessage(
      `${t('Error', 'Błąd')}: ${error.message || t('Could not verify the link.', 'Nie udało się zweryfikować linku.')}`,
      'error',
    );
    return false;
  }
}

async function handleCallbackPasswordUpdate(event) {
  event.preventDefault();
  event.stopPropagation();

  const form = document.getElementById('form-password-update');
  if (!(form instanceof HTMLFormElement)) return;

  const password = form.password?.value || '';
  const confirm = form.passwordConfirm?.value || '';

  if (!password || password.length < 8) {
    setCallbackMessage(t('Password must be at least 8 characters.', 'Hasło musi mieć co najmniej 8 znaków.'), 'error');
    return;
  }

  if (password !== confirm) {
    setCallbackMessage(t('Passwords do not match.', 'Hasła nie są identyczne.'), 'error');
    return;
  }

  setCallbackFormDisabled(true);
  setCallbackMessage(t('Saving new password…', 'Zapisujemy nowe hasło…'), 'info');

  try {
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      throw error;
    }
    setCallbackMessage(
      t('Password updated. Redirecting to home…', 'Hasło zostało zaktualizowane. Przenosimy na stronę główną…'),
      'success',
    );
    window.setTimeout(() => {
      window.location.assign('/');
    }, 800);
  } catch (error) {
    console.error('Nie udało się zaktualizować hasła.', error);
    setCallbackFormDisabled(false);
    setCallbackMessage(
      `${t('Error', 'Błąd')}: ${error.message || t('Could not save the new password.', 'Nie udało się zapisać nowego hasła.')}`,
      'error',
    );
  }
}

function initPasswordResetCallbackPageIfNeeded() {
  if (!IS_PASSWORD_RESET_CALLBACK) return;

  createCallbackResetLayout();

  const form = document.getElementById('form-password-update');
  const backButton = document.getElementById('resetBackToAuth');

  if (form instanceof HTMLFormElement) {
    void ensureCallbackRecoverySession().then((ready) => {
      if (ready) {
        form.addEventListener('submit', handleCallbackPasswordUpdate);
      }
    });
  }

  if (backButton instanceof HTMLButtonElement) {
    backButton.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.assign('/auth/');
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordResetCallbackPageIfNeeded, { once: true });
  } else {
    initPasswordResetCallbackPageIfNeeded();
  }
}

const $ = (selector, root = document) => root.querySelector(selector);
const PASSWORD_RESET_REDIRECT = URLS.passwordReset;
const VERIFICATION_REDIRECT = URLS.verification;
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

function escapeLikePattern(value) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) {
    return '';
  }
  return raw.replace(/\\/g, '\\\\').replace(/[%_]/g, (match) => `\\${match}`);
}

async function fetchProfileByUsername(username, columns) {
  const normalized = typeof username === 'string' ? username.trim() : '';
  if (!normalized) {
    return null;
  }

  const { data, error } = await sb
    .from('profiles')
    .select(columns)
    .ilike('username', escapeLikePattern(normalized))
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
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
    profile: null,
    status: 'loading',
    ...(window.CE_STATE || {}),
    ...next,
  };
  if (next?.status) {
    setDocumentAuthState(next.status);
  }
}

function emitAuthState(detail) {
  try {
    document.dispatchEvent(new CustomEvent('ce-auth:state', { detail }));
  } catch (error) {
    console.warn('Nie udało się wysłać zdarzenia stanu logowania.', error);
  }
}

const AUTH_SESSION_STORAGE_KEY = 'ce_auth_session_v1';

function getAuthStorage() {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage || null;
  } catch (error) {
    console.warn('Nie udało się uzyskać dostępu do localStorage dla sesji.', error);
    return null;
  }
}

function sanitizeSessionForStorage(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const accessToken = typeof session.access_token === 'string' ? session.access_token : '';
  const refreshToken = typeof session.refresh_token === 'string' ? session.refresh_token : '';
  const tokenType = typeof session.token_type === 'string' && session.token_type ? session.token_type : 'bearer';
  const expiresAtValue = Number(session.expires_at);
  const expiresAt = Number.isFinite(expiresAtValue) ? expiresAtValue : null;
  const expiresInValue = Number(session.expires_in);
  const expiresIn = Number.isFinite(expiresInValue) ? expiresInValue : null;
  const user = session.user;

  if (!accessToken || !user || typeof user !== 'object' || !user.id) {
    return null;
  }

  const sanitizedUser = { id: user.id };
  if (typeof user.email === 'string' && user.email.trim()) {
    sanitizedUser.email = user.email.trim();
  }

  const metadata = user.user_metadata;
  if (metadata && typeof metadata === 'object') {
    const sanitizedMetadata = {};
    const metadataKeys = [
      'name',
      'full_name',
      'display_name',
      'preferred_username',
      'first_name',
      'username',
    ];
    metadataKeys.forEach((key) => {
      const value = metadata[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          sanitizedMetadata[key] = trimmed;
        }
      }
    });
    if (Object.keys(sanitizedMetadata).length > 0) {
      sanitizedUser.user_metadata = sanitizedMetadata;
    }
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken || null,
    token_type: tokenType,
    expires_at: expiresAt,
    expires_in: expiresIn,
    user: sanitizedUser,
  };
}

function sanitizeProfileForStorage(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const candidates = [profile.name, profile.username, profile.full_name];
  let resolvedName = '';
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        resolvedName = trimmed;
        break;
      }
    }
  }

  const sanitized = {};
  if (resolvedName) {
    sanitized.name = resolvedName;
  }
  if (typeof profile.email === 'string' && profile.email.trim()) {
    sanitized.email = profile.email.trim();
  }

  const xpValue = Number(profile.xp);
  if (Number.isFinite(xpValue)) {
    sanitized.xp = xpValue;
  }

  const levelValue = Number(profile.level);
  if (Number.isFinite(levelValue)) {
    sanitized.level = levelValue;
  }

  const updatedAtValue =
    (typeof profile.updated_at === 'string' && profile.updated_at.trim()) ||
    (typeof profile.updatedAt === 'string' && profile.updatedAt.trim()) ||
    '';
  if (updatedAtValue) {
    sanitized.updatedAt = updatedAtValue;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function resolveStoredDisplayName(sessionSnapshot, profileSnapshot) {
  const candidates = [];
  if (profileSnapshot && typeof profileSnapshot === 'object') {
    candidates.push(profileSnapshot.name, profileSnapshot.username, profileSnapshot.full_name);
  }

  const metadata = sessionSnapshot?.user?.user_metadata;
  if (metadata && typeof metadata === 'object') {
    candidates.push(
      metadata.name,
      metadata.full_name,
      metadata.display_name,
      metadata.preferred_username,
      metadata.first_name,
      metadata.username,
    );
  }

  if (typeof sessionSnapshot?.user?.email === 'string') {
    candidates.push(sessionSnapshot.user.email);
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return '';
}

function persistAuthSession(session, profile) {
  const storage = getAuthStorage();
  if (!storage) {
    return;
  }

  if (!session) {
    try {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Nie udało się usunąć zapisanej sesji logowania.', error);
    }
    return;
  }

  const sanitizedSession = sanitizeSessionForStorage(session);
  if (!sanitizedSession) {
    try {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Nie udało się usunąć zapisanej sesji logowania.', error);
    }
    return;
  }

  const sanitizedProfile = sanitizeProfileForStorage(profile);
  const displayName = resolveStoredDisplayName(sanitizedSession, sanitizedProfile);

  const payload = {
    version: 1,
    savedAt: Date.now(),
    session: sanitizedSession,
    profile: sanitizedProfile,
    displayName,
  };

  try {
    storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Nie udało się zapisać sesji logowania.', error);
  }
}

function readPersistedAuthSession() {
  const storage = getAuthStorage();
  if (!storage) {
    return null;
  }

  let raw = null;
  try {
    raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Nie udało się odczytać zapisanej sesji logowania.', error);
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const session = parsed.session;
    if (!session || typeof session !== 'object') {
      return null;
    }

    if (typeof session.access_token !== 'string' || !session.access_token || !session.user?.id) {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    const expiresAtValue = Number(session.expires_at);
    if (Number.isFinite(expiresAtValue) && expiresAtValue > 0) {
      if (expiresAtValue * 1000 <= Date.now()) {
        storage.removeItem(AUTH_SESSION_STORAGE_KEY);
        return null;
      }
      session.expires_at = expiresAtValue;
    } else {
      session.expires_at = null;
    }

    const expiresInValue = Number(session.expires_in);
    session.expires_in = Number.isFinite(expiresInValue) ? expiresInValue : null;

    const profileSnapshot = parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : null;
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName : '';

    return {
      version: Number(parsed.version) || 1,
      savedAt: Number(parsed.savedAt) || Date.now(),
      session,
      profile: profileSnapshot,
      displayName,
    };
  } catch (error) {
    console.warn('Nie udało się sparsować zapisanej sesji logowania.', error);
    return null;
  }
}

function applyPersistedAuthSessionSnapshot(snapshot, { emitEvent = true } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.session) {
    return false;
  }

  const session = snapshot.session;
  const sanitizedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token || null,
    token_type: session.token_type || 'bearer',
    expires_at: Number.isFinite(session.expires_at) ? session.expires_at : null,
    expires_in: Number.isFinite(session.expires_in) ? session.expires_in : null,
    user: session.user || null,
  };

  const profile = snapshot.profile && typeof snapshot.profile === 'object' ? { ...snapshot.profile } : null;
  const displayName = typeof snapshot.displayName === 'string' ? snapshot.displayName.trim() : '';
  const resolvedProfile = profile || (displayName ? { name: displayName } : null);

  setState({
    session: sanitizedSession,
    profile: resolvedProfile,
    status: 'authenticated',
  });

  if (emitEvent) {
    emitAuthState(window.CE_STATE);
  }

  return true;
}

if (ceAuthGlobal) {
  ceAuthGlobal.persistSession = persistAuthSession;
  ceAuthGlobal.readPersistedSession = readPersistedAuthSession;
  ceAuthGlobal.applyPersistedSession = (snapshot, options) =>
    applyPersistedAuthSessionSnapshot(snapshot, options);
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
    throw new Error(t('Invalid email address for password reset.', 'Nieprawidłowy adres e-mail resetu hasła.'));
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
  const fallback = t('Please try again later.', 'Spróbuj ponownie później.');
  const map = {
    'Invalid login credentials': t('Incorrect email or password.', 'Błędny e-mail lub hasło.'),
    'Email not confirmed': t('Please confirm your email before signing in.', 'Potwierdź e-mail przed logowaniem.'),
    'User already registered': t('This email address is already registered.', 'Ten adres e-mail jest już zarejestrowany.'),
    'Invalid email': t('Please enter a valid email address.', 'Podaj poprawny e-mail.'),
    'Reset password token has expired or is invalid': t('The reset link has expired. Please request a new one.', 'Link resetujący wygasł. Poproś o nowy.'),
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
    showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
    return { success: false, error };
  }

  hideResendVerification();
  showOk(okMsg);

  const sessionFromResult = result?.data?.session || null;
  if (sessionFromResult?.user?.id) {
    setState({ session: sessionFromResult, profile: null, status: 'authenticated' });
    persistAuthSession(sessionFromResult, null);
    emitAuthState(window.CE_STATE);
    updateAuthUI();
  }
  try {
    await refreshSessionAndProfile();
    updateAuthUI();
  } catch (refreshError) {
    const message = friendlyErrorMessage(
      refreshError?.message || t('Session refresh after sign-in.', 'Odświeżenie sesji po logowaniu.'),
    );
    showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
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
  const username = form.username?.value?.trim() || '';
  const confirm = form.passwordConfirm?.value || '';
  const referralCode = form.referralCode?.value?.trim() || '';

  if (!email) {
    showErr(t('Please enter a valid email address.', 'Podaj poprawny e-mail.'));
    return null;
  }

  if (!password) {
    showErr(t('Please enter your password.', 'Podaj hasło.'));
    return null;
  }

  if (!firstName) {
    showErr(t('Please enter your first name to create an account.', 'Podaj imię, aby utworzyć konto.'));
    return null;
  }

  if (!username) {
    showErr(t('Please choose a username.', 'Podaj nazwę użytkownika.'));
    return null;
  }

  // Validate username format
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    showErr(
      t(
        `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`,
        `Nazwa użytkownika musi mieć od ${USERNAME_MIN_LENGTH} do ${USERNAME_MAX_LENGTH} znaków.`,
      ),
    );
    return null;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showErr(
      t(
        'Username can contain only letters, numbers and underscores.',
        'Nazwa użytkownika może zawierać tylko litery, cyfry i znak podkreślenia.',
      ),
    );
    return null;
  }

  if (confirm && confirm !== password) {
    showErr(t('Passwords do not match.', 'Hasła nie są identyczne.'));
    return null;
  }

  if (referralCode && !/^[a-zA-Z0-9_]+$/.test(referralCode)) {
    showErr(
      t(
        'Referral code can contain only letters, numbers and underscores.',
        'Kod polecający może zawierać tylko litery, cyfry i znak podkreślenia.',
      ),
    );
    return null;
  }

  return { email, password, firstName, username, referralCode };
}

function detectUiLanguage() {
  const forced = (
    document.body && document.body.dataset ? (document.body.dataset.forceLanguage || '') : ''
  ).toLowerCase();
  if (forced === 'pl' || forced === 'en') {
    return forced;
  }

  try {
    const url = new URL(window.location.href);
    const urlLang = (url.searchParams.get('lang') || '').toLowerCase();
    if (urlLang === 'pl' || urlLang === 'en') {
      return urlLang;
    }
  } catch (error) {
  }

  try {
    const stored = (window.localStorage.getItem('ce_lang') || '').toLowerCase();
    if (stored === 'pl' || stored === 'en') {
      return stored;
    }
  } catch (error) {
  }

  const htmlLang = (document.documentElement.lang || '').toLowerCase();
  if (htmlLang === 'pl' || htmlLang === 'en') {
    return htmlLang;
  }

  return 'pl';
}

function t(en, pl) {
  return detectUiLanguage() === 'en' ? en : pl;
}

function getTranslationEntry(translations, key) {
  if (!translations || !key) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }

  if (key.indexOf('.') !== -1) {
    const parts = key.split('.');
    let current = translations;
    for (const part of parts) {
      if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        return null;
      }
    }
    return current;
  }

  return null;
}

function getI18nString(key, fallback) {
  const translations = window.appI18n?.translations?.[window.appI18n?.language] || null;
  const entry = getTranslationEntry(translations, key);
  if (typeof entry === 'string') {
    return entry;
  }
  if (entry && typeof entry === 'object') {
    if (typeof entry.text === 'string') {
      return entry.text;
    }
    if (typeof entry.html === 'string') {
      return entry.html;
    }
  }
  return fallback;
}

function getGoogleButtonKeys(form) {
  const isRegister = form?.id === 'form-register';
  const prefix = isRegister ? 'auth.oauth.google.register' : 'auth.oauth.google.login';
  return {
    labelKey: `${prefix}.button`,
    ariaKey: `${prefix}.aria`,
    fallbackLabel:
      detectUiLanguage() === 'en'
        ? isRegister
          ? 'Sign up with Google'
          : 'Sign in with Google'
        : isRegister
          ? 'Zarejestruj przez Google'
          : 'Zaloguj przez Google',
  };
}

function ensureGoogleButtons() {
  const forms = Array.from(document.querySelectorAll('form#form-login, form#form-register'));
  forms.forEach((form) => {
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (form.id === 'form-register') {
      ensureRegisterReferralField(form);
      const usernameInput = form.querySelector('input[name="username"]');
      if (usernameInput instanceof HTMLInputElement) {
        usernameInput.minLength = USERNAME_MIN_LENGTH;
        usernameInput.maxLength = USERNAME_MAX_LENGTH;
        if (usernameInput.placeholder) {
          usernameInput.placeholder = t(
            `${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters, letters and numbers`,
            `${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} znaków, litery i cyfry`,
          );
        }
      }
    }

    const provider = 'google';
    const existing = form.querySelector(`[data-auth-provider="${provider}"]`);
    if (existing instanceof HTMLButtonElement) {
      const { labelKey, ariaKey, fallbackLabel } = getGoogleButtonKeys(form);
      const label = existing.querySelector('.btn-google__label');
      if (label instanceof HTMLElement) {
        label.dataset.i18n = labelKey;
        label.textContent = getI18nString(labelKey, fallbackLabel);
      }
      existing.dataset.i18nAttrs = `aria-label:${ariaKey}`;
      existing.setAttribute('aria-label', getI18nString(ariaKey, fallbackLabel));
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-google';
    button.dataset.authProvider = provider;
    const { labelKey, ariaKey, fallbackLabel } = getGoogleButtonKeys(form);
    button.dataset.i18nAttrs = `aria-label:${ariaKey}`;
    button.setAttribute('aria-label', getI18nString(ariaKey, fallbackLabel));

    const labelText = getI18nString(labelKey, fallbackLabel);
    button.innerHTML = `
      <span class="btn-google__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.68 1.23 9.17 3.65l6.85-6.85C35.82 2.52 30.28 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.09 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.64-.15-3.21-.43-4.73H24v9.03h12.95c-.56 2.96-2.23 5.47-4.74 7.16l7.27 5.64c4.25-3.92 6.5-9.69 6.5-17.1z"/>
          <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59 0-1.6.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
          <path fill="#34A853" d="M24 48c6.28 0 11.57-2.08 15.43-5.66l-7.27-5.64c-2.02 1.35-4.6 2.15-8.16 2.15-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
      </span>
      <span class="btn-google__label" data-i18n="${labelKey}">${labelText}</span>
    `.trim();

    form.prepend(button);

  });
}

function ensureRegisterReferralField(form) {
  if (!(form instanceof HTMLFormElement) || form.id !== 'form-register') return;

  const referralLabelText = getI18nString(
    'auth.referralCode',
    t('Referral code (optional)', 'Kod polecający (opcjonalnie)'),
  );
  const referralPlaceholder = getI18nString(
    'auth.referralCode.placeholder',
    t('Partner username', 'Nazwa użytkownika partnera'),
  );
  const referralHint = getI18nString(
    'auth.referralCode.hint',
    t(
      'If you got a referral code from a partner, enter it here.',
      'Jeśli masz kod polecający od partnera, wpisz go tutaj.',
    ),
  );

  const existingInput = form.querySelector('input[name="referralCode"]');
  if (existingInput instanceof HTMLInputElement) {
    existingInput.placeholder = referralPlaceholder;
    existingInput.setAttribute('aria-label', referralLabelText);
    const existingStored = getStoredReferralCode();
    if (!existingInput.value && existingStored) {
      existingInput.value = existingStored;
    }
    return;
  }

  const label = document.createElement('label');
  label.setAttribute('for', 'registerReferralCode');
  label.dataset.i18n = 'auth.referralCode';
  label.textContent = referralLabelText;

  const input = document.createElement('input');
  input.id = 'registerReferralCode';
  input.name = 'referralCode';
  input.type = 'text';
  input.autocomplete = 'off';
  input.maxLength = 64;
  input.pattern = '[a-zA-Z0-9_]+';
  input.dataset.i18nAttrs = 'aria-label:auth.referralCode,placeholder:auth.referralCode.placeholder';
  input.setAttribute('aria-label', referralLabelText);
  input.placeholder = referralPlaceholder;

  const hint = document.createElement('p');
  hint.className = 'form-hint';
  hint.style.marginTop = '6px';
  hint.style.marginBottom = '4px';
  hint.dataset.i18n = 'auth.referralCode.hint';
  hint.textContent = referralHint;

  const emailLabel = form.querySelector('label[for="registerEmail"]');
  if (emailLabel instanceof HTMLElement && emailLabel.parentNode) {
    emailLabel.parentNode.insertBefore(label, emailLabel);
    emailLabel.parentNode.insertBefore(input, emailLabel);
    emailLabel.parentNode.insertBefore(hint, emailLabel);
  } else {
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(hint);
  }

  const storedCode = getStoredReferralCode();
  if (storedCode) {
    input.value = storedCode;
  }
}

function isGoogleProviderUser(user) {
  if (!user || typeof user !== 'object') return false;
  const provider = String(user?.app_metadata?.provider || '').trim().toLowerCase();
  if (provider === 'google') return true;
  const providers = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : [];
  if (providers.some((entry) => String(entry || '').trim().toLowerCase() === 'google')) return true;
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  return identities.some((identity) => String(identity?.provider || '').toLowerCase() === 'google');
}

function readOAuthCompletionDraft() {
  try {
    const raw = window.localStorage.getItem(OAUTH_COMPLETION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName.trim() : '',
      username: typeof parsed.username === 'string' ? parsed.username.trim() : '',
      referralCode: typeof parsed.referralCode === 'string' ? parsed.referralCode.trim() : '',
    };
  } catch (_e) {
    return null;
  }
}

function saveOAuthCompletionDraft(draft) {
  try {
    const payload = {
      firstName: String(draft?.firstName || '').trim(),
      username: String(draft?.username || '').trim(),
      referralCode: String(draft?.referralCode || '').trim(),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(OAUTH_COMPLETION_DRAFT_KEY, JSON.stringify(payload));
  } catch (_e) {
  }
}

function clearOAuthCompletionDraft() {
  try {
    window.localStorage.removeItem(OAUTH_COMPLETION_DRAFT_KEY);
  } catch (_e) {
  }
}

async function fetchOAuthCompletionSnapshot(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('registration_completed, name, username')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('registration_completed') || String(error.code || '') === 'PGRST204') {
        return null;
      }
      throw error;
    }
    if (!data || typeof data !== 'object') return null;
    const registrationCompleted = Object.prototype.hasOwnProperty.call(data, 'registration_completed')
      ? data.registration_completed === true
      : null;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    return {
      registrationCompleted,
      name,
      username,
    };
  } catch (error) {
    console.warn('Could not fetch OAuth completion snapshot:', error);
    return null;
  }
}

function ensureOAuthCompletionModal() {
  if (oauthCompletionModal) return oauthCompletionModal;
  if (typeof document === 'undefined') return null;

  const overlay = document.createElement('div');
  overlay.id = 'oauthCompletionModal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'oauthCompletionTitle');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '14000';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '18px';
  overlay.style.background = 'rgba(2, 6, 23, 0.62)';
  overlay.innerHTML = `
    <form id="oauthCompletionForm" style="width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
      <h2 id="oauthCompletionTitle" style="margin:0 0 8px;font-size:24px;line-height:1.2;">${t('Complete registration', 'Dokończ rejestrację')}</h2>
      <p style="margin:0 0 14px;color:#475569;font-size:14px;">${t('To continue, complete your account details.', 'Aby kontynuować, uzupełnij dane konta.')}</p>
      <label for="oauthCompletionFirstName">${t('First name', 'Imię')}</label>
      <input id="oauthCompletionFirstName" name="firstName" type="text" required maxlength="60" autocomplete="given-name" style="width:100%;margin:6px 0 12px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;" />
      <label for="oauthCompletionUsername">${t('Username', 'Nazwa użytkownika')}</label>
      <input id="oauthCompletionUsername" name="username" type="text" required minlength="3" maxlength="15" pattern="[a-zA-Z0-9_]+" autocomplete="username" style="width:100%;margin:6px 0 12px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;" />
      <label for="oauthCompletionReferral">${t('Referral code (optional)', 'Kod polecający (opcjonalnie)')}</label>
      <input id="oauthCompletionReferral" name="referralCode" type="text" maxlength="64" pattern="[a-zA-Z0-9_]+" autocomplete="off" style="width:100%;margin:6px 0 12px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;" />
      <label for="oauthCompletionPassword">${t('Password', 'Hasło')}</label>
      <input id="oauthCompletionPassword" name="password" type="password" required minlength="8" autocomplete="new-password" style="width:100%;margin:6px 0 12px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;" />
      <label for="oauthCompletionPasswordConfirm">${t('Confirm password', 'Potwierdź hasło')}</label>
      <input id="oauthCompletionPasswordConfirm" name="passwordConfirm" type="password" required minlength="8" autocomplete="new-password" style="width:100%;margin:6px 0 12px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;" />
      <p id="oauthCompletionError" style="display:none;margin:2px 0 10px;color:#b91c1c;font-size:13px;"></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button id="oauthCompletionSubmit" type="submit" class="btn btn--primary" style="flex:1;min-width:180px;">${t('Save and continue', 'Zapisz i kontynuuj')}</button>
        <button id="oauthCompletionLogout" type="button" class="auth-form__link" style="min-width:120px;">${t('Log out', 'Wyloguj')}</button>
      </div>
    </form>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector('#oauthCompletionForm');
  const errorEl = overlay.querySelector('#oauthCompletionError');
  const submitBtn = overlay.querySelector('#oauthCompletionSubmit');
  const logoutBtn = overlay.querySelector('#oauthCompletionLogout');

  const setError = (message) => {
    if (!(errorEl instanceof HTMLElement)) return;
    const text = String(message || '').trim();
    if (!text) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
      return;
    }
    errorEl.textContent = text;
    errorEl.style.display = 'block';
  };

  if (form instanceof HTMLFormElement) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (oauthCompletionSubmitting) return;

      const firstName = String(form.firstName?.value || '').trim();
      const username = String(form.username?.value || '').trim();
      const referralCodeInput = String(form.referralCode?.value || '').trim();
      const password = String(form.password?.value || '');
      const passwordConfirm = String(form.passwordConfirm?.value || '');

      if (!firstName) {
        setError(t('Please enter first name.', 'Podaj imię.'));
        return;
      }
      if (!username) {
        setError(t('Please enter username.', 'Podaj nazwę użytkownika.'));
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        setError(t('Username must be 3-15 chars: letters, numbers, underscore.', 'Nazwa użytkownika: 3-15 znaków, litery, cyfry, podkreślenie.'));
        return;
      }
      if (referralCodeInput && !/^[a-zA-Z0-9_]+$/.test(referralCodeInput)) {
        setError(t('Enter a valid referral code.', 'Podaj poprawny kod polecający.'));
        return;
      }

      const storedReferralCode = String(getStoredReferralCode() || '').trim();
      const validStoredReferralCode = storedReferralCode && /^[a-zA-Z0-9_]+$/.test(storedReferralCode) ? storedReferralCode : '';
      const effectiveReferralCode = referralCodeInput || validStoredReferralCode;
      if (!password || password.length < 8) {
        setError(t('Password must have at least 8 characters.', 'Hasło musi mieć co najmniej 8 znaków.'));
        return;
      }
      if (password !== passwordConfirm) {
        setError(t('Passwords do not match.', 'Hasła nie są identyczne.'));
        return;
      }

      oauthCompletionSubmitting = true;
      setError('');
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
      if (logoutBtn instanceof HTMLButtonElement) logoutBtn.disabled = true;

      try {
        const currentUser = window.CE_STATE?.session?.user || null;
        await ensureProfileReadyForCompletion(currentUser);

        const { error: passwordError } = await sb.auth.updateUser({ password });
        if (passwordError) {
          throw passwordError;
        }
        let completionHandled = false;
        let completionError = null;

        try {
          let lastRpcError = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const { data, error } = await sb.rpc('complete_oauth_registration', {
              p_name: firstName,
              p_username: username,
              p_referral_code: effectiveReferralCode,
            });
            if (!error && data?.ok) {
              lastRpcError = null;
              break;
            }

            const raw = String(error?.message || '').toLowerCase();
            lastRpcError = error || new Error('completion_failed');
            if (!raw.includes('profile_not_found')) {
              break;
            }

            await ensureProfileReadyForCompletion(currentUser);
            await delay(300 * (attempt + 1));
          }

          if (lastRpcError) throw lastRpcError;
          completionHandled = true;
        } catch (rpcErr) {
          completionError = rpcErr;
        }

        if (!completionHandled) {
          const rpcMessage = String(completionError?.message || '').toLowerCase();
          const isMissingRpc =
            rpcMessage.includes('complete_oauth_registration') ||
            rpcMessage.includes('function') ||
            rpcMessage.includes('permission denied') ||
            rpcMessage.includes('forbidden') ||
            String(completionError?.code || '') === '42883';

          if (!isMissingRpc) {
            throw completionError;
          }

          const userId = window.CE_STATE?.session?.user?.id || null;
          if (!userId) {
            throw new Error('missing_user_session');
          }

          await syncOAuthCompletionProfile(userId, firstName, username);

          if (effectiveReferralCode) {
            setStoredReferralCode(effectiveReferralCode, { overwrite: true });
            try {
              await processReferralAfterRegistration(userId);
            } catch (_refErr) {
            }
          } else {
            clearStoredReferralCode();
          }
        } else {
          const userId = window.CE_STATE?.session?.user?.id || null;
          try {
            await syncOAuthCompletionProfile(userId, firstName, username);
          } catch (syncError) {
            console.warn('OAuth completion: profile sync after RPC success failed.', syncError);
          }
          clearStoredReferralCode();
        }

        try {
          await sb.auth.updateUser({
            data: {
              [OAUTH_COMPLETION_META_KEY]: true,
              name: firstName,
              username,
            },
          });
        } catch (_e) {
        }
        markOAuthCompletionLocal(window.CE_STATE?.session?.user?.id || null);

        clearOAuthCompletionDraft();

        try {
          await refreshSessionAndProfile();
          updateAuthUI();
          emitAuthState(window.CE_STATE);
        } catch (postCompletionRefreshError) {
          console.warn('OAuth completion: state refresh failed after successful save.', postCompletionRefreshError);
        }

        overlay.style.display = 'none';
        document.body.style.overflow = '';

        const redirect = String(oauthCompletionRedirectTarget || POST_AUTH_REDIRECT).trim() || POST_AUTH_REDIRECT;
        window.location.assign(redirect);
      } catch (error) {
        console.error('OAuth completion failed:', error);
        const raw = String(error?.message || '').toLowerCase();
        if (raw.includes('username_taken')) {
          setError(t('This username is already taken.', 'Ta nazwa użytkownika jest już zajęta.'));
        } else if (raw.includes('duplicate key value') || raw.includes('duplicate') || raw.includes('unique')) {
          setError(t('This username is already taken.', 'Ta nazwa użytkownika jest już zajęta.'));
        } else if (raw.includes('invalid_username_length')) {
          setError(t('Username must have 3-15 characters.', 'Nazwa użytkownika musi mieć 3-15 znaków.'));
        } else if (raw.includes('invalid_username_format')) {
          setError(t('Username may contain letters, numbers and underscore only.', 'Nazwa użytkownika może zawierać tylko litery, cyfry i podkreślenie.'));
        } else if (raw.includes('missing_name')) {
          setError(t('First name is required.', 'Imię jest wymagane.'));
        } else if (raw.includes('missing_username')) {
          setError(t('Username is required.', 'Nazwa użytkownika jest wymagana.'));
        } else if (raw.includes('invalid_referral_code')) {
          setError(t('Referral code was not found.', 'Nie znaleziono takiego kodu polecającego.'));
        } else if (raw.includes('missing_referral_code')) {
          setError(t('Referral code is not valid.', 'Kod polecający jest nieprawidłowy.'));
        } else if (raw.includes('profile_not_found')) {
          setError(t('User profile is not ready yet. Try again in a few seconds.', 'Profil użytkownika nie jest jeszcze gotowy. Spróbuj ponownie za kilka sekund.'));
        } else if (raw.includes('not_authenticated')) {
          setError(t('Session expired. Please sign in again.', 'Sesja wygasła. Zaloguj się ponownie.'));
        } else if (raw.includes('permission denied') || raw.includes('forbidden')) {
          setError(t('Permission error while saving profile. Please sign in again.', 'Błąd uprawnień przy zapisie profilu. Zaloguj się ponownie.'));
        } else {
          const details = friendlyErrorMessage(String(error?.message || ''));
          const suffix = details ? ` (${details})` : '';
          setError(`${t('Could not complete registration. Try again.', 'Nie udało się dokończyć rejestracji. Spróbuj ponownie.')}${suffix}`);
        }
      } finally {
        oauthCompletionSubmitting = false;
        if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
        if (logoutBtn instanceof HTMLButtonElement) logoutBtn.disabled = false;
      }
    });
  }

  if (logoutBtn instanceof HTMLButtonElement) {
    logoutBtn.addEventListener('click', async () => {
      if (oauthCompletionSubmitting) return;
      await sb.auth.signOut();
      clearOAuthCompletionDraft();
      overlay.style.display = 'none';
      document.body.style.overflow = '';
      window.location.assign('/');
    });
  }

  oauthCompletionModal = overlay;
  return overlay;
}

function fillOAuthCompletionFormDefaults(state) {
  if (!(oauthCompletionModal instanceof HTMLElement)) return;
  const form = oauthCompletionModal.querySelector('#oauthCompletionForm');
  if (!(form instanceof HTMLFormElement)) return;

  const draft = readOAuthCompletionDraft();
  const profile = state?.profile || {};
  const metadata = state?.session?.user?.user_metadata || {};
  const email = String(state?.session?.user?.email || '');
  const emailBase = email.includes('@') ? email.split('@')[0] : '';

  const firstName = draft?.firstName || profile?.name || metadata?.name || metadata?.full_name || metadata?.given_name || '';
  const username = draft?.username || profile?.username || metadata?.preferred_username || metadata?.username || emailBase || '';
  const referralCode = draft?.referralCode || getStoredReferralCode() || '';

  if (form.firstName instanceof HTMLInputElement) form.firstName.value = String(firstName || '').trim();
  if (form.username instanceof HTMLInputElement) form.username.value = String(username || '').trim();
  if (form.referralCode instanceof HTMLInputElement) form.referralCode.value = String(referralCode || '').trim();
  if (form.password instanceof HTMLInputElement) form.password.value = '';
  if (form.passwordConfirm instanceof HTMLInputElement) form.passwordConfirm.value = '';
}

async function maybeRequireOAuthCompletion(state, { redirectTarget = POST_AUTH_REDIRECT } = {}) {
  const user = state?.session?.user || null;
  if (!user?.id) return false;
  if (!isGoogleProviderUser(user)) return false;

  const completionSnapshot = await fetchOAuthCompletionSnapshot(user.id);
  const completed = completionSnapshot?.registrationCompleted === true;
  const hasRequiredProfileData = Boolean(completionSnapshot?.name && completionSnapshot?.username);

  if (completed && hasRequiredProfileData) {
    markOAuthCompletionLocal(user.id);
    if (!isOAuthCompletionMarked(user)) {
      try {
        await sb.auth.updateUser({ data: { [OAUTH_COMPLETION_META_KEY]: true } });
      } catch (_metaErr) {
      }
    }
    return false;
  }

  clearOAuthCompletionLocal(user.id);

  oauthCompletionRedirectTarget = redirectTarget;
  const modal = ensureOAuthCompletionModal();
  if (!(modal instanceof HTMLElement)) return false;

  fillOAuthCompletionFormDefaults(state);
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  return true;
}

async function waitForProfileRow(userId, attempts = 8) {
  const id = String(userId || '').trim();
  if (!id) return false;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (!error && data?.id) return true;
    } catch (_e) {
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
  }
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function syncOAuthCompletionProfile(userId, firstName, username) {
  const id = String(userId || '').trim();
  if (!id) {
    throw new Error('missing_user_session');
  }

  const completedAt = new Date().toISOString();
  try {
    const { error: updateErrWithNorm } = await sb
      .from('profiles')
      .update({
        name: firstName,
        username,
        username_normalized: username.toLowerCase(),
        registration_completed: true,
        registration_completed_at: completedAt,
      })
      .eq('id', id);
    if (updateErrWithNorm) throw updateErrWithNorm;
  } catch (updateWithNormErr) {
    try {
      const { error: updateErrWithCompletion } = await sb
        .from('profiles')
        .update({
          name: firstName,
          username,
          registration_completed: true,
          registration_completed_at: completedAt,
        })
        .eq('id', id);
      if (updateErrWithCompletion) throw updateErrWithCompletion;
    } catch (_fallbackUpdateErr) {
      const { error: updateErr } = await sb
        .from('profiles')
        .update({ name: firstName, username })
        .eq('id', id);
      if (updateErr) throw updateErr;
    }
    if (updateWithNormErr && String(updateWithNormErr?.message || '').toLowerCase().includes('duplicate')) {
      throw updateWithNormErr;
    }
  }
}

async function ensureProfileReadyForCompletion(user) {
  const userId = String(user?.id || '').trim();
  if (!userId) return false;

  if (await waitForProfileRow(userId, 6)) return true;

  try {
    const payload = {
      id: userId,
      email: String(user?.email || '').trim() || null,
      username: String(user?.user_metadata?.username || '').trim() || null,
      name: String(user?.user_metadata?.name || user?.user_metadata?.full_name || '').trim() || null,
    };
    const { error } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      return false;
    }
  } catch (_e) {
    return false;
  }

  return waitForProfileRow(userId, 6);
}

async function handleGoogleOAuthCallbackIfPresent() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.location.pathname.startsWith('/auth') || IS_PASSWORD_RESET_CALLBACK) {
    return;
  }

  const parsed = parseSupabaseReturnParams();
  if (!parsed) {
    return;
  }

  const errorValue = (parsed.searchParams.get('error') || parsed.hashParams?.get('error') || '').trim();
  const errorDescription = (
    parsed.searchParams.get('error_description') ||
    parsed.hashParams?.get('error_description') ||
    ''
  ).trim();
  if (errorValue) {
    showErr(`${t('Failed', 'Nie udało się')}: ${friendlyErrorMessage(errorDescription || errorValue)}`);
    stripSupabaseReturnParams(parsed);
    return;
  }

  const code = (parsed.searchParams.get('code') || parsed.hashParams?.get('code') || '').trim();
  if (!code) {
    return;
  }

  try {
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData?.session) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
    }

    const { error: userError } = await sb.auth.getUser();
    if (userError) {
      throw userError;
    }
    await refreshSessionAndProfile();
    updateAuthUI();

    const requiresCompletion = await maybeRequireOAuthCompletion(window.CE_STATE, {
      redirectTarget: POST_AUTH_REDIRECT,
    });
    if (requiresCompletion) {
      stripSupabaseReturnParams(parsed);
      return;
    }

    stripSupabaseReturnParams(parsed);
    window.location.assign(POST_AUTH_REDIRECT);
  } catch (error) {
    const message = friendlyErrorMessage(error?.message || t('Could not sign in with Google.', 'Nie udało się zalogować przez Google.'));
    showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
    console.warn('Nie udało się obsłużyć callback OAuth.', error);
    stripSupabaseReturnParams(parsed);
  }
}

function initGoogleOAuthHandlers() {
  if (ceAuthGlobal && ceAuthGlobal.googleOauthInitialized) {
    return;
  }
  if (ceAuthGlobal) {
    ceAuthGlobal.googleOauthInitialized = true;
  }

  ensureGoogleButtons();

  document.addEventListener('wakacjecypr:languagechange', () => {
    ensureGoogleButtons();
  });
  window.addEventListener('languageChanged', () => {
    ensureGoogleButtons();
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-auth-provider="google"]') : null;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    event.preventDefault();

    void withBusy(target, async () => {
      const parentForm = target.closest('form');
      const isRegisterFlow = parentForm instanceof HTMLFormElement && parentForm.id === 'form-register';
      if (isRegisterFlow) {
        const referralCode = String(parentForm.referralCode?.value || '').trim();
        const firstName = String(parentForm.firstName?.value || '').trim();
        const username = String(parentForm.username?.value || '').trim();
        if (referralCode && !/^[a-zA-Z0-9_]+$/.test(referralCode)) {
          showErr(t('Referral code can contain only letters, numbers and underscores.', 'Kod polecający może zawierać tylko litery, cyfry i znak podkreślenia.'));
          return;
        }
        if (referralCode) {
          setStoredReferralCode(referralCode, { overwrite: true });
        }
        saveOAuthCompletionDraft({ firstName, username, referralCode });
      }

      showInfo(t('Redirecting to Google…', 'Przekierowanie do Google…'));
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: GOOGLE_OAUTH_REDIRECT },
      });
      if (error) {
        const message = friendlyErrorMessage(
          error.message || t('Could not start Google sign-in.', 'Nie udało się rozpocząć logowania Google.'),
        );
        showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
      }
    });
  });
}

export async function refreshSessionAndProfile() {
  let session = null;

  try {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (!sessionError && sessionData?.session) {
      session = sessionData.session;
    }
  } catch (error) {
    console.warn('Nie udało się pobrać sesji Supabase.', error);
  }

  // Guard against transient getSession() null right after successful sign-in.
  // In that window we may already have a valid app session in CE_STATE/persisted snapshot.
  if (!session?.user?.id) {
    const stateSession = window.CE_STATE?.session || null;
    const stateUserId = String(stateSession?.user?.id || '').trim();
    const stateToken = String(stateSession?.access_token || '').trim();
    const stateRefresh = String(stateSession?.refresh_token || '').trim();

    if (stateUserId && stateToken) {
      session = stateSession;
      if (stateRefresh) {
        try {
          const { data: setData } = await sb.auth.setSession({
            access_token: stateToken,
            refresh_token: stateRefresh,
          });
          if (setData?.session?.user?.id) {
            session = setData.session;
          }
        } catch (syncError) {
          console.warn('Nie udało się zsynchronizować sesji Supabase z CE_STATE.', syncError);
        }
      }
    }
  }

  let guestState = null;
  try {
    guestState = window.CE_STATE?.guest ?? null;
    if (!guestState?.active) {
      const rawGuest = window.localStorage.getItem('ce_guest');
      if (rawGuest) {
        const parsedGuest = JSON.parse(rawGuest);
        if (parsedGuest && typeof parsedGuest === 'object') {
          guestState = {
            active: Boolean(parsedGuest.active),
            since: Number.isFinite(parsedGuest.since) ? parsedGuest.since : Date.now(),
          };
        }
      }
    }
  } catch {
    guestState = window.CE_STATE?.guest ?? null;
  }

  if (session?.user?.id) {
    setState({ session, profile: null, status: 'authenticated' });
    persistAuthSession(session, null);
    emitAuthState(window.CE_STATE);

    try {
      const profile = await loadProfileForUser(session.user);
      setState({ session, profile: profile || null, status: 'authenticated' });
      persistAuthSession(session, profile || null);
      emitAuthState(window.CE_STATE);
    } catch (profileError) {
      console.warn('Nie udało się pobrać profilu użytkownika.', profileError);
    }

    return window.CE_STATE;
  }

  const state = { session, profile: null };

  if (!session?.user && guestState?.active) {
    state.guest = guestState;
  }

  const status = session?.user ? 'authenticated' : guestState?.active ? 'guest' : 'anonymous';
  setState({ ...state, status });
  persistAuthSession(session, state.profile);
  emitAuthState(window.CE_STATE);

  return window.CE_STATE;
}

$('#form-login')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const emailOrUsername = form.email?.value?.trim() || '';
  const password = form.password?.value || '';
  if (!emailOrUsername) {
    showErr(t('Please enter your email or username.', 'Podaj adres e-mail lub nazwę użytkownika.'));
    return;
  }

  if (!password) {
    showErr(t('Please enter your password.', 'Podaj hasło.'));
    return;
  }

  hideResendVerification();

  const submitButton =
    event.submitter instanceof HTMLButtonElement
      ? event.submitter
      : form.querySelector('button[type="submit"]');

  await withBusy(submitButton, async () => {
    setFormBusy(form, true);
    showInfo(t('Signing in…', 'Łączenie z logowaniem…'));
    try {
      // Determine if input is email or username
      const isEmail = emailOrUsername.includes('@');
      let loginEmail = emailOrUsername;

      // If username, look up the email from profiles table
      if (!isEmail) {
        const profile = await fetchProfileByUsername(emailOrUsername, 'email');
        if (!profile || !profile.email) {
          showErr(t('No user found with that username.', 'Nie znaleziono użytkownika o podanej nazwie.'));
          return;
        }

        loginEmail = profile.email;
      }

      lastAuthEmail = loginEmail;

      const { data, error } = await sb.auth.signInWithPassword({ email: loginEmail, password });
      const outcome = await handleAuth(
        { data, error },
        t('Signed in.', 'Zalogowano.'),
        submitButton?.dataset?.authRedirect || form.dataset?.authRedirect || '/account/',
      );
      if (!outcome?.success && error?.message === 'Email not confirmed') {
        showResendVerification(loginEmail);
      }
    } catch (error) {
      const message = friendlyErrorMessage(error?.message || t('Could not sign in.', 'Nie udało się zalogować.'));
      showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
      if (error?.message === 'Email not confirmed') {
        showResendVerification(lastAuthEmail);
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

  const usernameField = form.username;
  if (usernameField instanceof HTMLInputElement) {
    usernameField.value = usernameField.value.trim();
  }

  const referralField = form.referralCode;
  if (referralField instanceof HTMLInputElement) {
    referralField.value = referralField.value.trim();
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
    showInfo(t('Creating account…', 'Tworzenie konta…'));
    try {
      // Check if username is already taken
      const existingUser = await fetchProfileByUsername(payload.username, 'username');
      if (existingUser) {
        showErr(
          t(
            'That username is already taken. Please choose another.',
            'Ta nazwa użytkownika jest już zajęta. Wybierz inną.',
          ),
        );
        return;
      }

      const storedReferralCode = String(getStoredReferralCode() || '').trim();
      const validStoredReferralCode =
        storedReferralCode && /^[a-zA-Z0-9_]+$/.test(storedReferralCode) ? storedReferralCode : '';
      const effectiveReferralCode = (payload.referralCode || validStoredReferralCode || '').trim();
      if (effectiveReferralCode) {
        setStoredReferralCode(effectiveReferralCode, { overwrite: true });
      } else {
        clearStoredReferralCode();
      }

      const { data, error } = await sb.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: { 
            name: payload.firstName?.trim() || '',
            username: payload.username?.trim() || '',
            referral_code: effectiveReferralCode || undefined
          },
          emailRedirectTo: VERIFICATION_REDIRECT,
        },
      });
      if (error) {
        const message = friendlyErrorMessage(error.message);
        showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
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
        
        // Process referral if exists
        try {
          const referralCode = getStoredReferralCode();
          if (referralCode) {
            try {
              const { data: sessionData } = await sb.auth.getSession();
              const sessionUserId = sessionData?.session?.user?.id;
              if (sessionUserId) {
                await processReferralAfterRegistration(data.user.id);
              }
            } catch (_e) {
            }
          }
        } catch (referralError) {
          console.warn('Nie udało się przetworzyć polecenia:', referralError);
        }
      }

      showOk(t('Verification email sent.', 'E-mail potwierdzający wysłany.'));
    } catch (error) {
      const message = friendlyErrorMessage(
        error?.message || t('Registration error occurred.', 'Wystąpił błąd rejestracji.'),
      );
      showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
      if (error?.message === 'Email not confirmed') {
        showResendVerification(payload.email);
      }
    } finally {
      setFormBusy(form, false);
    }
  });
});

// Guest mode removed - button no longer exists

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
    showErr(t('Please enter a valid email address.', 'Podaj poprawny e-mail.'));
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
      showOk(t('Check your inbox — a reset link has been sent.', 'Sprawdź skrzynkę – link do resetu wysłany.'));
      lastAuthEmail = email;
      const dialog = $('#resetPasswordDialog');
      closeResetDialog(dialog);
    } catch (error) {
      const message = friendlyErrorMessage(
        error?.message || t('Could not send password reset email.', 'Nie udało się wysłać resetu hasła.'),
      );
      showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
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
    showErr(t('Please enter a valid email address.', 'Podaj poprawny e-mail.'));
    return;
  }

  await withBusy(button instanceof HTMLButtonElement ? button : null, async () => {
    try {
      const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect } });
      if (error) {
        throw error;
      }

      showOk(t('Verification email sent.', 'E-mail potwierdzający wysłany.'));
      hideResendVerification();
    } catch (error) {
      const message = friendlyErrorMessage(
        error?.message || t('Could not send confirmation link.', 'Nie udało się wysłać linku potwierdzającego.'),
      );
      showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
    }
  });
});

function handleSupabaseVerificationReturn() {
  const parsed = parseSupabaseReturnParams();
  if (!parsed || parsed.typeValue !== 'signup') {
    return;
  }

  showOk(t('Email confirmed. You can sign in.', 'E-mail potwierdzony. Możesz się zalogować.'), 6500);
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
      const message = friendlyErrorMessage(
        error?.message || t('Error while handling Supabase password reset.', 'Błąd podczas obsługi resetu Supabase.'),
      );
      showErr(`${t('Failed', 'Nie udało się')}: ${message}`);
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
  const defaultSubmitLabel = submitButton?.textContent?.trim() || t('Send reset link', 'Wyślij link resetujący');
  const recoverySubmitLabel = submitButton?.dataset?.resetLabel?.trim() || t('Set a new password', 'Ustaw nowe hasło');

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
      setResetMessage(t('Link confirmed. Set a new password.', 'Link potwierdzony. Ustaw nowe hasło.'), 'info');
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
      setResetMessage(t('Link confirmed. Set a new password.', 'Link potwierdzony. Ustaw nowe hasło.'), 'info');
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
            setResetMessage(t('Enter a new password (min. 6 characters).', 'Podaj nowe hasło (min. 6 znaków).'), 'error');
            return;
          }

          if (newPassword !== confirmPassword) {
            setResetMessage(t('Passwords do not match.', 'Hasła nie są identyczne.'), 'error');
            return;
          }

          setResetMessage(t('Updating password…', 'Aktualizowanie hasła…'), 'info');
          const { error } = await sb.auth.updateUser({ password: newPassword });

          if (error) {
            setResetMessage(
              friendlyErrorMessage(error.message || t('Could not update password.', 'Nie udało się zaktualizować hasła.')),
              'error',
            );
            return;
          }

          setResetMessage(
            t('Password updated. You can sign in now.', 'Hasło zostało zaktualizowane. Możesz się zalogować.'),
            'success',
          );

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
          setResetMessage(t('Enter your email to reset your password.', 'Podaj adres e-mail, aby zresetować hasło.'), 'error');
          return;
        }

        setResetMessage(t('Sending reset link…', 'Wysyłanie linku resetującego…'), 'info');
        try {
          await requestPasswordReset(email);
          lastAuthEmail = email;
          setResetMessage(
            t('Check your inbox and follow the instructions.', 'Sprawdź skrzynkę e-mail i postępuj zgodnie z instrukcjami.'),
            'success',
          );
        } catch (error) {
          setResetMessage(
            friendlyErrorMessage(error.message || t('Could not send password reset email.', 'Nie udało się wysłać resetu hasła.')),
            'error',
          );
        }
      } finally {
        setFormBusy(form, false);
      }
    });
  });
}

function handleAuthDomReady() {
  initGoogleOAuthHandlers();
  initOAuthCompletionGuard();
  void handleGoogleOAuthCallbackIfPresent();
  handleSupabaseVerificationReturn();
  initResetPage();
}

function initOAuthCompletionGuard() {
  if (ceAuthGlobal?.oauthCompletionGuardInitialized) {
    return;
  }
  if (ceAuthGlobal) {
    ceAuthGlobal.oauthCompletionGuardInitialized = true;
  }

  document.addEventListener('ce-auth:state', () => {
    if (oauthCompletionSubmitting) return;
    void maybeRequireOAuthCompletion(window.CE_STATE, { redirectTarget: POST_AUTH_REDIRECT });
  });

  window.setTimeout(() => {
    if (oauthCompletionSubmitting) return;
    void maybeRequireOAuthCompletion(window.CE_STATE, { redirectTarget: POST_AUTH_REDIRECT });
  }, 150);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleAuthDomReady, { once: true });
} else {
  handleAuthDomReady();
}

setState({ status: 'loading', session: null });

const cachedAuthSession = readPersistedAuthSession();
if (cachedAuthSession) {
  applyPersistedAuthSessionSnapshot(cachedAuthSession, { emitEvent: false });
  updateAuthUI();
}

// Inicjalizacja i onAuthStateChange są obsługiwane przez authUi.js -> bootAuth()
// Nie wywołujemy ich tutaj aby uniknąć podwójnej subskrypcji
