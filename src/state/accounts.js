/**
 * Account State Management
 * Handles user accounts storage and persistence
 */

import store from './store.js';
import { getFromStorage, setToStorage } from '../utils/storage.js';

// Storage key
export const ACCOUNT_STORAGE_KEY = 'wakacjecypr-accounts';

/**
 * Sanitize account profile data
 * @param {Object} profile - Raw profile data
 * @returns {Object|null}
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
 * Get default progress object
 * @returns {Object}
 */
function getDefaultProgress() {
  return {
    xp: 0,
    badges: [],
    visited: [],
    tasksCompleted: [],
    reviewRewards: {},
  };
}

/**
 * Normalize review rewards
 * @param {*} raw - Raw review rewards
 * @returns {Map}
 */
function normalizeReviewRewards(raw) {
  if (!raw || typeof raw !== 'object') {
    return new Map();
  }

  const entries = Object.entries(raw)
    .map(([key, value]) => {
      if (!value || typeof value !== 'object') {
        return null;
      }
      return [
        key,
        {
          rating: Boolean(value?.rating),
          comment: Boolean(value?.comment),
          photo: Boolean(value?.photo),
        },
      ];
    })
    .filter(Boolean);

  return new Map(entries);
}

/**
 * Load accounts from localStorage
 * @returns {Object} Accounts object
 */
export function loadAccountsFromStorage() {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const clean = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') {
        return;
      }

      const progress = value.progress && typeof value.progress === 'object'
        ? (() => {
            const normalizedRewards = normalizeReviewRewards(value.progress.reviewRewards);
            const reviewRewards = {};
            normalizedRewards.forEach((entry, key) => {
              reviewRewards[key] = {
                rating: Boolean(entry?.rating),
                comment: Boolean(entry?.comment),
                photo: Boolean(entry?.photo),
              };
            });

            return {
              xp: Number.isFinite(value.progress.xp) ? value.progress.xp : 0,
              badges: Array.isArray(value.progress.badges) ? value.progress.badges : [],
              visited: Array.isArray(value.progress.visited) ? value.progress.visited : [],
              tasksCompleted: Array.isArray(value.progress.tasksCompleted)
                ? value.progress.tasksCompleted
                : [],
              reviewRewards,
            };
          })()
        : getDefaultProgress();

      clean[key] = {
        username: typeof value.username === 'string' ? value.username : key,
        passwordHash: typeof value.passwordHash === 'string' ? value.passwordHash : '',
        progress,
        profile: sanitizeAccountProfile(value.profile),
      };
    });

    return clean;
  } catch (error) {
    console.error('Nie udało się wczytać kont graczy:', error);
    return {};
  }
}

/**
 * Persist accounts to localStorage and update store
 * @param {Object} accounts - Accounts object to persist
 */
export function persistAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
    store.setState('accounts', accounts);
  } catch (error) {
    console.error('Nie udało się zapisać kont graczy:', error);
  }
}

/**
 * Get account by key
 * @param {string} key - Account key (user ID or session key)
 * @param {Object} accountsObj - Accounts object (defaults to store)
 * @returns {Object|null}
 */
export function getAccount(key, accountsObj) {
  if (!key) {
    return null;
  }
  
  const accounts = accountsObj || store.getState('accounts') || {};
  return accounts[key] || null;
}

/**
 * Initialize accounts in store from storage
 */
export function initializeAccountsState() {
  const accounts = loadAccountsFromStorage();
  store.setState('accounts', accounts);
  return accounts;
}

/**
 * Subscribe to accounts changes
 * @param {Function} callback - Callback(newAccounts, oldAccounts)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAccounts(callback) {
  return store.subscribe('accounts', callback);
}
