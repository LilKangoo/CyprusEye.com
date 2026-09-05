import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { TOKENS, USER_IDS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

// This gate intentionally does not build or mutate a fixture. It requires a
// disposable loopback database with 114400, 114405 and 114406 already
// installed, exposed through a local PostgREST process. The required direct
// database connection supplies canonical-helper proof, isolated lifecycle
// fixture rows, and receipt ledgers. Required: HOTELS_V2_114406_POSTGREST_URL,
// HOTELS_V2_114406_ADMIN_TOKEN, HOTELS_V2_114406_DATABASE_URL and
// HOTELS_V2_114406_DISPOSABLE=1. HOTELS_V2_114406_PSQL is optional.
// No production URL is accepted.
const POSTGREST_URL_ENV = 'HOTELS_V2_114406_POSTGREST_URL';
const ADMIN_TOKEN_ENV = 'HOTELS_V2_114406_ADMIN_TOKEN';
const DISPOSABLE_ACK_ENV = 'HOTELS_V2_114406_DISPOSABLE';
const DATABASE_URL_ENV = 'HOTELS_V2_114406_DATABASE_URL';
const PSQL_ENV = 'HOTELS_V2_114406_PSQL';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const PLAN_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_plan_v1';
const SNAPSHOT_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_snapshot_v1';
const PREVIEW_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_preview_v1';
const APPLY_CONTRACT = 'hotels_v2_seven_arches_pricing_activation_apply_result_v1';
const INVALID_PLAN = 'hotels_v2_seven_arches_pricing_activation_invalid_plan';
const REVIEW_MISMATCH = 'hotels_v2_seven_arches_pricing_activation_review_mismatch';
const REVIEW_CONSUMED = 'hotels_v2_seven_arches_pricing_activation_review_consumed';
const CORRELATION_CONFLICT =
  'hotels_v2_seven_arches_pricing_activation_correlation_conflict';
const IDEMPOTENCY_CONFLICT =
  'hotels_v2_seven_arches_pricing_activation_idempotency_conflict';
const FINGERPRINT_HELPER =
  'public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)';

const postgrestUrlText = process.env[POSTGREST_URL_ENV];
const adminToken = process.env[ADMIN_TOKEN_ENV];
assert.ok(postgrestUrlText,
  `${POSTGREST_URL_ENV} is required (a preinstalled local 114406 PostgREST fixture)`);
assert.ok(adminToken, `${ADMIN_TOKEN_ENV} is required (a local-only Admin JWT)`);
assert.equal(process.env[DISPOSABLE_ACK_ENV], '1',
  `${DISPOSABLE_ACK_ENV}=1 is required because the gate performs one local Apply`);

const postgrestUrl = new URL(postgrestUrlText);
assert.equal(postgrestUrl.protocol, 'http:', 'PostgREST fixture must use loopback HTTP');
assert.ok(LOOPBACK_HOSTS.has(postgrestUrl.hostname),
  'PostgREST fixture must be loopback-only');
const rpcBase = postgrestUrl.href.replace(/\/$/, '');

const databaseUrlText = process.env[DATABASE_URL_ENV];
assert.ok(databaseUrlText,
  `${DATABASE_URL_ENV} is required for canonical and lifecycle proof`);
const databaseUrl = new URL(databaseUrlText);
assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
assert.ok(LOOPBACK_HOSTS.has(databaseUrl.hostname),
  'Database fixture must be loopback-only');
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
assert.ok(databaseName && !['postgres', 'template0', 'template1'].includes(databaseName),
  'Database connection must target a disposable non-system fixture');
const psqlBin = process.env[PSQL_ENV] || 'psql';

const requestCounts = new Map();
const negativeResults = new Map();
let validApplyCount = 0;
let replayApplyCount = 0;
let foreignActorApplyCount = 0;

function countRequest(name) {
  requestCounts.set(name, (requestCounts.get(name) || 0) + 1);
}

function safeResponse(result) {
  return {
    status: result.status,
    code: typeof result.payload?.code === 'string' ? result.payload.code : null,
    message: typeof result.payload?.message === 'string' ? result.payload.message : null,
  };
}

async function rpc(name, body = {}, bearerToken = adminToken) {
  countRequest(name);
  const response = await fetch(`${rpcBase}/rpc/${name}`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const rawText = await response.text();
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    rawText,
    payload,
  };
}

function expectOk(result, label) {
  assert.equal(result.status, 200,
    `${label} failed: ${JSON.stringify(safeResponse(result))}`);
  assert.match(result.contentType, /application\/json/i,
    `${label} did not return JSON`);
  assert.ok(result.payload && typeof result.payload === 'object' && !Array.isArray(result.payload),
    `${label} returned a malformed JSON payload`);
  return result.payload;
}

function browserRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

function clone(value) {
  return browserRoundTrip(value);
}

function exactRate(plan, rateId) {
  const rates = plan?.operation?.expected_original?.room_rates;
  assert.ok(Array.isArray(rates), 'reviewed plan omitted expected_original.room_rates');
  const rate = rates.find((candidate) => candidate?.id === rateId);
  assert.ok(rate, `reviewed plan omitted Room Rate ${rateId}`);
  return rate;
}

function assertReadySnapshot(snapshot, expectedToken = null) {
  assert.equal(snapshot.contract_version, SNAPSHOT_CONTRACT);
  assert.equal(snapshot.hotel_id, HOTEL);
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.public_change, false);
  assert.equal(snapshot.legacy_authoritative, true);
  assert.deepEqual(snapshot.blocking_reasons, []);
  assert.match(snapshot.snapshot_token, /^[0-9a-f]{64}$/);
  if (expectedToken !== null) assert.equal(snapshot.snapshot_token, expectedToken);
  const rates = new Map(snapshot.room_rates.map((rate) => [rate.id, rate]));
  for (const rateId of [UPPER_RATE, GROUND_RATE]) {
    const rate = rates.get(rateId);
    assert.ok(rate, `activation snapshot omitted Room Rate ${rateId}`);
    assert.equal(typeof rate.base_nightly_rate, 'number');
    assert.equal(rate.base_nightly_rate, 0);
    assert.equal(rate.is_active, false);
    assert.equal(rate.currency, 'EUR');
  }
  assert.equal(snapshot.rate_plan.is_active, false);
  assert.equal(snapshot.shared_schedule.is_active, false);
  return snapshot;
}

function draft(snapshotToken) {
  return {
    contract_version: 'hotels_v2_seven_arches_pricing_activation_draft_v1',
    hotel_id: HOTEL,
    snapshot_token: snapshotToken,
    upper_base_nightly_rate: 100,
    ground_base_nightly_rate: 100,
    rate_plan_name_i18n: { pl: 'Standard', en: 'Standard', he: 'סטנדרטי' },
    rate_plan_description_i18n: { pl: 'Standard', en: 'Standard', he: 'Standard' },
    schedule_name_i18n: {
      pl: 'Wspólny cennik apartamentu',
      en: 'Shared apartment pricing',
      he: 'תמחור דירה משותף',
    },
    reason: 'Reviewed activation using the existing authoritative minimum-stay price as the equal initial base rate for both apartments.',
  };
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function conciseOutput(stderr, stdout = '') {
  const output = `${stderr}\n${stdout}`.trim();
  return output.length > 6_000
    ? `${output.slice(0, 1_000)}\n... output elided ...\n${output.slice(-5_000)}`
    : output;
}

async function runPsql(sql, applicationName) {
  assert.ok(databaseUrl, `${DATABASE_URL_ENV} is required for direct database proof`);
  const child = spawn(psqlBin, [
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', databaseUrl.href,
  ], {
    env: { ...process.env, PGAPPNAME: applicationName, PGCONNECT_TIMEOUT: '5' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.on('error', (error) => {
    if (error.code !== 'EPIPE') throw error;
  });
  child.stdin.end(`${sql.trim()}\n`);
  const { code, signal } = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode, exitSignal) =>
      resolve({ code: exitCode, signal: exitSignal }));
  });
  assert.equal(code, 0,
    `${applicationName} failed (${signal || code}): ${conciseOutput(stderr, stdout)}`);
  return stdout.trim();
}

async function dbJson(sql, applicationName) {
  const output = await runPsql(`
    begin;
    set transaction read only;
    set local statement_timeout='30s';
    ${sql}
    rollback;
  `, applicationName);
  const rows = output.split('\n').map((row) => row.trim()).filter(Boolean);
  assert.equal(rows.length, 1, `${applicationName} expected one JSON row`);
  return JSON.parse(rows[0]);
}

async function activationInventory(label) {
  return dbJson(`
    select json_build_object(
      'review_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_reviews),
      'unconsumed_review_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_reviews
        where consumed_at is null),
      'consumed_review_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_reviews
        where consumed_at is not null),
      'activation_receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'transaction_context_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_transaction_context),
      'receipt_exact',public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
    )::text;
  `, `hotels_v2_114406_${label}`);
}

function planWithExpectedZeroLexeme(plan, lexeme) {
  assert.match(lexeme, /^0(?:\.0+)?$/);
  const value = clone(plan);
  exactRate(value, UPPER_RATE).base_nightly_rate = '__UPPER_ZERO_LEXEME__';
  exactRate(value, GROUND_RATE).base_nightly_rate = '__GROUND_ZERO_LEXEME__';
  const serialized = JSON.stringify(value)
    .replace('"__UPPER_ZERO_LEXEME__"', lexeme)
    .replace('"__GROUND_ZERO_LEXEME__"', lexeme);
  assert.equal(serialized.includes('ZERO_LEXEME'), false);
  return serialized;
}

async function canonicalFingerprintLedger(plan, roundTrippedPlan) {
  const rows = ['0', '0.0', '0.00'].map((lexeme) =>
    `(${quoteLiteral(lexeme)},${quoteLiteral(planWithExpectedZeroLexeme(plan, lexeme))}::jsonb)`);
  const browserPlan = `${quoteLiteral(JSON.stringify(roundTrippedPlan))}::jsonb`;
  const httpPlan = `${quoteLiteral(JSON.stringify(plan))}::jsonb`;
  return dbJson(`
    with variants(label,plan) as(values ${rows.join(',')}),
    transport(label,plan) as(
      select 'stored_preview',reviewed_plan
      from public.hotel_seven_arches_pricing_activation_reviews
      where id=${quoteLiteral(plan.review_id)}::uuid
      union all
      select 'browser_roundtrip',${browserPlan}
    )
    select json_build_object(
      'helper_signature',${quoteLiteral(FINGERPRINT_HELPER)},
      'helper_present',to_regprocedure(${quoteLiteral(FINGERPRINT_HELPER)}) is not null,
      'stored_preview_matches_http',(select reviewed_plan=${httpPlan}
        from public.hotel_seven_arches_pricing_activation_reviews
        where id=${quoteLiteral(plan.review_id)}::uuid),
      'lexical_fingerprints',(select json_object_agg(label,
          public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
            plan) order by label)
        from variants),
      'transport_fingerprints',(select json_object_agg(label,json_build_object(
          'raw',encode(extensions.digest(convert_to(
            (plan-'plan_fingerprint')::text,'UTF8'),'sha256'),'hex'),
          'helper',public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(plan)
        ) order by label)
        from transport)
    )::text;
  `, 'hotels_v2_114406_canonical_zero_ledger');
}

async function canonicalizeAndFingerprintPlan(plan, label) {
  const withoutFingerprint = clone(plan);
  delete withoutFingerprint.plan_fingerprint;
  const input = `${quoteLiteral(JSON.stringify(withoutFingerprint))}::jsonb`;
  const fingerprinted = await dbJson(`
    with canonical as(
      select public.hotel_v2_seven_arches_pricing_activation_canonical_json(
        ${input}) value
    ), fingerprinted as(
      select value||jsonb_build_object('plan_fingerprint',
        public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(value)) value
      from canonical
    )
    select value::text from fingerprinted;
  `, `hotels_v2_114406_refingerprint_${label}`);
  assert.ok(fingerprinted && typeof fingerprinted === 'object'
      && !Array.isArray(fingerprinted), `${label}: helper returned no plan`);
  assert.match(fingerprinted.plan_fingerprint, /^[0-9a-f]{64}$/,
    `${label}: helper returned no canonical fingerprint`);
  return browserRoundTrip(fingerprinted);
}

async function getSnapshot() {
  return expectOk(await rpc('hotel_v2_admin_get_seven_arches_pricing_activation'),
    'activation Get');
}

async function expectApplyError(plan, label, expectedStatus, expectedCode,
  expectedMessage, expectedInventory = null, applyOptions = {}) {
  const correlationId = applyOptions.correlationId || randomUUID();
  const idempotencyKey = applyOptions.idempotencyKey
    || `browser-roundtrip-negative-${label}-${randomUUID()}`;
  const result = await rpc('hotel_v2_admin_apply_seven_arches_pricing_activation', {
    p_reviewed_plan: plan,
    p_correlation_id: correlationId,
    p_idempotency_key: idempotencyKey,
  }, applyOptions.token || adminToken);
  assert.equal(result.status, expectedStatus,
    `${label} returned an unexpected status: ${JSON.stringify(safeResponse(result))}`);
  assert.equal(result.payload?.code, expectedCode,
    `${label} returned an unexpected SQLSTATE: ${JSON.stringify(safeResponse(result))}`);
  assert.equal(result.payload?.message, expectedMessage,
    `${label} returned an unexpected error: ${JSON.stringify(safeResponse(result))}`);
  assert.equal(negativeResults.has(label), false, `${label}: duplicate negative label`);
  negativeResults.set(label, {
    status: result.status,
    code: result.payload.code,
    message: result.payload.message,
  });
  if (expectedInventory) {
    assert.deepEqual(await activationInventory(`after_${label}`), expectedInventory,
      `${label}: rejected Apply changed Review, receipt or context inventory`);
  }
}

async function expectInvalidPlan(plan, label, expectedInventory = null) {
  return expectApplyError(plan, label, 400, '22023', INVALID_PLAN,
    expectedInventory);
}

const baselineInventory = databaseUrl
  ? await activationInventory('baseline_inventory')
  : null;
if (baselineInventory) {
  assert.deepEqual(baselineInventory, {
    review_count: 1,
    unconsumed_review_count: 1,
    consumed_review_count: 0,
    activation_receipt_count: 0,
    transaction_context_count: 0,
    receipt_exact: false,
  }, '114406 fixture must retain exactly one old unconsumed Review');
}

const oldReviewEvidence = databaseUrl
  ? await dbJson(`
      select json_build_object(
        'reviewed_plan',review.reviewed_plan,
        'stored_fingerprint',review.plan_fingerprint,
        'canonical_fingerprint',
          public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
            review.reviewed_plan),
        'already_canonical',
          public.hotel_v2_seven_arches_pricing_activation_canonical_json(
            review.reviewed_plan-'plan_fingerprint')::text =
            (review.reviewed_plan-'plan_fingerprint')::text
      )::text
      from public.hotel_seven_arches_pricing_activation_reviews review
      where review.consumed_at is null
      order by review.created_at,review.id
      limit 1;
    `, 'hotels_v2_114406_old_review_evidence')
  : null;
if (oldReviewEvidence) {
  assert.equal(oldReviewEvidence.already_canonical, false,
    'pre-114406 Review unexpectedly already used the canonical contract');
  assert.notEqual(oldReviewEvidence.stored_fingerprint,
    oldReviewEvidence.canonical_fingerprint,
    'pre-114406 Review unexpectedly matches the canonical fingerprint');
  await expectInvalidPlan(browserRoundTrip(oldReviewEvidence.reviewed_plan),
    '22_stale_review');
  assert.deepEqual(await activationInventory('after_old_review_rejection'),
    baselineInventory,
    'rejected pre-114406 Review changed Review, receipt or context state');
}

const initialSnapshot = assertReadySnapshot(await getSnapshot());
assert.equal(initialSnapshot.h3_1p?.parity?.total_case_count, 70);
assert.equal(initialSnapshot.h3_1p?.parity?.total_mismatch_count, 0);
assert.equal(initialSnapshot.h3_1p?.allocation_exact, true);
assert.equal(initialSnapshot.commission_policy?.commission_mode,
  'per_allocated_room_per_night');
assert.equal(initialSnapshot.commission_policy?.amount, 10);
assert.equal(initialSnapshot.commission_policy?.currency, 'EUR');

const previewResponse = await rpc(
  'hotel_v2_admin_preview_seven_arches_pricing_activation',
  { p_draft: draft(initialSnapshot.snapshot_token) },
);
const preview = expectOk(previewResponse, 'activation Preview');
assert.equal(preview.contract_version, PREVIEW_CONTRACT);
assert.equal(preview.hotel_id, HOTEL);
assert.equal(preview.changed, true);
assert.deepEqual(preview.blocking_reasons, []);
assert.ok(preview.reviewed_plan && typeof preview.reviewed_plan === 'object');
const serverPlan = preview.reviewed_plan;
assert.equal(serverPlan.contract_version, PLAN_CONTRACT);
assert.equal(serverPlan.hotel_id, HOTEL);
assert.match(serverPlan.review_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.match(serverPlan.plan_fingerprint, /^[0-9a-f]{64}$/);

const upperExpected = exactRate(serverPlan, UPPER_RATE);
const groundExpected = exactRate(serverPlan, GROUND_RATE);
for (const rate of [upperExpected, groundExpected]) {
  assert.equal(typeof rate.base_nightly_rate, 'number');
  assert.equal(rate.base_nightly_rate, 0);
}
assert.equal(serverPlan.operation?.payload?.upper_base_nightly_rate, 100);
assert.equal(serverPlan.operation?.payload?.ground_base_nightly_rate, 100);

// This is the actual browser boundary. The payload returned by PostgREST was
// already parsed once; serialize and parse it again exactly as the Admin
// repository/browser transport does before the Apply request.
const previewTransportJson = JSON.stringify(serverPlan);
const roundTrippedPlan = JSON.parse(previewTransportJson);
const applyTransportJson = JSON.stringify(roundTrippedPlan);
assert.deepEqual(roundTrippedPlan, serverPlan);
assert.notEqual(roundTrippedPlan, serverPlan);
assert.equal(applyTransportJson, previewTransportJson,
  'canonical reviewed plan changed during the browser JSON round trip');
assert.equal(exactRate(roundTrippedPlan, UPPER_RATE).base_nightly_rate, 0);
assert.equal(exactRate(roundTrippedPlan, GROUND_RATE).base_nightly_rate, 0);
assert.equal(JSON.stringify(exactRate(serverPlan, UPPER_RATE).base_nightly_rate), '0');
assert.equal(JSON.stringify(exactRate(serverPlan, GROUND_RATE).base_nightly_rate), '0');

const zeroLexemeInputs = Object.fromEntries(['0', '0.0', '0.00'].map((lexeme) => {
  const raw = planWithExpectedZeroLexeme(roundTrippedPlan, lexeme);
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, roundTrippedPlan,
    `browser semantic value changed for canonical zero lexeme ${lexeme}`);
  return [lexeme, raw];
}));
assert.equal(new Set(Object.values(zeroLexemeInputs)).size, 3,
  'zero lexical fixtures must be physically distinct before JSON.parse');

const afterPreviewInventory = databaseUrl
  ? await activationInventory('after_preview_inventory')
  : null;
if (afterPreviewInventory) {
  assert.deepEqual(afterPreviewInventory, {
    review_count: 2,
    unconsumed_review_count: 2,
    consumed_review_count: 0,
    activation_receipt_count: 0,
    transaction_context_count: 0,
    receipt_exact: false,
  }, 'fresh Preview must coexist with the old unconsumed Review');
}

const canonicalLedger = databaseUrl
  ? await canonicalFingerprintLedger(serverPlan, roundTrippedPlan)
  : null;
if (canonicalLedger) {
  assert.equal(canonicalLedger.helper_signature, FINGERPRINT_HELPER);
  assert.equal(canonicalLedger.helper_present, true);
  assert.equal(canonicalLedger.stored_preview_matches_http, true);
  assert.deepEqual(Object.keys(canonicalLedger.lexical_fingerprints).sort(),
    ['0', '0.0', '0.00']);
  for (const [lexeme, fingerprint] of Object.entries(canonicalLedger.lexical_fingerprints)) {
    assert.equal(fingerprint, serverPlan.plan_fingerprint,
      `canonical helper changed fingerprint for numeric lexeme ${lexeme}`);
  }
  assert.deepEqual(Object.keys(canonicalLedger.transport_fingerprints).sort(),
    ['browser_roundtrip', 'stored_preview']);
  for (const [phase, fingerprints] of Object.entries(
    canonicalLedger.transport_fingerprints
  )) {
    assert.equal(fingerprints.raw, serverPlan.plan_fingerprint,
      `${phase} raw canonical plan hash differs from stored Preview fingerprint`);
    assert.equal(fingerprints.helper, serverPlan.plan_fingerprint,
      `${phase} helper hash differs from stored Preview fingerprint`);
    assert.equal(fingerprints.raw, fingerprints.helper,
      `${phase} raw and helper canonical hashes differ`);
  }
}

function shiftTimestamp(value, milliseconds) {
  const shifted = new Date(Date.parse(value) + milliseconds);
  assert.equal(Number.isNaN(shifted.valueOf()), false, `invalid fixture timestamp: ${value}`);
  return shifted.toISOString();
}

// Cases 1-15 are re-fingerprinted through the installed canonical helper
// whenever their shape permits it. They therefore pass the new transport
// fingerprint contract and are rejected by the exact immutable Review-row
// binding (except the foreign Hotel, which the initial Hotel guard rejects).
// Cases 16-21 intentionally exercise initial structural/type guards. Every
// submitted value crosses the same JSON.stringify/JSON.parse boundary as the
// browser and reaches Apply through real PostgREST.
const initialPlanTamperCases = [
  {
    number: 1,
    label: '01_upper_rate_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.operation.payload.upper_base_nightly_rate = 101; },
  },
  {
    number: 2,
    label: '02_ground_rate_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.operation.payload.ground_base_nightly_rate = 101; },
  },
  {
    number: 3,
    label: '03_rate_plan_identity_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.operation.expected_original.rate_plan.id = randomUUID(); },
  },
  {
    number: 4,
    label: '04_room_rate_identity_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { exactRate(plan, UPPER_RATE).id = randomUUID(); },
  },
  {
    number: 5,
    label: '05_room_type_identity_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { exactRate(plan, UPPER_RATE).room_type_id = randomUUID(); },
  },
  {
    number: 6,
    label: '06_shared_schedule_identity_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.operation.expected_original.shared_schedule.id = randomUUID(); },
  },
  {
    number: 7,
    label: '07_hotel_id_changed',
    refingerprint: true,
    expectedMessage: INVALID_PLAN,
    mutate: (plan) => { plan.hotel_id = randomUUID(); },
  },
  {
    number: 8,
    label: '08_snapshot_token_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.snapshot_token = '0'.repeat(64); },
  },
  {
    number: 9,
    label: '09_review_id_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.review_id = randomUUID(); },
  },
  {
    number: 10,
    label: '10_reviewed_at_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.reviewed_at = shiftTimestamp(plan.reviewed_at, 1_000); },
  },
  {
    number: 11,
    label: '11_expires_at_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.expires_at = shiftTimestamp(plan.expires_at, -1_000); },
  },
  {
    number: 12,
    label: '12_operation_entity_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.operation.entity = 'room_rate'; },
  },
  {
    number: 13,
    label: '13_operation_action_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.operation.action = 'update'; },
  },
  {
    number: 14,
    label: '14_expected_original_semantic_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => {
      plan.operation.expected_original.rate_plan.cancellation_policy = 'flexible';
    },
  },
  {
    number: 15,
    label: '15_operation_payload_semantic_changed',
    refingerprint: true,
    expectedMessage: REVIEW_MISMATCH,
    mutate: (plan) => { plan.operation.payload.reason += ' tampered'; },
  },
  {
    number: 16,
    label: '16_added_top_level_key',
    refingerprint: false,
    expectedMessage: INVALID_PLAN,
    mutate: (plan) => { plan.unexpected = true; },
  },
  {
    number: 17,
    label: '17_missing_required_top_level_key',
    refingerprint: false,
    expectedMessage: INVALID_PLAN,
    mutate: (plan) => { delete plan.expires_at; },
  },
  {
    number: 18,
    label: '18_malformed_uuid',
    refingerprint: false,
    expectedMessage: INVALID_PLAN,
    mutate: (plan) => { plan.review_id = 'not-a-canonical-uuid'; },
  },
  {
    number: 19,
    label: '19_malformed_timestamp',
    refingerprint: false,
    expectedMessage: INVALID_PLAN,
    mutate: (plan) => { plan.reviewed_at = '2026-09-05 12:00:00 UTC'; },
  },
  {
    number: 20,
    label: '20_malformed_fingerprint',
    refingerprint: false,
    expectedMessage: INVALID_PLAN,
    mutate: (plan) => { plan.plan_fingerprint = 'not-a-sha256-fingerprint'; },
  },
  {
    number: 21,
    label: '21_arbitrary_numeric_string',
    refingerprint: false,
    expectedMessage: INVALID_PLAN,
    mutate: (numericStringPayload) => {
      numericStringPayload.operation.payload.upper_base_nightly_rate = '100.00';
    },
  },
];
assert.deepEqual(initialPlanTamperCases.map((testCase) => testCase.number),
  Array.from({ length: 21 }, (_, index) => index + 1));

for (const testCase of initialPlanTamperCases) {
  let tamperedPlan = clone(roundTrippedPlan);
  const beforeMutation = JSON.stringify(tamperedPlan);
  testCase.mutate(tamperedPlan);
  assert.notEqual(JSON.stringify(tamperedPlan), beforeMutation,
    `${testCase.label}: mutation did not change the plan`);
  if (testCase.refingerprint) {
    tamperedPlan = await canonicalizeAndFingerprintPlan(tamperedPlan, testCase.label);
    assert.notEqual(tamperedPlan.plan_fingerprint, roundTrippedPlan.plan_fingerprint,
      `${testCase.label}: semantic tamper retained the reviewed fingerprint`);
  }
  const expectedStatus = testCase.expectedMessage === INVALID_PLAN ? 400 : 409;
  const expectedCode = testCase.expectedMessage === INVALID_PLAN ? '22023' : 'PT409';
  await expectApplyError(browserRoundTrip(tamperedPlan), testCase.label,
    expectedStatus, expectedCode, testCase.expectedMessage, afterPreviewInventory);
}

// A second, locally provisioned Admin proves that a transport-valid reviewed
// plan remains bound to the actor who created the immutable Review. This uses
// a real authenticated JWT and PostgREST request; no Review row is fabricated.
const foreignActorFixture = await dbJson(`
  select json_build_object(
    'actor_distinct',${quoteLiteral(USER_IDS.secondOwner)}::uuid<>
      ${quoteLiteral(USER_IDS.admin)}::uuid,
    'second_actor_is_admin',exists(select 1 from public.profiles profile
      where profile.id=${quoteLiteral(USER_IDS.secondOwner)}::uuid
        and profile.is_admin is true)
  )::text;
`, 'hotels_v2_114406_foreign_actor_fixture');
assert.deepEqual(foreignActorFixture, {
  actor_distinct: true,
  second_actor_is_admin: true,
}, 'foreign-actor fixture must contain a distinct second Admin');
await expectApplyError(browserRoundTrip(roundTrippedPlan), '25_foreign_actor',
  409, 'PT409', REVIEW_MISMATCH, afterPreviewInventory, {
    token: TOKENS.secondOwner,
  });
foreignActorApplyCount += 1;

const afterNegativeSnapshot = assertReadySnapshot(
  await getSnapshot(), initialSnapshot.snapshot_token,
);
assert.equal(afterNegativeSnapshot.h3_1p?.parity?.total_mismatch_count, 0);
const afterNegativeInventory = databaseUrl
  ? await activationInventory('after_negative_inventory')
  : null;
if (afterNegativeInventory) {
  assert.deepEqual(afterNegativeInventory, afterPreviewInventory,
    'invalid Apply attempts changed Review, receipt or transaction-context state');
}

const correlationId = randomUUID();
const idempotencyKey = `browser-roundtrip-apply-${randomUUID()}`;
const applyResponse = await rpc('hotel_v2_admin_apply_seven_arches_pricing_activation', {
  p_reviewed_plan: roundTrippedPlan,
  p_correlation_id: correlationId,
  p_idempotency_key: idempotencyKey,
});
validApplyCount += 1;
const applied = expectOk(applyResponse, 'browser-round-tripped activation Apply');
assert.equal(applied.contract_version, APPLY_CONTRACT);
assert.equal(applied.hotel_id, HOTEL);
assert.equal(applied.changed, true);
assert.equal(applied.replayed, false);
assert.equal(applied.review_id, roundTrippedPlan.review_id);
assert.equal(applied.correlation_id, correlationId);
assert.equal(applied.idempotency_key, idempotencyKey);
assert.equal(applied.public_change, false);
assert.equal(applied.legacy_authoritative, true);
assert.equal(Array.isArray(applied.activity_ids), true);
assert.equal(applied.activity_ids.length, 4);

const activeSnapshot = await getSnapshot();
assert.equal(activeSnapshot.contract_version, SNAPSHOT_CONTRACT);
assert.equal(activeSnapshot.hotel_id, HOTEL);
assert.equal(activeSnapshot.status, 'active');
assert.deepEqual(activeSnapshot.blocking_reasons, []);
assert.equal(activeSnapshot.public_change, false);
assert.equal(activeSnapshot.legacy_authoritative, true);
assert.notEqual(activeSnapshot.snapshot_token, initialSnapshot.snapshot_token);
assert.equal(activeSnapshot.rate_plan.is_active, true);
assert.equal(activeSnapshot.shared_schedule.is_active, true);
const activeRates = new Map(activeSnapshot.room_rates.map((rate) => [rate.id, rate]));
for (const rateId of [UPPER_RATE, GROUND_RATE]) {
  assert.equal(activeRates.get(rateId)?.base_nightly_rate, 100);
  assert.equal(activeRates.get(rateId)?.is_active, true);
  assert.equal(activeRates.get(rateId)?.currency, 'EUR');
}
assert.equal(activeSnapshot.h3_1p?.parity?.total_case_count, 70);
assert.equal(activeSnapshot.h3_1p?.parity?.total_mismatch_count, 0);
assert.equal(activeSnapshot.h3_1p?.allocation_exact, true);
assert.equal(activeSnapshot.commission_policy?.commission_mode,
  'per_allocated_room_per_night');
assert.equal(activeSnapshot.commission_policy?.amount, 10);
assert.equal(activeSnapshot.commission_policy?.currency, 'EUR');

const finalInventory = databaseUrl
  ? await activationInventory('final_inventory')
  : null;
if (finalInventory) {
  assert.deepEqual(finalInventory, {
    review_count: 2,
    unconsumed_review_count: 1,
    consumed_review_count: 1,
    activation_receipt_count: 1,
    transaction_context_count: 0,
    receipt_exact: true,
  }, 'successful browser Apply did not leave the exact receipt/review state');
}

// One exact replay is a read of the immutable idempotency receipt, never a
// second activation mutation. Distinct correlation/key conflicts and a new
// request against the consumed Review all fail closed and preserve inventory.
const replayResponse = await rpc('hotel_v2_admin_apply_seven_arches_pricing_activation', {
  p_reviewed_plan: roundTrippedPlan,
  p_correlation_id: correlationId,
  p_idempotency_key: idempotencyKey,
});
replayApplyCount += 1;
const replayed = expectOk(replayResponse, 'exact idempotent activation replay');
assert.equal(replayed.changed, true);
assert.equal(replayed.replayed, true);
assert.equal(replayed.review_id, roundTrippedPlan.review_id);
assert.equal(replayed.correlation_id, correlationId);
assert.equal(replayed.idempotency_key, idempotencyKey);
assert.deepEqual(await activationInventory('after_exact_replay'), finalInventory,
  'exact idempotent replay created a second mutation');

await expectApplyError(roundTrippedPlan, '27_idempotency_conflict',
  409, 'PT409', IDEMPOTENCY_CONFLICT, finalInventory, {
    correlationId: randomUUID(), idempotencyKey,
  });
await expectApplyError(roundTrippedPlan, '26_correlation_conflict',
  409, 'PT409', CORRELATION_CONFLICT, finalInventory, {
    correlationId, idempotencyKey: `browser-roundtrip-correlation-${randomUUID()}`,
  });
await expectApplyError(roundTrippedPlan, '24_consumed_review',
  409, 'PT409', REVIEW_CONSUMED, finalInventory);

assert.equal(requestCounts.get('hotel_v2_admin_preview_seven_arches_pricing_activation'), 1);
assert.equal(initialPlanTamperCases.length, 21);
assert.equal(negativeResults.size, 26);
for (const label of [
  '22_stale_review',
  ...initialPlanTamperCases.map((testCase) => testCase.label),
  '24_consumed_review',
  '25_foreign_actor',
  '26_correlation_conflict',
  '27_idempotency_conflict',
]) assert.equal(negativeResults.has(label), true, `missing negative result: ${label}`);
assert.equal(validApplyCount, 1);
assert.equal(replayApplyCount, 1);
assert.equal(foreignActorApplyCount, 1);
assert.equal(requestCounts.get('hotel_v2_admin_apply_seven_arches_pricing_activation'),
  28);

console.log(JSON.stringify({
  contract_version: 'hotels_v2_114406_browser_roundtrip_postgrest_gate_v1',
  fixture: 'loopback_preinstalled_114406',
  postgrest_roundtrip: true,
  preview_plan_canonical_before_transport: true,
  semantic_plan_unchanged_after_browser_roundtrip: true,
  raw_helper_transport_hashes: canonicalLedger ? 'PASS' : 'SKIPPED_NO_DATABASE_URL',
  pre_114406_scaled_zero_evidence: 'NOT_REEXECUTED_BY_POSTFIX_GATE',
  browser_zero_lexemes: Object.keys(zeroLexemeInputs),
  canonical_helper_proof: canonicalLedger ? 'PASS' : 'SKIPPED_NO_DATABASE_URL',
  pre_114406_review_rejected: oldReviewEvidence ? 'PASS' : 'SKIPPED_NO_DATABASE_URL',
  old_review_unconsumed_after_apply: finalInventory
    ? finalInventory.unconsumed_review_count === 1
    : 'SKIPPED_NO_DATABASE_URL',
  receipt_review_context_proof: finalInventory ? 'PASS' : 'SKIPPED_NO_DATABASE_URL',
  initial_plan_semantic_tamper_rejections: initialPlanTamperCases.length,
  refingerprinted_row_binding_rejections:
    initialPlanTamperCases.filter((testCase) => testCase.refingerprint).length,
  browser_path_negative_rejections: negativeResults.size,
  lifecycle_negatives_mapped_to_existing_gates: [
    '23_expired_review',
    '28_stale_snapshot',
    '29_parity_drift',
    '30_allocation_drift',
    '31_commission_drift',
    '32_payment_policy_drift',
    '33_protected_foundation_drift',
  ],
  required_negative_contract_count: 33,
  preview_calls: requestCounts.get('hotel_v2_admin_preview_seven_arches_pricing_activation'),
  valid_apply_calls: validApplyCount,
  exact_idempotent_replay_calls: replayApplyCount,
  foreign_actor_apply_calls: foreignActorApplyCount,
  idempotent_replay_mutations: 0,
  automatic_apply_retries: 0,
  final_status: activeSnapshot.status,
  activation_receipt_count: finalInventory?.activation_receipt_count ?? 'HTTP_NOT_EXPOSED',
}, null, 2));
console.log('browser_roundtrip_apply=PASS');
