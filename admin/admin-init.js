// Simple admin panel initialization
// Authentication is handled by /admin/index.html before loading dashboard

import { sb, supabase } from '/js/supabaseClient.js';

// Configuration
const ADMIN_CONFIG = {
  requiredUserId: '3c72e07a-9dda-4fa8-8002-1f8f66ba0e76',
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

// Verify session on load
async function verifySession() {
  try {
    const client = sb || supabase || window.supabase;
    
    if (!client) {
      console.error('Supabase client not available');
      window.location.replace('/admin/login.html');
      return false;
    }
    
    const { data: { session } } = await client.auth.getSession();
    
    if (!session || !session.user) {
      console.log('No session found - redirecting to login');
      window.location.replace('/admin/login.html');
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
    console.error('Session verification failed:', error);
    window.location.replace('/admin/login.html');
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
  
  // Verify session
  const isValid = await verifySession();
  
  if (!isValid) {
    return;
  }
  
  // Show admin container
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
