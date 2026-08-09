import { getLocationFeeForLarnaca } from './car-pricing.js';
import {
  buildRentalInstantsFromLocalDateTimes,
  calculateRentalDaysFromInstants,
} from './car-rental-duration-contract.js';

export const CAR_THRESHOLD_PRICING_STRATEGY = 'threshold_daily_rate';
const MONEY_PRECISION = 100;
const DAILY_RATE_PRECISION = 1000000;
const STANDARD_FEE_CITY_CODES = new Set([
  'larnaca',
  'nicosia',
  'ayia-napa',
  'protaras',
  'limassol',
  'paphos',
]);

function text(value) {
  return String(value == null ? '' : value).trim();
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.round((number + Number.EPSILON) * MONEY_PRECISION) / MONEY_PRECISION
    : null;
}

function dailyRate(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.round((number + Number.EPSILON) * DAILY_RATE_PRECISION) / DAILY_RATE_PRECISION
    : null;
}

export function normalizeThresholdCityCode(value) {
  const code = text(value).toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) ? code : '';
}

export function selectThresholdDailyRateTier(tiers, rentalDays) {
  const days = Number(rentalDays);
  if (!Number.isInteger(days) || days < 1) return null;
  const eligible = (Array.isArray(tiers) ? tiers : [])
    .filter((tier) => tier?.is_active !== false)
    .map((tier) => ({
      ...tier,
      thresholdDays: Number(tier?.threshold_days),
      dailyRate: dailyRate(tier?.daily_rate),
    }))
    .filter((tier) => Number.isInteger(tier.thresholdDays)
      && tier.thresholdDays > 0
      && Number.isFinite(tier.dailyRate)
      && tier.dailyRate > 0
      && tier.thresholdDays <= days)
    .sort((left, right) => right.thresholdDays - left.thresholdDays);
  return eligible[0] || null;
}

function resolveFee(availability, cityCode) {
  const mode = text(availability?.fee_mode).toLowerCase() === 'override' ? 'override' : 'inherit';
  if (mode === 'override') {
    const amount = money(availability?.fee_per_direction);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return { mode, amount };
  }
  if (!STANDARD_FEE_CITY_CODES.has(cityCode)) return null;
  return { mode, amount: money(getLocationFeeForLarnaca(cityCode)) };
}

function resolveInsurance(offer, fullInsurance, rentalDays) {
  const mode = text(offer?.insurance_mode || 'legacy_optional_daily').toLowerCase();
  if (mode === 'included') {
    return { valid: true, mode, selected: false, dailyRate: 0, cost: 0 };
  }
  if (mode === 'not_offered') {
    return { valid: fullInsurance !== true, mode, selected: false, dailyRate: 0, cost: 0 };
  }
  if (!['legacy_optional_daily', 'optional_daily'].includes(mode)) return { valid: false };
  const configured = money(offer?.insurance_per_day);
  const dailyRate = mode === 'legacy_optional_daily' && !(Number.isFinite(configured) && configured >= 0)
    ? 17
    : configured;
  if (!Number.isFinite(dailyRate) || dailyRate < 0) return { valid: false };
  const selected = fullInsurance === true;
  return {
    valid: true,
    mode,
    selected,
    dailyRate,
    cost: selected ? money(dailyRate * rentalDays) : 0,
  };
}

function resolveYoungDriver(offer, selected, rentalDays) {
  const enabled = offer?.young_driver_fee === true;
  const dailyRate = enabled ? money(offer?.young_driver_cost) : 0;
  if (enabled && (!Number.isFinite(dailyRate) || dailyRate < 0)) return { valid: false };
  if (selected === true && !enabled) return { valid: false };
  return {
    valid: true,
    enabled,
    selected: selected === true,
    dailyRate: dailyRate || 0,
    cost: selected === true ? money((dailyRate || 0) * rentalDays) : 0,
  };
}

export function calculateThresholdCarRentalQuote({
  offer,
  tiers,
  pickupDateStr,
  pickupTimeStr = '10:00',
  returnDateStr,
  returnTimeStr = '10:00',
  pickupCityCode,
  returnCityCode,
  pickupAvailability,
  returnAvailability,
  fullInsurance = false,
  youngDriver = false,
  carModel = '',
} = {}) {
  if (!offer || text(offer.pricing_strategy) !== CAR_THRESHOLD_PRICING_STRATEGY) return null;
  const pickupCode = normalizeThresholdCityCode(pickupCityCode);
  const returnCode = normalizeThresholdCityCode(returnCityCode);
  if (!pickupCode || !returnCode) return null;

  let instants;
  try {
    instants = buildRentalInstantsFromLocalDateTimes({
      pickupDate: pickupDateStr,
      pickupTime: pickupTimeStr,
      returnDate: returnDateStr,
      returnTime: returnTimeStr,
    });
  } catch (_error) {
    return null;
  }
  const rentalDays = calculateRentalDaysFromInstants(instants.pickupInstant, instants.returnInstant);
  if (!rentalDays) return null;
  const minimum = Number(offer.min_rental_days);
  const maximum = offer.max_rental_days == null || offer.max_rental_days === ''
    ? null
    : Number(offer.max_rental_days);
  if (!Number.isInteger(minimum) || minimum < 1 || rentalDays < minimum) return null;
  if (maximum != null && (!Number.isInteger(maximum) || maximum < minimum || rentalDays > maximum)) return null;

  const tier = selectThresholdDailyRateTier(tiers, rentalDays);
  if (!tier || tier.thresholdDays < minimum) return null;
  const pickupFee = resolveFee(pickupAvailability, pickupCode);
  const returnFee = resolveFee(returnAvailability, returnCode);
  if (!pickupFee || !returnFee) return null;
  const insurance = resolveInsurance(offer, fullInsurance, rentalDays);
  const young = resolveYoungDriver(offer, youngDriver, rentalDays);
  if (!insurance.valid || !young.valid) return null;

  const basePrice = money(tier.dailyRate * rentalDays);
  const total = money(basePrice + pickupFee.amount + returnFee.amount + insurance.cost + young.cost);
  if (!Number.isFinite(total) || total <= 0) return null;

  const pricingSnapshot = Object.freeze({
    version: 'car-threshold-quote-v1',
    pricing_strategy: CAR_THRESHOLD_PRICING_STRATEGY,
    offer_id: text(offer.id),
    tier_id: text(tier.id) || null,
    threshold_days: tier.thresholdDays,
    daily_rate: tier.dailyRate,
    rental_days: rentalDays,
    base_rental_price: basePrice,
    pickup_city_code: pickupCode,
    return_city_code: returnCode,
    pickup_location_fee: pickupFee.amount,
    return_location_fee: returnFee.amount,
    insurance_mode: insurance.mode,
    insurance_selected: insurance.selected,
    insurance_daily_rate: insurance.dailyRate,
    insurance_cost: insurance.cost,
    young_driver_selected: young.selected,
    young_driver_daily_rate: young.dailyRate,
    young_driver_cost: young.cost,
    pre_discount_total: total,
    currency: text(offer.currency || 'EUR').toUpperCase() || 'EUR',
    pickup_at: instants.pickupInstant,
    return_at: instants.returnInstant,
  });

  return Object.freeze({
    offer: text(offer.location).toLowerCase() === 'paphos' ? 'paphos' : 'larnaca',
    pricingStrategy: CAR_THRESHOLD_PRICING_STRATEGY,
    tierId: pricingSnapshot.tier_id,
    thresholdDays: tier.thresholdDays,
    days: rentalDays,
    basePrice,
    dailyRate: tier.dailyRate,
    pickupFee: pickupFee.amount,
    returnFee: returnFee.amount,
    insuranceCost: insurance.cost,
    insuranceMode: insurance.mode,
    insuranceDailyRate: insurance.dailyRate,
    youngDriverCost: young.cost,
    youngDriverAllowed: young.enabled,
    youngDriverApplied: young.selected,
    youngDriverDailyRate: young.dailyRate,
    total,
    currency: pricingSnapshot.currency,
    car: text(carModel) || text(offer.id),
    pickupLoc: pickupCode,
    returnLoc: returnCode,
    pickupCityCode: pickupCode,
    returnCityCode: returnCode,
    pickupFeeMode: pickupFee.mode,
    returnFeeMode: returnFee.mode,
    pickupInstant: instants.pickupInstant,
    returnInstant: instants.returnInstant,
    pricingSnapshot,
  });
}
