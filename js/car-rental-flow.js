export const PAPHOS_WIDGET_LOCATIONS = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);
export const CAR_CITY_VALUES = ['larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'];
export const CAR_CITY_SET = new Set(CAR_CITY_VALUES);
export const CAR_PLACE_TYPES = ['airport', 'hotel', 'address'];

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isPaphosWidgetLocation(value) {
  return PAPHOS_WIDGET_LOCATIONS.has(String(value || '').trim());
}

export function normalizePaphosWidgetLocation(value, fallback = 'hotel') {
  const normalized = String(value || '').trim();
  if (isPaphosWidgetLocation(normalized)) return normalized;
  return String(fallback || 'hotel').trim() || 'hotel';
}

export function normalizeCarCity(value, fallback = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (CAR_CITY_SET.has(normalized)) return normalized;
  if (PAPHOS_WIDGET_LOCATIONS.has(normalized)) return 'paphos';
  if (normalized === 'airport_lca') return 'larnaca';
  const safeFallback = String(fallback || '').trim().toLowerCase();
  return CAR_CITY_SET.has(safeFallback) ? safeFallback : '';
}

export function normalizeCarFleet(value, fallback = 'larnaca') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'paphos') return 'paphos';
  if (normalized === 'larnaca') return 'larnaca';
  return fallback === 'paphos' ? 'paphos' : 'larnaca';
}

export function normalizeCarPlaceType(value, fallback = 'hotel') {
  const normalized = String(value || '').trim().toLowerCase();
  if (CAR_PLACE_TYPES.includes(normalized)) return normalized;
  if (normalized === 'airport_pfo' || normalized === 'airport_lca') return 'airport';
  if (normalized === 'other' || normalized === 'city_center') return 'address';
  const safeFallback = String(fallback || '').trim().toLowerCase();
  return CAR_PLACE_TYPES.includes(safeFallback) ? safeFallback : 'hotel';
}

export function getAllowedCarPlaceTypes(city) {
  const normalizedCity = normalizeCarCity(city, 'larnaca');
  if (normalizedCity === 'larnaca' || normalizedCity === 'paphos') {
    return ['airport', 'hotel', 'address'];
  }
  return ['hotel', 'address'];
}

export function coerceCarPlaceTypeForCity(city, placeType, fallback = 'hotel') {
  const allowed = getAllowedCarPlaceTypes(city);
  const normalizedType = normalizeCarPlaceType(placeType, fallback);
  if (allowed.includes(normalizedType)) return normalizedType;
  return allowed.includes(fallback) ? fallback : allowed[0];
}

export function resolveCarFleet(pickupCity, returnCity, youngDriver = false) {
  const pickup = normalizeCarCity(pickupCity);
  const ret = normalizeCarCity(returnCity);
  const routeOffer = pickup === 'paphos' && ret === 'paphos' ? 'paphos' : 'larnaca';
  const forcedToLarnaca = !!youngDriver && routeOffer === 'paphos';
  const effectiveOffer = forcedToLarnaca ? 'larnaca' : routeOffer;

  return {
    pickupCity: pickup,
    returnCity: ret,
    routeOffer,
    effectiveOffer,
    paphosEligible: routeOffer === 'paphos',
    forcedToLarnaca,
  };
}

export function mapCityToLegacyLocationForPricing(city, fleetSource = 'larnaca', placeType = 'hotel') {
  const normalizedCity = normalizeCarCity(city, 'larnaca');
  const normalizedFleet = normalizeCarFleet(fleetSource);
  const normalizedType = coerceCarPlaceTypeForCity(normalizedCity, placeType);

  if (normalizedFleet === 'paphos') {
    if (normalizedType === 'airport') return 'airport_pfo';
    if (normalizedType === 'address') return 'other';
    return 'hotel';
  }

  return normalizedCity || 'larnaca';
}

export function inferCarCityFromLegacyLocation(value, fallback = 'larnaca') {
  return normalizeCarCity(value, fallback);
}

export function inferCarPlaceTypeFromLegacyLocation(value, details = {}) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'airport_pfo' || normalized === 'airport_lca') return 'airport';
  if (normalized === 'hotel') return 'hotel';
  if (normalized === 'other' || normalized === 'city_center') return 'address';
  if (String(details?.flightNumber || '').trim()) return 'airport';
  if (String(details?.address || '').trim()) return 'address';
  return 'hotel';
}

export function resolveOfferFromRoute(pickupLocation, returnLocation) {
  return resolveOfferState(pickupLocation, returnLocation).routeOffer;
}

export function resolveOfferState(pickupLocation, returnLocation, options = {}) {
  return resolveCarFleet(pickupLocation, returnLocation, !!options?.youngDriver);
}

export function buildBlankFinderState() {
  return {
    pickupDate: '',
    pickupTime: '10:00',
    returnDate: '',
    returnTime: '10:00',
    pickupLocation: '',
    returnLocation: '',
    fullInsurance: false,
    youngDriver: false,
    passengers: 2,
  };
}

export function buildDefaultDatesState() {
  const pickup = new Date();
  pickup.setDate(pickup.getDate() + 7);
  const ret = new Date(pickup.getTime());
  ret.setDate(ret.getDate() + 3);

  return {
    pickupDate: toDateInputValue(pickup),
    pickupTime: '10:00',
    returnDate: toDateInputValue(ret),
    returnTime: '10:00',
  };
}

export function buildDeepLinkFinderState(offerLocation = 'larnaca') {
  const location = String(offerLocation || '').trim().toLowerCase() === 'paphos' ? 'paphos' : 'larnaca';
  return {
    ...buildBlankFinderState(),
    ...buildDefaultDatesState(),
    pickupLocation: location,
    returnLocation: location,
  };
}

export function isFinderSelectionComplete(state) {
  const candidate = state && typeof state === 'object' ? state : {};
  return Boolean(
    String(candidate.pickupDate || '').trim()
    && String(candidate.returnDate || '').trim()
    && String(candidate.pickupLocation || '').trim()
    && String(candidate.returnLocation || '').trim()
  );
}

export function getFinderDurationState(state) {
  const pickupDate = String(state?.pickupDate || '').trim();
  const returnDate = String(state?.returnDate || '').trim();
  const pickupTime = String(state?.pickupTime || '10:00').trim() || '10:00';
  const returnTime = String(state?.returnTime || '10:00').trim() || '10:00';

  if (!pickupDate || !returnDate) {
    return { ready: false, reason: 'missing_dates' };
  }

  const pickup = new Date(`${pickupDate}T${pickupTime}`);
  const ret = new Date(`${returnDate}T${returnTime}`);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(ret.getTime())) {
    return { ready: false, reason: 'invalid_dates' };
  }

  const hours = (ret.getTime() - pickup.getTime()) / 36e5;
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ready: false, reason: 'return_before_pickup' };
  }

  const days = Math.ceil(hours / 24);
  if (!Number.isFinite(days) || days < 3) {
    return { ready: false, reason: 'minimum_days', days };
  }

  return { ready: true, hours, days };
}

export function coerceReturnLocationForPickup(pickupLocation, returnLocation) {
  const pickup = String(pickupLocation || '').trim();
  const currentReturn = String(returnLocation || '').trim();

  if (isPaphosWidgetLocation(pickup)) {
    return isPaphosWidgetLocation(currentReturn)
      ? currentReturn
      : 'hotel';
  }

  if (!currentReturn) return '';
  return isPaphosWidgetLocation(currentReturn) ? 'larnaca' : currentReturn;
}
