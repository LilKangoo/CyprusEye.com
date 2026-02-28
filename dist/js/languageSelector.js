(function () {
  'use strict';

  const STORAGE_KEY = 'ce_lang_selected';
  const BOOT_FLAG = '__ceLanguageSelectorBooted';
  const PRESENTED_FLAG = '__ceLanguageSelectorPresented';
  const SUPPORTED_LANGUAGES = {
    pl: { label: 'Wybierz', flag: '🇵🇱', fullName: 'Polski' },
    en: { label: 'Choose', flag: '🇬🇧', fullName: 'English' },
    // el: { label: 'Επιλέξτε', flag: '🇬🇷', fullName: 'Ελληνικά' },
    // he: { label: 'בחר', flag: '🇮🇱', fullName: 'עברית' },
  };

  function safeLocalStorage(action, key, value) {
    try {
      if (action === 'get') {
        return window.localStorage.getItem(key);
      }
      if (action === 'set') {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('Local storage unavailable for language selection.', error);
    }
    return null;
  }

  function hasSelectedLanguage() {
    return safeLocalStorage('get', STORAGE_KEY) === 'true';
  }

  function markLanguageAsSelected() {
    safeLocalStorage('set', STORAGE_KEY, 'true');
  }

  function isHomePage() {
    return (document.body?.dataset?.seoPage || '') === 'home';
  }

  function hasBeenPresented() {
    try {
      return window[PRESENTED_FLAG] === true;
    } catch (_) {
      return false;
    }
  }

  function markPresented() {
    try {
      window[PRESENTED_FLAG] = true;
    } catch (_) {}
  }

  class LanguageSelector {
    constructor() {
      this.overlay = null;
      this.dialog = null;
      this.isOpen = false;
      this.selectedLanguage = null;

      this.handleKeydown = this.handleKeydown.bind(this);
    }

    shouldShow() {
      return !hasSelectedLanguage() && isHomePage() && !hasBeenPresented();
    }

    createUi() {
      if (this.overlay) {
        return;
      }

      // Create overlay
      this.overlay = document.createElement('div');
      this.overlay.className = 'language-selector-overlay';
      this.overlay.setAttribute('aria-hidden', 'false');

      // Create backdrop
      const backdrop = document.createElement('div');
      backdrop.className = 'language-selector-backdrop';
      this.overlay.appendChild(backdrop);

      // Create dialog
      this.dialog = document.createElement('div');
      this.dialog.className = 'language-selector-dialog';
      this.dialog.setAttribute('role', 'dialog');
      this.dialog.setAttribute('aria-modal', 'true');
      this.dialog.setAttribute('aria-labelledby', 'languageSelectorTitle');
      this.dialog.setAttribute('tabindex', '-1');

      // Create title (hidden visually but accessible)
      const title = document.createElement('h2');
      title.id = 'languageSelectorTitle';
      title.className = 'language-selector-title';
      title.textContent = 'Select Language / Wybierz język';
      this.dialog.appendChild(title);

      // Create language options container
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'language-selector-options';

      // Create buttons for each language
      Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
        const info = SUPPORTED_LANGUAGES[code];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'language-selector-option';
        button.dataset.language = code;
        button.setAttribute('aria-label', `${info.label} ${info.fullName}`);

        // Create flag span
        const flag = document.createElement('span');
        flag.className = 'language-selector-flag';
        flag.textContent = info.flag;
        flag.setAttribute('aria-hidden', 'true');

        // Create text span
        const text = document.createElement('span');
        text.className = 'language-selector-text';
        text.textContent = info.label;

        button.appendChild(text);
        button.appendChild(flag);

        button.addEventListener('click', () => {
          this.selectLanguage(code);
        });

        optionsContainer.appendChild(button);
      });

      this.dialog.appendChild(optionsContainer);
      this.overlay.appendChild(this.dialog);
      document.body.appendChild(this.overlay);
    }

    show() {
      if (this.isOpen) {
        return;
      }
      if (hasBeenPresented()) {
        return;
      }

      this.createUi();
      this.isOpen = true;
      markPresented();
      this.overlay.classList.add('is-visible');
      document.body.classList.add('language-selector-open');

      // Add keyboard listener
      document.addEventListener('keydown', this.handleKeydown, true);

      // Focus the dialog
      requestAnimationFrame(() => {
        if (this.dialog) {
          this.dialog.focus({ preventScroll: true });
        }
      });
    }

    hide() {
      if (!this.isOpen || !this.overlay) {
        return;
      }

      this.isOpen = false;
      this.overlay.classList.remove('is-visible');
      document.body.classList.remove('language-selector-open');

      document.removeEventListener('keydown', this.handleKeydown, true);

      // Remove overlay after animation
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
          this.overlay = null;
          this.dialog = null;
        }
      }, 300);
    }

    selectLanguage(code) {
      this.selectedLanguage = code;
      markLanguageAsSelected();
      try {
        document.dispatchEvent(new CustomEvent('ce:language-selected', { detail: { language: code } }));
      } catch (_) {}

      // Set language using the i18n system
      if (window.appI18n && typeof window.appI18n.setLanguage === 'function') {
        window.appI18n.setLanguage(code);
      }

      // Hide the selector
      this.hide();

      // Wait for language to be set, then initialize tutorial if needed
      setTimeout(() => {
        if (window.appTutorial && typeof window.appTutorial.init === 'function') {
          window.appTutorial.init();
        }
      }, 100);
    }

    handleKeydown(event) {
      if (!this.isOpen) {
        return;
      }

      // Prevent escape key from closing (user must select a language)
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }

      // Handle arrow key navigation
      const buttons = Array.from(this.dialog?.querySelectorAll('.language-selector-option') || []);
      if (buttons.length === 0) {
        return;
      }

      const currentIndex = buttons.indexOf(document.activeElement);

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        let nextIndex;
        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % buttons.length;
        } else {
          nextIndex = currentIndex === -1 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
        }
        buttons[nextIndex].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        buttons[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      }

      // Trap focus within dialog
      if (event.key === 'Tab') {
        event.preventDefault();
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey) {
          if (activeElement === first || !this.dialog?.contains(activeElement)) {
            last.focus();
          } else {
            const prevIndex = (currentIndex - 1 + buttons.length) % buttons.length;
            buttons[prevIndex].focus();
          }
        } else {
          if (activeElement === last || !this.dialog?.contains(activeElement)) {
            first.focus();
          } else {
            const nextIndex = (currentIndex + 1) % buttons.length;
            buttons[nextIndex].focus();
          }
        }
      }
    }
  }

  // Initialize on DOM ready
  function init() {
    if (window[BOOT_FLAG] === true) {
      return;
    }
    window[BOOT_FLAG] = true;

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initSelector();
      });
    } else {
      initSelector();
    }
  }

  function initSelector() {
    if (window.languageSelector && typeof window.languageSelector.shouldShow === 'function') {
      if (window.languageSelector.shouldShow() && typeof window.languageSelector.show === 'function') {
        window.languageSelector.show();
      }
      return;
    }

    const selector = new LanguageSelector();

    // Show selector if needed (before tutorial and i18n init)
    if (selector.shouldShow()) {
      // Show immediately
      selector.show();
    }

    // Expose to window for debugging
    window.languageSelector = selector;
  }

  init();
})();
