(function () {
  'use strict';

  const DEFAULT_LANGUAGE = 'en';
  const STORAGE_KEY = 'ce_lang';
  const HIDDEN_PREVIEW_PARAM = 'ce_he_preview';
  const HIDDEN_PREVIEW_STORAGE_KEY = 'ce_hidden_language_preview';
  const HIDDEN_PREVIEW_LANGUAGE_KEY = 'ce_hidden_language_preview_lang';
  const ROLLOUT_MODES = Object.freeze({
    OFF: 'off',
    INTERNAL_ONLY: 'internal_only',
    BETA: 'beta',
    BETA_USERS: 'beta_users',
    PARTIAL_PUBLIC: 'partial_public',
    PUBLIC: 'public',
    FULL_PUBLIC: 'full_public',
  });
  const LANGUAGE_REGISTRY = {
    pl: { label: 'Polski', shortLabel: 'PL', flag: '🇵🇱', dir: 'ltr' },
    en: { label: 'English', shortLabel: 'EN', flag: '🇬🇧', dir: 'ltr' },
    he: { label: 'עברית', shortLabel: 'HE', flag: '🇮🇱', dir: 'rtl', hidden: true },
    // el: { label: 'Ελληνικά', shortLabel: 'EL', flag: '🇬🇷', dir: 'ltr' },
  };
  const LANGUAGE_ROLLOUT = {
    pl: {
      mode: ROLLOUT_MODES.FULL_PUBLIC,
      switcher: true,
      seo: true,
      sitemap: true,
      hreflang: true,
      canonical: true,
      routes: true,
      publicApi: true,
      indexing: true,
    },
    en: {
      mode: ROLLOUT_MODES.FULL_PUBLIC,
      switcher: true,
      seo: true,
      sitemap: true,
      hreflang: true,
      canonical: true,
      routes: true,
      publicApi: true,
      indexing: true,
    },
    he: {
      mode: ROLLOUT_MODES.INTERNAL_ONLY,
      switcher: false,
      seo: false,
      sitemap: false,
      hreflang: false,
      canonical: false,
      routes: false,
      publicApi: false,
      indexing: false,
      hiddenPreview: false,
      betaStorageKey: 'ce_he_beta',
      betaQueryParam: 'ce_he_beta',
    },
  };
  const HE_PAGE_READINESS_STATUS = Object.freeze({
    READY: 'ready',
    PARTIAL: 'partial',
    BLOCKED: 'blocked',
    EXCLUDED: 'excluded',
  });
  const HE_PAGE_GATED_SURFACES = new Set([
    'switcher',
    'routes',
    'publicApi',
    'preview',
    'seo',
    'sitemap',
    'hreflang',
    'canonical',
    'indexing',
  ]);
  const HE_PAGE_SEO_SURFACES = new Set([
    'seo',
    'sitemap',
    'hreflang',
    'canonical',
    'indexing',
  ]);
  const HE_PAGE_READINESS_REGISTRY = {
    home: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      seoPages: ['home'],
      paths: ['/', '/index.html'],
      reason: 'Home aggregates ready and partial dynamic modules.',
    },
    transport: {
      status: HE_PAGE_READINESS_STATUS.READY,
      allowFallback: false,
      seoPages: ['transport'],
      paths: ['/transport.html'],
      reason: 'Transport static UI and dynamic location/route content are HE-ready.',
    },
    hotels: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      readyWhenStage25SqlApplied: true,
      sqlDependency: 'supabase/manual/he_public_ready_dynamic_stage25.sql',
      seoPages: ['hotels'],
      paths: ['/hotels.html'],
      reason: 'Hotel records are ready; amenity dictionary requires Stage25 SQL.',
    },
    hotel: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      readyWhenStage25SqlApplied: true,
      sqlDependency: 'supabase/manual/he_public_ready_dynamic_stage25.sql',
      seoPages: ['hotel'],
      paths: ['/hotel.html'],
      reason: 'Hotel detail content is ready; amenity dictionary requires Stage25 SQL.',
    },
    recommendations: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      readyWhenStage25SqlApplied: true,
      sqlDependency: 'supabase/manual/he_public_ready_dynamic_stage25.sql',
      seoPages: ['recommendations'],
      paths: ['/recommendations.html'],
      reason: 'Top recommendations are in scope; remaining POI/map content is partial.',
    },
    car: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      seoPages: ['carRentalLanding', 'carRental', 'carRentalPfo'],
      paths: ['/car.html', '/car-rental.html', '/autopfo.html'],
      reason: 'Top cars can use HE/EN fallback; full fleet content is partial.',
    },
    trips: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      seoPages: ['trips'],
      paths: ['/trips.html'],
      reason: 'Only selected trip records are HE-ready.',
    },
    trip: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      seoPages: ['trip'],
      paths: ['/trip.html'],
      reason: 'Trip detail is safe only for translated records with EN fallback.',
    },
    poiMap: {
      status: HE_PAGE_READINESS_STATUS.PARTIAL,
      allowFallback: true,
      seoPages: ['poi', 'map'],
      paths: ['/map.html'],
      reason: 'Top POI are translated; full map catalog is partial.',
    },
    blog: {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      paths: ['/blog.html'],
      bodyClasses: ['blog-page'],
      reason: 'Public HE blog translations remain hidden from anon/public reads.',
    },
    blogPost: {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      paths: ['/blog-post.html', '/blog/'],
      bodyClasses: ['blog-post-page'],
      reason: 'Public HE blog post translations remain hidden from anon/public reads.',
    },
    shop: {
      status: HE_PAGE_READINESS_STATUS.EXCLUDED,
      allowFallback: false,
      seoPages: ['shop'],
      paths: ['/shop.html', '/shop-success.html'],
      reason: 'Shop, cart, checkout and payment are excluded from first HE launch.',
    },
    plan: {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      seoPages: ['plan'],
      paths: ['/plan.html'],
      reason: 'Planner dynamic content is not HE-ready.',
    },
    community: {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      seoPages: ['community', 'attractions', 'packing', 'vip', 'tasks', 'coupon'],
      paths: ['/community.html', '/attractions.html', '/packing.html', '/vip.html', '/tasks.html', '/kupon.html'],
      reason: 'Community/tool pages need separate dynamic and RTL QA.',
    },
    accountAuth: {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      seoPages: ['account', 'auth'],
      paths: ['/account/', '/account/index.html', '/auth/', '/login.html', '/register.html'],
      reason: 'Account/auth needs logged-in RTL QA before public HE.',
    },
    legal: {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      seoPages: ['terms', 'privacy'],
      paths: ['/terms.html', '/privacy.html'],
      reason: 'Legal copy and HE SEO are not reviewed.',
    },
    partners: {
      status: HE_PAGE_READINESS_STATUS.EXCLUDED,
      allowFallback: false,
      seoPages: ['partners', 'advertise'],
      paths: ['/partners.html', '/partners/', '/partners/index.html', '/advertise.html'],
      bodyAttributes: ['adminPanel'],
      reason: 'Partner/admin-facing surfaces are not public HE launch scope.',
    },
    admin: {
      status: HE_PAGE_READINESS_STATUS.EXCLUDED,
      allowFallback: false,
      paths: ['/admin/', '/admin/dashboard.html', '/admin/login.html'],
      reason: 'Admin is internal-only and excluded from public HE switcher exposure.',
    },
    notFound: {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      seoPages: ['notFound'],
      paths: ['/404.html'],
      reason: '404 needs final copy and routing QA before public HE.',
    },
  };

  function normalizeLanguageCode(value) {
    return String(value || '').trim().toLowerCase().split('-')[0];
  }

  function getLanguageConfig(value) {
    return LANGUAGE_REGISTRY[normalizeLanguageCode(value)] || null;
  }

  function normalizeRolloutMode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === ROLLOUT_MODES.BETA) return ROLLOUT_MODES.BETA_USERS;
    if (normalized === ROLLOUT_MODES.PUBLIC) return ROLLOUT_MODES.FULL_PUBLIC;
    return normalized;
  }

  function getRuntimeRolloutOverrides() {
    const config = window.CE_LANGUAGE_ROLLOUT_CONFIG || window.CE_LANGUAGE_ROLLOUT || null;
    return config && typeof config === 'object' ? config : {};
  }

  function getLocalDevelopmentRolloutMode(language) {
    const normalized = normalizeLanguageCode(language);
    const canUseLocalOverride = isLocalPreviewHost()
      || String(document.body?.dataset?.allowHiddenLanguagePreview || '') === 'true';
    if (!canUseLocalOverride) {
      return '';
    }
    return safeLocalStorage('get', `ce_${normalized}_rollout_mode`) || '';
  }

  function getLanguageRollout(value) {
    const normalized = normalizeLanguageCode(value);
    const base = LANGUAGE_ROLLOUT[normalized];
    if (!base) return null;

    const override = getRuntimeRolloutOverrides()[normalized];
    const merged = {
      ...base,
      ...(override && typeof override === 'object' ? override : {}),
    };
    const localMode = getLocalDevelopmentRolloutMode(normalized);
    if (localMode) {
      merged.mode = localMode;
    }
    merged.mode = normalizeRolloutMode(merged.mode || base.mode);
    return merged;
  }

  function normalizeHePageReadinessStatus(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    if (normalized === 'near-ready' || normalized === 'nearready') {
      return HE_PAGE_READINESS_STATUS.PARTIAL;
    }
    return Object.values(HE_PAGE_READINESS_STATUS).includes(normalized)
      ? normalized
      : HE_PAGE_READINESS_STATUS.BLOCKED;
  }

  function normalizePathname(pathname) {
    let path = String(pathname || '/').trim();
    if (!path) {
      return '/';
    }
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    try {
      path = decodeURI(path);
    } catch (_error) {
    }
    return path;
  }

  function pagePathMatches(pattern, pathname) {
    const normalizedPattern = normalizePathname(pattern);
    const normalizedPath = normalizePathname(pathname);
    if (normalizedPattern === '/') {
      return normalizedPath === '/' || normalizedPath === '/index.html';
    }
    if (normalizedPattern.endsWith('/')) {
      return normalizedPath === normalizedPattern || normalizedPath.startsWith(normalizedPattern);
    }
    return normalizedPath === normalizedPattern;
  }

  function getCurrentHePageKey() {
    const body = document.body || null;
    const explicitPageKey = String(body?.dataset?.hePageKey || '').trim();
    if (explicitPageKey && HE_PAGE_READINESS_REGISTRY[explicitPageKey]) {
      return explicitPageKey;
    }

    if (body?.classList?.contains('blog-post-page')) {
      return 'blogPost';
    }
    if (body?.classList?.contains('blog-page')) {
      return 'blog';
    }

    const pathname = normalizePathname(window.location?.pathname || '/');
    for (const [key, entry] of Object.entries(HE_PAGE_READINESS_REGISTRY)) {
      if (Array.isArray(entry.paths) && entry.paths.some((pattern) => pagePathMatches(pattern, pathname))) {
        return key;
      }
    }

    const seoPage = String(body?.dataset?.seoPage || '').trim();
    if (seoPage) {
      for (const [key, entry] of Object.entries(HE_PAGE_READINESS_REGISTRY)) {
        if (Array.isArray(entry.seoPages) && entry.seoPages.includes(seoPage)) {
          return key;
        }
      }
    }

    if (String(body?.dataset?.adminPanel || '') === 'true') {
      return pathname.startsWith('/partners') ? 'partners' : 'admin';
    }

    return 'unknown';
  }

  function getRolloutPageReadinessOverride(rollout, pageKey) {
    if (!rollout || !pageKey) {
      return null;
    }
    if (rollout.pageReadiness && typeof rollout.pageReadiness === 'object') {
      return rollout.pageReadiness[pageKey] || null;
    }
    if (Array.isArray(rollout.readyPages) && rollout.readyPages.includes(pageKey)) {
      return HE_PAGE_READINESS_STATUS.READY;
    }
    if (Array.isArray(rollout.partialPages) && rollout.partialPages.includes(pageKey)) {
      return HE_PAGE_READINESS_STATUS.PARTIAL;
    }
    if (Array.isArray(rollout.blockedPages) && rollout.blockedPages.includes(pageKey)) {
      return HE_PAGE_READINESS_STATUS.BLOCKED;
    }
    if (Array.isArray(rollout.excludedPages) && rollout.excludedPages.includes(pageKey)) {
      return HE_PAGE_READINESS_STATUS.EXCLUDED;
    }
    return null;
  }

  function isStage25SqlAppliedForHe(rollout, options = {}) {
    if (typeof options.stage25SqlApplied === 'boolean') {
      return options.stage25SqlApplied;
    }
    return Boolean(
      rollout?.stage25SqlApplied
      || rollout?.stage25SqlReady
      || rollout?.contentPacks?.stage25 === 'applied'
      || window.CE_HE_STAGE25_SQL_APPLIED === true
    );
  }

  function getHePageReadiness(options = {}) {
    const pageKey = options.pageKey || getCurrentHePageKey();
    const base = HE_PAGE_READINESS_REGISTRY[pageKey] || {
      status: HE_PAGE_READINESS_STATUS.BLOCKED,
      allowFallback: false,
      reason: 'Unknown page is blocked until it is added to the HE readiness registry.',
    };
    const rollout = getLanguageRollout('he');
    const stage25SqlApplied = isStage25SqlAppliedForHe(rollout, options);
    const entry = {
      key: pageKey,
      status: normalizeHePageReadinessStatus(base.status),
      allowFallback: base.allowFallback === true,
      sqlDependency: base.sqlDependency || '',
      reason: base.reason || '',
      stage25SqlApplied,
    };

    if (base.readyWhenStage25SqlApplied && stage25SqlApplied) {
      entry.status = HE_PAGE_READINESS_STATUS.READY;
      entry.allowFallback = false;
      entry.reason = `${base.reason || ''} Stage25 SQL marked as applied.`.trim();
    }

    const override = getRolloutPageReadinessOverride(rollout, pageKey);
    if (typeof override === 'string') {
      entry.status = normalizeHePageReadinessStatus(override);
    } else if (override && typeof override === 'object') {
      if (override.status) {
        entry.status = normalizeHePageReadinessStatus(override.status);
      }
      if (typeof override.allowFallback === 'boolean') {
        entry.allowFallback = override.allowFallback;
      }
      if (typeof override.reason === 'string') {
        entry.reason = override.reason;
      }
      if (typeof override.sqlDependency === 'string') {
        entry.sqlDependency = override.sqlDependency;
      }
    }

    entry.ready = entry.status === HE_PAGE_READINESS_STATUS.READY;
    entry.partial = entry.status === HE_PAGE_READINESS_STATUS.PARTIAL;
    entry.blocked = entry.status === HE_PAGE_READINESS_STATUS.BLOCKED;
    entry.excluded = entry.status === HE_PAGE_READINESS_STATUS.EXCLUDED;
    return entry;
  }

  function isLanguageAllowedOnCurrentPage(language, surface = 'routes', options = {}) {
    const normalized = normalizeLanguageCode(language);
    if (!isHiddenLanguage(normalized) || !HE_PAGE_GATED_SURFACES.has(surface)) {
      return true;
    }
    if (pageDisablesHiddenLanguage()) {
      return false;
    }
    const readiness = getHePageReadiness(options);
    if (readiness.excluded || readiness.blocked) {
      return false;
    }
    if (readiness.ready) {
      return true;
    }
    if (readiness.partial) {
      if (HE_PAGE_SEO_SURFACES.has(surface) || readiness.allowFallback !== true) {
        return false;
      }
      if (surface === 'preview') {
        return true;
      }
      const rollout = getLanguageRollout(normalized);
      const mode = rollout?.mode || ROLLOUT_MODES.INTERNAL_ONLY;
      if (mode === ROLLOUT_MODES.BETA_USERS) {
        return true;
      }
      return Boolean(rollout?.allowPartialPagesPublic === true);
    }
    return false;
  }

  function isBetaUserAllowed(language, options = {}) {
    const rollout = getLanguageRollout(language);
    if (!rollout || rollout.mode !== ROLLOUT_MODES.BETA_USERS) {
      return false;
    }
    if (options.beta === true || window.CE_HE_BETA_USER === true) {
      return true;
    }
    const betaStorageKey = String(rollout.betaStorageKey || '');
    const betaQueryParam = String(rollout.betaQueryParam || '');
    const allowLocalBetaOverride = options.allowLocalBetaOverride === true
      || isLocalPreviewHost()
      || String(document.body?.dataset?.allowHiddenLanguagePreview || '') === 'true';
    const betaStorageEnabled = betaStorageKey
      && allowLocalBetaOverride
      && safeLocalStorage('get', betaStorageKey) === 'true';
    let betaParamEnabled = false;
    try {
      betaParamEnabled = betaQueryParam
        && (isLocalPreviewHost() || String(document.body?.dataset?.allowHiddenLanguagePreview || '') === 'true')
        && new URL(window.location.href).searchParams.get(betaQueryParam) === '1';
    } catch (_error) {
    }
    const sessionUser = window.CE_STATE?.session?.user || window.CE_STATE?.user || window.CE_CURRENT_USER || {};
    const userId = String(sessionUser?.id || options.userId || '').trim();
    const email = String(sessionUser?.email || options.email || '').trim().toLowerCase();
    const betaUserIds = Array.isArray(rollout.betaUserIds) ? rollout.betaUserIds.map((id) => String(id).trim()) : [];
    const betaEmails = Array.isArray(rollout.betaEmails) ? rollout.betaEmails.map((item) => String(item).trim().toLowerCase()) : [];
    return Boolean(
      betaStorageEnabled
      || betaParamEnabled
      || (userId && betaUserIds.includes(userId))
      || (email && betaEmails.includes(email))
    );
  }

  function isLanguageEnabledForSurface(language, surface = 'switcher', options = {}) {
    const normalized = normalizeLanguageCode(language);
    const rollout = getLanguageRollout(normalized);
    if (!rollout || !getLanguageConfig(normalized)) {
      return false;
    }
    const mode = rollout.mode || ROLLOUT_MODES.INTERNAL_ONLY;
    let enabled = false;
    if (mode === ROLLOUT_MODES.FULL_PUBLIC) {
      enabled = rollout[surface] !== false;
    } else if (mode === ROLLOUT_MODES.PARTIAL_PUBLIC) {
      enabled = rollout[surface] === true;
    } else if (mode === ROLLOUT_MODES.BETA_USERS) {
      enabled = isBetaUserAllowed(normalized, options)
        && ['switcher', 'routes', 'publicApi'].includes(surface)
        && rollout[surface] === true;
    }
    if (!enabled) {
      return false;
    }
    return isLanguageAllowedOnCurrentPage(normalized, surface, options);
  }

  function getPublicLanguageCodes(surface = 'switcher', options = {}) {
    return Object.keys(LANGUAGE_REGISTRY)
      .filter((code) => isLanguageEnabledForSurface(code, surface, options));
  }

  function getLanguageRegistryForSurface(surface) {
    return getPublicLanguageCodes(surface)
      .reduce((accumulator, code) => {
        accumulator[code] = LANGUAGE_REGISTRY[code];
        return accumulator;
      }, {});
  }

  function getHiddenLanguageRegistry() {
    return Object.entries(LANGUAGE_REGISTRY)
      .filter(([code, config]) => Boolean(config.hidden) && !isLanguageEnabledForSurface(code, 'switcher'))
      .reduce((accumulator, [code, config]) => {
        accumulator[code] = config;
        return accumulator;
      }, {});
  }

  const PUBLIC_LANGUAGES = getLanguageRegistryForSurface('switcher');
  const HIDDEN_LANGUAGES = getHiddenLanguageRegistry();
  const SUPPORTED_LANGUAGES = PUBLIC_LANGUAGES;
  const LANGUAGE_CONFIG = LANGUAGE_REGISTRY;
  const LANGUAGE_FALLBACKS = {
    he: ['he', 'en', 'pl'],
    en: ['en', 'pl'],
    pl: ['pl', 'en'],
  };

  const translationCache = new Map();
  const originalContent = new WeakMap();
  const originalAttributes = new WeakMap();
  const appI18n = window.appI18n || {
    language: DEFAULT_LANGUAGE,
    translations: {},
  };

  function normalizeSupportedLanguage(value, { includeHidden = false } = {}) {
    const normalized = normalizeLanguageCode(value);
    const registry = includeHidden ? LANGUAGE_CONFIG : SUPPORTED_LANGUAGES;
    return Object.prototype.hasOwnProperty.call(registry, normalized) ? normalized : '';
  }

  function isHiddenLanguage(value) {
    return Boolean(LANGUAGE_REGISTRY[normalizeLanguageCode(value)]?.hidden);
  }

  function isPublicLanguage(value) {
    return Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, normalizeLanguageCode(value));
  }

  function isLocalPreviewHost() {
    const hostname = window.location?.hostname || '';
    return (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname.endsWith('.local')
    );
  }

  function pageDisablesHiddenLanguage() {
    return String(document.body?.dataset?.disableHiddenLanguage || '') === 'true';
  }

  function hiddenPreviewAllowedByRollout() {
    return getLanguageRollout('he')?.hiddenPreview !== false;
  }

  function safeSessionStorage(action, key, value) {
    try {
      if (action === 'get') {
        return window.sessionStorage.getItem(key);
      }
      if (action === 'set') {
        window.sessionStorage.setItem(key, value);
      }
      if (action === 'remove') {
        window.sessionStorage.removeItem(key);
      }
    } catch (_error) {
    }
    return null;
  }

  function getPreviewParamValue() {
    try {
      return new URL(window.location.href).searchParams.get(HIDDEN_PREVIEW_PARAM);
    } catch (_error) {
      return null;
    }
  }

  function isHiddenLanguagePreviewEnabled() {
    if (pageDisablesHiddenLanguage() || !hiddenPreviewAllowedByRollout()) {
      return false;
    }
    const bodyAllowsPreview = String(document.body?.dataset?.allowHiddenLanguagePreview || '') === 'true';
    const previewParam = getPreviewParamValue();
    if (previewParam === '0' || previewParam === 'false') {
      safeSessionStorage('remove', HIDDEN_PREVIEW_STORAGE_KEY);
      safeSessionStorage('remove', HIDDEN_PREVIEW_LANGUAGE_KEY);
      return false;
    }
    if (previewParam === '1' || previewParam === 'true') {
      safeSessionStorage('set', HIDDEN_PREVIEW_STORAGE_KEY, 'true');
      return true;
    }

    if (!isLocalPreviewHost() && !bodyAllowsPreview) {
      safeSessionStorage('remove', HIDDEN_PREVIEW_STORAGE_KEY);
      safeSessionStorage('remove', HIDDEN_PREVIEW_LANGUAGE_KEY);
      return false;
    }

    return safeSessionStorage('get', HIDDEN_PREVIEW_STORAGE_KEY) === 'true';
  }

  function normalizeRuntimeLanguage(value, { includeHidden = false } = {}) {
    const normalized = normalizeSupportedLanguage(value, { includeHidden });
    if (!normalized) {
      return '';
    }
    if (isHiddenLanguage(normalized) && pageDisablesHiddenLanguage()) {
      return '';
    }
    if (isPublicLanguage(normalized)) {
      return normalized;
    }
    const hiddenPreviewActive = isHiddenLanguagePreviewEnabled()
      && isLanguageAllowedOnCurrentPage(normalized, 'preview');
    const routeAllowed = isLanguageEnabledForSurface(normalized, 'routes');
    return includeHidden
      && isHiddenLanguage(normalized)
      && (hiddenPreviewActive || routeAllowed)
      ? normalized
      : '';
  }

  function getLanguageFallbackChain(language) {
    const normalized = normalizeSupportedLanguage(language, { includeHidden: true }) || DEFAULT_LANGUAGE;
    const chain = LANGUAGE_FALLBACKS[normalized] || LANGUAGE_FALLBACKS[DEFAULT_LANGUAGE];
    return [...new Set(chain.filter((code) => Object.prototype.hasOwnProperty.call(LANGUAGE_CONFIG, code)))];
  }

  function isFilledLocalizedValue(value) {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return value !== null && typeof value !== 'undefined';
  }

  function pickLocalizedValue(value, language = appI18n.language, fallback = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return isFilledLocalizedValue(value) ? value : fallback;
    }

    for (const code of getLanguageFallbackChain(language)) {
      if (isFilledLocalizedValue(value[code])) {
        return value[code];
      }
    }

    const firstAvailable = Object.values(value).find(isFilledLocalizedValue);
    return typeof firstAvailable !== 'undefined' ? firstAvailable : fallback;
  }

  function pickLocalizedField(source, fieldName, language = appI18n.language, fallback = '') {
    if (!source || !fieldName) {
      return fallback;
    }

    const direct = source[fieldName];
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      const localized = pickLocalizedValue(direct, language, null);
      if (isFilledLocalizedValue(localized)) {
        return localized;
      }
    }

    for (const code of getLanguageFallbackChain(language)) {
      const localizedColumn = source[`${fieldName}_${code}`];
      if (isFilledLocalizedValue(localizedColumn)) {
        return localizedColumn;
      }

      if (code === 'pl' && isFilledLocalizedValue(source[fieldName])) {
        return source[fieldName];
      }
    }

    if (isFilledLocalizedValue(direct)) {
      return direct;
    }

    const localizedPrefix = `${fieldName}_`;
    const firstLocalizedColumn = Object.entries(source)
      .find(([key, value]) => key.startsWith(localizedPrefix) && isFilledLocalizedValue(value));
    if (firstLocalizedColumn) {
      return firstLocalizedColumn[1];
    }

    return fallback;
  }

  function getForcedLanguage() {
    return normalizeRuntimeLanguage(document.body?.dataset?.forceLanguage || '', { includeHidden: true });
  }

  function getUrlLanguage() {
    try {
      const requested = normalizeLanguageCode(new URL(window.location.href).searchParams.get('lang') || '');
      const normalized = normalizeRuntimeLanguage(requested, { includeHidden: true });
      if (!normalized && isHiddenLanguage(requested)) {
        pendingHiddenUrlLanguage = requested;
      } else if (normalized) {
        pendingHiddenUrlLanguage = '';
      }
      if (isHiddenLanguage(normalized) && isHiddenLanguagePreviewEnabled()) {
        safeSessionStorage('set', HIDDEN_PREVIEW_LANGUAGE_KEY, normalized);
      }
      return normalized;
    } catch (_) {
      return '';
    }
  }

  function getRequestedUrlLanguageCode() {
    try {
      return pendingHiddenUrlLanguage || normalizeLanguageCode(new URL(window.location.href).searchParams.get('lang') || '');
    } catch (_) {
      return pendingHiddenUrlLanguage;
    }
  }

  function getStoredLanguage() {
    return (
      normalizeRuntimeLanguage(safeSessionStorage('get', HIDDEN_PREVIEW_LANGUAGE_KEY), { includeHidden: true })
      || normalizeRuntimeLanguage(safeSessionStorage('get', 'ce_hidden_language'), { includeHidden: true })
      || normalizeRuntimeLanguage(safeLocalStorage('get', STORAGE_KEY), { includeHidden: true })
      || normalizeRuntimeLanguage(safeLocalStorage('get', 'cypruseye-language'), { includeHidden: true })
      || normalizeRuntimeLanguage(safeLocalStorage('get', 'selectedLanguage'), { includeHidden: true })
      || ''
    );
  }

  const profileLanguageSync = {
    disabled: false,
    lastKey: '',
    timer: 0,
  };
  let pendingHiddenUrlLanguage = '';

  function resolvePreferredLanguage() {
    return getForcedLanguage() || getUrlLanguage() || getStoredLanguage() || DEFAULT_LANGUAGE;
  }

  window.appI18n = appI18n;
  appI18n.language = resolvePreferredLanguage();
  const initialLanguageInfo = LANGUAGE_CONFIG[appI18n.language] || LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
  document.documentElement.lang = appI18n.language;
  document.documentElement.dir = initialLanguageInfo.dir;
  document.documentElement.dataset.ceHiddenLanguagePreview = isHiddenLanguagePreviewEnabled() ? 'true' : 'false';

  if (typeof window.getCurrentLanguage !== 'function') {
    window.getCurrentLanguage = function getCurrentLanguage() {
      return resolvePreferredLanguage();
    };
  }

  function safeLocalStorage(action, key, value) {
    try {
      if (action === 'get') {
        return window.localStorage.getItem(key);
      }
      if (action === 'set') {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('Local storage is not available for language preference.', error);
    }
    return null;
  }

  function detectLanguage() {
    return resolvePreferredLanguage();
  }

  function persistLanguage(language) {
    if (isPublicLanguage(language)) {
      safeLocalStorage('set', STORAGE_KEY, language);
      safeSessionStorage('remove', HIDDEN_PREVIEW_LANGUAGE_KEY);
    } else if (isHiddenLanguage(language) && isHiddenLanguagePreviewEnabled()) {
      safeSessionStorage('set', HIDDEN_PREVIEW_LANGUAGE_KEY, language);
    }
  }

  function getSupabaseClientForLanguageSync() {
    const candidates = [];
    try {
      if (typeof window.getSupabase === 'function') {
        candidates.push(window.getSupabase());
      }
    } catch (_error) {
    }
    candidates.push(
      window.supabaseClient,
      window.sb,
      window.CE_STATE?.supabase,
      window.CE_STATE?.sb,
      window.supabase,
    );

    return candidates.find((client) => (
      client
      && typeof client.from === 'function'
      && client.auth
      && (typeof client.auth.getUser === 'function' || typeof client.auth.getSession === 'function')
    )) || null;
  }

  async function getCurrentUserIdForLanguageSync(client) {
    const stateUserId = String(window.CE_STATE?.session?.user?.id || '').trim();
    if (stateUserId) {
      return stateUserId;
    }

    try {
      if (typeof client.auth.getUser === 'function') {
        const { data, error } = await client.auth.getUser();
        if (!error && data?.user?.id) {
          return String(data.user.id);
        }
      }
    } catch (_error) {
    }

    try {
      if (typeof client.auth.getSession === 'function') {
        const { data, error } = await client.auth.getSession();
        if (!error && data?.session?.user?.id) {
          return String(data.session.user.id);
        }
      }
    } catch (_error) {
    }

    return '';
  }

  function shouldDisableProfileLanguageSync(error) {
    const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return (
      text.includes('preferred_language')
      || text.includes('schema cache')
      || text.includes('permission denied')
      || text.includes('row-level security')
      || text.includes('rls')
    );
  }

  function syncProfileLanguagePreference(language, attempt = 0) {
    const target = normalizeSupportedLanguage(language);
    if (!target || profileLanguageSync.disabled) {
      return;
    }

    window.clearTimeout(profileLanguageSync.timer);
    profileLanguageSync.timer = window.setTimeout(async () => {
      const client = getSupabaseClientForLanguageSync();
      if (!client) {
        if (attempt < 6) {
          syncProfileLanguagePreference(target, attempt + 1);
        }
        return;
      }

      const userId = await getCurrentUserIdForLanguageSync(client);
      if (!userId) {
        return;
      }

      const syncKey = `${userId}:${target}`;
      if (profileLanguageSync.lastKey === syncKey) {
        return;
      }

      try {
        const { error } = await client
          .from('profiles')
          .update({ preferred_language: target })
          .eq('id', userId);
        if (error) {
          if (shouldDisableProfileLanguageSync(error)) {
            profileLanguageSync.disabled = true;
          }
          return;
        }
        profileLanguageSync.lastKey = syncKey;
      } catch (error) {
        if (shouldDisableProfileLanguageSync(error)) {
          profileLanguageSync.disabled = true;
        }
      }
    }, 300);
  }

  function syncUrl(language) {
    const current = new URL(window.location.href);
    const isHiddenPreviewLanguage = isHiddenLanguage(language) && isHiddenLanguagePreviewEnabled();
    current.searchParams.set('lang', language);
    if (isHiddenPreviewLanguage) {
      current.searchParams.set(HIDDEN_PREVIEW_PARAM, '1');
    } else {
      current.searchParams.delete(HIDDEN_PREVIEW_PARAM);
    }
    if (current.toString() !== window.location.href) {
      window.history.replaceState({}, '', current);
    }
  }

  function fetchTranslations(language) {
    if (!language || !Object.prototype.hasOwnProperty.call(LANGUAGE_CONFIG, language)) {
      return Promise.resolve({});
    }

    if (translationCache.has(language)) {
      return translationCache.get(language);
    }

    const promise = fetch(`/translations/${language}.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load translations for ${language}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.error('Unable to load translation file.', error);
        return {};
      });

    translationCache.set(language, promise);
    return promise;
  }

  function loadTranslationChain(language) {
    const chain = getLanguageFallbackChain(language);
    return Promise.all(chain.map((code) => fetchTranslations(code))).then((loaded) => {
      loaded.forEach((translations, index) => {
        appI18n.translations[chain[index]] = translations || {};
      });
      return appI18n.translations[language] || {};
    });
  }

  function parseAttributeSpec(spec, fallbackKey) {
    const map = new Map();
    if (!spec) {
      return map;
    }

    spec.split(',').forEach((raw) => {
      const entry = raw.trim();
      if (!entry) {
        return;
      }
      const parts = entry.split(':');
      const attr = parts[0].trim();
      if (!attr) {
        return;
      }
      const key = parts[1] && parts[1].trim();
      map.set(attr, key || fallbackKey || null);
    });

    return map;
  }

  function captureOriginal(element, attrMap) {
    if (!originalContent.has(element)) {
      originalContent.set(element, element.innerHTML);
    }

    if (attrMap.size && !originalAttributes.has(element)) {
      const attrs = {};
      attrMap.forEach((_, attribute) => {
        attrs[attribute] = element.getAttribute(attribute);
      });
      originalAttributes.set(element, attrs);
    }
  }

  function restoreOriginal(element) {
    if (!originalContent.has(element)) {
      return;
    }
    element.innerHTML = originalContent.get(element);
  }

  function restoreOriginalAttribute(element, attribute) {
    const stored = originalAttributes.get(element);
    if (!stored || !Object.prototype.hasOwnProperty.call(stored, attribute)) {
      return;
    }
    const value = stored[attribute];
    if (value === null || typeof value === 'undefined') {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, value);
    }
  }

  function getTranslationEntry(translations, key) {
    if (!key || !translations) {
      return null;
    }

    // Direct lookup for flat keys
    if (Object.prototype.hasOwnProperty.call(translations, key)) {
      return translations[key];
    }

    // Support nested objects via dot notation (e.g. 'language.switcher.label')
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

  function getTranslationString(translations, key) {
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
    return null;
  }

  function getTranslationEntryWithFallback(key, language = appI18n.language) {
    for (const code of getLanguageFallbackChain(language)) {
      const entry = getTranslationEntry(appI18n.translations[code], key);
      if (entry !== null && typeof entry !== 'undefined') {
        return entry;
      }
    }
    return null;
  }

  function getTranslationStringWithFallback(key, language = appI18n.language) {
    return getTranslationString({ __entry: getTranslationEntryWithFallback(key, language) }, '__entry');
  }

  function applyTranslationToElement(element, language) {
    const key = element.dataset.i18n;
    const attrMap = parseAttributeSpec(element.dataset.i18nAttrs, key);

    captureOriginal(element, attrMap);

    let applied = false;
    const entry = getTranslationEntryWithFallback(key, language);
    if (typeof entry === 'string') {
      element.textContent = entry;
      applied = true;
    } else if (entry && typeof entry === 'object' && typeof entry.html === 'string') {
      element.innerHTML = entry.html;
      applied = true;
    } else if (entry && typeof entry === 'object' && typeof entry.text === 'string') {
      element.textContent = entry.text;
      applied = true;
    } else if (!key) {
      applied = true;
    }

    if (!applied) {
      restoreOriginal(element);
    }

    if (attrMap.size) {
      attrMap.forEach((attributeKey, attribute) => {
        const value = getTranslationStringWithFallback(attributeKey, language);
        if (typeof value === 'string') {
          element.setAttribute(attribute, value);
        } else if (attributeKey === key) {
          const fallback = getTranslationStringWithFallback(key, language);
          if (typeof fallback === 'string') {
            element.setAttribute(attribute, fallback);
          } else {
            restoreOriginalAttribute(element, attribute);
          }
        } else {
          restoreOriginalAttribute(element, attribute);
        }
      });
    }
  }

  function applyTranslations(language, translations = {}) {
    appI18n.language = language;
    appI18n.translations[language] = translations;

    const languageInfo = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
    document.documentElement.lang = language;
    document.documentElement.dir = languageInfo.dir;

    const elements = document.querySelectorAll('[data-i18n], [data-i18n-attrs]');
    elements.forEach((element) => {
      applyTranslationToElement(element, language);
    });

    updateInternalLinks(language);

    document.dispatchEvent(
      new CustomEvent('wakacjecypr:languagechange', {
        detail: { language },
      })
    );
  }

  function updateInternalLinks(language) {
    const shouldCarryHiddenPreview = isHiddenLanguage(language) && isHiddenLanguagePreviewEnabled();
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) {
          return;
        }
        url.searchParams.set('lang', language);
        if (shouldCarryHiddenPreview) {
          url.searchParams.set(HIDDEN_PREVIEW_PARAM, '1');
        } else {
          url.searchParams.delete(HIDDEN_PREVIEW_PARAM);
        }
        // Remove leading slash to use relative paths
        const relativePath = url.pathname;
        anchor.setAttribute('href', `${relativePath}${url.search}${url.hash}`);
      } catch (error) {
        console.warn('Unable to normalise link for i18n.', href, error);
      }
    });

    const navigable = document.querySelectorAll('[data-page-url]');
    navigable.forEach((element) => {
      const target = element.getAttribute('data-page-url');
      if (!target) {
        return;
      }
      try {
        const url = new URL(target, window.location.origin);
        if (url.origin !== window.location.origin) {
          return;
        }
        url.searchParams.set('lang', language);
        if (shouldCarryHiddenPreview) {
          url.searchParams.set(HIDDEN_PREVIEW_PARAM, '1');
        } else {
          url.searchParams.delete(HIDDEN_PREVIEW_PARAM);
        }
        element.setAttribute('data-page-url', `${url.pathname}${url.search}${url.hash}`);
      } catch (error) {
        console.warn('Unable to normalise navigation target for i18n.', target, error);
      }
    });
  }

  function updateLanguagePills(language) {
    const groups = document.querySelectorAll('[data-language-toggle]');
    if (!groups.length) {
      return;
    }

    groups.forEach((group) => {
      const pills = group.querySelectorAll('[data-language-pill]');
      pills.forEach((pill) => {
        const code = (pill.dataset.languagePill || '').toLowerCase();
        const isActive = code === language;
        pill.classList.toggle('is-active', isActive);
        pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });
  }

  function ensureLanguagePillOptions(group) {
    const visibleLanguages = getLanguageRegistryForSurface('switcher');
    group.querySelectorAll('[data-language-pill]').forEach((pill) => {
      const code = (pill.dataset.languagePill || '').toLowerCase();
      if (!visibleLanguages[code] && pill.parentNode) {
        pill.parentNode.removeChild(pill);
      }
    });

    Object.keys(visibleLanguages).forEach((code) => {
      if (group.querySelector(`[data-language-pill="${code}"]`)) {
        return;
      }
      const info = visibleLanguages[code];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'language-pill';
      button.dataset.languagePill = code;
      button.dataset.testid = `language-pill-${code}`;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = info.shortLabel || code.toUpperCase();
      group.append(button);
    });
  }

  function initLanguagePills() {
    const groups = document.querySelectorAll('[data-language-toggle]');
    if (!groups.length) {
      return false;
    }

    groups.forEach((group) => {
      ensureLanguagePillOptions(group);
      if (group.dataset.languageInit === 'true') {
        return;
      }

      group.dataset.languageInit = 'true';

      group.addEventListener('click', (event) => {
        const pill = event.target.closest('[data-language-pill]');
        if (!pill || !group.contains(pill)) {
          return;
        }

        const lang = (pill.dataset.languagePill || '').toLowerCase();
        if (!lang) {
          return;
        }

        if (lang === appI18n.language) {
          updateLanguagePills(appI18n.language);
          return;
        }

        setLanguage(lang, { syncProfile: true });
      });
    });

    updateLanguagePills(appI18n.language);
    return true;
  }

  function updateSwitcherValue(language) {
    updateLanguagePills(language);
    const container = document.querySelector('.language-switcher');
    if (!container) {
      return;
    }

    const visibleLanguages = getLanguageRegistryForSurface('switcher');
    const displayLanguage = visibleLanguages[language] ? language : DEFAULT_LANGUAGE;
    const info = visibleLanguages[displayLanguage] || LANGUAGE_CONFIG[displayLanguage] || LANGUAGE_CONFIG[DEFAULT_LANGUAGE];

    const toggle = container.querySelector('.language-switcher-toggle');
    if (toggle) {
      toggle.setAttribute('data-language', displayLanguage);
      const flag = toggle.querySelector('.language-switcher-toggle-flag');
      const text = toggle.querySelector('.language-switcher-toggle-text');
      if (flag) {
        flag.textContent = info.flag || '';
      }
      if (text) {
        text.textContent = info.shortLabel || displayLanguage.toUpperCase();
      }
    }

    const menu = container.querySelector('.language-switcher-menu');
    const options = container.querySelectorAll('.language-switcher-option');
    let activeId = null;

    options.forEach((option) => {
      const isActive = option.dataset.language === displayLanguage;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        activeId = option.id || null;
      }
    });

    if (menu) {
      if (activeId) {
        menu.setAttribute('aria-activedescendant', activeId);
      } else {
        menu.removeAttribute('aria-activedescendant');
      }
    }
  }

  function ensureLanguageSwitcher(language) {
    const disableSwitcher = String(document.body?.dataset?.disableLanguageSwitcher || '') === 'true';
    if (disableSwitcher) {
      const existing = document.querySelector('.language-switcher');
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      return;
    }

    const hasInlineSwitcher = document.querySelector('[data-language-toggle]');
    if (hasInlineSwitcher) {
      initLanguagePills();
      updateLanguagePills(language);
      const floating = document.querySelector('.language-switcher');
      if (floating && floating.parentNode) {
        floating.parentNode.removeChild(floating);
      }
      return;
    }

    const visibleLanguages = getLanguageRegistryForSurface('switcher');
    const visibleLanguageCodes = Object.keys(visibleLanguages);
    const existing = document.querySelector('.language-switcher');
    if (existing) {
      const existingCodes = Array.from(existing.querySelectorAll('.language-switcher-option'))
        .map((option) => option.dataset.language)
        .filter(Boolean);
      if (existingCodes.join(',') === visibleLanguageCodes.join(',')) {
        updateSwitcherValue(language);
        return;
      }
      if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    const container = document.createElement('div');
    container.className = 'language-switcher';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'languageSwitcherToggle';
    toggle.className = 'language-switcher-toggle';
    toggle.dataset.testid = 'language-switcher-toggle';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Language selector');
    toggle.dataset.i18nAttrs = 'aria-label:language.switcher.label';

    const toggleFlag = document.createElement('span');
    toggleFlag.className = 'language-switcher-toggle-flag';
    toggle.append(toggleFlag);

    const toggleText = document.createElement('span');
    toggleText.className = 'language-switcher-toggle-text';
    toggle.append(toggleText);

    const menu = document.createElement('ul');
    menu.className = 'language-switcher-menu';
    menu.id = 'languageSwitcherMenu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Language selector');
    menu.dataset.i18nAttrs = 'aria-label:language.switcher.label';
    menu.setAttribute('aria-hidden', 'true');

    toggle.setAttribute('aria-controls', menu.id);

    const setOptionsTabIndex = (value) => {
      menu.querySelectorAll('.language-switcher-option').forEach((option) => {
        option.tabIndex = value;
      });
    };

    function handleDocumentPointerDown(event) {
      if (!container.contains(event.target)) {
        closeMenu();
      }
    }

    function handleDocumentKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusToggle: true });
      }
    }

    function handleMenuKeydown(event) {
      const options = Array.from(menu.querySelectorAll('.language-switcher-option'));
      if (!options.length) {
        return;
      }

      const currentIndex = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
        options[nextIndex].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = currentIndex === -1 ? options.length - 1 : (currentIndex - 1 + options.length) % options.length;
        options[prevIndex].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        options[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        options[options.length - 1].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusToggle: true });
      } else if (event.key === 'Tab') {
        closeMenu();
      }
    }

    function openMenu() {
      if (container.classList.contains('is-open')) {
        return;
      }

      container.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      setOptionsTabIndex(0);

      const activeOption =
        menu.querySelector('.language-switcher-option.is-active') ||
        menu.querySelector('.language-switcher-option');

      window.requestAnimationFrame(() => {
        if (activeOption) {
          activeOption.focus();
        }
      });

      document.addEventListener('pointerdown', handleDocumentPointerDown, true);
      document.addEventListener('keydown', handleDocumentKeydown);
    }

    function closeMenu({ focusToggle = false } = {}) {
      if (!container.classList.contains('is-open')) {
        return;
      }

      container.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      setOptionsTabIndex(-1);

      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      document.removeEventListener('keydown', handleDocumentKeydown);

      if (focusToggle) {
        toggle.focus();
      }
    }

    visibleLanguageCodes.forEach((code) => {
      const info = visibleLanguages[code];
      const item = document.createElement('li');
      item.className = 'language-switcher-menu-item';

      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'language-switcher-option';
      option.id = `languageSwitcherOption-${code}`;
      option.dataset.language = code;
      option.dataset.testid = `language-option-${code}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', code === language ? 'true' : 'false');
      option.tabIndex = -1;

      const flag = document.createElement('span');
      flag.className = 'language-switcher-option-flag';
      flag.textContent = info.flag || '';
      option.append(flag);

      const label = document.createElement('span');
      label.className = 'language-switcher-option-label';
      label.dataset.i18n = `language.option.${code}`;
      label.textContent = info.label;
      option.append(label);

      option.addEventListener('click', () => {
        closeMenu();
        if (code !== appI18n.language) {
          setLanguage(code, { syncProfile: true });
        }
      });

      item.append(option);
      menu.append(item);
    });

    toggle.addEventListener('click', () => {
      if (container.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        if (!container.classList.contains('is-open')) {
          event.preventDefault();
          openMenu();
        }
      }
    });

    menu.addEventListener('keydown', handleMenuKeydown);

    container.append(toggle, menu);
    document.body.append(container);

    updateSwitcherValue(language);
    setOptionsTabIndex(-1);
  }

  function setLanguage(language, { persist = true, updateUrl = true, syncProfile = false } = {}) {
    let target = normalizeRuntimeLanguage(language, { includeHidden: true });
    if (!target) {
      target = DEFAULT_LANGUAGE;
    }

    if (persist) {
      persistLanguage(target);
    }
    if (persist && syncProfile && isPublicLanguage(target)) {
      syncProfileLanguagePreference(target);
    }
    if (updateUrl) {
      syncUrl(target);
    }

    // Apply text direction (RTL/LTR)
    const langConfig = LANGUAGE_CONFIG[target];
    if (langConfig) {
      document.documentElement.setAttribute('dir', langConfig.dir);
      document.documentElement.setAttribute('lang', target);
      document.documentElement.dataset.ceHiddenLanguagePreview = isHiddenLanguage(target) ? 'true' : 'false';
    }

    const apply = (translations = {}) => {
      const run = () => {
        ensureLanguageSwitcher(target);
        applyTranslations(target, translations);
        updateSwitcherValue(target);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
      } else {
        run();
      }
    };

    loadTranslationChain(target).then((translations) => {
      apply(translations);
    });
  }

  function maybeApplyDeferredBetaLanguage() {
    const requested = getRequestedUrlLanguageCode();
    if (!requested || !isHiddenLanguage(requested)) {
      return;
    }
    const target = normalizeRuntimeLanguage(requested, { includeHidden: true });
    if (target && target !== appI18n.language) {
      pendingHiddenUrlLanguage = '';
      setLanguage(target, { persist: false, updateUrl: true });
    }
  }

  function init() {
    // First-visit language choice owns initial i18n application.
    // This keeps the page loading in the background without auto-selecting English.
    const languageSelector = window.languageSelector;
    if (languageSelector && typeof languageSelector.requiresSelection === 'function' && languageSelector.requiresSelection()) {
      return;
    }

    const detected = detectLanguage();
    const language = normalizeRuntimeLanguage(detected, { includeHidden: true })
      ? detected
      : DEFAULT_LANGUAGE;

    const forced = (document.body?.dataset?.forceLanguage || '').toLowerCase();
    const isForced = forced && Boolean(normalizeRuntimeLanguage(forced, { includeHidden: true }));

    setLanguage(language, { persist: !isForced, updateUrl: !isForced });
  }

  document.addEventListener('ce-auth:state', maybeApplyDeferredBetaLanguage);

  appI18n.setLanguage = setLanguage;
  appI18n.getLanguageFallbackChain = getLanguageFallbackChain;
  appI18n.getTranslationEntry = getTranslationEntryWithFallback;
  appI18n.getTranslationString = getTranslationStringWithFallback;
  appI18n.pickLocalizedValue = pickLocalizedValue;
  appI18n.pickLocalizedField = pickLocalizedField;
  appI18n.isHiddenLanguagePreviewEnabled = isHiddenLanguagePreviewEnabled;
  appI18n.getPublicLanguageCodes = getPublicLanguageCodes;
  appI18n.isLanguageEnabledForSurface = isLanguageEnabledForSurface;
  appI18n.getHePageReadiness = getHePageReadiness;
  appI18n.isLanguageAllowedOnCurrentPage = isLanguageAllowedOnCurrentPage;

  window.CELanguage = Object.assign(window.CELanguage || {}, {
    getLanguageFallbackChain,
    pickLocalizedValue,
    pickLocalizedField,
    isPublicLanguage,
    isHiddenLanguagePreviewEnabled,
    getPublicLanguageCodes,
    isLanguageEnabledForSurface,
    getHePageReadiness,
    isLanguageAllowedOnCurrentPage,
  });

  window.CELanguageRollout = Object.assign(window.CELanguageRollout || {}, {
    modes: ROLLOUT_MODES,
    hePageReadinessStatuses: HE_PAGE_READINESS_STATUS,
    hiddenPreviewParam: HIDDEN_PREVIEW_PARAM,
    getPublicLanguageCodes,
    isLanguageEnabledForSurface,
    getHePageReadiness,
    isLanguageAllowedOnCurrentPage,
    isPublicLanguage,
    isHiddenLanguage,
    isHiddenLanguagePreviewEnabled,
    snapshot() {
      return Object.fromEntries(
        Object.keys(LANGUAGE_REGISTRY).map((code) => [
          code,
          {
            mode: getLanguageRollout(code)?.mode || ROLLOUT_MODES.INTERNAL_ONLY,
            hidden: Boolean(LANGUAGE_REGISTRY[code]?.hidden),
            pageReadiness: code === 'he' ? getHePageReadiness() : null,
            publicSurfaces: {
              switcher: isLanguageEnabledForSurface(code, 'switcher'),
              seo: isLanguageEnabledForSurface(code, 'seo'),
              sitemap: isLanguageEnabledForSurface(code, 'sitemap'),
              hreflang: isLanguageEnabledForSurface(code, 'hreflang'),
              canonical: isLanguageEnabledForSurface(code, 'canonical'),
              routes: isLanguageEnabledForSurface(code, 'routes'),
              publicApi: isLanguageEnabledForSurface(code, 'publicApi'),
              indexing: isLanguageEnabledForSurface(code, 'indexing'),
            },
          },
        ])
      );
    },
  });

  // Wait for language selector to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 10); // Small delay to let language selector initialize first
    });
  } else {
    setTimeout(init, 10);
  }
})();
