(() => {
  const TOAST_CLASS = 'ce-toast';
  const TYPE_CLASS_PREFIX = `${TOAST_CLASS}--`;
  const VALID_TYPES = new Set(['info', 'success', 'error']);
  const ACTIVE_TOASTS = new Set();
  const AUTH_ERROR_RE = /jwt expired|expired jwt|invalid jwt|token expired|auth session missing|session expired|unauthorized|forbidden/i;

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

  function normalizeToastMessage(message, type) {
    const raw = (typeof message === 'string' ? message : String(message?.message || message || '')).trim();
    if (!raw) return '';

    if (type !== 'error') return raw;

    const authUtils = (typeof window !== 'undefined' && window.CE_AUTH_UTILS && typeof window.CE_AUTH_UTILS.toUserMessage === 'function')
      ? window.CE_AUTH_UTILS
      : null;
    if (authUtils && typeof authUtils.isRecoverableError === 'function' && authUtils.isRecoverableError(raw)) {
      return authUtils.toUserMessage(raw, 'Session expired. Please sign in again.');
    }

    if (AUTH_ERROR_RE.test(raw)) {
      return 'Session expired. Please sign in again.';
    }

    return raw;
  }

  window.Toast = {
    show(message, type = 'info', ttl = 3500) {
      const doc = resolveDocument();
      if (!doc) {
        return null;
      }

      const normalizedType = VALID_TYPES.has(type) ? type : 'info';
      const normalizedMessage = normalizeToastMessage(message, normalizedType);
      if (!normalizedMessage) {
        return null;
      }

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
