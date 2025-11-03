/**
 * ADMIN PANEL - CYPRUSEYE.COM
 * Main JavaScript for admin panel functionality
 */

// =====================================================
// CONFIGURATION & GLOBALS
// =====================================================

const ADMIN_CONFIG = {
  requiredEmail: 'lilkangoomedia@gmail.com',
  requiredUserId: '15f3d442-092d-4eb8-9627-db90da0283eb',
  usersPerPage: 20,
};

let adminState = {
  user: null,
  profile: null,
  isAdmin: false,
  currentView: 'dashboard',
  usersPage: 1,
  usersTotal: 0,
  loading: true,
  pois: [],
  poisLoaded: false,
  poiLoading: false,
  poiSearch: '',
  poiFilterCategory: 'all',
  poiFilterStatus: 'all',
  poiDataSource: 'supabase',
  selectedPoi: null,
  poiFormMode: 'create',
};

// =====================================================
// SUPABASE CLIENT
// =====================================================

// Wait for Supabase client to be available
function getSupabaseClient() {
  if (typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }
  if (window.sb) {
    return window.sb;
  }
  if (window.__SB__) {
    return window.__SB__;
  }
  return null;
}

// Helper to ensure Supabase is available
function ensureSupabase() {
  if (!sb) {
    sb = getSupabaseClient();
  }
  return sb;
}

// Try to get client immediately
let sb = getSupabaseClient();

// If not available, wait a bit
if (!sb) {
  console.warn('Supabase client not immediately available, waiting...');
}

// =====================================================
// DOM HELPERS
// =====================================================

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => root.querySelectorAll(selector);

function showElement(element) {
  if (element) {
    element.hidden = false;
    element.style.display = '';
  }
}

function hideElement(element) {
  if (element) {
    element.hidden = true;
    element.style.display = 'none';
  }
}

function setLoading(isLoading) {
  adminState.loading = isLoading;
  const loadingEl = $('#adminLoading');
  if (isLoading) {
    showElement(loadingEl);
  } else {
    hideElement(loadingEl);
  }
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================

function showToast(message, type = 'info') {
  // Use existing toast system if available
  if (window.showToast) {
    window.showToast(message, type);
    return;
  }

  // Fallback toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// AUTHENTICATION & ACCESS CONTROL
// =====================================================

async function checkAdminAccess() {
  try {
    console.log('=== checkAdminAccess START ===');
    setLoading(true);

    // Ensure Supabase client is available
    if (!sb) {
      sb = getSupabaseClient();
    }
    
    if (!sb) {
      throw new Error('Supabase client not available');
    }

    // Get current session
    console.log('Getting session...');
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw sessionError;
    }
    
    if (!session || !session.user) {
      console.log('No active session - showing login screen');
      showLoginScreen();
      return false;
    }

    console.log('Session found. User:', session.user.email, 'ID:', session.user.id);
    adminState.user = session.user;

    // Check if user ID matches admin
    console.log('Required admin ID:', ADMIN_CONFIG.requiredUserId);
    console.log('Current user ID:', session.user.id);
    
    if (session.user.id !== ADMIN_CONFIG.requiredUserId) {
      console.log('❌ User ID does NOT match admin ID');
      console.log('User is not admin:', session.user.id);
      showAccessDenied();
      return false;
    }
    
    console.log('✅ User ID matches! Checking profile...');

    // Get user profile and verify is_admin flag
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Profile loaded:', profile);
    console.log('is_admin flag:', profile?.is_admin);

    if (!profile || !profile.is_admin) {
      console.log('❌ User profile does not have admin flag');
      showAccessDenied();
      return false;
    }

    console.log('✅ Admin flag confirmed!');
    adminState.profile = profile;
    adminState.isAdmin = true;

    console.log('✅✅✅ Admin access GRANTED:', profile.username || profile.email);
    console.log('=== checkAdminAccess END - SUCCESS ===');
    showAdminPanel();
    return true;

  } catch (error) {
    console.error('❌ Admin access check failed:', error);
    console.log('=== checkAdminAccess END - FAILED ===');
    showLoginScreen();
    return false;
  } finally {
    setLoading(false);
  }
}

function showLoginScreen() {
  console.log('showLoginScreen() called');
  
  const loading = $('#adminLoading');
  const accessDenied = $('#adminAccessDenied');
  const container = $('#adminContainer');
  const loginScreen = $('#adminLoginScreen');
  
  console.log('Elements:', {
    loading: !!loading,
    accessDenied: !!accessDenied,
    container: !!container,
    loginScreen: !!loginScreen
  });
  
  hideElement(loading);
  hideElement(accessDenied);
  hideElement(container);
  showElement(loginScreen);
  
  console.log('Login screen should now be visible');
}

function showAccessDenied() {
  hideElement($('#adminLoading'));
  hideElement($('#adminLoginScreen'));
  hideElement($('#adminContainer'));
  showElement($('#adminAccessDenied'));
}

function showAdminPanel() {
  hideElement($('#adminLoading'));
  hideElement($('#adminLoginScreen'));
  hideElement($('#adminAccessDenied'));
  showElement($('#adminContainer'));
  
  // Update admin info in header
  updateAdminHeader();
  
  // Load initial data
  loadDashboardData();
}

function updateAdminHeader() {
  const nameEl = $('#adminUserName');
  if (nameEl && adminState.profile) {
    nameEl.textContent = adminState.profile.username || adminState.profile.name || adminState.user.email;
  }
}

// =====================================================
// NAVIGATION
// =====================================================

function switchView(viewName) {
  // Update state
  adminState.currentView = viewName;

  // Update nav items
  $$('.admin-nav-item').forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update views
  $$('.admin-view').forEach(view => {
    if (view.id === `view${viewName.charAt(0).toUpperCase()}${viewName.slice(1)}`) {
      view.classList.add('active');
      view.hidden = false;
    } else {
      view.classList.remove('active');
      view.hidden = true;
    }
  });

  // Update breadcrumb
  const breadcrumb = $('#breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `<span>${viewName.charAt(0).toUpperCase()}${viewName.slice(1)}</span>`;
  }

  // Load view-specific data
  switch (viewName) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'users':
      loadUsersData();
      break;
    case 'pois':
      loadPoisData();
      break;
    case 'content':
      loadContentData();
      break;
    case 'diagnostics':
      loadDiagnosticsData();
      break;
  }
}

// =====================================================
// DASHBOARD DATA
// =====================================================

async function loadDashboardData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Supabase client not available');
    }
    
    console.log('Loading dashboard data...');
    
    // Load system diagnostics
    const { data: diagnostics, error: diagError } = await client
      .from('admin_system_diagnostics')
      .select('*');

    if (diagError) {
      console.error('Diagnostics error:', diagError);
      throw diagError;
    }

    console.log('Diagnostics loaded:', diagnostics);

    // Update stat cards
    if (diagnostics && diagnostics.length > 0) {
      diagnostics.forEach(metric => {
        // Convert metric name to element ID
        // e.g., "total_users" -> "statTotalUsers"
        const elementId = `stat${metric.metric.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('')}`;
        
        console.log(`Setting ${elementId} = ${metric.value}`);
        
        const valueEl = $(`#${elementId}`);
        if (valueEl) {
          valueEl.textContent = metric.value;
        } else {
          console.warn(`Element #${elementId} not found`);
        }
      });
    } else {
      console.warn('No diagnostics data received');
    }

    // Load recent activity
    await loadRecentActivity();

  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

async function loadRecentActivity() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: activity, error } = await client.rpc('admin_get_activity_log', { 
      limit_count: 10 
    });

    if (error) throw error;

    const tableBody = $('#recentActivityTable');
    if (!tableBody) return;

    if (!activity || activity.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="table-loading">No recent activity</td></tr>';
      return;
    }

    tableBody.innerHTML = activity.map(item => `
      <tr>
        <td>
          <span class="badge badge-${item.activity_type === 'comment' ? 'success' : 'warning'}">
            ${item.activity_type}
          </span>
        </td>
        <td>${item.username || 'Unknown'}</td>
        <td>${JSON.stringify(item.details).slice(0, 60)}...</td>
        <td>${formatDate(item.created_at)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Failed to load recent activity:', error);
  }
}

// =====================================================
// USERS MANAGEMENT
// =====================================================

async function loadUsersData(page = 1) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    adminState.usersPage = page;

    const { data: users, error, count } = await client
      .from('admin_users_overview')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * ADMIN_CONFIG.usersPerPage, page * ADMIN_CONFIG.usersPerPage - 1);

    if (error) throw error;

    adminState.usersTotal = count || 0;

    const tableBody = $('#usersTable');
    if (!tableBody) return;

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No users found</td></tr>';
      return;
    }

    tableBody.innerHTML = users.map(user => `
      <tr>
        <td>
          ${user.username || 'N/A'}
          ${user.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
        </td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.level || 0}</td>
        <td>${user.xp || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="badge ${user.banned_until ? 'badge-danger' : 'badge-success'}">
            ${user.banned_until ? 'Banned' : 'Active'}
          </span>
        </td>
        <td>
          <button class="btn-secondary" onclick="viewUserDetails('${user.id}')">
            View
          </button>
        </td>
      </tr>
    `).join('');

    // Update pagination
    updateUsersPagination();

  } catch (error) {
    console.error('Failed to load users:', error);
    showToast('Failed to load users', 'error');
  }
}

function updateUsersPagination() {
  const totalPages = Math.ceil(adminState.usersTotal / ADMIN_CONFIG.usersPerPage);
  const currentPage = adminState.usersPage;

  const prevBtn = $('#btnUsersPrev');
  const nextBtn = $('#btnUsersNext');
  const infoEl = $('#usersPaginationInfo');

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (infoEl) infoEl.textContent = `Page ${currentPage} of ${totalPages}`;
}

async function viewUserDetails(userId) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Loading user details...', 'info');

    const { data, error } = await client.rpc('admin_get_user_details', { 
      target_user_id: userId 
    });

    if (error) throw error;

    // Show modal with user details
    const modal = $('#userDetailModal');
    const content = $('#userDetailContent');
    
    if (!modal || !content) return;
    
    const profile = data.profile;
    const stats = data.stats;
    const isCurrentUserAdmin = profile && profile.is_admin;
    const isSelf = profile && profile.id === ADMIN_CONFIG.requiredUserId;

    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <!-- Profile Info -->
        <div>
          <h4 style="margin-bottom: 12px; color: var(--admin-text);">Profile Information</h4>
          <div style="background: var(--admin-bg); padding: 20px; border-radius: 8px;">
            <table style="width: 100%; color: var(--admin-text);">
              <tr>
                <td style="padding: 8px 0; font-weight: 500;">Username:</td>
                <td style="padding: 8px 0;">${profile.username || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500;">Email:</td>
                <td style="padding: 8px 0;">${profile.email || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500;">Level:</td>
                <td style="padding: 8px 0;">${profile.level || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500;">XP:</td>
                <td style="padding: 8px 0;">${profile.xp || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500;">Joined:</td>
                <td style="padding: 8px 0;">${formatDate(data.auth_data.created_at)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500;">Last Sign In:</td>
                <td style="padding: 8px 0;">${formatDate(data.auth_data.last_sign_in_at)}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Statistics -->
        <div>
          <h4 style="margin-bottom: 12px; color: var(--admin-text);">Activity Statistics</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div style="background: var(--admin-bg); padding: 16px; border-radius: 8px; text-align: center;">
              <p style="color: var(--admin-text-muted); font-size: 12px; margin-bottom: 4px;">Comments</p>
              <p style="color: var(--admin-text); font-size: 24px; font-weight: 700;">${stats.comments || 0}</p>
            </div>
            <div style="background: var(--admin-bg); padding: 16px; border-radius: 8px; text-align: center;">
              <p style="color: var(--admin-text-muted); font-size: 12px; margin-bottom: 4px;">Ratings</p>
              <p style="color: var(--admin-text); font-size: 24px; font-weight: 700;">${stats.ratings || 0}</p>
            </div>
            <div style="background: var(--admin-bg); padding: 16px; border-radius: 8px; text-align: center;">
              <p style="color: var(--admin-text-muted); font-size: 12px; margin-bottom: 4px;">Visits</p>
              <p style="color: var(--admin-text); font-size: 24px; font-weight: 700;">${stats.visits || 0}</p>
            </div>
            <div style="background: var(--admin-bg); padding: 16px; border-radius: 8px; text-align: center;">
              <p style="color: var(--admin-text-muted); font-size: 12px; margin-bottom: 4px;">Tasks</p>
              <p style="color: var(--admin-text); font-size: 24px; font-weight: 700;">${stats.completed_tasks || 0}</p>
            </div>
          </div>
        </div>

        <!-- Admin Actions -->
        ${!isSelf ? `
        <div>
          <h4 style="margin-bottom: 12px; color: var(--admin-text);">Admin Actions</h4>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn-primary" onclick="adjustUserXP('${userId}', 100); hideElement($('#userDetailModal'));">
              +100 XP
            </button>
            <button class="btn-primary" onclick="adjustUserXP('${userId}', 500); hideElement($('#userDetailModal'));">
              +500 XP
            </button>
            <button class="btn-secondary" onclick="adjustUserXP('${userId}', -100); hideElement($('#userDetailModal'));">
              -100 XP
            </button>
            <button class="btn-secondary" onclick="adjustUserXP('${userId}', -500); hideElement($('#userDetailModal'));">
              -500 XP
            </button>
            ${!isCurrentUserAdmin ? `
            <button class="btn-secondary" style="background: var(--admin-danger); border-color: var(--admin-danger);" onclick="banUser('${userId}'); hideElement($('#userDetailModal'));">
              Ban User (30d)
            </button>
            ` : ''}
          </div>
        </div>
        ` : '<p style="color: var(--admin-text-muted); font-style: italic;">Cannot perform actions on your own account</p>'}
      </div>
    `;

    showElement(modal);

  } catch (error) {
    console.error('Failed to load user details:', error);
    showToast('Failed to load user details', 'error');
  }
}

// Make function global for onclick
window.viewUserDetails = viewUserDetails;

// =====================================================
// DIAGNOSTICS
// =====================================================

async function loadDiagnosticsData() {
  try {
    const client = ensureSupabase();
    
    // Check database connection
    const dbStatus = $('#dbStatus');
    try {
      if (!client) throw new Error('Client not available');
      const { error } = await client.from('profiles').select('id').limit(1);
      if (error) throw error;
      if (dbStatus) {
        dbStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Connected</span>';
      }
    } catch (error) {
      if (dbStatus) {
        dbStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Error</span>';
      }
    }

    // Check API
    const apiStatus = $('#apiStatus');
    try {
      if (!client) throw new Error('Client not available');
      const { error } = await client.auth.getSession();
      if (error) throw error;
      if (apiStatus) {
        apiStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Operational</span>';
      }
    } catch (error) {
      if (apiStatus) {
        apiStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Error</span>';
      }
    }

    // Check storage
    const storageStatus = $('#storageStatus');
    if (storageStatus) {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        storageStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Available</span>';
      } catch (error) {
        storageStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Unavailable</span>';
      }
    }

    // Load system metrics
    if (!client) {
      console.error('Cannot load system metrics - client not available');
      return;
    }
    
    const { data: metrics, error } = await client
      .from('admin_system_diagnostics')
      .select('*');

    if (error) throw error;

    const metricsTable = $('#systemMetricsTable');
    if (!metricsTable) return;

    if (!metrics || metrics.length === 0) {
      metricsTable.innerHTML = '<tr><td colspan="3" class="table-loading">No metrics available</td></tr>';
      return;
    }

    metricsTable.innerHTML = metrics.map(metric => `
      <tr>
        <td style="font-weight: 500;">${metric.metric.replace(/_/g, ' ').toUpperCase()}</td>
        <td style="font-size: 18px; font-weight: 600;">${metric.value}</td>
        <td style="color: var(--admin-text-muted);">${metric.description}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Failed to load diagnostics:', error);
    showToast('Failed to load diagnostics', 'error');
  }
}

// =====================================================
// LOGIN
// =====================================================

async function handleAdminLogin(email, password) {
  try {
    console.log('handleAdminLogin called with email:', email);
    
    // Ensure Supabase client is available
    if (!sb) {
      sb = getSupabaseClient();
    }
    
    if (!sb) {
      throw new Error('Supabase client not available. Please refresh the page.');
    }
    
    console.log('Attempting sign in...');
    
    // Sign in with Supabase
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('Login failed - no user data');
    }

    console.log('Sign in successful! User ID:', data.user.id);
    console.log('Checking admin access...');

    // Check if user has admin access
    const hasAccess = await checkAdminAccess();
    
    if (!hasAccess) {
      console.log('Admin access denied for user:', data.user.id);
      // Access denied screen should already be showing from checkAdminAccess()
      throw new Error('You do not have admin access. Only lilkangoomedia@gmail.com is authorized.');
    }
    
    console.log('Admin access granted! Loading panel...');

  } catch (error) {
    console.error('Login failed:', error);
    
    let errorMessage = 'Login failed. Please check your credentials.';
    if (error.message) {
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address first.';
      } else if (error.message.includes('admin access')) {
        errorMessage = error.message; // Use the admin access error message
      }
    }
    
    throw new Error(errorMessage);
  }
}

// =====================================================
// LOGOUT
// =====================================================

async function handleLogout() {
  try {
    if (!sb) {
      sb = getSupabaseClient();
    }
    
    if (!sb) {
      console.error('Supabase client not available');
      showLoginScreen();
      return;
    }
    
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
      showLoginScreen();
    }, 500);

  } catch (error) {
    console.error('Logout failed:', error);
    showToast('Logout failed', 'error');
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (error) {
    return 'Invalid date';
  }
}

function formatCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '—';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function slugify(value) {
  if (!value) return '';

  return value
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return value
    .toString()
    .replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function initEventListeners() {
  const sidebar = $('#adminSidebar');
  const menuToggle = $('#adminMenuToggle');
  const sidebarOverlay = $('#adminSidebarOverlay');
  let mobileSidebarOpen = false;

  const updateSidebarState = (isOpen) => {
    if (!sidebar) return;

    mobileSidebarOpen = isOpen;
    sidebar.classList.toggle('is-open', isOpen);

    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.classList.toggle('is-active', isOpen);
    }

    if (sidebarOverlay) {
      if (isOpen) {
        sidebarOverlay.hidden = false;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => sidebarOverlay.classList.add('is-active'));
        } else {
          sidebarOverlay.classList.add('is-active');
        }
      } else {
        sidebarOverlay.classList.remove('is-active');
        setTimeout(() => {
          if (!mobileSidebarOpen) {
            sidebarOverlay.hidden = true;
          }
        }, 300);
      }
    }

    document.body.classList.toggle('admin-sidebar-open', isOpen);
  };

  const closeSidebarForMobile = () => {
    if (window.innerWidth <= 1024) {
      updateSidebarState(false);
    }
  };

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      updateSidebarState(!mobileSidebarOpen);
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => updateSidebarState(false));
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && mobileSidebarOpen) {
      updateSidebarState(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileSidebarOpen) {
      updateSidebarState(false);
    }
  });

  // Login form
  const loginForm = $('#adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const form = e.target;
      const email = form.email.value;
      const password = form.password.value;
      const submitBtn = $('#btnAdminLogin');
      const errorDiv = $('#adminLoginError');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnSpinner = submitBtn.querySelector('.btn-spinner');
      
      // Disable form
      submitBtn.disabled = true;
      hideElement(btnText);
      showElement(btnSpinner);
      hideElement(errorDiv);
      
      try {
        await handleAdminLogin(email, password);
        // Success - checkAdminAccess will handle showing the panel
      } catch (error) {
        // Show error
        errorDiv.textContent = error.message || 'Login failed';
        showElement(errorDiv);
      } finally {
        // Re-enable form
        submitBtn.disabled = false;
        showElement(btnText);
        hideElement(btnSpinner);
      }
    });
  }

  // Navigation
  $$('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      if (viewName) {
        switchView(viewName);
        closeSidebarForMobile();
      }
    });
  });

  // Logout
  const logoutBtn = $('#btnAdminLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Users pagination
  const usersPrevBtn = $('#btnUsersPrev');
  const usersNextBtn = $('#btnUsersNext');
  
  if (usersPrevBtn) {
    usersPrevBtn.addEventListener('click', () => {
      if (adminState.usersPage > 1) {
        loadUsersData(adminState.usersPage - 1);
      }
    });
  }

  if (usersNextBtn) {
    usersNextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(adminState.usersTotal / ADMIN_CONFIG.usersPerPage);
      if (adminState.usersPage < totalPages) {
        loadUsersData(adminState.usersPage + 1);
      }
    });
  }

  // User search
  const searchBtn = $('#btnUserSearch');
  const searchInput = $('#userSearch');
  
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        searchUsers(query);
      } else {
        loadUsersData(1);
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchBtn.click();
      }
    });
  }

  // User detail modal
  const closeModalBtn = $('#btnCloseUserModal');
  const modalOverlay = $('#userDetailModalOverlay');
  const modal = $('#userDetailModal');

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      hideElement(modal);
    });
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', () => {
      hideElement(modal);
    });
  }

  // Comment detail modal
  const btnCloseCommentDetail = $('#btnCloseCommentDetail');
  const commentDetailOverlay = $('#commentDetailModalOverlay');
  const commentDetailModal = $('#commentDetailModal');

  if (btnCloseCommentDetail) {
    btnCloseCommentDetail.addEventListener('click', () => {
      hideElement(commentDetailModal);
    });
  }

  if (commentDetailOverlay) {
    commentDetailOverlay.addEventListener('click', () => {
      hideElement(commentDetailModal);
    });
  }

  // Comment edit modal
  const btnCloseCommentEdit = $('#btnCloseCommentEdit');
  const commentEditOverlay = $('#commentEditModalOverlay');
  const commentEditModal = $('#commentEditModal');
  const commentEditCancel = $('#commentEditCancel');

  if (btnCloseCommentEdit) {
    btnCloseCommentEdit.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  if (commentEditOverlay) {
    commentEditOverlay.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  if (commentEditCancel) {
    commentEditCancel.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  // POI filters and actions
  const poiSearchInput = $('#poiSearchInput');
  if (poiSearchInput) {
    poiSearchInput.addEventListener('input', (event) => {
      adminState.poiSearch = event.target.value || '';
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const poiCategoryFilter = $('#poiCategoryFilter');
  if (poiCategoryFilter) {
    poiCategoryFilter.addEventListener('change', (event) => {
      adminState.poiFilterCategory = event.target.value;
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const poiStatusFilter = $('#poiStatusFilter');
  if (poiStatusFilter) {
    poiStatusFilter.addEventListener('change', (event) => {
      adminState.poiFilterStatus = event.target.value;
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const addPoiBtn = $('#btnAddPoi');
  if (addPoiBtn) {
    addPoiBtn.addEventListener('click', () => openPoiForm());
  }

  const refreshPoisBtn = $('#btnRefreshPois');
  if (refreshPoisBtn) {
    refreshPoisBtn.addEventListener('click', () => refreshPoiList());
  }

  const poiForm = $('#poiForm');
  if (poiForm) {
    poiForm.addEventListener('submit', handlePoiFormSubmit);
  }

  const poiFormCancel = $('#poiFormCancel');
  if (poiFormCancel) {
    poiFormCancel.addEventListener('click', () => closePoiForm());
  }

  const poiFormClose = $('#btnClosePoiForm');
  if (poiFormClose) {
    poiFormClose.addEventListener('click', () => closePoiForm());
  }

  const poiFormOverlay = $('#poiFormModalOverlay');
  if (poiFormOverlay) {
    poiFormOverlay.addEventListener('click', () => closePoiForm());
  }

  const poiDetailClose = $('#btnClosePoiDetail');
  if (poiDetailClose) {
    poiDetailClose.addEventListener('click', () => closePoiDetail());
  }

  const poiDetailOverlay = $('#poiDetailModalOverlay');
  if (poiDetailOverlay) {
    poiDetailOverlay.addEventListener('click', () => closePoiDetail());
  }
}

async function searchUsers(query) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    const { data: users, error } = await client
      .from('admin_users_overview')
      .select('*')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(ADMIN_CONFIG.usersPerPage);

    if (error) throw error;

    const tableBody = $('#usersTable');
    if (!tableBody) return;

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No users found</td></tr>';
      return;
    }

    tableBody.innerHTML = users.map(user => `
      <tr>
        <td>
          ${user.username || 'N/A'}
          ${user.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
        </td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.level || 0}</td>
        <td>${user.xp || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="badge ${user.banned_until ? 'badge-danger' : 'badge-success'}">
            ${user.banned_until ? 'Banned' : 'Active'}
          </span>
        </td>
        <td>
          <button class="btn-secondary" onclick="viewUserDetails('${user.id}')">
            View
          </button>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('User search failed:', error);
    showToast('Search failed', 'error');
  }
}

// =====================================================
// ADVANCED ADMIN FUNCTIONS
// =====================================================

// Adjust User XP
async function adjustUserXP(userId, xpChange, reason = 'Admin adjustment') {
  if (!confirm(`Adjust XP by ${xpChange > 0 ? '+' : ''}${xpChange}?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Adjusting XP...', 'info');
    
    const { data, error } = await client.rpc('admin_adjust_user_xp', {
      target_user_id: userId,
      xp_change: xpChange,
      reason: reason
    });
    
    if (error) throw error;
    
    showToast(`XP adjusted: ${data.old_xp} → ${data.new_xp}`, 'success');
    
    // Reload users if on users view
    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }
    
  } catch (error) {
    console.error('XP adjustment failed:', error);
    showToast('Failed to adjust XP: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Ban User
async function banUser(userId, reason = 'Violating terms', days = 30) {
  if (!confirm(`Ban this user for ${days} days?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Banning user...', 'info');
    
    const { data, error } = await client.rpc('admin_ban_user', {
      target_user_id: userId,
      ban_reason: reason,
      ban_duration: `${days} days`
    });
    
    if (error) throw error;
    
    showToast('User banned successfully', 'success');
    
    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }
    
  } catch (error) {
    console.error('Ban failed:', error);
    showToast('Failed to ban user: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Unban User
async function unbanUser(userId) {
  if (!confirm('Remove ban from this user?')) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Unbanning user...', 'info');
    
    const { data, error } = await client.rpc('admin_unban_user', {
      target_user_id: userId
    });
    
    if (error) throw error;
    
    showToast('User unbanned successfully', 'success');
    
    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }
    
  } catch (error) {
    console.error('Unban failed:', error);
    showToast('Failed to unban user: ' + (error.message || 'Unknown error'), 'error');
  }
}

// =====================================================
// POI MANAGEMENT
// =====================================================

const DEFAULT_POI_RADIUS = 150;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function setPoiTableLoading(isLoading) {
  const tableBody = $('#poisTableBody');
  if (!tableBody) return;

  if (isLoading) {
    tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading POIs...</td></tr>';
  }
}

function updatePoiDataSourceBadge() {
  const badge = $('#poiDataSourceBadge');
  if (!badge) return;

  if (!adminState.poisLoaded || adminState.poiLoading) {
    badge.hidden = true;
    return;
  }

  badge.hidden = false;
  badge.textContent = adminState.poiDataSource === 'supabase' ? 'Live database' : 'Static dataset';
}

function safeParsePoiData(value) {
  if (!value) return {};

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse POI data payload:', error);
    }
  }

  return {};
}

function normalizePoi(rawPoi, source = 'supabase') {
  if (!rawPoi) return null;

  const data = safeParsePoiData(rawPoi.data);
  const candidateSlug = data.slug || rawPoi.slug || rawPoi.identifier || rawPoi.poi_id || rawPoi.id;
  const name = rawPoi.name || data.name || 'Unnamed POI';
  const slug = (typeof candidateSlug === 'string' && candidateSlug.trim())
    ? candidateSlug.trim()
    : slugify(name);

  const id = rawPoi.id || data.id || slug;

  const latitude = parseFloat(
    rawPoi.latitude
      ?? rawPoi.lat
      ?? data.latitude
      ?? data.lat
      ?? data.location?.lat
      ?? data.location?.latitude
      ?? rawPoi.location?.lat
      ?? rawPoi.location?.latitude
      ?? NaN
  );

  const longitude = parseFloat(
    rawPoi.longitude
      ?? rawPoi.lon
      ?? rawPoi.lng
      ?? data.longitude
      ?? data.lon
      ?? data.lng
      ?? data.location?.lng
      ?? data.location?.lon
      ?? data.location?.longitude
      ?? rawPoi.location?.lng
      ?? rawPoi.location?.lon
      ?? rawPoi.location?.longitude
      ?? NaN
  );

  const radius = parseInt(
    rawPoi.radius
      ?? rawPoi.geofence_radius
      ?? rawPoi.geofenceRadius
      ?? data.radius
      ?? data.geofence_radius
      ?? data.geofenceRadius
      ?? DEFAULT_POI_RADIUS,
    10
  );

  const combinedTags = [
    ...(Array.isArray(data.tags) ? data.tags : []),
    ...(Array.isArray(rawPoi.tags) ? rawPoi.tags : []),
  ];

  const tags = combinedTags.length
    ? combinedTags
    : typeof data.tags === 'string'
      ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : typeof rawPoi.tags === 'string'
        ? rawPoi.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

  const derivedStatus = rawPoi.is_hidden
    ? 'hidden'
    : rawPoi.is_draft
      ? 'draft'
      : rawPoi.is_published === false
        ? 'draft'
        : null;

  const status = (data.status || rawPoi.status || derivedStatus || (source === 'static' ? 'published' : 'draft'))
    .toString()
    .toLowerCase();

  const category = (
    rawPoi.category
    || data.category
    || rawPoi.poi_category
    || data.poi_category
    || 'uncategorized'
  ).toString().toLowerCase();

  return {
    id,
    uuid: isUuid(id) ? id : (isUuid(rawPoi.uuid) ? rawPoi.uuid : (isUuid(data.id) ? data.id : null)),
    slug,
    name,
    description: rawPoi.description || data.description || '',
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    radius: Number.isFinite(radius) ? radius : null,
    category,
    status,
    tags,
    created_at: rawPoi.created_at || data.created_at || null,
    updated_at: rawPoi.updated_at || data.updated_at || rawPoi.created_at || null,
    source,
    raw: rawPoi,
  };
}

function formatCategoryLabel(category) {
  if (!category) return 'Uncategorized';
  return category
    .toString()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function findPoi(poiId) {
  if (!poiId) return null;
  return adminState.pois.find(poi => poi.id === poiId || poi.slug === poiId) || null;
}

function getFilteredPois() {
  const search = adminState.poiSearch.trim().toLowerCase();
  const filterCategory = adminState.poiFilterCategory;
  const filterStatus = adminState.poiFilterStatus;

  return adminState.pois.filter(poi => {
    const matchesCategory = filterCategory === 'all' || (poi.category || 'uncategorized') === filterCategory;
    const matchesStatus = filterStatus === 'all' || (poi.status || 'published') === filterStatus;
    const matchesSearch =
      !search ||
      (poi.name && poi.name.toLowerCase().includes(search)) ||
      (poi.slug && poi.slug.toLowerCase().includes(search)) ||
      (poi.description && poi.description.toLowerCase().includes(search));
    return matchesCategory && matchesStatus && matchesSearch;
  });
}

function updatePoiFilterOptions() {
  const categorySelect = $('#poiCategoryFilter');
  if (!categorySelect) return;

  const categories = Array.from(
    new Set(adminState.pois.map(poi => poi.category || 'uncategorized'))
  ).sort();

  const currentValue = adminState.poiFilterCategory;
  const options = ['all', ...categories];
  categorySelect.innerHTML = options
    .map(category => `<option value="${category}">${category === 'all' ? 'All categories' : formatCategoryLabel(category)}</option>`)
    .join('');

  if (options.includes(currentValue)) {
    categorySelect.value = currentValue;
  } else {
    categorySelect.value = 'all';
    adminState.poiFilterCategory = 'all';
  }
}

function updatePoiStats() {
  const totalEl = $('#poiStatTotal');
  const publishedEl = $('#poiStatPublished');
  const draftsEl = $('#poiStatDrafts');
  const missingEl = $('#poiStatMissingLocation');
  const statusEl = $('#poiStatLiveStatus');

  const total = adminState.pois.length;
  const published = adminState.pois.filter(poi => poi.status === 'published').length;
  const drafts = adminState.pois.filter(poi => poi.status !== 'published').length;
  const missingLocation = adminState.pois.filter(poi => !Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude)).length;

  if (totalEl) totalEl.textContent = total;
  if (publishedEl) publishedEl.textContent = published;
  if (draftsEl) draftsEl.textContent = drafts;
  if (missingEl) missingEl.textContent = missingLocation;
  if (statusEl) {
    statusEl.textContent = adminState.poiDataSource === 'supabase'
      ? 'Live Supabase data'
      : 'Static dataset (read-only)';
  }

  updatePoiDataSourceBadge();
}

function updatePoiTableFooter(filteredCount) {
  const footer = $('#poiTableFooter');
  if (!footer) return;

  if (!adminState.poisLoaded) {
    footer.textContent = '';
    return;
  }

  const total = adminState.pois.length;
  const sourceLabel = adminState.poiDataSource === 'supabase' ? 'Supabase (live)' : 'Static JSON fallback';
  footer.innerHTML = `
    <span>Showing <strong>${filteredCount}</strong> of <strong>${total}</strong> POIs.</span>
    <span>Source: ${sourceLabel}</span>
  `;
}

function renderPoiList() {
  const tableBody = $('#poisTableBody');
  if (!tableBody) return;

  if (!adminState.poisLoaded) {
    setPoiTableLoading(true);
    return;
  }

  const filtered = getFilteredPois();

  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">No POIs match the current filters.</td></tr>';
    updatePoiTableFooter(0);
    return;
  }

  tableBody.innerHTML = filtered.map(poi => {
    const statusPill = `<span class="poi-pill poi-pill--${poi.status}">${poi.status.toUpperCase()}</span>`;
    const sourcePill = poi.source === 'static' ? '<span class="poi-pill poi-pill--static">STATIC</span>' : '';
    const tags = poi.tags && poi.tags.length
      ? poi.tags.map(tag => `<span class="badge badge-info">${escapeHtml(tag)}</span>`).join(' ')
      : '';

    return `
      <tr>
        <td>
          <div class="poi-name">${escapeHtml(poi.name)}</div>
          <div class="poi-slug">${escapeHtml(poi.slug)}</div>
          <div class="poi-meta">
            ${statusPill}
            ${sourcePill}
            ${tags}
          </div>
        </td>
        <td>${formatCategoryLabel(poi.category)}</td>
        <td>${formatCoordinates(poi.latitude, poi.longitude)}</td>
        <td>${poi.radius ? `${poi.radius} m` : '—'}</td>
        <td>${poi.updated_at ? formatDate(poi.updated_at) : poi.created_at ? formatDate(poi.created_at) : '—'}</td>
        <td>
          <div class="poi-table-actions">
            <button class="btn-icon" type="button" title="View details" onclick="viewPoiDetails('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Edit POI" onclick="editPoi('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Delete POI" onclick="deletePoi('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updatePoiTableFooter(filtered.length);
}

async function loadPoisData(forceRefresh = false) {
  if (adminState.poiLoading) {
    return;
  }

  if (!forceRefresh && adminState.poisLoaded) {
    renderPoiList();
    updatePoiStats();
    updatePoiTableFooter(getFilteredPois().length);
    updatePoiFilterOptions();
    return;
  }

  adminState.poiLoading = true;
  setPoiTableLoading(true);

  let loaded = false;
  const client = ensureSupabase();

  if (client) {
    try {
      const { data: pois, error } = await client
        .from('pois')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (Array.isArray(pois)) {
        adminState.pois = pois.map(poi => normalizePoi(poi, 'supabase')).filter(Boolean);
        adminState.poiDataSource = 'supabase';
        loaded = true;
      }
    } catch (error) {
      console.error('Failed to load POIs from Supabase:', error);
      showToast('Live POI data unavailable. Loading static dataset.', 'warning');
    }
  }

  if (!loaded) {
    try {
      const response = await fetch('/assets/pois.json');
      if (!response.ok) {
        throw new Error('Failed to load static POIs');
      }
      const staticPois = await response.json();
      adminState.pois = Array.isArray(staticPois)
        ? staticPois.map(poi => normalizePoi(poi, 'static')).filter(Boolean)
        : [];
      adminState.poiDataSource = 'static';
    } catch (error) {
      console.error('Failed to load fallback POIs:', error);
      adminState.pois = [];
      adminState.poiDataSource = 'static';
      showToast('Unable to load POIs', 'error');
    }
  }

  adminState.poiLoading = false;
  adminState.poisLoaded = true;

  updatePoiFilterOptions();
  updatePoiStats();
  renderPoiList();
}

function viewPoiDetails(poiId) {
  const poi = findPoi(poiId);
  if (!poi) {
    showToast('POI not found', 'error');
    return;
  }

  adminState.selectedPoi = poi;

  const title = $('#poiDetailTitle');
  const content = $('#poiDetailContent');
  const modal = $('#poiDetailModal');

  if (title) {
    title.textContent = poi.name;
  }

  if (content) {
    const tags = poi.tags && poi.tags.length
      ? poi.tags.map(tag => `<span class="badge badge-info">${escapeHtml(tag)}</span>`).join(' ')
      : '<span style="color: var(--admin-text-muted);">No tags</span>';

    const description = poi.description
      ? escapeHtml(poi.description).replace(/\n/g, '<br />')
      : '<span style="color: var(--admin-text-muted);">No description provided.</span>';

    const mapLink = poi.latitude && poi.longitude
      ? `<a class="btn-secondary" href="https://maps.google.com/?q=${poi.latitude},${poi.longitude}" target="_blank" rel="noopener">Open in Google Maps</a>`
      : '';

    content.innerHTML = `
      <div class="poi-detail-grid">
        <div class="poi-detail-section">
          <h4>Overview</h4>
          <div class="poi-detail-list">
            <div><strong>Slug:</strong> ${escapeHtml(poi.slug)}</div>
            <div><strong>Category:</strong> ${formatCategoryLabel(poi.category)}</div>
            <div><strong>Status:</strong> ${poi.status.toUpperCase()}</div>
            <div><strong>Radius:</strong> ${poi.radius ? poi.radius + ' m' : '—'}</div>
          </div>
        </div>
        <div class="poi-detail-section">
          <h4>Location</h4>
          <div class="poi-detail-list">
            <div><strong>Latitude:</strong> ${poi.latitude ?? '—'}</div>
            <div><strong>Longitude:</strong> ${poi.longitude ?? '—'}</div>
            <div><strong>Coordinates:</strong> ${formatCoordinates(poi.latitude, poi.longitude)}</div>
          </div>
        </div>
        <div class="poi-detail-section">
          <h4>Metadata</h4>
          <div class="poi-detail-list">
            <div><strong>Source:</strong> ${poi.source === 'supabase' ? 'Supabase' : 'Static dataset'}</div>
            <div><strong>Created:</strong> ${poi.created_at ? formatDate(poi.created_at) : '—'}</div>
            <div><strong>Updated:</strong> ${poi.updated_at ? formatDate(poi.updated_at) : '—'}</div>
          </div>
        </div>
      </div>
      <div class="poi-detail-section">
        <h4>Description</h4>
        <div class="poi-detail-description">${description}</div>
      </div>
      <div class="poi-detail-section">
        <h4>Tags</h4>
        <div class="poi-meta">${tags}</div>
      </div>
      <div class="poi-detail-actions">
        ${mapLink}
        <button type="button" class="btn-primary" onclick="editPoi('${poi.id}')">Edit POI</button>
      </div>
    `;
  }

  if (modal) {
    showElement(modal);
  }
}

function closePoiDetail() {
  const modal = $('#poiDetailModal');
  if (modal) {
    hideElement(modal);
  }
}

function openPoiForm(poiId = null) {
  const form = $('#poiForm');
  const modal = $('#poiFormModal');
  if (!form || !modal) return;

  let poi = null;
  if (poiId) {
    poi = findPoi(poiId);
  }

  adminState.selectedPoi = poi;
  adminState.poiFormMode = poi ? 'edit' : 'create';

  form.reset();

  const title = $('#poiFormTitle');
  if (title) {
    title.textContent = poi ? 'Edit POI' : 'New POI';
  }

  const nameInput = $('#poiName');
  const slugInput = $('#poiSlug');
  const categoryInput = $('#poiCategory');
  const statusInput = $('#poiStatus');
  const latitudeInput = $('#poiLatitude');
  const longitudeInput = $('#poiLongitude');
  const radiusInput = $('#poiRadius');
  const tagsInput = $('#poiTags');
  const descriptionInput = $('#poiDescription');

  if (nameInput) nameInput.value = poi?.name || '';
  if (slugInput) slugInput.value = poi?.slug || '';
  if (categoryInput) categoryInput.value = poi?.category || '';
  if (statusInput) statusInput.value = poi?.status || 'published';
  if (latitudeInput) latitudeInput.value = poi?.latitude ?? '';
  if (longitudeInput) longitudeInput.value = poi?.longitude ?? '';
  if (radiusInput) radiusInput.value = poi?.radius ?? '';
  if (tagsInput) tagsInput.value = poi?.tags?.join(', ') ?? '';
  if (descriptionInput) descriptionInput.value = poi?.description || '';

  const warning = $('#poiFormWarning');
  const warningText = $('#poiFormWarningText');
  const submitBtn = $('#poiFormSubmit');
  const errorEl = $('#poiFormError');

  if (errorEl) {
    hideElement(errorEl);
    errorEl.textContent = '';
  }

  if (adminState.poiDataSource !== 'supabase') {
    if (warning && warningText) {
      warningText.textContent = 'Supabase connection required. Static dataset is read-only.';
      showElement(warning);
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Read-only';
    }
  } else {
    if (warning) {
      hideElement(warning);
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = poi ? 'Save Changes' : 'Create POI';
    }
  }

  showElement(modal);
}

function closePoiForm() {
  const modal = $('#poiFormModal');
  if (modal) {
    hideElement(modal);
  }
}

async function handlePoiFormSubmit(event) {
  event.preventDefault();

  if (adminState.poiDataSource !== 'supabase') {
    showToast('Cannot save POIs while in static mode.', 'warning');
    return;
  }

  const form = event.target;
  const submitBtn = $('#poiFormSubmit');
  const errorEl = $('#poiFormError');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  if (errorEl) {
    hideElement(errorEl);
    errorEl.textContent = '';
  }

  const formData = new FormData(form);
  const name = (formData.get('name') || '').toString().trim();
  const slugInput = (formData.get('slug') || '').toString().trim();
  const category = (formData.get('category') || '').toString().trim().toLowerCase() || 'uncategorized';
  const status = (formData.get('status') || 'published').toString().toLowerCase();
  const description = (formData.get('description') || '').toString().trim();
  const latitude = parseFloat(formData.get('latitude'));
  const longitude = parseFloat(formData.get('longitude'));
  const radiusValue = formData.get('radius');
  const radius = radiusValue ? parseInt(radiusValue, 10) : null;
  const tagsValue = (formData.get('tags') || '').toString().trim();
  const tags = tagsValue ? tagsValue.split(',').map(tag => tag.trim()).filter(Boolean) : [];

  const slug = slugInput || slugify(name);

  if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    if (errorEl) {
      errorEl.textContent = 'Name, latitude and longitude are required.';
      showElement(errorEl);
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
    }
    return;
  }

  const client = ensureSupabase();
  if (!client) {
    showToast('Database connection not available', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
    }
    return;
  }

  const payload = {
    slug,
    status,
    radius: radius || DEFAULT_POI_RADIUS,
    tags,
  };

  try {
    if (adminState.poiFormMode === 'create') {
      const { error } = await client.rpc('admin_create_poi', {
        poi_name: name,
        poi_description: description || null,
        poi_latitude: latitude,
        poi_longitude: longitude,
        poi_category: category,
        poi_data: payload,
      });

      if (error) throw error;

      showToast('POI created successfully', 'success');
    } else if (adminState.selectedPoi) {
      const poi = adminState.selectedPoi;
      const poiId = poi.id; // Use poi.id (TEXT) not poi.uuid (UUID)

      const { error } = await client.rpc('admin_update_poi', {
        poi_id: poiId,
        poi_name: name,
        poi_description: description || null,
        poi_latitude: latitude,
        poi_longitude: longitude,
        poi_category: category,
        poi_data: {
          ...((poi.raw && poi.raw.data && typeof poi.raw.data === 'object') ? poi.raw.data : {}),
          ...payload,
        },
      });

      if (error) throw error;

      showToast('POI updated successfully', 'success');
    }

    closePoiForm();
    adminState.poisLoaded = false;
    await loadPoisData(true);
  } catch (error) {
    console.error('Failed to save POI:', error);
    if (errorEl) {
      errorEl.textContent = error.message || 'Failed to save POI';
      showElement(errorEl);
    }
    showToast('Failed to save POI: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
    }
  }
}

async function deletePoi(poiId) {
  const poi = findPoi(poiId);
  if (!poi) {
    showToast('POI not found', 'error');
    return;
  }

  if (adminState.poiDataSource !== 'supabase') {
    showToast('Cannot delete POIs while in static mode.', 'warning');
    return;
  }

  if (!confirm(`Delete POI "${poi.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Database connection not available');
    }

    const poiIdToDelete = poi.uuid || poi.id;
    const { error } = await client.rpc('admin_delete_poi', {
      poi_id: poiIdToDelete,
      deletion_reason: 'Admin panel removal',
    });

    if (error) throw error;

    showToast('POI deleted successfully', 'success');
    adminState.poisLoaded = false;
    await loadPoisData(true);
  } catch (error) {
    console.error('Failed to delete POI:', error);
    showToast('Failed to delete POI: ' + (error.message || 'Unknown error'), 'error');
  }
}

function editPoi(poiId) {
  openPoiForm(poiId);
}

function refreshPoiList() {
  loadPoisData(true);
}

// Delete Comment
async function deleteComment(commentId, reason = 'Content policy violation') {
  if (!confirm(`Delete this comment?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Deleting comment...', 'info');
    
    const { data, error } = await client.rpc('admin_delete_comment', {
      comment_id: commentId,
      deletion_reason: reason
    });
    
    if (error) throw error;
    
    showToast('Comment deleted successfully', 'success');
    
    // Reload content if on content view
    if (adminState.currentView === 'content') {
      loadContentData();
    }
    
  } catch (error) {
    console.error('Delete comment failed:', error);
    showToast('Failed to delete comment: ' + (error.message || 'Unknown error'), 'error');
  }
}

// =====================================================
// CONTENT MANAGEMENT - STATE
// =====================================================
let contentState = {
  comments: [],
  currentPage: 1,
  itemsPerPage: 20,
  totalComments: 0,
  searchQuery: '',
  selectedComment: null,
  stats: null
};

// Load Content Management Data
async function loadContentData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      const statsEl = $('#contentStats');
      if (statsEl) {
        statsEl.innerHTML = '<div class="admin-error-message">❌ Database not connected. Check console for details.</div>';
      }
      return;
    }
    
    // Load statistics first
    await loadContentStats();
    
    // Load comments
    await loadComments();
    
  } catch (error) {
    console.error('Failed to load content data:', error);
    showToast('Failed to load content data: ' + error.message, 'error');
    
    // Show helpful error message
    const tableBody = $('#contentTable');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 40px; text-align: center;">
            <div style="color: var(--admin-danger); margin-bottom: 16px; font-size: 18px;">❌ Error Loading Content</div>
            <div style="color: var(--admin-text-muted); margin-bottom: 16px;">${escapeHtml(error.message)}</div>
            <div style="background: rgba(239, 68, 68, 0.1); padding: 16px; border-radius: 8px; text-align: left; max-width: 600px; margin: 0 auto;">
              <p style="margin: 0 0 8px; font-weight: 600;">Possible solutions:</p>
              <ol style="margin: 0; padding-left: 20px; color: var(--admin-text);">
                <li>Run <code>ADMIN_CONTENT_COMPLETE_INSTALL.sql</code> in Supabase SQL Editor</li>
                <li>Check if you have admin permissions (is_admin = true)</li>
                <li>Open browser console (F12) for detailed error</li>
                <li>Verify Supabase connection is working</li>
              </ol>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Load content statistics
async function loadContentStats() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: stats, error } = await client.rpc('admin_get_detailed_content_stats');
    
    if (error) {
      console.error('Stats error:', error);
      throw new Error(`Stats function failed: ${error.message}. Did you run ADMIN_CONTENT_COMPLETE_INSTALL.sql?`);
    }
    
    if (!stats) {
      throw new Error('No stats data returned');
    }
    
    contentState.stats = stats;
    
    // Update stats display
    const statsEl = $('#contentStats');
    if (statsEl) {
      if (stats && stats.comments && stats.photos && stats.likes && stats.engagement) {
        statsEl.innerHTML = `
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Comments</p>
              <p class="stat-card-value">${stats.comments.total || 0}</p>
              <p class="stat-card-change">+${stats.comments.today || 0} today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Photos</p>
              <p class="stat-card-value">${stats.photos.total || 0}</p>
              <p class="stat-card-change">${stats.comments.with_photos || 0} comments with photos</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Likes</p>
              <p class="stat-card-value">${stats.likes.total || 0}</p>
              <p class="stat-card-change">+${stats.likes.today || 0} today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Active Users (7d)</p>
              <p class="stat-card-value">${stats.engagement.active_commenters_week || 0}</p>
              <p class="stat-card-change">Contributors this week</p>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Failed to load content stats:', error);
    const statsEl = $('#contentStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="admin-error-message" style="grid-column: 1 / -1;">
          ⚠️ Statistics unavailable: ${escapeHtml(error.message)}
        </div>
      `;
    }
  }
}

// Load comments with filters
async function loadComments(page = 1) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const tableBody = $('#contentTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading comments...</td></tr>';
    
    contentState.currentPage = page;
    const offset = (page - 1) * contentState.itemsPerPage;
    
    const { data: comments, error } = await client.rpc('admin_get_all_comments', {
      search_query: contentState.searchQuery || null,
      poi_filter: null,
      user_filter: null,
      date_from: null,
      date_to: null,
      limit_count: contentState.itemsPerPage,
      offset_count: offset
    });
    
    if (error) {
      console.error('Comments RPC error:', error);
      throw new Error(`Failed to load comments: ${error.message}. Make sure ADMIN_CONTENT_COMPLETE_INSTALL.sql is executed.`);
    }
    
    contentState.comments = comments || [];
    
    if (comments.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No comments found</td></tr>';
      updateContentPagination(0);
      return;
    }
    
    tableBody.innerHTML = comments.map(comment => {
      const editedBadge = comment.is_edited ? '<span class="badge badge-info" title="Edited">✎</span>' : '';
      const photoBadge = comment.photo_count > 0 ? `<span class="badge badge-success">📷 ${comment.photo_count}</span>` : '';
      
      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(comment.username)}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">Level ${comment.user_level}</div>
        </td>
        <td>
          <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(comment.poi_name || 'Unknown POI')}</div>
          <div class="comment-preview" title="${escapeHtml(comment.comment_content)}">
            ${escapeHtml(comment.comment_content.substring(0, 80))}${comment.comment_content.length > 80 ? '...' : ''}
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${editedBadge}
            ${photoBadge}
          </div>
        </td>
        <td>❤️ ${comment.like_count}</td>
        <td>${formatDate(comment.created_at)}</td>
        <td>
          <div class="poi-table-actions">
            <button class="btn-icon" type="button" title="View details" onclick="viewCommentDetails('${comment.comment_id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Edit comment" onclick="editComment('${comment.comment_id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Delete comment" onclick="deleteComment('${comment.comment_id}')" style="color: var(--admin-danger);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
      `;
    }).join('');
    
    // Update pagination
    updateContentPagination(comments.length);
    
  } catch (error) {
    console.error('Failed to load comments:', error);
    showToast('Failed to load comments', 'error');
    const tableBody = $('#contentTable');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Error loading comments</td></tr>';
    }
  }
}

// Update pagination
function updateContentPagination(loadedCount) {
  const paginationEl = $('#contentPagination');
  if (!paginationEl) return;
  
  const hasMore = loadedCount === contentState.itemsPerPage;
  const hasPrev = contentState.currentPage > 1;
  
  paginationEl.innerHTML = `
    <button 
      class="btn-pagination" 
      onclick="loadComments(${contentState.currentPage - 1})" 
      ${!hasPrev ? 'disabled' : ''}>
      Previous
    </button>
    <span class="pagination-info">Page ${contentState.currentPage}</span>
    <button 
      class="btn-pagination" 
      onclick="loadComments(${contentState.currentPage + 1})" 
      ${!hasMore ? 'disabled' : ''}>
      Next
    </button>
  `;
}

// View comment details
async function viewCommentDetails(commentId) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    showToast('Loading comment details...', 'info');
    
    const { data, error } = await client.rpc('admin_get_comment_details', {
      comment_id: commentId
    });
    
    if (error) throw error;
    
    const comment = data.comment;
    const photos = data.photos || [];
    const likes = data.likes || { count: 0, users: [] };
    
    contentState.selectedComment = { ...data, comment_id: commentId };
    
    // Show modal
    const modal = $('#commentDetailModal');
    const title = $('#commentDetailTitle');
    const content = $('#commentDetailContent');
    
    if (title) {
      title.textContent = `Comment by ${comment.username}`;
    }
    
    if (content) {
      const photosHtml = photos.length > 0 ? `
        <div class="comment-photos-grid">
          ${photos.map(photo => `
            <div class="comment-photo-item">
              <img src="${escapeHtml(photo.photo_url)}" alt="Comment photo" onclick="window.open('${escapeHtml(photo.photo_url)}', '_blank')" style="cursor: pointer;" />
              <button class="btn-delete-photo" onclick="deleteCommentPhoto('${photo.id}')" title="Delete photo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--admin-text-muted);">No photos</p>';
      
      const likesHtml = likes.count > 0 ? `
        <div class="likes-list">
          ${likes.users.map(user => `
            <div class="like-item">
              <span>❤️ ${user.username || 'Anonymous'}</span>
              <span style="color: var(--admin-text-muted); font-size: 12px;">${formatDate(user.liked_at)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--admin-text-muted);">No likes yet</p>';
      
      content.innerHTML = `
        <div style="display: grid; gap: 24px;">
          <!-- Comment Info -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Comment Details</h4>
            <div style="background: var(--admin-bg); padding: 20px; border-radius: 8px;">
              <table style="width: 100%; color: var(--admin-text);">
                <tr>
                  <td style="padding: 8px 0; font-weight: 500; width: 120px;">POI:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.poi_name || 'Unknown')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">User ID:</td>
                  <td style="padding: 8px 0; font-family: monospace; font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(comment.user_id || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Username:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.username || 'Anonymous')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Email:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.user_email || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Level & XP:</td>
                  <td style="padding: 8px 0;">Level ${comment.user_level} (${comment.user_xp} XP)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Created:</td>
                  <td style="padding: 8px 0;">${formatDate(comment.created_at)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Updated:</td>
                  <td style="padding: 8px 0;">${comment.updated_at ? formatDate(comment.updated_at) : 'Never'}</td>
                </tr>
              </table>
            </div>
          </div>
          
          <!-- Comment Content -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Content</h4>
            <div style="background: var(--admin-bg); padding: 20px; border-radius: 8px; white-space: pre-wrap; line-height: 1.6;">
              ${escapeHtml(comment.content)}
            </div>
          </div>
          
          <!-- Photos -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Photos (${photos.length})</h4>
            ${photosHtml}
          </div>
          
          <!-- Likes -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Likes (${likes.count})</h4>
            ${likesHtml}
          </div>
          
          <!-- Actions -->
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn-primary" onclick="editComment('${commentId}'); hideElement($('#commentDetailModal'));">
              Edit Comment
            </button>
            <button class="btn-secondary" style="background: var(--admin-danger); border-color: var(--admin-danger);" onclick="deleteComment('${commentId}'); hideElement($('#commentDetailModal'));">
              Delete Comment
            </button>
          </div>
        </div>
      `;
    }
    
    showElement(modal);
    
  } catch (error) {
    console.error('Failed to load comment details:', error);
    showToast('Failed to load comment details', 'error');
  }
}

// Edit comment
function editComment(commentId) {
  const comment = contentState.comments.find(c => c.comment_id === commentId);
  if (!comment) {
    showToast('Comment not found', 'error');
    return;
  }
  
  contentState.selectedComment = { comment_id: commentId, comment_content: comment.comment_content };
  
  const modal = $('#commentEditModal');
  const title = $('#commentEditTitle');
  const textarea = $('#commentEditContent');
  const form = $('#commentEditForm');
  
  if (title) {
    title.textContent = `Edit Comment by ${comment.username}`;
  }
  
  if (textarea) {
    textarea.value = comment.comment_content;
  }
  
  showElement(modal);
}

// Handle comment edit form submission
async function handleCommentEditSubmit(event) {
  event.preventDefault();
  
  const commentId = contentState.selectedComment?.comment_id;
  if (!commentId) return;
  
  const textarea = $('#commentEditContent');
  const submitBtn = $('#commentEditSubmit');
  const errorEl = $('#commentEditError');
  
  const newContent = textarea.value.trim();
  
  if (!newContent) {
    if (errorEl) {
      errorEl.textContent = 'Comment content cannot be empty';
      showElement(errorEl);
    }
    return;
  }
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }
  
  if (errorEl) hideElement(errorEl);
  
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    const { error } = await client.rpc('admin_update_comment', {
      comment_id: commentId,
      new_content: newContent,
      edit_reason: 'Admin edit'
    });
    
    if (error) throw error;
    
    showToast('Comment updated successfully', 'success');
    hideElement($('#commentEditModal'));
    
    // Reload comments
    await loadComments(contentState.currentPage);
    
  } catch (error) {
    console.error('Failed to update comment:', error);
    if (errorEl) {
      errorEl.textContent = error.message || 'Failed to update comment';
      showElement(errorEl);
    }
    showToast('Failed to update comment', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
}

// Get Analytics Data
async function loadAnalytics() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    // Get content stats
    const { data: contentStats, error: statsError } = await client.rpc('admin_get_content_stats');
    
    if (statsError) throw statsError;
    
    // Get top contributors
    const { data: topContributors, error: contribError } = await client.rpc('admin_get_top_contributors', {
      limit_count: 10
    });
    
    if (contribError) throw contribError;
    
    // Update analytics display
    const analyticsEl = $('#analyticsContent');
    if (analyticsEl && contentStats) {
      analyticsEl.innerHTML = `
        <div class="admin-stats-grid">
          <div class="admin-stat-card">
            <h4>Comments Today</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.comments_today || 0}</p>
          </div>
          <div class="admin-stat-card">
            <h4>Comments This Week</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.comments_this_week || 0}</p>
          </div>
          <div class="admin-stat-card">
            <h4>Active Users Today</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.active_users_today || 0}</p>
          </div>
          <div class="admin-stat-card">
            <h4>Average Rating</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.avg_rating || 'N/A'}</p>
          </div>
        </div>
        
        <div class="admin-section" style="margin-top: 32px;">
          <h3>Top Contributors</h3>
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Comments</th>
                  <th>Ratings</th>
                  <th>Visits</th>
                  <th>XP</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                ${topContributors && topContributors.length > 0 ? topContributors.map(user => `
                  <tr>
                    <td>${user.username || 'N/A'}</td>
                    <td>${user.comment_count || 0}</td>
                    <td>${user.rating_count || 0}</td>
                    <td>${user.visit_count || 0}</td>
                    <td>${user.total_xp || 0}</td>
                    <td>${user.level || 0}</td>
                  </tr>
                `).join('') : '<tr><td colspan="6" class="table-loading">No contributors found</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Failed to load analytics:', error);
    showToast('Failed to load analytics', 'error');
  }
}

// Delete comment photo
async function deleteCommentPhoto(photoId) {
  if (!confirm('Delete this photo? This action cannot be undone.')) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    showToast('Deleting photo...', 'info');
    
    const { error } = await client.rpc('admin_delete_comment_photo', {
      photo_id: photoId,
      deletion_reason: 'Admin action'
    });
    
    if (error) throw error;
    
    showToast('Photo deleted successfully', 'success');
    
    // Close detail modal and reload
    hideElement($('#commentDetailModal'));
    await loadComments(contentState.currentPage);
    
  } catch (error) {
    console.error('Failed to delete photo:', error);
    showToast('Failed to delete photo: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Search comments
function searchComments() {
  const searchInput = $('#contentSearchInput');
  if (searchInput) {
    contentState.searchQuery = searchInput.value.trim();
    contentState.currentPage = 1;
    loadComments(1);
  }
}

// Clear search
function clearContentSearch() {
  const searchInput = $('#contentSearchInput');
  if (searchInput) {
    searchInput.value = '';
    contentState.searchQuery = '';
    contentState.currentPage = 1;
    loadComments(1);
  }
}

// Make functions global for onclick handlers
window.adjustUserXP = adjustUserXP;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.deleteComment = deleteComment;
window.viewPoiDetails = viewPoiDetails;
window.editPoi = editPoi;
window.deletePoi = deletePoi;
window.viewCommentDetails = viewCommentDetails;
window.editComment = editComment;
window.handleCommentEditSubmit = handleCommentEditSubmit;
window.deleteCommentPhoto = deleteCommentPhoto;
window.loadComments = loadComments;
window.searchComments = searchComments;
window.clearContentSearch = clearContentSearch;

// =====================================================
// INITIALIZATION
// =====================================================

async function initAdminPanel() {
  console.log('Initializing admin panel...');
  
  // Initialize event listeners FIRST (needed for login form)
  initEventListeners();
  
  // Wait a moment for modules to load
  let retries = 0;
  const maxRetries = 10;
  
  while (!sb && retries < maxRetries) {
    sb = getSupabaseClient();
    if (!sb) {
      console.log(`Waiting for Supabase client... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
  }
  
  if (!sb) {
    console.error('Failed to load Supabase client after multiple retries');
    setLoading(false);
    showLoginScreen();
    return;
  }
  
  console.log('Supabase client loaded successfully');
  
  // Check admin access
  const hasAccess = await checkAdminAccess();
  
  if (!hasAccess) {
    console.log('No access - login screen or access denied shown');
    return;
  }

  console.log('Admin panel initialized successfully');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
  initAdminPanel();
}
