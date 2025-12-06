// Home page trips section loader
// Loads and displays trips from Supabase on the main page

let homeTripsData = [];
let homeTripsCurrentCity = 'all';
let homeTripsDisplay = [];
let homeCurrentTrip = null;
let homeCurrentIndex = null;

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
    // Wait for languageSwitcher to load (with timeout)
    let attempts = 0;
    while (!window.getTripName && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.getTripName) {
      console.warn('⚠️ getTripName not available after 5s, using fallback');
    } else {
      console.log('✅ getTripName is available');
    }
    
    // Import Supabase client (same as trips.html)
    const { supabase } = await import('/js/supabaseClient.js');
    
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
    console.log('✅ Loaded trips:', homeTripsData.length, homeTripsData);
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
  
  const tabs = [`<button class="trips-home-tab active" data-city="all" style="padding:8px 16px;background:#667eea;color:white;border:none;border-radius:20px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.2s;">${allCitiesLabel}</button>`];
  getTripCities().forEach(city => {
    tabs.push(`<button class="trips-home-tab" data-city="${city}" style="padding:8px 16px;background:#f3f4f6;color:#374151;border:none;border-radius:20px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.2s;">${city}</button>`);
  });
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

  // Show all trips on home page (carousel arrows handle overflow)
  const displayTrips = filteredTrips;
  homeTripsDisplay = displayTrips;
  
  console.log('Current city:', homeTripsCurrentCity);
  console.log('Filtered trips:', filteredTrips.length);
  console.log('Display trips:', displayTrips.length);

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
      console.log('🔍 Trips render debug:', {
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
}

// Handle city tab clicks
function initHomeTripsTabs() {
  const tabs = document.querySelectorAll('.trips-home-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const city = this.getAttribute('data-city');
      
      // Update active state
      tabs.forEach(t => {
        t.classList.remove('active');
        t.style.background = '#f3f4f6';
        t.style.color = '#374151';
      });
      this.classList.add('active');
      this.style.background = '#667eea';
      this.style.color = 'white';
      
      // Update current city and re-render
      homeTripsCurrentCity = city;
      console.log('Filtering by city:', city);
      renderHomeTrips();
    });
  });
}

// Initialize when DOM is ready (exactly like trips.html)
document.addEventListener('DOMContentLoaded', function() {
  loadHomeTrips();
  initHomeTripsTabs();
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
      console.log('🗺️ Trips: Re-rendering for language:', language);
      if (homeTripsData && homeTripsData.length > 0) {
        renderHomeTripsTabs();
        renderHomeTrips();
        console.log('✅ Trips re-rendered');
      }
    });
  }
  
  // Direct event listeners (backup - more reliable)
  window.addEventListener('languageChanged', (e) => {
    console.log('🗺️ Trips: languageChanged event, re-rendering for:', e.detail?.language);
    if (homeTripsData && homeTripsData.length > 0) {
      renderHomeTripsTabs();
      renderHomeTrips();
    }
  });
  
  document.addEventListener('wakacjecypr:languagechange', (e) => {
    console.log('🗺️ Trips: wakacjecypr:languagechange event, re-rendering for:', e.detail?.language);
    if (homeTripsData && homeTripsData.length > 0) {
      renderHomeTripsTabs();
      renderHomeTrips();
    }
  });
});

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

function updateLivePriceHome() {
  if (!homeCurrentTrip) return;
  
  const adults = document.getElementById('bookingAdults').value;
  const children = document.getElementById('bookingChildren').value;
  const hours = document.getElementById('bookingHours').value;
  const days = document.getElementById('bookingDays').value;
  const totalPrice = calculateTripPrice(homeCurrentTrip, adults, children, hours, days);
  
  document.getElementById('modalTripPrice').textContent = `${totalPrice.toFixed(2)} €`;
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

  // Reset form and message
  const form = document.getElementById('bookingForm');
  if (form) { form.reset(); const msg = document.getElementById('bookingMessage'); if (msg) msg.style.display='none'; }
  
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
  });
  
  departureInput.addEventListener('change', function() {
    if (arrivalInput.value && this.value < arrivalInput.value) {
      this.value = arrivalInput.value;
    }
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
    element.addEventListener('input', updateLivePriceHome);
    element.addEventListener('change', updateLivePriceHome);
    element.addEventListener('click', updateLivePriceHome);  // For spinner buttons
    element.addEventListener('keyup', updateLivePriceHome);   // For arrow keys
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

// Backdrop close
document.addEventListener('DOMContentLoaded', ()=>{
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
    const total = calculateTripPrice(homeCurrentTrip, adults, children, hours, days);
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
      total_price: total,
      status: 'pending'
    };
    const btn = form.querySelector('.booking-submit');
    const msg = document.getElementById('bookingMessage');
    
    // Hide previous messages
    if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
    
    try{
      if (btn){ btn.disabled = true; btn.textContent = 'Wysyłanie...'; }
      const { supabase } = await import('/js/supabaseClient.js');
      const { error } = await supabase.from('trip_bookings').insert([payload]).select().single();
      if (error) throw error;
      
      // Success - show beautiful popup (same as hotels)
      showSuccessPopup('✅ Rezerwacja przyjęta!', 'Skontaktujemy się z Tobą wkrótce. Dziękujemy!');
      
      // Reset form and clear validation errors
      form.reset();
      if (typeof clearFormValidation === 'function') {
        clearFormValidation(form);
      }
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
      // Show error popup
      if (typeof showErrorPopup === 'function') {
        showErrorPopup('❌ Błąd rezerwacji', err.message || 'Wystąpił błąd podczas rezerwacji. Spróbuj ponownie.');
      } else {
        // Fallback to old message
        if (msg){ msg.textContent= err.message || 'Wystąpił błąd podczas rezerwacji. Spróbuj ponownie.'; msg.className='booking-message error'; msg.style.display='block'; }
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
});

function updateModalArrows(){
  const prevBtn = document.getElementById('tripModalPrev');
  const nextBtn = document.getElementById('tripModalNext');
  if (!prevBtn || !nextBtn) return;
  const total = homeTripsDisplay.length;
  const i = homeCurrentIndex ?? 0;
  prevBtn.disabled = (i <= 0);
  nextBtn.disabled = (i >= total - 1);
}
