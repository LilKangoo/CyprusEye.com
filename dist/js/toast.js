(() => {
  const TOAST_CLASS = 'ce-toast';
  const TYPE_CLASS_PREFIX = `${TOAST_CLASS}--`;
  const VALID_TYPES = new Set(['info', 'success', 'error']);
  const ACTIVE_TOASTS = new Set();

  function resolveDocument() {
    if (typeof document !== 'undefined') {
      return document;
    }
    return null;
  }

  function removeToast(el, timerId) {
    if (!el) {
      return;
    }
    if (timerId) {
      window.clearTimeout(timerId);
    }
    ACTIVE_TOASTS.delete(el);
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function createToast(message, type, ttl) {
    const doc = resolveDocument();
    if (!doc || !doc.body) {
      return null;
    }

    const toast = doc.createElement('div');
    toast.className = `${TOAST_CLASS} ${TYPE_CLASS_PREFIX}${type}`;
    toast.textContent = message;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    doc.body.appendChild(toast);

    const timerId = window.setTimeout(() => {
      removeToast(toast, timerId);
    }, ttl);

    ACTIVE_TOASTS.add(toast);
    toast.addEventListener('click', () => removeToast(toast, timerId));

    return { toast, timerId };
  }

  window.Toast = {
    show(message, type = 'info', ttl = 3500) {
      const doc = resolveDocument();
      if (!doc) {
        return null;
      }

      const normalizedMessage = typeof message === 'string' ? message.trim() : '';
      if (!normalizedMessage) {
        return null;
      }

      const normalizedType = VALID_TYPES.has(type) ? type : 'info';
      const lifetime = Number.isFinite(ttl) && ttl > 0 ? ttl : 3500;

      // Remove any active toasts to avoid stacking overflows.
      ACTIVE_TOASTS.forEach((toastEl) => removeToast(toastEl));
      ACTIVE_TOASTS.clear();

      return createToast(normalizedMessage, normalizedType, lifetime);
    },
  };

  // Alias for convenience
  window.showToast = window.Toast.show;
})();

// Export for ES6 modules
export function showToast(message, type = 'info', ttl = 3500) {
  if (typeof window !== 'undefined' && window.showToast) {
    return window.showToast(message, type, ttl);
  }
  console.warn('showToast not available');
  return null;
}

