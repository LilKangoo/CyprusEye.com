import { loadComments, addComment, editComment, deleteComment, replyToComment } from './comments.js';
import { likeComment, unlikeComment, getLikesCount, hasUserLiked } from './likes.js';
import { uploadPhotos, deletePhoto, getCommentPhotos } from './photos.js';
import { initNotifications, updateNotificationBadge } from './notifications.js';
import { getRatingStats, getUserRating, ratePlace, renderRatingSummary, renderRatingBreakdown, initInteractiveStars } from './ratings.js';

// ===================================
// GLOBALS & STATE
// ===================================
let currentPoiId = null;
let currentPoiIndex = -1;
let filteredPoisData = []; // POIs after filtering/sorting
let currentUser = null;
let communityMap = null;
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
    
    // Initialize map if Leaflet is available
    if (typeof L !== 'undefined') {
      initMap();
    }

    // Update community stats
    await updateCommunityStats();

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
    // Try to load from assets/pois.json
    const response = await fetch('/assets/pois.json');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        poisData = data;
        console.log(`✅ Loaded ${poisData.length} POIs from pois.json`);
        return;
      }
    }
    
    // Fallback to app.js places if available
    if (window.places && Array.isArray(window.places) && window.places.length > 0) {
      poisData = window.places.map(p => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lon: p.lng || p.lon,
        description: p.description
      }));
      console.log(`✅ Loaded ${poisData.length} POIs from window.places`);
      return;
    }
    
    // If no data available, show error
    console.error('❌ No POI data available');
    window.showToast?.('Nie można załadować miejsc', 'error');
    
  } catch (error) {
    console.error('❌ Error loading POI data:', error);
    window.showToast?.('Błąd ładowania danych', 'error');
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
      .select('id, username, name, avatar_url')
      .eq('id', currentUser.id)
      .single();

    if (error) throw error;

    if (data) {
      currentUser.profile = data;
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
  
  if (avatarEl && currentUser?.profile) {
    avatarEl.src = currentUser.profile.avatar_url || DEFAULT_AVATAR;
    avatarEl.alt = currentUser.profile.username || currentUser.profile.name || 'User';
  }
  
  if (nameEl && currentUser?.profile) {
    nameEl.textContent = currentUser.profile.username || currentUser.profile.name || 'Użytkownik';
  }
}

// ===================================
// VIEW TOGGLE (List/Map)
// ===================================
function initViewToggle() {
  const listBtn = document.getElementById('listViewBtn');
  const mapBtn = document.getElementById('mapViewBtn');
  const listSection = document.getElementById('listViewSection');
  const mapSection = document.getElementById('mapViewSection');

  listBtn?.addEventListener('click', () => {
    listBtn.classList.add('active');
    mapBtn.classList.remove('active');
    listSection.hidden = false;
    mapSection.hidden = true;
  });

  mapBtn?.addEventListener('click', () => {
    mapBtn.classList.add('active');
    listBtn.classList.remove('active');
    mapSection.hidden = false;
    listSection.hidden = true;
    
    // Initialize map if not already initialized
    if (!communityMap && typeof L !== 'undefined') {
      setTimeout(() => initMap(), 100);
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
      
      const popupContent = `
        <div style="text-align: center;">
          <strong>${poi.name}</strong><br>
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
        <h3 class="empty-state-title">Brak dostępnych miejsc</h3>
        <p class="empty-state-description">Miejsca pojawią się wkrótce</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Ładowanie miejsc...</p></div>';

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
              <h3 class="poi-card-name">${poi.name}</h3>
              <p class="poi-card-location">🗺️ Cypr</p>
            </div>
          </div>
          
          <div class="poi-card-stats">
            <div class="poi-stat">
              <span class="poi-stat-icon">💬</span>
              <span id="comments-count-${poi.id}">0 komentarzy</span>
            </div>
            <div class="poi-stat">
              <span class="poi-stat-icon">📷</span>
              <span id="photos-count-${poi.id}">0 zdjęć</span>
            </div>
          </div>
          
          <div class="poi-card-rating" id="rating-${poi.id}">
            <!-- Rating will be loaded here -->
          </div>

          <div id="latest-comment-${poi.id}"></div>

          <button class="poi-card-action">
            Zobacz komentarze
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
        commentsEl.textContent = `${commentCount || 0} komentarzy`;
      }
      if (photosEl) {
        photosEl.textContent = `${photoCount} zdjęć`;
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

  form?.addEventListener('submit', handleCommentSubmit);
  photoInput?.addEventListener('change', handlePhotoSelect);
}

// ===================================
// OPEN COMMENTS MODAL
// ===================================
window.openPoiComments = async function(poiId) {
  console.log('🔓 Opening modal for POI:', poiId);
  
  currentPoiId = poiId;
  
  // Find POI index in filtered data for navigation
  const dataToSearch = filteredPoisData.length > 0 ? filteredPoisData : poisData;
  currentPoiIndex = dataToSearch.findIndex(p => p.id === poiId);
  
  const poi = poisData.find(p => p.id === poiId);
  
  if (!poi) {
    console.error('❌ POI not found:', poiId);
    return;
  }

  // Update modal title
  document.getElementById('commentsModalTitle').textContent = poi.name;
  document.getElementById('commentsModalLocation').textContent = `📍 ${poi.description || 'Cypr'}`;

  // Update navigation buttons
  updateNavigationButtons();

  // Show/hide auth sections
  updateAuthSections();

  // Show modal
  const modal = document.getElementById('commentsModal');
  modal.hidden = false;
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  
  console.log('✅ Modal opened for:', poi.name);

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
          window.showToast?.(`Oceniłeś to miejsce na ${rating} gwiazdek!`, 'success');
          
          // Update prompt
          if (ratingPrompt) {
            ratingPrompt.textContent = `Twoja ocena: ${rating}★`;
            ratingPrompt.classList.add('rated');
          }
          
          // Reload rating stats
          await loadAndRenderRating(poiId);
        }
      });
      
      // Update prompt based on current rating
      if (ratingPrompt) {
        if (userRating) {
          ratingPrompt.textContent = `Twoja ocena: ${userRating}★`;
          ratingPrompt.classList.add('rated');
        } else {
          ratingPrompt.textContent = 'Kliknij na gwiazdki aby ocenić';
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
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Ładowanie komentarzy...</p></div>';

  try {
    const comments = await loadComments(poiId);
    
    if (!comments || comments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <h3 class="empty-state-title">Brak komentarzy</h3>
          <p class="empty-state-description">Bądź pierwszy, który podzieli się wrażeniami!</p>
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
        <h3 class="empty-state-title">Błąd wczytywania</h3>
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
  const sb = window.getSupabase();
  
  // Get user profile
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('username, name, avatar_url')
    .eq('id', comment.user_id)
    .single();

  if (profileError) {
    console.error('Error fetching profile for comment:', profileError);
  }

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
  
  console.log(`👤 Comment by user ${comment.user_id}: username="${profile?.username}", name="${profile?.name}", displaying as: "${displayName}"`);
  
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
            <span class="comment-author-name">${username}</span>
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
                ✏️ Edytuj
              </button>
              <button class="comment-menu-item danger" onclick="window.deleteCommentUI('${comment.id}')">
                🗑️ Usuń
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
            💬 Odpowiedz
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
    submitBtn.textContent = 'Wysyłanie...';

    // Add comment
    const comment = await addComment(currentPoiId, content, null);

    if (!comment) {
      throw new Error('Nie udało się dodać komentarza');
    }

    // Upload photos if any
    if (selectedPhotos.length > 0) {
      submitBtn.textContent = 'Wysyłanie zdjęć...';
      await uploadPhotos(selectedPhotos, comment.id);
    }

    // Reset form
    resetCommentForm();

    // Reload comments
    submitBtn.textContent = 'Odświeżanie...';
    await loadAndRenderComments(currentPoiId);

    // Update stats
    await loadPoisStats([poisData.find(p => p.id === currentPoiId)].filter(Boolean));

    window.showToast?.('Komentarz dodany!', 'success');

  } catch (error) {
    console.error('Error submitting comment:', error);
    const errorMsg = error.message || 'Błąd dodawania komentarza';
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
      window.showToast?.('Można wgrać tylko zdjęcia', 'error');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.showToast?.('Zdjęcie jest za duże (max 5MB)', 'error');
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
    submitBtn.textContent = 'Opublikuj';
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
        <button type="submit" class="btn btn-primary primary">Zapisz</button>
        <button type="button" class="btn" onclick="window.cancelEditComment('${commentId}', \`${currentContent}\`)">Anuluj</button>
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
    window.showToast?.('Komentarz nie może być pusty', 'error');
    return;
  }

  try {
    await editComment(commentId, newContent);
    await loadAndRenderComments(currentPoiId);
    window.showToast?.('Komentarz zaktualizowany', 'success');
  } catch (error) {
    console.error('Error editing comment:', error);
    window.showToast?.('Błąd edycji komentarza', 'error');
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
  if (!confirm('Czy na pewno chcesz usunąć ten komentarz?')) return;

  try {
    await deleteComment(commentId);
    await loadAndRenderComments(currentPoiId);
    window.showToast?.('Komentarz usunięty', 'success');
  } catch (error) {
    console.error('Error deleting comment:', error);
    window.showToast?.('Błąd usuwania komentarza', 'error');
  }
};

// ===================================
// TOGGLE LIKE
// ===================================
window.toggleLike = async function(commentId) {
  if (!currentUser) {
    window.showToast?.('Musisz być zalogowany', 'error');
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
    window.showToast?.('Błąd przy polubieniu', 'error');
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
      <textarea class="comment-textarea" placeholder="Napisz odpowiedź..." rows="2" required></textarea>
      <div class="add-comment-actions">
        <button type="submit" class="btn btn-primary primary">Odpowiedz</button>
        <button type="button" class="btn" onclick="window.cancelReply('${commentId}')">Anuluj</button>
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
    window.showToast?.('Odpowiedź dodana!', 'success');
  } catch (error) {
    console.error('Error replying:', error);
    window.showToast?.('Błąd dodawania odpowiedzi', 'error');
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
    const sb = window.getSupabase();

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

    document.getElementById('totalComments').textContent = totalComments || 0;
    document.getElementById('totalPhotos').textContent = totalPhotos || 0;
    document.getElementById('activeUsers').textContent = uniqueUsers || 0;

  } catch (error) {
    console.error('Error updating stats:', error);
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

console.log('✅ Community UI module loaded');
