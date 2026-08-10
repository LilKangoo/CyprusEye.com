import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

describe('Car Rental Multi-City Stage 2B inert foundation', () => {
  const root = process.cwd();
  const migrationPath = 'supabase/migrations/20260802120000_car_rental_multicity_foundation.sql';
  const verifyPath = 'supabase/manual/car_rental_multicity_stage2b_verify.sql';
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const migration = read(migrationPath);
  const verify = read(verifyPath);
  const normalizedMigration = migration.replace(/\s+/g, ' ');
  const sha256 = (relativePath: string) =>
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');

  test('uses one additive migration and creates only the five approved foundation tables', () => {
    const matchingMigrations = fs
      .readdirSync(path.join(root, 'supabase/migrations'))
      .filter((name) => name.endsWith('_car_rental_multicity_foundation.sql'));
    const createdTables = Array.from(
      migration.matchAll(/\bcreate\s+table\s+public\.([a-z0-9_]+)/gi),
      (match) => match[1],
    );

    expect(matchingMigrations).toEqual(['20260802120000_car_rental_multicity_foundation.sql']);
    expect(createdTables).toEqual([
      'car_rental_cities',
      'car_pricing_profiles',
      'car_vehicle_kinds',
      'car_pricing_profile_cities',
      'car_offer_city_availability',
    ]);
    expect(normalizedMigration).toContain(
      "alter table public.car_offers add column pricing_profile_id uuid, add column availability_mode text not null default 'legacy', add column vehicle_kind_id uuid not null default",
    );
    expect(normalizedMigration).toContain(
      'alter table public.site_settings add column car_multi_city_mapped_enabled boolean not null default false',
    );
  });

  test('seeds the exact inert catalog and never seeds offer availability', () => {
    const expectedCities = ['larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'];
    const expectedKinds = ['car', 'quad', 'buggy'];

    expectedCities.forEach((code) => expect(migration).toContain(`'${code}'`));
    expectedKinds.forEach((code) => expect(migration).toContain(`'${code}'`));
    expect(migration).toContain("'larnaca', 'Larnaca legacy pricing profile', 'larnaca', 'larnaca'");
    expect(migration).toContain("'paphos', 'Paphos legacy pricing profile', 'paphos', 'paphos'");
    expect(migration.match(/'ca210001-0000-4000-8000-000000000002',\s*'ca200001/gi)).toHaveLength(1);
    expect(migration).toContain(
      "'ca210001-0000-4000-8000-000000000002', 'ca200001-0000-4000-8000-000000000006', true, true, 'paphos', true",
    );
    expect(migration).not.toMatch(/insert\s+into\s+public\.car_offer_city_availability\b/i);
    expect(migration).not.toMatch(/set\s+availability_mode\s*=\s*'mapped'/i);
    expect(migration).not.toMatch(/set\s+car_multi_city_mapped_enabled\s*=\s*true/i);
  });

  test('the only existing-data write is the deterministic pricing profile backfill', () => {
    const mutationTargets = Array.from(
      migration.matchAll(/\b(?:insert\s+into|update|delete\s+from)\s+public\.([a-z0-9_]+)/gi),
      (match) => match[1],
    );
    const existingTargets = mutationTargets.filter((table) => ![
      'car_rental_cities',
      'car_pricing_profiles',
      'car_vehicle_kinds',
      'car_pricing_profile_cities',
    ].includes(table));

    expect(existingTargets).toEqual(['car_offers']);
    expect(normalizedMigration).toMatch(
      /update public\.car_offers co set pricing_profile_id = profile\.id from public\.car_pricing_profiles profile where profile\.legacy_booking_location = lower\(btrim\(co\.location\)\) and profile\.code in \('larnaca', 'paphos'\)/i,
    );
    expect(migration).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:car_bookings|partners|partner_resources|partner_service_fulfillments|service_deposit_rules|service_deposit_overrides|car_location_fees|car_pricing_rules)\b/i,
    );
    expect(normalizedMigration).toContain(
      "lower(btrim(coalesce(co.location, ''))) not in ('larnaca', 'paphos')",
    );
    expect(normalizedMigration).toContain("message = 'car_multicity_stage2b_unknown_legacy_location'");
  });

  test('reject-only validators enforce immutable IDs and cross-table mapped safety', () => {
    const requiredSafetyMarkers = [
      'car_offer_id_is_immutable',
      'mapped_car_offer_requires_pricing_profile',
      'car_offer_pricing_profile_location_mismatch',
      'paphos_profile_cross_city_mapping_forbidden',
      'active_car_offer_availability_requires_active_mapping',
      'car_offer_pickup_not_supported_by_profile',
      'car_offer_return_not_supported_by_profile',
      'mapped_car_offer_requires_active_pickup_and_return',
      'mapped_car_offer_would_lose_pickup_or_return',
      'car_profile_city_change_breaks_mapped_offer',
      'active_mapped_offer_requires_active_pricing_profile',
      'mapped_car_city_code_is_immutable',
    ];
    const functionDeclarations = migration.match(
      /create\s+or\s+replace\s+function\s+public\.car_multicity_[\s\S]*?\$\$;/gi,
    ) || [];

    requiredSafetyMarkers.forEach((marker) => expect(migration).toContain(marker));
    expect(functionDeclarations).toHaveLength(8);
    functionDeclarations.forEach((declaration) => {
      expect(declaration).toMatch(/security\s+definer/i);
      expect(declaration).toMatch(/set\s+search_path\s*=\s*pg_catalog,\s*public/i);
      expect(declaration).not.toMatch(
        /\b(?:insert\s+into|update|delete\s+from)\s+public\./i,
      );
    });
    expect(migration).not.toMatch(/\b(?:car_bookings|partner_service_fulfillments)\s*\%rowtype\b/i);
  });

  test('RLS exposes active data only and gives writes only to admin policy or service role', () => {
    const tables = [
      'car_rental_cities',
      'car_pricing_profiles',
      'car_pricing_profile_cities',
      'car_offer_city_availability',
      'car_vehicle_kinds',
    ];

    tables.forEach((table) => {
      expect(normalizedMigration).toContain(`alter table public.${table} enable row level security`);
      expect(normalizedMigration).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
      expect(normalizedMigration).toContain(`grant select on table public.${table} to anon, authenticated`);
      expect(normalizedMigration).toContain(`grant all privileges on table public.${table} to service_role`);
      expect(normalizedMigration).toContain(`create policy ${table}_admin_all on public.${table} for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin())`);
    });
    expect(normalizedMigration).toContain(
      "offer.availability_mode = 'mapped' and offer.is_available and offer.is_published",
    );
    expect(migration.match(/revoke all on function public\.car_multicity_/gi)).toHaveLength(8);
    expect(migration.match(/grant execute on function public\.car_multicity_/gi)).toHaveLength(8);
  });

  test('manual verify is one read-only summary statement with all safety gates', () => {
    const stripped = verify
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--.*$/gm, '')
      .replace(/'([^']|'')*'/g, "''");
    const forbidden = [
      'INSERT', 'UPDATE', 'DELETE', 'UPSERT', 'MERGE', 'ALTER', 'CREATE', 'DROP',
      'TRUNCATE', 'GRANT', 'REVOKE', 'CALL', 'DO', 'EXECUTE', 'PERFORM',
    ];

    expect(verify.trim().endsWith(';')).toBe(true);
    expect(verify.match(/;/g)).toHaveLength(1);
    expect(stripped).not.toMatch(new RegExp(`\\b(?:${forbidden.join('|')})\\b`, 'i'));
    [
      'cities_ok',
      'profiles_ok',
      'profile_cities_ok',
      'paphos_profile_local_only',
      'vehicle_kinds_ok',
      'no_mapped_offers',
      'all_existing_offers_legacy',
      'all_offer_profiles_match_location',
      'no_seeded_offer_availability',
      'global_feature_flag_false',
      'added_columns_ok',
      'rls_enabled',
      'expected_constraints_present',
      'expected_indexes_present',
      'expected_triggers_present',
      'expected_policies_present',
      'validator_security_ok',
      'protected_fingerprint_unchanged',
      'exact_offer_ids_unchanged',
      'stage2b_foundation_safe',
    ].forEach((field) => expect(verify).toContain(field));
  });

  test('the authorized pricing seams and protected downstream sources match accepted hashes', () => {
    const expectedHashes: Record<string, string> = {
      'js/car-pricing.js': '6305c5cc9636c690c220d2f9f9f7a1e66b30de5a2ce239eefd32d2fdfd76c6c9',
      'js/car-reservation.js': 'af029ab2a1777ae9a67e66a8691ab44ed006a555b4f8f64b3855d7d716985100',
      'js/car-rental-flow.js': '64a461171c4496ce53ced64146623ec15025e8784645e4e1f572e817db546f16',
      'supabase/functions/partner-fulfillment-action/index.ts': '802aa0b8d3a1204f93adefcf598a77c764fde4a6e15dfe2624366c0a99c1297b',
      'supabase/migrations/057_admin_notification_queue.sql': '509f701e938ba08672968d303529fa2bac8c2f7bad3cc4aa677a82158090211a',
      'supabase/migrations/061_customer_received_notifications.sql': '960881ed4feca587df941daa3e6d4e0d5a23bbbd2369ac7c8dbda655f17c831a',
      'supabase/migrations/096_partner_fulfillment_form_snapshots.sql': 'b4c9650057f128c180c1f1c5aeffd2ce9425cdcdeae9e2fdff6cfa7d99a24b3c',
      'supabase/migrations/103_car_coupon_quote_rpc_and_partner_snapshot.sql': 'a45d46f3b16ca42d3c750e320300a18530c25e8f7be8640ea2bf91faaac5627b',
      'supabase/migrations/104_partner_car_duration_days_consistency.sql': 'f1d33de2f078b99b42d5d5a78dd0806277f548107374338fa01828ff4f80c7db',
      'supabase/migrations/107_car_booking_status_paid_sync_from_deposit.sql': '397226a4c5066303b353adf7c5f14ec4d830f61d424121f17f40c1e224d2fcc9',
      'supabase/migrations/124_service_coupon_quote_and_booking_enforcement.sql': '5297e4e469206d36087eede769b2aa77a1bee24696269c608cdb74ac699d663f',
      'supabase/migrations/062_deposit_emails_and_contact_gating.sql': '613d345f7d9874de86843e6aca9d55f71a7c9f32d1f0542681b4c96305c447e4',
    };

    Object.entries(expectedHashes).forEach(([relativePath, expectedHash]) => {
      expect(sha256(relativePath)).toBe(expectedHash);
    });
  });

  test('later exact-ID public seams do not query Stage 2B tables outside the shared read repository', () => {
    const publicReaders = [
      'car.html',
      'index.html',
      'js/car-rental-flow.js',
      'js/car-rental-paphos.js',
      'js/car-offer-modal.js',
      'js/home-cars.js',
      'js/car-reservation.js',
      'js/car-pricing.js',
    ];
    const forbiddenRuntimeMarkers = [
      'car_offer_city_availability',
      'car_pricing_profile_cities',
      'car_pricing_profiles',
      'car_rental_cities',
      'car_multi_city_mapped_enabled',
    ];

    publicReaders.forEach((relativePath) => {
      const source = read(relativePath);
      forbiddenRuntimeMarkers.forEach((marker) => expect(source).not.toContain(marker));
    });
    expect(read('js/car-rental-paphos.js')).toContain("String(car?.availability_mode || '').trim() === 'mapped'");
    expect(read('js/car-offer-modal.js')).toContain("String(car?.availability_mode || '').trim() === 'mapped'");
    expect(read('js/car-reservation.js')).toContain("String(offerRow?.availability_mode || '').trim() === 'mapped'");
  });
});
