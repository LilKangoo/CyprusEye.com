export const PAPHOS_WIDGET_LOCATIONS = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

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

export function resolveOfferFromRoute(pickupLocation, returnLocation) {
  return isPaphosWidgetLocation(pickupLocation) && isPaphosWidgetLocation(returnLocation)
    ? 'paphos'
    : 'larnaca';
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
    pickupLocation: location === 'paphos' ? 'hotel' : 'larnaca',
    returnLocation: location === 'paphos' ? 'hotel' : 'larnaca',
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
