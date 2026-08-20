import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string): string => fs.readFileSync(
  path.join(process.cwd(), relative), 'utf8',
);

const migration = read(
  'supabase/migrations/20260811330000_hotels_v2_admin_a_room_gallery_post_promotion_repair.sql',
);
const preflight = read(
  'supabase/manual/hotels_v2_admin_a_room_gallery_post_promotion_preflight.sql',
);
const foundation = read(
  'supabase/manual/hotels_v2_admin_a_room_gallery_post_promotion_verify.sql',
);
const postAdmin = read(
  'supabase/manual/hotels_v2_admin_a_room_gallery_post_admin_verify.sql',
);
const postgresGate = read(
  'tests/integration/hotels-v2-admin-a-room-gallery-post-promotion-postgres-gate.sql',
);
const postgrestBase = read(
  'tests/integration/hotels-v2-admin-a-room-gallery-post-promotion-postgrest-base.sql',
);
const postgrestGate = read(
  'tests/integration/hotels-v2-admin-a-room-gallery-post-promotion-postgrest-gate.mjs',
);

describe('Hotels V2 ADMIN-A post-H3.1P Room Type gallery repair', () => {
  test('accepts only the exact reviewed, inactive H3.1P commercial graph', () => {
    for (const marker of [
      'hotels_v2_admin_a_reviewed_schedule_v1',
      'seven_kamares_legacy_to_h3_pricing_v1',
      'allocation_pricing_occupancy_contract_mismatch',
      "review.result->>'target_fingerprint'=review.target_fingerprint",
      "review.result#>>'{room_schedule,tier_fingerprint}'=",
      "review.result#>>'{room_schedule,review_status}'='reviewed'",
      "review.result#>>'{room_schedule,is_active}'='false'",
      "v_promotion_snapshot#>>'{parity,total_case_count}'",
      "v_promotion_snapshot#>>'{parity,total_mismatch_count}'",
      "v_promotion_snapshot#>>'{safety,rate_plan_inactive}'",
      "v_promotion_snapshot#>>'{safety,room_rates_inactive}'",
      "v_promotion_snapshot#>>'{safety,all_flags_off}'",
    ]) expect(migration).toContain(marker);

    const runtimeStart = migration.indexOf('v_new:=$new$       or (select review_status');
    const runtimeEnd = migration.indexOf('$new$;', runtimeStart);
    const runtime = migration.slice(runtimeStart, runtimeEnd);
    expect(runtime).toContain("not in('requires_review','reviewed')");
    expect(runtime).not.toContain("v_promotion_snapshot->>'supported'");
    expect(runtime).not.toContain("v_promotion_snapshot#>>'{target,target_fingerprint}'");
  });

  test('locks before snapshotting and retains the established H3.1P order', () => {
    const injected = migration.slice(
      migration.indexOf('-- hotels_v2_admin_a_reviewed_schedule_v1'),
      migration.indexOf("v_old:=$old$       or (select review_status"),
    );
    expect(migration.indexOf('lock table public.site_settings in share mode;'))
      .toBeLessThan(migration.indexOf('perform 1 from public.hotels where id=c_hotel for share;'));
    expect(migration).toContain('Lock-order parity with H3.1P: flags precede Hotel/Room/commercial rows.');
    expect(migration).toContain('perform 1 from public.site_settings where id=1 for share;');
    expect(injected.indexOf('from public.hotel_pricing_schedules'))
      .toBeLessThan(injected.indexOf('v_promotion_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot'));
    for (const relation of [
      'hotel_rate_plans', 'hotel_room_rates', 'hotel_pricing_schedules',
      'hotel_pricing_schedule_occupancy_tiers', 'hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items', 'hotel_pricing_promotion_reviews',
    ]) expect(injected).toContain(`public.${relation}`);
  });

  test('makes Room Type upserts and activity truly no-op safe', () => {
    expect(migration).toContain('hotels_v2_admin_a_noop_room_upsert_v1');
    expect(migration).toContain('v_after:=null;');
    expect(migration).toContain('where row(');
    expect(migration).toContain(') is distinct from row(');
    expect(migration).toContain('if v_after is not null then');
    const returning = 'returning to_jsonb(hotel_room_types.*) into v_after;';
    const generated = migration.slice(
      migration.indexOf('v_new:=$new$      legacy_source_key=excluded.legacy_source_key'),
      migration.indexOf('$new$;', migration.indexOf(
        'v_new:=$new$      legacy_source_key=excluded.legacy_source_key',
      )),
    );
    const generatedReturning = generated.match(new RegExp(
      returning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g',
    ));
    expect(generatedReturning).toHaveLength(1);
    expect(migration).toContain("/ length('returning to_jsonb(hotel_room_types.*) into v_after;')<>1");
  });

  test('keeps detailed three-way conflicts and mandatory version protection', () => {
    expect(migration).toContain('hotels_v2_h2b1_shadow_room_three_way_conflict');
    expect(migration).toContain('hotels_v2_admin_a_field_scoped_room_version_v1');
    expect(migration).toContain("raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_shadow_room'");
    expect(migration).toContain('A detailed owned-field conflict wins over the generic stale error');
    expect(migration).toContain('an unexpected version never receives a blind overwrite');
  });

  test('preserves the Admin-only definer boundary and every protected row', () => {
    expect(migration).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(migration).toContain(
      'revoke all on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)',
    );
    expect(migration).toContain(
      'grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)',
    );
    expect(migration).toContain('to authenticated;');
    for (const relation of [
      'hotels', 'hotel_bookings', 'partner_service_fulfillments', 'site_settings',
      'service_deposit_requests', 'service_deposit_rules', 'service_deposit_overrides',
      'service_coupons', 'service_coupon_redemptions', 'hotel_activity_log',
      'referrals', 'affiliate_commission_events', 'affiliate_payouts',
      'affiliate_adjustments', 'affiliate_program_settings',
      'affiliate_referrer_overrides', 'affiliate_cashout_requests',
      'profile_referral_code_aliases',
    ]) expect(migration).toContain(`'${relation}'`);
    expect(migration).toContain('hotels_v2_admin_a_gallery_repair_changed_protected_data');
    expect(migration).toContain('hotels_v2_admin_a_gallery_repair_changed_hotels_rls');
  });

  test('ships SQL Editor-safe read-only gates and complete cross-run fingerprints', () => {
    const protectedRelations = [
      'service_deposit_requests', 'service_deposit_rules', 'service_deposit_overrides',
      'service_coupons', 'service_coupon_redemptions', 'referrals',
      'affiliate_commission_events', 'affiliate_payouts', 'affiliate_adjustments',
      'affiliate_program_settings', 'affiliate_referrer_overrides',
      'affiliate_cashout_requests', 'profile_referral_code_aliases',
    ];
    for (const file of [preflight, foundation, postAdmin]) {
      expect(file).toContain('protected_relation_fingerprints');
      expect(file).toContain('query_to_xml');
      for (const relation of protectedRelations) expect(file).toContain(`'${relation}'`);
      expect(file).not.toMatch(/^\s*\\(?:set|if|else|endif|ir|i)\b/im);
      expect(file).toContain('HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH');
      expect(file).toContain('HOTEL_LEGACY_PRICE_MISMATCH');
      expect(file).toContain('HOTEL_LEGACY_PUBLIC_MISMATCH');
      expect(file).toContain('HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE');
    }
    expect(preflight).toContain('hotels_v2_admin_a_room_gallery_post_promotion_preflight_safe');
    expect(foundation).toContain('hotels_v2_admin_a_room_gallery_post_promotion_foundation_safe');
    expect(postAdmin).toContain('hotels_v2_admin_a_room_gallery_post_admin_safe');
    expect(postAdmin).toContain('939828b55bd9467be64b3b28cabbf598');
    expect(postAdmin).toContain('1e90ead9d89f58757eebae5268cb50d2');
    expect(postAdmin).toContain('version=21');
    expect(postAdmin).toContain('version=20');
  });

  test('isolated PostgreSQL gate covers red cause, legitimate edits and true conflicts', () => {
    for (const marker of [
      'returned_sqlstate', 'message_text', 'pg_exception_detail',
      'pg_exception_hint', 'pg_exception_context',
      'hotels_v2_h2b1_stale_pricing_schedule',
      'hotels_v2_h2b1_shadow_room_three_way_conflict',
      'hotels_v2_h2b1_stale_shadow_room',
      'admin_a_exact_noop_failed', 'admin_a_second_edit_failed',
      'admin_a_stored_mapping_guard_failed',
      'HOTELS_V2_ADMIN_A_ROOM_GALLERY_POST_PROMOTION_POSTGRES_GATE_PASS',
    ]) expect(postgresGate).toContain(marker);
    for (const relation of [
      'service_deposit_requests', 'service_deposit_rules', 'service_deposit_overrides',
      'service_coupons', 'service_coupon_redemptions', 'referrals',
      'affiliate_commission_events', 'affiliate_payouts', 'affiliate_adjustments',
      'affiliate_program_settings', 'affiliate_referrer_overrides',
      'affiliate_cashout_requests', 'profile_referral_code_aliases',
    ]) expect(postgresGate).toContain(`'${relation}'`);
    expect(postgresGate).toContain("if to_regclass('public.'||v_relation) is not null then");
  });

  test('real HTTP gate enforces roles, explicit re-review recovery and no automatic retry', () => {
    expect(postgrestBase).toContain('pg_temp.admin_a_initial_room_update_plan');
    expect(postgrestBase).toContain('security definer');
    for (const principal of ['anon', 'non-admin', 'partner']) {
      expect(postgrestGate).toContain(principal);
    }
    expect(postgrestGate).toContain('const prepareRequestCountBeforeConflict = prepareRequestCount');
    expect(postgrestGate).toContain('prepareRequestCountBeforeConflict + 1');
    expect(postgrestGate).toContain('const conflictRefresh = await workspace()');
    expect(postgrestGate).toContain('p_plan: reviewedPlan(conflictRefresh, approved)');
    expect(postgrestGate).toContain('const recovered = await rpc(');
    expect(postgrestGate).toContain("assert.equal(recovered.status, 200");
    expect(postgrestGate).toContain('recovered.payload.activity[0].entity_id, UPPER');
    expect(postgrestGate).toContain('recovered.payload.activity[0].before_state.gallery, concurrentGallery');
    expect(postgrestGate).toContain('recovered.payload.activity[0].after_state.gallery, approved.upper');
    expect(postgrestGate).toContain('prepareRequestCountBeforeConflict + 2');
    for (const rejection of [
      'foreignHotel.status, 400', 'foreignRoom.status, 400',
      'topLevelSmuggling.status, 400', 'nestedSmuggling.status, 400',
    ]) expect(postgrestGate).toContain(rejection);
    expect(postgrestGate).toContain('upperInitialVersion + 4');
    expect(postgrestGate).toContain('groundInitialVersion');
  });
});
