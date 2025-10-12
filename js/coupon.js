(function () {
  'use strict';

  const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/fZu8wPgtR5jsbhN22d0VO0E';
  const FALLBACK_POINTS = {
    pl: [
      'Bez kaucji / jasne warunki',
      '24/7 wsparcie na miejscu',
      'Odbiór w głównych miastach',
      'Transparentna cena i zasady',
    ],
    en: [
      'No deposit / clear terms',
      '24/7 local support',
      'Pick-up in major cities',
      'Transparent pricing & rules',
    ],
    el: [
      'Χωρίς εγγύηση / καθαροί όροι',
      'Υποστήριξη 24/7',
      'Παραλαβή σε μεγάλες πόλεις',
      'Διαφανής τιμολόγηση & κανόνες',
    ],
  };

  let redirecting = false;

  function getLanguage() {
    const fromApp = window.appI18n?.language;
    if (fromApp) {
      return fromApp;
    }
    const params = new URLSearchParams(window.location.search);
    const paramLang = params.get('lang');
    if (paramLang) {
      return paramLang;
    }
    return document.documentElement.lang || 'pl';
  }

  function getTranslations(language) {
    const translations = window.appI18n?.translations || {};
    return translations[language] || {};
  }

  function resolvePoints(language) {
    const translations = getTranslations(language);
    const entry = translations['coupon.points'];
    if (Array.isArray(entry) && entry.length > 0) {
      return entry;
    }
    return FALLBACK_POINTS[language] || FALLBACK_POINTS.en;
  }

  function renderPoints() {
    const list = document.getElementById('couponPointsList');
    if (!list) {
      return;
    }

    const language = getLanguage();
    const points = resolvePoints(language);

    list.innerHTML = '';
    points.forEach((point) => {
      const item = document.createElement('li');
      item.textContent = point;
      list.appendChild(item);
    });
  }

  function safeTrack(language) {
    const tracker = window.track;
    if (typeof tracker !== 'function') {
      return;
    }
    try {
      const result = tracker('coupon_click_to_stripe', {
        lang: language,
        path: window.location.pathname,
      });
      if (result && typeof result.then === 'function') {
        result.catch(() => {});
      }
    } catch (error) {
      console.warn('Coupon analytics tracking failed.', error);
    }
  }

  function goToStripe() {
    if (redirecting) {
      return;
    }
    redirecting = true;

    const language = getLanguage();
    safeTrack(language);
    window.location.href = STRIPE_CHECKOUT_URL;
  }

  function handleTileKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar') {
      event.preventDefault();
      goToStripe();
    }
  }

  function init() {
    const tile = document.querySelector('[data-coupon-card]');
    if (!tile) {
      return;
    }

    tile.addEventListener('click', goToStripe);
    tile.addEventListener('keydown', handleTileKeyDown);
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');

    renderPoints();
  }

  document.addEventListener('wakacjecypr:languagechange', renderPoints);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
