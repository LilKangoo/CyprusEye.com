const SITE_ORIGIN = 'https://www.cypruseye.com';
const SITE_NAME = 'CyprusEye';
const SITE_LOGO_PATH = '/assets/cyprus_logo-1000x1054.png';

function toSchemaLanguage(language) {
  if (language === 'he') return 'he-IL';
  if (language === 'pl') return 'pl-PL';
  return 'en-GB';
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function cleanJsonLd(value) {
  if (Array.isArray(value)) {
    return value
      .map(cleanJsonLd)
      .filter((entry) => {
        if (entry === null || entry === undefined || entry === '') return false;
        if (Array.isArray(entry)) return entry.length > 0;
        if (isPlainObject(entry)) return Object.keys(entry).length > 0;
        return true;
      });
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, cleanJsonLd(entry)])
      .filter(([, entry]) => {
        if (entry === null || entry === undefined || entry === '') return false;
        if (Array.isArray(entry)) return entry.length > 0;
        if (isPlainObject(entry)) return Object.keys(entry).length > 0;
        return true;
      })
  );
}

export function toStructuredDataUrl(value) {
  const raw = String(value || '').trim();
  try {
    return new URL(raw || '/', SITE_ORIGIN).toString();
  } catch (_) {
    return new URL('/', SITE_ORIGIN).toString();
  }
}

export function serializeStructuredData(items) {
  const cleanItems = cleanJsonLd(Array.isArray(items) ? items : [items]);
  if (!cleanItems.length) {
    return '';
  }
  const payload = cleanItems.length === 1 ? cleanItems[0] : cleanItems;
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: toStructuredDataUrl(SITE_LOGO_PATH),
  };
}

export function buildWebSiteJsonLd({ language = 'en', url = SITE_ORIGIN, description = '' } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    name: SITE_NAME,
    url: toStructuredDataUrl(url),
    inLanguage: toSchemaLanguage(language),
    description,
    publisher: {
      '@id': `${SITE_ORIGIN}/#organization`,
    },
  };
}

export function buildBreadcrumbJsonLd(items = []) {
  const validItems = items
    .map((item) => ({
      name: String(item?.name || '').trim(),
      item: toStructuredDataUrl(item?.item || '/'),
    }))
    .filter((item) => item.name && item.item);

  if (validItems.length < 2) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: validItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

export function buildArticleJsonLd({
  language = 'en',
  headline = '',
  description = '',
  image = '',
  url = '',
  datePublished = '',
  dateModified = '',
  authorName = '',
  authorUrl = '',
} = {}) {
  const resolvedUrl = toStructuredDataUrl(url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${resolvedUrl}#article`,
    headline,
    description,
    image: image ? [toStructuredDataUrl(image)] : [],
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': resolvedUrl,
    },
    inLanguage: toSchemaLanguage(language),
    datePublished,
    dateModified,
    author: authorName
      ? {
        '@type': 'Person',
        name: authorName,
        url: authorUrl ? toStructuredDataUrl(authorUrl) : '',
      }
      : {
        '@id': `${SITE_ORIGIN}/#organization`,
      },
    publisher: {
      '@id': `${SITE_ORIGIN}/#organization`,
    },
  };
}

export function buildServiceJsonLd({
  language = 'en',
  name = '',
  description = '',
  image = '',
  url = '',
  serviceType = '',
  areaServed = 'Cyprus',
} = {}) {
  const resolvedUrl = toStructuredDataUrl(url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${resolvedUrl}#service`,
    name,
    description,
    image: image ? toStructuredDataUrl(image) : '',
    url: resolvedUrl,
    inLanguage: toSchemaLanguage(language),
    serviceType,
    areaServed,
    provider: {
      '@id': `${SITE_ORIGIN}/#organization`,
    },
  };
}
