const CANONICAL_ORIGIN = 'https://www.cypruseye.com';
const DEFAULT_OG_IMAGE = 'assets/cyprus_logo-1000x1054.png';

const PAGE_ROUTES = [
  {
    seoPage: 'blog',
    htmlPath: '/blog.html',
    canonicalPath: '/blog',
    exactPaths: ['/blog', '/blog/', '/blog.html'],
  },
  {
    seoPage: 'home',
    htmlPath: '/index.html',
    canonicalPath: '/index.html',
    exactPaths: ['/', '/index.html'],
  },
  {
    seoPage: 'achievements',
    htmlPath: '/achievements.html',
    canonicalPath: '/achievements.html',
    exactPaths: ['/achievements', '/achievements/', '/achievements.html'],
  },
  {
    seoPage: 'advertise',
    htmlPath: '/advertise.html',
    canonicalPath: '/advertise.html',
    exactPaths: ['/advertise', '/advertise/', '/advertise.html'],
  },
  {
    seoPage: 'attractions',
    htmlPath: '/attractions.html',
    canonicalPath: '/attractions.html',
    exactPaths: ['/attractions', '/attractions/', '/attractions.html'],
  },
  {
    seoPage: 'auth',
    htmlPath: '/auth/index.html',
    canonicalPath: '/auth/',
    exactPaths: ['/auth', '/auth/', '/auth/index.html'],
  },
  {
    seoPage: 'account',
    htmlPath: '/account/index.html',
    canonicalPath: '/account/',
    exactPaths: ['/account', '/account/', '/account/index.html'],
  },
  {
    seoPage: 'carRentalLanding',
    htmlPath: '/car.html',
    canonicalPath: '/car.html',
    exactPaths: ['/car', '/car/', '/car.html'],
  },
  {
    seoPage: 'carRental',
    htmlPath: '/car-rental.html',
    canonicalPath: '/car-rental.html',
    exactPaths: ['/car-rental', '/car-rental/', '/car-rental.html'],
  },
  {
    seoPage: 'carRentalPfo',
    htmlPath: '/autopfo.html',
    canonicalPath: '/autopfo.html',
    exactPaths: ['/autopfo', '/autopfo/', '/autopfo.html'],
  },
  {
    seoPage: 'community',
    htmlPath: '/community.html',
    canonicalPath: '/community.html',
    exactPaths: ['/community', '/community/', '/community.html'],
  },
  {
    seoPage: 'coupon',
    htmlPath: '/kupon.html',
    canonicalPath: '/kupon.html',
    exactPaths: ['/coupon', '/coupon/', '/kupon', '/kupon/', '/kupon.html'],
  },
  {
    seoPage: 'cruise',
    htmlPath: '/cruise.html',
    canonicalPath: '/cruise.html',
    exactPaths: ['/cruise', '/cruise/', '/cruise.html'],
  },
  {
    seoPage: 'hotel',
    htmlPath: '/hotel.html',
    canonicalPath: '/hotel.html',
    exactPaths: ['/hotel', '/hotel/', '/hotel.html'],
    prefixPath: '/hotel/',
    excludedPrefixes: ['/hotel/booking'],
    preserveRequestPathForCanonical: true,
    preserveRequestPathForAlternates: true,
  },
  {
    seoPage: 'hotels',
    htmlPath: '/hotels.html',
    canonicalPath: '/hotels.html',
    exactPaths: ['/hotels', '/hotels/', '/hotels.html'],
  },
  {
    seoPage: 'notFound',
    htmlPath: '/404.html',
    canonicalPath: '/404.html',
    exactPaths: ['/404', '/404/', '/404.html'],
  },
  {
    seoPage: 'packing',
    htmlPath: '/packing.html',
    canonicalPath: '/packing.html',
    exactPaths: ['/packing', '/packing/', '/packing.html'],
  },
  {
    seoPage: 'plan',
    htmlPath: '/plan.html',
    canonicalPath: '/plan.html',
    exactPaths: ['/plan', '/plan/', '/plan.html'],
  },
  {
    seoPage: 'recommendations',
    htmlPath: '/recommendations.html',
    canonicalPath: '/recommendations.html',
    exactPaths: ['/recommendations', '/recommendations/', '/recommendations.html'],
  },
  {
    seoPage: 'reset',
    htmlPath: '/reset/index.html',
    canonicalPath: '/reset/',
    exactPaths: ['/reset', '/reset/', '/reset/index.html'],
  },
  {
    seoPage: 'shop',
    htmlPath: '/shop.html',
    canonicalPath: '/shop.html',
    exactPaths: ['/shop', '/shop/', '/shop.html'],
  },
  {
    seoPage: 'tasks',
    htmlPath: '/tasks.html',
    canonicalPath: '/tasks.html',
    exactPaths: ['/tasks', '/tasks/', '/tasks.html'],
  },
  {
    seoPage: 'terms',
    htmlPath: '/terms.html',
    canonicalPath: '/terms.html',
    exactPaths: ['/terms', '/terms/', '/terms.html'],
  },
  {
    seoPage: 'transport',
    htmlPath: '/transport.html',
    canonicalPath: '/transport.html',
    exactPaths: ['/transport', '/transport/', '/transport.html'],
  },
  {
    seoPage: 'trip',
    htmlPath: '/trip.html',
    canonicalPath: '/trip.html',
    exactPaths: ['/trip', '/trip/', '/trip.html'],
    prefixPath: '/trip/',
    preserveRequestPathForCanonical: true,
    preserveRequestPathForAlternates: true,
  },
  {
    seoPage: 'trips',
    htmlPath: '/trips.html',
    canonicalPath: '/trips.html',
    exactPaths: ['/trips', '/trips/', '/trips.html'],
  },
  {
    seoPage: 'vip',
    htmlPath: '/vip.html',
    canonicalPath: '/vip.html',
    exactPaths: ['/vip', '/vip/', '/vip.html'],
  },
];

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

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function normalizePathname(pathname) {
  const raw = String(pathname || '/').trim() || '/';
  if (raw === '/') {
    return '/';
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function isPrefixExcluded(pathname, route) {
  return Array.isArray(route.excludedPrefixes)
    && route.excludedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function resolveSeoRoute(pathname) {
  const rawPath = String(pathname || '/').trim() || '/';
  const normalizedPath = normalizePathname(rawPath);

  for (const route of PAGE_ROUTES) {
    const exactPaths = new Set(route.exactPaths || []);
    if (exactPaths.has(rawPath) || exactPaths.has(normalizedPath)) {
      return route;
    }

    if (route.prefixPath) {
      const rawPrefix = String(route.prefixPath || '');
      if (rawPrefix && rawPath.startsWith(rawPrefix) && !isPrefixExcluded(normalizedPath, route)) {
        return route;
      }
    }
  }

  return null;
}

export function getSeoLanguage(urlLike) {
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
  return requested === 'pl' ? 'pl' : 'en';
}

function buildAbsoluteUrl(pathname, search = '') {
  const url = new URL(pathname || '/', CANONICAL_ORIGIN);
  const params = new URLSearchParams(search || '');
  params.forEach((value, key) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function buildLanguageUrl(pathname, language) {
  const url = new URL(pathname || '/', CANONICAL_ORIGIN);
  if (language) {
    url.searchParams.set('lang', language);
  }
  return url.toString();
}

function extractTagContent(html, tagName) {
  const match = String(html || '').match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return (match?.[1] || '').trim();
}

function extractMetaContent(html, attribute, value) {
  const escapedValue = escapeRegex(value);
  const contentFirst = new RegExp(
    `<meta\\b[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${escapedValue}["'][^>]*>`,
    'i'
  );
  const selectorFirst = new RegExp(
    `<meta\\b[^>]*${attribute}=["']${escapedValue}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'i'
  );

  return (
    String(html || '').match(selectorFirst)?.[1]?.trim()
    || String(html || '').match(contentFirst)?.[1]?.trim()
    || ''
  );
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

export function extractSeoFallbacksFromHtml(html) {
  return {
    title: extractTagContent(html, 'title'),
    description: extractMetaContent(html, 'name', 'description'),
    ogTitle: extractMetaContent(html, 'property', 'og:title'),
    ogDescription: extractMetaContent(html, 'property', 'og:description'),
    ogImage: extractMetaContent(html, 'property', 'og:image'),
    ogLocale: extractMetaContent(html, 'property', 'og:locale'),
  };
}

export function buildSeoPayload({
  route,
  language,
  requestPathname,
  requestSearch = '',
  translations = {},
  fallbackSeo = {},
} = {}) {
  if (!route) {
    return null;
  }

  const resolvedLanguage = language === 'pl' ? 'pl' : 'en';
  const localeFallback = resolvedLanguage === 'pl' ? 'pl_PL' : 'en_GB';
  const alternateLocale = resolvedLanguage === 'pl' ? 'en_GB' : 'pl_PL';
  const baseKey = `seo.${route.seoPage}`;
  const requestPath = String(requestPathname || route.canonicalPath || '/').trim() || route.canonicalPath || '/';
  const canonicalPath = route.preserveRequestPathForCanonical ? requestPath : route.canonicalPath;
  const alternateBasePath = route.preserveRequestPathForAlternates ? requestPath : route.canonicalPath;

  const title = getTranslationValue(translations, `${baseKey}.title`) || fallbackSeo.title || '';
  const description =
    getTranslationValue(translations, `${baseKey}.description`) || fallbackSeo.description || '';
  const ogTitle =
    getTranslationValue(translations, `${baseKey}.ogTitle`) || title || fallbackSeo.ogTitle || '';
  const ogDescription =
    getTranslationValue(translations, `${baseKey}.ogDescription`) || description || fallbackSeo.ogDescription || '';
  const ogLocale =
    getTranslationValue(translations, `${baseKey}.locale`)
    || getTranslationValue(translations, 'seo.locale')
    || fallbackSeo.ogLocale
    || localeFallback;
  const ogImageValue =
    getTranslationValue(translations, `${baseKey}.ogImage`)
    || getTranslationValue(translations, 'seo.ogImage')
    || fallbackSeo.ogImage
    || DEFAULT_OG_IMAGE;

  return {
    language: resolvedLanguage,
    title,
    description,
    ogTitle,
    ogDescription,
    ogType: 'website',
    ogUrl: buildAbsoluteUrl(requestPath, requestSearch),
    ogImage: buildAbsoluteUrl(ogImageValue),
    ogLocale,
    ogLocaleAlternate: alternateLocale,
    canonicalUrl: buildAbsoluteUrl(canonicalPath),
    languageUrls: {
      pl: buildLanguageUrl(alternateBasePath, 'pl'),
      en: buildLanguageUrl(alternateBasePath, 'en'),
      xDefault: buildAbsoluteUrl(alternateBasePath),
    },
  };
}

export function applySeoToHtml(html, payload) {
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
  const safeAuthor = escapeHtml(payload.authorName || '');

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
  if (safeAuthor) {
    nextHtml = replaceOrInject(
      nextHtml,
      /<meta\s+name=["']author["'][^>]*>/i,
      `  <meta name="author" content="${safeAuthor}" />`
    );
  }
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
