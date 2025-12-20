/**
 * Shop Module - Frontend shop functionality
 * Handles products display, cart, and checkout
 */

// State
const shopState = {
  products: [],
  categories: [],
  cart: [],
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
  }
};

// Supabase client
let supabase = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await initSupabase();
  loadCartFromStorage();
  await loadCategories();
  await loadProducts();
  setupEventListeners();
  updateCartUI();
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
// PRODUCTS
// =====================================================

async function loadCategories() {
  if (!supabase) return;

  try {
    const { data: categories, error } = await supabase
      .from('shop_categories')
      .select('id, name, slug')
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
        <span>${escapeHtml(cat.name)}</span>
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
      .select('*, category:shop_categories(name, slug)', { count: 'exact' })
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

  grid.innerHTML = shopState.products.map(product => {
    const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
    const isInStock = !product.track_inventory || product.stock_quantity > 0;

    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="product-card-image">
          ${product.thumbnail_url 
            ? `<img src="${product.thumbnail_url}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<div class="product-card-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>`
          }
          ${product.is_featured ? '<span class="product-card-badge">Featured</span>' : ''}
          ${hasDiscount ? '<span class="product-card-badge sale">Sale</span>' : ''}
        </div>
        <div class="product-card-content">
          ${product.category ? `<p class="product-card-category">${escapeHtml(product.category.name)}</p>` : ''}
          <h3 class="product-card-name">${escapeHtml(product.name)}</h3>
          <div class="product-card-price">
            <span class="current">€${parseFloat(product.price).toFixed(2)}</span>
            ${hasDiscount ? `<span class="original">€${parseFloat(product.compare_at_price).toFixed(2)}</span>` : ''}
          </div>
          <button class="btn-add-to-cart" ${!isInStock ? 'disabled' : ''} data-product-id="${product.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span>${isInStock ? 'Dodaj do koszyka' : 'Brak w magazynie'}</span>
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
    content.innerHTML = '<p style="text-align: center; padding: 40px;">Produkt nie został znaleziony</p>';
    return;
  }

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const isInStock = !product.track_inventory || product.stock_quantity > 0;
  const maxQty = product.track_inventory ? product.stock_quantity : 99;

  content.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-image">
        ${product.thumbnail_url 
          ? `<img src="${product.thumbnail_url}" alt="${escapeHtml(product.name)}">`
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
        ${product.category ? `<p class="product-detail-category">${escapeHtml(product.category.name)}</p>` : ''}
        <h2 class="product-detail-name">${escapeHtml(product.name)}</h2>
        <div class="product-detail-price">
          <span class="current">€${parseFloat(product.price).toFixed(2)}</span>
          ${hasDiscount ? `<span class="original">€${parseFloat(product.compare_at_price).toFixed(2)}</span>` : ''}
        </div>
        ${product.description ? `<p class="product-detail-description">${escapeHtml(product.description)}</p>` : ''}
        <p class="product-detail-stock ${isInStock ? 'in-stock' : 'out-of-stock'}">
          ${isInStock ? '✓ W magazynie' : '✗ Brak w magazynie'}
        </p>
        <div class="product-detail-quantity">
          <label>Ilość:</label>
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
          <span>${isInStock ? 'Dodaj do koszyka' : 'Brak w magazynie'}</span>
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
  } catch (e) {
    console.error('Failed to save cart:', e);
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

  if (!shopState.cart.length) {
    itemsContainer.innerHTML = '<p class="cart-empty" data-i18n="shop.cart.empty">Twój koszyk jest pusty</p>';
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
        <button class="btn-remove-item" data-product-id="${item.productId}">Usuń</button>
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

async function initiateCheckout() {
  if (!shopState.cart.length) {
    showToast('Koszyk jest pusty', 'error');
    return;
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    showToast('Zaloguj się, aby kontynuować', 'warning');
    // Could redirect to login or show login modal
    return;
  }

  // Call Edge Function to create Stripe checkout session
  try {
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        items: shopState.cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity
        })),
        success_url: `${window.location.origin}/shop-success.html`,
        cancel_url: `${window.location.origin}/shop.html`
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.url) {
      // Clear cart before redirecting
      shopState.cart = [];
      saveCartToStorage();
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    }

  } catch (error) {
    console.error('Checkout error:', error);
    showToast('Błąd podczas tworzenia zamówienia', 'error');
  }
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
  const filtersPanel = document.querySelector('.shop-filters');
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
