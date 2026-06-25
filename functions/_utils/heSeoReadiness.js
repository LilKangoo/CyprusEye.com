import { ROLLOUT_MODES, normalizeLanguageCode } from './languageRollout.js';

export const HE_SEO_STATUS = Object.freeze({
  CANDIDATE_READY: 'candidate_ready',
  RECORD_GATED_READY: 'record_gated_ready',
  BLOCKED: 'blocked',
  EXCLUDED: 'excluded',
});

const HE_SEO_SURFACE_FLAGS = Object.freeze({
  seo: 'seoEnabled',
  sitemap: 'sitemapEnabled',
  hreflang: 'hreflangEnabled',
  canonical: 'canonicalEnabled',
  indexing: 'indexingEnabled',
});

const DEFAULT_HE_SEO_ROLLOUT = Object.freeze({
  mode: ROLLOUT_MODES.PARTIAL_PUBLIC,
  seoEnabled: true,
  sitemapEnabled: true,
  hreflangEnabled: true,
  canonicalEnabled: true,
  canonicalHeEnabled: true,
  indexingEnabled: true,
});

const HE_SEO_PAGE_REGISTRY = Object.freeze({
  home: Object.freeze({
    status: HE_SEO_STATUS.CANDIDATE_READY,
    paths: Object.freeze(['/', '/index.html']),
    reason: 'Home is page-gated live; Blog/Shop/blocked modules are hidden or normalized to EN/LTR.',
  }),
  transport: Object.freeze({
    status: HE_SEO_STATUS.CANDIDATE_READY,
    paths: Object.freeze(['/transport.html', '/transport', '/transport/']),
    reason: 'Transport dynamic content is HE-ready.',
  }),
  hotels: Object.freeze({
    status: HE_SEO_STATUS.CANDIDATE_READY,
    paths: Object.freeze(['/hotels.html', '/hotels', '/hotels/']),
    reason: 'Hotels list and amenities were completed in Stage25.',
  }),
  hotel: Object.freeze({
    status: HE_SEO_STATUS.CANDIDATE_READY,
    paths: Object.freeze(['/hotel.html', '/hotel', '/hotel/']),
    recordScoped: true,
    reason: 'Hotel detail can be indexed only for HE-ready hotel records.',
  }),
  recommendations: Object.freeze({
    status: HE_SEO_STATUS.CANDIDATE_READY,
    paths: Object.freeze(['/recommendations.html', '/recommendations', '/recommendations/']),
    reason: 'Recommendations page data was completed in Stage25.',
  }),
  car: Object.freeze({
    status: HE_SEO_STATUS.RECORD_GATED_READY,
    paths: Object.freeze(['/car.html', '/car', '/car/']),
    reason: 'Car HE is limited to Stage33 HE-ready records.',
  }),
  carOffer: Object.freeze({
    status: HE_SEO_STATUS.BLOCKED,
    paths: Object.freeze([]),
    recordScoped: true,
    reason: 'Individual car offer SEO is not part of the first HE SEO activation.',
  }),
  trips: Object.freeze({
    status: HE_SEO_STATUS.RECORD_GATED_READY,
    paths: Object.freeze(['/trips.html', '/trips', '/trips/']),
    reason: 'Trips list HE is limited to Stage33 top trip records.',
  }),
  trip: Object.freeze({
    status: HE_SEO_STATUS.RECORD_GATED_READY,
    paths: Object.freeze(['/trip.html', '/trip', '/trip/']),
    recordScoped: true,
    reason: 'Trip detail HE is allowed only for HE-ready trip records.',
  }),
  poiMap: Object.freeze({
    status: HE_SEO_STATUS.RECORD_GATED_READY,
    paths: Object.freeze(['/map', '/map/', '/poi', '/poi/']),
    recordScoped: true,
    indexable: false,
    reason: 'POI/map has HE-ready records but no approved standalone HE indexable route yet.',
  }),
  blog: Object.freeze({
    status: HE_SEO_STATUS.RECORD_GATED_READY,
    paths: Object.freeze(['/blog', '/blog/', '/blog.html']),
    recordScoped: true,
    reason: 'Blog HE is public only when public_ready reviewed Hebrew posts exist.',
  }),
  blogPost: Object.freeze({
    status: HE_SEO_STATUS.RECORD_GATED_READY,
    paths: Object.freeze(['/blog/']),
    prefix: true,
    recordScoped: true,
    reason: 'Blog detail HE is public only for public_ready reviewed Hebrew translation rows.',
  }),
  plan: Object.freeze({
    status: HE_SEO_STATUS.BLOCKED,
    paths: Object.freeze(['/plan.html', '/plan', '/plan/']),
    reason: 'Plan HE content and SEO copy are not reviewed.',
  }),
  community: Object.freeze({
    status: HE_SEO_STATUS.BLOCKED,
    paths: Object.freeze(['/community.html', '/community', '/community/']),
    reason: 'Community/POI content is not globally HE-ready.',
  }),
  accountAuth: Object.freeze({
    status: HE_SEO_STATUS.BLOCKED,
    paths: Object.freeze(['/auth', '/auth/', '/auth/index.html', '/account', '/account/', '/account/index.html']),
    reason: 'Auth/account HE SEO is not in public launch scope.',
  }),
  legal: Object.freeze({
    status: HE_SEO_STATUS.BLOCKED,
    paths: Object.freeze(['/terms.html', '/terms', '/terms/']),
    reason: 'Legal HE copy requires human review before indexing.',
  }),
  notFound: Object.freeze({
    status: HE_SEO_STATUS.BLOCKED,
    paths: Object.freeze(['/404.html', '/404', '/404/']),
    reason: '404 should not receive HE indexing.',
  }),
  shop: Object.freeze({
    status: HE_SEO_STATUS.EXCLUDED,
    paths: Object.freeze(['/shop.html', '/shop', '/shop/', '/shop-success.html']),
    reason: 'Shop/cart/checkout/payment remain excluded from HE.',
  }),
  checkout: Object.freeze({
    status: HE_SEO_STATUS.EXCLUDED,
    paths: Object.freeze(['/cart', '/cart/', '/checkout', '/checkout/', '/payment', '/payment/']),
    prefix: true,
    reason: 'Cart, checkout and payment are never HE SEO surfaces in the current rollout.',
  }),
  partners: Object.freeze({
    status: HE_SEO_STATUS.EXCLUDED,
    paths: Object.freeze(['/partners', '/partners/', '/partners/index.html']),
    prefix: true,
    reason: 'Partner/admin surfaces are not public HE SEO pages.',
  }),
  admin: Object.freeze({
    status: HE_SEO_STATUS.EXCLUDED,
    paths: Object.freeze(['/admin', '/admin/', '/admin/dashboard.html']),
    prefix: true,
    reason: 'Admin is excluded from public HE SEO.',
  }),
  unknown: Object.freeze({
    status: HE_SEO_STATUS.BLOCKED,
    paths: Object.freeze([]),
    reason: 'Unknown pages default to blocked for HE SEO.',
  }),
});

const HE_SEO_PAGE_ALIASES = Object.freeze({
  carRentalLanding: 'car',
  terms: 'legal',
  account: 'accountAuth',
  auth: 'accountAuth',
  reset: 'accountAuth',
});

let cachedServerSeoRollout = null;

function getProcessEnv() {
  return globalThis.process?.env || {};
}

function parseBooleanEnv(value, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function getServerHeSeoRollout() {
  if (cachedServerSeoRollout) {
    return cachedServerSeoRollout;
  }

  const env = getProcessEnv();
  const rollout = { ...DEFAULT_HE_SEO_ROLLOUT };
  const rawConfig = String(env.CE_HE_SEO_ROLLOUT_CONFIG || '').trim();
  if (rawConfig) {
    try {
      const parsed = JSON.parse(rawConfig);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.assign(rollout, parsed);
      }
    } catch (error) {
      console.warn('[he-seo-readiness] Ignoring invalid CE_HE_SEO_ROLLOUT_CONFIG JSON.', error);
    }
  }

  if (env.CE_HE_SEO_MODE) {
    rollout.mode = env.CE_HE_SEO_MODE;
  }
  if (env.CE_HE_SEO_ENABLED !== undefined) {
    const enabled = parseBooleanEnv(env.CE_HE_SEO_ENABLED, true);
    rollout.seoEnabled = enabled;
    rollout.sitemapEnabled = enabled;
    rollout.hreflangEnabled = enabled;
    rollout.canonicalEnabled = enabled;
    rollout.canonicalHeEnabled = enabled;
    rollout.indexingEnabled = enabled;
  }

  cachedServerSeoRollout = rollout;
  return cachedServerSeoRollout;
}

function normalizePathname(pathname) {
  const raw = String(pathname || '/').trim() || '/';
  if (raw === '/') return raw;
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function normalizeRolloutMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'public') return 'full_public';
  if (normalized === 'beta') return 'beta_users';
  return normalized;
}

function isPublicSeoMode(value) {
  const mode = normalizeRolloutMode(value);
  return mode === 'partial_public' || mode === 'full_public';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

export function getHeSeoPageRegistry() {
  return HE_SEO_PAGE_REGISTRY;
}

export function resolveHeSeoPageKey(input = {}) {
  const explicit = String(input.pageKey || input.seoPage || '').trim();
  if (explicit) {
    const alias = HE_SEO_PAGE_ALIASES[explicit] || explicit;
    if (HE_SEO_PAGE_REGISTRY[alias]) {
      return alias;
    }
  }

  const pathname = normalizePathname(input.pathname || input.path || input.url || '/');
  for (const [key, entry] of Object.entries(HE_SEO_PAGE_REGISTRY)) {
    const paths = Array.isArray(entry.paths) ? entry.paths : [];
    for (const candidate of paths) {
      const normalizedCandidate = normalizePathname(candidate);
      if (entry.prefix) {
        if (pathname === normalizedCandidate || pathname.startsWith(`${normalizedCandidate}/`)) {
          return key;
        }
      } else if (pathname === normalizedCandidate) {
        return key;
      }
    }
  }

  return 'unknown';
}

export function getHeSeoReadiness(input = {}) {
  const key = resolveHeSeoPageKey(input);
  const entry = HE_SEO_PAGE_REGISTRY[key] || HE_SEO_PAGE_REGISTRY.unknown;
  return {
    key,
    status: entry.status,
    recordScoped: entry.recordScoped === true,
    indexable: entry.indexable !== false,
    reason: entry.reason || '',
  };
}

export function isHeSeoSurfaceFlagEnabled(surface = 'seo', options = {}) {
  const normalizedSurface = String(surface || 'seo').trim();
  const rollout = options.rollout && typeof options.rollout === 'object'
    ? options.rollout
    : getServerHeSeoRollout();

  if (!isPublicSeoMode(rollout.mode)) {
    return false;
  }

  const explicitFlag = HE_SEO_SURFACE_FLAGS[normalizedSurface];
  if (normalizedSurface === 'canonical' && hasOwn(rollout, 'canonicalHeEnabled')) {
    return rollout.canonicalHeEnabled === true;
  }
  if (explicitFlag && hasOwn(rollout, explicitFlag)) {
    return rollout[explicitFlag] === true;
  }
  if (hasOwn(rollout, normalizedSurface)) {
    return rollout[normalizedSurface] === true;
  }
  return false;
}

export function canGenerateHeSeo(input = {}) {
  if (normalizeLanguageCode(input.language || 'he') !== 'he') {
    return false;
  }

  const surface = String(input.surface || 'seo').trim() || 'seo';
  const readiness = getHeSeoReadiness(input);
  if (readiness.status === HE_SEO_STATUS.BLOCKED || readiness.status === HE_SEO_STATUS.EXCLUDED) {
    return false;
  }
  if (!readiness.indexable) {
    return false;
  }
  if (readiness.recordScoped && input.recordReady !== true) {
    return false;
  }
  return isHeSeoSurfaceFlagEnabled(surface, input);
}

export function getHeSeoReadinessTable() {
  return Object.entries(HE_SEO_PAGE_REGISTRY).map(([key, entry]) => ({
    key,
    status: entry.status,
    recordScoped: entry.recordScoped === true,
    indexable: entry.indexable !== false,
    reason: entry.reason || '',
  }));
}
