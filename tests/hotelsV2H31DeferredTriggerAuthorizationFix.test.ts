import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20260811300000_hotels_v2_h3_1_deferred_room_inventory_trigger_auth_fix.sql',
  'utf8',
);
const preflight = fs.readFileSync(
  'supabase/manual/hotels_v2_h3_1_deferred_room_inventory_trigger_auth_fix_preflight.sql',
  'utf8',
);
const verify = fs.readFileSync(
  'supabase/manual/hotels_v2_h3_1_deferred_room_inventory_trigger_auth_fix_verify.sql',
  'utf8',
);
const postgresGate = fs.readFileSync(
  'tests/integration/hotels-v2-h3-1-deferred-room-inventory-trigger-auth-postgres-gate.sql',
  'utf8',
);
const postgrestBase = fs.readFileSync(
  'tests/integration/hotels-v2-h3-1-deferred-room-inventory-trigger-auth-postgrest-base.sql',
  'utf8',
);
const postgrestGate = fs.readFileSync(
  'tests/integration/hotels-v2-h3-1-deferred-room-inventory-trigger-auth-postgrest-gate.mjs',
  'utf8',
);

describe('Hotels V2 H3.1 deferred Room inventory trigger authorization repair', () => {
  test('repairs only the trusted deferred trigger entrypoint', () => {
    expect(migration).toContain(
      'alter function public.hotel_v2_h3_1_room_inventory_constraint_trigger()\n  security definer',
    );
    expect(migration).toContain(
      'alter function public.hotel_v2_h3_1_room_inventory_constraint_trigger()\n  set search_path=pg_catalog,public',
    );
    expect(migration).toContain(
      'alter function public.hotel_v2_h3_1_room_inventory_constraint_trigger()\n  owner to postgres',
    );
    expect(migration).not.toContain(
      'alter function public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)\n  security definer',
    );
    expect(migration).not.toContain('create table');
    expect(migration).not.toContain('create or replace function public.hotel_v2_admin_');
  });

  test('keeps the nested validator private and preserves exact trigger bindings', () => {
    expect(migration).toContain(
      'revoke all on function public.hotel_v2_h3_1_room_inventory_constraint_trigger()',
    );
    for (const role of ['public', 'anon', 'authenticated', 'service_role', 'authenticator']) {
      expect(migration).toContain(role);
      expect(verify).toContain(
        `not has_function_privilege('${role}',function_state.validator_oid,'EXECUTE')`,
      );
    }
    expect(migration).toContain('hotel_room_types_h3_1_allocation_inventory_guard');
    expect(migration).toContain('hotel_units_h3_1_allocation_inventory_guard');
    expect(verify).toContain('trigger_state.expected_binding_count=2');
    expect(verify).toContain('trigger_state.total_entrypoint_binding_count=2');
    expect(verify).toContain('not function_state.validator_security_definer');
  });

  test('preserves the existing Admin guard and authenticated-only RPC boundary', () => {
    for (const signature of [
      'hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)',
      'hotel_v2_admin_apply_room_type_plan(jsonb,uuid)',
      'hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    ]) {
      expect(migration).toContain(signature);
      expect(preflight).toContain(signature);
      expect(verify).toContain(signature);
    }
    expect(migration).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(migration).toContain(
      "not has_function_privilege('authenticated',v_rpc.oid,'EXECUTE')",
    );
    expect(migration).not.toContain(
      'grant execute on function public.hotel_v2_h3_1_validate_room_allocation_inventory',
    );
  });

  test('ships read-only preflight and verify with explicit final safety fields', () => {
    expect(preflight).toContain(
      'hotels_v2_h3_1_deferred_trigger_auth_preflight_safe',
    );
    expect(preflight).toContain('repair_needed');
    expect(verify).toContain(
      'hotels_v2_h3_1_deferred_room_inventory_trigger_auth_safe',
    );
    expect(verify).toContain('all_h3_constraint_triggers.enabled_deferred_count=6');
    expect(verify).toContain('capability_state.flags_off');
    const mutationStatement = /^\s*(?:insert\s+into|update\s+[a-z_]|delete\s+from|alter\s+(?:table|function)|create\s+(?:table|function)|drop\s+(?:table|function)|truncate\s+)/im;
    expect(preflight).not.toMatch(mutationStatement);
    expect(verify).not.toMatch(mutationStatement);
  });

  test('isolated PostgreSQL gate reproduces deferred COMMIT and proves the invariant', () => {
    expect(postgresGate).toContain('hotel_v2_admin_prepare_legacy_shadow_rooms');
    expect(postgresGate).toContain('hotel_v2_admin_apply_room_type_plan');
    expect(postgresGate).toContain('hotel_v2_h3_1_validate_room_allocation_inventory');
    expect(postgresGate).toContain('hotel_room_types_h3_1_allocation_inventory_guard');
    expect(postgresGate).toContain('hotels_v2_h3_1_active_allocation_inventory_invalid');
    expect(postgresGate).toMatch(/commit/i);
    expect(postgresGate).toContain(
      'HOTELS_V2_H3_1_DEFERRED_ROOM_INVENTORY_TRIGGER_AUTH_POSTGRES_GATE_PASS',
    );
  });

  test('real PostgREST gate composes H3.1 then the repair and covers exact API roles', () => {
    expect(postgrestBase).toContain(
      '20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql',
    );
    expect(postgrestBase).toContain(
      '20260811300000_hotels_v2_h3_1_deferred_room_inventory_trigger_auth_fix.sql',
    );
    expect(postgrestGate).toContain('hotel_v2_admin_prepare_legacy_shadow_rooms');
    expect(postgrestGate).toContain('hotel_v2_admin_apply_room_type_plan');
    for (const principal of ['anon', 'non-admin', 'partner']) {
      expect(postgrestGate).toContain(principal);
    }
    expect(postgrestGate).toContain('hotels_v2_h3_1_active_allocation_inventory_invalid');
    expect(postgrestGate).toContain('hotels_v2_h3_1_deferred_room_inventory_trigger_auth_safe: true');
  });

  test('keeps legacy rows and all public capability flags unchanged', () => {
    for (const relation of [
      'hotels',
      'hotel_room_types',
      'hotel_units',
      'hotel_bookings',
      'partner_service_fulfillments',
      'hotel_activity_log',
      'site_settings',
    ]) {
      expect(migration).toContain(`'${relation}'`);
    }
    for (const flag of [
      'hotel_rooms_v2_enabled',
      'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ]) {
      expect(migration).toContain(flag);
      expect(preflight).toContain(flag);
      expect(verify).toContain(flag);
    }
    expect(migration).not.toContain("architecture_version='rooms_v2'");
  });
});
