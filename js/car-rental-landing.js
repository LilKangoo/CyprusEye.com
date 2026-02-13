const PAPHOS_WIDGET_LOCATIONS = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

const state = {
  manualOffer: null,
  autoOffer: 'larnaca',
  effectiveOffer: 'larnaca',
  paphosEligible: false,
  offerSwitchInFlight: false,
  queuedOffer: null,
};

function byId(id) {
  return document.getElementById(id);
}

function isLandingPage() {
  return String(document.body?.dataset?.seoPage || '').toLowerCase() === 'carrentallanding';
}

function currentLang() {
  const lang = (typeof window.getCurrentLanguage === 'function'
    ? window.getCurrentLanguage()
    : (window.appI18n?.language || 'pl'));
  return String(lang || 'pl').toLowerCase();
}

function t(plText, enText) {
  return currentLang().startsWith('en') ? enText : plText;
}

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ensureDefaultDates() {
  const pickupDate = byId('pickupDate');
  const returnDate = byId('returnDate');
  if (!pickupDate || !returnDate) return;

  if (!pickupDate.value) {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    pickupDate.value = toDateInputValue(start);
  }

  if (!returnDate.value) {
    const end = new Date(pickupDate.value ? `${pickupDate.value}T10:00` : Date.now());
    end.setDate(end.getDate() + 3);
    returnDate.value = toDateInputValue(end);
  }
}

function buildLocationOptionsHtml() {
  const larnacaLabel = t('Larnaka / cały Cypr', 'Larnaca / island-wide');
  const paphosLabel = t('Pafos (tylko oferta Pafos)', 'Paphos (Paphos offer only)');

  const larnacaOptions = [
    { value: 'larnaca', label: t('Larnaka (bez opłaty)', 'Larnaca (no fee)') },
    { value: 'nicosia', label: t('Nikozja (+15€)', 'Nicosia (+15€)') },
    { value: 'ayia-napa', label: t('Ayia Napa (+15€)', 'Ayia Napa (+15€)') },
    { value: 'protaras', label: t('Protaras (+20€)', 'Protaras (+20€)') },
    { value: 'limassol', label: t('Limassol (+20€)', 'Limassol (+20€)') },
    { value: 'paphos', label: t('Pafos (+40€)', 'Paphos (+40€)') },
  ];

  const paphosOptions = [
    { value: 'airport_pfo', label: t('Pafos Airport (+10€ przy wynajmie < 7 dni)', 'Paphos Airport (+10€ for rentals < 7 days)') },
    { value: 'city_center', label: t('Pafos - centrum miasta', 'Paphos city center') },
    { value: 'hotel', label: t('Hotel (w tym Coral Bay / Polis)', 'Hotel (including Coral Bay / Polis)') },
    { value: 'other', label: t('Inne miejsce (np. Coral Bay / Polis)', 'Other location (e.g. Coral Bay / Polis)') },
  ];

  const renderOptions = (items) => items
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join('');

  return `
    <optgroup label="${larnacaLabel}">
      ${renderOptions(larnacaOptions)}
    </optgroup>
    <optgroup label="${paphosLabel}">
      ${renderOptions(paphosOptions)}
    </optgroup>
  `;
}

function setSelectSafe(selectEl, value, fallback) {
  if (!selectEl) return;
  const options = Array.from(selectEl.options || []);
  const hasValue = options.some((opt) => opt.value === value);
  if (hasValue) {
    selectEl.value = value;
    return;
  }
  const hasFallback = options.some((opt) => opt.value === fallback);
  if (hasFallback) {
    selectEl.value = fallback;
  }
}

function populateWidgetLocations() {
  const pickup = byId('pickupLocation');
  const ret = byId('returnLocation');
  if (!pickup || !ret) return;

  const previousPickup = pickup.value;
  const previousReturn = ret.value;
  const html = buildLocationOptionsHtml();

  pickup.innerHTML = html;
  ret.innerHTML = html;

  setSelectSafe(pickup, previousPickup || 'larnaca', 'larnaca');
  setSelectSafe(ret, previousReturn || 'larnaca', 'larnaca');
}

function readWidgetState() {
  return {
    pickupDate: byId('pickupDate')?.value || '',
    pickupTime: byId('pickupTime')?.value || '10:00',
    returnDate: byId('returnDate')?.value || '',
    returnTime: byId('returnTime')?.value || '10:00',
    pickupLocation: byId('pickupLocation')?.value || '',
    returnLocation: byId('returnLocation')?.value || '',
    fullInsurance: !!byId('fullInsurance')?.checked,
    youngDriver: !!byId('youngDriver')?.checked,
    carModel: byId('rentalCarSelect')?.value || '',
  };
}

function isPaphosWidgetLocation(locationValue) {
  return PAPHOS_WIDGET_LOCATIONS.has(String(locationValue || '').trim());
}

function mapToLarnacaLocation(locationValue) {
  return isPaphosWidgetLocation(locationValue) ? 'paphos' : String(locationValue || '').trim();
}

function evaluateOffer(widgetState) {
  const paphosEligible =
    isPaphosWidgetLocation(widgetState.pickupLocation)
    && isPaphosWidgetLocation(widgetState.returnLocation)
    && !widgetState.youngDriver;

  state.autoOffer = paphosEligible ? 'paphos' : 'larnaca';
  state.paphosEligible = paphosEligible;

  if (!paphosEligible || widgetState.youngDriver) {
    state.manualOffer = null;
  }

  if (paphosEligible && state.manualOffer === 'larnaca') {
    state.effectiveOffer = 'larnaca';
  } else {
    state.effectiveOffer = state.autoOffer;
  }
}

function renderOfferIndicators(widgetState) {
  const badge = byId('landingActiveOfferBadge');
  const info = byId('landingOfferInfo');
  const toggleWrap = byId('landingOfferToggle');
  const toggleLabel = byId('landingOfferToggleLabel');
  const togglePaphos = byId('offerTogglePaphos');
  const toggleLarnaca = byId('offerToggleLarnaca');

  const offerName = state.effectiveOffer === 'paphos'
    ? t('Pafos', 'Paphos')
    : t('Larnaka', 'Larnaca');

  if (badge) {
    badge.textContent = t(`Oferta: ${offerName}`, `Offer: ${offerName}`);
  }

  if (toggleWrap) {
    const showToggle = state.paphosEligible;
    toggleWrap.hidden = !showToggle;
    toggleWrap.style.display = showToggle ? 'flex' : 'none';
  }

  if (toggleLabel) {
    toggleLabel.textContent = t('Porównaj oferty:', 'Compare offers:');
  }

  if (togglePaphos) {
    const active = state.effectiveOffer === 'paphos';
    togglePaphos.textContent = t('Oferta Pafos', 'Paphos offer');
    togglePaphos.setAttribute('aria-pressed', active ? 'true' : 'false');
    togglePaphos.classList.toggle('ghost', !active);
    togglePaphos.classList.toggle('btn-secondary', active);
    togglePaphos.classList.toggle('secondary', active);
  }

  if (toggleLarnaca) {
    const active = state.effectiveOffer === 'larnaca';
    toggleLarnaca.textContent = t('Oferta Larnaka', 'Larnaca offer');
    toggleLarnaca.setAttribute('aria-pressed', active ? 'true' : 'false');
    toggleLarnaca.classList.toggle('ghost', !active);
    toggleLarnaca.classList.toggle('btn-secondary', active);
    toggleLarnaca.classList.toggle('secondary', active);
  }

  if (!info) return;

  if (widgetState.youngDriver) {
    info.textContent = t(
      'Młody kierowca jest dostępny tylko w ofercie Larnaka. Oferta została przełączona automatycznie.',
      'Young driver is available only in the Larnaca offer. The offer was switched automatically.'
    );
    return;
  }

  if (state.paphosEligible && state.effectiveOffer === 'paphos') {
    info.textContent = t(
      'Aktywna oferta Pafos. Możesz ręcznie porównać ceny z ofertą Larnaka.',
      'Paphos offer is active. You can manually compare prices with the Larnaca offer.'
    );
    return;
  }

  if (state.paphosEligible && state.effectiveOffer === 'larnaca') {
    info.textContent = t(
      'Aktywna oferta Larnaka (wybór ręczny). Zmienisz ją w przełączniku „Porównaj oferty”.',
      'Larnaca offer is active (manual choice). You can switch it in the “Compare offers” toggle.'
    );
    return;
  }

  info.textContent = t(
    'Aktywna oferta Larnaka (auto-switch). Oferta Pafos włącza się tylko przy odbiorze i zwrocie w strefie Pafos.',
    'Larnaca offer is active (auto-switch). Paphos offer is enabled only for both pickup and return in Paphos area.'
  );
}

function updateLandingQuoteContext(widgetState) {
  window.CE_CAR_LANDING_QUOTE_CTX = {
    pickupDate: widgetState.pickupDate,
    pickupTime: widgetState.pickupTime,
    returnDate: widgetState.returnDate,
    returnTime: widgetState.returnTime,
    pickupLocation: widgetState.pickupLocation,
    returnLocation: widgetState.returnLocation,
    fullInsurance: widgetState.fullInsurance,
    youngDriver: widgetState.youngDriver,
    carModel: widgetState.carModel,
    effectiveOffer: state.effectiveOffer,
  };
}

function dispatchChange(id) {
  const el = byId(id);
  if (!el) return;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function syncReservationForm(widgetState) {
  const resPickupDate = byId('res_pickup_date');
  const resPickupTime = byId('res_pickup_time');
  const resReturnDate = byId('res_return_date');
  const resReturnTime = byId('res_return_time');
  const resPickupLocation = byId('res_pickup_location');
  const resReturnLocation = byId('res_return_location');
  const resInsurance = byId('res_insurance');
  const resYoungDriver = byId('res_young_driver');
  const resCar = byId('res_car');
  const calcCar = byId('rentalCarSelect');

  if (resPickupDate) resPickupDate.value = widgetState.pickupDate;
  if (resPickupTime) resPickupTime.value = widgetState.pickupTime;
  if (resReturnDate) resReturnDate.value = widgetState.returnDate;
  if (resReturnTime) resReturnTime.value = widgetState.returnTime;

  const pickupForReservation = state.effectiveOffer === 'larnaca'
    ? mapToLarnacaLocation(widgetState.pickupLocation)
    : widgetState.pickupLocation;
  const returnForReservation = state.effectiveOffer === 'larnaca'
    ? mapToLarnacaLocation(widgetState.returnLocation)
    : widgetState.returnLocation;

  setSelectSafe(resPickupLocation, pickupForReservation, 'larnaca');
  setSelectSafe(resReturnLocation, returnForReservation, 'larnaca');

  if (resInsurance) {
    resInsurance.checked = widgetState.fullInsurance;
  }

  if (resYoungDriver) {
    const canUseYoungDriver = state.effectiveOffer === 'larnaca';
    resYoungDriver.checked = canUseYoungDriver && widgetState.youngDriver;
    resYoungDriver.disabled = !canUseYoungDriver;
    resYoungDriver.setAttribute('aria-disabled', canUseYoungDriver ? 'false' : 'true');
  }

  if (resCar && calcCar && calcCar.value) {
    setSelectSafe(resCar, calcCar.value, resCar.value || '');
  }

  dispatchChange('res_pickup_location');
  dispatchChange('res_return_location');
  dispatchChange('res_pickup_date');
  dispatchChange('res_pickup_time');
  dispatchChange('res_return_date');
  dispatchChange('res_return_time');
  dispatchChange('res_insurance');
  dispatchChange('res_young_driver');
  dispatchChange('res_car');
}

async function switchOfferIfNeeded() {
  const targetOffer = state.effectiveOffer;
  const bodyOffer = String(document.body?.dataset?.carLocation || '').toLowerCase();

  if (bodyOffer === targetOffer && !state.offerSwitchInFlight) {
    return;
  }

  state.queuedOffer = targetOffer;
  if (state.offerSwitchInFlight) return;

  state.offerSwitchInFlight = true;
  try {
    while (state.queuedOffer) {
      const offer = state.queuedOffer;
      state.queuedOffer = null;

      if (document.body) {
        document.body.dataset.carLocation = offer;
      }
      window.CE_CAR_LOCATION = offer;

      if (typeof window.CE_CAR_LOAD_FLEET === 'function') {
        await window.CE_CAR_LOAD_FLEET();
      } else if (typeof window.CE_CAR_RERENDER_FLEET === 'function') {
        window.CE_CAR_RERENDER_FLEET();
      }
    }
  } catch (err) {
    console.warn('Failed to switch fleet offer on landing:', err);
  } finally {
    state.offerSwitchInFlight = false;
  }
}

async function refreshLandingFlow({ forceReload = false } = {}) {
  if (!isLandingPage()) return;

  const widgetState = readWidgetState();
  const previousOffer = state.effectiveOffer;

  evaluateOffer(widgetState);
  renderOfferIndicators(widgetState);
  updateLandingQuoteContext(widgetState);

  const offerChanged = previousOffer !== state.effectiveOffer;
  if (forceReload || offerChanged) {
    await switchOfferIfNeeded();
  } else if (typeof window.CE_CAR_RERENDER_FLEET === 'function') {
    window.CE_CAR_RERENDER_FLEET();
  }

  if (typeof window.calculatePrice === 'function') {
    window.calculatePrice();
  }

  syncReservationForm(widgetState);
}

function bindWidgetHandlers() {
  const watchedIds = [
    'pickupDate',
    'pickupTime',
    'returnDate',
    'returnTime',
    'pickupLocation',
    'returnLocation',
    'fullInsurance',
    'youngDriver',
    'rentalCarSelect',
  ];

  watchedIds.forEach((id) => {
    const el = byId(id);
    if (!el || el.dataset.ceLandingBound === '1') return;

    el.dataset.ceLandingBound = '1';
    el.addEventListener('change', () => {
      void refreshLandingFlow();
    });

    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => {
        void refreshLandingFlow();
      });
    }
  });

  const offerPaphos = byId('offerTogglePaphos');
  if (offerPaphos && offerPaphos.dataset.ceLandingBound !== '1') {
    offerPaphos.dataset.ceLandingBound = '1';
    offerPaphos.addEventListener('click', () => {
      if (!state.paphosEligible) return;
      state.manualOffer = 'paphos';
      void refreshLandingFlow();
    });
  }

  const offerLarnaca = byId('offerToggleLarnaca');
  if (offerLarnaca && offerLarnaca.dataset.ceLandingBound !== '1') {
    offerLarnaca.dataset.ceLandingBound = '1';
    offerLarnaca.addEventListener('click', () => {
      if (!state.paphosEligible) return;
      state.manualOffer = 'larnaca';
      void refreshLandingFlow();
    });
  }
}

function initLandingController() {
  if (!isLandingPage()) return;

  populateWidgetLocations();
  ensureDefaultDates();

  window.CE_CAR_ON_CARD_SELECT = () => {
    void refreshLandingFlow();
  };

  bindWidgetHandlers();
  void refreshLandingFlow();

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler(() => {
      populateWidgetLocations();
      void refreshLandingFlow();
    });
  }
}

document.addEventListener('DOMContentLoaded', initLandingController);
