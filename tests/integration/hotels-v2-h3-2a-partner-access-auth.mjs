import crypto from 'node:crypto';

export const JWT_SECRET = 'hotels-h2a-rpc-hotfix-local-only-20260811';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createTestJwt(claims) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    aud: 'authenticated',
    iat: issuedAt,
    exp: issuedAt + 3600,
    ...claims,
  });
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export const USER_IDS = Object.freeze({
  admin: '10000000-0000-4000-8000-000000000001',
  owner: '10000000-0000-4000-8000-000000000002',
  nonAdmin: '10000000-0000-4000-8000-000000000003',
  scopedStaff: '10000000-0000-4000-8000-000000000004',
  unscopedStaff: '10000000-0000-4000-8000-000000000005',
  suspendedOwner: '10000000-0000-4000-8000-000000000006',
  unassignedOwner: '10000000-0000-4000-8000-000000000007',
  secondOwner: '10000000-0000-4000-8000-000000000008',
  disabledOwner: '10000000-0000-4000-8000-000000000009',
});

const authenticatedToken = (sub, email) => createTestJwt({
  role: 'authenticated',
  sub,
  email,
});

export const TOKENS = Object.freeze({
  anon: createTestJwt({ role: 'anon', aud: 'anon' }),
  admin: authenticatedToken(USER_IDS.admin, 'admin@example.test'),
  owner: authenticatedToken(USER_IDS.owner, 'partner@example.test'),
  nonAdmin: authenticatedToken(USER_IDS.nonAdmin, 'customer@example.test'),
  scopedStaff: authenticatedToken(USER_IDS.scopedStaff, 'scoped-staff@example.test'),
  unscopedStaff: authenticatedToken(USER_IDS.unscopedStaff, 'unscoped-staff@example.test'),
  suspendedOwner: authenticatedToken(USER_IDS.suspendedOwner, 'suspended-owner@example.test'),
  unassignedOwner: authenticatedToken(USER_IDS.unassignedOwner, 'unassigned-owner@example.test'),
  secondOwner: authenticatedToken(USER_IDS.secondOwner, 'second-owner@example.test'),
  disabledOwner: authenticatedToken(USER_IDS.disabledOwner, 'disabled-owner@example.test'),
});
