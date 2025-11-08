// ===================================
// Ratings Module
// Handles place ratings (stars) with Supabase backend
// ===================================

import { t, formatRatingCount } from './i18nHelper.js';

/**
 * Get rating statistics for a place
 * @param {string} poiId - The POI ID
 * @returns {Promise<Object>} Rating statistics
 */
export async function getRatingStats(poiId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase not available');

    const { data, error } = await sb
      .from('poi_rating_stats')
      .select('*')
      .eq('poi_id', poiId)
      .maybeSingle();

    if (error) {
      // Log error but don't throw - ratings are optional
      console.warn('⚠️ Rating stats error (non-critical):', error.message || error);
      return {
        poi_id: poiId,
        total_ratings: 0,
        average_rating: 0,
        five_star: 0,
        four_star: 0,
        three_star: 0,
        two_star: 0,
        one_star: 0
      };
    }

    return data || {
      poi_id: poiId,
      total_ratings: 0,
      average_rating: 0,
      five_star: 0,
      four_star: 0,
      three_star: 0,
      two_star: 0,
      one_star: 0
    };
  } catch (error) {
    console.warn('⚠️ Rating stats exception (non-critical):', error.message || error);
    return {
      poi_id: poiId,
      total_ratings: 0,
      average_rating: 0
    };
  }
}

/**
 * Get user's rating for a place
 * @param {string} poiId - The POI ID
 * @param {string} userId - The user ID
 * @returns {Promise<number|null>} User's rating (1-5) or null if not rated
 */
export async function getUserRating(poiId, userId) {
  try {
    const sb = window.getSupabase();
    if (!sb || !userId) return null;

    const { data, error } = await sb
      .from('poi_ratings')
      .select('rating')
      .eq('poi_id', poiId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data?.rating || null;
  } catch (error) {
    console.error('Error getting user rating:', error);
    return null;
  }
}

/**
 * Add or update user's rating for a place
 * @param {string} poiId - The POI ID
 * @param {string} userId - The user ID
 * @param {number} rating - Rating value (1-5)
 * @returns {Promise<boolean>} Success status
 */
export async function ratePlace(poiId, userId, rating) {
  try {
    const sb = window.getSupabase();
    if (!sb || !userId) throw new Error('Authentication required');

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Upsert (insert or update if exists)
    const { error } = await sb
      .from('poi_ratings')
      .upsert({
        poi_id: poiId,
        user_id: userId,
        rating: rating
      }, {
        onConflict: 'poi_id,user_id'
      });

    if (error) throw error;

    console.log(`✅ Rating saved: ${rating} stars for ${poiId}`);
    return true;
  } catch (error) {
    console.error('Error saving rating:', error);
    window.showToast?.(t('community.error.saveRating'), 'error');
    return false;
  }
}

/**
 * Delete user's rating for a place
 * @param {string} poiId - The POI ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRating(poiId, userId) {
  try {
    const sb = window.getSupabase();
    if (!sb || !userId) throw new Error('Authentication required');

    const { error } = await sb
      .from('poi_ratings')
      .delete()
      .eq('poi_id', poiId)
      .eq('user_id', userId);

    if (error) throw error;

    console.log(`✅ Rating deleted for ${poiId}`);
    return true;
  } catch (error) {
    console.error('Error deleting rating:', error);
    return false;
  }
}

/**
 * Render star rating UI
 * @param {number} rating - Current rating (0-5)
 * @param {boolean} interactive - Whether stars are clickable
 * @param {Function} onClick - Click handler (star number)
 * @returns {string} HTML string
 */
export function renderStars(rating, interactive = false, onClick = null) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  let html = '<div class="star-rating' + (interactive ? ' interactive' : '') + '">';

  // Full stars
  for (let i = 1; i <= fullStars; i++) {
    html += `<span class="star star-full" data-rating="${i}">★</span>`;
  }

  // Half star
  if (hasHalfStar) {
    html += `<span class="star star-half" data-rating="${fullStars + 1}">★</span>`;
  }

  // Empty stars
  for (let i = fullStars + (hasHalfStar ? 1 : 0) + 1; i <= 5; i++) {
    html += `<span class="star star-empty" data-rating="${i}">☆</span>`;
  }

  html += '</div>';

  return html;
}

/**
 * Initialize interactive star rating
 * @param {HTMLElement} container - Container element
 * @param {number} currentRating - Current rating
 * @param {Function} onRate - Callback when user rates (rating)
 */
export function initInteractiveStars(container, currentRating, onRate) {
  if (!container) return;

  let hoveredRating = 0;

  container.innerHTML = renderStars(currentRating, true);

  const stars = container.querySelectorAll('.star');

  stars.forEach((star, index) => {
    const rating = index + 1;

    // Hover effect
    star.addEventListener('mouseenter', () => {
      hoveredRating = rating;
      updateStarsDisplay(rating);
    });

    // Click to rate
    star.addEventListener('click', () => {
      if (onRate) {
        onRate(rating);
      }
    });
  });

  // Reset on mouse leave
  container.addEventListener('mouseleave', () => {
    hoveredRating = 0;
    updateStarsDisplay(currentRating);
  });

  function updateStarsDisplay(rating) {
    stars.forEach((star, index) => {
      if (index < rating) {
        star.textContent = '★';
        star.className = 'star star-full';
      } else {
        star.textContent = '☆';
        star.className = 'star star-empty';
      }
    });
  }
}

/**
 * Render rating summary with stars and count
 * @param {Object} stats - Rating statistics
 * @returns {string} HTML string
 */
export function renderRatingSummary(stats) {
  if (!stats || stats.total_ratings === 0) {
    return `
      <div class="rating-summary">
        <div class="rating-stars">${renderStars(0)}</div>
        <span class="rating-text">${t('community.rating.noRatings')}</span>
      </div>
    `;
  }

  return `
    <div class="rating-summary">
      <div class="rating-stars">${renderStars(stats.average_rating)}</div>
      <span class="rating-value">${stats.average_rating.toFixed(1)}</span>
      <span class="rating-count">(${stats.total_ratings} ${formatRatingCount(stats.total_ratings)})</span>
    </div>
  `;
}

/**
 * Render detailed rating breakdown
 * @param {Object} stats - Rating statistics
 * @returns {string} HTML string
 */
export function renderRatingBreakdown(stats) {
  if (!stats || stats.total_ratings === 0) {
    return `<p class="rating-breakdown-empty">${t('community.rating.beFirst')}</p>`;
  }

  const total = stats.total_ratings;
  const bars = [
    { stars: 5, count: stats.five_star || 0 },
    { stars: 4, count: stats.four_star || 0 },
    { stars: 3, count: stats.three_star || 0 },
    { stars: 2, count: stats.two_star || 0 },
    { stars: 1, count: stats.one_star || 0 }
  ];

  let html = '<div class="rating-breakdown">';
  
  bars.forEach(bar => {
    const percentage = total > 0 ? (bar.count / total * 100).toFixed(0) : 0;
    html += `
      <div class="rating-bar-row">
        <span class="rating-bar-label">${bar.stars}★</span>
        <div class="rating-bar">
          <div class="rating-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <span class="rating-bar-count">${bar.count}</span>
      </div>
    `;
  });

  html += '</div>';
  
  return html;
}

console.log('✅ Ratings module loaded');
