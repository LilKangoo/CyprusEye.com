/**
 * RECOMMENDATIONS PAGE - CYPRUSEYE QUEST
 * Public-facing recommendations with categories, filters, and modal
 */

import { supabase } from '/js/supabaseClient.js';
import { waitForAuthReady } from '/js/authUi.js?v=4';

// ============================================================================
// STATE
// ============================================================================
let allRecommendations = [];
let allCategories = [];
let currentCategoryFilter = '';
let recommendationsModalPanoramaCleanup = null;
let recommendationsModalPanoramaHintCleanup = null;

// ============================================================================
// DEBUG
// ============================================================================
console.log('🔵 Recommendations.js loaded');
console.log('🔵 Supabase client:', supabase ? '✅ Ready' : '❌ Missing');

// ============================================================================
// LOAD DATA
// ============================================================================
async function loadData() {
  try {
    console.log('🔵 Loading recommendations data...');
    
    const loadingEl = document.getElementById('loadingState');
    const emptyEl = document.getElementById('emptyState');
    
    if (!loadingEl || !emptyEl) {
      console.error('❌ Missing DOM elements: loadingState or emptyState');
      return;
    }
    
    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';
    
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    // Load categories
    console.log('🔵 Fetching categories...');
    const { data: cats, error: catError } = await supabase
      .from('recommendation_categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });
    
    if (catError) {
      console.error('❌ Categories error:', catError);
      throw catError;
    }
    
    allCategories = cats || [];
    console.log('✅ Categories loaded:', allCategories.length, allCategories);
    
    // Load recommendations
    console.log('🔵 Fetching recommendations...');
    const { data: recs, error: recError } = await supabase
      .from('recommendations')
      .select('*, recommendation_categories(name_pl, name_en, icon, color)')
      .eq('active', true)
      .order('featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (recError) {
      console.error('❌ Recommendations error:', recError);
      throw recError;
    }
    
    allRecommendations = recs || [];
    console.log('✅ Recommendations loaded:', allRecommendations.length, allRecommendations);
    
    loadingEl.style.display = 'none';
    
    if (allRecommendations.length === 0) {
      console.log('⚠️ No recommendations found - showing empty state');
      emptyEl.style.display = 'block';
    } else {
      console.log('✅ Rendering recommendations...');
      renderCategoryFilters();
      renderRecommendations();
    }
    
  } catch (error) {
    console.error('❌ Error loading data:', error);
    const loadingEl = document.getElementById('loadingState');
    if (loadingEl) {
      const title = t('recommendations.error.title', 'Nie udało się załadować rekomendacji');
      const message = error && error.message
        ? error.message
        : t('recommendations.error.message', 'Coś poszło nie tak. Spróbuj ponownie później.');
      const retry = t('recommendations.error.retry', 'Spróbuj ponownie');
      loadingEl.innerHTML = `
        <div style="color: #ef4444; text-align: center;">
          <p>${title}</p>
          <p style="font-size: 0.875rem; color: #666; margin-top: 8px;">${message}</p>
          <button class="btn" onclick="location.reload()">${retry}</button>
        </div>
      `;
    }
  }
}

// ============================================================================
// RENDER CATEGORY FILTERS
// ============================================================================
function getCurrentLanguage() {
  const i18n = window.appI18n || {};
  return i18n.language || document.documentElement.lang || 'pl';
}

function t(key, fallback) {
  try {
    const i18n = window.appI18n || {};
    const lang = i18n.language || document.documentElement.lang || 'pl';
    const translations = (i18n.translations && i18n.translations[lang]) || {};
    const entry = translations[key];
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string') return entry.text;
      if (typeof entry.html === 'string') return entry.html;
    }
  } catch (e) {
    console.warn('recommendations.t error', e);
  }
  return fallback;
}

function getRecommendationMediaDisplayUrl(url) {
  if (window.CE_MEDIA_VIEWER?.getDisplayUrl) {
    return window.CE_MEDIA_VIEWER.getDisplayUrl(url);
  }
  return String(url || '').split('#')[0];
}

function isRecommendationPanorama(url) {
  if (window.CE_MEDIA_VIEWER?.isPanorama) {
    return window.CE_MEDIA_VIEWER.isPanorama(url);
  }
  return false;
}

function clearRecommendationPanoramaHint() {
  if (typeof recommendationsModalPanoramaHintCleanup === 'function') {
    try {
      recommendationsModalPanoramaHintCleanup();
    } catch (_) {
      // ignore cleanup errors
    }
  }
  recommendationsModalPanoramaHintCleanup = null;
}

function showRecommendationPanoramaHint(container, lang) {
  const hint = document.getElementById('recModalPanoramaHint');
  if (!container || !hint) return;

  clearRecommendationPanoramaHint();
  hint.textContent = lang === 'en'
    ? 'This is a 360° photo. Drag to look around. Tap once to start.'
    : 'To zdjęcie 360°. Przeciągnij, aby się rozejrzeć. Dotknij raz, aby zacząć.';
  hint.hidden = false;
  requestAnimationFrame(() => hint.classList.add('is-visible'));

  const dismiss = () => {
    hint.classList.remove('is-visible');
    hint.hidden = true;
  };

  container.addEventListener('pointerdown', dismiss, { once: true });
  recommendationsModalPanoramaHintCleanup = () => {
    container.removeEventListener('pointerdown', dismiss);
    dismiss();
  };
}

function clearRecommendationModalPanorama() {
  clearRecommendationPanoramaHint();
  const pano = document.getElementById('recModalPanorama');
  if (!pano) return;
  if (typeof recommendationsModalPanoramaCleanup === 'function') {
    try {
      recommendationsModalPanoramaCleanup();
    } catch (_) {
      // ignore cleanup errors
    }
  } else if (window.CE_MEDIA_VIEWER?.destroyPanorama) {
    window.CE_MEDIA_VIEWER.destroyPanorama(pano);
  }
  recommendationsModalPanoramaCleanup = null;
  pano.hidden = true;
  pano.dataset.cePanoramaActive = '0';
}

function renderCategoryFilters() {
  const container = document.getElementById('categoriesFilters');
  if (!container) {
    console.error('❌ Element #categoriesFilters not found');
    return;
  }
  
  console.log('🔵 Rendering category filters:', allCategories.length, 'categories');
  
  // Clear previous filters to avoid duplicates (e.g. after language change)
  container.innerHTML = '';
  
  // Update "All" count (if exists)
  const countAll = document.getElementById('count-all');
  if (countAll) {
    countAll.textContent = allRecommendations.length;
  }
  
  // Add category buttons - tylko dla kategorii z dostępnymi rekomendacjami
  let visibleCount = 0;
  const lang = getCurrentLanguage();

  allCategories.forEach(cat => {
    const count = allRecommendations.filter(r => r.category_id === cat.id).length;
    
    // Pomiń kategorie bez rekomendacji
    if (count === 0) {
      return;
    }
    
    visibleCount++;
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.category = cat.id;
    btn.dataset.categoryName =
      lang === 'en' ? (cat.name_en || cat.name_pl) : (cat.name_pl || cat.name_en);
    btn.innerHTML = `
      <span class="filter-icon">${cat.icon || '📍'}</span>
      <span class="filter-label">${
        lang === 'en' ? (cat.name_en || cat.name_pl) : (cat.name_pl || cat.name_en)
      }</span>
      <span class="filter-count">${count}</span>
    `;
    btn.onclick = () => filterByCategory(cat.id);
    container.appendChild(btn);
  });
  
  console.log('✅ Rendered', visibleCount, 'category filters with available recommendations');
}

// ============================================================================
// FILTER BY CATEGORY
// ============================================================================
function filterByCategory(categoryId) {
  currentCategoryFilter = categoryId;
  
  // Update active state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.category === categoryId || (!categoryId && !btn.dataset.category)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Show/hide clear button
  const clearBtn = document.getElementById('clearFilters');
  if (clearBtn) {
    clearBtn.style.display = categoryId ? 'block' : 'none';
  }
  
  renderRecommendations();
}

window.clearFilters = function() {
  filterByCategory('');
};

// ============================================================================
// RENDER RECOMMENDATIONS
// ============================================================================
function renderRecommendations() {
  const grid = document.getElementById('recommendationsGrid');
  const emptyState = document.getElementById('emptyState');
  
  if (!grid) {
    console.error('❌ Element #recommendationsGrid not found');
    return;
  }
  
  // Filter
  let filtered = allRecommendations;
  if (currentCategoryFilter) {
    filtered = allRecommendations.filter(r => r.category_id === currentCategoryFilter);
  }
  
  console.log('🔵 Rendering recommendations:', filtered.length, 'items');
  
  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'block';
    }
    return;
  }
  
  if (emptyState) {
    emptyState.style.display = 'none';
  }
  
  // Render cards
  grid.innerHTML = filtered.map(rec => createRecommendationCard(rec)).join('');
  attachPromoCodeHandlers(grid);
  console.log('✅ Recommendations rendered to DOM');
}

async function ensureLoggedIn(onAuthenticated) {
  try {
    let session = null;
    if (typeof waitForAuthReady === 'function') {
      const maybeSession = await waitForAuthReady();
      if (maybeSession && maybeSession.user) {
        session = maybeSession;
      }
    }
    const state = window.CE_STATE || {};
    if (state.session && state.session.user) {
      session = state.session;
    }
    const isLoggedIn = !!(session && session.user);
    if (isLoggedIn) {
      if (typeof onAuthenticated === 'function') {
        onAuthenticated(session);
      }
      return true;
    }
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    } else {
      const opener = document.querySelector('[data-open-auth]');
      if (opener instanceof HTMLElement) {
        opener.click();
      } else {
        console.warn('[recommendations] Auth opener not found for promo code gate.');
      }
    }
    return false;
  } catch (error) {
    console.warn('[recommendations] Error while checking auth state for promo code gate.', error);
    return false;
  }
}

function attachPromoCodeHandlers(root) {
  if (!root) return;
  const buttons = root.querySelectorAll('.rec-card-promo-toggle');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.dataset.promoReady === 'true') return;
    btn.dataset.promoReady = 'true';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlePromoToggleClick(btn);
    });
  });
}

function handlePromoToggleClick(button) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  const promoCode = button.dataset.promoCode || '';
  const recId = button.dataset.recId || '';
  if (!promoCode) {
    return;
  }
  void ensureLoggedIn(() => {
    const promoContainer = button.closest('.rec-card-promo');
    if (!(promoContainer instanceof HTMLElement)) {
      return;
    }
    const codeEl = promoContainer.querySelector('.rec-card-promo-code');
    if (!(codeEl instanceof HTMLElement)) {
      return;
    }
    if (codeEl.dataset.promoVisible === 'true') {
      return;
    }
    
    // Track promo code click
    if (recId) {
      trackClick(recId, 'promo_code');
    }
    
    codeEl.textContent = promoCode;
    codeEl.dataset.promoVisible = 'true';
  });
}

function createPromoSection(rec, lang, options = {}) {
  const discount = options.discount;
  if (!rec || !rec.promo_code || !discount) {
    return '';
  }
  const isEnglish = lang === 'en';
  const showCodeLabel = isEnglish ? 'Show code' : 'Pokaż kod';
  return `
    <div class="rec-card-promo">
      <div class="rec-card-promo-label">${discount}</div>
      <div class="rec-card-promo-code" data-promo-visible="false"></div>
      <button type="button" class="rec-btn rec-btn-secondary rec-card-promo-toggle" data-promo-code="${rec.promo_code}" data-rec-id="${rec.id}">
        ${showCodeLabel}
      </button>
    </div>
  `;
}

function createRecommendationCard(rec) {
  const category = rec.recommendation_categories || {};
  const lang = getCurrentLanguage();
  const isPolish = lang === 'pl';

  const title = isPolish
    ? (rec.title_pl || rec.title_en || 'Bez tytułu')
    : (rec.title_en || rec.title_pl || 'Untitled');

  const description = isPolish
    ? (rec.description_pl || rec.description_en || '')
    : (rec.description_en || rec.description_pl || '');

  const discount = isPolish
    ? (rec.discount_text_pl || rec.discount_text_en)
    : (rec.discount_text_en || rec.discount_text_pl);

  const featuredLabel = t(
    'recommendations.card.featured',
    isPolish ? 'Polecane' : 'Recommended'
  );
  const detailsLabel = t(
    'recommendations.card.details',
    isPolish ? 'Zobacz szczegóły' : 'View details'
  );
  const visitWebsiteLabel = t(
    'recommendations.card.visitSite',
    isPolish ? 'Strona www' : 'Visit website'
  );
  const imageUrlRaw = String(rec.image_url || '').trim();
  const imageUrl = getRecommendationMediaDisplayUrl(imageUrlRaw);
  const imageIsPanorama = isRecommendationPanorama(imageUrlRaw);
  const canRenderPanorama = Boolean(imageIsPanorama && window.CE_MEDIA_VIEWER?.mountPanorama);
  
  return `
    <div class="rec-card" onclick="openDetailModal('${rec.id}')">
      ${rec.featured ? `<div class="rec-featured-badge">⭐ ${featuredLabel}</div>` : ''}
      
      ${imageUrlRaw ? 
        `<div class="rec-media-wrap">
          ${imageIsPanorama ? '<span class="rec-panorama-badge">360°</span>' : ''}
          <img src="${imageUrl}" alt="${title}" class="rec-card-image" loading="lazy" />
        </div>` :
        '<div class="rec-card-image"></div>'
      }
      
      <div class="rec-card-content">
        <div class="rec-card-category">
          <span>${category.icon || '📍'}</span>
          <span>${
            isPolish
              ? (category.name_pl || category.name_en || 'Ogólne')
              : (category.name_en || category.name_pl || 'General')
          }</span>
        </div>
        
        <h2 class="rec-card-title">${title}</h2>
        
        ${rec.location_name ? `
          <div class="rec-card-location">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${rec.location_name}
          </div>
        ` : ''}
        
        ${description ? `
          <p class="rec-card-description">${description.substring(0, 150)}${description.length > 150 ? '...' : ''}</p>
        ` : ''}
        
        ${createPromoSection(rec, lang, { discount })}
        
        <div class="rec-card-actions">
          <button class="rec-btn rec-btn-primary" onclick="event.stopPropagation(); openDetailModal('${rec.id}')">
            ${detailsLabel}
          </button>
        </div>
        ${rec.website_url ? `
          <a href="${rec.website_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-secondary" onclick="event.stopPropagation(); trackClick('${rec.id}', 'website');">
            ${visitWebsiteLabel}
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

// ============================================================================
// MODAL
// ============================================================================
window.openDetailModal = async function(id) {
  const rec = allRecommendations.find(r => r.id === id);
  if (!rec) return;
  
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

  const openMapLabel = t(
    'recommendations.modal.openMap',
    isPolish ? 'Otwórz w mapach' : 'Open in maps'
  );
  const visitSiteLabel = t(
    'recommendations.modal.visitSite',
    isPolish ? 'Odwiedź stronę' : 'Visit website'
  );
  const offerLabel = t(
    'recommendations.modal.offerLabel',
    isPolish ? '🎁 Specjalna oferta' : '🎁 Special offer'
  );
  const imageUrlRaw = String(rec.image_url || '').trim();
  const imageUrl = getRecommendationMediaDisplayUrl(imageUrlRaw);
  const imageIsPanorama = isRecommendationPanorama(imageUrlRaw);
  
  const modalDetails = document.getElementById('modalDetails');
  modalDetails.innerHTML = `
    ${imageUrlRaw ? `
      <div class="rec-modal-media">
        <img src="${imageUrl}" alt="${title}" class="rec-modal-image" ${canRenderPanorama ? 'hidden' : ''} />
        <div id="recModalPanorama" class="rec-modal-panorama" ${canRenderPanorama ? '' : 'hidden'}></div>
        <div id="recModalPanoramaHint" class="rec-modal-panorama-hint" hidden></div>
      </div>
    ` : ''}
    
    <div class="rec-modal-content-section">
      <div class="rec-card-category" style="margin-bottom: 16px;">
        <span>${category.icon || '📍'}</span>
        <span>${categoryName || 'General'}</span>
      </div>
      
      <h1 style="font-size: 2.25rem; font-weight: 700; margin: 0 0 16px; color: #111827;">${title}</h1>
      
      ${rec.location_name ? `
        <div style="display: flex; align-items: center; gap: 8px; color: #6b7280; margin-bottom: 24px; font-size: 16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${rec.location_name}
        </div>
      ` : ''}
      
      ${description ? `
        <p style="font-size: 17px; line-height: 1.8; color: #374151; margin-bottom: 24px;">${description}</p>
      ` : ''}
      
      ${offer ? `
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #22c55e; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <strong style="color: #16a34a; font-size: 16px; display: block; margin-bottom: 8px;">${offerLabel}</strong>
          <p style="margin: 0; color: #166534; font-size: 15px; line-height: 1.6;">${offer}</p>
        </div>
      ` : ''}
      
      ${createPromoSection(rec, lang, { discount })}
      
      <div class="rec-card-actions" style="margin-bottom: 32px; gap: 16px;">
        ${rec.google_url ? `
          <a href="${rec.google_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-primary" onclick="trackClick('${rec.id}', 'google');">
            🗺️ ${openMapLabel}
          </a>
        ` : ''}
        
        ${rec.website_url ? `
          <a href="${rec.website_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'website');">
            🌐 ${visitSiteLabel}
          </a>
        ` : ''}
        
        ${rec.phone ? `
          <a href="tel:${rec.phone}" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'phone');">
            📞 ${rec.phone}
          </a>
        ` : ''}
        
        ${rec.email ? `
          <a href="mailto:${rec.email}" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'email');">
            ✉️ ${rec.email}
          </a>
        ` : ''}
      </div>
      
      ${rec.latitude && rec.longitude ? `
        <div id="modalMap" class="rec-modal-map"></div>
      ` : ''}
    </div>
  `;
  
  attachPromoCodeHandlers(modalDetails);

  // Show modal
  document.getElementById('detailModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  clearRecommendationModalPanorama();
  if (canRenderPanorama) {
    const panoramaContainer = document.getElementById('recModalPanorama');
    if (panoramaContainer && window.CE_MEDIA_VIEWER?.mountPanorama) {
      try {
        const mounted = await window.CE_MEDIA_VIEWER.mountPanorama(panoramaContainer, imageUrlRaw);
        if (mounted?.isPanorama) {
          recommendationsModalPanoramaCleanup = mounted.destroy;
          showRecommendationPanoramaHint(panoramaContainer, isPolish ? 'pl' : 'en');
        }
      } catch (error) {
        console.warn('Recommendation panorama mount failed:', error);
        const imageEl = modalDetails.querySelector('.rec-modal-image');
        if (imageEl) imageEl.hidden = false;
        panoramaContainer.hidden = true;
        panoramaContainer.dataset.cePanoramaActive = '0';
      }
    }
  }
  
  // Track view
  trackView(rec.id);
  
  // Initialize map
  if (rec.latitude && rec.longitude && typeof L !== 'undefined') {
    setTimeout(() => {
      try {
        const map = L.map('modalMap').setView([rec.latitude, rec.longitude], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        const marker = L.marker([rec.latitude, rec.longitude]).addTo(map);
        if (title) marker.bindPopup(title);
      } catch (e) {
        console.error('Map error:', e);
      }
    }, 200);
  }
};

window.closeDetailModal = function() {
  clearRecommendationModalPanorama();
  document.getElementById('detailModal').style.display = 'none';
  document.body.style.overflow = '';
};

// ============================================================================
// TRACKING
// ============================================================================
window.trackView = async function(recId) {
  if (!supabase) return;
  try {
    await supabase.from('recommendation_views').insert([{ 
      recommendation_id: recId 
    }]);
    console.log('✅ View tracked:', recId);
  } catch (e) {
    console.error('Track view error:', e);
  }
}

window.trackClick = async function(recId, type) {
  if (!supabase) return;
  try {
    await supabase.from('recommendation_clicks').insert([{ 
      recommendation_id: recId,
      click_type: type
    }]);
    console.log('✅ Click tracked:', recId, type);
  } catch (e) {
    console.error('Track click error:', e);
  }
};

// ==========================================================================
// LANGUAGE CHANGE HANDLER
// ==========================================================================
document.addEventListener('wakacjecypr:languagechange', () => {
  if (!allRecommendations.length) {
    return;
  }
  try {
    renderCategoryFilters();
    renderRecommendations();
  } catch (error) {
    console.error('Error re-rendering recommendations after language change:', error);
  }
});

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Recommendations page initialized');
  loadData();
});
