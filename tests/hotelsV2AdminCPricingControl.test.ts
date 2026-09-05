import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const PLAN_ID = '33333333-3333-4333-8333-333333333333';
const RATE_ID = '44444444-4444-4444-8444-444444444444';
const DEFAULT_ID = '55555555-5555-4555-8555-555555555555';
const ALLOCATION_ID = '66666666-6666-4666-8666-666666666666';
const ACTIVITY_ID = '77777777-7777-4777-8777-777777777777';
const CORRELATION_ID = '88888888-8888-4888-8888-888888888888';
const ACTOR_ID = '99999999-9999-4999-8999-999999999999';
const EXACT_DATE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
const SCHEDULE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SCHEDULE_TIER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SNAPSHOT = 'a'.repeat(64);
const MD5 = 'b'.repeat(32);
const UPDATED_AT = '2026-08-21T09:30:00.000Z';

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js');
  const context: Record<string, any> = {
    crypto: { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    URL,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2WorkspaceCore;
}

const Core = loadCore();

function control(withPropertyDefault = true): any {
  return {
    contract_version: 'hotels_v2_admin_c_pricing_control_v1',
    hotel_id: HOTEL_ID,
    property: {
      id: HOTEL_ID,
      updated_at: UPDATED_AT,
      architecture_version: 'rooms_v2',
      currency: 'EUR',
      minimum_stay_nights: 2,
      maximum_stay_nights: 30,
      children_policy: 'allowed',
      minimum_child_age: null,
      booking_mode: 'request_confirmation',
    },
    feature_flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
    legacy_safety: {
      architecture_version: 'rooms_v2',
      legacy_pricing_authoritative: false,
      legacy_pricing_rule_count: null,
      legacy_pricing_fingerprint: null,
      public_change: false,
    },
    snapshot_token: SNAPSHOT,
    rate_plans: [{
      id: PLAN_ID,
      hotel_id: HOTEL_ID,
      code: 'standard',
      name_i18n: { pl: 'Standard', en: 'Standard', he: 'סטנדרט' },
      description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
      meal_plan_code: null,
      cancellation_policy: { type: 'flexible' },
      booking_mode_override: null,
      price_inclusions: [],
      is_active: false,
      review_status: 'reviewed',
      lifecycle_status: 'inactive',
      review_basis: 'stored',
      sort_order: 100,
      version: 3,
      updated_at: UPDATED_AT,
      immutable_contract: null,
      activation_blockers: [],
    }],
    room_types: [{
      id: ROOM_ID,
      hotel_id: HOTEL_ID,
      code: 'studio',
      name_i18n: { pl: 'Studio', en: 'Studio', he: 'סטודיו' },
      status: 'draft',
      max_occupancy: 2,
      capacity_adults: 2,
      capacity_children: 0,
      children_policy_override: null,
      minimum_child_age_override: null,
      inventory_mode: 'pooled',
      base_inventory_count: 1,
      active_unit_count: 0,
      version: 2,
      updated_at: UPDATED_AT,
    }],
    room_rates: [{
      id: RATE_ID,
      hotel_id: HOTEL_ID,
      room_type_id: ROOM_ID,
      rate_plan_id: PLAN_ID,
      pricing_schedule_id: null,
      base_nightly_rate: 0,
      currency: 'EUR',
      external_redirect_url: null,
      is_active: false,
      review_status: 'reviewed',
      lifecycle_status: 'inactive',
      review_basis: 'stored',
      sort_order: 100,
      version: 4,
      updated_at: UPDATED_AT,
      pricing_source: withPropertyDefault ? 'property_default' : 'missing',
      base_nightly_rate_authoritative: false,
      independent_tiers: [],
      independent_tiers_fingerprint: MD5,
      immutable_contract: null,
      activation_blockers: [],
    }],
    pricing_schedules: [],
    rate_rules: [],
    exact_date_prices: [],
    allocation_rules: [],
    property_pricing_default: withPropertyDefault ? {
      id: DEFAULT_ID,
      hotel_id: HOTEL_ID,
      nightly_rate: 100,
      currency: 'EUR',
      is_active: true,
      review_status: 'reviewed',
      lifecycle_status: 'active',
      version: 2,
      updated_at: UPDATED_AT,
      immutable_contract: null,
      activation_blockers: [],
    } : null,
    recent_activity: [],
  };
}

function manualSchedule(): any {
  return {
    id: SCHEDULE_ID, hotel_id: HOTEL_ID, code: 'manual-schedule',
    name_i18n: { pl: 'Cennik', en: 'Schedule', he: 'תעריף' },
    application_scope: 'room_occupancy', currency: 'EUR', maximum_party_size: 2,
    minimum_billable_occupancy: 1, is_active: false, review_status: 'reviewed',
    lifecycle_status: 'inactive', source: 'manual', source_reference: {
      kind: 'manual', cloned_from_schedule_id: null, pricing_model: null,
      pricing_fingerprint: null, rule_count: null, guest_counts: null,
      migration_blocker: null,
    },
    version: 1, updated_at: UPDATED_AT, linked_room_rate_ids: [],
    link_fingerprint: MD5, sharing_mode: 'independent',
    tiers: [{ id: SCHEDULE_TIER_ID, schedule_id: SCHEDULE_ID, guest_count: 1,
      threshold_nights: 1, nightly_rate: 100, is_active: true, version: 1,
      updated_at: UPDATED_AT }],
    tiers_fingerprint: MD5, immutable_contract: null, activation_blockers: [],
  };
}

function scheduleTierControl(tierId = 'f6c679b1-c0d7-64c7-d0d1-4b898f285778'): any {
  const source = control(false);
  const schedule = manualSchedule();
  schedule.linked_room_rate_ids = [RATE_ID];
  schedule.tiers[0].id = tierId;
  source.pricing_schedules = [schedule];
  source.room_rates[0].pricing_schedule_id = SCHEDULE_ID;
  source.room_rates[0].pricing_source = 'pricing_schedule';
  return source;
}

function allocationRule(): any {
  return {
    id: ALLOCATION_ID, hotel_id: HOTEL_ID, code: 'two-guests',
    allocation_mode: 'required_bundle', min_guest_count: 2, max_guest_count: 2,
    is_active: false, review_status: 'reviewed', lifecycle_status: 'inactive',
    sort_order: 100, version: 1, updated_at: UPDATED_AT, items_fingerprint: MD5,
    items: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', hotel_id: HOTEL_ID,
      allocation_rule_id: ALLOCATION_ID, room_type_id: ROOM_ID, units_required: 1,
      allocated_guest_count: 2, pricing_guest_count: 2,
      allocated_guest_counts: [2], pricing_guest_counts: [2], sort_order: 100,
      version: 1 }],
    immutable_contract: null, activation_blockers: [],
  };
}

function previewRequest(checkIn = '2026-08-21', checkOut = '2026-08-22'): any {
  return {
    contract_version: 'hotels_v2_admin_c_pricing_preview_v1',
    hotel_id: HOTEL_ID,
    snapshot_token: SNAPSHOT,
    rate_plan_id: PLAN_ID,
    allocation_rule_id: ALLOCATION_ID,
    selected_room_type_id: null,
    check_in: checkIn,
    check_out: checkOut,
    adults: 2,
    child_ages: [],
  };
}

function successfulPreview(): any {
  return {
    contract_version: 'hotels_v2_admin_c_pricing_preview_v1',
    hotel_id: HOTEL_ID,
    snapshot_token: SNAPSHOT,
    ok: true,
    requestable: false,
    blocking_reasons: [],
    currency: 'EUR',
    check_in: '2026-08-21',
    check_out: '2026-08-22',
    nights: 1,
    adults: 2,
    child_ages: [],
    guest_count: 2,
    allocation: [{
      allocation_rule_id: ALLOCATION_ID,
      allocation_mode: 'required_bundle',
      room_type_id: ROOM_ID,
      units_required: 1,
      allocated_guest_count: 2,
      pricing_guest_count: 2,
      allocated_guest_counts: [2],
      pricing_guest_counts: [2],
    }],
    products: [{
      room_type_id: ROOM_ID,
      room_rate_id: RATE_ID,
      rate_plan_id: PLAN_ID,
      unit_sequence: 1,
      allocated_guest_count: 2,
      requested_pricing_guest_count: 2,
      resolved_pricing_guest_count: 2,
      minimum_billable_occupancy: 2,
      base_pricing_source: 'property_default',
      base_pricing_source_id: DEFAULT_ID,
      los_threshold_nights: null,
      subtotal: 100,
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      cancellation_policy: { type: 'flexible' },
      price_inclusions: [],
      effective_minimum_stay: 2,
      effective_maximum_stay: 30,
      stay_allowed: true,
    }],
    nightly_breakdown: [{
      stay_date: '2026-08-21',
      room_type_id: ROOM_ID,
      room_rate_id: RATE_ID,
      rate_plan_id: PLAN_ID,
      unit_sequence: 1,
      allocated_guest_count: 2,
      requested_pricing_guest_count: 2,
      resolved_pricing_guest_count: 2,
      minimum_billable_occupancy: 2,
      base_pricing_source: 'property_default',
      base_pricing_source_id: DEFAULT_ID,
      los_threshold_nights: null,
      weekday_rule_id: null,
      seasonal_range_rule_id: null,
      exact_date_price_id: null,
      final_pricing_source: 'property_default',
      nightly_rate: 100,
      currency: 'EUR',
      effective_minimum_stay: 2,
      effective_maximum_stay: 30,
      minimum_stay_source: 'property',
      minimum_stay_source_id: HOTEL_ID,
      maximum_stay_source: 'property',
      maximum_stay_source_id: HOTEL_ID,
    }],
    customer_total: 100,
    pricing_precedence: [
      'exact_date_price', 'seasonal_range_rule', 'weekday_rule',
      'pricing_schedule_tier', 'independent_occupancy_tier',
      'room_rate_base_nightly_rate', 'property_default',
    ],
    legacy_authoritative: false,
    public_change: false,
  };
}

describe('Hotels V2 ADMIN-C pricing client contracts', () => {
  test('keeps SQL and client UUID version/variant boundaries identical', () => {
    const migration = fs.readFileSync(path.join(process.cwd(),
      'supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql'), 'utf8');
    expect(migration).toContain(
      "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    );
    for (const [candidate, accepted] of [
      ['c2000000-0000-1000-8000-000000000001', true],
      ['c2000000-0000-5000-b000-000000000001', true],
      ['c2000000-0000-0000-8000-000000000001', false],
      ['c2000000-0000-7000-8000-000000000001', false],
      ['c2000000-0000-4000-7000-000000000001', false],
      // Shared Core accepts presentation casing only by normalizing the
      // emitted transport back to the lowercase SQL-canonical spelling.
      ['C2000000-0000-4000-8000-000000000001', true],
    ] as const) {
      const normalized = Core.normalizeUuid(candidate);
      expect(Boolean(normalized)).toBe(accepted);
      if (normalized) expect(normalized).toBe(candidate.toLowerCase());
    }
  });

  test('classifies only literal ADMIN-C helper prefixes and compatibility-core suffixes', () => {
    const sqlFiles = [
      'supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql',
      'supabase/manual/hotels_v2_admin_c_pricing_control_verify.sql',
      'supabase/manual/hotels_v2_admin_c_pricing_control_post_admin_verify.sql',
      'tests/integration/hotels-v2-admin-c-pricing-control-postgres-gate.sql',
    ];
    for (const filename of sqlFiles) {
      const sql = fs.readFileSync(path.join(process.cwd(), filename), 'utf8');
      expect(sql).toContain(
        "left(procedure_row.proname,length('hotel_v2_admin_c_'))=",
      );
      expect(sql).toContain(
        "right(procedure_row.proname,length('_admin_c_core'))=",
      );
      expect(sql).not.toContain("procedure_row.proname like 'hotel_v2_admin_c_%'");
      expect(sql).not.toContain("procedure_row.proname like '%_admin_c_core'");
    }
  });

  test('normalizes nullable allocation guest arrays before element validation', () => {
    const migration = fs.readFileSync(path.join(process.cwd(),
      'supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql'), 'utf8');
    for (const field of ['allocated_guest_counts', 'pricing_guest_counts']) {
      expect(migration).toContain(
        `case when jsonb_typeof(v_child->'${field}')='array'`,
      );
      expect(migration).not.toContain(
        `coalesce(v_child->'${field}','[]'::jsonb)`,
      );
    }
  });

  test('does not accumulate a JSON-null audit entry for semantic no-ops', () => {
    const migration = fs.readFileSync(path.join(process.cwd(),
      'supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql'), 'utf8');
    expect(migration).toContain(
      "if jsonb_typeof(v_after->'activity')='object' then",
    );
    expect(migration).not.toContain("if v_after->'activity' is not null then");
  });

  test('post-Admin reviewed-state output fingerprints every authoritative child relation', () => {
    const verifier = fs.readFileSync(path.join(process.cwd(),
      'supabase/manual/hotels_v2_admin_c_pricing_control_post_admin_verify.sql'), 'utf8');
    for (const [key, relation] of [
      ['pricing_schedule_occupancy_tiers', 'hotel_pricing_schedule_occupancy_tiers'],
      ['room_rate_occupancy_tiers', 'hotel_room_rate_occupancy_tiers'],
      ['allocation_rule_items', 'hotel_room_allocation_rule_items'],
    ]) {
      expect(verifier).toContain(`'${key}',md5(coalesce((select string_agg(`);
      expect(verifier).toContain(`from public.${relation} row_value`);
    }
  });

  test('validates the exact inert generic-Hotel snapshot and pricing-source authority', () => {
    expect(Core.validatePricingControl(control(), HOTEL_ID).room_rates[0].pricing_source)
      .toBe('property_default');
    const mismatched = control();
    mismatched.room_rates[0].pricing_source = 'base_nightly_rate';
    expect(() => Core.validatePricingControl(mismatched, HOTEL_ID)).toThrow(/pricing-source authority/i);
    const smuggled = control();
    smuggled.property.browser_price = 1;
    expect(() => Core.validatePricingControl(smuggled, HOTEL_ID)).toThrow(/property snapshot/i);

    const missingRoomBasis = control();
    delete missingRoomBasis.room_types[0].active_unit_count;
    expect(() => Core.validatePricingControl(missingRoomBasis, HOTEL_ID))
      .toThrow(/Room Type.*field envelope/i);
    const badRoomBasis = control();
    badRoomBasis.room_types[0].inventory_mode = 'browser_inventory';
    expect(() => Core.validatePricingControl(badRoomBasis, HOTEL_ID))
      .toThrow(/Room Type projection/i);
    const badBookingMode = control();
    badBookingMode.property.booking_mode = 'browser_mode';
    expect(() => Core.validatePricingControl(badBookingMode, HOTEL_ID))
      .toThrow(/property snapshot/i);
  });

  test('accepts deterministic PostgreSQL schedule-tier UUIDs without weakening parent identities or links', () => {
    const deterministicTierId = 'f6c679b1-c0d7-64c7-d0d1-4b898f285778';
    const propertyPartyTierId = '2aa13aac-b0c1-a4c5-7183-ddedd93dee57';
    const beforeActivation = scheduleTierControl(deterministicTierId);
    const sharedSchedule = beforeActivation.pricing_schedules[0];
    sharedSchedule.sharing_mode = 'shared';
    sharedSchedule.tiers = Array.from({ length: 27 }, (_unused, index) => ({
      ...sharedSchedule.tiers[0],
      id: index === 0
        ? deterministicTierId
        : `60000000-0000-6000-d000-${index.toString(16).padStart(12, '0')}`,
      guest_count: 2 + Math.floor(index / 9),
      threshold_nights: 2 + (index % 9),
    }));
    const partySchedule = structuredClone(manualSchedule());
    partySchedule.id = DEFAULT_ID;
    partySchedule.code = 'property-party-preview';
    partySchedule.application_scope = 'property_booking_party';
    partySchedule.maximum_party_size = 8;
    partySchedule.minimum_billable_occupancy = 2;
    partySchedule.linked_room_rate_ids = [];
    partySchedule.tiers = Array.from({ length: 63 }, (_unused, index) => ({
      ...partySchedule.tiers[0],
      id: index === 0
        ? propertyPartyTierId
        : `a0000000-0000-a000-7000-${index.toString(16).padStart(12, '0')}`,
      schedule_id: DEFAULT_ID,
      guest_count: 2 + Math.floor(index / 9),
      threshold_nights: 2 + (index % 9),
    }));
    beforeActivation.pricing_schedules.push(partySchedule);
    const normalized = Core.validatePricingControl(beforeActivation, HOTEL_ID);
    expect(normalized.pricing_schedules[0].tiers[0].id).toBe(deterministicTierId);
    expect(normalized.pricing_schedules[0].tiers).toHaveLength(27);
    expect(normalized.pricing_schedules[1].tiers).toHaveLength(63);
    expect(normalized.pricing_schedules[1].tiers[0].id).toBe(propertyPartyTierId);

    const afterActivation = structuredClone(beforeActivation);
    afterActivation.rate_plans[0].is_active = true;
    afterActivation.rate_plans[0].lifecycle_status = 'active';
    afterActivation.room_rates[0].is_active = true;
    afterActivation.room_rates[0].lifecycle_status = 'active';
    afterActivation.room_rates[0].base_nightly_rate = 100;
    afterActivation.pricing_schedules[0].is_active = true;
    afterActivation.pricing_schedules[0].lifecycle_status = 'active';
    expect(Core.validatePricingControl(afterActivation, HOTEL_ID)
      .pricing_schedules[0].tiers[0].id).toBe(deterministicTierId);

    const duplicate = scheduleTierControl(deterministicTierId);
    duplicate.pricing_schedules[0].tiers.push({
      ...duplicate.pricing_schedules[0].tiers[0], guest_count: 2,
    });
    expect(() => Core.validatePricingControl(duplicate, HOTEL_ID))
      .toThrow(/invalid schedule child or link relationship/i);

    for (const invalidTierId of [
      deterministicTierId.toUpperCase(),
      'f6c679b1-c0d7-64c7-d0d1-4b898f28577',
      'not-a-postgresql-uuid',
    ]) {
      expect(() => Core.validatePricingControl(scheduleTierControl(invalidTierId), HOTEL_ID))
        .toThrow(/invalid schedule child or link relationship/i);
    }

    const wrongParent = scheduleTierControl(deterministicTierId);
    wrongParent.pricing_schedules[0].tiers[0].schedule_id = DEFAULT_ID;
    expect(() => Core.validatePricingControl(wrongParent, HOTEL_ID))
      .toThrow(/invalid schedule child or link relationship/i);

    const foreignLink = scheduleTierControl(deterministicTierId);
    foreignLink.pricing_schedules[0].linked_room_rate_ids = [DEFAULT_ID];
    expect(() => Core.validatePricingControl(foreignLink, HOTEL_ID))
      .toThrow(/invalid schedule child or link relationship/i);

    const duplicateLink = scheduleTierControl(deterministicTierId);
    duplicateLink.pricing_schedules[0].linked_room_rate_ids = [RATE_ID, RATE_ID];
    expect(() => Core.validatePricingControl(duplicateLink, HOTEL_ID))
      .toThrow(/invalid schedule child or link relationship/i);

    const secondRateId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const independentMultiLink = scheduleTierControl(deterministicTierId);
    independentMultiLink.room_rates.push({
      ...structuredClone(independentMultiLink.room_rates[0]), id: secondRateId,
    });
    independentMultiLink.pricing_schedules[0].linked_room_rate_ids = [RATE_ID, secondRateId];
    expect(() => Core.validatePricingControl(independentMultiLink, HOTEL_ID))
      .toThrow(/invalid schedule child or link relationship/i);

    const nonRfcParent = scheduleTierControl(deterministicTierId);
    nonRfcParent.pricing_schedules[0].id = deterministicTierId;
    nonRfcParent.pricing_schedules[0].tiers[0].schedule_id = deterministicTierId;
    nonRfcParent.room_rates[0].pricing_schedule_id = deterministicTierId;
    expect(() => Core.validatePricingControl(nonRfcParent, HOTEL_ID))
      .toThrow(/row without an exact identifier|different property|missing product relationship/i);
  });

  test('keeps public pricing flags inert while accepting an authoritative External Calendar boolean', () => {
    const externalActive = control();
    externalActive.feature_flags.hotel_external_sync_enabled = true;
    expect(Core.validatePricingControl(externalActive, HOTEL_ID).feature_flags.hotel_external_sync_enabled).toBe(true);
    const unsafePublic = control();
    unsafePublic.feature_flags.hotel_stripe_connect_enabled = true;
    expect(() => Core.validatePricingControl(unsafePublic, HOTEL_ID)).toThrow('public Hotels V2 flags OFF');
    const malformed = control();
    malformed.feature_flags.hotel_external_sync_enabled = 'true';
    expect(() => Core.validatePricingControl(malformed, HOTEL_ID)).toThrow('feature-flag snapshot is invalid');
  });

  test('fails closed on frozen pricing snapshot and plan technical ceilings', () => {
    expect(Core.PRICING_CONTROL_READ_LIMITS).toEqual({
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
    const oversizedSnapshot = control();
    oversizedSnapshot.rate_plans = Array.from({ length: 201 }, () => ({
      ...oversizedSnapshot.rate_plans[0],
    }));
    expect(() => Core.validatePricingControl(oversizedSnapshot, HOTEL_ID))
      .toThrow(/technical capacity limit/i);

    const operation = Core.buildPricingControlOperation(control(false), 'property_pricing_default', {
      id: DEFAULT_ID, nightly_rate: 100, currency: 'EUR', lifecycle_status: 'draft',
    });
    const oversizedPlan = {
      contract_version: 'hotels_v2_admin_c_pricing_plan_v1', hotel_id: HOTEL_ID,
      snapshot_token: SNAPSHOT, reviewed_at: UPDATED_AT,
      operations: Array.from({ length: 101 }, () => operation),
    };
    expect(() => Core.validatePricingControlPlan(oversizedPlan))
      .toThrow(/exact-property pricing plan/i);
  });

  test('builds a reviewed property fallback without money/type coercion', () => {
    const source = control(false);
    const operation = Core.buildPricingControlOperation(source, 'property_pricing_default', {
      id: DEFAULT_ID,
      nightly_rate: 123.45,
      currency: 'EUR',
      lifecycle_status: 'draft',
    });
    expect(operation).toMatchObject({
      entity: 'property_pricing_default',
      action: 'create',
      expected_version: 0,
      payload: { hotel_id: HOTEL_ID, nightly_rate: 123.45, currency: 'EUR', lifecycle_status: 'draft' },
    });
    const reviewed = Core.buildPricingControlPlan(source, [operation], { reviewedAt: UPDATED_AT });
    expect(reviewed.snapshot_token).toBe(SNAPSHOT);
    expect(() => Core.buildPricingControlOperation(source, 'property_pricing_default', {
      id: DEFAULT_ID, nightly_rate: 123.456, currency: 'EUR', lifecycle_status: 'draft',
    })).toThrow(/invalid or coerced/i);
    expect(() => Core.validatePricingControlOperation({ ...operation, expected_version: '0' }))
      .toThrow(/exact reviewed operation envelope/i);
  });

  test('accepts 5000-character localized descriptions and rejects 5001', () => {
    const source = control(false);
    const draft = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'reviewed-plan',
      name_i18n: { pl: 'Plan', en: 'Plan', he: 'תכנית' },
      description_i18n: { pl: 'p'.repeat(5000), en: 'e'.repeat(5000), he: 'א'.repeat(5000) },
      meal_plan_code: null,
      cancellation_policy: { type: 'requires_review', reason: 'Commercial policy still requires review' },
      booking_mode_override: null,
      price_inclusions: [],
      lifecycle_status: 'draft',
      sort_order: 100,
    };
    expect(Core.buildPricingControlOperation(source, 'rate_plan', draft).payload.description_i18n.en)
      .toHaveLength(5000);
    expect(() => Core.buildPricingControlOperation(source, 'rate_plan', {
      ...draft,
      description_i18n: { ...draft.description_i18n, en: 'e'.repeat(5001) },
    })).toThrow(/invalid or coerced/i);
  });

  test('canonicalizes multiline Rate Plan descriptions without relaxing other content controls', () => {
    const source = control(false);
    const draft = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'multiline-plan',
      name_i18n: { pl: 'Plan', en: 'Plan', he: 'תכנית' },
      description_i18n: {
        pl: 'Pierwszy wiersz\nDrugi wiersz',
        en: 'First line\r\nSecond line\rThird line',
        he: 'שורה ראשונה\nשורה שנייה',
      },
      meal_plan_code: null,
      cancellation_policy: { type: 'requires_review', reason: 'Commercial policy still requires review' },
      booking_mode_override: null,
      price_inclusions: [],
      lifecycle_status: 'draft',
      sort_order: 100,
    };
    const operation = Core.buildPricingControlOperation(source, 'rate_plan', draft);
    expect(operation.payload.description_i18n.en).toBe('First line\nSecond line\nThird line');

    const canonicalResponse = control();
    canonicalResponse.rate_plans[0].description_i18n.en = 'First line\nSecond line';
    expect(Core.validatePricingControl(canonicalResponse, HOTEL_ID).rate_plans[0].description_i18n.en)
      .toBe('First line\nSecond line');
    expect(() => Core.buildPricingControlOperation(source, 'rate_plan', {
      ...draft, description_i18n: { ...draft.description_i18n, en: 'First\tSecond' },
    })).toThrow(/invalid or coerced/i);
    expect(() => Core.buildPricingControlOperation(source, 'rate_plan', {
      ...draft, name_i18n: { ...draft.name_i18n, en: 'First\nSecond' },
    })).toThrow(/invalid or coerced/i);
  });

  test('validates reviewed timestamps by exact calendar, clock and UTC-offset bounds', () => {
    const source = control(false);
    const target = {
      id: DEFAULT_ID,
      nightly_rate: 123.45,
      currency: 'EUR',
      lifecycle_status: 'draft',
    };
    const operation = Core.buildPricingControlOperation(
      source, 'property_pricing_default', target,
    );
    for (const reviewedAt of [
      '0001-01-01T00:00:00Z',
      '2000-02-29T23:59:59.123456Z',
      '2026-08-21T09:30:00+14:00',
      '2026-08-21T09:30:00-14:00',
      '2026-08-21T09:30:00+13:59',
    ]) {
      expect(Core.buildPricingControlPlan(source, [operation], { reviewedAt }).reviewed_at)
        .toBe(reviewedAt);
    }
    for (const reviewedAt of [
      '0000-01-01T00:00:00Z',
      '1900-02-29T00:00:00Z',
      '2026-02-30T12:00:00Z',
      '2026-08-21T24:00:00Z',
      '2026-08-21T23:60:00Z',
      '2026-08-21T23:59:60Z',
      '2026-08-21T09:30:00.1234567Z',
      '2026-08-21T09:30:00+14:01',
      '2026-08-21T09:30:00-14:01',
      '2026-08-21T09:30:00+15:00',
      '2026-08-21T09:30:00',
      '2026-08-21T09:30:00z',
    ]) {
      expect(() => Core.buildPricingControlPlan(source, [operation], { reviewedAt }))
        .toThrow(/reviewed exact-property pricing plan/i);
    }

    const impossibleServerTimestamp = control();
    impossibleServerTimestamp.property.updated_at = '2026-02-30T09:30:00Z';
    expect(() => Core.validatePricingControl(impossibleServerTimestamp, HOTEL_ID))
      .toThrow(/property snapshot is invalid/i);
  });

  test('rejects pricing content coercion before Review and preserves canonical server strings', () => {
    const source = control(false);
    const draft = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'reviewed-plan',
      name_i18n: { pl: 'Plan', en: 'Plan', he: 'תכנית' },
      description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
      meal_plan_code: null,
      cancellation_policy: { type: 'requires_review', reason: 'Commercial policy still requires review' },
      booking_mode_override: null,
      price_inclusions: ['cleaning', 'taxes'],
      lifecycle_status: 'draft',
      sort_order: 100,
    };
    for (const smuggled of [
      { ...draft, name_i18n: { ...draft.name_i18n, en: 123 } },
      { ...draft, name_i18n: { ...draft.name_i18n, en: { browser: 'Plan' } } },
      { ...draft, description_i18n: { ...draft.description_i18n, en: ' padded ' } },
      { ...draft, price_inclusions: ['taxes', 123] },
      { ...draft, price_inclusions: ['taxes', { code: 'cleaning' }] },
      { ...draft, price_inclusions: ['taxes', 'cleaning'] },
    ]) {
      expect(() => Core.buildPricingControlOperation(source, 'rate_plan', smuggled))
        .toThrow(/invalid or coerced/i);
    }

    const malformedResponse = control();
    malformedResponse.rate_plans[0].price_inclusions = ['taxes', 'cleaning'];
    expect(() => Core.validatePricingControl(malformedResponse, HOTEL_ID))
      .toThrow(/Rate Plan projection/i);

    for (const smuggled of [
      { ...draft, code: 123 },
      { ...draft, meal_plan_code: 123 },
    ]) {
      expect(() => Core.buildPricingControlOperation(source, 'rate_plan', smuggled))
        .toThrow(/invalid or coerced/i);
    }

    expect(() => Core.buildPricingControlOperation(source, 'allocation_rule', {
      ...allocationRule(), id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddde', code: 123,
      lifecycle_status: 'draft', version: 0,
    })).toThrow(/invalid or coerced/i);
    expect(() => Core.buildPricingControlOperation(source, 'exact_date_price', {
      id: EXACT_DATE_ID, hotel_id: HOTEL_ID, room_rate_id: RATE_ID,
      stay_date: '2026-09-10', nightly_rate_mode: 'set', nightly_rate: 110,
      minimum_stay_mode: null, minimum_stay: null,
      maximum_stay_mode: null, maximum_stay: null,
      reason: { browser: 'override' }, expires_at: null,
    })).toThrow(/invalid or coerced/i);

    const schedule = manualSchedule();
    const scheduleControl = control();
    scheduleControl.pricing_schedules = [schedule];
    expect(() => Core.buildPricingScheduleCloneOperation(scheduleControl, schedule, {
      id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddde', code: 'exact-boolean-clone',
      name_i18n: { pl: 'Kopia', en: 'Copy', he: 'עותק' }, sharing_mode: 'independent',
      tiers: schedule.tiers.map((tier: any) => ({ ...tier, is_active: 'false' })),
    })).toThrow(/exact reviewed boolean/i);

    const rule = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', hotel_id: HOTEL_ID,
      room_rate_id: RATE_ID, valid_from: '2026-09-01', valid_to: '2026-09-30',
      weekdays: [1], nightly_rate: 120, minimum_stay: null, maximum_stay: null,
      closed_to_arrival: false, closed_to_departure: false, priority: 10,
      is_active: true, source: 'manual', version: 1, updated_at: UPDATED_AT,
      immutable_contract: null,
    };
    expect(() => Core.buildPricingControlOperation(source, 'rate_rule', {
      ...rule, closed_to_arrival: 'false',
    }, rule)).toThrow(/invalid or coerced/i);
  });

  test('binds schedule clones to exact unique codes and uncoerced localized names', () => {
    const source = control();
    const schedule = manualSchedule();
    source.pricing_schedules = [schedule];
    const targetId = 'dddddddd-dddd-4ddd-8ddd-ddddddddddde';
    const targetTiers = schedule.tiers.map((tier: any) => ({
      ...tier, id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddf',
      schedule_id: targetId, version: 0,
    }));
    const values = {
      id: targetId, code: 'manual-schedule-copy',
      name_i18n: { pl: 'Kopia', en: 'Copy', he: 'עותק' },
      sharing_mode: 'shared', tiers: targetTiers,
    };
    expect(Core.buildPricingScheduleCloneOperation(source, schedule, values).payload.code)
      .toBe('manual-schedule-copy');
    expect(() => Core.buildPricingScheduleCloneOperation(source, schedule, {
      ...values, code: schedule.code,
    })).toThrow(/already exists/i);
    expect(() => Core.buildPricingScheduleCloneOperation(source, schedule, {
      ...values, name_i18n: { ...values.name_i18n, en: 123 },
    })).toThrow(/invalid or coerced/i);
    expect(() => Core.buildPricingScheduleCloneOperation(source, schedule, {
      ...values, id: 'not-a-uuid',
    })).toThrow(/invalid supplied ID/i);
    expect(() => Core.buildPricingScheduleCloneOperation(source, schedule, {
      ...values, code: 123,
    })).toThrow(/exact lowercase reviewed string/i);

    const generated = Core.buildPricingScheduleCloneOperation(source, schedule, {
      code: 'generated-target', name_i18n: values.name_i18n,
      sharing_mode: 'shared', tiers: schedule.tiers.map((tier: any) => ({
        ...tier, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', version: 0,
      })),
    });
    expect(generated.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(generated.payload.tiers[0].schedule_id).toBe(generated.id);
  });

  test('uses the exact custom-cancellation envelope required by SQL', () => {
    const source = control(false);
    const draft = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', code: 'custom-plan',
      name_i18n: { pl: 'Plan', en: 'Plan', he: 'תכנית' },
      description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
      meal_plan_code: null,
      cancellation_policy: { type: 'custom', deadline_hours: 24, penalty_mode: 'none' },
      booking_mode_override: null, price_inclusions: [], lifecycle_status: 'draft',
      sort_order: 100,
    };
    expect(Core.buildPricingControlOperation(source, 'rate_plan', draft)
      .payload.cancellation_policy).toEqual(draft.cancellation_policy);
    expect(() => Core.buildPricingControlOperation(source, 'rate_plan', {
      ...draft,
      cancellation_policy: { ...draft.cancellation_policy, penalty_value: null },
    })).toThrow(/invalid or coerced/i);
  });

  test('never replaces explicitly malformed entity or child identifiers', () => {
    const source = control(false);
    expect(() => Core.buildPricingControlOperation(source, 'property_pricing_default', {
      id: 'not-a-uuid', nightly_rate: 100, currency: 'EUR', lifecycle_status: 'draft',
    })).toThrow(/invalid supplied ID/i);
    expect(() => Core.buildPricingControlOperation(source, 'room_rate_tier_set', {
      ...source.room_rates[0], independent_tiers: [{
        id: 'not-a-uuid', hotel_id: HOTEL_ID, room_rate_id: RATE_ID,
        guest_count: 1, threshold_nights: 1, nightly_rate: 100,
        is_active: true, version: 0,
      }],
    }, source.room_rates[0])).toThrow(/invalid supplied ID/i);
    expect(() => Core.buildPricingControlOperation(source, 'room_rate', {
      ...source.room_rates[0], pricing_schedule_id: 'not-a-uuid',
    }, source.room_rates[0])).toThrow(/invalid or coerced/i);
  });

  test('requires dedicated disable actions for every lifecycle entity and enabled rules', () => {
    const source = control();
    source.pricing_schedules = [manualSchedule()];
    source.allocation_rules = [allocationRule()];
    const rows: Array<[string, any]> = [
      ['rate_plan', source.rate_plans[0]],
      ['room_rate', source.room_rates[0]],
      ['pricing_schedule', source.pricing_schedules[0]],
      ['allocation_rule', source.allocation_rules[0]],
      ['property_pricing_default', source.property_pricing_default],
    ];
    Core.validatePricingControl(source, HOTEL_ID);
    for (const [entity, row] of rows) {
      expect(() => Core.buildPricingControlOperation(
        source, entity, { ...row, lifecycle_status: 'disabled' }, row,
      )).toThrow(/dedicated disable/i);
      const operation = Core.buildPricingControlOperation(
        source, entity, { ...row, lifecycle_status: 'disabled' }, row,
        { action: 'disable' },
      );
      expect(operation.action).toBe('disable');
      expect(operation.payload).toEqual({});
    }

    const manualRule = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', hotel_id: HOTEL_ID,
      room_rate_id: RATE_ID, valid_from: '2026-09-01', valid_to: '2026-09-30',
      weekdays: [1, 2, 3, 4, 5, 6, 7], nightly_rate: 120,
      minimum_stay: null, maximum_stay: null, closed_to_arrival: false,
      closed_to_departure: false, priority: 10, is_active: true, source: 'manual',
      version: 1, updated_at: UPDATED_AT, immutable_contract: null,
    };
    source.rate_rules = [manualRule];
    expect(() => Core.buildPricingControlOperation(
      source, 'rate_rule', { ...manualRule, is_active: false }, manualRule,
    )).toThrow(/dedicated disable/i);
    expect(Core.buildPricingControlOperation(
      source, 'rate_rule', { ...manualRule, is_active: false }, manualRule,
      { action: 'disable' },
    )).toMatchObject({ action: 'disable', payload: {} });
  });

  test('keeps the exact Rate Rule parent immutable after create', () => {
    const source = control();
    const manualRule = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', hotel_id: HOTEL_ID,
      room_rate_id: RATE_ID, valid_from: '2026-09-01', valid_to: '2026-09-30',
      weekdays: [1, 2, 3, 4, 5, 6, 7], nightly_rate: 120,
      minimum_stay: null, maximum_stay: null, closed_to_arrival: false,
      closed_to_departure: false, priority: 10, is_active: true, source: 'manual',
      version: 1, updated_at: UPDATED_AT, immutable_contract: null,
    };
    source.rate_rules = [manualRule];
    expect(() => Core.buildPricingControlOperation(
      source,
      'rate_rule',
      { ...manualRule, room_rate_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
      manualRule,
    )).toThrow(/cannot be moved to another Room Rate/i);
  });

  test('enforces the 365-night technical preview horizon without confusing business stay bounds', () => {
    expect(Core.validatePricingPreviewRequest(previewRequest('2026-01-01', '2027-01-01')).check_out)
      .toBe('2027-01-01');
    expect(() => Core.validatePricingPreviewRequest(previewRequest('2026-01-01', '2027-01-02')))
      .toThrow(/valid exact-property/i);
    expect(() => Core.validatePricingPreviewRequest({ ...previewRequest(), child_ages: '12' }))
      .toThrow(/valid exact-property/i);
  });

  test('binds exact preview relationships, seven-layer precedence and arithmetic', () => {
    const request = Core.validatePricingPreviewRequest(previewRequest());
    expect(Core.validatePricingPreview(successfulPreview(), request).customer_total).toBe(100);
    const scheduleTier = successfulPreview();
    scheduleTier.products[0].base_pricing_source = 'pricing_schedule_tier';
    scheduleTier.products[0].base_pricing_source_id = 'f6c679b1-c0d7-64c7-d0d1-4b898f285778';
    scheduleTier.nightly_breakdown[0].base_pricing_source = 'pricing_schedule_tier';
    scheduleTier.nightly_breakdown[0].base_pricing_source_id = 'f6c679b1-c0d7-64c7-d0d1-4b898f285778';
    scheduleTier.nightly_breakdown[0].final_pricing_source = 'pricing_schedule_tier';
    expect(Core.validatePricingPreview(scheduleTier, request).products[0].base_pricing_source_id)
      .toBe('f6c679b1-c0d7-64c7-d0d1-4b898f285778');
    const uppercaseTier = structuredClone(scheduleTier);
    uppercaseTier.products[0].base_pricing_source_id = uppercaseTier.products[0].base_pricing_source_id.toUpperCase();
    expect(() => Core.validatePricingPreview(uppercaseTier, request)).toThrow(/unexpected or unsafe/i);
    const malformedTier = structuredClone(scheduleTier);
    malformedTier.nightly_breakdown[0].base_pricing_source_id = 'legacy-tier-2-2';
    expect(() => Core.validatePricingPreview(malformedTier, request)).toThrow(/unexpected or unsafe/i);
    const unrelatedTier = structuredClone(scheduleTier);
    unrelatedTier.nightly_breakdown[0].base_pricing_source_id = '2aa13aac-b0c1-a4c5-7183-ddedd93dee57';
    expect(() => Core.validatePricingPreview(unrelatedTier, request)).toThrow(/unrelated nightly price/i);
    const emptySuccess = successfulPreview();
    emptySuccess.allocation = [];
    emptySuccess.products = [];
    emptySuccess.nightly_breakdown = [];
    emptySuccess.customer_total = 0;
    expect(() => Core.validatePricingPreview(emptySuccess, request)).toThrow(/inconsistent/i);
    const smuggled = successfulPreview();
    smuggled.products[0].browser_commission = 10;
    expect(() => Core.validatePricingPreview(smuggled, request)).toThrow(/unexpected or unsafe/i);
    const wrongPrecedence = successfulPreview();
    wrongPrecedence.pricing_precedence.reverse();
    expect(() => Core.validatePricingPreview(wrongPrecedence, request)).toThrow(/unexpected or unsafe/i);
  });

  test('accepts sanitized historical activity and rejects historical state disclosure', () => {
    const historical = {
      id: ACTIVITY_ID,
      entity_type: 'calendar_override',
      entity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      action: 'delete',
      correlation_id: CORRELATION_ID,
      actor_type: 'admin',
      actor_id: ACTOR_ID,
      source: 'historical_pricing_activity',
      created_at: UPDATED_AT,
      before_state: null,
      after_state: null,
    };
    const safe = control();
    safe.recent_activity = [historical];
    expect(Core.validatePricingControl(safe, HOTEL_ID).recent_activity).toHaveLength(1);
    const leaked = control();
    leaked.recent_activity = [{ ...historical, before_state: { customer_email: 'hidden@example.test' } }];
    expect(() => Core.validatePricingControl(leaked, HOTEL_ID)).toThrow(/activity projection/i);
  });

  test('requires exact ADMIN-C activity state envelopes and admin identity', () => {
    const activity = {
      id: ACTIVITY_ID,
      entity_type: 'property_pricing_default',
      entity_id: DEFAULT_ID,
      action: 'update',
      correlation_id: CORRELATION_ID,
      actor_type: 'admin',
      actor_id: ACTOR_ID,
      source: 'hotels_v2_admin_c_pricing_control',
      created_at: UPDATED_AT,
      before_state: { nightly_rate: 90, currency: 'EUR', lifecycle_status: 'inactive' },
      after_state: { nightly_rate: 100, currency: 'EUR', lifecycle_status: 'active' },
    };
    const safe = control();
    safe.recent_activity = [activity];
    expect(Core.validatePricingControl(safe, HOTEL_ID).recent_activity[0].actor_type).toBe('admin');
    const smuggled = control();
    smuggled.recent_activity = [{
      ...activity,
      after_state: { ...activity.after_state, commission: 10 },
    }];
    expect(() => Core.validatePricingControl(smuggled, HOTEL_ID)).toThrow(/activity projection/i);
  });

  test('deep-validates nested ADMIN-C activity without commission, payment, locale or tier smuggling', () => {
    const planState = {
      code: 'standard',
      name_i18n: { pl: 'Standard', en: 'Standard', he: 'סטנדרט' },
      description_i18n: { pl: 'Opis', en: 'Description', he: 'תיאור' },
      meal_plan_code: null,
      cancellation_policy: { type: 'flexible' },
      booking_mode_override: null,
      price_inclusions: [],
      lifecycle_status: 'inactive',
      sort_order: 100,
    };
    const baseActivity = {
      id: ACTIVITY_ID, entity_type: 'rate_plan', entity_id: PLAN_ID, action: 'update',
      correlation_id: CORRELATION_ID, actor_type: 'admin', actor_id: ACTOR_ID,
      source: 'hotels_v2_admin_c_pricing_control', created_at: UPDATED_AT,
      before_state: planState, after_state: planState,
    };
    const safe = control();
    safe.recent_activity = [baseActivity];
    expect(Core.validatePricingControl(safe, HOTEL_ID).recent_activity).toHaveLength(1);

    for (const afterState of [
      { ...planState, cancellation_policy: { type: 'flexible', commission: 10 } },
      { ...planState, cancellation_policy: { type: 'flexible', payment_policy: 'browser' } },
      { ...planState, name_i18n: { ...planState.name_i18n, de: 'Geschmuggelt' } },
    ]) {
      const attack = control();
      attack.recent_activity = [{ ...baseActivity, after_state: afterState }];
      expect(() => Core.validatePricingControl(attack, HOTEL_ID)).toThrow(/activity projection/i);
    }

    const scheduleBefore = {
      code: 'manual-schedule',
      name_i18n: { pl: 'Cennik', en: 'Schedule', he: 'תעריף' },
      application_scope: 'room_occupancy', currency: 'EUR', maximum_party_size: 2,
      minimum_billable_occupancy: 1, sharing_mode: 'independent',
      lifecycle_status: 'inactive',
      tiers: [{ id: SCHEDULE_TIER_ID, schedule_id: SCHEDULE_ID, guest_count: 1,
        threshold_nights: 1, nightly_rate: 100, is_active: true, version: 1 }],
    };
    const scheduleActivity = {
      ...baseActivity, entity_type: 'pricing_schedule', entity_id: SCHEDULE_ID,
      before_state: scheduleBefore,
      after_state: { ...scheduleBefore, tiers: undefined, tiers_fingerprint: MD5 },
    };
    delete scheduleActivity.after_state.tiers;
    const scheduleSafe = control();
    scheduleSafe.recent_activity = [scheduleActivity];
    expect(Core.validatePricingControl(scheduleSafe, HOTEL_ID).recent_activity).toHaveLength(1);
    const tierAttack = control();
    tierAttack.recent_activity = [{
      ...scheduleActivity,
      before_state: {
        ...scheduleBefore,
        tiers: [{ ...scheduleBefore.tiers[0], platform_commission: 10 }],
      },
    }];
    expect(() => Core.validatePricingControl(tierAttack, HOTEL_ID)).toThrow(/activity projection/i);
  });

  test('separates exact pricing provenance from a shared operational Calendar row', () => {
    const closureOnly = {
      id: EXACT_DATE_ID,
      hotel_id: HOTEL_ID,
      room_rate_id: RATE_ID,
      stay_date: '2026-09-01',
      nightly_rate: null,
      nightly_rate_mode: null,
      minimum_stay: null,
      minimum_stay_mode: null,
      maximum_stay: null,
      maximum_stay_mode: null,
      pricing_active: false,
      pricing_source: null,
      pricing_reason: null,
      pricing_expires_at: null,
      pricing_actor_type: null,
      pricing_actor_id: null,
      pricing_updated_at: null,
      pricing_correlation_id: null,
      shared_with_calendar: true,
      pricing_configured: false,
      version: 3,
      updated_at: UPDATED_AT,
      immutable_contract: null,
    };
    const source = control();
    source.exact_date_prices = [closureOnly];
    expect(Core.validatePricingControl(source, HOTEL_ID).exact_date_prices[0].pricing_source).toBeNull();

    const target = {
      ...closureOnly,
      nightly_rate_mode: 'set', nightly_rate: 125,
      reason: 'Reviewed festival price', expires_at: '2026-09-02T00:00:00.000Z',
    };
    const operation = Core.buildPricingControlOperation(
      source, 'exact_date_price', target, closureOnly,
    );
    expect(operation.expected_original).toEqual({
      nightly_rate_mode: null, nightly_rate: null,
      minimum_stay_mode: null, minimum_stay: null,
      maximum_stay_mode: null, maximum_stay: null,
      reason: null, expires_at: null,
    });
    expect(operation.payload).toMatchObject({
      nightly_rate_mode: 'set', nightly_rate: 125,
      reason: 'Reviewed festival price', expires_at: '2026-09-02T00:00:00.000Z',
    });

    const configured = {
      ...closureOnly,
      nightly_rate_mode: 'set', nightly_rate: 125,
      pricing_active: true, pricing_configured: true,
      pricing_source: 'manual', pricing_reason: 'Reviewed festival price',
      pricing_expires_at: '2026-09-02T00:00:00.000Z',
      pricing_actor_type: 'admin', pricing_actor_id: ACTOR_ID,
      pricing_updated_at: UPDATED_AT, pricing_correlation_id: CORRELATION_ID,
    };
    const configuredControl = control();
    configuredControl.exact_date_prices = [configured];
    expect(Core.validatePricingControl(configuredControl, HOTEL_ID).exact_date_prices[0].pricing_reason)
      .toBe('Reviewed festival price');
    const smuggled = control();
    smuggled.exact_date_prices = [{ ...configured, source: 'calendar-provider' }];
    expect(() => Core.validatePricingControl(smuggled, HOTEL_ID)).toThrow(/field envelope/i);
  });

  test('accepts only the exact immutable legacy exact-price provenance marker', () => {
    const legacy = {
      id: EXACT_DATE_ID, hotel_id: HOTEL_ID, room_rate_id: RATE_ID,
      stay_date: '2026-09-01', nightly_rate: 125, nightly_rate_mode: 'set',
      minimum_stay: null, minimum_stay_mode: null,
      maximum_stay: null, maximum_stay_mode: null,
      pricing_active: true, pricing_source: 'legacy_preview',
      pricing_reason: 'Legacy pricing override (read-only; original reason retained server-side)',
      pricing_expires_at: null, pricing_actor_type: 'admin', pricing_actor_id: ACTOR_ID,
      pricing_updated_at: UPDATED_AT, pricing_correlation_id: null,
      shared_with_calendar: false, pricing_configured: true, version: 3,
      updated_at: UPDATED_AT,
      immutable_contract: {
        locked: true,
        contract_version: 'pre_admin_c_calendar_pricing_v1',
        reason: 'legacy_exact_pricing_read_only',
      },
    };
    const safe = control();
    safe.exact_date_prices = [legacy];
    expect(Core.validatePricingControl(safe, HOTEL_ID).exact_date_prices[0].pricing_source)
      .toBe('legacy_preview');
    expect(() => Core.buildPricingControlOperation(
      safe, 'exact_date_price', { ...legacy, nightly_rate: 130 }, legacy,
    )).toThrow(/read-only/i);
    const unlocked = control();
    unlocked.exact_date_prices = [{ ...legacy, immutable_contract: null }];
    expect(() => Core.validatePricingControl(unlocked, HOTEL_ID)).toThrow(/provenance/i);
  });

  test('accepts unconfigured and configured exact-price ADMIN-C activity round trips', () => {
    const emptyState = {
      nightly_rate_mode: null, nightly_rate: null,
      minimum_stay_mode: null, minimum_stay: null,
      maximum_stay_mode: null, maximum_stay: null,
      reason: null, expires_at: null, pricing_source: null,
      pricing_actor_type: null, pricing_actor_id: null,
      pricing_updated_at: null, pricing_correlation_id: null,
    };
    const configuredState = {
      ...emptyState, nightly_rate_mode: 'set', nightly_rate: 125,
      reason: 'Reviewed event price', pricing_source: 'manual',
      pricing_actor_type: 'admin', pricing_actor_id: ACTOR_ID,
      pricing_updated_at: UPDATED_AT, pricing_correlation_id: CORRELATION_ID,
    };
    const activity = {
      id: ACTIVITY_ID, entity_type: 'calendar_override', entity_id: EXACT_DATE_ID,
      action: 'update', correlation_id: CORRELATION_ID, actor_type: 'admin',
      actor_id: ACTOR_ID, source: 'hotels_v2_admin_c_pricing_control',
      created_at: UPDATED_AT, before_state: emptyState, after_state: configuredState,
    };
    const addedToShared = control();
    addedToShared.recent_activity = [activity];
    expect(Core.validatePricingControl(addedToShared, HOTEL_ID).recent_activity).toHaveLength(1);
    const clearedFromShared = control();
    clearedFromShared.recent_activity = [{
      ...activity, action: 'disable', before_state: configuredState, after_state: emptyState,
    }];
    expect(Core.validatePricingControl(clearedFromShared, HOTEL_ID).recent_activity).toHaveLength(1);
  });

  test('requires sanitized schedule provenance and immutable nonmanual tier sources', () => {
    const source = control();
    source.pricing_schedules = [{
      id: SCHEDULE_ID, hotel_id: HOTEL_ID, code: 'legacy-preview',
      name_i18n: { pl: 'Podgląd', en: 'Preview', he: 'תצוגה' },
      application_scope: 'room_occupancy', currency: 'EUR', maximum_party_size: 2,
      minimum_billable_occupancy: 1, is_active: false, review_status: 'reviewed',
      lifecycle_status: 'inactive', source: 'legacy_preview', source_reference: {
        kind: 'legacy_preview', cloned_from_schedule_id: null, pricing_model: 'occupancy_los',
        pricing_fingerprint: MD5, rule_count: 1, guest_counts: [1, 2],
        migration_blocker: 'reviewed_source_only',
      },
      version: 1, updated_at: UPDATED_AT, linked_room_rate_ids: [],
      link_fingerprint: MD5, sharing_mode: 'shared',
      tiers: [{ id: SCHEDULE_TIER_ID, schedule_id: SCHEDULE_ID, guest_count: 1,
        threshold_nights: 1, nightly_rate: 100, is_active: true, version: 1,
        updated_at: UPDATED_AT }],
      tiers_fingerprint: MD5,
      immutable_contract: { locked: true, contract_version: 'pricing_source_provenance_v1', reason: 'nonmanual_source_read_only' },
      activation_blockers: ['nonmanual_source_read_only'],
    }];
    expect(Core.validatePricingControl(source, HOTEL_ID).pricing_schedules[0].source)
      .toBe('legacy_preview');
    const secret = control();
    secret.pricing_schedules = [{ ...source.pricing_schedules[0], source_reference: {
      ...source.pricing_schedules[0].source_reference, api_secret: 'must-not-pass',
    } }];
    expect(() => Core.validatePricingControl(secret, HOTEL_ID)).toThrow(/schedule projection/i);

    const tierSource = control(false);
    tierSource.room_rates[0].pricing_source = 'independent_tiers';
    tierSource.room_rates[0].independent_tiers = [{
      id: SCHEDULE_TIER_ID, hotel_id: HOTEL_ID, room_rate_id: RATE_ID,
      guest_count: 1, threshold_nights: 1, nightly_rate: 100, is_active: true,
      source: 'system', immutable_contract: { locked: true,
        contract_version: 'pricing_source_provenance_v1', reason: 'nonmanual_source_read_only' },
      version: 1, updated_at: UPDATED_AT,
    }];
    expect(Core.validatePricingControl(tierSource, HOTEL_ID).room_rates[0].independent_tiers[0].source)
      .toBe('system');
    expect(() => Core.buildPricingControlOperation(
      tierSource, 'room_rate_tier_set', tierSource.room_rates[0], tierSource.room_rates[0],
    )).toThrow(/read-only/i);
  });
});
