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
    <div class="rec-card" onclick="window.location.href='recommendations.html#${rec.id}'" style="cursor: pointer;">
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
          <button class="rec-btn rec-btn-primary" onclick="event.stopPropagation(); window.location.href='recommendations.html#${rec.id}'">
            Zobacz szczegóły
          </button>
          ${rec.website_url ? `
            <a href="${rec.website_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-secondary" onclick="event.stopPropagation();">
              Strona www
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
