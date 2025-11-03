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
};

// =====================================================
// SUPABASE CLIENT
// =====================================================

const sb = window.getSupabase();
if (!sb) {
  console.error('Supabase client not available');
}

// =====================================================
// DOM HELPERS
// =====================================================

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => root.querySelectorAll(selector);

function showElement(element) {
  if (element) element.hidden = false;
}

function hideElement(element) {
  if (element) element.hidden = true;
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
    setLoading(true);

    // Get current session
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    
    if (sessionError) throw sessionError;
    
    if (!session || !session.user) {
      console.log('No active session');
      showAccessDenied();
      return false;
    }

    adminState.user = session.user;

    // Check if user ID matches admin
    if (session.user.id !== ADMIN_CONFIG.requiredUserId) {
      console.log('User is not admin:', session.user.id);
      showAccessDenied();
      return false;
    }

    // Get user profile and verify is_admin flag
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) throw profileError;

    if (!profile || !profile.is_admin) {
      console.log('User profile does not have admin flag');
      showAccessDenied();
      return false;
    }

    adminState.profile = profile;
    adminState.isAdmin = true;

    console.log('Admin access granted:', profile.username);
    showAdminPanel();
    return true;

  } catch (error) {
    console.error('Admin access check failed:', error);
    showAccessDenied();
    return false;
  } finally {
    setLoading(false);
  }
}

function showAccessDenied() {
  hideElement($('#adminLoading'));
  hideElement($('#adminContainer'));
  showElement($('#adminAccessDenied'));
}

function showAdminPanel() {
  hideElement($('#adminLoading'));
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
    // Load system diagnostics
    const { data: diagnostics, error: diagError } = await sb
      .from('admin_system_diagnostics')
      .select('*');

    if (diagError) throw diagError;

    // Update stat cards
    if (diagnostics) {
      diagnostics.forEach(metric => {
        const elementId = `stat${metric.metric.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('')}`;
        
        const valueEl = $(`#${elementId}`);
        if (valueEl) {
          valueEl.textContent = metric.value;
        }
      });
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
    const { data: activity, error } = await sb.rpc('admin_get_activity_log', { 
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
    adminState.usersPage = page;

    const { data: users, error, count } = await sb
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
    showToast('Loading user details...', 'info');

    const { data, error } = await sb.rpc('admin_get_user_details', { 
      target_user_id: userId 
    });

    if (error) throw error;

    // Show modal with user details
    const modal = $('#userDetailModal');
    const content = $('#userDetailContent');
    
    if (!modal || !content) return;

    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <div>
          <h4 style="margin-bottom: 12px; color: var(--admin-text);">Profile</h4>
          <pre style="background: var(--admin-bg); padding: 16px; border-radius: 8px; overflow-x: auto;">
${JSON.stringify(data.profile, null, 2)}
          </pre>
        </div>
        <div>
          <h4 style="margin-bottom: 12px; color: var(--admin-text);">Statistics</h4>
          <pre style="background: var(--admin-bg); padding: 16px; border-radius: 8px; overflow-x: auto;">
${JSON.stringify(data.stats, null, 2)}
          </pre>
        </div>
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
    // Check database connection
    const dbStatus = $('#dbStatus');
    try {
      const { error } = await sb.from('profiles').select('id').limit(1);
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
      const { error } = await sb.auth.getSession();
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
    const { data: metrics, error } = await sb
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
// LOGOUT
// =====================================================

async function handleLogout() {
  try {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);

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

// =====================================================
// EVENT LISTENERS
// =====================================================

function initEventListeners() {
  // Navigation
  $$('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      if (viewName) {
        switchView(viewName);
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
}

async function searchUsers(query) {
  try {
    const { data: users, error } = await sb
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
// INITIALIZATION
// =====================================================

async function initAdminPanel() {
  console.log('Initializing admin panel...');
  
  // Check admin access
  const hasAccess = await checkAdminAccess();
  
  if (!hasAccess) {
    console.log('Access denied');
    return;
  }

  // Initialize event listeners
  initEventListeners();

  console.log('Admin panel initialized successfully');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
  initAdminPanel();
}
