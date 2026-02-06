(function(){
  'use strict';

  const CE_DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true';
  const ceLog = CE_DEBUG ? (...args) => console.log(...args) : () => {};

  let currentId = null;
  let observer = null;
  let observing = false;
  let statsTimer = null;
  let checkInBusy = false;

  function getOrderedPoiIds(){
    const cards = Array.from(document.querySelectorAll('#poisList .poi-card'));
    if (cards.length > 0) {
      return cards.map(c=>c.dataset.poiId).filter(Boolean);
    }
    // Fallback to PLACES_DATA order when list is not present on the page
    return (window.PLACES_DATA||[]).map(p=>p.id).filter(Boolean);
  }

  function findPoi(id){
    return (window.PLACES_DATA||[]).find(p=>p.id===id);
  }

  function getPlacesDataNow(){
    if (Array.isArray(window.PLACES_DATA)) return window.PLACES_DATA;
    return [];
  }

  function setCurrentPlace(id, options={scroll:false, focus:true}){
    if(!id) return;
    if(currentId===id && !options.force) return;
    const poi = findPoi(id);
    if(!poi) return;
    currentId = id;
    window.currentPlaceId = id;

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
    
    if(nameEl) nameEl.textContent = poiName;
    if(descEl) descEl.textContent = poiDesc;

    if (saveBtn) {
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

    // Update Counter (X / Y)
    if(counterEl) {
      const allIds = getOrderedPoiIds();
      const index = allIds.indexOf(id);
      if(index !== -1) {
        counterEl.textContent = `${index + 1} / ${allIds.length}`;
      } else {
        counterEl.textContent = '1 / 1';
      }
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
        const commentsLabel = c === 1 ? 'Komentarz' : (c >= 2 && c <= 4 ? 'Komentarze' : 'Komentarzy');
        commentsEl.textContent = `${c} ${commentsLabel}`;
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
          ratingEl.textContent = '0 Ocen';
        } else {
          const avg = Number(ratingData.average_rating) || 0;
          const ratingLabel = total === 1 ? 'ocena' : (total >= 2 && total <= 4 ? 'oceny' : 'ocen');
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
    if(ids.length===0) return;
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
    try{
      if(checkInBusy) return;
      checkInBusy = true;

      // Visual feedback on the primary action button
      btn = document.querySelector('.current-place-actions .btn.primary');
      if (btn) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-small"></span>' + (btn.textContent.trim() || 'Sprawdzanie...');
      }

      const targetId = id || currentId;
      const poi = targetId ? findPoi(targetId) : null;
      if(!poi){
        setCheckInStatus('Brak wybranej lokalizacji. Wybierz miejsce z listy lub mapy.');
        window.showToast?.('Brak wybranej lokalizacji', 'error');
        return;
      }

      let sb = window.getSupabase?.();
      if (!sb) {
        setCheckInStatus('Nie udało się połączyć z kontem. Odśwież stronę i zaloguj się, aby się zameldować.');
        window.showToast?.('Zaloguj się, aby zbierać XP za odwiedzone miejsca.', 'warning');
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
        setCheckInStatus('Zaloguj się, aby zameldować się w tym miejscu i zdobyć XP.');
        window.showToast?.('Zaloguj się lub utwórz konto, aby zbierać XP.', 'warning');
        openLoginModalIfAvailable();
        return;
      }

      // Anti-duplication: skip if already checked-in on this device
      const storageKey = `visited_poi_${poi.id}`;
      if(localStorage.getItem(storageKey)){
        setCheckInStatus('To miejsce zostało już zameldowane na tym urządzeniu.');
        window.showToast?.('Już zameldowano to miejsce na tym urządzeniu', 'info');
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
        // 2) Brak świeżej lokalizacji – użyj geolokalizacji przeglądarki
        if(!('geolocation' in navigator)){
          setCheckInStatus('Twoja przeglądarka nie wspiera geolokalizacji. Zbliż się do miejsca i spróbuj ponownie.');
          window.showToast?.('Twoja przeglądarka nie wspiera geolokalizacji. Zbliż się do miejsca i spróbuj ponownie.', 'warning');
          return;
        }

        setCheckInStatus('Sprawdzam Twoją lokalizację... (to może chwilę potrwać)');

        let position;
        try {
          // First attempt: high accuracy (GPS)
          position = await getPosition(true);
        } catch (firstError) {
          console.warn('High accuracy geolocation failed, trying low accuracy...', firstError);
          setCheckInStatus('Słaby sygnał GPS, próbuję przybliżoną lokalizację...');
          // Second attempt: lower accuracy (WiFi / GSM)
          position = await getPosition(false);
        }

        if (!position || !position.coords) {
          setCheckInStatus('Nie udało się pobrać lokalizacji. Spróbuj ponownie lub użyj innego urządzenia.');
          window.showToast?.('Nie udało się pobrać lokalizacji. Spróbuj ponownie.', 'error');
          return;
        }

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }
      // Normalizuj współrzędne POI
      const lat = typeof poi.lat === 'number' ? poi.lat : (typeof poi.latitude === 'number' ? poi.latitude : parseFloat(poi.lat ?? poi.latitude));
      const lng = typeof poi.lng === 'number' ? poi.lng : (typeof poi.lon === 'number' ? poi.lon : (typeof poi.longitude === 'number' ? poi.longitude : parseFloat(poi.lng ?? poi.lon ?? poi.longitude)));

      if(!Number.isFinite(lat) || !Number.isFinite(lng)){
        setCheckInStatus('Błąd danych lokalizacji miejsca. Spróbuj inne miejsce lub odśwież stronę.');
        window.showToast?.('Błąd danych lokalizacji miejsca', 'error');
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
          localStorage.setItem(storageKey, Date.now().toString());
          setCheckInStatus('Gratulacje! Jesteś na miejscu i otrzymasz XP za to miejsce.');
          window.showToast?.('Gratulacje! Zamelodowałeś się i otrzymasz XP.', 'success');
        } catch(e){
          console.error('[XP] awardPoi failed', e);
          setCheckInStatus('Nie udało się zapisać zameldowania w systemie. Spróbuj ponownie po chwili.');
          window.showToast?.('Nie udało się zapisać w systemie. Sprawdź połączenie lub zalogowanie.', 'error');
          return;
        }
      } else {
        const km = (distance/1000).toFixed(2);
        const msg = `Jesteś ok. ${km} km od celu. Zbliż się do miejsca, aby się zameldować.`;
        setCheckInStatus(msg);
        window.showToast?.(msg, 'info');
      }
    } catch(err){
      console.warn('checkInAtPlace error:', err);
      let msg = 'Nie udało się pobrać lokalizacji.';
      if (err && typeof err.code === 'number') {
        if (err.code === 1) msg = 'Brak zgody na lokalizację. Udziel zgody w przeglądarce i spróbuj ponownie.';
        else if (err.code === 2) msg = 'Lokalizacja niedostępna (słaby sygnał). Spróbuj podejść bliżej okna lub na zewnątrz.';
        else if (err.code === 3) msg = 'Upłynął limit czasu pobierania lokalizacji. Spróbuj ponownie.';
      } else if (err?.message?.includes('permission')) {
        msg = 'Udziel zgody na dostęp do lokalizacji i spróbuj ponownie.';
      }
      setCheckInStatus(msg);
      window.showToast?.(msg, 'error');
    } finally {
      checkInBusy = false;
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
          btn.innerHTML = btn.dataset.originalHtml;
        }
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
      if(bestId) setCurrentPlace(bestId, {force:false});
    }, {root: null, threshold:[0.25,0.5,0.75,1]});

    Array.from(list.querySelectorAll('.poi-card')).forEach(el=>observer.observe(el));
    observing = true;

    const firstId = getOrderedPoiIds()[0];
    if(firstId) setCurrentPlace(firstId, {force:true});
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
        setCurrentPlace(firstId, {focus:true, scroll:false, force:true});
      }
      return true;
    };

    if(tryInit()) return;

    const mo = new MutationObserver(()=>{ if(tryInit()){ mo.disconnect(); }});
    mo.observe(document.body, {childList:true, subtree:true});
  }

  window.navigatePlace = navigatePlace;
  window.showCommunity = showCommunity;
  window.checkInAtPlace = checkInAtPlace;
  // Public API for map markers to update the panel and list
  window.setCurrentPlace = function(id, opts){
    setCurrentPlace(id, Object.assign({scroll:false, force:true}, opts||{}));
  };

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
    
    // Auto-select first POI if not set yet
    if(!currentId){
      const firstId = getOrderedPoiIds()[0];
      if(firstId){
        ceLog('🎯 Setting initial place:', firstId);
        setCurrentPlace(firstId, {focus:true, scroll:false, force:true});
      } else {
        console.warn('⚠️ No POI IDs available');
      }
    }
    waitForListThenSetup();
    
    ceLog('✅ home-community-bridge: initialized');
  }

  // Refresh handling when data is reloaded
  window.addEventListener('poisDataRefreshed', () => {
    if(!currentId){
      const firstId = getOrderedPoiIds()[0];
      if(firstId){
        setCurrentPlace(firstId, {focus:true, scroll:false, force:true});
      }
    }
  });

  // Register language change handler to refresh current place display
  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler((language) => {
      ceLog('📍 POI Panel: Re-rendering for language:', language);
      if (currentId) {
        // Re-render current place with new language
        setCurrentPlace(currentId, {focus:false, scroll:false, force:true});
        ceLog('✅ POI Panel re-rendered');
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
