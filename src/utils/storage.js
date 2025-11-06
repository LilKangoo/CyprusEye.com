/**
 * Storage Utilities
 * Safe wrappers for localStorage and sessionStorage operations
 */

const STORAGE_KEYS = {
  ACCOUNTS: 'wakacjecypr-accounts',
  REVIEWS: 'wakacjecypr-reviews',
  NOTIFICATIONS: 'wakacjecypr-notifications',
  JOURNAL: 'wakacjecypr-journal-entries',
  SELECTED_PLACE: 'wakacjecypr-selected-place-redirect',
};

/**
 * Safe localStorage getter
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*}
 */
export function getFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
}

/**
 * Safe localStorage setter
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} Success status
 */
export function setToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing to localStorage (${key}):`, error);
    return false;
  }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 */
export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from localStorage (${key}):`, error);
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearAppStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing app storage:', error);
  }
}

/**
 * Check if localStorage is available
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get storage size in bytes (approximate)
 * @returns {number}
 */
export function getStorageSize() {
  try {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return total;
  } catch (error) {
    return 0;
  }
}

export { STORAGE_KEYS };
