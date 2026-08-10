import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const compact = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

describe('Car Rental end-to-end public eligibility SQL', () => {
  const migration = read(
    'supabase/migrations/20260810140000_car_rental_end_to_end_public_eligibility.sql',
  );
  const verify = read('supabase/manual/car_rental_end_to_end_public_eligibility_verify.sql');
  const pgGate = read(
    'tests/integration/car-rental-end-to-end-public-eligibility-postgres-gate.sql',
  );
  const sql = compact(migration);

  test('is transactional, inert on apply and removes broad public policies', () => {
    expect(sql).toContain('-- car-rental-end-to-end-public-eligibility-v1');
    expect(sql).toContain('begin;');
    expect(sql).toMatch(/commit;$/);
    expect(sql).toContain('car_end_to_end_public_eligibility_requires_both_flags_off');
    expect(sql).toContain('car_offers_auth_select');
    expect(sql).toContain('"anyone can view available car offers"');
    expect(sql).toContain('"authenticated users can view all offers"');
    expect(sql).not.toContain('update public.site_settings');
    expect(sql.match(/update public\.car_offers/g)).toHaveLength(2);
    expect(sql).toContain(
      'create or replace function public.admin_set_car_threshold_offer_activation_state',
    );
    expect(sql).not.toContain('insert into public.car_bookings');
  });

  test('public prerequisite and route helpers fail closed on every exact contract', () => {
    expect(sql).toContain('car_threshold_offer_has_public_prerequisites');
    expect(sql).toContain("offer.pricing_strategy = 'threshold_daily_rate'");
    expect(sql).toContain("offer.availability_mode = 'mapped'");
    expect(sql).toContain("offer.submission_status = 'approved'");
    expect(sql).toContain('offer.stock_count > 0');
    expect(sql).toContain('setting.car_multi_city_mapped_enabled');
    expect(sql).toContain('setting.car_threshold_daily_rates_enabled');
    expect(sql).toContain('offer.min_rental_days = ( select min(tier.threshold_days)');
    expect(sql).toContain("lower(owner_partner.status) = 'active'");
    expect(sql).toContain('owner_partner.can_manage_cars');
    expect(sql).toContain('invalid_availability.is_active');
    expect(sql).toContain('invalid_city.is_active is not true');
    expect(sql).toContain('availability.pickup_enabled');
    expect(sql).toContain('availability.return_enabled');
    expect(sql).toContain('car_threshold_offer_route_is_public_eligible');
    expect(sql).toContain('resolve_public_threshold_offer_ids');
    expect(sql).toContain('car_threshold_offer_city_availability_is_public');
  });

  test('threshold partner routing uses an active exact owner or NULL without fallback', () => {
    const resolverStart = sql.indexOf(
      'create or replace function public.partner_service_fulfillment_partner_id_for_car_booking',
    );
    const resolverEnd = sql.indexOf(
      'comment on function public.partner_service_fulfillment_partner_id_for_car_booking',
      resolverStart,
    );
    const resolver = sql.slice(resolverStart, resolverEnd);
    expect(resolver).toContain("v_pricing_strategy = 'threshold_daily_rate' then");
    expect(resolver).toContain('partner.id = v_exact_owner_id');
    expect(resolver).toContain('return pid;');
    expect(resolver).not.toContain("and v_exact_owner_id is not null then");
    expect(sql).toContain('car_end_to_end_legacy_partner_routing_changed');
    expect(pgGate).toContain('threshold exact owner fell back or remained public');
  });

  test('booking admission checks exact public route and remains status-neutral', () => {
    expect(sql).toContain('car_threshold_booking_public_eligibility_guard');
    expect(sql).toContain('threshold_booking_offer_or_route_not_public_eligible');
    expect(sql).toContain('before insert on public.car_bookings');
    const guardStart = sql.indexOf('create or replace function public.car_threshold_booking_public_eligibility_guard');
    const guardEnd = sql.indexOf('drop trigger if exists car_bookings_00_threshold_public_eligibility');
    const guard = sql.slice(guardStart, guardEnd);
    expect(guard).not.toContain('new.status');
    expect(guard).not.toContain('new.payment_status');
  });

  test('Admin batch RPC is exact, stale-safe, directional and trigger-safe', () => {
    expect(sql).toContain('admin_save_car_offer_city_availability_batch');
    expect(sql).toContain('car_availability_batch_admin_required');
    expect(sql).toContain('car_availability_batch_stale_snapshot');
    expect(sql).toContain('public.car_offer_city_availability.pickup_enabled or excluded.pickup_enabled');
    expect(sql).toContain('public.car_offer_city_availability.return_enabled or excluded.return_enabled');
    expect(sql).toContain('availability.is_active is distinct from (desired.pickup_enabled or desired.return_enabled)');
    expect(sql).not.toContain('desired.pickup_enabled = desired.return_enabled');
    const bridge = sql.indexOf('phase 1 is a monotonic bridge');
    const exact = sql.indexOf('phase 2 applies the exact reviewed directional state');
    const inactive = sql.indexOf('persist explicitly retained inactive rows');
    const removal = sql.indexOf('remove rows absent from the reviewed final rowset last');
    expect(bridge).toBeGreaterThan(0);
    expect(exact).toBeGreaterThan(bridge);
    expect(inactive).toBeGreaterThan(exact);
    expect(removal).toBeGreaterThan(inactive);
    expect(pgGate).toContain('cross-row directional swap did not reach exact final state');
    expect(pgGate).toContain('Both-to-one transition');
    expect(pgGate).toContain('stale snapshot unexpectedly succeeded');
  });

  test('Admin activation RPC is exact, optimistic and never changes flags or bookings', () => {
    const activationStart = sql.indexOf(
      'create or replace function public.admin_set_car_threshold_offer_activation_state',
    );
    const activationEnd = sql.indexOf(
      'comment on function public.admin_set_car_threshold_offer_activation_state',
      activationStart,
    );
    const activation = sql.slice(activationStart, activationEnd);
    expect(activation).toContain('car_threshold_activation_admin_required');
    expect(activation).toContain('car_threshold_activation_stale_offer');
    expect(activation).toContain('for update');
    expect(activation).toContain('for share');
    expect(activation).toContain('car_threshold_offer_has_public_prerequisites');
    expect(activation).toContain('car_threshold_activation_changed_capability_flags');
    expect(activation).not.toContain('update public.site_settings');
    expect(activation).not.toContain('car_bookings');
    expect(pgGate).toContain('stale activation unexpectedly succeeded');
    expect(pgGate).toContain('non-admin activation unexpectedly succeeded');
  });

  test('combined verify is read-only and exposes one final PASS field', () => {
    const normalized = compact(verify);
    expect(normalized).toContain('car_rental_end_to_end_public_eligibility_safe');
    expect(normalized).toContain('exact_owner_fail_closed_safe');
    expect(normalized).toContain('admin_batch_contract_safe');
    expect(normalized).toContain('public_policy_contract_safe');
    expect(normalized).toContain("legacy.protected_fingerprint = 'aa1abc7ce187779927838bafb706cf3b'");
    expect(verify).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|call)\s+(?:into\s+|from\s+|table\s+)?public\./im,
    );
  });
});
