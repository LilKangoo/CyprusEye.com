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
  const CHILDREN_POLICIES = Object.freeze(['allowed', 'not_allowed', 'minimum_age']);
  const ROOM_CHILDREN_POLICY_OVERRIDES = Object.freeze(['allowed', 'not_allowed', 'minimum_age']);
  const ROOM_ALLOCATION_MODES = Object.freeze(['customer_choice', 'required_bundle']);
  const HOTEL_PRICE_INCLUSIONS = Object.freeze(['taxes', 'cleaning']);
  const HOTEL_PAYMENT_DUE_EVENTS = Object.freeze(['at_booking', 'after_partner_acceptance', 'before_arrival', 'on_arrival']);
  const HOTEL_PAYMENT_AMOUNT_MODES = Object.freeze(['percent_total', 'flat', 'remaining_balance']);
  const HOTEL_PAYMENT_RECIPIENTS = Object.freeze(['partner', 'platform']);
  const HOTEL_PAYMENT_METHODS = Object.freeze(['bank_transfer', 'cash', 'card', 'online']);
  const HOTEL_COMMISSION_MODES = Object.freeze(['per_allocated_room_per_night', 'percent_booking_total']);
  const HOTEL_CALENDAR_SOURCES = Object.freeze(['manual', 'booking_com', 'airbnb', 'ical']);
  const EXTERNAL_CALENDAR_SOURCE_TYPES = Object.freeze(['booking_com', 'airbnb', 'ical']);
  const H3_REVIEW_STATUSES = Object.freeze(['requires_review', 'reviewed', 'disabled']);
  const H3_2A_PARTNER_PERMISSIONS_CONTRACT = 'hotels_v2_h3_2a_partner_permissions_v1';
  const PARTNER_PROPERTY_PROPOSALS_ADMIN_CONTRACT = 'hotels_v2_seven_arches_property_proposals_admin_v1';
  const PARTNER_PROPERTY_PROPOSAL_REQUEST_CONTRACT = 'hotels_v2_seven_arches_property_proposal_review_request_v1';
  const PARTNER_PROPERTY_PROPOSAL_PREVIEW_CONTRACT = 'hotels_v2_seven_arches_property_proposal_admin_preview_v1';
  const PARTNER_PROPERTY_PROPOSAL_PLAN_CONTRACT = 'hotels_v2_seven_arches_property_proposal_admin_plan_v1';
  const PARTNER_PROPERTY_PROPOSAL_APPLY_CONTRACT = 'hotels_v2_seven_arches_property_proposal_admin_apply_v1';
  const SEVEN_ARCHES_PRICING_ACTIVATION_SNAPSHOT_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_snapshot_v1';
  const SEVEN_ARCHES_PRICING_ACTIVATION_DRAFT_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_draft_v1';
  const SEVEN_ARCHES_PRICING_ACTIVATION_PREVIEW_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_preview_v1';
  const SEVEN_ARCHES_PRICING_ACTIVATION_PLAN_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_plan_v1';
  const SEVEN_ARCHES_PRICING_ACTIVATION_APPLY_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_apply_result_v1';
  const SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_CONTROL_CONTRACT = 'hotels_v2_seven_arches_reviewed_pricing_admin_control_v1';
  const SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_REQUEST_CONTRACT = 'hotels_v2_seven_arches_reviewed_pricing_admin_request_v1';
  const SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_PREVIEW_CONTRACT = 'hotels_v2_seven_arches_reviewed_pricing_admin_preview_v1';
  const SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_PLAN_CONTRACT = 'hotels_v2_seven_arches_reviewed_pricing_admin_plan_v1';
  const SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_APPLY_CONTRACT = 'hotels_v2_seven_arches_reviewed_pricing_admin_apply_v1';
  const PRICING_CONTROL_READ_CONTRACT = 'hotels_v2_admin_c_pricing_control_v1';
  const PRICING_CONTROL_CONTRACT = 'hotels_v2_admin_c_pricing_plan_v1';
  const PRICING_PREVIEW_CONTRACT = 'hotels_v2_admin_c_pricing_preview_v1';
  const AVAILABILITY_CONTROL_READ_CONTRACT = 'hotels_v2_admin_d_availability_control_v1';
  const AVAILABILITY_CONTROL_DRAFT_CONTRACT = 'hotels_v2_admin_d_availability_draft_v1';
  const AVAILABILITY_CONTROL_PREVIEW_CONTRACT = 'hotels_v2_admin_d_availability_plan_preview_v1';
  const AVAILABILITY_CONTROL_PLAN_CONTRACT = 'hotels_v2_admin_d_availability_plan_v1';
  const AVAILABILITY_CONTROL_APPLY_CONTRACT = 'hotels_v2_admin_d_availability_apply_result_v1';
  const AVAILABILITY_STAY_REQUEST_CONTRACT = 'hotels_v2_admin_d_stay_preview_request_v1';
  const AVAILABILITY_STAY_PREVIEW_CONTRACT = 'hotels_v2_admin_d_available_stay_preview_v1';
  const EXTERNAL_CALENDAR_CONTROL_CONTRACT = 'hotels_v2_external_calendar_control_v1';
  const EXTERNAL_CALENDAR_DRAFT_CONTRACT = 'hotels_v2_external_calendar_draft_v1';
  const EXTERNAL_CALENDAR_PREVIEW_CONTRACT = 'hotels_v2_external_calendar_preview_v1';
  const EXTERNAL_CALENDAR_PLAN_CONTRACT = 'hotels_v2_external_calendar_plan_v1';
  const EXTERNAL_CALENDAR_APPLY_CONTRACT = 'hotels_v2_external_calendar_apply_result_v1';
  const AVAILABILITY_CONTROL_ENTITIES = Object.freeze([
    'daily_inventory',
    'unit_calendar_block',
    'operational_override',
    'rate_rule_operational_restriction',
    'booking_allocation',
    'hold',
  ]);
  const AVAILABILITY_CONTROL_DRAFT_ENTITIES = Object.freeze([
    ...AVAILABILITY_CONTROL_ENTITIES,
    'operational_override_range',
  ]);
  const AVAILABILITY_CONTROL_ACTIONS = Object.freeze([
    'upsert', 'delete', 'create', 'update', 'clear', 'disable', 'map', 'release',
  ]);
  const AVAILABILITY_CONTROL_READ_LIMITS = Object.freeze({
    room_types: 1000,
    room_rates: 5000,
    inventory_days: 62000,
    restriction_days: 310000,
    holds: 10000,
    recent_activity: 100,
    snapshot_bytes: 20 * 1024 * 1024,
  });
  const AVAILABILITY_BLOCKING_REASONS = Object.freeze([
    'operational_closed',
    'safety_closed',
    'inventory_exhausted',
    'room_rate_inactive',
    'insufficient_availability',
    'public_activation_off',
  ]);
  const AVAILABILITY_STAY_BLOCKING_REASONS = Object.freeze([
    ...AVAILABILITY_BLOCKING_REASONS,
    'unmapped_bookings_require_allocation',
    'product_restriction_blocked',
    'pricing_configuration_blocked',
  ]);
  const PRICING_CONTROL_ENTITIES = Object.freeze([
    'rate_plan',
    'room_rate',
    'pricing_schedule',
    'room_rate_tier_set',
    'rate_rule',
    'exact_date_price',
    'allocation_rule',
    'property_pricing_default',
  ]);
  const PRICING_CONTROL_ACTIONS = Object.freeze(['create', 'update', 'disable', 'clone']);
  const PRICING_LIFECYCLE_STATUSES = Object.freeze(['draft', 'inactive', 'active', 'disabled']);
  const PRICING_SCHEDULE_SHARING_MODES = Object.freeze(['shared', 'independent']);
  const PRICING_CONTROL_READ_LIMITS = Object.freeze({
    rate_plans: 200,
    room_types: 1000,
    room_rates: 5000,
    pricing_schedules: 1000,
    rate_rules: 10000,
    exact_date_prices: 50000,
    allocation_rules: 500,
    recent_activity: 100,
    schedule_tiers: 50000,
    independent_tiers: 50000,
    allocation_items: 10000,
    snapshot_bytes: 20 * 1024 * 1024,
  });
  const HOTEL_PARTNER_CAPABILITIES = Object.freeze([
    'edit_property_content',
    'edit_property_photos',
    'edit_room_content',
    'edit_room_photos',
    'create_rooms',
    'edit_room_structure',
    'manage_prices',
    'manage_availability',
    'process_bookings',
    'request_booking_changes',
    'view_payment_status',
    'initiate_stripe_onboarding',
  ]);
  const HOTEL_PARTNER_MUTATION_CAPABILITIES = Object.freeze(
    HOTEL_PARTNER_CAPABILITIES.filter((key) => key !== 'view_payment_status'),
  );
  const CHILD_AGE_MIN = 0;
  const CHILD_AGE_MAX = 17;
  const SEVEN_ARCHES_PROPERTY_ID = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  const SEVEN_ARCHES_CHECK_IN_FROM = '14:00';
  const SEVEN_ARCHES_CHECK_OUT_UNTIL = '11:00';
  const SEVEN_ARCHES_SHADOW_IDS = Object.freeze({
    upper_room_type: 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
    ground_room_type: '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
    rate_plan: '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
    upper_room_rate: '7e420964-9cbf-4f1b-abd3-09840af5240f',
    ground_room_rate: '3320590d-632d-423f-80d0-fd021cba7293',
    pricing_schedule: 'b0a3104f-7b31-5265-a59f-c2d166f11a23',
    property_party_preview: '443065c0-984a-5de3-a22a-d03042c41107',
  });
  const SEVEN_ARCHES_INDEPENDENT_PRICING_IDS = Object.freeze({
    upper_schedule: 'aec20731-7a56-35f0-334e-92b363351f02',
    ground_schedule: '9d109336-64f3-3c57-4684-968b59c94c3b',
  });
  const SEVEN_ARCHES_SOURCE_CONTRACT = 'seven_arches_two_apartments_v1';
  const SEVEN_KAMARES_PRICING_PROMOTION_CONTRACT = 'seven_kamares_legacy_to_h3_pricing_v1';
  const SEVEN_KAMARES_LEGACY_PRICING_FINGERPRINT = '7208ab4ecc0e47abd64d87ca1ac53a03';
  const SEVEN_ARCHES_ROOM_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: SEVEN_ARCHES_SHADOW_IDS.upper_room_type,
      source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: Object.freeze({
        pl: 'Apartament na piętrze',
        en: 'Upper Floor Apartment',
        he: 'דירה בקומה העליונה',
      }),
      description_i18n: Object.freeze({
        pl: 'Apartament na piętrze z tarasem i balkonem.',
        en: 'Upper-floor apartment with a terrace and balcony.',
        he: 'דירה בקומה העליונה עם טרסה ומרפסת.',
      }),
      amenities: Object.freeze(['air_conditioning', 'balcony', 'terrace']),
      sort_order: 100,
    }),
    Object.freeze({
      id: SEVEN_ARCHES_SHADOW_IDS.ground_room_type,
      source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: Object.freeze({
        pl: 'Apartament na parterze',
        en: 'Ground Floor Apartment',
        he: 'דירה בקומת הקרקע',
      }),
      description_i18n: Object.freeze({
        pl: 'Apartament na parterze z tarasem, bez balkonu.',
        en: 'Ground-floor apartment with a terrace and no balcony.',
        he: 'דירה בקומת הקרקע עם טרסה וללא מרפסת.',
      }),
      amenities: Object.freeze(['air_conditioning', 'terrace']),
      sort_order: 200,
    }),
  ]);
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

  function normalizePricingSourceUuid(source, value) {
    if (source === 'pricing_schedule_tier') {
      return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
        ? value
        : '';
    }
    return normalizeUuid(value);
  }

  function newUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    throw new Error('Secure UUID generation is unavailable in this browser.');
  }

  function exactUuidOrNew(value, label = 'Identifier') {
    if (value === undefined || value === null) return newUuid();
    const normalized = normalizeUuid(value);
    if (!normalized) throw new Error(`${label} must be an exact UUID; an invalid supplied ID is never replaced.`);
    return normalized;
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

  function assertI18nLength(value, maxLength, label, options = {}) {
    const normalized = normalizeI18n(value);
    if (options.requireEnglish === true && !normalized.en) {
      throw new Error(`${label} in English is required.`);
    }
    const tooLong = LANGUAGES.find((language) => (normalized[language] || '').length > maxLength);
    if (tooLong) throw new Error(`${label} (${tooLong.toUpperCase()}) must be ${maxLength} characters or fewer.`);
    return normalized;
  }

  function assertTextLength(value, maxLength, label) {
    const text = asNullableText(value);
    if (text && text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    return text;
  }

  function assertGalleryLimits(value, label) {
    const gallery = normalizeGallery(value);
    if (gallery.length > 50) throw new Error(`${label} may contain at most 50 photos.`);
    if (gallery.some((url) => url.length > 2048)) throw new Error(`${label} contains an image URL longer than 2048 characters.`);
    return gallery;
  }

  function assertAmenityLimits(value, label) {
    const amenities = normalizeAmenities(value);
    if (amenities.length > 200) throw new Error(`${label} may contain at most 200 amenities.`);
    if (amenities.some((code) => code.length > 160)) throw new Error(`${label} contains an amenity code longer than 160 characters.`);
    return amenities;
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

  function normalizeStringSet(value, allowed = null) {
    return asArray(value)
      .map((entry) => asText(entry).toLowerCase())
      .filter((entry) => entry && (!allowed || allowed.includes(entry)))
      .filter((entry, index, rows) => rows.indexOf(entry) === index)
      .sort((a, b) => a.localeCompare(b));
  }

  function normalizeHotelPartnerCapabilities(value) {
    const source = asObject(value);
    return Object.fromEntries(HOTEL_PARTNER_CAPABILITIES.map((key) => [key, source[key] === true]));
  }

  function hotelPartnerCapabilitiesHaveMutation(value) {
    const capabilities = normalizeHotelPartnerCapabilities(value);
    return HOTEL_PARTNER_MUTATION_CAPABILITIES.some((key) => capabilities[key] === true);
  }

  function normalizePartnerHotelPermission(value, hotelId = '') {
    const source = asObject(value);
    const permissionSource = asObject(source.permission);
    const exists = permissionSource.exists === true;
    const version = exists ? asInteger(permissionSource.version, 0) : 0;
    const capabilities = normalizeHotelPartnerCapabilities(permissionSource.capabilities);
    const capabilityKeys = Object.keys(asObject(permissionSource.capabilities)).sort();
    const expectedCapabilityKeys = [...HOTEL_PARTNER_CAPABILITIES].sort();
    return {
      ...clone(source),
      assignment_id: normalizeUuid(source.assignment_id || source.id),
      partner_id: normalizeUuid(source.partner_id || source.partner?.id),
      hotel_id: normalizeUuid(source.hotel_id) || normalizeUuid(hotelId),
      assignment_active: source.assignment_active === true,
      partner: {
        ...clone(asObject(source.partner)),
        id: normalizeUuid(source.partner?.id || source.partner_id),
        name: asText(source.partner?.name),
        status: asText(source.partner?.status) || 'unknown',
        can_manage_hotels: source.partner?.can_manage_hotels === true,
      },
      permission: {
        ...clone(permissionSource),
        exists,
        version,
        updated_at: asNullableText(permissionSource.updated_at),
        capability_contract_valid: JSON.stringify(capabilityKeys) === JSON.stringify(expectedCapabilityKeys)
          && HOTEL_PARTNER_CAPABILITIES.every((key) => typeof permissionSource.capabilities?.[key] === 'boolean'),
        has_mutation_summary_present: typeof permissionSource.has_mutation_capability === 'boolean',
        reported_has_mutation_capability: permissionSource.has_mutation_capability === true,
        has_mutation_capability: hotelPartnerCapabilitiesHaveMutation(capabilities),
        capabilities,
      },
    };
  }

  function normalizePartnerHotelPermissions(value) {
    const source = asObject(value);
    const property = asObject(source.property);
    const hotelId = normalizeUuid(property.id || source.hotel_id);
    const flags = clone(asObject(source.feature_flags || source.flags));
    return {
      contract_version: asText(source.contract_version),
      property: {
        ...clone(property),
        id: hotelId,
        updated_at: asNullableText(property.updated_at),
        architecture_version: asText(property.architecture_version) || 'legacy',
        is_published: property.is_published === true,
        status: asText(property.status) || 'unknown',
      },
      feature_flags: flags,
      capability_catalog: normalizeStringSet(source.capability_catalog),
      assignment_fingerprint: asText(source.assignment_fingerprint),
      permissions_fingerprint: asText(source.permissions_fingerprint),
      snapshot_token: asText(source.snapshot_token),
      assignments: asArray(source.assignments).map((entry) => normalizePartnerHotelPermission(entry, hotelId)),
    };
  }

  function validatePartnerHotelPermissions(value, expectedHotelId = '') {
    const normalized = normalizePartnerHotelPermissions(value);
    const expected = normalizeUuid(expectedHotelId);
    if (normalized.contract_version !== H3_2A_PARTNER_PERMISSIONS_CONTRACT) {
      throw new Error('The Partner & Access contract version is not supported.');
    }
    if (!normalized.property.id || (expected && normalized.property.id !== expected)) {
      throw new Error('Partner & Access returned a different exact property ID.');
    }
    if (!normalized.snapshot_token || !normalized.assignment_fingerprint || !normalized.permissions_fingerprint) {
      throw new Error('Partner & Access is missing its fresh optimistic snapshot.');
    }
    const catalog = normalizeStringSet(normalized.capability_catalog);
    if (JSON.stringify(catalog) !== JSON.stringify(normalizeStringSet(HOTEL_PARTNER_CAPABILITIES))) {
      throw new Error('Partner & Access returned an unexpected capability catalogue.');
    }
    const requiredOffFlags = [
      'hotel_rooms_v2_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ];
    if (typeof normalized.feature_flags.hotel_external_sync_enabled !== 'boolean'
        || requiredOffFlags.some((key) => normalized.feature_flags[key] !== false)) {
      throw new Error('Partner permissions require Rooms, Instant Booking and Stripe flags OFF plus an exact External Calendar boolean.');
    }
    const assignmentIds = new Set();
    const partnerIds = new Set();
    normalized.assignments.forEach((assignment) => {
      if (!assignment.assignment_id || !assignment.partner_id || assignment.hotel_id !== normalized.property.id) {
        throw new Error('Partner & Access contains an invalid exact assignment relationship.');
      }
      if (assignment.assignment_active !== true) {
        throw new Error('Partner & Access returned an assignment outside the active exact-assignment scope.');
      }
      if (assignmentIds.has(assignment.assignment_id) || partnerIds.has(assignment.partner_id)) {
        throw new Error('Partner & Access contains a duplicate exact assignment.');
      }
      assignmentIds.add(assignment.assignment_id);
      partnerIds.add(assignment.partner_id);
      if ((assignment.permission.exists && assignment.permission.version < 1)
          || (!assignment.permission.exists && assignment.permission.version !== 0)) {
        throw new Error('Partner & Access returned an invalid permission version.');
      }
      if (!assignment.permission.capability_contract_valid || !assignment.permission.has_mutation_summary_present) {
        throw new Error('Partner & Access returned an incomplete permission capability contract.');
      }
      if (assignment.permission.reported_has_mutation_capability !== assignment.permission.has_mutation_capability) {
        throw new Error('Partner & Access returned an inconsistent mutation-capability summary.');
      }
    });
    if (normalized.assignments.filter((assignment) => assignment.permission.has_mutation_capability).length > 1) {
      throw new Error('Only one exact Hotel assignment may hold mutation capabilities.');
    }
    return normalized;
  }

  function partnerHotelPermissionBusinessState(value) {
    const assignment = asObject(value);
    return {
      assignment_id: normalizeUuid(assignment.assignment_id),
      partner_id: normalizeUuid(assignment.partner_id),
      capabilities: normalizeHotelPartnerCapabilities(assignment.permission?.capabilities || assignment.capabilities),
    };
  }

  function reconcilePartnerHotelPermission(originalValue, currentValue, targetCapabilitiesValue) {
    const original = partnerHotelPermissionBusinessState(originalValue);
    const current = partnerHotelPermissionBusinessState(currentValue);
    const target = {
      assignment_id: original.assignment_id,
      partner_id: original.partner_id,
      capabilities: normalizeHotelPartnerCapabilities(targetCapabilitiesValue),
    };
    const identityChanged = current.assignment_id !== original.assignment_id
      || current.partner_id !== original.partner_id;
    const currentJson = JSON.stringify(current.capabilities);
    const originalJson = JSON.stringify(original.capabilities);
    const targetJson = JSON.stringify(target.capabilities);
    const conflicts = [];
    if (identityChanged) {
      conflicts.push({ field: 'exact assignment', original: clone(original), current: clone(current), target: clone(target) });
    } else if (currentJson !== originalJson && currentJson !== targetJson) {
      conflicts.push({
        field: 'capabilities',
        original: clone(original.capabilities),
        current: clone(current.capabilities),
        target: clone(target.capabilities),
      });
    }
    return { safe: conflicts.length === 0, conflicts, target };
  }

  function buildPartnerHotelPermissionsPlan(snapshotValue, assignmentIdValue, targetCapabilitiesValue, options = {}) {
    const snapshot = validatePartnerHotelPermissions(snapshotValue, options.hotelId);
    const assignmentId = normalizeUuid(assignmentIdValue);
    const assignment = snapshot.assignments.find((entry) => entry.assignment_id === assignmentId);
    if (!assignment) throw new Error('The reviewed exact Hotel assignment is missing from the fresh snapshot.');
    const capabilities = normalizeHotelPartnerCapabilities(targetCapabilitiesValue);
    if (HOTEL_PARTNER_CAPABILITIES.some((key) => capabilities[key] === true)
        && (assignment.partner.can_manage_hotels !== true
          || asText(assignment.partner.status).toLowerCase() !== 'active')) {
      throw new Error('Capabilities cannot be granted to an inactive, suspended, or non-managing Hotel partner. Existing access must be disabled.');
    }
    if (hotelPartnerCapabilitiesHaveMutation(capabilities)) {
      const conflicting = snapshot.assignments.find((entry) => (
        entry.assignment_id !== assignmentId && entry.permission.has_mutation_capability
      ));
      if (conflicting) {
        throw new Error('Another exact Hotel assignment already holds mutation capabilities. Disable it in a separate reviewed save first.');
      }
    }
    return {
      contract_version: H3_2A_PARTNER_PERMISSIONS_CONTRACT,
      decision: 'apply_partner_hotel_permissions',
      hotel_id: snapshot.property.id,
      assignment_id: assignment.assignment_id,
      partner_id: assignment.partner_id,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      snapshot_token: snapshot.snapshot_token,
      expected_assignment_fingerprint: snapshot.assignment_fingerprint,
      expected_permission_version: assignment.permission.version,
      capabilities,
    };
  }

  function normalizeH31AllocationItem(value) {
    const source = asObject(value);
    return {
      ...clone(source),
      id: normalizeUuid(source.id) || null,
      room_type_id: normalizeUuid(source.room_type_id),
      units_required: asInteger(source.units_required ?? source.quantity, 1),
      allocated_guest_count: source.allocated_guest_count == null
        ? null
        : asInteger(source.allocated_guest_count, 1),
      pricing_guest_count: source.pricing_guest_count == null
        ? null
        : asInteger(source.pricing_guest_count, 1),
      sort_order: asInteger(source.sort_order, 1000),
    };
  }

  function normalizeH31AllocationRule(value) {
    const source = asObject(value);
    const mode = asText(source.allocation_mode || source.mode);
    return {
      ...clone(source),
      id: normalizeUuid(source.id) || null,
      hotel_id: normalizeUuid(source.hotel_id) || null,
      code: asText(source.code) || 'guest-allocation',
      min_guest_count: asInteger(source.min_guest_count ?? source.min_guests ?? source.guest_count_min, 1),
      max_guest_count: asInteger(source.max_guest_count ?? source.max_guests ?? source.guest_count_max, 1),
      allocation_mode: ROOM_ALLOCATION_MODES.includes(mode) ? mode : 'customer_choice',
      is_active: source.is_active === true,
      review_status: asText(source.review_status) || 'requires_review',
      sort_order: asInteger(source.sort_order, 1000),
      version: Math.max(1, asInteger(source.version, 1)),
      updated_at: source.updated_at || null,
      items_fingerprint: asText(source.items_fingerprint) || null,
      items: asArray(source.items).map(normalizeH31AllocationItem)
        .filter((item) => item.room_type_id)
        .sort((a, b) => a.sort_order - b.sort_order || a.room_type_id.localeCompare(b.room_type_id)),
    };
  }

  function normalizeH31PaymentTerm(value) {
    const source = asObject(value);
    const dueEvent = asText(source.due_event);
    const amountMode = asText(source.amount_mode);
    const recipient = asText(source.recipient);
    return {
      ...clone(source),
      id: normalizeUuid(source.id) || null,
      due_event: HOTEL_PAYMENT_DUE_EVENTS.includes(dueEvent) ? dueEvent : 'after_partner_acceptance',
      amount_mode: HOTEL_PAYMENT_AMOUNT_MODES.includes(amountMode) ? amountMode : 'percent_total',
      amount_value: amountMode === 'remaining_balance' ? null : asNumber(source.amount_value, null),
      recipient: HOTEL_PAYMENT_RECIPIENTS.includes(recipient) ? recipient : 'partner',
      payment_methods: normalizeStringSet(source.payment_methods, HOTEL_PAYMENT_METHODS),
      instructions_i18n: normalizeI18n(source.instructions_i18n),
      sequence: asInteger(source.sequence ?? source.sort_order, 1),
    };
  }

  function normalizeH31PaymentPolicy(value) {
    const source = asObject(value);
    return {
      ...clone(source),
      id: normalizeUuid(source.id) || null,
      hotel_id: normalizeUuid(source.hotel_id) || null,
      code: asText(source.code) || 'standard',
      name_i18n: normalizeI18n(source.name_i18n || source.name, { fallback: 'Reviewed payment terms' }),
      currency: (asText(source.currency) || 'EUR').toUpperCase(),
      is_active: source.is_active === true,
      review_status: asText(source.review_status) || 'requires_review',
      version: Math.max(1, asInteger(source.version, 1)),
      updated_at: source.updated_at || null,
      terms_fingerprint: asText(source.terms_fingerprint) || null,
      terms: asArray(source.terms).map(normalizeH31PaymentTerm)
        .sort((a, b) => a.sequence - b.sequence || String(a.id || '').localeCompare(String(b.id || ''))),
    };
  }

  function normalizeH31CommissionPolicy(value) {
    const source = asObject(value);
    const mode = asText(source.commission_mode || source.mode);
    return {
      ...clone(source),
      id: normalizeUuid(source.id) || null,
      hotel_id: normalizeUuid(source.hotel_id) || null,
      code: asText(source.code) || 'platform-commission',
      commission_mode: HOTEL_COMMISSION_MODES.includes(mode) ? mode : 'per_allocated_room_per_night',
      amount: asNumber(source.amount, null),
      currency: (asText(source.currency) || 'EUR').toUpperCase(),
      is_active: source.is_active === true,
      review_status: asText(source.review_status) || 'requires_review',
      version: Math.max(1, asInteger(source.version, 1)),
      updated_at: source.updated_at || null,
    };
  }

  function normalizeH31CalendarSource(value) {
    const source = asObject(value);
    const sourceType = asText(source.source_type || source.source || source.provider);
    return {
      ...clone(source),
      id: normalizeUuid(source.id) || null,
      hotel_id: normalizeUuid(source.hotel_id) || null,
      code: asText(source.code) || `${sourceType || 'manual'}-calendar`,
      source_type: HOTEL_CALENDAR_SOURCES.includes(sourceType) ? sourceType : 'manual',
      room_type_id: normalizeUuid(source.room_type_id) || null,
      external_reference: asNullableText(source.external_reference),
      is_enabled: source.is_enabled === true || source.enabled === true,
      review_status: asText(source.review_status) || 'requires_review',
      priority: asInteger(source.priority, 100),
      configuration: clone(asObject(source.configuration || source.config)),
      version: Math.max(1, asInteger(source.version, 1)),
      updated_at: source.updated_at || null,
    };
  }

  function normalizeH31Configuration(value) {
    const outer = asObject(value);
    const source = asObject(outer.h3_1_configuration || outer.configuration || outer);
    const property = asObject(source.property);
    const flags = asObject(source.flags || source.feature_flags);
    return {
      hotel_id: normalizeUuid(source.hotel_id || property.id),
      property: {
        ...clone(property),
        id: normalizeUuid(property.id || source.hotel_id),
        minimum_stay_nights: property.minimum_stay_nights == null
          ? null
          : asInteger(property.minimum_stay_nights, 0),
        updated_at: property.updated_at || source.expected_property_updated_at || null,
      },
      pricing_schedules: asArray(source.pricing_schedules || source.schedules).map((entry) => {
        const schedule = asObject(entry);
        return {
          ...clone(schedule),
          id: normalizeUuid(schedule.id),
          hotel_id: normalizeUuid(schedule.hotel_id || source.hotel_id) || null,
          minimum_billable_occupancy: schedule.minimum_billable_occupancy == null
            ? null
            : asInteger(schedule.minimum_billable_occupancy, 0),
          version: Math.max(1, asInteger(schedule.version, 1)),
        };
      }).filter((entry) => entry.id),
      rate_plans: asArray(source.rate_plans).map((entry) => {
        const plan = asObject(entry);
        return {
          ...clone(plan),
          id: normalizeUuid(plan.id),
          hotel_id: normalizeUuid(plan.hotel_id || source.hotel_id) || null,
          price_inclusions: normalizeStringSet(plan.price_inclusions),
          version: Math.max(1, asInteger(plan.version, 1)),
        };
      }).filter((entry) => entry.id),
      allocation_rules: asArray(source.allocation_rules).map(normalizeH31AllocationRule),
      payment_policies: asArray(source.payment_policies).map(normalizeH31PaymentPolicy),
      commission_policies: asArray(source.commission_policies || source.commissions).map(normalizeH31CommissionPolicy),
      calendar_sources: asArray(source.calendar_sources || source.calendar_source_configs).map(normalizeH31CalendarSource),
      flags: clone(flags),
      snapshot_token: asText(source.snapshot_token) || null,
    };
  }

  function normalizePricingPromotionTier(value) {
    const source = asObject(value);
    const guestCount = asInteger(source.guest_count ?? source.persons ?? source.occupancy, 0);
    const thresholdNights = asInteger(source.threshold_nights ?? source.min_nights ?? source.nights, 0);
    const nightlyRate = asNumber(source.nightly_rate ?? source.price_per_night ?? source.rate, null);
    return {
      ...clone(source),
      id: normalizeUuid(source.id) || null,
      schedule_id: normalizeUuid(source.schedule_id || source.pricing_schedule_id) || null,
      guest_count: guestCount,
      threshold_nights: thresholdNights,
      nightly_rate: nightlyRate,
      is_active: source.is_active !== false,
      version: source.version == null ? null : Math.max(1, asInteger(source.version, 1)),
    };
  }

  function normalizePricingPromotionSchedule(value, fallbackTiers = []) {
    const source = asObject(value);
    const tiers = asArray(source.tiers || source.occupancy_tiers || fallbackTiers)
      .map(normalizePricingPromotionTier)
      .filter((tier) => tier.guest_count > 0 && tier.threshold_nights > 0 && tier.nightly_rate != null);
    return {
      ...clone(source),
      id: normalizeUuid(source.id || source.schedule_id) || null,
      code: asText(source.code),
      name_i18n: normalizeI18n(source.name_i18n || source.name),
      application_scope: asText(source.application_scope || source.scope),
      currency: (asText(source.currency) || 'EUR').toUpperCase(),
      maximum_party_size: asInteger(source.maximum_party_size, 0),
      minimum_billable_occupancy: source.minimum_billable_occupancy == null
        ? null
        : asInteger(source.minimum_billable_occupancy, 0),
      is_active: source.is_active === true,
      review_status: asText(source.review_status) || 'requires_review',
      version: source.version == null ? null : Math.max(1, asInteger(source.version, 1)),
      tier_count: asInteger(source.tier_count, tiers.length),
      tier_fingerprint: asText(source.tier_fingerprint || source.tiers_fingerprint || source.fingerprint) || null,
      tiers,
    };
  }

  function normalizePricingPromotionAllocationItem(value) {
    const source = asObject(value);
    return {
      room_type_id: normalizeUuid(source.room_type_id || source.id) || null,
      room_rate_id: normalizeUuid(source.room_rate_id) || null,
      room_name: asText(source.room_name || source.name || source.code),
      allocated_guest_count: source.allocated_guest_count == null
        ? null
        : asInteger(source.allocated_guest_count, 0),
      pricing_guest_count: source.pricing_guest_count == null
        ? null
        : asInteger(source.pricing_guest_count, 0),
      units_required: Math.max(1, asInteger(source.units_required, 1)),
    };
  }

  function normalizePricingPromotionNightlyRate(value) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return asNumber(value, null);
    const source = asObject(value);
    return {
      ...clone(source),
      room_type_id: normalizeUuid(source.room_type_id) || null,
      room_rate_id: normalizeUuid(source.room_rate_id) || null,
      pricing_guest_count: asInteger(source.pricing_guest_count ?? source.priced_occupancy, 0),
      nightly_rate: asNumber(source.nightly_rate ?? source.rate, null),
    };
  }

  function normalizePricingPromotionComparison(value, currency = 'EUR') {
    const source = asObject(value);
    const legacyNightly = asNumber(source.legacy_nightly_rate, null);
    const targetNightly = asNumber(source.room_rate_sum, null);
    return {
      ...clone(source),
      nights: asInteger(source.nights ?? source.threshold_nights, 0),
      threshold_nights: asInteger(source.threshold_nights ?? source.nights, 0),
      requested_guest_count: asInteger(source.requested_guest_count ?? source.guest_count, 0),
      priced_occupancy: source.priced_occupancy == null && source.pricing_guest_count == null
        ? null
        : asInteger(source.priced_occupancy ?? source.pricing_guest_count, 0),
      room_nightly_rates: asArray(source.room_nightly_rates).map(normalizePricingPromotionNightlyRate),
      legacy_nightly_rate: legacyNightly,
      room_rate_sum: targetNightly,
      stay_total: asNumber(source.stay_total, null),
      currency: (asText(source.currency || currency) || 'EUR').toUpperCase(),
    };
  }

  function normalizePricingPromotionOption(value, currency = 'EUR') {
    const source = asObject(value);
    return {
      ...clone(source),
      allocation: asArray(source.allocation || source.rooms || source.items)
        .map(normalizePricingPromotionAllocationItem)
        .filter((item) => item.room_type_id),
      nightly_comparisons: asArray(source.nightly_comparisons || source.comparisons || source.stays)
        .map((entry) => normalizePricingPromotionComparison(entry, currency))
        .filter((comparison) => comparison.nights > 0),
    };
  }

  function normalizePricingPromotionAllocation(value, currency = 'EUR') {
    const source = asObject(value);
    return {
      ...clone(source),
      guest_count: asInteger(source.guest_count ?? source.guests, 0),
      allocation_mode: asText(source.allocation_mode || source.mode),
      options: asArray(source.options).map((entry) => normalizePricingPromotionOption(entry, currency)),
    };
  }

  function normalizeLegacyPricingPromotionPreview(value) {
    const outer = asObject(value);
    const source = asObject(outer.preview || outer.pricing_promotion || outer);
    const property = asObject(source.property);
    const legacy = asObject(source.source || source.legacy_source || source.legacy);
    const target = asObject(source.target || source.v2_target || source.prepared_target);
    const roomSchedule = normalizePricingPromotionSchedule(
      target.room_schedule || target.pricing_schedule || source.room_schedule,
      target.tiers || source.target_tiers,
    );
    const partySchedule = normalizePricingPromotionSchedule(
      legacy.property_party_preview || source.property_party_preview,
      legacy.tiers,
    );
    const legacyRules = asArray(legacy.tiers || legacy.rules || legacy.pricing_rules)
      .map(normalizePricingPromotionTier)
      .filter((tier) => tier.guest_count > 0 && tier.threshold_nights > 0 && tier.nightly_rate != null);
    const flags = clone(asObject(source.flags || source.feature_flags));
    const currency = (asText(legacy.currency || source.currency) || 'EUR').toUpperCase();
    const paritySource = asObject(source.parity);
    const parity = {
      threshold_case_count: asInteger(paritySource.threshold_case_count, 0),
      threshold_mismatch_count: asInteger(paritySource.threshold_mismatch_count, -1),
      long_stay_case_count: asInteger(paritySource.long_stay_case_count, 0),
      long_stay_mismatch_count: asInteger(paritySource.long_stay_mismatch_count, -1),
      total_case_count: asInteger(paritySource.total_case_count, 0),
      total_mismatch_count: asInteger(paritySource.total_mismatch_count, -1),
      fingerprint: asText(paritySource.fingerprint) || null,
    };
    return {
      hotel_id: normalizeUuid(source.hotel_id || property.id),
      contract_version: asText(source.contract_version || source.source_contract)
        || SEVEN_KAMARES_PRICING_PROMOTION_CONTRACT,
      supported: source.supported === true,
      public_change: source.public_change === true,
      property: {
        ...clone(property),
        id: normalizeUuid(property.id || source.hotel_id),
        architecture_version: asText(property.architecture_version) || 'legacy',
        updated_at: property.updated_at || source.expected_property_updated_at || null,
      },
      flags,
      source: {
        ...clone(legacy),
        pricing_model: asText(legacy.pricing_model || source.pricing_model),
        currency,
        rule_count: asInteger(legacy.rule_count || source.legacy_rule_count, legacyRules.length),
        pricing_fingerprint: asText(
          legacy.pricing_fingerprint || legacy.fingerprint || source.legacy_pricing_fingerprint,
        ) || null,
        tier_fingerprint: asText(legacy.tier_fingerprint) || null,
        tiers: legacyRules,
        property_party_preview: partySchedule,
      },
      target: {
        ...clone(target),
        rate_plan: clone(asObject(target.rate_plan || source.rate_plan)),
        rooms: asArray(target.rooms).map((entry) => clone(asObject(entry))),
        room_rates: asArray(target.room_rates || source.room_rates).map((entry) => clone(asObject(entry))),
        room_schedule: roomSchedule,
        allocation_fingerprint: asText(target.allocation_fingerprint) || null,
        target_fingerprint: asText(target.target_fingerprint || target.fingerprint) || null,
      },
      allocation_previews: asArray(
        source.allocation_previews || source.allocation_preview || source.bundle_previews,
      ).map((entry) => normalizePricingPromotionAllocation(entry, currency)).filter((entry) => entry.guest_count > 0),
      pricing_occupancy_mapping_fingerprint: asText(source.pricing_occupancy_mapping_fingerprint) || null,
      parity,
      parity_mismatch_count: parity.total_mismatch_count,
      expected: clone(asObject(source.expected)),
      snapshot_token: asText(source.snapshot_token) || null,
      promotion: clone(asObject(source.promotion)),
      safety: clone(asObject(source.safety)),
      blockers: asArray(source.blockers).map(asText).filter(Boolean),
    };
  }

  function validateLegacyPricingPromotionPreview(value) {
    const preview = normalizeLegacyPricingPromotionPreview(value);
    if (preview.hotel_id !== SEVEN_ARCHES_PROPERTY_ID || preview.property.id !== SEVEN_ARCHES_PROPERTY_ID) {
      throw new Error('Legacy pricing promotion is restricted to the exact 7 Kamares property.');
    }
    if (preview.contract_version !== SEVEN_KAMARES_PRICING_PROMOTION_CONTRACT || !preview.supported) {
      throw new Error('The server did not return the supported 7 Kamares pricing-promotion contract.');
    }
    if (preview.property.architecture_version !== 'legacy' || preview.public_change !== false) {
      throw new Error('Pricing promotion must remain shadow-only on the legacy architecture.');
    }
    const requiredOffFlags = [
      'hotel_rooms_v2_enabled',
      'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ];
    const unsafeFlags = requiredOffFlags.filter((flag) => preview.flags[flag] !== false);
    if (unsafeFlags.length) {
      throw new Error(`Pricing promotion requires every Hotels V2 flag OFF: ${unsafeFlags.join(', ')}.`);
    }
    if (preview.blockers.length) throw new Error(`Pricing promotion is blocked: ${preview.blockers.join(' ')}`);
    if (preview.source.rule_count !== 63 || preview.source.tiers.length !== 63
        || !preview.source.pricing_fingerprint || !preview.source.tier_fingerprint) {
      throw new Error('The exact 63-rule legacy pricing source or its fingerprint is missing.');
    }
    if (preview.source.pricing_fingerprint !== SEVEN_KAMARES_LEGACY_PRICING_FINGERPRINT) {
      throw new Error('The legacy pricing source no longer matches the accepted 7 Kamares fingerprint.');
    }
    if (preview.target.room_schedule.tier_count !== 27
        || preview.target.room_schedule.tiers.length !== 27
        || !preview.target.room_schedule.tier_fingerprint) {
      throw new Error('The reviewed Room pricing target must contain exactly 27 fingerprinted tiers.');
    }
    if (preview.source.property_party_preview.tier_count !== 63
        || preview.source.property_party_preview.tiers.length !== 63
        || !preview.source.property_party_preview.tier_fingerprint) {
      throw new Error('The property-party legacy preview must preserve exactly 63 fingerprinted tiers.');
    }
    const planId = normalizeUuid(preview.target.rate_plan.id);
    const rateIds = preview.target.room_rates.map((rate) => normalizeUuid(rate.id)).filter(Boolean);
    if (planId !== SEVEN_ARCHES_SHADOW_IDS.rate_plan
        || asText(preview.target.rate_plan.code).toLowerCase() !== 'standard'
        || rateIds.length !== 2
        || rateIds[0] !== SEVEN_ARCHES_SHADOW_IDS.upper_room_rate
        || rateIds[1] !== SEVEN_ARCHES_SHADOW_IDS.ground_room_rate) {
      throw new Error('The target must preserve the exact Standard Rate Plan and two Room Rate identities.');
    }
    if (preview.target.rate_plan.is_active === true
        || preview.target.room_rates.some((rate) => rate.is_active === true)
        || preview.target.room_schedule.is_active === true) {
      throw new Error('The reviewed Rate Plan, Room Rates and shared Room schedule must remain inactive.');
    }
    if (!['requires_review', 'reviewed'].includes(preview.target.room_schedule.review_status)) {
      throw new Error('The shared Room schedule is not eligible for this reviewed pricing preparation.');
    }
    if (preview.target.room_schedule.id !== SEVEN_ARCHES_SHADOW_IDS.pricing_schedule
        || preview.source.property_party_preview.id !== SEVEN_ARCHES_SHADOW_IDS.property_party_preview) {
      throw new Error('The preview returned an unexpected pricing schedule identity.');
    }
    const thresholds = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const replayDurations = [...thresholds, 14];
    const exactTierKeys = (tiers) => tiers.map((tier) => `${tier.guest_count}:${tier.threshold_nights}`).sort();
    const expectedTierKeys = (guests) => guests.flatMap((guest) => thresholds.map((nights) => `${guest}:${nights}`)).sort();
    if (JSON.stringify(exactTierKeys(preview.source.tiers)) !== JSON.stringify(expectedTierKeys([2, 3, 4, 5, 6, 7, 8]))) {
      throw new Error('The legacy source must contain every exact 2–8 guest × 2–10 night threshold once.');
    }
    if (JSON.stringify(exactTierKeys(preview.source.property_party_preview.tiers))
        !== JSON.stringify(expectedTierKeys([2, 3, 4, 5, 6, 7, 8]))) {
      throw new Error('The property-party preview must contain every exact 2–8 guest × 2–10 night threshold once.');
    }
    if (JSON.stringify(exactTierKeys(preview.target.room_schedule.tiers))
        !== JSON.stringify(expectedTierKeys([2, 3, 4]))) {
      throw new Error('The shared Room schedule must contain every exact 2–4 pricing occupancy × 2–10 night threshold once.');
    }
    const tierRateMap = (tiers) => new Map(tiers.map((tier) => (
      [`${tier.guest_count}:${tier.threshold_nights}`, tier.nightly_rate]
    )));
    const sourceRates = tierRateMap(preview.source.tiers);
    const partyRates = tierRateMap(preview.source.property_party_preview.tiers);
    const roomRatesByTier = tierRateMap(preview.target.room_schedule.tiers);
    if (Array.from(sourceRates.entries()).some(([key, rate]) => {
      const matched = partyRates.get(key);
      return !Number.isFinite(rate) || !Number.isFinite(matched) || Math.abs(rate - matched) > 0.000001;
    })) {
      throw new Error('The 63-tier property-party preview no longer reproduces the exact legacy source rates.');
    }
    if (Array.from(roomRatesByTier.entries()).some(([key, rate]) => {
      const matched = sourceRates.get(key);
      return !Number.isFinite(rate) || !Number.isFinite(matched) || Math.abs(rate - matched) > 0.000001;
    })) {
      throw new Error('The 27 shared Room tiers no longer reproduce the exact legacy 2–4 guest rates.');
    }
    const targetRoomIds = preview.target.rooms.map((room) => normalizeUuid(room.id || room.room_type_id));
    if (targetRoomIds.length !== 2
        || targetRoomIds[0] !== SEVEN_ARCHES_SHADOW_IDS.upper_room_type
        || targetRoomIds[1] !== SEVEN_ARCHES_SHADOW_IDS.ground_room_type) {
      throw new Error('The target Room Types must be the exact ordered Upper and Ground apartments.');
    }
    const expectedRoomRateIds = new Map([
      [SEVEN_ARCHES_SHADOW_IDS.upper_room_type, SEVEN_ARCHES_SHADOW_IDS.upper_room_rate],
      [SEVEN_ARCHES_SHADOW_IDS.ground_room_type, SEVEN_ARCHES_SHADOW_IDS.ground_room_rate],
    ]);
    preview.target.room_rates.forEach((rate) => {
      if (expectedRoomRateIds.get(normalizeUuid(rate.room_type_id)) !== normalizeUuid(rate.id)
          || normalizeUuid(rate.rate_plan_id) !== SEVEN_ARCHES_SHADOW_IDS.rate_plan
          || normalizeUuid(rate.pricing_schedule_id) !== SEVEN_ARCHES_SHADOW_IDS.pricing_schedule) {
        throw new Error('A target Room Rate does not preserve its exact Room, Rate Plan and schedule relationship.');
      }
    });
    const previewGuestCounts = preview.allocation_previews.map((entry) => entry.guest_count);
    if (previewGuestCounts.join(',') !== '1,2,3,4,5,6,7,8') {
      throw new Error('The allocation replay must contain each exact requested party size from 1 through 8 in order.');
    }
    const validateComparisonCoverage = (row, option) => {
      const durations = option.nightly_comparisons.map((comparison) => comparison.nights);
      if (durations.join(',') !== replayDurations.join(',')) {
        throw new Error(`The ${row.guest_count}-guest allocation option must replay exact stays 2–10 nights and 14 nights.`);
      }
      option.nightly_comparisons.forEach((comparison) => {
        if (comparison.requested_guest_count !== row.guest_count) {
          throw new Error(`The ${row.guest_count}-guest pricing replay returned a different requested guest count.`);
        }
        const expectedThreshold = comparison.nights >= 10 ? 10 : comparison.nights;
        const roomRates = comparison.room_nightly_rates.map((rate) => (
          rate && typeof rate === 'object' ? rate.nightly_rate : rate
        ));
        if (comparison.threshold_nights !== expectedThreshold
            || roomRates.length !== option.allocation.length
            || roomRates.some((rate) => !Number.isFinite(rate))
            || !Number.isFinite(comparison.room_rate_sum)
            || !Number.isFinite(comparison.legacy_nightly_rate)
            || Math.abs(roomRates.reduce((sum, rate) => sum + rate, 0) - comparison.room_rate_sum) > 0.000001
            || Math.abs(comparison.room_rate_sum - comparison.legacy_nightly_rate) > 0.000001
            || !Number.isFinite(comparison.stay_total)
            || Math.abs(comparison.stay_total - comparison.room_rate_sum * comparison.nights) > 0.000001) {
          throw new Error('The pricing occupancy mapping does not reproduce the legacy 70-case totals exactly.');
        }
      });
    };
    [1, 2, 3, 4].forEach((guests) => {
      const row = preview.allocation_previews[guests - 1];
      const expectedPricing = Math.max(2, guests);
      if (row.allocation_mode !== 'customer_choice' || row.options.length !== 2) {
        throw new Error(`The ${guests}-guest allocation preview must offer the exact two-apartment customer choice.`);
      }
      row.options.forEach((option, index) => {
        const item = option.allocation[0];
        const expectedRoomId = index === 0
          ? SEVEN_ARCHES_SHADOW_IDS.upper_room_type
          : SEVEN_ARCHES_SHADOW_IDS.ground_room_type;
        const expectedRateId = index === 0
          ? SEVEN_ARCHES_SHADOW_IDS.upper_room_rate
          : SEVEN_ARCHES_SHADOW_IDS.ground_room_rate;
        if (option.allocation.length !== 1 || item.room_type_id !== expectedRoomId
            || item.room_rate_id !== expectedRateId || item.allocated_guest_count != null
            || item.pricing_guest_count != null) {
          throw new Error(`The ${guests}-guest customer-choice option does not preserve its exact Room Rate and pricing occupancy.`);
        }
        option.nightly_comparisons.forEach((comparison) => {
          if (comparison.priced_occupancy !== expectedPricing) {
            throw new Error(`The ${guests}-guest customer-choice replay returned a different pricing occupancy.`);
          }
        });
        validateComparisonCoverage(row, option);
      });
    });
    const requiredBundles = new Map([
      [5, { physical: [3, 2], pricing: [2, 2] }],
      [6, { physical: [3, 3], pricing: [3, 3] }],
      [7, { physical: [4, 3], pricing: [4, 4] }],
      [8, { physical: [4, 4], pricing: [4, 4] }],
    ]);
    requiredBundles.forEach((counts, guests) => {
      const row = preview.allocation_previews.find((entry) => entry.guest_count === guests);
      const option = row?.options[0];
      const physical = option?.allocation.map((item) => item.allocated_guest_count);
      const pricing = option?.allocation.map((item) => item.pricing_guest_count);
      if (!row || row.allocation_mode !== 'required_bundle'
          || row.options.length !== 1 || option.allocation.length !== 2
          || option.allocation[0].room_type_id !== SEVEN_ARCHES_SHADOW_IDS.upper_room_type
          || option.allocation[0].room_rate_id !== SEVEN_ARCHES_SHADOW_IDS.upper_room_rate
          || option.allocation[1].room_type_id !== SEVEN_ARCHES_SHADOW_IDS.ground_room_type
          || option.allocation[1].room_rate_id !== SEVEN_ARCHES_SHADOW_IDS.ground_room_rate
          || physical?.join(',') !== counts.physical.join(',')
          || pricing?.join(',') !== counts.pricing.join(',')) {
        throw new Error(`The ${guests}-guest allocation preview does not match the reviewed two-apartment bundle.`);
      }
      validateComparisonCoverage(row, option);
    });
    if (preview.parity.threshold_case_count !== 63 || preview.parity.threshold_mismatch_count !== 0
        || preview.parity.long_stay_case_count !== 7 || preview.parity.long_stay_mismatch_count !== 0
        || preview.parity.total_case_count !== 70 || preview.parity.total_mismatch_count !== 0
        || !preview.parity.fingerprint || !preview.pricing_occupancy_mapping_fingerprint) {
      throw new Error('The server must prove zero mismatch across all 63 thresholds and seven 14-night continuation cases.');
    }
    if (!preview.snapshot_token || !Object.keys(preview.expected).length
        || !preview.target.target_fingerprint) {
      throw new Error('The exact optimistic pricing fingerprints are incomplete.');
    }
    return preview;
  }

  function legacyPricingPromotionSnapshot(value) {
    const preview = normalizeLegacyPricingPromotionPreview(value);
    return {
      source_pricing_fingerprint: preview.source.pricing_fingerprint,
      room_schedule_tier_fingerprint: preview.target.room_schedule.tier_fingerprint,
      property_party_tier_fingerprint: preview.source.property_party_preview.tier_fingerprint,
      target_fingerprint: preview.target.target_fingerprint,
      allocation_fingerprint: preview.target.allocation_fingerprint,
      pricing_occupancy_mapping_fingerprint: preview.pricing_occupancy_mapping_fingerprint,
      parity_fingerprint: preview.parity.fingerprint,
      allocation_preview: preview.allocation_previews.map((entry) => ({
        guest_count: entry.guest_count,
        allocation_mode: entry.allocation_mode,
        options: entry.options.map((option) => ({
          allocation: option.allocation.map((item) => ({
            room_type_id: item.room_type_id,
            room_rate_id: item.room_rate_id,
            allocated_guest_count: item.allocated_guest_count,
            pricing_guest_count: item.pricing_guest_count,
          })),
          nightly_comparisons: option.nightly_comparisons.map((comparison) => ({
            nights: comparison.nights,
            requested_guest_count: comparison.requested_guest_count,
            priced_occupancy: comparison.priced_occupancy,
            legacy_nightly_rate: comparison.legacy_nightly_rate,
            room_rate_sum: comparison.room_rate_sum,
          })),
        })),
      })),
    };
  }

  function reconcileLegacyPricingPromotion(originalValue, currentValue) {
    const original = legacyPricingPromotionSnapshot(originalValue);
    const current = legacyPricingPromotionSnapshot(currentValue);
    const conflicts = Object.keys(original).filter((field) => JSON.stringify(original[field]) !== JSON.stringify(current[field]));
    return { safe: conflicts.length === 0, conflicts, current: normalizeLegacyPricingPromotionPreview(currentValue) };
  }

  function buildLegacyPricingPromotionPlan(value, acknowledgePricingOccupancyMapping) {
    const preview = validateLegacyPricingPromotionPreview(value);
    if (acknowledgePricingOccupancyMapping !== true) {
      throw new Error('Explicitly acknowledge the reviewed physical-allocation and pricing-occupancy mapping.');
    }
    return {
      hotel_id: preview.hotel_id,
      reviewed_at: new Date().toISOString(),
      snapshot_token: preview.snapshot_token,
      expected: clone(preview.expected),
      decision: 'promote_room_schedule_to_reviewed',
      acknowledge_pricing_occupancy_mapping: true,
    };
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
    const type = ['flexible', 'custom', 'non_refundable', 'requires_review'].includes(asText(source.type))
      ? asText(source.type)
      : 'flexible';
    if (type === 'non_refundable') return { type: 'non_refundable' };
    if (type === 'flexible') return { type: 'flexible' };
    if (type === 'requires_review') {
      const summary = normalizeI18n(source.summary_i18n);
      return {
        type: 'requires_review',
        reason: asText(source.reason),
        ...(Object.keys(summary).length ? { summary_i18n: summary } : {}),
      };
    }

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

  function normalizeChildrenPolicy(policy, minimumAge, options = {}) {
    const allowInherit = options.allowInherit === true;
    const normalizedPolicy = asText(policy).toLowerCase();
    if (allowInherit && !normalizedPolicy) {
      if (minimumAge != null && minimumAge !== '') {
        throw new Error('A child age cannot be stored while the Room Type uses the property policy.');
      }
      return { policy: null, minimum_age: null };
    }
    if (!CHILDREN_POLICIES.includes(normalizedPolicy)) {
      throw new Error('Choose a valid children policy.');
    }
    if (normalizedPolicy !== 'minimum_age') {
      if (minimumAge != null && minimumAge !== '') {
        throw new Error('Minimum child age is available only with Allowed from age.');
      }
      return { policy: normalizedPolicy, minimum_age: null };
    }
    if (minimumAge == null || minimumAge === '') {
      throw new Error(`Minimum child age must be a whole number from ${CHILD_AGE_MIN} to ${CHILD_AGE_MAX}.`);
    }
    const age = Number(minimumAge);
    if (!Number.isInteger(age) || age < CHILD_AGE_MIN || age > CHILD_AGE_MAX) {
      throw new Error(`Minimum child age must be a whole number from ${CHILD_AGE_MIN} to ${CHILD_AGE_MAX}.`);
    }
    return { policy: normalizedPolicy, minimum_age: age };
  }

  function resolveChildrenPolicy(property, roomType = null) {
    const override = asText(roomType?.children_policy_override);
    if (override) {
      const roomPolicy = normalizeChildrenPolicy(override, roomType?.minimum_child_age_override, { allowInherit: true });
      return { ...roomPolicy, source: 'room_type' };
    }
    if (!asText(property?.children_policy)) throw new Error('Property children policy has not been reviewed.');
    const propertyPolicy = normalizeChildrenPolicy(property.children_policy, property.minimum_child_age);
    return { ...propertyPolicy, source: 'property' };
  }

  function childrenPolicyLabel(policy, minimumAge) {
    const normalized = normalizeChildrenPolicy(policy, minimumAge);
    if (normalized.policy === 'not_allowed') return 'Adults only / No children';
    if (normalized.policy === 'minimum_age') return `Children allowed from age ${normalized.minimum_age}`;
    return 'Children allowed';
  }

  function sevenArchesShadowPreparation(workspace) {
    const normalized = normalizeWorkspace(workspace);
    if (normalized.property.id !== SEVEN_ARCHES_PROPERTY_ID) {
      return { eligible: false, blocker: 'This reviewed preparation is available only for the exact 7 Arches property.' };
    }
    if (normalized.property.architecture_version !== 'legacy') {
      return { eligible: false, blocker: '7 Arches is no longer a legacy property. Stop and review its architecture state.' };
    }
    let propertyPolicy;
    try {
      const reviewedPolicy = normalizeChildrenPolicy(
        normalized.property.children_policy,
        normalized.property.minimum_child_age,
      );
      propertyPolicy = {
        children_policy: reviewedPolicy.policy,
        minimum_child_age: reviewedPolicy.minimum_age,
      };
    } catch (_error) {
      return {
        eligible: false,
        blocker: 'Review the property children policy before preparing the two apartments. Room/photo preparation preserves that separately reviewed policy and never chooses an age.',
      };
    }
    const expectedIds = new Set([
      SEVEN_ARCHES_SHADOW_IDS.upper_room_type,
      SEVEN_ARCHES_SHADOW_IDS.ground_room_type,
    ]);
    const unexpectedRooms = normalized.room_types.filter((room) => !expectedIds.has(room.id));
    if (unexpectedRooms.length) {
      return {
        eligible: false,
        blocker: 'Unexpected normalized Room Types already exist. Review them before preparing the confirmed two-apartment package.',
        unexpected_room_ids: unexpectedRooms.map((room) => room.id),
      };
    }
    const gallery = normalizeGallery(normalized.property.photos);
    const catalogCodes = new Set(normalized.amenities_catalog.map((entry) => asText(entry.code)));
    const requiredAmenities = ['air_conditioning', 'balcony', 'terrace'];
    const missingAmenities = requiredAmenities.filter((code) => !catalogCodes.has(code));
    if (missingAmenities.length) {
      return {
        eligible: false,
        blocker: `Required amenity catalogue entries are missing: ${missingAmenities.join(', ')}.`,
        missing_amenities: missingAmenities,
      };
    }
    const rooms = SEVEN_ARCHES_ROOM_DEFINITIONS.map((definition) => {
      const existing = normalized.room_types.find((room) => room.id === definition.id);
      return normalizeRoomType({
        ...(existing || {}),
        id: definition.id,
        hotel_id: SEVEN_ARCHES_PROPERTY_ID,
        code: definition.code,
        name_i18n: existing?.name_i18n || definition.name_i18n,
        description_i18n: definition.description_i18n,
        gallery: existing?.gallery || [],
        capacity_adults: null,
        capacity_children: null,
        max_occupancy: 4,
        children_policy_override: null,
        minimum_child_age_override: null,
        bed_configuration: [],
        bathrooms: null,
        size_sqm: null,
        amenities: definition.amenities,
        inventory_mode: 'pooled',
        base_inventory_count: 1,
        // This is the normalized configuration status, not public eligibility.
        // Existing reviewed Room Types may legitimately be active while the
        // legacy property and disabled V2 capabilities keep them public-inert.
        status: existing?.status || 'draft',
        sort_order: definition.sort_order,
        version: existing?.version || 1,
        created_at: existing?.created_at || null,
        updated_at: existing?.updated_at || null,
      });
    });
    return {
      eligible: true,
      hotel_id: SEVEN_ARCHES_PROPERTY_ID,
      source_contract: SEVEN_ARCHES_SOURCE_CONTRACT,
      property_policy: propertyPolicy,
      property_gallery: gallery,
      rooms,
      pricing: {
        status: 'BLOCKED_PENDING_CANCELLATION_REVIEW',
        shared_rate_plan_label: 'Standard',
        source_rule_count: 63,
        legacy_public_unchanged: true,
      },
      public_change: false,
    };
  }

  function sevenArchesExpectedOriginalRoom(room) {
    if (!room) return null;
    return {
      hotel_id: room.hotel_id,
      source_key: room.legacy_source_key,
      code: room.code,
      name_i18n: clone(room.name_i18n),
      description_i18n: clone(room.description_i18n),
      gallery: clone(room.gallery),
      amenities: normalizeAmenities(room.amenities),
      max_occupancy: room.max_occupancy,
      capacity_adults: room.capacity_adults,
      capacity_children: room.capacity_children,
      inventory_mode: room.inventory_mode,
      base_inventory_count: room.base_inventory_count,
      sort_order: room.sort_order,
    };
  }

  function sevenArchesShadowReconciliation(originalWorkspace, freshWorkspace, options = {}) {
    const original = normalizeWorkspace(originalWorkspace);
    const fresh = normalizeWorkspace(freshWorkspace);
    const preparation = sevenArchesShadowPreparation(fresh);
    const blockers = preparation.eligible ? [] : [preparation.blocker || 'The two-apartment preparation is no longer eligible.'];
    const changes = [];
    const conflicts = [];
    const safeRebases = [];
    const normalizedOptions = Array.isArray(options) ? { roomReviews: options } : asObject(options);
    const roomReviews = asArray(normalizedOptions.roomReviews || normalizedOptions.room_reviews);
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    const addChange = (scope, field, before, after) => {
      if (!same(before, after)) changes.push({ scope, field, before: clone(before), after: clone(after) });
    };
    const classify = ({ scope, entityId, field, label, originalValue, currentValue, targetValue }) => {
      const detail = {
        scope,
        entity_id: entityId || null,
        field,
        label,
        original: clone(originalValue),
        current: clone(currentValue),
        target: clone(targetValue),
      };
      if (same(currentValue, targetValue)) {
        if (!same(originalValue, currentValue)) {
          safeRebases.push({ ...detail, reason: 'current_equals_target' });
        }
        return;
      }
      if (same(currentValue, originalValue)) {
        safeRebases.push({ ...detail, reason: 'current_equals_original' });
        return;
      }
      conflicts.push(detail);
    };
    const propertyBusinessValues = (workspaceValue) => ({
      architecture_version: workspaceValue.property.architecture_version,
      children_policy: workspaceValue.property.children_policy,
      minimum_child_age: workspaceValue.property.minimum_child_age,
      property_gallery: normalizeGallery(workspaceValue.property.photos),
      legacy_pricing_fingerprint: asText(workspaceValue.legacy_shadow_preview?.legacy_pricing_fingerprint) || null,
    });
    const originalProperty = propertyBusinessValues(original);
    const freshProperty = propertyBusinessValues(fresh);
    Object.keys(originalProperty).forEach((field) => {
      addChange('Property', field, originalProperty[field], freshProperty[field]);
    });

    classify({
      scope: 'Property',
      entityId: SEVEN_ARCHES_PROPERTY_ID,
      field: 'children_policy',
      label: 'Children policy',
      originalValue: originalProperty.children_policy,
      currentValue: freshProperty.children_policy,
      // The room/photo preparation does not own guest policy. A fresh reviewed
      // property value is therefore the value to preserve, not a stale
      // source-derived age embedded in this workflow.
      targetValue: freshProperty.children_policy,
    });
    classify({
      scope: 'Property',
      entityId: SEVEN_ARCHES_PROPERTY_ID,
      field: 'minimum_child_age',
      label: 'Minimum child age',
      originalValue: originalProperty.minimum_child_age,
      currentValue: freshProperty.minimum_child_age,
      targetValue: freshProperty.minimum_child_age,
    });
    classify({
      scope: 'Property',
      entityId: SEVEN_ARCHES_PROPERTY_ID,
      field: 'legacy_pricing_fingerprint',
      label: 'Legacy pricing fingerprint',
      originalValue: originalProperty.legacy_pricing_fingerprint,
      currentValue: freshProperty.legacy_pricing_fingerprint,
      targetValue: originalProperty.legacy_pricing_fingerprint,
    });

    const roomBusinessValues = (room) => room ? {
      name_i18n: clone(room.name_i18n),
      gallery: clone(room.gallery),
      status: room.status,
      code: room.code,
      legacy_source_key: room.legacy_source_key,
      max_occupancy: room.max_occupancy,
      capacity_adults: room.capacity_adults,
      capacity_children: room.capacity_children,
      inventory_mode: room.inventory_mode,
      base_inventory_count: room.base_inventory_count,
      amenities: [...room.amenities].sort(),
      bed_configuration: clone(room.bed_configuration),
      bathrooms: room.bathrooms,
      size_sqm: room.size_sqm,
      sort_order: room.sort_order,
    } : null;

    SEVEN_ARCHES_ROOM_DEFINITIONS.forEach((definition) => {
      const originalRoom = original.room_types.find((room) => room.id === definition.id) || null;
      const freshRoom = fresh.room_types.find((room) => room.id === definition.id) || null;
      const label = i18nText(definition.name_i18n, 'en', definition.code);
      const originalBusiness = roomBusinessValues(originalRoom);
      const freshBusiness = roomBusinessValues(freshRoom);
      if (!same(originalBusiness, freshBusiness)) {
        const fields = new Set([
          ...Object.keys(originalBusiness || {}),
          ...Object.keys(freshBusiness || {}),
        ]);
        fields.forEach((field) => addChange(label, field, originalBusiness?.[field], freshBusiness?.[field]));
      }
      if (!freshRoom) {
        if (originalRoom) {
          conflicts.push({
            scope: label,
            entity_id: definition.id,
            field: 'room_type',
            label: 'Room Type existence',
            original: sevenArchesExpectedOriginalRoom(originalRoom),
            current: null,
            target: { id: definition.id, source_key: definition.source_key, code: definition.code },
          });
        }
        return;
      }

      const identityFields = [
        ['hotel_id', 'Property identity', SEVEN_ARCHES_PROPERTY_ID],
        ['legacy_source_key', 'Source identity', definition.source_key],
        ['code', 'Room code', definition.code],
      ];
      identityFields.forEach(([field, fieldLabel, targetValue]) => {
        // The original H2B.1 RPC deliberately accepts an unset legacy source
        // key for an already-known deterministic Room Type ID. A conflicting
        // non-null key remains an identity failure and is never three-way
        // merged into another source relationship.
        if (field === 'legacy_source_key' && freshRoom[field] == null) return;
        if (same(freshRoom[field], targetValue)) return;
        conflicts.push({
          scope: label,
          entity_id: definition.id,
          field,
          label: fieldLabel,
          original: clone(originalRoom?.[field]),
          current: clone(freshRoom[field]),
          target: clone(targetValue),
          identity_conflict: true,
        });
      });

      const review = roomReviews.find((entry) => normalizeUuid(entry?.id) === definition.id);
      const targetRoom = {
        name_i18n: normalizeI18n(review?.name_i18n || freshRoom.name_i18n || definition.name_i18n),
        description_i18n: normalizeI18n(definition.description_i18n),
        gallery: normalizeGallery(review?.gallery == null ? freshRoom.gallery : review.gallery),
        amenities: normalizeAmenities(definition.amenities),
        max_occupancy: 4,
        capacity_adults: null,
        capacity_children: null,
        inventory_mode: 'pooled',
        base_inventory_count: 1,
        sort_order: definition.sort_order,
      };
      const mergeFields = [
        ['name_i18n', 'Room name'],
        ['description_i18n', 'Room description'],
        ['gallery', 'Room gallery'],
        ['amenities', 'confirmed amenities'],
        ['max_occupancy', 'Capacity contract (maximum occupancy)'],
        ['capacity_adults', 'Capacity contract (adults)'],
        ['capacity_children', 'Capacity contract (children)'],
        ['inventory_mode', 'Inventory mode'],
        ['base_inventory_count', 'Inventory count'],
        ['sort_order', 'Display order'],
      ];
      mergeFields.forEach(([field, fieldLabel]) => {
        classify({
          scope: label,
          entityId: definition.id,
          field,
          label: fieldLabel,
          originalValue: originalRoom?.[field],
          currentValue: freshRoom[field],
          targetValue: targetRoom[field],
        });
      });
    });

    conflicts.forEach((conflict) => {
      blockers.push(`${conflict.scope} has a reviewed ${conflict.label.toLowerCase()} conflict: current and requested values both differ from the original review.`);
    });

    return {
      eligible: preparation.eligible && blockers.length === 0 && conflicts.length === 0,
      blocker: blockers[0] || null,
      blockers,
      changes,
      conflicts,
      safe_rebases: safeRebases,
    };
  }

  function buildSevenArchesShadowPlan(workspace, roomReviews, options = {}) {
    const preparation = sevenArchesShadowPreparation(workspace);
    if (!preparation.eligible) throw new Error(preparation.blocker);
    const normalizedWorkspace = normalizeWorkspace(workspace);
    const reviews = asArray(roomReviews);
    if (reviews.length !== 2) throw new Error('Exactly two reviewed 7 Arches apartments are required.');
    const propertyGallery = new Set(preparation.property_gallery);
    const rooms = preparation.rooms.map((room) => {
      const reviewed = reviews.find((entry) => normalizeUuid(entry.id) === room.id);
      if (!reviewed) throw new Error(`Missing reviewed apartment ${room.code}.`);
      const name = normalizeI18n(reviewed.name_i18n);
      if (LANGUAGES.some((language) => !asText(name[language]))) {
        throw new Error(`${i18nText(room.name_i18n, 'en', room.code)} needs PL, EN and HE names.`);
      }
      const selectedPhotos = normalizeGallery(reviewed.gallery);
      if (!selectedPhotos.length) throw new Error(`${i18nText(name, 'en', room.code)} needs at least one reviewed room photo.`);
      if (selectedPhotos.some((url) => !propertyGallery.has(url))) {
        throw new Error('Room photos must be selected from the current 7 Arches property gallery.');
      }
      const existing = normalizedWorkspace.room_types.find((candidate) => candidate.id === room.id);
      return {
        id: room.id,
        expected_version: existing ? existing.version : 0,
        ...(existing ? { expected_original: sevenArchesExpectedOriginalRoom(existing) } : {}),
        source_key: SEVEN_ARCHES_ROOM_DEFINITIONS.find((definition) => definition.id === room.id).source_key,
        code: room.code,
        name_i18n: name,
        description_i18n: clone(room.description_i18n),
        gallery: selectedPhotos,
        amenities: clone(room.amenities),
        max_occupancy: 4,
        sort_order: room.sort_order,
      };
    });
    const currentVersion = (rows, id) => Math.max(0, asInteger(asArray(rows).find((row) => normalizeUuid(row?.id) === id)?.version, 0));
    const legacyFingerprint = asText(normalizedWorkspace.legacy_shadow_preview?.legacy_pricing_fingerprint);
    if (!legacyFingerprint) throw new Error('The server did not return the reviewed legacy pricing fingerprint. Refresh after deploying the H2B.1 SQL foundation.');
    return {
      hotel_id: SEVEN_ARCHES_PROPERTY_ID,
      expected_property_updated_at: normalizedWorkspace.property.updated_at || null,
      expected_property_policy: {
        children_policy: normalizedWorkspace.property.children_policy || null,
        minimum_child_age: normalizedWorkspace.property.minimum_child_age == null
          ? null
          : normalizedWorkspace.property.minimum_child_age,
      },
      expected_legacy_pricing_fingerprint: legacyFingerprint,
      expected_versions: {
        upper_room: currentVersion(normalizedWorkspace.room_types, SEVEN_ARCHES_SHADOW_IDS.upper_room_type),
        ground_room: currentVersion(normalizedWorkspace.room_types, SEVEN_ARCHES_SHADOW_IDS.ground_room_type),
        pricing_schedule: currentVersion(normalizedWorkspace.pricing_schedules, SEVEN_ARCHES_SHADOW_IDS.pricing_schedule),
        property_party_preview: currentVersion(normalizedWorkspace.pricing_schedules, SEVEN_ARCHES_SHADOW_IDS.property_party_preview),
        rate_plan: currentVersion(normalizedWorkspace.rate_plans, SEVEN_ARCHES_SHADOW_IDS.rate_plan),
        upper_room_rate: currentVersion(normalizedWorkspace.room_rates, SEVEN_ARCHES_SHADOW_IDS.upper_room_rate),
        ground_room_rate: currentVersion(normalizedWorkspace.room_rates, SEVEN_ARCHES_SHADOW_IDS.ground_room_rate),
      },
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      source_contract: SEVEN_ARCHES_SOURCE_CONTRACT,
      property_policy: clone(preparation.property_policy),
      rooms,
      prepare_pricing_preview: true,
    };
  }

  function cancellationPolicyLabel(value) {
    const policy = normalizeCancellationPolicy(value);
    if (policy.type === 'non_refundable') return 'Non-refundable';
    if (policy.type === 'flexible') return 'Flexible';
    if (policy.type === 'requires_review') {
      return i18nText(policy.summary_i18n, 'en', 'Cancellation terms require review');
    }
    const deadline = `${policy.deadline_hours}h deadline`;
    if (policy.penalty_mode === 'percent') return `Custom · ${deadline} · ${policy.penalty_value || 0}%`;
    if (policy.penalty_mode === 'flat') return `Custom · ${deadline} · fixed ${policy.penalty_value || 0}`;
    return `Custom · ${deadline}`;
  }

  function normalizeRoomType(value) {
    const source = asObject(value);
    const capacityAdults = source.capacity_adults == null ? null : asInteger(source.capacity_adults, 0);
    const capacityChildren = source.capacity_children == null ? null : asInteger(source.capacity_children, 0);
    const inferredTotal = capacityAdults == null || capacityChildren == null ? null : capacityAdults + capacityChildren;
    const explicitTotal = source.max_occupancy == null ? null : asInteger(source.max_occupancy, 0);
    const roomChildrenPolicy = asText(source.children_policy_override);
    return {
      id: normalizeUuid(source.id),
      hotel_id: normalizeUuid(source.hotel_id),
      legacy_source_key: asNullableText(source.legacy_source_key)?.toLowerCase() || null,
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      description_i18n: normalizeI18n(source.description_i18n),
      gallery: normalizeGallery(source.gallery),
      capacity_adults: capacityAdults,
      capacity_children: capacityChildren,
      max_occupancy: explicitTotal,
      effective_max_occupancy: explicitTotal == null ? inferredTotal : explicitTotal,
      children_policy_override: ROOM_CHILDREN_POLICY_OVERRIDES.includes(roomChildrenPolicy) ? roomChildrenPolicy : null,
      minimum_child_age_override: roomChildrenPolicy === 'minimum_age'
        ? asInteger(source.minimum_child_age_override, -1)
        : null,
      bed_configuration: normalizeBedConfiguration(source.bed_configuration),
      bathrooms: asNumber(source.bathrooms, null),
      size_sqm: asNumber(source.size_sqm, null),
      floor_label_i18n: normalizeI18n(source.floor_label_i18n),
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
      pricing_schedule_id: normalizeUuid(source.pricing_schedule_id) || null,
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

  function sharedScheduleCalendarDisplayState(product, stayDate, exactOverride = null, dailyInventory = null, options = {}) {
    const rate = asObject(product);
    const roomRateId = normalizeUuid(rate.id);
    const roomTypeId = normalizeUuid(rate.room_type_id);
    const scheduleId = normalizeUuid(rate.pricing_schedule_id);
    const date = asText(stayDate);
    if (!scheduleId) return null;
    if (!roomRateId || !roomTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Shared schedule Calendar state requires exact Room Type, Room Rate and stay-date identifiers.');
    }

    const asOfValue = options.asOf || new Date().toISOString();
    const asOf = Date.parse(asOfValue);
    const isCurrent = (row, { allowInactive = false } = {}) => {
      const source = asObject(row);
      if (!Object.keys(source).length) return false;
      if (!allowInactive && source.is_active === false) return false;
      if (!source.expires_at) return true;
      const expiry = Date.parse(source.expires_at);
      return Number.isFinite(asOf) && Number.isFinite(expiry) && expiry > asOf;
    };
    const overrideSource = asObject(exactOverride);
    const inventorySource = asObject(dailyInventory);
    const overrideMatches = normalizeUuid(overrideSource.room_rate_id) === roomRateId
      && asText(overrideSource.stay_date) === date
      && isCurrent(overrideSource);
    const inventoryMatches = normalizeUuid(inventorySource.room_type_id) === roomTypeId
      && asText(inventorySource.stay_date) === date
      && isCurrent(inventorySource, { allowInactive: true });
    const override = overrideMatches ? overrideSource : null;
    const inventory = inventoryMatches ? inventorySource : null;
    const modeValue = (row, field) => {
      const mode = row && ['set', 'clear'].includes(asText(row[`${field}_mode`]))
        ? asText(row[`${field}_mode`])
        : null;
      return {
        mode,
        value: mode === 'set' ? row[field] : null,
      };
    };
    const nightlyRate = modeValue(override, 'nightly_rate');
    const minimumStay = modeValue(override, 'minimum_stay');
    const maximumStay = modeValue(override, 'maximum_stay');
    const rateClosed = modeValue(override, 'closed');
    const closedToArrival = modeValue(override, 'closed_to_arrival');
    const closedToDeparture = modeValue(override, 'closed_to_departure');
    const sellableUnits = modeValue(inventory, 'sellable_units');
    const inventoryClosed = modeValue(inventory, 'closed');
    const baseInventory = Math.max(0, asInteger(rate.base_inventory_count, 0));

    return {
      kind: 'shared_schedule_shadow',
      authoritative: false,
      requestable: false,
      blocker: 'shared_room_pricing_schedule_requires_h3_resolution',
      room_rate_id: roomRateId,
      room_type_id: roomTypeId,
      pricing_schedule_id: scheduleId,
      stay_date: date,
      exact_override_id: override ? normalizeUuid(override.id) || null : null,
      exact_override_version: override ? Math.max(1, asInteger(override.version, 1)) : null,
      inventory_version: inventory ? Math.max(1, asInteger(inventory.version, 1)) : null,
      nightly_rate: nightlyRate,
      minimum_stay: minimumStay,
      maximum_stay: maximumStay,
      closed: rateClosed,
      closed_to_arrival: closedToArrival,
      closed_to_departure: closedToDeparture,
      sellable_units: sellableUnits,
      inventory_closed: inventoryClosed,
      configured_inventory: sellableUnits.mode === 'set'
        ? Math.max(0, asInteger(sellableUnits.value, 0))
        : baseInventory,
      inventory_source: sellableUnits.mode === 'set' ? 'exact_room_date' : 'room_base',
      explicitly_closed: (inventoryClosed.mode === 'set' && inventoryClosed.value === true)
        || (rateClosed.mode === 'set' && rateClosed.value === true),
    };
  }

  function normalizeWorkspace(value) {
    const source = asObject(value);
    const property = asObject(source.property);
    const ownerPartner = asObject(source.owner_partner);
    const architectureVersion = asText(property.architecture_version) || 'legacy';
    // While architecture is legacy, the established editor/public contract
    // still owns title/description. Prefer those live columns so an older
    // mirrored *_i18n snapshot can never mask a legitimate legacy edit.
    const titleSource = architectureVersion === 'legacy'
      ? (property.title || property.title_i18n)
      : (property.title_i18n || property.title);
    const descriptionSource = architectureVersion === 'legacy'
      ? (property.description || property.description_i18n)
      : (property.description_i18n || property.description);
    return {
      property: {
        ...clone(property),
        id: normalizeUuid(property.id),
        architecture_version: architectureVersion,
        booking_mode: BOOKING_MODES.includes(asText(property.booking_mode)) ? asText(property.booking_mode) : null,
        timezone: asNullableText(property.timezone),
        currency: asText(property.currency) ? asText(property.currency).toUpperCase() : null,
        children_policy: CHILDREN_POLICIES.includes(asText(property.children_policy))
          ? asText(property.children_policy)
          : null,
        minimum_child_age: asText(property.children_policy) === 'minimum_age'
          ? asInteger(property.minimum_child_age, -1)
          : null,
        title: normalizeI18n(titleSource, { fallback: typeof titleSource === 'string' ? titleSource : '' }),
        title_i18n: normalizeI18n(titleSource, { fallback: typeof titleSource === 'string' ? titleSource : '' }),
        description: normalizeI18n(descriptionSource, { fallback: typeof descriptionSource === 'string' ? descriptionSource : '' }),
        description_i18n: normalizeI18n(descriptionSource, { fallback: typeof descriptionSource === 'string' ? descriptionSource : '' }),
        minimum_stay_nights: property.minimum_stay_nights == null ? null : Math.max(1, asInteger(property.minimum_stay_nights, 1)),
        amenities: normalizeAmenities(property.amenities),
        photos: normalizeGallery(property.photos),
        owner_partner: Object.keys(ownerPartner).length ? clone(ownerPartner) : clone(property.owner_partner || {}),
      },
      room_types: asArray(source.room_types).map(normalizeRoomType),
      units: asArray(source.units).map(normalizeUnit),
      rate_plans: asArray(source.rate_plans).map(normalizeRatePlan),
      room_rates: asArray(source.room_rates).map(normalizeRoomRate),
      pricing_schedules: asArray(source.pricing_schedules).map((entry) => clone(entry)),
      pricing_schedule_tiers: asArray(source.pricing_schedule_tiers).map((entry) => clone(entry)),
      legacy_shadow_preview: clone(source.legacy_shadow_preview || {}),
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
    if (activeRooms.some((room) => !Number.isInteger(room.effective_max_occupancy) || room.effective_max_occupancy < 1)) {
      blockers.push('Every active Room Type needs valid guest capacity.');
    }
    if (activeRooms.length && !asText(property.children_policy)
        && !activeRooms.every((room) => asText(room.children_policy_override))) {
      blockers.push('Review the property children policy or configure every active Room Type override.');
    }
    activeRooms.forEach((room) => {
      try {
        resolveChildrenPolicy(property, room);
      } catch (_error) {
        blockers.push(`${i18nText(room.name_i18n, 'en', room.code)} has an invalid children policy.`);
      }
    });
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
    if (activePlans.some((plan) => plan.cancellation_policy?.type === 'requires_review')) {
      blockers.push('Confirm cancellation terms before activating the Rate Plan.');
    }
    if (activeRates.some((rate) => rate.pricing_schedule_id)) {
      blockers.push('Shared pricing schedules require the H3 allocation review before activation.');
    }
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

  function migrationPreview(workspace, evidence = {}) {
    const normalized = normalizeWorkspace(workspace);
    const property = normalized.property;
    const legacyRooms = asArray(property.room_types);
    const rules = asArray(asObject(property.pricing_tiers).rules);
    const propertyPhotos = normalizeGallery(property.photos);
    const propertyAmenities = normalizeAmenities(property.amenities);
    const guestCounts = Array.from(new Set(rules
      .map((rule) => asInteger(rule?.persons, 0))
      .filter((value) => value > 0))).sort((a, b) => a - b);
    const stayThresholds = Array.from(new Set(rules
      .map((rule) => asInteger(rule?.min_nights, 0))
      .filter((value) => value > 0))).sort((a, b) => a - b);
    const isSevenArchesMatrix = (
      property.id === '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      || asText(property.slug) === '7-ukow'
    ) && rules.length === 63
      && guestCounts.join(',') === '2,3,4,5,6,7,8'
      && stayThresholds.join(',') === '2,3,4,5,6,7,8,9,10';
    const promotionEvidence = asObject(evidence.pricingPromotionPreview);
    const promotionParity = asObject(promotionEvidence.parity);
    const promotionStatus = asText(asObject(promotionEvidence.promotion).status);
    const activationEvidence = asObject(evidence.pricingActivation);
    const activationParity = asObject(asObject(activationEvidence.h3_1p).parity);
    const parityEvidence = Number.isInteger(activationParity.total_case_count)
      ? activationParity : promotionParity;
    const parityCaseCount = Number.isInteger(parityEvidence.total_case_count)
      ? parityEvidence.total_case_count
      : null;
    const parityMismatchCount = Number.isInteger(parityEvidence.total_mismatch_count)
      ? parityEvidence.total_mismatch_count
      : null;
    const h31pParityVerified = isSevenArchesMatrix
      && (promotionStatus === 'reviewed' || activationEvidence.status === 'active')
      && parityCaseCount === 70
      && parityMismatchCount === 0;
    const h31pActivated = h31pParityVerified && activationEvidence.status === 'active';
    const h31pMismatchObserved = isSevenArchesMatrix
      && parityMismatchCount !== null
      && parityMismatchCount > 0;
    const requiresOccupancyLosModel = guestCounts.length > 1 || stayThresholds.length > 1;
    const hasPropertyLevelAccommodation = (
      property.architecture_version === 'legacy'
      && legacyRooms.length === 0
      && rules.length > 0
    );
    const liveProductCount = legacyRooms.length || (hasPropertyLevelAccommodation ? 1 : 0);
    const suggestions = legacyRooms.map((legacyRoom, index) => ({
      source_index: index,
      proposed_code: asText(legacyRoom.id || legacyRoom.code || `legacy-room-${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
      proposed_name: normalizeI18n(legacyRoom.name || legacyRoom.title, { fallback: `Legacy room ${index + 1}` }),
      status: 'not_migrated',
    }));
    const fieldClassifications = hasPropertyLevelAccommodation ? [
      {
        field: 'Property relationship',
        target_field: 'hotel_id',
        classification: 'SAFE_TO_COPY',
        source_summary: property.id,
        note: 'The shadow Room Type belongs to this exact property.',
      },
      {
        field: 'Normalized configuration status',
        target_field: 'status',
        classification: 'SAFE_TO_COPY',
        source_summary: 'Independent from public eligibility',
        note: 'A new shadow starts as draft; an existing reviewed active status is preserved. Both remain public-inert while the property is legacy and V2 capabilities are off.',
      },
      {
        field: 'Currency',
        target_field: 'future Room Rate currency',
        classification: 'SAFE_TO_COPY',
        source_summary: property.currency,
        note: 'Currency may be carried into the separately reviewed pricing product; no Room Rate is created now.',
      },
      {
        field: 'Room name and description',
        target_field: 'name_i18n / description_i18n',
        classification: 'REQUIRES_REVIEW',
        source_summary: i18nText(property.title, 'en', property.slug || property.id),
        note: 'Current text describes the property and must not be assumed to be the physical room name or room-only description.',
      },
      {
        field: 'Guest capacity',
        target_field: 'capacity_adults / capacity_children',
        classification: 'REQUIRES_REVIEW',
        source_summary: Number(property.max_persons) > 0
          ? `Legacy booking maximum: ${Number(property.max_persons)} guests`
          : 'No legacy booking maximum',
        note: 'A property-level booking maximum may span more than one accommodation and is not copied as Room Type capacity.',
      },
      {
        field: 'Property gallery',
        target_field: 'gallery',
        classification: 'REQUIRES_REVIEW',
        source_summary: `${propertyPhotos.length} property photo${propertyPhotos.length === 1 ? '' : 's'}`,
        note: 'Every photo remains property media. Admin may explicitly select only photos confirmed for this Room Type.',
      },
      {
        field: 'Property amenities',
        target_field: 'amenities',
        classification: 'REQUIRES_REVIEW',
        source_summary: `${propertyAmenities.length} property amenit${propertyAmenities.length === 1 ? 'y' : 'ies'}`,
        note: 'Property amenities are shown as context but are not copied into the room automatically.',
      },
      {
        field: 'Legacy pricing matrix',
        target_field: 'future Room Rate / pricing rules',
        classification: 'REQUIRES_REVIEW',
        source_summary: `${rules.length} legacy pricing rule${rules.length === 1 ? '' : 's'}`,
        note: 'Safe to preview, but pricing conversion is a separate reviewed step with a zero-mismatch oracle.',
      },
      {
        field: 'Physical inventory',
        target_field: 'inventory_mode / base_inventory_count',
        classification: 'UNKNOWN',
        source_summary: 'Not represented structurally in the legacy product',
        note: 'Admin or partner must confirm the inventory model and exact count.',
      },
      {
        field: 'Beds, bathrooms and size',
        target_field: 'bed_configuration / bathrooms / size_sqm',
        classification: 'UNKNOWN',
        source_summary: 'No unambiguous structured room data',
        note: 'Do not infer these values from marketing text or photographs.',
      },
    ] : [];
    return {
      property_id: property.id,
      property_name: i18nText(property.title, 'en', property.slug || property.id),
      architecture_version: property.architecture_version,
      legacy_room_count: legacyRooms.length,
      legacy_live_product_count: liveProductCount,
      legacy_pricing_rule_count: rules.length,
      property_gallery_count: propertyPhotos.length,
      pricing_preview: {
        pricing_model: asText(property.pricing_model),
        rule_count: rules.length,
        guest_counts: guestCounts,
        stay_thresholds: stayThresholds,
        requires_occupancy_los_model: requiresOccupancyLosModel,
        h1_rate_rules_compatible: !requiresOccupancyLosModel,
        oracle: isSevenArchesMatrix
          ? h31pMismatchObserved
            ? 'HOTEL_7_ARCHES_ROOM1_PRICE_MISMATCH'
            : h31pParityVerified
              ? 'HOTEL_7_ARCHES_H3_1P_70_CASE_PARITY_VERIFIED'
              : 'HOTEL_7_ARCHES_H3_1P_PARITY_REVIEW_REQUIRED'
          : 'HOTEL_LEGACY_SHADOW_PRICE_MISMATCH',
        oracle_status: h31pMismatchObserved ? 'MISMATCH' : (h31pParityVerified ? 'VERIFIED' : 'REVIEW_REQUIRED'),
        verified_case_count: parityCaseCount,
        verified_mismatch_count: parityMismatchCount,
        conversion_status: h31pParityVerified
          ? h31pActivated ? 'H3_1P_PARITY_VERIFIED_ACTIVE_SHADOW' : 'H3_1P_PARITY_VERIFIED_INACTIVE'
          : requiresOccupancyLosModel ? 'BLOCKED_PENDING_H2B_MODEL' : 'REVIEW_REQUIRED',
      },
      legacy_product: hasPropertyLevelAccommodation ? {
        kind: 'property_level_accommodation',
        label: 'Legacy property-level accommodation',
        status: 'AWAITING_ADMIN_CONFIRMATION',
        pricing_rule_count: rules.length,
        property_gallery_count: propertyPhotos.length,
        max_persons: Number(property.max_persons) > 0 ? Number(property.max_persons) : null,
        field_classifications: fieldClassifications,
      } : null,
      suggestions,
      needs_manual_room_mapping: legacyRooms.length === 0,
      can_prepare_existing_accommodation: hasPropertyLevelAccommodation && normalized.room_types.length === 0,
      status: 'NOT_MIGRATED',
      messages: legacyRooms.length
        ? ['Review every suggested Room Type before a future migration.']
        : hasPropertyLevelAccommodation
          ? ['One live property-level accommodation product exists. It is not a normalized Room Type and requires Admin confirmation before shadow preparation.']
          : ['No structured legacy room rows or property-level pricing product are available. Create Room Types manually in shadow mode.'],
    };
  }

  function buildLegacyShadowRoomSeed(workspace, exactId) {
    const normalized = normalizeWorkspace(workspace);
    const preview = migrationPreview(normalized);
    const id = normalizeUuid(exactId);
    if (!preview.can_prepare_existing_accommodation || !preview.legacy_product) {
      throw new Error('This property does not have an eligible property-level legacy product to prepare.');
    }
    if (!id) throw new Error('An exact Room Type UUID is required for shadow preparation.');
    return normalizeRoomType({
      id,
      hotel_id: normalized.property.id,
      code: '',
      name_i18n: {},
      description_i18n: {},
      gallery: [],
      capacity_adults: 0,
      capacity_children: 0,
      bed_configuration: [],
      bathrooms: null,
      size_sqm: null,
      amenities: [],
      inventory_mode: 'pooled',
      base_inventory_count: 0,
      status: 'draft',
      sort_order: 1000,
      version: 1,
    });
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
    room.name_i18n = assertI18nLength(room.name_i18n, 240, 'Room name', { requireEnglish: true });
    room.description_i18n = assertI18nLength(room.description_i18n, 12000, 'Room description');
    room.floor_label_i18n = assertI18nLength(room.floor_label_i18n, 160, 'Room floor label');
    room.gallery = assertGalleryLimits(room.gallery, 'Room gallery');
    room.amenities = assertAmenityLimits(room.amenities, 'Room amenities');
    const rawBeds = asArray(value?.bed_configuration);
    if (rawBeds.length > 30) throw new Error('Bed configuration may contain at most 30 rows.');
    rawBeds.forEach((bedValue) => {
      const bed = asObject(bedValue);
      const type = asText(bed.type);
      const quantity = asInteger(bed.quantity, -1);
      if (!BED_TYPES.includes(type) || quantity < 1 || quantity > 20) {
        throw new Error('Every bed row needs a supported type and a quantity from 1 to 20.');
      }
      if (type === 'other') assertI18nLength(bed.label, 160, 'Other bed label');
    });
    if (!Number.isInteger(room.effective_max_occupancy) || room.effective_max_occupancy < 1 || room.effective_max_occupancy > 50) {
      throw new Error('Maximum total occupancy must be a whole number from 1 to 50.');
    }
    if (room.max_occupancy == null) {
      if (!Number.isInteger(room.capacity_adults) || room.capacity_adults < 1) throw new Error('Adults capacity must be at least 1.');
      if (!Number.isInteger(room.capacity_children) || room.capacity_children < 0) throw new Error('Children capacity cannot be negative.');
    } else if (room.capacity_adults != null || room.capacity_children != null) {
      throw new Error('Adult and child capacities must stay unset when maximum total occupancy is used without a confirmed split.');
    }
    normalizeChildrenPolicy(room.children_policy_override, room.minimum_child_age_override, { allowInherit: true });
    if (room.base_inventory_count < 0 || room.base_inventory_count > 10000) throw new Error('Base inventory must be a whole number from 0 to 10000.');
    if (room.bathrooms != null && (room.bathrooms < 0 || room.bathrooms > 100)) throw new Error('Bathrooms must be between 0 and 100.');
    if (room.size_sqm != null && (room.size_sqm < 0.01 || room.size_sqm > 100000)) throw new Error('Room size must be between 0.01 and 100000 m².');
    if (room.sort_order < 0 || room.sort_order > 1000000) throw new Error('Room sort order must be between 0 and 1000000.');
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
    if (plan.cancellation_policy.type === 'requires_review') {
      if (!asText(plan.cancellation_policy.reason) || asText(plan.cancellation_policy.reason).length > 160) {
        throw new Error('The unresolved cancellation-policy reason is missing or invalid.');
      }
      if (plan.is_active) throw new Error('Confirm cancellation terms before activating this Rate Plan.');
    }
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
        'country', 'latitude', 'longitude', 'google_maps_url', 'amenities',
        'check_in_from', 'check_out_until', 'timezone', 'currency', 'booking_mode',
        'owner_partner_id', 'cover_image_url', 'photos', 'minimum_stay_nights',
        'maximum_stay_nights', 'guest_instructions_i18n', 'check_in_instructions_i18n',
        'check_out_instructions_i18n', 'internal_operational_notes', 'children_policy', 'minimum_child_age',
      ],
      room_type: [
        'source_id', 'code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults',
        'capacity_children', 'max_occupancy',
        'children_policy_override', 'minimum_child_age_override',
        'bed_configuration', 'bathrooms', 'size_sqm', 'floor_label_i18n', 'amenities',
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

  const PROPERTY_CONTROL_CONTRACT = 'hotels_v2_admin_b_property_control_v1';
  const PROPERTY_CONTROL_BUSINESS_FIELDS = Object.freeze([
    'title_i18n', 'description_i18n', 'address_line', 'city', 'district', 'postal_code',
    'country', 'latitude', 'longitude', 'google_maps_url', 'timezone',
    'currency', 'booking_mode', 'check_in_from', 'check_out_until', 'minimum_stay_nights',
    'maximum_stay_nights', 'owner_partner_id', 'children_policy', 'minimum_child_age',
    'amenities', 'cover_image_url', 'photos', 'guest_instructions_i18n',
    'check_in_instructions_i18n', 'check_out_instructions_i18n', 'internal_operational_notes',
  ]);
  const PROPERTY_CONTROL_PRIVATE_FIELDS = Object.freeze([
    'maximum_stay_nights', 'guest_instructions_i18n', 'check_in_instructions_i18n',
    'check_out_instructions_i18n', 'internal_operational_notes',
  ]);
  const PROPERTY_CONTROL_MUTATION_FIELDS = Object.freeze(PROPERTY_CONTROL_BUSINESS_FIELDS.filter((field) => (
    field !== 'children_policy' && field !== 'minimum_child_age'
  )));

  function buildPropertyControlPlan(workspace, nextPropertyValue, options = {}) {
    const normalized = normalizeWorkspace(workspace);
    const current = {
      ...normalized.property,
      ...clone(asObject(options.operationalProfile)),
      ...clone(asObject(options.currentProperty)),
    };
    const requested = asObject(nextPropertyValue);
    const currentState = propertyControlBusinessState(current);
    const nextState = propertyControlBusinessState({ ...current, ...requested });
    const propertyId = normalizeUuid(current.id);
    if (!propertyId || normalizeUuid(requested.id || current.id) !== propertyId) throw new Error('A reviewed exact property is required.');
    nextState.title_i18n = assertI18nLength(nextState.title_i18n, 240, 'Property name', { requireEnglish: true });
    nextState.description_i18n = assertI18nLength(nextState.description_i18n, 12000, 'Property description');
    nextState.guest_instructions_i18n = assertI18nLength(nextState.guest_instructions_i18n, 8000, 'Guest information');
    nextState.check_in_instructions_i18n = assertI18nLength(nextState.check_in_instructions_i18n, 8000, 'Check-in instructions');
    nextState.check_out_instructions_i18n = assertI18nLength(nextState.check_out_instructions_i18n, 8000, 'Check-out instructions');
    assertTextLength(nextState.city, 200, 'City');
    assertTextLength(nextState.address_line, 500, 'Address');
    assertTextLength(nextState.district, 200, 'District / area');
    assertTextLength(nextState.postal_code, 40, 'Postcode');
    assertTextLength(nextState.country, 100, 'Country');
    assertTextLength(nextState.google_maps_url, 2048, 'Google Maps URL');
    assertTextLength(nextState.cover_image_url, 2048, 'Cover image URL');
    assertTextLength(nextState.timezone, 100, 'Timezone');
    assertTextLength(nextState.internal_operational_notes, 5000, 'Internal operational notes');
    nextState.photos = assertGalleryLimits(nextState.photos, 'Property gallery');
    nextState.amenities = assertAmenityLimits(nextState.amenities, 'Property amenities');
    if (!asText(nextState.city)) throw new Error('City is required.');
    if (JSON.stringify(nextState.country) !== JSON.stringify(currentState.country)
        && !asText(nextState.country)) {
      throw new Error('Country cannot be cleared once it is configured.');
    }
    if (JSON.stringify(nextState.timezone) !== JSON.stringify(currentState.timezone)
        && !asText(nextState.timezone)) {
      throw new Error('Timezone cannot be cleared once it is configured.');
    }
    if (!/^[A-Z]{3}$/.test(asText(nextState.currency))) throw new Error('Currency must be a three-letter code.');
    if (!BOOKING_MODES.includes(asText(nextState.booking_mode))) throw new Error('Booking mode is invalid.');
    if (nextState.latitude != null && (nextState.latitude < -90 || nextState.latitude > 90)) throw new Error('Latitude must be between -90 and 90.');
    if (nextState.longitude != null && (nextState.longitude < -180 || nextState.longitude > 180)) throw new Error('Longitude must be between -180 and 180.');
    if (JSON.stringify(nextState.google_maps_url) !== JSON.stringify(currentState.google_maps_url)
        && nextState.google_maps_url && !isSupportedGoogleMapsUrl(nextState.google_maps_url)) {
      throw new Error('Google Maps URL must use a supported Google Maps domain.');
    }
    if (nextState.minimum_stay_nights != null && (nextState.minimum_stay_nights < 1 || nextState.minimum_stay_nights > 365)) {
      throw new Error('Minimum stay must be a whole number from 1 to 365.');
    }
    if (nextState.maximum_stay_nights != null && (nextState.maximum_stay_nights < 1 || nextState.maximum_stay_nights > 365)) {
      throw new Error('Maximum stay must be a whole number from 1 to 365.');
    }
    if (nextState.minimum_stay_nights != null && nextState.maximum_stay_nights != null
        && nextState.maximum_stay_nights < nextState.minimum_stay_nights) {
      throw new Error('Maximum stay cannot be shorter than minimum stay.');
    }
    if (nextState.children_policy) normalizeChildrenPolicy(nextState.children_policy, nextState.minimum_child_age);
    else if (nextState.minimum_child_age != null) throw new Error('A minimum child age requires a reviewed children policy.');
    const payload = {};
    const expectedOriginal = {};
    PROPERTY_CONTROL_MUTATION_FIELDS.forEach((field) => {
      if (JSON.stringify(nextState[field]) === JSON.stringify(currentState[field])) return;
      payload[field] = clone(nextState[field]);
      expectedOriginal[field] = clone(currentState[field]);
    });
    if (!Object.keys(payload).length) throw new Error('There are no property changes to review.');
    const expectedProfileVersion = options.expectedOperationalProfileVersion == null
      ? asInteger(current.operational_profile_version ?? current.version, -1)
      : asInteger(options.expectedOperationalProfileVersion, -1);
    if (PROPERTY_CONTROL_PRIVATE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(payload, field))
        && expectedProfileVersion < 0) {
      throw new Error('The reviewed property plan is missing its private operational-profile version.');
    }
    return {
      contract_version: PROPERTY_CONTROL_CONTRACT,
      hotel_id: propertyId,
      expected_property_updated_at: options.expectedPropertyUpdatedAt || normalized.property.updated_at || null,
      expected_operational_profile_version: Math.max(0, expectedProfileVersion),
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      expected_original: expectedOriginal,
      payload,
    };
  }

  function isSupportedGoogleMapsUrl(value) {
    try {
      const url = new URL(asText(value));
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'maps.app.goo.gl') return url.pathname !== '/';
      if (host === 'goo.gl') return /^\/maps(?:\/|$)/.test(url.pathname);
      const googleHost = host.replace(/^maps\./, '');
      if (!/^google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(googleHost)) return false;
      return host.startsWith('maps.google.') || /^\/maps(?:\/|$)/.test(url.pathname);
    } catch (_error) {
      return false;
    }
  }

  function propertyControlBusinessState(value) {
    const source = asObject(value);
    const state = {
      title_i18n: normalizeI18n(source.title_i18n || source.title),
      description_i18n: normalizeI18n(source.description_i18n || source.description),
      address_line: asNullableText(source.address_line),
      city: asText(source.city),
      district: asNullableText(source.district),
      postal_code: asNullableText(source.postal_code),
      country: asNullableText(source.country),
      latitude: asNumber(source.latitude, null),
      longitude: asNumber(source.longitude, null),
      google_maps_url: asNullableText(source.google_maps_url),
      timezone: asText(source.timezone),
      currency: asText(source.currency).toUpperCase(),
      booking_mode: asText(source.booking_mode),
      check_in_from: asNullableText(source.check_in_from)?.slice(0, 5) || null,
      check_out_until: asNullableText(source.check_out_until)?.slice(0, 5) || null,
      minimum_stay_nights: source.minimum_stay_nights == null ? null : asInteger(source.minimum_stay_nights, 0),
      maximum_stay_nights: source.maximum_stay_nights == null ? null : asInteger(source.maximum_stay_nights, 0),
      owner_partner_id: normalizeUuid(source.owner_partner_id) || null,
      children_policy: asNullableText(source.children_policy),
      minimum_child_age: source.minimum_child_age == null ? null : asInteger(source.minimum_child_age, -1),
      amenities: normalizeAmenities(source.amenities),
      cover_image_url: asNullableText(source.cover_image_url),
      photos: normalizeGallery(source.photos),
      guest_instructions_i18n: normalizeI18n(source.guest_instructions_i18n),
      check_in_instructions_i18n: normalizeI18n(source.check_in_instructions_i18n),
      check_out_instructions_i18n: normalizeI18n(source.check_out_instructions_i18n),
      internal_operational_notes: asNullableText(source.internal_operational_notes),
    };
    return Object.fromEntries(PROPERTY_CONTROL_BUSINESS_FIELDS.map((field) => [field, clone(state[field])]));
  }

  function reconcilePropertyControl(originalValue, currentValue, requestedValue) {
    const original = asObject(originalValue);
    const current = asObject(currentValue);
    const requested = asObject(requestedValue);
    const id = normalizeUuid(original.id);
    if (!id || normalizeUuid(current.id) !== id || normalizeUuid(requested.id) !== id) {
      throw new Error('Property conflict reconciliation requires one exact property relationship.');
    }
    const originalState = propertyControlBusinessState(original);
    const currentState = propertyControlBusinessState(current);
    const requestedState = propertyControlBusinessState(requested);
    const conflicts = [];
    const requestedChanges = [];
    const safeRebases = [];
    const merged = { ...clone(current) };
    PROPERTY_CONTROL_BUSINESS_FIELDS.forEach((field) => {
      const originalJson = JSON.stringify(originalState[field]);
      const currentJson = JSON.stringify(currentState[field]);
      const requestedJson = JSON.stringify(requestedState[field]);
      const changedByAdmin = requestedJson !== originalJson;
      const changedInDatabase = currentJson !== originalJson;
      if (changedByAdmin) requestedChanges.push(field);
      if (changedByAdmin && changedInDatabase && requestedJson !== currentJson) {
        conflicts.push({ field, original: clone(originalState[field]), current: clone(currentState[field]), requested: clone(requestedState[field]) });
        return;
      }
      if (changedByAdmin) {
        merged[field] = clone(requestedState[field]);
        if (changedInDatabase) safeRebases.push(field);
      }
    });
    return {
      safe: conflicts.length === 0,
      conflicts,
      requested_changes: requestedChanges,
      safe_rebases: safeRebases,
      merged,
    };
  }

  const OPERATIONAL_ASSIGNMENT_CONTRACT = 'hotels_v2_admin_b_operational_assignment_v1';

  function normalizeOperationalAssignmentSnapshot(contentControlValue, expectedHotelId = null) {
    const contentControl = asObject(contentControlValue);
    const hotelId = normalizeUuid(contentControl.hotel_id);
    const expected = normalizeUuid(expectedHotelId);
    const source = asObject(contentControl.assignment_snapshot);
    if (contentControl.contract_version !== 'hotels_v2_admin_b_content_control_v1'
        || !hotelId || (expected && expected !== hotelId)
        || !asText(source.snapshot_token) || !asText(source.assignment_fingerprint)) {
      throw new Error('A fresh exact-property operational-assignment snapshot is required.');
    }
    const assignments = asArray(source.assignments).map((entryValue) => {
      const entry = asObject(entryValue);
      const assignmentId = normalizeUuid(entry.assignment_id || entry.id);
      const partnerId = normalizeUuid(entry.partner_id || entry.partner?.id);
      if (!assignmentId || !partnerId) throw new Error('Operational-assignment snapshot contains a foreign or invalid relationship.');
      const rawStaffScopeIds = asArray(entry.staff_scope_ids);
      const staffScopeIds = rawStaffScopeIds.map(normalizeUuid);
      const staffScopeCount = asInteger(entry.staff_scope_count, -1);
      if (staffScopeCount < 0 || staffScopeIds.some((id) => !id)
          || new Set(staffScopeIds).size !== staffScopeIds.length
          || JSON.stringify([...staffScopeIds].sort()) !== JSON.stringify(staffScopeIds)
          || staffScopeIds.length !== staffScopeCount) {
        throw new Error('Operational-assignment snapshot contains an invalid exact staff-scope set.');
      }
      return {
        ...clone(entry),
        assignment_id: assignmentId,
        partner_id: partnerId,
        staff_scope_count: staffScopeCount,
        staff_scope_ids: staffScopeIds,
        permission_exists: entry.permission_exists === true,
      };
    });
    if (new Set(assignments.map((entry) => entry.assignment_id)).size !== assignments.length) {
      throw new Error('Operational-assignment snapshot contains duplicate exact assignment IDs.');
    }
    return {
      hotel_id: hotelId,
      snapshot_token: asText(source.snapshot_token),
      assignment_fingerprint: asText(source.assignment_fingerprint),
      assignments,
    };
  }

  function buildOperationalAssignmentPlan(contentControlValue, operationValue, options = {}) {
    const snapshot = normalizeOperationalAssignmentSnapshot(contentControlValue, options.hotelId);
    const operation = asObject(operationValue);
    const type = asText(operation.type);
    const assignmentId = normalizeUuid(operation.assignment_id);
    const partnerId = normalizeUuid(operation.partner_id);
    if (!['assign', 'remove'].includes(type) || !assignmentId || !partnerId) {
      throw new Error('Choose an exact Partner and operational-assignment action.');
    }
    const current = snapshot.assignments.find((entry) => entry.assignment_id === assignmentId);
    if (type === 'assign') {
      if (current || snapshot.assignments.some((entry) => entry.partner_id === partnerId)) {
        throw new Error('This Partner already has an exact operational assignment for the property.');
      }
    } else if (!current || current.partner_id !== partnerId) {
      throw new Error('The exact operational assignment is no longer present in this property snapshot.');
    }
    return {
      contract_version: OPERATIONAL_ASSIGNMENT_CONTRACT,
      hotel_id: snapshot.hotel_id,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      snapshot_token: snapshot.snapshot_token,
      expected_assignment_fingerprint: snapshot.assignment_fingerprint,
      operation: {
        type,
        assignment_id: assignmentId,
        partner_id: partnerId,
        expected_staff_scope_count: type === 'remove' ? current.staff_scope_count : 0,
        expected_staff_scope_ids: type === 'remove' ? clone(current.staff_scope_ids).sort() : [],
        expected_permission_exists: type === 'remove' ? current.permission_exists : false,
      },
    };
  }

  function h31BusinessState(value) {
    const normalized = normalizeH31Configuration(value);
    const byId = (rows, mapper) => Object.fromEntries(rows
      .slice()
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
      .map((entry) => [entry.id || `new:${entry.code || entry.source_type || ''}`, mapper(entry)]));
    return {
      minimum_stay_nights: normalized.property.minimum_stay_nights,
      pricing_schedules: byId(normalized.pricing_schedules, (entry) => ({
        minimum_billable_occupancy: entry.minimum_billable_occupancy,
      })),
      rate_plans: byId(normalized.rate_plans, (entry) => ({ price_inclusions: entry.price_inclusions })),
      allocation_rules: byId(normalized.allocation_rules, (entry) => ({
        code: entry.code,
        min_guest_count: entry.min_guest_count,
        max_guest_count: entry.max_guest_count,
        allocation_mode: entry.allocation_mode,
        is_active: entry.is_active,
        review_status: entry.review_status,
        sort_order: entry.sort_order,
        items: entry.items.map((item) => ({
          id: item.id,
          room_type_id: item.room_type_id,
          units_required: item.units_required,
          allocated_guest_count: item.allocated_guest_count,
          pricing_guest_count: item.pricing_guest_count,
          sort_order: item.sort_order,
        })),
      })),
      payment_policies: byId(normalized.payment_policies, (entry) => ({
        code: entry.code,
        name_i18n: entry.name_i18n,
        currency: entry.currency,
        is_active: entry.is_active,
        review_status: entry.review_status,
        terms: entry.terms.map((term) => ({
          id: term.id,
          due_event: term.due_event,
          amount_mode: term.amount_mode,
          amount_value: term.amount_value,
          recipient: term.recipient,
          payment_methods: term.payment_methods,
          instructions_i18n: term.instructions_i18n,
          sequence: term.sequence,
        })),
      })),
      commission_policies: byId(normalized.commission_policies, (entry) => ({
        code: entry.code,
        commission_mode: entry.commission_mode,
        amount: entry.amount,
        currency: entry.currency,
        is_active: entry.is_active,
        review_status: entry.review_status,
      })),
      calendar_sources: byId(normalized.calendar_sources, (entry) => ({
        code: entry.code,
        source_type: entry.source_type,
        room_type_id: entry.room_type_id,
        external_reference: entry.external_reference,
        is_enabled: entry.is_enabled,
        review_status: entry.review_status,
        priority: entry.priority,
        configuration: entry.configuration,
      })),
    };
  }

  function validateH31Configuration(value, workspace = null) {
    const normalized = normalizeH31Configuration(value);
    const propertyId = normalized.hotel_id || normalized.property.id;
    if (!propertyId) throw new Error('H3.1 configuration requires an exact property ID.');
    const requireUnique = (rows, keyFor, message) => {
      const keys = rows.map(keyFor).filter((key) => key != null && key !== '');
      if (new Set(keys).size !== keys.length) throw new Error(message);
    };
    const requireSameProperty = (rows, label) => rows.forEach((entry) => {
      if (entry.hotel_id && entry.hotel_id !== propertyId) throw new Error(`${label} belongs to another property.`);
    });
    if (normalized.property.minimum_stay_nights != null
        && (!Number.isInteger(normalized.property.minimum_stay_nights)
          || normalized.property.minimum_stay_nights < 1 || normalized.property.minimum_stay_nights > 365)) {
      throw new Error('Minimum stay must be between 1 and 365 nights.');
    }

    normalized.pricing_schedules.forEach((schedule) => {
      const maximumPartySize = Math.max(1, asInteger(schedule.maximum_party_size, 64));
      if (schedule.minimum_billable_occupancy != null
          && (!Number.isInteger(schedule.minimum_billable_occupancy)
          || schedule.minimum_billable_occupancy < 1 || schedule.minimum_billable_occupancy > maximumPartySize)) {
        throw new Error(`Every pricing schedule needs a minimum billable occupancy between 1 and ${maximumPartySize}.`);
      }
    });
    normalized.rate_plans.forEach((plan) => {
      if (plan.price_inclusions.some((code) => !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(code))) {
        throw new Error('Rate Plan inclusion codes must use normalized lowercase letters, numbers, hyphens or underscores.');
      }
    });

    const normalizedWorkspace = workspace ? normalizeWorkspace(workspace) : null;
    const roomMap = new Map(asArray(normalizedWorkspace?.room_types).map((room) => [room.id, room]));
    const activeRules = normalized.allocation_rules.filter((rule) => rule.is_active);
    requireSameProperty(normalized.allocation_rules, 'An allocation rule');
    requireUnique(normalized.allocation_rules, (rule) => rule.id, 'Allocation rule IDs must be unique.');
    requireUnique(normalized.allocation_rules, (rule) => rule.code, 'Allocation rule codes must be unique per property.');
    normalized.allocation_rules.forEach((rule) => {
      if (!rule.id) throw new Error('Every allocation rule requires an exact UUID.');
      validateCode(rule.code, 'Allocation rule code');
      if (!H3_REVIEW_STATUSES.includes(rule.review_status)) throw new Error('Allocation rule review status is invalid.');
      if (rule.is_active && rule.review_status !== 'reviewed') throw new Error('Every active allocation rule must be reviewed.');
      if (!Number.isInteger(rule.min_guest_count) || !Number.isInteger(rule.max_guest_count)
          || rule.min_guest_count < 1 || rule.min_guest_count > rule.max_guest_count || rule.max_guest_count > 50) {
        throw new Error('Every allocation rule needs a valid guest range.');
      }
      if (rule.allocation_mode === 'required_bundle' && rule.min_guest_count !== rule.max_guest_count) {
        throw new Error('A required Room Type bundle must be an exact guest-count rule.');
      }
      if (!Number.isInteger(rule.sort_order) || rule.sort_order < 0) throw new Error('Allocation rule order cannot be negative.');
      if (rule.review_status === 'reviewed' && !rule.items.length) {
        throw new Error('Every reviewed allocation rule needs at least one exact Room Type.');
      }
      if (rule.review_status === 'reviewed' && rule.allocation_mode === 'customer_choice' && rule.items.length < 2) {
        throw new Error('A reviewed customer-choice rule needs at least two exact Room Type options.');
      }
      if (rule.review_status === 'reviewed' && rule.allocation_mode === 'required_bundle'
          && rule.items.reduce((total, item) => total + item.units_required, 0) < 2) {
        throw new Error('A reviewed required bundle needs at least two allocated room units.');
      }
      if (new Set(rule.items.map((item) => item.room_type_id)).size !== rule.items.length) {
        throw new Error('An allocation rule cannot contain the same Room Type twice.');
      }
      requireUnique(rule.items, (item) => item.id, 'Allocation item IDs must be unique.');
      rule.items.forEach((item) => {
        if (!item.id) throw new Error('Every reviewed allocation item requires an exact UUID.');
        const room = roomMap.get(item.room_type_id);
        if (normalizedWorkspace && !room) throw new Error('An allocation rule references a Room Type outside this property.');
        if (!Number.isInteger(item.units_required) || item.units_required < 1) throw new Error('Allocated Room Type quantity must be at least 1.');
        if (rule.allocation_mode === 'customer_choice' && item.units_required !== 1) {
          throw new Error('A customer-choice option must represent one exact Room Type.');
        }
        if (rule.allocation_mode === 'customer_choice'
            && (item.allocated_guest_count != null || item.pricing_guest_count != null)) {
          throw new Error('Customer-choice options use the requested occupancy and must not store a fixed physical or pricing split.');
        }
        if (!Number.isInteger(item.sort_order) || item.sort_order < 0) throw new Error('Allocation item order cannot be negative.');
        if (room && rule.is_active) {
          const inventory = room.inventory_mode === 'unitized'
            ? normalizedWorkspace.units.filter((unit) => unit.room_type_id === room.id && unit.status === 'active').length
            : room.base_inventory_count;
          if (room.status !== 'active' || item.units_required > inventory) {
            throw new Error(`${i18nText(room.name_i18n, 'en', room.code)} does not have enough active configured inventory for this allocation.`);
          }
        }
      });
      if (normalizedWorkspace && rule.items.length) {
        if (rule.allocation_mode === 'customer_choice') {
          const insufficient = rule.items.some((item) => roomMap.get(item.room_type_id)?.effective_max_occupancy < rule.max_guest_count);
          if (insufficient) throw new Error('Every customer-choice Room Type must hold the entire selected guest range.');
        } else {
          if (rule.items.some((item) => !Number.isInteger(item.allocated_guest_count) || item.allocated_guest_count < 1)) {
            throw new Error('Every required bundle item needs an exact allocated guest count.');
          }
          const pricingOccupancies = rule.items.map((item) => item.pricing_guest_count);
          const pricingPending = pricingOccupancies.every((value) => value == null);
          const pricingReviewed = pricingOccupancies.every((value) => Number.isInteger(value) && value >= 1);
          if (!pricingPending && !pricingReviewed) {
            throw new Error('Required bundle pricing occupancy must be entirely pending or entirely reviewed.');
          }
          const allocatedGuests = rule.items.reduce((total, item) => total + item.allocated_guest_count, 0);
          if (rule.review_status === 'reviewed' && allocatedGuests !== rule.min_guest_count) {
            throw new Error('Required bundle guest allocations must equal the exact rule guest count.');
          }
          const overCapacity = rule.items.some((item) => (
            item.allocated_guest_count > (roomMap.get(item.room_type_id)?.effective_max_occupancy || 0) * item.units_required
          ));
          if (overCapacity) throw new Error('A required bundle allocates more guests than a Room Type can hold.');
          const pricingOverCapacity = pricingReviewed && rule.items.some((item) => (
            item.pricing_guest_count > (roomMap.get(item.room_type_id)?.effective_max_occupancy || 0) * item.units_required
          ));
          if (pricingOverCapacity) throw new Error('A required bundle pricing occupancy exceeds a Room Type capacity.');
          const capacity = rule.items.reduce((total, item) => (
            total + (roomMap.get(item.room_type_id)?.effective_max_occupancy || 0) * item.units_required
          ), 0);
          if (capacity < rule.max_guest_count) throw new Error('The required Room Type bundle cannot hold the selected guest range.');
        }
      }
    });
    const sortedRanges = activeRules.map((rule) => [rule.min_guest_count, rule.max_guest_count]).sort((a, b) => a[0] - b[0]);
    sortedRanges.forEach((range, index) => {
      if (index && range[0] <= sortedRanges[index - 1][1]) throw new Error('Active guest allocation ranges cannot overlap.');
      if (!index && range[0] !== 1) throw new Error('Active guest allocation must begin at one guest.');
      if (index && range[0] !== sortedRanges[index - 1][1] + 1) throw new Error('Active guest allocation ranges cannot contain an uncovered guest-count gap.');
    });

    const activePaymentPolicies = normalized.payment_policies.filter((policy) => policy.is_active);
    if (activePaymentPolicies.length > 1) throw new Error('At most one reviewed payment policy may be active.');
    requireSameProperty(normalized.payment_policies, 'A payment policy');
    requireUnique(normalized.payment_policies, (policy) => policy.id, 'Payment policy IDs must be unique.');
    requireUnique(normalized.payment_policies, (policy) => policy.code, 'Payment policy codes must be unique per property.');
    normalized.payment_policies.forEach((policy) => {
      if (!policy.id) throw new Error('Every payment policy requires an exact UUID.');
      validateCode(policy.code, 'Payment policy code');
      if (!/^[A-Z]{3}$/.test(policy.currency)) throw new Error('Payment policy currency must be a three-letter code.');
      if (!H3_REVIEW_STATUSES.includes(policy.review_status)) throw new Error('Payment policy review status is invalid.');
      if (policy.is_active && policy.review_status !== 'reviewed') throw new Error('The active payment policy must be reviewed.');
      if (policy.review_status === 'reviewed' && !policy.terms.length) {
        throw new Error('A reviewed payment policy needs at least one reviewed term.');
      }
      const sequences = policy.terms.map((term) => term.sequence);
      if (new Set(sequences).size !== sequences.length) throw new Error('Payment terms need a unique order.');
      requireUnique(policy.terms, (term) => term.id, 'Payment term IDs must be unique.');
      policy.terms.forEach((term) => {
        if (!term.id) throw new Error('Every reviewed payment term requires an exact UUID.');
        if (!Number.isInteger(term.sequence) || term.sequence < 1) throw new Error('Every payment term needs a valid sequence.');
        if (!term.payment_methods.length) throw new Error('Every payment term needs at least one payment method.');
        if (term.amount_mode === 'percent_total'
            && (!Number.isFinite(term.amount_value) || term.amount_value <= 0 || term.amount_value > 100)) {
          throw new Error('A percent payment term must be greater than 0 and at most 100.');
        }
        if (term.amount_mode === 'flat' && (!Number.isFinite(term.amount_value) || term.amount_value < 0)) {
          throw new Error('A flat payment term cannot be negative.');
        }
        if (term.amount_mode === 'remaining_balance' && term.amount_value != null) {
          throw new Error('Remaining balance does not accept a separate amount.');
        }
      });
      const remainingCount = policy.terms.filter((term) => term.amount_mode === 'remaining_balance').length;
      const percentTotal = policy.terms.filter((term) => term.amount_mode === 'percent_total')
        .reduce((total, term) => total + term.amount_value, 0);
      const remainingTerm = policy.terms.find((term) => term.amount_mode === 'remaining_balance');
      const finalSequence = policy.terms.reduce((maximum, term) => Math.max(maximum, term.sequence), 0);
      if (remainingCount > 1 || percentTotal > 100
          || (remainingTerm && remainingTerm.sequence !== finalSequence)) {
        throw new Error('A remaining balance step must be unique, follow less than 100% scheduled payment, and be the final payment step.');
      }
      const fullPercentSchedule = percentTotal === 100 && remainingCount === 0;
      const partialThenRemainder = percentTotal < 100 && remainingCount === 1;
      if ((remainingCount === 1 && percentTotal >= 100)
          || (policy.review_status === 'reviewed' && !fullPercentSchedule && !partialThenRemainder)) {
        throw new Error('Reviewed payment terms must be either 100% scheduled with no remainder, or less than 100% followed by one final remaining balance step.');
      }
    });

    const activeCommissionPolicies = normalized.commission_policies.filter((policy) => policy.is_active);
    if (activeCommissionPolicies.length > 1) throw new Error('At most one reviewed commission policy may be active.');
    requireSameProperty(normalized.commission_policies, 'A commission policy');
    requireUnique(normalized.commission_policies, (policy) => policy.id, 'Commission policy IDs must be unique.');
    requireUnique(normalized.commission_policies, (policy) => policy.code, 'Commission policy codes must be unique per property.');
    normalized.commission_policies.forEach((policy) => {
      if (!policy.id) throw new Error('Every commission policy requires an exact UUID.');
      validateCode(policy.code, 'Commission policy code');
      if (!H3_REVIEW_STATUSES.includes(policy.review_status)) throw new Error('Commission policy review status is invalid.');
      if (policy.is_active && policy.review_status !== 'reviewed') throw new Error('The active commission policy must be reviewed.');
      if (!HOTEL_COMMISSION_MODES.includes(policy.commission_mode)) throw new Error('Commission mode is invalid.');
      if (!Number.isFinite(policy.amount) || policy.amount < 0) throw new Error('Commission amount cannot be negative.');
      if (policy.commission_mode === 'percent_booking_total' && policy.amount > 100) {
        throw new Error('Percentage commission cannot exceed 100%.');
      }
      if (!/^[A-Z]{3}$/.test(policy.currency)) throw new Error('Commission currency must be a three-letter code.');
    });

    const enabledSources = normalized.calendar_sources.filter((source) => source.is_enabled);
    if (enabledSources.length > 1 || (enabledSources.length === 1 && enabledSources[0].source_type !== 'manual')) {
      throw new Error('H3.1 permits at most one enabled manual Calendar source; external providers remain disabled.');
    }
    requireSameProperty(normalized.calendar_sources, 'A Calendar source');
    requireUnique(normalized.calendar_sources, (source) => source.id, 'Calendar source IDs must be unique.');
    requireUnique(normalized.calendar_sources, (source) => source.code, 'Calendar source codes must be unique per property.');
    normalized.calendar_sources.forEach((source) => {
      if (!source.id) throw new Error('Every Calendar source configuration requires an exact UUID.');
      validateCode(source.code, 'Calendar source code');
      if (!H3_REVIEW_STATUSES.includes(source.review_status)) throw new Error('Calendar source review status is invalid.');
      if (source.is_enabled && source.review_status !== 'reviewed') throw new Error('The enabled Calendar source must be reviewed.');
      if (source.source_type !== 'manual' && source.is_enabled) throw new Error('External Calendar sources are disabled in H3.1.');
      if (source.room_type_id && normalizedWorkspace && !roomMap.has(source.room_type_id)) {
        throw new Error('A Calendar source references a Room Type outside this property.');
      }
      if (!Number.isInteger(source.priority) || source.priority < -32768 || source.priority > 32767) {
        throw new Error('Calendar source priority is outside the supported range.');
      }
    });
    return normalized;
  }

  function reconcileH31Configuration(originalValue, currentValue, targetValue) {
    const original = h31BusinessState(originalValue);
    const current = h31BusinessState(currentValue);
    const target = h31BusinessState(targetValue);
    const conflicts = [];
    Object.keys(target).forEach((field) => {
      const originalJson = JSON.stringify(original[field]);
      const currentJson = JSON.stringify(current[field]);
      const targetJson = JSON.stringify(target[field]);
      if (currentJson !== originalJson && currentJson !== targetJson) {
        conflicts.push({ field, original: clone(original[field]), current: clone(current[field]), target: clone(target[field]) });
      }
    });
    return { safe: conflicts.length === 0, conflicts, target: normalizeH31Configuration(targetValue) };
  }

  function buildH31ConfigurationPlan(currentValue, targetValue, workspace = null, options = {}) {
    const current = normalizeH31Configuration(currentValue);
    const target = validateH31Configuration(targetValue, workspace);
    const hotelId = current.hotel_id || current.property.id;
    if (!hotelId || (target.hotel_id || target.property.id) !== hotelId) {
      throw new Error('Reviewed H3.1 configuration belongs to a different property.');
    }
    const operations = [];
    if (current.property.minimum_stay_nights !== target.property.minimum_stay_nights) {
      operations.push({
        entity: 'property_configuration', type: 'update', id: hotelId, expected_version: 0,
        payload: { minimum_stay_nights: target.property.minimum_stay_nights },
      });
    }

    function addVersionedOperations(entity, currentRows, targetRows, payloadFor, fingerprintField = null) {
      const currentById = new Map(currentRows.map((entry) => [entry.id, entry]));
      const targetById = new Map(targetRows.map((entry) => [entry.id, entry]));
      targetRows.forEach((entry) => {
        if (!entry.id) throw new Error(`Every reviewed ${entity} requires an exact UUID.`);
        const before = currentById.get(entry.id);
        const payload = payloadFor(entry);
        const beforePayload = before ? payloadFor(before) : null;
        if (before && JSON.stringify(beforePayload) === JSON.stringify(payload)) return;
        const operation = {
          entity,
          type: before ? 'update' : 'create',
          id: entry.id,
          expected_version: before ? before.version : 0,
          payload,
        };
        if (before && fingerprintField) operation.expected_children_fingerprint = before[fingerprintField] || null;
        operations.push(operation);
      });
      currentRows.filter((entry) => !targetById.has(entry.id)).forEach((entry) => {
        const operation = {
          entity, type: 'disable', id: entry.id, expected_version: entry.version, payload: {},
        };
        if (fingerprintField) operation.expected_children_fingerprint = entry[fingerprintField] || null;
        operations.push(operation);
      });
    }

    function addExistingOnlyUpdates(entity, currentRows, targetRows, payloadFor) {
      const currentById = new Map(currentRows.map((entry) => [entry.id, entry]));
      const targetIds = new Set(targetRows.map((entry) => entry.id));
      if (currentRows.length !== targetRows.length || currentRows.some((entry) => !targetIds.has(entry.id))) {
        throw new Error(`${entity} membership cannot be created, removed or disabled through H3.1 booking setup.`);
      }
      targetRows.forEach((entry) => {
        const before = currentById.get(entry.id);
        if (!before) throw new Error(`${entity} belongs outside the fresh exact property snapshot.`);
        const payload = payloadFor(entry);
        if (JSON.stringify(payloadFor(before)) === JSON.stringify(payload)) return;
        operations.push({
          entity, type: 'update', id: entry.id, expected_version: before.version, payload,
        });
      });
    }

    addExistingOnlyUpdates('pricing_schedule', current.pricing_schedules, target.pricing_schedules, (entry) => ({
      minimum_billable_occupancy: entry.minimum_billable_occupancy,
    }));
    addExistingOnlyUpdates('rate_plan', current.rate_plans, target.rate_plans, (entry) => ({
      price_inclusions: entry.price_inclusions,
    }));
    addVersionedOperations('allocation_rule', current.allocation_rules, target.allocation_rules, (entry) => ({
      code: entry.code,
      min_guest_count: entry.min_guest_count,
      max_guest_count: entry.max_guest_count,
      allocation_mode: entry.allocation_mode,
      is_active: entry.is_active,
      review_status: entry.review_status,
      sort_order: entry.sort_order,
      items: entry.items.map((item) => ({
        id: item.id,
        room_type_id: item.room_type_id,
        units_required: item.units_required,
        allocated_guest_count: item.allocated_guest_count,
        pricing_guest_count: item.pricing_guest_count,
        sort_order: item.sort_order,
      })),
    }), 'items_fingerprint');
    addVersionedOperations('payment_policy', current.payment_policies, target.payment_policies, (entry) => ({
      code: entry.code,
      name_i18n: entry.name_i18n,
      currency: entry.currency,
      is_active: entry.is_active,
      review_status: entry.review_status,
      terms: entry.terms.map((term) => ({
        id: term.id,
        due_event: term.due_event,
        amount_mode: term.amount_mode,
        amount_value: term.amount_value,
        recipient: term.recipient,
        payment_methods: term.payment_methods,
        instructions_i18n: term.instructions_i18n,
        sequence: term.sequence,
      })),
    }), 'terms_fingerprint');
    addVersionedOperations('commission_policy', current.commission_policies, target.commission_policies, (entry) => ({
      code: entry.code,
      commission_mode: entry.commission_mode,
      amount: entry.amount,
      currency: entry.currency,
      is_active: entry.is_active,
      review_status: entry.review_status,
    }));
    addVersionedOperations('calendar_source', current.calendar_sources, target.calendar_sources, (entry) => ({
      code: entry.code,
      source_type: entry.source_type,
      room_type_id: entry.room_type_id,
      external_reference: entry.external_reference,
      is_enabled: entry.is_enabled,
      review_status: entry.review_status,
      priority: entry.priority,
      configuration: entry.configuration,
    }));
    if (!operations.length) throw new Error('There are no reviewed H3.1 configuration changes to save.');
    return {
      hotel_id: hotelId,
      expected_property_updated_at: options.expectedPropertyUpdatedAt || current.property.updated_at || null,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      operations,
    };
  }

  function deriveH31Readiness(value, workspace = null) {
    const normalized = normalizeH31Configuration(value);
    const normalizedWorkspace = workspace ? normalizeWorkspace(workspace) : null;
    const blockers = [];
    const warnings = [];
    try { validateH31Configuration(normalized, workspace); } catch (error) { blockers.push(error.message); }
    if (normalizedWorkspace?.property?.booking_mode !== 'request_confirmation') {
      blockers.push('H3 shadow launch requires request-confirmation booking mode.');
    }
    if (!Number.isInteger(normalized.property.minimum_stay_nights)) blockers.push('Review the property minimum stay.');
    const propertyId = normalizeUuid(normalizedWorkspace?.property?.id);
    const checkIn = asText(normalizedWorkspace?.property?.check_in_from).slice(0, 5);
    const checkOut = asText(normalizedWorkspace?.property?.check_out_until).slice(0, 5);
    if (propertyId === SEVEN_ARCHES_PROPERTY_ID) {
      if (checkIn !== SEVEN_ARCHES_CHECK_IN_FROM) {
        blockers.push(`Review and save 7 Kamares check-in ${SEVEN_ARCHES_CHECK_IN_FROM} in Overview.`);
      }
      if (checkOut !== SEVEN_ARCHES_CHECK_OUT_UNTIL) {
        blockers.push(`Review and save 7 Kamares check-out ${SEVEN_ARCHES_CHECK_OUT_UNTIL} in Overview.`);
      }
    } else {
      if (!checkIn) blockers.push('Configure property check-in time in Overview.');
      if (!checkOut) blockers.push('Configure property check-out time in Overview.');
    }
    if (normalizedWorkspace) {
      const rooms = normalizedWorkspace.room_types.filter((room) => room.status !== 'disabled');
      rooms.forEach((room) => {
        try { resolveChildrenPolicy(normalizedWorkspace.property, room); } catch (_error) {
          blockers.push(`${i18nText(room.name_i18n, 'en', room.code)} needs a valid effective children policy.`);
        }
      });
      const ownerId = normalizeUuid(normalizedWorkspace.property.owner_partner_id);
      const owner = asObject(normalizedWorkspace.property.owner_partner);
      if (!ownerId || owner.id !== ownerId || owner.status !== 'active' || owner.can_manage_hotels !== true) {
        blockers.push('Confirm an active exact commercial Hotel owner before H3 activation.');
      }
      const operational = normalizedWorkspace.operational_partners.filter((entry) => (
        entry.status === 'active' && entry.can_manage_hotels === true && entry.is_active !== false
      ));
      if (operational.length !== 1) blockers.push('Exactly one unambiguous active operational Hotel partner route is required.');
      const activeRatePlans = normalizedWorkspace.rate_plans.filter((plan) => plan.is_active);
      if (!activeRatePlans.length) blockers.push('Activate one reviewed Rate Plan before H3 activation.');
      if (activeRatePlans.some((plan) => plan.cancellation_policy?.type === 'requires_review')) {
        blockers.push('Confirm cancellation terms for every active Rate Plan before H3 activation.');
      }
      if (activeRatePlans.some((plan) => plan.booking_mode_override
          && plan.booking_mode_override !== 'request_confirmation')) {
        blockers.push('Active Rate Plans must preserve request-confirmation mode for H3 shadow testing.');
      }
      if (!normalizedWorkspace.room_rates.some((rate) => rate.is_active)) blockers.push('Activate the reviewed Room Rate products before H3 activation.');
    }
    if (!normalized.pricing_schedules.length) blockers.push('Configure at least one exact pricing schedule.');
    if (normalized.pricing_schedules.some((schedule) => !Number.isInteger(schedule.minimum_billable_occupancy))) {
      blockers.push('Review minimum billable occupancy for every pricing schedule.');
    }
    if (!normalized.allocation_rules.some((rule) => rule.is_active)) blockers.push('Configure reviewed guest-to-room allocation rules.');
    if (normalized.allocation_rules.some((rule) => (
      rule.is_active && rule.allocation_mode === 'required_bundle'
      && rule.items.some((item) => item.pricing_guest_count == null)
    ))) {
      blockers.push('Complete the dedicated legacy pricing Review before H3 shadow pricing can be ready.');
    }
    const ranges = normalized.allocation_rules.filter((rule) => rule.is_active)
      .map((rule) => [rule.min_guest_count, rule.max_guest_count]).sort((a, b) => a[0] - b[0]);
    if (ranges.length && ranges[0][0] !== 1) blockers.push('Guest allocation must begin at one guest.');
    if (ranges.some((range, index) => index > 0 && range[0] !== ranges[index - 1][1] + 1)) {
      blockers.push('Guest allocation ranges contain an uncovered guest-count gap.');
    }
    const activePaymentPolicies = normalized.payment_policies.filter((policy) => policy.is_active);
    if (!activePaymentPolicies.length) blockers.push('Configure reviewed customer payment terms.');
    if (activePaymentPolicies.some((policy) => policy.terms.some((term) => (
      term.recipient === 'partner'
      && term.payment_methods.includes('bank_transfer')
      && !Object.values(term.instructions_i18n).some((instruction) => asText(instruction))
    )))) {
      blockers.push('Add reviewed partner bank-transfer instructions before H3 shadow booking can be operational.');
    }
    if (!normalized.commission_policies.some((policy) => policy.is_active)) blockers.push('Configure a separate platform commission policy.');
    const enabledManual = normalized.calendar_sources.some((source) => source.source_type === 'manual' && source.is_enabled);
    if (!enabledManual) blockers.push('Enable the manual Calendar source for shadow request-confirmation testing.');
    const requiredOffFlags = ['hotel_rooms_v2_enabled', 'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled'];
    const unsafeFlags = requiredOffFlags.filter((key) => normalized.flags[key] !== false);
    if (typeof normalized.flags.hotel_external_sync_enabled !== 'boolean') {
      blockers.push('The External Calendar activation flag must be an exact boolean.');
    }
    if (unsafeFlags.length) blockers.push(`Public Hotels V2 capability flags must be present and OFF: ${unsafeFlags.join(', ')}.`);
    if (workspace?.property?.architecture_version === 'legacy') {
      warnings.push('This is shadow configuration. Legacy pricing and public booking remain authoritative.');
    }
    return {
      state: blockers.length ? 'BLOCKED' : 'READY_FOR_H3_SHADOW',
      blockers: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings)),
      public_live: false,
    };
  }

  function buildRoomTypePlan(workspace, operation, options = {}) {
    const normalized = normalizeWorkspace(workspace);
    const reviewedOperation = clone(operation);
    if (!normalized.property.id || reviewedOperation?.entity !== 'room_type'
        || !normalizeUuid(reviewedOperation?.id)
        || !['create', 'update', 'disable', 'duplicate'].includes(asText(reviewedOperation?.type))) {
      throw new Error('A reviewed exact Room Type operation is required.');
    }
    const expectedVersion = reviewedOperation.type === 'create'
      ? 0
      : asInteger(reviewedOperation.expected_version, -1);
    if (expectedVersion < 0 || (reviewedOperation.type !== 'create' && expectedVersion < 1)) {
      throw new Error('The reviewed Room Type operation is missing its optimistic version.');
    }
    const operationType = asText(reviewedOperation.type);
    const originalRoom = operationType === 'create'
      ? null
      : normalized.room_types.find((room) => room.id === normalizeUuid(
        operationType === 'duplicate' ? reviewedOperation.payload?.source_id : reviewedOperation.id,
      ));
    let payload = clone(reviewedOperation.payload || {});
    let expectedOriginal = {};
    if (operationType === 'update') {
      if (!originalRoom) throw new Error('The reviewed exact Room Type no longer exists in this property snapshot.');
      const originalState = roomControlBusinessState(originalRoom);
      const requestedState = roomControlBusinessState({ ...originalRoom, ...payload });
      payload = {};
      ROOM_CONTROL_BUSINESS_FIELDS.forEach((field) => {
        if (JSON.stringify(requestedState[field]) === JSON.stringify(originalState[field])) return;
        payload[field] = clone(requestedState[field]);
        expectedOriginal[field] = clone(originalState[field]);
      });
      const capacityFields = ['max_occupancy', 'capacity_adults', 'capacity_children'];
      if (capacityFields.some((field) => Object.prototype.hasOwnProperty.call(payload, field))) {
        capacityFields.forEach((field) => {
          payload[field] = clone(requestedState[field]);
          expectedOriginal[field] = clone(originalState[field]);
        });
      }
      if (!Object.keys(payload).length) throw new Error('There are no Room Type changes to review.');
    } else if (operationType === 'disable') {
      if (!originalRoom) throw new Error('The reviewed exact Room Type no longer exists in this property snapshot.');
      payload = {};
      expectedOriginal = { status: originalRoom.status };
    }
    return {
      contract_version: 'hotels_v2_admin_b_room_control_v1',
      hotel_id: normalized.property.id,
      expected_property_updated_at: options.expectedPropertyUpdatedAt || normalized.property.updated_at || null,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      operation: {
        type: reviewedOperation.type,
        id: normalizeUuid(reviewedOperation.id),
        expected_version: expectedVersion,
        expected_original: expectedOriginal,
        payload,
      },
    };
  }

  const ROOM_CONTROL_BUSINESS_FIELDS = Object.freeze([
    'code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults', 'capacity_children',
    'max_occupancy', 'children_policy_override', 'minimum_child_age_override', 'bed_configuration',
    'bathrooms', 'size_sqm', 'floor_label_i18n', 'amenities', 'inventory_mode',
    'base_inventory_count', 'status', 'sort_order',
  ]);

  function roomControlBusinessState(value) {
    const room = normalizeRoomType(value);
    return Object.fromEntries(ROOM_CONTROL_BUSINESS_FIELDS.map((field) => [field, clone(room[field])]));
  }

  function reconcileRoomControl(originalValue, currentValue, requestedValue) {
    const original = normalizeRoomType(originalValue);
    const current = normalizeRoomType(currentValue);
    const requested = normalizeRoomType(requestedValue);
    if (!original.id || current.id !== original.id || requested.id !== original.id
        || current.hotel_id !== original.hotel_id || requested.hotel_id !== original.hotel_id) {
      throw new Error('Room conflict reconciliation requires one exact Room Type relationship.');
    }
    const originalState = roomControlBusinessState(original);
    const currentState = roomControlBusinessState(current);
    const requestedState = roomControlBusinessState(requested);
    const conflicts = [];
    const requestedChanges = [];
    const safeRebases = [];
    const merged = { ...clone(current) };
    ROOM_CONTROL_BUSINESS_FIELDS.forEach((field) => {
      const originalJson = JSON.stringify(originalState[field]);
      const currentJson = JSON.stringify(currentState[field]);
      const requestedJson = JSON.stringify(requestedState[field]);
      const changedByAdmin = requestedJson !== originalJson;
      const changedInDatabase = currentJson !== originalJson;
      if (changedByAdmin) requestedChanges.push(field);
      if (changedByAdmin && changedInDatabase && requestedJson !== currentJson) {
        conflicts.push({
          field,
          original: clone(originalState[field]),
          current: clone(currentState[field]),
          requested: clone(requestedState[field]),
        });
        return;
      }
      if (changedByAdmin) {
        merged[field] = clone(requestedState[field]);
        if (changedInDatabase) safeRebases.push(field);
      }
    });
    return {
      safe: conflicts.length === 0,
      conflicts,
      requested_changes: requestedChanges,
      safe_rebases: safeRebases,
      merged: normalizeRoomType(merged),
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
    const propertyGallery = new Set(normalized.property.photos);
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
      // Exact Room uploads are owned by their source Room path. A duplicate may
      // retain only media that is also an exact shared property photo; target-
      // foreign Room objects, units and products are never copied implicitly.
      gallery: original.gallery.filter((url) => propertyGallery.has(url)),
      status: 'draft',
      // A duplicate is content/structure only. Inventory is operational state
      // and must be configured explicitly for the new draft before activation.
      inventory_mode: 'pooled',
      base_inventory_count: 0,
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

  function hasExactKeys(value, keys) {
    const expected = [...keys].sort();
    const actual = Object.keys(asObject(value)).sort();
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  function isExactInteger(value, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) {
    return typeof value === 'number'
      && Number.isSafeInteger(value)
      && value >= minimum
      && value <= maximum;
  }

  function isExactNumber(value, minimum = -Number.MAX_VALUE, maximum = Number.MAX_VALUE) {
    return typeof value === 'number'
      && Number.isFinite(value)
      && value >= minimum
      && value <= maximum;
  }

  function isExactMoney(value, minimum = 0, maximum = 9999999999.99) {
    return isExactNumber(value, minimum, maximum)
      && Number(value.toFixed(2)) === value;
  }

  function isExactIsoDate(value) {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
  }

  function isExactIsoTimestamp(value) {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
    if (!match || !isExactIsoDate(match[1])) return false;
    const hour = Number(match[2]);
    const minute = Number(match[3]);
    const second = Number(match[4]);
    if (hour > 23 || minute > 59 || second > 59) return false;
    if (match[5] === 'Z') return true;
    const offsetHour = Number(match[6]);
    const offsetMinute = Number(match[7]);
    return offsetHour <= 14 && offsetMinute <= 59
      && (offsetHour < 14 || offsetMinute === 0);
  }

  function isExactFingerprint(value, nullable = true) {
    return (nullable && value === null)
      || (typeof value === 'string' && /^[0-9a-f]{32}$/.test(value));
  }

  function isExactSnapshotToken(value) {
    return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  }

  function isExactHttpsUrl(value) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 2048
        || value !== value.trim() || /[\s\u0000-\u001f\u007f]/u.test(value)) return false;
    try {
      const parsed = new URL(value, 'https://cypruseye.com');
      return parsed.protocol === 'https:' && Boolean(parsed.hostname)
        && !parsed.username && !parsed.password;
    } catch (_error) {
      return false;
    }
  }

  function jsonUtf8ByteLength(value) {
    try {
      return encodeURIComponent(JSON.stringify(value)).replace(/%[0-9a-f]{2}/gi, 'x').length;
    } catch (_error) {
      return Number.POSITIVE_INFINITY;
    }
  }

  function isExactI18n(value, maximumLength = 20000) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.every((key) => LANGUAGES.includes(key))
      && keys.every((key) => typeof value[key] === 'string'
        && value[key] === value[key].trim()
        && value[key].length >= 1 && value[key].length <= maximumLength
        && !/[\u0000-\u001f\u007f]/.test(value[key]));
  }

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function exactCanonicalUuid(value) {
    return typeof value === 'string' && normalizeUuid(value) === value;
  }

  function exactNullableText(value, maximum) {
    return value === null || (typeof value === 'string' && value === value.trim()
      && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value));
  }

  function exactProposalUrl(value) {
    if (value === null) return true;
    if (typeof value !== 'string' || value !== value.trim() || value.length < 1 || value.length > 2048
        || /[\s\u0000-\u001f\u007f]/u.test(value)) return false;
    try {
      const parsed = new URL(value);
      return ['https:', 'http:'].includes(parsed.protocol) && Boolean(parsed.hostname)
        && !parsed.username && !parsed.password;
    } catch (_error) { return false; }
  }

  function exactProposalI18n(value, maximum, requireEnglish = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.every((key) => LANGUAGES.includes(key))
      && keys.every((key) => typeof value[key] === 'string' && value[key] === value[key].trim()
        && value[key].length >= 1 && value[key].length <= maximum)
      && (!requireEnglish || (typeof value.en === 'string' && value.en.length > 0));
  }

  function validatePartnerPropertyProposalContent(value) {
    if (!hasExactKeys(value, [
      'title_i18n', 'description_i18n', 'city', 'address_line', 'district', 'postal_code',
      'country', 'latitude', 'longitude', 'google_maps_url', 'amenities', 'check_in_from',
      'check_out_until',
    ]) || !exactProposalI18n(value.title_i18n, 240, true)
      || !exactProposalI18n(value.description_i18n, 12000)
      || !exactNullableText(value.city, 200) || !exactNullableText(value.address_line, 500)
      || !exactNullableText(value.district, 200) || !exactNullableText(value.postal_code, 40)
      || !exactNullableText(value.country, 100)
      || !(value.google_maps_url === null || isSupportedGoogleMapsUrl(value.google_maps_url))
      || (value.latitude !== null && !isExactNumber(value.latitude, -90, 90))
      || (value.longitude !== null && !isExactNumber(value.longitude, -180, 180))
      || !Array.isArray(value.amenities) || value.amenities.length > 200
      || value.amenities.some((entry) => typeof entry !== 'string' || entry !== entry.trim() || !entry || entry.length > 160)
      || new Set(value.amenities).size !== value.amenities.length
      || !(value.check_in_from === null || (typeof value.check_in_from === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value.check_in_from)))
      || !(value.check_out_until === null || (typeof value.check_out_until === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value.check_out_until)))) {
      throw new Error('Partner property proposal content is not an exact safe Admin projection.');
    }
    return clone(value);
  }

  function validatePartnerPropertyProposalPhotos(value) {
    if (!hasExactKeys(value, ['cover_image_url', 'photos']) || !exactProposalUrl(value.cover_image_url)
        || !Array.isArray(value.photos) || value.photos.length > 50
        || value.photos.some((entry) => !exactProposalUrl(entry))
        || new Set(value.photos).size !== value.photos.length
        || (value.cover_image_url !== null && !value.photos.includes(value.cover_image_url))) {
      throw new Error('Partner property proposal photos are not an exact safe Admin projection.');
    }
    return clone(value);
  }

  function validatePartnerPropertyProposal(row, hotelId) {
    if (!hasExactKeys(row, [
      'id', 'assignment_id', 'partner_id', 'hotel_id', 'status', 'version',
      'source_property_updated_at', 'content', 'photos', 'created_at', 'updated_at',
    ]) || !exactCanonicalUuid(row.id) || !exactCanonicalUuid(row.assignment_id)
      || !exactCanonicalUuid(row.partner_id) || row.hotel_id !== hotelId
      || row.status !== 'pending_admin_review' || !isExactInteger(row.version, 1)
      || !isExactIsoTimestamp(row.source_property_updated_at)
      || !isExactIsoTimestamp(row.created_at) || !isExactIsoTimestamp(row.updated_at)) {
      throw new Error('Partner property proposal identity, version or lifecycle is invalid.');
    }
    if (!row.content || typeof row.content !== 'object' || Array.isArray(row.content)
        || !row.photos || typeof row.photos !== 'object' || Array.isArray(row.photos)) {
      throw new Error('Partner property proposal content/photo envelope is invalid.');
    }
    const content = Object.keys(row.content).length
      ? validatePartnerPropertyProposalContent(row.content) : {};
    const photos = Object.keys(row.photos).length
      ? validatePartnerPropertyProposalPhotos(row.photos) : {};
    if (!Object.keys(content).length && !Object.keys(photos).length) throw new Error('An empty Partner property proposal cannot be reviewed.');
    return Object.freeze({ ...clone(row), content, photos });
  }

  function validatePartnerPropertyProposalsControl(value, expectedHotelId = null) {
    const hotelId = exactCanonicalUuid(value?.hotel_id) ? value.hotel_id : '';
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'property_updated_at', 'proposals', 'public_change'])
        || value.contract_version !== PARTNER_PROPERTY_PROPOSALS_ADMIN_CONTRACT
        || hotelId !== SEVEN_ARCHES_PROPERTY_ID || (expectedHotelId && hotelId !== expectedHotelId)
        || !isExactIsoTimestamp(value.property_updated_at) || value.public_change !== false
        || !Array.isArray(value.proposals) || value.proposals.length > 100) {
      throw new Error('Partner property proposal Admin control is invalid or cross-property.');
    }
    const proposals = value.proposals.map((row) => validatePartnerPropertyProposal(row, hotelId));
    if (new Set(proposals.map((row) => row.id)).size !== proposals.length) {
      throw new Error('Partner property proposal Admin control contains duplicate rows.');
    }
    return Object.freeze({ ...clone(value), proposals });
  }

  function validatePartnerPropertyProposalReviewRequest(value, control) {
    const reviewedControl = validatePartnerPropertyProposalsControl(control, value?.hotel_id);
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'proposal_id', 'proposal_version', 'action', 'reason'])
        || value.contract_version !== PARTNER_PROPERTY_PROPOSAL_REQUEST_CONTRACT
        || value.hotel_id !== reviewedControl.hotel_id || !exactCanonicalUuid(value.proposal_id)
        || !isExactInteger(value.proposal_version, 1) || !['accept', 'reject'].includes(value.action)
        || typeof value.reason !== 'string' || value.reason !== value.reason.trim()
        || value.reason.length < 3 || value.reason.length > 500
        || /[\u0000-\u001f\u007f-\u009f]/u.test(value.reason)) {
      throw new Error('Partner property proposal Admin Review request is invalid.');
    }
    const proposal = reviewedControl.proposals.find((row) => row.id === value.proposal_id);
    if (!proposal || proposal.version !== value.proposal_version
        || (value.action === 'accept' && proposal.source_property_updated_at !== reviewedControl.property_updated_at)) {
      throw new Error('Partner property proposal Admin Review target is stale or missing.');
    }
    return Object.freeze(clone(value));
  }

  function partnerPropertyProposalExpectedOriginal(proposal) {
    return {
      status: proposal.status, version: proposal.version,
      source_property_updated_at: proposal.source_property_updated_at,
      content: clone(proposal.content), photos: clone(proposal.photos), updated_at: proposal.updated_at,
    };
  }

  function validatePartnerPropertyProposalPropertyPlan(value, plan, proposal) {
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'expected_property_updated_at', 'expected_operational_profile_version', 'reviewed_at', 'expected_original', 'payload'])
        || value.contract_version !== 'hotels_v2_admin_b_property_control_v1'
        || value.hotel_id !== plan.hotel_id || value.expected_property_updated_at !== plan.expected_property_updated_at
        || !isExactInteger(value.expected_operational_profile_version, 0)
        || value.reviewed_at !== plan.reviewed_at || !value.expected_original || !value.payload
        || stableJson(Object.keys(value.expected_original).sort()) !== stableJson(Object.keys(value.payload).sort())) {
      throw new Error('Accepted Partner proposal omitted its exact ADMIN-B property plan.');
    }
    const proposedPayload = { ...clone(proposal.content), ...clone(proposal.photos) };
    if (stableJson(value.payload) !== stableJson(proposedPayload) || !Object.keys(value.payload).length) {
      throw new Error('Accepted Partner proposal ADMIN-B payload differs from the exact proposal.');
    }
    return clone(value);
  }

  function validatePartnerPropertyProposalPlan(value, request, control) {
    const reviewedRequest = validatePartnerPropertyProposalReviewRequest(request, control);
    const proposal = control.proposals.find((row) => row.id === reviewedRequest.proposal_id);
    if (!hasExactKeys(value, [
      'contract_version', 'review_id', 'hotel_id', 'proposal_id', 'proposal_version', 'action',
      'reason', 'expected_property_updated_at', 'reviewed_at', 'expires_at', 'expected_original',
      'property_plan', 'plan_fingerprint',
    ]) || value.contract_version !== PARTNER_PROPERTY_PROPOSAL_PLAN_CONTRACT
      || !exactCanonicalUuid(value.review_id) || value.hotel_id !== reviewedRequest.hotel_id
      || value.proposal_id !== reviewedRequest.proposal_id || value.proposal_version !== reviewedRequest.proposal_version
      || value.action !== reviewedRequest.action || value.reason !== reviewedRequest.reason
      || value.expected_property_updated_at !== control.property_updated_at
      || !isExactIsoTimestamp(value.reviewed_at) || !isExactIsoTimestamp(value.expires_at)
      || Date.parse(value.expires_at) <= Date.parse(value.reviewed_at)
      || !isExactSnapshotToken(value.plan_fingerprint)
      || stableJson(value.expected_original) !== stableJson(partnerPropertyProposalExpectedOriginal(proposal))) {
      throw new Error('Partner property proposal reviewed plan is invalid or not bound to the exact proposal.');
    }
    if (value.action === 'accept') validatePartnerPropertyProposalPropertyPlan(value.property_plan, value, proposal);
    else if (value.property_plan !== null) throw new Error('Rejected Partner property proposal must not contain a property mutation plan.');
    return Object.freeze(clone(value));
  }

  function validatePartnerPropertyProposalPreview(value, request, control) {
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'changed', 'blocking_reasons', 'impact', 'reviewed_plan'])
        || value.contract_version !== PARTNER_PROPERTY_PROPOSAL_PREVIEW_CONTRACT
        || value.hotel_id !== request.hotel_id || value.changed !== true
        || !Array.isArray(value.blocking_reasons) || value.blocking_reasons.length
        || !hasExactKeys(value.impact, ['entity', 'action', 'id', 'changed', 'before', 'after'])
        || value.impact.entity !== 'property_proposal' || value.impact.action !== request.action
        || value.impact.id !== request.proposal_id || value.impact.changed !== true) {
      throw new Error('Partner property proposal Admin preview is invalid or hides blockers.');
    }
    const plan = validatePartnerPropertyProposalPlan(value.reviewed_plan, request, control);
    if (stableJson(value.impact.before) !== stableJson(plan.expected_original)) {
      throw new Error('Partner property proposal Admin preview before-state differs from the reviewed plan.');
    }
    const proposal = control.proposals.find((row) => row.id === request.proposal_id);
    const expectedAfter = request.action === 'accept'
      ? { ...clone(proposal.content), ...clone(proposal.photos) } : { status: 'rejected' };
    if (stableJson(value.impact.after) !== stableJson(expectedAfter)) {
      throw new Error('Partner property proposal Admin preview after-state differs from the exact action.');
    }
    return Object.freeze({ ...clone(value), reviewed_plan: plan });
  }

  function validatePartnerPropertyProposalActivity(value, plan, correlationId) {
    if (!hasExactKeys(value, ['id', 'hotel_id', 'entity_type', 'entity_id', 'action', 'before_state', 'after_state', 'actor_type', 'actor_id', 'source', 'correlation_id', 'created_at'])
        || !exactCanonicalUuid(value.id) || value.hotel_id !== plan.hotel_id
        || value.entity_type !== 'property' || value.entity_id !== plan.hotel_id || value.action !== 'update'
        || value.actor_type !== 'admin' || !exactCanonicalUuid(value.actor_id)
        || value.source !== 'hotels_v2_h3_2b_property_proposal_admin_review'
        || value.correlation_id !== correlationId || !isExactIsoTimestamp(value.created_at)
        || !hasExactKeys(value.before_state, ['proposal_id', 'status', 'version'])
        || !hasExactKeys(value.after_state, ['proposal_id', 'status', 'version', 'review_id', 'reason'])
        || value.before_state.proposal_id !== plan.proposal_id || value.before_state.status !== 'pending_admin_review'
        || value.before_state.version !== plan.proposal_version || value.after_state.proposal_id !== plan.proposal_id
        || value.after_state.status !== (plan.action === 'accept' ? 'accepted' : 'rejected')
        || value.after_state.version !== plan.proposal_version + 1 || value.after_state.review_id !== plan.review_id
        || value.after_state.reason !== plan.reason) {
      throw new Error('Partner property proposal terminal activity is invalid or not bound to the reviewed action.');
    }
    return clone(value);
  }

  function validatePartnerPropertyProposalApplyResult(value, plan, correlationId) {
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'proposal_id', 'action', 'status', 'correlation_id', 'replayed', 'admin_b_result', 'terminal_activity', 'control'])
        || value.contract_version !== PARTNER_PROPERTY_PROPOSAL_APPLY_CONTRACT
        || value.hotel_id !== plan.hotel_id || value.proposal_id !== plan.proposal_id
        || value.action !== plan.action || value.status !== (plan.action === 'accept' ? 'accepted' : 'rejected')
        || value.correlation_id !== correlationId || typeof value.replayed !== 'boolean') {
      throw new Error('Partner property proposal Admin Save receipt is invalid or cross-review.');
    }
    if (plan.action === 'accept') {
      if (!hasExactKeys(value.admin_b_result, ['ok', 'contract_version', 'hotel_id', 'changed', 'property_changed', 'operational_profile_changed', 'correlation_id', 'workspace', 'content_control', 'activity'])
          || value.admin_b_result.ok !== true || value.admin_b_result.contract_version !== 'hotels_v2_admin_b_property_control_v1'
          || value.admin_b_result.hotel_id !== plan.hotel_id || value.admin_b_result.correlation_id !== correlationId
          || value.admin_b_result.changed !== true || value.admin_b_result.property_changed !== true
          || value.admin_b_result.operational_profile_changed !== false
          || !Array.isArray(value.admin_b_result.activity) || value.admin_b_result.activity.length !== 1) {
        throw new Error('Accepted Partner proposal returned an invalid ADMIN-B receipt.');
      }
    } else if (value.admin_b_result !== null) throw new Error('Rejected Partner proposal unexpectedly returned a property mutation receipt.');
    validatePartnerPropertyProposalActivity(value.terminal_activity, plan, correlationId);
    const control = validatePartnerPropertyProposalsControl(value.control, plan.hotel_id);
    if (control.proposals.some((row) => row.id === plan.proposal_id)) throw new Error('Terminal Partner proposal remains pending after Save.');
    return Object.freeze({ ...clone(value), control });
  }

  const SEVEN_ARCHES_ACTIVATION_BLOCKERS = Object.freeze([
    'legacy_property_drift', 'feature_flags_not_off', 'h3_1p_receipt_drift',
    'h3_1p_parity_drift', 'allocation_5_10_drift', 'pricing_graph_drift',
    'payment_policy_drift', 'commission_policy_drift', 'unreviewed_activation_state',
    'activated_graph_drift',
  ]);

  function exactActivationI18n(value, maximum, allowLf, requireAll = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    if (keys.some((key) => !LANGUAGES.includes(key))
        || (requireAll && !LANGUAGES.every((key) => Object.hasOwn(value, key)))) return false;
    return keys.every((key) => {
      if (typeof value[key] !== 'string') return false;
      const normalized = value[key].replace(/\r\n?/g, '\n');
      if (normalized !== normalized.trim() || normalized.startsWith('\n') || normalized.endsWith('\n')
          || normalized.length < 1 || normalized.length > maximum) return false;
      return allowLf
        ? !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(normalized)
        : !/[\u0000-\u001f\u007f-\u009f]/u.test(normalized);
    });
  }

  function validateSevenArchesPricingActivationSnapshot(value) {
    if (!hasExactKeys(value, [
      'contract_version', 'hotel_id', 'status', 'snapshot_token', 'public_change',
      'legacy_authoritative', 'feature_flags', 'h3_1p', 'rate_plan', 'room_rates',
      'shared_schedule', 'preview_schedule', 'payment_policy', 'commission_policy',
      'blocking_reasons',
    ]) || value.contract_version !== SEVEN_ARCHES_PRICING_ACTIVATION_SNAPSHOT_CONTRACT
      || value.hotel_id !== SEVEN_ARCHES_PROPERTY_ID
      || !['ready', 'active', 'blocked'].includes(value.status)
      || !isExactSnapshotToken(value.snapshot_token) || value.public_change !== false
      || value.legacy_authoritative !== true) {
      throw new Error('7 Arches pricing activation snapshot identity or safety envelope is invalid.');
    }
    const flagKeys = ['hotel_rooms_v2_enabled', 'hotel_external_sync_enabled', 'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled'];
    if (!hasExactKeys(value.feature_flags, flagKeys)
        || flagKeys.some((key) => typeof value.feature_flags[key] !== 'boolean')) {
      throw new Error('7 Arches pricing activation feature flags are invalid.');
    }
    if (!Array.isArray(value.blocking_reasons) || value.blocking_reasons.length > SEVEN_ARCHES_ACTIVATION_BLOCKERS.length
        || new Set(value.blocking_reasons).size !== value.blocking_reasons.length
        || value.blocking_reasons.some((reason) => !SEVEN_ARCHES_ACTIVATION_BLOCKERS.includes(reason))
        || (value.status === 'blocked') !== (value.blocking_reasons.length > 0)
        || (value.status !== 'blocked' && flagKeys.some((key) => value.feature_flags[key] !== false))) {
      throw new Error('7 Arches pricing activation blockers or feature-flag state are inconsistent.');
    }
    const parityKeys = ['threshold_case_count', 'threshold_mismatch_count', 'long_stay_case_count', 'long_stay_mismatch_count', 'total_case_count', 'total_mismatch_count', 'fingerprint'];
    if (!hasExactKeys(value.h3_1p, ['promotion_review_id', 'source_fingerprint', 'parity', 'allocation_exact'])
        || !exactCanonicalUuid(value.h3_1p.promotion_review_id)
        || !isExactFingerprint(value.h3_1p.source_fingerprint, false)
        || value.h3_1p.allocation_exact !== true || !hasExactKeys(value.h3_1p.parity, parityKeys)
        || !isExactFingerprint(value.h3_1p.parity.fingerprint, false)
        || parityKeys.slice(0, -1).some((key) => !isExactInteger(value.h3_1p.parity[key], 0))) {
      throw new Error('7 Arches H3.1P activation evidence is invalid.');
    }
    if (value.status !== 'blocked' && (value.h3_1p.source_fingerprint !== SEVEN_KAMARES_LEGACY_PRICING_FINGERPRINT
        || value.h3_1p.parity.total_case_count !== 70 || value.h3_1p.parity.total_mismatch_count !== 0)) {
      throw new Error('7 Arches activation cannot hide H3.1P parity drift.');
    }
    const plan = value.rate_plan;
    if (!hasExactKeys(plan, ['id', 'version', 'name_i18n', 'description_i18n', 'cancellation_policy', 'is_active', 'review_status'])
        || plan.id !== SEVEN_ARCHES_SHADOW_IDS.rate_plan || !isExactInteger(plan.version, 1)
        || !exactActivationI18n(plan.name_i18n, 240, false)
        || !(Object.keys(asObject(plan.description_i18n)).length === 0 || exactActivationI18n(plan.description_i18n, 5000, true))
        || stableJson(plan.cancellation_policy) !== stableJson({ type: 'non_refundable' })
        || typeof plan.is_active !== 'boolean' || plan.review_status !== 'reviewed') {
      throw new Error('7 Arches activation Rate Plan projection is invalid.');
    }
    if (!Array.isArray(value.room_rates) || value.room_rates.length !== 2) throw new Error('7 Arches activation requires exactly two Room Rates.');
    const rateIds = [SEVEN_ARCHES_SHADOW_IDS.upper_room_rate, SEVEN_ARCHES_SHADOW_IDS.ground_room_rate];
    const roomIds = [SEVEN_ARCHES_SHADOW_IDS.upper_room_type, SEVEN_ARCHES_SHADOW_IDS.ground_room_type];
    value.room_rates.forEach((rate, index) => {
      if (!hasExactKeys(rate, ['id', 'room_type_id', 'base_nightly_rate', 'currency', 'is_active', 'review_status', 'version'])
          || rate.id !== rateIds[index] || rate.room_type_id !== roomIds[index]
          || !isExactMoney(rate.base_nightly_rate, 0, 1000000) || rate.currency !== 'EUR'
          || typeof rate.is_active !== 'boolean' || rate.review_status !== 'reviewed'
          || !isExactInteger(rate.version, 1)) throw new Error('7 Arches activation Room Rate projection is invalid.');
    });
    const schedule = value.shared_schedule;
    if (!hasExactKeys(schedule, ['id', 'version', 'name_i18n', 'is_active', 'review_status', 'active_tier_count'])
        || schedule.id !== SEVEN_ARCHES_SHADOW_IDS.pricing_schedule || !isExactInteger(schedule.version, 1)
        || !exactActivationI18n(schedule.name_i18n, 240, false) || typeof schedule.is_active !== 'boolean'
        || schedule.review_status !== 'reviewed' || schedule.active_tier_count !== 27) {
      throw new Error('7 Arches activation shared schedule projection is invalid.');
    }
    const previewSchedule = value.preview_schedule;
    if (!hasExactKeys(previewSchedule, ['id', 'version', 'is_active', 'review_status'])
        || previewSchedule.id !== SEVEN_ARCHES_SHADOW_IDS.property_party_preview
        || !isExactInteger(previewSchedule.version, 1) || typeof previewSchedule.is_active !== 'boolean'
        || previewSchedule.review_status !== 'requires_review') throw new Error('7 Arches reference schedule projection is invalid.');
    const payment = value.payment_policy;
    if (!hasExactKeys(payment, ['id', 'code', 'currency', 'is_active', 'review_status', 'version', 'terms_fingerprint'])
        || !exactCanonicalUuid(payment.id) || typeof payment.code !== 'string' || !payment.code
        || payment.currency !== 'EUR' || typeof payment.is_active !== 'boolean'
        || payment.review_status !== 'reviewed' || !isExactInteger(payment.version, 1)
        || !isExactFingerprint(payment.terms_fingerprint, false)) throw new Error('7 Arches payment-policy activation projection is invalid.');
    const commission = value.commission_policy;
    if (!hasExactKeys(commission, ['id', 'code', 'commission_mode', 'amount', 'currency', 'version', 'updated_at', 'read_only'])
        || !exactCanonicalUuid(commission.id) || typeof commission.code !== 'string' || !commission.code
        || commission.commission_mode !== 'per_allocated_room_per_night'
        || !isExactMoney(commission.amount, 0, 1000000) || commission.currency !== 'EUR'
        || !isExactInteger(commission.version, 1) || !isExactIsoTimestamp(commission.updated_at)
        || commission.read_only !== true) throw new Error('7 Arches commission activation projection is invalid.');
    if (value.status === 'ready' && (plan.is_active || schedule.is_active || previewSchedule.is_active
        || value.room_rates.some((rate) => rate.is_active || rate.base_nightly_rate !== 0))) {
      throw new Error('Ready 7 Arches activation snapshot already contains unreviewed active pricing.');
    }
    if (value.status === 'active' && (!plan.is_active || !schedule.is_active || previewSchedule.is_active
        || value.room_rates.some((rate) => !rate.is_active || rate.base_nightly_rate <= 0)
        || !exactActivationI18n(plan.name_i18n, 240, false, true)
        || !exactActivationI18n(plan.description_i18n, 5000, true, true)
        || !exactActivationI18n(schedule.name_i18n, 240, false, true))) {
      throw new Error('Active 7 Arches pricing graph is incomplete.');
    }
    return Object.freeze(clone(value));
  }

  function activationExpectedOriginal(snapshot) {
    return {
      rate_plan: clone(snapshot.rate_plan), room_rates: clone(snapshot.room_rates),
      shared_schedule: clone(snapshot.shared_schedule), preview_schedule: clone(snapshot.preview_schedule),
    };
  }

  function validateSevenArchesPricingActivationDraft(value, snapshotValue) {
    const snapshot = validateSevenArchesPricingActivationSnapshot(snapshotValue);
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'snapshot_token', 'upper_base_nightly_rate', 'ground_base_nightly_rate', 'rate_plan_name_i18n', 'rate_plan_description_i18n', 'schedule_name_i18n', 'reason'])
        || value.contract_version !== SEVEN_ARCHES_PRICING_ACTIVATION_DRAFT_CONTRACT
        || value.hotel_id !== snapshot.hotel_id || value.snapshot_token !== snapshot.snapshot_token
        || snapshot.status !== 'ready' || snapshot.blocking_reasons.length
        || !isExactMoney(value.upper_base_nightly_rate, 0.01, 1000000)
        || !isExactMoney(value.ground_base_nightly_rate, 0.01, 1000000)
        || !exactActivationI18n(value.rate_plan_name_i18n, 240, false, true)
        || !exactActivationI18n(value.rate_plan_description_i18n, 5000, true, true)
        || !exactActivationI18n(value.schedule_name_i18n, 240, false, true)
        || typeof value.reason !== 'string' || value.reason !== value.reason.trim()
        || value.reason.length < 3 || value.reason.length > 500
        || /[\u0000-\u001f\u007f-\u009f]/u.test(value.reason)) {
      throw new Error('7 Arches pricing activation draft is invalid, incomplete or stale.');
    }
    return Object.freeze(clone(value));
  }

  function activationAfterState(payload, snapshot) {
    return {
      rate_plan: { id: SEVEN_ARCHES_SHADOW_IDS.rate_plan, name_i18n: clone(payload.rate_plan_name_i18n), description_i18n: clone(payload.rate_plan_description_i18n), is_active: true },
      room_rates: [
        { id: SEVEN_ARCHES_SHADOW_IDS.upper_room_rate, base_nightly_rate: payload.upper_base_nightly_rate, is_active: true },
        { id: SEVEN_ARCHES_SHADOW_IDS.ground_room_rate, base_nightly_rate: payload.ground_base_nightly_rate, is_active: true },
      ],
      shared_schedule: { id: SEVEN_ARCHES_SHADOW_IDS.pricing_schedule, name_i18n: clone(payload.schedule_name_i18n), is_active: true },
      preview_schedule: clone(snapshot.preview_schedule),
    };
  }

  function validateSevenArchesPricingActivationPlan(value, draft, snapshot) {
    const reviewedDraft = validateSevenArchesPricingActivationDraft(draft, snapshot);
    if (!hasExactKeys(value, ['contract_version', 'review_id', 'hotel_id', 'snapshot_token', 'reviewed_at', 'expires_at', 'operation', 'plan_fingerprint'])
        || value.contract_version !== SEVEN_ARCHES_PRICING_ACTIVATION_PLAN_CONTRACT
        || !exactCanonicalUuid(value.review_id) || value.hotel_id !== reviewedDraft.hotel_id
        || value.snapshot_token !== reviewedDraft.snapshot_token || !isExactIsoTimestamp(value.reviewed_at)
        || !isExactIsoTimestamp(value.expires_at) || Date.parse(value.expires_at) <= Date.parse(value.reviewed_at)
        || Date.parse(value.expires_at) > Date.parse(value.reviewed_at) + 30 * 60 * 1000
        || !isExactSnapshotToken(value.plan_fingerprint)
        || !hasExactKeys(value.operation, ['entity', 'action', 'id', 'expected_original', 'payload'])
        || value.operation.entity !== 'pricing_activation' || value.operation.action !== 'activate'
        || value.operation.id !== value.hotel_id
        || stableJson(value.operation.expected_original) !== stableJson(activationExpectedOriginal(snapshot))) {
      throw new Error('7 Arches pricing activation reviewed plan is invalid or not bound to the exact snapshot.');
    }
    const expectedPayload = {
      upper_base_nightly_rate: reviewedDraft.upper_base_nightly_rate,
      ground_base_nightly_rate: reviewedDraft.ground_base_nightly_rate,
      rate_plan_name_i18n: clone(reviewedDraft.rate_plan_name_i18n),
      rate_plan_description_i18n: clone(reviewedDraft.rate_plan_description_i18n),
      schedule_name_i18n: clone(reviewedDraft.schedule_name_i18n), reason: reviewedDraft.reason,
    };
    if (stableJson(value.operation.payload) !== stableJson(expectedPayload)) {
      throw new Error('7 Arches pricing activation reviewed payload differs from the explicit Admin draft.');
    }
    return Object.freeze(clone(value));
  }

  function validateSevenArchesPricingActivationPreview(value, draft, snapshot) {
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'changed', 'blocking_reasons', 'impact', 'reviewed_plan'])
        || value.contract_version !== SEVEN_ARCHES_PRICING_ACTIVATION_PREVIEW_CONTRACT
        || value.hotel_id !== SEVEN_ARCHES_PROPERTY_ID || typeof value.changed !== 'boolean'
        || !Array.isArray(value.blocking_reasons) || value.blocking_reasons.some((reason) => !SEVEN_ARCHES_ACTIVATION_BLOCKERS.includes(reason))) {
      throw new Error('7 Arches pricing activation Preview envelope is invalid.');
    }
    if (!value.changed) {
      if (value.impact !== null || value.reviewed_plan !== null
          || (snapshot.status === 'ready' && value.blocking_reasons.length === 0)) {
        throw new Error('7 Arches pricing activation no-op Preview is inconsistent.');
      }
      return Object.freeze(clone(value));
    }
    if (value.blocking_reasons.length) throw new Error('Changed 7 Arches activation Preview hides blockers.');
    const plan = validateSevenArchesPricingActivationPlan(value.reviewed_plan, draft, snapshot);
    const fields = ['base_nightly_rates', 'is_active', 'rate_plan_description_i18n', 'rate_plan_name_i18n', 'schedule_name_i18n'];
    const impact = value.impact;
    if (!hasExactKeys(impact, ['entity', 'action', 'id', 'changed', 'fields', 'before', 'after', 'affected_room_type_ids', 'affected_room_rate_ids', 'from', 'to'])
        || impact.entity !== 'pricing_activation' || impact.action !== 'activate' || impact.id !== plan.hotel_id
        || impact.changed !== true || stableJson(impact.fields) !== stableJson(fields)
        || stableJson(impact.before) !== stableJson(plan.operation.expected_original)
        || stableJson(impact.after) !== stableJson(activationAfterState(plan.operation.payload, snapshot))
        || stableJson(impact.affected_room_type_ids) !== stableJson([SEVEN_ARCHES_SHADOW_IDS.ground_room_type, SEVEN_ARCHES_SHADOW_IDS.upper_room_type])
        || stableJson(impact.affected_room_rate_ids) !== stableJson([SEVEN_ARCHES_SHADOW_IDS.ground_room_rate, SEVEN_ARCHES_SHADOW_IDS.upper_room_rate])
        || impact.from !== null || impact.to !== null) {
      throw new Error('7 Arches pricing activation impact is incomplete or not bound to the reviewed graph.');
    }
    return Object.freeze({ ...clone(value), reviewed_plan: plan });
  }

  function validateSevenArchesPricingActivationApplyResult(value, plan, correlationId, idempotencyKey) {
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'changed', 'replayed', 'review_id', 'correlation_id', 'idempotency_key', 'activity_ids', 'public_change', 'legacy_authoritative'])
        || value.contract_version !== SEVEN_ARCHES_PRICING_ACTIVATION_APPLY_CONTRACT
        || value.hotel_id !== plan.hotel_id || value.changed !== true || typeof value.replayed !== 'boolean'
        || value.review_id !== plan.review_id || value.correlation_id !== correlationId
        || value.idempotency_key !== idempotencyKey || value.public_change !== false
        || value.legacy_authoritative !== true || !Array.isArray(value.activity_ids)
        || value.activity_ids.length !== 4 || new Set(value.activity_ids).size !== 4
        || value.activity_ids.some((id) => !exactCanonicalUuid(id))) {
      throw new Error('7 Arches pricing activation Save receipt is invalid or incomplete.');
    }
    return Object.freeze(clone(value));
  }

  function exactReviewedPricingHash(value, length = 64) {
    return typeof value === 'string'
      && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
  }

  function validateSevenArchesReviewedPricingCommission(value) {
    if (!hasExactKeys(value, ['commission_mode', 'amount', 'currency'])
        || value.commission_mode !== 'per_allocated_room_per_night'
        || value.amount !== 10 || value.currency !== 'EUR') {
      throw new Error('7 Arches reviewed pricing commission policy is invalid.');
    }
    return clone(value);
  }

  function reviewedPricingRoomContract(roomKey) {
    return roomKey === 'upper'
      ? {
        room_type_id: SEVEN_ARCHES_SHADOW_IDS.upper_room_type,
        room_rate_id: SEVEN_ARCHES_SHADOW_IDS.upper_room_rate,
        pricing_schedule_id: SEVEN_ARCHES_INDEPENDENT_PRICING_IDS.upper_schedule,
      }
      : roomKey === 'ground'
        ? {
          room_type_id: SEVEN_ARCHES_SHADOW_IDS.ground_room_type,
          room_rate_id: SEVEN_ARCHES_SHADOW_IDS.ground_room_rate,
          pricing_schedule_id: SEVEN_ARCHES_INDEPENDENT_PRICING_IDS.ground_schedule,
        }
        : null;
  }

  function validateSevenArchesReviewedPricingItem(value, options = {}) {
    const includeIndex = options.includeIndex === true;
    const includeRoomKey = options.includeRoomKey === true;
    const includeVersion = options.includeVersion === true;
    const keys = [
      ...(includeIndex ? ['item_index'] : []),
      ...(includeRoomKey ? ['room_key'] : []),
      'hotel_id', 'room_type_id', 'room_rate_id', 'pricing_schedule_id',
      'schedule_tier_id', 'guest_count', 'minimum_nights', 'currency',
      'before_price', 'requested_price',
      ...(includeVersion ? ['before_tier_version'] : []),
    ];
    const inferredRoomKey = value?.pricing_schedule_id === SEVEN_ARCHES_INDEPENDENT_PRICING_IDS.upper_schedule
      ? 'upper' : value?.pricing_schedule_id === SEVEN_ARCHES_INDEPENDENT_PRICING_IDS.ground_schedule
        ? 'ground' : '';
    const roomKey = includeRoomKey ? value?.room_key : inferredRoomKey;
    const room = reviewedPricingRoomContract(roomKey);
    if (!hasExactKeys(value, keys)
        || (includeIndex && !isExactInteger(value.item_index, 1, 54))
        || (includeVersion && !isExactInteger(value.before_tier_version, 1))
        || !room || value.hotel_id !== SEVEN_ARCHES_PROPERTY_ID
        || value.room_type_id !== room.room_type_id
        || value.room_rate_id !== room.room_rate_id
        || value.pricing_schedule_id !== room.pricing_schedule_id
        || normalizePricingSourceUuid('pricing_schedule_tier', value.schedule_tier_id)
          !== value.schedule_tier_id
        || ![2, 3, 4].includes(value.guest_count)
        || !isExactInteger(value.minimum_nights, 2, 10)
        || value.currency !== 'EUR'
        || !isExactMoney(value.before_price, 10)
        || !isExactMoney(value.requested_price, 10)
        || value.before_price === value.requested_price) {
      throw new Error('7 Arches reviewed pricing item is invalid, stale or cross-Room.');
    }
    return clone(value);
  }

  function validateSevenArchesReviewedPricingImpacts(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
      throw new Error('7 Arches reviewed pricing commercial impacts are invalid.');
    }
    value.forEach((impact) => {
      const single = impact?.scope === 'single_room';
      const keys = single
        ? ['scope', 'room_key', 'guest_count', 'minimum_nights', 'customer_before', 'customer_after', 'cypruseye_commission', 'partner_net_before', 'partner_net_after', 'currency']
        : ['scope', 'requested_guest_count', 'minimum_nights', 'customer_before', 'customer_after', 'cypruseye_commission', 'partner_net_before', 'partner_net_after', 'currency'];
      if (!hasExactKeys(impact, keys) || (!single && impact.scope !== 'bundle')
          || (single && !reviewedPricingRoomContract(impact.room_key))
          || (single && ![2, 3, 4].includes(impact.guest_count))
          || (!single && ![5, 6, 7, 8].includes(impact.requested_guest_count))
          || !isExactInteger(impact.minimum_nights, 2, 10)
          || !isExactMoney(impact.customer_before, 0)
          || !isExactMoney(impact.customer_after, 0)
          || !isExactMoney(impact.cypruseye_commission, 0)
          || !isExactMoney(impact.partner_net_before, -10000000000)
          || !isExactMoney(impact.partner_net_after, -10000000000)
          || impact.cypruseye_commission !== (single ? 10 : 20)
          || impact.currency !== 'EUR'
          || impact.partner_net_before !== Number((impact.customer_before - impact.cypruseye_commission).toFixed(2))
          || impact.partner_net_after !== Number((impact.customer_after - impact.cypruseye_commission).toFixed(2))) {
        throw new Error('7 Arches reviewed pricing commercial impact is not server-exact.');
      }
    });
    return clone(value);
  }

  function validateSevenArchesReviewedPricingCurrentState(value) {
    const hashKeys = [
      'normalized_fingerprint', 'authority_fingerprint', 'legacy_fingerprint',
      'commission_fingerprint', 'payment_fingerprint', 'unrelated_fingerprint',
      'last_receipt_hash', 'snapshot_token',
    ];
    if (!hasExactKeys(value, [
      'contract_version', ...hashKeys.slice(0, 6), 'oracle', 'room_fingerprints',
      'last_receipt_hash', 'receipt_count', 'snapshot_token',
    ]) || value.contract_version !== 'hotels_v2_seven_arches_reviewed_pricing_state_v1'
      || hashKeys.some((key) => !exactReviewedPricingHash(value[key]))
      || !isExactInteger(value.receipt_count, 0)
      || !hasExactKeys(value.room_fingerprints, ['ground', 'upper'])
      || !exactReviewedPricingHash(value.room_fingerprints.ground)
      || !exactReviewedPricingHash(value.room_fingerprints.upper)
      || !hasExactKeys(value.oracle, [
        'contract_version', 'core_case_count', 'core_mismatch_count',
        'guest_one_case_count', 'guest_one_mismatch_count', 'total_case_count',
        'fingerprint',
      ]) || value.oracle.contract_version !== 'hotels_v2_seven_arches_reviewed_pricing_oracle_v1'
      || value.oracle.core_case_count !== 100 || value.oracle.core_mismatch_count !== 0
      || value.oracle.guest_one_case_count !== 20 || value.oracle.guest_one_mismatch_count !== 0
      || value.oracle.total_case_count !== 120
      || !exactReviewedPricingHash(value.oracle.fingerprint, 32)) {
      throw new Error('7 Arches reviewed pricing current state is invalid or parity-unsafe.');
    }
    return clone(value);
  }

  function validateSevenArchesReviewedPricingProposal(value) {
    if (!hasExactKeys(value, [
      'id', 'initiator_type', 'partner_id', 'assignment_id', 'status', 'version',
      'reason', 'item_count', 'created_at', 'expires_at', 'fresh', 'items',
    ]) || !exactCanonicalUuid(value.id)
      || !['partner', 'admin'].includes(value.initiator_type)
      || value.status !== 'pending_admin_review' || !isExactInteger(value.version, 1)
      || typeof value.reason !== 'string' || value.reason !== value.reason.trim()
      || value.reason.length < 3 || value.reason.length > 500
      || /[\u0000-\u001f\u007f-\u009f]/u.test(value.reason)
      || !isExactInteger(value.item_count, 1, 54)
      || !isExactIsoTimestamp(value.created_at) || !isExactIsoTimestamp(value.expires_at)
      || typeof value.fresh !== 'boolean' || !Array.isArray(value.items)
      || value.items.length !== value.item_count) {
      throw new Error('7 Arches reviewed pricing proposal identity or lifecycle is invalid.');
    }
    if (value.initiator_type === 'partner') {
      if (!exactCanonicalUuid(value.partner_id) || !exactCanonicalUuid(value.assignment_id)) {
        throw new Error('Partner pricing proposal is missing its exact Partner assignment.');
      }
    } else if (value.partner_id !== null || value.assignment_id !== null) {
      throw new Error('Admin-initiated pricing proposal contains a Partner identity.');
    }
    const items = value.items.map((item) => validateSevenArchesReviewedPricingItem(item, {
      includeIndex: true, includeRoomKey: true,
    }));
    if (new Set(items.map((item) => item.item_index)).size !== items.length
        || new Set(items.map((item) => item.schedule_tier_id)).size !== items.length) {
      throw new Error('7 Arches reviewed pricing proposal contains duplicate items.');
    }
    return Object.freeze({ ...clone(value), items });
  }

  function validateSevenArchesReviewedPricingControl(value, expectedHotelId = null) {
    if (!hasExactKeys(value, ['contract_version', 'hotel_id', 'proposals', 'commission_policy', 'current_state'])
        || value.contract_version !== SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_CONTROL_CONTRACT
        || value.hotel_id !== SEVEN_ARCHES_PROPERTY_ID
        || (expectedHotelId && value.hotel_id !== expectedHotelId)
        || !Array.isArray(value.proposals) || value.proposals.length > 100) {
      throw new Error('7 Arches reviewed pricing Admin control is invalid or cross-property.');
    }
    const proposals = value.proposals.map(validateSevenArchesReviewedPricingProposal);
    if (new Set(proposals.map((proposal) => proposal.id)).size !== proposals.length) {
      throw new Error('7 Arches reviewed pricing Admin control contains duplicate proposals.');
    }
    return Object.freeze({
      ...clone(value), proposals,
      commission_policy: validateSevenArchesReviewedPricingCommission(value.commission_policy),
      current_state: validateSevenArchesReviewedPricingCurrentState(value.current_state),
    });
  }

  function validateSevenArchesReviewedPricingAdminRequest(value, controlValue = null) {
    const proposalRequest = Object.hasOwn(asObject(value), 'proposal_id');
    const keys = proposalRequest
      ? ['contract_version', 'hotel_id', 'proposal_id', 'proposal_version', 'action', 'reason']
      : ['contract_version', 'hotel_id', 'action', 'reason', 'items'];
    if (!hasExactKeys(value, keys)
        || value.contract_version !== SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_REQUEST_CONTRACT
        || value.hotel_id !== SEVEN_ARCHES_PROPERTY_ID
        || !['accept', 'reject'].includes(value.action)
        || typeof value.reason !== 'string' || value.reason !== value.reason.trim()
        || value.reason.length < 3 || value.reason.length > 500
        || /[\u0000-\u001f\u007f-\u009f]/u.test(value.reason)) {
      throw new Error('7 Arches reviewed pricing Admin request is invalid.');
    }
    if (proposalRequest) {
      if (!exactCanonicalUuid(value.proposal_id) || !isExactInteger(value.proposal_version, 1)) {
        throw new Error('7 Arches reviewed pricing proposal identity/version is invalid.');
      }
      if (controlValue) {
        const control = validateSevenArchesReviewedPricingControl(controlValue, value.hotel_id);
        const proposal = control.proposals.find((row) => row.id === value.proposal_id);
        if (!proposal || proposal.version !== value.proposal_version
            || (value.action === 'accept' && proposal.fresh !== true)) {
          throw new Error('7 Arches reviewed pricing proposal is stale or missing.');
        }
      }
    } else {
      if (value.action !== 'accept' || !Array.isArray(value.items)
          || value.items.length < 1 || value.items.length > 54) {
        throw new Error('Admin-initiated 7 Arches pricing requires one to 54 exact changed tiers.');
      }
      value.items.forEach((item) => validateSevenArchesReviewedPricingItem(item));
      if (new Set(value.items.map((item) => item.schedule_tier_id)).size !== value.items.length) {
        throw new Error('Admin-initiated 7 Arches pricing contains duplicate tiers.');
      }
    }
    return Object.freeze(clone(value));
  }

  function validateSevenArchesReviewedPricingPlan(value, request) {
    if (!hasExactKeys(value, [
      'contract_version', 'review_id', 'hotel_id', 'proposal_id', 'proposal_version',
      'initiator_type', 'partner_id', 'assignment_id', 'actor_id', 'action',
      'admin_reason', 'proposal_reason', 'canonical_items', 'commercial_impacts',
      'commission_policy', 'evolution_snapshot_token', 'reviewed_at', 'expires_at',
      'plan_fingerprint',
    ]) || value.contract_version !== SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_PLAN_CONTRACT
      || !exactCanonicalUuid(value.review_id) || value.hotel_id !== request.hotel_id
      || !exactCanonicalUuid(value.proposal_id) || !isExactInteger(value.proposal_version, 1)
      || !['partner', 'admin'].includes(value.initiator_type)
      || !exactCanonicalUuid(value.actor_id) || value.action !== request.action
      || value.admin_reason !== request.reason
      || typeof value.proposal_reason !== 'string' || value.proposal_reason !== value.proposal_reason.trim()
      || value.proposal_reason.length < 3 || value.proposal_reason.length > 500
      || !Array.isArray(value.canonical_items) || value.canonical_items.length < 1
      || value.canonical_items.length > 54
      || !exactReviewedPricingHash(value.evolution_snapshot_token)
      || !isExactIsoTimestamp(value.reviewed_at) || !isExactIsoTimestamp(value.expires_at)
      || Date.parse(value.expires_at) <= Date.parse(value.reviewed_at)
      || Date.parse(value.expires_at) > Date.parse(value.reviewed_at) + 30 * 60 * 1000
      || !exactReviewedPricingHash(value.plan_fingerprint)) {
      throw new Error('7 Arches reviewed pricing plan is invalid or not bound to the request.');
    }
    if (Object.hasOwn(request, 'proposal_id')
        && (value.proposal_id !== request.proposal_id
          || value.proposal_version !== request.proposal_version)) {
      throw new Error('7 Arches reviewed pricing plan switched proposal identity.');
    }
    if (value.initiator_type === 'partner') {
      if (!exactCanonicalUuid(value.partner_id) || !exactCanonicalUuid(value.assignment_id)) {
        throw new Error('7 Arches Partner pricing plan lost assignment lineage.');
      }
    } else if (value.partner_id !== null || value.assignment_id !== null) {
      throw new Error('7 Arches Admin pricing plan contains Partner lineage.');
    }
    const canonicalItems = value.canonical_items.map((item) => validateSevenArchesReviewedPricingItem(item, {
      includeRoomKey: true, includeVersion: true,
    }));
    if (new Set(canonicalItems.map((item) => item.schedule_tier_id)).size !== canonicalItems.length) {
      throw new Error('7 Arches reviewed pricing plan contains duplicate tier identities.');
    }
    validateSevenArchesReviewedPricingImpacts(value.commercial_impacts);
    validateSevenArchesReviewedPricingCommission(value.commission_policy);
    return Object.freeze({ ...clone(value), canonical_items: canonicalItems });
  }

  function validateSevenArchesReviewedPricingPreview(value, requestValue, controlValue = null) {
    const request = validateSevenArchesReviewedPricingAdminRequest(requestValue, controlValue);
    if (!hasExactKeys(value, [
      'contract_version', 'hotel_id', 'proposal_id', 'action', 'changed',
      'proposal_fresh', 'commercial_impacts', 'commission_policy', 'reviewed_plan',
    ]) || value.contract_version !== SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_PREVIEW_CONTRACT
      || value.hotel_id !== request.hotel_id || !exactCanonicalUuid(value.proposal_id)
      || value.action !== request.action || value.changed !== (request.action === 'accept')
      || typeof value.proposal_fresh !== 'boolean') {
      throw new Error('7 Arches reviewed pricing Preview envelope is invalid.');
    }
    const plan = validateSevenArchesReviewedPricingPlan(value.reviewed_plan, request);
    if (plan.proposal_id !== value.proposal_id
        || stableJson(value.commercial_impacts) !== stableJson(plan.commercial_impacts)
        || stableJson(value.commission_policy) !== stableJson(plan.commission_policy)) {
      throw new Error('7 Arches reviewed pricing Preview differs from its exact reviewed plan.');
    }
    validateSevenArchesReviewedPricingImpacts(value.commercial_impacts);
    validateSevenArchesReviewedPricingCommission(value.commission_policy);
    return Object.freeze({ ...clone(value), reviewed_plan: plan });
  }

  function validateSevenArchesReviewedPricingApplyResult(value, plan, correlationId, idempotencyKey) {
    const accepted = plan.action === 'accept';
    if (!hasExactKeys(value, [
      'contract_version', 'hotel_id', 'proposal_id', 'review_id', 'action', 'status',
      'changed', 'replayed', 'correlation_id', 'idempotency_key', 'receipt_sequence',
      'receipt_id', 'receipt_hash', 'changed_items', 'commercial_impacts',
      'commission_policy', 'activity_ids',
    ]) || value.contract_version !== SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_APPLY_CONTRACT
      || value.hotel_id !== plan.hotel_id || value.proposal_id !== plan.proposal_id
      || value.review_id !== plan.review_id || value.action !== plan.action
      || value.status !== (accepted ? 'accepted' : 'rejected')
      || value.changed !== accepted || typeof value.replayed !== 'boolean'
      || value.correlation_id !== correlationId || value.idempotency_key !== idempotencyKey
      || !Array.isArray(value.changed_items) || !Array.isArray(value.activity_ids)
      || value.activity_ids.length !== 1 || !exactCanonicalUuid(value.activity_ids[0])
      || stableJson(value.commercial_impacts) !== stableJson(plan.commercial_impacts)
      || stableJson(value.commission_policy) !== stableJson(plan.commission_policy)) {
      throw new Error('7 Arches reviewed pricing Save receipt is invalid or cross-review.');
    }
    if (accepted) {
      if (!isExactInteger(value.receipt_sequence, 1) || !exactCanonicalUuid(value.receipt_id)
          || !exactReviewedPricingHash(value.receipt_hash)
          || value.changed_items.length !== plan.canonical_items.length) {
        throw new Error('Accepted 7 Arches pricing Save omitted its immutable receipt evidence.');
      }
      value.changed_items.forEach((item, index) => {
        const reviewed = plan.canonical_items[index];
        if (!hasExactKeys(item, [
          'room_key', 'room_type_id', 'room_rate_id', 'pricing_schedule_id',
          'schedule_tier_id', 'pricing_occupancy', 'minimum_nights', 'currency',
          'before_price', 'after_price', 'before_version', 'after_version',
        ]) || item.room_key !== reviewed.room_key
          || item.room_type_id !== reviewed.room_type_id
          || item.room_rate_id !== reviewed.room_rate_id
          || item.pricing_schedule_id !== reviewed.pricing_schedule_id
          || item.schedule_tier_id !== reviewed.schedule_tier_id
          || item.pricing_occupancy !== reviewed.guest_count
          || item.minimum_nights !== reviewed.minimum_nights
          || item.currency !== reviewed.currency
          || item.before_price !== reviewed.before_price
          || item.after_price !== reviewed.requested_price
          || item.before_version !== reviewed.before_tier_version
          || item.after_version !== reviewed.before_tier_version + 1) {
          throw new Error('Accepted 7 Arches pricing Save changed-item evidence differs from the reviewed plan.');
        }
      });
    } else if (value.receipt_sequence !== null || value.receipt_id !== null
        || value.receipt_hash !== null || value.changed_items.length) {
      throw new Error('Rejected 7 Arches pricing proposal unexpectedly returned mutation evidence.');
    }
    validateSevenArchesReviewedPricingImpacts(value.commercial_impacts);
    validateSevenArchesReviewedPricingCommission(value.commission_policy);
    return Object.freeze(clone(value));
  }

  function canonicalPricingDescriptionI18n(value, maximumLength = 5000) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (!keys.every((key) => LANGUAGES.includes(key))) return null;
    const canonical = {};
    for (const key of keys) {
      if (typeof value[key] !== 'string') return null;
      const normalized = value[key].replace(/\r\n?/g, '\n');
      if (normalized !== normalized.trim()
          || normalized.length < 1 || normalized.length > maximumLength
          || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(normalized)) return null;
      canonical[key] = normalized;
    }
    return canonical;
  }

  function isExactPricingDescriptionI18n(value, maximumLength = 5000) {
    const canonical = canonicalPricingDescriptionI18n(value, maximumLength);
    return canonical !== null && JSON.stringify(canonical) === JSON.stringify(value);
  }

  function isExactCancellationPolicy(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const allowed = new Set(['type', 'deadline_hours', 'penalty_mode', 'penalty_value', 'reason']);
    if (Object.keys(value).some((key) => !allowed.has(key))
        || !['flexible', 'non_refundable', 'custom', 'requires_review'].includes(value.type)) return false;
    if (value.type === 'requires_review') {
      return !Object.hasOwn(value, 'deadline_hours')
        && !Object.hasOwn(value, 'penalty_mode')
        && !Object.hasOwn(value, 'penalty_value')
        && typeof value.reason === 'string'
        && value.reason === value.reason.trim()
        && value.reason.length >= 1 && value.reason.length <= 160
        && !/[\u0000-\u001f\u007f]/.test(value.reason);
    }
    if (Object.hasOwn(value, 'reason')) return false;
    if (value.type !== 'custom') {
      return !Object.hasOwn(value, 'deadline_hours')
        && !Object.hasOwn(value, 'penalty_mode')
        && !Object.hasOwn(value, 'penalty_value');
    }
    if (!isExactInteger(value.deadline_hours, 0, 87600)
        || !['none', 'flat', 'percent'].includes(value.penalty_mode)) return false;
    if (value.penalty_mode === 'none') {
      return !Object.hasOwn(value, 'penalty_value');
    }
    return isExactMoney(value.penalty_value, 0,
      value.penalty_mode === 'percent' ? 100 : 9999999999.99);
  }

  function normalizePricingControl(value) {
    const source = asObject(value);
    const property = asObject(source.property);
    const roomTypes = asArray(source.room_types).map((entry) => ({
      ...clone(asObject(entry)),
      id: normalizeUuid(entry?.id),
      hotel_id: normalizeUuid(entry?.hotel_id),
      name_i18n: normalizeI18n(entry?.name_i18n),
    }));
    const ratePlans = asArray(source.rate_plans).map((entry) => ({
      ...normalizeRatePlan(entry),
      price_inclusions: normalizeStringSet(entry?.price_inclusions),
      lifecycle_status: asText(entry?.lifecycle_status) || (entry?.is_active === true ? 'active' : 'inactive'),
      review_status: asText(entry?.review_status) || null,
      review_basis: clone(entry?.review_basis ?? null),
      protected: entry?.protected === true,
      immutable_contract: clone(entry?.immutable_contract ?? null),
      activation_blockers: asArray(entry?.activation_blockers).map((item) => clone(item)),
      mutation_blockers: asArray(entry?.mutation_blockers).map((item) => clone(item)),
    }));
    const roomRates = asArray(source.room_rates).map((entry) => ({
      ...normalizeRoomRate(entry),
      pricing_source: asText(entry?.pricing_source) || (entry?.pricing_schedule_id ? 'pricing_schedule' : 'base_nightly_rate'),
      base_nightly_rate_authoritative: entry?.base_nightly_rate_authoritative === true,
      lifecycle_status: asText(entry?.lifecycle_status) || (entry?.is_active === true ? 'active' : 'inactive'),
      review_status: asText(entry?.review_status) || null,
      review_basis: clone(entry?.review_basis ?? null),
      independent_tiers: asArray(entry?.independent_tiers).map((tier) => ({
        ...clone(asObject(tier)),
        id: normalizeUuid(tier?.id),
        hotel_id: normalizeUuid(tier?.hotel_id),
        room_rate_id: normalizeUuid(tier?.room_rate_id),
        guest_count: asInteger(tier?.guest_count, 0),
        threshold_nights: asInteger(tier?.threshold_nights, 0),
        nightly_rate: asNumber(tier?.nightly_rate, null),
        is_active: tier?.is_active !== false,
        version: asInteger(tier?.version, 0),
      })).sort((a, b) => a.guest_count - b.guest_count || a.threshold_nights - b.threshold_nights || String(a.id).localeCompare(String(b.id))),
      independent_tiers_fingerprint: asNullableText(entry?.independent_tiers_fingerprint),
      protected: entry?.protected === true,
      immutable_contract: clone(entry?.immutable_contract ?? null),
      activation_blockers: asArray(entry?.activation_blockers).map((item) => clone(item)),
      mutation_blockers: asArray(entry?.mutation_blockers).map((item) => clone(item)),
    }));
    const schedules = asArray(source.pricing_schedules).map((entry) => ({
      ...clone(asObject(entry)),
      id: normalizeUuid(entry?.id),
      hotel_id: normalizeUuid(entry?.hotel_id),
      name_i18n: normalizeI18n(entry?.name_i18n),
      linked_room_rate_ids: asArray(entry?.linked_room_rate_ids).map(normalizeUuid).filter(Boolean).sort(),
      tiers: asArray(entry?.tiers).map((tier) => ({
        ...clone(asObject(tier)),
        id: normalizeUuid(tier?.id),
        schedule_id: normalizeUuid(tier?.schedule_id || entry?.id),
        guest_count: asInteger(tier?.guest_count, 0),
        threshold_nights: asInteger(tier?.threshold_nights, 0),
        nightly_rate: asNumber(tier?.nightly_rate, null),
        is_active: tier?.is_active !== false,
        version: Math.max(0, asInteger(tier?.version, 0)),
      })).sort((a, b) => a.guest_count - b.guest_count || a.threshold_nights - b.threshold_nights || String(a.id).localeCompare(String(b.id))),
      lifecycle_status: asText(entry?.lifecycle_status) || (entry?.is_active === true ? 'active' : 'inactive'),
      review_status: asText(entry?.review_status) || null,
      sharing_mode: asText(entry?.sharing_mode),
      protected: entry?.protected === true,
      immutable_contract: clone(entry?.immutable_contract ?? null),
      activation_blockers: asArray(entry?.activation_blockers).map((item) => clone(item)),
      mutation_blockers: asArray(entry?.mutation_blockers).map((item) => clone(item)),
      version: asInteger(entry?.version, 0),
    }));
    const normalizeVersioned = (entry) => ({
      ...clone(asObject(entry)),
      id: normalizeUuid(entry?.id),
      hotel_id: normalizeUuid(entry?.hotel_id),
      version: asInteger(entry?.version, 0),
      protected: entry?.protected === true,
      mutation_blockers: asArray(entry?.mutation_blockers).map((item) => clone(item)),
    });
    const propertyPricingDefault = source.property_pricing_default == null
      ? null
      : normalizeVersioned(source.property_pricing_default);
    return {
      contract_version: asText(source.contract_version),
      hotel_id: normalizeUuid(source.hotel_id),
      property: clone(property),
      feature_flags: clone(asObject(source.feature_flags)),
      legacy_safety: clone(asObject(source.legacy_safety)),
      snapshot_token: asText(source.snapshot_token),
      rate_plans: ratePlans,
      room_types: roomTypes,
      room_rates: roomRates,
      pricing_schedules: schedules,
      rate_rules: asArray(source.rate_rules).map(normalizeVersioned),
      exact_date_prices: asArray(source.exact_date_prices).map(normalizeVersioned),
      allocation_rules: asArray(source.allocation_rules).map(normalizeVersioned),
      property_pricing_default: propertyPricingDefault,
      recent_activity: asArray(source.recent_activity).map((entry) => clone(entry)),
    };
  }

  function validatePricingControl(value, expectedHotelId = null) {
    const exactTopLevelKeys = [
      'contract_version', 'hotel_id', 'property', 'feature_flags', 'legacy_safety',
      'snapshot_token', 'rate_plans', 'room_types', 'room_rates', 'pricing_schedules',
      'rate_rules', 'exact_date_prices', 'allocation_rules', 'property_pricing_default',
      'recent_activity',
    ];
    const raw = asObject(value);
    if (!hasExactKeys(raw, exactTopLevelKeys)) throw new Error('The pricing control response has an unexpected field envelope.');
    for (const key of ['rate_plans', 'room_types', 'room_rates', 'pricing_schedules', 'rate_rules', 'exact_date_prices', 'allocation_rules', 'recent_activity']) {
      if (!Array.isArray(raw[key])) throw new Error(`The pricing control ${key.replaceAll('_', ' ')} collection is invalid.`);
    }
    const collectionCeilings = Object.fromEntries(
      ['rate_plans', 'room_types', 'room_rates', 'pricing_schedules', 'rate_rules',
        'exact_date_prices', 'allocation_rules', 'recent_activity']
        .map((key) => [key, PRICING_CONTROL_READ_LIMITS[key]]),
    );
    const nestedCeilingsExceeded = raw.pricing_schedules
      .reduce((count, schedule) => count + asArray(schedule?.tiers).length, 0) > PRICING_CONTROL_READ_LIMITS.schedule_tiers
      || raw.room_rates.reduce((count, rate) => count + asArray(rate?.independent_tiers).length, 0) > PRICING_CONTROL_READ_LIMITS.independent_tiers
      || raw.allocation_rules.reduce((count, rule) => count + asArray(rule?.items).length, 0) > PRICING_CONTROL_READ_LIMITS.allocation_items;
    if (Object.entries(collectionCeilings).some(([key, maximum]) => raw[key].length > maximum)
        || nestedCeilingsExceeded
        || jsonUtf8ByteLength(raw) > PRICING_CONTROL_READ_LIMITS.snapshot_bytes) {
      throw new Error('The pricing control response exceeds the reviewed technical capacity limit. Narrow or archive configuration before retrying; no mutation was attempted.');
    }
    const propertyKeys = [
      'id', 'updated_at', 'architecture_version', 'currency',
      'minimum_stay_nights', 'maximum_stay_nights', 'children_policy',
      'minimum_child_age', 'booking_mode',
    ];
    const flagKeys = [
      'hotel_rooms_v2_enabled', 'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled',
    ];
    const legacyKeys = [
      'architecture_version', 'legacy_pricing_authoritative',
      'legacy_pricing_rule_count', 'legacy_pricing_fingerprint', 'public_change',
    ];
    const immutableContractIsExact = (contract) => contract === null || (
      hasExactKeys(contract, ['locked', 'contract_version', 'reason'])
      && contract.locked === true
      && [
        'seven_kamares_legacy_to_h3_pricing_v1:accepted_h3_1p_hotel_pricing_graph',
        'pricing_source_provenance_v1:nonmanual_source_read_only',
        'pre_admin_c_calendar_pricing_v1:legacy_exact_pricing_read_only',
      ].includes(`${contract.contract_version}:${contract.reason}`)
    );
    const immutableContractMatches = (contract, contractVersion, reason) => (
      immutableContractIsExact(contract)
      && contract !== null
      && contract.contract_version === contractVersion
      && contract.reason === reason
    );
    const activationBlockersAreExact = (blockers) => Array.isArray(blockers)
      && blockers.every((blocker) => typeof blocker === 'string'
        && blocker === blocker.trim() && blocker.length > 0);
    const recentActivityKeys = [
      'id', 'entity_type', 'entity_id', 'action', 'correlation_id', 'actor_type',
      'actor_id', 'source', 'created_at', 'before_state', 'after_state',
    ];
    const jsonStateIsExact = (state) => state === null || (
      typeof state === 'object' && !Array.isArray(state)
      && JSON.stringify(state).length <= 200000
    );
    const activityActions = new Set(['create', 'update', 'disable', 'duplicate', 'delete']);
    const activityStateKeySets = {
      rate_plan: [[
        'code', 'name_i18n', 'description_i18n', 'meal_plan_code',
        'cancellation_policy', 'booking_mode_override', 'price_inclusions',
        'lifecycle_status', 'sort_order',
      ]],
      room_rate: [[
        'room_type_id', 'rate_plan_id', 'pricing_schedule_id', 'base_nightly_rate',
        'currency', 'external_redirect_url', 'lifecycle_status', 'sort_order',
      ]],
      pricing_schedule: [[
        'code', 'name_i18n', 'application_scope', 'currency', 'maximum_party_size',
        'minimum_billable_occupancy', 'sharing_mode', 'lifecycle_status', 'tiers',
      ], [
        'code', 'name_i18n', 'application_scope', 'currency', 'maximum_party_size',
        'minimum_billable_occupancy', 'sharing_mode', 'lifecycle_status',
        'tiers_fingerprint',
      ], [
        'source_schedule_id', 'target_schedule_id', 'sharing_mode',
        'lifecycle_status', 'tiers_fingerprint',
      ]],
      occupancy_tier: [['tiers'], ['tiers', 'tiers_fingerprint']],
      rate_rule: [[
        'room_rate_id', 'valid_from', 'valid_to', 'weekdays', 'nightly_rate',
        'minimum_stay', 'maximum_stay', 'closed_to_arrival',
        'closed_to_departure', 'priority', 'is_active',
      ]],
      calendar_override: [[
        'nightly_rate_mode', 'nightly_rate', 'minimum_stay_mode', 'minimum_stay',
        'maximum_stay_mode', 'maximum_stay', 'reason', 'expires_at',
        'pricing_source', 'pricing_actor_type', 'pricing_actor_id',
        'pricing_updated_at', 'pricing_correlation_id',
      ]],
      allocation_rule: [[
        'code', 'allocation_mode', 'min_guest_count', 'max_guest_count',
        'lifecycle_status', 'sort_order', 'items',
      ], [
        'code', 'allocation_mode', 'min_guest_count', 'max_guest_count',
        'lifecycle_status', 'sort_order', 'items_fingerprint',
      ]],
      property_pricing_default: [['nightly_rate', 'currency', 'lifecycle_status']],
    };
    const activityTierIsExact = (tier, parentKey, options = {}) => {
      const keys = [
        'id', ...(options.hotelId ? ['hotel_id'] : []), parentKey, 'guest_count',
        'threshold_nights', 'nightly_rate', 'is_active', 'version',
      ];
      return hasExactKeys(tier, keys)
        && Boolean(normalizeUuid(tier.id))
        && Boolean(normalizeUuid(tier[parentKey]))
        && (!options.hotelId || Boolean(normalizeUuid(tier.hotel_id)))
        && isExactInteger(tier.guest_count, 1, 50)
        && isExactInteger(tier.threshold_nights, 1, 3650)
        && isExactMoney(tier.nightly_rate)
        && typeof tier.is_active === 'boolean'
        && isExactInteger(tier.version, 0, Number.MAX_SAFE_INTEGER);
    };
    const activityAllocationItemIsExact = (item) => {
      if (!hasExactKeys(item, [
        'id', 'hotel_id', 'allocation_rule_id', 'room_type_id', 'units_required',
        'allocated_guest_count', 'pricing_guest_count', 'allocated_guest_counts',
        'pricing_guest_counts', 'sort_order',
      ]) || !normalizeUuid(item.id) || !normalizeUuid(item.hotel_id)
          || !normalizeUuid(item.allocation_rule_id) || !normalizeUuid(item.room_type_id)
          || !isExactInteger(item.units_required, 1, 50)
          || !isExactInteger(item.sort_order, 0, 1000000)) return false;
      const physical = item.allocated_guest_counts;
      const priced = item.pricing_guest_counts;
      const exactCounts = (counts) => counts === null || (Array.isArray(counts)
        && counts.length === item.units_required
        && counts.every((count) => isExactInteger(count, 1, 50)));
      return (item.allocated_guest_count === null
          || isExactInteger(item.allocated_guest_count, 1, 2500))
        && (item.pricing_guest_count === null
          || isExactInteger(item.pricing_guest_count, 1, 2500))
        && exactCounts(physical) && exactCounts(priced)
        && (physical === null
          || item.allocated_guest_count === physical.reduce((sum, count) => sum + count, 0))
        && (priced === null
          || item.pricing_guest_count === priced.reduce((sum, count) => sum + count, 0));
    };
    const activityExactDateStateIsExact = (state) => {
      if (!hasExactKeys(state, activityStateKeySets.calendar_override[0])) return false;
      const modes = ['nightly_rate', 'minimum_stay', 'maximum_stay'];
      const configured = modes.some((field) => state[`${field}_mode`] !== null);
      if (!configured) {
        return modes.every((field) => state[`${field}_mode`] === null && state[field] === null)
          && state.reason === null && state.expires_at === null
          && state.pricing_source === null && state.pricing_actor_type === null
          && state.pricing_actor_id === null && state.pricing_updated_at === null
          && state.pricing_correlation_id === null;
      }
      if (state.pricing_source !== 'manual'
          || state.pricing_actor_type !== 'admin'
          || !normalizeUuid(state.pricing_actor_id)
          || !isExactIsoTimestamp(state.pricing_updated_at)
          || !normalizeUuid(state.pricing_correlation_id)
          || typeof state.reason !== 'string' || state.reason !== state.reason.trim()
          || !state.reason || state.reason.length > 500
          || !(state.expires_at === null || isExactIsoTimestamp(state.expires_at))) return false;
      return configured
        && modes.every((field) => {
          const mode = state[`${field}_mode`];
          const stateValue = state[field];
          return [null, 'set', 'clear'].includes(mode)
            && ((mode === null || mode === 'clear') ? stateValue === null
              : field === 'nightly_rate'
                ? isExactMoney(stateValue)
                : isExactInteger(stateValue, 1, 3650));
        })
        && (state.minimum_stay === null || state.maximum_stay === null
          || state.maximum_stay >= state.minimum_stay);
    };
    const activityStateIsExact = (entity, state) => {
      if (state === null || !activityStateKeySets[entity]?.some((keys) => hasExactKeys(state, keys))) return false;
      if (entity === 'rate_plan') {
        return typeof state.code === 'string' && /^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(state.code)
          && isExactI18n(state.name_i18n, 240) && isExactPricingDescriptionI18n(state.description_i18n, 5000)
          && (state.meal_plan_code === null || (typeof state.meal_plan_code === 'string'
            && /^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(state.meal_plan_code)))
          && isExactCancellationPolicy(state.cancellation_policy)
          && (state.booking_mode_override === null || BOOKING_MODES.includes(state.booking_mode_override))
          && Array.isArray(state.price_inclusions) && state.price_inclusions.length <= 200
          && state.price_inclusions.every((entry) => typeof entry === 'string'
            && entry === entry.trim() && entry.length > 0)
          && new Set(state.price_inclusions).size === state.price_inclusions.length
          && PRICING_LIFECYCLE_STATUSES.includes(state.lifecycle_status)
          && isExactInteger(state.sort_order, 0, 1000000);
      }
      if (entity === 'room_rate') return Boolean(normalizeUuid(state.room_type_id))
        && Boolean(normalizeUuid(state.rate_plan_id))
        && (state.pricing_schedule_id === null || Boolean(normalizeUuid(state.pricing_schedule_id)))
        && isExactMoney(state.base_nightly_rate)
        && typeof state.currency === 'string' && /^[A-Z]{3}$/.test(state.currency)
        && (state.external_redirect_url === null || isExactHttpsUrl(state.external_redirect_url))
        && PRICING_LIFECYCLE_STATUSES.includes(state.lifecycle_status)
        && isExactInteger(state.sort_order, 0, 1000000);
      if (entity === 'pricing_schedule') {
        if (Object.hasOwn(state, 'source_schedule_id')) return normalizeUuid(state.source_schedule_id)
          && normalizeUuid(state.target_schedule_id)
          && PRICING_SCHEDULE_SHARING_MODES.includes(state.sharing_mode)
          && state.lifecycle_status === 'draft'
          && isExactFingerprint(state.tiers_fingerprint, false);
        const exactParent = typeof state.code === 'string'
          && /^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(state.code)
          && isExactI18n(state.name_i18n, 240)
          && state.application_scope === 'room_occupancy'
          && typeof state.currency === 'string' && /^[A-Z]{3}$/.test(state.currency)
          && isExactInteger(state.maximum_party_size, 1, 50)
          && isExactInteger(state.minimum_billable_occupancy, 1, state.maximum_party_size)
          && PRICING_SCHEDULE_SHARING_MODES.includes(state.sharing_mode)
          && PRICING_LIFECYCLE_STATUSES.includes(state.lifecycle_status);
        if (!exactParent) return false;
        if (Object.hasOwn(state, 'tiers_fingerprint')) return isExactFingerprint(state.tiers_fingerprint, false);
        return Array.isArray(state.tiers) && state.tiers.length <= 500
          && state.tiers.every((tier) => activityTierIsExact(tier, 'schedule_id'));
      }
      if (entity === 'occupancy_tier') return Array.isArray(state.tiers)
        && state.tiers.length <= 500
        && state.tiers.every((tier) => activityTierIsExact(tier, 'room_rate_id', { hotelId: true }))
        && (!Object.hasOwn(state, 'tiers_fingerprint')
          || isExactFingerprint(state.tiers_fingerprint, false));
      if (entity === 'rate_rule') return normalizeUuid(state.room_rate_id)
        && isExactIsoDate(state.valid_from) && isExactIsoDate(state.valid_to)
        && state.valid_to >= state.valid_from
        && Array.isArray(state.weekdays) && state.weekdays.length >= 1
        && state.weekdays.length <= 7
        && state.weekdays.every((day) => isExactInteger(day, 1, 7))
        && new Set(state.weekdays).size === state.weekdays.length
        && isExactMoney(state.nightly_rate)
        && (state.minimum_stay === null || isExactInteger(state.minimum_stay, 1, 3650))
        && (state.maximum_stay === null || isExactInteger(state.maximum_stay, 1, 3650))
        && (state.minimum_stay === null || state.maximum_stay === null
          || state.maximum_stay >= state.minimum_stay)
        && typeof state.closed_to_arrival === 'boolean'
        && typeof state.closed_to_departure === 'boolean'
        && isExactInteger(state.priority, -32768, 32767)
        && typeof state.is_active === 'boolean';
      if (entity === 'calendar_override') return activityExactDateStateIsExact(state);
      if (entity === 'allocation_rule') {
        const exactParent = typeof state.code === 'string'
          && /^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(state.code)
          && ROOM_ALLOCATION_MODES.includes(state.allocation_mode)
          && isExactInteger(state.min_guest_count, 1, 50)
          && isExactInteger(state.max_guest_count, state.min_guest_count, 50)
          && PRICING_LIFECYCLE_STATUSES.includes(state.lifecycle_status)
          && isExactInteger(state.sort_order, 0, 1000000);
        if (!exactParent) return false;
        if (Object.hasOwn(state, 'items_fingerprint')) return isExactFingerprint(state.items_fingerprint, false);
        return Array.isArray(state.items) && state.items.length <= 100
          && state.items.every(activityAllocationItemIsExact);
      }
      return entity === 'property_pricing_default'
        && isExactMoney(state.nightly_rate, 0.01)
        && typeof state.currency === 'string' && /^[A-Z]{3}$/.test(state.currency)
        && PRICING_LIFECYCLE_STATUSES.includes(state.lifecycle_status);
    };
    const activitySourceIsExact = (activity) => {
      if (activity.source === 'hotels_v2_admin_c_pricing_control') {
        if (activity.actor_type !== 'admin' || activity.action === 'delete') return false;
        const beforeIsExpected = activity.action === 'create' || activity.action === 'duplicate'
          ? activity.before_state === null
          : activityStateIsExact(activity.entity_type, activity.before_state);
        const afterIsExpected = activity.action === 'disable'
          && activity.entity_type === 'calendar_override'
          && activity.after_state === null
          ? true
          : activityStateIsExact(activity.entity_type, activity.after_state);
        return beforeIsExpected && afterIsExpected;
      }
      return activity.source === 'historical_pricing_activity'
        && activity.before_state === null
        && activity.after_state === null;
    };
    if (!hasExactKeys(raw.property, propertyKeys)
        || !normalizeUuid(raw.property.id)
        || !isExactIsoTimestamp(raw.property.updated_at)
        || !['legacy', 'rooms_v2'].includes(raw.property.architecture_version)
        || typeof raw.property.currency !== 'string'
        || !/^[A-Z]{3}$/.test(raw.property.currency)
        || !(raw.property.minimum_stay_nights === null
          || isExactInteger(raw.property.minimum_stay_nights, 1, 3650))
        || !(raw.property.maximum_stay_nights === null
          || isExactInteger(raw.property.maximum_stay_nights, 1, 3650))
        || (raw.property.minimum_stay_nights !== null
          && raw.property.maximum_stay_nights !== null
          && raw.property.maximum_stay_nights < raw.property.minimum_stay_nights)
        || !(raw.property.children_policy === null
          || CHILDREN_POLICIES.includes(raw.property.children_policy))
        || !(raw.property.minimum_child_age === null
          || isExactInteger(raw.property.minimum_child_age, CHILD_AGE_MIN, CHILD_AGE_MAX))
        || !BOOKING_MODES.includes(raw.property.booking_mode)) {
      throw new Error('The pricing control property snapshot is invalid.');
    }
    if (!hasExactKeys(raw.feature_flags, flagKeys)
        || flagKeys.some((key) => typeof raw.feature_flags[key] !== 'boolean')) {
      throw new Error('The pricing control feature-flag snapshot is invalid.');
    }
    if (!hasExactKeys(raw.legacy_safety, legacyKeys)
        || raw.legacy_safety.architecture_version !== raw.property.architecture_version
        || typeof raw.legacy_safety.legacy_pricing_authoritative !== 'boolean'
        || raw.legacy_safety.legacy_pricing_authoritative !== (raw.property.architecture_version === 'legacy')
        || !(raw.legacy_safety.legacy_pricing_rule_count === null
          || isExactInteger(raw.legacy_safety.legacy_pricing_rule_count, 0, 1000000))
        || !isExactFingerprint(raw.legacy_safety.legacy_pricing_fingerprint)
        || raw.legacy_safety.public_change !== false) {
      throw new Error('The pricing control legacy-safety snapshot is invalid.');
    }
    if (!isExactSnapshotToken(raw.snapshot_token)) {
      throw new Error('The pricing control snapshot token is invalid.');
    }
    raw.recent_activity.forEach((activity) => {
      if (!hasExactKeys(activity, recentActivityKeys)
          || !normalizeUuid(activity.id)
          || !normalizeUuid(activity.entity_id)
          || !normalizeUuid(activity.correlation_id)
          || !['admin', 'partner', 'sync', 'system'].includes(activity.actor_type)
          || (['admin', 'partner'].includes(activity.actor_type) && !normalizeUuid(activity.actor_id))
          || !(activity.actor_id === null || normalizeUuid(activity.actor_id))
          || typeof activity.entity_type !== 'string' || !activity.entity_type
          || !activityActions.has(activity.action)
          || !activitySourceIsExact(activity)
          || !isExactIsoTimestamp(activity.created_at)
          || !jsonStateIsExact(activity.before_state)
          || !jsonStateIsExact(activity.after_state)) {
        throw new Error('The pricing control activity projection is invalid.');
      }
    });
    const exactRowKeys = {
      room_types: [
        'id', 'hotel_id', 'code', 'name_i18n', 'status', 'max_occupancy',
        'capacity_adults', 'capacity_children', 'children_policy_override',
        'minimum_child_age_override', 'inventory_mode', 'base_inventory_count',
        'active_unit_count', 'version', 'updated_at',
      ],
      rate_plans: [
        'id', 'hotel_id', 'code', 'name_i18n', 'description_i18n', 'meal_plan_code',
        'cancellation_policy', 'booking_mode_override', 'price_inclusions', 'is_active',
        'review_status', 'lifecycle_status', 'review_basis', 'sort_order', 'version',
        'updated_at', 'immutable_contract', 'activation_blockers',
      ],
      room_rates: [
        'id', 'hotel_id', 'room_type_id', 'rate_plan_id', 'pricing_schedule_id',
        'base_nightly_rate', 'currency', 'external_redirect_url', 'is_active',
        'review_status', 'lifecycle_status', 'review_basis', 'sort_order', 'version',
        'updated_at', 'pricing_source', 'base_nightly_rate_authoritative',
        'independent_tiers', 'independent_tiers_fingerprint', 'immutable_contract',
        'activation_blockers',
      ],
      pricing_schedules: [
        'id', 'hotel_id', 'code', 'name_i18n', 'application_scope', 'currency',
        'maximum_party_size', 'minimum_billable_occupancy', 'is_active',
        'review_status', 'lifecycle_status', 'source', 'source_reference', 'version',
        'updated_at', 'linked_room_rate_ids', 'link_fingerprint', 'sharing_mode',
        'tiers', 'tiers_fingerprint', 'immutable_contract', 'activation_blockers',
      ],
      rate_rules: [
        'id', 'hotel_id', 'room_rate_id', 'valid_from', 'valid_to', 'weekdays',
        'nightly_rate', 'minimum_stay', 'maximum_stay', 'closed_to_arrival',
        'closed_to_departure', 'priority', 'is_active', 'source', 'version',
        'updated_at', 'immutable_contract',
      ],
      exact_date_prices: [
        'id', 'hotel_id', 'room_rate_id', 'stay_date', 'nightly_rate',
        'nightly_rate_mode', 'minimum_stay', 'minimum_stay_mode', 'maximum_stay',
        'maximum_stay_mode', 'pricing_active', 'pricing_source', 'pricing_reason',
        'pricing_expires_at', 'pricing_actor_type', 'pricing_actor_id',
        'pricing_updated_at', 'pricing_correlation_id', 'shared_with_calendar',
        'pricing_configured', 'version', 'updated_at', 'immutable_contract',
      ],
      allocation_rules: [
        'id', 'hotel_id', 'code', 'allocation_mode', 'min_guest_count',
        'max_guest_count', 'is_active', 'review_status', 'lifecycle_status',
        'sort_order', 'version', 'updated_at', 'items_fingerprint', 'items',
        'immutable_contract', 'activation_blockers',
      ],
    };
    Object.entries(exactRowKeys).forEach(([collection, keys]) => {
      raw[collection].forEach((row) => {
        if (!hasExactKeys(row, keys)) throw new Error(`The pricing control ${collection.replaceAll('_', ' ')} row has an unexpected field envelope.`);
      });
    });
    const propertyDefaultKeys = [
      'id', 'hotel_id', 'nightly_rate', 'currency', 'is_active', 'review_status',
      'lifecycle_status', 'version', 'updated_at', 'immutable_contract',
      'activation_blockers',
    ];
    if (raw.property_pricing_default !== null
        && !hasExactKeys(raw.property_pricing_default, propertyDefaultKeys)) {
      throw new Error('The property pricing default has an unexpected field envelope.');
    }
    for (const row of [...raw.rate_plans, ...raw.room_rates, ...raw.pricing_schedules, ...raw.rate_rules,
      ...raw.exact_date_prices, ...raw.allocation_rules,
      ...(raw.property_pricing_default ? [raw.property_pricing_default] : [])]) {
      if (!immutableContractIsExact(row.immutable_contract)) {
        throw new Error('A pricing control row returned an invalid immutable-contract marker.');
      }
    }
    for (const row of [...raw.rate_plans, ...raw.room_rates, ...raw.pricing_schedules, ...raw.allocation_rules,
      ...(raw.property_pricing_default ? [raw.property_pricing_default] : [])]) {
      if (!activationBlockersAreExact(row.activation_blockers)) {
        throw new Error('A pricing control row returned invalid activation blockers.');
      }
    }
    const exactTierKeys = [
      'id', 'hotel_id', 'room_rate_id', 'guest_count', 'threshold_nights',
      'nightly_rate', 'is_active', 'source', 'immutable_contract', 'version',
      'updated_at',
    ];
    raw.room_rates.forEach((rate) => {
      if (!Array.isArray(rate.independent_tiers)
          || rate.independent_tiers.length > 500
          || rate.independent_tiers.some((tier) => !hasExactKeys(tier, exactTierKeys)
            || !immutableContractIsExact(tier.immutable_contract))) {
        throw new Error('A Room Rate returned an invalid independent tier set.');
      }
    });
    const exactScheduleTierKeys = [
      'id', 'schedule_id', 'guest_count', 'threshold_nights', 'nightly_rate',
      'is_active', 'version', 'updated_at',
    ];
    raw.pricing_schedules.forEach((schedule) => {
      if (!Array.isArray(schedule.linked_room_rate_ids)
          || schedule.linked_room_rate_ids.length > 1000
          || !Array.isArray(schedule.tiers)
          || schedule.tiers.length > 500
          || schedule.tiers.some((tier) => !hasExactKeys(tier, exactScheduleTierKeys))) {
        throw new Error('A pricing schedule returned an invalid exact child set.');
      }
    });
    const exactAllocationItemKeys = [
      'id', 'hotel_id', 'allocation_rule_id', 'room_type_id', 'units_required',
      'allocated_guest_count', 'pricing_guest_count', 'allocated_guest_counts',
      'pricing_guest_counts', 'sort_order', 'version',
    ];
    raw.allocation_rules.forEach((rule) => {
      if (!Array.isArray(rule.items)
          || rule.items.length > 100
          || rule.items.some((item) => !hasExactKeys(item, exactAllocationItemKeys))) {
        throw new Error('An allocation rule returned an invalid exact child set.');
      }
    });
    const normalized = normalizePricingControl(value);
    const expected = normalizeUuid(expectedHotelId);
    if (normalized.contract_version !== PRICING_CONTROL_READ_CONTRACT
        || !normalized.hotel_id
        || (expected && normalized.hotel_id !== expected)
        || !normalized.snapshot_token
        || normalizeUuid(normalized.property?.id) !== normalized.hotel_id) {
      throw new Error('The pricing control response does not match this exact property.');
    }
    const requiredOffFlags = [
      'hotel_rooms_v2_enabled', 'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ];
    const architecture = asText(normalized.property?.architecture_version);
    if (typeof normalized.feature_flags.hotel_external_sync_enabled !== 'boolean'
        || requiredOffFlags.some((key) => normalized.feature_flags[key] !== false)
        || !['legacy', 'rooms_v2'].includes(architecture)
        || (normalized.hotel_id === SEVEN_ARCHES_PROPERTY_ID && architecture !== 'legacy')) {
      throw new Error('Pricing control requires a supported inert Hotel architecture, public Hotels V2 flags OFF, an exact External Calendar flag and the exact 7 Kamares legacy lock.');
    }
    if (normalized.hotel_id === SEVEN_ARCHES_PROPERTY_ID
        && (raw.legacy_safety.legacy_pricing_rule_count !== 63
          || raw.legacy_safety.legacy_pricing_fingerprint !== SEVEN_KAMARES_LEGACY_PRICING_FINGERPRINT
          || raw.legacy_safety.legacy_pricing_authoritative !== true)) {
      throw new Error('The accepted 7 Kamares legacy pricing fingerprint is not intact.');
    }
    const exactIds = [
      ...normalized.rate_plans, ...normalized.room_types, ...normalized.room_rates,
      ...normalized.pricing_schedules, ...normalized.rate_rules,
      ...normalized.exact_date_prices, ...normalized.allocation_rules,
      ...(normalized.property_pricing_default ? [normalized.property_pricing_default] : []),
    ];
    if (exactIds.some((entry) => !entry.id)) throw new Error('Pricing control returned a row without an exact identifier.');
    if (normalized.room_rates.some((rate) => (
      !normalized.room_types.some((room) => room.id === rate.room_type_id)
      || !normalized.rate_plans.some((plan) => plan.id === rate.rate_plan_id)
      || (rate.pricing_schedule_id && !normalized.pricing_schedules.some((schedule) => schedule.id === rate.pricing_schedule_id))
    ))) throw new Error('Pricing control returned a cross-property or missing product relationship.');
    const requireExactHotel = (rows) => rows.every((entry) => normalizeUuid(entry?.hotel_id) === normalized.hotel_id);
    if (!requireExactHotel(raw.rate_plans)
        || !requireExactHotel(raw.room_types)
        || !requireExactHotel(raw.room_rates)
        || !requireExactHotel(raw.pricing_schedules)
        || !requireExactHotel(raw.rate_rules)
        || !requireExactHotel(raw.exact_date_prices)
        || !requireExactHotel(raw.allocation_rules)
        || (raw.property_pricing_default !== null
          && normalizeUuid(raw.property_pricing_default.hotel_id) !== normalized.hotel_id)) {
      throw new Error('Pricing control returned a row outside the exact property.');
    }
    const requireUniqueExactIds = (rows) => {
      const ids = rows.map((entry) => normalizeUuid(entry?.id));
      return ids.every(Boolean) && new Set(ids).size === ids.length;
    };
    if (![raw.rate_plans, raw.room_types, raw.room_rates, raw.pricing_schedules, raw.rate_rules, raw.exact_date_prices, raw.allocation_rules]
      .every(requireUniqueExactIds)) {
      throw new Error('Pricing control returned a duplicate or malformed exact identifier.');
    }
    const roomRateIds = new Set(normalized.room_rates.map((rate) => rate.id));
    const roomTypeIds = new Set(normalized.room_types.map((room) => room.id));
    const ratePlanIds = new Set(normalized.rate_plans.map((plan) => plan.id));
    const scheduleIds = new Set(normalized.pricing_schedules.map((schedule) => schedule.id));
    if (raw.property_pricing_default && (
      !isExactMoney(raw.property_pricing_default.nightly_rate, 0.01)
      || raw.property_pricing_default.currency !== raw.property.currency
      || typeof raw.property_pricing_default.is_active !== 'boolean'
      || !H3_REVIEW_STATUSES.includes(raw.property_pricing_default.review_status)
      || !PRICING_LIFECYCLE_STATUSES.includes(raw.property_pricing_default.lifecycle_status)
      || !isExactIsoTimestamp(raw.property_pricing_default.updated_at)
    )) throw new Error('The property pricing default projection is invalid.');
    if (raw.rate_rules.some((row) => !roomRateIds.has(normalizeUuid(row.room_rate_id)))
        || raw.exact_date_prices.some((row) => !roomRateIds.has(normalizeUuid(row.room_rate_id)))) {
      throw new Error('Pricing control returned a foreign Room Rate child.');
    }
    if (raw.exact_date_prices.some((row) => (
      !isExactIsoDate(row.stay_date)
      || typeof row.pricing_active !== 'boolean'
      || typeof row.shared_with_calendar !== 'boolean'
      || typeof row.pricing_configured !== 'boolean'
      || !['set', 'clear', null].includes(row.nightly_rate_mode)
      || !['set', 'clear', null].includes(row.minimum_stay_mode)
      || !['set', 'clear', null].includes(row.maximum_stay_mode)
      || (row.nightly_rate_mode === null && row.nightly_rate !== null)
      || (row.minimum_stay_mode === null && row.minimum_stay !== null)
      || (row.maximum_stay_mode === null && row.maximum_stay !== null)
      || (row.nightly_rate_mode === 'set' && !isExactMoney(row.nightly_rate))
      || (row.minimum_stay_mode === 'set' && !isExactInteger(row.minimum_stay, 1, 3650))
      || (row.maximum_stay_mode === 'set' && !isExactInteger(row.maximum_stay, 1, 3650))
      || (row.nightly_rate_mode === 'clear' && row.nightly_rate !== null)
      || (row.minimum_stay_mode === 'clear' && row.minimum_stay !== null)
      || (row.maximum_stay_mode === 'clear' && row.maximum_stay !== null)
      || row.pricing_configured !== [row.nightly_rate_mode, row.minimum_stay_mode, row.maximum_stay_mode]
        .some((mode) => mode !== null)
    ))) throw new Error('Pricing control returned an invalid exact-date pricing projection.');
    if (raw.room_types.some((room) => (
      typeof room.code !== 'string' || !room.code
      || !isExactI18n(room.name_i18n, 240)
      || !ROOM_STATUSES.includes(room.status)
      || !(room.max_occupancy === null || isExactInteger(room.max_occupancy, 1, 50))
      || !(room.capacity_adults === null || isExactInteger(room.capacity_adults, 0, 50))
      || !(room.capacity_children === null || isExactInteger(room.capacity_children, 0, 50))
      || !(room.children_policy_override === null
        || ROOM_CHILDREN_POLICY_OVERRIDES.includes(room.children_policy_override))
      || !(room.minimum_child_age_override === null
        || isExactInteger(room.minimum_child_age_override, CHILD_AGE_MIN, CHILD_AGE_MAX))
      || (room.children_policy_override === 'minimum_age'
        ? room.minimum_child_age_override === null
        : room.minimum_child_age_override !== null)
      || !INVENTORY_MODES.includes(room.inventory_mode)
      || !isExactInteger(room.base_inventory_count, 0, 1000000)
      || !isExactInteger(room.active_unit_count, 0, 1000000)
      || !isExactIsoTimestamp(room.updated_at)
    ))) throw new Error('Pricing control returned an invalid Room Type projection.');
    if (raw.rate_plans.some((plan) => (
      typeof plan.code !== 'string' || !/^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(plan.code)
      || !isExactI18n(plan.name_i18n, 240) || !isExactPricingDescriptionI18n(plan.description_i18n, 5000)
      || !isExactCancellationPolicy(plan.cancellation_policy)
      || !(plan.meal_plan_code === null || (typeof plan.meal_plan_code === 'string'
        && /^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(plan.meal_plan_code)))
      || !(plan.booking_mode_override === null || BOOKING_MODES.includes(plan.booking_mode_override))
      || !Array.isArray(plan.price_inclusions)
      || plan.price_inclusions.length > 200
      || plan.price_inclusions.some((entry) => typeof entry !== 'string'
        || !/^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(entry))
      || new Set(plan.price_inclusions).size !== plan.price_inclusions.length
      || JSON.stringify(plan.price_inclusions) !== JSON.stringify([...plan.price_inclusions].sort())
      || typeof plan.is_active !== 'boolean'
      || !H3_REVIEW_STATUSES.includes(plan.review_status)
      || !PRICING_LIFECYCLE_STATUSES.includes(plan.lifecycle_status)
      || !['stored', 'h3_1p_promotion'].includes(plan.review_basis)
      || !isExactInteger(plan.sort_order, 0, 1000000)
      || !isExactIsoTimestamp(plan.updated_at)
    ))) throw new Error('Pricing control returned an invalid Rate Plan projection.');
    if (raw.room_rates.some((rate) => (
      !ratePlanIds.has(normalizeUuid(rate.rate_plan_id))
      || !roomTypeIds.has(normalizeUuid(rate.room_type_id))
      || !(rate.pricing_schedule_id === null || scheduleIds.has(normalizeUuid(rate.pricing_schedule_id)))
      || !isExactMoney(rate.base_nightly_rate)
      || typeof rate.currency !== 'string' || !/^[A-Z]{3}$/.test(rate.currency)
      || !(rate.external_redirect_url === null || isExactHttpsUrl(rate.external_redirect_url))
      || typeof rate.is_active !== 'boolean'
      || !H3_REVIEW_STATUSES.includes(rate.review_status)
      || !PRICING_LIFECYCLE_STATUSES.includes(rate.lifecycle_status)
      || !['stored', 'h3_1p_promotion'].includes(rate.review_basis)
      || !['pricing_schedule', 'independent_tiers', 'base_nightly_rate',
        'property_default', 'missing'].includes(rate.pricing_source)
      || typeof rate.base_nightly_rate_authoritative !== 'boolean'
      || !isExactFingerprint(rate.independent_tiers_fingerprint)
      || !isExactInteger(rate.sort_order, 0, 1000000)
      || !isExactIsoTimestamp(rate.updated_at)
    ))) throw new Error('Pricing control returned an invalid Room Rate projection.');
    const activeReviewedPropertyDefault = raw.property_pricing_default
      && raw.property_pricing_default.is_active === true
      && raw.property_pricing_default.review_status === 'reviewed'
      && raw.property_pricing_default.currency === raw.property.currency;
    if (raw.room_rates.some((rate) => {
      const expectedSource = rate.pricing_schedule_id !== null
        ? 'pricing_schedule'
        : rate.independent_tiers.some((tier) => tier.is_active === true)
          ? 'independent_tiers'
          : rate.base_nightly_rate > 0
            ? 'base_nightly_rate'
            : activeReviewedPropertyDefault && raw.property_pricing_default.currency === rate.currency
              ? 'property_default'
              : 'missing';
      return rate.pricing_source !== expectedSource
        || rate.base_nightly_rate_authoritative !== (expectedSource === 'base_nightly_rate');
    })) throw new Error('A Room Rate returned a pricing-source authority mismatch.');
    raw.room_rates.forEach((rate) => {
      if (!requireUniqueExactIds(rate.independent_tiers)
          || rate.independent_tiers.some((tier) => (
            normalizeUuid(tier.hotel_id) !== normalized.hotel_id
            || normalizeUuid(tier.room_rate_id) !== normalizeUuid(rate.id)
            || typeof tier.version !== 'number' || !Number.isInteger(tier.version) || tier.version < 1
            || typeof tier.guest_count !== 'number' || !Number.isInteger(tier.guest_count) || tier.guest_count < 1
            || typeof tier.threshold_nights !== 'number' || !Number.isInteger(tier.threshold_nights) || tier.threshold_nights < 1
            || !isExactMoney(tier.nightly_rate)
            || typeof tier.is_active !== 'boolean'
            || !['manual', 'legacy_preview', 'system'].includes(tier.source)
            || (tier.source === 'manual' && tier.immutable_contract !== null)
            || (tier.source !== 'manual' && !immutableContractMatches(
              tier.immutable_contract,
              'pricing_source_provenance_v1',
              'nonmanual_source_read_only',
            ))
            || !isExactIsoTimestamp(tier.updated_at)
          ))) throw new Error('Pricing control returned an invalid Room Rate tier relationship.');
    });
    raw.pricing_schedules.forEach((schedule) => {
      const scheduleId = normalizeUuid(schedule.id);
      const linkedIds = schedule.linked_room_rate_ids.map(normalizeUuid);
      if (!requireUniqueExactIds(schedule.tiers)
          || linkedIds.some((id) => !id || !roomRateIds.has(id))
          || new Set(linkedIds).size !== linkedIds.length
          || !PRICING_SCHEDULE_SHARING_MODES.includes(schedule.sharing_mode)
          || !isExactFingerprint(schedule.tiers_fingerprint)
          || !isExactFingerprint(schedule.link_fingerprint)
          || (schedule.sharing_mode === 'independent' && linkedIds.length > 1)
          || schedule.tiers.some((tier) => (
            normalizeUuid(tier.schedule_id) !== scheduleId
            || typeof tier.version !== 'number' || !Number.isInteger(tier.version) || tier.version < 1
            || typeof tier.guest_count !== 'number' || !Number.isInteger(tier.guest_count) || tier.guest_count < 1
            || typeof tier.threshold_nights !== 'number' || !Number.isInteger(tier.threshold_nights) || tier.threshold_nights < 1
            || !isExactMoney(tier.nightly_rate)
            || typeof tier.is_active !== 'boolean'
            || !isExactIsoTimestamp(tier.updated_at)
          ))) throw new Error('Pricing control returned an invalid schedule child or link relationship.');
    });
    const sourceReferenceIsExact = (schedule) => {
      const reference = schedule.source_reference;
      if (!hasExactKeys(reference, [
        'kind', 'cloned_from_schedule_id', 'pricing_model', 'pricing_fingerprint',
        'rule_count', 'guest_counts', 'migration_blocker',
      ]) || reference.kind !== schedule.source) return false;
      if (schedule.source === 'manual') {
        return (reference.cloned_from_schedule_id === null
            || Boolean(normalizeUuid(reference.cloned_from_schedule_id)))
          && reference.pricing_model === null
          && reference.pricing_fingerprint === null
          && reference.rule_count === null
          && reference.guest_counts === null
          && reference.migration_blocker === null;
      }
      if (schedule.source === 'system') {
        return reference.cloned_from_schedule_id === null
          && reference.pricing_model === null
          && reference.pricing_fingerprint === null
          && reference.rule_count === null
          && reference.guest_counts === null
          && reference.migration_blocker === null;
      }
      return schedule.source === 'legacy_preview'
        && reference.cloned_from_schedule_id === null
        && (reference.pricing_model === null || (typeof reference.pricing_model === 'string'
          && reference.pricing_model === reference.pricing_model.trim()
          && reference.pricing_model.length >= 1 && reference.pricing_model.length <= 80))
        && (reference.pricing_fingerprint === null
          || (typeof reference.pricing_fingerprint === 'string'
            && /^[0-9a-f]{32}$/.test(reference.pricing_fingerprint)))
        && (reference.rule_count === null || isExactInteger(reference.rule_count, 0, 500))
        && (reference.guest_counts === null || (Array.isArray(reference.guest_counts)
          && reference.guest_counts.length <= 50
          && reference.guest_counts.every((count) => isExactInteger(count, 1, 50))))
        && (reference.migration_blocker === null
          || (typeof reference.migration_blocker === 'string'
            && reference.migration_blocker === reference.migration_blocker.trim()
            && reference.migration_blocker.length >= 1
            && reference.migration_blocker.length <= 160));
    };
    if (raw.pricing_schedules.some((schedule) => (
      typeof schedule.code !== 'string' || !/^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(schedule.code)
      || !isExactI18n(schedule.name_i18n, 240)
      || !['room_occupancy', 'property_booking_party'].includes(schedule.application_scope)
      || typeof schedule.currency !== 'string' || !/^[A-Z]{3}$/.test(schedule.currency)
      || !isExactInteger(schedule.maximum_party_size, 1, 50)
      || !isExactInteger(schedule.minimum_billable_occupancy, 1, schedule.maximum_party_size)
      || typeof schedule.is_active !== 'boolean'
      || !H3_REVIEW_STATUSES.includes(schedule.review_status)
      || !PRICING_LIFECYCLE_STATUSES.includes(schedule.lifecycle_status)
      || !['manual', 'legacy_preview', 'system'].includes(schedule.source)
      || !sourceReferenceIsExact(schedule)
      || (schedule.source !== 'manual'
        && !immutableContractMatches(schedule.immutable_contract,
          'pricing_source_provenance_v1', 'nonmanual_source_read_only')
        && !immutableContractMatches(schedule.immutable_contract,
          'seven_kamares_legacy_to_h3_pricing_v1', 'accepted_h3_1p_hotel_pricing_graph'))
      || !isExactIsoTimestamp(schedule.updated_at)
    ))) throw new Error('Pricing control returned an invalid pricing schedule projection.');
    if (raw.rate_rules.some((rule) => (
      !isExactIsoDate(rule.valid_from) || !isExactIsoDate(rule.valid_to) || rule.valid_to < rule.valid_from
      || !Array.isArray(rule.weekdays) || !rule.weekdays.length
      || rule.weekdays.some((day) => !isExactInteger(day, 1, 7))
      || new Set(rule.weekdays).size !== rule.weekdays.length
      || !isExactMoney(rule.nightly_rate)
      || !(rule.minimum_stay === null || isExactInteger(rule.minimum_stay, 1, 3650))
      || !(rule.maximum_stay === null || isExactInteger(rule.maximum_stay, 1, 3650))
      || (rule.minimum_stay !== null && rule.maximum_stay !== null && rule.maximum_stay < rule.minimum_stay)
      || typeof rule.closed_to_arrival !== 'boolean' || typeof rule.closed_to_departure !== 'boolean'
      || !isExactInteger(rule.priority, -32768, 32767) || typeof rule.is_active !== 'boolean'
      || !['manual', 'legacy_preview', 'system'].includes(rule.source)
      || (rule.source !== 'manual'
        && !immutableContractMatches(rule.immutable_contract,
          'pricing_source_provenance_v1', 'nonmanual_source_read_only')
        && !immutableContractMatches(rule.immutable_contract,
          'seven_kamares_legacy_to_h3_pricing_v1', 'accepted_h3_1p_hotel_pricing_graph'))
      || !isExactIsoTimestamp(rule.updated_at)
    ))) throw new Error('Pricing control returned an invalid seasonal / weekday rule projection.');
    if (raw.exact_date_prices.some((row) => {
      const configured = row.pricing_configured === true;
      const actorNeedsId = ['admin', 'partner'].includes(row.pricing_actor_type);
      const legacyDerived = immutableContractMatches(
        row.immutable_contract,
        'pre_admin_c_calendar_pricing_v1',
        'legacy_exact_pricing_read_only',
      );
      return typeof row.pricing_active !== 'boolean'
        || !isExactIsoTimestamp(row.updated_at)
        || (!configured && (
          row.pricing_active !== false
          || row.pricing_source !== null || row.pricing_reason !== null
          || row.pricing_expires_at !== null || row.pricing_actor_type !== null
          || row.pricing_actor_id !== null || row.pricing_updated_at !== null
          || row.pricing_correlation_id !== null
        ))
        || (configured && (
          !(legacyDerived
            ? ['legacy_preview', 'manual', 'system'].includes(row.pricing_source)
            : ['manual', 'partner', 'sync', 'system'].includes(row.pricing_source))
          || typeof row.pricing_reason !== 'string'
          || row.pricing_reason !== row.pricing_reason.trim()
          || !row.pricing_reason || row.pricing_reason.length > 500
          || !(row.pricing_expires_at === null || isExactIsoTimestamp(row.pricing_expires_at))
          || !['admin', 'partner', 'sync', 'system'].includes(row.pricing_actor_type)
          || (actorNeedsId && !normalizeUuid(row.pricing_actor_id))
          || (!actorNeedsId && !(row.pricing_actor_id === null || normalizeUuid(row.pricing_actor_id)))
          || !isExactIsoTimestamp(row.pricing_updated_at)
          || (legacyDerived
            ? row.pricing_correlation_id !== null
            : !normalizeUuid(row.pricing_correlation_id))
        ));
    })) throw new Error('Pricing control returned invalid exact-date pricing provenance.');
    raw.allocation_rules.forEach((rule) => {
      const ruleId = normalizeUuid(rule.id);
      if (!requireUniqueExactIds(rule.items)
          || typeof rule.code !== 'string' || !rule.code
          || !ROOM_ALLOCATION_MODES.includes(rule.allocation_mode)
          || !isExactInteger(rule.min_guest_count, 1, 50)
          || !isExactInteger(rule.max_guest_count, rule.min_guest_count, 50)
          || typeof rule.is_active !== 'boolean'
          || !H3_REVIEW_STATUSES.includes(rule.review_status)
          || !PRICING_LIFECYCLE_STATUSES.includes(rule.lifecycle_status)
          || !isExactInteger(rule.sort_order, 0, 1000000)
          || !isExactFingerprint(rule.items_fingerprint)
          || !isExactIsoTimestamp(rule.updated_at)
          || rule.items.some((item) => (
            normalizeUuid(item.hotel_id) !== normalized.hotel_id
            || normalizeUuid(item.allocation_rule_id) !== ruleId
            || !roomTypeIds.has(normalizeUuid(item.room_type_id))
            || typeof item.version !== 'number' || !Number.isInteger(item.version) || item.version < 1
            || !isExactInteger(item.units_required, 1, 50)
            || !isExactInteger(item.sort_order, 0, 1000000)
            || !(item.allocated_guest_count === null
              || isExactInteger(item.allocated_guest_count, 1, 2500))
            || !(item.pricing_guest_count === null
              || isExactInteger(item.pricing_guest_count, 1, 2500))
            || !(item.allocated_guest_counts === null || (
              Array.isArray(item.allocated_guest_counts)
              && item.allocated_guest_counts.length === item.units_required
              && item.allocated_guest_counts.every((count) => isExactInteger(count, 1, 50))
              && item.allocated_guest_count === item.allocated_guest_counts.reduce((sum, count) => sum + count, 0)
            ))
            || !(item.pricing_guest_counts === null || (
              Array.isArray(item.pricing_guest_counts)
              && item.pricing_guest_counts.length === item.units_required
              && item.pricing_guest_counts.every((count) => isExactInteger(count, 1, 50))
              && item.pricing_guest_count === item.pricing_guest_counts.reduce((sum, count) => sum + count, 0)
            ))
          ))) throw new Error('Pricing control returned an invalid allocation child relationship.');
    });
    if (normalized.hotel_id === SEVEN_ARCHES_PROPERTY_ID) {
      const accepted = [
        ...raw.rate_plans, ...raw.room_rates, ...raw.pricing_schedules,
        ...raw.rate_rules, ...raw.exact_date_prices, ...raw.allocation_rules,
      ];
      if (accepted.some((row) => row.immutable_contract?.locked !== true
          || row.immutable_contract.reason !== 'accepted_h3_1p_hotel_pricing_graph')) {
        throw new Error('The accepted 7 Kamares ADMIN-C pricing graph is not uniformly immutable.');
      }
      if (raw.property_pricing_default !== null) {
        throw new Error('The accepted 7 Kamares pricing graph cannot contain a property pricing default.');
      }
    }
    const pricingActivityIds = {
      rate_plan: new Set(raw.rate_plans.map((row) => normalizeUuid(row.id))),
      room_rate: new Set(raw.room_rates.map((row) => normalizeUuid(row.id))),
      pricing_schedule: new Set(raw.pricing_schedules.map((row) => normalizeUuid(row.id))),
      occupancy_tier: new Set([
        ...raw.room_rates,
        ...raw.room_rates.flatMap((row) => row.independent_tiers),
        ...raw.pricing_schedules.flatMap((row) => row.tiers),
      ].map((row) => normalizeUuid(row.id))),
      rate_rule: new Set(raw.rate_rules.map((row) => normalizeUuid(row.id))),
      calendar_override: new Set(raw.exact_date_prices.map((row) => normalizeUuid(row.id))),
      allocation_rule: new Set(raw.allocation_rules.map((row) => normalizeUuid(row.id))),
      property_pricing_default: new Set(raw.property_pricing_default
        ? [normalizeUuid(raw.property_pricing_default.id)] : []),
    };
    if (raw.recent_activity.some((activity) => (
      !Object.hasOwn(pricingActivityIds, activity.entity_type)
      || !/^[a-z0-9_]+$/.test(activity.action)
      || !/^[a-z0-9_]+$/.test(activity.source)
    ))) throw new Error('Pricing control returned malformed or non-pricing activity.');
    const versionedRows = [
      ...raw.rate_plans, ...raw.room_types, ...raw.room_rates, ...raw.pricing_schedules,
      ...raw.rate_rules, ...raw.exact_date_prices, ...raw.allocation_rules,
      ...(raw.property_pricing_default ? [raw.property_pricing_default] : []),
    ];
    if (versionedRows.some((entry) => typeof entry.version !== 'number' || !Number.isInteger(entry.version) || entry.version < 1)) {
      throw new Error('Pricing control returned an invalid optimistic version.');
    }
    return normalized;
  }

  function validatePricingControlOperation(operation) {
    const source = asObject(operation);
    const exactKeys = [
      'entity', 'action', 'id', 'expected_version', 'expected_children_fingerprint',
      'expected_link_fingerprint', 'expected_linked_room_rate_ids',
      'shared_impact_acknowledged', 'activation_acknowledged', 'expected_original', 'payload',
    ];
    if (!hasExactKeys(source, exactKeys)
        || !PRICING_CONTROL_ENTITIES.includes(asText(source.entity))
        || !PRICING_CONTROL_ACTIONS.includes(asText(source.action))
        || (source.action === 'clone' && source.entity !== 'pricing_schedule')
        || (source.entity === 'room_rate_tier_set' && source.action !== 'update')
        || !normalizeUuid(source.id)
        || typeof source.expected_version !== 'number'
        || !Number.isInteger(source.expected_version)
        || source.expected_version < 0
        || !isExactFingerprint(source.expected_children_fingerprint)
        || !isExactFingerprint(source.expected_link_fingerprint)
        || !Array.isArray(source.expected_linked_room_rate_ids)
        || source.expected_linked_room_rate_ids.some((id) => !normalizeUuid(id))
        || source.expected_linked_room_rate_ids.length > 1000
        || new Set(source.expected_linked_room_rate_ids.map(normalizeUuid)).size !== source.expected_linked_room_rate_ids.length
        || typeof source.shared_impact_acknowledged !== 'boolean'
        || typeof source.activation_acknowledged !== 'boolean'
        || typeof source.expected_original !== 'object' || Array.isArray(source.expected_original) || source.expected_original == null
        || typeof source.payload !== 'object' || Array.isArray(source.payload) || source.payload == null) {
      throw new Error('Every pricing operation must use the exact reviewed operation envelope.');
    }
    if (source.action === 'create' && (source.expected_version !== 0 || Object.keys(source.expected_original).length)) {
      throw new Error('A pricing create must start from an exact empty original and version 0.');
    }
    if (source.action !== 'create' && source.action !== 'clone' && source.expected_version < 1) {
      throw new Error('A pricing update requires an exact positive version.');
    }
    const payloadKeys = {
      rate_plan: [
        'code', 'name_i18n', 'description_i18n', 'meal_plan_code',
        'cancellation_policy', 'booking_mode_override', 'price_inclusions',
        'lifecycle_status', 'sort_order',
      ],
      room_rate: [
        'room_type_id', 'rate_plan_id', 'pricing_schedule_id', 'base_nightly_rate',
        'currency', 'external_redirect_url', 'lifecycle_status', 'sort_order',
      ],
      pricing_schedule: [
        'code', 'name_i18n', 'application_scope', 'currency', 'maximum_party_size',
        'minimum_billable_occupancy', 'sharing_mode', 'lifecycle_status', 'tiers',
      ],
      room_rate_tier_set: ['tiers'],
      rate_rule: [
        'room_rate_id', 'valid_from', 'valid_to', 'weekdays', 'nightly_rate',
        'minimum_stay', 'maximum_stay', 'closed_to_arrival',
        'closed_to_departure', 'priority', 'is_active',
      ],
      allocation_rule: [
        'code', 'allocation_mode', 'min_guest_count', 'max_guest_count',
        'lifecycle_status', 'sort_order', 'items',
      ],
      property_pricing_default: ['nightly_rate', 'currency', 'lifecycle_status'],
    };
    const propertyDefaultCreate = ['hotel_id', 'nightly_rate', 'currency', 'lifecycle_status'];
    const exactDateCreate = [
      'hotel_id', 'room_rate_id', 'stay_date', 'nightly_rate_mode', 'nightly_rate',
      'minimum_stay_mode', 'minimum_stay', 'maximum_stay_mode', 'maximum_stay',
      'reason', 'expires_at',
    ];
    const exactDateUpdate = [
      'nightly_rate_mode', 'nightly_rate', 'minimum_stay_mode', 'minimum_stay',
      'maximum_stay_mode', 'maximum_stay', 'reason', 'expires_at',
    ];
    const cloneKeys = ['source_schedule_id', 'expected_source_version', 'code', 'name_i18n', 'sharing_mode', 'tiers'];
    if (source.action === 'disable') {
      if (Object.keys(source.payload).length) throw new Error('A pricing disable operation must have an exact empty payload.');
    } else {
      const expectedPayloadKeys = source.action === 'clone'
        ? cloneKeys
        : source.entity === 'exact_date_price'
          ? (source.action === 'create' ? exactDateCreate : exactDateUpdate)
          : source.entity === 'property_pricing_default' && source.action === 'create'
            ? propertyDefaultCreate
          : payloadKeys[source.entity];
      if (!expectedPayloadKeys || !hasExactKeys(source.payload, expectedPayloadKeys)) {
        throw new Error(`The ${source.entity} pricing payload has an unexpected field envelope.`);
      }
    }
    if (source.action === 'clone') {
      if (source.expected_version !== 0
          || !normalizeUuid(source.payload.source_schedule_id)
          || typeof source.payload.expected_source_version !== 'number'
          || !Number.isInteger(source.payload.expected_source_version)
          || source.payload.expected_source_version < 1
          || typeof source.payload.code !== 'string'
          || !/^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(source.payload.code)
          || !isExactI18n(source.payload.name_i18n, 240)
          || !PRICING_SCHEDULE_SHARING_MODES.includes(source.payload.sharing_mode)
          || !isExactFingerprint(source.expected_children_fingerprint, false)
          || !isExactFingerprint(source.expected_link_fingerprint, false)
          || (source.expected_linked_room_rate_ids.length > 0 && source.shared_impact_acknowledged !== true)) {
        throw new Error('A schedule clone must bind the exact source version and reviewed sharing mode.');
      }
    }
    const lifecycle = asText(source.payload.lifecycle_status);
    if (lifecycle && !PRICING_LIFECYCLE_STATUSES.includes(lifecycle)) {
      throw new Error('The pricing lifecycle state is invalid.');
    }
    if (source.action !== 'disable' && lifecycle === 'disabled') {
      throw new Error('Pricing must use the dedicated disable action; create/update cannot target disabled.');
    }
    if (lifecycle === 'active' && source.activation_acknowledged !== true) {
      throw new Error('Active pricing requires an explicit activation acknowledgement.');
    }
    if (source.entity === 'pricing_schedule' && source.action !== 'clone' && source.action !== 'disable') {
      if (!PRICING_SCHEDULE_SHARING_MODES.includes(source.payload.sharing_mode)
          || !Array.isArray(source.payload.tiers)) {
        throw new Error('A pricing schedule requires an exact sharing mode and complete tier set.');
      }
    }
    const validateTierRows = (tiers, keys, parentKey, parentId) => {
      if (!Array.isArray(tiers) || tiers.length > 500) return false;
      const ids = tiers.map((tier) => normalizeUuid(tier?.id));
      return ids.every(Boolean)
        && new Set(ids).size === ids.length
        && tiers.every((tier) => (
          hasExactKeys(tier, keys)
          && normalizeUuid(tier[parentKey]) === parentId
          && typeof tier.guest_count === 'number' && Number.isInteger(tier.guest_count) && tier.guest_count > 0
          && typeof tier.threshold_nights === 'number' && Number.isInteger(tier.threshold_nights) && tier.threshold_nights > 0
          && isExactMoney(tier.nightly_rate)
          && typeof tier.is_active === 'boolean'
          && typeof tier.version === 'number' && Number.isInteger(tier.version) && tier.version >= 0
        ));
    };
    const isNullableExactInteger = (value, minimum, maximum) => value === null
      || isExactInteger(value, minimum, maximum);
    const validateBusinessState = (entity, value, options = {}) => {
      const row = asObject(value);
      if (entity === 'rate_plan') {
        const cancellation = asObject(row.cancellation_policy);
        return hasExactKeys(row, payloadKeys.rate_plan)
          && typeof row.code === 'string' && /^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(row.code)
          && isExactI18n(row.name_i18n, 240) && isExactPricingDescriptionI18n(row.description_i18n, 5000)
          && (row.meal_plan_code === null || (typeof row.meal_plan_code === 'string' && row.meal_plan_code === row.meal_plan_code.trim().toLowerCase()))
          && isExactCancellationPolicy(cancellation)
          && (row.booking_mode_override === null || BOOKING_MODES.includes(row.booking_mode_override))
          && Array.isArray(row.price_inclusions)
          && row.price_inclusions.length <= 200
          && row.price_inclusions.every((entry) => typeof entry === 'string' && entry === entry.trim() && entry.length > 0)
          && new Set(row.price_inclusions).size === row.price_inclusions.length
          && PRICING_LIFECYCLE_STATUSES.includes(row.lifecycle_status)
          && isExactInteger(row.sort_order, 0, 1000000);
      }
      if (entity === 'room_rate') return hasExactKeys(row, payloadKeys.room_rate)
        && Boolean(normalizeUuid(row.room_type_id)) && Boolean(normalizeUuid(row.rate_plan_id))
        && (row.pricing_schedule_id === null || Boolean(normalizeUuid(row.pricing_schedule_id)))
        && isExactMoney(row.base_nightly_rate)
        && typeof row.currency === 'string' && /^[A-Z]{3}$/.test(row.currency)
        && (row.external_redirect_url === null || isExactHttpsUrl(row.external_redirect_url))
        && PRICING_LIFECYCLE_STATUSES.includes(row.lifecycle_status)
        && isExactInteger(row.sort_order, 0, 1000000);
      if (entity === 'pricing_schedule') return hasExactKeys(row, payloadKeys.pricing_schedule)
        && typeof row.code === 'string' && /^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(row.code)
        && isExactI18n(row.name_i18n, 240) && row.application_scope === 'room_occupancy'
        && typeof row.currency === 'string' && /^[A-Z]{3}$/.test(row.currency)
        && isExactInteger(row.maximum_party_size, 1, 50)
        && isExactInteger(row.minimum_billable_occupancy, 1, row.maximum_party_size)
        && PRICING_SCHEDULE_SHARING_MODES.includes(row.sharing_mode)
        && PRICING_LIFECYCLE_STATUSES.includes(row.lifecycle_status)
        && validateTierRows(row.tiers, [
          'id', 'schedule_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version',
        ], 'schedule_id', normalizeUuid(source.id));
      if (entity === 'room_rate_tier_set') return hasExactKeys(row, payloadKeys.room_rate_tier_set)
        && validateTierRows(row.tiers, [
          'id', 'hotel_id', 'room_rate_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version',
        ], 'room_rate_id', normalizeUuid(source.id))
        && row.tiers.every((tier) => Boolean(normalizeUuid(tier.hotel_id)));
      if (entity === 'rate_rule') return hasExactKeys(row, payloadKeys.rate_rule)
        && Boolean(normalizeUuid(row.room_rate_id))
        && isExactIsoDate(row.valid_from) && isExactIsoDate(row.valid_to) && row.valid_to >= row.valid_from
        && Array.isArray(row.weekdays) && row.weekdays.length > 0
        && row.weekdays.every((day) => isExactInteger(day, 1, 7))
        && new Set(row.weekdays).size === row.weekdays.length
        && JSON.stringify([...row.weekdays].sort((a, b) => a - b)) === JSON.stringify(row.weekdays)
        && isExactMoney(row.nightly_rate)
        && isNullableExactInteger(row.minimum_stay, 1, 3650)
        && isNullableExactInteger(row.maximum_stay, 1, 3650)
        && (row.minimum_stay === null || row.maximum_stay === null || row.maximum_stay >= row.minimum_stay)
        && typeof row.closed_to_arrival === 'boolean' && typeof row.closed_to_departure === 'boolean'
        && isExactInteger(row.priority, -32768, 32767) && typeof row.is_active === 'boolean';
      if (entity === 'exact_date_price') {
        const expectedKeys = options.create === true ? exactDateCreate : exactDateUpdate;
        if (!hasExactKeys(row, expectedKeys)) return false;
        if ((options.create === true && (!normalizeUuid(row.hotel_id)
          || !normalizeUuid(row.room_rate_id) || !isExactIsoDate(row.stay_date)))) return false;
        const hasConfiguredMode = [row.nightly_rate_mode, row.minimum_stay_mode, row.maximum_stay_mode]
          .some((mode) => mode !== null);
        if ((!hasConfiguredMode && options.original !== true)
          || (hasConfiguredMode && (typeof row.reason !== 'string'
            || row.reason !== row.reason.trim() || !row.reason || row.reason.length > 500))
          || (!hasConfiguredMode && row.reason !== null)
          || !(row.expires_at === null || isExactIsoTimestamp(row.expires_at))) return false;
        return ['nightly_rate', 'minimum_stay', 'maximum_stay'].every((field) => {
          const mode = row[`${field}_mode`];
          const fieldValue = row[field];
          return [null, 'set', 'clear'].includes(mode) && ((mode === null || mode === 'clear') ? fieldValue === null
            : field === 'nightly_rate' ? isExactMoney(fieldValue)
              : isExactInteger(fieldValue, 1, 3650));
        }) && (row.minimum_stay === null || row.maximum_stay === null || row.maximum_stay >= row.minimum_stay);
      }
      if (entity === 'allocation_rule') {
        if (!hasExactKeys(row, payloadKeys.allocation_rule)
          || typeof row.code !== 'string' || !/^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(row.code)
          || !ROOM_ALLOCATION_MODES.includes(row.allocation_mode)
          || !isExactInteger(row.min_guest_count, 1, 50)
          || !isExactInteger(row.max_guest_count, row.min_guest_count, 50)
          || !PRICING_LIFECYCLE_STATUSES.includes(row.lifecycle_status)
          || !isExactInteger(row.sort_order, 0, 1000000)
          || !Array.isArray(row.items) || !row.items.length || row.items.length > 100) return false;
        return row.items.every((item) => {
          const physical = item.allocated_guest_counts;
          const priced = item.pricing_guest_counts;
          const validCounts = (counts) => counts === null || (Array.isArray(counts)
            && counts.every((count) => isExactInteger(count, 1, 50)));
          return hasExactKeys(item, [
            'id', 'hotel_id', 'allocation_rule_id', 'room_type_id', 'units_required',
            'allocated_guest_count', 'pricing_guest_count', 'allocated_guest_counts',
            'pricing_guest_counts', 'sort_order',
          ]) && Boolean(normalizeUuid(item.id)) && Boolean(normalizeUuid(item.hotel_id))
            && normalizeUuid(item.allocation_rule_id) === normalizeUuid(source.id)
            && Boolean(normalizeUuid(item.room_type_id)) && isExactInteger(item.units_required, 1, 50)
            && isNullableExactInteger(item.allocated_guest_count, 1, 2500)
            && isNullableExactInteger(item.pricing_guest_count, 1, 2500)
            && validCounts(physical) && validCounts(priced)
            && (physical === null || (physical.length === item.units_required
              && item.allocated_guest_count === physical.reduce((sum, count) => sum + count, 0)))
            && (priced === null || (priced.length === item.units_required
              && item.pricing_guest_count === priced.reduce((sum, count) => sum + count, 0)))
            && isExactInteger(item.sort_order, 0, 1000000);
        });
      }
      if (entity === 'property_pricing_default') {
        const expectedKeys = options.create === true
          ? propertyDefaultCreate
          : payloadKeys.property_pricing_default;
        return hasExactKeys(row, expectedKeys)
          && (options.create !== true || Boolean(normalizeUuid(row.hotel_id)))
          && isExactMoney(row.nightly_rate, 0.01)
          && typeof row.currency === 'string' && /^[A-Z]{3}$/.test(row.currency)
          && PRICING_LIFECYCLE_STATUSES.includes(row.lifecycle_status);
      }
      return false;
    };

    if (!['disable', 'clone'].includes(source.action)
        && !validateBusinessState(source.entity, source.payload, { create: source.action === 'create' })) {
      throw new Error(`The ${source.entity} pricing payload contains an invalid or coerced business value.`);
    }
    const validDisableOriginal = (() => {
      if (source.action !== 'disable') return true;
      return source.entity !== 'room_rate_tier_set'
        && validateBusinessState(source.entity, source.expected_original, { create: false, original: true });
    })();
    if (!validDisableOriginal) {
      throw new Error(`The ${source.entity} disable must bind its exact supported original state.`);
    }
    if (!['create', 'clone', 'disable'].includes(source.action)
        && !validateBusinessState(source.entity, source.expected_original, { create: false, original: true })) {
      throw new Error(`The ${source.entity} reviewed original contains an invalid or incomplete business state.`);
    }
    if (source.entity === 'rate_rule' && source.action === 'update'
        && normalizeUuid(source.payload.room_rate_id) !== normalizeUuid(source.expected_original.room_rate_id)) {
      throw new Error('A seasonal pricing rule cannot be moved to another Room Rate; create a new reviewed rule instead.');
    }
    if (source.entity === 'pricing_schedule' && source.action !== 'clone' && source.action !== 'disable'
        && !validateTierRows(source.payload.tiers, [
          'id', 'schedule_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version',
        ], 'schedule_id', normalizeUuid(source.id))) {
      throw new Error('A pricing schedule must carry a complete exact tier set.');
    }
    if (source.entity === 'pricing_schedule' && source.action === 'clone'
        && !validateTierRows(source.payload.tiers, [
          'id', 'schedule_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version',
        ], 'schedule_id', normalizeUuid(source.id))) {
      throw new Error('A schedule clone must bind every exact reviewed target tier.');
    }
    if (source.entity === 'room_rate_tier_set' && source.action === 'update'
        && !validateTierRows(source.payload.tiers, [
          'id', 'hotel_id', 'room_rate_id', 'guest_count', 'threshold_nights',
          'nightly_rate', 'is_active', 'version',
        ], 'room_rate_id', normalizeUuid(source.id))) {
      throw new Error('A Room Rate tier update must carry a complete exact child set.');
    }
    if (source.entity === 'allocation_rule' && !['disable'].includes(source.action)) {
      const items = source.payload.items;
      const itemIds = asArray(items).map((item) => normalizeUuid(item?.id));
      const exactItemKeys = [
        'id', 'hotel_id', 'allocation_rule_id', 'room_type_id', 'units_required',
        'allocated_guest_count', 'pricing_guest_count', 'allocated_guest_counts',
        'pricing_guest_counts', 'sort_order',
      ];
      if (!Array.isArray(items) || !itemIds.every(Boolean) || new Set(itemIds).size !== itemIds.length
          || items.some((item) => (
            !hasExactKeys(item, exactItemKeys)
            || normalizeUuid(item.allocation_rule_id) !== normalizeUuid(source.id)
            || !normalizeUuid(item.hotel_id) || !normalizeUuid(item.room_type_id)
            || typeof item.units_required !== 'number' || !Number.isInteger(item.units_required) || item.units_required < 1
            || (item.units_required > 1 && (!Array.isArray(item.allocated_guest_counts)
              || item.allocated_guest_counts.length !== item.units_required
              || !Array.isArray(item.pricing_guest_counts)
              || item.pricing_guest_counts.length !== item.units_required))
            || (item.allocated_guest_counts != null && !Array.isArray(item.allocated_guest_counts))
            || (item.pricing_guest_counts != null && !Array.isArray(item.pricing_guest_counts))
          ))) throw new Error('An allocation update must carry the complete exact child set.');
    }
    if (source.entity === 'exact_date_price' && !['disable'].includes(source.action)) {
      for (const field of ['nightly_rate', 'minimum_stay', 'maximum_stay']) {
        const mode = source.payload[`${field}_mode`];
        const value = source.payload[field];
        if (![null, 'set', 'clear'].includes(mode)
            || ((mode === null || mode === 'clear') && value !== null)
            || (mode === 'set' && (field === 'nightly_rate'
              ? !isExactMoney(value)
              : !isExactInteger(value, 1, 3650)))
            ) {
          throw new Error('Exact-date price and stay fields require exact no-change, SET or CLEAR values.');
        }
      }
      if (![source.payload.nightly_rate_mode, source.payload.minimum_stay_mode,
        source.payload.maximum_stay_mode].some((mode) => mode !== null)) {
        throw new Error('Configure at least one exact-date price or stay field before Review.');
      }
      if (source.payload.minimum_stay_mode === 'set' && source.payload.maximum_stay_mode === 'set'
          && source.payload.maximum_stay < source.payload.minimum_stay) {
        throw new Error('Exact-date maximum stay cannot be below its minimum stay.');
      }
    }
    if (source.entity === 'rate_rule' && source.action === 'update'
        && source.expected_original.is_active === true && source.payload.is_active === false) {
      throw new Error('An enabled pricing rule must use the dedicated disable action.');
    }
    if (['pricing_schedule', 'room_rate_tier_set', 'allocation_rule'].includes(source.entity)
        && !['create', 'clone'].includes(source.action)
        && !isExactFingerprint(source.expected_children_fingerprint, false)) {
      throw new Error('Aggregate pricing updates require the exact child fingerprint.');
    }
    if (source.entity === 'pricing_schedule' && !['create', 'clone'].includes(source.action)) {
      const expectedLinks = source.expected_linked_room_rate_ids.map(normalizeUuid).sort();
      if (!isExactFingerprint(source.expected_link_fingerprint, false)
          || JSON.stringify(expectedLinks) !== JSON.stringify(source.expected_linked_room_rate_ids)
          || (expectedLinks.length > 0 && source.shared_impact_acknowledged !== true)) {
        throw new Error('A schedule update requires the exact reviewed link impact and acknowledgement.');
      }
    }
    if (source.entity === 'room_rate' && ['create', 'update'].includes(source.action)) {
      const beforeSchedule = normalizeUuid(source.expected_original.pricing_schedule_id);
      const afterSchedule = normalizeUuid(source.payload.pricing_schedule_id);
      if (beforeSchedule !== afterSchedule
          && (!isExactFingerprint(source.expected_link_fingerprint, false)
            || source.shared_impact_acknowledged !== true)) {
        throw new Error('A Room Rate schedule link change requires the exact reviewed link impact and acknowledgement.');
      }
    }
    return {
      entity: asText(source.entity),
      action: asText(source.action),
      id: normalizeUuid(source.id),
      expected_version: source.expected_version,
      expected_children_fingerprint: asNullableText(source.expected_children_fingerprint),
      expected_link_fingerprint: asNullableText(source.expected_link_fingerprint),
      expected_linked_room_rate_ids: asArray(source.expected_linked_room_rate_ids).map(normalizeUuid).filter(Boolean).sort(),
      shared_impact_acknowledged: source.shared_impact_acknowledged === true,
      activation_acknowledged: source.activation_acknowledged === true,
      expected_original: clone(source.expected_original),
      payload: clone(source.payload),
    };
  }

  function validatePricingControlPlan(value) {
    const source = asObject(value);
    if (!hasExactKeys(source, ['contract_version', 'hotel_id', 'snapshot_token', 'reviewed_at', 'operations'])
        || source.contract_version !== PRICING_CONTROL_CONTRACT
        || !normalizeUuid(source.hotel_id)
        || !isExactSnapshotToken(source.snapshot_token)
        || !isExactIsoTimestamp(source.reviewed_at)
        || !Array.isArray(source.operations)
        || source.operations.length < 1
        || source.operations.length > 100
        || jsonUtf8ByteLength(source) > 5 * 1024 * 1024) {
      throw new Error('A reviewed exact-property pricing plan is required.');
    }
    return {
      contract_version: PRICING_CONTROL_CONTRACT,
      hotel_id: normalizeUuid(source.hotel_id),
      snapshot_token: source.snapshot_token,
      reviewed_at: asText(source.reviewed_at),
      operations: source.operations.map(validatePricingControlOperation),
    };
  }

  function buildPricingControlPlan(pricingControl, operations, options = {}) {
    const control = validatePricingControl(pricingControl, pricingControl?.hotel_id);
    return validatePricingControlPlan({
      contract_version: PRICING_CONTROL_CONTRACT,
      hotel_id: control.hotel_id,
      snapshot_token: control.snapshot_token,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      operations: asArray(operations),
    });
  }

  function pricingTierPayload(tier, parentKey, parentId, options = {}) {
    const source = asObject(tier);
    if (typeof source.is_active !== 'boolean') {
      throw new Error('Pricing tier active state must be an exact reviewed boolean.');
    }
    const payload = {
      id: exactUuidOrNew(source.id, 'Pricing tier ID'),
      [parentKey]: normalizeUuid(parentId),
      guest_count: source.guest_count,
      threshold_nights: source.threshold_nights,
      nightly_rate: source.nightly_rate,
      is_active: source.is_active,
      version: source.version == null ? 0 : source.version,
    };
    if (options.hotelId) payload.hotel_id = normalizeUuid(options.hotelId);
    return payload;
  }

  function pricingAllocationItemPayload(item, hotelId, allocationRuleId) {
    const source = asObject(item);
    return {
      id: exactUuidOrNew(source.id, 'Allocation item ID'),
      hotel_id: normalizeUuid(hotelId),
      allocation_rule_id: normalizeUuid(allocationRuleId),
      room_type_id: normalizeUuid(source.room_type_id),
      units_required: source.units_required,
      allocated_guest_count: source.allocated_guest_count == null ? null : source.allocated_guest_count,
      pricing_guest_count: source.pricing_guest_count == null ? null : source.pricing_guest_count,
      allocated_guest_counts: source.allocated_guest_counts == null ? null : clone(source.allocated_guest_counts),
      pricing_guest_counts: source.pricing_guest_counts == null ? null : clone(source.pricing_guest_counts),
      sort_order: source.sort_order,
    };
  }

  function pricingBusinessState(entity, value, options = {}) {
    const source = asObject(value);
    const id = normalizeUuid(source.id || options.id);
    const hotelId = normalizeUuid(source.hotel_id || options.hotelId);
    if (entity === 'rate_plan') {
      const inclusions = source.price_inclusions;
      const descriptionI18n = canonicalPricingDescriptionI18n(source.description_i18n, 5000);
      if (typeof source.code !== 'string'
          || !(source.meal_plan_code === null || typeof source.meal_plan_code === 'string')
          || !(source.booking_mode_override === null || typeof source.booking_mode_override === 'string')
          || typeof source.lifecycle_status !== 'string'
          || !isExactI18n(source.name_i18n, 240)
          || !descriptionI18n
          || !Array.isArray(inclusions)
          || inclusions.length > 200
          || inclusions.some((entry) => typeof entry !== 'string'
            || entry !== entry.trim().toLowerCase()
            || !/^[a-z0-9](?:[a-z0-9_-]{0,79})$/.test(entry))
          || new Set(inclusions).size !== inclusions.length
          || JSON.stringify(inclusions) !== JSON.stringify([...inclusions].sort())) {
        throw new Error('Rate Plan localized content or inclusions contain an invalid or coerced string value.');
      }
      return {
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      description_i18n: descriptionI18n,
      meal_plan_code: asNullableText(source.meal_plan_code)?.toLowerCase() || null,
      cancellation_policy: clone(asObject(source.cancellation_policy)),
      booking_mode_override: asNullableText(source.booking_mode_override),
      price_inclusions: normalizeStringSet(source.price_inclusions),
      lifecycle_status: asText(source.lifecycle_status),
      sort_order: source.sort_order,
      };
    }
    if (entity === 'room_rate') {
      if (typeof source.currency !== 'string'
          || !(source.external_redirect_url === null || typeof source.external_redirect_url === 'string')
          || !(source.pricing_schedule_id === null || Boolean(normalizeUuid(source.pricing_schedule_id)))
          || typeof source.lifecycle_status !== 'string') {
        throw new Error('Room Rate text fields contain an invalid or coerced value.');
      }
      return {
      room_type_id: normalizeUuid(source.room_type_id),
      rate_plan_id: normalizeUuid(source.rate_plan_id),
      pricing_schedule_id: normalizeUuid(source.pricing_schedule_id) || null,
      base_nightly_rate: source.base_nightly_rate,
      currency: asText(source.currency).toUpperCase(),
      external_redirect_url: asNullableText(source.external_redirect_url),
      lifecycle_status: asText(source.lifecycle_status),
      sort_order: source.sort_order,
      };
    }
    if (entity === 'pricing_schedule') {
      if (typeof source.code !== 'string'
          || typeof source.application_scope !== 'string'
          || typeof source.currency !== 'string'
          || typeof source.sharing_mode !== 'string'
          || typeof source.lifecycle_status !== 'string'
          || !isExactI18n(source.name_i18n, 240)) {
        throw new Error('Pricing schedule names contain an invalid or coerced localized string value.');
      }
      return {
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      application_scope: asText(source.application_scope),
      currency: asText(source.currency).toUpperCase(),
      maximum_party_size: source.maximum_party_size,
      minimum_billable_occupancy: source.minimum_billable_occupancy,
      sharing_mode: asText(source.sharing_mode),
      lifecycle_status: asText(source.lifecycle_status),
      tiers: asArray(source.tiers).map((tier) => pricingTierPayload(tier, 'schedule_id', id)),
      };
    }
    if (entity === 'room_rate_tier_set') return {
      tiers: asArray(source.tiers || source.independent_tiers).map((tier) => (
        pricingTierPayload(tier, 'room_rate_id', id, { hotelId })
      )),
    };
    if (entity === 'rate_rule') {
      if (typeof source.valid_from !== 'string' || typeof source.valid_to !== 'string'
          || typeof source.closed_to_arrival !== 'boolean'
          || typeof source.closed_to_departure !== 'boolean'
          || typeof source.is_active !== 'boolean') {
        throw new Error('Seasonal pricing dates contain an invalid or coerced value.');
      }
      return {
      room_rate_id: normalizeUuid(source.room_rate_id),
      valid_from: asText(source.valid_from),
      valid_to: asText(source.valid_to),
      weekdays: asArray(source.weekdays).map((weekday) => weekday),
      nightly_rate: source.nightly_rate,
      minimum_stay: source.minimum_stay == null ? null : source.minimum_stay,
      maximum_stay: source.maximum_stay == null ? null : source.maximum_stay,
      closed_to_arrival: source.closed_to_arrival,
      closed_to_departure: source.closed_to_departure,
      priority: source.priority,
      is_active: source.is_active,
      };
    }
    if (entity === 'exact_date_price') {
      const reasonValue = Object.hasOwn(source, 'reason') ? source.reason : source.pricing_reason;
      const expiresValue = Object.hasOwn(source, 'expires_at') ? source.expires_at : source.pricing_expires_at;
      if (!(reasonValue === null || typeof reasonValue === 'string')
          || !(expiresValue === null || typeof expiresValue === 'string')
          || ['nightly_rate', 'minimum_stay', 'maximum_stay'].some((field) => (
            !(source[`${field}_mode`] === null || typeof source[`${field}_mode`] === 'string')
          ))
          || (options.create === true && typeof source.stay_date !== 'string')) {
        throw new Error('Exact-date pricing text, mode or date fields contain an invalid or coerced value.');
      }
      const exact = {
        nightly_rate_mode: source.nightly_rate_mode == null ? null : asText(source.nightly_rate_mode),
        nightly_rate: source.nightly_rate == null ? null : source.nightly_rate,
        minimum_stay_mode: source.minimum_stay_mode == null ? null : asText(source.minimum_stay_mode),
        minimum_stay: source.minimum_stay == null ? null : source.minimum_stay,
        maximum_stay_mode: source.maximum_stay_mode == null ? null : asText(source.maximum_stay_mode),
        maximum_stay: source.maximum_stay == null ? null : source.maximum_stay,
        reason: reasonValue == null
          ? null
          : asText(reasonValue),
        expires_at: expiresValue == null
          ? null
          : asText(expiresValue),
      };
      if (options.create === true) {
        return {
          hotel_id: hotelId,
          room_rate_id: normalizeUuid(source.room_rate_id),
          stay_date: asText(source.stay_date),
          ...exact,
        };
      }
      return exact;
    }
    if (entity === 'allocation_rule') {
      if (typeof source.code !== 'string'
          || typeof source.allocation_mode !== 'string'
          || typeof source.lifecycle_status !== 'string') {
        throw new Error('Allocation rule text fields contain an invalid or coerced value.');
      }
      return {
      code: asText(source.code).toLowerCase(),
      allocation_mode: asText(source.allocation_mode),
      min_guest_count: source.min_guest_count,
      max_guest_count: source.max_guest_count,
      lifecycle_status: asText(source.lifecycle_status),
      sort_order: source.sort_order,
      items: asArray(source.items).map((item) => pricingAllocationItemPayload(item, hotelId, id)),
      };
    }
    if (entity === 'property_pricing_default') {
      if (typeof source.currency !== 'string' || typeof source.lifecycle_status !== 'string') {
        throw new Error('Property fallback text fields contain an invalid or coerced value.');
      }
      return {
        ...(options.create === true ? { hotel_id: hotelId } : {}),
        nightly_rate: source.nightly_rate,
        currency: asText(source.currency).toUpperCase(),
        lifecycle_status: asText(source.lifecycle_status),
      };
    }
    throw new Error(`Unsupported pricing entity: ${entity}.`);
  }

  function buildPricingControlOperation(pricingControl, entity, nextValue, previousValue = null, options = {}) {
    const control = validatePricingControl(pricingControl, pricingControl?.hotel_id);
    if (control.hotel_id === SEVEN_ARCHES_PROPERTY_ID) {
      throw new Error('The accepted 7 Kamares H3.1P pricing graph is read-only in ADMIN-C.');
    }
    const next = asObject(nextValue);
    const previous = previousValue ? asObject(previousValue) : null;
    const previousLocked = previous?.immutable_contract?.locked === true;
    const childSourceLocked = entity === 'room_rate_tier_set'
      && asArray(previous?.independent_tiers).some((tier) => (
        tier?.immutable_contract?.locked === true || tier?.source !== 'manual'
      ));
    if (previousLocked || childSourceLocked) {
      throw new Error('This exact pricing source is read-only. Clone a supported schedule into a new manual draft instead.');
    }
    const suppliedId = Object.hasOwn(next, 'id') ? next.id : previous?.id;
    const id = exactUuidOrNew(suppliedId, 'Pricing entity ID');
    const action = asText(options.action) || (previous ? 'update' : 'create');
    const isCreate = action === 'create';
    const payload = action === 'disable'
      ? {}
      : pricingBusinessState(entity, { ...clone(next), id, hotel_id: control.hotel_id }, {
        id, hotelId: control.hotel_id, create: isCreate,
      });
    if (entity === 'property_pricing_default'
        && action !== 'disable'
        && payload.currency !== control.property.currency) {
      throw new Error('The property pricing fallback must use the exact reviewed property currency.');
    }
    const expectedOriginal = isCreate
      ? {}
      : pricingBusinessState(entity, { ...clone(previous), id, hotel_id: control.hotel_id }, {
        id, hotelId: control.hotel_id, create: false,
      });
    let linkSchedule = null;
    if (entity === 'room_rate') {
      const currentScheduleId = normalizeUuid(previous?.pricing_schedule_id);
      const targetScheduleId = normalizeUuid(next.pricing_schedule_id);
      if (currentScheduleId && targetScheduleId && currentScheduleId !== targetScheduleId) {
        throw new Error('Detach this Room Rate from its current schedule, Save, refresh, then attach the new schedule in a separate Review.');
      }
      if (currentScheduleId !== targetScheduleId && (currentScheduleId || targetScheduleId)) {
        linkSchedule = control.pricing_schedules.find((schedule) => schedule.id === (targetScheduleId || currentScheduleId));
        if (!linkSchedule) throw new Error('The exact pricing schedule link snapshot is missing.');
      }
    }
    const operation = {
      entity,
      action,
      id,
      expected_version: isCreate ? 0 : previous?.version,
      expected_children_fingerprint: entity === 'pricing_schedule'
        ? (previous?.tiers_fingerprint || null)
        : entity === 'room_rate_tier_set'
          ? (previous?.independent_tiers_fingerprint || null)
          : entity === 'allocation_rule' ? (previous?.items_fingerprint || null) : null,
      expected_link_fingerprint: entity === 'pricing_schedule'
        ? (previous?.link_fingerprint || null)
        : (linkSchedule?.link_fingerprint || null),
      expected_linked_room_rate_ids: (entity === 'pricing_schedule'
        ? asArray(previous?.linked_room_rate_ids)
        : asArray(linkSchedule?.linked_room_rate_ids)).map(normalizeUuid).filter(Boolean).sort(),
      shared_impact_acknowledged: options.sharedImpactAcknowledged === true,
      activation_acknowledged: options.activationAcknowledged === true,
      expected_original: expectedOriginal,
      payload,
    };
    return validatePricingControlOperation(operation);
  }

  function buildPricingScheduleCloneOperationFromValidatedControl(control, sourceSchedule, values, options = {}) {
    if (control.hotel_id === SEVEN_ARCHES_PROPERTY_ID) {
      throw new Error('The accepted 7 Kamares H3.1P pricing graph is read-only in ADMIN-C.');
    }
    const source = asObject(sourceSchedule);
    if (!isExactI18n(values?.name_i18n, 240)) {
      throw new Error('Pricing schedule clone names contain an invalid or coerced localized string value.');
    }
    const targetCode = values?.code;
    if (typeof targetCode !== 'string'
        || targetCode !== targetCode.trim().toLowerCase()) {
      throw new Error('Pricing schedule clone code must be an exact lowercase reviewed string.');
    }
    if (control.pricing_schedules.some((schedule) => schedule.code === targetCode)) {
      throw new Error('Pricing schedule clone code already exists for this Hotel. Choose a unique code.');
    }
    const targetId = exactUuidOrNew(values?.id, 'Pricing schedule clone target ID');
    const operation = {
      entity: 'pricing_schedule',
      action: 'clone',
      id: targetId,
      expected_version: 0,
      expected_children_fingerprint: asText(source.tiers_fingerprint) || null,
      expected_link_fingerprint: asText(source.link_fingerprint) || null,
      expected_linked_room_rate_ids: asArray(source.linked_room_rate_ids).map(normalizeUuid).filter(Boolean).sort(),
      shared_impact_acknowledged: options.sharedImpactAcknowledged === true,
      activation_acknowledged: false,
      expected_original: {},
      payload: {
        source_schedule_id: normalizeUuid(source.id),
        expected_source_version: source.version,
        code: targetCode,
        name_i18n: normalizeI18n(values?.name_i18n),
        sharing_mode: asText(values?.sharing_mode),
        tiers: asArray(values?.tiers).map((tier) => pricingTierPayload(tier, 'schedule_id', targetId)),
      },
    };
    void control;
    return validatePricingControlOperation(operation);
  }

  function buildPricingScheduleCloneOperation(pricingControl, sourceSchedule, values, options = {}) {
    const control = validatePricingControl(pricingControl, pricingControl?.hotel_id);
    return buildPricingScheduleCloneOperationFromValidatedControl(
      control, sourceSchedule, values, options,
    );
  }

  function buildPricingScheduleCloneForRoomRateOperations(pricingControl, sourceSchedule, roomRate, values) {
    const control = validatePricingControl(pricingControl, pricingControl?.hotel_id);
    const source = control.pricing_schedules.find((entry) => entry.id === normalizeUuid(sourceSchedule?.id));
    const rate = control.room_rates.find((entry) => entry.id === normalizeUuid(roomRate?.id));
    const targetId = normalizeUuid(values?.id);
    if (!source || !rate || !targetId
        || rate.pricing_schedule_id !== source.id
        || !source.linked_room_rate_ids.includes(rate.id)) {
      throw new Error('Clone for this product requires the exact current Room Rate and linked source schedule.');
    }
    const cloneOperation = buildPricingScheduleCloneOperationFromValidatedControl(control, source, {
      id: targetId,
      code: values.code,
      name_i18n: values.name_i18n,
      sharing_mode: 'independent',
      tiers: values.tiers,
    }, { sharedImpactAcknowledged: true });
    const targetRate = {
      ...clone(rate),
      pricing_schedule_id: targetId,
      lifecycle_status: 'inactive',
    };
    const relinkOperation = validatePricingControlOperation({
      entity: 'room_rate',
      action: 'update',
      id: rate.id,
      expected_version: rate.version,
      expected_children_fingerprint: null,
      expected_link_fingerprint: source.link_fingerprint,
      expected_linked_room_rate_ids: [...source.linked_room_rate_ids].sort(),
      shared_impact_acknowledged: true,
      activation_acknowledged: false,
      expected_original: pricingBusinessState('room_rate', rate),
      payload: pricingBusinessState('room_rate', targetRate),
    });
    return [cloneOperation, relinkOperation];
  }

  function reconcilePricingBusinessState(entity, originalValue, currentValue, requestedValue, options = {}) {
    const withoutOptimisticVersions = (value) => JSON.parse(JSON.stringify(value, (key, nested) => (
      key === 'version' ? undefined : nested
    )));
    const original = withoutOptimisticVersions(pricingBusinessState(entity, originalValue, options));
    const current = withoutOptimisticVersions(pricingBusinessState(entity, currentValue, options));
    const requested = withoutOptimisticVersions(pricingBusinessState(entity, requestedValue, options));
    const fields = Array.from(new Set([...Object.keys(original), ...Object.keys(current), ...Object.keys(requested)])).sort();
    const conflicts = [];
    const safeRebases = [];
    const merged = clone(current);
    fields.forEach((field) => {
      const originalText = JSON.stringify(original[field]);
      const currentText = JSON.stringify(current[field]);
      const requestedText = JSON.stringify(requested[field]);
      if (requestedText === originalText) return;
      if (currentText !== originalText && currentText !== requestedText) {
        conflicts.push({ field, original: clone(original[field]), current: clone(current[field]), requested: clone(requested[field]) });
      } else {
        merged[field] = clone(requested[field]);
        if (currentText !== originalText) safeRebases.push(field);
      }
    });
    return { safe: conflicts.length === 0, conflicts, safe_rebases: safeRebases, merged };
  }

  function validatePricingPreviewRequest(value) {
    const source = asObject(value);
    const exactKeys = [
      'contract_version', 'hotel_id', 'snapshot_token', 'rate_plan_id',
      'allocation_rule_id', 'selected_room_type_id', 'check_in', 'check_out',
      'adults', 'child_ages',
    ];
    const childAges = asArray(source.child_ages);
    const checkIn = asText(source.check_in);
    const checkOut = asText(source.check_out);
    const requestedNights = Math.round((Date.parse(`${checkOut}T00:00:00Z`)
      - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
    const validIsoCalendarDate = (date) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (!match) return false;
      const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      return parsed.getUTCFullYear() === Number(match[1])
        && parsed.getUTCMonth() + 1 === Number(match[2])
        && parsed.getUTCDate() === Number(match[3]);
    };
    if (!hasExactKeys(source, exactKeys)
        || source.contract_version !== PRICING_PREVIEW_CONTRACT
        || !normalizeUuid(source.hotel_id)
        || !isExactSnapshotToken(source.snapshot_token)
        || (source.rate_plan_id != null && !normalizeUuid(source.rate_plan_id))
        || (source.allocation_rule_id != null && !normalizeUuid(source.allocation_rule_id))
        || (source.selected_room_type_id != null && !normalizeUuid(source.selected_room_type_id))
        || !validIsoCalendarDate(checkIn)
        || !validIsoCalendarDate(checkOut)
        || checkOut <= checkIn
        || !Number.isInteger(requestedNights) || requestedNights < 1 || requestedNights > 365
        || typeof source.adults !== 'number' || !Number.isInteger(source.adults) || source.adults < 1 || source.adults > 50
        || childAges.some((age) => typeof age !== 'number' || !Number.isInteger(age) || age < CHILD_AGE_MIN || age > CHILD_AGE_MAX)
        || childAges.length > 50
        || !Array.isArray(source.child_ages)
        || source.adults + childAges.length > 50) {
      throw new Error('A valid exact-property pricing preview request is required.');
    }
    return {
      contract_version: PRICING_PREVIEW_CONTRACT,
      hotel_id: normalizeUuid(source.hotel_id),
      snapshot_token: source.snapshot_token,
      rate_plan_id: normalizeUuid(source.rate_plan_id) || null,
      allocation_rule_id: normalizeUuid(source.allocation_rule_id) || null,
      selected_room_type_id: normalizeUuid(source.selected_room_type_id) || null,
      check_in: checkIn,
      check_out: checkOut,
      adults: source.adults,
      child_ages: [...childAges],
    };
  }

  function validatePricingPreview(value, request) {
    const source = asObject(value);
    const exactKeys = [
      'contract_version', 'hotel_id', 'snapshot_token', 'ok', 'requestable',
      'blocking_reasons', 'currency', 'check_in', 'check_out', 'nights', 'adults',
      'child_ages', 'guest_count', 'allocation', 'products', 'nightly_breakdown',
      'customer_total', 'pricing_precedence', 'legacy_authoritative', 'public_change',
    ];
    const blockerKeys = ['code', 'entity', 'entity_id', 'stay_date', 'detail'];
    const allocationKeys = [
      'allocation_rule_id', 'allocation_mode', 'room_type_id', 'units_required',
      'allocated_guest_count', 'pricing_guest_count', 'allocated_guest_counts',
      'pricing_guest_counts',
    ];
    const productKeys = [
      'room_type_id', 'room_rate_id', 'rate_plan_id', 'unit_sequence',
      'allocated_guest_count', 'requested_pricing_guest_count',
      'resolved_pricing_guest_count', 'minimum_billable_occupancy',
      'base_pricing_source', 'base_pricing_source_id', 'los_threshold_nights',
      'subtotal', 'currency', 'booking_mode', 'cancellation_policy',
      'price_inclusions', 'effective_minimum_stay', 'effective_maximum_stay',
      'stay_allowed',
    ];
    const nightKeys = [
      'stay_date', 'room_type_id', 'room_rate_id', 'rate_plan_id', 'unit_sequence',
      'allocated_guest_count', 'requested_pricing_guest_count',
      'resolved_pricing_guest_count', 'minimum_billable_occupancy',
      'base_pricing_source', 'base_pricing_source_id', 'los_threshold_nights',
      'weekday_rule_id', 'seasonal_range_rule_id', 'exact_date_price_id',
      'final_pricing_source', 'nightly_rate', 'currency',
      'effective_minimum_stay', 'effective_maximum_stay',
      'minimum_stay_source', 'minimum_stay_source_id',
      'maximum_stay_source', 'maximum_stay_source_id',
    ];
    const expectedPrecedence = [
      'exact_date_price', 'seasonal_range_rule', 'weekday_rule',
      'pricing_schedule_tier', 'independent_occupancy_tier',
      'room_rate_base_nightly_rate', 'property_default',
    ];
    const nullableUuid = (value) => value === null || Boolean(normalizeUuid(value));
    const nullableStay = (value) => value === null || isExactInteger(value, 1, 3650);
    const countArrayIsExact = (value, units, sum) => Array.isArray(value)
      && value.length === units
      && value.every((count) => isExactInteger(count, 1, 50))
      && value.reduce((total, count) => total + count, 0) === sum;
    const baseSources = [
      'pricing_schedule_tier', 'independent_occupancy_tier', 'base_nightly_rate',
      'property_default',
    ];
    const finalSources = [...baseSources, 'weekday_rule', 'seasonal_range_rule', 'exact_date_price'];
    const staySources = [null, 'property', 'weekday_rule', 'seasonal_range_rule', 'exact_date_price'];
    const requestedNights = Math.round((Date.parse(`${request.check_out}T00:00:00Z`)
      - Date.parse(`${request.check_in}T00:00:00Z`)) / 86400000);
    if (!hasExactKeys(source, exactKeys)
        || source.contract_version !== PRICING_PREVIEW_CONTRACT
        || normalizeUuid(source.hotel_id) !== request.hotel_id
        || !isExactSnapshotToken(source.snapshot_token)
        || source.snapshot_token !== request.snapshot_token
        || asText(source.check_in) !== request.check_in
        || asText(source.check_out) !== request.check_out
        || typeof source.ok !== 'boolean'
        || typeof source.requestable !== 'boolean'
        || typeof source.nights !== 'number' || !Number.isInteger(source.nights)
        || source.nights !== requestedNights
        || source.adults !== request.adults
        || !Array.isArray(source.child_ages)
        || JSON.stringify(source.child_ages) !== JSON.stringify(request.child_ages)
        || typeof source.guest_count !== 'number' || !Number.isInteger(source.guest_count)
        || source.guest_count !== request.adults + request.child_ages.length
        || !Array.isArray(source.blocking_reasons)
        || !Array.isArray(source.allocation)
        || !Array.isArray(source.products)
        || !Array.isArray(source.nightly_breakdown)
        || !/^[A-Z]{3}$/.test(asText(source.currency))
        || (source.customer_total != null && !isExactMoney(source.customer_total))
        || source.blocking_reasons.some((entry) => (
          !hasExactKeys(entry, blockerKeys)
          || typeof entry.code !== 'string' || !/^[a-z0-9_]+$/.test(entry.code)
          || !(entry.entity === null || (typeof entry.entity === 'string' && /^[a-z0-9_]+$/.test(entry.entity)))
          || !nullableUuid(entry.entity_id)
          || !(entry.stay_date === null || isExactIsoDate(entry.stay_date))
          || !(entry.detail === null || (typeof entry.detail === 'object' && !Array.isArray(entry.detail)))
        ))
        || source.allocation.some((entry) => (
          !hasExactKeys(entry, allocationKeys)
          || !normalizeUuid(entry.allocation_rule_id) || !ROOM_ALLOCATION_MODES.includes(entry.allocation_mode)
          || !normalizeUuid(entry.room_type_id) || !isExactInteger(entry.units_required, 1, 50)
          || !isExactInteger(entry.allocated_guest_count, 1, 2500)
          || !isExactInteger(entry.pricing_guest_count, 1, 2500)
          || !countArrayIsExact(entry.allocated_guest_counts, entry.units_required, entry.allocated_guest_count)
          || !countArrayIsExact(entry.pricing_guest_counts, entry.units_required, entry.pricing_guest_count)
        ))
        || source.products.some((entry) => (
          !hasExactKeys(entry, productKeys)
          || !normalizeUuid(entry.room_type_id) || !normalizeUuid(entry.room_rate_id)
          || !normalizeUuid(entry.rate_plan_id) || !isExactInteger(entry.unit_sequence, 1, 50)
          || !isExactInteger(entry.allocated_guest_count, 1, 50)
          || !isExactInteger(entry.requested_pricing_guest_count, 1, 50)
          || !(entry.resolved_pricing_guest_count === null
            || isExactInteger(entry.resolved_pricing_guest_count, 1, 50))
          || !(entry.minimum_billable_occupancy === null
            || isExactInteger(entry.minimum_billable_occupancy, 1, 50))
          || !(entry.base_pricing_source === null || baseSources.includes(entry.base_pricing_source))
          || !(entry.base_pricing_source_id === null
            || normalizePricingSourceUuid(entry.base_pricing_source, entry.base_pricing_source_id))
          || !(entry.los_threshold_nights === null || isExactInteger(entry.los_threshold_nights, 1, 3650))
          || !(entry.subtotal === null || isExactMoney(entry.subtotal))
          || !(entry.currency === null || entry.currency === source.currency)
          || !(entry.booking_mode === null || BOOKING_MODES.includes(entry.booking_mode))
          || !(entry.cancellation_policy === null || isExactCancellationPolicy(entry.cancellation_policy))
          || !(entry.price_inclusions === null || (Array.isArray(entry.price_inclusions)
            && entry.price_inclusions.every((item) => typeof item === 'string' && item.trim())
            && new Set(entry.price_inclusions).size === entry.price_inclusions.length))
          || !nullableStay(entry.effective_minimum_stay)
          || !nullableStay(entry.effective_maximum_stay)
          || (entry.effective_minimum_stay !== null && entry.effective_maximum_stay !== null
            && entry.effective_maximum_stay < entry.effective_minimum_stay)
          || !(entry.stay_allowed === null || typeof entry.stay_allowed === 'boolean')
          || (entry.subtotal === null && (
            entry.resolved_pricing_guest_count !== null
            || entry.minimum_billable_occupancy !== null
            || entry.base_pricing_source !== null
            || entry.base_pricing_source_id !== null
            || entry.currency !== null || entry.booking_mode !== null
            || entry.cancellation_policy !== null || entry.price_inclusions !== null
            || entry.stay_allowed !== null
          ))
        ))
        || source.nightly_breakdown.some((entry) => (
          !hasExactKeys(entry, nightKeys)
          || !isExactIsoDate(entry.stay_date)
          || entry.stay_date < request.check_in || entry.stay_date >= request.check_out
          || !normalizeUuid(entry.room_type_id) || !normalizeUuid(entry.room_rate_id)
          || !normalizeUuid(entry.rate_plan_id) || !isExactInteger(entry.unit_sequence, 1, 50)
          || !isExactInteger(entry.allocated_guest_count, 1, 50)
          || !isExactInteger(entry.requested_pricing_guest_count, 1, 50)
          || !isExactInteger(entry.resolved_pricing_guest_count, 1, 50)
          || !isExactInteger(entry.minimum_billable_occupancy, 1, 50)
          || !baseSources.includes(entry.base_pricing_source)
          || !normalizePricingSourceUuid(entry.base_pricing_source, entry.base_pricing_source_id)
          || !(entry.los_threshold_nights === null || isExactInteger(entry.los_threshold_nights, 1, 3650))
          || !nullableUuid(entry.weekday_rule_id) || !nullableUuid(entry.seasonal_range_rule_id)
          || !nullableUuid(entry.exact_date_price_id)
          || !finalSources.includes(entry.final_pricing_source)
          || !isExactMoney(entry.nightly_rate) || entry.currency !== source.currency
          || !nullableStay(entry.effective_minimum_stay) || !nullableStay(entry.effective_maximum_stay)
          || !staySources.includes(entry.minimum_stay_source)
          || !staySources.includes(entry.maximum_stay_source)
          || (entry.minimum_stay_source === null) !== (entry.minimum_stay_source_id === null)
          || (entry.maximum_stay_source === null) !== (entry.maximum_stay_source_id === null)
          || !nullableUuid(entry.minimum_stay_source_id) || !nullableUuid(entry.maximum_stay_source_id)
        ))
        || JSON.stringify(source.pricing_precedence) !== JSON.stringify(expectedPrecedence)
        || typeof source.legacy_authoritative !== 'boolean'
        || (request.hotel_id === SEVEN_ARCHES_PROPERTY_ID && source.legacy_authoritative !== true)
        || source.public_change !== false) {
      throw new Error('The server pricing preview returned an unexpected or unsafe response.');
    }
    const allocationRuleIds = new Set(source.allocation.map((entry) => normalizeUuid(entry.allocation_rule_id)));
    const allocatedRoomIds = new Set(source.allocation.map((entry) => normalizeUuid(entry.room_type_id)));
    const productKeysByUnit = new Map();
    for (const product of source.products) {
      const key = `${product.room_rate_id}:${product.unit_sequence}`;
      if (productKeysByUnit.has(key)
          || !allocatedRoomIds.has(normalizeUuid(product.room_type_id))
          || (request.rate_plan_id && normalizeUuid(product.rate_plan_id) !== request.rate_plan_id)) {
        throw new Error('The server pricing preview returned a duplicate or unrelated Room product.');
      }
      productKeysByUnit.set(key, product);
    }
    if (allocationRuleIds.size > 1
        || new Set(source.products.map((entry) => normalizeUuid(entry.rate_plan_id))).size > 1
        || (request.selected_room_type_id
        && (source.allocation.length !== 1
          || normalizeUuid(source.allocation[0].room_type_id) !== request.selected_room_type_id))
        || (request.allocation_rule_id
          && [...allocationRuleIds].some((id) => id !== request.allocation_rule_id))) {
      throw new Error('The server pricing preview did not preserve the reviewed allocation selection.');
    }
    const nightsByProduct = new Map();
    for (const night of source.nightly_breakdown) {
      const key = `${night.room_rate_id}:${night.unit_sequence}`;
      const product = productKeysByUnit.get(key);
      if (!product
          || normalizeUuid(night.room_type_id) !== normalizeUuid(product.room_type_id)
          || normalizeUuid(night.rate_plan_id) !== normalizeUuid(product.rate_plan_id)
          || night.allocated_guest_count !== product.allocated_guest_count
          || night.requested_pricing_guest_count !== product.requested_pricing_guest_count
          || night.resolved_pricing_guest_count !== product.resolved_pricing_guest_count
          || night.minimum_billable_occupancy !== product.minimum_billable_occupancy
          || night.base_pricing_source !== product.base_pricing_source
          || normalizePricingSourceUuid(night.base_pricing_source, night.base_pricing_source_id)
            !== normalizePricingSourceUuid(product.base_pricing_source, product.base_pricing_source_id)
          || night.los_threshold_nights !== product.los_threshold_nights) {
        throw new Error('The server pricing preview returned an unrelated nightly price row.');
      }
      const rows = nightsByProduct.get(key) || [];
      rows.push(night);
      nightsByProduct.set(key, rows);
    }
    for (const [key, product] of productKeysByUnit) {
      const rows = (nightsByProduct.get(key) || []).sort((a, b) => a.stay_date.localeCompare(b.stay_date));
      const expectedRows = product.subtotal === null ? 0 : source.nights;
      if (rows.length !== expectedRows
          || new Set(rows.map((row) => row.stay_date)).size !== expectedRows
          || (product.subtotal !== null
            && Number(rows.reduce((sum, row) => sum + row.nightly_rate, 0).toFixed(2)) !== product.subtotal)) {
        throw new Error('The server pricing preview returned an incomplete or inconsistent nightly breakdown.');
      }
    }
    const productTotal = Number(source.products.reduce((sum, product) => sum + (product.subtotal || 0), 0).toFixed(2));
    const allocatedUnitCount = source.allocation
      .reduce((sum, allocation) => sum + allocation.units_required, 0);
    if ((source.ok && source.customer_total !== productTotal)
        || (source.ok && (source.allocation.length === 0
          || source.products.length === 0
          || source.products.length !== allocatedUnitCount
          || source.nightly_breakdown.length !== source.products.length * source.nights))
        || (!source.ok && source.customer_total !== null)
        || (source.ok && source.products.some((product) => product.subtotal === null))
        || source.requestable !== false) {
      throw new Error('The server pricing preview returned an inconsistent or publicly requestable total.');
    }
    return clone(source);
  }

  function availabilityRowIdentity(entity, row) {
    const source = asObject(row);
    if (entity === 'daily_inventory') {
      return `${normalizeUuid(source.room_type_id) || ''}:${asText(source.stay_date)}`;
    }
    if (entity === 'operational_override') {
      return `${normalizeUuid(source.room_rate_id) || ''}:${asText(source.stay_date)}`;
    }
    return normalizeUuid(source.id) || asText(source.id);
  }

  function isExactAvailabilityI18n(value, options = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some((key) => !LANGUAGES.includes(key))
        || (options.exact === true && LANGUAGES.some((key) => !Object.hasOwn(value, key)))
        || Object.values(value).some((entry) => typeof entry !== 'string' || entry.length > 1000)) return false;
    return options.required !== true || Object.values(value).some((entry) => entry.trim());
  }

  function availabilityUtf8Bytes(value) {
    return Array.from(JSON.stringify(value)).reduce((total, character) => {
      const code = character.codePointAt(0);
      return total + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
    }, 0);
  }

  function availabilityDateRange(from, to) {
    if (!isExactIsoDate(from) || !isExactIsoDate(to) || to < from) return [];
    const dates = [];
    const cursor = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cursor <= end && dates.length <= 3660) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  function availabilityUuidFieldsAreCanonical(value, field = '') {
    if (field === 'id' || field.endsWith('_id')) {
      return value === null || (typeof value === 'string' && normalizeUuid(value) === value);
    }
    if (field.endsWith('_ids')) {
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && normalizeUuid(entry) === entry);
    }
    if (Array.isArray(value)) return value.every((entry) => availabilityUuidFieldsAreCanonical(entry));
    if (!value || typeof value !== 'object') return true;
    return Object.entries(value).every(([key, nested]) => availabilityUuidFieldsAreCanonical(nested, key));
  }

  function normalizeAvailabilityActivityRows(rows, options = {}) {
    const activityKeys = ['id', 'entity_type', 'entity_id', 'action', 'before_state', 'after_state', 'actor_type', 'source', 'correlation_id', 'created_at'];
    const maximum = options.maximum || AVAILABILITY_CONTROL_READ_LIMITS.recent_activity;
    if (!Array.isArray(rows) || !availabilityUuidFieldsAreCanonical(rows)
        || rows.length > maximum || rows.some((row) => !hasExactKeys(row, activityKeys))) {
      throw new Error('The Admin availability activity projection is invalid or exceeds its exact limit.');
    }
    const normalized = rows.map((row) => ({
      ...clone(row), id: normalizeUuid(row.id), entity_id: normalizeUuid(row.entity_id), correlation_id: normalizeUuid(row.correlation_id),
    }));
    const validActivityState = (state) => state === null || (hasExactKeys(state, ['fingerprint', 'redacted'])
      && /^[0-9a-f]{64}$/.test(state.fingerprint) && state.redacted === true);
    const actions = options.apply === true
      ? ['create', 'update', 'disable', 'upsert', 'delete', 'map', 'release', 'clear']
      : ['create', 'update', 'disable', 'duplicate', 'delete'];
    if (normalized.some((row) => !row.id || !row.entity_id || !row.correlation_id
        || !['daily_inventory', 'calendar_override', 'unit_calendar_block', 'rate_rule_operational_restriction', 'booking_allocation', 'inventory_hold'].includes(row.entity_type)
        || !actions.includes(row.action)
        || !validActivityState(row.before_state) || !validActivityState(row.after_state)
        || (row.before_state === null && row.after_state === null)
        || !['admin', 'partner', 'sync', 'system'].includes(row.actor_type)
        || typeof row.source !== 'string' || !row.source.trim() || row.source !== row.source.trim() || row.source.length > 120
        || !isExactIsoTimestamp(row.created_at))
        || new Set(normalized.map((row) => row.id)).size !== normalized.length) {
      throw new Error('The Admin availability activity projection is invalid.');
    }
    return normalized;
  }

  function normalizeAvailabilityControl(value) {
    const source = asObject(clone(value));
    const requiredKeys = [
      'contract_version', 'hotel_id', 'from', 'to', 'snapshot_token',
      'snapshot_as_of', 'snapshot_valid_until', 'property', 'room_types', 'room_rates',
      'units', 'cells', 'product_cells', 'daily_inventory', 'unit_calendar_blocks',
      'operational_overrides', 'rate_rule_operational_restrictions',
      'booking_allocations', 'holds', 'unmapped_booking_blockers', 'recent_activity',
      'public_change',
    ];
    if (!hasExactKeys(source, requiredKeys) || !availabilityUuidFieldsAreCanonical(source)
        || source.contract_version !== AVAILABILITY_CONTROL_READ_CONTRACT
        || !normalizeUuid(source.hotel_id)
        || !isExactIsoDate(source.from) || !isExactIsoDate(source.to) || source.to < source.from
        || !/^[0-9a-f]{64}$/.test(asText(source.snapshot_token))
        || !isExactIsoTimestamp(source.snapshot_as_of)
        || !(source.snapshot_valid_until === null || isExactIsoTimestamp(source.snapshot_valid_until))
        || (source.snapshot_valid_until !== null
          && Date.parse(source.snapshot_valid_until) < Date.parse(source.snapshot_as_of))
        || source.public_change !== false
        || requiredKeys.slice(requiredKeys.indexOf('room_types'), requiredKeys.indexOf('public_change'))
          .filter((key) => !['property'].includes(key))
          .some((key) => !Array.isArray(source[key]))
        || availabilityUtf8Bytes(source) > AVAILABILITY_CONTROL_READ_LIMITS.snapshot_bytes) {
      throw new Error('The Admin availability snapshot contract is invalid or incomplete.');
    }
    const hotelId = normalizeUuid(source.hotel_id);
    const property = asObject(source.property);
    const propertyKeys = ['id', 'name_i18n', 'architecture_version', 'timezone', 'currency', 'booking_mode', 'minimum_stay_nights', 'maximum_stay_nights', 'updated_at'];
    if (!hasExactKeys(property, propertyKeys) || normalizeUuid(property.id) !== hotelId
        || !isExactAvailabilityI18n(property.name_i18n, { exact: true, required: true })
        || !['legacy', 'rooms_v2'].includes(property.architecture_version)
        || typeof property.timezone !== 'string' || !property.timezone.trim()
        || typeof property.currency !== 'string' || !/^[A-Z]{3}$/.test(property.currency)
        || typeof property.booking_mode !== 'string'
        || !isExactInteger(property.minimum_stay_nights, 1, 3650)
        || !(property.maximum_stay_nights === null || isExactInteger(property.maximum_stay_nights, property.minimum_stay_nights, 3650))
        || !isExactIsoTimestamp(property.updated_at)) {
      throw new Error('The Admin availability snapshot returned a foreign property.');
    }
    const exactRows = (rows, keys, label, limit) => {
      if (!Array.isArray(rows) || rows.length > limit || rows.some((row) => !hasExactKeys(row, keys))) {
        throw new Error(`The Admin availability ${label} projection is invalid or exceeds its technical limit.`);
      }
      return rows.map(clone);
    };
    const roomKeys = ['id', 'hotel_id', 'code', 'name_i18n', 'inventory_mode', 'base_inventory_count', 'status', 'sort_order', 'max_occupancy', 'capacity_adults', 'capacity_children', 'version', 'updated_at'];
    const roomTypes = source.room_types.map((room) => {
      if (!hasExactKeys(room, roomKeys)) throw new Error('The Admin availability Room Type projection contains unsupported fields.');
      const normalized = { ...clone(room), id: normalizeUuid(room.id), hotel_id: normalizeUuid(room.hotel_id) };
      if (!normalized.id || normalized.hotel_id !== hotelId || !asText(normalized.code)
          || !isExactAvailabilityI18n(normalized.name_i18n, { required: true })
          || !INVENTORY_MODES.includes(normalized.inventory_mode)
          || !ROOM_STATUSES.includes(normalized.status)
          || !isExactInteger(normalized.base_inventory_count, 0, 10000)
          || !isExactInteger(normalized.sort_order, 0, 1000000)
          || !(normalized.max_occupancy === null || isExactInteger(normalized.max_occupancy, 1, 50))
          || !(normalized.capacity_adults === null || isExactInteger(normalized.capacity_adults, 1, 50))
          || !(normalized.capacity_children === null || isExactInteger(normalized.capacity_children, 0, 50))
          || !isExactInteger(normalized.version, 1) || !isExactIsoTimestamp(normalized.updated_at)) {
        throw new Error('The Admin availability snapshot returned an invalid or foreign Room Type.');
      }
      return normalized;
    });
    if (roomTypes.length > AVAILABILITY_CONTROL_READ_LIMITS.room_types
        || new Set(roomTypes.map((room) => room.id)).size !== roomTypes.length) {
      throw new Error('The Admin availability Room Type snapshot exceeds its exact limits or contains duplicates.');
    }
    const roomById = new Map(roomTypes.map((room) => [room.id, room]));
    const rateKeys = ['id', 'hotel_id', 'room_type_id', 'rate_plan_id', 'is_active', 'review_status', 'sort_order', 'version', 'updated_at'];
    const roomRates = exactRows(source.room_rates, rateKeys, 'Room Rate', AVAILABILITY_CONTROL_READ_LIMITS.room_rates).map((rate) => ({
      ...rate, id: normalizeUuid(rate.id), hotel_id: normalizeUuid(rate.hotel_id),
      room_type_id: normalizeUuid(rate.room_type_id), rate_plan_id: normalizeUuid(rate.rate_plan_id),
    }));
    if (roomRates.some((rate) => !rate.id || rate.hotel_id !== hotelId || !roomById.has(rate.room_type_id)
        || !rate.rate_plan_id || typeof rate.is_active !== 'boolean' || !['requires_review', 'reviewed'].includes(rate.review_status)
        || !isExactInteger(rate.sort_order, 0, 1000000) || !isExactInteger(rate.version, 1)
        || !isExactIsoTimestamp(rate.updated_at))
        || new Set(roomRates.map((rate) => rate.id)).size !== roomRates.length) {
      throw new Error('The Admin availability Room Rate snapshot exceeds its technical limit.');
    }
    const rateById = new Map(roomRates.map((rate) => [rate.id, rate]));
    const unitKeys = ['id', 'room_type_id', 'code', 'name_i18n', 'status', 'version', 'updated_at'];
    const units = exactRows(source.units, unitKeys, 'physical unit', AVAILABILITY_CONTROL_READ_LIMITS.room_types * 100).map((unit) => ({
      ...unit, id: normalizeUuid(unit.id), room_type_id: normalizeUuid(unit.room_type_id),
    }));
    if (units.some((unit) => !unit.id || !roomById.has(unit.room_type_id) || !asText(unit.code)
        || !isExactAvailabilityI18n(unit.name_i18n)
        || !UNIT_STATUSES.includes(unit.status) || !isExactInteger(unit.version, 1)
        || !isExactIsoTimestamp(unit.updated_at))
        || new Set(units.map((unit) => unit.id)).size !== units.length) {
      throw new Error('The Admin availability unit snapshot is invalid, foreign or duplicated.');
    }
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const activeUnitsByRoom = new Map(roomTypes.map((room) => [room.id,
      units.filter((unit) => unit.room_type_id === room.id && unit.status === 'active').length]));
    const cells = source.cells.map((cell) => {
      const row = clone(cell);
      const keys = [
        'room_type_id', 'stay_date', 'inventory_mode', 'physical_capacity',
        'configured_sellable_units', 'blocked_unit_count', 'blocked_unit_ids',
        'operational_closed', 'safety_closed',
        'held_units', 'booked_units', 'committed_units', 'available_units',
        'requestable', 'blocking_reasons', 'earliest_hold_expiry', 'provenance', 'inventory_version',
      ];
      if (!hasExactKeys(row, keys)) throw new Error('An Admin availability cell contains unsupported fields.');
      row.room_type_id = normalizeUuid(row.room_type_id);
      const room = roomById.get(row.room_type_id);
      if (!room || !isExactIsoDate(row.stay_date)
          || row.stay_date < source.from || row.stay_date > source.to
          || row.inventory_mode !== room.inventory_mode
          || !['physical_capacity', 'configured_sellable_units', 'blocked_unit_count', 'held_units', 'booked_units', 'committed_units', 'available_units']
            .every((key) => isExactInteger(row[key], 0, 1000000))
          || typeof row.operational_closed !== 'boolean' || typeof row.safety_closed !== 'boolean'
          || typeof row.requestable !== 'boolean' || row.requestable !== false || !Array.isArray(row.blocking_reasons)
          || !row.blocking_reasons.length
          || !row.blocking_reasons.every((reason) => AVAILABILITY_BLOCKING_REASONS.includes(reason))
          || !row.blocking_reasons.includes('public_activation_off')
          || new Set(row.blocking_reasons).size !== row.blocking_reasons.length
          || !Array.isArray(row.blocked_unit_ids) || !row.blocked_unit_ids.every((id) => {
            const unit = unitById.get(normalizeUuid(id));
            return unit && unit.room_type_id === row.room_type_id && unit.status === 'active';
          })
          || new Set(row.blocked_unit_ids).size !== row.blocked_unit_ids.length
          || row.blocked_unit_count !== row.blocked_unit_ids.length
          || row.physical_capacity !== (row.inventory_mode === 'unitized'
            ? activeUnitsByRoom.get(row.room_type_id) : room.base_inventory_count)
          || row.committed_units !== row.held_units + row.booked_units
          || row.available_units !== (row.operational_closed || row.safety_closed ? 0 : Math.max(0,
            Math.min(row.physical_capacity - row.blocked_unit_count, row.configured_sellable_units)
              - row.committed_units))
          || (row.operational_closed && !row.blocking_reasons.includes('operational_closed'))
          || (row.safety_closed && !row.blocking_reasons.includes('safety_closed'))
          || (row.available_units < 1 && !row.blocking_reasons.includes('inventory_exhausted'))
          || !(row.earliest_hold_expiry === null || isExactIsoTimestamp(row.earliest_hold_expiry))
          || !isExactInteger(row.inventory_version, 0, Number.MAX_SAFE_INTEGER)
          || !hasExactKeys(row.provenance, ['capacity', 'inventory', 'commitments'])
          || row.provenance.capacity !== 'room_type_or_active_units'
          || row.provenance.inventory !== 'hotel_daily_inventory'
          || row.provenance.commitments !== 'server_authoritative') {
        throw new Error('An Admin availability cell is invalid or outside the reviewed range.');
      }
      return row;
    });
    if (cells.length > AVAILABILITY_CONTROL_READ_LIMITS.inventory_days
        || new Set(cells.map((row) => availabilityRowIdentity('daily_inventory', row))).size !== cells.length) {
      throw new Error('The Admin availability cells exceed their exact limit or contain duplicates.');
    }
    const dates = availabilityDateRange(source.from, source.to);
    if (dates.length > 367) {
      throw new Error('The Admin availability snapshot exceeds the exact 367-day technical window.');
    }
    const expectedCellKeys = new Set(roomTypes.flatMap((room) => dates.map((date) => `${room.id}:${date}`)));
    if (cells.length !== expectedCellKeys.size
        || cells.some((row) => !expectedCellKeys.has(`${row.room_type_id}:${row.stay_date}`))) {
      throw new Error('The Admin availability snapshot omitted a required Room Type/date cell.');
    }
    const productCellKeys = ['room_type_id', 'room_rate_id', 'rate_plan_id', 'stay_date', 'operational_closed', 'closed_to_arrival', 'closed_to_departure', 'safety_closed', 'requestable', 'blocking_reasons', 'provenance'];
    const productCells = exactRows(source.product_cells, productCellKeys, 'product cell', AVAILABILITY_CONTROL_READ_LIMITS.restriction_days).map((row) => ({
      ...row, room_type_id: normalizeUuid(row.room_type_id), room_rate_id: normalizeUuid(row.room_rate_id), rate_plan_id: normalizeUuid(row.rate_plan_id),
    }));
    if (productCells.some((row) => {
      const rate = rateById.get(row.room_rate_id);
      return !rate || rate.room_type_id !== row.room_type_id || rate.rate_plan_id !== row.rate_plan_id
        || !isExactIsoDate(row.stay_date) || row.stay_date < source.from || row.stay_date > source.to
        || !['operational_closed', 'closed_to_arrival', 'closed_to_departure', 'safety_closed', 'requestable'].every((key) => typeof row[key] === 'boolean')
        || row.requestable !== false || !Array.isArray(row.blocking_reasons) || !row.blocking_reasons.length
        || !row.blocking_reasons.every((reason) => AVAILABILITY_BLOCKING_REASONS.includes(reason))
        || !row.blocking_reasons.includes('public_activation_off')
        || new Set(row.blocking_reasons).size !== row.blocking_reasons.length
        || (row.operational_closed && !row.blocking_reasons.includes('operational_closed'))
        || (row.safety_closed && !row.blocking_reasons.includes('safety_closed'))
        || (!rate.is_active && !row.blocking_reasons.includes('room_rate_inactive'))
        || !hasExactKeys(row.provenance, ['exact_override_id', 'daily_rate', 'availability_version'])
        || !(row.provenance.exact_override_id === null || normalizeUuid(row.provenance.exact_override_id))
        || typeof row.provenance.daily_rate !== 'boolean'
        || !(row.provenance.availability_version === null || isExactInteger(row.provenance.availability_version, 1));
    }) || new Set(productCells.map((row) => `${row.room_rate_id}:${row.stay_date}`)).size !== productCells.length) {
      throw new Error('The Admin availability product cells are invalid, foreign or duplicated.');
    }
    const expectedProductCellKeys = new Set(roomRates.flatMap((rate) => dates.map((date) => `${rate.id}:${date}`)));
    if (productCells.length !== expectedProductCellKeys.size
        || productCells.some((row) => !expectedProductCellKeys.has(`${row.room_rate_id}:${row.stay_date}`))) {
      throw new Error('The Admin availability snapshot omitted a required Room Rate/date product cell.');
    }

    const inventoryKeys = ['room_type_id', 'stay_date', 'sellable_units', 'sellable_units_mode', 'closed', 'closed_mode', 'reason', 'expires_at', 'version', 'updated_at'];
    const dailyInventory = exactRows(source.daily_inventory, inventoryKeys, 'daily inventory', AVAILABILITY_CONTROL_READ_LIMITS.inventory_days).map((row) => ({ ...row, room_type_id: normalizeUuid(row.room_type_id) }));
    if (dailyInventory.some((row) => !roomById.has(row.room_type_id) || !isExactIsoDate(row.stay_date)
        || row.stay_date < source.from || row.stay_date > source.to
        || !isExactInteger(row.sellable_units, 0, 1000000) || !['set', 'clear'].includes(row.sellable_units_mode)
        || typeof row.closed !== 'boolean' || !['set', 'clear'].includes(row.closed_mode)
        || !(row.reason === null || typeof row.reason === 'string') || !(row.expires_at === null || isExactIsoTimestamp(row.expires_at))
        || !isExactInteger(row.version, 1) || !isExactIsoTimestamp(row.updated_at))
        || new Set(dailyInventory.map((row) => `${row.room_type_id}:${row.stay_date}`)).size !== dailyInventory.length) {
      throw new Error('The Admin availability daily inventory rows are invalid or duplicated.');
    }

    const unitBlockKeys = ['id', 'hotel_id', 'room_type_id', 'unit_id', 'from_date', 'to_date', 'blocked', 'reason', 'expires_at', 'is_active', 'version', 'updated_at'];
    const unitCalendarBlocks = exactRows(source.unit_calendar_blocks, unitBlockKeys, 'unit block', AVAILABILITY_CONTROL_READ_LIMITS.inventory_days).map((row) => ({ ...row, id: normalizeUuid(row.id), hotel_id: normalizeUuid(row.hotel_id), room_type_id: normalizeUuid(row.room_type_id), unit_id: normalizeUuid(row.unit_id) }));
    if (unitCalendarBlocks.some((row) => !row.id || row.hotel_id !== hotelId || !unitById.has(row.unit_id)
        || unitById.get(row.unit_id).room_type_id !== row.room_type_id || !isExactIsoDate(row.from_date) || !isExactIsoDate(row.to_date) || row.to_date < row.from_date
        || row.to_date < source.from || row.from_date > source.to
        || typeof row.blocked !== 'boolean' || typeof row.reason !== 'string' || !(row.expires_at === null || isExactIsoTimestamp(row.expires_at))
        || typeof row.is_active !== 'boolean' || !isExactInteger(row.version, 1) || !isExactIsoTimestamp(row.updated_at))
        || new Set(unitCalendarBlocks.map((row) => row.id)).size !== unitCalendarBlocks.length) {
      throw new Error('The Admin availability unit blocks are invalid or foreign.');
    }

    const overrideKeys = ['id', 'hotel_id', 'room_rate_id', 'stay_date', 'closed', 'closed_mode', 'closed_to_arrival', 'closed_to_arrival_mode', 'closed_to_departure', 'closed_to_departure_mode', 'availability_active', 'availability_expires_at', 'availability_version', 'availability_reason', 'availability_updated_at'];
    const operationalOverrides = exactRows(source.operational_overrides, overrideKeys, 'exact operational override', AVAILABILITY_CONTROL_READ_LIMITS.restriction_days).map((row) => ({ ...row, id: normalizeUuid(row.id), hotel_id: normalizeUuid(row.hotel_id), room_rate_id: normalizeUuid(row.room_rate_id) }));
    if (operationalOverrides.some((row) => !row.id || row.hotel_id !== hotelId || !rateById.has(row.room_rate_id) || !isExactIsoDate(row.stay_date)
        || row.stay_date < source.from || row.stay_date > source.to
        || !['closed', 'closed_to_arrival', 'closed_to_departure'].every((key) => row[key] === null || typeof row[key] === 'boolean')
        || typeof row.availability_active !== 'boolean'
        || !['closed_mode', 'closed_to_arrival_mode', 'closed_to_departure_mode'].every((key) => row[key] === null || ['set', 'clear'].includes(row[key]))
        || !['closed', 'closed_to_arrival', 'closed_to_departure'].every((key) => (
          row[`${key}_mode`] === 'set' ? typeof row[key] === 'boolean'
            : (['clear', null].includes(row[`${key}_mode`]) && row[key] === null)))
        || !(row.availability_reason === null || typeof row.availability_reason === 'string')
        || !(row.availability_expires_at === null || isExactIsoTimestamp(row.availability_expires_at))
        || !isExactInteger(row.availability_version, 1)
        || !(row.availability_updated_at === null || isExactIsoTimestamp(row.availability_updated_at)))
        || new Set(operationalOverrides.map((row) => row.id)).size !== operationalOverrides.length
        || new Set(operationalOverrides.map((row) => `${row.room_rate_id}:${row.stay_date}`)).size !== operationalOverrides.length) {
      throw new Error('The Admin exact operational overrides are invalid or foreign.');
    }

    const rateRestrictionKeys = ['id', 'room_rate_id', 'valid_from', 'valid_to', 'weekdays', 'closed_to_arrival', 'closed_to_departure', 'availability_version', 'availability_reason', 'availability_actor_id', 'availability_correlation_id', 'availability_updated_at'];
    const rateRuleRestrictions = exactRows(source.rate_rule_operational_restrictions, rateRestrictionKeys, 'shared Rate Rule restriction', AVAILABILITY_CONTROL_READ_LIMITS.restriction_days).map((row) => ({ ...row, id: normalizeUuid(row.id), room_rate_id: normalizeUuid(row.room_rate_id) }));
    if (rateRuleRestrictions.some((row) => !row.id || !rateById.has(row.room_rate_id) || !isExactIsoDate(row.valid_from) || !isExactIsoDate(row.valid_to) || row.valid_to < row.valid_from
        || row.valid_to < source.from || row.valid_from > source.to
        || !Array.isArray(row.weekdays) || !row.weekdays.length || !row.weekdays.every((day) => isExactInteger(day, 1, 7)) || new Set(row.weekdays).size !== row.weekdays.length
        || !(row.closed_to_arrival === null || typeof row.closed_to_arrival === 'boolean')
        || !(row.closed_to_departure === null || typeof row.closed_to_departure === 'boolean')
        || !isExactInteger(row.availability_version, 1) || !(row.availability_reason === null || typeof row.availability_reason === 'string')
        || !(row.availability_actor_id === null || normalizeUuid(row.availability_actor_id))
        || !(row.availability_correlation_id === null || normalizeUuid(row.availability_correlation_id))
        || !(row.availability_updated_at === null || isExactIsoTimestamp(row.availability_updated_at)))
        || new Set(rateRuleRestrictions.map((row) => row.id)).size !== rateRuleRestrictions.length) {
      throw new Error('The Admin shared Rate Rule restrictions are invalid or foreign.');
    }

    const allocationKeys = ['id', 'booking_id', 'arrival_date', 'departure_date', 'current_booking_updated_at', 'current_booking_status', 'room_type_id', 'rate_plan_id', 'room_rate_id', 'unit_ids', 'units_required', 'allocated_guest_counts', 'pricing_guest_counts', 'booking_updated_at', 'status', 'version', 'updated_at', 'active_commitment_from', 'active_commitment_to', 'active_commitments'];
    const rawBookingAllocations = exactRows(source.booking_allocations, allocationKeys, 'booking allocation', AVAILABILITY_CONTROL_READ_LIMITS.holds);
    if (rawBookingAllocations.some((row) => !Array.isArray(row.unit_ids)
        || !Array.isArray(row.allocated_guest_counts) || !Array.isArray(row.pricing_guest_counts)
        || !Array.isArray(row.active_commitments))) {
      throw new Error('The Admin booking allocation projection has an invalid nested collection.');
    }
    const bookingAllocations = rawBookingAllocations.map((row) => ({ ...row, id: normalizeUuid(row.id), booking_id: normalizeUuid(row.booking_id), room_type_id: normalizeUuid(row.room_type_id), rate_plan_id: normalizeUuid(row.rate_plan_id), room_rate_id: normalizeUuid(row.room_rate_id), unit_ids: row.unit_ids.map(normalizeUuid), active_commitments: row.active_commitments.map((commitment) => ({ ...commitment, room_type_id: normalizeUuid(commitment.room_type_id), unit_id: commitment.unit_id === null ? null : normalizeUuid(commitment.unit_id) })) }));
    if (bookingAllocations.some((row) => {
      const rate = rateById.get(row.room_rate_id);
      const room = roomById.get(row.room_type_id);
      const liveAllocation = row.status === 'active' && ['pending', 'confirmed'].includes(row.current_booking_status);
      const roomCapacity = room?.max_occupancy ?? (room && room.capacity_adults !== null && room.capacity_children !== null
        ? room.capacity_adults + room.capacity_children : null);
      const activeDates = row.active_commitments.map((commitment) => commitment.stay_date).sort();
      return !row.id || !row.booking_id || !rate || rate.room_type_id !== row.room_type_id || rate.rate_plan_id !== row.rate_plan_id
        || !isExactIsoDate(row.arrival_date) || !isExactIsoDate(row.departure_date) || row.departure_date <= row.arrival_date
        || !isExactIsoTimestamp(row.current_booking_updated_at)
        || !['pending', 'confirmed', 'completed', 'cancelled'].includes(row.current_booking_status)
        || !room || !Array.isArray(row.unit_ids) || row.unit_ids.some((id) => !unitById.has(id)
          || unitById.get(id).room_type_id !== row.room_type_id
          || (liveAllocation && unitById.get(id).status !== 'active'))
        || new Set(row.unit_ids).size !== row.unit_ids.length || !isExactInteger(row.units_required, 1, 1000)
        || (liveAllocation
          ? (room.inventory_mode === 'pooled' ? row.unit_ids.length !== 0 : row.unit_ids.length !== row.units_required)
          : !(row.unit_ids.length === 0 || row.unit_ids.length === row.units_required))
        || !Array.isArray(row.allocated_guest_counts) || !row.allocated_guest_counts.every((count) => isExactInteger(count, 1, 50))
        || !Array.isArray(row.pricing_guest_counts) || !row.pricing_guest_counts.every((count) => isExactInteger(count, 1, 50))
        || row.allocated_guest_counts.length !== row.units_required || row.pricing_guest_counts.length !== row.units_required
        || roomCapacity === null || row.allocated_guest_counts.some((count) => count > roomCapacity)
        || row.pricing_guest_counts.some((count) => count > roomCapacity)
        || !isExactIsoTimestamp(row.booking_updated_at)
        || Date.parse(row.current_booking_updated_at) < Date.parse(row.booking_updated_at)
        || !['active', 'released'].includes(row.status)
        || !((row.active_commitment_from === null && row.active_commitment_to === null && row.active_commitments.length === 0)
          || (isExactIsoDate(row.active_commitment_from) && isExactIsoDate(row.active_commitment_to)
            && row.active_commitment_to >= row.active_commitment_from && row.active_commitments.length > 0
            && activeDates[0] === row.active_commitment_from && activeDates[activeDates.length - 1] === row.active_commitment_to))
        || row.active_commitments.some((commitment) => !hasExactKeys(commitment, ['room_type_id', 'stay_date', 'unit_id', 'units', 'status'])
          || commitment.room_type_id !== row.room_type_id || !isExactIsoDate(commitment.stay_date)
          || commitment.status !== 'active' || !isExactInteger(commitment.units, 1, 1000)
          || (commitment.unit_id !== null && commitment.units !== 1)
          || (liveAllocation
            ? (room.inventory_mode === 'pooled' ? commitment.unit_id !== null
              : !(commitment.unit_id && unitById.get(commitment.unit_id)?.room_type_id === row.room_type_id
                && unitById.get(commitment.unit_id)?.status === 'active'
                && row.unit_ids.includes(commitment.unit_id)))
            : !(commitment.unit_id === null || unitById.get(commitment.unit_id)?.room_type_id === row.room_type_id)))
        || new Set(row.active_commitments.map((commitment) => `${commitment.room_type_id}:${commitment.stay_date}:${commitment.unit_id || 'pooled'}`)).size !== row.active_commitments.length
        || !(row.arrival_date <= source.to && row.departure_date > source.from
          || (row.active_commitment_from !== null && row.active_commitment_from <= source.to
            && row.active_commitment_to >= source.from))
        || !isExactInteger(row.version, 1) || !isExactIsoTimestamp(row.updated_at);
    }) || new Set(bookingAllocations.map((row) => row.id)).size !== bookingAllocations.length
      || bookingAllocations.some((row) => bookingAllocations.some((other) => other.booking_id === row.booking_id
        && (other.arrival_date !== row.arrival_date || other.departure_date !== row.departure_date
          || other.current_booking_updated_at !== row.current_booking_updated_at
          || other.current_booking_status !== row.current_booking_status)))
      || bookingAllocations.some((row) => row.status === 'active' && bookingAllocations.some((other) => (
        other.id !== row.id && other.booking_id === row.booking_id && other.status === 'active'
        && row.unit_ids.some((unitId) => other.unit_ids.includes(unitId)))))) {
      throw new Error('The Admin booking allocation projection is invalid or foreign.');
    }

    const holdKeys = ['id', 'status', 'expires_at', 'version', 'created_at', 'updated_at', 'active_commitment_from', 'active_commitment_to', 'commitments'];
    const commitmentKeys = ['room_type_id', 'stay_date', 'unit_id', 'units', 'status'];
    const rawHolds = exactRows(source.holds, holdKeys, 'hold', AVAILABILITY_CONTROL_READ_LIMITS.holds);
    if (rawHolds.some((hold) => !Array.isArray(hold.commitments))) {
      throw new Error('The Admin hold projection has an invalid commitments collection.');
    }
    const holds = rawHolds.map((hold) => ({ ...hold, id: normalizeUuid(hold.id), commitments: hold.commitments.map((row) => ({ ...row, room_type_id: normalizeUuid(row.room_type_id), unit_id: row.unit_id === null ? null : normalizeUuid(row.unit_id) })) }));
    if (holds.some((hold) => {
      const liveHold = hold.status === 'active' && isExactIsoTimestamp(hold.expires_at)
        && Date.parse(hold.expires_at) > Date.parse(source.snapshot_as_of);
      return !hold.id || !['active', 'released', 'expired', 'consumed'].includes(hold.status) || !isExactIsoTimestamp(hold.expires_at)
        || !((hold.active_commitment_from === null && hold.active_commitment_to === null)
          || (isExactIsoDate(hold.active_commitment_from) && isExactIsoDate(hold.active_commitment_to)
            && hold.active_commitment_to >= hold.active_commitment_from))
        || !isExactInteger(hold.version, 1) || !isExactIsoTimestamp(hold.created_at) || !isExactIsoTimestamp(hold.updated_at)
        || !Array.isArray(hold.commitments) || !hold.commitments.length || hold.commitments.some((row) => !hasExactKeys(row, commitmentKeys)
          || !roomById.has(row.room_type_id) || !isExactIsoDate(row.stay_date)
          || (liveHold && row.status === 'active'
            ? (roomById.get(row.room_type_id).inventory_mode === 'pooled'
              ? row.unit_id !== null
              : !(row.unit_id !== null && unitById.has(row.unit_id)
                && unitById.get(row.unit_id).room_type_id === row.room_type_id
                && unitById.get(row.unit_id).status === 'active'))
            : !(row.unit_id === null || (unitById.has(row.unit_id)
              && unitById.get(row.unit_id).room_type_id === row.room_type_id)))
          || row.stay_date < source.from || row.stay_date > source.to
          || !isExactInteger(row.units, 1, 1000)
          || (row.unit_id !== null && row.units !== 1)
          || !['active', 'released', 'expired'].includes(row.status))
        || new Set(hold.commitments.map((row) => `${row.room_type_id}:${row.stay_date}:${row.unit_id || 'pooled'}`)).size !== hold.commitments.length;
    })
        || new Set(holds.map((hold) => hold.id)).size !== holds.length) {
      throw new Error('The Admin hold projection is invalid, foreign or exposes unsupported data.');
    }

    const blockerKeys = ['booking_id', 'booking_updated_at', 'arrival_date', 'departure_date', 'num_adults', 'num_children', 'status', 'reason'];
    const unmappedBookingBlockers = exactRows(source.unmapped_booking_blockers, blockerKeys, 'unmapped booking blocker', AVAILABILITY_CONTROL_READ_LIMITS.holds).map((row) => ({ ...row, booking_id: normalizeUuid(row.booking_id) }));
    if (unmappedBookingBlockers.some((row) => !row.booking_id || !isExactIsoTimestamp(row.booking_updated_at)
        || !isExactIsoDate(row.arrival_date) || !isExactIsoDate(row.departure_date) || row.departure_date <= row.arrival_date
        || row.departure_date <= source.from || row.arrival_date > source.to
        || !isExactInteger(row.num_adults, 1, 50) || !isExactInteger(row.num_children, 0, 50)
        || row.num_adults + row.num_children > 50
        || !['pending', 'confirmed'].includes(row.status)
        || !['exact_booking_allocation_required', 'stale_booking_allocation'].includes(row.reason))
        || new Set(unmappedBookingBlockers.map((row) => row.booking_id)).size !== unmappedBookingBlockers.length) {
      throw new Error('The Admin unmapped booking blockers are invalid.');
    }

    const recentActivity = normalizeAvailabilityActivityRows(source.recent_activity);
    return {
      ...source,
      hotel_id: hotelId,
      property: clone(property),
      room_types: roomTypes,
      room_rates: roomRates,
      units,
      cells,
      product_cells: productCells,
      operational_overrides: operationalOverrides,
      daily_inventory: dailyInventory,
      unit_calendar_blocks: unitCalendarBlocks,
      rate_rule_operational_restrictions: rateRuleRestrictions,
      booking_allocations: bookingAllocations,
      holds,
      unmapped_booking_blockers: unmappedBookingBlockers,
      recent_activity: recentActivity,
    };
  }

  function availabilityIntentTargetKey(intent) {
    const source = asObject(intent);
    const payload = asObject(source.payload);
    if (source.entity === 'daily_inventory') return `${source.entity}:${normalizeUuid(payload.room_type_id) || ''}:${asText(payload.stay_date)}`;
    if (source.entity === 'operational_override_range') {
      return `${source.entity}:${normalizeUuid(payload.room_rate_id) || ''}:${asText(payload.valid_from)}:${asText(payload.valid_to)}:${asArray(payload.weekdays).join(',')}`;
    }
    if (source.entity === 'operational_override' && source.action === 'create') {
      return `${source.entity}:${normalizeUuid(payload.room_rate_id) || ''}:${asText(payload.stay_date)}`;
    }
    if (source.entity === 'unit_calendar_block' && source.action === 'create') {
      return `${source.entity}:${normalizeUuid(payload.unit_id) || ''}:${asText(payload.from_date)}:${asText(payload.to_date)}`;
    }
    if (source.entity === 'booking_allocation' && source.action === 'map') {
      return `${source.entity}:${normalizeUuid(payload.booking_id) || ''}`;
    }
    return `${source.entity}:${normalizeUuid(source.id) || ''}`;
  }

  function availabilityIntentIdIsValid(entity, action, id) {
    if (entity === 'operational_override_range' || entity === 'daily_inventory'
        || (entity === 'booking_allocation' && action === 'map')) return id === null;
    return Boolean(normalizeUuid(id));
  }

  function availabilityContainsForbiddenMutationKey(value) {
    const forbidden = new Set([
      'nightly_rate', 'price', 'currency', 'commission', 'payment_policy', 'partner_id',
      'architecture_version', 'feature_flag', 'feature_flags', 'customer_email',
      'customer_name', 'email', 'phone', 'notes',
    ]);
    if (Array.isArray(value)) return value.some(availabilityContainsForbiddenMutationKey);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, nested]) => forbidden.has(key.toLowerCase())
      || availabilityContainsForbiddenMutationKey(nested));
  }

  function availabilityPayloadIsValid(entity, action, payload, control = null, options = {}) {
    const row = asObject(payload);
    const snapshot = control ? (options.normalized === true ? control : normalizeAvailabilityControl(control)) : null;
    const roomById = new Map(snapshot?.room_types.map((room) => [room.id, room]) || []);
    const rateById = new Map(snapshot?.room_rates.map((rate) => [rate.id, rate]) || []);
    const unitById = new Map(snapshot?.units.map((unit) => [unit.id, unit]) || []);
    const reasonValid = (reason) => typeof reason === 'string' && reason.length > 0 && reason.length <= 500
      && reason === reason.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(reason);
    const expiryValid = (value) => value === null
      || (isExactIsoTimestamp(value) && Date.parse(value) > Date.now());
    if (entity === 'daily_inventory') {
      if (action === 'delete') return hasExactKeys(row, ['room_type_id', 'stay_date', 'reason'])
        && Boolean(normalizeUuid(row.room_type_id)) && (!snapshot || roomById.has(normalizeUuid(row.room_type_id)))
        && isExactIsoDate(row.stay_date) && reasonValid(row.reason);
      const allowed = ['room_type_id', 'stay_date', 'sellable_units', 'sellable_units_mode', 'closed', 'closed_mode', 'reason', 'expires_at'];
      const sellablePresent = Object.hasOwn(row, 'sellable_units') || Object.hasOwn(row, 'sellable_units_mode');
      const closedPresent = Object.hasOwn(row, 'closed') || Object.hasOwn(row, 'closed_mode');
      return action === 'upsert' && Object.keys(row).every((key) => allowed.includes(key))
        && ['room_type_id', 'stay_date', 'reason'].every((key) => Object.hasOwn(row, key))
        && (sellablePresent || closedPresent || Object.hasOwn(row, 'expires_at'))
        && Boolean(normalizeUuid(row.room_type_id)) && (!snapshot || roomById.has(normalizeUuid(row.room_type_id)))
        && isExactIsoDate(row.stay_date)
        && (!sellablePresent || (Object.hasOwn(row, 'sellable_units') && Object.hasOwn(row, 'sellable_units_mode')
          && ['set', 'clear'].includes(row.sellable_units_mode)
          && (row.sellable_units_mode === 'set' ? isExactInteger(row.sellable_units, 0, 1000000) : row.sellable_units === null)))
        && (!closedPresent || (Object.hasOwn(row, 'closed') && Object.hasOwn(row, 'closed_mode')
          && ['set', 'clear'].includes(row.closed_mode)
          && (row.closed_mode === 'set' ? typeof row.closed === 'boolean' : row.closed === null)))
        && reasonValid(row.reason) && (!Object.hasOwn(row, 'expires_at') || expiryValid(row.expires_at));
    }
    if (entity === 'unit_calendar_block') {
      if (action === 'disable') return hasExactKeys(row, ['reason']) && reasonValid(row.reason);
      const unitId = normalizeUuid(row.unit_id);
      const roomTypeId = normalizeUuid(row.room_type_id);
      return ['create', 'update'].includes(action)
        && hasExactKeys(row, ['unit_id', 'room_type_id', 'from_date', 'to_date', 'blocked', 'reason', 'expires_at', 'is_active'])
        && Boolean(unitId) && Boolean(roomTypeId)
        && (!snapshot || (unitById.get(unitId)?.room_type_id === roomTypeId
          && unitById.get(unitId)?.status === 'active'
          && roomById.get(roomTypeId)?.status === 'active'
          && roomById.get(roomTypeId)?.inventory_mode === 'unitized'))
        && isExactIsoDate(row.from_date) && isExactIsoDate(row.to_date) && row.to_date >= row.from_date
        && typeof row.blocked === 'boolean' && reasonValid(row.reason) && expiryValid(row.expires_at)
        && typeof row.is_active === 'boolean';
    }
    if (entity === 'operational_override') {
      if (action === 'disable') return hasExactKeys(row, ['reason']) && reasonValid(row.reason);
      const allowed = ['room_rate_id', 'stay_date', 'closed', 'closed_mode', 'closed_to_arrival', 'closed_to_arrival_mode', 'closed_to_departure', 'closed_to_departure_mode', 'reason', 'availability_expires_at', 'availability_active'];
      const fields = ['closed', 'closed_to_arrival', 'closed_to_departure'];
      return ['create', 'update'].includes(action) && Object.keys(row).every((key) => allowed.includes(key))
        && ['room_rate_id', 'stay_date', 'reason', 'availability_active'].every((key) => Object.hasOwn(row, key))
        && Boolean(normalizeUuid(row.room_rate_id)) && (!snapshot || rateById.has(normalizeUuid(row.room_rate_id)))
        && isExactIsoDate(row.stay_date)
        && (fields.some((key) => Object.hasOwn(row, key) || Object.hasOwn(row, `${key}_mode`))
          || Object.hasOwn(row, 'availability_expires_at'))
        && fields.every((key) => (!Object.hasOwn(row, key) && !Object.hasOwn(row, `${key}_mode`))
          || (Object.hasOwn(row, key) && Object.hasOwn(row, `${key}_mode`)
            && ['set', 'clear'].includes(row[`${key}_mode`])
            && (row[`${key}_mode`] === 'set' ? typeof row[key] === 'boolean' : row[key] === null)))
        && reasonValid(row.reason) && (!Object.hasOwn(row, 'availability_expires_at') || expiryValid(row.availability_expires_at))
        && typeof row.availability_active === 'boolean';
    }
    if (entity === 'operational_override_range') {
      const allowed = ['room_rate_id', 'valid_from', 'valid_to', 'weekdays', 'closed', 'closed_mode', 'closed_to_arrival', 'closed_to_arrival_mode', 'closed_to_departure', 'closed_to_departure_mode', 'reason', 'availability_expires_at'];
      const fields = ['closed', 'closed_to_arrival', 'closed_to_departure'];
      return action === 'expand' && Object.keys(row).every((key) => allowed.includes(key))
        && ['room_rate_id', 'valid_from', 'valid_to', 'weekdays', 'reason'].every((key) => Object.hasOwn(row, key))
        && Boolean(normalizeUuid(row.room_rate_id)) && (!snapshot || rateById.has(normalizeUuid(row.room_rate_id)))
        && isExactIsoDate(row.valid_from) && isExactIsoDate(row.valid_to) && row.valid_to >= row.valid_from
        && (!snapshot || (row.valid_from >= snapshot.from && row.valid_to <= snapshot.to))
        && Array.isArray(row.weekdays) && row.weekdays.length > 0
        && row.weekdays.every((day) => isExactInteger(day, 1, 7))
        && new Set(row.weekdays).size === row.weekdays.length
        && JSON.stringify([...row.weekdays].sort((a, b) => a - b)) === JSON.stringify(row.weekdays)
        && (fields.some((key) => Object.hasOwn(row, key) || Object.hasOwn(row, `${key}_mode`))
          || Object.hasOwn(row, 'availability_expires_at'))
        && fields.every((key) => (!Object.hasOwn(row, key) && !Object.hasOwn(row, `${key}_mode`))
          || (Object.hasOwn(row, key) && Object.hasOwn(row, `${key}_mode`)
            && ['set', 'clear'].includes(row[`${key}_mode`])
            && (row[`${key}_mode`] === 'set' ? typeof row[key] === 'boolean' : row[key] === null)))
        && reasonValid(row.reason) && (!Object.hasOwn(row, 'availability_expires_at') || expiryValid(row.availability_expires_at));
    }
    if (entity === 'rate_rule_operational_restriction') {
      if (action === 'clear') return hasExactKeys(row, ['reason']) && reasonValid(row.reason);
      return action === 'update' && hasExactKeys(row, ['closed_to_arrival', 'closed_to_departure', 'reason'])
        && [row.closed_to_arrival, row.closed_to_departure].every((value) => value === null || typeof value === 'boolean')
        && reasonValid(row.reason);
    }
    if (entity === 'booking_allocation') {
      if (action === 'release') return hasExactKeys(row, ['booking_id', 'reason'])
        && Boolean(normalizeUuid(row.booking_id)) && reasonValid(row.reason);
      if (action !== 'map' || !hasExactKeys(row, ['booking_id', 'booking_updated_at', 'allocations'])
          || !normalizeUuid(row.booking_id) || !isExactIsoTimestamp(row.booking_updated_at)
          || !Array.isArray(row.allocations) || !row.allocations.length) return false;
      const allocationsValid = row.allocations.every((allocation) => {
        if (!hasExactKeys(allocation, ['id', 'room_type_id', 'rate_plan_id', 'room_rate_id', 'unit_ids', 'units_required', 'allocated_guest_counts', 'pricing_guest_counts'])
            || !Array.isArray(allocation.unit_ids) || !Array.isArray(allocation.allocated_guest_counts)
            || !Array.isArray(allocation.pricing_guest_counts)) return false;
        const roomTypeId = normalizeUuid(allocation.room_type_id);
        const room = roomById.get(roomTypeId);
        const roomCapacity = room?.max_occupancy ?? (room && room.capacity_adults !== null && room.capacity_children !== null
          ? room.capacity_adults + room.capacity_children : null);
        const rate = rateById.get(normalizeUuid(allocation.room_rate_id));
        const unitIds = allocation.unit_ids.map(normalizeUuid);
        return Boolean(normalizeUuid(allocation.id)) && Boolean(roomTypeId) && Boolean(normalizeUuid(allocation.rate_plan_id))
          && Boolean(normalizeUuid(allocation.room_rate_id))
          && (!snapshot || (room && rate?.room_type_id === roomTypeId && rate.rate_plan_id === normalizeUuid(allocation.rate_plan_id)))
          && unitIds.every(Boolean) && new Set(unitIds).size === unitIds.length
          && (!snapshot || unitIds.every((id) => unitById.get(id)?.room_type_id === roomTypeId
            && unitById.get(id)?.status === 'active'))
          && isExactInteger(allocation.units_required, 1, 1000)
          && (room?.inventory_mode === 'pooled' ? unitIds.length === 0 : !snapshot || unitIds.length === allocation.units_required)
          && allocation.allocated_guest_counts.length === allocation.units_required
          && allocation.pricing_guest_counts.length === allocation.units_required
          && allocation.allocated_guest_counts.every((count) => isExactInteger(count, 1, 50))
          && allocation.pricing_guest_counts.every((count) => isExactInteger(count, 1, 50))
          && (!snapshot || roomCapacity !== null)
          && (!snapshot || allocation.allocated_guest_counts.every((count) => count <= roomCapacity))
          && (!snapshot || allocation.pricing_guest_counts.every((count) => count <= roomCapacity));
      });
      const selectedUnitIds = row.allocations.flatMap((allocation) => allocation.unit_ids.map(normalizeUuid));
      return allocationsValid && selectedUnitIds.every(Boolean)
        && new Set(selectedUnitIds).size === selectedUnitIds.length;
    }
    return entity === 'hold' && action === 'release'
      && hasExactKeys(row, ['reason']) && reasonValid(row.reason);
  }

  function availabilityTargetMatchesSnapshot(entity, action, id, payload, snapshot) {
    if (!snapshot) return true;
    const targetId = normalizeUuid(id);
    const row = asObject(payload);
    if (entity === 'daily_inventory' && action === 'delete') {
      return snapshot.daily_inventory.some((entry) => entry.room_type_id === normalizeUuid(row.room_type_id)
        && entry.stay_date === row.stay_date);
    }
    if (entity === 'unit_calendar_block' && action !== 'create') {
      const original = snapshot.unit_calendar_blocks.find((entry) => entry.id === targetId);
      return Boolean(original) && (action === 'disable'
        || (normalizeUuid(row.unit_id) === original.unit_id
          && normalizeUuid(row.room_type_id) === original.room_type_id));
    }
    if (entity === 'operational_override' && action !== 'create') {
      const original = snapshot.operational_overrides.find((entry) => entry.id === targetId);
      return Boolean(original) && (action === 'disable'
        || (normalizeUuid(row.room_rate_id) === original.room_rate_id && row.stay_date === original.stay_date));
    }
    if (entity === 'rate_rule_operational_restriction') {
      return snapshot.rate_rule_operational_restrictions.some((entry) => entry.id === targetId);
    }
    if (entity === 'booking_allocation' && action === 'release') {
      return targetId === normalizeUuid(row.booking_id)
        && snapshot.booking_allocations.some((entry) => entry.booking_id === targetId);
    }
    if (entity === 'hold') {
      const hold = snapshot.holds.find((entry) => entry.id === targetId);
      return Boolean(hold) && hold.status === 'active';
    }
    return true;
  }

  function availabilityBookingReleaseOriginalIsValid(originalValue, snapshot, bookingId) {
    const original = asObject(originalValue);
    const originalKeys = ['booking_id', 'booking_updated_at', 'arrival_date', 'departure_date', 'status', 'num_adults', 'num_children', 'allocations', 'commitments'];
    const allocationKeys = ['id', 'room_type_id', 'rate_plan_id', 'room_rate_id', 'unit_ids', 'units_required', 'allocated_guest_counts', 'pricing_guest_counts'];
    const commitmentKeys = ['room_type_id', 'stay_date', 'unit_id', 'units', 'status'];
    const currentRows = snapshot.booking_allocations.filter((row) => row.booking_id === bookingId && row.status === 'active');
    const current = currentRows[0];
    if (!current || !hasExactKeys(original, originalKeys) || normalizeUuid(original.booking_id) !== bookingId
        || original.booking_updated_at !== current.current_booking_updated_at
        || original.arrival_date !== current.arrival_date || original.departure_date !== current.departure_date
        || original.status !== current.current_booking_status
        || !isExactInteger(original.num_adults, 0, 50) || !isExactInteger(original.num_children, 0, 50)
        || original.num_adults + original.num_children < 1
        || !Array.isArray(original.allocations) || !original.allocations.length
        || !Array.isArray(original.commitments)) return false;
    const normalizedAllocations = original.allocations.map((allocation) => {
      if (!hasExactKeys(allocation, allocationKeys) || !Array.isArray(allocation.unit_ids)
          || !Array.isArray(allocation.allocated_guest_counts) || !Array.isArray(allocation.pricing_guest_counts)) return null;
      return {
        ...allocation,
        id: normalizeUuid(allocation.id), room_type_id: normalizeUuid(allocation.room_type_id),
        rate_plan_id: normalizeUuid(allocation.rate_plan_id), room_rate_id: normalizeUuid(allocation.room_rate_id),
        unit_ids: allocation.unit_ids.map(normalizeUuid),
      };
    });
    if (normalizedAllocations.some((row) => !row)) return false;
    const allocationState = (row) => JSON.stringify({
      id: row.id, room_type_id: row.room_type_id, rate_plan_id: row.rate_plan_id,
      room_rate_id: row.room_rate_id, unit_ids: row.unit_ids, units_required: row.units_required,
      allocated_guest_counts: row.allocated_guest_counts, pricing_guest_counts: row.pricing_guest_counts,
    });
    const currentStates = currentRows.map(allocationState).sort();
    const originalStates = normalizedAllocations.map(allocationState).sort();
    if (JSON.stringify(currentStates) !== JSON.stringify(originalStates)
        || normalizedAllocations.reduce((total, row) => total
          + row.allocated_guest_counts.reduce((sum, count) => sum + count, 0), 0) !== original.num_adults + original.num_children) return false;
    const unitById = new Map(snapshot.units.map((unit) => [unit.id, unit]));
    const roomById = new Map(snapshot.room_types.map((room) => [room.id, room]));
    const normalizedCommitments = original.commitments.map((commitment) => ({
      ...commitment, room_type_id: normalizeUuid(commitment.room_type_id),
      unit_id: commitment.unit_id === null ? null : normalizeUuid(commitment.unit_id),
    }));
    const commitmentState = (commitment) => `${commitment.room_type_id}:${commitment.stay_date}:${commitment.unit_id || 'pooled'}:${commitment.units}:${commitment.status}`;
    const currentCommitmentStates = currentRows.flatMap((row) => row.active_commitments).map(commitmentState).sort();
    if (JSON.stringify(normalizedCommitments.map(commitmentState).sort()) !== JSON.stringify(currentCommitmentStates)) return false;
    return normalizedCommitments.every((commitment) => {
      if (!hasExactKeys(commitment, commitmentKeys)) return false;
      const roomId = commitment.room_type_id;
      const unitId = commitment.unit_id;
      const room = roomById.get(roomId);
      return Boolean(room) && isExactIsoDate(commitment.stay_date)
        && commitment.status === 'active' && isExactInteger(commitment.units, 1, 1000)
        && (room.inventory_mode === 'pooled'
          ? unitId === null
          : Boolean(unitId && unitById.get(unitId)?.room_type_id === roomId));
    });
  }

  function validateAvailabilityIntent(value, control = null, options = {}) {
    const intent = asObject(clone(value));
    const allowedActions = {
      daily_inventory: ['upsert', 'delete'],
      unit_calendar_block: ['create', 'update', 'disable'],
      operational_override: ['create', 'update', 'disable'],
      rate_rule_operational_restriction: ['update', 'clear'],
      booking_allocation: ['map', 'release'],
      hold: ['release'],
      operational_override_range: ['expand'],
    };
    if (!hasExactKeys(intent, ['entity', 'action', 'id', 'payload'])
        || !AVAILABILITY_CONTROL_DRAFT_ENTITIES.includes(intent.entity)
        || !allowedActions[intent.entity]?.includes(intent.action)
        || !availabilityIntentIdIsValid(intent.entity, intent.action, intent.id)
        || !availabilityPayloadIsValid(intent.entity, intent.action, intent.payload, control, options)
        || !availabilityTargetMatchesSnapshot(intent.entity, intent.action, intent.id, intent.payload,
          control ? (options.normalized === true ? control : normalizeAvailabilityControl(control)) : null)) {
      throw new Error('An Admin availability draft intent is invalid, foreign or contains unsupported fields.');
    }
    return intent;
  }

  function validateAvailabilityOperation(value, control = null, options = {}) {
    const operation = asObject(clone(value));
    if (!hasExactKeys(operation, ['entity', 'action', 'id', 'expected_version', 'expected_original', 'payload'])
        || !availabilityUuidFieldsAreCanonical(operation)
        || !AVAILABILITY_CONTROL_ENTITIES.includes(operation.entity)
        || !normalizeUuid(operation.id)
        || !isExactInteger(operation.expected_version, 0, Number.MAX_SAFE_INTEGER)
        || !operation.expected_original || typeof operation.expected_original !== 'object' || Array.isArray(operation.expected_original)) {
      throw new Error('A server-reviewed Admin availability operation is invalid or incomplete.');
    }
    const allowedActions = {
      daily_inventory: ['upsert', 'delete'],
      unit_calendar_block: ['create', 'update', 'disable'],
      operational_override: ['create', 'update', 'disable'],
      rate_rule_operational_restriction: ['update', 'clear'],
      booking_allocation: ['map', 'release'],
      hold: ['release'],
    };
    if (!allowedActions[operation.entity]?.includes(operation.action)
        || !availabilityPayloadIsValid(operation.entity, operation.action, operation.payload, control, options)
        || !availabilityTargetMatchesSnapshot(operation.entity, operation.action, operation.id, operation.payload,
          control ? (options.normalized === true ? control : normalizeAvailabilityControl(control)) : null)) {
      throw new Error('A server-reviewed Admin availability operation contains an unsupported action or payload.');
    }
    if (availabilityUtf8Bytes(operation.expected_original) > 256 * 1024
        || availabilityContainsForbiddenMutationKey(operation.expected_original)) {
      throw new Error('The reviewed availability original exposes forbidden or oversized state.');
    }
    const snapshot = control ? (options.normalized === true ? control : normalizeAvailabilityControl(control)) : null;
    if (snapshot && operation.entity === 'booking_allocation' && operation.action === 'release'
        && (operation.expected_version !== 0
          || !availabilityBookingReleaseOriginalIsValid(operation.expected_original, snapshot, normalizeUuid(operation.id)))) {
      throw new Error('The reviewed booking allocation release original is invalid or unrelated to the exact snapshot.');
    }
    return operation;
  }

  function validateAvailabilityDraft(value, control = null) {
    const draft = asObject(clone(value));
    const extendedBookingOnly = Array.isArray(draft.intents) && draft.intents.length > 0
      && draft.intents.every((intent) => ['booking_allocation', 'hold'].includes(asObject(intent).entity)
        && ['map', 'release'].includes(asObject(intent).action));
    if (!hasExactKeys(draft, ['contract_version', 'hotel_id', 'from', 'to', 'snapshot_token', 'intents'])
        || !availabilityUuidFieldsAreCanonical(draft)
        || draft.contract_version !== AVAILABILITY_CONTROL_DRAFT_CONTRACT || !normalizeUuid(draft.hotel_id)
        || !isExactIsoDate(draft.from) || !isExactIsoDate(draft.to) || draft.to < draft.from
        || availabilityDateRange(draft.from, draft.to).length > (extendedBookingOnly ? 365 : 62)
        || !/^[0-9a-f]{64}$/.test(asText(draft.snapshot_token)) || !Array.isArray(draft.intents)
        || !draft.intents.length || draft.intents.length > 100) {
      throw new Error('The Admin availability draft contract is invalid or empty.');
    }
    const snapshot = control ? normalizeAvailabilityControl(control) : null;
    if (snapshot && (draft.hotel_id !== snapshot.hotel_id || draft.from !== snapshot.from
        || draft.to !== snapshot.to || draft.snapshot_token !== snapshot.snapshot_token)) {
      throw new Error('The Admin availability draft does not bind the loaded exact-property snapshot.');
    }
    draft.intents = draft.intents.map((intent) => validateAvailabilityIntent(intent, snapshot, { normalized: true }));
    const identities = draft.intents.map(availabilityIntentTargetKey);
    if (new Set(identities).size !== identities.length || availabilityUtf8Bytes(draft) > 5 * 1024 * 1024) {
      throw new Error('The Admin availability draft contains duplicate targets or exceeds its technical limit.');
    }
    return draft;
  }

  function validateAvailabilityPlan(value, options = {}) {
    const plan = asObject(clone(value));
    const extendedBookingOnly = Array.isArray(plan.operations) && plan.operations.length > 0
      && plan.operations.every((operation) => ['booking_allocation', 'hold'].includes(asObject(operation).entity)
        && ['map', 'release'].includes(asObject(operation).action));
    if (!hasExactKeys(plan, ['contract_version', 'hotel_id', 'from', 'to', 'snapshot_token', 'reviewed_at', 'operations', 'plan_fingerprint'])
        || !availabilityUuidFieldsAreCanonical(plan)
        || plan.contract_version !== AVAILABILITY_CONTROL_PLAN_CONTRACT || !normalizeUuid(plan.hotel_id)
        || !isExactIsoDate(plan.from) || !isExactIsoDate(plan.to) || plan.to < plan.from
        || availabilityDateRange(plan.from, plan.to).length > (extendedBookingOnly ? 365 : 62)
        || !/^[0-9a-f]{64}$/.test(asText(plan.snapshot_token)) || !isExactIsoTimestamp(plan.reviewed_at)
        || !/^[0-9a-f]{64}$/.test(asText(plan.plan_fingerprint)) || !Array.isArray(plan.operations)
        || (options.allowEmpty !== true && !plan.operations.length) || plan.operations.length > 100) {
      throw new Error('The server-reviewed Admin availability plan contract is invalid.');
    }
    const snapshot = options.control ? (options.controlIsNormalized === true
      ? options.control : normalizeAvailabilityControl(options.control)) : null;
    plan.operations = plan.operations.map((operation) => validateAvailabilityOperation(operation, snapshot, { normalized: true }));
    const identities = plan.operations.map((operation) => `${operation.entity}:${operation.id}`);
    if (new Set(identities).size !== identities.length || availabilityUtf8Bytes(plan) > 10 * 1024 * 1024) {
      throw new Error('The reviewed availability plan contains duplicate targets or exceeds its technical limit.');
    }
    return plan;
  }

  function validateAvailabilityPlanPreview(value, draft) {
    const preview = asObject(clone(value));
    const reviewedDraft = validateAvailabilityDraft(draft);
    if (!hasExactKeys(preview, ['contract_version', 'hotel_id', 'changed', 'impacts', 'blocking_reasons', 'reviewed_plan', 'plan_fingerprint', 'current_control'])
        || !availabilityUuidFieldsAreCanonical(preview)
        || preview.contract_version !== AVAILABILITY_CONTROL_PREVIEW_CONTRACT
        || normalizeUuid(preview.hotel_id) !== reviewedDraft.hotel_id || typeof preview.changed !== 'boolean'
        || !Array.isArray(preview.impacts) || !Array.isArray(preview.blocking_reasons)
        || !preview.blocking_reasons.every((reason) => typeof reason === 'string' && reason.length)
        || !/^[0-9a-f]{64}$/.test(asText(preview.plan_fingerprint))) {
      throw new Error('The Admin availability plan preview contract is invalid.');
    }
    const currentControl = normalizeAvailabilityControl(preview.current_control);
    const reviewedPlan = validateAvailabilityPlan(preview.reviewed_plan, {
      allowEmpty: !preview.changed, control: currentControl, controlIsNormalized: true,
    });
    const impactKeys = ['entity', 'action', 'id', 'changed', 'affected_room_type_ids', 'affected_room_rate_ids', 'from', 'to'];
    const reviewedImpactTargets = reviewedPlan.operations.map((operation) => `${operation.entity}:${operation.action}:${normalizeUuid(operation.id)}`).sort();
    const returnedImpactTargets = preview.impacts.map((impact) => `${impact.entity}:${impact.action}:${normalizeUuid(impact.id)}`).sort();
    const impactScopeIsValid = (impact) => {
      const operation = reviewedPlan.operations.find((entry) => entry.entity === impact.entity
        && entry.action === impact.action && entry.id === normalizeUuid(impact.id));
      if (!operation) return false;
      const payload = asObject(operation.payload);
      const original = asObject(operation.expected_original);
      const exactIds = (actual, expected) => JSON.stringify([...actual].map(normalizeUuid).sort())
        === JSON.stringify([...new Set(expected.map(normalizeUuid))].sort());
      if (impact.entity === 'daily_inventory') {
        return impact.from === payload.stay_date && impact.to === payload.stay_date
          && exactIds(impact.affected_room_type_ids, [payload.room_type_id])
          && impact.affected_room_rate_ids.length === 0;
      }
      if (impact.entity === 'unit_calendar_block' && ['create', 'update'].includes(impact.action)) {
        return impact.from === payload.from_date && impact.to === payload.to_date
          && exactIds(impact.affected_room_type_ids, [payload.room_type_id])
          && impact.affected_room_rate_ids.length === 0;
      }
      if (impact.entity === 'unit_calendar_block' && impact.action === 'disable') {
        const unit = currentControl.units.find((entry) => entry.id === normalizeUuid(original.unit_id));
        return Boolean(unit) && impact.from === original.from_date && impact.to === original.to_date
          && exactIds(impact.affected_room_type_ids, [unit.room_type_id])
          && impact.affected_room_rate_ids.length === 0;
      }
      if (impact.entity === 'operational_override') {
        const rateId = normalizeUuid(payload.room_rate_id || original.room_rate_id);
        const stayDate = payload.stay_date || original.stay_date;
        const rate = currentControl.room_rates.find((entry) => entry.id === rateId);
        return Boolean(rate) && impact.from === stayDate && impact.to === stayDate
          && exactIds(impact.affected_room_type_ids, [rate.room_type_id])
          && exactIds(impact.affected_room_rate_ids, [rate.id]);
      }
      if (impact.entity === 'booking_allocation') {
        const bookingId = normalizeUuid(payload.booking_id);
        const release = impact.action === 'release';
        const allocations = release ? asArray(original.allocations) : asArray(payload.allocations);
        const blocker = release ? null : currentControl.unmapped_booking_blockers.find((entry) => entry.booking_id === bookingId);
        const bookingFrom = release ? original.arrival_date : blocker?.arrival_date;
        const departure = release ? original.departure_date : blocker?.departure_date;
        const bookingTo = bookingFrom && departure
          ? availabilityDateRange(bookingFrom, departure).slice(-2, -1)[0] : null;
        const commitmentDates = asArray(original.commitments).map((entry) => asObject(entry).stay_date)
          .filter(isExactIsoDate);
        const exactFrom = [bookingFrom, ...commitmentDates].filter(Boolean).sort()[0];
        const exactTo = [bookingTo, ...commitmentDates].filter(Boolean).sort().slice(-1)[0];
        return impact.from === exactFrom && impact.to === exactTo
          && exactIds(impact.affected_room_type_ids, allocations.map((entry) => asObject(entry).room_type_id))
          && exactIds(impact.affected_room_rate_ids, allocations.map((entry) => asObject(entry).room_rate_id));
      }
      if (impact.entity === 'hold') {
        const hold = currentControl.holds.find((entry) => entry.id === normalizeUuid(operation.id));
        const commitments = hold?.commitments.filter((entry) => entry.status === 'active') || [];
        const dates = commitments.map((entry) => entry.stay_date).sort();
        return dates.length > 0 && impact.from === dates[0] && impact.to === dates[dates.length - 1]
          && exactIds(impact.affected_room_type_ids, commitments.map((entry) => entry.room_type_id))
          && impact.affected_room_rate_ids.length === 0;
      }
      if (impact.entity !== 'rate_rule_operational_restriction') {
        return false;
      }
      const rate = currentControl.room_rates.find((entry) => entry.id === normalizeUuid(original.room_rate_id));
      return Boolean(rate) && impact.from === original.valid_from && impact.to === original.valid_to
        && exactIds(impact.affected_room_rate_ids, [rate.id])
        && exactIds(impact.affected_room_type_ids, [rate.room_type_id]);
    };
    if (preview.impacts.some((impact) => !hasExactKeys(impact, impactKeys)
        || !AVAILABILITY_CONTROL_ENTITIES.includes(impact.entity) || typeof impact.action !== 'string'
        || !normalizeUuid(impact.id) || typeof impact.changed !== 'boolean'
        || !Array.isArray(impact.affected_room_type_ids) || !impact.affected_room_type_ids.every((id) => currentControl.room_types.some((room) => room.id === normalizeUuid(id)))
        || !Array.isArray(impact.affected_room_rate_ids) || !impact.affected_room_rate_ids.every((id) => currentControl.room_rates.some((rate) => rate.id === normalizeUuid(id)))
        || new Set(impact.affected_room_type_ids).size !== impact.affected_room_type_ids.length
        || new Set(impact.affected_room_rate_ids).size !== impact.affected_room_rate_ids.length
        || !isExactIsoDate(impact.from) || !isExactIsoDate(impact.to) || impact.to < impact.from
        || !impactScopeIsValid(impact))
        || new Set(preview.impacts.map((impact) => `${impact.entity}:${impact.id}`)).size !== preview.impacts.length
        || currentControl.hotel_id !== reviewedDraft.hotel_id || currentControl.from !== reviewedDraft.from
        || currentControl.to !== reviewedDraft.to || currentControl.snapshot_token !== reviewedDraft.snapshot_token
        || reviewedPlan.hotel_id !== reviewedDraft.hotel_id || reviewedPlan.from !== reviewedDraft.from
        || reviewedPlan.to !== reviewedDraft.to || reviewedPlan.snapshot_token !== reviewedDraft.snapshot_token
        || reviewedPlan.plan_fingerprint !== preview.plan_fingerprint
        || JSON.stringify(returnedImpactTargets) !== JSON.stringify(reviewedImpactTargets)
        || (preview.changed !== (reviewedPlan.operations.length > 0))) {
      throw new Error('The Admin availability preview impact or reviewed-plan binding is inconsistent.');
    }
    return { ...preview, hotel_id: reviewedDraft.hotel_id, reviewed_plan: reviewedPlan, current_control: currentControl };
  }

  function validateAvailabilityApplyResult(value, plan, correlationId, idempotencyKey) {
    const source = asObject(clone(value));
    const reviewedPlan = validateAvailabilityPlan(plan);
    if (!hasExactKeys(source, ['contract_version', 'hotel_id', 'correlation_id', 'idempotency_key', 'replayed', 'changed', 'activity', 'availability_control'])
        || !availabilityUuidFieldsAreCanonical(source)
        || source.contract_version !== AVAILABILITY_CONTROL_APPLY_CONTRACT
        || normalizeUuid(source.hotel_id) !== reviewedPlan.hotel_id
        || normalizeUuid(source.correlation_id) !== normalizeUuid(correlationId)
        || source.idempotency_key !== idempotencyKey || typeof source.replayed !== 'boolean'
        || typeof source.changed !== 'boolean' || !Array.isArray(source.activity)) {
      throw new Error('The Admin availability apply result is invalid or unrelated to the reviewed Save.');
    }
    const availabilityControl = normalizeAvailabilityControl(source.availability_control);
    if (availabilityControl.hotel_id !== reviewedPlan.hotel_id) throw new Error('Saved availability returned a foreign property.');
    const activity = normalizeAvailabilityActivityRows(source.activity, { apply: true, maximum: 100 });
    const activityIds = new Set(availabilityControl.recent_activity.map((row) => row.id));
    const ledgerEntity = (entity) => entity === 'operational_override' ? 'calendar_override'
      : (entity === 'hold' ? 'inventory_hold' : entity);
    const ledgerAction = (operation) => ['create', 'map'].includes(operation.action) ? 'create'
      : (operation.action === 'upsert' && operation.expected_version === 0 ? 'create'
        : (operation.action === 'delete' ? 'delete'
          : (['disable', 'release', 'clear'].includes(operation.action) ? 'disable' : 'update')));
    const expectedActivityTargets = reviewedPlan.operations.map((operation) => (
      `${ledgerEntity(operation.entity)}:${normalizeUuid(operation.id)}:${ledgerAction(operation)}`)).sort();
    const actualActivityTargets = activity.map((row) => `${row.entity_type}:${row.entity_id}:${row.action}`).sort();
    if (source.changed !== true || activity.length !== reviewedPlan.operations.length
        || JSON.stringify(actualActivityTargets) !== JSON.stringify(expectedActivityTargets)
        || activity.some((row) => row.correlation_id !== normalizeUuid(correlationId) || !activityIds.has(row.id))) {
      throw new Error('Saved availability returned unverified activity rows.');
    }
    return { ...source, hotel_id: reviewedPlan.hotel_id, correlation_id: normalizeUuid(correlationId), activity, availability_control: availabilityControl };
  }

  function validateAvailabilityStayRequest(value) {
    const request = asObject(clone(value));
    const required = ['contract_version', 'hotel_id', 'arrival_date', 'departure_date', 'adults', 'child_ages', 'availability_snapshot_token'];
    const optional = ['room_type_id', 'room_rate_id', 'rate_plan_id', 'allocation_rule_id'];
    if (Object.keys(request).some((key) => ![...required, ...optional].includes(key))
        || !availabilityUuidFieldsAreCanonical(request)
        || required.some((key) => !Object.hasOwn(request, key))
        || request.contract_version !== AVAILABILITY_STAY_REQUEST_CONTRACT || !normalizeUuid(request.hotel_id)
        || !isExactIsoDate(request.arrival_date) || !isExactIsoDate(request.departure_date) || request.departure_date <= request.arrival_date
        || availabilityDateRange(request.arrival_date, request.departure_date).length - 1 > 365
        || !isExactInteger(request.adults, 1, 50) || !Array.isArray(request.child_ages)
        || !request.child_ages.every((age) => isExactInteger(age, CHILD_AGE_MIN, CHILD_AGE_MAX))
        || optional.some((key) => Object.hasOwn(request, key) && !(request[key] === null || normalizeUuid(request[key])))
        || !/^[0-9a-f]{64}$/.test(asText(request.availability_snapshot_token))) {
      throw new Error('The authoritative availability stay preview request is invalid.');
    }
    return request;
  }

  function validateAvailabilityStayPreview(value, request) {
    const source = asObject(clone(value));
    const reviewedRequest = validateAvailabilityStayRequest(request);
    if (!hasExactKeys(source, ['contract_version', 'hotel_id', 'pricing', 'availability', 'ok', 'requestable', 'blocking_reasons', 'configuration_fingerprint', 'public_change'])
        || !availabilityUuidFieldsAreCanonical(source)
        || source.contract_version !== AVAILABILITY_STAY_PREVIEW_CONTRACT || normalizeUuid(source.hotel_id) !== normalizeUuid(reviewedRequest.hotel_id)
        || !source.pricing || typeof source.pricing !== 'object' || Array.isArray(source.pricing)
        || !source.availability || typeof source.availability !== 'object' || Array.isArray(source.availability)
        || typeof source.ok !== 'boolean' || typeof source.requestable !== 'boolean'
        || !Array.isArray(source.blocking_reasons) || !source.blocking_reasons.length
        || !source.blocking_reasons.every((reason) => AVAILABILITY_STAY_BLOCKING_REASONS.includes(reason))
        || !source.blocking_reasons.includes('public_activation_off')
        || new Set(source.blocking_reasons).size !== source.blocking_reasons.length
        || !/^[0-9a-f]{64}$/.test(asText(source.configuration_fingerprint)) || source.public_change !== false
        || availabilityUtf8Bytes(source) > 5 * 1024 * 1024) {
      throw new Error('The authoritative availability stay preview response is invalid.');
    }
    const pricingRequest = validatePricingPreviewRequest({
      contract_version: PRICING_PREVIEW_CONTRACT,
      hotel_id: reviewedRequest.hotel_id,
      snapshot_token: source.pricing.snapshot_token,
      rate_plan_id: reviewedRequest.rate_plan_id || null,
      allocation_rule_id: reviewedRequest.allocation_rule_id || null,
      selected_room_type_id: reviewedRequest.room_type_id || null,
      check_in: reviewedRequest.arrival_date,
      check_out: reviewedRequest.departure_date,
      adults: reviewedRequest.adults,
      child_ages: reviewedRequest.child_ages,
    });
    const pricing = validatePricingPreview(source.pricing, pricingRequest);
    if (reviewedRequest.room_rate_id
        && pricing.products.some((product) => normalizeUuid(product.room_rate_id) !== normalizeUuid(reviewedRequest.room_rate_id))) {
      throw new Error('The authoritative stay preview returned an unrequested Room Rate product.');
    }
    const availability = source.availability;
    if (!hasExactKeys(availability, ['snapshot_token', 'rooms', 'requested_units', 'available_for_stay'])
        || availability.snapshot_token !== reviewedRequest.availability_snapshot_token
        || !Array.isArray(availability.rooms) || !isExactInteger(availability.requested_units, 0, 1000)
        || typeof availability.available_for_stay !== 'boolean') {
      throw new Error('The authoritative stay preview availability breakdown is invalid.');
    }
    const roomKeys = ['room_type_id', 'room_rate_id', 'rate_plan_id', 'unit_sequence', 'nights', 'departure_boundary_product', 'requestable', 'blocking_reasons'];
    const cellKeys = [
      'room_type_id', 'stay_date', 'inventory_mode', 'physical_capacity', 'configured_sellable_units',
      'blocked_unit_count', 'blocked_unit_ids', 'operational_closed', 'safety_closed', 'held_units',
      'booked_units', 'committed_units', 'available_units', 'requestable', 'blocking_reasons',
      'earliest_hold_expiry', 'provenance', 'inventory_version', 'product',
    ];
    const productKeys = ['room_type_id', 'room_rate_id', 'rate_plan_id', 'stay_date', 'operational_closed', 'closed_to_arrival', 'closed_to_departure', 'safety_closed', 'requestable', 'blocking_reasons', 'provenance'];
    const expectedDates = availabilityDateRange(reviewedRequest.arrival_date, reviewedRequest.departure_date).slice(0, -1);
    const productCounts = new Map();
    const roomDemand = new Map();
    pricing.products.forEach((product) => {
      const key = `${normalizeUuid(product.room_type_id)}:${normalizeUuid(product.room_rate_id)}:${normalizeUuid(product.rate_plan_id)}:${product.unit_sequence}`;
      productCounts.set(key, (productCounts.get(key) || 0) + 1);
      const roomId = normalizeUuid(product.room_type_id);
      roomDemand.set(roomId, (roomDemand.get(roomId) || 0) + 1);
    });
    const roomCounts = new Map();
    const invalidRoom = availability.rooms.some((room) => {
      if (!hasExactKeys(room, roomKeys) || !normalizeUuid(room.room_type_id) || !normalizeUuid(room.room_rate_id)
          || !normalizeUuid(room.rate_plan_id) || !isExactInteger(room.unit_sequence, 1, 1000) || !Array.isArray(room.nights)
          || room.requestable !== false || !Array.isArray(room.blocking_reasons)
          || !room.blocking_reasons.length || !room.blocking_reasons.every((reason) => AVAILABILITY_STAY_BLOCKING_REASONS.includes(reason))
          || !room.blocking_reasons.includes('public_activation_off')
          || new Set(room.blocking_reasons).size !== room.blocking_reasons.length) return true;
      const roomKey = `${normalizeUuid(room.room_type_id)}:${normalizeUuid(room.room_rate_id)}:${normalizeUuid(room.rate_plan_id)}:${room.unit_sequence}`;
      roomCounts.set(roomKey, (roomCounts.get(roomKey) || 0) + 1);
      const boundary = room.departure_boundary_product;
      if (!productCounts.has(roomKey) || room.nights.length !== expectedDates.length
          || !hasExactKeys(boundary, productKeys)
          || normalizeUuid(boundary.room_type_id) !== normalizeUuid(room.room_type_id)
          || normalizeUuid(boundary.room_rate_id) !== normalizeUuid(room.room_rate_id)
          || normalizeUuid(boundary.rate_plan_id) !== normalizeUuid(room.rate_plan_id)
          || boundary.stay_date !== reviewedRequest.departure_date
          || !['operational_closed', 'closed_to_arrival', 'closed_to_departure', 'safety_closed'].every((key) => typeof boundary[key] === 'boolean')
          || boundary.requestable !== false || !Array.isArray(boundary.blocking_reasons)
          || !boundary.blocking_reasons.includes('public_activation_off')
          || !boundary.blocking_reasons.every((reason) => AVAILABILITY_BLOCKING_REASONS.includes(reason))
          || new Set(boundary.blocking_reasons).size !== boundary.blocking_reasons.length
          || !hasExactKeys(boundary.provenance, ['exact_override_id', 'daily_rate', 'availability_version'])
          || !(boundary.provenance.exact_override_id === null || normalizeUuid(boundary.provenance.exact_override_id))
          || typeof boundary.provenance.daily_rate !== 'boolean'
          || !(boundary.provenance.availability_version === null || isExactInteger(boundary.provenance.availability_version, 1))) return true;
      return room.nights.some((night, index) => {
        if (!hasExactKeys(night, cellKeys) || normalizeUuid(night.room_type_id) !== normalizeUuid(room.room_type_id)
            || night.stay_date !== expectedDates[index] || !INVENTORY_MODES.includes(night.inventory_mode)
            || !['physical_capacity', 'configured_sellable_units', 'blocked_unit_count', 'held_units', 'booked_units', 'committed_units', 'available_units']
              .every((key) => isExactInteger(night[key], 0, 1000000))
            || !Array.isArray(night.blocked_unit_ids) || !night.blocked_unit_ids.every(normalizeUuid)
            || new Set(night.blocked_unit_ids).size !== night.blocked_unit_ids.length
            || night.blocked_unit_count !== night.blocked_unit_ids.length
            || typeof night.operational_closed !== 'boolean' || typeof night.safety_closed !== 'boolean'
            || night.requestable !== false || !Array.isArray(night.blocking_reasons)
            || !night.blocking_reasons.length || !night.blocking_reasons.every((reason) => AVAILABILITY_BLOCKING_REASONS.includes(reason))
            || !night.blocking_reasons.includes('public_activation_off')
            || night.committed_units !== night.held_units + night.booked_units
            || night.available_units !== (night.operational_closed || night.safety_closed ? 0 : Math.max(0,
              Math.min(night.physical_capacity - night.blocked_unit_count, night.configured_sellable_units) - night.committed_units))
            || !(night.earliest_hold_expiry === null || isExactIsoTimestamp(night.earliest_hold_expiry))
            || !isExactInteger(night.inventory_version, 0)
            || !hasExactKeys(night.provenance, ['capacity', 'inventory', 'commitments'])
            || night.provenance.capacity !== 'room_type_or_active_units'
            || night.provenance.inventory !== 'hotel_daily_inventory'
            || night.provenance.commitments !== 'server_authoritative'
            || !hasExactKeys(night.product, productKeys)
            || normalizeUuid(night.product.room_type_id) !== normalizeUuid(room.room_type_id)
            || normalizeUuid(night.product.room_rate_id) !== normalizeUuid(room.room_rate_id)
            || normalizeUuid(night.product.rate_plan_id) !== normalizeUuid(room.rate_plan_id)
            || night.product.stay_date !== night.stay_date
            || !['operational_closed', 'closed_to_arrival', 'closed_to_departure', 'safety_closed'].every((key) => typeof night.product[key] === 'boolean')
            || night.product.requestable !== false || !Array.isArray(night.product.blocking_reasons)
            || !night.product.blocking_reasons.includes('public_activation_off')
            || !night.product.blocking_reasons.every((reason) => AVAILABILITY_BLOCKING_REASONS.includes(reason))
            || new Set(night.product.blocking_reasons).size !== night.product.blocking_reasons.length
            || !hasExactKeys(night.product.provenance, ['exact_override_id', 'daily_rate', 'availability_version'])
            || !(night.product.provenance.exact_override_id === null || normalizeUuid(night.product.provenance.exact_override_id))
            || typeof night.product.provenance.daily_rate !== 'boolean'
            || !(night.product.provenance.availability_version === null || isExactInteger(night.product.provenance.availability_version, 1))) return true;
        return false;
      });
    });
    const exactProducts = productCounts.size === roomCounts.size
      && [...productCounts].every(([key, count]) => roomCounts.get(key) === count);
    const minimumAvailable = availability.rooms.length > 0 && availability.rooms.every((room) => room.nights.every((night, index) => (
      night.available_units >= roomDemand.get(normalizeUuid(room.room_type_id))
      && !night.operational_closed && !night.safety_closed
      && !night.product.operational_closed && !night.product.safety_closed
      && (index !== 0 || !night.product.closed_to_arrival)))
      && !room.departure_boundary_product.closed_to_departure
      && !room.departure_boundary_product.operational_closed
      && !room.departure_boundary_product.safety_closed);
    if (invalidRoom || !exactProducts || availability.requested_units !== pricing.products.length
        || availability.rooms.length !== availability.requested_units
        || (availability.requested_units === 0 && (pricing.ok || pricing.products.length || availability.rooms.length
          || availability.available_for_stay || !source.blocking_reasons.includes('pricing_configuration_blocked')))
        || (availability.available_for_stay && !minimumAvailable)
        || (!availability.available_for_stay && !source.blocking_reasons.some((reason) => reason !== 'public_activation_off'))
        || source.ok !== (pricing.ok && availability.available_for_stay)
        || source.requestable !== false) {
      throw new Error('The authoritative stay preview is internally inconsistent.');
    }
    return { ...source, pricing };
  }

  function buildAvailabilityDraft(control, intents) {
    const snapshot = normalizeAvailabilityControl(control);
    return validateAvailabilityDraft({
      contract_version: AVAILABILITY_CONTROL_DRAFT_CONTRACT,
      hotel_id: snapshot.hotel_id,
      from: snapshot.from,
      to: snapshot.to,
      snapshot_token: snapshot.snapshot_token,
      intents: clone(intents),
    }, snapshot);
  }

  function buildHoldReleaseIntent(control, holdId, reason) {
    const snapshot = normalizeAvailabilityControl(control);
    const id = normalizeUuid(holdId);
    const hold = snapshot.holds.find((row) => row.id === id);
    if (!hold || hold.status !== 'active' || Date.parse(hold.expires_at) <= Date.parse(snapshot.snapshot_as_of)) {
      throw new Error('Only a current active hold can be released.');
    }
    return validateAvailabilityIntent({ entity: 'hold', action: 'release', id, payload: { reason: asText(reason) } }, snapshot, { normalized: true });
  }

  function externalCalendarExactUuid(value, label, nullable = false) {
    if (nullable && value === null) return null;
    if (typeof value !== 'string' || normalizeUuid(value) !== value) {
      throw new Error(`${label} must be an exact lowercase canonical UUID.`);
    }
    return value;
  }

  function externalCalendarExactText(value, label, options = {}) {
    if (options.nullable && value === null) return null;
    const minimum = options.minimum ?? 0;
    const maximum = options.maximum ?? 500;
    if (typeof value !== 'string' || value !== value.trim() || value.length < minimum
        || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) {
      throw new Error(`${label} is invalid.`);
    }
    return value;
  }

  function externalCalendarCanonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(externalCalendarCanonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${externalCalendarCanonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function externalCalendarHttpsUrl(value) {
    if (typeof value !== 'string' || value.length < 12 || value.length > 4096
        || value !== value.trim() || /[\s\u0000-\u001f\u007f]/u.test(value)) return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && Boolean(parsed.hostname)
        && !parsed.username && !parsed.password;
    } catch (_error) { return false; }
  }

  function externalCalendarContainsPrivateField(value) {
    if (Array.isArray(value)) return value.some(externalCalendarContainsPrivateField);
    if (!value || typeof value !== 'object') return false;
    const forbidden = new Set(['ical_url', 'external_reference', 'configuration', 'config', 'vault_secret_id', 'request_hash']);
    return Object.entries(value).some(([key, nested]) => forbidden.has(key) || externalCalendarContainsPrivateField(nested));
  }

  function normalizeExternalCalendarHealth(value) {
    const row = asObject(clone(value));
    const keys = [
      'status', 'last_attempt_at', 'last_success_at', 'last_failure_at', 'next_retry_at',
      'consecutive_failures', 'last_event_count', 'last_active_event_count',
      'last_block_count', 'last_error_code', 'last_error_message', 'state_version',
    ];
    const nullableTimestamps = ['last_attempt_at', 'last_success_at', 'last_failure_at', 'next_retry_at'];
    if (!hasExactKeys(row, keys)
        || !['never_synced', 'healthy', 'degraded', 'syncing'].includes(row.status)
        || nullableTimestamps.some((key) => row[key] !== null && !isExactIsoTimestamp(row[key]))
        || !isExactInteger(row.consecutive_failures, 0, 1000000)
        || !isExactInteger(row.last_event_count, 0, 1000000)
        || !isExactInteger(row.last_active_event_count, 0, 1000000)
        || !isExactInteger(row.last_block_count, 0, 1000000)
        || !isExactInteger(row.state_version, 0)
        || !(row.last_error_code === null || (typeof row.last_error_code === 'string'
          && /^[a-z0-9][a-z0-9_.:-]{0,119}$/i.test(row.last_error_code)))
        || !(row.last_error_message === null || (typeof row.last_error_message === 'string'
          && row.last_error_message === row.last_error_message.trim()
          && row.last_error_message.length <= 500
          && !/https?:\/\//i.test(row.last_error_message)
          && !/[\u0000-\u001f\u007f-\u009f]/u.test(row.last_error_message)))) {
      throw new Error('External calendar health is not a sanitized exact projection.');
    }
    return row;
  }

  function normalizeExternalCalendarControl(value, expected = {}) {
    const source = asObject(clone(value));
    const keys = [
      'contract_version', 'hotel_id', 'partner_id', 'assignment_id', 'permission_version',
      'access_snapshot_token', 'snapshot_token', 'hotel_external_sync_enabled', 'rooms',
      'sources', 'public_change',
    ];
    if (!hasExactKeys(source, keys) || source.contract_version !== EXTERNAL_CALENDAR_CONTROL_CONTRACT
        || source.public_change !== false || typeof source.hotel_external_sync_enabled !== 'boolean'
        || !Array.isArray(source.rooms) || source.rooms.length > 1000
        || !Array.isArray(source.sources) || source.sources.length > 5000
        || !isExactSnapshotToken(source.snapshot_token)) {
      throw new Error('External calendar control returned an unsupported field envelope.');
    }
    const hotelId = externalCalendarExactUuid(source.hotel_id, 'external_calendar.hotel_id');
    const partnerMode = source.partner_id !== null;
    const partnerId = externalCalendarExactUuid(source.partner_id, 'external_calendar.partner_id', true);
    const assignmentId = externalCalendarExactUuid(source.assignment_id, 'external_calendar.assignment_id', true);
    const permissionVersion = source.permission_version;
    const accessToken = source.access_snapshot_token;
    if (partnerMode !== (assignmentId !== null) || partnerMode !== (permissionVersion !== null)
        || partnerMode !== (accessToken !== null)
        || (partnerMode && (!isExactInteger(permissionVersion, 1) || !isExactSnapshotToken(accessToken)))
        || (!partnerMode && (assignmentId !== null || permissionVersion !== null || accessToken !== null))
        || (expected.actorType === 'admin' && partnerMode)
        || (expected.actorType === 'partner' && !partnerMode)
        || (expected.hotelId && expected.hotelId !== hotelId)
        || (expected.partnerId && expected.partnerId !== partnerId)
        || (expected.assignmentId && expected.assignmentId !== assignmentId)
        || (expected.permissionVersion && expected.permissionVersion !== permissionVersion)
        || (expected.accessSnapshotToken && expected.accessSnapshotToken !== accessToken)) {
      throw new Error('External calendar control identity or exact Partner access binding is invalid.');
    }
    const rooms = source.rooms.map((room) => {
      if (!hasExactKeys(room, ['id', 'name_i18n', 'status', 'version'])
          || !isExactAvailabilityI18n(room.name_i18n, { required: true })
          || !ROOM_STATUSES.includes(room.status) || !isExactInteger(room.version, 1)) {
        throw new Error('External calendar control returned an invalid Room projection.');
      }
      return { ...clone(room), id: externalCalendarExactUuid(room.id, 'external_calendar.room.id') };
    });
    const roomIds = new Set(rooms.map((room) => room.id));
    if (roomIds.size !== rooms.length) throw new Error('External calendar control returned duplicate Rooms.');
    const sources = source.sources.map((row) => {
      const sourceKeys = [
        'id', 'hotel_id', 'room_type_id', 'code', 'source_type', 'is_enabled',
        'review_status', 'priority', 'version', 'updated_at', 'secret_configured',
        'binding_version', 'sync_interval_minutes', 'units_per_event', 'health',
      ];
      if (!hasExactKeys(row, sourceKeys)) throw new Error('External calendar source contains unsupported or private fields.');
      const normalized = {
        ...clone(row),
        id: externalCalendarExactUuid(row.id, 'external_calendar.source.id'),
        hotel_id: externalCalendarExactUuid(row.hotel_id, 'external_calendar.source.hotel_id'),
        room_type_id: externalCalendarExactUuid(row.room_type_id, 'external_calendar.source.room_type_id'),
        health: normalizeExternalCalendarHealth(row.health),
      };
      if (normalized.hotel_id !== hotelId || !roomIds.has(normalized.room_type_id)
          || !EXTERNAL_CALENDAR_SOURCE_TYPES.includes(normalized.source_type)
          || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(normalized.code)
          || typeof normalized.is_enabled !== 'boolean'
          || (normalized.is_enabled && !source.hotel_external_sync_enabled)
          || !H3_REVIEW_STATUSES.includes(normalized.review_status)
          || !isExactInteger(normalized.priority, -32768, 32767)
          || !isExactInteger(normalized.version, 1)
          || !isExactIsoTimestamp(normalized.updated_at)
          || typeof normalized.secret_configured !== 'boolean'
          || !(normalized.binding_version === null || isExactInteger(normalized.binding_version, 1))
          || (normalized.secret_configured !== (normalized.binding_version !== null))
          || !isExactInteger(normalized.sync_interval_minutes, 15, 1440)
          || !isExactInteger(normalized.units_per_event, 1, 100)) {
        throw new Error('External calendar source is invalid, foreign, or inconsistent with activation state.');
      }
      return normalized;
    });
    if (new Set(sources.map((row) => row.id)).size !== sources.length
        || new Set(sources.map((row) => row.code)).size !== sources.length) {
      throw new Error('External calendar control returned duplicate source identities.');
    }
    return Object.freeze({
      ...source, hotel_id: hotelId, partner_id: partnerId, assignment_id: assignmentId,
      permission_version: permissionVersion, rooms, sources,
    });
  }

  function validateExternalCalendarIntent(intentValue, controlValue) {
    const control = normalizeExternalCalendarControl(controlValue);
    const intent = asObject(clone(intentValue));
    if (!hasExactKeys(intent, ['entity', 'action', 'id', 'expected_version', 'payload', 'reason'])
        || !['calendar_source', 'ical_secret', 'calendar_sync'].includes(intent.entity)
        || !isExactInteger(intent.expected_version, 0)
        || !hasExactKeys(asObject(intent.payload), Object.keys(asObject(intent.payload)))) {
      throw new Error('External calendar intent contains unsupported fields.');
    }
    externalCalendarExactText(intent.reason, 'external_calendar.reason', { minimum: 3, maximum: 500 });
    const sourceId = intent.entity === 'calendar_source' ? intent.id : intent.payload.source_id;
    const source = sourceId === null ? null : control.sources.find((row) => row.id === sourceId);
    if (intent.entity === 'calendar_source' && ['create', 'update'].includes(intent.action)) {
      if (!hasExactKeys(intent.payload, ['room_type_id', 'code', 'source_type', 'sync_interval_minutes', 'units_per_event', 'priority'])
          || !control.rooms.some((room) => room.id === intent.payload.room_type_id && room.status === 'active')
          || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(intent.payload.code)
          || !EXTERNAL_CALENDAR_SOURCE_TYPES.includes(intent.payload.source_type)
          || !isExactInteger(intent.payload.sync_interval_minutes, 15, 1440)
          || !isExactInteger(intent.payload.units_per_event, 1, 100)
          || !isExactInteger(intent.payload.priority, -32768, 32767)
          || (intent.action === 'create' && (intent.id !== null || intent.expected_version !== 0))
          || (intent.action === 'update' && (!source || intent.id !== source.id || intent.expected_version !== source.version))) {
        throw new Error('External calendar source draft is invalid or stale.');
      }
    } else if (intent.entity === 'calendar_source' && ['enable', 'disable'].includes(intent.action)) {
      if (!hasExactKeys(intent.payload, []) || !source || intent.id !== source.id
          || intent.expected_version !== source.version
          || (intent.action === 'enable' && !control.hotel_external_sync_enabled)) {
        throw new Error(intent.action === 'enable'
          ? 'External calendars are not activated for this Hotel.'
          : 'External calendar lifecycle draft is invalid or stale.');
      }
    } else if (intent.entity === 'ical_secret' && ['set', 'rotate'].includes(intent.action)) {
      if (!hasExactKeys(intent.payload, ['source_id', 'ical_url']) || !source
          || intent.id !== source.id || intent.expected_version !== (source.binding_version || 0)
          || !externalCalendarHttpsUrl(intent.payload.ical_url) || source.is_enabled
          || (intent.action === 'set' && source.secret_configured)
          || (intent.action === 'rotate' && !source.secret_configured)) {
        throw new Error('External calendar secret draft is invalid, stale, or uses an unsafe URL.');
      }
    } else if (intent.entity === 'ical_secret' && intent.action === 'clear') {
      if (!hasExactKeys(intent.payload, ['source_id']) || !source || intent.id !== source.id
          || intent.expected_version !== source.binding_version || !source.secret_configured
          || source.is_enabled || source.binding_version < 1) {
        throw new Error('External calendar secret clear requires an exact disabled configured source.');
      }
    } else if (intent.entity === 'calendar_sync' && intent.action === 'trigger') {
      if (!hasExactKeys(intent.payload, ['source_id']) || !source || intent.id !== source.id
          || intent.expected_version !== source.health.state_version || !source.is_enabled
          || !control.hotel_external_sync_enabled) {
        throw new Error('External calendar manual-sync draft is invalid or stale.');
      }
    } else {
      throw new Error('External calendar action is unsupported.');
    }
    return intent;
  }

  function buildExternalCalendarDraft(controlValue, intentValue) {
    const control = normalizeExternalCalendarControl(controlValue);
    const intent = validateExternalCalendarIntent(intentValue, control);
    return Object.freeze({
      contract_version: EXTERNAL_CALENDAR_DRAFT_CONTRACT,
      hotel_id: control.hotel_id,
      partner_id: control.partner_id,
      assignment_id: control.assignment_id,
      permission_version: control.permission_version,
      access_snapshot_token: control.access_snapshot_token,
      snapshot_token: control.snapshot_token,
      intent,
    });
  }

  function validateExternalCalendarDraft(value, controlValue) {
    const control = normalizeExternalCalendarControl(controlValue);
    const draft = asObject(clone(value));
    const keys = ['contract_version', 'hotel_id', 'partner_id', 'assignment_id', 'permission_version', 'access_snapshot_token', 'snapshot_token', 'intent'];
    if (!hasExactKeys(draft, keys) || draft.contract_version !== EXTERNAL_CALENDAR_DRAFT_CONTRACT
        || draft.hotel_id !== control.hotel_id || draft.partner_id !== control.partner_id
        || draft.assignment_id !== control.assignment_id || draft.permission_version !== control.permission_version
        || draft.access_snapshot_token !== control.access_snapshot_token || draft.snapshot_token !== control.snapshot_token) {
      throw new Error('External calendar draft is not bound to the exact loaded control snapshot.');
    }
    draft.intent = validateExternalCalendarIntent(draft.intent, control);
    return Object.freeze(draft);
  }

  function externalCalendarExpectedOriginal(draft, control) {
    if (draft.intent.entity === 'calendar_source' && draft.intent.action === 'create') return null;
    const source = control.sources.find((row) => row.id === draft.intent.id);
    if (!source) throw new Error('External calendar Review source is absent from the exact control snapshot.');
    if (draft.intent.entity === 'ical_secret') {
      return { secret_configured: source.secret_configured, binding_version: source.binding_version };
    }
    return clone(source);
  }

  function externalCalendarExpectedImpact(draft, control) {
    const source = draft.intent.action === 'create'
      ? null
      : control.sources.find((row) => row.id === draft.intent.id);
    if (draft.intent.entity === 'calendar_source' && ['create', 'update'].includes(draft.intent.action)) {
      const fields = ['code', 'priority', 'room_type_id', 'source_type', 'sync_interval_minutes', 'units_per_event'];
      return {
        fields,
        before: source ? Object.fromEntries(fields.map((field) => [field, source[field]])) : null,
        after: Object.fromEntries(fields.map((field) => [field, draft.intent.payload[field]])),
        affectedRoomTypeIds: [...new Set([
          source?.room_type_id,
          draft.intent.payload.room_type_id,
        ].filter(Boolean))].sort(),
      };
    }
    if (!source) throw new Error('External calendar impact source is absent from the exact control snapshot.');
    if (draft.intent.entity === 'calendar_source') {
      return {
        fields: ['is_enabled'], before: { is_enabled: source.is_enabled },
        after: { is_enabled: draft.intent.action === 'enable' }, affectedRoomTypeIds: [source.room_type_id],
      };
    }
    if (draft.intent.entity === 'ical_secret') {
      return {
        fields: ['secret_configured'], before: { secret_configured: source.secret_configured },
        after: { secret_configured: draft.intent.action !== 'clear' }, affectedRoomTypeIds: [source.room_type_id],
      };
    }
    return {
      fields: ['queued'], before: { queued: false }, after: { queued: true },
      affectedRoomTypeIds: [source.room_type_id],
    };
  }

  function validateExternalCalendarOperation(value, draft, control) {
    const operation = asObject(clone(value));
    const expectedOriginal = externalCalendarExpectedOriginal(draft, control);
    if (!hasExactKeys(operation, ['entity', 'action', 'id', 'expected_version', 'expected_original', 'payload', 'reason'])
        || operation.entity !== draft.intent.entity || operation.action !== draft.intent.action
        || (draft.intent.action === 'create'
          ? !externalCalendarExactUuid(operation.id, 'external_calendar.operation.id')
          : operation.id !== draft.intent.id)
        || operation.expected_version !== draft.intent.expected_version
        || operation.reason !== draft.intent.reason
        || externalCalendarCanonicalJson(operation.expected_original) !== externalCalendarCanonicalJson(expectedOriginal)) {
      throw new Error('External calendar server operation differs from the explicit Review.');
    }
    if (operation.entity === 'ical_secret' && ['set', 'rotate'].includes(operation.action)) {
      if (!hasExactKeys(operation.payload, ['source_id', 'url_fingerprint', 'secret_configured'])
          || operation.payload.source_id !== draft.intent.payload.source_id
          || !isExactSnapshotToken(operation.payload.url_fingerprint)
          || operation.payload.secret_configured !== true || Object.hasOwn(operation.payload, 'ical_url')) {
        throw new Error('External calendar secret Review did not redact and fingerprint the URL.');
      }
    } else if (operation.entity === 'ical_secret' && operation.action === 'clear') {
      if (!hasExactKeys(operation.payload, ['source_id', 'secret_configured'])
          || operation.payload.source_id !== draft.intent.payload.source_id
          || operation.payload.secret_configured !== false) {
        throw new Error('External calendar secret clear Review is not bound to the exact private binding version.');
      }
    } else if (externalCalendarCanonicalJson(operation.payload) !== externalCalendarCanonicalJson(draft.intent.payload)) {
      throw new Error('External calendar server operation payload differs from the explicit Review.');
    }
    return operation;
  }

  function validateExternalCalendarPreview(value, draftValue, controlValue) {
    const control = normalizeExternalCalendarControl(controlValue);
    const draft = validateExternalCalendarDraft(draftValue, control);
    const preview = asObject(clone(value));
    const keys = ['contract_version', 'hotel_id', 'partner_id', 'changed', 'blocking_reasons', 'impacts', 'reviewed_plan'];
    if (!hasExactKeys(preview, keys) || externalCalendarContainsPrivateField(preview)
        || preview.contract_version !== EXTERNAL_CALENDAR_PREVIEW_CONTRACT
        || preview.hotel_id !== draft.hotel_id || preview.partner_id !== draft.partner_id
        || typeof preview.changed !== 'boolean' || !Array.isArray(preview.blocking_reasons)
        || preview.blocking_reasons.length > 100 || preview.blocking_reasons.some((reason) => (
          typeof reason !== 'string' || !/^[a-z][a-z0-9_]{1,119}$/.test(reason)))
        || new Set(preview.blocking_reasons).size !== preview.blocking_reasons.length
        || !Array.isArray(preview.impacts) || preview.impacts.length > 10) {
      throw new Error('External calendar preview contract is invalid.');
    }
    const impacts = preview.impacts.map((impact) => {
      const impactKeys = ['entity', 'action', 'id', 'changed', 'fields', 'before', 'after', 'affected_room_type_ids', 'from', 'to'];
      const expectedImpact = externalCalendarExpectedImpact(draft, control);
      if (!hasExactKeys(impact, impactKeys) || impact.entity !== draft.intent.entity
          || impact.action !== draft.intent.action
          || (draft.intent.action === 'create'
            ? !externalCalendarExactUuid(impact.id, 'external_calendar.impact.id')
          : impact.id !== draft.intent.id)
          || typeof impact.changed !== 'boolean' || !Array.isArray(impact.fields)
          || externalCalendarCanonicalJson(impact.fields) !== externalCalendarCanonicalJson(expectedImpact.fields)
          || externalCalendarCanonicalJson(impact.before) !== externalCalendarCanonicalJson(expectedImpact.before)
          || externalCalendarCanonicalJson(impact.after) !== externalCalendarCanonicalJson(expectedImpact.after)
          || !Array.isArray(impact.affected_room_type_ids)
          || externalCalendarCanonicalJson(impact.affected_room_type_ids)
            !== externalCalendarCanonicalJson(expectedImpact.affectedRoomTypeIds)
          || impact.from !== null || impact.to !== null) {
        throw new Error('External calendar preview impact is invalid or foreign.');
      }
      return clone(impact);
    });
    if (preview.reviewed_plan === null) {
      if (preview.changed || impacts.length || impacts.some((impact) => impact.changed)) throw new Error('Changed external calendar Review omitted its exact plan.');
      return Object.freeze({ ...preview, impacts });
    }
    const plan = asObject(clone(preview.reviewed_plan));
    const planKeys = [
      'contract_version', 'review_id', 'actor_type', 'partner_id', 'hotel_id',
      'assignment_id', 'permission_version', 'access_snapshot_token', 'snapshot_token',
      'reviewed_at', 'expires_at', 'operations', 'plan_fingerprint',
    ];
    if (!hasExactKeys(plan, planKeys) || plan.contract_version !== EXTERNAL_CALENDAR_PLAN_CONTRACT
        || !externalCalendarExactUuid(plan.review_id, 'external_calendar.review_id')
        || !['admin', 'partner'].includes(plan.actor_type)
        || plan.hotel_id !== draft.hotel_id || plan.partner_id !== draft.partner_id
        || plan.assignment_id !== draft.assignment_id || plan.permission_version !== draft.permission_version
        || plan.access_snapshot_token !== draft.access_snapshot_token || plan.snapshot_token !== draft.snapshot_token
        || !isExactIsoTimestamp(plan.reviewed_at) || !isExactIsoTimestamp(plan.expires_at)
        || Date.parse(plan.expires_at) <= Date.parse(plan.reviewed_at)
        || !isExactSnapshotToken(plan.plan_fingerprint) || !Array.isArray(plan.operations)
        || plan.operations.length !== 1
        || (plan.actor_type === 'admin') !== (plan.partner_id === null)) {
      throw new Error('External calendar reviewed plan identity or expiry is invalid.');
    }
    plan.operations = [validateExternalCalendarOperation(plan.operations[0], draft, control)];
    if (draft.intent.action === 'create' && impacts.some((impact) => impact.id !== plan.operations[0].id)) {
      throw new Error('External calendar create impact and reviewed operation use different exact IDs.');
    }
    if (!preview.changed || impacts.length !== 1 || !impacts[0].changed
        || preview.changed !== impacts.some((impact) => impact.changed)) {
      throw new Error('External calendar preview change flag is inconsistent with its exact impact.');
    }
    return Object.freeze({ ...preview, impacts, reviewed_plan: Object.freeze(plan) });
  }

  function validateExternalCalendarApplyResult(value, expected = {}) {
    const result = asObject(clone(value));
    const keys = ['contract_version', 'hotel_id', 'partner_id', 'correlation_id', 'idempotency_key', 'replayed', 'changed', 'activity', 'control'];
    if (!hasExactKeys(result, keys) || result.contract_version !== EXTERNAL_CALENDAR_APPLY_CONTRACT
        || result.hotel_id !== expected.plan?.hotel_id || result.partner_id !== expected.plan?.partner_id
        || result.correlation_id !== expected.correlationId || result.idempotency_key !== expected.idempotencyKey
        || typeof result.replayed !== 'boolean' || typeof result.changed !== 'boolean'
        || !Array.isArray(result.activity) || result.activity.length > 10) {
      throw new Error('External calendar Save receipt is invalid or belongs to another Review.');
    }
    const activityKeys = ['id', 'hotel_id', 'entity_type', 'entity_id', 'action', 'actor_type', 'source', 'correlation_id', 'created_at'];
    const activity = result.activity.map((row) => {
      if (!hasExactKeys(row, activityKeys)
          || externalCalendarExactUuid(row.id, 'external_calendar.activity.id') !== row.id
          || row.hotel_id !== result.hotel_id
          || row.entity_type !== 'calendar_source'
          || !externalCalendarExactUuid(row.entity_id, 'external_calendar.activity.entity_id')
          || !['create', 'update', 'disable'].includes(row.action)
          || row.actor_type !== expected.plan?.actor_type
          || row.source !== 'hotels_v2_external_calendar_control'
          || row.correlation_id !== expected.correlationId
          || !isExactIsoTimestamp(row.created_at)) {
        throw new Error('External calendar Save activity is invalid or not bound to this Review.');
      }
      return clone(row);
    });
    const operation = expected.plan?.operations?.[0];
    const ledgerAction = operation?.action === 'create' ? 'create' : operation?.action === 'disable' ? 'disable' : 'update';
    if ((result.changed && activity.length !== 1) || (!result.changed && activity.length !== 0)
        || (result.changed && (activity[0].entity_id !== operation?.id || activity[0].action !== ledgerAction))) {
      throw new Error('External calendar Save activity cardinality is inconsistent.');
    }
    const control = normalizeExternalCalendarControl(result.control, {
      actorType: expected.plan?.actor_type,
      hotelId: expected.plan?.hotel_id,
      partnerId: expected.plan?.partner_id || undefined,
      assignmentId: expected.plan?.assignment_id || undefined,
      permissionVersion: expected.plan?.permission_version || undefined,
      accessSnapshotToken: expected.plan?.access_snapshot_token || undefined,
    });
    const savedSource = control.sources.find((row) => row.id === operation?.id);
    if (!savedSource) throw new Error('External calendar Save control omitted the exact reviewed source.');
    if (operation.entity === 'calendar_source' && operation.action === 'create'
        && (savedSource.version !== 1 || savedSource.is_enabled !== false)) {
      throw new Error('External calendar Save did not confirm the exact reviewed source create.');
    }
    if (operation.entity === 'calendar_source' && operation.action !== 'create'
        && savedSource.version !== operation.expected_version + 1) {
      throw new Error('External calendar Save did not confirm the exact reviewed source version.');
    }
    if (operation.entity === 'calendar_source' && ['create', 'update'].includes(operation.action)) {
      const savedBusinessState = {
        room_type_id: savedSource.room_type_id, code: savedSource.code,
        source_type: savedSource.source_type,
        sync_interval_minutes: savedSource.sync_interval_minutes,
        units_per_event: savedSource.units_per_event, priority: savedSource.priority,
      };
      if (externalCalendarCanonicalJson(savedBusinessState) !== externalCalendarCanonicalJson(operation.payload)) {
        throw new Error('External calendar Save did not confirm the exact reviewed source fields.');
      }
    }
    if (operation.entity === 'calendar_source' && ['enable', 'disable'].includes(operation.action)
        && savedSource.is_enabled !== (operation.action === 'enable')) {
      throw new Error('External calendar Save did not confirm the reviewed source lifecycle.');
    }
    if (operation.entity === 'ical_secret') {
      const cleared = operation.action === 'clear';
      if (savedSource.secret_configured !== !cleared
          || savedSource.binding_version !== (cleared ? null : operation.expected_version + 1)) {
        throw new Error('External calendar Save did not confirm the exact private binding version.');
      }
    }
    return Object.freeze({ ...result, activity, control });
  }

  return Object.freeze({
    LANGUAGES,
    ROOM_STATUSES,
    UNIT_STATUSES,
    INVENTORY_MODES,
    BOOKING_MODES,
    CHILDREN_POLICIES,
    ROOM_CHILDREN_POLICY_OVERRIDES,
    ROOM_ALLOCATION_MODES,
    HOTEL_PRICE_INCLUSIONS,
    HOTEL_PAYMENT_DUE_EVENTS,
    HOTEL_PAYMENT_AMOUNT_MODES,
    HOTEL_PAYMENT_RECIPIENTS,
    HOTEL_PAYMENT_METHODS,
    HOTEL_COMMISSION_MODES,
    HOTEL_CALENDAR_SOURCES,
    EXTERNAL_CALENDAR_SOURCE_TYPES,
    H3_REVIEW_STATUSES,
    H3_2A_PARTNER_PERMISSIONS_CONTRACT,
    PRICING_CONTROL_READ_CONTRACT,
    PRICING_CONTROL_CONTRACT,
    PRICING_PREVIEW_CONTRACT,
    PRICING_CONTROL_ENTITIES,
    PRICING_CONTROL_ACTIONS,
    PRICING_LIFECYCLE_STATUSES,
    PRICING_SCHEDULE_SHARING_MODES,
    PRICING_CONTROL_READ_LIMITS,
    AVAILABILITY_CONTROL_READ_CONTRACT,
    AVAILABILITY_CONTROL_DRAFT_CONTRACT,
    AVAILABILITY_CONTROL_PREVIEW_CONTRACT,
    AVAILABILITY_CONTROL_PLAN_CONTRACT,
    AVAILABILITY_CONTROL_APPLY_CONTRACT,
    AVAILABILITY_STAY_REQUEST_CONTRACT,
    AVAILABILITY_STAY_PREVIEW_CONTRACT,
    EXTERNAL_CALENDAR_CONTROL_CONTRACT,
    EXTERNAL_CALENDAR_DRAFT_CONTRACT,
    EXTERNAL_CALENDAR_PREVIEW_CONTRACT,
    EXTERNAL_CALENDAR_PLAN_CONTRACT,
    EXTERNAL_CALENDAR_APPLY_CONTRACT,
    AVAILABILITY_CONTROL_ENTITIES,
    AVAILABILITY_CONTROL_ACTIONS,
    AVAILABILITY_CONTROL_READ_LIMITS,
    HOTEL_PARTNER_CAPABILITIES,
    HOTEL_PARTNER_MUTATION_CAPABILITIES,
    CHILD_AGE_MIN,
    CHILD_AGE_MAX,
    SEVEN_ARCHES_PROPERTY_ID,
    SEVEN_ARCHES_CHECK_IN_FROM,
    SEVEN_ARCHES_CHECK_OUT_UNTIL,
    SEVEN_ARCHES_SHADOW_IDS,
    SEVEN_ARCHES_INDEPENDENT_PRICING_IDS,
    SEVEN_ARCHES_SOURCE_CONTRACT,
    PARTNER_PROPERTY_PROPOSALS_ADMIN_CONTRACT,
    PARTNER_PROPERTY_PROPOSAL_REQUEST_CONTRACT,
    PARTNER_PROPERTY_PROPOSAL_PREVIEW_CONTRACT,
    PARTNER_PROPERTY_PROPOSAL_PLAN_CONTRACT,
    PARTNER_PROPERTY_PROPOSAL_APPLY_CONTRACT,
    SEVEN_ARCHES_PRICING_ACTIVATION_SNAPSHOT_CONTRACT,
    SEVEN_ARCHES_PRICING_ACTIVATION_DRAFT_CONTRACT,
    SEVEN_ARCHES_PRICING_ACTIVATION_PREVIEW_CONTRACT,
    SEVEN_ARCHES_PRICING_ACTIVATION_PLAN_CONTRACT,
    SEVEN_ARCHES_PRICING_ACTIVATION_APPLY_CONTRACT,
    SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_CONTROL_CONTRACT,
    SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_REQUEST_CONTRACT,
    SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_PREVIEW_CONTRACT,
    SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_PLAN_CONTRACT,
    SEVEN_ARCHES_REVIEWED_PRICING_ADMIN_APPLY_CONTRACT,
    SEVEN_KAMARES_PRICING_PROMOTION_CONTRACT,
    SEVEN_KAMARES_LEGACY_PRICING_FINGERPRINT,
    SEVEN_ARCHES_ROOM_DEFINITIONS,
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
    normalizeStringSet,
    isExactMoney,
    isExactIsoDate,
    isExactIsoTimestamp,
    isExactHttpsUrl,
    validatePartnerPropertyProposalsControl,
    validatePartnerPropertyProposalReviewRequest,
    validatePartnerPropertyProposalPlan,
    validatePartnerPropertyProposalPreview,
    validatePartnerPropertyProposalApplyResult,
    validateSevenArchesPricingActivationSnapshot,
    validateSevenArchesPricingActivationDraft,
    validateSevenArchesPricingActivationPlan,
    validateSevenArchesPricingActivationPreview,
    validateSevenArchesPricingActivationApplyResult,
    validateSevenArchesReviewedPricingItem,
    validateSevenArchesReviewedPricingControl,
    validateSevenArchesReviewedPricingAdminRequest,
    validateSevenArchesReviewedPricingPlan,
    validateSevenArchesReviewedPricingPreview,
    validateSevenArchesReviewedPricingApplyResult,
    normalizeHotelPartnerCapabilities,
    hotelPartnerCapabilitiesHaveMutation,
    normalizePartnerHotelPermissions,
    validatePartnerHotelPermissions,
    partnerHotelPermissionBusinessState,
    reconcilePartnerHotelPermission,
    buildPartnerHotelPermissionsPlan,
    normalizeH3Configuration: normalizeH31Configuration,
    validateH3Configuration: validateH31Configuration,
    reconcileH3Configuration: reconcileH31Configuration,
    buildH3ConfigurationPlan: buildH31ConfigurationPlan,
    deriveH3Readiness: deriveH31Readiness,
    h3BusinessState: h31BusinessState,
    normalizeLegacyPricingPromotionPreview,
    validateLegacyPricingPromotionPreview,
    legacyPricingPromotionSnapshot,
    reconcileLegacyPricingPromotion,
    buildLegacyPricingPromotionPlan,
    normalizeBedConfiguration,
    formatBedConfiguration,
    normalizeCancellationPolicy,
    cancellationPolicyLabel,
    normalizeChildrenPolicy,
    resolveChildrenPolicy,
    childrenPolicyLabel,
    sevenArchesShadowPreparation,
    sevenArchesShadowReconciliation,
    buildSevenArchesShadowPlan,
    normalizeRoomType,
    normalizeUnit,
    normalizeRatePlan,
    normalizeRoomRate,
    sharedScheduleCalendarDisplayState,
    normalizeWorkspace,
    totalConfiguredInventory,
    deriveWorkspaceReadiness,
    migrationPreview,
    buildLegacyShadowRoomSeed,
    validateCode,
    validateRoomType,
    validateUnit,
    validateRatePlan,
    validateRoomRate,
    operationForEntity,
    buildWorkspacePlan,
    buildPropertyControlPlan,
    PROPERTY_CONTROL_BUSINESS_FIELDS,
    propertyControlBusinessState,
    reconcilePropertyControl,
    OPERATIONAL_ASSIGNMENT_CONTRACT,
    normalizeOperationalAssignmentSnapshot,
    buildOperationalAssignmentPlan,
    buildRoomTypePlan,
    ROOM_CONTROL_BUSINESS_FIELDS,
    roomControlBusinessState,
    reconcileRoomControl,
    buildReviewRows,
    buildDuplicateRoom,
    priceFrom,
    normalizePricingControl,
    validatePricingControl,
    validatePricingControlOperation,
    validatePricingControlPlan,
    buildPricingControlPlan,
    pricingBusinessState,
    buildPricingControlOperation,
    buildPricingScheduleCloneOperation,
    buildPricingScheduleCloneForRoomRateOperations,
    reconcilePricingBusinessState,
    validatePricingPreviewRequest,
    validatePricingPreview,
    normalizeAvailabilityControl,
    validateAvailabilityIntent,
    validateAvailabilityOperation,
    validateAvailabilityDraft,
    validateAvailabilityPlan,
    validateAvailabilityPlanPreview,
    validateAvailabilityApplyResult,
    validateAvailabilityStayRequest,
    validateAvailabilityStayPreview,
    buildAvailabilityDraft,
    buildHoldReleaseIntent,
    normalizeExternalCalendarControl,
    validateExternalCalendarIntent,
    buildExternalCalendarDraft,
    validateExternalCalendarDraft,
    validateExternalCalendarPreview,
    validateExternalCalendarApplyResult,
  });
});
