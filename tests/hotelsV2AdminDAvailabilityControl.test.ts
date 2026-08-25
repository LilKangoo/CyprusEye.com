import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const PLAN_ID = '33333333-3333-4333-8333-333333333333';
const RATE_ID = '44444444-4444-4444-8444-444444444444';
const UNIT_ID = '55555555-5555-4555-8555-555555555555';
const HOLD_ID = '66666666-6666-4666-8666-666666666666';
const ACTIVITY_ID = '77777777-7777-4777-8777-777777777777';
const CORRELATION_ID = '88888888-8888-4888-8888-888888888888';
const OPERATION_ID = '99999999-9999-4999-8999-999999999999';
const DEFAULT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
const ALLOCATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CANONICAL_DAILY_ID = 'b25d21d6-a02f-595f-8636-80b6a3e78526';
const UPDATED_AT = '2026-08-24T12:00:00.000Z';

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

function control(): any {
  return {
    contract_version: 'hotels_v2_admin_d_availability_control_v1',
    hotel_id: HOTEL_ID,
    from: '2026-09-01',
    to: '2026-09-01',
    snapshot_token: 'a'.repeat(64),
    snapshot_as_of: UPDATED_AT,
    snapshot_valid_until: null,
    property: {
      id: HOTEL_ID,
      name_i18n: { pl: 'Kalendarz', en: 'Calendar', he: 'לוח שנה' },
      architecture_version: 'legacy',
      timezone: 'Europe/Nicosia',
      currency: 'EUR',
      booking_mode: 'request_confirmation',
      minimum_stay_nights: 2,
      maximum_stay_nights: null,
      updated_at: UPDATED_AT,
    },
    room_types: [{
      id: ROOM_ID,
      hotel_id: HOTEL_ID,
      code: 'upper',
      name_i18n: { pl: 'Kalendarz', en: 'Calendar', he: 'לוח שנה' },
      inventory_mode: 'unitized',
      base_inventory_count: 0,
      status: 'active',
      sort_order: 10,
      max_occupancy: 4,
      capacity_adults: null,
      capacity_children: null,
      version: 3,
      updated_at: UPDATED_AT,
    }],
    room_rates: [{
      id: RATE_ID,
      hotel_id: HOTEL_ID,
      room_type_id: ROOM_ID,
      rate_plan_id: PLAN_ID,
      is_active: false,
      review_status: 'reviewed',
      sort_order: 10,
      version: 2,
      updated_at: UPDATED_AT,
    }],
    units: [{
      id: UNIT_ID,
      room_type_id: ROOM_ID,
      code: 'upper-1',
      name_i18n: { pl: 'Górny 1', en: 'Upper 1', he: 'עליון 1' },
      status: 'active',
      version: 1,
      updated_at: UPDATED_AT,
    }],
    cells: [{
      room_type_id: ROOM_ID,
      stay_date: '2026-09-01',
      inventory_mode: 'unitized',
      physical_capacity: 1,
      configured_sellable_units: 1,
      blocked_unit_count: 0,
      blocked_unit_ids: [],
      operational_closed: false,
      safety_closed: false,
      held_units: 1,
      booked_units: 0,
      committed_units: 1,
      available_units: 0,
      requestable: false,
      blocking_reasons: ['inventory_exhausted', 'public_activation_off'],
      earliest_hold_expiry: '2026-09-01T10:00:00.000Z',
      provenance: { capacity: 'room_type_or_active_units', inventory: 'hotel_daily_inventory', commitments: 'server_authoritative' },
      inventory_version: 0,
    }],
    product_cells: [{
      room_type_id: ROOM_ID,
      room_rate_id: RATE_ID,
      rate_plan_id: PLAN_ID,
      stay_date: '2026-09-01',
      operational_closed: false,
      closed_to_arrival: false,
      closed_to_departure: false,
      safety_closed: false,
      requestable: false,
      blocking_reasons: ['room_rate_inactive', 'public_activation_off'],
      provenance: { exact_override_id: null, daily_rate: false, availability_version: null },
    }],
    daily_inventory: [],
    unit_calendar_blocks: [],
    operational_overrides: [],
    rate_rule_operational_restrictions: [],
    booking_allocations: [],
    holds: [{
      id: HOLD_ID,
      status: 'active',
      expires_at: '2026-09-01T10:00:00.000Z',
      active_commitment_from: '2026-09-01',
      active_commitment_to: '2026-09-01',
      version: 1,
      created_at: UPDATED_AT,
      updated_at: UPDATED_AT,
      commitments: [{ room_type_id: ROOM_ID, stay_date: '2026-09-01', unit_id: UNIT_ID, units: 1, status: 'active' }],
    }],
    unmapped_booking_blockers: [],
    recent_activity: [{
      id: ACTIVITY_ID,
      entity_type: 'inventory_hold',
      entity_id: HOLD_ID,
      action: 'create',
      before_state: null,
      after_state: { fingerprint: 'b'.repeat(64), redacted: true },
      actor_type: 'system',
      source: 'hotels_v2_admin_d_availability_control',
      correlation_id: CORRELATION_ID,
      created_at: UPDATED_AT,
    }],
    public_change: false,
  };
}

function pricingPreview(): any {
  return {
    contract_version: 'hotels_v2_admin_c_pricing_preview_v1', hotel_id: HOTEL_ID,
    snapshot_token: 'f'.repeat(64), ok: true, requestable: false, blocking_reasons: [],
    currency: 'EUR', check_in: '2026-09-01', check_out: '2026-09-02', nights: 1,
    adults: 2, child_ages: [], guest_count: 2,
    allocation: [{
      allocation_rule_id: ALLOCATION_ID, allocation_mode: 'required_bundle', room_type_id: ROOM_ID,
      units_required: 1, allocated_guest_count: 2, pricing_guest_count: 2,
      allocated_guest_counts: [2], pricing_guest_counts: [2],
    }],
    products: [{
      room_type_id: ROOM_ID, room_rate_id: RATE_ID, rate_plan_id: PLAN_ID, unit_sequence: 1,
      allocated_guest_count: 2, requested_pricing_guest_count: 2, resolved_pricing_guest_count: 2,
      minimum_billable_occupancy: 2, base_pricing_source: 'property_default',
      base_pricing_source_id: DEFAULT_ID, los_threshold_nights: null, subtotal: 100,
      currency: 'EUR', booking_mode: 'request_confirmation', cancellation_policy: { type: 'flexible' },
      price_inclusions: [], effective_minimum_stay: 1, effective_maximum_stay: null, stay_allowed: true,
    }],
    nightly_breakdown: [{
      stay_date: '2026-09-01', room_type_id: ROOM_ID, room_rate_id: RATE_ID,
      rate_plan_id: PLAN_ID, unit_sequence: 1, allocated_guest_count: 2,
      requested_pricing_guest_count: 2, resolved_pricing_guest_count: 2,
      minimum_billable_occupancy: 2, base_pricing_source: 'property_default',
      base_pricing_source_id: DEFAULT_ID, los_threshold_nights: null, weekday_rule_id: null,
      seasonal_range_rule_id: null, exact_date_price_id: null, final_pricing_source: 'property_default',
      nightly_rate: 100, currency: 'EUR', effective_minimum_stay: 1, effective_maximum_stay: null,
      minimum_stay_source: 'property', minimum_stay_source_id: HOTEL_ID,
      maximum_stay_source: null, maximum_stay_source_id: null,
    }],
    customer_total: 100,
    pricing_precedence: ['exact_date_price', 'seasonal_range_rule', 'weekday_rule',
      'pricing_schedule_tier', 'independent_occupancy_tier', 'room_rate_base_nightly_rate', 'property_default'],
    legacy_authoritative: false, public_change: false,
  };
}

function stayProduct(stayDate: string): any {
  return {
    room_type_id: ROOM_ID, room_rate_id: RATE_ID, rate_plan_id: PLAN_ID, stay_date: stayDate,
    operational_closed: false, closed_to_arrival: false, closed_to_departure: false,
    safety_closed: false, requestable: false, blocking_reasons: ['public_activation_off'],
    provenance: { exact_override_id: null, daily_rate: false, availability_version: null },
  };
}

function stayPreview(): any {
  return {
    contract_version: 'hotels_v2_admin_d_available_stay_preview_v1', hotel_id: HOTEL_ID,
    pricing: pricingPreview(),
    availability: {
      snapshot_token: 'a'.repeat(64), requested_units: 1, available_for_stay: true,
      rooms: [{
        room_type_id: ROOM_ID, room_rate_id: RATE_ID, rate_plan_id: PLAN_ID, unit_sequence: 1,
        requestable: false, blocking_reasons: ['public_activation_off'],
        departure_boundary_product: stayProduct('2026-09-02'),
        nights: [{
          room_type_id: ROOM_ID, stay_date: '2026-09-01', inventory_mode: 'pooled',
          physical_capacity: 1, configured_sellable_units: 1, blocked_unit_count: 0,
          blocked_unit_ids: [], operational_closed: false, safety_closed: false,
          held_units: 0, booked_units: 0, committed_units: 0, available_units: 1,
          requestable: false, blocking_reasons: ['public_activation_off'], earliest_hold_expiry: null,
          provenance: { capacity: 'room_type_or_active_units', inventory: 'hotel_daily_inventory', commitments: 'server_authoritative' },
          inventory_version: 0, product: stayProduct('2026-09-01'),
        }],
      }],
    },
    ok: true, requestable: false, blocking_reasons: ['public_activation_off'],
    configuration_fingerprint: 'e'.repeat(64), public_change: false,
  };
}

describe('Hotels V2 ADMIN-D strict availability control DTO', () => {
  test('accepts exact room and product cells without rewriting authored names', () => {
    const normalized = Core.normalizeAvailabilityControl(control());
    expect(normalized.property.name_i18n.en).toBe('Calendar');
    expect(normalized.room_types[0].name_i18n).toEqual({ pl: 'Kalendarz', en: 'Calendar', he: 'לוח שנה' });
    expect(normalized.cells[0]).toMatchObject({ committed_units: 1, available_units: 0, requestable: false });
    expect(normalized.product_cells[0]).toMatchObject({ room_rate_id: RATE_ID, rate_plan_id: PLAN_ID });
  });

  test.each([
    ['ADMIN-C price-only exact row', {
      closed: null, closed_mode: null, closed_to_arrival: null,
      closed_to_arrival_mode: null, closed_to_departure: null, closed_to_departure_mode: null,
    }],
    ['CTA-only exact row', {
      closed: null, closed_mode: null, closed_to_arrival: true,
      closed_to_arrival_mode: 'set', closed_to_departure: null, closed_to_departure_mode: null,
    }],
  ])('accepts %s without fabricating availability modes', (_label, fields) => {
    const value = control();
    value.operational_overrides = [{
      id: OPERATION_ID, hotel_id: HOTEL_ID, room_rate_id: RATE_ID, stay_date: '2026-09-01',
      ...fields, availability_active: true, availability_expires_at: null,
      availability_version: 1, availability_reason: null, availability_updated_at: null,
    }];
    expect(Core.normalizeAvailabilityControl(value).operational_overrides[0]).toMatchObject(fields);
  });

  test('rejects an operational no-change mode paired with a business value', () => {
    const value = control();
    value.operational_overrides = [{
      id: OPERATION_ID, hotel_id: HOTEL_ID, room_rate_id: RATE_ID, stay_date: '2026-09-01',
      closed: true, closed_mode: null, closed_to_arrival: null, closed_to_arrival_mode: null,
      closed_to_departure: null, closed_to_departure_mode: null, availability_active: true,
      availability_expires_at: null, availability_version: 1, availability_reason: null,
      availability_updated_at: null,
    }];
    expect(() => Core.normalizeAvailabilityControl(value)).toThrow(/override/i);
  });

  test.each([
    ['top-level field', (value: any) => { value.customer_email = 'not-allowed@example.com'; }],
    ['hold PII', (value: any) => { value.holds[0].customer_name = 'Not allowed'; }],
    ['activity field', (value: any) => { value.recent_activity[0].ip_address = '127.0.0.1'; }],
    ['invalid calendar date', (value: any) => { value.cells[0].stay_date = '2026-09-31'; }],
    ['foreign Room Rate relation', (value: any) => { value.product_cells[0].room_type_id = '99999999-9999-4999-8999-999999999999'; }],
    ['cell inventory mode drift', (value: any) => { value.cells[0].inventory_mode = 'pooled'; }],
    ['commitment arithmetic drift', (value: any) => { value.cells[0].committed_units = 0; }],
    ['available arithmetic drift', (value: any) => { value.cells[0].available_units = 1; }],
    ['false requestability', (value: any) => { value.cells[0].requestable = true; }],
    ['duplicate Room Rate', (value: any) => { value.room_rates.push({ ...value.room_rates[0] }); }],
    ['blocked inactive Unit', (value: any) => {
      value.units[0].status = 'maintenance'; value.cells[0].physical_capacity = 0;
      value.cells[0].blocked_unit_count = 1; value.cells[0].blocked_unit_ids = [UNIT_ID];
    }],
  ])('rejects %s', (_label, mutate) => {
    const value = control();
    mutate(value);
    expect(() => Core.normalizeAvailabilityControl(value)).toThrow();
  });

  test('rejects uppercase and case-variant duplicate UUIDs in strict server responses', () => {
    const uppercase = control();
    uppercase.recent_activity[0].id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(() => Core.normalizeAvailabilityControl(uppercase)).toThrow(/contract|activity/i);

    const duplicate = control();
    const lowerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    duplicate.units.push({ ...duplicate.units[0], id: lowerId, code: 'upper-2' });
    Object.assign(duplicate.cells[0], {
      physical_capacity: 2, blocked_unit_count: 2, blocked_unit_ids: [lowerId, lowerId.toUpperCase()],
    });
    expect(() => Core.normalizeAvailabilityControl(duplicate)).toThrow(/contract|cell/i);
  });

  test('never accepts price, payment, Partner, architecture or feature-flag fields in a mutation', () => {
    const value = control();
    const operation = {
      entity: 'hold',
      action: 'release',
      id: HOLD_ID,
      expected_version: 1,
      expected_original: value.holds[0],
      payload: { reason: 'Expired duplicate checkout', nightly_rate: 1 },
    };
    expect(() => Core.validateAvailabilityOperation(operation, value)).toThrow(/unsupported|forbidden/i);
  });

  test.each([' leading space', 'line\nbreak', 'trailing space ', '\u0085control'])('rejects non-canonical audited reason %j', (reason) => {
    const value = control();
    expect(() => Core.buildAvailabilityDraft(value, [{
      entity: 'hold', action: 'release', id: HOLD_ID, payload: { reason },
    }])).toThrow(/invalid|unsupported/i);
  });

  test('builds only a strict draft intent and leaves daily identity derivation to the server', () => {
    const value = control();
    const intent = {
      entity: 'daily_inventory', action: 'upsert', id: null,
      payload: {
        room_type_id: ROOM_ID, stay_date: '2026-09-01', sellable_units: 1,
        sellable_units_mode: 'set', closed: false, closed_mode: 'set',
        reason: 'Reviewed inventory', expires_at: null,
      },
    };
    const draft = Core.buildAvailabilityDraft(value, [intent]);
    expect(draft).toMatchObject({
      contract_version: 'hotels_v2_admin_d_availability_draft_v1',
      hotel_id: HOTEL_ID, snapshot_token: 'a'.repeat(64), intents: [intent],
    });
    expect(() => Core.validateAvailabilityDraft({ ...draft, intents: [{ ...intent, id: OPERATION_ID }] }, value)).toThrow();
  });

  test('accepts reviewed expiry-only and closure-only draft patches without fabricating sibling fields', () => {
    const value = control();
    const expiryOnly = {
      entity: 'daily_inventory', action: 'upsert', id: null,
      payload: { room_type_id: ROOM_ID, stay_date: '2026-09-01', reason: 'Temporary inventory expiry', expires_at: '2099-01-01T00:00:00.000Z' },
    };
    const closureOnly = {
      entity: 'daily_inventory', action: 'upsert', id: null,
      payload: { room_type_id: ROOM_ID, stay_date: '2026-09-01', closed: true, closed_mode: 'set', reason: 'Operational closure' },
    };
    expect(Core.buildAvailabilityDraft(value, [expiryOnly]).intents[0].payload).toEqual(expiryOnly.payload);
    expect(Core.buildAvailabilityDraft(value, [closureOnly]).intents[0].payload).toEqual(closureOnly.payload);
  });

  test('requires canonical audit reasons for delete/disable and future non-null expiries', () => {
    const value = control();
    value.daily_inventory = [{ room_type_id: ROOM_ID, stay_date: '2026-09-01', sellable_units: 1,
      sellable_units_mode: 'set', closed: false, closed_mode: 'set', reason: 'Reviewed inventory',
      expires_at: null, version: 1, updated_at: UPDATED_AT }];
    value.unit_calendar_blocks = [{
      id: OPERATION_ID, hotel_id: HOTEL_ID, room_type_id: ROOM_ID, unit_id: UNIT_ID,
      from_date: '2026-09-01', to_date: '2026-09-01', blocked: true, reason: 'Maintenance',
      expires_at: null, is_active: true, version: 1, updated_at: UPDATED_AT,
    }];
    const disable = { entity: 'unit_calendar_block', action: 'disable', id: OPERATION_ID, payload: { reason: 'Reviewed disable' } };
    expect(Core.buildAvailabilityDraft(value, [disable]).intents[0]).toEqual(disable);
    expect(() => Core.buildAvailabilityDraft(value, [{ ...disable, payload: {} }])).toThrow();
    const deletion = { entity: 'daily_inventory', action: 'delete', id: null,
      payload: { room_type_id: ROOM_ID, stay_date: '2026-09-01', reason: 'Reviewed delete' } };
    expect(Core.buildAvailabilityDraft(value, [deletion]).intents[0]).toEqual(deletion);
    expect(() => Core.buildAvailabilityDraft(value, [{ ...deletion, payload: { room_type_id: ROOM_ID, stay_date: '2026-09-01' } }])).toThrow();
    expect(() => Core.buildAvailabilityDraft(value, [{ ...deletion,
      payload: { ...deletion.payload, stay_date: '2026-09-02' } }])).toThrow(/invalid|foreign/i);
    const expired = { entity: 'daily_inventory', action: 'upsert', id: null,
      payload: { room_type_id: ROOM_ID, stay_date: '2026-09-01', reason: 'Expired', expires_at: UPDATED_AT } };
    expect(() => Core.buildAvailabilityDraft(value, [expired])).toThrow();
  });

  test('requires active exact-Room Units for new mappings and Unit-block create/reactivate', () => {
    const value = control();
    value.holds = [];
    value.units[0].status = 'inactive';
    Object.assign(value.cells[0], {
      physical_capacity: 0, configured_sellable_units: 0, held_units: 0,
      committed_units: 0, available_units: 0, earliest_hold_expiry: null,
    });
    const map = {
      entity: 'booking_allocation', action: 'map', id: null,
      payload: { booking_id: HOLD_ID, booking_updated_at: UPDATED_AT, allocations: [{
        id: OPERATION_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID, room_rate_id: RATE_ID,
        unit_ids: [UNIT_ID], units_required: 1, allocated_guest_counts: [2], pricing_guest_counts: [2],
      }] },
    };
    expect(() => Core.buildAvailabilityDraft(value, [map])).toThrow(/invalid|unsupported/i);
    const block = {
      entity: 'unit_calendar_block', action: 'create', id: OPERATION_ID,
      payload: { unit_id: UNIT_ID, room_type_id: ROOM_ID, from_date: '2026-09-01', to_date: '2026-09-01',
        blocked: true, reason: 'Maintenance', expires_at: null, is_active: true },
    };
    expect(() => Core.buildAvailabilityDraft(value, [block])).toThrow(/invalid|unsupported/i);
    value.units[0].status = 'active';
    Object.assign(value.cells[0], {
      physical_capacity: 1, configured_sellable_units: 1, available_units: 1,
      blocking_reasons: ['public_activation_off'],
    });
    expect(Core.buildAvailabilityDraft(value, [map]).intents[0]).toEqual(map);
    expect(Core.buildAvailabilityDraft(value, [block]).intents[0]).toEqual(block);
    value.room_types[0].inventory_mode = 'pooled';
    expect(() => Core.buildAvailabilityDraft(value, [block])).toThrow(/invalid|unsupported/i);
    value.room_types[0].inventory_mode = 'unitized';
    const duplicateUnitMap = structuredClone(map);
    duplicateUnitMap.payload.allocations.push({ ...structuredClone(duplicateUnitMap.payload.allocations[0]), id: ALLOCATION_ID });
    expect(() => Core.buildAvailabilityDraft(value, [duplicateUnitMap])).toThrow(/invalid|unsupported/i);
  });

  test('allows a reviewed Unit-block disable to disclose its exact original scope outside the viewport', () => {
    const value = control();
    const original = {
      id: OPERATION_ID, hotel_id: HOTEL_ID, room_type_id: ROOM_ID, unit_id: UNIT_ID,
      from_date: '2026-08-20', to_date: '2026-09-05', blocked: true, reason: 'Maintenance',
      expires_at: null, is_active: true, version: 1, updated_at: UPDATED_AT,
    };
    value.unit_calendar_blocks = [original];
    const intent = { entity: 'unit_calendar_block', action: 'disable', id: OPERATION_ID, payload: { reason: 'Reviewed reopening' } };
    const draft = Core.buildAvailabilityDraft(value, [intent]);
    const plan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1', hotel_id: HOTEL_ID,
      from: value.from, to: value.to, snapshot_token: value.snapshot_token, reviewed_at: UPDATED_AT,
      plan_fingerprint: 'c'.repeat(64), operations: [{ ...intent, expected_version: 1, expected_original: original }],
    };
    const preview: any = {
      contract_version: 'hotels_v2_admin_d_availability_plan_preview_v1', hotel_id: HOTEL_ID,
      changed: true, blocking_reasons: [], plan_fingerprint: 'c'.repeat(64), reviewed_plan: plan,
      impacts: [{ entity: intent.entity, action: intent.action, id: OPERATION_ID, changed: true,
        affected_room_type_ids: [ROOM_ID], affected_room_rate_ids: [], from: original.from_date, to: original.to_date }],
      current_control: value,
    };
    expect(Core.validateAvailabilityPlanPreview(preview, draft).impacts[0]).toMatchObject({ from: original.from_date, to: original.to_date });
    preview.impacts[0].affected_room_rate_ids = [RATE_ID];
    expect(() => Core.validateAvailabilityPlanPreview(preview, draft)).toThrow(/impact|binding/i);
  });

  test('requires the exact booking identity in an allocation release draft', () => {
    const value = control();
    value.booking_allocations = [{
      id: OPERATION_ID, booking_id: HOLD_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID,
      arrival_date: '2026-09-01', departure_date: '2026-09-02',
      current_booking_updated_at: UPDATED_AT, current_booking_status: 'confirmed',
      room_rate_id: RATE_ID, unit_ids: [UNIT_ID], units_required: 1,
      allocated_guest_counts: [2], pricing_guest_counts: [2], booking_updated_at: UPDATED_AT,
      active_commitment_from: '2026-09-01', active_commitment_to: '2026-09-01',
      active_commitments: [{ room_type_id: ROOM_ID, stay_date: '2026-09-01', unit_id: UNIT_ID, units: 1, status: 'active' }],
      status: 'active', version: 1, updated_at: UPDATED_AT,
    }];
    const intent = { entity: 'booking_allocation', action: 'release', id: HOLD_ID, payload: { booking_id: HOLD_ID, reason: 'Reviewed reassignment' } };
    expect(Core.buildAvailabilityDraft(value, [intent]).intents[0]).toEqual(intent);
    expect(() => Core.buildAvailabilityDraft(value, [{ ...intent, payload: { ...intent.payload, booking_id: OPERATION_ID } }])).toThrow();
  });

  test('binds booking allocation release Review to exact current stay, state and products', () => {
    const value = control();
    value.booking_allocations = [{
      id: OPERATION_ID, booking_id: HOLD_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID,
      arrival_date: '2026-09-01', departure_date: '2026-09-02',
      current_booking_updated_at: UPDATED_AT, current_booking_status: 'confirmed',
      room_rate_id: RATE_ID, unit_ids: [UNIT_ID], units_required: 1,
      allocated_guest_counts: [2], pricing_guest_counts: [2], booking_updated_at: UPDATED_AT,
      active_commitment_from: '2026-09-01', active_commitment_to: '2026-09-01',
      active_commitments: [{ room_type_id: ROOM_ID, stay_date: '2026-09-01', unit_id: UNIT_ID, units: 1, status: 'active' }],
      status: 'active', version: 1, updated_at: UPDATED_AT,
    }];
    expect(Core.normalizeAvailabilityControl(value).booking_allocations[0]).toMatchObject({
      arrival_date: '2026-09-01', departure_date: '2026-09-02', current_booking_status: 'confirmed',
    });
    const intent = { entity: 'booking_allocation', action: 'release', id: HOLD_ID,
      payload: { booking_id: HOLD_ID, reason: 'Reviewed release' } };
    const original = {
      booking_id: HOLD_ID, booking_updated_at: UPDATED_AT, arrival_date: '2026-09-01', departure_date: '2026-09-02',
      status: 'confirmed', num_adults: 2, num_children: 0,
      allocations: [{ id: OPERATION_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID, room_rate_id: RATE_ID,
        unit_ids: [UNIT_ID], units_required: 1, allocated_guest_counts: [2], pricing_guest_counts: [2] }],
      commitments: [{ room_type_id: ROOM_ID, stay_date: '2026-09-01', unit_id: UNIT_ID, units: 1, status: 'active' }],
    };
    const draft = Core.buildAvailabilityDraft(value, [intent]);
    const plan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1', hotel_id: HOTEL_ID,
      from: value.from, to: value.to, snapshot_token: value.snapshot_token, reviewed_at: UPDATED_AT,
      plan_fingerprint: 'c'.repeat(64),
      operations: [{ ...intent, expected_version: 0, expected_original: original }],
    };
    const preview: any = {
      contract_version: 'hotels_v2_admin_d_availability_plan_preview_v1', hotel_id: HOTEL_ID,
      changed: true, blocking_reasons: [], plan_fingerprint: 'c'.repeat(64), reviewed_plan: plan,
      impacts: [{ entity: intent.entity, action: intent.action, id: HOLD_ID, changed: true,
        affected_room_type_ids: [ROOM_ID], affected_room_rate_ids: [RATE_ID],
        from: '2026-09-01', to: '2026-09-01' }],
      current_control: value,
    };
    expect(Core.validateAvailabilityPlanPreview(preview, draft).impacts[0]).toMatchObject({ from: '2026-09-01', to: '2026-09-01' });
    preview.reviewed_plan.operations[0].expected_original.status = 'pending';
    expect(() => Core.validateAvailabilityPlanPreview(preview, draft)).toThrow(/booking allocation release original/i);
    const badStatus = structuredClone(value);
    badStatus.booking_allocations[0].current_booking_status = 'active';
    expect(() => Core.normalizeAvailabilityControl(badStatus)).toThrow(/booking allocation projection/i);
  });

  test('keeps a stale moved booking visible through its exact active commitment topology', () => {
    const value = control();
    value.booking_allocations = [{
      id: OPERATION_ID, booking_id: HOLD_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID,
      arrival_date: '2026-09-10', departure_date: '2026-09-12',
      current_booking_updated_at: UPDATED_AT, current_booking_status: 'confirmed',
      room_rate_id: RATE_ID, unit_ids: [UNIT_ID], units_required: 1,
      allocated_guest_counts: [2], pricing_guest_counts: [2], booking_updated_at: UPDATED_AT,
      status: 'active', version: 1, updated_at: UPDATED_AT,
      active_commitment_from: '2026-09-01', active_commitment_to: '2026-09-01',
      active_commitments: [{ room_type_id: ROOM_ID, stay_date: '2026-09-01', unit_id: UNIT_ID, units: 1, status: 'active' }],
    }];
    expect(Core.normalizeAvailabilityControl(value).booking_allocations[0]).toMatchObject({
      arrival_date: '2026-09-10', active_commitment_from: '2026-09-01', active_commitment_to: '2026-09-01',
    });
    value.booking_allocations[0].active_commitment_from = '2026-09-02';
    expect(() => Core.normalizeAvailabilityControl(value)).toThrow(/booking allocation projection/i);
  });

  test('permits exactly 365 inclusive booking-only dates while ordinary and mixed plans remain capped at 62', () => {
    const mapIntent = {
      entity: 'booking_allocation', action: 'map', id: null,
      payload: { booking_id: HOLD_ID, booking_updated_at: UPDATED_AT, allocations: [{
        id: OPERATION_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID, room_rate_id: RATE_ID,
        unit_ids: [], units_required: 1, allocated_guest_counts: [2], pricing_guest_counts: [2],
      }] },
    };
    const draft = {
      contract_version: 'hotels_v2_admin_d_availability_draft_v1', hotel_id: HOTEL_ID,
      from: '2027-01-01', to: '2027-12-31', snapshot_token: 'a'.repeat(64), intents: [mapIntent],
    };
    expect(Core.validateAvailabilityDraft(draft).to).toBe('2027-12-31');
    const operation = { ...mapIntent, id: HOLD_ID, expected_version: 0, expected_original: {} };
    const plan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1', hotel_id: HOTEL_ID,
      from: draft.from, to: draft.to, snapshot_token: draft.snapshot_token, reviewed_at: UPDATED_AT,
      operations: [operation], plan_fingerprint: 'c'.repeat(64),
    };
    expect(Core.validateAvailabilityPlan(plan).operations).toHaveLength(1);
    expect(() => Core.validateAvailabilityDraft({ ...draft, to: '2028-01-01' })).toThrow(/contract/i);
    const daily = { entity: 'daily_inventory', action: 'upsert', id: null,
      payload: { room_type_id: ROOM_ID, stay_date: draft.from, closed: true, closed_mode: 'set', reason: 'Reviewed' } };
    expect(() => Core.validateAvailabilityDraft({ ...draft, intents: [mapIntent, daily] })).toThrow(/contract/i);
  });

  test('derives allocation capacity exactly and fails closed when Room capacity is unknown', () => {
    const value = control();
    value.room_types[0].max_occupancy = null;
    value.room_types[0].capacity_adults = 2;
    value.room_types[0].capacity_children = 2;
    value.booking_allocations = [{
      id: OPERATION_ID, booking_id: HOLD_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID,
      arrival_date: '2026-09-01', departure_date: '2026-09-02',
      current_booking_updated_at: UPDATED_AT, current_booking_status: 'confirmed',
      room_rate_id: RATE_ID, unit_ids: [UNIT_ID], units_required: 1,
      allocated_guest_counts: [4], pricing_guest_counts: [4], booking_updated_at: UPDATED_AT,
      active_commitment_from: '2026-09-01', active_commitment_to: '2026-09-01',
      active_commitments: [{ room_type_id: ROOM_ID, stay_date: '2026-09-01', unit_id: UNIT_ID, units: 1, status: 'active' }],
      status: 'active', version: 1, updated_at: UPDATED_AT,
    }];
    expect(Core.normalizeAvailabilityControl(value).booking_allocations[0].allocated_guest_counts).toEqual([4]);
    value.booking_allocations[0].pricing_guest_counts = [5];
    expect(() => Core.normalizeAvailabilityControl(value)).toThrow(/allocation/i);
    value.booking_allocations[0].pricing_guest_counts = [4];
    value.room_types[0].capacity_children = null;
    expect(() => Core.normalizeAvailabilityControl(value)).toThrow(/allocation/i);
  });

  test('preserves released allocation and hold topology after the Unit is disabled and Room mode changes', () => {
    const value = control();
    value.units[0].status = 'disabled';
    Object.assign(value.cells[0], { physical_capacity: 0, held_units: 0, committed_units: 0,
      available_units: 0, earliest_hold_expiry: null });
    value.booking_allocations = [{
      id: OPERATION_ID, booking_id: HOLD_ID, room_type_id: ROOM_ID, rate_plan_id: PLAN_ID,
      arrival_date: '2026-09-01', departure_date: '2026-09-02',
      current_booking_updated_at: UPDATED_AT, current_booking_status: 'confirmed',
      room_rate_id: RATE_ID, unit_ids: [UNIT_ID], units_required: 1,
      allocated_guest_counts: [2], pricing_guest_counts: [2], booking_updated_at: UPDATED_AT,
      active_commitment_from: null, active_commitment_to: null, active_commitments: [],
      status: 'released', version: 1, updated_at: UPDATED_AT,
    }];
    value.holds[0].status = 'released';
    value.holds[0].commitments[0].status = 'released';
    value.holds[0].active_commitment_from = null;
    value.holds[0].active_commitment_to = null;
    value.room_types[0].inventory_mode = 'pooled';
    value.room_types[0].base_inventory_count = 0;
    value.cells[0].inventory_mode = 'pooled';
    expect(Core.normalizeAvailabilityControl(value)).toMatchObject({
      booking_allocations: [{ status: 'released', unit_ids: [UNIT_ID] }],
      holds: [{ status: 'released' }],
    });
  });

  test('treats an active hold expiring at snapshot_as_of as inert historical topology', () => {
    const value = control();
    value.units[0].status = 'disabled';
    value.room_types[0].inventory_mode = 'pooled';
    value.room_types[0].base_inventory_count = 0;
    Object.assign(value.cells[0], { inventory_mode: 'pooled', physical_capacity: 0, configured_sellable_units: 0,
      held_units: 0, committed_units: 0, available_units: 0, earliest_hold_expiry: null });
    value.holds[0].expires_at = UPDATED_AT;
    expect(Core.normalizeAvailabilityControl(value).holds[0]).toMatchObject({ status: 'active', expires_at: UPDATED_AT });
    value.holds[0].expires_at = '2026-08-24T12:00:00.001Z';
    expect(() => Core.normalizeAvailabilityControl(value)).toThrow(/hold projection/i);
  });

  test('accepts only finite unmapped-booking reasons, including stale allocation repair', () => {
    const value = control();
    value.unmapped_booking_blockers = [{
      booking_id: HOLD_ID, booking_updated_at: UPDATED_AT, arrival_date: '2026-09-01',
      departure_date: '2026-09-02', num_adults: 2, num_children: 0,
      status: 'confirmed', reason: 'stale_booking_allocation',
    }];
    expect(Core.normalizeAvailabilityControl(value).unmapped_booking_blockers[0].reason).toBe('stale_booking_allocation');
    value.unmapped_booking_blockers[0].reason = 'arbitrary_reason';
    expect(() => Core.normalizeAvailabilityControl(value)).toThrow(/blocker/i);
  });

  test('accepts preview-only range intent but never accepts it in a server-reviewed operation', () => {
    const value = control();
    const intent = {
      entity: 'operational_override_range', action: 'expand', id: null,
      payload: {
        room_rate_id: RATE_ID, valid_from: '2026-09-01', valid_to: '2026-09-01', weekdays: [2],
        closed: true, closed_mode: 'set', closed_to_arrival: null, closed_to_arrival_mode: 'clear',
        closed_to_departure: null, closed_to_departure_mode: 'clear', reason: 'Reviewed closure',
        availability_expires_at: null,
      },
    };
    expect(Core.buildAvailabilityDraft(value, [intent]).intents[0]).toEqual(intent);
    expect(() => Core.validateAvailabilityOperation({
      ...intent, id: OPERATION_ID, expected_version: 0, expected_original: {},
    }, value)).toThrow(/invalid|unsupported/i);
  });

  test('binds a server preview to the exact draft, current snapshot, fingerprint and impacts', () => {
    const value = control();
    const intent = Core.buildHoldReleaseIntent(value, HOLD_ID, 'Reviewed release');
    const draft = Core.buildAvailabilityDraft(value, [intent]);
    const reviewedPlan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1',
      hotel_id: HOTEL_ID, from: value.from, to: value.to, snapshot_token: value.snapshot_token,
      reviewed_at: UPDATED_AT, plan_fingerprint: 'c'.repeat(64),
      operations: [{
        entity: 'hold', action: 'release', id: HOLD_ID, expected_version: 1,
        expected_original: value.holds[0], payload: { reason: 'Reviewed release' },
      }],
    };
    const preview = {
      contract_version: 'hotels_v2_admin_d_availability_plan_preview_v1',
      hotel_id: HOTEL_ID, changed: true, blocking_reasons: [], plan_fingerprint: 'c'.repeat(64),
      impacts: [{
        entity: 'hold', action: 'release', id: HOLD_ID, changed: true,
        affected_room_type_ids: [ROOM_ID], affected_room_rate_ids: [],
        from: value.from, to: value.to,
      }],
      reviewed_plan: reviewedPlan,
      current_control: value,
    };
    expect(Core.validateAvailabilityPlanPreview(preview, draft).reviewed_plan).toEqual(reviewedPlan);
    expect(() => Core.validateAvailabilityPlanPreview({ ...preview, plan_fingerprint: 'd'.repeat(64) }, draft)).toThrow();
    expect(() => Core.validateAvailabilityPlanPreview({
      ...preview, current_control: { ...value, snapshot_token: 'e'.repeat(64) },
    }, draft)).toThrow();
  });

  test('allows a shared Rate Rule impact outside the loaded range only when exact original scope and products match', () => {
    const value = control();
    const original = {
      id: OPERATION_ID, room_rate_id: RATE_ID, valid_from: '2026-08-01', valid_to: '2026-10-31', weekdays: [1, 2, 3, 4, 5, 6, 7],
      closed_to_arrival: false, closed_to_departure: false, availability_version: 1,
      availability_reason: null, availability_actor_id: null, availability_correlation_id: null, availability_updated_at: null,
    };
    value.rate_rule_operational_restrictions = [original];
    const intent = { entity: 'rate_rule_operational_restriction', action: 'update', id: OPERATION_ID, payload: { closed_to_arrival: true, closed_to_departure: false, reason: 'Reviewed CTA' } };
    const draft = Core.buildAvailabilityDraft(value, [intent]);
    const reviewedPlan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1', hotel_id: HOTEL_ID,
      from: value.from, to: value.to, snapshot_token: value.snapshot_token, reviewed_at: UPDATED_AT,
      plan_fingerprint: 'c'.repeat(64), operations: [{ ...intent, expected_version: 1, expected_original: original }],
    };
    const preview = {
      contract_version: 'hotels_v2_admin_d_availability_plan_preview_v1', hotel_id: HOTEL_ID,
      changed: true, blocking_reasons: [], plan_fingerprint: 'c'.repeat(64), reviewed_plan: reviewedPlan,
      impacts: [{ entity: intent.entity, action: intent.action, id: OPERATION_ID, changed: true,
        affected_room_type_ids: [ROOM_ID], affected_room_rate_ids: [RATE_ID], from: original.valid_from, to: original.valid_to }],
      current_control: value,
    };
    expect(Core.validateAvailabilityPlanPreview(preview, draft).impacts[0]).toMatchObject({ from: original.valid_from, to: original.valid_to });
    preview.impacts[0].affected_room_rate_ids = [];
    expect(() => Core.validateAvailabilityPlanPreview(preview, draft)).toThrow(/binding|impact/i);
  });

  test('round-trips the server-canonical UUID for a daily identity whose raw MD5 variant was invalid', () => {
    const value = control();
    const intent = { entity: 'daily_inventory', action: 'upsert', id: null,
      payload: { room_type_id: ROOM_ID, stay_date: '2026-09-01', closed: true, closed_mode: 'set', reason: 'Reviewed closure' } };
    const draft = Core.buildAvailabilityDraft(value, [intent]);
    const operation = { ...intent, id: CANONICAL_DAILY_ID, expected_version: 0, expected_original: {} };
    const plan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1', hotel_id: HOTEL_ID,
      from: value.from, to: value.to, snapshot_token: value.snapshot_token, reviewed_at: UPDATED_AT,
      plan_fingerprint: 'c'.repeat(64), operations: [operation],
    };
    const preview = {
      contract_version: 'hotels_v2_admin_d_availability_plan_preview_v1', hotel_id: HOTEL_ID,
      changed: true, blocking_reasons: [], plan_fingerprint: 'c'.repeat(64), reviewed_plan: plan,
      impacts: [{ entity: 'daily_inventory', action: 'upsert', id: CANONICAL_DAILY_ID, changed: true,
        affected_room_type_ids: [ROOM_ID], affected_room_rate_ids: [], from: value.from, to: value.to }],
      current_control: value,
    };
    expect(Core.validateAvailabilityPlanPreview(preview, draft).reviewed_plan.operations[0].id).toBe(CANONICAL_DAILY_ID);

    const refreshed = control();
    refreshed.snapshot_token = 'd'.repeat(64);
    refreshed.daily_inventory = [{
      room_type_id: ROOM_ID, stay_date: '2026-09-01', sellable_units: 0, sellable_units_mode: 'clear',
      closed: true, closed_mode: 'set', reason: 'Reviewed closure', expires_at: null,
      version: 1, updated_at: UPDATED_AT,
    }];
    refreshed.cells[0].operational_closed = true;
    refreshed.cells[0].blocking_reasons = ['operational_closed', 'inventory_exhausted', 'public_activation_off'];
    const activity = {
      id: OPERATION_ID, entity_type: 'daily_inventory', entity_id: CANONICAL_DAILY_ID, action: 'create',
      before_state: null, after_state: { fingerprint: '2'.repeat(64), redacted: true }, actor_type: 'admin',
      source: 'hotels_v2_admin_d_availability_control', correlation_id: CORRELATION_ID, created_at: UPDATED_AT,
    };
    refreshed.recent_activity.unshift(activity);
    const result = {
      contract_version: 'hotels_v2_admin_d_availability_apply_result_v1', hotel_id: HOTEL_ID,
      correlation_id: CORRELATION_ID, idempotency_key: 'availability.daily-1', replayed: false,
      changed: true, activity: [activity], availability_control: refreshed,
    };
    expect(Core.validateAvailabilityApplyResult(result, plan, CORRELATION_ID, 'availability.daily-1').activity[0].entity_id).toBe(CANONICAL_DAILY_ID);
  });

  test('binds daily inventory delete to an exact delete ledger action', () => {
    const original = {
      room_type_id: ROOM_ID, stay_date: '2026-09-01', sellable_units: 1, sellable_units_mode: 'set',
      closed: false, closed_mode: 'set', reason: 'Reviewed inventory', expires_at: null,
      version: 1, updated_at: UPDATED_AT,
    };
    const plan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1', hotel_id: HOTEL_ID,
      from: '2026-09-01', to: '2026-09-01', snapshot_token: 'a'.repeat(64), reviewed_at: UPDATED_AT,
      plan_fingerprint: 'c'.repeat(64), operations: [{
        entity: 'daily_inventory', action: 'delete', id: CANONICAL_DAILY_ID, expected_version: 1,
        expected_original: original, payload: { room_type_id: ROOM_ID, stay_date: '2026-09-01', reason: 'Reviewed delete' },
      }],
    };
    const refreshed = control();
    const activity = {
      id: OPERATION_ID, entity_type: 'daily_inventory', entity_id: CANONICAL_DAILY_ID, action: 'delete',
      before_state: { fingerprint: '1'.repeat(64), redacted: true }, after_state: null, actor_type: 'admin',
      source: 'hotels_v2_admin_d_availability_control', correlation_id: CORRELATION_ID, created_at: UPDATED_AT,
    };
    refreshed.recent_activity.unshift(activity);
    const result = {
      contract_version: 'hotels_v2_admin_d_availability_apply_result_v1', hotel_id: HOTEL_ID,
      correlation_id: CORRELATION_ID, idempotency_key: 'availability.delete-1', replayed: false,
      changed: true, activity: [activity], availability_control: refreshed,
    };
    expect(Core.validateAvailabilityApplyResult(result, plan, CORRELATION_ID, 'availability.delete-1').activity[0].action).toBe('delete');
  });

  test('binds one exact redacted activity row to every reviewed apply operation', () => {
    const before = control();
    const plan = {
      contract_version: 'hotels_v2_admin_d_availability_plan_v1', hotel_id: HOTEL_ID,
      from: before.from, to: before.to, snapshot_token: before.snapshot_token, reviewed_at: UPDATED_AT,
      plan_fingerprint: 'c'.repeat(64), operations: [{
        entity: 'hold', action: 'release', id: HOLD_ID, expected_version: 1,
        expected_original: before.holds[0], payload: { reason: 'Reviewed release' },
      }],
    };
    const refreshed = control();
    refreshed.snapshot_token = 'd'.repeat(64);
    refreshed.holds[0].status = 'released';
    refreshed.holds[0].commitments[0].status = 'released';
    Object.assign(refreshed.cells[0], {
      held_units: 0, committed_units: 0, available_units: 1,
      blocking_reasons: ['public_activation_off'], earliest_hold_expiry: null,
    });
    const activity = {
      id: OPERATION_ID, entity_type: 'inventory_hold', entity_id: HOLD_ID, action: 'disable',
      before_state: { fingerprint: '1'.repeat(64), redacted: true },
      after_state: { fingerprint: '2'.repeat(64), redacted: true }, actor_type: 'admin',
      source: 'hotels_v2_admin_d_availability_control', correlation_id: CORRELATION_ID, created_at: UPDATED_AT,
    };
    refreshed.recent_activity.unshift(activity);
    const result = {
      contract_version: 'hotels_v2_admin_d_availability_apply_result_v1', hotel_id: HOTEL_ID,
      correlation_id: CORRELATION_ID, idempotency_key: 'availability.test-1', replayed: false,
      changed: true, activity: [activity], availability_control: refreshed,
    };
    expect(Core.validateAvailabilityApplyResult(result, plan, CORRELATION_ID, 'availability.test-1').activity).toHaveLength(1);
    expect(() => Core.validateAvailabilityApplyResult({ ...result, activity: [] }, plan, CORRELATION_ID, 'availability.test-1')).toThrow(/activity/i);
  });

  test('validates the nested pricing, exact night matrix and departure-boundary CTD evidence', () => {
    const request = {
      contract_version: 'hotels_v2_admin_d_stay_preview_request_v1', hotel_id: HOTEL_ID,
      arrival_date: '2026-09-01', departure_date: '2026-09-02', adults: 2, child_ages: [],
      room_type_id: ROOM_ID, room_rate_id: RATE_ID, rate_plan_id: PLAN_ID,
      allocation_rule_id: ALLOCATION_ID, availability_snapshot_token: 'a'.repeat(64),
    };
    expect(Core.validateAvailabilityStayPreview(stayPreview(), request)).toMatchObject({ ok: true, requestable: false });
    const wrongBoundary = stayPreview();
    wrongBoundary.availability.rooms[0].departure_boundary_product.closed_to_departure = true;
    wrongBoundary.availability.available_for_stay = true;
    expect(() => Core.validateAvailabilityStayPreview(wrongBoundary, request)).toThrow(/inconsistent/i);
    const pricingSmuggle = stayPreview();
    pricingSmuggle.pricing.products[0].room_rate_id = OPERATION_ID;
    expect(() => Core.validateAvailabilityStayPreview(pricingSmuggle, request)).toThrow();
  });
});
