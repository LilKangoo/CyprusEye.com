(function () {
  'use strict';

  const DEFAULT_LANGUAGE = 'pl';
  const STORAGE_KEY = 'ce_lang';
  const SUPPORTED_LANGUAGES = {
    pl: { label: 'Polski', shortLabel: 'PL', flag: '🇵🇱', dir: 'ltr' },
    en: { label: 'English', shortLabel: 'EN', flag: '🇬🇧', dir: 'ltr' },
    el: { label: 'Ελληνικά', shortLabel: 'EL', flag: '🇬🇷', dir: 'ltr' },
    he: { label: 'עברית', shortLabel: 'HE', flag: '🇮🇱', dir: 'rtl' },
  };

  const translationCache = new Map();
  const originalContent = new WeakMap();
  const originalAttributes = new WeakMap();
  const appI18n = window.appI18n || {
    language: DEFAULT_LANGUAGE,
    translations: {},
  };

  window.appI18n = appI18n;

  function safeLocalStorage(action, key, value) {
    try {
      if (action === 'get') {
        return window.localStorage.getItem(key);
      }
      if (action === 'set') {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('Local storage is not available for language preference.', error);
    }
    return null;
  }

  function detectLanguage() {
    const url = new URL(window.location.href);
    const urlLang = (url.searchParams.get('lang') || '').toLowerCase();
    if (urlLang && Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, urlLang)) {
      return urlLang;
    }

    const stored = (safeLocalStorage('get', STORAGE_KEY) || '').toLowerCase();
    if (stored && Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, stored)) {
      return stored;
    }

    return DEFAULT_LANGUAGE;
  }

  function persistLanguage(language) {
    safeLocalStorage('set', STORAGE_KEY, language);
  }

  function syncUrl(language) {
    const current = new URL(window.location.href);
    if (current.searchParams.get('lang') !== language) {
      current.searchParams.set('lang', language);
      window.history.replaceState({}, '', current);
    }
  }

  function fetchTranslations(language) {
    if (!language || !Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, language)) {
      return Promise.resolve({});
    }

    if (translationCache.has(language)) {
      return translationCache.get(language);
    }

    const promise = fetch(`translations/${language}.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load translations for ${language}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.error('Unable to load translation file.', error);
        return {};
      });

    translationCache.set(language, promise);
    return promise;
  }

  function parseAttributeSpec(spec, fallbackKey) {
    const map = new Map();
    if (!spec) {
      return map;
    }

    spec.split(',').forEach((raw) => {
      const entry = raw.trim();
      if (!entry) {
        return;
      }
      const parts = entry.split(':');
      const attr = parts[0].trim();
      if (!attr) {
        return;
      }
      const key = parts[1] && parts[1].trim();
      map.set(attr, key || fallbackKey || null);
    });

    return map;
  }

  function captureOriginal(element, attrMap) {
    if (!originalContent.has(element)) {
      originalContent.set(element, element.innerHTML);
    }

    if (attrMap.size && !originalAttributes.has(element)) {
      const attrs = {};
      attrMap.forEach((_, attribute) => {
        attrs[attribute] = element.getAttribute(attribute);
      });
      originalAttributes.set(element, attrs);
    }
  }

  function restoreOriginal(element) {
    if (!originalContent.has(element)) {
      return;
    }
    element.innerHTML = originalContent.get(element);
  }

  function restoreOriginalAttribute(element, attribute) {
    const stored = originalAttributes.get(element);
    if (!stored || !Object.prototype.hasOwnProperty.call(stored, attribute)) {
      return;
    }
    const value = stored[attribute];
    if (value === null || typeof value === 'undefined') {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, value);
    }
  }

  function getTranslationEntry(translations, key) {
    if (!key || !translations) {
      return null;
    }

    // Direct lookup for flat keys
    if (Object.prototype.hasOwnProperty.call(translations, key)) {
      return translations[key];
    }

    // Support nested objects via dot notation (e.g. 'language.switcher.label')
    if (key.indexOf('.') !== -1) {
      const parts = key.split('.');
      let current = translations;

      for (const part of parts) {
        if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
          current = current[part];
        } else {
          return null;
        }
      }

      return current;
    }

    return null;
  }

  function getTranslationString(translations, key) {
    const entry = getTranslationEntry(translations, key);
    if (typeof entry === 'string') {
      return entry;
    }
    if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string') {
        return entry.text;
      }
      if (typeof entry.html === 'string') {
        return entry.html;
      }
    }
    return null;
  }

  function applyTranslationToElement(element, translations) {
    const key = element.dataset.i18n;
    const attrMap = parseAttributeSpec(element.dataset.i18nAttrs, key);

    captureOriginal(element, attrMap);

    let applied = false;
    const entry = getTranslationEntry(translations, key);
    if (typeof entry === 'string') {
      element.textContent = entry;
      applied = true;
    } else if (entry && typeof entry === 'object' && typeof entry.html === 'string') {
      element.innerHTML = entry.html;
      applied = true;
    } else if (entry && typeof entry === 'object' && typeof entry.text === 'string') {
      element.textContent = entry.text;
      applied = true;
    } else if (!key) {
      applied = true;
    }

    if (!applied) {
      restoreOriginal(element);
    }

    if (attrMap.size) {
      attrMap.forEach((attributeKey, attribute) => {
        const value = getTranslationString(translations, attributeKey);
        if (typeof value === 'string') {
          element.setAttribute(attribute, value);
        } else if (attributeKey === key) {
          const fallback = getTranslationString(translations, key);
          if (typeof fallback === 'string') {
            element.setAttribute(attribute, fallback);
          } else {
            restoreOriginalAttribute(element, attribute);
          }
        } else {
          restoreOriginalAttribute(element, attribute);
        }
      });
    }
  }

  function applyTranslations(language, translations = {}) {
    appI18n.language = language;
    appI18n.translations[language] = translations;

    const languageInfo = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
    document.documentElement.lang = language;
    document.documentElement.dir = languageInfo.dir;

    const elements = document.querySelectorAll('[data-i18n], [data-i18n-attrs]');
    elements.forEach((element) => {
      applyTranslationToElement(element, translations);
    });

    updateInternalLinks(language);

    document.dispatchEvent(
      new CustomEvent('wakacjecypr:languagechange', {
        detail: { language },
      })
    );
  }

  function updateInternalLinks(language) {
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) {
          return;
        }
        url.searchParams.set('lang', language);
        // Remove leading slash to use relative paths
        const relativePath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
        anchor.setAttribute('href', `${relativePath}${url.search}${url.hash}`);
      } catch (error) {
        console.warn('Unable to normalise link for i18n.', href, error);
      }
    });

    const navigable = document.querySelectorAll('[data-page-url]');
    navigable.forEach((element) => {
      const target = element.getAttribute('data-page-url');
      if (!target) {
        return;
      }
      try {
        const url = new URL(target, window.location.origin);
        if (url.origin !== window.location.origin) {
          return;
        }
        url.searchParams.set('lang', language);
        element.setAttribute('data-page-url', `${url.pathname}${url.search}${url.hash}`);
      } catch (error) {
        console.warn('Unable to normalise navigation target for i18n.', target, error);
      }
    });
  }

  function updateLanguagePills(language) {
    const groups = document.querySelectorAll('[data-language-toggle]');
    if (!groups.length) {
      return;
    }

    groups.forEach((group) => {
      const pills = group.querySelectorAll('[data-language-pill]');
      pills.forEach((pill) => {
        const code = (pill.dataset.languagePill || '').toLowerCase();
        const isActive = code === language;
        pill.classList.toggle('is-active', isActive);
        pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });
  }

  function initLanguagePills() {
    const groups = document.querySelectorAll('[data-language-toggle]');
    if (!groups.length) {
      return false;
    }

    groups.forEach((group) => {
      if (group.dataset.languageInit === 'true') {
        return;
      }

      group.dataset.languageInit = 'true';

      group.addEventListener('click', (event) => {
        const pill = event.target.closest('[data-language-pill]');
        if (!pill || !group.contains(pill)) {
          return;
        }

        const lang = (pill.dataset.languagePill || '').toLowerCase();
        if (!lang) {
          return;
        }

        if (lang === appI18n.language) {
          updateLanguagePills(appI18n.language);
          return;
        }

        setLanguage(lang);
      });
    });

    updateLanguagePills(appI18n.language);
    return true;
  }

  function updateSwitcherValue(language) {
    updateLanguagePills(language);
    const container = document.querySelector('.language-switcher');
    if (!container) {
      return;
    }

    const info = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];

    const toggle = container.querySelector('.language-switcher-toggle');
    if (toggle) {
      toggle.setAttribute('data-language', language);
      const flag = toggle.querySelector('.language-switcher-toggle-flag');
      const text = toggle.querySelector('.language-switcher-toggle-text');
      if (flag) {
        flag.textContent = info.flag || '';
      }
      if (text) {
        text.textContent = info.shortLabel || language.toUpperCase();
      }
    }

    const menu = container.querySelector('.language-switcher-menu');
    const options = container.querySelectorAll('.language-switcher-option');
    let activeId = null;

    options.forEach((option) => {
      const isActive = option.dataset.language === language;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        activeId = option.id || null;
      }
    });

    if (menu) {
      if (activeId) {
        menu.setAttribute('aria-activedescendant', activeId);
      } else {
        menu.removeAttribute('aria-activedescendant');
      }
    }
  }

  function ensureLanguageSwitcher(language) {
    const hasInlineSwitcher = document.querySelector('[data-language-toggle]');
    if (hasInlineSwitcher) {
      initLanguagePills();
      updateLanguagePills(language);
      const floating = document.querySelector('.language-switcher');
      if (floating && floating.parentNode) {
        floating.parentNode.removeChild(floating);
      }
      return;
    }

    const existing = document.querySelector('.language-switcher');
    if (existing) {
      updateSwitcherValue(language);
      return;
    }

    const container = document.createElement('div');
    container.className = 'language-switcher';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'languageSwitcherToggle';
    toggle.className = 'language-switcher-toggle';
    toggle.dataset.testid = 'language-switcher-toggle';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Language selector');
    toggle.dataset.i18nAttrs = 'aria-label:language.switcher.label';

    const toggleFlag = document.createElement('span');
    toggleFlag.className = 'language-switcher-toggle-flag';
    toggle.append(toggleFlag);

    const toggleText = document.createElement('span');
    toggleText.className = 'language-switcher-toggle-text';
    toggle.append(toggleText);

    const menu = document.createElement('ul');
    menu.className = 'language-switcher-menu';
    menu.id = 'languageSwitcherMenu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Language selector');
    menu.dataset.i18nAttrs = 'aria-label:language.switcher.label';
    menu.setAttribute('aria-hidden', 'true');

    toggle.setAttribute('aria-controls', menu.id);

    const setOptionsTabIndex = (value) => {
      menu.querySelectorAll('.language-switcher-option').forEach((option) => {
        option.tabIndex = value;
      });
    };

    function handleDocumentPointerDown(event) {
      if (!container.contains(event.target)) {
        closeMenu();
      }
    }

    function handleDocumentKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusToggle: true });
      }
    }

    function handleMenuKeydown(event) {
      const options = Array.from(menu.querySelectorAll('.language-switcher-option'));
      if (!options.length) {
        return;
      }

      const currentIndex = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
        options[nextIndex].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = currentIndex === -1 ? options.length - 1 : (currentIndex - 1 + options.length) % options.length;
        options[prevIndex].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        options[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        options[options.length - 1].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusToggle: true });
      } else if (event.key === 'Tab') {
        closeMenu();
      }
    }

    function openMenu() {
      if (container.classList.contains('is-open')) {
        return;
      }

      container.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      setOptionsTabIndex(0);

      const activeOption =
        menu.querySelector('.language-switcher-option.is-active') ||
        menu.querySelector('.language-switcher-option');

      window.requestAnimationFrame(() => {
        if (activeOption) {
          activeOption.focus();
        }
      });

      document.addEventListener('pointerdown', handleDocumentPointerDown, true);
      document.addEventListener('keydown', handleDocumentKeydown);
    }

    function closeMenu({ focusToggle = false } = {}) {
      if (!container.classList.contains('is-open')) {
        return;
      }

      container.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      setOptionsTabIndex(-1);

      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      document.removeEventListener('keydown', handleDocumentKeydown);

      if (focusToggle) {
        toggle.focus();
      }
    }

    Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
      const info = SUPPORTED_LANGUAGES[code];
      const item = document.createElement('li');
      item.className = 'language-switcher-menu-item';

      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'language-switcher-option';
      option.id = `languageSwitcherOption-${code}`;
      option.dataset.language = code;
      option.dataset.testid = `language-option-${code}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', code === language ? 'true' : 'false');
      option.tabIndex = -1;

      const flag = document.createElement('span');
      flag.className = 'language-switcher-option-flag';
      flag.textContent = info.flag || '';
      option.append(flag);

      const label = document.createElement('span');
      label.className = 'language-switcher-option-label';
      label.dataset.i18n = `language.option.${code}`;
      label.textContent = info.label;
      option.append(label);

      option.addEventListener('click', () => {
        closeMenu();
        if (code !== appI18n.language) {
          setLanguage(code);
        }
      });

      item.append(option);
      menu.append(item);
    });

    toggle.addEventListener('click', () => {
      if (container.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        if (!container.classList.contains('is-open')) {
          event.preventDefault();
          openMenu();
        }
      }
    });

    menu.addEventListener('keydown', handleMenuKeydown);

    container.append(toggle, menu);
    document.body.append(container);

    updateSwitcherValue(language);
    setOptionsTabIndex(-1);
  }

  function setLanguage(language, { persist = true, updateUrl = true } = {}) {
    let target = language;
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, target)) {
      target = DEFAULT_LANGUAGE;
    }

    if (persist) {
      persistLanguage(target);
    }
    if (updateUrl) {
      syncUrl(target);
    }

    // Apply text direction (RTL/LTR)
    const langConfig = SUPPORTED_LANGUAGES[target];
    if (langConfig) {
      document.documentElement.setAttribute('dir', langConfig.dir);
      document.documentElement.setAttribute('lang', target);
    }

    const apply = (translations = {}) => {
      const run = () => {
        ensureLanguageSwitcher(target);
        applyTranslations(target, translations);
        updateSwitcherValue(target);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
      } else {
        run();
      }
    };

    const cached = translationCache.get(target);
    if (cached) {
      cached.then(apply);
      return;
    }

    fetchTranslations(target).then((translations) => {
      translationCache.set(target, Promise.resolve(translations || {}));
      apply(translations);
    });
  }

  function init() {
    // Check if language selector is active (first visit)
    const languageSelector = window.languageSelector;
    if (languageSelector && typeof languageSelector.shouldShow === 'function' && languageSelector.shouldShow()) {
      // Language selector will handle initialization
      return;
    }

    const detected = detectLanguage();
    const language = Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, detected)
      ? detected
      : DEFAULT_LANGUAGE;

    setLanguage(language, { persist: true, updateUrl: true });
  }

  appI18n.setLanguage = setLanguage;

  // Wait for language selector to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 10); // Small delay to let language selector initialize first
    });
  } else {
    setTimeout(init, 10);
  }
})();
