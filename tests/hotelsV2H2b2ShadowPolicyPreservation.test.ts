import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql',
  'utf8',
);
const preflight = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b2_shadow_property_policy_preservation_preflight.sql',
  'utf8',
);
const verify = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b2_shadow_property_policy_preservation_verify.sql',
  'utf8',
);
const policy15Verify = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b2_seven_arches_policy_15_verify.sql',
  'utf8',
);
const pgGate = fs.readFileSync(
  'tests/integration/hotels-v2-h2b2-policy-preservation-postgres-gate.sql',
  'utf8',
);

describe('Hotels H2B.2 shadow property-policy preservation repair', () => {
  test('rewrites only the deployed H2B.1 RPC and fails closed on drift', () => {
    expect(migration).toContain('create temporary table hotels_v2_h2b2_policy_preservation_snapshot');
    expect(migration).toContain('pg_get_functiondef');
    expect(migration).toContain('hotels_v2_h2b1_preserve_reviewed_rate_plan_v1');
    expect(migration).toContain('hotels_v2_h2b1_shadow_room_three_way_conflict');
    expect(migration).toContain('hotels_v2_h2b1_three_way_identity_v1');
    expect(migration).toContain('hotels_v2_h2b2_policy_preservation_function_drift');
    expect(migration).toContain('hotels_v2_h2b2_policy_validation_predicate_drift');
    expect(migration).toContain('hotels_v2_h2b2_policy_mutation_block_drift');
    expect(migration).toContain('hotels_v2_h2b2_policy_preservation_changed_data');
  });

  test('requires the exact reviewed current policy without choosing age 10', () => {
    expect(migration).toContain('hotels_v2_h2b2_preserve_reviewed_property_policy_v1');
    expect(migration).toContain('hotels_v2_h2b2_shadow_property_policy_mismatch');
    expect(migration).toContain("is distinct from v_expected_policy_value");
    expect(migration).toContain('is distinct from v_expected_minimum_age');
    expect(migration).toContain('hotel_v2_h2b1_children_policy_valid');
    expect(migration).toContain('no property mutation or');
    expect(migration).toContain("message='hotels_v2_h2b2_shadow_property_policy_mismatch'");
  });

  test('preserves authorization and feature/publication isolation', () => {
    expect(migration).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(migration).toContain("array['search_path=pg_catalog, public, auth']");
    expect(migration).toContain('grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) to authenticated');
    expect(migration).toContain("has_function_privilege('anon'");
    expect(migration).toContain("has_function_privilege('service_role'");
    expect(migration).not.toContain("architecture_version='rooms_v2'");
    expect(migration).not.toContain('hotel_rooms_v2_enabled=true');
  });

  test('ships one-row read-only preflight and post-migration verification', () => {
    expect(preflight).toContain('hotels_v2_h2b2_policy_preservation_preflight_safe');
    expect(preflight).toContain('accepted_body_count');
    expect(preflight).toContain("booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'");
    expect(preflight).toContain("fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'");
    expect(verify).toContain('hotels_v2_h2b2_policy_preservation_safe');
    expect(verify).toContain('repaired_body_count');
    expect(verify).toContain('hotels_v2_h2b2_preserve_reviewed_property_policy_v1');
    expect(policy15Verify).toContain('hotels_v2_h2b2_seven_arches_policy_15_safe');
  });

  test('proves policy preservation, mismatch abort and safe reapplication in PostgreSQL', () => {
    expect(pgGate).toContain('HOTELS_V2_H2B2_POLICY_PRESERVATION_POSTGRES_GATE_PASS');
    expect(pgGate).toContain('hotels_v2_h2b2_shadow_property_policy_mismatch');
    expect(pgGate).toContain('hotels_v2_h2b1_stale_property_policy');
    expect(pgGate).toContain('hotels_v2_h2b2_property_policy_changed_by_shadow_prepare');
    expect(pgGate).toContain('hotels_v2_h2b2_policy_mismatch_atomic_abort_failed');
    expect(pgGate).toContain('20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql');
  });
});
