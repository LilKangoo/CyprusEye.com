import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

function transportAdminSeedScript() {
  return () => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        const admin = stub.seedUser({
          email: 'transport.admin@example.com',
          password: 'admin-password',
          profile: {
            id: 'transport-admin-user',
            email: 'transport.admin@example.com',
            username: 'transportadmin',
            name: 'Transport Admin',
            is_admin: true,
          },
        });

        stub.seedTable('profiles', [{
          id: admin.id,
          email: admin.email,
          username: 'transportadmin',
          name: 'Transport Admin',
          is_admin: true,
        }]);
        stub.seedTable('admin_users_overview', [{
          id: admin.id,
          email: admin.email,
          username: 'transportadmin',
          name: 'Transport Admin',
          is_admin: true,
          created_at: '2026-07-01T00:00:00.000Z',
        }]);
        stub.seedTable('admin_system_diagnostics', [{ metric: 'total_users', value: 1 }]);
        stub.seedTable('transport_locations', [
          {
            id: 'loc-larnaca',
            name: 'Larnaca Airport',
            name_local: 'Larnaca Airport',
            code: 'lca_airport',
            city_group: 'larnaca',
            location_type: 'airport',
            sort_order: 1,
            is_active: true,
          },
          {
            id: 'loc-paphos',
            name: 'Paphos Hotel',
            name_local: 'Paphos Hotel',
            code: 'paphos_hotel',
            city_group: 'paphos',
            location_type: 'hotel',
            sort_order: 2,
            is_active: true,
          },
          {
            id: 'loc-limassol',
            name: 'Limassol Marina',
            name_local: 'Limassol Marina',
            code: 'limassol_marina',
            city_group: 'limassol',
            location_type: 'port',
            sort_order: 3,
            is_active: true,
          },
          {
            id: 'loc-inactive',
            name: 'Inactive Depot',
            name_local: 'Inactive Depot',
            code: 'inactive_depot',
            city_group: 'inactive',
            location_type: 'custom',
            sort_order: 4,
            is_active: false,
          },
        ]);
        stub.seedTable('transport_routes', [
          {
            id: 'route-lca-paphos',
            origin_location_id: 'loc-larnaca',
            destination_location_id: 'loc-paphos',
            day_price: 70,
            night_price: 90,
            currency: 'EUR',
            included_passengers: 2,
            included_bags: 2,
            included_large_bags: 0,
            max_passengers: 8,
            max_bags: 8,
            allows_round_trip: false,
            round_trip_multiplier: 2,
            sort_order: 1,
            is_active: true,
          },
          {
            id: 'route-paphos-lca',
            origin_location_id: 'loc-paphos',
            destination_location_id: 'loc-larnaca',
            day_price: 65,
            night_price: 85,
            currency: 'EUR',
            included_passengers: 2,
            included_bags: 2,
            included_large_bags: 0,
            max_passengers: 8,
            max_bags: 8,
            allows_round_trip: false,
            round_trip_multiplier: 2,
            sort_order: 2,
            is_active: false,
          },
          {
            id: 'route-lca-limassol',
            origin_location_id: 'loc-larnaca',
            destination_location_id: 'loc-limassol',
            day_price: 55,
            night_price: 75,
            currency: 'USD',
            included_passengers: 3,
            included_bags: 3,
            included_large_bags: 1,
            max_passengers: 6,
            max_bags: 7,
            allows_round_trip: false,
            round_trip_multiplier: 2,
            sort_order: 3,
            is_active: true,
          },
        ]);
        stub.seedTable('transport_pricing_rules', [{
          id: 'pricing-lca-paphos',
          route_id: 'route-lca-paphos',
          extra_passenger_fee: 5,
          extra_bag_fee: 3,
          oversize_bag_fee: 10,
          child_seat_fee: 4,
          booster_seat_fee: 4,
          waiting_included_minutes: 15,
          waiting_fee_per_hour: 20,
          waiting_fee_per_minute: 0.3333,
          night_start: '22:00',
          night_end: '06:00',
          deposit_enabled: false,
          deposit_mode: 'percent_total',
          deposit_value: 0,
          deposit_base_floor: 0,
          priority: 1,
          is_active: true,
        }]);
        stub.seedTable('transport_bookings', [{
          id: 'transport-booking-stage-1b',
          route_id: 'route-lca-paphos',
          origin_location_id: 'loc-larnaca',
          destination_location_id: 'loc-paphos',
          customer_name: 'Stage 1B Guest',
          customer_email: 'stage1b@example.com',
          customer_phone: '+35799000000',
          travel_date: '2026-09-10',
          travel_time: '10:00',
          num_passengers: 2,
          num_bags: 2,
          num_oversize_bags: 0,
          total_price: 70,
          currency: 'EUR',
          status: 'pending',
          payment_status: 'pending',
          created_at: '2026-07-27T08:00:00.000Z',
        }]);
        stub.seedTable('partners', []);
        stub.seedTable('partner_users', []);
        stub.seedTable('partner_resource_assignments', []);
        stub.seedTable('partner_service_fulfillments', []);
        stub.seedTable('service_deposit_rules', []);
        stub.seedTable('service_deposit_overrides', []);
        stub.seedTable('service_deposit_requests', []);
        stub.setSession({
          id: admin.id,
          email: admin.email,
          user_metadata: { name: 'Transport Admin' },
        });
      },
    };
  };
}

async function openTransportAdmin(page: any) {
  await page.addInitScript(transportAdminSeedScript());
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await page.locator('button.admin-nav-item[data-view="transport"]').evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('#viewTransport')).toBeVisible();
  await expect(page.locator('#transportAdminV2RoutesList')).toContainText('Larnaca Airport');
  await waitForTransportAdminBackgroundReads(page);
}

async function waitForTransportAdminBackgroundReads(page: any) {
  await expect.poll(() => page.evaluate(() => (
    (window as any).__supabaseStub.getRpcCalls()
      .some((call: any) => call.name === 'admin_list_partner_plus_applications')
  ))).toBe(true);
}

async function activateTab(page: any, tabId: string, panelId: string) {
  await page.locator(`#${tabId}`).click();
  await expect(page.locator(`#${panelId}`)).toBeVisible();
  await expect(page.locator(`#${tabId}`)).toHaveAttribute('aria-selected', 'true');
}

async function runRouteAction(page: any, routeId: string, action: string) {
  const record = page.locator(`[data-transport-route-record][data-route-id="${routeId}"]`);
  await record.locator('.transport-admin-v2-route-action-menu > summary').click();
  await record.locator(`[data-transport-route-action="${action}"]`).click();
}

async function openRouteWizard(page: any) {
  await page.locator('#btnTransportAdminV2AddRoute').click();
  await expect(page.locator('#transportRouteWizardModal')).toBeVisible();
  await expect(page.locator('[data-transport-route-wizard-step="1"]')).toBeVisible();
}

async function setWizardRoute(page: any, originId: string, destinationId: string) {
  await page.locator('#transportRouteWizardOrigin').selectOption(originId);
  await page.locator('#transportRouteWizardDestination').selectOption(destinationId);
}

async function advanceWizard(page: any) {
  await page.locator('#btnTransportRouteWizardNext').click();
}

async function prepareMinimalWizardSave(page: any, options: {
  origin?: string;
  destination?: string;
  dayPrice?: string;
  nightPrice?: string;
  pricing?: boolean;
  deposit?: boolean;
} = {}) {
  await openRouteWizard(page);
  await setWizardRoute(page, options.origin || 'loc-paphos', options.destination || 'loc-limassol');
  await advanceWizard(page);
  await advanceWizard(page);
  await page.locator('#transportRouteWizardDayPrice').fill(options.dayPrice || '84');
  await page.locator('#transportRouteWizardNightPrice').fill(options.nightPrice || '104');
  if (options.pricing) await page.locator('#transportRouteWizardPricingEnabled').check();
  if (options.deposit) {
    await page.locator('#transportRouteWizardDepositEnabled').check();
    await page.locator('#transportRouteWizardDepositMode').selectOption('fixed_amount');
    await page.locator('#transportRouteWizardDepositValue').fill('20');
  }
  await advanceWizard(page);
  await advanceWizard(page);
  await expect(page.locator('[data-transport-route-wizard-step="5"]')).toBeVisible();
}

test.describe('Transport Admin Stage 1B navigation', () => {
  test('mounts every existing section once and changes tabs without writes', async ({ page }) => {
    await openTransportAdmin(page);

    await expect(page.locator('#transportAdminV2PanelRoutes')).toBeVisible();
    await expect(page.locator('#transportAdminV2PanelLocations')).toBeHidden();
    await expect(page.locator('#btnTransportAdminV2AddRoute')).toBeEnabled();
    await expect(page.locator('#btnTransportAdminV2AddRoute')).toHaveAttribute('aria-haspopup', 'dialog');

    const before = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        locations: stub.getTableRows('transport_locations'),
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        bookings: stub.getTableRows('transport_bookings'),
        rpcCalls: stub.getRpcCalls(),
      };
    });

    await activateTab(page, 'transportAdminV2TabLocations', 'transportAdminV2PanelLocations');
    await expect(page.locator('#transportAdminV2PanelLocations #transportLocationForm')).toHaveCount(1);
    await activateTab(page, 'transportAdminV2TabAdvancedPricing', 'transportAdminV2PanelAdvancedPricing');
    await expect(page.locator('#transportAdminV2PanelAdvancedPricing #transportPricingForm')).toHaveCount(1);
    await expect(page.locator('#transportAdminV2PanelAdvancedPricing #transportPreviewMatrixTable')).toHaveCount(1);
    await activateTab(page, 'transportAdminV2TabQuoteTester', 'transportAdminV2PanelQuoteTester');
    await expect(page.locator('#transportAdminV2PanelQuoteTester #transportControlRouteSelect')).toHaveCount(1);
    await activateTab(page, 'transportAdminV2TabGlobalSettings', 'transportAdminV2PanelGlobalSettings');
    await expect(page.locator('#transportAdminV2PanelGlobalSettings #transportRouteGlobalCapacityPanel')).toHaveCount(1);
    await expect(page.locator('#transportAdminV2PanelGlobalSettings #transportPricingDepositGlobalControls')).toHaveCount(1);
    await activateTab(page, 'transportAdminV2TabBookings', 'transportAdminV2PanelBookings');
    await expect(page.locator('#transportBookingsTableBody')).toContainText('Stage 1B Guest');
    await expect(page.locator('#transportAdminV2PanelBookings #transportBookingDetailsModal')).toHaveCount(1);
    await activateTab(page, 'transportAdminV2TabLegacyTools', 'transportAdminV2PanelLegacyTools');
    await expect(page.locator('#transportAdminV2PanelLegacyTools #transportRouteForm')).toHaveCount(1);
    await expect(page.locator('#transportAdminV2PanelLegacyTools #transportRoutesList')).toHaveCount(1);
    await expect(page.locator('#transportAdminV2PanelLegacyTools #transportGuidedPanel')).toHaveCount(1);

    const after = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        locations: stub.getTableRows('transport_locations'),
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        bookings: stub.getTableRows('transport_bookings'),
        rpcCalls: stub.getRpcCalls(),
      };
    });
    expect(after).toEqual(before);
  });

  test('supports keyboard navigation, route filters, and refresh persistence', async ({ page }) => {
    await openTransportAdmin(page);

    await page.locator('#transportAdminV2TabRoutes').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#transportAdminV2PanelLocations')).toBeVisible();
    await page.keyboard.press('End');
    await expect(page.locator('#transportAdminV2PanelLegacyTools')).toBeVisible();
    await page.keyboard.press('Home');
    await expect(page.locator('#transportAdminV2PanelRoutes')).toBeVisible();

    await page.locator('#transportAdminV2RoutesStatus').selectOption('inactive');
    await expect(page.locator('#transportAdminV2RoutesList')).toContainText('Paphos Hotel');
    await expect(page.locator('#transportAdminV2RoutesList')).toContainText('Inactive');
    await page.locator('#transportAdminV2RoutesStatus').selectOption('all');
    await page.locator('#transportAdminV2RoutesSearch').fill('lca_airport');
    await expect(page.locator('#transportAdminV2RoutesList')).toContainText('Larnaca Airport');
    await page.locator('#transportAdminV2RoutesSearch').fill('missing route');
    await expect(page.locator('#transportAdminV2RoutesList')).toContainText('No routes match the current filters.');

    await activateTab(page, 'transportAdminV2TabGlobalSettings', 'transportAdminV2PanelGlobalSettings');
    await page.locator('#btnRefreshTransport').evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator('#transportAdminV2PanelGlobalSettings')).toBeVisible();
    await expect(page.locator('#transportAdminV2TabGlobalSettings')).toHaveAttribute('aria-selected', 'true');
  });

  test('keeps the tablist reachable and stacks route filters on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTransportAdmin(page);

    const layout = await page.locator('.transport-admin-v2-routes-toolbar').evaluate((toolbar) => {
      const fields = Array.from(toolbar.children).map((child) => child.getBoundingClientRect());
      return {
        x: fields.map((rect) => Math.round(rect.x)),
        y: fields.map((rect) => Math.round(rect.y)),
        width: fields.map((rect) => Math.round(rect.width)),
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(new Set(layout.x).size).toBe(1);
    expect(layout.y).toEqual([...layout.y].sort((a, b) => a - b));
    expect(layout.width.every((width) => width > 250)).toBe(true);
    expect(layout.documentOverflow).toBeLessThanOrEqual(1);

    await page.locator('#transportAdminV2Tablist').evaluate((tablist) => {
      tablist.scrollLeft = tablist.scrollWidth;
    });
    await page.locator('#transportAdminV2TabLegacyTools').click();
    await expect(page.locator('#transportAdminV2PanelLegacyTools')).toBeVisible();
  });

  test('keeps Location, Legacy route, pricing, simulator, global, and booking handlers working', async ({ page }) => {
    await openTransportAdmin(page);

    await activateTab(page, 'transportAdminV2TabLocations', 'transportAdminV2PanelLocations');
    await page.locator('#transportLocationName').fill('Ayia Napa Hotel');
    await page.locator('#transportLocationNameLocal').fill('Ayia Napa Hotel');
    await page.locator('#transportLocationCode').fill('ayia_napa_hotel');
    await page.locator('#transportLocationCityGroup').fill('ayia_napa');
    await page.locator('#transportLocationType').selectOption('hotel');
    await page.locator('#transportLocationForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub.getTableRows('transport_locations')
        .some((row: any) => row.code === 'ayia_napa_hotel')
    ))).toBe(true);

    await activateTab(page, 'transportAdminV2TabRoutes', 'transportAdminV2PanelRoutes');
    await runRouteAction(page, 'route-lca-paphos', 'edit');
    await expect(page.locator('#transportAdminV2PanelLegacyTools')).toBeVisible();
    await page.locator('#transportRouteDayPrice').fill('76');
    await page.locator('#transportRouteNightPrice').fill('96');
    await page.locator('#transportRouteCreateReversePair').uncheck();
    await page.locator('#transportRouteSyncReverseRoute').uncheck();
    await page.locator('#transportRouteForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub.getTableRows('transport_routes')
        .find((row: any) => row.id === 'route-lca-paphos')?.day_price
    ))).toBe(76);

    const routeCount = await page.evaluate(() => (
      (window as any).__supabaseStub.getTableRows('transport_routes').length
    ));
    await page.locator('#btnResetTransportRoute').click();
    await expect(page.locator('#btnSaveTransportRoute')).toBeDisabled();
    await page.locator('#transportRouteForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub.getTableRows('transport_routes').length
    ))).toBe(routeCount);

    await activateTab(page, 'transportAdminV2TabAdvancedPricing', 'transportAdminV2PanelAdvancedPricing');
    await page.locator('#transportPricingTableBody button:has-text("Edit")').first().click();
    await page.locator('#transportPricingExtraPassenger').fill('7');
    await page.locator('#transportPricingAutoReverseRoute').uncheck();
    await page.locator('#transportPricingForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub.getTableRows('transport_pricing_rules')
        .find((row: any) => row.id === 'pricing-lca-paphos')?.extra_passenger_fee
    ))).toBe(7);

    await activateTab(page, 'transportAdminV2TabQuoteTester', 'transportAdminV2PanelQuoteTester');
    await page.locator('[data-transport-collapse-target="transportCollapseSelectorBody"]').click();
    await page.locator('#transportControlRouteSelect').selectOption('route-lca-paphos');
    await page.locator('[data-transport-collapse-target="transportCollapseSimulatorBody"]').click();
    await expect(page.locator('#transportPreviewTotal')).not.toHaveText('—');

    await activateTab(page, 'transportAdminV2TabGlobalSettings', 'transportAdminV2PanelGlobalSettings');
    let globalConfirmSeen = false;
    page.once('dialog', async (dialog) => {
      globalConfirmSeen = true;
      await dialog.dismiss();
    });
    await page.locator('#btnTransportRouteGlobalApply').click();
    await expect.poll(() => globalConfirmSeen).toBe(true);

    await activateTab(page, 'transportAdminV2TabBookings', 'transportAdminV2PanelBookings');
    await expect(page.locator('#transportBookingsTableBody')).toContainText('Stage 1B Guest');
  });
});

test.describe('Transport Admin Stage 1C Routes workspace', () => {
  test('renders operational route records with pricing and reverse indicators', async ({ page }) => {
    await openTransportAdmin(page);

    await expect(page.locator('[data-transport-route-record]')).toHaveCount(3);
    const outbound = page.locator('[data-transport-route-record][data-route-id="route-lca-paphos"]');
    await expect(outbound).toContainText('Larnaca Airport');
    await expect(outbound).toContainText('Paphos Hotel');
    await expect(outbound).toContainText('70.00');
    await expect(outbound).toContainText('90.00');
    await expect(outbound).toContainText('EUR');
    await expect(outbound).toContainText('2 included / 8 max');
    await expect(outbound).toContainText('2 small + 0 large / 8 max');
    await expect(outbound).toContainText('Pricing rules');
    await expect(outbound).toContainText('Reverse exists');
    await expect(outbound).toContainText('Paphos Hotel → Larnaca Airport');
    await expect(outbound).toContainText('Active');
    await expect(outbound).toContainText('Sort 1');

    const noReverse = page.locator('[data-transport-route-record][data-route-id="route-lca-limassol"]');
    await expect(noReverse).toContainText('No reverse route');
    await expect(noReverse).toContainText('3 included / 6 max');
    await expect(noReverse).toContainText('3 small + 1 large / 7 max');

    const desktopLayout = await page.locator('#transportAdminV2PanelRoutes').evaluate((panel) => {
      const panelRect = panel.getBoundingClientRect();
      const toolbarActions = panel.querySelector('.transport-admin-v2-routes-toolbar__actions')?.getBoundingClientRect();
      const menus = Array.from(panel.querySelectorAll('.transport-admin-v2-route-action-menu'))
        .map((menu) => menu.getBoundingClientRect());
      return {
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
        toolbarFits: Boolean(toolbarActions && toolbarActions.right <= panelRect.right + 1),
        menusFit: menus.every((rect) => rect.right <= panelRect.right + 1),
      };
    });
    expect(desktopLayout.documentOverflow).toBeLessThanOrEqual(1);
    expect(desktopLayout.toolbarFits).toBe(true);
    expect(desktopLayout.menusFit).toBe(true);
  });

  test('filters state locally by all route facets and clears them without writes', async ({ page }) => {
    await openTransportAdmin(page);

    const before = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        bookings: stub.getTableRows('transport_bookings'),
        rpcCalls: stub.getRpcCalls(),
      };
    });

    await page.locator('#transportAdminV2RoutesOrigin').selectOption('loc-paphos');
    await expect(page.locator('[data-transport-route-record]')).toHaveCount(1);
    await expect(page.locator('[data-transport-route-record]')).toHaveAttribute('data-route-id', 'route-paphos-lca');
    await page.locator('#btnTransportAdminV2ClearFilters').click();

    await page.locator('#transportAdminV2RoutesDestination').selectOption('loc-paphos');
    await expect(page.locator('[data-transport-route-record]')).toHaveCount(1);
    await expect(page.locator('[data-transport-route-record]')).toHaveAttribute('data-route-id', 'route-lca-paphos');
    await page.locator('#btnTransportAdminV2ClearFilters').click();

    await page.locator('#transportAdminV2RoutesCurrency').selectOption('USD');
    await expect(page.locator('[data-transport-route-record]')).toHaveCount(1);
    await expect(page.locator('[data-transport-route-record]')).toHaveAttribute('data-route-id', 'route-lca-limassol');
    await page.locator('#btnTransportAdminV2ClearFilters').click();

    await page.locator('#transportAdminV2RoutesCityGroup').selectOption('limassol');
    await expect(page.locator('[data-transport-route-record]')).toHaveCount(1);
    await expect(page.locator('[data-transport-route-record]')).toHaveAttribute('data-route-id', 'route-lca-limassol');
    await page.locator('#btnTransportAdminV2ClearFilters').click();

    await page.locator('#transportAdminV2RoutesStatus').selectOption('inactive');
    await expect(page.locator('[data-transport-route-record]')).toHaveCount(1);
    await expect(page.locator('[data-transport-route-record]')).toHaveAttribute('data-route-id', 'route-paphos-lca');
    await page.locator('#btnTransportAdminV2ClearFilters').click();

    await page.locator('#transportAdminV2RoutesSearch').fill('limassol_marina');
    await expect(page.locator('[data-transport-route-record]')).toHaveCount(1);
    await expect(page.locator('[data-transport-route-record]')).toHaveAttribute('data-route-id', 'route-lca-limassol');
    await page.locator('#btnTransportAdminV2ClearFilters').click();
    await expect(page.locator('[data-transport-route-record]')).toHaveCount(3);

    const after = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        bookings: stub.getTableRows('transport_bookings'),
        rpcCalls: stub.getRpcCalls(),
      };
    });
    expect(after).toEqual(before);
  });

  test('keeps Duplicate and Create reverse as no-write placeholders', async ({ page }) => {
    await openTransportAdmin(page);

    const before = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        rpcCalls: stub.getRpcCalls(),
      };
    });

    const duplicate = page.locator(
      '[data-route-id="route-lca-paphos"] [data-transport-route-action="duplicate"]',
    );
    await expect(duplicate).toHaveAttribute('aria-disabled', 'true');
    await duplicate.evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator('#transportAdminV2AddRouteStatus')).toHaveText('Available in Route Wizard');
    await page.locator(
      '[data-route-id="route-lca-paphos"] [data-transport-route-action="create-reverse"]',
    ).evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator('#transportAdminV2AddRouteStatus')).toHaveText('Available in Route Wizard');

    const after = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        rpcCalls: stub.getRpcCalls(),
      };
    });
    expect(after).toEqual(before);
  });

  test('opens Legacy edit and local Pricing, Quote tester, and Bookings shortcuts', async ({ page }) => {
    await openTransportAdmin(page);

    const before = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        bookings: stub.getTableRows('transport_bookings'),
        rpcCalls: stub.getRpcCalls(),
      };
    });

    await runRouteAction(page, 'route-lca-paphos', 'edit');
    await expect(page.locator('#transportAdminV2PanelLegacyTools')).toBeVisible();
    await expect(page.locator('#transportRouteId')).toHaveValue('route-lca-paphos');

    await activateTab(page, 'transportAdminV2TabRoutes', 'transportAdminV2PanelRoutes');
    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(page.locator('#transportAdminV2PanelAdvancedPricing')).toBeVisible();
    await expect(page.locator('#transportPricingRoute')).toHaveValue('route-lca-paphos');
    await expect(page.locator('#transportPricingId')).toHaveValue('pricing-lca-paphos');

    await activateTab(page, 'transportAdminV2TabRoutes', 'transportAdminV2PanelRoutes');
    await runRouteAction(page, 'route-lca-paphos', 'quote');
    await expect(page.locator('#transportAdminV2PanelQuoteTester')).toBeVisible();
    await expect(page.locator('#transportControlRouteSelect')).toHaveValue('route-lca-paphos');

    await activateTab(page, 'transportAdminV2TabRoutes', 'transportAdminV2PanelRoutes');
    await runRouteAction(page, 'route-lca-paphos', 'bookings');
    await expect(page.locator('#transportAdminV2PanelBookings')).toBeVisible();
    await expect(page.locator('#transportBookingsSearch')).toHaveValue(/Larnaca Airport.*Paphos Hotel/);
    await expect(page.locator('#transportBookingsTableBody')).toContainText('Stage 1B Guest');

    const after = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        bookings: stub.getTableRows('transport_bookings'),
        rpcCalls: stub.getRpcCalls(),
      };
    });
    expect(after).toEqual(before);
  });

  test('reuses the existing delete flow and updates reverse status', async ({ page }) => {
    await openTransportAdmin(page);

    page.once('dialog', (dialog) => dialog.accept());
    await runRouteAction(page, 'route-paphos-lca', 'delete');
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub.getTableRows('transport_routes')
        .some((route: any) => route.id === 'route-paphos-lca')
    ))).toBe(false);
    await expect(page.locator('[data-route-id="route-paphos-lca"]')).toHaveCount(0);
    await expect(page.locator(
      '[data-transport-route-record][data-route-id="route-lca-paphos"]',
    )).toContainText('No reverse route');
  });

  test('stacks route records on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTransportAdmin(page);

    const layout = await page.locator(
      '[data-transport-route-record][data-route-id="route-lca-paphos"]',
    ).evaluate((record) => {
      const style = getComputedStyle(record);
      const children = Array.from(record.children).map((child) => child.getBoundingClientRect());
      const recordRect = record.getBoundingClientRect();
      return {
        columns: style.gridTemplateColumns.trim().split(/\s+/).length,
        childrenFit: children.every((rect) => rect.right <= recordRect.right + 1),
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(layout.columns).toBe(1);
    expect(layout.childrenFit).toBe(true);
    expect(layout.documentOverflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Transport Admin Stage 1E Route Wizard', () => {
  test('opens with active locations and performs no writes before Save', async ({ page }) => {
    await openTransportAdmin(page);
    const before = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        deposits: stub.getTableRows('service_deposit_overrides'),
        rpcCalls: stub.getRpcCalls(),
      };
    });

    await openRouteWizard(page);
    await expect(page.locator('#transportRouteWizardTitle')).toHaveText('New transport route');
    await expect(page.locator('[data-transport-route-wizard-progress="1"]')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('#transportRouteWizardOrigin option[value="loc-inactive"]')).toHaveCount(0);
    await expect(page.locator('#transportRouteWizardDestination option[value="loc-inactive"]')).toHaveCount(0);
    await page.locator('#btnTransportRouteWizardCancel').click();
    await expect(page.locator('#transportRouteWizardModal')).toBeHidden();

    const after = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        deposits: stub.getTableRows('service_deposit_overrides'),
        rpcCalls: stub.getRpcCalls(),
      };
    });
    expect(after).toEqual(before);
  });

  test('validates endpoints and opens an existing outbound in Legacy tools', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);

    await advanceWizard(page);
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Origin and destination are required');
    await expect(page.locator('[data-transport-route-wizard-step="1"]')).toBeVisible();

    await page.locator('#transportRouteWizardOrigin').selectOption('loc-larnaca');
    await advanceWizard(page);
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Origin and destination are required');

    await page.locator('#transportRouteWizardDestination').selectOption('loc-larnaca');
    await advanceWizard(page);
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Origin and destination cannot be the same');

    await page.locator('#transportRouteWizardDestination').selectOption('loc-paphos');
    await expect(page.locator('#transportRouteWizardExistingOutbound')).toBeVisible();
    await expect(page.locator('#transportRouteWizardExistingOutbound')).toContainText('Larnaca Airport');
    await expect(page.locator('#btnTransportRouteWizardNext')).toBeDisabled();
    await page.locator('#btnTransportRouteWizardOpenExisting').click();
    await expect(page.locator('#transportRouteWizardModal')).toBeHidden();
    await expect(page.locator('#transportAdminV2PanelLegacyTools')).toBeVisible();
    await expect(page.locator('#transportRouteId')).toHaveValue('route-lca-paphos');
  });

  test('persists draft values through Next and Back', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    await setWizardRoute(page, 'loc-paphos', 'loc-limassol');
    await page.locator('#transportRouteWizardActive').uncheck();
    await page.locator('#transportRouteWizardSortOrder').fill('9');
    await advanceWizard(page);

    await expect(page.locator('[data-transport-route-wizard-step="2"]')).toBeVisible();
    await page.locator('#transportRouteWizardDirectionBidirectional').check();
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDayPrice').fill('82');
    await page.locator('#transportRouteWizardNightPrice').fill('104');
    await advanceWizard(page);
    await expect(page.locator('[data-transport-route-wizard-step="4"]')).toBeVisible();

    await page.locator('#btnTransportRouteWizardBack').click();
    await expect(page.locator('#transportRouteWizardDayPrice')).toHaveValue('82');
    await expect(page.locator('#transportRouteWizardNightPrice')).toHaveValue('104');
    await page.locator('#btnTransportRouteWizardBack').click();
    await expect(page.locator('#transportRouteWizardDirectionBidirectional')).toBeChecked();
    await page.locator('#btnTransportRouteWizardBack').click();
    await expect(page.locator('#transportRouteWizardOrigin')).toHaveValue('loc-paphos');
    await expect(page.locator('#transportRouteWizardDestination')).toHaveValue('loc-limassol');
    await expect(page.locator('#transportRouteWizardActive')).not.toBeChecked();
    await expect(page.locator('#transportRouteWizardSortOrder')).toHaveValue('9');
  });

  test('asks before discarding only a dirty draft', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    await page.locator('#btnTransportRouteWizardCancel').click();
    await expect(page.locator('#transportRouteWizardModal')).toBeHidden();

    await openRouteWizard(page);
    await page.locator('#transportRouteWizardSortOrder').fill('4');
    await page.locator('#transportRouteWizardSortOrder').fill('0');
    await page.locator('#btnTransportRouteWizardCancel').click();
    await expect(page.locator('#transportRouteWizardModal')).toBeHidden();

    await openRouteWizard(page);
    await page.locator('#transportRouteWizardOrigin').selectOption('loc-paphos');
    await page.locator('#btnTransportRouteWizardCancel').click();
    await expect(page.locator('#transportRouteWizardDiscardDialog')).toBeVisible();
    await page.locator('#btnTransportRouteWizardStay').click();
    await expect(page.locator('#transportRouteWizardDiscardDialog')).toBeHidden();
    await expect(page.locator('#transportRouteWizardOrigin')).toHaveValue('loc-paphos');
    await page.locator('#btnTransportRouteWizardClose').click();
    await expect(page.locator('#transportRouteWizardDiscardDialog')).toBeVisible();
    await page.locator('#btnTransportRouteWizardLeave').click();
    await expect(page.locator('#transportRouteWizardModal')).toBeHidden();
  });

  test('shows existing reverse choices and validates Advanced Legacy Settings', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    await setWizardRoute(page, 'loc-limassol', 'loc-larnaca');
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDirectionBidirectional').check();

    await expect(page.locator('#transportRouteWizardExistingReverseOptions')).toBeVisible();
    await expect(page.locator('#transportRouteWizardExistingReverseLabel')).toContainText('Larnaca Airport');
    await expect(page.locator('#transportRouteWizardExistingReverseReuse')).toBeChecked();
    await page.locator('#transportRouteWizardExistingReverseUpdate').check({ force: true });
    await page.locator('#transportRouteWizardReverseSettingsSeparate').check();
    await page.locator('#transportRouteWizardLegacySettings > summary').click();
    await page.locator('#transportRouteWizardAllowsRoundTrip').check();
    await page.locator('#transportRouteWizardRoundTripMultiplier').fill('6');
    await advanceWizard(page);
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('between 1 and 5');
    await expect(page.locator('[data-transport-route-wizard-step="2"]')).toBeVisible();
    await page.locator('#transportRouteWizardRoundTripMultiplier').fill('1.8');
    await advanceWizard(page);
    await expect(page.locator('[data-transport-route-wizard-step="3"]')).toBeVisible();
    await expect(page.locator('#transportRouteWizardReversePrices')).toBeVisible();
  });

  test('validates pricing and capacity, then renders the complete save plan', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    await setWizardRoute(page, 'loc-paphos', 'loc-limassol');
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDirectionBidirectional').check();
    await page.locator('#transportRouteWizardReverseSettingsSeparate').check();
    await advanceWizard(page);

    await advanceWizard(page);
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('greater than 0');
    await page.locator('#transportRouteWizardDayPrice').fill('80');
    await page.locator('#transportRouteWizardNightPrice').fill('100');
    await page.locator('#transportRouteWizardReverseDayPrice').fill('75');
    await page.locator('#transportRouteWizardReverseNightPrice').fill('95');
    await page.locator('#transportRouteWizardPricingEnabled').check();
    await page.locator('#transportRouteWizardDepositEnabled').check();
    await page.locator('#transportRouteWizardValidFrom').fill('2026-12-31');
    await page.locator('#transportRouteWizardValidTo').fill('2026-01-01');
    await advanceWizard(page);
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Deposit value must be greater than 0');
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Valid to date');
    await page.locator('#transportRouteWizardDepositValue').fill('20');
    await page.locator('#transportRouteWizardValidTo').fill('2027-01-01');
    await advanceWizard(page);

    await page.locator('#transportRouteWizardMaxPassengers').fill('1');
    await page.locator('#transportRouteWizardMaxBags').fill('1');
    await page.locator('#transportRouteWizardPricingAdvanced > summary').click();
    await page.locator('#transportRouteWizardExtraPassenger').fill('-1');
    await advanceWizard(page);
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Max passengers');
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Max total luggage');
    await expect(page.locator('#transportRouteWizardErrors')).toContainText('Extra passenger fee');
    await page.locator('#transportRouteWizardMaxPassengers').fill('8');
    await page.locator('#transportRouteWizardMaxBags').fill('8');
    await page.locator('#transportRouteWizardExtraPassenger').fill('5');
    await advanceWizard(page);

    await expect(page.locator('[data-transport-route-wizard-step="5"]')).toBeVisible();
    await expect(page.locator('#transportRouteWizardReview')).toContainText('2 route rows');
    await expect(page.locator('#transportRouteWizardReview')).toContainText('2 pricing rows');
    await expect(page.locator('#transportRouteWizardReview')).toContainText('2 deposit overrides');
    await expect(page.locator('[data-transport-route-wizard-plan-step="route_outbound"]')).toContainText('Paphos Hotel');
    await expect(page.locator('[data-transport-route-wizard-plan-step="route_reverse"]')).toContainText('Limassol Marina');
    await expect(page.locator('[data-transport-route-wizard-plan-step="route_outbound"]')).toContainText('Day 80 EUR');
    await expect(page.locator('[data-transport-route-wizard-plan-step="route_reverse"]')).toContainText('Day 75 EUR');
    await expect(page.locator('#transportRouteWizardReview')).toContainText('No global settings will change');
  });

  test('Save executes the production plan and keeps a receipt with created IDs', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    await setWizardRoute(page, 'loc-paphos', 'loc-limassol');
    await advanceWizard(page);
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDayPrice').fill('88');
    await page.locator('#transportRouteWizardNightPrice').fill('108');
    await page.locator('#transportRouteWizardPricingEnabled').check();
    await page.locator('#transportRouteWizardDepositEnabled').check();
    await page.locator('#transportRouteWizardDepositMode').selectOption('fixed_amount');
    await page.locator('#transportRouteWizardDepositValue').fill('25');
    await advanceWizard(page);
    await page.locator('#transportRouteWizardPricingAdvanced > summary').click();
    await page.locator('#transportRouteWizardExtraPassenger').fill('6');
    await page.locator('#transportRouteWizardWaitingIncluded').fill('10');
    await page.locator('#transportRouteWizardWaitingPerHour').fill('18');
    await advanceWizard(page);

    const beforeSave = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        deposits: stub.getTableRows('service_deposit_overrides'),
        rpcCalls: stub.getRpcCalls(),
      };
    });
    expect(beforeSave.routes).toHaveLength(3);
    expect(beforeSave.pricing).toHaveLength(1);
    expect(beforeSave.deposits).toHaveLength(0);

    await page.locator('#btnTransportRouteWizardSave').click();
    await expect(page.locator('#transportRouteWizardReceipt')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#transportRouteWizardModal')).toBeVisible();
    await expect(page.locator('#transportRouteWizardReceiptSummary')).toContainText('Created routes');
    await expect(page.locator('#transportRouteWizardReceiptSummary')).toContainText('Pricing IDs');
    await expect(page.locator('#transportRouteWizardReceiptSummary')).toContainText('Deposit IDs');
    await expect(page.locator('[data-transport-route-wizard-status="success"]')).toHaveCount(3);
    const saved = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const routes = stub.getTableRows('transport_routes');
      const route = routes.find((row: any) => (
        row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol'
      ));
      return {
        route,
        pricing: stub.getTableRows('transport_pricing_rules').find((row: any) => row.route_id === route?.id),
        deposit: stub.getTableRows('service_deposit_overrides').find((row: any) => row.resource_id === route?.id),
      };
    });
    expect(saved.route).toMatchObject({ day_price: 88, night_price: 108, currency: 'EUR' });
    expect(saved.pricing).toMatchObject({
      extra_passenger_fee: 6,
      waiting_included_minutes: 10,
      waiting_fee_per_hour: 18,
      deposit_enabled: true,
      deposit_mode: 'fixed_amount',
      deposit_value: 25,
    });
    expect(saved.deposit).toMatchObject({ mode: 'flat', amount: 25, enabled: true });
    await page.locator('#btnTransportRouteWizardOpenCreated').click();
    await expect(page.locator('#transportRouteWizardModal')).toBeHidden();
    await expect(page.locator('#transportAdminV2PanelLegacyTools')).toBeVisible();
    await expect(page.locator('#transportRouteId')).toHaveValue(saved.route.id);
  });

  test('Save creates outbound and reverse with separate prices through the save plan', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    await setWizardRoute(page, 'loc-paphos', 'loc-limassol');
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDirectionBidirectional').check();
    await page.locator('#transportRouteWizardReverseSettingsSeparate').check();
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDayPrice').fill('81');
    await page.locator('#transportRouteWizardNightPrice').fill('101');
    await page.locator('#transportRouteWizardReverseDayPrice').fill('76');
    await page.locator('#transportRouteWizardReverseNightPrice').fill('96');
    await advanceWizard(page);
    await advanceWizard(page);

    await page.locator('#btnTransportRouteWizardSave').click();
    await expect(page.locator('#transportRouteWizardReceipt')).toBeVisible({ timeout: 15000 });
    const saved = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const routes = stub.getTableRows('transport_routes');
      return {
        outbound: routes.find((row: any) => (
          row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol'
        )),
        reverse: routes.find((row: any) => (
          row.origin_location_id === 'loc-limassol' && row.destination_location_id === 'loc-paphos'
        )),
        pricingCount: stub.getTableRows('transport_pricing_rules').length,
      };
    });
    expect(saved.outbound).toMatchObject({ day_price: 81, night_price: 101, currency: 'EUR' });
    expect(saved.reverse).toMatchObject({ day_price: 76, night_price: 96, currency: 'EUR' });
    expect(saved.pricingCount).toBe(1);
  });

  test('Save creates a shared-settings reverse and reports both route IDs', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    await setWizardRoute(page, 'loc-paphos', 'loc-limassol');
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDirectionBidirectional').check();
    await advanceWizard(page);
    await page.locator('#transportRouteWizardDayPrice').fill('79');
    await page.locator('#transportRouteWizardNightPrice').fill('99');
    await advanceWizard(page);
    await page.locator('#transportRouteWizardIncludedPassengers').fill('3');
    await page.locator('#transportRouteWizardIncludedBags').fill('3');
    await advanceWizard(page);

    await page.locator('#btnTransportRouteWizardSave').click();
    await expect(page.locator('#transportRouteWizardReceipt')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#transportRouteWizardReceiptSummary')).toContainText('Created routes');
    const saved = await page.evaluate(() => {
      const routes = (window as any).__supabaseStub.getTableRows('transport_routes');
      return routes.filter((row: any) => (
        (row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol')
          || (row.origin_location_id === 'loc-limassol' && row.destination_location_id === 'loc-paphos')
      ));
    });
    expect(saved).toHaveLength(2);
    saved.forEach((route: any) => {
      expect(route).toMatchObject({
        day_price: 79,
        night_price: 99,
        currency: 'EUR',
        included_passengers: 3,
        included_bags: 3,
      });
    });
  });

  test('keeps partial success open and retries only failed and dependency-skipped steps', async ({ page }) => {
    await openTransportAdmin(page);
    await prepareMinimalWizardSave(page, { pricing: true, deposit: true });
    await page.evaluate(() => {
      (window as any).__supabaseStub.failNextMutation({
        table: 'transport_pricing_rules',
        action: 'insert',
        error: { code: 'PGRST500', message: 'pricing write unavailable' },
      });
    });

    await page.locator('#btnTransportRouteWizardSave').click();
    await expect(page.locator('#btnTransportRouteWizardRetry')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#btnTransportRouteWizardCancel')).toBeEnabled();
    await expect(page.locator('[data-transport-route-wizard-plan-step="route_outbound"]')).toHaveAttribute('data-step-status', 'success');
    await expect(page.locator('[data-transport-route-wizard-plan-step="pricing_outbound"]')).toHaveAttribute('data-step-status', 'error');
    await expect(page.locator('[data-transport-route-wizard-plan-step="deposit_outbound"]')).toHaveAttribute('data-step-status', 'skipped');
    await expect(page.locator('#transportRouteWizardSaveStatus')).toContainText('1 succeeded, 1 failed, 1 skipped');
    await expect(page.locator('#btnTransportRouteWizardCreateAnother')).toBeHidden();

    const afterFailure = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const routes = stub.getTableRows('transport_routes').filter((row: any) => (
        row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol'
      ));
      return {
        routes: routes.length,
        pricing: stub.getTableRows('transport_pricing_rules').filter((row: any) => row.route_id === routes[0]?.id).length,
        deposits: stub.getTableRows('service_deposit_overrides').filter((row: any) => row.resource_id === routes[0]?.id).length,
      };
    });
    expect(afterFailure).toEqual({ routes: 1, pricing: 0, deposits: 0 });

    await page.locator('#btnTransportRouteWizardRetry').click();
    await expect(page.locator('#transportRouteWizardReceipt')).toBeVisible({ timeout: 15000 });
    const afterRetry = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const routes = stub.getTableRows('transport_routes').filter((row: any) => (
        row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol'
      ));
      const state = (window as any).TransportRouteWizard.getState();
      return {
        routes: routes.length,
        pricing: stub.getTableRows('transport_pricing_rules').filter((row: any) => row.route_id === routes[0]?.id).length,
        deposits: stub.getTableRows('service_deposit_overrides').filter((row: any) => row.resource_id === routes[0]?.id).length,
        attempts: Object.fromEntries(state.plan.steps.map((step: any) => [step.key, step.attempts])),
      };
    });
    expect(afterRetry).toEqual({
      routes: 1,
      pricing: 1,
      deposits: 1,
      attempts: { route_outbound: 1, pricing_outbound: 2, deposit_outbound: 1 },
    });
  });

  test('guards double Save and can start another clean draft after success', async ({ page }) => {
    await openTransportAdmin(page);
    await prepareMinimalWizardSave(page);
    await page.locator('#btnTransportRouteWizardSave').evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(page.locator('#transportRouteWizardReceipt')).toBeVisible({ timeout: 15000 });
    const saved = await page.evaluate(() => {
      const rows = (window as any).__supabaseStub.getTableRows('transport_routes').filter((row: any) => (
        row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol'
      ));
      const state = (window as any).TransportRouteWizard.getState();
      return { count: rows.length, attempts: state.plan.steps[0].attempts };
    });
    expect(saved).toEqual({ count: 1, attempts: 1 });

    await page.locator('#btnTransportRouteWizardCreateAnother').click();
    await expect(page.locator('#transportRouteWizardReceipt')).toBeHidden();
    await expect(page.locator('[data-transport-route-wizard-step="1"]')).toBeVisible();
    await expect(page.locator('#transportRouteWizardOrigin')).toHaveValue('');
    await expect(page.locator('#transportRouteWizardDestination')).toHaveValue('');
    await expect(page.locator('#transportRouteWizardModal')).toBeVisible();
  });

  test('reconciles a 23505 route insert without creating a duplicate', async ({ page }) => {
    await openTransportAdmin(page);
    await prepareMinimalWizardSave(page);
    await page.evaluate(() => {
      (window as any).__supabaseStub.failNextMutation({
        table: 'transport_routes',
        action: 'insert',
        afterWrite: true,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });
    });

    await page.locator('#btnTransportRouteWizardSave').click();
    await expect(page.locator('#transportRouteWizardReceipt')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-transport-route-wizard-plan-step="route_outbound"]')).toContainText('Matched to an existing saved record');
    const result = await page.evaluate(() => {
      const rows = (window as any).__supabaseStub.getTableRows('transport_routes').filter((row: any) => (
        row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol'
      ));
      const step = (window as any).TransportRouteWizard.getState().plan.steps[0];
      return { count: rows.length, reconciled: step.reconciled, attempts: step.attempts };
    });
    expect(result).toEqual({ count: 1, reconciled: true, attempts: 1 });
  });

  test('reconciles ambiguous pricing and deposit writes by fingerprint and identity', async ({ page }) => {
    await openTransportAdmin(page);
    await prepareMinimalWizardSave(page, { pricing: true, deposit: true });
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.failNextMutation({
        table: 'transport_pricing_rules',
        action: 'insert',
        afterWrite: true,
        error: { name: 'TimeoutError', message: 'network timeout after pricing insert' },
      });
      stub.failNextMutation({
        table: 'service_deposit_overrides',
        action: 'upsert',
        afterWrite: true,
        error: { name: 'TimeoutError', message: 'network timeout after deposit upsert' },
      });
    });

    await page.locator('#btnTransportRouteWizardSave').click();
    await expect(page.locator('#transportRouteWizardReceipt')).toBeVisible({ timeout: 15000 });
    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const route = stub.getTableRows('transport_routes').find((row: any) => (
        row.origin_location_id === 'loc-paphos' && row.destination_location_id === 'loc-limassol'
      ));
      const state = (window as any).TransportRouteWizard.getState();
      return {
        pricing: stub.getTableRows('transport_pricing_rules').filter((row: any) => row.route_id === route?.id).length,
        deposits: stub.getTableRows('service_deposit_overrides').filter((row: any) => row.resource_id === route?.id).length,
        reconciled: Object.fromEntries(state.plan.steps.map((step: any) => [step.key, step.reconciled])),
      };
    });
    expect(result).toEqual({
      pricing: 1,
      deposits: 1,
      reconciled: { route_outbound: false, pricing_outbound: true, deposit_outbound: true },
    });
  });

  test('uses a wide desktop dialog and a full-screen mobile layout', async ({ page }) => {
    await openTransportAdmin(page);
    await openRouteWizard(page);
    const desktop = await page.locator('.transport-route-wizard__dialog').evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(desktop.width).toBeGreaterThan(900);
    expect(desktop.width).toBeLessThan(desktop.viewport);
    expect(desktop.overflow).toBeLessThanOrEqual(1);
    await page.locator('#btnTransportRouteWizardCancel').click();

    await page.setViewportSize({ width: 390, height: 844 });
    await openRouteWizard(page);
    const mobile = await page.locator('.transport-route-wizard__dialog').evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(mobile.width).toBe(mobile.viewportWidth);
    expect(mobile.height).toBe(mobile.viewportHeight);
    expect(mobile.overflow).toBeLessThanOrEqual(1);
  });
});
