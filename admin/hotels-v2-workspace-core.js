(function attachHotelsV2WorkspaceCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2WorkspaceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2WorkspaceCore() {
  'use strict';

  const LANGUAGES = Object.freeze(['pl', 'en', 'he']);
  const ROOM_STATUSES = Object.freeze(['draft', 'active', 'disabled']);
  const UNIT_STATUSES = Object.freeze(['active', 'maintenance', 'disabled']);
  const INVENTORY_MODES = Object.freeze(['pooled', 'unitized']);
  const BOOKING_MODES = Object.freeze(['request_confirmation', 'instant_booking', 'external_redirect']);
  const BED_TYPES = Object.freeze([
    'double',
    'single',
    'sofa',
    'bunk',
    'king',
    'queen',
    'other',
  ]);
  const PENALTY_MODES = Object.freeze(['none', 'flat', 'percent']);

  const BED_LABELS = Object.freeze({
    double: 'Double bed',
    single: 'Single bed',
    sofa: 'Sofa bed',
    bunk: 'Bunk bed',
    king: 'King bed',
    queen: 'Queen bed',
    other: 'Other',
  });

  const CALENDAR_PRECEDENCE = Object.freeze([
    Object.freeze({ rank: 1, key: 'safety_closure', label: 'Safety closure' }),
    Object.freeze({ rank: 2, key: 'exact_date_admin_override', label: 'Exact-date Admin override' }),
    Object.freeze({ rank: 3, key: 'highest_priority_range_rule', label: 'Highest-priority seasonal or range rule' }),
    Object.freeze({ rank: 4, key: 'matching_weekday_rule', label: 'Matching weekday rule' }),
    Object.freeze({ rank: 5, key: 'room_rate_base', label: 'Room-rate base rate' }),
  ]);

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asText(value) {
    return String(value == null ? '' : value).trim();
  }

  function asNullableText(value) {
    const text = asText(value);
    return text || null;
  }

  function asInteger(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  function asNumber(value, fallback = null) {
    if (value === '' || value == null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeUuid(value) {
    const text = asText(value).toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text)
      ? text
      : '';
  }

  function newUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    throw new Error('Secure UUID generation is unavailable in this browser.');
  }

  function normalizeI18n(value, options = {}) {
    const source = asObject(value);
    const fallback = asText(options.fallback);
    const result = {};
    LANGUAGES.forEach((language) => {
      const candidate = asText(source[language]);
      if (candidate) result[language] = candidate;
    });
    if (!result.en && fallback) result.en = fallback;
    return result;
  }

  function i18nText(value, language = 'en', fallback = '') {
    if (typeof value === 'string') return asText(value) || fallback;
    const source = normalizeI18n(value);
    const normalizedLanguage = asText(language).toLowerCase();
    return source[normalizedLanguage] || source.en || source.pl || source.he || fallback;
  }

  function normalizeGallery(value) {
    return asArray(value)
      .map((entry) => asText(typeof entry === 'string' ? entry : entry?.url))
      .filter(Boolean)
      .filter((entry, index, rows) => rows.indexOf(entry) === index);
  }

  function normalizeAmenities(value) {
    return asArray(value)
      .map(asText)
      .filter(Boolean)
      .filter((entry, index, rows) => rows.indexOf(entry) === index)
      .sort((a, b) => a.localeCompare(b));
  }

  function normalizeBedConfiguration(value) {
    return asArray(value).map((raw) => {
      const source = asObject(raw);
      const bedType = BED_TYPES.includes(asText(source.type)) ? asText(source.type) : 'other';
      const quantity = asInteger(source.quantity, 0);
      const label = bedType === 'other' ? normalizeI18n(source.label) : {};
      return { type: bedType, quantity, ...(Object.keys(label).length ? { label } : {}) };
    }).filter((entry) => entry.quantity > 0);
  }

  function formatBedConfiguration(value) {
    const beds = normalizeBedConfiguration(value);
    if (!beds.length) return 'Not specified';
    return beds.map((bed) => `${bed.quantity} × ${i18nText(bed.label, 'en', BED_LABELS[bed.type] || 'Bed')}`).join(' · ');
  }

  function normalizeCancellationPolicy(value) {
    const source = asObject(value);
    const type = ['flexible', 'custom', 'non_refundable'].includes(asText(source.type))
      ? asText(source.type)
      : 'flexible';
    if (type === 'non_refundable') return { type: 'non_refundable' };
    if (type === 'flexible') return { type: 'flexible' };

    const deadlineHours = asInteger(source.deadline_hours, 0);
    const legacyPenalty = asObject(source.penalty);
    const requestedMode = asText(source.penalty_mode || legacyPenalty.mode);
    const penaltyMode = PENALTY_MODES.includes(requestedMode) && requestedMode !== 'first_night' ? requestedMode : 'none';
    const penaltyValue = asNumber(source.penalty_value ?? legacyPenalty.value, null);
    const normalized = {
      type: 'custom',
      deadline_hours: Math.max(0, deadlineHours),
      penalty_mode: penaltyMode,
    };
    if (['flat', 'percent'].includes(penaltyMode) && penaltyValue != null) {
      normalized.penalty_value = penaltyValue;
    }
    const summary = normalizeI18n(source.summary_i18n);
    if (Object.keys(summary).length) normalized.summary_i18n = summary;
    return normalized;
  }

  function cancellationPolicyLabel(value) {
    const policy = normalizeCancellationPolicy(value);
    if (policy.type === 'non_refundable') return 'Non-refundable';
    if (policy.type === 'flexible') return 'Flexible';
    const deadline = `${policy.deadline_hours}h deadline`;
    if (policy.penalty_mode === 'percent') return `Custom · ${deadline} · ${policy.penalty_value || 0}%`;
    if (policy.penalty_mode === 'flat') return `Custom · ${deadline} · fixed ${policy.penalty_value || 0}`;
    return `Custom · ${deadline}`;
  }

  function normalizeRoomType(value) {
    const source = asObject(value);
    return {
      id: normalizeUuid(source.id),
      hotel_id: normalizeUuid(source.hotel_id),
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      description_i18n: normalizeI18n(source.description_i18n),
      gallery: normalizeGallery(source.gallery),
      capacity_adults: asInteger(source.capacity_adults, 0),
      capacity_children: asInteger(source.capacity_children, 0),
      bed_configuration: normalizeBedConfiguration(source.bed_configuration),
      bathrooms: asNumber(source.bathrooms, null),
      size_sqm: asNumber(source.size_sqm, null),
      amenities: normalizeAmenities(source.amenities),
      inventory_mode: INVENTORY_MODES.includes(asText(source.inventory_mode)) ? asText(source.inventory_mode) : 'pooled',
      base_inventory_count: asInteger(source.base_inventory_count, 0),
      status: ROOM_STATUSES.includes(asText(source.status)) ? asText(source.status) : 'draft',
      sort_order: Math.max(0, asInteger(source.sort_order, 1000)),
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function normalizeUnit(value) {
    const source = asObject(value);
    return {
      id: normalizeUuid(source.id),
      room_type_id: normalizeUuid(source.room_type_id),
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      status: UNIT_STATUSES.includes(asText(source.status)) ? asText(source.status) : 'active',
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function normalizeRatePlan(value) {
    const source = asObject(value);
    const bookingOverride = asNullableText(source.booking_mode_override);
    return {
      id: normalizeUuid(source.id),
      hotel_id: normalizeUuid(source.hotel_id),
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      description_i18n: normalizeI18n(source.description_i18n),
      meal_plan_code: asNullableText(source.meal_plan_code)?.toLowerCase() || null,
      cancellation_policy: normalizeCancellationPolicy(source.cancellation_policy),
      booking_mode_override: BOOKING_MODES.includes(bookingOverride) ? bookingOverride : null,
      is_active: source.is_active === true,
      sort_order: Math.max(0, asInteger(source.sort_order, 1000)),
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function normalizeRoomRate(value) {
    const source = asObject(value);
    return {
      id: normalizeUuid(source.id),
      hotel_id: normalizeUuid(source.hotel_id),
      room_type_id: normalizeUuid(source.room_type_id),
      rate_plan_id: normalizeUuid(source.rate_plan_id),
      base_nightly_rate: asNumber(source.base_nightly_rate, null),
      currency: (asText(source.currency) || 'EUR').toUpperCase(),
      external_redirect_url: asNullableText(source.external_redirect_url),
      is_active: source.is_active === true,
      sort_order: Math.max(0, asInteger(source.sort_order, 1000)),
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function normalizeWorkspace(value) {
    const source = asObject(value);
    const property = asObject(source.property);
    const ownerPartner = asObject(source.owner_partner);
    return {
      property: {
        ...clone(property),
        id: normalizeUuid(property.id),
        architecture_version: asText(property.architecture_version) || 'legacy',
        booking_mode: asText(property.booking_mode) || 'request_confirmation',
        timezone: asText(property.timezone) || 'Europe/Nicosia',
        currency: (asText(property.currency) || 'EUR').toUpperCase(),
        title: normalizeI18n(property.title_i18n || property.title),
        title_i18n: normalizeI18n(property.title_i18n || property.title),
        description: normalizeI18n(property.description_i18n || property.description),
        description_i18n: normalizeI18n(property.description_i18n || property.description),
        amenities: normalizeAmenities(property.amenities),
        photos: normalizeGallery(property.photos),
        owner_partner: Object.keys(ownerPartner).length ? clone(ownerPartner) : clone(property.owner_partner || {}),
      },
      room_types: asArray(source.room_types).map(normalizeRoomType),
      units: asArray(source.units).map(normalizeUnit),
      rate_plans: asArray(source.rate_plans).map(normalizeRatePlan),
      room_rates: asArray(source.room_rates).map(normalizeRoomRate),
      amenities_catalog: asArray(source.amenities_catalog || source.amenities_catalogue).map((entry) => clone(entry)),
      partners: asArray(source.partners).map((entry) => clone(entry)),
      operational_partners: asArray(source.operational_partners).map((entry) => clone(entry)),
      payment_due: clone(source.payment_due || source.payment_due_at_booking || {}),
      counts: clone(source.counts || { upcoming_bookings: source.upcoming_booking_count || 0 }),
      flags: clone(source.flags || source.feature_flags || {}),
      activity: asArray(source.activity || source.recent_activity).map((entry) => clone(entry)),
      readiness: clone(source.readiness || {}),
    };
  }

  function totalConfiguredInventory(workspace) {
    const normalized = normalizeWorkspace(workspace);
    return normalized.room_types.reduce((total, room) => {
      if (room.status === 'disabled') return total;
      if (room.inventory_mode === 'unitized') {
        return total + normalized.units.filter((unit) => unit.room_type_id === room.id && unit.status === 'active').length;
      }
      return total + Math.max(0, room.base_inventory_count);
    }, 0);
  }

  function deriveWorkspaceReadiness(workspace) {
    const normalized = normalizeWorkspace(workspace);
    const property = normalized.property;
    const activeRooms = normalized.room_types.filter((room) => room.status === 'active');
    const activePlans = normalized.rate_plans.filter((plan) => plan.is_active);
    const activeRates = normalized.room_rates.filter((rate) => rate.is_active);
    const hasConfiguration = normalized.room_types.length > 0 || normalized.rate_plans.length > 0 || normalized.room_rates.length > 0;
    const blockers = [];
    const warnings = [];

    if (!i18nText(property.title, 'en')) blockers.push('Property name is missing.');
    if (!asText(property.city)) blockers.push('City is missing.');
    if (!asText(property.timezone)) blockers.push('Timezone is missing.');
    if (!/^[A-Z]{3}$/.test(asText(property.currency))) blockers.push('Currency must be a three-letter code.');
    if (!BOOKING_MODES.includes(asText(property.booking_mode))) blockers.push('Booking mode is invalid.');
    if (!activeRooms.length) blockers.push('Add at least one active Room Type.');
    if (activeRooms.some((room) => room.capacity_adults < 1 || room.capacity_children < 0)) {
      blockers.push('Every active Room Type needs valid guest capacity.');
    }
    activeRooms.forEach((room) => {
      if (room.inventory_mode === 'pooled' && room.base_inventory_count < 1) {
        blockers.push(`${i18nText(room.name_i18n, 'en', room.code)} needs pooled inventory.`);
      }
      if (room.inventory_mode === 'unitized') {
        const activeUnitCount = normalized.units.filter((unit) => unit.room_type_id === room.id && unit.status === 'active').length;
        if (activeUnitCount < 1) blockers.push(`${i18nText(room.name_i18n, 'en', room.code)} needs at least one active physical unit.`);
      }
    });
    if (!activePlans.length) blockers.push('Add at least one active Rate Plan.');
    const sellableRates = activeRates.filter((rate) => Number.isFinite(rate.base_nightly_rate) && rate.base_nightly_rate > 0);
    if (!sellableRates.length) blockers.push('Create at least one active Room + Rate Plan product with a positive base rate.');
    sellableRates.forEach((rate) => {
      const room = activeRooms.find((candidate) => candidate.id === rate.room_type_id);
      const plan = activePlans.find((candidate) => candidate.id === rate.rate_plan_id);
      if (!room || !plan) blockers.push('An active room-rate product references an inactive Room Type or Rate Plan.');
      if (rate.hotel_id && rate.hotel_id !== property.id) blockers.push('A room-rate product belongs to another property.');
    });

    const embeddedOwner = asObject(property.owner_partner);
    const ownerPartner = Object.keys(embeddedOwner).length
      ? embeddedOwner
      : asObject(normalized.partners.find((entry) => entry.id === property.owner_partner_id));
    const validOwner = Boolean(
      normalizeUuid(property.owner_partner_id)
      && ownerPartner.status === 'active'
      && ownerPartner.can_manage_hotels === true
    );
    const validOperationalPartner = normalized.operational_partners.some((entry) => (
      entry.is_active === true
      && entry.status === 'active'
      && entry.can_manage_hotels === true
    ));
    if (!validOwner && !validOperationalPartner) blockers.push('Assign an active Hotel partner before Calendar readiness.');
    if (!normalizeUuid(property.owner_partner_id) && validOperationalPartner) {
      warnings.push('Commercial owner is not assigned; an operational Hotel partner currently satisfies readiness.');
    } else if (normalizeUuid(property.owner_partner_id) && !validOwner && validOperationalPartner) {
      warnings.push('Commercial owner is not eligible; an operational Hotel partner currently satisfies readiness.');
    }

    let preparationState = 'DRAFT';
    if (hasConfiguration && blockers.length) preparationState = 'BLOCKED';
    if (hasConfiguration && !blockers.length) preparationState = 'READY_FOR_CALENDAR';
    const publicState = property.architecture_version === 'legacy' ? 'LEGACY' : preparationState;

    return {
      state: publicState,
      label: publicState === 'READY_FOR_CALENDAR' ? 'READY FOR CALENDAR' : publicState,
      preparation_state: preparationState,
      preparation_label: preparationState === 'READY_FOR_CALENDAR' ? 'READY FOR CALENDAR' : preparationState,
      blockers: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings)),
      has_configuration: hasConfiguration,
      room_type_count: normalized.room_types.length,
      active_room_type_count: activeRooms.length,
      active_rate_plan_count: activePlans.length,
      active_room_rate_count: activeRates.length,
      total_inventory: totalConfiguredInventory(normalized),
      ready_for_calendar: hasConfiguration && blockers.length === 0,
      public_live: false,
    };
  }

  function migrationPreview(workspace) {
    const normalized = normalizeWorkspace(workspace);
    const property = normalized.property;
    const legacyRooms = asArray(property.room_types);
    const rules = asArray(asObject(property.pricing_tiers).rules);
    const suggestions = legacyRooms.map((legacyRoom, index) => ({
      source_index: index,
      proposed_code: asText(legacyRoom.id || legacyRoom.code || `legacy-room-${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
      proposed_name: normalizeI18n(legacyRoom.name || legacyRoom.title, { fallback: `Legacy room ${index + 1}` }),
      status: 'not_migrated',
    }));
    return {
      property_id: property.id,
      property_name: i18nText(property.title, 'en', property.slug || property.id),
      architecture_version: property.architecture_version,
      legacy_room_count: legacyRooms.length,
      legacy_pricing_rule_count: rules.length,
      suggestions,
      needs_manual_room_mapping: legacyRooms.length === 0,
      status: 'NOT_MIGRATED',
      messages: legacyRooms.length
        ? ['Review every suggested Room Type before a future migration.']
        : ['No structured legacy room rows are available. Create Room Types manually in shadow mode.'],
    };
  }

  function validateCode(code, label = 'Code') {
    const value = asText(code).toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value)) throw new Error(`${label} must use lowercase letters, numbers, hyphens or underscores.`);
    return value;
  }

  function validateRoomType(value, workspace, options = {}) {
    const room = normalizeRoomType(value);
    room.id = room.id || newUuid();
    room.hotel_id = room.hotel_id || normalizeUuid(workspace?.property?.id);
    room.code = validateCode(room.code, 'Room code');
    if (!i18nText(room.name_i18n, 'en')) throw new Error('Room name in English is required.');
    if (room.capacity_adults < 1) throw new Error('Adults capacity must be at least 1.');
    if (room.capacity_children < 0) throw new Error('Children capacity cannot be negative.');
    if (room.base_inventory_count < 0) throw new Error('Base inventory cannot be negative.');
    const duplicate = normalizeWorkspace(workspace).room_types.find((candidate) => (
      candidate.id !== room.id && candidate.code.toLowerCase() === room.code.toLowerCase()
    ));
    if (duplicate) throw new Error('Room code already exists in this property.');

    const original = normalizeWorkspace(workspace).room_types.find((candidate) => candidate.id === room.id);
    if (original && original.inventory_mode !== room.inventory_mode) {
      const hasUnits = normalizeWorkspace(workspace).units.some((unit) => unit.room_type_id === room.id);
      const dailyInventoryCount = asInteger(workspace?.counts?.daily_inventory_by_room?.[room.id], 0);
      if (hasUnits || dailyInventoryCount > 0 || options.hasBookings === true) {
        throw new Error('Inventory mode cannot be changed after units, inventory or bookings exist.');
      }
    }
    return room;
  }

  function validateUnit(value, workspace) {
    const unit = normalizeUnit(value);
    unit.id = unit.id || newUuid();
    unit.room_type_id = unit.room_type_id || normalizeUuid(value?.room_type_id);
    unit.code = validateCode(unit.code, 'Unit code');
    const normalized = normalizeWorkspace(workspace);
    const room = normalized.room_types.find((candidate) => candidate.id === unit.room_type_id);
    if (!room) throw new Error('Unit Room Type does not exist in this property.');
    if (room.inventory_mode !== 'unitized') throw new Error('Physical units are available only for unitized Room Types.');
    if (normalized.units.some((candidate) => candidate.id !== unit.id && candidate.room_type_id === unit.room_type_id && candidate.code === unit.code)) {
      throw new Error('Unit code already exists for this Room Type.');
    }
    return unit;
  }

  function validateRatePlan(value, workspace) {
    const plan = normalizeRatePlan(value);
    plan.id = plan.id || newUuid();
    plan.hotel_id = plan.hotel_id || normalizeUuid(workspace?.property?.id);
    plan.code = validateCode(plan.code, 'Rate Plan code');
    if (!i18nText(plan.name_i18n, 'en')) throw new Error('Rate Plan name in English is required.');
    if (normalizeWorkspace(workspace).rate_plans.some((candidate) => candidate.id !== plan.id && candidate.code === plan.code)) {
      throw new Error('Rate Plan code already exists in this property.');
    }
    return plan;
  }

  function validateRoomRate(value, workspace) {
    const rate = normalizeRoomRate(value);
    rate.id = rate.id || newUuid();
    rate.hotel_id = rate.hotel_id || normalizeUuid(workspace?.property?.id);
    const normalized = normalizeWorkspace(workspace);
    const room = normalized.room_types.find((candidate) => candidate.id === rate.room_type_id);
    const plan = normalized.rate_plans.find((candidate) => candidate.id === rate.rate_plan_id);
    if (!room || !plan) throw new Error('Choose a Room Type and Rate Plan from this property.');
    if (room.hotel_id !== normalized.property.id || plan.hotel_id !== normalized.property.id || rate.hotel_id !== normalized.property.id) {
      throw new Error('Cross-property room-rate combinations are not allowed.');
    }
    if (!Number.isFinite(rate.base_nightly_rate) || rate.base_nightly_rate < 0) throw new Error('Base nightly rate must be zero or greater.');
    if (rate.is_active && rate.base_nightly_rate <= 0) throw new Error('An active Room + Rate Plan product needs a positive base nightly rate.');
    if (!/^[A-Z]{3}$/.test(rate.currency)) throw new Error('Currency must be a three-letter code.');
    if (normalized.room_rates.some((candidate) => (
      candidate.id !== rate.id && candidate.room_type_id === rate.room_type_id && candidate.rate_plan_id === rate.rate_plan_id
    ))) throw new Error('This Room Type and Rate Plan are already connected.');
    return rate;
  }

  function operationForEntity(entity, nextValue, previousValue = null, operationType = null) {
    const next = clone(nextValue);
    const before = previousValue ? clone(previousValue) : null;
    const id = normalizeUuid(next?.id || before?.id);
    if (!id) throw new Error('Every workspace operation requires an exact UUID.');
    const payloadFields = {
      property: [
        'title_i18n', 'description_i18n', 'city', 'address_line', 'district', 'postal_code',
        'country', 'latitude', 'longitude', 'google_maps_url', 'google_place_id', 'amenities',
        'check_in_from', 'check_out_until', 'timezone', 'currency', 'booking_mode',
        'owner_partner_id', 'cover_image_url', 'photos', 'sort_order',
      ],
      room_type: [
        'source_id', 'code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults',
        'capacity_children', 'bed_configuration', 'bathrooms', 'size_sqm', 'amenities',
        'inventory_mode', 'base_inventory_count', 'status', 'sort_order',
      ],
      unit: ['room_type_id', 'code', 'name_i18n', 'status'],
      rate_plan: [
        'code', 'name_i18n', 'description_i18n', 'meal_plan_code', 'cancellation_policy',
        'booking_mode_override', 'is_active', 'sort_order',
      ],
      room_rate: ['room_type_id', 'rate_plan_id', 'base_nightly_rate', 'currency', 'is_active', 'sort_order'],
    };
    if (!payloadFields[entity]) throw new Error(`Unsupported workspace entity: ${entity}.`);
    const action = operationType || (before ? 'update' : 'create');
    const payload = action === 'disable'
      ? {}
      : Object.fromEntries(payloadFields[entity].filter((field) => Object.prototype.hasOwnProperty.call(next || {}, field)).map((field) => [field, clone(next[field])]));
    if (action === 'update') {
      // Parent relationships are immutable after creation.
      if (entity === 'unit') delete payload.room_type_id;
      if (entity === 'room_rate') {
        delete payload.room_type_id;
        delete payload.rate_plan_id;
      }
    }
    return {
      type: action,
      entity,
      id,
      expected_version: entity === 'property' ? null : (before ? Math.max(1, asInteger(before.version, 1)) : null),
      payload,
    };
  }

  function buildWorkspacePlan(workspace, operations, options = {}) {
    const normalized = normalizeWorkspace(workspace);
    if (!normalized.property.id) throw new Error('Property workspace is missing an exact ID.');
    const rows = asArray(operations).map((operation) => clone(operation));
    if (!rows.length) throw new Error('There are no reviewed changes to save.');
    return {
      hotel_id: normalized.property.id,
      expected_property_updated_at: options.expectedPropertyUpdatedAt || normalized.property.updated_at || null,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      operations: rows,
    };
  }

  function flattenReview(value, prefix = '') {
    const source = value == null ? null : value;
    if (source == null || typeof source !== 'object') return [{ field: prefix || 'value', value: source }];
    const entries = [];
    Object.keys(source).sort().forEach((key) => {
      if (['created_at', 'updated_at', 'version'].includes(key)) return;
      const path = prefix ? `${prefix}.${key}` : key;
      const item = source[key];
      if (item && typeof item === 'object') entries.push({ field: path, value: clone(item) });
      else entries.push({ field: path, value: item });
    });
    return entries;
  }

  function buildReviewRows(entity, before, after) {
    const beforeMap = new Map(flattenReview(before).map((entry) => [entry.field, entry.value]));
    const afterMap = new Map(flattenReview(after).map((entry) => [entry.field, entry.value]));
    const fields = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();
    return fields.filter((field) => JSON.stringify(beforeMap.get(field)) !== JSON.stringify(afterMap.get(field))).map((field) => ({
      entity,
      entity_id: normalizeUuid(after?.id || before?.id),
      field,
      before: clone(beforeMap.get(field)),
      after: clone(afterMap.get(field)),
    }));
  }

  function buildDuplicateRoom(room, workspace) {
    const original = normalizeRoomType(room);
    const normalized = normalizeWorkspace(workspace);
    let suffix = 1;
    let code = `${original.code}-copy`;
    while (normalized.room_types.some((candidate) => candidate.code === code)) {
      suffix += 1;
      code = `${original.code}-copy-${suffix}`;
    }
    return {
      ...clone(original),
      id: newUuid(),
      code,
      name_i18n: Object.fromEntries(Object.entries(original.name_i18n).map(([language, label]) => [language, `${label} copy`])),
      status: 'draft',
      version: 1,
      created_at: null,
      updated_at: null,
    };
  }

  function priceFrom(workspace) {
    const prices = normalizeWorkspace(workspace).room_rates
      .filter((rate) => rate.is_active && Number.isFinite(rate.base_nightly_rate) && rate.base_nightly_rate >= 0)
      .map((rate) => rate.base_nightly_rate);
    return prices.length ? Math.min(...prices) : null;
  }

  return Object.freeze({
    LANGUAGES,
    ROOM_STATUSES,
    UNIT_STATUSES,
    INVENTORY_MODES,
    BOOKING_MODES,
    BED_TYPES,
    BED_LABELS,
    PENALTY_MODES,
    CALENDAR_PRECEDENCE,
    clone,
    asArray,
    asObject,
    asText,
    asNullableText,
    asInteger,
    asNumber,
    normalizeUuid,
    newUuid,
    normalizeI18n,
    i18nText,
    normalizeGallery,
    normalizeAmenities,
    normalizeBedConfiguration,
    formatBedConfiguration,
    normalizeCancellationPolicy,
    cancellationPolicyLabel,
    normalizeRoomType,
    normalizeUnit,
    normalizeRatePlan,
    normalizeRoomRate,
    normalizeWorkspace,
    totalConfiguredInventory,
    deriveWorkspaceReadiness,
    migrationPreview,
    validateCode,
    validateRoomType,
    validateUnit,
    validateRatePlan,
    validateRoomRate,
    operationForEntity,
    buildWorkspacePlan,
    buildReviewRows,
    buildDuplicateRoom,
    priceFrom,
  });
});
