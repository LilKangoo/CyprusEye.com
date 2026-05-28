export const DEFAULT_PUBLIC_LANGUAGE = 'en';
export const HIDDEN_PREVIEW_PARAM = 'ce_he_preview';

export const ROLLOUT_MODES = Object.freeze({
  INTERNAL_ONLY: 'internal_only',
  BETA_USERS: 'beta_users',
  PARTIAL_PUBLIC: 'partial_public',
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

function isBetaAllowed(language, options = {}) {
  const config = getLanguageConfig(language);
  if (!config || config.rollout?.mode !== ROLLOUT_MODES.BETA_USERS) {
    return false;
  }
  if (options.beta === true || options.betaUser === true) {
    return true;
  }
  const userId = String(options.userId || '').trim();
  const allowlist = Array.isArray(config.rollout?.betaUserIds) ? config.rollout.betaUserIds : [];
  return Boolean(userId && allowlist.includes(userId));
}

export function isLanguageEnabledForSurface(language, surface = 'switcher', options = {}) {
  const normalized = normalizeLanguageCode(language);
  const config = getLanguageConfig(normalized);
  if (!config) {
    return false;
  }

  const rollout = config.rollout || {};
  const mode = rollout.mode || ROLLOUT_MODES.INTERNAL_ONLY;
  if (mode === ROLLOUT_MODES.FULL_PUBLIC) {
    return PUBLIC_SURFACES.has(surface) ? rollout[surface] !== false : true;
  }
  if (mode === ROLLOUT_MODES.PARTIAL_PUBLIC) {
    return PUBLIC_SURFACES.has(surface) && rollout[surface] === true;
  }
  if (mode === ROLLOUT_MODES.BETA_USERS) {
    return isBetaAllowed(normalized, options) && surface === 'routes';
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
        mode: config.rollout?.mode || ROLLOUT_MODES.INTERNAL_ONLY,
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
    mode: getLanguageConfig('he')?.rollout?.mode || ROLLOUT_MODES.INTERNAL_ONLY,
  };
}
