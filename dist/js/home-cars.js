import { supabase } from '/js/supabaseClient.js';
import { initCarReservationBindings } from '/js/car-reservation.js?v=20260205f';

let allHomeCars = [];
let homeCarsById = {};
let homeCarsByLocation = { larnaca: [], paphos: [] };
let homeCarsCurrentLocation = 'larnaca';

let homeCarsCarouselUpdate = null;
let previousBodyCarLocation = null;

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

function renderHomeCarsTabs() {
  const tabsWrap = document.getElementById('carsHomeTabs');
  if (!tabsWrap) return;

  tabsWrap.innerHTML = [
    `<button class="recommendations-home-tab ${homeCarsCurrentLocation === 'larnaca' ? 'active' : ''}" type="button" data-location="larnaca">${escapeHtml(text('Larnaka', 'Larnaca'))}</button>`,
    `<button class="recommendations-home-tab ${homeCarsCurrentLocation === 'paphos' ? 'active' : ''}" type="button" data-location="paphos">${escapeHtml(text('Pafos', 'Paphos'))}</button>`,
  ].join('');

  tabsWrap.querySelectorAll('button[data-location]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const loc = String(btn.getAttribute('data-location') || '').trim();
      if (!loc) return;
      homeCarsCurrentLocation = loc === 'paphos' ? 'paphos' : 'larnaca';
      renderHomeCarsTabs();
      renderHomeCars();
      try {
        homeCarsCarouselUpdate?.();
      } catch (_) {}
    });
  });
}

function renderHomeCars() {
  const grid = document.getElementById('carsHomeGrid');
  if (!grid) return;

  const list = homeCarsByLocation[homeCarsCurrentLocation] || [];

  if (!list.length) {
    grid.innerHTML = `
      <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #9ca3af;">
        <p>${escapeHtml(text('Brak dostępnych aut w tej chwili', 'No cars available right now'))}</p>
      </div>
    `;
    return;
  }

  const fromLabel = text('Od', 'From');
  const perDayLabel = text('/ dzień', '/ day');
  const noDepositLabel = text('Bez kaucji', 'No deposit');

  grid.innerHTML = list.map((car) => {
    const title = window.getCarName ? window.getCarName(car) : (car.car_model || car.car_type || 'Car');
    const transmission = String(car.transmission || '').toLowerCase() === 'automatic'
      ? text('Automat', 'Automatic')
      : text('Manual', 'Manual');
    const seats = car.max_passengers || 5;
    const seatsText = text(`${seats} miejsc`, `${seats} seats`);
    const fromPrice = getFromPrice(car);

    const imageUrl = car.image_url || `https://placehold.co/400x250/1e293b/ffffff?text=${encodeURIComponent(title)}`;

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
          <p class="ce-home-card-subtitle">${escapeHtml(`${fromLabel} ${Number(fromPrice).toFixed(0)}€ ${perDayLabel}`)} • ${escapeHtml(transmission)} • ${escapeHtml(seatsText)}</p>
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

function buildReservationFormHtml({ location, selectedCarId }) {
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const cars = homeCarsByLocation[loc] || [];

  const today = new Date();
  const pickupDefault = today.toISOString().split('T')[0];
  const returnDefaultDate = new Date(today.getTime());
  returnDefaultDate.setDate(returnDefaultDate.getDate() + 3);
  const returnDefault = returnDefaultDate.toISOString().split('T')[0];

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
        <input type="checkbox" id="res_young_driver" name="young_driver">
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
              <input type="date" id="res_pickup_date" name="pickup_date" required value="${escapeHtml(pickupDefault)}">
            </div>
            <div class="auto-field">
              <label for="res_pickup_time" data-i18n="${i18nPrefix}.fields.pickupTime.label">Godzina</label>
              <input type="time" id="res_pickup_time" name="pickup_time" value="10:00">
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
              <input type="date" id="res_return_date" name="return_date" required value="${escapeHtml(returnDefault)}">
            </div>
            <div class="auto-field">
              <label for="res_return_time" data-i18n="${i18nPrefix}.fields.returnTime.label">Godzina</label>
              <input type="time" id="res_return_time" name="return_time" value="10:00">
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
            <input type="checkbox" id="res_insurance" name="insurance">
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

function openCarHomeModal(carId) {
  const car = homeCarsById[String(carId || '').trim()];
  if (!car) return;

  const loc = String(car.location || '').toLowerCase() === 'paphos' ? 'paphos' : 'larnaca';

  const modal = document.getElementById('carHomeModal');
  const modalBody = document.getElementById('carHomeModalBody');
  if (!modal || !modalBody) return;

  const title = window.getCarName ? window.getCarName(car) : (car.car_model || car.car_type || 'Car');
  const imageUrl = car.image_url || `https://placehold.co/900x500/1e293b/ffffff?text=${encodeURIComponent(title)}`;

  const fromLabel = text('Od', 'From');
  const perDayLabel = text('/ dzień', '/ day');
  const fromPrice = getFromPrice(car);

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
          <p class="ce-car-home-hero-price">${escapeHtml(`${fromLabel} ${Number(fromPrice).toFixed(0)}€ ${perDayLabel}`)}</p>
          <p class="ce-car-home-hero-meta">${escapeHtml(text('Wsparcie 24/7 • Brak depozytu', '24/7 support • No deposit'))}</p>
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
          ${buildReservationFormHtml({ location: loc, selectedCarId: car.id })}
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

    renderHomeCarsTabs();
    renderHomeCars();
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

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler(() => {
      renderHomeCarsTabs();
      renderHomeCars();
      try {
        homeCarsCarouselUpdate?.();
      } catch (_) {}
    });
  }

  loadHomeCars();
});
