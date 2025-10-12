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

  function normalizeText(value) {
    if (!value) {
      return '';
    }
    return value
      .toLocaleLowerCase('pl-PL')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  function getCouponQuery() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('coupon') || params.get('q') || '';
    return query.trim();
  }

  function syncCouponSearchInputs(query) {
    const inputs = document.querySelectorAll('[data-coupon-search-input]');
    inputs.forEach((input) => {
      if (input && input.value !== query) {
        input.value = query;
      }
    });
  }

  function updateCouponSearchMeta(query, results) {
    const meta = document.querySelector('[data-coupon-search-meta]');
    const queryLabel = document.querySelector('[data-coupon-query]');
    const resultsLabel = document.querySelector('[data-coupon-results]');
    const emptyState = document.querySelector('[data-coupon-empty]');

    if (meta) {
      meta.hidden = !query;
    }

    if (queryLabel) {
      queryLabel.textContent = query;
    }

    if (resultsLabel) {
      resultsLabel.textContent = results.toString();
    }

    if (emptyState) {
      emptyState.hidden = !(query && results === 0);
    }
  }

  function applyOfferSearchFilter() {
    const cards = document.querySelectorAll('[data-coupon-offer]');
    if (!cards.length) {
      return;
    }

    const query = getCouponQuery();
    const normalizedQuery = normalizeText(query);

    syncCouponSearchInputs(query);

    let matches = 0;

    cards.forEach((card) => {
      card.classList.remove('coupon-offer--highlight');
      card.hidden = false;

      if (!normalizedQuery) {
        return;
      }

      const datasetSource = card.getAttribute('data-partner') || '';
      const haystack = normalizeText(`${datasetSource} ${card.textContent}`);
      const isMatch = haystack.includes(normalizedQuery);

      card.hidden = !isMatch;

      if (isMatch) {
        matches += 1;
        card.classList.add('coupon-offer--highlight');
      }
    });

    if (!normalizedQuery) {
      updateCouponSearchMeta('', cards.length);
      return;
    }

    updateCouponSearchMeta(query, matches);
  }

  function setCouponQueryInUrl(query) {
    const params = new URLSearchParams(window.location.search);
    if (query) {
      params.set('coupon', query);
    } else {
      params.delete('coupon');
    }

    const nextQuery = params.toString();
    const newUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  function enhanceCouponSearchForm() {
    const forms = document.querySelectorAll('[data-coupon-search-form]');
    if (!forms.length) {
      return;
    }

    forms.forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = form.querySelector('[data-coupon-search-input]');
        const value = input ? input.value.trim() : '';
        setCouponQueryInUrl(value);
        applyOfferSearchFilter();
      });
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

  function init() {
    const button = document.querySelector('[data-coupon-cta]');
    if (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        goToStripe();
      });
    }

    renderPoints();
    enhanceCouponSearchForm();
    applyOfferSearchFilter();
  }

  document.addEventListener('wakacjecypr:languagechange', renderPoints);

  window.addEventListener('popstate', applyOfferSearchFilter);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
