import { normalizeLocationForOffer } from '/js/car-pricing.js';
import { normalizePaphosWidgetLocation } from '/js/car-rental-flow.js';

const PAPHOS_SPECIFIC_LOCATION_VALUES = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

function currentLang() {
  const lang = (typeof window.getCurrentLanguage === 'function'
    ? window.getCurrentLanguage()
    : (window.appI18n?.language || document.documentElement?.lang || 'pl'));
  const normalized = String(lang || 'pl').toLowerCase();
  return normalized.startsWith('en') ? 'en' : 'pl';
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
  const translations = window.appI18n?.translations?.[lang] || null;
  const entry = getTranslationEntry(translations, key);

  let text = null;
  if (typeof entry === 'string') {
    text = entry;
  } else if (entry && typeof entry === 'object') {
    if (typeof entry.text === 'string') {
      text = entry.text;
    } else if (typeof entry.html === 'string') {
      text = entry.html;
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

export function buildCarLocationOptionsHtml({
  restrictToPaphos = false,
  includePlaceholder = false,
  selectedValue = '',
} = {}) {
  const selected = String(selectedValue || '').trim();
  const larnacaLabel = tr('carRentalLanding.locations.group.islandWide', 'Larnaka / cały Cypr');
  const paphosLabel = tr('carRentalLanding.locations.group.paphosOnly', 'Pafos (tylko oferta Pafos)');

  const larnacaOptions = [
    { value: 'larnaca', label: tr('carRental.locations.larnaca.label', 'Larnaka (bez opłaty)') },
    { value: 'nicosia', label: tr('carRental.locations.nicosia.label', 'Nikozja (+15€)') },
    { value: 'ayia-napa', label: tr('carRental.locations.ayia-napa.label', 'Ayia Napa (+15€)') },
    { value: 'protaras', label: tr('carRental.locations.protaras.label', 'Protaras (+20€)') },
    { value: 'limassol', label: tr('carRental.locations.limassol.label', 'Limassol (+20€)') },
    { value: 'paphos', label: tr('carRental.locations.paphos.label', 'Pafos (+40€)') },
  ];

  const paphosOptions = [
    {
      value: 'airport_pfo',
      label: tr(
        'carRentalLanding.locations.paphos.airport',
        'Pafos Lotnisko (+10€ przy wynajmie < 7 dni)'
      ),
    },
    {
      value: 'city_center',
      label: tr('carRentalLanding.locations.paphos.cityCenter', 'Pafos - centrum miasta'),
    },
    {
      value: 'hotel',
      label: tr('carRentalLanding.locations.paphos.hotel', 'Hotel (w tym Coral Bay / Polis)'),
    },
    {
      value: 'other',
      label: tr('carRentalLanding.locations.paphos.other', 'Inne miejsce (np. Coral Bay / Polis)'),
    },
  ];

  const renderOptions = (items) => items
    .map((item) => `
      <option value="${escapeHtml(item.value)}" ${item.value === selected ? 'selected' : ''}>
        ${escapeHtml(item.label)}
      </option>
    `)
    .join('');

  return `
    ${includePlaceholder ? `<option value="">${escapeHtml(tr('carRentalLanding.locations.placeholder', 'Wybierz lokalizację'))}</option>` : ''}
    ${restrictToPaphos ? '' : `
      <optgroup label="${escapeHtml(larnacaLabel)}">
        ${renderOptions(larnacaOptions)}
      </optgroup>
    `}
    <optgroup label="${escapeHtml(paphosLabel)}">
      ${renderOptions(paphosOptions)}
    </optgroup>
  `;
}
