import fs from 'node:fs';

const read = (filename: string): string => fs.readFileSync(filename, 'utf8');

const migration = read(
  'supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql',
);
const preflight = read(
  'supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql',
);
const base = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-postgres-base.sql',
);
const fixture = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-exact-six-drift-fixture.sql',
);
const compatibility = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-exact-six-compatibility-gate.mjs',
);
const inflight = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-exact-six-inflight-postgres-gate.sql',
);
const concurrency = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-exact-six-concurrency-gate.mjs',
);
const forwardChain = read(
  'tests/integration/hotels-v2-seven-arches-independent-pricing-topology-postgres-gate.sql',
);
const reviewedPricing = read(
  'supabase/migrations/20260811441500_hotels_v2_seven_arches_reviewed_pricing_evolution.sql',
);
const providerGate = read(
  'tests/integration/hotels-v2-seven-arches-external-calendar-readiness-postgres-gate.sql',
);

const scopedLineageKeys = [
  'contract_version',
  'hotel_id',
  'partner_id',
  'assignment_id',
  'owner_user_ids',
  'owner_membership_fingerprint',
  'permission_preset_fingerprint',
  'property_business_fingerprint',
  'room_identity_fingerprint',
  'pricing_identity_fingerprint',
  'allocation_contract_exact',
  'parity_case_count',
  'parity_mismatch_count',
  'parity_fingerprint',
  'commission_policy_fingerprint',
  'payment_policy_fingerprint',
  'site_settings_lifecycle',
  'site_settings_lifecycle_fingerprint',
  'owner_capability_receipt_fingerprint',
  'property_foundation_receipt_fingerprint',
  'lower_function_security_fingerprint',
];

function literalLockBlocks(source: string): string[][] {
  return [...source.matchAll(
    /^\s*foreach v_relation in array array\[([\s\S]*?)\]\s+loop/gm,
  )].map((match) => [...match[1].matchAll(/'([^']+)'::regclass/g)]
    .map((relation) => relation[1])).filter((relations) => relations.length > 0);
}

describe('Hotels V2 7 Arches scoped live-baseline pricing compatibility', () => {
  test('installs synthetic operational evolution only after 114370 and before 114400', () => {
    const task2 = base.indexOf(
      '20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql',
    );
    const liveEvolution = base.indexOf(
      'hotels-v2-seven-arches-pricing-activation-exact-six-drift-fixture.sql',
    );
    expect(task2).toBeGreaterThanOrEqual(0);
    expect(liveEvolution).toBeGreaterThan(task2);
    // Retain the runner variable/path for compatibility; its behavior is no
    // longer an exact-cardinality contract.
    expect(base).toContain('seven_arches_pricing_activation_exact_six_fixture');
    expect(base).not.toContain(
      '20260811440000_hotels_v2_seven_arches_pricing_activation.sql',
    );
  });

  test('models repeatable linked operational evolution without a date-specific allowlist', () => {
    for (const marker of [
      'affiliate_commission_events',
      'partner_service_fulfillment_form_snapshots',
      'partner_service_fulfillments',
      'profile_referral_code_aliases',
      'referrals',
      'service_deposit_requests',
      'site_settings',
      'task3_live_baseline_phase":1',
      'task3_live_baseline_phase":2',
      'historical_affiliate_event',
      'affiliate_event_count+1',
    ]) expect(fixture).toContain(marker);
    expect(fixture).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_LIVE_BASELINE_FIXTURE_OK',
    );
    expect(fixture).not.toContain('v_task2_changed is distinct from c_expected');
    expect(fixture).not.toContain('v_stage2_changed is distinct from c_expected');
    expect(fixture).not.toMatch(/vault\.decrypted_secrets|https:\/\/(?!project\.)/i);
  });

  test('uses a finite 7 Arches lineage projection, not global live-map equality', () => {
    for (const source of [migration, preflight]) {
      expect(source).not.toMatch(/v_expected_(?:baseline_)?delta_keys/);
      expect(source).not.toMatch(
        /v_(?:property|task2|stage2)(?:_baseline)?_delta_keys/,
      );
    }
    expect(migration).toContain('hotel_v2_seven_arches_pricing_scoped_lineage');
    expect(preflight).not.toContain('hotel_v2_seven_arches_pricing_scoped_lineage');
    expect(migration).toContain(
      'hotels_v2_seven_arches_pricing_scoped_lineage_v1',
    );
    for (const key of scopedLineageKeys) expect(migration).toContain(`'${key}'`);
    expect(compatibility).toContain('SCOPED_KEYS');
    expect(compatibility).toContain('assert.deepEqual(lineageAfter, lineageBefore)');
    expect(compatibility).toContain('repeatedUnrelatedLiveEvolution');
    expect(compatibility).not.toContain('EXPECTED_KEYS');
    expect(compatibility).not.toContain('unexplainedSeventhKey');
    expect(migration).not.toMatch(
      /after_protected_fingerprints\s+is not distinct from\s+v_current\b/,
    );
    expect(migration).not.toMatch(
      /after_stage2_protected_fingerprints\s+is not distinct from\s+v_stage2_current\b/,
    );
  });

  test('preserves complete literal relation locking and broad BEFORE/AFTER evidence', () => {
    const lockBlocks = literalLockBlocks(migration);
    expect(lockBlocks).toHaveLength(2);
    expect(lockBlocks[0]).toHaveLength(64);
    expect(lockBlocks[1]).toHaveLength(68);
    expect(new Set(lockBlocks[0]).size).toBe(64);
    expect(new Set(lockBlocks[1]).size).toBe(68);
    for (const relation of lockBlocks[0]) expect(lockBlocks[1]).toContain(relation);
    for (const relation of [
      'public.affiliate_commission_events',
      'public.partner_service_fulfillments',
      'public.partner_service_fulfillment_form_snapshots',
      'public.service_deposit_requests',
      'public.referrals',
      'public.profile_referral_code_aliases',
      'public.site_settings',
    ]) expect(lockBlocks[1]).toContain(relation);
    expect(migration).toContain('seven_arches_pricing_activation_locked_baseline');
    expect(migration).toContain('share row exclusive mode');
    expect(migration).toContain('before_protected_fingerprints');
    expect(migration).toContain('after_protected_fingerprints');
  });

  test('keeps focused lineage and full-preservation negative coverage', () => {
    for (const marker of [
      'criticalPropertyDrift',
      'unsupportedHotelsFlag',
      'historicalReceiptCorruption',
      'missing114370Receipt',
      'missing114360Receipt',
      'sourcePinDrift',
    ]) expect(compatibility).toContain(marker);
    expect(compatibility).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_SCOPED_COMPATIBILITY_GATE_PASS',
    );
    expect(compatibility).toContain('partialStateAbsent');

    for (const key of [
      'affiliate_commission_events',
      'partner_service_fulfillment_form_snapshots',
      'partner_service_fulfillments',
      'profile_referral_code_aliases',
      'referrals',
      'service_deposit_requests',
      'site_settings',
    ]) expect(inflight).toContain(`'${key}'`);
    expect(inflight).toContain('7 unrelated_inflight_mutation_negatives');
    expect(inflight).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_FULL_PRESERVATION_INFLIGHT_GATE_PASS',
    );
    expect(inflight).toContain('seven_arches_114400_full_preservation_before');
  });

  test('covers lock-first concurrency cases A through E against all 68 Apply locks', () => {
    expect(concurrency).toContain("new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])");
    expect(concurrency).toContain('HOTELS_V2_TASK3_CONCURRENCY_DISPOSABLE');
    expect(concurrency).toContain('REQUIRED_APPLY_RELATIONS.length, 68');
    for (const marker of [
      'caseA_preLockUnrelatedCommit',
      'caseB_postLockWriterBlocks',
      'caseC_inverseWriterRace',
      'caseD_accidentalUnrelatedMutation',
      'caseE_criticalPreLockMutation',
      'freshLockedBeforeIncludedPreLockCommit',
      'writerBlockedUntilActivationCommit',
      'migrationWaitedForWriter',
      'accidentalMutationRejected',
      'criticalPreLockMutationRejected',
    ]) expect(concurrency).toContain(marker);
    expect(concurrency).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_LOCK_FIRST_CONCURRENCY_GATE_PASS',
    );
  });

  test('preserves the live-evolution fixture through the focused forward chain', () => {
    const fixtureGuard = forwardChain.indexOf(
      '\\if :{?seven_arches_pricing_activation_exact_six_fixture}',
    );
    const liveDriftUnset = forwardChain.indexOf(
      '\\unset seven_arches_owner_live_drift_fixture',
    );
    expect(fixtureGuard).toBeGreaterThanOrEqual(0);
    expect(liveDriftUnset).toBeGreaterThan(fixtureGuard);
  });

  test('switches scoped parity to the reviewed Room-aware oracle after 114415', () => {
    expect(migration).toContain(
      'hotel_seven_arches_reviewed_pricing_foundation_receipts',
    );
    expect(migration).toContain(
      'hotel_v2_seven_arches_reviewed_pricing_oracle()',
    );
    expect(migration).toContain("'core_case_count')::integer<>100");
    expect(migration).toContain("'guest_one_case_count')::integer<>20");
    expect(reviewedPricing.match(
      /v_scoped_lineage->>'parity_case_count'\)::integer<>100/g,
    )).toHaveLength(2);
  });

  test('proves seven-domain post-provider durability including ADMIN-D safe', () => {
    expect(providerGate).toContain('seven_arches_post_provider_live_evolution_before');
    expect(providerGate).toContain('seven_arches_post_provider_live_evolution_after');
    expect(providerGate).toContain("'safe')::boolean,false");
    expect(providerGate).toContain(
      'public.hotel_v2_seven_arches_reviewed_pricing_oracle() oracle',
    );
    expect(providerGate).toContain('17 site_settings_receipt_negative_probes');
    expect(providerGate).toContain('7 post_provider_live_evolution_domains');
  });
});
