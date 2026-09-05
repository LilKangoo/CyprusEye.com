import fs from 'node:fs';
import { createHash } from 'node:crypto';

const read = (filename: string): string => fs.readFileSync(filename, 'utf8');
const sha256 = (value: string): string => createHash('sha256')
  .update(value, 'utf8').digest('hex');

const migration = read(
  'supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql',
);
const preflight = read(
  'supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql',
);
const migration114405 = read(
  'supabase/migrations/20260811440500_hotels_v2_seven_arches_pricing_activation_recursion_compatibility.sql',
);
const migration114406 = read(
  'supabase/migrations/20260811440600_hotels_v2_seven_arches_pricing_activation_transport_stable_fingerprint.sql',
);
const recursionVerifier = read(
  'supabase/manual/hotels_v2_seven_arches_pricing_activation_recursion_compatibility_verify.sql',
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
const browserRoundTrip = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-browser-roundtrip-postgrest-gate.mjs',
);
const independentPricing = read(
  'supabase/migrations/20260811441000_hotels_v2_seven_arches_independent_pricing_evolution.sql',
);
const reviewedPricing = read(
  'supabase/migrations/20260811441500_hotels_v2_seven_arches_reviewed_pricing_evolution.sql',
);
const applicationBridge = read(
  'supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql',
);
const providerMigration = read(
  'supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql',
);
const providerVerifier = read(
  'supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql',
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

  test('orders additive 114406 before activation and freezes applied 114400/114405', () => {
    expect(sha256(migration)).toBe(
      '4d4d308294fab41c99b8f2feb7fe2241b4dc5a348560b6d838bc12e4a6391ced',
    );
    expect(sha256(migration114405)).toBe(
      '1dd205e4e031bafd6000dc3f45ecbbe2e8977bb132e73bdd20c876b3afb787b6',
    );

    const task114400 = forwardChain.indexOf(
      '20260811440000_hotels_v2_seven_arches_pricing_activation.sql',
    );
    const task114405 = forwardChain.indexOf(
      '20260811440500_hotels_v2_seven_arches_pricing_activation_recursion_compatibility.sql',
    );
    const task114406 = forwardChain.indexOf(
      '20260811440600_hotels_v2_seven_arches_pricing_activation_transport_stable_fingerprint.sql',
    );
    const task114410 = forwardChain.indexOf(
      '20260811441000_hotels_v2_seven_arches_independent_pricing_evolution.sql',
    );
    expect(task114400).toBeGreaterThanOrEqual(0);
    expect(task114405).toBeGreaterThan(task114400);
    expect(task114406).toBeGreaterThan(task114405);
    expect(task114410).toBeGreaterThan(task114406);

    expect(migration114406).toContain(
      'hotels_v2_seven_arches_pricing_activation_transport_boundary_mismatch',
    );
    expect(migration114406).toContain(
      'hotel_seven_arches_independent_pricing_evolution_receipts',
    );
    expect(migration114406).toContain(
      'hotel_seven_arches_reviewed_pricing_evolution_receipts',
    );
    expect(migration114406).toContain(
      'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts',
    );
    expect(migration).not.toContain(
      'hotel_v2_seven_arches_pricing_activation_canonical_json',
    );
    expect(migration114405).not.toContain(
      'hotel_v2_seven_arches_pricing_activation_canonical_json',
    );
  });

  test('pins one strict transport-stable semantic fingerprint contract', () => {
    for (const marker of [
      'hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)',
      'hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)',
      "return to_jsonb(trim_scale((p_value#>>'{}')::numeric));",
      "p_plan-'plan_fingerprint'",
      "is distinct from 'number'",
      "'100.001'::jsonb",
      `'"100.00"'::jsonb`,
      'hotels_v2_seven_arches_pricing_activation_transport_canonicalization_failed',
    ]) expect(migration114406).toContain(marker);

    expect(migration114406).toMatch(
      /if v_type='array' then[\s\S]*jsonb_array_elements\(p_value\) with ordinality/,
    );
    expect(migration114406).toMatch(
      /if v_type='object' then[\s\S]*jsonb_each\(p_value\)/,
    );
    expect(migration114406).toContain(
      'v_plan:=public.hotel_v2_seven_arches_pricing_activation_canonical_json(',
    );
    expect(migration114406).toMatch(
      /p_reviewed_plan-'plan_fingerprint'\)\s+is distinct from p_reviewed_plan-'plan_fingerprint'/,
    );
    expect(migration114406).toMatch(
      /new\.reviewed_plan-'plan_fingerprint'\)\s+is distinct from new\.reviewed_plan-'plan_fingerprint'/,
    );
    expect(migration114406).toContain(
      "v_review.reviewed_plan-'plan_fingerprint') is not distinct from",
    );

    const evolvedPins = [
      '34a597ce33e7340b4c3779ecf60286abc51aa67661954a9b616a9f2af2eb0e06',
      '17f80cd334cfd5aeeef64b620dcf4785a5a662e1a1a0e64696516f86c778ffe0',
      'c75f83699e6d8c1c8234dbd6fec8a81dd2a337e9e193289df39f7a730b9014fd',
      '786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef',
      '9d2376f4f1f8e035ffd93818ab382b1e2858dd10b38688fe8a31d3fc5845278c',
      '2829ec9059a4e035344ed35d26c7cac1d12c7296fd91ab498c7df78aa8f13dee',
    ];
    for (const pin of evolvedPins) {
      expect(migration114406).toContain(pin);
      expect(recursionVerifier).toContain(pin);
    }
    expect(migration114406).toContain(
      'from public,anon,authenticated,service_role',
    );
    expect(migration114406).toContain(
      "array['search_path=pg_catalog, public, auth']::text[]",
    );
    expect(migration114406).toContain(
      "array['search_path=pg_catalog, public']::text[]",
    );
  });

  test('requires the real browser/PostgREST round-trip gate and rollback evidence', () => {
    for (const marker of [
      'hotels_v2_114406_browser_roundtrip_postgrest_gate_v1',
      'loopback_preinstalled_114406',
      'JSON.parse(JSON.stringify(value))',
      'const previewTransportJson = JSON.stringify(serverPlan)',
      'const roundTrippedPlan = JSON.parse(previewTransportJson)',
      'pre_114406_review_rejected',
      'receipt_review_context_proof',
      'automatic_apply_retries: 0',
      'browser_roundtrip_apply=PASS',
    ]) expect(browserRoundTrip).toContain(marker);
    expect(browserRoundTrip).toContain(
      "const INVALID_PLAN = 'hotels_v2_seven_arches_pricing_activation_invalid_plan'",
    );
    expect(browserRoundTrip).toContain(
      'invalid Apply attempts changed Review, receipt or transaction-context state',
    );
    expect(browserRoundTrip).toContain(
      "numericStringPayload.operation.payload.upper_base_nightly_rate = '100.00'",
    );
    expect(browserRoundTrip).toContain(
      'assert.equal(validApplyCount, 1)',
    );
  });

  test('uses only the evolved post-114406 source and topology pins downstream', () => {
    const evolvedPins = [
      '34a597ce33e7340b4c3779ecf60286abc51aa67661954a9b616a9f2af2eb0e06',
      '17f80cd334cfd5aeeef64b620dcf4785a5a662e1a1a0e64696516f86c778ffe0',
      'c75f83699e6d8c1c8234dbd6fec8a81dd2a337e9e193289df39f7a730b9014fd',
      '786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef',
      '9d2376f4f1f8e035ffd93818ab382b1e2858dd10b38688fe8a31d3fc5845278c',
      '2829ec9059a4e035344ed35d26c7cac1d12c7296fd91ab498c7df78aa8f13dee',
    ];
    for (const pin of evolvedPins) expect(independentPricing).toContain(pin);

    expect(forwardChain).toContain(
      '9e6b4c993551d4e6f8c23529c316ee39c63b99a91dc3631477ee228da577ec25',
    );
    expect(forwardChain).toContain(
      'a11c3e98442af4beaaa7c058f576ca393565b0dcc539304c6e345ea6377b830b',
    );
    expect(reviewedPricing).toContain(
      'a11c3e98442af4beaaa7c058f576ca393565b0dcc539304c6e345ea6377b830b',
    );
    expect(applicationBridge).toContain(
      'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650',
    );
    expect(providerMigration).toContain(
      '9e6b4c993551d4e6f8c23529c316ee39c63b99a91dc3631477ee228da577ec25',
    );
    expect(providerMigration).toContain(
      'cf03f7dfa57e3cdc2f3097f5ce0dc3c0999c774a49d37603ffa45b0433a60e62',
    );
    expect(providerMigration).toContain(
      '598c3510d00ae3b71d15b20906fc6c00eb01f70e11c89eee5bb49bcdeae41d9b',
    );
    expect(providerVerifier).toContain(
      'cf03f7dfa57e3cdc2f3097f5ce0dc3c0999c774a49d37603ffa45b0433a60e62',
    );

    const post114406 = [
      recursionVerifier,
      independentPricing,
      reviewedPricing,
      applicationBridge,
      providerMigration,
      providerVerifier,
      forwardChain,
    ].join('\n');
    for (const stalePin of [
      '8579d307515355dfc45520887782c026da197e40680e9dc15381710f42e2bb26',
      'b85e47c8e5a61832dbbc909fb120d38d965d0077914f2d8009249ca9a8ffb3f6',
      '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758',
      '31004936b1e020921127a449bf75a3d2f2b4a3e248f083cb1c954581d5f82cf0',
      'ba5c87a85d78f7e4dbcea01202200c640d137a11cc9fa53dec09ff63a8dcc289',
      '5e7e3112b16b37f3df475b7ade59ede8bed9fb246fb8d2a292dd4d296bd47b2e',
      'fe87a30bafb9d2b2579a80a53701298fed797fa097f83c70d0fd1f331a776686',
    ]) expect(post114406).not.toContain(stalePin);
  });
});
