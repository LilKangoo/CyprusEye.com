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
  {
    id: 'route-limassol-larnaca',
    origin_location_id: 'loc-limassol-city',
    destination_location_id: 'loc-larnaca-city',
    day_price: 80,
    night_price: 100,
    currency: 'EUR',
    included_passengers: 4,
    included_bags: 4,
    included_large_bags: 0,
    max_passengers: 8,
    max_bags: 8,
    allows_round_trip: true,
    round_trip_multiplier: 1,
    is_active: true,
    sort_order: 2,
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
  {
    id: 'pricing-route-limassol-larnaca',
    route_id: 'route-limassol-larnaca',
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

async function prepareTransportStub(page: any, pricingRules = TRANSPORT_PRICING_RULES) {
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
        stub.setRpcHandler('service_coupon_quote', async (params: any) => ({
          data: {
            is_valid: String(params?.p_coupon_code || '').toUpperCase() === 'SAVE10',
            message: 'Coupon applied',
            coupon_id: '11111111-1111-4111-8111-111111111111',
            coupon_code: 'SAVE10',
            discount_type: 'fixed',
            discount_value: 10,
            base_total: Number(params?.p_base_total || 0),
            discount_amount: 10,
            final_total: Math.max(Number(params?.p_base_total || 0) - 10, 0),
            currency: 'EUR',
            partner_id: '22222222-2222-4222-8222-222222222222',
            partner_commission_bps_override: 250,
          },
          error: null,
        }));
      },
    };
  }, {
    locations: TRANSPORT_LOCATIONS,
    routes: TRANSPORT_ROUTES,
    pricingRules,
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

async function openTransport(page: any, lang = 'en', pricingRules = TRANSPORT_PRICING_RULES) {
  await prepareTransportStub(page, pricingRules);
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

    const quote = await page.evaluate(() => (window as any).CE_TRANSPORT_BOOKING.getStateSnapshot().lastQuote);
    expect(quote).toMatchObject({
      total: 75,
      currency: 'EUR',
      isBookable: true,
    });

    await page.locator('#transportSubmitBooking').click();
    await expect(page.locator('#transportSubmitSuccess')).toBeVisible();

    const inserted = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('transport_bookings'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      route_id: 'route-larnaca-limassol',
      origin_location_id: 'loc-larnaca-city',
      destination_location_id: 'loc-limassol-city',
      trip_type: 'one_way',
      base_price: 75,
      extras_price: 0,
      total_price: 75,
      currency: 'EUR',
      customer_phone: '+48 123456789',
    });
  });

  test('keeps outbound and return rules separate in the round-trip quote and booking payload', async ({ page }) => {
    await openTransport(page, 'en');
    await completeRequiredTransportForm(page);
    await page.selectOption('#transportTripType', 'round_trip');
    await expect(page.locator('#transportReturnLegSection')).toBeVisible();
    await expect(page.locator('#transportReturnOrigin')).toHaveValue('loc-limassol-city');
    await expect(page.locator('#transportReturnDestination')).toHaveValue('loc-larnaca-city');
    await page.fill('#transportReturnDate', '2026-08-13');
    await page.fill('#transportReturnTime', '14:30');
    await page.fill('#transportReturnPickupAddress', 'Limassol marina return point');
    await page.fill('#transportReturnDropoffAddress', 'Larnaka hotel return point');

    await page.waitForFunction(() => {
      const quote = (window as any).CE_TRANSPORT_BOOKING.getStateSnapshot().lastQuote;
      return quote?.isBookable && quote?.legs?.length === 2 && quote?.total === 155;
    });
    const quote = await page.evaluate(() => (window as any).CE_TRANSPORT_BOOKING.getStateSnapshot().lastQuote);
    expect(quote.legs.map((leg: any) => leg.route.id)).toEqual([
      'route-larnaca-limassol',
      'route-limassol-larnaca',
    ]);
    expect(quote.legs.map((leg: any) => leg.quote.total)).toEqual([75, 80]);
    await page.check('#transportConfirmQuote');
    await page.check('#transportAgreePolicy');
    await expect(page.locator('#transportSubmitBooking')).toBeEnabled();
    await page.locator('#transportSubmitBooking').click();
    await expect(page.locator('#transportSubmitSuccess')).toBeVisible();

    const inserted = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('transport_bookings'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      route_id: 'route-larnaca-limassol',
      trip_type: 'round_trip',
      total_price: 155,
      return_route_id: 'route-limassol-larnaca',
      return_origin_location_id: 'loc-limassol-city',
      return_destination_location_id: 'loc-larnaca-city',
      return_travel_date: '2026-08-13',
      return_travel_time: '14:30',
      return_total_price: 80,
    });
  });

  test('applies a coupon to the public quote and preserves exact coupon booking payload fields', async ({ page }) => {
    await openTransport(page, 'en');
    await completeRequiredTransportForm(page);
    await page.fill('#transportCouponCode', 'save10');
    await page.locator('#transportApplyCoupon').click();
    await expect(page.locator('#transportCouponStatus')).toContainText('Coupon applied');
    await page.waitForFunction(() => (
      (window as any).CE_TRANSPORT_BOOKING.getStateSnapshot().lastQuote?.total === 65
    ));
    const quote = await page.evaluate(() => (window as any).CE_TRANSPORT_BOOKING.getStateSnapshot().lastQuote);
    expect(quote).toMatchObject({
      totalBeforeCoupon: 75,
      total: 65,
      couponId: '11111111-1111-4111-8111-111111111111',
      couponCode: 'SAVE10',
      couponDiscountAmount: 10,
      couponPartnerId: '22222222-2222-4222-8222-222222222222',
      couponPartnerCommissionBps: 250,
    });

    await expect(page.locator('#transportSubmitBooking')).toBeEnabled();
    await page.locator('#transportSubmitBooking').click();
    await expect(page.locator('#transportSubmitSuccess')).toBeVisible();
    const inserted = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('transport_bookings'));
    expect(inserted[0]).toMatchObject({
      total_price: 65,
      coupon_id: '11111111-1111-4111-8111-111111111111',
      coupon_code: 'SAVE10',
      coupon_discount_amount: 10,
      coupon_partner_id: '22222222-2222-4222-8222-222222222222',
      coupon_partner_commission_bps: 250,
    });
  });

  ([
    ['fixed amount', true, 'fixed_amount', 20, 0, 20, 'fixed_amount'],
    ['percent total', true, 'percent_total', 20, 0, 15, 'percent_total'],
    ['per person', true, 'per_person', 10, 0, 20, 'per_person'],
    ['base floor', false, null, 0, 12, 12, 'base_floor'],
  ] as const).forEach(([
    label,
    enabled,
    mode,
    value,
    baseFloor,
    expectedAmount,
    expectedAppliedMode,
  ]) => {
    test(`keeps public deposit regression for ${label}`, async ({ page }) => {
      const pricingRules = TRANSPORT_PRICING_RULES.map((pricingRule) => (
        pricingRule.id === 'pricing-route-larnaca-limassol'
          ? {
            ...pricingRule,
            deposit_enabled: enabled,
            deposit_mode: mode,
            deposit_value: value,
            deposit_base_floor: baseFloor,
          }
          : pricingRule
      ));
      await openTransport(page, 'en', pricingRules);
      await page.selectOption('#transportOrigin', 'loc-larnaca-city');
      await page.selectOption('#transportDestination', 'loc-limassol-city');
      await page.fill('#transportTravelDate', '2026-08-12');
      await page.fill('#transportTravelTime', '13:30');
      await page.waitForFunction((expected) => {
        const quote = (window as any).CE_TRANSPORT_BOOKING.getStateSnapshot().lastQuote;
        return quote?.isBookable && quote?.depositAmount === expected;
      }, expectedAmount);
      const quote = await page.evaluate(() => (window as any).CE_TRANSPORT_BOOKING.getStateSnapshot().lastQuote);
      expect(quote).toMatchObject({
        total: 75,
        depositEnabled: true,
        depositAmount: expectedAmount,
      });
      expect(quote.legs[0].quote.depositAppliedMode).toBe(expectedAppliedMode);
      expect(await page.evaluate(() => (window as any).__supabaseStub.getMutationCalls())).toEqual([]);
    });
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
