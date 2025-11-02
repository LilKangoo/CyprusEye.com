/**
 * Modal Component Utilities
 * Generic modal management functions
 */

import { querySelector, showElement, hideElement, addClass, removeClass } from '../utils/dom.js';

/**
 * Open modal with animation
 * @param {HTMLElement|string} modal - Modal element or selector
 * @param {Object} options - Options
 */
export function openModal(modal, options = {}) {
  const modalEl = typeof modal === 'string' ? querySelector(modal) : modal;
  if (!modalEl) return;

  // Show modal
  showElement(modalEl);
  
  // Add visible class for animation
  requestAnimationFrame(() => {
    addClass(modalEl, 'visible');
    if (options.className) {
      addClass(modalEl, options.className);
    }
  });

  // Focus management
  if (options.focusSelector) {
    const focusEl = querySelector(options.focusSelector, modalEl);
    if (focusEl) {
      setTimeout(() => focusEl.focus(), 100);
    }
  }

  // Trap focus
  if (options.trapFocus !== false) {
    trapFocus(modalEl);
  }

  // Callback
  if (typeof options.onOpen === 'function') {
    options.onOpen(modalEl);
  }
}

/**
 * Close modal with animation
 * @param {HTMLElement|string} modal - Modal element or selector
 * @param {Object} options - Options
 */
export function closeModal(modal, options = {}) {
  const modalEl = typeof modal === 'string' ? querySelector(modal) : modal;
  if (!modalEl) return;

  // Remove visible class
  removeClass(modalEl, 'visible');
  if (options.className) {
    removeClass(modalEl, options.className);
  }

  // Hide after animation
  setTimeout(() => {
    hideElement(modalEl);
    
    // Callback
    if (typeof options.onClose === 'function') {
      options.onClose(modalEl);
    }
  }, options.delay || 300);
}

/**
 * Toggle modal
 * @param {HTMLElement|string} modal - Modal element or selector
 * @param {Object} options - Options
 */
export function toggleModal(modal, options = {}) {
  const modalEl = typeof modal === 'string' ? querySelector(modal) : modal;
  if (!modalEl) return;

  if (modalEl.hidden || !modalEl.classList.contains('visible')) {
    openModal(modalEl, options);
  } else {
    closeModal(modalEl, options);
  }
}

/**
 * Trap focus within modal
 * @param {HTMLElement} modal - Modal element
 */
function trapFocus(modal) {
  if (!modal) return;

  const focusableElements = modal.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  if (focusableElements.length === 0) return;

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  modal.addEventListener('keydown', handleTabKey);
}

/**
 * Setup modal backdrop click to close
 * @param {HTMLElement|string} modal - Modal element or selector
 * @param {Function} closeCallback - Close callback
 */
export function setupModalBackdropClose(modal, closeCallback) {
  const modalEl = typeof modal === 'string' ? querySelector(modal) : modal;
  if (!modalEl) return;

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
      closeCallback();
    }
  });
}

/**
 * Setup modal escape key to close
 * @param {Function} closeCallback - Close callback
 * @returns {Function} Cleanup function
 */
export function setupModalEscapeClose(closeCallback) {
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeCallback();
    }
  };

  document.addEventListener('keydown', handleEscape);

  return () => {
    document.removeEventListener('keydown', handleEscape);
  };
}
