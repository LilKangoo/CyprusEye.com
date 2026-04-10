import { supabase as defaultSupabase } from './supabaseClient.js';

const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_]+$/;
const validationCache = new Map();

function getBootstrap() {
  return typeof window !== 'undefined' ? window.CE_REFERRAL_BOOTSTRAP || null : null;
}

export function normalizeReferralCode(code) {
  const bootstrap = getBootstrap();
  if (bootstrap?.normalizeCode) {
    return bootstrap.normalizeCode(code);
  }
  const raw = String(code || '').trim();
  if (!raw || !REFERRAL_CODE_PATTERN.test(raw)) return '';
  return raw;
}

export function getStoredReferralData() {
  const bootstrap = getBootstrap();
  const data = bootstrap?.getStoredData ? bootstrap.getStoredData() : null;
  if (!data || !normalizeReferralCode(data.code)) return null;
  return {
    code: normalizeReferralCode(data.code),
    capturedAt: Number(data.capturedAt || 0) || Date.now(),
    expiresAt: Number(data.expiresAt || 0) || null,
    source: String(data.source || 'stored').trim().toLowerCase() || 'stored',
    locked: data.locked === true,
  };
}

export function getStoredReferralCode() {
  return getStoredReferralData()?.code || '';
}

export function storeReferralData(code, options = {}) {
  const bootstrap = getBootstrap();
  const cleanCode = normalizeReferralCode(code);
  if (!cleanCode || !bootstrap?.storeReferralCode) return false;
  return bootstrap.storeReferralCode(cleanCode, {
    overwrite: options.overwrite !== false,
    source: options.source || 'manual',
    locked: options.locked === true,
    capturedAt: Number(options.capturedAt || 0) || undefined,
  });
}

export function buildReferralLink(targetUrl, referralCode) {
  const code = normalizeReferralCode(referralCode);
  if (!code) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://cypruseye.com';
    const url = new URL(String(targetUrl || base), base);
    url.searchParams.set('ref', code);
    return url.toString();
  } catch (_error) {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://cypruseye.com';
    return `${base}/?ref=${encodeURIComponent(code)}`;
  }
}

export function getProfileReferralCode(profile) {
  const referralCode = normalizeReferralCode(profile?.referral_code || '');
  if (referralCode) return referralCode;
  const username = String(profile?.username || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
  return isUuid ? '' : normalizeReferralCode(username);
}

export function getCurrentAuthProfile() {
  if (typeof window === 'undefined') return null;
  return window.CE_STATE?.profile || null;
}

export function hasPermanentReferralAssignment(profile = null) {
  const currentProfile = profile || getCurrentAuthProfile();
  return Boolean(String(currentProfile?.referred_by || '').trim());
}

export function shouldHideReferralEntryUi(profile = null) {
  if (typeof window === 'undefined') return false;
  const session = window.CE_STATE?.session || null;
  if (!session?.user) return false;
  return hasPermanentReferralAssignment(profile);
}

async function getSupabaseClient(explicitClient = null) {
  if (explicitClient) return explicitClient;
  if (typeof window !== 'undefined' && typeof window.getSupabase === 'function') {
    const client = window.getSupabase();
    if (client) return client;
  }
  return defaultSupabase;
}

export async function validateReferralCodePublic(code, options = {}) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    return {
      ok: false,
      reason: 'invalid_format',
      referralCode: '',
      matchedBy: '',
      availability: 'invalid',
    };
  }

  const cacheKey = normalized.toLowerCase();
  const cached = validationCache.get(cacheKey);
  if (cached && (Date.now() - cached.at) < 60 * 1000) {
    return cached.result;
  }

  const client = await getSupabaseClient(options.supabase || null);
  try {
    const { data, error } = await client.rpc('validate_referral_code_public', { p_code: normalized });
    if (error) throw error;
    const payload = data && typeof data === 'object' ? data : {};
    const result = payload.ok
      ? {
          ok: true,
          referralCode: normalizeReferralCode(payload.referral_code || normalized),
          matchedBy: String(payload.matched_by || '').trim(),
          availability: 'valid',
        }
      : {
          ok: false,
          reason: String(payload.reason || 'invalid_referral_code').trim() || 'invalid_referral_code',
          referralCode: '',
          matchedBy: '',
          availability: 'invalid',
        };
    validationCache.set(cacheKey, { at: Date.now(), result });
    return result;
  } catch (error) {
    return {
      ok: null,
      reason: String(error?.message || 'validation_unavailable'),
      referralCode: normalized,
      matchedBy: '',
      availability: 'unknown',
      error,
    };
  }
}

export function createReferralFieldController(options = {}) {
  const input = options.input instanceof HTMLInputElement ? options.input : null;
  if (!input) {
    throw new Error('Referral field controller requires a valid input element.');
  }

  const statusEl = options.status instanceof HTMLElement ? options.status : null;
  const badgeEl = options.badge instanceof HTMLElement ? options.badge : null;
  const changeButton = options.changeButton instanceof HTMLElement ? options.changeButton : null;
  const supabase = options.supabase || null;
  const messages = {
    baseHint: String(options.messages?.baseHint || '').trim(),
    approved: String(options.messages?.approved || 'Approved').trim(),
    invalid: String(options.messages?.invalid || 'Invalid referral code.').trim(),
    checking: String(options.messages?.checking || 'Checking referral code…').trim(),
    fromUrl: String(options.messages?.fromUrl || '').trim(),
    fromStorage: String(options.messages?.fromStorage || '').trim(),
    fromManual: String(options.messages?.fromManual || '').trim(),
    unavailable: String(options.messages?.unavailable || '').trim(),
    change: String(options.messages?.change || 'Change').trim(),
  };

  const state = {
    source: 'stored',
    locked: false,
    validity: null,
    canonicalCode: '',
    capturedAt: Date.now(),
    validateSeq: 0,
  };

  function setStatus(text = '', status = '') {
    if (!statusEl) return;
    const value = String(text || '').trim();
    statusEl.textContent = value;
    statusEl.hidden = !value;
    if (status) {
      statusEl.dataset.state = status;
    } else {
      delete statusEl.dataset.state;
    }
  }

  function renderBadge() {
    if (!badgeEl) return;
    if (state.validity === true) {
      badgeEl.hidden = false;
      badgeEl.textContent = messages.approved;
      badgeEl.dataset.state = 'approved';
    } else {
      badgeEl.hidden = true;
      badgeEl.textContent = '';
      delete badgeEl.dataset.state;
    }
  }

  function syncReadonlyUi() {
    input.readOnly = state.locked;
    input.dataset.referralLocked = state.locked ? '1' : '0';
    if (changeButton) {
      changeButton.hidden = !state.locked;
      changeButton.textContent = messages.change;
    }
  }

  function renderHintForCurrentState() {
    if (state.validity === false) {
      setStatus(messages.invalid, 'error');
      return;
    }
    if (state.validity === true) {
      if (state.source === 'url' && messages.fromUrl) {
        setStatus(messages.fromUrl, 'success');
        return;
      }
      if (state.source === 'stored' && messages.fromStorage) {
        setStatus(messages.fromStorage, 'success');
        return;
      }
      if (messages.fromManual) {
        setStatus(messages.fromManual, 'success');
        return;
      }
    }
    if (messages.baseHint) {
      setStatus(messages.baseHint, 'info');
      return;
    }
    setStatus('', '');
  }

  function getCurrentCode() {
    return normalizeReferralCode(input.value);
  }

  function setValue(code, next = {}) {
    const normalized = normalizeReferralCode(code);
    input.value = normalized;
    state.source = String(next.source || state.source || 'stored').trim().toLowerCase() || 'stored';
    state.locked = next.locked === true;
    state.capturedAt = Number(next.capturedAt || state.capturedAt || Date.now()) || Date.now();
    state.canonicalCode = normalized;
    state.validity = normalized ? null : null;
    syncReadonlyUi();
    renderBadge();
    renderHintForCurrentState();
  }

  async function validateCurrent(options = {}) {
    const code = getCurrentCode();
    state.validateSeq += 1;
    const seq = state.validateSeq;

    if (!code) {
      state.validity = null;
      state.canonicalCode = '';
      renderBadge();
      renderHintForCurrentState();
      return {
        ok: null,
        availability: 'empty',
      };
    }

    if (!REFERRAL_CODE_PATTERN.test(code)) {
      state.validity = false;
      state.canonicalCode = '';
      renderBadge();
      renderHintForCurrentState();
      return {
        ok: false,
        availability: 'invalid',
        reason: 'invalid_format',
      };
    }

    setStatus(messages.checking, 'info');
    const result = await validateReferralCodePublic(code, { supabase });
    if (seq !== state.validateSeq) {
      return {
        ok: null,
        availability: 'superseded',
      };
    }

    if (result.ok === true) {
      state.validity = true;
      state.canonicalCode = normalizeReferralCode(result.referralCode || code);
      if (state.canonicalCode && input.value !== state.canonicalCode) {
        input.value = state.canonicalCode;
      }
      if (options.store !== false) {
        storeReferralData(state.canonicalCode, {
          source: state.source,
          locked: state.locked,
          overwrite: true,
          capturedAt: state.capturedAt,
        });
      }
      renderBadge();
      renderHintForCurrentState();
      return result;
    }

    if (result.ok === false) {
      state.validity = false;
      state.canonicalCode = '';
      renderBadge();
      renderHintForCurrentState();
      return result;
    }

    state.validity = null;
    state.canonicalCode = code;
    renderBadge();
    if (messages.unavailable) {
      setStatus(messages.unavailable, 'info');
    } else {
      renderHintForCurrentState();
    }
    return result;
  }

  async function ensureReadyForSubmit() {
    const result = await validateCurrent({ store: true });
    return result.ok !== false;
  }

  function getPayload() {
    const code = state.canonicalCode || getCurrentCode();
    if (!code) {
      return {
        referral_code: null,
        referral_source: null,
        referral_captured_at: null,
      };
    }
    const capturedAt = Number(state.capturedAt || Date.now()) || Date.now();
    return {
      referral_code: code,
      referral_source: state.source || 'stored',
      referral_captured_at: new Date(capturedAt).toISOString(),
    };
  }

  function getState() {
    return {
      code: state.canonicalCode || getCurrentCode(),
      source: state.source,
      locked: state.locked,
      validity: state.validity,
      capturedAt: state.capturedAt,
    };
  }

  function unlock() {
    state.locked = false;
    state.source = 'manual';
    syncReadonlyUi();
    renderHintForCurrentState();
    queueMicrotask(() => input.focus());
  }

  function bootstrapInitialValue(options = {}) {
    const explicitCode = normalizeReferralCode(options.code || input.value || '');
    const stored = getStoredReferralData();
    if (explicitCode) {
      setValue(explicitCode, {
        source: options.source || 'manual',
        locked: options.locked === true,
        capturedAt: options.capturedAt || Date.now(),
      });
      void validateCurrent({ store: false });
      return;
    }

    if (stored?.code) {
      setValue(stored.code, {
        source: stored.source || 'stored',
        locked: options.readOnlyFromUrl && stored.source === 'url' && stored.locked === true,
        capturedAt: stored.capturedAt,
      });
      void validateCurrent({ store: false });
      return;
    }

    setValue('', {
      source: 'stored',
      locked: false,
      capturedAt: Date.now(),
    });
  }

  let validateTimer = null;
  input.addEventListener('input', () => {
    if (state.locked) return;
    state.source = 'manual';
    state.capturedAt = Date.now();
    state.validity = null;
    state.canonicalCode = '';
    renderBadge();
    if (validateTimer) window.clearTimeout(validateTimer);
    const code = getCurrentCode();
    if (!code) {
      renderHintForCurrentState();
      return;
    }
    validateTimer = window.setTimeout(() => {
      validateTimer = null;
      void validateCurrent({ store: true });
    }, 220);
  });

  input.addEventListener('blur', () => {
    if (!getCurrentCode()) {
      renderHintForCurrentState();
      return;
    }
    void validateCurrent({ store: true });
  });

  changeButton?.addEventListener('click', (event) => {
    event.preventDefault();
    unlock();
  });

  bootstrapInitialValue({
    readOnlyFromUrl: options.readOnlyFromUrl === true,
  });

  return {
    validateCurrent,
    ensureReadyForSubmit,
    getPayload,
    getState,
    updateMessages(next = {}) {
      Object.assign(messages, next);
      renderBadge();
      renderHintForCurrentState();
      syncReadonlyUi();
    },
    unlock,
    setValue,
    bootstrapInitialValue,
  };
}

if (typeof window !== 'undefined') {
  window.CE_REFERRAL_UI = {
    normalizeReferralCode,
    getStoredReferralData,
    getStoredReferralCode,
    storeReferralData,
    buildReferralLink,
    getProfileReferralCode,
    getCurrentAuthProfile,
    hasPermanentReferralAssignment,
    shouldHideReferralEntryUi,
    validateReferralCodePublic,
    createReferralFieldController,
  };
}
