import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const PARTNER_A_ID = '40000000-0000-4000-8000-000000000001';
const PARTNER_A_USER_ID = '30000000-0000-4000-8000-000000000001';
const PARTNER_B_ID = '40000000-0000-4000-8000-000000000002';
const HOTEL_A_ID = '50000000-0000-4000-8000-000000000001';
const HOTEL_B_ID = '50000000-0000-4000-8000-000000000002';
const BOOKING_A_ID = '60000000-0000-4000-8000-000000000001';
const BOOKING_B_ID = '60000000-0000-4000-8000-000000000002';
const FULFILLMENT_A_ID = '70000000-0000-4000-8000-000000000001';

function seedHotelsH1aPartnerPortal() {
  return () => {
    const PARTNER_A_ID = '40000000-0000-4000-8000-000000000001';
    const PARTNER_A_USER_ID = '30000000-0000-4000-8000-000000000001';
    const PARTNER_B_ID = '40000000-0000-4000-8000-000000000002';
    const HOTEL_A_ID = '50000000-0000-4000-8000-000000000001';
    const HOTEL_B_ID = '50000000-0000-4000-8000-000000000002';
    const BOOKING_A_ID = '60000000-0000-4000-8000-000000000001';
    const BOOKING_B_ID = '60000000-0000-4000-8000-000000000002';
    const FULFILLMENT_A_ID = '70000000-0000-4000-8000-000000000001';

    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        (window as any).__rawHotelBookingSelectCount = 0;
        stub.selectErrorsByTable = new Proxy({}, {
          get(_target, property) {
            if (String(property) === 'hotel_bookings') {
              (window as any).__rawHotelBookingSelectCount += 1;
              return { message: 'raw_hotel_bookings_access_forbidden_in_h1a_fixture' };
            }
            return undefined;
          },
        });

        const user = stub.seedUser({
          email: 'hotel-a.partner@example.test',
          password: 'partner-password',
          profile: {
            id: PARTNER_A_USER_ID,
            email: 'hotel-a.partner@example.test',
            username: 'hotela',
            name: 'Hotel Partner A',
          },
        });

        stub.seedTable('profiles', [{
          id: user.id,
          email: user.email,
          username: 'hotela',
          name: 'Hotel Partner A',
          is_admin: false,
        }]);
        stub.seedTable('partners', [
          {
            id: PARTNER_A_ID,
            name: 'Synthetic Hotel Partner A',
            slug: 'synthetic-hotel-a',
            status: 'active',
            can_manage_hotels: true,
          },
          {
            id: PARTNER_B_ID,
            name: 'Synthetic Hotel Partner B',
            slug: 'synthetic-hotel-b',
            status: 'active',
            can_manage_hotels: true,
          },
        ]);
        stub.seedTable('partner_users', [{
          id: '41000000-0000-4000-8000-000000000001',
          partner_id: PARTNER_A_ID,
          user_id: user.id,
          role: 'owner',
          created_at: '2026-08-11T08:00:00.000Z',
        }]);

        stub.seedTable('hotels', [
          {
            id: HOTEL_A_ID,
            slug: 'synthetic-boutique-a',
            title: { en: 'Synthetic Boutique Hotel' },
            city: 'Ayia Napa',
            cover_image_url: '/images/hotels/synthetic-a.webp',
            photos: [],
            room_types: [{
              id: 'room-a',
              name: { en: 'Sea View' },
              inventory_units: 2,
              rate_plans: [{ id: 'rate-a', name: { en: 'Flexible' } }],
            }],
            address_line: 'Synthetic address',
            country: 'Cyprus',
          },
          {
            id: HOTEL_B_ID,
            slug: 'synthetic-boutique-b',
            title: { en: 'Other Partner Hotel' },
            city: 'Paphos',
            photos: [],
            room_types: [],
          },
        ]);

        // Deliberately seed raw PII. The Partner Portal must never select this
        // table; the Proxy above turns any attempted select into a counted error.
        stub.seedTable('hotel_bookings', [
          {
            id: BOOKING_A_ID,
            hotel_id: HOTEL_A_ID,
            status: 'pending',
            customer_name: 'RAW HOTEL PII MUST NOT RENDER',
            customer_email: 'raw-hotel-pii-never-read@example.test',
            customer_phone: '+35799009999',
            booking_details: { private_note: 'RAW PRIVATE HOTEL NOTE' },
          },
          {
            id: BOOKING_B_ID,
            hotel_id: HOTEL_B_ID,
            status: 'pending',
            customer_name: 'OTHER PARTNER RAW PII',
          },
        ]);

        const pendingFulfillment = (
          id: string,
          partnerId: string,
          bookingId: string,
          hotelId: string,
          summary: string,
        ) => ({
          id,
          partner_id: partnerId,
          resource_type: 'hotels',
          booking_id: bookingId,
          resource_id: hotelId,
          status: 'pending_acceptance',
          reference: `HOTEL-${bookingId.slice(0, 8)}`,
          summary,
          start_date: '2026-09-01',
          end_date: '2026-09-04',
          total_price: 420,
          currency: 'EUR',
          details: { operational_fixture: true },
          accepted_at: null,
          rejected_at: null,
          contact_revealed_at: null,
          created_at: '2026-08-11T08:00:01.000Z',
        });

        stub.seedTable('partner_service_fulfillments', [
          pendingFulfillment(
            FULFILLMENT_A_ID,
            PARTNER_A_ID,
            BOOKING_A_ID,
            HOTEL_A_ID,
            'Synthetic Boutique Hotel',
          ),
          pendingFulfillment(
            '70000000-0000-4000-8000-000000000002',
            PARTNER_B_ID,
            BOOKING_B_ID,
            HOTEL_B_ID,
            'Other Partner Hotel',
          ),
        ]);

        stub.seedTable('shop_order_fulfillments', []);
        stub.seedTable('service_deposit_requests', []);
        stub.seedTable('partner_resources', [{
          id: 'partner-hotel-a-resource',
          partner_id: PARTNER_A_ID,
          resource_type: 'hotels',
          resource_id: HOTEL_A_ID,
          is_active: true,
        }]);
        stub.seedTable('partner_resource_assignments', []);
        stub.seedTable('partner_availability_blocks', []);

        const operationalRows = [
          {
            __partner_id: PARTNER_A_ID,
            fulfillment_id: FULFILLMENT_A_ID,
            booking_id: BOOKING_A_ID,
            hotel_id: HOTEL_A_ID,
            arrival_date: '2026-09-01',
            departure_date: '2026-09-04',
            nights: 3,
            num_adults: 2,
            num_children: 1,
            total_price: 420,
            base_price: 400,
            final_price: 420,
            extras_price: 20,
            selected_extras: [{ code: 'breakfast' }],
            room_type_id: 'room-a',
            room_type_name: { en: 'Sea View' },
            rate_plan_id: 'rate-a',
            rate_plan_name: { en: 'Flexible' },
            cancellation_policy_type: 'flexible',
            room_inventory_units: 2,
            status: 'pending',
            currency: 'EUR',
          },
          {
            __partner_id: PARTNER_B_ID,
            fulfillment_id: '70000000-0000-4000-8000-000000000002',
            booking_id: BOOKING_B_ID,
            hotel_id: HOTEL_B_ID,
            arrival_date: '2026-09-01',
            departure_date: '2026-09-04',
            nights: 3,
            num_adults: 1,
            num_children: 0,
            total_price: 999,
            base_price: 999,
            final_price: 999,
            extras_price: 0,
            selected_extras: [],
            room_type_id: 'room-b',
            room_type_name: { en: 'Other Partner Room' },
            rate_plan_id: 'rate-b',
            rate_plan_name: { en: 'Other Partner Rate' },
            cancellation_policy_type: 'strict',
            room_inventory_units: 1,
            status: 'pending',
            currency: 'EUR',
          },
        ];

        stub.setRpcHandler(
          'partner_get_hotel_booking_operational_context',
          (params: any) => {
            const bookingIds = Array.isArray(params?.p_booking_ids) ? params.p_booking_ids : [];
            const hotelIds = Array.isArray(params?.p_hotel_ids) ? params.p_hotel_ids : [];
            const rows = operationalRows
              .filter((row) => row.__partner_id === params?.p_partner_id)
              .filter((row) => !bookingIds.length || bookingIds.includes(row.booking_id))
              .filter((row) => !hotelIds.length || hotelIds.includes(row.hotel_id))
              .map(({ __partner_id: _partnerId, ...row }) => row);
            return { data: rows, error: null };
          },
        );
        stub.setRpcHandler('hotel_v2_partner_list_assigned_properties', (params: any) => {
          if (params?.p_partner_id !== PARTNER_A_ID) {
            return { data: null, error: { code: '42501', message: 'partner_scope_denied' } };
          }
          const capabilities = {
            edit_property_content: false,
            edit_property_photos: false,
            edit_room_content: false,
            edit_room_photos: false,
            create_rooms: false,
            edit_room_structure: false,
            manage_prices: false,
            manage_availability: false,
            process_bookings: false,
            request_booking_changes: false,
            view_payment_status: true,
            initiate_stripe_onboarding: false,
          };
          return {
            data: {
              contract_version: 'hotels_v2_h3_2a_partner_permissions_v1',
              partner: { id: PARTNER_A_ID, role: 'owner' },
              foundation_only: true,
              workspace_available: false,
              properties: [{
                assignment_id: '80000000-0000-4000-8000-000000000001',
                hotel_id: HOTEL_A_ID,
                slug: 'synthetic-boutique-a',
                name_i18n: { pl: 'Syntetyczny hotel butikowy', en: 'Synthetic Boutique Hotel', he: 'מלון בוטיק לדוגמה' },
                city: 'Ayia Napa',
                cover_image_url: '/images/hotels/synthetic-a.webp',
                foundation_status: 'foundation_only',
                workspace_available: false,
                permission: { exists: true, version: 1, has_mutation_capability: false, capabilities },
              }],
            },
            error: null,
          };
        });

        stub.setSession({
          id: user.id,
          email: user.email,
          user_metadata: { name: 'Hotel Partner A' },
        });
        if (stub.state?.currentSession) {
          stub.state.currentSession.access_token = 'hotel-a-partner-token';
          stub.state.currentSession.refresh_token = 'hotel-a-partner-refresh-token';
        }
      },
    };
  };
}

test.describe('Hotels H1A Partner Portal security and manual fulfillment', () => {
  test('shows only exact-partner pending Hotel context via the non-PII RPC and keeps actions manual', async ({ page }) => {
    await page.addInitScript(seedHotelsH1aPartnerPortal());
    await enableSupabaseStub(page);
    await page.goto('/partners/', { waitUntil: 'domcontentloaded' });
    await waitForSupabaseStub(page);

    await expect(page.locator('#partnerPortalApp:not([hidden])')).toBeVisible();
    await expect(page.locator('#partnerPortalStatus')).toHaveText('Loaded 1 fulfillments.');
    await expect(page.locator('#fulfillmentsHint')).toContainText('1 fulfillment(s) awaiting acceptance');

    const row = page.locator(`#fulfillmentsTableBody tr[data-fulfillment-id="${FULFILLMENT_A_ID}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Synthetic Boutique Hotel');
    await expect(row).toContainText('420.00 EUR');
    await expect(row.locator('button[data-action="accept"]')).toBeVisible();
    await expect(row.locator('button[data-action="reject"]')).toBeVisible();
    await expect(page.locator('#fulfillmentsTableBody')).not.toContainText('Other Partner Hotel');
    await expect(page.locator('#fulfillmentsTableBody')).not.toContainText('999.00 EUR');

    await page.locator('#partnerNavHotels').click();
    const assignedHotels = page.locator('#partnerAssignedHotelsCard');
    await expect(assignedHotels).toBeVisible();
    await expect(assignedHotels).toContainText('Synthetic Boutique Hotel');
    await expect(assignedHotels).toContainText('Foundation only');
    await expect(assignedHotels).toContainText('Payment status');
    await expect(assignedHotels).not.toContainText('Other Partner Hotel');
    await expect(assignedHotels.locator('a, button')).toHaveCount(0);
    const assignedHotelAudit = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'hotel_v2_partner_list_assigned_properties'));
    expect(assignedHotelAudit).toEqual([
      expect.objectContaining({ params: { p_partner_id: PARTNER_A_ID } }),
    ]);

    await row.locator('button[data-partner-details-open]').click();
    const details = page.locator('#partnerDetailsModal.is-open');
    await expect(details).toBeVisible();
    await expect(page.locator('#partnerDetailsBody')).toContainText('Hotel request snapshot');
    await expect(page.locator('#partnerDetailsBody')).toContainText('2 adult(s) + 1 child(ren)');
    await expect(page.locator('#partnerDetailsBody')).toContainText('Sea View');
    await expect(page.locator('#partnerDetailsBody')).toContainText('Flexible');
    await expect(page.locator('#partnerDetailsBody')).toContainText('Configured units');
    await expect(page.locator('#partnerDetailsBody')).toContainText('2');
    await expect(page.locator('#partnerDetailsBody')).not.toContainText('RAW HOTEL PII MUST NOT RENDER');
    await expect(page.locator('#partnerDetailsBody')).not.toContainText('raw-hotel-pii-never-read@example.test');
    await expect(page.locator('#partnerDetailsBody')).not.toContainText('+35799009999');
    await expect(page.locator('#partnerDetailsBody')).not.toContainText('RAW PRIVATE HOTEL NOTE');
    await page.locator('[data-partner-details-close]').first().click();
    await expect(details).toBeHidden();

    const initialAudit = await page.evaluate(() => ({
      rawSelects: (window as any).__rawHotelBookingSelectCount,
      rpcCalls: (window as any).__supabaseStub.getRpcCalls()
        .filter((call: any) => call.name === 'partner_get_hotel_booking_operational_context'),
      mutations: (window as any).__supabaseStub.getMutationCalls(),
    }));

    expect(initialAudit.rawSelects).toBe(0);
    expect(initialAudit.mutations.filter((call: any) => call.table === 'hotel_bookings')).toHaveLength(0);
    expect(initialAudit.rpcCalls.length).toBeGreaterThanOrEqual(2);
    expect(initialAudit.rpcCalls.every((call: any) => call.params?.p_partner_id === PARTNER_A_ID)).toBe(true);
    expect(initialAudit.rpcCalls.some((call: any) => call.params?.p_booking_ids?.includes(BOOKING_A_ID))).toBe(true);
    expect(initialAudit.rpcCalls.some((call: any) => call.params?.p_hotel_ids?.includes(HOTEL_A_ID))).toBe(true);
    expect(initialAudit.rpcCalls.some((call: any) => call.params?.p_booking_ids?.includes(BOOKING_B_ID))).toBe(false);
    expect(JSON.stringify(initialAudit.rpcCalls)).not.toMatch(/customer_name|customer_email|customer_phone|private_note/i);

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
    await expect.poll(
      async () => page.evaluate(() => (window as any).__partnerFulfillmentActionCalls.length),
    ).toBe(1);

    const rejectDialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      rejectDialogs.push(dialog.type());
      await dialog.accept(dialog.type() === 'prompt' ? 'No rooms available' : undefined);
    });
    await row.locator('button[data-action="reject"]').click();
    await expect.poll(
      async () => page.evaluate(() => (window as any).__partnerFulfillmentActionCalls.length),
    ).toBe(2);

    const result = await page.evaluate(({ bookingId, fulfillmentId }) => ({
      calls: (window as any).__partnerFulfillmentActionCalls,
      booking: (window as any).__supabaseStub.getTableRows('hotel_bookings')
        .find((item: any) => item.id === bookingId),
      fulfillment: (window as any).__supabaseStub.getTableRows('partner_service_fulfillments')
        .find((item: any) => item.id === fulfillmentId),
      rawSelects: (window as any).__rawHotelBookingSelectCount,
    }), { bookingId: BOOKING_A_ID, fulfillmentId: FULFILLMENT_A_ID });

    expect(result.calls).toEqual([
      expect.objectContaining({
        name: 'partner-fulfillment-action',
        body: expect.objectContaining({ fulfillment_id: FULFILLMENT_A_ID, action: 'accept' }),
      }),
      expect.objectContaining({
        name: 'partner-fulfillment-action',
        body: expect.objectContaining({ fulfillment_id: FULFILLMENT_A_ID, action: 'reject' }),
      }),
    ]);
    expect(rejectDialogs).toEqual(['prompt', 'confirm']);
    expect(result.booking).toEqual(expect.objectContaining({ status: 'pending' }));
    expect(result.fulfillment).toEqual(expect.objectContaining({
      partner_id: PARTNER_A_ID,
      status: 'pending_acceptance',
      accepted_at: null,
      rejected_at: null,
    }));
    expect(result.rawSelects).toBe(0);
  });
});
