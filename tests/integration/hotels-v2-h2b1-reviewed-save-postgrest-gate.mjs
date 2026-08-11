import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H2B1_REVIEWED_POSTGREST_URL
  || 'http://127.0.0.1:53009';
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
const PARTY_PREVIEW = '443065c0-984a-5de3-a22a-d03042c41107';
const FIRST_CORRELATION = '84000000-0000-4000-8000-000000000002';
const STALE_CORRELATION = '84000000-0000-4000-8000-000000000003';
const FOREIGN_PHOTO_CORRELATION = '84000000-0000-4000-8000-000000000004';
const STALE_POLICY_CORRELATION = '84000000-0000-4000-8000-000000000005';
const SECOND_CORRELATION = '84000000-0000-4000-8000-000000000006';

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

function rpc(name, body) {
  return request(`/rpc/${name}`, {
    token: TOKENS.admin,
    method: 'POST',
    body,
  });
}

function version(rows, id) {
  return Number(rows.find((row) => row.id === id)?.version || 0);
}

async function workspace() {
  const result = await rpc('hotel_v2_admin_get_property_workspace', { p_hotel_id: HOTEL });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

function reviewedPlan(state, { staleUpper = false } = {}) {
  const upperVersion = version(state.room_types, UPPER);
  const groundVersion = version(state.room_types, GROUND);
  return {
    hotel_id: HOTEL,
    expected_property_updated_at: state.property.updated_at,
    expected_property_policy: {
      children_policy: state.property.children_policy,
      minimum_child_age: state.property.minimum_child_age,
    },
    reviewed_at: new Date().toISOString(),
    source_contract: 'seven_arches_two_apartments_v1',
    expected_legacy_pricing_fingerprint:
      state.legacy_shadow_preview.legacy_pricing_fingerprint,
    expected_versions: {
      upper_room: upperVersion,
      ground_room: groundVersion,
      pricing_schedule: version(state.pricing_schedules, SCHEDULE),
      property_party_preview: version(state.pricing_schedules, PARTY_PREVIEW),
      rate_plan: version(state.rate_plans, PLAN),
      upper_room_rate: version(state.room_rates, UPPER_RATE),
      ground_room_rate: version(state.room_rates, GROUND_RATE),
    },
    property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
    rooms: [{
      id: UPPER,
      expected_version: staleUpper ? upperVersion + 1 : upperVersion,
      source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: {
        pl: 'Apartament na piętrze', en: 'Upper Floor Apartment',
        he: 'דירה בקומה העליונה',
      },
      description_i18n: {},
      gallery: [state.property.photos[0], state.property.photos[1]],
      amenities: ['air_conditioning', 'terrace', 'balcony'],
      max_occupancy: 4,
      sort_order: 100,
    }, {
      id: GROUND,
      expected_version: groundVersion,
      source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: {
        pl: 'Apartament na parterze', en: 'Ground Floor Apartment',
        he: 'דירה בקומת הקרקע',
      },
      description_i18n: {},
      gallery: [state.property.photos[2], state.property.photos[3]],
      amenities: ['air_conditioning', 'terrace'],
      max_occupancy: 4,
      sort_order: 200,
    }],
    prepare_pricing_preview: true,
  };
}

function mutationSnapshot(state) {
  return {
    property: {
      updated_at: state.property.updated_at,
      children_policy: state.property.children_policy,
      minimum_child_age: state.property.minimum_child_age,
    },
    rooms: state.room_types,
    ratePlans: state.rate_plans,
    roomRates: state.room_rates,
    schedules: state.pricing_schedules,
    tiers: state.pricing_schedule_tiers,
    activity: state.recent_activity,
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
  assert.equal(state.room_types.length, 2);
  assert.equal(state.room_types.filter((room) => room.status === 'active').length, 2);
  assert.equal(state.rate_plans.length, 1);
  assert.equal(state.rate_plans[0].is_active, false);
  assert.equal(state.room_rates.length, 2);
  assert.equal(state.room_rates.every((rate) => rate.is_active === false), true);
  assert.equal(state.pricing_schedules.length, 2);
  assert.equal(state.pricing_schedules.every((schedule) => schedule.is_active === false), true);
  assert.equal(state.pricing_schedule_tiers.length, 90);
}

const before = await workspace();
assert.equal(before.property.children_policy, 'minimum_age');
assert.equal(before.property.minimum_child_age, 15);
assert.equal(before.property.photos.length, 9);
assert.deepEqual(
  before.room_types.map((room) => ({
    id: room.id, version: Number(room.version), status: room.status, gallery: room.gallery,
  })),
  [
    { id: UPPER, version: 4, status: 'active', gallery: [] },
    { id: GROUND, version: 5, status: 'active', gallery: [] },
  ],
);
assertInert(before);

const rawBefore = await request('/hotel_room_types?select=id,status&limit=5');
assert.equal(rawBefore.status, 401);

const first = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: reviewedPlan(before),
  p_correlation_id: FIRST_CORRELATION,
});
assert.equal(first.status, 200, JSON.stringify(first.payload));
assert.equal(first.payload.public_change, false);

const afterFirst = first.payload.workspace;
assert.equal(afterFirst.property.children_policy, 'minimum_age');
assert.equal(afterFirst.property.minimum_child_age, 10);
assert.equal(afterFirst.property.photos.length, 9);
assert.deepEqual(
  afterFirst.room_types.map((room) => ({
    id: room.id, version: Number(room.version), status: room.status, gallery: room.gallery,
  })),
  [
    {
      id: UPPER, version: 5, status: 'active',
      gallery: [afterFirst.property.photos[0], afterFirst.property.photos[1]],
    },
    {
      id: GROUND, version: 6, status: 'active',
      gallery: [afterFirst.property.photos[2], afterFirst.property.photos[3]],
    },
  ],
);
assertInert(afterFirst);

const stale = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: reviewedPlan(afterFirst, { staleUpper: true }),
  p_correlation_id: STALE_CORRELATION,
});
assert.equal(stale.status, 409);
assert.equal(stale.payload?.code, 'PT409');
assert.equal(stale.payload?.message, 'hotels_v2_h2b1_room_expected_version_mismatch');
const afterStale = await workspace();
assert.deepEqual(mutationSnapshot(afterStale), mutationSnapshot(afterFirst));
assert.equal(
  afterStale.recent_activity.some((row) => row.correlation_id === STALE_CORRELATION),
  false,
);

const foreignPhotoPlan = reviewedPlan(afterStale);
foreignPhotoPlan.rooms[0].gallery[0] = 'https://foreign.invalid/not-in-property-gallery.webp';
const foreignPhoto = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: foreignPhotoPlan,
  p_correlation_id: FOREIGN_PHOTO_CORRELATION,
});
assert.equal(foreignPhoto.status, 400);
assert.equal(foreignPhoto.payload?.code, '23514');
assert.equal(
  foreignPhoto.payload?.message,
  'hotels_v2_h2b1_room_photo_not_in_property_gallery',
);
const afterForeignPhoto = await workspace();
assert.deepEqual(mutationSnapshot(afterForeignPhoto), mutationSnapshot(afterFirst));
assert.equal(
  afterForeignPhoto.recent_activity.some(
    (row) => row.correlation_id === FOREIGN_PHOTO_CORRELATION,
  ),
  false,
);

const stalePolicyPlan = reviewedPlan(afterForeignPhoto);
stalePolicyPlan.expected_property_policy.minimum_child_age = 15;
const stalePolicy = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: stalePolicyPlan,
  p_correlation_id: STALE_POLICY_CORRELATION,
});
assert.equal(stalePolicy.status, 409);
assert.equal(stalePolicy.payload?.code, 'PT409');
assert.equal(stalePolicy.payload?.message, 'hotels_v2_h2b1_stale_property_policy');
const afterStalePolicy = await workspace();
assert.deepEqual(mutationSnapshot(afterStalePolicy), mutationSnapshot(afterFirst));
assert.equal(
  afterStalePolicy.recent_activity.some(
    (row) => row.correlation_id === STALE_POLICY_CORRELATION,
  ),
  false,
);

const second = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: reviewedPlan(afterStalePolicy),
  p_correlation_id: SECOND_CORRELATION,
});
assert.equal(second.status, 200, JSON.stringify(second.payload));
assert.equal(second.payload.public_change, false);
assertInert(second.payload.workspace);
assert.equal(second.payload.workspace.room_types.length, 2);
assert.deepEqual(
  second.payload.workspace.room_types.map((room) => room.gallery),
  [
    [second.payload.workspace.property.photos[0], second.payload.workspace.property.photos[1]],
    [second.payload.workspace.property.photos[2], second.payload.workspace.property.photos[3]],
  ],
);

const rawAfter = await request('/hotel_room_types?select=id,status&limit=5');
assert.equal(rawAfter.status, 401);

process.stdout.write(`${JSON.stringify({
  initial: {
    propertyMinimumChildAge: before.property.minimum_child_age,
    roomVersions: before.room_types.map((room) => Number(room.version)),
    roomStatuses: before.room_types.map((room) => room.status),
    emptyGalleryCount: before.room_types.filter((room) => room.gallery.length === 0).length,
    existingDormantGraph: {
      ratePlans: before.rate_plans.length,
      roomRates: before.room_rates.length,
      schedules: before.pricing_schedules.length,
      tiers: before.pricing_schedule_tiers.length,
    },
  },
  firstReviewedSave: {
    status: first.status,
    publicChange: first.payload.public_change,
    propertyMinimumChildAge: afterFirst.property.minimum_child_age,
    roomVersions: afterFirst.room_types.map((room) => Number(room.version)),
    roomStatuses: afterFirst.room_types.map((room) => room.status),
    roomGalleryCounts: afterFirst.room_types.map((room) => room.gallery.length),
  },
  staleRollback: {
    status: stale.status,
    code: stale.payload.code,
    message: stale.payload.message,
    unchanged: true,
  },
  foreignPhotoRollback: {
    status: foreignPhoto.status,
    code: foreignPhoto.payload.code,
    message: foreignPhoto.payload.message,
    unchanged: true,
  },
  stalePolicyRollback: {
    status: stalePolicy.status,
    code: stalePolicy.payload.code,
    message: stalePolicy.payload.message,
    unchanged: true,
  },
  idempotentReviewedSave: {
    status: second.status,
    exactRoomCount: second.payload.workspace.room_types.length,
    roomStatuses: second.payload.workspace.room_types.map((room) => room.status),
    galleryCounts: second.payload.workspace.room_types.map((room) => room.gallery.length),
  },
  publicInertness: {
    rawBeforeStatus: rawBefore.status,
    rawAfterStatus: rawAfter.status,
    architecture: second.payload.workspace.property.architecture_version,
    flagsOff: Object.values(second.payload.workspace.feature_flags).every((value) => value === false),
    activeRoomCount: second.payload.workspace.room_types.filter((room) => room.status === 'active').length,
    draftRoomCount: second.payload.workspace.room_types.filter((room) => room.status === 'draft').length,
  },
  hotels_v2_h2b1_reviewed_save_postgrest_safe: true,
}, null, 2)}\n`);
