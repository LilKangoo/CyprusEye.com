import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20260811320000_hotels_v2_h3_2a_partner_access_foundation.sql',
  'utf8',
);
const postgrestBase = fs.readFileSync(
  'tests/integration/hotels-v2-h3-2a-partner-access-postgrest-base.sql',
  'utf8',
);
const postgrestConfig = fs.readFileSync(
  'tests/integration/hotels-v2-h3-2a-partner-access-postgrest.conf',
  'utf8',
);
const postgrestGate = fs.readFileSync(
  'tests/integration/hotels-v2-h3-2a-partner-access-postgrest-gate.mjs',
  'utf8',
);

const capabilities = [
  'edit_property_content',
  'edit_property_photos',
  'edit_room_content',
  'edit_room_photos',
  'create_rooms',
  'edit_room_structure',
  'manage_prices',
  'manage_availability',
  'process_bookings',
  'request_booking_changes',
  'view_payment_status',
  'initiate_stripe_onboarding',
];

const functionBody = (name: string, nextName: string): string => {
  const start = migration.indexOf(`create function public.${name}`);
  const end = migration.indexOf(`create function public.${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
};

describe('Hotels V2 H3.2A independent access-security contract', () => {
  test('uses an exact deny-by-default 12-capability assignment contract', () => {
    for (const capability of capabilities) expect(migration).toContain(`'${capability}'`);
    expect(migration).toContain('create table public.hotel_partner_hotel_permissions');
    expect(migration).toContain('resource_type text generated always as');
    expect(migration).toContain('hotel_partner_hotel_permissions_exact_assignment_fkey');
    expect(migration).toContain('hotel_partner_hotel_permissions_one_mutator_uidx');
    expect(migration).toContain('where has_mutation_capability');

    const generatedMutation = migration.slice(
      migration.indexOf('has_mutation_capability boolean generated always as'),
      migration.indexOf(') stored,', migration.indexOf('has_mutation_capability boolean generated always as')),
    );
    expect(generatedMutation).not.toContain('view_payment_status');
    for (const capability of capabilities.filter((name) => name !== 'view_payment_status')) {
      expect(generatedMutation).toContain(capability);
    }
  });

  test('requires active Partner membership, exact assignment, and exact staff Hotel scope', () => {
    const membership = functionBody(
      'hotel_v2_h3_2a_require_partner_membership',
      'hotel_v2_h3_2a_require_partner_hotel_access',
    );
    expect(membership).toContain("partner_user.role in ('owner','staff')");
    expect(membership).toContain("partner.status = 'active'");
    expect(membership).toContain('partner.can_manage_hotels');
    expect(membership).toContain('partner_user.user_id = auth.uid()');

    const access = functionBody(
      'hotel_v2_h3_2a_require_partner_hotel_access',
      'hotel_v2_admin_get_partner_hotel_permissions',
    );
    expect(access).toContain("assignment.resource_type = 'hotels'");
    expect(access).toContain('assignment.resource_id = p_hotel_id');
    expect(access).toContain('public.partner_user_resources user_scope');
    expect(access).toContain('user_scope.partner_user_id = v_partner_user_id');
    expect(access).toContain('user_scope.resource_id = p_hotel_id');
    expect(access).toContain("p_capability = 'initiate_stripe_onboarding' and v_role <> 'owner'");
    expect(access).toContain('hotels_v2_h3_2a_public_activation_guard');
    expect(access).toContain('(select count(*) from public.site_settings) <> 1');
  });

  test('returns the exact foundation-only Partner allowlist and masks owner-only Stripe capability', () => {
    const list = functionBody(
      'hotel_v2_partner_list_assigned_properties',
      'hotel_v2_admin_apply_partner_hotel_permissions',
    );
    for (const key of [
      'assignment_id', 'hotel_id', 'slug', 'name_i18n', 'city', 'cover_image_url',
      'foundation_status', 'workspace_available', 'permission',
    ]) expect(list).toContain(`'${key}'`);
    for (const locale of ['pl', 'en', 'he']) expect(list).toContain(`'${locale}'`);
    expect(list).toContain('public.hotel_v2_h3_2a_effective_partner_permissions');
    expect(list).toContain('hotels_v2_h3_2a_partner_access_denied');
    expect(list).not.toContain("'architecture_version'");
    expect(list).not.toContain("'feature_flags'");
    expect(list).not.toContain("'owner_partner_id'");
    expect(list).not.toContain("'commission'");
    expect(list).not.toContain("'booking_mode'");

    const effective = functionBody(
      'hotel_v2_h3_2a_effective_partner_permissions',
      'hotel_v2_h3_2a_assignment_fingerprint',
    );
    expect(effective).toContain("if p_role = 'staff'");
    expect(effective).toContain("'{initiate_stripe_onboarding}'");
    expect(effective).toContain("'false'::jsonb");
    for (const key of ['exists', 'version', 'has_mutation_capability', 'capabilities']) {
      expect(effective).toContain(`'${key}'`);
    }
    expect(effective).not.toContain("'updated_at'");
  });

  test('keeps Admin apply exact, optimistic, idempotent, atomic, and review-first', () => {
    const applyStart = migration.indexOf('create function public.hotel_v2_admin_apply_partner_hotel_permissions');
    const applyEnd = migration.indexOf('-- Raw relations are never an API surface', applyStart);
    expect(applyStart).toBeGreaterThanOrEqual(0);
    expect(applyEnd).toBeGreaterThan(applyStart);
    const applyBody = migration.slice(applyStart, applyEnd);

    expect(applyBody).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(applyBody).toContain("'expected_assignment_fingerprint'");
    expect(applyBody).toContain("'expected_permission_version'");
    expect(applyBody).toContain("'snapshot_token'");
    expect(applyBody).toContain('for update');
    expect(applyBody).toContain('for share');
    expect(applyBody).toContain('lock table public.hotel_partner_action_receipts');
    expect(applyBody).toContain('hotels_v2_h3_2a_stale_partner_permissions');
    expect(applyBody).toContain('hotels_v2_h3_2a_idempotency_key_reused');
    expect(applyBody).toContain('hotels_v2_h3_2a_correlation_reused');
    expect(applyBody).toContain('hotels_v2_h3_2a_mutating_assignment_conflict');
    expect(applyBody).toContain('hotels_v2_h3_2a_assignment_not_found');
    expect(applyBody).toContain('invalid_datetime_format');
    expect(applyBody).toContain('insert into public.hotel_activity_log');
    expect(applyBody).toContain('insert into public.hotel_partner_event_outbox');
    expect(applyBody).toContain('insert into public.hotel_partner_action_receipts');
    expect(applyBody).toContain("'replayed', true");
    expect(applyBody).toContain("'replayed', false");
    expect(applyBody).not.toMatch(/update\s+public\.hotels\b/i);
    expect(applyBody).not.toMatch(/update\s+public\.hotel_(?:bookings|rate_plans|room_rates|pricing_schedules)\b/i);
  });

  test('denies raw new relations and exposes only three fixed-path definer RPCs', () => {
    for (const table of [
      'hotel_partner_hotel_permissions',
      'hotel_partner_action_receipts',
      'hotel_partner_event_outbox',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on table public.${table}`);
    }
    for (const rpc of [
      'hotel_v2_admin_get_partner_hotel_permissions(uuid)',
      'hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
      'hotel_v2_partner_list_assigned_properties(uuid)',
    ]) {
      expect(migration).toContain(`revoke all on function public.${rpc}`);
      expect(migration).toContain(`grant execute on function public.${rpc}`);
    }
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = pg_catalog, public, auth');
    expect(migration).toContain('hotels_v2_h3_2a_raw_table_acl_mismatch');
    expect(migration).toContain('hotels_v2_h3_2a_private_function_acl_mismatch');
    expect(migration).toContain("pg_get_userbyid(procedure.proowner) = 'postgres'");
    expect(migration).not.toMatch(/create\s+policy\s+\S+\s+on\s+public\.hotel_partner_/i);
  });

  test('pins legacy commercial/history rows and the exact raw Hotel policy definitions', () => {
    for (const relation of [
      'service_deposit_rules', 'service_deposit_overrides', 'service_deposit_requests',
      'service_coupons', 'service_coupon_redemptions', 'referrals',
      'hotel_units', 'hotel_room_types', 'hotel_rate_plans', 'hotel_room_rates',
      'hotel_pricing_schedules', 'hotel_pricing_schedule_occupancy_tiers',
      'hotel_room_allocation_rules', 'hotel_room_allocation_rule_items',
      'hotel_payment_policies', 'hotel_payment_policy_terms', 'hotel_commission_policies',
      'hotel_calendar_source_configs', 'hotel_pricing_promotion_reviews',
    ]) expect(migration).toContain(`'${relation}'`);
    expect(migration).toContain('hotels_v2_h3_2a_protected_relations_before');
    expect(migration).toContain('hotels_v2_h3_2a_hotels_policies_before');
    expect(migration).toContain("policy.tablename = 'hotels'");
    expect(migration).toContain('hotels_v2_h3_2a_legacy_hotels_policy_changed');
    expect(migration).toContain('hotels_v2_h3_2a_protected_relation_changed');
    expect(migration).not.toMatch(/(?:create|alter|drop)\s+policy[\s\S]{0,160}on\s+public\.hotels\b/i);

    for (const policy of [
      'Anyone can view published hotels',
      'hotels_authenticated_select',
      'hotels_admin_all',
      'hotels_partner_insert',
      'hotels_partner_update',
      'hotels_partner_delete',
    ]) expect(postgrestBase).toContain(policy);
  });

  test('ships a loopback-only real PostgREST threat gate', () => {
    expect(postgrestBase).toContain('hotels-v2-h3-1p-postgrest-base.sql');
    expect(postgrestBase).toContain('public.partner_user_resources');
    expect(postgrestBase).toContain('20260811320000_hotels_v2_h3_2a_partner_access_foundation.sql');
    expect(postgrestConfig).toContain('127.0.0.1');
    expect(postgrestConfig).toContain('server-port = 53013');
    expect(postgrestGate).toContain("['127.0.0.1', 'localhost', '::1']");
    expect(postgrestGate).toContain('staff without exact Hotel scope LIST');
    expect(postgrestGate).toContain('owner without exact Hotel assignment LIST');
    expect(postgrestGate).toContain('suspended Partner LIST');
    expect(postgrestGate).toContain('can_manage_hotels=false LIST');
    expect(postgrestGate).toContain('Concurrent duplicate did not collapse');
    expect(postgrestGate).toContain('hotels_v2_h3_2a_mutating_assignment_conflict');
    expect(postgrestGate).toContain('H3.2A permission changes altered protected H3.1/legacy configuration');
    expect(postgrestGate).toContain("assertKeys(property.name_i18n, ['pl', 'en', 'he']");
    expect(postgrestGate).toContain("'exists', 'version', 'has_mutation_capability', 'capabilities'");
  });
});
