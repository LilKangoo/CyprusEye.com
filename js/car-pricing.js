const PAPHOS_WIDGET_LOCATION_VALUES = new Set(['airport_pfo', 'city_center', 'hotel', 'other']);

export function normalizeOfferLocation(offer) {
  return String(offer || '').toLowerCase() === 'larnaca' ? 'larnaca' : 'paphos';
}

export function normalizeLocationForOffer(locationValue, offerLocation) {
  const normalized = String(locationValue || '').trim();
  if (!normalized) return '';
  if (normalizeOfferLocation(offerLocation) === 'larnaca' && PAPHOS_WIDGET_LOCATION_VALUES.has(normalized)) {
    return 'paphos';
  }
  return normalized;
}

export function getLocationFeeForLarnaca(city) {
  switch (String(city || '').trim()) {
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
}

export function buildPricingMatrixForOfferRow(offerRow, offerLocation) {
  if (!offerRow || typeof offerRow !== 'object') return null;
  const location = normalizeOfferLocation(offerLocation);

  if (location === 'larnaca') {
    const perDay = Number(
      offerRow.price_per_day
      || offerRow.price_10plus_days
      || offerRow.price_7_10days
      || offerRow.price_4_6days
      || 0
    );
    if (!Number.isFinite(perDay) || perDay <= 0) return null;
    return [perDay * 3, perDay, perDay, perDay];
  }

  const matrix = [
    Number(offerRow.price_3days || 0),
    Number(offerRow.price_4_6days || 0),
    Number(offerRow.price_7_10days || 0),
    Number(offerRow.price_10plus_days || 0),
  ];
  if (!matrix.some(v => Number.isFinite(v) && v > 0)) return null;
  return matrix;
}

export function calculateCarRentalQuote({
  pricingMatrix,
  offer,
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
  const normalizedOffer = normalizeOfferLocation(offer);
  const selectedCar = String(carModel || '').trim();
  if (!selectedCar) return null;

  const matrix = Array.isArray(pricingMatrix) ? pricingMatrix : null;
  if (!matrix || matrix.length < 4) return null;

  const pickupDate = new Date(`${pickupDateStr}T${pickupTimeStr || '10:00'}`);
  const returnDate = new Date(`${returnDateStr}T${returnTimeStr || '10:00'}`);
  if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(returnDate.getTime())) return null;

  const hours = (returnDate.getTime() - pickupDate.getTime()) / 36e5;
  const days = Math.ceil(hours / 24);
  if (!Number.isFinite(days) || hours <= 0 || days < 3) return null;

  let basePrice = 0;
  let dailyRate = 0;
  if (days === 3) {
    basePrice = Number(matrix[0]) || 0;
  } else if (days >= 4 && days <= 6) {
    dailyRate = Number(matrix[1]) || 0;
    basePrice = dailyRate * days;
  } else if (days >= 7 && days <= 10) {
    dailyRate = Number(matrix[2]) || 0;
    basePrice = dailyRate * days;
  } else {
    dailyRate = Number(matrix[3]) || 0;
    basePrice = dailyRate * days;
  }

  let pickupLoc = String(pickupLocation || '').trim();
  let returnLoc = String(returnLocation || '').trim();

  if (normalizedOffer === 'larnaca') {
    pickupLoc = normalizeLocationForOffer(pickupLoc, normalizedOffer);
    returnLoc = normalizeLocationForOffer(returnLoc, normalizedOffer);
  }

  const pickupFee = normalizedOffer === 'paphos'
    ? (pickupLoc === 'airport_pfo' && days < 7 ? 10 : 0)
    : getLocationFeeForLarnaca(pickupLoc);
  const returnFee = normalizedOffer === 'paphos'
    ? (returnLoc === 'airport_pfo' && days < 7 ? 10 : 0)
    : getLocationFeeForLarnaca(returnLoc);
  const insuranceCost = fullInsurance ? 17 * days : 0;
  const youngDriverCost = normalizedOffer === 'larnaca' && youngDriver ? 10 * days : 0;

  const total = basePrice + pickupFee + returnFee + insuranceCost + youngDriverCost;
  if (!Number.isFinite(total) || total <= 0) return null;

  return {
    offer: normalizedOffer,
    days,
    basePrice: Number(basePrice.toFixed(2)),
    dailyRate: Number((dailyRate || 0).toFixed(2)),
    pickupFee,
    returnFee,
    insuranceCost,
    youngDriverCost,
    total: Number(total.toFixed(2)),
    car: selectedCar,
    pickupLoc,
    returnLoc,
  };
}
