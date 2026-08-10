import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const PARTNER_ID = '583ee90b-d77c-47ff-97a4-76657a87809f';
const PARTNER_USER_ID = '5c3ab931-af5c-4bab-a7ab-9474afab339e';
const OFFER_ID = '2817e6de-25ba-5237-b721-dbc0460a7de4';
const BOOKING_ID = 'cffce74a-0617-44a2-b6d8-481043c95d8f';
const FULFILLMENT_ID = '1569af6f-f98a-4f1b-95cc-055963c75c98';

function seedThresholdCarsFulfillment() {
  return () => {
    const partnerId = '583ee90b-d77c-47ff-97a4-76657a87809f';
    const partnerUserId = '5c3ab931-af5c-4bab-a7ab-9474afab339e';
    const offerId = '2817e6de-25ba-5237-b721-dbc0460a7de4';
    const bookingId = 'cffce74a-0617-44a2-b6d8-481043c95d8f';
    const fulfillmentId = '1569af6f-f98a-4f1b-95cc-055963c75c98';
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const user = stub.seedUser({
          email: 'speedbikes.partner@example.test',
          password: 'partner-password',
          profile: {
            id: partnerUserId,
            email: 'speedbikes.partner@example.test',
            username: 'speedbikespartner',
            name: 'Speed Bikes Partner',
          },
        });

        stub.seedTable('profiles', [{
          id: user.id,
          email: user.email,
          username: 'speedbikespartner',
          name: 'Speed Bikes Partner',
          is_admin: false,
        }]);
        stub.seedTable('partners', [{
          id: partnerId,
          name: 'Speed Bikes',
          slug: 'speed-bikes',
          status: 'active',
          can_manage_cars: true,
          cars_locations: [],
        }]);
        stub.seedTable('partner_users', [{
          id: 'speed-bikes-membership',
          partner_id: partnerId,
          user_id: user.id,
          role: 'owner',
          created_at: '2026-08-01T00:00:00.000Z',
        }]);

        stub.seedTable('car_offers', [
          {
            id: offerId,
            car_model: { en: 'Kymco UVX' },
            car_type: { en: 'Buggy' },
            location: 'larnaca',
            pricing_strategy: 'threshold_daily_rate',
            owner_partner_id: partnerId,
            is_published: true,
            is_available: true,
            updated_at: '2026-08-10T09:55:00.000Z',
          },
          {
            id: 'wrong-owner-threshold-offer',
            car_model: { en: 'Wrong owner threshold fixture' },
            location: 'larnaca',
            pricing_strategy: 'threshold_daily_rate',
            owner_partner_id: 'another-partner',
            is_published: true,
            is_available: true,
          },
          {
            id: 'legacy-larnaca-offer',
            car_model: { en: 'Legacy Larnaca fixture' },
            location: 'larnaca',
            pricing_strategy: 'legacy_compat',
            owner_partner_id: partnerId,
            is_published: true,
            is_available: true,
          },
        ]);

        stub.seedTable('car_bookings', [
          {
            id: bookingId,
            offer_id: offerId,
            car_model: 'Kymco UVX',
            status: 'pending',
            payment_status: 'unpaid',
            pickup_date: '2026-09-10',
            return_date: '2026-09-13',
            created_at: '2026-08-10T10:00:26.909Z',
          },
          {
            id: 'wrong-owner-booking',
            offer_id: 'wrong-owner-threshold-offer',
            status: 'pending',
            payment_status: 'unpaid',
          },
          {
            id: 'legacy-location-booking',
            offer_id: 'legacy-larnaca-offer',
            status: 'pending',
            payment_status: 'unpaid',
          },
        ]);

        const pending = (id: string, bookingId: string, resourceId: string, summary: string) => ({
          id,
          partner_id: partnerId,
          resource_type: 'cars',
          booking_id: bookingId,
          resource_id: resourceId,
          status: 'pending_acceptance',
          reference: `CAR-${bookingId.slice(0, 8)}`,
          summary,
          start_date: '2026-09-10',
          end_date: '2026-09-13',
          total_price: 270,
          currency: 'EUR',
          details: {
            duration_days: 3,
            pickup_date: '2026-09-10',
            pickup_time: '09:15:00',
            return_date: '2026-09-13',
            return_time: '11:45:00',
            pickup_location: 'ayia-napa',
            return_location: 'ayia-napa',
            base_rental_price: 270,
            pickup_location_fee: 0,
            return_location_fee: 0,
            final_rental_price: 270,
          },
          contact_revealed_at: null,
          created_at: '2026-08-10T10:00:26.909Z',
        });
        stub.seedTable('partner_service_fulfillments', [
          pending(fulfillmentId, bookingId, offerId, 'Kymco UVX'),
          pending('wrong-owner-fulfillment', 'wrong-owner-booking', 'wrong-owner-threshold-offer', 'Wrong owner threshold fixture'),
          pending('legacy-location-fulfillment', 'legacy-location-booking', 'legacy-larnaca-offer', 'Legacy Larnaca fixture'),
        ]);
        stub.seedTable('shop_order_fulfillments', []);
        stub.seedTable('service_deposit_requests', []);
        stub.seedTable('partner_resources', []);
        stub.seedTable('partner_resource_assignments', []);
        stub.seedTable('partner_availability_blocks', []);

        stub.setSession({
          id: user.id,
          email: user.email,
          user_metadata: { name: 'Speed Bikes Partner' },
        });
        if (stub.state?.currentSession) {
          stub.state.currentSession.access_token = 'speed-bikes-partner-token';
          stub.state.currentSession.refresh_token = 'speed-bikes-partner-refresh-token';
        }
      },
    };
  };
}

test.describe('threshold Cars fulfillment visibility in Partner Portal', () => {
  test('pending unpaid exact-owner request is visible and keeps manual Accept/Reject actions', async ({ page }) => {
    await page.addInitScript(seedThresholdCarsFulfillment());
    await enableSupabaseStub(page);
    await page.goto('/partners/', { waitUntil: 'domcontentloaded' });
    await waitForSupabaseStub(page);

    await expect(page.locator('#partnerPortalApp:not([hidden])')).toBeVisible();
    await expect(page.locator('#partnerPortalStatus')).toHaveText('Loaded 1 fulfillments.');
    await expect(page.locator('#fulfillmentsHint')).toContainText('1 fulfillment(s) awaiting acceptance');

    const row = page.locator(`#fulfillmentsTableBody tr[data-fulfillment-id="${FULFILLMENT_ID}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Kymco UVX');
    await expect(row).toContainText('270.00 EUR');
    await expect(row.locator('button[data-action="accept"]')).toBeVisible();
    await expect(row.locator('button[data-action="reject"]')).toBeVisible();
    await expect(page.locator('#fulfillmentsTableBody')).not.toContainText('Wrong owner threshold fixture');
    await expect(page.locator('#fulfillmentsTableBody')).not.toContainText('Legacy Larnaca fixture');

    await row.locator('button[data-partner-details-open]').click();
    await expect(page.locator('#partnerDetailsModal.is-open')).toBeVisible();
    await expect(page.locator('#partnerDetailsBody')).toContainText('Pickup time');
    await expect(page.locator('#partnerDetailsBody')).toContainText('09:15:00');
    await expect(page.locator('#partnerDetailsBody')).toContainText('Return time');
    await expect(page.locator('#partnerDetailsBody')).toContainText('11:45:00');
    await expect(page.locator('#partnerDetailsBody')).not.toContainText('speedbikes.partner@example.test');
    await page.locator('[data-partner-details-close]').first().click();
    await expect(page.locator('#partnerDetailsModal.is-open')).toBeHidden();

    await page.evaluate(() => {
      const client = (window as any).getSupabase();
      (window as any).__partnerFulfillmentActionCalls = [];
      client.functions = {
        invoke: async (name: string, options: any) => {
          (window as any).__partnerFulfillmentActionCalls.push({ name, body: options?.body || null });
          return { data: { ok: true }, error: null };
        },
      };
    });

    page.once('dialog', async (dialog) => dialog.accept());
    await row.locator('button[data-action="accept"]').click();
    await expect.poll(async () => page.evaluate(() => (window as any).__partnerFulfillmentActionCalls.length)).toBe(1);

    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.accept(dialog.type() === 'prompt' ? 'Not available' : undefined);
    });
    await row.locator('button[data-action="reject"]').click();
    await expect.poll(async () => page.evaluate(() => (window as any).__partnerFulfillmentActionCalls.length)).toBe(2);

    const result = await page.evaluate(() => ({
      calls: (window as any).__partnerFulfillmentActionCalls,
      booking: (window as any).__supabaseStub.getTableRows('car_bookings')
        .find((item: any) => item.id === 'cffce74a-0617-44a2-b6d8-481043c95d8f'),
      fulfillment: (window as any).__supabaseStub.getTableRows('partner_service_fulfillments')
        .find((item: any) => item.id === '1569af6f-f98a-4f1b-95cc-055963c75c98'),
    }));

    expect(result.calls).toEqual([
      expect.objectContaining({
        name: 'partner-fulfillment-action',
        body: expect.objectContaining({ fulfillment_id: FULFILLMENT_ID, action: 'accept' }),
      }),
      expect.objectContaining({
        name: 'partner-fulfillment-action',
        body: expect.objectContaining({ fulfillment_id: FULFILLMENT_ID, action: 'reject' }),
      }),
    ]);
    expect(dialogs).toEqual(['prompt', 'confirm']);
    expect(result.booking).toEqual(expect.objectContaining({ status: 'pending', payment_status: 'unpaid' }));
    expect(result.fulfillment).toEqual(expect.objectContaining({
      partner_id: PARTNER_ID,
      status: 'pending_acceptance',
    }));
  });
});
