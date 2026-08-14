import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql',
  'utf8',
);
const preflight = fs.readFileSync(
  'supabase/manual/hotels_v2_h3_1_inert_admin_configuration_preflight.sql',
  'utf8',
);
const verify = fs.readFileSync(
  'supabase/manual/hotels_v2_h3_1_inert_admin_configuration_verify.sql',
  'utf8',
);
const sevenKamaresVerify = fs.readFileSync(
  'supabase/manual/hotels_v2_h3_1_seven_kamares_configuration_verify.sql',
  'utf8',
);
const postgresGate = fs.readFileSync(
  'tests/integration/hotels-v2-h3-1-inert-admin-configuration-postgres-gate.sql',
  'utf8',
);
const core = fs.readFileSync('admin/hotels-v2-workspace-core.js', 'utf8');
const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
const publicHotelRuntime = [
  fs.readFileSync('hotels.html', 'utf8'),
  fs.readFileSync('hotel.html', 'utf8'),
  fs.readFileSync('js/hotel-booking-ui.js', 'utf8'),
].join('\n');

describe('Hotels V2 H3.1 inert Admin configuration', () => {
  test('adds reviewed property minimum-stay and minimum-billable-occupancy contracts', () => {
    expect(migration).toContain('add column minimum_stay_nights');
    expect(migration).toContain('add column minimum_billable_occupancy');
    expect(migration).toContain('minimum_stay_nights');
    expect(migration).toContain('minimum_billable_occupancy');
    expect(migration).toContain('price_inclusions');
    expect(migration).toContain('taxes');
    expect(migration).toContain('cleaning');
  });

  test('normalizes customer-choice and mandatory-bundle allocation without touching inventory', () => {
    expect(migration).toContain('hotel_room_allocation_rules');
    expect(migration).toContain('hotel_room_allocation_rule_items');
    expect(migration).toContain('customer_choice');
    expect(migration).toContain('required_bundle');
    expect(migration).toContain('allocated_guest_count');
    expect(migration).toContain('room_type_id');
    expect(migration).toContain('hotel_id');
    expect(postgresGate).toContain('customer_choice');
    expect(postgresGate).toContain('required_bundle');
    expect(postgresGate).toContain('5');
    expect(postgresGate).toContain('8');
    expect(postgresGate).toContain('3');
    expect(postgresGate).toContain('4');
  });

  test('keeps customer payment and commercial commission as separate reviewed contracts', () => {
    expect(migration).toContain('hotel_payment_policies');
    expect(migration).toContain('hotel_payment_policy_terms');
    expect(migration).toContain('hotel_commission_policies');
    expect(migration).toContain('at_booking');
    expect(migration).toContain('after_partner_acceptance');
    expect(migration).toContain('on_arrival');
    expect(migration).toContain('cash');
    expect(migration).toContain('card');
    expect(migration).toContain('per_allocated_room_per_night');
    expect(migration).toContain('percent_booking_total');
    expect(postgresGate).toContain('at_booking');
    expect(postgresGate).toContain('percent_booking_total');
    expect(postgresGate).toContain('50');
    expect(postgresGate).toContain('10');
    expect(migration).toContain('v_remaining_sequence is distinct from v_max_sequence');
    expect(postgresGate).toContain('full_plus_remaining');
    expect(postgresGate).toContain('remainder_not_final');
    expect(postgresGate).toContain('hotels_v2_h3_1_payment_rpc_completeness_failed');
  });

  test('creates only an inert availability-source seam with no external integration or credentials', () => {
    expect(migration).toContain('hotel_calendar_source_configs');
    for (const source of ['manual', 'ical', 'booking_com', 'airbnb']) {
      expect(migration).toContain(source);
    }
    expect(migration).not.toContain('api_secret');
    expect(migration).not.toContain('access_token');
    expect(migration).not.toContain('refresh_token');
    expect(publicHotelRuntime).not.toContain('hotel_calendar_source_configs');
  });

  test('uses one exact-property Admin-only transactional RPC with optimistic snapshots', () => {
    expect(migration).toContain('hotel_v2_admin_get_h3_1_configuration');
    expect(migration).toContain('hotel_v2_admin_apply_h3_1_configuration');
    expect(migration).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(migration).toContain("security definer");
    expect(migration).toContain("search_path=pg_catalog, public, auth");
    expect(migration).toContain('expected_property_updated_at');
    expect(migration).toContain('expected_version');
    expect(migration).toContain("errcode='PT409'");
    expect(postgresGate).toContain('stale');
    expect(postgresGate).toContain('atomic');
  });

  test('denies raw and RPC access to public, ordinary authenticated users and partners', () => {
    expect(migration).toContain('revoke all on function public.hotel_v2_admin_get_h3_1_configuration');
    expect(migration).toContain('revoke all on function public.hotel_v2_admin_apply_h3_1_configuration');
    expect(migration).toContain('grant execute on function public.hotel_v2_admin_get_h3_1_configuration');
    expect(migration).toContain('grant execute on function public.hotel_v2_admin_apply_h3_1_configuration');
    for (const principal of ['anon', 'non-admin', 'partner']) {
      expect(postgresGate).toContain(principal);
    }
    for (const table of [
      'hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items',
      'hotel_payment_policies',
      'hotel_payment_policy_terms',
      'hotel_commission_policies',
      'hotel_calendar_source_configs',
    ]) {
      expect(migration).toContain(`'${table}'`);
      expect(postgresGate).toContain(table);
    }
    expect(migration).toContain("execute format('alter table public.%I enable row level security',v_table_name)");
  });

  test('keeps every public capability flag off and legacy/runtime booking paths disconnected', () => {
    expect(migration).not.toContain("architecture_version='rooms_v2'");
    expect(migration).not.toContain('hotel_rooms_v2_enabled=true');
    expect(migration).not.toContain('hotel_external_sync_enabled=true');
    expect(migration).not.toContain('hotel_instant_booking_enabled=true');
    expect(migration).not.toContain('hotel_stripe_connect_enabled=true');
    expect(publicHotelRuntime).not.toContain('hotel_v2_admin_get_h3_1_configuration');
    expect(publicHotelRuntime).not.toContain('hotel_v2_admin_apply_h3_1_configuration');
    expect(postgresGate).toContain('architecture_version');
    expect(postgresGate).toContain('feature_flags');
  });

  test('ships one-row fail-closed preflight and post-migration verify with legacy guards', () => {
    expect(preflight).toContain('hotels_v2_h3_1_inert_admin_configuration_preflight_safe');
    expect(verify).toContain('hotels_v2_h3_1_inert_admin_configuration_safe');
    for (const counter of [
      'HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PUBLIC_MISMATCH',
      'HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE',
    ]) {
      expect(verify).toContain(counter);
      expect(postgresGate).toContain(counter);
    }
    expect(preflight).toContain('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
    expect(verify).toContain('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  });

  test('ships a separate fail-closed post-Admin 7 Kamares operational verifier', () => {
    expect(sevenKamaresVerify).toContain('hotels_v2_h3_1_seven_kamares_configuration_safe');
    expect(sevenKamaresVerify).toContain("minimum_stay_nights=2");
    expect(sevenKamaresVerify).toContain("minimum_billable_occupancy=2");
    expect(sevenKamaresVerify).toContain("check_in_from='14:00'::time");
    expect(sevenKamaresVerify).toContain("check_out_until='11:00'::time");
    expect(sevenKamaresVerify).toContain("booking_mode='request_confirmation'");
    expect(sevenKamaresVerify).toContain("guests-1-4-choice");
    for (const guests of [5, 6, 7, 8]) expect(sevenKamaresVerify).toContain(`guests-${guests}-bundle`);
    expect(sevenKamaresVerify).toContain("array['cleaning','taxes']");
    expect(sevenKamaresVerify).toContain("amount_value=50");
    expect(sevenKamaresVerify).toContain("amount_mode='remaining_balance'");
    expect(sevenKamaresVerify).toContain("commission_mode='per_allocated_room_per_night'");
    expect(sevenKamaresVerify).toContain("source_type='manual'");
    expect(sevenKamaresVerify).toContain("inactive_room_rate_count=2");
    expect(sevenKamaresVerify).toContain("operational_assignment_count=1");
    for (const counter of [
      'HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PUBLIC_MISMATCH',
      'HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE',
    ]) expect(sevenKamaresVerify).toContain(counter);
  });

  test('wires the friendly Booking setup UI through the reviewed repository RPC only', () => {
    expect(core).toContain('normalizeH3Configuration');
    expect(core).toContain('validateH3Configuration');
    expect(core).toContain('buildH3ConfigurationPlan');
    expect(repository).toContain("hotel_v2_admin_get_h3_1_configuration");
    expect(repository).toContain("hotel_v2_admin_apply_h3_1_configuration");
    expect(ui).toContain('Booking setup');
    expect(ui).toContain('Minimum stay');
    expect(ui).toContain('Minimum billable occupancy');
    expect(ui).toContain('Customer chooses');
    expect(ui).toContain('Required bundle');
    expect(ui).toContain('50%');
    expect(ui).toContain('€10');
    expect(ui).toContain('Percent of booking total');
    expect(core).toContain("'at_booking'");
    expect(ui).toContain("at_booking: 'At booking'");
    expect(ui).toContain('Preserved custom inclusions:');
    expect(postgresGate).toContain('set local role authenticated');
    expect(postgresGate).toContain('grant update on public.hotel_rate_plans to authenticated');
    expect(ui).toContain('Public behavior');
    expect(ui).toContain('No change');
  });
});
