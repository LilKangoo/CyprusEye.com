import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H3_1P_POSTGREST_URL || 'http://127.0.0.1:53012';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname));
assert.equal(parsedUrl.protocol, 'http:');

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const CORRELATION = '73200000-0000-4000-8000-000000000001';

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${POSTGREST_URL}${path}`, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
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

function assertDenied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded`);
  assert.ok([401, 403, 404].includes(result.status), `${label}: ${result.status}`);
}

const previewResult = await rpc(
  'hotel_v2_admin_get_legacy_pricing_promotion_preview',
  TOKENS.admin,
  { p_hotel_id: HOTEL },
);
assert.equal(previewResult.status, 200, JSON.stringify(previewResult.payload));
const preview = previewResult.payload;
assert.equal(preview.supported, true);
assert.equal(preview.public_change, false);
assert.equal(preview.property.architecture_version, 'legacy');
assert.equal(preview.source.pricing_fingerprint, '7208ab4ecc0e47abd64d87ca1ac53a03');
assert.equal(preview.source.rule_count, 63);
assert.equal(preview.target.room_schedule.tier_count, 27);
assert.equal(preview.source.property_party_preview.tier_count, 63);
assert.equal(preview.parity.total_case_count, 70);
assert.equal(preview.parity.total_mismatch_count, 0);
assert.equal(preview.allocation_previews.length, 8);
assert.deepEqual(preview.flags, {
  hotel_rooms_v2_enabled: false,
  hotel_external_sync_enabled: false,
  hotel_instant_booking_enabled: false,
  hotel_stripe_connect_enabled: false,
});

const plan = {
  hotel_id: HOTEL,
  reviewed_at: new Date().toISOString(),
  snapshot_token: preview.snapshot_token,
  expected: preview.expected,
  decision: 'promote_room_schedule_to_reviewed',
  acknowledge_pricing_occupancy_mapping: true,
};

for (const [label, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.partner],
]) {
  assertDenied(await rpc(
    'hotel_v2_admin_get_legacy_pricing_promotion_preview', token, { p_hotel_id: HOTEL },
  ), `${label} preview`);
  assertDenied(await rpc(
    'hotel_v2_admin_apply_legacy_pricing_promotion', token,
    { p_plan: plan, p_correlation_id: CORRELATION },
  ), `${label} apply`);
}

const nullIdentity = await rpc(
  'hotel_v2_admin_apply_legacy_pricing_promotion', TOKENS.admin,
  {
    p_plan: { ...plan, hotel_id: null, decision: null },
    p_correlation_id: '73200000-0000-4000-8000-000000000005',
  },
);
assert.equal(nullIdentity.status, 400, JSON.stringify(nullIdentity.payload));
assert.equal(nullIdentity.payload?.code, '22023');
assert.equal(
  nullIdentity.payload?.message,
  'hotels_v2_h3_pricing_promotion_unsupported_contract',
);

const missingAck = await rpc(
  'hotel_v2_admin_apply_legacy_pricing_promotion', TOKENS.admin,
  {
    p_plan: { ...plan, acknowledge_pricing_occupancy_mapping: false },
    p_correlation_id: '73200000-0000-4000-8000-000000000002',
  },
);
assert.equal(missingAck.status, 400, JSON.stringify(missingAck.payload));
assert.equal(missingAck.payload?.code, '22023');
assert.equal(
  missingAck.payload?.message,
  'hotels_v2_h3_pricing_promotion_pricing_occupancy_ack_required',
);

const stale = await rpc(
  'hotel_v2_admin_apply_legacy_pricing_promotion', TOKENS.admin,
  {
    p_plan: { ...plan, snapshot_token: 'stale' },
    p_correlation_id: '73200000-0000-4000-8000-000000000003',
  },
);
assert.equal(stale.status, 409, JSON.stringify(stale.payload));
assert.equal(stale.payload?.code, 'PT409');
assert.equal(stale.payload?.message, 'hotels_v2_h3_pricing_promotion_stale_review');

const applied = await rpc(
  'hotel_v2_admin_apply_legacy_pricing_promotion', TOKENS.admin,
  { p_plan: plan, p_correlation_id: CORRELATION },
);
assert.equal(applied.status, 200, JSON.stringify(applied.payload));
assert.equal(applied.payload.ok, true);
assert.equal(applied.payload.replayed, false);
assert.equal(applied.payload.public_change, false);
assert.equal(applied.payload.legacy_authoritative, true);
assert.equal(applied.payload.parity.total_case_count, 70);
assert.equal(applied.payload.parity.total_mismatch_count, 0);

const replay = await rpc(
  'hotel_v2_admin_apply_legacy_pricing_promotion', TOKENS.admin,
  { p_plan: plan, p_correlation_id: CORRELATION },
);
assert.equal(replay.status, 200, JSON.stringify(replay.payload));
assert.equal(replay.payload.replayed, true);
assert.equal(replay.payload.review_id, applied.payload.review_id);

const secondReview = await rpc(
  'hotel_v2_admin_apply_legacy_pricing_promotion', TOKENS.admin,
  {
    p_plan: plan,
    p_correlation_id: '73200000-0000-4000-8000-000000000004',
  },
);
assert.equal(secondReview.status, 409, JSON.stringify(secondReview.payload));
assert.equal(secondReview.payload?.code, 'PT409');
assert.equal(secondReview.payload?.message, 'hotels_v2_h3_pricing_promotion_already_reviewed');

const configurationResult = await rpc(
  'hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL },
);
assert.equal(configurationResult.status, 200, JSON.stringify(configurationResult.payload));
const configuration = configurationResult.payload;
assert.equal(configuration.property.architecture_version, 'legacy');
assert.deepEqual(configuration.feature_flags, preview.flags);
const bundles = configuration.allocation_rules
  .filter((rule) => rule.allocation_mode === 'required_bundle');
assert.deepEqual(
  bundles.map((rule) => rule.items.map((item) => Number(item.pricing_guest_count))),
  [[2, 2], [3, 3], [4, 4], [4, 4]],
);
assert.deepEqual(
  bundles.map((rule) => rule.items.map((item) => Number(item.allocated_guest_count))),
  [[3, 2], [3, 3], [4, 3], [4, 4]],
);
assert.equal(
  configuration.pricing_schedules.find((schedule) =>
    schedule.id === 'b0a3104f-7b31-5265-a59f-c2d166f11a23').review_status,
  'reviewed',
);

for (const [label, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.partner],
]) {
  const raw = await request('/hotel_pricing_promotion_reviews?select=*', { token });
  if (raw.status === 200) assert.deepEqual(raw.payload, [], `${label} raw receipt leaked`);
  else assert.ok([401, 403, 404].includes(raw.status), `${label} raw receipt ${raw.status}`);
}

const adminReceipt = await request(
  '/hotel_pricing_promotion_reviews?select=hotel_id,parity_case_count,parity_mismatch_count',
  { token: TOKENS.admin },
);
assert.equal(adminReceipt.status, 200, JSON.stringify(adminReceipt.payload));
assert.deepEqual(adminReceipt.payload, [{
  hotel_id: HOTEL,
  parity_case_count: 70,
  parity_mismatch_count: 0,
}]);

const serialized = JSON.stringify({ preview, applied, configuration });
for (const forbidden of ['customer@example.test', 'phone', 'contact_revealed_at']) {
  assert.equal(serialized.includes(forbidden), false, `Promotion payload leaked ${forbidden}`);
}

console.log(JSON.stringify({
  result: 'HOTELS_V2_H3_1P_LEGACY_PRICING_PROMOTION_POSTGREST_GATE_PASS',
  source_fingerprint: preview.source.pricing_fingerprint,
  parity: applied.payload.parity,
  pricing_guest_counts: bundles.map((rule) =>
    rule.items.map((item) => Number(item.pricing_guest_count))),
  public_activation: false,
}));
