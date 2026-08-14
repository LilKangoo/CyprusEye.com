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
const CONCURRENT_ROOM_CORRELATION = '84000000-0000-4000-8000-000000000008';
const SECOND_CONCURRENT_ROOM_CORRELATION = '84000000-0000-4000-8000-000000000009';
const SECOND_STALE_CORRELATION = '84000000-0000-4000-8000-000000000010';
const FIRST_STALE_CORRELATION = '84000000-0000-4000-8000-000000000002';
const FIRST_EXPLICIT_CORRELATION = '84000000-0000-4000-8000-000000000003';
const STALE_CORRELATION = '84000000-0000-4000-8000-000000000004';
const FOREIGN_PHOTO_CORRELATION = '84000000-0000-4000-8000-000000000005';
const STALE_POLICY_CORRELATION = '84000000-0000-4000-8000-000000000006';
const SECOND_CORRELATION = '84000000-0000-4000-8000-000000000007';

let shadowPrepareRequestCount = 0;

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
  if (name === 'hotel_v2_admin_prepare_legacy_shadow_rooms') {
    shadowPrepareRequestCount += 1;
  }
  return request(`/rpc/${name}`, {
    token: TOKENS.admin,
    method: 'POST',
    body,
  });
}

function version(rows, id) {
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

async function workspace() {
  const result = await rpc('hotel_v2_admin_get_property_workspace', { p_hotel_id: HOTEL });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

function reviewedPlan(state, { galleries = null, staleUpper = false } = {}) {
  const upperVersion = version(state.room_types, UPPER);
  const groundVersion = version(state.room_types, GROUND);
  const reviewedGalleries = galleries || {
    upper: [state.property.photos[0], state.property.photos[1]],
    ground: [state.property.photos[2], state.property.photos[3]],
  };
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
      expected_original: roomOriginal(state.room_types.find((room) => room.id === UPPER)),
      source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: {
        pl: 'Apartament na piętrze', en: 'Upper Floor Apartment',
        he: 'דירה בקומה העליונה',
      },
      description_i18n: {},
      gallery: [...reviewedGalleries.upper],
      amenities: ['air_conditioning', 'terrace', 'balcony'],
      max_occupancy: 4,
      sort_order: 100,
    }, {
      id: GROUND,
      expected_version: groundVersion,
      expected_original: roomOriginal(state.room_types.find((room) => room.id === GROUND)),
      source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: {
        pl: 'Apartament na parterze', en: 'Ground Floor Apartment',
        he: 'דירה בקומת הקרקע',
      },
      description_i18n: {},
      gallery: [...reviewedGalleries.ground],
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
  assert.deepEqual(state.rate_plans[0].cancellation_policy, { type: 'non_refundable' });
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
const reviewedRatePlanBefore = structuredClone(before.rate_plans[0]);

const rawBefore = await request('/hotel_room_types?select=id,status&limit=5');
assert.equal(rawBefore.status, 401);

// Reproduce the customer-reported flow: the first reviewed Save contains one
// stale Room Type version. The browser must surface 409 and stop. A fresh
// workspace read is then merged with the Admin's still-local photo selections;
// only a second explicit Save may issue another mutation request.
const selectedGalleries = Object.freeze({
  upper: Object.freeze(before.property.photos.slice(0, 5)),
  ground: Object.freeze(before.property.photos.slice(4, 9)),
});
assert.equal(selectedGalleries.upper.length, 5);
assert.equal(selectedGalleries.ground.length, 5);

const firstReviewedPlan = reviewedPlan(before, { galleries: selectedGalleries });
const concurrentRoomEdit = await rpc('hotel_v2_admin_apply_room_type_plan', {
  p_plan: {
    hotel_id: HOTEL,
    expected_property_updated_at: before.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type: 'update',
      id: UPPER,
      expected_version: version(before.room_types, UPPER),
      // A same-value operational edit still advances the optimistic version,
      // reproducing a concurrent Admin save without changing room content.
      payload: { sort_order: 100 },
    },
  },
  p_correlation_id: CONCURRENT_ROOM_CORRELATION,
});
assert.equal(concurrentRoomEdit.status, 200, JSON.stringify(concurrentRoomEdit.payload));
const afterConcurrentRoomEdit = concurrentRoomEdit.payload.workspace;
assert.equal(version(afterConcurrentRoomEdit.room_types, UPPER), 5);
assert.equal(version(afterConcurrentRoomEdit.room_types, GROUND), 5);
assert.deepEqual(afterConcurrentRoomEdit.room_types.map((room) => room.gallery), [[], []]);

const firstStale = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: firstReviewedPlan,
  p_correlation_id: FIRST_STALE_CORRELATION,
});
assert.equal(firstStale.status, 409);
assert.equal(firstStale.payload?.code, 'PT409');
assert.equal(
  firstStale.payload?.message,
  'hotels_v2_h2b1_stale_shadow_room',
);
assert.equal(shadowPrepareRequestCount, 1, 'The stale Save was retried automatically.');

const afterFirstStale = await workspace();
assert.deepEqual(
  mutationSnapshot(afterFirstStale),
  mutationSnapshot(afterConcurrentRoomEdit),
);
assert.equal(
  afterFirstStale.recent_activity.some(
    (row) => row.correlation_id === FIRST_STALE_CORRELATION,
  ),
  false,
);
assert.deepEqual(afterFirstStale.room_types.map((room) => room.gallery), [[], []]);

const reReviewedPlan = reviewedPlan(afterFirstStale, { galleries: selectedGalleries });
assert.deepEqual(reReviewedPlan.rooms.map((room) => room.gallery), [
  [...selectedGalleries.upper],
  [...selectedGalleries.ground],
]);
assert.equal(
  shadowPrepareRequestCount,
  1,
  'Fresh read/re-review issued a mutation before the second explicit Save.',
);

// Capture the complete stale-sensitive payload delta, then prove a second
// concurrent write after the refreshed Review causes another controlled 409.
assert.equal(
  reReviewedPlan.expected_property_updated_at,
  firstReviewedPlan.expected_property_updated_at,
);
assert.deepEqual(
  reReviewedPlan.expected_property_policy,
  firstReviewedPlan.expected_property_policy,
);
assert.equal(
  reReviewedPlan.expected_legacy_pricing_fingerprint,
  firstReviewedPlan.expected_legacy_pricing_fingerprint,
);
assert.deepEqual(reReviewedPlan.expected_versions, {
  ...firstReviewedPlan.expected_versions,
  upper_room: firstReviewedPlan.expected_versions.upper_room + 1,
});
assert.deepEqual(reReviewedPlan.rooms.map((room) => room.expected_version), [5, 5]);
assert.deepEqual(reReviewedPlan.rooms.map((room) => room.expected_original.amenities), [
  ['air_conditioning', 'balcony', 'terrace'],
  ['air_conditioning', 'terrace'],
]);

const secondConcurrentRoomEdit = await rpc('hotel_v2_admin_apply_room_type_plan', {
  p_plan: {
    hotel_id: HOTEL,
    expected_property_updated_at: afterFirstStale.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type: 'update',
      id: GROUND,
      expected_version: version(afterFirstStale.room_types, GROUND),
      payload: { sort_order: 200 },
    },
  },
  p_correlation_id: SECOND_CONCURRENT_ROOM_CORRELATION,
});
assert.equal(secondConcurrentRoomEdit.status, 200, JSON.stringify(secondConcurrentRoomEdit.payload));
const afterSecondConcurrentRoomEdit = secondConcurrentRoomEdit.payload.workspace;
assert.equal(version(afterSecondConcurrentRoomEdit.room_types, UPPER), 5);
assert.equal(version(afterSecondConcurrentRoomEdit.room_types, GROUND), 6);

const secondStale = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: reReviewedPlan,
  p_correlation_id: SECOND_STALE_CORRELATION,
});
assert.equal(secondStale.status, 409);
assert.equal(secondStale.payload?.code, 'PT409');
assert.equal(secondStale.payload?.message, 'hotels_v2_h2b1_stale_shadow_room');
assert.equal(shadowPrepareRequestCount, 2, 'A second stale Save was retried automatically.');
const afterSecondStale = await workspace();
assert.deepEqual(
  mutationSnapshot(afterSecondStale),
  mutationSnapshot(afterSecondConcurrentRoomEdit),
);
assert.equal(
  afterSecondStale.recent_activity.some(
    (row) => row.correlation_id === SECOND_STALE_CORRELATION,
  ),
  false,
);

const secondReReviewedPlan = reviewedPlan(afterSecondStale, { galleries: selectedGalleries });
assert.deepEqual(secondReReviewedPlan.expected_versions, {
  ...reReviewedPlan.expected_versions,
  ground_room: reReviewedPlan.expected_versions.ground_room + 1,
});
assert.deepEqual(secondReReviewedPlan.rooms.map((room) => room.gallery), [
  [...selectedGalleries.upper],
  [...selectedGalleries.ground],
]);
assert.equal(
  shadowPrepareRequestCount,
  2,
  'Second fresh read/re-review issued a mutation before the third explicit Save.',
);

const first = await rpc('hotel_v2_admin_prepare_legacy_shadow_rooms', {
  p_plan: secondReReviewedPlan,
  p_correlation_id: FIRST_EXPLICIT_CORRELATION,
});
assert.equal(first.status, 200, JSON.stringify(first.payload));
assert.equal(first.payload.public_change, false);
assert.equal(shadowPrepareRequestCount, 3);

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
      id: UPPER, version: 6, status: 'active',
      gallery: [...selectedGalleries.upper],
    },
    {
      id: GROUND, version: 7, status: 'active',
      gallery: [...selectedGalleries.ground],
    },
  ],
);
assertInert(afterFirst);
assert.deepEqual(
  afterFirst.rate_plans[0],
  reviewedRatePlanBefore,
  'Room/photo preparation changed the existing reviewed Rate Plan.',
);

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
  p_plan: reviewedPlan(afterStalePolicy, { galleries: selectedGalleries }),
  p_correlation_id: SECOND_CORRELATION,
});
assert.equal(second.status, 200, JSON.stringify(second.payload));
assert.equal(second.payload.public_change, false);
assertInert(second.payload.workspace);
assert.equal(second.payload.workspace.room_types.length, 2);
assert.deepEqual(
  second.payload.workspace.rate_plans[0],
  reviewedRatePlanBefore,
  'Idempotent room/photo preparation changed the existing reviewed Rate Plan.',
);
assert.deepEqual(
  second.payload.workspace.room_types.map((room) => room.gallery),
  [
    [...selectedGalleries.upper],
    [...selectedGalleries.ground],
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
  staleFirstSaveThenExplicitReview: {
    firstStatus: firstStale.status,
    firstCode: firstStale.payload.code,
    firstMessage: firstStale.payload.message,
    staleReviewedVersion: firstReviewedPlan.expected_versions.upper_room,
    freshRoomVersion: version(afterFirstStale.room_types, UPPER),
    automaticRetryCount: 0,
    freshReadPreservedGalleryCounts: reReviewedPlan.rooms.map((room) => room.gallery.length),
    firstPayload: {
      expectedPropertyUpdatedAt: firstReviewedPlan.expected_property_updated_at,
      expectedPropertyPolicy: firstReviewedPlan.expected_property_policy,
      expectedVersions: firstReviewedPlan.expected_versions,
      roomExpectedVersions: firstReviewedPlan.rooms.map((room) => room.expected_version),
    },
    firstFreshPayload: {
      expectedPropertyUpdatedAt: reReviewedPlan.expected_property_updated_at,
      expectedPropertyPolicy: reReviewedPlan.expected_property_policy,
      expectedVersions: reReviewedPlan.expected_versions,
      roomExpectedVersions: reReviewedPlan.rooms.map((room) => room.expected_version),
      galleryCounts: reReviewedPlan.rooms.map((room) => room.gallery.length),
    },
    secondConcurrentStatus: secondStale.status,
    secondConcurrentCode: secondStale.payload.code,
    secondConcurrentMessage: secondStale.payload.message,
    secondFreshPayload: {
      expectedVersions: secondReReviewedPlan.expected_versions,
      roomExpectedVersions: secondReReviewedPlan.rooms.map((room) => room.expected_version),
      galleryCounts: secondReReviewedPlan.rooms.map((room) => room.gallery.length),
    },
    secondExplicitStatus: first.status,
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
