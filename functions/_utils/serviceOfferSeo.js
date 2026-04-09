import {
  SERVICE_OFFER_DEFAULT_IMAGE,
  normalizeServiceOfferLanguage,
  pickLocalizedServiceValue,
} from './serviceOfferData.js';

const CANONICAL_ORIGIN = 'https://www.cypruseye.com';

const SERVICE_OFFER_COPY = {
  hotel: {
    en: {
      fallbackTitle: 'Stay',
      fallbackDescription: 'Discover this Cyprus stay with direct booking details, gallery and location.',
      notFoundTitle: 'Stay Not Found | CyprusEye',
      notFoundDescription: 'The accommodation offer you requested could not be found.',
    },
    pl: {
      fallbackTitle: 'Nocleg',
      fallbackDescription: 'Poznaj ten nocleg na Cyprze wraz ze szczegółami pobytu, galerią i lokalizacją.',
      notFoundTitle: 'Nie znaleziono noclegu | CyprusEye',
      notFoundDescription: 'Nie udało się znaleźć oferty noclegu, której szukasz.',
    },
  },
  trip: {
    en: {
      fallbackTitle: 'Trip',
      fallbackDescription: 'Discover this Cyprus trip with direct booking details, gallery and live pricing.',
      notFoundTitle: 'Trip Not Found | CyprusEye',
      notFoundDescription: 'The trip offer you requested could not be found.',
    },
    pl: {
      fallbackTitle: 'Wycieczka',
      fallbackDescription: 'Poznaj tę wycieczkę po Cyprze wraz ze szczegółami, galerią i aktualną ceną.',
      notFoundTitle: 'Nie znaleziono wycieczki | CyprusEye',
      notFoundDescription: 'Nie udało się znaleźć oferty wycieczki, której szukasz.',
    },
  },
};

function normalizeComparableText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = 170) {
  const normalized = normalizeComparableText(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function firstSentence(value) {
  const normalized = stripHtml(value);
  if (!normalized) {
    return '';
  }
  const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  return truncateText(match?.[1] || normalized);
}

function toAbsoluteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return new URL(SERVICE_OFFER_DEFAULT_IMAGE, CANONICAL_ORIGIN).toString();
  }
  try {
    return new URL(raw, CANONICAL_ORIGIN).toString();
  } catch (_) {
    return new URL(SERVICE_OFFER_DEFAULT_IMAGE, CANONICAL_ORIGIN).toString();
  }
}

function buildQueryStyleUrl(kind, slug, language) {
  const url = new URL(`/${kind}.html`, CANONICAL_ORIGIN);
  url.searchParams.set('slug', slug);
  if (language === 'pl') {
    url.searchParams.set('lang', 'pl');
  } else {
    url.searchParams.delete('lang');
  }
  return url.toString();
}

function buildLanguageUrls(kind, slug) {
  if (!slug) {
    return {
      pl: buildQueryStyleUrl(kind, '', 'pl'),
      en: buildQueryStyleUrl(kind, '', 'en'),
      xDefault: buildQueryStyleUrl(kind, '', 'en'),
    };
  }

  return {
    pl: buildQueryStyleUrl(kind, slug, 'pl'),
    en: buildQueryStyleUrl(kind, slug, 'en'),
    xDefault: buildQueryStyleUrl(kind, slug, 'en'),
  };
}

function pickOfferTitle(offer, language, kind) {
  const copy = SERVICE_OFFER_COPY[kind]?.[language] || SERVICE_OFFER_COPY.hotel.en;
  return pickLocalizedServiceValue(offer?.title, language) || copy.fallbackTitle;
}

function pickOfferDescription(offer, language, kind) {
  const copy = SERVICE_OFFER_COPY[kind]?.[language] || SERVICE_OFFER_COPY.hotel.en;
  const direct = pickLocalizedServiceValue(offer?.metaDescription, language);
  if (direct) {
    return truncateText(direct);
  }

  const fallback = firstSentence(pickLocalizedServiceValue(offer?.description, language));
  return fallback || copy.fallbackDescription;
}

function buildBasePayload({
  language,
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  canonicalUrl,
  ogUrl,
  languageUrls,
  ogType = 'website',
}) {
  const resolvedLanguage = normalizeServiceOfferLanguage(language);
  return {
    language: resolvedLanguage,
    title,
    description,
    ogTitle: ogTitle || title,
    ogDescription: ogDescription || description,
    ogType,
    ogUrl: ogUrl || canonicalUrl,
    ogImage: toAbsoluteUrl(ogImage),
    ogLocale: resolvedLanguage === 'pl' ? 'pl_PL' : 'en_GB',
    ogLocaleAlternate: resolvedLanguage === 'pl' ? 'en_GB' : 'pl_PL',
    canonicalUrl,
    languageUrls,
  };
}

export function buildServiceOfferSeoPayload({
  kind,
  language,
  requestPathname: _requestPathname,
  pathStyle: _pathStyle = 'query',
  offer = null,
} = {}) {
  const resolvedLanguage = normalizeServiceOfferLanguage(language);
  const copy = SERVICE_OFFER_COPY[kind]?.[resolvedLanguage] || SERVICE_OFFER_COPY.hotel[resolvedLanguage];
  const slug = String(offer?.slug || '').trim();
  const languageUrls = buildLanguageUrls(kind, slug);
  const canonicalUrl = resolvedLanguage === 'pl' ? languageUrls.pl : languageUrls.en;

  if (!offer) {
    return buildBasePayload({
      language: resolvedLanguage,
      title: copy.notFoundTitle,
      description: copy.notFoundDescription,
      ogTitle: copy.notFoundTitle,
      ogDescription: copy.notFoundDescription,
      ogImage: SERVICE_OFFER_DEFAULT_IMAGE,
      canonicalUrl,
      ogUrl: canonicalUrl,
      languageUrls,
    });
  }

  const localizedTitle = pickOfferTitle(offer, resolvedLanguage, kind);
  const description = pickOfferDescription(offer, resolvedLanguage, kind);
  const pageTitle = `${localizedTitle} • CyprusEye`;
  const ogImage = offer.metaImageUrl || offer.coverImageUrl || SERVICE_OFFER_DEFAULT_IMAGE;

  return buildBasePayload({
    language: resolvedLanguage,
    title: pageTitle,
    description,
    ogTitle: localizedTitle,
    ogDescription: description,
    ogImage,
    canonicalUrl,
    ogUrl: canonicalUrl,
    languageUrls,
  });
}
