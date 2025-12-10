/**
 * i18n Helper for Community
 * Provides translation functions for dynamic content
 */

/**
 * Get translation for a given key
 * @param {string} key - Translation key (e.g., 'community.rating.title')
 * @param {Object|string} paramsOrFallback - Either params object for interpolation or fallback string
 * @returns {string} Translated string or fallback/key if not found
 */
export function t(key, paramsOrFallback = {}) {
  const i18n = window.appI18n || {};
  const language = i18n.language || document.documentElement.lang || 'pl';
  const translations = (i18n.translations && i18n.translations[language]) || {};
  
  // Determine if second argument is fallback string or params object
  let params = {};
  let fallback = key;
  
  if (typeof paramsOrFallback === 'string') {
    fallback = paramsOrFallback;
  } else if (paramsOrFallback && typeof paramsOrFallback === 'object') {
    params = paramsOrFallback;
  }
  
  let text = getNestedTranslation(translations, key);
  
  // If not found, use fallback
  if (text === null || text === undefined) {
    text = fallback;
  }
  
  // Simple interpolation for {{param}} syntax
  if (params && typeof text === 'string') {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{\\{${param}\\}\\}`, 'g');
      text = text.replace(regex, params[param]);
    });
  }
  
  return text;
}

/**
 * Get nested translation value using dot notation
 * @param {Object} translations - Translation object
 * @param {string} key - Dot-notated key
 * @returns {string|null} Translation string or null
 */
function getNestedTranslation(translations, key) {
  if (!key || !translations) return null;
  
  // Direct lookup for flat keys (like pl.json format)
  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }
  
  // Support nested objects via dot notation (like en.json format)
  if (key.indexOf('.') !== -1) {
    const parts = key.split('.');
    let current = translations;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return typeof current === 'string' ? current : null;
  }
  
  return null;
}

/**
 * Get current language
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  const i18n = window.appI18n || {};
  return i18n.language || document.documentElement.lang || 'pl';
}

/**
 * Format comment count with proper pluralization
 * @param {number} count
 * @returns {string}
 */
export function formatCommentCount(count) {
  if (count === 0) return t('community.comments.count.zero');
  if (count === 1) return t('community.comments.count.one');
  return t('community.comments.count.multiple', { count });
}

/**
 * Format photo count with proper pluralization
 * @param {number} count
 * @returns {string}
 */
export function formatPhotoCount(count) {
  if (count === 0) return t('community.photos.count.zero');
  if (count === 1) return t('community.photos.count.one');
  return t('community.photos.count.multiple', { count });
}

/**
 * Format rating count with proper pluralization
 * @param {number} count
 * @returns {string}
 */
export function formatRatingCount(count) {
  if (count === 1) return t('community.rating.oneRating');
  return t('community.rating.multipleRatings');
}
