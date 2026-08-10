import { normalizeLocationForOffer } from '/js/car-pricing.js';
import {
  CAR_CITY_VALUES,
  coerceCarPlaceTypeForCity,
  getAllowedCarPlaceTypes,
  normalizePaphosWidgetLocation,
} from '/js/car-rental-flow.js';

const PAPHOS_SPECIFIC_LOCATION_VALUES = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

const CITY_LABELS = {
  pl: {
    larnaca: 'Larnaka',
    nicosia: 'Nikozja',
    'ayia-napa': 'Ayia Napa',
    protaras: 'Protaras',
    limassol: 'Limassol',
    paphos: 'Paphos',
  },
  en: {
    larnaca: 'Larnaca',
    nicosia: 'Nicosia',
    'ayia-napa': 'Ayia Napa',
    protaras: 'Protaras',
    limassol: 'Limassol',
    paphos: 'Paphos',
  },
  he: {
    larnaca: 'לרנקה',
    nicosia: 'ניקוסיה',
    'ayia-napa': 'איה נאפה',
    protaras: 'פרוטארס',
    limassol: 'לימסול',
    paphos: 'פאפוס',
  },
};

let runtimeCityCatalog = CAR_CITY_VALUES.map((code, sortOrder) => ({
  code,
  name_i18n: {
    pl: CITY_LABELS.pl[code],
    en: CITY_LABELS.en[code],
    he: CITY_LABELS.he[code],
  },
  sort_order: sortOrder,
  is_active: true,
}));

const PLACE_TYPE_LABELS = {
  pl: {
    airport: 'Lotnisko',
    hotel: 'Hotel',
    address: 'Adres',
  },
  en: {
    airport: 'Airport',
    hotel: 'Hotel',
    address: 'Address',
  },
  he: {
    airport: 'שדה תעופה',
    hotel: 'מלון',
    address: 'כתובת',
  },
};

function currentLang() {
  const lang = (typeof window.getCurrentLanguage === 'function'
    ? window.getCurrentLanguage()
    : (window.appI18n?.language || document.documentElement?.lang || 'pl'));
  const normalized = String(lang || 'pl').toLowerCase();
  const short = normalized.split('-')[0];
  if (short === 'pl' || short === 'en' || short === 'he') return short;
  return 'en';
}

function getTranslationEntry(translations, key) {
  if (!key || !translations || typeof translations !== 'object') return null;

  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }

  if (!key.includes('.')) {
    return null;
  }

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

function interpolateText(template, replacements = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(replacements, key)
      ? String(replacements[key])
      : match
  ));
}

function tr(key, fallback = '', replacements = {}) {
  const lang = currentLang();
  const roots = window.appI18n?.translations || {};
  const chain = lang === 'pl' ? ['pl', 'en'] : lang === 'he' ? ['he', 'en', 'pl'] : ['en', 'pl'];

  let text = null;
  for (const code of chain) {
    const entry = getTranslationEntry(roots?.[code], key);
    if (typeof entry === 'string' && entry) {
      text = entry;
      break;
    }
    if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string' && entry.text) {
        text = entry.text;
        break;
      }
      if (typeof entry.html === 'string' && entry.html) {
        text = entry.html;
        break;
      }
    }
  }

  return interpolateText(typeof text === 'string' ? text : fallback, replacements);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isPaphosSpecificCarLocationValue(value) {
  return PAPHOS_SPECIFIC_LOCATION_VALUES.has(String(value || '').trim());
}

export function normalizeCarReservationLocationValue(value, offerLocation = 'larnaca') {
  const normalizedOffer = String(offerLocation || '').trim().toLowerCase() === 'paphos' ? 'paphos' : 'larnaca';
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (normalizedOffer === 'paphos') {
    return normalizePaphosWidgetLocation(raw);
  }

  if (isPaphosSpecificCarLocationValue(raw)) {
    return raw;
  }

  return normalizeLocationForOffer(raw, 'larnaca') || '';
}

export function getCarCityLabel(value, lang = currentLang()) {
  const key = String(value || '').trim().toLowerCase();
  const configured = runtimeCityCatalog.find((city) => city.code === key)?.name_i18n;
  if (configured && typeof configured === 'object' && !Array.isArray(configured)) {
    const chain = lang === 'pl' ? ['pl', 'en', 'he'] : lang === 'he' ? ['he', 'en', 'pl'] : ['en', 'pl', 'he'];
    for (const language of chain) {
      const label = String(configured[language] || '').trim();
      if (label) return label;
    }
  }
  return CITY_LABELS[lang]?.[key] || CITY_LABELS.en[key] || key;
}

export function setCarRentalCityCatalog(rows = []) {
  const normalized = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.is_active === true)
    .map((row, index) => ({
      code: String(row?.code || '').trim().toLowerCase(),
      name_i18n: row?.name_i18n && typeof row.name_i18n === 'object' && !Array.isArray(row.name_i18n)
        ? { ...row.name_i18n }
        : {},
      sort_order: Number.isInteger(Number(row?.sort_order)) ? Number(row.sort_order) : index,
      is_active: true,
    }))
    .filter((row) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.code))
    .sort((left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code));

  if (!normalized.length) return false;
  runtimeCityCatalog = normalized.filter((city, index, all) => (
    all.findIndex((candidate) => candidate.code === city.code) === index
  ));
  return true;
}

export function getCarRentalCityCatalog() {
  return runtimeCityCatalog.map((city) => ({ ...city, name_i18n: { ...city.name_i18n } }));
}

export async function hydrateCarRentalCityCatalogForActiveRuntime(repository) {
  if (!repository || typeof repository.getFeatureFlags !== 'function') {
    return Object.freeze({ loaded: false, reason: 'repository_unavailable' });
  }
  try {
    const flags = await repository.getFeatureFlags();
    if (flags?.mappedEnabled !== true) {
      return Object.freeze({ loaded: false, reason: 'runtime_disabled', flags });
    }
    if (typeof repository.getActiveCities !== 'function') {
      return Object.freeze({ loaded: false, reason: 'city_reader_unavailable', flags });
    }
    const cities = await repository.getActiveCities();
    const loaded = setCarRentalCityCatalog(cities);
    return Object.freeze({ loaded, reason: loaded ? 'active_catalog_loaded' : 'empty_catalog', flags });
  } catch (error) {
    // The catalog is enhancement-only while flags are OFF or schema is being
    // deployed. Keep the six audited legacy choices without logging customer
    // or request data; mapped resolution itself still fails closed later.
    return Object.freeze({
      loaded: false,
      reason: 'catalog_read_failed',
      errorCode: String(error?.code || 'CAR_CITY_CATALOG_READ_FAILED'),
    });
  }
}

export function getCarPlaceTypeLabel(value, lang = currentLang()) {
  const key = String(value || '').trim().toLowerCase();
  return PLACE_TYPE_LABELS[lang]?.[key] || PLACE_TYPE_LABELS.en[key] || key;
}

export function buildCarCityOptionsHtml({
  includePlaceholder = false,
  selectedValue = '',
} = {}) {
  const selected = String(selectedValue || '').trim().toLowerCase();
  const placeholder = tr('carRentalLanding.locations.cityPlaceholder', 'Wybierz miasto');

  const options = runtimeCityCatalog
    .map((city) => `
      <option value="${escapeHtml(city.code)}" ${city.code === selected ? 'selected' : ''}>
        ${escapeHtml(getCarCityLabel(city.code))}
      </option>
    `)
    .join('');

  return `
    ${includePlaceholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}
    ${options}
  `;
}

export function buildCarPlaceTypeOptionsHtml(city, {
  includePlaceholder = false,
  selectedValue = '',
} = {}) {
  const selected = coerceCarPlaceTypeForCity(city, selectedValue || 'hotel');
  const placeholder = tr('carRentalLanding.locations.placeTypePlaceholder', 'Wybierz typ miejsca');
  const options = getAllowedCarPlaceTypes(city)
    .map((value) => `
      <option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>
        ${escapeHtml(getCarPlaceTypeLabel(value))}
      </option>
    `)
    .join('');

  return `
    ${includePlaceholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}
    ${options}
  `;
}

export function buildCarLocationOptionsHtml({
  includePlaceholder = false,
  selectedValue = '',
} = {}) {
  return buildCarCityOptionsHtml({ includePlaceholder, selectedValue });
}
