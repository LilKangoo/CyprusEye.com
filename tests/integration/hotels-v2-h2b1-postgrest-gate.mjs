import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H2B1_POSTGREST_URL
  || 'http://127.0.0.1:53009';
const parsedUrl = new URL(POSTGREST_URL);

assert.ok(
  ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Hotels H2B.1 gate refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`,
);
assert.equal(parsedUrl.protocol, 'http:', 'Hotels H2B.1 gate accepts local HTTP only.');

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND_ROOM = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const RATE_PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const PRICING_SCHEDULE = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const PARTY_PREVIEW = '443065c0-984a-5de3-a22a-d03042c41107';

const RPCS = Object.freeze({
  guestPolicy: 'hotel_v2_admin_apply_guest_policy_plan',
  roomType: 'hotel_v2_admin_apply_room_type_plan',
  shadowPrepare: 'hotel_v2_admin_prepare_legacy_shadow_rooms',
});

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

function assertSuccess(result, label) {
  assert.equal(
    result.status,
    200,
    `${label} failed: HTTP ${result.status} ${JSON.stringify(result.payload)}`,
  );
}

function assertDenied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded.`);
  assert.ok(
    [401, 403, 404].includes(result.status),
    `${label} expected HTTP 401/403/404, got ${result.status}: ${JSON.stringify(result.payload)}`,
  );
}

function assertLegacyAndFlags(workspace, label) {
  assert.equal(workspace.property.architecture_version, 'legacy', `${label}: architecture changed.`);
  assert.deepEqual(workspace.feature_flags, {
    hotel_rooms_v2_enabled: false,
    hotel_external_sync_enabled: false,
    hotel_instant_booking_enabled: false,
    hotel_stripe_connect_enabled: false,
  }, `${label}: a protected feature flag changed.`);
}

function entityVersion(rows, id) {
  return Number(rows.find((row) => row.id === id)?.version || 0);
}

function roomOriginal(room) {
  if (!room) return null;
  return {
    hotel_id: room.hotel_id,
    source_key: room.legacy_source_key ?? null,
    code: room.code,
    name_i18n: room.name_i18n,
    description_i18n: room.description_i18n,
    gallery: room.gallery,
    amenities: [...room.amenities].sort(),
    max_occupancy: room.max_occupancy,
    capacity_adults: room.capacity_adults,
    capacity_children: room.capacity_children,
    inventory_mode: room.inventory_mode,
    base_inventory_count: room.base_inventory_count,
    sort_order: room.sort_order,
  };
}

function shadowPlan(workspace) {
  return {
    hotel_id: HOTEL,
    expected_property_updated_at: workspace.property.updated_at,
    reviewed_at: new Date().toISOString(),
    source_contract: 'seven_arches_two_apartments_v1',
    expected_legacy_pricing_fingerprint:
      workspace.legacy_shadow_preview.legacy_pricing_fingerprint,
    expected_property_policy: {
      children_policy: workspace.property.children_policy ?? null,
      minimum_child_age: workspace.property.minimum_child_age ?? null,
    },
    expected_versions: {
      upper_room: entityVersion(workspace.room_types, UPPER_ROOM),
      ground_room: entityVersion(workspace.room_types, GROUND_ROOM),
      pricing_schedule: entityVersion(workspace.pricing_schedules, PRICING_SCHEDULE),
      property_party_preview: entityVersion(workspace.pricing_schedules, PARTY_PREVIEW),
      rate_plan: entityVersion(workspace.rate_plans, RATE_PLAN),
      upper_room_rate: entityVersion(workspace.room_rates, UPPER_RATE),
      ground_room_rate: entityVersion(workspace.room_rates, GROUND_RATE),
    },
    property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
    rooms: [{
      id: UPPER_ROOM,
      expected_version: entityVersion(workspace.room_types, UPPER_ROOM),
      expected_original: roomOriginal(workspace.room_types.find((room) => room.id === UPPER_ROOM)),
      source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: {
        pl: 'Apartament na piętrze',
        en: 'Upper Floor Apartment',
        he: 'דירה בקומה העליונה',
      },
      description_i18n: {},
      gallery: ['/images/7a-1.webp'],
      amenities: ['air_conditioning', 'terrace', 'balcony'],
      max_occupancy: 4,
      sort_order: 100,
    }, {
      id: GROUND_ROOM,
      expected_version: entityVersion(workspace.room_types, GROUND_ROOM),
      expected_original: roomOriginal(workspace.room_types.find((room) => room.id === GROUND_ROOM)),
      source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: {
        pl: 'Apartament na parterze',
        en: 'Ground Floor Apartment',
        he: 'דירה בקומת הקרקע',
      },
      description_i18n: {},
      gallery: ['/images/7a-2.webp'],
      amenities: ['air_conditioning', 'terrace'],
      max_occupancy: 4,
      sort_order: 200,
    }],
    prepare_pricing_preview: true,
  };
}

function assertExactShadow(workspace, label) {
  assertLegacyAndFlags(workspace, label);
  assert.equal(workspace.property.children_policy, 'minimum_age');
  assert.equal(workspace.property.minimum_child_age, 10);
  assert.equal(workspace.room_types.length, 2, `${label}: expected exactly two room rows.`);
  assert.deepEqual(
    workspace.room_types.map((room) => room.id).sort(),
    [UPPER_ROOM, GROUND_ROOM].sort(),
    `${label}: duplicate or unexpected Room Type row.`,
  );
  assert.equal(new Set(workspace.room_types.map((room) => room.id)).size, 2);
  assert.equal(workspace.rate_plans.length, 1, `${label}: expected one Rate Plan.`);
  assert.equal(workspace.rate_plans[0].id, RATE_PLAN);
  assert.equal(workspace.room_rates.length, 2, `${label}: expected two Room Rates.`);
  assert.deepEqual(
    workspace.room_rates.map((rate) => rate.id).sort(),
    [UPPER_RATE, GROUND_RATE].sort(),
  );
  assert.equal(workspace.pricing_schedules.length, 2);
  assert.equal(workspace.pricing_schedule_tiers.length, 90);
}

const initialWorkspaceResult = await rpc(
  'hotel_v2_admin_get_property_workspace',
  TOKENS.admin,
  { p_hotel_id: HOTEL },
);
assertSuccess(initialWorkspaceResult, 'initial Admin workspace');
const initialWorkspace = initialWorkspaceResult.payload;
assertLegacyAndFlags(initialWorkspace, 'initial workspace');
assert.equal(initialWorkspace.room_types.length, 0);
assert.equal(initialWorkspace.legacy_shadow_preview.legacy_pricing_rule_count, 63);
assert.equal(initialWorkspace.legacy_shadow_preview.property_gallery_count, 9);

const firstShadow = await rpc(RPCS.shadowPrepare, TOKENS.admin, {
  p_plan: shadowPlan(initialWorkspace),
  p_correlation_id: '81000000-0000-4000-8000-000000000001',
});
assertSuccess(firstShadow, 'Admin 7 Arches shadow preparation');
assert.equal(firstShadow.payload.public_change, false);
assert.equal(firstShadow.payload.pricing_schedule_tier_count, 27);
assert.equal(firstShadow.payload.property_party_preview_tier_count, 63);
assertExactShadow(firstShadow.payload.workspace, 'first shadow preparation');

const staleRoomPlan = shadowPlan(firstShadow.payload.workspace);
staleRoomPlan.rooms[0].expected_version += 1;
const staleRoomShadow = await rpc(RPCS.shadowPrepare, TOKENS.admin, {
  p_plan: staleRoomPlan,
  p_correlation_id: '81000000-0000-4000-8000-000000000005',
});
assert.equal(staleRoomShadow.ok, false, 'Stale per-room review unexpectedly succeeded.');
assert.equal(staleRoomShadow.status, 409);
assert.equal(staleRoomShadow.payload?.code, 'PT409');
assert.equal(
  staleRoomShadow.payload?.message,
  'hotels_v2_h2b1_room_expected_version_mismatch',
);

const staleCalendar = await rpc('hotel_v2_admin_apply_calendar_plan', TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL,
    from: '2032-01-01',
    to: '2032-01-01',
    reviewed_at: new Date().toISOString(),
    snapshot_token: 'definitely-stale',
    operations: [{}],
  },
  p_correlation_id: '81000000-0000-4000-8000-000000000006',
});
assert.equal(staleCalendar.status, 409);
assert.equal(staleCalendar.payload?.code, 'PT409');
assert.equal(staleCalendar.payload?.message, 'hotels_v2_h2b_stale_calendar_snapshot');

const staleWorkspaceApply = await rpc('hotel_v2_admin_apply_workspace_plan', TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL,
    reviewed_at: new Date().toISOString(),
    operations: [{
      entity: 'room_type',
      type: 'update',
      id: UPPER_ROOM,
      expected_version: entityVersion(firstShadow.payload.workspace.room_types, UPPER_ROOM) + 1,
      payload: {},
    }],
  },
  p_correlation_id: '81000000-0000-4000-8000-000000000007',
});
assert.equal(staleWorkspaceApply.status, 409);
assert.equal(staleWorkspaceApply.payload?.code, 'PT409');
assert.equal(staleWorkspaceApply.payload?.message, 'hotels_v2_h2a_stale_room_type');

const staleWorkspaceResult = await rpc(
  'hotel_v2_admin_get_property_workspace',
  TOKENS.admin,
  { p_hotel_id: HOTEL },
);
assertSuccess(staleWorkspaceResult, 'workspace after all stale conflict probes');
const postConflictWorkspace = staleWorkspaceResult.payload;
for (const collection of [
  'room_types',
  'rate_plans',
  'room_rates',
  'pricing_schedules',
  'pricing_schedule_tiers',
]) {
  assert.deepEqual(
    postConflictWorkspace[collection],
    firstShadow.payload.workspace[collection],
    `A stale conflict probe mutated ${collection}.`,
  );
}
assert.equal(
  postConflictWorkspace.property.updated_at,
  firstShadow.payload.workspace.property.updated_at,
  'A stale conflict probe mutated the property.',
);
assert.equal(
  postConflictWorkspace.recent_activity.length,
  firstShadow.payload.workspace.recent_activity.length,
  'A stale conflict probe appended activity.',
);
assert.equal(
  postConflictWorkspace.recent_activity.some(
    (activity) => [
      '81000000-0000-4000-8000-000000000005',
      '81000000-0000-4000-8000-000000000006',
      '81000000-0000-4000-8000-000000000007',
    ].includes(activity.correlation_id),
  ),
  false,
  'Stale conflict correlations must not reach the activity ledger.',
);

const guestWorkspace = postConflictWorkspace;
const guestPolicy = await rpc(RPCS.guestPolicy, TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL,
    expected_property_updated_at: guestWorkspace.property.updated_at,
    reviewed_at: new Date().toISOString(),
    property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
    room_policies: [{
      room_type_id: UPPER_ROOM,
      expected_version: entityVersion(guestWorkspace.room_types, UPPER_ROOM),
      children_policy_override: 'not_allowed',
      minimum_child_age_override: null,
    }],
  },
  p_correlation_id: '81000000-0000-4000-8000-000000000002',
});
assertSuccess(guestPolicy, 'Admin guest-policy plan');
assert.equal(guestPolicy.payload.updated_room_policy_count, 1);
assert.equal(
  guestPolicy.payload.workspace.room_types.find((room) => room.id === UPPER_ROOM)
    .children_policy_override,
  'not_allowed',
);

const roomWorkspace = guestPolicy.payload.workspace;
const roomType = await rpc(RPCS.roomType, TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL,
    expected_property_updated_at: roomWorkspace.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type: 'update',
      id: GROUND_ROOM,
      expected_version: entityVersion(roomWorkspace.room_types, GROUND_ROOM),
      payload: {
        name_i18n: {
          pl: 'Apartament na parterze',
          en: 'Ground Floor Apartment - reviewed',
          he: 'דירה בקומת הקרקע',
        },
      },
    },
  },
  p_correlation_id: '81000000-0000-4000-8000-000000000003',
});
assertSuccess(roomType, 'Admin Room Type plan');
assert.equal(
  roomType.payload.workspace.room_types.find((room) => room.id === GROUND_ROOM)
    .name_i18n.en,
  'Ground Floor Apartment - reviewed',
);
assertExactShadow(roomType.payload.workspace, 'Room Type save');

const secondShadow = await rpc(RPCS.shadowPrepare, TOKENS.admin, {
  p_plan: shadowPlan(roomType.payload.workspace),
  p_correlation_id: '81000000-0000-4000-8000-000000000004',
});
assertSuccess(secondShadow, 'idempotent 7 Arches shadow preparation');
assertExactShadow(secondShadow.payload.workspace, 'repeated shadow preparation');
assert.equal(
  secondShadow.payload.workspace.room_types.find((room) => room.id === UPPER_ROOM)
    .children_policy_override,
  'not_allowed',
  'Repeated preparation must preserve the explicit Room guest-policy override.',
);

const denied = {};
for (const [role, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.partner],
]) {
  const attempts = {
    guestPolicy: await rpc(RPCS.guestPolicy, token, { p_plan: {}, p_correlation_id: randomUUID() }),
    roomType: await rpc(RPCS.roomType, token, { p_plan: {}, p_correlation_id: randomUUID() }),
    shadowPrepare: await rpc(RPCS.shadowPrepare, token, { p_plan: {}, p_correlation_id: randomUUID() }),
  };
  for (const [operation, result] of Object.entries(attempts)) {
    assertDenied(result, `${role} ${operation}`);
  }
  denied[role] = Object.fromEntries(
    Object.entries(attempts).map(([operation, result]) => [operation, result.status]),
  );
}

const rawTables = [
  'hotel_room_types',
  'hotel_rate_plans',
  'hotel_room_rates',
  'hotel_pricing_schedules',
  'hotel_pricing_schedule_occupancy_tiers',
];
const rawTableDenials = {};
for (const table of rawTables) {
  const unauthenticated = await request(`/${table}?select=*&limit=1`);
  const anon = await request(`/${table}?select=*&limit=1`, { token: TOKENS.anon });
  assertDenied(unauthenticated, `public raw table ${table}`);
  assertDenied(anon, `anon raw table ${table}`);
  rawTableDenials[table] = {
    unauthenticated: unauthenticated.status,
    anon: anon.status,
  };
}

const finalWorkspaceResult = await rpc(
  'hotel_v2_admin_get_property_workspace',
  TOKENS.admin,
  { p_hotel_id: HOTEL },
);
assertSuccess(finalWorkspaceResult, 'final Admin workspace');
assertExactShadow(finalWorkspaceResult.payload, 'final workspace');

process.stdout.write(`${JSON.stringify({
  environment: { postgrestUrl: POSTGREST_URL, loopbackOnly: true },
  admin: {
    initialWorkspaceStatus: initialWorkspaceResult.status,
    shadowPrepareStatus: firstShadow.status,
    guestPolicyStatus: guestPolicy.status,
    roomTypeStatus: roomType.status,
    idempotentShadowPrepareStatus: secondShadow.status,
    staleRoomReviewStatus: staleRoomShadow.status,
    staleCalendarStatus: staleCalendar.status,
    staleWorkspaceStatus: staleWorkspaceApply.status,
  },
  final: {
    architectureVersion: finalWorkspaceResult.payload.property.architecture_version,
    flagsOff: Object.values(finalWorkspaceResult.payload.feature_flags)
      .every((value) => value === false),
    exactRoomTypeIds: finalWorkspaceResult.payload.room_types.map((room) => room.id).sort(),
    roomTypeCount: finalWorkspaceResult.payload.room_types.length,
    ratePlanCount: finalWorkspaceResult.payload.rate_plans.length,
    roomRateCount: finalWorkspaceResult.payload.room_rates.length,
    pricingScheduleCount: finalWorkspaceResult.payload.pricing_schedules.length,
    pricingScheduleTierCount: finalWorkspaceResult.payload.pricing_schedule_tiers.length,
    upperRoomPolicyOverride: finalWorkspaceResult.payload.room_types
      .find((room) => room.id === UPPER_ROOM).children_policy_override,
  },
  denied,
  rawTableDenials,
  hotels_v2_h2b1_postgrest_safe: true,
}, null, 2)}\n`);
