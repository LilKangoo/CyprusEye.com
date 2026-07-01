import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const TRANSPORT_LOCATIONS = [
  {
    id: 'loc-larnaca-city',
    name: 'Larnaka',
    name_local: 'Larnaka',
    code: 'LCA_CITY',
    location_type: 'city',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'loc-limassol-city',
    name: 'Limassol',
    name_local: 'Limassol',
    code: 'LIM_CITY',
    location_type: 'city',
    sort_order: 2,
    is_active: true,
  },
];

const TRANSPORT_ROUTES = [
  {
    id: 'route-larnaca-limassol',
    origin_location_id: 'loc-larnaca-city',
    destination_location_id: 'loc-limassol-city',
    day_price: 75,
    night_price: 95,
    currency: 'EUR',
    included_passengers: 4,
    included_bags: 4,
    included_large_bags: 0,
    max_passengers: 8,
    max_bags: 8,
    allows_round_trip: true,
    round_trip_multiplier: 1,
    is_active: true,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

const TRANSPORT_PRICING_RULES = [
  {
    id: 'pricing-route-larnaca-limassol',
    route_id: 'route-larnaca-limassol',
    extra_passenger_fee: 0,
    extra_bag_fee: 0,
    oversize_bag_fee: 0,
    child_seat_fee: 0,
    booster_seat_fee: 0,
    waiting_included_minutes: 0,
    waiting_fee_per_hour: 0,
    waiting_fee_per_minute: 0,
    night_start: '22:00',
    night_end: '06:00',
    valid_from: null,
    valid_to: null,
    priority: 1,
    is_active: true,
    deposit_enabled: false,
    deposit_mode: null,
    deposit_value: null,
    deposit_base_floor: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

async function prepareTransportStub(page: any) {
  await page.addInitScript((seed) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        stub.seedTable('transport_locations', seed.locations);
        stub.seedTable('transport_routes', seed.routes);
        stub.seedTable('transport_pricing_rules', seed.pricingRules);
        stub.seedTable('transport_bookings', []);
      },
    };
  }, {
    locations: TRANSPORT_LOCATIONS,
    routes: TRANSPORT_ROUTES,
    pricingRules: TRANSPORT_PRICING_RULES,
  });
  await enableSupabaseStub(page);
  await page.route('**/transport/booking', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'local endpoint unavailable' }),
    });
  });
}

async function openTransport(page: any, lang = 'en') {
  await prepareTransportStub(page);
  await page.goto(`/transport.html?lang=${lang}`);
  await waitForSupabaseStub(page);
  await expect(page.locator('#transportCustomerPhoneCountryButton')).toBeVisible();
  await expect(page.locator('#transportOrigin option')).toHaveCount(3);
}

async function openHomeTransport(page: any, lang = 'en') {
  await prepareTransportStub(page);
  await page.goto(`/index.html?lang=${lang}`);
  await waitForSupabaseStub(page);
  await page.locator('#homeTransportBookingPanel').scrollIntoViewIfNeeded();
  await expect(page.locator('#transportOrigin option')).toHaveCount(3, { timeout: 10000 });
  await page.selectOption('#transportOrigin', 'loc-larnaca-city');
  await page.selectOption('#transportDestination', 'loc-limassol-city');
  await page.fill('#transportTravelDate', '2026-08-12');
  await page.fill('#transportTravelTime', '13:30');
  await page.waitForFunction(() => {
    const api = (window as any).CE_TRANSPORT_BOOKING;
    const snapshot = api?.getStateSnapshot?.();
    return Boolean(snapshot?.hasRoute && snapshot?.lastQuote?.isBookable);
  });
  await page.locator('#transportStepRoute [data-home-transport-next]').click();
  await expect(page.locator('#transportStepPassengers')).toBeVisible();
  await page.locator('#transportStepPassengers [data-home-transport-next]').click();
  await expect(page.locator('#transportStepContact')).toBeVisible();
  await expect(page.locator('#transportCustomerPhoneCountryButton')).toBeVisible({ timeout: 10000 });
}

async function searchAndSelectCountry(page: any, query: string, expectedDialCode: string) {
  await page.locator('#transportCustomerPhoneCountryButton').click();
  await page.locator('#transportCustomerPhoneCountrySearch').fill(query);
  const option = page.locator('#transportCustomerPhoneCountryResults [data-phone-country-option]', {
    hasText: expectedDialCode,
  }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('#transportCustomerPhoneCountryButton')).toContainText(expectedDialCode);
}

async function completeRequiredTransportForm(page: any) {
  await page.selectOption('#transportOrigin', 'loc-larnaca-city');
  await page.selectOption('#transportDestination', 'loc-limassol-city');
  await page.fill('#transportTravelDate', '2026-08-12');
  await page.fill('#transportTravelTime', '13:30');
  await page.fill('#transportCustomerName', 'Transport Guest');
  await page.fill('#transportCustomerEmail', 'transport.guest@example.com');
  await searchAndSelectCountry(page, 'Poland', '+48');
  await page.fill('#transportCustomerPhoneLocal', '+48 123456789');
  await page.fill('#transportPickupAddress', 'Larnaka hotel lobby');
  await page.fill('#transportDropoffAddress', 'Limassol marina');
  await page.check('#transportConfirmQuote');
  await page.check('#transportAgreePolicy');
  await expect(page.locator('#transportSubmitBooking')).toBeEnabled();
}

test.describe('Transport booking phone country selector', () => {
  test('renders searchable country selector on transport page', async ({ page }) => {
    await openTransport(page, 'en');

    const row = page.locator('.transport-field--phone .ce-phone-input');
    await expect(row).toBeVisible();
    await page.locator('#transportCustomerPhoneCountryButton').click();
    const countryOptionCount = await page.locator('#transportCustomerPhoneCountryResults [data-phone-country-option]').count();
    expect(countryOptionCount).toBeGreaterThan(4);
    await page.locator('#transportCustomerPhoneCountrySearch').fill('Cyprus');
    await expect(page.locator('#transportCustomerPhoneCountryResults [data-phone-country-option]', { hasText: '+357' }).first()).toBeVisible();
    await page.locator('#transportCustomerPhoneCountrySearch').fill('+44');
    await expect(page.locator('#transportCustomerPhoneCountryResults [data-phone-country-option]', { hasText: 'United Kingdom' }).first()).toBeVisible();
    await page.locator('#transportCustomerPhoneCountrySearch').fill('Germany');
    await expect(page.locator('#transportCustomerPhoneCountryResults [data-phone-country-option]', { hasText: '+49' }).first()).toBeVisible();
  });

  test('renders transport phone selector on home transport form', async ({ page }) => {
    await openHomeTransport(page, 'en');

    await expect(page.locator('#transportCustomerPhoneCountryButton')).toBeVisible();
    await searchAndSelectCountry(page, 'Poland', '+48');
  });

  test('submits full customer_phone while keeping local input separate', async ({ page }) => {
    await openTransport(page, 'en');
    await completeRequiredTransportForm(page);

    await page.locator('#transportSubmitBooking').click();
    await expect(page.locator('#transportSubmitSuccess')).toBeVisible();

    const inserted = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('transport_bookings'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].customer_phone).toBe('+48 123456789');
  });

  test('blocks submit without local phone number or country code', async ({ page }) => {
    await openTransport(page, 'en');
    await completeRequiredTransportForm(page);

    await page.fill('#transportCustomerPhoneLocal', '');
    await page.locator('#transportSubmitBooking').click();
    await expect(page.locator('#transportQuoteStatus')).toContainText('Phone number is required');

    await page.fill('#transportCustomerPhoneLocal', '123456789');
    await page.evaluate(() => {
      const input = document.querySelector('#transportCustomerPhone') as any;
      input?.__cePhoneInputController?.clearCountry?.();
    });
    await page.locator('#transportSubmitBooking').click();
    await expect(page.locator('#transportQuoteStatus')).toContainText('Country code is required');
  });

  test('keeps compact phone row inside mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await openTransport(page, 'en');

    const fitsViewport = await page.locator('.transport-field--phone .ce-phone-input').evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= -1 && box.right <= window.innerWidth + 1;
    });
    expect(fitsViewport).toBe(true);
  });

  test('supports Hebrew RTL copy on transport page', async ({ page }) => {
    await openTransport(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#transportCustomerPhoneCountryButton')).toBeVisible();
    await page.locator('#transportCustomerPhoneCountryButton').click();
    await expect(page.locator('#transportCustomerPhoneCountrySearch')).toHaveAttribute('placeholder', /מדינה|קוד/);
  });
});
