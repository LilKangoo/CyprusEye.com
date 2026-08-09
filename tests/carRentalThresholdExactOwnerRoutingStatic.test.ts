import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('threshold exact-offer partner routing compatibility seam', () => {
  const migration = read('supabase/migrations/20260810130000_car_rental_threshold_exact_owner_routing.sql');
  const verify = read('supabase/manual/car_rental_threshold_exact_owner_routing_verify.sql');
  const seed = read('supabase/manual/speedbikes_catalogue_seed.sql');
  const catalogueVerify = read('supabase/manual/speedbikes_catalogue_verify.sql');
  const adapter = read('js/car-rental-availability-adapter.js');

  test('migration is transactional, flag-gated and proves legacy routing parity', () => {
    expect(migration).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(migration.trim()).toMatch(/commit;$/i);
    expect(migration).toContain('create temporary table _car_threshold_legacy_partner_routing_before');
    expect(migration).toContain("v_pricing_strategy = 'threshold_daily_rate'");
    expect(migration).toContain('partner.id = v_exact_owner_id');
    expect(migration).toContain("partner.status = 'active'");
    expect(migration).toContain('partner.can_manage_cars = true');
    expect(migration).toContain('car_threshold_exact_owner_legacy_routing_changed');
    expect(migration).toContain('car_threshold_daily_rates_enabled is true');
    expect(migration).toContain('car_multi_city_mapped_enabled is true');
    expect(migration).not.toMatch(/update\s+public\.car_offers/i);
    expect(migration).not.toMatch(/update\s+public\.partners/i);
  });

  test('manual checks and catalogue import fail closed unless exact Speed Bikes routing resolves', () => {
    expect(verify).toContain('threshold_exact_owner_routing_safe');
    expect(seed).toContain('speedbikes_exact_owner_routing_migration_required');
    expect(seed).toContain('speedbikes_exact_owner_routing_mismatch');
    expect(catalogueVerify).toContain('exact_owner_routing_count');
    expect(catalogueVerify).toContain('partner.exact_owner_routing_count = 22');
  });

  test('implicit Larnaca north filtering remains legacy-only', () => {
    expect(adapter).toContain("const carPageNorth = platform === 'car-page' && !thresholdOffer");
    expect(adapter).toContain("platform === 'homepage' && !thresholdOffer");
    expect(adapter).toContain("typeof filters.requireNorthAllowed === 'boolean'");
  });
});
