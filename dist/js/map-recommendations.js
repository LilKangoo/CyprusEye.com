/**
 * MAP RECOMMENDATIONS - CyprusEye
 * Zielone znaczniki rekomendacji na mapie głównej
 */

// ============================================================================
// STATE
// ============================================================================
let mapRecommendations = [];
let recommendationMarkers = new Map();
let recommendationModalOpen = false;
let recommendationMapInstance = null;
let recommendationMarkersVisible = true;
let pendingPromoReveal = null;
let promoAuthStateListenerAttached = false;

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================
async function trackRecommendationView(recId) {
  try {
    const supabase = window.getSupabase ? window.getSupabase() : (window.sb || null);
    if (!supabase) return;
    
    await supabase.from('recommendation_views').insert([{ 
      recommendation_id: recId 
    }]);
    console.log('✅ [map-rec] View tracked:', recId);
  } catch (e) {
    console.warn('[map-rec] Track view error:', e);
  }
}

async function trackRecommendationClick(recId, clickType) {
  try {
    const supabase = window.getSupabase ? window.getSupabase() : (window.sb || null);
    if (!supabase) return;
    
    await supabase.from('recommendation_clicks').insert([{ 
      recommendation_id: recId,
      click_type: clickType
    }]);
    console.log('✅ [map-rec] Click tracked:', recId, clickType);
  } catch (e) {
    console.warn('[map-rec] Track click error:', e);
  }
}

function safeDecodeURIComponent(value) {
  if (typeof value !== 'string') {
    return '';
  }
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

async function getAuthSessionSnapshot() {
  let session = null;
  try {
    if (typeof window.waitForAuthReady === 'function') {
      const maybeSession = await window.waitForAuthReady();
      if (maybeSession && maybeSession.user) {
        session = maybeSession;
      }
    }
  } catch (_) {}

  const state = window.CE_STATE || {};
  if (state.session && state.session.user) {
    session = state.session;
  }

  return session;
}

function openAuthLoginGate() {
  try {
    if (window.__authModalController && typeof window.__authModalController.open === 'function') {
      window.__authModalController.open('login');
      return true;
    }
  } catch (_) {}

  try {
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
      return true;
    }
  } catch (_) {}

  const loginOpener =
    document.querySelector('[data-open-auth][data-auth-target="login"]') ||
    document.querySelector('[data-open-auth]');

  if (loginOpener instanceof HTMLElement) {
    loginOpener.click();
    return true;
  }

  console.warn('[map-recommendations] Auth opener not found for promo code gate.');
  return false;
}

function revealRecommendationPromoCode(id, code) {
  const normalizedId = String(id || '');
  const promoCode = String(code || '').trim();
  if (!normalizedId || !promoCode) {
    return false;
  }

  const codeEl = document.getElementById(`recPromoCode-${normalizedId}`);
  if (!(codeEl instanceof HTMLElement)) {
    return false;
  }
  if (codeEl.dataset.visible === 'true') {
    return true;
  }

  trackRecommendationClick(normalizedId, 'promo_code');
  codeEl.textContent = promoCode;
  codeEl.dataset.visible = 'true';
  codeEl.style.display = 'block';
  return true;
}

function ensurePromoAuthStateListener() {
  if (promoAuthStateListenerAttached) {
    return;
  }
  promoAuthStateListenerAttached = true;

  document.addEventListener('ce-auth:state', () => {
    if (!pendingPromoReveal) {
      return;
    }
    const user = window.CE_STATE?.session?.user || null;
    if (!user) {
      return;
    }

    const payload = pendingPromoReveal;
    pendingPromoReveal = null;
    revealRecommendationPromoCode(payload.id, payload.code);
  });
}

let greenIcon = null;

function getGreenIcon() {
  if (greenIcon) {
    return greenIcon;
  }
  if (typeof L === 'undefined' || typeof L.divIcon !== 'function') {
    return null;
  }
  greenIcon = L.divIcon({
    className: 'recommendation-marker',
    html: `<div style="
      width: 28px;
      height: 28px;
      background: #22c55e;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "><div style="
      width: 10px;
      height: 10px;
      background: #ffffff;
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
  return greenIcon;
}

function getRecommendationMarkersStats(mapInstance = recommendationMapInstance) {
  const targetMap = mapInstance || recommendationMapInstance;
  let visibleCount = 0;

  recommendationMarkers.forEach((marker) => {
    if (!marker || !recommendationMarkersVisible) {
      return;
    }
    if (!targetMap || typeof targetMap.hasLayer !== 'function') {
      return;
    }
    if (targetMap.hasLayer(marker)) {
      visibleCount += 1;
    }
  });

  return {
    total: mapRecommendations.length,
    rendered: recommendationMarkers.size,
    visible: recommendationMarkersVisible ? visibleCount : 0,
    isVisible: recommendationMarkersVisible,
  };
}

function getMapRecommendationsData() {
  return Array.isArray(mapRecommendations) ? [...mapRecommendations] : [];
}

function getVisibleRecommendationIdsForMap(mapInstance = recommendationMapInstance) {
  if (!recommendationMarkersVisible) {
    return [];
  }

  const targetMap = mapInstance || recommendationMapInstance;
  const visibleIds = [];
  recommendationMarkers.forEach((marker, recId) => {
    if (!marker) return;
    if (targetMap && typeof targetMap.hasLayer === 'function') {
      if (targetMap.hasLayer(marker)) {
        visibleIds.push(String(recId));
      }
      return;
    }
    visibleIds.push(String(recId));
  });
  return visibleIds;
}

function openRecommendationMarkerPopup(recId, mapInstance = recommendationMapInstance) {
  const marker = recommendationMarkers.get(recId);
  if (!marker) {
    return;
  }

  const targetMap = mapInstance || recommendationMapInstance;
  try {
    if (targetMap && typeof targetMap.hasLayer === 'function' && !targetMap.hasLayer(marker)) {
      marker.addTo(targetMap);
    }
    if (targetMap && typeof targetMap.setView === 'function') {
      targetMap.setView(marker.getLatLng(), Math.max(13, targetMap.getZoom() || 13), { animate: true });
    }
  } catch (_) {}
}

function dispatchRecommendationMarkersUpdate(mapInstance = recommendationMapInstance) {
  try {
    window.dispatchEvent(new CustomEvent('mapRecommendationMarkersUpdated', {
      detail: getRecommendationMarkersStats(mapInstance),
    }));
  } catch (_) {}
}

function setRecommendationMarkersVisibility(mapInstance, visible = true) {
  const targetMap = mapInstance || recommendationMapInstance;
  if (!targetMap) {
    recommendationMarkersVisible = Boolean(visible);
    dispatchRecommendationMarkersUpdate();
    return;
  }

  recommendationMarkersVisible = Boolean(visible);
  recommendationMarkers.forEach((marker) => {
    if (!marker) return;
    if (recommendationMarkersVisible) {
      if (!targetMap.hasLayer(marker)) {
        marker.addTo(targetMap);
      }
    } else if (targetMap.hasLayer(marker)) {
      targetMap.removeLayer(marker);
    }
  });
  dispatchRecommendationMarkersUpdate(targetMap);
}

// ============================================================================
// LOAD RECOMMENDATIONS
// ============================================================================
async function loadRecommendationsForMap() {
  try {
    // Get Supabase client
    const supabase = window.getSupabase ? window.getSupabase() : (window.sb || null);
    
    if (!supabase) {
      console.warn('[map-recommendations] Supabase client not available');
      return [];
    }
    
    console.log('🟢 Loading recommendations for map...');
    
    const { data, error } = await supabase
      .from('recommendations')
      .select('*, recommendation_categories(name_pl, name_en, icon, color)')
      .eq('active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    
    if (error) {
      console.warn('[map-recommendations] Error loading:', error);
      return [];
    }
    
    mapRecommendations = data || [];
    console.log(`✅ Loaded ${mapRecommendations.length} recommendations with coordinates`);
    dispatchRecommendationMarkersUpdate();
    
    return mapRecommendations;
  } catch (error) {
    console.warn('[map-recommendations] Exception:', error);
    return [];
  }
}

// ============================================================================
// SYNC MARKERS
// ============================================================================
function syncRecommendationMarkers(mapInstance) {
  const icon = getGreenIcon();
  if (!mapInstance || !icon) {
    console.warn('[map-recommendations] Map or icon not ready');
    return;
  }
  recommendationMapInstance = mapInstance;

  if (mapRecommendations.length === 0) {
    console.log('[map-recommendations] No recommendations to display');
    dispatchRecommendationMarkersUpdate(mapInstance);
    return;
  }
  
  console.log(`🟢 Syncing ${mapRecommendations.length} recommendation markers...`);
  
  mapRecommendations.forEach((rec) => {
    if (!rec.latitude || !rec.longitude) return;
    
    const hasMarker = recommendationMarkers.has(rec.id);
    if (!hasMarker) {
      const marker = L.marker([rec.latitude, rec.longitude], { icon });
      if (recommendationMarkersVisible) {
        marker.addTo(mapInstance);
      }
      marker.unbindPopup();

      marker.on('click', () => {
        if (typeof window.setCurrentMapItem === 'function') {
          window.setCurrentMapItem(
            { type: 'recommendation', id: rec.id },
            { focus: false, scroll: false, force: true }
          );
        }
      });
      
      recommendationMarkers.set(rec.id, marker);
    } else {
      const marker = recommendationMarkers.get(rec.id);
      marker.unbindPopup();
      if (recommendationMarkersVisible) {
        if (!mapInstance.hasLayer(marker)) {
          marker.addTo(mapInstance);
        }
      } else if (mapInstance.hasLayer(marker)) {
        mapInstance.removeLayer(marker);
      }
    }
  });
  
  console.log(`✅ Synced ${recommendationMarkers.size} recommendation markers`);
  dispatchRecommendationMarkersUpdate(mapInstance);
}

// ============================================================================
// CREATE POPUP
// ============================================================================
function getCurrentLanguage() {
  const i18n = window.appI18n || {};
  return i18n.language || document.documentElement.lang || 'pl';
}

function createRecommendationPopup(rec) {
  const category = rec.recommendation_categories || {};
  const lang = getCurrentLanguage();
  const isPolish = lang === 'pl';
  
  const title = isPolish
    ? (rec.title_pl || rec.title_en || 'Bez tytułu')
    : (rec.title_en || rec.title_pl || 'Untitled');
  
  const categoryName = isPolish
    ? (category.name_pl || category.name_en || '')
    : (category.name_en || category.name_pl || '');
  
  const discount = isPolish
    ? (rec.discount_text_pl || rec.discount_text_en)
    : (rec.discount_text_en || rec.discount_text_pl);
  
  const detailsLabel = isPolish ? 'Zobacz szczegóły' : 'View details';
  
  return `
    <div class="rec-map-popup" style="min-width: 220px; padding: 4px;">
      ${rec.image_url ? `
        <img src="${rec.image_url}" alt="${title}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" loading="lazy" />
      ` : ''}
      
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 12px; color: #22c55e; font-weight: 600;">
        <span>${category.icon || '🎁'}</span>
        <span>${categoryName}</span>
        ${discount ? `<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: auto;">🎁 ${discount}</span>` : ''}
      </div>
      
      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #111827; line-height: 1.3;">${title}</h3>
      
      ${rec.location_name ? `
        <div style="display: flex; align-items: center; gap: 4px; color: #6b7280; font-size: 13px; margin-bottom: 10px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${rec.location_name}
        </div>
      ` : ''}
      
      <div style="display:flex; gap:8px; align-items:center;">
        <button 
          onclick="openRecommendationDetailModal('${rec.id}')" 
          style="
            flex: 1;
            padding: 10px 16px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s;
          "
          onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(34,197,94,0.4)';"
          onmouseout="this.style.transform=''; this.style.boxShadow='';"
        >
          ${detailsLabel}
        </button>
        <button
          type="button"
          class="ce-save-star ce-save-star-sm"
          data-ce-save="1"
          data-item-type="recommendation"
          data-ref-id="${String(rec.id || '')}"
          aria-label="Zapisz"
          title="Zapisz"
          onclick="event.preventDefault(); event.stopPropagation();"
        >☆</button>
      </div>
    </div>
  `;
}

// ============================================================================
// MODAL
// ============================================================================
window.openRecommendationDetailModal = function(id) {
  const rec = mapRecommendations.find(r => r.id === id);
  if (!rec) {
    console.warn('[map-recommendations] Recommendation not found:', id);
    return;
  }
  
  const category = rec.recommendation_categories || {};
  const lang = getCurrentLanguage();
  const isPolish = lang === 'pl';
  
  const title = isPolish
    ? (rec.title_pl || rec.title_en)
    : (rec.title_en || rec.title_pl);
  
  const description = isPolish
    ? (rec.description_pl || rec.description_en)
    : (rec.description_en || rec.description_pl);
  
  const discount = isPolish
    ? (rec.discount_text_pl || rec.discount_text_en)
    : (rec.discount_text_en || rec.discount_text_pl);
  
  const offer = isPolish
    ? (rec.offer_text_pl || rec.offer_text_en)
    : (rec.offer_text_en || rec.offer_text_pl);
  
  const categoryName = isPolish
    ? (category.name_pl || category.name_en)
    : (category.name_en || category.name_pl);
  
  const openMapLabel = isPolish ? 'Otwórz w mapach' : 'Open in maps';
  const callLabel = isPolish ? 'Zadzwoń' : 'Call';
  const offerLabel = isPolish ? '🎁 Specjalna oferta' : '🎁 Special offer';
  const showCodeLabel = isPolish ? 'Pokaż kod' : 'Show code';
  
  // Create or get modal
  let modal = document.getElementById('recMapModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'recMapModal';
    modal.className = 'rec-map-modal-overlay';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="rec-map-modal-content">
      <button class="rec-map-modal-close" onclick="closeRecommendationDetailModal()">&times;</button>
      
      ${rec.image_url ? `
        <img src="${rec.image_url}" alt="${title}" class="rec-map-modal-image" />
      ` : `
        <div class="rec-map-modal-image-placeholder">
          <span style="font-size: 48px;">${category.icon || '🎁'}</span>
        </div>
      `}
      
      <div class="rec-map-modal-body">
        <div class="rec-map-modal-category">
          <span>${category.icon || '📍'}</span>
          <span>${categoryName || 'Rekomendacja'}</span>
        </div>
        
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap: 12px;">
          <h2 class="rec-map-modal-title" style="margin: 0;">${title}</h2>
          <button
            type="button"
            class="ce-save-star ce-save-star-sm"
            data-ce-save="1"
            data-item-type="recommendation"
            data-ref-id="${String(rec.id || '')}"
            aria-label="Zapisz"
            title="Zapisz"
            onclick="event.preventDefault(); event.stopPropagation();"
          >☆</button>
        </div>
        
        ${rec.location_name ? `
          <div class="rec-map-modal-location">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${rec.location_name}
          </div>
        ` : ''}
        
        ${description ? `
          <p class="rec-map-modal-description">${description}</p>
        ` : ''}
        
        ${offer ? `
          <div class="rec-map-modal-offer">
            <strong>${offerLabel}</strong>
            <p>${offer}</p>
          </div>
        ` : ''}
        
        ${(rec.promo_code && discount) ? `
          <div class="rec-map-modal-promo">
            <div class="rec-map-modal-promo-label">${discount}</div>
            <div class="rec-map-modal-promo-code" id="recPromoCode-${rec.id}" data-visible="false"></div>
            <button
              type="button"
              class="rec-map-modal-promo-btn"
              data-rec-id="${String(rec.id || '')}"
              data-promo-code="${encodeURIComponent(String(rec.promo_code || ''))}"
            >
              ${showCodeLabel}
            </button>
          </div>
        ` : ''}
        
        <div class="rec-map-modal-actions">
          ${rec.google_url ? `
            <a href="${rec.google_url}" target="_blank" rel="noopener" class="rec-map-modal-btn rec-map-modal-btn-primary" onclick="trackRecommendationClick('${rec.id}', 'google')">
              🗺️ ${openMapLabel}
            </a>
          ` : ''}
          
          ${rec.phone ? `
            <a href="tel:${rec.phone}" class="rec-map-modal-btn rec-map-modal-btn-secondary" onclick="trackRecommendationClick('${rec.id}', 'phone')">
              📞 ${rec.phone}
            </a>
          ` : ''}
        </div>
        
        ${(rec.latitude && rec.longitude) ? `
          <div id="recMapModalMiniMap" class="rec-map-modal-minimap"></div>
        ` : ''}
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  recommendationModalOpen = true;

  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
      window.CE_SAVED_CATALOG.refreshButtons(modal);
    }
  } catch (_) {}

  const promoBtn = modal.querySelector('.rec-map-modal-promo-btn');
  if (promoBtn instanceof HTMLButtonElement) {
    promoBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const recId = promoBtn.dataset.recId || '';
      const promoCode = safeDecodeURIComponent(promoBtn.dataset.promoCode || '');
      void window.showRecommendationPromoCode(recId, promoCode);
    });
  }
  
  // Track view
  trackRecommendationView(rec.id);
  
  // Initialize mini map
  if (rec.latitude && rec.longitude && typeof L !== 'undefined') {
    setTimeout(() => {
      try {
        const miniMapEl = document.getElementById('recMapModalMiniMap');
        if (miniMapEl && !miniMapEl._leaflet_id) {
          const miniMap = L.map('recMapModalMiniMap', { 
            zoomControl: true,
            scrollWheelZoom: false
          }).setView([rec.latitude, rec.longitude], 15);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(miniMap);
          
          L.marker([rec.latitude, rec.longitude], { icon: greenIcon }).addTo(miniMap);
        }
      } catch (e) {
        console.warn('[map-recommendations] Mini map error:', e);
      }
    }, 300);
  }
  
  // Close on escape
  document.addEventListener('keydown', handleModalEscape);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeRecommendationDetailModal();
    }
  });
};

function handleModalEscape(e) {
  if (e.key === 'Escape' && recommendationModalOpen) {
    closeRecommendationDetailModal();
  }
}

window.closeRecommendationDetailModal = function() {
  const modal = document.getElementById('recMapModal');
  if (modal) {
    modal.style.display = 'none';
  }
  document.body.style.overflow = '';
  recommendationModalOpen = false;
  document.removeEventListener('keydown', handleModalEscape);
};

window.showRecommendationPromoCode = async function(id, code) {
  const normalizedId = String(id || '');
  const promoCode = String(code || '').trim();
  if (!normalizedId || !promoCode) {
    return false;
  }

  const session = await getAuthSessionSnapshot();
  const isLoggedIn = !!(session && session.user);
  if (!isLoggedIn) {
    ensurePromoAuthStateListener();
    pendingPromoReveal = { id: normalizedId, code: promoCode };
    openAuthLoginGate();
    return false;
  }

  return revealRecommendationPromoCode(normalizedId, promoCode);
};

// ============================================================================
// INIT
// ============================================================================
async function initMapRecommendations(mapInstance) {
  if (!mapInstance) {
    console.warn('[map-recommendations] No map instance provided');
    return;
  }
  
  await loadRecommendationsForMap();
  syncRecommendationMarkers(mapInstance);
  setRecommendationMarkersVisibility(mapInstance, recommendationMarkersVisible);
}

// Export for use in app.js
window.initMapRecommendations = initMapRecommendations;
window.syncRecommendationMarkers = syncRecommendationMarkers;
window.loadRecommendationsForMap = loadRecommendationsForMap;
window.trackRecommendationClick = trackRecommendationClick;
window.trackRecommendationView = trackRecommendationView;
window.setRecommendationMarkersVisibility = setRecommendationMarkersVisibility;
window.getRecommendationMarkersStats = getRecommendationMarkersStats;
window.getMapRecommendationsData = getMapRecommendationsData;
window.getVisibleRecommendationIdsForMap = getVisibleRecommendationIdsForMap;
window.openRecommendationMarkerPopup = openRecommendationMarkerPopup;
