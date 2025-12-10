import { loadComments, addComment, editComment, deleteComment, replyToComment } from './comments.js';
import { likeComment, unlikeComment, getLikesCount, hasUserLiked } from './likes.js';
import { uploadPhotos, deletePhoto, getCommentPhotos } from './photos.js';
import { initNotifications, updateNotificationBadge } from './notifications.js';
import { getRatingStats, getUserRating, ratePlace, renderRatingSummary, renderRatingBreakdown, initInteractiveStars } from './ratings.js';
import { t, formatCommentCount, formatPhotoCount } from './i18nHelper.js';

// ===================================
// GLOBALS & STATE
// ===================================
let currentPoiId = null;
let currentPoiIndex = -1;
let filteredPoisData = []; // POIs after filtering/sorting
let currentUser = null;
let communityMap = null;
let poiMiniMap = null; // Mini-map in modal
let userLocationMarker = null;
let currentUserLocation = null;
let selectedPhotos = [];
let isEditMode = false;
let editingCommentId = null;

// POI Data - będzie załadowane z app.js lub pois.json
let poisData = [];

// Lightbox state
let lightboxPhotos = [];
let currentLightboxIndex = 0;

// Default avatar (logo)
const DEFAULT_AVATAR = '/assets/cyprus_logo-1000x1054.png';

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Community UI initializing...');
  
  try {
    // Get Supabase client
    const sb = window.getSupabase?.();
    if (!sb) {
      console.error('Supabase client not available');
      return;
    }

    // Get current user
    const { data: { user } } = await sb.auth.getUser();
    currentUser = user;
    
    if (currentUser) {
      console.log('✅ User authenticated:', currentUser.id);
      await loadUserProfile();
      initNotifications(currentUser.id);
    } else {
      console.log('ℹ️ No user authenticated');
    }

    // Load POI data
    await loadPoisData();
    
    // Initialize UI components
    initViewToggle();
    initSearch();
    initModal();
    initLightbox();
    renderPoisList();
    
    // Map view removed. Ranking initialized on demand.

    // Update community stats (only if stats elements exist on page)
    if (document.getElementById('totalComments') || 
        document.getElementById('totalPhotos') || 
        document.getElementById('activeUsers')) {
      await updateCommunityStats().catch(err => {
        console.warn('Stats update failed (non-critical):', err.message);
      });
    }

    console.log('✅ Community UI initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Community UI:', error);
  }
});

// ===================================
// LOAD POI DATA
// ===================================
async function loadPoisData() {
  try {
    // Wait for PLACES_DATA to load (from poi-loader.js)
    let attempts = 0;
    while ((!Array.isArray(window.PLACES_DATA) || window.PLACES_DATA.length === 0) && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    // Use PLACES_DATA if available (loaded by poi-loader.js from Supabase)
    if (window.PLACES_DATA && Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length > 0) {
      // Use full POI objects to preserve i18n fields (name_i18n, description_i18n, badge_i18n)
      poisData = window.PLACES_DATA.map(p => ({
        ...p,  // Keep ALL fields from PLACES_DATA
        // Ensure lon/lng compatibility
        lon: p.lng || p.lon,
        // Add backward compatibility fields
        name: p.name || p.nameFallback || p.id,
        description: p.description || p.descriptionFallback || '',
        badge: p.badge || p.badgeFallback || '',
        xp: p.xp || 100,
        source: p.source || 'supabase'
      }));
      console.log(`✅ Loaded ${poisData.length} POIs from PLACES_DATA (${poisData[0]?.source || 'unknown'})`);
      console.log('📍 POI IDs:', poisData.map(p => p.id));
      console.log('🌍 POIs with i18n:', poisData.filter(p => p.name_i18n).length);
      
      // Listen for updates
      window.addEventListener('poisDataRefreshed', (event) => {
        console.log('🔄 POIs refreshed, reloading...');
        loadPoisData().then(() => {
          renderPoisList();
          if (communityMap) initMap();
        });
      });
      
      return;
    }
    
    // Fallback to assets/pois.json
    try {
      const response = await fetch('/assets/pois.json');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          poisData = data;
          console.log(`✅ Loaded ${poisData.length} POIs from pois.json (fallback)`);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load from pois.json:', e);
    }
    
    // If no data available, show error
    console.error('❌ No POI data available');
    window.showToast?.('Nie można załadować miejsc', 'error');
    
  } catch (error) {
    console.error('❌ Error loading POI data:', error);
    window.showToast?.(t('community.error.loading'), 'error');
  }
}

// ===================================
// LOAD USER PROFILE
// ===================================
async function loadUserProfile() {
  try {
    const sb = window.getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('id, username, name, avatar_url, level, xp')
      .eq('id', currentUser.id)
      .single();

    if (error) throw error;

    if (data) {
      currentUser.profile = data;
      console.log('✅ User profile loaded:', { username: data.username, level: data.level, xp: data.xp });
      updateUserAvatar();
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// ===================================
// UPDATE USER AVATAR IN FORM
// ===================================
function updateUserAvatar() {
  const avatarEl = document.getElementById('currentUserAvatar');
  const nameEl = document.getElementById('currentUserName');
  const headerAvatar = document.getElementById('headerUserAvatar');
  
  if (avatarEl && currentUser?.profile) {
    avatarEl.src = currentUser.profile.avatar_url || DEFAULT_AVATAR;
    avatarEl.alt = currentUser.profile.username || currentUser.profile.name || 'User';
  }
  
  if (nameEl && currentUser?.profile) {
    nameEl.textContent = currentUser.profile.username || currentUser.profile.name || 'Użytkownik';
  }
  
  // Update header avatar in profile button
  if (headerAvatar && currentUser?.profile) {
    headerAvatar.src = currentUser.profile.avatar_url || DEFAULT_AVATAR;
    headerAvatar.alt = currentUser.profile.username || currentUser.profile.name || 'User';
  }
}

// ===================================
// VIEW TOGGLE (List/Ranking)
// ===================================
function initViewToggle() {
  const listBtn = document.getElementById('listViewBtn');
  const rankingBtn = document.getElementById('rankingViewBtn');
  const listSection = document.getElementById('listViewSection');
  const rankingSection = document.getElementById('rankingViewSection');

  listBtn?.addEventListener('click', () => {
    listBtn.classList.add('active');
    rankingBtn?.classList.remove('active');
    if (listSection) listSection.hidden = false;
    if (rankingSection) rankingSection.hidden = true;
  });

  rankingBtn?.addEventListener('click', async () => {
    rankingBtn.classList.add('active');
    listBtn?.classList.remove('active');
    if (rankingSection) rankingSection.hidden = false;
    if (listSection) listSection.hidden = true;

    // Lazy-init ranking module
    try {
      if (!window.communityRanking?.initialized) {
        // If module is not loaded by the page yet, try dynamic import
        if (!window.communityRanking) {
          try {
            await import('./ranking.js');
          } catch (e) {
            console.warn('Ranking module dynamic import failed (may already be loaded by HTML):', e?.message);
          }
        }
        await window.communityRanking?.init();
      }
    } catch (e) {
      console.error('Error initializing ranking:', e);
      window.showToast?.('Nie można załadować rankingu', 'error');
    }
  });
}

// ===================================
// INITIALIZE MAP
// ===================================
function initMap() {
  if (communityMap) return;
  
  const mapContainer = document.getElementById('communityMap');
  if (!mapContainer) return;

  try {
    // Center on Cyprus
    communityMap = L.map('communityMap').setView([34.9, 33.0], 9);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(communityMap);

    // Add POI markers
    poisData.forEach(poi => {
      const marker = L.marker([poi.lat, poi.lon || poi.lng]).addTo(communityMap);
      
      const poiName = window.getPoiName ? window.getPoiName(poi) : poi.name;
      const popupContent = `
        <div style="text-align: center;">
          <strong>${poiName}</strong><br>
          <button class="map-comment-btn" data-poi-id="${poi.id}"
                  style="margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
            💬 Zobacz komentarze
          </button>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      
      // Add click listener to button after popup opens
      marker.on('popupopen', () => {
        const btn = document.querySelector('.map-comment-btn[data-poi-id="' + poi.id + '"]');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.openPoiComments(poi.id);
          });
        }
      });
    });

    console.log('✅ Map initialized with', poisData.length, 'markers');
  } catch (error) {
    console.error('❌ Error initializing map:', error);
  }
}

// ===================================
// RENDER POIs LIST
// ===================================
async function renderPoisList() {
  const listContainer = document.getElementById('poisList');
  if (!listContainer) return;

  if (poisData.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🗺️</div>
        <h3 class="empty-state-title">${t('community.empty.noPlaces')}</h3>
        <p class="empty-state-description">${t('community.empty.soon')}</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>${t('community.loading')}</p></div>`;

  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase not available');
    
    // Render POI cards without stats first (faster)
    let html = '';
    for (const poi of poisData) {
      html += `
        <div class="poi-card" data-poi-id="${poi.id}">
          <div class="poi-card-header">
            <div class="poi-card-icon">📍</div>
            <div class="poi-card-info">
              <h3 class="poi-card-name">${window.getPoiName ? window.getPoiName(poi) : poi.name}</h3>
              <p class="poi-card-location">🗺️ Cypr</p>
            </div>
          </div>
          
          <div class="poi-card-stats">
            <div class="poi-stat">
              <span class="poi-stat-icon">💬</span>
              <span id="comments-count-${poi.id}">${formatCommentCount(0)}</span>
            </div>
            <div class="poi-stat">
              <span class="poi-stat-icon">📷</span>
              <span id="photos-count-${poi.id}">${formatPhotoCount(0)}</span>
            </div>
          </div>
          
          <div class="poi-card-rating" id="rating-${poi.id}">
            <!-- Rating will be loaded here -->
          </div>

          <div id="latest-comment-${poi.id}"></div>

          <button class="poi-card-action">
            ${t('community.viewComments')}
          </button>
        </div>
      `;
    }

    listContainer.innerHTML = html;
    
    // Initialize filtered data with all POIs
    filteredPoisData = [...poisData];

    // Add click listeners AFTER rendering (safer than onclick)
    setTimeout(() => {
      document.querySelectorAll('.poi-card').forEach(card => {
        card.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const poiId = this.dataset.poiId;
          if (poiId) {
            window.openPoiComments(poiId);
          }
        });
      });
    }, 100);

    // Load stats in background (non-blocking)
    loadPoisStats(poisData);

  } catch (error) {
    console.error('Error rendering POIs list:', error);
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Błąd wczytywania</h3>
        <p class="empty-state-description">${error.message}</p>
      </div>
    `;
  }
}

// ===================================
// LOAD POI STATS IN BACKGROUND
// ===================================
async function loadPoisStats(pois) {
  const sb = window.getSupabase();
  if (!sb) return;

  for (const poi of pois) {
    try {
      // Get comment count
      const { count: commentCount } = await sb
        .from('poi_comments')
        .select('*', { count: 'exact', head: true })
        .eq('poi_id', poi.id)
        .is('parent_comment_id', null);

      // Get photo count - first get comment IDs, then count photos
      const { data: comments } = await sb
        .from('poi_comments')
        .select('id')
        .eq('poi_id', poi.id);

      let photoCount = 0;
      if (comments && comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        const { count } = await sb
          .from('poi_comment_photos')
          .select('*', { count: 'exact', head: true })
          .in('comment_id', commentIds);
        photoCount = count || 0;
      }

      // Update UI
      const commentsEl = document.getElementById(`comments-count-${poi.id}`);
      const photosEl = document.getElementById(`photos-count-${poi.id}`);
      const card = document.querySelector(`[data-poi-id="${poi.id}"]`);
      
      if (commentsEl) {
        commentsEl.textContent = formatCommentCount(commentCount || 0);
      }
      if (photosEl) {
        photosEl.textContent = formatPhotoCount(photoCount);
      }
      
      // Update card data attributes for sorting
      if (card) {
        card.dataset.commentCount = commentCount || 0;
      }
      
      // Get and display rating stats
      const ratingStats = await getRatingStats(poi.id);
      if (ratingStats && card) {
        const ratingContainer = card.querySelector(`#rating-${poi.id}`);
        if (ratingContainer) {
          ratingContainer.innerHTML = renderRatingSummary(ratingStats);
        }
        // Store average rating for sorting
        card.dataset.averageRating = ratingStats.average_rating || 0;
      }

      // Get latest comment
      if (commentCount > 0) {
        const { data: latestComment } = await sb
          .from('poi_comments')
          .select('content, created_at')
          .eq('poi_id', poi.id)
          .is('parent_comment_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestComment) {
          const latestEl = document.getElementById(`latest-comment-${poi.id}`);
          if (latestEl) {
            latestEl.innerHTML = `
              <div class="poi-card-preview">
                <p class="poi-latest-comment">"${latestComment.content}"</p>
              </div>
            `;
          }
          
          // Update card data attribute with timestamp for sorting
          if (card) {
            card.dataset.lastCommentTime = new Date(latestComment.created_at).getTime();
          }
        }
      }
    } catch (error) {
      console.error(`Error loading stats for ${poi.id}:`, error);
      // Continue with next POI
    }
  }
}

// ===================================
// SEARCH & SORT
// ===================================
function initSearch() {
  const searchInput = document.getElementById('poiSearchInput');
  const sortSelect = document.getElementById('poiSortSelect');

  searchInput?.addEventListener('input', filterPois);
  sortSelect?.addEventListener('change', filterPois);
}

function filterPois() {
  const searchTerm = document.getElementById('poiSearchInput')?.value.toLowerCase() || '';
  const sortBy = document.getElementById('poiSortSelect')?.value || 'recent';
  
  const listContainer = document.getElementById('poisList');
  const cards = Array.from(document.querySelectorAll('.poi-card'));
  
  // Filter by search term
  const filteredCards = cards.filter(card => {
    const name = card.querySelector('.poi-card-name')?.textContent.toLowerCase() || '';
    return name.includes(searchTerm);
  });
  
  // Sort cards
  filteredCards.sort((a, b) => {
    if (sortBy === 'alphabetical') {
      const nameA = a.querySelector('.poi-card-name')?.textContent || '';
      const nameB = b.querySelector('.poi-card-name')?.textContent || '';
      return nameA.localeCompare(nameB, 'pl');
    } 
    else if (sortBy === 'popular') {
      // Sort by average rating (stars)
      const ratingA = parseFloat(a.dataset.averageRating || '0');
      const ratingB = parseFloat(b.dataset.averageRating || '0');
      return ratingB - ratingA; // descending (highest rating first)
    } 
    else if (sortBy === 'recent') {
      const timeA = parseInt(a.dataset.lastCommentTime || '0');
      const timeB = parseInt(b.dataset.lastCommentTime || '0');
      return timeB - timeA; // descending (newest first)
    }
    return 0;
  });
  
  // Update filtered POIs array for navigation
  filteredPoisData = filteredCards.map(card => {
    const poiId = card.dataset.poiId;
    return poisData.find(p => p.id === poiId);
  }).filter(Boolean);
  
  // Hide all cards first
  cards.forEach(card => card.style.display = 'none');
  
  // Show and reorder filtered cards
  filteredCards.forEach(card => {
    card.style.display = 'block';
    listContainer.appendChild(card); // Move to end (reorder)
  });
  
  console.log(`✅ Filtered: ${filteredCards.length}/${cards.length} cards, sorted by: ${sortBy}`);
}

// ===================================
// MODAL INITIALIZATION
// ===================================
function initModal() {
  const modal = document.getElementById('commentsModal');
  const closeBtn = document.getElementById('closeCommentsModal');
  const prevBtn = document.getElementById('prevPoiBtn');
  const nextBtn = document.getElementById('nextPoiBtn');
  const form = document.getElementById('addCommentForm');
  const photoInput = document.getElementById('photoUploadInput');

  // CRITICAL: Ensure modal is closed on init
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('hidden', '');
    console.log('🔒 Modal locked in closed state on init');
  }

  closeBtn?.addEventListener('click', closeModal);
  prevBtn?.addEventListener('click', navigateToPrevPoi);
  nextBtn?.addEventListener('click', navigateToNextPoi);
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC key to close modal, arrow keys for navigation
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'ArrowLeft') {
      navigateToPrevPoi();
    } else if (e.key === 'ArrowRight') {
      navigateToNextPoi();
    }
  });

  // Touch swipe for mobile navigation
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipeDistance = 50;

  modal?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  modal?.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const swipeDistance = touchEndX - touchStartX;
    
    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        navigateToPrevPoi(); // Swipe right = previous
      } else {
        navigateToNextPoi(); // Swipe left = next
      }
    }
  }, { passive: true });

  form?.addEventListener('submit', handleCommentSubmit);
  photoInput?.addEventListener('change', handlePhotoSelect);
}

// ===================================
// OPEN COMMENTS MODAL
// ===================================
window.openPoiComments = async function(poiId) {
  console.log('🔓 Opening modal for POI:', poiId);
  
  if (!poiId) {
    console.error('❌ No POI ID provided');
    return;
  }
  
  // Wait for POI data to load (up to 5 seconds)
  let attempts = 0;
  while (poisData.length === 0 && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
    
    // Try to reload from window.PLACES_DATA if available
    if (window.PLACES_DATA && Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length > 0) {
      await loadPoisData();
    }
  }
  
  if (poisData.length === 0) {
    console.error('❌ POI data not loaded after waiting');
    window.showToast?.('Nie można załadować danych miejsc', 'error');
    return;
  }
  
  // Try multiple matching strategies to find the POI
  let poi = null;
  
  // 1. Exact ID match
  poi = poisData.find(p => p.id === poiId);
  
  // 2. Case-insensitive ID match
  if (!poi) {
    poi = poisData.find(p => p.id?.toLowerCase() === poiId?.toLowerCase());
  }
  
  // 3. Try matching by name slug (convert name to slug and compare)
  if (!poi) {
    const normalizeSlug = (str) => str?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const searchSlug = normalizeSlug(poiId);
    poi = poisData.find(p => {
      const nameSlug = normalizeSlug(p.name);
      return nameSlug === searchSlug;
    });
  }
  
  // 4. Partial match in ID or name
  if (!poi) {
    const searchLower = poiId.toLowerCase();
    poi = poisData.find(p => 
      p.id?.toLowerCase().includes(searchLower) || 
      p.name?.toLowerCase().includes(searchLower)
    );
  }
  
  if (!poi) {
    // Log to console for debugging but don't spam with errors
    console.warn('⚠️ POI not found:', poiId);
    console.debug('Tried matching strategies: exact, case-insensitive, slug, partial');
    console.debug('Available POIs:', poisData.length, 'loaded');
    
    // Only log available IDs in debug mode to avoid console clutter
    if (window.location.search.includes('debug')) {
      console.log('Available POI IDs:', poisData.map(p => `${p.id} (${p.name})`));
    }
    
    // Silently skip - don't show error toast
    // This prevents spamming user with errors for old/invalid links or notifications
    return;
  }
  
  // Use the found POI's actual ID for consistency
  currentPoiId = poi.id;

  // Base name/description using global POI helpers
  let poiName = window.getPoiName ? window.getPoiName(poi) : poi.name;
  let poiDesc = window.getPoiDescription ? window.getPoiDescription(poi) : (poi.description || 'Cypr');

  // Try to override with static i18n JSON if available (places.<id>.name/description)
  const nameKey = `places.${poi.id}.name`;
  const descKey = `places.${poi.id}.description`;
  const translatedName = t(nameKey);
  const translatedDesc = t(descKey);

  if (translatedName && translatedName !== nameKey) {
    poiName = translatedName;
  }

  if (translatedDesc && translatedDesc !== descKey) {
    poiDesc = translatedDesc;
  }
  console.log('✅ Found POI:', poiName, '(ID:', poi.id, ')');
  
  // Find POI index in filtered data for navigation
  const dataToSearch = filteredPoisData.length > 0 ? filteredPoisData : poisData;
  currentPoiIndex = dataToSearch.findIndex(p => p.id === poi.id);

  // Update modal title
  document.getElementById('commentsModalTitle').textContent = poiName;
  document.getElementById('commentsModalLocation').textContent = `📍 ${poiDesc}`;

  // Update navigation buttons
  updateNavigationButtons();

  // Show/hide auth sections
  updateAuthSections();

  // Show modal
  const modal = document.getElementById('commentsModal');
  modal.hidden = false;
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  
  console.log('✅ Modal opened for:', poiName);

  // Initialize mini-map with POI location
  initPoiMiniMap(poi);

  // Load ratings
  await loadAndRenderRating(poiId);

  // Load comments
  await loadAndRenderComments(poiId);
};

// ===================================
// LOAD AND RENDER RATING
// ===================================
async function loadAndRenderRating(poiId) {
  try {
    // Get rating stats
    const stats = await getRatingStats(poiId);
    
    // Display overall rating
    const ratingDisplay = document.getElementById('ratingDisplay');
    if (ratingDisplay) {
      ratingDisplay.innerHTML = renderRatingSummary(stats);
    }
    
    // Display rating breakdown
    const ratingBreakdown = document.getElementById('ratingBreakdown');
    if (ratingBreakdown) {
      ratingBreakdown.innerHTML = renderRatingBreakdown(stats);
    }
    
    // Show interactive rating if user is logged in
    const ratingInteractive = document.getElementById('ratingInteractive');
    const ratingStarsContainer = document.getElementById('ratingStarsContainer');
    const ratingPrompt = document.getElementById('ratingPrompt');
    
    if (currentUser && ratingStarsContainer) {
      // Get user's current rating
      const userRating = await getUserRating(poiId, currentUser.id);
      
      // Show interactive stars
      if (ratingInteractive) {
        ratingInteractive.hidden = false;
      }
      
      // Initialize interactive stars
      initInteractiveStars(ratingStarsContainer, userRating || 0, async (rating) => {
        const success = await ratePlace(poiId, currentUser.id, rating);
        if (success) {
          window.showToast?.(t('community.rating.yourRating', { rating: `${rating}` }), 'success');
          
          // Update prompt
          if (ratingPrompt) {
            ratingPrompt.textContent = t('community.rating.yourRating', { rating });
            ratingPrompt.classList.add('rated');
          }
          
          // Reload rating stats
          await loadAndRenderRating(poiId);
        }
      });
      
      // Update prompt based on current rating
      if (ratingPrompt) {
        if (userRating) {
          ratingPrompt.textContent = t('community.rating.yourRating', { rating: userRating });
          ratingPrompt.classList.add('rated');
        } else {
          ratingPrompt.textContent = t('community.rating.prompt');
          ratingPrompt.classList.remove('rated');
        }
      }
    } else {
      // Hide interactive rating if not logged in
      if (ratingInteractive) {
        ratingInteractive.hidden = true;
      }
    }
  } catch (error) {
    console.error('Error loading rating:', error);
  }
}

// ===================================
// NAVIGATION BETWEEN POIS
// ===================================
function updateNavigationButtons() {
  const dataToUse = filteredPoisData.length > 0 ? filteredPoisData : poisData;
  const prevBtn = document.getElementById('prevPoiBtn');
  const nextBtn = document.getElementById('nextPoiBtn');
  
  if (prevBtn) {
    prevBtn.disabled = currentPoiIndex <= 0;
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPoiIndex >= dataToUse.length - 1;
  }
}

function navigateToPrevPoi() {
  const dataToUse = filteredPoisData.length > 0 ? filteredPoisData : poisData;
  if (currentPoiIndex > 0) {
    const prevPoi = dataToUse[currentPoiIndex - 1];
    if (prevPoi) {
      window.openPoiComments(prevPoi.id);
    }
  }
}

function navigateToNextPoi() {
  const dataToUse = filteredPoisData.length > 0 ? filteredPoisData : poisData;
  if (currentPoiIndex < dataToUse.length - 1) {
    const nextPoi = dataToUse[currentPoiIndex + 1];
    if (nextPoi) {
      window.openPoiComments(nextPoi.id);
    }
  }
}

// ===================================
// CLOSE MODAL
// ===================================
function closeModal() {
  console.log('🔒 Closing modal');
  const modal = document.getElementById('commentsModal');
  modal.hidden = true;
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';
  currentPoiId = null;
  currentPoiIndex = -1;
  resetCommentForm();
  
  // Cleanup mini-map to prevent memory leaks
  cleanupPoiMiniMap();
  
  console.log('✅ Modal closed');
}

// ===================================
// UPDATE AUTH SECTIONS
// ===================================
function updateAuthSections() {
  const authRequired = document.querySelector('[data-auth-required]');
  const commentForm = document.getElementById('addCommentForm');

  if (currentUser) {
    authRequired.hidden = true;
    commentForm.hidden = false;
    updateUserAvatar();
  } else {
    authRequired.hidden = false;
    commentForm.hidden = true;
  }
}

// ===================================
// LOAD AND RENDER COMMENTS
// ===================================
async function loadAndRenderComments(poiId) {
  const container = document.getElementById('commentsList');
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>${t('community.comments.loading')}</p></div>`;

  try {
    const comments = await loadComments(poiId);
    
    if (!comments || comments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <h3 class="empty-state-title">${t('community.comments.noComments')}</h3>
          <p class="empty-state-description">${t('community.comments.beFirst')}</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const comment of comments) {
      html += await renderComment(comment);
    }
    
    container.innerHTML = html;
    
    // Add lightbox click handlers to photos
    setTimeout(() => {
      container.querySelectorAll('.comment-photos').forEach(photoContainer => {
        const photos = JSON.parse(photoContainer.dataset.commentPhotos || '[]');
        photoContainer.querySelectorAll('.comment-photo').forEach(img => {
          img.addEventListener('click', () => {
            const index = parseInt(img.dataset.photoIndex);
            window.openLightbox(photos, index);
          });
        });
      });
    }, 100);

  } catch (error) {
    console.error('Error loading comments:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">${t('community.error.loading')}</h3>
        <p class="empty-state-description">${error.message}</p>
      </div>
    `;
  }
}

// ===================================
// UTILITY: ESCAPE HTML
// ===================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===================================
// RENDER SINGLE COMMENT
// ===================================
async function renderComment(comment, isReply = false) {
  // Use profile data from JOIN (already loaded in loadComments)
  const profile = comment.profiles;
  
  // Debug: Log full profile structure
  console.log('🔍 Full comment profile data:', {
    comment_id: comment.id,
    user_id: comment.user_id,
    profile: profile,
    has_level: profile?.level !== undefined,
    level_value: profile?.level
  });
  
  // Priority: username > name > fallback
  let displayName = 'Użytkownik';
  if (profile) {
    if (profile.username && profile.username.trim()) {
      displayName = profile.username;
    } else if (profile.name && profile.name.trim()) {
      displayName = profile.name;
    }
  }
  
  const username = escapeHtml(displayName);
  const avatar = profile?.avatar_url || DEFAULT_AVATAR;
  const userLevel = profile?.level || 1;
  
  console.log(`👤 Comment render: user="${displayName}", level=${userLevel}, avatar=${avatar ? 'set' : 'default'}`);
  
  // Get likes info
  const likesCount = await getLikesCount(comment.id);
  const userLiked = currentUser ? await hasUserLiked(comment.id, currentUser.id) : false;

  // Get photos
  const photos = await getCommentPhotos(comment.id);

  // Time ago
  const timeAgo = formatTimeAgo(comment.created_at);

  // Check if user owns this comment
  const isOwner = currentUser?.id === comment.user_id;

  let html = `
    <div class="comment-item ${isReply ? 'reply-item' : ''}" data-comment-id="${comment.id}">
      <div class="comment-header">
        <div class="comment-author">
          <img src="${avatar}" alt="${username}" class="comment-author-avatar" />
          <div class="comment-author-info">
            <div class="comment-author-name-row">
              <span class="comment-author-name">${username}</span>
              <span class="comment-author-level">Lvl ${userLevel}</span>
            </div>
            <span class="comment-timestamp">
              ${timeAgo}
              ${comment.is_edited ? '<span class="comment-edited">(edytowano)</span>' : ''}
            </span>
          </div>
        </div>
        ${isOwner ? `
          <div class="comment-actions-menu">
            <button class="comment-menu-btn" onclick="window.toggleCommentMenu('${comment.id}')">⋮</button>
            <div id="menu-${comment.id}" class="comment-menu-dropdown" hidden>
              <button class="comment-menu-item" onclick="window.editCommentUI('${comment.id}')">
                ${t('community.action.edit')}
              </button>
              <button class="comment-menu-item danger" onclick="window.deleteCommentUI('${comment.id}')">
                ${t('community.action.delete')}
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="comment-content" id="content-${comment.id}">
        ${escapeHtml(comment.content)}
      </div>

      ${photos.length > 0 ? `
        <div class="comment-photos" data-comment-photos='${JSON.stringify(photos)}'>
          ${photos.map((p, idx) => `
            <img src="${p.photo_url}" alt="Photo" class="comment-photo" 
                 data-photo-index="${idx}" />
          `).join('')}
        </div>
      ` : ''}

      <div class="comment-footer">
        <button class="comment-like-btn ${userLiked ? 'liked' : ''}" 
                onclick="window.toggleLike('${comment.id}')">
          ${userLiked ? '❤️' : '🤍'} ${likesCount > 0 ? likesCount : ''}
        </button>
        ${!isReply && currentUser ? `
          <button class="comment-reply-btn" onclick="window.replyToCommentUI('${comment.id}')">
            ${t('community.action.reply')}
          </button>
        ` : ''}
      </div>

      <div id="reply-form-${comment.id}" hidden></div>

      ${comment.replies && comment.replies.length > 0 ? `
        <div class="comment-replies">
          ${await Promise.all(comment.replies.map(r => renderComment(r, true))).then(r => r.join(''))}
        </div>
      ` : ''}
    </div>
  `;

  return html;
}

// ===================================
// COMMENT SUBMIT
// ===================================
async function handleCommentSubmit(e) {
  e.preventDefault();
  
  if (!currentUser) {
    window.showToast?.('Musisz być zalogowany', 'error');
    return;
  }

  if (!currentPoiId) {
    window.showToast?.('Nie wybrano miejsca', 'error');
    return;
  }

  const textarea = document.getElementById('commentTextarea');
  const content = textarea.value.trim();

  if (!content) {
    window.showToast?.('Wpisz treść komentarza', 'error');
    textarea.focus();
    return;
  }

  if (content.length < 3) {
    window.showToast?.('Komentarz jest za krótki (min. 3 znaki)', 'error');
    textarea.focus();
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = t('community.comment.sending');

    // Add comment
    const comment = await addComment(currentPoiId, content, null);

    if (!comment) {
      throw new Error('Nie udało się dodać komentarza');
    }

    // Upload photos if any
    if (selectedPhotos.length > 0) {
      submitBtn.textContent = t('community.comment.sendingPhotos');
      await uploadPhotos(selectedPhotos, comment.id);
    }

    // Reset form
    resetCommentForm();

    // Reload comments
    submitBtn.textContent = t('community.comment.refreshing');
    await loadAndRenderComments(currentPoiId);

    // Update stats
    await loadPoisStats([poisData.find(p => p.id === currentPoiId)].filter(Boolean));

    window.showToast?.(t('community.success.replyAdded'), 'success');

  } catch (error) {
    console.error('Error submitting comment:', error);
    const errorMsg = error.message || t('community.error.addComment');
    window.showToast?.(errorMsg, 'error');
    
    // Re-enable button
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ===================================
// PHOTO SELECTION
// ===================================
function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  
  if (files.length === 0) return;

  // Validate files
  const validFiles = files.filter(file => {
    if (!file.type.startsWith('image/')) {
      window.showToast?.(t('community.error.addComment'), 'error');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.showToast?.(t('community.error.addComment'), 'error');
      return false;
    }
    return true;
  });

  selectedPhotos = [...selectedPhotos, ...validFiles].slice(0, 5);
  renderPhotoPreview();
}

// ===================================
// RENDER PHOTO PREVIEW
// ===================================
function renderPhotoPreview() {
  const container = document.getElementById('commentPhotosPreview');
  
  if (selectedPhotos.length === 0) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = selectedPhotos.map((file, index) => `
    <div class="photo-preview-item">
      <img src="${URL.createObjectURL(file)}" alt="Preview" class="photo-preview-img" />
      <button type="button" class="photo-preview-remove" onclick="window.removePhoto(${index})">×</button>
    </div>
  `).join('');
}

// ===================================
// REMOVE PHOTO FROM SELECTION
// ===================================
window.removePhoto = function(index) {
  selectedPhotos.splice(index, 1);
  renderPhotoPreview();
};

// ===================================
// RESET COMMENT FORM
// ===================================
function resetCommentForm() {
  document.getElementById('commentTextarea').value = '';
  selectedPhotos = [];
  renderPhotoPreview();
  const submitBtn = document.querySelector('#addCommentForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = false;
    // Use translated label instead of hardcoded Polish
    submitBtn.textContent = t('community.comment.submit');
  }
}

// ===================================
// TOGGLE COMMENT MENU
// ===================================
window.toggleCommentMenu = function(commentId) {
  const menu = document.getElementById(`menu-${commentId}`);
  if (!menu) return;
  
  // Close all other menus first
  document.querySelectorAll('.comment-menu-dropdown').forEach(m => {
    if (m.id !== `menu-${commentId}`) {
      m.hidden = true;
    }
  });
  
  menu.hidden = !menu.hidden;
};

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.comment-actions-menu')) {
    document.querySelectorAll('.comment-menu-dropdown').forEach(m => {
      m.hidden = true;
    });
  }
});

// ===================================
// EDIT COMMENT UI
// ===================================
window.editCommentUI = async function(commentId) {
  // Close menu
  window.toggleCommentMenu(commentId);
  
  const contentEl = document.getElementById(`content-${commentId}`);
  const currentContent = contentEl.textContent.trim();

  contentEl.innerHTML = `
    <form class="edit-comment-form" onsubmit="window.saveEditComment(event, '${commentId}')">
      <textarea class="edit-comment-textarea" rows="3">${currentContent}</textarea>
      <div class="edit-comment-actions">
        <button type="submit" class="btn btn-primary primary">${t('community.action.save')}</button>
        <button type="button" class="btn" onclick="window.cancelEditComment('${commentId}', \`${currentContent}\`)">${t('community.action.cancel')}</button>
      </div>
    </form>
  `;
};

// ===================================
// SAVE EDIT COMMENT
// ===================================
window.saveEditComment = async function(e, commentId) {
  e.preventDefault();
  
  const textarea = e.target.querySelector('textarea');
  const newContent = textarea.value.trim();

  if (!newContent) {
    window.showToast?.(t('community.error.editComment'), 'error');
    return;
  }

  try {
    await editComment(commentId, newContent);
    await loadAndRenderComments(currentPoiId);
    window.showToast?.(t('community.success.commentUpdated'), 'success');
  } catch (error) {
    console.error('Error editing comment:', error);
    window.showToast?.(t('community.error.editComment'), 'error');
  }
};

// ===================================
// CANCEL EDIT
// ===================================
window.cancelEditComment = function(commentId, originalContent) {
  const contentEl = document.getElementById(`content-${commentId}`);
  contentEl.textContent = originalContent;
};

// ===================================
// DELETE COMMENT UI
// ===================================
window.deleteCommentUI = async function(commentId) {
  if (!confirm(t('community.error.deleteComment'))) return;

  try {
    await deleteComment(commentId);
    await loadAndRenderComments(currentPoiId);
    window.showToast?.(t('community.success.commentDeleted'), 'success');
  } catch (error) {
    console.error('Error deleting comment:', error);
    window.showToast?.(t('community.error.deleteComment'), 'error');
  }
};

// ===================================
// TOGGLE LIKE
// ===================================
window.toggleLike = async function(commentId) {
  if (!currentUser) {
    window.showToast?.(t('community.auth.required'), 'error');
    return;
  }

  try {
    const userLiked = await hasUserLiked(commentId, currentUser.id);
    
    if (userLiked) {
      await unlikeComment(commentId, currentUser.id);
    } else {
      await likeComment(commentId, currentUser.id);
    }

    // Update UI
    await loadAndRenderComments(currentPoiId);

  } catch (error) {
    console.error('Error toggling like:', error);
    window.showToast?.(t('community.error.like'), 'error');
  }
};

// ===================================
// REPLY TO COMMENT
// ===================================
window.replyToCommentUI = function(commentId) {
  const formContainer = document.getElementById(`reply-form-${commentId}`);
  
  if (!formContainer.hidden) {
    formContainer.hidden = true;
    formContainer.innerHTML = '';
    return;
  }

  formContainer.hidden = false;
  formContainer.innerHTML = `
    <form class="add-comment-form" onsubmit="window.submitReply(event, '${commentId}')" style="margin-top: 1rem;">
      <textarea class="comment-textarea" placeholder="${t('community.placeholder.reply')}" rows="2" required></textarea>
      <div class="add-comment-actions">
        <button type="submit" class="btn btn-primary primary">${t('community.action.respond')}</button>
        <button type="button" class="btn" onclick="window.cancelReply('${commentId}')">${t('community.action.cancel')}</button>
      </div>
    </form>
  `;
};

// ===================================
// SUBMIT REPLY
// ===================================
window.submitReply = async function(e, parentCommentId) {
  e.preventDefault();
  
  const textarea = e.target.querySelector('textarea');
  const content = textarea.value.trim();

  if (!content) return;

  try {
    await replyToComment(currentPoiId, content, parentCommentId);
    await loadAndRenderComments(currentPoiId);
    window.showToast?.(t('community.success.replyAdded'), 'success');
  } catch (error) {
    console.error('Error replying:', error);
    window.showToast?.(t('community.error.reply'), 'error');
  }
};

// ===================================
// CANCEL REPLY
// ===================================
window.cancelReply = function(commentId) {
  const formContainer = document.getElementById(`reply-form-${commentId}`);
  formContainer.hidden = true;
  formContainer.innerHTML = '';
};

// ===================================
// UPDATE COMMUNITY STATS
// ===================================
async function updateCommunityStats() {
  try {
    // Elements may not exist on some pages (e.g. homepage) – fail gracefully
    const totalCommentsEl = document.getElementById('totalComments');
    const totalPhotosEl = document.getElementById('totalPhotos');
    const activeUsersEl = document.getElementById('activeUsers');
    if (!totalCommentsEl && !totalPhotosEl && !activeUsersEl) {
      return; // Nothing to update on this page
    }

    const sb = window.getSupabase?.();
    if (!sb) return;

    // Total comments
    const { count: totalComments } = await sb
      .from('poi_comments')
      .select('*', { count: 'exact', head: true });

    // Total photos
    const { count: totalPhotos } = await sb
      .from('poi_comment_photos')
      .select('*', { count: 'exact', head: true });

    // Active users (unique commenters)
    const { data: users } = await sb
      .from('poi_comments')
      .select('user_id');
    
    const uniqueUsers = new Set(users?.map(u => u.user_id) || []).size;

    if (totalCommentsEl) totalCommentsEl.textContent = String(totalComments || 0);
    if (totalPhotosEl) totalPhotosEl.textContent = String(totalPhotos || 0);
    if (activeUsersEl) activeUsersEl.textContent = String(uniqueUsers || 0);

  } catch (error) {
    // Silently fail - stats are non-critical
    console.debug('Stats update skipped:', error.message);
  }
}

// ===================================
// UTILITY: FORMAT TIME AGO
// ===================================
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'przed chwilą';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min temu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} godz. temu`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} dni temu`;
  
  return date.toLocaleDateString('pl-PL');
}

// ===================================
// PHOTO LIGHTBOX
// ===================================
function initLightbox() {
  const lightbox = document.getElementById('photoLightbox');
  const closeBtn = document.getElementById('closeLightbox');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');

  closeBtn?.addEventListener('click', closeLightbox);
  prevBtn?.addEventListener('click', () => navigateLightbox(-1));
  nextBtn?.addEventListener('click', () => navigateLightbox(1));

  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (lightbox && !lightbox.hidden) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    }
  });

  // Touch swipe for mobile lightbox navigation
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipeDistance = 50;

  lightbox?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox?.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const swipeDistance = touchEndX - touchStartX;
    
    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        navigateLightbox(-1); // Swipe right = previous
      } else {
        navigateLightbox(1); // Swipe left = next
      }
    }
  }, { passive: true });
}

window.openLightbox = function(photos, index = 0) {
  lightboxPhotos = photos;
  currentLightboxIndex = index;
  showLightboxPhoto();
  
  const lightbox = document.getElementById('photoLightbox');
  if (lightbox) {
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }
};

function showLightboxPhoto() {
  if (lightboxPhotos.length === 0) return;
  
  const photo = lightboxPhotos[currentLightboxIndex];
  const image = document.getElementById('lightboxImage');
  const caption = document.getElementById('lightboxCaption');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');
  
  if (image) {
    image.src = photo.photo_url || photo;
    image.alt = `Zdjęcie ${currentLightboxIndex + 1} z ${lightboxPhotos.length}`;
  }
  
  if (caption) {
    caption.textContent = `${currentLightboxIndex + 1} / ${lightboxPhotos.length}`;
  }
  
  if (prevBtn) {
    prevBtn.disabled = currentLightboxIndex === 0;
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentLightboxIndex === lightboxPhotos.length - 1;
  }
}

function navigateLightbox(direction) {
  const newIndex = currentLightboxIndex + direction;
  if (newIndex >= 0 && newIndex < lightboxPhotos.length) {
    currentLightboxIndex = newIndex;
    showLightboxPhoto();
  }
}

function closeLightbox() {
  const lightbox = document.getElementById('photoLightbox');
  if (lightbox) {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }
  lightboxPhotos = [];
  currentLightboxIndex = 0;
}

// ===================================
// POI MINI-MAP & CHECK-IN
// ===================================

/**
 * Initialize mini-map in modal showing POI location and user position
 */
function initPoiMiniMap(poi) {
  const mapContainer = document.getElementById('poiMiniMap');
  const distanceEl = document.getElementById('poiDistance');
  const distanceIcon = document.getElementById('poiDistanceIcon');
  const checkInBtn = document.getElementById('modalCheckInBtn');
  const statusEl = document.getElementById('modalCheckInStatus');
  
  if (!mapContainer || !poi) return;
  
  // Check if POI has coordinates
  const poiLat = poi.lat;
  const poiLng = poi.lon || poi.lng;
  
  if (!poiLat || !poiLng) {
    mapContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-neutral-500);">Brak danych lokalizacji</div>';
    if (distanceEl) distanceEl.textContent = 'Lokalizacja niedostępna';
    return;
  }
  
  // Cleanup previous map instance
  cleanupPoiMiniMap();
  
  try {
    // Create mini-map centered on POI
    poiMiniMap = L.map('poiMiniMap', {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
      tap: false
    }).setView([poiLat, poiLng], 14);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
      maxZoom: 18
    }).addTo(poiMiniMap);
    
    // Add POI marker
    const poiName = window.getPoiName ? window.getPoiName(poi) : poi.name;
    const poiMarker = L.marker([poiLat, poiLng]).addTo(poiMiniMap);
    poiMarker.bindPopup(`<strong>${poiName}</strong>`).openPopup();
    
    console.log('🗺️ Mini-map initialized for:', poiName);
    
    // Get user location
    getUserLocationForMap(poi, poiLat, poiLng, distanceEl, distanceIcon, checkInBtn, statusEl);
    
  } catch (error) {
    console.error('❌ Error initializing mini-map:', error);
    mapContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-neutral-500);">Nie można załadować mapy</div>';
  }
}

/**
 * Get user's location and update map/distance
 */
function getUserLocationForMap(poi, poiLat, poiLng, distanceEl, distanceIcon, checkInBtn, statusEl) {
  if (!('geolocation' in navigator)) {
    if (distanceEl) {
      distanceEl.textContent = t('community.checkin.noGeo', 'Geolokalizacja niedostępna');
      distanceEl.className = 'poi-distance';
    }
    return;
  }
  
  if (distanceEl) {
    distanceEl.textContent = t('community.checkin.locating', 'Szukam Twojej lokalizacji...');
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      currentUserLocation = { lat: userLat, lng: userLng };
      
      // Calculate distance
      const distance = haversineDistance(userLat, userLng, poiLat, poiLng);
      const distanceKm = (distance / 1000).toFixed(2);
      const isNear = distance <= 500; // 500m radius for check-in
      
      // Update distance display
      if (distanceEl) {
        if (isNear) {
          distanceEl.textContent = t('community.checkin.near', `Jesteś ${Math.round(distance)}m od miejsca!`);
          distanceEl.className = 'poi-distance near';
          if (distanceIcon) distanceIcon.textContent = '✅';
        } else {
          distanceEl.textContent = t('community.checkin.far', `Odległość: ${distanceKm} km`);
          distanceEl.className = 'poi-distance far';
          if (distanceIcon) distanceIcon.textContent = '📍';
        }
      }
      
      // Add user marker to map
      if (poiMiniMap) {
        // Create custom user marker
        const userIcon = L.divIcon({
          className: 'user-location-marker-container',
          html: '<div class="user-location-pulse"></div><div class="user-location-marker"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        
        userLocationMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(poiMiniMap);
        userLocationMarker.bindPopup(t('community.checkin.you', 'Twoja lokalizacja'));
        
        // Fit bounds to show both markers
        const bounds = L.latLngBounds([
          [poiLat, poiLng],
          [userLat, userLng]
        ]);
        poiMiniMap.fitBounds(bounds, { padding: [30, 30] });
      }
      
      // Enable/disable check-in button based on distance and auth
      if (checkInBtn && currentUser) {
        checkInBtn.disabled = false;
        checkInBtn.onclick = () => handleModalCheckIn(poi, distance);
        
        // Check if already visited
        if (window.state?.visited?.has(poi.id)) {
          checkInBtn.disabled = true;
          checkInBtn.classList.add('checked');
          checkInBtn.innerHTML = '<span class="checkin-icon">✓</span><span>' + t('community.checkin.visited', 'Odwiedzone') + '</span>';
        }
      }
      
      console.log(`📍 User location: ${userLat}, ${userLng} - Distance: ${distanceKm}km`);
    },
    (error) => {
      console.warn('Geolocation error:', error);
      if (distanceEl) {
        let msg = t('community.checkin.error', 'Nie można pobrać lokalizacji');
        if (error.code === 1) msg = t('community.checkin.denied', 'Brak zgody na lokalizację');
        distanceEl.textContent = msg;
        distanceEl.className = 'poi-distance';
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371e3; // Earth radius in meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Handle check-in from modal
 */
async function handleModalCheckIn(poi, distance) {
  const statusEl = document.getElementById('modalCheckInStatus');
  const checkInBtn = document.getElementById('modalCheckInBtn');
  
  if (!currentUser) {
    if (statusEl) {
      statusEl.textContent = t('community.checkin.loginRequired', 'Zaloguj się, aby się zameldować');
      statusEl.className = 'check-in-status info';
    }
    return;
  }
  
  const radius = 500; // 500m radius
  
  if (distance > radius) {
    if (statusEl) {
      statusEl.textContent = t('community.checkin.tooFar', 'Jesteś za daleko od miejsca. Podejdź bliżej!');
      statusEl.className = 'check-in-status error';
    }
    return;
  }
  
  // Disable button during check-in
  if (checkInBtn) {
    checkInBtn.disabled = true;
    checkInBtn.innerHTML = '<span class="checkin-icon">⏳</span><span>Melduję...</span>';
  }
  
  try {
    // Use existing completeCheckIn from app.js if available
    if (typeof window.completeCheckIn === 'function') {
      await window.completeCheckIn(poi);
    } else {
      // Fallback: Direct Supabase call
      const sb = window.getSupabase?.();
      if (!sb) throw new Error('Supabase not available');
      
      // Add to visited POIs
      const { error } = await sb
        .from('user_poi_visits')
        .insert({
          user_id: currentUser.id,
          poi_id: poi.id,
          visited_at: new Date().toISOString()
        });
      
      if (error && error.code !== '23505') { // Ignore duplicate key error
        throw error;
      }
      
      // Award XP if function available
      if (typeof window.awardXp === 'function') {
        window.awardXp(poi.xp || 10);
      }
    }
    
    // Update UI
    if (statusEl) {
      statusEl.textContent = t('community.checkin.success', '🎉 Zameldowano! Zdobyłeś XP.');
      statusEl.className = 'check-in-status success';
    }
    
    if (checkInBtn) {
      checkInBtn.classList.add('checked');
      checkInBtn.innerHTML = '<span class="checkin-icon">✓</span><span>' + t('community.checkin.visited', 'Odwiedzone') + '</span>';
    }
    
    window.showToast?.(t('community.checkin.success', 'Zameldowano pomyślnie!'), 'success');
    console.log('✅ Check-in completed for:', poi.id);
    
  } catch (error) {
    console.error('❌ Check-in failed:', error);
    
    if (statusEl) {
      statusEl.textContent = t('community.checkin.failed', 'Nie udało się zameldować. Spróbuj ponownie.');
      statusEl.className = 'check-in-status error';
    }
    
    if (checkInBtn) {
      checkInBtn.disabled = false;
      checkInBtn.innerHTML = '<span class="checkin-icon">✓</span><span>' + t('community.checkin.button', 'Zamelduj się') + '</span>';
    }
  }
}

/**
 * Cleanup mini-map to prevent memory leaks
 */
function cleanupPoiMiniMap() {
  if (poiMiniMap) {
    try {
      poiMiniMap.remove();
    } catch (e) {
      console.warn('Error removing mini-map:', e);
    }
    poiMiniMap = null;
  }
  userLocationMarker = null;
  currentUserLocation = null;
  
  // Reset status elements
  const statusEl = document.getElementById('modalCheckInStatus');
  const distanceEl = document.getElementById('poiDistance');
  const checkInBtn = document.getElementById('modalCheckInBtn');
  
  if (statusEl) statusEl.textContent = '';
  if (distanceEl) distanceEl.textContent = t('community.checkin.loading', 'Ładowanie lokalizacji...');
  if (checkInBtn) {
    checkInBtn.disabled = true;
    checkInBtn.classList.remove('checked');
    checkInBtn.innerHTML = '<span class="checkin-icon">✓</span><span>' + t('community.checkin.button', 'Zamelduj się') + '</span>';
  }
}

// ===================================
// LISTEN TO AUTH STATE CHANGES
// ===================================
document.addEventListener('ce-auth:state', async (e) => {
  const { status, session } = e.detail;
  
  if (status === 'authenticated' && session?.user) {
    currentUser = session.user;
    await loadUserProfile();
    updateAuthSections();
    if (currentUserId) {
      initNotifications(currentUser.id);
    }
  } else if (status === 'signed-out') {
    currentUser = null;
    updateAuthSections();
  }
});

// Debug helpers - expose for troubleshooting
window.__debugCommunityUI = {
  getPoisData: () => poisData,
  getCurrentPoiId: () => currentPoiId,
  getFilteredPoisData: () => filteredPoisData,
  reloadPoisData: loadPoisData
};

console.log('✅ Community UI module loaded');
