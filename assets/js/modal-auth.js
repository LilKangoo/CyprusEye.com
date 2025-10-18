(function () {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  const dialog = modal.querySelector('.modal__dialog');
  if (!dialog) return;

  const closeTrigger = modal.querySelector('[data-close]');
  const actionButtons = modal.querySelectorAll('[data-auth]');
  const openers = document.querySelectorAll('[data-open-auth]');

  const focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  let lastFocusedElement = null;
  let focusableElements = [];
  let firstFocusable = null;
  let lastFocusable = null;
  let previousBodyOverflow = '';

  const isOpen = () => modal.classList.contains('is-open');

  const updateFocusableElements = () => {
    focusableElements = Array.from(dialog.querySelectorAll(focusableSelector)).filter(
      (element) =>
        element instanceof HTMLElement &&
        element.offsetParent !== null &&
        !element.hasAttribute('disabled') &&
        element.getAttribute('aria-hidden') !== 'true'
    );

    firstFocusable = focusableElements[0] || null;
    lastFocusable = focusableElements[focusableElements.length - 1] || null;
  };

  const focusInitialElement = () => {
    updateFocusableElements();
    const target = firstFocusable || dialog;
    target.focus({ preventScroll: true });
  };

  const lockScroll = () => {
    previousBodyOverflow = document.body.style.overflow;
    document.body.classList.add('u-lock-scroll', 'is-modal-open');

    if (typeof window.lockBodyScroll === 'function') {
      window.lockBodyScroll();
    } else {
      document.body.style.overflow = 'hidden';
    }
  };

  const unlockScroll = () => {
    document.body.classList.remove('u-lock-scroll', 'is-modal-open');

    if (typeof window.unlockBodyScroll === 'function') {
      window.unlockBodyScroll();
      if (document.body.style.position !== 'fixed') {
        document.body.style.overflow = 'auto';
      }
    } else {
      document.body.style.overflow = previousBodyOverflow || 'auto';
    }
  };

  const closeInternally = ({ reason, restoreFocus = true } = {}) => {
    if (!isOpen()) return false;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleKeydown);
    unlockScroll();

    if (restoreFocus && lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      requestAnimationFrame(() => {
        try {
          lastFocusedElement.focus();
        } catch (error) {
          // ignore focus errors
        }
      });
    }

    modal.dispatchEvent(new CustomEvent('auth:closed', { detail: { reason } }));
    return true;
  };

  const focusTrap = (event) => {
    if (!isOpen() || event.key !== 'Tab') return;

    updateFocusableElements();

    if (!focusableElements.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }

    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === firstFocusable || activeElement === dialog) {
        event.preventDefault();
        (lastFocusable || firstFocusable).focus();
      }
      return;
    }

    if (activeElement === lastFocusable || activeElement === dialog) {
      event.preventDefault();
      (firstFocusable || dialog).focus();
    }
  };

  const handleKeydown = (event) => {
    if (!isOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeWithReason('escape', { activateGuest: true });
      return;
    }

    if (event.key === 'Tab') {
      focusTrap(event);
    }
  };

  const openInternally = () => {
    if (isOpen()) return false;

    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll();

    requestAnimationFrame(() => {
      focusInitialElement();
    });

    document.addEventListener('keydown', handleKeydown);
    modal.dispatchEvent(new CustomEvent('auth:opened'));
    return true;
  };

  const closeWithReason = (reason, options = {}) => {
    const { activateGuest = false, guestMessage, restoreFocus } = options;
    const payload = {
      activateGuest,
      guestMessage,
      reason,
    };

    if (typeof window.closeAuthModal === 'function') {
      const closed = window.closeAuthModal(payload);
      if (closed) {
        return;
      }
    }

    const fallbackMessage =
      guestMessage !== undefined
        ? guestMessage
        : activateGuest && typeof window.getGuestStatusMessage === 'function'
        ? window.getGuestStatusMessage()
        : undefined;

    const closedInternally = closeInternally({ reason, restoreFocus });
    if (closedInternally && activateGuest && typeof window.startGuestSession === 'function') {
      window.startGuestSession({ message: fallbackMessage });
    }
  };

  const controller = {
    open: () => openInternally(),
    close: (options = {}) => closeInternally(options),
    isOpen,
  };

  window.__authModalController = controller;

  openers.forEach((opener) => {
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal();
      } else {
        openInternally();
      }
    });
  });

  closeTrigger?.addEventListener('click', () => {
    closeWithReason('close-button', { activateGuest: true });
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeWithReason('backdrop', { activateGuest: true });
    }
  });

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-auth');
      if (!action) return;

      modal.dispatchEvent(new CustomEvent('auth:action', { detail: { action } }));

      const isGuest = action === 'guest';
      const guestMessage = isGuest && typeof window.getGuestStatusMessage === 'function'
        ? window.getGuestStatusMessage()
        : undefined;

      closeWithReason(action, { activateGuest: isGuest, guestMessage });
    });
  });
})();
