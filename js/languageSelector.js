(function () {
  'use strict';

  const STORAGE_KEY = 'ce_lang_selected';
  const SUPPORTED_LANGUAGES = {
    pl: { label: 'Wybierz', flag: '🇵🇱', fullName: 'Polski' },
    en: { label: 'Choose', flag: '🇬🇧', fullName: 'English' },
    el: { label: 'Επιλέξτε', flag: '🇬🇷', fullName: 'Ελληνικά' },
    he: { label: 'בחר', flag: '🇮🇱', fullName: 'עברית' },
  };

  function safeLocalStorage(action, key, value) {
    try {
      if (action === 'get') return window.localStorage.getItem(key);
      if (action === 'set') window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Local storage unavailable:', error);
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

  class LanguageSelector {
    constructor() {
      this.overlay = null;
      this.dialog = null;
      this.isOpen = false;
      this.selectedLanguage = null;
    }

    shouldShow() {
      return !hasSelectedLanguage() && isHomePage();
    }

    createUi() {
      if (this.overlay) return;

      this.overlay = document.createElement('div');
      this.overlay.className = 'language-selector-overlay';

      this.dialog = document.createElement('div');
      this.dialog.className = 'language-selector-dialog';
      this.dialog.setAttribute('role', 'dialog');
      this.dialog.setAttribute('aria-modal', 'true');

      const title = document.createElement('h2');
      title.className = 'language-selector-title';
      title.textContent = 'Select Language / Wybierz język';
      this.dialog.appendChild(title);

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'language-selector-options';

      Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
        const info = SUPPORTED_LANGUAGES[code];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'language-selector-option';
        button.dataset.language = code;

        const text = document.createElement('span');
        text.className = 'language-selector-text';
        text.textContent = info.label;

        const flag = document.createElement('span');
        flag.className = 'language-selector-flag';
        flag.textContent = info.flag;

        button.appendChild(text);
        button.appendChild(flag);
        button.addEventListener('click', () => this.selectLanguage(code));

        optionsContainer.appendChild(button);
      });

      this.dialog.appendChild(optionsContainer);
      this.overlay.appendChild(this.dialog);
      document.body.appendChild(this.overlay);
    }

    show() {
      if (this.isOpen) return;
      
      console.log('🌍 Showing language selector...');
      this.createUi();
      this.isOpen = true;
      this.overlay.classList.add('is-visible');
      document.documentElement.setAttribute('data-language-selection-pending', 'true');
      window.languageSelectorActive = true;
    }

    hide() {
      if (!this.isOpen || !this.overlay) return;

      this.isOpen = false;
      this.overlay.classList.remove('is-visible');

      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
          this.overlay = null;
          this.dialog = null;
        }
      }, 300);
    }

    selectLanguage(code) {
      console.log('✅ Language selected:', code);
      
      this.selectedLanguage = code;
      markLanguageAsSelected();
      
      document.documentElement.removeAttribute('data-language-selection-pending');
      window.languageSelectorActive = false;

      if (window.appI18n && typeof window.appI18n.setLanguage === 'function') {
        window.appI18n.setLanguage(code);
      }

      this.hide();

      document.dispatchEvent(new CustomEvent('languageSelector:ready', {
        detail: { languageSelected: true, language: code }
      }));

      setTimeout(() => {
        if (window.appTutorial && typeof window.appTutorial.init === 'function') {
          window.appTutorial.init();
        }
      }, 150);
    }
  }

  function init() {
    const selector = new LanguageSelector();
    window.languageSelector = selector;

    const shouldShowSelector = selector.shouldShow();
    window.languageSelectorActive = shouldShowSelector;

    console.log('🔍 Language Selector initialized');
    console.log('  - Should show:', shouldShowSelector);
    console.log('  - Is home page:', isHomePage());
    console.log('  - Has selected language:', hasSelectedLanguage());

    if (shouldShowSelector) {
      document.documentElement.setAttribute('data-language-selection-pending', 'true');
      selector.show();
    } else {
      console.log('✓ Language already selected, skipping selector');
      document.dispatchEvent(new CustomEvent('languageSelector:ready', {
        detail: { languageSelected: true, skipSelector: true }
      }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
