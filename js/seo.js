(function () {
  'use strict';

  const SUPPORTED_LANGUAGES = ['pl', 'en'];
  const DEFAULT_IMAGE = 'assets/cyprus_logo-1000x1054.png';
  const LOCALE_FALLBACK = {
    pl: 'pl_PL',
    en: 'en_GB',
  };

  const head = document.head || document.getElementsByTagName('head')[0];

  function ensureMeta(attribute, value) {
    const selector = `meta[${attribute}="${value}"]`;
    let element = head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, value);
      head.appendChild(element);
    }
    return element;
  }

  function ensureAlternate(hreflang) {
    let link = head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hreflang);
      head.appendChild(link);
    }
    return link;
  }

  function toAbsoluteUrl(value) {
    if (!value) {
      return '';
    }
    try {
      return new URL(value, window.location.origin).toString();
    } catch (error) {
      return value;
    }
  }

  const meta = {
    description: ensureMeta('name', 'description'),
    ogTitle: ensureMeta('property', 'og:title'),
    ogDescription: ensureMeta('property', 'og:description'),
    ogUrl: ensureMeta('property', 'og:url'),
    ogImage: ensureMeta('property', 'og:image'),
    ogLocale: ensureMeta('property', 'og:locale'),
  };

  const fallback = {
    title: document.title,
    description: meta.description.getAttribute('content') || '',
    ogTitle: meta.ogTitle.getAttribute('content') || document.title,
    ogDescription: meta.ogDescription.getAttribute('content') || '',
    ogImage: meta.ogImage.getAttribute('content') || DEFAULT_IMAGE,
    ogLocale: meta.ogLocale.getAttribute('content') || '',
  };

  function getTranslations(language) {
    const i18n = window.appI18n;
    if (!i18n || !i18n.translations) {
      return {};
    }
    return i18n.translations[language] || {};
  }

  function getTranslationString(translations, key) {
    if (!translations) {
      return null;
    }
    const entry = translations[key];
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

  function updateAlternateLinks(language) {
    SUPPORTED_LANGUAGES.forEach((code) => {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', code);
      const link = ensureAlternate(code);
      link.setAttribute('href', url.toString());
    });

    const defaultLink = ensureAlternate('x-default');
    const canonical = new URL(window.location.href);
    canonical.searchParams.delete('lang');
    defaultLink.setAttribute('href', canonical.toString());
  }

  function updateSeo(language) {
    const pageKey = document.body?.dataset?.seoPage || 'home';
    const translations = getTranslations(language);
    const baseKey = `seo.${pageKey}`;

    const title = getTranslationString(translations, `${baseKey}.title`) || fallback.title;
    if (title) {
      document.title = title;
    }

    const description =
      getTranslationString(translations, `${baseKey}.description`) || fallback.description;
    if (description && meta.description) {
      meta.description.setAttribute('content', description);
    }

    const ogTitle = getTranslationString(translations, `${baseKey}.ogTitle`) || title || fallback.ogTitle;
    if (ogTitle && meta.ogTitle) {
      meta.ogTitle.setAttribute('content', ogTitle);
    }

    const ogDescription =
      getTranslationString(translations, `${baseKey}.ogDescription`) || description || fallback.ogDescription;
    if (ogDescription && meta.ogDescription) {
      meta.ogDescription.setAttribute('content', ogDescription);
    }

    if (meta.ogUrl) {
      meta.ogUrl.setAttribute('content', window.location.href);
    }

    const ogImageValue =
      getTranslationString(translations, `${baseKey}.ogImage`) ||
      getTranslationString(translations, 'seo.ogImage') ||
      fallback.ogImage ||
      DEFAULT_IMAGE;
    if (ogImageValue && meta.ogImage) {
      meta.ogImage.setAttribute('content', toAbsoluteUrl(ogImageValue));
    }

    const localeValue =
      getTranslationString(translations, `${baseKey}.locale`) ||
      getTranslationString(translations, 'seo.locale') ||
      fallback.ogLocale ||
      LOCALE_FALLBACK[language] ||
      LOCALE_FALLBACK.en;
    if (localeValue && meta.ogLocale) {
      meta.ogLocale.setAttribute('content', localeValue);
    }

    updateAlternateLinks(language);
  }

  function getActiveLanguage() {
    if (window.appI18n && window.appI18n.language) {
      return window.appI18n.language;
    }
    return document.documentElement.lang || 'pl';
  }

  function applyForCurrentLanguage() {
    updateSeo(getActiveLanguage());
  }

  document.addEventListener('wakacjecypr:languagechange', (event) => {
    const language = event?.detail?.language || getActiveLanguage();
    updateSeo(language);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyForCurrentLanguage, { once: true });
  } else {
    applyForCurrentLanguage();
  }
})();
