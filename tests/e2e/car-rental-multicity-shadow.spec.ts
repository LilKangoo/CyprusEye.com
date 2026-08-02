import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PROFILE_LARNACA = 'shadow-profile-larnaca';
const PROFILE_PAPHOS = 'shadow-profile-paphos';
const CITY_LARNACA = 'shadow-city-larnaca';
const CITY_PAPHOS = 'shadow-city-paphos';
const OFFER_LARNACA = 'shadow-offer-larnaca';
const OFFER_PAPHOS = 'shadow-offer-paphos';

const offers = [
  {
    id: OFFER_LARNACA,
    location: 'larnaca', pricing_profile_id: PROFILE_LARNACA, availability_mode: 'mapped',
    is_available: true, is_published: true, north_allowed: true, submission_status: 'approved',
    sort_order: 10, stock_count: 1, max_passengers: 5, max_luggage: 2,
    car_model: { pl: 'Shadow Larnaka', en: 'Shadow Larnaca', he: 'שאדו לרנקה' },
    car_type: { pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' },
    description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
    features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
    transmission: 'automatic', fuel_type: 'petrol', image_url: '/assets/cyprus_logo-128.png',
    price_per_day: 35, price_3days: 105, price_4_6days: 35, price_7_10days: 32, price_10plus_days: 30,
    deposit_amount: 200, insurance_per_day: 17, young_driver_fee: true, young_driver_cost: 10,
  },
  {
    id: OFFER_PAPHOS,
    location: 'paphos', pricing_profile_id: PROFILE_PAPHOS, availability_mode: 'mapped',
    is_available: true, is_published: true, north_allowed: false, submission_status: 'approved',
    sort_order: 20, stock_count: 1, max_passengers: 5, max_luggage: 2,
    car_model: { pl: 'Shadow Pafos', en: 'Shadow Paphos', he: 'שאדו פאפוס' },
    car_type: { pl: 'Kompakt', en: 'Compact', he: 'קומפקטי' },
    description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
    features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
    transmission: 'automatic', fuel_type: 'petrol', image_url: '/assets/cyprus_logo-128.png',
    price_per_day: 65, price_3days: 210, price_4_6days: 65, price_7_10days: 60, price_10plus_days: 55,
    deposit_amount: 350, insurance_per_day: 17, young_driver_fee: false, young_driver_cost: 0,
  },
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
    { offer_id: OFFER_LARNACA, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: OFFER_LARNACA, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: OFFER_PAPHOS, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
  ],
};

function collectOwnSourceErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|chrome-extension|contentscript/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function seedShadow(page: Page, flagEnabled: boolean) {
  await page.addInitScript(({ fixtureTables, enabled }) => {
    const root = window as any;
    root.CE_CAR_MULTICITY_SHADOW_CONFIG = { enabled: true, debounceMs: 0 };
    root.__shadowEvents = [];
    window.addEventListener('ce:car-multicity-shadow-ready', (event: Event) => {
      root.__shadowEvents.push((event as CustomEvent).detail);
    });
    const seed = (stub: any) => {
      if (!stub || typeof stub.seedTable !== 'function') return;
      stub.reset?.();
      for (const [table, rows] of Object.entries(fixtureTables)) stub.seedTable(table, rows);
      stub.seedTable('site_settings', [{ id: 1, car_multi_city_mapped_enabled: enabled }]);
    };
    const existing = root.__supabaseStub || {};
    const previousOnReady = existing.onReady;
    existing.onReady = (stub: any) => {
      previousOnReady?.(stub);
      seed(stub);
    };
    root.__supabaseStub = existing;
    seed(existing);
  }, { fixtureTables: tables, enabled: flagEnabled });
}

async function configureCarPage(page: Page, pickup: string, ret: string) {
  await page.locator('#pickupDate').fill('2026-09-10');
  await page.locator('#pickupTime').fill('10:00');
  await page.locator('#returnDate').fill('2026-09-14');
  await page.locator('#returnTime').fill('10:00');
  await page.locator('#rentalPassengers').fill('2');
  await page.locator('#pickupLocation').selectOption(pickup);
  await page.locator('#returnLocation').selectOption(ret);
  const expected = pickup === 'paphos' && ret === 'paphos' ? 'paphos' : 'larnaca';
  await page.waitForFunction((value) => document.body?.dataset?.carLocation === value, expected);
  await page.waitForFunction(() => Boolean((window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__));
  await page.evaluate(() => (window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__);
}

async function configureHomepage(page: Page, pickup: string, ret: string) {
  await page.locator('#carsFinderPickupDate').fill('2026-09-10');
  await page.locator('#carsFinderPickupTime').fill('10:00');
  await page.locator('#carsFinderReturnDate').fill('2026-09-14');
  await page.locator('#carsFinderReturnTime').fill('10:00');
  await page.locator('#carsFinderPassengers').fill('2');
  await page.locator('#carsFinderPickupLocation').selectOption(pickup);
  await page.locator('#carsFinderReturnLocation').selectOption(ret);
  await page.waitForFunction(() => Boolean((window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__));
  await page.evaluate(() => (window as any).__CE_CAR_MULTICITY_SHADOW_PROMISE__);
}

async function stubWriteSnapshot(page: Page) {
  return page.evaluate(() => ({
    mutations: (window as any).__supabaseStub?.getMutationCalls?.() || [],
    rpc: (window as any).__supabaseStub?.getRpcCalls?.() || [],
  }));
}

test.describe('Car Rental Multi-City Stage 2D public shadow', () => {
  test('global flag false keeps car.html legacy-only and performs no write', async ({ page }) => {
    const errors = collectOwnSourceErrors(page);
    await seedShadow(page, false);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'larnaca', 'larnaca');

    const state = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_SHADOW_RESULT__;
      return {
        sameRenderedReference: result.renderedOffers === result.legacyOffers,
        mappedIds: result.mappedOffers.map((row: any) => row.id),
        renderedIds: Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
          .map((node) => node.getAttribute('data-select-car-offer-id')),
        diagnostics: result.diagnostics.map((entry: any) => entry.code),
      };
    });
    expect(state.sameRenderedReference).toBe(true);
    expect(state.mappedIds).toEqual([]);
    expect(state.renderedIds).toEqual([OFFER_LARNACA]);
    expect(state.diagnostics).toContain('SHADOW_FEATURE_FLAG_DISABLED');
    expect(await stubWriteSnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('car.html builds mapped comparison but preserves IDs, order, prices and exact modal offer', async ({ page }) => {
    const errors = collectOwnSourceErrors(page);
    await seedShadow(page, true);
    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    await configureCarPage(page, 'paphos', 'paphos');

    const snapshot = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_SHADOW_RESULT__;
      const cards = Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'));
      return {
        sameRenderedReference: result.renderedOffers === result.legacyOffers,
        legacyIds: result.legacyOffers.map((row: any) => row.id),
        mappedIds: result.mappedOffers.map((row: any) => row.id),
        renderedIds: cards.map((node) => node.getAttribute('data-select-car-offer-id')),
        renderedPrices: cards.map((node) => node.closest('.auto-card')?.querySelector('.auto-card-price')?.textContent?.trim()),
        comparison: result.comparison,
        events: (window as any).__shadowEvents,
      };
    });
    expect(snapshot.sameRenderedReference).toBe(true);
    expect(snapshot.legacyIds).toEqual([OFFER_PAPHOS]);
    expect(snapshot.renderedIds).toEqual([OFFER_PAPHOS]);
    expect(snapshot.mappedIds).toEqual([OFFER_LARNACA, OFFER_PAPHOS]);
    expect(snapshot.renderedPrices.join(' ')).not.toMatch(/NaN|undefined|null/);
    expect(snapshot.comparison.addedOfferIds).toEqual([OFFER_LARNACA]);
    expect(snapshot.comparison.commonOfferIds).toEqual([OFFER_PAPHOS]);
    expect(snapshot.comparison.priceMismatches).toEqual([]);
    expect(snapshot.events.at(-1)?.source).toBe('car-page');

    await page.locator(`[data-select-car-offer-id="${OFFER_PAPHOS}"]`).click();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', OFFER_PAPHOS);
    expect(await stubWriteSnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });

  test('homepage uses the same shadow result while the visible legacy card remains unchanged', async ({ page }) => {
    const errors = collectOwnSourceErrors(page);
    await seedShadow(page, true);
    await page.goto('/index.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('#carsFinderPickupLocation option[value="paphos"]')));
    await configureHomepage(page, 'paphos', 'paphos');

    const snapshot = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_SHADOW_RESULT__;
      const titles = Array.from(document.querySelectorAll('#carsHomeGrid .ce-home-card-title'))
        .map((node) => node.textContent?.trim());
      return {
        sameRenderedReference: result.renderedOffers === result.legacyOffers,
        legacyIds: result.legacyOffers.map((row: any) => row.id),
        mappedIds: result.mappedOffers.map((row: any) => row.id),
        titles,
        comparison: result.comparison,
        events: (window as any).__shadowEvents,
      };
    });
    expect(snapshot.sameRenderedReference).toBe(true);
    expect(snapshot.legacyIds).toEqual([OFFER_PAPHOS]);
    expect(snapshot.mappedIds).toEqual([OFFER_LARNACA, OFFER_PAPHOS]);
    expect(snapshot.titles).toEqual(['Shadow Paphos']);
    expect(snapshot.comparison.addedOfferIds).toEqual([OFFER_LARNACA]);
    expect(snapshot.comparison.priceMismatches).toEqual([]);
    expect(snapshot.events.at(-1)?.source).toBe('homepage');

    await page.locator('#carsHomeGrid .recommendation-home-card').click();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', OFFER_PAPHOS);
    expect(await stubWriteSnapshot(page)).toEqual({ mutations: [], rpc: [] });
    expect(errors).toEqual([]);
  });
});
