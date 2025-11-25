(function () {
  'use strict';

  const SUPPORTED_LANGUAGES = ['pl', 'en', 'el', 'he'];
  const DEFAULT_IMAGE = 'assets/cyprus_logo-1000x1054.png';
  const CANONICAL_ORIGIN = 'https://www.cypruseye.com';
  const LOCALE_FALLBACK = {
    pl: 'pl_PL',
    en: 'en_GB',
    el: 'el_GR',
    he: 'he_IL',
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

  function ensureLocalizedMeta(attribute, value, language) {
    const selector = `meta[${attribute}="${value}"][lang="${language}"]`;
    let element = head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, value);
      element.setAttribute('lang', language);
      head.appendChild(element);
    }
    return element;
  }

  function ensureLink(rel) {
    let link = head.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      head.appendChild(link);
    }
    return link;
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
      return new URL(value, CANONICAL_ORIGIN).toString();
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

  const canonicalLink = ensureLink('canonical');

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

  function buildCanonicalUrl() {
    const url = new URL(window.location.pathname, CANONICAL_ORIGIN);
    return url.toString();
  }

  function buildLanguageUrl(language) {
    const url = new URL(window.location.pathname, CANONICAL_ORIGIN);
    const params = new URLSearchParams(window.location.search);
    if (language) {
      params.set('lang', language);
    }
    params.forEach((value, key) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    if (language) {
      url.searchParams.set('lang', language);
    } else {
      url.searchParams.delete('lang');
    }
    return url.toString();
  }

  function updateAlternateLinks(activeLanguage) {
    SUPPORTED_LANGUAGES.forEach((code) => {
      const link = ensureAlternate(code);
      link.setAttribute('href', buildLanguageUrl(code));
    });

    const defaultLink = ensureAlternate('x-default');
    defaultLink.setAttribute('href', buildCanonicalUrl());

    canonicalLink.setAttribute('href', buildCanonicalUrl());

    if (meta.ogUrl) {
      meta.ogUrl.setAttribute('content', buildLanguageUrl(activeLanguage));
    }
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

    const titleElement = head.querySelector('title');
    if (titleElement) {
      titleElement.setAttribute('lang', language);
    }

    SUPPORTED_LANGUAGES.forEach((code) => {
      const localizedTranslations = getTranslations(code);
      const localizedBaseKey = `seo.${pageKey}`;
      const localizedTitle =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.title`) || fallback.title;
      const localizedDescription =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.description`) || fallback.description;
      const localizedOgTitle =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.ogTitle`) || localizedTitle;
      const localizedOgDescription =
        getTranslationString(localizedTranslations, `${localizedBaseKey}.ogDescription`) ||
        localizedDescription;

      const titleMeta = ensureLocalizedMeta('name', 'title', code);
      titleMeta.setAttribute('content', localizedTitle);

      const descriptionMeta = ensureLocalizedMeta('name', 'description', code);
      descriptionMeta.setAttribute('content', localizedDescription);

      const ogTitleMeta = ensureLocalizedMeta('property', 'og:title', code);
      ogTitleMeta.setAttribute('content', localizedOgTitle);

      const ogDescriptionMeta = ensureLocalizedMeta('property', 'og:description', code);
      ogDescriptionMeta.setAttribute('content', localizedOgDescription);
    });

    head
      .querySelectorAll('meta[property="og:locale:alternate"]')
      .forEach((node) => node.parentNode?.removeChild(node));
    SUPPORTED_LANGUAGES.filter((code) => code !== language).forEach((code) => {
      const locale = LOCALE_FALLBACK[code] || code;
      const alternate = ensureLocalizedMeta('property', 'og:locale:alternate', code);
      alternate.setAttribute('content', locale);
    });

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
    try { ensureTripsQuickAction(); } catch(e) { /* noop */ }
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

// Inject "Wycieczki" link into header quick actions if missing
function ensureTripsQuickAction() {
  const container = document.querySelector('.header-actions-primary');
  if (!container) return;
  const already = Array.from(container.querySelectorAll('a')).some(a => /\btrips\.html\b/i.test(a.getAttribute('href')||''));
  if (already) return;
  const a = document.createElement('a');
  a.className = 'ghost header-link';
  a.href = 'trips.html';
  a.setAttribute('aria-label', 'Wycieczki');
  a.textContent = '🧭 Wycieczki';
  // Insert before VIP if present, else append
  const vip = Array.from(container.querySelectorAll('a')).find(x => (x.textContent||'').includes('VIP') || /vip\.html/i.test(x.getAttribute('href')||''));
  if (vip && vip.parentNode === container) {
    container.insertBefore(a, vip);
  } else {
    container.appendChild(a);
  }
}

// Mobile navigation moved to separate file: js/mobile-nav.js
