/**
 * i18n Helper for Community
 * Provides translation functions for dynamic content
 */

/**
 * Get translation for a given key
 * @param {string} key - Translation key (e.g., 'community.rating.title')
 * @param {Object} params - Optional parameters for interpolation
 * @returns {string} Translated string or key if not found
 */
export function t(key, params = {}) {
  const i18n = window.appI18n || {};
  const language = i18n.language || document.documentElement.lang || 'pl';
  const translations = (i18n.translations && i18n.translations[language]) || {};
  
  let text = translations[key] || key;
  
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
