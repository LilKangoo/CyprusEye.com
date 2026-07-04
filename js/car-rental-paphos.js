// Car Rental Paphos - Dynamic Fleet Loading
import { supabase } from './supabaseClient.js';
import {
  buildPricingMatrixForOfferRow,
  calculateCarRentalQuote,
  normalizeLocationForOffer,
} from './car-pricing.js';
import { openCarOfferModal } from './car-offer-modal.js';
import { normalizePaphosWidgetLocation } from './car-rental-flow.js';

let paphosFleet = [];
let pricing = {};
const deepLinkSelectionState = {
  appliedOfferId: '',
};

function getI18nLanguage() {
  const fromApp = (window.appI18n?.language || '').toLowerCase();
  if (fromApp) return fromApp;
  const fromGlobal = (typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : '').toLowerCase();
  return fromGlobal || 'pl';
}

function getI18nShortLanguage() {
  const short = String(getI18nLanguage() || '').trim().toLowerCase().split('-')[0];
  if (short === 'pl' || short === 'en' || short === 'he') return short;
  return 'en';
}

function getCarName(car) {
  return window.getCarName ? window.getCarName(car) : (car?.car_model || car?.car_type || 'Car');
}

function filterFleetForLanguage(cars, language = getI18nLanguage()) {
  if (window.CELanguage?.filterRecordsReadyForLanguage) {
    return window.CELanguage.filterRecordsReadyForLanguage(cars, 'car', language);
  }
  return Array.isArray(cars) ? cars : [];
}

function getI18nTranslations(lang = getI18nShortLanguage()) {
  const pack = window.appI18n?.translations?.[lang];
  return pack && typeof pack === 'object' ? pack : {};
}

function getI18nEntry(translations, key) {
  if (!key || !translations) return null;
  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }
  if (key.indexOf('.') === -1) return null;
  const parts = key.split('.');
  let current = translations;
  for (const part of parts) {
    if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

function getI18nString(key) {
  const lang = getI18nShortLanguage();
  const chain = lang === 'pl' ? ['pl', 'en'] : lang === 'he' ? ['he', 'en', 'pl'] : ['en', 'pl'];
  for (const code of chain) {
    const translations = getI18nTranslations(code);
    const entry = getI18nEntry(translations, key);
    if (typeof entry === 'string' && entry) return entry;
    if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string' && entry.text) return entry.text;
      if (typeof entry.html === 'string' && entry.html) return entry.html;
    }
  }
  return null;
}

function applyReplacements(template, replacements) {
  if (!template || !replacements) return template;
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, token) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, token)) return '';
    return String(replacements[token]);
  });
}

function i18n(key, replacements, fallback = '') {
  const template = getI18nString(key);
  const base = typeof template === 'string' ? template : fallback;
  return applyReplacements(base, replacements);
}

function pickCarUiText(values, language = getI18nShortLanguage()) {
  const source = values && typeof values === 'object' ? values : {};
  const lang = language === 'pl' || language === 'en' || language === 'he' ? language : 'en';
  const chain = lang === 'he' ? ['he', 'en', 'pl'] : lang === 'pl' ? ['pl', 'en', 'he'] : ['en', 'pl', 'he'];

  for (const code of chain) {
    const value = source[code];
    if (typeof value === 'string' && value.trim()) return value;
  }

  const firstAvailable = Object.values(source).find((value) => typeof value === 'string' && value.trim());
  return typeof firstAvailable === 'string' ? firstAvailable : '';
}

function carUiText(values, replacements, language = getI18nShortLanguage()) {
  return applyReplacements(pickCarUiText(values, language), replacements);
}

function isCarMediaPanorama(url) {
  if (window.CE_MEDIA_VIEWER?.isPanorama) {
    return window.CE_MEDIA_VIEWER.isPanorama(url);
  }
  return false;
}

function getPageLocation() {
  const loc = (document.body?.dataset?.carLocation || '').toLowerCase();
  return loc === 'larnaca' ? 'larnaca' : 'paphos';
}

function isLandingCarRentalPage() {
  return String(document.body?.dataset?.seoPage || '').toLowerCase() === 'carrentallanding';
}

function getRequestedOfferId() {
  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('offer_id') || '').trim();
  } catch (_error) {
    return '';
  }
}

export function getCurrentFleetRows() {
  return filterFleetForLanguage(paphosFleet);
}

export function findCurrentFleetCarByOfferId(offerId) {
  const requested = String(offerId || '').trim();
  if (!requested) return null;
  return filterFleetForLanguage(paphosFleet).find((car) => String(car?.id || '').trim() === requested) || null;
}

export function findCurrentFleetCarByModel(carModel) {
  const requested = String(carModel || '').trim();
  if (!requested) return null;
  return filterFleetForLanguage(paphosFleet).find((car) => getCarName(car) === requested) || null;
}

function getCurrentYoungDriverSelected() {
  return !!(
    document.getElementById('youngDriver')?.checked
    || document.getElementById('carsFinderYoungDriver')?.checked
    || document.getElementById('res_young_driver')?.checked
  );
}

function findFleetCarForQuote({ offerId = '', carModel = '' } = {}) {
  const normalizedOfferId = String(offerId || '').trim();
  if (normalizedOfferId) {
    const byId = findCurrentFleetCarByOfferId(normalizedOfferId);
    if (byId) return byId;
  }
  return findCurrentFleetCarByModel(carModel);
}

function getSelectedOfferIdFromSelect(selectId) {
  const selectEl = document.getElementById(selectId);
  const selectedOption = selectEl?.selectedOptions?.[0] || null;
  const raw = String(selectedOption?.dataset?.offerId || '').trim();
  return raw || '';
}

function formatEuroRateLabel(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '0€';
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}€`;
}

function applyDeepLinkedOfferSelection({ allowOnLanding = false, notifyLanding = false } = {}) {
  if (isLandingCarRentalPage() && !allowOnLanding) {
    return false;
  }

  const offerId = getRequestedOfferId();
  if (!offerId) return false;

  const selectCandidates = [
    document.getElementById('car'),
    document.getElementById('rentalCarSelect'),
    document.getElementById('res_car'),
  ].filter(Boolean);

  const alreadySelected = selectCandidates.some((selectEl) => {
    const selectedOption = selectEl.selectedOptions?.[0] || null;
    return String(selectedOption?.dataset?.offerId || '').trim() === offerId;
  });
  if (alreadySelected && deepLinkSelectionState.appliedOfferId === offerId) {
    return false;
  }

  let matchedValue = '';
  let applied = false;
  selectCandidates.forEach((selectEl) => {
    const options = Array.from(selectEl.options || []);
    const match = options.find((option) => String(option?.dataset?.offerId || '').trim() === offerId);
    if (!match) return;
    selectEl.value = match.value;
    matchedValue = match.value || matchedValue;
    applied = true;
  });

  if (!applied) return false;
  deepLinkSelectionState.appliedOfferId = offerId;

  if (notifyLanding && isLandingCarRentalPage() && typeof window.CE_CAR_ON_CARD_SELECT === 'function') {
    try {
      window.CE_CAR_ON_CARD_SELECT({ carName: matchedValue, offerId, source: 'deep-link' });
    } catch (error) {
      console.warn('Landing deep-link select callback failed:', error);
    }
  }

  return true;
}

function calculateQuoteForSelection({
  offer,
  offerId = '',
  carModel,
  pickupDateStr,
  returnDateStr,
  pickupTimeStr = '10:00',
  returnTimeStr = '10:00',
  pickupLocation = '',
  returnLocation = '',
  fullInsurance = false,
  youngDriver = false,
}) {
  const selectedCar = String(carModel || '').trim();
  const offerRow = findFleetCarForQuote({ offerId, carModel: selectedCar });
  const carPricing = offerRow
    ? buildPricingMatrixForOfferRow(offerRow, offer)
    : (selectedCar ? pricing[selectedCar] : null);
  return calculateCarRentalQuote({
    pricingMatrix: carPricing,
    offer,
    carModel: selectedCar,
    pickupDateStr,
    returnDateStr,
    pickupTimeStr,
    returnTimeStr,
    pickupLocation,
    returnLocation,
    fullInsurance,
    youngDriver,
    offerRow,
  });
}

function isValidLandingQuoteContext(quoteContext, loc) {
  if (!quoteContext || typeof quoteContext !== 'object') return false;

  const contextOffer = String(quoteContext.effectiveOffer || '').trim().toLowerCase();
  if (contextOffer && contextOffer !== loc) return false;

  const pickupDate = String(quoteContext.pickupDate || '').trim();
  const returnDate = String(quoteContext.returnDate || '').trim();
  const pickupTime = String(quoteContext.pickupTime || '10:00').trim() || '10:00';
  const returnTime = String(quoteContext.returnTime || '10:00').trim() || '10:00';
  const pickupLocation = String(quoteContext.pickupLocation || '').trim();
  const returnLocation = String(quoteContext.returnLocation || '').trim();

  if (!pickupDate || !returnDate || !pickupLocation || !returnLocation) return false;

  const pickup = new Date(`${pickupDate}T${pickupTime}`);
  const ret = new Date(`${returnDate}T${returnTime}`);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(ret.getTime())) return false;

  const hours = (ret.getTime() - pickup.getTime()) / 36e5;
  if (!Number.isFinite(hours) || hours <= 0) return false;

  const days = Math.ceil(hours / 24);
  return Number.isFinite(days) && days >= 3;
}

function calculateLandingQuoteForCar(car, loc, carModelName, quoteContext) {
  if (!quoteContext) return null;
  try {
    return calculateQuoteForSelection({
      offer: loc,
      offerId: car?.id,
      carModel: carModelName,
      pickupDateStr: quoteContext.pickupDate,
      returnDateStr: quoteContext.returnDate,
      pickupTimeStr: quoteContext.pickupTime,
      returnTimeStr: quoteContext.returnTime,
      pickupLocation: quoteContext.pickupLocation,
      returnLocation: quoteContext.returnLocation,
      fullInsurance: !!quoteContext.fullInsurance,
      youngDriver: !!quoteContext.youngDriver,
    });
  } catch (error) {
    console.warn('Failed to calculate car quote:', error);
    return null;
  }
}

function getComparableCarPrice(car, quoteContext, index, { loc, carModelName } = {}) {
  const quote = calculateLandingQuoteForCar(car, loc, carModelName, quoteContext);
  const price = Number(quote?.total);
  return {
    price: Number.isFinite(price) && price > 0 ? price : null,
    quote,
    index,
  };
}

function buildFleetRowsForRender(cars, loc, quoteContext) {
  const canSortByQuote = isValidLandingQuoteContext(quoteContext, loc);
  const rows = [...cars].map((car, index) => {
    const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
    const comparable = canSortByQuote
      ? getComparableCarPrice(car, quoteContext, index, { loc, carModelName })
      : { price: null, quote: null, index };
    return {
      car,
      carModelName,
      index,
      quote: comparable.quote || null,
      comparablePrice: comparable.price,
    };
  });

  if (!canSortByQuote) return rows;

  return rows.sort((a, b) => {
    const aHasPrice = Number.isFinite(a.comparablePrice);
    const bHasPrice = Number.isFinite(b.comparablePrice);
    if (aHasPrice && bHasPrice && a.comparablePrice !== b.comparablePrice) {
      return a.comparablePrice - b.comparablePrice;
    }
    if (aHasPrice !== bHasPrice) return aHasPrice ? -1 : 1;
    return a.index - b.index;
  });
}

function shortLocationLabel(locationValue) {
  if (locationValue === 'airport_pfo') {
    return i18n('carRental.locations.paphos-airport.short', null, 'Paphos Airport');
  }
  if (locationValue === 'city_center') {
    return i18n('carRental.page.reservation.fields.pickupLocation.city', null, 'Centrum miasta');
  }
  if (locationValue === 'hotel') {
    return i18n('carRental.page.reservation.fields.pickupLocation.hotel', null, 'Hotel');
  }
  if (locationValue === 'other') {
    return i18n('carRental.page.reservation.fields.other', null, 'Inne');
  }
  return i18n(`carRental.locations.${locationValue}.short`, null, locationValue || '');
}

function parsePassengerCount(value, fallback = 1) {
  const normalizedFallback = Number.isFinite(Number(fallback)) && Number(fallback) > 0
    ? Math.floor(Number(fallback))
    : 1;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return normalizedFallback;
  return parsed;
}

function getRequiredPassengers() {
  const calculatorValue = document.getElementById('rentalPassengers')?.value;
  const reservationValue = document.getElementById('res_passengers')?.value;
  return parsePassengerCount(calculatorValue || reservationValue, 1);
}

function getFleetFilteredByPassengers() {
  const requiredPassengers = getRequiredPassengers();
  const requireYoungDriver = getCurrentYoungDriverSelected();
  const filteredFleet = filterFleetForLanguage(paphosFleet).filter((car) => {
    const capacity = Number(car?.max_passengers || 0);
    const capacityOk = !Number.isFinite(capacity) || capacity <= 0 || capacity >= requiredPassengers;
    if (!capacityOk) return false;
    if (!requireYoungDriver) return true;
    return Boolean(car?.young_driver_fee);
  });
  return { requiredPassengers, filteredFleet, requireYoungDriver };
}

window.CE_CAR_COMPUTE_QUOTE = calculateQuoteForSelection;
window.CE_CAR_LOAD_FLEET = loadPaphosFleet;

// Load fleet from database (Paphos default, supports Larnaca)
async function loadPaphosFleet() {
  try {
    const pageLocation = getPageLocation();

    const requireNorthAllowed = pageLocation === 'larnaca';

    async function fetchFleet(withNorthAllowed) {
      let q = supabase
        .from('car_offers')
        .select('*')
        .eq('location', pageLocation)
        .eq('is_available', true);

      if (withNorthAllowed) {
        q = q.eq('north_allowed', requireNorthAllowed);
      }

      return q.order('sort_order', { ascending: true });
    }

    let { data: cars, error } = await fetchFleet(true);

    if (error) {
      const msg = String(error.message || '');
      const missingNorthAllowed =
        /north_allowed/i.test(msg)
        && (/does not exist/i.test(msg) || /could not find/i.test(msg));

      if (missingNorthAllowed) {
        ({ data: cars, error } = await fetchFleet(false));
      }
    }

    if (error) {
      console.error('Error loading fleet:', error);
      return;
    }

    paphosFleet = cars || [];

    // Build pricing object for calculator (tiered for paphos, per-day for larnaca)
    pricing = {};
    filterFleetForLanguage(paphosFleet).forEach(car => {
      const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
      if (pageLocation === 'larnaca') {
        const perDay = car.price_per_day || car.price_10plus_days || car.price_7_10days || car.price_4_6days || 35;
        pricing[carModelName] = [perDay * 3, perDay, perDay, perDay];
      } else {
        pricing[carModelName] = [
          car.price_3days || 130,
          car.price_4_6days || 34,
          car.price_7_10days || 32,
          car.price_10plus_days || 30
        ];
      }
    });

    window.CE_CAR_PRICING = pricing;
    window.CE_CAR_LOCATION = pageLocation;
    window.CE_CAR_FIND_CURRENT_FLEET_CAR = ({ offerId = '', carModel = '' } = {}) => findFleetCarForQuote({ offerId, carModel });
    window.CE_CAR_GET_CURRENT_FLEET = () => getCurrentFleetRows();

    // Render fleet
    renderFleet();
    updateCalculatorOptions();
    applyDeepLinkedOfferSelection();
    updateStats();
    try {
      window.dispatchEvent(new CustomEvent('ce:car-fleet-ready', {
        detail: {
          location: pageLocation,
          count: filterFleetForLanguage(paphosFleet).length,
        },
      }));
    } catch (_) {
      // no-op
    }

  } catch (e) {
    console.error('Failed to load fleet:', e);
  }
}

// Render fleet grid
function renderFleet() {
  const loc = getPageLocation();
  const grid =
    (loc === 'larnaca' ? (document.getElementById('larnacaCarsGrid') || document.getElementById('carRentalGrid')) : null) ||
    document.getElementById('paphosCarsGrid') ||
    document.getElementById('carRentalGrid');

  if (!grid) {
    console.error('❌ Could not find fleet grid element for location', loc);
    return;
  }
  
  if (paphosFleet.length === 0) {
    const cityLabel = i18n(`carRental.locations.${loc}.short`, null, loc);
    const message = i18n('carRental.page.fleet.empty', { city: cityLabel }, `Brak dostępnych samochodów: ${cityLabel}`);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><p>${escapeHtml(message)}</p></div>`;
    return;
  }

  const { requiredPassengers, filteredFleet, requireYoungDriver } = getFleetFilteredByPassengers();
  const lang = getI18nShortLanguage();
  if (filteredFleet.length === 0) {
    const fallbackMessage = requireYoungDriver
      ? (lang === 'he'
        ? `אין רכבים עם נהג צעיר ל-${requiredPassengers} נוסעים. שנו את הגדרת הרכב או המסלול.`
        : lang === 'en'
        ? `No cars available for ${requiredPassengers} passengers with young driver enabled. Change car setup or route.`
        : `Brak aut dla ${requiredPassengers} pasażerów z opcją młodego kierowcy. Zmień ustawienie auta lub trasę.`)
      : (lang === 'he'
        ? `אין רכבים זמינים ל-${requiredPassengers} נוסעים. הפחיתו נוסעים או שנו מסלול.`
        : lang === 'en'
        ? `No cars available for ${requiredPassengers} passengers. Reduce passengers or change route.`
        : `Brak aut dla ${requiredPassengers} pasażerów. Zmniejsz liczbę pasażerów lub zmień trasę.`);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><p>${escapeHtml(fallbackMessage)}</p></div>`;
    return;
  }

  const landingQuoteContext = isLandingCarRentalPage() && window.CE_CAR_LANDING_QUOTE_CTX && typeof window.CE_CAR_LANDING_QUOTE_CTX === 'object'
    ? window.CE_CAR_LANDING_QUOTE_CTX
    : null;
  const carsToRender = buildFleetRowsForRender(filteredFleet, loc, landingQuoteContext);

  grid.innerHTML = carsToRender.map(({ car, carModelName, quote }) => {
    // Get translated features using i18n helper
    const features = window.getCarFeatures ? window.getCarFeatures(car) : (Array.isArray(car.features) ? car.features : []);

    const transmission = car.transmission === 'automatic'
      ? i18n('carRental.common.transmission.automatic', null, 'Automat')
      : i18n('carRental.common.transmission.manual', null, 'Manual');
    
    const seats = car.max_passengers || 5;
    const seatsText = i18n('carRental.common.seats', { count: seats }, `${seats} miejsc`);
    
    // Calculate display price (use 10+ days rate as "from" price)
    const fromPrice = car.price_10plus_days || car.price_per_day || 30;

    // Get image or use placeholder
    const imageUrl = car.image_url || 'https://placehold.co/400x250/1e293b/ffffff?text=' + encodeURIComponent(carModelName);
    const imageIsPanorama = isCarMediaPanorama(imageUrl);

    let priceLabel = i18n(
      'carRental.common.priceFromPerDay',
      { price: `${fromPrice}€` },
      carUiText({
        pl: 'Od {{price}} / dzień',
        en: 'From {{price}} / day',
        he: 'מ-{{price}} / יום',
      }, { price: `${fromPrice}€` }, lang)
    );
    let priceBreakdown = '';

    if (quote) {
      try {
        const extrasTotal = Number(quote.pickupFee || 0)
          + Number(quote.returnFee || 0)
          + Number(quote.insuranceCost || 0)
          + Number(quote.youngDriverCost || 0);
        const total = Number(quote.total);
        const basePrice = Number(quote.basePrice || 0);
        if (Number.isFinite(total)) {
          const daysLabel = i18n(
            'carRental.common.daysLabel',
            null,
            carUiText({ pl: 'dni', en: 'days', he: 'ימים' }, null, lang)
          );
          priceLabel = carUiText({
            pl: 'Razem {{total}}€',
            en: 'Total {{total}}€',
            he: 'סה״כ {{total}}€',
          }, { total: total.toFixed(2) }, lang);
          priceBreakdown = carUiText({
            pl: '{{days}} {{daysLabel}} • baza {{base}}€ • dodatki {{extras}}€',
            en: '{{days}} {{daysLabel}} • base {{base}}€ • extras {{extras}}€',
            he: '{{days}} {{daysLabel}} • בסיס {{base}}€ • תוספות {{extras}}€',
          }, {
            days: quote.days,
            daysLabel,
            base: Number.isFinite(basePrice) ? basePrice.toFixed(2) : '0.00',
            extras: Number.isFinite(extrasTotal) ? extrasTotal.toFixed(2) : '0.00',
          }, lang);
        }
      } catch (error) {
        console.warn('Failed to render car quote label:', error);
      }
    }

    const reserveLabel = i18n('carRental.common.reserveCar', null, 'Zarezerwuj to auto');
    const noDepositLabel = i18n('carRentalLanding.hero.stats.noDeposit', null, 'Bez kaucji');

    const fuelKey = car.fuel_type === 'petrol'
      ? 'carRental.common.fuel.petrol95'
      : car.fuel_type === 'diesel'
        ? 'carRental.common.fuel.diesel'
        : car.fuel_type === 'hybrid'
          ? 'carRental.common.fuel.hybrid'
          : car.fuel_type === 'electric'
            ? 'carRental.common.fuel.electric'
            : '';
    const fuelText = fuelKey ? i18n(fuelKey, null, car.fuel_type) : (car.fuel_type || '');
    
    const cardMeta = `${transmission} • ${seatsText} • AC`;

    return `
      <article class="card auto-card auto-card--fleet" role="button" tabindex="0" aria-label="${escapeHtml(reserveLabel)}: ${escapeHtml(carModelName)}" data-select-car="${escapeHtml(carModelName)}" data-select-car-offer-id="${escapeHtml(car.id)}">
        <div class="auto-card-media">
          ${car.image_url ? `<img src="${escapeHtml(car.image_url)}" alt="${escapeHtml(carModelName)}" class="auto-card-image" data-preview-title="${escapeHtml(carModelName)}" role="button" tabindex="0" aria-label="${escapeHtml(reserveLabel)}" aria-haspopup="dialog">` : ''}
          ${imageIsPanorama ? '<span class="ce-media-badge ce-media-badge--auto-card">360°</span>' : ''}
          <span class="auto-card-badge">${escapeHtml(noDepositLabel)}</span>
          <div class="auto-card-overlay">
            <span class="auto-card-price">${escapeHtml(priceLabel)}</span>
            <div class="auto-card-title">
              <h3>${escapeHtml(carModelName)}<span>${escapeHtml(cardMeta)}</span></h3>
            </div>
          </div>
        </div>
        <div class="auto-card-body">
          <ul class="auto-card-specs">
            <li>${escapeHtml(transmission)}</li>
            <li>${escapeHtml(seatsText)}</li>
            <li>AC</li>
            <li>${escapeHtml(fuelText)}</li>
          </ul>
          ${priceBreakdown ? `<p class="auto-card-note">${escapeHtml(priceBreakdown)}</p>` : ''}
        </div>
      </article>
    `;
  }).join('');

  // Attach event listeners to new buttons
  attachCarSelectButtons();
}

window.CE_CAR_RERENDER_FLEET = renderFleet;
window.CE_CAR_UPDATE_CALC_OPTIONS = updateCalculatorOptions;

// Update calculator select options
function updateCalculatorOptions() {
  const select = document.getElementById('car') || document.getElementById('rentalCarSelect');
  const resSelect = document.getElementById('res_car');
  if (paphosFleet.length === 0) return;

  const { requiredPassengers, filteredFleet, requireYoungDriver } = getFleetFilteredByPassengers();
  const lang = getI18nShortLanguage();
  const previousSelectValue = String(select?.value || '').trim();
  const previousReservationValue = String(resSelect?.value || '').trim();

  if (filteredFleet.length === 0) {
    const noCarsLabel = requireYoungDriver
      ? (lang === 'he'
        ? `אין רכבי נהג צעיר ל-${requiredPassengers} נוסעים`
        : lang === 'en'
        ? `No young driver cars for ${requiredPassengers} passengers`
        : `Brak aut z młodym kierowcą dla ${requiredPassengers} pasażerów`)
      : (lang === 'he'
        ? `אין רכבים ל-${requiredPassengers} נוסעים`
        : lang === 'en'
        ? `No cars for ${requiredPassengers} passengers`
        : `Brak aut dla ${requiredPassengers} pasażerów`);
    const noCarsOption = `<option value="">${escapeHtml(noCarsLabel)}</option>`;
    if (select) select.innerHTML = noCarsOption;
    if (resSelect) resSelect.innerHTML = noCarsOption;
    return;
  }

  const optionsHTML = filteredFleet.map(car => {
    const transmission = car.transmission === 'automatic'
      ? i18n('carRental.common.transmission.automatic', null, 'Automat')
      : i18n('carRental.common.transmission.manual', null, 'Manual');
    const seats = car.max_passengers || 5;
    const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
    const seatsText = i18n('carRental.common.seats', { count: seats }, `${seats} miejsc`);
    return `<option value="${escapeHtml(carModelName)}" data-offer-id="${escapeHtml(car.id)}">${escapeHtml(carModelName)} — ${escapeHtml(transmission)} • ${escapeHtml(seatsText)}</option>`;
  }).join('');

  // Update calculator select
  if (select) {
    select.innerHTML = optionsHTML;
    const calcOptions = Array.from(select.options || []);
    const matchedCurrent = calcOptions.find((opt) => opt.value === previousSelectValue);
    if (matchedCurrent) {
      select.value = previousSelectValue;
    } else if (calcOptions.length > 0) {
      select.value = calcOptions[0].value;
    }
  }

  // Update reservation select
  if (resSelect) {
    resSelect.innerHTML = optionsHTML;
    const reservationOptions = Array.from(resSelect.options || []);
    const preferredValue = String(select?.value || previousReservationValue || '').trim();
    const matchedCurrent = reservationOptions.find((opt) => opt.value === preferredValue);
    if (matchedCurrent) {
      resSelect.value = preferredValue;
    } else if (reservationOptions.length > 0) {
      resSelect.value = reservationOptions[0].value;
    }
  }

  // Populate Larnaca pickup/return location selects if present
  const pickupSelect = document.getElementById('pickupLocation');
  const returnSelect = document.getElementById('returnLocation');
  if (pickupSelect && returnSelect && !isLandingCarRentalPage()) {
    const locationOptions = [
      { id: 'larnaca', fee: 0 },
      { id: 'nicosia', fee: 15 },
      { id: 'ayia-napa', fee: 15 },
      { id: 'protaras', fee: 20 },
      { id: 'limassol', fee: 20 },
      { id: 'paphos', fee: 40 },
    ];
    const locHTML = locationOptions
      .map((opt) => {
        const fallback = opt.id === 'larnaca'
          ? 'Larnaka (bez opłaty)'
          : opt.id === 'nicosia'
            ? 'Nikozja (+15€)'
            : opt.id === 'ayia-napa'
              ? 'Ayia Napa (+15€)'
              : opt.id === 'protaras'
                ? 'Protaras (+20€)'
                : opt.id === 'limassol'
                  ? 'Limassol (+20€)'
                  : opt.id === 'paphos'
                    ? 'Pafos (+40€)'
                    : opt.id;
        const label = i18n(`carRental.locations.${opt.id}.label`, null, fallback);
        return `<option value="${escapeHtml(opt.id)}">${escapeHtml(label)}</option>`;
      })
      .join('');
    pickupSelect.innerHTML = locHTML;
    returnSelect.innerHTML = locHTML;
  }
}

// Update stats in hero
function updateStats() {
  if (isLandingCarRentalPage()) {
    return;
  }

  const carsCount = document.querySelector('.standalone-hero-stats li:first-child strong');
  const visibleFleet = filterFleetForLanguage(paphosFleet);
  if (carsCount) {
    carsCount.textContent = visibleFleet.length;
  }

  // Find lowest price
  if (visibleFleet.length > 0) {
    const loc = getPageLocation();
    const lowestPrice = Math.min(
      ...visibleFleet.map(c => (loc === 'larnaca' ? (c.price_per_day || 35) : (c.price_10plus_days || c.price_per_day || 30)))
    );
    const priceEl = document.querySelector('.standalone-hero-stats li:nth-child(2) strong');
    if (priceEl) {
      priceEl.textContent = `${lowestPrice} €`;
    }
  }
}

// Calculate price function (updated)
window.calculatePrice = function() {
  const loc = getPageLocation();
  // Paphos legacy calculator (autopfo.html)
  const pfoCar = document.getElementById('car');
  if (loc === 'paphos' && pfoCar) {
    const car = pfoCar.value;
    const pickupDateStr = document.getElementById("pickup_date").value;
    const returnDateStr = document.getElementById("return_date").value;
    const pickupTimeStr = document.getElementById("pickup_time").value || "10:00";
    const returnTimeStr = document.getElementById("return_time").value || "10:00";
    const airportPickup = document.getElementById("airport_pickup")?.checked || false;
    const airportReturn = document.getElementById("airport_return")?.checked || false;
    const fullInsurance = document.getElementById("full_insurance")?.checked || false;

    const pickupDate = new Date(pickupDateStr + 'T' + pickupTimeStr);
    const returnDate = new Date(returnDateStr + 'T' + returnTimeStr);

    if (isNaN(pickupDate.getTime()) || isNaN(returnDate.getTime())) {
      alert(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'));
      return;
    }

    const hours = (returnDate - pickupDate) / 36e5;
    const days = Math.ceil(hours / 24);
    if (days < 3) {
      const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
      alert(i18n('carRental.calculator.errors.minimumDays', { days: 3, daysLabel }, 'Minimalny czas wynajmu to 3 dni'));
      return;
    }

    const offerId = getSelectedOfferIdFromSelect('car');
    const selectedOffer = findFleetCarForQuote({ offerId, carModel: car });
    const carPricing = selectedOffer ? buildPricingMatrixForOfferRow(selectedOffer, loc) : pricing[car];
    if (!carPricing && !selectedOffer) {
      alert(i18n('carRental.calculator.errors.selectCar', null, 'Proszę wybrać auto z listy'));
      return;
    }

    const quote = calculateQuoteForSelection({
      offer: loc,
      offerId,
      carModel: car,
      pickupDateStr,
      returnDateStr,
      pickupTimeStr,
      returnTimeStr,
      pickupLocation: airportPickup ? 'airport_pfo' : '',
      returnLocation: airportReturn ? 'airport_pfo' : '',
      fullInsurance,
      youngDriver: false,
    });
    if (!quote) {
      alert(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'));
      return;
    }

    const basePrice = quote.basePrice;
    const dailyRate = quote.dailyRate;
    const pickupFee = quote.pickupFee;
    const returnFee = quote.returnFee;
    const insuranceCost = quote.insuranceCost;
    const totalPrice = quote.total;

    window.CE_CAR_PRICE_QUOTE = {
      total: Number(totalPrice.toFixed(2)),
      currency: 'EUR',
      breakdown: {
        location: quote.offer,
        days: quote.days,
        basePrice: quote.basePrice,
        dailyRate: quote.dailyRate,
        pickupFee,
        returnFee,
        insuranceCost,
        youngDriverCost: quote.youngDriverCost,
        youngDriverDailyRate: quote.youngDriverDailyRate,
        car: quote.car,
      },
    };

    const totalEl = document.getElementById('total_price');
    if (totalEl) {
      totalEl.textContent = i18n('carRental.calculator.total', { price: `${totalPrice}€` }, `Całkowita cena wynajmu: ${totalPrice}€`);
    }

    const daysEl = document.getElementById('days_price');
    if (daysEl) {
      const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
      const rateText = dailyRate
        ? i18n('carRental.common.pricePerDay', { price: `${dailyRate}€` }, `${dailyRate}€/dzień`)
        : '';

      const baseLine = quote.days === 3
        ? i18n('carRental.calculator.breakdown.package3', { total: `${basePrice}€` }, `Pakiet 3 dni: ${basePrice}€`)
        : i18n(
          'carRental.calculator.breakdown.tiered',
          { rate: rateText, days: quote.days, daysLabel, total: `${basePrice}€` },
          `${dailyRate}€ × ${quote.days} ${daysLabel} = ${basePrice}€`
        );

      const breakdownLines = [];

      const airportLabel = i18n('carRental.locations.paphos-airport.short', null, 'Paphos Airport');
      if (pickupFee > 0) {
        breakdownLines.push(
          i18n(
            'carRental.calculator.breakdown.pickupWithFee',
            { location: airportLabel, price: `${pickupFee}€` },
            `Odbiór: ${airportLabel} +${pickupFee}€`
          )
        );
      }
      if (returnFee > 0) {
        breakdownLines.push(
          i18n(
            'carRental.calculator.breakdown.returnWithFee',
            { location: airportLabel, price: `${returnFee}€` },
            `Zwrot: ${airportLabel} +${returnFee}€`
          )
        );
      }
      if (insuranceCost > 0) {
        const insurancePerDay = i18n('carRental.common.pricePerDay', { price: '17€' }, '17€/dzień');
        breakdownLines.push(
          i18n(
            'carRental.calculator.breakdown.fullInsurance',
            { pricePerDay: insurancePerDay, days: quote.days, daysLabel, total: `${insuranceCost}€` },
            `Ubezpieczenie: ${insurancePerDay} × ${quote.days} ${daysLabel} = ${insuranceCost}€`
          )
        );
      }

      if (breakdownLines.length > 0) {
        daysEl.innerHTML = `${escapeHtml(baseLine)}<br><small style="color: #64748b;">${breakdownLines.map(escapeHtml).join(' | ')}</small>`;
      } else {
        daysEl.textContent = baseLine;
      }
    }
    return;
  }

  // Landing calculator (car.html)
  const landingCarSelect = document.getElementById('rentalCarSelect');
  if (isLandingCarRentalPage() && landingCarSelect) {
    const car = landingCarSelect.value;
    const pickupDateStr = document.getElementById('pickupDate')?.value;
    const returnDateStr = document.getElementById('returnDate')?.value;
    const pickupTimeStr = document.getElementById('pickupTime')?.value || '10:00';
    const returnTimeStr = document.getElementById('returnTime')?.value || '10:00';
    const pickupLoc = document.getElementById('pickupLocation')?.value || '';
    const returnLoc = document.getElementById('returnLocation')?.value || '';
    const fullInsurance = document.getElementById('fullInsurance')?.checked || false;
    const youngDriver = document.getElementById('youngDriver')?.checked || false;
    const resultEl = document.getElementById('carRentalResult');
    const breakdownEl = document.getElementById('carRentalBreakdown');
    const messageEl = document.getElementById('carRentalMessage');

    if (!pickupDateStr || !returnDateStr || !pickupLoc || !returnLoc) {
      window.CE_CAR_PRICE_QUOTE = null;
      if (resultEl) resultEl.textContent = '';
      if (breakdownEl) breakdownEl.innerHTML = '';
      if (messageEl) {
        messageEl.textContent = '';
        messageEl.classList.remove('is-error');
      }
      return;
    }

    const pickupDate = new Date(`${pickupDateStr || ''}T${pickupTimeStr}`);
    const returnDate = new Date(`${returnDateStr || ''}T${returnTimeStr}`);
    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(returnDate.getTime())) {
      setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
      return;
    }

    const hours = (returnDate.getTime() - pickupDate.getTime()) / 36e5;
    const days = Math.ceil(hours / 24);
    if (!Number.isFinite(days) || hours <= 0 || days < 3) {
      const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
      setCalculatorMessage(i18n('carRental.calculator.errors.minimumDays', { days: 3, daysLabel }, 'Minimalny czas wynajmu to 3 dni'), true);
      return;
    }

    if (!car) {
      window.CE_CAR_PRICE_QUOTE = null;
      if (resultEl) resultEl.textContent = '';
      if (breakdownEl) breakdownEl.innerHTML = '';
      if (messageEl) {
        messageEl.textContent = '';
        messageEl.classList.remove('is-error');
      }
      return;
    }

    const offerId = getSelectedOfferIdFromSelect('rentalCarSelect');
    const selectedOffer = findFleetCarForQuote({ offerId, carModel: car });
    const carPricing = selectedOffer ? buildPricingMatrixForOfferRow(selectedOffer, loc) : pricing[car];
    if (!carPricing && !selectedOffer) {
      window.CE_CAR_PRICE_QUOTE = null;
      if (resultEl) resultEl.textContent = '';
      if (breakdownEl) breakdownEl.innerHTML = '';
      if (messageEl) {
        messageEl.textContent = '';
        messageEl.classList.remove('is-error');
      }
      return;
    }

    const quote = calculateQuoteForSelection({
      offer: loc,
      offerId,
      carModel: car,
      pickupDateStr,
      returnDateStr,
      pickupTimeStr,
      returnTimeStr,
      pickupLocation: pickupLoc,
      returnLocation: returnLoc,
      fullInsurance,
      youngDriver,
    });

    if (!quote) {
      setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
      return;
    }

    window.CE_CAR_PRICE_QUOTE = {
      total: quote.total,
      currency: 'EUR',
      breakdown: {
        location: quote.offer,
        days: quote.days,
        basePrice: quote.basePrice,
        dailyRate: quote.dailyRate,
        pickupFee: quote.pickupFee,
        returnFee: quote.returnFee,
        insuranceCost: quote.insuranceCost,
        youngDriverCost: quote.youngDriverCost,
        youngDriverDailyRate: quote.youngDriverDailyRate,
        car: quote.car,
        pickupLoc: quote.pickupLoc,
        returnLoc: quote.returnLoc,
      },
    };

    if (resultEl) {
      resultEl.textContent = i18n('carRental.calculator.total', { price: `${quote.total.toFixed(2)}€` }, `Całkowita cena wynajmu: ${quote.total.toFixed(2)}€`);
    }

    const parts = [];
    const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
    const rateText = quote.dailyRate
      ? i18n('carRental.common.pricePerDay', { price: `${quote.dailyRate.toFixed(2)}€` }, `${quote.dailyRate.toFixed(2)}€/dzień`)
      : '';

    if (quote.days === 3) {
      parts.push(i18n('carRental.calculator.breakdown.package3', { total: `${quote.basePrice.toFixed(2)}€` }, `Pakiet 3 dni: ${quote.basePrice.toFixed(2)}€`));
    } else {
      parts.push(
        i18n(
          'carRental.calculator.breakdown.tiered',
          { rate: rateText, days: quote.days, daysLabel, total: `${quote.basePrice.toFixed(2)}€` },
          `${quote.dailyRate.toFixed(2)}€ × ${quote.days} ${daysLabel} = ${quote.basePrice.toFixed(2)}€`
        )
      );
    }

    const pickupLabel = shortLocationLabel(quote.pickupLoc);
    const returnLabel = shortLocationLabel(quote.returnLoc);
    if (quote.pickupFee) {
      parts.push(i18n('carRental.calculator.breakdown.pickupWithFee', { location: pickupLabel, price: `${quote.pickupFee}€` }, `Odbiór: ${pickupLabel} +${quote.pickupFee}€`));
    } else {
      parts.push(i18n('carRental.calculator.breakdown.pickupIncluded', { location: pickupLabel }, `Odbiór: ${pickupLabel} – w cenie`));
    }
    if (quote.returnFee) {
      parts.push(i18n('carRental.calculator.breakdown.returnWithFee', { location: returnLabel, price: `${quote.returnFee}€` }, `Zwrot: ${returnLabel} +${quote.returnFee}€`));
    } else {
      parts.push(i18n('carRental.calculator.breakdown.returnIncluded', { location: returnLabel }, `Zwrot: ${returnLabel} – w cenie`));
    }

    if (quote.insuranceCost) {
      const insurancePerDay = i18n('carRental.common.pricePerDay', { price: '17€' }, '17€/dzień');
      parts.push(
        i18n(
          'carRental.calculator.breakdown.fullInsurance',
          { pricePerDay: insurancePerDay, days: quote.days, daysLabel, total: `${quote.insuranceCost}€` },
          `Ubezpieczenie: ${insurancePerDay} × ${quote.days} ${daysLabel} = ${quote.insuranceCost}€`
        )
      );
    }

    if (quote.youngDriverCost) {
      const youngDriverPerDay = i18n(
        'carRental.common.pricePerDay',
        { price: formatEuroRateLabel(quote.youngDriverDailyRate) },
        `${formatEuroRateLabel(quote.youngDriverDailyRate)}/dzień`
      );
      parts.push(
        i18n(
          'carRental.calculator.breakdown.youngDriver',
          { pricePerDay: youngDriverPerDay, days: quote.days, daysLabel, total: `${quote.youngDriverCost}€` },
          `Młody kierowca: ${youngDriverPerDay} × ${quote.days} ${daysLabel} = ${quote.youngDriverCost}€`
        )
      );
    }

    if (breakdownEl) breakdownEl.innerHTML = parts.map(p => `<div>${escapeHtml(p)}</div>`).join('');
    if (messageEl) {
      messageEl.textContent = '';
      messageEl.classList.remove('is-error');
    }
    return;
  }

  // Larnaca calculator (car-rental.html)
  const lcaCarSelect = document.getElementById('rentalCarSelect');
  if (!lcaCarSelect) return;

  const car = lcaCarSelect.value;
  const pickupDateStr = document.getElementById('pickupDate').value;
  const returnDateStr = document.getElementById('returnDate').value;
  const pickupTimeStr = document.getElementById('pickupTime').value || '10:00';
  const returnTimeStr = document.getElementById('returnTime').value || '10:00';
  const pickupLoc = document.getElementById('pickupLocation').value;
  const returnLoc = document.getElementById('returnLocation').value;
  const fullInsurance = document.getElementById('fullInsurance')?.checked || false;
  const youngDriver = document.getElementById('youngDriver')?.checked || false;

  const pickupDate = new Date(pickupDateStr + 'T' + pickupTimeStr);
  const returnDate = new Date(returnDateStr + 'T' + returnTimeStr);
  if (isNaN(pickupDate.getTime()) || isNaN(returnDate.getTime())) {
    setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
    return;
  }
  const hours = (returnDate - pickupDate) / 36e5;
  const days = Math.ceil(hours / 24);
  if (days < 3) {
    const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
    setCalculatorMessage(i18n('carRental.calculator.errors.minimumDays', { days: 3, daysLabel }, 'Minimalny czas wynajmu to 3 dni'), true);
    return;
  }

  const offerId = getSelectedOfferIdFromSelect('rentalCarSelect');
  const selectedOffer = findFleetCarForQuote({ offerId, carModel: car });
  const carPricing = selectedOffer ? buildPricingMatrixForOfferRow(selectedOffer, loc) : pricing[car];
  if (!carPricing && !selectedOffer) {
    setCalculatorMessage(i18n('carRental.calculator.errors.selectCar', null, 'Proszę wybrać auto z listy'), true);
    return;
  }

  const quote = calculateQuoteForSelection({
    offer: loc,
    offerId,
    carModel: car,
    pickupDateStr,
    returnDateStr,
    pickupTimeStr,
    returnTimeStr,
    pickupLocation: pickupLoc,
    returnLocation: returnLoc,
    fullInsurance,
    youngDriver,
  });
  if (!quote) {
    setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
    return;
  }

  const basePrice = quote.basePrice;
  const dailyRate = quote.dailyRate;
  const pickupFee = quote.pickupFee;
  const returnFee = quote.returnFee;
  const insuranceCost = quote.insuranceCost;
  const youngDriverCost = quote.youngDriverCost;
  const totalPrice = quote.total;

  window.CE_CAR_PRICE_QUOTE = {
    total: Number(totalPrice.toFixed(2)),
    currency: 'EUR',
    breakdown: {
      location: quote.offer,
      days: quote.days,
      basePrice: quote.basePrice,
      dailyRate: quote.dailyRate,
      pickupFee,
      returnFee,
      insuranceCost,
      youngDriverCost,
      youngDriverDailyRate: quote.youngDriverDailyRate,
      car: quote.car,
      pickupLoc: quote.pickupLoc,
      returnLoc: quote.returnLoc,
    },
  };

  const resultEl = document.getElementById('carRentalResult');
  const breakdownEl = document.getElementById('carRentalBreakdown');
  const messageEl = document.getElementById('carRentalMessage');

  if (resultEl) {
    resultEl.textContent = i18n('carRental.calculator.total', { price: `${totalPrice}€` }, `Całkowita cena wynajmu: ${totalPrice}€`);
  }

  const parts = [];
  const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
  const rateText = dailyRate
    ? i18n('carRental.common.pricePerDay', { price: `${dailyRate}€` }, `${dailyRate}€/dzień`)
    : '';

  if (quote.days === 3) {
    parts.push(i18n('carRental.calculator.breakdown.package3', { total: `${basePrice}€` }, `Pakiet 3 dni: ${basePrice}€`));
  } else {
    parts.push(
      i18n(
        'carRental.calculator.breakdown.tiered',
        { rate: rateText, days: quote.days, daysLabel, total: `${basePrice}€` },
        `${dailyRate}€ × ${quote.days} ${daysLabel} = ${basePrice}€`
      )
    );
  }

  const pickupLabel = i18n(`carRental.locations.${quote.pickupLoc}.short`, null, quote.pickupLoc);
  const returnLabel = i18n(`carRental.locations.${quote.returnLoc}.short`, null, quote.returnLoc);
  if (pickupFee) {
    parts.push(i18n('carRental.calculator.breakdown.pickupWithFee', { location: pickupLabel, price: `${pickupFee}€` }, `Odbiór: ${pickupLabel} +${pickupFee}€`));
  } else {
    parts.push(i18n('carRental.calculator.breakdown.pickupIncluded', { location: pickupLabel }, `Odbiór: ${pickupLabel} – w cenie`));
  }
  if (returnFee) {
    parts.push(i18n('carRental.calculator.breakdown.returnWithFee', { location: returnLabel, price: `${returnFee}€` }, `Zwrot: ${returnLabel} +${returnFee}€`));
  } else {
    parts.push(i18n('carRental.calculator.breakdown.returnIncluded', { location: returnLabel }, `Zwrot: ${returnLabel} – w cenie`));
  }

  if (insuranceCost) {
    const insurancePerDay = i18n('carRental.common.pricePerDay', { price: '17€' }, '17€/dzień');
    parts.push(
      i18n(
        'carRental.calculator.breakdown.fullInsurance',
        { pricePerDay: insurancePerDay, days: quote.days, daysLabel, total: `${insuranceCost}€` },
        `Ubezpieczenie: ${insurancePerDay} × ${quote.days} ${daysLabel} = ${insuranceCost}€`
      )
    );
  }
  if (youngDriverCost) {
    const youngDriverPerDay = i18n(
      'carRental.common.pricePerDay',
      { price: formatEuroRateLabel(quote.youngDriverDailyRate) },
      `${formatEuroRateLabel(quote.youngDriverDailyRate)}/dzień`
    );
    parts.push(
      i18n(
        'carRental.calculator.breakdown.youngDriver',
        { pricePerDay: youngDriverPerDay, days: quote.days, daysLabel, total: `${youngDriverCost}€` },
        `Młody kierowca: ${youngDriverPerDay} × ${quote.days} ${daysLabel} = ${youngDriverCost}€`
      )
    );
  }
  if (breakdownEl) breakdownEl.innerHTML = parts.map(p => `<div>${escapeHtml(p)}</div>`).join('');
  if (messageEl) { messageEl.textContent = ''; messageEl.classList.remove('is-error'); }
};

function setCalculatorMessage(text, isError) {
  const messageEl = document.getElementById('carRentalMessage');
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.toggle('is-error', !!isError);
}

function buildLandingModalPrefill(location) {
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const pickupLocationValue = String(document.getElementById('pickupLocation')?.value || '').trim();
  const returnLocationValue = String(document.getElementById('returnLocation')?.value || '').trim();

  return {
    pickupDate: String(document.getElementById('pickupDate')?.value || '').trim(),
    pickupTime: String(document.getElementById('pickupTime')?.value || '10:00').trim() || '10:00',
    returnDate: String(document.getElementById('returnDate')?.value || '').trim(),
    returnTime: String(document.getElementById('returnTime')?.value || '10:00').trim() || '10:00',
    pickupLocation: loc === 'paphos'
      ? normalizePaphosWidgetLocation(pickupLocationValue)
      : (normalizeLocationForOffer(pickupLocationValue || 'larnaca', 'larnaca') || 'larnaca'),
    returnLocation: loc === 'paphos'
      ? normalizePaphosWidgetLocation(returnLocationValue)
      : (normalizeLocationForOffer(returnLocationValue || 'larnaca', 'larnaca') || 'larnaca'),
    fullInsurance: !!document.getElementById('fullInsurance')?.checked,
    youngDriver: loc === 'larnaca' && !!document.getElementById('youngDriver')?.checked,
    passengers: parsePassengerCount(document.getElementById('rentalPassengers')?.value || 2, 2),
  };
}

function buildLandingQuoteForCar(carName, location, offerId = '') {
  const loc = location === 'paphos' ? 'paphos' : 'larnaca';
  const quote = calculateQuoteForSelection({
    offer: loc,
    offerId,
    carModel: carName,
    pickupDateStr: document.getElementById('pickupDate')?.value || '',
    returnDateStr: document.getElementById('returnDate')?.value || '',
    pickupTimeStr: document.getElementById('pickupTime')?.value || '10:00',
    returnTimeStr: document.getElementById('returnTime')?.value || '10:00',
    pickupLocation: document.getElementById('pickupLocation')?.value || '',
    returnLocation: document.getElementById('returnLocation')?.value || '',
    fullInsurance: !!document.getElementById('fullInsurance')?.checked,
    youngDriver: loc === 'larnaca' && !!document.getElementById('youngDriver')?.checked,
  });
  return quote || null;
}

// Attach car select buttons
function attachCarSelectButtons() {
  document.querySelectorAll('[data-select-car]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.auto-card-image')) return;
      const carName = button.getAttribute('data-select-car');
      const offerId = button.getAttribute('data-select-car-offer-id');
      const pfoSelect = document.getElementById('car');
      const lcaSelect = document.getElementById('rentalCarSelect');
      const resSelect = document.getElementById('res_car');

      const setSelectByOfferId = (selectEl) => {
        if (!selectEl || !offerId) return false;
        const opts = Array.from(selectEl.options || []);
        const match = opts.find((opt) => String(opt?.dataset?.offerId || '') === String(offerId));
        if (!match) return false;
        selectEl.value = match.value;
        return true;
      };

      const setSelectByModel = (selectEl) => {
        if (!selectEl || !carName) return;
        selectEl.value = carName;
      };

      if (pfoSelect && carName) {
        if (!setSelectByOfferId(pfoSelect)) setSelectByModel(pfoSelect);
      }
      if (lcaSelect && carName) {
        if (!setSelectByOfferId(lcaSelect)) setSelectByModel(lcaSelect);
      }
      if (resSelect && carName) {
        if (!setSelectByOfferId(resSelect)) setSelectByModel(resSelect);
      }
      if (isLandingCarRentalPage() && typeof window.CE_CAR_ON_CARD_SELECT === 'function') {
        try {
          window.CE_CAR_ON_CARD_SELECT({ carName, offerId, source: 'user' });
        } catch (e) {
          console.warn('Landing card select callback failed:', e);
        }
      }
      window.calculatePrice();
      if (isLandingCarRentalPage()) {
        const selectedCar = findCurrentFleetCarByOfferId(offerId) || findCurrentFleetCarByModel(carName);
        if (selectedCar) {
          openCarOfferModal({
            car: selectedCar,
            location: getPageLocation(),
            fleetByLocation: {
              [getPageLocation()]: getCurrentFleetRows(),
            },
            prefill: buildLandingModalPrefill(getPageLocation()),
            quote: buildLandingQuoteForCar(carName, getPageLocation(), offerId),
          });
        }
        return;
      }
      const scrollTarget = document.getElementById('carRentalCalculatorBlock');
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      (lcaSelect || pfoSelect || resSelect)?.focus?.({ preventScroll: true });
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.auto-card-image')) return;
      event.preventDefault();
      button.click();
    });
  });
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadPaphosFleet().then(() => {
    // Wire Larnaca calculator events, if present
    const lcaForm = document.getElementById('carRentalCalculator');
    if (lcaForm && !isLandingCarRentalPage()) {
      lcaForm.addEventListener('submit', (e) => { e.preventDefault(); window.calculatePrice(); });
      lcaForm.addEventListener('change', () => window.calculatePrice());
      // Initial calculation when data ready
      window.calculatePrice();
    }
  });
  
  // Register language change handler (uses global helper if available)
  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler(() => {
      if (isLandingCarRentalPage()) {
        return;
      }
      // Only re-render if fleet is loaded
      if (paphosFleet && paphosFleet.length > 0) {
        renderFleet();
        updateCalculatorOptions();
        applyDeepLinkedOfferSelection();

        // Re-calculate prices if calculator exists
        if (typeof window.calculatePrice === 'function') {
          window.calculatePrice();
        }
      }
    });
  }
});

export { loadPaphosFleet, paphosFleet };
