/**
 * APP CORE V3 - Mapa używająca tylko danych z Supabase
 * Całkowicie przebudowana funkcjonalność dla mapy niezależna od panelu
 */

try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true') {
    console.log('🔵 App Core V3 - START');
  }
} catch (_) {}

(function() {
  'use strict';

  const CE_DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true';
  const ceLog = CE_DEBUG ? (...args) => console.log(...args) : () => {};
  const HOME_SCROLL_LOCK_CLASSES = [
    'modal-open',
    'u-lock-scroll',
    'is-modal-open',
    'tutorial-open',
    'language-selector-open',
    'scroll-locked',
  ];
  const HOME_SCROLL_LOCK_ATTRS = ['data-community-scroll-lock'];
  const HOME_OVERLAY_SELECTORS = [
    '#tripModal.active',
    '#hotelModal.active',
    '#detailModal',
    '#carHomeModal',
    '#commentsModal',
    '#photoLightbox',
    '#imgLightbox.active',
    '#auth-modal.is-open',
    '#sosModal.visible',
    '.language-mobile-overlay.is-visible',
    '.language-mobile-menu.is-visible',
    '.language-selector-overlay.is-visible',
    '.tutorial-overlay.is-visible',
    '.account-modal.visible',
    '#recMapModal',
  ];
  let homeScrollGuardAttached = false;

  const runWhenIdle = (fn, timeout = 2000) => {
    try {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          try { fn(); } catch (_) {}
        }, { timeout });
        return;
      }
    } catch (_) {}
    setTimeout(() => {
      try { fn(); } catch (_) {}
    }, 1);
  };

  function isElementActuallyVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden || el.hasAttribute('hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;

    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number.parseFloat(style.opacity || '1') <= 0) return false;

    return true;
  }

  function hasActiveBlockingOverlay() {
    for (let i = 0; i < HOME_OVERLAY_SELECTORS.length; i += 1) {
      const selector = HOME_OVERLAY_SELECTORS[i];
      const nodes = document.querySelectorAll(selector);
      for (let j = 0; j < nodes.length; j += 1) {
        const el = nodes[j];
        if (!isElementActuallyVisible(el)) continue;

        if (el.id === 'detailModal' || el.id === 'carHomeModal' || el.id === 'recMapModal') {
          const display = window.getComputedStyle(el).display;
          if (display === 'none') continue;
        }
        if (el.id === 'imgLightbox' && !el.classList.contains('active')) continue;
        if (el.id === 'sosModal' && !el.classList.contains('visible')) continue;
        return true;
      }
    }

    const genericDialogs = document.querySelectorAll('[aria-modal="true"], [role="dialog"]');
    for (let i = 0; i < genericDialogs.length; i += 1) {
      const el = genericDialogs[i];
      if (!isElementActuallyVisible(el)) continue;
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute') {
        return true;
      }
    }

    return false;
  }

  function hasBodyScrollLockState() {
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return false;

    if (HOME_SCROLL_LOCK_CLASSES.some((className) => body.classList.contains(className) || html.classList.contains(className))) {
      return true;
    }
    if (HOME_SCROLL_LOCK_ATTRS.some((attr) => body.hasAttribute(attr) || html.hasAttribute(attr))) {
      return true;
    }

    return (
      body.style.overflow === 'hidden' ||
      body.style.position === 'fixed' ||
      body.style.top !== '' ||
      body.style.left !== '' ||
      body.style.right !== '' ||
      body.style.width !== '' ||
      html.style.overflow === 'hidden'
    );
  }

  function clearOrphanedBodyScrollLock() {
    if ((document.body?.dataset?.seoPage || '') !== 'home') return;
    if (hasActiveBlockingOverlay()) return;
    if (!hasBodyScrollLockState()) return;

    const body = document.body;
    const html = document.documentElement;
    const scrollTopBeforeUnlock = window.scrollY || window.pageYOffset || 0;

    HOME_SCROLL_LOCK_CLASSES.forEach((className) => {
      body.classList.remove(className);
      html.classList.remove(className);
    });
    HOME_SCROLL_LOCK_ATTRS.forEach((attr) => {
      body.removeAttribute(attr);
      html.removeAttribute(attr);
    });

    body.style.overflow = '';
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    html.style.overflow = '';

    if (scrollTopBeforeUnlock > 0) {
      window.scrollTo(0, scrollTopBeforeUnlock);
    }
  }

  function initHomeScrollGuard() {
    if (homeScrollGuardAttached) return;
    if ((document.body?.dataset?.seoPage || '') !== 'home') return;

    homeScrollGuardAttached = true;
    const sync = () => {
      window.requestAnimationFrame(clearOrphanedBodyScrollLock);
    };

    window.addEventListener('pageshow', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sync();
    });
    document.addEventListener('pointerdown', sync, { passive: true });
    document.addEventListener('touchstart', sync, { passive: true });
    document.addEventListener('touchend', sync, { passive: true });

    sync();
    setTimeout(sync, 200);
    setTimeout(sync, 1200);
  }

  // Globalne zmienne mapy
  let mapInstance = null;
  let markersLayer = null;
  let userLocationMarker = null;
  let userLocationWatchId = null;
  let poisListenerAttached = false;
  let locationsListenerAttached = false;
  const MAP_MARKER_FILTERS = Object.freeze({
    ALL: 'all',
    POI: 'poi',
    RECOMMENDATIONS: 'recommendations',
  });
  const MAP_POI_CATEGORY_ALL = 'all';
  let mapMarkerFilter = MAP_MARKER_FILTERS.ALL;
  let mapPoiCategoryFilter = MAP_POI_CATEGORY_ALL;
  let mapMarkerFilterControl = null;
  let mapMarkerFilterContainer = null;
  let mapMarkerFilterButtons = new Map();
  let mapPoiCategoryFilterButtons = new Map();
  let mapMarkerFilterCounter = null;
  let mapFilterListenersAttached = false;
  let mapVisiblePoiIds = null;
  let mapVisibleItems = null;
  let lastVisiblePoiIdsSignature = '';
  let mapLocationPrompt = null;
  let mapLocationPromptState = 'prompt';
  let mapLocationPromptListenersAttached = false;
  const poiMarkerIconCache = new Map();
  
  function getPlacesDataNow() {
    if (window.PLACES_DATA && Array.isArray(window.PLACES_DATA)) {
      return window.PLACES_DATA;
    }
    return [];
  }

  function getUiTranslation(key, fallback = '') {
    const translationsRoot = window.appI18n && window.appI18n.translations
      ? window.appI18n.translations
      : null;

    if (!translationsRoot || typeof translationsRoot !== 'object') {
      return fallback;
    }

    const resolveFromScope = (scope, translationKey) => {
      if (!scope || typeof scope !== 'object') return null;

      if (Object.prototype.hasOwnProperty.call(scope, translationKey) && typeof scope[translationKey] === 'string') {
        return scope[translationKey];
      }

      if (translationKey.indexOf('.') === -1) return null;

      const parts = translationKey.split('.');
      let current = scope;
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
          current = current[part];
        } else {
          return null;
        }
      }

      return typeof current === 'string' ? current : null;
    };

    const activeLangRaw = String(
      (window.appI18n && window.appI18n.language)
      || document.documentElement?.lang
      || 'pl'
    ).toLowerCase();
    const activeLang = activeLangRaw.split('-')[0] || activeLangRaw;
    const activeScope = translationsRoot[activeLang] || translationsRoot[activeLangRaw] || null;

    const activeValue = resolveFromScope(activeScope, key);
    if (typeof activeValue === 'string') {
      return activeValue;
    }

    const rootValue = resolveFromScope(translationsRoot, key);
    if (typeof rootValue === 'string') {
      return rootValue;
    }

    return fallback;
  }

  function getUiLanguageCode() {
    const raw = String(
      (window.appI18n && window.appI18n.language) ||
      document.documentElement?.lang ||
      'pl'
    ).toLowerCase();
    const short = raw.split('-')[0] || raw;
    return short === 'en' ? 'en' : 'pl';
  }

  function getLocationPromptCopy(state = 'prompt') {
    const isEn = getUiLanguageCode() === 'en';
    const copy = {
      pl: {
        title: 'Udostępnij lokalizację',
        prompt: 'Włącz lokalizację, aby mapa mogła pokazać Twoją pozycję i prowadzić dokładniej.',
        denied: 'Dostęp do lokalizacji jest zablokowany. Odblokuj go w ustawieniach przeglądarki, aby włączyć pełną funkcjonalność mapy.',
        unsupported: 'Ta przeglądarka nie obsługuje geolokalizacji, więc nie możemy pokazać Twojej pozycji na mapie.',
        action: 'Włącz lokalizację',
      },
      en: {
        title: 'Share your location',
        prompt: 'Enable location so the map can show your live position and provide full map functionality.',
        denied: 'Location access is blocked. Enable it in browser settings to restore full map functionality.',
        unsupported: 'This browser does not support geolocation, so we cannot show your position on the map.',
        action: 'Enable location',
      },
    };

    const selected = isEn ? copy.en : copy.pl;
    return {
      title: selected.title,
      description:
        state === 'unsupported'
          ? selected.unsupported
          : state === 'denied'
          ? selected.denied
          : selected.prompt,
      action: selected.action,
    };
  }

  function ensureMapLocationPrompt() {
    if (mapLocationPrompt) {
      return mapLocationPrompt;
    }

    const mapPanel = document.getElementById('current-objective');
    if (!mapPanel) {
      return null;
    }

    const container = document.createElement('div');
    container.className = 'map-location-prompt';
    container.hidden = true;
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');

    const title = document.createElement('h3');
    title.className = 'map-location-prompt__title';

    const description = document.createElement('p');
    description.className = 'map-location-prompt__description';

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn primary map-location-prompt__action';
    action.addEventListener('click', () => {
      initializeUserLocation({ requestPermission: true });
    });

    container.appendChild(title);
    container.appendChild(description);
    container.appendChild(action);
    mapPanel.appendChild(container);

    mapLocationPrompt = { container, title, description, action };
    return mapLocationPrompt;
  }

  function updateMapLocationPrompt(state = 'prompt') {
    const prompt = ensureMapLocationPrompt();
    if (!prompt) {
      return;
    }
    mapLocationPromptState = state;
    const copy = getLocationPromptCopy(state);
    prompt.title.textContent = copy.title;
    prompt.description.textContent = copy.description;
    prompt.action.textContent = copy.action;
    prompt.action.disabled = state === 'unsupported';
  }

  function showMapLocationPrompt(state = 'prompt') {
    const prompt = ensureMapLocationPrompt();
    if (!prompt) {
      return;
    }
    updateMapLocationPrompt(state);
    prompt.container.hidden = false;
  }

  function hideMapLocationPrompt() {
    if (!mapLocationPrompt || !mapLocationPrompt.container) {
      return;
    }
    mapLocationPrompt.container.hidden = true;
  }

  function attachMapLocationPromptListeners() {
    if (mapLocationPromptListenersAttached) {
      return;
    }
    mapLocationPromptListenersAttached = true;
    const rerender = () => {
      if (mapLocationPrompt && mapLocationPrompt.container && !mapLocationPrompt.container.hidden) {
        updateMapLocationPrompt(mapLocationPromptState);
      }
    };
    window.addEventListener('languageChanged', rerender);
    document.addEventListener('wakacjecypr:languagechange', rerender);
  }

  function interpolateTemplate(template, values = {}) {
    return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, token) => {
      if (Object.prototype.hasOwnProperty.call(values, token)) {
        return String(values[token]);
      }
      return match;
    });
  }

  function getPoiCoordinates(poi) {
    if (!poi || typeof poi !== 'object') {
      return null;
    }

    const lat = (typeof poi.lat === 'number') ? poi.lat
      : (typeof poi.latitude === 'number') ? poi.latitude
      : Number.parseFloat(poi.lat ?? poi.latitude);

    const lng = (typeof poi.lng === 'number') ? poi.lng
      : (typeof poi.lon === 'number') ? poi.lon
      : (typeof poi.longitude === 'number') ? poi.longitude
      : Number.parseFloat(poi.lng ?? poi.lon ?? poi.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      return null;
    }

    return { lat, lng };
  }

  function getPoiMarkerEmoji(poi) {
    const raw = String(
      poi?.category_icon
      || poi?.icon
      || '📍'
    ).trim();
    const glyph = Array.from(raw).slice(0, 2).join('');
    return glyph || '📍';
  }

  function normalizePoiCategorySlug(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || 'uncategorized';
  }

  function getPoiCategoryLookupMaps() {
    const categories = Array.isArray(window.POI_CATEGORIES_DATA) ? window.POI_CATEGORIES_DATA : [];
    const bySlug = new Map();
    const byId = new Map();

    categories.forEach((category) => {
      if (!category || typeof category !== 'object') return;
      const slug = normalizePoiCategorySlug(category.slug || category.name_en || category.name_pl || 'uncategorized');
      bySlug.set(slug, category);
      const id = String(category.id || '').trim();
      if (id) byId.set(id, category);
    });

    return { bySlug, byId };
  }

  function resolvePoiCategoryMeta(poi) {
    if (!poi || typeof poi !== 'object') {
      return {
        slug: 'uncategorized',
        icon: '📍',
        color: '#1f6feb',
        name: getUiLanguageCode() === 'en' ? 'Uncategorized' : 'Bez kategorii',
      };
    }

    const { bySlug, byId } = getPoiCategoryLookupMaps();
    const fallbackSlug = normalizePoiCategorySlug(poi.category || 'uncategorized');
    const categoryId = String(poi.category_id || '').trim();
    const category = byId.get(categoryId) || bySlug.get(fallbackSlug) || null;
    const lang = getUiLanguageCode();
    const slug = normalizePoiCategorySlug(category?.slug || fallbackSlug);
    const icon = String(category?.icon || poi.category_icon || '📍').trim() || '📍';
    const color = String(category?.color || poi.category_color || '#1f6feb').trim() || '#1f6feb';
    const namePl = String(category?.name_pl || '').trim();
    const nameEn = String(category?.name_en || '').trim();
    const name = (lang === 'en' ? nameEn || namePl : namePl || nameEn || slug) || slug;

    return { slug, icon, color, name };
  }

  function getPoiCategoryLabel(slug) {
    if (slug === MAP_POI_CATEGORY_ALL) {
      return getUiLanguageCode() === 'en' ? 'All categories' : 'Wszystkie kategorie';
    }
    const { bySlug } = getPoiCategoryLookupMaps();
    const category = bySlug.get(normalizePoiCategorySlug(slug));
    if (!category) return slug;
    const namePl = String(category.name_pl || '').trim();
    const nameEn = String(category.name_en || '').trim();
    return getUiLanguageCode() === 'en' ? (nameEn || namePl || slug) : (namePl || nameEn || slug);
  }

  function poiMatchesCategoryFilter(poi) {
    if (mapPoiCategoryFilter === MAP_POI_CATEGORY_ALL) {
      return true;
    }
    const meta = resolvePoiCategoryMeta(poi);
    return meta.slug === mapPoiCategoryFilter;
  }

  function getPoiCategoryFilterOptions() {
    const places = getPlacesDataNow();
    const counters = new Map();

    places.forEach((poi) => {
      if (!getPoiCoordinates(poi)) return;
      const meta = resolvePoiCategoryMeta(poi);
      const current = counters.get(meta.slug);
      if (current) {
        current.count += 1;
        return;
      }
      counters.set(meta.slug, {
        value: meta.slug,
        label: meta.name,
        icon: meta.icon,
        color: meta.color,
        count: 1,
      });
    });

    const options = Array.from(counters.values())
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), getUiLanguageCode()));

    options.unshift({
      value: MAP_POI_CATEGORY_ALL,
      label: getUiLanguageCode() === 'en' ? 'All categories' : 'Wszystkie kategorie',
      icon: '🧭',
      color: '#1f6feb',
      count: places.filter((poi) => !!getPoiCoordinates(poi)).length,
    });

    return options;
  }

  function ensureValidPoiCategoryFilter() {
    if (mapPoiCategoryFilter === MAP_POI_CATEGORY_ALL) return false;
    const options = getPoiCategoryFilterOptions();
    const exists = options.some((option) => option.value === mapPoiCategoryFilter);
    if (exists) return false;
    mapPoiCategoryFilter = MAP_POI_CATEGORY_ALL;
    return true;
  }

  function getPoiMarkerIcon(poi) {
    if (typeof L === 'undefined' || typeof L.divIcon !== 'function') {
      return null;
    }

    const emoji = getPoiMarkerEmoji(poi);
    if (poiMarkerIconCache.has(emoji)) {
      return poiMarkerIconCache.get(emoji);
    }

    const icon = L.divIcon({
      className: 'ce-poi-marker ce-poi-marker--emoji',
      html: `<span class="ce-poi-marker__emoji" aria-hidden="true">${emoji}</span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -14],
    });

    poiMarkerIconCache.set(emoji, icon);
    return icon;
  }

  function getMapCardBottomPadding(extra = 24) {
    const cardEl = document.getElementById('currentPlaceSection');
    const cardHeight = cardEl ? Math.round(cardEl.getBoundingClientRect().height) : 0;
    const isMobile = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 768px)').matches;

    if (isMobile) {
      return Math.max(120, Math.min(420, cardHeight + extra));
    }
    return Math.max(80, Math.min(260, Math.round(cardHeight * 0.62) + extra));
  }

  function getMapPopupOptions(maxWidth = 270, extra = {}) {
    const bottomPadding = getMapCardBottomPadding();
    return {
      maxWidth,
      keepInView: true,
      autoPan: true,
      autoPanPaddingTopLeft: [16, 16],
      autoPanPaddingBottomRight: [16, bottomPadding],
      ...extra,
    };
  }

  function countValidPoiMarkers() {
    const places = getPlacesDataNow();
    let count = 0;

    places.forEach((poi) => {
      if (getPoiCoordinates(poi)) {
        count += 1;
      }
    });

    return count;
  }

  function getVisiblePoiIdsForCurrentFilter() {
    if (!shouldShowPoiMarkers()) {
      return [];
    }

    const places = getPlacesDataNow();
    const visibleIds = [];

    places.forEach((poi) => {
      if (!poi || !poi.id) {
        return;
      }
      if (!getPoiCoordinates(poi)) {
        return;
      }
      if (!poiMatchesCategoryFilter(poi)) {
        return;
      }
      visibleIds.push(String(poi.id));
    });

    return visibleIds;
  }

  function getVisibleRecommendationIdsForCurrentFilter() {
    if (!shouldShowRecommendationMarkers()) {
      return [];
    }

    if (typeof window.getVisibleRecommendationIdsForMap === 'function') {
      const ids = window.getVisibleRecommendationIdsForMap(mapInstance);
      if (Array.isArray(ids)) {
        return ids.map((id) => String(id)).filter(Boolean);
      }
    }

    return [];
  }

  function getVisibleMapItemsForCurrentFilter() {
    const items = [];
    const poiIds = getVisiblePoiIdsForCurrentFilter();
    const recommendationIds = getVisibleRecommendationIdsForCurrentFilter();

    poiIds.forEach((id) => {
      items.push({ type: 'poi', id });
    });
    recommendationIds.forEach((id) => {
      items.push({ type: 'recommendation', id });
    });

    return items;
  }

  function dispatchVisiblePoiIdsChanged(force = false) {
    const nextVisibleIds = getVisiblePoiIdsForCurrentFilter();
    const nextRecommendationIds = getVisibleRecommendationIdsForCurrentFilter();
    const nextVisibleItems = getVisibleMapItemsForCurrentFilter();
    mapVisiblePoiIds = nextVisibleIds;
    mapVisibleItems = nextVisibleItems;
    const nextSignature = `${mapMarkerFilter}|poi:${nextVisibleIds.join(',')}|rec:${nextRecommendationIds.join(',')}`;

    if (!force && nextSignature === lastVisiblePoiIdsSignature) {
      return;
    }
    lastVisiblePoiIdsSignature = nextSignature;

    try {
      window.dispatchEvent(new CustomEvent('mapVisiblePoiIdsChanged', {
        detail: {
          filter: mapMarkerFilter,
          poiCategoryFilter: mapPoiCategoryFilter,
          poiCategoryLabel: getPoiCategoryLabel(mapPoiCategoryFilter),
          poiIds: [...nextVisibleIds],
        },
      }));
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent('mapVisibleItemsChanged', {
        detail: {
          filter: mapMarkerFilter,
          poiCategoryFilter: mapPoiCategoryFilter,
          poiCategoryLabel: getPoiCategoryLabel(mapPoiCategoryFilter),
          poiIds: [...nextVisibleIds],
          recommendationIds: [...nextRecommendationIds],
          items: nextVisibleItems.map((item) => ({ ...item })),
        },
      }));
    } catch (_) {}
  }

  function isValidMapMarkerFilter(value) {
    return (
      value === MAP_MARKER_FILTERS.ALL
      || value === MAP_MARKER_FILTERS.POI
      || value === MAP_MARKER_FILTERS.RECOMMENDATIONS
    );
  }

  function shouldShowPoiMarkers() {
    return mapMarkerFilter !== MAP_MARKER_FILTERS.RECOMMENDATIONS;
  }

  function shouldShowRecommendationMarkers() {
    return mapMarkerFilter !== MAP_MARKER_FILTERS.POI;
  }

  function getMapMarkerFilterOptions() {
    return [
      {
        value: MAP_MARKER_FILTERS.ALL,
        label: getUiTranslation('map.filter.all', 'All'),
      },
      {
        value: MAP_MARKER_FILTERS.POI,
        label: getUiTranslation('map.filter.poiOnly', 'Visit points'),
      },
      {
        value: MAP_MARKER_FILTERS.RECOMMENDATIONS,
        label: getUiTranslation('map.filter.recommendationsOnly', 'Recommended places'),
      },
    ];
  }

  function getRecommendationMarkersStats() {
    if (typeof window.getRecommendationMarkersStats === 'function') {
      const raw = window.getRecommendationMarkersStats(mapInstance) || {};
      return {
        total: Number.isFinite(raw.total) ? raw.total : 0,
        visible: Number.isFinite(raw.visible) ? raw.visible : 0,
      };
    }

    return { total: 0, visible: 0 };
  }

  function updateMapMarkerFilterCounter() {
    if (!mapMarkerFilterCounter) {
      return;
    }

    const poiTotal = countValidPoiMarkers();
    const poiVisible = shouldShowPoiMarkers() ? poiTotal : 0;
    const recommendationStats = getRecommendationMarkersStats();
    const recommendationTotal = recommendationStats.total;
    const recommendationVisible = shouldShowRecommendationMarkers()
      ? recommendationStats.visible
      : 0;

    const visibleCount = poiVisible + recommendationVisible;
    const totalCount = poiTotal + recommendationTotal;

    const summaryTemplate = getUiTranslation(
      'map.filter.counter',
      'Showing {{visible}} of {{total}} points'
    );
    const summaryText = interpolateTemplate(summaryTemplate, {
      visible: visibleCount,
      total: totalCount,
    });

    const detailsTemplate = getUiTranslation(
      'map.filter.counterBreakdown',
      'Visit points {{poiVisible}}/{{poiTotal}} • Recommended {{recommendationsVisible}}/{{recommendationsTotal}}'
    );
    const detailsText = interpolateTemplate(detailsTemplate, {
      poiVisible,
      poiTotal,
      recommendationsVisible: recommendationVisible,
      recommendationsTotal: recommendationTotal,
    });

    mapMarkerFilterCounter.textContent = summaryText;
    mapMarkerFilterCounter.title = detailsText;
    mapMarkerFilterCounter.setAttribute('aria-label', detailsText);
  }

  function renderMapMarkerFilterControl() {
    if (!mapMarkerFilterContainer) {
      return;
    }

    mapMarkerFilterContainer.innerHTML = '';
    mapMarkerFilterContainer.setAttribute('aria-label', getUiTranslation('map.filter.aria', 'Map filters'));
    mapMarkerFilterButtons = new Map();
    mapPoiCategoryFilterButtons = new Map();

    const buttonsWrap = document.createElement('div');
    buttonsWrap.className = 'map-filter-control';

    getMapMarkerFilterOptions().forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-filter-btn';
      button.dataset.filter = option.value;
      button.textContent = option.label;
      button.setAttribute('aria-pressed', option.value === mapMarkerFilter ? 'true' : 'false');
      if (option.value === mapMarkerFilter) {
        button.classList.add('is-active');
      }
      button.addEventListener('click', () => {
        setMapMarkerFilter(option.value);
      });
      mapMarkerFilterButtons.set(option.value, button);
      buttonsWrap.appendChild(button);
    });

    mapMarkerFilterContainer.appendChild(buttonsWrap);

    const poiCategoryWrap = document.createElement('div');
    poiCategoryWrap.className = 'map-poi-category-filter';
    if (mapMarkerFilter === MAP_MARKER_FILTERS.RECOMMENDATIONS) {
      poiCategoryWrap.classList.add('is-disabled');
    }

    const poiCategoryOptions = getPoiCategoryFilterOptions();
    poiCategoryOptions.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-poi-category-btn';
      button.dataset.category = option.value;
      if (option.value === mapPoiCategoryFilter) {
        button.classList.add('is-active');
      }
      button.setAttribute('aria-pressed', option.value === mapPoiCategoryFilter ? 'true' : 'false');
      button.title = `${option.label} (${option.count})`;
      const icon = document.createElement('span');
      icon.className = 'map-poi-category-btn__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = String(option.icon || '📍');

      const label = document.createElement('span');
      label.className = 'map-poi-category-btn__label';
      label.textContent = String(option.label || '');

      const count = document.createElement('span');
      count.className = 'map-poi-category-btn__count';
      count.textContent = String(Number(option.count) || 0);

      button.appendChild(icon);
      button.appendChild(label);
      button.appendChild(count);
      button.addEventListener('click', () => {
        setMapPoiCategoryFilter(option.value);
      });
      mapPoiCategoryFilterButtons.set(option.value, button);
      poiCategoryWrap.appendChild(button);
    });

    mapMarkerFilterContainer.appendChild(poiCategoryWrap);
    mapMarkerFilterCounter = null;
    updateMapMarkerFilterCounter();
  }

  function setupMapMarkerFilterControl() {
    if (!mapInstance) {
      return;
    }

    const inlineHost = document.getElementById('mapFilterInline');
    if (inlineHost) {
      inlineHost.classList.add('map-filter-panel');
      mapMarkerFilterContainer = inlineHost;
      renderMapMarkerFilterControl();
      return;
    }

    if (typeof L === 'undefined' || mapMarkerFilterControl) {
      return;
    }

    mapMarkerFilterControl = L.control({ position: 'topright' });
    mapMarkerFilterControl.onAdd = () => {
      const container = L.DomUtil.create('div', 'map-filter-panel leaflet-control');
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      mapMarkerFilterContainer = container;
      renderMapMarkerFilterControl();
      return container;
    };
    mapMarkerFilterControl.addTo(mapInstance);
  }

  function updateMapMarkerFilterControlState() {
    if (!mapMarkerFilterButtons || mapMarkerFilterButtons.size === 0) {
      return;
    }

    mapMarkerFilterButtons.forEach((button, value) => {
      const active = value === mapMarkerFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (mapPoiCategoryFilterButtons && mapPoiCategoryFilterButtons.size > 0) {
      mapPoiCategoryFilterButtons.forEach((button, value) => {
        const active = value === mapPoiCategoryFilter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    if (mapMarkerFilterContainer) {
      const categoryWrap = mapMarkerFilterContainer.querySelector('.map-poi-category-filter');
      if (categoryWrap) {
        categoryWrap.classList.toggle('is-disabled', mapMarkerFilter === MAP_MARKER_FILTERS.RECOMMENDATIONS);
      }
    }
  }

  function applyMapMarkerFilter(options = {}) {
    const rerenderPoiMarkers = options.rerenderPoiMarkers !== false;
    const refreshRecommendationVisibility = options.refreshRecommendationVisibility !== false;
    const didResetCategory = ensureValidPoiCategoryFilter();

    if (!mapInstance) {
      return;
    }

    if (didResetCategory) {
      renderMapMarkerFilterControl();
    }

    if (rerenderPoiMarkers) {
      addMarkers();
    }

    if (refreshRecommendationVisibility && typeof window.setRecommendationMarkersVisibility === 'function') {
      window.setRecommendationMarkersVisibility(mapInstance, shouldShowRecommendationMarkers());
    }

    updateMapMarkerFilterControlState();
    updateMapMarkerFilterCounter();
    dispatchVisiblePoiIdsChanged();
  }

  function setMapMarkerFilter(nextFilter) {
    if (!isValidMapMarkerFilter(nextFilter) || nextFilter === mapMarkerFilter) {
      return;
    }

    mapMarkerFilter = nextFilter;
    applyMapMarkerFilter();
  }

  function setMapPoiCategoryFilter(nextCategory) {
    const normalizedCategory = normalizePoiCategorySlug(nextCategory);
    const targetCategory = normalizedCategory === MAP_POI_CATEGORY_ALL ? MAP_POI_CATEGORY_ALL : normalizedCategory;
    if (targetCategory === mapPoiCategoryFilter) {
      return;
    }
    mapPoiCategoryFilter = targetCategory;
    applyMapMarkerFilter();
  }

  function attachMapFilterListeners() {
    if (mapFilterListenersAttached) {
      return;
    }

    mapFilterListenersAttached = true;
    const rerenderMapFilterForLanguage = () => {
      renderMapMarkerFilterControl();
      applyMapMarkerFilter({
        rerenderPoiMarkers: false,
        refreshRecommendationVisibility: false,
      });
    };
    window.addEventListener('mapRecommendationMarkersUpdated', () => {
      updateMapMarkerFilterCounter();
      dispatchVisiblePoiIdsChanged(true);
    });
    // Support both legacy and current i18n events.
    window.addEventListener('languageChanged', rerenderMapFilterForLanguage);
    document.addEventListener('wakacjecypr:languagechange', rerenderMapFilterForLanguage);
    window.addEventListener('poisDataRefreshed', () => {
      ensureValidPoiCategoryFilter();
      renderMapMarkerFilterControl();
      dispatchVisiblePoiIdsChanged(true);
    });
  }

  async function initializeUserLocation({ requestPermission = false } = {}) {
    ceLog('📍 initializeUserLocation() wywołane');
    if (!mapInstance) {
      ceLog('📍 Brak mapInstance - pomijam lokalizację użytkownika');
      return;
    }
    if (!navigator.geolocation) {
      ceLog('📍 Brak geolocation API');
      showMapLocationPrompt('unsupported');
      return;
    }

    let permissionState = null;
    const hasPermissionsApi = !!(navigator.permissions && typeof navigator.permissions.query === 'function');
    if (!requestPermission && !hasPermissionsApi) {
      showMapLocationPrompt('prompt');
      return;
    }
    try {
      if (hasPermissionsApi) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        permissionState = permission?.state || null;
        if (!requestPermission && permissionState !== 'granted') {
          ceLog('📍 Geolocation permission is not granted yet - showing prompt');
          showMapLocationPrompt(permissionState === 'denied' ? 'denied' : 'prompt');
          return;
        }
      }
    } catch (_) {}
    
    let hasCenteredOnUser = false;
    const USER_MARKER_Z_INDEX = 16000;
    
    // Użyj niebieskiej kropki zamiast avatara (bardziej widoczna)
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `<div class="user-dot">
        <div class="user-dot-pulse"></div>
        <div class="user-dot-core"></div>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const toRadians = (value) => (Number(value) * Math.PI) / 180;
    const metersBetween = (lat1, lng1, lat2, lng2) => {
      const earthRadius = 6371000;
      const dLat = toRadians(lat2 - lat1);
      const dLng = toRadians(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    const getSafeUserMarkerLatLng = (lat, lng) => {
      const candidates = [];
      const places = getPlacesDataNow();
      if (Array.isArray(places)) {
        for (let i = 0; i < places.length; i += 1) {
          const coordinates = getPoiCoordinates(places[i]);
          if (!coordinates) continue;
          candidates.push(coordinates);
        }
      }

      if (typeof window.getMapRecommendationsData === 'function') {
        const recommendations = window.getMapRecommendationsData();
        if (Array.isArray(recommendations)) {
          for (let i = 0; i < recommendations.length; i += 1) {
            const rec = recommendations[i];
            const recLat = Number(rec?.latitude);
            const recLng = Number(rec?.longitude);
            if (!Number.isFinite(recLat) || !Number.isFinite(recLng)) continue;
            candidates.push({ lat: recLat, lng: recLng });
          }
        }
      }

      if (candidates.length === 0) {
        return [lat, lng];
      }

      let nearest = null;
      let nearestMeters = Infinity;
      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const distance = metersBetween(lat, lng, candidate.lat, candidate.lng);
        if (distance < nearestMeters) {
          nearestMeters = distance;
          nearest = candidate;
        }
      }

      const minClearDistance = 24;
      if (!nearest || nearestMeters > minClearDistance) {
        return [lat, lng];
      }

      const metersPerLat = 111320;
      const metersPerLng = metersPerLat * Math.max(Math.cos(toRadians(lat)), 0.25);
      const dx = (lng - nearest.lng) * metersPerLng;
      const dy = (lat - nearest.lat) * metersPerLat;
      const angle = (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001)
        ? (Math.PI / 4)
        : Math.atan2(dy, dx);

      const offsetMeters = Math.max(12, Math.min(42, (minClearDistance - nearestMeters) + 12));
      const latOffset = (offsetMeters * Math.sin(angle)) / metersPerLat;
      const lngOffset = (offsetMeters * Math.cos(angle)) / metersPerLng;
      return [lat + latOffset, lng + lngOffset];
    };
    
    const updatePosition = (lat, lng, accuracy) => {
      ceLog('📍 Aktualizacja pozycji:', lat, lng, '(dokładność:', accuracy, 'm)');
      window.currentUserLocation = { lat, lng, accuracy, timestamp: Date.now() };
      const latLng = getSafeUserMarkerLatLng(lat, lng);
      
      if (!userLocationMarker) {
        ceLog('📍 Tworzę marker użytkownika');
        userLocationMarker = L.marker(latLng, { 
          icon: userIcon, 
          zIndexOffset: USER_MARKER_Z_INDEX,
          interactive: false,
          keyboard: false,
        }).addTo(mapInstance);
      } else {
        userLocationMarker.setLatLng(latLng);
        userLocationMarker.setZIndexOffset(USER_MARKER_Z_INDEX);
      }

      hideMapLocationPrompt();
      
      if (!hasCenteredOnUser) {
        hasCenteredOnUser = true;
        // Nie centruj na użytkowniku automatycznie - niech widzi całą mapę
        // mapInstance.setView(latLng, 13, { animate: true });
      }
    };
    
    ceLog('📍 Pobieram lokalizację (niska dokładność najpierw)...');
    
    // STRATEGIA: Najpierw szybka, niska dokładność, potem tracking z wysoką
    navigator.geolocation.getCurrentPosition(
      (position) => {
        ceLog('📍 Szybka lokalizacja OK');
        updatePosition(
          position.coords.latitude, 
          position.coords.longitude,
          position.coords.accuracy
        );
        
        // Teraz włącz tracking z wysoką dokładnością
        startHighAccuracyTracking(updatePosition);
      },
      (error) => {
        ceLog('📍 Szybka lokalizacja failed:', error?.message || 'unknown');
        if (Number(error?.code) === 1 || permissionState === 'denied') {
          showMapLocationPrompt('denied');
          return;
        }
        // Spróbuj od razu z wysoką dokładnością
        startHighAccuracyTracking(updatePosition);
      },
      { enableHighAccuracy: false, maximumAge: 120000, timeout: 15000 }
    );
  }
  
  function startHighAccuracyTracking(updatePosition) {
    if (userLocationWatchId !== null) return;
    
    ceLog('📍 Uruchamiam tracking wysokiej dokładności...');
    userLocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        updatePosition(
          position.coords.latitude, 
          position.coords.longitude,
          position.coords.accuracy
        );
      },
      (error) => {
        // Cichy błąd - nie spamuj konsoli przy każdym timeout
        if (error.code !== 3) { // 3 = TIMEOUT
          ceLog('📍 Tracking error:', error?.message || 'unknown');
        }
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 }
    );
    ceLog('📍 Tracking watchId:', userLocationWatchId);
  }
  
  // Funkcja komentarzy została usunięta - komentarze dostępne tylko w panelu pod mapą
  
  /**
   * Inicjalizuje mapę
   */
  async function initializeMap() {
    ceLog('🗺️ Inicjalizuję mapę...');
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      ceLog('ℹ️ Brak elementu #map na tej stronie');
      return;
    }
    
    // Sprawdź Leaflet
    if (typeof L === 'undefined') {
      console.error('❌ Leaflet nie załadowany!');
      return;
    }
    
    // Stwórz mapę jeśli nie istnieje
    if (!mapInstance) {
      ceLog('🗺️ Tworzę instancję mapy...');
      
      // Sprawdź czy element mapy nie jest już zainicjalizowany
      if (mapElement._leaflet_id) {
        ceLog('⚠️ Mapa już istnieje - używam istniejącej instancji');
        mapInstance = mapElement._leaflet_map || mapElement._leaflet;
        if (!mapInstance) {
          console.error('❌ Nie mogę odnaleźć instancji mapy!');
          return;
        }
      } else {
        mapInstance = L.map('map');
      }
      
      // Dodaj kafelki
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapInstance);

      // Initial view: show whole Cyprus outline (desktop + mobile)
      try {
        const cyprusBounds = L.latLngBounds(
          L.latLng(34.35, 32.20),
          L.latLng(35.75, 34.60)
        );

        const fitCyprus = (useMobilePadding = false) => {
          if (!useMobilePadding) {
            mapInstance.fitBounds(cyprusBounds, { padding: [18, 18] });
            return;
          }

          const cardEl = document.getElementById('currentPlaceSection');
          const cardH = cardEl ? cardEl.getBoundingClientRect().height : 0;
          const bottomPad = Math.max(90, Math.min(260, Math.round(cardH * 0.55)));
          mapInstance.fitBounds(cyprusBounds, {
            paddingTopLeft: [18, 18],
            paddingBottomRight: [18, bottomPad],
          });
        };

        fitCyprus(false);

        const isMobile = typeof window !== 'undefined'
          && typeof window.matchMedia === 'function'
          && window.matchMedia('(max-width: 768px)').matches;

        if (isMobile) {
          const refit = () => {
            try { mapInstance.invalidateSize(); } catch (_) {}
            try { fitCyprus(true); } catch (_) {}
          };

          try {
            if (typeof window.requestAnimationFrame === 'function') {
              window.requestAnimationFrame(() => {
                window.requestAnimationFrame(refit);
              });
            }
          } catch (_) {}

          setTimeout(refit, 450);
          setTimeout(refit, 900);
        }
      } catch (_) {
        try {
          mapInstance.setView([35.095, 33.203], 9);
        } catch (_) {}
      }
      
      // Stwórz warstwę dla markerów
      markersLayer = L.layerGroup().addTo(mapInstance);
      
      ceLog('✅ Mapa utworzona');
    }

    setupMapMarkerFilterControl();
    attachMapFilterListeners();
    attachMapLocationPromptListeners();

    if (!mapInstance._cePopupPanInsideBound) {
      mapInstance._cePopupPanInsideBound = true;
      mapInstance.on('popupopen', (event) => {
        try {
          const popup = event?.popup;
          if (!popup || typeof popup.getLatLng !== 'function') {
            return;
          }
          mapInstance.panInside(popup.getLatLng(), {
            paddingTopLeft: [16, 16],
            paddingBottomRight: [16, getMapCardBottomPadding(28)],
          });
        } catch (_) {}
      });
    }

    if (!poisListenerAttached) {
      poisListenerAttached = true;
      ceLog('📡 Dodaję listener dla poisDataRefreshed');
      window.addEventListener('poisDataRefreshed', (event) => {
        ceLog('🔔 Otrzymano event poisDataRefreshed:', event.detail);
        addMarkers();
      });
    }

    // Dodaj markery jeśli dane już są (np. z cache w poi-loader)
    applyMapMarkerFilter();

    // Lokalizacja użytkownika - odłóż na idle (nieblokujące)
    runWhenIdle(() => initializeUserLocation());
    
    // Initialize recommendation markers (green)
    if (typeof window.initMapRecommendations === 'function') {
      runWhenIdle(() => {
        const recommendationInit = window.initMapRecommendations(mapInstance);
        if (recommendationInit && typeof recommendationInit.then === 'function') {
          recommendationInit
            .then(() => {
              applyMapMarkerFilter();
            })
            .catch((error) => {
              console.warn('[app-core] Recommendation markers init failed:', error);
              updateMapMarkerFilterCounter();
            });
        } else {
          applyMapMarkerFilter();
        }
      });
    }

    ceLog('✅ Mapa zainicjalizowana');
  }
  
  /**
   * Dodaje markery na mapę - TYLKO dane z Supabase
   */
  function addMarkers() {
    ceLog('📍 Dodaję markery z Supabase...');
    ceLog('   - mapInstance:', mapInstance ? 'OK' : 'NULL');
    ceLog('   - markersLayer:', markersLayer ? 'OK' : 'NULL');
    ceLog('   - PLACES_DATA:', window.PLACES_DATA ? window.PLACES_DATA.length : 'UNDEFINED');
    
    if (!mapInstance || !markersLayer) {
      console.error('❌ Mapa nie gotowa');
      return;
    }
    
    if (!window.PLACES_DATA || window.PLACES_DATA.length === 0) {
      // Dane jeszcze niegotowe (poi-loader może w tle doładować i wyemituje event)
      ceLog('ℹ️ Brak PLACES_DATA - markery dodane później');
      updateMapMarkerFilterCounter();
      dispatchVisiblePoiIdsChanged();
      return;
    }
    
    // Wyczyść stare markery
    markersLayer.clearLayers();
    ceLog('✅ Wyczyszczono stare markery');

    const showPoi = shouldShowPoiMarkers();
    if (!showPoi) {
      ceLog('ℹ️ POI markers hidden by current map filter');
      updateMapMarkerFilterCounter();
      dispatchVisiblePoiIdsChanged();
      return;
    }
    
    // Fallback icon when category emoji is not available.
    const fallbackIcon = L.divIcon({
      className: 'ce-poi-marker',
      html: '<span class="ce-poi-marker__dot" aria-hidden="true"></span>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -12],
    });

    // Some POIs share identical coordinates. Spread only duplicates slightly
    // so all markers remain visible without changing the actual route logic.
    const coordinateBuckets = new Map();
    window.PLACES_DATA.forEach((poi) => {
      const coordinates = getPoiCoordinates(poi);
      if (!coordinates) return;
      const key = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
      const list = coordinateBuckets.get(key) || [];
      list.push(poi.id || list.length + 1);
      coordinateBuckets.set(key, list);
    });
    const bucketCursor = new Map();
    const spreadRadiusDeg = 0.00016;
    const getMarkerPosition = (lat, lng, key) => {
      const total = (coordinateBuckets.get(key) || []).length;
      if (total <= 1) {
        return [lat, lng];
      }
      const idx = bucketCursor.get(key) || 0;
      bucketCursor.set(key, idx + 1);

      const ring = Math.floor(idx / 6);
      const ringSize = 6 * (ring + 1);
      const positionInRing = idx % ringSize;
      const angle = (positionInRing / ringSize) * Math.PI * 2;
      const radius = spreadRadiusDeg * (1 + ring * 0.75);

      return [
        lat + Math.sin(angle) * radius,
        lng + Math.cos(angle) * radius,
      ];
    };
    
    // Dodaj każdy POI z Supabase
    let addedCount = 0;
    let skippedCount = 0;
    
    window.PLACES_DATA.forEach((poi, index) => {
      // Walidacja ID z Supabase
      if (!poi.id) {
        console.warn(`⚠️ [${index}] POI bez ID - pomijam`);
        skippedCount++;
        return;
      }

      const coordinates = getPoiCoordinates(poi);
      if (!coordinates) {
        console.warn(`⚠️ [${index}] POI ${poi.id} bez prawidłowych współrzędnych - pomijam`);
        skippedCount++;
        return;
      }
      if (!poiMatchesCategoryFilter(poi)) {
        return;
      }
      const { lat, lng } = coordinates;
      const coordinateKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      const [markerLat, markerLng] = getMarkerPosition(lat, lng, coordinateKey);
      
      // Nazwa z Supabase (with i18n support)
      const name = window.getPoiName ? window.getPoiName(poi) : (poi.nameFallback || poi.name || poi.id);
      
      ceLog(`📍 [${index}] Dodaję marker: ${name} (ID: ${poi.id}) [${lat}, ${lng}]`);
      const categoryIcon = getPoiMarkerIcon(poi) || fallbackIcon;
      
      // Stwórz marker
      const marker = L.marker([markerLat, markerLng], {
        icon: categoryIcon,
        zIndexOffset: 4000,
      });
      
      // Popups are intentionally disabled on map markers.
      marker.unbindPopup();

      // Kliknięcie markera - sync z panelem pod mapą
      marker.on('click', () => {
        ceLog('🖱️ Kliknięto marker POI:', poi.id);
        // Manually center map with offset
        window.focusPlaceOnMap(poi.id);
        // Update bottom card content
        if (typeof window.setCurrentPlace === 'function') {
          window.setCurrentPlace(poi.id, { scroll: false });
        }
      });
      
      // Dodaj marker do mapy
      marker.addTo(markersLayer);
      addedCount++;
    });
    
    ceLog(`✅ Dodano ${addedCount} markerów z Supabase`);
    if (skippedCount > 0) {
      console.warn(`⚠️ Pominięto ${skippedCount} POI (brak ID lub współrzędnych)`);
    }
    
    if (addedCount === 0) {
      console.error('❌ ŻADEN MARKER NIE ZOSTAŁ DODANY!');
      console.error('→ Sprawdź czy POI w Supabase mają status="published"');
      console.error('→ Sprawdź czy POI mają współrzędne (lat, lng)');
    }

    updateMapMarkerFilterCounter();
    dispatchVisiblePoiIdsChanged();
  }
  
  /**
   * Renderuje listę POI pod mapą
   */
  async function renderLocationsList() {
    ceLog('📋 Renderuję listę lokalizacji...');
    
    const locationsList = document.getElementById('locationsList');
    if (!locationsList) {
      ceLog('ℹ️ Element #locationsList nie znaleziony');
      return;
    }

    const placesNow = getPlacesDataNow();
    if (!placesNow || placesNow.length === 0) {
      locationsList.innerHTML = '<li style="padding: 1rem; color: #666;">Ładowanie lokalizacji...</li>';
      return;
    }
    
    // Wyczyść listę
    locationsList.innerHTML = '';
    
    // Pokaż pierwsze 3 POI
    const previewCount = 3;
    const poisToShow = placesNow.slice(0, previewCount);
    
    poisToShow.forEach(poi => {
      const name = window.getPoiName ? window.getPoiName(poi) : (poi.nameFallback || poi.name || poi.id || 'Unnamed');
      const xp = poi.xp || 100;
      
      const li = document.createElement('li');
      li.className = 'location-card';
      li.innerHTML = `
        <div class="location-info">
          <h3 class="location-name">${name}</h3>
          <p class="location-xp">✨ ${xp} XP</p>
        </div>
        <button class="location-action secondary" onclick="focusPlaceOnMap('${poi.id}')">
          📍 Pokaż na mapie
        </button>
      `;
      locationsList.appendChild(li);
    });
    
    ceLog(`✅ Lista renderowana: ${poisToShow.length} lokalizacji`);
  }
  
  /**
   * Fokusuje mapę na POI
   */
  window.focusPlaceOnMap = function(placeId) {
    const poi = window.PLACES_DATA?.find(p => p.id === placeId);
    if (!poi || !mapInstance) return;

    const coordinates = getPoiCoordinates(poi);
    if (!coordinates) return;
    const { lat, lng } = coordinates;
    
    const targetZoom = 15; // Slightly closer zoom
    const latLng = [lat, lng];
    
    // Calculate offset to show marker above the bottom card
    // On mobile, card is taller/more prominent, so more offset needed
    const isMobile = window.innerWidth <= 768;
    // Shift map center DOWN so marker appears HIGHER
    const offsetY = isMobile ? (window.innerHeight * 0.25) : 100;

    // Use Leaflet projection to calculate new center
    const point = mapInstance.project(latLng, targetZoom);
    point.y += offsetY;
    const targetCenter = mapInstance.unproject(point, targetZoom);

    mapInstance.setView(targetCenter, targetZoom, { animate: true });
    
    // Map marker popups are disabled by design.
  };
  
  /**
   * Export dla manualnego użycia
   */
  window.addMarkers = addMarkers;
  window.mapInstance = mapInstance;
  window.markersLayer = markersLayer;
  window.setMapMarkerFilter = setMapMarkerFilter;
  window.getMapMarkerFilter = () => mapMarkerFilter;
  window.setMapPoiCategoryFilter = setMapPoiCategoryFilter;
  window.getMapPoiCategoryFilter = () => mapPoiCategoryFilter;
  window.getMapPoiCategoryFilterLabel = () => getPoiCategoryLabel(mapPoiCategoryFilter);
  window.getVisiblePoiIdsForMap = () => {
    if (Array.isArray(mapVisiblePoiIds)) {
      return [...mapVisiblePoiIds];
    }
    return getVisiblePoiIdsForCurrentFilter();
  };
  window.getVisibleMapItemsForMap = () => {
    if (Array.isArray(mapVisibleItems)) {
      return mapVisibleItems.map((item) => ({ ...item }));
    }
    return getVisibleMapItemsForCurrentFilter();
  };
  window.getMapPopupOptions = (maxWidth = 270, extra = {}) => getMapPopupOptions(maxWidth, extra);
  
  /**
   * Inicjalizacja główna
   */
  async function initialize() {
    ceLog('🚀 Inicjalizuję aplikację...');
    initHomeScrollGuard();
    clearOrphanedBodyScrollLock();
    
    // Inicjalizuj mapę
    await initializeMap();
    
    // Renderuj listę POI
    await renderLocationsList();

    if (!locationsListenerAttached) {
      locationsListenerAttached = true;
      window.addEventListener('poisDataRefreshed', () => {
        renderLocationsList();
      });
    }
    
    // Przyciski komentarzy na mapie zostały usunięte
    // Komentarze dostępne są tylko w panelu pod mapą
    
    ceLog('✅ Aplikacja zainicjalizowana');
  }
  
  // Start po załadowaniu DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  ceLog('🔵 App Core V3 - GOTOWY (mapa bez komentarzy, komentarze dostępne w panelu poniżej)');
})();
