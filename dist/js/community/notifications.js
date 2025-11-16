// ===================================
// NOTIFICATIONS MODULE
// Handles real-time notifications for comments and likes
// ===================================

import { t } from './i18nHelper.js';

let notificationSubscription = null;
let currentUserId = null;

/**
 * Initialize notifications system
 * @param {string} userId - The current user ID
 */
export function initNotifications(userId) {
  if (!userId) {
    console.warn('⚠️ Cannot initialize notifications without user ID');
    return;
  }

  currentUserId = userId;
  console.log('🔔 Initializing notifications for user:', userId);

  // Load initial count
  updateNotificationBadge();

  // Subscribe to real-time updates
  subscribeToNotifications(userId);

  // Set up notification panel toggle
  setupNotificationPanel();
}

/**
 * Subscribe to real-time notification updates
 * @param {string} userId - The user ID
 */
function subscribeToNotifications(userId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Unsubscribe if already subscribed
    if (notificationSubscription) {
      notificationSubscription.unsubscribe();
    }

    // Subscribe to new notifications
    notificationSubscription = sb
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'poi_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 New notification received:', payload);
          handleNewNotification(payload.new);
        }
      )
      .subscribe();

    console.log('✅ Subscribed to notification updates');

  } catch (error) {
    console.error('Error subscribing to notifications:', error);
  }
}

/**
 * Handle incoming notification
 * @param {Object} notification - The notification object
 */
async function handleNewNotification(notification) {
  // Update badge count
  await updateNotificationBadge();

  // Show toast notification
  const message = notification.notification_type === 'like'
    ? t('notifications.like')
    : t('notifications.reply');

  window.showToast?.(message, 'info');

  // Play sound (optional)
  playNotificationSound();
}

/**
 * Update notification badge count
 */
export async function updateNotificationBadge() {
  try {
    const count = await getUnreadCount();
    
    const badge = document.getElementById('notificationsCounter');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    return count;

  } catch (error) {
    console.error('Error updating notification badge:', error);
    return 0;
  }
}

/**
 * Get unread notification count
 * @returns {Promise<number>} Number of unread notifications
 */
export async function getUnreadCount() {
  try {
    if (!currentUserId) return 0;

    const sb = window.getSupabase();
    if (!sb) return 0;

    const { count, error } = await sb
      .from('poi_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .eq('is_read', false);

    if (error) throw error;

    return count || 0;

  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Get all notifications for current user
 * @param {number} limit - Maximum number of notifications
 * @returns {Promise<Array>} Array of notification objects
 */
export async function getNotifications(limit = 20) {
  try {
    if (!currentUserId) {
      console.log('⚠️ No currentUserId, cannot load notifications');
      return [];
    }

    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    console.log(`🔔 Loading notifications for user: ${currentUserId}`);

    const { data: notifications, error } = await sb
      .from('poi_notifications')
      .select(`
        id,
        notification_type,
        is_read,
        created_at,
        comment_id,
        trigger_user_id,
        poi_comments (
          id,
          content,
          poi_id
        )
      `)
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      throw error;
    }

    console.log(`📬 Fetched ${notifications?.length || 0} notifications`);

    if (!notifications || notifications.length === 0) {
      return [];
    }

    // Get trigger user profiles with error handling
    const notificationsWithUsers = await Promise.all(
      notifications.map(async (notif) => {
        try {
          const { data: profile, error: profileError } = await sb
            .from('profiles')
            .select('username, name, avatar_url, level, xp')
            .eq('id', notif.trigger_user_id)
            .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

          if (profileError) {
            console.warn(`⚠️ Error fetching profile for ${notif.trigger_user_id}:`, profileError);
          }

          return {
            ...notif,
            trigger_user: profile || { username: 'Użytkownik', name: null, avatar_url: null }
          };
        } catch (err) {
          console.error(`❌ Error processing notification ${notif.id}:`, err);
          return {
            ...notif,
            trigger_user: { username: 'Użytkownik', name: null, avatar_url: null }
          };
        }
      })
    );

    console.log(`✅ Loaded ${notificationsWithUsers.length} notifications with user profiles`);
    return notificationsWithUsers;

  } catch (error) {
    console.error('❌ Error getting notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - The notification ID
 * @returns {Promise<boolean>} True if marked successfully
 */
export async function markAsRead(notificationId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { error } = await sb
      .from('poi_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;

    // Update badge
    await updateNotificationBadge();

    return true;

  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read
 * @returns {Promise<boolean>} True if marked successfully
 */
export async function markAllAsRead() {
  try {
    if (!currentUserId) return false;

    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { error } = await sb
      .from('poi_notifications')
      .update({ is_read: true })
      .eq('user_id', currentUserId)
      .eq('is_read', false);

    if (error) throw error;

    // Update badge
    await updateNotificationBadge();

    console.log('✅ All notifications marked as read');
    return true;

  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
}

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteNotification(notificationId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { error } = await sb
      .from('poi_notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;

    // Update badge
    await updateNotificationBadge();

    return true;

  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
}

/**
 * Clear all notifications
 * @returns {Promise<boolean>} True if cleared successfully
 */
export async function clearAllNotifications() {
  try {
    if (!currentUserId) return false;

    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { error } = await sb
      .from('poi_notifications')
      .delete()
      .eq('user_id', currentUserId);

    if (error) throw error;

    // Update badge
    await updateNotificationBadge();

    console.log('✅ All notifications cleared');
    return true;

  } catch (error) {
    console.error('Error clearing notifications:', error);
    return false;
  }
}

/**
 * Setup notification panel toggle
 */
function setupNotificationPanel() {
  const toggleBtn = document.getElementById('notificationsToggle');
  
  if (!toggleBtn) return;

  // Create notification panel if it doesn't exist
  let panel = document.getElementById('notificationsPanel');
  
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notificationsPanel';
    panel.className = 'notifications-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'notificationsPanelTitle');
    
    panel.innerHTML = `
      <div class="notifications-panel-header">
        <h3 id="notificationsPanelTitle">Powiadomienia</h3>
        <div class="notifications-panel-actions">
          <button type="button" class="ghost" id="markAllReadBtn">
            ✓ Oznacz wszystkie
          </button>
          <button type="button" class="icon-button" id="closeNotificationsPanel">
            ✕
          </button>
        </div>
      </div>
      <div class="notifications-panel-content" id="notificationsPanelContent">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>${t('notifications.loading')}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);

    // Add styles
    addNotificationPanelStyles();
  }

  // Toggle panel
  toggleBtn.addEventListener('click', async () => {
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    toggleBtn.setAttribute('aria-expanded', !isHidden);

    if (!isHidden) {
      await loadNotificationPanel();
    }
  });

  // Close button
  const closeBtn = document.getElementById('closeNotificationsPanel');
  closeBtn?.addEventListener('click', () => {
    panel.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
  });

  // Mark all as read
  const markAllBtn = document.getElementById('markAllReadBtn');
  markAllBtn?.addEventListener('click', async () => {
    await markAllAsRead();
    await loadNotificationPanel();
    window.showToast?.('Wszystkie powiadomienia oznaczone jako przeczytane', 'success');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !toggleBtn.contains(e.target)) {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * Load and render notification panel
 */
async function loadNotificationPanel() {
  console.log('📋 Loading notification panel...');
  
  const content = document.getElementById('notificationsPanelContent');
  if (!content) {
    console.error('❌ notificationsPanelContent not found');
    return;
  }

  content.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>${t('notifications.loading')}</p></div>`;

  try {
    const notifications = await getNotifications();
    console.log(`📬 Received ${notifications.length} notifications to display`);

    if (notifications.length === 0) {
      console.log('ℹ️ No notifications to display');
      content.innerHTML = `
        <div class="empty-state" style="padding: 2rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔔</div>
          <p style="color: var(--color-neutral-600);">Brak powiadomień</p>
        </div>
      `;
      return;
    }

    let html = '<div class="notifications-list">';
    
    for (const notif of notifications) {
      // Better name handling with priority
      let displayName = 'Użytkownik';
      if (notif.trigger_user) {
        if (notif.trigger_user.username && notif.trigger_user.username.trim()) {
          displayName = notif.trigger_user.username;
        } else if (notif.trigger_user.name && notif.trigger_user.name.trim()) {
          displayName = notif.trigger_user.name;
        }
      }
      
      const avatar = notif.trigger_user?.avatar_url || '/assets/cyprus_logo-1000x1054.png';
      const timeAgo = formatTimeAgo(notif.created_at);
      const icon = notif.notification_type === 'like' ? '❤️' : '💬';
      const action = notif.notification_type === 'like' ? 'polubił' : 'odpowiedział na';
      const commentPreview = notif.poi_comments?.content?.substring(0, 50) || '';

      html += `
        <div class="notification-item ${notif.is_read ? 'read' : 'unread'}" 
             onclick="window.handleNotificationClick('${notif.id}', '${notif.comment_id}', '${notif.poi_comments?.poi_id}')">
          <div class="notification-icon">${icon}</div>
          <img src="${avatar}" alt="${displayName}" class="notification-avatar" />
          <div class="notification-content">
            <p><strong>${displayName}</strong> ${action} Twój komentarz</p>
            ${commentPreview ? `<p class="notification-preview">"${commentPreview}..."</p>` : ''}
            <span class="notification-time">${timeAgo}</span>
          </div>
          ${!notif.is_read ? '<span class="notification-unread-dot"></span>' : ''}
        </div>
      `;
    }

    html += '</div>';
    content.innerHTML = html;
    console.log('✅ Notification panel rendered successfully');

  } catch (error) {
    console.error('❌ Error loading notification panel:', error);
    content.innerHTML = `
      <div class="empty-state" style="padding: 2rem; text-align: center;">
        <p style="color: var(--color-danger-600);">Błąd wczytywania powiadomień</p>
        <p style="font-size: 0.875rem; color: var(--color-neutral-600);">${error.message}</p>
      </div>
    `;
  }
}

/**
 * Handle notification click
 */
window.handleNotificationClick = async function(notificationId, commentId, poiId) {
  // Mark as read
  await markAsRead(notificationId);

  // Close panel
  const panel = document.getElementById('notificationsPanel');
  if (panel) panel.hidden = true;

  // Navigate to comment (if on community page)
  if (window.location.pathname.includes('community') && window.openPoiComments) {
    window.openPoiComments(poiId);
  } else {
    // Navigate to community page
    window.location.href = `/community.html?poi=${poiId}&comment=${commentId}`;
  }
};

/**
 * Add notification panel styles
 */
function addNotificationPanelStyles() {
  if (document.getElementById('notificationPanelStyles')) return;

  const style = document.createElement('style');
  style.id = 'notificationPanelStyles';
  style.textContent = `
    .notifications-panel {
      position: fixed;
      top: 60px;
      right: 20px;
      width: 400px;
      max-width: calc(100vw - 40px);
      max-height: 600px;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      z-index: 9998;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .notifications-panel-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-neutral-200);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .notifications-panel-header h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .notifications-panel-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .notifications-panel-content {
      flex: 1;
      overflow-y: auto;
    }

    .notifications-list {
      display: flex;
      flex-direction: column;
    }

    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-neutral-100);
      cursor: pointer;
      transition: background 0.2s;
      position: relative;
    }

    .notification-item:hover {
      background: var(--color-neutral-50);
    }

    .notification-item.unread {
      background: var(--color-primary-50);
    }

    .notification-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .notification-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }

    .notification-content {
      flex: 1;
      font-size: 0.875rem;
    }

    .notification-content strong {
      font-weight: 600;
    }

    .notification-preview {
      color: var(--color-neutral-600);
      font-style: italic;
      margin: 0.25rem 0;
    }

    .notification-time {
      font-size: 0.75rem;
      color: var(--color-neutral-500);
    }

    .notification-unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-primary-600);
      position: absolute;
      top: 50%;
      right: 1rem;
      transform: translateY(-50%);
    }

    .notifications-counter {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--color-danger-600);
      color: white;
      border-radius: 10px;
      padding: 2px 6px;
      font-size: 0.75rem;
      font-weight: 600;
      min-width: 20px;
      text-align: center;
    }

    @media (max-width: 480px) {
      .notifications-panel {
        top: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100%;
        max-height: 100vh;
        border-radius: 0;
      }
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Play notification sound
 */
function playNotificationSound() {
  try {
    // Create simple beep sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    // Fail silently if audio not supported
  }
}

/**
 * Format time ago
 */
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

/**
 * Cleanup on logout
 */
export function cleanupNotifications() {
  if (notificationSubscription) {
    notificationSubscription.unsubscribe();
    notificationSubscription = null;
  }
  currentUserId = null;
  console.log('🔔 Notifications cleaned up');
}

console.log('✅ Notifications module loaded');
