import { initCarReservationBindings } from '/js/car-reservation.js?v=20260630_city_place';
import {
  buildPricingMatrixForOfferRow,
  calculateCarRentalQuote,
  resolveCarYoungDriverConfig,
} from '/js/car-pricing.js';
import {
  coerceCarPlaceTypeForCity,
  inferCarCityFromLegacyLocation,
  inferCarPlaceTypeFromLegacyLocation,
  mapCityToLegacyLocationForPricing,
  normalizeCarCity,
} from '/js/car-rental-flow.js';
import {
  buildCarPlaceTypeOptionsHtml,
  getCarCityLabel,
} from '/js/car-location-options.js';

let previousBodyCarLocation = null;
let previousCarPricingContext = null;

function getLang() {
  const lang = (window.appI18n?.language || document.documentElement?.lang || 'pl').toLowerCase();
  const short = lang.split('-')[0];
  if (short === 'pl' || short === 'en' || short === 'he') return short;
  return 'en';
}

function text(pl, en, he = '') {
  const lang = getLang();
  if (lang === 'pl') return pl || en || he || '';
  if (lang === 'he') return he || en || pl || '';
  return en || pl || he || '';
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

function getDefaultPhoneCountryCode() {
  const lang = getLang();
  if (lang === 'pl') return '+48';
  if (lang === 'he') return '+972';
  return '+357';
}

function buildPhoneCountryCodeOptionsHtml(selectedValue = getDefaultPhoneCountryCode()) {
  const selected = String(selectedValue || '').trim() || getDefaultPhoneCountryCode();
  const options = [
    { value: '+48', label: '🇵🇱 +48' },
    { value: '+357', label: '🇨🇾 +357' },
    { value: '+44', label: '🇬🇧 +44' },
    { value: '+972', label: '🇮🇱 +972' },
  ];
  return options.map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>
  `).join('');
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

function captureCarPricingContext() {
  if (previousCarPricingContext) return;
  previousCarPricingContext = {
    hasPricing: Object.prototype.hasOwnProperty.call(window, 'CE_CAR_PRICING'),
    pricing: window.CE_CAR_PRICING,
    hasQuote: Object.prototype.hasOwnProperty.call(window, 'CE_CAR_PRICE_QUOTE'),
    quote: window.CE_CAR_PRICE_QUOTE,
    hasFinder: Object.prototype.hasOwnProperty.call(window, 'CE_CAR_FIND_CURRENT_FLEET_CAR'),
    finder: window.CE_CAR_FIND_CURRENT_FLEET_CAR,
  };
}

function restoreCarPricingContext() {
  const context = previousCarPricingContext;
  previousCarPricingContext = null;
  if (!context) {
    delete window.CE_CAR_PRICING;
    delete window.CE_CAR_PRICE_QUOTE;
    delete window.CE_CAR_FIND_CURRENT_FLEET_CAR;
    return;
  }

  if (context.hasPricing) window.CE_CAR_PRICING = context.pricing;
  else delete window.CE_CAR_PRICING;

  if (context.hasQuote) window.CE_CAR_PRICE_QUOTE = context.quote;
  else delete window.CE_CAR_PRICE_QUOTE;

  if (context.hasFinder) window.CE_CAR_FIND_CURRENT_FLEET_CAR = context.finder;
  else delete window.CE_CAR_FIND_CURRENT_FLEET_CAR;
}

function installCarOfferLookup(fleet) {
  const cars = Array.isArray(fleet) ? fleet.filter(Boolean) : [];
  window.CE_CAR_FIND_CURRENT_FLEET_CAR = ({ offerId, carModel } = {}) => {
    const normalizedOfferId = String(offerId || '').trim();
    if (normalizedOfferId) {
      const byId = cars.find((item) => String(item?.id || '') === normalizedOfferId);
      if (byId) return byId;
    }

    const normalizedModel = String(carModel || '').trim().toLowerCase();
    if (!normalizedModel) return null;
    return cars.find((item) => getCarName(item).trim().toLowerCase() === normalizedModel) || null;
  };
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
    offerRow: car,
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

function setInputValueIfExists(id, value) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement) || value == null) return;
  input.value = String(value || '');
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyModalPrefill(prefill) {
  if (!prefill || typeof prefill !== 'object') return;
  if (prefill.pickupCity) {
    setInputValueIfExists('res_pickup_city', prefill.pickupCity);
  }
  if (prefill.returnCity) {
    setInputValueIfExists('res_return_city', prefill.returnCity);
  }
  if (prefill.pickupLocation) {
    setInputValueIfExists('res_pickup_location', prefill.pickupLocation);
  }
  if (prefill.returnLocation) {
    setInputValueIfExists('res_return_location', prefill.returnLocation);
  }
  if (prefill.pickupPlaceType) {
    setSelectValueIfExists('res_pickup_place_type', prefill.pickupPlaceType);
  }
  if (prefill.returnPlaceType) {
    setSelectValueIfExists('res_return_place_type', prefill.returnPlaceType);
  }
  if (typeof window.CE_CAR_RESERVATION_SYNC_PLACE_DETAILS === 'function') {
    window.CE_CAR_RESERVATION_SYNC_PLACE_DETAILS();
  }
}

function bindModalLocationSync() {
  const pickupPlaceType = document.getElementById('res_pickup_place_type');
  const returnPlaceType = document.getElementById('res_return_place_type');
  const youngDriver = document.getElementById('res_young_driver');

  [pickupPlaceType, returnPlaceType].forEach((select) => {
    if (!(select instanceof HTMLSelectElement) || select.dataset.ceLocationSyncBound === '1') return;
    select.dataset.ceLocationSyncBound = '1';
    select.addEventListener('change', () => {
      if (typeof window.CE_CAR_RESERVATION_SYNC_PLACE_DETAILS === 'function') {
        window.CE_CAR_RESERVATION_SYNC_PLACE_DETAILS();
      }
    });
  });

  if (youngDriver instanceof HTMLInputElement && youngDriver.dataset.ceLocationSyncBound !== '1') {
    youngDriver.dataset.ceLocationSyncBound = '1';
    youngDriver.addEventListener('change', () => {
      if (typeof window.CE_CAR_RESERVATION_SYNC_PLACE_DETAILS === 'function') {
        window.CE_CAR_RESERVATION_SYNC_PLACE_DETAILS();
      }
    });
  }
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
    pickupCity: String(document.getElementById('res_pickup_city')?.value || '').trim(),
    returnCity: String(document.getElementById('res_return_city')?.value || '').trim(),
    pickupPlaceType: String(document.getElementById('res_pickup_place_type')?.value || '').trim(),
    returnPlaceType: String(document.getElementById('res_return_place_type')?.value || '').trim(),
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
  const selectedCar = cars.find((car) => String(car?.id || '') === String(selectedCarId || '')) || cars[0] || null;

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
      ? text('Automat', 'Automatic', 'אוטומטי')
      : text('Manual', 'Manual', 'ידני');
    const seats = car.max_passengers || 5;
    const seatsText = text(`${seats} miejsc`, `${seats} seats`, `${seats} מושבים`);

    return `<option value="${escapeHtml(title)}" data-offer-id="${escapeHtml(car.id)}" ${String(car.id) === String(selectedCarId) ? 'selected' : ''}>${escapeHtml(title)} — ${escapeHtml(transmission)} • ${escapeHtml(seatsText)}</option>`;
  }).join('');

  const youngDriverConfig = resolveCarYoungDriverConfig({
    offerLocation: loc,
    offerRow: selectedCar,
  });
  const youngDriverLabel = youngDriverConfig.allowed
    ? (youngDriverConfig.dailyCost > 0
      ? text(
        `Młody kierowca / staż < 3 lata (+${youngDriverConfig.dailyCost}€/dzień)`,
        `Young driver / license < 3 years (+${youngDriverConfig.dailyCost}€/day)`,
        `נהג צעיר / רישיון פחות מ-3 שנים (+${youngDriverConfig.dailyCost}€ ליום)`
      )
      : text(
        'Młody kierowca / staż < 3 lata (dostępny dla tego auta)',
        'Young driver / license < 3 years (available for this car)',
        'נהג צעיר / רישיון פחות מ-3 שנים (זמין לרכב זה)'
      ))
    : text(
      'Młody kierowca niedostępny dla tego auta',
      'Young driver is not available for this car',
      'נהג צעיר אינו זמין לרכב זה'
    );

  const youngDriverBlock = loc === 'larnaca'
    ? `
      <div class="auto-checkbox">
        <input type="checkbox" id="res_young_driver" name="young_driver" ${youngDriverChecked && youngDriverConfig.allowed ? 'checked' : ''} ${youngDriverConfig.allowed ? '' : 'disabled'}>
        <label for="res_young_driver">${escapeHtml(youngDriverLabel)}</label>
      </div>
    `
    : '';

  const i18nPrefix = loc === 'paphos' ? 'carRentalPfo.page.reservation' : 'carRental.page.reservation';
  const whatsappKey = loc === 'paphos' ? 'carRentalPfo.page.reservation.whatsapp' : 'carRental.page.reservation.actions.whatsapp';

  const minBanner = text(
    'Minimalny wynajem: 3 dni. Każde rozpoczęte 24h to kolejny dzień.',
    'Minimum rental: 3 days (3 nights). Each started 24h counts as an extra day.',
    'השכרה מינימלית: 3 ימים. כל 24 שעות שהתחילו נחשבות כיום נוסף.'
  );
  const couponLabel = text('Kod kuponu', 'Coupon code', 'קוד קופון');
  const couponPlaceholder = text('Wpisz kod kuponu', 'Enter coupon code', 'הזינו קוד קופון');
  const couponApplyLabel = text('Zastosuj', 'Apply', 'החל');
  const couponClearLabel = text('Wyczyść', 'Clear', 'נקה');
  const pickupCity = normalizeCarCity(
    prefill?.pickupCity || inferCarCityFromLegacyLocation(prefill?.pickupLocation, loc === 'paphos' ? 'paphos' : 'larnaca'),
    loc === 'paphos' ? 'paphos' : 'larnaca'
  );
  const returnCity = normalizeCarCity(
    prefill?.returnCity || inferCarCityFromLegacyLocation(prefill?.returnLocation, pickupCity || 'larnaca'),
    pickupCity || 'larnaca'
  );
  const pickupPlaceType = coerceCarPlaceTypeForCity(
    pickupCity,
    prefill?.pickupPlaceType || inferCarPlaceTypeFromLegacyLocation(prefill?.pickupLocation),
    'hotel'
  );
  const returnPlaceType = coerceCarPlaceTypeForCity(
    returnCity,
    prefill?.returnPlaceType || inferCarPlaceTypeFromLegacyLocation(prefill?.returnLocation),
    'hotel'
  );
  const selectedPickupLocation = mapCityToLegacyLocationForPricing(pickupCity, loc, pickupPlaceType);
  const selectedReturnLocation = mapCityToLegacyLocationForPricing(returnCity, loc, returnPlaceType);
  const pickupPlaceOptionsHtml = buildCarPlaceTypeOptionsHtml(pickupCity, {
    selectedValue: pickupPlaceType,
  });
  const returnPlaceOptionsHtml = buildCarPlaceTypeOptionsHtml(returnCity, {
    selectedValue: returnPlaceType,
  });
  const pickupCityLabel = getCarCityLabel(pickupCity);
  const returnCityLabel = getCarCityLabel(returnCity);
  const pickupPlaceLabel = text('Typ odbioru *', 'Pickup type *', 'סוג איסוף *');
  const returnPlaceLabel = text('Typ zwrotu *', 'Return type *', 'סוג החזרה *');
  const pickupCityCopy = text('Miasto odbioru', 'Pickup city', 'עיר איסוף');
  const returnCityCopy = text('Miasto zwrotu', 'Return city', 'עיר החזרה');
  const pickupFlightLabel = text('Numer lotu odbioru *', 'Pickup flight number *', 'מספר טיסת איסוף *');
  const returnFlightLabel = text('Numer lotu zwrotu *', 'Return flight number *', 'מספר טיסת החזרה *');
  const flightPlaceholder = text('np. W1234', 'e.g. W1234', 'לדוגמה W1234');
  const phoneCodeLabel = text('Wybierz kierunkowy *', 'Choose country code *', 'בחרו קידומת מדינה *');
  const phoneNumberLabel = text('Numer telefonu *', 'Phone number *', 'מספר טלפון *');
  const phonePlaceholder = text('123456789', '123456789', '501234567');
  const phoneCodeOptionsHtml = buildPhoneCountryCodeOptionsHtml();

  return `
    <div class="auto-reservation-intro">
      <h3 class="auto-reservation-title" data-i18n="${i18nPrefix}.title">Złóż rezerwację</h3>
      <p class="auto-reservation-description" data-i18n="${i18nPrefix}.description">Wypełnij formularz poniżej lub napisz do nas na WhatsApp – odpowiadamy najszybciej jak to możliwe.</p>
      <div class="auto-reservation-banner">
        ${escapeHtml(minBanner)}
      </div>
      <div class="auto-reservation-actions">
        <a class="ghost" href="https://wa.me/48534073861" target="_blank" rel="noopener" data-i18n="${whatsappKey}">Napisz na WhatsApp</a>
      </div>
    </div>

    <form id="localReservationForm" class="auto-reservation-form" novalidate>
      <section class="auto-form-section">
        <div class="auto-form-section__header">
          <h4 class="auto-form-section__title" data-i18n="${i18nPrefix}.sections.contact">Dane kontaktowe</h4>
        </div>
        <div class="auto-form-grid">
          <div class="auto-field">
            <label for="res_full_name" data-i18n="${i18nPrefix}.fields.fullName.label">Imię i nazwisko *</label>
            <input type="text" id="res_full_name" name="full_name" required placeholder="Jan Kowalski" data-i18n-attrs="placeholder:${i18nPrefix}.fields.fullName.placeholder">
          </div>
          <div class="auto-form-columns">
            <div class="auto-field">
              <label for="res_email" data-i18n="${i18nPrefix}.fields.email.label">Email *</label>
              <input type="email" id="res_email" name="email" required placeholder="jan@example.com" data-i18n-attrs="placeholder:${i18nPrefix}.fields.email.placeholder">
            </div>
            <div class="auto-field">
              <label for="res_phone_country_code">${escapeHtml(phoneCodeLabel)}</label>
              <select id="res_phone_country_code" required>
                ${phoneCodeOptionsHtml}
              </select>
            </div>
            <div class="auto-field">
              <label for="res_phone_local">${escapeHtml(phoneNumberLabel)}</label>
              <input type="tel" id="res_phone_local" required inputmode="tel" autocomplete="tel-national" placeholder="${escapeHtml(phonePlaceholder)}">
              <input type="hidden" id="res_phone" name="phone" value="">
            </div>
          </div>
          <div class="auto-field">
            <label for="res_country" data-i18n="${i18nPrefix}.fields.country.label">Kraj</label>
            <input type="text" id="res_country" name="country" placeholder="Polska" data-i18n-attrs="placeholder:${i18nPrefix}.fields.country.placeholder">
          </div>
        </div>
      </section>

      <section class="auto-form-section">
        <div class="auto-form-section__header">
          <h4 class="auto-form-section__title" data-i18n="${i18nPrefix}.sections.rental">Szczegóły wynajmu</h4>
        </div>
        <div class="auto-form-grid">
          <div class="auto-field">
            <label for="res_car" data-i18n="${i18nPrefix}.fields.car.label">Wybierz auto *</label>
            <select id="res_car" name="car" required>
              <option value="" data-i18n="${i18nPrefix}.fields.car.loading">Ładowanie...</option>
              ${optionsHtml}
            </select>
          </div>

          <div class="auto-form-date-row">
            <div class="auto-field">
              <label for="res_pickup_date" data-i18n="${i18nPrefix}.fields.pickupDate.label">Data odbioru *</label>
              <input type="date" id="res_pickup_date" name="pickup_date" required value="${escapeHtml(pickupDateValue)}">
            </div>
            <div class="auto-field">
              <label for="res_pickup_time" data-i18n="${i18nPrefix}.fields.pickupTime.label">Godzina</label>
              <input type="time" id="res_pickup_time" name="pickup_time" value="${escapeHtml(pickupTimeValue)}">
            </div>
          </div>

          <div class="auto-form-columns">
            <div class="auto-field">
              <label>${escapeHtml(pickupCityCopy)}</label>
              <div class="auto-readonly-value" id="res_pickup_city_label">${escapeHtml(pickupCityLabel)}</div>
              <input type="hidden" id="res_pickup_city" value="${escapeHtml(pickupCity)}">
              <input type="hidden" id="res_pickup_location" name="pickup_location" required value="${escapeHtml(selectedPickupLocation)}">
            </div>
            <div class="auto-field">
              <label for="res_pickup_place_type">${escapeHtml(pickupPlaceLabel)}</label>
              <select id="res_pickup_place_type" data-city="${escapeHtml(pickupCity)}" required>
                ${pickupPlaceOptionsHtml}
              </select>
            </div>
          </div>

          <div class="auto-field" id="pickupAddressField" hidden>
            <label for="res_pickup_address" data-i18n="${i18nPrefix}.fields.pickupAddress.label">Adres odbioru</label>
            <input type="text" id="res_pickup_address" name="pickup_address" placeholder="Nazwa hotelu lub dokładny adres" data-i18n-attrs="placeholder:${i18nPrefix}.fields.pickupAddress.placeholder">
          </div>

          <div class="auto-field" id="pickupFlightField" hidden>
            <label for="res_pickup_flight">${escapeHtml(pickupFlightLabel)}</label>
            <input type="text" id="res_pickup_flight" placeholder="${escapeHtml(flightPlaceholder)}" autocomplete="off">
          </div>

          <div class="auto-form-date-row">
            <div class="auto-field">
              <label for="res_return_date" data-i18n="${i18nPrefix}.fields.returnDate.label">Data zwrotu *</label>
              <input type="date" id="res_return_date" name="return_date" required value="${escapeHtml(returnDateValue)}">
            </div>
            <div class="auto-field">
              <label for="res_return_time" data-i18n="${i18nPrefix}.fields.returnTime.label">Godzina</label>
              <input type="time" id="res_return_time" name="return_time" value="${escapeHtml(returnTimeValue)}">
            </div>
          </div>

          <div class="auto-form-columns">
            <div class="auto-field">
              <label>${escapeHtml(returnCityCopy)}</label>
              <div class="auto-readonly-value" id="res_return_city_label">${escapeHtml(returnCityLabel)}</div>
              <input type="hidden" id="res_return_city" value="${escapeHtml(returnCity)}">
              <input type="hidden" id="res_return_location" name="return_location" required value="${escapeHtml(selectedReturnLocation)}">
            </div>
            <div class="auto-field">
              <label for="res_return_place_type">${escapeHtml(returnPlaceLabel)}</label>
              <select id="res_return_place_type" data-city="${escapeHtml(returnCity)}" required>
                ${returnPlaceOptionsHtml}
              </select>
            </div>
          </div>

          <div class="auto-field" id="returnAddressField" hidden>
            <label for="res_return_address" data-i18n="${i18nPrefix}.fields.returnAddress.label">Adres zwrotu</label>
            <input type="text" id="res_return_address" name="return_address" placeholder="Nazwa hotelu lub dokładny adres" data-i18n-attrs="placeholder:${i18nPrefix}.fields.returnAddress.placeholder">
          </div>

          <div class="auto-field" id="returnFlightField" hidden>
            <label for="res_return_flight">${escapeHtml(returnFlightLabel)}</label>
            <input type="text" id="res_return_flight" placeholder="${escapeHtml(flightPlaceholder)}" autocomplete="off">
          </div>
        </div>
      </section>

      <section class="auto-form-section">
        <div class="auto-form-section__header">
          <h4 class="auto-form-section__title" data-i18n="${i18nPrefix}.sections.options">Dodatkowe opcje</h4>
        </div>
        <div class="auto-form-grid">
          <div class="auto-form-columns">
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

          <input type="hidden" id="res_flight" name="flight_number" value="">

          <div class="auto-field">
            <label for="res_notes" data-i18n="${i18nPrefix}.fields.notes.label">Uwagi specjalne</label>
            <textarea id="res_notes" name="special_requests" rows="3" placeholder="Dodatkowe informacje lub prośby..." data-i18n-attrs="placeholder:${i18nPrefix}.fields.notes.placeholder"></textarea>
          </div>
        </div>
      </section>

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

      <div id="estimatedPrice" class="auto-estimated-price"></div>

      <div id="reservationError" class="admin-error-message" hidden></div>
      <div id="reservationSuccess" hidden></div>

      <button type="submit" class="btn btn-primary primary auto-submit-btn" id="btnSubmitReservation" data-i18n="${i18nPrefix}.submit">
        Wyślij rezerwację
      </button>

      <p class="auto-reservation-note" data-i18n="${i18nPrefix}.confirmationNote">
        Otrzymasz potwierdzenie na email w ciągu 24h. Sprawdź też folder Spam.
      </p>
    </form>

    <div id="formSubmitConfirmation" class="auto-success-card" hidden>
      <h3 data-i18n="${i18nPrefix}.successTitle">🎉 Gratulacje!</h3>
      <p data-i18n="${i18nPrefix}.successMessage">Twój formularz został wysłany pomyślnie. Sprawdź email i folder Spam w ciągu 24h!</p>
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
    restoreCarPricingContext();
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
  const normalizedPickupCity = normalizeCarCity(
    prefill?.pickupCity || inferCarCityFromLegacyLocation(prefill?.pickupLocation, loc === 'paphos' ? 'paphos' : 'larnaca'),
    loc === 'paphos' ? 'paphos' : 'larnaca'
  );
  const normalizedReturnCity = normalizeCarCity(
    prefill?.returnCity || inferCarCityFromLegacyLocation(prefill?.returnLocation, normalizedPickupCity || 'larnaca'),
    normalizedPickupCity || 'larnaca'
  );
  const normalizedPickupPlaceType = coerceCarPlaceTypeForCity(
    normalizedPickupCity,
    prefill?.pickupPlaceType || inferCarPlaceTypeFromLegacyLocation(prefill?.pickupLocation),
    'hotel'
  );
  const normalizedReturnPlaceType = coerceCarPlaceTypeForCity(
    normalizedReturnCity,
    prefill?.returnPlaceType || inferCarPlaceTypeFromLegacyLocation(prefill?.returnLocation),
    'hotel'
  );
  const normalizedPrefill = {
    ...(prefill || {}),
    pickupCity: normalizedPickupCity,
    returnCity: normalizedReturnCity,
    pickupPlaceType: normalizedPickupPlaceType,
    returnPlaceType: normalizedReturnPlaceType,
    pickupLocation: mapCityToLegacyLocationForPricing(normalizedPickupCity, loc, normalizedPickupPlaceType),
    returnLocation: mapCityToLegacyLocationForPricing(normalizedReturnCity, loc, normalizedReturnPlaceType),
  };

  const liveQuote = resolveQuoteForCar({ car, location: loc, prefill: normalizedPrefill, quote });
  const fromPrice = Number(car.price_10plus_days || car.price_per_day || 30);
  const heroPrice = liveQuote
    ? text(
      `Razem ${Number(liveQuote.total).toFixed(2)}€`,
      `Total ${Number(liveQuote.total).toFixed(2)}€`,
      `סה״כ ${Number(liveQuote.total).toFixed(2)}€`
    )
    : text(
      `Od ${Number(fromPrice).toFixed(0)}€ / dzień`,
      `From ${Number(fromPrice).toFixed(0)}€ / day`,
      `מ-${Number(fromPrice).toFixed(0)}€ / יום`
    );
  const heroMeta = liveQuote
    ? text(
      `${liveQuote.days} dni • baza ${Number(liveQuote.basePrice).toFixed(2)}€ • dodatki ${Number((liveQuote.pickupFee || 0) + (liveQuote.returnFee || 0) + (liveQuote.insuranceCost || 0) + (liveQuote.youngDriverCost || 0)).toFixed(2)}€`,
      `${liveQuote.days} days • base ${Number(liveQuote.basePrice).toFixed(2)}€ • extras ${Number((liveQuote.pickupFee || 0) + (liveQuote.returnFee || 0) + (liveQuote.insuranceCost || 0) + (liveQuote.youngDriverCost || 0)).toFixed(2)}€`,
      `${liveQuote.days} ימים • בסיס ${Number(liveQuote.basePrice).toFixed(2)}€ • תוספות ${Number((liveQuote.pickupFee || 0) + (liveQuote.returnFee || 0) + (liveQuote.insuranceCost || 0) + (liveQuote.youngDriverCost || 0)).toFixed(2)}€`
    )
    : text('Wsparcie 24/7 • Brak depozytu', '24/7 support • No deposit', 'תמיכה 24/7 • ללא פיקדון');

  const noDepositLabel = text('Bez kaucji', 'No deposit', 'ללא פיקדון');
  const transmission = String(car.transmission || '').toLowerCase() === 'automatic'
    ? text('Automat', 'Automatic', 'אוטומטי')
    : text('Manual', 'Manual', 'ידני');
  const seats = car.max_passengers || 5;
  const seatsText = text(`${seats} miejsc`, `${seats} seats`, `${seats} מושבים`);
  const fuelType = String(car.fuel_type || '').toLowerCase();
  const fuelText = fuelType === 'petrol'
    ? text('Benzyna 95', 'Petrol 95', 'בנזין 95')
    : fuelType === 'diesel'
      ? text('Diesel', 'Diesel', 'דיזל')
      : fuelType === 'hybrid'
        ? text('Hybryda', 'Hybrid', 'היברידי')
        : fuelType === 'electric'
          ? text('Elektryczny', 'Electric', 'חשמלי')
          : (car.fuel_type || '');
  const features = getCarFeatures(car);
  const description = getCarDescription(car);
  const detailsTitle = text('Szczegóły auta', 'Car details', 'פרטי הרכב');
  const labelTransmission = text('Skrzynia', 'Transmission', 'תיבת הילוכים');
  const labelSeats = text('Miejsca', 'Seats', 'מושבים');
  const labelFuel = text('Paliwo', 'Fuel', 'דלק');
  const labelLocation = text('Oferta', 'Offer', 'הצעה');
  const locLabel = loc === 'paphos' ? text('Pafos', 'Paphos', 'פאפוס') : text('Larnaka', 'Larnaca', 'לרנקה');

  const pricingSource = Array.isArray(fleetByLocation?.[loc]) ? fleetByLocation[loc] : [car];
  captureCarPricingContext();
  window.CE_CAR_PRICING = buildPricingMapForLocation(loc, pricingSource);
  installCarOfferLookup(pricingSource);
  setBodyCarLocation(loc);

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
    bindModalLocationSync();
  } catch (error) {
    console.warn('Failed to init reservation form', error);
  }
}

window.closeCarHomeModal = closeCarOfferModal;
window.CE_OPEN_CAR_OFFER_MODAL = openCarOfferModal;
