/**
 * Translation and i18n Utilities
 * Functions for handling translations and internationalization
 */

/**
 * Get translated text for a key
 * @param {string} key - Translation key (e.g., 'places.name')
 * @param {string} fallback - Fallback text if translation not found
 * @returns {string}
 */
export function getTranslation(key, fallback = '') {
  if (window.appI18n && window.appI18n.translations) {
    const currentLang = window.appI18n.language || 'pl';
    const translations = window.appI18n.translations[currentLang] || {};
    return translations[key] || fallback;
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
