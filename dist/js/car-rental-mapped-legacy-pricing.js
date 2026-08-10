import {
  buildPricingMatrixForOfferRow,
  calculateCarRentalQuote,
} from './car-pricing.js';

export const CAR_LEGACY_COMPAT_PRICING_STRATEGY = 'legacy_compat';

function text(value) {
  return String(value == null ? '' : value).trim();
}

function normalized(value) {
  return text(value).toLowerCase();
}

function cityCode(value) {
  const candidate = normalized(value);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : '';
}

function feeOverride(context, direction) {
  const mode = normalized(context?.[`${direction}FeeMode`]);
  if (mode === 'inherit') return { valid: true, value: null };
  if (mode !== 'override') return { valid: false, value: null };

  const amount = Number(context?.[`${direction}FeePerDirection`]);
  const valid = Number.isFinite(amount)
    && amount >= 0
    && Math.abs((amount * 100) - Math.round(amount * 100)) < 1e-8;
  return {
    valid,
    value: valid ? Number(amount.toFixed(2)) : null,
  };
}

export function isMappedLegacyOffer(offerRow) {
  if (!offerRow || typeof offerRow !== 'object') return false;
  const context = offerRow.pricingContext || offerRow.availabilityContext || null;
  const strategy = normalized(offerRow.pricing_strategy || context?.pricingStrategy || CAR_LEGACY_COMPAT_PRICING_STRATEGY)
    || CAR_LEGACY_COMPAT_PRICING_STRATEGY;
  return strategy === CAR_LEGACY_COMPAT_PRICING_STRATEGY
    && normalized(offerRow.availability_mode || context?.availabilityMode) === 'mapped';
}

export function resolveMappedLegacyPricingContext(offerRow, options = {}) {
  if (!isMappedLegacyOffer(offerRow)) return null;
  const context = offerRow.pricingContext || offerRow.availabilityContext || null;
  const offerId = text(offerRow.id);
  if (!offerId || text(context?.offerId) !== offerId) return null;
  if (normalized(context?.availabilityMode) !== 'mapped') return null;
  if (normalized(context?.pricingStrategy || CAR_LEGACY_COMPAT_PRICING_STRATEGY) !== CAR_LEGACY_COMPAT_PRICING_STRATEGY) {
    return null;
  }

  const calculatorKey = normalized(context?.calculatorKey);
  const legacyBookingLocation = normalized(context?.legacyBookingLocation || calculatorKey);
  if (!['larnaca', 'paphos'].includes(calculatorKey) || legacyBookingLocation !== calculatorKey) return null;

  const pickupCityCode = cityCode(context?.pickupCityCode);
  const returnCityCode = cityCode(context?.returnCityCode);
  if (!pickupCityCode || !returnCityCode) return null;
  const requestedPickupCode = cityCode(options.pickupCityCode);
  const requestedReturnCode = cityCode(options.returnCityCode);
  if (requestedPickupCode && requestedPickupCode !== pickupCityCode) return null;
  if (requestedReturnCode && requestedReturnCode !== returnCityCode) return null;

  const pickupFee = feeOverride(context, 'pickup');
  const returnFee = feeOverride(context, 'return');
  if (!pickupFee.valid || !returnFee.valid) return null;

  const pickupLocation = normalized(
    context.pickupLegacyPricingLocation
      || context.pickupPricingKey
      || context.pickupLegacyPricingKey,
  );
  const returnLocation = normalized(
    context.returnLegacyPricingLocation
      || context.returnPricingKey
      || context.returnLegacyPricingKey,
  );
  if (!pickupLocation || !returnLocation) return null;

  return Object.freeze({
    offerId,
    calculatorKey,
    legacyBookingLocation,
    pickupCityCode,
    returnCityCode,
    pickupLocation,
    returnLocation,
    pickupFeeOverride: pickupFee.value,
    returnFeeOverride: returnFee.value,
  });
}

export function calculateMappedLegacyCarRentalQuote({
  offerRow,
  carModel,
  pickupDateStr,
  returnDateStr,
  pickupTimeStr = '10:00',
  returnTimeStr = '10:00',
  pickupCityCode = '',
  returnCityCode = '',
  pickupLocation = '',
  returnLocation = '',
  fullInsurance = false,
  youngDriver = false,
} = {}) {
  const context = resolveMappedLegacyPricingContext(offerRow, {
    pickupCityCode,
    returnCityCode,
    pickupLocation,
    returnLocation,
  });
  if (!context) return null;
  const pricingMatrix = buildPricingMatrixForOfferRow(offerRow, context.calculatorKey);
  if (!pricingMatrix) return null;

  return calculateCarRentalQuote({
    pricingMatrix,
    offer: context.calculatorKey,
    carModel,
    pickupDateStr,
    returnDateStr,
    pickupTimeStr,
    returnTimeStr,
    pickupLocation: context.pickupLocation,
    returnLocation: context.returnLocation,
    fullInsurance,
    youngDriver,
    offerRow,
    pickupFeeOverride: context.pickupFeeOverride,
    returnFeeOverride: context.returnFeeOverride,
  });
}
