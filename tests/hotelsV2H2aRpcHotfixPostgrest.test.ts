import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Hotels V2 H2A property-directory hotfix real PostgREST gate', () => {
  const config = read('tests/integration/hotels-v2-h2a-rpc-hotfix-postgrest.conf');
  const fixture = read('tests/integration/hotels-v2-h2a-rpc-hotfix-postgrest-base.sql');
  const gate = read('tests/integration/hotels-v2-h2a-rpc-hotfix-postgrest-gate.mjs');
  const repair = read(
    'supabase/migrations/20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql',
  );

  test('is strictly loopback and applies the exact H2A repair after H1A/H2A', () => {
    expect(config).toContain('127.0.0.1:55437/hotels_v2_h2a_hotfix');
    expect(config).toContain('server-host = "127.0.0.1"');
    expect(config).toContain('server-port = 53007');
    expect(`${config}\n${fixture}\n${gate}`).not.toMatch(/https:\/\/[^\s"']+\.supabase\.co/i);
    expect(fixture).toContain('20260811170000_hotels_v2_h1a_core.sql');
    expect(fixture).toContain('20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql');
    expect(fixture).toContain('20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql');
  });

  test('models the exact production partner_resources existence contract', () => {
    expect(fixture).toContain("'id', 'partner_id', 'resource_type', 'resource_id', 'created_at'");
    expect(fixture).not.toMatch(/insert\s+into\s+public\.partner_resources[^;]*is_active/i);
    expect(repair).toContain('hotels_v2_h2a_property_directory_invalid_column_reference_remains');
    expect(repair).toContain("'is_active', true");
    expect(repair).not.toMatch(/alter\s+table\s+public\.partner_resources/i);
  });

  test('requires both exact properties and both successful Admin workspaces', () => {
    for (const marker of [
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
      "assert.equal(directoryResult.payload.length, 2",
      "'hotel_v2_admin_get_property_workspace'",
      'directoryResult.status',
      'operational_partner_count',
    ]) {
      expect(gate).toContain(marker);
    }
  });

  test('denies anon, non-admin and exact partner without raw-table fallback', () => {
    for (const marker of [
      "['anon', TOKENS.anon]",
      "['non-admin', TOKENS.nonAdmin]",
      "['exact partner', TOKENS.partner]",
      "'is_partner_user'",
      'exactPartnerIdentity.payload, true',
      'assertDenied(deniedDirectory',
      'assertDenied(deniedWorkspace',
    ]) {
      expect(gate).toContain(marker);
    }
    expect(gate).not.toMatch(/\/hotel_bookings|from\(['"]hotels['"]\)/i);
  });
});
