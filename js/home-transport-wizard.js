(function () {
  'use strict';

  const STEP_FIRST = 1;
  const STEP_LAST = 4;
  const API_WAIT_INTERVAL_MS = 120;
  const API_WAIT_MAX_RETRIES = 120;

  const state = {
    currentStep: STEP_FIRST,
    maxUnlockedStep: STEP_FIRST,
    api: null,
    apiReady: false,
    apiRetries: 0,
    apiTimer: null,
  };

  const refs = {
    root: null,
    form: null,
    status: null,
    error: null,
    progressButtons: [],
    steps: new Map(),
    nextButtons: [],
    backButtons: [],
  };

  const STEP_STATUS_KEYS = {
    1: 'transport.booking.wizard.status.step1',
    2: 'transport.booking.wizard.status.step2',
    3: 'transport.booking.wizard.status.step3',
    4: 'transport.booking.wizard.status.step4',
  };

  const STEP_STATUS_FALLBACKS = {
    1: 'Step 1 of 4: Route and schedule',
    2: 'Step 2 of 4: Passengers and extras',
    3: 'Step 3 of 4: Contact and trip notes',
    4: 'Step 4 of 4: Quote summary and booking',
  };

  function getLanguageCode() {
    const raw = String(document.documentElement.lang || window.currentLang || 'en').trim().toLowerCase();
    return raw.startsWith('pl') ? 'pl' : 'en';
  }

  function getTranslationEntry(translations, key) {
    if (!key || !translations || typeof translations !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(translations, key)) {
      return translations[key];
    }
    const parts = String(key).split('.');
    let cursor = translations;
    for (const part of parts) {
      if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, part)) {
        return null;
      }
      cursor = cursor[part];
    }
    return cursor;
  }

  function interpolate(template, vars = {}) {
    const source = String(template || '');
    return source.replace(/\{\{(\w+)\}\}/g, (_match, name) => {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) return '';
      const value = vars[name];
      if (value === null || value === undefined) return '';
      return String(value);
    });
  }

  function t(key, fallback, vars = {}) {
    const root = (window.TRANSLATIONS && typeof window.TRANSLATIONS === 'object') ? window.TRANSLATIONS : null;
    const lang = getLanguageCode();
    const activeDict = root && root[lang] && typeof root[lang] === 'object' ? root[lang] : null;
    const fallbackDict = root && root.en && typeof root.en === 'object' ? root.en : null;

    const fromActive = getTranslationEntry(activeDict, key);
    if (typeof fromActive === 'string') {
      return interpolate(fromActive, vars);
    }
    const fromFallback = getTranslationEntry(fallbackDict, key);
    if (typeof fromFallback === 'string') {
      return interpolate(fromFallback, vars);
    }
    return interpolate(fallback || key || '', vars);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function strValue(field) {
    return String(field?.value || '').trim();
  }

  function setStatusForStep(step) {
    if (!refs.status) return;
    const normalized = Math.min(STEP_LAST, Math.max(STEP_FIRST, Number(step) || STEP_FIRST));
    refs.status.textContent = t(STEP_STATUS_KEYS[normalized], STEP_STATUS_FALLBACKS[normalized]);
  }

  function showError(message) {
    if (!refs.error) return;
    refs.error.textContent = String(message || '').trim();
    refs.error.hidden = !refs.error.textContent;
  }

  function clearError() {
    showError('');
  }

  function focusField(field) {
    if (!field || typeof field.focus !== 'function') return;
    try {
      field.focus({ preventScroll: false });
    } catch (_error) {
      field.focus();
    }
  }

  function getFieldLabel(fieldId, fallback) {
    const label = document.querySelector(`label[for="${fieldId}"]`);
    const clean = String(label?.textContent || '')
      .replace(/\s*\*\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean) return clean;
    return String(fallback || fieldId || 'Field').trim();
  }

  function requireSimpleField(fieldId, errorKey, fallbackError, fieldLabelFallback) {
    const field = byId(fieldId);
    if (!field) return true;
    if (strValue(field)) return true;
    focusField(field);
    showError(t(errorKey, fallbackError || '{{field}} is required.', {
      field: getFieldLabel(fieldId, fieldLabelFallback),
    }));
    return false;
  }

  function requirePositiveInt(fieldId, errorKey, fallbackError, minValue = 1, fieldLabelFallback = 'Value') {
    const field = byId(fieldId);
    if (!field) return true;
    const parsed = Number.parseInt(strValue(field), 10);
    if (Number.isFinite(parsed) && parsed >= minValue) return true;
    focusField(field);
    showError(t(errorKey, fallbackError || '{{field}} is required.', {
      field: getFieldLabel(fieldId, fieldLabelFallback),
    }));
    return false;
  }

  function requireNonNegativeInt(fieldId, errorKey, fallbackError, fieldLabelFallback = 'Value') {
    const field = byId(fieldId);
    if (!field) return true;
    const parsed = Number.parseInt(strValue(field), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return true;
    focusField(field);
    showError(t(errorKey, fallbackError || '{{field}} must be 0 or more.', {
      field: getFieldLabel(fieldId, fieldLabelFallback),
    }));
    return false;
  }

  function isRoundTrip() {
    return strValue(byId('transportTripType')) === 'round_trip';
  }

  function isReturnUsingSameExtras() {
    const checkbox = byId('transportReturnSameExtras');
    return !(checkbox instanceof HTMLInputElement) || checkbox.checked;
  }

  function validateStepRoute() {
    clearError();

    const origin = strValue(byId('transportOrigin'));
    const destination = strValue(byId('transportDestination'));
    const travelDate = strValue(byId('transportTravelDate'));
    const travelTime = strValue(byId('transportTravelTime'));

    if (!origin || !destination) {
      const firstMissing = !origin ? byId('transportOrigin') : byId('transportDestination');
      focusField(firstMissing);
      showError(t(
        'transport.booking.status.selectPickupDestination',
        'Select pickup and destination to start quote calculation.',
      ));
      return false;
    }

    if (origin === destination) {
      showError(t(
        'transport.booking.status.pickupDestinationDifferent',
        'Pickup and destination must be different.',
      ));
      return false;
    }

    if (!travelDate) {
      focusField(byId('transportTravelDate'));
      showError(t('transport.booking.validation.travelDateRequired', 'Travel date is required.'));
      return false;
    }
    if (!travelTime) {
      focusField(byId('transportTravelTime'));
      showError(t('transport.booking.validation.travelTimeRequired', 'Travel time is required.'));
      return false;
    }

    if (isRoundTrip()) {
      const returnOrigin = strValue(byId('transportReturnOrigin'));
      const returnDestination = strValue(byId('transportReturnDestination'));
      const returnDate = strValue(byId('transportReturnDate'));
      const returnTime = strValue(byId('transportReturnTime'));

      if (!returnOrigin || !returnDestination) {
        const firstMissing = !returnOrigin ? byId('transportReturnOrigin') : byId('transportReturnDestination');
        focusField(firstMissing);
        showError(t(
          'transport.booking.validation.returnPickupDestinationRequired',
          'Return pickup and destination are required for round trip.',
        ));
        return false;
      }

      if (returnOrigin === returnDestination) {
        showError(t(
          'transport.booking.validation.returnPickupDestinationDifferent',
          'Return pickup and destination must be different.',
        ));
        return false;
      }

      if (!returnDate) {
        focusField(byId('transportReturnDate'));
        showError(t('transport.booking.validation.returnDateRequired', 'Return date is required for round trip.'));
        return false;
      }
      if (!returnTime) {
        focusField(byId('transportReturnTime'));
        showError(t('transport.booking.validation.returnTimeRequired', 'Return time is required for round trip.'));
        return false;
      }
      if (travelDate && returnDate < travelDate) {
        focusField(byId('transportReturnDate'));
        showError(t(
          'transport.booking.validation.returnDateBeforeOutbound',
          'Return date cannot be earlier than outbound date.',
        ));
        return false;
      }
    }

    if (!state.apiReady || !state.api || typeof state.api.refreshQuote !== 'function') {
      showError(t(
        'transport.booking.wizard.error.loading',
        'Transport options are still loading. Please wait a moment.',
      ));
      return false;
    }

    const quote = state.api.refreshQuote();
    const snapshot = typeof state.api.getStateSnapshot === 'function' ? state.api.getStateSnapshot() : {};
    const hasRoute = Boolean(snapshot?.hasRoute);
    const hasReturnRoute = Boolean(snapshot?.hasReturnRoute);

    if (!hasRoute) {
      showError(t(
        'transport.booking.status.routeUnavailable',
        'This route is not available yet. Choose another location pair.',
      ));
      return false;
    }
    if (isRoundTrip() && !hasReturnRoute) {
      showError(t(
        'transport.booking.status.returnRouteUnavailable',
        'Return route is not available yet. Choose another return pair.',
      ));
      return false;
    }
    if (!quote || !quote.isBookable) {
      showError(t('transport.booking.status.quoteFailed', 'Failed to calculate quote. Check route details.'));
      return false;
    }

    return true;
  }

  function validateStepPassengers() {
    clearError();

    if (!requirePositiveInt('transportPassengers', 'transport.booking.wizard.error.requiredField', '{{field}} is required.', 1, 'Passengers')) return false;
    if (!requireNonNegativeInt('transportBags', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Small backpacks')) return false;
    if (!requireNonNegativeInt('transportOversizeBags', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Large bags (15kg+)')) return false;
    if (!requireNonNegativeInt('transportChildSeats', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Child seats')) return false;
    if (!requireNonNegativeInt('transportBoosterSeats', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Booster seats')) return false;
    if (!requireNonNegativeInt('transportWaitingMinutes', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Driver waiting (minutes)')) return false;

    if (isRoundTrip() && !isReturnUsingSameExtras()) {
      if (!requirePositiveInt('transportReturnPassengers', 'transport.booking.wizard.error.requiredField', '{{field}} is required.', 1, 'Return passengers')) return false;
      if (!requireNonNegativeInt('transportReturnBags', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Return small backpacks')) return false;
      if (!requireNonNegativeInt('transportReturnOversizeBags', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Return large bags (15kg+)')) return false;
      if (!requireNonNegativeInt('transportReturnChildSeats', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Return child seats')) return false;
      if (!requireNonNegativeInt('transportReturnBoosterSeats', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Return booster seats')) return false;
      if (!requireNonNegativeInt('transportReturnWaitingMinutes', 'transport.booking.wizard.error.nonNegativeField', '{{field}} must be 0 or more.', 'Return driver waiting (minutes)')) return false;
    }

    if (!state.apiReady || !state.api || typeof state.api.refreshQuote !== 'function') {
      showError(t(
        'transport.booking.wizard.error.loading',
        'Transport options are still loading. Please wait a moment.',
      ));
      return false;
    }

    const quote = state.api.refreshQuote();
    if (!quote || !quote.isBookable) {
      showError(t('transport.booking.status.quoteFailed', 'Failed to calculate quote. Check route details.'));
      return false;
    }
    if (quote.hasBlockingCapacity) {
      showError(t(
        'transport.booking.status.capacityExceeded',
        'Passengers or total luggage exceed route limits on at least one leg.',
      ));
      return false;
    }

    return true;
  }

  function validateContactFieldsForLeg(legKey) {
    const normalized = String(legKey || '').trim().toLowerCase() === 'return' ? 'return' : 'outbound';
    const prefixKey = normalized === 'return'
      ? 'transport.booking.validation.returnPrefix'
      : 'transport.booking.validation.outboundPrefix';
    const prefixFallback = normalized === 'return' ? 'Return trip: ' : 'Outbound trip: ';
    const prefix = t(prefixKey, prefixFallback);
    const suffixMap = normalized === 'return'
      ? {
          flight: ['transportReturnFlightNumber', 'transport.booking.validation.flightNumberRequiredAirport', 'flight number is required when an airport location is selected.'],
          pickup: ['transportReturnPickupAddress', 'transport.booking.validation.pickupAddressRequired', 'pickup address is required.'],
          dropoff: ['transportReturnDropoffAddress', 'transport.booking.validation.dropoffAddressRequired', 'drop-off address is required.'],
        }
      : {
          flight: ['transportFlightNumber', 'transport.booking.validation.flightNumberRequiredAirport', 'flight number is required when an airport location is selected.'],
          pickup: ['transportPickupAddress', 'transport.booking.validation.pickupAddressRequired', 'pickup address is required.'],
          dropoff: ['transportDropoffAddress', 'transport.booking.validation.dropoffAddressRequired', 'drop-off address is required.'],
        };

    const fields = [suffixMap.flight, suffixMap.pickup, suffixMap.dropoff];
    for (const item of fields) {
      const [fieldId, key, fallback] = item;
      const field = byId(fieldId);
      if (!field || !field.required) continue;
      if (strValue(field)) continue;
      focusField(field);
      showError(`${prefix}${t(key, fallback)}`);
      return false;
    }

    return true;
  }

  function validateStepContact() {
    clearError();

    if (!requireSimpleField('transportCustomerName', 'transport.booking.validation.fullNameRequired', 'Full name is required.', 'Full name')) return false;
    if (!requireSimpleField('transportCustomerPhone', 'transport.booking.validation.phoneRequired', 'Phone number is required.', 'Phone')) return false;

    const email = strValue(byId('transportCustomerEmail'));
    if (email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        focusField(byId('transportCustomerEmail'));
        showError(t('transport.booking.validation.emailInvalid', 'Email format looks invalid.'));
        return false;
      }
    }

    if (!validateContactFieldsForLeg('outbound')) return false;
    if (isRoundTrip() && !validateContactFieldsForLeg('return')) return false;

    if (!state.apiReady || !state.api || typeof state.api.refreshQuote !== 'function') {
      showError(t(
        'transport.booking.wizard.error.loading',
        'Transport options are still loading. Please wait a moment.',
      ));
      return false;
    }

    const quote = state.api.refreshQuote();
    if (!quote || !quote.isBookable) {
      showError(t('transport.booking.status.quoteFailed', 'Failed to calculate quote. Check route details.'));
      return false;
    }
    if (quote.hasBlockingCapacity) {
      showError(t(
        'transport.booking.status.capacityExceeded',
        'Passengers or total luggage exceed route limits on at least one leg.',
      ));
      return false;
    }

    return true;
  }

  function updateProgressUi() {
    for (const button of refs.progressButtons) {
      const step = Number(button?.dataset?.homeTransportProgress || 0);
      const isActive = step === state.currentStep;
      const isComplete = step < state.currentStep;
      const isLocked = step > state.maxUnlockedStep;
      button.classList.toggle('is-active', isActive);
      button.classList.toggle('is-complete', isComplete);
      button.classList.toggle('is-locked', isLocked);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    }
  }

  function showStep(step, options = {}) {
    const normalized = Math.min(STEP_LAST, Math.max(STEP_FIRST, Number(step) || STEP_FIRST));
    const force = Boolean(options.force);
    const scroll = options.scroll !== false;

    if (!force && normalized > state.maxUnlockedStep) {
      showError(t(
        'transport.booking.wizard.error.locked',
        'Complete previous steps first.',
      ));
      return false;
    }

    state.currentStep = normalized;

    for (const [stepNo, node] of refs.steps.entries()) {
      const isActive = stepNo === normalized;
      node.hidden = !isActive;
      node.classList.toggle('is-active', isActive);
    }

    updateProgressUi();
    setStatusForStep(normalized);
    if (normalized <= state.maxUnlockedStep) clearError();

    if (scroll && refs.root && typeof refs.root.scrollIntoView === 'function') {
      refs.root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return true;
  }

  function unlockAndGo(step) {
    state.maxUnlockedStep = Math.max(state.maxUnlockedStep, step);
    return showStep(step, { force: true });
  }

  function onNextFromStep(step) {
    const normalized = Math.min(STEP_LAST, Math.max(STEP_FIRST, Number(step) || STEP_FIRST));
    if (normalized >= STEP_LAST) return;

    let valid = true;
    if (normalized === 1) valid = validateStepRoute();
    if (normalized === 2) valid = validateStepPassengers();
    if (normalized === 3) valid = validateStepContact();
    if (!valid) return;

    unlockAndGo(normalized + 1);
  }

  function onBackFromStep(step) {
    const normalized = Math.min(STEP_LAST, Math.max(STEP_FIRST, Number(step) || STEP_FIRST));
    if (normalized <= STEP_FIRST) return;
    showStep(normalized - 1, { force: true });
  }

  function connectTransportApi() {
    const api = window.CE_TRANSPORT_BOOKING;
    if (!api || typeof api !== 'object' || typeof api.isReady !== 'function' || !api.isReady()) {
      return false;
    }
    state.api = api;
    state.apiReady = true;
    return true;
  }

  function startApiWatch() {
    if (connectTransportApi()) return;
    state.apiRetries = 0;
    state.apiTimer = window.setInterval(() => {
      if (connectTransportApi()) {
        window.clearInterval(state.apiTimer);
        state.apiTimer = null;
        return;
      }
      state.apiRetries += 1;
      if (state.apiRetries >= API_WAIT_MAX_RETRIES) {
        window.clearInterval(state.apiTimer);
        state.apiTimer = null;
      }
    }, API_WAIT_INTERVAL_MS);
  }

  function bindWizardEvents() {
    for (const button of refs.nextButtons) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const host = event.currentTarget?.closest?.('[data-home-transport-step]');
        const step = Number(host?.dataset?.homeTransportStep || state.currentStep || STEP_FIRST);
        onNextFromStep(step);
      });
    }

    for (const button of refs.backButtons) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const host = event.currentTarget?.closest?.('[data-home-transport-step]');
        const step = Number(host?.dataset?.homeTransportStep || state.currentStep || STEP_FIRST);
        onBackFromStep(step);
      });
    }

    for (const button of refs.progressButtons) {
      button.addEventListener('click', () => {
        const targetStep = Number(button?.dataset?.homeTransportProgress || 0);
        if (!targetStep) return;
        if (targetStep > state.maxUnlockedStep) {
          showError(t(
            'transport.booking.wizard.error.locked',
            'Complete previous steps first.',
          ));
          return;
        }
        showStep(targetStep, { force: true });
      });
    }

    document.addEventListener('ce:transport:booking-submitted', () => {
      state.maxUnlockedStep = STEP_FIRST;
      showStep(STEP_FIRST, { force: true, scroll: false });
      if (refs.status) {
        refs.status.textContent = t(
          'transport.booking.wizard.status.submitted',
          'Booking sent. You can start a new booking now.',
        );
      }
      clearError();
      window.setTimeout(() => {
        if (state.currentStep === STEP_FIRST) {
          setStatusForStep(STEP_FIRST);
        }
      }, 4500);
    });

    document.addEventListener('wakacjecypr:languagechange', () => {
      setStatusForStep(state.currentStep);
    });
  }

  function init() {
    refs.root = byId('homeTransportBookingPanel');
    refs.form = byId('transportBookingForm');
    refs.status = byId('homeTransportWizardStatus');
    refs.error = byId('homeTransportWizardError');
    refs.progressButtons = Array.from(document.querySelectorAll('[data-home-transport-progress]'));
    refs.nextButtons = Array.from(document.querySelectorAll('[data-home-transport-next]'));
    refs.backButtons = Array.from(document.querySelectorAll('[data-home-transport-back]'));
    refs.steps = new Map(
      Array.from(document.querySelectorAll('[data-home-transport-step]'))
        .map((node) => [Number(node?.dataset?.homeTransportStep || 0), node])
        .filter((item) => Number.isFinite(item[0]) && item[0] >= STEP_FIRST && item[0] <= STEP_LAST),
    );

    if (!refs.root || !refs.form || refs.steps.size < STEP_LAST) return;

    bindWizardEvents();
    startApiWatch();
    showStep(STEP_FIRST, { force: true, scroll: false });
  }

  document.addEventListener('DOMContentLoaded', init);
}());
