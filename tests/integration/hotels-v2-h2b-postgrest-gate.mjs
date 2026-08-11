import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H2B_POSTGREST_URL
  || 'http://127.0.0.1:53008';
const parsedUrl = new URL(POSTGREST_URL);

assert.ok(
  ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Hotels H2B gate refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`,
);
assert.equal(parsedUrl.protocol, 'http:', 'Hotels H2B gate accepts local HTTP only.');

const PROPERTY_A = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PROPERTY_B = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
const ROOM_RATE = '63000000-0000-4000-8000-000000000001';
const OVERRIDE = '66000000-0000-4000-8000-000000000001';
const CORRELATION = '60000000-0000-4000-8000-000000000001';

async function rpc(name, token, body = {}) {
  const response = await fetch(`${POSTGREST_URL}/rpc/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  return { status: response.status, ok: response.ok, payload };
}

function assertDenied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded.`);
  assert.ok(
    [401, 403, 404].includes(result.status),
    `${label} expected HTTP 401/403/404 denial, received ${result.status}: ${JSON.stringify(result.payload)}`,
  );
}

const directoryBefore = await rpc('hotel_v2_admin_get_property_list', TOKENS.admin);
assert.equal(directoryBefore.status, 200, JSON.stringify(directoryBefore.payload));
assert.equal(directoryBefore.payload.length, 2);
const legacyBefore = Object.fromEntries(directoryBefore.payload.map((row) => [row.id, {
  architecture_version: row.architecture_version,
  pricing_model: row.legacy_configuration?.pricing_model,
  pricing_tiers: row.legacy_configuration?.pricing_tiers,
  is_published: row.is_published,
}]));

const workspaceBefore = await rpc(
  'hotel_v2_admin_get_property_workspace',
  TOKENS.admin,
  { p_hotel_id: PROPERTY_A },
);
assert.equal(workspaceBefore.status, 200, JSON.stringify(workspaceBefore.payload));
assert.deepEqual(workspaceBefore.payload.feature_flags, {
  hotel_rooms_v2_enabled: false,
  hotel_external_sync_enabled: false,
  hotel_instant_booking_enabled: false,
  hotel_stripe_connect_enabled: false,
});
assert.equal(workspaceBefore.payload.property.architecture_version, 'legacy');

const calendarBefore = await rpc(
  'hotel_v2_admin_get_calendar',
  TOKENS.admin,
  { p_hotel_id: PROPERTY_A, p_start_date: '2032-06-01', p_end_date: '2032-06-03' },
);
assert.equal(calendarBefore.status, 200, JSON.stringify(calendarBefore.payload));
assert.equal(calendarBefore.payload.hotel_id, PROPERTY_A);
assert.equal(calendarBefore.payload.room_rates.length, 1);
assert.equal(calendarBefore.payload.effective_cells.length, 3);
assert.ok(calendarBefore.payload.snapshot_token);

const resolveBefore = await rpc(
  'hotel_v2_admin_resolve_rate',
  TOKENS.admin,
  {
    p_room_rate_id: ROOM_RATE,
    p_check_in: '2032-06-01',
    p_check_out: '2032-06-03',
    p_guest_count: 2,
  },
);
assert.equal(resolveBefore.status, 200, JSON.stringify(resolveBefore.payload));
assert.equal(resolveBefore.payload.ok, true);
assert.equal(resolveBefore.payload.requestable, true);
assert.equal(Number(resolveBefore.payload.total), 200);

const applyResult = await rpc(
  'hotel_v2_admin_apply_calendar_plan',
  TOKENS.admin,
  {
    p_plan: {
      hotel_id: PROPERTY_A,
      from: '2032-06-01',
      to: '2032-06-03',
      reviewed_at: new Date().toISOString(),
      snapshot_token: calendarBefore.payload.snapshot_token,
      operations: [{
        entity: 'calendar_override',
        type: 'create',
        id: OVERRIDE,
        expected_version: 0,
        payload: {
          room_rate_id: ROOM_RATE,
          stay_date: '2032-06-01',
          nightly_rate: 135,
          nightly_rate_mode: 'set',
          reason: 'Local PostgREST authoritative apply gate',
          source: 'manual',
          is_active: true,
          provenance: { fixture: 'hotels-v2-h2b-postgrest' },
        },
      }],
    },
    p_correlation_id: CORRELATION,
  },
);
assert.equal(applyResult.status, 200, JSON.stringify(applyResult.payload));
assert.equal(applyResult.payload.correlation_id, CORRELATION);
assert.equal(applyResult.payload.calendar.calendar_overrides.length, 1);

const resolveAfter = await rpc(
  'hotel_v2_admin_resolve_rate',
  TOKENS.admin,
  {
    p_room_rate_id: ROOM_RATE,
    p_check_in: '2032-06-01',
    p_check_out: '2032-06-03',
    p_guest_count: 2,
  },
);
assert.equal(resolveAfter.status, 200, JSON.stringify(resolveAfter.payload));
assert.equal(resolveAfter.payload.ok, true);
assert.equal(resolveAfter.payload.requestable, true);
assert.equal(Number(resolveAfter.payload.total), 235);
assert.equal(resolveAfter.payload.nightly_breakdown[0].source, 'exact_date_override');

const denied = {};
for (const [role, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.partner],
]) {
  const results = {
    calendar: await rpc('hotel_v2_admin_get_calendar', token, {
      p_hotel_id: PROPERTY_A,
      p_start_date: '2032-06-01',
      p_end_date: '2032-06-03',
    }),
    resolve: await rpc('hotel_v2_admin_resolve_rate', token, {
      p_room_rate_id: ROOM_RATE,
      p_check_in: '2032-06-01',
      p_check_out: '2032-06-03',
      p_guest_count: 2,
    }),
    apply: await rpc('hotel_v2_admin_apply_calendar_plan', token, {
      p_plan: {},
      p_correlation_id: '60000000-0000-4000-8000-000000000099',
    }),
  };
  for (const [operation, result] of Object.entries(results)) {
    assertDenied(result, `${role} ${operation}`);
  }
  denied[role] = Object.fromEntries(
    Object.entries(results).map(([operation, result]) => [operation, result.status]),
  );
}

const directoryAfter = await rpc('hotel_v2_admin_get_property_list', TOKENS.admin);
assert.equal(directoryAfter.status, 200, JSON.stringify(directoryAfter.payload));
assert.equal(directoryAfter.payload.length, 2);
for (const propertyId of [PROPERTY_A, PROPERTY_B]) {
  const row = directoryAfter.payload.find((property) => property.id === propertyId);
  assert.ok(row, `Missing exact legacy property ${propertyId}.`);
  assert.deepEqual({
    architecture_version: row.architecture_version,
    pricing_model: row.legacy_configuration?.pricing_model,
    pricing_tiers: row.legacy_configuration?.pricing_tiers,
    is_published: row.is_published,
  }, legacyBefore[propertyId], `Legacy property changed: ${propertyId}`);
}

const workspaceAfter = await rpc(
  'hotel_v2_admin_get_property_workspace',
  TOKENS.admin,
  { p_hotel_id: PROPERTY_A },
);
assert.equal(workspaceAfter.status, 200, JSON.stringify(workspaceAfter.payload));
assert.equal(workspaceAfter.payload.property.architecture_version, 'legacy');
assert.deepEqual(workspaceAfter.payload.feature_flags, workspaceBefore.payload.feature_flags);

const summary = {
  environment: { postgrestUrl: POSTGREST_URL, loopbackOnly: true },
  admin: {
    calendarStatus: calendarBefore.status,
    resolveBeforeStatus: resolveBefore.status,
    applyStatus: applyResult.status,
    resolveAfterStatus: resolveAfter.status,
    propertyCount: directoryAfter.payload.length,
    legacyPropertyCount: directoryAfter.payload.filter(
      (property) => property.architecture_version === 'legacy',
    ).length,
    flagsOff: Object.values(workspaceAfter.payload.feature_flags).every((value) => value === false),
    baseTotalBefore: Number(resolveBefore.payload.total),
    authoritativeTotalAfter: Number(resolveAfter.payload.total),
    overrideCount: applyResult.payload.calendar.calendar_overrides.length,
  },
  denied,
  legacy: {
    exactPropertyIds: [PROPERTY_A, PROPERTY_B],
    unchanged: true,
  },
  hotels_v2_h2b_postgrest_safe: true,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

