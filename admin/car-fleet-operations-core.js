const STANDARD_LEGACY_FEE_CITIES = new Set([
  'larnaca',
  'nicosia',
  'ayia-napa',
  'protaras',
  'limassol',
  'paphos',
]);

export const CAR_FLEET_TRI_STATE = Object.freeze(['no_change', 'enable', 'disable']);
export const CAR_FLEET_AVAILABILITY_MODE_ACTIONS = Object.freeze(['no_change', 'mapped', 'legacy']);
export const CAR_FLEET_FEE_ACTIONS = Object.freeze(['no_change', 'inherit', 'custom']);
export const CAR_FLEET_SECURITY_DEPOSIT_ACTIONS = Object.freeze(['no_change', 'unspecified', 'none', 'amount']);
export const CAR_FLEET_PAYMENT_ACTIONS = Object.freeze(['no_change', 'default', 'flat', 'per_day', 'percent_total']);

function text(value) {
  return String(value == null ? '' : value).trim();
}

function code(value) {
  return text(value).toLowerCase();
}

function id(value) {
  return text(value);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function boolAction(current, action) {
  if (action === 'enable') return true;
  if (action === 'disable') return false;
  return current === true;
}

function finiteMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || Math.abs((amount * 100) - Math.round(amount * 100)) > 1e-8) {
    return null;
  }
  return Number(amount.toFixed(2));
}

function normalizedAvailabilityRow(row = {}) {
  const pickupEnabled = row.pickup_enabled === true;
  const returnEnabled = row.return_enabled === true;
  const feeMode = code(row.fee_mode) === 'override' ? 'override' : 'inherit';
  return {
    offer_id: id(row.offer_id),
    city_id: id(row.city_id),
    pickup_enabled: pickupEnabled,
    return_enabled: returnEnabled,
    is_active: pickupEnabled || returnEnabled,
    fee_mode: feeMode,
    fee_per_direction: feeMode === 'override' ? finiteMoney(row.fee_per_direction) : null,
    fee_note: text(row.fee_note) || null,
    updated_at: row.updated_at || null,
  };
}

function normalizedCityOperation(operation = {}) {
  const pickup = CAR_FLEET_TRI_STATE.includes(code(operation.pickup)) ? code(operation.pickup) : 'no_change';
  const returns = CAR_FLEET_TRI_STATE.includes(code(operation.return)) ? code(operation.return) : 'no_change';
  const feeAction = CAR_FLEET_FEE_ACTIONS.includes(code(operation.fee_action)) ? code(operation.fee_action) : 'no_change';
  const feeAmount = feeAction === 'custom' ? finiteMoney(operation.fee_per_direction) : null;
  return {
    city_id: id(operation.city_id),
    pickup,
    return: returns,
    fee_action: feeAction,
    fee_per_direction: feeAmount,
  };
}

export function normalizeFleetBulkOperations(input = {}) {
  const availabilityMode = CAR_FLEET_AVAILABILITY_MODE_ACTIONS.includes(code(input.availability_mode))
    ? code(input.availability_mode)
    : 'no_change';
  const securityAction = CAR_FLEET_SECURITY_DEPOSIT_ACTIONS.includes(code(input.security_deposit?.action))
    ? code(input.security_deposit.action)
    : 'no_change';
  const paymentAction = CAR_FLEET_PAYMENT_ACTIONS.includes(code(input.payment_due?.action))
    ? code(input.payment_due.action)
    : 'no_change';
  const partnerAction = code(input.partner?.action) === 'assign' ? 'assign' : 'no_change';
  return {
    availability_mode: availabilityMode,
    cities: (input.cities || [])
      .map(normalizedCityOperation)
      .filter((operation) => operation.city_id)
      .sort((left, right) => left.city_id.localeCompare(right.city_id)),
    security_deposit: {
      action: securityAction,
      amount: securityAction === 'amount' ? finiteMoney(input.security_deposit?.amount) : null,
    },
    payment_due: {
      action: paymentAction,
      amount: ['flat', 'per_day', 'percent_total'].includes(paymentAction)
        ? finiteMoney(input.payment_due?.amount)
        : null,
      currency: text(input.payment_due?.currency || 'EUR').toUpperCase(),
      include_children: input.payment_due?.include_children !== false,
    },
    partner: {
      action: partnerAction,
      partner_id: partnerAction === 'assign' ? id(input.partner?.partner_id) : null,
    },
  };
}

export function buildDesiredFleetAvailabilityRows(currentRows = [], cityOperations = []) {
  const byCity = new Map((currentRows || []).map((row) => {
    const normalized = normalizedAvailabilityRow(row);
    return [normalized.city_id, normalized];
  }));
  for (const rawOperation of cityOperations || []) {
    const operation = normalizedCityOperation(rawOperation);
    if (!operation.city_id) continue;
    const current = byCity.get(operation.city_id) || normalizedAvailabilityRow({ city_id: operation.city_id });
    const pickupEnabled = boolAction(current.pickup_enabled, operation.pickup);
    const returnEnabled = boolAction(current.return_enabled, operation.return);
    const feeMode = operation.fee_action === 'inherit'
      ? 'inherit'
      : operation.fee_action === 'custom' ? 'override' : current.fee_mode;
    const feePerDirection = operation.fee_action === 'custom'
      ? operation.fee_per_direction
      : feeMode === 'override' ? current.fee_per_direction : null;
    byCity.set(operation.city_id, {
      ...current,
      city_id: operation.city_id,
      pickup_enabled: pickupEnabled,
      return_enabled: returnEnabled,
      is_active: pickupEnabled || returnEnabled,
      fee_mode: feeMode,
      fee_per_direction: feePerDirection,
    });
  }
  return [...byCity.values()].sort((left, right) => left.city_id.localeCompare(right.city_id));
}

function profileForOffer(offer, context) {
  return (context.profiles || []).find((profile) => id(profile.id) === id(offer?.pricing_profile_id)) || null;
}

function cityForId(cityId, context) {
  return (context.cities || []).find((city) => id(city.id) === id(cityId)) || null;
}

function inheritedFeeValid(offer, city, context) {
  const cityCode = code(city?.code);
  if (!STANDARD_LEGACY_FEE_CITIES.has(cityCode)) return false;
  if (code(offer?.pricing_strategy || 'legacy_compat') === 'threshold_daily_rate') return true;
  const profile = profileForOffer(offer, context);
  const calculator = code(profile?.calculator_key || offer?.location);
  if (calculator === 'larnaca') return true;
  return calculator === 'paphos' && cityCode === 'paphos';
}

export function evaluateConfiguredAvailabilityReadiness({ offer, availabilityRows, dailyRateTiers = [], context = {} } = {}) {
  const reasons = [];
  const rows = (availabilityRows || []).map(normalizedAvailabilityRow);
  let pickupCount = 0;
  let returnCount = 0;
  for (const row of rows) {
    if (!row.is_active) continue;
    const city = cityForId(row.city_id, context);
    if (!city || city.is_active !== true) {
      reasons.push(`City ${row.city_id || 'unknown'} is missing or inactive.`);
      continue;
    }
    const feeValid = row.fee_mode === 'override'
      ? finiteMoney(row.fee_per_direction) !== null
      : inheritedFeeValid(offer, city, context);
    if (!feeValid) {
      reasons.push(`Fee required for ${text(city.code) || row.city_id}.`);
      continue;
    }
    if (row.pickup_enabled) pickupCount += 1;
    if (row.return_enabled) returnCount += 1;
  }
  if (pickupCount < 1) reasons.push('At least one active pickup city is required.');
  if (returnCount < 1) reasons.push('At least one active return city is required.');

  if (code(offer?.pricing_strategy || 'legacy_compat') === 'legacy_compat') {
    const profile = profileForOffer(offer, context);
    if (!profile || profile.is_active !== true) reasons.push('The legacy pricing profile is missing or inactive.');
    const expectedLocation = code(profile?.legacy_booking_location);
    if (profile && (!['larnaca', 'paphos'].includes(code(profile.calculator_key))
      || !expectedLocation
      || expectedLocation !== code(offer?.location))) {
      reasons.push('Legacy pricing compatibility metadata is invalid.');
    }
  } else {
    const activeTiers = (dailyRateTiers || [])
      .filter((tier) => tier?.is_active !== false)
      .map((tier) => ({
        thresholdDays: Number(tier?.threshold_days),
        dailyRate: Number(tier?.daily_rate),
      }))
      .sort((left, right) => left.thresholdDays - right.thresholdDays);
    const uniqueThresholds = new Set(activeTiers.map((tier) => tier.thresholdDays));
    if (!activeTiers.length) {
      reasons.push('At least one active daily-rate tier is required.');
    } else if (uniqueThresholds.size !== activeTiers.length || activeTiers.some((tier) => (
      !Number.isInteger(tier.thresholdDays)
      || tier.thresholdDays < 1
      || !Number.isFinite(tier.dailyRate)
      || tier.dailyRate <= 0
    ))) {
      reasons.push('Active daily-rate tiers are invalid or duplicated.');
    } else {
      const minimumDays = activeTiers[0].thresholdDays;
      if (Number(offer?.min_rental_days) !== minimumDays) {
        reasons.push('Minimum rental days must match the lowest active daily-rate tier.');
      }
      const maximumDays = offer?.max_rental_days == null || offer?.max_rental_days === ''
        ? null
        : Number(offer.max_rental_days);
      if (maximumDays !== null && (!Number.isInteger(maximumDays) || maximumDays < minimumDays)) {
        reasons.push('Maximum rental days cannot be below the threshold minimum.');
      }
    }
    const ownerId = id(offer?.owner_partner_id);
    const owner = (context.partners || []).find((partner) => id(partner.id) === ownerId);
    if (!owner || owner.status !== 'active' || owner.can_manage_cars !== true) {
      reasons.push('An active exact Cars owner partner is required.');
    }
  }

  return Object.freeze({
    ready: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    pickupCount,
    returnCount,
  });
}

export function filterFleetItems(items = [], filters = {}) {
  const search = code(filters.search);
  const partnerId = id(filters.partnerId);
  const kind = code(filters.vehicleKind);
  const pricingStrategy = code(filters.pricingStrategy);
  const availabilityMode = code(filters.availabilityMode);
  const publicStatus = code(filters.publicStatus);
  const operational = code(filters.operationalAvailability);
  const cityId = id(filters.cityId);
  const legacyRegion = code(filters.legacyRegion);
  return (items || []).filter((item) => {
    if (search && !code([item.model, item.commercialClass, item.offer?.id].join(' ')).includes(search)) return false;
    if (partnerId && id(item.partnerId) !== partnerId) return false;
    if (kind && code(item.vehicleKindCode) !== kind) return false;
    if (pricingStrategy && code(item.offer?.pricing_strategy || 'legacy_compat') !== pricingStrategy) return false;
    if (availabilityMode && code(item.offer?.availability_mode || 'legacy') !== availabilityMode) return false;
    if (publicStatus && code(item.publicState?.status) !== publicStatus) return false;
    if (operational === 'available' && item.offer?.is_available !== true) return false;
    if (operational === 'unavailable' && item.offer?.is_available === true) return false;
    if (cityId && !(item.availabilityRows || []).some((row) => id(row.city_id) === cityId && row.is_active === true)) return false;
    if (legacyRegion && code(item.offer?.location) !== legacyRegion) return false;
    return true;
  });
}

export function groupFleetItemsByPartner(items = [], partners = []) {
  const partnerById = new Map((partners || []).map((partner) => [id(partner.id), partner]));
  const groups = new Map();
  for (const item of items || []) {
    const partnerId = id(item.partnerId) || 'unassigned';
    if (!groups.has(partnerId)) {
      groups.set(partnerId, {
        partnerId,
        partnerName: partnerById.get(partnerId)?.name || item.partnerName || 'Unassigned',
        items: [],
      });
    }
    groups.get(partnerId).items.push(item);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      count: group.items.length,
      live: group.items.filter((item) => item.publicState?.status === 'LIVE').length,
      unavailable: group.items.filter((item) => item.offer?.is_available !== true || !(Number(item.offer?.stock_count) > 0)).length,
      legacyAvailability: group.items.filter((item) => code(item.offer?.availability_mode || 'legacy') === 'legacy').length,
      configuredAvailability: group.items.filter((item) => code(item.offer?.availability_mode) === 'mapped').length,
    }))
    .sort((left, right) => left.partnerName.localeCompare(right.partnerName));
}

export function reconcileFleetSelection(selectedIds, existingItems = []) {
  const existing = new Set((existingItems || []).map((item) => id(item.offer?.id)).filter(Boolean));
  return new Set([...selectedIds].map(id).filter((offerId) => existing.has(offerId)));
}

export function setFleetSelectionScope(selectedIds, scopeIds, selected) {
  const next = new Set([...selectedIds].map(id).filter(Boolean));
  for (const offerId of (scopeIds || []).map(id).filter(Boolean)) {
    if (selected) next.add(offerId);
    else next.delete(offerId);
  }
  return next;
}

function expectedOverrideSnapshot(row) {
  if (!row) return null;
  return {
    id: id(row.id),
    updated_at: row.updated_at || null,
    mode: code(row.mode),
    amount: finiteMoney(row.amount),
    currency: text(row.currency || 'EUR').toUpperCase(),
    include_children: row.include_children !== false,
    enabled: row.enabled !== false,
  };
}

export function buildFleetBulkPlan({ selectedOfferIds, items, operations, context = {} } = {}) {
  const selected = new Set((selectedOfferIds || []).map(id).filter(Boolean));
  const normalizedOperations = normalizeFleetBulkOperations(operations);
  const selectedItems = (items || [])
    .filter((item) => selected.has(id(item.offer?.id)))
    .sort((left, right) => id(left.offer.id).localeCompare(id(right.offer.id)));
  const errors = [];
  if (!selectedItems.length) errors.push('Select at least one exact vehicle.');
  if (selectedItems.length !== selected.size) errors.push('One or more selected exact vehicles are no longer loaded.');
  if (selected.size > 250) errors.push('A Fleet transaction can include at most 250 exact vehicles.');
  if (new Set(normalizedOperations.cities.map((operation) => operation.city_id)).size !== normalizedOperations.cities.length) {
    errors.push('Each city may appear only once in a reviewed Fleet operation.');
  }
  if (normalizedOperations.security_deposit.action === 'amount'
    && !(normalizedOperations.security_deposit.amount > 0)) {
    errors.push('Refundable security deposit amount must be greater than zero.');
  }
  if (['flat', 'per_day'].includes(normalizedOperations.payment_due.action)
    && !(normalizedOperations.payment_due.amount > 0)) {
    errors.push('Payment-due amount must be greater than zero.');
  }
  if (normalizedOperations.payment_due.action === 'percent_total'
    && !(normalizedOperations.payment_due.amount > 0 && normalizedOperations.payment_due.amount <= 100)) {
    errors.push('Percent of total must be greater than zero and no more than 100.');
  }
  if (normalizedOperations.partner.action === 'assign') {
    const partner = (context.partners || []).find((row) => id(row.id) === normalizedOperations.partner.partner_id);
    if (!partner || partner.status !== 'active' || partner.can_manage_cars !== true) {
      errors.push('Selected partner is not active for Cars.');
    }
  }
  if (normalizedOperations.cities.some((operation) => operation.fee_action === 'custom'
    && operation.fee_per_direction === null)) {
    errors.push('Every Custom fee must be a valid amount of zero or greater with at most two decimals.');
  }

  const targets = selectedItems.map((item) => {
    const desiredAvailability = buildDesiredFleetAvailabilityRows(item.availabilityRows, normalizedOperations.cities);
    const targetAvailabilityMode = normalizedOperations.availability_mode === 'no_change'
      ? code(item.offer.availability_mode || 'legacy')
      : normalizedOperations.availability_mode;
    const readinessOffer = normalizedOperations.partner.action === 'assign'
      ? { ...item.offer, owner_partner_id: normalizedOperations.partner.partner_id }
      : item.offer;
    const readiness = evaluateConfiguredAvailabilityReadiness({
      offer: readinessOffer,
      availabilityRows: desiredAvailability,
      dailyRateTiers: item.dailyRateTiers,
      context,
    });
    if (targetAvailabilityMode === 'mapped' && !readiness.ready) {
      errors.push(`${item.model || item.offer.id}: ${readiness.reasons.join(' ')}`);
    }
    if (normalizedOperations.partner.action === 'assign'
      && code(item.offer?.pricing_strategy || 'legacy_compat') === 'legacy_compat') {
      const partner = (context.partners || []).find((row) => id(row.id) === normalizedOperations.partner.partner_id);
      const compatibilityLocation = code(item.offer?.location);
      const supportedLocations = Array.isArray(partner?.cars_locations)
        ? partner.cars_locations.map(code)
        : [];
      if (!compatibilityLocation || !supportedLocations.includes(compatibilityLocation)) {
        errors.push(`${item.model || item.offer.id}: selected partner does not support the legacy compatibility region ${compatibilityLocation || 'not specified'}.`);
      }
    }
    const availabilityChangeRequested = normalizedOperations.cities.length > 0;
    return {
      offer_id: id(item.offer.id),
      expected_updated_at: item.offer.updated_at || null,
      expected_availability: (item.availabilityRows || []).map((row) => {
        const normalized = normalizedAvailabilityRow(row);
        return {
          city_id: normalized.city_id,
          updated_at: normalized.updated_at,
          pickup_enabled: normalized.pickup_enabled,
          return_enabled: normalized.return_enabled,
          is_active: normalized.is_active,
          fee_mode: normalized.fee_mode,
          fee_per_direction: normalized.fee_per_direction,
          fee_note: normalized.fee_note,
        };
      }).sort((left, right) => left.city_id.localeCompare(right.city_id)),
      expected_deposit_override: expectedOverrideSnapshot(item.depositOverride),
      desired_availability: availabilityChangeRequested
        ? desiredAvailability.map((row) => ({
          city_id: row.city_id,
          pickup_enabled: row.pickup_enabled,
          return_enabled: row.return_enabled,
          fee_mode: row.fee_mode,
          fee_per_direction: row.fee_per_direction,
          fee_note: row.fee_note,
        }))
        : null,
      target_availability_mode: targetAvailabilityMode,
      readiness,
    };
  });

  const noChanges = normalizedOperations.availability_mode === 'no_change'
    && normalizedOperations.cities.every((operation) => operation.pickup === 'no_change'
      && operation.return === 'no_change'
      && operation.fee_action === 'no_change')
    && normalizedOperations.security_deposit.action === 'no_change'
    && normalizedOperations.payment_due.action === 'no_change'
    && normalizedOperations.partner.action === 'no_change';
  if (noChanges) errors.push('Choose at least one reviewed bulk operation.');

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    selectedCount: selectedItems.length,
    exactOfferIds: Object.freeze(selectedItems.map((item) => id(item.offer.id))),
    targets: Object.freeze(targets.map((target) => Object.freeze(target))),
    operations: Object.freeze(clone(normalizedOperations)),
  });
}
