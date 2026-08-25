(function attachHotelsV2PartnerWorkspaceCore(root, factory) {
  const api = factory(root.HotelsV2WorkspaceCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2PartnerWorkspaceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2PartnerWorkspaceCore(AdminCore) {
  'use strict';

  const CONTRACTS = Object.freeze({
    workspace: 'hotels_v2_h3_2b_partner_workspace_v1',
    contentDraft: 'hotels_v2_h3_2b_content_draft_v1',
    contentPreview: 'hotels_v2_h3_2b_content_preview_v1',
    contentPlan: 'hotels_v2_h3_2b_content_plan_v1',
    contentApply: 'hotels_v2_h3_2b_content_apply_result_v1',
    pricingDraft: 'hotels_v2_h3_2b_pricing_draft_v1',
    pricingPreview: 'hotels_v2_h3_2b_pricing_preview_v1',
    pricingPlan: 'hotels_v2_h3_2b_pricing_plan_v1',
    pricingApply: 'hotels_v2_h3_2b_pricing_apply_result_v1',
    availabilityDraft: 'hotels_v2_h3_2b_availability_draft_v1',
    availabilityPreview: 'hotels_v2_h3_2b_availability_preview_v1',
    availabilityPlan: 'hotels_v2_h3_2b_availability_plan_v1',
    availabilityApply: 'hotels_v2_h3_2b_availability_apply_result_v1',
    commercialRequest: 'hotels_v2_h3_2b_commercial_stay_request_v1',
    commercialPreview: 'hotels_v2_h3_2b_commercial_stay_preview_v1',
    adminAvailability: 'hotels_v2_admin_d_availability_control_v1',
  });

  const CAPABILITIES = Object.freeze([
    'edit_property_content', 'edit_property_photos', 'edit_room_content', 'edit_room_photos',
    'create_rooms', 'edit_room_structure', 'manage_prices', 'manage_availability',
    'process_bookings', 'request_booking_changes', 'view_payment_status', 'initiate_stripe_onboarding',
  ]);
  const FEATURE_FLAGS = Object.freeze([
    'hotel_rooms_v2_enabled', 'hotel_external_sync_enabled',
    'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled',
  ]);
  const SECTION_KEYS = Object.freeze([
    'overview', 'property_content', 'property_photos', 'rooms', 'rates_pricing',
    'calendar_availability', 'bookings', 'payments', 'booking_changes', 'stripe_onboarding',
  ]);
  const SECTION_STATUSES = Object.freeze([
    'available', 'read_only', 'unavailable', 'blocked', 'existing_flow', 'future_stage',
  ]);
  const LANGUAGES = Object.freeze(['pl', 'en', 'he']);
  const SHA256 = /^[0-9a-f]{64}$/;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const FORBIDDEN_MUTATION_KEYS = new Set([
    'architecture_version', 'is_published', 'feature_flags', 'public_change', 'legacy_authoritative',
    'commission_policy', 'commission_mode', 'commission_amount', 'commission_rate',
    'payment_policy', 'payment_recipient', 'deposit', 'commercial_owner', 'owner_partner_id',
    'operational_partner_id', 'assignment_id', 'partner_id', 'booking_id', 'status', 'is_active',
  ]);

  function fail(message) { throw new Error(message); }
  function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function exactProjection(value, keys, label) {
    requireExactKeys(value, keys, label);
    return Object.fromEntries(keys.map((key) => [key, clone(value[key])]));
  }
  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  function hasExactKeys(value, keys) {
    if (!isObject(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
  }
  function hasOnlyKeys(value, keys) {
    return isObject(value) && Object.keys(value).every((key) => keys.includes(key));
  }
  function requireExactKeys(value, keys, label) {
    if (!hasExactKeys(value, keys)) fail(`${label} contains an unexpected field envelope.`);
    return value;
  }
  function requireArray(value, label, maximum = 10000) {
    if (!Array.isArray(value) || value.length > maximum) fail(`${label} is invalid or exceeds its safe limit.`);
    return value;
  }
  function requireCanonicalUuid(value, label = 'id', nullable = false) {
    if (nullable && value === null) return null;
    if (typeof value !== 'string' || !UUID.test(value)) fail(`${label} must be an exact lowercase canonical UUID.`);
    return value;
  }
  function isIsoDate(value) {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }
  function requireIsoDate(value, label = 'date') {
    if (!isIsoDate(value)) fail(`${label} must be an exact calendar date.`);
    return value;
  }
  function isIsoTimestamp(value) {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
    if (!match || !isIsoDate(match[1])) return false;
    if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return false;
    if (match[5] === 'Z') return true;
    const hours = Number(match[6]);
    const minutes = Number(match[7]);
    return hours <= 14 && minutes <= 59 && (hours < 14 || minutes === 0);
  }
  function requireTimestamp(value, label, nullable = false) {
    if (nullable && value === null) return null;
    if (!isIsoTimestamp(value)) fail(`${label} must be an exact timestamp.`);
    return value;
  }
  function requireSnapshot(value, label) {
    if (typeof value !== 'string' || !SHA256.test(value)) fail(`${label} must be a lowercase SHA-256 token.`);
    return value;
  }
  function requireString(value, label, options = {}) {
    if (value === null && options.nullable) return null;
    if (typeof value !== 'string' || value !== value.trim() || value.length < (options.minimum ?? 0)
        || value.length > (options.maximum ?? 12000) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) {
      fail(`${label} is invalid.`);
    }
    return value;
  }
  function requireInteger(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER, nullable = false) {
    if (nullable && value === null) return null;
    if (!Number.isInteger(value) || value < minimum || value > maximum) fail(`${label} must be a bounded whole number.`);
    return value;
  }
  function requireMoney(value, label, nullable = false) {
    if (nullable && value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9999999999.99 || Number(value.toFixed(2)) !== value) {
      fail(`${label} must be an exact non-negative monetary value.`);
    }
    return value;
  }
  function requireI18n(value, label, options = {}) {
    const keys = Object.keys(value || {}).sort();
    const allowed = options.partial ? keys.every((key) => LANGUAGES.includes(key)) : hasExactKeys(value, LANGUAGES);
    if (!isObject(value) || !allowed || keys.length > 3
        || keys.some((key) => typeof value[key] !== 'string' || value[key] !== value[key].trim() || value[key].length > (options.maximum ?? 12000))) {
      fail(`${label} must contain only exact PL/EN/HE strings.`);
    }
    return value;
  }
  function requireStringArray(value, label, maximum = 500) {
    requireArray(value, label, maximum);
    if (value.some((entry) => typeof entry !== 'string' || entry !== entry.trim() || !entry || entry.length > 2048)
        || new Set(value).size !== value.length) fail(`${label} must contain unique bounded strings.`);
    return value;
  }
  function requireNullableUrl(value, label) {
    if (value === null) return null;
    requireString(value, label, { minimum: 1, maximum: 2048 });
    let parsed;
    try { parsed = new URL(value, typeof location !== 'undefined' ? location.origin : 'https://cypruseye.com'); } catch (_error) { fail(`${label} is invalid.`); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(`${label} is invalid.`);
    return value;
  }
  function jsonBytes(value) {
    try { return new TextEncoder().encode(JSON.stringify(value)).length; } catch (_error) { return Number.MAX_SAFE_INTEGER; }
  }
  function requireUniqueIds(rows, label) {
    const ids = rows.map((row) => row.id);
    if (new Set(ids).size !== ids.length) fail(`${label} contains duplicate identifiers.`);
  }
  function nullableInteger(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
    return requireInteger(value, label, minimum, maximum, true);
  }

  function validateProperty(row, hotelId) {
    requireExactKeys(row, [
      'id', 'slug', 'title_i18n', 'description_i18n', 'city', 'address_line', 'district',
      'postal_code', 'country', 'latitude', 'longitude', 'google_maps_url', 'amenities',
      'check_in_from', 'check_out_until', 'cover_image_url', 'photos', 'architecture_version',
      'status', 'is_published', 'updated_at',
    ], 'Partner Hotel property');
    if (requireCanonicalUuid(row.id, 'property.id') !== hotelId) fail('Partner Hotel property identity is mismatched.');
    requireString(row.slug, 'property.slug', { minimum: 1, maximum: 180 });
    requireI18n(row.title_i18n, 'property.title_i18n', { maximum: 240 });
    requireI18n(row.description_i18n, 'property.description_i18n');
    ['city', 'address_line', 'district', 'postal_code', 'country'].forEach((key) => requireString(row[key], `property.${key}`, { nullable: true, maximum: 500 }));
    if (row.latitude !== null && (typeof row.latitude !== 'number' || !Number.isFinite(row.latitude) || row.latitude < -90 || row.latitude > 90)) fail('property.latitude is invalid.');
    if (row.longitude !== null && (typeof row.longitude !== 'number' || !Number.isFinite(row.longitude) || row.longitude < -180 || row.longitude > 180)) fail('property.longitude is invalid.');
    requireNullableUrl(row.google_maps_url, 'property.google_maps_url');
    requireStringArray(row.amenities, 'property.amenities');
    [row.check_in_from, row.check_out_until].forEach((value) => { if (value !== null && (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) fail('Property check-in/check-out time is invalid.'); });
    requireNullableUrl(row.cover_image_url, 'property.cover_image_url');
    requireStringArray(row.photos, 'property.photos', 250);
    if (row.architecture_version !== 'legacy' || typeof row.is_published !== 'boolean') fail('Partner Hotel legacy/public property guard failed.');
    requireString(row.status, 'property.status', { minimum: 1, maximum: 40 });
    requireTimestamp(row.updated_at, 'property.updated_at');
  }

  function validatePropertyDraft(row) {
    requireExactKeys(row, ['exists', 'id', 'status', 'version', 'source_property_updated_at', 'content', 'photos', 'updated_at'], 'Property draft');
    if (typeof row.exists !== 'boolean' || !isObject(row.content) || !isObject(row.photos)) fail('Property draft state is invalid.');
    if (!row.exists) {
      if (row.id !== null || row.status !== null || row.version !== 0 || row.source_property_updated_at !== null
          || row.updated_at !== null || Object.keys(row.content).length || Object.keys(row.photos).length) fail('Absent property draft must be an exact empty state.');
      return;
    }
    requireCanonicalUuid(row.id, 'property_draft.id');
    if (row.status !== 'pending_admin_review') fail('Only a pending Admin-review property proposal may be exposed to Partner UI.');
    requireInteger(row.version, 'property_draft.version', 1);
    requireTimestamp(row.source_property_updated_at, 'property_draft.source_property_updated_at');
    requireTimestamp(row.updated_at, 'property_draft.updated_at');
    if (Object.keys(row.content).length) {
      requireExactKeys(row.content, ['title_i18n', 'description_i18n', 'city', 'address_line', 'district', 'postal_code', 'country', 'latitude', 'longitude', 'google_maps_url', 'amenities', 'check_in_from', 'check_out_until'], 'Property draft content');
      requireI18n(row.content.title_i18n, 'property_draft.content.title_i18n', { maximum: 240 });
      requireI18n(row.content.description_i18n, 'property_draft.content.description_i18n');
      ['city', 'address_line', 'district', 'postal_code', 'country'].forEach((key) => requireString(row.content[key], `property_draft.content.${key}`, { nullable: true, maximum: 500 }));
      if (row.content.latitude !== null && (typeof row.content.latitude !== 'number' || !Number.isFinite(row.content.latitude) || row.content.latitude < -90 || row.content.latitude > 90)) fail('Property draft latitude is invalid.');
      if (row.content.longitude !== null && (typeof row.content.longitude !== 'number' || !Number.isFinite(row.content.longitude) || row.content.longitude < -180 || row.content.longitude > 180)) fail('Property draft longitude is invalid.');
      requireNullableUrl(row.content.google_maps_url, 'property_draft.content.google_maps_url'); requireStringArray(row.content.amenities, 'property_draft.content.amenities');
      [row.content.check_in_from, row.content.check_out_until].forEach((value) => { if (value !== null && (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) fail('Property draft time is invalid.'); });
    }
    if (Object.keys(row.photos).length) {
      requireExactKeys(row.photos, ['cover_image_url', 'photos'], 'Property draft photos');
      requireNullableUrl(row.photos.cover_image_url, 'property_draft.photos.cover_image_url'); requireStringArray(row.photos.photos, 'property_draft.photos.photos', 250);
    }
  }

  function validateRoom(row, hotelId) {
    requireExactKeys(row, [
      'id', 'hotel_id', 'code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults',
      'capacity_children', 'max_occupancy', 'bed_configuration', 'bathrooms', 'size_sqm',
      'amenities', 'inventory_mode', 'base_inventory_count', 'status', 'sort_order',
      'floor_label_i18n', 'version', 'updated_at',
    ], 'Partner Hotel Room');
    requireCanonicalUuid(row.id, 'room.id');
    if (requireCanonicalUuid(row.hotel_id, 'room.hotel_id') !== hotelId) fail('A Room belongs to another Hotel.');
    requireString(row.code, 'room.code', { minimum: 1, maximum: 80 });
    requireI18n(row.name_i18n, 'room.name_i18n', { maximum: 240 });
    requireI18n(row.description_i18n, 'room.description_i18n');
    requireStringArray(row.gallery, 'room.gallery', 250);
    nullableInteger(row.capacity_adults, 'room.capacity_adults', 0, 50);
    nullableInteger(row.capacity_children, 'room.capacity_children', 0, 50);
    nullableInteger(row.max_occupancy, 'room.max_occupancy', 1, 50);
    requireArray(row.bed_configuration, 'room.bed_configuration', 30).forEach((bed) => {
      const keys = bed?.type === 'other' ? ['type', 'quantity', 'label'] : ['type', 'quantity'];
      requireExactKeys(bed, keys, 'Room bed');
      if (!['double', 'single', 'sofa', 'bunk', 'king', 'queen', 'other'].includes(bed.type)) fail('Room bed type is invalid.');
      requireInteger(bed.quantity, 'Room bed quantity', 1, 20);
      if (bed.type === 'other') requireI18n(bed.label, 'Room bed label', { maximum: 160 });
    });
    if (typeof row.bathrooms !== 'number' || !Number.isFinite(row.bathrooms) || row.bathrooms < 0 || row.bathrooms > 20) fail('Room bathrooms are invalid.');
    if (row.size_sqm !== null && (typeof row.size_sqm !== 'number' || !Number.isFinite(row.size_sqm) || row.size_sqm <= 0 || row.size_sqm > 10000)) fail('Room size is invalid.');
    requireStringArray(row.amenities, 'room.amenities');
    if (!['pooled', 'unitized'].includes(row.inventory_mode) || !['draft', 'active', 'disabled'].includes(row.status)) fail('Room lifecycle or inventory mode is invalid.');
    requireInteger(row.base_inventory_count, 'room.base_inventory_count', 0, 10000);
    requireInteger(row.sort_order, 'room.sort_order', 0, 1000000);
    requireI18n(row.floor_label_i18n, 'room.floor_label_i18n', { maximum: 160 });
    requireInteger(row.version, 'room.version', 1);
    requireTimestamp(row.updated_at, 'room.updated_at');
  }

  function validateUnit(row, roomIds) {
    requireExactKeys(row, ['id', 'room_type_id', 'code', 'name_i18n', 'status', 'version', 'updated_at'], 'Partner Hotel Unit');
    requireCanonicalUuid(row.id, 'unit.id');
    if (!roomIds.has(requireCanonicalUuid(row.room_type_id, 'unit.room_type_id'))) fail('A Unit belongs to another Room.');
    requireString(row.code, 'unit.code', { minimum: 1, maximum: 80 });
    requireI18n(row.name_i18n, 'unit.name_i18n', { partial: true, maximum: 240 });
    if (!['active', 'maintenance', 'disabled'].includes(row.status)) fail('Unit status is invalid.');
    requireInteger(row.version, 'unit.version', 1);
    requireTimestamp(row.updated_at, 'unit.updated_at');
  }

  function validateCommissionPolicy(row, hotelId) {
    if (row === null) return;
    requireExactKeys(row, ['id', 'code', 'commission_mode', 'amount', 'currency', 'version', 'updated_at', 'fingerprint', 'read_only'], 'Commission policy');
    requireCanonicalUuid(row.id, 'commission_policy.id');
    requireString(row.code, 'commission_policy.code', { minimum: 1, maximum: 80 });
    if (!['per_allocated_room_per_night', 'percent_booking_total'].includes(row.commission_mode)) fail('Commission mode is invalid.');
    requireMoney(row.amount, 'commission_policy.amount');
    if (typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)) fail('Commission currency is invalid.');
    requireInteger(row.version, 'commission_policy.version', 1);
    requireTimestamp(row.updated_at, 'commission_policy.updated_at');
    requireSnapshot(row.fingerprint, 'commission_policy.fingerprint');
    if (row.read_only !== true) fail('Partner commission policy must be read-only.');
  }

  function validatePricing(value, hotelId, roomIds) {
    if (value === null) return;
    requireExactKeys(value, [
      'snapshot_token', 'currency', 'rate_plans', 'room_rates', 'schedules', 'schedule_tiers',
      'room_rate_tiers', 'exact_date_prices', 'allocation_rules', 'commission_policy',
      'mutation_blocked_reasons',
    ], 'Partner pricing');
    requireSnapshot(value.snapshot_token, 'pricing.snapshot_token');
    if (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) fail('Pricing currency is invalid.');
    const ratePlans = requireArray(value.rate_plans, 'pricing.rate_plans', 1000);
    const planIds = new Set();
    ratePlans.forEach((row) => {
      requireExactKeys(row, ['id', 'hotel_id', 'code', 'name_i18n', 'is_active', 'review_status', 'sort_order', 'version', 'updated_at'], 'Rate Plan');
      const id = requireCanonicalUuid(row.id, 'rate_plan.id');
      if (requireCanonicalUuid(row.hotel_id, 'rate_plan.hotel_id') !== hotelId || planIds.has(id)) fail('Rate Plan identity is invalid or duplicated.');
      planIds.add(id); requireString(row.code, 'rate_plan.code', { minimum: 1, maximum: 80 }); requireI18n(row.name_i18n, 'rate_plan.name_i18n', { maximum: 240 });
      if (typeof row.is_active !== 'boolean' || !['requires_review', 'reviewed'].includes(row.review_status)) fail('Rate Plan status is invalid.');
      requireInteger(row.sort_order, 'rate_plan.sort_order', 0, 1000000); requireInteger(row.version, 'rate_plan.version', 1); requireTimestamp(row.updated_at, 'rate_plan.updated_at');
    });
    const schedules = requireArray(value.schedules, 'pricing.schedules', 1000);
    const scheduleIds = new Set();
    schedules.forEach((row) => {
      requireExactKeys(row, ['id', 'hotel_id', 'code', 'name_i18n', 'application_scope', 'currency', 'maximum_party_size', 'minimum_billable_occupancy', 'is_active', 'review_status', 'sharing_mode', 'version', 'updated_at'], 'Pricing schedule');
      const id = requireCanonicalUuid(row.id, 'schedule.id');
      if (requireCanonicalUuid(row.hotel_id, 'schedule.hotel_id') !== hotelId || scheduleIds.has(id)) fail('Schedule identity is invalid or duplicated.');
      scheduleIds.add(id); requireString(row.code, 'schedule.code', { minimum: 1, maximum: 80 }); requireI18n(row.name_i18n, 'schedule.name_i18n', { maximum: 240 });
      if (!['shared', 'independent'].includes(row.sharing_mode) || typeof row.is_active !== 'boolean' || !['requires_review', 'reviewed'].includes(row.review_status)) fail('Schedule state is invalid.');
      requireString(row.application_scope, 'schedule.application_scope', { minimum: 1, maximum: 80 });
      if (!/^[A-Z]{3}$/.test(row.currency)) fail('Schedule currency is invalid.');
      requireInteger(row.maximum_party_size, 'schedule.maximum_party_size', 1, 50); requireInteger(row.minimum_billable_occupancy, 'schedule.minimum_billable_occupancy', 1, 50);
      requireInteger(row.version, 'schedule.version', 1); requireTimestamp(row.updated_at, 'schedule.updated_at');
    });
    const roomRates = requireArray(value.room_rates, 'pricing.room_rates', 5000);
    const roomRateIds = new Set();
    roomRates.forEach((row) => {
      requireExactKeys(row, ['id', 'hotel_id', 'room_type_id', 'rate_plan_id', 'pricing_schedule_id', 'pricing_source', 'base_nightly_rate', 'base_nightly_rate_authoritative', 'currency', 'is_active', 'review_status', 'sort_order', 'version', 'updated_at'], 'Room Rate');
      const id = requireCanonicalUuid(row.id, 'room_rate.id');
      if (requireCanonicalUuid(row.hotel_id, 'room_rate.hotel_id') !== hotelId || roomRateIds.has(id)
          || !roomIds.has(requireCanonicalUuid(row.room_type_id, 'room_rate.room_type_id'))
          || !planIds.has(requireCanonicalUuid(row.rate_plan_id, 'room_rate.rate_plan_id'))) fail('Room Rate relationship is invalid or duplicated.');
      roomRateIds.add(id);
      if (row.pricing_schedule_id !== null && !scheduleIds.has(requireCanonicalUuid(row.pricing_schedule_id, 'room_rate.pricing_schedule_id'))) fail('Room Rate schedule is foreign.');
      requireString(row.pricing_source, 'room_rate.pricing_source', { minimum: 1, maximum: 80 });
      requireMoney(row.base_nightly_rate, 'room_rate.base_nightly_rate', true);
      if (typeof row.base_nightly_rate_authoritative !== 'boolean' || !/^[A-Z]{3}$/.test(row.currency)
          || typeof row.is_active !== 'boolean' || !['requires_review', 'reviewed'].includes(row.review_status)) fail('Room Rate state is invalid.');
      requireInteger(row.sort_order, 'room_rate.sort_order', 0, 1000000); requireInteger(row.version, 'room_rate.version', 1); requireTimestamp(row.updated_at, 'room_rate.updated_at');
    });
    const validateTier = (row, type) => {
      const keys = type === 'schedule'
        ? ['id', 'schedule_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version', 'updated_at']
        : ['id', 'hotel_id', 'room_rate_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version', 'updated_at'];
      requireExactKeys(row, keys, `${type} tier`); requireCanonicalUuid(row.id, `${type}_tier.id`);
      if (type === 'schedule') { if (!scheduleIds.has(requireCanonicalUuid(row.schedule_id, 'schedule_tier.schedule_id'))) fail('Schedule tier is foreign.'); }
      else if (requireCanonicalUuid(row.hotel_id, 'room_rate_tier.hotel_id') !== hotelId || !roomRateIds.has(requireCanonicalUuid(row.room_rate_id, 'room_rate_tier.room_rate_id'))) fail('Room Rate tier is foreign.');
      requireInteger(row.guest_count, 'tier.guest_count', 1, 50); requireInteger(row.threshold_nights, 'tier.threshold_nights', 1, 3650); requireMoney(row.nightly_rate, 'tier.nightly_rate');
      if (typeof row.is_active !== 'boolean') fail('Tier state is invalid.'); requireInteger(row.version, 'tier.version', 1); requireTimestamp(row.updated_at, 'tier.updated_at');
    };
    requireArray(value.schedule_tiers, 'pricing.schedule_tiers', 50000).forEach((row) => validateTier(row, 'schedule'));
    requireArray(value.room_rate_tiers, 'pricing.room_rate_tiers', 50000).forEach((row) => validateTier(row, 'room_rate'));
    requireArray(value.exact_date_prices, 'pricing.exact_date_prices', 50000).forEach((row) => {
      requireExactKeys(row, ['id', 'hotel_id', 'room_rate_id', 'stay_date', 'nightly_rate_mode', 'nightly_rate', 'minimum_stay_mode', 'minimum_stay', 'maximum_stay_mode', 'maximum_stay', 'pricing_reason', 'pricing_expires_at', 'pricing_version', 'pricing_updated_at'], 'Exact-date price');
      requireCanonicalUuid(row.id, 'exact_date_price.id');
      if (requireCanonicalUuid(row.hotel_id, 'exact_date_price.hotel_id') !== hotelId || !roomRateIds.has(requireCanonicalUuid(row.room_rate_id, 'exact_date_price.room_rate_id'))) fail('Exact-date price is foreign.');
      requireIsoDate(row.stay_date, 'exact_date_price.stay_date');
      ['nightly_rate', 'minimum_stay', 'maximum_stay'].forEach((field) => { if (![null, 'set', 'clear'].includes(row[`${field}_mode`])) fail(`Exact-date ${field} mode is invalid.`); });
      requireMoney(row.nightly_rate, 'exact_date_price.nightly_rate', true); nullableInteger(row.minimum_stay, 'exact_date_price.minimum_stay', 1, 3650); nullableInteger(row.maximum_stay, 'exact_date_price.maximum_stay', 1, 3650);
      requireString(row.pricing_reason, 'exact_date_price.pricing_reason', { nullable: true, maximum: 500 }); requireTimestamp(row.pricing_expires_at, 'exact_date_price.pricing_expires_at', true);
      requireInteger(row.pricing_version, 'exact_date_price.pricing_version', 0); requireTimestamp(row.pricing_updated_at, 'exact_date_price.pricing_updated_at', true);
    });
    requireArray(value.allocation_rules, 'pricing.allocation_rules', 1000).forEach((row) => {
      requireExactKeys(row, ['id', 'hotel_id', 'code', 'allocation_mode', 'min_guest_count', 'max_guest_count', 'is_active', 'review_status', 'sort_order', 'version', 'items'], 'Allocation rule');
      requireCanonicalUuid(row.id, 'allocation_rule.id'); if (requireCanonicalUuid(row.hotel_id, 'allocation_rule.hotel_id') !== hotelId) fail('Allocation rule is foreign.');
      requireString(row.code, 'allocation_rule.code', { minimum: 1, maximum: 80 }); if (!['customer_choice', 'required_bundle'].includes(row.allocation_mode)) fail('Allocation mode is invalid.');
      requireInteger(row.min_guest_count, 'allocation_rule.min_guest_count', 1, 50); requireInteger(row.max_guest_count, 'allocation_rule.max_guest_count', 1, 50);
      if (row.min_guest_count > row.max_guest_count || typeof row.is_active !== 'boolean' || !['requires_review', 'reviewed'].includes(row.review_status)) fail('Allocation rule state is invalid.');
      requireInteger(row.sort_order, 'allocation_rule.sort_order', 0, 1000000); requireInteger(row.version, 'allocation_rule.version', 1);
      requireArray(row.items, 'allocation_rule.items', 100).forEach((item) => {
        requireExactKeys(item, ['id', 'allocation_rule_id', 'room_type_id', 'units_required', 'allocated_guest_count', 'pricing_guest_count', 'allocated_guest_counts', 'pricing_guest_counts', 'sort_order'], 'Allocation item');
        requireCanonicalUuid(item.id, 'allocation_item.id'); if (requireCanonicalUuid(item.allocation_rule_id, 'allocation_item.allocation_rule_id') !== row.id || !roomIds.has(requireCanonicalUuid(item.room_type_id, 'allocation_item.room_type_id'))) fail('Allocation item relationship is invalid.');
        requireInteger(item.units_required, 'allocation_item.units_required', 1, 50); nullableInteger(item.allocated_guest_count, 'allocation_item.allocated_guest_count', 1, 2500); nullableInteger(item.pricing_guest_count, 'allocation_item.pricing_guest_count', 1, 2500);
        [item.allocated_guest_counts, item.pricing_guest_counts].forEach((counts) => { if (counts !== null && (!Array.isArray(counts) || counts.length !== item.units_required || counts.some((count) => !Number.isInteger(count) || count < 1 || count > 50))) fail('Allocation item guest vectors are invalid.'); });
        requireInteger(item.sort_order, 'allocation_item.sort_order', 0, 1000000);
      });
    });
    validateCommissionPolicy(value.commission_policy, hotelId);
    requireStringArray(value.mutation_blocked_reasons, 'pricing.mutation_blocked_reasons', 100);
  }

  function validateActivity(row, hotelId) {
    requireExactKeys(row, ['id', 'hotel_id', 'entity_type', 'entity_id', 'action', 'actor_type', 'source', 'correlation_id', 'created_at'], 'Partner Hotel activity');
    requireCanonicalUuid(row.id, 'activity.id'); if (requireCanonicalUuid(row.hotel_id, 'activity.hotel_id') !== hotelId) fail('Activity belongs to another Hotel.');
    requireCanonicalUuid(row.entity_id, 'activity.entity_id'); requireCanonicalUuid(row.correlation_id, 'activity.correlation_id', true);
    ['entity_type', 'action', 'actor_type', 'source'].forEach((key) => requireString(row[key], `activity.${key}`, { minimum: 1, maximum: 120 }));
    requireTimestamp(row.created_at, 'activity.created_at');
  }

  function validateAvailability(value, hotelId, expected = {}) {
    if (value === null) return;
    requireExactKeys(value, [
      'contract_version', 'hotel_id', 'from', 'to', 'snapshot_token', 'snapshot_as_of',
      'snapshot_valid_until', 'property', 'room_types', 'room_rates', 'units', 'cells',
      'product_cells', 'daily_inventory', 'unit_calendar_blocks', 'operational_overrides',
      'rate_rule_operational_restrictions', 'booking_allocations', 'holds',
      'unmapped_booking_blockers', 'recent_activity', 'public_change',
    ], 'Partner availability');
    if (value.contract_version !== CONTRACTS.adminAvailability || requireCanonicalUuid(value.hotel_id, 'availability.hotel_id') !== hotelId || value.public_change !== false) fail('Availability contract or Hotel identity is invalid.');
    requireIsoDate(value.from, 'availability.from'); requireIsoDate(value.to, 'availability.to'); if (value.from > value.to) fail('Availability date range is invalid.');
    if ((expected.from && value.from !== expected.from) || (expected.to && value.to !== expected.to)) fail('Availability response substituted a different requested date range.');
    requireSnapshot(value.snapshot_token, 'availability.snapshot_token'); requireTimestamp(value.snapshot_as_of, 'availability.snapshot_as_of'); requireTimestamp(value.snapshot_valid_until, 'availability.snapshot_valid_until', true);
    ['property', 'room_types', 'room_rates', 'units', 'cells', 'product_cells', 'daily_inventory', 'unit_calendar_blocks', 'operational_overrides', 'rate_rule_operational_restrictions', 'booking_allocations', 'holds', 'unmapped_booking_blockers', 'recent_activity'].forEach((key) => {
      if (key === 'property') { if (!isObject(value[key])) fail('Availability property is invalid.'); }
      else requireArray(value[key], `availability.${key}`, key.includes('cells') ? 310000 : 50000);
    });
    // The ADMIN-D object is already a server-authoritative, redacted contract.
    // Reject unknown nested object envelopes that could smuggle raw rows or PII.
    const allowedNested = {
      property: ['id', 'name_i18n', 'architecture_version', 'timezone', 'currency', 'booking_mode', 'minimum_stay_nights', 'maximum_stay_nights', 'updated_at'],
      room_types: ['id', 'hotel_id', 'code', 'name_i18n', 'inventory_mode', 'base_inventory_count', 'status', 'sort_order', 'max_occupancy', 'capacity_adults', 'capacity_children', 'version', 'updated_at'],
      room_rates: ['id', 'hotel_id', 'room_type_id', 'rate_plan_id', 'is_active', 'review_status', 'sort_order', 'version', 'updated_at'],
      units: ['id', 'room_type_id', 'code', 'name_i18n', 'status', 'version', 'updated_at'],
      cells: ['room_type_id', 'stay_date', 'inventory_mode', 'physical_capacity', 'configured_sellable_units', 'blocked_unit_count', 'blocked_unit_ids', 'operational_closed', 'closed_to_arrival', 'closed_to_departure', 'safety_closed', 'held_units', 'booked_units', 'committed_units', 'available_units', 'requestable', 'blocking_reasons', 'earliest_hold_expiry', 'provenance', 'inventory_version'],
      product_cells: ['room_type_id', 'room_rate_id', 'rate_plan_id', 'stay_date', 'operational_closed', 'closed_to_arrival', 'closed_to_departure', 'safety_closed', 'requestable', 'blocking_reasons', 'provenance'],
      daily_inventory: ['room_type_id', 'stay_date', 'sellable_units', 'sellable_units_mode', 'closed', 'closed_mode', 'reason', 'expires_at', 'version', 'updated_at'],
      unit_calendar_blocks: ['id', 'hotel_id', 'room_type_id', 'unit_id', 'from_date', 'to_date', 'blocked', 'reason', 'expires_at', 'is_active', 'version', 'updated_at'],
      operational_overrides: ['id', 'hotel_id', 'room_rate_id', 'stay_date', 'closed', 'closed_mode', 'closed_to_arrival', 'closed_to_arrival_mode', 'closed_to_departure', 'closed_to_departure_mode', 'availability_reason', 'availability_expires_at', 'availability_active', 'availability_version', 'availability_updated_at'],
      rate_rule_operational_restrictions: ['id', 'room_rate_id', 'valid_from', 'valid_to', 'weekdays', 'closed_to_arrival', 'closed_to_departure', 'availability_version', 'availability_reason', 'availability_actor_id', 'availability_correlation_id', 'availability_updated_at'],
      booking_allocations: ['id', 'booking_id', 'room_type_id', 'rate_plan_id', 'room_rate_id', 'unit_ids', 'units_required', 'allocated_guest_counts', 'pricing_guest_counts', 'booking_updated_at', 'booking_arrival_date', 'booking_departure_date', 'current_booking_updated_at', 'current_booking_status', 'active_commitment_from', 'active_commitment_to', 'active_commitments', 'status', 'version', 'updated_at'],
      holds: ['id', 'status', 'expires_at', 'version', 'created_at', 'updated_at', 'active_commitment_from', 'active_commitment_to', 'commitments'],
      unmapped_booking_blockers: ['booking_id', 'booking_updated_at', 'arrival_date', 'departure_date', 'status', 'num_adults', 'num_children', 'reason'],
      recent_activity: ['id', 'entity_type', 'entity_id', 'action', 'before_state', 'after_state', 'actor_type', 'source', 'correlation_id', 'created_at'],
    };
    Object.entries(allowedNested).forEach(([key, keys]) => {
      const rows = key === 'property' ? [value.property] : value[key];
      rows.forEach((row) => requireExactKeys(row, keys, `availability.${key}`));
    });
    if (jsonBytes(value) > 20 * 1024 * 1024) fail('Availability response exceeds the safe byte limit.');
    if (!AdminCore || typeof AdminCore.normalizeAvailabilityControl !== 'function') fail('The shared ADMIN-D validator is unavailable.');
    AdminCore.normalizeAvailabilityControl(value, hotelId);
  }

  function validateWorkspace(value, expected = {}) {
    requireExactKeys(value, [
      'contract_version', 'partner', 'hotel_id', 'assignment', 'feature_flags', 'content_snapshot_token',
      'property', 'property_draft', 'rooms', 'units', 'pricing', 'availability', 'sections', 'recent_activity',
      'legacy_authoritative', 'public_change',
    ], 'Partner Hotel workspace');
    if (value.contract_version !== CONTRACTS.workspace) fail('Unsupported Partner Hotel workspace contract.');
    requireExactKeys(value.partner, ['id', 'role'], 'Partner identity');
    const partnerId = requireCanonicalUuid(value.partner.id, 'partner.id');
    const hotelId = requireCanonicalUuid(value.hotel_id, 'hotel_id');
    if ((expected.partnerId && partnerId !== expected.partnerId) || (expected.hotelId && hotelId !== expected.hotelId)) fail('Partner Hotel workspace identity is mismatched.');
    requireString(value.partner.role, 'partner.role', { minimum: 1, maximum: 80 });
    requireExactKeys(value.assignment, ['id', 'permission_version', 'capabilities', 'access_snapshot_token'], 'Partner assignment');
    requireCanonicalUuid(value.assignment.id, 'assignment.id'); requireInteger(value.assignment.permission_version, 'assignment.permission_version', 1); requireSnapshot(value.assignment.access_snapshot_token, 'assignment.access_snapshot_token');
    requireExactKeys(value.assignment.capabilities, CAPABILITIES, 'Partner capabilities');
    CAPABILITIES.forEach((key) => { if (typeof value.assignment.capabilities[key] !== 'boolean') fail(`Capability ${key} is invalid.`); });
    requireExactKeys(value.feature_flags, FEATURE_FLAGS, 'Hotel feature flags');
    FEATURE_FLAGS.forEach((key) => { if (value.feature_flags[key] !== false) fail('Hotels V2 feature flags must remain OFF in the Partner workspace.'); });
    requireSnapshot(value.content_snapshot_token, 'content_snapshot_token');
    validateProperty(value.property, hotelId);
    validatePropertyDraft(value.property_draft);
    const rooms = requireArray(value.rooms, 'rooms', 1000); rooms.forEach((row) => validateRoom(row, hotelId)); requireUniqueIds(rooms, 'Rooms');
    const roomIds = new Set(rooms.map((row) => row.id));
    const units = requireArray(value.units, 'units', 10000); units.forEach((row) => validateUnit(row, roomIds)); requireUniqueIds(units, 'Units');
    validatePricing(value.pricing, hotelId, roomIds);
    validateAvailability(value.availability, hotelId, expected);
    requireExactKeys(value.sections, SECTION_KEYS, 'Partner workspace sections');
    SECTION_KEYS.forEach((key) => {
      const section = value.sections[key];
      requireExactKeys(section, ['visible', 'available', 'status'], `Section ${key}`);
      if (typeof section.visible !== 'boolean' || typeof section.available !== 'boolean' || !SECTION_STATUSES.includes(section.status)) fail(`Section ${key} is invalid.`);
    });
    if (value.sections.bookings.status !== 'existing_flow' || value.sections.payments.status !== 'existing_flow'
        || value.sections.booking_changes.status !== 'future_stage' || value.sections.stripe_onboarding.status !== 'future_stage') {
      fail('Partner deferred/existing section status contract is invalid.');
    }
    const capabilities = value.assignment.capabilities;
    const expectedVisibility = {
      overview: true,
      property_content: capabilities.edit_property_content,
      property_photos: capabilities.edit_property_photos,
      rooms: capabilities.edit_room_content || capabilities.edit_room_photos || capabilities.create_rooms || capabilities.edit_room_structure,
      rates_pricing: capabilities.manage_prices,
      calendar_availability: capabilities.manage_availability,
      bookings: capabilities.process_bookings,
      payments: capabilities.view_payment_status,
      booking_changes: capabilities.request_booking_changes,
      stripe_onboarding: capabilities.initiate_stripe_onboarding,
    };
    Object.entries(expectedVisibility).forEach(([key, visible]) => {
      if (value.sections[key].visible !== visible) fail(`Section ${key} visibility does not match the exact capability.`);
    });
    if ((value.pricing !== null) !== capabilities.manage_prices || (value.availability !== null) !== capabilities.manage_availability) fail('Sensitive pricing/availability DTO visibility does not match exact permissions.');
    if (value.sections.bookings.available !== capabilities.process_bookings || value.sections.payments.available !== capabilities.view_payment_status
        || value.sections.booking_changes.available !== false || value.sections.stripe_onboarding.available !== false) fail('Existing/deferred section availability is inconsistent.');
    requireArray(value.recent_activity, 'recent_activity', 100).forEach((row) => validateActivity(row, hotelId));
    if (value.legacy_authoritative !== true || value.public_change !== false || value.property.architecture_version !== 'legacy') fail('Partner Hotel legacy/public guard failed.');
    if (jsonBytes(value) > 25 * 1024 * 1024) fail('Partner Hotel workspace exceeds its safe byte limit.');
    return clone(value);
  }

  function reasonIsValid(value) {
    return typeof value === 'string' && value === value.trim() && value.length >= 3 && value.length <= 500
      && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
  }
  function ensureNoProtectedKeys(value, path = 'payload') {
    if (Array.isArray(value)) return value.forEach((entry, index) => ensureNoProtectedKeys(entry, `${path}[${index}]`));
    if (!isObject(value)) return;
    Object.entries(value).forEach(([key, child]) => {
      if (FORBIDDEN_MUTATION_KEYS.has(key)) fail(`${path}.${key} is protected and cannot be supplied by Partner Hotel UI.`);
      ensureNoProtectedKeys(child, `${path}.${key}`);
    });
  }
  function validateIntent(domain, intent) {
    requireExactKeys(intent, ['entity', 'action', 'id', 'payload', 'reason'], `${domain} intent`);
    if (!reasonIsValid(intent.reason)) fail('A single-line reviewed reason from 3 to 500 characters is required.');
    if (!isObject(intent.payload)) fail('Partner Hotel intent payload is invalid.');
    ensureNoProtectedKeys(intent.payload);
    if (domain === 'content') {
      const allowed = {
        property_content: ['update'], property_photos: ['update'], room_content: ['update'],
        room_photos: ['update'], room_structure: ['update'], room: ['create'],
      };
      if (!allowed[intent.entity]?.includes(intent.action)) fail('Unsupported Partner content intent.');
      if (intent.entity === 'room' && intent.action === 'create') { if (intent.id !== null) fail('New Room intent ID must be null.'); }
      else requireCanonicalUuid(intent.id, 'content.intent.id');
      const keys = {
        property_content: ['title_i18n', 'description_i18n', 'city', 'address_line', 'district', 'postal_code', 'country', 'latitude', 'longitude', 'google_maps_url', 'amenities', 'check_in_from', 'check_out_until'],
        property_photos: ['cover_image_url', 'photos'],
        room_content: ['name_i18n', 'description_i18n', 'amenities', 'floor_label_i18n'],
        room_photos: ['gallery'],
        room_structure: ['capacity_adults', 'capacity_children', 'max_occupancy', 'bed_configuration', 'bathrooms', 'size_sqm', 'inventory_mode', 'base_inventory_count', 'sort_order'],
        room: ['code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults', 'capacity_children', 'max_occupancy', 'bed_configuration', 'bathrooms', 'size_sqm', 'amenities', 'inventory_mode', 'base_inventory_count', 'sort_order', 'floor_label_i18n'],
      }[intent.entity];
      if (!hasOnlyKeys(intent.payload, keys) || !Object.keys(intent.payload).length) fail('Content intent contains unsupported or empty fields.');
    } else if (domain === 'pricing') {
      const pairs = { room_rate_price: 'update', schedule_tier_price: 'update', room_rate_tier_price: 'update', exact_date_price: 'upsert' };
      if (pairs[intent.entity] !== intent.action) fail('Unsupported Partner pricing intent.');
      if (intent.entity === 'exact_date_price') {
        if (intent.id !== null) requireCanonicalUuid(intent.id, 'pricing.intent.id');
        requireExactKeys(intent.payload, ['room_rate_id', 'stay_date', 'nightly_rate_mode', 'nightly_rate'], 'Exact-date price payload');
        requireCanonicalUuid(intent.payload.room_rate_id, 'pricing.room_rate_id'); requireIsoDate(intent.payload.stay_date, 'pricing.stay_date');
        if (intent.payload.nightly_rate_mode !== 'set') fail('Partner exact-date pricing supports reviewed SET only.'); requireMoney(intent.payload.nightly_rate, 'pricing.nightly_rate');
      } else {
        requireCanonicalUuid(intent.id, 'pricing.intent.id'); requireExactKeys(intent.payload, ['nightly_rate'], 'Pricing payload'); requireMoney(intent.payload.nightly_rate, 'pricing.nightly_rate');
      }
    } else if (domain === 'availability') {
      if (intent.entity !== 'daily_inventory' || intent.action !== 'upsert' || intent.id !== null) fail('Unsupported Partner availability intent.');
      const keys = ['room_type_id', 'stay_date', 'sellable_units', 'sellable_units_mode', 'closed', 'closed_mode', 'expires_at'];
      if (!hasOnlyKeys(intent.payload, keys)) fail('Availability payload contains unsupported fields.');
      requireCanonicalUuid(intent.payload.room_type_id, 'availability.room_type_id'); requireIsoDate(intent.payload.stay_date, 'availability.stay_date');
      const pair = (field) => Object.hasOwn(intent.payload, field) || Object.hasOwn(intent.payload, `${field}_mode`);
      if (!pair('sellable_units') && !pair('closed') && !Object.hasOwn(intent.payload, 'expires_at')) fail('Choose an exact availability change.');
      if (pair('sellable_units')) {
        if (!Object.hasOwn(intent.payload, 'sellable_units') || !Object.hasOwn(intent.payload, 'sellable_units_mode') || !['set', 'clear'].includes(intent.payload.sellable_units_mode)) fail('Sellable Units SET/CLEAR pair is invalid.');
        if (intent.payload.sellable_units_mode === 'set') requireInteger(intent.payload.sellable_units, 'sellable_units', 0, 10000);
        else if (intent.payload.sellable_units !== null) fail('CLEAR sellable units must send null.');
      }
      if (pair('closed')) {
        if (!Object.hasOwn(intent.payload, 'closed') || !Object.hasOwn(intent.payload, 'closed_mode') || !['set', 'clear'].includes(intent.payload.closed_mode)) fail('Closure SET/CLEAR pair is invalid.');
        if (intent.payload.closed_mode === 'set' && typeof intent.payload.closed !== 'boolean') fail('SET closure requires a boolean.');
        if (intent.payload.closed_mode === 'clear' && intent.payload.closed !== null) fail('CLEAR closure must send null.');
      }
      if (Object.hasOwn(intent.payload, 'expires_at')) {
        if (intent.payload.expires_at !== null) {
          requireTimestamp(intent.payload.expires_at, 'availability.expires_at');
          if (Date.parse(intent.payload.expires_at) <= Date.now()) fail('Availability expiry must be strictly in the future.');
        }
      }
    }
  }

  function validateDraft(domain, value) {
    const contracts = { content: CONTRACTS.contentDraft, pricing: CONTRACTS.pricingDraft, availability: CONTRACTS.availabilityDraft };
    if (!contracts[domain]) fail('Unsupported Partner Hotel draft domain.');
    const keys = domain === 'content'
      ? ['contract_version', 'partner_id', 'hotel_id', 'access_snapshot_token', 'content_snapshot_token', 'intent']
      : domain === 'pricing'
        ? ['contract_version', 'partner_id', 'hotel_id', 'access_snapshot_token', 'pricing_snapshot_token', 'intent', 'example_stay']
        : ['contract_version', 'partner_id', 'hotel_id', 'access_snapshot_token', 'from', 'to', 'availability_snapshot_token', 'intent'];
    requireExactKeys(value, keys, `${domain} draft`);
    if (value.contract_version !== contracts[domain]) fail(`Unsupported ${domain} draft contract.`);
    requireCanonicalUuid(value.partner_id, `${domain}.partner_id`); requireCanonicalUuid(value.hotel_id, `${domain}.hotel_id`);
    requireSnapshot(value.access_snapshot_token, `${domain}.access_snapshot_token`);
    requireSnapshot(value[`${domain === 'availability' ? 'availability' : domain}_snapshot_token`], `${domain} snapshot token`);
    if (domain === 'availability') {
      requireIsoDate(value.from, 'availability.from'); requireIsoDate(value.to, 'availability.to');
      if (value.from > value.to || value.intent.payload.stay_date < value.from || value.intent.payload.stay_date > value.to) fail('Availability draft or target date is outside the exact reviewed range.');
    }
    validateIntent(domain, value.intent);
    if (domain === 'pricing' && value.example_stay !== null) validateCommercialStayRequest(value.example_stay, { allowContractOnly: true, partnerId: value.partner_id, hotelId: value.hotel_id, snapshotToken: value.pricing_snapshot_token });
    if (jsonBytes(value) > 5 * 1024 * 1024) fail('Partner Hotel draft exceeds its safe byte limit.');
    return clone(value);
  }

  function validateOperation(domain, operation) {
    requireExactKeys(operation, ['entity', 'action', 'id', 'expected_version', 'expected_original', 'payload', 'reason'], `${domain} reviewed operation`);
    if (operation.id !== null) requireCanonicalUuid(operation.id, `${domain}.operation.id`);
    if (operation.expected_version !== null) requireInteger(operation.expected_version, `${domain}.operation.expected_version`, 0);
    if (operation.expected_original !== null && !isObject(operation.expected_original)) fail('Reviewed operation original state is invalid.');
    if (!isObject(operation.payload) || !reasonIsValid(operation.reason)) fail('Reviewed operation payload or reason is invalid.');
    ensureNoProtectedKeys(operation.payload);
  }

  function validateReviewedPlan(domain, value) {
    const contracts = { content: CONTRACTS.contentPlan, pricing: CONTRACTS.pricingPlan, availability: CONTRACTS.availabilityPlan };
    requireExactKeys(value, ['contract_version', 'review_id', 'partner_id', 'hotel_id', 'assignment_id', 'permission_version', 'access_snapshot_token', 'domain_snapshot_token', 'reviewed_at', 'expires_at', 'operations', 'plan_fingerprint'], `${domain} reviewed plan`);
    if (value.contract_version !== contracts[domain]) fail(`Unsupported ${domain} reviewed plan contract.`);
    ['review_id', 'partner_id', 'hotel_id', 'assignment_id'].forEach((key) => requireCanonicalUuid(value[key], `${domain}.${key}`));
    requireInteger(value.permission_version, `${domain}.permission_version`, 1);
    requireSnapshot(value.access_snapshot_token, `${domain}.access_snapshot_token`); requireSnapshot(value.domain_snapshot_token, `${domain}.domain_snapshot_token`); requireSnapshot(value.plan_fingerprint, `${domain}.plan_fingerprint`); requireTimestamp(value.reviewed_at, `${domain}.reviewed_at`); requireTimestamp(value.expires_at, `${domain}.expires_at`);
    const operations = requireArray(value.operations, `${domain}.operations`, 1);
    if (operations.length !== 1) fail('A changed Partner Review must contain exactly one reviewed operation.');
    validateOperation(domain, operations[0]);
    return value;
  }

  function validateImpact(row) {
    requireExactKeys(row, ['entity', 'action', 'id', 'changed', 'fields', 'before', 'after', 'affected_room_type_ids', 'affected_room_rate_ids', 'from', 'to'], 'Partner Hotel impact');
    requireString(row.entity, 'impact.entity', { minimum: 1, maximum: 80 }); requireString(row.action, 'impact.action', { minimum: 1, maximum: 40 });
    if (row.id !== null) requireCanonicalUuid(row.id, 'impact.id'); if (typeof row.changed !== 'boolean') fail('Impact changed flag is invalid.');
    requireStringArray(row.fields, 'impact.fields', 100); if (row.before !== null && !isObject(row.before)) fail('Impact before state is invalid.'); if (row.after !== null && !isObject(row.after)) fail('Impact after state is invalid.');
    requireStringArray(row.affected_room_type_ids, 'impact.affected_room_type_ids', 1000).forEach((id) => requireCanonicalUuid(id, 'impact.room_type_id'));
    requireStringArray(row.affected_room_rate_ids, 'impact.affected_room_rate_ids', 5000).forEach((id) => requireCanonicalUuid(id, 'impact.room_rate_id'));
    if ((row.from === null) !== (row.to === null)) fail('Impact date scope is incomplete.'); if (row.from !== null) { requireIsoDate(row.from, 'impact.from'); requireIsoDate(row.to, 'impact.to'); if (row.from > row.to) fail('Impact date scope is invalid.'); }
  }

  function validateCommercialSummary(value, label) {
    if (value === null) return;
    requireExactKeys(value, ['policy', 'calculation_basis', 'customer_price', 'cypruseye_commission', 'partner_net', 'currency'], label);
    requireExactKeys(value.policy, ['id', 'code', 'commission_mode', 'amount', 'currency', 'version', 'updated_at', 'fingerprint', 'read_only'], `${label}.policy`);
    requireCanonicalUuid(value.policy.id, `${label}.policy.id`); requireString(value.policy.code, `${label}.policy.code`, { minimum: 1, maximum: 80 }); if (!['per_allocated_room_per_night', 'percent_booking_total'].includes(value.policy.commission_mode) || value.policy.read_only !== true) fail(`${label} commission policy is invalid.`);
    requireMoney(value.policy.amount, `${label}.policy.amount`); if (!/^[A-Z]{3}$/.test(value.policy.currency)) fail(`${label} policy currency is invalid.`); requireInteger(value.policy.version, `${label}.policy.version`, 1); requireTimestamp(value.policy.updated_at, `${label}.policy.updated_at`); requireSnapshot(value.policy.fingerprint, `${label}.policy.fingerprint`);
    requireExactKeys(value.calculation_basis, ['code', 'quantity', 'unit_amount', 'booking_total'], `${label}.calculation_basis`); requireString(value.calculation_basis.code, `${label}.basis.code`, { minimum: 1, maximum: 80 }); requireMoney(value.calculation_basis.quantity, `${label}.basis.quantity`); requireMoney(value.calculation_basis.unit_amount, `${label}.basis.unit_amount`); requireMoney(value.calculation_basis.booking_total, `${label}.basis.booking_total`);
    requireMoney(value.customer_price, `${label}.customer_price`); requireMoney(value.cypruseye_commission, `${label}.cypruseye_commission`); requireMoney(value.partner_net, `${label}.partner_net`); if (!/^[A-Z]{3}$/.test(value.currency) || value.policy.currency !== value.currency) fail(`${label} currency is invalid.`);
    const expectedBasis = value.policy.commission_mode === 'percent_booking_total' ? 'booking_total' : 'allocated_room_nights';
    if (value.calculation_basis.code !== expectedBasis) fail(`${label} commission basis does not match the read-only policy.`);
    if (value.calculation_basis.unit_amount !== value.policy.amount || value.calculation_basis.booking_total !== value.customer_price) fail(`${label} commission basis amounts are inconsistent.`);
    const customerCents = BigInt(Math.round(value.customer_price * 100));
    const amountCents = BigInt(Math.round(value.policy.amount * 100));
    let expectedCommissionCents;
    if (value.policy.commission_mode === 'percent_booking_total') {
      if (value.calculation_basis.quantity !== 1) fail(`${label} percent commission quantity must be exactly one.`);
      expectedCommissionCents = (customerCents * amountCents + 5000n) / 10000n;
    } else {
      if (!Number.isInteger(value.calculation_basis.quantity) || value.calculation_basis.quantity < 1) fail(`${label} allocated Room-night quantity is invalid.`);
      expectedCommissionCents = amountCents * BigInt(value.calculation_basis.quantity);
    }
    if (BigInt(Math.round(value.cypruseye_commission * 100)) !== expectedCommissionCents
        || BigInt(Math.round(value.partner_net * 100)) !== customerCents - expectedCommissionCents) fail(`${label} server commercial totals are internally inconsistent.`);
  }

  function reviewedTargetFromWorkspace(domain, draft, workspace) {
    if (!workspace || workspace.partner.id !== draft.partner_id || workspace.hotel_id !== draft.hotel_id
        || workspace.assignment.access_snapshot_token !== draft.access_snapshot_token) fail('Review is not bound to the exact loaded Partner workspace.');
    const capabilityByEntity = {
      property_content: 'edit_property_content', property_photos: 'edit_property_photos', room_content: 'edit_room_content', room_photos: 'edit_room_photos',
      room_structure: 'edit_room_structure', room: 'create_rooms', room_rate_price: 'manage_prices', schedule_tier_price: 'manage_prices',
      room_rate_tier_price: 'manage_prices', exact_date_price: 'manage_prices', daily_inventory: 'manage_availability',
    };
    if (!workspace.assignment.capabilities[capabilityByEntity[draft.intent.entity]]) fail('Loaded assignment does not permit this exact reviewed entity.');
    if (domain === 'content' && workspace.content_snapshot_token !== draft.content_snapshot_token) fail('Content Review uses a different loaded snapshot.');
    if (domain === 'pricing' && workspace.pricing?.snapshot_token !== draft.pricing_snapshot_token) fail('Pricing Review uses a different loaded snapshot.');
    if (domain === 'availability' && (workspace.availability?.snapshot_token !== draft.availability_snapshot_token
        || workspace.availability.from !== draft.from || workspace.availability.to !== draft.to)) fail('Availability Review uses a different loaded range or snapshot.');

    const entity = draft.intent.entity;
    if (entity === 'property_content' || entity === 'property_photos') return {
      original: exactProjection(workspace.property_draft,
        ['exists', 'id', 'status', 'version', 'source_property_updated_at', 'content', 'photos', 'updated_at'],
        'Loaded property proposal'),
      version: workspace.property_draft.version,
    };
    if (entity === 'room') return { original: null, version: 0 };
    if (['room_content', 'room_photos', 'room_structure'].includes(entity)) {
      const row = workspace.rooms.find((candidate) => candidate.id === draft.intent.id);
      if (!row || row.status === 'disabled') fail('Reviewed Room target is absent or disabled in the exact loaded workspace.');
      return {
        original: exactProjection(row, [
          'id', 'hotel_id', 'code', 'name_i18n', 'description_i18n', 'gallery',
          'capacity_adults', 'capacity_children', 'max_occupancy', 'bed_configuration',
          'bathrooms', 'size_sqm', 'amenities', 'inventory_mode', 'base_inventory_count',
          'status', 'sort_order', 'floor_label_i18n', 'version', 'updated_at',
        ], 'Loaded Room'),
        version: row.version,
      };
    }
    if (entity === 'room_rate_price') {
      const row = workspace.pricing.room_rates.find((candidate) => candidate.id === draft.intent.id);
      if (!row || !row.base_nightly_rate_authoritative) fail('Reviewed base-price target is absent or not authoritative.');
      return {
        original: exactProjection(row, [
          'id', 'hotel_id', 'room_type_id', 'rate_plan_id', 'pricing_schedule_id',
          'pricing_source', 'base_nightly_rate', 'base_nightly_rate_authoritative', 'currency',
          'is_active', 'review_status', 'sort_order', 'version', 'updated_at',
        ], 'Loaded Room Rate'),
        version: row.version,
      };
    }
    if (entity === 'schedule_tier_price' || entity === 'room_rate_tier_price') {
      const rows = entity === 'schedule_tier_price' ? workspace.pricing.schedule_tiers : workspace.pricing.room_rate_tiers;
      const row = rows.find((candidate) => candidate.id === draft.intent.id);
      if (!row) fail('Reviewed occupancy-tier target is absent from the exact loaded workspace.');
      const keys = entity === 'schedule_tier_price'
        ? ['id', 'schedule_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version', 'updated_at']
        : ['id', 'hotel_id', 'room_rate_id', 'guest_count', 'threshold_nights', 'nightly_rate', 'is_active', 'version', 'updated_at'];
      return { original: exactProjection(row, keys, 'Loaded occupancy tier'), version: row.version };
    }
    if (entity === 'exact_date_price') {
      const row = workspace.pricing.exact_date_prices.find((candidate) => candidate.room_rate_id === draft.intent.payload.room_rate_id && candidate.stay_date === draft.intent.payload.stay_date) || null;
      if (!workspace.pricing.room_rates.some((candidate) => candidate.id === draft.intent.payload.room_rate_id)) fail('Reviewed exact-date Room Rate is absent from the exact loaded workspace.');
      return {
        original: row === null ? null : exactProjection(row, [
          'id', 'hotel_id', 'room_rate_id', 'stay_date', 'nightly_rate_mode', 'nightly_rate',
          'minimum_stay_mode', 'minimum_stay', 'maximum_stay_mode', 'maximum_stay',
          'pricing_reason', 'pricing_expires_at', 'pricing_version', 'pricing_updated_at',
        ], 'Loaded exact-date price'),
        version: row?.pricing_version || 0,
      };
    }
    if (entity === 'daily_inventory') {
      const room = workspace.rooms.find((candidate) => candidate.id === draft.intent.payload.room_type_id);
      if (!room || room.status !== 'active') fail('Reviewed availability Room is not an exact active Room.');
      const row = workspace.availability.daily_inventory.find((candidate) => candidate.room_type_id === room.id && candidate.stay_date === draft.intent.payload.stay_date) || null;
      const original = row ? exactProjection(row,
        ['room_type_id', 'stay_date', 'sellable_units', 'sellable_units_mode', 'closed', 'closed_mode', 'reason', 'expires_at', 'version', 'updated_at'],
        'Loaded daily inventory') : null;
      return { original, version: row?.version || 0 };
    }
    fail('Reviewed entity has no exact loaded target binding.');
  }

  function reviewedBeforeMap(domain, draft, workspace, target, fields) {
    if (target.original === null) return null;
    let source = target.original;
    if (draft.intent.entity === 'property_content') source = Object.keys(workspace.property_draft.content).length ? workspace.property_draft.content : workspace.property;
    if (draft.intent.entity === 'property_photos') source = Object.keys(workspace.property_draft.photos).length ? workspace.property_draft.photos : workspace.property;
    if (domain === 'pricing') {
      const value = draft.intent.entity === 'room_rate_price' ? source.base_nightly_rate : source.nightly_rate;
      return { nightly_rate: clone(value) };
    }
    return Object.fromEntries(fields.map((key) => [key, clone(source[key])]));
  }

  function reviewedImpactScope(domain, draft, workspace, operation, target) {
    let roomIds = [];
    let rateIds = [];
    let from = null;
    let to = null;
    const entity = draft.intent.entity;
    if (entity === 'room' || entity.startsWith('room_')) roomIds = [entity === 'room' ? operation.id : draft.intent.id];
    if (entity === 'room_rate_price') {
      rateIds = [draft.intent.id]; roomIds = [target.original.room_type_id];
    }
    if (entity === 'schedule_tier_price') {
      rateIds = workspace.pricing.room_rates.filter((row) => row.pricing_schedule_id === target.original.schedule_id).map((row) => row.id);
      roomIds = workspace.pricing.room_rates.filter((row) => rateIds.includes(row.id)).map((row) => row.room_type_id);
    }
    if (entity === 'room_rate_tier_price') {
      rateIds = [target.original.room_rate_id];
      roomIds = workspace.pricing.room_rates.filter((row) => rateIds.includes(row.id)).map((row) => row.room_type_id);
    }
    if (entity === 'exact_date_price') {
      rateIds = [draft.intent.payload.room_rate_id];
      roomIds = workspace.pricing.room_rates.filter((row) => rateIds.includes(row.id)).map((row) => row.room_type_id);
      from = draft.intent.payload.stay_date; to = from;
    }
    if (entity === 'daily_inventory') {
      roomIds = [draft.intent.payload.room_type_id]; from = draft.intent.payload.stay_date; to = from;
    }
    return { roomIds: Array.from(new Set(roomIds)).sort(), rateIds: Array.from(new Set(rateIds)).sort(), from, to };
  }

  function validatePlanPreview(domain, value, draft, workspace = null) {
    const contracts = { content: CONTRACTS.contentPreview, pricing: CONTRACTS.pricingPreview, availability: CONTRACTS.availabilityPreview };
    const keys = ['contract_version', 'partner_id', 'hotel_id', 'changed', 'blocking_reasons', 'impacts', 'reviewed_plan'];
    if (domain === 'pricing') keys.push('commercial_before', 'commercial_after', 'example_before', 'example_after');
    requireExactKeys(value, keys, `${domain} preview`); if (value.contract_version !== contracts[domain]) fail(`Unsupported ${domain} preview contract.`);
    if (requireCanonicalUuid(value.partner_id, 'preview.partner_id') !== draft.partner_id || requireCanonicalUuid(value.hotel_id, 'preview.hotel_id') !== draft.hotel_id) fail('Preview identity is mismatched.');
    if (typeof value.changed !== 'boolean') fail('Preview changed flag is invalid.'); requireStringArray(value.blocking_reasons, 'preview.blocking_reasons', 100);
    const impacts = requireArray(value.impacts, 'preview.impacts', 100); impacts.forEach(validateImpact);
    if (!value.changed) {
      if (impacts.length || value.reviewed_plan !== null) fail('A semantic no-op must return no impacts and no reviewed plan.');
    } else {
      if (impacts.length !== 1 || value.reviewed_plan === null) fail('A changed Review must return exactly one impact and reviewed plan.');
      const plan = validateReviewedPlan(domain, value.reviewed_plan);
      if (plan.partner_id !== draft.partner_id || plan.hotel_id !== draft.hotel_id
          || plan.access_snapshot_token !== draft.access_snapshot_token
          || plan.domain_snapshot_token !== draft[`${domain === 'availability' ? 'availability' : domain}_snapshot_token`]) fail('Reviewed plan is not bound to the draft snapshot.');
      const operation = plan.operations[0];
      const serverGeneratedTarget = draft.intent.id === null
        || (domain === 'content' && ['property_content', 'property_photos'].includes(draft.intent.entity));
      if (operation.entity !== draft.intent.entity || operation.action !== draft.intent.action
          || operation.reason !== draft.intent.reason || canonicalJson(operation.payload) !== canonicalJson(draft.intent.payload)
          || (!serverGeneratedTarget && operation.id !== draft.intent.id)
          || (serverGeneratedTarget && !UUID.test(operation.id))) fail('Server-reviewed operation differs from the exact Partner draft.');
      let target = null;
      if (workspace) {
        target = reviewedTargetFromWorkspace(domain, draft, workspace);
        if (operation.expected_version !== target.version || canonicalJson(operation.expected_original) !== canonicalJson(target.original)) fail('Server Review original/version differs from the exact loaded target.');
        if (['property_content', 'property_photos'].includes(draft.intent.entity) && workspace.property_draft.exists && operation.id !== workspace.property_draft.id) fail('Server Review substituted another property proposal row.');
        if (draft.intent.entity === 'exact_date_price' && target.original && operation.id !== target.original.id) fail('Server Review substituted another exact-date pricing row.');
      }
      const impact = impacts[0];
      if (!impact.changed || impact.entity !== operation.entity || impact.action !== operation.action || impact.id !== operation.id) fail('Review impact is not exactly bound to its operation.');
      const expectedFields = (domain === 'pricing' ? ['nightly_rate'] : Object.keys(draft.intent.payload)).sort();
      if (canonicalJson([...impact.fields].sort()) !== canonicalJson(expectedFields)
          || impact.after === null || canonicalJson(Object.keys(impact.after).sort()) !== canonicalJson(expectedFields)) fail('Review impact fields are not the exact reviewed field map.');
      const expectedAfter = Object.fromEntries(expectedFields.map((key) => [key, clone(draft.intent.payload[key])]));
      if (canonicalJson(impact.after) !== canonicalJson(expectedAfter)) fail('Review impact after-state differs from the reviewed payload.');
      if (target && ((target.original === null) !== (impact.before === null)
          || (impact.before !== null && canonicalJson(Object.keys(impact.before).sort()) !== canonicalJson(expectedFields)))) fail('Review impact before-state is not the exact target field map.');
      if (target && canonicalJson(impact.before) !== canonicalJson(reviewedBeforeMap(domain, draft, workspace, target, expectedFields))) fail('Review impact before-state differs from the exact loaded target fields.');
      if (target) {
        const scope = reviewedImpactScope(domain, draft, workspace, operation, target);
        if (canonicalJson([...impact.affected_room_type_ids].sort()) !== canonicalJson(scope.roomIds)
            || canonicalJson([...impact.affected_room_rate_ids].sort()) !== canonicalJson(scope.rateIds)
            || impact.from !== scope.from || impact.to !== scope.to) fail('Review impact scope differs from the exact loaded product/date relationships.');
      }
    }
    if (domain === 'pricing') {
      validateCommercialSummary(value.commercial_before, 'commercial_before'); validateCommercialSummary(value.commercial_after, 'commercial_after');
      if (value.example_before !== null) validateCommercialStayPreview(value.example_before, draft.example_stay, { nested: true });
      if (value.example_after !== null) validateCommercialStayPreview(value.example_after, draft.example_stay, { nested: true });
      if (value.changed && (value.commercial_before === null || value.commercial_after === null)) fail('Changed pricing Review must include exact before/after commission and Partner-net values.');
      const expectsExample = value.changed && draft.example_stay !== null;
      if ((value.example_before !== null) !== expectsExample || (value.example_after !== null) !== expectsExample) fail('Pricing Review did not return the exact requested example stay before and after the change.');
      if (value.changed && workspace && draft.intent.entity === 'exact_date_price' && target?.original === null) {
        const exactNight = value.example_before?.pricing?.nightly_breakdown?.some((night) => (
          night.room_rate_id === draft.intent.payload.room_rate_id
            && night.stay_date === draft.intent.payload.stay_date
        ));
        if (!draft.example_stay || !exactNight) fail('A new exact-date price requires an exact successful server example covering that Room Rate and stay date.');
      }
    }
    return clone(value);
  }

  function validateApplyResult(domain, value, expected) {
    const contracts = { content: CONTRACTS.contentApply, pricing: CONTRACTS.pricingApply, availability: CONTRACTS.availabilityApply };
    requireExactKeys(value, ['contract_version', 'partner_id', 'hotel_id', 'correlation_id', 'idempotency_key', 'replayed', 'changed', 'activity', 'workspace'], `${domain} apply result`);
    if (value.contract_version !== contracts[domain] || value.partner_id !== expected.plan.partner_id || value.hotel_id !== expected.plan.hotel_id
        || value.correlation_id !== expected.correlationId || value.idempotency_key !== expected.idempotencyKey) fail('Partner Hotel Save receipt identity is invalid.');
    if (typeof value.replayed !== 'boolean' || typeof value.changed !== 'boolean') fail('Partner Hotel Save receipt flags are invalid.');
    const activity = requireArray(value.activity, 'apply.activity', 100); activity.forEach((row) => validateActivity(row, value.hotel_id));
    if ((value.changed && activity.length !== 1) || (!value.changed && activity.length !== 0)) fail('Partner Hotel Save activity cardinality is inconsistent.');
    if (value.changed) {
      const operation = expected.plan.operations[0];
      const mapping = {
        property_content: ['property', value.hotel_id, 'update'],
        property_photos: ['property', value.hotel_id, 'update'],
        room: ['room_type', operation.id, 'create'],
        room_content: ['room_type', operation.id, 'update'],
        room_photos: ['room_type', operation.id, 'update'],
        room_structure: ['room_type', operation.id, 'update'],
        room_rate_price: ['room_rate', operation.id, 'update'],
        schedule_tier_price: ['occupancy_tier', operation.id, 'update'],
        room_rate_tier_price: ['occupancy_tier', operation.id, 'update'],
        exact_date_price: ['calendar_override', operation.id, operation.expected_version === 0 ? 'create' : 'update'],
        daily_inventory: ['daily_inventory', operation.id, operation.expected_version === 0 ? 'create' : 'update'],
      }[operation.entity];
      const row = activity[0];
      if (!mapping || row.source !== 'hotels_v2_h3_2b_partner_workspace' || row.actor_type !== 'partner'
          || row.correlation_id !== expected.correlationId || row.entity_type !== mapping[0]
          || row.entity_id !== mapping[1] || row.action !== mapping[2]) fail('Partner Hotel Save activity is not exactly bound to its reviewed operation.');
    }
    if (value.workspace !== null) validateWorkspace(value.workspace, { partnerId: value.partner_id, hotelId: value.hotel_id });
    return clone(value);
  }

  function validateCommercialStayRequest(value, options = {}) {
    requireExactKeys(value, ['contract_version', 'partner_id', 'hotel_id', 'pricing_snapshot_token', 'rate_plan_id', 'allocation_rule_id', 'selected_room_type_id', 'check_in', 'check_out', 'adults', 'child_ages'], 'Commercial stay request');
    if (value.contract_version !== CONTRACTS.commercialRequest) fail('Unsupported commercial stay request contract.');
    const partnerId = requireCanonicalUuid(value.partner_id, 'commercial.partner_id'); const hotelId = requireCanonicalUuid(value.hotel_id, 'commercial.hotel_id');
    if ((options.partnerId && options.partnerId !== partnerId) || (options.hotelId && options.hotelId !== hotelId)) fail('Commercial stay request identity is mismatched.');
    requireSnapshot(value.pricing_snapshot_token, 'commercial.pricing_snapshot_token'); if (options.snapshotToken && options.snapshotToken !== value.pricing_snapshot_token) fail('Commercial stay request snapshot is mismatched.');
    ['rate_plan_id', 'allocation_rule_id', 'selected_room_type_id'].forEach((key) => { if (value[key] !== null) requireCanonicalUuid(value[key], `commercial.${key}`); });
    requireIsoDate(value.check_in, 'commercial.check_in'); requireIsoDate(value.check_out, 'commercial.check_out'); if (value.check_in >= value.check_out) fail('Commercial stay dates are invalid.');
    const nights = Math.round((Date.parse(`${value.check_out}T00:00:00Z`) - Date.parse(`${value.check_in}T00:00:00Z`)) / 86400000);
    if (!Number.isInteger(nights) || nights < 1 || nights > 365) fail('Commercial stay length must be from 1 to 365 nights.');
    requireInteger(value.adults, 'commercial.adults', 1, 50); requireArray(value.child_ages, 'commercial.child_ages', 50).forEach((age) => requireInteger(age, 'commercial.child_age', 0, 17));
    return clone(value);
  }

  function validateCommercialStayPreview(value, request, options = {}) {
    requireExactKeys(value, ['contract_version', 'partner_id', 'hotel_id', 'pricing', 'commercial', 'ok', 'blocking_reasons', 'legacy_authoritative', 'public_change'], 'Commercial stay preview');
    if (value.contract_version !== CONTRACTS.commercialPreview || value.partner_id !== request.partner_id || value.hotel_id !== request.hotel_id || typeof value.ok !== 'boolean' || value.legacy_authoritative !== true || value.public_change !== false) fail('Commercial stay preview guard is invalid.');
    if (!isObject(value.pricing)) fail('Commercial stay pricing provenance is invalid.');
    if (!AdminCore || typeof AdminCore.validatePricingPreview !== 'function') fail('The shared ADMIN-C pricing validator is unavailable.');
    AdminCore.validatePricingPreview(value.pricing, {
      contract_version: 'hotels_v2_admin_c_pricing_preview_v1',
      hotel_id: request.hotel_id,
      snapshot_token: request.pricing_snapshot_token,
      rate_plan_id: request.rate_plan_id,
      allocation_rule_id: request.allocation_rule_id,
      selected_room_type_id: request.selected_room_type_id,
      check_in: request.check_in,
      check_out: request.check_out,
      adults: request.adults,
      child_ages: request.child_ages,
    });
    validateCommercialSummary(value.commercial, 'commercial'); requireStringArray(value.blocking_reasons, 'commercial.blocking_reasons', 100);
    if (value.ok !== value.pricing.ok) fail('Commercial stay status differs from the exact pricing preview.');
    if (value.ok && (value.commercial === null || value.blocking_reasons.length)) fail('Commercial stay success is inconsistent.');
    if (!value.ok && (value.commercial !== null || !value.blocking_reasons.length)) fail('Blocked commercial stay must fail closed with controlled reasons and no commercial total.');
    if (!options.nested && jsonBytes(value) > 5 * 1024 * 1024) fail('Commercial stay preview exceeds its safe limit.');
    return clone(value);
  }

  function localized(value, language = 'en', fallback = '') {
    if (!isObject(value)) return fallback;
    const lang = ['pl', 'en', 'he'].includes(language) ? language : 'en';
    const chain = lang === 'he' ? ['he', 'en', 'pl'] : (lang === 'pl' ? ['pl', 'en', 'he'] : ['en', 'pl', 'he']);
    return chain.map((key) => value[key]).find((entry) => typeof entry === 'string' && entry.trim()) || fallback;
  }

  function newUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    fail('Secure UUID generation is unavailable.');
  }

  return Object.freeze({
    CONTRACTS, CAPABILITIES, FEATURE_FLAGS, SECTION_KEYS,
    hasExactKeys, requireCanonicalUuid, requireIsoDate, validateWorkspace, validateDraft,
    validateReviewedPlan, validatePlanPreview, validateApplyResult,
    validateCommercialStayRequest, validateCommercialStayPreview, localized, newUuid,
  });
});
