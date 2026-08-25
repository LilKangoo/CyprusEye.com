import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { TOKENS, JWT_SECRET } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE = process.env.HOTELS_EXTERNAL_CALENDAR_POSTGREST_URL || 'http://127.0.0.1:53019';
const parsed = new URL(BASE);
assert.equal(parsed.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname));
const HOTEL = 'c1000000-0000-4000-8000-000000000001';
const ROOM = 'c1100000-0000-4000-8000-000000000001';
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

for (const token of [undefined, TOKENS.anon]) {
  for (const [name, body] of [
    ['hotel_v2_admin_get_external_calendar_control', { p_hotel_id: HOTEL }],
    ['hotel_v2_admin_preview_external_calendar_plan', { p_draft: {} }],
    ['hotel_v2_admin_apply_external_calendar_plan', { p_reviewed_plan: {},
      p_correlation_id: crypto.randomUUID(), p_idempotency_key: crypto.randomUUID(), p_ical_url: null }],
    ['hotel_v2_partner_get_external_calendar_control', { p_partner_id: PARTNER, p_hotel_id: HOTEL }],
    ['hotel_v2_partner_preview_external_calendar_plan', { p_draft: {} }],
    ['hotel_v2_partner_apply_external_calendar_plan', { p_reviewed_plan: {},
      p_correlation_id: crypto.randomUUID(), p_idempotency_key: crypto.randomUUID(), p_ical_url: null }],
  ]) deny(await rpc(name, token, body), `${token ? 'anon' : 'missing'} ${name}`);
}
deny(await rpc('hotel_v2_external_calendar_worker_list_sources', TOKENS.owner, { p_limit: 1 }),
  'authenticated worker helper');
deny(await rpc('hotel_v2_admin_get_external_calendar_control', TOKENS.nonAdmin,
  { p_hotel_id: HOTEL }), 'nonadmin Admin control');
deny(await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.nonAdmin,
  { p_draft: {} }), 'nonadmin Admin preview');
deny(await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.nonAdmin, {
  p_reviewed_plan: {}, p_correlation_id: crypto.randomUUID(),
  p_idempotency_key: crypto.randomUUID(), p_ical_url: null }), 'nonadmin Admin apply');
deny(await rpc('hotel_v2_admin_get_external_calendar_status', TOKENS.admin, { p_hotel_id: HOTEL }),
  'retired raw status');
deny(await rpc('hotel_v2_admin_set_external_calendar_ical_secret', TOKENS.admin, {
  p_source_id: crypto.randomUUID(), p_expected_source_version: 1,
  p_expected_binding_version: 0, p_ical_url: 'https://calendar.example.test/raw.ics' }),
  'retired raw secret setter');
deny(await request('/hotel_external_calendar_sync_jobs?select=*', TOKENS.owner), 'partner raw jobs');
deny(await request('/hotel_external_calendar_sync_jobs?select=*', serviceToken), 'service raw jobs');

const listed = await rpc('hotel_v2_external_calendar_worker_list_sources', serviceToken, { p_limit: 8 });
assert.equal(listed.status, 200, JSON.stringify(listed));
assert.equal(listed.payload.global_enabled, false);
assert.deepEqual(listed.payload.sources, []);

const adminControl = await rpc('hotel_v2_admin_get_external_calendar_control', TOKENS.admin,
  { p_hotel_id: HOTEL });
assert.equal(adminControl.status, 200, JSON.stringify(adminControl));
assert.equal(adminControl.payload.hotel_external_sync_enabled, false);
assert.ok(!/(ical_url|external_reference|configuration|vault_secret)/.test(JSON.stringify(adminControl.payload)));
const partnerControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl));
deny(await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.nonAdmin,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL }), 'nonmember partner control');
deny(await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.unscopedStaff,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL }), 'unscoped staff partner control');
deny(await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: '20000000-0000-4000-8000-000000000005', p_hotel_id: HOTEL }),
  'foreign partner control');

const draft = { contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
  partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
  snapshot_token: adminControl.payload.snapshot_token, intent: { entity: 'calendar_source', action: 'create',
    id: null, expected_version: 0, payload: { room_type_id: ROOM, code: 'http-gate-ical',
      sync_interval_minutes: 15, units_per_event: 1, priority: 11 },
    reason: 'Create HTTP reviewed source' } };
const preview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin,
  { p_draft: draft });
assert.equal(preview.status, 200, JSON.stringify(preview));
assert.equal(preview.payload.changed, true);
assert.ok(preview.payload.reviewed_plan.operations[0].id);
assert.deepEqual(preview.payload.impacts[0].fields,
  ['code', 'priority', 'room_type_id', 'sync_interval_minutes', 'units_per_event']);
const applyBody = { p_reviewed_plan: preview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000001',
  p_idempotency_key: 'e6000000-0000-4000-8000-000000000001', p_ical_url: null };
const applied = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, applyBody);
assert.equal(applied.status, 200, JSON.stringify(applied));
assert.equal(applied.payload.replayed, false);
assert.equal(applied.payload.activity.length, 1);
const sourceId = preview.payload.reviewed_plan.operations[0].id;
const createdSource = applied.payload.control.sources.find((row) => row.id === sourceId);
const noopDraft = { ...draft, snapshot_token: applied.payload.control.snapshot_token,
  intent: { ...draft.intent, action: 'update', id: sourceId, expected_version: createdSource.version,
    payload: { room_type_id: createdSource.room_type_id, code: createdSource.code,
      sync_interval_minutes: createdSource.sync_interval_minutes,
      units_per_event: createdSource.units_per_event, priority: createdSource.priority } } };
const noop = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin,
  { p_draft: noopDraft });
assert.equal(noop.status, 200, JSON.stringify(noop));
assert.equal(noop.payload.changed, false);
assert.equal(noop.payload.reviewed_plan, null);
const stale = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin,
  { p_draft: { ...noopDraft, snapshot_token: adminControl.payload.snapshot_token } });
assert.equal(stale.status, 409, JSON.stringify(stale));
const smuggled = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin,
  { p_draft: { ...noopDraft, intent: { ...noopDraft.intent,
    payload: { ...noopDraft.intent.payload, source_type: 'manual' } } } });
assert.equal(smuggled.status, 400, JSON.stringify(smuggled));
const replay = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, applyBody);
assert.equal(replay.status, 200, JSON.stringify(replay));
assert.equal(replay.payload.replayed, true);
const conflict = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin,
  { ...applyBody, p_correlation_id: 'e5000000-0000-4000-8000-000000000002' });
assert.equal(conflict.status, 409, JSON.stringify(conflict));

const secretControl = applied.payload.control;
const secretUrl = 'https://calendar.example.test/http-gate.ics';
const secretDraft = { contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
  partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
  snapshot_token: secretControl.snapshot_token, intent: { entity: 'ical_secret', action: 'set',
    id: sourceId, expected_version: 0, payload: { source_id: sourceId, ical_url: secretUrl },
    reason: 'Bind HTTP reviewed secret' } };
const secretPreview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin,
  { p_draft: secretDraft });
assert.equal(secretPreview.status, 200, JSON.stringify(secretPreview));
assert.ok(!JSON.stringify(secretPreview.payload).includes(secretUrl));
assert.deepEqual(secretPreview.payload.impacts[0].fields, ['secret_configured']);
const differentBodySameKey = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, {
  p_reviewed_plan: secretPreview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000005',
  p_idempotency_key: applyBody.p_idempotency_key, p_ical_url: secretUrl });
assert.equal(differentBodySameKey.status, 409, JSON.stringify(differentBodySameKey));
const secretApplied = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, {
  p_reviewed_plan: secretPreview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000003',
  p_idempotency_key: 'e6000000-0000-4000-8000-000000000003', p_ical_url: secretUrl });
assert.equal(secretApplied.status, 200, JSON.stringify(secretApplied));
assert.ok(!JSON.stringify(secretApplied.payload).includes(secretUrl));
const differentUrlSameKey = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, {
  p_reviewed_plan: secretPreview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000003',
  p_idempotency_key: 'e6000000-0000-4000-8000-000000000003',
  p_ical_url: 'https://calendar.example.test/different.ics' });
assert.equal(differentUrlSameKey.status, 409, JSON.stringify(differentUrlSameKey));

const rotateControl = secretApplied.payload.control;
const rotatedUrl = 'https://calendar.example.test/http-gate-rotated.ics';
const rotatePreview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin, {
  p_draft: { contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
    snapshot_token: rotateControl.snapshot_token, intent: { entity: 'ical_secret', action: 'rotate',
      id: sourceId, expected_version: 1, payload: { source_id: sourceId, ical_url: rotatedUrl },
      reason: 'Rotate HTTP reviewed secret' } } });
assert.equal(rotatePreview.status, 200, JSON.stringify(rotatePreview));
assert.ok(!JSON.stringify(rotatePreview.payload).includes(rotatedUrl));
const rotated = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, {
  p_reviewed_plan: rotatePreview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000006',
  p_idempotency_key: 'e6000000-0000-4000-8000-000000000006', p_ical_url: rotatedUrl });
assert.equal(rotated.status, 200, JSON.stringify(rotated));

const scopedControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
const source = scopedControl.payload.sources.find((row) => row.id === sourceId);
const partnerDraft = { contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
  partner_id: PARTNER, assignment_id: scopedControl.payload.assignment_id,
  permission_version: scopedControl.payload.permission_version,
  access_snapshot_token: scopedControl.payload.access_snapshot_token,
  snapshot_token: scopedControl.payload.snapshot_token, intent: { entity: 'calendar_source', action: 'update',
    id: sourceId, expected_version: source.version, payload: { room_type_id: source.room_type_id,
      code: source.code, sync_interval_minutes: source.sync_interval_minutes,
      units_per_event: source.units_per_event, priority: source.priority + 1 },
    reason: 'Partner scoped update review' } };
deny(await rpc('hotel_v2_partner_preview_external_calendar_plan', TOKENS.nonAdmin,
  { p_draft: partnerDraft }), 'nonmember partner preview');
const partnerPreview = await rpc('hotel_v2_partner_preview_external_calendar_plan', TOKENS.owner,
  { p_draft: partnerDraft });
assert.equal(partnerPreview.status, 200, JSON.stringify(partnerPreview));
const foreignApply = await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.nonAdmin, {
  p_reviewed_plan: partnerPreview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000004',
  p_idempotency_key: 'e6000000-0000-4000-8000-000000000004', p_ical_url: null });
assert.equal(foreignApply.status, 409, JSON.stringify(foreignApply));
const partnerApplied = await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.owner, {
  p_reviewed_plan: partnerPreview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000007',
  p_idempotency_key: 'e6000000-0000-4000-8000-000000000007', p_ical_url: null });
assert.equal(partnerApplied.status, 200, JSON.stringify(partnerApplied));

const clearControl = partnerApplied.payload.control;
const clearPreview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin, {
  p_draft: { contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
    snapshot_token: clearControl.snapshot_token, intent: { entity: 'ical_secret', action: 'clear',
      id: sourceId, expected_version: 2, payload: { source_id: sourceId },
      reason: 'Clear HTTP reviewed secret' } } });
assert.equal(clearPreview.status, 200, JSON.stringify(clearPreview));
const cleared = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, {
  p_reviewed_plan: clearPreview.payload.reviewed_plan,
  p_correlation_id: 'e5000000-0000-4000-8000-000000000008',
  p_idempotency_key: 'e6000000-0000-4000-8000-000000000008', p_ical_url: null });
assert.equal(cleared.status, 200, JSON.stringify(cleared));
assert.equal(cleared.payload.control.sources.find((row) => row.id === sourceId).secret_configured, false);

console.log(JSON.stringify({ contract: 'hotels_v2_external_calendar_stage2b_2e_postgrest_gate_v1',
  denied: 21, workerOff: true, controls: 2, preview: 3, apply: 2, replay: 1, conflict: 1 }));
