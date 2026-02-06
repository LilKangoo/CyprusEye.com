// Home page hotels section loader
// Loads and displays hotels from Supabase on the main page (mirrors trips home panel)

let homeHotelsData = [];
let homeHotelsCurrentCity = 'all';
let homeHotelsDisplay = [];
let homeCurrentHotel = null;
let homeHotelIndex = null;

const CE_DEBUG_HOME_HOTELS = typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true';
function ceLog(...args) {
  if (CE_DEBUG_HOME_HOTELS) console.log(...args);
}

const HOME_HOTELS_CACHE_KEY = 'ce_cache_home_hotels_v1';
const HOME_HOTELS_CACHE_TTL_MS = 10 * 60 * 1000;

const HOME_HOTEL_AMENITIES_CACHE_KEY = 'ce_cache_hotel_amenities_v1';
const HOME_HOTEL_AMENITIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readHomeHotelsCache() {
  try {
    const raw = localStorage.getItem(HOME_HOTELS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeHomeHotelsCache(data) {
  try {
    if (!Array.isArray(data)) return;
    localStorage.setItem(HOME_HOTELS_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch (_) {}
}

function readHotelAmenitiesCache() {
  try {
    const raw = localStorage.getItem(HOME_HOTEL_AMENITIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.data !== 'object') return null;
    if (!parsed.at || (Date.now() - parsed.at) > HOME_HOTEL_AMENITIES_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeHotelAmenitiesCache(map) {
  try {
    if (!map || typeof map !== 'object') return;
    localStorage.setItem(HOME_HOTEL_AMENITIES_CACHE_KEY, JSON.stringify({ at: Date.now(), data: map }));
  } catch (_) {}
}

function scheduleHotelsRerenderWhenI18nReady() {
  if (window.getHotelName) return;
  let attempts = 0;
  const tick = () => {
    attempts += 1;
    if (window.getHotelName) {
      if (homeHotelsData && homeHotelsData.length > 0) {
        renderHomeHotelsTabs();
        renderHomeHotels();
      }
      return;
    }
    if (attempts >= 300) return;
    const delay = attempts < 50 ? 100 : 500;
    setTimeout(tick, delay);
  };
  setTimeout(tick, 100);
}

async function waitForSupabaseClientHomeHotels(maxAttempts = 50) {
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

// Amenities cache and helpers
let hotelAmenitiesMap = {};

try {
  const cachedAmenities = readHotelAmenitiesCache();
  if (cachedAmenities && typeof cachedAmenities === 'object') {
    hotelAmenitiesMap = cachedAmenities;
  }
} catch (_) {}

async function loadHotelAmenitiesForDisplay() {
  try {
    const supabase = await waitForSupabaseClientHomeHotels();
    if (!supabase) throw new Error('Supabase client not available');
    const { data } = await supabase
      .from('hotel_amenities')
      .select('code, icon, name_en, name_pl, is_popular')
      .eq('is_active', true);
    
    if (data) {
      data.forEach(a => { hotelAmenitiesMap[a.code] = a; });
      writeHotelAmenitiesCache(hotelAmenitiesMap);
      ceLog('✅ Hotel amenities loaded for display:', Object.keys(hotelAmenitiesMap).length);
      try {
        if (homeCurrentHotel) renderHotelAmenitiesChips(homeCurrentHotel);
      } catch (_) {}
    }
  } catch (e) {
    console.warn('Failed to load amenities for display:', e);
  }
}

function renderHotelAmenitiesChips(hotel) {
  const container = document.getElementById('hotelAmenitiesChips');
  if (!container) return;
  
  const amenities = Array.isArray(hotel.amenities) ? hotel.amenities : [];
  if (!amenities.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'pl') || 'pl';
  
  // Limit to popular or first 8
  const popularFirst = amenities
    .map(code => hotelAmenitiesMap[code])
    .filter(Boolean)
    .sort((a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0))
    .slice(0, 8);
  
  if (!popularFirst.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'flex';
  container.innerHTML = popularFirst.map(a => {
    const name = lang === 'en' ? a.name_en : (a.name_pl || a.name_en);
    return `<span class="amenity-chip">${a.icon} ${name}</span>`;
  }).join('');
}

// Prefill hotel booking form from logged-in user session
async function prefillHotelFormFromSession(form) {
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
    console.warn('Could not prefill hotel form:', err);
  }
}

async function loadHomeHotels(){
  try{
    const cached = readHomeHotelsCache();
    if (cached && cached.length > 0) {
      homeHotelsData = cached;
      renderHomeHotelsTabs();
      renderHomeHotels();
    }
    scheduleHotelsRerenderWhenI18nReady();
    loadHotelAmenitiesForDisplay();
    
    const supabase = await waitForSupabaseClientHomeHotels();
    if(!supabase) throw new Error('Supabase client not available');

    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if(error) throw error;
    homeHotelsData = data || [];
    writeHomeHotelsCache(homeHotelsData);
    
    renderHomeHotelsTabs();
    renderHomeHotels();
  }catch(err){
    console.error('❌ Failed to load hotels:', err);
    const grid = document.getElementById('hotelsHomeGrid');
    if(grid){ grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#ef4444;">Błąd ładowania hoteli</div>'; }
  }
}

function getHotelCities(){
  const s = new Set();
  homeHotelsData.forEach(h=>{ if(h.city) s.add(h.city); });
  return Array.from(s).sort();
}

// Translation helper for hotels - reads directly from appI18n.translations
function hotelsT(key, fallback) {
  try {
    const lang = (window.appI18n && window.appI18n.language) || 
                 document.documentElement.lang || 'pl';
    const translations = window.appI18n?.translations?.[lang];
    if (!translations) return fallback;
    
    // Try flat key first (e.g., "hotels.tabs.allCities")
    if (translations[key]) return translations[key];
    
    // Try nested path (e.g., hotels.tabs.allCities -> translations.hotels.tabs.allCities)
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

// Translation helper with parameter substitution (e.g., {{min}}, {{billable}})
function hotelsTWithParams(key, fallback, params = {}) {
  let text = hotelsT(key, fallback);
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return text;
}

function renderHomeHotelsTabs(){
  const tabsWrap = document.getElementById('hotelsHomeTabs');
  if(!tabsWrap) return;
  
  // Get translated label
  const allCitiesLabel = hotelsT('hotels.tabs.allCities', 'Wszystkie miasta');
  
  const tabs = [`<button type="button" class="hotels-home-tab ce-home-pill active" data-city="all">${allCitiesLabel}</button>`];
  getHotelCities().forEach(c=>{
    tabs.push(`<button type="button" class="hotels-home-tab ce-home-pill" data-city="${c}">${c}</button>`);
  });
  tabsWrap.innerHTML = tabs.join('');
  initHomeHotelsTabs();
}

function renderHomeHotels(){
  const grid = document.getElementById('hotelsHomeGrid');
  if(!grid) return;
  let list = homeHotelsData;
  if(homeHotelsCurrentCity !== 'all'){
    list = homeHotelsData.filter(h=>h.city===homeHotelsCurrentCity);
  }
  const display = list.slice(0,6);
  homeHotelsDisplay = display;
  if(!display.length){
    const emptyText = hotelsT('hotels.empty', 'Brak ofert');
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#9ca3af;">${emptyText}</div>`;
    return;
  }
  grid.innerHTML = display.map((h, index)=>{
    const image = h.cover_image_url || (Array.isArray(h.photos)&&h.photos[0]) || '/assets/cyprus_logo-1000x1054.png';
    const title = window.getHotelName ? window.getHotelName(h) : (h.title?.pl || h.title?.en || h.slug || 'Hotel');
    
    // DEBUG: Log what we're rendering
    if (index === 0) {
      ceLog('🔍 Hotels render debug:', {
        hasHotelName: !!window.getHotelName,
        currentLang: window.getCurrentLanguage ? window.getCurrentLanguage() : 'unknown',
        hotelTitle: h.title,
        renderedTitle: title
      });
    }
    let price = '';
    const tiers = h.pricing_tiers?.rules || [];
    const perNightLabel = hotelsT('hotels.card.perNight', '/ noc');
    if(tiers.length){
      const for2 = tiers.find(r=>Number(r.persons)===2 && r.price_per_night!=null);
      const p = for2? Number(for2.price_per_night): Math.min(...tiers.map(r=>Number(r.price_per_night||Infinity)));
      if(isFinite(p)) price = `${p.toFixed(2)} € ${perNightLabel}`;
    }
    return `
      <a href="#" onclick="openHotelModalHome(${index}); return false;" class="hotel-home-card" style="position:relative;height:200px;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .3s,box-shadow .3s;box-shadow:0 4px 6px rgba(0,0,0,.1);text-decoration:none;display:block;"
         onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 12px rgba(0,0,0,0.15)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'">
        <button
          type="button"
          data-ce-save="1"
          data-item-type="hotel"
          data-ref-id="${String(h.id || '')}"
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
        <img src="${image}" alt="${title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/assets/cyprus_logo-1000x1054.png'" />
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,.9) 0%, rgba(0,0,0,.6) 70%, transparent 100%);padding:16px;color:white;">
          <h3 style="margin:0 0 4px;font-size:1.1rem;font-weight:700;line-height:1.3;">${title}</h3>
          <p style="margin:0;font-size:.85rem;opacity:.98;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,.35);">${h.city||''} ${price? '• '+price: ''}</p>
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

function initHomeHotelsTabs(){
  const tabs = document.querySelectorAll('.hotels-home-tab');
  tabs.forEach(tab=>{
    tab.addEventListener('click', function(){
      const city = this.getAttribute('data-city');
      tabs.forEach(t=>{ t.classList.remove('active'); });
      this.classList.add('active');
      homeHotelsCurrentCity = city;
      renderHomeHotels();
    });
  });
}

// init
function initHomeHotels() {
  loadHomeHotels();
  // init carousel arrows for hotels
  const prev = document.querySelector('.home-carousel-container .home-carousel-nav.prev[data-target="#hotelsHomeGrid"]');
  const next = document.querySelector('.home-carousel-container .home-carousel-nav.next[data-target="#hotelsHomeGrid"]');
  const grid = document.getElementById('hotelsHomeGrid');
  const scrollBy = () => Math.round(grid.clientWidth * 0.85);
  const updateArrows = () => {
    if (!prev || !next || !grid) return;
    const maxScroll = grid.scrollWidth - grid.clientWidth - 1;
    const atStart = grid.scrollLeft <= 1;
    const atEnd = grid.scrollLeft >= maxScroll;
    prev.hidden = atStart;
    next.hidden = atEnd;
    const noOverflow = grid.scrollWidth <= grid.clientWidth + 1;
    if (noOverflow) { prev.hidden = true; next.hidden = true; }
  };
  if (prev && grid) prev.addEventListener('click', () => { grid.scrollBy({left: -scrollBy(), behavior: 'smooth'}); setTimeout(updateArrows, 350); });
  if (next && grid) next.addEventListener('click', () => { grid.scrollBy({left: scrollBy(), behavior: 'smooth'}); setTimeout(updateArrows, 350); });
  if (grid) grid.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();

  // Backdrop close
  const modal = document.getElementById('hotelModal');
  if (modal) modal.addEventListener('click', (e)=>{ if (e.target === modal) closeHotelModal(); });

  // Clear message on form change
  const form = document.getElementById('hotelBookingForm');
  if (form) {
    form.addEventListener('input', () => {
      const msg = document.getElementById('hotelBookingMessage');
      if(msg && msg.style.display !== 'none') {
        msg.style.display = 'none';
        msg.textContent = '';
      }
    });
  }
  
  // Setup date constraints (once, not per modal open)
  const arrivalEl = document.getElementById('arrivalDate');
  const departureEl = document.getElementById('departureDate');
  if (arrivalEl && departureEl) {
    arrivalEl.addEventListener('change', () => {
      if (arrivalEl.value) {
        departureEl.min = arrivalEl.value;
        // If departure is before arrival, clear it
        if (departureEl.value && departureEl.value < arrivalEl.value) {
          departureEl.value = '';
        }
      }
    });
  }
  
  // Form submit - inline Supabase insert (same pattern as trips)
  if (form) form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!homeCurrentHotel) return;
    
    const msg = document.getElementById('hotelBookingMessage');
    const btn = e.target.querySelector('.booking-submit');
    
    // Hide previous messages
    if(msg) { msg.style.display='none'; msg.textContent=''; }
    
    try{
      btn.disabled=true; btn.textContent='Wysyłanie...';
      
      const supabase = await waitForSupabaseClientHomeHotels();
      if (!supabase) throw new Error('Supabase client not available');
      
      // Build payload from form data
      const fd = new FormData(form);
      const arrivalDate = fd.get('arrival_date');
      const departureDate = fd.get('departure_date');
      const adults = parseInt(fd.get('adults')) || 2;
      const children = parseInt(fd.get('children')) || 0;
      const nights = nightsBetween(arrivalDate, departureDate);
      const priceResult = calculateHotelPrice(homeCurrentHotel, adults + children, nights);
      const totalPrice = priceResult.total;
      
      const payload = {
        hotel_id: homeCurrentHotel.id,
        hotel_slug: homeCurrentHotel.slug,
        category_id: homeCurrentHotel.category_id,
        customer_name: fd.get('name'),
        customer_email: fd.get('email'),
        customer_phone: fd.get('phone'),
        arrival_date: arrivalDate,
        departure_date: departureDate,
        num_adults: adults,
        num_children: children,
        nights: priceResult.billableNights,
        notes: fd.get('notes'),
        total_price: totalPrice,
        status: 'pending'
      };
      
      // Insert to Supabase (same as trips)
      const { error } = await supabase
        .from('hotel_bookings')
        .insert([payload]);
      
      if (error) throw error;
      
      // Success - show beautiful popup
      showSuccessPopup('✅ Rezerwacja przyjęta!', 'Skontaktujemy się z Tobą wkrótce. Dziękujemy!');
      
      // Reset form and clear validation errors
      form.reset();
      clearFormValidation(form);
      updateHotelLivePrice();
      
      // Optional: close modal after 3 seconds
      setTimeout(() => {
        const modalEl = document.getElementById('hotelModal');
        if (modalEl && modalEl.classList.contains('active')) {
          closeHotelModal();
        }
      }, 3000);
      
    }catch(err){
      console.error('❌ Booking error:', err);
      showErrorPopup('❌ Błąd rezerwacji', err.message || 'Wystąpił błąd. Spróbuj ponownie.');
    }finally{
      btn.disabled=false; btn.textContent='Zarezerwuj';
    }
  });

  // Nav arrows
  const prevBtn = document.getElementById('hotelModalPrev');
  const nextBtn = document.getElementById('hotelModalNext');
  if (prevBtn) prevBtn.addEventListener('click', ()=>{ if (homeHotelIndex==null) return; const i=Math.max(0, homeHotelIndex-1); openHotelModalHome(i); });
  if (nextBtn) nextBtn.addEventListener('click', ()=>{ if (homeHotelIndex==null) return; const i=Math.min(homeHotelsDisplay.length-1, homeHotelIndex+1); openHotelModalHome(i); });

  // Lightbox controls
  const lb = document.getElementById('imgLightbox');
  const lbClose = document.getElementById('lbClose');
  const lbPrev = document.getElementById('lbPrev');
  const lbNext = document.getElementById('lbNext');
  if (lbClose) lbClose.addEventListener('click', closeHotelLightbox);
  if (lbPrev) lbPrev.addEventListener('click', ()=> showHotelLightbox(lbIndex-1));
  if (lbNext) lbNext.addEventListener('click', ()=> showHotelLightbox(lbIndex+1));
  if (lb) lb.addEventListener('click', (e)=>{ if (e.target === lb) closeHotelLightbox(); });
  
  // Register language change handler (legacy method)
  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler((language) => {
      ceLog('🏨 Hotels: Re-rendering for language:', language);
      if (homeHotelsData && homeHotelsData.length > 0) {
        renderHomeHotelsTabs();
        renderHomeHotels();
        ceLog('✅ Hotels re-rendered');
      }
    });
  }
  
  // Direct event listeners (backup - more reliable)
  window.addEventListener('languageChanged', (e) => {
    ceLog('🏨 Hotels: languageChanged event, re-rendering for:', e.detail?.language);
    if (homeHotelsData && homeHotelsData.length > 0) {
      renderHomeHotelsTabs();
      renderHomeHotels();
    }
  });
  
  document.addEventListener('wakacjecypr:languagechange', (e) => {
    ceLog('🏨 Hotels: wakacjecypr:languagechange event, re-rendering for:', e.detail?.language);
    if (homeHotelsData && homeHotelsData.length > 0) {
      renderHomeHotelsTabs();
      renderHomeHotels();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeHotels);
} else {
  initHomeHotels();
}

// ----- Modal helpers (1:1 with /hotels) -----
function nightsBetween(a,b){
  if(!a||!b) return 1;
  const da=new Date(a), db=new Date(b);
  const diff = Math.round((db - da)/(1000*60*60*24));
  return Math.max(1, diff);
}

// Helper: Znajdź tier po liczbie osób
function findTierByPersons(tiers, persons) {
  let rule = tiers.find(r => Number(r.persons) === persons);
  if (rule) return rule;
  const lowers = tiers.filter(r => Number(r.persons) <= persons);
  if (lowers.length) {
    return lowers.sort((a, b) => Number(b.persons) - Number(a.persons))[0];
  }
  return null;
}

// Helper: Znajdź najlepszy tier dla długości pobytu (flat_per_night)
function findBestTierByNights(tiers, nights) {
  const matching = tiers
    .filter(r => !r.min_nights || Number(r.min_nights) <= nights)
    .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
  return matching[0] || tiers[0];
}

// Helper: Znajdź najlepszy tier dla osób I nocy (tiered_by_nights)
function findBestTierByPersonsAndNights(tiers, persons, nights) {
  let personTiers = tiers.filter(r => Number(r.persons) === persons);
  if (!personTiers.length) {
    const lowers = tiers.filter(r => Number(r.persons) <= persons);
    if (lowers.length) {
      const maxPersons = Math.max(...lowers.map(r => Number(r.persons)));
      personTiers = lowers.filter(r => Number(r.persons) === maxPersons);
    }
  }
  if (!personTiers.length) return null;
  const matching = personTiers
    .filter(r => !r.min_nights || Number(r.min_nights) <= nights)
    .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
  return matching[0] || personTiers[0];
}

function calculateHotelPrice(h, persons, nights){
  const model = h.pricing_model || 'per_person_per_night';
  const tiers = h.pricing_tiers?.rules || [];
  if(!tiers.length) return { total: 0, pricePerNight: 0, billableNights: nights, tier: null };
  
  persons = Number(persons)||1;
  nights = Number(nights)||1;
  let rule = null;
  
  switch (model) {
    case 'flat_per_night':
      rule = findBestTierByNights(tiers, nights);
      break;
    case 'tiered_by_nights':
      rule = findBestTierByPersonsAndNights(tiers, persons, nights);
      break;
    case 'per_person_per_night':
    case 'category_per_night':
    default:
      rule = findTierByPersons(tiers, persons);
      break;
  }
  
  if (!rule) {
    rule = tiers.sort((a, b) => Number(a.price_per_night) - Number(b.price_per_night))[0];
  }
  
  const pricePerNight = Number(rule.price_per_night || 0);
  const minN = Number(rule.min_nights || 0);
  const billableNights = minN ? Math.max(minN, nights) : nights;
  const total = billableNights * pricePerNight;
  
  return { total, pricePerNight, billableNights, tier: rule };
}

// Backwards compatibility wrapper
function calculateHotelPriceSimple(h, persons, nights) {
  const result = calculateHotelPrice(h, persons, nights);
  return typeof result === 'object' ? result.total : result;
}

function updateHotelLivePrice(){
  if(!homeCurrentHotel) return;
  const modal = document.getElementById('hotelModal');
  const form = modal ? modal.querySelector('#hotelBookingForm') : null;
  if (!form) return;
  const a = (form.querySelector('#hotelArrivalDate')||{}).value || '';
  const d = (form.querySelector('#hotelDepartureDate')||{}).value || '';
  const adults = Number((form.querySelector('#hotelBookingAdults')||{}).value||0);
  const children = Number((form.querySelector('#hotelBookingChildren')||{}).value||0);
  let persons = adults + children;
  const maxPersons = Number(homeCurrentHotel.max_persons||0) || null;
  const nights = nightsBetween(a,d);
  const note = modal ? modal.querySelector('#hotelPriceNote') : null;
  let notes = [];
  
  // Limit osób
  if (maxPersons && persons > maxPersons) {
    persons = maxPersons;
    notes.push(hotelsTWithParams('hotels.price.personLimit',
      `Limit osób: ${maxPersons}. Cena dla ${maxPersons} os.`,
      { max: maxPersons }
    ));
  }
  
  // Oblicz cenę z nowym API
  const result = calculateHotelPrice(homeCurrentHotel, persons, nights);
  const priceEl = modal ? modal.querySelector('#modalHotelPrice') : null;
  if (priceEl) priceEl.textContent = `${result.total.toFixed(2)} €`;
  
  // Informacja o minimum nocy (translated)
  if (result.tier && result.billableNights > nights) {
    notes.push(hotelsTWithParams('hotels.price.minNights', 
      `Min. ${result.tier.min_nights} nocy. Cena za ${result.billableNights} nocy.`,
      { min: result.tier.min_nights, billable: result.billableNights }
    ));
  }
  
  // Informacja o rabacie (dla tiered_by_nights) (translated)
  const model = homeCurrentHotel.pricing_model || 'per_person_per_night';
  if (model === 'tiered_by_nights' && result.tier?.min_nights && result.tier.min_nights > 1) {
    notes.push(hotelsTWithParams('hotels.price.discount',
      `Cena: ${result.pricePerNight.toFixed(2)}€/noc (rabat za ${result.tier.min_nights}+ nocy)`,
      { price: result.pricePerNight.toFixed(2), min: result.tier.min_nights }
    ));
  }
  
  if (note) {
    if (notes.length) {
      note.style.display = 'block';
      note.className = 'booking-message';
      note.textContent = notes.join(' ');
    } else {
      note.style.display = 'none';
    }
  }
}

window.openHotelModalHome = function(index){
  const h = homeHotelsDisplay[index];
  if(!h) return;
  homeCurrentHotel = h;
  homeHotelIndex = index;
  const title = window.getHotelName ? window.getHotelName(h) : (h.title?.pl || h.title?.en || h.slug);
  const image = h.cover_image_url || (Array.isArray(h.photos)&&h.photos[0]) || '/assets/cyprus_logo-1000x1054.png';
  const imgEl = document.getElementById('modalHotelImage');
  imgEl.src = image;
  imgEl.onclick = () => openHotelLightbox();
  const thumbsWrap = document.getElementById('modalHotelThumbs');
  const photos = Array.isArray(h.photos)? h.photos: [];
  thumbsWrap.innerHTML = photos.map((u,i)=>`<img src="${u}" alt="miniatura" class="${i===0?'active':''}" data-src="${u}" />`).join('');
  thumbsWrap.querySelectorAll('img').forEach(el=>{
    el.addEventListener('click', ()=>{
      thumbsWrap.querySelectorAll('img').forEach(t=>t.classList.remove('active'));
      el.classList.add('active');
      imgEl.src = el.dataset.src;
    });
    el.ondblclick = ()=> openHotelLightbox();
  });
  const description = window.getHotelDescription ? window.getHotelDescription(h) : (h.description?.pl || h.description?.en || '');
  document.getElementById('modalHotelTitle').textContent = title;
  document.getElementById('modalHotelSubtitle').textContent = h.city || '';
  document.getElementById('modalHotelDescription').innerHTML = description.replace(/\n/g,'<br/>');

  const saveBtn = document.getElementById('modalHotelSaveBtn');
  if (saveBtn) {
    saveBtn.setAttribute('data-ref-id', String(h.id || ''));
    try {
      if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
        window.CE_SAVED_CATALOG.refreshButtons(saveBtn.parentElement || document);
      }
    } catch (_) {}
  }
  
  // Render amenities chips
  renderHotelAmenitiesChips(h);

  const form = document.getElementById('hotelBookingForm');
  if (form){ form.reset(); const msg=document.getElementById('hotelBookingMessage'); if(msg) msg.style.display='none'; }
  
  // Prefill user data from session (if logged in)
  prefillHotelFormFromSession(form);
  
  // Set date min constraints to today
  const today = new Date().toISOString().split('T')[0];
  const arrivalEl = document.getElementById('hotelArrivalDate');
  const departureEl = document.getElementById('hotelDepartureDate');
  if (arrivalEl) arrivalEl.min = today;
  if (departureEl) departureEl.min = today;
  
  // max persons
  const maxPersons = Number(h.max_persons||0) || null;
  const adultsEl = document.getElementById('hotelBookingAdults');
  const childrenEl = document.getElementById('hotelBookingChildren');
  if (maxPersons){ adultsEl.max = String(maxPersons); childrenEl.max = String(Math.max(0, maxPersons-1)); }
  else { adultsEl.removeAttribute('max'); childrenEl.removeAttribute('max'); }

  // bind price updates - comprehensive event coverage
  const addAllEvents = (element, isDate = false) => {
    element.addEventListener('input', updateHotelLivePrice);
    element.addEventListener('change', updateHotelLivePrice);
    if (!isDate) {
      // For number inputs, also handle click (spinner buttons) and keyup
      element.addEventListener('click', updateHotelLivePrice);
      element.addEventListener('keyup', updateHotelLivePrice);
    }
  };
  
  ['hotelArrivalDate','hotelDepartureDate','hotelBookingAdults','hotelBookingChildren'].forEach(id=>{
    const old = document.getElementById(id);
    if (!old) return;
    const clone = old.cloneNode(true);
    old.parentNode.replaceChild(clone, old);
    const isDate = id === 'hotelArrivalDate' || id === 'hotelDepartureDate';
    addAllEvents(clone, isDate);
  });
  updateHotelLivePrice();

  const modalEl = document.getElementById('hotelModal');
  if (typeof openSheet === 'function') {
    openSheet(modalEl);
  } else {
    // Fallback
    if (modalEl){ modalEl.hidden=false; modalEl.classList.add('active'); document.body.style.overflow='hidden'; }
  }
  updateHotelModalArrows();
}

window.closeHotelModal = function(){
  const modalEl = document.getElementById('hotelModal');
  if (typeof closeSheet === 'function') {
    closeSheet(modalEl);
  } else {
    // Fallback
    if (modalEl){ modalEl.classList.remove('active'); modalEl.hidden=true; document.body.style.overflow=''; }
  }
  homeCurrentHotel = null;
  homeHotelIndex = null;
}

// Lightbox (gallery)
let lbIndex = 0;
function getHotelPhotos(){ return Array.isArray(homeCurrentHotel?.photos)? homeCurrentHotel.photos: []; }
function currentHotelPhotoIndex(){ const src=document.getElementById('modalHotelImage').src; const arr=getHotelPhotos(); const i=arr.findIndex(u=>src.includes(u)); return i>=0? i:0; }
function showHotelLightbox(i){ const arr=getHotelPhotos(); if(!arr.length) return; lbIndex=(i+arr.length)%arr.length; const img=document.getElementById('lbImg'); if(img) img.src=arr[lbIndex]; }
function openHotelLightbox(i){ const lb=document.getElementById('imgLightbox'); if(!lb) return; lb.hidden=false; lb.classList.add('active'); showHotelLightbox(typeof i==='number'? i: currentHotelPhotoIndex()); document.addEventListener('keydown', onHotelLbKey); }
function closeHotelLightbox(){ const lb=document.getElementById('imgLightbox'); if(!lb) return; lb.classList.remove('active'); lb.hidden=true; document.removeEventListener('keydown', onHotelLbKey); }
function onHotelLbKey(e){ if(e.key==='Escape') return closeHotelLightbox(); if(e.key==='ArrowRight') return showHotelLightbox(lbIndex+1); if(e.key==='ArrowLeft') return showHotelLightbox(lbIndex-1); }
window.openHotelLightbox = openHotelLightbox;
window.closeHotelLightbox = closeHotelLightbox;

function updateHotelModalArrows(){
  const prevBtn = document.getElementById('hotelModalPrev');
  const nextBtn = document.getElementById('hotelModalNext');
  if (!prevBtn || !nextBtn) return;
  const total = homeHotelsDisplay.length;
  const i = homeHotelIndex ?? 0;
  prevBtn.disabled = (i <= 0);
  nextBtn.disabled = (i >= total - 1);
}
