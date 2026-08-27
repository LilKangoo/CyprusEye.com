import fs from 'node:fs';

const read = (file: string): string => fs.readFileSync(file, 'utf8');
const migration = read(
  'supabase/migrations/20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql',
);
const preflight = read(
  'supabase/manual/hotels_v2_seven_arches_partner_property_proposal_review_preflight.sql',
);
const pricingBase = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-postgres-base.sql',
);
const compatibilityGate = read(
  'tests/integration/hotels-v2-seven-arches-property-proposal-foundation-compatibility-gate.mjs',
);
const normalizedMigration = migration.replace(/\s+/g, ' ');

describe('Hotels V2 7 Arches Task2 live-baseline foundation', () => {
  test('uses the exact immutable 114360 receipt instead of historical mutable-row equality', () => {
    const prerequisite = migration.slice(
      migration.indexOf('do $proposal_review_prerequisites$'),
      migration.indexOf('$proposal_review_prerequisites$;',
        migration.indexOf('do $proposal_review_prerequisites$')),
    );

    expect(prerequisite).toContain('hotel_admin_availability_foundation_evolution_receipts');
    expect(prerequisite).toContain("v_owner.contract_version<>'hotels_v2_admin_d_foundation_evolution_v2'");
    expect(prerequisite).toContain("v_owner_state->>'current_matches_latest'");
    expect(prerequisite).toContain("v_owner_state->>'stage2_current_matches_latest'");
    expect(prerequisite).toContain("v_owner_state->>'safe'");
    expect(prerequisite).toContain(
      'v_current_stage2 is distinct from v_owner.stage2_current_protected_fingerprints',
    );
    expect(prerequisite).not.toContain(
      "public.hotel_v2_h3_2b_protected_fingerprints()-array[",
    );
    expect(prerequisite).not.toContain("'affiliate_commission_events','hotels'");
  });

  test('anchors the new current Task2 baseline to canonical immutable Task1 lineage', () => {
    expect(normalizedMigration).toContain(
      'owner_evolution_receipt_id smallint not null check(owner_evolution_receipt_id=1)',
    );
    expect(normalizedMigration).toContain(
      "owner_evolution_receipt_fingerprint text not null check(owner_evolution_receipt_fingerprint~'^[0-9a-f]{64}$')",
    );
    expect(normalizedMigration).toContain(
      "public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(owner_evolution),'{created_at}', to_jsonb(extract(epoch from owner_evolution.created_at)),false))",
    );
    expect(normalizedMigration).toContain(
      'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() value',
    );
    expect(normalizedMigration).toContain(
      'original_h3_2b_foundation_fingerprint,owner_evolution_receipt_id, owner_evolution_receipt_fingerprint',
    );
  });

  test('ships a separate read-only deployment preflight before 114370', () => {
    expect(preflight).toContain(
      "'hotels_v2_seven_arches_property_proposal_review_preflight_v1' contract_version",
    );
    expect(preflight).toContain('historical_h3_2b_receipt_self_hash_exact');
    expect(preflight).toContain('owner_evolution_receipt_exact');
    expect(preflight).toContain('owner_evolution_receipt_immutable');
    expect(preflight).toContain('current_stage2_projection_exact');
    expect(preflight).toContain('current_admin_d_foundation_safe');
    expect(preflight).toContain('migration_boundary_exact');
    expect(preflight).toContain(
      'hotels_v2_seven_arches_property_proposal_review_preflight_safe',
    );
    expect(preflight).not.toMatch(
      /(^|\n)\s*(insert\s+into|update\s+public\.|delete\s+from|merge\s+into|truncate\s+|alter\s+table|create\s+|drop\s+|grant\s+|revoke\s+)/i,
    );

    const ownerMigration = pricingBase.indexOf(
      '20260811436000_hotels_v2_seven_arches_owner_operational_capabilities.sql',
    );
    const task2Preflight = pricingBase.indexOf(
      'hotels_v2_seven_arches_partner_property_proposal_review_preflight.sql',
    );
    const task2Migration = pricingBase.indexOf(
      '20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql',
    );
    expect(ownerMigration).toBeGreaterThanOrEqual(0);
    expect(task2Preflight).toBeGreaterThan(ownerMigration);
    expect(task2Migration).toBeGreaterThan(task2Preflight);
  });

  test('covers the production-style positive and every requested isolated negative', () => {
    expect(compatibilityGate).toContain('external_sync_enabled');
    expect(compatibilityGate).toContain('live_drift_present');
    expect(compatibilityGate).toContain('productionCase');
    expect(compatibilityGate).toContain('postBaselineDriftCase');
    expect(compatibilityGate).toContain('ownerReceiptCorruptionCase');
    expect(compatibilityGate).toContain('historicalReceiptCorruptionCase');
    expect(compatibilityGate).toContain('unsafeFoundationCase');
    expect(compatibilityGate).toContain('existingBoundaryCase');
    expect(compatibilityGate).toContain(
      'HOTELS_V2_SEVEN_ARCHES_PROPERTY_PROPOSAL_FOUNDATION_COMPATIBILITY_GATE_PASS',
    );
  });
});
