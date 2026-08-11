import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';

function seedHotelsH1aAdmin() {
  return () => {
    const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const profile = {
          id: ADMIN_ID,
          email: 'hotels-h1a-admin@example.test',
          username: 'hotels-h1a-admin',
          name: 'Hotels H1A Admin',
          is_admin: true,
          xp: 100,
          level: 5,
        };
        stub.seedUser({
          email: profile.email,
          password: 'admin-password',
          profile,
        });
        stub.setSession({ id: ADMIN_ID, email: profile.email, user_metadata: { username: profile.username } });
        stub.seedTable('profiles', [profile]);
        stub.seedTable('admin_users_overview', [{
          ...profile,
          created_at: '2026-08-01T08:00:00.000Z',
          updated_at: '2026-08-11T08:00:00.000Z',
          banned_until: null,
        }]);
        stub.seedTable('admin_system_diagnostics', []);
        stub.seedTable('hotel_cities', []);
        stub.seedTable('hotel_amenities', []);
        stub.seedTable('hotel_categories', []);
        stub.seedTable('hotels', [
          {
            id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
            slug: '7-ukow',
            title: { en: '7 Arches' },
            city: 'Lefkara',
            pricing_model: 'tiered_by_nights',
            pricing_tiers: { rules: [{ persons: 2, min_nights: 2, price_per_night: 100 }] },
            is_published: true,
            sort_order: 10,
            updated_at: '2026-08-11T08:00:00.000Z',
          },
          {
            id: 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
            slug: 'rgb-cabins-larnaka-centrum',
            title: { en: 'RGB Cabins - Larnaca City Centre' },
            city: 'Larnaca',
            pricing_model: 'flat_per_night',
            pricing_tiers: { rules: [{ persons: 2, min_nights: 2, price_per_night: 45 }] },
            is_published: false,
            sort_order: 20,
            updated_at: '2026-08-10T08:00:00.000Z',
          },
        ]);
        stub.seedTable('hotel_bookings', [
          {
            id: '1f1bef2f-ba2b-4d6c-9c43-8714e0224bd1',
            hotel_id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
            hotel_slug: '7-ukow',
            customer_name: 'Synthetic Confirmed Guest',
            customer_email: 'confirmed@example.test',
            arrival_date: '2026-09-01',
            departure_date: '2026-09-03',
            nights: 2,
            num_adults: 2,
            num_children: 0,
            total_price: 200,
            status: 'confirmed',
            created_at: '2026-08-11T08:00:00.000Z',
          },
          {
            id: 'a2377882-4959-45ac-b311-3eb16afaa01d',
            hotel_id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
            hotel_slug: '7-ukow',
            customer_name: 'Synthetic Cancelled Guest',
            customer_email: 'cancelled@example.test',
            arrival_date: '2026-10-01',
            departure_date: '2026-10-03',
            nights: 2,
            num_adults: 2,
            num_children: 0,
            total_price: 180,
            status: 'cancelled',
            created_at: '2026-08-10T08:00:00.000Z',
          },
          {
            id: 'a509b9da-9fd6-4836-8525-1068e23303ca',
            hotel_id: 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
            hotel_slug: 'rgb-cabins-larnaka-centrum',
            customer_name: 'Synthetic Confirmed RGB Guest',
            customer_email: 'rgb@example.test',
            arrival_date: '2026-11-01',
            departure_date: '2026-11-03',
            nights: 2,
            num_adults: 2,
            num_children: 0,
            total_price: 90,
            status: 'confirmed',
            created_at: '2026-08-09T08:00:00.000Z',
          },
        ]);
      },
    };
  };
}

test('legacy Hotels Admin list and booking views remain operational after H1A RLS compatibility changes', async ({ page }) => {
  await page.addInitScript(seedHotelsH1aAdmin());
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);

  await expect(page.locator('#adminContainer')).toBeVisible();
  await page.locator('button.admin-nav-item[data-view="hotels"]').click();
  await expect(page.locator('#viewHotels')).toBeVisible();
  await expect(page.locator('#hotelsStatTotal')).toHaveText('2');
  await expect(page.locator('#hotelsStatPublished')).toHaveText('1');
  await expect(page.locator('#hotelsTableBody tr')).toHaveCount(2);
  await expect(page.locator('#hotelsTableBody')).toContainText('7 Arches');
  await expect(page.locator('#hotelsTableBody')).toContainText('RGB Cabins - Larnaca City Centre');

  await page.locator('.hotels-tab-button[data-tab="bookings"]').click();
  await expect(page.locator('#hotelsTabBookings')).toBeVisible();
  await expect(page.locator('#statHotelBookingsTotal')).toHaveText('3');
  await expect(page.locator('#statHotelBookingsPending')).toHaveText('0');
  await expect(page.locator('#statHotelBookingsConfirmed')).toHaveText('2');
  await expect(page.locator('#hotelBookingsTableBody tr')).toHaveCount(3);
  await expect(page.locator('#hotelBookingsTableBody')).toContainText('Synthetic Confirmed Guest');
  await expect(page.locator('#hotelBookingsTableBody')).toContainText('Synthetic Confirmed RGB Guest');

  const rawAudit = await page.evaluate(() => ({
    hotelRows: (window as any).__supabaseStub.getTableRows('hotels').length,
    bookingRows: (window as any).__supabaseStub.getTableRows('hotel_bookings').length,
    hotelMutations: (window as any).__supabaseStub.getMutationCalls()
      .filter((call: any) => call.table === 'hotels' || call.table === 'hotel_bookings'),
  }));
  expect(rawAudit).toEqual({ hotelRows: 2, bookingRows: 3, hotelMutations: [] });
});
