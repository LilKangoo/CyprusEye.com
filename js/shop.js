/**
 * Shop Module - Frontend shop functionality
 * Handles products display, cart, and checkout
 */

// State
const shopState = {
  products: [],
  categories: [],
  cart: [],
  shippingZones: [],
  shippingMethods: [],
  selectedShippingMethod: null,
  filters: {
    category: '',
    priceMin: null,
    priceMax: null,
    sort: 'newest'
  },
  pagination: {
    page: 1,
    perPage: 12,
    total: 0
  },
  lang: 'pl' // Current language
};

// Supabase client
let supabase = null;

// Get current language from localStorage or default to 'pl'
function getCurrentLang() {
  try {
    const url = new URL(window.location.href);
    const urlLang = (url.searchParams.get('lang') || '').toLowerCase();
    if (urlLang === 'pl' || urlLang === 'en') {
      return urlLang;
    }
  } catch (e) {
  }

  try {
    const candidates = [
      localStorage.getItem('ce_lang'),
      localStorage.getItem('cypruseye-language'),
      localStorage.getItem('selectedLanguage'),
    ];

    for (const candidate of candidates) {
      const normalized = (candidate || '').toLowerCase();
      if (normalized === 'pl' || normalized === 'en') {
        return normalized;
      }
    }
  } catch (e) {
  }

  const htmlLang = (document.documentElement.lang || '').toLowerCase();
  if (htmlLang === 'pl' || htmlLang === 'en') {
    return htmlLang;
  }

  return 'pl';
}

// Get localized field value - returns name_en for 'en', name for 'pl'
function getLocalizedField(item, fieldName) {
  const lang = shopState.lang;
  if (lang === 'en') {
    const enField = item[`${fieldName}_en`];
    return enField || item[fieldName] || '';
  }
  return item[fieldName] || '';
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Set current language
  shopState.lang = getCurrentLang();
  
  await initSupabase();
  loadCartFromStorage();
  await loadCategories();
  await loadProducts();
  await loadShippingZonesAndMethods();
  setupEventListeners();
  updateCartUI();
  
  // Handle checkout return status
  handleCheckoutReturn();
  
  // Sync cart with Supabase for logged-in users
  await syncCartWithSupabase();
  
  // Listen for language changes
  const handleLanguageUpdate = () => {
    shopState.lang = getCurrentLang();
    renderCategoryFilters();
    renderProducts();
    renderCartItems(); // Re-render cart with new translations
  };

  window.addEventListener('languageChanged', handleLanguageUpdate);
  document.addEventListener('wakacjecypr:languagechange', handleLanguageUpdate);
  
  // Listen for auth state changes to sync cart
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await syncCartWithSupabase();
      }
    });
  }
}

async function initSupabase() {
  // Wait for global supabase client
  if (window.supabase) {
    supabase = window.supabase;
    return;
  }

  // Try to initialize from config
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (window.supabase) {
      supabase = window.supabase;
      return;
    }
  }

  // Fallback: create client directly
  const SUPABASE_URL = window.SUPABASE_URL || 'https://daoohnbnnowmmcizgvrq.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE4NzYwMDAsImV4cCI6MjA0NzQ1MjAwMH0.mJok0sNdbpNPwVSXNTmLdphWkJfqZJLwwgVyLESkQsk';
  
  if (window.supabaseJs?.createClient) {
    supabase = window.supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

// =====================================================
// SHIPPING METHODS
// =====================================================

async function loadShippingZonesAndMethods() {
  if (!supabase) return;
  
  try {
    // Load zones with their methods
    const { data: zones, error: zonesError } = await supabase
      .from('shop_shipping_zones')
      .select('*, methods:shop_shipping_methods(*)')
      .eq('is_active', true)
      .order('sort_order');
    
    if (zonesError) throw zonesError;
    
    shopState.shippingZones = zones || [];
    
    // Flatten all methods
    shopState.shippingMethods = zones?.flatMap(zone => 
      (zone.methods || []).filter(m => m.is_active).map(method => ({
        ...method,
        zone_name: zone.name,
        zone_name_en: zone.name_en,
        zone_countries: zone.countries
      }))
    ) || [];
    
  } catch (error) {
    console.error('Failed to load shipping methods:', error);
  }
}

function getShippingMethodsForCountry(countryCode) {
  if (!countryCode) return [];
  
  // When user selects "Other" show every available shipping method
  if (countryCode === 'OTHER') {
    return [...shopState.shippingMethods].sort((a, b) => (a.cost || 0) - (b.cost || 0));
  }
  
  const euCountries = ['AT','BE','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  
  return shopState.shippingMethods.filter(method => {
    const countries = method.zone_countries || [];
    // Check if country matches zone
    if (countries.includes(countryCode)) return true;
    // Check EU zone
    if (countries.includes('EU') && euCountries.includes(countryCode)) return true;
    // Check international (wildcard)
    if (countries.includes('*')) return true;
    return false;
  }).sort((a, b) => (a.cost || 0) - (b.cost || 0));
}

function updateShippingMethodsDropdown(countryCode) {
  const select = document.getElementById('checkoutShipping');
  const infoEl = document.getElementById('shippingMethodInfo');
  if (!select) return;
  
  const methods = getShippingMethodsForCountry(countryCode);
  const selectText = shopState.lang === 'en' ? 'Select shipping method...' : 'Wybierz metodę wysyłki...';
  
  select.innerHTML = `<option value="">${selectText}</option>`;
  
  methods.forEach(method => {
    const name = shopState.lang === 'en' && method.name_en ? method.name_en : method.name;
    const zoneName = shopState.lang === 'en' && method.zone_name_en ? method.zone_name_en : method.zone_name;
    const cost = parseFloat(method.cost) || 0;
    const freeThreshold = method.free_shipping_threshold ? parseFloat(method.free_shipping_threshold) : null;
    
    let label = `${name} (${zoneName}) - €${cost.toFixed(2)}`;
    if (freeThreshold && getCartTotal() >= freeThreshold) {
      label = `${name} (${zoneName}) - ` + (shopState.lang === 'en' ? 'FREE' : 'GRATIS');
    }
    
    const option = document.createElement('option');
    option.value = method.id;
    option.textContent = label;
    option.dataset.cost = cost;
    option.dataset.freeThreshold = freeThreshold || '';
    select.appendChild(option);
  });
  
  // Auto-select first method if only one available
  if (methods.length === 1) {
    select.value = methods[0].id;
    shopState.selectedShippingMethod = methods[0];
    updateShippingInfo(methods[0]);
  } else {
    shopState.selectedShippingMethod = null;
    if (infoEl) infoEl.textContent = '';
  }
}

function updateShippingInfo(method) {
  const infoEl = document.getElementById('shippingMethodInfo');
  if (!infoEl || !method) return;
  
  const desc = shopState.lang === 'en' && method.description_en ? method.description_en : method.description;
  const infoParts = [];
  
  // Only show description if it does not start with deprecated prefixes like "dostawa"
  if (desc && !/^dostawa/i.test(desc.trim())) {
    infoParts.push(desc);
  }
  
  if (method.processing_days) {
    const prepText = shopState.lang === 'en'
      ? `Preparation & dispatch: up to ${method.processing_days} ${method.processing_days === 1 ? 'day' : 'days'}`
      : `Przygotowanie i nadanie: do ${method.processing_days} dni`;
    infoParts.push(prepText);
  }
  
  const minDelivery = method.min_delivery_days ? Number(method.min_delivery_days) : null;
  const maxDelivery = method.max_delivery_days ? Number(method.max_delivery_days) : null;
  
  if (minDelivery || maxDelivery) {
    let deliveryText = '';
    if (shopState.lang === 'en') {
      if (minDelivery && maxDelivery) {
        deliveryText = `Delivery: ${minDelivery}-${maxDelivery} business days`;
      } else {
        const days = minDelivery || maxDelivery;
        deliveryText = `Delivery: ~${days} business days`;
      }
    } else {
      if (minDelivery && maxDelivery) {
        deliveryText = `Dostawa: ${minDelivery}-${maxDelivery} dni roboczych`;
      } else {
        const days = minDelivery || maxDelivery;
        deliveryText = `Dostawa: ok. ${days} dni roboczych`;
      }
    }
    infoParts.push(deliveryText);
  }
  
  infoEl.textContent = infoParts.join(' • ');
}

function calculateShipping() {
  if (!shopState.selectedShippingMethod) return 0;
  
  const method = shopState.selectedShippingMethod;
  const cost = parseFloat(method.cost) || 0;
  const freeThreshold = method.free_shipping_threshold ? parseFloat(method.free_shipping_threshold) : null;
  
  if (freeThreshold && getCartTotal() >= freeThreshold) {
    return 0;
  }
  
  return cost;
}

// =====================================================
// PRODUCTS
// =====================================================

async function loadCategories() {
  if (!supabase) return;

  try {
    const { data: categories, error } = await supabase
      .from('shop_categories')
      .select('id, name, name_en, slug')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;

    shopState.categories = categories || [];
    renderCategoryFilters();

  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

function renderCategoryFilters() {
  const container = document.getElementById('categoryFilters');
  if (!container) return;

  container.innerHTML = `
    <label class="filter-item">
      <input type="radio" name="category" value="" ${!shopState.filters.category ? 'checked' : ''}>
      <span data-i18n="shop.filters.all">Wszystkie</span>
    </label>
    ${shopState.categories.map(cat => `
      <label class="filter-item">
        <input type="radio" name="category" value="${cat.id}" ${shopState.filters.category === cat.id ? 'checked' : ''}>
        <span>${escapeHtml(getLocalizedField(cat, 'name'))}</span>
      </label>
    `).join('')}
  `;

  // Add event listeners
  container.querySelectorAll('input[name="category"]').forEach(input => {
    input.addEventListener('change', () => {
      shopState.filters.category = input.value;
      shopState.pagination.page = 1;
      loadProducts();
    });
  });
}

async function loadProducts() {
  if (!supabase) {
    showProductsError('Nie można połączyć z bazą danych');
    return;
  }

  showProductsLoading();

  try {
    let query = supabase
      .from('shop_products')
      .select('*, category:shop_categories(name, name_en, slug)', { count: 'exact' })
      .eq('status', 'active');

    // Apply filters
    if (shopState.filters.category) {
      query = query.eq('category_id', shopState.filters.category);
    }

    if (shopState.filters.priceMin !== null) {
      query = query.gte('price', shopState.filters.priceMin);
    }

    if (shopState.filters.priceMax !== null) {
      query = query.lte('price', shopState.filters.priceMax);
    }

    // Apply sorting
    switch (shopState.filters.sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      default: // newest
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const from = (shopState.pagination.page - 1) * shopState.pagination.perPage;
    const to = from + shopState.pagination.perPage - 1;
    query = query.range(from, to);

    const { data: products, error, count } = await query;

    if (error) throw error;

    shopState.products = products || [];
    shopState.pagination.total = count || 0;

    renderProducts();
    renderPagination();

  } catch (error) {
    console.error('Failed to load products:', error);
    showProductsError('Nie udało się załadować produktów');
  }
}

function showProductsLoading() {
  const grid = document.getElementById('productsGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="products-loading">
        <div class="spinner"></div>
        <p data-i18n="shop.loading">Ładowanie produktów...</p>
      </div>
    `;
  }
}

function showProductsError(message) {
  const grid = document.getElementById('productsGrid');
  if (grid) {
    grid.innerHTML = `<div class="products-empty"><p>${escapeHtml(message)}</p></div>`;
  }
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const countEl = document.getElementById('productsCount');

  if (countEl) {
    countEl.textContent = shopState.pagination.total;
  }

  if (!grid) return;

  if (!shopState.products.length) {
    grid.innerHTML = `
      <div class="products-empty">
        <p data-i18n="shop.no_products">Nie znaleziono produktów</p>
      </div>
    `;
    return;
  }

  const addToCartText = shopState.lang === 'en' ? 'Add to cart' : 'Dodaj do koszyka';
  const outOfStockText = shopState.lang === 'en' ? 'Out of stock' : 'Brak w magazynie';
  const featuredText = shopState.lang === 'en' ? 'Featured' : 'Polecane';

  grid.innerHTML = shopState.products.map(product => {
    const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
    const isInStock = !product.track_inventory || product.stock_quantity > 0;
    const productName = getLocalizedField(product, 'name');
    const categoryName = product.category ? getLocalizedField(product.category, 'name') : '';

    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="product-card-image">
          ${product.thumbnail_url 
            ? `<img src="${product.thumbnail_url}" alt="${escapeHtml(productName)}" loading="lazy">`
            : `<div class="product-card-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>`
          }
          ${product.is_featured ? `<span class="product-card-badge">${featuredText}</span>` : ''}
          ${hasDiscount ? '<span class="product-card-badge sale">Sale</span>' : ''}
        </div>
        <div class="product-card-content">
          ${categoryName ? `<p class="product-card-category">${escapeHtml(categoryName)}</p>` : ''}
          <h3 class="product-card-name">${escapeHtml(productName)}</h3>
          <div class="product-card-price">
            <span class="current">€${parseFloat(product.price).toFixed(2)}</span>
            ${hasDiscount ? `<span class="original">€${parseFloat(product.compare_at_price).toFixed(2)}</span>` : ''}
          </div>
          <button class="btn-add-to-cart" ${!isInStock ? 'disabled' : ''} data-product-id="${product.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span>${isInStock ? addToCartText : outOfStockText}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  // Add event listeners
  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.btn-add-to-cart')) {
        const productId = card.dataset.productId;
        openProductModal(productId);
      }
    });
  });

  grid.querySelectorAll('.btn-add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = btn.dataset.productId;
      addToCart(productId);
    });
  });
}

function renderPagination() {
  const container = document.getElementById('productsPagination');
  const infoEl = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  if (!container) return;

  const totalPages = Math.ceil(shopState.pagination.total / shopState.pagination.perPage);

  if (totalPages <= 1) {
    container.hidden = true;
    return;
  }

  container.hidden = false;

  if (infoEl) {
    infoEl.textContent = `${shopState.pagination.page} / ${totalPages}`;
  }

  if (prevBtn) {
    prevBtn.disabled = shopState.pagination.page <= 1;
  }

  if (nextBtn) {
    nextBtn.disabled = shopState.pagination.page >= totalPages;
  }
}

// =====================================================
// PRODUCT MODAL
// =====================================================

async function openProductModal(productId) {
  const modal = document.getElementById('productModal');
  const content = document.getElementById('productModalContent');

  if (!modal || !content) return;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  content.innerHTML = '<div class="products-loading"><div class="spinner"></div></div>';

  const product = shopState.products.find(p => p.id === productId);

  if (!product) {
    const notFoundText = shopState.lang === 'en' ? 'Product not found' : 'Produkt nie został znaleziony';
    content.innerHTML = `<p style="text-align: center; padding: 40px;">${notFoundText}</p>`;
    return;
  }

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const isInStock = !product.track_inventory || product.stock_quantity > 0;
  const maxQty = product.track_inventory ? product.stock_quantity : 99;

  // Localized content
  const productName = getLocalizedField(product, 'name');
  const productDesc = getLocalizedField(product, 'description');
  const categoryName = product.category ? getLocalizedField(product.category, 'name') : '';
  const inStockText = shopState.lang === 'en' ? '✓ In stock' : '✓ W magazynie';
  const outOfStockText = shopState.lang === 'en' ? '✗ Out of stock' : '✗ Brak w magazynie';
  const qtyLabel = shopState.lang === 'en' ? 'Quantity:' : 'Ilość:';
  const addToCartText = shopState.lang === 'en' ? 'Add to cart' : 'Dodaj do koszyka';

  content.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-image">
        ${product.thumbnail_url 
          ? `<img src="${product.thumbnail_url}" alt="${escapeHtml(productName)}">`
          : `<div class="product-card-placeholder" style="height: 100%; display: flex; align-items: center; justify-content: center;">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>`
        }
      </div>
      <div class="product-detail-info">
        ${categoryName ? `<p class="product-detail-category">${escapeHtml(categoryName)}</p>` : ''}
        <h2 class="product-detail-name">${escapeHtml(productName)}</h2>
        <div class="product-detail-price">
          <span class="current">€${parseFloat(product.price).toFixed(2)}</span>
          ${hasDiscount ? `<span class="original">€${parseFloat(product.compare_at_price).toFixed(2)}</span>` : ''}
        </div>
        ${productDesc ? `<p class="product-detail-description">${escapeHtml(productDesc)}</p>` : ''}
        <p class="product-detail-stock ${isInStock ? 'in-stock' : 'out-of-stock'}">
          ${isInStock ? inStockText : outOfStockText}
        </p>
        <div class="product-detail-quantity">
          <label>${qtyLabel}</label>
          <div class="quantity-selector">
            <button type="button" id="btnQtyMinus">−</button>
            <input type="number" id="productQty" value="1" min="1" max="${maxQty}">
            <button type="button" id="btnQtyPlus">+</button>
          </div>
        </div>
        <button class="btn-add-to-cart-large" id="btnAddToCartModal" ${!isInStock ? 'disabled' : ''} data-product-id="${product.id}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span>${isInStock ? addToCartText : outOfStockText}</span>
        </button>
      </div>
    </div>
  `;

  // Quantity controls
  const qtyInput = document.getElementById('productQty');
  const minusBtn = document.getElementById('btnQtyMinus');
  const plusBtn = document.getElementById('btnQtyPlus');

  if (minusBtn && qtyInput) {
    minusBtn.onclick = () => {
      const val = parseInt(qtyInput.value) || 1;
      if (val > 1) qtyInput.value = val - 1;
    };
  }

  if (plusBtn && qtyInput) {
    plusBtn.onclick = () => {
      const val = parseInt(qtyInput.value) || 1;
      if (val < maxQty) qtyInput.value = val + 1;
    };
  }

  // Add to cart button
  const addBtn = document.getElementById('btnAddToCartModal');
  if (addBtn) {
    addBtn.onclick = () => {
      const qty = parseInt(qtyInput?.value) || 1;
      addToCart(product.id, qty);
      closeProductModal();
    };
  }
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
  }
}

// =====================================================
// SHOPPING CART
// =====================================================

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('shop_cart');
    if (saved) {
      shopState.cart = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load cart:', e);
    shopState.cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('shop_cart', JSON.stringify(shopState.cart));
    // Also sync to Supabase if user is logged in
    syncCartToSupabase();
  } catch (e) {
    console.error('Failed to save cart:', e);
  }
}

async function syncCartWithSupabase() {
  if (!supabase) return;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Load cart from Supabase
    const { data: dbCart } = await supabase
      .from('shop_carts')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (dbCart) {
      const { data: items } = await supabase
        .from('shop_cart_items')
        .select('product_id, quantity, shop_products(id, name, price, thumbnail_url)')
        .eq('cart_id', dbCart.id);
      
      if (items && items.length > 0) {
        // Merge with local cart - prefer Supabase data
        const supabaseCart = items.map(item => ({
          productId: item.product_id,
          name: item.shop_products?.name || '',
          price: parseFloat(item.shop_products?.price || 0),
          thumbnail: item.shop_products?.thumbnail_url || null,
          quantity: item.quantity
        })).filter(item => item.name);
        
        // Merge: Supabase items take precedence, but keep local items not in Supabase
        const mergedCart = [...supabaseCart];
        shopState.cart.forEach(localItem => {
          if (!mergedCart.find(i => i.productId === localItem.productId)) {
            mergedCart.push(localItem);
          }
        });
        
        shopState.cart = mergedCart;
        localStorage.setItem('shop_cart', JSON.stringify(shopState.cart));
        updateCartUI();
      }
    } else if (shopState.cart.length > 0) {
      // Create cart in Supabase with local items
      await syncCartToSupabase();
    }
  } catch (error) {
    console.error('Failed to sync cart with Supabase:', error);
  }
}

async function syncCartToSupabase() {
  if (!supabase) return;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Get or create cart
    let { data: cart } = await supabase
      .from('shop_carts')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (!cart) {
      const { data: newCart } = await supabase
        .from('shop_carts')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      cart = newCart;
    }
    
    if (!cart) return;
    
    // Clear existing items and insert new ones
    await supabase
      .from('shop_cart_items')
      .delete()
      .eq('cart_id', cart.id);
    
    if (shopState.cart.length > 0) {
      const items = shopState.cart.map(item => ({
        cart_id: cart.id,
        product_id: item.productId,
        quantity: item.quantity
      }));
      
      await supabase
        .from('shop_cart_items')
        .insert(items);
    }
  } catch (error) {
    console.error('Failed to sync cart to Supabase:', error);
  }
}

function addToCart(productId, quantity = 1) {
  const product = shopState.products.find(p => p.id === productId);
  if (!product) return;

  const existingItem = shopState.cart.find(item => item.productId === productId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    shopState.cart.push({
      productId: product.id,
      name: product.name,
      price: parseFloat(product.price),
      thumbnail: product.thumbnail_url,
      quantity
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast('Dodano do koszyka');
}

function removeFromCart(productId) {
  shopState.cart = shopState.cart.filter(item => item.productId !== productId);
  saveCartToStorage();
  updateCartUI();
}

function updateCartItemQuantity(productId, quantity) {
  const item = shopState.cart.find(item => item.productId === productId);
  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      item.quantity = quantity;
      saveCartToStorage();
      updateCartUI();
    }
  }
}

function getCartTotal() {
  return shopState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartItemCount() {
  return shopState.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartUI() {
  // Update cart count badge
  const countEl = document.getElementById('cartCount');
  const count = getCartItemCount();
  if (countEl) {
    countEl.textContent = count;
    countEl.hidden = count === 0;
  }

  // Update cart sidebar
  renderCartItems();
}

function renderCartItems() {
  const itemsContainer = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  const subtotalEl = document.getElementById('cartSubtotal');

  if (!itemsContainer) return;

  // Get translated text
  const emptyText = shopState.lang === 'en' ? 'Your cart is empty' : 'Twój koszyk jest pusty';
  const removeText = shopState.lang === 'en' ? 'Remove' : 'Usuń';

  if (!shopState.cart.length) {
    itemsContainer.innerHTML = `<p class="cart-empty">${emptyText}</p>`;
    if (footer) footer.hidden = true;
    return;
  }

  if (footer) footer.hidden = false;

  itemsContainer.innerHTML = shopState.cart.map(item => `
    <div class="cart-item" data-product-id="${item.productId}">
      <div class="cart-item-image">
        ${item.thumbnail 
          ? `<img src="${item.thumbnail}" alt="${escapeHtml(item.name)}">`
          : ''
        }
      </div>
      <div class="cart-item-details">
        <h4 class="cart-item-name">${escapeHtml(item.name)}</h4>
        <p class="cart-item-price">€${item.price.toFixed(2)}</p>
        <div class="cart-item-quantity">
          <button class="btn-qty-minus" data-product-id="${item.productId}">−</button>
          <span>${item.quantity}</span>
          <button class="btn-qty-plus" data-product-id="${item.productId}">+</button>
        </div>
        <button class="btn-remove-item" data-product-id="${item.productId}">${removeText}</button>
      </div>
    </div>
  `).join('');

  if (subtotalEl) {
    subtotalEl.textContent = `€${getCartTotal().toFixed(2)}`;
  }

  // Add event listeners
  itemsContainer.querySelectorAll('.btn-qty-minus').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.productId;
      const item = shopState.cart.find(i => i.productId === id);
      if (item) updateCartItemQuantity(id, item.quantity - 1);
    };
  });

  itemsContainer.querySelectorAll('.btn-qty-plus').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.productId;
      const item = shopState.cart.find(i => i.productId === id);
      if (item) updateCartItemQuantity(id, item.quantity + 1);
    };
  });

  itemsContainer.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.onclick = () => removeFromCart(btn.dataset.productId);
  });
}

function openCart() {
  const sidebar = document.getElementById('cartSidebar');
  if (sidebar) {
    sidebar.hidden = false;
    document.body.style.overflow = 'hidden';
  }
}

function closeCart() {
  const sidebar = document.getElementById('cartSidebar');
  if (sidebar) {
    sidebar.hidden = true;
    document.body.style.overflow = '';
  }
}

// =====================================================
// CHECKOUT
// =====================================================

let checkoutUser = null;

async function initiateCheckout() {
  if (!shopState.cart.length) {
    showToast(shopState.lang === 'en' ? 'Your cart is empty' : 'Koszyk jest pusty', 'error');
    return;
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    showToast(shopState.lang === 'en' ? 'Please log in to continue' : 'Zaloguj się, aby kontynuować', 'warning');
    return;
  }

  checkoutUser = user;
  
  // Open checkout modal
  openCheckoutModal();
  
  // Pre-fill user email
  const emailInput = document.getElementById('checkoutEmail');
  if (emailInput && user.email) {
    emailInput.value = user.email;
  }
  
  // Try to load saved address
  await loadSavedAddress(user.id);
}

async function loadSavedAddress(userId) {
  try {
    const { data: address } = await supabase
      .from('shop_addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default_shipping', true)
      .single();
    
    if (address) {
      // Pre-fill form with saved address
      document.getElementById('checkoutFirstName').value = address.first_name || '';
      document.getElementById('checkoutLastName').value = address.last_name || '';
      document.getElementById('checkoutPhone').value = address.phone || '';
      document.getElementById('checkoutAddress').value = address.line1 || '';
      document.getElementById('checkoutAddress2').value = address.line2 || '';
      document.getElementById('checkoutCity').value = address.city || '';
      document.getElementById('checkoutPostal').value = address.postal_code || '';
      document.getElementById('checkoutCountry').value = address.country || '';
    }
  } catch (error) {
    console.log('No saved address found');
  }
}

async function generateOrderNumber() {
  try {
    const { data, error } = await supabase.rpc('shop_generate_order_number');
    if (!error && data) return data;
  } catch (e) {
    // ignore
  }

  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WC-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function openCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.hidden = false;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Reset to step 1
    showCheckoutStep(1);
    
    // Initialize shipping methods based on current country selection
    const countrySelect = document.getElementById('checkoutCountry');
    if (countrySelect) {
      updateShippingMethodsDropdown(countrySelect.value);
    }
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
  }

  const cartSidebar = document.getElementById('cartSidebar');
  if (cartSidebar && !cartSidebar.hidden) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

function showCheckoutStep(stepNum) {
  // Update step indicators
  document.querySelectorAll('.checkout-step').forEach(step => {
    const num = parseInt(step.dataset.step);
    step.classList.remove('is-active', 'is-complete');
    if (num < stepNum) step.classList.add('is-complete');
    if (num === stepNum) step.classList.add('is-active');
  });
  
  // Show/hide sections
  document.getElementById('checkoutStep1').hidden = stepNum !== 1;
  document.getElementById('checkoutStep2').hidden = stepNum !== 2;
}

function goToReviewStep() {
  // Validate step 1 form
  const form = document.getElementById('checkoutForm');
  const step1Fields = document.querySelectorAll('#checkoutStep1 [required]');
  
  let isValid = true;
  step1Fields.forEach(field => {
    if (!field.value.trim()) {
      field.style.borderColor = '#ef4444';
      isValid = false;
    } else {
      field.style.borderColor = '';
    }
  });
  
  if (!isValid) {
    showToast(shopState.lang === 'en' ? 'Please fill in all required fields' : 'Wypełnij wszystkie wymagane pola', 'error');
    return;
  }
  
  // Validate shipping method is selected
  if (!shopState.selectedShippingMethod) {
    showToast(shopState.lang === 'en' ? 'Please select a shipping method' : 'Wybierz metodę wysyłki', 'error');
    document.getElementById('checkoutShipping').style.borderColor = '#ef4444';
    return;
  }
  
  // Populate review section
  populateReviewSection();
  showCheckoutStep(2);
}

function populateReviewSection() {
  // Shipping address
  const addressEl = document.getElementById('reviewShippingAddress');
  if (addressEl) {
    const firstName = document.getElementById('checkoutFirstName').value;
    const lastName = document.getElementById('checkoutLastName').value;
    const address1 = document.getElementById('checkoutAddress').value;
    const address2 = document.getElementById('checkoutAddress2').value;
    const city = document.getElementById('checkoutCity').value;
    const postal = document.getElementById('checkoutPostal').value;
    const country = document.getElementById('checkoutCountry');
    const countryName = country.options[country.selectedIndex]?.text || country.value;
    
    addressEl.innerHTML = `
      <strong>${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong><br>
      ${escapeHtml(address1)}<br>
      ${address2 ? escapeHtml(address2) + '<br>' : ''}
      ${escapeHtml(city)}, ${escapeHtml(postal)}<br>
      ${escapeHtml(countryName)}
    `;
  }
  
  // Order items
  const itemsEl = document.getElementById('reviewOrderItems');
  if (itemsEl) {
    itemsEl.innerHTML = shopState.cart.map(item => `
      <div class="review-item">
        <span class="review-item-name">${escapeHtml(item.name)}</span>
        <span class="review-item-qty">× ${item.quantity}</span>
        <span class="review-item-price">€${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');
  }
  
  // Totals
  const subtotal = getCartTotal();
  const shipping = calculateShipping();
  const total = subtotal + shipping;
  
  document.getElementById('reviewSubtotal').textContent = `€${subtotal.toFixed(2)}`;
  document.getElementById('reviewShipping').textContent = shipping > 0 ? `€${shipping.toFixed(2)}` : (shopState.lang === 'en' ? 'Free' : 'Gratis');
  document.getElementById('reviewTotal').textContent = `€${total.toFixed(2)}`;
}

async function submitOrder(e) {
  e.preventDefault();
  
  if (!checkoutUser) {
    showToast(shopState.lang === 'en' ? 'Please log in' : 'Zaloguj się', 'error');
    return;
  }
  
  // Validate shipping method is selected
  if (!shopState.selectedShippingMethod) {
    showToast(shopState.lang === 'en' ? 'Please select a shipping method' : 'Wybierz metodę wysyłki', 'error');
    return;
  }
  
  const btnSubmit = document.getElementById('btnPlaceOrder');
  btnSubmit.disabled = true;
  btnSubmit.textContent = shopState.lang === 'en' ? 'Redirecting to payment...' : 'Przekierowanie do płatności...';
  
  try {
    // Gather shipping data
    const shippingAddress = {
      first_name: document.getElementById('checkoutFirstName').value.trim(),
      last_name: document.getElementById('checkoutLastName').value.trim(),
      phone: document.getElementById('checkoutPhone').value.trim(),
      line1: document.getElementById('checkoutAddress').value.trim(),
      line2: document.getElementById('checkoutAddress2').value.trim() || undefined,
      city: document.getElementById('checkoutCity').value.trim(),
      postal_code: document.getElementById('checkoutPostal').value.trim(),
      country: document.getElementById('checkoutCountry').value
    };
    
    // Save address if checkbox checked
    if (document.getElementById('checkoutSaveAddress').checked) {
      await saveShippingAddress({
        user_id: checkoutUser.id,
        ...shippingAddress,
        email: document.getElementById('checkoutEmail').value.trim(),
        is_default_shipping: true,
        is_default_billing: true
      });
    }
    
    // Prepare cart items for Stripe checkout
    const items = shopState.cart.map(item => ({
      product_id: item.productId,
      quantity: item.quantity,
      product_name: item.name,
      unit_price: item.price,
      image_url: item.thumbnail || undefined
    }));

    const customerNotes = document.getElementById('checkoutNotes').value.trim() || undefined;
    
    // Get current page URL for success/cancel redirects
    const baseUrl = window.location.origin;
    const successUrl = `${baseUrl}/shop.html?checkout=success`;
    const cancelUrl = `${baseUrl}/shop.html?checkout=cancelled`;

    // Call Stripe checkout edge function
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        user_id: checkoutUser.id,
        items: items,
        shipping_address: shippingAddress,
        shipping_method_id: shopState.selectedShippingMethod.id,
        customer_notes: customerNotes,
        success_url: successUrl,
        cancel_url: cancelUrl
      }
    });

    if (error) throw error;
    
    if (data?.session_url) {
      // Clear cart before redirecting
      shopState.cart = [];
      saveCartToStorage();
      
      // Redirect to Stripe Checkout
      window.location.href = data.session_url;
    } else {
      throw new Error('No checkout URL returned');
    }
    
  } catch (error) {
    console.error('Checkout error:', error);
    showToast(shopState.lang === 'en' ? 'Error starting payment' : 'Błąd podczas uruchamiania płatności', 'error');
    btnSubmit.disabled = false;
    btnSubmit.textContent = shopState.lang === 'en' ? 'Pay with Stripe' : 'Zapłać przez Stripe';
  }
}

function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const checkoutStatus = params.get('checkout');
  
  if (checkoutStatus === 'success') {
    // Clear any remaining cart items
    shopState.cart = [];
    saveCartToStorage();
    updateCartUI();
    
    // Show success message
    setTimeout(() => {
      showToast(
        shopState.lang === 'en' 
          ? 'Payment successful! Your order is being processed.' 
          : 'Płatność zakończona sukcesem! Twoje zamówienie jest przetwarzane.',
        'success'
      );
    }, 500);
    
    // Clean URL
    const url = new URL(window.location);
    url.searchParams.delete('checkout');
    url.searchParams.delete('order_id');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url);
  } else if (checkoutStatus === 'cancelled') {
    // Show cancelled message
    setTimeout(() => {
      showToast(
        shopState.lang === 'en' 
          ? 'Payment was cancelled. Your cart items are still saved.' 
          : 'Płatność została anulowana. Produkty w koszyku zostały zachowane.',
        'warning'
      );
    }, 500);
    
    // Clean URL
    const url = new URL(window.location);
    url.searchParams.delete('checkout');
    url.searchParams.delete('order_id');
    window.history.replaceState({}, '', url);
  }
}

async function saveShippingAddress(data) {
  try {
    // Check if address exists
    const { data: existing } = await supabase
      .from('shop_addresses')
      .select('id')
      .eq('user_id', data.user_id)
      .eq('is_default_shipping', true)
      .single();
    
    if (existing) {
      // Update existing
      await supabase
        .from('shop_addresses')
        .update(data)
        .eq('id', existing.id);
    } else {
      // Insert new
      await supabase
        .from('shop_addresses')
        .insert(data);
    }
  } catch (error) {
    console.error('Failed to save address:', error);
  }
}

function showOrderSuccess(orderId) {
  const msgText = shopState.lang === 'en' 
    ? `Thank you for your order! Order #${orderId.slice(0, 8).toUpperCase()} has been placed. You will receive a confirmation email shortly.`
    : `Dziękujemy za zamówienie! Zamówienie #${orderId.slice(0, 8).toUpperCase()} zostało złożone. Wkrótce otrzymasz email z potwierdzeniem.`;
  
  // Create success overlay
  const overlay = document.createElement('div');
  overlay.className = 'order-success-overlay';
  overlay.innerHTML = `
    <div class="order-success-content">
      <div class="order-success-icon">✓</div>
      <h2>${shopState.lang === 'en' ? 'Order Confirmed!' : 'Zamówienie potwierdzone!'}</h2>
      <p>${msgText}</p>
      <button class="btn btn-primary" onclick="this.closest('.order-success-overlay').remove()">
        ${shopState.lang === 'en' ? 'Continue Shopping' : 'Kontynuuj zakupy'}
      </button>
    </div>
  `;
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  `;
  overlay.querySelector('.order-success-content').style.cssText = `
    background: white; padding: 40px; border-radius: 16px; text-align: center; max-width: 400px;
  `;
  overlay.querySelector('.order-success-icon').style.cssText = `
    width: 80px; height: 80px; background: #22c55e; color: white; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 40px;
    margin: 0 auto 24px;
  `;
  document.body.appendChild(overlay);
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  // Sort select
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.value = shopState.filters.sort;
    sortSelect.addEventListener('change', () => {
      shopState.filters.sort = sortSelect.value;
      shopState.pagination.page = 1;
      loadProducts();
    });
  }

  // Price filter
  const btnApplyPrice = document.getElementById('btnApplyPrice');
  if (btnApplyPrice) {
    btnApplyPrice.addEventListener('click', () => {
      const min = document.getElementById('priceMin')?.value;
      const max = document.getElementById('priceMax')?.value;
      shopState.filters.priceMin = min ? parseFloat(min) : null;
      shopState.filters.priceMax = max ? parseFloat(max) : null;
      shopState.pagination.page = 1;
      loadProducts();
    });
  }

  // Pagination
  const btnPrevPage = document.getElementById('btnPrevPage');
  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (shopState.pagination.page > 1) {
        shopState.pagination.page--;
        loadProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  const btnNextPage = document.getElementById('btnNextPage');
  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      const totalPages = Math.ceil(shopState.pagination.total / shopState.pagination.perPage);
      if (shopState.pagination.page < totalPages) {
        shopState.pagination.page++;
        loadProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Mobile filters toggle
  const btnToggleFilters = document.getElementById('btnToggleFilters');
  const filtersPanel = document.getElementById('shopFilters');
  if (btnToggleFilters && filtersPanel) {
    btnToggleFilters.addEventListener('click', () => {
      filtersPanel.classList.toggle('is-open');
    });
  }

  // Cart sidebar
  const btnOpenCart = document.getElementById('btnOpenCart');
  if (btnOpenCart) {
    btnOpenCart.addEventListener('click', openCart);
  }

  const btnCloseCart = document.getElementById('btnCloseCart');
  if (btnCloseCart) {
    btnCloseCart.addEventListener('click', closeCart);
  }

  const cartOverlay = document.getElementById('cartOverlay');
  if (cartOverlay) {
    cartOverlay.addEventListener('click', closeCart);
  }

  // Checkout button
  const btnCheckout = document.getElementById('btnCheckout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', initiateCheckout);
  }

  // Continue shopping button
  const btnContinue = document.getElementById('btnContinueShopping');
  if (btnContinue) {
    btnContinue.addEventListener('click', closeCart);
  }

  // Checkout modal
  const btnCloseCheckout = document.getElementById('btnCloseCheckout');
  if (btnCloseCheckout) {
    btnCloseCheckout.addEventListener('click', closeCheckoutModal);
  }

  const checkoutOverlay = document.getElementById('checkoutModalOverlay');
  if (checkoutOverlay) {
    checkoutOverlay.addEventListener('click', closeCheckoutModal);
  }

  // Checkout step navigation
  const btnToStep2 = document.getElementById('btnToStep2');
  if (btnToStep2) {
    btnToStep2.addEventListener('click', goToReviewStep);
  }

  const btnBackToStep1 = document.getElementById('btnBackToStep1');
  if (btnBackToStep1) {
    btnBackToStep1.addEventListener('click', () => showCheckoutStep(1));
  }

  const btnEditAddress = document.getElementById('btnEditAddress');
  if (btnEditAddress) {
    btnEditAddress.addEventListener('click', () => showCheckoutStep(1));
  }

  // Checkout form submission
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', submitOrder);
  }

  // Country change - update shipping methods
  const countrySelect = document.getElementById('checkoutCountry');
  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      updateShippingMethodsDropdown(countrySelect.value);
    });
  }

  // Shipping method change
  const shippingSelect = document.getElementById('checkoutShipping');
  if (shippingSelect) {
    shippingSelect.addEventListener('change', () => {
      const methodId = shippingSelect.value;
      const method = shopState.shippingMethods.find(m => m.id === methodId);
      shopState.selectedShippingMethod = method || null;
      updateShippingInfo(method);
    });
  }

  // Close filters on mobile
  const btnCloseFilters = document.getElementById('btnCloseFilters');
  if (btnCloseFilters) {
    btnCloseFilters.addEventListener('click', () => {
      document.getElementById('shopFilters')?.classList.remove('is-open');
    });
  }

  // Product modal
  const btnCloseProductModal = document.getElementById('btnCloseProductModal');
  if (btnCloseProductModal) {
    btnCloseProductModal.addEventListener('click', closeProductModal);
  }

  const productModalOverlay = document.getElementById('productModalOverlay');
  if (productModalOverlay) {
    productModalOverlay.addEventListener('click', closeProductModal);
  }

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      closeProductModal();
      closeCheckoutModal();
    }
  });
}

// =====================================================
// UTILITIES
// =====================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  // Use existing toast system if available
  if (window.showToast) {
    window.showToast(message, type);
    return;
  }

  // Simple fallback toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#22c55e'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    z-index: 9999;
    animation: fadeInUp 0.3s;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Export for global access
window.shopAddToCart = addToCart;
window.shopOpenCart = openCart;
window.shopCloseCart = closeCart;
