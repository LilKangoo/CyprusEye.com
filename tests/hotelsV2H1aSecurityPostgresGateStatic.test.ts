import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Hotels V2 H1A isolated PostgreSQL security gate', () => {
  const base = read('tests/integration/hotels-v2-h1a-base.sql');
  const gate = read('tests/integration/hotels-v2-h1a-security-postgres-gate.sql');

  test('applies the exact partner bridge before the booking lockdown', () => {
    const bridge = '20260811150000_hotels_v2_h1a_partner_security_bridge.sql';
    const lockdown = '20260811180000_hotels_v2_h1a_booking_security_lockdown.sql';
    expect(gate).toContain(bridge);
    expect(gate).toContain(lockdown);
    expect(gate.indexOf(bridge)).toBeLessThan(gate.indexOf(lockdown));
  });

  test('uses only synthetic identities and records protected fingerprints', () => {
    expect(base).toContain('Synthetic identities and contact');
    expect(base).toContain('hotels_h1a_fixture_fingerprints');
    expect(base).toContain('booking_fingerprint');
    expect(base).toContain('fulfillment_fingerprint');
    expect(base).toContain('deposit_fingerprint');
    expect(base).toContain('coupon_fingerprint');
  });

  test('covers anonymous, cross-customer, Admin, service_role and exact-partner access', () => {
    expect(gate).toContain('hotels_h1a_gate_anon_select_unexpectedly_allowed');
    expect(gate).toContain('hotels_h1a_gate_anon_insert_contract_failed');
    expect(gate).toContain('customer_a_own_only');
    expect(gate).toContain('customer_a_legacy_guest_via_verified_rpc');
    expect(gate).toContain('customer_get_hotel_bookings(100)');
    expect(gate).toContain('customer_b_cross_customer_blocked');
    expect(gate).toContain('admin_select_all');
    expect(gate).toContain('service_role_all_access');
    expect(gate).toContain('hotels_h1a_gate_partner_cross_scope_unexpectedly_allowed');
    expect(gate).toContain('hotels_h1a_gate_partner_b_cross_scope_unexpectedly_allowed');
    expect(gate).toContain('exact_partner_rpc_only');
    expect(gate).toContain('safe_referral_customer_name_redacted');
    expect(gate).toContain('hotels_h1a_gate_legacy_referral_rpc_unexpectedly_allowed');
    expect(gate).toContain('partner_get_referral_attributed_orders_safe');
  });

  test('guards the non-PII RPC, internal grants and manual pending lifecycle', () => {
    expect(gate).toContain('rpc_contract_has_no_pii');
    expect(gate).toContain('booking_details|private_note');
    expect(gate).toContain('hotels_h1a_gate_function_grant_contract_failed');
    expect(gate).toContain("fulfillment.status <> 'pending_acceptance'");
    expect(gate).toContain('hotels_h1a_gate_partner_confirmation_lifecycle_changed');
    expect(gate).toContain('protected_fingerprints_unchanged');
    expect(gate).toContain('rollback;');
  });
});
