import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H3_2A_POSTGREST_URL || 'http://127.0.0.1:53013';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname));
assert.equal(parsedUrl.protocol, 'http:');

const CONTRACT = 'hotels_v2_h3_2a_partner_permissions_v1';
const HOTEL_7K = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const HOTEL_RGB = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
const PARTNER_OWNER = '20000000-0000-4000-8000-000000000001';
const PARTNER_DISABLED = '20000000-0000-4000-8000-000000000002';
const PARTNER_SUSPENDED = '20000000-0000-4000-8000-000000000003';
const PARTNER_UNASSIGNED = '20000000-0000-4000-8000-000000000004';
const PARTNER_SECOND = '20000000-0000-4000-8000-000000000005';
const ASSIGNMENT_7K_OWNER = '32000000-0000-4000-8000-000000000001';
const ASSIGNMENT_RGB_OWNER = '32000000-0000-4000-8000-000000000002';
const ASSIGNMENT_RGB_SECOND = '32000000-0000-4000-8000-000000000003';

const CAPABILITY_NAMES = Object.freeze([
  'edit_property_content',
  'edit_property_photos',
  'edit_room_content',
  'edit_room_photos',
  'create_rooms',
  'edit_room_structure',
  'manage_prices',
  'manage_availability',
  'process_bookings',
  'request_booking_changes',
  'view_payment_status',
  'initiate_stripe_onboarding',
]);

const allCapabilities = (overrides = {}) => Object.fromEntries(
  CAPABILITY_NAMES.map((name) => [name, overrides[name] ?? false]),
);

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${POSTGREST_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  return { status: response.status, ok: response.ok, payload };
}

function rpc(name, token, body = {}) {
  return request(`/rpc/${name}`, { token, method: 'POST', body });
}

function assertDenied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded`);
  assert.ok([401, 403, 404].includes(result.status), `${label}: ${result.status}`);
}

function assertKeys(value, expected, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} is not an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} keys drifted`);
}

function assignment(snapshot, assignmentId) {
  const row = snapshot.assignments.find((item) => item.assignment_id === assignmentId);
  assert.ok(row, `Missing assignment ${assignmentId}`);
  return row;
}

function permissionPlan(snapshot, assignmentRow, capabilities) {
  return {
    contract_version: CONTRACT,
    decision: 'apply_partner_hotel_permissions',
    hotel_id: snapshot.property.id,
    assignment_id: assignmentRow.assignment_id,
    partner_id: assignmentRow.partner_id,
    reviewed_at: new Date().toISOString(),
    snapshot_token: snapshot.snapshot_token,
    expected_assignment_fingerprint: snapshot.assignment_fingerprint,
    expected_permission_version: assignmentRow.permission.version,
    capabilities,
  };
}

async function getAdminSnapshot(hotelId) {
  const result = await rpc(
    'hotel_v2_admin_get_partner_hotel_permissions',
    TOKENS.admin,
    { p_hotel_id: hotelId },
  );
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

async function listAssigned(token, partnerId) {
  return rpc(
    'hotel_v2_partner_list_assigned_properties',
    token,
    { p_partner_id: partnerId },
  );
}

function assertPartnerEnvelope(payload, expectedPartnerId, expectedRole) {
  assertKeys(payload, [
    'contract_version', 'partner', 'foundation_only', 'workspace_available', 'properties',
  ], 'Partner LIST envelope');
  assert.equal(payload.contract_version, CONTRACT);
  assert.deepEqual(payload.partner, { id: expectedPartnerId, role: expectedRole });
  assert.equal(payload.foundation_only, true);
  assert.equal(payload.workspace_available, false);
  assert.ok(Array.isArray(payload.properties));

  for (const property of payload.properties) {
    assertKeys(property, [
      'assignment_id', 'hotel_id', 'slug', 'name_i18n', 'city', 'cover_image_url',
      'foundation_status', 'workspace_available', 'permission',
    ], 'Partner LIST property');
    assert.equal(property.foundation_status, 'foundation_only');
    assert.equal(property.workspace_available, false);
    assertKeys(property.name_i18n, ['pl', 'en', 'he'], 'Partner LIST translated name');
    assertKeys(property.permission, [
      'exists', 'version', 'has_mutation_capability', 'capabilities',
    ], 'Partner LIST permission');
    assertKeys(property.permission.capabilities, CAPABILITY_NAMES, 'Partner LIST capabilities');
  }

  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    'feature_flags', 'architecture_version', 'owner_partner_id', 'commission',
    'payment_policy', 'booking_id', 'booking_status', 'room_allocation',
    'fulfillment', 'contact_revealed_at',
    'customer@example.test', 'customer_name', 'customer_email', 'customer_phone',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `Partner LIST leaked ${forbidden}`);
  }
}

const initial7k = await getAdminSnapshot(HOTEL_7K);
assertKeys(initial7k, [
  'contract_version', 'property', 'feature_flags', 'capability_catalog',
  'assignment_fingerprint', 'permissions_fingerprint', 'snapshot_token', 'assignments',
], 'Admin GET envelope');
assert.equal(initial7k.contract_version, CONTRACT);
assert.equal(initial7k.property.id, HOTEL_7K);
assert.equal(initial7k.property.architecture_version, 'legacy');
assert.deepEqual(initial7k.feature_flags, {
  hotel_rooms_v2_enabled: false,
  hotel_external_sync_enabled: false,
  hotel_instant_booking_enabled: false,
  hotel_stripe_connect_enabled: false,
});
assert.deepEqual(initial7k.capability_catalog, CAPABILITY_NAMES);

const initial7kOwner = assignment(initial7k, ASSIGNMENT_7K_OWNER);
assert.equal(initial7kOwner.partner_id, PARTNER_OWNER);
assert.equal(initial7kOwner.hotel_id, HOTEL_7K);
assert.equal(initial7kOwner.assignment_active, true);
assert.deepEqual(initial7kOwner.permission, {
  exists: false,
  version: 0,
  updated_at: null,
  has_mutation_capability: false,
  capabilities: allCapabilities(),
});

const protectedConfigurationBefore = await rpc(
  'hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL_7K },
);
assert.equal(protectedConfigurationBefore.status, 200, JSON.stringify(protectedConfigurationBefore.payload));

const initialPlan = permissionPlan(
  initial7k,
  initial7kOwner,
  allCapabilities({ view_payment_status: true }),
);

for (const [label, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['owner', TOKENS.owner],
  ['scoped staff', TOKENS.scopedStaff],
]) {
  assertDenied(await rpc(
    'hotel_v2_admin_get_partner_hotel_permissions', token, { p_hotel_id: HOTEL_7K },
  ), `${label} Admin GET`);
  assertDenied(await rpc(
    'hotel_v2_admin_apply_partner_hotel_permissions', token,
    {
      p_plan: initialPlan,
      p_correlation_id: '35000000-0000-4000-8000-000000000001',
      p_idempotency_key: '36000000-0000-4000-8000-000000000001',
    },
  ), `${label} Admin APPLY`);
}

assertDenied(await listAssigned(TOKENS.anon, PARTNER_OWNER), 'anon Partner LIST');
assertDenied(await listAssigned(TOKENS.nonAdmin, PARTNER_OWNER), 'non-member Partner LIST');
assertDenied(await listAssigned(TOKENS.owner, PARTNER_SECOND), 'foreign-partner LIST');
assertDenied(await listAssigned(TOKENS.suspendedOwner, PARTNER_SUSPENDED), 'suspended Partner LIST');
assertDenied(await listAssigned(TOKENS.disabledOwner, PARTNER_DISABLED), 'can_manage_hotels=false LIST');

const ownerList = await listAssigned(TOKENS.owner, PARTNER_OWNER);
assert.equal(ownerList.status, 200, JSON.stringify(ownerList.payload));
assertPartnerEnvelope(ownerList.payload, PARTNER_OWNER, 'owner');
assert.deepEqual(
  ownerList.payload.properties.map((property) => property.hotel_id).sort(),
  [HOTEL_7K, HOTEL_RGB].sort(),
);
for (const property of ownerList.payload.properties) {
  assert.equal(property.permission.exists, false);
  assert.equal(property.permission.version, 0);
  assert.deepEqual(property.permission.capabilities, allCapabilities());
}

const scopedStaffList = await listAssigned(TOKENS.scopedStaff, PARTNER_OWNER);
assert.equal(scopedStaffList.status, 200, JSON.stringify(scopedStaffList.payload));
assertPartnerEnvelope(scopedStaffList.payload, PARTNER_OWNER, 'staff');
assert.deepEqual(scopedStaffList.payload.properties.map((item) => item.hotel_id), [HOTEL_7K]);

const unscopedStaffList = await listAssigned(TOKENS.unscopedStaff, PARTNER_OWNER);
assertDenied(unscopedStaffList, 'staff without exact Hotel scope LIST');
assert.equal(unscopedStaffList.payload?.code, '42501');
assert.equal(unscopedStaffList.payload?.message, 'hotels_v2_h3_2a_partner_access_denied');

const unassignedList = await listAssigned(TOKENS.unassignedOwner, PARTNER_UNASSIGNED);
assertDenied(unassignedList, 'owner without exact Hotel assignment LIST');
assert.equal(unassignedList.payload?.code, '42501');
assert.equal(unassignedList.payload?.message, 'hotels_v2_h3_2a_partner_access_denied');

const relationshipMismatch = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: { ...initialPlan, partner_id: PARTNER_SECOND },
    p_correlation_id: '35000000-0000-4000-8000-000000000002',
    p_idempotency_key: '36000000-0000-4000-8000-000000000002',
  },
);
assert.equal(relationshipMismatch.status, 404, JSON.stringify(relationshipMismatch.payload));
assert.equal(relationshipMismatch.payload?.code, 'PT404');
assert.equal(relationshipMismatch.payload?.message, 'hotels_v2_h3_2a_assignment_not_found');

const extraCapability = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: {
      ...initialPlan,
      capabilities: { ...initialPlan.capabilities, commission_percent: true },
    },
    p_correlation_id: '35000000-0000-4000-8000-000000000003',
    p_idempotency_key: '36000000-0000-4000-8000-000000000003',
  },
);
assert.equal(extraCapability.status, 400, JSON.stringify(extraCapability.payload));
assert.equal(extraCapability.payload?.code, '22023');
assert.equal(extraCapability.payload?.message, 'hotels_v2_h3_2a_invalid_permission_plan');

const applied = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: initialPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000010',
    p_idempotency_key: '36000000-0000-4000-8000-000000000010',
  },
);
assert.equal(applied.status, 200, JSON.stringify(applied.payload));
assert.equal(applied.payload.ok, true);
assert.equal(applied.payload.contract_version, CONTRACT);
assert.equal(applied.payload.changed, true);
assert.equal(applied.payload.replayed, false);
assert.equal(applied.payload.permission.version, 1);
assert.equal(applied.payload.permission.has_mutation_capability, false);
assert.deepEqual(applied.payload.permission.capabilities, initialPlan.capabilities);

const replay = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: initialPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000011',
    p_idempotency_key: '36000000-0000-4000-8000-000000000010',
  },
);
assert.equal(replay.status, 200, JSON.stringify(replay.payload));
assert.equal(replay.payload.replayed, true);
assert.equal(replay.payload.correlation_id, applied.payload.correlation_id);
assert.equal(replay.payload.idempotency_key, applied.payload.idempotency_key);
assert.equal(replay.payload.changed, applied.payload.changed);
assert.deepEqual(replay.payload.permission, applied.payload.permission);

const reusedKey = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: {
      ...initialPlan,
      capabilities: allCapabilities({ edit_property_content: true }),
    },
    p_correlation_id: '35000000-0000-4000-8000-000000000012',
    p_idempotency_key: '36000000-0000-4000-8000-000000000010',
  },
);
assert.equal(reusedKey.status, 409, JSON.stringify(reusedKey.payload));
assert.equal(reusedKey.payload?.code, 'PT409');
assert.equal(reusedKey.payload?.message, 'hotels_v2_h3_2a_idempotency_key_reused');

const stale = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: initialPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000013',
    p_idempotency_key: '36000000-0000-4000-8000-000000000013',
  },
);
assert.equal(stale.status, 409, JSON.stringify(stale.payload));
assert.equal(stale.payload?.code, 'PT409');
assert.equal(stale.payload?.message, 'hotels_v2_h3_2a_stale_partner_permissions');

const afterStale7k = await getAdminSnapshot(HOTEL_7K);
const afterStaleOwner = assignment(afterStale7k, ASSIGNMENT_7K_OWNER);
assert.equal(afterStaleOwner.permission.version, 1);
assert.deepEqual(afterStaleOwner.permission.capabilities, initialPlan.capabilities);

// Stripe onboarding is an assignment grant but remains owner-only at the
// effective Partner boundary. A scoped staff member must see it masked false.
const stripeOwnerPlan = permissionPlan(
  afterStale7k,
  afterStaleOwner,
  allCapabilities({ view_payment_status: true, initiate_stripe_onboarding: true }),
);
const stripeOwnerApplied = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: stripeOwnerPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000014',
    p_idempotency_key: '36000000-0000-4000-8000-000000000014',
  },
);
assert.equal(stripeOwnerApplied.status, 200, JSON.stringify(stripeOwnerApplied.payload));
assert.equal(stripeOwnerApplied.payload.permission.version, 2);
assert.equal(stripeOwnerApplied.payload.permission.capabilities.initiate_stripe_onboarding, true);

const staffAfterStripeGrant = await listAssigned(TOKENS.scopedStaff, PARTNER_OWNER);
assert.equal(staffAfterStripeGrant.status, 200, JSON.stringify(staffAfterStripeGrant.payload));
assertPartnerEnvelope(staffAfterStripeGrant.payload, PARTNER_OWNER, 'staff');
const staff7kPermission = staffAfterStripeGrant.payload.properties[0].permission;
assert.equal(staff7kPermission.capabilities.initiate_stripe_onboarding, false);
assert.equal(staff7kPermission.has_mutation_capability, false);

const initialRgb = await getAdminSnapshot(HOTEL_RGB);
const initialRgbOwner = assignment(initialRgb, ASSIGNMENT_RGB_OWNER);
const zeroCapabilityPlan = permissionPlan(initialRgb, initialRgbOwner, allCapabilities());
const zeroCapabilityApply = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: zeroCapabilityPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000019',
    p_idempotency_key: '36000000-0000-4000-8000-000000000019',
  },
);
assert.equal(zeroCapabilityApply.status, 200, JSON.stringify(zeroCapabilityApply.payload));
assert.equal(zeroCapabilityApply.payload.changed, false);
assert.equal(zeroCapabilityApply.payload.permission.exists, false);
assert.equal(zeroCapabilityApply.payload.permission.version, 0);
const afterZeroRgb = await getAdminSnapshot(HOTEL_RGB);
assert.equal(afterZeroRgb.permissions_fingerprint, initialRgb.permissions_fingerprint);
assert.equal(afterZeroRgb.snapshot_token, initialRgb.snapshot_token);

const initialRgbSecond = assignment(initialRgb, ASSIGNMENT_RGB_SECOND);
const concurrentPlan = permissionPlan(
  initialRgb,
  initialRgbSecond,
  allCapabilities({ view_payment_status: true }),
);
const concurrentRequest = () => rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: concurrentPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000020',
    p_idempotency_key: '36000000-0000-4000-8000-000000000020',
  },
);
const concurrentResults = await Promise.all([concurrentRequest(), concurrentRequest()]);
for (const result of concurrentResults) {
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.permission.version, 1);
  assert.deepEqual(result.payload.permission.capabilities, concurrentPlan.capabilities);
}
assert.deepEqual(
  concurrentResults.map((result) => result.payload.replayed).sort(),
  [false, true],
  'Concurrent duplicate did not collapse to one write plus one replay',
);
const afterConcurrentRgb = await getAdminSnapshot(HOTEL_RGB);
assert.equal(assignment(afterConcurrentRgb, ASSIGNMENT_RGB_SECOND).permission.version, 1);

const rgbOwner = assignment(afterConcurrentRgb, ASSIGNMENT_RGB_OWNER);
const mutatingOwnerPlan = permissionPlan(
  afterConcurrentRgb,
  rgbOwner,
  allCapabilities({ manage_availability: true }),
);
const mutatingOwner = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: mutatingOwnerPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000021',
    p_idempotency_key: '36000000-0000-4000-8000-000000000021',
  },
);
assert.equal(mutatingOwner.status, 200, JSON.stringify(mutatingOwner.payload));
assert.equal(mutatingOwner.payload.permission.has_mutation_capability, true);

const beforeMutatorConflict = await getAdminSnapshot(HOTEL_RGB);
const secondBeforeConflict = assignment(beforeMutatorConflict, ASSIGNMENT_RGB_SECOND);
const conflictingPlan = permissionPlan(
  beforeMutatorConflict,
  secondBeforeConflict,
  allCapabilities({ view_payment_status: true, manage_prices: true }),
);
const mutatorConflict = await rpc(
  'hotel_v2_admin_apply_partner_hotel_permissions', TOKENS.admin,
  {
    p_plan: conflictingPlan,
    p_correlation_id: '35000000-0000-4000-8000-000000000022',
    p_idempotency_key: '36000000-0000-4000-8000-000000000022',
  },
);
assert.equal(mutatorConflict.status, 409, JSON.stringify(mutatorConflict.payload));
assert.equal(mutatorConflict.payload?.code, 'PT409');
assert.equal(mutatorConflict.payload?.message, 'hotels_v2_h3_2a_mutating_assignment_conflict');

const afterMutatorConflict = await getAdminSnapshot(HOTEL_RGB);
const secondAfterConflict = assignment(afterMutatorConflict, ASSIGNMENT_RGB_SECOND);
assert.equal(secondAfterConflict.permission.version, 1);
assert.deepEqual(secondAfterConflict.permission.capabilities, concurrentPlan.capabilities);

const ownerAfterGrant = await listAssigned(TOKENS.owner, PARTNER_OWNER);
assert.equal(ownerAfterGrant.status, 200, JSON.stringify(ownerAfterGrant.payload));
assertPartnerEnvelope(ownerAfterGrant.payload, PARTNER_OWNER, 'owner');
const owner7kPermission = ownerAfterGrant.payload.properties.find(
  (property) => property.hotel_id === HOTEL_7K,
).permission;
assert.equal(owner7kPermission.exists, true);
assert.equal(owner7kPermission.version, 2);
assert.deepEqual(owner7kPermission.capabilities, stripeOwnerPlan.capabilities);
assert.equal(owner7kPermission.has_mutation_capability, true);

for (const table of [
  'hotel_partner_hotel_permissions',
  'hotel_partner_action_receipts',
  'hotel_partner_event_outbox',
]) {
  for (const [label, token] of [
    ['anon', TOKENS.anon],
    ['non-admin', TOKENS.nonAdmin],
    ['owner', TOKENS.owner],
    ['scoped staff', TOKENS.scopedStaff],
    ['Admin', TOKENS.admin],
  ]) {
    assertDenied(await request(`/${table}?select=*`, { token }), `${label} raw ${table} SELECT`);
  }
  assertDenied(await request(`/${table}`, {
    token: TOKENS.owner,
    method: 'POST',
    body: {},
  }), `owner raw ${table} INSERT`);
}

const protectedConfigurationAfter = await rpc(
  'hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL_7K },
);
assert.equal(protectedConfigurationAfter.status, 200, JSON.stringify(protectedConfigurationAfter.payload));
assert.deepEqual(
  protectedConfigurationAfter.payload,
  protectedConfigurationBefore.payload,
  'H3.2A permission changes altered protected H3.1/legacy configuration',
);

console.log(JSON.stringify({
  result: 'HOTELS_V2_H3_2A_PARTNER_ACCESS_POSTGREST_GATE_PASS',
  contract_version: CONTRACT,
  owner_property_count: ownerAfterGrant.payload.properties.length,
  scoped_staff_property_count: scopedStaffList.payload.properties.length,
  unscoped_staff_denied: true,
  idempotent_permission_version: afterStaleOwner.permission.version,
  owner_only_stripe_permission_version: owner7kPermission.version,
  sole_mutating_assignment: ASSIGNMENT_RGB_OWNER,
  public_activation: false,
}));
