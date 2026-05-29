export const DEFAULT_PUBLIC_LANGUAGE = 'en';
export const HIDDEN_PREVIEW_PARAM = 'ce_he_preview';

export const ROLLOUT_MODES = Object.freeze({
  OFF: 'off',
  INTERNAL_ONLY: 'internal_only',
  BETA: 'beta',
  BETA_USERS: 'beta_users',
  PARTIAL_PUBLIC: 'partial_public',
  PUBLIC: 'public',
  FULL_PUBLIC: 'full_public',
});

const LANGUAGE_REGISTRY = Object.freeze({
  pl: Object.freeze({
    label: 'Polski',
    shortLabel: 'PL',
    dir: 'ltr',
    locale: 'pl_PL',
    fallbackChain: Object.freeze(['pl', 'en']),
    rollout: Object.freeze({
      mode: ROLLOUT_MODES.FULL_PUBLIC,
      switcher: true,
      seo: true,
      sitemap: true,
      hreflang: true,
      canonical: true,
      routes: true,
      publicApi: true,
      indexing: true,
    }),
  }),
  en: Object.freeze({
    label: 'English',
    shortLabel: 'EN',
    dir: 'ltr',
    locale: 'en_GB',
    fallbackChain: Object.freeze(['en', 'pl']),
    rollout: Object.freeze({
      mode: ROLLOUT_MODES.FULL_PUBLIC,
      switcher: true,
      seo: true,
      sitemap: true,
      hreflang: true,
      canonical: true,
      routes: true,
      publicApi: true,
      indexing: true,
    }),
  }),
  he: Object.freeze({
    label: 'עברית',
    shortLabel: 'HE',
    dir: 'rtl',
    locale: 'he_IL',
    hidden: true,
    fallbackChain: Object.freeze(['he', 'en', 'pl']),
    rollout: Object.freeze({
      mode: ROLLOUT_MODES.INTERNAL_ONLY,
      switcher: false,
      seo: false,
      sitemap: false,
      hreflang: false,
      canonical: false,
      routes: false,
      publicApi: false,
      indexing: false,
      hiddenPreview: true,
      betaStorageKey: 'ce_he_beta',
      betaQueryParam: 'ce_he_beta',
    }),
  }),
});

const PUBLIC_SURFACES = new Set([
  'switcher',
  'seo',
  'sitemap',
  'hreflang',
  'canonical',
  'routes',
  'publicApi',
  'indexing',
]);

let cachedRolloutOverrides = null;

function getProcessEnv() {
  return globalThis.process?.env || {};
}

function getServerRolloutOverrides() {
  if (cachedRolloutOverrides) {
    return cachedRolloutOverrides;
  }

  const overrides = {};
  const env = getProcessEnv();
  const rawConfig = env.CE_LANGUAGE_ROLLOUT_CONFIG || '';
  if (rawConfig) {
    try {
      const parsed = JSON.parse(rawConfig);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.assign(overrides, parsed);
      }
    } catch (error) {
      console.warn('[language-rollout] Ignoring invalid CE_LANGUAGE_ROLLOUT_CONFIG JSON.', error);
    }
  }

  if (env.CE_HE_ROLLOUT_MODE) {
    overrides.he = {
      ...(overrides.he && typeof overrides.he === 'object' ? overrides.he : {}),
      mode: env.CE_HE_ROLLOUT_MODE,
    };
  }

  cachedRolloutOverrides = overrides;
  return cachedRolloutOverrides;
}

function getLanguageRollout(language) {
  const code = normalizeLanguageCode(language);
  const config = getLanguageConfig(code);
  if (!config) {
    return null;
  }
  const override = getServerRolloutOverrides()[code];
  const rollout = {
    ...(config.rollout || {}),
    ...(override && typeof override === 'object' ? override : {}),
  };
  rollout.mode = normalizeRolloutMode(rollout.mode || ROLLOUT_MODES.INTERNAL_ONLY);
  return rollout;
}

export function normalizeLanguageCode(value) {
  return String(value || '').trim().toLowerCase().split('-')[0];
}

export function getLanguageConfig(language) {
  return LANGUAGE_REGISTRY[normalizeLanguageCode(language)] || null;
}

export function getLanguageFallbackChain(language) {
  const config = getLanguageConfig(language) || LANGUAGE_REGISTRY[DEFAULT_PUBLIC_LANGUAGE];
  return Array.from(new Set(config.fallbackChain || LANGUAGE_REGISTRY[DEFAULT_PUBLIC_LANGUAGE].fallbackChain));
}

export function isKnownLanguage(language) {
  return Boolean(getLanguageConfig(language));
}

export function isHiddenLanguage(language) {
  return Boolean(getLanguageConfig(language)?.hidden);
}

function normalizeRolloutMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === ROLLOUT_MODES.BETA) return ROLLOUT_MODES.BETA_USERS;
  if (normalized === ROLLOUT_MODES.PUBLIC) return ROLLOUT_MODES.FULL_PUBLIC;
  return normalized;
}

function isBetaAllowed(language, options = {}) {
  const rollout = getLanguageRollout(language);
  if (!rollout || rollout.mode !== ROLLOUT_MODES.BETA_USERS) {
    return false;
  }
  if (options.beta === true || options.betaUser === true) {
    return true;
  }
  const userId = String(options.userId || '').trim();
  const allowlist = Array.isArray(rollout.betaUserIds) ? rollout.betaUserIds : [];
  return Boolean(userId && allowlist.includes(userId));
}

export function isLanguageEnabledForSurface(language, surface = 'switcher', options = {}) {
  const normalized = normalizeLanguageCode(language);
  const config = getLanguageConfig(normalized);
  if (!config) {
    return false;
  }

  const rollout = getLanguageRollout(normalized) || {};
  const mode = rollout.mode || ROLLOUT_MODES.INTERNAL_ONLY;
  if (mode === ROLLOUT_MODES.FULL_PUBLIC) {
    return PUBLIC_SURFACES.has(surface) ? rollout[surface] !== false : true;
  }
  if (mode === ROLLOUT_MODES.PARTIAL_PUBLIC) {
    return PUBLIC_SURFACES.has(surface) && rollout[surface] === true;
  }
  if (mode === ROLLOUT_MODES.BETA_USERS) {
    return isBetaAllowed(normalized, options)
      && ['switcher', 'routes', 'publicApi'].includes(surface)
      && rollout[surface] === true;
  }
  return false;
}

export function getPublicLanguageCodes(surface = 'switcher', options = {}) {
  return Object.keys(LANGUAGE_REGISTRY)
    .filter((code) => isLanguageEnabledForSurface(code, surface, options));
}

export function normalizePublicLanguage(language, fallback = DEFAULT_PUBLIC_LANGUAGE, surface = 'routes', options = {}) {
  const normalized = normalizeLanguageCode(language);
  return isLanguageEnabledForSurface(normalized, surface, options)
    ? normalized
    : fallback;
}

export function getLanguageQueryParam(language) {
  const normalized = normalizePublicLanguage(language, DEFAULT_PUBLIC_LANGUAGE, 'routes');
  return normalized === DEFAULT_PUBLIC_LANGUAGE ? '' : normalized;
}

export function getLanguageLocale(language) {
  return getLanguageConfig(language)?.locale || LANGUAGE_REGISTRY[DEFAULT_PUBLIC_LANGUAGE].locale;
}

export function getRolloutSnapshot() {
  return Object.fromEntries(
    Object.entries(LANGUAGE_REGISTRY).map(([code, config]) => [
      code,
      {
        mode: getLanguageRollout(code)?.mode || ROLLOUT_MODES.INTERNAL_ONLY,
        hidden: Boolean(config.hidden),
        fallbackChain: [...(config.fallbackChain || [])],
        publicSurfaces: Object.fromEntries(
          Array.from(PUBLIC_SURFACES).map((surface) => [
            surface,
            isLanguageEnabledForSurface(code, surface),
          ]),
        ),
      },
    ]),
  );
}

export function assertHebrewPubliclyHidden() {
  const publicSurfaces = Array.from(PUBLIC_SURFACES)
    .filter((surface) => isLanguageEnabledForSurface('he', surface));
  return {
    ok: publicSurfaces.length === 0,
    publicSurfaces,
    mode: getLanguageRollout('he')?.mode || ROLLOUT_MODES.INTERNAL_ONLY,
  };
}
