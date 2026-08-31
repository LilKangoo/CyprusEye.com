import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { TOKENS, USER_IDS, JWT_SECRET } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE = process.env.HOTELS_EXTERNAL_CALENDAR_POSTGREST_URL || 'http://127.0.0.1:53019';
const parsedBase = new URL(BASE);
assert.equal(parsedBase.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedBase.hostname));
const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const PARTNER = '20000000-0000-4000-8000-000000000001';
const TEST_URL = 'https://airbnb.example.test/seven-arches-ground.ics';
const DIFFERENT_URL = 'https://airbnb.example.test/seven-arches-ground-different.ics';
const ROTATED_URL = 'https://airbnb.example.test/seven-arches-ground-rotated.ics';
const enc = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const serviceToken = (() => {
  const now = Math.floor(Date.now() / 1000);
  const head = enc({ alg: 'HS256', typ: 'JWT' });
  const body = enc({ aud: 'authenticated', role: 'service_role', sub:
    '10000000-0000-4000-8000-000000000009', iat: now, exp: now + 3600 });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
})();
let requestCount = 0;
let securityCount = 0;
async function request(path, token, body) {
  requestCount += 1;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text(); let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  return { status: response.status, payload };
}
const rpc = (name, token, body = {}) => request(`/rpc/${name}`, token, body);
const deny = (result, label) => {
  assert.ok([401, 403, 404].includes(result.status), `${label}: ${JSON.stringify(result)}`);
  securityCount += 1;
};
const controlled = (result, status, message, label) => {
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result)}`);
  assert.equal(result.payload?.message, message, `${label}: ${JSON.stringify(result)}`);
  securityCount += 1;
};
const PROPOSAL_KEYS = [
  'action', 'admin_reason', 'assignment_id', 'entity', 'expires_at', 'hotel_id',
  'is_fresh', 'partner_id', 'plan_fingerprint', 'proposal_id', 'reason',
  'reviewed_at', 'reviewed_by', 'room_type_id', 'source_id', 'source_type',
  'status', 'submitted_at',
];
const exactKeys = (value, keys, label) => assert.deepEqual(
  Object.keys(value).sort(), [...keys].sort(), `${label}: ${JSON.stringify(value)}`,
);
const redacted = (value, label) => {
  const json = JSON.stringify(value);
  for (const privateUrl of [TEST_URL, DIFFERENT_URL, ROTATED_URL]) {
    assert.ok(!json.includes(privateUrl), `${label} returned the private URL`);
  }
  assert.ok(!/(ical_url|vault_secret_id|decrypted_secret|external_reference)/.test(json),
    `${label} returned a private field: ${json}`);
  assert.ok(!/(prior_compatible_fingerprints|evolved_protected_fingerprints|function_source_hashes|provider_evolution_receipts|site_settings_lifecycle_fingerprint|site_settings_raw_fingerprint)/.test(json),
    `${label} returned private representation-lineage evidence: ${json}`);
  securityCount += 1;
};
const draft = (control, room, code, sourceType, actor = 'admin') => ({
  contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
  partner_id: actor === 'partner' ? PARTNER : null,
  assignment_id: actor === 'partner' ? control.assignment_id : null,
  permission_version: actor === 'partner' ? control.permission_version : null,
  access_snapshot_token: actor === 'partner' ? control.access_snapshot_token : null,
  snapshot_token: control.snapshot_token,
  intent: { entity: 'calendar_source', action: 'create', id: null, expected_version: 0,
    payload: { room_type_id: room, code, source_type: sourceType,
      sync_interval_minutes: 60, units_per_event: 1, priority: 10 },
    reason: `Create reviewed ${sourceType} Room source` },
});
const id = (prefix, sequence) => `${prefix}0000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;

deny(await rpc('hotel_v2_admin_get_external_calendar_provider_reviews', TOKENS.anon,
  { p_hotel_id: HOTEL }), 'anon Admin provider review list');
deny(await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.anon, {
  p_reviewed_plan: {}, p_correlation_id: id('e750', 90),
  p_idempotency_key: id('e751', 90), p_ical_url: null,
}), 'anon Partner provider proposal submission');
deny(await rpc('hotel_v2_admin_get_external_calendar_control', TOKENS.owner,
  { p_hotel_id: HOTEL }), 'Partner calling Admin control');
deny(await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.nonAdmin,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL }), 'foreign Partner control');
deny(await request('/hotel_calendar_source_configs?select=*', TOKENS.owner), 'raw source table');
deny(await request('/hotel_external_calendar_partner_proposals?select=*', TOKENS.admin),
  'private proposal table');
deny(await request('/hotel_external_calendar_provider_review_receipts?select=*', serviceToken),
  'private review receipt table');
deny(await request('/hotel_external_calendar_provider_admin_previews?select=*', TOKENS.admin),
  'private Admin provider preview table');
deny(await request('/hotel_external_calendar_source_secrets?select=*', TOKENS.owner),
  'private source-secret binding table');
deny(await request('/decrypted_secrets?select=*', TOKENS.admin), 'Vault decrypted-secret view');
deny(await request('/secrets?select=*', TOKENS.owner), 'Vault secret metadata table');
deny(await rpc('hotel_v2_external_calendar_worker_list_sources', TOKENS.admin, { p_limit: 25 }),
  'browser role calling worker RPC');

let adminControl = await rpc('hotel_v2_admin_get_external_calendar_control', TOKENS.admin,
  { p_hotel_id: HOTEL });
assert.equal(adminControl.status, 200, JSON.stringify(adminControl));
assert.equal(adminControl.payload.contract_version, 'hotels_v2_external_calendar_control_v2');
assert.deepEqual(adminControl.payload.provider_capability, {
  contract_version: 'hotels_v2_external_calendar_provider_capability_v1',
  stage: 'provider_types_active', supported_providers: ['booking_com', 'airbnb', 'ical'],
  source_review_available: true, private_url_management_available: true,
  activation_available: true, manual_sync_available: true, worker_scheduler_ready: true,
});
assert.deepEqual(new Set(adminControl.payload.rooms.map((room) => room.id)), new Set([UPPER, GROUND]));
redacted(adminControl.payload, 'Admin initial control');

const createAdmin = async (room, code, sourceType, sequence) => {
  const preview = await rpc('hotel_v2_admin_preview_external_calendar_plan', TOKENS.admin,
    { p_draft: draft(adminControl.payload, room, code, sourceType) });
  assert.equal(preview.status, 200, JSON.stringify(preview));
  assert.equal(preview.payload.reviewed_plan.operations[0].payload.source_type, sourceType);
  const applied = await rpc('hotel_v2_admin_apply_external_calendar_plan', TOKENS.admin, {
    p_reviewed_plan: preview.payload.reviewed_plan,
    p_correlation_id: id('e750', sequence), p_idempotency_key: id('e751', sequence),
    p_ical_url: null,
  });
  assert.equal(applied.status, 200, JSON.stringify(applied));
  adminControl = { status: 200, payload: applied.payload.control };
  redacted(applied.payload, `Admin ${sourceType} Apply`);
  return preview.payload.reviewed_plan.operations[0].id;
};

const bookingSourceId = await createAdmin(UPPER, 'upper-booking', 'booking_com', 1);
await createAdmin(UPPER, 'upper-generic', 'ical', 2);

const bookingWithoutSecret = adminControl.payload.sources.find((source) =>
  source.id === bookingSourceId);
const enableWithoutSecret = await rpc('hotel_v2_admin_preview_external_calendar_plan',
  TOKENS.admin, { p_draft: {
    contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: null, assignment_id: null, permission_version: null,
    access_snapshot_token: null, snapshot_token: adminControl.payload.snapshot_token,
    intent: { entity: 'calendar_source', action: 'enable', id: bookingSourceId,
      expected_version: bookingWithoutSecret.version, payload: {},
      reason: 'Reject Booking.com activation without private URL' },
  } });
controlled(enableWithoutSecret, 400, 'hotels_v2_external_calendar_secret_required',
  'Admin enable without private URL');
redacted(enableWithoutSecret.payload, 'Admin enable without private URL');

let partnerControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl));
const partnerPreview = await rpc('hotel_v2_partner_preview_external_calendar_plan', TOKENS.owner,
  { p_draft: draft(partnerControl.payload, GROUND, 'ground-airbnb', 'airbnb', 'partner') });
assert.equal(partnerPreview.status, 200, JSON.stringify(partnerPreview));
const partnerSubmit = await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.owner, {
  p_reviewed_plan: partnerPreview.payload.reviewed_plan,
  p_correlation_id: id('e750', 3), p_idempotency_key: id('e751', 3), p_ical_url: null,
});
assert.equal(partnerSubmit.status, 200, JSON.stringify(partnerSubmit));
exactKeys(partnerSubmit.payload, ['contract_version', 'proposal', 'replayed', 'control'],
  'Partner proposal envelope');
assert.equal(partnerSubmit.payload.contract_version,
  'hotels_v2_external_calendar_partner_proposal_submit_v1');
assert.equal(partnerSubmit.payload.proposal.status, 'pending_admin_review');
exactKeys(partnerSubmit.payload.proposal, PROPOSAL_KEYS, 'Partner proposal summary');
assert.ok(!partnerSubmit.payload.control.sources.some((source) => source.source_type === 'airbnb'));
redacted(partnerSubmit.payload, 'Partner proposal submission');
const partnerSubmitReplay = await rpc('hotel_v2_partner_apply_external_calendar_plan',
  TOKENS.owner, {
    p_reviewed_plan: partnerPreview.payload.reviewed_plan,
    p_correlation_id: id('e750', 3), p_idempotency_key: id('e751', 3), p_ical_url: null,
  });
assert.equal(partnerSubmitReplay.status, 200, JSON.stringify(partnerSubmitReplay));
assert.equal(partnerSubmitReplay.payload.proposal.proposal_id,
  partnerSubmit.payload.proposal.proposal_id);
assert.equal(partnerSubmitReplay.payload.replayed, true);
controlled(await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.owner, {
  p_reviewed_plan: partnerPreview.payload.reviewed_plan,
  p_correlation_id: id('e750', 31), p_idempotency_key: id('e751', 3), p_ical_url: null,
}), 409, 'hotels_v2_external_calendar_provider_proposal_idempotency_conflict',
'Partner provider-proposal idempotency conflict');
controlled(await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.owner, {
  p_reviewed_plan: partnerPreview.payload.reviewed_plan,
  p_correlation_id: id('e750', 3), p_idempotency_key: id('e751', 31), p_ical_url: null,
}), 409, 'hotels_v2_external_calendar_provider_proposal_correlation_conflict',
'Partner provider-proposal correlation conflict');

deny(await rpc('hotel_v2_admin_get_external_calendar_provider_reviews', TOKENS.owner,
  { p_hotel_id: HOTEL }), 'Partner reading Admin review queue');
let reviews = await rpc('hotel_v2_admin_get_external_calendar_provider_reviews', TOKENS.admin,
  { p_hotel_id: HOTEL });
assert.equal(reviews.status, 200, JSON.stringify(reviews));
exactKeys(reviews.payload, ['contract_version', 'hotel_id', 'proposals'],
  'Admin review-list envelope');
assert.equal(reviews.payload.contract_version,
  'hotels_v2_external_calendar_provider_review_list_v1');
assert.ok(reviews.payload.proposals.every((proposal) => {
  exactKeys(proposal, PROPOSAL_KEYS, 'Admin proposal summary');
  return true;
}));
assert.ok(reviews.payload.proposals.some((proposal) =>
  proposal.proposal_id === partnerSubmit.payload.proposal.proposal_id
    && proposal.status === 'pending_admin_review'));
redacted(reviews.payload, 'Admin provider review list');

const adminReason = 'Accept exact Partner Airbnb Room source';
const adminPreview = await rpc('hotel_v2_admin_preview_external_calendar_partner_proposal',
  TOKENS.admin, { p_proposal_id: partnerSubmit.payload.proposal.proposal_id,
    p_admin_reason: adminReason });
assert.equal(adminPreview.status, 200, JSON.stringify(adminPreview));
exactKeys(adminPreview.payload, ['contract_version', 'proposal', 'preview'],
  'Admin proposal Preview envelope');
assert.equal(adminPreview.payload.preview.reviewed_plan.actor_type, 'admin');
assert.equal(adminPreview.payload.preview.reviewed_plan.partner_id, null);
redacted(adminPreview.payload, 'Admin Partner-proposal Preview');
deny(await rpc('hotel_v2_admin_preview_external_calendar_partner_proposal', TOKENS.owner, {
  p_proposal_id: partnerSubmit.payload.proposal.proposal_id, p_admin_reason: adminReason,
}), 'Partner previewing an Admin proposal decision');
const adminAcceptBody = {
  p_proposal_id: partnerSubmit.payload.proposal.proposal_id,
  p_reviewed_plan: adminPreview.payload.preview.reviewed_plan,
  p_correlation_id: id('e750', 4), p_idempotency_key: id('e751', 4),
  p_admin_reason: adminReason,
};
deny(await rpc('hotel_v2_admin_apply_external_calendar_partner_proposal', TOKENS.owner,
  adminAcceptBody), 'Partner accepting an Admin proposal decision');
deny(await rpc('hotel_v2_admin_reject_external_calendar_partner_proposal', TOKENS.owner, {
  p_proposal_id: partnerSubmit.payload.proposal.proposal_id,
  p_admin_reason: 'Partner cannot reject an Admin proposal decision',
  p_correlation_id: id('e750', 91), p_idempotency_key: id('e751', 91),
}), 'Partner rejecting an Admin proposal decision');
const accepted = await rpc('hotel_v2_admin_apply_external_calendar_partner_proposal',
  TOKENS.admin, adminAcceptBody);
assert.equal(accepted.status, 200, JSON.stringify(accepted));
exactKeys(accepted.payload, ['contract_version', 'proposal', 'apply', 'replayed'],
  'Admin proposal Accept envelope');
assert.equal(accepted.payload.proposal.status, 'accepted');
assert.equal(accepted.payload.replayed, false);
assert.ok(accepted.payload.apply.control.sources.some((source) =>
  source.source_type === 'airbnb' && source.room_type_id === GROUND));
redacted(accepted.payload, 'Admin Partner-proposal Accept');
const acceptedReplay = await rpc('hotel_v2_admin_apply_external_calendar_partner_proposal',
  TOKENS.admin, adminAcceptBody);
assert.equal(acceptedReplay.status, 200, JSON.stringify(acceptedReplay));
assert.equal(acceptedReplay.payload.replayed, true);
reviews = await rpc('hotel_v2_admin_get_external_calendar_provider_reviews', TOKENS.admin,
  { p_hotel_id: HOTEL });
assert.equal(reviews.status, 200, JSON.stringify(reviews));
const acceptedAdminSummary = reviews.payload.proposals.find((proposal) =>
  proposal.proposal_id === partnerSubmit.payload.proposal.proposal_id);
assert.equal(acceptedAdminSummary.reviewed_by, USER_IDS.admin);
assert.equal(acceptedAdminSummary.admin_reason, adminReason);
redacted(reviews.payload, 'Admin accepted proposal attribution');

partnerControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl));
const acceptedPartnerSummary = partnerControl.payload.provider_proposals.find((proposal) =>
  proposal.proposal_id === partnerSubmit.payload.proposal.proposal_id);
assert.equal(acceptedPartnerSummary.reviewed_by, null);
assert.equal(acceptedPartnerSummary.admin_reason, adminReason);
const airbnb = partnerControl.payload.sources.find((source) => source.source_type === 'airbnb');
assert.ok(airbnb && airbnb.room_type_id === GROUND);

const nonHttpsSecret = await rpc('hotel_v2_partner_preview_external_calendar_plan', TOKENS.owner, {
  p_draft: {
    contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: PARTNER, assignment_id: partnerControl.payload.assignment_id,
    permission_version: partnerControl.payload.permission_version,
    access_snapshot_token: partnerControl.payload.access_snapshot_token,
    snapshot_token: partnerControl.payload.snapshot_token,
    intent: { entity: 'ical_secret', action: 'set', id: airbnb.id, expected_version: 0,
      payload: { source_id: airbnb.id, ical_url: 'http://airbnb.example.test/not-https.ics' },
      reason: 'Reject non HTTPS private Airbnb URL' },
  },
});
controlled(nonHttpsSecret, 400, 'hotels_v2_external_calendar_invalid_secret_payload',
  'Partner non-HTTPS private URL');
assert.ok(!JSON.stringify(nonHttpsSecret.payload).includes(
  'http://airbnb.example.test/not-https.ics'));

const secretPreview = await rpc('hotel_v2_partner_preview_external_calendar_plan', TOKENS.owner, {
  p_draft: {
    contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: PARTNER, assignment_id: partnerControl.payload.assignment_id,
    permission_version: partnerControl.payload.permission_version,
    access_snapshot_token: partnerControl.payload.access_snapshot_token,
    snapshot_token: partnerControl.payload.snapshot_token,
    intent: { entity: 'ical_secret', action: 'set', id: airbnb.id, expected_version: 0,
      payload: { source_id: airbnb.id, ical_url: TEST_URL },
      reason: 'Set reviewed private Airbnb export URL' },
  },
});
assert.equal(secretPreview.status, 200, JSON.stringify(secretPreview));
redacted(secretPreview.payload, 'Partner private URL Preview');
const mismatchedSecretSubmit = await rpc('hotel_v2_partner_apply_external_calendar_plan',
  TOKENS.owner, {
    p_reviewed_plan: secretPreview.payload.reviewed_plan,
    p_correlation_id: id('e750', 50), p_idempotency_key: id('e751', 50),
    p_ical_url: DIFFERENT_URL,
  });
controlled(mismatchedSecretSubmit, 409, 'hotels_v2_external_calendar_secret_hash_mismatch',
  'Partner private URL fingerprint mismatch');
redacted(mismatchedSecretSubmit.payload, 'Partner private URL fingerprint mismatch');
const secretSubmit = await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.owner, {
  p_reviewed_plan: secretPreview.payload.reviewed_plan,
  p_correlation_id: id('e750', 5), p_idempotency_key: id('e751', 5), p_ical_url: TEST_URL,
});
assert.equal(secretSubmit.status, 200, JSON.stringify(secretSubmit));
assert.equal(secretSubmit.payload.proposal.status, 'pending_admin_review');
redacted(secretSubmit.payload, 'Partner private URL proposal');

const secretReason = 'Accept exact reviewed private Airbnb export URL';
const secretAdminPreview = await rpc('hotel_v2_admin_preview_external_calendar_partner_proposal',
  TOKENS.admin, { p_proposal_id: secretSubmit.payload.proposal.proposal_id,
    p_admin_reason: secretReason });
assert.equal(secretAdminPreview.status, 200, JSON.stringify(secretAdminPreview));
redacted(secretAdminPreview.payload, 'Admin private URL Preview');
const secretAccepted = await rpc('hotel_v2_admin_apply_external_calendar_partner_proposal',
  TOKENS.admin, {
    p_proposal_id: secretSubmit.payload.proposal.proposal_id,
    p_reviewed_plan: secretAdminPreview.payload.preview.reviewed_plan,
    p_correlation_id: id('e750', 6), p_idempotency_key: id('e751', 6),
    p_admin_reason: secretReason,
  });
assert.equal(secretAccepted.status, 200, JSON.stringify(secretAccepted));
assert.equal(secretAccepted.payload.proposal.status, 'accepted');
assert.ok(secretAccepted.payload.apply.control.sources.some((source) =>
  source.id === airbnb.id && source.secret_configured === true));
redacted(secretAccepted.payload, 'Admin private URL Accept');

partnerControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl));
const currentAirbnb = partnerControl.payload.sources.find((source) => source.id === airbnb.id);
const rejectPreview = await rpc('hotel_v2_partner_preview_external_calendar_plan', TOKENS.owner, {
  p_draft: {
    contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: PARTNER, assignment_id: partnerControl.payload.assignment_id,
    permission_version: partnerControl.payload.permission_version,
    access_snapshot_token: partnerControl.payload.access_snapshot_token,
    snapshot_token: partnerControl.payload.snapshot_token,
    intent: { entity: 'calendar_source', action: 'update', id: currentAirbnb.id,
      expected_version: currentAirbnb.version,
      payload: { room_type_id: currentAirbnb.room_type_id, code: currentAirbnb.code,
        source_type: currentAirbnb.source_type,
        sync_interval_minutes: currentAirbnb.sync_interval_minutes,
        units_per_event: currentAirbnb.units_per_event,
        priority: currentAirbnb.priority + 1 },
      reason: 'Propose rejected Airbnb priority change' },
  },
});
assert.equal(rejectPreview.status, 200, JSON.stringify(rejectPreview));
const rejectSubmit = await rpc('hotel_v2_partner_apply_external_calendar_plan', TOKENS.owner, {
  p_reviewed_plan: rejectPreview.payload.reviewed_plan,
  p_correlation_id: id('e750', 7), p_idempotency_key: id('e751', 7), p_ical_url: null,
});
assert.equal(rejectSubmit.status, 200, JSON.stringify(rejectSubmit));
const rejected = await rpc('hotel_v2_admin_reject_external_calendar_partner_proposal',
  TOKENS.admin, {
    p_proposal_id: rejectSubmit.payload.proposal.proposal_id,
    p_admin_reason: 'Reject exact Partner priority proposal',
    p_correlation_id: id('e750', 8), p_idempotency_key: id('e751', 8),
  });
assert.equal(rejected.status, 200, JSON.stringify(rejected));
exactKeys(rejected.payload, ['contract_version', 'proposal', 'apply', 'replayed'],
  'Admin proposal Reject envelope');
assert.equal(rejected.payload.proposal.status, 'rejected');
assert.equal(rejected.payload.apply, null);
redacted(rejected.payload, 'Admin Partner-proposal Reject');
partnerControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl));
assert.equal(partnerControl.payload.sources.find((source) => source.id === airbnb.id).version,
  currentAirbnb.version);

partnerControl = await rpc('hotel_v2_partner_get_external_calendar_control', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL });
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl));
const rotationAirbnb = partnerControl.payload.sources.find((source) => source.id === airbnb.id);
assert.equal(rotationAirbnb.secret_configured, true);
const concurrentRotatePreview = await rpc('hotel_v2_partner_preview_external_calendar_plan',
  TOKENS.owner, { p_draft: {
    contract_version: 'hotels_v2_external_calendar_draft_v1', hotel_id: HOTEL,
    partner_id: PARTNER, assignment_id: partnerControl.payload.assignment_id,
    permission_version: partnerControl.payload.permission_version,
    access_snapshot_token: partnerControl.payload.access_snapshot_token,
    snapshot_token: partnerControl.payload.snapshot_token,
    intent: { entity: 'ical_secret', action: 'rotate', id: rotationAirbnb.id,
      expected_version: rotationAirbnb.binding_version,
      payload: { source_id: rotationAirbnb.id, ical_url: ROTATED_URL },
      reason: 'Rotate exact private Airbnb URL under concurrent Admin review' },
  } });
assert.equal(concurrentRotatePreview.status, 200, JSON.stringify(concurrentRotatePreview));
redacted(concurrentRotatePreview.payload, 'Concurrent private URL rotation Preview');
const concurrentRotateSubmit = await rpc('hotel_v2_partner_apply_external_calendar_plan',
  TOKENS.owner, {
    p_reviewed_plan: concurrentRotatePreview.payload.reviewed_plan,
    p_correlation_id: id('e750', 9), p_idempotency_key: id('e751', 9),
    p_ical_url: ROTATED_URL,
  });
assert.equal(concurrentRotateSubmit.status, 200, JSON.stringify(concurrentRotateSubmit));
redacted(concurrentRotateSubmit.payload, 'Concurrent private URL rotation proposal');
const concurrentAdminReason = 'Accept one exact concurrent private Airbnb URL rotation';
const concurrentAdminPreview = await rpc(
  'hotel_v2_admin_preview_external_calendar_partner_proposal', TOKENS.admin, {
    p_proposal_id: concurrentRotateSubmit.payload.proposal.proposal_id,
    p_admin_reason: concurrentAdminReason,
  });
assert.equal(concurrentAdminPreview.status, 200, JSON.stringify(concurrentAdminPreview));
redacted(concurrentAdminPreview.payload, 'Concurrent private URL rotation Admin Preview');
const concurrentBody = (sequence) => ({
  p_proposal_id: concurrentRotateSubmit.payload.proposal.proposal_id,
  p_reviewed_plan: concurrentAdminPreview.payload.preview.reviewed_plan,
  p_correlation_id: id('e750', sequence), p_idempotency_key: id('e751', sequence),
  p_admin_reason: concurrentAdminReason,
});
const concurrentResults = await Promise.all([
  rpc('hotel_v2_admin_apply_external_calendar_partner_proposal', TOKENS.admin,
    concurrentBody(10)),
  rpc('hotel_v2_admin_apply_external_calendar_partner_proposal', TOKENS.admin,
    concurrentBody(11)),
]);
const concurrentWinner = concurrentResults.find((result) => result.status === 200);
const concurrentLoser = concurrentResults.find((result) => result.status === 409);
assert.ok(concurrentWinner, JSON.stringify(concurrentResults));
assert.ok(concurrentLoser, JSON.stringify(concurrentResults));
assert.equal(concurrentWinner.payload.proposal.status, 'accepted');
assert.equal(concurrentWinner.payload.replayed, false);
controlled(concurrentLoser, 409,
  'hotels_v2_external_calendar_provider_proposal_decision_conflict',
  'Concurrent private URL rotation losing Admin Apply');
redacted(concurrentWinner.payload, 'Concurrent private URL rotation winner');
redacted(concurrentLoser.payload, 'Concurrent private URL rotation loser');
const concurrentSource = concurrentWinner.payload.apply.control.sources
  .find((source) => source.id === airbnb.id);
assert.equal(concurrentSource.secret_configured, true);
assert.equal(concurrentSource.binding_version, rotationAirbnb.binding_version + 1);
reviews = await rpc('hotel_v2_admin_get_external_calendar_provider_reviews', TOKENS.admin,
  { p_hotel_id: HOTEL });
assert.equal(reviews.status, 200, JSON.stringify(reviews));
assert.equal(reviews.payload.proposals.filter((proposal) =>
  proposal.proposal_id === concurrentRotateSubmit.payload.proposal.proposal_id
    && proposal.status === 'accepted').length, 1);
redacted(reviews.payload, 'Post-concurrency Admin provider review list');

const listed = await rpc('hotel_v2_external_calendar_worker_list_sources', serviceToken,
  { p_limit: 25 });
assert.equal(listed.status, 200, JSON.stringify(listed));
assert.equal(listed.payload.global_enabled, true);
assert.ok(listed.payload.sources.every((source) =>
  ['booking_com', 'airbnb', 'ical'].includes(source.source_type)));
redacted(listed.payload, 'Worker source projection');

console.log(JSON.stringify({
  contract: 'hotels_v2_seven_arches_external_calendar_readiness_postgrest_gate_v2',
  requests: requestCount, security_and_redaction_checks: securityCount,
  providers: ['booking_com', 'airbnb', 'ical'], rooms: [UPPER, GROUND],
  partner_proposals_accepted: 3, partner_proposals_rejected: 1, replay_checks: 2,
  identity_conflicts: 2,
  concurrent_accepts: 1, concurrent_conflicts: 1,
}));
