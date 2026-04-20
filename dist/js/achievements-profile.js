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
    // Check if Supabase is available
    if (!window.getSupabase) {
      console.warn('⚠️ Supabase not loaded yet, showing login prompt');
      showLoginPrompt();
      return;
    }
    
    // Check if user is logged in
    const sb = window.getSupabase();
    
    if (!sb) {
      console.warn('⚠️ Supabase client not available, showing login prompt');
      showLoginPrompt();
      return;
    }
    
    const { data: { user }, error } = await sb.auth.getUser();
    
    if (error) {
      console.warn('⚠️ Auth error:', error.message);
      showLoginPrompt();
      return;
    }
    
    if (!user) {
      console.log('👤 No user logged in, showing login prompt');
      showLoginPrompt();
      return;
    }
    
    console.log('✅ User authenticated:', user.email);
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
    // Show login prompt as fallback
    showLoginPrompt();
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
    
    // Show all gated sections
    showGatedSections();
    
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
 * Show all sections that require authentication
 */
function showGatedSections() {
  const gatedSections = document.querySelectorAll('[data-gated="true"]');
  gatedSections.forEach(section => {
    section.hidden = false;
  });
}

/**
 * Display profile header (avatar + username)
 */
function displayProfileHeader(profile) {
  const avatarEl = document.getElementById('profileAvatar');
  const usernameEl = document.getElementById('profileUsername');
  const emailEl = document.getElementById('profileEmail');
  const memberSinceEl = document.getElementById('memberSince');
  
  const displayName = profile.username || profile.name || 'Użytkownik';
  
  if (avatarEl) {
    avatarEl.src = profile.avatar_url || '/assets/cyprus_logo-1000x1054.png';
    avatarEl.alt = `${displayName} - avatar`;
  }
  
  if (usernameEl) {
    usernameEl.textContent = displayName;
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
  
  // Update SEO meta tags dynamically
  updateMetaTags(displayName, profile);
}

/**
 * Update meta tags for SEO with user data
 */
function updateMetaTags(username, profile) {
  const lang = String(window.appI18n?.language || document.documentElement?.lang || 'pl').toLowerCase();
  const isEnglish = lang.startsWith('en');
  const brand = 'CyprusEye Save & Travel';

  // Update page title
  document.title = isEnglish ? `${username} - ${brand} profile` : `${username} - Profil ${brand}`;
  
  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', 
      isEnglish
        ? `User profile of ${username} in ${brand}. Level ${profile.level || 1}, ${profile.xp || 0} XP earned.`
        : `Profil użytkownika ${username} w ${brand}. Poziom ${profile.level || 1}, ${profile.xp || 0} XP doświadczenia.`
    );
  }
  
  // Update Open Graph title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    ogTitle.setAttribute('content', isEnglish ? `${username} - ${brand} profile` : `${username} - Profil ${brand}`);
  }
  
  // Update Open Graph description
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    ogDesc.setAttribute('content', 
      isEnglish
        ? `See ${username}'s ${brand} stats: level ${profile.level || 1}, ${profile.xp || 0} XP earned.`
        : `Zobacz statystyki użytkownika ${username} w ${brand}: poziom ${profile.level || 1}, ${profile.xp || 0} punktów doświadczenia.`
    );
  }
  
  // Update canonical URL with username (optional)
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    // Keep canonical as is or update with user ID if implementing user profile URLs
    // canonical.setAttribute('href', `https://www.cypruseye.com/profile/${profile.id}`);
  }
}

/**
 * Display game statistics
 */
async function displayGameStatistics(profile) {
  console.log('📊 Displaying game statistics:', profile);
  
  // Level (from Supabase - generated column)
  const level = profile.level || 1;
  const levelEl = document.getElementById('statLevel');
  if (levelEl) {
    levelEl.textContent = level;
  }
  
  // XP (from Supabase)
  const xp = profile.xp || 0;
  const xpEl = document.getElementById('statXP');
  if (xpEl) {
    xpEl.textContent = xp;
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
    
    // Get visited places count from Supabase profile
    const visitedPlaces = profile.visited_places || [];
    const visitedCount = visitedPlaces.length;
    
    // Display visited places count
    const statVisited = document.getElementById('statVisited');
    if (statVisited) {
      statVisited.textContent = visitedCount;
    }
    
    // Also update badges count (keep backward compatibility)
    const statBadges = document.getElementById('statBadges');
    if (statBadges) {
      statBadges.textContent = visitedCount;
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
  
  // Show loading spinner
  container.innerHTML = '<div class="loading-spinner" style="grid-column: 1/-1; text-align: center; padding: 2rem;"><div class="spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div><p style="margin-top: 1rem; color: #6b7280;">Ładowanie zdjęć...</p></div>';
  container.setAttribute('aria-busy', 'true');
  
  // Small delay to show spinner
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (photos.length === 0) {
    container.innerHTML = '<p class="empty-state" data-i18n="profile.activity.photos.empty">Nie wstawiłeś jeszcze żadnych zdjęć.</p>';
    container.removeAttribute('aria-busy');
    if (window.i18n) window.i18n.translateElement(container);
    return;
  }
  
  const sb = window.getSupabase();
  
  // FIX: Optimize N+1 query - get all POI IDs in one query with JOIN
  const commentIds = photos.map(p => p.comment_id).filter(Boolean);
  let poiIdMap = new Map();
  
  if (commentIds.length > 0) {
    try {
      const { data: comments } = await sb
        .from('poi_comments')
        .select('id, poi_id')
        .in('id', commentIds);
      
      if (comments) {
        comments.forEach(comment => {
          poiIdMap.set(comment.id, comment.poi_id);
        });
      }
    } catch (error) {
      console.warn('Error getting POI IDs for photos:', error);
    }
  }
  
  // Create photo cards
  for (const photo of photos) {
    const poiId = poiIdMap.get(photo.comment_id) || null;
    
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
        <button class="btn btn-sm" onclick="event.stopPropagation()" data-i18n="${poiId ? 'profile.activity.photos.viewPlace' : 'profile.activity.photos.view'}">
          ${poiId ? '📍 Zobacz miejsce' : '👁️ Zobacz'}
        </button>
      </div>
    `;
    
    if (window.i18n) window.i18n.translateElement(photoCard);
    
    container.appendChild(photoCard);
  }
  
  // Remove loading state
  container.removeAttribute('aria-busy');
}

/**
 * Display user comments
 */
function displayUserComments(comments) {
  const container = document.getElementById('userCommentsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (comments.length === 0) {
    container.innerHTML = '<p class="empty-state" data-i18n="profile.activity.comments.empty">Nie dodałeś jeszcze żadnych komentarzy.</p>';
    if (window.i18n) window.i18n.translateElement(container);
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
        ${comment.is_edited ? '<span class="comment-edited" data-i18n="profile.activity.comments.edited">✏️ edytowany</span>' : ''}
        <span style="margin-left: auto; color: #9ca3af; font-size: 0.8125rem;" data-i18n="profile.activity.comments.clickToOpen">→ Kliknij aby otworzyć</span>
      </div>
    `;
    
    if (window.i18n) window.i18n.translateElement(commentCard);
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
  
  // Email edit
  const editEmailBtn = document.getElementById('editEmailBtn');
  if (editEmailBtn) {
    editEmailBtn.addEventListener('click', showEmailEditForm);
  }
  
  const saveEmailBtn = document.getElementById('saveEmailBtn');
  if (saveEmailBtn) {
    saveEmailBtn.addEventListener('click', handleSaveEmail);
  }
  
  const cancelEmailBtn = document.getElementById('cancelEmailBtn');
  if (cancelEmailBtn) {
    cancelEmailBtn.addEventListener('click', hideEmailEditForm);
  }
  
  // Password edit
  const editPasswordBtn = document.getElementById('editPasswordBtn');
  if (editPasswordBtn) {
    editPasswordBtn.addEventListener('click', showPasswordEditForm);
  }
  
  const savePasswordBtn = document.getElementById('savePasswordBtn');
  if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', handleSavePassword);
  }
  
  const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
  if (cancelPasswordBtn) {
    cancelPasswordBtn.addEventListener('click', hidePasswordEditForm);
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
  
  // Validate username
  const validation = validateUsername(newUsername);
  if (!validation.valid) {
    showError(validation.error);
    inputEl?.focus();
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
 * Show email edit form
 */
function showEmailEditForm() {
  const displayEl = document.getElementById('emailDisplay');
  const formEl = document.getElementById('emailEditForm');
  const inputEl = document.getElementById('emailInput');
  
  if (displayEl) displayEl.style.display = 'none';
  if (formEl) formEl.style.display = 'block';
  if (inputEl) {
    inputEl.value = currentProfile?.email || '';
    inputEl.focus();
  }
}

/**
 * Hide email edit form
 */
function hideEmailEditForm() {
  const displayEl = document.getElementById('emailDisplay');
  const formEl = document.getElementById('emailEditForm');
  
  if (displayEl) displayEl.style.display = 'flex';
  if (formEl) formEl.style.display = 'none';
}

/**
 * Handle save email
 */
async function handleSaveEmail() {
  const inputEl = document.getElementById('emailInput');
  const newEmail = inputEl?.value?.trim();
  
  // Validate email
  const validation = validateEmail(newEmail);
  if (!validation.valid) {
    showError(validation.error);
    inputEl?.focus();
    return;
  }
  
  if (newEmail === currentProfile?.email) {
    hideEmailEditForm();
    return;
  }
  
  try {
    showLoading('email-edit');
    
    const sb = window.getSupabase();
    
    // Supabase updateUser for email change
    const { data, error } = await sb.auth.updateUser({
      email: newEmail
    });
    
    if (error) throw error;
    
    hideLoading('email-edit');
    hideEmailEditForm();
    
    showSuccess(
      'Email został zaktualizowany!\n\n' +
      'Sprawdź swoją skrzynkę pocztową (nowy adres) i kliknij link weryfikacyjny.\n' +
      'Zmiana zostanie aktywna po weryfikacji.'
    );
    
    // Update display (but don't change profile until verified)
    console.log('Email change initiated:', newEmail);
    
  } catch (error) {
    console.error('❌ Error updating email:', error);
    hideLoading('email-edit');
    showError('Nie udało się zaktualizować emaila: ' + error.message);
  }
}

/**
 * Show password edit form
 */
function showPasswordEditForm() {
  const displayEl = document.getElementById('passwordDisplay');
  const formEl = document.getElementById('passwordEditForm');
  
  if (displayEl) displayEl.style.display = 'none';
  if (formEl) formEl.style.display = 'block';
  
  // Clear inputs
  const currentPasswordInput = document.getElementById('currentPasswordInput');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  
  if (currentPasswordInput) currentPasswordInput.value = '';
  if (newPasswordInput) newPasswordInput.value = '';
  if (confirmPasswordInput) confirmPasswordInput.value = '';
  
  if (newPasswordInput) newPasswordInput.focus();
}

/**
 * Hide password edit form
 */
function hidePasswordEditForm() {
  const displayEl = document.getElementById('passwordDisplay');
  const formEl = document.getElementById('passwordEditForm');
  
  if (displayEl) displayEl.style.display = 'flex';
  if (formEl) formEl.style.display = 'none';
}

/**
 * Handle save password
 */
async function handleSavePassword() {
  const newPasswordInput = document.getElementById('newPasswordInput');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  
  const newPassword = newPasswordInput?.value;
  const confirmPassword = confirmPasswordInput?.value;
  
  // Validation
  if (!newPassword) {
    showError('Podaj nowe hasło.');
    newPasswordInput?.focus();
    return;
  }
  
  if (newPassword.length < 8) {
    showError('Hasło musi mieć minimum 8 znaków.');
    newPasswordInput?.focus();
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showError('Hasła nie są identyczne.');
    confirmPasswordInput?.focus();
    return;
  }
  
  try {
    showLoading('password-edit');
    
    const sb = window.getSupabase();
    
    // Supabase updateUser for password change
    const { data, error } = await sb.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    hideLoading('password-edit');
    hidePasswordEditForm();
    
    showSuccess('Hasło zostało pomyślnie zmienione!');
    
  } catch (error) {
    console.error('❌ Error updating password:', error);
    hideLoading('password-edit');
    showError('Nie udało się zaktualizować hasła: ' + error.message);
  }
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
  const main = document.querySelector('main');
  if (main) {
    // Hide all gated sections
    const gatedSections = document.querySelectorAll('[data-gated="true"]');
    gatedSections.forEach(section => {
      section.hidden = true;
    });
    
    // Create login prompt
    const loginPrompt = document.createElement('section');
    loginPrompt.className = 'card surface-card';
    loginPrompt.style.cssText = 'text-align: center; padding: 3rem; margin: 2rem auto; max-width: 600px;';
    loginPrompt.id = 'login-prompt';
    loginPrompt.innerHTML = `
      <div style="font-size: 4rem; margin-bottom: 1rem;">🔒</div>
      <h2 data-i18n="profile.login.title" style="margin-bottom: 1rem;">Zaloguj się, aby zobaczyć swój profil</h2>
      <p data-i18n="profile.login.description" style="margin-bottom: 2rem; color: #6b7280;">Musisz być zalogowany, aby uzyskać dostęp do strony profilu i swoich statystyk.</p>
      <button 
        id="loginPromptButton" 
        class="btn btn-primary" 
        data-auth="login"
        data-auth-login-mode="modal"
        data-i18n="profile.login.button">
        Zaloguj się
      </button>
      <p style="margin-top: 1rem; font-size: 0.875rem; color: #9ca3af;">
        lub <a href="/index.html" style="color: #3b82f6; text-decoration: underline;">wróć do strony głównej</a>
      </p>
    `;
    
    main.insertBefore(loginPrompt, main.firstChild);
    
    // Re-initialize auth-ui buttons to catch the new login button
    // This is how it works on other pages - auth-ui.js scans for [data-auth="login"]
    requestAnimationFrame(() => {
      console.log('🔄 Re-initializing auth buttons for dynamically added login prompt');
      
      const loginButton = document.getElementById('loginPromptButton');
      console.log('🔍 Login button with data-auth found:', loginButton ? 'YES' : 'NO');
      
      if (!loginButton) {
        console.error('❌ Login button not found after creating it!');
        return;
      }
      
      console.log('📋 Button attributes:', {
        'data-auth': loginButton.getAttribute('data-auth'),
        'data-auth-login-mode': loginButton.getAttribute('data-auth-login-mode')
      });
      
      // Check if button already has listener (from auth-ui.js)
      if (loginButton.dataset.authLoginReady === 'true') {
        console.log('✅ Button already initialized by auth-ui.js');
        return;
      }
      
      // Manually initialize the button exactly like auth-ui.js does
      console.log('⚙️ Manually initializing login button');
      loginButton.dataset.authLoginReady = 'true';
      
      loginButton.addEventListener('click', (event) => {
        event.preventDefault();
        console.log('🔐 Login button clicked!');
        
        // Call window.openAuthModal if available
        if (typeof window.openAuthModal === 'function') {
          console.log('✅ Calling window.openAuthModal()');
          window.openAuthModal('login');
        } else {
          console.warn('⚠️ window.openAuthModal not available, trying fallback');
          
          // Fallback to manual modal opening
          const modal = document.getElementById('auth-modal');
          if (modal) {
            console.log('✅ Opening modal manually');
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
          } else {
            console.error('❌ Modal not found, redirecting to /auth/');
            window.location.href = '/auth/';
          }
        }
      });
      
      console.log('✅ Login button initialized successfully');
    });
    
    if (window.i18n) window.i18n.translateElement(loginPrompt);
  }
}

/**
 * Open login modal
 */
function openLoginModal() {
  console.log('🔐 Attempting to open login modal...');
  console.log('window.openAuthModal exists:', typeof window.openAuthModal);
  console.log('window.__authModalController exists:', typeof window.__authModalController);
  
  // Try using the global openAuthModal function first (used by the app)
  if (typeof window.openAuthModal === 'function') {
    console.log('✅ Using window.openAuthModal()');
    try {
      window.openAuthModal('login');
      console.log('✅ window.openAuthModal() called successfully');
    } catch (error) {
      console.error('❌ Error calling window.openAuthModal:', error);
    }
    return;
  }
  
  // Try using the auth modal controller
  const controller = window.__authModalController;
  if (controller && typeof controller.open === 'function') {
    console.log('✅ Using __authModalController');
    try {
      if (controller.setActiveTab) {
        controller.setActiveTab('login', { focus: false });
      }
      controller.open('login');
      console.log('✅ controller.open() called successfully');
    } catch (error) {
      console.error('❌ Error calling controller.open:', error);
    }
    return;
  }
  
  // Fallback: manual modal opening
  console.log('⚠️ Using fallback modal opening');
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    
    // Add body class to prevent scrolling
    document.body.style.overflow = 'hidden';
    
    // Focus on the modal
    const dialog = modal.querySelector('.modal__dialog');
    if (dialog) {
      dialog.focus();
    }
    
    // Set login tab as active
    const loginTab = document.getElementById('authTabLogin');
    const loginPanel = document.getElementById('authPanelLogin');
    
    if (loginTab && loginPanel) {
      // Remove active from all tabs
      document.querySelectorAll('.auth-modal__tab').forEach(tab => {
        tab.classList.remove('is-active');
        tab.setAttribute('aria-selected', 'false');
        tab.tabIndex = -1;
      });
      
      // Remove active from all panels
      document.querySelectorAll('.auth-modal__panel').forEach(panel => {
        panel.classList.remove('is-active');
        panel.hidden = true;
      });
      
      // Activate login tab and panel
      loginTab.classList.add('is-active');
      loginTab.setAttribute('aria-selected', 'true');
      loginTab.tabIndex = 0;
      loginPanel.classList.add('is-active');
      loginPanel.hidden = false;
    }
    
    console.log('✅ Login modal opened (fallback)');
  } else {
    console.error('❌ Auth modal not found in DOM');
    // Last resort - redirect to auth page
    window.location.href = '/auth/';
  }
}

/**
 * Validate username
 * @param {string} username - Username to validate
 * @returns {Object} - {valid: boolean, error: string}
 */
function validateUsername(username) {
  if (!username || username.length === 0) {
    return { valid: false, error: 'Nazwa użytkownika nie może być pusta.' };
  }
  
  if (username.length < 3) {
    return { valid: false, error: 'Nazwa użytkownika musi mieć minimum 3 znaki.' };
  }
  
  if (username.length > 20) {
    return { valid: false, error: 'Nazwa użytkownika może mieć maksymalnie 20 znaków.' };
  }
  
  // Only alphanumeric and underscore
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return { valid: false, error: 'Nazwa użytkownika może zawierać tylko litery, cyfry i podkreślenie (_).' };
  }
  
  // Cannot start with number
  if (/^\d/.test(username)) {
    return { valid: false, error: 'Nazwa użytkownika nie może zaczynać się od cyfry.' };
  }
  
  // Reserved words
  const reserved = ['admin', 'root', 'system', 'moderator', 'support', 'help', 'null', 'undefined'];
  if (reserved.includes(username.toLowerCase())) {
    return { valid: false, error: 'Ta nazwa użytkownika jest zarezerwowana.' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate email
 * @param {string} email - Email to validate
 * @returns {Object} - {valid: boolean, error: string}
 */
function validateEmail(email) {
  if (!email || email.length === 0) {
    return { valid: false, error: 'Adres email nie może być pusty.' };
  }
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Podaj prawidłowy adres email.' };
  }
  
  if (email.length > 254) {
    return { valid: false, error: 'Adres email jest za długi.' };
  }
  
  // Check for common typos in popular domains
  const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  const typos = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'outlok.com': 'outlook.com',
    'hotmial.com': 'hotmail.com'
  };
  
  if (domain && typos[domain]) {
    return { 
      valid: false, 
      error: `Czy chodziło Ci o @${typos[domain]}?` 
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Utility: Show loading state
 */
function showLoading(context) {
  const loadingEl = document.getElementById(`${context}-loading`);
  if (loadingEl) {
    loadingEl.style.display = 'block';
    loadingEl.setAttribute('aria-busy', 'true');
  }
  
  // Also set aria-busy on the parent section
  const section = loadingEl.closest('section');
  if (section) {
    section.setAttribute('aria-busy', 'true');
  }
}

/**
 * Utility: Hide loading state
 */
function hideLoading(context) {
  const loadingEl = document.getElementById(`${context}-loading`);
  if (loadingEl) {
    loadingEl.style.display = 'none';
    loadingEl.removeAttribute('aria-busy');
  }
  
  // Also remove aria-busy from the parent section
  const section = loadingEl?.closest('section');
  if (section) {
    section.removeAttribute('aria-busy');
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

// Wait for all scripts to load before initializing
async function waitForDependencies() {
  // Wait for app.js to define openAuthModal
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max
  
  while (!window.openAuthModal && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!window.openAuthModal) {
    console.warn('⚠️ window.openAuthModal not available after waiting');
  }
  
  // Also wait for Supabase if needed
  attempts = 0;
  while (!window.getSupabase && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!window.getSupabase) {
    console.warn('⚠️ window.getSupabase not available after waiting');
  }
}

// Initialize when DOM is ready and dependencies are loaded
async function init() {
  await waitForDependencies();
  await initProfilePage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for successful login - reload profile when user logs in
document.addEventListener('ce-auth:post-login', async () => {
  console.log('✅ User logged in, reloading profile...');
  
  // Remove login prompt if it exists
  const loginPrompt = document.getElementById('login-prompt');
  if (loginPrompt) {
    loginPrompt.remove();
    console.log('🗑️ Login prompt removed');
  }
  
  // Reload profile page
  await initProfilePage();
});

console.log('✅ Achievements profile module loaded');

// Expose functions to window for debugging
window.__achievementsDebug = {
  openLoginModal,
  showLoginPrompt,
  initProfilePage
};

console.log('🛠️ Debug functions available: window.__achievementsDebug');
console.log('  - window.__achievementsDebug.openLoginModal()');
console.log('  - window.__achievementsDebug.showLoginPrompt()');
console.log('  - window.__achievementsDebug.initProfilePage()');
