import { supabase } from '/js/supabaseClient.js';
import { initCarReservationBindings } from '/js/car-reservation.js?v=20260205f';
import { calculateCarRentalQuote, normalizeLocationForOffer } from '/js/car-pricing.js';

let allHomeCars = [];
let homeCarsById = {};
let homeCarsByLocation = { larnaca: [], paphos: [] };
let homeCarsCurrentLocation = 'larnaca';
let homeCarsSavedOnly = false;
let homeCarsLastQuoteByCarId = {};
let homeCarsFinderState = null;
let homeCarsFinderManualLocation = false;

let homeCarsCarouselUpdate = null;
let previousBodyCarLocation = null;
const PAPHOS_WIDGET_LOCATIONS = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

function getLang() {
  const lang = (window.appI18n?.language || document.documentElement?.lang || 'pl').toLowerCase();
  return lang.startsWith('en') ? 'en' : 'pl';
}

function text(pl, en) {
  return getLang() === 'en' ? en : pl;
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildDefaultFinderState() {
  const pickup = new Date();
  pickup.setDate(pickup.getDate() + 7);
  const ret = new Date(pickup.getTime());
  ret.setDate(ret.getDate() + 3);

  return {
    pickupDate: toDateInputValue(pickup),
    pickupTime: '10:00',
    returnDate: toDateInputValue(ret),
    returnTime: '10:00',
    pickupLocation: 'larnaca',
    returnLocation: 'larnaca',
    fullInsurance: false,
    youngDriver: false,
  };
}

function isPaphosWidgetLocation(value) {
  return PAPHOS_WIDGET_LOCATIONS.has(String(value || '').trim());
}

function evaluateFinderOffer(state) {
  const paphosEligible = isPaphosWidgetLocation(state.pickupLocation)
    && isPaphosWidgetLocation(state.returnLocation)
    && !state.youngDriver;
  return {
    offer: paphosEligible ? 'paphos' : 'larnaca',
    paphosEligible,
  };
}

function normalizePaphosLocation(value) {
  const normalized = String(value || '').trim();
  if (isPaphosWidgetLocation(normalized)) return normalized;
  return 'hotel';
}

function getFinderDurationState(state) {
  const pickupDate = String(state?.pickupDate || '').trim();
  const returnDate = String(state?.returnDate || '').trim();
  const pickupTime = String(state?.pickupTime || '10:00').trim() || '10:00';
  const returnTime = String(state?.returnTime || '10:00').trim() || '10:00';

  if (!pickupDate || !returnDate) {
    return { ready: false, reason: 'missing_dates' };
  }

  const pickup = new Date(`${pickupDate}T${pickupTime}`);
  const ret = new Date(`${returnDate}T${returnTime}`);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(ret.getTime())) {
    return { ready: false, reason: 'invalid_dates' };
  }

  const hours = (ret.getTime() - pickup.getTime()) / 36e5;
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ready: false, reason: 'return_before_pickup' };
  }

  const days = Math.ceil(hours / 24);
  if (!Number.isFinite(days) || days < 3) {
    return { ready: false, reason: 'minimum_days', days };
  }

  return { ready: true, hours, days };
}

function getFromPrice(car) {
  const loc = String(car?.location || '').toLowerCase();
  if (loc === 'paphos') {
    return car.price_10plus_days || car.price_per_day || 30;
  }
  return car.price_per_day || car.price_10plus_days || car.price_7_10days || car.price_4_6days || 35;
}

function buildPricingMapForLocation(location) {
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const out = {};
  const cars = homeCarsByLocation[loc] || [];

  cars.forEach((car) => {
    const carModelName = window.getCarName ? window.getCarName(car) : (car.car_model || car.car_type || 'Car');

    if (loc === 'larnaca') {
      const perDay = car.price_per_day || car.price_10plus_days || car.price_7_10days || car.price_4_6days || 35;
      out[carModelName] = [perDay * 3, perDay, perDay, perDay];
      return;
    }

    out[carModelName] = [
      car.price_3days || 130,
      car.price_4_6days || 34,
      car.price_7_10days || 32,
      car.price_10plus_days || 30,
    ];
  });

  return out;
}

function buildFinderLocationOptions(selectedValue) {
  const selected = String(selectedValue || '').trim();
  const options = [
    {
      label: text('🚗 Oferta Larnaka / cały Cypr', '🚗 Larnaca offer / island-wide'),
      items: [
        { value: 'larnaca', label: text('Larnaka • bez opłaty', 'Larnaca • no fee') },
        { value: 'nicosia', label: text('Nikozja • +15€', 'Nicosia • +15€') },
        { value: 'ayia-napa', label: text('Ayia Napa • +15€', 'Ayia Napa • +15€') },
        { value: 'protaras', label: text('Protaras • +20€', 'Protaras • +20€') },
        { value: 'limassol', label: text('Limassol • +20€', 'Limassol • +20€') },
        { value: 'paphos', label: text('Pafos • +40€', 'Paphos • +40€') },
      ],
    },
    {
      label: text('🌴 Strefa Pafos', '🌴 Paphos zone'),
      items: [
        { value: 'airport_pfo', label: text('Lotnisko Pafos (PFO)', 'Paphos Airport (PFO)') },
        { value: 'city_center', label: text('Pafos • centrum', 'Paphos • city center') },
        { value: 'hotel', label: text('Hotel / resort', 'Hotel / resort') },
        { value: 'other', label: text('Inne miejsce (Pafos)', 'Other place (Paphos)') },
      ],
    },
  ];

  return options.map((group) => `
    <optgroup label="${escapeHtml(group.label)}">
      ${group.items.map((item) => `
        <option value="${escapeHtml(item.value)}" ${item.value === selected ? 'selected' : ''}>
          ${escapeHtml(item.label)}
        </option>
      `).join('')}
    </optgroup>
  `).join('');
}

function readFinderStateFromDom() {
  const defaults = buildDefaultFinderState();
  return {
    pickupDate: String(document.getElementById('carsFinderPickupDate')?.value || defaults.pickupDate).trim(),
    pickupTime: String(document.getElementById('carsFinderPickupTime')?.value || defaults.pickupTime).trim() || defaults.pickupTime,
    returnDate: String(document.getElementById('carsFinderReturnDate')?.value || defaults.returnDate).trim(),
    returnTime: String(document.getElementById('carsFinderReturnTime')?.value || defaults.returnTime).trim() || defaults.returnTime,
    pickupLocation: String(document.getElementById('carsFinderPickupLocation')?.value || defaults.pickupLocation).trim() || defaults.pickupLocation,
    returnLocation: String(document.getElementById('carsFinderReturnLocation')?.value || defaults.returnLocation).trim() || defaults.returnLocation,
    fullInsurance: !!document.getElementById('carsFinderInsurance')?.checked,
    youngDriver: !!document.getElementById('carsFinderYoungDriver')?.checked,
  };
}

function renderFinderStatus() {
  const statusEl = document.getElementById('carsFinderStatus');
  if (!statusEl) return;

  const state = homeCarsFinderState || buildDefaultFinderState();
  const duration = getFinderDurationState(state);
  const offer = evaluateFinderOffer(state);
  const offerLabel = offer.offer === 'paphos' ? text('Pafos', 'Paphos') : text('Larnaka', 'Larnaca');

  statusEl.classList.remove('is-warning', 'is-paphos', 'is-larnaca');

  if (!duration.ready) {
    if (duration.reason === 'minimum_days') {
      statusEl.textContent = text(
        'Minimalny wynajem to 3 dni. Ustaw dłuższy okres, aby zobaczyć pełne wyceny.',
        'Minimum rental is 3 days. Increase rental length to see full live totals.'
      );
      statusEl.classList.add('is-warning');
      return;
    }
    if (duration.reason === 'return_before_pickup') {
      statusEl.textContent = text(
        'Data zwrotu musi być późniejsza niż data odbioru.',
        'Return date/time must be later than pickup date/time.'
      );
      statusEl.classList.add('is-warning');
      return;
    }
    statusEl.textContent = text(
      'Uzupełnij trasę i daty. Lista aut zaktualizuje się automatycznie.',
      'Complete route and dates. Car list will refresh automatically.'
    );
    return;
  }

  if (homeCarsFinderManualLocation) {
    statusEl.classList.add(offer.offer === 'paphos' ? 'is-paphos' : 'is-larnaca');
    statusEl.textContent = text(
      `Aktywna oferta: ${offerLabel}. Włączony ręczny podgląd przez zakładki.`,
      `Active offer: ${offerLabel}. Manual tab view is active.`
    );
    return;
  }

  statusEl.classList.add(offer.offer === 'paphos' ? 'is-paphos' : 'is-larnaca');
  statusEl.textContent = text(
    `Aktywna oferta: ${offerLabel}. Lista aut jest dobierana automatycznie według trasy.`,
    `Active offer: ${offerLabel}. Car list is auto-selected from your route.`
  );
}

function renderHomeCarsFinder() {
  const root = document.getElementById('carsHomeFinder');
  if (!root) return;

  const state = homeCarsFinderState || buildDefaultFinderState();

  root.innerHTML = `
    <div class="home-cars-finder-panel">
      <div class="home-cars-finder-panel__header">
        <h3>${escapeHtml(text('Znajdź auto w 15 sekund', 'Find your car in 15 seconds'))}</h3>
        <p>${escapeHtml(text('Podaj trasę i czas. Pokażemy końcową cenę i czas wynajmu od razu na kartach aut.', 'Set route and timing. We will show final total and rental duration directly on each car card.'))}</p>
      </div>

      <div class="home-cars-finder-zones" aria-hidden="true">
        <span class="home-cars-finder-zone home-cars-finder-zone--larnaca">${escapeHtml(text('🚗 Oferta Larnaka / cały Cypr', '🚗 Larnaca offer / island-wide'))}</span>
        <span class="home-cars-finder-zone home-cars-finder-zone--paphos">${escapeHtml(text('🌴 Strefa Pafos', '🌴 Paphos zone'))}</span>
      </div>

      <div class="home-cars-finder-grid">
        <label class="home-cars-finder-field">
          <span>${escapeHtml(text('Data odbioru', 'Pickup date'))}</span>
          <input id="carsFinderPickupDate" type="date" value="${escapeHtml(state.pickupDate)}" />
        </label>
        <label class="home-cars-finder-field">
          <span>${escapeHtml(text('Godzina odbioru', 'Pickup time'))}</span>
          <input id="carsFinderPickupTime" type="time" value="${escapeHtml(state.pickupTime)}" />
        </label>
        <label class="home-cars-finder-field">
          <span>${escapeHtml(text('Data zwrotu', 'Return date'))}</span>
          <input id="carsFinderReturnDate" type="date" value="${escapeHtml(state.returnDate)}" />
        </label>
        <label class="home-cars-finder-field">
          <span>${escapeHtml(text('Godzina zwrotu', 'Return time'))}</span>
          <input id="carsFinderReturnTime" type="time" value="${escapeHtml(state.returnTime)}" />
        </label>
        <label class="home-cars-finder-field home-cars-finder-field--wide">
          <span>${escapeHtml(text('Miejsce odbioru', 'Pickup location'))}</span>
          <select id="carsFinderPickupLocation">${buildFinderLocationOptions(state.pickupLocation)}</select>
        </label>
        <label class="home-cars-finder-field home-cars-finder-field--wide">
          <span>${escapeHtml(text('Miejsce zwrotu', 'Return location'))}</span>
          <select id="carsFinderReturnLocation">${buildFinderLocationOptions(state.returnLocation)}</select>
        </label>
      </div>

      <div class="home-cars-finder-actions">
        <label class="home-cars-finder-checkbox">
          <input id="carsFinderInsurance" type="checkbox" ${state.fullInsurance ? 'checked' : ''} />
          <span>${escapeHtml(text('Pełne AC (+17€/dzień)', 'Full insurance (+17€/day)'))}</span>
        </label>
        <label class="home-cars-finder-checkbox">
          <input id="carsFinderYoungDriver" type="checkbox" ${state.youngDriver ? 'checked' : ''} />
          <span>${escapeHtml(text('Młody kierowca (+10€/dzień)', 'Young driver (+10€/day)'))}</span>
        </label>
        <button id="carsFinderReset" type="button" class="btn ghost home-cars-finder-reset">
          ${escapeHtml(text('Resetuj filtr', 'Reset finder'))}
        </button>
      </div>

      <p id="carsFinderStatus" class="home-cars-finder-status" aria-live="polite"></p>
    </div>
  `;

  const controls = root.querySelectorAll('input, select');
  controls.forEach((control) => {
    control.addEventListener('change', () => syncHomeCarsFinderState({ fromUser: true }));
    if (control.tagName === 'INPUT') {
      control.addEventListener('input', () => syncHomeCarsFinderState({ fromUser: true }));
    }
  });

  const resetBtn = document.getElementById('carsFinderReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      homeCarsFinderManualLocation = false;
      homeCarsFinderState = buildDefaultFinderState();
      renderHomeCarsFinder();
      syncHomeCarsFinderState({ fromUser: false });
    });
  }

  renderFinderStatus();
}

function syncHomeCarsFinderState(options = {}) {
  const { fromUser = false } = options;
  homeCarsFinderState = readFinderStateFromDom();

  if (fromUser) {
    homeCarsFinderManualLocation = false;
  }

  const { offer } = evaluateFinderOffer(homeCarsFinderState);
  if (!homeCarsFinderManualLocation && homeCarsCurrentLocation !== offer) {
    homeCarsCurrentLocation = offer;
    renderHomeCarsTabs();
  }

  renderHomeCars();
  renderFinderStatus();
  try {
    homeCarsCarouselUpdate?.();
  } catch (_) {}
}

function buildQuoteForCarWithFinder(car, finderState) {
  if (!car || !finderState) return null;

  const duration = getFinderDurationState(finderState);
  if (!duration.ready) return null;

  const location = String(car.location || '').toLowerCase() === 'paphos' ? 'paphos' : 'larnaca';
  const carModelName = window.getCarName ? window.getCarName(car) : (car.car_model || car.car_type || 'Car');
  if (!carModelName) return null;

  const pricingMatrix = location === 'larnaca'
    ? (() => {
      const perDay = Number(car.price_per_day || car.price_10plus_days || car.price_7_10days || car.price_4_6days || 0);
      if (!Number.isFinite(perDay) || perDay <= 0) return null;
      return [perDay * 3, perDay, perDay, perDay];
    })()
    : [
      Number(car.price_3days || 0),
      Number(car.price_4_6days || 0),
      Number(car.price_7_10days || 0),
      Number(car.price_10plus_days || 0),
    ];

  if (!Array.isArray(pricingMatrix) || pricingMatrix.length < 4 || !pricingMatrix.some((v) => Number.isFinite(v) && v > 0)) {
    return null;
  }

  const pickupLocation = location === 'paphos'
    ? normalizePaphosLocation(finderState.pickupLocation)
    : (normalizeLocationForOffer(finderState.pickupLocation, 'larnaca') || 'larnaca');
  const returnLocation = location === 'paphos'
    ? normalizePaphosLocation(finderState.returnLocation)
    : (normalizeLocationForOffer(finderState.returnLocation, 'larnaca') || 'larnaca');

  return calculateCarRentalQuote({
    pricingMatrix,
    offer: location,
    carModel: carModelName,
    pickupDateStr: finderState.pickupDate,
    returnDateStr: finderState.returnDate,
    pickupTimeStr: finderState.pickupTime,
    returnTimeStr: finderState.returnTime,
    pickupLocation,
    returnLocation,
    fullInsurance: !!finderState.fullInsurance,
    youngDriver: location === 'larnaca' && !!finderState.youngDriver,
  });
}

function renderHomeCarsTabs() {
  const tabsWrap = document.getElementById('carsHomeTabs');
  if (!tabsWrap) return;

  const lang = String((window.appI18n && window.appI18n.language) || document.documentElement?.lang || 'pl').toLowerCase();
  const savedLabel = lang.startsWith('en') ? 'Saved' : 'Zapisane';
  const savedStar = homeCarsSavedOnly ? '★' : '☆';

  tabsWrap.innerHTML = [
    `<button class="recommendations-home-tab ce-home-pill ${homeCarsCurrentLocation === 'larnaca' ? 'active' : ''}" type="button" data-location="larnaca">${escapeHtml(text('Larnaka', 'Larnaca'))}</button>`,
    `<button class="recommendations-home-tab ce-home-pill ${homeCarsCurrentLocation === 'paphos' ? 'active' : ''}" type="button" data-location="paphos">${escapeHtml(text('Pafos', 'Paphos'))}</button>`,
    `<button class="recommendations-home-tab ce-home-pill ${homeCarsSavedOnly ? 'active' : ''}" type="button" data-filter="saved" aria-pressed="${homeCarsSavedOnly ? 'true' : 'false'}">${escapeHtml(savedLabel)} ${savedStar}</button>`,
  ].join('');

  tabsWrap.querySelectorAll('button[data-location]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const loc = String(btn.getAttribute('data-location') || '').trim();
      if (!loc) return;
      homeCarsFinderManualLocation = true;
      homeCarsCurrentLocation = loc === 'paphos' ? 'paphos' : 'larnaca';
      renderHomeCarsTabs();
      renderHomeCars();
      renderFinderStatus();
      try {
        homeCarsCarouselUpdate?.();
      } catch (_) {}
    });
  });

  const savedBtn = tabsWrap.querySelector('button[data-filter="saved"]');
  if (savedBtn) {
    savedBtn.addEventListener('click', () => {
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

      if (!homeCarsSavedOnly) {
        try {
          const syncFn = window.CE_SAVED_CATALOG && window.CE_SAVED_CATALOG.syncForCurrentUser;
          if (typeof syncFn === 'function') {
            void Promise.resolve(syncFn()).finally(() => {
              homeCarsSavedOnly = true;
              renderHomeCarsTabs();
              renderHomeCars();
              try {
                homeCarsCarouselUpdate?.();
              } catch (_) {}
            });
            return;
          }
        } catch (_) {}
      }

      homeCarsSavedOnly = !homeCarsSavedOnly;
      renderHomeCarsTabs();
      renderHomeCars();
      try {
        homeCarsCarouselUpdate?.();
      } catch (_) {}
    });
  }
}

function renderHomeCars() {
  const grid = document.getElementById('carsHomeGrid');
  if (!grid) return;

  let list = homeCarsByLocation[homeCarsCurrentLocation] || [];
  const finderState = homeCarsFinderState || buildDefaultFinderState();
  const finderDuration = getFinderDurationState(finderState);
  const finderReady = finderDuration.ready;

  if (homeCarsSavedOnly) {
    const api = window.CE_SAVED_CATALOG;
    if (api && typeof api.isSaved === 'function') {
      list = list.filter(car => api.isSaved('car', String(car?.id || '')));
    } else {
      list = [];
    }
  }

  if (!list.length) {
    grid.innerHTML = `
      <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #9ca3af;">
        <p>${escapeHtml(text('Brak dostępnych aut w tej chwili', 'No cars available right now'))}</p>
      </div>
    `;
    return;
  }

  homeCarsLastQuoteByCarId = {};
  const noDepositLabel = text('Bez kaucji', 'No deposit');
  const totalLabel = text('Razem', 'Total');
  const daysLabel = text('dni', 'days');
  const fromLabel = text('Od', 'From');
  const perDayLabel = text('/ dzień', '/ day');

  const rows = list.map((car) => {
    const quote = finderReady ? buildQuoteForCarWithFinder(car, finderState) : null;
    homeCarsLastQuoteByCarId[String(car.id)] = quote;
    return { car, quote };
  });

  if (finderReady) {
    rows.sort((a, b) => {
      const aTotal = Number(a.quote?.total || Number.POSITIVE_INFINITY);
      const bTotal = Number(b.quote?.total || Number.POSITIVE_INFINITY);
      if (aTotal !== bTotal) return aTotal - bTotal;
      const aSort = Number(a.car?.sort_order || 0);
      const bSort = Number(b.car?.sort_order || 0);
      return aSort - bSort;
    });
  }

  grid.innerHTML = rows.map(({ car, quote }) => {
    const title = window.getCarName ? window.getCarName(car) : (car.car_model || car.car_type || 'Car');
    const transmission = String(car.transmission || '').toLowerCase() === 'automatic'
      ? text('Automat', 'Automatic')
      : text('Manual', 'Manual');
    const seats = car.max_passengers || 5;
    const seatsText = text(`${seats} miejsc`, `${seats} seats`);

    const imageUrl = car.image_url || `https://placehold.co/400x250/1e293b/ffffff?text=${encodeURIComponent(title)}`;
    const quoteLine = quote
      ? `${totalLabel} ${Number(quote.total).toFixed(2)}€ • ${quote.days} ${daysLabel}`
      : `${fromLabel} ${Number(getFromPrice(car)).toFixed(0)}€ ${perDayLabel} • ${transmission} • ${seatsText}`;

    return `
      <a
        href="#"
        class="recommendation-home-card"
        onclick="openCarHomeModal('${escapeHtml(car.id)}'); return false;"
      >
        <div class="ce-home-featured-badge">🚗 ${escapeHtml(noDepositLabel)}</div>
        <button
          type="button"
          class="ce-save-star ce-home-card-star"
          data-ce-save="1"
          data-item-type="car"
          data-ref-id="${escapeHtml(car.id)}"
          aria-label="Zapisz"
          title="Zapisz"
          onclick="event.preventDefault(); event.stopPropagation();"
        >☆</button>
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="ce-home-card-image" loading="lazy" />
        <div class="ce-home-card-overlay">
          <h3 class="ce-home-card-title">${escapeHtml(title)}</h3>
          <p class="ce-home-card-subtitle">${escapeHtml(quoteLine)}</p>
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

function initHomeCarsCarousel() {
  const prev = document.querySelector('.home-carousel-container .home-carousel-nav.prev[data-target="#carsHomeGrid"]');
  const next = document.querySelector('.home-carousel-container .home-carousel-nav.next[data-target="#carsHomeGrid"]');
  const grid = document.getElementById('carsHomeGrid');
  if (!prev || !next || !grid) return;
  if (grid.dataset.carouselInit === 'true') return;
  grid.dataset.carouselInit = 'true';

  const scrollBy = () => Math.round(grid.clientWidth * 0.85);
  const updateArrows = () => {
    const maxScroll = grid.scrollWidth - grid.clientWidth - 1;
    const atStart = grid.scrollLeft <= 1;
    const atEnd = grid.scrollLeft >= maxScroll;
    prev.hidden = atStart;
    next.hidden = atEnd;
    const noOverflow = grid.scrollWidth <= grid.clientWidth + 1;
    if (noOverflow) {
      prev.hidden = true;
      next.hidden = true;
    }
  };

  homeCarsCarouselUpdate = updateArrows;

  prev.addEventListener('click', () => {
    grid.scrollBy({ left: -scrollBy(), behavior: 'smooth' });
    setTimeout(updateArrows, 350);
  });

  next.addEventListener('click', () => {
    grid.scrollBy({ left: scrollBy(), behavior: 'smooth' });
    setTimeout(updateArrows, 350);
  });

  grid.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
}

function setBodyCarLocation(next) {
  if (!document.body) return;

  if (previousBodyCarLocation === null) {
    previousBodyCarLocation = document.body.dataset.carLocation || '';
  }

  if (next) {
    document.body.dataset.carLocation = next;
  } else {
    if (previousBodyCarLocation) {
      document.body.dataset.carLocation = previousBodyCarLocation;
    } else {
      delete document.body.dataset.carLocation;
    }
  }
}

function buildReservationFormHtml({ location, selectedCarId, prefill = null }) {
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const cars = homeCarsByLocation[loc] || [];

  const today = new Date();
  const pickupDefault = today.toISOString().split('T')[0];
  const returnDefaultDate = new Date(today.getTime());
  returnDefaultDate.setDate(returnDefaultDate.getDate() + 3);
  const returnDefault = returnDefaultDate.toISOString().split('T')[0];
  const pickupDateValue = String(prefill?.pickupDate || pickupDefault);
  const returnDateValue = String(prefill?.returnDate || returnDefault);
  const pickupTimeValue = String(prefill?.pickupTime || '10:00');
  const returnTimeValue = String(prefill?.returnTime || '10:00');
  const insuranceChecked = !!prefill?.fullInsurance;
  const youngDriverChecked = loc === 'larnaca' && !!prefill?.youngDriver;

  const optionsHtml = cars.map((car) => {
    const title = window.getCarName ? window.getCarName(car) : (car.car_model || car.car_type || 'Car');
    const transmission = String(car.transmission || '').toLowerCase() === 'automatic'
      ? text('Automat', 'Automatic')
      : text('Manual', 'Manual');
    const seats = car.max_passengers || 5;
    const seatsText = text(`${seats} miejsc`, `${seats} seats`);

    return `<option value="${escapeHtml(title)}" data-offer-id="${escapeHtml(car.id)}" ${String(car.id) === String(selectedCarId) ? 'selected' : ''}>${escapeHtml(title)} — ${escapeHtml(transmission)} • ${escapeHtml(seatsText)}</option>`;
  }).join('');

  const pickupOptions = loc === 'paphos'
    ? `
      <option value="airport_pfo" data-i18n="carRentalPfo.page.reservation.fields.locations.airport">Lotnisko Paphos (PFO)</option>
      <option value="hotel" data-i18n="carRentalPfo.page.reservation.fields.locations.hotel">Hotel</option>
      <option value="city_center" data-i18n="carRentalPfo.page.reservation.fields.locations.city">Centrum miasta</option>
      <option value="other" data-i18n="carRentalPfo.page.reservation.fields.locations.other">Inne</option>
    `
    : `
      <option value="larnaca" data-i18n="carRental.locations.larnaca.label">Larnaka (bez opłaty)</option>
      <option value="nicosia" data-i18n="carRental.locations.nicosia.label">Nikozja (+15€)</option>
      <option value="ayia-napa" data-i18n="carRental.locations.ayia-napa.label">Ayia Napa (+15€)</option>
      <option value="protaras" data-i18n="carRental.locations.protaras.label">Protaras (+20€)</option>
      <option value="limassol" data-i18n="carRental.locations.limassol.label">Limassol (+20€)</option>
      <option value="paphos" data-i18n="carRental.locations.paphos.label">Pafos (+40€)</option>
      <option value="hotel" data-i18n="carRental.page.reservation.fields.pickupLocation.hotel">Hotel</option>
      <option value="city_center" data-i18n="carRental.page.reservation.fields.pickupLocation.city">Centrum miasta</option>
      <option value="other" data-i18n="carRental.page.reservation.fields.other">Inne</option>
    `;

  const youngDriverBlock = loc === 'larnaca'
    ? `
      <div class="auto-checkbox">
        <input type="checkbox" id="res_young_driver" name="young_driver" ${youngDriverChecked ? 'checked' : ''}>
        <label for="res_young_driver" data-i18n="carRental.page.reservation.fields.youngDriver.label">Młody kierowca / staż &lt; 3 lata (+10€/dzień)</label>
      </div>
    `
    : '';

  const i18nPrefix = loc === 'paphos' ? 'carRentalPfo.page.reservation' : 'carRental.page.reservation';
  const whatsappKey = loc === 'paphos' ? 'carRentalPfo.page.reservation.whatsapp' : 'carRental.page.reservation.actions.whatsapp';

  const minBanner = text(
    'Minimalny wynajem: 3 dni. Każde rozpoczęte 24h to kolejny dzień.',
    'Minimum rental: 3 days (3 nights). Each started 24h counts as an extra day.'
  );
  const couponLabel = text('Kod kuponu', 'Coupon code');
  const couponPlaceholder = text('Wpisz kod kuponu', 'Enter coupon code');
  const couponApplyLabel = text('Zastosuj', 'Apply');
  const couponClearLabel = text('Wyczyść', 'Clear');

  return `
    <div style="margin-bottom: 18px;">
      <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700;" data-i18n="${i18nPrefix}.title">Złóż rezerwację</h3>
      <p style="margin: 0 0 16px; color: #6b7280;" data-i18n="${i18nPrefix}.description">Wypełnij formularz poniżej lub napisz do nas na WhatsApp – odpowiadamy najszybciej jak to możliwe.</p>
      <div style="margin: 0 0 16px; padding: 12px 14px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe; color: #0f172a; font-weight: 700; line-height: 1.35;">
        ${escapeHtml(minBanner)}
      </div>
      <div class="auto-reservation-actions" style="margin-bottom: 16px;">
        <a class="ghost" href="https://wa.me/48534073861" target="_blank" rel="noopener" data-i18n="${whatsappKey}">Napisz na WhatsApp</a>
      </div>
    </div>

    <form id="localReservationForm" class="auto-reservation-form" novalidate style="background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 16px; color: #1e293b;" data-i18n="${i18nPrefix}.sections.contact">Dane kontaktowe</h4>
        <div style="display: grid; gap: 16px;">
          <div class="auto-field">
            <label for="res_full_name" data-i18n="${i18nPrefix}.fields.fullName.label">Imię i nazwisko *</label>
            <input type="text" id="res_full_name" name="full_name" required placeholder="Jan Kowalski" data-i18n-attrs="placeholder:${i18nPrefix}.fields.fullName.placeholder">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="auto-field">
              <label for="res_email" data-i18n="${i18nPrefix}.fields.email.label">Email *</label>
              <input type="email" id="res_email" name="email" required placeholder="jan@example.com" data-i18n-attrs="placeholder:${i18nPrefix}.fields.email.placeholder">
            </div>
            <div class="auto-field">
              <label for="res_phone" data-i18n="${i18nPrefix}.fields.phone.label">Telefon *</label>
              <input type="tel" id="res_phone" name="phone" required placeholder="+48 123 456 789" data-i18n-attrs="placeholder:${i18nPrefix}.fields.phone.placeholder">
            </div>
          </div>
          <div class="auto-field">
            <label for="res_country" data-i18n="${i18nPrefix}.fields.country.label">Kraj</label>
            <input type="text" id="res_country" name="country" placeholder="Polska" data-i18n-attrs="placeholder:${i18nPrefix}.fields.country.placeholder">
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 16px; color: #1e293b;" data-i18n="${i18nPrefix}.sections.rental">Szczegóły wynajmu</h4>
        <div style="display: grid; gap: 16px;">
          <div class="auto-field">
            <label for="res_car" data-i18n="${i18nPrefix}.fields.car.label">Wybierz auto *</label>
            <select id="res_car" name="car" required>
              <option value="" data-i18n="${i18nPrefix}.fields.car.loading">Ładowanie...</option>
              ${optionsHtml}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
            <div class="auto-field">
              <label for="res_pickup_date" data-i18n="${i18nPrefix}.fields.pickupDate.label">Data odbioru *</label>
              <input type="date" id="res_pickup_date" name="pickup_date" required value="${escapeHtml(pickupDateValue)}">
            </div>
            <div class="auto-field">
              <label for="res_pickup_time" data-i18n="${i18nPrefix}.fields.pickupTime.label">Godzina</label>
              <input type="time" id="res_pickup_time" name="pickup_time" value="${escapeHtml(pickupTimeValue)}">
            </div>
          </div>

          <div class="auto-field">
            <label for="res_pickup_location" data-i18n="${i18nPrefix}.fields.pickupLocation.label">Miejsce odbioru *</label>
            <select id="res_pickup_location" name="pickup_location" required>
              ${pickupOptions}
            </select>
          </div>

          <div class="auto-field" id="pickupAddressField" hidden>
            <label for="res_pickup_address" data-i18n="${i18nPrefix}.fields.pickupAddress.label">Adres odbioru</label>
            <input type="text" id="res_pickup_address" name="pickup_address" placeholder="Nazwa hotelu lub dokładny adres" data-i18n-attrs="placeholder:${i18nPrefix}.fields.pickupAddress.placeholder">
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
            <div class="auto-field">
              <label for="res_return_date" data-i18n="${i18nPrefix}.fields.returnDate.label">Data zwrotu *</label>
              <input type="date" id="res_return_date" name="return_date" required value="${escapeHtml(returnDateValue)}">
            </div>
            <div class="auto-field">
              <label for="res_return_time" data-i18n="${i18nPrefix}.fields.returnTime.label">Godzina</label>
              <input type="time" id="res_return_time" name="return_time" value="${escapeHtml(returnTimeValue)}">
            </div>
          </div>

          <div class="auto-field">
            <label for="res_return_location" data-i18n="${i18nPrefix}.fields.returnLocation.label">Miejsce zwrotu *</label>
            <select id="res_return_location" name="return_location" required>
              ${pickupOptions}
            </select>
          </div>

          <div class="auto-field" id="returnAddressField" hidden>
            <label for="res_return_address" data-i18n="${i18nPrefix}.fields.returnAddress.label">Adres zwrotu</label>
            <input type="text" id="res_return_address" name="return_address" placeholder="Nazwa hotelu lub dokładny adres" data-i18n-attrs="placeholder:${i18nPrefix}.fields.returnAddress.placeholder">
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 16px; color: #1e293b;" data-i18n="${i18nPrefix}.sections.options">Dodatkowe opcje</h4>
        <div style="display: grid; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="auto-field">
              <label for="res_passengers" data-i18n="${i18nPrefix}.fields.passengers.label">Liczba pasażerów</label>
              <input type="number" id="res_passengers" name="num_passengers" min="1" max="8" value="2">
            </div>
            <div class="auto-field">
              <label for="res_child_seats" data-i18n="${i18nPrefix}.fields.childSeats.label">Foteliki dziecięce (gratis)</label>
              <input type="number" id="res_child_seats" name="child_seats" min="0" max="3" value="0">
            </div>
          </div>

          <div class="auto-checkbox">
            <input type="checkbox" id="res_insurance" name="insurance" ${insuranceChecked ? 'checked' : ''}>
            <label for="res_insurance" data-i18n="${i18nPrefix}.fields.insurance.label">Pełne ubezpieczenie AC (+17€/dzień)</label>
          </div>

          ${youngDriverBlock}

          <div class="auto-field">
            <label for="res_flight" data-i18n="${i18nPrefix}.fields.flight.label">Numer lotu (opcjonalnie)</label>
            <input type="text" id="res_flight" name="flight_number" placeholder="W1234" data-i18n-attrs="placeholder:${i18nPrefix}.fields.flight.placeholder">
          </div>

          <div class="auto-field">
            <label for="res_notes" data-i18n="${i18nPrefix}.fields.notes.label">Uwagi specjalne</label>
            <textarea id="res_notes" name="special_requests" rows="3" placeholder="Dodatkowe informacje lub prośby..." data-i18n-attrs="placeholder:${i18nPrefix}.fields.notes.placeholder"></textarea>
          </div>
        </div>
      </div>

      <div class="auto-coupon-panel" aria-live="polite">
        <div class="auto-field">
          <label for="res_coupon_code" data-i18n="carRental.page.reservation.coupon.label">${escapeHtml(couponLabel)}</label>
          <div class="auto-coupon-row">
            <input type="text" id="res_coupon_code" name="coupon_code" placeholder="${escapeHtml(couponPlaceholder)}" data-i18n-attrs="placeholder:carRental.page.reservation.coupon.placeholder" autocomplete="off" spellcheck="false">
            <button type="button" class="btn btn-secondary secondary" id="btnApplyCoupon" data-i18n="carRental.page.reservation.coupon.apply">${escapeHtml(couponApplyLabel)}</button>
            <button type="button" class="btn ghost" id="btnClearCoupon" hidden data-i18n="carRental.page.reservation.coupon.clear">${escapeHtml(couponClearLabel)}</button>
          </div>
          <p id="couponStatusMessage" class="auto-coupon-status" hidden></p>
        </div>
      </div>

      <div id="estimatedPrice" style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #475569;"></div>

      <div id="reservationError" class="admin-error-message" hidden style="margin-bottom: 16px;"></div>
      <div id="reservationSuccess" hidden></div>

      <button type="submit" class="btn btn-primary primary" id="btnSubmitReservation" style="width: 100%; padding: 14px; font-size: 16px; font-weight: 600;" data-i18n="${i18nPrefix}.submit">
        Wyślij rezerwację
      </button>

      <p style="font-size: 12px; color: #64748b; margin: 12px 0 0; text-align: center;" data-i18n="${i18nPrefix}.confirmationNote">
        Otrzymasz potwierdzenie na email w ciągu 24h
      </p>
    </form>

    <div id="formSubmitConfirmation" hidden style="background: #10b981; color: white; padding: 20px; border-radius: 12px; margin-top: 24px; text-align: center; animation: slideIn 0.3s ease;">
      <h3 style="margin: 0 0 8px; font-size: 20px;">🎉 Gratulacje!</h3>
      <p style="margin: 0; font-size: 16px; opacity: 0.95;">Twój formularz został wysłany pomyślnie!</p>
    </div>
  `;
}

function buildModalPrefillForLocation(location) {
  const defaults = buildDefaultFinderState();
  const state = homeCarsFinderState || defaults;
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';

  const pickupLocation = loc === 'paphos'
    ? normalizePaphosLocation(state.pickupLocation)
    : (normalizeLocationForOffer(state.pickupLocation, 'larnaca') || 'larnaca');
  const returnLocation = loc === 'paphos'
    ? normalizePaphosLocation(state.returnLocation)
    : (normalizeLocationForOffer(state.returnLocation, 'larnaca') || 'larnaca');

  return {
    pickupDate: String(state.pickupDate || defaults.pickupDate),
    pickupTime: String(state.pickupTime || defaults.pickupTime),
    returnDate: String(state.returnDate || defaults.returnDate),
    returnTime: String(state.returnTime || defaults.returnTime),
    pickupLocation,
    returnLocation,
    fullInsurance: !!state.fullInsurance,
    youngDriver: loc === 'larnaca' && !!state.youngDriver,
  };
}

function setSelectValueIfExists(id, value) {
  const select = document.getElementById(id);
  if (!select || !value) return;
  const hasValue = Array.from(select.options || []).some((opt) => String(opt.value) === String(value));
  if (hasValue) {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function applyModalPrefill(prefill) {
  if (!prefill || typeof prefill !== 'object') return;
  setSelectValueIfExists('res_pickup_location', prefill.pickupLocation);
  setSelectValueIfExists('res_return_location', prefill.returnLocation);
}

function openCarHomeModal(carId) {
  const car = homeCarsById[String(carId || '').trim()];
  if (!car) return;

  const loc = String(car.location || '').toLowerCase() === 'paphos' ? 'paphos' : 'larnaca';
  const prefill = buildModalPrefillForLocation(loc);

  const modal = document.getElementById('carHomeModal');
  const modalBody = document.getElementById('carHomeModalBody');
  if (!modal || !modalBody) return;

  const title = window.getCarName ? window.getCarName(car) : (car.car_model || car.car_type || 'Car');
  const imageUrl = car.image_url || `https://placehold.co/900x500/1e293b/ffffff?text=${encodeURIComponent(title)}`;

  const fromLabel = text('Od', 'From');
  const perDayLabel = text('/ dzień', '/ day');
  const liveQuote = homeCarsLastQuoteByCarId[String(car.id)] || buildQuoteForCarWithFinder(car, prefill);
  const fromPrice = getFromPrice(car);
  const heroPrice = liveQuote
    ? text(`Razem ${Number(liveQuote.total).toFixed(2)}€`, `Total ${Number(liveQuote.total).toFixed(2)}€`)
    : `${fromLabel} ${Number(fromPrice).toFixed(0)}€ ${perDayLabel}`;
  const heroMeta = liveQuote
    ? text(
      `${liveQuote.days} dni • baza ${Number(liveQuote.basePrice).toFixed(2)}€ • dodatki ${Number((liveQuote.pickupFee || 0) + (liveQuote.returnFee || 0) + (liveQuote.insuranceCost || 0) + (liveQuote.youngDriverCost || 0)).toFixed(2)}€`,
      `${liveQuote.days} days • base ${Number(liveQuote.basePrice).toFixed(2)}€ • extras ${Number((liveQuote.pickupFee || 0) + (liveQuote.returnFee || 0) + (liveQuote.insuranceCost || 0) + (liveQuote.youngDriverCost || 0)).toFixed(2)}€`
    )
    : text('Wsparcie 24/7 • Brak depozytu', '24/7 support • No deposit');

  const noDepositLabel = text('Bez kaucji', 'No deposit');
  const transmission = String(car.transmission || '').toLowerCase() === 'automatic'
    ? text('Automat', 'Automatic')
    : text('Manual', 'Manual');
  const seats = car.max_passengers || 5;
  const seatsText = text(`${seats} miejsc`, `${seats} seats`);
  const fuelType = String(car.fuel_type || '').toLowerCase();
  const fuelText = fuelType === 'petrol'
    ? text('Benzyna 95', 'Petrol 95')
    : fuelType === 'diesel'
      ? text('Diesel', 'Diesel')
      : fuelType === 'hybrid'
        ? text('Hybryda', 'Hybrid')
        : fuelType === 'electric'
          ? text('Elektryczny', 'Electric')
          : (car.fuel_type || '');
  const features = window.getCarFeatures ? window.getCarFeatures(car) : (Array.isArray(car.features) ? car.features : []);
  const description = window.getCarDescription ? window.getCarDescription(car) : (car.description || '');
  const detailsTitle = text('Szczegóły auta', 'Car details');
  const labelTransmission = text('Skrzynia', 'Transmission');
  const labelSeats = text('Miejsca', 'Seats');
  const labelFuel = text('Paliwo', 'Fuel');
  const labelLocation = text('Oferta', 'Offer');
  const locLabel = loc === 'paphos' ? text('Pafos', 'Paphos') : text('Larnaka', 'Larnaca');

  const pricing = buildPricingMapForLocation(loc);
  window.CE_CAR_PRICING = pricing;

  setBodyCarLocation(loc);

  modalBody.innerHTML = `
    <div class="ce-car-home-modal">
      <div class="ce-car-home-hero">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="ce-car-home-hero-image" />
        <div class="ce-car-home-hero-overlay">
          <div class="ce-car-home-hero-badges">
            <span class="ce-car-home-pill ce-car-home-pill--light">🚗 ${escapeHtml(noDepositLabel)}</span>
            <span class="ce-car-home-pill">⚙️ ${escapeHtml(transmission)}</span>
            <span class="ce-car-home-pill">👥 ${escapeHtml(seatsText)}</span>
            ${fuelText ? `<span class="ce-car-home-pill">⛽ ${escapeHtml(fuelText)}</span>` : ''}
            <span class="ce-car-home-pill">❄️ AC</span>
          </div>
          <h2 id="carHomeModalTitle" class="ce-car-home-hero-title">${escapeHtml(title)}</h2>
          <p class="ce-car-home-hero-price">${escapeHtml(heroPrice)}</p>
          <p class="ce-car-home-hero-meta">${escapeHtml(heroMeta)}</p>
        </div>
      </div>

      <div class="ce-car-home-body">
        <div class="ce-car-home-details">
          <h3 class="ce-car-home-section-title">${escapeHtml(detailsTitle)}</h3>
          <div class="ce-car-home-specs">
            <div class="ce-car-home-spec">
              <div class="ce-car-home-spec-label">${escapeHtml(labelTransmission)}</div>
              <div class="ce-car-home-spec-value">${escapeHtml(transmission)}</div>
            </div>
            <div class="ce-car-home-spec">
              <div class="ce-car-home-spec-label">${escapeHtml(labelSeats)}</div>
              <div class="ce-car-home-spec-value">${escapeHtml(seatsText)}</div>
            </div>
            ${fuelText ? `
              <div class="ce-car-home-spec">
                <div class="ce-car-home-spec-label">${escapeHtml(labelFuel)}</div>
                <div class="ce-car-home-spec-value">${escapeHtml(fuelText)}</div>
              </div>
            ` : ''}
            <div class="ce-car-home-spec">
              <div class="ce-car-home-spec-label">${escapeHtml(labelLocation)}</div>
              <div class="ce-car-home-spec-value">${escapeHtml(locLabel)}</div>
            </div>
          </div>

          ${description ? `<p class="ce-car-home-note">${escapeHtml(description)}</p>` : ''}

          ${Array.isArray(features) && features.length
            ? `<ul class="ce-car-home-features">${features.slice(0, 6).map(f => `<li><span>✓</span>${escapeHtml(f)}</li>`).join('')}</ul>`
            : ''
          }
        </div>

        <div>
          ${buildReservationFormHtml({ location: loc, selectedCarId: car.id, prefill })}
        </div>
      </div>
    </div>
  `;

  try {
    if (window.appI18n && typeof window.appI18n.setLanguage === 'function') {
      window.appI18n.setLanguage(window.appI18n.language || 'pl', { persist: false, updateUrl: false });
    }
  } catch (_) {}

  modal.style.display = 'flex';

  try {
    initCarReservationBindings();
    applyModalPrefill(prefill);
  } catch (e) {
    console.warn('Failed to init reservation form', e);
  }
}

function closeCarHomeModal() {
  const modal = document.getElementById('carHomeModal');
  const modalBody = document.getElementById('carHomeModalBody');
  if (modal) modal.style.display = 'none';
  if (modalBody) modalBody.innerHTML = '';

  setBodyCarLocation('');

  try {
    delete window.CE_CAR_PRICING;
    delete window.CE_CAR_PRICE_QUOTE;
  } catch (_) {}

  previousBodyCarLocation = null;
}

window.openCarHomeModal = openCarHomeModal;
window.closeCarHomeModal = closeCarHomeModal;

async function loadHomeCars() {
  const grid = document.getElementById('carsHomeGrid');

  try {
    const { data, error } = await supabase
      .from('car_offers')
      .select('*')
      .eq('is_available', true)
      .in('location', ['larnaca', 'paphos'])
      .order('sort_order', { ascending: true });

    if (error) throw error;

    allHomeCars = data || [];
    homeCarsById = {};

    const byLoc = { larnaca: [], paphos: [] };
    allHomeCars.forEach((c) => {
      if (!c || !c.id) return;
      const loc = String(c.location || '').toLowerCase() === 'paphos' ? 'paphos' : 'larnaca';
      homeCarsById[String(c.id)] = c;
      byLoc[loc].push(c);
    });

    homeCarsByLocation = byLoc;

    if (!homeCarsFinderState) {
      homeCarsFinderState = buildDefaultFinderState();
    }

    renderHomeCarsFinder();
    renderHomeCarsTabs();
    syncHomeCarsFinderState({ fromUser: false });
    initHomeCarsCarousel();

  } catch (err) {
    console.error('❌ Failed to load home cars:', err);
    if (grid) {
      grid.innerHTML = `
        <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #ef4444;">
          <p>${escapeHtml(text('Błąd ładowania aut', 'Failed to load cars'))}</p>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('carHomeModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.classList.contains('modal-overlay')) {
        closeCarHomeModal();
      }
    });
  }

  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.subscribe === 'function') {
      window.CE_SAVED_CATALOG.subscribe(() => {
        if (homeCarsSavedOnly) {
          renderHomeCars();
          try {
            homeCarsCarouselUpdate?.();
          } catch (_) {}
        }
      });
    }
  } catch (_) {}

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler(() => {
      const previousState = homeCarsFinderState || buildDefaultFinderState();
      renderHomeCarsTabs();
      homeCarsFinderState = previousState;
      renderHomeCarsFinder();
      syncHomeCarsFinderState({ fromUser: false });
      try {
        homeCarsCarouselUpdate?.();
      } catch (_) {}
    });
  }

  loadHomeCars();
});
