/**
 * Header Navigation Dropdown
 * Handles the toggle behavior for the mobile navigation menu.
 */

function safeReadCartCount() {
  try {
    const raw = localStorage.getItem('shop_cart');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((sum, item) => sum + (Number(item && item.quantity) || 0), 0);
  } catch (e) {
    return 0;
  }
}

function updateCartBadge() {
  const countEl = document.getElementById('cartCount');
  if (!countEl) return;
  const count = safeReadCartCount();
  countEl.textContent = String(count);
  countEl.hidden = count <= 0;
}

function getNestedTranslation(translations, key) {
  if (!translations || !key) return null;
  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    const direct = translations[key];
    return typeof direct === 'string' ? direct : null;
  }
  if (key.indexOf('.') === -1) return null;
  const parts = key.split('.');
  let current = translations;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return null;
    }
    current = current[part];
  }
  return typeof current === 'string' ? current : null;
}

function updateCartAriaLabel() {
  const btn = document.getElementById('btnOpenCart');
  if (!btn) return;

  const lang = (window.appI18n && window.appI18n.language) ? window.appI18n.language : null;
  const translations = lang && window.appI18n && window.appI18n.translations ? window.appI18n.translations[lang] : null;
  const label = getNestedTranslation(translations, 'shop.cart.aria') || (lang === 'en' ? 'Shopping cart' : 'Koszyk');
  btn.setAttribute('aria-label', label);
}

function buildShopUrlWithOpenCart() {
  const url = new URL('shop.html', window.location.origin + '/');
  const current = new URL(window.location.href);
  const langFromUrl = current.searchParams.get('lang');
  let lang = langFromUrl;
  if (!lang) {
    try {
      lang = (localStorage.getItem('ce_lang') || '').trim();
    } catch (e) {
      lang = '';
    }
  }
  if (lang) url.searchParams.set('lang', lang);

  const seoPage = (document.body && document.body.dataset) ? document.body.dataset.seoPage : null;
  if (!seoPage || String(seoPage).toLowerCase() !== 'plan') {
    url.searchParams.set('openCart', '1');
  }
  return url;
}

function isShopPage() {
  const path = (window.location.pathname || '').toLowerCase();
  return path.endsWith('/shop.html') || path === '/shop' || path.endsWith('/shop');
}

function ensureHeaderCartButton() {
  const existing = document.getElementById('btnOpenCart');
  const topActions = document.querySelector('.nav-modern__top-actions');
  if (!topActions) {
    if (existing) {
      updateCartBadge();
      updateCartAriaLabel();
    }
    return;
  }

  let btn = existing;
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btnOpenCart';
    btn.className = 'btn btn-sm';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Koszyk');
    btn.dataset.i18nAttrs = 'aria-label:shop.cart.aria';
    btn.innerHTML = '🛒 <span id="cartCount" class="cart-count" hidden>0</span>';

    const languageGroup = topActions.querySelector('[data-language-toggle]');
    if (languageGroup) {
      topActions.insertBefore(btn, languageGroup);
    } else {
      topActions.appendChild(btn);
    }
  }

  if (btn.dataset.cartHandlerAttached !== 'true' && !isShopPage()) {
    btn.dataset.cartHandlerAttached = 'true';
    btn.addEventListener('click', () => {
      window.location.href = buildShopUrlWithOpenCart().toString();
    });
  }

  updateCartBadge();
  updateCartAriaLabel();
}

function initHeaderDropdown() {
  const toggleBtn = document.getElementById('navToggleBtn');
  const linksRow = document.getElementById('navLinksRow');

  if (!toggleBtn || !linksRow) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';

    toggleBtn.setAttribute('aria-expanded', !isExpanded);

    if (!isExpanded) {
      linksRow.classList.add('is-open');
    } else {
      linksRow.classList.remove('is-open');
    }
  });

  document.addEventListener('click', (event) => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded && !toggleBtn.contains(event.target) && !linksRow.contains(event.target)) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      linksRow.classList.remove('is-open');
    }
  });
}

function initGlobalHeaderEnhancements() {
  ensureHeaderCartButton();

  window.addEventListener('storage', (event) => {
    if (event && event.key === 'shop_cart') {
      updateCartBadge();
    }
  });

  window.addEventListener('shop:cart-updated', updateCartBadge);
  document.addEventListener('wakacjecypr:languagechange', () => {
    updateCartBadge();
    updateCartAriaLabel();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initHeaderDropdown();
    initGlobalHeaderEnhancements();
  });
} else {
  initHeaderDropdown();
  initGlobalHeaderEnhancements();
}
