/**
 * Date and Time Utilities
 * Pure functions for date manipulation and formatting
 */

/**
 * Convert date string to UTC Date object
 * @param {string} value - Date string in format YYYY-MM-DD
 * @returns {Date|null}
 */
export function toUtcDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Get today's date as YYYY-MM-DD string
 * @returns {string}
 */
export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculate day difference between two dates
 * @param {string} fromDateString - Start date YYYY-MM-DD
 * @param {string} toDateString - End date YYYY-MM-DD
 * @returns {number|null} Number of days difference
 */
export function calculateDayDifference(fromDateString, toDateString) {
  const fromDate = toUtcDate(fromDateString);
  const toDate = toUtcDate(toDateString);
  if (!fromDate || !toDate) {
    return null;
  }
  const diffMs = fromDate.getTime() - toDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format notification date for display
 * @param {string|Date} value - Date to format
 * @returns {string} Formatted date string (pl-PL locale)
 */
export function formatNotificationDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format review date for display
 * @param {string|Date} value - Date to format
 * @returns {string} Formatted date string (pl-PL locale, long format)
 */
export function formatReviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Get default daily streak object
 * @returns {Object}
 */
export function getDefaultDailyStreak() {
  return {
    current: 0,
    best: 0,
    lastCompletedDate: null,
  };
}

/**
 * Normalize daily streak data from raw input
 * @param {Object} raw - Raw streak data
 * @returns {Object} Normalized streak object
 */
export function normalizeDailyStreak(raw) {
  if (!raw || typeof raw !== 'object') {
    return getDefaultDailyStreak();
  }

  const current = Number.isFinite(raw.current) ? Math.max(0, Math.floor(raw.current)) : 0;
  const bestCandidate = Number.isFinite(raw.best) ? Math.max(0, Math.floor(raw.best)) : 0;
  const best = Math.max(bestCandidate, current);
  const lastCompletedDate =
    typeof raw.lastCompletedDate === 'string' && raw.lastCompletedDate.trim()
      ? raw.lastCompletedDate.trim()
      : null;

  return {
    current,
    best,
    lastCompletedDate,
  };
}
