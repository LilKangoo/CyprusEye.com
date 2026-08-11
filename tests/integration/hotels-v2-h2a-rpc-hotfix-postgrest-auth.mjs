import crypto from 'node:crypto';

export const JWT_SECRET = 'hotels-h2a-rpc-hotfix-local-only-20260811';

const ADMIN_USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTNER_USER_ID = '10000000-0000-4000-8000-000000000002';
const NON_ADMIN_USER_ID = '10000000-0000-4000-8000-000000000003';

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

export const TOKENS = Object.freeze({
  anon: createTestJwt({ role: 'anon', aud: 'anon' }),
  admin: createTestJwt({
    role: 'authenticated',
    sub: ADMIN_USER_ID,
    email: 'admin@example.test',
  }),
  partner: createTestJwt({
    role: 'authenticated',
    sub: PARTNER_USER_ID,
    email: 'partner@example.test',
  }),
  nonAdmin: createTestJwt({
    role: 'authenticated',
    sub: NON_ADMIN_USER_ID,
    email: 'customer@example.test',
  }),
});

