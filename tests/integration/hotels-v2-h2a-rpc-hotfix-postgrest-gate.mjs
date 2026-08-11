import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H2A_HOTFIX_POSTGREST_URL
  || 'http://127.0.0.1:53007';
const parsedUrl = new URL(POSTGREST_URL);

assert.ok(
  ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Hotels H2A hotfix gate refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`,
);
assert.equal(parsedUrl.protocol, 'http:', 'Hotels H2A hotfix gate accepts local HTTP only.');

const PROPERTY_A = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PROPERTY_B = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
const OPERATIONAL_PARTNER = '20000000-0000-4000-8000-000000000001';
const EXPECTED_PROPERTY_IDS = [PROPERTY_A, PROPERTY_B].sort();

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
    [401, 403].includes(result.status),
    `${label} expected HTTP 401/403, received ${result.status}: ${JSON.stringify(result.payload)}`,
  );
}

const summary = {
  environment: { postgrestUrl: POSTGREST_URL, loopbackOnly: true },
  admin: {},
  denied: {},
};

const directoryResult = await rpc('hotel_v2_admin_get_property_list', TOKENS.admin);
assert.equal(
  directoryResult.status,
  200,
  `Admin property directory failed: ${JSON.stringify(directoryResult.payload)}`,
);
assert.ok(Array.isArray(directoryResult.payload), 'Property directory must return one JSON array.');
assert.equal(directoryResult.payload.length, 2, 'Property directory must return exactly two properties.');
assert.deepEqual(
  directoryResult.payload.map((property) => property.id).sort(),
  EXPECTED_PROPERTY_IDS,
  'Property directory returned the wrong exact property IDs.',
);
assert.equal(
  directoryResult.payload.filter((property) => property.is_published === true).length,
  1,
  'Exactly one fixture property must be published.',
);

const propertyA = directoryResult.payload.find((property) => property.id === PROPERTY_A);
const propertyB = directoryResult.payload.find((property) => property.id === PROPERTY_B);
assert.equal(propertyA.slug, '7-ukow');
assert.equal(propertyB.slug, 'rgb-cabins-larnaka-centrum');
assert.equal(propertyA.operational_partner_count, 1);
assert.equal(propertyB.operational_partner_count, 0);

const workspaces = {};
for (const propertyId of EXPECTED_PROPERTY_IDS) {
  const result = await rpc(
    'hotel_v2_admin_get_property_workspace',
    TOKENS.admin,
    { p_hotel_id: propertyId },
  );
  assert.equal(
    result.status,
    200,
    `Admin workspace ${propertyId} failed: ${JSON.stringify(result.payload)}`,
  );
  assert.equal(result.payload?.property?.id, propertyId);
  assert.equal(result.payload?.property?.architecture_version, 'legacy');
  assert.deepEqual(result.payload?.feature_flags, {
    hotel_rooms_v2_enabled: false,
    hotel_external_sync_enabled: false,
    hotel_instant_booking_enabled: false,
    hotel_stripe_connect_enabled: false,
  });
  workspaces[propertyId] = result.payload;
}

assert.equal(workspaces[PROPERTY_A].operational_partners.length, 1);
assert.equal(workspaces[PROPERTY_A].operational_partners[0].is_active, true);
assert.equal(workspaces[PROPERTY_B].operational_partners.length, 0);

const exactPartnerIdentity = await rpc(
  'is_partner_user',
  TOKENS.partner,
  { p_partner_id: OPERATIONAL_PARTNER },
);
const nonAdminPartnerIdentity = await rpc(
  'is_partner_user',
  TOKENS.nonAdmin,
  { p_partner_id: OPERATIONAL_PARTNER },
);
assert.equal(exactPartnerIdentity.status, 200);
assert.equal(exactPartnerIdentity.payload, true, 'Partner fixture JWT must map to the exact operational partner.');
assert.equal(nonAdminPartnerIdentity.status, 200);
assert.equal(nonAdminPartnerIdentity.payload, false, 'Ordinary authenticated fixture must not map to the partner.');

for (const [role, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['exact partner', TOKENS.partner],
]) {
  const deniedDirectory = await rpc('hotel_v2_admin_get_property_list', token);
  const deniedWorkspace = await rpc(
    'hotel_v2_admin_get_property_workspace',
    token,
    { p_hotel_id: PROPERTY_A },
  );
  assertDenied(deniedDirectory, `${role} property directory`);
  assertDenied(deniedWorkspace, `${role} Property Workspace`);
  summary.denied[role] = {
    directoryStatus: deniedDirectory.status,
    workspaceStatus: deniedWorkspace.status,
  };
}

summary.admin = {
  directoryStatus: directoryResult.status,
  propertyCount: directoryResult.payload.length,
  publishedCount: directoryResult.payload.filter((property) => property.is_published).length,
  propertyIds: EXPECTED_PROPERTY_IDS,
  workspaceStatuses: Object.fromEntries(EXPECTED_PROPERTY_IDS.map((id) => [id, 200])),
  operationalPartnerCounts: {
    [PROPERTY_A]: propertyA.operational_partner_count,
    [PROPERTY_B]: propertyB.operational_partner_count,
  },
  exactPartnerIdentity: exactPartnerIdentity.payload,
};
summary.hotels_v2_h2a_property_directory_postgrest_safe = true;

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
