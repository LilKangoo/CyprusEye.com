(function () {
  'use strict';

  const DEFAULT_LANGUAGE = 'en';
  const STORAGE_KEY = 'wakacjecypr-language';
  const SUPPORTED_LANGUAGES = {
    en: { label: '🇬🇧 English', dir: 'ltr' },
    pl: { label: '🇵🇱 Polski', dir: 'ltr' },
    el: { label: '🇬🇷 Ελληνικά', dir: 'ltr' },
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
    return translations[key];
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

    const elements = document.querySelectorAll('[data-i18n]');
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
        anchor.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
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

  function handleLanguageChange(event) {
    const nextLanguage = event.target.value;
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, nextLanguage)) {
      return;
    }
    if (nextLanguage === appI18n.language) {
      return;
    }

    persistLanguage(nextLanguage);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', nextLanguage);
    window.location.href = url.toString();
  }

  function updateSwitcherValue(language) {
    const select = document.getElementById('languageSwitcherSelect');
    if (select && select.value !== language) {
      select.value = language;
    }
  }

  function ensureLanguageSwitcher(language) {
    if (document.getElementById('languageSwitcherSelect')) {
      updateSwitcherValue(language);
      return;
    }

    const container = document.createElement('div');
    container.className = 'language-switcher';

    const label = document.createElement('label');
    label.className = 'language-switcher-label';
    label.htmlFor = 'languageSwitcherSelect';
    label.dataset.i18n = 'language.switcher.label';
    label.textContent = 'Language';

    const select = document.createElement('select');
    select.id = 'languageSwitcherSelect';
    select.className = 'language-switcher-select';
    select.setAttribute('aria-label', 'Language selector');
    select.dataset.i18nAttrs = 'aria-label:language.switcher.label';

    Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
      const info = SUPPORTED_LANGUAGES[code];
      const option = document.createElement('option');
      option.value = code;
      option.dataset.i18n = `language.option.${code}`;
      option.textContent = `${info.flag || ''} ${info.label}`.trim();
      select.append(option);
    });

    select.addEventListener('change', handleLanguageChange);

    container.append(label, select);
    document.body.append(container);

    updateSwitcherValue(language);
  }

  function init() {
    const language = detectLanguage();
    appI18n.language = language;
    persistLanguage(language);
    syncUrl(language);

    const apply = (translations) => {
      appI18n.translations[language] = translations || {};
      const run = () => {
        ensureLanguageSwitcher(language);
        applyTranslations(language, translations);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
      } else {
        run();
      }
    };

    fetchTranslations(language).then(apply);
  }

  init();
})();
