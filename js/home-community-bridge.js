(function(){
  'use strict';

  const CE_DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true';
  const ceLog = CE_DEBUG ? (...args) => console.log(...args) : () => {};

  let currentId = null;
  let currentItemType = 'poi';
  let observer = null;
  let observing = false;
  let statsTimer = null;
  let checkInBusy = false;
  let checkInUiRefreshToken = 0;
  let visiblePoiIdsFromMap = null;
  const visitedPoiCacheByUser = new Map();
  const visitedPoiFetchPromiseByUser = new Map();
  const PROGRESS_STORAGE_KEYS = ['wakacjecypr-progress', 'wakacjecypr_progress'];
  const ACCOUNTS_STORAGE_KEYS = ['wakacjecypr-accounts', 'wakacjecypr_accounts'];

  function getCurrentLanguage(){
    const raw = window.appI18n?.language || document.documentElement?.lang || 'pl';
    return String(raw || 'pl').toLowerCase();
  }

  function getNestedTranslation(translations, key){
    if (!translations || !key) return null;
    if (Object.prototype.hasOwnProperty.call(translations, key)) {
      return translations[key];
    }
    if (!key.includes('.')) {
      return null;
    }
    const parts = key.split('.');
    let current = translations;
    for (const part of parts) {
      if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        return null;
      }
    }
    return typeof current === 'string' ? current : null;
  }

  function applyReplacements(text, replacements){
    if (!replacements || typeof text !== 'string') {
      return text;
    }
    return text.replace(/\{\{(\w+)\}\}/g, (_match, token) => {
      if (Object.prototype.hasOwnProperty.call(replacements, token)) {
        return String(replacements[token]);
      }
      return `{{${token}}}`;
    });
  }

  function t(key, fallbackPl, fallbackEn, replacements = null){
    const lang = getCurrentLanguage();
    const fallback = lang.startsWith('en') ? (fallbackEn || fallbackPl) : fallbackPl;
    const rawTranslations = window.appI18n?.translations || {};
    const translations = (
      rawTranslations &&
      typeof rawTranslations === 'object' &&
      Object.prototype.hasOwnProperty.call(rawTranslations, lang) &&
      rawTranslations[lang] &&
      typeof rawTranslations[lang] === 'object'
    ) ? rawTranslations[lang] : rawTranslations;
    const translated = getNestedTranslation(translations, key);
    const resolved = typeof translated === 'string' && translated ? translated : fallback;
    return applyReplacements(resolved, replacements);
  }

  function normalizePoiId(value){
    return String(value || '').trim();
  }

  function isIgnorableVisitedLookupError(error){
    const code = String(error?.code || '').toUpperCase();
    if (code === 'PGRST116' || code === 'PGRST204' || code === '42P01' || code === '42703') {
      return true;
    }
    const combined = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return (
      combined.includes('does not exist') ||
      combined.includes('not found') ||
      combined.includes('schema cache')
    );
  }

  function getVisitedPoiIdsFromLocalState(userId){
    const visited = new Set();

    try {
      if (window.state?.visited && typeof window.state.visited.forEach === 'function') {
        window.state.visited.forEach((id) => {
          const normalized = normalizePoiId(id);
          if (normalized) visited.add(normalized);
        });
      }
    } catch (_) {}

    PROGRESS_STORAGE_KEYS.forEach((storageKey) => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const progress = JSON.parse(raw);
        if (!Array.isArray(progress?.visited)) return;
        progress.visited.forEach((id) => {
          const normalized = normalizePoiId(id);
          if (normalized) visited.add(normalized);
        });
      } catch (_) {}
    });

    if (userId) {
      ACCOUNTS_STORAGE_KEYS.forEach((accountsKey) => {
        try {
          const raw = localStorage.getItem(accountsKey);
          if (!raw) return;
          const accounts = JSON.parse(raw);
          if (!accounts || typeof accounts !== 'object') return;
          const account =
            accounts[`supabase:${userId}`] ||
            accounts[userId] ||
            null;
          if (!Array.isArray(account?.progress?.visited)) return;
          account.progress.visited.forEach((id) => {
            const normalized = normalizePoiId(id);
            if (normalized) visited.add(normalized);
          });
        } catch (_) {}
      });
    }

    return visited;
  }

  async function loadVisitedPoiIdsForUser(sb, userId, { forceRefresh = false } = {}){
    const normalizedUserId = normalizePoiId(userId);
    if (!normalizedUserId) {
      return getVisitedPoiIdsFromLocalState('');
    }

    if (!forceRefresh && visitedPoiCacheByUser.has(normalizedUserId)) {
      return visitedPoiCacheByUser.get(normalizedUserId);
    }
    if (!forceRefresh && visitedPoiFetchPromiseByUser.has(normalizedUserId)) {
      return visitedPoiFetchPromiseByUser.get(normalizedUserId);
    }

    const fetchPromise = (async () => {
      if (!sb) {
        const localOnly = getVisitedPoiIdsFromLocalState(normalizedUserId);
        visitedPoiCacheByUser.set(normalizedUserId, localOnly);
        return localOnly;
      }

      let visited = null;

      try {
        const { data, error } = await sb
          .from('profiles')
          .select('visited_places')
          .eq('id', normalizedUserId)
          .maybeSingle();

        if (error) {
          if (!isIgnorableVisitedLookupError(error)) {
            console.warn('Could not load profiles.visited_places:', error);
          }
        } else if (Array.isArray(data?.visited_places)) {
          visited = new Set(
            data.visited_places
              .map((id) => normalizePoiId(id))
              .filter(Boolean),
          );
        }
      } catch (error) {
        if (!isIgnorableVisitedLookupError(error)) {
          console.warn('Could not query profiles.visited_places:', error);
        }
      }

      if (!visited) {
        try {
          const { data, error } = await sb
            .from('user_poi_visits')
            .select('poi_id')
            .eq('user_id', normalizedUserId);

          if (error) {
            if (!isIgnorableVisitedLookupError(error)) {
              console.warn('Could not load user_poi_visits:', error);
            }
          } else if (Array.isArray(data)) {
            visited = new Set(
              data
                .map((row) => normalizePoiId(row?.poi_id))
                .filter(Boolean),
            );
          }
        } catch (error) {
          if (!isIgnorableVisitedLookupError(error)) {
            console.warn('Could not query user_poi_visits:', error);
          }
        }
      }

      if (!visited) {
        visited = getVisitedPoiIdsFromLocalState(normalizedUserId);
      } else {
        const localVisited = getVisitedPoiIdsFromLocalState(normalizedUserId);
        localVisited.forEach((id) => visited.add(id));
      }

      visitedPoiCacheByUser.set(normalizedUserId, visited);
      return visited;
    })();

    visitedPoiFetchPromiseByUser.set(normalizedUserId, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      visitedPoiFetchPromiseByUser.delete(normalizedUserId);
    }
  }

  async function hasVisitedPoiForUser(sb, userId, poiId, options = {}){
    const normalizedPoiId = normalizePoiId(poiId);
    if (!normalizedPoiId) return false;
    const visited = await loadVisitedPoiIdsForUser(sb, userId, options);
    return visited.has(normalizedPoiId);
  }

  function persistVisitedPoiLocally(userId, poiId){
    const normalizedPoiId = normalizePoiId(poiId);
    const normalizedUserId = normalizePoiId(userId);
    if (!normalizedPoiId) return;

    try {
      if (window.state?.visited?.add) {
        window.state.visited.add(normalizedPoiId);
      }
    } catch (_) {}

    PROGRESS_STORAGE_KEYS.forEach((storageKey) => {
      try {
        const raw = localStorage.getItem(storageKey);
        const progress = raw ? JSON.parse(raw) : {};
        const visited = Array.isArray(progress?.visited) ? [...progress.visited] : [];
        if (!visited.includes(normalizedPoiId)) {
          visited.push(normalizedPoiId);
          localStorage.setItem(storageKey, JSON.stringify({ ...progress, visited }));
        }
      } catch (_) {}
    });

    if (!normalizedUserId) return;

    ACCOUNTS_STORAGE_KEYS.forEach((accountsKey) => {
      try {
        const raw = localStorage.getItem(accountsKey);
        if (!raw) return;
        const accounts = JSON.parse(raw);
        if (!accounts || typeof accounts !== 'object') return;

        const accountKey = Object.prototype.hasOwnProperty.call(accounts, `supabase:${normalizedUserId}`)
          ? `supabase:${normalizedUserId}`
          : Object.prototype.hasOwnProperty.call(accounts, normalizedUserId)
          ? normalizedUserId
          : null;
        if (!accountKey) return;

        const account = accounts[accountKey];
        const progress = account?.progress && typeof account.progress === 'object' ? account.progress : {};
        const visited = Array.isArray(progress.visited) ? [...progress.visited] : [];
        if (visited.includes(normalizedPoiId)) return;

        visited.push(normalizedPoiId);
        accounts[accountKey] = {
          ...account,
          progress: {
            ...progress,
            visited,
          },
        };
        localStorage.setItem(accountsKey, JSON.stringify(accounts));
      } catch (_) {}
    });
  }

  function registerVisitedPoi(userId, poiId){
    const normalizedUserId = normalizePoiId(userId);
    const normalizedPoiId = normalizePoiId(poiId);
    if (!normalizedUserId || !normalizedPoiId) return;

    const cached = visitedPoiCacheByUser.get(normalizedUserId) || new Set();
    cached.add(normalizedPoiId);
    visitedPoiCacheByUser.set(normalizedUserId, cached);

    persistVisitedPoiLocally(normalizedUserId, normalizedPoiId);
  }

  function getCheckInButton(){
    return document.getElementById('currentPlaceCheckInBtn') || document.querySelector('.current-place-actions .btn.primary');
  }

  function setCheckInButtonDefault(button){
    if (!button) return;
    button.classList.remove('is-hidden');
    button.disabled = false;
    button.classList.remove('is-visited');
    button.innerHTML = `<span class="btn-icon">✓</span> <span>${t('currentPlace.checkIn', 'Zamelduj się', 'Check in')}</span>`;
  }

  function setCheckInButtonVisited(button){
    if (!button) return;
    button.disabled = true;
    button.classList.add('is-visited');
    button.innerHTML = `<span class="btn-icon">✓</span> <span>${t('community.checkin.alreadyVisited', 'Już tu byłeś', 'Already visited')}</span>`;
  }

  async function syncCurrentPlaceCheckInUi(poiId, { forceRefresh = false } = {}){
    const normalizedPoiId = normalizePoiId(poiId);
    const button = getCheckInButton();
    if (!button || !normalizedPoiId) {
      return;
    }
    if (currentItemType !== 'poi' || !findPoi(normalizedPoiId)) {
      button.disabled = true;
      button.classList.add('is-hidden');
      return;
    }
    const refreshToken = ++checkInUiRefreshToken;

    setCheckInStatus('');
    setCheckInButtonDefault(button);

    const sb = window.getSupabase?.();
    if (!sb) return;

    let user = null;
    try {
      const { data, error } = await sb.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    } catch (_) {}

    if (!user?.id) {
      return;
    }

    try {
      const visited = await hasVisitedPoiForUser(sb, user.id, normalizedPoiId, { forceRefresh });
      if (refreshToken !== checkInUiRefreshToken) {
        return;
      }
      if (visited) {
        setCheckInButtonVisited(button);
        setCheckInStatus(t('currentPlace.status.alreadyVisited', 'Już tu byłeś w tym miejscu.', 'You have already checked in here.'));
      }
    } catch (error) {
      console.warn('Could not sync check-in button state:', error);
    }
  }

  function getOrderedPoiIds(){
    if (!Array.isArray(visiblePoiIdsFromMap) && typeof window.getVisibleMapItemsForMap === 'function') {
      const fromMap = window.getVisibleMapItemsForMap();
      if (Array.isArray(fromMap)) {
        visiblePoiIdsFromMap = fromMap
          .map((item) => normalizePoiId(item?.id))
          .filter(Boolean);
      }
    }

    if (Array.isArray(visiblePoiIdsFromMap)) {
      const knownPoiIds = new Set((window.PLACES_DATA || []).map((poi) => normalizePoiId(poi?.id)).filter(Boolean));
      const knownRecommendationIds = new Set(getRecommendationsDataNow().map((rec) => normalizePoiId(rec?.id)).filter(Boolean));
      return [...new Set(visiblePoiIdsFromMap)].filter((id) => knownPoiIds.has(id) || knownRecommendationIds.has(id));
    }

    const cards = Array.from(document.querySelectorAll('#poisList .poi-card'));
    if (cards.length > 0) {
      return cards.map(c=>c.dataset.poiId).filter(Boolean);
    }
    // Fallback to PLACES_DATA order when list is not present on the page
    return (window.PLACES_DATA||[]).map(p=>p.id).filter(Boolean);
  }

  function findPoi(id){
    const normalizedId = normalizePoiId(id);
    return (window.PLACES_DATA||[]).find((p)=>normalizePoiId(p?.id) === normalizedId);
  }

  function getRecommendationsDataNow(){
    if (typeof window.getMapRecommendationsData === 'function') {
      const recommendations = window.getMapRecommendationsData();
      if (Array.isArray(recommendations)) {
        return recommendations;
      }
    }
    return [];
  }

  function findRecommendation(id){
    const normalizedId = normalizePoiId(id);
    return getRecommendationsDataNow().find((recommendation) => normalizePoiId(recommendation?.id) === normalizedId);
  }

  function getCurrentItem() {
    if (!currentId) {
      return null;
    }
    return { type: currentItemType, id: currentId };
  }

  function setCurrentItem(type, id) {
    currentItemType = type === 'recommendation' ? 'recommendation' : 'poi';
    currentId = normalizePoiId(id);
    window.currentMapItem = currentId ? { type: currentItemType, id: currentId } : null;
    window.currentPlaceId = currentItemType === 'poi' ? currentId : null;
  }

  function getLocalizedRecommendationTitle(recommendation){
    if (!recommendation) return '';
    const lang = getCurrentLanguage();
    if (lang.startsWith('en')) {
      return recommendation.title_en || recommendation.title_pl || '';
    }
    return recommendation.title_pl || recommendation.title_en || '';
  }

  function getLocalizedRecommendationDescription(recommendation){
    if (!recommendation) return '';
    const lang = getCurrentLanguage();
    if (lang.startsWith('en')) {
      return recommendation.description_en || recommendation.description_pl || '';
    }
    return recommendation.description_pl || recommendation.description_en || '';
  }

  function getLocalizedRecommendationDiscount(recommendation){
    if (!recommendation) return '';
    const lang = getCurrentLanguage();
    if (lang.startsWith('en')) {
      return recommendation.discount_text_en || recommendation.discount_text_pl || '';
    }
    return recommendation.discount_text_pl || recommendation.discount_text_en || '';
  }

  function updateCurrentPlaceActionsForType(type, recommendation = null){
    const actionsEl = document.querySelector('.current-place-actions');
    const checkInBtn = document.getElementById('currentPlaceCheckInBtn') || getCheckInButton();
    const detailsBtn = document.getElementById('currentPlaceCommentsBtn');
    const mapBtn = document.getElementById('currentPlaceNavigateBtn');
    const detailsLabel = detailsBtn ? detailsBtn.querySelector('span:not(.btn-icon)') : null;
    const detailsIcon = detailsBtn ? detailsBtn.querySelector('.btn-icon') : null;
    const mapLabel = mapBtn ? mapBtn.querySelector('span:not(.btn-icon)') : null;
    const mapIcon = mapBtn ? mapBtn.querySelector('.btn-icon') : null;

    if (actionsEl) {
      actionsEl.classList.toggle('is-recommendation', type === 'recommendation');
    }

    if (checkInBtn) {
      const shouldHideCheckIn = type === 'recommendation';
      checkInBtn.classList.toggle('is-hidden', shouldHideCheckIn);
      checkInBtn.disabled = shouldHideCheckIn;
      if (!shouldHideCheckIn) {
        setCheckInButtonDefault(checkInBtn);
      }
    }

    if (detailsLabel) {
      detailsLabel.textContent = type === 'recommendation'
        ? t('currentPlace.details', 'Szczegóły', 'Details')
        : t('currentPlace.info', 'Info', 'Info');
    }
    if (detailsIcon) {
      detailsIcon.textContent = 'ℹ️';
    }

    if (mapLabel) {
      mapLabel.textContent = t('currentPlace.map', 'Mapa', 'Map');
    }
    if (mapIcon) {
      mapIcon.textContent = type === 'recommendation' ? '📍' : '➤';
    }

    if (mapBtn) {
      const hasMapTarget = type === 'poi'
        || Boolean(recommendation?.google_url)
        || (Number.isFinite(Number.parseFloat(recommendation?.latitude)) && Number.isFinite(Number.parseFloat(recommendation?.longitude)));
      mapBtn.disabled = !hasMapTarget;
    }
  }

  function getPlacesDataNow(){
    if (Array.isArray(window.PLACES_DATA)) return window.PLACES_DATA;
    return [];
  }

  function updateCurrentPlacePanelNavigationUi() {
    const ids = getOrderedPoiIds();
    const hasVisiblePois = ids.length > 0;
    const currentIndex = currentId ? ids.indexOf(currentId) : -1;
    const counterEl = document.getElementById('placeCounter');
    const prevBtn = document.getElementById('prevPlaceBtn');
    const nextBtn = document.getElementById('nextPlaceBtn');
    const hintEl = document.getElementById('currentPlaceFilterHint');
    const panelEl = document.getElementById('currentPlaceSection');
    const commentsBtn = document.getElementById('currentPlaceCommentsBtn');
    const navigateBtn = document.getElementById('currentPlaceNavigateBtn');
    const checkInBtn = getCheckInButton();

    if (counterEl) {
      if (!hasVisiblePois) {
        counterEl.textContent = '0 / 0';
      } else if (currentIndex >= 0) {
        counterEl.textContent = `${currentIndex + 1} / ${ids.length}`;
      } else {
        counterEl.textContent = `1 / ${ids.length}`;
      }
    }

    if (prevBtn) prevBtn.disabled = !hasVisiblePois || currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = !hasVisiblePois || currentIndex < 0 || currentIndex >= ids.length - 1;

    if (panelEl) {
      panelEl.classList.toggle('is-filter-empty', !hasVisiblePois);
    }

    const activeMapFilter = typeof window.getMapMarkerFilter === 'function'
      ? window.getMapMarkerFilter()
      : 'all';
    const activePoiCategoryFilters = typeof window.getMapPoiCategoryFilters === 'function'
      ? window.getMapPoiCategoryFilters()
      : [];
    const activePoiCategoryLabel = typeof window.getMapPoiCategoryFilterLabel === 'function'
      ? window.getMapPoiCategoryFilterLabel()
      : '';

    let noPoiMessage = t(
      'currentPlace.filter.noItems',
      'Brak miejsc w tym filtrze. Wybierz inny widok mapy.',
      'No places available in this filter. Switch to another map view.',
    );

    if (activeMapFilter !== 'recommendations' && Array.isArray(activePoiCategoryFilters) && activePoiCategoryFilters.length > 0 && activePoiCategoryLabel) {
      noPoiMessage = t(
        'currentPlace.filter.noItemsCategory',
        `Brak miejsc w kategorii „${activePoiCategoryLabel}”. Wybierz inną kategorię.`,
        `No places in “${activePoiCategoryLabel}”. Select another category.`,
      );
    }

    if (hintEl) {
      if (!hasVisiblePois) {
        hintEl.textContent = noPoiMessage;
        hintEl.hidden = false;
      } else {
        hintEl.textContent = '';
        hintEl.hidden = true;
      }
    }

    if (commentsBtn) commentsBtn.disabled = !hasVisiblePois;
    if (navigateBtn && !hasVisiblePois) {
      navigateBtn.disabled = true;
    }

    if (!hasVisiblePois) {
      if (checkInBtn) {
        checkInBtn.disabled = true;
        checkInBtn.dataset.filterDisabled = '1';
        checkInBtn.classList.add('is-hidden');
      }
      setCheckInStatus(noPoiMessage);
      return;
    }

    if (checkInBtn && checkInBtn.dataset.filterDisabled === '1') {
      delete checkInBtn.dataset.filterDisabled;
      if (currentItemType === 'poi') {
        checkInBtn.classList.remove('is-hidden');
        setCheckInButtonDefault(checkInBtn);
      } else {
        checkInBtn.classList.add('is-hidden');
        checkInBtn.disabled = true;
      }
      if (currentId && currentItemType === 'poi') {
        void syncCurrentPlaceCheckInUi(currentId, { forceRefresh: false });
      }
    }

    const statusEl = document.getElementById('currentPlaceCheckInStatus');
    if (statusEl && statusEl.textContent === noPoiMessage) {
      setCheckInStatus('');
    }
  }

  function handleMapVisiblePoiIdsChanged(event) {
    const detail = event?.detail || {};
    if (Array.isArray(detail.items)) {
      visiblePoiIdsFromMap = detail.items
        .map((item) => normalizePoiId(item?.id))
        .filter(Boolean);
    } else if (Array.isArray(detail.poiIds)) {
      visiblePoiIdsFromMap = detail.poiIds.map(normalizePoiId).filter(Boolean);
    }

    const ids = getOrderedPoiIds();
    if (ids.length === 0) {
      updateCurrentPlacePanelNavigationUi();
      return;
    }

    if (!currentId || !ids.includes(currentId)) {
      setCurrentPlace(ids[0], { focus: false, scroll: false, force: true });
      return;
    }

    updateCurrentPlacePanelNavigationUi();
  }

  function setCurrentPlace(id, options={scroll:false, focus:true}){
    if(!id) return;
    if(currentId===id && !options.force){
      const targetType = findPoi(id) ? 'poi' : (findRecommendation(id) ? 'recommendation' : currentItemType);
      if (targetType === currentItemType) {
        return;
      }
    }
    const poi = findPoi(id);
    if(!poi) {
      const recommendation = findRecommendation(id);
      if (!recommendation) return;
      setCurrentRecommendation(recommendation, options);
      return;
    }
    setCurrentItem('poi', id);

    const nameEl = document.getElementById('currentPlaceName');
    const descEl = document.getElementById('currentPlaceDescription');
    const saveBtn = document.getElementById('currentPlaceSaveBtn');
    
    // New Elements
    const xpBadgeEl = document.getElementById('currentPlaceXPBadge');
    const trophyBadgeEl = document.getElementById('currentPlaceTrophyBadge');
    const trophyNameEl = document.getElementById('trophyName');
    const counterEl = document.getElementById('placeCounter');

    // Old Elements (Fallback)
    const xpEl = document.getElementById('currentPlaceXP');
    const commentsEl = document.getElementById('currentPlaceComments');
    const ratingEl = document.getElementById('currentPlaceRating');

    const poiName = window.getPoiName ? window.getPoiName(poi) : (poi.nameFallback || poi.name || '—');
    const poiDesc = window.getPoiDescription ? window.getPoiDescription(poi) : (poi.descriptionFallback || poi.description || 'Cypr');
    
    if(nameEl) {
      nameEl.textContent = poiName;
      try {
        if (nameEl.hasAttribute('data-i18n')) nameEl.removeAttribute('data-i18n');
      } catch (_) {}
    }
    if(descEl) descEl.textContent = poiDesc;

    if (saveBtn) {
      saveBtn.setAttribute('data-item-type', 'poi');
      saveBtn.setAttribute('data-ref-id', String(poi.id || ''));
      try {
        if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
          const root = saveBtn.closest('.place-badges') || saveBtn.parentElement || document;
          window.CE_SAVED_CATALOG.refreshButtons(root);
        }
      } catch (_) {}
    }
    
    // Update XP Badge
    if(xpBadgeEl) {
      xpBadgeEl.textContent = `+${poi.xp||0} XP`;
    }
    // Update Old XP Element (if still exists in other views)
    if(xpEl) xpEl.textContent = (poi.xp||0) + ' XP';

    // Update Trophy Badge
    if(trophyBadgeEl && trophyNameEl) {
      if(poi.trophy_name) {
        trophyBadgeEl.style.display = 'inline-flex';
        trophyNameEl.textContent = poi.trophy_name;
      } else {
        trophyBadgeEl.style.display = 'none';
      }
    }

    const typeBadgeEl = document.querySelector('.badge-type');
    if (typeBadgeEl) {
      typeBadgeEl.textContent = t('badges.landmark', 'LANDMARK', 'LANDMARK');
    }

    // Update Counter (X / Y) and panel state according to active map filter
    if (counterEl) {
      // Kept to ensure immediate paint before full UI update below.
      counterEl.textContent = '...';
    }

    // Legacy: Reset comments/rating placeholders (will be updated by updatePlaceStats)
    if(commentsEl) commentsEl.textContent = '...';
    if(ratingEl) ratingEl.textContent = '...';

    // Load live stats (rating + comments) for the selected place
    updatePlaceStats(id).catch(()=>{
      // Non-blocking; leave placeholders on error
    });

    // Periodic refresh while this POI is selected
    if (statsTimer) clearInterval(statsTimer);
    statsTimer = setInterval(() => { if (currentId===id) updatePlaceStats(id); }, 10000);

    updateCurrentPlaceActionsForType('poi', null);

    if(options.focus !== false && typeof window.focusPlaceOnMap === 'function'){
      window.focusPlaceOnMap(id);
    }

    if(options.scroll){
      const card = document.querySelector('#poisList .poi-card[data-poi-id="'+id+'"]');
      const scrollBox = document.getElementById('poisScroll');
      if(card && scrollBox){
        const cardTop = card.offsetTop - scrollBox.offsetTop;
        const target = Math.max(0, cardTop - 12);
        scrollBox.scrollTo({ top: target, behavior: 'smooth' });
      }
    }

    // Toggle active class on cards
    const listRoot = document.getElementById('poisList');
    if (listRoot) {
      listRoot.querySelectorAll('.poi-card.active').forEach(el=>el.classList.remove('active'));
      const active = document.querySelector('#poisList .poi-card[data-poi-id="'+id+'"]');
      if(active) active.classList.add('active');
    }

    updateCurrentPlacePanelNavigationUi();
    if (getOrderedPoiIds().includes(poi.id)) {
      void syncCurrentPlaceCheckInUi(poi.id, { forceRefresh: false });
    }
  }

  function setCurrentRecommendation(recommendation, options = { scroll: false, focus: true }) {
    if (!recommendation || !recommendation.id) {
      return;
    }

    const recommendationId = normalizePoiId(recommendation.id);
    if (currentId === recommendationId && currentItemType === 'recommendation' && !options.force) {
      return;
    }

    setCurrentItem('recommendation', recommendationId);
    if (statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }

    const nameEl = document.getElementById('currentPlaceName');
    const descEl = document.getElementById('currentPlaceDescription');
    const saveBtn = document.getElementById('currentPlaceSaveBtn');
    const xpBadgeEl = document.getElementById('currentPlaceXPBadge');
    const trophyBadgeEl = document.getElementById('currentPlaceTrophyBadge');
    const typeBadgeEl = document.querySelector('.badge-type');
    const recommendationTitle = getLocalizedRecommendationTitle(recommendation) || t('currentPlace.details', 'Szczegóły', 'Details');
    const recommendationDescription = getLocalizedRecommendationDescription(recommendation)
      || t('currentPlace.recommendation.offer', 'Oferta partnera', 'Partner offer');
    const recommendationDiscount = getLocalizedRecommendationDiscount(recommendation);

    if (nameEl) {
      nameEl.textContent = recommendationTitle;
      try {
        if (nameEl.hasAttribute('data-i18n')) nameEl.removeAttribute('data-i18n');
      } catch (_) {}
    }
    if (descEl) {
      descEl.textContent = recommendationDescription;
    }

    if (saveBtn) {
      saveBtn.setAttribute('data-item-type', 'recommendation');
      saveBtn.setAttribute('data-ref-id', recommendationId);
      try {
        if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
          const root = saveBtn.closest('.place-badges') || saveBtn.parentElement || document;
          window.CE_SAVED_CATALOG.refreshButtons(root);
        }
      } catch (_) {}
    }

    if (typeBadgeEl) {
      typeBadgeEl.textContent = t('currentPlace.badge.recommended', 'POLECANE', 'RECOMMENDED');
    }
    if (xpBadgeEl) {
      xpBadgeEl.textContent = recommendationDiscount
        ? `🎁 ${recommendationDiscount}`
        : t('currentPlace.recommendation.offer', 'Oferta', 'Offer');
    }
    if (trophyBadgeEl) {
      trophyBadgeEl.style.display = 'none';
    }

    updateCurrentPlaceActionsForType('recommendation', recommendation);
    setCheckInStatus('');
    updateCurrentPlacePanelNavigationUi();

    const listRoot = document.getElementById('poisList');
    if (listRoot) {
      listRoot.querySelectorAll('.poi-card.active').forEach((el) => el.classList.remove('active'));
    }

    if (options.focus !== false) {
      if (typeof window.openRecommendationMarkerPopup === 'function') {
        window.openRecommendationMarkerPopup(recommendationId, window.mapInstance || null);
      } else {
        const recLat = Number.parseFloat(recommendation.latitude);
        const recLng = Number.parseFloat(recommendation.longitude);
        if (Number.isFinite(recLat) && Number.isFinite(recLng) && window.mapInstance && typeof window.mapInstance.setView === 'function') {
          window.mapInstance.setView([recLat, recLng], 14, { animate: true });
        }
      }
    }
  }

  // Fetch and render rating average and top-level comment count for a POI
  async function updatePlaceStats(poiId){
    if(!poiId){
      console.warn('updatePlaceStats called without poiId');
      return;
    }

    try{
      // Wait for Supabase client (up to 3 seconds)
      let sb = window.getSupabase?.();
      let attempts = 0;
      while(!sb && attempts < 30){
        await new Promise(r => setTimeout(r, 100));
        sb = window.getSupabase?.();
        attempts++;
      }
      
      if(!sb){
        console.warn('Supabase client not available for stats');
        return;
      }

      console.log('📊 Loading stats for POI:', poiId);

      // Comments: count only top-level comments
      const { count: commentCount, error: commentsError } = await sb
        .from('poi_comments')
        .select('*', { count: 'exact', head: true })
        .eq('poi_id', poiId)
        .is('parent_comment_id', null);

      if(commentsError){
        console.warn('Comments count error:', commentsError.message);
      }

      const commentsEl = document.getElementById('currentPlaceComments');
      if(commentsEl){
        const c = commentCount || 0;
        if (c <= 0) {
          commentsEl.textContent = t('community.comments.count.zero', '0 komentarzy', '0 comments');
        } else if (c === 1) {
          commentsEl.textContent = t('community.comments.count.one', '1 komentarz', '1 comment');
        } else {
          commentsEl.textContent = t(
            'community.comments.count.multiple',
            '{{count}} komentarzy',
            '{{count}} comments',
            { count: c },
          );
        }
        console.log('✅ Updated comments:', c);
      }

      // Rating: read aggregated stats
      const { data: ratingData, error: ratingError } = await sb
        .from('poi_rating_stats')
        .select('*')
        .eq('poi_id', poiId)
        .maybeSingle();

      if(ratingError){
        console.warn('Rating stats error:', ratingError.message);
      }

      const ratingEl = document.getElementById('currentPlaceRating');
      if(ratingEl){
        const total = (!ratingError && ratingData) ? (ratingData.total_ratings||0) : 0;
        if(total === 0){
          ratingEl.textContent = t('community.rating.noRatings', 'Brak ocen', 'No ratings');
        } else {
          const avg = Number(ratingData.average_rating) || 0;
          const ratingLabel = total === 1
            ? t('community.rating.oneRating', 'ocena', 'rating')
            : t('community.rating.multipleRatings', 'ocen', 'ratings');
          ratingEl.textContent = `${avg.toFixed(1)} (${total} ${ratingLabel})`;
        }
        console.log('✅ Updated rating:', total > 0 ? `${ratingData.average_rating} (${total})` : '0');
      }
    } catch(e){
      // Log error but don't break UI
      console.error('updatePlaceStats error:', e);
    }
  }

  function setCheckInStatus(message){
    const el = document.getElementById('currentPlaceCheckInStatus');
    if(!el) return;
    el.textContent = message || '';
  }

  function openLoginModalIfAvailable(){
    try{
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
        return;
      }
      const opener = document.querySelector('[data-open-auth]');
      if (opener instanceof HTMLElement) {
        opener.click();
      }
    } catch(e){
      console.warn('Unable to open auth modal from check-in:', e);
    }
  }

  function navigatePlace(delta){
    const ids = getOrderedPoiIds();
    if(ids.length===0) {
      updateCurrentPlacePanelNavigationUi();
      return;
    }
    let idx = Math.max(0, ids.indexOf(currentId));
    idx = idx + delta;
    if(idx<0) idx = 0; else if(idx>=ids.length) idx = ids.length-1;
    setCurrentPlace(ids[idx], {scroll:true, force:true});
  }

  function showCommunity(id){
    const targetId = id || currentId;
    if (!targetId) {
      return;
    }

    const targetPoi = findPoi(targetId);
    const targetType = targetPoi ? 'poi' : (findRecommendation(targetId) ? 'recommendation' : currentItemType);

    if (targetType === 'recommendation') {
      if (typeof window.openRecommendationDetailModal === 'function') {
        window.openRecommendationDetailModal(targetId);
      } else {
        window.location.href = '/recommendations.html';
      }
      return;
    }

    if (typeof window.openPoiComments === 'function') {
      try {
        window.openPoiComments(targetId);
        return;
      } catch (error) {
        console.error('openPoiComments failed on home page, redirecting to community:', error);
      }
    }

    try {
      const url = new URL('/community.html', window.location.origin);
      url.searchParams.set('poi', targetId);
      window.location.href = url.toString();
    } catch (e) {
      // Fallback for very old browsers
      window.location.href = '/community.html?poi=' + encodeURIComponent(targetId);
    }
  }

  function focusCurrentMapItem(){
    const currentItem = getCurrentItem();
    if (!currentItem || !currentItem.id) {
      return;
    }

    if (currentItem.type === 'recommendation') {
      const recommendation = findRecommendation(currentItem.id);
      if (recommendation?.google_url) {
        window.open(recommendation.google_url, '_blank', 'noopener');
        return;
      }
      if (typeof window.openRecommendationMarkerPopup === 'function') {
        window.openRecommendationMarkerPopup(currentItem.id, window.mapInstance || null);
      }
      return;
    }

    if (typeof window.focusPlaceOnMap === 'function') {
      window.focusPlaceOnMap(currentItem.id);
    }
  }

  function openCurrentPlaceDetails() {
    const currentItem = getCurrentItem();
    if (!currentItem || !currentItem.id) {
      return;
    }
    showCommunity(currentItem.id);
  }

  async function getPosition(highAccuracy = true) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: 0,
      });
    });
  }

  async function checkInAtPlace(id){
    let btn;
    let shouldRestoreButton = true;
    try{
      const targetId = id || currentId;
      const targetPoi = targetId ? findPoi(targetId) : null;
      if (!targetPoi) return;

      if(checkInBusy) return;
      checkInBusy = true;

      // Visual feedback on the primary action button
      btn = getCheckInButton();
      if (btn) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-small"></span>${btn.textContent.trim() || t('checkIn.status.checking', 'Sprawdzam...', 'Checking...')}`;
      }

      const poi = targetPoi;

      const sb = window.getSupabase?.();
      if (!sb) {
        const statusMsg = t(
          'checkIn.status.accountUnavailable',
          'Nie udało się połączyć z kontem. Odśwież stronę i zaloguj się, aby się zameldować.',
          'Could not connect to your account. Refresh and sign in to check in.',
        );
        setCheckInStatus(statusMsg);
        window.showToast?.(
          t(
            'checkIn.status.loginForXp',
            'Zaloguj się, aby zbierać XP za odwiedzone miejsca.',
            'Sign in to collect XP for visited places.',
          ),
          'warning',
        );
        openLoginModalIfAvailable();
        return;
      }

      let user = null;
      try{
        const { data, error } = await sb.auth.getUser();
        if (error) {
          console.warn('Supabase getUser error during check-in:', error);
        }
        user = data?.user || null;
      } catch(e){
        console.warn('Supabase getUser threw during check-in:', e);
      }

      if(!user){
        const loginMsg = t(
          'community.checkin.loginRequired',
          'Zaloguj się, aby się zameldować',
          'Log in to check in',
        );
        setCheckInStatus(loginMsg);
        window.showToast?.(
          t(
            'checkIn.status.loginOrRegister',
            'Zaloguj się lub utwórz konto, aby zbierać XP.',
            'Log in or create an account to collect XP.',
          ),
          'warning',
        );
        openLoginModalIfAvailable();
        return;
      }

      const alreadyVisited = await hasVisitedPoiForUser(sb, user.id, poi.id, { forceRefresh: true });
      if (alreadyVisited) {
        setCheckInButtonVisited(btn);
        shouldRestoreButton = false;
        const visitedMsg = t(
          'currentPlace.status.alreadyVisited',
          'Już tu byłeś w tym miejscu.',
          'You have already checked in here.',
        );
        setCheckInStatus(visitedMsg);
        window.showToast?.(t('community.checkin.alreadyVisited', 'Już tu byłeś', 'Already visited'), 'info');
        return;
      }

      let latitude;
      let longitude;

      // 1) Spróbuj użyć ostatniej znanej lokalizacji z mapy (app-core.js)
      const cachedLoc = window.currentUserLocation;
      const now = Date.now();
      const isCachedFresh = cachedLoc &&
        Number.isFinite(cachedLoc.lat) &&
        Number.isFinite(cachedLoc.lng) &&
        (now - (cachedLoc.timestamp || 0)) < 5 * 60 * 1000; // 5 minut

      if (isCachedFresh) {
        console.log('Using cached user location from map for check-in', cachedLoc);
        latitude = cachedLoc.lat;
        longitude = cachedLoc.lng;
      } else {
        // 2) No fresh map location – use browser geolocation
        if(!('geolocation' in navigator)){
          const unsupportedMsg = t(
            'checkIn.status.unsupported',
            'Twoja przeglądarka nie wspiera geolokalizacji. Możesz potwierdzić wizytę ręcznie poniżej.',
            'Your browser does not support geolocation. You can confirm your visit manually below.',
          );
          setCheckInStatus(unsupportedMsg);
          window.showToast?.(unsupportedMsg, 'warning');
          return;
        }

        setCheckInStatus(
          t(
            'checkIn.status.checking',
            'Sprawdzanie lokalizacji…',
            'Checking your location…',
          ),
        );

        let position;
        try {
          // First attempt: high accuracy (GPS)
          position = await getPosition(true);
        } catch (firstError) {
          console.warn('High accuracy geolocation failed, trying low accuracy...', firstError);
          setCheckInStatus(
            t(
              'checkIn.status.fallbackLocation',
              'Słaby sygnał GPS, próbuję przybliżoną lokalizację...',
              'Weak GPS signal, trying approximate location...',
            ),
          );
          // Second attempt: lower accuracy (WiFi / GSM)
          position = await getPosition(false);
        }

        if (!position || !position.coords) {
          const locationFailMsg = t(
            'checkIn.status.error',
            'Nie udało się pobrać lokalizacji. Upewnij się, że przyznałeś uprawnienia lub potwierdź ręcznie.',
            'We could not obtain your location. Make sure you granted permission or confirm manually.',
          );
          setCheckInStatus(locationFailMsg);
          window.showToast?.(locationFailMsg, 'error');
          return;
        }

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }
      // Normalizuj współrzędne POI
      const lat = typeof poi.lat === 'number' ? poi.lat : (typeof poi.latitude === 'number' ? poi.latitude : parseFloat(poi.lat ?? poi.latitude));
      const lng = typeof poi.lng === 'number' ? poi.lng : (typeof poi.lon === 'number' ? poi.lon : (typeof poi.longitude === 'number' ? poi.longitude : parseFloat(poi.lng ?? poi.lon ?? poi.longitude)));

      if(!Number.isFinite(lat) || !Number.isFinite(lng)){
        const invalidPoiLocationMsg = t(
          'checkIn.status.invalidPoiLocation',
          'Błąd danych lokalizacji miejsca. Spróbuj inne miejsce lub odśwież stronę.',
          'Invalid place location data. Try another place or refresh the page.',
        );
        setCheckInStatus(invalidPoiLocationMsg);
        window.showToast?.(invalidPoiLocationMsg, 'error');
        return;
      }

      const distance = haversineDistance(latitude, longitude, lat, lng);
      const radius = 350; // metry

      if(distance <= radius){
        try{
          const mod = await import('/js/xp.js');
          if(typeof mod.awardPoi === 'function'){
            await mod.awardPoi(poi.id);
          }
          registerVisitedPoi(user.id, poi.id);
          setCheckInButtonVisited(btn);
          shouldRestoreButton = false;
          setCheckInStatus(
            t(
              'community.checkin.success',
              '🎉 Zameldowano! Zdobyłeś XP.',
              '🎉 Checked in! You earned XP.',
            ),
          );
          window.showToast?.(
            t(
              'checkIn.status.saved',
              'Zameldowano pomyślnie!',
              'Checked in successfully!',
            ),
            'success',
          );
        } catch(e){
          const duplicateCheckIn =
            e?.code === '23505' ||
            String(e?.message || '').toLowerCase().includes('already');
          if (duplicateCheckIn) {
            registerVisitedPoi(user.id, poi.id);
            setCheckInButtonVisited(btn);
            shouldRestoreButton = false;
            setCheckInStatus(
              t(
                'currentPlace.status.alreadyVisited',
                'Już tu byłeś w tym miejscu.',
                'You have already checked in here.',
              ),
            );
            return;
          }
          console.error('[XP] awardPoi failed', e);
          const saveFailMsg = t(
            'community.checkin.failed',
            'Nie udało się zameldować. Spróbuj ponownie.',
            'Check-in failed. Please try again.',
          );
          setCheckInStatus(saveFailMsg);
          window.showToast?.(saveFailMsg, 'error');
          return;
        }
      } else {
        const km = (distance/1000).toFixed(2);
        const msg = t(
          'checkIn.status.distance',
          'Jesteś {{distance}} km od celu. Sprawdź trasę w Google Maps i potwierdź ręcznie, jeśli naprawdę jesteś na miejscu.',
          'You are about {{distance}} km from the target. Check Google Maps for directions and confirm manually if you really are on site.',
          { distance: km },
        );
        setCheckInStatus(msg);
        window.showToast?.(msg, 'info');
      }
    } catch(err){
      console.warn('checkInAtPlace error:', err);
      let msg = t(
        'checkIn.status.error',
        'Nie udało się pobrać lokalizacji. Upewnij się, że przyznałeś uprawnienia lub potwierdź ręcznie.',
        'We could not obtain your location. Make sure you granted permission or confirm manually.',
      );
      if (err && typeof err.code === 'number') {
        if (err.code === 1) {
          msg = t(
            'community.checkin.denied',
            'Brak zgody na lokalizację',
            'Location permission denied',
          );
        } else if (err.code === 2) {
          msg = t(
            'checkIn.status.unavailable',
            'Lokalizacja niedostępna (słaby sygnał).',
            'Location unavailable (weak signal).',
          );
        } else if (err.code === 3) {
          msg = t(
            'checkIn.status.timeout',
            'Upłynął limit czasu pobierania lokalizacji.',
            'Location request timed out.',
          );
        }
      } else if (err?.message?.includes('permission')) {
        msg = t(
          'community.checkin.denied',
          'Brak zgody na lokalizację',
          'Location permission denied',
        );
      }
      setCheckInStatus(msg);
      window.showToast?.(msg, 'error');
    } finally {
      checkInBusy = false;
      if (btn && shouldRestoreButton) {
        setCheckInButtonDefault(btn);
      }
    }
  }

  function haversineDistance(lat1, lon1, lat2, lon2){
    const toRad = v => (v * Math.PI) / 180;
    const R = 6371e3; // meters
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function setupObserver(){
    if(observing) return;
    const list = document.getElementById('poisList');
    if(!list) return;

    const entriesMap = new Map();
    observer = new IntersectionObserver((entries)=>{
      for(const e of entries){
        const id = e.target.dataset.poiId;
        entriesMap.set(id, e.intersectionRatio);
      }
      let bestId = null; let best = 0;
      entriesMap.forEach((ratio,id)=>{ if(ratio>best){ best=ratio; bestId=id; } });
      if(bestId) setCurrentPlace(bestId, {force:false, focus:false});
    }, {root: null, threshold:[0.25,0.5,0.75,1]});

    Array.from(list.querySelectorAll('.poi-card')).forEach(el=>observer.observe(el));
    observing = true;

    const firstId = getOrderedPoiIds()[0];
    if(firstId) setCurrentPlace(firstId, {force:true, focus:false});
  }

  function waitForListThenSetup(){
    // If list exists and has cards, observe it; otherwise select the first POI
    const tryInit = () => {
      const list = document.getElementById('poisList');
      const hasCards = list && list.querySelector('.poi-card');
      if(hasCards){
        setupObserver();
        return true;
      }
      // No list on this page – select the first POI from PLACES_DATA and update panel + map
      const firstId = getOrderedPoiIds()[0];
      if(firstId){
        setCurrentPlace(firstId, {focus:false, scroll:false, force:true});
      }
      return true;
    };

    if(tryInit()) return;

    const mo = new MutationObserver(()=>{ if(tryInit()){ mo.disconnect(); }});
    mo.observe(document.body, {childList:true, subtree:true});
  }

  window.navigatePlace = navigatePlace;
  window.showCommunity = showCommunity;
  window.openCurrentPlaceDetails = openCurrentPlaceDetails;
  window.focusCurrentMapItem = focusCurrentMapItem;
  window.checkInAtPlace = checkInAtPlace;
  // Public API for map markers to update the panel and list
  window.setCurrentPlace = function(id, opts){
    setCurrentPlace(id, Object.assign({scroll:false, force:true}, opts||{}));
  };
  window.setCurrentMapItem = function(item, opts){
    if (!item || !item.id) return;
    setCurrentPlace(item.id, Object.assign({scroll:false, force:true}, opts||{}));
  };

  window.addEventListener('mapVisibleItemsChanged', handleMapVisiblePoiIdsChanged);

  document.addEventListener('ce-auth:state', (event) => {
    const userId = normalizePoiId(event?.detail?.session?.user?.id);
    if (!userId) {
      visitedPoiCacheByUser.clear();
      visitedPoiFetchPromiseByUser.clear();
    }
    if (currentId) {
      if (currentItemType !== 'poi') {
        return;
      }
      void syncCurrentPlaceCheckInUi(currentId, { forceRefresh: true });
    }
  });

  async function initialize(){
    ceLog('🚀 home-community-bridge: initializing...');

    const data = getPlacesDataNow();
    if(data.length === 0){
      const onRefresh = () => {
        window.removeEventListener('poisDataRefreshed', onRefresh);
        initialize();
      };
      window.addEventListener('poisDataRefreshed', onRefresh);
      return;
    }

    ceLog(`✅ PLACES_DATA loaded: ${data.length} POIs`);

    if (typeof window.getVisibleMapItemsForMap === 'function') {
      const mapItems = window.getVisibleMapItemsForMap();
      if (Array.isArray(mapItems)) {
        visiblePoiIdsFromMap = mapItems
          .map((item) => normalizePoiId(item?.id))
          .filter(Boolean);
      }
    } else if (typeof window.getVisiblePoiIdsForMap === 'function') {
      const mapIds = window.getVisiblePoiIdsForMap();
      if (Array.isArray(mapIds)) {
        visiblePoiIdsFromMap = mapIds.map(normalizePoiId).filter(Boolean);
      }
    }
    
    // Auto-select first POI if not set yet
    if(!currentId){
      const firstId = getOrderedPoiIds()[0];
      if(firstId){
        ceLog('🎯 Setting initial place:', firstId);
        setCurrentPlace(firstId, {focus:false, scroll:false, force:true});
      } else {
        console.warn('⚠️ No POI IDs available');
      }
    }
    waitForListThenSetup();
    updateCurrentPlacePanelNavigationUi();
    
    ceLog('✅ home-community-bridge: initialized');
  }

  // Refresh handling when data is reloaded
  window.addEventListener('poisDataRefreshed', () => {
    if(!currentId){
      const firstId = getOrderedPoiIds()[0];
      if(firstId){
        setCurrentPlace(firstId, {focus:false, scroll:false, force:true});
      }
    }
    updateCurrentPlacePanelNavigationUi();
  });

  // Register language change handler to refresh current place display
  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler((language) => {
      ceLog('📍 POI Panel: Re-rendering for language:', language);
      if (currentId) {
        // Re-render current place with new language
        setCurrentPlace(currentId, {focus:false, scroll:false, force:true});
        ceLog('✅ POI Panel re-rendered');
      } else {
        updateCurrentPlacePanelNavigationUi();
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
