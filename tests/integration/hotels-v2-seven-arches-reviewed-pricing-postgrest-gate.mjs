import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE_URL = process.env.HOTELS_V2_REVIEWED_PRICING_POSTGREST_URL
  || 'http://127.0.0.1:53020';
const parsedUrl = new URL(BASE_URL);
assert.equal(parsedUrl.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname));

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PARTNER = '20000000-0000-4000-8000-000000000001';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const UPPER_SCHEDULE = 'aec20731-7a56-35f0-334e-92b363351f02';
const CORRELATION = '41500000-0000-4000-8000-000000000001';
const IDEMPOTENCY = '41510000-0000-4000-8000-000000000001';
const APPLY_CORRELATION = '41520000-0000-4000-8000-000000000001';
const APPLY_IDEMPOTENCY = '41530000-0000-4000-8000-000000000001';

const checks = {
  authorization_denials: 0,
  raw_acl_denials: 0,
  private_helper_denials: 0,
  legacy_bypass_rejections: 0,
  partner_previews: 0,
  partner_submissions: 0,
  partner_replays: 0,
  identity_conflicts: 0,
  admin_previews: 0,
  admin_applies: 0,
  admin_replays: 0,
  postconditions: 0,
};
let requestCount = 0;

async function request(path, { token, method = 'GET', body } = {}) {
  requestCount += 1;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  return { status: response.status, ok: response.ok, payload };
}

function rpc(name, token, body = {}) {
  return request(`/rpc/${name}`, { token, method: 'POST', body });
}

function denied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded`);
  assert.ok([401, 403, 404].includes(result.status),
    `${label} returned ${result.status}: ${JSON.stringify(result.payload)}`);
}

function controlled(result, status, message, label) {
  assert.equal(result.status, status,
    `${label}: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.message, message,
    `${label}: ${JSON.stringify(result.payload)}`);
}

function exactItem(workspace, requestedDelta = 1) {
  const tier = workspace.pricing.schedule_tiers.find((candidate) =>
    candidate.schedule_id === UPPER_SCHEDULE
      && Number(candidate.guest_count) === 2
      && Number(candidate.threshold_nights) === 2);
  assert.ok(tier, 'Partner workspace omitted the authoritative Upper 2-person/2-night tier');
  const rate = workspace.pricing.room_rates.find((candidate) => candidate.id === UPPER_RATE);
  assert.ok(rate, 'Partner workspace omitted the authoritative Upper Room Rate');
  assert.equal(rate.room_type_id, UPPER_ROOM);
  assert.equal(rate.pricing_schedule_id, UPPER_SCHEDULE);
  return {
    hotel_id: HOTEL,
    room_type_id: UPPER_ROOM,
    room_rate_id: UPPER_RATE,
    pricing_schedule_id: UPPER_SCHEDULE,
    schedule_tier_id: tier.id,
    guest_count: 2,
    minimum_nights: 2,
    currency: 'EUR',
    before_price: Number(tier.nightly_rate),
    requested_price: Number(tier.nightly_rate) + requestedDelta,
  };
}

async function getWorkspace() {
  const today = new Date().toISOString().slice(0, 10);
  const result = await rpc('hotel_v2_partner_get_workspace', TOKENS.owner, {
    p_partner_id: PARTNER,
    p_hotel_id: HOTEL,
    p_from: today,
    p_to: today,
  });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.hotel_id, HOTEL);
  assert.equal(result.payload.assignment.capabilities.manage_prices, true);
  assert.match(result.payload.assignment.access_snapshot_token, /^[0-9a-f]{64}$/);
  assert.match(result.payload.pricing.snapshot_token, /^[0-9a-f]{64}$/);
  return result.payload;
}

// Only the intended role can cross each reviewed-workflow boundary.
const accessProbeDraft = {
  contract_version: 'hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
  partner_id: PARTNER,
  hotel_id: HOTEL,
  access_snapshot_token: '0'.repeat(64),
  pricing_snapshot_token: '0'.repeat(64),
  items: [],
  reason: 'Authorization boundary probe',
};
for (const [label, token] of [
  ['anon', TOKENS.anon],
  ['non-member', TOKENS.nonAdmin],
]) {
  denied(await rpc('hotel_v2_partner_preview_seven_arches_pricing_proposal', token,
    { p_draft: accessProbeDraft }), `${label} Partner Preview`);
  checks.authorization_denials += 1;
}
for (const [label, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['Partner', TOKENS.owner],
]) {
  denied(await rpc('hotel_v2_admin_get_seven_arches_reviewed_pricing', token),
    `${label} Admin GET`);
  denied(await rpc('hotel_v2_admin_preview_seven_arches_reviewed_pricing', token,
    { p_request: {} }), `${label} Admin Preview`);
  denied(await rpc('hotel_v2_admin_apply_seven_arches_reviewed_pricing', token, {
    p_reviewed_plan: {}, p_correlation_id: APPLY_CORRELATION,
    p_idempotency_key: APPLY_IDEMPOTENCY,
  }), `${label} Admin Apply`);
  checks.authorization_denials += 3;
}

const protectedRelations = [
  'hotel_seven_arches_reviewed_pricing_proposals',
  'hotel_seven_arches_reviewed_pricing_proposal_items',
  'hotel_seven_arches_reviewed_pricing_admin_reviews',
  'hotel_seven_arches_reviewed_pricing_transaction_context',
  'hotel_seven_arches_reviewed_pricing_foundation_receipts',
  'hotel_seven_arches_reviewed_pricing_evolution_receipts',
  'hotel_seven_arches_independent_pricing_authority',
  'hotel_pricing_schedule_occupancy_tiers',
  'hotel_activity_log',
];
for (const [label, token] of [['Partner', TOKENS.owner], ['Admin', TOKENS.admin]]) {
  for (const relation of protectedRelations) {
    denied(await request(`/${relation}?select=*&limit=1`, { token }),
      `${label} raw ${relation}`);
    checks.raw_acl_denials += 1;
  }
}
for (const [helper, body] of [
  ['hotel_v2_seven_arches_reviewed_pricing_build_plan', {
    p_items: [], p_reason: 'Private helper ACL probe',
  }],
  ['hotel_v2_seven_arches_reviewed_pricing_current_state', {}],
  ['hotel_v2_seven_arches_reviewed_pricing_oracle', {}],
  ['hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact', {}],
  ['hotel_v2_partner_preview_pricing_plan_legacy_core', { p_draft: {} }],
  ['hotel_v2_partner_apply_pricing_plan_legacy_core', {
    p_reviewed_plan: {}, p_correlation_id: CORRELATION,
    p_idempotency_key: IDEMPOTENCY,
  }],
]) {
  denied(await rpc(helper, TOKENS.owner, body), `Partner private helper ${helper}`);
  checks.private_helper_denials += 1;
}

const workspace = await getWorkspace();
const initialAdmin = await rpc(
  'hotel_v2_admin_get_seven_arches_reviewed_pricing', TOKENS.admin,
);
assert.equal(initialAdmin.status, 200, JSON.stringify(initialAdmin.payload));
const receiptCountBefore = Number(initialAdmin.payload.current_state.receipt_count);
const item = exactItem(workspace);
const draft = {
  contract_version: 'hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1',
  partner_id: PARTNER,
  hotel_id: HOTEL,
  access_snapshot_token: workspace.assignment.access_snapshot_token,
  pricing_snapshot_token: workspace.pricing.snapshot_token,
  items: [item],
  reason: 'Focused Partner HTTP pricing review',
};

// The old generic path is an explicit reviewed-workflow boundary, not a mutation bypass.
controlled(await rpc('hotel_v2_partner_preview_pricing_plan', TOKENS.owner,
  { p_draft: draft }), 409,
'hotels_v2_seven_arches_reviewed_pricing_required', 'legacy Partner Preview bypass');
controlled(await rpc('hotel_v2_partner_apply_pricing_plan', TOKENS.owner, {
  p_reviewed_plan: { hotel_id: HOTEL },
  p_correlation_id: CORRELATION,
  p_idempotency_key: IDEMPOTENCY,
}), 409, 'hotels_v2_seven_arches_reviewed_pricing_required',
'legacy Partner Apply bypass');
checks.legacy_bypass_rejections += 2;

const preview = await rpc(
  'hotel_v2_partner_preview_seven_arches_pricing_proposal', TOKENS.owner,
  { p_draft: draft },
);
assert.equal(preview.status, 200, JSON.stringify(preview.payload));
assert.equal(preview.payload.contract_version,
  'hotels_v2_seven_arches_reviewed_pricing_partner_preview_v1');
assert.equal(preview.payload.changed, true);
assert.equal(preview.payload.reviewed_plan.canonical_items.length, 1);
assert.equal(preview.payload.reviewed_plan.canonical_items[0].schedule_tier_id,
  item.schedule_tier_id);
assert.deepEqual(preview.payload.reviewed_plan.commission_policy, {
  commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
});
assert.ok(preview.payload.commercial_impacts.some((impact) =>
  impact.scope === 'single_room' && Number(impact.cypruseye_commission) === 10));
assert.ok(preview.payload.commercial_impacts.some((impact) =>
  impact.scope === 'bundle' && Number(impact.cypruseye_commission) === 20));
for (const forbidden of ['email', 'customer_name', 'customer_phone']) {
  assert.equal(JSON.stringify(preview.payload).includes(forbidden), false,
    `Partner preview leaked ${forbidden}`);
}
checks.partner_previews += 1;

denied(await rpc('hotel_v2_partner_submit_seven_arches_pricing_proposal', TOKENS.anon, {
  p_reviewed_plan: preview.payload.reviewed_plan,
  p_correlation_id: CORRELATION,
  p_idempotency_key: IDEMPOTENCY,
}), 'anon Partner Submit');
checks.authorization_denials += 1;
controlled(await rpc('hotel_v2_partner_submit_seven_arches_pricing_proposal',
  TOKENS.nonAdmin, {
    p_reviewed_plan: preview.payload.reviewed_plan,
    p_correlation_id: CORRELATION,
    p_idempotency_key: IDEMPOTENCY,
  }), 403, 'hotels_v2_h3_2a_partner_access_denied',
  'non-member Partner Submit');
checks.authorization_denials += 1;

const submitBody = {
  p_reviewed_plan: preview.payload.reviewed_plan,
  p_correlation_id: CORRELATION,
  p_idempotency_key: IDEMPOTENCY,
};
const submitted = await rpc(
  'hotel_v2_partner_submit_seven_arches_pricing_proposal', TOKENS.owner, submitBody,
);
assert.equal(submitted.status, 200, JSON.stringify(submitted.payload));
assert.equal(submitted.payload.status, 'pending_admin_review');
assert.equal(submitted.payload.changed, false);
assert.equal(submitted.payload.replayed, false);
checks.partner_submissions += 1;

const submitReplay = await rpc(
  'hotel_v2_partner_submit_seven_arches_pricing_proposal', TOKENS.owner, submitBody,
);
assert.equal(submitReplay.status, 200, JSON.stringify(submitReplay.payload));
assert.equal(submitReplay.payload.proposal_id, submitted.payload.proposal_id);
assert.equal(submitReplay.payload.replayed, true);
checks.partner_replays += 1;

controlled(await rpc('hotel_v2_partner_submit_seven_arches_pricing_proposal', TOKENS.owner, {
  ...submitBody,
  p_correlation_id: '41500000-0000-4000-8000-000000000002',
}), 409, 'hotels_v2_seven_arches_reviewed_pricing_partner_idempotency_conflict',
'Partner idempotency conflict');
controlled(await rpc('hotel_v2_partner_submit_seven_arches_pricing_proposal', TOKENS.owner, {
  ...submitBody,
  p_idempotency_key: '41510000-0000-4000-8000-000000000002',
}), 409, 'hotels_v2_seven_arches_reviewed_pricing_partner_correlation_conflict',
'Partner correlation conflict');
checks.identity_conflicts += 2;

const adminControl = await rpc(
  'hotel_v2_admin_get_seven_arches_reviewed_pricing', TOKENS.admin,
);
assert.equal(adminControl.status, 200, JSON.stringify(adminControl.payload));
const proposal = adminControl.payload.proposals.find((candidate) =>
  candidate.id === submitted.payload.proposal_id);
assert.ok(proposal, 'Admin GET omitted the pending Partner proposal');
assert.equal(proposal.fresh, true);
assert.equal(proposal.item_count, 1);

const adminPreview = await rpc(
  'hotel_v2_admin_preview_seven_arches_reviewed_pricing', TOKENS.admin,
  { p_request: {
    contract_version: 'hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
    hotel_id: HOTEL,
    proposal_id: proposal.id,
    proposal_version: proposal.version,
    action: 'accept',
    reason: 'Focused Admin HTTP acceptance',
  } },
);
assert.equal(adminPreview.status, 200, JSON.stringify(adminPreview.payload));
assert.equal(adminPreview.payload.changed, true);
assert.equal(adminPreview.payload.reviewed_plan.action, 'accept');
assert.equal(adminPreview.payload.reviewed_plan.proposal_id, proposal.id);
checks.admin_previews += 1;

const applyBody = {
  p_reviewed_plan: adminPreview.payload.reviewed_plan,
  p_correlation_id: APPLY_CORRELATION,
  p_idempotency_key: APPLY_IDEMPOTENCY,
};
const applied = await rpc(
  'hotel_v2_admin_apply_seven_arches_reviewed_pricing', TOKENS.admin, applyBody,
);
assert.equal(applied.status, 200, JSON.stringify(applied.payload));
assert.equal(applied.payload.status, 'accepted');
assert.equal(applied.payload.changed, true);
assert.equal(applied.payload.replayed, false);
assert.equal(applied.payload.changed_items.length, 1);
assert.equal(applied.payload.changed_items[0].schedule_tier_id, item.schedule_tier_id);
assert.match(applied.payload.receipt_hash, /^[0-9a-f]{64}$/);
checks.admin_applies += 1;

const applyReplay = await rpc(
  'hotel_v2_admin_apply_seven_arches_reviewed_pricing', TOKENS.admin, applyBody,
);
assert.equal(applyReplay.status, 200, JSON.stringify(applyReplay.payload));
assert.equal(applyReplay.payload.receipt_hash, applied.payload.receipt_hash);
assert.equal(applyReplay.payload.replayed, true);
checks.admin_replays += 1;

controlled(await rpc('hotel_v2_admin_apply_seven_arches_reviewed_pricing', TOKENS.admin, {
  ...applyBody,
  p_correlation_id: '41520000-0000-4000-8000-000000000002',
}), 409, 'hotels_v2_seven_arches_reviewed_pricing_review_consumed',
'Admin consumed-review identity conflict');
checks.identity_conflicts += 1;

const finalWorkspace = await getWorkspace();
const finalTier = finalWorkspace.pricing.schedule_tiers.find((candidate) =>
  candidate.id === item.schedule_tier_id);
assert.ok(finalTier, 'Applied tier disappeared from Partner workspace');
assert.equal(Number(finalTier.nightly_rate), item.requested_price);
const finalAdmin = await rpc(
  'hotel_v2_admin_get_seven_arches_reviewed_pricing', TOKENS.admin,
);
assert.equal(finalAdmin.status, 200, JSON.stringify(finalAdmin.payload));
assert.equal(Number(finalAdmin.payload.current_state.receipt_count), receiptCountBefore + 1);
assert.equal(Number(finalAdmin.payload.current_state.oracle.core_case_count), 100);
assert.equal(Number(finalAdmin.payload.current_state.oracle.core_mismatch_count), 0);
assert.equal(Number(finalAdmin.payload.current_state.oracle.guest_one_case_count), 20);
assert.equal(Number(finalAdmin.payload.current_state.oracle.guest_one_mismatch_count), 0);
assert.equal(finalAdmin.payload.proposals.some((candidate) => candidate.id === proposal.id), false);
checks.postconditions += 7;

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_7A_REVIEWED_PRICING_POSTGREST_GATE_OK',
  request_count: requestCount,
  checks,
  proposal_id: submitted.payload.proposal_id,
  receipt_sequence: applied.payload.receipt_sequence,
  receipt_hash: applied.payload.receipt_hash,
}));
