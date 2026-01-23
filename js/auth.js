import { bootAuth, updateAuthUI } from './authUi.js';
import { showErr, showInfo, showOk } from './authMessages.js';
import { loadProfileForUser } from './profile.js';
import { URLS } from './config.js';
import { processReferralAfterRegistration, getStoredReferralCode } from './referral.js';

const sb = window.getSupabase();
const ceAuthGlobal = typeof window !== 'undefined' ? (window.CE_AUTH = window.CE_AUTH || {}) : null;
const IS_PASSWORD_RESET_CALLBACK =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback');

const GOOGLE_OAUTH_REDIRECT = 'https://cypruseye.com/auth/';
const POST_AUTH_REDIRECT = '/';
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 15;

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

function getMetadataString(metadata, key) {
  const value = metadata && typeof metadata === 'object' ? metadata[key] : null;
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function deriveNameFromUser(user) {
  const metadata = user?.user_metadata;
  const candidates = [
    getMetadataString(metadata, 'name'),
    getMetadataString(metadata, 'full_name'),
    getMetadataString(metadata, 'display_name'),
    getMetadataString(metadata, 'first_name'),
    getMetadataString(metadata, 'given_name'),
  ];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  return '';
}

function normalizeUsernameCandidate(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return '';
  }

  let normalized = raw.toLowerCase();
  try {
    normalized = normalized.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch (error) {
  }

  normalized = normalized
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');

  if (normalized.length > USERNAME_MAX_LENGTH) {
    normalized = normalized.slice(0, USERNAME_MAX_LENGTH).replace(/_+$/, '');
  }

  return normalized;
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

async function isUsernameTaken(username) {
  const normalized = typeof username === 'string' ? username.trim() : '';
  if (!normalized) {
    return false;
  }

  const row = await fetchProfileByUsername(normalized, 'id');
  return Boolean(row);
}

async function findAvailableUsername(base, userId) {
  const cleanedBase = normalizeUsernameCandidate(base);
  let candidate = cleanedBase;
  const fallbackSuffix = typeof userId === 'string' ? userId.replace(/-/g, '').slice(-6) : '';

  if (!candidate || candidate.length < USERNAME_MIN_LENGTH) {
    candidate = normalizeUsernameCandidate(`user_${fallbackSuffix || Math.floor(Math.random() * 100000)}`);
  }

  if (candidate.length > USERNAME_MAX_LENGTH) {
    candidate = candidate.slice(0, USERNAME_MAX_LENGTH);
  }

  if (candidate && !(await isUsernameTaken(candidate))) {
    return candidate;
  }

  for (let i = 2; i <= 30; i += 1) {
    const suffix = `_${i}`;
    const maxBaseLength = Math.max(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH - suffix.length);
    const basePart = (candidate || cleanedBase || 'user').slice(0, maxBaseLength);
    const trial = normalizeUsernameCandidate(`${basePart}${suffix}`).slice(0, USERNAME_MAX_LENGTH);
    if (trial.length >= USERNAME_MIN_LENGTH && !(await isUsernameTaken(trial))) {
      return trial;
    }
  }

  const lastResort = normalizeUsernameCandidate(`user_${fallbackSuffix || Date.now()}`);
  if (lastResort.length >= USERNAME_MIN_LENGTH) {
    return lastResort.slice(0, USERNAME_MAX_LENGTH);
  }

  return `user${Math.floor(Math.random() * 100000)}`;
}

async function ensureProfileNameAndUsername(user) {
  if (!user?.id) {
    return null;
  }

  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, email, name, username')
    .eq('id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const updates = {};
  const current = profile || {};
  const existingName = typeof current.name === 'string' ? current.name.trim() : '';
  const existingUsername = typeof current.username === 'string' ? current.username.trim() : '';
  const existingEmail = typeof current.email === 'string' ? current.email.trim() : '';
  const userEmail = typeof user.email === 'string' ? user.email.trim() : '';

  if (!existingName) {
    const derived = deriveNameFromUser(user);
    if (derived) {
      updates.name = derived;
    }
  }

  if (userEmail && userEmail !== existingEmail) {
    updates.email = userEmail;
  }

  if (!existingUsername) {
    const emailBase = userEmail && userEmail.includes('@') ? userEmail.split('@')[0] : '';
    const base = deriveNameFromUser(user) || emailBase || updates.name || 'user';
    updates.username = await findAvailableUsername(base, user.id);
  }

  if (Object.keys(updates).length === 0) {
    return null;
  }

  const { error: updateError } = await sb.from('profiles').update(updates).eq('id', user.id);
  if (updateError) {
    throw updateError;
  }

  return updates;
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

  return { email, password, firstName, username };
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

function getGoogleButtonFallbackLabel() {
  return detectUiLanguage() === 'en' ? 'Sign in with Google' : 'Zaloguj przez Google';
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

    if (form.id === 'form-register') {
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
  });
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
      const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        throw error;
      }
    }

    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError) {
      throw userError;
    }
    if (userData?.user) {
      try {
        await ensureProfileNameAndUsername(userData.user);
      } catch (profileError) {
        console.warn('Nie udało się uzupełnić profilu po logowaniu OAuth.', profileError);
      }
    }

    await refreshSessionAndProfile();
    updateAuthUI();

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

  const state = { session, profile: null };

  if (session?.user?.id) {
    try {
      state.profile = await loadProfileForUser(session.user);
    } catch (profileError) {
      console.warn('Nie udało się pobrać profilu użytkownika.', profileError);
      state.profile = null;
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

      const { data, error } = await sb.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: { 
            name: payload.firstName?.trim() || '',
            username: payload.username?.trim() || ''
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
      await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect } });
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
  void handleGoogleOAuthCallbackIfPresent();
  handleSupabaseVerificationReturn();
  initResetPage();
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
