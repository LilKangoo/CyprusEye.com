import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const bridge = read('supabase/migrations/20260811150000_hotels_v2_h1a_partner_security_bridge.sql');
const lockdown = read('supabase/migrations/20260811180000_hotels_v2_h1a_booking_security_lockdown.sql');
const admin = read('admin/admin.js');

describe('Hotels V2 H1A booking security foundation', () => {
  test('partner operational context is exact-partner scoped and omits customer PII', () => {
    expect(bridge).toContain('partner_get_hotel_booking_operational_context');
    expect(bridge).toContain('hotels_h1a_partner_bridge_historical_relationship_mismatch');
    expect(bridge).toContain('fulfillment.resource_id is distinct from booking.hotel_id');
    expect(bridge).toContain("fulfillment.resource_type = 'hotels'");
    expect(bridge).toContain('fulfillment.partner_id = p_partner_id');
    expect(bridge).toContain('fulfillment.resource_id = booking.hotel_id');
    expect(bridge).toContain('public.is_partner_user(p_partner_id)');
    expect(bridge).toContain('set search_path = pg_catalog, public');

    const functionStart = bridge.indexOf(
      'create or replace function public.partner_get_hotel_booking_operational_context',
    );
    const returnsStart = bridge.indexOf('returns table (', functionStart);
    const resultContract = bridge.slice(
      returnsStart,
      bridge.indexOf('language plpgsql', returnsStart),
    );
    expect(resultContract).not.toMatch(/customer_(?:name|email|phone)|\bnotes\b/i);
    expect(bridge).toContain('revoke all on function public.partner_get_hotel_booking_operational_context');
    expect(bridge).toContain('partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer) from service_role');
    expect(bridge).toContain('grant execute on function public.partner_get_hotel_booking_operational_context');
  });

  test('broad authenticated booking read is replaced by customer and Admin scopes', () => {
    expect(lockdown).toContain('drop policy if exists "Authenticated users can view hotel bookings"');
    expect(lockdown).toContain('drop policy if exists "Anyone can create hotel bookings"');
    expect(lockdown).toContain('create policy hotel_bookings_customer_select');
    expect(lockdown).toContain('user_id = auth.uid()');
    expect(lockdown).toContain('created_by = auth.uid()');
    expect(lockdown).not.toContain("auth.jwt()->>'email'");
    expect(bridge).toContain('customer_get_hotel_bookings');
    expect(bridge).toContain('partner_get_referral_attributed_orders_safe');
    expect(bridge).toContain('null::text as customer_name');
    expect(bridge).toContain('partner_get_referral_attributed_orders_safe(uuid,integer) from service_role');
    expect(bridge).toContain("auth.jwt()->>'email'");
    expect(bridge).toContain('booking.user_id is null');
    expect(lockdown).toContain('create policy hotel_bookings_admin_select');
    expect(lockdown).toContain('hotels_h1a_security_policy_set_mismatch');
    expect(lockdown).toContain('using (public.is_current_user_admin())');
    expect(lockdown).not.toMatch(/create\s+policy[\s\S]{0,180}for\s+select[\s\S]{0,180}using\s*\(\s*true\s*\)/i);
    expect(lockdown).toContain('revoke all on table public.hotel_bookings from anon');
    expect(lockdown).toContain('grant insert on table public.hotel_bookings to anon');
  });

  test('new authenticated bookings cannot claim another user identity', () => {
    expect(lockdown).toContain('hotel_bookings_assign_authenticated_owner');
    expect(lockdown).toContain('hotel_bookings_user_id_idx');
    expect(lockdown).toContain('hotel_bookings_created_by_idx');
    expect(lockdown).toContain('revoke all on function public.partner_get_referral_attributed_orders(uuid,integer) from authenticated');
    expect(lockdown).toContain('new.user_id := v_uid');
    expect(lockdown).toContain('hotel_booking_user_id_must_match_authenticated_user');
    expect(lockdown).toContain('hotel_booking_created_by_must_match_authenticated_user');
    expect(lockdown).toContain('(public.is_current_user_admin() or user_id = auth.uid())');
  });

  test('internal fulfillment writer is no longer a generic authenticated RPC', () => {
    expect(bridge).toContain('admin_upsert_partner_service_fulfillment_exact');
    expect(bridge).toContain('admin_fulfillment_upsert_required');
    expect(bridge).toContain('admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamptz) from service_role');
    expect(lockdown).toContain("'upsert_partner_service_fulfillment_from_booking_with_partner'");
    expect(lockdown).toContain("execute format('revoke execute on function %s from authenticated'");
    expect(admin).toContain("db.rpc('admin_upsert_partner_service_fulfillment_exact'");
    expect(admin).not.toContain("db.rpc('upsert_partner_service_fulfillment_from_booking_with_partner'");
  });

  test('customer Dashboard does not query the Hotel booking table directly', () => {
    const dashboard = read('js/dashboard.js');
    expect(dashboard).toContain("rpc('customer_get_hotel_bookings'");
    expect(dashboard).not.toMatch(/\.from\(['"]hotel_bookings['"]\)[\s\S]{0,160}customer_email/);
  });

  test('security migrations are transactional and protect operational rows', () => {
    for (const sql of [bridge, lockdown]) {
      expect(sql.trimStart().toLowerCase()).toMatch(/^begin;/);
      expect(sql.trimEnd().toLowerCase()).toMatch(/commit;$/);
      expect(sql).toContain('booking_fingerprint');
      expect(sql).toContain('fulfillment_fingerprint');
      expect(sql).not.toMatch(/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.(?:hotel_bookings|hotels|partner_service_fulfillments)\b/i);
    }
  });
});
