import { openCarOfferModal } from './car-offer-modal.js';
import {
  buildBlankFinderState,
  buildDeepLinkFinderState,
  coerceReturnLocationForPickup,
  getFinderDurationState,
  isFinderSelectionComplete,
  isPaphosWidgetLocation as isPaphosRouteLocation,
  resolveOfferFromRoute,
} from './car-rental-flow.js';
import {
  findCurrentFleetCarByOfferId,
  findCurrentFleetCarByModel,
  getCurrentFleetRows,
} from './car-rental-paphos.js';

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
  carImageModalPanoramaCleanup: null,
  deepLink: {
    offerId: null,
    offerLocation: null,
    carSlug: null,
    applied: false,
    applying: false,
    modalOpened: false,
  },
  defaultSeo: null,
  refreshInFlight: false,
  refreshQueued: false,
  refreshQueuedForceReload: false,
};

function byId(id) {
  return document.getElementById(id);
}

function readCarDeepLink() {
  try {
    const url = new URL(window.location.href);
    const offerId = String(url.searchParams.get('offer_id') || '').trim() || null;
    const rawLocation = String(url.searchParams.get('offer_location') || '').trim().toLowerCase();
    const offerLocation = rawLocation === 'paphos' || rawLocation === 'larnaca' ? rawLocation : null;
    const rawCar = String(url.searchParams.get('car') || '').trim();
    const carSlug = rawCar ? slugifyCarLabel(rawCar) : null;
    return { offerId, offerLocation, carSlug: carSlug || null };
  } catch (_error) {
    return { offerId: null, offerLocation: null, carSlug: null };
  }
}

function applyCarDeepLinkSelection() {
  if (state.deepLink.applied || state.deepLink.applying) return false;
  const targetOfferId = String(state.deepLink.offerId || '').trim();
  const targetCarSlug = String(state.deepLink.carSlug || '').trim();
  if (!targetOfferId && !targetCarSlug) {
    state.deepLink.applied = true;
    return false;
  }

  state.deepLink.applying = true;
  try {
    const selectByOfferId = (selectEl) => {
      if (!(selectEl instanceof HTMLSelectElement)) return false;
      const options = Array.from(selectEl.options || []);
      const match = options.find((opt) => String(opt?.dataset?.offerId || '').trim() === targetOfferId);
      if (!match) return false;
      selectEl.value = match.value;
      state.deepLink.offerId = String(match?.dataset?.offerId || targetOfferId || '').trim() || state.deepLink.offerId;
      state.deepLink.carSlug = slugifyCarLabel(match.value || targetCarSlug);
      return true;
    };

    const selectByCarSlug = (selectEl) => {
      if (!(selectEl instanceof HTMLSelectElement) || !targetCarSlug) return false;
      const options = Array.from(selectEl.options || []);
      const match = options.find((opt) => slugifyCarLabel(opt.value || opt.textContent || '') === targetCarSlug);
      if (!match) return false;
      selectEl.value = match.value;
      state.deepLink.offerId = String(match?.dataset?.offerId || '').trim() || state.deepLink.offerId;
      state.deepLink.carSlug = slugifyCarLabel(match.value || targetCarSlug);
      return true;
    };

    const calculatorSelect = byId('rentalCarSelect');
    const reservationSelect = byId('res_car');
    const matched =
      (targetOfferId && selectByOfferId(calculatorSelect))
      || (targetOfferId && selectByOfferId(reservationSelect))
      || selectByCarSlug(calculatorSelect)
      || selectByCarSlug(reservationSelect);

    if (!matched) return false;

    if (reservationSelect instanceof HTMLSelectElement && calculatorSelect instanceof HTMLSelectElement) {
      reservationSelect.value = calculatorSelect.value;
    }

    state.deepLink.applied = true;
    return true;
  } finally {
    state.deepLink.applying = false;
  }
}

function maybeOpenDeepLinkModal() {
  if (!state.deepLink.applied || state.deepLink.modalOpened) {
    return;
  }

  const selectedMeta = getSelectedCarOfferMeta();
  if (!selectedMeta) {
    return;
  }

  const selectedOfferId = String(selectedMeta.offerId || '').trim();
  const selectedCarSlug = slugifyCarLabel(selectedMeta.title || '');
  const targetOfferId = String(state.deepLink.offerId || '').trim();
  const targetCarSlug = String(state.deepLink.carSlug || '').trim();
  const isMatch = (targetOfferId && selectedOfferId === targetOfferId)
    || (targetCarSlug && selectedCarSlug === targetCarSlug);

  if (!isMatch) {
    return;
  }

  state.deepLink.modalOpened = true;
  requestAnimationFrame(() => {
    openSelectedLandingCarModal();
  });
}

function isLandingPage() {
  return String(document.body?.dataset?.seoPage || '').toLowerCase() === 'carrentallanding';
}

function currentLang() {
  const lang = (typeof window.getCurrentLanguage === 'function'
    ? window.getCurrentLanguage()
    : (window.appI18n?.language || 'pl'));
  const normalized = String(lang || 'pl').toLowerCase();
  return normalized.startsWith('en') ? 'en' : 'pl';
}

function slugifyCarLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'car-offer';
}

function setMetaValue(selector, value) {
  const element = document.querySelector(selector);
  if (!element || typeof value !== 'string') return;
  element.setAttribute('content', value);
}

function captureDefaultSeo() {
  if (state.defaultSeo) return state.defaultSeo;
  state.defaultSeo = {
    title: String(document.title || '').trim(),
    description: String(document.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim(),
    ogTitle: String(document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '').trim(),
    ogDescription: String(document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '').trim(),
    ogImage: String(document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '').trim(),
    canonical: String(document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '').trim(),
    ogUrl: String(document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '').trim(),
  };
  return state.defaultSeo;
}

function getSelectedCarOfferMeta() {
  const selectEl = byId('rentalCarSelect') || byId('res_car');
  if (!(selectEl instanceof HTMLSelectElement)) return null;
  const selectedOption = selectEl.selectedOptions?.[0] || null;
  const offerId = String(selectedOption?.dataset?.offerId || '').trim();
  const title = String(selectEl.value || '').trim();
  if (!offerId || !title) return null;
  return {
    offerId,
    title,
  };
}

function buildCarOfferDeepLink(language = currentLang()) {
  const meta = getSelectedCarOfferMeta();
  if (!meta) return '';
  const url = new URL('/car.html', window.location.origin);
  url.searchParams.set('offer_id', meta.offerId);
  url.searchParams.set('car', slugifyCarLabel(meta.title));
  if (state.effectiveOffer) {
    url.searchParams.set('offer_location', state.effectiveOffer);
  }
  url.searchParams.set('lang', language === 'en' ? 'en' : 'pl');
  return url.toString();
}

function buildCarListingUrl(language = currentLang()) {
  const url = new URL('/car.html', window.location.origin);
  url.searchParams.set('lang', language === 'en' ? 'en' : 'pl');

  try {
    const currentUrl = new URL(window.location.href);
    const ref = String(currentUrl.searchParams.get('ref') || '').trim();
    if (ref) {
      url.searchParams.set('ref', ref);
    }
  } catch (_) {
    // ignore
  }

  return url.toString();
}

function syncBackToListingLink() {
  const link = byId('carLandingBackToListing');
  if (!(link instanceof HTMLAnchorElement)) return;

  const hasDeepLink = !!(state.deepLink.offerId || state.deepLink.carSlug);
  link.href = buildCarListingUrl(currentLang());
  link.hidden = !hasDeepLink;
}

function updateCarLandingSeo(selectedCarName, cardMetaText, imageUrl) {
  const defaults = captureDefaultSeo();
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const deepLink = buildCarOfferDeepLink(currentLang());
  if (!selectedCarName || !deepLink) {
    if (defaults.title) document.title = defaults.title;
    if (defaults.description) setMetaValue('meta[name="description"]', defaults.description);
    if (defaults.ogTitle) setMetaValue('meta[property="og:title"]', defaults.ogTitle);
    if (defaults.ogDescription) setMetaValue('meta[property="og:description"]', defaults.ogDescription);
    if (defaults.ogImage) setMetaValue('meta[property="og:image"]', defaults.ogImage);
    if (defaults.ogUrl) setMetaValue('meta[property="og:url"]', defaults.ogUrl);
    if (canonicalLink && defaults.canonical) canonicalLink.setAttribute('href', defaults.canonical);
    return;
  }

  const english = currentLang() === 'en';
  const title = english
    ? `${selectedCarName} – CyprusEye car rental`
    : `${selectedCarName} – wynajem auta CyprusEye`;
  const description = String(cardMetaText || '').trim()
    || (english
      ? `Book ${selectedCarName} directly in the CyprusEye car rental calculator.`
      : `Zarezerwuj ${selectedCarName} bezpośrednio w kalkulatorze wynajmu CyprusEye.`);

  document.title = title;
  setMetaValue('meta[name="description"]', description);
  setMetaValue('meta[property="og:title"]', title);
  setMetaValue('meta[property="og:description"]', description);
  setMetaValue('meta[property="og:url"]', deepLink);
  if (imageUrl) {
    setMetaValue('meta[property="og:image"]', imageUrl);
  } else if (defaults.ogImage) {
    setMetaValue('meta[property="og:image"]', defaults.ogImage);
  }
  if (canonicalLink) canonicalLink.setAttribute('href', deepLink);
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

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parsePassengerCount(value, fallback = 2) {
  const fallbackValue = Number.isFinite(Number(fallback)) && Number(fallback) > 0
    ? Math.floor(Number(fallback))
    : 2;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallbackValue;
  return parsed;
}

function ensureDefaultDates() {
  const pickupDate = byId('pickupDate');
  const returnDate = byId('returnDate');
  const pickupLocation = byId('pickupLocation');
  const returnLocation = byId('returnLocation');
  if (!pickupDate || !returnDate || !pickupLocation || !returnLocation) return;

  const hasDeepLink = !!(state.deepLink.offerId || state.deepLink.offerLocation);
  if (!hasDeepLink) {
    return;
  }

  const deepLinkState = buildDeepLinkFinderState(state.deepLink.offerLocation || 'larnaca');
  if (!pickupDate.value) pickupDate.value = deepLinkState.pickupDate;
  if (!returnDate.value) returnDate.value = deepLinkState.returnDate;
  if (!pickupLocation.value) pickupLocation.value = deepLinkState.pickupLocation;
  if (!returnLocation.value) returnLocation.value = deepLinkState.returnLocation;
}

function bindReservationHandlers() {
  const watchedIds = [
    'res_pickup_date',
    'res_pickup_time',
    'res_return_date',
    'res_return_time',
    'res_pickup_location',
    'res_return_location',
    'res_passengers',
    'res_insurance',
    'res_young_driver',
    'res_car',
  ];

  watchedIds.forEach((id) => {
    const el = byId(id);
    if (!el || el.dataset.ceLandingReservationBound === '1') return;

    el.dataset.ceLandingReservationBound = '1';
    el.addEventListener('change', () => {
      if (id === 'res_car') {
        state.deepLink.applied = true;
      }
      void syncWidgetFromReservationForm();
    });

    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => {
        void syncWidgetFromReservationForm();
      });
    }
  });
}

function buildLocationOptionsHtml({ restrictToPaphos = false, includePlaceholder = false } = {}) {
  const larnacaLabel = tr('carRentalLanding.locations.group.islandWide', 'Larnaka / cały Cypr');
  const paphosLabel = tr('carRentalLanding.locations.group.paphosOnly', 'Pafos (tylko oferta Pafos)');

  const larnacaOptions = [
    { value: 'larnaca', label: tr('carRental.locations.larnaca.label', 'Larnaka (bez opłaty)') },
    { value: 'nicosia', label: tr('carRental.locations.nicosia.label', 'Nikozja (+15€)') },
    { value: 'ayia-napa', label: tr('carRental.locations.ayia-napa.label', 'Ayia Napa (+15€)') },
    { value: 'protaras', label: tr('carRental.locations.protaras.label', 'Protaras (+20€)') },
    { value: 'limassol', label: tr('carRental.locations.limassol.label', 'Limassol (+20€)') },
    { value: 'paphos', label: tr('carRental.locations.paphos.label', 'Pafos (+40€)') },
  ];

  const paphosOptions = [
    {
      value: 'airport_pfo',
      label: tr(
        'carRentalLanding.locations.paphos.airport',
        'Pafos Airport (+10€ przy wynajmie < 7 dni)'
      ),
    },
    {
      value: 'city_center',
      label: tr('carRentalLanding.locations.paphos.cityCenter', 'Pafos - centrum miasta'),
    },
    {
      value: 'hotel',
      label: tr('carRentalLanding.locations.paphos.hotel', 'Hotel (w tym Coral Bay / Polis)'),
    },
    {
      value: 'other',
      label: tr('carRentalLanding.locations.paphos.other', 'Inne miejsce (np. Coral Bay / Polis)'),
    },
  ];

  const renderOptions = (items) => items
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join('');

  return `
    ${includePlaceholder ? `<option value="">${tr('carRentalLanding.locations.placeholder', 'Wybierz lokalizację')}</option>` : ''}
    ${restrictToPaphos ? '' : `
    <optgroup label="${larnacaLabel}">
      ${renderOptions(larnacaOptions)}
    </optgroup>`}
    <optgroup label="${paphosLabel}">
      ${renderOptions(paphosOptions)}
    </optgroup>
  `;
}

function setSelectSafe(selectEl, value, fallback) {
  if (!selectEl) return false;
  const previousValue = String(selectEl.value || '');
  const options = Array.from(selectEl.options || []);
  const hasValue = options.some((opt) => opt.value === value);
  if (hasValue) {
    selectEl.value = value;
    return previousValue !== String(selectEl.value || '');
  }
  const hasFallback = options.some((opt) => opt.value === fallback);
  if (hasFallback) {
    selectEl.value = fallback;
    return previousValue !== String(selectEl.value || '');
  }
  return false;
}

function populateWidgetLocations() {
  const pickup = byId('pickupLocation');
  const ret = byId('returnLocation');
  if (!pickup || !ret) return;

  const previousPickup = pickup.value;
  const previousReturn = ret.value;
  pickup.innerHTML = buildLocationOptionsHtml({ includePlaceholder: true });
  setSelectSafe(pickup, previousPickup || '', '');

  const normalizedReturn = coerceReturnLocationForPickup(pickup.value, previousReturn || '');
  ret.innerHTML = buildLocationOptionsHtml({
    includePlaceholder: true,
    restrictToPaphos: isPaphosRouteLocation(pickup.value),
  });
  setSelectSafe(ret, normalizedReturn || previousReturn || '', '');
}

function populateReservationLocations() {
  const pickup = byId('res_pickup_location');
  const ret = byId('res_return_location');
  if (!pickup || !ret) return;

  const previousPickup = pickup.value;
  const previousReturn = ret.value;
  pickup.innerHTML = buildLocationOptionsHtml({ includePlaceholder: true });
  setSelectSafe(pickup, previousPickup || '', '');

  const normalizedReturn = coerceReturnLocationForPickup(pickup.value, previousReturn || '');
  ret.innerHTML = buildLocationOptionsHtml({
    includePlaceholder: true,
    restrictToPaphos: isPaphosRouteLocation(pickup.value),
  });
  setSelectSafe(ret, normalizedReturn || previousReturn || '', '');
}

function readWidgetState() {
  const reservationPassengers = parsePassengerCount(byId('res_passengers')?.value, 2);
  return {
    pickupDate: byId('pickupDate')?.value || '',
    pickupTime: byId('pickupTime')?.value || '10:00',
    returnDate: byId('returnDate')?.value || '',
    returnTime: byId('returnTime')?.value || '10:00',
    pickupLocation: byId('pickupLocation')?.value || '',
    returnLocation: byId('returnLocation')?.value || '',
    passengers: parsePassengerCount(byId('rentalPassengers')?.value, reservationPassengers),
    fullInsurance: !!byId('fullInsurance')?.checked,
    youngDriver: !!byId('youngDriver')?.checked,
    carModel: byId('rentalCarSelect')?.value || '',
  };
}

function isPaphosWidgetLocation(locationValue) {
  return isPaphosRouteLocation(locationValue);
}

function mapToLarnacaLocation(locationValue) {
  return isPaphosWidgetLocation(locationValue) ? 'paphos' : String(locationValue || '').trim();
}

function evaluateOffer(widgetState) {
  const resolvedOffer = resolveOfferFromRoute(widgetState.pickupLocation, widgetState.returnLocation);
  state.autoOffer = resolvedOffer;
  state.paphosEligible = resolvedOffer === 'paphos';
  state.manualOffer = null;
  state.effectiveOffer = resolvedOffer;
}

function renderOfferIndicators(widgetState) {
  const badge = byId('landingActiveOfferBadge');
  const info = byId('landingOfferInfo');

  const offerName = state.effectiveOffer === 'paphos'
    ? tr('carRentalLanding.offer.name.paphos', 'Pafos')
    : tr('carRentalLanding.offer.name.larnaca', 'Larnaka');

  if (badge) {
    badge.textContent = tr('carRentalLanding.offer.badge', 'Oferta: {{offer}}', { offer: offerName });
  }

  if (!info) return;

  if (!isFinderSelectionComplete(widgetState)) {
    info.textContent = tr(
      'carRentalLanding.offer.info.incomplete',
      'Wybierz daty i trasę. Oferta oraz lista aut odblokują się automatycznie po uzupełnieniu finderu.',
    );
    return;
  }

  const duration = getFinderDurationState(widgetState);
  if (!duration.ready) {
    info.textContent = duration.reason === 'minimum_days'
      ? tr(
        'carRentalLanding.offer.info.minimumDays',
        'Minimalny wynajem to 3 dni. Wydłuż termin, aby zobaczyć dostępne auta.',
      )
      : tr(
        'carRentalLanding.offer.info.invalidRange',
        'Data zwrotu musi być późniejsza niż data odbioru, aby pokazać auta.',
      );
    return;
  }

  if (state.effectiveOffer === 'paphos') {
    info.textContent = tr(
      'carRentalLanding.offer.info.paphosActive',
      'Aktywna oferta Pafos. Ta lokalna flota działa tylko przy odbiorze i zwrocie w strefie Pafos.',
    );
    return;
  }

  info.textContent = tr(
    'carRentalLanding.offer.info.larnacaAuto',
    'Aktywna oferta Larnaka / cały Cypr. To domyślna flota dla wszystkich tras poza lokalną strefą Pafos.',
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
    passengers: widgetState.passengers,
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
    ? tr('carRentalLanding.offer.name.paphos', 'Pafos')
    : tr('carRentalLanding.offer.name.larnaca', 'Larnaka');

  const modeDescription = widgetState.youngDriver
    ? tr('carRentalLanding.reservation.offerMode.youngDriver', 'młody kierowca aktywny')
    : state.paphosEligible && state.effectiveOffer === 'paphos'
      ? tr('carRentalLanding.reservation.offerMode.paphosZone', 'strefa Pafos')
      : state.paphosEligible && state.effectiveOffer === 'larnaca'
        ? tr('carRentalLanding.reservation.offerMode.manualChoice', 'wybór ręczny')
        : tr('carRentalLanding.reservation.offerMode.autoSwitch', 'auto-switch');

  indicator.textContent = tr(
    'carRentalLanding.reservation.offerIndicator',
    'Aktywna oferta: {{offer}} • {{mode}}',
    {
      offer: offerName,
      mode: modeDescription,
    }
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
    updateCarLandingSeo('', '', '');
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
    meta.textContent = cardMeta || tr('carRentalLanding.selectedCar.ready', 'Wybrane auto jest gotowe do rezerwacji.');
  }

  if (price) {
    price.textContent = cardPrice || (quoteTotal
      ? tr('carRentalLanding.selectedCar.estimated', 'Szacunkowo: {{total}}', { total: quoteTotal })
      : '');
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
      ? tr('carRentalLanding.offer.button.paphos', 'Oferta Pafos')
      : tr('carRentalLanding.offer.button.larnaca', 'Oferta Larnaka');
  }

  panel.hidden = false;
  updateCarLandingSeo(
    selectedCar,
    cardMeta || '',
    cardImage?.getAttribute('src') ? String(cardImage.getAttribute('src')) : ''
  );
}

function applyLandingLocationRules() {
  const pickup = byId('pickupLocation');
  const ret = byId('returnLocation');
  if (!pickup || !ret) return;

  const previousReturn = ret.value;
  ret.innerHTML = buildLocationOptionsHtml({
    includePlaceholder: true,
    restrictToPaphos: isPaphosRouteLocation(pickup.value),
  });
  const normalizedReturn = coerceReturnLocationForPickup(pickup.value, previousReturn || '');
  setSelectSafe(ret, normalizedReturn || previousReturn || '', '');
}

function isLandingFinderReady(widgetState) {
  return isFinderSelectionComplete(widgetState) && getFinderDurationState(widgetState).ready;
}

function applyLandingVisibility(widgetState) {
  const finderReady = isLandingFinderReady(widgetState);
  const grid = byId('carRentalGrid');
  const select = byId('rentalCarSelect');
  const highlight = byId('selectedCarHighlight');
  const result = byId('carRentalResult');
  const breakdown = byId('carRentalBreakdown');
  const message = byId('carRentalMessage');

  if (grid) {
    grid.hidden = !finderReady;
  }

  if (select) {
    select.disabled = !finderReady;
  }

  if (!finderReady) {
    if (highlight) highlight.hidden = true;
    if (result) result.textContent = '';
    if (breakdown) breakdown.innerHTML = '';
    if (message) {
      const duration = getFinderDurationState(widgetState);
      if (!isFinderSelectionComplete(widgetState)) {
        message.textContent = tr(
          'carRentalLanding.calculator.selectRouteFirst',
          'Wybierz daty oraz trasę, aby zobaczyć dostępne auta.',
        );
      } else if (duration.reason === 'minimum_days') {
        message.textContent = tr(
          'carRentalLanding.offer.info.minimumDays',
          'Minimalny wynajem to 3 dni. Wydłuż termin, aby zobaczyć dostępne auta.',
        );
      } else if (duration.reason === 'return_before_pickup') {
        message.textContent = tr(
          'carRentalLanding.offer.info.invalidRange',
          'Data zwrotu musi być późniejsza niż data odbioru, aby pokazać auta.',
        );
      }
      message.classList.toggle('is-error', true);
    }
    updateCarLandingSeo('', '', '');
    return false;
  }

  if (message && message.classList.contains('is-error')) {
    message.textContent = '';
    message.classList.remove('is-error');
  }

  return true;
}

function buildLandingModalPrefill(widgetState) {
  return {
    pickupDate: widgetState.pickupDate,
    pickupTime: widgetState.pickupTime,
    returnDate: widgetState.returnDate,
    returnTime: widgetState.returnTime,
    pickupLocation: state.effectiveOffer === 'paphos'
      ? widgetState.pickupLocation
      : mapToLarnacaLocation(widgetState.pickupLocation),
    returnLocation: state.effectiveOffer === 'paphos'
      ? widgetState.returnLocation
      : mapToLarnacaLocation(widgetState.returnLocation),
    fullInsurance: !!widgetState.fullInsurance,
    youngDriver: state.effectiveOffer === 'larnaca' && !!widgetState.youngDriver,
    passengers: parsePassengerCount(widgetState.passengers, 2),
  };
}

function openSelectedLandingCarModal() {
  const widgetState = readWidgetState();
  if (!applyLandingVisibility(widgetState)) return;

  const selectedMeta = getSelectedCarOfferMeta();
  const selectedModel = String(selectedMeta?.title || widgetState.carModel || byId('rentalCarSelect')?.value || '').trim();
  if (!selectedModel) return;

  const selectedCar = findCurrentFleetCarByOfferId(selectedMeta?.offerId)
    || findCurrentFleetCarByModel(selectedModel);
  if (!selectedCar) return;

  openCarOfferModal({
    car: selectedCar,
    location: state.effectiveOffer,
    fleetByLocation: {
      [state.effectiveOffer]: getCurrentFleetRows(),
    },
    prefill: buildLandingModalPrefill(widgetState),
  });
}

function syncReservationForm(widgetState) {
  const resPickupDate = byId('res_pickup_date');
  const resPickupTime = byId('res_pickup_time');
  const resReturnDate = byId('res_return_date');
  const resReturnTime = byId('res_return_time');
  const resPickupLocation = byId('res_pickup_location');
  const resReturnLocation = byId('res_return_location');
  const resPassengers = byId('res_passengers');
  const resInsurance = byId('res_insurance');
  const resYoungDriver = byId('res_young_driver');
  const resCar = byId('res_car');
  const calcCar = byId('rentalCarSelect');

  populateReservationLocations();

  state.syncingWidgetToReservation = true;
  try {
    const changedFieldIds = [];
    const setInputIfChanged = (inputEl, nextValue, fieldId) => {
      if (!inputEl) return;
      const normalized = String(nextValue || '');
      if (String(inputEl.value || '') === normalized) return;
      inputEl.value = normalized;
      if (fieldId) changedFieldIds.push(fieldId);
    };
    const setCheckboxIfChanged = (checkboxEl, nextValue, fieldId) => {
      if (!checkboxEl) return;
      const normalized = !!nextValue;
      if (!!checkboxEl.checked === normalized) return;
      checkboxEl.checked = normalized;
      if (fieldId) changedFieldIds.push(fieldId);
    };

    setInputIfChanged(resPickupDate, widgetState.pickupDate, 'res_pickup_date');
    setInputIfChanged(resPickupTime, widgetState.pickupTime, 'res_pickup_time');
    setInputIfChanged(resReturnDate, widgetState.returnDate, 'res_return_date');
    setInputIfChanged(resReturnTime, widgetState.returnTime, 'res_return_time');

    const pickupForReservation = state.effectiveOffer === 'larnaca'
      ? mapToLarnacaLocation(widgetState.pickupLocation)
      : widgetState.pickupLocation;
    const returnForReservation = state.effectiveOffer === 'larnaca'
      ? mapToLarnacaLocation(widgetState.returnLocation)
      : widgetState.returnLocation;

    if (setSelectSafe(resPickupLocation, pickupForReservation, 'larnaca')) {
      changedFieldIds.push('res_pickup_location');
    }
    if (setSelectSafe(resReturnLocation, returnForReservation, 'larnaca')) {
      changedFieldIds.push('res_return_location');
    }

    if (resPassengers) {
      setInputIfChanged(resPassengers, String(parsePassengerCount(widgetState.passengers, 2)), 'res_passengers');
    }

    if (resInsurance) {
      setCheckboxIfChanged(resInsurance, widgetState.fullInsurance, 'res_insurance');
    }

    if (resYoungDriver) {
      const canUseYoungDriver = state.effectiveOffer === 'larnaca';
      setCheckboxIfChanged(resYoungDriver, canUseYoungDriver && widgetState.youngDriver, 'res_young_driver');
      const previousDisabled = !!resYoungDriver.disabled;
      resYoungDriver.disabled = !canUseYoungDriver;
      resYoungDriver.setAttribute('aria-disabled', canUseYoungDriver ? 'false' : 'true');
      if (previousDisabled !== !!resYoungDriver.disabled) {
        changedFieldIds.push('res_young_driver');
      }
    }

    if (resCar && calcCar && calcCar.value) {
      if (setSelectSafe(resCar, calcCar.value, resCar.value || '')) {
        changedFieldIds.push('res_car');
      }
    }

    renderReservationOfferIndicator(widgetState);

    Array.from(new Set(changedFieldIds)).forEach((fieldId) => {
      dispatchChange(fieldId);
    });
  } finally {
    state.syncingWidgetToReservation = false;
  }
}

function openCarImageModalFromImage(imageEl) {
  const modal = byId('carImageModal');
  const modalImage = byId('carImageModalImg');
  const modalPanorama = byId('carImageModalPano');
  const modalCaption = byId('carImageModalCaption');
  const closeButton = byId('carImageModalClose');
  const modalDialog = modal?.querySelector('.car-image-modal__dialog');
  if (!modal || !modalImage || !imageEl) return;

  const src = String(imageEl.getAttribute('src') || '').trim();
  if (!src) return;

  const alt = String(imageEl.getAttribute('alt') || tr('carRentalLanding.imageModal.imageAlt', 'Podgląd auta'));
  const caption = String(imageEl.dataset.previewTitle || alt);
  const mediaViewer = window.CE_MEDIA_VIEWER;
  const displayUrl = mediaViewer?.getDisplayUrl?.(src) || src;
  const isPanorama = Boolean(mediaViewer?.isPanorama?.(src));

  if (state.carImageModalPanoramaCleanup) {
    try {
      state.carImageModalPanoramaCleanup();
    } catch (_) {
      // ignore cleanup error
    }
    state.carImageModalPanoramaCleanup = null;
  } else if (modalPanorama && mediaViewer?.destroyPanorama) {
    mediaViewer.destroyPanorama(modalPanorama);
  }

  modalImage.src = displayUrl;
  modalImage.alt = alt;
  modalImage.hidden = isPanorama;
  if (modalPanorama) {
    modalPanorama.hidden = !isPanorama;
    modalPanorama.dataset.cePanoramaActive = '0';
  }
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

  if (isPanorama && modalPanorama && mediaViewer?.mountPanorama) {
    mediaViewer.mountPanorama(modalPanorama, src)
      .then((mounted) => {
        if (mounted?.isPanorama) {
          state.carImageModalPanoramaCleanup = mounted.destroy;
        }
      })
      .catch((error) => {
        console.warn('Car modal panorama mount failed:', error);
        modalPanorama.hidden = true;
        modalPanorama.dataset.cePanoramaActive = '0';
        modalImage.hidden = false;
      });
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
  const modalPanorama = byId('carImageModalPano');
  const modalCaption = byId('carImageModalCaption');
  const mediaViewer = window.CE_MEDIA_VIEWER;
  if (state.carImageModalPanoramaCleanup) {
    try {
      state.carImageModalPanoramaCleanup();
    } catch (_) {
      // ignore cleanup error
    }
    state.carImageModalPanoramaCleanup = null;
  } else if (modalPanorama && mediaViewer?.destroyPanorama) {
    mediaViewer.destroyPanorama(modalPanorama);
  }
  if (modalImage) {
    modalImage.src = '';
    modalImage.hidden = false;
  }
  if (modalPanorama) {
    modalPanorama.hidden = true;
    modalPanorama.dataset.cePanoramaActive = '0';
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
  const calcPassengers = byId('rentalPassengers');
  const calcInsurance = byId('fullInsurance');
  const calcYoungDriver = byId('youngDriver');
  const calcCar = byId('rentalCarSelect');

  const resPickupDate = byId('res_pickup_date');
  const resPickupTime = byId('res_pickup_time');
  const resReturnDate = byId('res_return_date');
  const resReturnTime = byId('res_return_time');
  const resPickupLocation = byId('res_pickup_location');
  const resReturnLocation = byId('res_return_location');
  const resPassengers = byId('res_passengers');
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
  syncInputValue(calcPassengers, resPassengers);
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

async function runLandingFlow({ forceReload = false } = {}) {
  if (!isLandingPage()) return;

  const initialWidgetState = readWidgetState();
  const previousOffer = state.effectiveOffer;

  evaluateOffer(initialWidgetState);
  renderOfferIndicators(initialWidgetState);
  updateLandingQuoteContext(initialWidgetState);
  const finderReady = applyLandingVisibility(initialWidgetState);

  const offerChanged = previousOffer !== state.effectiveOffer;
  if (forceReload || offerChanged) {
    await switchOfferIfNeeded();
  } else if (typeof window.CE_CAR_RERENDER_FLEET === 'function') {
    window.CE_CAR_RERENDER_FLEET();
  }

  const fleetReloadedViaLoader = (forceReload || offerChanged) && typeof window.CE_CAR_LOAD_FLEET === 'function';
  if (!fleetReloadedViaLoader && typeof window.CE_CAR_UPDATE_CALC_OPTIONS === 'function') {
    window.CE_CAR_UPDATE_CALC_OPTIONS();
  }

  if (finderReady) {
    applyCarDeepLinkSelection();
  }

  const widgetState = readWidgetState();
  updateLandingQuoteContext(widgetState);

  const canRenderFleet = applyLandingVisibility(widgetState);
  if (canRenderFleet && typeof window.calculatePrice === 'function') {
    window.calculatePrice();
  }

  syncReservationForm(widgetState);
  if (canRenderFleet) {
    renderSelectedCarHighlight();
    maybeOpenDeepLinkModal();
  }
}

async function refreshLandingFlow({ forceReload = false } = {}) {
  if (!isLandingPage()) return;

  const normalizedForceReload = !!forceReload;
  if (state.refreshInFlight) {
    state.refreshQueued = true;
    state.refreshQueuedForceReload = state.refreshQueuedForceReload || normalizedForceReload;
    return;
  }

  state.refreshInFlight = true;
  try {
    await runLandingFlow({ forceReload: normalizedForceReload });
  } finally {
    state.refreshInFlight = false;
    if (state.refreshQueued) {
      const nextForceReload = state.refreshQueuedForceReload;
      state.refreshQueued = false;
      state.refreshQueuedForceReload = false;
      queueMicrotask(() => {
        void refreshLandingFlow({ forceReload: nextForceReload });
      });
    }
  }
}

function bindWidgetHandlers() {
  const watchedIds = [
    'pickupDate',
    'pickupTime',
    'returnDate',
    'returnTime',
    'pickupLocation',
    'returnLocation',
    'rentalPassengers',
    'fullInsurance',
    'youngDriver',
    'rentalCarSelect',
  ];

  watchedIds.forEach((id) => {
    const el = byId(id);
    if (!el || el.dataset.ceLandingBound === '1') return;

    el.dataset.ceLandingBound = '1';
    el.addEventListener('change', () => {
      if (id === 'pickupLocation') {
        applyLandingLocationRules();
      }
      if (id === 'rentalCarSelect') {
        state.deepLink.applied = true;
      }
      void refreshLandingFlow();
    });

    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => {
        if (id === 'rentalCarSelect') {
          state.deepLink.applied = true;
        }
        void refreshLandingFlow();
      });
    }
  });

}

function initLandingController() {
  if (!isLandingPage()) return;

  captureDefaultSeo();
  state.deepLink = readCarDeepLink();
  state.deepLink.modalOpened = false;
  syncBackToListingLink();

  populateWidgetLocations();
  populateReservationLocations();
  ensureDefaultDates();
  applyLandingLocationRules();

  window.CE_CAR_ON_CARD_SELECT = (payload = {}) => {
    const source = String(payload?.source || '').trim().toLowerCase();
    if (source === 'user') {
      state.deepLink.applied = true;
    }
    if (source === 'deep-link' && state.deepLink.applied) {
      return;
    }
    void refreshLandingFlow();
  };

  bindWidgetHandlers();
  bindReservationHandlers();
  bindImagePreviewModal();
  window.addEventListener('ce:car-fleet-ready', () => {
    void refreshLandingFlow();
  });
  void refreshLandingFlow();

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler(() => {
      syncBackToListingLink();
      populateWidgetLocations();
      populateReservationLocations();
      applyLandingLocationRules();
      void refreshLandingFlow();
    });
  }
}

document.addEventListener('DOMContentLoaded', initLandingController);
