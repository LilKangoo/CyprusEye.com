import { getMyProfile, updateMyUsername, uploadAvatar, removeAvatar } from './profile.js';
import { supabase } from './supabaseClient.js';
import { getUserPhotos } from './community/photos.js';
import { getUserLikeStats } from './community/likes.js';

// --- State ---
let currentUser = null;
let currentProfile = null;
let ordersData = [];

// --- Constants ---
const SECTIONS = ['overview', 'reservations', 'achievements', 'settings'];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

async function initDashboard() {
  console.log('🚀 Initializing Dashboard...');
  
  try {
    // 1. Check Auth
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.warn('🔒 No user, redirecting to home...');
      window.location.href = '/index.html?login=true'; // Redirect to home and open login
      return;
    }
    
    currentUser = user;
    console.log('👤 Logged in as:', currentUser.email);

    // 2. Load Profile
    await loadProfile();

    // 3. Setup Navigation
    setupNavigation();
    setupMobileMenu();

    // 4. Initial Load of Active Section
    const activeSection = document.querySelector('.dashboard-section.active')?.id.replace('section-', '') || 'overview';
    loadSection(activeSection);

    // 5. Load Global Data (Reservations count, etc.)
    updateGlobalBadges();

  } catch (err) {
    console.error('❌ Dashboard Init Error:', err);
    showToast('Error initializing dashboard', 'error');
  }
}

// --- Profile & Stats ---
async function loadProfile() {
  try {
    // Load profile from Supabase (profile.js helper)
    currentProfile = await getMyProfile();
    
    // Update Sidebar UI
    updateSidebarProfile();
    
    // Update Settings UI
    updateSettingsForms();

  } catch (err) {
    console.error('❌ Profile Load Error:', err);
  }
}

function updateSidebarProfile() {
  const avatarEl = document.getElementById('sidebarAvatar');
  const usernameEl = document.getElementById('sidebarUsername');
  const levelEl = document.getElementById('sidebarLevel');

  const displayName = currentProfile?.username || currentProfile?.name || currentUser.email.split('@')[0];
  const avatarUrl = currentProfile?.avatar_url || 'assets/cyprus_logo-1000x1054.png';
  const level = currentProfile?.level || 1;

  if (avatarEl) avatarEl.src = avatarUrl;
  if (usernameEl) usernameEl.textContent = displayName;
  if (levelEl) levelEl.textContent = `Level ${level}`;
}

// --- Navigation ---
function setupNavigation() {
  const navButtons = document.querySelectorAll('.sidebar-nav .nav-item[data-section]');
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      
      // Update Active State
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Switch Section
      switchSection(sectionId);
      
      // Close mobile menu if open
      document.querySelector('.dashboard-sidebar').classList.remove('open');
    });
  });

  // Logout
  const logoutBtns = document.querySelectorAll('[data-auth="logout"]');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/index.html';
    });
  });
}

function setupMobileMenu() {
  const toggle = document.getElementById('dashboardSidebarToggle');
  const sidebar = document.querySelector('.dashboard-sidebar');
  
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && 
          !sidebar.contains(e.target) && 
          !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

function switchSection(sectionId) {
  // Hide all sections
  SECTIONS.forEach(id => {
    const el = document.getElementById(`section-${id}`);
    if (el) el.classList.remove('active');
  });
  
  // Show target
  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.classList.add('active');
    loadSection(sectionId); // Load data for this section
  }
}

// --- Section Loaders ---
async function loadSection(sectionId) {
  console.log('📂 Loading section:', sectionId);
  
  switch (sectionId) {
    case 'overview':
      await loadOverviewStats();
      break;
    case 'reservations':
      await loadReservations();
      break;
    case 'achievements':
      await loadAchievements();
      break;
    case 'settings':
      // Settings are already pre-filled from loadProfile
      break;
  }
}

// --- Overview Logic ---
async function loadOverviewStats() {
  if (!currentProfile) return;

  // Update Stat Cards
  document.getElementById('overviewXP').textContent = `${currentProfile.xp || 0} XP`;
  document.getElementById('overviewLevel').textContent = currentProfile.level || 1;
  document.getElementById('overviewVisited').textContent = (currentProfile.visited_places || []).length;
  
  // XP Progress
  const currentXP = currentProfile.xp || 0;
  const level = currentProfile.level || 1;
  const nextLevelXP = 150 + (level - 1) * 200; // Simplified formula matching achievements-profile.js
  const prevLevelXP = level === 1 ? 0 : (150 + (level - 2) * 200);
  const progress = Math.min(100, Math.max(0, ((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100));
  
  document.getElementById('overviewXPBar').style.width = `${progress}%`;

  // Load Recent Activity (Mockup or Real)
  // For now, we show recent reservations or "Joined"
  const activityList = document.getElementById('recentActivityList');
  
  // Fetch recent bookings quickly
  const bookings = await fetchAllBookings(3); // Limit 3
  
  if (bookings.length === 0) {
    activityList.innerHTML = `<p class="empty-state">No recent activity.</p>`;
  } else {
    activityList.innerHTML = bookings.map(b => createBookingCard(b, true)).join('');
  }
  
  // Update Active Bookings Count
  const activeCount = bookings.filter(b => ['pending', 'confirmed'].includes(b.status)).length;
  document.getElementById('overviewActiveBookings').textContent = activeCount;
}

// --- Reservations Logic ---
async function loadReservations() {
  const listEl = document.getElementById('reservationsList');
  listEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading orders...</p></div>';

  try {
    ordersData = await fetchAllBookings();
    renderReservations('all');
    
    // Update badge
    document.getElementById('reservationsCount').textContent = ordersData.length;
    document.getElementById('reservationsCount').hidden = ordersData.length === 0;

  } catch (err) {
    console.error('Error loading reservations:', err);
    listEl.innerHTML = `<p class="error-state">Failed to load reservations. Please try again later.</p>`;
  }
}

async function fetchAllBookings(limit = 100) {
  // Fetch Trip Bookings
  const { data: tripBookings, error: tripError } = await supabase
    .from('trip_bookings')
    .select('*')
    .eq('customer_email', currentUser.email) // Assuming RLS allows reading own email
    .order('created_at', { ascending: false })
    .limit(limit);

  // Fetch Hotel Bookings (assuming table exists)
  let hotelBookings = [];
  try {
    const { data, error } = await supabase
      .from('hotel_bookings')
      .select('*')
      .eq('customer_email', currentUser.email)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && data) hotelBookings = data;
  } catch (e) {
    console.warn('Hotel bookings table not found or error:', e);
  }

  // Normalize Data
  const trips = (tripBookings || []).map(t => ({
    type: 'trip',
    id: t.id,
    title: t.trip_slug || 'Trip Booking', // Ideally join with trips table for title
    date: t.trip_date,
    created_at: t.created_at,
    status: t.status || 'pending',
    price: t.total_price,
    people: (t.num_adults || 0) + (t.num_children || 0)
  }));

  const hotels = hotelBookings.map(h => ({
    type: 'hotel',
    id: h.id,
    title: h.hotel_name || 'Hotel Booking',
    date: h.arrival_date,
    created_at: h.created_at,
    status: h.status || 'pending',
    price: h.total_price,
    people: (h.adults || 0) + (h.children || 0)
  }));

  // Merge and Sort
  return [...trips, ...hotels].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

function renderReservations(filter) {
  const listEl = document.getElementById('reservationsList');
  const filtered = filter === 'all' ? ordersData : ordersData.filter(o => o.status === filter);

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>No ${filter !== 'all' ? filter : ''} bookings found.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(b => createBookingCard(b)).join('');
}

function createBookingCard(booking, simple = false) {
  const date = new Date(booking.date || booking.created_at).toLocaleDateString();
  const icon = booking.type === 'trip' ? '🚤' : '🏨';
  const statusClass = booking.status.toLowerCase();
  
  // Determine badge text based on translation (simplified here)
  const statusText = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled'
  }[statusClass] || booking.status;

  if (simple) {
    return `
      <div class="reservation-card simple">
        <div class="res-info">
          <h4>${icon} ${booking.title}</h4>
          <span class="res-status ${statusClass}">${statusText}</span>
        </div>
        <div class="res-meta">
          <span>${date}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="reservation-card">
      <div class="res-main">
        <div class="res-info">
          <h4>${icon} ${booking.title}</h4>
          <div class="res-meta">
            <span>📅 ${date}</span>
            <span>👥 ${booking.people} guests</span>
            <span>💰 €${Number(booking.price).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div class="res-actions">
        <span class="res-status ${statusClass}">${statusText}</span>
        <!-- <button class="btn btn-sm btn-ghost">Details</button> -->
      </div>
    </div>
  `;
}

// Setup Reservation Tabs
document.querySelectorAll('.tabs-line .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs-line .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderReservations(btn.dataset.filter);
  });
});

// --- Achievements Logic ---
async function loadAchievements() {
  const container = document.getElementById('badgesGrid');
  
  // Mockup badges for now, or load from visited places
  const visitedCount = (currentProfile.visited_places || []).length;
  
  // Simple logic: Badge for every 5 places
  const badges = [];
  
  if (visitedCount >= 1) badges.push({ name: 'First Step', icon: '🦶', desc: 'Visited 1 place' });
  if (visitedCount >= 5) badges.push({ name: 'Explorer', icon: '🧭', desc: 'Visited 5 places' });
  if (visitedCount >= 10) badges.push({ name: 'Adventurer', icon: '🤠', desc: 'Visited 10 places' });
  if (visitedCount >= 20) badges.push({ name: 'Expert', icon: '🗺️', desc: 'Visited 20 places' });
  if (currentProfile.level >= 2) badges.push({ name: 'Level Up', icon: '🆙', desc: 'Reached Level 2' });

  if (badges.length === 0) {
    container.innerHTML = `<p class="empty-state">No badges yet. Go explore Cyprus!</p>`;
    return;
  }

  container.innerHTML = badges.map(badge => `
    <div class="badge-card">
      <div class="badge-icon">${badge.icon}</div>
      <h3>${badge.name}</h3>
      <p>${badge.desc}</p>
    </div>
  `).join('');
}

// --- Settings Logic ---
function updateSettingsForms() {
  const usernameInput = document.getElementById('settingsUsername');
  if (usernameInput) usernameInput.value = currentProfile?.username || '';
  
  const avatarPreview = document.getElementById('settingsAvatarPreview');
  if (avatarPreview) avatarPreview.src = currentProfile?.avatar_url || 'assets/cyprus_logo-1000x1054.png';
}

// Avatar Upload
const uploadBtn = document.getElementById('uploadAvatarBtn');
const fileInput = document.getElementById('avatarInput');

if (uploadBtn && fileInput) {
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      uploadBtn.textContent = 'Uploading...';
      uploadBtn.disabled = true;
      
      const updated = await uploadAvatar(file);
      currentProfile = updated;
      
      updateSidebarProfile();
      updateSettingsForms();
      showToast('Avatar updated successfully!', 'success');
      
    } catch (err) {
      console.error('Avatar upload error:', err);
      showToast(err.message, 'error');
    } finally {
      uploadBtn.textContent = 'Change';
      uploadBtn.disabled = false;
    }
  });
}

// Edit Username
const editUserBtn = document.getElementById('editUsernameBtn');
const usernameInput = document.getElementById('settingsUsername');

if (editUserBtn && usernameInput) {
  editUserBtn.addEventListener('click', async () => {
    if (usernameInput.disabled) {
      usernameInput.disabled = false;
      usernameInput.focus();
      editUserBtn.textContent = 'Save';
      editUserBtn.classList.add('btn-primary');
      editUserBtn.classList.remove('btn-ghost');
    } else {
      // Save
      const newName = usernameInput.value.trim();
      if (!newName) return;
      
      try {
        editUserBtn.textContent = 'Saving...';
        const updated = await updateMyUsername(newName);
        currentProfile = updated;
        
        updateSidebarProfile();
        showToast('Username updated!', 'success');
        
        // Reset UI
        usernameInput.disabled = true;
        editUserBtn.textContent = 'Edit';
        editUserBtn.classList.remove('btn-primary');
        editUserBtn.classList.add('btn-ghost');
        
      } catch (err) {
        showToast(err.message, 'error');
        editUserBtn.textContent = 'Save';
      }
    }
  });
}

// Delete Account
const deleteBtn = document.getElementById('deleteAccountBtn');
if (deleteBtn) {
  deleteBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      // In a real app, we'd call an Edge Function. 
      // Here we just sign out and maybe clear data via RLS if allowed.
      alert('Please contact support@cypruseye.com to permanently delete your data.');
    }
  });
}

// Global Badge Updater
async function updateGlobalBadges() {
  try {
    const orders = await fetchAllBookings(100);
    const count = orders.length;
    const badge = document.getElementById('reservationsCount');
    if (badge) {
      badge.textContent = count;
      badge.hidden = count === 0;
    }
  } catch (e) { /* ignore */ }
}

// Helper Toast
function showToast(message, type = 'info') {
  if (window.Toast) {
    new window.Toast(message, type); // Assuming Toast class exists
  } else {
    alert(message);
  }
}
