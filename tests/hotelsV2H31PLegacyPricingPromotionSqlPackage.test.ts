import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string): string => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Hotels V2 H3.1P SQL deployment package', () => {
  const migration = read('supabase/migrations/20260811310000_hotels_v2_h3_1_legacy_pricing_promotion.sql');
  const preflight = read('supabase/manual/hotels_v2_h3_1_legacy_pricing_promotion_preflight.sql');
  const foundation = read('supabase/manual/hotels_v2_h3_1_legacy_pricing_promotion_verify.sql');
  const postAdmin = read('supabase/manual/hotels_v2_h3_1_legacy_pricing_promotion_post_admin_verify.sql');

  test('is additive, public-inert, and pins the exact reviewed source contract', () => {
    expect(migration).toContain('add column pricing_guest_count smallint');
    expect(migration).toContain('create table public.hotel_pricing_promotion_reviews');
    expect(migration).toContain('7208ab4ecc0e47abd64d87ca1ac53a03');
    expect(migration).toContain("c_contract constant text:='seven_kamares_legacy_to_h3_pricing_v1'");
    expect(migration).toContain("'public_change',false");
    expect(migration).toContain("'legacy_authoritative',true");
    expect(migration).toContain("v_schedule.is_active");
    expect(migration).not.toMatch(/update\s+public\.hotels\s/i);
    expect(migration).not.toMatch(/update\s+public\.hotel_bookings\s/i);
    expect(migration).not.toMatch(/update\s+public\.partner_service_fulfillments\s/i);
    expect(migration).toContain("notify pgrst,'reload schema'");
    expect(migration.trim().endsWith('commit;')).toBe(true);
  });

  test('keeps the dedicated promotion as sole first writer and preserves H3.1 round-trip', () => {
    expect(migration).toContain('hotels_v2_h3_1p_dedicated_pricing_promotion_required');
    expect(migration).toContain('hotels_v2_h3_1p_pricing_guest_count_required');
    expect(migration).toContain("'pricing_guest_count',item.pricing_guest_count");
    expect(migration).toContain('pricing_guest_count=v_pricing_guest_count');
    expect(migration).toContain('hotel_v2_admin_apply_h3_1_configuration_h3_1p_core');
    expect(migration).toContain("set_config('hotels_v2.h3_1p_allocation_rewrite','on',true)");
    expect(migration).toContain("set_config('hotels_v2.h3_1p_allocation_rewrite','off',true)");
    expect(migration).toContain('hotels_v2_h3_1p_reviewed_allocation_graph_required');
    expect(migration).toContain('hotels_v2_h3_1p_reviewed_pricing_contract_required');
    expect(migration).toContain('v_hotel_id is distinct from c_hotel');
    expect(migration).toContain("p_plan->>'decision' is distinct from 'promote_room_schedule_to_reviewed'");
    expect(migration).toContain("p_plan->>'reviewed_at' is null");
  });

  test('enforces exact physical and pricing occupancy plus 70-case zero parity', () => {
    for (const code of ['guests-5-bundle', 'guests-6-bundle', 'guests-7-bundle', 'guests-8-bundle']) {
      expect(migration).toContain(code);
    }
    expect(migration).toContain("then 2");
    expect(migration).toContain("then 3");
    expect(migration).toContain("then 4");
    expect(migration).toContain("'threshold_case_count',threshold_case_count");
    expect(migration).toContain("'long_stay_case_count',long_stay_case_count");
    expect(migration).toContain("'total_case_count',total_case_count");
    expect(migration).toContain("(v_parity->>'threshold_case_count')::integer<>63");
    expect(migration).toContain("(v_parity->>'long_stay_case_count')::integer<>7");
    expect(migration).toContain("(v_parity->>'total_case_count')::integer<>70");
    expect(migration).toContain("'total_mismatch_count'");
    expect(migration).toContain('minimum_billable_occupancy');
    expect(migration).toContain('greatest(matched.guest_count,schedule.minimum_billable_occupancy)');
  });

  test('uses Admin-only definer RPCs, private helpers, RLS receipts, and protected snapshots', () => {
    expect(migration).toContain('hotel_v2_admin_get_legacy_pricing_promotion_preview');
    expect(migration).toContain('hotel_v2_admin_apply_legacy_pricing_promotion');
    expect(migration).toContain('security definer');
    expect(migration).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(migration).toContain('alter table public.hotel_pricing_promotion_reviews enable row level security');
    expect(migration).toContain('hotel_pricing_promotion_reviews_admin_select');
    expect(migration).toContain('revoke all on table public.hotel_pricing_promotion_reviews from public,anon,authenticated');
    expect(migration).toContain('grant select on table public.hotel_pricing_promotion_reviews to authenticated');
    expect(migration).toContain('hotels_v2_h3_1p_protected_snapshot');
    for (const relation of [
      'hotel_bookings', 'partner_service_fulfillments', 'service_deposit_requests',
      'service_coupon_redemptions', 'referrals', 'affiliate_cashout_requests', 'site_settings',
    ]) expect(migration).toContain(relation);
  });

  test('ships separate preflight, inert foundation, and post-Admin verification gates', () => {
    expect(preflight).toContain('hotels_v2_h3_1_legacy_pricing_promotion_preflight_safe');
    expect(preflight).toContain('booking/fulfillment history drift');
    expect(preflight).toContain('physical allocation mismatch');
    expect(foundation).toContain('hotels_v2_h3_1_legacy_pricing_promotion_foundation_safe');
    expect(foundation).toContain("promotion,status}'='not_reviewed'");
    expect(foundation).toContain('pricing_guest_count is not null');
    expect(postAdmin).toContain('hotels_v2_h3_1_legacy_pricing_promotion_safe');
    expect(postAdmin).toContain("promotion,status}'='reviewed'");
    expect(postAdmin).toContain('five_exact_count=2');
    expect(postAdmin).toContain('seven_exact_count=2');
    expect(postAdmin).toContain('upper_photo_count=6');
    expect(postAdmin).toContain('ground_photo_count=5');
    for (const file of [preflight, foundation, postAdmin]) {
      expect(file).toContain('HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH');
      expect(file).toContain('HOTEL_LEGACY_PRICE_MISMATCH');
      expect(file).toContain('HOTEL_LEGACY_PUBLIC_MISMATCH');
      expect(file).toContain('HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE');
    }
  });
});
