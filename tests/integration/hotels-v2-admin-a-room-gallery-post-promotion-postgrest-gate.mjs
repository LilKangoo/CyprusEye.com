import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_ADMIN_A_POSTGREST_URL
  || 'http://127.0.0.1:53014';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname));
assert.equal(parsedUrl.protocol, 'http:');

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const SCHEDULE = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const PARTY = '443065c0-984a-5de3-a22a-d03042c41107';

let prepareRequestCount = 0;

async function request(path, { token, method = 'GET', body } = {}) {
  if (path === '/rpc/hotel_v2_admin_prepare_legacy_shadow_rooms') {
    prepareRequestCount += 1;
  }
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

function version(rows, id) {
  return Number(rows.find((row) => row.id === id)?.version || 0);
}

function roomOriginal(room) {
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

async function workspace() {
  const result = await rpc(
    'hotel_v2_admin_get_property_workspace', TOKENS.admin, { p_hotel_id: HOTEL },
  );
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

function reviewedPlan(state, galleries) {
  const upper = state.room_types.find((room) => room.id === UPPER);
  const ground = state.room_types.find((room) => room.id === GROUND);
  return {
    hotel_id: HOTEL,
    expected_property_updated_at: state.property.updated_at,
    reviewed_at: new Date().toISOString(),
    source_contract: 'seven_arches_two_apartments_v1',
    expected_legacy_pricing_fingerprint:
      state.legacy_shadow_preview.legacy_pricing_fingerprint,
    expected_property_policy: {
      children_policy: state.property.children_policy,
      minimum_child_age: state.property.minimum_child_age,
    },
    expected_versions: {
      upper_room: Number(upper.version),
      ground_room: Number(ground.version),
      pricing_schedule: version(state.pricing_schedules, SCHEDULE),
      property_party_preview: version(state.pricing_schedules, PARTY),
      rate_plan: version(state.rate_plans, PLAN),
      upper_room_rate: version(state.room_rates, UPPER_RATE),
      ground_room_rate: version(state.room_rates, GROUND_RATE),
    },
    property_policy: {
      children_policy: state.property.children_policy,
      minimum_child_age: state.property.minimum_child_age,
    },
    rooms: [{
      id: UPPER,
      expected_version: Number(upper.version),
      expected_original: roomOriginal(upper),
      source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: upper.name_i18n,
      description_i18n: upper.description_i18n,
      gallery: galleries.upper,
      amenities: upper.amenities,
      max_occupancy: 4,
      sort_order: upper.sort_order,
    }, {
      id: GROUND,
      expected_version: Number(ground.version),
      expected_original: roomOriginal(ground),
      source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: ground.name_i18n,
      description_i18n: ground.description_i18n,
      gallery: galleries.ground,
      amenities: ground.amenities,
      max_occupancy: 4,
      sort_order: ground.sort_order,
    }],
    prepare_pricing_preview: true,
  };
}

function roomUpdatePlan(state, roomId, payload) {
  return {
    hotel_id: HOTEL,
    expected_property_updated_at: state.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type: 'update', id: roomId,
      expected_version: version(state.room_types, roomId), payload,
    },
  };
}

function assertInert(state) {
  assert.equal(state.property.architecture_version, 'legacy');
  assert.deepEqual(state.feature_flags, {
    hotel_rooms_v2_enabled: false,
    hotel_external_sync_enabled: false,
    hotel_instant_booking_enabled: false,
    hotel_stripe_connect_enabled: false,
  });
  assert.equal(state.rate_plans.length, 1);
  assert.equal(state.rate_plans[0].is_active, false);
  assert.equal(state.room_rates.every((rate) => rate.is_active === false), true);
  assert.equal(state.pricing_schedules.every((schedule) => schedule.is_active === false), true);
  assert.equal(
    state.pricing_schedules.find((schedule) => schedule.id === SCHEDULE).review_status,
    'reviewed',
  );
}

for (const [label, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.partner],
]) {
  const denied = await rpc(
    'hotel_v2_admin_prepare_legacy_shadow_rooms', token,
    { p_plan: {}, p_correlation_id: 'a3320000-0000-4000-8000-000000000099' },
  );
  assert.equal(denied.ok, false, `${label} unexpectedly reached Admin prepare`);
  assert.ok([401, 403, 404].includes(denied.status), `${label}: ${denied.status}`);
}

const rawAnonymous = await request('/hotel_room_types?select=id,version,gallery&limit=5');
assert.equal(rawAnonymous.status, 401);

const initial = await workspace();
assertInert(initial);
assert.deepEqual(initial.room_types.find((room) => room.id === UPPER).gallery, []);
assert.equal(initial.room_types.find((room) => room.id === GROUND).gallery.length, 5);
const protectedGraph = {
  propertyPricing: initial.property.pricing_tiers,
  propertyUpdatedAt: initial.property.updated_at,
  plans: initial.rate_plans,
  rates: initial.room_rates,
  schedules: initial.pricing_schedules,
  tiers: initial.pricing_schedule_tiers,
  flags: initial.feature_flags,
};

const approved = {
  upper: initial.property.photos.slice(0, 6),
  ground: [...initial.room_types.find((room) => room.id === GROUND).gallery],
};
const upperInitialVersion = version(initial.room_types, UPPER);
const groundInitialVersion = version(initial.room_types, GROUND);

async function rejectedPrepare(plan, correlationId) {
  return request('/rpc/hotel_v2_admin_prepare_legacy_shadow_rooms', {
    token: TOKENS.admin,
    method: 'POST',
    body: { p_plan: plan, p_correlation_id: correlationId },
  });
}

const foreignHotelPlan = reviewedPlan(initial, approved);
foreignHotelPlan.hotel_id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
const foreignHotel = await rejectedPrepare(
  foreignHotelPlan,
  'a3320000-0000-4000-8000-000000000091',
);
assert.equal(foreignHotel.status, 400, JSON.stringify(foreignHotel.payload));
assert.equal(foreignHotel.payload?.code, '22023');
assert.equal(foreignHotel.payload?.message, 'hotels_v2_h2b1_invalid_shadow_plan');

const foreignRoomPlan = reviewedPlan(initial, approved);
foreignRoomPlan.rooms[0].id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
const foreignRoom = await rejectedPrepare(
  foreignRoomPlan,
  'a3320000-0000-4000-8000-000000000092',
);
assert.equal(foreignRoom.status, 400, JSON.stringify(foreignRoom.payload));
assert.equal(foreignRoom.payload?.code, '22023');
assert.equal(
  foreignRoom.payload?.message,
  'hotels_v2_h2b1_shadow_rooms_exact_set_required',
);

const topLevelSmugglingPlan = reviewedPlan(initial, approved);
topLevelSmugglingPlan.commission = 0;
const topLevelSmuggling = await rejectedPrepare(
  topLevelSmugglingPlan,
  'a3320000-0000-4000-8000-000000000093',
);
assert.equal(topLevelSmuggling.status, 400, JSON.stringify(topLevelSmuggling.payload));
assert.equal(topLevelSmuggling.payload?.code, '22023');
assert.equal(
  topLevelSmuggling.payload?.message,
  'hotels_v2_h2b1_invalid_shadow_plan',
);

const nestedSmugglingPlan = reviewedPlan(initial, approved);
nestedSmugglingPlan.rooms[0].commission = 0;
const nestedSmuggling = await rejectedPrepare(
  nestedSmugglingPlan,
  'a3320000-0000-4000-8000-000000000094',
);
assert.equal(nestedSmuggling.status, 400, JSON.stringify(nestedSmuggling.payload));
assert.equal(nestedSmuggling.payload?.code, '22023');
assert.equal(
  nestedSmuggling.payload?.message,
  'hotels_v2_h2b1_invalid_shadow_room',
);

const restored = await rpc(
  'hotel_v2_admin_prepare_legacy_shadow_rooms', TOKENS.admin,
  {
    p_plan: reviewedPlan(initial, approved),
    p_correlation_id: 'a3320000-0000-4000-8000-000000000001',
  },
);
assert.equal(restored.status, 200, JSON.stringify(restored.payload));
assert.equal(restored.payload.activity.length, 1);
assert.deepEqual(
  restored.payload.workspace.room_types.find((room) => room.id === UPPER).gallery,
  approved.upper,
);
assert.equal(version(restored.payload.workspace.room_types, UPPER), upperInitialVersion + 1);
assert.equal(version(restored.payload.workspace.room_types, GROUND), groundInitialVersion);

const afterRefresh = await workspace();
assert.deepEqual(afterRefresh.room_types.find((room) => room.id === UPPER).gallery, approved.upper);
assert.deepEqual(afterRefresh.room_types.find((room) => room.id === GROUND).gallery, approved.ground);

const beforeNoopUpper = version(afterRefresh.room_types, UPPER);
const beforeNoopGround = version(afterRefresh.room_types, GROUND);
const noOp = await rpc(
  'hotel_v2_admin_prepare_legacy_shadow_rooms', TOKENS.admin,
  {
    p_plan: reviewedPlan(afterRefresh, approved),
    p_correlation_id: 'a3320000-0000-4000-8000-000000000002',
  },
);
assert.equal(noOp.status, 200, JSON.stringify(noOp.payload));
assert.deepEqual(noOp.payload.activity, []);
assert.equal(version(noOp.payload.workspace.room_types, UPPER), beforeNoopUpper);
assert.equal(version(noOp.payload.workspace.room_types, GROUND), beforeNoopGround);

const secondTarget = {
  upper: initial.property.photos.slice(0, 5),
  ground: approved.ground,
};
const second = await rpc(
  'hotel_v2_admin_prepare_legacy_shadow_rooms', TOKENS.admin,
  {
    p_plan: reviewedPlan(noOp.payload.workspace, secondTarget),
    p_correlation_id: 'a3320000-0000-4000-8000-000000000003',
  },
);
assert.equal(second.status, 200, JSON.stringify(second.payload));
assert.equal(second.payload.activity.length, 1);
assert.deepEqual(
  second.payload.workspace.room_types.find((room) => room.id === UPPER).gallery,
  secondTarget.upper,
);
assert.equal(version(second.payload.workspace.room_types, GROUND), groundInitialVersion);

const stalePlan = reviewedPlan(second.payload.workspace, approved);
const concurrentGallery = initial.property.photos.slice(2, 6);
const concurrent = await rpc(
  'hotel_v2_admin_apply_room_type_plan', TOKENS.admin,
  {
    p_plan: roomUpdatePlan(second.payload.workspace, UPPER, { gallery: concurrentGallery }),
    p_correlation_id: 'a3320000-0000-4000-8000-000000000004',
  },
);
assert.equal(concurrent.status, 200, JSON.stringify(concurrent.payload));

const prepareRequestCountBeforeConflict = prepareRequestCount;
const trueConflict = await rpc(
  'hotel_v2_admin_prepare_legacy_shadow_rooms', TOKENS.admin,
  {
    p_plan: stalePlan,
    p_correlation_id: 'a3320000-0000-4000-8000-000000000005',
  },
);
assert.equal(trueConflict.status, 409, JSON.stringify(trueConflict.payload));
assert.equal(trueConflict.payload?.code, 'PT409');
assert.equal(
  trueConflict.payload?.message,
  'hotels_v2_h2b1_shadow_room_three_way_conflict',
);
const detail = JSON.parse(trueConflict.payload.details);
assert.equal(detail.room_id, UPPER);
assert.equal(detail.field, 'gallery');
assert.deepEqual(detail.original, secondTarget.upper);
assert.deepEqual(detail.current, concurrentGallery);
assert.deepEqual(detail.target, approved.upper);

assert.equal(
  prepareRequestCount,
  prepareRequestCountBeforeConflict + 1,
  'Conflict triggered an unexpected automatic retry',
);
const conflictRefresh = await workspace();
assert.equal(
  prepareRequestCount,
  prepareRequestCountBeforeConflict + 1,
  'Workspace refresh triggered a prepare mutation',
);
assert.deepEqual(
  conflictRefresh.room_types.find((room) => room.id === UPPER).gallery,
  concurrentGallery,
);

// The client must explicitly rebuild Review from the fresh workspace and Save once.
const recovered = await rpc(
  'hotel_v2_admin_prepare_legacy_shadow_rooms', TOKENS.admin,
  {
    p_plan: reviewedPlan(conflictRefresh, approved),
    p_correlation_id: 'a3320000-0000-4000-8000-000000000006',
  },
);
assert.equal(recovered.status, 200, JSON.stringify(recovered.payload));
assert.equal(recovered.payload.activity.length, 1);
assert.equal(recovered.payload.activity[0].entity_id, UPPER);
assert.equal(recovered.payload.activity[0].source, 'hotels_v2_h2b1_shadow_prepare');
assert.equal(recovered.payload.activity[0].correlation_id, 'a3320000-0000-4000-8000-000000000006');
assert.equal(recovered.payload.activity[0].before_state.version, upperInitialVersion + 3);
assert.equal(recovered.payload.activity[0].after_state.version, upperInitialVersion + 4);
assert.deepEqual(recovered.payload.activity[0].before_state.gallery, concurrentGallery);
assert.deepEqual(recovered.payload.activity[0].after_state.gallery, approved.upper);
assert.deepEqual(
  recovered.payload.workspace.room_types.find((room) => room.id === UPPER).gallery,
  approved.upper,
);
assert.equal(
  version(recovered.payload.workspace.room_types, UPPER),
  upperInitialVersion + 4,
);
assert.equal(
  version(recovered.payload.workspace.room_types, GROUND),
  groundInitialVersion,
);

const finalState = await workspace();
assert.deepEqual(finalState.room_types.find((room) => room.id === UPPER).gallery, approved.upper);
assert.deepEqual(finalState.room_types.find((room) => room.id === GROUND).gallery, approved.ground);
assert.equal(version(finalState.room_types, UPPER), upperInitialVersion + 4);
assert.equal(version(finalState.room_types, GROUND), groundInitialVersion);
assertInert(finalState);
assert.deepEqual(finalState.property.pricing_tiers, protectedGraph.propertyPricing);
assert.equal(finalState.property.updated_at, protectedGraph.propertyUpdatedAt);
assert.deepEqual(finalState.rate_plans, protectedGraph.plans);
assert.deepEqual(finalState.room_rates, protectedGraph.rates);
assert.deepEqual(finalState.pricing_schedules, protectedGraph.schedules);
assert.deepEqual(finalState.pricing_schedule_tiers, protectedGraph.tiers);
assert.deepEqual(finalState.feature_flags, protectedGraph.flags);
assert.equal(
  prepareRequestCount,
  prepareRequestCountBeforeConflict + 2,
  'Unexpected automatic prepare request/retry occurred',
);

console.log(JSON.stringify({
  ok: true,
  restored_status: restored.status,
  noop_status: noOp.status,
  second_edit_status: second.status,
  conflict_status: trueConflict.status,
  recovered_status: recovered.status,
  conflict_field: detail.field,
  prepare_request_count: prepareRequestCount,
  foreign_hotel_status: foreignHotel.status,
  foreign_room_status: foreignRoom.status,
  top_level_smuggling_status: topLevelSmuggling.status,
  nested_smuggling_status: nestedSmuggling.status,
  legacy_architecture: finalState.property.architecture_version,
  public_flags_off: Object.values(finalState.feature_flags).every((value) => value === false),
}));
