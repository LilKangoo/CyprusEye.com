import {
  CAR_THRESHOLD_PRICING_STRATEGY,
  resolveThresholdDirectionalFee,
} from './car-rental-threshold-pricing.js';

export const CAR_PUBLIC_OFFER_STATES = Object.freeze([
  'DRAFT',
  'READY',
  'LIVE',
  'UNAVAILABLE',
  'BLOCKED',
]);

export const CAR_PUBLIC_ELIGIBILITY_REASON_CODES = Object.freeze([
  'OFFER_NOT_PUBLISHED',
  'OFFER_NOT_AVAILABLE',
  'OFFER_STOCK_EMPTY',
  'OFFER_SUBMISSION_NOT_APPROVED',
  'MAPPED_CAPABILITY_DISABLED',
  'THRESHOLD_CAPABILITY_DISABLED',
  'OFFER_NOT_MAPPED',
  'ACTIVE_TIER_REQUIRED',
  'INVALID_TIER_CONFIGURATION',
  'MINIMUM_TIER_MISMATCH',
  'MAXIMUM_BELOW_MINIMUM',
  'ACTIVE_PICKUP_REQUIRED',
  'ACTIVE_RETURN_REQUIRED',
  'PICKUP_ROUTE_UNAVAILABLE',
  'RETURN_ROUTE_UNAVAILABLE',
  'CITY_FEE_INVALID',
  'EXACT_ACTIVE_PARTNER_REQUIRED',
]);

const STRUCTURAL_CODES = new Set([
  'ACTIVE_TIER_REQUIRED',
  'INVALID_TIER_CONFIGURATION',
  'MINIMUM_TIER_MISMATCH',
  'MAXIMUM_BELOW_MINIMUM',
  'ACTIVE_PICKUP_REQUIRED',
  'ACTIVE_RETURN_REQUIRED',
  'PICKUP_ROUTE_UNAVAILABLE',
  'RETURN_ROUTE_UNAVAILABLE',
  'CITY_FEE_INVALID',
  'EXACT_ACTIVE_PARTNER_REQUIRED',
]);

const MESSAGES = Object.freeze({
  OFFER_NOT_PUBLISHED: 'Offer is not published.',
  OFFER_NOT_AVAILABLE: 'Offer is operationally unavailable.',
  OFFER_STOCK_EMPTY: 'Stock is zero.',
  OFFER_SUBMISSION_NOT_APPROVED: 'Offer has not been approved.',
  MAPPED_CAPABILITY_DISABLED: 'Mapped availability capability is disabled.',
  THRESHOLD_CAPABILITY_DISABLED: 'Threshold pricing capability is disabled.',
  OFFER_NOT_MAPPED: 'Offer is not using configured availability.',
  ACTIVE_TIER_REQUIRED: 'At least one active daily-rate tier is required.',
  INVALID_TIER_CONFIGURATION: 'Daily-rate tiers are invalid or duplicated.',
  MINIMUM_TIER_MISMATCH: 'Minimum rental days must match the lowest active tier.',
  MAXIMUM_BELOW_MINIMUM: 'Maximum rental days cannot be below the minimum.',
  ACTIVE_PICKUP_REQUIRED: 'At least one active pickup city is required.',
  ACTIVE_RETURN_REQUIRED: 'At least one active return city is required.',
  PICKUP_ROUTE_UNAVAILABLE: 'Pickup is not enabled for the requested city.',
  RETURN_ROUTE_UNAVAILABLE: 'Return is not enabled for the requested city.',
  CITY_FEE_INVALID: 'A selected city has no valid directional fee contract.',
  EXACT_ACTIVE_PARTNER_REQUIRED: 'An active exact Cars partner is required.',
});

function text(value) {
  return String(value == null ? '' : value).trim();
}

function code(value) {
  return text(value).toLowerCase();
}

function addReason(reasons, reasonCode, details = {}) {
  if (reasons.some((reason) => reason.code === reasonCode
    && text(reason.cityCode) === text(details.cityCode)
    && text(reason.direction) === text(details.direction))) return;
  reasons.push(Object.freeze({
    code: reasonCode,
    message: MESSAGES[reasonCode] || reasonCode,
    ...details,
  }));
}

function normalizeFlags(input = {}) {
  const source = input.featureFlags || input.siteSetting || {};
  return Object.freeze({
    mappedEnabled: source.mappedEnabled === true
      || source.car_multi_city_mapped_enabled === true,
    thresholdDailyRatesEnabled: source.thresholdDailyRatesEnabled === true
      || source.car_threshold_daily_rates_enabled === true,
  });
}

function activeTiers(input = {}) {
  return (input.dailyRateTiers || input.activeTiers || [])
    .filter((tier) => tier?.is_active !== false)
    .map((tier) => ({
      ...tier,
      thresholdDays: Number(tier?.threshold_days),
      dailyRate: Number(tier?.daily_rate),
    }))
    .sort((left, right) => left.thresholdDays - right.thresholdDays);
}

export function validateCarThresholdTierConfiguration(offer, rows = []) {
  const tiers = activeTiers({ dailyRateTiers: rows });
  const reasons = [];
  if (!tiers.length) {
    addReason(reasons, 'ACTIVE_TIER_REQUIRED');
    return Object.freeze({ valid: false, tiers: Object.freeze([]), minimumDays: null, reasons });
  }
  const thresholds = new Set();
  for (const tier of tiers) {
    if (!Number.isInteger(tier.thresholdDays)
      || tier.thresholdDays < 1
      || !Number.isFinite(tier.dailyRate)
      || tier.dailyRate <= 0
      || thresholds.has(tier.thresholdDays)) {
      addReason(reasons, 'INVALID_TIER_CONFIGURATION');
    }
    thresholds.add(tier.thresholdDays);
  }
  const minimumDays = tiers[0]?.thresholdDays ?? null;
  if (Number(offer?.min_rental_days) !== minimumDays) {
    addReason(reasons, 'MINIMUM_TIER_MISMATCH', {
      configuredMinimumDays: Number(offer?.min_rental_days),
      effectiveMinimumDays: minimumDays,
    });
  }
  const maximumDays = offer?.max_rental_days == null || offer?.max_rental_days === ''
    ? null
    : Number(offer.max_rental_days);
  if (maximumDays != null && (!Number.isInteger(maximumDays) || maximumDays < minimumDays)) {
    addReason(reasons, 'MAXIMUM_BELOW_MINIMUM', { maximumDays, effectiveMinimumDays: minimumDays });
  }
  return Object.freeze({
    valid: reasons.length === 0,
    tiers: Object.freeze(tiers.map((tier) => Object.freeze(tier))),
    minimumDays,
    maximumDays,
    reasons: Object.freeze(reasons),
  });
}

function cityCodeForRow(row, input) {
  const direct = code(row?.city_code || row?.cityCode);
  if (direct) return direct;
  const cityId = text(row?.city_id);
  const city = (input.cities || []).find((candidate) => text(candidate?.id) === cityId);
  return code(city?.code);
}

function activeDirectionalRows(input) {
  return (input.availabilityRows || [])
    .filter((row) => row?.is_active === true)
    .map((row) => ({ ...row, resolvedCityCode: cityCodeForRow(row, input) }));
}

function partnerRouteIsValid(input, offer) {
  const ownerId = text(offer?.owner_partner_id);
  if (!ownerId) return false;
  if (typeof input.partnerRouteValid === 'boolean') return input.partnerRouteValid;
  const partners = Array.isArray(input.partners) ? input.partners : null;
  if (partners) {
    const partner = partners.find((candidate) => text(candidate?.id) === ownerId);
    return partner?.status === 'active' && partner?.can_manage_cars === true;
  }
  // Public PostgREST only returns a threshold offer after the public RLS
  // exact-owner predicate succeeds. This flag makes that trust boundary
  // explicit instead of treating an unverified browser value as authoritative.
  return input.partnerEligibilityEnforcedByRls === true;
}

function exactRouteRow(input, direction) {
  const direct = direction === 'pickup' ? input.pickupAvailability : input.returnAvailability;
  if (direct) return direct;
  const requestedCode = code(direction === 'pickup' ? input.pickupCityCode : input.returnCityCode);
  if (!requestedCode) return null;
  return activeDirectionalRows(input).find((row) => row.resolvedCityCode === requestedCode) || null;
}

function directionalFeeIsValid(input, row, cityCode, direction) {
  const explicit = input?.[`${direction}FeeContractValid`];
  if (typeof explicit === 'boolean') return explicit;
  if (typeof input?.directionalFeeValidator === 'function') {
    try {
      return input.directionalFeeValidator(row, cityCode, direction) === true;
    } catch (_error) {
      return false;
    }
  }
  return !!resolveThresholdDirectionalFee(row, cityCode);
}

function validateDirectionalConfiguration(input, reasons) {
  const rows = activeDirectionalRows(input);
  const pickupRows = rows.filter((row) => row.pickup_enabled === true);
  const returnRows = rows.filter((row) => row.return_enabled === true);
  if (!pickupRows.length) addReason(reasons, 'ACTIVE_PICKUP_REQUIRED');
  if (!returnRows.length) addReason(reasons, 'ACTIVE_RETURN_REQUIRED');

  for (const row of rows.filter((candidate) => candidate.pickup_enabled === true || candidate.return_enabled === true)) {
    const cityCode = row.resolvedCityCode;
    if (!cityCode || !directionalFeeIsValid(input, row, cityCode, 'configuration')) {
      addReason(reasons, 'CITY_FEE_INVALID', { cityCode: cityCode || null });
    }
  }

  const pickupCode = code(input.pickupCityCode);
  const returnCode = code(input.returnCityCode);
  const pickupRow = exactRouteRow(input, 'pickup');
  const returnRow = exactRouteRow(input, 'return');
  if (pickupCode) {
    if (pickupRow?.is_active !== true || pickupRow?.pickup_enabled !== true) {
      addReason(reasons, 'PICKUP_ROUTE_UNAVAILABLE', { cityCode: pickupCode, direction: 'pickup' });
    } else if (!directionalFeeIsValid(input, pickupRow, pickupCode, 'pickup')) {
      addReason(reasons, 'CITY_FEE_INVALID', { cityCode: pickupCode, direction: 'pickup' });
    }
  }
  if (returnCode) {
    if (returnRow?.is_active !== true || returnRow?.return_enabled !== true) {
      addReason(reasons, 'RETURN_ROUTE_UNAVAILABLE', { cityCode: returnCode, direction: 'return' });
    } else if (!directionalFeeIsValid(input, returnRow, returnCode, 'return')) {
      addReason(reasons, 'CITY_FEE_INVALID', { cityCode: returnCode, direction: 'return' });
    }
  }
  return { pickupRow, returnRow, pickupCount: pickupRows.length, returnCount: returnRows.length };
}

function legacyState(offer) {
  const publicEligible = offer?.is_available === true && offer?.is_published === true;
  const reasons = [];
  if (offer?.is_published !== true) addReason(reasons, 'OFFER_NOT_PUBLISHED');
  if (offer?.is_available !== true) addReason(reasons, 'OFFER_NOT_AVAILABLE');
  if (code(offer?.submission_status) === 'draft') addReason(reasons, 'OFFER_SUBMISSION_NOT_APPROVED');
  let status = 'READY';
  if (publicEligible) status = 'LIVE';
  else if (offer?.is_available !== true) status = 'UNAVAILABLE';
  else if (code(offer?.submission_status) === 'draft') status = 'DRAFT';
  return Object.freeze({
    offerId: text(offer?.id),
    pricingStrategy: 'legacy_compat',
    path: 'legacy',
    status,
    publicEligible,
    configurationReady: true,
    capabilityEnabled: true,
    routeReady: true,
    reasons: Object.freeze(reasons),
  });
}

function mappedLegacyState(input, offer) {
  const reasons = [];
  const flags = normalizeFlags(input);
  const directions = validateDirectionalConfiguration(input, reasons);
  if (offer?.is_published !== true) addReason(reasons, 'OFFER_NOT_PUBLISHED');
  if (offer?.is_available !== true) addReason(reasons, 'OFFER_NOT_AVAILABLE');
  if (!flags.mappedEnabled) addReason(reasons, 'MAPPED_CAPABILITY_DISABLED');

  const configurationReady = !reasons.some((reason) => STRUCTURAL_CODES.has(reason.code));
  const capabilityEnabled = flags.mappedEnabled;
  const routeReady = !reasons.some((reason) => reason.code === 'PICKUP_ROUTE_UNAVAILABLE'
    || reason.code === 'RETURN_ROUTE_UNAVAILABLE'
    || reason.code === 'CITY_FEE_INVALID');
  const publicEligible = configurationReady
    && routeReady
    && capabilityEnabled
    && offer?.is_published === true
    && offer?.is_available === true;

  let status = 'READY';
  if (!configurationReady) status = 'BLOCKED';
  else if (publicEligible) status = 'LIVE';
  else if (offer?.is_available !== true) status = 'UNAVAILABLE';
  else if (code(offer?.submission_status) === 'draft') status = 'DRAFT';

  return Object.freeze({
    offerId: text(offer?.id),
    pricingStrategy: 'legacy_compat',
    path: 'mapped-legacy',
    status,
    publicEligible,
    configurationReady,
    capabilityEnabled,
    routeReady,
    flags,
    pickupCount: directions.pickupCount,
    returnCount: directions.returnCount,
    reasons: Object.freeze(reasons),
  });
}

export function evaluateCarOfferPublicEligibility(input = {}) {
  const offer = input.offer || {};
  const pricingStrategy = code(offer.pricing_strategy || 'legacy_compat') || 'legacy_compat';
  if (pricingStrategy !== CAR_THRESHOLD_PRICING_STRATEGY) {
    return code(offer.availability_mode || 'legacy') === 'mapped'
      ? mappedLegacyState(input, offer)
      : legacyState(offer);
  }

  const reasons = [];
  const flags = normalizeFlags(input);
  const tiers = validateCarThresholdTierConfiguration(offer, input.dailyRateTiers || input.activeTiers || []);
  reasons.push(...tiers.reasons);
  const directions = validateDirectionalConfiguration(input, reasons);
  if (!partnerRouteIsValid(input, offer)) addReason(reasons, 'EXACT_ACTIVE_PARTNER_REQUIRED');

  if (offer?.is_published !== true) addReason(reasons, 'OFFER_NOT_PUBLISHED');
  if (offer?.is_available !== true) addReason(reasons, 'OFFER_NOT_AVAILABLE');
  if (!(Number(offer?.stock_count) > 0)) addReason(reasons, 'OFFER_STOCK_EMPTY');
  if (code(offer?.submission_status) !== 'approved') addReason(reasons, 'OFFER_SUBMISSION_NOT_APPROVED');
  if (code(offer?.availability_mode) !== 'mapped') addReason(reasons, 'OFFER_NOT_MAPPED');
  if (!flags.mappedEnabled) addReason(reasons, 'MAPPED_CAPABILITY_DISABLED');
  if (!flags.thresholdDailyRatesEnabled) addReason(reasons, 'THRESHOLD_CAPABILITY_DISABLED');

  const configurationReady = !reasons.some((reason) => STRUCTURAL_CODES.has(reason.code));
  const capabilityEnabled = flags.mappedEnabled && flags.thresholdDailyRatesEnabled;
  const routeReady = !reasons.some((reason) => reason.code === 'PICKUP_ROUTE_UNAVAILABLE'
    || reason.code === 'RETURN_ROUTE_UNAVAILABLE'
    || reason.code === 'CITY_FEE_INVALID');
  const publicEligible = configurationReady
    && routeReady
    && capabilityEnabled
    && offer?.is_published === true
    && offer?.is_available === true
    && Number(offer?.stock_count) > 0
    && code(offer?.submission_status) === 'approved'
    && code(offer?.availability_mode) === 'mapped';

  let status = 'READY';
  if (!configurationReady) status = 'BLOCKED';
  else if (publicEligible) status = 'LIVE';
  else if (offer?.is_available !== true || !(Number(offer?.stock_count) > 0)) {
    status = code(offer?.submission_status) === 'draft' && offer?.is_published !== true
      ? 'DRAFT'
      : 'UNAVAILABLE';
  }

  return Object.freeze({
    offerId: text(offer?.id),
    pricingStrategy,
    path: 'threshold',
    status,
    publicEligible,
    configurationReady,
    capabilityEnabled,
    routeReady,
    flags,
    minimumDays: tiers.minimumDays,
    maximumDays: tiers.maximumDays,
    pickupCount: directions.pickupCount,
    returnCount: directions.returnCount,
    reasons: Object.freeze(reasons),
  });
}

export const deriveCarOfferAdminPublicState = evaluateCarOfferPublicEligibility;
