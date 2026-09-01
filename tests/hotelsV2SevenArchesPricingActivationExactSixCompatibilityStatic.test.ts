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

const expectedKeys = [
  'partner_service_fulfillment_form_snapshots',
  'partner_service_fulfillments',
  'profile_referral_code_aliases',
  'referrals',
  'service_deposit_requests',
  'site_settings',
];

describe('Hotels V2 7 Arches exact-six pricing activation compatibility', () => {
  test('installs the synthetic drift only after 114370 and before 114400', () => {
    const task2 = base.indexOf(
      '20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql',
    );
    const exactSix = base.indexOf(
      'hotels-v2-seven-arches-pricing-activation-exact-six-drift-fixture.sql',
    );
    expect(task2).toBeGreaterThanOrEqual(0);
    expect(exactSix).toBeGreaterThan(task2);
    expect(base).toContain('seven_arches_pricing_activation_exact_six_fixture');
    expect(base).not.toContain(
      '20260811440000_hotels_v2_seven_arches_pricing_activation.sql',
    );
  });

  test('changes exactly the six production fingerprint classes with synthetic data', () => {
    for (const key of expectedKeys) expect(fixture).toContain(`'${key}'`);
    expect(fixture).toContain('v_task2_changed is distinct from c_expected');
    expect(fixture).toContain('v_stage2_changed is distinct from c_expected');
    expect(fixture).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_FIXTURE_OK',
    );
    expect(fixture).toContain('36000000-0000-4000-8000-000000000106');
    expect(fixture).not.toMatch(/vault\.decrypted_secrets|https:\/\/(?!project\.)/i);
  });

  test('preserves the accepted live-drift fixture through the focused forward chain', () => {
    const exactSixGuard = forwardChain.indexOf(
      '\\if :{?seven_arches_pricing_activation_exact_six_fixture}',
    );
    const liveDriftUnset = forwardChain.indexOf(
      '\\unset seven_arches_owner_live_drift_fixture',
    );
    expect(exactSixGuard).toBeGreaterThanOrEqual(0);
    expect(liveDriftUnset).toBeGreaterThan(exactSixGuard);
  });

  test('pins exact-six install locks and delta equality without a source-hash shortcut', () => {
    for (const source of [migration, preflight]) {
      for (const key of expectedKeys) expect(source).toContain(`'${key}'`);
      expect(source).toContain('v_property_delta_keys is distinct from v_expected_delta_keys');
      expect(source).toContain('v_stage2_delta_keys is distinct from v_expected_delta_keys');
    }
    for (const relation of expectedKeys) {
      expect(migration).toContain(`'public.${relation}'::regclass`);
    }
    expect(migration).toContain('seven_arches_pricing_activation_locked_baseline');
    expect(migration).toContain('share row exclusive mode');
  });

  test('covers every required focused negative category', () => {
    for (const marker of [
      'unexplainedSeventhKey',
      'unsupportedHotelsFlag',
      'historicalReceiptCorruption',
      'missing114370Receipt',
      'missing114360Receipt',
      'sourcePinDrift',
    ]) expect(compatibility).toContain(marker);
    expect(compatibility).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_COMPATIBILITY_GATE_PASS',
    );
    expect(compatibility).toContain('partialStateAbsent');

    for (const key of expectedKeys.slice(0, 5)) expect(inflight).toContain(`'${key}'`);
    expect(inflight).toContain('5 non_site_settings_mutation_negatives');
    expect(inflight).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_INFLIGHT_GATE_PASS',
    );
  });

  test('uses a loopback disposable race to prove concurrent site-settings serialization', () => {
    expect(concurrency).toContain("new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])");
    expect(concurrency).toContain('HOTELS_V2_TASK3_CONCURRENCY_DISPOSABLE');
    expect(concurrency).toContain('hotel_v2_admin_apply_seven_arches_pricing_activation');
    expect(concurrency).toContain('HOTEL_BLOCKER_READY');
    expect(concurrency).toContain('SITE_WRITER_COMMITTED');
    expect(concurrency).toContain('protected_relation_lock_count === 6');
    expect(concurrency).toContain('writerBlockedUntilActivationCommit');
    expect(concurrency).toContain('postCommitMetadataCompatible');
    expect(concurrency).toContain(
      'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_CONCURRENCY_GATE_PASS',
    );
  });
});
