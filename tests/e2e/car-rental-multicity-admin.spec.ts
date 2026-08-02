import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const OFFER_ID = 'ca300001-0000-4000-8000-000000000001';
const PROFILE_LARNACA = 'ca210001-0000-4000-8000-000000000001';
const PROFILE_PAPHOS = 'ca210001-0000-4000-8000-000000000002';
const CITY_LARNACA = 'ca200001-0000-4000-8000-000000000001';
const CITY_NICOSIA = 'ca200001-0000-4000-8000-000000000002';
const CITY_PAPHOS = 'ca200001-0000-4000-8000-000000000006';
const KIND_CAR = 'ca220001-0000-4000-8000-000000000001';
const KIND_QUAD = 'ca220001-0000-4000-8000-000000000002';

function adminSeedScript() {
  return () => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        const admin = stub.seedUser({
          email: 'cars.admin@example.com',
          password: 'admin-password',
          profile: { id: 'cars-admin', email: 'cars.admin@example.com', username: 'carsadmin', name: 'Cars Admin', is_admin: true },
        });
        stub.seedTable('profiles', [{ id: admin.id, email: admin.email, username: 'carsadmin', name: 'Cars Admin', is_admin: true }]);
        stub.seedTable('admin_users_overview', [{ id: admin.id, email: admin.email, username: 'carsadmin', name: 'Cars Admin', is_admin: true, created_at: '2026-08-01T00:00:00.000Z' }]);
        stub.seedTable('admin_system_diagnostics', [{ metric: 'total_users', value: 1 }]);
        stub.seedTable('site_settings', [{ id: 1, force_refresh_version: 0, car_multi_city_mapped_enabled: false, updated_at: '2026-08-02T08:00:00.000Z' }]);
        stub.seedTable('car_rental_cities', [
          { id: 'ca200001-0000-4000-8000-000000000001', code: 'larnaca', name_i18n: { pl: 'Larnaka', en: 'Larnaca', he: 'לרנקה' }, place_types: ['city'], is_active: true, sort_order: 10, updated_at: '2026-08-02T08:01:00.000Z' },
          { id: 'ca200001-0000-4000-8000-000000000002', code: 'nicosia', name_i18n: { pl: 'Nikozja', en: 'Nicosia', he: 'ניקוסיה' }, place_types: ['city'], is_active: true, sort_order: 20, updated_at: '2026-08-02T08:02:00.000Z' },
          { id: 'ca200001-0000-4000-8000-000000000006', code: 'paphos', name_i18n: { pl: 'Pafos', en: 'Paphos', he: 'פאפוס' }, place_types: ['city'], is_active: true, sort_order: 60, updated_at: '2026-08-02T08:06:00.000Z' },
        ]);
        stub.seedTable('car_pricing_profiles', [
          { id: 'ca210001-0000-4000-8000-000000000001', code: 'larnaca', name: 'Larnaca legacy pricing profile', calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true, updated_at: '2026-08-02T08:10:00.000Z' },
          { id: 'ca210001-0000-4000-8000-000000000002', code: 'paphos', name: 'Paphos legacy pricing profile', calculator_key: 'paphos', legacy_booking_location: 'paphos', is_active: true, updated_at: '2026-08-02T08:11:00.000Z' },
        ]);
        stub.seedTable('car_pricing_profile_cities', [
          { id: 'mapping-larnaca', pricing_profile_id: 'ca210001-0000-4000-8000-000000000001', city_id: 'ca200001-0000-4000-8000-000000000001', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'larnaca', is_active: true, updated_at: '2026-08-02T08:20:00.000Z' },
          { id: 'mapping-nicosia', pricing_profile_id: 'ca210001-0000-4000-8000-000000000001', city_id: 'ca200001-0000-4000-8000-000000000002', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'nicosia', is_active: true, updated_at: '2026-08-02T08:21:00.000Z' },
          { id: 'mapping-lca-paphos', pricing_profile_id: 'ca210001-0000-4000-8000-000000000001', city_id: 'ca200001-0000-4000-8000-000000000006', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true, updated_at: '2026-08-02T08:22:00.000Z' },
          { id: 'mapping-paphos', pricing_profile_id: 'ca210001-0000-4000-8000-000000000002', city_id: 'ca200001-0000-4000-8000-000000000006', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true, updated_at: '2026-08-02T08:23:00.000Z' },
        ]);
        stub.seedTable('car_vehicle_kinds', [
          { id: 'ca220001-0000-4000-8000-000000000001', code: 'car', name_i18n: { en: 'Car' }, is_active: true, sort_order: 10 },
          { id: 'ca220001-0000-4000-8000-000000000002', code: 'quad', name_i18n: { en: 'Quad' }, is_active: true, sort_order: 20 },
          { id: 'ca220001-0000-4000-8000-000000000003', code: 'buggy', name_i18n: { en: 'Buggy' }, is_active: true, sort_order: 30 },
        ]);
        stub.seedTable('partners', [
          { id: 'partner-one', name: 'Cars Partner', status: 'active', can_manage_cars: true, cars_locations: ['larnaca'], updated_at: '2026-08-02T08:30:00.000Z' },
          { id: 'partner-disabled', name: 'Disabled Partner', status: 'suspended', can_manage_cars: true, cars_locations: ['paphos'], updated_at: '2026-08-02T08:31:00.000Z' },
        ]);
        stub.seedTable('partner_resources', [{ id: 'partner-resource-one', partner_id: 'partner-one', resource_type: 'cars', resource_id: 'ca300001-0000-4000-8000-000000000001', created_at: '2026-08-02T08:32:00.000Z' }]);
        stub.seedTable('car_offers', [{
          id: 'ca300001-0000-4000-8000-000000000001',
          updated_at: '2026-08-02T09:00:00.000Z',
          location: 'larnaca', pricing_profile_id: 'ca210001-0000-4000-8000-000000000001', availability_mode: 'legacy', vehicle_kind_id: 'ca220001-0000-4000-8000-000000000001',
          car_model: { pl: 'Mazda 2', en: 'Mazda 2', he: 'מאזדה 2' }, car_type: { pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' }, description: { pl: 'Opis', en: 'Description', he: 'תיאור' }, features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
          transmission: 'automatic', fuel_type: 'petrol', currency: 'EUR', max_passengers: 5, max_luggage: 2, stock_count: 2, sort_order: 10,
          price_per_day: 35, price_3days: 105, price_4_6days: 34, price_7_10days: 31, price_10plus_days: 29,
          deposit_amount: 200, insurance_per_day: 17, young_driver_fee: true, young_driver_cost: 10,
          owner_partner_id: 'partner-one', north_allowed: true, is_available: true, is_published: true, submission_status: 'approved', image_url: '/assets/mazda.jpg',
        }]);
        stub.seedTable('car_offer_city_availability', [
          { id: 'availability-larnaca', offer_id: 'ca300001-0000-4000-8000-000000000001', city_id: 'ca200001-0000-4000-8000-000000000001', pickup_enabled: true, return_enabled: true, is_active: true, updated_at: '2026-08-02T09:10:00.000Z' },
        ]);
        stub.seedTable('car_bookings', []);
        stub.seedTable('service_deposit_rules', []);
        stub.seedTable('service_deposit_overrides', []);
        stub.seedTable('service_deposit_requests', []);
        stub.seedTable('partner_service_fulfillments', []);
        stub.setSession({ id: admin.id, email: admin.email, user_metadata: { name: 'Cars Admin' } });
      },
    };
  };
}

async function openFleet(page: any) {
  await page.addInitScript(adminSeedScript());
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await page.locator('button.admin-nav-item[data-view="cars"]').click();
  await page.locator('.cars-tab-button[data-tab="fleet"]').click();
  await expect(page.locator('#viewCars')).toBeVisible();
  await expect(page.locator('#fleetTableBody')).toContainText('Mazda 2');
}

async function openAction(page: any, action: string) {
  const button = page.locator(`#fleetTableBody [data-car-multicity-action="${action}"]`).first();
  await button.evaluate((element: HTMLButtonElement) => element.click());
  if (action !== 'legacy') {
    await expect(page.locator('#carMulticityModal')).toBeVisible();
    await expect(page.locator('#carMulticityExactOfferId')).toHaveText(OFFER_ID);
  }
}

async function clearMutations(page: any) {
  await page.evaluate(() => (window as any).__supabaseStub.clearMutationCalls());
}

test.describe('Car Rental Multi-City Stage 2C Admin', () => {
  test.beforeEach(async ({ page }) => {
    await openFleet(page);
  });

  test('Fleet actions open exact vehicle, availability, profile, partner and Legacy editor', async ({ page }) => {
    await openAction(page, 'vehicle');
    await expect(page.locator('#carMulticityVehicleKind')).toHaveValue(KIND_CAR);
    await page.locator('#carMulticityModalClose').click();

    await openAction(page, 'availability');
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="pickup_enabled"]`)).toBeChecked();
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="return_enabled"]`)).toBeChecked();
    await page.locator('#carMulticityModalClose').click();

    await openAction(page, 'pricing');
    await expect(page.locator('#carMulticityPricingProfile')).toHaveValue(PROFILE_LARNACA);
    await expect(page.locator('#carMulticityModalContent')).toContainText('price_per_day');
    await page.locator('#carMulticityModalClose').click();

    await openAction(page, 'partner');
    await expect(page.locator('#carMulticityOwnerPartner')).toHaveValue('partner-one');
    await expect(page.locator('#carMulticityModalContent')).toContainText('partner-resource-one');
    await page.locator('#carMulticityModalClose').click();

    await openAction(page, 'legacy');
    await expect(page.locator('#fleetCarModal')).toBeVisible();
    await expect(page.locator('#fleetCarLocation')).toBeDisabled();
    await expect(page.locator('#fleetCarLegacyLocationNotice')).toContainText('Pricing profile');
  });

  test('Larnaca availability saves independent pickup/return without prices, partner or protected writes', async ({ page }) => {
    await openAction(page, 'availability');
    await clearMutations(page);
    const nicosia = page.locator(`[data-city-id="${CITY_NICOSIA}"]`);
    await nicosia.locator('[data-availability-field="pickup_enabled"]').check();
    await expect(nicosia.locator('[data-availability-field="return_enabled"]')).not.toBeChecked();
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText(CITY_NICOSIA);
    await expect(page.locator('#carMulticityModalContent')).toContainText('Existing price column changes');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Global mapped flag changes');
    await page.locator('#carMulticitySave').click();
    await expect(page.locator('#carMulticityConfirmDialog')).toBeVisible();
    await page.locator('#carMulticityConfirmAccept').evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const result = await page.evaluate(({ offerId, cityId }) => {
      const stub = (window as any).__supabaseStub;
      const offer = stub.getTableRows('car_offers').find((row: any) => row.id === offerId);
      const availability = stub.getTableRows('car_offer_city_availability').find((row: any) => row.offer_id === offerId && row.city_id === cityId);
      return { offer, availability, mutations: stub.getMutationCalls() };
    }, { offerId: OFFER_ID, cityId: CITY_NICOSIA });
    expect(result.availability).toEqual(expect.objectContaining({ pickup_enabled: true, return_enabled: false, is_active: true }));
    expect(result.offer.price_per_day).toBe(35);
    expect(result.offer.owner_partner_id).toBe('partner-one');
    expect(result.mutations.filter((call: any) => call.table === 'car_offer_city_availability' && call.action === 'insert')).toHaveLength(1);
    expect(result.mutations.some((call: any) => ['car_bookings', 'service_deposit_overrides', 'partner_resources', 'partner_service_fulfillments', 'service_coupons', 'coupons'].includes(call.table))).toBe(false);
    expect(result.mutations.some((call: any) => call.table === 'site_settings')).toBe(false);
  });

  test('Paphos profile UI blocks every non-Paphos city', async ({ page }) => {
    await page.evaluate(({ offerId, profileId }) => {
      const stub = (window as any).__supabaseStub;
      const offers = stub.getTableRows('car_offers');
      stub.seedTable('car_offers', offers.map((row: any) => row.id === offerId ? { ...row, location: 'paphos', pricing_profile_id: profileId } : row));
      stub.seedTable('car_offer_city_availability', [{ id: 'availability-paphos', offer_id: offerId, city_id: 'ca200001-0000-4000-8000-000000000006', pickup_enabled: true, return_enabled: true, is_active: true, updated_at: 'paphos-a1' }]);
    }, { offerId: OFFER_ID, profileId: PROFILE_PAPHOS });
    await page.evaluate(() => (window as any).loadFleetData({ silent: true }));
    await openAction(page, 'availability');
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="pickup_enabled"]`)).toBeDisabled();
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="return_enabled"]`)).toBeDisabled();
    await expect(page.locator(`[data-city-id="${CITY_PAPHOS}"] [data-availability-field="pickup_enabled"]`)).toBeEnabled();
  });

  test('vehicle kind change updates exact offer without changing car_type, prices or availability', async ({ page }) => {
    await openAction(page, 'vehicle');
    await clearMutations(page);
    await page.locator('#carMulticityVehicleKind').selectOption(KIND_QUAD);
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('vehicle_kind_id');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        availability: stub.getTableRows('car_offer_city_availability'),
        mutations: stub.getMutationCalls(),
      };
    }, OFFER_ID);
    expect(result.offer.vehicle_kind_id).toBe(KIND_QUAD);
    expect(result.offer.car_type.en).toBe('Economy');
    expect(result.offer.price_per_day).toBe(35);
    expect(result.availability).toHaveLength(1);
    expect(result.mutations.filter((call: any) => call.table === 'car_offers' && call.action === 'update')).toHaveLength(1);
  });

  test('profile change preserves all existing price columns and updates profile plus location together', async ({ page }) => {
    await page.evaluate(() => (window as any).__supabaseStub.seedTable('car_offer_city_availability', []));
    await openAction(page, 'pricing');
    await clearMutations(page);
    const before = await page.evaluate((offerId) => (window as any).__supabaseStub.getTableRows('car_offers').find((row: any) => row.id === offerId), OFFER_ID);
    await page.locator('#carMulticityPricingProfile').selectOption(PROFILE_PAPHOS);
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('location');
    await expect(page.locator('#carMulticityModalContent')).toContainText('pricing_profile_id');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Existing price column changes');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const after = await page.evaluate((offerId) => (window as any).__supabaseStub.getTableRows('car_offers').find((row: any) => row.id === offerId), OFFER_ID);
    expect(after.pricing_profile_id).toBe(PROFILE_PAPHOS);
    expect(after.location).toBe('paphos');
    for (const column of ['price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days', 'price_10plus_days']) {
      expect(after[column]).toBe(before[column]);
    }
  });

  test('partner save changes only owner_partner_id and preserves availability plus partner resources', async ({ page }) => {
    await openAction(page, 'partner');
    await clearMutations(page);
    const availabilityBefore = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('car_offer_city_availability'));
    const resourcesBefore = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('partner_resources'));
    await page.locator('#carMulticityOwnerPartner').selectOption('');
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText(OFFER_ID);
    await expect(page.locator('#carMulticityModalContent')).toContainText('owner_partner_id');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        availability: stub.getTableRows('car_offer_city_availability'),
        resources: stub.getTableRows('partner_resources'),
        mutations: stub.getMutationCalls(),
      };
    }, OFFER_ID);
    expect(result.offer.owner_partner_id).toBeNull();
    expect(result.availability).toEqual(availabilityBefore);
    expect(result.resources).toEqual(resourcesBefore);
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toEqual(expect.objectContaining({ table: 'car_offers', action: 'update' }));
  });

  test('stale updated_at blocks every mutation before Save', async ({ page }) => {
    await openAction(page, 'vehicle');
    await page.locator('[data-draft-field="vehicle.stockCount"]').fill('3');
    await page.locator('#carMulticityReview').click();
    await page.locator('#carMulticitySave').click();
    await clearMutations(page);
    await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('car_offers', stub.getTableRows('car_offers').map((row: any) => row.id === offerId ? { ...row, updated_at: 'external-change' } : row));
    }, OFFER_ID);
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityModalStatus')).toContainText('Data changed since Review');
    expect(await page.evaluate(() => (window as any).__supabaseStub.getMutationCalls())).toEqual([]);
  });

  test('new city is created inactive without mappings, offer assignment or public activation', async ({ page }) => {
    await clearMutations(page);
    await page.locator('#btnManageCarMulticity').click();
    await expect(page.locator('#carMulticityCatalogModal')).toBeVisible();
    const form = page.locator('#carMulticityNewCityForm');
    await form.locator('[name="code"]').fill('polis-test');
    await form.locator('[name="nameEn"]').fill('Polis Test');
    await form.locator('[name="namePl"]').fill('Polis Test');
    await form.locator('[name="nameHe"]').fill('פוליס');
    await form.locator('[name="placeType"]').selectOption('city');
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('#carMulticityConfirmDialog')).toContainText('Profile mappings created: 0');
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityCatalogStatus')).toContainText('Inactive city created');
    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const city = stub.getTableRows('car_rental_cities').find((row: any) => row.code === 'polis-test');
      return {
        city,
        mappings: stub.getTableRows('car_pricing_profile_cities').filter((row: any) => row.city_id === city?.id),
        availability: stub.getTableRows('car_offer_city_availability').filter((row: any) => row.city_id === city?.id),
        setting: stub.getTableRows('site_settings')[0],
      };
    });
    expect(result.city.is_active).toBe(false);
    expect(result.mappings).toEqual([]);
    expect(result.availability).toEqual([]);
    expect(result.setting.car_multi_city_mapped_enabled).toBe(false);
  });

  test('existing city i18n edit uses exact ID and does not create mappings or assignments', async ({ page }) => {
    await page.locator('#btnManageCarMulticity').click();
    const row = page.locator(`[data-catalog-city-id="${CITY_LARNACA}"]`);
    await row.locator('[data-city-field="name_pl"]').fill('Larnaka testowa');
    await row.locator('[data-city-field="name_he"]').fill('לרנקה בדיקה');
    await clearMutations(page);
    await row.locator('[data-catalog-action="save-city"]').click();
    await expect(page.locator('#carMulticityConfirmDialog')).toContainText(CITY_LARNACA);
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityCatalogStatus')).toContainText('exact ID');
    const result = await page.evaluate((cityId) => {
      const stub = (window as any).__supabaseStub;
      return {
        city: stub.getTableRows('car_rental_cities').find((entry: any) => entry.id === cityId),
        mappings: stub.getTableRows('car_pricing_profile_cities'),
        availability: stub.getTableRows('car_offer_city_availability'),
        mutations: stub.getMutationCalls(),
      };
    }, CITY_LARNACA);
    expect(result.city.name_i18n).toEqual(expect.objectContaining({ pl: 'Larnaka testowa', en: 'Larnaca', he: 'לרנקה בדיקה' }));
    expect(result.mappings).toHaveLength(4);
    expect(result.availability).toHaveLength(1);
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toEqual(expect.objectContaining({ table: 'car_rental_cities', action: 'update' }));
  });

  test('profile-city change reviews exact readiness impact before exact composite-key save', async ({ page }) => {
    await page.locator('#btnManageCarMulticity').click();
    await page.locator('#carMulticityCatalogMappingsTab').click();
    const row = page.locator(`[data-mapping-profile-id="${PROFILE_LARNACA}"][data-mapping-city-id="${CITY_LARNACA}"]`);
    await row.locator('[data-mapping-field="return_supported"]').uncheck();
    await clearMutations(page);
    await row.locator('[data-catalog-action="save-mapping"]').click();
    await expect(page.locator('#carMulticityConfirmDialog')).toContainText('Readiness invalidated: 1');
    await expect(page.locator('#carMulticityConfirmDialog')).toContainText(OFFER_ID);
    expect(await page.evaluate(() => (window as any).__supabaseStub.getMutationCalls())).toEqual([]);
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityCatalogStatus')).toContainText('impact review');
    const result = await page.evaluate(({ profileId, cityId }) => {
      const stub = (window as any).__supabaseStub;
      return {
        mapping: stub.getTableRows('car_pricing_profile_cities').find((entry: any) => entry.pricing_profile_id === profileId && entry.city_id === cityId),
        flag: stub.getTableRows('site_settings')[0].car_multi_city_mapped_enabled,
        mutations: stub.getMutationCalls(),
      };
    }, { profileId: PROFILE_LARNACA, cityId: CITY_LARNACA });
    expect(result.mapping.return_supported).toBe(false);
    expect(result.flag).toBe(false);
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toEqual(expect.objectContaining({ table: 'car_pricing_profile_cities', action: 'update' }));
  });

  test('Add New Car creates legacy offer with only the consciously selected default city', async ({ page }) => {
    await clearMutations(page);
    await page.locator('#btnAddFleetCar').click();
    await expect(page.locator('#carMulticityModal')).toBeVisible();
    await page.locator('#vehicle-carModel-en').fill('Stage 2C Test Car');
    await page.locator('#vehicle-carModel-pl').fill('Auto testowe Stage 2C');
    await page.locator('#vehicle-carModel-he').fill('רכב בדיקה');
    await page.locator('#carMulticityCarType').fill('Economy');
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityPricingProfile').selectOption(PROFILE_LARNACA);
    await page.locator('[data-draft-field="pricing.pricePerDay"]').fill('42');
    await page.locator('#carMulticityNext').click();
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="pickup_enabled"]`)).toBeChecked();
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="pickup_enabled"]`)).not.toBeChecked();
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Legacy');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const result = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      const created = stub.getTableRows('car_offers').find((row: any) => row.car_model?.en === 'Stage 2C Test Car');
      return {
        created,
        availability: stub.getTableRows('car_offer_city_availability').filter((row: any) => row.offer_id === created?.id),
        mutations: stub.getMutationCalls(),
      };
    });
    expect(result.created).toEqual(expect.objectContaining({ availability_mode: 'legacy', location: 'larnaca', pricing_profile_id: PROFILE_LARNACA }));
    expect(result.availability).toHaveLength(1);
    expect(result.availability[0].city_id).toBe(CITY_LARNACA);
    expect(result.mutations.some((call: any) => ['car_bookings', 'service_deposit_overrides', 'partner_service_fulfillments', 'service_coupons', 'coupons'].includes(call.table))).toBe(false);
  });
});
