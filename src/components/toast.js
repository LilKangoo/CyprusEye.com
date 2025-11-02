/**
 * Toast Notification Component
 * Show temporary toast messages
 */

import { createElement, querySelector } from '../utils/dom.js';

let toastContainer = null;
let toastTimeout = null;

/**
 * Initialize toast container
 */
function initToastContainer() {
  if (toastContainer) return;

  toastContainer = createElement('div', {
    id: 'toast-container',
    className: 'toast-container',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });

  document.body.appendChild(toastContainer);
}

/**
 * Show toast message
 * @param {string} message - Message text
 * @param {Object} options - Options
 */
export function showToast(message, options = {}) {
  initToastContainer();

  const {
    type = 'info',
    duration = 3000,
    position = 'bottom-center',
    closable = true,
  } = options;

  // Create toast element
  const toast = createElement('div', {
    className: `toast toast-${type} toast-${position}`,
    role: 'alert',
  });

  // Message
  const messageEl = createElement('div', { className: 'toast-message' }, message);
  toast.appendChild(messageEl);

  // Close button
  if (closable) {
    const closeBtn = createElement('button', {
      className: 'toast-close',
      'aria-label': 'Close notification',
    }, '×');

    closeBtn.addEventListener('click', () => {
      removeToast(toast);
    });

    toast.appendChild(closeBtn);
  }

  // Add to container
  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  // Auto remove
  if (duration > 0) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
      removeToast(toast);
    }, duration);
  }

  return toast;
}

/**
 * Remove toast
 * @param {HTMLElement} toast - Toast element
 */
function removeToast(toast) {
  if (!toast) return;

  toast.classList.remove('toast-visible');

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/**
 * Show success toast
 * @param {string} message - Message
 * @param {Object} options - Options
 */
export function showSuccessToast(message, options = {}) {
  return showToast(message, { ...options, type: 'success' });
}

/**
 * Show error toast
 * @param {string} message - Message
 * @param {Object} options - Options
 */
export function showErrorToast(message, options = {}) {
  return showToast(message, { ...options, type: 'error', duration: 5000 });
}

/**
 * Show warning toast
 * @param {string} message - Message
 * @param {Object} options - Options
 */
export function showWarningToast(message, options = {}) {
  return showToast(message, { ...options, type: 'warning' });
}

/**
 * Show info toast
 * @param {string} message - Message
 * @param {Object} options - Options
 */
export function showInfoToast(message, options = {}) {
  return showToast(message, { ...options, type: 'info' });
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
  if (!toastContainer) return;

  const toasts = toastContainer.querySelectorAll('.toast');
  toasts.forEach(toast => removeToast(toast));
}
