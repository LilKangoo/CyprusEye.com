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
  const H3_REVIEW_STATUSES = Object.freeze(['requires_review', 'reviewed', 'disabled']);
  const H3_2A_PARTNER_PERMISSIONS_CONTRACT = 'hotels_v2_h3_2a_partner_permissions_v1';
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
      'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ];
    if (requiredOffFlags.some((key) => normalized.feature_flags[key] !== false)) {
      throw new Error('Partner permissions remain fail-closed until every Hotels V2 capability flag is present and OFF.');
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
    return {
      property: {
        ...clone(property),
        id: normalizeUuid(property.id),
        architecture_version: asText(property.architecture_version) || 'legacy',
        booking_mode: asText(property.booking_mode) || 'request_confirmation',
        timezone: asText(property.timezone) || 'Europe/Nicosia',
        currency: (asText(property.currency) || 'EUR').toUpperCase(),
        children_policy: CHILDREN_POLICIES.includes(asText(property.children_policy))
          ? asText(property.children_policy)
          : null,
        minimum_child_age: asText(property.children_policy) === 'minimum_age'
          ? asInteger(property.minimum_child_age, -1)
          : null,
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

  function migrationPreview(workspace) {
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
          ? 'HOTEL_7_ARCHES_ROOM1_PRICE_MISMATCH'
          : 'HOTEL_LEGACY_SHADOW_PRICE_MISMATCH',
        conversion_status: requiresOccupancyLosModel ? 'BLOCKED_PENDING_H2B_MODEL' : 'REVIEW_REQUIRED',
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
    if (!i18nText(room.name_i18n, 'en')) throw new Error('Room name in English is required.');
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
        'country', 'latitude', 'longitude', 'google_maps_url', 'google_place_id', 'amenities',
        'check_in_from', 'check_out_until', 'timezone', 'currency', 'booking_mode',
        'owner_partner_id', 'cover_image_url', 'photos', 'sort_order',
      ],
      room_type: [
        'source_id', 'code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults',
        'capacity_children', 'max_occupancy',
        'children_policy_override', 'minimum_child_age_override',
        'bed_configuration', 'bathrooms', 'size_sqm', 'amenities',
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
    const requiredOffFlags = ['hotel_rooms_v2_enabled', 'hotel_external_sync_enabled', 'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled'];
    const unsafeFlags = requiredOffFlags.filter((key) => normalized.flags[key] !== false);
    if (unsafeFlags.length) blockers.push(`Hotels V2 capability flags must be present and OFF: ${unsafeFlags.join(', ')}.`);
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
    return {
      hotel_id: normalized.property.id,
      expected_property_updated_at: options.expectedPropertyUpdatedAt || normalized.property.updated_at || null,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      operation: {
        type: reviewedOperation.type,
        id: normalizeUuid(reviewedOperation.id),
        expected_version: expectedVersion,
        payload: clone(reviewedOperation.payload || {}),
      },
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
    H3_REVIEW_STATUSES,
    H3_2A_PARTNER_PERMISSIONS_CONTRACT,
    HOTEL_PARTNER_CAPABILITIES,
    HOTEL_PARTNER_MUTATION_CAPABILITIES,
    CHILD_AGE_MIN,
    CHILD_AGE_MAX,
    SEVEN_ARCHES_PROPERTY_ID,
    SEVEN_ARCHES_CHECK_IN_FROM,
    SEVEN_ARCHES_CHECK_OUT_UNTIL,
    SEVEN_ARCHES_SHADOW_IDS,
    SEVEN_ARCHES_SOURCE_CONTRACT,
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
    buildRoomTypePlan,
    buildReviewRows,
    buildDuplicateRoom,
    priceFrom,
  });
});
