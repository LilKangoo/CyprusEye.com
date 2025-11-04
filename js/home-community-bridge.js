(function(){
  'use strict';

  let currentId = null;
  let observer = null;
  let observing = false;

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

    if(nameEl) nameEl.textContent = poi.nameFallback || poi.name || '—';
    if(descEl) descEl.textContent = poi.descriptionFallback || poi.description || 'Cypr';
    if(xpEl) xpEl.textContent = (poi.xp||0) + ' XP';
    if(commentsEl) commentsEl.textContent = '—';
    if(ratingEl) ratingEl.textContent = '—';

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

  function checkInAtPlace(){
    if(window.showToast){
      window.showToast('Check-in wkrótce dostępny', 'info');
    }
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

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', waitForListThenSetup);
  } else {
    waitForListThenSetup();
  }
})();
