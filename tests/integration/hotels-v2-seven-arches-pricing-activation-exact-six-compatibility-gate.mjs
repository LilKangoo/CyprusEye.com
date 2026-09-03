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
  'Task3 live-baseline compatibility fixture must be loopback-only');
const templateDatabase = decodeURIComponent(fixtureUrl.pathname.replace(/^\//, ''));
assert.ok(templateDatabase && !['postgres', 'template0', 'template1'].includes(templateDatabase));

const psqlBin = process.env.HOTELS_V2_TASK3_COMPATIBILITY_PSQL || 'psql';
const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(integrationDir, '..', '..');
const migrationSql = await readFile(resolve(repoRoot, 'supabase', 'migrations',
  '20260811440000_hotels_v2_seven_arches_pricing_activation.sql'), 'utf8');
const preflightSql = await readFile(resolve(repoRoot, 'supabase', 'manual',
  'hotels_v2_seven_arches_pricing_activation_preflight.sql'), 'utf8');

const SCOPED_CONTRACT = 'hotels_v2_seven_arches_pricing_scoped_lineage_v1';
const SCOPED_KEYS = [
  'allocation_contract_exact',
  'commission_policy_fingerprint',
  'contract_version',
  'hotel_id',
  'lower_function_security_fingerprint',
  'owner_capability_receipt_fingerprint',
  'owner_membership_fingerprint',
  'owner_user_ids',
  'parity_case_count',
  'parity_fingerprint',
  'parity_mismatch_count',
  'partner_id',
  'payment_policy_fingerprint',
  'permission_preset_fingerprint',
  'pricing_identity_fingerprint',
  'property_business_fingerprint',
  'property_foundation_receipt_fingerprint',
  'room_identity_fingerprint',
  'site_settings_lifecycle',
  'site_settings_lifecycle_fingerprint',
  'assignment_id',
].sort();
const runSuffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const caseNames = [
  'positive', 'repeated_live', 'critical_property', 'unsupported', 'historical',
  'missing_114370', 'missing_114360', 'source_pin',
];
const caseDatabases = new Map(caseNames.map((name) =>
  [name, `hotels_v2_114400_live_baseline_${runSuffix}_${name}`]));
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

function liveEvolutionSql(phase) {
  assert.ok([1, 2].includes(phase));
  if (phase === 1) return `
    update public.partner_service_fulfillment_form_snapshots
    set snapshot=snapshot||'{"task3_live_baseline_phase":1}'::jsonb
    where id='36000000-0000-4000-8000-000000000106'::uuid;
    update public.partner_service_fulfillments set status='accepted'
    where id='36000000-0000-4000-8000-000000000104'::uuid;
    update public.profile_referral_code_aliases
    set reason='Task3 live-baseline compatibility'
    where id='36000000-0000-4000-8000-000000000108'::uuid;
    update public.referrals set status='confirmed'
    where id='36000000-0000-4000-8000-000000000107'::uuid;
    update public.service_deposit_requests
    set resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    where id='36000000-0000-4000-8000-000000000109'::uuid;
    insert into public.service_deposit_requests(id,resource_type,resource_id,created_at)
    values('36000000-0000-4000-8000-000000000113','hotels',
      'c1000000-0000-4000-8000-000000000001','2026-08-31T18:01:00Z');
    insert into public.affiliate_commission_events(
      id,partner_id,deposit_request_id,level,referrer_user_id,referred_user_id,
      resource_type,booking_id,fulfillment_id,deposit_paid_at,deposit_amount,
      commission_bps,commission_amount,currency,created_at
    ) values(
      '36000000-0000-4000-8000-000000000114',
      '20000000-0000-4000-8000-000000000002',
      '36000000-0000-4000-8000-000000000113',1,
      '36000000-0000-4000-8000-000000000101',
      '36000000-0000-4000-8000-000000000102','hotels',
      '36000000-0000-4000-8000-000000000105',
      '36000000-0000-4000-8000-000000000104','2026-08-31T18:01:00Z',
      120,550,6.60,'EUR','2026-08-31T18:01:00Z');
    insert into public.profile_referral_code_aliases(
      id,user_id,referral_code,referral_code_normalized,created_at,created_by,reason
    ) values(
      '36000000-0000-4000-8000-000000000115',
      '36000000-0000-4000-8000-000000000101','LIVEDRIFT2','livedrift2',
      '2026-08-31T18:02:00Z','36000000-0000-4000-8000-000000000101',
      'Disposable live-baseline fixture');
    update public.site_settings set
      car_multi_city_mapped_enabled=not car_multi_city_mapped_enabled,
      car_threshold_daily_rates_enabled=not car_threshold_daily_rates_enabled,
      force_refresh_version=81,updated_at='2026-08-31T18:02:00Z'::timestamptz,
      updated_by='36000000-0000-4000-8000-000000000101'::uuid where id=1;
  `;
  return `
    update public.partner_service_fulfillment_form_snapshots
    set snapshot=snapshot||'{"task3_live_baseline_phase":2}'::jsonb
    where id='36000000-0000-4000-8000-000000000106'::uuid;
    insert into public.partner_service_fulfillments(
      id,resource_type,booking_id,resource_id,partner_id,status
    ) values(
      '36000000-0000-4000-8000-000000000119','hotels',
      '36000000-0000-4000-8000-000000000121',
      'c1000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002','accepted');
    insert into public.partner_service_fulfillment_form_snapshots(
      id,fulfillment_id,snapshot,created_at
    ) values(
      '36000000-0000-4000-8000-000000000120',
      '36000000-0000-4000-8000-000000000119',
      '{"fixture":"subsequent_live_evolution"}'::jsonb,
      '2026-08-31T18:03:00Z');
    insert into public.service_deposit_requests(id,resource_type,resource_id,created_at)
    values('36000000-0000-4000-8000-000000000116','hotels',
      'c1000000-0000-4000-8000-000000000001','2026-08-31T18:03:00Z');
    insert into public.affiliate_commission_events(
      id,partner_id,deposit_request_id,level,referrer_user_id,referred_user_id,
      resource_type,booking_id,fulfillment_id,deposit_paid_at,deposit_amount,
      commission_bps,commission_amount,currency,created_at
    ) values(
      '36000000-0000-4000-8000-000000000117',
      '20000000-0000-4000-8000-000000000002',
      '36000000-0000-4000-8000-000000000116',1,
      '36000000-0000-4000-8000-000000000101',
      '36000000-0000-4000-8000-000000000102','hotels',
      '36000000-0000-4000-8000-000000000121',
      '36000000-0000-4000-8000-000000000119','2026-08-31T18:03:00Z',
      140,550,7.70,'EUR','2026-08-31T18:03:00Z');
    insert into public.profile_referral_code_aliases(
      id,user_id,referral_code,referral_code_normalized,created_at,created_by,reason
    ) values(
      '36000000-0000-4000-8000-000000000118',
      '36000000-0000-4000-8000-000000000101','LIVEDRIFT3','livedrift3',
      '2026-08-31T18:04:00Z','36000000-0000-4000-8000-000000000101',
      'Disposable subsequent live evolution');
    update public.site_settings set force_refresh_version=force_refresh_version+1,
      updated_at='2026-08-31T18:04:00Z'::timestamptz,
      updated_by='36000000-0000-4000-8000-000000000102'::uuid where id=1;
  `;
}

async function broadState(databaseUrl, applicationName) {
  return jsonValue(databaseUrl, `
    select jsonb_build_object(
      'task2',public.hotel_v2_seven_arches_property_proposal_protected_fingerprints(),
      'stage2',public.hotel_v2_external_calendar_stage2_compatible_fingerprints(),
      'affiliate_count',(select count(*) from public.affiliate_commission_events)
    )::text;
  `, applicationName);
}

async function scopedLineage(databaseUrl, applicationName) {
  const value = await jsonValue(databaseUrl, `
    select public.hotel_v2_seven_arches_pricing_scoped_lineage()::text;
  `, applicationName);
  assert.equal(value.contract_version, SCOPED_CONTRACT);
  assert.deepEqual(Object.keys(value).sort(), SCOPED_KEYS);
  assert.equal(value.hotel_id, '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  assert.equal(value.parity_case_count, 70);
  assert.equal(value.parity_mismatch_count, 0);
  assert.equal(value.allocation_contract_exact, true);
  return value;
}

async function installLiveEvolution(databaseUrl, applicationName) {
  const before = await broadState(databaseUrl, `${applicationName}_before`);
  await runPsql(databaseUrl, liveEvolutionSql(1), `${applicationName}_activity`);
  const after = await broadState(databaseUrl, `${applicationName}_after`);
  assert.notDeepEqual(after.task2, before.task2);
  assert.notDeepEqual(after.stage2, before.stage2);
  assert.notEqual(after.task2.affiliate_commission_events,
    before.task2.affiliate_commission_events);
  assert.notEqual(after.stage2.affiliate_commission_events,
    before.stage2.affiliate_commission_events);
  assert.equal(after.affiliate_count, before.affiliate_count + 1);
  return { beforeAffiliateCount: before.affiliate_count, afterAffiliateCount: after.affiliate_count };
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
  const activity = await installLiveEvolution(databaseUrl, 'hotels_v2_114400_live_positive');
  await runPsql(databaseUrl, preflightSql, 'hotels_v2_114400_live_preflight');
  await runPsql(databaseUrl, migrationSql, 'hotels_v2_114400_live_migration');
  const lineage = await scopedLineage(databaseUrl, 'hotels_v2_114400_live_lineage');
  const proof = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'compatibility_receipt_count',(select count(*)
        from public.hotel_seven_arches_task2_stage2_compatibility_receipts),
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
      'current_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
      'activation_receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'transaction_context_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_transaction_context)
    )::text;
  `, 'hotels_v2_114400_live_proof');
  assert.deepEqual(proof, {
    compatibility_receipt_count: 1,
    compatibility_exact: true,
    current_safe: true,
    activation_receipt_count: 0,
    transaction_context_count: 0,
  });
  return { activity, scopedContract: lineage.contract_version, ...proof };
}

async function repeatedLiveEvolutionCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('repeated_live'));
  await installLiveEvolution(databaseUrl, 'hotels_v2_114400_repeated_live');
  await runPsql(databaseUrl, preflightSql, 'hotels_v2_114400_repeated_preflight');
  await runPsql(databaseUrl, migrationSql, 'hotels_v2_114400_repeated_migration');
  const lineageBefore = await scopedLineage(databaseUrl,
    'hotels_v2_114400_repeated_lineage_before');
  const broadBefore = await broadState(databaseUrl, 'hotels_v2_114400_repeated_broad_before');
  await runPsql(databaseUrl, liveEvolutionSql(2), 'hotels_v2_114400_repeated_activity');
  const broadAfter = await broadState(databaseUrl, 'hotels_v2_114400_repeated_broad_after');
  const lineageAfter = await scopedLineage(databaseUrl,
    'hotels_v2_114400_repeated_lineage_after');
  assert.notDeepEqual(broadAfter.task2, broadBefore.task2);
  assert.notDeepEqual(broadAfter.stage2, broadBefore.stage2);
  assert.equal(broadAfter.affiliate_count, broadBefore.affiliate_count + 1);
  assert.deepEqual(lineageAfter, lineageBefore);
  const safe = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
      'current_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe())::text;
  `, 'hotels_v2_114400_repeated_safe');
  assert.deepEqual(safe, { compatibility_exact: true, current_safe: true });
  return { broadMapsAdvanced: true, scopedLineageStable: true, ...safe };
}

async function criticalPropertyCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('critical_property'));
  await installLiveEvolution(databaseUrl, 'hotels_v2_114400_critical_property');
  await runPsql(databaseUrl, `
    update public.hotels
    set description_i18n='{"en":"Unreviewed critical mutation"}'::jsonb
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  `, 'hotels_v2_114400_critical_property_mutation');
  return expectRejected(databaseUrl, 'hotels_v2_114400_critical_property',
    /PREFLIGHT_FAIL:.*(?:Property|scoped|lineage|protected state)/i,
    /hotels_v2_seven_arches_pricing_activation_.*(?:drift|lineage|foundation)/i);
}

async function unsupportedFlagCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('unsupported'));
  await installLiveEvolution(databaseUrl, 'hotels_v2_114400_unsupported');
  await runPsql(databaseUrl,
    'update public.site_settings set hotel_rooms_v2_enabled=true where id=1;',
    'hotels_v2_114400_unsupported_mutation');
  return expectRejected(databaseUrl, 'hotels_v2_114400_unsupported',
    /PREFLIGHT_FAIL:.*(?:flags|scoped|lineage)/i,
    /hotels_v2_seven_arches_pricing_activation_.*(?:drift|lineage|foundation)/i);
}

async function historicalReceiptCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('historical'));
  await installLiveEvolution(databaseUrl, 'hotels_v2_114400_historical');
  await runPsql(databaseUrl, `
    alter table public.hotel_partner_workspace_foundation_receipts
      disable trigger hotel_partner_workspace_foundation_receipts_immutable;
    update public.hotel_partner_workspace_foundation_receipts
    set protected_fingerprint=repeat('0',64) where id=1;
  `, 'hotels_v2_114400_historical_corruption');
  return expectRejected(databaseUrl, 'hotels_v2_114400_historical',
    /PREFLIGHT_FAIL:.*(?:receipt|Stage2|lineage|protected state)/i,
    /hotels_v2_seven_arches_pricing_activation_.*(?:drift|lineage|foundation)/i);
}

async function missingReceiptCase(caseName, receiptStage) {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get(caseName));
  await installLiveEvolution(databaseUrl, `hotels_v2_114400_${caseName}`);
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
    /query returned no rows|PREFLIGHT_FAIL:.*(?:dependency|receipt|lineage)/i,
    /query returned no rows|hotels_v2_seven_arches_pricing_activation_.*(?:dependency|lineage|foundation)/i);
}

async function sourcePinCase() {
  const databaseUrl = withDatabase(fixtureUrl, caseDatabases.get('source_pin'));
  await installLiveEvolution(databaseUrl, 'hotels_v2_114400_source_pin');
  await runPsql(databaseUrl, `
    create or replace function public.hotel_v2_partner_workspace_function_lineage_is_exact()
    returns boolean language sql stable security definer
    set search_path=pg_catalog,public as $function$ select false $function$;
  `, 'hotels_v2_114400_source_pin_mutation');
  return expectRejected(databaseUrl, 'hotels_v2_114400_source_pin',
    /PREFLIGHT_FAIL:.*(?:source|Stage2|lineage|protected state)/i,
    /hotels_v2_seven_arches_pricing_activation_.*(?:drift|lineage|foundation)/i);
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
          where id='36000000-0000-4000-8000-000000000109'::uuid)+
        (select count(*) from public.affiliate_commission_events
          where id='36000000-0000-4000-8000-000000000110'::uuid),
      'new_rows_absent',not exists(select 1 from public.affiliate_commission_events
        where id in('36000000-0000-4000-8000-000000000114'::uuid,
          '36000000-0000-4000-8000-000000000117'::uuid))
    )::text;
  `, 'hotels_v2_114400_live_fixture_guard');
  assert.deepEqual(ready, {
    task2_receipt_count: 1,
    owner_receipt_count: 1,
    activation_absent: true,
    fixture_rows: 6,
    new_rows_absent: true,
  });
}

async function cloneCaseDatabases() {
  for (const databaseName of caseDatabases.values()) {
    await runPsql(adminUrl, `create database ${quoteIdentifier(databaseName)}
      with template ${quoteIdentifier(templateDatabase)};`,
    'hotels_v2_114400_live_baseline_clone');
    createdDatabases.push(databaseName);
  }
}

async function cleanup() {
  for (const databaseName of [...createdDatabases].reverse()) {
    try {
      await runPsql(adminUrl, `drop database if exists ${quoteIdentifier(databaseName)}
        with (force);`, 'hotels_v2_114400_live_baseline_cleanup');
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
    liveBaselinePositive: await positiveCase(),
    repeatedUnrelatedLiveEvolution: await repeatedLiveEvolutionCase(),
    criticalPropertyDrift: await criticalPropertyCase(),
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
  sentinel: 'HOTELS_V2_7A_PRICING_ACTIVATION_SCOPED_COMPATIBILITY_GATE_PASS',
  scopedContract: SCOPED_CONTRACT,
  results,
}));
