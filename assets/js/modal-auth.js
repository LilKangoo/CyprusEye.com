(function () {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  const dialog = modal.querySelector('.modal__dialog');
  if (!dialog) return;

  const closeTrigger = modal.querySelector('[data-close]');
  const openers = document.querySelectorAll('[data-open-auth]');
  const tabButtons = Array.from(modal.querySelectorAll('[data-auth-tab]'));
  const panels = new Map(
    tabButtons.map((button) => {
      const tabId = button.dataset.authTab;
      const panel = modal.querySelector(`[data-auth-panel="${tabId}"]`);
      return [tabId, panel || null];
    }),
  );

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
  let currentTab = tabButtons[0]?.dataset.authTab || 'login';

  const isOpen = () => modal.classList.contains('is-open');

  const updateFocusableElements = () => {
    focusableElements = Array.from(dialog.querySelectorAll(focusableSelector)).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.hasAttribute('disabled')) {
        return false;
      }
      if (element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      if (element.closest('[hidden]')) {
        return false;
      }
      return element.offsetParent !== null;
    });

    firstFocusable = focusableElements[0] || null;
    lastFocusable = focusableElements[focusableElements.length - 1] || null;
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

  const focusInitialElement = () => {
    updateFocusableElements();
    const activePanel = panels.get(currentTab);
    const panelFocusable = activePanel
      ? focusableElements.filter((element) => activePanel.contains(element))
      : [];
    const target = panelFocusable[0] || firstFocusable || dialog;
    target.focus({ preventScroll: true });
  };

  const setActiveTab = (tabId, { focus = false } = {}) => {
    if (!panels.has(tabId)) {
      tabId = tabButtons[0]?.dataset.authTab || currentTab || 'login';
    }
    currentTab = tabId;

    tabButtons.forEach((button) => {
      const isActive = button.dataset.authTab === tabId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach((panel, id) => {
      if (!panel) return;
      const isActive = id === tabId;
      panel.classList.toggle('is-active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (focus && isOpen()) {
      requestAnimationFrame(() => {
        focusInitialElement();
      });
    }
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
      closeInternally({ restoreFocus: true });
      return;
    }

    if (event.key === 'Tab') {
      focusTrap(event);
    }
  };

  const openInternally = ({ tab } = {}) => {
    if (isOpen()) return false;

    if (tab) {
      setActiveTab(tab, { focus: false });
    }

    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll();

    requestAnimationFrame(() => {
      focusInitialElement();
    });

    document.addEventListener('keydown', handleKeydown);
    modal.dispatchEvent(new CustomEvent('auth:opened', { detail: { tab: currentTab } }));
    return true;
  };

  const closeInternally = ({ restoreFocus = true } = {}) => {
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

    modal.dispatchEvent(new CustomEvent('auth:closed'));
    return true;
  };

  const controller = {
    open(tabId) {
      return openInternally({ tab: tabId });
    },
    close(options = {}) {
      return closeInternally(options);
    },
    isOpen,
    setActiveTab(tabId, options = {}) {
      setActiveTab(tabId, { focus: options.focus ?? isOpen() });
    },
    getActiveTab() {
      return currentTab;
    },
  };

  window.__authModalController = controller;

  openers.forEach((opener) => {
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      const targetTab = opener.getAttribute('data-auth-target') || 'login';
      controller.setActiveTab(targetTab, { focus: false });
      controller.open(targetTab);
    });
  });

  closeTrigger?.addEventListener('click', () => {
    controller.close();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      controller.close();
    }
  });

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.authTab;
      controller.setActiveTab(tabId, { focus: true });
    });
  });

  setActiveTab(currentTab);
})();
