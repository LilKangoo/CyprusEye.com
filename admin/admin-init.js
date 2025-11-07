// Simple admin panel initialization
// Authentication is ALREADY VERIFIED by /admin/index.html before loading dashboard
// This file only initializes UI - NO AUTH CHECKS HERE to prevent redirect loops

import { sb, supabase } from '/js/supabaseClient.js';

// Configuration
const ADMIN_CONFIG = {
  requiredUserId: '15f3d442-092d-4eb8-9627-db90da0283eb',
  requiredEmail: 'lilkangoomedia@gmail.com'
};

// State
const adminState = {
  user: null,
  profile: null,
  isAdmin: false,
  currentView: 'dashboard'
};

// Utility functions
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function showElement(el) {
  if (el) el.hidden = false;
}

function hideElement(el) {
  if (el) el.hidden = true;
}

// Load user profile data (NO redirects, just load data)
async function loadUserProfile() {
  try {
    const client = sb || supabase || window.supabase;
    
    if (!client) {
      console.warn('Supabase client not available yet');
      return false;
    }
    
    const { data: { session } } = await client.auth.getSession();
    
    if (!session || !session.user) {
      console.warn('No session - but index.html should have caught this');
      return false;
    }
    
    adminState.user = session.user;
    
    // Load profile
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profile) {
      adminState.profile = profile;
      adminState.isAdmin = profile.is_admin;
    }
    
    // Update header
    updateAdminHeader();
    
    return true;
    
  } catch (error) {
    console.error('Failed to load profile:', error);
    return false;
  }
}

// Update admin header
function updateAdminHeader() {
  const nameEl = $('#adminUserName');
  if (nameEl && adminState.profile) {
    nameEl.textContent = adminState.profile.username || adminState.profile.name || adminState.user.email;
  }
}

// Handle logout
async function handleLogout() {
  try {
    const client = sb || supabase || window.supabase;
    
    if (client) {
      await client.auth.signOut();
    }
    
    window.location.replace('/admin/login.html');
    
  } catch (error) {
    console.error('Logout failed:', error);
    window.location.replace('/admin/login.html');
  }
}

// Initialize
async function initAdminDashboard() {
  console.log('Initializing admin dashboard...');
  
  // Load user profile (no redirects)
  await loadUserProfile();
  
  // Show admin container (already visible by default now)
  const container = $('#adminContainer');
  if (container) {
    showElement(container);
  }
  
  // Setup logout button
  const logoutBtn = $('#btnAdminLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleLogout();
    });
  }
  
  console.log('Admin dashboard initialized');
}

// Export for global access
window.adminState = adminState;
window.handleLogout = handleLogout;

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminDashboard);
} else {
  initAdminDashboard();
}
