import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H3_1_TRIGGER_AUTH_POSTGREST_URL
  || 'http://127.0.0.1:53011';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname));
assert.equal(parsedUrl.protocol, 'http:');

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const SCHEDULE = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const PARTY_PREVIEW = '443065c0-984a-5de3-a22a-d03042c41107';
const RATE_PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const UNIT = '46000000-0000-4000-8000-000000000001';
const RULE = '46000000-0000-4000-8000-000000000002';
const RULE_UPPER = '46000000-0000-4000-8000-000000000003';
const RULE_GROUND = '46000000-0000-4000-8000-000000000004';

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
  assert.equal(result.status, 200, `${label}: HTTP ${result.status} ${JSON.stringify(result.payload)}`);
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

function shadowPlan(state) {
  const room = (id) => state.room_types.find((row) => row.id === id);
  return {
    hotel_id: HOTEL,
    expected_property_updated_at: state.property.updated_at,
    expected_property_policy: {
      children_policy: state.property.children_policy,
      minimum_child_age: state.property.minimum_child_age,
    },
    reviewed_at: new Date().toISOString(),
    source_contract: 'seven_arches_two_apartments_v1',
    expected_legacy_pricing_fingerprint: state.legacy_shadow_preview.legacy_pricing_fingerprint,
    expected_versions: {
      upper_room: version(state.room_types, UPPER),
      ground_room: version(state.room_types, GROUND),
      pricing_schedule: version(state.pricing_schedules, SCHEDULE),
      property_party_preview: version(state.pricing_schedules, PARTY_PREVIEW),
      rate_plan: version(state.rate_plans, RATE_PLAN),
      upper_room_rate: version(state.room_rates, UPPER_RATE),
      ground_room_rate: version(state.room_rates, GROUND_RATE),
    },
    property_policy: {
      children_policy: state.property.children_policy,
      minimum_child_age: state.property.minimum_child_age,
    },
    rooms: [{
      id: UPPER,
      expected_version: version(state.room_types, UPPER),
      expected_original: roomOriginal(room(UPPER)),
      source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: { pl: 'Apartament na piętrze', en: 'Upper Floor Apartment', he: 'דירה בקומה העליונה' },
      description_i18n: {}, gallery: state.property.photos.slice(0, 2),
      amenities: ['air_conditioning', 'balcony', 'terrace'], max_occupancy: 4, sort_order: 100,
    }, {
      id: GROUND,
      expected_version: version(state.room_types, GROUND),
      expected_original: roomOriginal(room(GROUND)),
      source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: { pl: 'Apartament na parterze', en: 'Ground Floor Apartment', he: 'דירה בקומת הקרקע' },
      description_i18n: {}, gallery: state.property.photos.slice(2, 4),
      amenities: ['air_conditioning', 'terrace'], max_occupancy: 4, sort_order: 200,
    }],
    prepare_pricing_preview: true,
  };
}

for (const [principal, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.partner],
]) {
  for (const rpcName of [
    'hotel_v2_admin_prepare_legacy_shadow_rooms',
    'hotel_v2_admin_apply_room_type_plan',
    'hotel_v2_admin_apply_workspace_plan',
  ]) {
    const denied = await rpc(rpcName, token, {});
    assert.equal(denied.ok, false, `${principal} unexpectedly called ${rpcName}`);
    assert.ok([401, 403, 404].includes(denied.status), `${principal} ${rpcName}: ${denied.status}`);
  }
}

let workspaceResult = await rpc(
  'hotel_v2_admin_get_property_workspace', TOKENS.admin, { p_hotel_id: HOTEL },
);
assertSuccess(workspaceResult, 'initial workspace');

const shadow = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', TOKENS.admin, {
  p_plan: shadowPlan(workspaceResult.payload),
  p_correlation_id: '46100000-0000-4000-8000-000000000001',
});
assertSuccess(shadow, 'Admin shadow prepare deferred COMMIT');
assert.equal(shadow.payload.public_change, false);

const roomPlan = await rpc('hotel_v2_admin_apply_room_type_plan', TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL,
    expected_property_updated_at: shadow.payload.workspace.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type: 'update', id: UPPER,
      expected_version: version(shadow.payload.workspace.room_types, UPPER),
      payload: { base_inventory_count: 1 },
    },
  },
  p_correlation_id: '46100000-0000-4000-8000-000000000002',
});
assertSuccess(roomPlan, 'Admin Room Type plan deferred COMMIT');

const workspacePlan = await rpc('hotel_v2_admin_apply_workspace_plan', TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL, reviewed_at: new Date().toISOString(),
    operations: [{
      entity: 'room_type', type: 'update', id: UPPER,
      expected_version: version(roomPlan.payload.workspace.room_types, UPPER),
      payload: { inventory_mode: 'unitized', base_inventory_count: 0 },
    }, {
      entity: 'unit', type: 'create', id: UNIT,
      payload: { room_type_id: UPPER, code: 'upper-physical-unit', status: 'active' },
    }],
  },
  p_correlation_id: '46100000-0000-4000-8000-000000000003',
});
assertSuccess(workspacePlan, 'Admin Unit workspace plan deferred COMMIT');

const h31 = await rpc(
  'hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL },
);
assertSuccess(h31, 'H3.1 configuration before allocation invariant');
const allocation = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL,
    expected_property_updated_at: h31.payload.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operations: [{
      entity: 'allocation_rule', type: 'create', id: RULE, expected_version: 0,
      payload: {
        code: 'choice-1-4', allocation_mode: 'customer_choice',
        min_guest_count: 1, max_guest_count: 4, is_active: true,
        review_status: 'reviewed', sort_order: 100,
        items: [{
          id: RULE_UPPER, room_type_id: UPPER, units_required: 1,
          allocated_guest_count: null, sort_order: 100,
        }, {
          id: RULE_GROUND, room_type_id: GROUND, units_required: 1,
          allocated_guest_count: null, sort_order: 200,
        }],
      },
    }],
  },
  p_correlation_id: '46100000-0000-4000-8000-000000000004',
});
assertSuccess(allocation, 'active allocation fixture');

workspaceResult = await rpc(
  'hotel_v2_admin_get_property_workspace', TOKENS.admin, { p_hotel_id: HOTEL },
);
assertSuccess(workspaceResult, 'workspace before invalid inventory');
const beforeInvalid = workspaceResult.payload.room_types.find((row) => row.id === UPPER);
const invalidCorrelation = '46100000-0000-4000-8000-000000000005';
const invalidInventory = await rpc('hotel_v2_admin_apply_room_type_plan', TOKENS.admin, {
  p_plan: {
    hotel_id: HOTEL,
    expected_property_updated_at: workspaceResult.payload.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type: 'update', id: UPPER, expected_version: Number(beforeInvalid.version),
      payload: { status: 'disabled' },
    },
  },
  p_correlation_id: invalidCorrelation,
});
assert.equal(invalidInventory.status, 400, JSON.stringify(invalidInventory.payload));
assert.equal(invalidInventory.payload?.code, '23514');
assert.equal(
  invalidInventory.payload?.message,
  'hotels_v2_h3_1_active_allocation_inventory_invalid',
);

const afterInvalidResult = await rpc(
  'hotel_v2_admin_get_property_workspace', TOKENS.admin, { p_hotel_id: HOTEL },
);
assertSuccess(afterInvalidResult, 'workspace after invalid allocation rollback');
assert.equal(afterInvalidResult.payload.room_types.length, 2);
const afterInvalid = afterInvalidResult.payload.room_types.find((row) => row.id === UPPER);
assert.equal(afterInvalid.status, beforeInvalid.status);
assert.equal(Number(afterInvalid.version), Number(beforeInvalid.version));
assert.equal(
  afterInvalidResult.payload.recent_activity.some((row) => row.correlation_id === invalidCorrelation),
  false,
);

for (const [principal, token] of [
  ['admin', TOKENS.admin], ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin], ['partner', TOKENS.partner],
]) {
  const directHelper = await rpc(
    'hotel_v2_h3_1_validate_room_allocation_inventory', token,
    { p_room_type_id: UPPER },
  );
  assert.equal(directHelper.ok, false, `${principal} directly called private validator`);
  assert.ok([401, 403, 404].includes(directHelper.status));
}

const finalConfig = await rpc(
  'hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL },
);
assertSuccess(finalConfig, 'final H3.1 inert state');
assert.equal(finalConfig.payload.property.architecture_version, 'legacy');
assert.deepEqual(finalConfig.payload.feature_flags, {
  hotel_rooms_v2_enabled: false,
  hotel_external_sync_enabled: false,
  hotel_instant_booking_enabled: false,
  hotel_stripe_connect_enabled: false,
});

console.log(JSON.stringify({
  shadowPrepareStatus: shadow.status,
  roomTypePlanStatus: roomPlan.status,
  unitWorkspacePlanStatus: workspacePlan.status,
  invalidInventoryStatus: invalidInventory.status,
  invalidInventoryMessage: invalidInventory.payload?.message,
  exactRoomCount: afterInvalidResult.payload.room_types.length,
  architectureVersion: finalConfig.payload.property.architecture_version,
  flagsOff: true,
  hotels_v2_h3_1_deferred_room_inventory_trigger_auth_safe: true,
}, null, 2));
