import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Hotels V2 H2B local PostgREST gate', () => {
  const base = read('tests/integration/hotels-v2-h2b-postgrest-base.sql');
  const gate = read('tests/integration/hotels-v2-h2b-postgrest-gate.mjs');

  test('is loopback-only and applies the exact H2B migration over the H2A fixture', () => {
    expect(base).toContain('hotels-v2-h2a-rpc-hotfix-postgrest-base.sql');
    expect(base).toContain('20260811230000_hotels_v2_h2b_calendar_rates_foundation.sql');
    expect(gate).toContain("['127.0.0.1', 'localhost', '::1']");
    expect(gate).toContain("assert.equal(parsedUrl.protocol, 'http:'");
  });

  test('covers Admin calendar/resolve/apply and all denied actor classes', () => {
    expect(gate).toContain("rpc('hotel_v2_admin_get_calendar'");
    expect(gate).toContain("rpc('hotel_v2_admin_resolve_rate'");
    expect(gate).toContain("rpc('hotel_v2_admin_apply_calendar_plan'");
    expect(gate).toContain("['anon', TOKENS.anon]");
    expect(gate).toContain("['non-admin', TOKENS.nonAdmin]");
    expect(gate).toContain("['partner', TOKENS.partner]");
    expect(gate).toContain('hotels_v2_h2b_postgrest_safe');
  });

  test('guards exact legacy properties and disabled capability flags', () => {
    expect(gate).toContain('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
    expect(gate).toContain('f9fbaa61-fdce-4418-8579-ddb2b0a75fb1');
    expect(gate).toContain("architecture_version === 'legacy'");
    expect(gate).toContain('flagsOff');
    expect(gate).toContain('Legacy property changed');
  });
});
