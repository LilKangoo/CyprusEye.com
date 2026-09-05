import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_URL_ENV = 'HOTELS_V2_PREWRITE_RECONCILIATION_DATABASE_URL';
const DISPOSABLE_ACK_ENV = 'HOTELS_V2_PREWRITE_RECONCILIATION_DISPOSABLE';
const REQUIRE_FULL_GATE_ENV = 'HOTELS_V2_PREWRITE_RECONCILIATION_REQUIRE_FULL_GATE';
const PSQL_ENV = 'HOTELS_V2_PREWRITE_RECONCILIATION_PSQL';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const fixtureUrlText = process.env[FIXTURE_URL_ENV];

assert.ok(fixtureUrlText, `${FIXTURE_URL_ENV} is required`);
assert.equal(process.env[DISPOSABLE_ACK_ENV], '1',
  `${DISPOSABLE_ACK_ENV}=1 is required for disposable database cloning`);
assert.ok(['0', '1'].includes(process.env[REQUIRE_FULL_GATE_ENV] || ''),
  `${REQUIRE_FULL_GATE_ENV}=0 or 1 is required`);

const fixtureUrl = new URL(fixtureUrlText);
assert.ok(['postgres:', 'postgresql:'].includes(fixtureUrl.protocol));
assert.ok(LOOPBACK_HOSTS.has(fixtureUrl.hostname),
  'Production-prewrite reconciliation fixture must be loopback-only');
const templateDatabase = decodeURIComponent(fixtureUrl.pathname.replace(/^\//, ''));
assert.ok(templateDatabase && !['postgres', 'template0', 'template1'].includes(templateDatabase),
  'Production-prewrite reconciliation fixture must name a non-system template database');

const requireFullGate = process.env[REQUIRE_FULL_GATE_ENV] === '1';
const psqlBin = process.env[PSQL_ENV] || 'psql';
const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(integrationDir, '..', '..');
const helperPath = resolve(repoRoot, 'supabase', 'manual',
  'hotels_v2_production_prewrite_reconciliation_readonly.sql');
const helperSql = await readFile(helperPath, 'utf8');
const resultMarker = '__HOTELS_V2_PREWRITE_RESULT__';
const runSuffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
const adminUrl = withDatabase(fixtureUrl, 'postgres');
const createdDatabases = [];
const createdRoles = [];

const OWNER_RELATION = 'public.hotel_admin_availability_foundation_evolution_receipts';
const PROPERTY_RELATIONS = [
  'public.hotel_partner_property_drafts',
  'public.hotel_partner_property_proposal_admin_reviews',
  'public.hotel_partner_property_proposal_admin_transaction_context',
  'public.hotel_partner_property_proposal_foundation_receipts',
];
const RECONCILIATION_RELATIONS = [OWNER_RELATION, ...PROPERTY_RELATIONS];
const TARGET_VERSIONS = [
  '20260811435000',
  '20260811436000',
  '20260811437000',
  '20260811440000',
  '20260811440500',
  '20260811441000',
  '20260811441500',
  '20260811442000',
  '20260811442500',
  '20260811445000',
];
const LATER_TARGET_VERSIONS = TARGET_VERSIONS.slice(1);

const OWNER_TRUE_LEAVES = [
  'owner_receipt_exact',
  'owner_receipt_component_hashes_exact',
  'owner_membership_exact',
  'assignment_exact',
  'permission_preset_exact',
  'owner_relation_identity_exact',
  'owner_rls_force_rls_exact',
  'owner_direct_acl_exact',
  'owner_effective_acl_exact',
  'owner_policy_cardinality_exact',
  'owner_immutable_trigger_exact',
  'owner_function_source_security_exact',
  'owner_activity_receipt_outbox_exact',
  'reconciliation_114360_safe',
];
const PROPERTY_TRUE_LEAVES = [
  'property_foundation_receipt_exact',
  'property_cross_anchor_exact',
  'property_relation_identity_exact',
  'property_rls_force_rls_exact',
  'property_direct_acl_exact',
  'property_effective_acl_exact',
  'property_policy_cardinality_exact',
  'property_trigger_topology_exact',
  'property_pending_index_exact',
  'property_function_source_security_exact',
  'property_reviewed_attribution_exact',
  'reconciliation_114370_safe',
];

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
  return text.length > 8_000 ? text.slice(-8_000) : text;
}

async function runPsql(databaseUrl, sql, applicationName) {
  const child = spawn(psqlBin, [
    '-X', '-A', '-t', '-q', '-F', '|', '-d', databaseUrl.href,
    '-v', 'ON_ERROR_STOP=1',
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PGAPPNAME: applicationName,
      PGCONNECT_TIMEOUT: '5',
      PGTZ: 'UTC',
    },
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

function instrumentHelper(source) {
  assert.match(source, /^BEGIN;\s*\nSET TRANSACTION READ ONLY;/);
  assert.match(source, /SET LOCAL statement_timeout = '120s';/);
  assert.match(source, /\nROLLBACK;\s*$/);
  assert.doesNotMatch(source, /max\s*\(\s*version::text\s*\)/i);
  assert.doesNotMatch(source,
    /count\s*\(\s*\*\s*\)\s+FROM\s+aclexplode[\s\S]{0,300}(?:=|<>)\s*[78]\b/i);
  return source.replace(/\nROLLBACK;\s*$/, `
SELECT ${quoteLiteral(resultMarker)} ||
  current_setting('hotels_v2_prewrite.result');
ROLLBACK;
`);
}

const instrumentedHelperSql = instrumentHelper(helperSql);

async function executeHelper(databaseUrl, applicationName) {
  const output = await runPsql(databaseUrl, instrumentedHelperSql, applicationName);
  const marked = output.split('\n').map((line) => line.trim())
    .find((line) => line.startsWith(resultMarker));
  assert.ok(marked, `${applicationName} did not emit the instrumented result payload`);
  return JSON.parse(marked.slice(resultMarker.length));
}

function assertBooleanLeaves(object, leafNames, label) {
  for (const leafName of leafNames) {
    assert.equal(object[leafName], true, `${label}.${leafName} must be true`);
  }
}

function assertCoreBaseline(payload, label, { expectHistory = '114350' } = {}) {
  assert.equal(payload.transaction_safety.transaction_read_only, 'on',
    `${label}: helper transaction must be read-only`);
  assert.equal(payload.summary.migration_history_boundary, expectHistory,
    `${label}: unexpected Hotels migration-history boundary`);
  assert.equal(payload.summary.installed_object_boundary, '114370',
    `${label}: unexpected installed-object boundary`);
  assertBooleanLeaves(payload.reconciliation_114360, OWNER_TRUE_LEAVES,
    `${label}.reconciliation_114360`);
  assertBooleanLeaves(payload.reconciliation_114370, PROPERTY_TRUE_LEAVES,
    `${label}.reconciliation_114370`);
  assert.equal(payload.scoped_hotels_lineage.scoped_hotels_lineage_safe, true,
    `${label}: scoped Hotels lineage must be true`);
  assert.equal(payload.summary.scoped_hotels_lineage_safe, true,
    `${label}: summary scoped Hotels lineage must be true`);
  assert.equal(payload.summary.payment_policy_lineage_safe, true,
    `${label}: payment-policy lineage must be true`);
  assert.equal(payload.summary.maintenance_window_clear, true,
    `${label}: maintenance window must be clear`);
  assert.equal(payload.summary.known_outbox_nonblocking, true,
    `${label}: accepted owner outbox row must be non-blocking`);
  if (requireFullGate) {
    assert.equal(payload.summary.vault_worker_readiness_safe, true,
      `${label}: Vault/worker readiness must be true in full-gate mode`);
    assert.equal(payload.summary.production_prewrite_supplementary_gate, true,
      `${label}: supplementary gate must be true in full-gate mode`);
  } else {
    assert.equal(payload.summary.production_prewrite_supplementary_gate,
      payload.summary.vault_worker_readiness_safe,
      `${label}: only local Vault/worker readiness may gate the core PG fixture`);
  }
}

function assertReconciliationRejected(payload, section, leafName, label) {
  const sectionName = section === 'owner'
    ? 'reconciliation_114360'
    : 'reconciliation_114370';
  const safeName = section === 'owner'
    ? 'reconciliation_114360_safe'
    : 'reconciliation_114370_safe';
  assert.equal(payload[sectionName][leafName], false,
    `${label}: expected ${sectionName}.${leafName}=false`);
  assert.equal(payload[sectionName][safeName], false,
    `${label}: expected ${sectionName}.${safeName}=false`);
  assert.equal(payload.summary[safeName], false,
    `${label}: expected summary.${safeName}=false`);
  assert.equal(payload.summary.scoped_hotels_lineage_safe, false,
    `${label}: reconciliation rejection must close scoped Hotels lineage`);
  assert.equal(payload.summary.production_prewrite_supplementary_gate, false,
    `${label}: reconciliation rejection must close the supplementary gate`);
}

function caseDatabaseName(label) {
  const safeLabel = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_').slice(0, 24);
  return `hv2_prewrite_${runSuffix}_${safeLabel}`.slice(0, 63);
}

async function createCaseDatabase(label) {
  const databaseName = caseDatabaseName(label);
  await runPsql(adminUrl, `CREATE DATABASE ${quoteIdentifier(databaseName)}
    WITH TEMPLATE ${quoteIdentifier(templateDatabase)};`,
  `hotels_v2_prewrite_clone_${label}`);
  createdDatabases.push(databaseName);
  return withDatabase(fixtureUrl, databaseName);
}

async function dropCaseDatabase(databaseName) {
  await runPsql(adminUrl, `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}
    WITH (FORCE);`, 'hotels_v2_prewrite_cleanup_database');
  const index = createdDatabases.indexOf(databaseName);
  if (index >= 0) createdDatabases.splice(index, 1);
}

async function runCase(label, mutationSql, assertion) {
  const databaseName = caseDatabaseName(label);
  const databaseUrl = await createCaseDatabase(label);
  try {
    if (mutationSql.trim()) {
      await runPsql(databaseUrl, mutationSql, `hotels_v2_prewrite_mutation_${label}`);
    }
    const payload = await executeHelper(databaseUrl, `hotels_v2_prewrite_helper_${label}`);
    await assertion(payload, databaseUrl);
    return payload;
  } finally {
    await dropCaseDatabase(databaseName);
  }
}

function setAllRelationAcls(expression) {
  return `
    SET allow_system_table_mods = on;
    UPDATE pg_catalog.pg_class relation
    SET relacl=${expression}
    WHERE relation.oid IN (${RECONCILIATION_RELATIONS
      .map((relation) => `${quoteLiteral(relation)}::regclass`).join(',')});
  `;
}

async function cleanup() {
  for (const databaseName of [...createdDatabases].reverse()) {
    try {
      await runPsql(adminUrl, `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}
        WITH (FORCE);`, 'hotels_v2_prewrite_cleanup_database');
    } catch (error) {
      process.stderr.write(`cleanup warning for ${databaseName}: ${error.message}\n`);
    }
  }
  for (const roleName of [...createdRoles].reverse()) {
    try {
      await runPsql(adminUrl, `DROP ROLE IF EXISTS ${quoteIdentifier(roleName)};`,
        'hotels_v2_prewrite_cleanup_role');
    } catch (error) {
      process.stderr.write(`cleanup warning for ${roleName}: ${error.message}\n`);
    }
  }
}

const results = {
  history: {},
  aclRepresentationPositives: {},
  aclSecurityNegatives: {},
};

try {
  const fixturePayload = await executeHelper(fixtureUrl, 'hotels_v2_prewrite_fixture_guard');
  assertCoreBaseline(fixturePayload, 'fixture');
  const fixtureVersion = Number(await scalar(fixtureUrl,
    "SELECT current_setting('server_version_num')",
    'hotels_v2_prewrite_server_version'));
  assert.ok(Number.isInteger(fixtureVersion) && fixtureVersion >= 150000,
    `Unsupported PostgreSQL version: ${fixtureVersion}`);
  const partialIndexPredicate = await scalar(fixtureUrl, `
    SELECT pg_get_expr(index_row.indpred,index_row.indrelid)
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid=index_row.indexrelid
    WHERE index_relation.relname=
      'hotel_partner_property_drafts_one_pending_assignment_uidx'
      AND index_row.indrelid='public.hotel_partner_property_drafts'::regclass;
  `, 'hotels_v2_prewrite_partial_index_deparse');
  assert.equal(partialIndexPredicate.replaceAll(/\s+/g, ''),
    "(status='pending_admin_review'::text)",
    'Supported fixture produced a materially different partial-index predicate');

  await runCase('history_legacy_9994', `
    INSERT INTO supabase_migrations.schema_migrations(version)
    VALUES ('9994') ON CONFLICT(version) DO NOTHING;
  `, (payload) => {
    assertCoreBaseline(payload, 'history_legacy_9994');
    assert.equal(payload.migration_history.length, TARGET_VERSIONS.length);
    assert.ok(payload.migration_history.every((entry) => entry.exact === true));
  });
  results.history.legacy9994Ignored = true;

  await runCase('history_missing_114350', `
    DELETE FROM supabase_migrations.schema_migrations
    WHERE version::text='20260811435000';
  `, (payload) => {
    assert.equal(payload.transaction_safety.transaction_read_only, 'on');
    assert.equal(payload.summary.migration_history_boundary, 'UNEXPECTED_TARGET_STATE');
    const target = payload.migration_history.find((entry) =>
      entry.migration === '20260811435000');
    assert.deepEqual(target, {
      migration: '20260811435000',
      recorded: false,
      expected_recorded: true,
      exact: false,
    });
    assert.equal(payload.summary.production_prewrite_supplementary_gate, false);
  });
  results.history.missing114350Rejected = true;

  for (const version of LATER_TARGET_VERSIONS) {
    await runCase(`history_${version.slice(-6)}`, `
      INSERT INTO supabase_migrations.schema_migrations(version)
      VALUES (${quoteLiteral(version)}) ON CONFLICT(version) DO NOTHING;
    `, (payload) => {
      assert.equal(payload.transaction_safety.transaction_read_only, 'on');
      assert.equal(payload.summary.migration_history_boundary, 'UNEXPECTED_TARGET_STATE');
      const target = payload.migration_history.find((entry) => entry.migration === version);
      assert.deepEqual(target, {
        migration: version,
        recorded: true,
        expected_recorded: false,
        exact: false,
      });
      assert.equal(payload.summary.production_prewrite_supplementary_gate, false);
    });
  }
  results.history.laterTargetVersionsRejected = LATER_TARGET_VERSIONS.length;

  await runCase('acl_null_default_owner',
    setAllRelationAcls('NULL'),
    (payload) => assertCoreBaseline(payload, 'acl_null_default_owner'));
  results.aclRepresentationPositives.nullDefaultOwner = true;

  await runCase('acl_explicit_owner_default',
    setAllRelationAcls("acldefault('r',relation.relowner)"),
    (payload) => assertCoreBaseline(payload, 'acl_explicit_owner_default'));
  results.aclRepresentationPositives.explicitOwnerDefault = true;

  const splitOwnerAcl = fixtureVersion >= 170000
    ? "ARRAY['postgres=arw/postgres'::aclitem,'postgres=dDxtm/postgres'::aclitem]"
    : "ARRAY['postgres=arw/postgres'::aclitem,'postgres=dDxt/postgres'::aclitem]";
  const reversedSplitOwnerAcl = fixtureVersion >= 170000
    ? "ARRAY['postgres=dDxtm/postgres'::aclitem,'postgres=arw/postgres'::aclitem]"
    : "ARRAY['postgres=dDxt/postgres'::aclitem,'postgres=arw/postgres'::aclitem]";
  await runCase('acl_owner_item_order', `
    SET allow_system_table_mods = on;
    UPDATE pg_catalog.pg_class relation
    SET relacl=CASE WHEN relation.oid IN (
      ${RECONCILIATION_RELATIONS.slice(0, 3)
        .map((relation) => `${quoteLiteral(relation)}::regclass`).join(',')})
      THEN ${splitOwnerAcl} ELSE ${reversedSplitOwnerAcl} END
    WHERE relation.oid IN (${RECONCILIATION_RELATIONS
      .map((relation) => `${quoteLiteral(relation)}::regclass`).join(',')});
  `, (payload) => assertCoreBaseline(payload, 'acl_owner_item_order'));
  results.aclRepresentationPositives.ownerItemOrderIndependent = true;

  if (fixtureVersion >= 170000) {
    await runCase('acl_owner_maintain', RECONCILIATION_RELATIONS
      .map((relation) => `GRANT MAINTAIN ON TABLE ${relation} TO postgres;`).join('\n'),
    (payload) => assertCoreBaseline(payload, 'acl_owner_maintain'));
    results.aclRepresentationPositives.ownerMaintain = true;
  } else {
    results.aclRepresentationPositives.ownerMaintain = 'not_applicable_before_pg17';
  }

  const aclNegativeCases = [
    {
      name: 'public_privilege', section: 'owner', leaf: 'owner_direct_acl_exact',
      sql: `GRANT SELECT ON TABLE ${OWNER_RELATION} TO PUBLIC;`,
    },
    {
      name: 'anon_privilege', section: 'property', leaf: 'property_direct_acl_exact',
      sql: `GRANT SELECT ON TABLE ${PROPERTY_RELATIONS[0]} TO anon;`,
    },
    {
      name: 'authenticated_privilege', section: 'property', leaf: 'property_direct_acl_exact',
      sql: `GRANT SELECT ON TABLE ${PROPERTY_RELATIONS[1]} TO authenticated;`,
    },
    {
      name: 'service_role_privilege', section: 'property', leaf: 'property_direct_acl_exact',
      sql: `GRANT SELECT ON TABLE ${PROPERTY_RELATIONS[2]} TO service_role;`,
    },
    {
      name: 'grantable_non_owner_privilege', section: 'owner', leaf: 'owner_direct_acl_exact',
      sql: `GRANT SELECT ON TABLE ${OWNER_RELATION} TO service_role WITH GRANT OPTION;`,
    },
    {
      name: 'column_acl_privilege', section: 'property', leaf: 'property_direct_acl_exact',
      sql: `GRANT SELECT(id) ON TABLE ${PROPERTY_RELATIONS[0]} TO anon;`,
    },
    {
      name: 'owner_drift', section: 'owner', leaf: 'owner_relation_identity_exact',
      sql: `ALTER TABLE ${OWNER_RELATION} OWNER TO service_role;`,
    },
    {
      name: 'rls_drift', section: 'property', leaf: 'property_rls_force_rls_exact',
      sql: `ALTER TABLE ${PROPERTY_RELATIONS[0]} DISABLE ROW LEVEL SECURITY;`,
    },
    {
      name: 'force_rls_drift', section: 'property', leaf: 'property_rls_force_rls_exact',
      sql: `ALTER TABLE ${PROPERTY_RELATIONS[1]} FORCE ROW LEVEL SECURITY;`,
    },
    {
      name: 'unexpected_policy', section: 'property', leaf: 'property_policy_cardinality_exact',
      sql: `CREATE POLICY hotels_v2_prewrite_unexpected_policy
        ON ${PROPERTY_RELATIONS[2]} FOR SELECT TO authenticated USING (false);`,
    },
    {
      name: 'immutable_trigger_drift', section: 'owner', leaf: 'owner_immutable_trigger_exact',
      sql: `ALTER TABLE ${OWNER_RELATION}
        DISABLE TRIGGER hotel_admin_availability_foundation_evolution_immutable;`,
    },
    {
      name: 'partial_index_predicate_drift', section: 'property',
      leaf: 'property_pending_index_exact',
      sql: `DROP INDEX public.hotel_partner_property_drafts_one_pending_assignment_uidx;
        CREATE UNIQUE INDEX hotel_partner_property_drafts_one_pending_assignment_uidx
        ON ${PROPERTY_RELATIONS[0]}(assignment_id)
        WHERE status='rejected';`,
    },
  ];

  for (const testCase of aclNegativeCases) {
    await runCase(testCase.name, testCase.sql, (payload) =>
      assertReconciliationRejected(payload, testCase.section, testCase.leaf, testCase.name));
    results.aclSecurityNegatives[testCase.name] = true;
  }

  const inheritedRole = `hv2_prewrite_inherited_${runSuffix}`.slice(0, 63);
  createdRoles.push(inheritedRole);
  await runCase('inherited_effective_privilege', `
    CREATE ROLE ${quoteIdentifier(inheritedRole)} NOLOGIN;
    GRANT SELECT ON TABLE ${OWNER_RELATION} TO ${quoteIdentifier(inheritedRole)};
    GRANT ${quoteIdentifier(inheritedRole)} TO anon;
  `, (payload) => {
    assertReconciliationRejected(payload, 'owner', 'owner_effective_acl_exact',
      'inherited_effective_privilege');
    assert.equal(payload.reconciliation_114360.owner_direct_acl_exact, false,
      'Inherited privilege fixture must also expose its unexpected direct grant source');
  });
  results.aclSecurityNegatives.inheritedEffectivePrivilege = true;

  console.log(JSON.stringify({
    sentinel: 'HOTELS_V2_PRODUCTION_PREWRITE_RECONCILIATION_READONLY_GATE_PASS',
    postgresVersion: fixtureVersion,
    requireFullGate,
    partialIndexPredicate,
    historyPositiveCount: 1,
    historyNegativeCount: LATER_TARGET_VERSIONS.length + 1,
    aclRepresentationPositiveCount: fixtureVersion >= 170000 ? 4 : 3,
    aclSecurityNegativeCount: Object.keys(results.aclSecurityNegatives).length,
    results,
  }));
} finally {
  await cleanup();
}
