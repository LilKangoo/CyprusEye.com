import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_URL_ENV = 'HOTELS_V2_OWNER_CONCURRENCY_DATABASE_URL';
const DISPOSABLE_ACK_ENV = 'HOTELS_V2_OWNER_CONCURRENCY_DISPOSABLE';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const POLL_TIMEOUT_MS = 8_000;
const SESSION_TIMEOUT_MS = 30_000;

const fixtureUrlText = process.env[FIXTURE_URL_ENV];
assert.ok(fixtureUrlText, `${FIXTURE_URL_ENV} is required`);
assert.equal(process.env[DISPOSABLE_ACK_ENV], '1',
  `${DISPOSABLE_ACK_ENV}=1 is required for disposable database cloning`);

const fixtureUrl = new URL(fixtureUrlText);
assert.ok(['postgres:', 'postgresql:'].includes(fixtureUrl.protocol),
  'Concurrency fixture must use a PostgreSQL URL');
assert.ok(LOOPBACK_HOSTS.has(fixtureUrl.hostname),
  'Concurrency fixture must be loopback-only');

const templateDatabase = decodeURIComponent(fixtureUrl.pathname.replace(/^\//, ''));
assert.ok(templateDatabase && !['postgres', 'template0', 'template1'].includes(templateDatabase),
  'Concurrency fixture must name a disposable non-system template database');

const psqlBin = process.env.HOTELS_V2_OWNER_CONCURRENCY_PSQL || 'psql';
const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(integrationDir, '..', '..');
const migrationPath = resolve(repoRoot, 'supabase', 'migrations',
  '20260811436000_hotels_v2_seven_arches_owner_operational_capabilities.sql');
const migrationSql = await readFile(migrationPath, 'utf8');

const lockStartToken = '\nlock table\n';
const lockEndToken = '\nin share row exclusive mode;';
const prerequisitesStartToken = 'do $seven_arches_owner_prerequisites$';
const applyStartToken = 'do $seven_arches_owner_apply$';
const lockStart = migrationSql.indexOf(lockStartToken);
const lockEnd = migrationSql.indexOf(lockEndToken, lockStart + lockStartToken.length);
const prerequisitesStart = migrationSql.indexOf(prerequisitesStartToken);
const applyStart = migrationSql.indexOf(applyStartToken);

assert.ok(lockStart >= 0 && lockEnd > lockStart && prerequisitesStart > lockEnd
  && applyStart > prerequisitesStart,
  '114360 literal lock/apply boundary is missing or out of order');
assert.equal(migrationSql.indexOf(lockStartToken, lockStart + 1), -1,
  '114360 has more than one literal top-level LOCK start');
assert.equal(migrationSql.indexOf(lockEndToken, lockEnd + 1), -1,
  '114360 has more than one literal top-level LOCK end');
assert.equal(migrationSql.indexOf(prerequisitesStartToken, prerequisitesStart + 1), -1,
  '114360 has more than one literal prerequisites block');
assert.equal(migrationSql.indexOf(applyStartToken, applyStart + 1), -1,
  '114360 has more than one literal apply block');

// The migration is not rewritten. The prefix ends immediately before the
// literal apply block, after the real top-level LOCK and intervening schema
// setup. Client-side \echo sentinels pause the one psql session without adding
// a database statement or snapshot.
const migrationThroughLocks = migrationSql.slice(0, applyStart);
const migrationFromApply = migrationSql.slice(applyStart);
assert.equal(migrationThroughLocks + migrationFromApply, migrationSql);
assert.match(migrationThroughLocks, /set transaction isolation level read committed;/i);
assert.doesNotMatch(migrationThroughLocks, /^commit;\s*$/im);
assert.match(migrationFromApply, /^commit;\s*$/im);

const migrationSha256 = createHash('sha256').update(migrationSql).digest('hex');
const runSuffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const caseDatabaseNames = [1, 2, 3].map((caseNumber) =>
  `hotels_v2_114360_race_${runSuffix}_c${caseNumber}`);
const caseUrls = caseDatabaseNames.map((databaseName) => withDatabase(fixtureUrl, databaseName));
const adminUrl = withDatabase(fixtureUrl, 'postgres');
const sessions = new Set();
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

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function conciseError(stderr, stdout = '') {
  const text = `${stderr}\n${stdout}`.trim();
  return text.length > 4_000 ? text.slice(-4_000) : text;
}

function psqlEnvironment(databaseUrl, applicationName) {
  return {
    ...process.env,
    PGAPPNAME: applicationName,
    PGCONNECT_TIMEOUT: '5',
  };
}

async function runPsql(databaseUrl, sql, applicationName) {
  const child = spawn(psqlBin, [
    '-X', '-A', '-t', '-q', '-d', databaseUrl.href, '-v', 'ON_ERROR_STOP=1',
  ], {
    cwd: repoRoot,
    env: psqlEnvironment(databaseUrl, applicationName),
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

class PsqlSession {
  constructor(databaseUrl, applicationName) {
    this.applicationName = applicationName;
    this.stdout = '';
    this.stderr = '';
    this.closed = false;
    this.child = spawn(psqlBin, [
      '-X', '-A', '-t', '-q', '-d', databaseUrl.href, '-v', 'ON_ERROR_STOP=1',
    ], {
      cwd: repoRoot,
      env: psqlEnvironment(databaseUrl, applicationName),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => { this.stdout += chunk; });
    this.child.stderr.on('data', (chunk) => { this.stderr += chunk; });
    this.exitPromise = new Promise((resolveExit, rejectExit) => {
      this.child.once('error', rejectExit);
      this.child.once('close', (code, signal) => {
        this.closed = true;
        resolveExit({ code, signal });
      });
    });
    sessions.add(this);
  }

  send(sql) {
    assert.equal(this.closed, false, `${this.applicationName} is already closed`);
    this.child.stdin.write(sql);
  }

  finish() {
    if (!this.child.stdin.destroyed) this.child.stdin.end();
  }

  async waitForOutput(token, timeoutMs = SESSION_TIMEOUT_MS) {
    await waitForCondition(async () => {
      if (this.stdout.includes(token)) return true;
      if (this.closed) {
        throw new Error(`${this.applicationName} exited before ${token}: ${conciseError(
          this.stderr, this.stdout)}`);
      }
      return false;
    }, `${this.applicationName} output ${token}`, timeoutMs);
  }

  async requireCleanExit() {
    const { code, signal } = await this.exitPromise;
    sessions.delete(this);
    assert.equal(code, 0,
      `${this.applicationName} failed (${signal || code}): ${conciseError(
        this.stderr, this.stdout)}`);
  }

  terminate() {
    if (!this.closed) this.child.kill('SIGTERM');
  }
}

async function waitForCondition(predicate, label, timeoutMs = POLL_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await sleep(40);
  }
  if (lastError) throw lastError;
  throw new Error(`Timed out waiting for ${label}`);
}

async function scalar(databaseUrl, sql, applicationName) {
  const output = await runPsql(databaseUrl, sql, applicationName);
  const rows = output.split('\n').map((row) => row.trim()).filter(Boolean);
  assert.equal(rows.length, 1, `${applicationName} expected one scalar row: ${output}`);
  return rows[0];
}

async function jsonValue(databaseUrl, sql, applicationName) {
  return JSON.parse(await scalar(databaseUrl, sql, applicationName));
}

async function lockCount(databaseUrl, applicationName, relationName, mode, granted) {
  return Number(await scalar(databaseUrl, `
    select count(*)
    from pg_catalog.pg_stat_activity activity
    join pg_catalog.pg_locks held on held.pid=activity.pid
    where activity.application_name=${quoteLiteral(applicationName)}
      and held.relation=${quoteLiteral(`public.${relationName}`)}::pg_catalog.regclass
      and held.mode=${quoteLiteral(mode)}
      and held.granted=${granted ? 'true' : 'false'};
  `, 'hotels_v2_114360_lock_probe'));
}

async function waitForLock(databaseUrl, applicationName, relationName, mode, granted) {
  await waitForCondition(async () =>
    await lockCount(databaseUrl, applicationName, relationName, mode, granted) === 1,
  `${applicationName} ${granted ? 'granted' : 'waiting'} ${mode} on ${relationName}`);
}

async function siteState(databaseUrl, applicationName) {
  return jsonValue(databaseUrl, `
    select pg_catalog.json_build_object(
      'force_refresh_version',setting.force_refresh_version::text,
      'fingerprint',public.hotel_v2_admin_d_protected_fingerprints()->>'site_settings'
    )::text
    from public.site_settings setting where setting.id=1;
  `, applicationName);
}

function siteMutationSql(marker) {
  return `
    set statement_timeout='30s';
    update public.site_settings
    set force_refresh_version=${marker},updated_at=pg_catalog.clock_timestamp()
    where id=1
    returning force_refresh_version;
  `;
}

async function receiptState(databaseUrl, applicationName) {
  return jsonValue(databaseUrl, `
    select pg_catalog.json_build_object(
      'site_before',receipt.before_current_protected_fingerprints->>'site_settings',
      'site_current',receipt.current_protected_fingerprints->>'site_settings',
      'admin_delta_exact',(
        receipt.allowed_fingerprint_keys=array[
          'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
          'hotel_partner_event_outbox','non_admin_d_activity']::text[]
        and (receipt.current_protected_fingerprints-receipt.allowed_fingerprint_keys)
          is not distinct from
          (receipt.before_current_protected_fingerprints-receipt.allowed_fingerprint_keys)
        and not exists(
          select 1 from unnest(receipt.allowed_fingerprint_keys) changed(key_name)
          where receipt.current_protected_fingerprints->changed.key_name
            is not distinct from receipt.before_current_protected_fingerprints->changed.key_name)
      ),
      'stage2_delta_exact',(
        receipt.stage2_allowed_fingerprint_keys=array[
          'hotel_partner_hotel_permissions','non_external_calendar_activity',
          'non_external_calendar_partner_receipts']::text[]
        and (receipt.stage2_current_protected_fingerprints-
          receipt.stage2_allowed_fingerprint_keys) is not distinct from
          (receipt.stage2_before_current_protected_fingerprints-
          receipt.stage2_allowed_fingerprint_keys)
        and not exists(
          select 1 from unnest(receipt.stage2_allowed_fingerprint_keys) changed(key_name)
          where receipt.stage2_current_protected_fingerprints->changed.key_name
            is not distinct from
            receipt.stage2_before_current_protected_fingerprints->changed.key_name)
      ),
      'self_hashes_exact',(
        receipt.before_current_protected_fingerprint=encode(extensions.digest(
          pg_catalog.convert_to(receipt.before_current_protected_fingerprints::text,'UTF8'),
          'sha256'),'hex')
        and receipt.current_protected_fingerprint=encode(extensions.digest(
          pg_catalog.convert_to(receipt.current_protected_fingerprints::text,'UTF8'),
          'sha256'),'hex')
        and receipt.stage2_before_current_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            receipt.stage2_before_current_protected_fingerprints)
        and receipt.stage2_current_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            receipt.stage2_current_protected_fingerprints)
      )
    )::text
    from public.hotel_admin_availability_foundation_evolution_receipts receipt
    where receipt.id=1;
  `, applicationName);
}

function assertReceiptDelta(receipt, label) {
  assert.equal(receipt.admin_delta_exact, true, `${label}: ADMIN-D delta escaped exact four keys`);
  assert.equal(receipt.stage2_delta_exact, true, `${label}: Stage 2 delta escaped exact three keys`);
  assert.equal(receipt.self_hashes_exact, true, `${label}: receipt self hash mismatch`);
}

async function migratePrefix(databaseUrl, applicationName, token) {
  const session = new PsqlSession(databaseUrl, applicationName);
  session.send(`${migrationThroughLocks}\n\\echo ${token}\n`);
  return session;
}

async function finishMigration(session, token) {
  session.send(`${migrationFromApply}\n\\echo ${token}\n`);
  session.finish();
  await session.waitForOutput(token);
  await session.requireCleanExit();
}

async function caseOne(databaseUrl) {
  const migrationApp = 'hotels_v2_114360_c1_migration';
  const blockerApp = 'hotels_v2_114360_c1_blocker';
  const before = await siteState(databaseUrl, 'hotels_v2_114360_c1_before');
  const marker = (BigInt(before.force_refresh_version) + 101n).toString();

  const blocker = new PsqlSession(databaseUrl, blockerApp);
  blocker.send(`
    begin;
    lock table public.affiliate_adjustments in row exclusive mode;
    \\echo C1_BLOCKER_READY
  `);
  await blocker.waitForOutput('C1_BLOCKER_READY');
  await waitForLock(databaseUrl, blockerApp, 'affiliate_adjustments',
    'RowExclusiveLock', true);

  const migration = await migratePrefix(databaseUrl, migrationApp, 'C1_LOCKS_ACQUIRED');
  await waitForLock(databaseUrl, migrationApp, 'affiliate_adjustments',
    'ShareRowExclusiveLock', false);

  await runPsql(databaseUrl, siteMutationSql(marker), 'hotels_v2_114360_c1_writer');
  const duringWait = await siteState(databaseUrl, 'hotels_v2_114360_c1_observer');
  assert.equal(duringWait.force_refresh_version, marker,
    'case 1 writer marker was not committed while migration waited');
  assert.equal(await lockCount(databaseUrl, blockerApp, 'affiliate_adjustments',
    'RowExclusiveLock', true), 1, 'case 1 blocker released before writer proof');
  assert.equal(await lockCount(databaseUrl, migrationApp, 'affiliate_adjustments',
    'ShareRowExclusiveLock', false), 1, 'case 1 migration stopped waiting before writer proof');
  assert.notEqual(duringWait.fingerprint, before.fingerprint,
    'case 1 writer did not alter the protected site_settings fingerprint');

  blocker.send('commit;\n\\echo C1_BLOCKER_RELEASED\n');
  blocker.finish();
  await blocker.waitForOutput('C1_BLOCKER_RELEASED');
  await blocker.requireCleanExit();
  await migration.waitForOutput('C1_LOCKS_ACQUIRED');
  await finishMigration(migration, 'C1_MIGRATION_DONE');

  const receipt = await receiptState(databaseUrl, 'hotels_v2_114360_c1_receipt');
  assertReceiptDelta(receipt, 'case 1');
  assert.equal(receipt.site_before, duringWait.fingerprint,
    'case 1 receipt BEFORE omitted the pre-lock committed mutation');
  assert.equal(receipt.site_current, duringWait.fingerprint,
    'case 1 migration unexpectedly changed site_settings');
  return {
    wait: 'ShareRowExclusiveLock:affiliate_adjustments',
    writerCommittedWhileWaiting: true,
    preWriteFingerprint: before.fingerprint,
    receiptBeforeFingerprint: receipt.site_before,
  };
}

async function caseTwo(databaseUrl) {
  const migrationApp = 'hotels_v2_114360_c2_migration';
  const writerApp = 'hotels_v2_114360_c2_writer';
  const before = await siteState(databaseUrl, 'hotels_v2_114360_c2_before');
  const marker = (BigInt(before.force_refresh_version) + 202n).toString();

  const migration = await migratePrefix(databaseUrl, migrationApp, 'C2_LOCKS_ACQUIRED');
  await migration.waitForOutput('C2_LOCKS_ACQUIRED');
  assert.equal(await lockCount(databaseUrl, migrationApp, 'site_settings',
    'ShareRowExclusiveLock', true), 1, 'case 2 migration lacks the site_settings lock');

  let writerFinished = false;
  const writerPromise = runPsql(databaseUrl, siteMutationSql(marker), writerApp)
    .then((result) => { writerFinished = true; return result; });
  await waitForLock(databaseUrl, writerApp, 'site_settings', 'RowExclusiveLock', false);
  assert.equal(writerFinished, false, 'case 2 writer completed despite the migration lock');
  const whileBlocked = await siteState(databaseUrl, 'hotels_v2_114360_c2_observer');
  assert.equal(whileBlocked.force_refresh_version, before.force_refresh_version,
    'case 2 uncommitted/blocked writer marker became visible');

  await finishMigration(migration, 'C2_MIGRATION_DONE');
  await writerPromise;
  assert.equal(writerFinished, true, 'case 2 writer did not finish after migration commit');
  const after = await siteState(databaseUrl, 'hotels_v2_114360_c2_after');
  assert.equal(after.force_refresh_version, marker,
    'case 2 writer marker missing after migration completion');

  const receipt = await receiptState(databaseUrl, 'hotels_v2_114360_c2_receipt');
  assertReceiptDelta(receipt, 'case 2');
  assert.equal(receipt.site_before, before.fingerprint,
    'case 2 receipt BEFORE included the post-lock writer');
  assert.equal(receipt.site_current, before.fingerprint,
    'case 2 receipt current unexpectedly included the post-lock writer');
  assert.notEqual(after.fingerprint, receipt.site_current,
    'case 2 post-migration writer failed to invalidate the current baseline');
  return {
    wait: 'RowExclusiveLock:site_settings',
    writerBlockedUntilMigrationCommit: true,
    receiptBeforeFingerprint: receipt.site_before,
    postWriterFingerprint: after.fingerprint,
  };
}

async function caseThree(databaseUrl) {
  const migrationApp = 'hotels_v2_114360_c3_migration';
  const writerApp = 'hotels_v2_114360_c3_writer';
  const before = await siteState(databaseUrl, 'hotels_v2_114360_c3_before');
  const marker = (BigInt(before.force_refresh_version) + 303n).toString();

  const writer = new PsqlSession(databaseUrl, writerApp);
  writer.send(`
    begin;
    ${siteMutationSql(marker)}
    \\echo C3_WRITER_DML_DONE
  `);
  await writer.waitForOutput('C3_WRITER_DML_DONE');
  await waitForLock(databaseUrl, writerApp, 'site_settings', 'RowExclusiveLock', true);
  const beforeCommit = await siteState(databaseUrl, 'hotels_v2_114360_c3_observer_before');
  assert.equal(beforeCommit.force_refresh_version, before.force_refresh_version,
    'case 3 uncommitted writer marker became visible');

  const migration = await migratePrefix(databaseUrl, migrationApp, 'C3_LOCKS_ACQUIRED');
  await waitForLock(databaseUrl, migrationApp, 'site_settings',
    'ShareRowExclusiveLock', false);
  writer.send('commit;\n\\echo C3_WRITER_COMMITTED\n');
  writer.finish();
  await writer.waitForOutput('C3_WRITER_COMMITTED');
  await writer.requireCleanExit();
  await migration.waitForOutput('C3_LOCKS_ACQUIRED');

  const committed = await siteState(databaseUrl, 'hotels_v2_114360_c3_observer_after');
  assert.equal(committed.force_refresh_version, marker,
    'case 3 committed writer marker was not visible after lock acquisition');
  assert.notEqual(committed.fingerprint, before.fingerprint,
    'case 3 writer did not alter the protected site_settings fingerprint');
  await finishMigration(migration, 'C3_MIGRATION_DONE');

  const receipt = await receiptState(databaseUrl, 'hotels_v2_114360_c3_receipt');
  assertReceiptDelta(receipt, 'case 3');
  assert.equal(receipt.site_before, committed.fingerprint,
    'case 3 receipt BEFORE omitted the writer that preceded lock acquisition');
  assert.equal(receipt.site_current, committed.fingerprint,
    'case 3 migration unexpectedly changed site_settings');
  return {
    wait: 'ShareRowExclusiveLock:site_settings',
    writerCommittedBeforeLockAcquisition: true,
    preWriteFingerprint: before.fingerprint,
    receiptBeforeFingerprint: receipt.site_before,
  };
}

async function assertFixtureReady() {
  const ready = await jsonValue(fixtureUrl, `
    select pg_catalog.json_build_object(
      'evolution_absent',to_regclass(
        'public.hotel_admin_availability_foundation_evolution_receipts') is null,
      'metadata_columns_present',exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='site_settings'
          and column_name='force_refresh_version') and exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='site_settings'
          and column_name='updated_at'),
      'supported_flags',(
        select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
          and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled
          and hotel_external_sync_enabled is not null)
        from public.site_settings),
      'target_permission_absent',not exists(
        select 1 from public.hotel_partner_hotel_permissions
        where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    )::text;
  `, 'hotels_v2_114360_concurrency_fixture_guard');
  assert.deepEqual(ready, {
    evolution_absent: true,
    metadata_columns_present: true,
    supported_flags: true,
    target_permission_absent: true,
  }, `Concurrency template is not at the reviewed pre-114360 boundary: ${JSON.stringify(ready)}`);
}

async function cloneCaseDatabases() {
  for (const databaseName of caseDatabaseNames) {
    await runPsql(adminUrl, `create database ${quoteIdentifier(databaseName)}
      with template ${quoteIdentifier(templateDatabase)};`,
    'hotels_v2_114360_concurrency_clone');
    createdDatabases.push(databaseName);
  }
}

async function cleanup() {
  for (const session of sessions) session.terminate();
  await Promise.allSettled([...sessions].map((session) => session.exitPromise));
  for (const databaseName of [...createdDatabases].reverse()) {
    try {
      await runPsql(adminUrl, `drop database if exists ${quoteIdentifier(databaseName)}
        with (force);`, 'hotels_v2_114360_concurrency_cleanup');
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
    case1: await caseOne(caseUrls[0]),
    case2: await caseTwo(caseUrls[1]),
    case3: await caseThree(caseUrls[2]),
  };
} finally {
  await cleanup();
}

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_SEVEN_ARCHES_OWNER_CONCURRENCY_GATE_PASS',
  migrationSha256,
  sourceSplit: 'unique literal top-level LOCK precedes prerequisites/apply; split at apply',
  results,
}));
