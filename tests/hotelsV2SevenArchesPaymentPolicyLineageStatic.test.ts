import crypto from 'node:crypto';
import fs from 'node:fs';

const read = (filename: string): string => fs.readFileSync(filename, 'utf8');
const sha256 = (value: string | Buffer): string => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

function functionBody(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing function marker: ${marker}`);
  const match = source.slice(start).match(/as \$function\$([\s\S]*?)\$function\$;/);
  if (!match) throw new Error(`Missing function body: ${marker}`);
  return match[1];
}

const migration114400Path =
  'supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql';
const migration114400 = read(migration114400Path);
const migration114405 = read(
  'supabase/migrations/20260811440500_hotels_v2_seven_arches_pricing_activation_recursion_compatibility.sql',
);
const migration114410 = read(
  'supabase/migrations/20260811441000_hotels_v2_seven_arches_independent_pricing_evolution.sql',
);
const migration114415 = read(
  'supabase/migrations/20260811441500_hotels_v2_seven_arches_reviewed_pricing_evolution.sql',
);
const migration114450 = read(
  'supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql',
);
const migration112900 = read(
  'supabase/migrations/20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql',
);
const migration113100 = read(
  'supabase/migrations/20260811310000_hotels_v2_h3_1_legacy_pricing_promotion.sql',
);
const migration113500 = read(
  'supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql',
);
const base = read(
  'tests/integration/hotels-v2-seven-arches-pricing-activation-postgres-base.sql',
);
const reviewedEvolutionFixture = read(
  'tests/integration/hotels-v2-seven-arches-payment-policy-reviewed-evolution-fixture.sql',
);
const paymentGate = read(
  'tests/integration/hotels-v2-seven-arches-payment-policy-lineage-postgres-gate.sql',
);

const helperMarker =
  'create function public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()';
const snapshotMarker =
  'create or replace function public.hotel_v2_h3_1p_pricing_promotion_snapshot(p_hotel_id uuid)';
const writerMarker =
  'create function public.hotel_v2_admin_apply_h3_1_configuration(';
const helperBody = functionBody(migration114400, helperMarker);
const snapshotBody = functionBody(migration114400, snapshotMarker);

const WRITER_HASHES = {
  publicWrapper: '2e5c577dc7999322adef814a1658156ccf9e22958b58939033f0baf4af9d6fc7',
  adminCCore: 'da58fde24cde49476306b3c16340091989f66200f05d9fe1617dc4efaaf82048',
  h31pCore: 'edcf0db5c9b3bcac0736893b5970c21ddce9876eed01327cc001123265ee111d',
};

describe('Hotels V2 7 Arches reviewed payment-policy lineage', () => {
  test('pins the exact helper source and its private security boundary', () => {
    expect(sha256(helperBody)).toBe(
      '6df11e8680d35ca8caf3a4f4492276105f2b150422f3b086b64ad82d5f6e164d',
    );
    const definition = migration114400.slice(
      migration114400.indexOf(helperMarker),
      migration114400.indexOf('$function$;', migration114400.indexOf(helperMarker)) + 11,
    );
    expect(definition).toContain('returns boolean language plpgsql stable security definer');
    expect(definition).toContain('set search_path=pg_catalog,public');
    expect(migration114400).toContain(
      'alter function public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()\n  owner to postgres;',
    );
    expect(migration114400).toContain(
      'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()\nfrom public,anon,authenticated,service_role;',
    );
  });

  test('preserves the three accepted writer sources and pins exact runtime metadata', () => {
    const publicWrapperBody = functionBody(migration113500, writerMarker);
    const adminCCoreBody = functionBody(migration113100, writerMarker);
    const preCompatibilityH31pCore = functionBody(migration112900, writerMarker);
    const externalFlagNeedle = 'hotel_rooms_v2_enabled or hotel_external_sync_enabled';
    expect(preCompatibilityH31pCore.split(externalFlagNeedle)).toHaveLength(2);
    const installedH31pCore = preCompatibilityH31pCore.replace(
      externalFlagNeedle,
      'hotel_rooms_v2_enabled or false',
    );

    expect(sha256(publicWrapperBody)).toBe(WRITER_HASHES.publicWrapper);
    expect(sha256(adminCCoreBody)).toBe(WRITER_HASHES.adminCCore);
    expect(sha256(installedH31pCore)).toBe(WRITER_HASHES.h31pCore);
    for (const expectedHash of Object.values(WRITER_HASHES)) {
      expect(helperBody).toContain(expectedHash);
    }
    expect(helperBody).toContain("'plpgsql','v'::\"char\",true");
    expect(helperBody).toContain("array['search_path=pg_catalog, public, auth']::text[]");
    expect(helperBody).toContain("array['search_path=pg_catalog, public']::text[]");
    expect(helperBody).toContain('procedure_row.proowner<>\'postgres\'::regrole');
    expect(helperBody).toContain("has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')");
  });

  test('trusts exact ordered Admin activity lineage, never broad method containment', () => {
    expect(helperBody).not.toMatch(/payment_methods\s*@>/);
    expect(helperBody).toContain("c_supported constant text[]:=array[\n    'bank_transfer','cash','card','online']::text[]");
    expect(helperBody).toContain("activity.source='hotels_v2_h3_1_admin_configuration'");
    expect(helperBody).toContain("activity.actor_type='admin'");
    expect(helperBody).toContain('count(distinct activity.correlation_id)::integer');
    expect(helperBody).toContain('lag(activity.after_state) over(order by activity.created_at,activity.id)');
    expect(helperBody).toContain('activity.before_state is not distinct from\n            activity.previous_after_state');
    expect(helperBody).toContain('v_activity_count<>v_policy.version');
    expect(helperBody).toContain('v_correlation_count<>v_activity_count');
    expect(helperBody).toContain('v_latest_state is distinct from v_current_state');
    expect(helperBody).not.toContain("array['bank_transfer','card','online']");
    expect(helperBody).not.toContain("array['bank_transfer','card','cash']");
  });

  test('holds fixed commercial semantics while permitting only schema-supported methods', () => {
    for (const exactFragment of [
      "term.sequence=1 and term.due_event='after_partner_acceptance'",
      "term.amount_mode='percent_total' and term.amount_value=50",
      "term.sequence=2 and term.due_event='on_arrival'",
      "term.amount_mode='remaining_balance' and term.amount_value is null",
      "term.recipient='partner'",
      'public.hotel_v2_h3_1_codes_valid(term.payment_methods)',
      'term.payment_methods<@c_supported',
    ]) expect(helperBody).toContain(exactFragment);
    expect(helperBody).toContain('jsonb_array_length(activity.after_state->\'terms\')=2');
    expect(helperBody).toContain('count(distinct method.value)');
    expect(migration114400).toContain(
      "v_commission->>'commission_mode'<>'per_allocated_room_per_night'",
    );
    expect(migration114400).toContain("(v_commission->>'amount')::numeric<>10");
  });

  test('pins the inert consumer inventory and rejects a new executable rail', () => {
    expect(helperBody).toContain("procedure_row.prosrc~'\\mpayment_methods\\M'");
    expect(helperBody).toContain(
      "'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)'::regprocedure",
    );
    expect(helperBody).toContain(
      "'public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)'::regprocedure",
    );
    expect(helperBody).toContain(
      "'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure)<>2",
    );
    expect(helperBody).toContain('exists(select 1 from pg_views view_row');
    expect(helperBody).toContain('exists(select 1 from pg_matviews view_row');
    expect(paymentGate).toContain('new_executable_payment_method_consumer');
  });

  test('evolves only the receipt-gated promotion snapshot compatibility dependency', () => {
    expect(sha256(snapshotBody)).toBe(
      '2fcbd3faf9deab53d06332141cb76ab383bf5e0d87fb4309478a8fbc431ae339',
    );
    expect(snapshotBody).toContain(
      'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
    );
    expect(snapshotBody).toContain("review.review_status='reviewed'");
    for (const exactCompatibilityProjection of [
      "'{source,pricing_fingerprint}'",
      "'{source,tier_fingerprint}'",
      "'{target,target_fingerprint}'",
      "'{pricing_occupancy_mapping_fingerprint}'",
      "'{parity,fingerprint}'",
      "'{parity,total_case_count}'",
      "'{parity,total_mismatch_count}'",
    ]) expect(snapshotBody).toContain(exactCompatibilityProjection);
    expect(snapshotBody).toContain("'current_successor',jsonb_build_object(");
    expect(snapshotBody).toContain('to_jsonb(v_promotion.target_fingerprint),false)');
    for (const evidence of [
      'v_promotion.source_fingerprint',
      'v_promotion.source_tier_fingerprint',
      'v_promotion.pricing_occupancy_mapping_fingerprint',
      'v_promotion.parity_fingerprint',
      'v_promotion.parity_case_count<>70',
      'v_promotion.parity_mismatch_count<>0',
      'v_promotion.acknowledged_pricing_occupancy_mapping',
    ]) expect(snapshotBody).toContain(evidence);
    expect(migration114450).toContain(
      "'''2fcbd3faf9deab53d06332141cb76ab383bf5e0d87fb4309478a8fbc431ae339'''",
    );
    expect(migration114450).not.toContain(
      'b7f42109b544714bd31083357f7eb0f531fa10e01919640736aba150c556a118',
    );
    for (const downstream of [migration114405, migration114410, migration114415, migration114450]) {
      expect(downstream).not.toMatch(
        /create\s+or\s+replace\s+function\s+public\.hotel_v2_h3_1p_pricing_promotion_snapshot\s*\(/i,
      );
    }
  });

  test('covers the three-activity production shape, reviewed successor update and negatives', () => {
    const receiptBoundary = base.indexOf(
      '20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql',
    );
    const paymentEvolution = base.indexOf(
      'hotels-v2-seven-arches-payment-policy-reviewed-evolution-fixture.sql',
    );
    const operationalEvolution = base.indexOf(
      'hotels-v2-seven-arches-pricing-activation-exact-six-drift-fixture.sql',
    );
    expect(receiptBoundary).toBeGreaterThanOrEqual(0);
    expect(paymentEvolution).toBeGreaterThan(receiptBoundary);
    expect(operationalEvolution).toBeGreaterThan(paymentEvolution);
    expect(reviewedEvolutionFixture).toContain(
      'Activity 2: the accepted Admin workflow introduces the expanded',
    );
    expect(reviewedEvolutionFixture).toContain(
      'Activity 3: the same reviewed workflow deliberately recreates the exact',
    );
    expect(reviewedEvolutionFixture).toContain('entity_id=c_policy)<>3');
    expect(reviewedEvolutionFixture).toContain(
      "v_activity_1.action<>'create'\n     or v_activity_2.action<>'update' or v_activity_3.action<>'update'",
    );
    expect(reviewedEvolutionFixture).toContain(
      "v_activity_1.after_state is distinct from v_activity_2.before_state",
    );
    expect(reviewedEvolutionFixture).toContain(
      "v_activity_2.after_state is distinct from v_activity_3.before_state",
    );
    expect(reviewedEvolutionFixture).toContain(
      "v_activity_3.after_state is distinct from v_current",
    );
    expect(paymentGate).toContain('payment_policy_lineage_post_114450_reviewed_update_not_exact');
    expect(paymentGate).toContain(
      '2fcbd3faf9deab53d06332141cb76ab383bf5e0d87fb4309478a8fbc431ae339',
    );
    expect(paymentGate.match(/^SELECT pg_temp\.payment_lineage_expect_(?:false|sqlstate)\(/gm))
      .toHaveLength(38);
    expect(paymentGate).toContain('2::integer AS positive_count');
    expect(paymentGate).toContain('HOTELS_V2_7A_PAYMENT_POLICY_LINEAGE_GATE_PASS');
  });

  test('keeps every deployed migration through 114370 byte-identical', () => {
    const frozen = new Map<string, string>([
      ['supabase/migrations/20260811380000_hotels_v2_h3_2b_partner_hotel_workspace.sql', 'f93cc12a59234b5cf1d3271134ca2bfd5fd9876fcb5fbd2cab348c57d2db21fb'],
      ['supabase/migrations/20260811390000_hotels_v2_external_calendar_sync_foundation.sql', '285ae454171bbfc57f678e27273782555d918a17541e1cc19fb4d4cda8f6368a'],
      ['supabase/migrations/20260811400000_hotels_v2_external_calendar_worker_runtime.sql', '0d7c59cb4ca223b215f795a343740c41fe9de50766a18744b51e61e9cffc05ac'],
      ['supabase/migrations/20260811410000_hotels_v2_external_calendar_availability_projection.sql', '095a3bb7943fc04c5f2a1622c919a0f444adabb67952d3c0a77c64206d04b0a2'],
      ['supabase/migrations/20260811420000_hotels_v2_external_calendar_reviewed_control.sql', 'a490cf3b1d1826107e184b2caf345a6e9178f940fe611bc1d24e1cf72ffca3fc'],
      ['supabase/migrations/20260811430000_hotels_v2_external_calendar_scheduler.sql', '481e283f6815a81ead08fa57480f135140735e1900529f7df44fdaba049ed688'],
      ['supabase/migrations/20260811435000_hotels_v2_external_calendar_activation_compatibility.sql', 'ddd4042b6321235dbfd4ad96d1001854af81affe77470a72a6a784c53780946c'],
      ['supabase/migrations/20260811436000_hotels_v2_seven_arches_owner_operational_capabilities.sql', '771a113e6349518062a7c385fe8edbb3ead3c7be5f2336e3658174a367fbfc50'],
      ['supabase/migrations/20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql', 'f1318070a5e53d1ff7b75bb64dff9fe969ad8debeb1ddc9c57929bee128aea4a'],
    ]);
    for (const [filename, expected] of frozen) {
      expect(sha256(fs.readFileSync(filename))).toBe(expected);
    }
  });
});
