/**
 * RECOMMENDATIONS PAGE - CYPRUSEYE
 * Public recommendations display
 */

let allRecommendations = [];
let categories = [];
let supabase = null;

// Get Supabase client
function getSupabaseClient() {
  if (typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }
  if (window.sb) return window.sb;
  if (window.__SB__) return window.__SB__;
  return null;
}

// Wait for Supabase
async function waitForSupabase() {
  return new Promise((resolve) => {
    const check = () => {
      supabase = getSupabaseClient();
      if (supabase) {
        resolve(supabase);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// Load recommendations
async function loadRecommendations() {
  try {
    await waitForSupabase();
    
    const { data: cats, error: catError } = await supabase
      .from('recommendation_categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });
    
    if (catError) throw catError;
    categories = cats || [];
    
    const { data: recs, error: recError } = await supabase
      .from('recommendations')
      .select('*, recommendation_categories(name_en, icon, color)')
      .eq('active', true)
      .order('display_order', { ascending: true })
      .order('priority', { ascending: false});
    
    if (recError) throw recError;
    allRecommendations = recs || [];
    
    document.getElementById('loadingState').style.display = 'none';
    
    if (allRecommendations.length === 0) {
      document.getElementById('emptyState').style.display = 'block';
    } else {
      renderCategoryFilters();
      renderRecommendations();
    }
    
  } catch (error) {
    console.error('Error loading:', error);
    document.getElementById('loadingState').innerHTML = '<p style="color: red;">Failed to load</p>';
  }
}

// Render category filters
function renderCategoryFilters() {
  const filterSection = document.querySelector('.filter-section');
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.category = cat.id;
    btn.textContent = cat.name_en;
    btn.onclick = () => filterByCategory(cat.id);
    filterSection.appendChild(btn);
  });
}

// Filter by category
function filterByCategory(categoryId) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.category === categoryId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  renderRecommendations(categoryId);
}

// Render recommendations
function renderRecommendations(categoryFilter = '') {
  const grid = document.getElementById('recommendationsGrid');
  
  let filtered = allRecommendations;
  if (categoryFilter) {
    filtered = allRecommendations.filter(r => r.category_id === categoryFilter);
  }
  
  grid.innerHTML = filtered.map(rec => {
    const category = rec.recommendation_categories || {};
    const title = rec.title_en;
    const description = rec.description_en;
    const discount = rec.discount_text_en;
    
    return `
      <div class="rec-card" onclick="openModal('${rec.id}')">
        ${rec.featured ? '<div class="rec-featured-badge">⭐ Featured</div>' : ''}
        
        ${rec.image_url ? 
          `<img src="${rec.image_url}" alt="${title}" class="rec-card-image" />` :
          '<div class="rec-card-image"></div>'
        }
        
        <div class="rec-card-content">
          <div class="rec-card-category">
            <span>${category.name_en || 'General'}</span>
          </div>
          
          <h2 class="rec-card-title">${title}</h2>
          
          <div class="rec-card-location">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${rec.location_name}
          </div>
          
          <p class="rec-card-description">${description.substring(0, 120)}${description.length > 120 ? '...' : ''}</p>
          
          ${rec.promo_code || discount ? `
            <div class="rec-card-promo">
              ${discount ? `<div>${discount}</div>` : ''}
              ${rec.promo_code ? `<div class="rec-card-promo-code">Code: ${rec.promo_code}</div>` : ''}
            </div>
          ` : ''}
          
          <div class="rec-card-actions">
            ${rec.google_url ? `
              <a href="${rec.google_url}" target="_blank" class="rec-btn rec-btn-primary" onclick="event.stopPropagation(); trackClick('${rec.id}', 'google');">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                Map
              </a>
            ` : ''}
            
            ${rec.website_url ? `
              <a href="${rec.website_url}" target="_blank" class="rec-btn rec-btn-secondary" onclick="event.stopPropagation(); trackClick('${rec.id}', 'website');">
                Website
              </a>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  filtered.forEach(rec => trackView(rec.id));
}

// Open modal
window.openModal = async function(id) {
  const rec = allRecommendations.find(r => r.id === id);
  if (!rec) return;
  
  const category = rec.recommendation_categories || {};
  const title = rec.title_en;
  const description = rec.description_en;
  const discount = rec.discount_text_en;
  const offer = rec.offer_text_en;
  
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = `
    ${rec.image_url ? `<img src="${rec.image_url}" alt="${title}" class="rec-modal-image" />` : ''}
    
    <div class="rec-modal-body">
      <div class="rec-card-category" style="margin-bottom: 12px;">
        ${category.name_en || 'General'}
      </div>
      
      <h1 style="font-size: 2rem; font-weight: 700; margin: 0 0 12px;">${title}</h1>
      
      <div style="display: flex; align-items: center; gap: 8px; color: #6b7280; margin-bottom: 20px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        ${rec.location_name}
      </div>
      
      <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-bottom: 20px;">${description}</p>
      
      ${offer ? `
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <strong style="color: #16a34a;">Special Offer:</strong>
          <p style="margin: 8px 0 0; color: #166534;">${offer}</p>
        </div>
      ` : ''}
      
      ${rec.promo_code || discount ? `
        <div class="rec-card-promo" style="margin-bottom: 20px;">
          ${discount ? `<div>${discount}</div>` : ''}
          ${rec.promo_code ? `<div class="rec-card-promo-code">Code: ${rec.promo_code}</div>` : ''}
        </div>
      ` : ''}
      
      <div class="rec-card-actions" style="margin-bottom: 24px;">
        ${rec.google_url ? `
          <a href="${rec.google_url}" target="_blank" class="rec-btn rec-btn-primary" onclick="trackClick('${rec.id}', 'google');">
            Open in Maps
          </a>
        ` : ''}
        
        ${rec.website_url ? `
          <a href="${rec.website_url}" target="_blank" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'website');">
            Visit Website
          </a>
        ` : ''}
        
        ${rec.phone ? `
          <a href="tel:${rec.phone}" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'phone');">
            ${rec.phone}
          </a>
        ` : ''}
      </div>
      
      ${rec.latitude && rec.longitude ? `
        <div id="modalMap" class="rec-modal-map"></div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('recModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  
  if (rec.latitude && rec.longitude) {
    setTimeout(() => {
      const map = L.map('modalMap').setView([rec.latitude, rec.longitude], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);
      L.marker([rec.latitude, rec.longitude]).addTo(map);
    }, 100);
  }
};

// Close modal
window.closeModal = function() {
  document.getElementById('recModal').classList.remove('active');
  document.body.style.overflow = '';
};

// Track view
async function trackView(recId) {
  try {
    await supabase.from('recommendation_views').insert([{ recommendation_id: recId }]);
  } catch (e) {
    console.error('Track view error:', e);
  }
}

// Track click
window.trackClick = async function(recId, type) {
  try {
    await supabase.from('recommendation_clicks').insert([{ 
      recommendation_id: recId,
      click_type: type
    }]);
  } catch (e) {
    console.error('Track click error:', e);
  }
};

// Init on load
document.addEventListener('DOMContentLoaded', loadRecommendations);
