// Home page trips section loader
// Loads and displays trips from Supabase on the main page

let homeTripsData = [];
let homeTripsCurrentCity = 'all';
let homeTripsDisplay = [];
let homeCurrentTrip = null;
let homeCurrentIndex = null;
let homeTripsSavedOnly = false;
let homeTripCouponState = { applied: null };

const CE_DEBUG_HOME_TRIPS = typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true';
function ceLog(...args) {
  if (CE_DEBUG_HOME_TRIPS) console.log(...args);
}

const HOME_TRIPS_CACHE_KEY = 'ce_cache_home_trips_v1';
const HOME_TRIPS_CACHE_TTL_MS = 10 * 60 * 1000;

function normalizeHomeTripsErrorMessage(message, fallback = 'Wystąpił błąd.') {
  const raw = (typeof message === 'string' ? message : String(message?.message || message || '')).trim();
  if (!raw) return fallback;
  const authUtils = (typeof window !== 'undefined' && window.CE_AUTH_UTILS && typeof window.CE_AUTH_UTILS.toUserMessage === 'function')
    ? window.CE_AUTH_UTILS
    : null;
  if (authUtils && typeof authUtils.toUserMessage === 'function') {
    return authUtils.toUserMessage(raw, 'Session expired. Please sign in again.');
  }
  return raw;
}

function readHomeTripsCache() {
  try {
    const raw = localStorage.getItem(HOME_TRIPS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeHomeTripsCache(data) {
  try {
    if (!Array.isArray(data)) return;
    localStorage.setItem(HOME_TRIPS_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch (_) {}
}

function scheduleTripsRerenderWhenI18nReady() {
  if (window.getTripName) return;
  let attempts = 0;
  const tick = () => {
    attempts += 1;
    if (window.getTripName) {
      if (homeTripsData && homeTripsData.length > 0) {
        renderHomeTripsTabs();
        renderHomeTrips();
      }
      return;
    }
    if (attempts >= 300) return;
    const delay = attempts < 50 ? 100 : 500;
    setTimeout(tick, delay);
  };
  setTimeout(tick, 100);
}

async function waitForSupabaseClientHomeTrips(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const client =
      window.supabase ||
      window.sb ||
      window.__SB__ ||
      (typeof window.getSupabase === 'function' ? window.getSupabase() : null);
    if (client) return client;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;
}

// Translation helper for trips - reads directly from appI18n.translations
function tripsT(key, fallback) {
  try {
    const lang = (window.appI18n && window.appI18n.language) || 
                 document.documentElement.lang || 'pl';
    const translations = window.appI18n?.translations?.[lang];
    if (!translations) return fallback;
    
    // Try flat key first (e.g., "trips.tabs.allCities")
    if (translations[key]) return translations[key];
    
    // Try nested path (e.g., trips.tabs.allCities -> translations.trips.tabs.allCities)
    const parts = key.split('.');
    let value = translations;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return fallback;
      }
    }
    return typeof value === 'string' ? value : fallback;
  } catch (e) {
    return fallback;
  }
}

// Prefill trip booking form from logged-in user session
async function prefillTripFormFromSession(form) {
  if (!form) return;
  
  try {
    // Wait for auth to be ready
    if (typeof window.waitForAuthReady === 'function') {
      await window.waitForAuthReady();
    }
    
    const session = window.CE_STATE?.session;
    const profile = window.CE_STATE?.profile;
    
    // Prefill email from session
    if (session?.user?.email) {
      const emailField = form.querySelector('[name="email"]');
      if (emailField && !emailField.value) {
        emailField.value = session.user.email;
        emailField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { emailField.style.backgroundColor = ''; }, 2000);
      }
    }
    
    // Prefill name from profile
    if (profile?.full_name || profile?.username || profile?.name) {
      const nameField = form.querySelector('[name="name"]');
      if (nameField && !nameField.value) {
        nameField.value = profile.full_name || profile.name || profile.username || '';
        nameField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { nameField.style.backgroundColor = ''; }, 2000);
      }
    }
    
    // Prefill phone from profile
    if (profile?.phone) {
      const phoneField = form.querySelector('[name="phone"]');
      if (phoneField && !phoneField.value) {
        phoneField.value = profile.phone;
        phoneField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { phoneField.style.backgroundColor = ''; }, 2000);
      }
    }
  } catch (err) {
    console.warn('Could not prefill trip form:', err);
  }
}

// Load trips from Supabase (exactly like trips.html)
async function loadHomeTrips() {
  try {
    const cached = readHomeTripsCache();
    if (cached && cached.length > 0) {
      homeTripsData = cached;
      renderHomeTripsTabs();
      renderHomeTrips();
    }
    scheduleTripsRerenderWhenI18nReady();
    
    const supabase = await waitForSupabaseClientHomeTrips();
    
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Fetch published trips - ordered exactly like trips.html
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    homeTripsData = data || [];
    writeHomeTripsCache(homeTripsData);
    ceLog('✅ Loaded trips:', homeTripsData.length);
    renderHomeTripsTabs();
    renderHomeTrips();

  } catch (err) {
    console.error('❌ Failed to load trips:', err);
    document.getElementById('tripsHomeGrid').innerHTML = '<p style="text-align:center;color:#ef4444;">Błąd ładowania wycieczek</p>';
  }
}

// Get unique cities from trips
function getTripCities() {
  const cities = new Set();
  homeTripsData.forEach(trip => {
    if (trip.start_city && trip.start_city !== 'All Cities') {
      cities.add(trip.start_city);
    }
  });
  return Array.from(cities).sort();
}

// Render trip city tabs with translations
function renderHomeTripsTabs() {
  const tabsWrap = document.getElementById('tripsHomeTabs');
  if (!tabsWrap) return;
  
  // Get translated label using tripsT helper
  const allCitiesLabel = tripsT('trips.tabs.allCities', 'Wszystkie miasta');
  const lang = String((window.appI18n && window.appI18n.language) || document.documentElement?.lang || 'pl').toLowerCase();
  const savedLabel = lang.startsWith('en') ? 'Saved' : 'Zapisane';
  const savedStar = homeTripsSavedOnly ? '★' : '☆';
  
  const tabs = [`<button type="button" class="trips-home-tab ce-home-pill${homeTripsCurrentCity === 'all' ? ' active' : ''}" data-city="all">${allCitiesLabel}</button>`];
  getTripCities().forEach(city => {
    tabs.push(`<button type="button" class="trips-home-tab ce-home-pill${homeTripsCurrentCity === city ? ' active' : ''}" data-city="${city}">${city}</button>`);
  });
  tabs.push(`<button type="button" class="trips-home-tab ce-home-pill${homeTripsSavedOnly ? ' active' : ''}" data-filter="saved" aria-pressed="${homeTripsSavedOnly ? 'true' : 'false'}">${savedLabel} ${savedStar}</button>`);
  tabsWrap.innerHTML = tabs.join('');
  initHomeTripsTabs();
}

// Render trips grid
function renderHomeTrips() {
  const grid = document.getElementById('tripsHomeGrid');
  if (!grid) return;

  let filteredTrips = homeTripsData;

  // Filter by city if not 'all'.
  // Homepage behaviour:
  // - "Wszystkie miasta": wszystkie wycieczki
  // - Konkretne miasto (np. Ayia Napa, Paphos):
  //     * wycieczki z tym miastem
  //     * + globalne wycieczki z start_city = 'All Cities'.
  if (homeTripsCurrentCity !== 'all') {
    filteredTrips = homeTripsData.filter(trip => 
      trip.start_city === homeTripsCurrentCity ||
      trip.start_city === 'All Cities'
    );
  }

  if (homeTripsSavedOnly) {
    const api = window.CE_SAVED_CATALOG;
    if (api && typeof api.isSaved === 'function') {
      filteredTrips = filteredTrips.filter(trip => api.isSaved('trip', String(trip?.id || '')));
    } else {
      filteredTrips = [];
    }
  }

  // Show all trips on home page (carousel arrows handle overflow)
  const displayTrips = filteredTrips;
  homeTripsDisplay = displayTrips;
  
  ceLog('Current city:', homeTripsCurrentCity);
  ceLog('Filtered trips:', filteredTrips.length);
  ceLog('Display trips:', displayTrips.length);

  if (displayTrips.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #9ca3af;">
        Brak wycieczek w tym mieście
      </div>
    `;
    return;
  }

  grid.innerHTML = displayTrips.map((trip, index) => {
    const imageUrl = trip.cover_image_url || '/assets/cyprus_logo-1000x1054.png';
    
    // Get title (support multilingual or slug)
    const title = window.getTripName ? window.getTripName(trip) : (trip.title?.pl || trip.title?.en || trip.title || trip.slug || 'Wycieczka');
    
    // DEBUG: Log what we're rendering
    if (index === 0) {
      ceLog('🔍 Trips render debug:', {
        hasTripName: !!window.getTripName,
        currentLang: window.getCurrentLanguage ? window.getCurrentLanguage() : 'unknown',
        tripTitle: trip.title,
        renderedTitle: title
      });
    }
    
    // Get price based on pricing model (same as trips.html)
    const pricingModel = trip.pricing_model || 'per_person';
    let priceLabel = '';
    const perHourLabel = tripsT('trips.card.perHour', '/ godz.');
    const perDayLabel = tripsT('trips.card.perDay', '/ dzień');
    
    if (pricingModel === 'per_person' && trip.price_per_person) {
      priceLabel = `${Number(trip.price_per_person).toFixed(2)} €`;
    } else if (trip.price_base) {
      priceLabel = `${Number(trip.price_base).toFixed(2)} €`;
    } else if (trip.hourly_rate) {
      priceLabel = `${Number(trip.hourly_rate).toFixed(2)} € ${perHourLabel}`;
    } else if (trip.daily_rate) {
      priceLabel = `${Number(trip.daily_rate).toFixed(2)} € ${perDayLabel}`;
    }

    return `
      <a 
        href="#" 
        class="trip-home-card"
        style="
          position: relative;
          height: 200px;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.3s, box-shadow 0.3s;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          text-decoration: none;
          display: block;
        "
        onclick="openTripModalHome(${index}); return false;"
        onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 12px rgba(0,0,0,0.15)'"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'"
      >
        <button
          type="button"
          data-ce-save="1"
          data-item-type="trip"
          data-ref-id="${String(trip.id || '')}"
          aria-label="Zapisz"
          title="Zapisz"
          onclick="event.preventDefault(); event.stopPropagation();"
          style="
            position: absolute;
            top: 10px;
            right: 10px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            font-size: 20px;
            line-height: 1;
            z-index: 5;
            cursor: pointer;
            user-select: none;
          "
        >☆</button>
        <img 
          src="${imageUrl}" 
          alt="${title}"
          style="
            width: 100%;
            height: 100%;
            object-fit: cover;
          "
          onerror="this.src='/assets/cyprus_logo-1000x1054.png'"
        />
        <div style="
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 70%, transparent 100%);
          padding: 16px;
          color: white;
        ">
          <h3 style="
            margin: 0 0 4px;
            font-size: 1.1rem;
            font-weight: 700;
            line-height: 1.3;
          ">${title}</h3>
          <p style="
            margin: 0;
            font-size: 0.85rem;
            opacity: 0.98;
            color: #ffffff;
            text-shadow: 0 1px 2px rgba(0,0,0,0.35);
          ">${trip.start_city || ''} ${priceLabel ? '• ' + priceLabel : ''}</p>
        </div>
      </a>
    `;
  }).join('');

  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
      window.CE_SAVED_CATALOG.refreshButtons(grid);
    }
  } catch (_) {}
}

// Handle city tab clicks
function initHomeTripsTabs() {
  const tabs = document.querySelectorAll('.trips-home-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const filter = this.getAttribute('data-filter');
      if (filter === 'saved') {
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

        if (!homeTripsSavedOnly) {
          try {
            const syncFn = window.CE_SAVED_CATALOG && window.CE_SAVED_CATALOG.syncForCurrentUser;
            if (typeof syncFn === 'function') {
              void Promise.resolve(syncFn()).finally(() => {
                homeTripsSavedOnly = true;
                renderHomeTripsTabs();
                renderHomeTrips();
              });
              return;
            }
          } catch (_) {}
        }

        homeTripsSavedOnly = !homeTripsSavedOnly;
        renderHomeTripsTabs();
        renderHomeTrips();
        return;
      }

      const city = this.getAttribute('data-city');
      if (!city) return;
      
      // Update active state
      tabs.forEach(t => {
        if (t.getAttribute('data-city')) {
          t.classList.remove('active');
        }
      });
      this.classList.add('active');
      
      // Update current city and re-render
      homeTripsCurrentCity = city;
      ceLog('Filtering by city:', city);
      renderHomeTrips();
    });
  });
}

// Initialize when DOM is ready (exactly like trips.html)
function initHomeTrips() {
  loadHomeTrips();
  initHomeTripsTabs();

  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.subscribe === 'function') {
      window.CE_SAVED_CATALOG.subscribe(() => {
        if (homeTripsSavedOnly) {
          renderHomeTrips();
        }
      });
    }
  } catch (_) {}
  // init carousel arrows for trips
  const prev = document.querySelector('.home-carousel-container .home-carousel-nav.prev[data-target="#tripsHomeGrid"]');
  const next = document.querySelector('.home-carousel-container .home-carousel-nav.next[data-target="#tripsHomeGrid"]');
  const grid = document.getElementById('tripsHomeGrid');
  const scrollBy = () => Math.round(grid.clientWidth * 0.85);
  const updateArrows = () => {
    if (!prev || !next || !grid) return;
    const maxScroll = grid.scrollWidth - grid.clientWidth - 1;
    const atStart = grid.scrollLeft <= 1;
    const atEnd = grid.scrollLeft >= maxScroll;
    prev.hidden = atStart;
    next.hidden = atEnd;
    // hide both if no overflow
    const noOverflow = grid.scrollWidth <= grid.clientWidth + 1;
    if (noOverflow) { prev.hidden = true; next.hidden = true; }
  };
  if (prev && grid) prev.addEventListener('click', () => { grid.scrollBy({left: -scrollBy(), behavior: 'smooth'}); setTimeout(updateArrows, 350); });
  if (next && grid) next.addEventListener('click', () => { grid.scrollBy({left: scrollBy(), behavior: 'smooth'}); setTimeout(updateArrows, 350); });
  if (grid) grid.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
  
  // Register language change handler (legacy method)
  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler((language) => {
      ceLog('🗺️ Trips: Re-rendering for language:', language);
      if (homeTripsData && homeTripsData.length > 0) {
        renderHomeTripsTabs();
        renderHomeTrips();
        ceLog('✅ Trips re-rendered');
      }
    });
  }
  
  // Direct event listeners (backup - more reliable)
  window.addEventListener('languageChanged', (e) => {
    ceLog('🗺️ Trips: languageChanged event, re-rendering for:', e.detail?.language);
    if (homeTripsData && homeTripsData.length > 0) {
      renderHomeTripsTabs();
      renderHomeTrips();
    }
  });
  
  document.addEventListener('wakacjecypr:languagechange', (e) => {
    ceLog('🗺️ Trips: wakacjecypr:languagechange event, re-rendering for:', e.detail?.language);
    if (homeTripsData && homeTripsData.length > 0) {
      renderHomeTripsTabs();
      renderHomeTrips();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeTrips);
} else {
  initHomeTrips();
}

// --- Modal logic identical to /trips ---
function calculateTripPrice(trip, adults, children, hours, days) {
  adults = parseInt(adults) || 1;
  children = parseInt(children) || 0;
  hours = parseInt(hours) || 1;
  days = parseInt(days) || 1;
  const pricing = trip.pricing_model;
  let price = 0;
  if (pricing === 'per_person') {
    const pricePerPerson = Number(trip.price_per_person) || 0;
    price = pricePerPerson * (adults + children);
  } else if (pricing === 'base_plus_extra') {
    const basePrice = Number(trip.price_base) || 0;
    const includedPeople = Number(trip.included_people) || 1;
    const extraPrice = Number(trip.price_extra_person) || 0;
    const totalPeople = adults + children;
    price = basePrice;
    if (totalPeople > includedPeople) {
      price += (totalPeople - includedPeople) * extraPrice;
    }
  } else if (pricing === 'per_hour') {
    const hourlyRate = Number(trip.price_base) || 0;
    price = hourlyRate * hours;
  } else if (pricing === 'per_day') {
    const dailyRate = Number(trip.price_base) || 0;
    price = dailyRate * days;
  } else {
    price = Number(trip.price_base) || Number(trip.price_per_person) || 0;
  }
  return price;
}

function normalizeHomeTripCouponCode(value) {
  return String(value || '').trim().toUpperCase();
}

function formatHomeTripPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0.00 €';
  return `${amount.toFixed(2)} €`;
}

function extractHomeTripMissingColumn(error) {
  const message = String(error?.message || '');
  const pattern = /Could not find the ['"]([^'"]+)['"] column/i;
  const match = message.match(pattern);
  if (match && match[1]) return String(match[1]).trim();
  return '';
}

function normalizeHomeTripCouponResult(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    isValid: Boolean(row.is_valid),
    message: String(row.message || ''),
    couponId: row.coupon_id ? String(row.coupon_id) : null,
    couponCode: normalizeHomeTripCouponCode(row.coupon_code || ''),
    discountAmount: Number(row.discount_amount || 0),
    finalTotal: Number(row.final_total || 0),
    baseTotal: Number(row.base_total || 0),
    partnerId: row.partner_id ? String(row.partner_id) : null,
    partnerCommissionBpsOverride: row.partner_commission_bps_override ?? null,
  };
}

async function quoteHomeTripCoupon(params) {
  if (window.CE_SERVICE_COUPONS?.quoteServiceCoupon) {
    return window.CE_SERVICE_COUPONS.quoteServiceCoupon(params);
  }
  const supabase = await waitForSupabaseClientHomeTrips();
  if (!supabase) return { ok: false, message: 'Supabase client not available', result: null };
  const payload = {
    p_service_type: 'trips',
    p_coupon_code: normalizeHomeTripCouponCode(params.couponCode || ''),
    p_base_total: Number(params.baseTotal || 0),
    p_service_at: params.serviceAt ? new Date(params.serviceAt).toISOString() : null,
    p_resource_id: params.resourceId || null,
    p_category_keys: Array.isArray(params.categoryKeys) ? params.categoryKeys : [],
    p_user_id: null,
    p_user_email: params.userEmail || null,
  };
  const { data, error } = await supabase.rpc('service_coupon_quote', payload);
  if (error) return { ok: false, message: String(error.message || 'Coupon validation failed'), result: null };
  const row = Array.isArray(data) ? data[0] : data;
  const result = normalizeHomeTripCouponResult(row);
  if (!result?.isValid) {
    return { ok: false, message: result?.message || 'Coupon invalid', result };
  }
  return { ok: true, message: result.message || 'Coupon applied', result };
}

function getHomeTripCouponContext(baseTotal) {
  const base = Number(baseTotal) || 0;
  const code = normalizeHomeTripCouponCode(document.getElementById('bookingCouponCode')?.value || '');
  const applied = homeTripCouponState.applied;
  const appliedCode = normalizeHomeTripCouponCode(applied?.couponCode || '');
  const hasApplied = Boolean(applied && code && appliedCode === code);
  const discount = hasApplied ? Math.min(base, Number(applied?.discountAmount || 0)) : 0;
  return {
    code,
    hasApplied,
    discount,
    baseTotal: base,
    finalTotal: Math.max(0, base - discount),
  };
}

function setHomeTripCouponStatus(message = '', type = 'info') {
  const statusEl = document.getElementById('bookingCouponStatus');
  if (!statusEl) return;
  const text = String(message || '').trim();
  if (!text) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.style.color = '#475569';
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = text;
  statusEl.style.color = type === 'error'
    ? '#b91c1c'
    : (type === 'success' ? '#0f766e' : '#475569');
}

function syncHomeTripCouponButtons() {
  const applyBtn = document.getElementById('bookingApplyCoupon');
  const clearBtn = document.getElementById('bookingClearCoupon');
  const code = normalizeHomeTripCouponCode(document.getElementById('bookingCouponCode')?.value || '');
  if (applyBtn) applyBtn.disabled = !code || !homeCurrentTrip;
  if (clearBtn) clearBtn.hidden = !code && !homeTripCouponState.applied;
}

function clearHomeTripCouponState(options = {}) {
  const clearInput = options.clearInput !== false;
  homeTripCouponState.applied = null;
  if (clearInput) {
    const input = document.getElementById('bookingCouponCode');
    if (input) input.value = '';
  }
  setHomeTripCouponStatus('', 'info');
  syncHomeTripCouponButtons();
}

function invalidateHomeTripCouponAfterChange() {
  if (!homeTripCouponState.applied) return;
  homeTripCouponState.applied = null;
  const code = normalizeHomeTripCouponCode(document.getElementById('bookingCouponCode')?.value || '');
  if (code) {
    setHomeTripCouponStatus(tripsT('trips.booking.coupon.reapply', 'Szczegóły wycieczki się zmieniły. Zastosuj kupon ponownie.'), 'info');
  } else {
    setHomeTripCouponStatus('', 'info');
  }
  syncHomeTripCouponButtons();
}

function ensureHomeTripCouponUi() {
  const form = document.getElementById('bookingForm');
  if (!form || form.querySelector('[data-trip-coupon-ui]')) return;
  const notesField = document.getElementById('bookingNotes')?.closest('.form-field');
  if (!notesField) return;
  const box = document.createElement('div');
  box.className = 'form-field';
  box.setAttribute('data-trip-coupon-ui', '1');
  box.innerHTML = `
    <label for="bookingCouponCode">${tripsT('trips.booking.coupon.label', 'Kod kuponu')}</label>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;">
      <input type="text" id="bookingCouponCode" maxlength="64" autocomplete="off" placeholder="${tripsT('trips.booking.coupon.placeholder', 'Wpisz kod kuponu')}" />
      <button type="button" id="bookingApplyCoupon" class="booking-submit" style="padding:10px 14px;min-height:42px;">${tripsT('trips.booking.coupon.apply', 'Zastosuj')}</button>
      <button type="button" id="bookingClearCoupon" class="booking-submit" style="padding:10px 14px;min-height:42px;background:#475569;" hidden>${tripsT('trips.booking.coupon.clear', 'Wyczyść')}</button>
    </div>
    <p id="bookingCouponStatus" style="margin:6px 0 0;font-size:12px;color:#475569;" hidden></p>
  `;
  const priceBox = form.querySelector('.trip-price-box');
  if (priceBox) form.insertBefore(box, priceBox);
  else notesField.insertAdjacentElement('afterend', box);

  const codeInput = document.getElementById('bookingCouponCode');
  const applyBtn = document.getElementById('bookingApplyCoupon');
  const clearBtn = document.getElementById('bookingClearCoupon');
  codeInput?.addEventListener('input', () => {
    const normalized = normalizeHomeTripCouponCode(codeInput.value);
    if (codeInput.value !== normalized) codeInput.value = normalized;
    const appliedCode = normalizeHomeTripCouponCode(homeTripCouponState.applied?.couponCode || '');
    if (appliedCode && normalized !== appliedCode) {
      homeTripCouponState.applied = null;
      setHomeTripCouponStatus('', 'info');
      updateLivePriceHome();
    }
    syncHomeTripCouponButtons();
  });
  codeInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void applyHomeTripCoupon();
    }
  });
  applyBtn?.addEventListener('click', () => { void applyHomeTripCoupon(); });
  clearBtn?.addEventListener('click', () => {
    clearHomeTripCouponState({ clearInput: true });
    updateLivePriceHome();
  });
  syncHomeTripCouponButtons();
}

async function applyHomeTripCoupon() {
  if (!homeCurrentTrip) return false;
  const code = normalizeHomeTripCouponCode(document.getElementById('bookingCouponCode')?.value || '');
  if (!code) {
    setHomeTripCouponStatus(tripsT('trips.booking.coupon.enterCode', 'Wpisz kod kuponu.'), 'error');
    syncHomeTripCouponButtons();
    return false;
  }
  const adults = document.getElementById('bookingAdults')?.value;
  const children = document.getElementById('bookingChildren')?.value;
  const hours = document.getElementById('bookingHours')?.value;
  const days = document.getElementById('bookingDays')?.value;
  const baseTotal = calculateTripPrice(homeCurrentTrip, adults, children, hours, days);
  if (!(baseTotal > 0)) {
    setHomeTripCouponStatus(tripsT('trips.booking.coupon.noPrice', 'Najpierw uzupełnij dane rezerwacji.'), 'error');
    syncHomeTripCouponButtons();
    return false;
  }
  const tripDate = String(document.getElementById('bookingDate')?.value || '').trim();
  const arrivalDate = String(document.getElementById('arrivalDate')?.value || '').trim();
  const serviceAt = tripDate || arrivalDate || null;
  const userEmail = String(document.getElementById('bookingEmail')?.value || '').trim().toLowerCase() || null;
  const categoryKeys = Array.from(new Set([
    String(homeCurrentTrip?.slug || '').trim().toLowerCase(),
    String(homeCurrentTrip?.start_city || '').trim().toLowerCase(),
  ].filter(Boolean)));
  const applyBtn = document.getElementById('bookingApplyCoupon');
  if (applyBtn) applyBtn.disabled = true;
  try {
    const response = await quoteHomeTripCoupon({
      couponCode: code,
      baseTotal,
      serviceAt,
      resourceId: homeCurrentTrip.id,
      categoryKeys,
      userEmail,
    });
    if (!response?.ok || !response.result) {
      homeTripCouponState.applied = null;
      setHomeTripCouponStatus(String(response?.message || tripsT('trips.booking.coupon.invalid', 'Ten kupon nie działa dla tej rezerwacji.')), 'error');
      updateLivePriceHome();
      return false;
    }
    homeTripCouponState.applied = {
      couponId: response.result.couponId || null,
      couponCode: normalizeHomeTripCouponCode(response.result.couponCode || code),
      discountAmount: Number(response.result.discountAmount || 0),
      partnerId: response.result.partnerId || null,
      partnerCommissionBpsOverride: response.result.partnerCommissionBpsOverride ?? null,
    };
    setHomeTripCouponStatus(
      tripsT('trips.booking.coupon.applied', 'Kupon zastosowany. Zniżka: {{amount}}')
        .replace('{{amount}}', formatHomeTripPrice(homeTripCouponState.applied.discountAmount)),
      'success',
    );
    updateLivePriceHome();
    return true;
  } catch (error) {
    console.error('Failed to apply home trip coupon:', error);
    homeTripCouponState.applied = null;
    setHomeTripCouponStatus(String(error?.message || tripsT('trips.booking.coupon.failed', 'Nie udało się zweryfikować kuponu.')), 'error');
    updateLivePriceHome();
    return false;
  } finally {
    syncHomeTripCouponButtons();
  }
}

function updateLivePriceHome() {
  if (!homeCurrentTrip) return;
  
  const adults = document.getElementById('bookingAdults').value;
  const children = document.getElementById('bookingChildren').value;
  const hours = document.getElementById('bookingHours').value;
  const days = document.getElementById('bookingDays').value;
  const baseTotal = calculateTripPrice(homeCurrentTrip, adults, children, hours, days);
  const coupon = getHomeTripCouponContext(baseTotal);
  document.getElementById('modalTripPrice').textContent = formatHomeTripPrice(coupon.finalTotal);
  syncHomeTripCouponButtons();
}

window.openTripModalHome = function(index){
  const trip = homeTripsDisplay[index];
  if (!trip) return;
  homeCurrentTrip = trip;
  homeCurrentIndex = index;
  const title = window.getTripName ? window.getTripName(trip) : (trip.title?.pl || trip.title?.en || trip.slug);
  const desc = window.getTripDescription ? window.getTripDescription(trip) : (trip.description?.pl || trip.description?.en || '');
  const image = trip.cover_image_url || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=600&fit=crop';
  document.getElementById('modalTripImage').src = image;
  document.getElementById('modalTripTitle').textContent = title;
  document.getElementById('modalTripSubtitle').textContent = trip.start_city || '';
  document.getElementById('modalTripDescription').innerHTML = desc.replace(/\n/g, '<br/>');

  const saveBtn = document.getElementById('modalTripSaveBtn');
  if (saveBtn) {
    saveBtn.setAttribute('data-ref-id', String(trip.id || ''));
    try {
      if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
        window.CE_SAVED_CATALOG.refreshButtons(saveBtn.parentElement || document);
      }
    } catch (_) {}
  }

  // Reset form and message
  const form = document.getElementById('bookingForm');
  if (form) { form.reset(); const msg = document.getElementById('bookingMessage'); if (msg) msg.style.display='none'; }
  ensureHomeTripCouponUi();
  clearHomeTripCouponState({ clearInput: true });
  
  // Prefill user data from session (if logged in)
  prefillTripFormFromSession(form);

  // Toggle fields based on pricing model (1:1)
  const peopleFields = document.getElementById('peopleFields');
  const timeFields = document.getElementById('timeFields');
  const hoursField = document.getElementById('bookingHours')?.parentElement;
  const daysField = document.getElementById('bookingDays')?.parentElement;
  const pricing = trip.pricing_model;
  if (pricing === 'per_hour') {
    if (peopleFields) peopleFields.style.display = 'none';
    if (timeFields) timeFields.style.display = 'grid';
    if (hoursField) hoursField.style.display = 'flex';
    if (daysField) daysField.style.display = 'none';
  } else if (pricing === 'per_day') {
    if (peopleFields) peopleFields.style.display = 'none';
    if (timeFields) timeFields.style.display = 'grid';
    if (hoursField) hoursField.style.display = 'none';
    if (daysField) daysField.style.display = 'flex';
  } else if (pricing === 'per_person' || pricing === 'base_plus_extra') {
    if (peopleFields) peopleFields.style.display = 'grid';
    if (timeFields) timeFields.style.display = 'none';
  } else {
    if (peopleFields) peopleFields.style.display = 'grid';
    if (timeFields) timeFields.style.display = 'none';
  }

  // Calculate initial price
  updateLivePriceHome();
  
  // Date validation - departure must be after arrival (EXACT copy from trips.html)
  const arrivalInput = document.getElementById('arrivalDate');
  const departureInput = document.getElementById('departureDate');
  
  arrivalInput.addEventListener('change', function() {
    if (departureInput.value && this.value > departureInput.value) {
      departureInput.value = this.value;
    }
    departureInput.min = this.value;
    invalidateHomeTripCouponAfterChange();
    updateLivePriceHome();
  });
  
  departureInput.addEventListener('change', function() {
    if (arrivalInput.value && this.value < arrivalInput.value) {
      this.value = arrivalInput.value;
    }
    invalidateHomeTripCouponAfterChange();
    updateLivePriceHome();
  });

  const bookingDateInput = document.getElementById('bookingDate');
  bookingDateInput?.addEventListener('change', () => {
    invalidateHomeTripCouponAfterChange();
    updateLivePriceHome();
  });
  const bookingEmailInput = document.getElementById('bookingEmail');
  bookingEmailInput?.addEventListener('change', () => {
    invalidateHomeTripCouponAfterChange();
  });
  
  // Remove old listeners and add new ones (EXACT copy from trips.html)
  const adultsInput = document.getElementById('bookingAdults');
  const childrenInput = document.getElementById('bookingChildren');
  const hoursInput = document.getElementById('bookingHours');
  const daysInput = document.getElementById('bookingDays');
  
  const newAdultsInput = adultsInput.cloneNode(true);
  const newChildrenInput = childrenInput.cloneNode(true);
  const newHoursInput = hoursInput.cloneNode(true);
  const newDaysInput = daysInput.cloneNode(true);
  
  adultsInput.parentNode.replaceChild(newAdultsInput, adultsInput);
  childrenInput.parentNode.replaceChild(newChildrenInput, childrenInput);
  hoursInput.parentNode.replaceChild(newHoursInput, hoursInput);
  daysInput.parentNode.replaceChild(newDaysInput, daysInput);
  
  // Add comprehensive event listeners for number inputs (EXACT copy from trips.html)
  const addAllEvents = (element) => {
    const onChange = () => {
      invalidateHomeTripCouponAfterChange();
      updateLivePriceHome();
    };
    element.addEventListener('input', onChange);
    element.addEventListener('change', onChange);
    element.addEventListener('click', onChange);  // For spinner buttons
    element.addEventListener('keyup', onChange);   // For arrow keys
  };
  
  addAllEvents(newAdultsInput);
  addAllEvents(newChildrenInput);
  addAllEvents(newHoursInput);
  addAllEvents(newDaysInput);

  const modal = document.getElementById('tripModal');
  if (typeof openSheet === 'function') {
    openSheet(modal);
  } else {
    // Fallback if modalUtils not loaded
    if (modal) { modal.hidden = false; modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
  }
  updateModalArrows();
};

window.closeTripModal = function(){
  const modal = document.getElementById('tripModal');
  if (typeof closeSheet === 'function') {
    closeSheet(modal);
  } else {
    // Fallback
    if (modal) { modal.classList.remove('active'); modal.hidden = true; document.body.style.overflow = ''; }
  }
  homeCurrentTrip = null;
  homeCurrentIndex = null;
};

function initHomeTripsModalHandlers() {
  const modal = document.getElementById('tripModal');
  if (modal) modal.addEventListener('click', (e)=>{ if (e.target === modal) closeTripModal(); });

  // Booking submit identical to trips.html
  const form = document.getElementById('bookingForm');
  if (form) form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if (!homeCurrentTrip) return;
    const fd = new FormData(form);
    const adults = parseInt(fd.get('adults')) || 1;
    const children = parseInt(fd.get('children')) || 0;
    const hours = parseInt(fd.get('hours')) || 1;
    const days = parseInt(fd.get('days')) || 1;
    const baseTotal = calculateTripPrice(homeCurrentTrip, adults, children, hours, days);
    const btn = form.querySelector('.booking-submit');
    const msg = document.getElementById('bookingMessage');
    
    // Hide previous messages
    if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
    
    try{
      if (btn){ btn.disabled = true; btn.textContent = 'Wysyłanie...'; }
      const couponCode = normalizeHomeTripCouponCode(document.getElementById('bookingCouponCode')?.value || '');
      const appliedCode = normalizeHomeTripCouponCode(homeTripCouponState.applied?.couponCode || '');
      if (couponCode && couponCode !== appliedCode) {
        const applied = await applyHomeTripCoupon();
        if (!applied) {
          throw new Error(tripsT('trips.booking.coupon.applyBeforeSubmit', 'Zastosuj poprawny kupon lub wyczyść pole kuponu przed rezerwacją.'));
        }
      }

      const coupon = getHomeTripCouponContext(baseTotal);
      const payload = {
        trip_id: homeCurrentTrip.id,
        trip_slug: homeCurrentTrip.slug,
        customer_name: fd.get('name'),
        customer_email: fd.get('email'),
        customer_phone: fd.get('phone'),
        trip_date: fd.get('trip_date'),
        arrival_date: fd.get('arrival_date'),
        departure_date: fd.get('departure_date'),
        num_adults: adults,
        num_children: children,
        num_hours: hours,
        num_days: days,
        notes: fd.get('notes'),
        base_price: coupon.baseTotal,
        final_price: coupon.finalTotal,
        total_price: coupon.finalTotal,
        coupon_id: coupon.hasApplied ? (homeTripCouponState.applied?.couponId || null) : null,
        coupon_code: coupon.hasApplied ? (homeTripCouponState.applied?.couponCode || coupon.code || null) : null,
        coupon_discount_amount: coupon.hasApplied ? Number(coupon.discount || 0) : 0,
        coupon_partner_id: coupon.hasApplied ? (homeTripCouponState.applied?.partnerId || null) : null,
        coupon_partner_commission_bps: coupon.hasApplied ? (homeTripCouponState.applied?.partnerCommissionBpsOverride ?? null) : null,
        status: 'pending',
      };
      const supabase = await waitForSupabaseClientHomeTrips();
      if (!supabase) throw new Error('Supabase client not available');
      let insertPayload = { ...payload };
      let insertError = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { error } = await supabase.from('trip_bookings').insert([insertPayload]);
        insertError = error;
        if (!insertError) break;
        const missingColumn = extractHomeTripMissingColumn(insertError);
        if (!missingColumn || !Object.prototype.hasOwnProperty.call(insertPayload, missingColumn)) break;
        delete insertPayload[missingColumn];
      }
      if (insertError) throw insertError;
      
      // Success - show beautiful popup (same as hotels)
      showSuccessPopup('✅ Rezerwacja przyjęta!', 'Skontaktujemy się z Tobą wkrótce. Dziękujemy!');
      
      // Reset form and clear validation errors
      form.reset();
      if (typeof clearFormValidation === 'function') {
        clearFormValidation(form);
      }
      clearHomeTripCouponState({ clearInput: true });
      updateLivePriceHome();
      
      // Optional: close modal after 3 seconds
      setTimeout(() => {
        const modalEl = document.getElementById('tripModal');
        if (modalEl && modalEl.classList.contains('active')) {
          closeTripModal();
        }
      }, 3000);
      
    }catch(err){
      console.error('❌ Booking error:', err);
      const uiMessage = normalizeHomeTripsErrorMessage(err, 'Wystąpił błąd podczas rezerwacji. Spróbuj ponownie.');
      // Show error popup
      if (typeof showErrorPopup === 'function') {
        showErrorPopup('❌ Błąd rezerwacji', uiMessage);
      } else {
        // Fallback to old message
        if (msg){ msg.textContent = uiMessage; msg.className='booking-message error'; msg.style.display='block'; }
      }
    }finally{
      if (btn){ btn.disabled=false; btn.textContent='Zarezerwuj'; }
    }
  });

  // Modal navigation
  const prevBtn = document.getElementById('tripModalPrev');
  const nextBtn = document.getElementById('tripModalNext');
  if (prevBtn) prevBtn.addEventListener('click', ()=>{
    if (homeCurrentIndex === null) return;
    const i = Math.max(0, homeCurrentIndex - 1);
    openTripModalHome(i);
  });
  if (nextBtn) nextBtn.addEventListener('click', ()=>{
    if (homeCurrentIndex === null) return;
    const i = Math.min(homeTripsDisplay.length - 1, homeCurrentIndex + 1);
    openTripModalHome(i);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeTripsModalHandlers);
} else {
  initHomeTripsModalHandlers();
}

function updateModalArrows(){
  const prevBtn = document.getElementById('tripModalPrev');
  const nextBtn = document.getElementById('tripModalNext');
  if (!prevBtn || !nextBtn) return;
  const total = homeTripsDisplay.length;
  const i = homeCurrentIndex ?? 0;
  prevBtn.disabled = (i <= 0);
  nextBtn.disabled = (i >= total - 1);
}
