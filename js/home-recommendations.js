/**
 * HOME RECOMMENDATIONS - CyprusEye
 * Sekcja rekomendacji na stronie głównej (layout 1 kolumna)
 */

import { supabase } from '/js/supabaseClient.js';
import { waitForAuthReady } from '/js/authUi.js';

// ============================================================================
// STATE
// ============================================================================
let allRecommendations = [];
let allCategories = [];
let currentCategoryFilter = '';
let homeRecommendationsSavedOnly = false;

let homeRecCarouselUpdate = null;

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔵 Home Recommendations: Initializing...');
  loadData();
  setupLanguageListener();
  initHomeRecommendationsCarousel();

  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.subscribe === 'function') {
      window.CE_SAVED_CATALOG.subscribe(() => {
        if (homeRecommendationsSavedOnly) {
          renderRecommendations();
        }
      });
    }
  } catch (_) {}
});

function initHomeRecommendationsCarousel() {
  const prev = document.querySelector('.home-carousel-container .home-carousel-nav.prev[data-target="#recommendationsHomeGrid"]');
  const next = document.querySelector('.home-carousel-container .home-carousel-nav.next[data-target="#recommendationsHomeGrid"]');
  const grid = document.getElementById('recommendationsHomeGrid');
  if (!prev || !next || !grid) return;
  if (grid.dataset.carouselInit === 'true') return;
  grid.dataset.carouselInit = 'true';

  const scrollBy = () => Math.round(grid.clientWidth * 0.85);
  const updateArrows = () => {
    const maxScroll = grid.scrollWidth - grid.clientWidth - 1;
    const atStart = grid.scrollLeft <= 1;
    const atEnd = grid.scrollLeft >= maxScroll;
    prev.hidden = atStart;
    next.hidden = atEnd;
    const noOverflow = grid.scrollWidth <= grid.clientWidth + 1;
    if (noOverflow) {
      prev.hidden = true;
      next.hidden = true;
    }
  };
  homeRecCarouselUpdate = updateArrows;

  prev.addEventListener('click', () => {
    grid.scrollBy({ left: -scrollBy(), behavior: 'smooth' });
    setTimeout(updateArrows, 350);
  });
  next.addEventListener('click', () => {
    grid.scrollBy({ left: scrollBy(), behavior: 'smooth' });
    setTimeout(updateArrows, 350);
  });
  grid.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
}

// ============================================================================
// LANGUAGE CHANGE LISTENER
// ============================================================================
function setupLanguageListener() {
  // Listen for languageChanged event (from languageSwitcher.js)
  window.addEventListener('languageChanged', (e) => {
    console.log('🌐 Home recommendations: Language changed to', e.detail?.language);
    renderCategoryFilters();
    renderRecommendations();
  });
  
  // Also listen for wakacjecypr:languagechange (backup)
  document.addEventListener('wakacjecypr:languagechange', (e) => {
    console.log('🌐 Home recommendations: Language changed (wakacjecypr) to', e.detail?.language);
    renderCategoryFilters();
    renderRecommendations();
  });
  
  console.log('✅ Home recommendations: Language listeners registered');
}

// ============================================================================
// LOAD DATA
// ============================================================================
async function loadData() {
  try {
    console.log('🔵 Loading recommendations data for home page...');
    
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    // Load categories
    const { data: cats, error: catError } = await supabase
      .from('recommendation_categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });
    
    if (catError) throw catError;
    
    allCategories = cats || [];
    console.log('✅ Categories loaded:', allCategories.length);
    
    // Load recommendations
    const { data: recs, error: recError } = await supabase
      .from('recommendations')
      .select('*, recommendation_categories(name_pl, name_en, icon, color)')
      .eq('active', true)
      .order('featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(60);
    
    if (recError) throw recError;
    
    allRecommendations = recs || [];
    console.log('✅ Recommendations loaded:', allRecommendations.length);
    
    if (allRecommendations.length === 0) {
      document.getElementById('recommendationsHomeGrid').innerHTML = `
        <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #9ca3af;">
          <p>Brak rekomendacji w tej chwili</p>
        </div>
      `;
    } else {
      renderCategoryFilters();
      renderRecommendations();
    }
    
  } catch (error) {
    console.error('❌ Error loading recommendations:', error);
    document.getElementById('recommendationsHomeGrid').innerHTML = `
      <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #ef4444;">
        <p>Nie udało się załadować rekomendacji</p>
      </div>
    `;
  }
}

// ============================================================================
// RENDER CATEGORY FILTERS
// ============================================================================
function getCurrentLanguage() {
  const i18n = window.appI18n || {};
  return i18n.language || document.documentElement.lang || 'pl';
}

function renderCategoryFilters() {
  const container = document.getElementById('categoriesFiltersHome');
  if (!container) return;
  
  container.innerHTML = ''; // Clear
  
  // Add category buttons - only with available recommendations
  let visibleCount = 0;
  const lang = getCurrentLanguage();

  const allLabel = lang === 'en' ? 'All' : 'Wszystkie';
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'recommendations-home-tab ce-home-pill' + (!currentCategoryFilter ? ' active' : '');
  allBtn.dataset.category = '';
  allBtn.textContent = allLabel;
  allBtn.onclick = () => filterByCategory('');
  container.appendChild(allBtn);

  allCategories.forEach(cat => {
    const count = allRecommendations.filter(r => r.category_id === cat.id).length;
    
    // Skip empty categories
    if (count === 0) return;
    
    visibleCount++;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recommendations-home-tab ce-home-pill' + (currentCategoryFilter === cat.id ? ' active' : '');
    btn.dataset.category = cat.id;
    const label =
      lang === 'en'
        ? (cat.name_en || cat.name_pl)
        : (cat.name_pl || cat.name_en);
    btn.textContent = `${cat.icon || '📍'} ${label}`;
    btn.onclick = () => filterByCategory(cat.id);
    container.appendChild(btn);
  });

  const savedLabel = lang === 'en' ? 'Saved' : 'Zapisane';
  const savedStar = homeRecommendationsSavedOnly ? '★' : '☆';
  const savedBtn = document.createElement('button');
  savedBtn.type = 'button';
  savedBtn.className = 'recommendations-home-tab ce-home-pill' + (homeRecommendationsSavedOnly ? ' active' : '');
  savedBtn.dataset.filter = 'saved';
  savedBtn.setAttribute('aria-pressed', homeRecommendationsSavedOnly ? 'true' : 'false');
  savedBtn.textContent = `${savedLabel} ${savedStar}`;
  savedBtn.onclick = () => {
    const uid = window.CE_STATE?.session?.user?.id ? String(window.CE_STATE.session.user.id) : '';
    const isAuthed = !!uid || document.documentElement?.dataset?.authState === 'authenticated';
    if (!isAuthed) {
      try {
        const openSavedAuth = window.CE_SAVED_CATALOG && window.CE_SAVED_CATALOG.openAuthModal;
        if (typeof openSavedAuth === 'function') {
          openSavedAuth('login');
        } else if (typeof window.openAuthModal === 'function') {
          window.openAuthModal('login');
        }
      } catch (_) {}
      return;
    }

    if (!homeRecommendationsSavedOnly) {
      try {
        const syncFn = window.CE_SAVED_CATALOG && window.CE_SAVED_CATALOG.syncForCurrentUser;
        if (typeof syncFn === 'function') {
          void Promise.resolve(syncFn()).finally(() => {
            homeRecommendationsSavedOnly = true;
            renderCategoryFilters();
            renderRecommendations();
          });
          return;
        }
      } catch (_) {}
    }
    homeRecommendationsSavedOnly = !homeRecommendationsSavedOnly;
    renderCategoryFilters();
    renderRecommendations();
  };
  container.appendChild(savedBtn);
  
  console.log('✅ Rendered', visibleCount, 'category filters');
}

// ============================================================================
// FILTER BY CATEGORY
// ============================================================================
function filterByCategory(categoryId) {
  currentCategoryFilter = categoryId;
  renderCategoryFilters();
  
  // Show/hide clear button
  const clearBtn = document.getElementById('clearFiltersHome');
  if (clearBtn) {
    clearBtn.style.display = categoryId ? 'block' : 'none';
  }
  
  renderRecommendations();
}

window.clearFiltersHome = function() {
  currentCategoryFilter = '';
  const clearBtn = document.getElementById('clearFiltersHome');
  if (clearBtn) clearBtn.style.display = 'none';
  renderCategoryFilters();
  renderRecommendations();
};

// ============================================================================
// RENDER RECOMMENDATIONS
// ============================================================================
function renderRecommendations() {
  const grid = document.getElementById('recommendationsHomeGrid');
  if (!grid) return;
  
  // Filter
  let filtered = allRecommendations;
  if (currentCategoryFilter) {
    filtered = allRecommendations.filter(r => r.category_id === currentCategoryFilter);
  }

  if (homeRecommendationsSavedOnly) {
    const api = window.CE_SAVED_CATALOG;
    if (api && typeof api.isSaved === 'function') {
      filtered = filtered.filter(r => api.isSaved('recommendation', String(r?.id || '')));
    } else {
      filtered = [];
    }
  }

  if (!homeRecommendationsSavedOnly) {
    filtered = filtered.slice(0, 6);
  }
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #9ca3af;">
        <p>Brak rekomendacji w wybranej kategorii</p>
      </div>
    `;
    if (typeof homeRecCarouselUpdate === 'function') homeRecCarouselUpdate();
    return;
  }
  
  // Render cards
  grid.innerHTML = filtered.map(rec => createRecommendationCard(rec)).join('');
  attachPromoCodeHandlers(grid);
  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
      window.CE_SAVED_CATALOG.refreshButtons(grid);
    }
  } catch (_) {}
  initHomeRecommendationsCarousel();
  if (typeof homeRecCarouselUpdate === 'function') homeRecCarouselUpdate();
  console.log('✅ Rendered', filtered.length, 'recommendations');
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
        console.warn('[home-recommendations] Auth opener not found for promo code gate.');
      }
    }
    return false;
  } catch (error) {
    console.warn('[home-recommendations] Error while checking auth state for promo code gate.', error);
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

  const title =
    lang === 'en'
      ? (rec.title_en || rec.title_pl || 'Untitled')
      : (rec.title_pl || rec.title_en || 'Bez tytułu');

  const featuredLabel = lang === 'en' ? 'Recommended' : 'Polecane';

  const categoryLabel =
    lang === 'en'
      ? (category.name_en || category.name_pl || 'General')
      : (category.name_pl || category.name_en || 'Ogólne');
  const subtitle = rec.location_name ? `${rec.location_name} • ${categoryLabel}` : categoryLabel;
  
  return `
    <a
      href="#"
      class="recommendation-home-card"
      onclick="openDetailModal('${rec.id}'); return false;"
    >
      ${rec.featured ? `<div class="ce-home-featured-badge">⭐ ${featuredLabel}</div>` : ''}
      <button
        type="button"
        class="ce-save-star ce-save-star-sm ce-home-card-star"
        data-ce-save="1"
        data-item-type="recommendation"
        data-ref-id="${String(rec.id || '')}"
        aria-label="Zapisz"
        title="Zapisz"
        onclick="event.preventDefault(); event.stopPropagation();"
      >☆</button>

      ${rec.image_url ?
        `<img src="${rec.image_url}" alt="${title}" loading="lazy" class="ce-home-card-image" />` :
        '<div class="ce-home-card-image ce-home-card-image--placeholder"></div>'
      }

      <div class="ce-home-card-overlay">
        <h3 class="ce-home-card-title">${title}</h3>
        <p class="ce-home-card-subtitle">${subtitle}</p>
      </div>
    </a>
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

  const title =
    lang === 'en'
      ? (rec.title_en || rec.title_pl)
      : (rec.title_pl || rec.title_en);

  const description =
    lang === 'en'
      ? (rec.description_en || rec.description_pl)
      : (rec.description_pl || rec.description_en);

  const discount =
    lang === 'en'
      ? (rec.discount_text_en || rec.discount_text_pl)
      : (rec.discount_text_pl || rec.discount_text_en);

  const offer =
    lang === 'en'
      ? (rec.offer_text_en || rec.offer_text_pl)
      : (rec.offer_text_pl || rec.offer_text_en);

  const categoryName =
    lang === 'en'
      ? (category.name_en || category.name_pl)
      : (category.name_pl || category.name_en);

  const openMapLabel = lang === 'en' ? 'Open in maps' : 'Otwórz w mapach';
  const visitSiteLabel = lang === 'en' ? 'Visit website' : 'Strona www';
  
  const modalDetails = document.getElementById('modalDetails');
  if (!modalDetails) return;
  
  modalDetails.innerHTML = `
    ${rec.image_url ? `
      <img src="${rec.image_url}" alt="${title}" class="rec-modal-image" />
    ` : ''}
    
    <div class="rec-modal-content-section">
      <div class="rec-card-category" style="margin-bottom: 16px;">
        <span>${category.icon || '📍'}</span>
        <span>${categoryName || 'General'}</span>
      </div>
      
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin: 0 0 16px;">
        <h1 style="font-size: 2.25rem; font-weight: 700; margin: 0; color: #111827;">${title}</h1>
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
          <strong style="color: #16a34a; font-size: 16px; display: block; margin-bottom: 8px;">🎁 Special Offer</strong>
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

  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
      window.CE_SAVED_CATALOG.refreshButtons(modalDetails);
    }
  } catch (_) {}
  
  // Show modal
  const modal = document.getElementById('detailModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  
  // Track view
  trackView(rec.id);
  
  // Initialize map
  if (rec.latitude && rec.longitude && typeof L !== 'undefined') {
    setTimeout(() => {
      try {
        const mapEl = document.getElementById('modalMap');
        if (!mapEl) return;
        
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
  const modal = document.getElementById('detailModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
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
