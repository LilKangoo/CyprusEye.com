import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { TOKENS } from '../integration/car-rental-multicity-postgrest-auth.mjs';

const ENABLED = process.env.CAR_MULTICITY_REAL_POSTGREST === '1';
const REST_URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const OFFER_LARNACA = 'ca300001-0000-4000-8000-000000000001';
const OFFER_PAPHOS = 'ca300001-0000-4000-8000-000000000002';
const LEGACY_PAPHOS = 'ca5f0000-0000-4000-8000-000000000001';
const PROFILE_PAPHOS = 'ca210001-0000-4000-8000-000000000002';
const CITY_LARNACA = 'ca200001-0000-4000-8000-000000000001';
const CITY_PAPHOS = 'ca200001-0000-4000-8000-000000000006';
const KIND_CAR = 'ca220001-0000-4000-8000-000000000001';
const PARTNER_PAPHOS = 'ca2f0000-0000-4000-8000-000000000002';

type ApiOptions = { method?: string; body?: unknown; prefer?: string };

async function api(pathname: string, options: ApiOptions = {}) {
  const response = await fetch(`${REST_URL}/${pathname}`, {
    method: options.method || 'GET',
    headers: {
      apikey: TOKENS.anon,
      Authorization: `Bearer ${TOKENS.service}`,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const responseText = await response.text();
  const body = responseText ? JSON.parse(responseText) : null;
  if (!response.ok) throw new Error(`Real hybrid API ${response.status}: ${responseText}`);
  return body;
}

async function reset() {
  await api(`car_offers?id=in.(${OFFER_LARNACA},${OFFER_PAPHOS},${LEGACY_PAPHOS})`, {
    method: 'PATCH', prefer: 'return=minimal', body: { availability_mode: 'legacy' },
  });
  await api(`car_offer_city_availability?offer_id=in.(${OFFER_LARNACA},${OFFER_PAPHOS},${LEGACY_PAPHOS})`, {
    method: 'DELETE', prefer: 'return=minimal',
  });
  await api(`car_offers?id=eq.${LEGACY_PAPHOS}`, { method: 'DELETE', prefer: 'return=minimal' });
  await api('site_settings?id=eq.1', {
    method: 'PATCH', prefer: 'return=minimal', body: { car_multi_city_mapped_enabled: false },
  });
}

async function seed() {
  await api('car_offers', {
    method: 'POST', prefer: 'return=minimal',
    body: {
      id: LEGACY_PAPHOS, location: 'paphos', pricing_profile_id: PROFILE_PAPHOS,
      vehicle_kind_id: KIND_CAR, availability_mode: 'legacy',
      car_type: { pl: 'Test', en: 'Test', he: 'בדיקה' },
      car_model: { pl: 'Real legacy Paphos', en: 'Real legacy Paphos', he: 'בדיקה' },
      description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
      features: { pl: ['AC'], en: ['AC'], he: ['AC'] },
      transmission: 'automatic', fuel_type: 'petrol', max_passengers: 5, max_luggage: 2,
      stock_count: 1, sort_order: 9000, price_per_day: 90, price_3days: 270,
      price_4_6days: 90, price_7_10days: 85, price_10plus_days: 80,
      currency: 'EUR', deposit_amount: 350, insurance_per_day: 17,
      young_driver_fee: false, young_driver_cost: 0, owner_partner_id: PARTNER_PAPHOS,
      north_allowed: false, is_available: true, is_published: true, submission_status: 'approved',
    },
  });
  await api('car_offer_city_availability', {
    method: 'POST', prefer: 'return=minimal',
    body: [
      { offer_id: OFFER_LARNACA, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true },
      { offer_id: OFFER_LARNACA, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
      { offer_id: OFFER_PAPHOS, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    ],
  });
  await api(`car_offers?id=in.(${OFFER_LARNACA},${OFFER_PAPHOS})`, {
    method: 'PATCH', prefer: 'return=minimal', body: { availability_mode: 'mapped' },
  });
  await api('site_settings?id=eq.1', {
    method: 'PATCH', prefer: 'return=minimal', body: { car_multi_city_mapped_enabled: true },
  });
}

test.describe('Car Rental Multi-City Stage 2E real PostgREST public path', () => {
  test.skip(!ENABLED, 'Requires isolated PostgreSQL/PostgREST on loopback.');
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    await reset();
    await seed();
  });

  test.afterEach(async () => {
    await reset();
  });

  test('car.html renders the real RLS-backed hybrid result and exact per-offer modal context', async ({ context, page }) => {
    const parsed = new URL(REST_URL);
    expect(['127.0.0.1', 'localhost', '::1']).toContain(parsed.hostname);
    expect(parsed.protocol).toBe('http:');

    const umd = fs.readFileSync(path.resolve('node_modules/@supabase/supabase-js/dist/umd/supabase.js'), 'utf8');
    await context.addInitScript({ content: umd });
    await context.addInitScript(() => {
      delete (window as any).CE_CAR_MULTICITY_SHADOW_CONFIG;
      window.localStorage.setItem('seenTutorial', 'true');
      window.localStorage.setItem('ce_lang_selected', 'true');
      window.localStorage.setItem('ce_lang', 'en');
    });
    await context.route(/\/car\.html(?:\?.*)?$/, async (route) => {
      const html = fs.readFileSync(path.resolve('car.html'), 'utf8')
        .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, '');
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    });
    await context.route('https://esm.sh/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'export const createClient = (...args) => globalThis.supabase.createClient(...args);',
      });
    });
    await context.route('**/js/config.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `export const SUPABASE_CONFIG = ${JSON.stringify({ url: REST_URL, anonKey: TOKENS.anon, storageKey: 'stage2e-real-local-only' })};
          export const APP_CONFIG = { name: 'Stage 2E local', version: 'test', debug: false };
          export const URLS = { passwordReset: '', verification: '', base: '' };`,
      });
    });
    await context.route(`${REST_URL}/**`, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization,apikey,content-type,prefer,x-client-info',
            'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
            'Access-Control-Allow-Private-Network': 'true',
          },
        });
        return;
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Private-Network': 'true',
        },
      });
    });

    const requests: Array<{ method: string; url: string }> = [];
    const runtimeErrors: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith(REST_URL)) requests.push({ method: request.method(), url: request.url() });
    });
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror:${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`console:${message.text()}`);
    });
    page.on('requestfailed', (request) => runtimeErrors.push(`requestfailed:${request.url()}:${request.failure()?.errorText || ''}`));

    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const fleetReady = await page.evaluate(() => typeof (window as any).CE_CAR_GET_CURRENT_FLEET === 'function');
    if (!fleetReady) throw new Error(`Real public runtime did not initialize: ${JSON.stringify(runtimeErrors)}`);
    await page.locator('#pickupDate').fill('2026-09-10');
    await page.locator('#pickupTime').fill('10:00');
    await page.locator('#returnDate').fill('2026-09-13');
    await page.locator('#returnTime').fill('10:00');
    await page.locator('#rentalPassengers').fill('2');
    await page.locator('#pickupLocation').selectOption('paphos');
    await page.locator('#returnLocation').selectOption('paphos');
    await page.waitForFunction(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return result?.renderMode === 'hybrid'
        && result.renderedOffers.every((row: any) => row.pricingContext?.pickupCityCode === 'paphos');
    });

    const state = await page.evaluate(() => {
      const result = (window as any).__CE_CAR_MULTICITY_HYBRID_RESULT__;
      return {
        ids: Array.from(document.querySelectorAll('#carRentalGrid [data-select-car-offer-id]'))
          .map((node) => node.getAttribute('data-select-car-offer-id')),
        totals: result.renderedOffers.map((row: any) => row.quote.total),
        priceMismatches: result.comparison.priceMismatches,
        unexplained: result.comparison.unexplainedDifferences,
      };
    });
    expect(new Set(state.ids)).toEqual(new Set([OFFER_LARNACA, OFFER_PAPHOS, LEGACY_PAPHOS]));
    expect(state.totals).toEqual([...state.totals].sort((left, right) => left - right));
    expect(state.priceMismatches).toEqual([]);
    expect(state.unexplained).toEqual([]);

    await page.locator(`[data-select-car-offer-id="${OFFER_LARNACA}"]`).click();
    await expect(page.locator('#carHomeModal')).toBeVisible();
    await expect(page.locator('#res_car option:checked')).toHaveAttribute('data-offer-id', OFFER_LARNACA);
    await expect(page.locator('#res_pickup_location')).toHaveValue('paphos');
    expect(await page.evaluate(() => document.body?.dataset?.carLocation)).toBe('larnaca');

    const publicRequests = requests.filter((entry) => /\/rest\/v1\//.test(entry.url));
    expect(publicRequests.length).toBeGreaterThanOrEqual(6);
    expect(publicRequests.every((entry) => entry.method === 'GET')).toBe(true);
    expect(publicRequests.every((entry) => !/car_bookings|customer_|email|phone|payment|stripe|\/rpc\//i.test(entry.url))).toBe(true);
  });
});
