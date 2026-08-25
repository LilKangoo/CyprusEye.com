import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'js/partners.js'), 'utf8');

function functionSlice(name: string, nextName: string): string {
  const start = source.indexOf(name);
  const end = source.indexOf(nextName, start + name.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Hotels H1A Partner Portal booking security compatibility', () => {
  test('never selects hotel_bookings directly from Partner Portal', () => {
    expect(source).not.toMatch(/\.from\(['"]hotel_bookings['"]\)/);
    expect(source).toContain("'partner_get_hotel_booking_operational_context'");

    const helperCalls = source.match(/loadPartnerHotelBookingOperationalContext\s*\(/g) || [];
    // H3.2B moved Hotel availability out of the legacy generic availability
    // path into the reviewed normalized Hotel workspace. The secure helper remains
    // required for the remaining Hotel booking operational-context flows.
    expect(helperCalls.length).toBeGreaterThanOrEqual(4);
  });

  test('uses the redacted referral attribution bridge', () => {
    expect(source).toContain("rpc('partner_get_referral_attributed_orders_safe'");
    expect(source).not.toContain("rpc('partner_get_referral_attributed_orders',");
  });

  test('calls the operational RPC with exact selected partner and bounded filters', () => {
    const helper = functionSlice(
      'async function loadPartnerHotelBookingOperationalContext',
      'async function enrichReferralAttributedOrders',
    );

    expect(helper).toContain('options.partnerId || state.selectedPartnerId');
    expect(helper).toContain('p_partner_id: partnerId');
    expect(helper).toContain('p_booking_ids: bookingIds.length ? bookingIds : null');
    expect(helper).toContain('p_hotel_ids: hotelIds.length ? hotelIds : null');
    expect(helper).toContain('p_start_date: startDate');
    expect(helper).toContain('p_end_date: endDate');
    expect(helper).toContain('Math.min(1000');
  });

  test('whitelists operational fields and excludes customer PII', () => {
    const helper = functionSlice(
      'async function loadPartnerHotelBookingOperationalContext',
      'async function enrichReferralAttributedOrders',
    );

    expect(helper).toContain('booking_id: String(row.booking_id)');
    expect(helper).toContain('fulfillment_id: row.fulfillment_id');
    expect(helper).toContain('hotel_id: row.hotel_id');
    expect(helper).toContain('arrival_date: row.arrival_date');
    expect(helper).toContain('room_type_id: row.room_type_id');
    expect(helper).toContain('status: row.status');
    expect(helper).not.toMatch(/row\.customer_(?:name|email|phone)/);
    expect(helper).not.toMatch(/row\.notes/);
    expect(helper).not.toMatch(/\.\.\.row/);
  });

  test('does not fall back to raw Hotel bookings for referral orders', () => {
    const fallback = functionSlice(
      'async function loadReferralAttributedOrdersDirect',
      'const PARTNER_HOTEL_OPERATIONAL_CONTEXT_RPC',
    );

    expect(fallback).not.toContain("loadTable('hotels'");
    expect(fallback).not.toContain(".from('hotel_bookings')");
    expect(fallback).toContain('The primary');
  });

  test('preserves exact-fulfillment contact and snapshot reveal gates', () => {
    expect(source).toContain(".from('partner_service_fulfillments')");
    expect(source).toContain(".eq('partner_id', state.selectedPartnerId)");
    expect(source).toContain("f && f.__source === 'service' && f.contact_revealed_at");
    expect(source).toContain(".from('partner_service_fulfillment_contacts')");
    expect(source).toContain(".from('partner_service_fulfillment_form_snapshots')");
  });
});
