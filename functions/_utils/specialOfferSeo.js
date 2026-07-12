const SITE_ORIGIN = 'https://cypruseye.com';
const DEFAULT_IMAGE_PATH = '/assets/cyprus_logo-1000x1054.png';
const DEFAULT_IMAGE_URL = `${SITE_ORIGIN}${DEFAULT_IMAGE_PATH}`;
const SUPPORTED_LANGUAGES = ['pl', 'en', 'he'];
const LOCALE_BY_LANGUAGE = {
  pl: 'pl_PL',
  en: 'en_US',
  he: 'he_IL',
};

const GENERIC_COPY = {
  pl: {
    title: 'Special Offer - CyprusEye',
    description: 'Aktualna kampania Special Offer w CyprusEye.',
    imageAlt: 'CyprusEye',
  },
  en: {
    title: 'Special Offer - CyprusEye',
    description: 'Current CyprusEye Special Offer campaign.',
    imageAlt: 'CyprusEye',
  },
  he: {
    title: 'Special Offer - CyprusEye',
    description: 'מבצע עדכני של CyprusEye.',
    imageAlt: 'CyprusEye',
  },
};

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : 'pl';
}

function sanitizeText(value, fallback = '') {
  return String(value || fallback || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDescription(value, fallback = '') {
  const text = sanitizeText(value, fallback);
  return text.length > 300 ? `${text.slice(0, 297).trim()}...` : text;
}

function normalizePublicImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) {
    return '';
  }
  try {
    const url = raw.startsWith('/') && !raw.startsWith('//')
      ? new URL(raw, SITE_ORIGIN)
      : new URL(raw);
    if (url.protocol !== 'https:') {
      return '';
    }
    return url.toString();
  } catch (_) {
    return '';
  }
}

function buildCleanUrl(slug, lang) {
  const safeSlug = String(slug || '').trim();
  const safeLang = normalizeLanguage(lang);
  const url = new URL(`/special-offers/${encodeURIComponent(safeSlug)}`, SITE_ORIGIN);
  url.searchParams.set('lang', safeLang);
  return url.toString();
}

function buildLanguageUrls(slug) {
  return {
    pl: buildCleanUrl(slug, 'pl'),
    en: buildCleanUrl(slug, 'en'),
    he: buildCleanUrl(slug, 'he'),
    xDefault: `${SITE_ORIGIN}/special-offers/${encodeURIComponent(String(slug || '').trim())}`,
  };
}

function getAlternateLocale(lang) {
  return SUPPORTED_LANGUAGES
    .filter((candidate) => candidate !== lang)
    .map((candidate) => LOCALE_BY_LANGUAGE[candidate])
    .find(Boolean) || 'en_US';
}

function normalizeSeoRow(row, fallbackSlug, fallbackLang) {
  const source = row && typeof row === 'object' ? row : null;
  const resolvedLang = normalizeLanguage(source?.resolved_lang || source?.resolvedLang || fallbackLang);
  const slug = sanitizeText(source?.campaign_slug || source?.campaignSlug || fallbackSlug, fallbackSlug);
  const generic = GENERIC_COPY[resolvedLang] || GENERIC_COPY.pl;
  const title = sanitizeText(source?.meta_title, generic.title) || generic.title;
  const description = normalizeDescription(source?.meta_description, generic.description) || generic.description;
  const imageUrl = normalizePublicImageUrl(source?.meta_image_url) || DEFAULT_IMAGE_URL;
  const imageAlt = sanitizeText(source?.meta_image_alt, title) || title || generic.imageAlt;
  return {
    available: Boolean(source?.campaign_slug || source?.campaignSlug),
    slug,
    requestedLang: normalizeLanguage(source?.requested_lang || source?.requestedLang || fallbackLang),
    resolvedLang,
    title,
    description,
    imageUrl,
    imageAlt,
  };
}

export function buildGenericSpecialOfferSeo(slug, lang) {
  const resolvedLang = normalizeLanguage(lang);
  const generic = GENERIC_COPY[resolvedLang] || GENERIC_COPY.pl;
  return {
    available: false,
    slug: sanitizeText(slug, 'special-offer') || 'special-offer',
    requestedLang: resolvedLang,
    resolvedLang,
    title: generic.title,
    description: generic.description,
    imageUrl: DEFAULT_IMAGE_URL,
    imageAlt: generic.imageAlt,
  };
}

export async function getPublicSpecialOfferSeo(env, { slug, lang } = {}) {
  const supabaseUrl = String(env?.SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = String(env?.SUPABASE_ANON_KEY || '');
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_special_offer_seo`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      p_slug: String(slug || ''),
      p_lang: normalizeLanguage(lang),
    }),
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json().catch(() => null);
  if (Array.isArray(payload)) {
    return payload[0] || null;
  }
  return payload && typeof payload === 'object' ? payload : null;
}

function stripManagedSeoTags(html) {
  return String(html || '')
    .replace(/\s*<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/\s*<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/\s*<link\s+rel=["']alternate["'][^>]*hreflang=["'](?:pl|en|he|x-default)["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+property=["']og:(?:type|site_name|title|description|url|image|image:alt|locale|locale:alternate)["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+name=["']twitter:(?:card|title|description|image|image:alt)["'][^>]*>/gi, '');
}

function buildManagedSeoBlock(seo) {
  const lang = normalizeLanguage(seo.resolvedLang);
  const urls = buildLanguageUrls(seo.slug);
  const canonicalUrl = buildCleanUrl(seo.slug, lang);
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const imageUrl = escapeHtml(normalizePublicImageUrl(seo.imageUrl) || DEFAULT_IMAGE_URL);
  const imageAlt = escapeHtml(seo.imageAlt || seo.title || 'CyprusEye');
  const locale = escapeHtml(LOCALE_BY_LANGUAGE[lang] || 'pl_PL');
  const alternateLocale = escapeHtml(getAlternateLocale(lang));
  const robots = seo.available ? '' : '  <meta name="robots" content="noindex, nofollow" />\n';

  return [
    `  <title>${title}</title>`,
    `  <meta name="description" content="${description}" />`,
    robots.trimEnd(),
    `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `  <link rel="alternate" hreflang="pl" href="${escapeHtml(urls.pl)}" />`,
    `  <link rel="alternate" hreflang="en" href="${escapeHtml(urls.en)}" />`,
    `  <link rel="alternate" hreflang="he" href="${escapeHtml(urls.he)}" />`,
    `  <link rel="alternate" hreflang="x-default" href="${escapeHtml(urls.xDefault)}" />`,
    '  <meta property="og:type" content="website" />',
    '  <meta property="og:site_name" content="CyprusEye" />',
    `  <meta property="og:title" content="${title}" />`,
    `  <meta property="og:description" content="${description}" />`,
    `  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `  <meta property="og:image" content="${imageUrl}" />`,
    `  <meta property="og:image:alt" content="${imageAlt}" />`,
    `  <meta property="og:locale" content="${locale}" />`,
    `  <meta property="og:locale:alternate" content="${alternateLocale}" />`,
    '  <meta name="twitter:card" content="summary_large_image" />',
    `  <meta name="twitter:title" content="${title}" />`,
    `  <meta name="twitter:description" content="${description}" />`,
    `  <meta name="twitter:image" content="${imageUrl}" />`,
    `  <meta name="twitter:image:alt" content="${imageAlt}" />`,
  ].filter(Boolean).join('\n');
}

function applyHtmlAttributes(html, lang) {
  const safeLang = normalizeLanguage(lang);
  const dir = safeLang === 'he' ? 'rtl' : 'ltr';
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, `<html lang="${safeLang}" dir="${dir}">`);
  }
  return html;
}

export function applySpecialOfferSeoToHtml(html, { slug, requestedLang, seoRow } = {}) {
  const fallback = buildGenericSpecialOfferSeo(slug, requestedLang);
  const seo = seoRow ? normalizeSeoRow(seoRow, slug, requestedLang) : fallback;
  const stripped = applyHtmlAttributes(stripManagedSeoTags(html), seo.resolvedLang);
  const block = buildManagedSeoBlock(seo);
  if (/<\/head>/i.test(stripped)) {
    return stripped.replace(/<\/head>/i, `${block}\n</head>`);
  }
  return `${stripped}\n${block}`;
}

export const SPECIAL_OFFER_DEFAULT_SEO_IMAGE = DEFAULT_IMAGE_URL;
