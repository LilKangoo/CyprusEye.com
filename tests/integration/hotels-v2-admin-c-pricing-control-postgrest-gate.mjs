import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE_URL = process.env.HOTELS_ADMIN_C_POSTGREST_URL || 'http://127.0.0.1:53016';
const parsed = new URL(BASE_URL);
assert.equal(parsed.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname));

const FUTURE = 'c1000000-0000-4000-8000-000000000001';
const ROOM = 'c1100000-0000-4000-8000-000000000001';
const PLAN = 'c1200000-0000-4000-8000-000000000101';
const RATE = 'c1300000-0000-4000-8000-000000000101';
const PLAN_TWO = 'c1200000-0000-4000-8000-000000000102';
const RATE_TWO = 'c1300000-0000-4000-8000-000000000102';
const ALLOCATION = 'c1400000-0000-4000-8000-000000000101';
const ITEM = 'c1500000-0000-4000-8000-000000000101';
const DEFAULT = 'c1600000-0000-4000-8000-000000000101';
const WEEKDAY = 'c1700000-0000-4000-8000-000000000101';
const SEASONAL = 'c1700000-0000-4000-8000-000000000102';
const EXACT = 'c1800000-0000-4000-8000-000000000101';
const SCHEDULE = 'c1a00000-0000-4000-8000-000000000101';
const SCHEDULE_CLONE = 'c1a00000-0000-4000-8000-000000000102';
const CALENDAR_EXACT = 'c1800000-0000-4000-8000-000000000201';
const CALENDAR_COLLISION = 'c1800000-0000-4000-8000-000000000202';
const LEGACY_EXACT = 'c2800000-0000-4000-8000-000000000901';
const K7 = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const K7_PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const K7_UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const K7_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';

const statuses = { authDenied: 0, rawDenied: 0, foreign: 0, smuggling: 0,
  mutations: 0, noops: 0, replays: 0, stale: 0, previews: 0,
  lifecycle: 0, schedules: 0, compatibility: 0, legacy: 0 };
let requestCount = 0;

async function request(path, { token, method = 'GET', body } = {}) {
  requestCount += 1;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE_URL}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  return { status: response.status, ok: response.ok, payload };
}

function rpc(name, token, body = {}) {
  return request(`/rpc/${name}`, { token, method: 'POST', body });
}

function id(n) { return `c2000000-0000-4000-8000-${String(n).padStart(12, '0')}`; }

function operation(entity, action, entityId, payload, options = {}) {
  return {
    entity, action, id: entityId,
    expected_version: options.expectedVersion ?? 0,
    expected_children_fingerprint: options.childrenFingerprint ?? null,
    expected_link_fingerprint: options.linkFingerprint ?? null,
    expected_linked_room_rate_ids: options.linkedIds ?? [],
    shared_impact_acknowledged: options.sharedAck ?? false,
    activation_acknowledged: options.activationAck ?? false,
    expected_original: options.original ?? {}, payload,
  };
}

function plan(control, operations, reviewedAt = new Date().toISOString()) {
  return { contract_version: 'hotels_v2_admin_c_pricing_plan_v1',
    hotel_id: control.hotel_id, snapshot_token: control.snapshot_token,
    reviewed_at: reviewedAt, operations };
}

function previewRequest(control, { planId, allocationId, roomId, checkIn,
  checkOut, adults, childAges = [] }) {
  return { contract_version: 'hotels_v2_admin_c_pricing_preview_v1',
    hotel_id: control.hotel_id, snapshot_token: control.snapshot_token,
    rate_plan_id: planId, allocation_rule_id: allocationId,
    selected_room_type_id: roomId, check_in: checkIn, check_out: checkOut,
    adults, child_ages: childAges };
}

function ratePlanState(row) {
  return { code: row.code, name_i18n: row.name_i18n,
    description_i18n: row.description_i18n, meal_plan_code: row.meal_plan_code,
    cancellation_policy: row.cancellation_policy,
    booking_mode_override: row.booking_mode_override,
    price_inclusions: row.price_inclusions, lifecycle_status: row.lifecycle_status,
    sort_order: row.sort_order };
}

function roomRateState(row) {
  return { room_type_id: row.room_type_id, rate_plan_id: row.rate_plan_id,
    pricing_schedule_id: row.pricing_schedule_id,
    base_nightly_rate: row.base_nightly_rate, currency: row.currency,
    external_redirect_url: row.external_redirect_url,
    lifecycle_status: row.lifecycle_status, sort_order: row.sort_order };
}

function scheduleState(row) {
  return { code: row.code, name_i18n: row.name_i18n,
    application_scope: row.application_scope, currency: row.currency,
    maximum_party_size: row.maximum_party_size,
    minimum_billable_occupancy: row.minimum_billable_occupancy,
    sharing_mode: row.sharing_mode, lifecycle_status: row.lifecycle_status,
    tiers: row.tiers.map((tier) => ({ id: tier.id, schedule_id: tier.schedule_id,
      guest_count: tier.guest_count, threshold_nights: tier.threshold_nights,
      nightly_rate: tier.nightly_rate, is_active: tier.is_active, version: tier.version })) };
}

function allocationState(row) {
  return { code: row.code, allocation_mode: row.allocation_mode,
    min_guest_count: row.min_guest_count, max_guest_count: row.max_guest_count,
    lifecycle_status: row.lifecycle_status, sort_order: row.sort_order,
    items: row.items.map(({ version: _version, ...item }) => item) };
}

function ruleState(row) {
  return { room_rate_id: row.room_rate_id, valid_from: row.valid_from,
    valid_to: row.valid_to, weekdays: row.weekdays, nightly_rate: row.nightly_rate,
    minimum_stay: row.minimum_stay, maximum_stay: row.maximum_stay,
    closed_to_arrival: row.closed_to_arrival,
    closed_to_departure: row.closed_to_departure,
    priority: row.priority, is_active: row.is_active };
}

function defaultState(row) {
  return { nightly_rate: row.nightly_rate, currency: row.currency,
    lifecycle_status: row.lifecycle_status };
}

function exactPriceState(row) {
  return { nightly_rate_mode: row.nightly_rate_mode, nightly_rate: row.nightly_rate,
    minimum_stay_mode: row.minimum_stay_mode, minimum_stay: row.minimum_stay,
    maximum_stay_mode: row.maximum_stay_mode, maximum_stay: row.maximum_stay,
    reason: row.pricing_reason, expires_at: row.pricing_expires_at };
}

function calendarOperation(entity, type, entityId, expectedVersion, payload) {
  return { entity, type, id: entityId, expected_version: expectedVersion, payload };
}

function calendarPlan(calendar, operations) {
  return { hotel_id: calendar.hotel_id, from: calendar.start_date,
    to: calendar.end_date, reviewed_at: new Date().toISOString(),
    snapshot_token: calendar.snapshot_token, operations };
}

async function getControl(hotelId = FUTURE) {
  const result = await rpc('hotel_v2_admin_get_pricing_control', TOKENS.admin,
    { p_hotel_id: hotelId });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

async function getCalendar(hotelId, from, to = from) {
  const result = await rpc('hotel_v2_admin_get_calendar', TOKENS.admin,
    { p_hotel_id: hotelId, p_start_date: from, p_end_date: to });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

async function apply(control, operations, correlation, key, reviewedAt) {
  return rpc('hotel_v2_admin_apply_pricing_control_plan', TOKENS.admin, {
    p_plan: plan(control, operations, reviewedAt),
    p_correlation_id: correlation, p_idempotency_key: key,
  });
}

function controlled(result, status, code, message) {
  assert.equal(result.status, status, JSON.stringify(result.payload));
  if (code) assert.equal(result.payload?.code, code, JSON.stringify(result.payload));
  if (message) assert.equal(result.payload?.message, message, JSON.stringify(result.payload));
}

function denied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded`);
  assert.ok([401, 403, 404].includes(result.status), `${label}: ${result.status}`);
}

// Public RPCs are Admin-only.
for (const [label, token] of [['anon', TOKENS.anon], ['non-admin', TOKENS.nonAdmin],
  ['Partner', TOKENS.owner]]) {
  denied(await rpc('hotel_v2_admin_get_pricing_control', token,
    { p_hotel_id: FUTURE }), `${label} read`);
  denied(await rpc('hotel_v2_admin_apply_pricing_control_plan', token,
    { p_plan: {}, p_correlation_id: id(900), p_idempotency_key: 'denied-key-900' }),
  `${label} apply`);
  denied(await rpc('hotel_v2_admin_preview_pricing_quote', token,
    { p_request: {} }), `${label} preview`);
  statuses.authDenied += 3;
}

const rawTables = ['hotel_property_pricing_defaults',
  'hotel_admin_pricing_action_receipts', 'hotel_rate_plans', 'hotel_room_rates',
  'hotel_pricing_schedules', 'hotel_pricing_schedule_occupancy_tiers',
  'hotel_room_rate_occupancy_tiers', 'hotel_rate_rules', 'hotel_calendar_overrides',
  'hotel_room_allocation_rules', 'hotel_room_allocation_rule_items',
  'hotel_daily_rates', 'hotel_activity_log', 'hotel_pricing_promotion_reviews'];
for (const [label, token] of [['Admin', TOKENS.admin], ['Partner', TOKENS.owner]]) {
  for (const table of rawTables) {
    denied(await request(`/${table}?select=*&limit=1`, { token }), `${label} raw ${table}`);
    statuses.rawDenied += 1;
  }
  denied(await request('/hotel_rate_plans', { token, method: 'POST', body: { id: id(901) } }),
    `${label} raw insert`);
  denied(await request(`/hotel_room_rates?id=eq.${RATE}`, {
    token, method: 'PATCH', body: { base_nightly_rate: 1 },
  }), `${label} raw update`);
  denied(await request(`/hotel_rate_rules?id=eq.${WEEKDAY}`, { token, method: 'DELETE' }),
    `${label} raw delete`);
  statuses.rawDenied += 3;
}

let control = await getControl();
const initialControl = structuredClone(control);
assert.equal(control.contract_version, 'hotels_v2_admin_c_pricing_control_v1');
assert.equal(control.property.architecture_version, 'rooms_v2');
assert.equal(control.property.booking_mode, 'request_confirmation');
assert.equal(control.room_types.length, 1);
assert.equal(control.room_types[0].inventory_mode, 'pooled');
assert.equal(control.room_types[0].base_inventory_count, 1);
assert.equal(control.room_types[0].active_unit_count, 0);
assert.match(control.snapshot_token, /^[0-9a-f]{64}$/);

controlled(await rpc('hotel_v2_admin_get_pricing_control', TOKENS.admin,
  { p_hotel_id: 'c1ee0000-0000-4000-8000-000000000001' }),
404, 'PT404', 'hotels_v2_admin_c_property_not_found');
statuses.foreign += 1;

const createOps = [
  operation('rate_plan', 'create', PLAN, {
    code: 'standard', name_i18n: { pl: 'Standard', en: 'Standard', he: 'סטנדרט' },
    description_i18n: { pl: 'Plan standardowy', en: 'Standard plan', he: 'תכנית סטנדרטית' },
    meal_plan_code: null, cancellation_policy: { type: 'flexible' },
    booking_mode_override: null, price_inclusions: [], lifecycle_status: 'active', sort_order: 10,
  }, { activationAck: true }),
  operation('room_rate', 'create', RATE, {
    room_type_id: ROOM, rate_plan_id: PLAN, pricing_schedule_id: null,
    base_nightly_rate: 80, currency: 'EUR', external_redirect_url: null,
    lifecycle_status: 'active', sort_order: 10,
  }, { activationAck: true }),
  operation('allocation_rule', 'create', ALLOCATION, {
    code: 'choice-1-3', allocation_mode: 'customer_choice', min_guest_count: 1,
    max_guest_count: 3, lifecycle_status: 'active', sort_order: 10,
    items: [{ id: ITEM, hotel_id: FUTURE, allocation_rule_id: ALLOCATION,
      room_type_id: ROOM, units_required: 1, allocated_guest_count: null,
      pricing_guest_count: null, allocated_guest_counts: null,
      pricing_guest_counts: null, sort_order: 10 }],
  }, { activationAck: true }),
];
const createPlan = plan(control, createOps);
let result = await rpc('hotel_v2_admin_apply_pricing_control_plan', TOKENS.admin, {
  p_plan: createPlan, p_correlation_id: id(1), p_idempotency_key: 'admin-c-http-create-001',
});
assert.equal(result.status, 200, JSON.stringify(result.payload));
assert.equal(result.payload.changed, true);
assert.equal(result.payload.activity.length, 3);
assert.ok(result.payload.activity.every((row) => row.actor_type === 'admin'));
statuses.mutations += 1;

const replay = await rpc('hotel_v2_admin_apply_pricing_control_plan', TOKENS.admin, {
  p_plan: createPlan, p_correlation_id: id(1), p_idempotency_key: 'admin-c-http-create-001',
});
assert.equal(replay.status, 200, JSON.stringify(replay.payload));
assert.equal(replay.payload.replayed, true);
statuses.replays += 1;

const keyConflictPlan = structuredClone(createPlan);
keyConflictPlan.operations[0].payload.sort_order = 11;
controlled(await rpc('hotel_v2_admin_apply_pricing_control_plan', TOKENS.admin, {
  p_plan: keyConflictPlan, p_correlation_id: id(1),
  p_idempotency_key: 'admin-c-http-create-001',
}), 409, 'PT409', 'hotels_v2_admin_c_idempotency_conflict');
statuses.stale += 1;

control = await getControl();
const quote = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }),
});
assert.equal(quote.status, 200, JSON.stringify(quote.payload));
assert.equal(quote.payload.ok, true);
assert.equal(quote.payload.requestable, false);
assert.equal(Number(quote.payload.customer_total), 80);
assert.equal(quote.payload.products[0].base_pricing_source, 'base_nightly_rate');
assert.deepEqual(quote.payload.pricing_precedence, ['exact_date_price',
  'seasonal_range_rule', 'weekday_rule', 'pricing_schedule_tier',
  'independent_occupancy_tier', 'room_rate_base_nightly_rate', 'property_default']);
statuses.previews += 1;

const acceptedChild = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2,
    childAges: [12] }),
});
assert.equal(acceptedChild.status, 200, JSON.stringify(acceptedChild.payload));
assert.equal(acceptedChild.payload.ok, true);
assert.deepEqual(acceptedChild.payload.child_ages, [12]);
assert.equal(Number(acceptedChild.payload.customer_total), 80);
statuses.previews += 1;

const underageChild = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2,
    childAges: [11] }),
});
assert.equal(underageChild.status, 200, JSON.stringify(underageChild.payload));
assert.equal(underageChild.payload.ok, false);
assert.equal(underageChild.payload.customer_total, null);
assert.ok(underageChild.payload.blocking_reasons.some(
  (row) => row.code === 'child_policy_not_satisfied'));
statuses.previews += 1;

const adultsOverflow = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 3 }),
});
assert.equal(adultsOverflow.status, 200, JSON.stringify(adultsOverflow.payload));
assert.equal(adultsOverflow.payload.ok, false);
assert.equal(adultsOverflow.payload.customer_total, null);
assert.ok(adultsOverflow.payload.blocking_reasons.some(
  (row) => row.code === 'room_demographic_capacity_exceeded'));
statuses.previews += 1;

for (const malformed of [
  { ...previewRequest(control, { planId: PLAN, allocationId: ALLOCATION, roomId: ROOM,
    checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }), snapshot_token: 'A'.repeat(64) },
  { ...previewRequest(control, { planId: PLAN, allocationId: ALLOCATION, roomId: ROOM,
    checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }), check_in: '2026-9-1' },
  { ...previewRequest(control, { planId: PLAN, allocationId: ALLOCATION, roomId: ROOM,
    checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }), adults: 2.5 },
]) {
  controlled(await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin,
    { p_request: malformed }), 400, '22023');
  statuses.smuggling += 1;
}

for (const [suffix, malformedPlan] of [
  ['hotel-uuid', { ...plan(control, [operation('rate_plan', 'create',
    'c1200000-0000-4000-8000-000000000199', {
      code: 'transport-probe', name_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' },
      description_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' }, meal_plan_code: null,
      cancellation_policy: { type: 'flexible' }, booking_mode_override: null,
      price_inclusions: [], lifecycle_status: 'draft', sort_order: 199,
    })]), hotel_id: FUTURE.replaceAll('-', '') }],
  ['nested-uuid', (() => {
    const value = plan(control, [operation('allocation_rule', 'create',
      'c1400000-0000-4000-8000-000000000199', {
        code: 'transport-probe', allocation_mode: 'customer_choice',
        min_guest_count: 1, max_guest_count: 1, lifecycle_status: 'draft',
        sort_order: 199, items: [{ id: 'c1500000-0000-4000-8000-000000000199',
          hotel_id: FUTURE, allocation_rule_id: 'c1400000-0000-4000-8000-000000000199',
          room_type_id: ROOM.toUpperCase(), units_required: 1,
          allocated_guest_count: null, pricing_guest_count: null,
          allocated_guest_counts: null, pricing_guest_counts: null, sort_order: 10 }],
      })]);
    return value;
  })()],
  ['uuid-version', (() => {
    const value = plan(control, [operation('rate_plan', 'create',
      'c1200000-0000-0000-8000-000000000199', {
        code: 'uuid-version-probe', name_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' },
        description_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' }, meal_plan_code: null,
        cancellation_policy: { type: 'flexible' }, booking_mode_override: null,
        price_inclusions: [], lifecycle_status: 'draft', sort_order: 196,
      })]);
    return value;
  })()],
  ['uuid-variant', (() => {
    const value = plan(control, [operation('rate_plan', 'create',
      'c1200000-0000-4000-7000-000000000199', {
        code: 'uuid-variant-probe', name_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' },
        description_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' }, meal_plan_code: null,
        cancellation_policy: { type: 'flexible' }, booking_mode_override: null,
        price_inclusions: [], lifecycle_status: 'draft', sort_order: 195,
      })]);
    return value;
  })()],
  ['review-date', { ...plan(control, [operation('rate_plan', 'create',
    'c1200000-0000-4000-8000-000000000198', {
      code: 'review-date-probe', name_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' },
      description_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' }, meal_plan_code: null,
      cancellation_policy: { type: 'flexible' }, booking_mode_override: null,
      price_inclusions: [], lifecycle_status: 'draft', sort_order: 198,
    })]), reviewed_at: '2026-02-30T12:00:00Z' }],
  ['review-hour', { ...plan(control, [operation('rate_plan', 'create',
    'c1200000-0000-4000-8000-000000000197', {
      code: 'review-hour-probe', name_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' },
      description_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' }, meal_plan_code: null,
      cancellation_policy: { type: 'flexible' }, booking_mode_override: null,
      price_inclusions: [], lifecycle_status: 'draft', sort_order: 197,
    })]), reviewed_at: '2026-08-21T24:00:00Z' }],
  ['expiry-date', plan(control, [operation('exact_date_price', 'create',
    'c1800000-0000-4000-8000-000000000299', {
      hotel_id: FUTURE, room_rate_id: RATE, stay_date: '2027-04-01',
      nightly_rate_mode: 'set', nightly_rate: 99, minimum_stay_mode: null,
      minimum_stay: null, maximum_stay_mode: null, maximum_stay: null,
      reason: 'Invalid expiry transport probe', expires_at: '2027-02-30T12:00:00Z',
    })])],
]) {
  controlled(await rpc('hotel_v2_admin_apply_pricing_control_plan', TOKENS.admin, {
    p_plan: malformedPlan, p_correlation_id: id(930 + statuses.smuggling),
    p_idempotency_key: `admin-c-http-transport-${suffix}`,
  }), 400, '22023', 'hotels_v2_admin_c_invalid_pricing_plan');
  statuses.smuggling += 1;
}

controlled(await apply(control, [operation('rate_rule', 'create',
  'c1700000-0000-4000-8000-000000000194', {
    room_rate_id: RATE, valid_from: '2027-02-29', valid_to: '2027-03-01',
    weekdays: [1], nightly_rate: 90, minimum_stay: null, maximum_stay: null,
    closed_to_arrival: false, closed_to_departure: false, priority: 1,
    is_active: true,
  })], id(925), 'admin-c-http-invalid-rule-date-925'),
400, '22023', 'hotels_v2_admin_c_invalid_rate_rule_dates');
controlled(await apply(control, [operation('exact_date_price', 'create',
  'c1800000-0000-4000-8000-000000000194', {
    hotel_id: FUTURE, room_rate_id: RATE, stay_date: '2027-02-29',
    nightly_rate_mode: 'set', nightly_rate: 99, minimum_stay_mode: null,
    minimum_stay: null, maximum_stay_mode: null, maximum_stay: null,
    reason: 'Invalid exact-date transport probe', expires_at: null,
  })], id(926), 'admin-c-http-invalid-exact-date-926'),
400, '22023', 'hotels_v2_admin_c_invalid_exact_price_date');
statuses.smuggling += 2;

controlled(await rpc('hotel_v2_admin_apply_pricing_control_plan', TOKENS.admin, {
  p_plan: plan(control, [operation('rate_plan', 'create',
    'c1200000-0000-4000-8000-000000000194', {
      code: 'bad-correlation-probe', name_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' },
      description_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' }, meal_plan_code: null,
      cancellation_policy: { type: 'flexible' }, booking_mode_override: null,
      price_inclusions: [], lifecycle_status: 'draft', sort_order: 194,
    })]),
  p_correlation_id: 'c2000000-0000-0000-8000-000000000999',
  p_idempotency_key: 'admin-c-http-bad-correlation-999',
}), 400, '22023', 'hotels_v2_admin_c_invalid_pricing_plan');
statuses.smuggling += 1;

// Reviewed lifecycle is reversible and semantic no-ops do not create versions
// or activity. Duplicate Hotel-scoped codes/pairs fail with controlled 409s.
let planRow = control.rate_plans.find((row) => row.id === PLAN);
let rateRow = control.room_rates.find((row) => row.id === RATE);
let planState = ratePlanState(planRow);
let rateState = roomRateState(rateRow);
result = await apply(control, [
  operation('room_rate', 'disable', RATE, {}, {
    expectedVersion: rateRow.version, original: rateState,
  }),
  operation('rate_plan', 'disable', PLAN, {}, {
    expectedVersion: planRow.version, original: planState,
  }),
], id(100), 'admin-c-http-disable-pair-100');
assert.equal(result.status, 200, JSON.stringify(result.payload));
assert.equal(result.payload.activity.length, 2);
control = result.payload.pricing_control;
assert.equal(control.rate_plans.find((row) => row.id === PLAN).lifecycle_status, 'disabled');
assert.equal(control.room_rates.find((row) => row.id === RATE).lifecycle_status, 'disabled');
statuses.lifecycle += 2;

planRow = control.rate_plans.find((row) => row.id === PLAN);
rateRow = control.room_rates.find((row) => row.id === RATE);
planState = ratePlanState(planRow);
rateState = roomRateState(rateRow);
result = await apply(control, [
  operation('rate_plan', 'update', PLAN, { ...planState, lifecycle_status: 'active' }, {
    expectedVersion: planRow.version, original: planState, activationAck: true,
  }),
  operation('room_rate', 'update', RATE, { ...rateState, lifecycle_status: 'active' }, {
    expectedVersion: rateRow.version, original: rateState, activationAck: true,
  }),
], id(101), 'admin-c-http-reactivate-pair-101');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
assert.equal(control.rate_plans.find((row) => row.id === PLAN).lifecycle_status, 'active');
assert.equal(control.room_rates.find((row) => row.id === RATE).lifecycle_status, 'active');
statuses.lifecycle += 2;

planRow = control.rate_plans.find((row) => row.id === PLAN);
planState = ratePlanState(planRow);
const noOpVersion = planRow.version;
const noOpControl = control;
const noOpOperations = [operation('rate_plan', 'update', PLAN, planState, {
  expectedVersion: planRow.version, original: planState, activationAck: true,
})];
const noOpReviewedAt = new Date().toISOString();
result = await apply(noOpControl, noOpOperations,
  id(102), 'admin-c-http-plan-noop-102', noOpReviewedAt);
assert.equal(result.status, 200, JSON.stringify(result.payload));
assert.equal(result.payload.changed, false);
assert.equal(result.payload.activity.length, 0);
assert.equal(result.payload.pricing_control.rate_plans.find((row) => row.id === PLAN).version,
  noOpVersion);
control = result.payload.pricing_control;
statuses.noops += 1;

const noOpReplay = await apply(noOpControl, noOpOperations,
  id(102), 'admin-c-http-plan-noop-102', noOpReviewedAt);
assert.equal(noOpReplay.status, 200, JSON.stringify(noOpReplay.payload));
assert.equal(noOpReplay.payload.replayed, true);
assert.equal(noOpReplay.payload.changed, false);
assert.equal(noOpReplay.payload.activity.length, 0);
assert.equal(noOpReplay.payload.pricing_control.rate_plans
  .find((row) => row.id === PLAN).version, noOpVersion);
statuses.replays += 1;

controlled(await apply(control, noOpOperations,
  id(102), 'admin-c-http-correlation-conflict-102'),
409, 'PT409', 'hotels_v2_admin_c_correlation_conflict');
statuses.stale += 1;

controlled(await apply(control, [operation('rate_plan', 'create',
  'c1200000-0000-4000-8000-000000000199', {
    ...planState, lifecycle_status: 'draft', sort_order: 199,
  })], id(103), 'admin-c-http-duplicate-plan-103'),
409, 'PT409', 'hotels_v2_admin_c_rate_plan_code_conflict');
controlled(await apply(control, [operation('room_rate', 'create',
  'c1300000-0000-4000-8000-000000000199', {
    ...roomRateState(control.room_rates.find((row) => row.id === RATE)),
    lifecycle_status: 'draft', sort_order: 199,
  })], id(104), 'admin-c-http-duplicate-rate-104'),
409, 'PT409', 'hotels_v2_admin_c_room_rate_pair_conflict');
statuses.lifecycle += 2;

// Shared schedules review the complete tier set and every linked Room Rate.
const scheduleTiers = [1, 2, 3].map((guest) => ({
  id: `c1b00000-0000-4000-8000-${String(100 + guest).padStart(12, '0')}`,
  schedule_id: SCHEDULE, guest_count: guest, threshold_nights: 1,
  nightly_rate: 65 + (guest * 10), is_active: true, version: 0,
}));
result = await apply(control, [operation('pricing_schedule', 'create', SCHEDULE, {
  code: 'shared-http', name_i18n: { pl: 'Wspólny', en: 'Shared', he: 'משותף' },
  application_scope: 'room_occupancy', currency: 'EUR', maximum_party_size: 3,
  minimum_billable_occupancy: 1, sharing_mode: 'shared',
  lifecycle_status: 'active', tiers: scheduleTiers,
}, { activationAck: true })], id(110), 'admin-c-http-schedule-create-110');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
let schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
assert.deepEqual(schedule.linked_room_rate_ids, []);
statuses.schedules += 1;

rateRow = control.room_rates.find((row) => row.id === RATE);
rateState = roomRateState(rateRow);
result = await apply(control, [operation('room_rate', 'update', RATE,
  { ...rateState, pricing_schedule_id: SCHEDULE }, {
    expectedVersion: rateRow.version, original: rateState,
    linkFingerprint: schedule.link_fingerprint, linkedIds: [], sharedAck: true,
    activationAck: true,
  })], id(111), 'admin-c-http-schedule-attach-111');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
assert.deepEqual(schedule.linked_room_rate_ids, [RATE]);
statuses.schedules += 1;

result = await apply(control, [
  operation('rate_plan', 'create', PLAN_TWO, {
    code: 'secondary', name_i18n: { pl: 'Drugi', en: 'Secondary', he: 'שני' },
    description_i18n: { pl: 'Drugi plan', en: 'Secondary plan', he: 'תכנית שניה' },
    meal_plan_code: null, cancellation_policy: { type: 'flexible' },
    booking_mode_override: null, price_inclusions: [], lifecycle_status: 'inactive',
    sort_order: 20,
  }),
  operation('room_rate', 'create', RATE_TWO, {
    room_type_id: ROOM, rate_plan_id: PLAN_TWO, pricing_schedule_id: SCHEDULE,
    base_nightly_rate: 85, currency: 'EUR', external_redirect_url: null,
    lifecycle_status: 'inactive', sort_order: 20,
  }, { linkFingerprint: schedule.link_fingerprint, linkedIds: [RATE], sharedAck: true }),
], id(112), 'admin-c-http-shared-sibling-112');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
assert.deepEqual(schedule.linked_room_rate_ids, [RATE, RATE_TWO].sort());
statuses.schedules += 1;

let scheduleOriginal = scheduleState(schedule);
const editedSchedule = { ...scheduleOriginal,
  name_i18n: { pl: 'Wspólny', en: 'Shared revised', he: 'משותף' },
  tiers: scheduleOriginal.tiers.map((tier) => ({ ...tier,
    nightly_rate: Number(tier.nightly_rate) + 1 })),
};
result = await apply(control, [operation('pricing_schedule', 'update', SCHEDULE,
  editedSchedule, { expectedVersion: schedule.version,
    childrenFingerprint: schedule.tiers_fingerprint,
    linkFingerprint: schedule.link_fingerprint,
    linkedIds: schedule.linked_room_rate_ids, sharedAck: true,
    activationAck: true, original: scheduleOriginal })],
id(113), 'admin-c-http-shared-edit-113');
assert.equal(result.status, 200, JSON.stringify(result.payload));
assert.equal(result.payload.activity.length, 1);
control = result.payload.pricing_control;
schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
assert.deepEqual(schedule.linked_room_rate_ids, [RATE, RATE_TWO].sort());
assert.equal(schedule.name_i18n.en, 'Shared revised');
statuses.schedules += 1;

scheduleOriginal = scheduleState(schedule);
result = await apply(control, [operation('pricing_schedule', 'update', SCHEDULE,
  scheduleOriginal, { expectedVersion: schedule.version,
    childrenFingerprint: schedule.tiers_fingerprint,
    linkFingerprint: schedule.link_fingerprint,
    linkedIds: schedule.linked_room_rate_ids, sharedAck: true,
    activationAck: true, original: scheduleOriginal })],
id(114), 'admin-c-http-shared-noop-114');
assert.equal(result.status, 200, JSON.stringify(result.payload));
assert.equal(result.payload.changed, false);
assert.equal(result.payload.activity.length, 0);
control = result.payload.pricing_control;
statuses.noops += 1;

schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
rateRow = control.room_rates.find((row) => row.id === RATE);
const siblingBefore = structuredClone(control.room_rates.find((row) => row.id === RATE_TWO));
const sourceTierFingerprint = schedule.tiers_fingerprint;
rateState = roomRateState(rateRow);
const clonedTiers = schedule.tiers.map((tier, index) => ({
  id: `c1c00000-0000-4000-8000-${String(101 + index).padStart(12, '0')}`,
  schedule_id: SCHEDULE_CLONE, guest_count: tier.guest_count,
  threshold_nights: tier.threshold_nights, nightly_rate: tier.nightly_rate,
  is_active: tier.is_active, version: 0,
}));
result = await apply(control, [
  operation('pricing_schedule', 'clone', SCHEDULE_CLONE, {
    source_schedule_id: SCHEDULE, expected_source_version: schedule.version,
    code: 'product-clone',
    name_i18n: { pl: 'Kopia produktu', en: 'Product clone', he: 'עותק מוצר' },
    sharing_mode: 'independent', tiers: clonedTiers,
  }, { childrenFingerprint: schedule.tiers_fingerprint,
    linkFingerprint: schedule.link_fingerprint,
    linkedIds: schedule.linked_room_rate_ids, sharedAck: true }),
  operation('room_rate', 'update', RATE,
    { ...rateState, pricing_schedule_id: SCHEDULE_CLONE, lifecycle_status: 'inactive' },
    { expectedVersion: rateRow.version, original: rateState,
      linkFingerprint: schedule.link_fingerprint,
      linkedIds: schedule.linked_room_rate_ids, sharedAck: true }),
], id(115), 'admin-c-http-clone-relink-115');
assert.equal(result.status, 200, JSON.stringify(result.payload));
assert.equal(result.payload.activity.length, 2);
control = result.payload.pricing_control;
schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
let clonedSchedule = control.pricing_schedules.find((row) => row.id === SCHEDULE_CLONE);
const siblingAfter = control.room_rates.find((row) => row.id === RATE_TWO);
assert.deepEqual(schedule.linked_room_rate_ids, [RATE_TWO]);
assert.equal(schedule.tiers_fingerprint, sourceTierFingerprint);
assert.deepEqual(clonedSchedule.linked_room_rate_ids, [RATE]);
assert.equal(clonedSchedule.sharing_mode, 'independent');
assert.equal(siblingAfter.version, siblingBefore.version);
assert.equal(siblingAfter.pricing_schedule_id, siblingBefore.pricing_schedule_id);
statuses.schedules += 1;

rateRow = control.room_rates.find((row) => row.id === RATE);
rateState = roomRateState(rateRow);
result = await apply(control, [operation('room_rate', 'update', RATE,
  { ...rateState, pricing_schedule_id: null, lifecycle_status: 'active' }, {
    expectedVersion: rateRow.version, original: rateState,
    linkFingerprint: clonedSchedule.link_fingerprint,
    linkedIds: clonedSchedule.linked_room_rate_ids, sharedAck: true,
    activationAck: true,
  })], id(116), 'admin-c-http-clone-detach-116');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
clonedSchedule = control.pricing_schedules.find((row) => row.id === SCHEDULE_CLONE);
assert.deepEqual(clonedSchedule.linked_room_rate_ids, []);
statuses.schedules += 1;

let cloneOriginal = scheduleState(clonedSchedule);
result = await apply(control, [operation('pricing_schedule', 'disable', SCHEDULE_CLONE,
  {}, { expectedVersion: clonedSchedule.version,
    childrenFingerprint: clonedSchedule.tiers_fingerprint,
    linkFingerprint: clonedSchedule.link_fingerprint,
    linkedIds: [], original: cloneOriginal })],
id(117), 'admin-c-http-clone-disable-117');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
assert.equal(control.pricing_schedules.find((row) => row.id === SCHEDULE_CLONE)
  .lifecycle_status, 'disabled');
statuses.schedules += 1;

schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
scheduleOriginal = scheduleState(schedule);
result = await apply(control, [operation('pricing_schedule', 'disable', SCHEDULE, {}, {
  expectedVersion: schedule.version, childrenFingerprint: schedule.tiers_fingerprint,
  linkFingerprint: schedule.link_fingerprint, linkedIds: schedule.linked_room_rate_ids,
  sharedAck: true, original: scheduleOriginal,
})], id(118), 'admin-c-http-shared-disable-118');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
schedule = control.pricing_schedules.find((row) => row.id === SCHEDULE);
assert.equal(schedule.lifecycle_status, 'disabled');
statuses.schedules += 1;

scheduleOriginal = scheduleState(schedule);
result = await apply(control, [operation('pricing_schedule', 'update', SCHEDULE,
  { ...scheduleOriginal, lifecycle_status: 'active' }, {
    expectedVersion: schedule.version, childrenFingerprint: schedule.tiers_fingerprint,
    linkFingerprint: schedule.link_fingerprint, linkedIds: schedule.linked_room_rate_ids,
    sharedAck: true, activationAck: true, original: scheduleOriginal,
  })], id(119), 'admin-c-http-shared-reactivate-119');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
assert.equal(control.pricing_schedules.find((row) => row.id === SCHEDULE)
  .lifecycle_status, 'active');
statuses.schedules += 1;

// Property fallback is a distinct, reviewed final source.
result = await apply(control, [operation('property_pricing_default', 'create', DEFAULT, {
  hotel_id: FUTURE, nightly_rate: 72, currency: 'EUR', lifecycle_status: 'active',
}, { activationAck: true })], id(2), 'admin-c-http-default-002');
assert.equal(result.status, 200, JSON.stringify(result.payload));
statuses.mutations += 1;
const staleControl = control;
control = result.payload.pricing_control;

// A plan built against the preceding token is stale after the property default.
const ratePlan = staleControl.rate_plans.find((row) => row.id === PLAN);
const originalPlan = { code: ratePlan.code, name_i18n: ratePlan.name_i18n,
  description_i18n: ratePlan.description_i18n, meal_plan_code: ratePlan.meal_plan_code,
  cancellation_policy: ratePlan.cancellation_policy,
  booking_mode_override: ratePlan.booking_mode_override,
  price_inclusions: ratePlan.price_inclusions, lifecycle_status: ratePlan.lifecycle_status,
  sort_order: ratePlan.sort_order };
const requestsBeforeStale = requestCount;
controlled(await apply(staleControl, [operation('rate_plan', 'update', PLAN, originalPlan, {
  expectedVersion: ratePlan.version, original: originalPlan, activationAck: true,
})], id(3), 'admin-c-http-stale-003'),
409, 'PT409', 'hotels_v2_admin_c_stale_pricing_snapshot');
assert.equal(requestCount - requestsBeforeStale, 1,
  'stale pricing save must issue exactly one HTTP request and never auto-retry');
statuses.stale += 1;
control = await getControl();

const roomRate = control.room_rates.find((row) => row.id === RATE);
const originalRate = { room_type_id: roomRate.room_type_id,
  rate_plan_id: roomRate.rate_plan_id, pricing_schedule_id: roomRate.pricing_schedule_id,
  base_nightly_rate: roomRate.base_nightly_rate, currency: roomRate.currency,
  external_redirect_url: roomRate.external_redirect_url,
  lifecycle_status: roomRate.lifecycle_status, sort_order: roomRate.sort_order };
const fallbackRate = { ...originalRate, base_nightly_rate: 0 };
result = await apply(control, [operation('room_rate', 'update', RATE, fallbackRate, {
  expectedVersion: roomRate.version, original: originalRate, activationAck: true,
})], id(31), 'admin-c-http-property-fallback-031');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
const fallbackQuote = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-08-01', checkOut: '2026-08-02', adults: 2 }),
});
assert.equal(fallbackQuote.status, 200, JSON.stringify(fallbackQuote.payload));
assert.equal(fallbackQuote.payload.products[0].base_pricing_source, 'property_default');
assert.equal(Number(fallbackQuote.payload.customer_total), 72);
statuses.previews += 1;

let defaultRow = control.property_pricing_default;
rateRow = control.room_rates.find((row) => row.id === RATE);
let defaultOriginal = defaultState(defaultRow);
rateState = roomRateState(rateRow);
result = await apply(control, [
  operation('room_rate', 'update', RATE, { ...rateState, base_nightly_rate: 80 }, {
    expectedVersion: rateRow.version, original: rateState, activationAck: true,
  }),
  operation('property_pricing_default', 'disable', DEFAULT, {}, {
    expectedVersion: defaultRow.version, original: defaultOriginal,
  }),
], id(120), 'admin-c-http-default-disable-120');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
assert.equal(control.property_pricing_default.lifecycle_status, 'disabled');
statuses.lifecycle += 1;

defaultRow = control.property_pricing_default;
defaultOriginal = defaultState(defaultRow);
result = await apply(control, [operation('property_pricing_default', 'disable', DEFAULT, {}, {
  expectedVersion: defaultRow.version, original: defaultOriginal,
})], id(121), 'admin-c-http-default-disable-noop-121');
assert.equal(result.status, 200, JSON.stringify(result.payload));
assert.equal(result.payload.changed, false);
assert.equal(result.payload.activity.length, 0);
control = result.payload.pricing_control;
statuses.noops += 1;

defaultRow = control.property_pricing_default;
rateRow = control.room_rates.find((row) => row.id === RATE);
defaultOriginal = defaultState(defaultRow);
rateState = roomRateState(rateRow);
result = await apply(control, [
  operation('property_pricing_default', 'update', DEFAULT,
    { ...defaultOriginal, lifecycle_status: 'active' }, {
      expectedVersion: defaultRow.version, original: defaultOriginal, activationAck: true,
    }),
  operation('room_rate', 'update', RATE, { ...rateState, base_nightly_rate: 0 }, {
    expectedVersion: rateRow.version, original: rateState, activationAck: true,
  }),
], id(122), 'admin-c-http-default-reactivate-122');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
assert.equal(control.property_pricing_default.lifecycle_status, 'active');
assert.equal(control.room_rates.find((row) => row.id === RATE).base_nightly_rate, 0);
statuses.lifecycle += 1;

// Cross-layer equal-priority composition: seasonal > weekday; exact SET then
// exact CLEAR falls through while retaining the selected exact row ID.
const weekdayPayload = { room_rate_id: RATE, valid_from: '2026-09-01',
  valid_to: '2026-09-30', weekdays: [2], nightly_rate: 90,
  minimum_stay: null, maximum_stay: null, closed_to_arrival: false,
  closed_to_departure: false, priority: 10, is_active: true };
const seasonalPayload = { ...weekdayPayload, weekdays: [1, 2, 3, 4, 5, 6, 7],
  nightly_rate: 100 };
result = await apply(control, [
  operation('rate_rule', 'create', WEEKDAY, weekdayPayload),
  operation('rate_rule', 'create', SEASONAL, seasonalPayload),
], id(4), 'admin-c-http-rules-004');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
const weekdayRow = control.rate_rules.find((row) => row.id === WEEKDAY);
const weekdayOriginal = ruleState(weekdayRow);
controlled(await apply(control, [operation('rate_rule', 'update', WEEKDAY,
  { ...weekdayOriginal, room_rate_id: RATE_TWO }, {
    expectedVersion: weekdayRow.version, original: weekdayOriginal,
  })], id(123), 'admin-c-http-rule-reparent-123'),
400, '22023', 'hotels_v2_admin_c_rate_rule_identity_is_immutable');
controlled(await apply(control, [operation('rate_rule', 'create',
  'c1700000-0000-4000-8000-000000000103',
  { ...seasonalPayload, nightly_rate: 101 })],
id(124), 'admin-c-http-same-layer-overlap-124'),
400, '23514', 'hotels_v2_admin_c_equal_priority_rate_rule_overlap');
statuses.smuggling += 2;
let priced = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }),
});
assert.equal(priced.status, 200, JSON.stringify(priced.payload));
assert.equal(priced.payload.nightly_breakdown[0].final_pricing_source, 'seasonal_range_rule');
assert.equal(Number(priced.payload.customer_total), 100);
statuses.previews += 1;

const exactSet = { hotel_id: FUTURE, room_rate_id: RATE, stay_date: '2026-09-01',
  nightly_rate_mode: 'set', nightly_rate: 120, minimum_stay_mode: null,
  minimum_stay: null, maximum_stay_mode: null, maximum_stay: null,
  reason: 'Reviewed exact price', expires_at: null };
result = await apply(control, [operation('exact_date_price', 'create', EXACT, exactSet)],
  id(5), 'admin-c-http-exact-set-005');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
priced = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }),
});
assert.equal(priced.payload.nightly_breakdown[0].final_pricing_source, 'exact_date_price');
assert.equal(priced.payload.nightly_breakdown[0].exact_date_price_id, EXACT);
assert.equal(Number(priced.payload.customer_total), 120);
statuses.previews += 1;

const exactRow = control.exact_date_prices.find((row) => row.id === EXACT);
const exactOriginal = { nightly_rate_mode: exactRow.nightly_rate_mode,
  nightly_rate: exactRow.nightly_rate, minimum_stay_mode: exactRow.minimum_stay_mode,
  minimum_stay: exactRow.minimum_stay, maximum_stay_mode: exactRow.maximum_stay_mode,
  maximum_stay: exactRow.maximum_stay, reason: exactRow.pricing_reason,
  expires_at: exactRow.pricing_expires_at };
const exactClear = { nightly_rate_mode: 'clear', nightly_rate: null,
  minimum_stay_mode: null, minimum_stay: null, maximum_stay_mode: null,
  maximum_stay: null, reason: 'Reviewed explicit clear', expires_at: null };
result = await apply(control, [operation('exact_date_price', 'update', EXACT, exactClear, {
  expectedVersion: exactRow.version, original: exactOriginal,
})], id(6), 'admin-c-http-exact-clear-006');
assert.equal(result.status, 200, JSON.stringify(result.payload));
control = result.payload.pricing_control;
priced = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(control, { planId: PLAN, allocationId: ALLOCATION,
    roomId: ROOM, checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }),
});
assert.equal(priced.payload.nightly_breakdown[0].final_pricing_source, 'seasonal_range_rule');
assert.equal(priced.payload.nightly_breakdown[0].exact_date_price_id, EXACT);
assert.equal(Number(priced.payload.customer_total), 100);
statuses.previews += 1;

// The retained Calendar seam accepts opaque provider provenance only on its
// known payload path, strips it before the preserved core, and cannot smuggle
// any ADMIN-C price field or create a second Room/date row.
const beforeCalendarToken = control.snapshot_token;
let calendar = await getCalendar(FUTURE, '2027-02-10');
let calendarResult = await rpc('hotel_v2_admin_apply_calendar_plan', TOKENS.admin, {
  p_plan: calendarPlan(calendar, [calendarOperation('calendar_override', 'create',
    CALENDAR_EXACT, 0, { room_rate_id: RATE, stay_date: '2027-02-10',
      closed: true, closed_mode: 'set', reason: 'Operational closure HTTP fixture',
      expires_at: null, is_active: true, source: 'sync',
      source_timestamp: 'not-a-reviewed-timestamp',
      provenance: { provider_id: 'opaque-provider-key',
        expires_at: 'opaque-provider-expiry' } })]),
  p_correlation_id: id(130),
});
assert.equal(calendarResult.status, 200, JSON.stringify(calendarResult.payload));
control = await getControl();
assert.equal(control.snapshot_token, beforeCalendarToken);
const closureOnly = control.exact_date_prices.find((row) => row.id === CALENDAR_EXACT);
assert.equal(closureOnly.pricing_configured, false);
assert.equal(closureOnly.shared_with_calendar, true);
statuses.compatibility += 1;

calendar = await getCalendar(FUTURE, '2027-02-10');
controlled(await rpc('hotel_v2_admin_apply_calendar_plan', TOKENS.admin, {
  p_plan: calendarPlan(calendar, [calendarOperation('calendar_override', 'update',
    CALENDAR_EXACT, Number(calendar.calendar_overrides.find(
      (row) => row.id === CALENDAR_EXACT).version), { nightly_rate: 1 })]),
  p_correlation_id: id(131),
}), 403, '42501', 'hotels_v2_admin_c_calendar_pricing_smuggling_denied');
statuses.smuggling += 1;

controlled(await rpc('hotel_v2_admin_apply_calendar_plan', TOKENS.admin, {
  p_plan: calendarPlan(calendar, [calendarOperation('calendar_override', 'create',
    CALENDAR_COLLISION, 0, { room_rate_id: RATE, stay_date: '2027-02-10',
      closed: false, closed_mode: 'set', reason: 'Colliding Room/date HTTP fixture' })]),
  p_correlation_id: id(132),
}), 409, 'PT409', 'hotels_v2_admin_c_calendar_override_key_exists_use_existing_id');
statuses.compatibility += 1;

// Old exact receipt replays before freshness; the same old timestamp under a
// new key is rejected without a write.
const oldPlan = plan(initialControl, [operation('property_pricing_default', 'create',
  'c1ff0000-0000-4000-8000-000000000001', {
    hotel_id: FUTURE, nightly_rate: 99, currency: 'EUR', lifecycle_status: 'draft',
  })], '2000-01-01T00:00:00.000000Z');
const oldReceiptProbe = await rpc('hotel_v2_admin_apply_pricing_control_plan', TOKENS.admin, {
  p_plan: oldPlan, p_correlation_id: 'c2ff0000-0000-4000-8000-000000000001',
  p_idempotency_key: 'admin-c-durable-old-replay-001',
});
assert.equal(oldReceiptProbe.status, 200, JSON.stringify(oldReceiptProbe.payload));
assert.equal(oldReceiptProbe.payload.replayed, true);
statuses.replays += 1;

const expired = await apply(control, [operation('rate_plan', 'update', PLAN,
  originalPlan, { expectedVersion: ratePlan.version, original: originalPlan,
    activationAck: true })], id(7), 'admin-c-http-expired-new-007',
'2000-01-01T00:00:00.000000Z');
controlled(expired, 400, '22023', 'hotels_v2_admin_c_pricing_review_expired');
statuses.smuggling += 1;

// 7K stays read/preview-only, including 1->2 pricing floor and 70/0-backed
// guests 1..8 allocation mapping.
const legacy = await getControl(K7);
assert.equal(legacy.legacy_safety.architecture_version, 'legacy');
assert.equal(legacy.legacy_safety.public_change, false);
for (let guests = 1; guests <= 8; guests += 1) {
  const allocationId = guests <= 4
    ? '31000000-0000-4000-8000-000000000014'
    : `31000000-0000-4000-8000-${String(10 + guests).padStart(12, '0')}`;
  const legacyQuote = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
    p_request: previewRequest(legacy, { planId: K7_PLAN, allocationId,
      roomId: guests <= 4 ? K7_UPPER : null,
      checkIn: '2026-09-01', checkOut: '2026-09-03', adults: guests }),
  });
  assert.equal(legacyQuote.status, 200, JSON.stringify(legacyQuote.payload));
  assert.equal(legacyQuote.payload.ok, true, JSON.stringify(legacyQuote.payload));
  const actualPhysical = legacyQuote.payload.allocation.map(
    (row) => Number(row.allocated_guest_count));
  const actualPricing = legacyQuote.payload.products.map(
    (row) => Number(row.requested_pricing_guest_count));
  const expectedPhysical = guests === 5 ? [3, 2] : guests === 6 ? [3, 3]
    : guests === 7 ? [4, 3] : guests === 8 ? [4, 4] : [guests];
  const expectedPricing = guests === 5 ? [2, 2] : guests === 6 ? [3, 3]
    : guests === 7 ? [4, 4] : guests === 8 ? [4, 4] : [guests];
  assert.deepEqual(actualPhysical, expectedPhysical);
  assert.deepEqual(actualPricing, expectedPricing);
  const allocated = actualPhysical.reduce((sum, count) => sum + count, 0);
  assert.equal(allocated, guests);
  if (guests === 1) assert.equal(legacyQuote.payload.products[0].resolved_pricing_guest_count, 2);
  statuses.legacy += 1;
}
for (const nights of [2, 3, 7, 14, 15]) {
  const departure = new Date('2026-09-01T00:00:00Z');
  departure.setUTCDate(departure.getUTCDate() + nights);
  const legacyQuote = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
    p_request: previewRequest(legacy, { planId: K7_PLAN,
      allocationId: '31000000-0000-4000-8000-000000000014', roomId: K7_UPPER,
      checkIn: '2026-09-01', checkOut: departure.toISOString().slice(0, 10), adults: 2 }),
  });
  assert.equal(legacyQuote.status, 200, JSON.stringify(legacyQuote.payload));
  assert.equal(legacyQuote.payload.ok, true, JSON.stringify(legacyQuote.payload));
  assert.equal(Number(legacyQuote.payload.products[0].los_threshold_nights),
    Math.min(nights, 10));
  statuses.legacy += 1;
}
const oneNight = await rpc('hotel_v2_admin_preview_pricing_quote', TOKENS.admin, {
  p_request: previewRequest(legacy, { planId: K7_PLAN,
    allocationId: '31000000-0000-4000-8000-000000000014', roomId: K7_UPPER,
    checkIn: '2026-09-01', checkOut: '2026-09-02', adults: 2 }),
});
assert.equal(oneNight.payload.ok, false);
assert.equal(oneNight.payload.customer_total, null);
assert.ok(oneNight.payload.blocking_reasons.some((row) => row.code === 'below_minimum_stay'));
statuses.legacy += 1;

controlled(await apply(legacy, [operation('property_pricing_default', 'create',
  'c1900000-0000-4000-8000-000000000101', {
    hotel_id: K7, nightly_rate: 100, currency: 'EUR', lifecycle_status: 'draft',
  })], id(90), 'admin-c-http-7k-freeze-090'),
500, '55000', 'hotels_v2_admin_c_h3_1p_graph_immutable');
statuses.legacy += 1;

console.log(JSON.stringify({
  gate: 'hotels_v2_admin_c_pricing_control_postgrest',
  status: 'PASS', http_statuses: statuses,
  assertions: {
    flags_off: true, generic_one_room: true, property_default: true,
    weekday_seasonal_exact_clear: true, calendar_compatibility_isolated: true,
    durable_replay_pg_fixture: true, noop_receipt_replay: true,
    canonical_uuid_date_time_transport: true,
    exact_child_ages_and_demographic_capacity: true,
    mixed_demographic_preview_fails_closed_in_pg_gate: true,
    legacy_guest_mappings: 8, legacy_physical_pricing_mapping_exact: true,
    legacy_los_threshold_probes: 5, legacy_highest_los_continuation: 10,
    legacy_oracle_cases: 70, legacy_oracle_mismatches: 0,
  },
}));
