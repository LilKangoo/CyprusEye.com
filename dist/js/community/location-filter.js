// ===================================
// Location Filter Module
// Handles filtering community content by POI location
// ===================================

/**
 * Get the location parameter from URL
 * @returns {string|null} Location ID or null
 */
export function getLocationFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('location');
}

/**
 * Set location filter in URL without page reload
 * @param {string|null} locationId - POI ID to filter by
 */
export function setLocationFilter(locationId) {
  const url = new URL(window.location.href);
  if (locationId) {
    url.searchParams.set('location', locationId);
  } else {
    url.searchParams.delete('location');
  }
  window.history.pushState({}, '', url);
}

/**
 * Check if content should be shown for current location filter
 * @param {string} contentLocationId - Location ID from content
 * @returns {boolean} True if should be shown
 */
export function shouldShowContent(contentLocationId) {
  const filterLocation = getLocationFromURL();
  
  // No filter - show all content
  if (!filterLocation) return true;
  
  // Filter active - only show matching content
  return contentLocationId === filterLocation;
}

/**
 * Initialize location filter UI
 */
export function initLocationFilter() {
  const locationId = getLocationFromURL();
  
  if (locationId) {
    console.log(`🗺️ Filtrowanie społeczności dla lokalizacji: ${locationId}`);
    
    // Show filter badge
    showLocationFilterBadge(locationId);
    
    // Filter existing content
    filterExistingContent(locationId);
  }
}

/**
 * Show location filter badge in UI
 * @param {string} locationId - POI ID
 */
function showLocationFilterBadge(locationId) {
  const badge = document.createElement('div');
  badge.id = 'location-filter-badge';
  badge.className = 'location-filter-badge';
  badge.innerHTML = `
    <div class="badge-content">
      <span class="badge-icon">📍</span>
      <span class="badge-text">Filtr: ${locationId}</span>
      <button class="badge-close" onclick="window.clearLocationFilter()">×</button>
    </div>
  `;
  
  // Insert at top of community container
  const container = document.querySelector('.community-container') || document.body;
  container.insertBefore(badge, container.firstChild);
}

/**
 * Clear location filter
 */
window.clearLocationFilter = function() {
  setLocationFilter(null);
  window.location.reload();
};

/**
 * Filter existing content on page
 * @param {string} locationId - POI ID to filter by
 */
function filterExistingContent(locationId) {
  // Hide content that doesn't match
  const allPosts = document.querySelectorAll('[data-location]');
  let visibleCount = 0;
  
  allPosts.forEach(post => {
    const postLocation = post.getAttribute('data-location');
    if (postLocation === locationId) {
      post.style.display = '';
      visibleCount++;
    } else {
      post.style.display = 'none';
    }
  });
  
  console.log(`✅ Filtrowanie zakończone: ${visibleCount} postów widocznych`);
  
  // Show "no content" message if needed
  if (visibleCount === 0) {
    showNoContentMessage(locationId);
  }
}

/**
 * Show "no content" message
 * @param {string} locationId - POI ID
 */
function showNoContentMessage(locationId) {
  const message = document.createElement('div');
  message.className = 'no-content-message';
  message.innerHTML = `
    <div class="no-content-card">
      <div class="no-content-icon">📸</div>
      <h3>Brak treści dla tego miejsca</h3>
      <p>Bądź pierwszy i dodaj zdjęcie lub komentarz dla <strong>${locationId}</strong>!</p>
      <button class="btn btn-primary" onclick="window.clearLocationFilter()">
        Zobacz wszystkie miejsca
      </button>
    </div>
  `;
  
  const container = document.querySelector('.community-container') || document.body;
  container.appendChild(message);
}

// Add CSS for filter badge
const style = document.createElement('style');
style.textContent = `
  .location-filter-badge {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    padding: 12px 20px;
    margin: 16px 0;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    animation: slideDown 0.3s ease-out;
  }
  
  .badge-content {
    display: flex;
    align-items: center;
    gap: 12px;
    color: white;
    font-weight: 600;
  }
  
  .badge-icon {
    font-size: 20px;
  }
  
  .badge-text {
    flex: 1;
    font-size: 15px;
  }
  
  .badge-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    transition: background 0.2s;
  }
  
  .badge-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .no-content-message {
    padding: 40px 20px;
    text-align: center;
  }
  
  .no-content-card {
    background: white;
    border-radius: 16px;
    padding: 40px;
    max-width: 500px;
    margin: 0 auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
  
  .no-content-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }
  
  .no-content-card h3 {
    font-size: 24px;
    margin-bottom: 12px;
    color: #1f2937;
  }
  
  .no-content-card p {
    font-size: 16px;
    color: #6b7280;
    margin-bottom: 24px;
    line-height: 1.5;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLocationFilter);
} else {
  initLocationFilter();
}

console.log('✅ Location filter module loaded');
