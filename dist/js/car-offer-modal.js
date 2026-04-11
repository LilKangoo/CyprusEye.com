import { initCarReservationBindings } from '/js/car-reservation.js?v=20260205f';
import {
  buildPricingMatrixForOfferRow,
  calculateCarRentalQuote,
  normalizeLocationForOffer,
} from '/js/car-pricing.js';
import { normalizePaphosWidgetLocation } from '/js/car-rental-flow.js';

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

function getCarName(car) {
  return window.getCarName ? window.getCarName(car) : (car?.car_model || car?.car_type || 'Car');
}

function getCarDescription(car) {
  return window.getCarDescription ? window.getCarDescription(car) : (car?.description || '');
}

function getCarFeatures(car) {
  return window.getCarFeatures ? window.getCarFeatures(car) : (Array.isArray(car?.features) ? car.features : []);
}

function getCarMediaDisplayUrl(url) {
  if (window.CE_MEDIA_VIEWER?.getDisplayUrl) {
    return window.CE_MEDIA_VIEWER.getDisplayUrl(url);
  }
  return String(url || '').split('#')[0];
}

function isCarPanorama(url) {
  if (window.CE_MEDIA_VIEWER?.isPanorama) {
    return window.CE_MEDIA_VIEWER.isPanorama(url);
  }
  return false;
}

function setBodyCarLocation(next) {
  if (!document.body) return;

  if (previousBodyCarLocation === null) {
    previousBodyCarLocation = document.body.dataset.carLocation || '';
  }

  if (next) {
    document.body.dataset.carLocation = next;
  } else if (previousBodyCarLocation) {
    document.body.dataset.carLocation = previousBodyCarLocation;
  } else {
    delete document.body.dataset.carLocation;
  }
}

function buildPricingMapForLocation(location, fleet) {
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const out = {};
  const cars = Array.isArray(fleet) ? fleet : [];

  cars.forEach((car) => {
    if (!car) return;
    const carModelName = getCarName(car);
    const pricingMatrix = buildPricingMatrixForOfferRow(car, loc);
    if (pricingMatrix) {
      out[carModelName] = pricingMatrix;
    }
  });

  return out;
}

function resolveQuoteForCar({ car, location, prefill, quote }) {
  if (quote) return quote;
  if (!car || !prefill) return null;

  const pricingMatrix = buildPricingMatrixForOfferRow(car, location);
  if (!pricingMatrix) return null;

  return calculateCarRentalQuote({
    pricingMatrix,
    offer: location,
    carModel: getCarName(car),
    pickupDateStr: prefill.pickupDate,
    returnDateStr: prefill.returnDate,
    pickupTimeStr: prefill.pickupTime,
    returnTimeStr: prefill.returnTime,
    pickupLocation: prefill.pickupLocation,
    returnLocation: prefill.returnLocation,
    fullInsurance: !!prefill.fullInsurance,
    youngDriver: location === 'larnaca' && !!prefill.youngDriver,
  });
}

function setSelectValueIfExists(id, value) {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement) || !value) return;
  const hasValue = Array.from(select.options || []).some((opt) => String(opt.value) === String(value));
  if (!hasValue) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyModalPrefill(prefill) {
  if (!prefill || typeof prefill !== 'object') return;
  setSelectValueIfExists('res_pickup_location', prefill.pickupLocation);
  setSelectValueIfExists('res_return_location', prefill.returnLocation);
}

function normalizeOptionalLocation(location, offerLocation) {
  const rawValue = String(location || '').trim();
  if (!rawValue) return '';

  return offerLocation === 'paphos'
    ? normalizePaphosWidgetLocation(rawValue)
    : (normalizeLocationForOffer(rawValue, 'larnaca') || '');
}

function readModalFinderPrefill() {
  const carSelect = document.getElementById('res_car');
  const selectedOption = carSelect instanceof HTMLSelectElement
    ? (carSelect.selectedOptions?.[0] || null)
    : null;

  return {
    pickupDate: String(document.getElementById('res_pickup_date')?.value || '').trim(),
    pickupTime: String(document.getElementById('res_pickup_time')?.value || '10:00').trim() || '10:00',
    returnDate: String(document.getElementById('res_return_date')?.value || '').trim(),
    returnTime: String(document.getElementById('res_return_time')?.value || '10:00').trim() || '10:00',
    pickupLocation: String(document.getElementById('res_pickup_location')?.value || '').trim(),
    returnLocation: String(document.getElementById('res_return_location')?.value || '').trim(),
    fullInsurance: !!document.getElementById('res_insurance')?.checked,
    youngDriver: !!document.getElementById('res_young_driver')?.checked,
    passengers: Math.max(1, Number(document.getElementById('res_passengers')?.value || 2)),
    carModel: String(carSelect?.value || '').trim(),
    offerId: String(selectedOption?.dataset?.offerId || '').trim(),
  };
}

function buildReservationFormHtml({ location, fleetByLocation, selectedCarId, prefill = null }) {
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const cars = Array.isArray(fleetByLocation?.[loc]) ? fleetByLocation[loc] : [];

  const pickupDateValue = String(prefill?.pickupDate || '');
  const returnDateValue = String(prefill?.returnDate || '');
  const pickupTimeValue = String(prefill?.pickupTime || '10:00');
  const returnTimeValue = String(prefill?.returnTime || '10:00');
  const insuranceChecked = !!prefill?.fullInsurance;
  const youngDriverChecked = loc === 'larnaca' && !!prefill?.youngDriver;
  const passengersValue = Math.max(1, Number(prefill?.passengers || 2));

  const optionsHtml = cars.map((car) => {
    const title = getCarName(car);
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
  const locationPlaceholder = text('Wybierz lokalizację', 'Choose location');

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
              <option value="">${escapeHtml(locationPlaceholder)}</option>
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
              <option value="">${escapeHtml(locationPlaceholder)}</option>
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
              <input type="number" id="res_passengers" name="num_passengers" min="1" max="8" value="${escapeHtml(String(passengersValue))}">
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

function ensureCarOfferModalMarkup() {
  let modal = document.getElementById('carHomeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'carHomeModal';
    modal.className = 'recommendation-modal';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'carHomeModalTitle');
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="modal-close" type="button" aria-label="Zamknij">✕</button>
        <div id="carHomeModalBody" class="modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  if (modal.dataset.ceCarOfferModalBound !== '1') {
    modal.dataset.ceCarOfferModalBound = '1';

    modal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.classList.contains('modal-overlay') || target.classList.contains('modal-close')) {
        closeCarOfferModal();
      }
    });
  }

  return modal;
}

export function closeCarOfferModal() {
  const modal = ensureCarOfferModalMarkup();
  const modalBody = document.getElementById('carHomeModalBody');
  const modalPrefill = readModalFinderPrefill();
  modal.style.display = 'none';
  if (modalBody) modalBody.innerHTML = '';

  setBodyCarLocation('');

  try {
    delete window.CE_CAR_PRICING;
    delete window.CE_CAR_PRICE_QUOTE;
  } catch (_) {}

  try {
    window.dispatchEvent(new CustomEvent('ce:car-modal-closed', {
      detail: modalPrefill,
    }));
  } catch (_) {
    // no-op
  }

  previousBodyCarLocation = null;
}

export function openCarOfferModal({
  car,
  location,
  fleetByLocation,
  prefill = null,
  quote = null,
} = {}) {
  if (!car) return;

  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const modal = ensureCarOfferModalMarkup();
  const modalBody = document.getElementById('carHomeModalBody');
  if (!modalBody) return;

  const title = getCarName(car);
  const imageUrlRaw = car.image_url || `https://placehold.co/900x500/1e293b/ffffff?text=${encodeURIComponent(title)}`;
  const imageUrl = getCarMediaDisplayUrl(imageUrlRaw);

  const liveQuote = resolveQuoteForCar({ car, location: loc, prefill, quote });
  const fromPrice = Number(car.price_10plus_days || car.price_per_day || 30);
  const heroPrice = liveQuote
    ? text(`Razem ${Number(liveQuote.total).toFixed(2)}€`, `Total ${Number(liveQuote.total).toFixed(2)}€`)
    : text(`Od ${Number(fromPrice).toFixed(0)}€ / dzień`, `From ${Number(fromPrice).toFixed(0)}€ / day`);
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
  const features = getCarFeatures(car);
  const description = getCarDescription(car);
  const detailsTitle = text('Szczegóły auta', 'Car details');
  const labelTransmission = text('Skrzynia', 'Transmission');
  const labelSeats = text('Miejsca', 'Seats');
  const labelFuel = text('Paliwo', 'Fuel');
  const labelLocation = text('Oferta', 'Offer');
  const locLabel = loc === 'paphos' ? text('Pafos', 'Paphos') : text('Larnaka', 'Larnaca');

  const pricingSource = Array.isArray(fleetByLocation?.[loc]) ? fleetByLocation[loc] : [car];
  window.CE_CAR_PRICING = buildPricingMapForLocation(loc, pricingSource);
  setBodyCarLocation(loc);

  const normalizedPrefill = {
    ...(prefill || {}),
    pickupLocation: normalizeOptionalLocation(prefill?.pickupLocation, loc),
    returnLocation: normalizeOptionalLocation(prefill?.returnLocation, loc),
  };

  modalBody.innerHTML = `
    <div class="ce-car-home-modal">
      <div class="ce-car-home-hero">
        ${isCarPanorama(imageUrlRaw) ? '<span class="ce-media-badge ce-media-badge--auto-card">360°</span>' : ''}
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
            ? `<ul class="ce-car-home-features">${features.slice(0, 6).map((feature) => `<li><span>✓</span>${escapeHtml(feature)}</li>`).join('')}</ul>`
            : ''
          }
        </div>

        <div>
          ${buildReservationFormHtml({
            location: loc,
            fleetByLocation,
            selectedCarId: car.id,
            prefill: normalizedPrefill,
          })}
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
    applyModalPrefill(normalizedPrefill);
  } catch (error) {
    console.warn('Failed to init reservation form', error);
  }
}

window.closeCarHomeModal = closeCarOfferModal;
window.CE_OPEN_CAR_OFFER_MODAL = openCarOfferModal;
