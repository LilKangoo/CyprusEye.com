import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PROFILE_LARNACA = 'hybrid-profile-larnaca';
const PROFILE_PAPHOS = 'hybrid-profile-paphos';
const CITY_LARNACA = 'hybrid-city-larnaca';
const CITY_PAPHOS = 'hybrid-city-paphos';
const LEGACY_LARNACA = 'hybrid-legacy-larnaca';
const LEGACY_PAPHOS = 'hybrid-legacy-paphos';
const MAPPED_LARNACA = 'hybrid-mapped-larnaca';
const MAPPED_PAPHOS = 'hybrid-mapped-paphos';
const ASYMMETRIC_LARNACA = 'hybrid-asymmetric-larnaca';

function car(id: string, location: 'larnaca' | 'paphos', mode: 'legacy' | 'mapped', daily: number, sortOrder: number) {
  const paphos = location === 'paphos';
  return {
    id,
    location,
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

async function configureCarPage(page: Page, pickup: string, ret: string) {
  await page.evaluate(() => {
    delete (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
    delete (window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__;
  });
  await page.locator('#pickupDate').fill('2026-09-10');
  await page.locator('#pickupTime').fill('10:00');
  await page.locator('#returnDate').fill('2026-09-14');
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

async function configureHomepage(page: Page, pickup: string, ret: string) {
  await page.evaluate(() => {
    delete (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
    delete (window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__;
  });
  await page.locator('#carsFinderPickupDate').fill('2026-09-10');
  await page.locator('#carsFinderPickupTime').fill('10:00');
  await page.locator('#carsFinderReturnDate').fill('2026-09-14');
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
    rpc: (window as any).__supabaseStub?.getRpcCalls?.() || [],
  }));
}

test.describe('Car Rental Multi-City Stage 2E public hybrid rendering', () => {
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
