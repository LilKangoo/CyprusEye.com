import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE_URL = process.env.HOTELS_ADMIN_D_POSTGREST_URL || 'http://127.0.0.1:53017';
const parsed = new URL(BASE_URL);
assert.equal(parsed.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname));

const HOTEL = 'c1000000-0000-4000-8000-000000000001';
const ROOM = 'c1100000-0000-4000-8000-000000000001';
const UNIT = 'c1600000-0000-4000-8000-000000000001';
const RATE = 'c1300000-0000-4000-8000-000000000001';
const RULE = 'c1700000-0000-4000-8000-000000000001';
const BOOKING = 'c1a00000-0000-4000-8000-000000000001';
const HOLD = 'c1b00000-0000-4000-8000-000000000001';
const cyprusDateParts = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Nicosia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]),
);
const baseDay = new Date(Date.UTC(
  Number(cyprusDateParts.year),
  Number(cyprusDateParts.month) - 1,
  Number(cyprusDateParts.day) + 30,
)).toISOString().slice(0, 10);
const day = new Date(Date.UTC(
  Number(cyprusDateParts.year),
  Number(cyprusDateParts.month) - 1,
  Number(cyprusDateParts.day) + 35,
)).toISOString().slice(0, 10);
const statuses = { denied: 0, rawDenied: 0, get: 0, preview: 0, apply: 0,
  replay: 0, noop: 0, stale: 0, smuggling: 0, unitBlock: 0, sharedExact: 0,
  rule: 0, hold: 0, booking: 0, stay: 0, correlation: 0 };

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE_URL}${path}`, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const text = await response.text(); let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  return { status: response.status, payload };
}
const rpc = (name, token, body = {}) => request(`/rpc/${name}`, { token, method: 'POST', body });

for (const token of [undefined, TOKENS.anon, TOKENS.nonAdmin, TOKENS.owner]) {
  for (const [name, body] of [
    ['hotel_v2_admin_get_availability_control', { p_hotel_id: HOTEL, p_from: day, p_to: day }],
    ['hotel_v2_admin_preview_availability_plan', { p_draft: {} }],
    ['hotel_v2_admin_apply_availability_control_plan', { p_plan: {},
      p_correlation_id: 'd1900000-0000-4000-8000-000000000001', p_idempotency_key: 'denied-admin-d-gate' }],
    ['hotel_v2_admin_preview_stay', { p_request: {} }],
  ]) {
    const denied = await rpc(name, token, body);
    assert.ok([401, 403].includes(denied.status), JSON.stringify(denied)); statuses.denied += 1;
  }
}
for (const relation of ['hotel_unit_calendar_blocks', 'hotel_inventory_day_locks',
    'hotel_inventory_holds', 'hotel_booking_room_allocations', 'hotel_inventory_commitments',
    'hotel_admin_availability_action_receipts', 'hotel_admin_availability_plan_reviews',
    'hotel_admin_availability_foundation_receipts', 'hotel_room_types', 'hotel_units',
    'hotel_rate_plans', 'hotel_room_rates', 'hotel_rate_rules', 'hotel_daily_inventory',
    'hotel_daily_rates', 'hotel_calendar_overrides']) {
  const denied = await request(`/${relation}?select=*`, { token: TOKENS.admin });
  assert.ok([401, 403].includes(denied.status), JSON.stringify(denied)); statuses.rawDenied += 1;
}

const get = await rpc('hotel_v2_admin_get_availability_control', TOKENS.admin,
  { p_hotel_id: HOTEL, p_from: day, p_to: day });
assert.equal(get.status, 200, JSON.stringify(get));
const control = get.payload; assert.equal(control.contract_version, 'hotels_v2_admin_d_availability_control_v1');
assert.equal(control.public_change, false); statuses.get += 1;

const draft = { contract_version: 'hotels_v2_admin_d_availability_draft_v1',
  hotel_id: HOTEL, from: day, to: day, snapshot_token: control.snapshot_token,
  intents: [{ entity: 'daily_inventory', action: 'upsert', id: null,
    payload: { room_type_id: ROOM, stay_date: day, sellable_units: 0,
      sellable_units_mode: 'set', closed: false, closed_mode: 'set',
      reason: 'ADMIN-D PostgREST gate', expires_at: null } }] };
const preview = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin, { p_draft: draft });
assert.equal(preview.status, 200, JSON.stringify(preview)); assert.equal(preview.payload.changed, true); statuses.preview += 1;

const applyBody = { p_plan: preview.payload.reviewed_plan,
  p_correlation_id: 'd1000000-0000-4000-8000-000000000001',
  p_idempotency_key: 'admin-d-http-gate-0001' };
const applied = await rpc('hotel_v2_admin_apply_availability_control_plan', TOKENS.admin, applyBody);
assert.equal(applied.status, 200, JSON.stringify(applied)); assert.equal(applied.payload.changed, true);
assert.equal(applied.payload.replayed, false); statuses.apply += 1;
const replayed = await rpc('hotel_v2_admin_apply_availability_control_plan', TOKENS.admin, applyBody);
assert.equal(replayed.status, 200, JSON.stringify(replayed)); assert.equal(replayed.payload.replayed, true); statuses.replay += 1;

const current = (await rpc('hotel_v2_admin_get_availability_control', TOKENS.admin,
  { p_hotel_id: HOTEL, p_from: day, p_to: day })).payload;
const noopDraft = structuredClone(draft); noopDraft.snapshot_token = current.snapshot_token;
const noop = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin, { p_draft: noopDraft });
assert.equal(noop.status, 200, JSON.stringify(noop)); assert.equal(noop.payload.changed, false);
assert.deepEqual(noop.payload.reviewed_plan.operations, []); statuses.noop += 1;

const stale = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin, { p_draft: draft });
assert.equal(stale.status, 409, JSON.stringify(stale)); statuses.stale += 1;
const smuggled = structuredClone(noopDraft); smuggled.intents[0].id = 'd1000000-0000-4000-8000-000000000099';
const rejected = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin, { p_draft: smuggled });
assert.equal(rejected.status, 400, JSON.stringify(rejected)); statuses.smuggling += 1;
for (const bad of [
  { ...noopDraft, hotel_id: 'c1' },
  { ...noopDraft, intents: [{ ...noopDraft.intents[0], payload: {
    ...noopDraft.intents[0].payload, commission_policy_id: 'd1000000-0000-4000-8000-000000000099' } }] },
  { ...noopDraft, intents: [{ ...noopDraft.intents[0], payload: {
    ...noopDraft.intents[0].payload, room_type_id: 'd1000000-0000-4000-8000-000000000099' } }] },
]) {
  const badResult = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin, { p_draft: bad });
  assert.ok([400, 409].includes(badResult.status), JSON.stringify(badResult)); statuses.smuggling += 1;
}

const collision = await rpc('hotel_v2_admin_apply_availability_control_plan', TOKENS.admin,
  { ...applyBody, p_idempotency_key: 'admin-d-http-correlation-collision' });
assert.equal(collision.status, 409, JSON.stringify(collision)); statuses.correlation += 1;
const idempotencyConflict = await rpc('hotel_v2_admin_apply_availability_control_plan', TOKENS.admin,
  { ...applyBody, p_correlation_id: 'd1000000-0000-4000-8000-000000000098' });
assert.equal(idempotencyConflict.status, 409, JSON.stringify(idempotencyConflict)); statuses.correlation += 1;
const crossActorCollision = await rpc('hotel_v2_admin_apply_availability_control_plan', TOKENS.secondOwner,
  { ...applyBody, p_idempotency_key: 'admin-d-http-cross-actor-collision' });
assert.equal(crossActorCollision.status, 409, JSON.stringify(crossActorCollision)); statuses.correlation += 1;

const badExpiry = structuredClone(noopDraft);
badExpiry.intents[0].payload.expires_at = '2035-01-01 12:00:00+00';
const badExpiryResult = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin,
  { p_draft: badExpiry });
assert.equal(badExpiryResult.status, 400, JSON.stringify(badExpiryResult)); statuses.smuggling += 1;

const plus = (iso, days) => new Date(`${iso}T12:00:00Z`).valueOf() + days * 86400000;
const isoPlus = (iso, days) => new Date(plus(iso, days)).toISOString().slice(0, 10);
async function getControl(from, to = from) {
  const result = await rpc('hotel_v2_admin_get_availability_control', TOKENS.admin,
    { p_hotel_id: HOTEL, p_from: from, p_to: to });
  assert.equal(result.status, 200, JSON.stringify(result)); return result.payload;
}
async function reviewApply(from, to, intent, correlation, key) {
  const snapshot = await getControl(from, to);
  const reviewed = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin, { p_draft: {
    contract_version: 'hotels_v2_admin_d_availability_draft_v1', hotel_id: HOTEL,
    from, to, snapshot_token: snapshot.snapshot_token, intents: [intent],
  } });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed));
  const result = await rpc('hotel_v2_admin_apply_availability_control_plan', TOKENS.admin, {
    p_plan: reviewed.payload.reviewed_plan, p_correlation_id: correlation, p_idempotency_key: key,
  });
  assert.equal(result.status, 200, JSON.stringify(result)); return { reviewed: reviewed.payload, result: result.payload };
}

const blockDay = isoPlus(baseDay, 1);
const block = await reviewApply(blockDay, blockDay, { entity: 'unit_calendar_block', action: 'create',
  id: 'd2100000-0000-4000-8000-000000000001', payload: { unit_id: UNIT, room_type_id: ROOM,
    from_date: blockDay, to_date: blockDay, blocked: true, reason: 'HTTP reviewed Unit maintenance',
    expires_at: null, is_active: true } }, 'd1100000-0000-4000-8000-000000000002',
  'admin-d-http-unit-block-0002');
assert.equal(block.result.changed, true); statuses.unitBlock += 1;
const blockControl = await getControl(blockDay);
const overlap = await rpc('hotel_v2_admin_preview_availability_plan', TOKENS.admin, { p_draft: {
  contract_version: 'hotels_v2_admin_d_availability_draft_v1', hotel_id: HOTEL,
  from: blockDay, to: blockDay, snapshot_token: blockControl.snapshot_token, intents: [{
    entity: 'unit_calendar_block', action: 'create', id: 'd2100000-0000-4000-8000-000000000002',
    payload: { unit_id: UNIT, room_type_id: ROOM, from_date: blockDay, to_date: blockDay,
      blocked: true, reason: 'Overlapping Unit block', expires_at: null, is_active: true },
  }],
} });
assert.equal(overlap.status, 400, JSON.stringify(overlap));

const exactDay = isoPlus(baseDay, 2);
const exact = await reviewApply(exactDay, exactDay, { entity: 'operational_override', action: 'update',
  id: 'c1800000-0000-4000-8000-000000000001', payload: { room_rate_id: RATE,
    stay_date: exactDay, closed: true, closed_mode: 'set', reason: 'HTTP reviewed exact closure',
    availability_active: true } }, 'd1100000-0000-4000-8000-000000000003',
  'admin-d-http-exact-closure-0003');
assert.ok(exact.result.availability_control.product_cells.some((cell) =>
  cell.room_rate_id === RATE && cell.stay_date === exactDay && cell.operational_closed));
statuses.sharedExact += 1;

const ruleTo = isoPlus(baseDay, 15);
const rule = await reviewApply(baseDay, ruleTo, { entity: 'rate_rule_operational_restriction',
  action: 'update', id: RULE, payload: { closed_to_arrival: true, closed_to_departure: false,
    reason: 'HTTP reviewed shared CTA' } }, 'd1100000-0000-4000-8000-000000000004',
  'admin-d-http-rule-0004');
assert.equal(rule.result.changed, true); statuses.rule += 1;

const holdDay = isoPlus(baseDay, 6);
const hold = await reviewApply(holdDay, holdDay, { entity: 'hold', action: 'release', id: HOLD,
  payload: { reason: 'HTTP reviewed hold release' } }, 'd1100000-0000-4000-8000-000000000005',
  'admin-d-http-hold-0005');
assert.equal(hold.result.changed, true); statuses.hold += 1;

const bookingFrom = isoPlus(baseDay, 3); const bookingTo = isoPlus(baseDay, 4);
let bookingControl = await getControl(bookingFrom, bookingTo);
const blocker = bookingControl.unmapped_booking_blockers.find((row) => row.booking_id === BOOKING);
assert.ok(blocker, JSON.stringify(bookingControl.unmapped_booking_blockers));
const mapped = await reviewApply(bookingFrom, bookingTo, { entity: 'booking_allocation', action: 'map',
  id: null, payload: { booking_id: BOOKING, booking_updated_at: blocker.booking_updated_at,
    allocations: [{ id: 'd4100000-0000-4000-8000-000000000001', room_type_id: ROOM,
      rate_plan_id: 'c1200000-0000-4000-8000-000000000001', room_rate_id: RATE,
      unit_ids: [UNIT], units_required: 1, allocated_guest_counts: [1], pricing_guest_counts: [1] }] } },
  'd1100000-0000-4000-8000-000000000006', 'admin-d-http-booking-map-0006');
assert.equal(mapped.result.changed, true);
const released = await reviewApply(bookingFrom, bookingTo, { entity: 'booking_allocation', action: 'release',
  id: BOOKING, payload: { booking_id: BOOKING, reason: 'HTTP reviewed allocation release' } },
  'd1100000-0000-4000-8000-000000000007', 'admin-d-http-booking-release-0007');
assert.equal(released.result.changed, true); statuses.booking += 1;

const stayControl = await getControl(bookingFrom, isoPlus(bookingTo, 1));
const stay = await rpc('hotel_v2_admin_preview_stay', TOKENS.admin, { p_request: {
  contract_version: 'hotels_v2_admin_d_stay_preview_request_v1', hotel_id: HOTEL,
  arrival_date: bookingFrom, departure_date: isoPlus(bookingTo, 1), adults: 1, child_ages: [],
  room_type_id: ROOM, room_rate_id: RATE, rate_plan_id: 'c1200000-0000-4000-8000-000000000001',
  allocation_rule_id: 'c1400000-0000-4000-8000-000000000001',
  availability_snapshot_token: stayControl.snapshot_token,
} });
assert.equal(stay.status, 200, JSON.stringify(stay));
assert.equal(stay.payload.requestable, false); assert.ok(stay.payload.blocking_reasons.includes('public_activation_off'));
statuses.stay += 1;

console.log(JSON.stringify({ hotels_v2_admin_d_availability_inventory_postgrest_gate_safe: true, statuses }));
