import { PHONE_COUNTRY_CODES } from './phone-country-codes.js';

const DEFAULT_LABELS = {
  pl: {
    chooseCountryCode: 'Wybierz kierunkowy',
    searchCountryOrCode: 'Szukaj kraju lub kodu',
    phoneNumber: 'Numer telefonu',
    noResults: 'Brak wyników',
  },
  en: {
    chooseCountryCode: 'Choose country code',
    searchCountryOrCode: 'Search country or code',
    phoneNumber: 'Phone number',
    noResults: 'No results',
  },
  he: {
    chooseCountryCode: 'בחרו קידומת מדינה',
    searchCountryOrCode: 'חפשו מדינה או קוד',
    phoneNumber: 'מספר טלפון',
    noResults: 'אין תוצאות',
  },
};

const PREFERRED_PHONE_COUNTRY_BY_DIAL = {
  '+1': 'US',
  '+7': 'RU',
  '+39': 'IT',
  '+44': 'GB',
  '+47': 'NO',
  '+61': 'AU',
  '+212': 'MA',
  '+262': 'RE',
  '+358': 'FI',
  '+590': 'GP',
  '+599': 'BQ',
};

const COUNTRY_ALIASES = {
  pl: 'PL',
  polska: 'PL',
  poland: 'PL',
  cy: 'CY',
  cyprus: 'CY',
  cypr: 'CY',
  cypru: 'CY',
  'קפריסין': 'CY',
  uk: 'GB',
  gb: 'GB',
  england: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  'united kingdom': 'GB',
  'wielka brytania': 'GB',
  'בריטניה': 'GB',
  israel: 'IL',
  il: 'IL',
  izrael: 'IL',
  'ישראל': 'IL',
};

const controllers = new WeakMap();

function normalizeLanguage(value) {
  const normalized = String(value || document.documentElement?.lang || 'en').trim().toLowerCase();
  if (normalized.startsWith('pl')) return 'pl';
  if (normalized.startsWith('he')) return 'he';
  return 'en';
}

function getCurrentLanguage(options = {}) {
  if (typeof options.language === 'function') return normalizeLanguage(options.language());
  return normalizeLanguage(options.language || window.getCurrentLanguage?.() || window.appI18n?.language);
}

function getLabels(language, labels = {}) {
  return {
    ...DEFAULT_LABELS[language],
    ...(labels[language] || {}),
  };
}

function flagFromIso2(iso2) {
  const code = String(iso2 || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...Array.from(code).map((char) => 127397 + char.charCodeAt(0)));
}

function normalizePhoneCountryCode(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
}

function normalizeCountrySearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findPhoneCountryByIso(iso2) {
  const code = String(iso2 || '').trim().toUpperCase();
  return PHONE_COUNTRY_CODES.find((country) => country.iso2 === code) || null;
}

function findPhoneCountryByDialCode(value) {
  const dialCode = normalizePhoneCountryCode(value);
  if (!dialCode) return null;
  const preferredIso = PREFERRED_PHONE_COUNTRY_BY_DIAL[dialCode];
  if (preferredIso) {
    const preferred = findPhoneCountryByIso(preferredIso);
    if (preferred) return preferred;
  }
  return PHONE_COUNTRY_CODES.find((country) => country.dialCode === dialCode) || null;
}

function inferPhoneCountryFromText(value) {
  const normalized = normalizeCountrySearch(value);
  if (!normalized) return null;
  const alias = COUNTRY_ALIASES[normalized];
  if (alias) return findPhoneCountryByIso(alias);
  const isoMatch = PHONE_COUNTRY_CODES.find((country) => country.iso2.toLowerCase() === normalized);
  if (isoMatch) return isoMatch;
  return PHONE_COUNTRY_CODES.find((country) => normalizeCountrySearch(country.name).includes(normalized)) || null;
}

function getDefaultCountry(language) {
  if (language === 'pl') return findPhoneCountryByIso('PL') || PHONE_COUNTRY_CODES[0];
  if (language === 'he') return findPhoneCountryByIso('IL') || PHONE_COUNTRY_CODES[0];
  return findPhoneCountryByIso('CY') || PHONE_COUNTRY_CODES[0];
}

function formatCompact(country) {
  if (!country) return '';
  return `${flagFromIso2(country.iso2)} ${country.dialCode}`.trim();
}

function formatOption(country) {
  if (!country) return '';
  return `${flagFromIso2(country.iso2)} ${country.dialCode} ${country.name} (${country.iso2})`.trim();
}

function filterCountries(query) {
  const normalized = normalizeCountrySearch(query);
  const digits = String(query || '').replace(/[^\d]/g, '');
  if (!normalized && !digits) return PHONE_COUNTRY_CODES;
  return PHONE_COUNTRY_CODES.filter((country) => {
    const name = normalizeCountrySearch(country.name);
    const iso = country.iso2.toLowerCase();
    const dialCode = country.dialCode.toLowerCase();
    const dialDigits = country.dialCode.replace(/[^\d]/g, '');
    return name.includes(normalized)
      || iso.includes(normalized)
      || dialCode.includes(normalized)
      || (digits && dialDigits.includes(digits));
  });
}

function cleanLocalNumber(value, countryCode = '') {
  let normalized = String(value || '')
    .trim()
    .replace(/^\++/, '')
    .replace(/^[\s().-]+/, '')
    .replace(/\s+/g, ' ');

  const codeDigits = normalizePhoneCountryCode(countryCode).replace(/\D/g, '');
  if (codeDigits) {
    const codePattern = new RegExp(`^${codeDigits.split('').map((digit) => `${digit}[\\s().-]*`).join('')}`);
    normalized = normalized.replace(codePattern, '').trim();
  }

  return normalized
    .replace(/^\++/, '')
    .replace(/^[\s().-]+/, '')
    .replace(/\s+/g, ' ');
}

function splitFullNumber(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\+\d{1,4})\s*(.*)$/);
  if (!match) return { code: '', local: cleanLocalNumber(raw) };
  return {
    code: normalizePhoneCountryCode(match[1]),
    local: cleanLocalNumber(match[2] || '', match[1]),
  };
}

function createEl(tagName, className = '') {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  return el;
}

function setButtonText(buttonText, country) {
  if (buttonText instanceof HTMLElement) {
    buttonText.textContent = formatCompact(country);
  }
}

export function enhancePhoneInput(inputOrSelector, options = {}) {
  const input = typeof inputOrSelector === 'string'
    ? document.querySelector(inputOrSelector)
    : inputOrSelector;
  if (!(input instanceof HTMLInputElement)) return null;

  const existing = controllers.get(input);
  if (existing) return existing;

  const initialLanguage = getCurrentLanguage(options);
  let labels = getLabels(initialLanguage, options.labels || {});
  const inputId = input.id || `phoneInput${Math.random().toString(36).slice(2, 8)}`;
  input.id = inputId;
  const localId = options.localInputId || `${inputId}Local`;
  const searchId = `${inputId}CountrySearch`;
  const resultsId = `${inputId}CountryResults`;
  const buttonId = `${inputId}CountryButton`;
  const panelId = `${inputId}CountryPanel`;
  const emptyId = `${inputId}CountryEmpty`;

  const field = input.closest(options.fieldSelector || '.transport-field, .form-field, .auto-field') || input.parentElement;
  if (field instanceof HTMLElement && options.fieldClass) {
    field.classList.add(options.fieldClass);
  }

  const escapeCss = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape
    : (value) => String(value).replace(/["\\]/g, '\\$&');
  const label = document.querySelector(`label[for="${escapeCss(inputId)}"]`);
  if (label instanceof HTMLLabelElement) {
    label.htmlFor = localId;
  }

  const originalType = input.type;
  input.type = 'hidden';
  input.required = false;
  input.setAttribute('data-phone-input-hidden', '1');
  input.autocomplete = 'tel';

  const root = createEl('div', 'ce-phone-input');
  root.dataset.phoneInput = '1';
  root.dataset.payloadInput = inputId;

  const countryWrap = createEl('div', 'ce-phone-input__country');
  const button = createEl('button', 'ce-phone-input__button');
  button.type = 'button';
  button.id = buttonId;
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', labels.chooseCountryCode);
  const buttonText = createEl('span', 'ce-phone-input__button-text');
  button.appendChild(buttonText);

  const panel = createEl('div', 'ce-phone-input__panel');
  panel.id = panelId;
  panel.hidden = true;

  const search = createEl('input', 'ce-phone-input__search');
  search.type = 'search';
  search.id = searchId;
  search.autocomplete = 'off';
  search.placeholder = labels.searchCountryOrCode;
  search.setAttribute('aria-label', labels.searchCountryOrCode);

  const results = createEl('div', 'ce-phone-input__results');
  results.id = resultsId;
  results.setAttribute('role', 'listbox');

  const empty = createEl('div', 'ce-phone-input__empty');
  empty.id = emptyId;
  empty.hidden = true;
  empty.textContent = labels.noResults;

  panel.append(search, results, empty);
  countryWrap.append(button, panel);

  const localInput = createEl('input', 'ce-phone-input__local');
  localInput.type = 'tel';
  localInput.id = localId;
  localInput.inputMode = 'tel';
  localInput.autocomplete = 'tel-national';
  localInput.required = false;
  if (options.required) {
    localInput.setAttribute('aria-required', 'true');
  }
  localInput.maxLength = Number(options.localMaxLength || 40);
  localInput.placeholder = options.placeholder || '';
  localInput.setAttribute('aria-label', labels.phoneNumber);

  root.append(countryWrap, localInput);
  input.insertAdjacentElement('afterend', root);

  let selectedCountry = null;

  const renderResults = (query = '') => {
    const countries = filterCountries(query);
    results.innerHTML = '';
    countries.forEach((country) => {
      const option = createEl('button', 'ce-phone-input__option');
      option.type = 'button';
      option.dataset.phoneCountryOption = '1';
      option.dataset.iso2 = country.iso2;
      option.dataset.dialCode = country.dialCode;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', selectedCountry?.iso2 === country.iso2 ? 'true' : 'false');
      option.textContent = formatOption(country);
      results.appendChild(option);
    });
    empty.hidden = countries.length > 0;
  };

  const closePanel = () => {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  const openPanel = () => {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    renderResults(search.value || '');
    search.focus();
    search.select();
  };

  const sync = () => {
    const code = normalizePhoneCountryCode(selectedCountry?.dialCode || '');
    const local = cleanLocalNumber(localInput.value || '', code);
    if (localInput.value !== local) {
      localInput.value = local;
    }
    input.value = code && local ? `${code} ${local}`.trim() : '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.value;
  };

  const setCountry = (country, setOptions = {}) => {
    if (!country) return;
    selectedCountry = country;
    if (setOptions.userChanged) {
      root.dataset.userChanged = '1';
    }
    button.dataset.iso2 = country.iso2;
    button.dataset.dialCode = country.dialCode;
    setButtonText(buttonText, country);
    renderResults(search.value || '');
    sync();
    if (setOptions.close !== false) closePanel();
  };

  const clearCountry = () => {
    selectedCountry = null;
    delete button.dataset.iso2;
    delete button.dataset.dialCode;
    setButtonText(buttonText, null);
    renderResults(search.value || '');
    sync();
  };

  const setFullNumber = (value = '') => {
    const split = splitFullNumber(value);
    const country = split.code ? findPhoneCountryByDialCode(split.code) : null;
    if (country) setCountry(country, { close: true });
    localInput.value = split.local;
    sync();
  };

  const setCountryFromText = (value, setOptions = {}) => {
    if (!setOptions.force && root.dataset.userChanged === '1') return false;
    const country = inferPhoneCountryFromText(value);
    if (!country) return false;
    setCountry(country, { close: true });
    return true;
  };

  const setLanguage = (languageValue) => {
    labels = getLabels(normalizeLanguage(languageValue), options.labels || {});
    button.setAttribute('aria-label', labels.chooseCountryCode);
    localInput.setAttribute('aria-label', labels.phoneNumber);
    search.placeholder = labels.searchCountryOrCode;
    search.setAttribute('aria-label', labels.searchCountryOrCode);
    empty.textContent = labels.noResults;
  };

  button.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  search.addEventListener('input', () => renderResults(search.value));
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      button.focus();
      return;
    }
    if (event.key === 'Enter') {
      const first = results.querySelector('[data-phone-country-option]');
      if (first instanceof HTMLButtonElement) {
        event.preventDefault();
        first.click();
      }
    }
  });

  results.addEventListener('click', (event) => {
    const option = event.target instanceof HTMLElement
      ? event.target.closest('[data-phone-country-option]')
      : null;
    if (!(option instanceof HTMLElement)) return;
    const country = findPhoneCountryByIso(option.dataset.iso2 || '')
      || findPhoneCountryByDialCode(option.dataset.dialCode || '');
    setCountry(country, { userChanged: true, close: true });
    button.focus();
  });

  localInput.addEventListener('input', sync);
  localInput.addEventListener('change', sync);

  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && root.contains(event.target)) return;
    closePanel();
  });

  const initial = splitFullNumber(input.value);
  const initialCountry = initial.code
    ? findPhoneCountryByDialCode(initial.code)
    : getDefaultCountry(initialLanguage);
  setCountry(initialCountry, { close: true });
  if (initial.local) {
    localInput.value = initial.local;
    sync();
  }

  const controller = {
    root,
    input,
    localInput,
    button,
    getCountry: () => selectedCountry,
    getFullNumber: () => sync(),
    sync,
    setFullNumber,
    setCountryFromText,
    setLanguage,
    clearCountry,
    validate: () => {
      const code = normalizePhoneCountryCode(selectedCountry?.dialCode || '');
      const local = cleanLocalNumber(localInput.value || '', code);
      return {
        countryCode: code,
        localNumber: local,
        fullNumber: code && local ? `${code} ${local}`.trim() : '',
      };
    },
    destroy: () => {
      root.remove();
      input.type = originalType;
      input.removeAttribute('data-phone-input-hidden');
      controllers.delete(input);
      delete input.__cePhoneInputController;
    },
  };
  controllers.set(input, controller);
  input.__cePhoneInputController = controller;
  return controller;
}

export const phoneInputUtils = {
  cleanLocalNumber,
  findPhoneCountryByDialCode,
  findPhoneCountryByIso,
  inferPhoneCountryFromText,
  normalizePhoneCountryCode,
  splitFullNumber,
};
