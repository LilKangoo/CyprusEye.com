import { createSupabaseClients } from './supabaseAdmin.js';
import { SERVICE_OFFER_DEFAULT_IMAGE } from './serviceOfferData.js';

const CANONICAL_ORIGIN = 'https://www.cypruseye.com';

const CAR_OFFER_COPY = {
  en: {
    fallbackTitle: 'Car rental',
    fallbackDescription: 'Open this Cyprus car offer with direct booking details and the selected vehicle preloaded.',
    notFoundTitle: 'Car Offer Not Found | CyprusEye',
    notFoundDescription: 'The car offer you requested could not be found.',
    locationLabels: {
      larnaca: 'Larnaca',
      paphos: 'Paphos',
    },
  },
  pl: {
    fallbackTitle: 'Wynajem auta',
    fallbackDescription: 'Otwórz ofertę wynajmu auta na Cyprze z wczytanym konkretnym pojazdem i bezpośrednią rezerwacją.',
    notFoundTitle: 'Nie znaleziono oferty auta | CyprusEye',
    notFoundDescription: 'Nie udało się znaleźć oferty auta, której szukasz.',
    locationLabels: {
      larnaca: 'Larnaka',
      paphos: 'Pafos',
    },
  },
};

function getReadClient(env) {
  const { publicClient, adminClient } = createSupabaseClients(env);
  return publicClient || adminClient;
}

function normalizeCarOfferLanguage(value) {
  return String(value || '').trim().toLowerCase() === 'pl' ? 'pl' : 'en';
}

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

function slugifyCarValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickLocalizedCarValue(value, language) {
  const resolvedLanguage = normalizeCarOfferLanguage(language);
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

function isMissingCarSeoColumnError(error) {
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

function normalizeLocation(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'larnaca') return 'larnaca';
  if (normalized === 'paphos') return 'paphos';
  return '';
}

function buildCarOfferUrl({ offerId, carSlug, offerLocation, language }) {
  const url = new URL('/car.html', CANONICAL_ORIGIN);
  if (offerId) {
    url.searchParams.set('offer_id', offerId);
  }
  if (carSlug) {
    url.searchParams.set('car', carSlug);
  }
  if (offerLocation) {
    url.searchParams.set('offer_location', offerLocation);
  }
  url.searchParams.set('lang', normalizeCarOfferLanguage(language));
  return url.toString();
}

function buildLanguageUrls({ offerId, carSlug, offerLocation }) {
  return {
    pl: buildCarOfferUrl({ offerId, carSlug, offerLocation, language: 'pl' }),
    en: buildCarOfferUrl({ offerId, carSlug, offerLocation, language: 'en' }),
    xDefault: buildCarOfferUrl({ offerId, carSlug, offerLocation, language: 'en' }),
  };
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
  const resolvedLanguage = normalizeCarOfferLanguage(language);
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

function pickLocationLabel(location, language) {
  const resolvedLanguage = normalizeCarOfferLanguage(language);
  const copy = CAR_OFFER_COPY[resolvedLanguage] || CAR_OFFER_COPY.en;
  return copy.locationLabels[normalizeLocation(location)] || '';
}

function pickCarTitle(offer, language) {
  return pickLocalizedCarValue(offer?.carModel, language)
    || pickLocalizedCarValue(offer?.carType, language)
    || '';
}

function pickCarDescription(offer, language) {
  const direct = pickLocalizedCarValue(offer?.metaDescription, language);
  if (direct) {
    return truncateText(direct);
  }

  const fallback = firstSentence(pickLocalizedCarValue(offer?.description, language));
  if (fallback) {
    return fallback;
  }

  const copy = CAR_OFFER_COPY[normalizeCarOfferLanguage(language)] || CAR_OFFER_COPY.en;
  const locationLabel = pickLocationLabel(offer?.location, language);
  if (locationLabel) {
    return truncateText(`${copy.fallbackDescription} ${locationLabel}.`);
  }
  return copy.fallbackDescription;
}

export async function getPublishedCarOfferById(env, { offerId } = {}) {
  const normalizedOfferId = String(offerId || '').trim();
  if (!normalizedOfferId) {
    return null;
  }

  const client = getReadClient(env);
  if (!client) {
    throw new Error('Supabase read client is not available');
  }

  const primarySelect = 'id, car_model, car_type, description, image_url, location, is_available, is_published, meta_description, meta_image_url';
  const legacySelect = 'id, car_model, car_type, description, image_url, location, is_available, is_published';

  const runQuery = (select) => client
    .from('car_offers')
    .select(select)
    .eq('id', normalizedOfferId)
    .eq('is_available', true)
    .eq('is_published', true)
    .maybeSingle();

  let response = await runQuery(primarySelect);
  if (response?.error && isMissingCarSeoColumnError(response.error)) {
    response = await runQuery(legacySelect);
  }

  if (response?.error) {
    throw response.error;
  }
  if (!response?.data) {
    return null;
  }

  const row = response.data;
  return {
    id: row.id || normalizedOfferId,
    carModel: row.car_model || {},
    carType: row.car_type || {},
    description: row.description || {},
    metaDescription: row.meta_description || {},
    metaImageUrl: String(row.meta_image_url || '').trim(),
    imageUrl: String(row.image_url || '').trim(),
    location: normalizeLocation(row.location),
    raw: row,
  };
}

export function buildCarOfferSeoPayload({
  language,
  offer = null,
  requestedCarSlug = '',
  requestedOfferLocation = '',
} = {}) {
  const resolvedLanguage = normalizeCarOfferLanguage(language);
  const copy = CAR_OFFER_COPY[resolvedLanguage] || CAR_OFFER_COPY.en;
  const effectiveLocation = normalizeLocation(requestedOfferLocation) || normalizeLocation(offer?.location);
  const title = pickCarTitle(offer, resolvedLanguage) || copy.fallbackTitle;
  const description = offer
    ? pickCarDescription(offer, resolvedLanguage)
    : copy.notFoundDescription;
  const carSlug = String(requestedCarSlug || '').trim() || slugifyCarValue(title);
  const languageUrls = buildLanguageUrls({
    offerId: offer?.id || '',
    carSlug,
    offerLocation: effectiveLocation,
  });
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

  const pageTitle = `${title} • CyprusEye`;
  const ogImage = offer.metaImageUrl || offer.imageUrl || SERVICE_OFFER_DEFAULT_IMAGE;

  return buildBasePayload({
    language: resolvedLanguage,
    title: pageTitle,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    canonicalUrl,
    ogUrl: canonicalUrl,
    languageUrls,
  });
}
