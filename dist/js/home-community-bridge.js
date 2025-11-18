(function(){
  'use strict';

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

  async function waitForPlacesData(){
    for(let i=0;i<100;i++){
      if(Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length>0){
        return window.PLACES_DATA;
      }
      await new Promise(r=>setTimeout(r,100));
    }
    return window.PLACES_DATA || [];
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
    const xpEl = document.getElementById('currentPlaceXP');
    const commentsEl = document.getElementById('currentPlaceComments');
    const ratingEl = document.getElementById('currentPlaceRating');

    const poiName = window.getPoiName ? window.getPoiName(poi) : (poi.nameFallback || poi.name || '—');
    const poiDesc = window.getPoiDescription ? window.getPoiDescription(poi) : (poi.descriptionFallback || poi.description || 'Cypr');
    
    if(nameEl) nameEl.textContent = poiName;
    if(descEl) descEl.textContent = poiDesc;
    if(xpEl) xpEl.textContent = (poi.xp||0) + ' XP';
    if(commentsEl) commentsEl.textContent = '0 Komentarzy';
    if(ratingEl) ratingEl.textContent = '0 Ocen';

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
    if(typeof window.openPoiComments === 'function' && targetId){
      window.openPoiComments(targetId);
    }
  }

  async function checkInAtPlace(id){
    try{
      if(checkInBusy) return;
      checkInBusy = true;

      const targetId = id || currentId;
      const poi = targetId ? findPoi(targetId) : null;
      if(!poi){
        setCheckInStatus('Brak wybranej lokalizacji. Wybierz miejsce z listy lub mapy.');
        window.showToast?.('Brak wybranej lokalizacji', 'error');
        return;
      }

      // Anti-duplication: skip if already checked-in on this device
      const storageKey = `visited_poi_${poi.id}`;
      if(localStorage.getItem(storageKey)){
        setCheckInStatus('To miejsce zostało już zameldowane na tym urządzeniu.');
        window.showToast?.('Już zameldowano to miejsce na tym urządzeniu', 'info');
        return;
      }

      if(!('geolocation' in navigator)){
        setCheckInStatus('Twoja przeglądarka nie wspiera geolokalizacji. Zbliż się do miejsca i spróbuj ponownie.');
        window.showToast?.('Twoja przeglądarka nie wspiera geolokalizacji. Zbliż się do miejsca i spróbuj ponownie.', 'warning');
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
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
        // Mark as visited locally to prevent double award
        localStorage.setItem(storageKey, Date.now().toString());
        try{
          const mod = await import('/js/xp.js');
          if(typeof mod.awardPoi === 'function'){
            await mod.awardPoi(poi.id);
          }
        } catch(e){
          console.error('[XP] awardPoi failed', e);
        }
        setCheckInStatus('Gratulacje! Jesteś na miejscu i otrzymasz XP za to miejsce.');
        window.showToast?.('Gratulacje! Zamelodowałeś się i otrzymasz XP.', 'success');
      } else {
        const km = (distance/1000).toFixed(2);
        const msg = `Jesteś ok. ${km} km od celu. Zbliż się do miejsca, aby się zameldować.`;
        setCheckInStatus(msg);
        window.showToast?.(msg, 'info');
      }
    } catch(err){
      console.warn('checkInAtPlace error:', err);
      const msg = err?.message?.includes('permission') ? 'Udziel zgody na dostęp do lokalizacji i spróbuj ponownie.' : 'Nie udało się pobrać lokalizacji.';
      setCheckInStatus(msg);
      window.showToast?.(msg, 'error');
    } finally {
      checkInBusy = false;
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
    console.log('🚀 home-community-bridge: initializing...');
    
    const data = await waitForPlacesData();
    console.log(`✅ PLACES_DATA loaded: ${data.length} POIs`);
    
    if(data.length === 0){
      console.warn('⚠️ No PLACES_DATA available');
      return;
    }
    
    // Auto-select first POI if not set yet
    if(!currentId){
      const firstId = getOrderedPoiIds()[0];
      if(firstId){
        console.log('🎯 Setting initial place:', firstId);
        setCurrentPlace(firstId, {focus:true, scroll:false, force:true});
      } else {
        console.warn('⚠️ No POI IDs available');
      }
    }
    waitForListThenSetup();
    
    console.log('✅ home-community-bridge: initialized');
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
      console.log('📍 POI Panel: Re-rendering for language:', language);
      if (currentId) {
        // Re-render current place with new language
        setCurrentPlace(currentId, {focus:false, scroll:false, force:true});
        console.log('✅ POI Panel re-rendered');
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
