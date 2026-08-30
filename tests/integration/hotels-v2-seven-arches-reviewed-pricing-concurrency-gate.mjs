import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const DATABASE_URL_ENV = 'HOTELS_V2_REVIEWED_PRICING_CONCURRENCY_DATABASE_URL';
const DISPOSABLE_ENV = 'HOTELS_V2_REVIEWED_PRICING_CONCURRENCY_DISPOSABLE';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const DATABASE_URL_TEXT = process.env[DATABASE_URL_ENV];
assert.ok(DATABASE_URL_TEXT, `${DATABASE_URL_ENV} is required`);
assert.equal(process.env[DISPOSABLE_ENV], '1',
  `${DISPOSABLE_ENV}=1 is required for disposable database cloning`);

const templateUrl = new URL(DATABASE_URL_TEXT);
assert.ok(['postgres:', 'postgresql:'].includes(templateUrl.protocol));
assert.ok(LOOPBACK_HOSTS.has(templateUrl.hostname),
  'Reviewed-pricing concurrency fixture must be loopback-only');
const templateDatabase = decodeURIComponent(templateUrl.pathname.replace(/^\//, ''));
assert.ok(templateDatabase && !['postgres', 'template0', 'template1'].includes(templateDatabase),
  'Reviewed-pricing concurrency fixture must name a non-system template database');

const PSQL = process.env.HOTELS_V2_REVIEWED_PRICING_CONCURRENCY_PSQL || 'psql';
const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER_SCHEDULE = 'aec20731-7a56-35f0-334e-92b363351f02';
const ADMIN = '10000000-0000-4000-8000-000000000001';
const runSuffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const caseNames = [1, 2, 3].map((number) =>
  `hotels_v2_114415_race_${runSuffix}_c${number}`);
const caseUrls = caseNames.map((name) => withDatabase(templateUrl, name));
const adminUrl = withDatabase(templateUrl, 'postgres');
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

function concise(stderr, stdout = '') {
  const value = `${stderr}\n${stdout}`.trim();
  return value.length > 5_000 ? value.slice(-5_000) : value;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function psqlEnvironment(applicationName) {
  return { ...process.env, PGAPPNAME: applicationName, PGCONNECT_TIMEOUT: '5' };
}

async function runPsql(databaseUrl, sql, applicationName, expectSuccess = true) {
  const child = spawn(PSQL, [
    '-X', '-A', '-t', '-q', '-d', databaseUrl.href,
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
  ], {
    env: psqlEnvironment(applicationName),
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
  if (expectSuccess) {
    assert.equal(code, 0,
      `${applicationName} failed (${signal || code}): ${concise(stderr, stdout)}`);
  }
  return { code, signal, stdout: stdout.trim(), stderr: stderr.trim() };
}

class PsqlSession {
  constructor(databaseUrl, applicationName) {
    this.applicationName = applicationName;
    this.stdout = '';
    this.stderr = '';
    this.closed = false;
    this.child = spawn(PSQL, [
      '-X', '-A', '-t', '-q', '-d', databaseUrl.href,
      '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
    ], {
      env: psqlEnvironment(applicationName),
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

  async waitForOutput(token, timeoutMs = 20_000) {
    await waitForCondition(() => {
      if (this.stdout.includes(token)) return true;
      if (this.closed) {
        throw new Error(`${this.applicationName} exited before ${token}: ${concise(
          this.stderr, this.stdout)}`);
      }
      return false;
    }, `${this.applicationName} output ${token}`, timeoutMs);
  }

  async result() {
    const { code, signal } = await this.exitPromise;
    sessions.delete(this);
    return { code, signal, stdout: this.stdout.trim(), stderr: this.stderr.trim() };
  }

  terminate() {
    if (!this.closed) this.child.kill('SIGTERM');
  }
}

async function waitForCondition(predicate, label, timeoutMs = 20_000) {
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

function outputLines(result) {
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

function jsonResult(result, label) {
  assert.equal(result.code, 0,
    `${label} failed (${result.signal || result.code}): ${concise(result.stderr, result.stdout)}`);
  const lines = outputLines(result);
  assert.equal(lines.length, 1, `${label} expected one JSON row: ${result.stdout}`);
  return JSON.parse(lines[0]);
}

async function scalar(databaseUrl, sql, applicationName) {
  const result = await runPsql(databaseUrl, sql, applicationName);
  const lines = outputLines(result);
  assert.equal(lines.length, 1, `${applicationName} expected one scalar: ${result.stdout}`);
  return lines[0];
}

async function jsonValue(databaseUrl, sql, applicationName) {
  return JSON.parse(await scalar(databaseUrl, sql, applicationName));
}

const adminPrelude = `
  begin;
  set local role authenticated;
  set local request.jwt.claims=${quoteLiteral(JSON.stringify({
    role: 'authenticated', sub: ADMIN, email: 'admin@example.test',
  }))};
`;

function adminPreviewSql(target, delta, reason) {
  return `${adminPrelude}
    select public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
      jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
        'hotel_id',${quoteLiteral(HOTEL)},'action','accept',
        'reason',${quoteLiteral(reason)},'items',jsonb_build_array(jsonb_build_object(
          'hotel_id',${quoteLiteral(target.hotel_id)},
          'room_type_id',${quoteLiteral(target.room_type_id)},
          'room_rate_id',${quoteLiteral(target.room_rate_id)},
          'pricing_schedule_id',${quoteLiteral(target.pricing_schedule_id)},
          'schedule_tier_id',${quoteLiteral(target.schedule_tier_id)},
          'guest_count',${Number(target.guest_count)},
          'minimum_nights',${Number(target.minimum_nights)},
          'currency',${quoteLiteral(target.currency)},
          'before_price',${Number(target.before_price)}::numeric,
          'requested_price',${Number(target.before_price) + Number(delta)}::numeric
        )))
      )->'reviewed_plan';
    commit;
  `;
}

function adminApplySql(plan, correlationId, idempotencyKey) {
  return `${adminPrelude}
    select public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
      ${quoteLiteral(JSON.stringify(plan))}::jsonb,
      ${quoteLiteral(correlationId)}::uuid,
      ${quoteLiteral(idempotencyKey)}::uuid
    )::text;
    commit;
  `;
}

async function createPlan(databaseUrl, delta, label) {
  const target = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'hotel_id',authority.hotel_id,
      'room_type_id',authority.room_type_id,
      'room_rate_id',authority.room_rate_id,
      'pricing_schedule_id',authority.independent_schedule_id,
      'schedule_tier_id',authority.target_tier_id,
      'guest_count',authority.guest_count,
      'minimum_nights',authority.threshold_nights,
      'currency',authority.currency,
      'before_price',authority.current_nightly_rate)
    from public.hotel_seven_arches_independent_pricing_authority authority
    where authority.independent_schedule_id=${quoteLiteral(UPPER_SCHEDULE)}::uuid
      and authority.guest_count=2 and authority.threshold_nights=2;
  `, `hotels_v2_114415_${label}_target`);
  const result = await runPsql(databaseUrl,
    adminPreviewSql(target, delta, `Concurrent ${label} reviewed pricing`),
    `hotels_v2_114415_${label}_preview`);
  return jsonResult(result, `${label} preview`);
}

async function waitingLockCount(databaseUrl, applicationNames) {
  return Number(await scalar(databaseUrl, `
    select count(*)
    from pg_catalog.pg_stat_activity activity
    where activity.datname=current_database()
      and activity.application_name=any(${quoteLiteral(`{${applicationNames.join(',')}}`)}::text[])
      and activity.wait_event_type='Lock';
  `, 'hotels_v2_114415_wait_probe'));
}

async function holdAdvisory(databaseUrl, key, applicationName, readyToken) {
  const blocker = new PsqlSession(databaseUrl, applicationName);
  blocker.send(`
    begin;
    select pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(${quoteLiteral(key)},0));
    \\echo ${readyToken}
  `);
  await blocker.waitForOutput(readyToken);
  return blocker;
}

async function launchApply(databaseUrl, plan, correlationId, idempotencyKey, applicationName) {
  const session = new PsqlSession(databaseUrl, applicationName);
  session.send(adminApplySql(plan, correlationId, idempotencyKey));
  session.finish();
  return session;
}

async function release(blocker) {
  blocker.send('commit;\n');
  blocker.finish();
  const result = await blocker.result();
  assert.equal(result.code, 0, concise(result.stderr, result.stdout));
}

async function postcondition(databaseUrl, expectedReceiptCount, label) {
  const state = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'receipt_count',(select count(*)
        from public.hotel_seven_arches_reviewed_pricing_evolution_receipts),
      'context_count',(select count(*)
        from public.hotel_seven_arches_reviewed_pricing_transaction_context),
      'chain_exact',public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
      'core_cases',state#>>'{oracle,core_case_count}',
      'core_mismatches',state#>>'{oracle,core_mismatch_count}',
      'guest_cases',state#>>'{oracle,guest_one_case_count}',
      'guest_mismatches',state#>>'{oracle,guest_one_mismatch_count}',
      'commission_exact',exists(select 1 from public.hotel_commission_policies policy
        where policy.hotel_id=${quoteLiteral(HOTEL)}::uuid
          and policy.commission_mode='per_allocated_room_per_night'
          and policy.amount=10 and policy.currency='EUR')
    )::text
    from (select public.hotel_v2_seven_arches_reviewed_pricing_current_state() state) current_state;
  `, `hotels_v2_114415_${label}_postcondition`);
  assert.equal(Number(state.receipt_count), expectedReceiptCount, `${label}: receipt count`);
  assert.equal(Number(state.context_count), 0, `${label}: lingering context`);
  assert.equal(state.chain_exact, true, `${label}: receipt chain`);
  assert.equal(Number(state.core_cases), 100, `${label}: core cases`);
  assert.equal(Number(state.core_mismatches), 0, `${label}: core mismatches`);
  assert.equal(Number(state.guest_cases), 20, `${label}: guest-one cases`);
  assert.equal(Number(state.guest_mismatches), 0, `${label}: guest-one mismatches`);
  assert.equal(state.commission_exact, true, `${label}: commission drift`);
  return state;
}

async function caseSameIdentity(databaseUrl) {
  const plan = await createPlan(databaseUrl, 1, 'same_identity');
  const reviewId = plan.review_id;
  const correlation = '41540000-0000-4000-8000-000000000001';
  const idempotency = '41550000-0000-4000-8000-000000000001';
  const appNames = ['hotels_v2_114415_c1_apply_a', 'hotels_v2_114415_c1_apply_b'];
  const blocker = await holdAdvisory(databaseUrl,
    `hotels-v2-7a-reviewed-pricing-review:${reviewId}`,
    'hotels_v2_114415_c1_blocker', 'C1_BLOCKER_READY');
  const racers = await Promise.all(appNames.map((applicationName) =>
    launchApply(databaseUrl, plan, correlation, idempotency, applicationName)));
  await waitForCondition(async () =>
    await waitingLockCount(databaseUrl, appNames) === 2,
  'same-identity Apply sessions waiting');
  await release(blocker);
  const results = await Promise.all(racers.map((session) => session.result()));
  const payloads = results.map((result, index) => jsonResult(result, appNames[index]));
  assert.deepEqual(payloads.map((payload) => payload.replayed).sort(), [false, true]);
  assert.equal(new Set(payloads.map((payload) => payload.receipt_hash)).size, 1);
  await postcondition(databaseUrl, 1, 'c1');
  return { contenders: 2, applied: 1, replayed: 1, receipt_hash: payloads[0].receipt_hash };
}

async function caseDifferentIdentity(databaseUrl) {
  const plan = await createPlan(databaseUrl, 2, 'different_identity');
  const reviewId = plan.review_id;
  const identities = [
    ['41540000-0000-4000-8000-000000000011',
      '41550000-0000-4000-8000-000000000011'],
    ['41540000-0000-4000-8000-000000000012',
      '41550000-0000-4000-8000-000000000012'],
  ];
  const appNames = ['hotels_v2_114415_c2_apply_a', 'hotels_v2_114415_c2_apply_b'];
  const blocker = await holdAdvisory(databaseUrl,
    `hotels-v2-7a-reviewed-pricing-review:${reviewId}`,
    'hotels_v2_114415_c2_blocker', 'C2_BLOCKER_READY');
  const racers = await Promise.all(appNames.map((applicationName, index) =>
    launchApply(databaseUrl, plan, identities[index][0], identities[index][1], applicationName)));
  await waitForCondition(async () =>
    await waitingLockCount(databaseUrl, appNames) === 2,
  'different-identity Apply sessions waiting');
  await release(blocker);
  const results = await Promise.all(racers.map((session) => session.result()));
  assert.equal(results.filter((result) => result.code === 0).length, 1);
  assert.equal(results.filter((result) => result.code !== 0).length, 1);
  const winner = results.find((result) => result.code === 0);
  const loser = results.find((result) => result.code !== 0);
  assert.equal(jsonResult(winner, 'different-identity winner').replayed, false);
  assert.match(loser.stderr,
    /PT409.*hotels_v2_seven_arches_reviewed_pricing_review_consumed/is);
  await postcondition(databaseUrl, 1, 'c2');
  return { contenders: 2, applied: 1, rejected: 1,
    rejection: 'PT409/hotels_v2_seven_arches_reviewed_pricing_review_consumed' };
}

async function caseConflictingPlans(databaseUrl) {
  const plans = await Promise.all([
    createPlan(databaseUrl, 3, 'conflict_a'),
    createPlan(databaseUrl, 4, 'conflict_b'),
  ]);
  const identities = [
    ['41540000-0000-4000-8000-000000000021',
      '41550000-0000-4000-8000-000000000021'],
    ['41540000-0000-4000-8000-000000000022',
      '41550000-0000-4000-8000-000000000022'],
  ];
  const appNames = ['hotels_v2_114415_c3_apply_a', 'hotels_v2_114415_c3_apply_b'];
  const blocker = await holdAdvisory(databaseUrl,
    'hotels-v2-7a-reviewed-pricing-receipt-chain',
    'hotels_v2_114415_c3_blocker', 'C3_BLOCKER_READY');
  const racers = await Promise.all(appNames.map((applicationName, index) =>
    launchApply(databaseUrl, plans[index], identities[index][0], identities[index][1],
      applicationName)));
  await waitForCondition(async () =>
    await waitingLockCount(databaseUrl, appNames) === 2,
  'conflicting-plan Apply sessions waiting');
  await release(blocker);
  const results = await Promise.all(racers.map((session) => session.result()));
  assert.equal(results.filter((result) => result.code === 0).length, 1);
  assert.equal(results.filter((result) => result.code !== 0).length, 1);
  const loser = results.find((result) => result.code !== 0);
  assert.match(loser.stderr,
    /PT409.*hotels_v2_seven_arches_reviewed_pricing_(?:item|proposal|tier)_stale/is);
  await postcondition(databaseUrl, 1, 'c3');
  return { contenders: 2, applied: 1, rejected: 1,
    rejection: 'PT409/stale protected pricing state' };
}

async function assertTemplateReady() {
  const ready = await jsonValue(templateUrl, `
    select jsonb_build_object(
      'migration_installed',to_regclass(
        'public.hotel_seven_arches_reviewed_pricing_foundation_receipts') is not null,
      'foundation_count',(select count(*)
        from public.hotel_seven_arches_reviewed_pricing_foundation_receipts),
      'receipt_count',(select count(*)
        from public.hotel_seven_arches_reviewed_pricing_evolution_receipts),
      'pending_count',(select count(*)
        from public.hotel_seven_arches_reviewed_pricing_proposals
        where status='pending_admin_review'),
      'chain_exact',public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
      'topology_exact',public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
    )::text;
  `, 'hotels_v2_114415_concurrency_fixture_guard');
  assert.deepEqual(ready, {
    migration_installed: true,
    foundation_count: 1,
    receipt_count: 0,
    pending_count: 0,
    chain_exact: true,
    topology_exact: true,
  }, `Concurrency template is not pristine: ${JSON.stringify(ready)}`);
}

async function cloneCases() {
  for (const name of caseNames) {
    await runPsql(adminUrl,
      `create database ${quoteIdentifier(name)} with template ${quoteIdentifier(templateDatabase)};`,
      'hotels_v2_114415_concurrency_clone');
    createdDatabases.push(name);
  }
}

async function cleanup() {
  for (const session of sessions) session.terminate();
  await Promise.allSettled([...sessions].map((session) => session.exitPromise));
  sessions.clear();
  for (const name of [...createdDatabases].reverse()) {
    await runPsql(adminUrl, `
      select pg_catalog.pg_terminate_backend(activity.pid)
      from pg_catalog.pg_stat_activity activity
      where activity.datname=${quoteLiteral(name)}
        and activity.pid<>pg_catalog.pg_backend_pid();
      drop database if exists ${quoteIdentifier(name)};
    `, 'hotels_v2_114415_concurrency_cleanup');
  }
  createdDatabases.length = 0;
}

let summary;
try {
  await assertTemplateReady();
  await cloneCases();
  const [sameIdentity, differentIdentity, conflictingPlans] = await Promise.all([
    caseSameIdentity(caseUrls[0]),
    caseDifferentIdentity(caseUrls[1]),
    caseConflictingPlans(caseUrls[2]),
  ]);
  summary = { same_identity: sameIdentity, different_identity: differentIdentity,
    conflicting_plans: conflictingPlans };
} finally {
  await cleanup();
}

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_7A_REVIEWED_PRICING_CONCURRENCY_GATE_OK',
  cases: 3,
  summary,
}));
