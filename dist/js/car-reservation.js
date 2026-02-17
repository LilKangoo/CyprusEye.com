// Car Reservation Form Handler
import { supabase } from './supabaseClient.js';
import { showToast } from './toast.js';
import { calculateCarRentalQuote, normalizeLocationForOffer } from './car-pricing.js';

let reservationData = {};
const COUPON_RPC_NAME = 'car_coupon_quote';

const couponState = {
  appliedCode: '',
  result: null,
  requestSeq: 0,
  revalidateTimer: null,
};

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

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCouponDom() {
  return {
    input: document.getElementById('res_coupon_code'),
    applyBtn: document.getElementById('btnApplyCoupon'),
    clearBtn: document.getElementById('btnClearCoupon'),
    status: document.getElementById('couponStatusMessage'),
  };
}

function setCouponStatus(message = '', state = 'info') {
  const { status } = getCouponDom();
  if (!status) return;
  const text = String(message || '').trim();
  if (!text) {
    status.hidden = true;
    status.textContent = '';
    delete status.dataset.state;
    return;
  }
  status.hidden = false;
  status.textContent = text;
  status.dataset.state = String(state || 'info').trim();
}

function syncCouponButtons() {
  const { input, applyBtn, clearBtn } = getCouponDom();
  if (applyBtn) {
    const hasCode = String(input?.value || '').trim().length > 0;
    applyBtn.disabled = !hasCode;
  }
  if (clearBtn) {
    clearBtn.hidden = !couponState.appliedCode;
  }
}

function clearCouponApplication(options = {}) {
  const { clearInput = false, silent = false } = options;
  couponState.appliedCode = '';
  couponState.result = null;
  if (couponState.revalidateTimer) {
    clearTimeout(couponState.revalidateTimer);
    couponState.revalidateTimer = null;
  }
  if (clearInput) {
    const { input } = getCouponDom();
    if (input) input.value = '';
  }
  if (!silent) {
    setCouponStatus('');
  }
  syncCouponButtons();
}

function localDateTimeToIso(dateValue, timeValue) {
  const datePart = String(dateValue || '').trim();
  if (!datePart) return null;
  const timePart = String(timeValue || '10:00').trim() || '10:00';
  const dt = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function getCurrentSelectedOfferId() {
  const resCarSelect = document.getElementById('res_car');
  const selected = resCarSelect?.selectedOptions?.[0];
  const raw = String(selected?.dataset?.offerId || '').trim();
  return raw || null;
}

function buildReservationQuoteInputFromFormData(formData, pageLocation = getActiveOfferLocation()) {
  return {
    carModel: String(formData.get('car') || '').trim(),
    pickupDateStr: String(formData.get('pickup_date') || '').trim(),
    returnDateStr: String(formData.get('return_date') || '').trim(),
    pickupTimeStr: String(formData.get('pickup_time') || '10:00').trim() || '10:00',
    returnTimeStr: String(formData.get('return_time') || '10:00').trim() || '10:00',
    pickupLocation: String(formData.get('pickup_location') || '').trim(),
    returnLocation: String(formData.get('return_location') || '').trim(),
    fullInsurance: String(formData.get('insurance') || '') === 'on',
    youngDriver: String(formData.get('young_driver') || '') === 'on',
    offer: pageLocation,
  };
}

function buildReservationQuoteInputFromDom() {
  const fd = new FormData();
  const form = document.getElementById('localReservationForm');
  if (form instanceof HTMLFormElement) {
    const payload = new FormData(form);
    payload.forEach((value, key) => fd.append(key, value));
  } else {
    fd.append('car', String(document.getElementById('res_car')?.value || '').trim());
    fd.append('pickup_date', String(document.getElementById('res_pickup_date')?.value || '').trim());
    fd.append('return_date', String(document.getElementById('res_return_date')?.value || '').trim());
    fd.append('pickup_time', String(document.getElementById('res_pickup_time')?.value || '10:00').trim());
    fd.append('return_time', String(document.getElementById('res_return_time')?.value || '10:00').trim());
    fd.append('pickup_location', String(document.getElementById('res_pickup_location')?.value || '').trim());
    fd.append('return_location', String(document.getElementById('res_return_location')?.value || '').trim());
    if (document.getElementById('res_insurance')?.checked) fd.append('insurance', 'on');
    if (document.getElementById('res_young_driver')?.checked) fd.append('young_driver', 'on');
  }
  return buildReservationQuoteInputFromFormData(fd, getActiveOfferLocation());
}

function computeReservationQuote(quoteInput) {
  try {
    const pricing = window.CE_CAR_PRICING && typeof window.CE_CAR_PRICING === 'object'
      ? window.CE_CAR_PRICING
      : null;
    if (!pricing) return null;

    const carModel = String(quoteInput?.carModel || '').trim();
    if (!carModel) return null;
    const carPricing = pricing[carModel];
    if (!Array.isArray(carPricing) || carPricing.length < 4) return null;

    const computed = calculateCarRentalQuote({
      pricingMatrix: carPricing,
      offer: quoteInput?.offer || getActiveOfferLocation(),
      carModel,
      pickupDateStr: quoteInput?.pickupDateStr,
      returnDateStr: quoteInput?.returnDateStr,
      pickupTimeStr: quoteInput?.pickupTimeStr || '10:00',
      returnTimeStr: quoteInput?.returnTimeStr || '10:00',
      pickupLocation: quoteInput?.pickupLocation || '',
      returnLocation: quoteInput?.returnLocation || '',
      fullInsurance: !!quoteInput?.fullInsurance,
      youngDriver: !!quoteInput?.youngDriver,
    });
    if (!computed || typeof computed.total !== 'number' || computed.total <= 0) return null;

    return {
      total: computed.total,
      currency: 'EUR',
      breakdown: {
        location: computed.offer,
        days: computed.days,
        basePrice: computed.basePrice,
        dailyRate: computed.dailyRate,
        pickupFee: computed.pickupFee,
        returnFee: computed.returnFee,
        insuranceCost: computed.insuranceCost,
        youngDriverCost: computed.youngDriverCost,
        car: computed.car,
        pickupLoc: computed.pickupLoc,
        returnLoc: computed.returnLoc,
      },
    };
  } catch (_e) {
    return null;
  }
}

function normalizeCouponRpcRow(row) {
  if (!row || typeof row !== 'object') return null;
  const valid = Boolean(row.is_valid);
  return {
    isValid: valid,
    message: String(row.message || (valid ? 'Coupon applied' : 'Coupon invalid')),
    couponId: row.coupon_id ? String(row.coupon_id) : null,
    couponCode: String(row.coupon_code || '').trim().toUpperCase(),
    discountType: String(row.discount_type || '').trim().toLowerCase(),
    discountValue: Number(row.discount_value || 0),
    baseRentalPrice: Number(row.base_rental_price || 0),
    discountAmount: Number(row.discount_amount || 0),
    finalRentalPrice: Number(row.final_rental_price || 0),
    currency: String(row.currency || 'EUR').trim().toUpperCase() || 'EUR',
    partnerId: row.partner_id ? String(row.partner_id) : null,
    partnerCommissionBpsOverride: row.partner_commission_bps_override == null
      ? null
      : Number(row.partner_commission_bps_override),
  };
}

async function requestCouponQuote(couponCode, baseQuote, options = {}) {
  const { silent = false } = options;
  const code = String(couponCode || '').trim().toUpperCase();
  if (!code) {
    return { ok: false, message: 'Enter a coupon code', result: null };
  }
  if (!baseQuote || typeof baseQuote.total !== 'number' || baseQuote.total <= 0) {
    return { ok: false, message: 'Complete rental details before applying a coupon', result: null };
  }

  const pickupDate = document.getElementById('res_pickup_date')?.value;
  const pickupTime = document.getElementById('res_pickup_time')?.value || '10:00';
  const returnDate = document.getElementById('res_return_date')?.value;
  const returnTime = document.getElementById('res_return_time')?.value || '10:00';
  const pickupAt = localDateTimeToIso(pickupDate, pickupTime);
  const returnAt = localDateTimeToIso(returnDate, returnTime);

  if (!pickupAt || !returnAt) {
    return { ok: false, message: 'Select valid pickup and return date/time first', result: null };
  }

  const offerIdRaw = getCurrentSelectedOfferId();
  const offerId = (offerIdRaw && /^[0-9a-fA-F-]{36}$/.test(offerIdRaw)) ? offerIdRaw : null;
  const emailInput = String(document.getElementById('res_email')?.value || '').trim();
  const userId = window.CE_STATE?.session?.user?.id || null;
  const seq = couponState.requestSeq + 1;
  couponState.requestSeq = seq;

  const rpcPayloadBase = {
    p_coupon_code: code,
    p_base_rental_price: Number(baseQuote.total.toFixed(2)),
    p_pickup_at: pickupAt,
    p_return_at: returnAt,
    p_offer_id: offerId,
    p_location: getActiveOfferLocation(),
    p_car_model: String(baseQuote?.breakdown?.car || '').trim() || null,
    p_car_type: null,
    p_user_id: userId,
    p_user_email: emailInput || null,
  };

  const buildPayload = (source, removeKeys = []) => {
    const payload = {};
    Object.entries(source || {}).forEach(([key, value]) => {
      if (removeKeys.includes(key)) return;
      if (value === undefined) return;
      payload[key] = value;
    });
    return payload;
  };

  const payloadVariants = [
    buildPayload(rpcPayloadBase),
    buildPayload(rpcPayloadBase, ['p_user_email']),
    buildPayload(rpcPayloadBase, ['p_user_email', 'p_user_id']),
    buildPayload(rpcPayloadBase, ['p_user_email', 'p_user_id', 'p_car_type']),
  ];

  try {
    let row = null;
    let lastError = null;

    for (const payload of payloadVariants) {
      const { data, error } = await supabase.rpc(COUPON_RPC_NAME, payload);
      if (!error) {
        row = Array.isArray(data) ? data[0] : data;
        lastError = null;
        break;
      }

      const errCode = String(error?.code || '').trim();
      const errMsg = String(error?.message || '').trim();
      const canRetryWithAnotherSignature = errCode === 'PGRST202'
        || /Could not find the function/i.test(errMsg)
        || /schema cache/i.test(errMsg);
      lastError = error;
      if (!canRetryWithAnotherSignature) {
        throw error;
      }
    }

    if (lastError) {
      const errCode = String(lastError?.code || '').trim();
      const errMsg = String(lastError?.message || '').trim();
      if (
        errCode === 'PGRST202'
        || /Could not find the function/i.test(errMsg)
        || /schema cache/i.test(errMsg)
      ) {
        return {
          ok: false,
          message: 'Coupon service is not available yet. Please refresh in a minute.',
          result: null,
        };
      }
      throw lastError;
    }

    const normalized = normalizeCouponRpcRow(row);
    if (!normalized) {
      return { ok: false, message: 'Coupon validation returned empty response', result: null };
    }

    if (seq !== couponState.requestSeq) {
      return { ok: false, message: 'Coupon validation superseded by a newer request', result: null };
    }

    if (!normalized.isValid) {
      return { ok: false, message: normalized.message || 'Coupon is not valid for this rental', result: normalized };
    }

    return { ok: true, message: normalized.message || 'Coupon applied', result: normalized };
  } catch (error) {
    if (!silent) {
      console.error('Coupon quote failed:', error);
    }
    return { ok: false, message: String(error?.message || 'Coupon validation failed'), result: null };
  }
}

function scheduleCouponRevalidation(baseQuote) {
  if (!couponState.appliedCode) return;
  if (couponState.revalidateTimer) {
    clearTimeout(couponState.revalidateTimer);
    couponState.revalidateTimer = null;
  }
  couponState.revalidateTimer = setTimeout(async () => {
    couponState.revalidateTimer = null;
    const currentCode = couponState.appliedCode;
    if (!currentCode) return;
    const response = await requestCouponQuote(currentCode, baseQuote, { silent: true });
    if (response.ok && response.result) {
      couponState.result = response.result;
      setCouponStatus(`Coupon ${response.result.couponCode} applied: -${response.result.discountAmount.toFixed(2)} ${response.result.currency}`, 'ok');
      syncCouponButtons();
      calculateEstimatedPrice({ skipCouponRevalidation: true });
      return;
    }
    clearCouponApplication({ silent: true });
    setCouponStatus(response.message || 'Coupon is no longer valid for current rental details', 'error');
    calculateEstimatedPrice();
  }, 220);
}

function buildQuoteWithCoupon(baseQuote) {
  const coupon = couponState.result;
  const hasCoupon = Boolean(couponState.appliedCode && coupon && coupon.isValid !== false && coupon.discountAmount > 0);
  const finalTotal = hasCoupon
    ? Number(coupon.finalRentalPrice || 0)
    : Number(baseQuote?.total || 0);
  return {
    ...baseQuote,
    final_total: Number(finalTotal.toFixed(2)),
    coupon: hasCoupon
      ? {
        code: coupon.couponCode,
        coupon_id: coupon.couponId,
        discount_amount: Number(coupon.discountAmount || 0),
        base_rental_price: Number(coupon.baseRentalPrice || baseQuote.total || 0),
        final_rental_price: Number(coupon.finalRentalPrice || baseQuote.total || 0),
        partner_id: coupon.partnerId,
        partner_commission_bps_override: coupon.partnerCommissionBpsOverride,
        currency: coupon.currency || 'EUR',
      }
      : null,
  };
}

async function applyCouponCode(options = {}) {
  const { forceCode = null, silent = false } = options;
  const { input } = getCouponDom();
  const entered = String(forceCode != null ? forceCode : (input?.value || '')).trim().toUpperCase();
  if (input && forceCode != null) {
    input.value = entered;
  }
  if (!entered) {
    clearCouponApplication();
    if (!silent) setCouponStatus('Enter a coupon code', 'error');
    return null;
  }

  const baseQuote = computeReservationQuote(buildReservationQuoteInputFromDom());
  if (!baseQuote) {
    if (!silent) setCouponStatus('Complete rental details before applying a coupon', 'error');
    return null;
  }

  const response = await requestCouponQuote(entered, baseQuote, { silent });
  if (!response.ok || !response.result) {
    clearCouponApplication({ silent: true });
    setCouponStatus(response.message || 'Coupon is not valid', 'error');
    syncCouponButtons();
    calculateEstimatedPrice();
    return null;
  }

  couponState.appliedCode = response.result.couponCode || entered;
  couponState.result = response.result;
  setCouponStatus(`Coupon ${couponState.appliedCode} applied: -${response.result.discountAmount.toFixed(2)} ${response.result.currency}`, 'ok');
  syncCouponButtons();
  calculateEstimatedPrice();
  return response.result;
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

  const couponInput = document.getElementById('res_coupon_code');
  if (couponInput && couponInput.dataset.ceReservationBound !== '1') {
    couponInput.dataset.ceReservationBound = '1';
    couponInput.addEventListener('input', () => {
      const typedCode = String(couponInput.value || '').trim().toUpperCase();
      if (!typedCode) {
        clearCouponApplication({ silent: true });
        setCouponStatus('');
        calculateEstimatedPrice();
        return;
      }
      if (couponState.appliedCode && typedCode !== couponState.appliedCode) {
        clearCouponApplication({ silent: true });
        setCouponStatus('Coupon code changed. Click Apply to confirm.', 'info');
        calculateEstimatedPrice();
      }
      syncCouponButtons();
    });
  }

  const applyCouponBtn = document.getElementById('btnApplyCoupon');
  if (applyCouponBtn && applyCouponBtn.dataset.ceReservationBound !== '1') {
    applyCouponBtn.dataset.ceReservationBound = '1';
    applyCouponBtn.addEventListener('click', async () => {
      applyCouponBtn.disabled = true;
      try {
        await applyCouponCode();
      } finally {
        applyCouponBtn.disabled = false;
        syncCouponButtons();
      }
    });
  }

  const clearCouponBtn = document.getElementById('btnClearCoupon');
  if (clearCouponBtn && clearCouponBtn.dataset.ceReservationBound !== '1') {
    clearCouponBtn.dataset.ceReservationBound = '1';
    clearCouponBtn.addEventListener('click', () => {
      clearCouponApplication({ clearInput: true });
      setCouponStatus('Coupon removed', 'info');
      calculateEstimatedPrice();
    });
  }

  syncCouponButtons();

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

  clearCouponApplication({ silent: true });
  syncCouponButtons();

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

function renderEstimatedPriceQuote(estimatedEl, quote, rentalDays, daysLabel) {
  if (!estimatedEl || !quote) return;

  const currency = String(quote.currency || 'EUR').trim().toUpperCase() || 'EUR';
  const finalTotal = Number(quote.final_total ?? quote.total ?? 0);
  const baseTotal = Number(quote.base_total ?? finalTotal);
  const coupon = quote.coupon && typeof quote.coupon === 'object' ? quote.coupon : null;

  if (coupon) {
    const couponCode = String(coupon.code || '').trim().toUpperCase();
    const discount = Number(coupon.discount_amount || 0);
    const finalLabel = Number.isFinite(finalTotal) ? finalTotal.toFixed(2) : '0.00';
    const baseLabel = Number.isFinite(baseTotal) ? baseTotal.toFixed(2) : '0.00';
    const discountLabel = Number.isFinite(discount) ? discount.toFixed(2) : '0.00';

    estimatedEl.innerHTML = `
      <div style="display:grid; gap:6px;">
        <div style="font-weight:600; color:#0f172a;">
          Total rental price (${Number(rentalDays || 0)} ${escapeHtml(daysLabel || 'days')})
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <span style="color:#475569;">Base rental</span>
          <strong>${baseLabel} ${escapeHtml(currency)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <span style="color:#166534;">Coupon ${escapeHtml(couponCode || '')}</span>
          <strong style="color:#166534;">-${discountLabel} ${escapeHtml(currency)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; padding-top:6px; border-top:1px solid #cbd5e1;">
          <span style="font-weight:600; color:#0f172a;">Final rental total</span>
          <strong style="font-weight:700; color:#0f172a;">${finalLabel} ${escapeHtml(currency)}</strong>
        </div>
        <div style="font-size:12px; color:#64748b;">Coupon affects rental price only. Deposit is unchanged.</div>
      </div>
    `;
    return;
  }

  estimatedEl.textContent = tr(
    'carRental.page.reservation.estimated.totalPrice',
    'Całkowita cena wynajmu: {{total}} {{currency}} ({{days}} {{daysLabel}})',
    {
      total: Number.isFinite(finalTotal) ? finalTotal.toFixed(2) : '0.00',
      currency,
      days: Number(rentalDays || 0),
      daysLabel,
    }
  );
}

// Calculate estimated price
function calculateEstimatedPrice(options = {}) {
  const { skipCouponRevalidation = false } = options;
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

  const quoteInput = buildReservationQuoteInputFromDom();
  const baseQuote = computeReservationQuote(quoteInput);
  if (baseQuote && typeof baseQuote.total === 'number' && baseQuote.total > 0) {
    const quoteWithCoupon = buildQuoteWithCoupon(baseQuote);
    const baseTotal = Number(baseQuote.total || 0);
    const finalTotal = Number(quoteWithCoupon.final_total ?? baseTotal);
    const effectiveDays = Number(baseQuote?.breakdown?.days || days);

    window.CE_CAR_PRICE_QUOTE = {
      total: Number(finalTotal.toFixed(2)),
      base_total: Number(baseTotal.toFixed(2)),
      final_total: Number(finalTotal.toFixed(2)),
      currency: quoteWithCoupon.currency || 'EUR',
      breakdown: baseQuote.breakdown || {},
      coupon: quoteWithCoupon.coupon ? { ...quoteWithCoupon.coupon } : null,
    };

    renderEstimatedPriceQuote(estimatedEl, window.CE_CAR_PRICE_QUOTE, effectiveDays, daysLabel);

    if (!skipCouponRevalidation && couponState.appliedCode) {
      const currentCouponBase = Number(couponState.result?.baseRentalPrice || 0);
      if (!couponState.result || Math.abs(currentCouponBase - baseTotal) > 0.01) {
        scheduleCouponRevalidation(baseQuote);
      }
    }
    return;
  }

  // Fallback: if we have any quote at all, show it (but do NOT block recalculation when it is possible).
  const quote = window.CE_CAR_PRICE_QUOTE && typeof window.CE_CAR_PRICE_QUOTE === 'object'
    ? window.CE_CAR_PRICE_QUOTE
    : null;
  if (quote && typeof quote.total === 'number' && quote.total > 0) {
    renderEstimatedPriceQuote(estimatedEl, quote, days, daysLabel);
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
    const pageLocation = getActiveOfferLocation();

    const quoteInput = buildReservationQuoteInputFromFormData(formData, pageLocation);
    const computedQuote = computeReservationQuote(quoteInput);
    const uiQuote = window.CE_CAR_PRICE_QUOTE && typeof window.CE_CAR_PRICE_QUOTE === 'object'
      ? window.CE_CAR_PRICE_QUOTE
      : null;
    const uiBaseTotal = uiQuote && typeof uiQuote.base_total === 'number'
      ? uiQuote.base_total
      : uiQuote?.total;
    if (
      computedQuote
      && uiQuote
      && typeof computedQuote.total === 'number'
      && typeof uiBaseTotal === 'number'
      && Math.abs(computedQuote.total - uiBaseTotal) > 0.01
    ) {
      console.warn('Car reservation quote drift detected before submit', {
        computedTotal: computedQuote.total,
        uiTotal: uiBaseTotal,
        car: formData.get('car'),
        pickupDate: formData.get('pickup_date'),
        returnDate: formData.get('return_date'),
      });
    }

    const enteredCouponCode = String(formData.get('coupon_code') || '').trim().toUpperCase();
    if (enteredCouponCode) {
      if (!computedQuote) {
        throw new Error('Complete rental details before applying a coupon.');
      }
      const couponResponse = await requestCouponQuote(enteredCouponCode, computedQuote, { silent: true });
      if (!couponResponse.ok || !couponResponse.result) {
        setCouponStatus(couponResponse.message || 'Coupon is not valid for selected rental details', 'error');
        syncCouponButtons();
        throw new Error(couponResponse.message || 'Coupon is not valid for selected rental details');
      }
      couponState.appliedCode = couponResponse.result.couponCode || enteredCouponCode;
      couponState.result = couponResponse.result;
      setCouponStatus(`Coupon ${couponState.appliedCode} applied: -${couponResponse.result.discountAmount.toFixed(2)} ${couponResponse.result.currency}`, 'ok');
      syncCouponButtons();
    } else if (couponState.appliedCode) {
      clearCouponApplication({ silent: true });
      setCouponStatus('');
    }

    const quoteWithCoupon = computedQuote ? buildQuoteWithCoupon(computedQuote) : null;

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

    if (quoteWithCoupon && typeof quoteWithCoupon.final_total === 'number' && quoteWithCoupon.final_total > 0) {
      const finalRentalTotal = Number(quoteWithCoupon.final_total || 0);
      const baseRentalTotal = Number(computedQuote?.total || finalRentalTotal);
      data.quoted_price = Number(finalRentalTotal.toFixed(2));
      data.total_price = Number(finalRentalTotal.toFixed(2));
      data.currency = quoteWithCoupon.currency || 'EUR';
      data.base_rental_price = Number(baseRentalTotal.toFixed(2));
      data.final_rental_price = Number(finalRentalTotal.toFixed(2));
      if (quoteWithCoupon.coupon) {
        data.coupon_id = quoteWithCoupon.coupon.coupon_id || null;
        data.coupon_code = quoteWithCoupon.coupon.code || null;
        data.coupon_discount_amount = Number(quoteWithCoupon.coupon.discount_amount || 0);
        data.coupon_partner_id = quoteWithCoupon.coupon.partner_id || null;
        data.coupon_partner_commission_bps = quoteWithCoupon.coupon.partner_commission_bps_override == null
          ? null
          : Number(quoteWithCoupon.coupon.partner_commission_bps_override);
      } else {
        data.coupon_id = null;
        data.coupon_code = null;
        data.coupon_discount_amount = 0;
        data.coupon_partner_id = null;
        data.coupon_partner_commission_bps = null;
      }

      const b = computedQuote?.breakdown || {};
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
    clearCouponApplication({ clearInput: true, silent: true });
    setCouponStatus('');
    try { delete window.CE_CAR_PRICE_QUOTE; } catch (_e) {}
    calculateEstimatedPrice({ skipCouponRevalidation: true });
    
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
