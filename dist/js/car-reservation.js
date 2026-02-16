// Car Reservation Form Handler
import { supabase } from './supabaseClient.js';
import { showToast } from './toast.js';

let reservationData = {};

const PAPHOS_LOCATION_VALUES = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

function currentLang() {
  const lang = (typeof window.getCurrentLanguage === 'function'
    ? window.getCurrentLanguage()
    : (window.appI18n?.language || 'pl'));
  const normalized = String(lang || 'pl').toLowerCase();
  return normalized.startsWith('en') ? 'en' : 'pl';
}

function getTranslationEntry(translations, key) {
  if (!key || !translations || typeof translations !== 'object') return null;

  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }

  if (key.indexOf('.') !== -1) {
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

  return null;
}

function interpolateText(template, replacements = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(replacements, key)
      ? String(replacements[key])
      : match
  ));
}

function tr(key, fallback = '', replacements = {}) {
  const lang = currentLang();
  const translations = window.appI18n?.translations?.[lang] || null;
  const entry = getTranslationEntry(translations, key);

  let text = null;
  if (typeof entry === 'string') {
    text = entry;
  } else if (entry && typeof entry === 'object') {
    if (typeof entry.text === 'string') {
      text = entry.text;
    } else if (typeof entry.html === 'string') {
      text = entry.html;
    }
  }

  if (typeof text !== 'string') {
    text = fallback;
  }

  return interpolateText(text, replacements);
}

function getActiveOfferLocation() {
  const raw = (document.body?.dataset?.carLocation
    || (location?.href?.includes('autopfo') ? 'paphos' : 'larnaca'))
    .toLowerCase();
  return raw === 'larnaca' ? 'larnaca' : 'paphos';
}

function normalizeLocationForOffer(locationValue, offerLocation) {
  const normalized = String(locationValue || '').trim();
  if (!normalized) return '';
  if (offerLocation === 'larnaca' && PAPHOS_LOCATION_VALUES.has(normalized)) {
    return 'paphos';
  }
  return normalized;
}

// Prefill form fields from logged-in user session
async function prefillFromUserSession() {
  try {
    // Wait for auth to be ready
    if (typeof window.waitForAuthReady === 'function') {
      await window.waitForAuthReady();
    }
    
    const session = window.CE_STATE?.session;
    const profile = window.CE_STATE?.profile;
    
    // Prefill email from session
    if (session?.user?.email) {
      const emailField = document.getElementById('res_email');
      if (emailField && !emailField.value) {
        emailField.value = session.user.email;
        // Visual indicator (green flash) that email was auto-filled
        emailField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { emailField.style.backgroundColor = ''; }, 2000);
      }
    }
    
    // Prefill name from profile (if available)
    if (profile?.full_name || profile?.username || profile?.name) {
      const nameField = document.getElementById('res_full_name');
      if (nameField && !nameField.value) {
        nameField.value = profile.full_name || profile.name || profile.username || '';
        nameField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { nameField.style.backgroundColor = ''; }, 2000);
      }
    }
    
    // Prefill phone from profile (if available)
    if (profile?.phone) {
      const phoneField = document.getElementById('res_phone');
      if (phoneField && !phoneField.value) {
        phoneField.value = profile.phone;
        phoneField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { phoneField.style.backgroundColor = ''; }, 2000);
      }
    }
  } catch (err) {
    console.warn('Could not prefill user data:', err);
  }
}

export function initCarReservationBindings() {
  const pickupLocation = document.getElementById('res_pickup_location');
  const returnLocation = document.getElementById('res_return_location');

  if (pickupLocation && pickupLocation.dataset.ceReservationBound !== '1') {
    pickupLocation.dataset.ceReservationBound = '1';
    pickupLocation.addEventListener('change', (e) => {
      handleLocationChange(e.target);
      calculateEstimatedPrice();
    });
  }
  if (returnLocation && returnLocation.dataset.ceReservationBound !== '1') {
    returnLocation.dataset.ceReservationBound = '1';
    returnLocation.addEventListener('change', (e) => {
      handleLocationChange(e.target);
      calculateEstimatedPrice();
    });
  }

  const carSelect = document.getElementById('res_car');
  if (carSelect && carSelect.dataset.ceReservationBound !== '1') {
    carSelect.dataset.ceReservationBound = '1';
    carSelect.addEventListener('change', calculateEstimatedPrice);
  }

  const insurance = document.getElementById('res_insurance');
  if (insurance && insurance.dataset.ceReservationBound !== '1') {
    insurance.dataset.ceReservationBound = '1';
    insurance.addEventListener('change', calculateEstimatedPrice);
  }

  const youngDriver = document.getElementById('res_young_driver');
  if (youngDriver && youngDriver.dataset.ceReservationBound !== '1') {
    youngDriver.dataset.ceReservationBound = '1';
    youngDriver.addEventListener('change', calculateEstimatedPrice);
  }

  const pickupDate = document.getElementById('res_pickup_date');
  const returnDate = document.getElementById('res_return_date');

  const pickupTime = document.getElementById('res_pickup_time');
  const returnTime = document.getElementById('res_return_time');

  if (pickupDate && pickupDate.dataset.ceReservationBound !== '1') {
    pickupDate.dataset.ceReservationBound = '1';
    pickupDate.addEventListener('change', calculateEstimatedPrice);
    pickupDate.addEventListener('input', calculateEstimatedPrice);
  }
  if (returnDate && returnDate.dataset.ceReservationBound !== '1') {
    returnDate.dataset.ceReservationBound = '1';
    returnDate.addEventListener('change', calculateEstimatedPrice);
    returnDate.addEventListener('input', calculateEstimatedPrice);
  }

  if (pickupTime && pickupTime.dataset.ceReservationBound !== '1') {
    pickupTime.dataset.ceReservationBound = '1';
    pickupTime.addEventListener('change', calculateEstimatedPrice);
    pickupTime.addEventListener('input', calculateEstimatedPrice);
  }
  if (returnTime && returnTime.dataset.ceReservationBound !== '1') {
    returnTime.dataset.ceReservationBound = '1';
    returnTime.addEventListener('change', calculateEstimatedPrice);
    returnTime.addEventListener('input', calculateEstimatedPrice);
  }

  initReservationForm();
}

// Initialize form
export function initReservationForm() {
  const form = document.getElementById('localReservationForm');
  if (!form) return;

  if (form.dataset.ceReservationInit === '1') return;
  form.dataset.ceReservationInit = '1';

  // Populate form with calculator data if available
  populateFromCalculator();
  
  // Prefill user data from session (email, name, phone)
  prefillFromUserSession();

  // Form submission
  form.addEventListener('submit', handleReservationSubmit);

  // Auto-fill from calculator button
  const btnFillFromCalc = document.getElementById('btnFillFromCalculator');
  if (btnFillFromCalc) {
    btnFillFromCalc.addEventListener('click', () => {
      populateFromCalculator();
      // Scroll to form and focus first field
      const formEl = document.getElementById('localReservationForm');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = document.getElementById('res_full_name') || formEl.querySelector('input, select, textarea');
        firstInput?.focus?.({ preventScroll: true });
      }
    });
  }

  try {
    calculateEstimatedPrice();
  } catch (_) {}
}

// Populate form from calculator
function populateFromCalculator() {
  let didSetAny = false;
  // Autopfo calculator IDs
  const calcCarPfo = document.getElementById('car')?.value;
  const calcPickupDatePfo = document.getElementById('pickup_date')?.value;
  const calcPickupTimePfo = document.getElementById('pickup_time')?.value;
  const calcReturnDatePfo = document.getElementById('return_date')?.value;
  const calcReturnTimePfo = document.getElementById('return_time')?.value;
  const calcAirportPickupPfo = document.getElementById('airport_pickup')?.checked;
  const calcAirportReturnPfo = document.getElementById('airport_return')?.checked;
  const calcInsurancePfo = document.getElementById('full_insurance')?.checked;

  // Larnaca calculator IDs (car-rental.html)
  const calcCarLca = document.getElementById('rentalCarSelect')?.value;
  const calcPickupDateLca = document.getElementById('pickupDate')?.value;
  const calcPickupTimeLca = document.getElementById('pickupTime')?.value;
  const calcReturnDateLca = document.getElementById('returnDate')?.value;
  const calcReturnTimeLca = document.getElementById('returnTime')?.value;
  const calcPickupLocLca = document.getElementById('pickupLocation')?.value;
  const calcReturnLocLca = document.getElementById('returnLocation')?.value;
  const calcInsuranceLca = document.getElementById('fullInsurance')?.checked;
  const calcYoungDriverLca = document.getElementById('youngDriver')?.checked;

  // Prefer Larnaca values when available, otherwise use Paphos
  const calcCar = calcCarLca || calcCarPfo;
  const calcPickupDate = calcPickupDateLca || calcPickupDatePfo;
  const calcPickupTime = calcPickupTimeLca || calcPickupTimePfo;
  const calcReturnDate = calcReturnDateLca || calcReturnDatePfo;
  const calcReturnTime = calcReturnTimeLca || calcReturnTimePfo;

  if (calcCar) { document.getElementById('res_car').value = calcCar; didSetAny = true; }
  if (calcPickupDate) { document.getElementById('res_pickup_date').value = calcPickupDate; didSetAny = true; }
  if (calcPickupTime) { document.getElementById('res_pickup_time').value = calcPickupTime; didSetAny = true; }
  if (calcReturnDate) { document.getElementById('res_return_date').value = calcReturnDate; didSetAny = true; }
  if (calcReturnTime) { document.getElementById('res_return_time').value = calcReturnTime; didSetAny = true; }

  // Map locations
  const pageLocation = getActiveOfferLocation();
  if (calcPickupLocLca) {
    const normalizedPickup = normalizeLocationForOffer(calcPickupLocLca, pageLocation);
    document.getElementById('res_pickup_location').value = normalizedPickup || calcPickupLocLca;
    didSetAny = true;
  } else if (calcAirportPickupPfo) {
    const normalizedPickup = normalizeLocationForOffer('airport_pfo', pageLocation);
    document.getElementById('res_pickup_location').value = normalizedPickup || 'airport_pfo';
    didSetAny = true;
  }
  if (calcReturnLocLca) {
    const normalizedReturn = normalizeLocationForOffer(calcReturnLocLca, pageLocation);
    document.getElementById('res_return_location').value = normalizedReturn || calcReturnLocLca;
    didSetAny = true;
  } else if (calcAirportReturnPfo) {
    const normalizedReturn = normalizeLocationForOffer('airport_pfo', pageLocation);
    document.getElementById('res_return_location').value = normalizedReturn || 'airport_pfo';
    didSetAny = true;
  }

  // Insurance
  const insuranceChecked = !!(calcInsuranceLca || calcInsurancePfo);
  if (insuranceChecked) {
    document.getElementById('res_insurance').checked = true;
    didSetAny = true;
  }
  
  // Young driver
  if (calcYoungDriverLca) {
    const youngDriverField = document.getElementById('res_young_driver');
    if (youngDriverField) {
      youngDriverField.checked = true;
      didSetAny = true;
    }
  }

  // Calculate and show estimated price
  if (didSetAny) {
    calculateEstimatedPrice();
    showToast(
      tr('carRental.page.reservation.toast.prefilledFromCalculator', 'Dane z kalkulatora zostały przeniesione!'),
      'success'
    );
  }
}

// Calculate estimated price
function calculateEstimatedPrice() {
  const estimatedEl = document.getElementById('estimatedPrice');
  if (!estimatedEl) return;

  const pickupDate = document.getElementById('res_pickup_date')?.value;
  const returnDate = document.getElementById('res_return_date')?.value;
  const pickupTime = document.getElementById('res_pickup_time')?.value || '10:00';
  const returnTime = document.getElementById('res_return_time')?.value || '10:00';
  const daysLabel = tr('carRental.common.daysLabel', 'dni');
  
  if (!pickupDate || !returnDate) {
    estimatedEl.textContent = tr(
      'carRental.page.reservation.estimated.chooseDates',
      'Wybierz datę odbioru i zwrotu, aby zobaczyć łączną cenę.'
    );
    try { delete window.CE_CAR_PRICE_QUOTE; } catch (_) {}
    return;
  }

  const pickup = new Date(`${pickupDate}T${pickupTime}`);
  const returnD = new Date(`${returnDate}T${returnTime}`);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(returnD.getTime())) {
    estimatedEl.textContent = tr(
      'carRental.page.reservation.estimated.invalidDateTime',
      'Wybierz poprawne daty i godziny odbioru oraz zwrotu.'
    );
    try { delete window.CE_CAR_PRICE_QUOTE; } catch (_) {}
    return;
  }

  const hours = (returnD - pickup) / 36e5;
  if (!Number.isFinite(hours) || hours <= 0) {
    estimatedEl.textContent = tr(
      'carRental.page.reservation.estimated.returnAfterPickup',
      'Zwrot musi być po dacie i godzinie odbioru.'
    );
    try { delete window.CE_CAR_PRICE_QUOTE; } catch (_) {}
    return;
  }

  const days = Math.ceil(hours / 24);

  if (days < 3) {
    estimatedEl.textContent = tr(
      'carRental.page.reservation.estimated.minimumDays',
      'Minimalny wynajem: 3 dni. Każde rozpoczęte 24h to kolejny dzień.',
      {
        days: 3,
        daysLabel,
      }
    );
    try { delete window.CE_CAR_PRICE_QUOTE; } catch (_) {}
    return;
  }

  const quote = window.CE_CAR_PRICE_QUOTE;

  try {
    const pricing = window.CE_CAR_PRICING && typeof window.CE_CAR_PRICING === 'object'
      ? window.CE_CAR_PRICING
      : null;
    const carModel = String(document.getElementById('res_car')?.value || '').trim();
    const pageLocation = getActiveOfferLocation();

    if (!carModel) {
      estimatedEl.textContent = tr(
        'carRental.page.reservation.estimated.chooseCar',
        'Wybierz auto, aby zobaczyć łączną cenę.'
      );
      try { delete window.CE_CAR_PRICE_QUOTE; } catch (_) {}
      return;
    }

    const carPricing = pricing && carModel ? pricing[carModel] : null;
    const pickupLoc = String(document.getElementById('res_pickup_location')?.value || '').trim();
    const returnLoc = String(document.getElementById('res_return_location')?.value || '').trim();
    const pickupLocForQuote = normalizeLocationForOffer(pickupLoc, pageLocation);
    const returnLocForQuote = normalizeLocationForOffer(returnLoc, pageLocation);
    const insuranceChecked = !!document.getElementById('res_insurance')?.checked;
    const youngDriverChecked = !!document.getElementById('res_young_driver')?.checked;

    if (Array.isArray(carPricing) && carPricing.length >= 4 && days >= 3) {
      let basePrice = 0;
      let dailyRate = 0;
      if (days === 3) {
        basePrice = Number(carPricing[0]) || 0;
      } else if (days >= 4 && days <= 6) {
        dailyRate = Number(carPricing[1]) || 0;
        basePrice = dailyRate * days;
      } else if (days >= 7 && days <= 10) {
        dailyRate = Number(carPricing[2]) || 0;
        basePrice = dailyRate * days;
      } else {
        dailyRate = Number(carPricing[3]) || 0;
        basePrice = dailyRate * days;
      }

      let pickupFee = 0;
      let returnFee = 0;

      if (pageLocation === 'paphos') {
        const airportFeesApplicable = days < 7;
        pickupFee = pickupLocForQuote === 'airport_pfo' && airportFeesApplicable ? 10 : 0;
        returnFee = returnLocForQuote === 'airport_pfo' && airportFeesApplicable ? 10 : 0;
      } else {
        const feeFor = (city) => {
          switch (city) {
            case 'nicosia':
            case 'ayia-napa':
              return 15;
            case 'protaras':
            case 'limassol':
              return 20;
            case 'paphos':
              return 40;
            default:
              return 0;
          }
        };
        pickupFee = feeFor(pickupLocForQuote);
        returnFee = feeFor(returnLocForQuote);
      }

      const insuranceCost = insuranceChecked ? 17 * days : 0;
      const youngDriverCost = pageLocation === 'larnaca' && youngDriverChecked ? 10 * days : 0;
      const total = basePrice + pickupFee + returnFee + insuranceCost + youngDriverCost;

      if (Number.isFinite(total) && total > 0) {
        window.CE_CAR_PRICE_QUOTE = {
          total: Number(total.toFixed(2)),
          currency: 'EUR',
          breakdown: {
            location: pageLocation,
            days,
            basePrice: Number(basePrice.toFixed(2)),
            dailyRate: Number((dailyRate || 0).toFixed(2)),
            pickupFee,
            returnFee,
            insuranceCost,
            youngDriverCost,
            car: carModel,
            pickupLoc: pickupLocForQuote,
            returnLoc: returnLocForQuote,
          },
        };
        estimatedEl.textContent = tr(
          'carRental.page.reservation.estimated.totalPrice',
          'Całkowita cena wynajmu: {{total}} {{currency}} ({{days}} {{daysLabel}})',
          {
            total: window.CE_CAR_PRICE_QUOTE.total.toFixed(2),
            currency: 'EUR',
            days,
            daysLabel,
          }
        );
        return;
      }
    }
  } catch (_e) {}

  // Fallback: if we have any quote at all, show it (but do NOT block recalculation when it is possible).
  if (quote && typeof quote.total === 'number' && quote.total > 0) {
    estimatedEl.textContent = tr(
      'carRental.page.reservation.estimated.totalPrice',
      'Całkowita cena wynajmu: {{total}} {{currency}} ({{days}} {{daysLabel}})',
      {
        total: quote.total.toFixed(2),
        currency: quote.currency || 'EUR',
        days,
        daysLabel,
      }
    );
    return;
  }

  // Fallback message when quote not available
  estimatedEl.textContent = tr(
    'carRental.page.reservation.estimated.durationFallback',
    'Czas wynajmu: {{days}} {{daysLabel}}. Ostateczną cenę otrzymasz po potwierdzeniu dostępności.',
    {
      days,
      daysLabel,
    }
  );
}

// Validation messages in multiple languages
function getValidationMessages() {
  return {
    fullName: tr('carRental.page.reservation.validation.fullName', 'Proszę podać imię i nazwisko'),
    email: tr('carRental.page.reservation.validation.email', 'Proszę podać poprawny adres email'),
    phone: tr('carRental.page.reservation.validation.phone', 'Proszę podać numer telefonu'),
    pickupDate: tr('carRental.page.reservation.validation.pickupDate', 'Proszę wybrać datę odbioru'),
    returnDate: tr('carRental.page.reservation.validation.returnDate', 'Proszę wybrać datę zwrotu'),
    car: tr('carRental.page.reservation.validation.car', 'Proszę wybrać samochód'),
    pickupLocation: tr('carRental.page.reservation.validation.pickupLocation', 'Proszę wybrać miejsce odbioru'),
    returnLocation: tr('carRental.page.reservation.validation.returnLocation', 'Proszę wybrać miejsce zwrotu'),
    minimumDays: tr(
      'carRental.page.reservation.validation.minimumDays',
      'Minimalny wynajem to 3 dni. Każde rozpoczęte 24h to kolejny dzień.'
    ),
  };
}

// Validate form fields
function validateReservationForm(formData) {
  const msgs = getValidationMessages();
  const errors = [];
  
  // Required fields validation
  const fullName = formData.get('full_name')?.trim();
  if (!fullName) errors.push({ field: 'res_full_name', message: msgs.fullName });
  
  const email = formData.get('email')?.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) errors.push({ field: 'res_email', message: msgs.email });
  
  const phone = formData.get('phone')?.trim();
  if (!phone) errors.push({ field: 'res_phone', message: msgs.phone });
  
  const pickupDate = formData.get('pickup_date');
  if (!pickupDate) errors.push({ field: 'res_pickup_date', message: msgs.pickupDate });
  
  const returnDate = formData.get('return_date');
  if (!returnDate) errors.push({ field: 'res_return_date', message: msgs.returnDate });

  const pickupTime = String(formData.get('pickup_time') || '10:00').trim();
  const returnTime = String(formData.get('return_time') || '10:00').trim();
  if (pickupDate && returnDate) {
    const pickup = new Date(`${pickupDate}T${pickupTime}`);
    const ret = new Date(`${returnDate}T${returnTime}`);
    const hours = (ret.getTime() - pickup.getTime()) / 36e5;
    const days = Math.ceil(hours / 24);
    if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(days)) {
      errors.push({ field: 'res_return_date', message: msgs.returnDate });
    } else if (days < 3) {
      errors.push({ field: 'res_return_date', message: msgs.minimumDays });
    }
  }
  
  const car = formData.get('car');
  if (!car) errors.push({ field: 'res_car', message: msgs.car });
  
  const pickupLocation = formData.get('pickup_location');
  if (!pickupLocation) errors.push({ field: 'res_pickup_location', message: msgs.pickupLocation });
  
  const returnLocation = formData.get('return_location');
  if (!returnLocation) errors.push({ field: 'res_return_location', message: msgs.returnLocation });
  
  return errors;
}

// Show validation errors on form fields
function showValidationErrors(errors) {
  // Clear previous errors
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  
  errors.forEach(err => {
    const field = document.getElementById(err.field);
    if (field) {
      field.classList.add('input-error');
      const errorSpan = document.createElement('span');
      errorSpan.className = 'field-error';
      errorSpan.textContent = err.message;
      errorSpan.style.cssText = 'color: #dc2626; font-size: 12px; display: block; margin-top: 4px;';
      field.parentNode.appendChild(errorSpan);
    }
  });
  
  // Scroll to first error
  if (errors.length > 0) {
    const firstField = document.getElementById(errors[0].field);
    if (firstField) {
      firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstField.focus();
    }
  }
}

// Handle form submission
async function handleReservationSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('reservationError');

  // Collect form data
  const formData = new FormData(form);
  
  // Validate form
  const validationErrors = validateReservationForm(formData);
  if (validationErrors.length > 0) {
    showValidationErrors(validationErrors);
    return;
  }

  // Clear any previous validation errors
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

  try {
    if (submitBtn) submitBtn.disabled = true;
    if (errorDiv) errorDiv.hidden = true;
    
    const resCarSelect = document.getElementById('res_car');
    const selectedResCarOpt = resCarSelect && resCarSelect.selectedOptions ? resCarSelect.selectedOptions[0] : null;
    const offerId = selectedResCarOpt?.dataset?.offerId || null;
    const quote = window.CE_CAR_PRICE_QUOTE && typeof window.CE_CAR_PRICE_QUOTE === 'object'
      ? window.CE_CAR_PRICE_QUOTE
      : null;

    const pageLocation = getActiveOfferLocation();

    const computedQuote = (() => {
      try {
        if (quote && typeof quote.total === 'number' && quote.total > 0) return quote;

        const pricing = window.CE_CAR_PRICING && typeof window.CE_CAR_PRICING === 'object'
          ? window.CE_CAR_PRICING
          : null;
        if (!pricing) return null;

        const carModel = String(formData.get('car') || '').trim();
        if (!carModel) return null;
        const carPricing = pricing[carModel];
        if (!Array.isArray(carPricing) || carPricing.length < 4) return null;

        const pickupDateStr = String(formData.get('pickup_date') || '').trim();
        const returnDateStr = String(formData.get('return_date') || '').trim();
        const pickupTimeStr = String(formData.get('pickup_time') || '10:00').trim();
        const returnTimeStr = String(formData.get('return_time') || '10:00').trim();
        if (!pickupDateStr || !returnDateStr) return null;

        const pickupDate = new Date(`${pickupDateStr}T${pickupTimeStr}`);
        const returnDate = new Date(`${returnDateStr}T${returnTimeStr}`);
        if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(returnDate.getTime())) return null;

        const hours = (returnDate.getTime() - pickupDate.getTime()) / 36e5;
        const days = Math.ceil(hours / 24);
        if (!Number.isFinite(days) || days < 3) return null;

        let basePrice = 0;
        let dailyRate = 0;
        if (days === 3) {
          basePrice = Number(carPricing[0]) || 0;
        } else if (days >= 4 && days <= 6) {
          dailyRate = Number(carPricing[1]) || 0;
          basePrice = dailyRate * days;
        } else if (days >= 7 && days <= 10) {
          dailyRate = Number(carPricing[2]) || 0;
          basePrice = dailyRate * days;
        } else {
          dailyRate = Number(carPricing[3]) || 0;
          basePrice = dailyRate * days;
        }

        const pickupLoc = String(formData.get('pickup_location') || '').trim();
        const returnLoc = String(formData.get('return_location') || '').trim();
        const pickupLocForQuote = normalizeLocationForOffer(pickupLoc, pageLocation);
        const returnLocForQuote = normalizeLocationForOffer(returnLoc, pageLocation);

        let pickupFee = 0;
        let returnFee = 0;
        if (pageLocation === 'paphos') {
          const airportFeesApplicable = days < 7;
          pickupFee = pickupLocForQuote === 'airport_pfo' && airportFeesApplicable ? 10 : 0;
          returnFee = returnLocForQuote === 'airport_pfo' && airportFeesApplicable ? 10 : 0;
        } else {
          const feeFor = (city) => {
            switch (city) {
              case 'nicosia':
              case 'ayia-napa':
                return 15;
              case 'protaras':
              case 'limassol':
                return 20;
              case 'paphos':
                return 40;
              default:
                return 0;
            }
          };
          pickupFee = feeFor(pickupLocForQuote);
          returnFee = feeFor(returnLocForQuote);
        }

        const insuranceChecked = String(formData.get('insurance') || '') === 'on';
        const youngDriverChecked = String(formData.get('young_driver') || '') === 'on';

        const insuranceCost = insuranceChecked ? 17 * days : 0;
        const youngDriverCost = pageLocation === 'larnaca' && youngDriverChecked ? 10 * days : 0;
        const total = basePrice + pickupFee + returnFee + insuranceCost + youngDriverCost;
        if (!Number.isFinite(total) || total <= 0) return null;

        return {
          total: Number(total.toFixed(2)),
          currency: 'EUR',
          breakdown: {
            location: pageLocation,
            days,
            basePrice: Number(basePrice.toFixed(2)),
            dailyRate: Number((dailyRate || 0).toFixed(2)),
            pickupFee,
            returnFee,
            insuranceCost,
            youngDriverCost,
            car: carModel,
            pickupLoc: pickupLocForQuote,
            returnLoc: returnLocForQuote,
          },
        };
      } catch (_e) {
        return null;
      }
    })();

    const rawPickupLocation = String(formData.get('pickup_location') || '').trim();
    const rawReturnLocation = String(formData.get('return_location') || '').trim();
    const normalizedPickupLocation = normalizeLocationForOffer(rawPickupLocation, pageLocation) || rawPickupLocation;
    const normalizedReturnLocation = normalizeLocationForOffer(rawReturnLocation, pageLocation) || rawReturnLocation;

    // Build data object with only essential fields
    const data = {
      // Personal info (REQUIRED)
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      
      // Rental details (REQUIRED)
      car_model: formData.get('car'),
      offer_id: offerId || undefined,
      pickup_date: formData.get('pickup_date'),
      pickup_time: formData.get('pickup_time') || '10:00',
      pickup_location: normalizedPickupLocation,
      return_date: formData.get('return_date'),
      return_time: formData.get('return_time') || '10:00',
      return_location: normalizedReturnLocation,
      
      // Metadata
      location: pageLocation,
      status: 'pending',
      source: pageLocation === 'paphos' ? 'website_autopfo' : 'website_autolca'
    };

    if (computedQuote && typeof computedQuote.total === 'number' && computedQuote.total > 0) {
      data.quoted_price = computedQuote.total;
      data.total_price = computedQuote.total;
      data.currency = computedQuote.currency || 'EUR';

      const b = computedQuote.breakdown || {};
      if (typeof b.pickupFee === 'number') data.pickup_location_fee = b.pickupFee;
      if (typeof b.returnFee === 'number') data.return_location_fee = b.returnFee;
      if (typeof b.insuranceCost === 'number') data.insurance_cost = b.insuranceCost;
      if (typeof b.youngDriverCost === 'number') data.young_driver_cost = b.youngDriverCost;
      if (typeof b.youngDriverCost === 'number' && b.youngDriverCost > 0) data.young_driver_fee = true;
      if (typeof b.insuranceCost === 'number' && b.insuranceCost > 0) data.insurance_added = true;
    }
    
    // Add optional fields only if they have values
    const country = formData.get('country');
    if (country) data.country = country;
    
    const pickupAddr = formData.get('pickup_address');
    if (pickupAddr) data.pickup_address = pickupAddr;
    
    const returnAddr = formData.get('return_address');
    if (returnAddr) data.return_address = returnAddr;
    
    const numPass = parseInt(formData.get('num_passengers'));
    if (numPass && numPass > 0) data.num_passengers = numPass;
    
    const childSeats = parseInt(formData.get('child_seats'));
    if (childSeats && childSeats > 0) data.child_seats = childSeats;
    
    const insurance = formData.get('insurance');
    if (insurance === 'on') data.full_insurance = true;
    
    const youngDriver = formData.get('young_driver');
    if (youngDriver === 'on' && pageLocation === 'larnaca') data.young_driver = true;
    
    const flightNum = formData.get('flight_number');
    if (flightNum) data.flight_number = flightNum;
    
    const requests = formData.get('special_requests');
    if (requests) data.special_requests = requests;

    console.log('Submitting reservation:', data);
    console.log('Supabase client:', supabase);
    console.log('Data keys:', Object.keys(data));

    async function insertCarBooking(payload) {
      return supabase
        .from('car_bookings')
        .insert([payload]);
    }

    // Save to Supabase (retry by removing only unknown columns reported by the API)
    let booking = null;
    let error = null;
    let attemptPayload = { ...data };
    const maxRetries = 12;

    for (let i = 0; i <= maxRetries; i += 1) {
      ({ data: booking, error } = await insertCarBooking(attemptPayload));
      if (!error) break;

      const msg = String(error.message || '');

      if (error.code === '42501' || /row-level security/i.test(msg) || /permission denied/i.test(msg)) {
        break;
      }

      const m = msg.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i)
        || msg.match(/Could not find the '([a-zA-Z0-9_]+)' column/i)
        || msg.match(/Could not find the \"([a-zA-Z0-9_]+)\" column/i);
      if (!m || !m[1]) break;

      const unknownCol = m[1];
      if (!(unknownCol in attemptPayload)) break;

      delete attemptPayload[unknownCol];
    }
    
    console.log('Insert result - booking:', booking);
    console.log('Insert result - error:', error);

    if (error) {
      console.error('Booking error:', error);
      throw new Error(error.message || 'Nie udało się zapisać rezerwacji');
    }

    console.log('Booking created:', booking);

    // Show success message
    showSuccessMessage({
      id: booking?.id,
      email: booking?.email || data.email || data.customer_email,
    });
    
    // Show visible confirmation
    const confirmDiv = document.getElementById('formSubmitConfirmation');
    if (confirmDiv) {
      confirmDiv.hidden = false;
      confirmDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Reset form
    form.reset();
    
    // Show toast
    if (typeof showToast === 'function') {
      showToast(
        tr('carRental.page.reservation.toast.submitSuccess', '🎉 Gratulacje! Twój formularz został wysłany!'),
        'success'
      );
    } else {
      console.warn('showToast function not available');
    }

  } catch (e) {
    console.error('Reservation error:', e);
    const fallbackError = tr(
      'carRental.page.reservation.error.submitFallback',
      'Nie udało się wysłać rezerwacji. Spróbuj ponownie lub napisz na WhatsApp.'
    );
    
    if (errorDiv) {
      errorDiv.textContent = tr(
        'carRental.page.reservation.error.submit',
        'Błąd: {{message}}',
        { message: e.message || fallbackError }
      );
      errorDiv.hidden = false;
    }
    
    showToast(
      tr('carRental.page.reservation.toast.submitError', 'Błąd wysyłania rezerwacji. Spróbuj ponownie.'),
      'error'
    );
    
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Show success message
function showSuccessMessage(booking) {
  const successDiv = document.getElementById('reservationSuccess');
  if (!successDiv) return;

  const bookingIdShort = booking?.id ? String(booking.id).slice(0, 8) : '--------';
  const bookingEmail = booking?.email ? String(booking.email) : '';
  const title = tr('carRental.page.reservation.successBox.title', '✅ Rezerwacja wysłana!');
  const bookingNumberLabel = tr('carRental.page.reservation.successBox.bookingNumberLabel', 'Numer rezerwacji:');
  const contactWithin24h = tr(
    'carRental.page.reservation.successBox.contactWithin24h',
    'Skontaktujemy się z Tobą w ciągu 24h, aby potwierdzić dostępność i przesłać umowę.'
  );
  const checkEmailLabel = tr('carRental.page.reservation.successBox.checkEmailLabel', 'Sprawdź email:');

  successDiv.innerHTML = `
    <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px; margin-top: 16px;">
      <h4 style="margin: 0 0 8px; font-size: 18px;">${title}</h4>
      <p style="margin: 0; opacity: 0.9;">
        ${bookingNumberLabel} <strong>#${bookingIdShort}</strong><br>
        ${contactWithin24h}
      </p>
      <p style="margin: 12px 0 0; font-size: 14px; opacity: 0.8;">
        ${checkEmailLabel} <strong>${bookingEmail}</strong>
      </p>
    </div>
  `;
  successDiv.hidden = false;

  // Scroll to success message
  successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Show/hide address fields based on location
function handleLocationChange(selectElement) {
  const locationValue = selectElement.value;
  const addressFieldId = selectElement.id === 'res_pickup_location' 
    ? 'pickupAddressField' 
    : 'returnAddressField';
  
  const addressField = document.getElementById(addressFieldId);
  if (!addressField) return;

  // Show address field if "other" or "hotel" is selected
  if (locationValue === 'hotel' || locationValue === 'other') {
    addressField.hidden = false;
    addressField.querySelector('input').required = true;
  } else {
    addressField.hidden = true;
    addressField.querySelector('input').required = false;
  }
}

// Initialize location change handlers
document.addEventListener('DOMContentLoaded', () => {
  initCarReservationBindings();
});

export { handleReservationSubmit, populateFromCalculator };
