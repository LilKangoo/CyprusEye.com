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
const caseNames = ['pre_lock', 'post_lock', 'inverse', 'accidental', 'critical'];
const caseDatabases = new Map(caseNames.map((name) =>
  [name, `hotels_v2_114400_lock_first_${runSuffix}_${name}`]));
const adminUrl = withDatabase(fixtureUrl, 'postgres');
const sessions = new Set();
const createdDatabases = [];

// This is the complete literal Apply lock universe. Operational content is
// not a permanent lineage allowlist, but every relation remains protected
// against concurrent writes for the broad BEFORE/AFTER receipt comparison.
const REQUIRED_APPLY_RELATIONS = [
  'public.hotels',
  'public.hotel_units',
  'public.hotel_rate_plans',
  'public.hotel_pricing_schedules',
  'public.hotel_property_pricing_defaults',
  'public.hotel_rate_rules',
  'public.hotel_room_allocation_rules',
  'public.hotel_room_allocation_rule_items',
  'public.hotel_unit_calendar_blocks',
  'public.hotel_inventory_holds',
  'public.hotel_booking_room_allocations',
  'public.hotel_inventory_commitments',
  'public.hotel_calendar_source_configs',
  'public.hotel_payment_policies',
  'public.hotel_payment_policy_terms',
  'public.hotel_commission_policies',
  'public.hotel_daily_rates',
  'public.hotel_pricing_promotion_reviews',
  'public.hotel_admin_pricing_action_receipts',
  'public.hotel_admin_availability_action_receipts',
  'public.hotel_admin_availability_plan_reviews',
  'public.hotel_admin_availability_foundation_receipts',
  'public.hotel_admin_availability_foundation_evolution_receipts',
  'public.hotel_bookings',
  'public.partner_service_fulfillments',
  'public.partner_service_fulfillment_form_snapshots',
  'public.service_deposit_requests',
  'public.service_deposit_rules',
  'public.service_deposit_overrides',
  'public.service_coupons',
  'public.service_coupon_redemptions',
  'public.referrals',
  'public.affiliate_commission_events',
  'public.affiliate_payouts',
  'public.affiliate_adjustments',
  'public.affiliate_program_settings',
  'public.affiliate_referrer_overrides',
  'public.affiliate_cashout_requests',
  'public.profile_referral_code_aliases',
  'public.partners',
  'public.partner_users',
  'public.partner_resources',
  'public.partner_user_resources',
  'public.hotel_partner_hotel_permissions',
  'public.site_settings',
  'public.hotel_room_types',
  'public.hotel_room_rates',
  'public.hotel_pricing_schedule_occupancy_tiers',
  'public.hotel_room_rate_occupancy_tiers',
  'public.hotel_calendar_overrides',
  'public.hotel_daily_inventory',
  'public.hotel_partner_action_receipts',
  'public.hotel_partner_event_outbox',
  'public.hotel_activity_log',
  'public.hotel_property_operational_profiles',
  'public.hotel_partner_workspace_foundation_receipts',
  'public.hotel_partner_property_proposal_foundation_receipts',
  'public.hotel_partner_property_proposal_admin_reviews',
  'public.hotel_partner_property_drafts',
  'public.hotel_seven_arches_task2_stage2_compatibility_receipts',
  'public.hotel_seven_arches_pricing_activation_reviews',
  'public.hotel_seven_arches_pricing_activation_transaction_context',
  'public.hotel_seven_arches_pricing_activation_evolution_receipts',
  'hotels_v2_private.hotel_external_calendar_foundation_receipts',
  'hotels_v2_private.hotel_external_calendar_activation_receipts',
  'hotels_v2_private.hotel_external_calendar_plan_reviews',
  'hotels_v2_private.hotel_external_calendar_correlations',
  'hotels_v2_private.hotel_external_calendar_admin_receipts',
];
assert.equal(REQUIRED_APPLY_RELATIONS.length, 68);

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

async function runPsqlExpectFailure(databaseUrl, sql, applicationName, expectedMessage) {
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

async function activityState(databaseUrl, applicationName) {
  const requiredRelations = REQUIRED_APPLY_RELATIONS
    .map((relation) => `${quoteLiteral(relation)}::regclass`).join(',');
  return jsonValue(databaseUrl, `
    with target as(
      select max(pid) pid,count(*) count,
        coalesce(bool_or(wait_event_type='Lock'),false) waiting
      from pg_stat_activity where application_name=${quoteLiteral(applicationName)}
    )
    select json_build_object(
      'count',target.count,
      'waiting',target.waiting,
      'required_relation_lock_count',${REQUIRED_APPLY_RELATIONS.length},
      'granted_required_relation_lock_count',(select count(distinct held.relation)
        from pg_locks held where held.pid=target.pid and held.granted
          and held.mode in('ShareRowExclusiveLock','AccessExclusiveLock')
          and held.relation in(${requiredRelations})),
      'hotel_relation_lock_granted',exists(select 1 from pg_locks held
        where held.pid=target.pid and held.relation='public.hotels'::regclass
          and held.granted and held.mode in('ShareRowExclusiveLock','AccessExclusiveLock')),
      'hotel_relation_lock_waiting',exists(select 1 from pg_locks held
        where held.pid=target.pid and held.relation='public.hotels'::regclass
          and not held.granted),
      'deposit_relation_lock_waiting',exists(select 1 from pg_locks held
        where held.pid=target.pid
          and held.relation='public.service_deposit_requests'::regclass
          and not held.granted),
      'site_relation_lock_granted',exists(select 1 from pg_locks held
        where held.pid=target.pid and held.relation='public.site_settings'::regclass
          and held.granted),
      'site_relation_lock_waiting',exists(select 1 from pg_locks held
        where held.pid=target.pid and held.relation='public.site_settings'::regclass
          and not held.granted)
    )::text from target;
  `, 'hotels_v2_114400_concurrency_activity_probe');
}

async function createReviewedPlan(databaseUrl, label) {
  return scalar(databaseUrl, `
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
          'reason','Lock-first live-baseline concurrency ${label}')) value
      from snapshot
    )
    select (value->'reviewed_plan')::text from preview;
    commit;
  `, `hotels_v2_114400_concurrency_preview_${label}`);
}

function applySql(reviewedPlan, correlationId, idempotencyKey, committedToken) {
  return `begin;
    set local role authenticated;
    do $claims$begin perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true); end$claims$;
    select public.hotel_v2_admin_apply_seven_arches_pricing_activation(
      ${quoteLiteral(reviewedPlan)}::jsonb,
      ${quoteLiteral(correlationId)}::uuid,
      ${quoteLiteral(idempotencyKey)});
    commit;
    \\echo ${committedToken}
  `;
}

function operationalAffiliateSql(depositId, eventId, phase) {
  return `
    insert into public.service_deposit_requests(id,resource_type,resource_id,created_at)
    values(${quoteLiteral(depositId)}::uuid,'hotels',
      'c1000000-0000-4000-8000-000000000001'::uuid,
      '2026-08-31T19:0${phase}:00Z'::timestamptz);
    insert into public.affiliate_commission_events(
      id,partner_id,deposit_request_id,level,referrer_user_id,referred_user_id,
      resource_type,booking_id,fulfillment_id,deposit_paid_at,deposit_amount,
      commission_bps,commission_amount,currency,created_at
    ) values(
      ${quoteLiteral(eventId)}::uuid,'20000000-0000-4000-8000-000000000002'::uuid,
      ${quoteLiteral(depositId)}::uuid,1,
      '36000000-0000-4000-8000-000000000101'::uuid,
      '36000000-0000-4000-8000-000000000102'::uuid,'hotels',
      '36000000-0000-4000-8000-000000000105'::uuid,
      '36000000-0000-4000-8000-000000000104'::uuid,
      '2026-08-31T19:0${phase}:00Z'::timestamptz,
      160,550,8.80,'EUR','2026-08-31T19:0${phase}:00Z'::timestamptz);
  `;
}

async function activationProof(databaseUrl, applicationName) {
  return jsonValue(databaseUrl, `
    with receipt as(
      select * from public.hotel_seven_arches_pricing_activation_evolution_receipts
      where id=1
    ), current_maps as(
      select public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() task2,
        public.hotel_v2_external_calendar_stage2_compatible_fingerprints() stage2
    ), lineage as(
      select public.hotel_v2_seven_arches_pricing_scoped_lineage() value
    )
    select jsonb_build_object(
      'receipt_count',(select count(*) from receipt),
      'context_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_transaction_context),
      'receipt_exact',public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact(),
      'current_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
      'scoped_contract',(select value->>'contract_version' from lineage),
      'operational_maps_preserved',(select not exists(select 1
        from unnest(array[
          'affiliate_commission_events',
          'partner_service_fulfillment_form_snapshots',
          'partner_service_fulfillments',
          'profile_referral_code_aliases',
          'referrals','service_deposit_requests','site_settings']::text[]) key
        where receipt.before_protected_fingerprints->key
            is distinct from receipt.after_protected_fingerprints->key
          or receipt.before_stage2_protected_fingerprints->key
            is distinct from receipt.after_stage2_protected_fingerprints->key)
        from receipt),
      'operational_current_matches_after',(select not exists(select 1
        from unnest(array[
          'affiliate_commission_events',
          'partner_service_fulfillment_form_snapshots',
          'partner_service_fulfillments',
          'profile_referral_code_aliases',
          'referrals','service_deposit_requests','site_settings']::text[]) key
        where receipt.after_protected_fingerprints->key
            is distinct from current_maps.task2->key
          or receipt.after_stage2_protected_fingerprints->key
            is distinct from current_maps.stage2->key)
        from receipt cross join current_maps)
    )::text;
  `, applicationName);
}

async function preLockCommitCase(databaseUrl) {
  const plan = await createReviewedPlan(databaseUrl, 'pre_lock');
  const blockerApp = 'hotels_v2_114400_case_a_first_relation_blocker';
  const applyApp = 'hotels_v2_114400_case_a_apply';
  const blocker = new PsqlSession(databaseUrl, blockerApp);
  blocker.send(`begin;
    lock table public.hotels in row exclusive mode;
    \\echo FIRST_RELATION_BLOCKER_READY
  `);
  await blocker.waitForOutput('FIRST_RELATION_BLOCKER_READY');

  const apply = new PsqlSession(databaseUrl, applyApp);
  apply.send(applySql(plan, '39100000-0000-4000-8000-000000000101',
    'seven-arches-lock-first-case-a', 'CASE_A_ACTIVATION_COMMITTED'));
  apply.finish();
  await waitForCondition(async () => {
    const state = await activityState(databaseUrl, applyApp);
    return state.count === 1 && state.waiting && state.hotel_relation_lock_waiting &&
      state.granted_required_relation_lock_count === 0;
  }, 'case A Apply waiting before the first protected relation lock');

  await runPsql(databaseUrl, `${operationalAffiliateSql(
    '36000000-0000-4000-8000-000000000201',
    '36000000-0000-4000-8000-000000000202', 1)}
    update public.partner_service_fulfillment_form_snapshots
    set snapshot=snapshot||'{"pre_lock_commit":true}'::jsonb
    where id='36000000-0000-4000-8000-000000000106'::uuid;
  `, 'hotels_v2_114400_case_a_pre_lock_writer');

  blocker.send('commit;\n\\echo FIRST_RELATION_BLOCKER_RELEASED\n');
  blocker.finish();
  await blocker.waitForOutput('FIRST_RELATION_BLOCKER_RELEASED');
  await blocker.requireCleanExit();
  await apply.waitForOutput('CASE_A_ACTIVATION_COMMITTED');
  await apply.requireCleanExit();

  const proof = await activationProof(databaseUrl, 'hotels_v2_114400_case_a_proof');
  assert.deepEqual(proof, {
    receipt_count: 1,
    context_count: 0,
    receipt_exact: true,
    current_safe: true,
    compatibility_exact: true,
    scoped_contract: 'hotels_v2_seven_arches_pricing_scoped_lineage_v1',
    operational_maps_preserved: true,
    operational_current_matches_after: true,
  });
  return { freshLockedBeforeIncludedPreLockCommit: true, ...proof };
}

async function postLockWriterCase(databaseUrl) {
  const plan = await createReviewedPlan(databaseUrl, 'post_lock');
  const beforeVersion = await scalar(databaseUrl,
    'select force_refresh_version from public.site_settings where id=1;',
    'hotels_v2_114400_case_b_before');
  const blockerApp = 'hotels_v2_114400_case_b_hotel_row_blocker';
  const applyApp = 'hotels_v2_114400_case_b_apply';
  const writerApp = 'hotels_v2_114400_case_b_site_writer';

  const blocker = new PsqlSession(databaseUrl, blockerApp);
  blocker.send(`begin;
    select id from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid for update;
    \\echo HOTEL_ROW_BLOCKER_READY
  `);
  await blocker.waitForOutput('HOTEL_ROW_BLOCKER_READY');

  const apply = new PsqlSession(databaseUrl, applyApp);
  apply.send(applySql(plan, '39100000-0000-4000-8000-000000000102',
    'seven-arches-lock-first-case-b', 'CASE_B_ACTIVATION_COMMITTED'));
  apply.finish();
  let lastState;
  await waitForCondition(async () => {
    lastState = await activityState(databaseUrl, applyApp);
    return lastState.count === 1 && lastState.waiting &&
      lastState.granted_required_relation_lock_count === REQUIRED_APPLY_RELATIONS.length &&
      lastState.site_relation_lock_granted;
  }, 'case B Apply holding the complete 68-relation lock set while row-blocked');

  const writer = new PsqlSession(databaseUrl, writerApp);
  writer.send(`begin;
    update public.site_settings
    set force_refresh_version=force_refresh_version+1,updated_at=clock_timestamp()
    where id=1 returning force_refresh_version;
    commit;
    \\echo CASE_B_SITE_WRITER_COMMITTED
  `);
  writer.finish();
  await waitForCondition(async () => {
    const state = await activityState(databaseUrl, writerApp);
    return state.count === 1 && state.waiting && state.site_relation_lock_waiting;
  }, 'case B site_settings writer blocked behind Apply');
  assert.equal(await scalar(databaseUrl,
    'select force_refresh_version from public.site_settings where id=1;',
  'hotels_v2_114400_case_b_while_blocked'), beforeVersion);

  blocker.send('commit;\n\\echo HOTEL_ROW_BLOCKER_RELEASED\n');
  blocker.finish();
  await blocker.waitForOutput('HOTEL_ROW_BLOCKER_RELEASED');
  await blocker.requireCleanExit();
  await apply.waitForOutput('CASE_B_ACTIVATION_COMMITTED');
  await apply.requireCleanExit();
  await writer.waitForOutput('CASE_B_SITE_WRITER_COMMITTED');
  await writer.requireCleanExit();

  const after = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'force_refresh_version',force_refresh_version::text,
      'receipt_exact',public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact(),
      'current_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
      'scoped_contract',public.hotel_v2_seven_arches_pricing_scoped_lineage()
        ->>'contract_version')::text
    from public.site_settings where id=1;
  `, 'hotels_v2_114400_case_b_after');
  assert.equal(BigInt(after.force_refresh_version), BigInt(beforeVersion) + 1n);
  assert.equal(after.receipt_exact, true);
  assert.equal(after.current_safe, true);
  assert.equal(after.compatibility_exact, true);
  assert.equal(after.scoped_contract,
    'hotels_v2_seven_arches_pricing_scoped_lineage_v1');
  return {
    completeRelationLocksHeld: REQUIRED_APPLY_RELATIONS.length,
    writerBlockedUntilActivationCommit: true,
    postCommitUnrelatedMetadataCompatible: true,
    ...after,
  };
}

async function inverseRaceCase(databaseUrl) {
  const plan = await createReviewedPlan(databaseUrl, 'inverse');
  const writerApp = 'hotels_v2_114400_case_c_writer_first';
  const applyApp = 'hotels_v2_114400_case_c_apply';
  const writer = new PsqlSession(databaseUrl, writerApp);
  writer.send(`begin;
    ${operationalAffiliateSql(
    '36000000-0000-4000-8000-000000000203',
    '36000000-0000-4000-8000-000000000204', 2)}
    \\echo CASE_C_WRITER_HOLDS_LOCKS
  `);
  await writer.waitForOutput('CASE_C_WRITER_HOLDS_LOCKS');

  const apply = new PsqlSession(databaseUrl, applyApp);
  apply.send(applySql(plan, '39100000-0000-4000-8000-000000000103',
    'seven-arches-lock-first-case-c', 'CASE_C_ACTIVATION_COMMITTED'));
  apply.finish();
  await waitForCondition(async () => {
    const state = await activityState(databaseUrl, applyApp);
    return state.count === 1 && state.waiting && state.deposit_relation_lock_waiting &&
      state.granted_required_relation_lock_count > 0 &&
      state.granted_required_relation_lock_count < REQUIRED_APPLY_RELATIONS.length;
  }, 'case C Apply waiting behind an earlier operational writer');

  writer.send('commit;\n\\echo CASE_C_WRITER_COMMITTED\n');
  writer.finish();
  await writer.waitForOutput('CASE_C_WRITER_COMMITTED');
  await writer.requireCleanExit();
  await apply.waitForOutput('CASE_C_ACTIVATION_COMMITTED');
  await apply.requireCleanExit();

  const proof = await activationProof(databaseUrl, 'hotels_v2_114400_case_c_proof');
  assert.equal(proof.receipt_count, 1);
  assert.equal(proof.receipt_exact, true);
  assert.equal(proof.current_safe, true);
  assert.equal(proof.operational_maps_preserved, true);
  assert.equal(proof.operational_current_matches_after, true);
  return { migrationWaitedForWriter: true, freshBeforeIncludedWriterCommit: true, ...proof };
}

async function accidentalMutationCase(databaseUrl) {
  const plan = await createReviewedPlan(databaseUrl, 'accidental');
  const before = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'task2',public.hotel_v2_seven_arches_property_proposal_protected_fingerprints(),
      'stage2',public.hotel_v2_external_calendar_stage2_compatible_fingerprints())::text;
  `, 'hotels_v2_114400_case_d_before');
  await runPsql(databaseUrl, `
    create function public.hotel_v2_114400_test_accidental_unrelated_mutation()
    returns trigger language plpgsql security definer set search_path=pg_catalog,public
    as $function$ begin
      update public.partner_service_fulfillment_form_snapshots
      set snapshot=snapshot||'{"accidental_apply_mutation":true}'::jsonb
      where id='36000000-0000-4000-8000-000000000106'::uuid;
      return null;
    end $function$;
    create trigger hotel_v2_114400_test_accidental_unrelated_mutation
    after insert on public.hotel_activity_log for each statement execute function
      public.hotel_v2_114400_test_accidental_unrelated_mutation();
  `, 'hotels_v2_114400_case_d_trigger');
  await runPsqlExpectFailure(databaseUrl, applySql(plan,
    '39100000-0000-4000-8000-000000000104', 'seven-arches-lock-first-case-d',
    'CASE_D_MUST_NOT_COMMIT'), 'hotels_v2_114400_case_d_apply',
  /hotels_v2_seven_arches_pricing_activation_.*(?:delta|postcondition|mismatch)/i);
  const after = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'task2',public.hotel_v2_seven_arches_property_proposal_protected_fingerprints(),
      'stage2',public.hotel_v2_external_calendar_stage2_compatible_fingerprints(),
      'receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'context_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_transaction_context),
      'pending_review_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_reviews
        where consumed_at is null))::text;
  `, 'hotels_v2_114400_case_d_after');
  assert.deepEqual(after.task2, before.task2);
  assert.deepEqual(after.stage2, before.stage2);
  assert.equal(after.receipt_count, 0);
  assert.equal(after.context_count, 0);
  assert.equal(after.pending_review_count, 1);
  return { accidentalMutationRejected: true, rollbackContained: true };
}

async function criticalMutationCase(databaseUrl) {
  const plan = await createReviewedPlan(databaseUrl, 'critical');
  await runPsql(databaseUrl, `
    set session_replication_role=replica;
    update public.hotel_pricing_schedule_occupancy_tiers
    set nightly_rate=nightly_rate+1
    where id=(select id from public.hotel_pricing_schedule_occupancy_tiers
      where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
      order by guest_count,threshold_nights,id limit 1);
    set session_replication_role=origin;
  `, 'hotels_v2_114400_case_e_critical_mutation');
  await runPsqlExpectFailure(databaseUrl, applySql(plan,
    '39100000-0000-4000-8000-000000000105', 'seven-arches-lock-first-case-e',
    'CASE_E_MUST_NOT_COMMIT'), 'hotels_v2_114400_case_e_apply',
  /hotels_v2_seven_arches_pricing_activation_.*(?:stale|lineage|safe|drift|mismatch|postcondition)/i);
  const after = await jsonValue(databaseUrl, `
    select jsonb_build_object(
      'receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'context_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_transaction_context),
      'pending_review_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_reviews
        where consumed_at is null),
      'scoped_lineage_rejected',
        public.hotel_v2_seven_arches_pricing_scoped_lineage() is null)::text;
  `, 'hotels_v2_114400_case_e_after');
  assert.equal(after.receipt_count, 0);
  assert.equal(after.context_count, 0);
  assert.equal(after.pending_review_count, 1);
  assert.equal(after.scoped_lineage_rejected, true);
  return { criticalPreLockMutationRejected: true, ...after };
}

async function assertFixtureReady() {
  const ready = await jsonValue(fixtureUrl, `
    select jsonb_build_object(
      'compatibility_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
      'current_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
      'scoped_contract',public.hotel_v2_seven_arches_pricing_scoped_lineage()
        ->>'contract_version',
      'activation_receipt_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'reviews_count',(select count(*)
        from public.hotel_seven_arches_pricing_activation_reviews))::text;
  `, 'hotels_v2_114400_concurrency_fixture_guard');
  assert.deepEqual(ready, {
    compatibility_exact: true,
    current_safe: true,
    scoped_contract: 'hotels_v2_seven_arches_pricing_scoped_lineage_v1',
    activation_receipt_count: 0,
    reviews_count: 0,
  });
}

async function cloneCaseDatabases() {
  for (const databaseName of caseDatabases.values()) {
    await runPsql(adminUrl, `create database ${quoteIdentifier(databaseName)}
      with template ${quoteIdentifier(templateDatabase)};`,
    'hotels_v2_114400_lock_first_clone');
    createdDatabases.push(databaseName);
  }
}

async function cleanup() {
  for (const session of sessions) session.terminate();
  await Promise.allSettled([...sessions].map((session) => session.exitPromise));
  for (const databaseName of [...createdDatabases].reverse()) {
    try {
      await runPsql(adminUrl, `drop database if exists ${quoteIdentifier(databaseName)}
        with (force);`, 'hotels_v2_114400_lock_first_cleanup');
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
    caseA_preLockUnrelatedCommit: await preLockCommitCase(
      withDatabase(fixtureUrl, caseDatabases.get('pre_lock'))),
    caseB_postLockWriterBlocks: await postLockWriterCase(
      withDatabase(fixtureUrl, caseDatabases.get('post_lock'))),
    caseC_inverseWriterRace: await inverseRaceCase(
      withDatabase(fixtureUrl, caseDatabases.get('inverse'))),
    caseD_accidentalUnrelatedMutation: await accidentalMutationCase(
      withDatabase(fixtureUrl, caseDatabases.get('accidental'))),
    caseE_criticalPreLockMutation: await criticalMutationCase(
      withDatabase(fixtureUrl, caseDatabases.get('critical'))),
  };
} finally {
  await cleanup();
}

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_7A_PRICING_ACTIVATION_LOCK_FIRST_CONCURRENCY_GATE_PASS',
  requiredApplyRelationLocks: REQUIRED_APPLY_RELATIONS.length,
  results,
}));
