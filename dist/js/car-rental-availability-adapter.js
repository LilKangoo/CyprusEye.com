// Car Rental Multi-City Stage 2D: shared public shadow availability adapter.
import {
  buildPricingMatrixForOfferRow,
  calculateCarRentalQuote,
} from './car-pricing.js';
import {
  CAR_CITY_VALUES,
  mapCityToLegacyLocationForPricing,
  normalizeCarCity,
  resolveCarFleet,
} from './car-rental-flow.js';
import { createCarRentalAvailabilityRepository } from './car-rental-availability-repository.js';
import {
  CAR_THRESHOLD_PRICING_STRATEGY,
  calculateThresholdCarRentalQuote,
} from './car-rental-threshold-pricing.js';

export const CAR_RENTAL_AVAILABILITY_MODES = Object.freeze(['legacy', 'shadow', 'mapped-test', 'hybrid']);
export const CAR_RENTAL_SHADOW_DIFFERENCE_CODES = Object.freeze([
  'EXPECTED_MAPPED_ADDITION',
  'EXPECTED_MAPPED_REMOVAL',
  'LEGACY_ONLY_OFFER',
  'MAPPED_ONLY_OFFER',
  'PRICE_MISMATCH',
  'ORDER_MISMATCH',
  'PROFILE_MISMATCH',
  'PICKUP_KEY_MISMATCH',
  'RETURN_KEY_MISMATCH',
  'DUPLICATE_OFFER_ID',
  'INVALID_MAPPED_CONFIGURATION',
  'FEE_REQUIRED_FOR_CITY',
  'THRESHOLD_FEATURE_FLAG_DISABLED',
  'THRESHOLD_TIER_CONFIGURATION_INVALID',
  'EXPECTED_FEE_OVERRIDE',
  'UNEXPLAINED_DIFFERENCE',
]);
export const CAR_RENTAL_HYBRID_DIAGNOSTIC_CODES = Object.freeze([
  'MAPPED_READER_UNAVAILABLE',
  'MAPPED_OFFER_OMITTED',
  'LEGACY_MAPPED_DUPLICATE_REMOVED',
  'HYBRID_RESULT_READY',
  'HYBRID_RESULT_EMPTY',
]);

const MODE_SET = new Set(CAR_RENTAL_AVAILABILITY_MODES);
const LARNACA_PRICING_KEYS = new Set(CAR_CITY_VALUES);
const PAPHOS_PRICING_KEYS = new Set(['paphos']);
const LEGACY_AVAILABILITY_CITY_KEYS = new Set(CAR_CITY_VALUES);

function text(value) {
  return String(value == null ? '' : value).trim();
}

function normalized(value) {
  return text(value).toLowerCase();
}

function normalizeConfiguredCity(value) {
  const known = normalizeCarCity(value);
  if (known) return known;
  const candidate = normalized(value);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : '';
}

function unique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))];
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of (values || []).map(text).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

function addDiagnostic(diagnostics, code, details = {}, severity = 'info') {
  diagnostics.push({ code, severity, ...details });
}

function localizedText(value, language = 'en') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const lang = ['pl', 'en', 'he'].includes(normalized(language)) ? normalized(language) : 'en';
  const order = lang === 'pl' ? ['pl', 'en', 'he'] : lang === 'he' ? ['he', 'en', 'pl'] : ['en', 'pl', 'he'];
  for (const code of order) {
    const candidate = value[code];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function offerName(offer, language) {
  return localizedText(offer?.car_model, language)
    || localizedText(offer?.car_type, language)
    || text(offer?.id);
}

function valueMatchesFilter(value, expected) {
  const expectedValues = unique(Array.isArray(expected) ? expected : [expected]).map(normalized);
  if (!expectedValues.length) return true;
  const sourceValues = typeof value === 'object' && value && !Array.isArray(value)
    ? Object.values(value).map(normalized)
    : [normalized(value)];
  return sourceValues.some((candidate) => expectedValues.includes(candidate));
}

function passesFilters(offer, profile, input, diagnostics) {
  const filters = input.filters && typeof input.filters === 'object' ? input.filters : {};
  if (offer?.is_available !== true || offer?.is_published !== true) return false;
  const thresholdOffer = normalized(offer?.pricing_strategy) === CAR_THRESHOLD_PRICING_STRATEGY;

  const passengers = Math.max(1, Math.floor(Number(input.passengers) || 1));
  const capacity = Number(offer?.max_passengers || 0);
  if (Number.isFinite(capacity) && capacity > 0 && capacity < passengers) return false;

  if (input.youngDriver) {
    if ((!thresholdOffer && profile?.calculator_key !== 'larnaca') || offer?.young_driver_fee !== true) return false;
  }

  const platform = normalized(filters.platform);
  const explicitNorth = typeof filters.requireNorthAllowed === 'boolean'
    ? filters.requireNorthAllowed
    : null;
  const effectiveLegacyLocation = normalized(profile?.calculator_key || offer?.location);
  const carPageNorth = platform === 'car-page' && !thresholdOffer
    ? effectiveLegacyLocation === 'larnaca'
    : null;
  const expectedNorth = explicitNorth == null ? carPageNorth : explicitNorth;
  if (typeof expectedNorth === 'boolean' && offer?.north_allowed !== expectedNorth) return false;

  if (platform === 'homepage' && !thresholdOffer && effectiveLegacyLocation === 'larnaca' && offer?.north_allowed === false) {
    addDiagnostic(diagnostics, 'HOMEPAGE_CAR_PAGE_NORTH_ALLOWED_DIFFERENCE', {
      offerId: text(offer.id),
      profileId: text(profile.id),
    }, 'warning');
  }

  if (!valueMatchesFilter(offer?.car_type, filters.carType)) return false;
  if (!valueMatchesFilter(offer?.transmission, filters.transmission)) return false;
  if (!valueMatchesFilter(offer?.fuel_type, filters.fuel)) return false;

  const allowedOfferIds = unique(filters.allowedOfferIds);
  if (allowedOfferIds.length && !allowedOfferIds.includes(text(offer?.id))) return false;

  if (typeof filters.isLanguageEligible === 'function') {
    try {
      if (!filters.isLanguageEligible(offer, input.language)) return false;
    } catch (_error) {
      addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', {
        offerId: text(offer?.id),
        reason: 'LANGUAGE_FILTER_FAILED',
      }, 'warning');
      return false;
    }
  }
  return true;
}

function calculateOfferQuote(offer, context, input) {
  if (normalized(offer?.pricing_strategy) === CAR_THRESHOLD_PRICING_STRATEGY) {
    const quote = calculateThresholdCarRentalQuote({
      offer,
      tiers: context.dailyRateTiers,
      pickupDateStr: input.pickupDate,
      returnDateStr: input.returnDate,
      pickupTimeStr: input.pickupTime || '10:00',
      returnTimeStr: input.returnTime || '10:00',
      pickupCityCode: context.pickupCityCode,
      returnCityCode: context.returnCityCode,
      pickupAvailability: context.pickupAvailability,
      returnAvailability: context.returnAvailability,
      fullInsurance: input.fullInsurance === true,
      youngDriver: input.youngDriver === true,
      carModel: offerName(offer, input.language),
    });
    return quote ? { quote, reason: null } : { quote: null, reason: 'THRESHOLD_QUOTE_UNAVAILABLE' };
  }
  const pricingMatrix = buildPricingMatrixForOfferRow(offer, context.calculatorKey);
  if (!pricingMatrix) return { quote: null, reason: 'PRICING_MATRIX_INCOMPLETE' };
  const quote = calculateCarRentalQuote({
    pricingMatrix,
    offer: context.calculatorKey,
    carModel: offerName(offer, input.language),
    pickupDateStr: input.pickupDate,
    returnDateStr: input.returnDate,
    pickupTimeStr: input.pickupTime || '10:00',
    returnTimeStr: input.returnTime || '10:00',
    pickupLocation: context.pickupPricingKey,
    returnLocation: context.returnPricingKey,
    fullInsurance: input.fullInsurance === true,
    youngDriver: input.youngDriver === true,
    offerRow: offer,
    pickupFeeOverride: context.pickupFeeOverride,
    returnFeeOverride: context.returnFeeOverride,
  });
  return quote ? { quote, reason: null } : { quote: null, reason: 'QUOTE_UNAVAILABLE' };
}

function exactRecord(rows, predicate) {
  const matches = (rows || []).filter(predicate);
  return { record: matches.length === 1 ? matches[0] : null, count: matches.length };
}

function mappingFor(context, profileId, cityId, direction) {
  const result = exactRecord(
    context.profileCities,
    (mapping) => text(mapping.pricing_profile_id) === profileId && text(mapping.city_id) === cityId,
  );
  if (!result.record || result.record.is_active !== true) return { mapping: null, count: result.count };
  if (direction === 'pickup' && result.record.pickup_supported !== true) return { mapping: null, count: result.count };
  if (direction === 'return' && result.record.return_supported !== true) return { mapping: null, count: result.count };
  return { mapping: result.record, count: result.count };
}

function validPricingKey(calculatorKey, key) {
  if (calculatorKey === 'larnaca') return LARNACA_PRICING_KEYS.has(key);
  if (calculatorKey === 'paphos') return PAPHOS_PRICING_KEYS.has(key);
  return false;
}

function resolveDirectionalFee(availability, calculatorKey, pricingKey) {
  const mode = normalized(availability?.fee_mode) === 'override' ? 'override' : 'inherit';
  if (mode === 'override') {
    const amount = Number(availability?.fee_per_direction);
    const valid = Number.isFinite(amount)
      && amount >= 0
      && Math.abs((amount * 100) - Math.round(amount * 100)) < 1e-8;
    return {
      valid,
      mode,
      amount: valid ? Number(amount.toFixed(2)) : null,
      override: valid ? Number(amount.toFixed(2)) : null,
    };
  }
  return {
    valid: validPricingKey(calculatorKey, pricingKey),
    mode,
    amount: null,
    override: null,
  };
}

function buildOfferPricingContext({
  offer,
  availabilityMode,
  profileId,
  profileCode,
  calculatorKey,
  legacyBookingLocation,
  pickupCityCode,
  returnCityCode,
  pickupPlaceType,
  returnPlaceType,
  pickupLegacyPricingKey,
  returnLegacyPricingKey,
  pickupLegacyPricingLocation,
  returnLegacyPricingLocation,
  pickupFeeMode,
  returnFeeMode,
  pickupFeePerDirection,
  returnFeePerDirection,
  pricingStrategy,
  dailyRateTiers,
  pickupAvailability,
  returnAvailability,
  quote,
}) {
  const offerId = text(offer?.id);
  const normalizedMode = normalized(availabilityMode || offer?.availability_mode || 'legacy') || 'legacy';
  const normalizedProfileId = text(profileId || offer?.pricing_profile_id);
  const normalizedCalculatorKey = normalized(calculatorKey);
  const normalizedPickupKey = normalized(pickupLegacyPricingKey);
  const normalizedReturnKey = normalized(returnLegacyPricingKey);
  const normalizedPickupLocation = normalized(pickupLegacyPricingLocation || normalizedPickupKey);
  const normalizedReturnLocation = normalized(returnLegacyPricingLocation || normalizedReturnKey);
  return Object.freeze({
    offerId,
    availabilityMode: normalizedMode,
    pricingStrategy: normalized(pricingStrategy || offer?.pricing_strategy || 'legacy_compat') || 'legacy_compat',
    pricingProfileId: normalizedProfileId,
    profileId: normalizedProfileId,
    profileCode: normalized(profileCode || normalizedCalculatorKey),
    calculatorKey: normalizedCalculatorKey,
    legacyBookingLocation: normalized(legacyBookingLocation || normalizedCalculatorKey),
    pickupCityCode: normalizeConfiguredCity(pickupCityCode),
    returnCityCode: normalizeConfiguredCity(returnCityCode),
    pickupPlaceType: normalized(pickupPlaceType) || 'hotel',
    returnPlaceType: normalized(returnPlaceType) || 'hotel',
    pickupLegacyPricingKey: normalizedPickupKey,
    returnLegacyPricingKey: normalizedReturnKey,
    pickupLegacyPricingLocation: normalizedPickupLocation,
    returnLegacyPricingLocation: normalizedReturnLocation,
    // Stage 2D compatibility aliases: these are the exact values sent to the legacy calculator.
    pickupPricingKey: normalizedPickupLocation,
    returnPricingKey: normalizedReturnLocation,
    pickupFeeMode: normalized(pickupFeeMode) === 'override' ? 'override' : 'inherit',
    returnFeeMode: normalized(returnFeeMode) === 'override' ? 'override' : 'inherit',
    pickupFeePerDirection: pickupFeePerDirection == null ? null : Number(pickupFeePerDirection),
    returnFeePerDirection: returnFeePerDirection == null ? null : Number(returnFeePerDirection),
    dailyRateTiers: Object.freeze((dailyRateTiers || []).map((tier) => Object.freeze({ ...tier }))),
    pickupAvailability: pickupAvailability ? Object.freeze({ ...pickupAvailability }) : null,
    returnAvailability: returnAvailability ? Object.freeze({ ...returnAvailability }) : null,
    pricingSnapshot: quote?.pricingSnapshot || null,
    quote,
  });
}

function withPricingContext(offer, availabilityContext, quote) {
  return {
    ...offer,
    availabilityContext,
    pricingContext: availabilityContext,
    quote,
  };
}

export function resolveMappedAvailabilityFromContext(input, rawContext = {}) {
  const diagnostics = [];
  const context = {
    cities: Array.isArray(rawContext.cities) ? rawContext.cities : [],
    availability: Array.isArray(rawContext.availability) ? rawContext.availability : [],
    offers: Array.isArray(rawContext.offers) ? rawContext.offers : [],
    profiles: Array.isArray(rawContext.profiles) ? rawContext.profiles : [],
    profileCities: Array.isArray(rawContext.profileCities) ? rawContext.profileCities : [],
    dailyRateTiers: Array.isArray(rawContext.dailyRateTiers) ? rawContext.dailyRateTiers : [],
  };
  const pickupCode = normalizeConfiguredCity(input.pickupCityCode);
  const returnCode = normalizeConfiguredCity(input.returnCityCode);
  if (!pickupCode || !returnCode) {
    addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', {
      reason: 'UNKNOWN_CITY_CODE',
      pickupCityCode: text(input.pickupCityCode),
      returnCityCode: text(input.returnCityCode),
    }, 'error');
    return { offers: [], diagnostics };
  }

  const pickupResult = exactRecord(context.cities, (city) => normalized(city.code) === pickupCode);
  const returnResult = exactRecord(context.cities, (city) => normalized(city.code) === returnCode);
  const pickupCity = pickupResult.record?.is_active === true ? pickupResult.record : null;
  const returnCity = returnResult.record?.is_active === true ? returnResult.record : null;
  if (!pickupCity || !returnCity) {
    addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', {
      reason: 'CITY_INACTIVE_NOT_FOUND_OR_NOT_EXACT',
      pickupCityCode: pickupCode,
      returnCityCode: returnCode,
      pickupPlaceType: input.pickupPlaceType,
      returnPlaceType: input.returnPlaceType,
    }, 'warning');
    return { offers: [], diagnostics };
  }

  const availabilityKeys = context.availability.map((row) => `${text(row.offer_id)}:${text(row.city_id)}`);
  for (const duplicateKey of duplicateValues(availabilityKeys)) {
    addDiagnostic(diagnostics, 'DUPLICATE_OFFER_ID', {
      offerId: duplicateKey.split(':')[0],
      reason: 'DUPLICATE_AVAILABILITY_COMPOSITE_KEY',
    }, 'error');
  }

  const pickupIds = new Set(
    context.availability
      .filter((row) => row.is_active === true && row.pickup_enabled === true && text(row.city_id) === text(pickupCity.id))
      .map((row) => text(row.offer_id)),
  );
  const returnIds = new Set(
    context.availability
      .filter((row) => row.is_active === true && row.return_enabled === true && text(row.city_id) === text(returnCity.id))
      .map((row) => text(row.offer_id)),
  );
  const candidateIds = [...pickupIds].filter((offerId) => returnIds.has(offerId)).sort();
  const mappedOffers = [];

  for (const offerId of candidateIds) {
    const offerResult = exactRecord(context.offers, (offer) => text(offer.id) === offerId);
    if (offerResult.count > 1) {
      addDiagnostic(diagnostics, 'DUPLICATE_OFFER_ID', { offerId, reason: 'DUPLICATE_OFFER_RECORD' }, 'error');
      continue;
    }
    const offer = offerResult.record;
    if (!offer || offer.availability_mode !== 'mapped') {
      addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', { offerId, reason: 'OFFER_NOT_MAPPED_OR_NOT_VISIBLE' }, 'warning');
      continue;
    }

    const pickupAvailabilityResult = exactRecord(
      context.availability,
      (row) => text(row.offer_id) === offerId && text(row.city_id) === text(pickupCity.id),
    );
    const returnAvailabilityResult = exactRecord(
      context.availability,
      (row) => text(row.offer_id) === offerId && text(row.city_id) === text(returnCity.id),
    );
    const pickupAvailability = pickupAvailabilityResult.record;
    const returnAvailability = returnAvailabilityResult.record;
    if (!pickupAvailability || !returnAvailability) {
      addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', {
        offerId,
        reason: 'EXACT_DIRECTIONAL_AVAILABILITY_MISSING',
      }, 'error');
      continue;
    }

    const pricingStrategy = normalized(offer.pricing_strategy || 'legacy_compat') || 'legacy_compat';
    if (pricingStrategy === CAR_THRESHOLD_PRICING_STRATEGY) {
      if (input.thresholdFeatureFlagEnabled !== true) {
        addDiagnostic(diagnostics, 'THRESHOLD_FEATURE_FLAG_DISABLED', { offerId }, 'info');
        continue;
      }
      const dailyRateTiers = context.dailyRateTiers
        .filter((tier) => text(tier.offer_id) === offerId && tier.is_active !== false)
        .sort((left, right) => Number(left.threshold_days) - Number(right.threshold_days));
      if (!dailyRateTiers.length) {
        addDiagnostic(diagnostics, 'THRESHOLD_TIER_CONFIGURATION_INVALID', {
          offerId,
          reason: 'NO_ACTIVE_EXACT_OFFER_TIERS',
        }, 'error');
        continue;
      }
      if (!passesFilters(offer, null, input, diagnostics)) continue;

      const quoteContext = {
        dailyRateTiers,
        pickupCityCode: pickupCode,
        returnCityCode: returnCode,
        pickupAvailability,
        returnAvailability,
      };
      const { quote, reason } = calculateOfferQuote(offer, quoteContext, input);
      if (!quote) {
        addDiagnostic(diagnostics, reason === 'THRESHOLD_QUOTE_UNAVAILABLE'
          ? 'THRESHOLD_TIER_CONFIGURATION_INVALID'
          : 'INVALID_MAPPED_CONFIGURATION', {
          offerId,
          reason,
        }, 'warning');
        continue;
      }
      const legacyBookingLocation = normalized(offer.location) === 'paphos' ? 'paphos' : 'larnaca';
      const availabilityContext = buildOfferPricingContext({
        offer,
        availabilityMode: 'mapped',
        profileId: offer.pricing_profile_id,
        profileCode: CAR_THRESHOLD_PRICING_STRATEGY,
        calculatorKey: CAR_THRESHOLD_PRICING_STRATEGY,
        legacyBookingLocation,
        pickupCityCode: pickupCode,
        returnCityCode: returnCode,
        pickupPlaceType: input.pickupPlaceType,
        returnPlaceType: input.returnPlaceType,
        pickupLegacyPricingKey: pickupCode,
        returnLegacyPricingKey: returnCode,
        pickupLegacyPricingLocation: pickupCode,
        returnLegacyPricingLocation: returnCode,
        pickupFeeMode: pickupAvailability.fee_mode,
        returnFeeMode: returnAvailability.fee_mode,
        pickupFeePerDirection: quote.pickupFee,
        returnFeePerDirection: quote.returnFee,
        pricingStrategy,
        dailyRateTiers,
        pickupAvailability,
        returnAvailability,
        quote,
      });
      mappedOffers.push(withPricingContext(offer, availabilityContext, quote));
      continue;
    }

    const profileId = text(offer.pricing_profile_id);
    const profileResult = exactRecord(context.profiles, (profile) => text(profile.id) === profileId);
    const profile = profileResult.record?.is_active === true ? profileResult.record : null;
    if (!profile) {
      addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', { offerId, profileId, reason: 'ACTIVE_PROFILE_NOT_FOUND_OR_NOT_EXACT' }, 'warning');
      continue;
    }

    const calculatorKey = normalized(profile.calculator_key);
    const legacyBookingLocation = normalized(profile.legacy_booking_location);
    if (
      !['larnaca', 'paphos'].includes(calculatorKey)
      || legacyBookingLocation !== calculatorKey
      || normalized(offer.location) !== legacyBookingLocation
    ) {
      addDiagnostic(diagnostics, 'PROFILE_MISMATCH', {
        offerId,
        profileId,
        calculatorKey,
        legacyBookingLocation,
        offerLocation: normalized(offer.location),
      }, 'error');
      continue;
    }

    if (calculatorKey === 'paphos' && (pickupCode !== 'paphos' || returnCode !== 'paphos')) {
      addDiagnostic(diagnostics, 'PAPHOS_PROFILE_OUTSIDE_PAPHOS', {
        offerId,
        profileId,
        pickupCityCode: pickupCode,
        returnCityCode: returnCode,
      }, 'warning');
      continue;
    }

    const pickupMappingResult = mappingFor(context, profileId, text(pickupCity.id), 'pickup');
    const returnMappingResult = mappingFor(context, profileId, text(returnCity.id), 'return');
    const pickupMapping = pickupMappingResult.mapping;
    const returnMapping = returnMappingResult.mapping;
    if (!pickupMapping || !returnMapping) {
      addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', {
        offerId,
        profileId,
        reason: 'ACTIVE_DIRECTIONAL_PROFILE_CITY_MAPPING_MISSING',
      }, 'warning');
      continue;
    }

    const pickupLegacyKey = normalized(pickupMapping.legacy_pricing_city_key);
    const returnLegacyKey = normalized(returnMapping.legacy_pricing_city_key);
    if (pickupLegacyKey !== pickupCode || returnLegacyKey !== returnCode) {
      addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', {
        offerId,
        profileId,
        reason: 'PRICING_KEY_DOES_NOT_MATCH_EXACT_CITY',
        pickupPricingKey: pickupLegacyKey,
        returnPricingKey: returnLegacyKey,
      }, 'error');
      continue;
    }

    const pickupFee = resolveDirectionalFee(pickupAvailability, calculatorKey, pickupLegacyKey);
    const returnFee = resolveDirectionalFee(returnAvailability, calculatorKey, returnLegacyKey);
    if (!pickupFee.valid || !returnFee.valid) {
      addDiagnostic(diagnostics, 'FEE_REQUIRED_FOR_CITY', {
        offerId,
        profileId,
        pickupCityCode: pickupCode,
        returnCityCode: returnCode,
        pickupFeeMode: pickupFee.mode,
        returnFeeMode: returnFee.mode,
      }, 'error');
      continue;
    }

    if (!passesFilters(offer, profile, input, diagnostics)) continue;

    const pickupPricingKey = calculatorKey === 'paphos'
      ? mapCityToLegacyLocationForPricing(pickupCode, calculatorKey, input.pickupPlaceType)
      : pickupLegacyKey;
    const returnPricingKey = calculatorKey === 'paphos'
      ? mapCityToLegacyLocationForPricing(returnCode, calculatorKey, input.returnPlaceType)
      : returnLegacyKey;
    const quoteContext = {
      calculatorKey,
      pickupPricingKey,
      returnPricingKey,
      pickupFeeOverride: pickupFee.override,
      returnFeeOverride: returnFee.override,
    };
    const { quote, reason } = calculateOfferQuote(offer, quoteContext, input);
    if (!quote) {
      addDiagnostic(diagnostics, 'INVALID_MAPPED_CONFIGURATION', { offerId, profileId, reason }, 'warning');
      continue;
    }
    const availabilityContext = buildOfferPricingContext({
      offer,
      availabilityMode: 'mapped',
      profileId,
      profileCode: profile.code,
      calculatorKey,
      legacyBookingLocation,
      pickupCityCode: pickupCode,
      returnCityCode: returnCode,
      pickupLegacyPricingKey: pickupLegacyKey,
      returnLegacyPricingKey: returnLegacyKey,
      pickupLegacyPricingLocation: pickupPricingKey,
      returnLegacyPricingLocation: returnPricingKey,
      pickupFeeMode: pickupFee.mode,
      returnFeeMode: returnFee.mode,
      pickupFeePerDirection: pickupFee.amount,
      returnFeePerDirection: returnFee.amount,
      pricingStrategy,
      pickupAvailability,
      returnAvailability,
      quote,
    });
    mappedOffers.push(withPricingContext(offer, availabilityContext, quote));
  }

  mappedOffers.sort((left, right) => {
    const totalDifference = Number(left.quote?.total) - Number(right.quote?.total);
    if (totalDifference) return totalDifference;
    const sortDifference = Number(left.sort_order || 0) - Number(right.sort_order || 0);
    if (sortDifference) return sortDifference;
    return text(left.id).localeCompare(text(right.id));
  });

  return { offers: mappedOffers, diagnostics };
}

function evaluateLegacyOffers(legacyOffers, input, diagnostics) {
  const route = resolveCarFleet(input.pickupCityCode, input.returnCityCode, input.youngDriver === true);
  const entries = [];
  for (const offer of legacyOffers) {
    const offerId = text(offer?.id);
    const calculatorKey = normalized(offer?.location) === 'paphos' ? 'paphos' : 'larnaca';
    if (calculatorKey !== route.effectiveOffer) {
      addDiagnostic(diagnostics, 'LEGACY_ONLY_OFFER', { offerId, reason: 'LEGACY_RESULT_PROFILE_DOES_NOT_MATCH_ROUTE' }, 'warning');
      continue;
    }
    const pickupPricingKey = mapCityToLegacyLocationForPricing(
      input.pickupCityCode,
      calculatorKey,
      input.pickupPlaceType,
    );
    const returnPricingKey = mapCityToLegacyLocationForPricing(
      input.returnCityCode,
      calculatorKey,
      input.returnPlaceType,
    );
    const quoteContext = { calculatorKey, pickupPricingKey, returnPricingKey };
    const { quote, reason } = calculateOfferQuote(offer, quoteContext, input);
    if (!quote) {
      addDiagnostic(diagnostics, 'LEGACY_ONLY_OFFER', { offerId, reason }, 'warning');
      continue;
    }
    const availabilityContext = buildOfferPricingContext({
      offer,
      availabilityMode: offer?.availability_mode || 'legacy',
      profileId: offer?.pricing_profile_id,
      profileCode: calculatorKey,
      calculatorKey,
      legacyBookingLocation: calculatorKey,
      pickupCityCode: input.pickupCityCode,
      returnCityCode: input.returnCityCode,
      pickupPlaceType: input.pickupPlaceType,
      returnPlaceType: input.returnPlaceType,
      pickupLegacyPricingKey: pickupPricingKey,
      returnLegacyPricingKey: returnPricingKey,
      pickupLegacyPricingLocation: pickupPricingKey,
      returnLegacyPricingLocation: returnPricingKey,
      quote,
    });
    entries.push({ offer, offerId, availabilityContext, quote });
  }
  return entries;
}

function sortOffersByQuote(offers) {
  return [...offers].sort((left, right) => {
    const leftTotal = Number(left?.quote?.total);
    const rightTotal = Number(right?.quote?.total);
    const leftHasQuote = Number.isFinite(leftTotal);
    const rightHasQuote = Number.isFinite(rightTotal);
    if (leftHasQuote && rightHasQuote && leftTotal !== rightTotal) return leftTotal - rightTotal;
    if (leftHasQuote !== rightHasQuote) return leftHasQuote ? -1 : 1;
    const sortDifference = Number(left?.sort_order || 0) - Number(right?.sort_order || 0);
    if (sortDifference) return sortDifference;
    return text(left?.id).localeCompare(text(right?.id));
  });
}

export function buildHybridCarRentalResult({
  legacyOffers = [],
  legacyEntries = [],
  mappedOffers = [],
  diagnostics = [],
  mappedReaderAvailable = true,
} = {}) {
  const legacyEntryById = new Map((legacyEntries || []).map((entry) => [text(entry?.offerId), entry]));
  const mappedById = new Map();
  const renderedById = new Map();

  for (const mappedOffer of mappedOffers || []) {
    const offerId = text(mappedOffer?.id);
    if (!offerId) continue;
    if (mappedById.has(offerId)) {
      addDiagnostic(diagnostics, 'DUPLICATE_OFFER_ID', { offerId, reason: 'DUPLICATE_MAPPED_RESULT' }, 'error');
      continue;
    }
    mappedById.set(offerId, mappedOffer);
  }

  for (const legacyOffer of legacyOffers || []) {
    const offerId = text(legacyOffer?.id);
    if (!offerId) continue;
    if (normalized(legacyOffer?.availability_mode) !== 'legacy') {
      if (mappedById.has(offerId)) {
        addDiagnostic(diagnostics, 'LEGACY_MAPPED_DUPLICATE_REMOVED', { offerId }, 'info');
      } else {
        addDiagnostic(diagnostics, 'MAPPED_OFFER_OMITTED', {
          offerId,
          reason: mappedReaderAvailable ? 'NOT_ELIGIBLE_FOR_MAPPED_ROUTE' : 'MAPPED_READER_UNAVAILABLE',
        }, 'warning');
      }
      continue;
    }
    if (renderedById.has(offerId)) {
      addDiagnostic(diagnostics, 'DUPLICATE_OFFER_ID', { offerId, reason: 'DUPLICATE_LEGACY_RESULT' }, 'error');
      continue;
    }
    const entry = legacyEntryById.get(offerId);
    if (!entry) {
      addDiagnostic(diagnostics, 'MAPPED_OFFER_OMITTED', {
        offerId,
        reason: 'LEGACY_QUOTE_UNAVAILABLE_FOR_SELECTED_DURATION',
      }, 'info');
      continue;
    }
    const renderedOffer = withPricingContext(entry.offer, entry.availabilityContext, entry.quote);
    renderedById.set(offerId, renderedOffer);
  }

  if (mappedReaderAvailable) {
    for (const [offerId, mappedOffer] of mappedById.entries()) {
      if (renderedById.has(offerId)) {
        addDiagnostic(diagnostics, 'LEGACY_MAPPED_DUPLICATE_REMOVED', { offerId }, 'warning');
        continue;
      }
      renderedById.set(offerId, mappedOffer);
    }
  }

  const renderedOffers = sortOffersByQuote([...renderedById.values()]);
  addDiagnostic(diagnostics, renderedOffers.length ? 'HYBRID_RESULT_READY' : 'HYBRID_RESULT_EMPTY', {
    legacyOfferCount: [...renderedById.values()].filter((offer) => normalized(offer?.availability_mode) === 'legacy').length,
    mappedOfferCount: [...renderedById.values()].filter((offer) => normalized(offer?.availability_mode) === 'mapped').length,
  }, 'info');
  return renderedOffers;
}

export function compareCarRentalAvailability(legacyEntries, mappedOffers, diagnostics = []) {
  const legacyIds = legacyEntries.map((entry) => entry.offerId);
  const mappedIds = mappedOffers.map((offer) => text(offer.id));
  const legacyDuplicates = duplicateValues(legacyIds);
  const mappedDuplicates = duplicateValues(mappedIds);
  const addedOfferIds = unique(mappedIds.filter((offerId) => !legacyIds.includes(offerId))).sort();
  const removedOfferIds = unique(legacyIds.filter((offerId) => !mappedIds.includes(offerId))).sort();
  const commonOfferIds = unique(legacyIds.filter((offerId) => mappedIds.includes(offerId)));
  const differences = [];
  const priceMismatches = [];
  const orderMismatches = [];
  const profileMismatches = [];
  const pickupKeyMismatches = [];
  const returnKeyMismatches = [];
  const unexplainedDifferences = [];

  for (const offerId of legacyDuplicates.concat(mappedDuplicates)) {
    differences.push({ code: 'DUPLICATE_OFFER_ID', offerId });
  }
  for (const offerId of addedOfferIds) {
    differences.push({ code: 'MAPPED_ONLY_OFFER', offerId });
    differences.push({ code: 'EXPECTED_MAPPED_ADDITION', offerId });
  }
  for (const offerId of removedOfferIds) {
    differences.push({ code: 'LEGACY_ONLY_OFFER', offerId });
    differences.push({ code: 'EXPECTED_MAPPED_REMOVAL', offerId });
  }

  for (const offerId of commonOfferIds) {
    const legacy = legacyEntries.find((entry) => entry.offerId === offerId);
    const mapped = mappedOffers.find((offer) => text(offer.id) === offerId);
    const legacyContext = legacy?.availabilityContext || {};
    const mappedContext = mapped?.availabilityContext || {};
    if (legacyContext.calculatorKey !== mappedContext.calculatorKey) {
      const mismatch = { code: 'PROFILE_MISMATCH', offerId, legacy: legacyContext.calculatorKey, mapped: mappedContext.calculatorKey };
      profileMismatches.push(mismatch);
      differences.push(mismatch);
    }
    if (legacyContext.pickupPricingKey !== mappedContext.pickupPricingKey) {
      const mismatch = { code: 'PICKUP_KEY_MISMATCH', offerId, legacy: legacyContext.pickupPricingKey, mapped: mappedContext.pickupPricingKey };
      pickupKeyMismatches.push(mismatch);
      differences.push(mismatch);
    }
    if (legacyContext.returnPricingKey !== mappedContext.returnPricingKey) {
      const mismatch = { code: 'RETURN_KEY_MISMATCH', offerId, legacy: legacyContext.returnPricingKey, mapped: mappedContext.returnPricingKey };
      returnKeyMismatches.push(mismatch);
      differences.push(mismatch);
    }
    const samePricingContext = legacyContext.calculatorKey === mappedContext.calculatorKey
      && legacyContext.pickupPricingKey === mappedContext.pickupPricingKey
      && legacyContext.returnPricingKey === mappedContext.returnPricingKey;
    const hasMappedFeeOverride = mappedContext.pickupFeeMode === 'override'
      || mappedContext.returnFeeMode === 'override';
    if (samePricingContext && hasMappedFeeOverride && Number(legacy?.quote?.total) !== Number(mapped?.quote?.total)) {
      differences.push({
        code: 'EXPECTED_FEE_OVERRIDE',
        offerId,
        legacyTotal: Number(legacy?.quote?.total),
        mappedTotal: Number(mapped?.quote?.total),
        pickupFeePerDirection: mappedContext.pickupFeePerDirection,
        returnFeePerDirection: mappedContext.returnFeePerDirection,
      });
    } else if (samePricingContext && Number(legacy?.quote?.total) !== Number(mapped?.quote?.total)) {
      const mismatch = {
        code: 'PRICE_MISMATCH',
        offerId,
        legacyTotal: Number(legacy?.quote?.total),
        mappedTotal: Number(mapped?.quote?.total),
      };
      priceMismatches.push(mismatch);
      differences.push(mismatch);
    }
  }

  const legacyCommonOrder = legacyIds.filter((offerId) => commonOfferIds.includes(offerId));
  const mappedCommonOrder = mappedIds.filter((offerId) => commonOfferIds.includes(offerId));
  if (legacyCommonOrder.join('|') !== mappedCommonOrder.join('|')) {
    const mismatch = { code: 'ORDER_MISMATCH', legacyOrder: legacyCommonOrder, mappedOrder: mappedCommonOrder };
    orderMismatches.push(mismatch);
    differences.push(mismatch);
  }

  for (const diagnostic of diagnostics) {
    if (diagnostic.code === 'UNEXPLAINED_DIFFERENCE') unexplainedDifferences.push(diagnostic);
  }

  return {
    addedOfferIds,
    removedOfferIds,
    commonOfferIds,
    priceMismatches,
    orderMismatches,
    profileMismatches,
    pickupKeyMismatches,
    returnKeyMismatches,
    unexplainedDifferences,
    differences,
  };
}

function baseResult(legacyOffers, diagnostics = [], metrics = {}) {
  const result = {
    legacyOffers,
    mappedOffers: [],
    renderedOffers: legacyOffers,
    comparison: compareCarRentalAvailability([], [], diagnostics),
    diagnostics,
    metrics,
    featureFlagEnabled: false,
    thresholdFeatureFlagEnabled: false,
    renderMode: 'legacy',
  };
  if (result.renderedOffers !== result.legacyOffers) {
    throw new Error('Stage 2D safety assertion failed: renderedOffers must remain legacyOffers.');
  }
  return result;
}

export async function resolveCarRentalAvailability(options = {}) {
  const input = {
    pickupCityCode: normalizeConfiguredCity(options.pickupCityCode),
    returnCityCode: normalizeConfiguredCity(options.returnCityCode),
    pickupPlaceType: options.pickupPlaceType || 'hotel',
    returnPlaceType: options.returnPlaceType || 'hotel',
    pickupDate: text(options.pickupDate),
    pickupTime: text(options.pickupTime) || '10:00',
    returnDate: text(options.returnDate),
    returnTime: text(options.returnTime) || '10:00',
    passengers: Math.max(1, Math.floor(Number(options.passengers) || 1)),
    fullInsurance: options.fullInsurance === true,
    youngDriver: options.youngDriver === true,
    language: normalized(options.language) || 'en',
    filters: options.filters && typeof options.filters === 'object' ? options.filters : {},
    thresholdFeatureFlagEnabled: options.thresholdFeatureFlagEnabled === true,
  };
  const mode = MODE_SET.has(options.mode) ? options.mode : 'legacy';
  const legacyOffers = Array.isArray(options.legacyOffers) ? options.legacyOffers : [];
  const diagnostics = [];
  const legacyEntries = evaluateLegacyOffers(legacyOffers, input, diagnostics);
  if (mode === 'legacy') {
    const result = baseResult(legacyOffers, diagnostics, { requests: 0, responseBytes: 0, durationMs: 0, queries: [] });
    result.comparison = compareCarRentalAvailability(legacyEntries, [], diagnostics);
    return result;
  }

  let repository = options.repository || null;
  let featureFlagEnabled = false;
  let thresholdFeatureFlagEnabled = options.thresholdFeatureFlagEnabled === true;
  try {
    repository = repository || (options.mappedContext && mode === 'mapped-test'
      ? {
        getMetrics: () => options.mappedContext?.metrics || { requests: 0, responseBytes: 0, durationMs: 0, queries: [] },
        readMappedContext: async () => options.mappedContext,
      }
      : createCarRentalAvailabilityRepository({ supabase: options.supabase }));
    if (mode === 'shadow' || mode === 'hybrid') {
      const flags = typeof repository.getFeatureFlags === 'function'
        ? await repository.getFeatureFlags()
        : { mappedEnabled: await repository.getFeatureFlag(), thresholdDailyRatesEnabled: false };
      if (!flags.mappedEnabled) {
        addDiagnostic(diagnostics, mode === 'hybrid' ? 'HYBRID_FEATURE_FLAG_DISABLED' : 'SHADOW_FEATURE_FLAG_DISABLED', {}, 'info');
        const result = baseResult(legacyOffers, diagnostics, repository.getMetrics());
        result.comparison = compareCarRentalAvailability(legacyEntries, [], diagnostics);
        return result;
      }
      featureFlagEnabled = true;
      thresholdFeatureFlagEnabled = flags.thresholdDailyRatesEnabled === true;
    } else {
      addDiagnostic(diagnostics, 'MAPPED_TEST_MODE', {}, 'info');
      thresholdFeatureFlagEnabled = options.thresholdFeatureFlagEnabled === true
        || options.mappedContext?.siteSetting?.car_threshold_daily_rates_enabled === true;
    }
    input.thresholdFeatureFlagEnabled = thresholdFeatureFlagEnabled;

    // Custom catalog cities are exact mapped availability only. They must
    // never make the six-city legacy Larnaca resolver act as an implicit
    // island-wide fallback.
    const legacyRouteSupported = LEGACY_AVAILABILITY_CITY_KEYS.has(input.pickupCityCode)
      && LEGACY_AVAILABILITY_CITY_KEYS.has(input.returnCityCode);
    const hybridLegacyOffers = legacyRouteSupported ? legacyOffers : [];
    const hybridLegacyEntries = legacyRouteSupported ? legacyEntries : [];

    const mappedContext = options.mappedContext || await repository.readMappedContext({
      pickupCityCode: input.pickupCityCode,
      returnCityCode: input.returnCityCode,
    });
    const mapped = resolveMappedAvailabilityFromContext(input, mappedContext);
    diagnostics.push(...mapped.diagnostics);
    const comparison = compareCarRentalAvailability(hybridLegacyEntries, mapped.offers, diagnostics);
    const renderedOffers = mode === 'hybrid'
      ? buildHybridCarRentalResult({
        legacyOffers: hybridLegacyOffers,
        legacyEntries: hybridLegacyEntries,
        mappedOffers: mapped.offers,
        diagnostics,
        mappedReaderAvailable: true,
      })
      : legacyOffers;
    const result = {
      legacyOffers,
      mappedOffers: mapped.offers,
      renderedOffers,
      comparison,
      diagnostics,
      metrics: repository.getMetrics ? repository.getMetrics() : mappedContext.metrics || {},
      featureFlagEnabled: true,
      thresholdFeatureFlagEnabled,
      renderMode: mode === 'hybrid' ? 'hybrid' : 'legacy',
    };
    if (mode !== 'hybrid' && result.renderedOffers !== result.legacyOffers) {
      throw new Error('Stage 2D safety assertion failed: renderedOffers must remain legacyOffers.');
    }
    return result;
  } catch (error) {
    addDiagnostic(diagnostics, mode === 'hybrid' ? 'MAPPED_READER_UNAVAILABLE' : 'SHADOW_READ_FAILED', {
      reason: text(error?.code || error?.message || 'UNKNOWN_READ_ERROR'),
    }, 'error');
    if (mode === 'hybrid') {
      const legacyRouteSupported = LEGACY_AVAILABILITY_CITY_KEYS.has(input.pickupCityCode)
        && LEGACY_AVAILABILITY_CITY_KEYS.has(input.returnCityCode);
      const hybridLegacyOffers = legacyRouteSupported ? legacyOffers : [];
      const hybridLegacyEntries = legacyRouteSupported ? legacyEntries : [];
      const renderedOffers = buildHybridCarRentalResult({
        legacyOffers: hybridLegacyOffers,
        legacyEntries: hybridLegacyEntries,
        mappedOffers: [],
        diagnostics,
        mappedReaderAvailable: false,
      });
      return {
        legacyOffers,
        mappedOffers: [],
        renderedOffers,
        comparison: compareCarRentalAvailability(hybridLegacyEntries, [], diagnostics),
        diagnostics,
        metrics: repository?.getMetrics ? repository.getMetrics() : {},
        featureFlagEnabled: featureFlagEnabled ? true : null,
        thresholdFeatureFlagEnabled,
        renderMode: 'hybrid-fallback',
      };
    }
    const result = baseResult(
      legacyOffers,
      diagnostics,
      repository?.getMetrics ? repository.getMetrics() : {},
    );
    result.comparison = compareCarRentalAvailability(legacyEntries, [], diagnostics);
    return result;
  }
}

export function buildCarRentalAvailabilityInputFingerprint(input = {}) {
  return JSON.stringify({
    pickupCityCode: normalizeConfiguredCity(input.pickupCityCode),
    returnCityCode: normalizeConfiguredCity(input.returnCityCode),
    pickupPlaceType: normalized(input.pickupPlaceType) || 'hotel',
    returnPlaceType: normalized(input.returnPlaceType) || 'hotel',
    pickupDate: text(input.pickupDate),
    pickupTime: text(input.pickupTime) || '10:00',
    returnDate: text(input.returnDate),
    returnTime: text(input.returnTime) || '10:00',
    passengers: Math.max(1, Math.floor(Number(input.passengers) || 1)),
    fullInsurance: input.fullInsurance === true,
    youngDriver: input.youngDriver === true,
    language: normalized(input.language) || 'en',
    platform: normalized(input.filters?.platform),
    allowedOfferIds: unique(input.filters?.allowedOfferIds).sort(),
    carType: unique(Array.isArray(input.filters?.carType) ? input.filters.carType : [input.filters?.carType]).map(normalized).sort(),
    transmission: unique(Array.isArray(input.filters?.transmission) ? input.filters.transmission : [input.filters?.transmission]).map(normalized).sort(),
    fuel: unique(Array.isArray(input.filters?.fuel) ? input.filters.fuel : [input.filters?.fuel]).map(normalized).sort(),
    requireNorthAllowed: typeof input.filters?.requireNorthAllowed === 'boolean'
      ? input.filters.requireNorthAllowed
      : null,
    legacyOfferIds: (input.legacyOffers || []).map((offer) => text(offer?.id)),
  });
}
