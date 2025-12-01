import { getMyProfile, updateMyUsername, uploadAvatar, removeAvatar } from './profile.js';
import { supabase } from './supabaseClient.js';
import { getUserPhotos } from './community/photos.js';

// --- State ---
let currentUser = null;
let currentProfile = null;
let ordersData = [];
let carPricingData = []; // Cache for car offers

// --- Constants ---
const SECTIONS = ['overview', 'reservations', 'content', 'achievements', 'settings'];
const INSURANCE_RATE = 17;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

async function initDashboard() {
  console.log('�� Initializing Dashboard...');
  
  try {
    // Check Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/index.html'; // Redirect if not logged in
      return;
    }
    currentUser = session.user;
    console.log('👤 User:', currentUser.email);

    // Load Pricing Data (in parallel with profile)
    const pricingPromise = fetchCarPricing();

    // Load Profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error && error.code !== 'PGRST116') console.error('Profile error:', error);
    currentProfile = profile || { email: currentUser.email, level: 1, xp: 0 };

    updateSidebarProfile();
    
    // Wait for pricing
    await pricingPromise;

    // Setup Navigation
    setupNavigation();
    setupMobileMenu();

    // Load Section based on URL or default
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section') || 'overview';
    
    // Activate correct sidebar item
    const activeBtn = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (activeBtn) {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      activeBtn.classList.add('active');
    }
    
    switchSection(section);

  } catch (err) {
    console.error('Init error:', err);
  }
}

async function fetchCarPricing() {
  try {
    const { data, error } = await supabase.from('car_offers').select('*');
    if (!error) carPricingData = data || [];
    console.log('🚗 Pricing loaded:', carPricingData.length);
  } catch (e) {
    console.warn('Pricing load error:', e);
  }
}

function updateSidebarProfile() {
   const avatarEl = document.getElementById('sidebarAvatar');
   const usernameEl = document.getElementById('sidebarUsername');
   const levelEl = document.getElementById('sidebarLevel');
   
   const displayName = currentProfile?.username || currentProfile?.name || currentUser.email.split('@')[0];
   const avatarUrl = currentProfile?.avatar_url || 'assets/cyprus_logo-1000x1054.png';
   const level = currentProfile?.level || 1;

   if (avatarEl) avatarEl.src = avatarUrl;
   if (usernameEl) usernameEl.textContent = displayName;
   if (levelEl) levelEl.textContent = `Level ${level}`;
}

function calculateEstimatedPrice(booking) {
  try {
    if (booking.type !== 'car' || !booking.pickup_date || !booking.return_date) return 0;
    
    const bookingLocation = String(booking.location || 'paphos').toLowerCase();
    const bookingCarModel = booking.car_model || '';
    
    // Filter by location first, then find matching car
    const locationOffers = carPricingData.filter(c => 
      String(c.location || '').toLowerCase() === bookingLocation
    );
    
    // Find car by matching car_model (supports both string and JSONB i18n format)
    const offer = locationOffers.find(car => {
      if (!car.car_model) return false;
      
      if (typeof car.car_model === 'string') {
        // Legacy: direct string comparison
        return car.car_model === bookingCarModel;
      } else if (typeof car.car_model === 'object') {
        // i18n JSONB: check all language variants
        return car.car_model.pl === bookingCarModel ||
               car.car_model.en === bookingCarModel ||
               car.car_model.el === bookingCarModel ||
               car.car_model.he === bookingCarModel;
      }
      return false;
    });
    
    if (!offer) return 0;

    const start = new Date(booking.pickup_date);
    const end = new Date(booking.return_date);
    const diffTime = Math.abs(end - start);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return 0;

    let basePrice = 0;

    if (bookingLocation === 'larnaca') {
      // Larnaca: simple per-day pricing
      const dailyRate = offer.price_per_day || offer.price_10plus_days || 35;
      basePrice = dailyRate * days;
    } else {
      // Paphos: tiered pricing
      if (days <= 3) {
        basePrice = offer.price_3days || 130;
      } else if (days <= 6) {
        basePrice = days * (offer.price_4_6days || 34);
      } else if (days <= 10) {
        basePrice = days * (offer.price_7_10days || 32);
      } else {
        basePrice = days * (offer.price_10plus_days || 30);
      }
    }

    // Add insurance cost (€17/day)
    if (booking.full_insurance) {
      basePrice += (days * INSURANCE_RATE);
    }
    
    // Add young driver surcharge (€10/day)
    if (booking.young_driver) {
      basePrice += (days * 10);
    }
    
    // Add passenger surcharge (€5 per extra passenger above 2)
    const numPassengers = booking.people || booking.num_passengers || 1;
    if (numPassengers > 2) {
      basePrice += (numPassengers - 2) * 5;
    }

    return basePrice;
  } catch (err) {
    console.warn('calculateEstimatedPrice error:', err);
    return 0;
  }
}

// --- Navigation ---
function setupNavigation() {
  const navButtons = document.querySelectorAll('.sidebar-nav .nav-item[data-section]');
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      switchSection(sectionId);
      
      document.querySelector('.dashboard-sidebar').classList.remove('open');
    });
  });

  const logoutBtns = document.querySelectorAll('[data-auth="logout"]');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/index.html';
    });
  });
}

function setupMobileMenu() {
  const toggle = document.getElementById('dashboardSidebarToggle');
  const sidebar = document.querySelector('.dashboard-sidebar');
  
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && 
          !sidebar.contains(e.target) && 
          !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

function switchSection(sectionId) {
  SECTIONS.forEach(id => {
    const el = document.getElementById(`section-${id}`);
    if (el) el.classList.remove('active');
  });
  
  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.classList.add('active');
    loadSection(sectionId);
  }
}

// --- Section Loaders ---
async function loadSection(sectionId) {
  console.log('📂 Loading section:', sectionId);
  
  switch (sectionId) {
    case 'overview':
      await loadOverviewStats();
      break;
    case 'reservations':
      await loadReservations();
      break;
    case 'content':
      await loadUserContent();
      break;
    case 'achievements':
      await loadAchievements();
      break;
    case 'settings':
      break;
  }
}

// --- Overview Logic ---
async function loadOverviewStats() {
  try {
    const orders = await fetchAllBookings(5);
    ordersData = orders;

    // --- XP & Level ---
    const levelVal = (currentProfile && currentProfile.level) || 1;
    const xpVal = (currentProfile && currentProfile.xp) || 0;
    const nextLevelXp = levelVal * 1000;
    const xpPercent = nextLevelXp > 0 ? Math.min(100, (xpVal / nextLevelXp) * 100) : 0;

    const levelEl = document.getElementById('overviewLevel');
    const xpEl = document.getElementById('overviewXP');
    const xpBarEl = document.getElementById('overviewXPBar');

    if (levelEl) levelEl.textContent = levelVal;
    if (xpEl) xpEl.textContent = `${xpVal} XP`;
    if (xpBarEl) xpBarEl.style.width = `${xpPercent}%`;

    // --- Visited places ---
    const places = (currentProfile && currentProfile.visited_places
      ? currentProfile.visited_places.length
      : 0);
    const visitedEl = document.getElementById('overviewVisited');
    if (visitedEl) visitedEl.textContent = places;

    // --- Active bookings ---
    const activeBookings = orders.filter(o =>
      o.status === 'confirmed' || o.status === 'pending'
    ).length;
    const bookingsEl = document.getElementById('overviewActiveBookings');
    if (bookingsEl) bookingsEl.textContent = activeBookings;

    // --- Recent Activity List ---
    const listEl = document.getElementById('recentActivityList');
    if (listEl) {
      if (orders.length === 0) {
        listEl.innerHTML = '<p class="empty-state" data-i18n="dashboard.activity.empty">No recent activity.</p>';
      } else {
        listEl.innerHTML = orders
          .slice(0, 3)
          .map(o => createBookingCard(o, true))
          .join('');
      }
    }

  } catch (e) {
    console.error('Error loading overview:', e);
  }
}

// --- Reservations Logic ---
async function loadReservations() {
  try {
    const listEl = document.getElementById('reservationsList');
    listEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
    
    ordersData = await fetchAllBookings(100);
    renderReservations('all');
    
    // Update Badge
    const count = ordersData.length;
    const badge = document.getElementById('reservationsCount');
    if (badge) {
      badge.textContent = count;
      badge.hidden = count === 0;
    }
  } catch (e) { /* ignore */ }
}

async function fetchAllBookings(limit = 100) {
  console.log('📦 Fetching bookings for:', currentUser.email);
  
  // Fetch Trip Bookings
  const { data: tripBookings, error: tripError } = await supabase
    .from('trip_bookings')
    .select('*')
    .ilike('customer_email', currentUser.email)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tripError) console.warn('Trip bookings fetch error (RLS?):', tripError);

  // Fetch Hotel Bookings
  let hotelBookings = [];
  try {
    const { data, error } = await supabase
      .from('hotel_bookings')
      .select('*')
      .ilike('customer_email', currentUser.email)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) console.warn('Hotel bookings fetch error:', error);
    if (data) hotelBookings = data;
  } catch (e) {
    console.warn('Hotel bookings table not found or error:', e);
  }

  // Fetch Car Bookings
  let carBookings = [];
  try {
    const { data, error } = await supabase
      .from('car_bookings')
      .select('*')
      .ilike('email', currentUser.email)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) console.warn('Car bookings fetch error:', error);
    if (data) carBookings = data;
  } catch (e) {
    console.warn('Car bookings table not found or error:', e);
  }

  // Normalize Data
  const trips = (tripBookings || []).map(t => ({
    type: 'trip',
    id: t.id,
    title: t.trip_slug || 'Trip Booking', 
    date: t.trip_date || t.start_date,
    created_at: t.created_at,
    status: t.status || 'pending',
    price: t.total_price,
    people: (t.num_adults || 0) + (t.num_children || 0)
  }));

  const hotels = hotelBookings.map(h => ({
    type: 'hotel',
    id: h.id,
    title: h.hotel_slug || h.hotel_id || 'Hotel Booking',
    date: h.arrival_date,
    created_at: h.created_at,
    status: h.status || 'pending',
    price: h.total_price,
    people: (h.num_adults || 0) + (h.num_children || 0),
    nights: h.nights
  }));

  const cars = carBookings.map(c => {
    // Calculate price if missing
    const carObj = {
      type: 'car',
      id: c.id,
      title: c.car_model || 'Car Rental',
      date: c.pickup_date,
      created_at: c.created_at,
      status: c.status || 'pending',
      price: c.final_price || c.quoted_price || 0,
      people: c.num_passengers || 0,
      pickup_location: c.pickup_location,
      return_location: c.return_location,
      pickup_date: c.pickup_date,
      return_date: c.return_date,
      car_model: c.car_model,
      location: c.location,
      full_insurance: c.full_insurance,
      young_driver: c.young_driver
    };
    
    if (!carObj.price || carObj.price == 0) {
      try {
        carObj.price = calculateEstimatedPrice(carObj);
      } catch (err) {
        console.warn('Price calc error for booking', c.id, err);
        carObj.price = 0;
      }
    }
    
    return carObj;
  });

  return [...trips, ...hotels, ...cars].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

function renderReservations(filter) {
  const listEl = document.getElementById('reservationsList');
  const filtered = filter === 'all' ? ordersData : ordersData.filter(o => o.status === filter);

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>No ${filter !== 'all' ? filter : ''} bookings found.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(b => createBookingCard(b)).join('');
}

function createBookingCard(booking, simple = false) {
  const date = new Date(booking.date || booking.created_at).toLocaleDateString();
  const icon = booking.type === 'trip' ? '🚤' : (booking.type === 'car' ? '🚗' : '🏨');
  const statusClass = booking.status.toLowerCase();
  
  const statusText = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled'
  }[statusClass] || booking.status;

  // Price formatting
  let priceDisplay = `€${parseFloat(booking.price).toFixed(2)}`;
  if (!booking.price || booking.price == 0) {
    priceDisplay = '<span style="font-size: 0.9em; color: #ea580c;">Pending</span>';
  }

  return `
    <div class="reservation-card" onclick="window.openBookingDetails('${booking.id}', '${booking.type}')">
      <div class="res-info">
        <h4>${icon} ${booking.title}</h4>
        <div class="res-meta">
          <span>📅 ${date}</span>
          <span>👥 ${booking.people} guests</span>
          <span>💰 ${priceDisplay}</span>
        </div>
      </div>
      <div class="res-status ${statusClass}">
        ${statusText.toUpperCase()}
      </div>
    </div>
  `;
}

// --- i18n Labels for Booking Details ---
function getBookingLabels() {
  const lang = (typeof window.getCurrentLanguage === 'function') ? window.getCurrentLanguage() : 'pl';
  
  const labels = {
    pl: {
      status: 'Status',
      date: 'Data',
      createdAt: 'Utworzono',
      pickupLocation: 'Miejsce odbioru',
      returnLocation: 'Miejsce zwrotu',
      passengers: 'Pasażerowie',
      guests: 'Goście',
      nights: 'Noce',
      people: 'Osoby',
      totalPrice: 'Całkowita cena',
      pendingPrice: 'Oczekuje na wycenę',
      estimatedPrice: 'Szacunkowa cena na podstawie aktualnych stawek.',
      duration: 'Czas trwania',
      days: 'dni',
      insurance: 'Pełne ubezpieczenie',
      youngDriver: 'Młody kierowca',
      yes: 'Tak',
      no: 'Nie'
    },
    en: {
      status: 'Status',
      date: 'Date',
      createdAt: 'Created At',
      pickupLocation: 'Pickup Location',
      returnLocation: 'Return Location',
      passengers: 'Passengers',
      guests: 'Guests',
      nights: 'Nights',
      people: 'People',
      totalPrice: 'Total Price',
      pendingPrice: 'Pending quote',
      estimatedPrice: 'Estimated price based on current rates.',
      duration: 'Duration',
      days: 'days',
      insurance: 'Full Insurance',
      youngDriver: 'Young Driver',
      yes: 'Yes',
      no: 'No'
    },
    el: {
      status: 'Κατάσταση',
      date: 'Ημερομηνία',
      createdAt: 'Δημιουργήθηκε',
      pickupLocation: 'Τοποθεσία παραλαβής',
      returnLocation: 'Τοποθεσία επιστροφής',
      passengers: 'Επιβάτες',
      guests: 'Επισκέπτες',
      nights: 'Νύχτες',
      people: 'Άτομα',
      totalPrice: 'Συνολική τιμή',
      pendingPrice: 'Αναμονή τιμής',
      estimatedPrice: 'Εκτιμώμενη τιμή βάσει τρεχουσών τιμών.',
      duration: 'Διάρκεια',
      days: 'ημέρες',
      insurance: 'Πλήρης ασφάλιση',
      youngDriver: 'Νέος οδηγός',
      yes: 'Ναι',
      no: 'Όχι'
    },
    he: {
      status: 'סטטוס',
      date: 'תאריך',
      createdAt: 'נוצר ב',
      pickupLocation: 'מיקום איסוף',
      returnLocation: 'מיקום החזרה',
      passengers: 'נוסעים',
      guests: 'אורחים',
      nights: 'לילות',
      people: 'אנשים',
      totalPrice: 'מחיר כולל',
      pendingPrice: 'ממתין להצעת מחיר',
      estimatedPrice: 'מחיר משוער על פי תעריפים נוכחיים.',
      duration: 'משך',
      days: 'ימים',
      insurance: 'ביטוח מלא',
      youngDriver: 'נהג צעיר',
      yes: 'כן',
      no: 'לא'
    }
  };
  
  return labels[lang] || labels.pl;
}

// Format location names nicely
function formatLocationName(location) {
  if (!location) return '-';
  
  const lang = (typeof window.getCurrentLanguage === 'function') ? window.getCurrentLanguage() : 'pl';
  
  // Location mappings
  const locationNames = {
    'airport_pfo': { pl: 'Lotnisko Pafos (PFO)', en: 'Paphos Airport (PFO)', el: 'Αεροδρόμιο Πάφου (PFO)', he: 'נמל תעופה פאפוס (PFO)' },
    'airport_lca': { pl: 'Lotnisko Larnaka (LCA)', en: 'Larnaca Airport (LCA)', el: 'Αεροδρόμιο Λάρνακας (LCA)', he: 'נמל תעופה לרנקה (LCA)' },
    'paphos': { pl: 'Pafos', en: 'Paphos', el: 'Πάφος', he: 'פאפוס' },
    'larnaca': { pl: 'Larnaka', en: 'Larnaca', el: 'Λάρνακα', he: 'לרנקה' },
    'limassol': { pl: 'Limassol', en: 'Limassol', el: 'Λεμεσός', he: 'לימסול' },
    'nicosia': { pl: 'Nikozja', en: 'Nicosia', el: 'Λευκωσία', he: 'ניקוסיה' },
    'ayia_napa': { pl: 'Ayia Napa', en: 'Ayia Napa', el: 'Αγία Νάπα', he: 'איה נאפה' },
    'protaras': { pl: 'Protaras', en: 'Protaras', el: 'Πρωταράς', he: 'פרוטראס' }
  };
  
  const key = location.toLowerCase().trim();
  if (locationNames[key]) {
    return locationNames[key][lang] || locationNames[key].en;
  }
  
  // Fallback: format nicely (replace underscores, capitalize)
  return location
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Format status with translation
function formatStatus(status, lang) {
  const statusLabels = {
    pending: { pl: 'Oczekujące', en: 'Pending', el: 'Εκκρεμεί', he: 'ממתין' },
    confirmed: { pl: 'Potwierdzone', en: 'Confirmed', el: 'Επιβεβαιωμένο', he: 'מאושר' },
    completed: { pl: 'Zakończone', en: 'Completed', el: 'Ολοκληρώθηκε', he: 'הושלם' },
    cancelled: { pl: 'Anulowane', en: 'Cancelled', el: 'Ακυρώθηκε', he: 'בוטל' },
    message_sent: { pl: 'Wiadomość wysłana', en: 'Message Sent', el: 'Μήνυμα εστάλη', he: 'הודעה נשלחה' }
  };
  
  const key = (status || 'pending').toLowerCase();
  if (statusLabels[key]) {
    return statusLabels[key][lang] || statusLabels[key].en;
  }
  return status;
}

// --- Details Modal Logic ---
window.openBookingDetails = function(id, type) {
  const booking = ordersData.find(o => o.id === id && o.type === type);
  if (!booking) return;

  const modal = document.getElementById('bookingDetailsModal');
  const title = document.getElementById('bookingDetailTitle');
  const body = document.getElementById('bookingDetailBody');
  
  const labels = getBookingLabels();
  const lang = (typeof window.getCurrentLanguage === 'function') ? window.getCurrentLanguage() : 'pl';

  title.textContent = booking.title;
  
  // Calculate duration for car rentals
  let durationText = '';
  if (booking.type === 'car' && booking.pickup_date && booking.return_date) {
    const start = new Date(booking.pickup_date);
    const end = new Date(booking.return_date);
    const days = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
    durationText = `${days} ${labels.days}`;
  }
  
  let detailsHtml = `
    <div class="detail-row">
      <span class="detail-label">${labels.status}</span>
      <span class="detail-value detail-status detail-status--${booking.status}">${formatStatus(booking.status, lang).toUpperCase()}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">${labels.date}</span>
      <span class="detail-value">📅 ${new Date(booking.date).toLocaleDateString(lang === 'he' ? 'he-IL' : lang + '-' + (lang === 'el' ? 'GR' : lang.toUpperCase()))}</span>
    </div>
  `;

  if (booking.type === 'car') {
    detailsHtml += `
      <div class="detail-row">
        <span class="detail-label">${labels.pickupLocation}</span>
        <span class="detail-value">📍 ${formatLocationName(booking.pickup_location)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">${labels.returnLocation}</span>
        <span class="detail-value">📍 ${formatLocationName(booking.return_location)}</span>
      </div>
      ${durationText ? `
      <div class="detail-row">
        <span class="detail-label">${labels.duration}</span>
        <span class="detail-value" style="color: #2563eb; font-weight: 600;">🕐 ${durationText}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">${labels.passengers}</span>
        <span class="detail-value">👥 ${booking.people}</span>
      </div>
      ${booking.full_insurance !== undefined ? `
      <div class="detail-row">
        <span class="detail-label">${labels.insurance}</span>
        <span class="detail-value">${booking.full_insurance ? '✅ ' + labels.yes + ' (+17€/' + labels.days.slice(0, -1) + ')' : '❌ ' + labels.no}</span>
      </div>
      ` : ''}
      ${booking.young_driver !== undefined ? `
      <div class="detail-row">
        <span class="detail-label">${labels.youngDriver}</span>
        <span class="detail-value">${booking.young_driver ? '✅ ' + labels.yes + ' (+10€/' + labels.days.slice(0, -1) + ')' : '❌ ' + labels.no}</span>
      </div>
      ` : ''}
    `;
  } else if (booking.type === 'hotel') {
    detailsHtml += `
      <div class="detail-row">
        <span class="detail-label">${labels.guests}</span>
        <span class="detail-value">👥 ${booking.people}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">${labels.nights}</span>
        <span class="detail-value">🌙 ${booking.nights || '-'}</span>
      </div>
    `;
  } else {
    detailsHtml += `
      <div class="detail-row">
        <span class="detail-label">${labels.people}</span>
        <span class="detail-value">👥 ${booking.people}</span>
      </div>
    `;
  }

  // Price
  const priceText = (!booking.price || booking.price == 0) 
    ? `<span style="color:#ea580c">${labels.pendingPrice}</span>` 
    : `€${parseFloat(booking.price).toFixed(2)}`;
  
  detailsHtml += `
    <div class="detail-row detail-row--total">
      <span class="detail-label">${labels.totalPrice}</span>
      <span class="detail-value detail-price">${priceText}</span>
    </div>
  `;
  
  if (booking.type === 'car' && booking.price > 0 && (!booking.final_price && !booking.quoted_price)) {
    detailsHtml += `<p class="detail-note">ℹ️ ${labels.estimatedPrice}</p>`;
  }

  body.innerHTML = detailsHtml;
  modal.hidden = false;
};

// --- Modal Event Listeners ---
function setupModalListeners() {
  const modal = document.getElementById('bookingDetailsModal');
  const btnX = document.getElementById('btnCloseModalX');
  const btnClose = document.getElementById('btnCloseModalBtn');
  
  if (!modal) return;

  function closeModal() {
    modal.hidden = true;
  }

  if (btnX) btnX.addEventListener('click', closeModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupModalListeners);
} else {
  setupModalListeners();
}

// --- Content Logic ---
async function loadUserContent() {
  const tabs = document.querySelectorAll('[data-content-tab]');
  tabs.forEach(tab => {
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);
    newTab.addEventListener('click', () => {
      document.querySelectorAll('[data-content-tab]').forEach(t => t.classList.remove('active'));
      newTab.classList.add('active');
      document.querySelectorAll('.content-tab-pane').forEach(p => p.style.display = 'none');
      const target = document.getElementById(`content-${newTab.dataset.contentTab}`);
      if (target) target.style.display = 'block';
    });
  });
  await Promise.all([loadUserPhotos(), loadUserComments()]);
}

async function loadUserPhotos() {
  const container = document.getElementById('userPhotosList');
  try {
    const photos = await getUserPhotos(currentUser.id, 50);
    if (photos.length === 0) {
      container.innerHTML = '<p class="empty-state">No photos uploaded yet.</p>';
      return;
    }
    container.innerHTML = photos.map(photo => `
      <div class="photo-card">
        <img src="${photo.photo_url}" loading="lazy" alt="User photo">
        <div class="photo-actions">
          <button class="action-btn delete" onclick="window.deleteContent('photo', '${photo.photo_filename}', '${photo.comment_id}')" title="Delete Photo">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading photos:', err);
    container.innerHTML = '<p class="error-state">Failed to load photos.</p>';
  }
}

async function loadUserComments() {
  const container = document.getElementById('userCommentsList');
  try {
    const { data: comments, error } = await supabase
      .from('poi_comments')
      .select(`id, content, created_at, poi_id, is_edited, poi_comment_likes(count)`)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!comments || comments.length === 0) {
      container.innerHTML = '<p class="empty-state">No comments yet.</p>';
      return;
    }
    container.innerHTML = comments.map(comment => {
      const date = new Date(comment.created_at).toLocaleDateString();
      const likes = comment.poi_comment_likes?.[0]?.count || 0;
      return `
        <div class="comment-card" id="comment-${comment.id}">
          <div class="comment-header">
            <span class="comment-place">📍 ${comment.poi_id}</span>
            <span class="comment-date">${date}</span>
          </div>
          <div class="comment-text">${comment.content}</div>
          <div class="comment-footer">
            <div class="comment-stats">
              <span>❤️ ${likes}</span>
              ${comment.is_edited ? '<span>✏️ Edited</span>' : ''}
            </div>
            <div class="comment-actions-row">
              <button class="btn btn-sm btn-ghost delete-btn" onclick="window.deleteContent('comment', null, '${comment.id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading comments:', err);
    container.innerHTML = '<p class="error-state">Failed to load comments.</p>';
  }
}

window.deleteContent = async function(type, filename, id) {
  if (!confirm('Are you sure you want to delete this?')) return;
  try {
    if (type === 'photo' && filename) {
      await supabase.storage.from('poi-photos').remove([filename]);
    }
    if (id) {
      await supabase.from('poi_comments').delete().eq('id', id);
    }
    showToast('Deleted successfully', 'success');
    if (type === 'photo') loadUserPhotos();
    if (type === 'comment') loadUserComments();
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete', 'error');
  }
};

function showToast(message, type = 'info') {
  if (window.Toast) {
    new window.Toast(message, type);
  } else {
    alert(message);
  }
}

function resolvePoiName(poi) {
  if (!poi) return '';
  if (typeof window !== 'undefined' && typeof window.getPoiName === 'function') {
    const name = window.getPoiName(poi);
    if (name) return name;
  }
  if (poi.name) return poi.name;
  if (poi.id) return poi.id;
  return '';
}

function resolvePoiBadge(poi) {
  if (!poi) return '';
  if (typeof window !== 'undefined' && typeof window.getPoiBadge === 'function') {
    const badge = window.getPoiBadge(poi);
    if (badge) return badge;
  }
  if (poi.badge) return poi.badge;
  if (poi.name) return poi.name;
  if (poi.id) return poi.id;
  return '';
}

function renderPlaceBadgeCard(badge) {
  const hasTasks = badge.tasksTotal > 0;
  const tasksRatio = hasTasks && badge.tasksTotal > 0
    ? Math.min(100, Math.max(0, Math.round((badge.tasksCompleted / badge.tasksTotal) * 100)))
    : 0;
  return `
    <div class="badge-card">
      <div class="badge-header-row">
        <div class="badge-icon">🏅</div>
        <div class="badge-texts">
          <p class="badge-name">${badge.badgeTitle}</p>
          <p class="badge-place">${badge.placeName}</p>
        </div>
      </div>
      <div class="badge-meta">
        <p class="badge-xp">${badge.xp ? `✨ ${badge.xp} XP` : ''}</p>
        ${hasTasks ? `
          <div class="badge-tasks">
            <span class="badge-tasks-label">Zadania w tym miejscu: ${badge.tasksCompleted} / ${badge.tasksTotal}</span>
            <div class="badge-tasks-bar">
              <div class="badge-tasks-fill" style="width: ${tasksRatio}%;"></div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

async function loadAchievements() {
  const container = document.getElementById('badgesGrid');
  if (!container) return;
  try {
    if (!currentProfile || !Array.isArray(currentProfile.visited_places)) {
      container.innerHTML = '<p class="empty-state">No badges yet. Visit places to earn them!</p>';
      return;
    }

    const visitedIds = Array.from(new Set(currentProfile.visited_places.filter(Boolean)));

    if (visitedIds.length === 0) {
      container.innerHTML = '<p class="empty-state">No badges yet. Visit places to earn them!</p>';
      return;
    }

    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading badges...</p></div>';

    const { data: pois, error } = await supabase
      .from('pois')
      .select('id, name, name_i18n, badge, badge_i18n, xp')
      .in('id', visitedIds);

    if (error) {
      console.error('Error loading POI badges:', error);
      container.innerHTML = '<p class="error-state">Failed to load badges.</p>';
      return;
    }

    const badges = [];

    const PoiTaskMap = {};

    let completedSet = new Set();
    try {
      if (currentUser) {
        const { data: completed, error: completedError } = await supabase
          .from('completed_tasks')
          .select('task_id')
          .eq('user_id', currentUser.id);
        if (!completedError && Array.isArray(completed)) {
          completedSet = new Set(completed.map(row => row.task_id));
        }
      }
    } catch (tasksError) {
      console.warn('Error loading completed tasks summary for badges:', tasksError);
    }

    (pois || []).forEach(poi => {
      const badgeTitle = resolvePoiBadge(poi);
      const placeName = resolvePoiName(poi);
      if (!badgeTitle && !placeName) {
        return;
      }

      const taskIds = PoiTaskMap[poi.id] || [];
      const tasksTotal = taskIds.length;
      let tasksCompleted = 0;
      if (tasksTotal > 0 && completedSet.size > 0) {
        tasksCompleted = taskIds.reduce(
          (sum, id) => sum + (completedSet.has(id) ? 1 : 0),
          0
        );
      }

      badges.push({
        poiId: poi.id,
        badgeTitle,
        placeName,
        xp: poi.xp || 0,
        tasksTotal,
        tasksCompleted
      });
    });

    if (badges.length === 0) {
      container.innerHTML = '<p class="empty-state">No badges yet. Visit places to earn them!</p>';
      return;
    }

    container.innerHTML = badges.map(renderPlaceBadgeCard).join('');
  } catch (error) {
    console.error('Unexpected error while loading achievements:', error);
    container.innerHTML = '<p class="error-state">Failed to load badges.</p>';
  }
}

// Setup tabs helper
document.querySelectorAll('.tabs-line .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.parentElement;
    group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.filter) renderReservations(btn.dataset.filter);
  });
});
