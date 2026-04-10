import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

function buildSeedScript() {
  return () => {
    const now = Date.now();
    const isoDaysAgo = (days: number) => new Date(now - days * 86400000).toISOString();

    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const partnerUser = stub.seedUser({
          email: 'partner.referrals@example.com',
          password: 'super-secret',
          profile: {
            id: 'profile-partner-referrals',
            name: 'Cyprus Referral Partner',
            username: 'cyprus-referrals',
            referral_code: 'CYREF123',
          },
        });

        stub.seedTable('partners', [
          {
            id: 'partner-referrals-1',
            name: 'Referral Partner',
            slug: 'referral-partner',
            status: 'active',
            affiliate_enabled: true,
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('partner_users', [
          {
            id: 'partner-user-referrals-1',
            partner_id: 'partner-referrals-1',
            user_id: partnerUser.id,
            role: 'owner',
            created_at: isoDaysAgo(60),
          },
        ]);

        stub.seedTable('hotels', [
          {
            id: 'hotel-ref-1',
            slug: 'lefkara-courtyard',
            title: { en: 'Lefkara Courtyard', pl: 'Dziedziniec Lefkara' },
            city: 'Lefkara',
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('trips', [
          {
            id: 'trip-ref-1',
            slug: 'troodos-loop',
            title: { en: 'Troodos Loop', pl: 'Pętla Troodos' },
            start_city: 'Larnaca',
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('car_offers', [
          {
            id: 'car-ref-1',
            car_model: 'Suzuki Swift',
            car_type: 'Economy',
            location: 'Larnaca',
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('transport_locations', [
          { id: 'loc-airport', name: 'Larnaca Airport', code: 'LCA' },
          { id: 'loc-ayia-napa', name: 'Ayia Napa', code: 'AYA' },
        ]);

        stub.seedTable('transport_routes', [
          {
            id: 'route-ref-1',
            origin_location_id: 'loc-airport',
            destination_location_id: 'loc-ayia-napa',
          },
        ]);

        stub.seedTable('hotel_bookings', [
          {
            id: 'hotel-booking-ref-1',
            hotel_id: 'hotel-ref-1',
            hotel_slug: 'lefkara-courtyard',
            arrival_date: '2026-04-20',
            departure_date: '2026-04-24',
            customer_name: 'Maria Guest',
            total_price: 420,
            status: 'pending',
            referral_partner_id: 'partner-referrals-1',
            referral_code: 'CYREF123',
            referral_source: 'url',
            referral_captured_at: isoDaysAgo(2),
            created_at: isoDaysAgo(2),
            updated_at: isoDaysAgo(2),
          },
        ]);

        stub.seedTable('trip_bookings', [
          {
            id: 'trip-booking-ref-1',
            trip_id: 'trip-ref-1',
            trip_slug: 'troodos-loop',
            trip_date: '2026-04-18',
            customer_name: 'John Tripper',
            total_price: 180,
            status: 'confirmed',
            referral_partner_id: 'partner-referrals-1',
            referral_code: 'CYREF123',
            referral_source: 'manual',
            referral_captured_at: isoDaysAgo(3),
            created_at: isoDaysAgo(3),
            updated_at: isoDaysAgo(3),
          },
        ]);

        stub.seedTable('car_bookings', [
          {
            id: 'car-booking-ref-1',
            offer_id: 'car-ref-1',
            pickup_date: '2026-04-22',
            return_date: '2026-04-25',
            customer_name: 'Alex Driver',
            total_price: 210,
            status: 'pending',
            referral_partner_id: 'partner-referrals-1',
            referral_code: 'CYREF123',
            referral_source: 'stored',
            referral_captured_at: isoDaysAgo(1),
            created_at: isoDaysAgo(1),
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('transport_bookings', [
          {
            id: 'transport-booking-ref-1',
            route_id: 'route-ref-1',
            travel_date: '2026-04-19',
            travel_time: '10:30',
            customer_name: 'Chris Transfer',
            total_price: 95,
            status: 'confirmed',
            payment_status: 'paid',
            currency: 'EUR',
            referral_partner_id: 'partner-referrals-1',
            referral_code: 'CYREF123',
            referral_source: 'url',
            referral_captured_at: isoDaysAgo(4),
            created_at: isoDaysAgo(4),
            updated_at: isoDaysAgo(4),
          },
        ]);

        stub.setSession({
          id: partnerUser.id,
          email: partnerUser.email,
          user_metadata: { name: 'Cyprus Referral Partner' },
        });
        if (stub.state?.currentSession) {
          stub.state.currentSession.access_token = 'partner-referrals-token';
          stub.state.currentSession.refresh_token = 'partner-referrals-refresh-token';
        }
      },
    };
  };
}

async function preparePartnerReferralStub(page: any) {
  await page.addInitScript(buildSeedScript());
  await enableSupabaseStub(page);
}

test.describe('Partner referral attribution smoke', () => {
  test('partner sees order-level referral attribution separate from tree metrics', async ({ page }) => {
    await preparePartnerReferralStub(page);

    await page.goto('/partners/');
    await waitForSupabaseStub(page);

    await page.waitForSelector('#partnerPortalApp:not([hidden])');
    await expect(page.locator('#partnerNavReferrals')).toBeVisible();

    await page.click('#partnerNavReferrals');
    await page.waitForSelector('#partnerReferralsView:not([hidden])');
    await expect(page.locator('#partnerReferralOrdersCard')).toBeVisible();

    await expect(page.locator('#partnerReferralOrdersTotal')).toHaveText('4');
    await expect(page.locator('#partnerReferralOrdersManual')).toHaveText('1');
    await expect(page.locator('#partnerReferralOrdersLink')).toHaveText('3');
    await expect(page.locator('#partnerReferralOrdersGross')).toContainText('905.00');

    const rows = page.locator('#partnerReferralOrdersBody tr');
    await expect(rows).toHaveCount(4);
    await expect(page.locator('#partnerReferralOrdersBody')).toContainText('Lefkara Courtyard');
    await expect(page.locator('#partnerReferralOrdersBody')).toContainText('Troodos Loop');
    await expect(page.locator('#partnerReferralOrdersBody')).toContainText('Suzuki Swift');
    await expect(page.locator('#partnerReferralOrdersBody')).toContainText('Larnaca Airport');
    await expect(page.locator('#partnerReferralOrdersBody')).toContainText('Manual');
    await expect(page.locator('#partnerReferralOrdersBody')).toContainText('Link');
    await expect(page.locator('#partnerReferralOrdersBody')).toContainText('Saved');
  });
});
