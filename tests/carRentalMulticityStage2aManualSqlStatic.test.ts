import fs from 'node:fs';
import path from 'node:path';

describe('Car Rental Multi-City Stage 2A manual live verification SQL', () => {
  const root = process.cwd();
  const filePaths = {
    preflight: 'supabase/manual/car_rental_multicity_stage2a_preflight.sql',
    diagnostics: 'supabase/manual/car_rental_multicity_stage2a_diagnostics.sql',
    proposal: 'supabase/manual/car_rental_multicity_stage2a_proposal_report.sql',
  } as const;
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const sources = Object.fromEntries(
    Object.entries(filePaths).map(([name, relativePath]) => [name, read(relativePath)]),
  ) as Record<keyof typeof filePaths, string>;
  const stripSqlStringsAndComments = (value: string) =>
    value
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--.*$/gm, '')
      .replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)?\$[\s\S]*?\$\1\$/g, "''")
      .replace(/'([^']|'')*'/g, "''");

  test.each(Object.entries(filePaths))('%s file exists and contains one read-only statement', (name, relativePath) => {
    const source = sources[name as keyof typeof sources];
    const forbiddenSqlTokens = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'UPSERT',
      'MERGE',
      'ALTER',
      'CREATE',
      'DROP',
      'TRUNCATE',
      'GRANT',
      'REVOKE',
      'CALL',
      'DO',
    ];
    const additionalUnsafeTokens = [
      'COPY',
      'VACUUM',
      'REFRESH',
      'LOCK',
      'EXECUTE',
      'PERFORM',
      'SETVAL',
      'NEXTVAL',
    ];

    expect(fs.existsSync(path.join(root, relativePath))).toBe(true);
    expect(source.trim().endsWith(';')).toBe(true);
    expect(source.match(/;/g)).toHaveLength(1);
    expect(source).not.toMatch(
      new RegExp(`\\b(?:${[...forbiddenSqlTokens, ...additionalUnsafeTokens].join('|')})\\b`, 'i'),
    );
    expect(source).not.toMatch(/\bselect\b[\s\S]*?\binto\b/i);
  });

  test.each(Object.keys(filePaths))('%s has no mutating RPC, network invocation, or customer PII reference', (name) => {
    const source = sources[name as keyof typeof sources];
    const piiNames = [
      'customer_name',
      'customer_email',
      'customer_phone',
      'customer_country',
      'full_name',
      'pickup_address',
      'return_address',
      'driver_license_number',
      'flight_number',
      'special_requests',
      'admin_notes',
      'internal_notes',
      'stripe_session_id',
      'stripe_payment_intent_id',
      'payment_reference',
      'email',
      'phone',
      'address',
      'passport',
      'date_of_birth',
      'ip_address',
      'user_agent',
    ];

    expect(source).not.toMatch(new RegExp(`\\b(?:${piiNames.join('|')})\\b`, 'i'));
    expect(source).not.toMatch(/\b(?:rpc|invoke|http_post|http_request)\s*\(/i);
    expect(source).not.toMatch(/\b(?:net|http)\.[a-z0-9_]+\s*\(/i);
    expect(source).not.toMatch(/\bpublic\.[a-z0-9_]+\s*\(/i);
    expect(source).not.toMatch(
      /\bpublic\.(?:admin_|assign_|apply_|create_|dispatch_|notify_|process_|save_|send_|set_|sync_)\w*\s*\(/i,
    );
  });

  test('preflight is catalog-only, covers the nine exact objects, and exposes one summary row', () => {
    const source = sources.preflight;
    const parsed = stripSqlStringsAndComments(source).replace(/\s+/g, ' ');
    const requiredObjects = [
      'car_offers',
      'car_bookings',
      'partners',
      'partner_resources',
      'partner_service_fulfillments',
      'service_deposit_rules',
      'service_deposit_overrides',
      'car_location_fees',
      'car_pricing_rules',
    ];

    expect(source).toContain('car-rental-multicity-stage2a-live-preflight-v1');
    requiredObjects.forEach((objectName) => expect(source).toContain(`('${objectName}'::text)`));
    [
      'pg_attribute',
      'format_type',
      'pg_attrdef',
      'pg_constraint',
      'pg_index',
      'pg_policy',
      'aclexplode',
      'pg_trigger',
      'pg_get_userbyid',
      'relrowsecurity',
      'relforcerowsecurity',
      "'columns'",
      "'constraints'",
      "'indexes'",
      "'policies'",
      "'grants'",
      "'triggers'",
      "'owner'",
    ].forEach((token) => expect(source).toContain(token));

    expect(parsed).not.toMatch(/\b(?:from|join)\s+public\.(?:car_|partners|partner_|service_)/i);
    expect(parsed).toMatch(
      /from summary s cross join named_types nt cross join exact_offer_fk ef cross join object_contract oc;/i,
    );
    expect(source).toContain('schema_preflight_pass');
  });

  test('preflight verifies the exact booking offer FK semantically and reports compatibility types', () => {
    const source = sources.preflight;
    const normalized = source.replace(/\s+/g, ' ');

    expect(normalized).toContain("con.contype = 'f'");
    expect(normalized).toContain("con.conrelid = to_regclass('public.car_bookings')");
    expect(normalized).toContain("con.confrelid = to_regclass('public.car_offers')");
    expect(normalized).toContain('con.conkey = array[fa.booking_offer_attnum]::smallint[]');
    expect(normalized).toContain('con.confkey = array[fa.offer_id_attnum]::smallint[]');
    expect(normalized).toContain("con.confdeltype = 'n'");
    expect(normalized).not.toMatch(/pg_get_constraintdef\([^)]*\)\s*(?:i?like|=)/i);

    [
      'car_model_type',
      'car_type_type',
      'description_type',
      'features_type',
      'offer_location_type',
      'partners_cars_locations_type',
      "nt.partners_cars_locations_type = 'text[]'",
    ].forEach((token) => expect(source).toContain(token));
  });

  test('diagnostics has the exact vertical result and a blocker-derived safety result', () => {
    const source = sources.diagnostics;
    const parsed = stripSqlStringsAndComments(source).replace(/\s+/g, ' ');

    expect(source).toContain('car-rental-multicity-stage2a-live-diagnostics-v1');
    [
      'invalid_car_offer_legacy_location',
      'larnaca_profile_missing_usable_price',
      'paphos_profile_incomplete_price_matrix',
      'larnaca_offers_with_north_disabled',
      'unpublished_car_offers',
      'unavailable_car_offers',
      'i18n_runtime_shapes',
      'multiple_partner_resources_per_exact_offer',
      'owner_partner_conflicts_with_partner_resources',
      'orphan_car_service_deposit_overrides',
      'public_larnaca_offers_with_north_disabled',
      'protected_car_offer_fingerprint',
      'diagnostics_safe_to_continue',
    ].forEach((checkName) => expect(source).toContain(`'${checkName}'`));
    [
      'price_per_day',
      'price_3days',
      'price_4_6days',
      'price_7_10days',
      'price_10plus_days',
      'currency',
      'location',
      'owner_partner_id',
      'deposit_amount',
      'insurance_per_day',
      'young_driver_fee',
      'young_driver_cost',
      'stock_count',
      'north_allowed',
      'is_available',
      'is_published',
      'submission_status',
    ].forEach((field) => expect(source).toContain(`'${field}'`));

    expect(parsed).not.toMatch(/\b(?:from|join)\s+public\.car_bookings\b/i);
    expect(source).toContain("bc.severity = 'BLOCKER' and not bc.pass");
    expect(source).toContain('ds.failed_blockers = 0');
    expect(parsed).toMatch(
      /select ac\.check_name, ac\.severity, ac\.pass, ac\.affected_rows, ac\.details from all_checks ac order by ac\.check_order;/i,
    );
  });

  test('proposal keeps every offer inert and requires manual review beyond the legacy home city', () => {
    const source = sources.proposal;
    const parsed = stripSqlStringsAndComments(source).replace(/\s+/g, ' ');

    expect(source).toContain('car-rental-multicity-stage2a-live-proposal-v1');
    [
      'offer_id',
      'normalized_model',
      'legacy_location',
      'proposed_pricing_profile',
      'proposed_pickup_cities',
      'proposed_return_cities',
      'supported_candidate_cities',
      'warnings',
      'owner_partner_id',
      'north_allowed',
      'is_available',
      'is_published',
      'resulting_availability_mode',
    ].forEach((field) => expect(source).toContain(field));

    expect(source).toContain("when 'larnaca' then array['larnaca']::text[]");
    expect(source).toContain("when 'paphos' then array['paphos']::text[]");
    expect(source).toContain("'candidate_cities_require_manual_review'");
    expect(source).toContain("'paphos_profile_stage2_limited_to_paphos'");
    expect(source).toContain("'legacy'::text as resulting_availability_mode");
    expect(parsed).not.toMatch(/\b(?:from|join)\s+public\.car_bookings\b/i);
  });
});
