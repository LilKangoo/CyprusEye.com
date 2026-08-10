import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PROFILE_LARNACA = 'hybrid-profile-larnaca';
const PROFILE_PAPHOS = 'hybrid-profile-paphos';
const CITY_LARNACA = 'hybrid-city-larnaca';
const CITY_PAPHOS = 'hybrid-city-paphos';
const CITY_AYIA_NAPA = 'hybrid-city-ayia-napa';
const LEGACY_LARNACA = 'hybrid-legacy-larnaca';
const LEGACY_PAPHOS = 'hybrid-legacy-paphos';
const MAPPED_LARNACA = 'hybrid-mapped-larnaca';
const MAPPED_PAPHOS = 'hybrid-mapped-paphos';
const ASYMMETRIC_LARNACA = 'hybrid-asymmetric-larnaca';
const THRESHOLD_OFFER = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
const SPEED_BIKES_PARTNER = '583ee90b-d77c-47ff-97a4-76657a87809f';
const DUPLICATE_LEGACY_OFFER = 'ca3e0000-0000-4000-8000-000000000002';

function car(id: string, location: 'larnaca' | 'paphos', mode: 'legacy' | 'mapped', daily: number, sortOrder: number) {
  const paphos = location === 'paphos';
  return {
    id,
    location,
    pricing_strategy: 'legacy_compat',
    pricing_profile_id: paphos ? PROFILE_PAPHOS : PROFILE_LARNACA,
    availability_mode: mode,
    is_available: true, is_published: true, north_allowed: !paphos, submission_status: 'approved',
    sort_order: sortOrder, stock_count: 1, max_passengers: 5, max_luggage: 2,
    car_model: { pl: id, en: id, he: id },
    car_type: { pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' },
    description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
    features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
    transmission: 'automatic', fuel_type: 'petrol', image_url: '/assets/cyprus_logo-128.png',
    price_per_day: paphos ? daily : daily,
    price_3days: paphos ? daily * 3 : daily * 3,
    price_4_6days: daily,
    price_7_10days: Math.max(1, daily - 3),
    price_10plus_days: Math.max(1, daily - 5),
    deposit_amount: paphos ? 350 : 200,
    insurance_per_day: 17,
    young_driver_fee: !paphos,
    young_driver_cost: paphos ? 0 : 10,
    owner_partner_id: paphos ? 'hybrid-partner-paphos' : 'hybrid-partner-larnaca',
  };
}

const offers = [
  car(LEGACY_LARNACA, 'larnaca', 'legacy', 39, 10),
  car(LEGACY_PAPHOS, 'paphos', 'legacy', 75, 10),
  car(MAPPED_LARNACA, 'larnaca', 'mapped', 25, 30),
  car(MAPPED_PAPHOS, 'paphos', 'mapped', 65, 20),
  car(ASYMMETRIC_LARNACA, 'larnaca', 'mapped', 28, 40),
];

const tables = {
  car_offers: offers,
  car_rental_cities: [
    { id: CITY_LARNACA, code: 'larnaca', name_i18n: { en: 'Larnaca' }, is_active: true, sort_order: 1 },
    { id: CITY_AYIA_NAPA, code: 'ayia-napa', name_i18n: { en: 'Ayia Napa' }, is_active: true, sort_order: 3 },
    { id: CITY_PAPHOS, code: 'paphos', name_i18n: { en: 'Paphos' }, is_active: true, sort_order: 6 },
  ],
  car_pricing_profiles: [
    { id: PROFILE_LARNACA, code: 'larnaca', name: 'Larnaca', calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true },
    { id: PROFILE_PAPHOS, code: 'paphos', name: 'Paphos', calculator_key: 'paphos', legacy_booking_location: 'paphos', is_active: true },
  ],
  car_pricing_profile_cities: [
    { pricing_profile_id: PROFILE_LARNACA, city_id: CITY_LARNACA, pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'larnaca', is_active: true },
    { pricing_profile_id: PROFILE_LARNACA, city_id: CITY_PAPHOS, pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true },
    { pricing_profile_id: PROFILE_PAPHOS, city_id: CITY_PAPHOS, pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true },
  ],
  car_offer_city_availability: [
    { offer_id: MAPPED_LARNACA, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: MAPPED_LARNACA, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: MAPPED_PAPHOS, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: ASYMMETRIC_LARNACA, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: false, is_active: true },
    { offer_id: ASYMMETRIC_LARNACA, city_id: CITY_LARNACA, pickup_enabled: false, return_enabled: true, is_active: true },
  ],
};

function ownSourceErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|chrome-extension|contentscript/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

async function seedHybrid(page: Page, flagEnabled: boolean, failMappedRead = false, injectGlobal = true, mappedPaphosFeeOverride: number | null = null) {
  await page.addInitScript(({ fixtureTables, enabled, failRead, withGlobal, feeOverride, mappedOfferId, paphosCityId }) => {
    const root = window as any;
    if (withGlobal) root.CE_CAR_MULTICITY_SHADOW_CONFIG = { enabled: true, renderMapped: true, debounceMs: 0 };
    else delete root.CE_CAR_MULTICITY_SHADOW_CONFIG;
    root.__hybridEvents = [];
    window.addEventListener('ce:car-multicity-hybrid-ready', (event: Event) => {
      root.__hybridEvents.push((event as CustomEvent).detail);
    });
    const seed = (stub: any) => {
      if (!stub || typeof stub.seedTable !== 'function') return;
      stub.reset?.();
      for (const [table, rows] of Object.entries(fixtureTables)) {
        const nextRows = table === 'car_offer_city_availability' && feeOverride !== null
          ? (rows as any[]).map((row: any) => row.offer_id === mappedOfferId && row.city_id === paphosCityId
            ? { ...row, fee_mode: 'override', fee_per_direction: feeOverride }
            : row)
          : rows;
        stub.seedTable(table, nextRows);
      }
      stub.seedTable('site_settings', [{ id: 1, car_multi_city_mapped_enabled: enabled }]);
      if (failRead) stub.selectErrorsByTable = { car_rental_cities: 'isolated mapped catalog unavailable' };
    };
    const existing = root.__supabaseStub || {};
    const previousOnReady = existing.onReady;
    existing.onReady = (stub: any) => {
      previousOnReady?.(stub);
      seed(stub);
    };
    root.__supabaseStub = existing;
    seed(existing);
  }, {
    fixtureTables: tables,
    enabled: flagEnabled,
    failRead: failMappedRead,
    withGlobal: injectGlobal,
    feeOverride: mappedPaphosFeeOverride,
    mappedOfferId: MAPPED_LARNACA,
    paphosCityId: CITY_PAPHOS,
  });
}

async function seedThresholdHybrid(page: Page) {
  const thresholdOffer = {
    ...car(THRESHOLD_OFFER, 'larnaca', 'mapped', 999, 5),
    pricing_strategy: 'threshold_daily_rate',
    car_model: { pl: 'Snipper FX', en: 'Snipper FX', he: 'Snipper FX' },
    car_type: { pl: 'Buggy', en: 'Buggy', he: 'באגי' },
    features: { pl: ['Kask w cenie'], en: ['Helmet included'], he: ['קסדה כלולה'] },
    transmission: 'automatic',
    fuel_type: 'petrol',
    engine_capacity_cc: 400,
    required_licence_category: 'B',
    minimum_driver_age: 18,
    max_passengers: 2,
    max_luggage: null,
    min_rental_days: 1,
    max_rental_days: null,
    insurance_mode: 'included',
    insurance_per_day: 0,
    deposit_amount: null,
    young_driver_fee: false,
    young_driver_cost: 0,
    owner_partner_id: SPEED_BIKES_PARTNER,
  };
  const fixtureTables = {
    ...tables,
    car_offers: [...tables.car_offers, thresholdOffer],
    car_offer_city_availability: [
      ...tables.car_offer_city_availability,
      {
        offer_id: THRESHOLD_OFFER,
        city_id: CITY_AYIA_NAPA,
        pickup_enabled: true,
        return_enabled: true,
        is_active: true,
        fee_mode: 'override',
        fee_per_direction: 0,
      },
    ],
    car_offer_daily_rate_tiers: [
      { id: 'fd35502d-b51f-586a-ae2d-91f9d81d9193', offer_id: THRESHOLD_OFFER, threshold_days: 1, daily_rate: 110, is_active: true },
      { id: '2d269821-df05-52cc-ba43-a1a8d6fcc8fe', offer_id: THRESHOLD_OFFER, threshold_days: 2, daily_rate: 95, is_active: true },
      { id: '75d525c1-d2f2-520a-919d-cd978344c990', offer_id: THRESHOLD_OFFER, threshold_days: 3, daily_rate: 90, is_active: true },
      { id: 'f307bd4e-9b09-5ead-b7ec-1341164abfae', offer_id: THRESHOLD_OFFER, threshold_days: 4, daily_rate: 85, is_active: true },
      { id: '300da3f7-7cc6-5b3f-a870-1643879f5aed', offer_id: THRESHOLD_OFFER, threshold_days: 5, daily_rate: 80, is_active: true },
      { id: '6bf87b99-57f9-54a5-9167-9fcb5b7a3362', offer_id: THRESHOLD_OFFER, threshold_days: 6, daily_rate: 75, is_active: true },
      { id: '9315e769-d8c4-5b99-967f-6d54e4a5b0de', offer_id: THRESHOLD_OFFER, threshold_days: 7, daily_rate: 70, is_active: true },
    ],
    car_bookings: [],
    partners: [{
      id: SPEED_BIKES_PARTNER,
      business_name: 'Speed Bikes',
      status: 'active',
      can_manage_cars: true,
    }],
    service_deposit_overrides: [{
      id: '6ae5563c-7c97-50f7-8646-b5ae007a6960',
      resource_type: 'cars',
      resource_id: THRESHOLD_OFFER,
      mode: 'percent_total',
      amount: 15,
      enabled: true,
    }],
  };

  await page.addInitScript(({ seededTables, seededThresholdOfferId }) => {
    const root = window as any;
    delete root.CE_CAR_MULTICITY_SHADOW_CONFIG;
    const seed = (stub: any) => {
      if (!stub || typeof stub.seedTable !== 'function') return;
      stub.reset?.();
      for (const [table, rows] of Object.entries(seededTables)) stub.seedTable(table, rows);
      stub.seedTable('site_settings', [{
        id: 1,
        car_multi_city_mapped_enabled: true,
        car_threshold_daily_rates_enabled: true,
      }]);
      stub.setRpcHandler?.('resolve_public_threshold_offer_ids', async () => ({
        data: [{ offer_id: seededThresholdOfferId }],
        error: null,
      }));
      stub.setRpcHandler?.('car_coupon_quote', async (params: any) => ({
        data: [{
          is_valid: true,
          message: 'Coupon applied',
          coupon_id: 'coupon-public-ui',
          coupon_code: String(params.p_coupon_code || '').toUpperCase(),
          discount_type: 'fixed',
          discount_value: 10,
          base_rental_price: Number(params.p_base_rental_price || 0),
          discount_amount: 10,
          final_rental_price: Number(params.p_base_rental_price || 0) - 10,
          currency: 'EUR',
          partner_id: null,
          partner_commission_bps_override: null,
        }],
        error: null,
      }));
      stub.setRpcHandler?.('validate_referral_code_public', async (params: any) => ({
        data: { ok: true, referral_code: String(params.p_code || ''), matched_by: 'code' },
        error: null,
      }));
      stub.setRpcHandler?.('resolve_car_threshold_authoritative_quote', async (params: any) => {
        const pickupAt = new Date(`${params.p_pickup_date}T${params.p_pickup_time || '10:00'}:00Z`);
        const returnAt = new Date(`${params.p_return_date}T${params.p_return_time || '10:00'}:00Z`);
        const rentalDays = Math.ceil((returnAt.getTime() - pickupAt.getTime()) / 86400000);
        const tiers = [
          { thresholdDays: 1, dailyRate: 110, tierId: 'fd35502d-b51f-586a-ae2d-91f9d81d9193' },
          { thresholdDays: 2, dailyRate: 95, tierId: '2d269821-df05-52cc-ba43-a1a8d6fcc8fe' },
          { thresholdDays: 3, dailyRate: 90, tierId: '75d525c1-d2f2-520a-919d-cd978344c990' },
          { thresholdDays: 4, dailyRate: 85, tierId: 'f307bd4e-9b09-5ead-b7ec-1341164abfae' },
          { thresholdDays: 5, dailyRate: 80, tierId: '300da3f7-7cc6-5b3f-a870-1643879f5aed' },
          { thresholdDays: 6, dailyRate: 75, tierId: '6bf87b99-57f9-54a5-9167-9fcb5b7a3362' },
          { thresholdDays: 7, dailyRate: 70, tierId: '9315e769-d8c4-5b99-967f-6d54e4a5b0de' },
        ];
        const selected = [...tiers].reverse().find((tier) => tier.thresholdDays <= rentalDays)!;
        const base = Number((selected.dailyRate * rentalDays).toFixed(2));
        return ({
        data: [{
          quote_valid: true,
          offer_id: params.p_offer_id,
          pricing_strategy: 'threshold_daily_rate',
          tier_id: selected.tierId,
          threshold_days: selected.thresholdDays,
          rental_days: rentalDays,
          daily_rate: selected.dailyRate,
          rental_base_price: base,
          pickup_location_fee: 0,
          return_location_fee: 0,
          insurance_selected: false,
          insurance_mode: 'included',
          insurance_daily_rate: 0,
          insurance_cost: 0,
          young_driver_selected: false,
          young_driver_daily_rate: 0,
          young_driver_cost: 0,
          pre_discount_total: base,
          coupon_id: null,
          coupon_code: null,
          discount_amount: 0,
          final_rental_price: base,
          currency: 'EUR',
          coupon_partner_id: null,
          coupon_partner_commission_bps: null,
          pricing_snapshot: {
            version: 'car-threshold-authoritative-v1',
            pricing_strategy: 'threshold_daily_rate',
            offer_id: params.p_offer_id,
            tier_id: selected.tierId,
            threshold_days: selected.thresholdDays,
            daily_rate: selected.dailyRate,
            rental_days: rentalDays,
            base_rental_price: base,
            pickup_city_code: 'ayia-napa',
            return_city_code: 'ayia-napa',
            pickup_location_fee: 0,
            return_location_fee: 0,
            insurance_cost: 0,
            young_driver_cost: 0,
            pre_discount_total: base,
            discount_amount: 0,
            final_rental_price: base,
            currency: 'EUR',
          },
        }],
        error: null,
      });
      });
    };
    const existing = root.__supabaseStub || {};
    const previousOnReady = existing.onReady;
    existing.onReady = (stub: any) => {
      previousOnReady?.(stub);
      seed(stub);
    };
    root.__supabaseStub = existing;
    seed(existing);
  }, { seededTables: fixtureTables, seededThresholdOfferId: THRESHOLD_OFFER });
}

async function configureCarPage(
  page: Page,
  pickup: string,
  ret: string,
  returnDate = '2026-09-14',
) {
  await page.evaluate(() => {
    delete (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
    delete (window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__;
  });
  await page.locator('#pickupDate').fill('2026-09-10');
  await page.locator('#pickupTime').fill('10:00');
  await page.locator('#returnDate').fill(returnDate);
  await page.locator('#returnTime').fill('10:00');
  await page.locator('#rentalPassengers').fill('2');
  await page.locator('#pickupLocation').selectOption(pickup);
  await page.locator('#returnLocation').selectOption(ret);
  const expectedLocation = pickup === 'paphos' && ret === 'paphos' ? 'paphos' : 'larnaca';
  await page.waitForFunction((value) => document.body?.dataset?.carLocation === value, expectedLocation);
  await page.waitForFunction(({ expectedPickup, expectedReturn }) => {
    const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
    const contexts = (result?.renderedOffers || []).map((row: any) => row.pricingContext).filter(Boolean);
    return result && (!result.featureFlagEnabled || contexts.every((entry: any) => (
      entry.pickupCityCode === expectedPickup && entry.returnCityCode === expectedReturn
    )));
  }, { expectedPickup: pickup, expectedReturn: ret });
}

async function configureHomepage(
  page: Page,
  pickup: string,
  ret: string,
  returnDate = '2026-09-14',
) {
  await page.evaluate(() => {
    delete (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
    delete (window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__;
  });
  await page.locator('#carsFinderPickupDate').fill('2026-09-10');
  await page.locator('#carsFinderPickupTime').fill('10:00');
  await page.locator('#carsFinderReturnDate').fill(returnDate);
  await page.locator('#carsFinderReturnTime').fill('10:00');
  await page.locator('#carsFinderPassengers').fill('2');
  await page.locator('#carsFinderPickupLocation').selectOption(pickup);
  await page.locator('#carsFinderReturnLocation').selectOption(ret);
  await page.waitForFunction(({ expectedPickup, expectedReturn }) => {
    const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
    const contexts = (result?.renderedOffers || []).map((row: any) => row.pricingContext).filter(Boolean);
    return result && (!result.featureFlagEnabled || contexts.every((entry: any) => (
      entry.pickupCityCode === expectedPickup && entry.returnCityCode === expectedReturn
    )));
  }, { expectedPickup: pickup, expectedReturn: ret });
}

async function requestSafetySnapshot(page: Page) {
  return page.evaluate(() => ({
    mutations: (window as any).__supabaseStub?.getMutationCalls?.() || [],
    rpc: ((window as any).__supabaseStub?.getRpcCalls?.() || [])
      .filter((call: any) => call.name !== 'resolve_public_threshold_offer_ids'),
  }));
}

test.describe('Car Rental Multi-City Stage 2E public hybrid rendering', () => {
  test('threshold vehicle uses explicit deposit claims and compact coupon/referral tools responsively', async ({ page }) => {
    await seedThresholdHybrid(page);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'ayia-napa', 'ayia-napa', '2026-09-17');
    await page.locator(`[data-select-car-offer-id="${THRESHOLD_OFFER}"]`).click();

    const tools = page.locator('[data-car-optional-tools]');
    const coupon = page.locator('[data-car-optional-panel="coupon"]');
    const referral = page.locator('[data-car-optional-panel="referral"]');
    await expect(tools).toBeVisible();
    await expect(coupon).not.toHaveAttribute('open', '');
    await expect(referral).not.toHaveAttribute('open', '');
    expect(await tools.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(2);

    await coupon.locator('summary').click();
    await page.locator('#res_coupon_code').fill('SAVE10');
    await page.locator('#btnApplyCoupon').click();
    await expect(coupon.locator('summary')).toContainText('✓ Coupon SAVE10');
    await coupon.locator('summary').click();
    await coupon.locator('summary').click();
    await expect(page.locator('#res_coupon_code')).toHaveValue('SAVE10');
    await expect(page.locator('#btnClearCoupon')).toBeVisible();
    await page.locator('#btnClearCoupon').click();
    await expect(coupon.locator('summary')).toHaveText('I have a coupon code');

    await referral.locator('summary').click();
    await page.locator('#res_referral_code').fill('FRIEND');
    await page.locator('#res_referral_code').blur();
    await expect(referral.locator('summary')).toContainText('✓ Referral: FRIEND');
    await referral.locator('summary').click();
    await referral.locator('summary').click();
    await expect(page.locator('#res_referral_code')).toHaveValue('FRIEND');
    await expect(page.locator('#carReferralClear')).toBeVisible();
    await page.locator('#carReferralClear').click();
    await expect(referral.locator('summary')).toHaveText('I have a referral code');

    await page.locator('#carHomeModal .modal-close').click();
    await page.locator(`[data-select-car-offer-id="${THRESHOLD_OFFER}"]`).click();
    const reopenedReferral = page.locator('[data-car-optional-panel="referral"]');
    await reopenedReferral.locator('summary').click();
    await page.locator('#res_referral_code').fill('REOPENED');
    await page.locator('#res_referral_code').blur();
    await expect(reopenedReferral.locator('summary')).toContainText('✓ Referral: REOPENED');

    await page.locator('#res_full_name').fill('Referral Lifecycle');
    await page.locator('#res_email').fill('referral-lifecycle@example.test');
    await page.locator('#res_phone_local').fill('99111222');
    await page.locator('#btnSubmitReservation').click();
    await expect(page.locator('#reservationSuccess')).toBeVisible();
    await expect(page.locator('#res_referral_code')).toHaveValue('');
    await expect(reopenedReferral.locator('summary')).toHaveText('I have a referral code');

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator('[data-car-optional-tools]').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });

  test('exact Snipper uses one 7-day quote on car.html and homepage and remains a pending request', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedThresholdHybrid(page);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'ayia-napa', 'ayia-napa', '2026-09-17');

    const carPage = await page.evaluate((offerId) => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      const offer = result.renderedOffers.find((entry: any) => entry.id === offerId);
      return {
        featureFlagEnabled: result.featureFlagEnabled,
        thresholdFeatureFlagEnabled: result.thresholdFeatureFlagEnabled,
        quote: offer?.quote,
        context: offer?.pricingContext,
        orderedTotals: result.renderedOffers.map((entry: any) => entry.quote.total),
      };
    }, THRESHOLD_OFFER);
    expect(carPage.featureFlagEnabled).toBe(true);
    expect(carPage.thresholdFeatureFlagEnabled).toBe(true);
    expect(carPage.quote).toEqual(expect.objectContaining({
      days: 7,
      thresholdDays: 7,
      dailyRate: 70,
      basePrice: 490,
      pickupFee: 0,
      returnFee: 0,
      total: 490,
    }));
    expect(carPage.context).toEqual(expect.objectContaining({
      offerId: THRESHOLD_OFFER,
      availabilityMode: 'mapped',
      pricingStrategy: 'threshold_daily_rate',
      legacyBookingLocation: 'larnaca',
      pickupCityCode: 'ayia-napa',
      returnCityCode: 'ayia-napa',
    }));
    expect(carPage.orderedTotals).toEqual([...carPage.orderedTotals].sort((left, right) => left - right));
    await expect(page.locator(`[data-select-car-offer-id="${THRESHOLD_OFFER}"] .auto-card-price`)).toContainText('490.00');
    await expect(page.locator(`[data-select-car-offer-id="${THRESHOLD_OFFER}"] [data-security-deposit-state]`)).toHaveCount(0);
    await page.locator(`[data-select-car-offer-id="${THRESHOLD_OFFER}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', THRESHOLD_OFFER);
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('490.00');
    await expect(page.locator('.ce-car-home-hero-badges')).not.toContainText('AC');
    await expect(page.locator('.ce-car-home-hero-badges')).not.toContainText('5 seats');
    await expect(page.locator('.ce-car-home-details')).toContainText('Minimum age');
    await expect(page.locator('.ce-car-home-details')).toContainText('18+');
    await expect(page.locator('#res_child_seats')).toHaveCount(0);
    await expect(page.locator('#res_young_driver')).toHaveCount(0);
    await expect(page.locator('.ce-car-home-hero-badges [data-security-deposit-state]')).toHaveCount(0);
    await expect(page.getByText('Insurance included', { exact: true })).toBeVisible();
    await page.locator('#res_full_name').fill('Threshold Request');
    await page.locator('#res_email').fill('threshold-request@example.test');
    await page.locator('#res_phone_local').fill('99111222');
    await page.locator('#btnSubmitReservation').click();
    await expect.poll(async () => page.evaluate(() => (
      (window as any).__supabaseStub?.getTableRows?.('car_bookings')?.length || 0
    )), { timeout: 15000 }).toBe(1);
    const bookingRequest = await page.evaluate((offerId) => ({
      booking: (window as any).__supabaseStub?.getTableRows?.('car_bookings')?.[0] || null,
      authoritativeCalls: ((window as any).__supabaseStub?.getRpcCalls?.() || [])
        .filter((call: any) => call.name === 'resolve_car_threshold_authoritative_quote'),
      exactOffer: ((window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__?.renderedOffers || [])
        .find((offer: any) => offer.id === offerId) || null,
      depositOverride: ((window as any).__supabaseStub?.getTableRows?.('service_deposit_overrides') || [])
        .find((row: any) => row.resource_type === 'cars' && row.resource_id === offerId) || null,
      partner: ((window as any).__supabaseStub?.getTableRows?.('partners') || [])
        .find((row: any) => row.id === '583ee90b-d77c-47ff-97a4-76657a87809f') || null,
    }), THRESHOLD_OFFER);
    expect(bookingRequest.authoritativeCalls).toHaveLength(1);
    expect(bookingRequest.booking).toEqual(expect.objectContaining({
      offer_id: THRESHOLD_OFFER,
      status: 'pending',
      location: 'larnaca',
      pickup_location: 'ayia-napa',
      return_location: 'ayia-napa',
      pickup_city_code: 'ayia-napa',
      return_city_code: 'ayia-napa',
      quoted_price: 490,
      total_price: 490,
      base_rental_price: 490,
      final_rental_price: 490,
      pickup_location_fee: 0,
      return_location_fee: 0,
      pricing_snapshot: expect.objectContaining({
        pricing_strategy: 'threshold_daily_rate',
        tier_id: '9315e769-d8c4-5b99-967f-6d54e4a5b0de',
        daily_rate: 70,
        rental_days: 7,
      }),
    }));
    expect(bookingRequest.booking.status).not.toBe('confirmed');
    expect(bookingRequest.exactOffer.owner_partner_id).toBe(SPEED_BIKES_PARTNER);
    expect(bookingRequest.partner).toEqual(expect.objectContaining({
      id: SPEED_BIKES_PARTNER,
      status: 'active',
      can_manage_cars: true,
    }));
    expect(bookingRequest.depositOverride).toEqual(expect.objectContaining({
      resource_type: 'cars',
      resource_id: THRESHOLD_OFFER,
      mode: 'percent_total',
      amount: 15,
      enabled: true,
    }));
    expect(Number((bookingRequest.booking.total_price * 0.15).toFixed(2))).toBe(73.5);
    expect(Number((bookingRequest.booking.total_price * 0.85).toFixed(2))).toBe(416.5);

    await page.goto('/index.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('#carsFinderPickupLocation option[value="ayia-napa"]')));
    await configureHomepage(page, 'ayia-napa', 'ayia-napa', '2026-09-17');
    await expect(page.locator(`[data-car-offer-id="${THRESHOLD_OFFER}"] .ce-home-card-subtitle`)).toContainText('490.00');
    await page.locator(`[data-car-offer-id="${THRESHOLD_OFFER}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', THRESHOLD_OFFER);
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('490.00');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('configured selection fails closed on a stale exact ID even when a legacy offer has the same model', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, true);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'paphos', 'paphos');
    await page.evaluate(({ configuredId, duplicateId, sourceLegacyId }) => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      const configured = result?.renderedOffers?.find((row: any) => row.id === configuredId);
      const sourceLegacy = result?.renderedOffers?.find((row: any) => row.id === sourceLegacyId);
      if (!configured || !sourceLegacy) throw new Error('duplicate-model fixture prerequisites missing');
      result.renderedOffers.push({
        ...sourceLegacy,
        id: duplicateId,
        car_model: configured.car_model,
      });
      (window as any).CE_CAR_RERENDER_FLEET?.();
    }, {
      configuredId: MAPPED_LARNACA,
      duplicateId: DUPLICATE_LEGACY_OFFER,
      sourceLegacyId: LEGACY_PAPHOS,
    });

    const pageLookup = await page.evaluate(({ configuredId, legacyId, legacyUniqueId }) => {
      const finder = (window as any).CE_CAR_FIND_CURRENT_FLEET_CAR;
      const configured = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__?.renderedOffers
        ?.find((row: any) => row.id === configuredId);
      const model = configured?.car_model?.en;
      return {
        exact: finder({ offerId: configuredId, carModel: model })?.id || null,
        staleExact: finder({ offerId: 'missing-configured-offer', carModel: model })?.id || null,
        ambiguousModelOnly: finder({ carModel: model })?.id || null,
        explicitLegacy: finder({ offerId: legacyId, carModel: model })?.id || null,
        uniqueLegacyModelFallback: finder({ carModel: legacyUniqueId })?.id || null,
      };
    }, {
      configuredId: MAPPED_LARNACA,
      legacyId: DUPLICATE_LEGACY_OFFER,
      legacyUniqueId: LEGACY_PAPHOS,
    });
    expect(pageLookup).toEqual({
      exact: MAPPED_LARNACA,
      staleExact: null,
      ambiguousModelOnly: null,
      explicitLegacy: DUPLICATE_LEGACY_OFFER,
      uniqueLegacyModelFallback: LEGACY_PAPHOS,
    });

    await page.locator(`[data-select-car-offer-id="${MAPPED_LARNACA}"]`).click();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', MAPPED_LARNACA);

    const modalLookup = await page.evaluate(({ configuredId, legacyId }) => {
      const finder = (window as any).CE_CAR_FIND_CURRENT_FLEET_CAR;
      const selected = document.querySelector('#res_car option:checked') as HTMLOptionElement | null;
      const model = selected?.value || '';
      return {
        exact: finder({ offerId: configuredId, carModel: model })?.id || null,
        staleExact: finder({ offerId: 'missing-configured-offer', carModel: model })?.id || null,
        ambiguousModelOnly: finder({ carModel: model })?.id || null,
        explicitLegacy: finder({ offerId: legacyId, carModel: model })?.id || null,
      };
    }, { configuredId: MAPPED_LARNACA, legacyId: DUPLICATE_LEGACY_OFFER });
    expect(modalLookup).toEqual({
      exact: MAPPED_LARNACA,
      staleExact: null,
      ambiguousModelOnly: null,
      explicitLegacy: null,
    });

    await page.locator('#res_full_name').fill('Exact ID Guard');
    await page.locator('#res_email').fill('exact-id-guard@example.test');
    await page.locator('#res_phone_local').fill('99111222');
    await page.evaluate(() => {
      const select = document.querySelector('#res_car') as HTMLSelectElement | null;
      const option = select?.selectedOptions?.[0];
      const form = document.querySelector('#localReservationForm') as HTMLFormElement | null;
      if (!option || !form) throw new Error('stale exact-ID form fixture is unavailable');
      option.dataset.offerId = 'missing-configured-offer';
      form.requestSubmit();
    });
    await expect.poll(() => errors.some((message) => /exact ID/i.test(message)), {
      timeout: 5000,
      message: 'the stale exact ID must fail closed before quote or booking writes',
    }).toBe(true);

    const writes = await page.evaluate(() => ({
      bookings: (window as any).__supabaseStub?.getTableRows?.('car_bookings')?.length || 0,
      authoritativeCalls: ((window as any).__supabaseStub?.getRpcCalls?.() || [])
        .filter((call: any) => call.name === 'resolve_car_threshold_authoritative_quote').length,
    }));
    expect(writes).toEqual({ bookings: 0, authoritativeCalls: 0 });
  });

  test('without a JS global, DB flag OFF preserves exact legacy results on car.html and homepage', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, false, false, false);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'larnaca', 'larnaca');
    const carPage = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return {
        globalDefined: typeof (window as any).CE_CAR_MULTICITY_SHADOW_CONFIG !== 'undefined',
        sameReference: result.renderedOffers === result.legacyOffers,
        mode: result.renderMode,
        requests: result.metrics.requests,
        ids: Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
          .map((node) => node.getAttribute('data-select-car-offer-id')),
      };
    });
    expect(carPage).toEqual({
      globalDefined: false,
      sameReference: true,
      mode: 'legacy',
      requests: 1,
      ids: [MAPPED_LARNACA, ASYMMETRIC_LARNACA, LEGACY_LARNACA],
    });
    await page.locator(`[data-select-car-offer-id="${LEGACY_LARNACA}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', LEGACY_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('larnaca');

    await page.goto('/index.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('#carsFinderPickupLocation option[value="larnaca"]')));
    await configureHomepage(page, 'larnaca', 'larnaca');
    const homepage = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return {
        globalDefined: typeof (window as any).CE_CAR_MULTICITY_SHADOW_CONFIG !== 'undefined',
        sameReference: result.renderedOffers === result.legacyOffers,
        mode: result.renderMode,
        requests: result.metrics.requests,
        ids: Array.from(document.querySelectorAll('#carsHomeGrid [data-car-offer-id]'))
          .map((node) => node.getAttribute('data-car-offer-id')),
      };
    });
    expect(homepage).toEqual({
      globalDefined: false,
      sameReference: true,
      mode: 'legacy',
      requests: 1,
      ids: [MAPPED_LARNACA, ASYMMETRIC_LARNACA, LEGACY_LARNACA],
    });
    await page.locator(`[data-car-offer-id="${LEGACY_LARNACA}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', LEGACY_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('larnaca');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('without a JS global, DB flag ON renders exact hybrid context on car.html', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, true, false, false);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'paphos', 'paphos');
    const snapshot = await page.evaluate((mappedOfferId) => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return {
        globalDefined: typeof (window as any).CE_CAR_MULTICITY_SHADOW_CONFIG !== 'undefined',
        mode: result.renderMode,
        requests: result.metrics.requests,
        ids: result.renderedOffers.map((row: any) => row.id),
        totals: result.renderedOffers.map((row: any) => row.quote.total),
        mappedContext: result.renderedOffers.find((row: any) => row.id === mappedOfferId)?.pricingContext,
        duplicateIds: result.diagnostics.filter((row: any) => row.code === 'DUPLICATE_OFFER_ID'),
      };
    }, MAPPED_LARNACA);
    expect(snapshot.globalDefined).toBe(false);
    expect(snapshot.mode).toBe('hybrid');
    expect(snapshot.requests).toBe(6);
    expect(snapshot.ids).toEqual([MAPPED_LARNACA, MAPPED_PAPHOS, LEGACY_PAPHOS]);
    expect(snapshot.totals).toEqual([...snapshot.totals].sort((left, right) => left - right));
    expect(snapshot.mappedContext).toMatchObject({
      offerId: MAPPED_LARNACA,
      availabilityMode: 'mapped',
      legacyBookingLocation: 'larnaca',
      pickupLegacyPricingLocation: 'paphos',
      returnLegacyPricingLocation: 'paphos',
    });
    expect(snapshot.duplicateIds).toEqual([]);
    const cardPrice = await page.locator(`[data-select-car-offer-id="${MAPPED_LARNACA}"] .auto-card-price`).textContent();
    await page.locator(`[data-select-car-offer-id="${MAPPED_LARNACA}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', MAPPED_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('paphos');
    expect(cardPrice).toContain('180.00');
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('180.00');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('mapped per-offer Paphos fee override zero drives the same exact quote on car.html and homepage', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, true, false, false, 0);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'paphos', 'paphos');
    const carState = await page.evaluate((offerId) => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      const row = result.renderedOffers.find((entry: any) => entry.id === offerId);
      return {
        quote: row?.quote,
        context: row?.pricingContext,
        priceMismatches: result.comparison.priceMismatches,
      };
    }, MAPPED_LARNACA);
    expect(carState.quote).toEqual(expect.objectContaining({ basePrice: 100, pickupFee: 0, returnFee: 0, total: 100 }));
    expect(carState.context).toEqual(expect.objectContaining({
      offerId: MAPPED_LARNACA,
      legacyBookingLocation: 'larnaca',
      pickupLegacyPricingKey: 'paphos',
      returnLegacyPricingKey: 'paphos',
      pickupFeeMode: 'override',
      returnFeeMode: 'override',
      pickupFeePerDirection: 0,
      returnFeePerDirection: 0,
    }));
    expect(carState.priceMismatches).toEqual([]);
    await expect(page.locator(`[data-select-car-offer-id="${MAPPED_LARNACA}"] .auto-card-price`)).toContainText('100.00');
    await page.locator(`[data-select-car-offer-id="${MAPPED_LARNACA}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', MAPPED_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('paphos');
    await expect(page.locator('#res_return_location')).toHaveValue('paphos');
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('100.00');

    await page.goto('/index.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('#carsFinderPickupLocation option[value="paphos"]')));
    await configureHomepage(page, 'paphos', 'paphos');
    await expect(page.locator(`[data-car-offer-id="${MAPPED_LARNACA}"] .ce-home-card-subtitle`)).toContainText('100.00');
    await page.locator(`[data-car-offer-id="${MAPPED_LARNACA}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', MAPPED_LARNACA);
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('100.00');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('without a JS global, DB flag ON renders the same exact hybrid result on homepage', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, true, false, false);
    await page.goto('/index.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('#carsFinderPickupLocation option[value="paphos"]')));
    await configureHomepage(page, 'paphos', 'paphos');
    const snapshot = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return {
        globalDefined: typeof (window as any).CE_CAR_MULTICITY_SHADOW_CONFIG !== 'undefined',
        mode: result.renderMode,
        requests: result.metrics.requests,
        ids: Array.from(document.querySelectorAll('#carsHomeGrid [data-car-offer-id]'))
          .map((node) => node.getAttribute('data-car-offer-id')),
        totals: result.renderedOffers.map((row: any) => row.quote.total),
      };
    });
    expect(snapshot.globalDefined).toBe(false);
    expect(snapshot.mode).toBe('hybrid');
    expect(snapshot.requests).toBe(6);
    expect(snapshot.ids).toEqual([MAPPED_LARNACA, MAPPED_PAPHOS, LEGACY_PAPHOS]);
    expect(snapshot.totals).toEqual([...snapshot.totals].sort((left, right) => left - right));
    await page.locator(`[data-car-offer-id="${MAPPED_LARNACA}"]`).click();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', MAPPED_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('paphos');
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('180.00');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('flag OFF preserves the complete current legacy result exactly', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, false);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'larnaca', 'larnaca');
    const state = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return {
        sameReference: result.renderedOffers === result.legacyOffers,
        mode: result.renderMode,
        ids: Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
          .map((node) => node.getAttribute('data-select-car-offer-id')),
      };
    });
    expect(state).toEqual({ sameReference: true, mode: 'legacy', ids: [MAPPED_LARNACA, ASYMMETRIC_LARNACA, LEGACY_LARNACA] });
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('car.html renders sorted Paphos mixed profiles and opens exact mapped Larnaca context', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, true);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'paphos', 'paphos');
    const snapshot = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      const cards = Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'));
      return {
        ids: cards.map((node) => node.getAttribute('data-select-car-offer-id')),
        totals: result.renderedOffers.map((row: any) => row.quote.total),
        contexts: result.renderedOffers.map((row: any) => ({
          id: row.id,
          location: row.pricingContext.legacyBookingLocation,
          pickup: row.pricingContext.pickupLegacyPricingLocation,
          ret: row.pricingContext.returnLegacyPricingLocation,
        })),
        diagnostics: result.diagnostics.map((row: any) => row.code),
      };
    });
    expect(snapshot.ids).toEqual([MAPPED_LARNACA, MAPPED_PAPHOS, LEGACY_PAPHOS]);
    expect(snapshot.totals).toEqual([...snapshot.totals].sort((a, b) => a - b));
    expect(snapshot.contexts.find((row: any) => row.id === MAPPED_LARNACA)).toEqual({
      id: MAPPED_LARNACA, location: 'larnaca', pickup: 'paphos', ret: 'paphos',
    });
    expect(snapshot.diagnostics).toContain('HYBRID_RESULT_READY');
    expect(snapshot.diagnostics).not.toContain('DUPLICATE_OFFER_ID');

    const cardPrice = await page.locator(`[data-select-car-offer-id="${MAPPED_LARNACA}"] .auto-card-price`).textContent();
    await page.locator(`[data-select-car-offer-id="${MAPPED_LARNACA}"]`).click();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', MAPPED_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('paphos');
    await expect(page.locator('#res_return_location')).toHaveValue('paphos');
    expect(cardPrice).toContain('180.00');
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('180.00');
    expect(await page.evaluate(() => document.body?.dataset?.carLocation)).toBe('larnaca');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('homepage uses the same hybrid ordering, quote and exact modal offer', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, true);
    await page.goto('/index.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('#carsFinderPickupLocation option[value="paphos"]')));
    await configureHomepage(page, 'paphos', 'paphos');
    const ids = await page.locator('#carsHomeGrid [data-car-offer-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-car-offer-id')));
    expect(ids).toEqual([MAPPED_LARNACA, MAPPED_PAPHOS, LEGACY_PAPHOS]);
    await page.locator(`[data-car-offer-id="${MAPPED_LARNACA}"]`).click();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', MAPPED_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('paphos');
    await expect(page.locator('.ce-car-home-hero-price')).toContainText('180.00');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('directional availability includes Paphos to Larnaca but excludes the same offer from Paphos to Paphos', async ({ page }) => {
    await seedHybrid(page, true);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'paphos', 'paphos');
    await expect(page.locator(`[data-select-car-offer-id="${ASYMMETRIC_LARNACA}"]`)).toHaveCount(0);
    await configureCarPage(page, 'paphos', 'larnaca');
    await expect(page.locator(`[data-select-car-offer-id="${ASYMMETRIC_LARNACA}"]`)).toHaveCount(1);
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
  });

  test('mapped read failure renders only legacy-mode offers and exposes no technical error to the customer', async ({ page }) => {
    const errors = ownSourceErrors(page);
    await seedHybrid(page, true, true);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'paphos', 'paphos');
    const snapshot = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return {
        ids: Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
          .map((node) => node.getAttribute('data-select-car-offer-id')),
        mode: result.renderMode,
        diagnostics: result.diagnostics.map((row: any) => row.code),
        visibleText: document.querySelector('#carRentalGrid')?.textContent || '',
      };
    });
    expect(snapshot.ids).toEqual([LEGACY_PAPHOS]);
    expect(snapshot.mode).toBe('hybrid-fallback');
    expect(snapshot.diagnostics).toContain('MAPPED_READER_UNAVAILABLE');
    expect(snapshot.visibleText).not.toContain('MAPPED_READER_UNAVAILABLE');
    expect(await requestSafetySnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });
});
