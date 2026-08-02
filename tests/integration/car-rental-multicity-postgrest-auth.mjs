import crypto from 'node:crypto';

export const JWT_SECRET = 'stage2c-local-jwt-secret-do-not-use-outside-tests-20260802';
export const ADMIN_USER_ID = 'ca2c0000-0000-4000-8000-000000000001';
export const NON_ADMIN_USER_ID = 'ca2c0000-0000-4000-8000-000000000002';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createTestJwt(claims) {
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
  nonAdmin: createTestJwt({
    role: 'authenticated',
    sub: NON_ADMIN_USER_ID,
    user_metadata: { is_admin: false },
  }),
  admin: createTestJwt({
    role: 'authenticated',
    sub: ADMIN_USER_ID,
    user_metadata: { is_admin: true },
  }),
  service: createTestJwt({ role: 'service_role', sub: ADMIN_USER_ID }),
});
