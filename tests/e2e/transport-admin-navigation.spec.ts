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

async function expectTransportBookingModalVisible(page: any) {
  const modal = page.locator('#transportBookingDetailsModal');
  await expect(modal).toBeVisible();
  expect(await modal.getAttribute('hidden')).toBeNull();

  const visibility = await modal.evaluate((element: HTMLElement) => {
    const hiddenAncestors: string[] = [];
    const displayNoneAncestors: string[] = [];
    let ancestor = element.parentElement;

    while (ancestor) {
      const label = ancestor.id || ancestor.tagName.toLowerCase();
      if (ancestor.hidden || ancestor.hasAttribute('hidden')) hiddenAncestors.push(label);
      if (getComputedStyle(ancestor).display === 'none') displayNoneAncestors.push(label);
      ancestor = ancestor.parentElement;
    }

    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity,
      width: rect.width,
      height: rect.height,
      hiddenAncestors,
      displayNoneAncestors,
    };
  });

  expect(visibility.display).not.toBe('none');
  expect(visibility.visibility).not.toBe('hidden');
  expect(Number(visibility.opacity)).toBeGreaterThan(0);
  expect(visibility.width).toBeGreaterThan(0);
  expect(visibility.height).toBeGreaterThan(0);
  expect(visibility.hiddenAncestors).toEqual([]);
  expect(visibility.displayNoneAncestors).toEqual([]);

  await expect(page.locator('#transportBookingDetailsContent')).toContainText('Stage 1B Guest');
  await expect(page.locator('#transportBookingDetailsContent')).toContainText('stage1b@example.com');
  await expect(page.locator('#transportBookingDetailsContent')).toContainText('10/09/2026');
  await expect(page.locator('#transportBookingDetailsContent')).toContainText('€70.00');
}

async function runRouteAction(page: any, routeId: string, action: string) {
  const record = page.locator(`[data-transport-route-record][data-route-id="${routeId}"]`);
  const menu = record.locator('.transport-admin-v2-route-action-menu');
  if (!await menu.evaluate((details: HTMLDetailsElement) => details.open)) {
    await menu.locator('> summary').click();
  }
  await record.locator(`[data-transport-route-action="${action}"]`).click();
}

async function snapshotTransportPairPricingTables(page: any) {
  return page.evaluate(() => {
    const stub = (window as any).__supabaseStub;
    return {
      routes: stub.getTableRows('transport_routes'),
      pricing: stub.getTableRows('transport_pricing_rules'),
      depositRules: stub.getTableRows('service_deposit_rules'),
      depositOverrides: stub.getTableRows('service_deposit_overrides'),
      rpcCalls: stub.getRpcCalls(),
    };
  });
}

async function seedStage2CMatchingPair(page: any, options: {
  matchingRoutes?: boolean;
  multipleOutboundRules?: boolean;
  reverseRule?: boolean;
} = {}) {
  await page.evaluate((seedOptions) => {
    const stub = (window as any).__supabaseStub;
    const routes = stub.getTableRows('transport_routes');
    const outbound = routes.find((row: any) => row.id === 'route-lca-paphos');
    const reverse = routes.find((row: any) => row.id === 'route-paphos-lca');
    if (seedOptions.matchingRoutes !== false && outbound && reverse) {
      Object.assign(reverse, {
        day_price: outbound.day_price,
        night_price: outbound.night_price,
        currency: outbound.currency,
        included_passengers: outbound.included_passengers,
        included_bags: outbound.included_bags,
        included_large_bags: outbound.included_large_bags,
        max_passengers: outbound.max_passengers,
        max_bags: outbound.max_bags,
        is_active: true,
        updated_at: '2026-08-01T08:05:00.000Z',
      });
    }
    if (outbound) outbound.updated_at = '2026-08-01T08:00:00.000Z';
    stub.seedTable('transport_routes', routes);

    const existing = stub.getTableRows('transport_pricing_rules')
      .find((row: any) => row.id === 'pricing-lca-paphos');
    const outboundRule = {
      ...existing,
      valid_from: null,
      valid_to: null,
      updated_at: '2026-08-01T09:00:00.000Z',
    };
    const pricing = [outboundRule];
    if (seedOptions.multipleOutboundRules) {
      pricing.push({
        ...outboundRule,
        id: 'pricing-lca-paphos-second',
        priority: 2,
        extra_passenger_fee: 9,
        updated_at: '2026-08-01T09:10:00.000Z',
      });
    }
    if (seedOptions.reverseRule !== false) {
      pricing.push({
        ...outboundRule,
        id: 'pricing-paphos-lca',
        route_id: 'route-paphos-lca',
        updated_at: '2026-08-01T09:05:00.000Z',
      });
    }
    stub.seedTable('transport_pricing_rules', pricing);
    stub.seedTable('service_deposit_rules', [{
      resource_type: 'transport',
      mode: 'flat',
      amount: 12,
      currency: 'EUR',
      include_children: true,
      enabled: true,
      updated_at: '2026-08-01T07:00:00.000Z',
    }]);
    stub.seedTable('service_deposit_overrides', []);
  }, options);
}

async function getTransportMutationCalls(page: any) {
  return page.evaluate(() => (window as any).__supabaseStub.getMutationCalls());
}

async function clearTransportMutationCalls(page: any) {
  await page.evaluate(() => (window as any).__supabaseStub.clearMutationCalls());
}

async function openMatchingPairForStage2D(page: any) {
  await openTransportAdmin(page);
  await seedStage2CMatchingPair(page);
  await runRouteAction(page, 'route-lca-paphos', 'pricing');
  await expect(page.locator('#transportPairPricingModal')).toBeVisible();
  await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('pricing-lca-paphos');
  await expect(page.locator('#transportPairPricingReverseRule')).toHaveValue('pricing-paphos-lca');
}

async function openSaveConfirmation(page: any) {
  const save = page.locator('#transportPairPricingSaveChanges');
  await expect(save).toBeVisible();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.locator('#transportPairPricingSaveConfirmDialog')).toBeVisible();
  await expect(page.locator('#transportPairPricingSaveConfirmTitle')).toBeFocused();
}

async function confirmPairPricingSave(page: any) {
  await openSaveConfirmation(page);
  await page.locator('#transportPairPricingSaveConfirmAccept').click();
}

function exactMutationIds(calls: any[], table: string, action = 'update') {
  return calls
    .filter((call: any) => call.table === table && call.action === action)
    .map((call: any) => call.filters.find((filter: any) => (
      filter.type === 'eq' && filter.column === 'id'
    ))?.value)
    .filter(Boolean);
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
    await expect(page.locator('#transportBookingDetailsModal')).toHaveCount(1);
    await expect(page.locator('#viewTransport #transportBookingDetailsModal')).toHaveCount(0);
    await expect(page.locator('#transportAdminV2PanelBookings #transportBookingDetailsModal')).toHaveCount(0);
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

  test('opens the global transport booking modal from Dashboard All Orders', async ({ page }) => {
    const consoleEntries: Array<{ text: string; url: string }> = [];
    page.on('console', (message) => {
      consoleEntries.push({ text: message.text(), url: message.location().url });
    });

    await page.addInitScript(transportAdminSeedScript());
    await enableSupabaseStub(page);
    await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
    await waitForSupabaseStub(page);

    await expect(page.locator('#viewDashboard')).toBeVisible();
    await expect(page.locator('#viewTransport')).toBeHidden();
    const orderRow = page.locator('#allOrdersTableBody tr').filter({ hasText: 'Stage 1B Guest' });
    await expect(orderRow).toContainText('Transport');
    const viewButton = orderRow.getByRole('button', { name: 'View', exact: true });
    await expect(viewButton).toHaveAttribute('onclick', "viewTransportBookingDetails('transport-booking-stage-1b')");

    await viewButton.click();
    await expectTransportBookingModalVisible(page);
    await expect(page.locator('#viewTransport')).toBeHidden();
    await expect(page.locator('#viewTransport #transportBookingDetailsModal')).toHaveCount(0);
    await expect(page.locator('#transportAdminV2PanelBookings #transportBookingDetailsModal')).toHaveCount(0);

    const extensionMessages = consoleEntries.filter(({ text, url }) => (
      /MaxListenersExceededWarning|ObjectMultiplex|orphaned data for stream|background-liveness|Host is not (?:valid or )?supported|insights whitelist/i.test(`${text} ${url}`)
      || /^(?:chrome|moz|safari)-extension:/i.test(url)
    ));
    expect(extensionMessages).toEqual([]);
  });

  test('keeps Transport Bookings opening the same global booking modal', async ({ page }) => {
    await openTransportAdmin(page);
    await activateTab(page, 'transportAdminV2TabBookings', 'transportAdminV2PanelBookings');

    const bookingRow = page.locator('#transportBookingsTableBody tr').filter({ hasText: 'Stage 1B Guest' });
    const viewButton = bookingRow.getByRole('button', { name: 'View', exact: true });
    await expect(viewButton).toHaveAttribute('onclick', "viewTransportBookingDetails('transport-booking-stage-1b')");

    await viewButton.click();
    await expectTransportBookingModalVisible(page);
    await expect(page.locator('#viewTransport #transportBookingDetailsModal')).toHaveCount(0);
    await expect(page.locator('#transportAdminV2PanelBookings #transportBookingDetailsModal')).toHaveCount(0);
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

  test('opens Legacy edit, read-only pair Pricing, Quote tester, and Bookings shortcuts', async ({ page }) => {
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
    await expect(page.locator('#transportPairPricingModal')).toBeVisible();
    await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('pricing-lca-paphos');
    await expect(page.locator('#transportPairPricingModalContent')).toContainText('route-paphos-lca');
    await page.locator('#transportPairPricingModalClose').click();

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

test.describe('Transport Admin Stage 2B pair pricing modal', () => {
  test('opens the exact A↔B pair, shows one/zero rules and mixed values, survives tabs, and restores focus', async ({ page }) => {
    await openTransportAdmin(page);
    const mutationRequests: string[] = [];
    page.on('request', (request) => {
      if (
        /\/rest\/v1\/(?:transport_routes|transport_pricing_rules|service_deposit_rules|service_deposit_overrides)/.test(request.url())
        && /^(?:POST|PUT|PATCH|DELETE)$/i.test(request.method())
      ) mutationRequests.push(`${request.method()} ${request.url()}`);
    });
    const before = await snapshotTransportPairPricingTables(page);
    const pricingButton = page.locator(
      '[data-route-id="route-lca-paphos"] [data-transport-route-action="pricing"]',
    );

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    const modal = page.locator('#transportPairPricingModal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#transportPairPricingModalTitle')).toContainText('Larnaca Airport (LCA_AIRPORT)');
    await expect(page.locator('#transportPairPricingModalTitle')).toContainText('Paphos Hotel (PAPHOS_HOTEL)');
    await expect(page.locator('#transportPairPricingModalContent')).toContainText('route-lca-paphos');
    await expect(page.locator('#transportPairPricingModalContent')).toContainText('route-paphos-lca');
    await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('pricing-lca-paphos');
    await expect(page.locator('[data-rule-direction="reverse"]')).toContainText('0 rules');
    await expect(page.locator('[data-rule-direction="reverse"]')).toContainText('No pricing rule');
    await expect(page.locator('#transportPairPricingReverseRule')).toHaveCount(0);
    await expect(page.locator(
      '.transport-pair-pricing-modal__section[data-section-different="true"]',
    ).filter({ hasText: 'Base price' })).toContainText('Different values');
    await expect(page.locator('[data-transport-pair-field="day_price"]')).toContainText('70');
    await expect(page.locator('[data-transport-pair-field="day_price"]')).toContainText('65');
    await expect(page.locator('#transportPairPricingModalClose')).toBeFocused();
    expect(await modal.evaluate((element: HTMLElement) => {
      const blockedAncestors: string[] = [];
      let ancestor = element.parentElement;
      while (ancestor) {
        if (ancestor.hidden || getComputedStyle(ancestor).display === 'none') {
          blockedAncestors.push(ancestor.id || ancestor.tagName.toLowerCase());
        }
        ancestor = ancestor.parentElement;
      }
      return blockedAncestors;
    })).toEqual([]);
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#transportPairPricingReviewChanges')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#transportPairPricingModalClose')).toBeFocused();

    await page.evaluate(() => (window as any).TransportAdminNavigation.activate('bookings'));
    await expect(page.locator('#transportAdminV2PanelBookings')).toBeVisible();
    await expect(modal).toBeVisible();

    await page.evaluate(() => (window as any).TransportAdminNavigation.activate('routes'));
    await expect(page.locator('#transportAdminV2PanelRoutes')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(pricingButton).toBeFocused();

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(modal).toBeVisible();
    await page.locator('#transportPairPricingModalClose').click();
    await expect(modal).toBeHidden();
    await expect(pricingButton).toBeFocused();

    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
    expect(mutationRequests).toEqual([]);
  });

  test('shows reverse missing without creating it and offers only explicit Route Wizard navigation', async ({ page }) => {
    await openTransportAdmin(page);
    const before = await snapshotTransportPairPricingTables(page);

    await runRouteAction(page, 'route-lca-limassol', 'pricing');
    await expect(page.locator('#transportPairPricingModal')).toBeVisible();
    await expect(page.locator('#transportPairPricingReverseWarning')).toContainText('Reverse route missing');
    await expect(page.locator('#transportPairPricingModalContent')).toContainText('route-lca-limassol');
    await expect(page.locator('#transportPairPricingModalContent')).toContainText('Reverse route missing');
    await expect(page.locator('#transportPairPricingOpenRouteWizard')).toBeVisible();
    await expect(page.locator('#transportPairPricingReverseRule')).toHaveCount(0);
    await page.locator('#transportPairPricingModalClose').click();

    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
  });

  test('requires exact selection for multiple rules and passes only that route/rule to Advanced Pricing', async ({ page }) => {
    await openTransportAdmin(page);
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const routes = stub.getTableRows('transport_routes').map((route: any) => (
        route.id === 'route-paphos-lca' ? { ...route, currency: 'USD', max_passengers: 6 } : route
      ));
      stub.seedTable('transport_routes', routes);
      stub.seedTable('transport_pricing_rules', [
        {
          id: 'pricing-lca-paphos',
          route_id: 'route-lca-paphos',
          extra_passenger_fee: 5,
          extra_bag_fee: 3,
          oversize_bag_fee: 10,
          child_seat_fee: 4,
          booster_seat_fee: 4,
          waiting_included_minutes: 15,
          waiting_fee_per_hour: 20,
          night_start: '22:00',
          night_end: '06:00',
          deposit_enabled: false,
          deposit_mode: 'percent_total',
          deposit_value: 0,
          priority: 1,
          valid_from: null,
          valid_to: null,
          updated_at: '2026-07-30T10:00:00.000Z',
          is_active: true,
        },
        {
          id: 'pricing-lca-paphos-special',
          route_id: 'route-lca-paphos',
          extra_passenger_fee: 9,
          extra_bag_fee: 6,
          oversize_bag_fee: 14,
          child_seat_fee: 7,
          booster_seat_fee: 7,
          waiting_included_minutes: 10,
          waiting_fee_per_hour: 30,
          night_start: '23:00',
          night_end: '05:00',
          deposit_enabled: true,
          deposit_mode: 'fixed_amount',
          deposit_value: 25,
          priority: 2,
          valid_from: '2026-08-01',
          valid_to: '2026-08-31',
          updated_at: '2026-07-31T10:00:00.000Z',
          is_active: true,
        },
        {
          id: 'pricing-paphos-lca',
          route_id: 'route-paphos-lca',
          extra_passenger_fee: 4,
          extra_bag_fee: 2,
          oversize_bag_fee: 8,
          child_seat_fee: 3,
          booster_seat_fee: 3,
          waiting_included_minutes: 20,
          waiting_fee_per_hour: 18,
          night_start: '21:00',
          night_end: '07:00',
          deposit_enabled: true,
          deposit_mode: 'percent_total',
          deposit_value: 20,
          priority: 1,
          valid_from: null,
          valid_to: null,
          updated_at: '2026-07-29T10:00:00.000Z',
          is_active: true,
        },
      ]);
      stub.seedTable('service_deposit_rules', [{
        resource_type: 'transport',
        mode: 'flat',
        amount: 12,
        currency: 'EUR',
        include_children: true,
        enabled: true,
      }]);
      stub.seedTable('service_deposit_overrides', [{
        id: 'override-route-lca-paphos',
        resource_type: 'transport',
        resource_id: 'route-lca-paphos',
        mode: 'flat',
        amount: 25,
        currency: 'EUR',
        include_children: true,
        enabled: true,
      }]);
    });
    const mutationRequests: string[] = [];
    page.on('request', (request) => {
      if (
        /\/rest\/v1\/(?:transport_routes|transport_pricing_rules|service_deposit_rules|service_deposit_overrides)/.test(request.url())
        && /^(?:POST|PUT|PATCH|DELETE)$/i.test(request.method())
      ) mutationRequests.push(`${request.method()} ${request.url()}`);
    });
    const before = await snapshotTransportPairPricingTables(page);

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(page.locator('#transportPairPricingModal')).toBeVisible();
    await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('');
    await expect(page.locator('[data-rule-direction="outbound"]')).toContainText('Multiple pricing rules found');
    await expect(page.locator('#transportPairPricingReverseRule')).toHaveValue('pricing-paphos-lca');
    await expect(page.locator('#transportPairPricingMultiRuleDepositWarning')).toHaveText(
      'Deposit editing will remain unavailable in the simple modal because this route has multiple pricing rules.',
    );
    await expect(page.locator('#transportPairPricingCurrencyWarning')).toContainText('EUR');
    await expect(page.locator('#transportPairPricingCurrencyWarning')).toContainText('USD');
    await expect(page.locator('.transport-pair-pricing-modal__global-deposit')).toContainText('12 EUR');
    await expect(page.locator('.transport-pair-pricing-modal__global-deposit')).toContainText('include_children');
    await expect(page.locator('.transport-pair-pricing-modal__global-deposit')).toContainText('true');
    await expect(page.locator('[data-transport-pair-field="route_level_override"]')).toContainText('25 EUR');

    await page.locator('#transportPairPricingOutboundRule').selectOption('pricing-lca-paphos-special');
    await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('pricing-lca-paphos-special');
    await expect(page.locator('[data-transport-pair-field="extra_passenger_fee"] span').nth(1)).toHaveText('9');
    await expect(page.locator(
      '.transport-pair-pricing-modal__section[data-section-different="true"]',
    ).filter({ hasText: 'Selected rule surcharges' })).toContainText('Different values');
    await expect(page.locator('#transportPairPricingOpenAdvanced')).toContainText('A → B');

    await page.locator('#transportPairPricingOpenAdvanced').click();
    await expect(page.locator('#transportPairPricingModal')).toBeHidden();
    await expect(page.locator('#transportAdminV2PanelAdvancedPricing')).toBeVisible();
    await expect(page.locator('#transportPricingRoute')).toHaveValue('route-lca-paphos');
    await expect(page.locator('#transportPricingId')).toHaveValue('pricing-lca-paphos-special');
    await expect(page.locator('#transportControlRouteSelect')).toHaveValue('route-lca-paphos');
    await expect(page.locator('#transportControlRuleSelect')).toHaveValue('pricing-lca-paphos-special');

    await page.evaluate(() => (window as any).TransportAdminNavigation.activate('routes'));
    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await page.locator('#transportPairPricingReverseRule').selectOption('');
    await page.locator('#transportPairPricingReverseRule').selectOption('pricing-paphos-lca');
    await expect(page.locator('#transportPairPricingOpenAdvanced')).toContainText('B → A');
    await page.locator('#transportPairPricingOpenAdvanced').click();
    await expect(page.locator('#transportAdminV2PanelAdvancedPricing')).toBeVisible();
    await expect(page.locator('#transportPricingRoute')).toHaveValue('route-paphos-lca');
    await expect(page.locator('#transportPricingId')).toHaveValue('pricing-paphos-lca');
    await expect(page.locator('#transportControlRouteSelect')).toHaveValue('route-paphos-lca');
    await expect(page.locator('#transportControlRuleSelect')).toHaveValue('pricing-paphos-lca');

    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
    expect(mutationRequests).toEqual([]);
  });

  test('keeps a failed fresh read open and refreshes successfully on retry', async ({ page }) => {
    await openTransportAdmin(page);
    await page.evaluate(() => {
      (window as any).__supabaseStub.selectErrorsByTable = {
        transport_routes: 'Stage 2B route read failed',
      };
    });

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(page.locator('#transportPairPricingModal')).toBeVisible();
    await expect(page.locator('#transportPairPricingModalError')).toBeVisible();
    await expect(page.locator('#transportPairPricingModalError')).toContainText('Stage 2B route read failed');

    await page.evaluate(() => {
      delete (window as any).__supabaseStub.selectErrorsByTable.transport_routes;
    });
    await page.locator('#transportPairPricingModalRefresh').click();
    await expect(page.locator('#transportPairPricingModalError')).toBeHidden();
    await expect(page.locator('#transportPairPricingModalContent')).toBeVisible();
    await expect(page.locator('#transportPairPricingModalContent')).toContainText('route-lca-paphos');
  });
});

test.describe('Transport Admin Stage 2C draft and Review', () => {
  test('hydrates identical values, builds an unchanged exact-ID Review, and exposes no Save', async ({ page }) => {
    await openTransportAdmin(page);
    await seedStage2CMatchingPair(page);
    const before = await snapshotTransportPairPricingTables(page);

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(page.locator('#transportPairPricingScopeBoth')).toBeChecked();
    await expect(page.locator('#transportPairPricingDayPrice')).toHaveValue('70');
    await expect(page.locator('#transportPairPricingNightPrice')).toHaveValue('90');
    await expect(page.locator('#transportPairPricingCurrency')).toHaveValue('EUR');
    await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('pricing-lca-paphos');
    await expect(page.locator('#transportPairPricingReverseRule')).toHaveValue('pricing-paphos-lca');

    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('#transportPairPricingReviewTitle')).toBeVisible();
    await expect(page.locator('#transportPairPricingReviewTitle')).toBeFocused();
    await expect(page.locator('#transportPairPricingReviewSafety')).toContainText('Global changes: 0');
    await expect(page.locator('[data-review-step="route_outbound"]')).toContainText('route-lca-paphos');
    await expect(page.locator('[data-review-step="route_reverse"]')).toContainText('route-paphos-lca');
    await expect(page.locator('[data-review-step="pricing_outbound"]')).toContainText('pricing-lca-paphos');
    await expect(page.locator('[data-review-step="pricing_reverse"]')).toContainText('pricing-paphos-lca');
    await expect(page.locator('[data-review-step="route_outbound"]')).toContainText('UNCHANGED');
    await expect(page.locator('#transportPairPricingSaveChanges')).toBeVisible();
    await expect(page.locator('#transportPairPricingSaveChanges')).toBeDisabled();
    await expect(page.locator('#transportPairPricingSaveChanges')).toHaveText('Save changes');

    await page.locator('#transportPairPricingBackToEdit').click();
    await expect(page.locator('#transportPairPricingReviewChanges')).toBeFocused();
    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
  });

  test('keeps mixed values empty, accepts a conscious shared price, shows before→after, and invalidates Review', async ({ page }) => {
    await openTransportAdmin(page);
    await seedStage2CMatchingPair(page, { matchingRoutes: false });
    const mutationRequests: string[] = [];
    page.on('request', (request) => {
      if (
        /\/rest\/v1\/(?:transport_routes|transport_pricing_rules|service_deposit_rules|service_deposit_overrides)/.test(request.url())
        && /^(?:POST|PUT|PATCH|DELETE)$/i.test(request.method())
      ) mutationRequests.push(`${request.method()} ${request.url()}`);
    });
    const before = await snapshotTransportPairPricingTables(page);

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(page.locator('#transportPairPricingDayPrice')).toHaveValue('');
    await expect(page.locator('#transportPairPricingNightPrice')).toHaveValue('');
    await expect(page.locator('#transportPairPricingDayPriceState')).toContainText('Mixed values');
    await expect(page.locator('#transportPairPricingDayPriceState')).toContainText('A→B 70');
    await expect(page.locator('#transportPairPricingDayPriceState')).toContainText('B→A 65');

    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingNightPrice').fill('100');
    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('#transportPairPricingReviewTitle')).toBeVisible();
    await expect(page.locator('#transportPairPricingReviewSafety')).toContainText('Global changes: 0');
    await expect(page.locator('[data-review-step="route_outbound"] [data-review-field="day_price"]')).toContainText('70');
    await expect(page.locator('[data-review-step="route_outbound"] [data-review-field="day_price"]')).toContainText('80');
    await expect(page.locator('[data-review-step="route_reverse"] [data-review-field="day_price"]')).toContainText('65');
    await expect(page.locator('[data-review-step="route_reverse"] [data-review-field="day_price"]')).toContainText('80');
    await expect(page.locator('.transport-pair-pricing-modal__review-summary')).toContainText('2');

    await page.locator('#transportPairPricingBackToEdit').click();
    await page.locator('#transportPairPricingDayPrice').fill('82');
    await expect(page.locator('#transportPairPricingReviewOutdated')).toBeVisible();
    await expect(page.locator('#transportPairPricingReviewOutdated')).toHaveText(
      'Review is outdated. Review the changes again.',
    );
    expect(await page.evaluate(() => (
      (window as any).TransportPairPricingModal.getState().draft.review.isCurrent
    ))).toBe(false);

    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
    expect(mutationRequests).toEqual([]);
  });

  test('requires exact rules with multiple candidates, blocks deposit, and keeps Advanced fallback empty', async ({ page }) => {
    await openTransportAdmin(page);
    await seedStage2CMatchingPair(page, { multipleOutboundRules: true });
    const before = await snapshotTransportPairPricingTables(page);

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('');
    await expect(page.locator('#transportPairPricingReverseRule')).toHaveValue('pricing-paphos-lca');
    await expect(page.locator('#transportPairPricingDepositSection')).toHaveAttribute('disabled', '');
    await expect(page.locator('#transportPairPricingDepositEnabled')).toBeDisabled();
    await expect(page.locator('#transportPairPricingMultiRuleDepositWarning')).toBeVisible();
    await expect(page.locator('#transportPairPricingMultiRuleDepositWarning')).toContainText('multiple pricing rules');

    await page.locator('#transportPairPricingOutboundRule').selectOption('pricing-lca-paphos-second');
    await page.locator('#transportPairPricingReverseRule').selectOption('');
    await page.locator('#transportPairPricingReverseRule').selectOption('pricing-paphos-lca');
    await expect(page.locator('#transportPairPricingExtraPassengerFee')).toHaveValue('');
    await expect(page.locator('#transportPairPricingExtraPassengerFeeState')).toContainText('Mixed values');

    await page.locator('#transportPairPricingModalRefresh').click();
    await expect(page.locator('#transportPairPricingOutboundRule')).toHaveValue('');
    await expect(page.locator('#transportPairPricingReverseRule')).toHaveValue('pricing-paphos-lca');
    await page.locator('#transportPairPricingOutboundRule').selectOption('');
    await expect(page.locator('#transportPairPricingOpenAdvanced')).toContainText('A → B');
    await page.locator('#transportPairPricingOpenAdvanced').click();
    await expect(page.locator('#transportAdminV2PanelAdvancedPricing')).toBeVisible();
    await expect(page.locator('#transportPricingRoute')).toHaveValue('route-lca-paphos');
    await expect(page.locator('#transportPricingId')).toHaveValue('');
    await expect(page.locator('#transportControlRuleSelect')).toHaveValue('');

    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
  });

  test('locks reverse-missing pairs to A→B only and reviews route updates without inserting a rule', async ({ page }) => {
    await openTransportAdmin(page);
    const before = await snapshotTransportPairPricingTables(page);

    await runRouteAction(page, 'route-lca-limassol', 'pricing');
    await expect(page.locator('#transportPairPricingScopeBoth')).toBeDisabled();
    await expect(page.locator('#transportPairPricingScopeOutbound')).toBeChecked();
    await expect(page.locator('#transportPairPricingDayPrice')).toHaveValue('55');
    await expect(page.locator('#transportPairPricingMissingRuleNotice')).toContainText(
      'No pricing rule selected. Advanced pricing fields cannot be updated in the simple editor.',
    );

    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('#transportPairPricingReviewTitle')).toBeVisible();
    await expect(page.locator('.transport-pair-pricing-modal__review-scope')).toContainText('A→B only');
    await expect(page.locator('.transport-pair-pricing-modal__review-scope')).toContainText('route-lca-limassol');
    await expect(page.locator('[data-review-step="pricing_outbound"]')).toContainText('BLOCKED');
    await expect(page.locator('[data-review-step="pricing_outbound"]')).toContainText('No pricing rule selected');
    await expect(page.locator('#transportPairPricingSaveChanges')).toBeDisabled();

    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
  });

  test('blocks invalid capacity and deposit above 100, then plans deposit INSERTs without requests', async ({ page }) => {
    await openTransportAdmin(page);
    await seedStage2CMatchingPair(page);
    const mutationRequests: string[] = [];
    page.on('request', (request) => {
      if (
        /\/rest\/v1\/(?:transport_routes|transport_pricing_rules|service_deposit_rules|service_deposit_overrides)/.test(request.url())
        && /^(?:POST|PUT|PATCH|DELETE)$/i.test(request.method())
      ) mutationRequests.push(`${request.method()} ${request.url()}`);
    });
    const before = await snapshotTransportPairPricingTables(page);

    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await page.locator('#transportPairPricingIncludedPassengers').fill('8');
    await page.locator('#transportPairPricingMaxPassengers').fill('7');
    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('#transportPairPricingValidationErrors')).toContainText(
      'Max passengers must be greater than or equal to included passengers.',
    );
    await expect(page.locator('#transportPairPricingMaxPassengers')).toBeFocused();
    await expect(page.locator('#transportPairPricingReviewTitle')).toHaveCount(0);

    await page.locator('#transportPairPricingMaxPassengers').fill('8');
    await page.locator('#transportPairPricingDepositEnabled').check();
    await page.locator('#transportPairPricingDepositMode').selectOption('percent_total');
    await page.locator('#transportPairPricingDepositValue').fill('101');
    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('#transportPairPricingValidationErrors')).toContainText(
      'Percent deposit cannot exceed 100.',
    );
    await expect(page.locator('#transportPairPricingDepositValue')).toBeFocused();

    await page.locator('#transportPairPricingDepositValue').fill('50');
    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('#transportPairPricingReviewTitle')).toBeVisible();
    await expect(page.locator('[data-review-step="deposit_outbound"]')).toContainText('INSERT');
    await expect(page.locator('[data-review-step="deposit_reverse"]')).toContainText('INSERT');
    await expect(page.locator('.transport-pair-pricing-modal__review-summary')).toContainText('Global changes');
    await expect(page.locator('.transport-pair-pricing-modal__review-summary')).toContainText('0');

    expect(await snapshotTransportPairPricingTables(page)).toEqual(before);
    expect(mutationRequests).toEqual([]);
  });
});

test.describe('Transport Admin Stage 2D controlled pair save', () => {
  test('saves both exact route IDs once, preserves hidden route fields, and shows a verified receipt', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    const before = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        rpcCalls: stub.getRpcCalls(),
      };
    });

    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('#transportPairPricingReviewTitle')).toBeVisible();
    await openSaveConfirmation(page);
    await expect(page.locator('#transportPairPricingSaveConfirmSummary')).toHaveText(
      'Save these changes to 2 routes and 0 pricing rules?',
    );
    await expect(page.locator('#transportPairPricingSaveConfirmDialog')).toContainText('Global changes: 0');
    await expect(page.locator('#transportPairPricingSaveConfirmDialog')).toContainText('Bookings affected: 0');

    await page.keyboard.press('Escape');
    await expect(page.locator('#transportPairPricingSaveConfirmDialog')).toBeHidden();
    await expect(page.locator('#transportPairPricingModal')).toBeVisible();
    await expect(page.locator('#transportPairPricingSaveChanges')).toBeFocused();

    await openSaveConfirmation(page);
    await clearTransportMutationCalls(page);
    await page.evaluate(() => {
      const button = document.getElementById('transportPairPricingSaveConfirmAccept') as HTMLButtonElement;
      button.click();
      button.click();
    });

    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeFocused();
    await expect(page.locator('.transport-pair-pricing-modal__receipt')).toContainText('route-lca-paphos');
    await expect(page.locator('.transport-pair-pricing-modal__receipt')).toContainText('route-paphos-lca');
    await expect(page.locator('.transport-pair-pricing-modal__receipt')).toContainText('70 → 80');
    await expect(page.locator('.transport-pair-pricing-modal__receipt')).toContainText('Global changes: 0');
    await expect(page.locator('[data-transport-pair-save-step="route_outbound"]')).toHaveAttribute('data-step-status', 'success');
    await expect(page.locator('[data-transport-pair-save-step="route_reverse"]')).toHaveAttribute('data-step-status', 'success');

    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        calls: stub.getMutationCalls(),
        rpcCalls: stub.getRpcCalls(),
        modalState: (window as any).TransportPairPricingModal.getState(),
      };
    });
    const routeCalls = result.calls.filter((call: any) => (
      call.table === 'transport_routes' && call.action === 'update'
    ));
    expect(exactMutationIds(result.calls, 'transport_routes').sort()).toEqual([
      'route-lca-paphos',
      'route-paphos-lca',
    ]);
    expect(routeCalls).toHaveLength(2);
    routeCalls.forEach((call: any) => {
      expect(Object.keys(call.payload)).toEqual(['day_price']);
      expect(call.filters).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'eq', column: 'id' }),
        expect.objectContaining({ type: 'eq', column: 'updated_at' }),
      ]));
    });
    expect(result.modalState.savePlan.attempts).toBe(1);

    ['route-lca-paphos', 'route-paphos-lca'].forEach((routeId) => {
      const previous = before.routes.find((row: any) => row.id === routeId);
      const saved = result.routes.find((row: any) => row.id === routeId);
      expect(saved).toMatchObject({
        day_price: 80,
        origin_location_id: previous.origin_location_id,
        destination_location_id: previous.destination_location_id,
        is_active: previous.is_active,
        sort_order: previous.sort_order,
        allows_round_trip: previous.allows_round_trip,
        round_trip_multiplier: previous.round_trip_multiplier,
      });
    });
    expect(result.calls.filter((call: any) => [
      'transport_bookings',
      'partners',
      'partner_users',
      'partner_resource_assignments',
      'partner_service_fulfillments',
      'service_deposit_rules',
      'service_deposit_requests',
      'payments',
      'emails',
      'notifications',
    ].includes(call.table))).toEqual([]);
    expect(result.rpcCalls).toEqual(before.rpcCalls);
  });

  test('updates only the exact selected pricing rule IDs and preserves validity, priority, and active state', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    const before = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('transport_pricing_rules'));

    await page.locator('#transportPairPricingExtraPassengerFee').fill('8');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();

    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        rules: stub.getTableRows('transport_pricing_rules'),
        calls: stub.getMutationCalls(),
      };
    });
    expect(exactMutationIds(result.calls, 'transport_pricing_rules').sort()).toEqual([
      'pricing-lca-paphos',
      'pricing-paphos-lca',
    ]);
    expect(result.calls.filter((call: any) => call.table === 'transport_pricing_rules')).toHaveLength(2);
    expect(result.calls.some((call: any) => (
      call.table === 'transport_pricing_rules' && call.action === 'insert'
    ))).toBe(false);

    ['pricing-lca-paphos', 'pricing-paphos-lca'].forEach((ruleId) => {
      const previous = before.find((row: any) => row.id === ruleId);
      const saved = result.rules.find((row: any) => row.id === ruleId);
      expect(saved).toMatchObject({
        route_id: previous.route_id,
        extra_passenger_fee: 8,
        valid_from: previous.valid_from,
        valid_to: previous.valid_to,
        priority: previous.priority,
        is_active: previous.is_active,
        deposit_base_floor: previous.deposit_base_floor,
      });
    });
  });

  test('writes fixed deposits through exact rules and route-scoped override INSERTs without global writes', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDepositEnabled').check();
    await page.locator('#transportPairPricingDepositMode').selectOption('fixed_amount');
    await page.locator('#transportPairPricingDepositValue').fill('25');
    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('[data-review-step="deposit_outbound"]')).toContainText('INSERT');
    await expect(page.locator('[data-review-step="deposit_reverse"]')).toContainText('INSERT');
    await clearTransportMutationCalls(page);
    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();

    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        rules: stub.getTableRows('transport_pricing_rules'),
        overrides: stub.getTableRows('service_deposit_overrides'),
        calls: stub.getMutationCalls(),
      };
    });
    ['pricing-lca-paphos', 'pricing-paphos-lca'].forEach((ruleId) => {
      expect(result.rules.find((rule: any) => rule.id === ruleId)).toMatchObject({
        deposit_enabled: true,
        deposit_mode: 'fixed_amount',
        deposit_value: 25,
        deposit_base_floor: 0,
      });
    });
    expect(result.overrides).toHaveLength(2);
    expect(result.overrides.map((override: any) => override.resource_id).sort()).toEqual([
      'route-lca-paphos',
      'route-paphos-lca',
    ]);
    result.overrides.forEach((override: any) => expect(override).toMatchObject({
      resource_type: 'transport',
      mode: 'flat',
      amount: 25,
      currency: 'EUR',
      include_children: true,
      enabled: true,
    }));
    expect(exactMutationIds(result.calls, 'transport_pricing_rules').sort()).toEqual([
      'pricing-lca-paphos',
      'pricing-paphos-lca',
    ]);
    const overrideInserts = result.calls.filter((call: any) => (
      call.table === 'service_deposit_overrides' && call.action === 'insert'
    ));
    expect(overrideInserts).toHaveLength(2);
    expect(overrideInserts.flatMap((call: any) => call.payload)
      .map((payload: any) => payload.resource_id).sort()).toEqual([
      'route-lca-paphos',
      'route-paphos-lca',
    ]);
    expect(result.calls.some((call: any) => call.table === 'service_deposit_rules')).toBe(false);
  });

  test('saves a reverse-missing pair as A→B only without creating a route or pricing rule', async ({ page }) => {
    await openTransportAdmin(page);
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('transport_routes', stub.getTableRows('transport_routes').map((route: any) => (
        route.id === 'route-lca-limassol'
          ? { ...route, updated_at: '2026-08-01T08:20:00.000Z' }
          : route
      )));
    });
    await runRouteAction(page, 'route-lca-limassol', 'pricing');
    await expect(page.locator('#transportPairPricingScopeOutbound')).toBeChecked();
    await page.locator('#transportPairPricingDayPrice').fill('60');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await confirmPairPricingSave(page);

    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    await expect(page.locator('.transport-pair-pricing-modal__receipt')).toContainText('route-lca-limassol');
    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        calls: stub.getMutationCalls(),
      };
    });
    expect(exactMutationIds(result.calls, 'transport_routes')).toEqual(['route-lca-limassol']);
    expect(result.routes.find((route: any) => route.id === 'route-lca-limassol')?.day_price).toBe(60);
    expect(result.routes).toHaveLength(3);
    expect(result.calls.some((call: any) => (
      call.action === 'insert' && ['transport_routes', 'transport_pricing_rules'].includes(call.table)
    ))).toBe(false);
  });

  test('blocks every mutation when a route changed after Review', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('transport_routes', stub.getTableRows('transport_routes').map((route: any) => (
        route.id === 'route-lca-paphos'
          ? { ...route, updated_at: '2026-08-01T10:00:00.000Z' }
          : route
      )));
      stub.clearMutationCalls();
    });

    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toHaveText(
      'Data changed since Review. Refresh and review the changes again.',
    );
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toBeFocused();
    await expect(page.locator('.transport-pair-pricing-modal__technical-plan')).toContainText('route_updated_at_changed');
    await expect(page.locator('#transportPairPricingModalRefresh')).toHaveText('Refresh data');
    await expect(page.locator('#transportPairPricingBackToEdit')).toBeVisible();
    expect(await getTransportMutationCalls(page)).toEqual([]);
  });

  test('reports an exact zero-row optimistic update as stale without changing data', async ({ page }) => {
    await openTransportAdmin(page);
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('transport_routes', stub.getTableRows('transport_routes').map((route: any) => (
        route.id === 'route-lca-limassol'
          ? { ...route, updated_at: '2026-08-01T08:20:00.000Z' }
          : route
      )));
    });
    await runRouteAction(page, 'route-lca-limassol', 'pricing');
    await page.locator('#transportPairPricingDayPrice').fill('60');
    await page.locator('#transportPairPricingReviewChanges').click();
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.clearMutationCalls();
      stub.failNextMutation({
        table: 'transport_routes',
        action: 'update',
        id: 'route-lca-limassol',
        error: {
          code: 'transport_pair_stale_conflict',
          message: 'Record changed since Review or no longer exists.',
        },
      });
    });

    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toHaveText(
      'Data changed since Review. Refresh and review the changes again.',
    );
    await expect(page.locator('.transport-pair-pricing-modal__technical-plan')).toContainText(
      'transport_pair_stale_conflict',
    );
    expect(await page.evaluate(() => (
      (window as any).__supabaseStub.getTableRows('transport_routes')
        .find((route: any) => route.id === 'route-lca-limassol')?.day_price
    ))).toBe(55);
  });

  test('blocks every mutation when an exact selected rule changed or rule ownership changed', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingExtraPassengerFee').fill('8');
    await page.locator('#transportPairPricingReviewChanges').click();
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('transport_pricing_rules', stub.getTableRows('transport_pricing_rules').map((rule: any) => (
        rule.id === 'pricing-paphos-lca'
          ? { ...rule, route_id: 'route-lca-paphos', updated_at: '2026-08-01T10:05:00.000Z' }
          : rule
      )));
      stub.clearMutationCalls();
    });

    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toContainText('Data changed since Review');
    await expect(page.locator('.transport-pair-pricing-modal__technical-plan')).toContainText('pricing_rule_ownership_changed');
    expect(await getTransportMutationCalls(page)).toEqual([]);
  });

  test('blocks every mutation when the rule count changes after Review', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const rules = stub.getTableRows('transport_pricing_rules');
      stub.seedTable('transport_pricing_rules', [...rules, {
        ...rules.find((rule: any) => rule.id === 'pricing-lca-paphos'),
        id: 'pricing-lca-paphos-after-review',
        priority: 50,
        updated_at: '2026-08-01T10:10:00.000Z',
      }]);
      stub.clearMutationCalls();
    });

    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toContainText('Data changed since Review');
    await expect(page.locator('.transport-pair-pricing-modal__technical-plan')).toContainText('pricing_rule_count_changed');
    expect(await getTransportMutationCalls(page)).toEqual([]);
  });

  test('blocks a planned deposit INSERT when an override appears after Review', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDepositEnabled').check();
    await page.locator('#transportPairPricingDepositMode').selectOption('percent_total');
    await page.locator('#transportPairPricingDepositValue').fill('25');
    await page.locator('#transportPairPricingReviewChanges').click();
    await expect(page.locator('[data-review-step="deposit_outbound"]')).toContainText('INSERT');
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('service_deposit_overrides', [{
        id: 'override-appeared-after-review',
        resource_type: 'transport',
        resource_id: 'route-lca-paphos',
        mode: 'percent_total',
        amount: 25,
        currency: 'EUR',
        include_children: true,
        enabled: true,
        updated_at: '2026-08-01T10:15:00.000Z',
      }]);
      stub.clearMutationCalls();
    });

    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toContainText('Data changed since Review');
    await expect(page.locator('.transport-pair-pricing-modal__technical-plan')).toContainText('deposit_override_count_changed');
    expect(await getTransportMutationCalls(page)).toEqual([]);
  });

  test('keeps exact success/error statuses and the draft after a reverse write fails', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.clearMutationCalls();
      stub.failNextMutation({
        table: 'transport_routes',
        action: 'update',
        id: 'route-paphos-lca',
        error: { code: 'stage_2d_reverse_failed', message: 'Reverse route update failed' },
      });
    });

    await confirmPairPricingSave(page);
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toContainText(
      'Some changes were saved. Retry will only attempt the failed steps.',
    );
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toBeFocused();
    await expect(page.locator('[data-transport-pair-save-step="route_outbound"]')).toHaveAttribute('data-step-status', 'success');
    await expect(page.locator('[data-transport-pair-save-step="route_reverse"]')).toHaveAttribute('data-step-status', 'error');
    await expect(page.locator('#transportPairPricingModalRefresh')).toBeVisible();
    await expect(page.locator('#transportPairPricingReceiptClose')).toBeVisible();
    await expect(page.locator('#transportPairPricingSaveChanges')).toBeHidden();
    await expect(page.locator('#transportPairPricingRetryFailed')).toBeVisible();

    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        routes: stub.getTableRows('transport_routes'),
        calls: stub.getMutationCalls(),
        modalState: (window as any).TransportPairPricingModal.getState(),
      };
    });
    expect(result.routes.find((route: any) => route.id === 'route-lca-paphos')?.day_price).toBe(80);
    expect(result.routes.find((route: any) => route.id === 'route-paphos-lca')?.day_price).toBe(70);
    expect(exactMutationIds(result.calls, 'transport_routes')).toEqual([
      'route-lca-paphos',
      'route-paphos-lca',
    ]);
    expect(result.modalState.draft.shared.dayPrice).toBe('80');
    expect(result.modalState.saveOutcome).toBe('partial');
  });
});

test.describe('Transport Admin Stage 2E partial-save recovery', () => {
  async function failNext(page: any, failure: Record<string, unknown>) {
    await page.evaluate((entry) => {
      (window as any).__supabaseStub.failNextMutation(entry);
    }, failure);
  }

  async function expectPartialRetry(page: any) {
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toHaveText(
      'Some changes were saved. Retry will only attempt the failed steps.',
    );
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toBeFocused();
    await expect(page.locator('#transportPairPricingRetryFailed')).toBeVisible();
    await expect(page.locator('#transportPairPricingRetryFailed')).toBeEnabled();
    await expect(page.locator('.transport-pair-pricing-modal__review-safety')).toContainText('Global changes: 0');
    await expect(page.locator('.transport-pair-pricing-modal__review-safety')).toContainText('Bookings changed: 0');
    await expect(page.locator('.transport-pair-pricing-modal__review-safety')).toContainText(
      'No emails or notifications were sent',
    );
  }

  test('outbound success plus reverse failure retries only reverse and dependency-skipped exact IDs', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    const rpcBefore = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingExtraPassengerFee').fill('8');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await failNext(page, {
      table: 'transport_routes',
      action: 'update',
      id: 'route-paphos-lca',
      error: { code: 'stage_2e_reverse_failed', message: 'Reverse route update failed' },
    });

    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    await expect(page.locator('[data-transport-pair-save-step="route_outbound"]')).toHaveAttribute('data-step-status', 'success');
    await expect(page.locator('[data-transport-pair-save-step="route_reverse"]')).toHaveAttribute('data-step-status', 'error');
    await expect(page.locator('[data-transport-pair-save-step="pricing_outbound"]')).toHaveAttribute('data-step-status', 'success');
    await expect(page.locator('[data-transport-pair-save-step="pricing_reverse"]')).toHaveAttribute('data-step-status', 'skipped');

    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeFocused();
    await expect(page.locator('.transport-pair-pricing-modal__receipt')).toContainText('route-lca-paphos');
    await expect(page.locator('.transport-pair-pricing-modal__receipt')).toContainText('route-paphos-lca');

    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return {
        calls: stub.getMutationCalls(),
        routes: stub.getTableRows('transport_routes'),
        pricing: stub.getTableRows('transport_pricing_rules'),
        rpc: stub.getRpcCalls(),
        state: (window as any).TransportPairPricingModal.getState(),
      };
    });
    const routeCalls = result.calls.filter((call: any) => call.table === 'transport_routes' && call.action === 'update');
    const pricingCalls = result.calls.filter((call: any) => call.table === 'transport_pricing_rules' && call.action === 'update');
    expect(routeCalls.filter((call: any) => call.filters.some((filter: any) => filter.column === 'id' && filter.value === 'route-lca-paphos'))).toHaveLength(1);
    expect(routeCalls.filter((call: any) => call.filters.some((filter: any) => filter.column === 'id' && filter.value === 'route-paphos-lca'))).toHaveLength(2);
    expect(pricingCalls.filter((call: any) => call.filters.some((filter: any) => filter.column === 'id' && filter.value === 'pricing-lca-paphos'))).toHaveLength(1);
    expect(pricingCalls.filter((call: any) => call.filters.some((filter: any) => filter.column === 'id' && filter.value === 'pricing-paphos-lca'))).toHaveLength(1);
    expect(result.routes.filter((route: any) => ['route-lca-paphos', 'route-paphos-lca'].includes(route.id))
      .every((route: any) => route.day_price === 80)).toBe(true);
    expect(result.pricing.filter((rule: any) => ['pricing-lca-paphos', 'pricing-paphos-lca'].includes(rule.id))
      .every((rule: any) => rule.extra_passenger_fee === 8)).toBe(true);
    expect(result.state.savePlan.steps.find((step: any) => step.key === 'route_outbound').attempts).toBe(1);
    expect(result.state.savePlan.steps.find((step: any) => step.key === 'route_reverse').attempts).toBe(2);
    expect(result.state.savePlan.steps.find((step: any) => step.key === 'pricing_outbound').attempts).toBe(1);
    expect(result.calls.filter((call: any) => [
      'transport_bookings', 'service_deposit_rules', 'partners', 'emails', 'notifications', 'payments',
    ].includes(call.table))).toEqual([]);
    expect(result.rpc).toEqual(rpcBefore);
  });

  test('pricing failure after two route successes retries the exact failed rule only', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingExtraPassengerFee').fill('8');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await failNext(page, {
      table: 'transport_pricing_rules', action: 'update', id: 'pricing-lca-paphos',
      error: { code: 'stage_2e_pricing_failed', message: 'Pricing update failed' },
    });

    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    const beforeRetry = await getTransportMutationCalls(page);
    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    const afterRetry = await getTransportMutationCalls(page);

    expect(afterRetry.filter((call: any) => call.table === 'transport_routes')).toHaveLength(
      beforeRetry.filter((call: any) => call.table === 'transport_routes').length,
    );
    expect(afterRetry.filter((call: any) => (
      call.table === 'transport_pricing_rules'
      && call.filters.some((filter: any) => filter.column === 'id' && filter.value === 'pricing-lca-paphos')
    ))).toHaveLength(2);
    expect(afterRetry.filter((call: any) => (
      call.table === 'transport_pricing_rules'
      && call.filters.some((filter: any) => filter.column === 'id' && filter.value === 'pricing-paphos-lca')
    ))).toHaveLength(1);
  });

  test('deposit failure after route and pricing successes retries only the failed exact override INSERT', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingDepositEnabled').check();
    await page.locator('#transportPairPricingDepositMode').selectOption('fixed_amount');
    await page.locator('#transportPairPricingDepositValue').fill('25');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await failNext(page, {
      table: 'service_deposit_overrides', action: 'insert',
      error: { code: 'stage_2e_deposit_failed', message: 'Deposit override write failed' },
    });

    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    const beforeRetry = await getTransportMutationCalls(page);
    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    const afterRetry = await getTransportMutationCalls(page);

    expect(afterRetry.filter((call: any) => call.table === 'transport_routes')).toHaveLength(
      beforeRetry.filter((call: any) => call.table === 'transport_routes').length,
    );
    expect(afterRetry.filter((call: any) => call.table === 'transport_pricing_rules')).toHaveLength(
      beforeRetry.filter((call: any) => call.table === 'transport_pricing_rules').length,
    );
    expect(afterRetry.filter((call: any) => call.table === 'service_deposit_overrides' && call.action === 'insert')).toHaveLength(3);
    const rows = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('service_deposit_overrides'));
    expect(rows).toHaveLength(2);
    expect(rows.map((row: any) => row.resource_id).sort()).toEqual(['route-lca-paphos', 'route-paphos-lca']);
  });

  test('route response loss is reconciled by exact ID without a second update', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await failNext(page, {
      table: 'transport_routes', action: 'update', id: 'route-paphos-lca', afterWrite: true,
      error: { code: 'stage_2e_response_lost', message: 'Write response unavailable after completion' },
    });

    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    const beforeRetry = await getTransportMutationCalls(page);
    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    await expect(page.locator('[data-transport-pair-save-step="route_reverse"]')).toHaveAttribute('data-step-reconciled', 'true');
    await expect(page.locator('[data-transport-pair-save-step="route_reverse"]')).toContainText('RECONCILED');
    expect(await getTransportMutationCalls(page)).toEqual(beforeRetry);
  });

  test('pricing response loss is reconciled by exact rule ID without a second update', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingExtraPassengerFee').fill('8');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await failNext(page, {
      table: 'transport_pricing_rules', action: 'update', id: 'pricing-lca-paphos', afterWrite: true,
      error: { code: 'stage_2e_response_lost', message: 'Write response unavailable after completion' },
    });

    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    const beforeRetry = await getTransportMutationCalls(page);
    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    await expect(page.locator('[data-transport-pair-save-step="pricing_outbound"]')).toHaveAttribute('data-step-reconciled', 'true');
    expect(await getTransportMutationCalls(page)).toEqual(beforeRetry);
  });

  test('deposit INSERT response loss reconciles the matching route override without a duplicate', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDepositEnabled').check();
    await page.locator('#transportPairPricingDepositMode').selectOption('percent_total');
    await page.locator('#transportPairPricingDepositValue').fill('25');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await failNext(page, {
      table: 'service_deposit_overrides', action: 'insert', afterWrite: true,
      error: { code: 'stage_2e_response_lost', message: 'Write response unavailable after completion' },
    });

    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    const beforeRetry = await getTransportMutationCalls(page);
    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    await expect(page.locator('[data-transport-pair-save-step="deposit_outbound"]')).toHaveAttribute('data-step-reconciled', 'true');
    expect(await getTransportMutationCalls(page)).toEqual(beforeRetry);
    expect(await page.evaluate(() => (window as any).__supabaseStub.getTableRows('service_deposit_overrides').length)).toBe(2);
  });

  test('conflicting override blocks Retry before any new mutation', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDepositEnabled').check();
    await page.locator('#transportPairPricingDepositMode').selectOption('fixed_amount');
    await page.locator('#transportPairPricingDepositValue').fill('25');
    await page.locator('#transportPairPricingReviewChanges').click();
    await clearTransportMutationCalls(page);
    await failNext(page, {
      table: 'service_deposit_overrides', action: 'insert',
      error: { code: 'stage_2e_deposit_failed', message: 'Deposit override write failed' },
    });
    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('service_deposit_overrides', [
        ...stub.getTableRows('service_deposit_overrides'),
        {
          id: 'override-conflicting-outbound', resource_type: 'transport', resource_id: 'route-lca-paphos',
          mode: 'flat', amount: 99, currency: 'EUR', include_children: true, enabled: true,
          updated_at: '2026-08-01T12:00:00.000Z',
        },
      ]);
      stub.clearMutationCalls();
    });

    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toHaveText(
      'Data changed after the partial save. Refresh before continuing.',
    );
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toBeFocused();
    await expect(page.locator('.transport-pair-pricing-modal__technical-plan')).toContainText('retry_deposit_insert_conflict');
    await expect(page.locator('#transportPairPricingRetryFailed')).toBeHidden();
    expect(await getTransportMutationCalls(page)).toEqual([]);
  });

  test('a successful route changed after partial save blocks Retry as stale_after_partial', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await failNext(page, {
      table: 'transport_routes', action: 'update', id: 'route-paphos-lca',
      error: { code: 'stage_2e_reverse_failed', message: 'Reverse route update failed' },
    });
    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('transport_routes', stub.getTableRows('transport_routes').map((row: any) => (
        row.id === 'route-lca-paphos'
          ? { ...row, day_price: 81, updated_at: '2026-08-01T12:05:00.000Z' }
          : row
      )));
      stub.clearMutationCalls();
    });

    await page.locator('#transportPairPricingRetryFailed').click();
    await expect(page.locator('#transportPairPricingSaveOutcomeAlert')).toContainText('Data changed after the partial save');
    await expect(page.locator('.transport-pair-pricing-modal__technical-plan')).toContainText('successful_step_changed');
    expect(await page.evaluate(() => (window as any).TransportPairPricingModal.getState().savePlan.status))
      .toBe('stale_after_partial');
    expect(await getTransportMutationCalls(page)).toEqual([]);
  });

  test('double Retry shares one active Promise and sends one reverse request', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await failNext(page, {
      table: 'transport_routes', action: 'update', id: 'route-paphos-lca',
      error: { code: 'stage_2e_reverse_failed', message: 'Reverse route update failed' },
    });
    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    await clearTransportMutationCalls(page);

    await page.locator('#transportPairPricingRetryFailed').evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(page.locator('#transportPairPricingReceiptTitle')).toBeVisible();
    const calls = await getTransportMutationCalls(page);
    expect(calls.filter((call: any) => (
      call.table === 'transport_routes'
      && call.action === 'update'
      && call.filters.some((filter: any) => filter.column === 'id' && filter.value === 'route-paphos-lca')
    ))).toHaveLength(1);
  });

  test('Refresh after partial abandons the old plan and never retries a mutation', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await failNext(page, {
      table: 'transport_routes', action: 'update', id: 'route-paphos-lca',
      error: { code: 'stage_2e_reverse_failed', message: 'Reverse route update failed' },
    });
    await confirmPairPricingSave(page);
    await expectPartialRetry(page);
    await clearTransportMutationCalls(page);

    await page.locator('#transportPairPricingModalRefresh').click();
    await expect(page.locator('#transportPairPricingRecoveryDialog')).toBeVisible();
    await expect(page.locator('#transportPairPricingRecoveryTitle')).toHaveText('Refresh after partial save');
    await expect(page.locator('#transportPairPricingRecoveryMessage')).toHaveText(
      'Refreshing will discard the unsaved part of this plan. Saved changes will remain.',
    );
    await page.locator('#transportPairPricingRecoveryStay').click();
    await expect(page.locator('#transportPairPricingRecoveryDialog')).toBeHidden();
    await expect(page.locator('#transportPairPricingModalRefresh')).toBeFocused();
    await page.locator('#transportPairPricingModalRefresh').click();
    await page.locator('#transportPairPricingRecoveryConfirm').click();
    await expect(page.locator('#transportPairPricingReviewChanges')).toBeVisible();
    await expect(page.locator('#transportPairPricingDayPrice')).toHaveValue('');
    expect(await getTransportMutationCalls(page)).toEqual([]);
    const state = await page.evaluate(() => (window as any).TransportPairPricingModal.getState());
    expect(state.savePlan).toBeNull();
    expect(state.recoveryHistory).toHaveLength(1);
    expect(state.recoveryHistory[0]).toMatchObject({
      reason: 'manual_refresh',
      plan: { status: 'abandoned' },
      succeededStepKeys: ['route_outbound'],
      receipt: {
        records: [{ key: 'route_outbound', id: 'route-lca-paphos', direction: 'outbound' }],
      },
    });
  });

  test('Close after partial uses its own focus-trapped dialog and reopening starts fresh', async ({ page }) => {
    await openMatchingPairForStage2D(page);
    await page.locator('#transportPairPricingDayPrice').fill('80');
    await page.locator('#transportPairPricingReviewChanges').click();
    await failNext(page, {
      table: 'transport_routes', action: 'update', id: 'route-paphos-lca',
      error: { code: 'stage_2e_reverse_failed', message: 'Reverse route update failed' },
    });
    await confirmPairPricingSave(page);
    await expectPartialRetry(page);

    await page.locator('#transportPairPricingReceiptClose').click();
    await expect(page.locator('#transportPairPricingRecoveryDialog')).toBeVisible();
    await expect(page.locator('#transportPairPricingRecoveryTitle')).toHaveText('Some changes were already saved.');
    await expect(page.locator('#transportPairPricingRecoveryTitle')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Escape');
    await expect(page.locator('#transportPairPricingRecoveryDialog')).toBeHidden();
    await expect(page.locator('#transportPairPricingModal')).toBeVisible();
    await expect(page.locator('#transportPairPricingReceiptClose')).toBeFocused();

    await page.locator('#transportPairPricingReceiptClose').click();
    await page.locator('#transportPairPricingRecoveryConfirm').click();
    await expect(page.locator('#transportPairPricingModal')).toBeHidden();
    await runRouteAction(page, 'route-lca-paphos', 'pricing');
    await expect(page.locator('#transportPairPricingModal')).toBeVisible();
    const state = await page.evaluate(() => (window as any).TransportPairPricingModal.getState());
    expect(state.savePlan).toBeNull();
    expect(state.recoveryHistory).toEqual([]);
    expect(state.view).toBe('edit');
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
    await page.evaluate(async () => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('service_deposit_rules', [{
        id: 'transport-deposit-default',
        resource_type: 'transport',
        mode: 'per_person',
        amount: 10,
        currency: 'EUR',
        include_children: true,
        enabled: true,
      }]);
      await (window as any).loadTransportAdminData();
    });
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
    expect(saved.deposit).toMatchObject({ mode: 'flat', amount: 25, include_children: true, enabled: true });
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
