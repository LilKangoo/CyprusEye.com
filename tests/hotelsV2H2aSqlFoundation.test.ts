import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Hotels V2 H2A Admin SQL foundation', () => {
  const migration = read(
    'supabase/migrations/20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql',
  );
  const preflight = read('supabase/manual/hotels_v2_h2a_preflight.sql');
  const verify = read('supabase/manual/hotels_v2_h2a_verify.sql');
  const repair = read(
    'supabase/migrations/20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql',
  );
  const repairVerify = read(
    'supabase/manual/hotels_v2_h2a_property_directory_rpc_fix_verify.sql',
  );
  const h1aBase = read('tests/integration/hotels-v2-h1a-base.sql');
  const h2aBase = read('tests/integration/hotels-v2-h2a-base.sql');
  const gate = read('tests/integration/hotels-v2-h2a-postgres-gate.sql');

  test('is one inert, independently transacted migration', () => {
    expect(migration.trimStart().toLowerCase()).toMatch(/^begin;/);
    expect(migration).toContain('set transaction isolation level repeatable read;');
    expect(migration.trimEnd().toLowerCase()).toMatch(/commit;$/);
    expect(migration).toContain('hotels_v2_h2a_feature_flags_not_inert');
    expect(migration).toContain('hotels_v2_h2a_existing_hotels_changed');
    expect(migration).toContain('hotels_v2_h2a_existing_bookings_changed');
    expect(migration).not.toMatch(/update\s+public\.site_settings/i);
    expect(migration).not.toMatch(/update\s+public\.hotel_bookings/i);
    expect(migration).not.toMatch(/update\s+public\.partner_service_fulfillments/i);
  });

  test('provides one-property list/workspace summaries without flattening rooms', () => {
    expect(migration).toContain('public.hotel_v2_admin_get_property_list()');
    expect(migration).toContain('public.hotel_v2_admin_get_property_workspace(p_hotel_id uuid)');
    expect(migration).toContain("'room_types', coalesce");
    expect(migration).toContain("'rate_plans', coalesce");
    expect(migration).toContain("'operational_partners'");
    expect(migration).toContain("'partners', coalesce");
    expect(migration).toContain("'payment_due_at_booking'");
    expect(migration).toContain("'upcoming_booking_count'");
    expect(migration).toContain("'amenities_catalogue'");
    expect(migration).toContain("'feature_flags'");
    expect(migration).toContain("'price_from'");
    expect(migration).toContain("'readiness'");
    expect(migration).toContain("'preparation_state'");
    expect(migration).toContain("'preparation_blockers'");
  });

  test('repairs the property readers against the production partner assignment contract', () => {
    expect(repair.trimStart().toLowerCase()).toMatch(/^begin;/);
    expect(repair.trimEnd().toLowerCase()).toMatch(/commit;$/);
    expect(repair).toContain('public.hotel_v2_h2a_readiness(p_hotel_id uuid)');
    expect(repair).toContain('public.hotel_v2_admin_get_property_list()');
    expect(repair).toContain('public.hotel_v2_admin_get_property_workspace(p_hotel_id uuid)');
    for (const signature of [
      'public.hotel_v2_h2a_readiness\\(p_hotel_id uuid\\)',
      'public.hotel_v2_admin_get_property_list\\(\\)',
      'public.hotel_v2_admin_get_property_workspace\\(p_hotel_id uuid\\)',
    ]) {
      const definition = repair.match(new RegExp(
        `create or replace function ${signature}([\\s\\S]*?)\\$function\\$;`,
        'i',
      ))?.[0] || '';
      expect(definition).toContain('create or replace function');
      expect(definition).not.toContain('assignment.is_active');
    }
    expect(repair).toContain("'is_active', true");
    expect(repair).not.toMatch(/alter\s+table\s+public\.partner_resources/i);
    expect(repair).not.toMatch(/add\s+column\s+(?:if\s+not\s+exists\s+)?is_active/i);
    expect(repair).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.partner_resources/i);
    expect(repairVerify).toContain('partner_resources_actual_columns');
    expect(repairVerify).toContain('invalid_reference_removed');
    expect(repairVerify).toContain('derived_assignment_activity');
    expect(repairVerify).toContain('exact_property_contract');
    expect(repairVerify).toContain('hotels_v2_h2a_property_directory_rpc_fix_safe');
  });

  test('uses the exact row-existence partner_resources fixture contract', () => {
    for (const fixture of [h1aBase, h2aBase]) {
      const definition = fixture.match(
        /create table public\.partner_resources\s*\(([\s\S]*?)\n\);/i,
      )?.[1] || '';
      expect(definition).toContain('partner_id uuid not null references public.partners(id) on delete cascade');
      expect(definition).toContain('created_at timestamptz default now()');
      expect(definition).not.toContain('is_active');
      expect(fixture).toContain('alter table public.partner_resources enable row level security;');
      expect(fixture).not.toMatch(
        /insert into public\.partner_resources\s*\([^)]*is_active/i,
      );
    }
  });

  test('uses exact/versioned all-or-nothing reviewed workspace plans', () => {
    expect(migration).toContain(
      'public.hotel_v2_admin_apply_workspace_plan(\n  p_plan jsonb,',
    );
    expect(migration).toContain('Complete stale/shape/dependency preflight');
    expect(migration).toContain("array['hotel_id', 'expected_property_updated_at', 'reviewed_at', 'operations']");
    expect(migration).toContain('for update;');
    expect(migration).toContain("errcode = '40001'");
    expect(migration).toContain('hotels_v2_h2a_stale_property');
    expect(migration).toContain('hotels_v2_h2a_stale_room_type');
    expect(migration).toContain('hotels_v2_h2a_stale_unit');
    expect(migration).toContain('hotels_v2_h2a_stale_rate_plan');
    expect(migration).toContain('hotels_v2_h2a_stale_room_rate');
    expect(migration).toContain('hotels_v2_h2a_stale_during_apply');
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.hotel_(?:room_types|units|rate_plans|room_rates)/i);
  });

  test('supports exact draft property, rooms, units, plans, products and safe duplicate', () => {
    expect(migration).toContain('public.hotel_v2_admin_create_property_draft(');
    expect(migration).toContain("'rooms_v2'");
    expect(migration).toContain("'request_confirmation'");
    expect(migration).toContain("'draft'");
    expect(migration).toContain('insert into public.hotel_room_types');
    expect(migration).toContain('insert into public.hotel_units');
    expect(migration).toContain('insert into public.hotel_rate_plans');
    expect(migration).toContain('insert into public.hotel_room_rates');
    expect(migration).toContain('hotels_v2_h2a_room_rate_room_outside_property');
    expect(migration).toContain('hotels_v2_h2a_room_rate_plan_outside_property');
    expect(migration).toContain('hotels_v2_h2a_inventory_mode_change_blocked');
    expect(migration).toContain('hotels_v2_h2a_owner_partner_not_eligible');
    expect(migration).toContain("v_action = 'duplicate'");
    expect(migration).toContain("'draft',");
    expect(migration).toContain('hotels_h2a_rooms_v2_unpublished_check');
    expect(migration).toContain("architecture_version = 'legacy' or coalesce(is_published, false) = false");
  });

  test('enforces structured bed and cancellation contracts', () => {
    expect(migration).toContain('hotel_v2_h2a_beds_are_valid');
    expect(migration).toContain("('double', 'single', 'sofa', 'bunk', 'king', 'queen', 'other')");
    expect(migration).toContain('hotel_v2_h2a_cancellation_policy_is_valid');
    expect(migration).toContain("('flexible', 'non_refundable', 'custom')");
    expect(migration).toContain("('none', 'flat', 'percent')");
    expect(migration).toContain('hotel_room_types_h2a_bed_configuration_check');
    expect(migration).toContain('hotel_rate_plans_h2a_cancellation_policy_check');
  });

  test('creates append-only Admin activity and leaves calendar override to H2B', () => {
    expect(migration).toContain('create table public.hotel_activity_log');
    expect(migration).toContain('hotel_activity_log_admin_select');
    expect(migration).toContain('revoke all on table public.hotel_activity_log');
    expect(migration).not.toContain('grant insert on table public.hotel_activity_log to authenticated');
    expect(migration).not.toMatch(/create\s+table\s+public\.hotel_calendar_overrides/i);
    expect(migration).toContain('1. safety closure');
    expect(migration).toContain('2. exact-date Admin override');
    expect(migration).toContain('3. highest-priority matching seasonal/range rule');
    expect(migration).toContain('4. matching weekday rule');
    expect(migration).toContain('5. room-rate base rate');
  });

  test('keeps public/partner raw access closed and Admin RPC grants exact', () => {
    for (const signature of [
      'public.hotel_v2_admin_get_property_list()',
      'public.hotel_v2_admin_get_property_workspace(uuid)',
      'public.hotel_v2_admin_create_property_draft(uuid, jsonb, uuid)',
      'public.hotel_v2_admin_apply_workspace_plan(jsonb, uuid)',
    ]) {
      expect(migration).toContain(`revoke all on function ${signature}`);
      expect(migration).toContain(`grant execute on function ${signature}`);
    }
    expect(migration).toContain('to authenticated;');
    expect(migration).toContain('hotels_v2_h2a_admin_required');
    expect(migration).toContain('set search_path = pg_catalog, public, auth');
  });

  test('manual guards are read-only and expose one decisive result', () => {
    for (const sql of [preflight, verify]) {
      expect(sql).not.toMatch(/^\s*(?:insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/im);
    }
    expect(preflight).toContain('hotels_v2_h2a_preflight_safe');
    expect(verify).toContain('hotels_v2_h2a_foundation_safe');
    expect(verify).toContain('"HOTEL_LEGACY_PRICE_MISMATCH"');
    expect(verify).toContain('"HOTEL_LEGACY_PUBLIC_MISMATCH"');
    expect(verify).toContain('"HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE"');
    expect(preflight).toContain('publication_guard_absent');
    expect(verify).toContain('hotels_h2a_rooms_v2_unpublished_check');
  });

  test('manual guards require the exact hardened six-argument H1A partner bridge', () => {
    const exactPartnerBridge =
      'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)';
    const invalidShortcut =
      'public.partner_get_hotel_booking_operational_context(uuid,integer)';

    for (const sql of [preflight, verify]) {
      expect(sql).toContain(exactPartnerBridge);
      expect(sql).not.toContain(invalidShortcut);
      expect(sql).toContain('partner_bridge_security_definer');
      expect(sql).toContain('partner_bridge_stable');
      expect(sql).toContain('partner_bridge_safe_search_path');
      expect(sql).toContain('partner_bridge_authenticated_execute');
      expect(sql).toContain('partner_bridge_anon_public_execute_denied');
      expect(sql).toContain('partner_bridge_service_role_execute_denied');
      expect(sql).toContain('partner_identity_helper_present');
      expect(sql).toContain('partner_admin_helper_present');
    }
  });

  test('isolated gate proves CRUD, duplicate, stale abort, invariant, RLS and legacy freeze', () => {
    expect(gate).toContain('20260811170000_hotels_v2_h1a_core.sql');
    expect(gate).toContain('20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql');
    expect(gate).toContain('20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql');
    expect(gate).toContain('hotels_v2_h2a_gate_partner_resources_fixture_drift');
    expect(gate).toContain('hotels_v2_h2a_gate_property_directory_repair_source_failed');
    expect(gate).toContain('hotels_v2_h2a_gate_unassigned_workspace_read_contract_failed');
    expect(gate).toContain('property_directory_repair_pass');
    expect(gate).toContain('hotels_v2_h2a_gate_ready_workspace_contract_failed');
    expect(gate).toContain('hotels_v2_h2a_gate_rooms_v2_publication_guard_failed');
    expect(gate).toContain('hotels_v2_h2a_gate_room_duplicate_not_safe');
    expect(gate).toContain('hotels_v2_h2a_gate_stale_plan_partially_mutated');
    expect(gate).toContain('hotels_v2_h2a_gate_cross_property_product_unexpectedly_succeeded');
    expect(gate).toContain('hotels_v2_h2a_gate_partner_raw_read_unexpectedly_allowed');
    expect(gate).toContain('hotels_v2_h2a_gate_existing_legacy_properties_changed');
    expect(gate).toContain('hotels_v2_h2a_postgres_gate_safe');
    expect(gate.trimEnd().toLowerCase()).toMatch(/rollback;$/);
  });
});
