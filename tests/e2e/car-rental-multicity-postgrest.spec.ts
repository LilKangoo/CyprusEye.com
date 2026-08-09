import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { TOKENS } from '../integration/car-rental-multicity-postgrest-auth.mjs';

const ENABLED = process.env.CAR_MULTICITY_REAL_POSTGREST === '1';
const URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const APP_URL = process.env.CAR_MULTICITY_TEST_APP_URL
  || `http://${process.env.PLAYWRIGHT_HOST || '127.0.0.1'}:${process.env.PORT || '3001'}`;
const OFFER_LARNACA = 'ca300001-0000-4000-8000-000000000001';
const OFFER_PAPHOS = 'ca300001-0000-4000-8000-000000000002';
const PROFILE_LARNACA = 'ca210001-0000-4000-8000-000000000001';
const PROFILE_PAPHOS = 'ca210001-0000-4000-8000-000000000002';
const CITY_LARNACA = 'ca200001-0000-4000-8000-000000000001';
const CITY_NICOSIA = 'ca200001-0000-4000-8000-000000000002';
const CITY_PAPHOS = 'ca200001-0000-4000-8000-000000000006';
const KIND_CAR = 'ca220001-0000-4000-8000-000000000001';
const KIND_QUAD = 'ca220001-0000-4000-8000-000000000002';
const PARTNER_LARNACA = 'ca2f0000-0000-4000-8000-000000000001';
const PARTNER_PAPHOS = 'ca2f0000-0000-4000-8000-000000000002';
const PROTECTED_COLUMNS = [
  'id', 'price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days',
  'price_10plus_days', 'currency', 'location', 'owner_partner_id',
  'deposit_amount', 'insurance_per_day', 'young_driver_fee', 'young_driver_cost',
  'stock_count', 'north_allowed', 'is_available', 'is_published', 'submission_status',
].join(',');

type ApiOptions = { method?: string; body?: unknown; prefer?: string };

async function api(pathname: string, options: ApiOptions = {}) {
  const response = await fetch(`${URL}/${pathname}`, {
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
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Integration API ${response.status}: ${text}`);
  return body;
}

async function resetDatabase() {
  await api(`car_offers?id=in.(${OFFER_LARNACA},${OFFER_PAPHOS})`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: { pricing_strategy: 'legacy_compat', availability_mode: 'legacy' },
  });
  await api('car_offer_daily_rate_tiers?offer_id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await api('car_offer_city_availability?offer_id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await api(`car_offers?id=not.in.(${OFFER_LARNACA},${OFFER_PAPHOS})`, { method: 'DELETE', prefer: 'return=minimal' });
  await api('car_rental_cities?code=like.ui-test-*', { method: 'DELETE', prefer: 'return=minimal' });
  await api(`car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: { pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'nicosia', is_active: true },
  });
  await api(`car_offers?id=eq.${OFFER_LARNACA}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: {
      location: 'larnaca', pricing_profile_id: PROFILE_LARNACA,
      availability_mode: 'legacy', pricing_strategy: 'legacy_compat', min_rental_days: 1, max_rental_days: 30,
      engine_capacity_cc: null, required_licence_category: null, minimum_driver_age: null,
      insurance_mode: 'legacy_optional_daily', vehicle_kind_id: KIND_CAR,
      owner_partner_id: PARTNER_LARNACA, stock_count: 2,
      car_type: { pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' },
      car_model: { pl: 'Mazda 2 test', en: 'Mazda 2 test', he: 'מאזדה 2 בדיקה' },
      description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
      features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
      transmission: 'automatic', fuel_type: 'petrol', currency: 'EUR',
      max_passengers: 5, max_luggage: 2, sort_order: 10,
      price_per_day: 35, price_3days: 105, price_4_6days: 34,
      price_7_10days: 31, price_10plus_days: 29,
      deposit_amount: 200, insurance_per_day: 17,
      young_driver_fee: true, young_driver_cost: 10,
      north_allowed: true, is_available: true, is_published: true,
      submission_status: 'approved', image_url: null,
    },
  });
  await api(`car_offers?id=eq.${OFFER_PAPHOS}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: {
      location: 'paphos', pricing_profile_id: PROFILE_PAPHOS,
      availability_mode: 'legacy', pricing_strategy: 'legacy_compat', min_rental_days: 1, max_rental_days: 30,
      engine_capacity_cc: null, required_licence_category: null, minimum_driver_age: null,
      insurance_mode: 'legacy_optional_daily', vehicle_kind_id: KIND_CAR,
      owner_partner_id: PARTNER_PAPHOS, stock_count: 1,
      car_type: { pl: 'SUV', en: 'SUV', he: 'SUV' },
      car_model: { pl: 'Paphos SUV test', en: 'Paphos SUV test', he: 'רכב פאפוס בדיקה' },
      description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
      features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
      transmission: 'automatic', fuel_type: 'petrol', currency: 'EUR',
      max_passengers: 5, max_luggage: 4, sort_order: 20,
      price_per_day: 65, price_3days: 210, price_4_6days: 65,
      price_7_10days: 60, price_10plus_days: 55,
      deposit_amount: 350, insurance_per_day: 17,
      young_driver_fee: false, young_driver_cost: 0,
      north_allowed: false, is_available: true, is_published: true,
      submission_status: 'approved', image_url: null,
    },
  });
  await api('site_settings?id=eq.1', {
    method: 'PATCH', prefer: 'return=minimal',
    body: { car_multi_city_mapped_enabled: false, car_threshold_daily_rates_enabled: false },
  });
}

async function rows(table: string, query = 'select=*') {
  return api(`${table}?${query}`);
}

async function assertCleanFinancialBaseline() {
  expect(await rows('car_offers', `select=${PROTECTED_COLUMNS}&order=id.asc`)).toEqual([
    {
      id: OFFER_LARNACA,
      price_per_day: 35, price_3days: 105, price_4_6days: 34,
      price_7_10days: 31, price_10plus_days: 29, currency: 'EUR', location: 'larnaca',
      owner_partner_id: PARTNER_LARNACA, deposit_amount: 200, insurance_per_day: 17,
      young_driver_fee: true, young_driver_cost: 10, stock_count: 2, north_allowed: true,
      is_available: true, is_published: true, submission_status: 'approved',
    },
    {
      id: OFFER_PAPHOS,
      price_per_day: 65, price_3days: 210, price_4_6days: 65,
      price_7_10days: 60, price_10plus_days: 55, currency: 'EUR', location: 'paphos',
      owner_partner_id: PARTNER_PAPHOS, deposit_amount: 350, insurance_per_day: 17,
      young_driver_fee: false, young_driver_cost: 0, stock_count: 1, north_allowed: false,
      is_available: true, is_published: true, submission_status: 'approved',
    },
  ]);
  expect(await rows('car_offer_city_availability', 'select=offer_id,city_id')).toEqual([]);
  expect(await rows('car_offer_daily_rate_tiers', 'select=id')).toEqual([]);
  expect(await rows('car_rental_cities', 'code=like.ui-test-*&select=id')).toEqual([]);
  expect((await rows('site_settings', 'id=eq.1&select=car_multi_city_mapped_enabled'))[0]
    .car_multi_city_mapped_enabled).toBe(false);
  expect((await rows('site_settings', 'id=eq.1&select=car_threshold_daily_rates_enabled'))[0]
    .car_threshold_daily_rates_enabled).toBe(false);
}

function dashboardWithoutRuntimeScripts() {
  return fs.readFileSync(path.resolve('admin/dashboard.html'), 'utf8')
    .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '');
}

async function openHarness(page: any) {
  await page.setContent(dashboardWithoutRuntimeScripts(), { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ path: path.resolve('admin/admin.css') });
  await page.addScriptTag({ path: path.resolve('node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
  await page.addScriptTag({ path: path.resolve('admin/car-rental-multicity-core.js') });
  await page.addScriptTag({ path: path.resolve('admin/car-rental-multicity-repository.js') });
  await page.addScriptTag({ path: path.resolve('admin/car-rental-multicity-ui.js') });
  await page.evaluate(async ({ url, anonToken, adminToken }) => {
    const root = window as any;
    const client = root.supabase.createClient(url, anonToken, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
    });
    const repository = root.CarRentalMulticityRepository.create({
      client,
      core: root.CarRentalMulticityCore,
    });
    const ui = root.CarRentalMulticityAdmin.create({
      document,
      core: root.CarRentalMulticityCore,
      repository,
      showToast: (message: string, kind: string) => { root.__realToasts.push({ message, kind }); },
      openLegacyEditor: (offerId: string) => { root.__legacyExactOfferId = offerId; },
      onFleetRefresh: () => { root.__fleetRefreshes += 1; },
    });
    root.__realToasts = [];
    root.__fleetRefreshes = 0;
    root.__realClient = client;
    root.__realRepository = repository;
    root.__realMulticityAdmin = ui;
    const { data, error } = await client.from('car_offers').select('id,car_model,location').order('id');
    if (error) throw new Error(`Real PostgREST fleet read failed: ${JSON.stringify(error)}`);
    const body = document.getElementById('fleetTableBody');
    if (!body) throw new Error('Fleet table body missing');
    body.innerHTML = (data || []).map((offer: any) => `
      <tr data-real-offer-id="${offer.id}">
        <td>${offer.car_model?.en || offer.id}</td>
        <td>${offer.id}</td>
        <td>
          <button data-car-multicity-action="vehicle" data-offer-id="${offer.id}">Edit vehicle</button>
          <button data-car-multicity-action="availability" data-offer-id="${offer.id}">Availability</button>
          <button data-car-multicity-action="pricing" data-offer-id="${offer.id}">Pricing profile</button>
          <button data-car-multicity-action="partner" data-offer-id="${offer.id}">Partner</button>
          <button data-car-multicity-action="legacy" data-offer-id="${offer.id}">Legacy editor</button>
        </td>
      </tr>
    `).join('');
    const carsView = document.getElementById('viewCars');
    const fleetPanel = document.getElementById('carsTabFleet');
    if (carsView) {
      carsView.hidden = false;
      carsView.classList.add('active');
      carsView.style.display = 'block';
    }
    if (fleetPanel) {
      fleetPanel.hidden = false;
      fleetPanel.classList.add('active');
      fleetPanel.style.display = 'block';
    }
    ui.initialize();
  }, { url: URL, anonToken: TOKENS.anon, adminToken: TOKENS.admin });
  await expect(page.locator(`#fleetTableBody [data-real-offer-id="${OFFER_LARNACA}"]`)).toContainText('Mazda 2 test');
  await expect(page.locator(`#fleetTableBody [data-real-offer-id="${OFFER_PAPHOS}"]`)).toContainText('Paphos SUV test');
}

async function loadLegacyEditorRuntime(page: any) {
  await page.addScriptTag({ path: path.resolve('admin/universal-i18n-component.js') });
  await page.evaluate(() => {
    const root = window as any;
    root.getSupabase = () => root.__realClient;
    root.sb = root.__realClient;
  });
  for (const relativePath of ['admin/admin.js', 'admin/special-offers.js', 'js/car-pricing.js']) {
    const moduleUrl = `${APP_URL}/${relativePath}`;
    await page.route(moduleUrl, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: fs.readFileSync(path.resolve(relativePath), 'utf8'),
      });
    });
  }
  const moduleUrl = `${APP_URL}/admin/admin.js`;
  await page.addScriptTag({ url: moduleUrl, type: 'module' });
  await page.waitForFunction(() => typeof (window as any).openFleetCarModal === 'function');
}

async function openAction(page: any, offerId: string, action: string) {
  await page.locator(`[data-real-offer-id="${offerId}"] [data-car-multicity-action="${action}"]`).click();
  if (action !== 'legacy') {
    await expect(page.locator('#carMulticityModal')).toBeVisible();
    await expect(page.locator('#carMulticityExactOfferId')).toHaveText(offerId);
  }
}

async function saveReviewed(page: any, doubleClick = false) {
  await page.locator('#carMulticityReview').click();
  await expect(page.locator('#carMulticitySave')).toBeEnabled();
  await page.locator('#carMulticitySave').click();
  await expect(page.locator('#carMulticityConfirmDialog')).toBeVisible();
  if (doubleClick) {
    await page.locator('#carMulticityConfirmAccept').evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  } else {
    await page.locator('#carMulticityConfirmAccept').click();
  }
  await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
  await expect(page.locator('#carMulticityModalStatus')).toContainText('Fresh read-back succeeded');
}

test.describe('Car Rental Multi-City Stage 2C real PostgREST Admin integration', () => {
  test.skip(!ENABLED, 'Requires the isolated real PostgreSQL/PostgREST gate.');
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await openHarness(page);
  });

  test.afterEach(async () => {
    await resetDatabase();
    await assertCleanFinancialBaseline();
  });

  test.afterAll(async () => {
    if (ENABLED) await resetDatabase();
  });

  test('Fleet exact ID, vehicle-only write, fresh read-back and double Save', async ({ page }) => {
    const mutations: string[] = [];
    page.on('request', (request) => {
      if (['POST', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`);
    });
    const before = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    await openAction(page, OFFER_LARNACA, 'vehicle');
    await expect(page.locator('#carMulticityVehicleKind')).toHaveValue(KIND_CAR);
    await page.locator('#carMulticityVehicleKind').selectOption(KIND_QUAD);
    await saveReviewed(page, true);
    const after = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    expect(after.vehicle_kind_id).toBe(KIND_QUAD);
    expect(after.car_type).toEqual(before.car_type);
    for (const field of ['price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days', 'price_10plus_days']) {
      expect(after[field]).toBe(before[field]);
    }
    expect(mutations.filter((entry) => entry.includes('/rest/v1/car_offers'))).toHaveLength(1);
    expect(mutations.some((entry) => /car_bookings|service_deposit|partner_service|rpc\//.test(entry))).toBe(false);
  });

  test('availability writes only exact offer-city rows and Paphos blocks cross-city', async ({ page }) => {
    const offerBefore = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    await openAction(page, OFFER_LARNACA, 'availability');
    const nicosia = page.locator(`[data-city-id="${CITY_NICOSIA}"]`);
    await expect(nicosia).toContainText('€15.00 per direction');
    await nicosia.locator('[data-availability-field="paired"]').check();
    await nicosia.locator('[data-availability-field="fee_mode"]').selectOption('override');
    const fee = page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="fee_per_direction"]`);
    await fee.fill('0');
    await fee.press('Tab');
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"]`)).toContainText('€0.00 pickup · €0.00 return');
    await saveReviewed(page);
    const saved = await rows('car_offer_city_availability', `offer_id=eq.${OFFER_LARNACA}&city_id=eq.${CITY_NICOSIA}&select=*`);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(expect.objectContaining({
      offer_id: OFFER_LARNACA,
      city_id: CITY_NICOSIA,
      pickup_enabled: true,
      return_enabled: true,
      is_active: true,
      fee_mode: 'override',
      fee_per_direction: 0,
    }));
    const offerAfter = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    expect(offerAfter).toEqual(offerBefore);

    await page.locator('#carMulticityCloseFooter').click();
    await openAction(page, OFFER_PAPHOS, 'availability');
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="paired"]`)).toBeDisabled();
    await expect(page.locator(`[data-city-id="${CITY_PAPHOS}"] [data-availability-field="paired"]`)).toBeEnabled();
  });

  test('profile and partner plans preserve prices and independent availability', async ({ page }) => {
    const before = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    await openAction(page, OFFER_LARNACA, 'pricing');
    await page.locator('#carMulticityPricingProfile').selectOption(PROFILE_PAPHOS);
    await saveReviewed(page);
    const profiled = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    expect(profiled.pricing_profile_id).toBe(PROFILE_PAPHOS);
    expect(profiled.location).toBe('paphos');
    for (const field of ['price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days', 'price_10plus_days']) {
      expect(profiled[field]).toBe(before[field]);
    }

    await page.locator('#carMulticityCloseFooter').click();
    await api(`car_offers?id=eq.${OFFER_LARNACA}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: { pricing_profile_id: PROFILE_LARNACA, location: 'larnaca' },
    });
    await openAction(page, OFFER_LARNACA, 'partner');
    await page.locator('#carMulticityOwnerPartner').selectOption('');
    await saveReviewed(page);
    const partnerChanged = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    expect(partnerChanged.owner_partner_id).toBeNull();
    expect(await rows('car_offer_city_availability', `offer_id=eq.${OFFER_LARNACA}&select=*`)).toEqual([]);
  });

  test('Pricing and profile updates only the active exact price and preserves hidden tiers', async ({ page }) => {
    const before = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    const writes: string[] = [];
    page.on('request', (request) => {
      if (['POST', 'PATCH', 'DELETE'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
    });
    await openAction(page, OFFER_LARNACA, 'pricing');
    await expect(page.locator('#carMulticityReview')).toHaveText('Review price changes');
    await page.locator('#carMulticityPricePerDay').fill('41.50');
    await saveReviewed(page, true);
    const after = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    expect(after.price_per_day).toBe(41.5);
    for (const field of ['price_3days', 'price_4_6days', 'price_7_10days', 'price_10plus_days']) {
      expect(after[field]).toBe(before[field]);
    }
    expect(after).toEqual(expect.objectContaining({
      id: OFFER_LARNACA,
      location: before.location,
      pricing_profile_id: before.pricing_profile_id,
      owner_partner_id: before.owner_partner_id,
      stock_count: before.stock_count,
      deposit_amount: before.deposit_amount,
    }));
    expect(writes.filter((entry) => entry.includes('/rest/v1/car_offers'))).toHaveLength(1);
    expect(writes.some((entry) => /availability|service_deposit|partner|car_bookings|rpc\//.test(entry))).toBe(false);
  });

  test('threshold daily-rate Admin saves exact tiers, synchronizes minimum and leaves activation OFF', async ({ page }) => {
    await openAction(page, OFFER_LARNACA, 'pricing');
    await page.locator('#carMulticityPricingStrategy').selectOption('threshold_daily_rate');
    for (let index = 0; index < 3; index += 1) await page.locator('[data-tier-action="add"]').click();
    const tierCards = page.locator('[data-tier-key]');
    for (const [index, threshold, rate] of [[0, 1, 50], [1, 3, 45], [2, 7, 40]] as const) {
      await tierCards.nth(index).locator('[data-tier-field="threshold_days"]').fill(String(threshold));
      await tierCards.nth(index).locator('[data-tier-field="daily_rate"]').fill(String(rate));
    }
    await page.locator('[data-draft-field="pricing.maxRentalDays"]').fill('');
    await saveReviewed(page, true);

    expect((await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=id,pricing_strategy,min_rental_days,max_rental_days,location,pricing_profile_id,availability_mode`))[0])
      .toEqual({
        id: OFFER_LARNACA,
        pricing_strategy: 'threshold_daily_rate',
        min_rental_days: 1,
        max_rental_days: null,
        location: 'larnaca',
        pricing_profile_id: PROFILE_LARNACA,
        availability_mode: 'legacy',
      });
    expect((await rows('car_offer_daily_rate_tiers', `offer_id=eq.${OFFER_LARNACA}&select=threshold_days,daily_rate,is_active&order=threshold_days.asc`)))
      .toEqual([
        { threshold_days: 1, daily_rate: 50, is_active: true },
        { threshold_days: 3, daily_rate: 45, is_active: true },
        { threshold_days: 7, daily_rate: 40, is_active: true },
      ]);
    const flags = (await rows('site_settings', 'id=eq.1&select=car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled'))[0];
    expect(flags).toEqual({ car_multi_city_mapped_enabled: false, car_threshold_daily_rates_enabled: false });
  });

  test('city create is inactive, mapping uses exact composite key, and no assignment is implicit', async ({ page }) => {
    await page.locator('#btnManageCarMulticity').click();
    await expect(page.locator('#carMulticityCatalogModal')).toBeVisible();
    await page.locator('[data-catalog-action="add-city"]').click();
    await page.locator('[data-city-editor-field="code"]').fill('ui-test-city');
    await page.locator('[data-city-editor-field="name_en"]').fill('UI Test City');
    await page.locator('[data-city-editor-field="name_pl"]').fill('UI Test City');
    await page.locator('[data-city-editor-field="name_he"]').fill('עיר בדיקה');
    for (let step = 0; step < 4; step += 1) {
      await page.locator('[data-catalog-action="city-editor-next"]').click();
    }
    await page.locator('[data-catalog-action="save-city-editor"]').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityCatalogStatus')).toContainText('Inactive city created');
    const created = await rows('car_rental_cities', 'code=eq.ui-test-city&select=*');
    expect(created).toHaveLength(1);
    expect(created[0].is_active).toBe(false);
    expect(await rows('car_pricing_profile_cities', `city_id=eq.${created[0].id}&select=*`)).toEqual([]);
    expect(await rows('car_offer_city_availability', `city_id=eq.${created[0].id}&select=*`)).toEqual([]);

    await page.locator('#carMulticityCatalogMappingsTab').click();
    const exactRow = page.locator(`[data-mapping-profile-id="${PROFILE_LARNACA}"][data-mapping-city-id="${CITY_NICOSIA}"]`);
    await exactRow.locator('[data-mapping-field="paired_supported"]').uncheck();
    await exactRow.locator('[data-mapping-field="is_active"]').uncheck();
    await exactRow.locator('[data-catalog-action="save-mapping"]').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityCatalogStatus')).toContainText('impact review');
    const mapping = (await rows('car_pricing_profile_cities', `pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}&select=*`))[0];
    expect(mapping).toEqual(expect.objectContaining({ pickup_supported: false, return_supported: false, is_active: false }));
  });

  test('Add New Car stays legacy, keeps flag false and inserts only selected availability', async ({ page }) => {
    await page.locator('#btnAddFleetCar').click();
    await expect(page.locator('#carMulticityModal')).toBeVisible();
    await page.locator('#vehicle-carModel-en').fill('UI Test New Car');
    await page.locator('#vehicle-carModel-pl').fill('UI Test New Car');
    await page.locator('#vehicle-carModel-he').fill('רכב חדש בדיקה');
    await page.locator('#vehicle-carType-en').fill('Economy');
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityPricingProfile').selectOption(PROFILE_LARNACA);
    await page.locator('[data-draft-field="pricing.pricePerDay"]').fill('42');
    await page.locator('#carMulticityNext').click();
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="paired"]`)).toBeChecked();
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="paired"]`)).not.toBeChecked();
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityNext').click();
    await saveReviewed(page);
    const created = await rows('car_offers', 'car_model->>en=eq.UI%20Test%20New%20Car&select=*');
    expect(created).toHaveLength(1);
    expect(created[0].availability_mode).toBe('legacy');
    expect(created[0].location).toBe('larnaca');
    const availability = await rows('car_offer_city_availability', `offer_id=eq.${created[0].id}&select=*`);
    expect(availability).toHaveLength(1);
    expect(availability[0].city_id).toBe(CITY_LARNACA);
    expect((await rows('site_settings', 'id=eq.1&select=car_multi_city_mapped_enabled'))[0].car_multi_city_mapped_enabled).toBe(false);
  });

  test('stale preflight causes zero UI mutations and Legacy fallback keeps exact ID', async ({ page }) => {
    await openAction(page, OFFER_LARNACA, 'vehicle');
    await page.locator('#carMulticityVehicleKind').selectOption(KIND_QUAD);
    await page.locator('#carMulticityReview').click();
    await page.locator('#carMulticitySave').click();
    await api(`car_offers?id=eq.${OFFER_LARNACA}`, {
      method: 'PATCH', prefer: 'return=minimal', body: { vehicle_kind_id: KIND_QUAD },
    });
    const pageWrites: string[] = [];
    page.on('request', (request) => {
      if (['POST', 'PATCH', 'DELETE'].includes(request.method())) pageWrites.push(request.url());
    });
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityModalStatus')).toContainText('Data changed since Review');
    expect(pageWrites).toEqual([]);
    await page.locator('#carMulticityModalClose').click();
    await openAction(page, OFFER_LARNACA, 'legacy');
    expect(await page.evaluate(() => (window as any).__legacyExactOfferId)).toBe(OFFER_LARNACA);
  });

  test('Legacy editor writes price/content through real PostgREST and blocks location changes', async ({ page }) => {
    await loadLegacyEditorRuntime(page);
    const before = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    await page.evaluate(async (offerId: string) => {
      const root = window as any;
      const { data, error } = await root.__realClient.from('car_offers').select('*').eq('id', offerId).single();
      if (error) throw error;
      root.openFleetCarModal(data);
    }, OFFER_LARNACA);

    await expect(page.locator('#fleetCarModal')).toBeVisible();
    await expect(page.locator('#fleetCarId')).toHaveValue(OFFER_LARNACA);
    await expect(page.locator('#fleetCarLocation')).toBeDisabled();

    const blockedWrites: string[] = [];
    const blockedWriteListener = (request: any) => {
      if (['POST', 'PATCH', 'DELETE'].includes(request.method())) blockedWrites.push(request.url());
    };
    page.on('request', blockedWriteListener);
    await page.locator('#fleetCarLocation').evaluate((select: HTMLSelectElement) => {
      select.disabled = false;
      select.value = 'paphos';
    });
    await page.evaluate(async () => {
      const root = window as any;
      await root.handleFleetCarSubmit({
        preventDefault() {},
        target: document.getElementById('fleetCarForm'),
      });
    });
    await expect(page.locator('#fleetCarFormError')).toContainText('Location changes are blocked');
    expect(blockedWrites).toEqual([]);
    expect((await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=location`))[0].location).toBe('larnaca');
    page.off('request', blockedWriteListener);

    await page.evaluate(async (offerId: string) => {
      const root = window as any;
      const { data, error } = await root.__realClient.from('car_offers').select('*').eq('id', offerId).single();
      if (error) throw error;
      root.openFleetCarModal(data);
    }, OFFER_LARNACA);
    await page.locator('#fleetCarPricePerDay').fill('36');
    await page.locator('[name="description_en"]').fill('Legacy integration edit');
    await page.evaluate(async () => {
      const root = window as any;
      await root.handleFleetCarSubmit({
        preventDefault() {},
        target: document.getElementById('fleetCarForm'),
      });
    });
    await expect(page.locator('#fleetCarModal')).toBeHidden();
    const after = (await rows('car_offers', `id=eq.${OFFER_LARNACA}&select=*`))[0];
    expect(after.id).toBe(OFFER_LARNACA);
    expect(after.location).toBe('larnaca');
    expect(after.pricing_profile_id).toBe(PROFILE_LARNACA);
    expect(after.price_per_day).toBe(36);
    expect(after.description.en).toBe('Legacy integration edit');
    expect(after.owner_partner_id).toBe(before.owner_partner_id);
  });
});
