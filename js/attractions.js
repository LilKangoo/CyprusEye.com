// Attractions Catalog Renderer
// Renders PLACES_DATA into the attractions catalog page

(function(){
  'use strict';

  const RESULTS_ID = 'attractionsResultsCount';
  const CATALOG_ID = 'attractionsCatalog';
  const EMPTY_ID = 'attractionsEmptyState';
  const SEARCH_ID = 'attractionsSearch';

  function $(id){ return document.getElementById(id); }

  async function waitForPOIs(max = 100){
    for (let i=0;i<max;i++){
      if (Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length){
        return window.PLACES_DATA;
      }
      await new Promise(r=>setTimeout(r,100));
    }
    return window.PLACES_DATA || [];
  }

  function toName(p){
    return p.nameFallback || p.name || p.id || 'Unnamed';
  }

  function toDesc(p){
    return p.descriptionFallback || p.description || '';
  }

  function toBadge(p){
    return p.badgeFallback || p.badge || '';
  }

  function renderList(pois){
    const list = $(CATALOG_ID);
    const empty = $(EMPTY_ID);
    const results = $(RESULTS_ID);
    if (!list) return;

    list.innerHTML = '';

    if (!pois.length){
      if (empty) empty.hidden = false;
      if (results) results.textContent = 'Brak atrakcji do wyświetlenia';
      return;
    }

    if (empty) empty.hidden = true;
    if (results) results.textContent = `Znaleziono ${pois.length} atrakcji`;

    const frag = document.createDocumentFragment();
    pois.forEach(p => {
      const li = document.createElement('li');
      li.className = 'attraction-card';
      const name = toName(p);
      const desc = toDesc(p);
      const badge = toBadge(p);
      const xp = p.xp || 0;
      const maps = p.googleMapsUrl || p.googleMapsURL || `https://maps.google.com/?q=${p.lat},${p.lng}`;
      li.innerHTML = `
        <article class="attraction">
          <header class="attraction-header">
            <h3 class="attraction-title">${name}</h3>
            <p class="attraction-meta">${badge ? `🏷️ ${badge} • ` : ''}✨ ${xp} XP</p>
          </header>
          <p class="attraction-desc">${desc}</p>
          <div class="attraction-actions">
            <a class="btn btn-sm" href="index.html?focus=${encodeURIComponent(p.id)}" aria-label="Pokaż na mapie">📍 Pokaż na mapie</a>
            <a class="ghost btn-sm" href="${maps}" target="_blank" rel="noopener">Google Maps →</a>
            <button type="button" class="btn btn-sm" data-action="comments" data-poi-id="${p.id}">💬 Komentarze</button>
          </div>
        </article>
      `;
      frag.appendChild(li);
    });

    list.appendChild(frag);

    // Wire comments buttons
    list.querySelectorAll('button[data-action="comments"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pid = btn.getAttribute('data-poi-id');
        if (pid && typeof window.openPoiComments === 'function') {
          window.openPoiComments(pid);
        }
      });
    });
  }

  function applySearch(pois){
    const input = $(SEARCH_ID);
    if (!input) return;

    const doFilter = () => {
      const q = input.value.trim().toLowerCase();
      if (!q){ renderList(pois); return; }
      const filtered = pois.filter(p => {
        const name = toName(p).toLowerCase();
        const desc = toDesc(p).toLowerCase();
        const badge = toBadge(p).toLowerCase();
        return name.includes(q) || desc.includes(q) || badge.includes(q);
      });
      renderList(filtered);
    };

    input.addEventListener('input', doFilter);
  }

  async function init(){
    // Only run on attractions page
    if (document.body?.dataset?.seoPage !== 'attractions') return;

    // Wait for data
    const initial = await waitForPOIs();
    if (initial && initial.length){
      renderList(initial);
      applySearch(initial);
    }

    // Listen for refresh events
    window.addEventListener('poisDataRefreshed', (e) => {
      const pois = e?.detail?.pois || window.PLACES_DATA || [];
      renderList(pois);
      applySearch(pois);
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
