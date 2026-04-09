const bootstrap = typeof window !== 'undefined' ? window.CE_REFERRAL_BOOTSTRAP || null : null;
const REFERRAL_STORAGE_KEY = bootstrap?.STORAGE_KEY || 'cypruseye_referral_code';
const REFERRAL_EXPIRY_DAYS = Number(bootstrap?.TTL_DAYS || 90);
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_]+$/;

function normalizeReferralCode(code) {
  if (bootstrap?.normalizeCode) {
    return bootstrap.normalizeCode(code);
  }
  const raw = String(code || '').trim();
  if (!raw || !REFERRAL_CODE_PATTERN.test(raw)) return '';
  return raw;
}

function buildReferralData(code) {
  const now = Date.now();
  return {
    code,
    capturedAt: now,
    expiresAt: now + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };
}

function readLocalStorageData() {
  try {
    const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_err) {
    return null;
  }
}

/**
 * Capture referral code from URL parameter (?ref=code)
 * Called on every page load
 */
export function captureReferralFromUrl() {
  try {
    const cleanCode = bootstrap?.captureFromCurrentUrl
      ? bootstrap.captureFromCurrentUrl({ overwrite: true })
      : normalizeReferralCode(new URLSearchParams(window.location.search).get('ref'));

    if (cleanCode) {
      if (!bootstrap) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(buildReferralData(cleanCode)));
      }

      // Clean URL (remove ref parameter) - delay to ensure storage completes
      setTimeout(() => {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('ref');
          window.history.replaceState({}, '', url.toString());
        } catch (e) {}
      }, 150);
      
      return cleanCode;
    }
  } catch (err) {
    console.warn('Could not capture referral code:', err);
  }
  return null;
}

/**
 * Get stored referral code if not expired
 */
export function getStoredReferralCode() {
  try {
    const referralData = bootstrap?.getStoredData ? bootstrap.getStoredData() : readLocalStorageData();
    if (!referralData) return null;
    const cleanCode = normalizeReferralCode(referralData?.code);

    if (referralData.expiresAt && Date.now() > referralData.expiresAt) {
      clearStoredReferralCode();
      return null;
    }
    if (!cleanCode) {
      clearStoredReferralCode();
      return null;
    }
    return cleanCode;
  } catch (err) {
    console.warn('Could not get stored referral code:', err);
    return null;
  }
}

/**
 * Store referral code explicitly (e.g. typed during registration)
 */
export function setStoredReferralCode(code, options = {}) {
  try {
    const cleanCode = normalizeReferralCode(code);
    if (!cleanCode) {
      return false;
    }

    const overwrite = options?.overwrite !== false;
    if (!overwrite) {
      const existing = getStoredReferralCode();
      if (existing) return true;
    }

    if (bootstrap?.storeReferralCode) {
      return bootstrap.storeReferralCode(cleanCode, { overwrite });
    }

    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(buildReferralData(cleanCode)));
    return true;
  } catch (err) {
    console.warn('Could not store referral code:', err);
    return false;
  }
}

/**
 * Clear stored referral code (after successful registration)
 */
export function clearStoredReferralCode() {
  try {
    if (bootstrap?.clearReferralCode) {
      bootstrap.clearReferralCode();
      return;
    }
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch (err) {
    console.warn('Could not clear referral code:', err);
  }
}

/**
 * Kept only as a compatibility hook during rollout.
 * Profile referral assignment is handled server-side via auth metadata and DB triggers.
 */
export async function processReferralAfterRegistration(_newUserId) {
  const referralCode = getStoredReferralCode();
  if (!referralCode) return null;
  return {
    ok: true,
    handledBy: 'backend',
    referralCode,
  };
}

/**
 * Generate referral link for current user
 */
export function generateReferralLink(referralCode) {
  const code = normalizeReferralCode(referralCode);
  if (!code) return '';
  const baseUrl = window.location.origin || 'https://cypruseye.com';
  return `${baseUrl}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Initialize referral capture on page load
 */
export function initReferralCapture() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', captureReferralFromUrl);
  } else {
    captureReferralFromUrl();
  }
}

initReferralCapture();
