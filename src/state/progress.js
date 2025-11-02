/**
 * Progress State Management
 * Handles user progress, XP, levels, badges
 */

import store from './store.js';
import { getFromStorage, setToStorage } from '../utils/storage.js';

// Storage key
export const PROGRESS_STORAGE_KEY = 'wakacjecypr-progress';

/**
 * Get default progress object
 * @returns {Object}
 */
export function getDefaultProgress() {
  return {
    xp: 0,
    badges: [],
    visited: [],
    tasksCompleted: [],
    reviewRewards: {},
    dailyStreak: {
      current: 0,
      best: 0,
      lastCompletedDate: null,
    },
    dailyChallenge: {
      placeId: null,
      assignedAt: null,
      completedAt: null,
      completedOn: null,
    },
  };
}

/**
 * Calculate XP required for a level
 * @param {number} level - Target level
 * @returns {number}
 */
export function xpRequiredForLevel(level) {
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
export function calculateLevelFromXp(xp) {
  if (!Number.isFinite(xp) || xp < 0) {
    return 1;
  }
  
  let level = 1;
  let totalXpNeeded = 0;
  
  while (totalXpNeeded + xpRequiredForLevel(level) <= xp) {
    totalXpNeeded += xpRequiredForLevel(level);
    level++;
  }
  
  return level;
}

/**
 * Load progress from localStorage
 * @returns {Object}
 */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      return getDefaultProgress();
    }
    
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return getDefaultProgress();
    }
    
    return {
      xp: Number.isFinite(parsed.xp) ? Math.max(0, parsed.xp) : 0,
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
      tasksCompleted: Array.isArray(parsed.tasksCompleted) ? parsed.tasksCompleted : [],
      reviewRewards: parsed.reviewRewards && typeof parsed.reviewRewards === 'object' 
        ? parsed.reviewRewards 
        : {},
      dailyStreak: parsed.dailyStreak || getDefaultProgress().dailyStreak,
      dailyChallenge: parsed.dailyChallenge || getDefaultProgress().dailyChallenge,
    };
  } catch (error) {
    console.error('Error loading progress:', error);
    return getDefaultProgress();
  }
}

/**
 * Save progress to localStorage and update store
 * @param {Object} progress - Progress object
 */
export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    store.setState('progress', progress);
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

/**
 * Initialize progress in store from storage
 * @returns {Object}
 */
export function initializeProgressState() {
  const progress = loadProgress();
  store.setState('progress', progress);
  return progress;
}

/**
 * Get current progress from store
 * @returns {Object}
 */
export function getProgress() {
  return store.getState('progress') || getDefaultProgress();
}

/**
 * Subscribe to progress changes
 * @param {Function} callback - Callback(newProgress, oldProgress)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToProgress(callback) {
  return store.subscribe('progress', callback);
}

/**
 * Award XP and save
 * @param {number} amount - XP amount
 * @returns {Object} Updated progress
 */
export function awardXp(amount) {
  const progress = getProgress();
  const newXp = progress.xp + Math.max(0, Math.floor(amount));
  const updated = { ...progress, xp: newXp };
  saveProgress(updated);
  return updated;
}

/**
 * Remove XP and save
 * @param {number} amount - XP amount to remove
 * @returns {Object} Updated progress
 */
export function removeXp(amount) {
  const progress = getProgress();
  const newXp = Math.max(0, progress.xp - Math.max(0, Math.floor(amount)));
  const updated = { ...progress, xp: newXp };
  saveProgress(updated);
  return updated;
}

/**
 * Mark place as visited
 * @param {string} placeId - Place ID
 * @returns {Object} Updated progress
 */
export function markPlaceVisited(placeId) {
  const progress = getProgress();
  if (!progress.visited.includes(placeId)) {
    const updated = {
      ...progress,
      visited: [...progress.visited, placeId],
    };
    saveProgress(updated);
    return updated;
  }
  return progress;
}

/**
 * Mark task as completed
 * @param {string} taskId - Task ID
 * @returns {Object} Updated progress
 */
export function markTaskCompleted(taskId) {
  const progress = getProgress();
  if (!progress.tasksCompleted.includes(taskId)) {
    const updated = {
      ...progress,
      tasksCompleted: [...progress.tasksCompleted, taskId],
    };
    saveProgress(updated);
    return updated;
  }
  return progress;
}

/**
 * Add badge
 * @param {string} badgeId - Badge ID
 * @returns {Object} Updated progress
 */
export function addBadge(badgeId) {
  const progress = getProgress();
  if (!progress.badges.includes(badgeId)) {
    const updated = {
      ...progress,
      badges: [...progress.badges, badgeId],
    };
    saveProgress(updated);
    return updated;
  }
  return progress;
}

/**
 * Reset progress to default
 * @returns {Object} Reset progress
 */
export function resetProgress() {
  const fresh = getDefaultProgress();
  saveProgress(fresh);
  return fresh;
}
