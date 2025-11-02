/**
 * Data Processing Utilities
 * Pure functions for data transformation and formatting
 */

/**
 * Format currency in EUR
 * @param {number} amount - Amount in EUR
 * @returns {string}
 */
export function formatCurrencyEUR(amount) {
  if (!Number.isFinite(amount)) {
    return '€0.00';
  }
  return `€${amount.toFixed(2)}`;
}

/**
 * Format distance in kilometers
 * @param {number} meters - Distance in meters
 * @returns {string}
 */
export function formatDistanceKm(meters) {
  if (!Number.isFinite(meters) || meters < 0) {
    return '—';
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Calculate XP for next level
 * @param {number} level - Current level
 * @returns {number}
 */
export function calculateXpForLevel(level) {
  if (!Number.isFinite(level) || level < 1) {
    return 150;
  }
  return Math.floor(150 * Math.pow(1.5, level - 1));
}

/**
 * Calculate level from XP
 * @param {number} xp - Total XP
 * @returns {number}
 */
export function calculateLevel(xp) {
  if (!Number.isFinite(xp) || xp < 0) {
    return 1;
  }
  
  let level = 1;
  let totalXpNeeded = 0;
  
  while (totalXpNeeded + calculateXpForLevel(level) <= xp) {
    totalXpNeeded += calculateXpForLevel(level);
    level++;
  }
  
  return level;
}

/**
 * Format attraction count with pluralization
 * @param {number} count - Number of attractions
 * @returns {string}
 */
export function formatAttractionCount(count) {
  if (!Number.isFinite(count) || count < 0) {
    return '0 atrakcji';
  }
  
  if (count === 1) return '1 atrakcja';
  
  const remainder100 = count % 100;
  if (remainder100 >= 12 && remainder100 <= 14) return `${count} atrakcji`;
  
  const remainder10 = count % 10;
  if (remainder10 >= 2 && remainder10 <= 4) return `${count} atrakcje`;
  
  return `${count} atrakcji`;
}
