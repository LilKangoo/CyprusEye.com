import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE_URL = process.env.HOTELS_H3_2B_POSTGREST_URL || 'http://127.0.0.1:53018';
const parsed = new URL(BASE_URL);
assert.equal(parsed.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname));

const HOTEL_7K = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const HOTEL_RGB = 'c1000000-0000-4000-8000-000000000001';
const PARTNER = '20000000-0000-4000-8000-000000000001';
const stats = { denied: 0, rawDenied: 0, get: 0, preview: 0, apply: 0,
  replay: 0, stale: 0, smuggling: 0, commission: 0, immutable: 0 };

const cyprus = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Nicosia', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).filter((part) => part.type !== 'literal')
  .map((part) => [part.type, part.value]));
const isoDay = (offset) => new Date(Date.UTC(Number(cyprus.year), Number(cyprus.month) - 1,
  Number(cyprus.day) + offset)).toISOString().slice(0, 10);
const from = isoDay(30);
const to = isoDay(37);
const inventoryDay = isoDay(40);

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE_URL}${path}`, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  return { status: response.status, ok: response.ok, payload };
}
const rpc = (name, token, body = {}) => request(`/rpc/${name}`, {
  token, method: 'POST', body,
});
const denied = (result, label) => {
  assert.ok([401, 403, 404].includes(result.status), `${label}: ${JSON.stringify(result)}`);
  stats.denied += 1;
};
function commercialRequest(workspace, hotelId, checkIn, checkOut, preferBundle = false) {
  const rules = workspace.pricing.allocation_rules;
  const rule = (preferBundle
    ? rules.find((item) => item.allocation_mode === 'required_bundle' && item.items.length >= 2)
    : null) || rules.find((item) => item.items.length > 0);
  const plan = workspace.pricing.rate_plans.find((candidate) => rule.items.every((item) =>
    workspace.pricing.room_rates.some((rate) => rate.rate_plan_id === candidate.id
      && rate.room_type_id === item.room_type_id))) || workspace.pricing.rate_plans[0];
  assert.ok(rule && plan, `${hotelId} fixture lacks exact commercial allocation`);
  const selectedRoom = rule.allocation_mode === 'customer_choice'
    ? rule.items[0].room_type_id : null;
  return { contract_version: 'hotels_v2_h3_2b_commercial_stay_request_v1',
    partner_id: PARTNER, hotel_id: hotelId,
    pricing_snapshot_token: workspace.pricing.snapshot_token,
    rate_plan_id: plan.id, allocation_rule_id: rule.id,
    selected_room_type_id: selectedRoom, check_in: checkIn, check_out: checkOut,
    adults: Math.max(1, Number(rule.min_guest_count)), child_ages: [] };
}
const cents = (value) => BigInt(Math.round(Number(value) * 100));

const getBody = { p_partner_id: PARTNER, p_hotel_id: HOTEL_7K, p_from: from, p_to: to };
for (const token of [undefined, TOKENS.anon]) {
  for (const [name, body] of [
    ['hotel_v2_partner_get_workspace', getBody],
    ['hotel_v2_partner_preview_content_plan', { p_draft: {} }],
    ['hotel_v2_partner_apply_content_plan', { p_reviewed_plan: {},
      p_correlation_id: '39100000-0000-4000-8000-000000000001',
      p_idempotency_key: '39200000-0000-4000-8000-000000000001' }],
    ['hotel_v2_partner_preview_pricing_plan', { p_draft: {} }],
    ['hotel_v2_partner_apply_pricing_plan', { p_reviewed_plan: {},
      p_correlation_id: '39100000-0000-4000-8000-000000000002',
      p_idempotency_key: '39200000-0000-4000-8000-000000000002' }],
    ['hotel_v2_partner_preview_commercial_stay', { p_request: {} }],
    ['hotel_v2_partner_preview_availability_plan', { p_draft: {} }],
    ['hotel_v2_partner_apply_availability_plan', { p_reviewed_plan: {},
      p_correlation_id: '39100000-0000-4000-8000-000000000003',
      p_idempotency_key: '39200000-0000-4000-8000-000000000003' }],
  ]) denied(await rpc(name, token, body), `${token ? 'anon JWT' : 'no JWT'} ${name}`);
}

denied(await rpc('hotel_v2_partner_get_workspace', TOKENS.nonAdmin, getBody), 'nonmember GET');
denied(await rpc('hotel_v2_partner_get_workspace', TOKENS.unassignedOwner, getBody),
  'foreign Partner owner 7 Arches GET');
denied(await rpc('hotel_v2_partner_get_workspace', TOKENS.owner,
  { ...getBody, p_partner_id: '20000000-0000-4000-8000-000000000005' }), 'foreign partner GET');

const workspaceResult = await rpc('hotel_v2_partner_get_workspace', TOKENS.owner, getBody);
assert.equal(workspaceResult.status, 200, JSON.stringify(workspaceResult));
const workspace = workspaceResult.payload;
assert.deepEqual(Object.keys(workspace).sort(), [
  'assignment', 'availability', 'content_snapshot_token', 'contract_version', 'feature_flags',
  'hotel_id', 'legacy_authoritative', 'partner', 'pricing', 'property', 'property_draft',
  'public_change', 'recent_activity', 'rooms', 'sections', 'units',
].sort());
assert.equal(workspace.contract_version, 'hotels_v2_h3_2b_partner_workspace_v1');
assert.equal(workspace.legacy_authoritative, true);
assert.equal(workspace.public_change, false);
assert.equal(workspace.pricing.commission_policy.commission_mode,
  'per_allocated_room_per_night');
assert.equal(Number(workspace.pricing.commission_policy.amount), 10);
assert.equal(workspace.pricing.commission_policy.currency, 'EUR');
assert.equal(workspace.pricing.commission_policy.read_only, true);
stats.get += 1; stats.commission += 1;
const coOwnerWorkspaces = await Promise.all([
  rpc('hotel_v2_partner_get_workspace', TOKENS.coOwnerA, getBody),
  rpc('hotel_v2_partner_get_workspace', TOKENS.coOwnerB, getBody),
]);
for (const [index, result] of coOwnerWorkspaces.entries()) {
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.payload.hotel_id, HOTEL_7K);
  assert.deepEqual(result.payload.partner, workspace.partner,
    `co-owner ${index + 1} Partner scope differs`);
  assert.deepEqual(result.payload.assignment, workspace.assignment,
    `co-owner ${index + 1} assignment/capabilities differ`);
  assert.deepEqual(result.payload.sections, workspace.sections,
    `co-owner ${index + 1} workspace sections differ`);
  assert.deepEqual(result.payload.pricing.commission_policy,
    workspace.pricing.commission_policy,
    `co-owner ${index + 1} commission visibility differs`);
  stats.get += 1;
}

const fixedStayRequest = commercialRequest(workspace, HOTEL_7K, isoDay(31), isoDay(33), true);
denied(await rpc('hotel_v2_partner_preview_commercial_stay', TOKENS.nonAdmin,
  { p_request: fixedStayRequest }), 'nonmember commercial stay');
const fixedStay = await rpc('hotel_v2_partner_preview_commercial_stay', TOKENS.owner,
  { p_request: fixedStayRequest });
assert.equal(fixedStay.status, 200, JSON.stringify(fixedStay));
assert.equal(fixedStay.payload.ok, true, JSON.stringify(fixedStay.payload));
const fixedQuantity = fixedStay.payload.pricing.products.length
  * Number(fixedStay.payload.pricing.nights);
assert.ok(fixedStay.payload.pricing.products.length >= 2, '7K fixed quote must exercise bundle products');
assert.equal(fixedStay.payload.commercial.calculation_basis.quantity, fixedQuantity);
assert.equal(Number(fixedStay.payload.commercial.calculation_basis.unit_amount), 10);
assert.equal(cents(fixedStay.payload.commercial.cypruseye_commission), BigInt(fixedQuantity * 1000));
assert.equal(cents(fixedStay.payload.commercial.customer_price),
  cents(fixedStay.payload.commercial.cypruseye_commission)
    + cents(fixedStay.payload.commercial.partner_net));
stats.commission += 1;

const contentDraft = {
  contract_version: 'hotels_v2_h3_2b_content_draft_v1', partner_id: PARTNER,
  hotel_id: HOTEL_7K, access_snapshot_token: workspace.assignment.access_snapshot_token,
  content_snapshot_token: workspace.content_snapshot_token,
  intent: { entity: 'property_content', action: 'update', id: HOTEL_7K,
    payload: { title_i18n: { pl: 'Partner HTTP draft Hotel', en: 'Partner HTTP Hotel draft',
      he: 'טיוטת HTTP של מלון שותף' } }, reason: 'Partner HTTP content review' },
};
const contentPreview = await rpc('hotel_v2_partner_preview_content_plan', TOKENS.owner,
  { p_draft: contentDraft });
assert.equal(contentPreview.status, 200, JSON.stringify(contentPreview));
assert.equal(contentPreview.payload.changed, true);
assert.equal(contentPreview.payload.reviewed_plan.operations.length, 1);
stats.preview += 1;

denied(await rpc('hotel_v2_partner_preview_content_plan', TOKENS.nonAdmin,
  { p_draft: contentDraft }), 'nonmember content Preview');
const foreignContentApply = await rpc('hotel_v2_partner_apply_content_plan', TOKENS.nonAdmin, {
  p_reviewed_plan: contentPreview.payload.reviewed_plan,
  p_correlation_id: '39100000-0000-4000-8000-000000000010',
  p_idempotency_key: '39200000-0000-4000-8000-000000000010',
});
assert.equal(foreignContentApply.status, 409, JSON.stringify(foreignContentApply));
assert.equal(foreignContentApply.payload?.message, 'hotels_v2_h3_2b_review_not_applicable');
stats.denied += 1;

const contentApplyBody = { p_reviewed_plan: contentPreview.payload.reviewed_plan,
  p_correlation_id: '39100000-0000-4000-8000-000000000011',
  p_idempotency_key: '39200000-0000-4000-8000-000000000011' };
const contentApplied = await rpc('hotel_v2_partner_apply_content_plan', TOKENS.owner,
  contentApplyBody);
assert.equal(contentApplied.status, 200, JSON.stringify(contentApplied));
assert.equal(contentApplied.payload.replayed, false);
assert.equal(contentApplied.payload.workspace, null);
assert.equal(contentApplied.payload.activity.length, 1);
stats.apply += 1;
const contentReplay = await rpc('hotel_v2_partner_apply_content_plan', TOKENS.owner,
  contentApplyBody);
assert.equal(contentReplay.status, 200, JSON.stringify(contentReplay));
assert.equal(contentReplay.payload.replayed, true);
assert.equal(contentReplay.payload.idempotency_key, contentApplyBody.p_idempotency_key);
stats.replay += 1;
const keyConflict = await rpc('hotel_v2_partner_apply_content_plan', TOKENS.owner, {
  ...contentApplyBody, p_correlation_id: '39100000-0000-4000-8000-000000000012',
});
assert.equal(keyConflict.status, 409, JSON.stringify(keyConflict));
const staleContent = await rpc('hotel_v2_partner_preview_content_plan', TOKENS.owner,
  { p_draft: contentDraft });
assert.equal(staleContent.status, 409, JSON.stringify(staleContent));
stats.stale += 2;

const smuggled = structuredClone(contentDraft);
smuggled.hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6c';
const smugglingResult = await rpc('hotel_v2_partner_preview_content_plan', TOKENS.owner,
  { p_draft: smuggled });
assert.equal(smugglingResult.status, 400, JSON.stringify(smugglingResult));
stats.smuggling += 1;

const rate = workspace.pricing.room_rates.find((row) => row.base_nightly_rate_authoritative)
  || workspace.pricing.room_rates[0];
assert.ok(rate, '7K fixture has no Room Rate');
const immutableDraft = { contract_version: 'hotels_v2_h3_2b_pricing_draft_v1',
  partner_id: PARTNER, hotel_id: HOTEL_7K,
  access_snapshot_token: workspace.assignment.access_snapshot_token,
  pricing_snapshot_token: workspace.pricing.snapshot_token, example_stay: null,
  intent: { entity: 'room_rate_price', action: 'update', id: rate.id,
    payload: { nightly_rate: Number(rate.base_nightly_rate) + 1 },
    reason: 'Immutable Hotel pricing probe' } };
denied(await rpc('hotel_v2_partner_preview_pricing_plan', TOKENS.nonAdmin,
  { p_draft: immutableDraft }), 'nonmember pricing Preview');
const immutable = await rpc('hotel_v2_partner_preview_pricing_plan', TOKENS.owner,
  { p_draft: immutableDraft });
assert.equal(immutable.status, 400, JSON.stringify(immutable));
assert.ok(['hotels_v2_h3_2b_h3_1p_contract_immutable',
  'hotels_v2_h3_2b_base_price_not_authoritative'].includes(immutable.payload?.message));
stats.immutable += 1;

const rgbGet = await rpc('hotel_v2_partner_get_workspace', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL_RGB, p_from: inventoryDay, p_to: inventoryDay });
assert.equal(rgbGet.status, 200, JSON.stringify(rgbGet));
assert.equal(rgbGet.payload.pricing.commission_policy.commission_mode, 'percent_booking_total');
assert.equal(Number(rgbGet.payload.pricing.commission_policy.amount), 12.5);
stats.commission += 1;
const percentStayRequest = commercialRequest(rgbGet.payload, HOTEL_RGB, isoDay(41), isoDay(43));
const percentStay = await rpc('hotel_v2_partner_preview_commercial_stay', TOKENS.owner,
  { p_request: percentStayRequest });
assert.equal(percentStay.status, 200, JSON.stringify(percentStay));
assert.equal(percentStay.payload.ok, true, JSON.stringify(percentStay.payload));
assert.equal(percentStay.payload.commercial.calculation_basis.code, 'booking_total');
assert.equal(percentStay.payload.commercial.calculation_basis.quantity, 1);
assert.equal(Number(percentStay.payload.commercial.calculation_basis.unit_amount), 12.5);
const totalCents = cents(percentStay.payload.commercial.customer_price);
const expectedPercentCents = (totalCents * 125n + 500n) / 1000n;
assert.equal(cents(percentStay.payload.commercial.cypruseye_commission), expectedPercentCents);
assert.equal(totalCents, cents(percentStay.payload.commercial.cypruseye_commission)
  + cents(percentStay.payload.commercial.partner_net));
stats.commission += 1;
const activeRoom = rgbGet.payload.rooms.find((room) => room.status === 'active');
assert.ok(activeRoom, 'RGB fixture has no active Room');
const availabilityDraft = { contract_version: 'hotels_v2_h3_2b_availability_draft_v1',
  partner_id: PARTNER, hotel_id: HOTEL_RGB, from: inventoryDay, to: inventoryDay,
  access_snapshot_token: rgbGet.payload.assignment.access_snapshot_token,
  availability_snapshot_token: rgbGet.payload.availability.snapshot_token,
  intent: { entity: 'daily_inventory', action: 'upsert', id: null,
    payload: { room_type_id: activeRoom.id, stay_date: inventoryDay,
      closed: true, closed_mode: 'set' }, reason: 'Partner HTTP inventory review' } };
denied(await rpc('hotel_v2_partner_preview_availability_plan', TOKENS.nonAdmin,
  { p_draft: availabilityDraft }), 'nonmember availability Preview');
const availabilityPreview = await rpc('hotel_v2_partner_preview_availability_plan', TOKENS.owner,
  { p_draft: availabilityDraft });
assert.equal(availabilityPreview.status, 200, JSON.stringify(availabilityPreview));
assert.equal(availabilityPreview.payload.changed, true);
stats.preview += 1;
const availabilityApplied = await rpc('hotel_v2_partner_apply_availability_plan', TOKENS.owner, {
  p_reviewed_plan: availabilityPreview.payload.reviewed_plan,
  p_correlation_id: '39100000-0000-4000-8000-000000000021',
  p_idempotency_key: '39200000-0000-4000-8000-000000000021',
});
assert.equal(availabilityApplied.status, 200, JSON.stringify(availabilityApplied));
assert.equal(availabilityApplied.payload.activity.length, 1);
stats.apply += 1;

for (const relation of [
  'hotel_partner_property_drafts', 'hotel_partner_workspace_plan_reviews',
  'hotel_partner_workspace_foundation_receipts', 'hotel_partner_action_receipts',
  'hotel_activity_log', 'hotels', 'hotel_room_types', 'hotel_units', 'hotel_rate_plans',
  'hotel_room_rates', 'hotel_pricing_schedules', 'hotel_pricing_schedule_occupancy_tiers',
  'hotel_room_rate_occupancy_tiers', 'hotel_calendar_overrides', 'hotel_daily_inventory',
  'hotel_commission_policies', 'hotel_bookings', 'hotel_booking_room_allocations',
  'hotel_inventory_commitments',
]) {
  const result = await request(`/${relation}?select=*`, { token: TOKENS.owner });
  assert.ok([401, 403].includes(result.status), `${relation}: ${JSON.stringify(result)}`);
  stats.rawDenied += 1;
}
denied(await rpc('hotel_v2_h3_2b_record_activity', TOKENS.owner, {}),
  'private public-schema helper');
denied(await rpc('h3_2b_can_insert_photo', TOKENS.owner, {}), 'private-schema media helper');

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_H3_2B_PARTNER_WORKSPACE_POSTGREST_GATE_PASS', stats,
  legitimate_owner_count: 3,
}));
