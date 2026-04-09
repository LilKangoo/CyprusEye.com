import { createSupabaseClients } from './supabaseAdmin.js';

export const SERVICE_OFFER_DEFAULT_LANGUAGE = 'en';
export const SERVICE_OFFER_SUPPORTED_LANGUAGES = ['pl', 'en'];
export const SERVICE_OFFER_DEFAULT_IMAGE = '/assets/cyprus_logo-1000x1054.png';

const SERVICE_CONFIG = {
  hotel: {
    table: 'hotels',
    templatePath: '/hotel.html',
    queryPath: '/hotel.html',
    pathPrefix: '/hotel/',
    primarySelect: 'id, slug, title, description, meta_description, meta_image_url, cover_image_url, city, is_published',
    legacySelect: 'id, slug, title, description, cover_image_url, city, is_published',
  },
  trip: {
    table: 'trips',
    templatePath: '/trip.html',
    queryPath: '/trip.html',
    pathPrefix: '/trip/',
    primarySelect: 'id, slug, title, description, meta_description, meta_image_url, cover_image_url, start_city, is_published',
    legacySelect: 'id, slug, title, description, cover_image_url, start_city, is_published',
  },
};

function normalizePathname(pathname) {
  const raw = String(pathname || '/').trim() || '/';
  if (raw === '/') {
    return '/';
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function normalizeOfferSlug(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

function isMissingSeoColumnError(error) {
  const parts = [
    String(error?.code || ''),
    String(error?.message || ''),
    String(error?.details || ''),
    String(error?.hint || ''),
  ].filter(Boolean);
  if (!parts.length) {
    return false;
  }
  const combined = parts.join(' ').toLowerCase();
  return (
    combined.includes('42703')
    || combined.includes('does not exist')
    || combined.includes('could not find')
    || combined.includes('column')
  ) && /(meta_description|meta_image_url)/i.test(combined);
}

function getReadClient(env) {
  const { publicClient, adminClient } = createSupabaseClients(env);
  return publicClient || adminClient;
}

export function normalizeServiceOfferLanguage(value) {
  return String(value || '').trim().toLowerCase() === 'pl' ? 'pl' : SERVICE_OFFER_DEFAULT_LANGUAGE;
}

export function pickLocalizedServiceValue(value, language) {
  const resolvedLanguage = normalizeServiceOfferLanguage(language);
  if (typeof value === 'string') {
    return value.trim();
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  return String(
    value[resolvedLanguage]
    || value.en
    || value.pl
    || Object.values(value).find((entry) => typeof entry === 'string')
    || ''
  ).trim();
}

export function resolveServiceOfferRequest(pathname, requestSearch = '') {
  const normalizedPath = normalizePathname(pathname);
  const searchParams = new URLSearchParams(requestSearch || '');
  const querySlug = normalizeOfferSlug(searchParams.get('slug'));

  for (const [kind, config] of Object.entries(SERVICE_CONFIG)) {
    if (
      normalizedPath === normalizePathname(config.queryPath)
      || normalizedPath === `/${kind}`
    ) {
      if (!querySlug) {
        return null;
      }
      return {
        kind,
        slug: querySlug,
        templatePath: config.templatePath,
        requestPathname: normalizedPath === `/${kind}` ? `/${kind}` : config.queryPath,
        pathStyle: 'query',
      };
    }

    if (normalizedPath.startsWith(normalizePathname(config.pathPrefix))) {
      const remainder = normalizedPath.slice(normalizePathname(config.pathPrefix).length).replace(/^\/+|\/+$/g, '');
      if (!remainder || remainder.includes('/')) {
        return null;
      }
      return {
        kind,
        slug: normalizeOfferSlug(decodeURIComponent(remainder)),
        templatePath: config.templatePath,
        requestPathname: `/${kind}/${remainder}`,
        pathStyle: 'path',
      };
    }
  }

  return null;
}

export async function getPublishedServiceOfferBySlug(env, { kind, slug } = {}) {
  const config = SERVICE_CONFIG[kind];
  const normalizedSlug = normalizeOfferSlug(slug);
  if (!config || !normalizedSlug) {
    return null;
  }

  const client = getReadClient(env);
  if (!client) {
    throw new Error('Supabase read client is not available');
  }

  const runQuery = (select) => client
    .from(config.table)
    .select(select)
    .eq('slug', normalizedSlug)
    .eq('is_published', true)
    .maybeSingle();

  let response = await runQuery(config.primarySelect);
  if (response?.error && isMissingSeoColumnError(response.error)) {
    response = await runQuery(config.legacySelect);
  }

  if (response?.error) {
    throw response.error;
  }
  if (!response?.data) {
    return null;
  }

  const row = response.data;
  return {
    id: row.id || null,
    kind,
    slug: String(row.slug || normalizedSlug).trim(),
    title: row.title || {},
    description: row.description || {},
    metaDescription: row.meta_description || {},
    metaImageUrl: String(row.meta_image_url || '').trim(),
    coverImageUrl: String(row.cover_image_url || '').trim(),
    city: String(row.city || row.start_city || '').trim(),
    raw: row,
  };
}
