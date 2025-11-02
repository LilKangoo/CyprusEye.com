/**
 * Notifications State Management
 * Handles user notifications storage and persistence
 */

import store from './store.js';
import { getFromStorage, setToStorage } from '../utils/storage.js';

// Storage key
export const NOTIFICATIONS_STORAGE_KEY = 'wakacjecypr-notifications';
export const NOTIFICATIONS_LIMIT = 50;

/**
 * Sanitize notification object
 * @param {Object} raw - Raw notification
 * @returns {Object|null}
 */
export function sanitizeNotification(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null;
  if (!id) {
    return null;
  }

  const message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : '';
  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt.trim() : new Date().toISOString();

  return {
    id,
    type: typeof raw.type === 'string' ? raw.type : 'info',
    actorKey: typeof raw.actorKey === 'string' ? raw.actorKey : null,
    actorName: typeof raw.actorName === 'string' ? raw.actorName : '',
    message,
    createdAt,
    read: Boolean(raw.read),
  };
}

/**
 * Load notifications from localStorage
 * @returns {Object} Notifications by user key
 */
export function loadNotificationsFromStorage() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const sanitized = {};

    Object.entries(parsed).forEach(([userKey, list]) => {
      if (typeof userKey !== 'string' || !Array.isArray(list)) {
        return;
      }

      const normalized = list
        .map((item) => sanitizeNotification(item))
        .filter(Boolean)
        .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      sanitized[userKey] = normalized.slice(0, NOTIFICATIONS_LIMIT);
    });

    return sanitized;
  } catch (error) {
    console.error('Nie udało się wczytać powiadomień:', error);
    return {};
  }
}

/**
 * Persist notifications to localStorage and update store
 * @param {Object} notificationsByUser - Notifications object
 */
export function persistNotifications(notificationsByUser) {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notificationsByUser));
    store.setState('notifications', notificationsByUser);
  } catch (error) {
    console.error('Nie udało się zapisać powiadomień:', error);
  }
}

/**
 * Get notifications for a user
 * @param {string} userKey - User key
 * @param {Object} notificationsObj - Notifications object (defaults to store)
 * @returns {Array}
 */
export function getUserNotifications(userKey, notificationsObj) {
  if (!userKey) {
    return [];
  }
  
  const notifications = notificationsObj || store.getState('notifications') || {};
  return notifications[userKey] || [];
}

/**
 * Get unread notifications count
 * @param {string} userKey - User key
 * @param {Object} notificationsObj - Notifications object (defaults to store)
 * @returns {number}
 */
export function getUnreadNotificationsCount(userKey, notificationsObj) {
  const list = getUserNotifications(userKey, notificationsObj);
  return list.filter((n) => !n.read).length;
}

/**
 * Add notification for user
 * @param {string} userKey - User key
 * @param {Object} payload - Notification payload
 * @param {Object} notificationsObj - Notifications object (defaults to store)
 * @returns {Object} Updated notifications
 */
export function addNotificationForUser(userKey, payload = {}, notificationsObj) {
  if (!userKey) {
    return notificationsObj || {};
  }

  const notifications = notificationsObj || store.getState('notifications') || {};
  const list = notifications[userKey] || [];

  const notification = sanitizeNotification({
    id: payload.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: payload.type || 'info',
    actorKey: payload.actorKey || null,
    actorName: payload.actorName || '',
    message: payload.message || '',
    createdAt: payload.createdAt || new Date().toISOString(),
    read: false,
  });

  if (!notification) {
    return notifications;
  }

  const updated = {
    ...notifications,
    [userKey]: [notification, ...list].slice(0, NOTIFICATIONS_LIMIT),
  };

  persistNotifications(updated);
  return updated;
}

/**
 * Mark notification as read
 * @param {string} userKey - User key
 * @param {string} notificationId - Notification ID
 * @param {Object} notificationsObj - Notifications object (defaults to store)
 * @returns {Object} Updated notifications
 */
export function markNotificationAsRead(userKey, notificationId, notificationsObj) {
  if (!userKey || !notificationId) {
    return notificationsObj || {};
  }

  const notifications = notificationsObj || store.getState('notifications') || {};
  const list = notifications[userKey] || [];

  const updated = {
    ...notifications,
    [userKey]: list.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    ),
  };

  persistNotifications(updated);
  return updated;
}

/**
 * Mark all notifications as read for user
 * @param {string} userKey - User key
 * @param {Object} notificationsObj - Notifications object (defaults to store)
 * @returns {Object} Updated notifications
 */
export function markAllNotificationsAsRead(userKey, notificationsObj) {
  if (!userKey) {
    return notificationsObj || {};
  }

  const notifications = notificationsObj || store.getState('notifications') || {};
  const list = notifications[userKey] || [];

  const updated = {
    ...notifications,
    [userKey]: list.map((n) => ({ ...n, read: true })),
  };

  persistNotifications(updated);
  return updated;
}

/**
 * Initialize notifications in store from storage
 * @returns {Object}
 */
export function initializeNotificationsState() {
  const notifications = loadNotificationsFromStorage();
  store.setState('notifications', notifications);
  return notifications;
}

/**
 * Subscribe to notifications changes
 * @param {Function} callback - Callback(newNotifications, oldNotifications)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToNotifications(callback) {
  return store.subscribe('notifications', callback);
}
