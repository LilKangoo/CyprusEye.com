const CANONICAL_ORIGIN = 'https://www.cypruseye.com';
const DEFAULT_OG_IMAGE = 'assets/cyprus_logo-1000x1054.png';
const RECOMMENDATIONS_CANONICAL_PATH = '/recommendations.html';
const RECOMMENDATIONS_PATHNAMES = new Set([
  '/recommendations',
  '/recommendations/',
  '/recommendations.html',
]);

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

function getTranslationString(entry) {
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
  return '';
}

export function getTranslationValue(translations, key) {
  if (!translations || typeof translations !== 'object') {
    return '';
  }

  const direct = getTranslationString(translations[key]);
  if (direct) {
    return direct;
  }

  const segments = String(key || '').split('.').filter(Boolean);
  if (!segments.length) {
    return '';
  }

  let cursor = translations;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
      return '';
    }
    cursor = cursor[segment];
  }

  return getTranslationString(cursor);
}

export function isRecommendationsSeoRequest(pathname) {
  return RECOMMENDATIONS_PATHNAMES.has(String(pathname || ''));
}

export function getRecommendationsSeoLanguage(urlLike) {
  let searchParams = null;
  if (urlLike instanceof URL) {
    searchParams = urlLike.searchParams;
  } else {
    try {
      searchParams = new URL(String(urlLike || ''), CANONICAL_ORIGIN).searchParams;
    } catch (_) {
      searchParams = null;
    }
  }

  const requested = String(searchParams?.get('lang') || '').trim().toLowerCase();
  return requested === 'en' ? 'en' : 'pl';
}

function buildAbsoluteUrl(pathname, search = '') {
  const url = new URL(pathname, CANONICAL_ORIGIN);
  const params = new URLSearchParams(search || '');
  params.forEach((value, key) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function replaceOrInject(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  const closingHead = '</head>';
  if (!html.includes(closingHead)) {
    return html;
  }
  return html.replace(closingHead, `${replacement}\n${closingHead}`);
}

export function buildRecommendationsSeoPayload({
  language,
  requestPathname = RECOMMENDATIONS_CANONICAL_PATH,
  requestSearch = '',
  translations = {},
} = {}) {
  const resolvedLanguage = language === 'en' ? 'en' : 'pl';
  const fallbackTitle =
    resolvedLanguage === 'en'
      ? 'Recommendations – CyprusEye Quest'
      : 'Rekomendacje – CyprusEye Quest';
  const fallbackDescription =
    resolvedLanguage === 'en'
      ? 'Discover curated recommendations – the best places, restaurants, hotels and attractions in Cyprus with exclusive discounts.'
      : 'Odkryj nasze sprawdzone rekomendacje – najlepsze miejsca, restauracje, hotele i atrakcje na Cyprze z ekskluzywnymi zniżkami.';
  const fallbackLocale = resolvedLanguage === 'en' ? 'en_GB' : 'pl_PL';
  const alternateLocale = resolvedLanguage === 'en' ? 'pl_PL' : 'en_GB';
  const pagePath = String(requestPathname || RECOMMENDATIONS_CANONICAL_PATH).trim() || RECOMMENDATIONS_CANONICAL_PATH;

  const title = getTranslationValue(translations, 'seo.recommendations.title') || fallbackTitle;
  const description =
    getTranslationValue(translations, 'seo.recommendations.description') || fallbackDescription;
  const ogTitle = getTranslationValue(translations, 'seo.recommendations.ogTitle') || title;
  const ogDescription =
    getTranslationValue(translations, 'seo.recommendations.ogDescription') || description;
  const ogLocale = getTranslationValue(translations, 'seo.locale') || fallbackLocale;
  const ogImageValue = getTranslationValue(translations, 'seo.ogImage') || DEFAULT_OG_IMAGE;
  const ogImage = buildAbsoluteUrl(ogImageValue);

  return {
    language: resolvedLanguage,
    title,
    description,
    ogTitle,
    ogDescription,
    ogType: 'website',
    ogUrl: buildAbsoluteUrl(pagePath, requestSearch),
    ogImage,
    ogLocale,
    ogLocaleAlternate: alternateLocale,
    canonicalUrl: buildAbsoluteUrl(RECOMMENDATIONS_CANONICAL_PATH),
    languageUrls: {
      pl: buildAbsoluteUrl(RECOMMENDATIONS_CANONICAL_PATH, 'lang=pl'),
      en: buildAbsoluteUrl(RECOMMENDATIONS_CANONICAL_PATH, 'lang=en'),
      xDefault: buildAbsoluteUrl(RECOMMENDATIONS_CANONICAL_PATH),
    },
  };
}

export function applyRecommendationsSeoToHtml(html, payload) {
  if (typeof html !== 'string' || !payload) {
    return html;
  }

  let nextHtml = html;
  const safeTitle = escapeHtml(payload.title);
  const safeDescription = escapeHtml(payload.description);
  const safeOgTitle = escapeHtml(payload.ogTitle);
  const safeOgDescription = escapeHtml(payload.ogDescription);
  const safeOgUrl = escapeHtml(payload.ogUrl);
  const safeOgImage = escapeHtml(payload.ogImage);
  const safeOgLocale = escapeHtml(payload.ogLocale);
  const safeOgLocaleAlternate = escapeHtml(payload.ogLocaleAlternate);
  const safeCanonical = escapeHtml(payload.canonicalUrl);
  const safePlUrl = escapeHtml(payload.languageUrls?.pl || '');
  const safeEnUrl = escapeHtml(payload.languageUrls?.en || '');
  const safeDefaultUrl = escapeHtml(payload.languageUrls?.xDefault || '');

  nextHtml = nextHtml.replace(
    /<html([^>]*)lang=["'][^"']*["']([^>]*)>/i,
    `<html$1lang="${payload.language}"$2>`
  );

  nextHtml = replaceOrInject(nextHtml, /<title\b[^>]*>[\s\S]*?<\/title>/i, `  <title>${safeTitle}</title>`);
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+name=["']description["'][^>]*>/i,
    `  <meta name="description" content="${safeDescription}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `  <meta property="og:type" content="${escapeHtml(payload.ogType || 'website')}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `  <meta property="og:title" content="${safeOgTitle}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `  <meta property="og:description" content="${safeOgDescription}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `  <meta property="og:url" content="${safeOgUrl}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+property=["']og:image["'][^>]*>/i,
    `  <meta property="og:image" content="${safeOgImage}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+property=["']og:locale["'][^>]*>/i,
    `  <meta property="og:locale" content="${safeOgLocale}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<meta\s+property=["']og:locale:alternate["'][^>]*>/i,
    `  <meta property="og:locale:alternate" content="${safeOgLocaleAlternate}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `  <link rel="canonical" href="${safeCanonical}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<link\s+rel=["']alternate["'][^>]*hreflang=["']pl["'][^>]*>/i,
    `  <link rel="alternate" hreflang="pl" href="${safePlUrl}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<link\s+rel=["']alternate["'][^>]*hreflang=["']en["'][^>]*>/i,
    `  <link rel="alternate" hreflang="en" href="${safeEnUrl}" />`
  );
  nextHtml = replaceOrInject(
    nextHtml,
    /<link\s+rel=["']alternate["'][^>]*hreflang=["']x-default["'][^>]*>/i,
    `  <link rel="alternate" hreflang="x-default" href="${safeDefaultUrl}" />`
  );

  return nextHtml;
}
