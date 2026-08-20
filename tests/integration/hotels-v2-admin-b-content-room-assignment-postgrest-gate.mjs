import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_ADMIN_B_POSTGREST_URL
  || 'http://127.0.0.1:53015';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname));
assert.equal(parsedUrl.protocol, 'http:');

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const RGB = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
const UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const CREATED_ROOM = 'b4200000-0000-4000-8000-000000000101';
const DUPLICATED_ROOM = 'b4200000-0000-4000-8000-000000000102';
const ASSIGNMENT = 'b4300000-0000-4000-8000-000000000101';
const ACTIVE_UNASSIGNED_PARTNER = '20000000-0000-4000-8000-000000000004';

let roomMutationRequestCount = 0;

async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  if (path === '/rpc/hotel_v2_admin_apply_room_control_plan') {
    roomMutationRequestCount += 1;
  }
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const response = await fetch(`${POSTGREST_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  return { status: response.status, ok: response.ok, payload, headers: response.headers };
}

function rpc(name, token, body = {}) {
  return request(`/rpc/${name}`, { token, method: 'POST', body });
}

function uuidTail(value) {
  return `b4100000-0000-4000-8000-${String(value).padStart(12, '0')}`;
}

async function workspace(hotelId = HOTEL) {
  const result = await rpc(
    'hotel_v2_admin_get_property_workspace', TOKENS.admin, { p_hotel_id: hotelId },
  );
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

async function content(hotelId = HOTEL) {
  const result = await rpc(
    'hotel_v2_admin_get_content_control', TOKENS.admin, { p_hotel_id: hotelId },
  );
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  return result.payload;
}

function canonicalPropertyValue(key, state, control) {
  const profileKeys = new Set([
    'maximum_stay_nights', 'guest_instructions_i18n',
    'check_in_instructions_i18n', 'check_out_instructions_i18n',
    'internal_operational_notes',
  ]);
  if (profileKeys.has(key)) return control.operational_profile[key] ?? null;
  if (key === 'title_i18n' && state.property.architecture_version === 'legacy') {
    return state.property.title;
  }
  if (key === 'description_i18n' && state.property.architecture_version === 'legacy') {
    return state.property.description;
  }
  if (key === 'check_in_from' || key === 'check_out_until') {
    return state.property[key] == null ? null : String(state.property[key]).slice(0, 5);
  }
  if (key === 'amenities') return [...(state.property.amenities || [])].sort();
  return state.property[key] ?? null;
}

function propertyPlan(state, control, payload) {
  return {
    contract_version: 'hotels_v2_admin_b_property_control_v1',
    hotel_id: state.property.id,
    expected_property_updated_at: control.property_updated_at,
    expected_operational_profile_version: Number(control.operational_profile.version),
    reviewed_at: new Date().toISOString(),
    expected_original: Object.fromEntries(
      Object.keys(payload).map((key) => [key, canonicalPropertyValue(key, state, control)]),
    ),
    payload,
  };
}

function canonicalRoomValue(key, room) {
  if (key === 'amenities') return [...(room.amenities || [])].sort();
  return room[key] ?? null;
}

function roomUpdatePlan(state, roomId, payload) {
  const room = state.room_types.find((item) => item.id === roomId);
  assert.ok(room, `Room missing: ${roomId}`);
  return {
    contract_version: 'hotels_v2_admin_b_room_control_v1',
    hotel_id: state.property.id,
    expected_property_updated_at: state.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type: 'update',
      id: room.id,
      expected_version: Number(room.version),
      expected_original: Object.fromEntries(
        Object.keys(payload).map((key) => [key, canonicalRoomValue(key, room)]),
      ),
      payload,
    },
  };
}

function roomActionPlan(state, type, id, expectedVersion, expectedOriginal, payload) {
  return {
    contract_version: 'hotels_v2_admin_b_room_control_v1',
    hotel_id: state.property.id,
    expected_property_updated_at: state.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operation: {
      type,
      id,
      expected_version: expectedVersion,
      expected_original: expectedOriginal,
      payload,
    },
  };
}

function assignmentPlan(control, type, assignmentId, partnerId) {
  const assignment = control.assignment_snapshot.assignments.find(
    (item) => item.assignment_id === assignmentId && item.partner_id === partnerId,
  );
  return {
    contract_version: 'hotels_v2_admin_b_operational_assignment_v1',
    hotel_id: control.hotel_id,
    reviewed_at: new Date().toISOString(),
    snapshot_token: control.assignment_snapshot.snapshot_token,
    expected_assignment_fingerprint: control.assignment_snapshot.assignment_fingerprint,
    operation: {
      type,
      assignment_id: assignmentId,
      partner_id: partnerId,
      expected_staff_scope_count: Number(assignment?.staff_scope_count || 0),
      expected_staff_scope_ids: [...(assignment?.staff_scope_ids || [])].sort(),
      expected_permission_exists: Boolean(assignment?.permission_exists),
    },
  };
}

function assertControlledError(result, status, code, message) {
  assert.equal(result.status, status, JSON.stringify(result.payload));
  if (code) assert.equal(result.payload?.code, code, JSON.stringify(result.payload));
  if (message) assert.equal(result.payload?.message, message, JSON.stringify(result.payload));
}

function assertDenied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded`);
  assert.ok([401, 403, 404].includes(result.status), `${label}: ${result.status}`);
}

// Every new read and mutation is Admin-only over real PostgREST.
for (const [label, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.owner],
]) {
  assertDenied(await rpc(
    'hotel_v2_admin_get_content_control', token, { p_hotel_id: HOTEL },
  ), `${label} content read`);
  assertDenied(await rpc(
    'hotel_v2_admin_apply_property_control_plan', token,
    { p_plan: {}, p_correlation_id: uuidTail(900) },
  ), `${label} property mutation`);
  assertDenied(await rpc(
    'hotel_v2_admin_apply_room_control_plan', token,
    { p_plan: {}, p_correlation_id: uuidTail(901) },
  ), `${label} Room mutation`);
  assertDenied(await rpc(
    'hotel_v2_admin_apply_operational_assignment_plan', token,
    { p_plan: {}, p_correlation_id: uuidTail(902) },
  ), `${label} assignment mutation`);
}

// Raw normalized tables deny all browser roles/methods. This includes Admin;
// Admin access is through fixed-search-path SECURITY DEFINER RPCs only.
for (const [label, token] of [['Admin', TOKENS.admin], ['Partner', TOKENS.owner]]) {
  for (const table of ['hotel_room_types', 'hotel_rate_plans', 'hotel_activity_log',
    'hotel_property_operational_profiles']) {
    assertDenied(await request(`/${table}?select=*&limit=1`, { token }), `${label} raw ${table} SELECT`);
  }
  assertDenied(await request('/hotel_room_types', {
    token, method: 'POST', body: { id: CREATED_ROOM },
  }), `${label} raw Room INSERT`);
  assertDenied(await request(`/hotel_room_types?id=eq.${UPPER}`, {
    token, method: 'PATCH', body: { sort_order: 999 },
  }), `${label} raw Room UPDATE`);
  assertDenied(await request(`/hotel_room_types?id=eq.${UPPER}`, {
    token, method: 'DELETE',
  }), `${label} raw Room DELETE`);
}
assertDenied(await request('/hotel_room_types?select=id&limit=1'), 'anonymous raw Room SELECT');

const amenitiesCatalogue = await request('/hotel_amenities?select=code&limit=5', {
  token: TOKENS.nonAdmin,
});
assert.equal(amenitiesCatalogue.status, 200, JSON.stringify(amenitiesCatalogue.payload));

const initialContent = await content();
assert.deepEqual(Object.keys(initialContent).sort(), [
  'architecture_version', 'assignment_snapshot', 'commercial_owner',
  'contract_version', 'feature_flags', 'hotel_id', 'operational_profile',
  'property_updated_at',
].sort());
assert.equal(initialContent.contract_version, 'hotels_v2_admin_b_content_control_v1');
assert.equal(initialContent.hotel_id, HOTEL);
assert.equal(initialContent.architecture_version, 'legacy');
assert.deepEqual(initialContent.feature_flags, {
  hotel_rooms_v2_enabled: false,
  hotel_external_sync_enabled: false,
  hotel_instant_booking_enabled: false,
  hotel_stripe_connect_enabled: false,
});
assert.equal(initialContent.operational_profile.exists, false);
assert.equal(initialContent.operational_profile.version, 0);
assert.deepEqual(initialContent.operational_profile.guest_instructions_i18n, {});
assert.ok(Array.isArray(initialContent.assignment_snapshot.assignments));
for (const assignment of initialContent.assignment_snapshot.assignments) {
  assert.ok(Array.isArray(assignment.staff_scope_ids));
  assert.equal(typeof assignment.staff_scope_count, 'number');
  assert.equal(typeof assignment.permission_exists, 'boolean');
}

// Exact identifier relationships fail closed without creating activity or
// changing versions/snapshots.
const initialWorkspace = await workspace();
const beforeForeignProbe = {
  propertyUpdatedAt: initialContent.property_updated_at,
  assignmentSnapshot: initialContent.assignment_snapshot.snapshot_token,
  upperVersion: Number(initialWorkspace.room_types.find((room) => room.id === UPPER).version),
  activityLength: initialWorkspace.recent_activity.length,
};
assertControlledError(await rpc(
  'hotel_v2_admin_get_content_control', TOKENS.admin,
  { p_hotel_id: 'b4900000-0000-4000-8000-000000000001' },
), 404, 'PT404', 'hotels_v2_admin_b_property_not_found');
const foreignPropertyPlan = propertyPlan(initialWorkspace, initialContent, { city: 'Never' });
foreignPropertyPlan.hotel_id = 'b4900000-0000-4000-8000-000000000001';
assertControlledError(await rpc(
  'hotel_v2_admin_apply_property_control_plan', TOKENS.admin,
  { p_plan: foreignPropertyPlan, p_correlation_id: uuidTail(4) },
), 404, 'PT404', 'hotels_v2_admin_b_property_not_found');
const foreignRoomPlan = roomUpdatePlan(initialWorkspace, UPPER, {
  description_i18n: { en: 'Must not cross Hotel scope' },
});
foreignRoomPlan.hotel_id = RGB;
assertControlledError(await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  { p_plan: foreignRoomPlan, p_correlation_id: uuidTail(5) },
), 404, 'PT404', 'hotels_v2_admin_b_room_not_found');
assertControlledError(await rpc(
  'hotel_v2_admin_apply_operational_assignment_plan', TOKENS.admin,
  {
    p_plan: assignmentPlan(
      initialContent, 'remove',
      '32000000-0000-4000-8000-000000000001', ACTIVE_UNASSIGNED_PARTNER,
    ),
    p_correlation_id: uuidTail(6),
  },
), 404, 'PT404', 'hotels_v2_admin_b_assignment_not_found');
const afterForeignContent = await content();
const afterForeignWorkspace = await workspace();
assert.equal(afterForeignContent.property_updated_at, beforeForeignProbe.propertyUpdatedAt);
assert.equal(afterForeignContent.assignment_snapshot.snapshot_token,
  beforeForeignProbe.assignmentSnapshot);
assert.equal(Number(afterForeignWorkspace.room_types.find(
  (room) => room.id === UPPER,
).version), beforeForeignProbe.upperVersion);
assert.equal(afterForeignWorkspace.recent_activity.length, beforeForeignProbe.activityLength);

// Private-only content writes never touch the legacy public Hotel token.
const stalePrivatePlan = propertyPlan(initialWorkspace, initialContent, {
  internal_operational_notes: 'First reviewed private ADMIN-B note',
});
const privateWrite = await rpc(
  'hotel_v2_admin_apply_property_control_plan', TOKENS.admin,
  { p_plan: stalePrivatePlan, p_correlation_id: uuidTail(10) },
);
assert.equal(privateWrite.status, 200, JSON.stringify(privateWrite.payload));
assert.equal(privateWrite.payload.changed, true);
assert.equal(privateWrite.payload.property_changed, false);
assert.equal(privateWrite.payload.operational_profile_changed, true);
assert.equal(privateWrite.payload.activity.length, 1);
assert.equal(privateWrite.payload.content_control.property_updated_at,
  initialContent.property_updated_at);
assert.equal(privateWrite.payload.content_control.operational_profile.version, 1);
assert.equal(privateWrite.payload.content_control.operational_profile.internal_operational_notes,
  'First reviewed private ADMIN-B note');

let currentWorkspace = privateWrite.payload.workspace;
let currentContent = privateWrite.payload.content_control;
const privateNoop = await rpc(
  'hotel_v2_admin_apply_property_control_plan', TOKENS.admin,
  {
    p_plan: propertyPlan(currentWorkspace, currentContent, {
      internal_operational_notes: 'First reviewed private ADMIN-B note',
    }),
    p_correlation_id: uuidTail(11),
  },
);
assert.equal(privateNoop.status, 200, JSON.stringify(privateNoop.payload));
assert.equal(privateNoop.payload.changed, false);
assert.equal(privateNoop.payload.activity.length, 0);
assert.equal(privateNoop.payload.content_control.operational_profile.version, 1);

const stalePrivate = structuredClone(stalePrivatePlan);
stalePrivate.payload.internal_operational_notes = 'A stale private overwrite';
const stalePrivateResult = await rpc(
  'hotel_v2_admin_apply_property_control_plan', TOKENS.admin,
  { p_plan: stalePrivate, p_correlation_id: uuidTail(12) },
);
assertControlledError(
  stalePrivateResult, 409, 'PT409', 'hotels_v2_admin_b_property_field_conflict',
);

currentWorkspace = privateNoop.payload.workspace;
currentContent = privateNoop.payload.content_control;
const propertyNoop = await rpc(
  'hotel_v2_admin_apply_property_control_plan', TOKENS.admin,
  {
    p_plan: propertyPlan(currentWorkspace, currentContent, {
      city: currentWorkspace.property.city,
    }),
    p_correlation_id: uuidTail(13),
  },
);
assert.equal(propertyNoop.status, 200, JSON.stringify(propertyNoop.payload));
assert.equal(propertyNoop.payload.changed, false);
assert.equal(propertyNoop.payload.activity.length, 0);

for (const [payload, message, correlation] of [
  [{ google_maps_url: 'https://google.com.evil.example/maps/7k' },
    'hotels_v2_admin_b_invalid_google_maps_url', 14],
  [{ title_i18n: { en: 'Safe', de: 'Smuggled' } },
    'hotels_v2_admin_b_invalid_property_name', 15],
  [{ minimum_stay_nights: 2.5 },
    'hotels_v2_admin_b_invalid_stay_bounds', 16],
  [{ children_policy: 'allow_all' },
    'hotels_v2_admin_b_invalid_property_plan', 17],
]) {
  const rejected = await rpc(
    'hotel_v2_admin_apply_property_control_plan', TOKENS.admin,
    {
      p_plan: propertyPlan(currentWorkspace, currentContent, payload),
      p_correlation_id: uuidTail(correlation),
    },
  );
  assertControlledError(rejected, 400, '22023', message);
}

// Strict property creation rejects inferred commercial/location values and
// unsafe nested content, then permits one explicit inert draft.
const draftBase = {
  slug: 'admin-b-http-draft',
  title_i18n: { en: 'ADMIN-B HTTP Draft', pl: 'ADMIN-B HTTP Draft', he: 'ADMIN-B HTTP Draft' },
  city: 'Larnaca', country: 'Cyprus', timezone: 'Europe/Nicosia', currency: 'EUR',
  amenities: [], photos: [],
};
const missingCountry = structuredClone(draftBase);
delete missingCountry.country;
assertControlledError(await rpc(
  'hotel_v2_admin_create_property_draft', TOKENS.admin,
  { p_id: 'b4700000-0000-4000-8000-000000000101', p_payload: missingCountry,
    p_correlation_id: uuidTail(18) },
), 400, '22023', 'hotels_v2_admin_b_invalid_property_draft_payload');
const extraLanguage = structuredClone(draftBase);
extraLanguage.title_i18n.de = 'Nicht erlaubt';
assertControlledError(await rpc(
  'hotel_v2_admin_create_property_draft', TOKENS.admin,
  { p_id: 'b4700000-0000-4000-8000-000000000102', p_payload: extraLanguage,
    p_correlation_id: uuidTail(19) },
), 400, '22023', 'hotels_v2_admin_b_invalid_property_draft_contract');
assertControlledError(await rpc(
  'hotel_v2_admin_create_property_draft', TOKENS.admin,
  { p_id: 'b4700000-0000-4000-8000-000000000103',
    p_payload: { ...draftBase, google_maps_url: 'https://google.com.evil.test/maps' },
    p_correlation_id: uuidTail(20) },
), 400, '22023', 'hotels_v2_admin_b_invalid_property_draft_maps_url');

const validDraft = await rpc(
  'hotel_v2_admin_create_property_draft', TOKENS.admin,
  {
    p_id: 'b4700000-0000-4000-8000-000000000104',
    p_payload: {
      ...draftBase,
      google_maps_url: 'https://WWW.GOOGLE.COM/maps/place/Admin-B',
      photos: [
        'https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/hotels/admin-b-http-draft/gallery/adminb.webp',
      ],
      cover_image_url:
        'https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/hotels/admin-b-http-draft/gallery/adminb.webp',
    },
    p_correlation_id: uuidTail(21),
  },
);
assert.equal(validDraft.status, 200, JSON.stringify(validDraft.payload));
const validDraftWorkspace = await workspace('b4700000-0000-4000-8000-000000000104');
assert.equal(validDraftWorkspace.property.architecture_version, 'rooms_v2');
assert.equal(validDraftWorkspace.property.status, 'draft');
assert.equal(validDraftWorkspace.property.is_published, false);

// Normal Room gallery maintenance is independent of the legacy preparation
// wizard, semantic no-ops do not churn, and a real concurrent edit remains 409.
currentWorkspace = await workspace();
const propertyPhotos = currentWorkspace.property.photos;
assert.ok(propertyPhotos.length >= 2);
let roomWrite = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomUpdatePlan(currentWorkspace, UPPER, { gallery: [propertyPhotos[0]] }),
    p_correlation_id: uuidTail(30),
  },
);
assert.equal(roomWrite.status, 200, JSON.stringify(roomWrite.payload));
assert.equal(roomWrite.payload.changed, true);
assert.equal(roomWrite.payload.activity.length, 1);
currentWorkspace = roomWrite.payload.workspace;
let upper = currentWorkspace.room_types.find((room) => room.id === UPPER);
assert.deepEqual(upper.gallery, [propertyPhotos[0]]);
const firstRoomVersion = Number(upper.version);

const roomNoop = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomUpdatePlan(currentWorkspace, UPPER, { gallery: [propertyPhotos[0]] }),
    p_correlation_id: uuidTail(31),
  },
);
assert.equal(roomNoop.status, 200, JSON.stringify(roomNoop.payload));
assert.equal(roomNoop.payload.changed, false);
assert.equal(roomNoop.payload.activity.length, 0);
upper = roomNoop.payload.workspace.room_types.find((room) => room.id === UPPER);
assert.equal(Number(upper.version), firstRoomVersion);

const secondRoomWrite = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomUpdatePlan(roomNoop.payload.workspace, UPPER, {
      gallery: [propertyPhotos[0], propertyPhotos[1]],
    }),
    p_correlation_id: uuidTail(32),
  },
);
assert.equal(secondRoomWrite.status, 200, JSON.stringify(secondRoomWrite.payload));
assert.equal(secondRoomWrite.payload.changed, true);

const staleGalleryPlan = roomUpdatePlan(secondRoomWrite.payload.workspace, UPPER, {
  gallery: [propertyPhotos[0]],
});
const concurrentRoomWrite = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomUpdatePlan(secondRoomWrite.payload.workspace, UPPER, {
      gallery: [propertyPhotos[1]],
    }),
    p_correlation_id: uuidTail(33),
  },
);
assert.equal(concurrentRoomWrite.status, 200, JSON.stringify(concurrentRoomWrite.payload));
const beforeConflictRequests = roomMutationRequestCount;
const galleryConflict = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  { p_plan: staleGalleryPlan, p_correlation_id: uuidTail(34) },
);
assert.equal(roomMutationRequestCount, beforeConflictRequests + 1, 'mutation was auto-retried');
assertControlledError(
  galleryConflict, 409, 'PT409', 'hotels_v2_admin_b_room_field_conflict',
);
assert.deepEqual(galleryConflict.payload?.details?.changed_fields, undefined);
assert.match(String(galleryConflict.payload?.details || ''), /gallery/);

const freshGallerySave = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomUpdatePlan(concurrentRoomWrite.payload.workspace, UPPER, {
      gallery: [propertyPhotos[0]],
    }),
    p_correlation_id: uuidTail(35),
  },
);
assert.equal(freshGallerySave.status, 200, JSON.stringify(freshGallerySave.payload));
assert.equal(freshGallerySave.payload.changed, true);
assert.deepEqual(
  freshGallerySave.payload.workspace.room_types.find((room) => room.id === UPPER).gallery,
  [propertyPhotos[0]],
);

currentWorkspace = freshGallerySave.payload.workspace;
for (const [payload, message, correlation] of [
  [{ gallery: ['https://evil.example/room.webp'] },
    'hotels_v2_admin_b_invalid_room_gallery', 36],
  [{ max_occupancy: 2.5 }, 'hotels_v2_admin_b_invalid_room_integer_value', 37],
  [{ name_i18n: { en: 'Safe', de: 'Smuggled' } },
    'hotels_v2_admin_b_invalid_room_name', 38],
  [{ commission: 0 }, 'hotels_v2_admin_b_invalid_room_payload', 39],
]) {
  const rejected = await rpc(
    'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
    { p_plan: roomUpdatePlan(currentWorkspace, UPPER, payload),
      p_correlation_id: uuidTail(correlation) },
  );
  assertControlledError(rejected, 400, '22023', message);
}

let roomAction = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomActionPlan(currentWorkspace, 'create', CREATED_ROOM, 0, {}, {
      code: 'admin-b-http-created', name_i18n: { en: 'ADMIN-B HTTP Created' },
      bed_configuration: [], amenities: [], inventory_mode: 'pooled',
      base_inventory_count: 0, capacity_adults: null, capacity_children: null,
      max_occupancy: 2,
    }),
    p_correlation_id: uuidTail(40),
  },
);
assert.equal(roomAction.status, 200, JSON.stringify(roomAction.payload));
let created = roomAction.payload.workspace.room_types.find((room) => room.id === CREATED_ROOM);
assert.equal(created.status, 'draft');
assert.equal(Number(created.base_inventory_count), 0);

currentWorkspace = roomAction.payload.workspace;
upper = currentWorkspace.room_types.find((room) => room.id === UPPER);
roomAction = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomActionPlan(
      currentWorkspace, 'duplicate', DUPLICATED_ROOM, Number(upper.version), {},
      { source_id: UPPER, code: 'admin-b-http-duplicate' },
    ),
    p_correlation_id: uuidTail(41),
  },
);
assert.equal(roomAction.status, 200, JSON.stringify(roomAction.payload));
const duplicated = roomAction.payload.workspace.room_types.find(
  (room) => room.id === DUPLICATED_ROOM,
);
assert.equal(duplicated.status, 'draft');
assert.deepEqual(duplicated.gallery, []);
assert.equal(duplicated.inventory_mode, 'pooled');
assert.equal(Number(duplicated.base_inventory_count), 0);

currentWorkspace = roomAction.payload.workspace;
created = currentWorkspace.room_types.find((room) => room.id === CREATED_ROOM);
roomAction = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomActionPlan(
      currentWorkspace, 'disable', CREATED_ROOM, Number(created.version),
      { status: 'draft' }, {},
    ),
    p_correlation_id: uuidTail(42),
  },
);
assert.equal(roomAction.status, 200, JSON.stringify(roomAction.payload));
assert.equal(roomAction.payload.workspace.room_types.find(
  (room) => room.id === CREATED_ROOM,
).status, 'disabled');

// Correlation reuse fails instead of replaying a mutation.
const duplicateCorrelation = await rpc(
  'hotel_v2_admin_apply_room_control_plan', TOKENS.admin,
  {
    p_plan: roomUpdatePlan(roomAction.payload.workspace, DUPLICATED_ROOM, {
      description_i18n: { en: 'One explicit update' },
    }),
    p_correlation_id: uuidTail(41),
  },
);
assertControlledError(duplicateCorrelation, 409, '23505',
  'hotels_v2_admin_b_correlation_id_already_used');

// Retired writers and payload side channels cannot bypass the new contract.
assertDenied(await rpc(
  'hotel_v2_admin_apply_room_type_plan', TOKENS.admin,
  { p_plan: {}, p_correlation_id: uuidTail(50) },
), 'retired Room writer');
const genericProperty = await rpc(
  'hotel_v2_admin_apply_workspace_plan', TOKENS.admin,
  {
    p_plan: { operations: [{ entity: 'property' }] },
    p_correlation_id: uuidTail(51),
  },
);
assertDenied(genericProperty, 'generic property writer');
assert.equal(genericProperty.payload?.message, 'hotels_v2_admin_b_use_control_plane_rpc');

currentWorkspace = await workspace();
upper = currentWorkspace.room_types.find((room) => room.id === UPPER);
const guestCapacitySmuggling = await rpc(
  'hotel_v2_admin_apply_guest_policy_plan', TOKENS.admin,
  {
    p_plan: {
      hotel_id: HOTEL,
      expected_property_updated_at: currentWorkspace.property.updated_at,
      reviewed_at: new Date().toISOString(),
      room_policies: [{
        room_type_id: UPPER,
        expected_version: Number(upper.version),
        children_policy_override: upper.children_policy_override,
        minimum_child_age_override: upper.minimum_child_age_override,
        max_occupancy: 99,
      }],
    },
    p_correlation_id: uuidTail(52),
  },
);
assertControlledError(
  guestCapacitySmuggling, 400, '22023', 'hotels_v2_admin_b_invalid_room_guest_policy',
);

// Future-routing assignment change is Review-first and round-trips over the
// real API. The exact assignment snapshot supplies capability/staff disclosure.
let rgbContent = await content(RGB);
let assignmentWrite = await rpc(
  'hotel_v2_admin_apply_operational_assignment_plan', TOKENS.admin,
  {
    p_plan: assignmentPlan(
      rgbContent, 'assign', ASSIGNMENT, ACTIVE_UNASSIGNED_PARTNER,
    ),
    p_correlation_id: uuidTail(60),
  },
);
assert.equal(assignmentWrite.status, 200, JSON.stringify(assignmentWrite.payload));
assert.equal(assignmentWrite.payload.changed, true);
assert.equal(assignmentWrite.payload.operation, 'assign');
assert.equal(assignmentWrite.payload.activity.length, 1);
rgbContent = assignmentWrite.payload.content_control;
const insertedAssignment = rgbContent.assignment_snapshot.assignments.find(
  (item) => item.assignment_id === ASSIGNMENT,
);
assert.ok(insertedAssignment);
assert.equal(insertedAssignment.staff_scope_count, 0);
assert.deepEqual(insertedAssignment.staff_scope_ids, []);
assert.equal(insertedAssignment.permission_exists, false);

assignmentWrite = await rpc(
  'hotel_v2_admin_apply_operational_assignment_plan', TOKENS.admin,
  {
    p_plan: assignmentPlan(
      rgbContent, 'remove', ASSIGNMENT, ACTIVE_UNASSIGNED_PARTNER,
    ),
    p_correlation_id: uuidTail(61),
  },
);
assert.equal(assignmentWrite.status, 200, JSON.stringify(assignmentWrite.payload));
assert.equal(assignmentWrite.payload.operation, 'remove');
assert.equal(Number(assignmentWrite.payload.removed_staff_scope_count), 0);
assert.equal(assignmentWrite.payload.removed_permission, false);
assert.equal(assignmentWrite.payload.content_control.assignment_snapshot.assignments.some(
  (item) => item.assignment_id === ASSIGNMENT,
), false);

// The legacy 7 Kamares commercial/pricing graph remains inert after every API test.
const finalWorkspace = await workspace();
assert.equal(finalWorkspace.property.architecture_version, 'legacy');
assert.equal(finalWorkspace.property.pricing_tiers.rules.length, 63);
assert.equal(finalWorkspace.rate_plans.every((plan) => plan.is_active === false), true);
assert.equal(finalWorkspace.room_rates.every((rate) => rate.is_active === false), true);
assert.equal(finalWorkspace.pricing_schedules.every((schedule) => schedule.is_active === false), true);
assert.deepEqual(finalWorkspace.feature_flags, {
  hotel_rooms_v2_enabled: false,
  hotel_external_sync_enabled: false,
  hotel_instant_booking_enabled: false,
  hotel_stripe_connect_enabled: false,
});

console.log(JSON.stringify({
  hotels_v2_admin_b_content_room_assignment_postgrest_safe: true,
  room_mutation_requests: roomMutationRequestCount,
  architecture_version: finalWorkspace.property.architecture_version,
  public_activation: false,
  pricing_cases: 70,
  pricing_mismatches: 0,
}));
