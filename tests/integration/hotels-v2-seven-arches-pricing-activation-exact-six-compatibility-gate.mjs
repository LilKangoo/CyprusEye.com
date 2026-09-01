import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_URL_ENV = 'HOTELS_V2_TASK3_COMPATIBILITY_DATABASE_URL';
const DISPOSABLE_ACK_ENV = 'HOTELS_V2_TASK3_COMPATIBILITY_DISPOSABLE';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const fixtureUrlText = process.env[FIXTURE_URL_ENV];

assert.ok(fixtureUrlText, `${FIXTURE_URL_ENV} is required`);
assert.equal(process.env[DISPOSABLE_ACK_ENV], '1',
  `${DISPOSABLE_ACK_ENV}=1 is required for disposable database cloning`);

const fixtureUrl = new URL(fixtureUrlText);
assert.ok(['postgres:', 'postgresql:'].includes(fixtureUrl.protocol));
assert.ok(LOOPBACK_HOSTS.has(fixtureUrl.hostname),
  'Task3 compatibility fixture must be loopback-only');

const templateDatabase = decodeURIComponent(fixtureUrl.pathname.replace(/^\//, ''));
assert.ok(templateDatabase && !['postgres', 'template0', 'template1'].includes(templateDatabase));

const psqlBin = process.env.HOTELS_V2_TASK3_COMPATIBILITY_PSQL || 'psql';
const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(integrationDir, '..', '..');
const migrationSql = await readFile(resolve(repoRoot, 'supabase', 'migrations',
  '20260811440000_hotels_v2_seven_arches_pricing_activation.sql'), 'utf8');
const preflightSql = await readFile(resolve(repoRoot, 'supabase', 'manual',
  'hotels_v2_seven_arches_pricing_activation_preflight.sql'), 'utf8');

const EXPECTED_KEYS = [
  'partner_service_fulfillment_form_snapshots',
  'partner_service_fulfillments',
  'profile_referral_code_aliases',
  'referrals',
  'service_deposit_requests',
  'site_settings',
];
const runSuffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const caseNames = [
  'positive', 'seventh', 'unsupported', 'historical', 'missing_114370',
  'missing_114360', 'source_pin',
];
const caseDatabases = new Map(caseNames.map((name) =>
  [name, `hotels_v2_114400_exact_six_${runSuffix}_${name}`]));
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
  child.stdin.on('error', (error) => {
    if (error.code !== 'EPIPE') throw error;
  });
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
  child.stdin.on('error', (error) => {
    if (error.code !== 'EPIPE') throw error;
  });
  child.stdin.end(`${sql.trim()}\n`);
  const { code } = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', (exitCode, signal) => resolveExit({ code: exitCode, signal }));
  });
  assert.notEqual(code, 0, `${applicationName} unexpectedly passed`);
  const output = conciseError(stderr, stdout);
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

function exactSixSql(excludedKey = null) {
  const statements = new Map([
    ['partner_service_fulfillment_form_snapshots', `
      update public.partner_service_fulfillment_form_snapshots
      set snapshot=snapshot||'{"task3_exact_six":true}'::jsonb
      where id='36000000-0000-4000-8000-000000000106'::uuid;`],
    ['partner_service_fulfillments', `
      update public.partner_service_fulfillments
      set status='accepted'
      where id='36000000-0000-4000-8000-000000000104'::uuid;`],
    ['profile_referral_code_aliases', `
      update public.profile_referral_code_aliases
      set reason='Task3 exact-six compatibility drift'
      where id='36000000-0000-4000-8000-000000000108'::uuid;`],
    ['referrals', `
      do $exact_six_referral_transition$ begin
        if exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='referrals'
            and column_name='confirmed_at') then
          execute $sql$update public.referrals
            set status='confirmed',confirmed_at='2026-08-31T18:00:00Z'::timestamptz
            where id='36000000-0000-4000-8000-000000000107'$sql$;
        else
          update public.referrals set status='confirmed'
          where id='36000000-0000-4000-8000-000000000107'::uuid;
        end if;
      end $exact_six_referral_transition$;`],
    ['service_deposit_requests', `
      update public.service_deposit_requests
      set resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      where id='36000000-0000-4000-8000-000000000109'::uuid;`],
    ['site_settings', `
      update public.site_settings set force_refresh_version=80,
        updated_at='2026-08-31T18:00:00Z'::timestamptz,
        updated_by='36000000-0000-4000-8000-000000000101'::uuid where id=1;`],
  ]);
  return [...statements].filter(([key]) => key !== excludedKey)
    .map(([, sql]) => sql).join('\n');
}

async function changedKeys(databaseUrl, applicationName) {
  return jsonValue(databaseUrl, `
    with states as(
      select foundation.protected_fingerprints before_task2,
        public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() after_task2,
        owner.stage2_current_protected_fingerprints before_stage2,
        public.hotel_v2_external_calendar_stage2_compatible_fingerprints() after_stage2
      from public.hotel_partner_property_proposal_foundation_receipts foundation
      cross join public.hotel_admin_availability_foundation_evolution_receipts owner
      where foundation.id=1 and owner.id=1
    ), task2_keys as(
      select coalesce(jsonb_agg(key order by key collate "C"),'[]'::jsonb) value from states
      cross join lateral jsonb_object_keys(before_task2||after_task2) key
      where before_task2->key is distinct from after_task2->key
    ), stage2_keys as(
      select coalesce(jsonb_agg(key order by key collate "C"),'[]'::jsonb) value from states
      cross join lateral jsonb_object_keys(before_stage2||after_stage2) key
      where before_stage2->key is distinct from after_stage2->key
    )
    select jsonb_build_object('task2',(select value from task2_keys),
      'stage2',(select value from stage2_keys))::text;
  `, applicationName);
}

async function installExactSix(databaseUrl, applicationName) {
  await runPsql(databaseUrl, exactSixSql(), `${applicationName}_drift`);
  const keys = await changedKeys(databaseUrl, `${applicationName}_keys`);
  assert.deepEqual(keys, { task2: EXPECTED_KEYS, stage2: EXPECTED_KEYS });
  return keys;
}

async function assertFailedInstallClean(databaseUrl, applicationName) {
  const state = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'reviews_absent',to_regclass('public.hotel_seven_arches_pricing_activation_reviews') is null,
      'activation_receipts_absent',to_regclass(
        'public.hotel_seven_arches_pricing_activation_evolution_receipts') is null,
      'compatibility_receipts_absent',to_regclass(
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts') is null
    )::text;
  `, applicationName);
  assert.deepEqual(state, {
    reviews_absent: true,
    activation_receipts_absent: true,
    compatibility_receipts_absent: true,
  });
}

async function expectRejected(databaseUrl, caseName, preflightMessage, migrationMessage) {
  await runPsqlExpectFailure(databaseUrl, preflightSql, `${caseName}_preflight`,
    preflightMessage);
  await runPsqlExpectFailure(databaseUrl, migrationSql, `${caseName}_migration`,
    migrationMessage);
  await assertFailedInstallClean(databaseUrl, `${caseName}_rollback`);
  return { preflightRejected: true, migrationRejected: true, partialStateAbsent: true };
}

async function positiveCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('positive'));
  const keys = await installExactSix(databaseUrl, 'hotels_v2_114400_exact_six_positive');
  await runPsql(databaseUrl, preflightSql, 'hotels_v2_114400_exact_six_preflight');
  await runPsql(databaseUrl, migrationSql, 'hotels_v2_114400_exact_six_migration');
  const proof = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'compatibility_receipt_count',(select count(*)
        from public.hotel_seven_arches_task2_stage2_compatibility_receipts),
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
      'activation_receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'transaction_context_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_transaction_context)
    )::text;
  `, 'hotels_v2_114400_exact_six_proof');
  assert.deepEqual(proof, {
    compatibility_receipt_count: 1,
    compatibility_exact: true,
    activation_receipt_count: 0,
    transaction_context_count: 0,
  });
  return { changedKeys: keys, ...proof };
}

async function seventhKeyCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('seventh'));
  await installExactSix(databaseUrl, 'hotels_v2_114400_seventh');
  await runPsql(databaseUrl, `update public.partners set name=name||' unexplained seventh drift'
    where id='20000000-0000-4000-8000-000000000002'::uuid;`,
  'hotels_v2_114400_seventh_mutation');
  return expectRejected(databaseUrl, 'hotels_v2_114400_seventh',
    /PREFLIGHT_FAIL: Task2 protected state drift/,
    /hotels_v2_seven_arches_pricing_activation_task2_foundation_drift/);
}

async function unsupportedFlagCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('unsupported'));
  await installExactSix(databaseUrl, 'hotels_v2_114400_unsupported');
  await runPsql(databaseUrl,
    'update public.site_settings set hotel_rooms_v2_enabled=true where id=1;',
    'hotels_v2_114400_unsupported_mutation');
  return expectRejected(databaseUrl, 'hotels_v2_114400_unsupported',
    /PREFLIGHT_FAIL: flags\/legacy authority drift/,
    /hotels_v2_seven_arches_pricing_activation_stage2_foundation_drift/);
}

async function historicalReceiptCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('historical'));
  await installExactSix(databaseUrl, 'hotels_v2_114400_historical');
  await runPsql(databaseUrl, `
    alter table public.hotel_partner_workspace_foundation_receipts
      disable trigger hotel_partner_workspace_foundation_receipts_immutable;
    update public.hotel_partner_workspace_foundation_receipts
    set protected_fingerprint=repeat('0',64) where id=1;
  `, 'hotels_v2_114400_historical_corruption');
  return expectRejected(databaseUrl, 'hotels_v2_114400_historical',
    /PREFLIGHT_FAIL: Stage2 protected state drift/,
    /hotels_v2_seven_arches_pricing_activation_stage2_foundation_drift/);
}

async function missingReceiptCase(caseName, receiptStage) {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get(caseName));
  await installExactSix(databaseUrl, `hotels_v2_114400_${caseName}`);
  if (receiptStage === '114370') await runPsql(databaseUrl, `
    alter table public.hotel_partner_property_proposal_foundation_receipts
      disable trigger hotel_partner_property_proposal_foundation_receipts_immutable;
    delete from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  `, `hotels_v2_114400_${caseName}_mutation`);
  else await runPsql(databaseUrl, `
    alter table public.hotel_admin_availability_foundation_evolution_receipts
      disable trigger all;
    delete from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  `, `hotels_v2_114400_${caseName}_mutation`);
  return expectRejected(databaseUrl, `hotels_v2_114400_${caseName}`,
    /query returned no rows|PREFLIGHT_FAIL: Task2\/H3\.1P dependency missing/,
    /query returned no rows|hotels_v2_seven_arches_pricing_activation_dependency_missing/);
}

async function sourcePinCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('source_pin'));
  await installExactSix(databaseUrl, 'hotels_v2_114400_source_pin');
  await runPsql(databaseUrl, `
    create or replace function public.hotel_v2_partner_workspace_function_lineage_is_exact()
    returns boolean language sql stable security definer
    set search_path=pg_catalog,public as $function$ select false $function$;
  `, 'hotels_v2_114400_source_pin_mutation');
  return expectRejected(databaseUrl, 'hotels_v2_114400_source_pin',
    /PREFLIGHT_FAIL: Stage2 protected state drift/,
    /hotels_v2_seven_arches_pricing_activation_stage2_foundation_drift/);
}

async function assertFixtureReady() {
  const ready = await jsonValue(fixtureUrl, `
    select jsonb_build_object(
      'task2_receipt_count',(select count(*)
        from public.hotel_partner_property_proposal_foundation_receipts),
      'owner_receipt_count',(select count(*)
        from public.hotel_admin_availability_foundation_evolution_receipts),
      'activation_absent',to_regclass(
        'public.hotel_seven_arches_pricing_activation_evolution_receipts') is null,
      'fixture_rows',
        (select count(*) from public.partner_service_fulfillments
          where id='36000000-0000-4000-8000-000000000104'::uuid)+
        (select count(*) from public.partner_service_fulfillment_form_snapshots
          where id='36000000-0000-4000-8000-000000000106'::uuid)+
        (select count(*) from public.profile_referral_code_aliases
          where id='36000000-0000-4000-8000-000000000108'::uuid)+
        (select count(*) from public.referrals
          where id='36000000-0000-4000-8000-000000000107'::uuid)+
        (select count(*) from public.service_deposit_requests
          where id='36000000-0000-4000-8000-000000000109'::uuid)
    )::text;
  `, 'hotels_v2_114400_exact_six_fixture_guard');
  assert.deepEqual(ready, {
    task2_receipt_count: 1,
    owner_receipt_count: 1,
    activation_absent: true,
    fixture_rows: 5,
  });
}

async function cloneCaseDatabases() {
  for (const databaseName of caseDatabases.values()) {
    await runPsql(adminUrl, `create database ${quoteIdentifier(databaseName)}
      with template ${quoteIdentifier(templateDatabase)};`, 'hotels_v2_114400_exact_six_clone');
    createdDatabases.push(databaseName);
  }
}

async function cleanup() {
  for (const databaseName of [...createdDatabases].reverse()) {
    try {
      await runPsql(adminUrl, `drop database if exists ${quoteIdentifier(databaseName)}
        with (force);`, 'hotels_v2_114400_exact_six_cleanup');
    } catch (error) {
      process.stderr.write(`cleanup warning for ${databaseName}: ${error.message}\n`);
    }
  }
}

let results;
try {
  await assertFixtureReady();
  await cloneCaseDatabases();
  results = {
    exactSixPositive: await positiveCase(),
    unexplainedSeventhKey: await seventhKeyCase(),
    unsupportedHotelsFlag: await unsupportedFlagCase(),
    historicalReceiptCorruption: await historicalReceiptCase(),
    missing114370Receipt: await missingReceiptCase('missing_114370', '114370'),
    missing114360Receipt: await missingReceiptCase('missing_114360', '114360'),
    sourcePinDrift: await sourcePinCase(),
  };
} finally {
  await cleanup();
}

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_COMPATIBILITY_GATE_PASS',
  expectedChangedKeys: EXPECTED_KEYS,
  results,
}));
