/**
 * HOME RECOMMENDATIONS - CyprusEye
 * Sekcja rekomendacji na stronie głównej (layout 1 kolumna)
 */

import { supabase } from '/js/supabaseClient.js';

// ============================================================================
// STATE
// ============================================================================
let allRecommendations = [];
let allCategories = [];
let currentCategoryFilter = '';

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔵 Home Recommendations: Initializing...');
  loadData();
});

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
      .limit(6); // Limit to 6 recommendations on home page
    
    if (recError) throw recError;
    
    allRecommendations = recs || [];
    console.log('✅ Recommendations loaded:', allRecommendations.length);
    
    if (allRecommendations.length === 0) {
      document.getElementById('recommendationsHomeGrid').innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
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
      <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
        <p>Nie udało się załadować rekomendacji</p>
      </div>
    `;
  }
}

// ============================================================================
// RENDER CATEGORY FILTERS
// ============================================================================
function renderCategoryFilters() {
  const container = document.getElementById('categoriesFiltersHome');
  if (!container) return;
  
  container.innerHTML = ''; // Clear
  
  // Add category buttons - only with available recommendations
  let visibleCount = 0;
  allCategories.forEach(cat => {
    const count = allRecommendations.filter(r => r.category_id === cat.id).length;
    
    // Skip empty categories
    if (count === 0) return;
    
    visibleCount++;
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.category = cat.id;
    btn.innerHTML = `
      <span class="filter-icon">${cat.icon || '📍'}</span>
      <span class="filter-label">${cat.name_pl || cat.name_en}</span>
      <span class="filter-count">${count}</span>
    `;
    btn.onclick = () => filterByCategory(cat.id);
    container.appendChild(btn);
  });
  
  console.log('✅ Rendered', visibleCount, 'category filters');
}

// ============================================================================
// FILTER BY CATEGORY
// ============================================================================
function filterByCategory(categoryId) {
  currentCategoryFilter = categoryId;
  
  // Update active state
  document.querySelectorAll('#categoriesFiltersHome .filter-btn').forEach(btn => {
    if (btn.dataset.category === categoryId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Show/hide clear button
  const clearBtn = document.getElementById('clearFiltersHome');
  if (clearBtn) {
    clearBtn.style.display = categoryId ? 'block' : 'none';
  }
  
  renderRecommendations();
}

window.clearFiltersHome = function() {
  currentCategoryFilter = '';
  document.querySelectorAll('#categoriesFiltersHome .filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const clearBtn = document.getElementById('clearFiltersHome');
  if (clearBtn) clearBtn.style.display = 'none';
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
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
        <p>Brak rekomendacji w wybranej kategorii</p>
      </div>
    `;
    return;
  }
  
  // Render cards
  grid.innerHTML = filtered.map(rec => createRecommendationCard(rec)).join('');
  console.log('✅ Rendered', filtered.length, 'recommendations');
}

function createRecommendationCard(rec) {
  const category = rec.recommendation_categories || {};
  const title = rec.title_pl || rec.title_en || 'Untitled';
  const description = rec.description_pl || rec.description_en || '';
  const discount = rec.discount_text_pl || rec.discount_text_en;
  
  return `
    <div class="rec-card" onclick="openDetailModal('${rec.id}')" style="cursor: pointer;">
      ${rec.featured ? '<div class="rec-featured-badge">⭐ Polecane</div>' : ''}
      
      ${rec.image_url ? 
        `<img src="${rec.image_url}" alt="${title}" class="rec-card-image" loading="lazy" />` :
        '<div class="rec-card-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>'
      }
      
      <div class="rec-card-content">
        <div class="rec-card-category">
          <span>${category.icon || '📍'}</span>
          <span>${category.name_pl || category.name_en || 'General'}</span>
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
          <p class="rec-card-description">${description.substring(0, 120)}${description.length > 120 ? '...' : ''}</p>
        ` : ''}
        
        ${rec.promo_code && discount ? `
          <div class="rec-card-promo">
            <div class="rec-card-promo-label">${discount}</div>
            <div class="rec-card-promo-code">${rec.promo_code}</div>
          </div>
        ` : ''}
        
        <div class="rec-card-actions">
          <button class="rec-btn rec-btn-primary" onclick="event.stopPropagation(); openDetailModal('${rec.id}')">
            Zobacz szczegóły
          </button>
          ${rec.website_url ? `
            <a href="${rec.website_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-secondary" onclick="event.stopPropagation(); trackClick('${rec.id}', 'website');">
              Strona www
            </a>
          ` : ''}
        </div>
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
  const title = rec.title_pl || rec.title_en;
  const description = rec.description_pl || rec.description_en;
  const discount = rec.discount_text_pl || rec.discount_text_en;
  const offer = rec.offer_text_pl || rec.offer_text_en;
  
  const modalDetails = document.getElementById('modalDetails');
  if (!modalDetails) return;
  
  modalDetails.innerHTML = `
    ${rec.image_url ? `
      <img src="${rec.image_url}" alt="${title}" class="rec-modal-image" />
    ` : ''}
    
    <div class="rec-modal-content-section">
      <div class="rec-card-category" style="margin-bottom: 16px;">
        <span>${category.icon || '📍'}</span>
        <span>${category.name_pl || category.name_en}</span>
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
          <strong style="color: #16a34a; font-size: 16px; display: block; margin-bottom: 8px;">🎁 Special Offer</strong>
          <p style="margin: 0; color: #166534; font-size: 15px; line-height: 1.6;">${offer}</p>
        </div>
      ` : ''}
      
      ${rec.promo_code && discount ? `
        <div class="rec-card-promo" style="margin-bottom: 24px;">
          <div class="rec-card-promo-label">${discount}</div>
          <div class="rec-card-promo-code">${rec.promo_code}</div>
        </div>
      ` : ''}
      
      <div class="rec-card-actions" style="margin-bottom: 32px; gap: 16px;">
        ${rec.google_url ? `
          <a href="${rec.google_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-primary" onclick="trackClick('${rec.id}', 'google');">
            🗺️ Otwórz w mapach
          </a>
        ` : ''}
        
        ${rec.website_url ? `
          <a href="${rec.website_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'website');">
            🌐 Odwiedź stronę
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
