import { loadComments, addComment, editComment, deleteComment, replyToComment } from './comments.js';
import { likeComment, unlikeComment, getLikesCount, hasUserLiked } from './likes.js';
import { uploadPhotos, deletePhoto, getCommentPhotos } from './photos.js';
import { initNotifications, updateNotificationBadge } from './notifications.js';

// ===================================
// GLOBALS & STATE
// ===================================
let currentPoiId = null;
let currentUser = null;
let communityMap = null;
let selectedPhotos = [];
let isEditMode = false;
let editingCommentId = null;

// POI Data - będzie załadowane z app.js lub pois.json
let poisData = [];

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
      poisData = await response.json();
      console.log(`✅ Loaded ${poisData.length} POIs`);
    } else {
      // Fallback to app.js places if available
      if (window.places && Array.isArray(window.places)) {
        poisData = window.places.map(p => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lon: p.lng || p.lon,
          description: p.description
        }));
        console.log(`✅ Loaded ${poisData.length} POIs from window.places`);
      } else {
        console.warn('⚠️ No POI data available');
      }
    }
  } catch (error) {
    console.error('❌ Error loading POI data:', error);
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
      
      marker.bindPopup(`
        <div style="text-align: center;">
          <strong>${poi.name}</strong><br>
          <button onclick="window.openPoiComments('${poi.id}')" 
                  style="margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
            💬 Zobacz komentarze
          </button>
        </div>
      `);
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
        <div class="poi-card" onclick="window.openPoiComments('${poi.id}')">
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

          <div id="latest-comment-${poi.id}"></div>

          <button class="poi-card-action">
            Zobacz komentarze
          </button>
        </div>
      `;
    }

    listContainer.innerHTML = html;

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
      
      if (commentsEl) {
        commentsEl.textContent = `${commentCount || 0} komentarzy`;
      }
      if (photosEl) {
        photosEl.textContent = `${photoCount} zdjęć`;
      }

      // Get latest comment
      if (commentCount > 0) {
        const { data: latestComment } = await sb
          .from('poi_comments')
          .select('content')
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
  
  const cards = document.querySelectorAll('.poi-card');
  
  cards.forEach(card => {
    const name = card.querySelector('.poi-card-name')?.textContent.toLowerCase() || '';
    const matches = name.includes(searchTerm);
    card.style.display = matches ? 'block' : 'none';
  });
}

// ===================================
// MODAL INITIALIZATION
// ===================================
function initModal() {
  const modal = document.getElementById('commentsModal');
  const closeBtn = document.getElementById('closeCommentsModal');
  const form = document.getElementById('addCommentForm');
  const photoInput = document.getElementById('photoUploadInput');

  closeBtn?.addEventListener('click', closeModal);
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form?.addEventListener('submit', handleCommentSubmit);
  photoInput?.addEventListener('change', handlePhotoSelect);
}

// ===================================
// OPEN COMMENTS MODAL
// ===================================
window.openPoiComments = async function(poiId) {
  currentPoiId = poiId;
  const poi = poisData.find(p => p.id === poiId);
  
  if (!poi) {
    console.error('POI not found:', poiId);
    return;
  }

  // Update modal title
  document.getElementById('commentsModalTitle').textContent = poi.name;
  document.getElementById('commentsModalLocation').textContent = `📍 ${poi.description || 'Cypr'}`;

  // Show/hide auth sections
  updateAuthSections();

  // Show modal
  const modal = document.getElementById('commentsModal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // Load comments
  await loadAndRenderComments(poiId);
};

// ===================================
// CLOSE MODAL
// ===================================
function closeModal() {
  const modal = document.getElementById('commentsModal');
  modal.hidden = true;
  document.body.style.overflow = '';
  currentPoiId = null;
  resetCommentForm();
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
// RENDER SINGLE COMMENT
// ===================================
async function renderComment(comment, isReply = false) {
  const sb = window.getSupabase();
  
  // Get user profile
  const { data: profile } = await sb
    .from('profiles')
    .select('username, name, avatar_url')
    .eq('id', comment.user_id)
    .single();

  const username = profile?.username || profile?.name || 'Użytkownik';
  const avatar = profile?.avatar_url || DEFAULT_AVATAR;
  
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
        ${comment.content}
      </div>

      ${photos.length > 0 ? `
        <div class="comment-photos">
          ${photos.map(p => `
            <img src="${p.photo_url}" alt="Photo" class="comment-photo" 
                 onclick="window.open('${p.photo_url}', '_blank')" />
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

  if (!currentPoiId) return;

  const textarea = document.getElementById('commentTextarea');
  const content = textarea.value.trim();

  if (!content) {
    window.showToast?.('Wpisz treść komentarza', 'error');
    return;
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wysyłanie...';

    // Add comment
    const comment = await addComment(currentPoiId, content, null);

    // Upload photos if any
    if (selectedPhotos.length > 0) {
      await uploadPhotos(selectedPhotos, comment.id);
    }

    // Reset form
    resetCommentForm();

    // Reload comments
    await loadAndRenderComments(currentPoiId);

    window.showToast?.('Komentarz dodany!', 'success');

  } catch (error) {
    console.error('Error submitting comment:', error);
    window.showToast?.('Błąd dodawania komentarza', 'error');
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
  if (menu) {
    menu.hidden = !menu.hidden;
  }
};

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
// LISTEN TO AUTH STATE CHANGES
// ===================================
document.addEventListener('ce-auth:state', async (e) => {
  const { status, session } = e.detail;
  
  if (status === 'authenticated' && session?.user) {
    currentUser = session.user;
    await loadUserProfile();
    updateAuthSections();
    initNotifications(currentUser.id);
  } else if (status === 'signed-out') {
    currentUser = null;
    updateAuthSections();
  }
});

console.log('✅ Community UI module loaded');
