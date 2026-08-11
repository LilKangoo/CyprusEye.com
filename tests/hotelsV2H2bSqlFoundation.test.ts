import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Hotels V2 H2B calendar/rates SQL foundation', () => {
  const migration = read(
    'supabase/migrations/20260811230000_hotels_v2_h2b_calendar_rates_foundation.sql',
  );
  const preflight = read('supabase/manual/hotels_v2_h2b_preflight.sql');
  const verify = read('supabase/manual/hotels_v2_h2b_verify.sql');
  const postgresGate = read('tests/integration/hotels-v2-h2b-postgres-gate.sql');

  test('is an independently transacted inert migration', () => {
    expect(migration.trimStart().toLowerCase()).toMatch(/^begin;/);
    expect(migration).toContain('set transaction isolation level repeatable read;');
    expect(migration.trimEnd().toLowerCase()).toMatch(/commit;$/);
    expect(migration).toContain('lock table public.site_settings in share row exclusive mode;');
    expect(migration).not.toMatch(/update\s+public\.site_settings/i);
    expect(migration).not.toMatch(/update\s+public\.hotel_bookings/i);
    expect(migration).not.toMatch(/update\s+public\.partner_service_fulfillments/i);
    expect(migration).toContain('hotels_v2_h2b_capability_flag_enabled');
    expect(migration).toContain('hotels_v2_h2b_site_settings_singleton_mismatch');
    expect(migration).toContain('hotels_v2_h2b_protected_state_changed');
  });

  test('creates explicit occupancy tiers and exact-date override semantics', () => {
    expect(migration).toContain('create table public.hotel_room_rate_occupancy_tiers');
    expect(migration).toContain('create table public.hotel_calendar_overrides');
    expect(migration).toContain("nightly_rate_mode text");
    expect(migration).toContain("nightly_rate_mode = 'clear'");
    expect(migration).toContain("nightly_rate_mode = 'set'");
    for (const field of [
      'minimum_stay_mode',
      'maximum_stay_mode',
      'closed_mode',
      'closed_to_arrival_mode',
      'closed_to_departure_mode',
      'reason',
      'expires_at',
      'actor_id',
      'source',
      'source_timestamp',
      'provenance',
    ]) expect(migration).toContain(field);
    expect(migration).toContain("source in ('manual','legacy_preview','system')");
    expect(migration).toContain('hotel_rate_rules_weekdays_unique_check');
    expect(migration).toContain('hotel_room_rate_occupancy_tiers_capacity_guard');
    expect(migration).toContain('hotel_room_types_occupancy_tier_capacity_guard');
    expect(migration).toContain('before insert or update of hotel_id,room_rate_id,guest_count,is_active');
    expect(migration).toContain('revoke all on function public.hotel_v2_h2b_validate_occupancy_tier_contract()');
  });

  test('provides one authoritative resolver and calendar response contract', () => {
    expect(migration).toContain('public.hotel_v2_admin_resolve_rate(');
    expect(migration).toContain('public.hotel_v2_admin_get_calendar(');
    expect(migration).toContain("'effective_cells'");
    expect(migration).toContain("'snapshot_token'");
    expect(migration).toContain("'snapshot_valid_until'");
    expect(migration).toContain('statement_timestamp()');
    expect(migration).toContain("'missing_occupancy_los_tier'");
    expect(migration).toContain('rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]');
    expect(migration).toContain("v_rate_source := 'exact_date_override'");
    expect(migration).toContain("v_rate_source := 'range_rule'");
    expect(migration).toContain("v_rate_source := 'weekday_rule'");
    expect(migration).toContain("v_rate_source := 'occupancy_los_tier'");
    expect(migration).toContain('exact_override.expires_at > v_as_of');
    expect(migration).toContain('inventory.expires_at > v_as_of');
    expect(migration).toContain('rule.valid_from <= p_end_date + 1');
    expect(migration).toContain('exact_override.stay_date between p_start_date and p_end_date + 1');
  });

  test('applies exact reviewed plans atomically with optimistic concurrency', () => {
    expect(migration).toContain('public.hotel_v2_admin_apply_calendar_plan(');
    expect(migration).toContain("array['hotel_id','from','to','reviewed_at','snapshot_token','operations']");
    expect(migration).toContain('Complete read/shape/ownership/version preflight');
    expect(migration).toContain('hotels_v2_h2b_stale_calendar_snapshot');
    expect(migration).toContain("clock_timestamp() - interval '30 minutes'");
    expect(migration).toContain('hotels_v2_h2b_weekdays_must_be_unique');
    expect(migration).toContain('hotels_v2_h2b_occupancy_tier_exceeds_room_capacity');
    expect(migration).toContain("errcode = '40001'");
    expect(migration).toContain('hotels_v2_h2b_equal_priority_rate_rule_overlap');
    expect(migration).toContain('insert into public.hotel_activity_log');
    expect(migration).toContain("v_entity not in ('rate_rule','calendar_override','daily_inventory','occupancy_tier')");
    expect(migration).toContain("if v_entity<>'daily_inventory' then v_activity_id:=v_id; end if");
  });

  test('keeps raw tables closed and grants only hardened Admin RPCs', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table public.hotel_room_rate_occupancy_tiers from public, anon, authenticated');
    expect(migration).toContain('revoke all on table public.hotel_calendar_overrides from public, anon, authenticated');
    expect(migration).toContain('set search_path = pg_catalog, public, auth');
    for (const signature of [
      'public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)',
      'public.hotel_v2_admin_get_calendar(uuid,date,date)',
      'public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)',
    ]) {
      expect(migration).toContain(`revoke all on function ${signature}`);
      expect(migration).toContain(`grant execute on function ${signature} to authenticated`);
    }
  });

  test('manual guards are read-only, fingerprinted and decisive', () => {
    for (const sql of [preflight, verify]) {
      expect(sql).not.toMatch(/^\s*(?:insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/im);
      expect(sql).toContain('b3e3a9c5bda72a83e49d3095d175ab9c');
      expect(sql).toContain('fb5a4c508b0df32afbffe5b1594c7a50');
      expect(sql).toContain('1e01541853d87d26adccb8172074934b');
      expect(sql).toContain('42b5e1dc9726890e90014c3e89c2329d');
      expect(sql).toContain('d41d8cd98f00b204e9800998ecf8427e');
    }
    expect(preflight).toContain('hotels_v2_h2b_preflight_safe');
    expect(verify).toContain('hotels_v2_h2b_foundation_safe');
    expect(verify).toContain('"HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH"');
    expect(verify).toContain('"HOTEL_LEGACY_PRICE_MISMATCH"');
    expect(verify).toContain('"HOTEL_LEGACY_PUBLIC_MISMATCH"');
    expect(verify).toContain('"HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE"');
    expect(verify).toContain('customer_bridge_hardened');
    expect(verify).toContain('customer_bridge_grants_exact');
  });

  test('isolated PostgreSQL gate covers precedence, fail-closed and atomic aborts', () => {
    expect(postgresGate).toContain('HOTELS_V2_H2B_POSTGRES_GATE_PASS');
    expect(postgresGate).toContain('h2b_gate_precedence_or_quote_failed');
    expect(postgresGate).toContain('h2b_gate_occupancy_fail_closed_failed');
    expect(postgresGate).toContain('h2b_gate_stale_snapshot_failed');
    expect(postgresGate).toContain('h2b_gate_overlap_atomic_abort_failed');
    expect(postgresGate).toContain('h2b_gate_clear_fallthrough_failed');
    expect(postgresGate).toContain('h2b_gate_expiry_failed');
    expect(postgresGate).toContain('h2b_gate_expiry_snapshot_stale_failed');
    expect(postgresGate).toContain('h2b_gate_expiry_no_change_failed');
    expect(postgresGate).toContain('h2b_gate_checkout_boundary_snapshot_stale_failed');
    expect(postgresGate).toContain('h2b_gate_old_review_failed');
    expect(postgresGate).toContain('h2b_gate_duplicate_weekdays_failed');
    expect(postgresGate).toContain('h2b_gate_occupancy_capacity_failed');
    expect(postgresGate).toContain('h2b_gate_capacity_reduction_failed');
    expect(postgresGate).toContain('h2b_gate_inactive_reactivation_failed');
    expect(postgresGate).toContain('h2b_gate_non_admin_rpc_denial_failed');
    expect(postgresGate).toContain('h2b_gate_anon_rpc_denial_failed');
  });
});
