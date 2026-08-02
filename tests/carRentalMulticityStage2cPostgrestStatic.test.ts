import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Car Rental Multi-City Stage 2C real PostgREST integration guards', () => {
  const base = read('tests/integration/car-rental-multicity-postgrest-base.sql');
  const config = read('tests/integration/car-rental-multicity-postgrest.conf');
  const gate = read('tests/integration/car-rental-multicity-postgrest-gate.mjs');
  const proxy = read('tests/integration/car-rental-multicity-postgrest-proxy.mjs');
  const e2e = read('tests/e2e/car-rental-multicity-postgrest.spec.ts');

  test('environment is localhost-only and contains no production project reference', () => {
    const combined = `${base}\n${config}\n${gate}\n${proxy}\n${e2e}`;
    expect(config).toContain('127.0.0.1:55432/car_multicity_stage2c');
    expect(config).toContain('server-host = "127.0.0.1"');
    expect(combined).not.toMatch(/https:\/\/[^\s"']+\.supabase\.co/i);
    expect(combined).not.toContain('daoohnbnnowmmcizgvrq');
    expect(combined).not.toContain('uhnewnycowtrswxrcsez');
  });

  test('real browser gate uses Supabase JS and never loads the Supabase stub', () => {
    expect(e2e).toContain("node_modules/@supabase/supabase-js/dist/umd/supabase.js");
    expect(e2e).toContain('CarRentalMulticityRepository.create');
    expect(e2e).toContain('CarRentalMulticityAdmin.create');
    expect(e2e).not.toContain('supabase-stub.js');
    expect(e2e).not.toContain('__supabaseStub');
  });

  test('fixture is deterministic, contains no booking PII and seeds only two synthetic offers', () => {
    expect(base).toContain('ca300001-0000-4000-8000-000000000001');
    expect(base).toContain('ca300001-0000-4000-8000-000000000002');
    expect(base).not.toMatch(/customer_(?:name|email|phone)/i);
    expect(base).not.toMatch(/insert\s+into\s+public\.car_bookings/i);
    expect(base.match(/'ca300001-0000-4000-8000-00000000000[12]'/g)).toHaveLength(4);
  });

  test('gate covers all four PostgREST roles, exact concurrency and required constraints', () => {
    for (const marker of [
      'TOKENS.anon',
      'TOKENS.nonAdmin',
      'TOKENS.admin',
      'TOKENS.service',
      'expectedUpdatedAt',
      'car_offer_id_is_immutable',
      'mapped_car_offer_requires_pricing_profile',
      'car_offer_pricing_profile_location_mismatch',
      'paphos_profile_cross_city_mapping_forbidden',
      'car_offer_pickup_not_supported_by_profile',
      'car_offer_return_not_supported_by_profile',
      'mapped_car_offer_requires_active_pickup_and_return',
      'active_mapped_offer_requires_active_pricing_profile',
      'car_city_used_by_active_mapped_offer',
      'car_profile_city_change_breaks_mapped_offer',
    ]) {
      expect(gate).toContain(marker);
    }
  });
});
