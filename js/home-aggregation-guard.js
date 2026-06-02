(function () {
  'use strict';

  const HIDDEN_SECTION_SELECTORS = [
    '.home-blog-section',
    '.home-shop-section',
    '[data-tour-target="shop-section"]',
    '#homeShopSection',
  ];

  const BLOCKED_SHORTCUT_SELECTORS = [
    '#openPackingFromAdventure',
    '#openTasksFromAdventure',
    '[data-tour-target="plan-card"]',
    '[data-tour-target="blog-card"]',
  ];

  const HE_ALLOWED_DESTINATIONS = [
    'transport.html',
    'hotels.html',
    'hotel.html',
    'recommendations.html',
    'car.html',
    'trips.html',
    'trip.html',
    'map.html',
  ];

  function normalizeLanguage(value) {
    const normalized = String(value || '').trim().toLowerCase().split('-')[0];
    return normalized || 'en';
  }

  function getCurrentLanguage() {
    return normalizeLanguage(
      window.appI18n?.language ||
      document.documentElement?.lang ||
      'en'
    );
  }

  function isHomePage() {
    const key = window.CELanguageRollout?.getHePageReadiness?.()?.key;
    if (key) {
      return key === 'home';
    }
    const pathname = String(window.location?.pathname || '/');
    return pathname === '/' || pathname.endsWith('/index.html');
  }

  function buildLocalizedUrl(target, language = getCurrentLanguage()) {
    if (window.CELanguage?.buildLocalizedUrl) {
      return window.CELanguage.buildLocalizedUrl(target, language);
    }

    try {
      const url = new URL(String(target || ''), window.location.origin);
      if (url.origin !== window.location.origin) {
        return String(target || '');
      }
      url.searchParams.set('lang', language === 'he' ? 'en' : language);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_error) {
      return String(target || '');
    }
  }

  function setElementHidden(element, hidden, reason) {
    if (!element) return;
    element.hidden = Boolean(hidden);
    if (hidden) {
      element.setAttribute('aria-hidden', 'true');
      element.dataset.heHomeHidden = reason || 'true';
    } else {
      element.removeAttribute('aria-hidden');
      delete element.dataset.heHomeHidden;
    }
  }

  function applyLocalizedLinks(language) {
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || /^(mailto|tel|sms|javascript|data|blob):/i.test(href)) {
        return;
      }
      const localized = buildLocalizedUrl(href, language);
      if (localized && localized !== href) {
        anchor.setAttribute('href', localized);
      }
    });

    document.querySelectorAll('[data-page-url]').forEach((element) => {
      const target = element.getAttribute('data-page-url');
      if (!target) return;
      const localized = buildLocalizedUrl(target, language);
      if (localized && localized !== target) {
        element.setAttribute('data-page-url', localized);
      }
    });
  }

  function markDestinationPolicy(language) {
    document.querySelectorAll('a[href]').forEach((anchor) => {
      let url = null;
      try {
        url = new URL(anchor.getAttribute('href') || '', window.location.origin);
      } catch (_error) {
        return;
      }
      if (url.origin !== window.location.origin) {
        return;
      }

      const allowedForHe = HE_ALLOWED_DESTINATIONS.some((path) => (
        url.pathname.endsWith(`/${path}`) || url.pathname === `/${path}`
      ));
      anchor.dataset.heHomeDestination = language === 'he'
        ? (allowedForHe ? 'he-allowed' : 'en-ltr')
        : 'normal';
    });
  }

  function applyHiddenSectionPolicy(language) {
    const isHebrewHome = language === 'he' && isHomePage();

    HIDDEN_SECTION_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        setElementHidden(element, isHebrewHome, 'blocked-section');
      });
    });

    BLOCKED_SHORTCUT_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        setElementHidden(element, isHebrewHome, 'blocked-shortcut');
      });
    });
  }

  function applyHomeAggregationPolicy(language = getCurrentLanguage()) {
    if (!isHomePage()) {
      return;
    }

    const normalized = normalizeLanguage(language);
    applyHiddenSectionPolicy(normalized);
    applyLocalizedLinks(normalized);
    markDestinationPolicy(normalized);
    document.documentElement.dataset.heHomeAggregation = normalized === 'he' ? 'prepared' : 'inactive';
  }

  let mutationScheduled = false;
  function scheduleApply() {
    if (mutationScheduled) return;
    mutationScheduled = true;
    window.requestAnimationFrame(() => {
      mutationScheduled = false;
      applyHomeAggregationPolicy();
    });
  }

  function init() {
    applyHomeAggregationPolicy();
    window.addEventListener('languageChanged', (event) => {
      applyHomeAggregationPolicy(event.detail?.language || getCurrentLanguage());
    });
    document.addEventListener('wakacjecypr:languagechange', (event) => {
      applyHomeAggregationPolicy(event.detail?.language || getCurrentLanguage());
    });

    if ('MutationObserver' in window) {
      const observer = new MutationObserver(scheduleApply);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'data-page-url'],
      });
    }
  }

  window.CE_HOME_HE_AGGREGATION = Object.assign(window.CE_HOME_HE_AGGREGATION || {}, {
    apply: applyHomeAggregationPolicy,
    buildLocalizedUrl,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
