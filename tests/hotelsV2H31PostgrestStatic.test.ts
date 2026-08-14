import fs from 'node:fs';

const base = fs.readFileSync('tests/integration/hotels-v2-h3-1-postgrest-base.sql', 'utf8');
const config = fs.readFileSync('tests/integration/hotels-v2-h3-1-postgrest.conf', 'utf8');
const gate = fs.readFileSync('tests/integration/hotels-v2-h3-1-postgrest-gate.mjs', 'utf8');

describe('Hotels V2 H3.1 real PostgREST gate', () => {
  test('is loopback-only and composes the exact inert migration chain', () => {
    expect(base).toContain('hotels-v2-h2b1-postgrest-base.sql');
    expect(base).toContain('20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql');
    expect(base).toContain('20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql');
    expect(config).toContain('127.0.0.1');
    expect(config).toContain('server-port = 53010');
    expect(gate).toContain("['127.0.0.1', 'localhost', '::1']");
    expect(gate).toContain("assert.equal(parsedUrl.protocol, 'http:'");
  });

  test('exercises the exact approved configuration and canonical DB payload', () => {
    expect(gate).toContain("entity: 'property_configuration'");
    expect(gate).toContain('minimum_stay_nights: 2');
    expect(gate).toContain('minimum_billable_occupancy: 2');
    expect(gate).toContain("allocationOperation(0, 1, 4, 'customer_choice')");
    expect(gate).toContain("allocationOperation(1, 5, 5, 'required_bundle', [3, 2])");
    expect(gate).toContain('min_guest_count: guestMin');
    expect(gate).toContain('units_required: 1');
    expect(gate).toContain("due_event: 'after_partner_acceptance'");
    expect(gate).toContain('amount_value: 50');
    expect(gate).toContain("due_event: 'on_arrival'");
    expect(gate).toContain("due_event: 'at_booking'");
    expect(gate).toContain("recipient: 'platform'");
    expect(gate).toContain('amount_value: 100');
    expect(gate).toContain("commission_mode: 'per_allocated_room_per_night'");
    expect(gate).toContain("source_type: 'manual'");
    expect(gate).toContain("'private_transfer'");
    expect(gate).toContain('invalidFullPlusRemainder.status, 400');
    expect(gate).toContain('invalidNonfinalRemainder.status, 400');
  });

  test('covers authorization, atomic stale abort, overlap rejection and duplicate prevention', () => {
    for (const principal of ["['anon', TOKENS.anon]", "['non-admin', TOKENS.nonAdmin]", "['partner', TOKENS.partner]"]) {
      expect(gate).toContain(principal);
    }
    expect(gate).toMatch(/stale_pricing_schedule/);
    expect(gate).toContain('Stale plan partially changed property.');
    expect(gate).toContain('Overlapping active allocation unexpectedly succeeded.');
    expect(gate).toContain('Repeated exact create plan unexpectedly duplicated H3.1 rows.');
    expect(gate).toContain('Invalid payment left a partial policy.');
    expect(gate).toContain('hotels_v2_h3_1_postgrest_safe: true');
  });

  test('guards legacy architecture and all four disabled flags', () => {
    expect(gate).toContain("assert.equal(configuration.property.architecture_version, 'legacy'");
    for (const flag of [
      'hotel_rooms_v2_enabled',
      'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ]) expect(gate).toContain(`${flag}: false`);
  });
});
