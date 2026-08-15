import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string): string => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Hotels V2 H3.2A Partner access database package', () => {
  const migration = read('supabase/migrations/20260811320000_hotels_v2_h3_2a_partner_access_foundation.sql');
  const preflight = read('supabase/manual/hotels_v2_h3_2a_partner_access_preflight.sql');
  const verify = read('supabase/manual/hotels_v2_h3_2a_partner_access_verify.sql');
  const postgresGate = read('tests/integration/hotels-v2-h3-2a-partner-access-postgres-gate.sql');

  test('creates only the approved three-table H3.2A boundary with no seeds', () => {
    for (const relation of [
      'hotel_partner_hotel_permissions',
      'hotel_partner_action_receipts',
      'hotel_partner_event_outbox',
    ]) expect(migration).toContain(`create table public.${relation}`);
    for (const deferred of [
      'hotel_partner_property_drafts',
      'hotel_media_assets',
      'hotel_booking_change_requests',
      'partner_payment_accounts',
      'partner_payment_account_events',
    ]) expect(migration).not.toContain(`create table public.${deferred}`);
    expect(migration).not.toMatch(/insert\s+into\s+public\.hotel_partner_hotel_permissions\s*[\s\S]*?values\s*\(\s*['"]/i);
    expect(migration.trim().endsWith('commit;')).toBe(true);
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  test('freezes all twelve capabilities and the sole-mutator boundary', () => {
    for (const capability of [
      'edit_property_content','edit_property_photos','edit_room_content','edit_room_photos',
      'create_rooms','edit_room_structure','manage_prices','manage_availability',
      'process_bookings','request_booking_changes','view_payment_status','initiate_stripe_onboarding',
    ]) expect(migration).toContain(capability);
    expect(migration).toContain('hotel_partner_hotel_permissions_one_mutator_uidx');
    expect(migration).toContain('where has_mutation_capability');
    expect(migration).toContain('hotels_v2_h3_2a_mutating_assignment_conflict');
    expect(migration).toContain("p_capability = 'initiate_stripe_onboarding' and v_role <> 'owner'");
    expect(migration).toContain("'{initiate_stripe_onboarding}'");
  });

  test('uses exact assignment, owner/staff scope, and safe Partner discovery', () => {
    expect(migration).toContain('hotel_partner_hotel_permissions_exact_assignment_fkey');
    expect(migration).toContain("user_scope.resource_type = 'hotels'");
    expect(migration).toContain('user_scope.resource_id = p_hotel_id');
    expect(migration).toContain('user_scope.resource_id = hotel.id');
    expect(migration).toContain('hotels_v2_h3_2a_partner_access_denied');
    expect(migration).toContain("'foundation_only', true");
    expect(migration).toContain("'workspace_available', false");
    expect(migration).toContain("'pl', coalesce(");
    expect(migration).toContain("'en', coalesce(");
    expect(migration).toContain("'he', coalesce(");
    const listBody = migration.slice(
      migration.indexOf('create function public.hotel_v2_partner_list_assigned_properties'),
      migration.indexOf('create function public.hotel_v2_admin_apply_partner_hotel_permissions'),
    );
    expect(listBody).not.toContain("'architecture_version'");
    expect(listBody).not.toContain("'feature_flags'");
    expect(listBody).not.toContain("'owner_partner_id'");
  });

  test('has review-first optimistic, atomic, PII-free idempotent Admin apply', () => {
    expect(migration).toContain('hotel_v2_admin_get_partner_hotel_permissions');
    expect(migration).toContain('hotel_v2_admin_apply_partner_hotel_permissions');
    expect(migration).toContain("c_contract constant text := 'hotels_v2_h3_2a_partner_permissions_v1'");
    expect(migration).toContain("c_decision constant text := 'apply_partner_hotel_permissions'");
    expect(migration).toContain('expected_assignment_fingerprint');
    expect(migration).toContain('expected_permission_version');
    expect(migration).toContain('hotels_v2_h3_2a_stale_partner_permissions');
    expect(migration).toContain('hotel_partner_action_receipts_partner_correlation_key');
    expect(migration).toContain('hotels_v2_h3_2a_idempotency_key_reused');
    expect(migration).toContain('hotels_v2_h3_2a_correlation_reused');
    expect(migration).toContain("'replayed', true");
    expect(migration).toContain("'replayed', false");
    expect(migration).toContain('v_receipt_result');
    expect(migration).toContain('hotel_v2_h3_2a_jsonb_is_pii_free');
    expect(migration).toContain('hotel_partner_action_receipts_immutable');
    expect(migration).toContain('hotel_partner_event_outbox_guard_update');
    expect(migration).toContain('hotel_activity_log');
  });

  test('keeps raw relations closed and fixed-path definer RPCs authenticated-only', () => {
    expect(migration.match(/enable row level security/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain('from public, anon, authenticated, service_role');
    expect(migration).toContain('to authenticated');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = pg_catalog, public, auth');
    expect(migration).toContain("pg_get_userbyid(procedure.proowner) = 'postgres'");
    expect(migration).toContain('has_function_privilege(0::oid');
    expect(migration).toContain('hotels_v2_h3_2a_private_function_acl_mismatch');
  });

  test('protects legacy, H3.1P, deposits, coupons, referrals and flags', () => {
    for (const relation of [
      'hotels','hotel_bookings','partner_service_fulfillments','service_deposit_requests',
      'service_deposit_rules','service_deposit_overrides','service_coupons','service_coupon_redemptions',
      'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
      'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
      'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
      'hotel_payment_policies','hotel_commission_policies','hotel_pricing_promotion_reviews',
      'referrals','affiliate_cashout_requests','profile_referral_code_aliases',
    ]) expect(migration).toContain(relation);
    expect(migration).toContain('hotels_v2_h3_2a_hotels_policies_before');
    expect(migration).toContain('hotels_v2_h3_2a_legacy_hotels_policy_changed');
    expect(migration).toContain('hotels_v2_h3_2a_protected_relation_changed');
    expect(migration).not.toMatch(/update\s+public\.hotels\b/i);
    expect(migration).not.toMatch(/update\s+public\.hotel_bookings\b/i);
    expect(migration).not.toMatch(/update\s+public\.partner_service_fulfillments\b/i);
  });

  test('ships preflight, foundation verify, and PostgreSQL authorization gates', () => {
    expect(preflight).toContain('hotels_v2_h3_2a_partner_access_preflight_safe');
    expect(preflight).toContain('7208ab4ecc0e47abd64d87ca1ac53a03');
    expect(preflight).toContain('e272ec40b78069a1e2e49ac6b0956f11');
    expect(verify).toContain('hotels_v2_h3_2a_partner_access_foundation_safe');
    expect(verify).toContain('HOTEL_LEGACY_PRICE_MISMATCH');
    expect(verify).toContain('HOTEL_LEGACY_PUBLIC_MISMATCH');
    expect(verify).toContain('HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE');
    expect(postgresGate).toContain('h32a_unscoped_staff_was_allowed');
    expect(postgresGate).toContain('h32a_unassigned_owner_was_allowed');
    expect(postgresGate).toContain('h32a_second_mutator_was_allowed');
    expect(postgresGate).toContain('h32a_stable_replay_failed');
    expect(postgresGate).toContain('hotels_v2_h3_2a_partner_access_postgres_gate_pass');
  });
});
