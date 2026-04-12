import { createSupabaseClients } from './supabaseAdmin.js';

export const BLOG_DEFAULT_LANGUAGE = 'en';
export const BLOG_SUPPORTED_LANGUAGES = ['pl', 'en'];
export const BLOG_ALLOWED_CTA_TYPES = ['pois', 'trips', 'hotels', 'cars', 'transport', 'shop', 'recommendations', 'blog'];
export const BLOG_LIST_PAGE_SIZE = 12;
const BLOG_CTA_TYPE_ALIASES = {
  trips: ['trip', 'trips', 'tour', 'tours', 'wycieczka', 'wycieczki'],
  hotels: ['hotel', 'hotels', 'stay', 'stays', 'accommodation', 'accommodations', 'nocleg', 'noclegi'],
  cars: ['car', 'cars', 'car_offer', 'car_offers', 'car-rental', 'car_rental', 'auto', 'auta'],
  transport: ['transport', 'route', 'routes', 'transfer', 'transfers', 'ride', 'rides', 'przejazd', 'trasa'],
  shop: ['shop', 'store', 'product', 'products', 'sklep', 'produkt', 'produkty'],
  pois: ['poi', 'pois', 'place', 'places', 'attraction', 'attractions', 'miejsce', 'miejsca'],
  recommendations: [
    'recommendation',
    'recommendations',
    'recommended',
    'restaurant',
    'restaurants',
    'restauracja',
    'restauracje',
  ],
  blog: ['blog', 'post', 'posts', 'article', 'articles', 'blog-post', 'blog_article', 'artykul', 'artykuly'],
};

const BLOG_LIST_SELECT = `
  id,
  status,
  submission_status,
  published_at,
  cover_image_url,
  cover_image_alt,
  featured,
  allow_comments,
  categories,
  categories_pl,
  categories_en,
  tags,
  tags_pl,
  tags_en,
  cta_services,
  author_profile_id,
  owner_partner_id,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  created_at,
  updated_at,
  author_profile:profiles!blog_posts_author_profile_id_fkey (
    id,
    name,
    username,
    avatar_url
  ),
  translations:blog_post_translations (
    id,
    lang,
    slug,
    title,
    meta_title,
    meta_description,
    summary,
    lead,
    author_name,
    author_url,
    og_image_url,
    created_at,
    updated_at
  )
`;

const BLOG_LIST_SELECT_LEGACY = `
  id,
  status,
  submission_status,
  published_at,
  cover_image_url,
  cover_image_alt,
  featured,
  allow_comments,
  categories,
  tags,
  cta_services,
  author_profile_id,
  owner_partner_id,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  created_at,
  updated_at,
  author_profile:profiles!blog_posts_author_profile_id_fkey (
    id,
    name,
    username,
    avatar_url
  ),
  translations:blog_post_translations (
    id,
    lang,
    slug,
    title,
    meta_title,
    meta_description,
    summary,
    lead,
    author_name,
    author_url,
    og_image_url,
    created_at,
    updated_at
  )
`;

const BLOG_POST_SELECT = `
  id,
  blog_post_id,
  lang,
  slug,
  title,
  meta_title,
  meta_description,
  summary,
  lead,
  author_name,
  author_url,
  content_json,
  content_html,
  og_image_url,
  created_at,
  updated_at,
  blog_post:blog_posts (
    id,
    status,
    submission_status,
    published_at,
    cover_image_url,
    cover_image_alt,
    featured,
    allow_comments,
    categories,
    categories_pl,
    categories_en,
    tags,
    tags_pl,
    tags_en,
    cta_services,
    author_profile_id,
    owner_partner_id,
    reviewed_at,
    reviewed_by,
    rejection_reason,
    created_at,
    updated_at,
    author_profile:profiles!blog_posts_author_profile_id_fkey (
      id,
      name,
      username,
      avatar_url
    )
  )
`;

const BLOG_POST_SELECT_LEGACY = `
  id,
  blog_post_id,
  lang,
  slug,
  title,
  meta_title,
  meta_description,
  summary,
  lead,
  author_name,
  author_url,
  content_json,
  content_html,
  og_image_url,
  created_at,
  updated_at,
  blog_post:blog_posts (
    id,
    status,
    submission_status,
    published_at,
    cover_image_url,
    cover_image_alt,
    featured,
    allow_comments,
    categories,
    tags,
    cta_services,
    author_profile_id,
    owner_partner_id,
    reviewed_at,
    reviewed_by,
    rejection_reason,
    created_at,
    updated_at,
    author_profile:profiles!blog_posts_author_profile_id_fkey (
      id,
      name,
      username,
      avatar_url
    )
  )
`;

export function normalizeBlogLanguage(value) {
  return String(value || '').trim().toLowerCase() === 'pl' ? 'pl' : BLOG_DEFAULT_LANGUAGE;
}

export function normalizeBlogSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeBlogServiceType(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (!raw) {
    return '';
  }

  if (BLOG_ALLOWED_CTA_TYPES.includes(raw)) {
    return raw;
  }

  for (const [canonical, aliases] of Object.entries(BLOG_CTA_TYPE_ALIASES)) {
    if (aliases.includes(raw)) {
      return canonical;
    }
  }

  return '';
}

export function normalizeCtaServices(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => ({
      type: normalizeBlogServiceType(entry?.type),
      resource_id: String(entry?.resource_id || entry?.resourceId || '').trim(),
    }))
    .filter((entry) => BLOG_ALLOWED_CTA_TYPES.includes(entry.type) && entry.resource_id)
    .slice(0, 3);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isMissingBlogTaxonomyColumnError(error) {
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
  ) && /(categories_pl|categories_en|tags_pl|tags_en)/i.test(combined);
}

async function executeBlogQueryWithTaxonomyFallback(primaryFactory, legacyFactory) {
  const primary = await primaryFactory();
  if (!primary?.error || !isMissingBlogTaxonomyColumnError(primary.error) || typeof legacyFactory !== 'function') {
    return primary;
  }
  return legacyFactory();
}

function applyPublishedBlogFilters(query, options = {}) {
  const language = normalizeBlogLanguage(options.language);
  const normalizedCategory = String(options.category || '').trim();
  const normalizedTag = String(options.tag || '').trim();
  const featuredOnly = String(options.featured || '').trim() === '1' || options.featured === true;
  const useLegacyTaxonomy = options.useLegacyTaxonomy === true;
  const categoryColumn = useLegacyTaxonomy ? 'categories' : (language === 'pl' ? 'categories_pl' : 'categories_en');
  const tagColumn = useLegacyTaxonomy ? 'tags' : (language === 'pl' ? 'tags_pl' : 'tags_en');

  let nextQuery = query
    .eq('status', 'published')
    .eq('submission_status', 'approved')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString());

  if (featuredOnly) {
    nextQuery = nextQuery.eq('featured', true);
  }
  if (normalizedCategory) {
    nextQuery = nextQuery.contains(categoryColumn, [normalizedCategory]);
  }
  if (normalizedTag) {
    nextQuery = nextQuery.contains(tagColumn, [normalizedTag]);
  }

  return nextQuery;
}

function getReadClient(env) {
  const { publicClient, adminClient } = createSupabaseClients(env);
  return publicClient || adminClient;
}

function isPublishedRow(row) {
  if (!row || row.status !== 'published' || row.submission_status !== 'approved' || !row.published_at) {
    return false;
  }

  const publishedAtMs = new Date(row.published_at).getTime();
  return Number.isFinite(publishedAtMs) && publishedAtMs <= Date.now();
}

function mapAuthorProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  return {
    id: profile.id || null,
    name: profile.name || '',
    username: profile.username || '',
    avatarUrl: profile.avatar_url || '',
  };
}

function pickLocalizedText(value, language) {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  return (
    value[language]
    || value.en
    || value.pl
    || Object.values(value).find((entry) => typeof entry === 'string')
    || ''
  );
}

function normalizeTaxonomyArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
}

function getTaxonomyByLang(row, kind) {
  const legacy = normalizeTaxonomyArray(row?.[kind]);
  const pl = normalizeTaxonomyArray(row?.[`${kind}_pl`]);
  const en = normalizeTaxonomyArray(row?.[`${kind}_en`]);
  return {
    pl: pl.length ? pl : legacy,
    en: en.length ? en : legacy,
  };
}

function pickLocalizedObjectField(source, language) {
  if (typeof source === 'string') {
    return source;
  }
  if (!source || typeof source !== 'object') {
    return '';
  }
  return String(
    source[language]
    || source.en
    || source.pl
    || Object.values(source).find((entry) => typeof entry === 'string')
    || ''
  ).trim();
}

function pickMedia(source) {
  if (!source || typeof source !== 'object') {
    return '/assets/cyprus_logo-1000x1054.png';
  }
  const arrayMedia = [];
  const pushMedia = (entry) => {
    if (!entry) return;
    if (typeof entry === 'string') {
      const normalized = entry.trim();
      if (normalized) arrayMedia.push(normalized);
      return;
    }
    if (typeof entry === 'object') {
      pushMedia(entry.url || entry.src || entry.image_url || entry.photo_url);
    }
  };
  safeArray(source.photos).forEach(pushMedia);
  safeArray(source.images).forEach(pushMedia);
  const candidates = [
    source.cover_image_url,
    source.image_url,
    source.main_image_url,
    source.thumbnail_url,
    ...arrayMedia,
  ];
  return String(candidates.find((entry) => String(entry || '').trim()) || '/assets/cyprus_logo-1000x1054.png').trim();
}

function truncateText(value, maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function slugifyText(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCarReadableSlug(row) {
  const raw = pickLocalizedObjectField(row?.car_model, 'en')
    || pickLocalizedObjectField(row?.car_model, 'pl')
    || pickLocalizedObjectField(row?.car_type, 'en')
    || pickLocalizedObjectField(row?.car_type, 'pl')
    || String(row?.car_model || row?.car_type || '').trim();
  return slugifyText(raw || 'car-offer');
}

function buildCarHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  const offerLocation = String(row?.location || '').trim().toLowerCase();
  if (resourceId) {
    params.set('offer_id', resourceId);
    params.set('car', getCarReadableSlug(row));
  }
  if (offerLocation) {
    params.set('offer_location', offerLocation);
  }
  params.set('lang', normalizeBlogLanguage(language));
  return `/car.html?${params.toString()}`;
}

function buildRecommendationHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  if (resourceId) {
    params.set('recommendation', resourceId);
  }
  params.set('lang', normalizeBlogLanguage(language));
  return `/recommendations.html?${params.toString()}`;
}

function buildTransportHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  if (resourceId) {
    params.set('route_id', resourceId);
  }
  params.set('lang', normalizeBlogLanguage(language));
  return `/transport.html?${params.toString()}`;
}

function buildShopHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  if (resourceId) {
    params.set('product', resourceId);
  }
  params.set('lang', normalizeBlogLanguage(language));
  return `/shop.html?${params.toString()}`;
}

function buildBlogHref(row, language) {
  const translations = safeArray(row?.translations);
  const preferred = translations.find((entry) => normalizeBlogLanguage(entry?.lang) === normalizeBlogLanguage(language)) || null;
  const fallback = translations.find((entry) => normalizeBlogLanguage(entry?.lang) === 'en')
    || translations.find((entry) => normalizeBlogLanguage(entry?.lang) === 'pl')
    || translations[0]
    || null;
  const slug = String(preferred?.slug || fallback?.slug || '').trim();
  if (!slug) {
    return `/blog?lang=${normalizeBlogLanguage(language)}`;
  }
  return `/blog/${encodeURIComponent(slug)}?lang=${normalizeBlogLanguage(language)}`;
}

function buildServiceMeta(type, language) {
  const copy = {
    en: {
      trips: { label: 'Trip', cta: 'Check trip' },
      hotels: { label: 'Stay', cta: 'Check stay' },
      cars: { label: 'Car rental', cta: 'Check cars' },
      transport: { label: 'Transport', cta: 'Check route' },
      shop: { label: 'Product', cta: 'Check product' },
      pois: { label: 'Place', cta: 'Explore place' },
      recommendations: { label: 'Recommendation', cta: 'View recommendation' },
      blog: { label: 'Article', cta: 'Read article' },
    },
    pl: {
      trips: { label: 'Wycieczka', cta: 'Sprawdź wycieczkę' },
      hotels: { label: 'Nocleg', cta: 'Sprawdź nocleg' },
      cars: { label: 'Auto', cta: 'Sprawdź auta' },
      transport: { label: 'Transport', cta: 'Sprawdź trasę' },
      shop: { label: 'Produkt', cta: 'Zobacz produkt' },
      pois: { label: 'Miejsce', cta: 'Poznaj miejsce' },
      recommendations: { label: 'Polecane', cta: 'Zobacz polecenie' },
      blog: { label: 'Artykuł', cta: 'Czytaj artykuł' },
    },
  };
  return copy[normalizeBlogLanguage(language)][type] || copy[normalizeBlogLanguage(language)].recommendations;
}

function mapTripCta(row, language) {
  const meta = buildServiceMeta('trips', language);
  const title = pickLocalizedObjectField(row?.title, language) || String(row?.slug || 'Trip').trim();
  const description = truncateText(
    pickLocalizedObjectField(row?.description, language)
    || String(row?.start_city || '').trim()
  );
  const slug = String(row?.slug || '').trim();
  return {
    id: row?.id || null,
    type: 'trips',
    title,
    description,
    imageUrl: pickMedia(row),
    href: slug ? `/trip.html?slug=${encodeURIComponent(slug)}&lang=${language}` : `/trips.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.start_city || '').trim(),
    language,
    resolved: true,
  };
}

function mapHotelCta(row, language) {
  const meta = buildServiceMeta('hotels', language);
  const title = pickLocalizedObjectField(row?.title, language) || String(row?.slug || 'Hotel').trim();
  const description = truncateText(
    pickLocalizedObjectField(row?.description, language)
    || String(row?.city || '').trim()
  );
  const slug = String(row?.slug || '').trim();
  return {
    id: row?.id || null,
    type: 'hotels',
    title,
    description,
    imageUrl: pickMedia(row),
    href: slug ? `/hotel.html?slug=${encodeURIComponent(slug)}&lang=${language}` : `/hotels.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.city || '').trim(),
    language,
    resolved: true,
  };
}

function mapCarCta(row, language) {
  const meta = buildServiceMeta('cars', language);
  const title = pickLocalizedObjectField(row?.car_model, language) || pickLocalizedObjectField(row?.car_type, language) || 'Car rental';
  const price = Number(row?.price_per_day || row?.price_10plus_days || row?.price_7_10days || row?.price_4_6days || 0);
  return {
    id: row?.id || null,
    type: 'cars',
    title,
    description: truncateText(pickLocalizedObjectField(row?.description, language) || ''),
    imageUrl: pickMedia(row),
    href: buildCarHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: price > 0 ? `${price.toFixed(2)} €` : String(row?.location || '').trim(),
    resourceId: row?.id || null,
    offerLocation: String(row?.location || '').trim().toLowerCase(),
    language,
    resolved: true,
  };
}

function mapPoiCta(row, language) {
  const meta = buildServiceMeta('pois', language);
  const title = String(
    language === 'pl'
      ? row?.name_pl || row?.name_en || row?.slug || 'Place'
      : row?.name_en || row?.name_pl || row?.slug || 'Place'
  ).trim();
  const description = truncateText(
    language === 'pl'
      ? row?.description_pl || row?.description_en || ''
      : row?.description_en || row?.description_pl || ''
  );
  return {
    id: row?.id || null,
    type: 'pois',
    title,
    description,
    imageUrl: pickMedia(row),
    href: row?.id ? `/community.html?poi=${encodeURIComponent(String(row.id))}&lang=${language}` : `/community.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.city || row?.location_name || '').trim(),
    language,
    resolved: true,
  };
}

function mapRecommendationCta(row, language) {
  const meta = buildServiceMeta('recommendations', language);
  const title = String(
    language === 'pl'
      ? row?.title_pl || row?.title_en || 'Recommendation'
      : row?.title_en || row?.title_pl || 'Recommendation'
  ).trim();
  const description = truncateText(
    language === 'pl'
      ? row?.description_pl || row?.description_en || ''
      : row?.description_en || row?.description_pl || ''
  );
  return {
    id: row?.id || null,
    type: 'recommendations',
    title,
    description,
    imageUrl: pickMedia(row),
    href: buildRecommendationHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.location_name || '').trim(),
    language,
    resolved: true,
  };
}

function formatMoney(value, currency = 'EUR') {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `${amount.toFixed(2)} ${String(currency || 'EUR').trim().toUpperCase() || 'EUR'}`;
}

function mapTransportCta(row, language) {
  const meta = buildServiceMeta('transport', language);
  const origin = row?.origin_location || null;
  const destination = row?.destination_location || null;
  const originLabel = String(origin?.name || origin?.name_local || origin?.code || 'Origin').trim();
  const destinationLabel = String(destination?.name || destination?.name_local || destination?.code || 'Destination').trim();
  const prices = [Number(row?.day_price || 0), Number(row?.night_price || 0)].filter((value) => Number.isFinite(value) && value > 0);
  const fromPrice = prices.length ? Math.min(...prices) : 0;
  const currency = String(row?.currency || 'EUR').trim().toUpperCase() || 'EUR';
  const capacityBits = [
    Number(row?.included_passengers || 0) > 0 ? `${row.included_passengers} pax` : '',
    Number(row?.included_bags || 0) > 0 ? `${row.included_bags} bags` : '',
  ].filter(Boolean);
  const title = `${originLabel} → ${destinationLabel}`;
  return {
    id: row?.id || null,
    type: 'transport',
    title,
    description: truncateText(capacityBits.join(' · ') || `${originLabel} → ${destinationLabel}`),
    imageUrl: pickMedia({}),
    href: buildTransportHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: fromPrice > 0 ? `from ${formatMoney(fromPrice, currency)}` : '',
    resourceId: row?.id || null,
    language,
    resolved: true,
  };
}

function mapShopCta(row, language) {
  const meta = buildServiceMeta('shop', language);
  const title = String(
    language === 'pl'
      ? row?.name || row?.name_en || row?.slug || 'Product'
      : row?.name_en || row?.name || row?.slug || 'Product'
  ).trim();
  const description = truncateText(
    language === 'pl'
      ? row?.short_description || row?.description || row?.short_description_en || row?.description_en || ''
      : row?.short_description_en || row?.description_en || row?.short_description || row?.description || ''
  );
  const category = row?.category || {};
  const categoryLabel = String(
    language === 'pl'
      ? category?.name || category?.name_en || ''
      : category?.name_en || category?.name || ''
  ).trim();
  const price = Number(row?.price || row?.sale_price || 0);
  return {
    id: row?.id || null,
    type: 'shop',
    title,
    description,
    imageUrl: pickMedia(row),
    href: buildShopHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: [categoryLabel, price > 0 ? formatMoney(price, 'EUR') : ''].filter(Boolean).join(' · '),
    resourceId: row?.id || null,
    language,
    resolved: true,
  };
}

function mapBlogCta(row, language) {
  const meta = buildServiceMeta('blog', language);
  const translations = safeArray(row?.translations);
  const preferred = translations.find((entry) => normalizeBlogLanguage(entry?.lang) === normalizeBlogLanguage(language)) || null;
  const fallback = translations.find((entry) => normalizeBlogLanguage(entry?.lang) === 'en')
    || translations.find((entry) => normalizeBlogLanguage(entry?.lang) === 'pl')
    || translations[0]
    || null;
  const title = String(preferred?.title || fallback?.title || 'Blog post').trim();
  const description = truncateText(preferred?.summary || preferred?.lead || fallback?.summary || fallback?.lead || '');
  const publishedAt = row?.published_at ? new Date(row.published_at) : null;
  const metaLabel = publishedAt && !Number.isNaN(publishedAt.getTime())
    ? new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(publishedAt)
    : '';
  return {
    id: row?.id || null,
    type: 'blog',
    title,
    description,
    imageUrl: pickMedia(row),
    href: buildBlogHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: metaLabel,
    resourceId: row?.id || null,
    language,
    resolved: true,
  };
}

async function fetchRowsByIds(client, table, ids, select, filters = []) {
  if (!client || !ids.length) return [];
  let query = client
    .from(table)
    .select(select);

  for (const applyFilter of safeArray(filters)) {
    if (typeof applyFilter !== 'function') continue;
    query = applyFilter(query) || query;
  }

  const { data, error } = await query.in('id', ids);

  if (error) {
    console.warn(`[blog-data] Failed to load CTA rows from ${table}:`, error);
    return [];
  }

  return safeArray(data);
}

async function fetchTransportRowsByIds(client, ids) {
  if (!client || !ids.length) return [];
  const { data: routes, error: routeError } = await client
    .from('transport_routes')
    .select('id, origin_location_id, destination_location_id, day_price, night_price, currency, included_passengers, included_bags')
    .eq('is_active', true)
    .in('id', ids);

  if (routeError) {
    console.warn('[blog-data] Failed to load CTA rows from transport_routes:', routeError);
    return [];
  }

  const locationIds = Array.from(new Set(
    safeArray(routes).flatMap((row) => [String(row?.origin_location_id || '').trim(), String(row?.destination_location_id || '').trim()]).filter(Boolean)
  ));
  let locationById = new Map();
  if (locationIds.length) {
    const { data: locations, error: locationError } = await client
      .from('transport_locations')
      .select('id, name, name_local, code')
      .eq('is_active', true)
      .in('id', locationIds);

    if (locationError) {
      console.warn('[blog-data] Failed to load CTA rows from transport_locations:', locationError);
    } else {
      locationById = new Map(safeArray(locations).map((row) => [String(row?.id || '').trim(), row]));
    }
  }

  return safeArray(routes).map((row) => ({
    ...row,
    origin_location: locationById.get(String(row?.origin_location_id || '').trim()) || null,
    destination_location: locationById.get(String(row?.destination_location_id || '').trim()) || null,
  }));
}

async function fetchBlogPostsByIds(client, ids) {
  if (!client || !ids.length) return [];
  const { data, error } = await client
    .from('blog_posts')
    .select(`
      id,
      published_at,
      cover_image_url,
      translations:blog_post_translations (
        lang,
        slug,
        title,
        summary,
        lead
      )
    `)
    .eq('status', 'published')
    .eq('submission_status', 'approved')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .in('id', ids);

  if (error) {
    console.warn('[blog-data] Failed to load CTA rows from blog_posts:', error);
    return [];
  }

  return safeArray(data);
}

function mapTranslation(translation) {
  if (!translation || typeof translation !== 'object') {
    return null;
  }

  return {
    id: translation.id || null,
    blogPostId: translation.blog_post_id || translation.blogPostId || null,
    lang: normalizeBlogLanguage(translation.lang),
    slug: translation.slug || '',
    title: translation.title || '',
    metaTitle: translation.meta_title || '',
    metaDescription: translation.meta_description || '',
    summary: translation.summary || '',
    lead: translation.lead || '',
    authorName: translation.author_name || '',
    authorUrl: translation.author_url || '',
    contentJson: translation.content_json || null,
    contentHtml: translation.content_html || '',
    ogImageUrl: translation.og_image_url || '',
    createdAt: translation.created_at || null,
    updatedAt: translation.updated_at || null,
  };
}

function buildTranslationsByLang(translations) {
  return (Array.isArray(translations) ? translations : [])
    .map(mapTranslation)
    .filter(Boolean)
    .reduce((accumulator, translation) => {
      accumulator[translation.lang] = translation;
      return accumulator;
    }, {});
}

function pickTranslation(translationsByLang, language) {
  return (
    translationsByLang[normalizeBlogLanguage(language)]
    || translationsByLang.en
    || translationsByLang.pl
    || Object.values(translationsByLang)[0]
    || null
  );
}

function resolveAuthor(translation, authorProfile) {
  const displayName = (
    translation?.authorName
    || authorProfile?.name
    || authorProfile?.username
    || ''
  ).trim();

  if (!displayName) {
    return null;
  }

  const url = String(translation?.authorUrl || '').trim();
  return {
    name: displayName,
    url,
    profileId: authorProfile?.id || null,
    avatarUrl: authorProfile?.avatarUrl || '',
  };
}

function mapBlogBase(row, translationsByLang, language) {
  const translation = pickTranslation(translationsByLang, language);
  const authorProfile = mapAuthorProfile(row.author_profile);
  const categoriesByLang = getTaxonomyByLang(row, 'categories');
  const tagsByLang = getTaxonomyByLang(row, 'tags');

  return {
    id: row.id,
    status: row.status || 'draft',
    submissionStatus: row.submission_status || 'draft',
    publishedAt: row.published_at || null,
    coverImageUrl: row.cover_image_url || '',
    coverImageAlt: pickLocalizedText(row.cover_image_alt, language),
    featured: Boolean(row.featured),
    allowComments: Boolean(row.allow_comments),
    categories: categoriesByLang[language] || categoriesByLang.en || categoriesByLang.pl || [],
    categoriesByLang,
    tags: tagsByLang[language] || tagsByLang.en || tagsByLang.pl || [],
    tagsByLang,
    ctaServices: normalizeCtaServices(row.cta_services),
    authorProfileId: row.author_profile_id || null,
    ownerPartnerId: row.owner_partner_id || null,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    rejectionReason: row.rejection_reason || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    authorProfile,
    translation,
    translationsByLang,
    author: resolveAuthor(translation, authorProfile),
  };
}

export async function getPublishedBlogList(env, options = {}) {
  const result = await getPublishedBlogListPage(env, options);
  return result.items;
}

export async function getPublishedBlogListPage(env, options = {}) {
  const language = normalizeBlogLanguage(options.language);
  const page = Math.max(1, Number.parseInt(options.page || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(options.limit || BLOG_LIST_PAGE_SIZE, 10) || BLOG_LIST_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const client = getReadClient(env);

  const { data, error, count } = await executeBlogQueryWithTaxonomyFallback(
    () => applyPublishedBlogFilters(
      client.from('blog_posts').select(BLOG_LIST_SELECT, { count: 'exact' }),
      { ...options, language }
    )
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1),
    () => applyPublishedBlogFilters(
      client.from('blog_posts').select(BLOG_LIST_SELECT_LEGACY, { count: 'exact' }),
      { ...options, language, useLegacyTaxonomy: true }
    )
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)
  );

  if (error) {
    throw new Error(error.message || 'Failed to load blog list');
  }

  const items = (Array.isArray(data) ? data : []).map((row) => {
    const translationsByLang = buildTranslationsByLang(row.translations);
    return mapBlogBase(row, translationsByLang, language);
  });

  return {
    items,
    page,
    pageSize: limit,
    totalCount: Number.isFinite(count) ? count : items.length,
    filter: {
      featured: String(options.featured || '').trim() === '1' || options.featured === true,
      category: String(options.category || '').trim(),
      tag: String(options.tag || '').trim(),
    },
  };
}

export async function getPublishedBlogPostBySlug(env, options = {}) {
  const language = normalizeBlogLanguage(options.language);
  const slug = normalizeBlogSlug(options.slug);

  if (!slug) {
    return null;
  }

  const client = getReadClient(env);
  let data = null;
  let { data: localizedMatch, error } = await executeBlogQueryWithTaxonomyFallback(
    () => client
      .from('blog_post_translations')
      .select(BLOG_POST_SELECT)
      .eq('lang', language)
      .eq('slug', slug)
      .maybeSingle(),
    () => client
      .from('blog_post_translations')
      .select(BLOG_POST_SELECT_LEGACY)
      .eq('lang', language)
      .eq('slug', slug)
      .maybeSingle()
  );

  if (error) {
    throw new Error(error.message || 'Failed to load blog post');
  }

  data = localizedMatch || null;

  if (!data?.blog_post) {
    const fallbackResult = await executeBlogQueryWithTaxonomyFallback(
      () => client
        .from('blog_post_translations')
        .select(BLOG_POST_SELECT)
        .eq('slug', slug)
        .limit(2),
      () => client
        .from('blog_post_translations')
        .select(BLOG_POST_SELECT_LEGACY)
        .eq('slug', slug)
        .limit(2)
    );

    if (fallbackResult.error) {
      throw new Error(fallbackResult.error.message || 'Failed to load blog post');
    }

    data = safeArray(fallbackResult.data).find((row) => row?.blog_post && isPublishedRow(row.blog_post)) || null;
  }

  if (!data?.blog_post) {
    return null;
  }

  if (!isPublishedRow(data.blog_post)) {
    return null;
  }

  const { data: siblingTranslations, error: siblingError } = await client
    .from('blog_post_translations')
    .select(`
      id,
      blog_post_id,
      lang,
      slug,
      title,
      meta_title,
      meta_description,
      summary,
      lead,
      author_name,
      author_url,
      content_html,
      og_image_url,
      created_at,
      updated_at
    `)
    .eq('blog_post_id', data.blog_post.id);

  if (siblingError) {
    throw new Error(siblingError.message || 'Failed to load blog post translations');
  }

  const translationsByLang = buildTranslationsByLang(siblingTranslations);
  const blogPost = mapBlogBase(data.blog_post, translationsByLang, language);
  const translation = blogPost.translation || mapTranslation(data);
  const resolvedCtaServices = await resolveBlogCtaServices(env, blogPost.ctaServices, language);
  const relatedPosts = await getRelatedBlogPosts(env, {
    language,
    postId: blogPost.id,
    categories: blogPost.categories,
    tags: blogPost.tags,
    limit: 3,
  });

  return {
    ...blogPost,
    translation: translation
      ? {
        ...translation,
        lang: translation.lang || language,
      }
      : null,
    author: resolveAuthor(translation, blogPost.authorProfile),
    resolvedCtaServices,
    relatedPosts,
  };
}

export async function getRelatedBlogPosts(env, options = {}) {
  const language = normalizeBlogLanguage(options.language);
  const postId = String(options.postId || '').trim();
  const limit = Math.min(6, Math.max(1, Number.parseInt(options.limit || '3', 10) || 3));
  const categories = new Set(safeArray(options.categories).map((entry) => String(entry || '').trim()).filter(Boolean));
  const tags = new Set(safeArray(options.tags).map((entry) => String(entry || '').trim()).filter(Boolean));
  const client = getReadClient(env);

  const { data, error } = await executeBlogQueryWithTaxonomyFallback(
    () => applyPublishedBlogFilters(
      client.from('blog_posts').select(BLOG_LIST_SELECT),
      { language }
    )
      .neq('id', postId)
      .order('published_at', { ascending: false })
      .limit(Math.max(18, limit * 8)),
    () => applyPublishedBlogFilters(
      client.from('blog_posts').select(BLOG_LIST_SELECT_LEGACY),
      { language, useLegacyTaxonomy: true }
    )
      .neq('id', postId)
      .order('published_at', { ascending: false })
      .limit(Math.max(18, limit * 8))
  );

  if (error) {
    throw new Error(error.message || 'Failed to load related blog posts');
  }

  const items = safeArray(data).map((row) => {
    const translationsByLang = buildTranslationsByLang(row.translations);
    return mapBlogBase(row, translationsByLang, language);
  });

  const scored = items.map((item, index) => {
    const sharedCategories = item.categories.filter((entry) => categories.has(entry)).length;
    const sharedTags = item.tags.filter((entry) => tags.has(entry)).length;
    const score = sharedCategories * 4 + sharedTags * 5 + (item.featured ? 1 : 0);
    return { item, index, score };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    const leftDate = new Date(left.item.publishedAt || 0).getTime();
    const rightDate = new Date(right.item.publishedAt || 0).getTime();
    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }
    return left.index - right.index;
  });

  const preferred = scored.filter((entry) => entry.score > 0).slice(0, limit);
  const fallback = scored.filter((entry) => entry.score === 0).slice(0, Math.max(0, limit - preferred.length));
  return [...preferred, ...fallback].slice(0, limit).map((entry) => entry.item);
}

export async function resolveBlogCtaServices(env, ctaServices = [], language = BLOG_DEFAULT_LANGUAGE) {
  const client = getReadClient(env);
  const localized = normalizeBlogLanguage(language);
  const normalized = normalizeCtaServices(ctaServices);
  if (!normalized.length) {
    return [];
  }

  const idsByType = normalized.reduce((accumulator, entry) => {
    if (!accumulator[entry.type]) {
      accumulator[entry.type] = [];
    }
    accumulator[entry.type].push(entry.resource_id);
    return accumulator;
  }, {});

  const [trips, hotels, cars, transport, shop, pois, recommendations, blog] = await Promise.all([
    fetchRowsByIds(
      client,
      'trips',
      idsByType.trips || [],
      'id, slug, title, description, cover_image_url, price_base, price_per_person, pricing_model, start_city',
      [(query) => query.eq('is_published', true)]
    ),
    fetchRowsByIds(
      client,
      'hotels',
      idsByType.hotels || [],
      'id, slug, title, description, city, cover_image_url, photos',
      [(query) => query.eq('is_published', true)]
    ),
    fetchRowsByIds(
      client,
      'car_offers',
      idsByType.cars || [],
      'id, car_model, car_type, description, location, image_url, price_per_day, price_10plus_days, price_7_10days, price_4_6days',
      [
        (query) => query.eq('is_published', true),
        (query) => query.eq('is_available', true),
      ]
    ),
    fetchTransportRowsByIds(client, idsByType.transport || []),
    fetchRowsByIds(
      client,
      'shop_products',
      idsByType.shop || [],
      'id, name, name_en, slug, short_description, short_description_en, description, description_en, thumbnail_url, images, price, sale_price, category_id, category:shop_categories(name, name_en, slug)',
      [(query) => query.eq('status', 'active')]
    ),
    fetchRowsByIds(client, 'pois', idsByType.pois || [], 'id, slug, name_pl, name_en, description_pl, description_en, main_image_url, photos, city, location_name'),
    fetchRowsByIds(
      client,
      'recommendations',
      idsByType.recommendations || [],
      'id, title_pl, title_en, description_pl, description_en, image_url, images, location_name',
      [(query) => query.eq('active', true)]
    ),
    fetchBlogPostsByIds(client, idsByType.blog || []),
  ]);

  const lookups = {
    trips: new Map(trips.map((row) => [String(row.id), row])),
    hotels: new Map(hotels.map((row) => [String(row.id), row])),
    cars: new Map(cars.map((row) => [String(row.id), row])),
    transport: new Map(transport.map((row) => [String(row.id), row])),
    shop: new Map(shop.map((row) => [String(row.id), row])),
    pois: new Map(pois.map((row) => [String(row.id), row])),
    recommendations: new Map(recommendations.map((row) => [String(row.id), row])),
    blog: new Map(blog.map((row) => [String(row.id), row])),
  };

  return normalized
    .map((entry) => {
      const row = lookups[entry.type]?.get(entry.resource_id);
      if (!row) return null;
      switch (entry.type) {
        case 'trips':
          return mapTripCta(row, localized);
        case 'hotels':
          return mapHotelCta(row, localized);
        case 'cars':
          return mapCarCta(row, localized);
        case 'transport':
          return mapTransportCta(row, localized);
        case 'shop':
          return mapShopCta(row, localized);
        case 'pois':
          return mapPoiCta(row, localized);
        case 'recommendations':
          return mapRecommendationCta(row, localized);
        case 'blog':
          return mapBlogCta(row, localized);
        default:
          return null;
      }
    })
    .filter(Boolean);
}
