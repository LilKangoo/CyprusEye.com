import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The disposable template is created by pricing-activation-postgres-base.sql
// with provider_install_external_enabled=1,
// seven_arches_owner_live_drift_fixture=1 and seven_arches_owner_skip_task2=1.
// It therefore represents production immediately after verified 114360 and
// immediately before 114370, without replaying Stage2F activation.
const FIXTURE_URL_ENV = 'HOTELS_V2_TASK2_FOUNDATION_DATABASE_URL';
const DISPOSABLE_ACK_ENV = 'HOTELS_V2_TASK2_FOUNDATION_DISPOSABLE';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const fixtureUrlText = process.env[FIXTURE_URL_ENV];

assert.ok(fixtureUrlText, `${FIXTURE_URL_ENV} is required`);
assert.equal(process.env[DISPOSABLE_ACK_ENV], '1',
  `${DISPOSABLE_ACK_ENV}=1 is required for disposable database cloning`);

const fixtureUrl = new URL(fixtureUrlText);
assert.ok(['postgres:', 'postgresql:'].includes(fixtureUrl.protocol),
  'Task2 foundation fixture must use a PostgreSQL URL');
assert.ok(LOOPBACK_HOSTS.has(fixtureUrl.hostname),
  'Task2 foundation fixture must be loopback-only');

const templateDatabase = decodeURIComponent(fixtureUrl.pathname.replace(/^\//, ''));
assert.ok(templateDatabase && !['postgres', 'template0', 'template1'].includes(templateDatabase),
  'Task2 foundation fixture must name a disposable non-system template database');

const psqlBin = process.env.HOTELS_V2_TASK2_FOUNDATION_PSQL || 'psql';
const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(integrationDir, '..', '..');
const migrationPath = resolve(repoRoot, 'supabase', 'migrations',
  '20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql');
const preflightPath = resolve(repoRoot, 'supabase', 'manual',
  'hotels_v2_seven_arches_partner_property_proposal_review_preflight.sql');
const migrationSql = await readFile(migrationPath, 'utf8');
const preflightSql = await readFile(preflightPath, 'utf8');

const runSuffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const caseNames = [
  'production', 'post_drift', 'owner_receipt', 'h3_receipt', 'unsafe', 'boundary',
];
const caseDatabases = new Map(caseNames.map((caseName) => [
  caseName, `hotels_v2_114370_${runSuffix}_${caseName}`,
]));
const adminUrl = withDatabase(fixtureUrl, 'postgres');
const createdDatabases = [];

function withDatabase(url, databaseName) {
  const next = new URL(url.href);
  next.pathname = `/${encodeURIComponent(databaseName)}`;
  return next;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function conciseError(stderr, stdout = '') {
  const text = `${stderr}\n${stdout}`.trim();
  return text.length > 5_000 ? text.slice(-5_000) : text;
}

async function runPsql(databaseUrl, sql, applicationName) {
  const child = spawn(psqlBin, [
    '-X', '-A', '-t', '-q', '-F', '|', '-d', databaseUrl.href,
    '-v', 'ON_ERROR_STOP=1',
  ], {
    cwd: repoRoot,
    env: { ...process.env, PGAPPNAME: applicationName, PGCONNECT_TIMEOUT: '5' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(`${sql.trim()}\n`);
  const { code, signal } = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', (exitCode, exitSignal) =>
      resolveExit({ code: exitCode, signal: exitSignal }));
  });
  assert.equal(code, 0,
    `${applicationName} failed (${signal || code}): ${conciseError(stderr, stdout)}`);
  return stdout.trim();
}

async function runPsqlExpectFailure(databaseUrl, sql, applicationName, expectedMessage) {
  const child = spawn(psqlBin, [
    '-X', '-A', '-t', '-q', '-F', '|', '-d', databaseUrl.href,
    '-v', 'ON_ERROR_STOP=1',
  ], {
    cwd: repoRoot,
    env: { ...process.env, PGAPPNAME: applicationName, PGCONNECT_TIMEOUT: '5' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(`${sql.trim()}\n`);
  const { code, signal } = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', (exitCode, exitSignal) =>
      resolveExit({ code: exitCode, signal: exitSignal }));
  });
  const output = conciseError(stderr, stdout);
  assert.notEqual(code, 0,
    `${applicationName} unexpectedly passed (${signal || code}): ${stdout}`);
  assert.match(output, expectedMessage,
    `${applicationName} failed for an unexpected reason: ${output}`);
  return output;
}

async function scalar(databaseUrl, sql, applicationName) {
  const output = await runPsql(databaseUrl, sql, applicationName);
  const rows = output.split('\n').map((row) => row.trim()).filter(Boolean);
  assert.equal(rows.length, 1, `${applicationName} expected one row: ${output}`);
  return rows[0];
}

async function jsonValue(databaseUrl, sql, applicationName) {
  return JSON.parse(await scalar(databaseUrl, sql, applicationName));
}

async function preflightIsSafe(databaseUrl, applicationName) {
  const output = await runPsql(databaseUrl, preflightSql, applicationName);
  const rows = output.split('\n').map((row) => row.trim()).filter(Boolean);
  assert.equal(rows.length, 1, `${applicationName} expected one diagnostic row: ${output}`);
  return rows[0].split('|').at(-1) === 't';
}

async function assertFailedInstallClean(databaseUrl, applicationName) {
  const clean = await jsonValue(databaseUrl, `
    select json_build_object(
      'admin_reviews_absent',
        to_regclass('public.hotel_partner_property_proposal_admin_reviews') is null,
      'transaction_context_absent',
        to_regclass('public.hotel_partner_property_proposal_admin_transaction_context') is null,
      'foundation_absent',
        to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
    )::text;
  `, applicationName);
  assert.deepEqual(clean, {
    admin_reviews_absent: true,
    transaction_context_absent: true,
    foundation_absent: true,
  });
}

async function expectFoundationRejection(databaseUrl, caseName) {
  assert.equal(await preflightIsSafe(databaseUrl, `hotels_v2_114370_${caseName}_preflight`),
    false, `${caseName} preflight unexpectedly passed`);
  await runPsqlExpectFailure(databaseUrl, migrationSql,
    `hotels_v2_114370_${caseName}_migration`,
    /hotels_v2_seven_arches_property_proposal_foundation_mismatch/);
  await assertFailedInstallClean(databaseUrl, `hotels_v2_114370_${caseName}_rollback`);
  return { preflightSafe: false, migrationRejected: true, partialStateAbsent: true };
}

async function assertFixtureReady() {
  const ready = await jsonValue(fixtureUrl, `
    with mismatch_keys as(
      select coalesce(array_agg(current_entry.key order by current_entry.key),'{}'::text[]) value
      from jsonb_each(public.hotel_v2_h3_2b_protected_fingerprints()) current_entry
      cross join public.hotel_partner_workspace_foundation_receipts historical
      where historical.id=1
        and current_entry.value is distinct from historical.protected_fingerprints->current_entry.key
    )
    select json_build_object(
      'owner_evolution_count',(select count(*)
        from public.hotel_admin_availability_foundation_evolution_receipts),
      'task2_absent',to_regclass(
        'public.hotel_partner_property_proposal_foundation_receipts') is null,
      'current_foundation_safe',coalesce((
        public.hotel_v2_admin_d_current_foundation_snapshot()->>'safe')::boolean,false),
      'historical_h3_self_hash_exact',exists(select 1
        from public.hotel_partner_workspace_foundation_receipts receipt
        where receipt.id=1 and receipt.protected_fingerprint=
          public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints)),
      'external_sync_enabled',(select hotel_external_sync_enabled
        from public.site_settings where id=1),
      'live_drift_present',cardinality((select value from mismatch_keys))>0,
      'mismatch_keys',(select value from mismatch_keys),
      'owner_receipt_fingerprint',(select public.hotel_v2_h3_2b_hash(jsonb_set(
        to_jsonb(receipt),'{created_at}',to_jsonb(extract(epoch from receipt.created_at)),false))
        from public.hotel_admin_availability_foundation_evolution_receipts receipt where id=1)
    )::text;
  `, 'hotels_v2_114370_fixture_guard');
  assert.equal(ready.owner_evolution_count, 1);
  assert.equal(ready.task2_absent, true);
  assert.equal(ready.current_foundation_safe, true);
  assert.equal(ready.historical_h3_self_hash_exact, true);
  assert.equal(ready.external_sync_enabled, true);
  assert.equal(ready.live_drift_present, true);
  for (const key of [
    'affiliate_commission_events',
    'hotels',
    'partner_service_fulfillment_form_snapshots',
    'partner_service_fulfillments',
    'partner_users',
    'partners',
    'profile_referral_code_aliases',
    'referrals',
  ]) {
    assert.ok(ready.mismatch_keys.includes(key),
      `Task2 production-style fixture is missing live drift key ${key}`);
  }
  assert.match(ready.owner_receipt_fingerprint, /^[0-9a-f]{64}$/);
  return ready;
}

async function cloneCaseDatabases() {
  for (const databaseName of caseDatabases.values()) {
    await runPsql(adminUrl, `create database ${quoteIdentifier(databaseName)}
      with template ${quoteIdentifier(templateDatabase)};`,
    'hotels_v2_114370_clone');
    createdDatabases.push(databaseName);
  }
}

async function cleanup() {
  for (const databaseName of [...createdDatabases].reverse()) {
    try {
      await runPsql(adminUrl, `drop database if exists ${quoteIdentifier(databaseName)}
        with (force);`, 'hotels_v2_114370_cleanup');
    } catch (error) {
      process.stderr.write(`cleanup warning for ${databaseName}: ${error.message}\n`);
    }
  }
}

function caseUrl(caseName) {
  return withDatabase(fixtureUrl, caseDatabases.get(caseName));
}

async function productionCase(expectedOwnerReceiptFingerprint) {
  const databaseUrl = caseUrl('production');
  assert.equal(await preflightIsSafe(databaseUrl, 'hotels_v2_114370_production_preflight'), true);
  await runPsql(databaseUrl, migrationSql, 'hotels_v2_114370_production_migration');
  const proof = await jsonValue(databaseUrl, `
    select json_build_object(
      'foundation_count',(select count(*)
        from public.hotel_partner_property_proposal_foundation_receipts),
      'historical_lineage_exact',exists(select 1
        from public.hotel_partner_property_proposal_foundation_receipts task2
        join public.hotel_partner_workspace_foundation_receipts historical
          on historical.id=task2.id
        where task2.id=1
          and task2.original_h3_2b_foundation_fingerprint=historical.protected_fingerprint
          and historical.protected_fingerprint=
            public.hotel_v2_h3_2b_hash(historical.protected_fingerprints)),
      'owner_anchor_exact',exists(select 1
        from public.hotel_partner_property_proposal_foundation_receipts task2
        join public.hotel_admin_availability_foundation_evolution_receipts owner_evolution
          on owner_evolution.id=task2.owner_evolution_receipt_id
        where task2.id=1 and task2.owner_evolution_receipt_fingerprint=
          public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(owner_evolution),'{created_at}',
            to_jsonb(extract(epoch from owner_evolution.created_at)),false))),
      'owner_receipt_unchanged',(select public.hotel_v2_h3_2b_hash(jsonb_set(
          to_jsonb(owner_evolution),'{created_at}',
          to_jsonb(extract(epoch from owner_evolution.created_at)),false))
        from public.hotel_admin_availability_foundation_evolution_receipts owner_evolution
        where owner_evolution.id=1)=${quoteLiteral(expectedOwnerReceiptFingerprint)},
      'current_baseline_exact',exists(select 1
        from public.hotel_partner_property_proposal_foundation_receipts task2
        where task2.id=1
          and task2.protected_fingerprint=public.hotel_v2_h3_2b_hash(task2.protected_fingerprints)
          and task2.protected_fingerprints is not distinct from
            public.hotel_v2_seven_arches_property_proposal_protected_fingerprints())
    )::text;
  `, 'hotels_v2_114370_production_proof');
  assert.deepEqual(proof, {
    foundation_count: 1,
    historical_lineage_exact: true,
    owner_anchor_exact: true,
    owner_receipt_unchanged: true,
    current_baseline_exact: true,
  });
  return { preflightSafe: true, migrationInstalled: true, ...proof };
}

async function postBaselineDriftCase() {
  const databaseUrl = caseUrl('post_drift');
  await runPsql(databaseUrl, `
    update public.partners
    set name=name||' post-114360 unauthorized drift'
    where id='20000000-0000-4000-8000-000000000002'::uuid;
  `, 'hotels_v2_114370_post_drift_mutation');
  const state = await jsonValue(databaseUrl, `
    select public.hotel_v2_admin_d_current_foundation_snapshot()::text;
  `, 'hotels_v2_114370_post_drift_state');
  assert.equal(state.safe, false);
  assert.equal(state.current_matches_latest, false);
  return { ...await expectFoundationRejection(databaseUrl, 'post_drift'),
    currentMatchesLatest: false };
}

async function ownerReceiptCorruptionCase() {
  const databaseUrl = caseUrl('owner_receipt');
  await runPsql(databaseUrl, `
    begin;
    alter table public.hotel_admin_availability_foundation_evolution_receipts
      disable trigger hotel_admin_availability_foundation_evolution_immutable;
    update public.hotel_admin_availability_foundation_evolution_receipts
    set stage2_current_protected_fingerprint=repeat('0',64) where id=1;
    alter table public.hotel_admin_availability_foundation_evolution_receipts
      enable trigger hotel_admin_availability_foundation_evolution_immutable;
    commit;
  `, 'hotels_v2_114370_owner_receipt_corruption');
  return expectFoundationRejection(databaseUrl, 'owner_receipt');
}

async function historicalReceiptCorruptionCase() {
  const databaseUrl = caseUrl('h3_receipt');
  await runPsql(databaseUrl, `
    begin;
    alter table public.hotel_partner_workspace_foundation_receipts
      disable trigger hotel_partner_workspace_foundation_receipts_immutable;
    update public.hotel_partner_workspace_foundation_receipts
    set protected_fingerprint=repeat('0',64) where id=1;
    alter table public.hotel_partner_workspace_foundation_receipts
      enable trigger hotel_partner_workspace_foundation_receipts_immutable;
    commit;
  `, 'hotels_v2_114370_h3_receipt_corruption');
  return expectFoundationRejection(databaseUrl, 'h3_receipt');
}

async function unsafeFoundationCase() {
  const databaseUrl = caseUrl('unsafe');
  await runPsql(databaseUrl, `
    update public.site_settings set hotel_rooms_v2_enabled=true where id=1;
  `, 'hotels_v2_114370_unsafe_foundation_mutation');
  const state = await jsonValue(databaseUrl, `
    select public.hotel_v2_admin_d_current_foundation_snapshot()::text;
  `, 'hotels_v2_114370_unsafe_foundation_state');
  assert.equal(state.safe, false);
  assert.equal(state.supported_hotel_flags, false);
  return { ...await expectFoundationRejection(databaseUrl, 'unsafe'),
    supportedHotelFlags: false };
}

async function existingBoundaryCase() {
  const databaseUrl = caseUrl('boundary');
  await runPsql(databaseUrl, `
    create table public.hotel_partner_property_proposal_foundation_receipts(id smallint);
  `, 'hotels_v2_114370_existing_boundary_setup');
  assert.equal(await preflightIsSafe(databaseUrl, 'hotels_v2_114370_boundary_preflight'), false);
  await runPsqlExpectFailure(databaseUrl, migrationSql,
    'hotels_v2_114370_boundary_migration',
    /hotels_v2_seven_arches_property_proposal_review_boundary_mismatch/);
  const otherObjectsAbsent = await jsonValue(databaseUrl, `
    select json_build_object(
      'admin_reviews_absent',
        to_regclass('public.hotel_partner_property_proposal_admin_reviews') is null,
      'transaction_context_absent',
        to_regclass('public.hotel_partner_property_proposal_admin_transaction_context') is null
    )::text;
  `, 'hotels_v2_114370_boundary_rollback');
  assert.deepEqual(otherObjectsAbsent,
    { admin_reviews_absent: true, transaction_context_absent: true });
  return { preflightSafe: false, migrationRejected: true, partialStateAbsent: true };
}

let results;
try {
  const fixture = await assertFixtureReady();
  await cloneCaseDatabases();
  results = {
    production: await productionCase(fixture.owner_receipt_fingerprint),
    postBaselineDrift: await postBaselineDriftCase(),
    ownerReceiptCorruption: await ownerReceiptCorruptionCase(),
    historicalH3ReceiptCorruption: await historicalReceiptCorruptionCase(),
    currentFoundationUnsafe: await unsafeFoundationCase(),
    existingTask2Boundary: await existingBoundaryCase(),
  };
} finally {
  await cleanup();
}

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_SEVEN_ARCHES_PROPERTY_PROPOSAL_FOUNDATION_COMPATIBILITY_GATE_PASS',
  fixture: 'post-114360 production-style live drift with external sync already enabled',
  results,
}));
