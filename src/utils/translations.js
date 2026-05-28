/**
 * Translation and i18n Utilities
 * Functions for handling translations and internationalization
 */

const DEFAULT_LANGUAGE = 'en';
const FALLBACK_LANGUAGES = {
  he: ['he', 'en', 'pl'],
  en: ['en', 'pl'],
  pl: ['pl', 'en'],
};

function normalizeLanguageCode(language) {
  return String(language || '')
    .trim()
    .toLowerCase()
    .split('-')[0];
}

function isFilledLocalizedValue(value) {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return value !== null && typeof value !== 'undefined';
}

function getTranslationEntry(translations, key) {
  if (!key || !translations) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }

  if (key.indexOf('.') === -1) {
    return null;
  }

  let current = translations;
  for (const part of key.split('.')) {
    if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      return null;
    }
  }

  return current;
}

function getTranslationStringFromEntry(entry) {
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
  return null;
}

/**
 * Build the language fallback chain used across UI and dynamic data.
 * Hebrew intentionally falls back to English before Polish.
 * @param {string} language
 * @returns {string[]}
 */
export function getLanguageFallbackChain(language) {
  const normalized = normalizeLanguageCode(language);
  const chain = FALLBACK_LANGUAGES[normalized] || FALLBACK_LANGUAGES[DEFAULT_LANGUAGE];
  return [...new Set(chain)];
}

/**
 * Pick a localized value from a string, array, or object such as { pl, en, he }.
 * @param {*} value
 * @param {string} language
 * @param {*} fallback
 * @returns {*}
 */
export function pickLocalizedValue(value, language, fallback = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return isFilledLocalizedValue(value) ? value : fallback;
  }

  for (const code of getLanguageFallbackChain(language)) {
    if (isFilledLocalizedValue(value[code])) {
      return value[code];
    }
  }

  const firstAvailable = Object.values(value).find(isFilledLocalizedValue);
  return typeof firstAvailable !== 'undefined' ? firstAvailable : fallback;
}

/**
 * Pick a localized field from rows that use either JSONB objects or legacy columns.
 * Supports shapes like { title: { en, pl, he } } and { title_en, title_he, title }.
 * @param {Object} source
 * @param {string} fieldName
 * @param {string} language
 * @param {*} fallback
 * @returns {*}
 */
export function pickLocalizedField(source, fieldName, language, fallback = '') {
  if (!source || !fieldName) {
    return fallback;
  }

  const direct = source[fieldName];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    const localized = pickLocalizedValue(direct, language, null);
    if (isFilledLocalizedValue(localized)) {
      return localized;
    }
  }

  for (const code of getLanguageFallbackChain(language)) {
    const localizedColumn = source[`${fieldName}_${code}`];
    if (isFilledLocalizedValue(localizedColumn)) {
      return localizedColumn;
    }

    if (code === 'pl' && isFilledLocalizedValue(source[fieldName])) {
      return source[fieldName];
    }
  }

  if (isFilledLocalizedValue(direct)) {
    return direct;
  }

  const localizedPrefix = `${fieldName}_`;
  const firstLocalizedColumn = Object.entries(source)
    .find(([key, value]) => key.startsWith(localizedPrefix) && isFilledLocalizedValue(value));
  if (firstLocalizedColumn) {
    return firstLocalizedColumn[1];
  }

  return fallback;
}

/**
 * Get translated text for a key
 * @param {string} key - Translation key (e.g., 'places.name')
 * @param {string} fallback - Fallback text if translation not found
 * @returns {string}
 */
export function getTranslation(key, fallback = '') {
  if (typeof window !== 'undefined' && window.appI18n) {
    const currentLang = window.appI18n.language || DEFAULT_LANGUAGE;

    if (typeof window.appI18n.getTranslationString === 'function') {
      const resolved = window.appI18n.getTranslationString(key, currentLang);
      return typeof resolved === 'string' ? resolved : fallback;
    }

    const translationsByLanguage = window.appI18n.translations || {};
    for (const language of getLanguageFallbackChain(currentLang)) {
      const resolved = getTranslationStringFromEntry(getTranslationEntry(translationsByLanguage[language], key));
      if (typeof resolved === 'string') {
        return resolved;
      }
    }
  }

  return fallback;
}

/**
 * Advanced translation with variable replacements
 * @param {string} key - Translation key
 * @param {string} fallback - Fallback text
 * @param {Object} replacements - Key-value pairs for variable replacement
 * @returns {string}
 */
export function translate(key, fallback = '', replacements = {}) {
  let text = getTranslation(key, fallback);
  
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const pattern = new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, 'g');
    text = text.replace(pattern, String(value));
  });
  
  return text;
}

/**
 * Get active translations for current language
 * @returns {Object|null}
 */
export function getActiveTranslations() {
  if (typeof window === 'undefined' || !window.appI18n) {
    return null;
  }
  
  const { language = 'pl', translations = {} } = window.appI18n;
  return translations[language] || null;
}

/**
 * Check if translations are loaded and ready
 * @returns {boolean}
 */
export function areTranslationsReady() {
  const translations = getActiveTranslations();
  return !!(translations && Object.keys(translations).length > 0);
}

/**
 * Get translation key for a task field
 * @param {Object} task - Task object
 * @param {string} field - Field name ('title' or 'description')
 * @returns {string}
 */
export function getTaskTranslationKey(task, field) {
  return `tasks.${task.id}.${field}`;
}

/**
 * Get task title with translation fallback
 * @param {Object} task - Task object
 * @returns {string}
 */
export function getTaskTitle(task) {
  return getTranslation(getTaskTranslationKey(task, 'title'), task.title);
}

/**
 * Get task description with translation fallback
 * @param {Object} task - Task object
 * @returns {string}
 */
export function getTaskDescription(task) {
  return getTranslation(getTaskTranslationKey(task, 'description'), task.description);
}

/**
 * Get translation key for a place field
 * @param {Object} place - Place object with id
 * @param {string} field - Field name ('name', 'description', 'badge')
 * @returns {string}
 */
export function getPlaceTranslationKey(place, field) {
  if (!place || !place.id) {
    return '';
  }
  return `places.${place.id}.${field}`;
}

/**
 * Get place name with translation
 * @param {Object} place - Place object
 * @returns {string}
 */
export function getPlaceName(place) {
  const key = getPlaceTranslationKey(place, 'name');
  return getTranslation(key, place.name || '');
}

/**
 * Get place description with translation
 * @param {Object} place - Place object
 * @returns {string}
 */
export function getPlaceDescription(place) {
  const key = getPlaceTranslationKey(place, 'description');
  return getTranslation(key, place.description || '');
}

/**
 * Get place badge with translation
 * @param {Object} place - Place object
 * @returns {string}
 */
export function getPlaceBadge(place) {
  const key = getPlaceTranslationKey(place, 'badge');
  return getTranslation(key, place.badge || '');
}
