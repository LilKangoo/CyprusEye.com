(function registerCarRentalMulticityCore(root) {
  'use strict';

  const LEGACY_LOCATIONS = Object.freeze(['larnaca', 'paphos']);
  const LEGACY_PRICING_KEYS = Object.freeze([
    'larnaca',
    'nicosia',
    'ayia-napa',
    'protaras',
    'limassol',
    'paphos',
  ]);
  const LEGACY_CITY_FEE_PREVIEW = Object.freeze({
    larnaca: 0,
    nicosia: 15,
    'ayia-napa': 15,
    protaras: 20,
    limassol: 20,
    paphos: 40,
  });
  const PLACE_TYPES = Object.freeze(['city', 'airport', 'hotel', 'port', 'station', 'address']);
  const VEHICLE_IMAGE_BUCKET = 'car-images';
  const VEHICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
  const VEHICLE_IMAGE_MIME_TYPES = Object.freeze([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]);
  const VEHICLE_IMAGE_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'webp']);
  const PENDING_IMAGE_URL = '$car_multicity_pending_image_url';
  const PRICING_STRATEGIES = Object.freeze(['legacy_compat', 'threshold_daily_rate']);
  const INSURANCE_MODES = Object.freeze([
    'legacy_optional_daily',
    'optional_daily',
    'included',
    'not_offered',
  ]);
  const DAILY_RATE_TIER_COLUMNS = Object.freeze([
    'id',
    'offer_id',
    'threshold_days',
    'daily_rate',
    'is_active',
  ]);
  const PRICE_COLUMNS = Object.freeze([
    'price_per_day',
    'price_3days',
    'price_4_6days',
    'price_7_10days',
    'price_10plus_days',
  ]);
  const PROFILE_PRICE_COLUMNS = Object.freeze({
    larnaca: Object.freeze(['price_per_day']),
    paphos: Object.freeze(['price_3days', 'price_4_6days', 'price_7_10days', 'price_10plus_days']),
  });
  const VEHICLE_COLUMNS = Object.freeze([
    'vehicle_kind_id',
    'car_type',
    'car_model',
    'transmission',
    'fuel_type',
    'engine_capacity_cc',
    'required_licence_category',
    'minimum_driver_age',
    'max_passengers',
    'max_luggage',
    'stock_count',
    'sort_order',
    'is_available',
    'north_allowed',
    'image_url',
    'description',
    'features',
  ]);
  const PROFILE_COLUMNS = Object.freeze(['pricing_profile_id', 'location']);
  const PRICING_EDIT_COLUMNS = Object.freeze([
    ...PROFILE_COLUMNS,
    'pricing_strategy',
    'min_rental_days',
    'max_rental_days',
    'currency',
    'insurance_mode',
    'insurance_per_day',
    'young_driver_fee',
    'young_driver_cost',
    'deposit_amount',
    ...PRICE_COLUMNS,
  ]);
  const PARTNER_COLUMNS = Object.freeze(['owner_partner_id']);
  const ACTIVATION_COLUMNS = Object.freeze([
    'availability_mode',
    'is_available',
    'is_published',
    'submission_status',
  ]);
  const AVAILABILITY_COLUMNS = Object.freeze([
    'offer_id',
    'city_id',
    'pickup_enabled',
    'return_enabled',
    'is_active',
    'fee_mode',
    'fee_per_direction',
    'fee_note',
  ]);
  const CREATE_COLUMNS = Object.freeze([
    ...VEHICLE_COLUMNS,
    ...PRICE_COLUMNS,
    'currency',
    'insurance_per_day',
    'insurance_mode',
    'young_driver_fee',
    'young_driver_cost',
    'deposit_amount',
    'pricing_strategy',
    'min_rental_days',
    'max_rental_days',
    'pricing_profile_id',
    'location',
    'owner_partner_id',
    'availability_mode',
  ]);

  function clone(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeId(value) {
    return String(value || '').trim();
  }

  function normalizeCode(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeNullableCode(value) {
    const code = normalizeCode(value);
    return code || null;
  }

  function normalizeText(value) {
    return String(value ?? '').trim();
  }

  function normalizeI18n(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return clone(value);
    const text = normalizeText(value);
    return { pl: text, en: text, he: text };
  }

  function resolveI18nText(value, preferredLanguage = 'en') {
    if (typeof value === 'string' || typeof value === 'number') return normalizeText(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const preferred = normalizeCode(preferredLanguage) || 'en';
    const orderedKeys = Array.from(new Set([
      preferred,
      'en',
      'pl',
      'he',
      ...Object.keys(value).sort(),
    ]));
    for (const key of orderedKeys) {
      const candidate = value[key];
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        const normalized = normalizeText(candidate);
        if (normalized) return normalized;
      }
    }
    return '';
  }

  function preserveI18nValue(currentValue, originalValue) {
    const normalizedCurrent = normalizeI18n(currentValue);
    if (originalValue === undefined) return normalizedCurrent;
    const normalizedOriginal = normalizeI18n(originalValue);
    return stableSerialize(normalizedCurrent) === stableSerialize(normalizedOriginal)
      ? clone(originalValue)
      : normalizedCurrent;
  }

  function imageExtension(filename) {
    const normalized = normalizeText(filename).toLowerCase();
    const match = normalized.match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  function validateVehicleImageFile(file) {
    const errors = [];
    if (!file || typeof file !== 'object') {
      errors.push({ field: 'vehicleImage', message: 'Select an image file.' });
      return { valid: false, errors, metadata: null };
    }
    const name = normalizeText(file.name);
    const type = normalizeText(file.type).toLowerCase();
    const size = Number(file.size);
    const extension = imageExtension(name);
    if (!VEHICLE_IMAGE_MIME_TYPES.includes(type) || !VEHICLE_IMAGE_EXTENSIONS.includes(extension)) {
      errors.push({ field: 'vehicleImage', message: 'Only JPG, JPEG, PNG and WEBP images are allowed.' });
    }
    if (!Number.isFinite(size) || size <= 0) {
      errors.push({ field: 'vehicleImage', message: 'The selected image is empty or invalid.' });
    } else if (size > VEHICLE_IMAGE_MAX_BYTES) {
      errors.push({ field: 'vehicleImage', message: 'Image is too large. Maximum size is 5 MB.' });
    }
    return {
      valid: errors.length === 0,
      errors,
      metadata: errors.length ? null : {
        name,
        type,
        size,
        extension,
        lastModified: Number(file.lastModified) || null,
      },
    };
  }

  function setVehicleImageAction(draft, action, metadata = null) {
    if (!draft?.media) throw new Error('Vehicle media draft is unavailable');
    const allowed = ['unchanged', 'added', 'replaced', 'removed'];
    if (!allowed.includes(action)) throw new Error(`Unsupported image action: ${action}`);
    draft.media.action = action;
    draft.media.pendingFile = action === 'added' || action === 'replaced' ? clone(metadata) : null;
    invalidateReview(draft);
    return draft.media;
  }

  function pairedAvailabilityState(row) {
    const pickup = row?.pickup_enabled === true;
    const dropoff = row?.return_enabled === true;
    return {
      checked: pickup && dropoff,
      mismatched: pickup !== dropoff,
      pickupEnabled: pickup,
      returnEnabled: dropoff,
    };
  }

  function directionalAvailabilityState(row) {
    const pickupEnabled = row?.pickup_enabled === true;
    const returnEnabled = row?.return_enabled === true;
    return {
      pickupEnabled,
      returnEnabled,
      isActive: row?.is_active === true,
      mode: pickupEnabled && returnEnabled
        ? 'both'
        : pickupEnabled
          ? 'pickup-only'
          : returnEnabled
            ? 'return-only'
            : 'off',
    };
  }

  function ensureAvailabilityRow(draft, cityId) {
    const exactCityId = normalizeId(cityId);
    if (!draft || !exactCityId) throw new Error('Exact city ID is required');
    let row = (draft.availability || []).find((entry) => normalizeId(entry.city_id) === exactCityId);
    if (!row) {
      row = {
        offer_id: normalizeId(draft.offerId) || null,
        city_id: exactCityId,
        pickup_enabled: false,
        return_enabled: false,
        is_active: false,
        fee_mode: 'inherit',
        fee_per_direction: null,
        fee_note: null,
        updated_at: null,
      };
      draft.availability.push(row);
    }
    return row;
  }

  function setDirectionalAvailability(draft, cityId, direction, checked) {
    if (!['pickup', 'return'].includes(direction)) throw new Error('Availability direction must be pickup or return');
    const row = ensureAvailabilityRow(draft, cityId);
    row[direction === 'pickup' ? 'pickup_enabled' : 'return_enabled'] = checked === true;
    row.is_active = row.pickup_enabled === true || row.return_enabled === true;
    invalidateReview(draft);
    return row;
  }

  function setPairedAvailability(draft, cityId, checked) {
    const row = ensureAvailabilityRow(draft, cityId);
    const enabled = checked === true;
    row.pickup_enabled = enabled;
    row.return_enabled = enabled;
    row.is_active = enabled;
    invalidateReview(draft);
    return row;
  }

  function setAvailabilityFee(draft, cityId, mode, amount = null, note = null) {
    const exactCityId = normalizeId(cityId);
    if (!draft || !exactCityId) throw new Error('Exact city ID is required');
    const row = ensureAvailabilityRow(draft, exactCityId);
    const normalizedMode = normalizeCode(mode);
    if (!['inherit', 'override'].includes(normalizedMode)) throw new Error('Unsupported city fee mode');
    const normalizedAmount = normalizedMode === 'override' ? normalizeMoney(amount) : null;
    const amountProvided = amount !== '' && amount !== null && amount !== undefined;
    if (normalizedMode === 'override' && amountProvided && (
      !(normalizedAmount >= 0)
      || !Number.isFinite(normalizedAmount)
      || !hasAtMostTwoDecimals(amount)
    )) {
      throw new Error('Custom fee per direction must be zero or greater');
    }
    row.fee_mode = normalizedMode;
    row.fee_per_direction = normalizedAmount;
    row.fee_note = normalizeText(note) || null;
    invalidateReview(draft);
    return row;
  }

  function normalizeNullableId(value) {
    const id = normalizeId(value);
    return id || null;
  }

  function normalizeInteger(value, fallback = null) {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  function normalizeMoney(value, fallback = null) {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
  }

  function normalizeDailyRate(value, fallback = null) {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 1000000) / 1000000 : fallback;
  }

  function hasAtMostTwoDecimals(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && Math.abs((parsed * 100) - Math.round(parsed * 100)) < 1e-8;
  }

  function hasAtMostSixDecimals(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && Math.abs((parsed * 1000000) - Math.round(parsed * 1000000)) < 1e-6;
  }

  function normalizeDailyRateTier(row, offerId = null) {
    return {
      id: normalizeId(row?.id) || null,
      clientKey: normalizeId(row?.clientKey || row?.id)
        || `tier-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      offer_id: normalizeId(row?.offer_id || offerId) || null,
      threshold_days: normalizeInteger(row?.threshold_days),
      daily_rate: normalizeDailyRate(row?.daily_rate),
      is_active: row?.is_active !== false,
      updated_at: row?.updated_at || null,
    };
  }

  function sortDailyRateTiers(tiers = []) {
    return (tiers || []).map((row) => normalizeDailyRateTier(row, row?.offer_id)).sort((left, right) => (
      (left.threshold_days ?? Number.MAX_SAFE_INTEGER) - (right.threshold_days ?? Number.MAX_SAFE_INTEGER)
      || String(left.id || left.clientKey).localeCompare(String(right.id || right.clientKey))
    ));
  }

  function effectiveThresholdMinimum(tiers = []) {
    const thresholds = sortDailyRateTiers(tiers)
      .filter((tier) => tier.is_active && Number.isInteger(tier.threshold_days) && tier.threshold_days > 0)
      .map((tier) => tier.threshold_days);
    return thresholds.length ? thresholds[0] : null;
  }

  function selectDailyRateTier(tiers, rentalDays) {
    const days = normalizeInteger(rentalDays);
    if (!(days > 0)) return null;
    const eligible = sortDailyRateTiers(tiers).filter((tier) => (
      tier.is_active
      && Number.isInteger(tier.threshold_days)
      && tier.threshold_days > 0
      && tier.threshold_days <= days
      && Number.isFinite(tier.daily_rate)
      && tier.daily_rate > 0
    ));
    return eligible.length ? eligible[eligible.length - 1] : null;
  }

  function calculateThresholdBasePrice(tiers, rentalDays, maxRentalDays = null) {
    const days = normalizeInteger(rentalDays);
    const maximum = normalizeInteger(maxRentalDays);
    if (!(days > 0) || (maximum !== null && days > maximum)) return null;
    const tier = selectDailyRateTier(tiers, days);
    if (!tier) return null;
    return {
      rentalDays: days,
      thresholdDays: tier.threshold_days,
      dailyRate: tier.daily_rate,
      baseRentalPrice: normalizeMoney(tier.daily_rate * days),
      tierId: tier.id,
    };
  }

  function synchronizeThresholdMinimum(draft) {
    if (!draft?.pricing) return null;
    const minimum = effectiveThresholdMinimum(draft.pricing.dailyRateTiers || []);
    draft.pricing.minRentalDays = minimum;
    invalidateReview(draft);
    return minimum;
  }

  function addDailyRateTier(draft, input = {}) {
    if (!draft?.pricing) throw new Error('Pricing draft is unavailable');
    const tier = normalizeDailyRateTier({ ...input, offer_id: draft.offerId || null }, draft.offerId);
    draft.pricing.dailyRateTiers = sortDailyRateTiers([...(draft.pricing.dailyRateTiers || []), tier]);
    synchronizeThresholdMinimum(draft);
    return tier;
  }

  function updateDailyRateTier(draft, key, patch = {}) {
    const exactKey = normalizeId(key);
    const tier = (draft?.pricing?.dailyRateTiers || []).find((row) => (
      normalizeId(row.id || row.clientKey) === exactKey
    ));
    if (!tier) throw new Error('Exact daily-rate tier is missing');
    if (Object.prototype.hasOwnProperty.call(patch, 'threshold_days')) tier.threshold_days = normalizeInteger(patch.threshold_days);
    if (Object.prototype.hasOwnProperty.call(patch, 'daily_rate')) tier.daily_rate = normalizeDailyRate(patch.daily_rate);
    if (Object.prototype.hasOwnProperty.call(patch, 'is_active')) tier.is_active = patch.is_active === true;
    draft.pricing.dailyRateTiers = sortDailyRateTiers(draft.pricing.dailyRateTiers);
    synchronizeThresholdMinimum(draft);
    return tier;
  }

  function removeDailyRateTier(draft, key) {
    const exactKey = normalizeId(key);
    const before = draft?.pricing?.dailyRateTiers || [];
    const next = before.filter((row) => normalizeId(row.id || row.clientKey) !== exactKey);
    if (next.length === before.length) throw new Error('Exact daily-rate tier is missing');
    draft.pricing.dailyRateTiers = sortDailyRateTiers(next);
    synchronizeThresholdMinimum(draft);
    return true;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }

  function stableSerialize(value) {
    return JSON.stringify(stableValue(value));
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function valuesEqual(left, right) {
    if (typeof left === 'number' || typeof right === 'number') {
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
    }
    return stableSerialize(left ?? null) === stableSerialize(right ?? null);
  }

  function profileById(context, profileId) {
    const id = normalizeId(profileId);
    return (context?.profiles || []).find((profile) => normalizeId(profile?.id) === id) || null;
  }

  function profileByCode(context, code) {
    const normalized = normalizeCode(code);
    return (context?.profiles || []).find((profile) => normalizeCode(profile?.code) === normalized) || null;
  }

  function cityById(context, cityId) {
    const id = normalizeId(cityId);
    return (context?.cities || []).find((city) => normalizeId(city?.id) === id) || null;
  }

  function mappingFor(context, profileId, cityId) {
    const profile = normalizeId(profileId);
    const city = normalizeId(cityId);
    return (context?.profileCities || []).find((mapping) => (
      normalizeId(mapping?.pricing_profile_id) === profile
      && normalizeId(mapping?.city_id) === city
    )) || null;
  }

  function profileLocation(profile) {
    const location = normalizeCode(profile?.legacy_booking_location);
    return LEGACY_LOCATIONS.includes(location) ? location : '';
  }

  function assertProfileContract(profile) {
    if (!profile) throw new Error('Pricing profile is required');
    const code = normalizeCode(profile.code);
    const calculatorKey = normalizeCode(profile.calculator_key);
    const location = profileLocation(profile);
    if (!LEGACY_LOCATIONS.includes(code) || calculatorKey !== code || location !== code) {
      throw new Error(`Unsupported pricing profile contract: ${code || 'unknown'}`);
    }
    return location;
  }

  function defaultAvailabilityRows(context, profileId) {
    const profile = profileById(context, profileId);
    if (!profile) return [];
    const location = assertProfileContract(profile);
    const mapping = (context?.profileCities || []).find((row) => (
      normalizeId(row?.pricing_profile_id) === normalizeId(profile.id)
      && normalizeCode(row?.legacy_pricing_city_key) === location
      && row?.is_active === true
    ));
    if (!mapping) return [];
    return [{
      offer_id: null,
      city_id: normalizeId(mapping.city_id),
      pickup_enabled: mapping.pickup_supported === true,
      return_enabled: mapping.return_supported === true,
      is_active: true,
      fee_mode: 'inherit',
      fee_per_direction: null,
      fee_note: null,
      updated_at: null,
    }];
  }

  function normalizeAvailabilityRow(row, offerId = null) {
    return {
      id: normalizeId(row?.id) || null,
      offer_id: normalizeId(row?.offer_id || offerId) || null,
      city_id: normalizeId(row?.city_id),
      pickup_enabled: row?.pickup_enabled === true,
      return_enabled: row?.return_enabled === true,
      is_active: row?.is_active === true,
      fee_mode: normalizeCode(row?.fee_mode) === 'override' ? 'override' : 'inherit',
      fee_per_direction: normalizeCode(row?.fee_mode) === 'override'
        ? normalizeMoney(row?.fee_per_direction)
        : null,
      fee_note: normalizeText(row?.fee_note) || null,
      updated_at: row?.updated_at || null,
    };
  }

  function inheritedFeeIsSupported(profile, mapping) {
    const profileCode = normalizeCode(profile?.calculator_key || profile?.code);
    const key = normalizeCode(mapping?.legacy_pricing_city_key);
    if (profileCode === 'larnaca') return LEGACY_PRICING_KEYS.includes(key);
    return profileCode === 'paphos' && key === 'paphos';
  }

  function getAvailabilityFeeState(row, profile, mapping) {
    const mode = normalizeCode(row?.fee_mode) === 'override' ? 'override' : 'inherit';
    const amount = mode === 'override' ? normalizeMoney(row?.fee_per_direction) : null;
    const inherited = inheritedFeeIsSupported(profile, mapping);
    const profileCode = normalizeCode(profile?.calculator_key || profile?.code);
    const key = normalizeCode(mapping?.legacy_pricing_city_key);
    const standardAmount = profileCode === 'larnaca' && inherited
      ? LEGACY_CITY_FEE_PREVIEW[key]
      : null;
    const valid = mode === 'override'
      ? Number.isFinite(amount) && amount >= 0
      : inherited;
    return {
      mode,
      amount,
      valid,
      inherited,
      standardAmount,
      effectiveAmount: mode === 'override' ? amount : standardAmount,
      requiresOverride: mode === 'inherit' && !inherited,
    };
  }

  function createDraft(context = {}, options = {}) {
    const offer = clone(context.offer || null);
    const selectedProfile = profileById(context, offer?.pricing_profile_id)
      || profileByCode(context, offer?.location)
      || null;
    const isCreate = options.mode === 'create' || !offer;
    const availability = isCreate
      ? defaultAvailabilityRows(context, selectedProfile?.id)
      : (context.availability || []).map((row) => normalizeAvailabilityRow(row, offer?.id));
    const initialProfileId = normalizeId(selectedProfile?.id);
    const defaultKind = (context.vehicleKinds || []).find((kind) => normalizeCode(kind?.code) === 'car') || null;

    return {
      version: 1,
      mode: options.mode || (isCreate ? 'create' : 'vehicle'),
      step: 0,
      offerId: normalizeId(offer?.id) || null,
      expectedUpdatedAt: offer?.updated_at || null,
      snapshot: clone({ ...context, offer }),
      vehicle: {
        vehicleKindId: normalizeId(offer?.vehicle_kind_id || defaultKind?.id),
        carType: normalizeI18n(offer?.car_type ?? ''),
        carModel: clone(offer?.car_model || { pl: '', en: '', he: '' }),
        transmission: isCreate ? normalizeCode(offer?.transmission || 'manual') : normalizeNullableCode(offer?.transmission),
        fuelType: isCreate ? normalizeCode(offer?.fuel_type || 'petrol') : normalizeNullableCode(offer?.fuel_type),
        engineCapacityCc: normalizeInteger(offer?.engine_capacity_cc),
        requiredLicenceCategory: normalizeText(offer?.required_licence_category),
        minimumDriverAge: normalizeInteger(offer?.minimum_driver_age),
        maxPassengers: normalizeInteger(offer?.max_passengers, isCreate ? 5 : null),
        maxLuggage: normalizeInteger(offer?.max_luggage, isCreate ? 2 : null),
        stockCount: normalizeInteger(offer?.stock_count, 1),
        sortOrder: normalizeInteger(offer?.sort_order, 1000),
        isAvailable: offer?.is_available !== false,
        northAllowed: offer?.north_allowed === true,
        imageUrl: normalizeText(offer?.image_url),
      },
      media: {
        action: 'unchanged',
        currentUrl: normalizeText(offer?.image_url),
        pendingFile: null,
      },
      content: {
        description: clone(offer?.description || { pl: '', en: '', he: '' }),
        features: clone(offer?.features || { pl: [], en: [], he: [] }),
      },
      pricing: {
        strategy: PRICING_STRATEGIES.includes(normalizeCode(offer?.pricing_strategy))
          ? normalizeCode(offer.pricing_strategy)
          : 'legacy_compat',
        profileId: initialProfileId,
        location: selectedProfile ? profileLocation(selectedProfile) : normalizeCode(offer?.location),
        currency: normalizeText(offer?.currency || 'EUR').toUpperCase(),
        pricePerDay: normalizeMoney(offer?.price_per_day),
        price3Days: normalizeMoney(offer?.price_3days),
        price4To6Days: normalizeMoney(offer?.price_4_6days),
        price7To10Days: normalizeMoney(offer?.price_7_10days),
        price10PlusDays: normalizeMoney(offer?.price_10plus_days),
        insurancePerDay: normalizeMoney(offer?.insurance_per_day, 0),
        insuranceMode: INSURANCE_MODES.includes(normalizeCode(offer?.insurance_mode))
          ? normalizeCode(offer.insurance_mode)
          : 'legacy_optional_daily',
        youngDriverFee: offer?.young_driver_fee === true,
        youngDriverCost: normalizeMoney(offer?.young_driver_cost, 0),
        securityDepositMode: offer?.deposit_amount === null || offer?.deposit_amount === undefined
          ? 'unspecified'
          : Number(offer.deposit_amount) === 0 ? 'none' : 'amount',
        securityDepositAmount: normalizeMoney(offer?.deposit_amount),
        minRentalDays: normalizeInteger(offer?.min_rental_days, isCreate ? 3 : 1),
        maxRentalDays: normalizeInteger(offer?.max_rental_days),
        dailyRateTiers: sortDailyRateTiers(
          (context.dailyRateTiers || []).map((tier) => normalizeDailyRateTier(tier, offer?.id)),
        ),
      },
      availability,
      partner: {
        ownerPartnerId: normalizeNullableId(offer?.owner_partner_id),
      },
      activation: {
        action: null,
        availabilityMode: normalizeCode(offer?.availability_mode) === 'mapped' ? 'mapped' : 'legacy',
        isAvailable: offer?.is_available === true,
        isPublished: offer?.is_published === true,
        submissionStatus: ['draft', 'pending', 'approved', 'rejected'].includes(normalizeCode(offer?.submission_status))
          ? normalizeCode(offer.submission_status)
          : 'draft',
      },
      publicMode: normalizeCode(offer?.availability_mode) === 'mapped' ? 'mapped' : 'legacy',
      globalMappedFlag: context.siteSetting?.car_multi_city_mapped_enabled === true,
      globalThresholdFlag: context.siteSetting?.car_threshold_daily_rates_enabled === true,
      validation: { errors: [], warnings: [] },
      review: { isCurrent: false, fingerprint: null, plan: null },
    };
  }

  function setDraftProfile(draft, context, profileId, options = {}) {
    const profile = profileById(context, profileId);
    const location = assertProfileContract(profile);
    draft.pricing.profileId = normalizeId(profile.id);
    draft.pricing.location = location;
    if (options.resetAvailability === true) {
      draft.availability = defaultAvailabilityRows(context, profile.id);
    }
    invalidateReview(draft);
    return draft;
  }

  function vehiclePayload(draft) {
    const originalOffer = draft?.snapshot?.offer || null;
    const imageAction = draft?.media?.action || 'unchanged';
    const imageUrl = imageAction === 'removed'
      ? null
      : imageAction === 'added' || imageAction === 'replaced'
        ? PENDING_IMAGE_URL
        : normalizeText(draft?.media?.currentUrl || draft?.vehicle?.imageUrl) || null;
    return {
      vehicle_kind_id: normalizeId(draft.vehicle.vehicleKindId),
      car_type: preserveI18nValue(draft.vehicle.carType, originalOffer?.car_type),
      car_model: preserveI18nValue(draft.vehicle.carModel, originalOffer?.car_model),
      transmission: normalizeNullableCode(draft.vehicle.transmission),
      fuel_type: normalizeNullableCode(draft.vehicle.fuelType),
      engine_capacity_cc: normalizeInteger(draft.vehicle.engineCapacityCc),
      required_licence_category: normalizeText(draft.vehicle.requiredLicenceCategory) || null,
      minimum_driver_age: normalizeInteger(draft.vehicle.minimumDriverAge),
      max_passengers: normalizeInteger(draft.vehicle.maxPassengers),
      max_luggage: normalizeInteger(draft.vehicle.maxLuggage),
      stock_count: normalizeInteger(draft.vehicle.stockCount),
      sort_order: normalizeInteger(draft.vehicle.sortOrder),
      is_available: draft.vehicle.isAvailable === true,
      north_allowed: draft.vehicle.northAllowed === true,
      image_url: imageUrl,
      description: preserveI18nValue(draft.content.description, originalOffer?.description),
      features: clone(draft.content.features || {}),
    };
  }

  function profilePayload(draft, context) {
    const profile = profileById(context, draft.pricing.profileId);
    return {
      pricing_profile_id: normalizeId(profile?.id),
      location: assertProfileContract(profile),
    };
  }

  function partnerPayload(draft) {
    return { owner_partner_id: normalizeNullableId(draft.partner.ownerPartnerId) };
  }

  function activationPayload(draft) {
    const action = normalizeCode(draft?.activation?.action);
    if (action === 'activate') {
      return {
        availability_mode: 'mapped',
        is_available: true,
        is_published: true,
        submission_status: 'approved',
      };
    }
    if (action === 'unpublish') return { is_published: false };
    throw new Error('Activation action is missing');
  }

  function pricingPayload(draft) {
    const securityDepositMode = normalizeCode(draft.pricing.securityDepositMode);
    return {
      pricing_strategy: 'legacy_compat',
      min_rental_days: normalizeInteger(draft.pricing.minRentalDays, 1),
      max_rental_days: normalizeInteger(draft.pricing.maxRentalDays),
      currency: normalizeText(draft.pricing.currency || 'EUR').toUpperCase(),
      price_per_day: normalizeMoney(draft.pricing.pricePerDay),
      price_3days: normalizeMoney(draft.pricing.price3Days),
      price_4_6days: normalizeMoney(draft.pricing.price4To6Days),
      price_7_10days: normalizeMoney(draft.pricing.price7To10Days),
      price_10plus_days: normalizeMoney(draft.pricing.price10PlusDays),
      insurance_per_day: normalizeMoney(draft.pricing.insurancePerDay, 0),
      insurance_mode: INSURANCE_MODES.includes(normalizeCode(draft.pricing.insuranceMode))
        ? normalizeCode(draft.pricing.insuranceMode)
        : 'legacy_optional_daily',
      young_driver_fee: draft.pricing.youngDriverFee === true,
      young_driver_cost: normalizeMoney(draft.pricing.youngDriverCost, 0),
      deposit_amount: securityDepositMode === 'unspecified'
        ? null
        : securityDepositMode === 'none' ? 0 : normalizeMoney(draft.pricing.securityDepositAmount),
    };
  }

  function pricingEditPayload(draft, context) {
    const strategy = PRICING_STRATEGIES.includes(normalizeCode(draft.pricing.strategy))
      ? normalizeCode(draft.pricing.strategy)
      : 'legacy_compat';
    const profile = profileById(context, draft.pricing.profileId);
    const code = normalizeCode(profile?.code);
    const securityDepositMode = normalizeCode(draft.pricing.securityDepositMode);
    const payload = {
      ...(strategy === 'legacy_compat' ? profilePayload(draft, context) : {}),
      pricing_strategy: strategy,
      min_rental_days: strategy === 'threshold_daily_rate'
        ? effectiveThresholdMinimum(draft.pricing.dailyRateTiers)
        : normalizeInteger(draft.pricing.minRentalDays, 1),
      max_rental_days: normalizeInteger(draft.pricing.maxRentalDays),
      currency: normalizeText(draft.pricing.currency || 'EUR').toUpperCase(),
      insurance_mode: INSURANCE_MODES.includes(normalizeCode(draft.pricing.insuranceMode))
        ? normalizeCode(draft.pricing.insuranceMode)
        : 'legacy_optional_daily',
      insurance_per_day: normalizeMoney(draft.pricing.insurancePerDay, 0),
      young_driver_fee: draft.pricing.youngDriverFee === true,
      young_driver_cost: normalizeMoney(draft.pricing.youngDriverCost, 0),
      deposit_amount: securityDepositMode === 'unspecified'
        ? null
        : securityDepositMode === 'none' ? 0 : normalizeMoney(draft.pricing.securityDepositAmount),
    };
    const fieldValues = {
      price_per_day: draft.pricing.pricePerDay,
      price_3days: draft.pricing.price3Days,
      price_4_6days: draft.pricing.price4To6Days,
      price_7_10days: draft.pricing.price7To10Days,
      price_10plus_days: draft.pricing.price10PlusDays,
    };
    if (strategy === 'legacy_compat') {
      (PROFILE_PRICE_COLUMNS[code] || []).forEach((column) => {
        payload[column] = normalizeMoney(fieldValues[column]);
      });
    }
    return payload;
  }

  function validateAvailability(draft, context, errors) {
    const thresholdStrategy = normalizeCode(draft?.pricing?.strategy) === 'threshold_daily_rate';
    const profile = profileById(context, draft.pricing.profileId);
    if (!thresholdStrategy && !profile) {
      errors.push({ field: 'pricingProfileId', message: 'Select an exact pricing profile.' });
      return;
    }
    if (!thresholdStrategy) {
      try {
        assertProfileContract(profile);
      } catch (error) {
        errors.push({ field: 'pricingProfileId', message: error.message });
        return;
      }
    }

    const seen = new Set();
    (draft.availability || []).forEach((row, index) => {
      const cityId = normalizeId(row?.city_id);
      if (!cityId || seen.has(cityId)) {
        errors.push({ field: `availability-${index}`, message: 'Each availability row must use one exact city ID.' });
        return;
      }
      seen.add(cityId);
      if (!row?.pickup_enabled && !row?.return_enabled) {
        if (row?.is_active === true) {
          errors.push({ field: `availability-${cityId}`, message: 'An active city row must enable pickup or return.' });
        }
        if (normalizeText(row.fee_note).length > 500) {
          errors.push({ field: `fee-${cityId}`, message: 'Fee note must not exceed 500 characters.' });
        }
        return;
      }
      const mapping = thresholdStrategy ? null : mappingFor(context, profile.id, cityId);
      const fee = thresholdStrategy
        ? {
          mode: normalizeCode(row?.fee_mode) === 'override' ? 'override' : 'inherit',
          valid: normalizeCode(row?.fee_mode) === 'override'
            ? Number.isFinite(normalizeMoney(row?.fee_per_direction)) && normalizeMoney(row?.fee_per_direction) >= 0
            : LEGACY_PRICING_KEYS.includes(normalizeCode(cityById(context, cityId)?.code)),
        }
        : getAvailabilityFeeState(row, profile, mapping);
      if (fee.mode === 'override' && (!fee.valid || !hasAtMostTwoDecimals(row.fee_per_direction))) {
        errors.push({ field: `fee-${cityId}`, message: 'Custom fee per direction must be a finite amount of zero or greater.' });
      }
      if (normalizeText(row.fee_note).length > 500) {
        errors.push({ field: `fee-${cityId}`, message: 'Fee note must not exceed 500 characters.' });
      }
      const city = cityById(context, cityId);
      if (!city || city.is_active !== true) {
        errors.push({ field: `availability-${cityId}`, message: 'Selected city is inactive or missing.' });
        return;
      }
      if (thresholdStrategy) {
        if (fee.mode === 'inherit' && !LEGACY_PRICING_KEYS.includes(normalizeCode(city.code))) {
          errors.push({ field: `fee-${cityId}`, message: 'A custom fee is required for this city.' });
        }
        return;
      }
      if (!mapping || mapping.is_active !== true || !normalizeCode(mapping.legacy_pricing_city_key)) {
        errors.push({ field: `availability-${cityId}`, message: 'Selected city has no active legacy pricing mapping.' });
        return;
      }
      if (normalizeCode(mapping.legacy_pricing_city_key) !== normalizeCode(city.code)) {
        errors.push({ field: `availability-${cityId}`, message: 'Pricing key does not match the exact city code.' });
      }
      if (normalizeCode(profile.code) === 'paphos' && (
        normalizeCode(city.code) !== 'paphos'
        || normalizeCode(mapping.legacy_pricing_city_key) !== 'paphos'
      )) {
        errors.push({ field: `availability-${cityId}`, message: 'Paphos profile cannot be used outside Paphos.' });
      }
      if (row.pickup_enabled && mapping.pickup_supported !== true) {
        errors.push({ field: `pickup-${cityId}`, message: 'Pickup is not supported by this profile-city mapping.' });
      }
      if (row.return_enabled && mapping.return_supported !== true) {
        errors.push({ field: `return-${cityId}`, message: 'Return is not supported by this profile-city mapping.' });
      }
    });
  }

  function getActivationReadiness(draft, context = draft?.snapshot || {}) {
    const structural = getMappedReadiness(draft, context);
    const reasons = [...structural.reasons];
    if (normalizeCode(draft?.pricing?.strategy) !== 'threshold_daily_rate') {
      reasons.push('Activate / Publish is available only for exact offers using threshold daily-rate pricing.');
    }
    const partnerId = normalizeNullableId(draft?.partner?.ownerPartnerId || context?.offer?.owner_partner_id);
    const partner = (context?.partners || []).find((row) => normalizeId(row?.id) === partnerId) || null;
    if (!partnerId) reasons.push('An exact owner partner is required before publication.');
    else if (!partner || partner.status !== 'active' || partner.can_manage_cars !== true) {
      reasons.push('The exact owner partner is not active for Cars.');
    }
    if (!(Number(context?.offer?.stock_count) > 0)) reasons.push('Stock must be greater than zero before publication.');
    if (normalizeCode(draft?.pricing?.strategy) === 'threshold_daily_rate') {
      const activeTiers = sortDailyRateTiers(draft?.pricing?.dailyRateTiers || []).filter((tier) => tier.is_active);
      const thresholds = new Set();
      if (activeTiers.some((tier) => {
        const duplicate = thresholds.has(tier.threshold_days);
        thresholds.add(tier.threshold_days);
        return duplicate
          || !(Number.isInteger(tier.threshold_days) && tier.threshold_days > 0)
          || !(tier.daily_rate > 0)
          || !hasAtMostSixDecimals(tier.daily_rate);
      })) {
        reasons.push('Daily-rate tiers are invalid or duplicated.');
      }
      const minimum = effectiveThresholdMinimum(activeTiers);
      const maximum = normalizeInteger(draft?.pricing?.maxRentalDays);
      if (maximum !== null && minimum !== null && maximum < minimum) {
        reasons.push('Maximum rental days cannot be lower than the effective minimum.');
      }
    }
    const configurationReady = reasons.length === 0;
    const mappedEnabled = context?.siteSetting?.car_multi_city_mapped_enabled === true;
    const thresholdEnabled = context?.siteSetting?.car_threshold_daily_rates_enabled === true;
    const capabilityReasons = [];
    if (!mappedEnabled) capabilityReasons.push('Multi-city mapped rendering is disabled by the global database flag.');
    if (!thresholdEnabled) capabilityReasons.push('Threshold daily-rate pricing is disabled by the global database flag.');
    return {
      ready: configurationReady && mappedEnabled && thresholdEnabled,
      configurationReady,
      capabilityEnabled: mappedEnabled && thresholdEnabled,
      reasons: Array.from(new Set(reasons)),
      capabilityReasons,
      pickupCount: structural.pickupCount,
      returnCount: structural.returnCount,
      partnerId,
    };
  }

  function setActivationIntent(draft, action) {
    if (!draft?.activation) throw new Error('Activation draft is unavailable');
    if (action === 'activate') {
      draft.activation = {
        action,
        availabilityMode: 'mapped',
        isAvailable: true,
        isPublished: true,
        submissionStatus: 'approved',
      };
    } else if (action === 'unpublish') {
      draft.activation.action = action;
      draft.activation.isPublished = false;
    } else {
      throw new Error(`Unsupported activation action: ${action}`);
    }
    invalidateReview(draft);
    return draft.activation;
  }

  function validateActivationDraft(draft, context) {
    const errors = [];
    const warnings = [];
    if (!normalizeId(draft?.offerId)) errors.push({ field: 'offerId', message: 'Exact car offer ID is required.' });
    const action = normalizeCode(draft?.activation?.action);
    if (!['activate', 'unpublish'].includes(action)) {
      errors.push({ field: 'activation', message: 'Choose Activate / Publish or Unpublish before Review.' });
    } else if (action === 'activate') {
      const readiness = getActivationReadiness(draft, context);
      if (draft.activation.availabilityMode !== 'mapped'
        || draft.activation.isAvailable !== true
        || draft.activation.isPublished !== true
        || draft.activation.submissionStatus !== 'approved') {
        errors.push({ field: 'activation', message: 'Activation must atomically set mapped, available, published and approved.' });
      }
      readiness.reasons.forEach((message) => errors.push({ field: 'activation', message }));
      readiness.capabilityReasons.forEach((message) => errors.push({ field: 'activation', message }));
      return { valid: errors.length === 0, errors, warnings, readiness };
    } else {
      if (context?.offer?.is_published !== true) {
        errors.push({ field: 'activation', message: 'This exact offer is already unpublished.' });
      }
      if (draft.activation.isPublished !== false) {
        errors.push({ field: 'activation', message: 'Unpublish must set is_published to false.' });
      }
    }
    return { valid: errors.length === 0, errors, warnings, readiness: getActivationReadiness(draft, context) };
  }

  function validateDraft(draft, context = draft?.snapshot || {}) {
    const errors = [];
    const warnings = [];
    if (!draft || draft.version !== 1) {
      return { valid: false, errors: [{ field: 'draft', message: 'Unsupported draft.' }], warnings };
    }
    if (draft.mode !== 'create' && !normalizeId(draft.offerId)) {
      errors.push({ field: 'offerId', message: 'Exact car offer ID is required.' });
    }
    if (draft.mode === 'activation') {
      const validation = validateActivationDraft(draft, context);
      draft.validation = { errors: clone(validation.errors), warnings: clone(validation.warnings) };
      return validation;
    }
    const strategy = normalizeCode(draft.pricing.strategy);
    const thresholdStrategy = strategy === 'threshold_daily_rate';
    if (!PRICING_STRATEGIES.includes(strategy)) {
      errors.push({ field: 'pricingStrategy', message: 'Select a supported pricing strategy.' });
    }
    const profile = profileById(context, draft.pricing.profileId);
    if ((!thresholdStrategy || draft.mode === 'create') && !profile) {
      errors.push({ field: 'pricingProfileId', message: thresholdStrategy
        ? 'Select a legacy booking compatibility key for the new exact offer.'
        : 'Select a pricing profile.' });
    } else if ((!thresholdStrategy || draft.mode === 'create') && profile.is_active !== true) {
      errors.push({ field: 'pricingProfileId', message: 'Selected compatibility profile is inactive.' });
    }
    const vehicleKind = (context.vehicleKinds || []).find((row) => normalizeId(row?.id) === normalizeId(draft.vehicle.vehicleKindId));
    if (!vehicleKind) errors.push({ field: 'vehicleKindId', message: 'Select an exact vehicle kind.' });
    else if (vehicleKind.is_active !== true) errors.push({ field: 'vehicleKindId', message: 'Selected vehicle kind is inactive.' });
    if (!resolveI18nText(draft.vehicle.carModel, 'en')) {
      errors.push({ field: 'carModel', message: 'Car model is required.' });
    }
    if (!resolveI18nText(draft.vehicle.carType, 'en')) {
      const existingType = resolveI18nText(context?.offer?.car_type, 'en');
      if (draft.mode === 'create' || existingType) {
        errors.push({ field: 'carType', message: 'Commercial car type is required.' });
      } else {
        warnings.push({ field: 'carType', message: 'Legacy commercial car type is empty and will remain unchanged.' });
      }
    }
    if (['added', 'replaced'].includes(draft.media?.action) && !draft.media?.pendingFile) {
      errors.push({ field: 'vehicleImage', message: 'Select a valid image before Review.' });
    }
    if (draft.vehicle.maxPassengers !== null && draft.vehicle.maxPassengers !== '' && (
      normalizeInteger(draft.vehicle.maxPassengers) === null || Number(draft.vehicle.maxPassengers) < 1
    )) {
      errors.push({ field: 'maxPassengers', message: 'Passengers must be a positive integer or empty when not confirmed.' });
    }
    if (draft.vehicle.maxLuggage !== null && draft.vehicle.maxLuggage !== '' && (
      normalizeInteger(draft.vehicle.maxLuggage) === null || Number(draft.vehicle.maxLuggage) < 0
    )) {
      errors.push({ field: 'maxLuggage', message: 'Luggage must be a non-negative integer or empty when not confirmed.' });
    }
    ['stockCount', 'sortOrder'].forEach((field) => {
      if (normalizeInteger(draft.vehicle[field]) === null || Number(draft.vehicle[field]) < 0) {
        errors.push({ field, message: `${field} must be a non-negative integer.` });
      }
    });
    if (draft.vehicle.engineCapacityCc !== null && draft.vehicle.engineCapacityCc !== '' && (
      normalizeInteger(draft.vehicle.engineCapacityCc) === null || Number(draft.vehicle.engineCapacityCc) < 1
    )) {
      errors.push({ field: 'engineCapacityCc', message: 'Engine capacity must be a positive integer or empty.' });
    }
    if (draft.vehicle.minimumDriverAge !== null && draft.vehicle.minimumDriverAge !== '' && (
      normalizeInteger(draft.vehicle.minimumDriverAge) === null
      || Number(draft.vehicle.minimumDriverAge) < 16
      || Number(draft.vehicle.minimumDriverAge) > 99
    )) {
      errors.push({ field: 'minimumDriverAge', message: 'Minimum driver age must be between 16 and 99 or empty.' });
    }
    validateAvailability(draft, context, errors);

    if (draft.mode === 'create' || draft.mode === 'pricing') {
      if (normalizeText(draft.pricing.currency).toUpperCase() !== 'EUR') {
        errors.push({ field: 'currency', message: 'Cars pricing currency must remain EUR.' });
      }
      if (thresholdStrategy) {
        const activeTiers = sortDailyRateTiers(draft.pricing.dailyRateTiers).filter((tier) => tier.is_active);
        const thresholds = new Set();
        if (!activeTiers.length) {
          errors.push({ field: 'dailyRateTiers', message: 'At least one active daily-rate tier is required.' });
        }
        activeTiers.forEach((tier) => {
          if (!(Number.isInteger(tier.threshold_days) && tier.threshold_days > 0)) {
            errors.push({ field: `tier-${tier.clientKey}`, message: 'Tier threshold must be a positive whole number of days.' });
          } else if (thresholds.has(tier.threshold_days)) {
            errors.push({ field: `tier-${tier.clientKey}`, message: 'Each threshold day must be unique for this exact offer.' });
          }
          thresholds.add(tier.threshold_days);
          if (!(tier.daily_rate > 0) || !hasAtMostSixDecimals(tier.daily_rate)) {
            errors.push({ field: `tier-${tier.clientKey}`, message: 'Daily rate must be greater than zero with at most six decimals.' });
          }
        });
        const derivedMinimum = effectiveThresholdMinimum(activeTiers);
        if (normalizeInteger(draft.pricing.minRentalDays) !== derivedMinimum) {
          errors.push({ field: 'minRentalDays', message: 'Minimum rental days must equal the lowest active price threshold.' });
        }
        const maximum = normalizeInteger(draft.pricing.maxRentalDays);
        if (draft.pricing.maxRentalDays !== null && draft.pricing.maxRentalDays !== '' && maximum === null) {
          errors.push({ field: 'maxRentalDays', message: 'Maximum rental days must be a whole number or empty.' });
        } else if (maximum !== null && derivedMinimum !== null && maximum < derivedMinimum) {
          errors.push({ field: 'maxRentalDays', message: 'Maximum rental days cannot be lower than the effective minimum.' });
        }
      } else if (!profile) {
        // Profile error already reported.
      } else if (normalizeCode(profile.code) === 'larnaca') {
        if (!(normalizeMoney(draft.pricing.pricePerDay) > 0) || !hasAtMostTwoDecimals(draft.pricing.pricePerDay)) {
          errors.push({ field: 'pricePerDay', message: 'Larnaca price per day must be greater than zero.' });
        }
      } else if (normalizeCode(profile.code) === 'paphos') {
        ['price3Days', 'price4To6Days', 'price7To10Days', 'price10PlusDays'].forEach((field) => {
          if (!(normalizeMoney(draft.pricing[field]) > 0) || !hasAtMostTwoDecimals(draft.pricing[field])) {
            errors.push({ field, message: 'Every Paphos pricing tier must be greater than zero.' });
          }
        });
      }
      if (!INSURANCE_MODES.includes(normalizeCode(draft.pricing.insuranceMode))) {
        errors.push({ field: 'insuranceMode', message: 'Select a supported insurance configuration.' });
      }
      if (!(normalizeMoney(draft.pricing.insurancePerDay, -1) >= 0) || !hasAtMostTwoDecimals(draft.pricing.insurancePerDay)) {
        errors.push({ field: 'insurancePerDay', message: 'Insurance daily amount must be zero or greater.' });
      }
      if (!(normalizeMoney(draft.pricing.youngDriverCost, -1) >= 0) || !hasAtMostTwoDecimals(draft.pricing.youngDriverCost)) {
        errors.push({ field: 'youngDriverCost', message: 'Young-driver daily surcharge must be zero or greater.' });
      }
      const securityDepositMode = normalizeCode(draft.pricing.securityDepositMode);
      if (!['unspecified', 'none', 'amount'].includes(securityDepositMode)) {
        errors.push({ field: 'securityDepositMode', message: 'Select a supported security-deposit state.' });
      } else if (securityDepositMode === 'amount') {
        const securityDepositAmount = normalizeMoney(draft.pricing.securityDepositAmount, -1);
        if (!(securityDepositAmount > 0) || !hasAtMostTwoDecimals(draft.pricing.securityDepositAmount)) {
          errors.push({ field: 'securityDepositAmount', message: 'Security deposit amount must be greater than zero with at most two decimals.' });
        }
      }
    }

    const partnerId = normalizeNullableId(draft.partner.ownerPartnerId);
    const resourcePartnerIds = Array.from(new Set((context.partnerResources || [])
      .map((row) => normalizeId(row?.partner_id))
      .filter(Boolean)));
    if (!thresholdStrategy && resourcePartnerIds.length > 1) {
      errors.push({ field: 'ownerPartnerId', message: 'Multiple partner_resources assignments must be resolved before changing the owner.' });
    }
    if (!thresholdStrategy && partnerId && resourcePartnerIds.some((resourcePartnerId) => resourcePartnerId !== partnerId)) {
      errors.push({ field: 'ownerPartnerId', message: 'Selected owner conflicts with the existing partner_resources assignment.' });
    }
    if (!thresholdStrategy && !partnerId && resourcePartnerIds.length === 1) {
      warnings.push({ field: 'ownerPartnerId', message: 'The existing partner_resources assignment will remain the fulfillment fallback.' });
    }
    if (thresholdStrategy && resourcePartnerIds.some((resourcePartnerId) => resourcePartnerId !== partnerId)) {
      warnings.push({ field: 'ownerPartnerId', message: 'Threshold offers route only through the exact owner; legacy partner_resources assignments are ignored by the threshold fulfillment resolver.' });
    }
    if (partnerId) {
      const partner = (context.partners || []).find((row) => normalizeId(row?.id) === partnerId);
      if (!partner || partner.status !== 'active' || partner.can_manage_cars !== true) {
        errors.push({ field: 'ownerPartnerId', message: 'Selected partner is not active for Cars.' });
      }
    }

    const readiness = getMappedReadiness(draft, context);
    if (!readiness.ready) warnings.push(...readiness.reasons.map((message) => ({ field: 'readiness', message })));
    draft.validation = { errors: clone(errors), warnings: clone(warnings) };
    return { valid: errors.length === 0, errors, warnings, readiness };
  }

  function getMappedReadiness(draft, context = draft?.snapshot || {}) {
    const reasons = [];
    const thresholdStrategy = normalizeCode(draft?.pricing?.strategy) === 'threshold_daily_rate';
    const profile = profileById(context, draft?.pricing?.profileId);
    if (!thresholdStrategy) {
      if (!profile || profile.is_active !== true) reasons.push('Pricing profile is missing or inactive.');
      if (profile && profileLocation(profile) !== normalizeCode(draft?.pricing?.location)) {
        reasons.push('Pricing profile does not match the legacy compatibility location.');
      }
    } else {
      const minimum = effectiveThresholdMinimum(draft?.pricing?.dailyRateTiers || []);
      if (minimum === null) reasons.push('At least one active daily-rate tier is required.');
      if (minimum !== normalizeInteger(draft?.pricing?.minRentalDays)) {
        reasons.push('Minimum rental days must match the lowest active daily-rate tier.');
      }
    }
    let pickups = 0;
    let returns = 0;
    (draft?.availability || []).forEach((row) => {
      if (row?.is_active !== true) return;
      const city = cityById(context, row.city_id);
      const mapping = thresholdStrategy ? null : mappingFor(context, profile?.id, row.city_id);
      if (!city || city.is_active !== true || (!thresholdStrategy && (!mapping || mapping.is_active !== true))) {
        reasons.push(`City ${normalizeId(row.city_id) || 'unknown'} is not active or supported.`);
        return;
      }
      const fee = thresholdStrategy
        ? {
          valid: normalizeCode(row?.fee_mode) === 'override'
            ? Number.isFinite(normalizeMoney(row?.fee_per_direction)) && normalizeMoney(row?.fee_per_direction) >= 0
            : LEGACY_PRICING_KEYS.includes(normalizeCode(city.code)),
        }
        : getAvailabilityFeeState(row, profile, mapping);
      if (!fee.valid) {
        reasons.push(`Fee required for city ${normalizeCode(city.code) || normalizeId(row.city_id)}.`);
        return;
      }
      if (row.pickup_enabled && (thresholdStrategy || mapping.pickup_supported)) pickups += 1;
      if (row.return_enabled && (thresholdStrategy || mapping.return_supported)) returns += 1;
    });
    if (pickups < 1) reasons.push('At least one active pickup city is required.');
    if (returns < 1) reasons.push('At least one active return city is required.');
    return { ready: reasons.length === 0, reasons: Array.from(new Set(reasons)), pickupCount: pickups, returnCount: returns };
  }

  function fieldDiff(entityType, entityId, field, before, after, metadata = {}) {
    if (valuesEqual(before, after)) return null;
    return { entityType, entityId: normalizeId(entityId) || null, field, before: clone(before), after: clone(after), ...metadata };
  }

  function diffPayload(entityType, entityId, beforeRow, afterPayload, fields, metadata = {}) {
    return fields.map((field) => fieldDiff(
      entityType,
      entityId,
      field,
      beforeRow?.[field],
      afterPayload?.[field],
      metadata,
    )).filter(Boolean);
  }

  function availabilityDiff(draft, context = draft?.snapshot || {}) {
    const offerId = normalizeId(draft.offerId);
    const beforeRows = new Map((context.availability || []).map((row) => [normalizeId(row.city_id), normalizeAvailabilityRow(row, offerId)]));
    const afterRows = new Map((draft.availability || []).map((row) => [normalizeId(row.city_id), normalizeAvailabilityRow(row, offerId)]));
    const cityIds = Array.from(new Set([...beforeRows.keys(), ...afterRows.keys()])).filter(Boolean).sort();
    const result = [];
    cityIds.forEach((cityId) => {
      const before = beforeRows.get(cityId) || null;
      const after = afterRows.get(cityId) || null;
      if (!after) {
        result.push({
          action: 'delete',
          entityType: 'car_offer_city_availability',
          entityId: `${offerId}:${cityId}`,
          offerId,
          cityId,
          expectedUpdatedAt: before?.updated_at || null,
          changes: AVAILABILITY_COLUMNS.slice(2).map((field) => fieldDiff('car_offer_city_availability', `${offerId}:${cityId}`, field, before?.[field], null, { offerId, cityId })).filter(Boolean),
        });
        return;
      }
      const payload = {
        offer_id: offerId,
        city_id: cityId,
        pickup_enabled: after.pickup_enabled,
        return_enabled: after.return_enabled,
        is_active: after.is_active,
        fee_mode: after.fee_mode,
        fee_per_direction: after.fee_per_direction,
        fee_note: after.fee_note,
      };
      const changes = diffPayload('car_offer_city_availability', `${offerId}:${cityId}`, before, payload, AVAILABILITY_COLUMNS, { offerId, cityId });
      if (!changes.length) return;
      result.push({
        action: before ? 'update' : 'insert',
        entityType: 'car_offer_city_availability',
        entityId: `${offerId}:${cityId}`,
        offerId,
        cityId,
        expectedUpdatedAt: before?.updated_at || null,
        payload,
        changes,
      });
    });
    const mutationPriority = (entry) => {
      if (entry.action === 'delete' || entry.payload?.is_active === false) return 2;
      const before = beforeRows.get(entry.cityId);
      const addsDirection = entry.payload?.pickup_enabled && before?.pickup_enabled !== true
        || entry.payload?.return_enabled && before?.return_enabled !== true;
      return addsDirection ? 0 : 1;
    };
    return result.sort((left, right) => (
      mutationPriority(left) - mutationPriority(right)
      || String(left.cityId).localeCompare(String(right.cityId))
    ));
  }

  function availabilityReviewSummary(diffs, draft, context = draft?.snapshot || {}) {
    const beforeRows = new Map((context.availability || []).map((row) => [normalizeId(row.city_id), row]));
    const afterRows = new Map((draft.availability || []).map((row) => [normalizeId(row.city_id), row]));
    return (diffs || []).map((entry) => {
      const before = directionalAvailabilityState(beforeRows.get(entry.cityId));
      const afterRow = entry.action === 'delete' ? null : afterRows.get(entry.cityId);
      const after = directionalAvailabilityState(afterRow);
      const beforeRow = beforeRows.get(entry.cityId) || null;
      return {
        exactOfferId: normalizeId(entry.offerId) || null,
        exactCityId: normalizeId(entry.cityId),
        action: entry.action,
        beforePickupEnabled: before.pickupEnabled,
        afterPickupEnabled: entry.action === 'delete' ? false : after.pickupEnabled,
        beforeReturnEnabled: before.returnEnabled,
        afterReturnEnabled: entry.action === 'delete' ? false : after.returnEnabled,
        beforeDirectionMode: before.mode,
        afterDirectionMode: entry.action === 'delete' ? 'off' : after.mode,
        beforeFeeMode: normalizeCode(beforeRow?.fee_mode) === 'override' ? 'override' : 'inherit',
        afterFeeMode: entry.action === 'delete'
          ? null
          : normalizeCode(afterRow?.fee_mode) === 'override' ? 'override' : 'inherit',
        beforeFeePerDirection: normalizeCode(beforeRow?.fee_mode) === 'override'
          ? normalizeMoney(beforeRow?.fee_per_direction)
          : null,
        afterFeePerDirection: entry.action === 'delete' || normalizeCode(afterRow?.fee_mode) !== 'override'
          ? null
          : normalizeMoney(afterRow?.fee_per_direction),
      };
    });
  }

  function dailyRateTierDiff(draft, context = draft?.snapshot || {}) {
    const offerId = normalizeId(draft.offerId);
    const beforeById = new Map((context.dailyRateTiers || [])
      .map((row) => normalizeDailyRateTier(row, offerId))
      .filter((row) => row.id)
      .map((row) => [row.id, row]));
    const afterRows = sortDailyRateTiers(draft?.pricing?.dailyRateTiers || []);
    const afterIds = new Set(afterRows.map((row) => row.id).filter(Boolean));
    const changes = [];

    beforeById.forEach((before, id) => {
      if (afterIds.has(id)) return;
      changes.push({
        action: 'delete',
        entityType: 'car_offer_daily_rate_tier',
        entityId: id,
        offerId,
        expectedUpdatedAt: before.updated_at,
        payload: {},
        changes: DAILY_RATE_TIER_COLUMNS.slice(2).map((field) => fieldDiff(
          'car_offer_daily_rate_tier', id, field, before[field], null, { offerId },
        )).filter(Boolean),
      });
    });

    afterRows.forEach((after) => {
      const before = after.id ? beforeById.get(after.id) : null;
      const payload = {
        offer_id: offerId,
        threshold_days: normalizeInteger(after.threshold_days),
        daily_rate: normalizeDailyRate(after.daily_rate),
        is_active: after.is_active === true,
      };
      const rowChanges = diffPayload(
        'car_offer_daily_rate_tier',
        after.id || after.clientKey,
        before,
        payload,
        DAILY_RATE_TIER_COLUMNS.slice(1),
        { offerId },
      );
      if (!rowChanges.length) return;
      changes.push({
        action: before ? 'update' : 'insert',
        entityType: 'car_offer_daily_rate_tier',
        entityId: after.id || after.clientKey,
        offerId,
        expectedUpdatedAt: before?.updated_at || null,
        payload,
        changes: rowChanges,
      });
    });

    const order = { delete: 0, update: 1, insert: 2 };
    return changes.sort((left, right) => (
      order[left.action] - order[right.action]
      || String(left.entityId).localeCompare(String(right.entityId))
    ));
  }

  function buildStep(key, type, action, entityId, expectedUpdatedAt, payload, changes, dependsOn = []) {
    return {
      key,
      type,
      action,
      entityId: normalizeId(entityId) || null,
      expectedUpdatedAt: expectedUpdatedAt || null,
      payload: clone(payload || {}),
      changes: clone(changes || []),
      dependsOn: clone(dependsOn),
      status: 'pending',
      attempts: 0,
      result: null,
      error: null,
    };
  }

  function createPlan(kind, draft, steps, extra = {}) {
    const fingerprint = fingerprintDraft(draft);
    return {
      id: `car-multicity-${kind}-${Date.now()}-${fingerprint}`,
      kind,
      createdAt: new Date().toISOString(),
      fingerprint,
      exactOfferId: normalizeId(draft.offerId) || null,
      expectedUpdatedAt: draft.expectedUpdatedAt || null,
      globalMappedFlagChanges: 0,
      globalThresholdFlagChanges: 0,
      bookingChanges: 0,
      priceCalculationChanges: 0,
      depositRuleChanges: 0,
      existingPriceColumnChanges: 0,
      status: 'pending',
      steps,
      ...clone(extra),
    };
  }

  function buildPreflightSnapshot(draft, context = draft?.snapshot || {}, selectionOverride = null) {
    const selection = selectionOverride ? {
      profileId: normalizeId(selectionOverride.profileId),
      cityIds: Array.from(new Set((selectionOverride.cityIds || []).map(normalizeId).filter(Boolean))).sort(),
      partnerIds: Array.from(new Set((selectionOverride.partnerIds || []).map(normalizeId).filter(Boolean))).sort(),
    } : {
      profileId: normalizeCode(draft?.pricing?.strategy) === 'threshold_daily_rate'
        ? ''
        : normalizeId(draft?.pricing?.profileId),
      cityIds: Array.from(new Set([
        ...(draft?.availability || []).map((row) => normalizeId(row?.city_id)),
        ...(context?.availability || []).map((row) => normalizeId(row?.city_id)),
      ].filter(Boolean))).sort(),
      partnerIds: Array.from(new Set([
        normalizeId(context?.offer?.owner_partner_id),
        normalizeId(draft?.partner?.ownerPartnerId),
      ].filter(Boolean))).sort(),
    };
    const project = (row, fields) => fields.reduce((result, field) => {
      result[field] = clone(row?.[field] ?? null);
      return result;
    }, {});
    return {
      selection,
      offerContract: project(
        context.offer,
        [
          'id',
          'pricing_profile_id',
          'location',
          'owner_partner_id',
          'availability_mode',
          'is_available',
          'is_published',
          'submission_status',
          'pricing_strategy',
          'min_rental_days',
          'max_rental_days',
          'insurance_mode',
          'insurance_per_day',
          'young_driver_fee',
          'young_driver_cost',
          'deposit_amount',
          'updated_at',
        ],
      ),
      profile: project(
        (context.profiles || []).find((row) => normalizeId(row?.id) === selection.profileId),
        ['id', 'code', 'calculator_key', 'legacy_booking_location', 'is_active', 'updated_at'],
      ),
      profileCities: (context.profileCities || [])
        .filter((row) => normalizeId(row?.pricing_profile_id) === selection.profileId)
        .map((row) => project(row, ['pricing_profile_id', 'city_id', 'pickup_supported', 'return_supported', 'legacy_pricing_city_key', 'is_active', 'updated_at']))
        .sort((left, right) => String(left.city_id).localeCompare(String(right.city_id))),
      cities: (context.cities || [])
        .filter((row) => selection.cityIds.includes(normalizeId(row?.id)))
        .map((row) => project(row, ['id', 'code', 'is_active', 'updated_at']))
        .sort((left, right) => String(left.id).localeCompare(String(right.id))),
      availability: (context.availability || [])
        .map((row) => project(row, ['offer_id', 'city_id', 'pickup_enabled', 'return_enabled', 'is_active', 'fee_mode', 'fee_per_direction', 'fee_note', 'updated_at']))
        .sort((left, right) => String(left.city_id).localeCompare(String(right.city_id))),
      dailyRateTiers: (context.dailyRateTiers || [])
        .map((row) => project(row, ['id', 'offer_id', 'threshold_days', 'daily_rate', 'is_active', 'updated_at']))
        .sort((left, right) => Number(left.threshold_days) - Number(right.threshold_days)),
      partners: (context.partners || [])
        .filter((row) => selection.partnerIds.includes(normalizeId(row?.id)))
        .map((row) => project(row, ['id', 'status', 'can_manage_cars', 'updated_at']))
        .sort((left, right) => String(left.id).localeCompare(String(right.id))),
      depositRule: project(
        context.depositRule,
        ['id', 'resource_type', 'mode', 'amount', 'currency', 'include_children', 'enabled', 'updated_at'],
      ),
      depositOverride: project(
        context.depositOverride,
        ['id', 'resource_type', 'resource_id', 'mode', 'amount', 'currency', 'include_children', 'enabled', 'updated_at'],
      ),
      globalFlag: context.siteSetting?.car_multi_city_mapped_enabled ?? null,
      globalThresholdFlag: context.siteSetting?.car_threshold_daily_rates_enabled ?? null,
    };
  }

  function buildVehicleDetailsPlan(draft, context = draft?.snapshot || {}) {
    const offer = context.offer || {};
    const payload = vehiclePayload(draft);
    const changes = diffPayload('car_offer', draft.offerId, offer, payload, VEHICLE_COLUMNS);
    const step = changes.length
      ? buildStep('vehicle_details', 'car_offer', 'update', draft.offerId, offer.updated_at, payload, changes)
      : null;
    return createPlan('vehicle', draft, step ? [step] : [], {
      existingPriceColumnChanges: 0,
      media: clone(draft.media),
      preflightSnapshot: buildPreflightSnapshot(draft, context),
    });
  }

  function buildPricingProfilePlan(draft, context = draft?.snapshot || {}) {
    const offer = context.offer || {};
    const reviewedPayload = pricingEditPayload(draft, context);
    const fields = Object.keys(reviewedPayload);
    const changes = diffPayload('car_offer', draft.offerId, offer, reviewedPayload, fields);
    const payload = changes.reduce((result, change) => {
      result[change.field] = clone(reviewedPayload[change.field]);
      return result;
    }, {});
    if (normalizeCode(draft?.pricing?.strategy) === 'legacy_compat' && changes.length) {
      const profile = profileById(context, draft.pricing.profileId);
      const profileCode = normalizeCode(profile?.code);
      [...PROFILE_COLUMNS, 'currency', ...(PROFILE_PRICE_COLUMNS[profileCode] || [])].forEach((field) => {
        payload[field] = clone(reviewedPayload[field]);
      });
    }
    if (changes.some((change) => ['pricing_strategy', 'min_rental_days', 'max_rental_days'].includes(change.field))) {
      ['pricing_strategy', 'min_rental_days', 'max_rental_days'].forEach((field) => {
        payload[field] = clone(reviewedPayload[field]);
      });
    }
    const tierDiffs = dailyRateTierDiff(draft, context);
    const tierSteps = tierDiffs.map((entry) => buildStep(
      `daily_rate_tier_${entry.action}_${entry.entityId}`,
      'car_offer_daily_rate_tier',
      entry.action,
      entry.entityId,
      entry.expectedUpdatedAt,
      entry.payload,
      entry.changes,
    ));
    const step = changes.length
      ? buildStep(
        'pricing_and_profile',
        'car_offer',
        'update',
        draft.offerId,
        offer.updated_at,
        payload,
        changes,
        tierSteps.map((tierStep) => tierStep.key),
      )
      : null;
    return createPlan('pricing_profile', draft, [...tierSteps, ...(step ? [step] : [])], {
      existingPriceColumnChanges: changes.filter((change) => PRICE_COLUMNS.includes(change.field)).length,
      dailyRateTierChanges: tierDiffs.length,
      effectiveMinRentalDays: effectiveThresholdMinimum(draft.pricing.dailyRateTiers),
      preservedPriceColumns: PRICE_COLUMNS.reduce((result, column) => {
        result[column] = clone(offer[column]);
        return result;
      }, {}),
      preflightSnapshot: buildPreflightSnapshot(draft, context),
    });
  }

  function buildAvailabilityPlan(draft, context = draft?.snapshot || {}) {
    const thresholdStrategy = normalizeCode(draft?.pricing?.strategy) === 'threshold_daily_rate';
    const diffs = availabilityDiff(draft, context);
    const forbidden = diffs.flatMap((entry) => entry.changes).filter((change) => PRICE_COLUMNS.includes(change.field) || change.field === 'owner_partner_id');
    if (forbidden.length) throw new Error('Availability plan contains forbidden fields');
    const expectedAvailabilityRows = (context.availability || []).map((row) => ({
      city_id: normalizeId(row.city_id),
      updated_at: row.updated_at || null,
    })).sort((left, right) => left.city_id.localeCompare(right.city_id));
    const desiredAvailabilityRows = (draft.availability || []).map((row) => {
      const normalized = normalizeAvailabilityRow(row, draft.offerId);
      return {
        city_id: normalized.city_id,
        pickup_enabled: normalized.pickup_enabled,
        return_enabled: normalized.return_enabled,
        fee_mode: normalized.fee_mode,
        fee_per_direction: normalized.fee_per_direction,
        fee_note: normalized.fee_note,
      };
    }).sort((left, right) => left.city_id.localeCompare(right.city_id));
    const steps = diffs.length ? [buildStep(
      'availability_batch',
      'car_offer_city_availability_batch',
      'replace',
      draft.offerId,
      null,
      {},
      diffs.flatMap((entry) => entry.changes),
    )] : [];
    return createPlan('availability', draft, steps, {
      exactProfileId: thresholdStrategy ? null : normalizeId(draft.pricing.profileId),
      availableCities: availabilityReviewSummary(diffs, draft, context),
      profileCitySnapshot: thresholdStrategy ? [] : clone(context.profileCities || []),
      citySnapshot: clone(context.cities || []),
      expectedAvailabilityRows,
      desiredAvailabilityRows,
      existingPriceColumnChanges: 0,
      preflightSnapshot: buildPreflightSnapshot(draft, context),
    });
  }

  function buildPartnerAssignmentPlan(draft, context = draft?.snapshot || {}) {
    const offer = context.offer || {};
    const payload = partnerPayload(draft);
    const changes = diffPayload('car_offer', draft.offerId, offer, payload, PARTNER_COLUMNS);
    const step = changes.length
      ? buildStep('partner_assignment', 'car_offer', 'update', draft.offerId, offer.updated_at, payload, changes)
      : null;
    return createPlan('partner', draft, step ? [step] : [], {
      existingPriceColumnChanges: 0,
      preflightSnapshot: buildPreflightSnapshot(draft, context),
    });
  }

  function buildActivationPlan(draft, context = draft?.snapshot || {}) {
    const offer = context.offer || {};
    const payload = activationPayload(draft);
    const fields = Object.keys(payload);
    const changes = diffPayload('car_offer', draft.offerId, offer, payload, fields);
    const step = changes.length
      ? buildStep('exact_offer_activation', 'car_offer', 'update', draft.offerId, offer.updated_at, payload, changes)
      : null;
    return createPlan('activation', draft, step ? [step] : [], {
      activationAction: normalizeCode(draft?.activation?.action),
      activationReadiness: getActivationReadiness(draft, context),
      existingPriceColumnChanges: 0,
      preflightSnapshot: buildPreflightSnapshot(draft, context),
    });
  }

  function buildCreateVehiclePlan(draft, context = draft?.snapshot || {}) {
    const profile = profileById(context, draft.pricing.profileId);
    const thresholdStrategy = normalizeCode(draft?.pricing?.strategy) === 'threshold_daily_rate';
    const effectiveMinimum = thresholdStrategy
      ? effectiveThresholdMinimum(draft.pricing.dailyRateTiers)
      : normalizeInteger(draft.pricing.minRentalDays, 1);
    const intendedAvailability = draft.vehicle.isAvailable === true;
    const payload = {
      ...vehiclePayload(draft),
      ...pricingPayload(draft),
      // Fail closed while the exact-ID tiers are being created. The final
      // step restores the reviewed availability only after database validation.
      is_available: thresholdStrategy ? false : intendedAvailability,
      min_rental_days: effectiveMinimum,
      // The live legacy schema keeps price_per_day NOT NULL. Zero is an inert
      // compatibility value for a threshold offer and is never its price.
      price_per_day: thresholdStrategy ? (normalizeMoney(draft.pricing.pricePerDay) ?? 0) : normalizeMoney(draft.pricing.pricePerDay),
      pricing_profile_id: normalizeId(profile?.id),
      location: assertProfileContract(profile),
      owner_partner_id: normalizeNullableId(draft.partner.ownerPartnerId),
      availability_mode: 'legacy',
    };
    const keys = Object.keys(payload);
    const forbidden = keys.filter((key) => !CREATE_COLUMNS.includes(key));
    if (forbidden.length) throw new Error(`Create payload contains forbidden fields: ${forbidden.join(', ')}`);
    const offerStep = buildStep('create_offer', 'car_offer', 'insert', null, null, payload, keys.map((field) => fieldDiff('car_offer', null, field, null, payload[field])).filter(Boolean));
    const tierSteps = thresholdStrategy
      ? sortDailyRateTiers(draft.pricing.dailyRateTiers).map((tier) => {
        const tierPayload = {
          offer_id: '$created_offer_id',
          threshold_days: normalizeInteger(tier.threshold_days),
          daily_rate: normalizeDailyRate(tier.daily_rate),
          is_active: tier.is_active === true,
        };
        return buildStep(
          `create_daily_rate_tier_${tier.clientKey || tier.threshold_days}`,
          'car_offer_daily_rate_tier',
          'insert',
          `$created_offer_id:${tier.threshold_days}`,
          null,
          tierPayload,
          DAILY_RATE_TIER_COLUMNS.slice(1).map((field) => fieldDiff(
            'car_offer_daily_rate_tier',
            `$created_offer_id:${tier.threshold_days}`,
            field,
            null,
            tierPayload[field],
          )).filter(Boolean),
          ['create_offer'],
        );
      })
      : [];
    const finalizeStep = thresholdStrategy
      ? buildStep(
        'finalize_created_threshold_offer',
        'car_offer',
        'update',
        '$created_offer_id',
        null,
        {
          pricing_strategy: 'threshold_daily_rate',
          min_rental_days: effectiveMinimum,
          max_rental_days: normalizeInteger(draft.pricing.maxRentalDays),
          is_available: intendedAvailability,
        },
        [
          fieldDiff('car_offer', '$created_offer_id', 'pricing_strategy', 'legacy_compat', 'threshold_daily_rate'),
          fieldDiff('car_offer', '$created_offer_id', 'min_rental_days', null, effectiveMinimum),
          fieldDiff('car_offer', '$created_offer_id', 'max_rental_days', null, normalizeInteger(draft.pricing.maxRentalDays)),
          fieldDiff('car_offer', '$created_offer_id', 'is_available', false, intendedAvailability),
        ].filter(Boolean),
        tierSteps.map((step) => step.key),
      )
      : null;
    const availabilitySteps = (draft.availability || []).filter((row) => row.is_active || row.pickup_enabled || row.return_enabled).map((row) => {
      const cityId = normalizeId(row.city_id);
      const availabilityPayload = {
        offer_id: '$created_offer_id',
        city_id: cityId,
        pickup_enabled: row.pickup_enabled === true,
        return_enabled: row.return_enabled === true,
        is_active: row.is_active === true,
        fee_mode: normalizeCode(row.fee_mode) === 'override' ? 'override' : 'inherit',
        fee_per_direction: normalizeCode(row.fee_mode) === 'override'
          ? normalizeMoney(row.fee_per_direction)
          : null,
        fee_note: normalizeText(row.fee_note) || null,
      };
      return buildStep(
        `create_availability_${cityId}`,
        'car_offer_city_availability',
        'insert',
        `$created_offer_id:${cityId}`,
        null,
        availabilityPayload,
        AVAILABILITY_COLUMNS.map((field) => fieldDiff('car_offer_city_availability', `$created_offer_id:${cityId}`, field, null, availabilityPayload[field], { cityId })).filter(Boolean),
        thresholdStrategy ? ['finalize_created_threshold_offer'] : ['create_offer'],
      );
    });
    return createPlan('create', draft, [offerStep, ...tierSteps, ...(finalizeStep ? [finalizeStep] : []), ...availabilitySteps], {
      exactOfferId: null,
      existingPriceColumnChanges: PRICE_COLUMNS.filter((column) => payload[column] !== null && payload[column] !== undefined).length,
      availableCities: availabilityReviewSummary(
        availabilitySteps.map((step) => ({
          action: step.action,
          offerId: null,
          cityId: step.payload.city_id,
        })),
        draft,
        context,
      ),
      media: clone(draft.media),
      dailyRateTierChanges: tierSteps.length,
      effectiveMinRentalDays: thresholdStrategy ? effectiveMinimum : null,
      resultingAvailabilityMode: 'legacy',
      preflightSnapshot: buildPreflightSnapshot(draft, context),
    });
  }

  function buildReviewPlan(draft, context = draft?.snapshot || {}, kind = draft?.mode) {
    const validation = validateDraft(draft, context);
    if (!validation.valid) {
      const error = new Error('Draft validation failed');
      error.code = 'car_multicity_validation_failed';
      error.details = validation;
      throw error;
    }
    let plan;
    if (kind === 'vehicle') plan = buildVehicleDetailsPlan(draft, context);
    else if (kind === 'pricing') plan = buildPricingProfilePlan(draft, context);
    else if (kind === 'availability') plan = buildAvailabilityPlan(draft, context);
    else if (kind === 'partner') plan = buildPartnerAssignmentPlan(draft, context);
    else if (kind === 'activation') plan = buildActivationPlan(draft, context);
    else if (kind === 'create') plan = buildCreateVehiclePlan(draft, context);
    else throw new Error(`Unsupported review plan kind: ${kind}`);
    if (plan.globalMappedFlagChanges !== 0 || plan.bookingChanges !== 0 || plan.priceCalculationChanges !== 0 || plan.depositRuleChanges !== 0) {
      throw new Error('Stage 2C safety invariant failed');
    }
    draft.review = { isCurrent: true, fingerprint: plan.fingerprint, plan: clone(plan) };
    return plan;
  }

  function fingerprintDraft(draft) {
    return hashText(stableSerialize({
      version: draft?.version,
      mode: draft?.mode,
      offerId: draft?.offerId,
      expectedUpdatedAt: draft?.expectedUpdatedAt,
      vehicle: draft?.vehicle,
      media: draft?.media,
      content: draft?.content,
      pricing: draft?.pricing,
      availability: draft?.availability,
      partner: draft?.partner,
      activation: draft?.activation,
      publicMode: draft?.publicMode,
      globalMappedFlag: draft?.globalMappedFlag,
      globalThresholdFlag: draft?.globalThresholdFlag,
    }));
  }

  function invalidateReview(draft) {
    if (draft) draft.review = { isCurrent: false, fingerprint: null, plan: null };
    return draft;
  }

  function isReviewCurrent(draft, plan = draft?.review?.plan) {
    return Boolean(plan && draft?.review?.isCurrent && plan.fingerprint === fingerprintDraft(draft));
  }

  function validateFreshContext(plan, freshContext) {
    const errors = [];
    if (!plan) return { valid: false, errors: [{ field: 'plan', message: 'Review plan is missing.' }] };
    if (plan.kind !== 'create') {
      const freshOffer = freshContext?.offer;
      if (!freshOffer || normalizeId(freshOffer.id) !== normalizeId(plan.exactOfferId)) {
        errors.push({ field: 'offerId', message: 'Exact offer changed or is missing.' });
      } else if (String(freshOffer.updated_at || '') !== String(plan.expectedUpdatedAt || '')) {
        errors.push({ field: 'updatedAt', message: 'Offer updated_at changed.' });
      }
    }
    if (plan.kind === 'availability') {
      const expectedMappings = stableSerialize((plan.profileCitySnapshot || []).map((row) => ({
        pricing_profile_id: row.pricing_profile_id,
        city_id: row.city_id,
        pickup_supported: row.pickup_supported,
        return_supported: row.return_supported,
        legacy_pricing_city_key: row.legacy_pricing_city_key,
        is_active: row.is_active,
        updated_at: row.updated_at,
      })));
      const actualMappings = stableSerialize((plan.exactProfileId ? (freshContext?.profileCities || []) : []).map((row) => ({
        pricing_profile_id: row.pricing_profile_id,
        city_id: row.city_id,
        pickup_supported: row.pickup_supported,
        return_supported: row.return_supported,
        legacy_pricing_city_key: row.legacy_pricing_city_key,
        is_active: row.is_active,
        updated_at: row.updated_at,
      })));
      if (expectedMappings !== actualMappings) errors.push({ field: 'profileCities', message: 'Profile-city mappings changed.' });
    }
    if (plan.kind === 'partner') {
      const target = plan.steps[0]?.payload?.owner_partner_id;
      if (target) {
        const partner = (freshContext?.partners || []).find((row) => normalizeId(row.id) === normalizeId(target));
        if (!partner || partner.status !== 'active' || partner.can_manage_cars !== true) {
          errors.push({ field: 'partner', message: 'Selected partner is no longer active for Cars.' });
        }
      }
    }
    if (plan.preflightSnapshot) {
      const comparableFreshSnapshot = buildPreflightSnapshot(null, freshContext, plan.preflightSnapshot.selection);
      if (stableSerialize(plan.preflightSnapshot) !== stableSerialize(comparableFreshSnapshot)) {
        errors.push({ field: 'configurationSnapshot', message: 'Profile, city mapping, availability, partner, or global configuration changed.' });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  function createCityDraft(input = {}) {
    return {
      id: normalizeId(input.id) || null,
      code: normalizeCode(input.code),
      name_i18n: normalizeI18n(input.name_i18n || {}),
      place_types: Array.isArray(input.place_types) ? Array.from(new Set(input.place_types.map(normalizeCode).filter(Boolean))) : ['city'],
      sort_order: normalizeInteger(input.sort_order, 1000),
      is_active: input.id ? input.is_active === true : false,
      expectedUpdatedAt: input.updated_at || null,
    };
  }

  function validateCityDraft(draft, existingCities = []) {
    const errors = [];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeCode(draft.code))) {
      errors.push({ field: 'cityCode', message: 'City code must be lowercase kebab-case.' });
    }
    const duplicate = existingCities.find((city) => normalizeCode(city.code) === normalizeCode(draft.code) && normalizeId(city.id) !== normalizeId(draft.id));
    if (duplicate) errors.push({ field: 'cityCode', message: 'City code already exists.' });
    if (!normalizeText(draft.name_i18n?.en) || !normalizeText(draft.name_i18n?.pl) || !normalizeText(draft.name_i18n?.he)) {
      errors.push({ field: 'cityName', message: 'PL, EN and HE names are required.' });
    }
    if (!Array.isArray(draft.place_types) || draft.place_types.length < 1) {
      errors.push({ field: 'placeTypes', message: 'At least one place type is required.' });
    } else if (draft.place_types.some((placeType) => !PLACE_TYPES.includes(normalizeCode(placeType)))) {
      errors.push({ field: 'placeTypes', message: 'Unsupported place type.' });
    }
    return { valid: errors.length === 0, errors };
  }

  function validateProfileCityDraft(draft, context) {
    const errors = [];
    const profile = profileById(context, draft.pricing_profile_id);
    const city = cityById(context, draft.city_id);
    const key = normalizeCode(draft.legacy_pricing_city_key);
    if (!profile || !city) errors.push({ field: 'mapping', message: 'Exact profile and city are required.' });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) errors.push({ field: 'legacyKey', message: 'Pricing key must be a normalized city slug.' });
    if (city && normalizeCode(city.code) !== key) errors.push({ field: 'legacyKey', message: 'Legacy pricing key must match the city code.' });
    if (profile && normalizeCode(profile.code) === 'paphos' && (normalizeCode(city?.code) !== 'paphos' || key !== 'paphos')) {
      errors.push({ field: 'mapping', message: 'Paphos profile supports only Paphos.' });
    }
    if (draft.pickup_supported !== draft.return_supported) {
      errors.push({ field: 'mappingSupport', message: 'Pickup and return support must be saved together.' });
    }
    if (draft.is_active && !draft.pickup_supported && !draft.return_supported) {
      errors.push({ field: 'mapping', message: 'An active mapping must support pickup or return.' });
    }
    if (draft.is_active && (profile?.is_active !== true || city?.is_active !== true)) {
      errors.push({ field: 'mapping', message: 'An active mapping requires an active profile and city.' });
    }
    return { valid: errors.length === 0, errors };
  }

  const api = Object.freeze({
    ACTIVATION_COLUMNS,
    AVAILABILITY_COLUMNS,
    CREATE_COLUMNS,
    DAILY_RATE_TIER_COLUMNS,
    INSURANCE_MODES,
    LEGACY_CITY_FEE_PREVIEW,
    LEGACY_LOCATIONS,
    LEGACY_PRICING_KEYS,
    PARTNER_COLUMNS,
    PLACE_TYPES,
    PRICE_COLUMNS,
    PRICING_EDIT_COLUMNS,
    PROFILE_COLUMNS,
    PROFILE_PRICE_COLUMNS,
    PENDING_IMAGE_URL,
    PRICING_STRATEGIES,
    VEHICLE_COLUMNS,
    VEHICLE_IMAGE_BUCKET,
    VEHICLE_IMAGE_EXTENSIONS,
    VEHICLE_IMAGE_MAX_BYTES,
    VEHICLE_IMAGE_MIME_TYPES,
    availabilityDiff,
    availabilityReviewSummary,
    addDailyRateTier,
    assertProfileContract,
    buildAvailabilityPlan,
    buildActivationPlan,
    buildCreateVehiclePlan,
    buildPreflightSnapshot,
    buildPartnerAssignmentPlan,
    buildPricingProfilePlan,
    buildReviewPlan,
    buildVehicleDetailsPlan,
    calculateThresholdBasePrice,
    cityById,
    clone,
    createCityDraft,
    createDraft,
    defaultAvailabilityRows,
    dailyRateTierDiff,
    directionalAvailabilityState,
    effectiveThresholdMinimum,
    fingerprintDraft,
    getMappedReadiness,
    getActivationReadiness,
    getAvailabilityFeeState,
    inheritedFeeIsSupported,
    invalidateReview,
    isReviewCurrent,
    mappingFor,
    normalizeAvailabilityRow,
    normalizeCode,
    normalizeDailyRateTier,
    normalizeId,
    normalizeI18n,
    normalizeText,
    pairedAvailabilityState,
    pricingEditPayload,
    profileByCode,
    profileById,
    profileLocation,
    removeDailyRateTier,
    resolveI18nText,
    setPairedAvailability,
    setDirectionalAvailability,
    setActivationIntent,
    setAvailabilityFee,
    setDraftProfile,
    setVehicleImageAction,
    stableSerialize,
    sortDailyRateTiers,
    synchronizeThresholdMinimum,
    selectDailyRateTier,
    updateDailyRateTier,
    validateCityDraft,
    validateActivationDraft,
    validateDraft,
    validateFreshContext,
    validateProfileCityDraft,
    validateVehicleImageFile,
    vehiclePayload,
  });

  Object.defineProperty(root, 'CarRentalMulticityCore', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(typeof window !== 'undefined' ? window : globalThis);
