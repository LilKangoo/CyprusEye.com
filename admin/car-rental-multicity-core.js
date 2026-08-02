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
  const PARTNER_COLUMNS = Object.freeze(['owner_partner_id']);
  const AVAILABILITY_COLUMNS = Object.freeze([
    'offer_id',
    'city_id',
    'pickup_enabled',
    'return_enabled',
    'is_active',
  ]);
  const CREATE_COLUMNS = Object.freeze([
    ...VEHICLE_COLUMNS,
    ...PRICE_COLUMNS,
    'currency',
    'insurance_per_day',
    'young_driver_fee',
    'young_driver_cost',
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

  function setPairedAvailability(draft, cityId, checked) {
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
        updated_at: null,
      };
      draft.availability.push(row);
    }
    const enabled = checked === true;
    row.pickup_enabled = enabled;
    row.return_enabled = enabled;
    row.is_active = enabled;
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
      updated_at: row?.updated_at || null,
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
        transmission: normalizeCode(offer?.transmission || 'manual'),
        fuelType: normalizeCode(offer?.fuel_type || 'petrol'),
        maxPassengers: normalizeInteger(offer?.max_passengers, 5),
        maxLuggage: normalizeInteger(offer?.max_luggage, 2),
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
        profileId: initialProfileId,
        location: selectedProfile ? profileLocation(selectedProfile) : normalizeCode(offer?.location),
        currency: normalizeText(offer?.currency || 'EUR').toUpperCase(),
        pricePerDay: normalizeMoney(offer?.price_per_day),
        price3Days: normalizeMoney(offer?.price_3days),
        price4To6Days: normalizeMoney(offer?.price_4_6days),
        price7To10Days: normalizeMoney(offer?.price_7_10days),
        price10PlusDays: normalizeMoney(offer?.price_10plus_days),
        insurancePerDay: normalizeMoney(offer?.insurance_per_day, 0),
        youngDriverFee: offer?.young_driver_fee === true,
        youngDriverCost: normalizeMoney(offer?.young_driver_cost, 0),
      },
      availability,
      partner: {
        ownerPartnerId: normalizeNullableId(offer?.owner_partner_id),
      },
      publicMode: 'legacy',
      globalMappedFlag: false,
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
      transmission: normalizeCode(draft.vehicle.transmission),
      fuel_type: normalizeCode(draft.vehicle.fuelType),
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

  function pricingPayload(draft) {
    return {
      currency: normalizeText(draft.pricing.currency || 'EUR').toUpperCase(),
      price_per_day: normalizeMoney(draft.pricing.pricePerDay),
      price_3days: normalizeMoney(draft.pricing.price3Days),
      price_4_6days: normalizeMoney(draft.pricing.price4To6Days),
      price_7_10days: normalizeMoney(draft.pricing.price7To10Days),
      price_10plus_days: normalizeMoney(draft.pricing.price10PlusDays),
      insurance_per_day: normalizeMoney(draft.pricing.insurancePerDay, 0),
      young_driver_fee: draft.pricing.youngDriverFee === true,
      young_driver_cost: normalizeMoney(draft.pricing.youngDriverCost, 0),
    };
  }

  function validateAvailability(draft, context, errors) {
    const profile = profileById(context, draft.pricing.profileId);
    if (!profile) {
      errors.push({ field: 'pricingProfileId', message: 'Select an exact pricing profile.' });
      return;
    }
    try {
      assertProfileContract(profile);
    } catch (error) {
      errors.push({ field: 'pricingProfileId', message: error.message });
      return;
    }

    const seen = new Set();
    (draft.availability || []).forEach((row, index) => {
      const cityId = normalizeId(row?.city_id);
      if (!cityId || seen.has(cityId)) {
        errors.push({ field: `availability-${index}`, message: 'Each availability row must use one exact city ID.' });
        return;
      }
      seen.add(cityId);
      if (!row?.is_active && !row?.pickup_enabled && !row?.return_enabled) return;
      const city = cityById(context, cityId);
      const mapping = mappingFor(context, profile.id, cityId);
      if (!city || city.is_active !== true) {
        errors.push({ field: `availability-${cityId}`, message: 'Selected city is inactive or missing.' });
        return;
      }
      if (!mapping || mapping.is_active !== true || !normalizeCode(mapping.legacy_pricing_city_key)) {
        errors.push({ field: `availability-${cityId}`, message: 'Selected city has no active legacy pricing mapping.' });
        return;
      }
      if (!LEGACY_PRICING_KEYS.includes(normalizeCode(mapping.legacy_pricing_city_key))) {
        errors.push({ field: `availability-${cityId}`, message: 'Selected city uses an unsupported legacy pricing key.' });
      }
      if (normalizeCode(profile.code) === 'paphos' && normalizeCode(mapping.legacy_pricing_city_key) !== 'paphos') {
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

  function validateDraft(draft, context = draft?.snapshot || {}) {
    const errors = [];
    const warnings = [];
    if (!draft || draft.version !== 1) {
      return { valid: false, errors: [{ field: 'draft', message: 'Unsupported draft.' }], warnings };
    }
    if (draft.mode !== 'create' && !normalizeId(draft.offerId)) {
      errors.push({ field: 'offerId', message: 'Exact car offer ID is required.' });
    }
    const profile = profileById(context, draft.pricing.profileId);
    if (!profile) errors.push({ field: 'pricingProfileId', message: 'Select a pricing profile.' });
    else if (profile.is_active !== true) errors.push({ field: 'pricingProfileId', message: 'Selected pricing profile is inactive.' });
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
    if (normalizeInteger(draft.vehicle.maxPassengers) === null || Number(draft.vehicle.maxPassengers) < 1) {
      errors.push({ field: 'maxPassengers', message: 'Passengers must be a positive integer.' });
    }
    ['maxLuggage', 'stockCount', 'sortOrder'].forEach((field) => {
      if (normalizeInteger(draft.vehicle[field]) === null || Number(draft.vehicle[field]) < 0) {
        errors.push({ field, message: `${field} must be a non-negative integer.` });
      }
    });
    if (draft.publicMode !== 'legacy') errors.push({ field: 'publicMode', message: 'Stage 2C must remain in legacy mode.' });
    if (draft.globalMappedFlag !== false) errors.push({ field: 'globalMappedFlag', message: 'Global mapped flag must remain false.' });

    validateAvailability(draft, context, errors);

    if (draft.mode === 'create') {
      if (!profile) {
        // Profile error already reported.
      } else if (normalizeCode(profile.code) === 'larnaca') {
        if (!(normalizeMoney(draft.pricing.pricePerDay) > 0)) {
          errors.push({ field: 'pricePerDay', message: 'Larnaca price per day must be greater than zero.' });
        }
      } else if (normalizeCode(profile.code) === 'paphos') {
        ['price3Days', 'price4To6Days', 'price7To10Days', 'price10PlusDays'].forEach((field) => {
          if (!(normalizeMoney(draft.pricing[field]) > 0)) {
            errors.push({ field, message: 'Every Paphos pricing tier must be greater than zero.' });
          }
        });
      }
    }

    const partnerId = normalizeNullableId(draft.partner.ownerPartnerId);
    const resourcePartnerIds = Array.from(new Set((context.partnerResources || [])
      .map((row) => normalizeId(row?.partner_id))
      .filter(Boolean)));
    if (resourcePartnerIds.length > 1) {
      errors.push({ field: 'ownerPartnerId', message: 'Multiple partner_resources assignments must be resolved before changing the owner.' });
    }
    if (partnerId && resourcePartnerIds.some((resourcePartnerId) => resourcePartnerId !== partnerId)) {
      errors.push({ field: 'ownerPartnerId', message: 'Selected owner conflicts with the existing partner_resources assignment.' });
    }
    if (!partnerId && resourcePartnerIds.length === 1) {
      warnings.push({ field: 'ownerPartnerId', message: 'The existing partner_resources assignment will remain the fulfillment fallback.' });
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
    const profile = profileById(context, draft?.pricing?.profileId);
    if (!profile || profile.is_active !== true) reasons.push('Pricing profile is missing or inactive.');
    if (profile && profileLocation(profile) !== normalizeCode(draft?.pricing?.location)) {
      reasons.push('Pricing profile does not match the legacy compatibility location.');
    }
    let pickups = 0;
    let returns = 0;
    (draft?.availability || []).forEach((row) => {
      if (row?.is_active !== true) return;
      const city = cityById(context, row.city_id);
      const mapping = mappingFor(context, profile?.id, row.city_id);
      if (!city || city.is_active !== true || !mapping || mapping.is_active !== true) {
        reasons.push(`City ${normalizeId(row.city_id) || 'unknown'} is not covered by an active mapping.`);
        return;
      }
      if (row.pickup_enabled && mapping.pickup_supported) pickups += 1;
      if (row.return_enabled && mapping.return_supported) returns += 1;
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
    return result;
  }

  function availabilityReviewSummary(diffs, draft, context = draft?.snapshot || {}) {
    const beforeRows = new Map((context.availability || []).map((row) => [normalizeId(row.city_id), row]));
    const afterRows = new Map((draft.availability || []).map((row) => [normalizeId(row.city_id), row]));
    return (diffs || []).map((entry) => {
      const before = pairedAvailabilityState(beforeRows.get(entry.cityId));
      const afterRow = entry.action === 'delete' ? null : afterRows.get(entry.cityId);
      const after = pairedAvailabilityState(afterRow);
      return {
        exactOfferId: normalizeId(entry.offerId) || null,
        exactCityId: normalizeId(entry.cityId),
        action: entry.action,
        beforeAvailable: before.checked,
        afterAvailable: entry.action === 'delete' ? false : after.checked,
        beforeMismatch: before.mismatched,
        afterMismatch: entry.action === 'delete' ? false : after.mismatched,
      };
    });
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
      profileId: normalizeId(draft?.pricing?.profileId),
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
        ['id', 'pricing_profile_id', 'location', 'owner_partner_id', 'availability_mode', 'updated_at'],
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
        .map((row) => project(row, ['offer_id', 'city_id', 'pickup_enabled', 'return_enabled', 'is_active', 'updated_at']))
        .sort((left, right) => String(left.city_id).localeCompare(String(right.city_id))),
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
    const payload = profilePayload(draft, context);
    const changes = diffPayload('car_offer', draft.offerId, offer, payload, PROFILE_COLUMNS);
    const step = changes.length
      ? buildStep('pricing_profile', 'car_offer', 'update', draft.offerId, offer.updated_at, payload, changes)
      : null;
    return createPlan('pricing_profile', draft, step ? [step] : [], {
      existingPriceColumnChanges: 0,
      preservedPriceColumns: PRICE_COLUMNS.reduce((result, column) => {
        result[column] = clone(offer[column]);
        return result;
      }, {}),
      preflightSnapshot: buildPreflightSnapshot(draft, context),
    });
  }

  function buildAvailabilityPlan(draft, context = draft?.snapshot || {}) {
    const diffs = availabilityDiff(draft, context);
    const forbidden = diffs.flatMap((entry) => entry.changes).filter((change) => PRICE_COLUMNS.includes(change.field) || change.field === 'owner_partner_id');
    if (forbidden.length) throw new Error('Availability plan contains forbidden fields');
    const steps = diffs.map((entry) => buildStep(
      `availability_${entry.action}_${entry.cityId}`,
      'car_offer_city_availability',
      entry.action,
      entry.entityId,
      entry.expectedUpdatedAt,
      entry.payload || {},
      entry.changes,
    ));
    return createPlan('availability', draft, steps, {
      exactProfileId: normalizeId(draft.pricing.profileId),
      availableCities: availabilityReviewSummary(diffs, draft, context),
      profileCitySnapshot: clone(context.profileCities || []),
      citySnapshot: clone(context.cities || []),
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

  function buildCreateVehiclePlan(draft, context = draft?.snapshot || {}) {
    const profile = profileById(context, draft.pricing.profileId);
    const payload = {
      ...vehiclePayload(draft),
      ...pricingPayload(draft),
      pricing_profile_id: normalizeId(profile?.id),
      location: assertProfileContract(profile),
      owner_partner_id: normalizeNullableId(draft.partner.ownerPartnerId),
      availability_mode: 'legacy',
    };
    const keys = Object.keys(payload);
    const forbidden = keys.filter((key) => !CREATE_COLUMNS.includes(key));
    if (forbidden.length) throw new Error(`Create payload contains forbidden fields: ${forbidden.join(', ')}`);
    const offerStep = buildStep('create_offer', 'car_offer', 'insert', null, null, payload, keys.map((field) => fieldDiff('car_offer', null, field, null, payload[field])).filter(Boolean));
    const availabilitySteps = (draft.availability || []).filter((row) => row.is_active || row.pickup_enabled || row.return_enabled).map((row) => {
      const cityId = normalizeId(row.city_id);
      const availabilityPayload = {
        offer_id: '$created_offer_id',
        city_id: cityId,
        pickup_enabled: row.pickup_enabled === true,
        return_enabled: row.return_enabled === true,
        is_active: row.is_active === true,
      };
      return buildStep(
        `create_availability_${cityId}`,
        'car_offer_city_availability',
        'insert',
        `$created_offer_id:${cityId}`,
        null,
        availabilityPayload,
        AVAILABILITY_COLUMNS.map((field) => fieldDiff('car_offer_city_availability', `$created_offer_id:${cityId}`, field, null, availabilityPayload[field], { cityId })).filter(Boolean),
        ['create_offer'],
      );
    });
    return createPlan('create', draft, [offerStep, ...availabilitySteps], {
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
      publicMode: draft?.publicMode,
      globalMappedFlag: draft?.globalMappedFlag,
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
      const actualMappings = stableSerialize((freshContext?.profileCities || []).map((row) => ({
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
    if (freshContext?.siteSetting?.car_multi_city_mapped_enabled !== false) {
      errors.push({ field: 'globalFlag', message: 'Global mapped flag is not false.' });
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
    if (!LEGACY_PRICING_KEYS.includes(key)) errors.push({ field: 'legacyKey', message: 'Unsupported legacy pricing key.' });
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
    AVAILABILITY_COLUMNS,
    CREATE_COLUMNS,
    LEGACY_CITY_FEE_PREVIEW,
    LEGACY_LOCATIONS,
    LEGACY_PRICING_KEYS,
    PARTNER_COLUMNS,
    PLACE_TYPES,
    PRICE_COLUMNS,
    PROFILE_COLUMNS,
    PROFILE_PRICE_COLUMNS,
    PENDING_IMAGE_URL,
    VEHICLE_COLUMNS,
    VEHICLE_IMAGE_BUCKET,
    VEHICLE_IMAGE_EXTENSIONS,
    VEHICLE_IMAGE_MAX_BYTES,
    VEHICLE_IMAGE_MIME_TYPES,
    availabilityDiff,
    availabilityReviewSummary,
    assertProfileContract,
    buildAvailabilityPlan,
    buildCreateVehiclePlan,
    buildPreflightSnapshot,
    buildPartnerAssignmentPlan,
    buildPricingProfilePlan,
    buildReviewPlan,
    buildVehicleDetailsPlan,
    cityById,
    clone,
    createCityDraft,
    createDraft,
    defaultAvailabilityRows,
    fingerprintDraft,
    getMappedReadiness,
    invalidateReview,
    isReviewCurrent,
    mappingFor,
    normalizeAvailabilityRow,
    normalizeCode,
    normalizeId,
    normalizeI18n,
    pairedAvailabilityState,
    profileByCode,
    profileById,
    profileLocation,
    resolveI18nText,
    setPairedAvailability,
    setDraftProfile,
    setVehicleImageAction,
    stableSerialize,
    validateCityDraft,
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
