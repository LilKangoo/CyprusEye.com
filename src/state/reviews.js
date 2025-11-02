/**
 * Reviews State Management
 * Handles user reviews and ratings storage
 */

import store from './store.js';
import { getFromStorage, setToStorage } from '../utils/storage.js';

// Storage key
export const REVIEWS_STORAGE_KEY = 'wakacjecypr-reviews';

/**
 * Sanitize review object
 * @param {Object} raw - Raw review
 * @returns {Object|null}
 */
export function sanitizeReview(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const placeId = typeof raw.placeId === 'string' && raw.placeId.trim() ? raw.placeId.trim() : null;
  if (!placeId) {
    return null;
  }

  const rating = Number.isFinite(raw.rating) ? Math.max(0, Math.min(5, Math.floor(raw.rating))) : 0;
  const comment = typeof raw.comment === 'string' ? raw.comment.trim() : '';
  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt.trim()
      ? raw.createdAt.trim()
      : new Date().toISOString();
  const authorName = typeof raw.authorName === 'string' ? raw.authorName.trim() : '';

  return {
    placeId,
    rating,
    comment,
    createdAt,
    authorName,
    photo: typeof raw.photo === 'string' && raw.photo.trim() ? raw.photo.trim() : null,
  };
}

/**
 * Load reviews from localStorage
 * @returns {Array}
 */
export function loadReviewsFromStorage() {
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(sanitizeReview).filter(Boolean);
  } catch (error) {
    console.error('Error loading reviews:', error);
    return [];
  }
}

/**
 * Persist reviews to localStorage and update store
 * @param {Array} reviews - Reviews array
 */
export function persistReviews(reviews) {
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
    store.setState('reviews', reviews);
  } catch (error) {
    console.error('Error saving reviews:', error);
  }
}

/**
 * Get reviews for a place
 * @param {string} placeId - Place ID
 * @param {Array} reviewsArray - Reviews array (defaults to store)
 * @returns {Array}
 */
export function getReviewsForPlace(placeId, reviewsArray) {
  if (!placeId) {
    return [];
  }

  const reviews = reviewsArray || store.getState('reviews') || [];
  return reviews.filter((r) => r.placeId === placeId);
}

/**
 * Add review
 * @param {Object} review - Review object
 * @param {Array} reviewsArray - Reviews array (defaults to store)
 * @returns {Array} Updated reviews
 */
export function addReview(review, reviewsArray) {
  const sanitized = sanitizeReview(review);
  if (!sanitized) {
    return reviewsArray || [];
  }

  const reviews = reviewsArray || store.getState('reviews') || [];
  const updated = [...reviews, sanitized];
  
  persistReviews(updated);
  return updated;
}

/**
 * Update review
 * @param {string} placeId - Place ID
 * @param {string} authorName - Author name
 * @param {Object} updates - Updates object
 * @param {Array} reviewsArray - Reviews array (defaults to store)
 * @returns {Array} Updated reviews
 */
export function updateReview(placeId, authorName, updates, reviewsArray) {
  if (!placeId || !authorName) {
    return reviewsArray || [];
  }

  const reviews = reviewsArray || store.getState('reviews') || [];
  const updated = reviews.map((r) =>
    r.placeId === placeId && r.authorName === authorName
      ? { ...r, ...updates }
      : r
  );

  persistReviews(updated);
  return updated;
}

/**
 * Delete review
 * @param {string} placeId - Place ID
 * @param {string} authorName - Author name
 * @param {Array} reviewsArray - Reviews array (defaults to store)
 * @returns {Array} Updated reviews
 */
export function deleteReview(placeId, authorName, reviewsArray) {
  if (!placeId || !authorName) {
    return reviewsArray || [];
  }

  const reviews = reviewsArray || store.getState('reviews') || [];
  const updated = reviews.filter(
    (r) => !(r.placeId === placeId && r.authorName === authorName)
  );

  persistReviews(updated);
  return updated;
}

/**
 * Get average rating for place
 * @param {string} placeId - Place ID
 * @param {Array} reviewsArray - Reviews array (defaults to store)
 * @returns {number}
 */
export function getAverageRating(placeId, reviewsArray) {
  const placeReviews = getReviewsForPlace(placeId, reviewsArray);
  if (placeReviews.length === 0) {
    return 0;
  }

  const sum = placeReviews.reduce((acc, r) => acc + r.rating, 0);
  return sum / placeReviews.length;
}

/**
 * Initialize reviews in store from storage
 * @returns {Array}
 */
export function initializeReviewsState() {
  const reviews = loadReviewsFromStorage();
  store.setState('reviews', reviews);
  return reviews;
}

/**
 * Subscribe to reviews changes
 * @param {Function} callback - Callback(newReviews, oldReviews)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToReviews(callback) {
  return store.subscribe('reviews', callback);
}
