import crypto from 'node:crypto';
import fs from 'node:fs';

const paths = {
  adminA: 'supabase/migrations/20260811330000_hotels_v2_admin_a_room_gallery_post_promotion_repair.sql',
  adminB: 'supabase/migrations/20260811340000_hotels_v2_admin_b_content_room_assignment_control.sql',
  migration: 'supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql',
  preflight: 'supabase/manual/hotels_v2_admin_c_pricing_control_preflight.sql',
  foundation: 'supabase/manual/hotels_v2_admin_c_pricing_control_verify.sql',
  postAdmin: 'supabase/manual/hotels_v2_admin_c_pricing_control_post_admin_verify.sql',
  manualGate: 'tests/integration/hotels-v2-admin-c-pricing-control-manual-package-gate.sql',
  postgresGate: 'tests/integration/hotels-v2-admin-c-pricing-control-postgres-gate.sql',
  postgrestBase: 'tests/integration/hotels-v2-admin-c-pricing-control-postgrest-base.sql',
  postgrestGate: 'tests/integration/hotels-v2-admin-c-pricing-control-postgrest-gate.mjs',
} as const;

const read = (path: string): string => fs.readFileSync(path, 'utf8');
const hash = (path: string): string => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const migration = read(paths.migration);
const core = read('admin/hotels-v2-workspace-core.js');
const repository = read('admin/hotels-v2-workspace-repository.js');
const ui = read('admin/hotels-v2-workspace.js');
const postAdmin = read(paths.postAdmin);
const manualGate = read(paths.manualGate);
const postgresGate = read(paths.postgresGate);
const postgrestGate = read(paths.postgrestGate);

describe('Hotels V2 ADMIN-C independent frozen-package adversarial gate', () => {
  test('pins the frozen ADMIN-C package while proving ADMIN-A and ADMIN-B stayed byte-identical', () => {
    expect(Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, hash(path)]))).toEqual({
      adminA: '9452473a9ae3daa1cd7701eba74ac1b4366903846b9399162035d463f5e91e56',
      adminB: '94d78d928ea62bbf2258daec6acca51358d04798d721c082eb18028385e1fbf4',
      migration: '6a0c5bdb51bf145b6de478b0482226bd5ddcde37a6b590604d28897ba31072ae',
      preflight: 'ccd160a0b653e42d7c558ebc0e0911725c7b601177a08c6ceff13357f2392b25',
      foundation: '9d0e0a8c91f4c7fa97163630c3e1e5f7942899e2aba3465355acd55113ecbcc5',
      postAdmin: 'bba0c49a1ed7713094d670f6e2eb277c4745b34a9dad9638072b39057b4addd9',
      manualGate: 'de62b3e0f16bf9a86a289899e7d4874bb2f2f46aad217d3218a0e309350f143e',
      postgresGate: '39d9582692c1f78c9fa9259ea62d8ce83627a1710fe47be7f46a6e8a517689be',
      postgrestBase: '95968b1a0ddb1b208420336011ff969b72b66ccadbd28e78423eece2a1081993',
      postgrestGate: 'aa4670a4ddc957cec777192907c68743dccf98e2323e68d8e3ac0598c7ec1ec1',
    });
  });

  test('keeps SQL and Core transport identities and timestamps on the same canonical boundary', () => {
    const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
    expect(migration).toContain(uuidPattern);
    expect(core).toContain(uuidPattern);
    expect(migration).not.toContain('[1-8][0-9a-f]{3}');
    expect(core).not.toContain('[1-8][0-9a-f]{3}');
    for (const probe of [
      "'c2000000-0000-5000-8000-000000000001'",
      "'c2000000-0000-7000-8000-000000000001'",
      "'2028-02-29'",
      "'2027-02-29'",
      "'2027-02-28T23:59:59.123456+14:00'",
      "'2027-02-28T24:00:00Z'",
    ]) expect(postgresGate).toContain(probe);
    expect(core).toContain('offsetHour <= 14 && offsetMinute <= 59');
    expect(migration).toContain('v_offset_hour not between 0 and 14 or v_offset_minute not between 0 and 59');
  });

  test('retires older pricing writers and preserves the shared Calendar row contract', () => {
    for (const oldWriter of [
      'hotel_v2_admin_apply_workspace_plan_admin_c_core',
      'hotel_v2_admin_apply_calendar_plan_admin_c_core',
      'hotel_v2_admin_apply_h3_1_configuration_admin_c_core',
      'hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core',
    ]) {
      expect(migration).toContain(oldWriter);
      expect(migration).toContain(`revoke all on function public.${oldWriter}`);
    }
    expect(migration).toContain("operation.value->>'entity' is distinct from 'unit'");
    expect(migration).toContain("operation.value->>'entity' not in('payment_policy','commission_policy','calendar_source')");
    expect(migration).toContain("message='hotels_v2_admin_c_calendar_pricing_smuggling_denied'");
    expect(migration).toContain("message='hotels_v2_admin_c_shared_pricing_row_preserved'");
    expect(migration).toContain("'shared_with_calendar',(override_row.closed_mode is not null");
    expect(postgresGate).toContain('admin_c_operational_shared_row_update_staled_pricing');
    expect(postgresGate).toContain('admin_c_same_row_calendar_race_not_stale');
    expect(postgrestGate).toContain('closureOnly.shared_with_calendar');
  });

  test('pins deterministic replay, semantic no-op suppression, preview authority and the exact 7K oracle', () => {
    expect(migration).toContain("'hotels-v2-admin-c-key:'||v_actor::text||':'||p_idempotency_key");
    expect(migration).toContain("return jsonb_set(v_receipt.result,'{replayed}','true'::jsonb,true)");
    expect(migration).toContain("'replayed',false,'changed',v_changed,'activity',v_activity");
    expect(repository).toContain('mutation will not be retried.');
    expect(repository).toContain('data.replayed !== true && data.activity.some');
    expect(postgresGate).toContain('admin_c_shared_schedule_noop_failed');
    expect(postgresGate).toContain('v_expected_threshold:=least(v_nights,10)');
    expect(postgresGate).toContain('for v_guest in 1..8 loop');
    expect(postgresGate).toContain('admin_c_7k_one_guest_floor_failed');
    expect(postgresGate).toContain('admin_c_7k_one_night_fail_closed_failed');
    expect(postgrestGate).toContain('for (const nights of [2, 3, 7, 14, 15])');
    expect(migration).toContain("'requestable',v_requestable");
    expect(migration).toContain("'customer_total',case when v_ok then round(v_total,2) else null end");
    expect(migration).toContain("'exact_date_price','seasonal_range_rule'");
  });

  test('makes manual verification substantive and localizes chrome without mutating reviewed business data', () => {
    for (const [key, relation] of [
      ['pricing_schedule_occupancy_tiers', 'hotel_pricing_schedule_occupancy_tiers'],
      ['room_rate_occupancy_tiers', 'hotel_room_rate_occupancy_tiers'],
      ['allocation_rule_items', 'hotel_room_allocation_rule_items'],
    ]) {
      expect(postAdmin).toContain(`'${key}',md5`);
      expect(postAdmin).toContain(`from public.${relation} row_value`);
      expect(manualGate).toContain(`'${key}',md5`);
      expect(manualGate).toContain(`from public.${relation} row_value`);
    }
    for (const counter of [
      'HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PUBLIC_MISMATCH',
      'HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE',
    ]) expect(postAdmin).toContain(counter);
    expect(postAdmin).toContain('protected_history_fingerprints');
    expect(postAdmin).toContain('hotels_v2_admin_c_pricing_control_post_admin_safe');
    expect(ui).not.toContain('document.createTreeWalker(rootNode');
    expect(ui).toContain('Never walk the whole');
    expect(ui).toContain("<dt>${pricingUiHtml('Customer selling price')}</dt>");
    expect(ui).toContain("${pricingUiHtml('Choose schedule ownership')}</option>");
    expect(ui).toContain("${pricingUiHtml('Choose exact Room Rate product')}</option>");
    expect(ui).toContain("${reviewChromeHtml('Field')}</th>");
    expect(ui).toContain('${escapeHtml(Core.i18nText(plan.name_i18n, pricingUiLanguage(), plan.code))}');
    expect(ui).toContain('${escapeHtml(Core.i18nText(schedule.name_i18n, pricingUiLanguage(), schedule.code))}');
  });
});
