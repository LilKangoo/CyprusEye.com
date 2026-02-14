const PAPHOS_WIDGET_LOCATIONS = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

const state = {
  manualOffer: null,
  autoOffer: 'larnaca',
  effectiveOffer: 'larnaca',
  paphosEligible: false,
  offerSwitchInFlight: false,
  queuedOffer: null,
  syncingWidgetToReservation: false,
  lastImageModalTrigger: null,
  lastImageModalFocus: null,
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

function bindReservationHandlers() {
  const watchedIds = [
    'res_pickup_date',
    'res_pickup_time',
    'res_return_date',
    'res_return_time',
    'res_pickup_location',
    'res_return_location',
    'res_insurance',
    'res_young_driver',
    'res_car',
  ];

  watchedIds.forEach((id) => {
    const el = byId(id);
    if (!el || el.dataset.ceLandingReservationBound === '1') return;

    el.dataset.ceLandingReservationBound = '1';
    el.addEventListener('change', () => {
      void syncWidgetFromReservationForm();
    });

    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => {
        void syncWidgetFromReservationForm();
      });
    }
  });
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

function populateReservationLocations() {
  const pickup = byId('res_pickup_location');
  const ret = byId('res_return_location');
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

function getFocusableElements(rootEl) {
  if (!(rootEl instanceof HTMLElement)) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(rootEl.querySelectorAll(selector)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

function renderReservationOfferIndicator(widgetState) {
  const indicator = byId('reservationOfferInfo');
  if (!indicator) return;

  const offerName = state.effectiveOffer === 'paphos'
    ? t('Pafos', 'Paphos')
    : t('Larnaka', 'Larnaca');

  const modeDescription = widgetState.youngDriver
    ? t('młody kierowca aktywny', 'young driver enabled')
    : state.paphosEligible && state.effectiveOffer === 'paphos'
      ? t('strefa Pafos', 'Paphos zone')
      : state.paphosEligible && state.effectiveOffer === 'larnaca'
        ? t('wybór ręczny', 'manual choice')
        : t('auto-switch', 'auto-switch');

  indicator.textContent = t(
    `Aktywna oferta: ${offerName} • ${modeDescription}`,
    `Active offer: ${offerName} • ${modeDescription}`
  );
  indicator.classList.toggle('is-paphos', state.effectiveOffer === 'paphos');
  indicator.classList.toggle('is-larnaca', state.effectiveOffer !== 'paphos');
}

function findRenderedCardForModel(carModel) {
  const buttons = Array.from(document.querySelectorAll('[data-select-car]'));
  const matchedButton = buttons.find(
    (btn) => String(btn.getAttribute('data-select-car') || '').trim() === carModel
  );
  return matchedButton ? matchedButton.closest('.auto-card') : null;
}

function renderSelectedCarHighlight() {
  const panel = byId('selectedCarHighlight');
  const image = byId('selectedCarHighlightImage');
  const title = byId('selectedCarHighlightTitle');
  const meta = byId('selectedCarHighlightMeta');
  const price = byId('selectedCarHighlightPrice');
  const offer = byId('selectedCarHighlightOffer');
  if (!panel || !title) return;

  const selectedCar = String(byId('rentalCarSelect')?.value || byId('res_car')?.value || '').trim();
  if (!selectedCar) {
    panel.hidden = true;
    return;
  }

  const card = findRenderedCardForModel(selectedCar);
  const cardImage = card ? card.querySelector('.auto-card-image') : null;
  const cardMeta = card?.querySelector('.auto-card-title span')?.textContent?.trim() || '';
  const cardPrice = card?.querySelector('.auto-card-price')?.textContent?.trim() || '';
  const quoteTotal = typeof window.CE_CAR_PRICE_QUOTE?.total === 'number'
    ? `${window.CE_CAR_PRICE_QUOTE.total.toFixed(2)}€`
    : '';

  title.textContent = selectedCar;

  document.querySelectorAll('.auto-card.is-selected').forEach((node) => {
    node.classList.remove('is-selected');
  });
  if (card) {
    card.classList.add('is-selected');
  }

  if (meta) {
    meta.textContent = cardMeta || t(
      'Wybrane auto jest gotowe do rezerwacji.',
      'Selected car is ready for booking.'
    );
  }

  if (price) {
    price.textContent = cardPrice || (quoteTotal ? t(`Szacunkowo: ${quoteTotal}`, `Estimated: ${quoteTotal}`) : '');
    price.hidden = !price.textContent;
  }

  if (image) {
    if (cardImage?.getAttribute('src')) {
      image.src = String(cardImage.getAttribute('src'));
      image.alt = String(cardImage.getAttribute('alt') || selectedCar);
    } else {
      image.src = `https://placehold.co/640x360/e2e8f0/0f172a?text=${encodeURIComponent(selectedCar)}`;
      image.alt = selectedCar;
    }
  }

  if (offer) {
    offer.textContent = state.effectiveOffer === 'paphos'
      ? t('Oferta Pafos', 'Paphos offer')
      : t('Oferta Larnaka', 'Larnaca offer');
  }

  panel.hidden = false;
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

  populateReservationLocations();

  state.syncingWidgetToReservation = true;
  try {
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

    const reservationForm = byId('localReservationForm');
    if (reservationForm) {
      reservationForm.dataset.activeOffer = state.effectiveOffer;
    }

    renderReservationOfferIndicator(widgetState);

    dispatchChange('res_pickup_location');
    dispatchChange('res_return_location');
    dispatchChange('res_pickup_date');
    dispatchChange('res_pickup_time');
    dispatchChange('res_return_date');
    dispatchChange('res_return_time');
    dispatchChange('res_insurance');
    dispatchChange('res_young_driver');
    dispatchChange('res_car');
  } finally {
    state.syncingWidgetToReservation = false;
  }
}

function openCarImageModalFromImage(imageEl) {
  const modal = byId('carImageModal');
  const modalImage = byId('carImageModalImg');
  const modalCaption = byId('carImageModalCaption');
  const closeButton = byId('carImageModalClose');
  const modalDialog = modal?.querySelector('.car-image-modal__dialog');
  if (!modal || !modalImage || !imageEl) return;

  const src = String(imageEl.getAttribute('src') || '').trim();
  if (!src) return;

  const alt = String(imageEl.getAttribute('alt') || t('Podgląd auta', 'Car preview'));
  const caption = String(imageEl.dataset.previewTitle || alt);

  modalImage.src = src;
  modalImage.alt = alt;
  if (modalCaption) {
    modalCaption.textContent = caption;
  }

  state.lastImageModalFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  state.lastImageModalTrigger = imageEl;

  modal.hidden = false;
  if (document.body) {
    modal.dataset.previousBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  }

  if (closeButton instanceof HTMLElement) {
    closeButton.focus({ preventScroll: true });
  } else if (modalDialog instanceof HTMLElement) {
    modalDialog.focus({ preventScroll: true });
  }
}

function closeCarImageModal() {
  const modal = byId('carImageModal');
  if (!modal || modal.hidden) return;

  const modalImage = byId('carImageModalImg');
  const modalCaption = byId('carImageModalCaption');
  if (modalImage) {
    modalImage.src = '';
  }
  if (modalCaption) {
    modalCaption.textContent = '';
  }

  modal.hidden = true;
  if (document.body) {
    document.body.style.overflow = modal.dataset.previousBodyOverflow || '';
  }

  const fallbackTarget = state.lastImageModalFocus;
  const triggerTarget = state.lastImageModalTrigger;
  state.lastImageModalFocus = null;
  state.lastImageModalTrigger = null;

  if (triggerTarget instanceof HTMLElement && document.contains(triggerTarget)) {
    triggerTarget.focus({ preventScroll: true });
    return;
  }
  if (fallbackTarget instanceof HTMLElement && document.contains(fallbackTarget)) {
    fallbackTarget.focus({ preventScroll: true });
  }
}

function bindImagePreviewModal() {
  const grid = byId('carRentalGrid');
  const modal = byId('carImageModal');
  const closeButton = byId('carImageModalClose');
  if (!grid || !modal) return;

  if (grid.dataset.ceImagePreviewBound !== '1') {
    grid.dataset.ceImagePreviewBound = '1';

    grid.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const imageEl = target?.closest('.auto-card-image');
      if (!(imageEl instanceof HTMLImageElement)) return;
      openCarImageModalFromImage(imageEl);
    });

    grid.addEventListener('keydown', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!(target instanceof HTMLImageElement) || !target.classList.contains('auto-card-image')) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openCarImageModalFromImage(target);
    });
  }

  if (closeButton && closeButton.dataset.ceImagePreviewBound !== '1') {
    closeButton.dataset.ceImagePreviewBound = '1';
    closeButton.addEventListener('click', () => {
      closeCarImageModal();
    });
  }

  if (modal.dataset.ceImagePreviewBound !== '1') {
    modal.dataset.ceImagePreviewBound = '1';

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeCarImageModal();
      }
    });

    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeCarImageModal();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const modalDialog = modal.querySelector('.car-image-modal__dialog');
      if (!(modalDialog instanceof HTMLElement)) return;

      const focusable = getFocusableElements(modalDialog);
      if (!focusable.length) {
        event.preventDefault();
        modalDialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === modalDialog)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    });
  }
}

async function syncWidgetFromReservationForm() {
  if (!isLandingPage() || state.syncingWidgetToReservation) return;

  const calcPickupDate = byId('pickupDate');
  const calcPickupTime = byId('pickupTime');
  const calcReturnDate = byId('returnDate');
  const calcReturnTime = byId('returnTime');
  const calcPickupLocation = byId('pickupLocation');
  const calcReturnLocation = byId('returnLocation');
  const calcInsurance = byId('fullInsurance');
  const calcYoungDriver = byId('youngDriver');
  const calcCar = byId('rentalCarSelect');

  const resPickupDate = byId('res_pickup_date');
  const resPickupTime = byId('res_pickup_time');
  const resReturnDate = byId('res_return_date');
  const resReturnTime = byId('res_return_time');
  const resPickupLocation = byId('res_pickup_location');
  const resReturnLocation = byId('res_return_location');
  const resInsurance = byId('res_insurance');
  const resYoungDriver = byId('res_young_driver');
  const resCar = byId('res_car');

  let changed = false;

  const syncInputValue = (targetEl, sourceEl) => {
    if (!targetEl || !sourceEl) return;
    const next = String(sourceEl.value || '');
    if (!next || targetEl.value === next) return;
    targetEl.value = next;
    changed = true;
  };

  const syncSelectValue = (targetEl, sourceEl) => {
    if (!targetEl || !sourceEl) return;
    const next = String(sourceEl.value || '').trim();
    if (!next) return;
    const hasOption = Array.from(targetEl.options || []).some((opt) => opt.value === next);
    if (!hasOption || targetEl.value === next) return;
    targetEl.value = next;
    changed = true;
  };

  const syncCheckbox = (targetEl, sourceEl) => {
    if (!targetEl || !sourceEl) return;
    const next = !!sourceEl.checked;
    if (targetEl.checked === next) return;
    targetEl.checked = next;
    changed = true;
  };

  syncInputValue(calcPickupDate, resPickupDate);
  syncInputValue(calcPickupTime, resPickupTime);
  syncInputValue(calcReturnDate, resReturnDate);
  syncInputValue(calcReturnTime, resReturnTime);
  syncSelectValue(calcPickupLocation, resPickupLocation);
  syncSelectValue(calcReturnLocation, resReturnLocation);
  syncCheckbox(calcInsurance, resInsurance);
  syncCheckbox(calcYoungDriver, resYoungDriver);
  syncSelectValue(calcCar, resCar);

  if (!changed) {
    renderSelectedCarHighlight();
    return;
  }

  await refreshLandingFlow();
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
  renderSelectedCarHighlight();
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
  populateReservationLocations();
  ensureDefaultDates();

  window.CE_CAR_ON_CARD_SELECT = () => {
    void refreshLandingFlow();
  };

  bindWidgetHandlers();
  bindReservationHandlers();
  bindImagePreviewModal();
  void refreshLandingFlow();

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler(() => {
      populateWidgetLocations();
      populateReservationLocations();
      void refreshLandingFlow();
    });
  }
}

document.addEventListener('DOMContentLoaded', initLandingController);
