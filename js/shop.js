/**
 * Shop Module - Frontend shop functionality
 * Handles products display, cart, and checkout
 */

// State
const shopState = {
  products: [],
  categories: [],
  cart: [],
  productVariants: {},
  discountCode: null,
  discountPreview: null,
  taxSettings: {
    taxEnabled: false,
    taxIncludedInPrice: true,
    taxBasedOn: 'shipping'
  },
  taxRatesByClass: {},
  shippingZones: [],
  shippingMethods: [],
  shippingClasses: [],
  shippingClassesMap: {},
  selectedShippingMethod: null,
  shippingQuote: null,
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

function isCheckoutUiDebugEnabled() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('debugCheckout') === '1') {
      return true;
    }
  } catch (e) {
  }

  try {
    return localStorage.getItem('checkout_debug_ui') === 'true';
  } catch (e) {
    return false;
  }
}

function persistCheckoutDebugSnapshot(payload, response) {
  try {
    localStorage.setItem('last_checkout_payload', JSON.stringify(payload));
    localStorage.setItem('last_checkout_response', JSON.stringify(response));
    localStorage.setItem('last_checkout_saved_at', new Date().toISOString());
  } catch (e) {
  }
}

async function loadTaxSettings() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.rpc('shop_get_public_tax_settings');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    shopState.taxSettings = {
      taxEnabled: row?.tax_enabled === true,
      taxIncludedInPrice: row?.tax_included_in_price !== false,
      taxBasedOn: row?.tax_based_on || 'shipping'
    };
  } catch (e) {
    shopState.taxSettings = {
      taxEnabled: false,
      taxIncludedInPrice: true,
      taxBasedOn: 'shipping'
    };
  }
}

async function refreshTaxRatesFromUi() {
  const countrySelect = document.getElementById('checkoutCountry');
  const country = countrySelect ? (countrySelect.value || '').toUpperCase() : '';
  await loadTaxRatesForCountry(country);
}

async function loadTaxRatesForCountry(country) {
  if (!supabase) return;
  if (!country || !shopState.taxSettings?.taxEnabled) {
    shopState.taxRatesByClass = {};
    return;
  }

  try {
    const classIds = Array.from(
      new Set(
        shopState.products
          .map(p => p.tax_class_id)
          .filter(Boolean)
      )
    );

    if (!classIds.length) {
      shopState.taxRatesByClass = {};
      return;
    }

    const { data, error } = await supabase
      .from('shop_tax_rates')
      .select('tax_class_id, rate, priority')
      .eq('country', country)
      .in('tax_class_id', classIds)
      .order('priority', { ascending: true });

    if (error) throw error;

    const map = {};
    (data || []).forEach(row => {
      const id = row.tax_class_id;
      if (!id || map[id]) return;
      const rawRate = Math.max(0, toNumber(row.rate));
      map[id] = rawRate > 1 ? (rawRate / 100) : rawRate;
    });
    shopState.taxRatesByClass = map;
  } catch (e) {
    shopState.taxRatesByClass = {};
  }
}

function allocateProportionalDiscount(amount, weights) {
  const safeAmount = roundCurrency(Math.max(0, toNumber(amount)));
  const totalWeight = (weights || []).reduce((sum, w) => sum + Math.max(0, toNumber(w)), 0);
  if (!safeAmount || !totalWeight) return (weights || []).map(() => 0);

  const allocations = (weights || []).map(w => {
    const weight = Math.max(0, toNumber(w));
    if (!weight) return 0;
    return roundCurrency((safeAmount * weight) / totalWeight);
  });

  const allocatedSum = roundCurrency(allocations.reduce((sum, v) => sum + v, 0));
  const diff = roundCurrency(safeAmount - allocatedSum);
  if (diff !== 0) {
    for (let i = allocations.length - 1; i >= 0; i--) {
      if (Math.max(0, toNumber(weights[i])) > 0) {
        allocations[i] = roundCurrency(Math.max(0, allocations[i] + diff));
        break;
      }
    }
  }

  return allocations;
}

function getCartItemTaxRate(cartItem) {
  const product = shopState.products.find(p => p.id === cartItem.productId);
  const taxClassId = product?.tax_class_id || null;
  if (!shopState.taxSettings?.taxEnabled || !taxClassId) return 0;
  const rate = shopState.taxRatesByClass ? shopState.taxRatesByClass[taxClassId] : 0;
  return Math.max(0, toNumber(rate));
}

function isProductInActiveSaleWindow(product, nowIso) {
  if (!product) return false;
  const salePrice = toNumber(product.sale_price);
  if (!(salePrice > 0)) return false;
  const start = product.sale_start_date ? String(product.sale_start_date) : '';
  const end = product.sale_end_date ? String(product.sale_end_date) : '';
  if (!start && !end) return true;
  if (start && nowIso < start) return false;
  if (end && nowIso >= end) return false;
  return true;
}

function getCartItemGrossUnitPrice(cartItem) {
  const settings = shopState.taxSettings || { taxEnabled: false, taxIncludedInPrice: true };
  const basePrice = toNumber(cartItem.price);
  if (!settings.taxEnabled) return basePrice;

  const product = shopState.products.find(p => p.id === cartItem.productId);
  const taxRate = getCartItemTaxRate(cartItem);
  if (!taxRate) return basePrice;

  const rawMode = typeof product?.tax_price_mode === 'string' ? (product.tax_price_mode || '').trim() : '';
  const mode = rawMode === 'gross' || rawMode === 'net' || rawMode === 'inherit' ? rawMode : 'inherit';
  const treatAsGross = mode === 'gross'
    ? true
    : mode === 'net'
      ? false
      : settings.taxIncludedInPrice !== false;

  if (treatAsGross) return basePrice;
  return roundCurrency(basePrice * (1 + taxRate));
}

function getCartTotalGross() {
  return shopState.cart.reduce((sum, item) => {
    const grossUnit = getCartItemGrossUnitPrice(item);
    return sum + (grossUnit * (item.quantity || 0));
  }, 0);
}

function computeVatPreview(preview) {
  if (!shopState.taxSettings?.taxEnabled) return 0;

  const discountAmount = preview && preview.valid && preview.discountAmount ? preview.discountAmount : 0;
  const eligibleMask = Array.isArray(preview?.eligibleMask) ? preview.eligibleMask : [];
  const weights = shopState.cart.map((item, idx) => {
    const grossUnit = getCartItemGrossUnitPrice(item);
    const lineGross = roundCurrency(grossUnit * (item.quantity || 0));
    const eligible = eligibleMask.length ? eligibleMask[idx] === true : true;
    return eligible ? lineGross : 0;
  });

  const allocations = allocateProportionalDiscount(discountAmount, weights);

  let vatTotal = 0;
  shopState.cart.forEach((item, idx) => {
    const rate = getCartItemTaxRate(item);
    if (!rate) return;

    const grossUnit = getCartItemGrossUnitPrice(item);
    const lineGross = roundCurrency(grossUnit * (item.quantity || 0));
    const lineDiscount = roundCurrency(Math.max(0, toNumber(allocations[idx])));
    const grossAfterDiscount = roundCurrency(Math.max(0, lineGross - lineDiscount));
    const netAfterDiscount = roundCurrency(grossAfterDiscount / (1 + rate));
    const lineVat = roundCurrency(Math.max(0, grossAfterDiscount - netAfterDiscount));
    vatTotal = roundCurrency(vatTotal + lineVat);
  });

  return vatTotal;
}

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
  loadDiscountCodeFromStorage();

  await handleCheckoutReturn();

  await loadTaxSettings();
  await loadCategories();
  await loadProducts();
  await refreshTaxRatesFromUi();
  await loadShippingZonesAndMethods();
  await loadShippingClasses();
  setupEventListeners();
  updateCartUI();
  await refreshDiscountPreview();
  updateShippingTotalsUI();
  
  // Sync cart with Supabase for logged-in users
  await syncCartWithSupabase();
  
  // Listen for language changes
  const handleLanguageUpdate = () => {
    shopState.lang = getCurrentLang();
    renderCategoryFilters();
    renderProducts();
    renderCartItems(); // Re-render cart with new translations
    refreshDiscountPreview().then(() => updateShippingTotalsUI());
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
  
  const previousSelection = shopState.selectedShippingMethod?.id || null;
  const methods = getShippingMethodsForCountry(countryCode);
  const selectText = shopState.lang === 'en' ? 'Select shipping method...' : 'Wybierz metodę wysyłki...';
  
  select.innerHTML = `<option value="">${selectText}</option>`;
  shopState.selectedShippingMethod = null;
  shopState.shippingQuote = null;
  renderShippingBreakdown('shippingMethodBreakdown', null);
  
  const metrics = getCartShippingMetrics();
  const availableOptions = [];

  methods.forEach(method => {
    const zoneName = shopState.lang === 'en' && method.zone_name_en ? method.zone_name_en : method.zone_name;
    const quote = calculateShippingQuoteForMethod(method, metrics);
    const option = document.createElement('option');
    option.value = method.id;
    option.textContent = buildShippingOptionLabel(method, zoneName, quote);
    option.disabled = Boolean(quote.error);
    option.dataset.cost = quote.error ? '' : quote.totalCost;
    option.dataset.quoteStatus = quote.error ? 'error' : 'ok';
    select.appendChild(option);
    availableOptions.push({ method, quote, option });
  });

  const firstAvailable = availableOptions.find(entry => !entry.quote.error);
  const preferred = availableOptions.find(entry => !entry.quote.error && entry.method.id === previousSelection);

  const chosen = preferred || firstAvailable || null;
  if (chosen) {
    select.value = chosen.method.id;
    shopState.selectedShippingMethod = chosen.method;
    shopState.shippingQuote = chosen.quote.error ? null : chosen.quote;
    if (chosen.quote.error) {
      select.setCustomValidity(shopState.lang === 'en' ? 'Shipping unavailable' : 'Dostawa niedostępna');
    } else {
      select.setCustomValidity('');
    }
    updateShippingInfo(chosen.method);
    renderShippingBreakdown('shippingMethodBreakdown', chosen.quote.error ? null : chosen.quote);
  } else {
    select.value = '';
    shopState.selectedShippingMethod = null;
    shopState.shippingQuote = null;
    if (select.options.length === 1) {
      select.options[0].textContent = shopState.lang === 'en'
        ? 'No shipping options for this country'
        : 'Brak metod wysyłki dla tego kraju';
    }
    if (infoEl) {
      infoEl.textContent = shopState.lang === 'en'
        ? 'Please contact support for shipping options.'
        : 'Skontaktuj się z nami w sprawie dostawy.';
      infoEl.classList.add('error');
    }
    renderShippingBreakdown('shippingMethodBreakdown', null);
  }
  
  // Auto-select first method if only one available
  if (!chosen && methods.length === 1) {
    select.value = methods[0].id;
  }

  refreshShippingOptionPricing();
  recalculateShippingQuote();
}

function updateShippingInfo(method) {
  const infoEl = document.getElementById('shippingMethodInfo');
  if (!infoEl) return;
  
  if (!method) {
    infoEl.textContent = '';
    infoEl.classList.remove('error');
    renderShippingBreakdown('shippingMethodBreakdown', null);
    return;
  }

  const desc = shopState.lang === 'en' && method.description_en ? method.description_en : method.description;
  const infoParts = [];

  const quote = shopState.shippingQuote && shopState.shippingQuote.methodId === method.id
    ? shopState.shippingQuote
    : null;

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
  
  if (quote) {
    const weightText = shopState.lang === 'en'
      ? `Total weight: ${quote.totalWeight?.toFixed(2) || 0} kg`
      : `Łączna waga: ${(quote.totalWeight?.toFixed(2) || 0)} kg`;
    infoParts.push(weightText);

    if (quote.freeShipping) {
      infoParts.push(shopState.lang === 'en' ? 'Free shipping threshold reached' : 'Próg darmowej dostawy osiągnięty');
    }

    if (quote.error) {
      const errorText = quote.error === 'overMaxWeight'
        ? (shopState.lang === 'en'
            ? `Package exceeds max weight (${quote.limit} kg)`
            : `Przesyłka przekracza maksymalną wagę (${quote.limit} kg)`)
        : (shopState.lang === 'en'
            ? 'Shipping not available'
            : 'Dostawa niedostępna');
      infoParts.push(errorText);
      infoEl.classList.add('error');
    } else {
      infoEl.classList.remove('error');
    }
  } else {
    infoEl.classList.remove('error');
  }
  
  infoEl.textContent = infoParts.join(' • ');
  renderShippingBreakdown('shippingMethodBreakdown', quote);
}

const DEFAULT_SHIPPING_CLASS_KEY = '__no_class__';

function formatCurrency(amount = 0) {
  return `€${(amount || 0).toFixed(2)}`;
}

function getShippingClassName(classId) {
  const cls = shopState.shippingClassesMap[classId];
  if (!cls) {
    return shopState.lang === 'en' ? 'Shipping class' : 'Klasa wysyłki';
  }
  if (shopState.lang === 'en' && cls.name_en) {
    return cls.name_en;
  }
  return cls.name || (shopState.lang === 'en' ? 'Shipping class' : 'Klasa wysyłki');
}

function getShippingComponentRows(quote) {
  if (!quote || !Array.isArray(quote.components)) return [];
  const rows = [];
  const t = (key) => {
    const dict = {
      base: { en: 'Base rate', pl: 'Opłata podstawowa' },
      perWeight: { en: 'Weight surcharge', pl: 'Dopłata wagowa' },
      perItem: { en: 'Per-item surcharge', pl: 'Dopłata za sztukę' },
      insurance: { en: 'Shipping insurance', pl: 'Ubezpieczenie przesyłki' },
      class: { en: 'Class surcharge', pl: 'Dopłata za klasę' },
      free: { en: 'Free shipping threshold reached', pl: 'Próg darmowej dostawy osiągnięty' },
      pending: { en: 'Shipping cost applied', pl: 'Koszt dostawy' }
    };
    const lang = shopState.lang === 'en' ? 'en' : 'pl';
    return dict[key]?.[lang] || dict[key]?.en || key;
  };

  quote.components.forEach((component) => {
    const amount = typeof component.amount === 'number' ? component.amount : null;
    switch (component.type) {
      case 'base':
        if (amount) rows.push({ label: t('base'), amount });
        break;
      case 'per_weight':
        if (amount) rows.push({ label: t('perWeight'), amount });
        break;
      case 'per_item':
        if (amount) rows.push({ label: t('perItem'), amount });
        break;
      case 'insurance':
        if (amount) rows.push({ label: t('insurance'), amount });
        break;
      case 'class':
        (component.items || []).forEach((item) => {
          if (typeof item.amount !== 'number' || !item.amount) return;
          const name = getShippingClassName(item.classId);
          rows.push({
            label: `${t('class')}: ${name}`,
            amount: item.amount
          });
        });
        break;
      case 'free_shipping':
        rows.push({ label: t('free'), amount: 0 });
        break;
      default:
        if (amount) rows.push({ label: t('pending'), amount });
    }
  });

  return rows;
}

function renderShippingBreakdown(containerOrId, quote) {
  const container = typeof containerOrId === 'string'
    ? document.getElementById(containerOrId)
    : containerOrId;
  if (!container) return;

  if (!quote) {
    container.innerHTML = '';
    container.classList.add('is-hidden');
    container.classList.remove('error');
    return;
  }

  container.classList.remove('is-hidden');
  container.classList.toggle('error', Boolean(quote.error));

  if (quote.error) {
    const errorText = quote.error === 'overMaxWeight'
      ? (shopState.lang === 'en'
          ? `Package exceeds maximum weight (${quote.limit || 0} kg)`
          : `Przesyłka przekracza maksymalną wagę (${quote.limit || 0} kg)`)
      : (shopState.lang === 'en'
          ? 'Shipping unavailable for this selection'
          : 'Metoda dostawy niedostępna');
    container.innerHTML = `<p>${errorText}</p>`;
    return;
  }

  if (quote.freeShipping) {
    const text = shopState.lang === 'en'
      ? 'Free shipping threshold reached'
      : 'Osiągnięto próg darmowej dostawy';
    container.innerHTML = `<p>${text}</p>`;
    return;
  }

  const rows = getShippingComponentRows(quote);
  if (!rows.length) {
    const text = shopState.lang === 'en'
      ? `Shipping cost: ${formatCurrency(quote.totalCost)}`
      : `Koszt dostawy: ${formatCurrency(quote.totalCost)}`;
    container.innerHTML = `<p>${text}</p>`;
    return;
  }

  const listItems = rows.map(row => (
    `<li class="component-item">
      <span class="component-label">${row.label}</span>
      <span class="component-amount">${formatCurrency(row.amount)}</span>
    </li>`
  )).join('');

  container.innerHTML = `<ul class="component-list">${listItems}</ul>`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseClassCosts(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return {};
  }
}

function getCartShippingMetrics() {
  const metrics = {
    totalItems: 0,
    totalWeight: 0,
    subtotal: 0,
    classTotals: {}
  };
  
  shopState.cart
    .filter(item => item.requiresShipping !== false)
    .forEach(item => {
      const qty = item.quantity || 0;
      const weight = toNumber(item.weight) || 0;
      metrics.totalItems += qty;
      metrics.totalWeight += weight * qty;
      metrics.subtotal += getCartItemGrossUnitPrice(item) * qty;
      const classId = item.shippingClassId || DEFAULT_SHIPPING_CLASS_KEY;
      if (!metrics.classTotals[classId]) {
        metrics.classTotals[classId] = { quantity: 0, weight: 0 };
      }
      metrics.classTotals[classId].quantity += qty;
      metrics.classTotals[classId].weight += weight * qty;
    });
  
  return metrics;
}

function buildShippingComponentsLabel(type, amount) {
  switch (type) {
    case 'per_weight':
      return shopState.lang === 'en'
        ? `Weight-based: €${amount.toFixed(2)}`
        : `Za wagę: €${amount.toFixed(2)}`;
    case 'per_item':
      return shopState.lang === 'en'
        ? `Per item: €${amount.toFixed(2)}`
        : `Za sztukę: €${amount.toFixed(2)}`;
    default:
      return `€${amount.toFixed(2)}`;
  }
}

function calculateShippingQuoteForMethod(method, sharedMetrics = null) {
  const metrics = sharedMetrics || getCartShippingMetrics();
  const result = {
    methodId: method.id,
    methodName: method.name,
    totalItems: metrics.totalItems,
    totalWeight: roundCurrency(metrics.totalWeight || 0),
    components: [],
    classBreakdown: metrics.classTotals,
    freeShipping: false,
    error: null,
    limit: null,
    totalCost: 0
  };
  
  if (metrics.totalItems === 0) {
    result.totalCost = 0;
    return result;
  }
  
  const minWeight = toNumber(method.min_weight);
  const maxWeight = toNumber(method.max_weight);
  
  if (maxWeight && metrics.totalWeight > maxWeight) {
    result.error = 'overMaxWeight';
    result.limit = maxWeight;
    return result;
  }
  
  let cost = 0;
  const baseCost = toNumber(method.cost);
  if (baseCost) {
    cost += baseCost;
    result.components.push({ type: 'base', amount: roundCurrency(baseCost) });
  }
  
  const methodType = method.method_type || 'flat_rate';
  const perKgRate = toNumber(method.cost_per_kg);
  const perItemRate = toNumber(method.cost_per_item);
  const effectiveWeight = Math.max(metrics.totalWeight, minWeight);
  
  if (methodType === 'per_weight' || perKgRate > 0) {
    const perWeightCost = roundCurrency(effectiveWeight * perKgRate);
    if (perWeightCost) {
      cost += perWeightCost;
      result.components.push({ type: 'per_weight', amount: perWeightCost });
    }
  }
  
  if (methodType === 'per_item' || perItemRate > 0) {
    const perItemCost = roundCurrency(metrics.totalItems * perItemRate);
    if (perItemCost) {
      cost += perItemCost;
      result.components.push({ type: 'per_item', amount: perItemCost });
    }
  }
  
  // Class-based extras
  const classCostsConfig = parseClassCosts(method.class_costs);
  const classComponents = [];
  Object.entries(metrics.classTotals).forEach(([classId, data]) => {
    if (classId === DEFAULT_SHIPPING_CLASS_KEY) return;
    const clsData = shopState.shippingClassesMap[classId];
    let classCost = 0;
    if (clsData) {
      classCost += toNumber(clsData.extra_cost);
      classCost += data.weight * toNumber(clsData.extra_cost_per_kg);
      classCost += toNumber(clsData.handling_fee);
    }
    if (classCostsConfig[classId]) {
      const override = classCostsConfig[classId];
      classCost += toNumber(override.extra_cost);
      classCost += data.weight * toNumber(override.extra_cost_per_kg);
      classCost += toNumber(override.handling_fee);
    }
    if (classCost) {
      classCost = roundCurrency(classCost);
      classComponents.push({ classId, amount: classCost });
      cost += classCost;
    }
  });
  
  if (classComponents.length) {
    result.components.push({ type: 'class', items: classComponents });
  }
  
  // Insurance
  if (method.includes_insurance && toNumber(method.insurance_cost) > 0) {
    const insuranceCost = roundCurrency(toNumber(method.insurance_cost));
    cost += insuranceCost;
    result.components.push({ type: 'insurance', amount: insuranceCost });
  }
  
  // Free shipping threshold
  const freeThreshold = toNumber(method.free_shipping_threshold);
  if (freeThreshold && metrics.subtotal >= freeThreshold) {
    result.freeShipping = true;
    result.totalCost = 0;
    result.components = [{ type: 'free_shipping', amount: 0 }];
    return result;
  }
  
  result.totalCost = roundCurrency(cost);
  return result;
}

function buildShippingOptionLabel(method, zoneName, quote) {
  const methodName = shopState.lang === 'en' && method.name_en ? method.name_en : method.name;
  const zoneLabel = zoneName ? `(${zoneName})` : '';
  let priceLabel = '';
  if (quote.error) {
    priceLabel = shopState.lang === 'en' ? 'Not available' : 'Niedostępna';
  } else if (quote.totalCost === 0) {
    priceLabel = shopState.lang === 'en' ? 'FREE' : 'GRATIS';
  } else {
    priceLabel = `€${quote.totalCost.toFixed(2)}`;
  }
  return `${methodName} ${zoneLabel} - ${priceLabel}`.trim();
}

function recalculateShippingQuote() {
  const select = document.getElementById('checkoutShipping');
  if (!shopState.selectedShippingMethod) {
    shopState.shippingQuote = null;
    if (select) select.setCustomValidity('');
    updateShippingInfo(null);
    updateShippingTotalsUI();
    renderShippingBreakdown('shippingMethodBreakdown', null);
    renderShippingBreakdown('reviewShippingBreakdown', null);
    return;
  }
  
  const quote = calculateShippingQuoteForMethod(shopState.selectedShippingMethod);
  shopState.shippingQuote = quote;
  updateShippingInfo(shopState.selectedShippingMethod);
  updateShippingTotalsUI();
  refreshShippingOptionPricing();
  renderShippingBreakdown('reviewShippingBreakdown', quote.error ? null : quote);
  
  if (select) {
    if (quote.error) {
      select.setCustomValidity(shopState.lang === 'en' ? 'Shipping unavailable for this selection' : 'Ta metoda dostawy jest niedostępna');
    } else {
      select.setCustomValidity('');
    }
  }
}

function refreshShippingOptionPricing() {
  const select = document.getElementById('checkoutShipping');
  if (!select) return;
  const metrics = getCartShippingMetrics();
  Array.from(select.options).forEach(option => {
    if (!option.value) return;
    const method = shopState.shippingMethods.find(m => m.id === option.value);
    if (!method) return;
    const quote = calculateShippingQuoteForMethod(method, metrics);
    option.dataset.cost = quote.error ? '' : quote.totalCost;
    option.disabled = Boolean(quote.error);
    option.textContent = buildShippingOptionLabel(
      method,
      shopState.lang === 'en' && method.zone_name_en ? method.zone_name_en : method.zone_name,
      quote
    );
  });
}

function updateShippingTotalsUI() {
  const subtotal = getCartTotalGross();
  const shipping = shopState.shippingQuote && !shopState.shippingQuote.error
    ? shopState.shippingQuote.totalCost
    : 0;
  const preview = shopState.discountPreview && shopState.discountPreview.valid ? shopState.discountPreview : null;
  const discountAmount = preview && preview.discountAmount ? preview.discountAmount : 0;
  const effectiveShipping = preview && preview.freeShipping ? 0 : shipping;
  const total = Math.max(0, subtotal + effectiveShipping - discountAmount);
  const reviewSubtotalEl = document.getElementById('reviewSubtotal');
  const reviewShippingEl = document.getElementById('reviewShipping');
  const reviewVatRow = document.getElementById('reviewVatRow');
  const reviewVatEl = document.getElementById('reviewVat');
  const reviewDiscountRow = document.getElementById('reviewDiscountRow');
  const reviewDiscountEl = document.getElementById('reviewDiscount');
  const reviewTotalEl = document.getElementById('reviewTotal');
  const vatTotal = computeVatPreview(preview);
  const hasTaxableItems = shopState.taxSettings?.taxEnabled
    ? shopState.cart.some(item => getCartItemTaxRate(item) > 0)
    : false;
  
  if (reviewSubtotalEl) reviewSubtotalEl.textContent = `€${subtotal.toFixed(2)}`;
  if (reviewShippingEl) {
    if (shopState.shippingQuote?.error) {
      reviewShippingEl.textContent = shopState.lang === 'en' ? 'N/A' : 'Brak';
    } else if (effectiveShipping === 0) {
      reviewShippingEl.textContent = shopState.lang === 'en' ? 'Free' : 'Gratis';
    } else {
      reviewShippingEl.textContent = `€${effectiveShipping.toFixed(2)}`;
    }
  }
  if (reviewVatRow && reviewVatEl) {
    if (hasTaxableItems && vatTotal > 0) {
      reviewVatRow.hidden = false;
      reviewVatEl.textContent = `€${vatTotal.toFixed(2)}`;
    } else {
      reviewVatRow.hidden = true;
      reviewVatEl.textContent = '€0.00';
    }
  }
  if (reviewDiscountRow && reviewDiscountEl) {
    if (discountAmount > 0) {
      reviewDiscountRow.hidden = false;
      reviewDiscountEl.textContent = `-€${discountAmount.toFixed(2)}`;
    } else {
      reviewDiscountRow.hidden = true;
      reviewDiscountEl.textContent = '-€0.00';
    }
  }
  if (reviewTotalEl) reviewTotalEl.textContent = `€${total.toFixed(2)}`;
  renderShippingBreakdown(
    'reviewShippingBreakdown',
    shopState.shippingQuote && !shopState.shippingQuote.error
      ? shopState.shippingQuote
      : shopState.shippingQuote?.error
        ? shopState.shippingQuote
        : null
  );
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

async function loadShippingClasses() {
  if (!supabase) return;
  
  try {
    const { data: classes, error } = await supabase
      .from('shop_shipping_classes')
      .select('*')
      .order('sort_order');
    
    if (error) throw error;
    
    shopState.shippingClasses = classes || [];
    shopState.shippingClassesMap = (classes || []).reduce((acc, cls) => {
      acc[cls.id] = cls;
      return acc;
    }, {});
    
  } catch (error) {
    console.error('Failed to load shipping classes:', error);
  }
}

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
      const product = shopState.products.find(p => p.id === productId);
      if (product && product.product_type === 'variable') {
        openProductModal(productId);
      } else {
        addToCart(productId);
      }
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

  const variants = product.product_type === 'variable'
    ? await loadProductVariants(productId)
    : [];
  const selectedVariant = variants.find(v => v.is_default) || variants[0] || null;

  const basePrice = parseFloat(product.price);
  const baseCompareAt = product.compare_at_price ? parseFloat(product.compare_at_price) : null;

  const selectedPrice = selectedVariant && selectedVariant.price !== null && selectedVariant.price !== undefined
    ? parseFloat(selectedVariant.price)
    : basePrice;
  const selectedCompareAt = selectedVariant && selectedVariant.compare_at_price !== null && selectedVariant.compare_at_price !== undefined
    ? parseFloat(selectedVariant.compare_at_price)
    : baseCompareAt;

  const hasDiscount = selectedCompareAt && selectedCompareAt > selectedPrice;
  const selectedStockQty = selectedVariant
    ? (typeof selectedVariant.stock_quantity === 'number'
        ? selectedVariant.stock_quantity
        : parseInt(selectedVariant.stock_quantity, 10) || 0)
    : (typeof product.stock_quantity === 'number' ? product.stock_quantity : parseInt(product.stock_quantity, 10) || 0);
  const isInStock = !product.track_inventory || selectedStockQty > 0;
  const maxQty = product.track_inventory ? Math.max(0, selectedStockQty) : 99;

  // Localized content
  const productName = getLocalizedField(product, 'name');
  const productDesc = getLocalizedField(product, 'description');
  const categoryName = product.category ? getLocalizedField(product.category, 'name') : '';
  const inStockText = shopState.lang === 'en' ? '✓ In stock' : '✓ W magazynie';
  const outOfStockText = shopState.lang === 'en' ? '✗ Out of stock' : '✗ Brak w magazynie';
  const qtyLabel = shopState.lang === 'en' ? 'Quantity:' : 'Ilość:';
  const addToCartText = shopState.lang === 'en' ? 'Add to cart' : 'Dodaj do koszyka';
  const variantLabel = shopState.lang === 'en' ? 'Variant:' : 'Wariant:';
  const missingVariantsText = shopState.lang === 'en'
    ? 'Variants are not available for this product yet.'
    : 'Warianty dla tego produktu nie są jeszcze dostępne.';

  const variantOptions = variants.map(v => {
    const vp = v.price !== null && v.price !== undefined ? parseFloat(v.price) : basePrice;
    const label = `${v.name}${vp !== basePrice ? ` - €${vp.toFixed(2)}` : ''}`;
    const selected = selectedVariant && v.id === selectedVariant.id ? 'selected' : '';
    return `<option value="${v.id}" ${selected}>${escapeHtml(label)}</option>`;
  }).join('');

  content.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-image" id="productModalImage">
        ${(selectedVariant?.image_url || product.thumbnail_url)
          ? `<img src="${selectedVariant?.image_url || product.thumbnail_url}" alt="${escapeHtml(productName)}">`
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
          <span class="current" id="productModalPriceCurrent">€${selectedPrice.toFixed(2)}</span>
          ${hasDiscount ? `<span class="original" id="productModalPriceOriginal">€${(selectedCompareAt || 0).toFixed(2)}</span>` : '<span class="original" id="productModalPriceOriginal" style="display:none"></span>'}
        </div>
        ${productDesc ? `<p class="product-detail-description">${escapeHtml(productDesc)}</p>` : ''}
        ${product.product_type === 'variable' && variants.length === 0
          ? `<p class="product-detail-stock out-of-stock">${missingVariantsText}</p>`
          : ''
        }
        <p class="product-detail-stock ${isInStock ? 'in-stock' : 'out-of-stock'}" id="productModalStock">
          ${isInStock ? inStockText : outOfStockText}
        </p>
        ${variants.length > 0 ? `
          <div class="product-detail-quantity">
            <label>${variantLabel}</label>
            <div class="quantity-selector" style="gap: 12px;">
              <select id="productVariantSelect" style="width: 100%; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.18); color: inherit;">
                ${variantOptions}
              </select>
            </div>
          </div>
        ` : ''}
        <div class="product-detail-quantity">
          <label>${qtyLabel}</label>
          <div class="quantity-selector">
            <button type="button" id="btnQtyMinus">−</button>
            <input type="number" id="productQty" value="1" min="1" max="${Math.max(1, maxQty)}">
            <button type="button" id="btnQtyPlus">+</button>
          </div>
        </div>
        <button class="btn-add-to-cart-large" id="btnAddToCartModal" ${(product.product_type === 'variable' && variants.length === 0) || !isInStock ? 'disabled' : ''} data-product-id="${product.id}">
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
  const addBtn = document.getElementById('btnAddToCartModal');

  if (minusBtn && qtyInput) {
    minusBtn.onclick = () => {
      const val = parseInt(qtyInput.value) || 1;
      if (val > 1) qtyInput.value = val - 1;
    };
  }

  if (plusBtn && qtyInput) {
    plusBtn.onclick = () => {
      const val = parseInt(qtyInput.value) || 1;
      const max = parseInt(qtyInput.max, 10) || maxQty;
      if (val < max) qtyInput.value = val + 1;
    };
  }

  const variantSelect = document.getElementById('productVariantSelect');
  const priceCurrentEl = document.getElementById('productModalPriceCurrent');
  const priceOriginalEl = document.getElementById('productModalPriceOriginal');
  const stockEl = document.getElementById('productModalStock');
  const imageEl = document.getElementById('productModalImage');

  const getSelectedVariant = () => {
    const vid = variantSelect && variantSelect.value ? variantSelect.value : null;
    if (!vid) return null;
    return variants.find(v => v.id === vid) || null;
  };

  const updateVariantUi = () => {
    const v = getSelectedVariant() || selectedVariant;
    const vPrice = v && v.price !== null && v.price !== undefined ? parseFloat(v.price) : basePrice;
    const vCompare = v && v.compare_at_price !== null && v.compare_at_price !== undefined
      ? parseFloat(v.compare_at_price)
      : baseCompareAt;
    const vHasDiscount = vCompare && vCompare > vPrice;
    const vStockQty = v
      ? (typeof v.stock_quantity === 'number' ? v.stock_quantity : parseInt(v.stock_quantity, 10) || 0)
      : selectedStockQty;
    const vInStock = !product.track_inventory || vStockQty > 0;
    const vMaxQty = product.track_inventory ? Math.max(0, vStockQty) : 99;

    if (priceCurrentEl) priceCurrentEl.textContent = `€${vPrice.toFixed(2)}`;
    if (priceOriginalEl) {
      if (vHasDiscount) {
        priceOriginalEl.style.display = '';
        priceOriginalEl.textContent = `€${(vCompare || 0).toFixed(2)}`;
      } else {
        priceOriginalEl.style.display = 'none';
        priceOriginalEl.textContent = '';
      }
    }

    if (stockEl) {
      stockEl.classList.toggle('in-stock', vInStock);
      stockEl.classList.toggle('out-of-stock', !vInStock);
      stockEl.textContent = vInStock ? inStockText : outOfStockText;
    }

    if (qtyInput) {
      qtyInput.max = String(Math.max(1, vMaxQty));
      const currentQty = parseInt(qtyInput.value, 10) || 1;
      if (product.track_inventory && vMaxQty > 0 && currentQty > vMaxQty) {
        qtyInput.value = String(vMaxQty);
      }
      if (product.track_inventory && vMaxQty === 0) {
        qtyInput.value = '1';
      }
    }

    if (imageEl) {
      const newUrl = v?.image_url || product.thumbnail_url || null;
      if (newUrl) {
        imageEl.innerHTML = `<img src="${newUrl}" alt="${escapeHtml(productName)}">`;
      }
    }

    if (addBtn) {
      addBtn.disabled = !vInStock || (product.product_type === 'variable' && variants.length === 0);
    }
  };

  if (variantSelect) {
    variantSelect.addEventListener('change', () => {
      updateVariantUi();
    });
  }

  updateVariantUi();

  // Add to cart button
  if (addBtn) {
    addBtn.onclick = () => {
      const qty = parseInt(qtyInput?.value) || 1;
      const v = getSelectedVariant();
      const vPrice = v && v.price !== null && v.price !== undefined ? parseFloat(v.price) : basePrice;
      const vWeight = v && v.weight !== null && v.weight !== undefined
        ? parseFloat(v.weight)
        : (typeof product.weight === 'number' ? product.weight : parseFloat(product.weight) || 0);
      const vImage = v?.image_url || product.thumbnail_url || null;
      addToCart(product.id, qty, v?.id || null, v?.name || null, vPrice, vWeight, vImage);
      closeProductModal();
    };
  }
}

async function loadProductVariants(productId) {
  if (!supabase) return [];
  if (shopState.productVariants[productId]) {
    return shopState.productVariants[productId];
  }

  try {
    const { data, error } = await supabase
      .from('shop_product_variants')
      .select('id, product_id, name, price, compare_at_price, stock_quantity, weight, image_url, attributes, is_default, is_active, sort_order')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    shopState.productVariants[productId] = data || [];
    return shopState.productVariants[productId];
  } catch (error) {
    console.error('Failed to load variants:', error);
    shopState.productVariants[productId] = [];
    return [];
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
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        shopState.cart = parsed.map(item => ({
          productId: item.productId,
          variantId: item.variantId || item.variant_id || null,
          name: item.name || '',
          variantName: item.variantName || item.variant_name || null,
          price: parseFloat(item.price) || 0,
          thumbnail: item.thumbnail || null,
          quantity: parseInt(item.quantity, 10) > 0 ? parseInt(item.quantity, 10) : 1,
          weight: toNumber(item.weight),
          shippingClassId: item.shippingClassId || item.shipping_class_id || null,
          requiresShipping: item.requiresShipping !== undefined ? item.requiresShipping : true
        }));
      } else {
        shopState.cart = [];
      }
    }
  } catch (e) {
    console.error('Failed to load cart:', e);
    shopState.cart = [];
  }
}

function loadDiscountCodeFromStorage() {
  try {
    const raw = localStorage.getItem('shop_discount_code');
    shopState.discountCode = raw ? String(raw).trim().toUpperCase() : null;
  } catch (e) {
    shopState.discountCode = null;
  }
}

function saveDiscountCodeToStorage() {
  try {
    if (shopState.discountCode) {
      localStorage.setItem('shop_discount_code', String(shopState.discountCode));
    } else {
      localStorage.removeItem('shop_discount_code');
    }
  } catch (e) {
  }
}

function clearDiscountCode() {
  shopState.discountCode = null;
  shopState.discountPreview = null;
  saveDiscountCodeToStorage();
}

function getDiscountCodeNormalized(input) {
  if (!input) return null;
  const code = String(input).trim().toUpperCase();
  return code ? code : null;
}

async function applyDiscountCode(codeInput) {
  const code = getDiscountCodeNormalized(codeInput);
  if (!code) {
    clearDiscountCode();
    await refreshDiscountPreview();
    updateShippingTotalsUI();
    return;
  }

  shopState.discountCode = code;
  saveDiscountCodeToStorage();
  await refreshDiscountPreview();
  updateShippingTotalsUI();

  try {
    await syncCartToSupabase();
  } catch (e) {
  }
}

function updateDiscountUiControls() {
  const input = document.getElementById('checkoutDiscountCode');
  const btnApply = document.getElementById('btnApplyDiscount');
  const btnClear = document.getElementById('btnClearDiscount');
  if (input) {
    input.value = shopState.discountCode || '';
  }
  if (btnClear) {
    btnClear.hidden = !shopState.discountCode;
  }
  if (btnApply) {
    btnApply.disabled = false;
  }
}

async function refreshDiscountPreview() {
  const infoEl = document.getElementById('discountInfo');
  shopState.discountPreview = null;
  updateDiscountUiControls();

  if (!shopState.discountCode) {
    if (infoEl) infoEl.textContent = '';
    return;
  }

  if (!supabase) {
    if (infoEl) {
      infoEl.textContent = shopState.lang === 'en'
        ? 'Discount code will be validated at checkout.'
        : 'Kod rabatowy zostanie zweryfikowany przy płatności.';
    }
    return;
  }

  try {
    const { data: auth } = await supabase.auth.getUser();
    const authedUser = auth?.user || null;

    const { data: discountRows, error } = await supabase
      .from('shop_discounts')
      .select('*')
      .ilike('code', shopState.discountCode)
      .eq('is_active', true)
      .limit(1);

    const discount = Array.isArray(discountRows) ? discountRows[0] : null;

    if (error || !discount) {
      shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'not_found' };
      if (infoEl) {
        infoEl.textContent = shopState.lang === 'en' ? 'Invalid discount code.' : 'Nieprawidłowy kod rabatowy.';
      }
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
    const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;
    if ((startsAt && now < startsAt) || (expiresAt && now >= expiresAt)) {
      shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'expired' };
      if (infoEl) {
        infoEl.textContent = shopState.lang === 'en' ? 'Discount code is expired.' : 'Kod rabatowy wygasł.';
      }
      return;
    }

    if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
      shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'limit' };
      if (infoEl) {
        infoEl.textContent = shopState.lang === 'en' ? 'Discount code limit reached.' : 'Limit użyć kodu został wyczerpany.';
      }
      return;
    }

    const subtotal = getCartTotalGross();
    if (discount.minimum_order_amount && subtotal < parseFloat(discount.minimum_order_amount)) {
      shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'min_order' };
      if (infoEl) {
        infoEl.textContent = shopState.lang === 'en'
          ? `Minimum order: €${parseFloat(discount.minimum_order_amount).toFixed(2)}`
          : `Minimalna wartość zamówienia: €${parseFloat(discount.minimum_order_amount).toFixed(2)}`;
      }
      return;
    }

    if (discount.maximum_order_amount && subtotal > parseFloat(discount.maximum_order_amount)) {
      shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'max_order' };
      if (infoEl) {
        infoEl.textContent = shopState.lang === 'en'
          ? `Maximum order: €${parseFloat(discount.maximum_order_amount).toFixed(2)}`
          : `Maksymalna wartość zamówienia: €${parseFloat(discount.maximum_order_amount).toFixed(2)}`;
      }
      return;
    }

    const allowedUsers = Array.isArray(discount.user_ids) ? discount.user_ids : [];
    if (allowedUsers.length > 0) {
      if (!authedUser) {
        shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'auth_required' };
        if (infoEl) {
          infoEl.textContent = shopState.lang === 'en'
            ? 'Please log in to use this discount code.'
            : 'Zaloguj się, aby użyć tego kodu rabatowego.';
        }
        return;
      }
      if (!allowedUsers.includes(authedUser.id)) {
        shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'not_allowed' };
        if (infoEl) {
          infoEl.textContent = shopState.lang === 'en'
            ? 'This discount code is not available for your account.'
            : 'Ten kod rabatowy nie jest dostępny dla Twojego konta.';
        }
        return;
      }
    }

    if (discount.first_purchase_only === true) {
      if (!authedUser) {
        shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'auth_required' };
        if (infoEl) {
          infoEl.textContent = shopState.lang === 'en'
            ? 'Please log in to use this discount code.'
            : 'Zaloguj się, aby użyć tego kodu rabatowego.';
        }
        return;
      }

      const { count: paidCount } = await supabase
        .from('shop_orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authedUser.id)
        .in('payment_status', ['paid', 'partially_refunded', 'refunded'])
        .limit(1);

      if (typeof paidCount === 'number' && paidCount > 0) {
        shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'first_purchase_only' };
        if (infoEl) {
          infoEl.textContent = shopState.lang === 'en'
            ? 'This discount code is only valid for your first order.'
            : 'Ten kod rabatowy jest ważny tylko na pierwsze zamówienie.';
        }
        return;
      }
    }

    const perUserLimit = Math.max(0, parseInt(discount.usage_limit_per_user, 10) || 0);
    if (perUserLimit > 0 && authedUser && discount.id) {
      const { count: usedCount } = await supabase
        .from('shop_orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authedUser.id)
        .eq('discount_id', discount.id)
        .in('payment_status', ['paid', 'partially_refunded', 'refunded'])
        .limit(perUserLimit);

      if (typeof usedCount === 'number' && usedCount >= perUserLimit) {
        shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'per_user_limit' };
        if (infoEl) {
          infoEl.textContent = shopState.lang === 'en'
            ? 'You have already used this discount code.'
            : 'Ten kod rabatowy został już użyty na Twoim koncie.';
        }
        return;
      }
    }

    let eligibleSubtotal = 0;
    const eligibleMask = new Array(shopState.cart.length).fill(false);
    const applicableProducts = Array.isArray(discount.applicable_product_ids) ? discount.applicable_product_ids : [];
    const applicableCategories = Array.isArray(discount.applicable_category_ids) ? discount.applicable_category_ids : [];
    const applicableVendors = Array.isArray(discount.applicable_vendor_ids) ? discount.applicable_vendor_ids : [];
    let appliesTo = discount.applies_to || 'all';
    if (appliesTo === 'products' && applicableProducts.length === 0) appliesTo = 'all';
    if (appliesTo === 'categories' && applicableCategories.length === 0) appliesTo = 'all';
    if (appliesTo === 'vendors' && applicableVendors.length === 0) appliesTo = 'all';
    const excludeProducts = Array.isArray(discount.exclude_product_ids) ? discount.exclude_product_ids : [];
    const excludeCategories = Array.isArray(discount.exclude_category_ids) ? discount.exclude_category_ids : [];

    shopState.cart.forEach((item, idx) => {
      const product = shopState.products.find(p => p.id === item.productId);
      if (!product) return;

      if (discount.exclude_sale_items === true) {
        const saleItem = isProductInActiveSaleWindow(product, nowIso);
        if (saleItem) return;
      }

      if (excludeProducts.includes(item.productId)) return;
      if (product.category_id && excludeCategories.includes(product.category_id)) return;

      let eligible = true;
      if (appliesTo === 'products') {
        eligible = applicableProducts.includes(item.productId);
      } else if (appliesTo === 'categories') {
        eligible = product.category_id ? applicableCategories.includes(product.category_id) : false;
      } else if (appliesTo === 'vendors') {
        eligible = product.vendor_id ? applicableVendors.includes(product.vendor_id) : false;
      }

      if (!eligible) return;
      eligibleMask[idx] = true;
      const grossUnit = getCartItemGrossUnitPrice(item);
      eligibleSubtotal += (grossUnit * item.quantity);
    });

    let discountAmount = 0;
    let freeShipping = false;
    const type = discount.discount_type || 'percentage';
    const value = parseFloat(discount.discount_value || 0);

    if (type === 'free_shipping') {
      freeShipping = true;
    } else {
      if (eligibleSubtotal <= 0) {
        shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'not_applicable' };
        if (infoEl) {
          infoEl.textContent = shopState.lang === 'en'
            ? 'This discount code does not apply to items in your cart.'
            : 'Ten kod rabatowy nie dotyczy produktów w koszyku.';
        }
        return;
      }

      if (type === 'percentage') {
        discountAmount = (eligibleSubtotal * value) / 100;
      } else {
        discountAmount = Math.min(value, eligibleSubtotal);
      }
    }

    if (discount.maximum_discount_amount) {
      discountAmount = Math.min(discountAmount, parseFloat(discount.maximum_discount_amount));
    }

    discountAmount = Math.max(0, Math.round((discountAmount + Number.EPSILON) * 100) / 100);

    shopState.discountPreview = {
      code: shopState.discountCode,
      valid: true,
      type,
      freeShipping,
      discountAmount,
      eligibleMask,
      description: (shopState.lang === 'en' && discount.description_en) ? discount.description_en : discount.description
    };

    if (infoEl) {
      const desc = shopState.discountPreview.description;
      infoEl.textContent = desc
        ? `${shopState.discountCode} — ${desc}`
        : (shopState.lang === 'en' ? 'Discount code applied.' : 'Kod rabatowy zastosowany.');
    }
  } catch (e) {
    shopState.discountPreview = { code: shopState.discountCode, valid: false, reason: 'error' };
    if (infoEl) {
      infoEl.textContent = shopState.lang === 'en'
        ? 'Unable to validate discount code right now.'
        : 'Nie udało się zweryfikować kodu rabatowego.';
    }
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('shop_cart', JSON.stringify(shopState.cart));
    // Also sync to Supabase if user is logged in
    syncCartToSupabase();
    // Recalculate shipping quote when cart changes
    if (shopState.selectedShippingMethod) {
      recalculateShippingQuote();
    }
    if (shopState.discountCode) {
      refreshDiscountPreview().then(() => updateShippingTotalsUI());
    } else {
      shopState.discountPreview = null;
      updateShippingTotalsUI();
    }
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
      .select('id, discount_code')
      .eq('user_id', user.id)
      .single();
    
    if (dbCart) {
      shopState.discountCode = dbCart.discount_code ? String(dbCart.discount_code).trim().toUpperCase() : (shopState.discountCode || null);
      saveDiscountCodeToStorage();
      const { data: items } = await supabase
        .from('shop_cart_items')
        .select('product_id, variant_id, quantity, shop_products(id, name, price, thumbnail_url, weight, shipping_class_id, is_virtual), variant:shop_product_variants(id, name, price, weight, image_url)')
        .eq('cart_id', dbCart.id);
      
      if (items && items.length > 0) {
        // Merge with local cart - prefer Supabase data
        const supabaseCart = items.map(item => ({
          productId: item.product_id,
          variantId: item.variant_id || null,
          name: item.shop_products?.name || '',
          variantName: item.variant?.name || null,
          price: parseFloat((item.variant?.price ?? item.shop_products?.price) || 0),
          thumbnail: item.variant?.image_url || item.shop_products?.thumbnail_url || null,
          quantity: item.quantity,
          weight: parseFloat((item.variant?.weight ?? item.shop_products?.weight) || 0) || 0,
          shippingClassId: item.shop_products?.shipping_class_id || null,
          requiresShipping: item.shop_products?.is_virtual ? false : true
        })).filter(item => item.name);
        
        // Merge: Supabase items take precedence, but keep local items not in Supabase
        const mergedCart = [...supabaseCart];
        shopState.cart.forEach(localItem => {
          if (!mergedCart.find(i => i.productId === localItem.productId && (i.variantId || null) === (localItem.variantId || null))) {
            mergedCart.push(localItem);
          }
        });
        
        shopState.cart = mergedCart;
        localStorage.setItem('shop_cart', JSON.stringify(shopState.cart));
        updateCartUI();
      }

      await refreshDiscountPreview();
      updateShippingTotalsUI();
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
        .insert({ user_id: user.id, discount_code: shopState.discountCode || null })
        .select('id')
        .single();
      cart = newCart;
    }
    
    if (!cart) return;

    await supabase
      .from('shop_carts')
      .update({ discount_code: shopState.discountCode || null })
      .eq('id', cart.id);
    
    // Clear existing items and insert new ones
    await supabase
      .from('shop_cart_items')
      .delete()
      .eq('cart_id', cart.id);
    
    if (shopState.cart.length > 0) {
      const items = shopState.cart.map(item => ({
        cart_id: cart.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
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

function addToCart(productId, quantity = 1, variantId = null, variantName = null, priceOverride = null, weightOverride = null, imageOverride = null) {
  const product = shopState.products.find(p => p.id === productId);
  if (!product) return;

  const normalizedVariantId = variantId || null;
  const existingItem = shopState.cart.find(item => item.productId === productId && (item.variantId || null) === normalizedVariantId);

  const weight = typeof weightOverride === 'number'
    ? weightOverride
    : (typeof product.weight === 'number' ? product.weight : parseFloat(product.weight) || 0);
  const shippingClassId = product.shipping_class_id || product.shippingClassId || null;
  const requiresShipping = product.is_virtual ? false : true;
  const price = typeof priceOverride === 'number' ? priceOverride : parseFloat(product.price);
  const thumbnail = imageOverride !== null && imageOverride !== undefined
    ? imageOverride
    : product.thumbnail_url;

  if (existingItem) {
    existingItem.quantity += quantity;
    // Update mutable fields in case product details changed
    existingItem.price = price;
    existingItem.weight = weight;
    existingItem.shippingClassId = shippingClassId;
    existingItem.requiresShipping = requiresShipping;
    existingItem.variantName = variantName || existingItem.variantName || null;
    if (thumbnail !== undefined) {
      existingItem.thumbnail = thumbnail;
    }
  } else {
    shopState.cart.push({
      productId: product.id,
      variantId: normalizedVariantId,
      name: product.name,
      variantName: variantName || null,
      price: price,
      thumbnail: thumbnail || null,
      quantity,
      weight,
      shippingClassId,
      requiresShipping
    });
  }

  saveCartToStorage();
  updateCartUI();
  const variantLabel = variantName ? ` (${variantName})` : '';
  showToast(
    shopState.lang === 'en'
      ? `Added to cart: ${product.name}${variantLabel} × ${quantity}`
      : `Dodano do koszyka: ${product.name}${variantLabel} × ${quantity}`,
    'success'
  );
}

function removeFromCart(productId, variantId = null) {
  const normalizedVariantId = variantId || null;
  shopState.cart = shopState.cart.filter(item => !(item.productId === productId && (item.variantId || null) === normalizedVariantId));
  saveCartToStorage();
  updateCartUI();
}

function updateCartItemQuantity(productId, variantId, quantity) {
  const normalizedVariantId = variantId || null;
  const item = shopState.cart.find(item => item.productId === productId && (item.variantId || null) === normalizedVariantId);
  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId, normalizedVariantId);
    } else {
      item.quantity = quantity;
      saveCartToStorage();
      updateCartUI();
    }
  }
}

function getCartTotal() {
  return getCartTotalGross();
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
    <div class="cart-item" data-product-id="${item.productId}" data-variant-id="${item.variantId || ''}">
      <div class="cart-item-image">
        ${item.thumbnail 
          ? `<img src="${item.thumbnail}" alt="${escapeHtml(item.name)}">`
          : ''
        }
      </div>
      <div class="cart-item-details">
        <h4 class="cart-item-name">${escapeHtml(item.name)}</h4>
        ${item.variantName ? `<p class="cart-item-price" style="opacity:.85; margin-top:-6px;">${escapeHtml(item.variantName)}</p>` : ''}
        <p class="cart-item-price">€${getCartItemGrossUnitPrice(item).toFixed(2)}</p>
        <div class="cart-item-quantity">
          <button class="btn-qty-minus" data-product-id="${item.productId}" data-variant-id="${item.variantId || ''}">−</button>
          <span>${item.quantity}</span>
          <button class="btn-qty-plus" data-product-id="${item.productId}" data-variant-id="${item.variantId || ''}">+</button>
        </div>
        <button class="btn-remove-item" data-product-id="${item.productId}" data-variant-id="${item.variantId || ''}">${removeText}</button>
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
      const vid = btn.dataset.variantId || null;
      const item = shopState.cart.find(i => i.productId === id && (i.variantId || null) === (vid || null));
      if (item) updateCartItemQuantity(id, vid, item.quantity - 1);
    };
  });

  itemsContainer.querySelectorAll('.btn-qty-plus').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.productId;
      const vid = btn.dataset.variantId || null;
      const item = shopState.cart.find(i => i.productId === id && (i.variantId || null) === (vid || null));
      if (item) updateCartItemQuantity(id, vid, item.quantity + 1);
    };
  });

  itemsContainer.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.onclick = () => removeFromCart(btn.dataset.productId, btn.dataset.variantId || null);
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
    showToast(shopState.lang === 'en' ? 'Please log in' : 'Zaloguj się', 'error');
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

      // Refresh shipping + VAT after programmatic country update
      await refreshTaxRatesFromUi();
      updateShippingMethodsDropdown(address.country || '');
      await refreshDiscountPreview();
      updateShippingTotalsUI();
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
    updateDiscountUiControls();
    
    // Initialize shipping methods based on current country selection
    const countrySelect = document.getElementById('checkoutCountry');
    if (countrySelect) {
      refreshTaxRatesFromUi()
        .then(() => {
          updateShippingMethodsDropdown(countrySelect.value);
        })
        .then(() => refreshDiscountPreview())
        .then(() => updateShippingTotalsUI())
        .catch(() => {});
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

async function goToReviewStep() {
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

  // Recalculate shipping quote before reviewing
  recalculateShippingQuote();
  if (!shopState.shippingQuote || shopState.shippingQuote.error) {
    showToast(shopState.lang === 'en' ? 'Selected shipping is unavailable' : 'Wybrana metoda dostawy jest niedostępna', 'error');
    return;
  }
  
  // Populate review section
  await refreshDiscountPreview();
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
        <span class="review-item-name">${escapeHtml(item.name)}${item.variantName ? ` <small style="opacity:.8">(${escapeHtml(item.variantName)})</small>` : ''}</span>
        <span class="review-item-qty">× ${item.quantity}</span>
        <span class="review-item-price">€${(getCartItemGrossUnitPrice(item) * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');
  }
  
  // Totals
  updateShippingTotalsUI();
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
  let redirectInitiated = false;
  
  try {
    const shippingMetrics = getCartShippingMetrics();
    let shippingQuote = shopState.shippingQuote;
    if (!shippingQuote || shippingQuote.methodId !== shopState.selectedShippingMethod.id) {
      shippingQuote = calculateShippingQuoteForMethod(shopState.selectedShippingMethod);
    }
    
    if (!shippingQuote || shippingQuote.error) {
      showToast(shopState.lang === 'en' ? 'Selected shipping is unavailable' : 'Wybrana metoda dostawy jest niedostępna', 'error');
      btnSubmit.disabled = false;
      btnSubmit.textContent = shopState.lang === 'en' ? 'Place Order & Pay' : 'Złóż zamówienie';
      return;
    }
    
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
      variant_id: item.variantId || undefined,
      quantity: item.quantity,
      product_name: item.name,
      variant_name: item.variantName || undefined,
      unit_price: item.price,
      image_url: item.thumbnail || undefined,
      weight: item.weight || 0,
      shipping_class_id: item.shippingClassId || null,
      requires_shipping: item.requiresShipping !== false
    }));

    const customerNotes = document.getElementById('checkoutNotes').value.trim() || undefined;
    
    // Get current page URL for success/cancel redirects (works for /szop rewrites and preserves lang)
    const successUrl = (() => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('checkout', 'success');
        url.searchParams.delete('order_id');
        url.searchParams.delete('session_id');
        url.hash = '';
        return `${url.origin}${url.pathname}${url.search}`;
      } catch (e) {
        const baseUrl = window.location.origin;
        return `${baseUrl}/shop.html?checkout=success`;
      }
    })();

    const cancelUrl = (() => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('checkout', 'cancelled');
        url.searchParams.delete('order_id');
        url.searchParams.delete('session_id');
        url.hash = '';
        return `${url.origin}${url.pathname}${url.search}`;
      } catch (e) {
        const baseUrl = window.location.origin;
        return `${baseUrl}/shop.html?checkout=cancelled`;
      }
    })();

    const checkoutPayload = {
      user_id: checkoutUser.id,
      items: items,
      discount_code: shopState.discountCode || undefined,
      shipping_address: shippingAddress,
      shipping_method_id: shopState.selectedShippingMethod.id,
      shipping_details: {
        metrics: shippingMetrics,
        quote: shippingQuote
      },
      customer_notes: customerNotes,
      success_url: successUrl,
      cancel_url: cancelUrl
    };
    
    // Debug: log shipping details being sent
    console.log('[checkout] shippingQuote:', shippingQuote);
    console.log('[checkout] shippingQuote.totalCost:', shippingQuote?.totalCost);
    console.log('[checkout] shippingMetrics:', shippingMetrics);

    // Call Stripe checkout edge function
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: checkoutPayload
    });

    if (error) throw error;

    persistCheckoutDebugSnapshot(checkoutPayload, data);
    if (isCheckoutUiDebugEnabled()) {
      const fv = data?.function_version ? `fv=${data.function_version}` : 'fv=?';
      const totals = (data && typeof data === 'object')
        ? `subtotal=€${Number(data.items_subtotal || 0).toFixed(2)} shipping=€${Number(data.shipping_cost || 0).toFixed(2)} total=€${Number(data.order_total || 0).toFixed(2)}`
        : '';
      showToast(`Checkout debug zapisany (${fv}) ${totals}`.trim(), 'info');
    }
    
    if (data?.session_url) {
      // Redirect to Stripe Checkout
      redirectInitiated = true;
      window.location.href = data.session_url;
    } else {
      throw new Error('No checkout URL returned');
    }
    
  } catch (error) {
    console.error('Checkout error:', error);
    try {
      showToast(shopState.lang === 'en' ? 'Error starting payment' : 'Błąd podczas uruchamiania płatności', 'error');
    } catch (e) {
    }
  } finally {
    if (!redirectInitiated) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = shopState.lang === 'en' ? 'Pay with Stripe' : 'Zapłać przez Stripe';
    }
  }
}

function showCheckoutPopup(type, message) {
  const title = (() => {
    if (type === 'success') return shopState.lang === 'en' ? 'Payment successful' : 'Płatność zakończona sukcesem';
    if (type === 'error') return shopState.lang === 'en' ? 'Payment not completed' : 'Płatność nie została zakończona';
    return shopState.lang === 'en' ? 'Payment status' : 'Status płatności';
  })();

  const successPopup = window.showSuccessPopup;
  const errorPopup = window.showErrorPopup;
  if (type === 'success' && typeof successPopup === 'function') {
    successPopup(title, message);
    return;
  }
  if (type === 'error' && typeof errorPopup === 'function') {
    errorPopup(title, message);
    return;
  }

  const toastType = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
  showToast(message, toastType);
}

async function clearCartInSupabaseForUser(userId) {
  if (!supabase || !userId) return;
  try {
    const { data: cart } = await supabase
      .from('shop_carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart?.id) return;

    await supabase
      .from('shop_cart_items')
      .delete()
      .eq('cart_id', cart.id);

    await supabase
      .from('shop_carts')
      .update({ discount_code: null })
      .eq('id', cart.id);
  } catch (e) {
  }
}

function cleanCheckoutParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('order_id');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url);
  } catch (e) {
  }
}

function showCheckoutProcessingOverlay(title, message) {
  try {
    const existing = document.getElementById('checkoutProcessingOverlay');
    if (existing) {
      const titleEl = existing.querySelector('.checkout-processing-title');
      const msgEl = existing.querySelector('.checkout-processing-text');
      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'checkoutProcessingOverlay';
    overlay.className = 'checkout-processing-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="checkout-processing-card">
        <div class="checkout-processing-spinner" aria-hidden="true"></div>
        <h3 class="checkout-processing-title">${escapeHtml(title)}</h3>
        <p class="checkout-processing-text">${escapeHtml(message)}</p>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
  }
}

function hideCheckoutProcessingOverlay() {
  try {
    const existing = document.getElementById('checkoutProcessingOverlay');
    if (existing) existing.remove();
  } catch (e) {
  }
}

async function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const rawCheckoutStatus = String(params.get('checkout') || '').trim();
  const checkoutStatus = rawCheckoutStatus.split('?')[0];
  const orderId = params.get('order_id');

  if (checkoutStatus !== 'success' && checkoutStatus !== 'cancelled') {
    return;
  }

  const overlayTitle = shopState.lang === 'en' ? 'Checking payment status…' : 'Sprawdzamy status płatności…';
  const overlayMessage = shopState.lang === 'en'
    ? 'Please wait a moment. We are confirming your payment with Stripe.'
    : 'Poczekaj chwilę. Potwierdzamy płatność w systemie Stripe.';

  showCheckoutProcessingOverlay(overlayTitle, overlayMessage);

  try {
    if (checkoutStatus === 'success') {
      let isPaid = false;

      const checkPaidStatus = async () => {
        if (!supabase || !orderId) return false;
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user || null;
        if (!user) return false;

        const { data: orderRow } = await supabase
          .from('shop_orders')
          .select('payment_status')
          .eq('id', orderId)
          .maybeSingle();
        const status = String(orderRow?.payment_status || '').toLowerCase();
        return status === 'paid' || status === 'partially_refunded' || status === 'refunded';
      };

      try {
        for (let attempt = 0; attempt < 8; attempt++) {
          isPaid = await checkPaidStatus();
          if (isPaid) break;
          await new Promise(r => setTimeout(r, 750));
        }
      } catch (e) {
        isPaid = false;
      }

      if (isPaid) {
        try {
          const { data: auth } = await supabase.auth.getUser();
          const user = auth?.user || null;
          if (user) {
            await clearCartInSupabaseForUser(user.id);
          }
        } catch (e) {
        }

        shopState.cart = [];
        clearDiscountCode();
        saveCartToStorage();
        updateCartUI();

        showCheckoutPopup(
          'success',
          shopState.lang === 'en'
            ? 'Your payment was completed successfully. Thank you!'
            : 'Twoja płatność została zakończona pomyślnie. Dziękujemy!'
        );
      } else {
        const msg = shopState.lang === 'en'
          ? "We couldn't confirm your payment yet. Please check your bank account to see if the charge went through. If it didn't, try again. If it did, but you don't see a confirmation, please contact us. Your cart is still saved."
          : 'Nie udało się jeszcze potwierdzić płatności. Sprawdź proszę konto / aplikację bankową, czy środki zostały pobrane. Jeśli nie — spróbuj ponownie. Jeśli tak, a nie widzisz potwierdzenia, skontaktuj się z nami. Koszyk został zachowany.';
        showCheckoutPopup('error', msg);
      }

      cleanCheckoutParamsFromUrl();
    } else if (checkoutStatus === 'cancelled') {
      showCheckoutPopup(
        'error',
        shopState.lang === 'en'
          ? 'Payment was cancelled. Your cart items are still saved.'
          : 'Płatność została anulowana. Produkty w koszyku zostały zachowane.'
      );

      cleanCheckoutParamsFromUrl();
    }
  } finally {
    hideCheckoutProcessingOverlay();
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

  // Discount code
  const discountInput = document.getElementById('checkoutDiscountCode');
  const btnApplyDiscount = document.getElementById('btnApplyDiscount');
  const btnClearDiscount = document.getElementById('btnClearDiscount');

  if (btnApplyDiscount) {
    btnApplyDiscount.addEventListener('click', async () => {
      const code = discountInput ? discountInput.value : '';
      await applyDiscountCode(code);
    });
  }

  if (btnClearDiscount) {
    btnClearDiscount.addEventListener('click', async () => {
      clearDiscountCode();
      if (discountInput) discountInput.value = '';
      await refreshDiscountPreview();
      updateShippingTotalsUI();
      try {
        await syncCartToSupabase();
      } catch (e) {
      }
    });
  }

  if (discountInput) {
    discountInput.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        await applyDiscountCode(discountInput.value);
      }
    });
  }

  // Country change - update shipping methods
  const countrySelect = document.getElementById('checkoutCountry');
  if (countrySelect) {
    countrySelect.addEventListener('change', async () => {
      await refreshTaxRatesFromUi();
      updateShippingMethodsDropdown(countrySelect.value);
      await refreshDiscountPreview();
      updateShippingTotalsUI();
    });
  }

  // Shipping method change
  const shippingSelect = document.getElementById('checkoutShipping');
  if (shippingSelect) {
    shippingSelect.addEventListener('change', () => {
      const methodId = shippingSelect.value;
      const method = shopState.shippingMethods.find(m => m.id === methodId);
      shopState.selectedShippingMethod = method || null;
      if (method) {
        shopState.shippingQuote = calculateShippingQuoteForMethod(method);
      } else {
        shopState.shippingQuote = null;
      }
      updateShippingInfo(method);
      updateShippingTotalsUI();
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

function showToast(message, type = 'success', ttl = 3500) {
  try {
    const toastApi = window.Toast && typeof window.Toast.show === 'function' ? window.Toast.show : null;
    if (toastApi) {
      const normalizedType = type === 'error' ? 'error' : (type === 'info' || type === 'warning') ? 'info' : 'success';
      toastApi(message, normalizedType, ttl);
      return;
    }
  } catch (e) {
  }

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  if (!normalizedMessage) return;

  const normalizedType = type === 'error' ? 'error' : (type === 'info' || type === 'warning') ? 'info' : 'success';
  const toast = document.createElement('div');
  toast.className = `ce-toast ce-toast--${normalizedType}`;
  toast.textContent = normalizedMessage;
  toast.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', normalizedType === 'error' ? 'assertive' : 'polite');
  toast.style.zIndex = '16000';

  document.body.appendChild(toast);
  const timer = window.setTimeout(() => toast.remove(), Number.isFinite(ttl) ? ttl : 3500);
  toast.addEventListener('click', () => {
    window.clearTimeout(timer);
    toast.remove();
  });
}

// Export for global access
window.shopAddToCart = addToCart;
window.shopOpenCart = openCart;
window.shopCloseCart = closeCart;
