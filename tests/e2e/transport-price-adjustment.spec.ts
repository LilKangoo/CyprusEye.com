import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';

function seedScript() {
  return (seedConfig: { role?: 'admin' | 'partner'; adjustedTotal?: number | null; priceRevision?: number; paidAmount?: number } = {}) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        const alreadySeeded = stub.getTableRows('transport_bookings')
          .some((row: any) => row?.id === 'transport-price-booking-1');
        if (!alreadySeeded) {
          stub.clearPersistence?.();
          stub.reset?.();
        }

        const admin = stub.seedUser({
          email: 'lilkangoomedia@gmail.com',
          password: 'admin-password',
          profile: {
            id: '15f3d442-092d-4eb8-9627-db90da0283eb',
            email: 'lilkangoomedia@gmail.com',
            username: 'admin',
            name: 'Admin',
            is_admin: true,
          },
        });
        const partnerUser = stub.seedUser({
          email: 'transport.partner@example.com',
          password: 'partner-password',
          profile: {
            id: 'partner-user-transport-price',
            email: 'transport.partner@example.com',
            username: 'transportpartner',
            name: 'Transport Partner',
            referral_code: 'TPRICE',
          },
        });

        const hasAdjustedSeed = Object.prototype.hasOwnProperty.call(seedConfig || {}, 'adjustedTotal');
        const booking = {
          id: 'transport-price-booking-1',
          route_id: 'route-lca-lim',
          origin_location_id: 'loc-lca',
          destination_location_id: 'loc-lim',
          return_route_id: 'route-lim-lca',
          return_origin_location_id: 'loc-lim',
          return_destination_location_id: 'loc-lca',
          trip_type: 'round_trip',
          travel_date: '2026-09-10',
          travel_time: '10:15',
          return_travel_date: '2026-09-12',
          return_travel_time: '18:30',
          customer_name: 'Transport Price Guest',
          customer_email: 'transport.price@example.com',
          customer_phone: '+35799000000',
          status: 'confirmed',
          payment_status: 'partial',
          total_price: 100,
          return_total_price: 40,
          adjusted_total_price: hasAdjustedSeed ? seedConfig.adjustedTotal : null,
          price_revision: Number(seedConfig.priceRevision || 0),
          price_adjusted_at: null,
          currency: 'EUR',
          num_passengers: 2,
          num_bags: 2,
          num_oversize_bags: 0,
          created_at: '2026-07-13T08:00:00.000Z',
          updated_at: '2026-07-13T08:00:00.000Z',
        };

        const deposit = {
          id: 'deposit-price-1',
          fulfillment_id: 'fulfillment-price-1',
          resource_type: 'transport',
          booking_id: booking.id,
          status: 'paid',
          amount: Number(seedConfig.paidAmount || 30),
          currency: 'EUR',
          paid_at: '2026-07-13T09:00:00.000Z',
          fulfillment_reference: 'TP-100',
          fulfillment_summary: 'Larnaca Airport -> Limassol Marina',
          stripe_checkout_session_id: 'cs_test_static',
          stripe_payment_intent_id: 'pi_test_static',
          created_at: '2026-07-13T08:10:00.000Z',
        };

        const fulfillment = {
          id: 'fulfillment-price-1',
          partner_id: 'partner-transport-price',
          resource_type: 'transport',
          booking_id: booking.id,
          resource_id: 'route-lca-lim',
          status: 'confirmed',
          reference: 'TP-100',
          summary: 'Larnaca Airport -> Limassol Marina',
          start_date: '2026-09-10',
          end_date: '2026-09-12',
          total_price: 100,
          currency: 'EUR',
          details: {},
          created_at: '2026-07-13T08:05:00.000Z',
        };

        if (!alreadySeeded) {
          stub.seedTable('profiles', [
            { id: admin.id, email: admin.email, username: 'admin', name: 'Admin', is_admin: true },
            { id: partnerUser.id, email: partnerUser.email, username: 'transportpartner', name: 'Transport Partner', referral_code: 'TPRICE' },
          ]);
          stub.seedTable('admin_users_overview', [
            { id: admin.id, email: admin.email, username: 'admin', name: 'Admin', is_admin: true, created_at: '2026-07-01T00:00:00.000Z' },
          ]);
          stub.seedTable('admin_system_diagnostics', [{ metric: 'total_users', value: 1 }]);
          stub.seedTable('transport_locations', [
            { id: 'loc-lca', name: 'Larnaca Airport', name_local: 'Larnaca Airport', code: 'LCA', is_active: true },
            { id: 'loc-lim', name: 'Limassol Marina', name_local: 'Limassol Marina', code: 'LIM', is_active: true },
          ]);
          stub.seedTable('transport_routes', [
            { id: 'route-lca-lim', origin_location_id: 'loc-lca', destination_location_id: 'loc-lim', is_active: true, currency: 'EUR' },
            { id: 'route-lim-lca', origin_location_id: 'loc-lim', destination_location_id: 'loc-lca', is_active: true, currency: 'EUR' },
          ]);
          stub.seedTable('transport_pricing_rules', []);
          stub.seedTable('transport_bookings', [booking]);
          stub.seedTable('service_deposit_requests', [deposit]);
          stub.seedTable('partner_service_fulfillments', [fulfillment]);
          stub.seedTable('partners', [
            { id: 'partner-transport-price', name: 'Transport Partner', slug: 'transport-partner', status: 'active', can_manage_transport: true, affiliate_enabled: true },
          ]);
          stub.seedTable('partner_users', [
            { id: 'partner-user-link-price', partner_id: 'partner-transport-price', user_id: partnerUser.id, role: 'owner' },
          ]);
          stub.seedTable('affiliate_commission_events', [{ id: 'commission-price-1', deposit_request_id: deposit.id, amount: 3, payout_id: null }]);
          stub.seedTable('affiliate_payouts', [{ id: 'payout-price-1', status: 'draft', total_amount: 0 }]);
          stub.seedTable('shop_order_fulfillments', []);
          stub.seedTable('partner_resource_assignments', [
            { id: 'assignment-price-1', partner_id: 'partner-transport-price', resource_type: 'transport', resource_id: 'route-lca-lim', is_active: true },
          ]);
        }

        const summaryFor = (bookingId: string) => {
          const row = stub.getTableRows('transport_bookings').find((item: any) => item.id === bookingId) || booking;
          const paid = stub.getTableRows('service_deposit_requests')
            .filter((item: any) => item.booking_id === bookingId && item.status === 'paid' && item.paid_at)
            .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
          const effective = Number(row.adjusted_total_price ?? row.total_price ?? 0);
          return {
            booking_id: bookingId,
            original_total: Number(row.total_price || 0),
            adjusted_total: row.adjusted_total_price == null ? null : Number(row.adjusted_total_price),
            effective_total: effective,
            currency: row.currency || 'EUR',
            confirmed_paid_gross: paid,
            balance_due: Math.max(effective - paid, 0),
            overpayment: Math.max(paid - effective, 0),
            refund_review_required: paid > effective,
            price_revision: Number(row.price_revision || 0),
            price_adjusted_at: row.price_adjusted_at || null,
            derived_payment_state: Math.max(effective - paid, 0) > 0 ? 'balance_due' : 'paid_in_full',
          };
        };

        stub.setRpcHandler('get_transport_booking_financial_summary', async (params: any) => ({
          data: summaryFor(params.p_booking_id),
          error: null,
        }));
        stub.setRpcHandler('get_service_deposit_status', async (params: any) => {
          const dep = stub.getTableRows('service_deposit_requests').find((item: any) => item.id === params.p_id) || deposit;
          const summary = summaryFor(dep.booking_id);
          return {
            data: {
              ...dep,
              booking_total_price: summary.effective_total,
              fulfillment_total_price: summary.effective_total,
              remaining_amount: summary.balance_due,
              total_price: summary.effective_total,
            },
            error: null,
          };
        });
        stub.setRpcHandler('admin_adjust_transport_booking_price', async (params: any, helpers: any) => {
          const rows = helpers.getTableRows('transport_bookings');
          const index = rows.findIndex((row: any) => row.id === params.p_booking_id);
          if (index < 0) return { data: null, error: { message: 'booking_not_found' } };
          const current = rows[index];
          if (Number(params.p_expected_revision) !== Number(current.price_revision || 0)) {
            return { data: null, error: { message: 'price_revision_conflict', code: '409' } };
          }
          rows[index] = {
            ...current,
            adjusted_total_price: Number(params.p_new_total),
            price_revision: Number(current.price_revision || 0) + 1,
            price_adjusted_at: '2026-07-13T10:00:00.000Z',
          };
          helpers.setTableRows('transport_bookings', rows);
          return { data: summaryFor(params.p_booking_id), error: null };
        });

        if (!alreadySeeded || !stub.state?.currentSession) {
          const initialUser = seedConfig.role === 'partner' ? partnerUser : admin;
          stub.setSession({
            id: initialUser.id,
            email: initialUser.email,
            user_metadata: { name: seedConfig.role === 'partner' ? 'Transport Partner' : 'Admin' },
          });
          if (stub.state?.currentSession) {
            stub.state.currentSession.access_token = seedConfig.role === 'partner'
              ? 'transport-price-partner-token'
              : 'transport-price-admin-token';
            stub.state.currentSession.refresh_token = seedConfig.role === 'partner'
              ? 'transport-price-partner-refresh-token'
              : 'transport-price-admin-refresh-token';
          }
        }
      },
    };
  };
}

async function prepare(page: any, config: { role?: 'admin' | 'partner'; adjustedTotal?: number | null; priceRevision?: number; paidAmount?: number } = {}) {
  await page.addInitScript(seedScript(), config);
  await enableSupabaseStub(page);
}

function forbiddenAdjustmentPattern() {
  return /original price|adjusted price|current final price|previous price|price changed|price adjustment|adjustment history|refund review|required review|old price|new price|customer adjustment note/i;
}

async function openAdminTransportBooking(page: any) {
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await page.click('button.admin-nav-item[data-view="transport"]');
  await page.waitForSelector('#viewTransport.active:not([hidden])');
  await page.evaluate(() => {
    const button = document.querySelector('.transport-tab-button[data-tab="bookings"]');
    if (button instanceof HTMLElement) button.click();
  });
  await page.waitForSelector('#transportTabBookings:not([hidden])');
  await page.waitForSelector('#transportBookingsTableBody tr');
}

async function submitAdminPrice(page: any, amount: number, reason = 'manual total correction') {
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.fill('#transportPriceAdjustmentNewTotal', String(amount));
  await page.fill('#transportPriceAdjustmentReason', reason);
  await page.locator('#transportPriceAdjustmentForm button[type="submit"]').click();
  await expect(page.locator('#transportBookingDetailsContent')).toContainText(`€${amount.toFixed(2)}`);
}

test.describe('Transport Price 4.0C-E effective total propagation', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin and customer deposit link show one current price without adjustment disclosure', async ({ page }) => {
    await prepare(page);

    await openAdminTransportBooking(page);
    await expect(page.locator('#transportBookingsTableBody')).toContainText('€100.00');
    await page.locator('#transportBookingsTableBody tr:has-text("Transport Price Guest") button:has-text("View")').click();
    await expect(page.locator('#transportBookingDetailsModal')).toBeVisible();
    await expect(page.locator('#transportBookingDetailsContent')).toContainText('Total price');
    await submitAdminPrice(page, 120);

    const adminDetailsAfterIncrease = await page.locator('#transportBookingDetailsContent').innerText();
    expect(adminDetailsAfterIncrease).toContain('Total price');
    expect(adminDetailsAfterIncrease).toContain('€120.00');
    expect(adminDetailsAfterIncrease).toContain('€30.00');
    expect(adminDetailsAfterIncrease).toContain('€90.00');
    expect(adminDetailsAfterIncrease).not.toMatch(forbiddenAdjustmentPattern());
    expect(adminDetailsAfterIncrease).not.toContain('€140.00');

    let calls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    expect(calls.some((call: any) => call.name === 'admin_adjust_transport_booking_price')).toBe(true);
    expect(calls.some((call: any) => call.name === 'get_transport_booking_financial_summary')).toBe(true);

    await page.goto('/deposit.html?deposit_request_id=deposit-price-1&lang=pl&total=999&amount=999', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#valueTotal')).toContainText('120');
    await expect(page.locator('#valueAmount')).toContainText('30');
    await expect(page.locator('#valueRemaining')).toContainText('90');
    const depositText = await page.locator('body').innerText();
    expect(depositText).not.toContain('999');
    expect(depositText).not.toMatch(forbiddenAdjustmentPattern());
    calls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    expect(calls.some((call: any) => call.name === 'get_service_deposit_status')).toBe(true);

    await openAdminTransportBooking(page);
    await page.locator('#transportBookingsTableBody tr:has-text("Transport Price Guest") button:has-text("View")').click();
    await submitAdminPrice(page, 80, 'decrease final total');

    await page.goto('/deposit.html?deposit_request_id=deposit-price-1&lang=pl', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#valueTotal')).toContainText('80');
    await expect(page.locator('#valueAmount')).toContainText('30');
    await expect(page.locator('#valueRemaining')).toContainText('50');
    expect(await page.locator('body').innerText()).not.toMatch(forbiddenAdjustmentPattern());

    const beforePaidScenarioSideEffects = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        deposits: stub.getTableRows('service_deposit_requests'),
        fulfillments: stub.getTableRows('partner_service_fulfillments'),
      };
    });
    expect(beforePaidScenarioSideEffects.deposits).toHaveLength(1);
    expect(beforePaidScenarioSideEffects.deposits[0].amount).toBe(30);
    expect(beforePaidScenarioSideEffects.fulfillments[0].total_price).toBe(100);

    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const rows = stub.getTableRows('service_deposit_requests');
      stub.seedTable('service_deposit_requests', rows.map((row: any) => (
        row.id === 'deposit-price-1' ? { ...row, amount: 100, status: 'paid', paid_at: row.paid_at || '2026-07-13T09:00:00.000Z' } : row
      )));
    });

    await page.goto('/deposit.html?deposit_request_id=deposit-price-1&lang=pl', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#valueTotal')).toContainText('80');
    await expect(page.locator('#valueAmount')).toContainText('100');
    await expect(page.locator('#valueRemaining')).toContainText('0');
    expect(await page.locator('body').innerText()).not.toMatch(forbiddenAdjustmentPattern());

    const sideEffects = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        deposits: stub.getTableRows('service_deposit_requests'),
        commissions: stub.getTableRows('affiliate_commission_events'),
        payouts: stub.getTableRows('affiliate_payouts'),
        fulfillments: stub.getTableRows('partner_service_fulfillments'),
        calls: stub.getRpcCalls(),
      };
    });
    expect(sideEffects.deposits).toHaveLength(1);
    expect(sideEffects.deposits[0].stripe_checkout_session_id).toBe('cs_test_static');
    expect(sideEffects.commissions).toHaveLength(1);
    expect(sideEffects.payouts).toHaveLength(1);
    expect(sideEffects.fulfillments[0].total_price).toBe(100);
    expect(sideEffects.calls.some((call: any) => /email|stripe|refund/i.test(call.name))).toBe(false);
  });

  test('partner portal shows effective total, paid and remaining without adjustment disclosure', async ({ page }) => {
    await prepare(page, { role: 'partner', adjustedTotal: 120, priceRevision: 1, paidAmount: 30 });

    await page.goto('/partners/', { waitUntil: 'domcontentloaded' });
    await waitForSupabaseStub(page);
    await expect(page.locator('#partnerPortalApp:not([hidden])')).toBeVisible();
    await expect(page.locator('#partnerNavTransport')).toBeVisible();
    await page.click('#partnerNavTransport');
    await expect(page.locator('#fulfillmentsTableBody')).toContainText('120.00 EUR');
    await page.locator('#fulfillmentsTableBody tr:has-text("TP-100") button:has-text("Details")').click();
    await expect(page.locator('#partnerDetailsModal.is-open')).toBeVisible();
    await expect(page.locator('#partnerDetailsBody')).toContainText('Total price');
    await expect(page.locator('#partnerDetailsBody')).toContainText('120.00 EUR');
    await expect(page.locator('#partnerDetailsBody')).toContainText('Paid');
    await expect(page.locator('#partnerDetailsBody')).toContainText('30.00 EUR');
    await expect(page.locator('#partnerDetailsBody')).toContainText('Remaining');
    await expect(page.locator('#partnerDetailsBody')).toContainText('90.00 EUR');
    const partnerText = await page.locator('#partnerPortalApp').innerText();
    expect(partnerText).not.toMatch(forbiddenAdjustmentPattern());
    expect(partnerText).not.toContain('€100.00');
    expect(partnerText).not.toContain('€140.00');
  });
});
