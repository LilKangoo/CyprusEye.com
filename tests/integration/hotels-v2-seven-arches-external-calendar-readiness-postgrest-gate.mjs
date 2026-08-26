import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { TOKENS, JWT_SECRET } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE = process.env.HOTELS_EXTERNAL_CALENDAR_POSTGREST_URL || 'http://127.0.0.1:53019';
const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const PARTNER = '20000000-0000-4000-8000-000000000001';
const enc = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const serviceToken = (() => {
  const now = Math.floor(Date.now() / 1000);
  const head = enc({ alg: 'HS256', typ: 'JWT' });
  const body = enc({ aud: 'authenticated', role: 'service_role', sub:
    '10000000-0000-4000-8000-000000000009', iat: now, exp: now + 3600 });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
})();
async function request(path, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, { method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  const text = await response.text(); let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  return { status: response.status, payload };
}
const rpc = (name, token, body = {}) => request(`/rpc/${name}`, token, body);
const deny = (result, label) => assert.ok([401, 403, 404].includes(result.status),
  `${label}: ${JSON.stringify(result)}`);
const adminDraft = (control, room, code, sourceType) => ({
  contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
  partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
  snapshot_token: control.snapshot_token, intent: { entity: 'calendar_source', action: 'create',
    id: null, expected_version: 0, payload: { room_type_id: room, code, source_type: sourceType,
      sync_interval_minutes: 60, units_per_event: 1, priority: 10 },
    reason: `Create reviewed ${sourceType} ICS source` },
});

deny(await rpc('hotel_v2_admin_get_external_calendar_control', TOKENS.owner,
  { p_hotel_id: HOTEL }), 'Partner calling Admin control');
deny(await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.nonAdmin,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL }), 'foreign Partner control');
deny(await request('/hotel_calendar_source_configs?select=*', TOKENS.owner), 'raw source table');
deny(await request('/hotel_external_calendar_source_secrets?select=*', serviceToken), 'raw Vault binding');

let controlResult = await rpc('hotel_v2_admin_get_external_calendar_control', TOKENS.admin,
  { p_hotel_id: HOTEL });
assert.equal(controlResult.status, 200, JSON.stringify(controlResult));
assert.equal(controlResult.payload.hotel_external_sync_enabled, false);
assert.equal(controlResult.payload.sources.length, 0);
assert.deepEqual(new Set(controlResult.payload.rooms.map((room) => room.id)), new Set([UPPER, GROUND]));

const createAdmin = async (room, code, sourceType, sequence) => {
  const preview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin,
    { p_draft: adminDraft(controlResult.payload, room, code, sourceType) });
  assert.equal(preview.status, 200, JSON.stringify(preview));
  assert.equal(preview.payload.reviewed_plan.operations[0].payload.source_type, sourceType);
  assert.deepEqual(preview.payload.impacts[0].fields,
    ['code', 'priority', 'room_type_id', 'source_type', 'sync_interval_minutes', 'units_per_event']);
  const applied = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, {
    p_reviewed_plan: preview.payload.reviewed_plan,
    p_correlation_id: `e7500000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    p_idempotency_key: `e7510000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    p_ical_url: null,
  });
  assert.equal(applied.status, 200, JSON.stringify(applied));
  controlResult = { status: 200, payload: applied.payload.control };
  return preview.payload.reviewed_plan.operations[0].id;
};

const bookingSource = await createAdmin(UPPER, 'upper-primary', 'booking_com', 1);
await createAdmin(GROUND, 'ground-secondary', 'ical', 2);

const partnerControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl));
const partnerDraft = {
  contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL, partner_id: PARTNER,
  assignment_id: partnerControl.payload.assignment_id,
  permission_version: partnerControl.payload.permission_version,
  access_snapshot_token: partnerControl.payload.access_snapshot_token,
  snapshot_token: partnerControl.payload.snapshot_token,
  intent: { entity: 'calendar_source', action: 'create', id: null, expected_version: 0,
    payload: { room_type_id: GROUND, code: 'ground-tertiary', source_type: 'airbnb',
      sync_interval_minutes: 60, units_per_event: 1, priority: 20 },
    reason: 'Create reviewed Airbnb ICS source' },
};
const partnerPreview = await rpc('hotel_v2_partner_preview_external_calendar_plan', TOKENS.owner,
  { p_draft: partnerDraft });
assert.equal(partnerPreview.status, 200, JSON.stringify(partnerPreview));
const partnerApply = await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.owner, {
  p_reviewed_plan: partnerPreview.payload.reviewed_plan,
  p_correlation_id: 'e7500000-0000-4000-8000-000000000003',
  p_idempotency_key: 'e7510000-0000-4000-8000-000000000003', p_ical_url: null,
});
assert.equal(partnerApply.status, 200, JSON.stringify(partnerApply));
assert.deepEqual(new Set(partnerApply.payload.control.sources.map((source) => source.source_type)),
  new Set(['booking_com', 'airbnb', 'ical']));
for (const source of partnerApply.payload.control.sources) assert.equal(source.secret_configured, false);
assert.ok(!/(ical_url|external_reference|configuration|vault_secret_id)/
  .test(JSON.stringify(partnerApply.payload.control)));

const booking = partnerApply.payload.control.sources.find((source) => source.id === bookingSource);
const enablePreview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin, {
  p_draft: { contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
    snapshot_token: partnerApply.payload.control.snapshot_token,
    intent: { entity: 'calendar_source', action: 'enable', id: bookingSource,
      expected_version: booking.version, payload: {}, reason: 'Request operator-gated activation' } },
});
assert.equal(enablePreview.status, 200, JSON.stringify(enablePreview));
assert.equal(enablePreview.payload.changed, false);
assert.equal(enablePreview.payload.reviewed_plan, null);
assert.deepEqual(enablePreview.payload.blocking_reasons, ['external_calendar_not_activated']);
const triggerPreview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin, {
  p_draft: { contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
    snapshot_token: partnerApply.payload.control.snapshot_token,
    intent: { entity: 'calendar_sync', action: 'trigger', id: bookingSource,
      expected_version: booking.health.state_version, payload: { source_id: bookingSource },
      reason: 'Request manual sync before configuration' } },
});
assert.equal(triggerPreview.status, 400, JSON.stringify(triggerPreview));

const listed = await rpc('hotel_v2_external_calendar_worker_list_sources', serviceToken, { p_limit: 25 });
assert.equal(listed.status, 200, JSON.stringify(listed));
assert.equal(listed.payload.global_enabled, false);
assert.deepEqual(listed.payload.sources, []);

console.log(JSON.stringify({
  contract: 'hotels_v2_seven_arches_external_calendar_readiness_postgrest_gate_v1',
  providers: ['booking_com', 'airbnb', 'ical'], rooms: [UPPER, GROUND],
  sources_created: 3, secrets_configured: 0, global_enabled: false,
}));
