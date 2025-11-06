/**
 * Validation and Sanitization Utilities
 * Pure functions for input validation and data sanitization
 */

/**
 * Normalize search text (lowercase, remove diacritics)
 * @param {string} value - Text to normalize
 * @returns {string}
 */
export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Sanitize account profile data
 * @param {Object} profile - Raw profile data
 * @returns {Object}
 */
export function sanitizeAccountProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const id = typeof profile.id === 'string' && profile.id.trim() ? profile.id.trim() : null;
  const username =
    typeof profile.username === 'string' && profile.username.trim()
      ? profile.username.trim()
      : null;
  const email =
    typeof profile.email === 'string' && profile.email.trim() ? profile.email.trim() : null;

  if (!id) {
    return null;
  }

  return {
    id,
    username,
    email,
  };
}

/**
 * Clamp rating value between 0-5
 * @param {number} rating - Rating value
 * @returns {number}
 */
export function clampRating(rating) {
  const num = Number.isFinite(rating) ? Math.floor(rating) : 0;
  return Math.max(0, Math.min(5, num));
}
