import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const FIXTURE_URL_ENV = 'HOTELS_V2_TASK3_CONCURRENCY_DATABASE_URL';
const DISPOSABLE_ACK_ENV = 'HOTELS_V2_TASK3_CONCURRENCY_DISPOSABLE';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const fixtureUrlText = process.env[FIXTURE_URL_ENV];

assert.ok(fixtureUrlText, `${FIXTURE_URL_ENV} is required`);
assert.equal(process.env[DISPOSABLE_ACK_ENV], '1',
  `${DISPOSABLE_ACK_ENV}=1 is required for disposable database cloning`);

const fixtureUrl = new URL(fixtureUrlText);
assert.ok(['postgres:', 'postgresql:'].includes(fixtureUrl.protocol));
assert.ok(LOOPBACK_HOSTS.has(fixtureUrl.hostname),
  'Task3 concurrency fixture must be loopback-only');
const templateDatabase = decodeURIComponent(fixtureUrl.pathname.replace(/^\//, ''));
assert.ok(templateDatabase && !['postgres', 'template0', 'template1'].includes(templateDatabase));

const psqlBin = process.env.HOTELS_V2_TASK3_CONCURRENCY_PSQL || 'psql';
const runSuffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const caseDatabase = `hotels_v2_114400_exact_six_${runSuffix}_concurrency`;
const adminUrl = withDatabase(fixtureUrl, 'postgres');
const caseUrl = withDatabase(fixtureUrl, caseDatabase);
const sessions = new Set();
let databaseCreated = false;

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
  return text.length > 7_000
    ? `${text.slice(0, 2_000)}\n... output elided ...\n${text.slice(-5_000)}`
    : text;
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

async function runPsql(databaseUrl, sql, applicationName) {
  const child = spawn(psqlBin, [
    '-X', '-A', '-t', '-q', '-d', databaseUrl.href, '-v', 'ON_ERROR_STOP=1',
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
  const { code, signal } = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', (exitCode, exitSignal) =>
      resolveExit({ code: exitCode, signal: exitSignal }));
  });
  assert.equal(code, 0,
    `${applicationName} failed (${signal || code}): ${conciseError(stderr, stdout)}`);
  return stdout.trim();
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

async function waitForCondition(predicate, label, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${label}`);
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
      env: { ...process.env, PGAPPNAME: applicationName, PGCONNECT_TIMEOUT: '5' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => { this.stdout += chunk; });
    this.child.stderr.on('data', (chunk) => { this.stderr += chunk; });
    this.child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') throw error;
    });
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
    assert.equal(this.closed, false);
    this.child.stdin.write(sql);
  }

  finish() {
    if (!this.child.stdin.destroyed) this.child.stdin.end();
  }

  async waitForOutput(token, timeoutMs = 30_000) {
    await waitForCondition(() => {
      if (this.stdout.includes(token)) return true;
      if (this.closed) throw new Error(`${this.applicationName} exited before ${token}: ${
        conciseError(this.stderr, this.stdout)}`);
      return false;
    }, `${this.applicationName} output ${token}`, timeoutMs);
  }

  async requireCleanExit() {
    const { code, signal } = await this.exitPromise;
    sessions.delete(this);
    assert.equal(code, 0, `${this.applicationName} failed (${signal || code}): ${
      conciseError(this.stderr, this.stdout)}`);
  }

  terminate() {
    if (!this.closed) this.child.kill('SIGTERM');
  }
}

async function activityState(applicationName) {
  return jsonValue(caseUrl, `
    with target as(
      select max(pid) pid,count(*) count,
        coalesce(bool_or(wait_event_type='Lock'),false) waiting
      from pg_stat_activity where application_name=${quoteLiteral(applicationName)}
    )
    select json_build_object(
      'count',target.count,
      'waiting',target.waiting,
      'site_relation_lock_granted',exists(select 1 from pg_locks held
        where held.pid=target.pid
          and held.relation='public.site_settings'::regclass and held.granted),
      'site_relation_lock_waiting',exists(select 1 from pg_locks held
        where held.pid=target.pid
          and held.relation='public.site_settings'::regclass and not held.granted),
      'protected_relation_lock_count',(select count(distinct held.relation)
        from pg_locks held where held.pid=target.pid and held.granted
          and held.mode in('ShareRowExclusiveLock','AccessExclusiveLock')
          and held.relation in(
            'public.partner_service_fulfillment_form_snapshots'::regclass,
            'public.partner_service_fulfillments'::regclass,
            'public.profile_referral_code_aliases'::regclass,
            'public.referrals'::regclass,
            'public.service_deposit_requests'::regclass,
            'public.site_settings'::regclass)),
      'hotel_relation_lock',exists(select 1 from pg_locks held
        where held.pid=target.pid
          and held.relation='public.hotels'::regclass and held.granted)
    )::text
    from target;
  `, 'hotels_v2_114400_concurrency_activity_probe');
}

async function createReviewedPlan() {
  const output = await scalar(caseUrl, `
    begin;
    set local role authenticated;
    do $claims$begin perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true); end$claims$;
    with snapshot as(
      select public.hotel_v2_admin_get_seven_arches_pricing_activation() value
    ), preview as(
      select public.hotel_v2_admin_preview_seven_arches_pricing_activation(
        jsonb_build_object(
          'contract_version','hotels_v2_seven_arches_pricing_activation_draft_v1',
          'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
          'snapshot_token',snapshot.value->>'snapshot_token',
          'upper_base_nightly_rate',135.00,'ground_base_nightly_rate',115.00,
          'rate_plan_name_i18n',jsonb_build_object(
            'pl','Standardowa','en','Standard','he','סטנדרטי'),
          'rate_plan_description_i18n',jsonb_build_object(
            'pl','Bezzwrotna taryfa dla obu apartamentów.',
            'en','Non-refundable rate for both apartments.',
            'he','תעריף ללא החזר לשתי הדירות.'),
          'schedule_name_i18n',jsonb_build_object(
            'pl','Obłożenie i długość pobytu',
            'en','Occupancy and length of stay','he','תפוסה ואורך שהייה'),
          'reason','Exact-six site-settings concurrency gate')) value
      from snapshot
    )
    select (value->'reviewed_plan')::text from preview;
    commit;
  `, 'hotels_v2_114400_concurrency_preview');
  // Preserve PostgreSQL's exact jsonb numeric representation. A
  // JSON.parse/JSON.stringify round trip would collapse values such as
  // 135.00 to 135 and invalidate the server-derived plan fingerprint.
  return output;
}

async function runConcurrencyCase() {
  const reviewedPlan = await createReviewedPlan();
  const beforeVersion = await scalar(caseUrl,
    'select force_refresh_version from public.site_settings where id=1;',
    'hotels_v2_114400_concurrency_before');

  const blockerApp = 'hotels_v2_114400_concurrency_hotel_blocker';
  const applyApp = 'hotels_v2_114400_concurrency_apply';
  const writerApp = 'hotels_v2_114400_concurrency_site_writer';

  const blocker = new PsqlSession(caseUrl, blockerApp);
  blocker.send(`begin;
    select id from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid for update;
    \\echo HOTEL_BLOCKER_READY
  `);
  await blocker.waitForOutput('HOTEL_BLOCKER_READY');

  const apply = new PsqlSession(caseUrl, applyApp);
  apply.send(`begin;
    set local role authenticated;
    do $claims$begin perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true); end$claims$;
    select public.hotel_v2_admin_apply_seven_arches_pricing_activation(
      ${quoteLiteral(reviewedPlan)}::jsonb,
      '39100000-0000-4000-8000-000000000001'::uuid,
      'seven-arches-exact-six-concurrency');
    commit;
    \\echo ACTIVATION_COMMITTED
  `);
  apply.finish();
  let lastApplyState;
  try {
    await waitForCondition(async () => {
      lastApplyState = await activityState(applyApp);
      return lastApplyState.count === 1 && lastApplyState.waiting &&
        lastApplyState.site_relation_lock_granted &&
        lastApplyState.protected_relation_lock_count === 6;
    }, 'activation holding all exact-six relation locks while blocked on Hotel');
  } catch (error) {
    throw new Error(`${error.message}; last_state=${JSON.stringify(lastApplyState)}; ` +
      `apply_output=${conciseError(apply.stderr, apply.stdout)}`);
  }

  const writer = new PsqlSession(caseUrl, writerApp);
  writer.send(`begin;
    update public.site_settings
    set force_refresh_version=force_refresh_version+1,
      updated_at=clock_timestamp()
    where id=1 returning force_refresh_version;
    commit;
    \\echo SITE_WRITER_COMMITTED
  `);
  writer.finish();
  await waitForCondition(async () => {
    const state = await activityState(writerApp);
    return state.count === 1 && state.waiting && state.site_relation_lock_waiting;
  }, 'site_settings writer blocked behind activation');
  assert.equal(await scalar(caseUrl,
    'select force_refresh_version from public.site_settings where id=1;',
  'hotels_v2_114400_concurrency_while_blocked'), beforeVersion);

  blocker.send('commit;\n\\echo HOTEL_BLOCKER_RELEASED\n');
  blocker.finish();
  await blocker.waitForOutput('HOTEL_BLOCKER_RELEASED');
  await blocker.requireCleanExit();
  await apply.waitForOutput('ACTIVATION_COMMITTED');
  await apply.requireCleanExit();
  await writer.waitForOutput('SITE_WRITER_COMMITTED');
  await writer.requireCleanExit();

  const after = await jsonValue(caseUrl, `
    select json_build_object(
      'force_refresh_version',force_refresh_version::text,
      'activation_receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'transaction_context_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_transaction_context),
      'receipt_exact',public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact(),
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
    )::text from public.site_settings where id=1;
  `, 'hotels_v2_114400_concurrency_after');
  assert.equal(BigInt(after.force_refresh_version), BigInt(beforeVersion) + 1n);
  assert.equal(after.activation_receipt_count, 1);
  assert.equal(after.transaction_context_count, 0);
  assert.equal(after.receipt_exact, true,
    'representation-aware receipt proof rejected compatible site-settings metadata');
  assert.equal(after.compatibility_exact, true,
    'representation-aware compatibility proof rejected compatible site-settings metadata');
  return {
    activationHeldExactSixRelationLocks: true,
    writerBlockedUntilActivationCommit: true,
    postCommitMetadataCompatible: true,
    ...after,
  };
}

async function cleanup() {
  for (const session of sessions) session.terminate();
  await Promise.allSettled([...sessions].map((session) => session.exitPromise));
  if (databaseCreated) {
    await runPsql(adminUrl, `drop database if exists ${quoteIdentifier(caseDatabase)}
      with (force);`, 'hotels_v2_114400_concurrency_cleanup');
  }
}

let result;
try {
  const ready = await jsonValue(fixtureUrl, `
    select json_build_object(
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
      'activation_receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'reviews_count',(select count(*) from public.hotel_seven_arches_pricing_activation_reviews)
    )::text;
  `, 'hotels_v2_114400_concurrency_fixture_guard');
  assert.deepEqual(ready,
    { compatibility_exact: true, activation_receipt_count: 0, reviews_count: 0 });
  await runPsql(adminUrl, `create database ${quoteIdentifier(caseDatabase)}
    with template ${quoteIdentifier(templateDatabase)};`, 'hotels_v2_114400_concurrency_clone');
  databaseCreated = true;
  result = await runConcurrencyCase();
} finally {
  await cleanup();
}

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_CONCURRENCY_GATE_PASS',
  result,
}));
