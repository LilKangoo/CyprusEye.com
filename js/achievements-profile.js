// ===================================
// ACHIEVEMENTS PROFILE MODULE
// Handles user profile page functionality
// ===================================

import { getMyProfile, updateMyUsername, uploadAvatar, removeAvatar } from './profile.js';
import { getUserPhotos } from './community/photos.js';
import { getUserLikeStats } from './community/likes.js';

// State
let currentUser = null;
let currentProfile = null;
let userStats = {
  photos: 0,
  comments: 0,
  likesReceived: 0,
  likesGiven: 0
};

/**
 * Initialize the profile page
 */
export async function initProfilePage() {
  console.log('🚀 Initializing profile page...');
  
  try {
    // Check if user is logged in
    const sb = window.getSupabase();
    const { data: { user }, error } = await sb.auth.getUser();
    
    if (error) throw error;
    
    if (!user) {
      // Redirect to login if not authenticated
      showLoginPrompt();
      return;
    }
    
    currentUser = user;
    
    // Load profile data
    await loadProfileData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load user activity
    await loadUserActivity();
    
    console.log('✅ Profile page initialized');
    
  } catch (error) {
    console.error('❌ Error initializing profile page:', error);
    showError('Nie udało się załadować profilu. Odśwież stronę.');
  }
}

/**
 * Load user profile data
 */
async function loadProfileData() {
  try {
    showLoading('profile-header');
    
    // Get profile from Supabase
    currentProfile = await getMyProfile();
    
    console.log('📊 Profile loaded:', currentProfile);
    
    // Display profile header
    displayProfileHeader(currentProfile);
    
    // Display game statistics
    await displayGameStatistics(currentProfile);
    
    hideLoading('profile-header');
    
  } catch (error) {
    console.error('❌ Error loading profile data:', error);
    hideLoading('profile-header');
    throw error;
  }
}

/**
 * Display profile header (avatar + username)
 */
function displayProfileHeader(profile) {
  const avatarEl = document.getElementById('profileAvatar');
  const usernameEl = document.getElementById('profileUsername');
  const emailEl = document.getElementById('profileEmail');
  const memberSinceEl = document.getElementById('memberSince');
  
  if (avatarEl) {
    avatarEl.src = profile.avatar_url || '/assets/cyprus_logo-1000x1054.png';
    avatarEl.alt = profile.username || profile.name || 'User avatar';
  }
  
  if (usernameEl) {
    usernameEl.textContent = profile.username || profile.name || 'Użytkownik';
  }
  
  if (emailEl) {
    emailEl.textContent = profile.email || '';
  }
  
  if (memberSinceEl && currentUser?.created_at) {
    const date = new Date(currentUser.created_at);
    memberSinceEl.textContent = `Członek od ${date.toLocaleDateString('pl-PL', { 
      year: 'numeric', 
      month: 'long' 
    })}`;
  }
  
  // Display email in settings section
  const settingsEmailEl = document.getElementById('settingsEmail');
  if (settingsEmailEl) {
    settingsEmailEl.textContent = profile.email || 'Brak adresu email';
  }
}

/**
 * Display game statistics
 */
async function displayGameStatistics(profile) {
  // Level
  const levelEl = document.getElementById('statLevel');
  if (levelEl) {
    levelEl.textContent = profile.level || 1;
  }
  
  // XP
  const xpEl = document.getElementById('statXP');
  if (xpEl) {
    xpEl.textContent = profile.xp || 0;
  }
  
  // Calculate XP to next level
  const xpToNextLevel = calculateXPToNextLevel(profile.level || 1, profile.xp || 0);
  const xpProgressEl = document.getElementById('statXPProgress');
  if (xpProgressEl) {
    xpProgressEl.textContent = `${xpToNextLevel} XP do kolejnego poziomu`;
  }
  
  // Progress bar
  const xpProgressBar = document.getElementById('xpProgressBar');
  if (xpProgressBar) {
    const currentLevelXP = getLevelXPRequirement(profile.level || 1);
    const nextLevelXP = getLevelXPRequirement((profile.level || 1) + 1);
    const xpInCurrentLevel = (profile.xp || 0) - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;
    const percentage = Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForLevel) * 100));
    xpProgressBar.style.width = `${percentage}%`;
  }
  
  // Get user statistics from Supabase
  try {
    const sb = window.getSupabase();
    
    // Get user photos count
    const userPhotos = await getUserPhotos(currentUser.id, 100);
    userStats.photos = userPhotos.length;
    
    // Get user comments count
    const { count: commentsCount } = await sb
      .from('poi_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);
    userStats.comments = commentsCount || 0;
    
    // Get like statistics
    const likeStats = await getUserLikeStats(currentUser.id);
    userStats.likesReceived = likeStats.likesReceived;
    userStats.likesGiven = likeStats.likesGiven;
    
    // Get visited places count (badges)
    const visitedPlaces = JSON.parse(localStorage.getItem('visited') || '[]');
    const badgesCount = visitedPlaces.length;
    
    // Display statistics
    const statBadges = document.getElementById('statBadges');
    if (statBadges) {
      statBadges.textContent = badgesCount;
    }
    
    const statPhotos = document.getElementById('statPhotos');
    if (statPhotos) {
      statPhotos.textContent = userStats.photos;
    }
    
    const statComments = document.getElementById('statComments');
    if (statComments) {
      statComments.textContent = userStats.comments;
    }
    
    const statLikesReceived = document.getElementById('statLikesReceived');
    if (statLikesReceived) {
      statLikesReceived.textContent = userStats.likesReceived;
    }
    
  } catch (error) {
    console.error('❌ Error loading statistics:', error);
  }
}

/**
 * Calculate XP needed for next level
 */
function calculateXPToNextLevel(level, currentXP) {
  const nextLevelXP = getLevelXPRequirement(level + 1);
  return Math.max(0, nextLevelXP - currentXP);
}

/**
 * Get XP requirement for a specific level
 */
function getLevelXPRequirement(level) {
  // Level 1: 0 XP
  // Level 2: 150 XP
  // Level 3: 350 XP
  // Each level requires 200 more XP than previous
  if (level <= 1) return 0;
  return 150 + (level - 2) * 200;
}

/**
 * Load user activity (photos, comments)
 */
async function loadUserActivity() {
  try {
    showLoading('user-activity');
    
    const sb = window.getSupabase();
    
    // Load user photos
    const photos = await getUserPhotos(currentUser.id, 20);
    await displayUserPhotos(photos);
    
    // Load user comments with full data
    const { data: comments, error } = await sb
      .from('poi_comments')
      .select(`
        id,
        poi_id,
        content,
        created_at,
        is_edited,
        poi_comment_likes(count)
      `)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    displayUserComments(comments || []);
    
    hideLoading('user-activity');
    
  } catch (error) {
    console.error('❌ Error loading user activity:', error);
    hideLoading('user-activity');
  }
}

/**
 * Display user photos
 */
async function displayUserPhotos(photos) {
  const container = document.getElementById('userPhotosGrid');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (photos.length === 0) {
    container.innerHTML = '<p class="empty-state">Nie wstawiłeś jeszcze żadnych zdjęć.</p>';
    return;
  }
  
  const sb = window.getSupabase();
  
  for (const photo of photos) {
    // Get comment data to find POI ID
    let poiId = null;
    try {
      const { data: comment } = await sb
        .from('poi_comments')
        .select('poi_id')
        .eq('id', photo.comment_id)
        .single();
      
      if (comment) {
        poiId = comment.poi_id;
      }
    } catch (error) {
      console.warn('Error getting POI ID for photo:', error);
    }
    
    const photoCard = document.createElement('div');
    photoCard.className = 'photo-card';
    
    // Make the whole card clickable
    if (poiId) {
      photoCard.style.cursor = 'pointer';
      photoCard.addEventListener('click', () => {
        // Redirect to POI page with comment highlighted
        window.location.href = `/index.html#poi-${poiId}`;
      });
    }
    
    photoCard.innerHTML = `
      <img src="${photo.photo_url}" alt="Zdjęcie użytkownika" loading="lazy" />
      <div class="photo-card-overlay">
        <button class="btn btn-sm" onclick="event.stopPropagation()">
          ${poiId ? '📍 Zobacz miejsce' : '👁️ Zobacz'}
        </button>
      </div>
    `;
    
    container.appendChild(photoCard);
  }
}

/**
 * Display user comments
 */
function displayUserComments(comments) {
  const container = document.getElementById('userCommentsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (comments.length === 0) {
    container.innerHTML = '<p class="empty-state">Nie dodałeś jeszcze żadnych komentarzy.</p>';
    return;
  }
  
  comments.forEach(comment => {
    const likesCount = comment.poi_comment_likes?.[0]?.count || 0;
    const date = new Date(comment.created_at);
    const formattedDate = date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const commentCard = document.createElement('div');
    commentCard.className = 'comment-card';
    commentCard.style.cursor = 'pointer';
    
    // Make the whole card clickable - redirect to POI with comment highlighted
    commentCard.addEventListener('click', () => {
      window.location.href = `/index.html#poi-${comment.poi_id}`;
    });
    
    // Add hover title
    commentCard.title = `Kliknij aby przejść do ${comment.poi_id}`;
    
    commentCard.innerHTML = `
      <div class="comment-header">
        <span class="comment-poi-id">📍 ${comment.poi_id}</span>
        <span class="comment-date">${formattedDate}</span>
      </div>
      <p class="comment-content">${escapeHtml(comment.content)}</p>
      <div class="comment-footer">
        <span class="comment-likes">❤️ ${likesCount}</span>
        ${comment.is_edited ? '<span class="comment-edited">✏️ edytowany</span>' : ''}
        <span style="margin-left: auto; color: #9ca3af; font-size: 0.8125rem;">→ Kliknij aby otworzyć</span>
      </div>
    `;
    container.appendChild(commentCard);
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Avatar upload
  const avatarInput = document.getElementById('avatarInput');
  const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
  
  if (uploadAvatarBtn && avatarInput) {
    uploadAvatarBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', handleAvatarUpload);
  }
  
  // Remove avatar
  const removeAvatarBtn = document.getElementById('removeAvatarBtn');
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', handleRemoveAvatar);
  }
  
  // Username edit
  const editUsernameBtn = document.getElementById('editUsernameBtn');
  if (editUsernameBtn) {
    editUsernameBtn.addEventListener('click', showUsernameEditForm);
  }
  
  // Username save
  const saveUsernameBtn = document.getElementById('saveUsernameBtn');
  if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', handleSaveUsername);
  }
  
  // Cancel username edit
  const cancelUsernameBtn = document.getElementById('cancelUsernameBtn');
  if (cancelUsernameBtn) {
    cancelUsernameBtn.addEventListener('click', hideUsernameEditForm);
  }
  
  // Password change
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', showPasswordChangeForm);
  }
  
  // Delete account
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', handleDeleteAccount);
  }
}

/**
 * Handle avatar upload
 */
async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    showLoading('avatar-upload');
    
    const updatedProfile = await uploadAvatar(file);
    currentProfile = updatedProfile;
    
    // Update display
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
      avatarEl.src = updatedProfile.avatar_url;
    }
    
    // Update header avatar
    const headerAvatarEl = document.getElementById('headerUserAvatar');
    if (headerAvatarEl) {
      headerAvatarEl.src = updatedProfile.avatar_url;
    }
    
    hideLoading('avatar-upload');
    showSuccess('Avatar został zaktualizowany!');
    
  } catch (error) {
    console.error('❌ Error uploading avatar:', error);
    hideLoading('avatar-upload');
    showError('Nie udało się wgrać avatara: ' + error.message);
  }
}

/**
 * Handle remove avatar
 */
async function handleRemoveAvatar() {
  if (!confirm('Czy na pewno chcesz usunąć swój avatar?')) {
    return;
  }
  
  try {
    showLoading('avatar-upload');
    
    const updatedProfile = await removeAvatar();
    currentProfile = updatedProfile;
    
    // Update display
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
      avatarEl.src = '/assets/cyprus_logo-1000x1054.png';
    }
    
    // Update header avatar
    const headerAvatarEl = document.getElementById('headerUserAvatar');
    if (headerAvatarEl) {
      headerAvatarEl.src = '/assets/cyprus_logo-1000x1054.png';
    }
    
    hideLoading('avatar-upload');
    showSuccess('Avatar został usunięty.');
    
  } catch (error) {
    console.error('❌ Error removing avatar:', error);
    hideLoading('avatar-upload');
    showError('Nie udało się usunąć avatara: ' + error.message);
  }
}

/**
 * Show username edit form
 */
function showUsernameEditForm() {
  const displayEl = document.getElementById('usernameDisplay');
  const formEl = document.getElementById('usernameEditForm');
  const inputEl = document.getElementById('usernameInput');
  
  if (displayEl) displayEl.style.display = 'none';
  if (formEl) formEl.style.display = 'flex';
  if (inputEl) {
    inputEl.value = currentProfile?.username || '';
    inputEl.focus();
  }
}

/**
 * Hide username edit form
 */
function hideUsernameEditForm() {
  const displayEl = document.getElementById('usernameDisplay');
  const formEl = document.getElementById('usernameEditForm');
  
  if (displayEl) displayEl.style.display = 'flex';
  if (formEl) formEl.style.display = 'none';
}

/**
 * Handle save username
 */
async function handleSaveUsername() {
  const inputEl = document.getElementById('usernameInput');
  const newUsername = inputEl?.value?.trim();
  
  if (!newUsername) {
    showError('Nazwa użytkownika nie może być pusta.');
    return;
  }
  
  if (newUsername === currentProfile?.username) {
    hideUsernameEditForm();
    return;
  }
  
  try {
    showLoading('username-edit');
    
    const updatedProfile = await updateMyUsername(newUsername);
    currentProfile = updatedProfile;
    
    // Update display
    const usernameEl = document.getElementById('profileUsername');
    if (usernameEl) {
      usernameEl.textContent = updatedProfile.username;
    }
    
    hideLoading('username-edit');
    hideUsernameEditForm();
    showSuccess('Nazwa użytkownika została zaktualizowana!');
    
  } catch (error) {
    console.error('❌ Error updating username:', error);
    hideLoading('username-edit');
    showError('Nie udało się zaktualizować nazwy: ' + error.message);
  }
}

/**
 * Show password change form
 */
function showPasswordChangeForm() {
  // This will be implemented with a modal or dedicated section
  alert('Funkcja zmiany hasła będzie dostępna wkrótce. Użyj opcji "Resetuj hasło" z menu logowania.');
}

/**
 * Handle delete account
 */
async function handleDeleteAccount() {
  // First confirmation
  const confirm1 = confirm(
    'UWAGA: To działanie jest nieodwracalne!\n\n' +
    'Usunięcie konta spowoduje:\n' +
    '• Usunięcie wszystkich Twoich danych\n' +
    '• Usunięcie wszystkich komentarzy i zdjęć\n' +
    '• Utratę całego postępu w grze\n' +
    '• Utratę wszystkich odznak i osiągnięć\n\n' +
    'Czy na pewno chcesz kontynuować?'
  );
  
  if (!confirm1) return;
  
  // Second confirmation
  const confirm2 = confirm(
    'To jest ostatnie ostrzeżenie!\n\n' +
    'Czy jesteś absolutnie pewien, że chcesz TRWALE usunąć swoje konto?\n\n' +
    'Kliknij OK aby USUNĄĆ konto lub Anuluj aby zachować konto.'
  );
  
  if (!confirm2) return;
  
  try {
    showLoading('delete-account');
    
    const sb = window.getSupabase();
    
    // Delete user data from Supabase
    // Note: This requires proper RLS policies and cascade deletes
    
    // Delete user's photos from storage
    try {
      const userPhotos = await getUserPhotos(currentUser.id, 1000);
      for (const photo of userPhotos) {
        if (photo.photo_filename) {
          await sb.storage.from('poi-photos').remove([photo.photo_filename]);
        }
      }
    } catch (error) {
      console.warn('Error deleting photos:', error);
    }
    
    // Delete user's avatar from storage
    try {
      const { data: avatarFiles } = await sb.storage.from('avatars').list(currentUser.id);
      if (avatarFiles && avatarFiles.length > 0) {
        const filesToRemove = avatarFiles.map(f => `${currentUser.id}/${f.name}`);
        await sb.storage.from('avatars').remove(filesToRemove);
      }
    } catch (error) {
      console.warn('Error deleting avatar:', error);
    }
    
    // Note: Supabase doesn't allow clients to delete their own account directly
    // This requires an Edge Function or admin API call
    // For now, we'll clear user data and sign them out
    
    // Delete profile data
    try {
      await sb.from('profiles').delete().eq('id', currentUser.id);
    } catch (error) {
      console.warn('Error deleting profile:', error);
    }
    
    // Delete comments
    try {
      await sb.from('poi_comments').delete().eq('user_id', currentUser.id);
    } catch (error) {
      console.warn('Error deleting comments:', error);
    }
    
    // Delete likes
    try {
      await sb.from('poi_comment_likes').delete().eq('user_id', currentUser.id);
    } catch (error) {
      console.warn('Error deleting likes:', error);
    }
    
    // Delete ratings
    try {
      await sb.from('poi_ratings').delete().eq('user_id', currentUser.id);
    } catch (error) {
      console.warn('Error deleting ratings:', error);
    }
    
    hideLoading('delete-account');
    
    // Sign out
    await sb.auth.signOut();
    
    // Clear local storage
    localStorage.clear();
    
    alert(
      'Twoje dane zostały usunięte i zostałeś wylogowany.\n\n' +
      'UWAGA: Aby całkowicie usunąć konto, skontaktuj się z administratorem przez email: support@cypruseye.com'
    );
    
    window.location.href = '/index.html';
    
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    hideLoading('delete-account');
    showError('Nie udało się usunąć konta: ' + error.message);
  }
}

/**
 * Show login prompt for non-authenticated users
 */
function showLoginPrompt() {
  const container = document.querySelector('.achievements-main');
  if (container) {
    container.innerHTML = `
      <div class="card surface-card" style="text-align: center; padding: 3rem;">
        <h2>Zaloguj się, aby zobaczyć swój profil</h2>
        <p>Musisz być zalogowany, aby uzyskać dostęp do strony profilu.</p>
        <button class="btn btn-primary" data-auth="login" data-auth-login-mode="modal">
          Zaloguj się
        </button>
      </div>
    `;
  }
}

/**
 * Utility: Show loading state
 */
function showLoading(context) {
  const loadingEl = document.getElementById(`${context}-loading`);
  if (loadingEl) {
    loadingEl.style.display = 'block';
  }
}

/**
 * Utility: Hide loading state
 */
function hideLoading(context) {
  const loadingEl = document.getElementById(`${context}-loading`);
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
}

/**
 * Utility: Show success message
 */
function showSuccess(message) {
  if (window.showToast) {
    window.showToast(message, 'success');
  } else {
    alert(message);
  }
}

/**
 * Utility: Show error message
 */
function showError(message) {
  if (window.showToast) {
    window.showToast(message, 'error');
  } else {
    alert(message);
  }
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}

console.log('✅ Achievements profile module loaded');
