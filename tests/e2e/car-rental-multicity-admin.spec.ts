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
const KYMCO_OFFER_ID = '2817e6de-25ba-5237-b721-dbc0460a7de4';
const KYMCO_TIER_3_ID = '177d85ab-4c2d-5eea-bce6-9bd06adc397a';
const KYMCO_BOOKING_ID = 'ca3f0000-0000-4000-8000-000000000270';

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
        stub.seedTable('site_settings', [{ id: 1, force_refresh_version: 0, car_multi_city_mapped_enabled: false, car_threshold_daily_rates_enabled: false, updated_at: '2026-08-02T08:00:00.000Z' }]);
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
          { id: 'ca220001-0000-4000-8000-000000000004', code: 'scooter', name_i18n: { en: 'Scooter' }, is_active: true, sort_order: 40 },
          { id: 'ca220001-0000-4000-8000-000000000005', code: 'bicycle', name_i18n: { en: 'Bicycle' }, is_active: true, sort_order: 50 },
        ]);
        stub.seedTable('partners', [
          { id: 'partner-one', name: 'Cars Partner', status: 'active', can_manage_cars: true, cars_locations: ['larnaca'], updated_at: '2026-08-02T08:30:00.000Z' },
          { id: 'partner-disabled', name: 'Disabled Partner', status: 'suspended', can_manage_cars: true, cars_locations: ['paphos'], updated_at: '2026-08-02T08:31:00.000Z' },
        ]);
        stub.seedTable('partner_resources', [{ id: 'partner-resource-one', partner_id: 'partner-one', resource_type: 'cars', resource_id: 'ca300001-0000-4000-8000-000000000001', created_at: '2026-08-02T08:32:00.000Z' }]);
        stub.seedTable('car_offers', [{
          id: 'ca300001-0000-4000-8000-000000000001',
          updated_at: '2026-08-02T09:00:00.000Z',
          location: 'larnaca', pricing_profile_id: 'ca210001-0000-4000-8000-000000000001', availability_mode: 'legacy', pricing_strategy: 'legacy_compat', vehicle_kind_id: 'ca220001-0000-4000-8000-000000000001',
          car_model: { pl: 'Mazda 2', en: 'Mazda 2', he: 'מאזדה 2' }, car_type: { pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' }, description: { pl: 'Opis', en: 'Description', he: 'תיאור' }, features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
          transmission: 'automatic', fuel_type: 'petrol', currency: 'EUR', max_passengers: 5, max_luggage: 2, stock_count: 2, sort_order: 10,
          price_per_day: 35, price_3days: 105, price_4_6days: 34, price_7_10days: 31, price_10plus_days: 29,
          deposit_amount: 200, insurance_mode: 'legacy_optional_daily', insurance_per_day: 17, young_driver_fee: true, young_driver_cost: 10,
          min_rental_days: 1, max_rental_days: 30, engine_capacity_cc: null, required_licence_category: null, minimum_driver_age: null,
          owner_partner_id: 'partner-one', north_allowed: true, is_available: true, is_published: true, submission_status: 'approved', image_url: '/assets/mazda.jpg',
        }]);
        stub.seedTable('car_offer_city_availability', [
          { id: 'availability-larnaca', offer_id: 'ca300001-0000-4000-8000-000000000001', city_id: 'ca200001-0000-4000-8000-000000000001', pickup_enabled: true, return_enabled: true, is_active: true, fee_mode: 'inherit', fee_per_direction: null, fee_note: null, updated_at: '2026-08-02T09:10:00.000Z' },
        ]);
        stub.setRpcHandler('admin_save_car_offer_city_availability_batch', (params: any, helpers: any) => {
          const offerId = String(params.p_offer_id || '');
          const allRows = helpers.getTableRows('car_offer_city_availability');
          const current = allRows.filter((row: any) => String(row.offer_id) === offerId);
          const expected = (params.p_expected_rows || []).map((row: any) => ({ city_id: row.city_id, updated_at: row.updated_at || null }))
            .sort((a: any, b: any) => String(a.city_id).localeCompare(String(b.city_id)));
          const actual = current.map((row: any) => ({ city_id: row.city_id, updated_at: row.updated_at || null }))
            .sort((a: any, b: any) => String(a.city_id).localeCompare(String(b.city_id)));
          if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('availability_batch_stale');
          const desired = (params.p_desired_rows || []).map((row: any, index: number) => {
            const existing = current.find((candidate: any) => String(candidate.city_id) === String(row.city_id));
            return {
              ...existing,
              ...row,
              id: existing?.id || `availability-batch-${index + 1}`,
              offer_id: offerId,
              is_active: row.pickup_enabled === true || row.return_enabled === true,
              updated_at: `availability-batch-v${index + 1}`,
            };
          });
          helpers.setTableRows('car_offer_city_availability', [
            ...allRows.filter((row: any) => String(row.offer_id) !== offerId),
            ...desired,
          ]);
          return { data: { offer_id: offerId, row_count: desired.length, rows: desired }, error: null };
        });
        stub.setRpcHandler('admin_set_car_threshold_offer_activation_state', (params: any, helpers: any) => {
          const offerId = String(params.p_offer_id || '');
          const allOffers = helpers.getTableRows('car_offers');
          const current = allOffers.find((row: any) => String(row.id) === offerId);
          if (!current) throw new Error('activation_offer_missing');
          if (String(current.updated_at) !== String(params.p_expected_updated_at)) {
            const error: any = new Error('activation_stale_offer');
            error.code = '40001';
            throw error;
          }
          const setting = helpers.getTableRows('site_settings')[0] || {};
          if (params.p_activate === true && (
            setting.car_multi_city_mapped_enabled !== true
            || setting.car_threshold_daily_rates_enabled !== true
          )) throw new Error('activation_requires_both_capabilities');
          const updated = {
            ...current,
            ...(params.p_activate === true ? {
              availability_mode: 'mapped',
              is_available: true,
              is_published: true,
              submission_status: 'approved',
            } : { is_published: false }),
            updated_at: 'activation-rpc-v2',
          };
          helpers.setTableRows('car_offers', allOffers.map((row: any) => row.id === offerId ? updated : row));
          return { data: updated, error: null };
        });
        stub.seedTable('car_offer_daily_rate_tiers', []);
        stub.seedTable('car_bookings', []);
        stub.seedTable('service_deposit_rules', [{ id: 'deposit-cars-default', resource_type: 'cars', mode: 'per_day', amount: 5, currency: 'EUR', include_children: true, enabled: true, updated_at: '2026-08-02T09:20:00.000Z' }]);
        stub.seedTable('service_deposit_overrides', [{ id: 'deposit-offer-override', resource_type: 'cars', resource_id: 'ca300001-0000-4000-8000-000000000001', mode: 'flat', amount: 50, currency: 'EUR', include_children: true, enabled: true, updated_at: '2026-08-02T09:21:00.000Z' }]);
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
    await expect(page.locator('#fleetTableBody')).toContainText('Legacy larnaca');
    await expect(page.locator('#fleetTableBody')).toContainText('Current runtime: legacy resolver coverage');
    await expect(page.locator('#fleetTableBody')).toContainText('Future configured rows: Pickup & return: Larnaca');
    await expect(page.locator('#fleetTableBody [data-offer-status="LIVE"]')).toHaveCount(1);
    await openAction(page, 'vehicle');
    await expect(page.locator('#carMulticityVehicleKind')).toHaveValue(KIND_CAR);
    await page.locator('#carMulticityModalClose').click();

    await openAction(page, 'availability');
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="pickup_enabled"]`)).toBeChecked();
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="return_enabled"]`)).toBeChecked();
    await page.locator('#carMulticityModalClose').click();

    await openAction(page, 'pricing');
    await expect(page.locator('#carMulticityPricingProfile')).toHaveValue(PROFILE_LARNACA);
    await expect(page.locator('#carMulticityModalContent')).toContainText('Daily price');
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

  test('threshold booking details render the authoritative Kymco snapshot without a legacy Larnaca quote or writes', async ({ page }) => {
    await page.evaluate(({ offerId, tierId, bookingId }) => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('car_offers', [
        ...stub.getTableRows('car_offers'),
        {
          id: offerId,
          car_model: { en: 'Kymco UVX', pl: 'Kymco UVX', he: 'Kymco UVX' },
          location: 'larnaca',
          pricing_strategy: 'threshold_daily_rate',
          availability_mode: 'mapped',
          owner_partner_id: 'partner-one',
          is_available: true,
          is_published: true,
          submission_status: 'approved',
          stock_count: 1,
          updated_at: '2026-08-10T01:00:00.000Z',
        },
      ]);
      stub.seedTable('car_bookings', [{
        id: bookingId,
        offer_id: offerId,
        car_model: 'Kymco UVX',
        full_name: 'Threshold Test Customer',
        email: 'threshold.customer@example.test',
        phone: '+35700000000',
        status: 'pending',
        payment_status: 'unpaid',
        location: 'larnaca',
        pickup_date: '2026-08-10',
        pickup_time: '10:00:00',
        return_date: '2026-08-13',
        return_time: '10:00:00',
        pickup_location: 'ayia-napa',
        return_location: 'ayia-napa',
        pickup_city_code: 'ayia-napa',
        return_city_code: 'ayia-napa',
        quoted_price: 270,
        total_price: 270,
        base_rental_price: 270,
        final_rental_price: 270,
        final_price: null,
        currency: 'EUR',
        pickup_location_fee: 0,
        return_location_fee: 0,
        insurance_added: false,
        insurance_cost: 0,
        young_driver: false,
        young_driver_fee: false,
        young_driver_cost: 0,
        coupon_code: null,
        coupon_discount_amount: 0,
        pricing_validated_at: '2026-08-10T01:01:00.000Z',
        pricing_snapshot: {
          version: 'car-threshold-authoritative-v1',
          pricing_strategy: 'threshold_daily_rate',
          offer_id: offerId,
          tier_id: tierId,
          threshold_days: 3,
          rental_days: 3,
          daily_rate: 90.000000,
          base_rental_price: 270,
          pickup_city_code: 'ayia-napa',
          return_city_code: 'ayia-napa',
          pickup_fee_mode: 'override',
          return_fee_mode: 'override',
          pickup_location_fee: 0,
          return_location_fee: 0,
          insurance_mode: 'included',
          insurance_selected: false,
          insurance_daily_rate: 0,
          insurance_cost: 0,
          young_driver_selected: false,
          young_driver_daily_rate: 0,
          young_driver_cost: 0,
          pre_discount_total: 270,
          coupon_code: null,
          discount_amount: 0,
          final_rental_price: 270,
          currency: 'EUR',
        },
        created_at: '2026-08-10T01:02:00.000Z',
        updated_at: '2026-08-10T01:02:00.000Z',
      }]);
      stub.clearMutationCalls();
    }, { offerId: KYMCO_OFFER_ID, tierId: KYMCO_TIER_3_ID, bookingId: KYMCO_BOOKING_ID });

    await page.evaluate(() => (window as any).loadCarsData({ silent: true }));
    await page.locator('.cars-tab-button[data-tab="bookings"]').click();
    const row = page.locator('#carsTableBody tr').filter({ hasText: 'Kymco UVX' });
    await expect(row).toContainText('€270.00');
    await row.getByRole('button', { name: 'View' }).click();

    const details = page.locator('#bookingDetailsContent');
    await expect(page.locator('#bookingDetailsModal')).toBeVisible();
    await expect(details).toContainText('Authoritative Threshold Pricing Snapshot');
    await expect(details).toContainText(KYMCO_OFFER_ID);
    await expect(details).toContainText(KYMCO_TIER_3_ID);
    await expect(details).toContainText('From 3 day(s)');
    await expect(details).toContainText('EUR 90/day');
    await expect(details).toContainText('Base rental (3 day(s) × EUR 90)');
    await expect(details).toContainText('EUR 270.00');
    await expect(details).toContainText('Pickup fee (ayia-napa)');
    await expect(details).toContainText('Return fee (ayia-napa)');
    await expect(details).not.toContainText('LARNACA Rate');
    await expect(details).not.toContainText('Use Suggested Price');
    await expect(details).not.toContainText('Manual Pricing Override');
    await expect(page.locator('#btnUseSuggestedPrice')).toHaveCount(0);
    await expect(page.locator('#bookingQuotedPrice')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__supabaseStub.getMutationCalls())).toEqual([]);
  });

  test('Activate / Publish is capability-gated and performs one exact-offer transaction when both flags are ON', async ({ page }) => {
    await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('car_offers', stub.getTableRows('car_offers').map((row: any) => row.id === offerId
        ? {
          ...row,
          pricing_strategy: 'threshold_daily_rate',
          min_rental_days: 1,
          is_published: false,
          submission_status: 'draft',
        }
        : row));
      stub.seedTable('car_offer_daily_rate_tiers', [{
        id: 'tier-activation-one',
        offer_id: offerId,
        threshold_days: 1,
        daily_rate: 50,
        is_active: true,
        updated_at: 'tier-activation-v1',
      }]);
    }, OFFER_ID);
    await page.evaluate(() => (window as any).loadFleetData({ silent: true }));
    await openAction(page, 'activation');
    await expect(page.locator('[data-activation-intent="activate"]')).toBeDisabled();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Capability disabled');
    await page.locator('#carMulticityModalClose').click();

    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('site_settings', stub.getTableRows('site_settings').map((row: any) => ({
        ...row,
        car_multi_city_mapped_enabled: true,
        car_threshold_daily_rates_enabled: true,
      })));
      stub.clearMutationCalls();
    });
    await openAction(page, 'activation');
    await page.locator('[data-activation-intent="activate"]').click();
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('availability_mode');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').dblclick();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        mutations: stub.getMutationCalls(),
      };
    }, OFFER_ID);
    expect(result.offer).toEqual(expect.objectContaining({
      id: OFFER_ID,
      availability_mode: 'mapped',
      is_available: true,
      is_published: true,
      submission_status: 'approved',
    }));
    expect(result.mutations.filter((call: any) => call.table === 'car_offers')).toHaveLength(0);
    expect(await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls()
      .filter((call: any) => call.name === 'admin_set_car_threshold_offer_activation_state').length)).toBe(1);
    expect(result.mutations.some((call: any) => call.table === 'site_settings')).toBe(false);
  });

  test('Larnaca availability saves independently reviewed pickup and return without protected writes', async ({ page }) => {
    await openAction(page, 'availability');
    await clearMutations(page);
    const nicosia = page.locator(`[data-city-id="${CITY_NICOSIA}"]`);
    await nicosia.locator('[data-availability-field="pickup_enabled"]').check();
    await nicosia.locator('[data-availability-field="return_enabled"]').check();
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText(CITY_NICOSIA);
    await expect(page.locator('#carMulticityModalContent')).toContainText('Existing base price changes');
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
    expect(result.availability).toEqual(expect.objectContaining({ pickup_enabled: true, return_enabled: true, is_active: true, fee_mode: 'inherit', fee_per_direction: null }));
    expect(result.offer.price_per_day).toBe(35);
    expect(result.offer.owner_partner_id).toBe('partner-one');
    expect(result.mutations.filter((call: any) => call.table === 'car_offer_city_availability')).toHaveLength(0);
    expect(await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls().filter((call: any) => call.name === 'admin_save_car_offer_city_availability_batch').length)).toBe(1);
    expect(result.mutations.some((call: any) => ['car_bookings', 'service_deposit_overrides', 'partner_resources', 'partner_service_fulfillments', 'service_coupons', 'coupons'].includes(call.table))).toBe(false);
    expect(result.mutations.some((call: any) => call.table === 'site_settings')).toBe(false);
  });

  test('per-offer city custom fee zero is reviewed and saved on the exact availability row only', async ({ page }) => {
    await openAction(page, 'availability');
    await clearMutations(page);
    const paphos = page.locator(`[data-city-id="${CITY_PAPHOS}"]`);
    await expect(paphos).toContainText('€40.00 per direction');
    await paphos.locator('[data-availability-field="pickup_enabled"]').check();
    await paphos.locator('[data-availability-field="return_enabled"]').check();
    await paphos.locator('[data-availability-field="fee_mode"]').selectOption('override');
    const fee = page.locator(`[data-city-id="${CITY_PAPHOS}"] [data-availability-field="fee_per_direction"]`);
    await fee.fill('0');
    await fee.press('Tab');
    await expect(page.locator(`[data-city-id="${CITY_PAPHOS}"]`)).toContainText('€0.00 pickup · €0.00 return · €0.00 route total');
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Available cities');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Custom €0.00 per direction');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Existing base price changes');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Deposit rule changes');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');

    const result = await page.evaluate(({ offerId, cityId }) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        availability: stub.getTableRows('car_offer_city_availability').find((row: any) => row.offer_id === offerId && row.city_id === cityId),
        mutations: stub.getMutationCalls(),
      };
    }, { offerId: OFFER_ID, cityId: CITY_PAPHOS });
    expect(result.availability).toEqual(expect.objectContaining({
      offer_id: OFFER_ID,
      city_id: CITY_PAPHOS,
      pickup_enabled: true,
      return_enabled: true,
      is_active: true,
      fee_mode: 'override',
      fee_per_direction: 0,
    }));
    expect(result.offer).toEqual(expect.objectContaining({ price_per_day: 35, owner_partner_id: 'partner-one', stock_count: 2 }));
    expect(result.mutations.filter((call: any) => call.table === 'car_offer_city_availability')).toHaveLength(0);
    expect(await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls().filter((call: any) => call.name === 'admin_save_car_offer_city_availability_batch').length)).toBe(1);
    expect(result.mutations.some((call: any) => ['car_bookings', 'service_deposit_rules', 'service_deposit_overrides', 'partners', 'partner_resources', 'site_settings'].includes(call.table))).toBe(false);
  });

  test('directional custom fee result and Review charge only the enabled direction', async ({ page }) => {
    await openAction(page, 'availability');
    const paphos = page.locator(`[data-city-id="${CITY_PAPHOS}"]`);
    await expect(paphos).toContainText('No fee applies while this city is unavailable');
    await paphos.locator('[data-availability-field="pickup_enabled"]').check();
    await paphos.locator('[data-availability-field="fee_mode"]').selectOption('override');
    await paphos.locator('[data-availability-field="fee_per_direction"]').fill('25');
    await paphos.locator('[data-availability-field="fee_per_direction"]').press('Tab');

    await expect(paphos).toContainText('€25.00 pickup · €0.00 return · €25.00 route total');
    await paphos.locator('[data-availability-field="pickup_enabled"]').uncheck();
    await paphos.locator('[data-availability-field="return_enabled"]').check();
    await expect(paphos).toContainText('€0.00 pickup · €25.00 return · €25.00 route total');
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Pickup €0.00 · Return €25.00 · Route total €25.00');
  });

  test('Paphos profile UI blocks every non-Paphos city', async ({ page }) => {
    await page.evaluate(({ offerId, profileId }) => {
      const stub = (window as any).__supabaseStub;
      const offers = stub.getTableRows('car_offers');
      stub.seedTable('car_offers', offers.map((row: any) => row.id === offerId ? { ...row, location: 'paphos', pricing_profile_id: profileId } : row));
      stub.seedTable('car_offer_city_availability', [{ id: 'availability-paphos', offer_id: offerId, city_id: 'ca200001-0000-4000-8000-000000000006', pickup_enabled: true, return_enabled: true, is_active: true, fee_mode: 'inherit', fee_per_direction: null, fee_note: null, updated_at: 'paphos-a1' }]);
    }, { offerId: OFFER_ID, profileId: PROFILE_PAPHOS });
    await page.evaluate(() => (window as any).loadFleetData({ silent: true }));
    await openAction(page, 'availability');
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="pickup_enabled"]`)).toBeDisabled();
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="return_enabled"]`)).toBeDisabled();
    await expect(page.locator(`[data-city-id="${CITY_PAPHOS}"] [data-availability-field="pickup_enabled"]`)).toBeEnabled();
    await expect(page.locator(`[data-city-id="${CITY_PAPHOS}"] [data-availability-field="return_enabled"]`)).toBeEnabled();
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
    expect(result.offer.image_url).toBe('/assets/mazda.jpg');
    expect(result.offer.price_per_day).toBe(35);
    expect(result.availability).toHaveLength(1);
    expect(result.mutations.filter((call: any) => call.table === 'car_offers' && call.action === 'update')).toHaveLength(1);
  });

  test('commercial car type renders jsonb i18n without object coercion and preserves PL/HE', async ({ page }) => {
    await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('car_offers', stub.getTableRows('car_offers').map((row: any) => row.id === offerId ? {
        ...row,
        car_type: { pl: 'Ekonomiczne', en: '', he: 'חסכוני' },
      } : row));
    }, OFFER_ID);
    await page.evaluate(() => (window as any).loadFleetData({ silent: true }));
    await openAction(page, 'vehicle');
    await expect(page.locator('#carMulticityModalContent')).not.toContainText('[object Object]');
    await expect(page.locator('#vehicle-carType-pl')).toHaveValue('Ekonomiczne');
    await expect(page.locator('#vehicle-carType-he')).toHaveValue('חסכוני');
    await page.locator('#vehicle-carType-en').fill('Economy');
    await page.locator('#carMulticityReview').click();
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const carType = await page.evaluate((offerId) => (window as any).__supabaseStub.getTableRows('car_offers').find((row: any) => row.id === offerId)?.car_type, OFFER_ID);
    expect(carType).toEqual({ pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' });
  });

  test('vehicle editor preserves unknown bicycle capacity and edits translated feature arrays', async ({ page }) => {
    await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('car_offers', stub.getTableRows('car_offers').map((row: any) => row.id === offerId ? {
        ...row,
        max_passengers: null,
        max_luggage: null,
        transmission: null,
        fuel_type: null,
        features: { pl: ['Kask w cenie'], en: ['Helmet included'], he: ['קסדה כלולה'] },
      } : row));
    }, OFFER_ID);
    await page.evaluate(() => (window as any).loadFleetData({ silent: true }));
    await expect(page.locator('#fleetTableBody')).not.toContainText('null seats');
    await expect(page.locator('#fleetTableBody')).toContainText('Not specified');
    await openAction(page, 'vehicle');
    await expect(page.locator('#carMulticityMaxPassengers')).toHaveValue('');
    await expect(page.locator('[data-draft-field="vehicle.maxLuggage"]')).toHaveValue('');
    await expect(page.locator('#content-features-en')).toHaveValue('Helmet included');
    await page.locator('#content-features-en').fill('Helmet included\nExact 24-hour rental day');
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('features');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');

    const offer = await page.evaluate((offerId) => (
      (window as any).__supabaseStub.getTableRows('car_offers').find((row: any) => row.id === offerId)
    ), OFFER_ID);
    expect(offer.max_passengers).toBeNull();
    expect(offer.max_luggage).toBeNull();
    expect(offer.features).toEqual({
      pl: ['Kask w cenie'],
      en: ['Helmet included', 'Exact 24-hour rental day'],
      he: ['קסדה כלולה'],
    });
  });

  test('asymmetric legacy availability remains explicit until one direction is consciously changed', async ({ page }) => {
    await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('car_offer_city_availability', [{
        id: 'availability-larnaca', offer_id: offerId, city_id: 'ca200001-0000-4000-8000-000000000001',
        pickup_enabled: true, return_enabled: false, is_active: true, updated_at: 'mismatch-v1',
      }]);
    }, OFFER_ID);
    await openAction(page, 'availability');
    const row = page.locator(`[data-city-id="${CITY_LARNACA}"]`);
    await expect(row.locator('[data-availability-field="pickup_enabled"]')).toBeChecked();
    await expect(row.locator('[data-availability-field="return_enabled"]')).not.toBeChecked();
    await expect(row).toContainText('pickup only');
    await row.locator('[data-availability-field="return_enabled"]').check();
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Available cities');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Deposit rule changes');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    const saved = await page.evaluate((offerId) => (window as any).__supabaseStub.getTableRows('car_offer_city_availability').find((row: any) => row.offer_id === offerId), OFFER_ID);
    expect(saved).toEqual(expect.objectContaining({ pickup_enabled: true, return_enabled: true, is_active: true }));
  });

  test('photo replace uploads to car-images, shows Review and preserves exact offer ID', async ({ page }) => {
    await openAction(page, 'vehicle');
    await expect(page.locator('.car-multicity-image-preview img').first()).toHaveAttribute('src', '/assets/mazda.jpg');
    await page.locator('#carMulticityImageFile').setInputFiles({ name: 'replacement.webp', mimeType: 'image/webp', buffer: Buffer.from('safe-webp-test') });
    await expect(page.locator('.car-multicity-image-action')).toHaveText('replaced');
    await expect(page.locator('.car-multicity-image-preview img')).toHaveCount(2);
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Image action');
    await expect(page.locator('#carMulticityModalContent')).toContainText('replacement.webp');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        storageKeys: Object.keys(stub.state.storageObjects),
      };
    }, OFFER_ID);
    expect(result.offer.id).toBe(OFFER_ID);
    expect(result.offer.image_url).toContain('https://stub.local/car-images/car-');
    expect(result.storageKeys).toHaveLength(1);
    expect(result.storageKeys[0]).toContain(`car-images/car-${OFFER_ID}`);
  });

  test('invalid and oversized photos are blocked before upload', async ({ page }) => {
    await openAction(page, 'vehicle');
    await page.locator('#carMulticityImageFile').setInputFiles({ name: 'vehicle.gif', mimeType: 'image/gif', buffer: Buffer.from('gif') });
    await expect(page.locator('#carMulticityModalError')).toContainText('Only JPG, JPEG, PNG and WEBP');
    expect(await page.evaluate(() => Object.keys((window as any).__supabaseStub.state.storageObjects))).toEqual([]);
    await page.locator('#carMulticityImageFile').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc((5 * 1024 * 1024) + 1) });
    await expect(page.locator('#carMulticityModalError')).toContainText('Maximum size is 5 MB');
    expect(await page.evaluate(() => Object.keys((window as any).__supabaseStub.state.storageObjects))).toEqual([]);
  });

  test('failed exact car save cleans only the new orphan upload and preserves current image', async ({ page }) => {
    await openAction(page, 'vehicle');
    await page.locator('#carMulticityImageFile').setInputFiles({ name: 'orphan.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('orphan-test') });
    await page.locator('#carMulticityReview').click();
    await page.locator('#carMulticitySave').click();
    await page.evaluate(() => (window as any).__supabaseStub.failNextMutation({ table: 'car_offers', action: 'update', error: { message: 'database save failed' } }));
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Partial save receipt');
    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        imageUrl: stub.getTableRows('car_offers').find((row: any) => row.id === offerId)?.image_url,
        storageKeys: Object.keys(stub.state.storageObjects),
      };
    }, OFFER_ID);
    expect(result.imageUrl).toBe('/assets/mazda.jpg');
    expect(result.storageKeys).toEqual([]);
  });

  test('Remove image changes only image_url after Review', async ({ page }) => {
    await openAction(page, 'vehicle');
    await page.locator('[data-media-action="remove"]').click();
    await expect(page.locator('.car-multicity-image-action')).toHaveText('removed');
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('removed');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        mutations: stub.getMutationCalls(),
      };
    }, OFFER_ID);
    expect(result.offer.image_url).toBeNull();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toEqual(expect.objectContaining({ table: 'car_offers', action: 'update' }));
  });

  test('effective deposit is read-only and Manage deposit settings opens the existing panel', async ({ page }) => {
    await openAction(page, 'vehicle');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Payment due at booking');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Exact offer override');
    await expect(page.locator('#carMulticityModalContent')).toContainText('€50');
    await clearMutations(page);
    await page.locator('[data-media-action="manage-deposit"]').click();
    await expect(page.locator('#carMulticityModal')).toBeHidden();
    await expect(page.locator('#viewPartners')).toBeVisible();
    await expect(page.locator('#partnersTabEmails')).toBeVisible();
    await expect(page.locator('#depositOverrideType')).toHaveValue('cars');
    await expect(page.locator('#depositOverrideSearch')).toHaveValue(OFFER_ID);
    await expect(page.locator('#depositOverrideResourceSelect')).toHaveValue(OFFER_ID);
    expect(await page.evaluate(() => (window as any).__supabaseStub.getMutationCalls())).toEqual([]);
  });

  test('payment percent uses percent units while security deposit saves independently', async ({ page }) => {
    await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('service_deposit_overrides', [{
        id: 'deposit-offer-override', resource_type: 'cars', resource_id: offerId,
        mode: 'percent_total', amount: 15, currency: 'EUR', include_children: true,
        enabled: true, updated_at: '2026-08-10T10:00:00.000Z',
      }]);
    }, OFFER_ID);
    await openAction(page, 'pricing');
    await expect(page.locator('#carMulticityModalContent')).toContainText('15%');
    await expect(page.locator('#carMulticityModalContent')).not.toContainText('15 EUR');
    await expect(page.locator('#carMulticitySecurityDepositMode')).toHaveValue('amount');
    await expect(page.locator('#carMulticitySecurityDepositAmount')).toHaveValue('200');

    await page.locator('#carMulticitySecurityDepositMode').selectOption('none');
    await expect(page.locator('#carMulticitySecurityDepositAmount')).toBeDisabled();
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Security deposit — separate from payment due at booking');
    await expect(page.locator('#carMulticityModalContent')).toContainText('deposit_amount');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');

    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        override: stub.getTableRows('service_deposit_overrides').find((row: any) => row.resource_id === offerId),
        mutations: stub.getMutationCalls(),
      };
    }, OFFER_ID);
    expect(result.offer.deposit_amount).toBe(0);
    expect(result.override).toEqual(expect.objectContaining({ mode: 'percent_total', amount: 15 }));
    expect(result.mutations.filter((call: any) => call.table === 'car_offers' && call.action === 'update')).toHaveLength(1);
    expect(result.mutations.some((call: any) => ['service_deposit_rules', 'service_deposit_overrides', 'car_bookings'].includes(call.table))).toBe(false);
  });

  test('modern wizard has stepper, sticky actions, responsive layout and focus restore', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const add = page.locator('#btnAddFleetCar');
    await add.focus();
    await add.click();
    await expect(page.locator('.car-multicity-wizard-steps')).toBeVisible();
    const desktop = await page.locator('#carMulticityModal .car-multicity-modal__content').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const footer = element.querySelector('.car-multicity-modal__footer');
      return { width: rect.width, footerPosition: footer ? getComputedStyle(footer).position : '' };
    });
    expect(desktop.width).toBeGreaterThanOrEqual(1000);
    expect(desktop.width).toBeLessThanOrEqual(1280);
    expect(desktop.footerPosition).toBe('sticky');
    await page.keyboard.press('Escape');
    await expect(page.locator('#carMulticityModal')).toBeHidden();
    await expect(add).toBeFocused();

    await page.setViewportSize({ width: 390, height: 780 });
    await add.click();
    const mobileWidth = await page.locator('#carMulticityModal .car-multicity-modal__content').evaluate((element) => element.getBoundingClientRect().width);
    expect(mobileWidth).toBeLessThanOrEqual(386);
    await expect(page.locator('#carMulticityModalClose')).toBeFocused();
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
    await expect(page.locator('#carMulticityModalContent')).toContainText('Existing base price changes');
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

  test('Pricing and profile edits the active exact price with Review, concurrency and no hidden-column reset', async ({ page }) => {
    await openAction(page, 'pricing');
    await clearMutations(page);
    const before = await page.evaluate((offerId) => (window as any).__supabaseStub.getTableRows('car_offers').find((row: any) => row.id === offerId), OFFER_ID);
    await expect(page.locator('#carMulticityReview')).toHaveText('Review price changes');
    await expect(page.locator('#carMulticitySave')).toHaveText('Save pricing values');
    await page.locator('#carMulticityPricePerDay').fill('41.50');
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Daily price');
    await expect(page.locator('#carMulticityModalContent')).toContainText('35');
    await expect(page.locator('#carMulticityModalContent')).toContainText('41.5');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Existing base price changes');
    await page.locator('#carMulticitySave').evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');
    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        mutations: stub.getMutationCalls(),
      };
    }, OFFER_ID);
    expect(result.offer).toEqual(expect.objectContaining({
      id: OFFER_ID,
      price_per_day: 41.5,
      price_3days: before.price_3days,
      price_4_6days: before.price_4_6days,
      price_7_10days: before.price_7_10days,
      price_10plus_days: before.price_10plus_days,
      location: before.location,
      pricing_profile_id: before.pricing_profile_id,
      owner_partner_id: before.owner_partner_id,
    }));
    expect(result.mutations.filter((call: any) => call.table === 'car_offers' && call.action === 'update')).toHaveLength(1);
    expect(result.mutations.some((call: any) => call.table !== 'car_offers')).toBe(false);
  });

  test('threshold daily-rate editor saves arbitrary sorted tiers and keeps both activation flags OFF', async ({ page }) => {
    await openAction(page, 'pricing');
    await clearMutations(page);
    await page.locator('#carMulticityPricingStrategy').selectOption('threshold_daily_rate');
    await expect(page.locator('#carMulticityPricingProfile')).toBeDisabled();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Pricing is decoupled from city availability');

    for (let index = 0; index < 3; index += 1) {
      await page.locator('[data-tier-action="add"]').click();
    }
    const cards = page.locator('[data-tier-key]');
    await expect(cards).toHaveCount(3);
    for (const [index, threshold, rate] of [[0, 1, 50], [1, 3, 45], [2, 7, 40]] as const) {
      const card = cards.nth(index);
      await card.locator('[data-tier-field="threshold_days"]').fill(String(threshold));
      await card.locator('[data-tier-field="daily_rate"]').fill(String(rate));
    }
    await page.locator('[data-draft-field="pricing.maxRentalDays"]').fill('');
    await expect(page.locator('[data-draft-field="pricing.maxRentalDays"]')).toHaveValue('');
    expect(await page.evaluate(() => (window as any).CarRentalMulticityAdmin.getState().draft.pricing.maxRentalDays)).toBeNull();
    await page.locator('#carMulticityReview').click();
    expect(await page.evaluate(() => {
      const state = (window as any).CarRentalMulticityAdmin.getState();
      return state.plan.steps.find((step: any) => step.key === 'pricing_and_profile')?.payload?.max_rental_days;
    })).toBeNull();
    await expect(page.locator('#carMulticityModalContent')).toContainText('Daily-rate tiers — daily rate × complete rental days');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Effective threshold minimum');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Global threshold-pricing flag changes');
    await page.locator('#carMulticitySave').click();
    await page.locator('#carMulticityConfirmAccept').click();
    await expect(page.locator('#carMulticityReceiptHeading')).toHaveText('Saved');

    const result = await page.evaluate((offerId) => {
      const stub = (window as any).__supabaseStub;
      return {
        offer: stub.getTableRows('car_offers').find((row: any) => row.id === offerId),
        tiers: stub.getTableRows('car_offer_daily_rate_tiers').filter((row: any) => row.offer_id === offerId),
        setting: stub.getTableRows('site_settings')[0],
        mutations: stub.getMutationCalls(),
      };
    }, OFFER_ID);
    expect(result.offer).toEqual(expect.objectContaining({
      id: OFFER_ID,
      pricing_strategy: 'threshold_daily_rate',
      min_rental_days: 1,
      max_rental_days: null,
      availability_mode: 'legacy',
      location: 'larnaca',
    }));
    expect(result.tiers.map((tier: any) => [tier.threshold_days, tier.daily_rate]))
      .toEqual([[1, 50], [3, 45], [7, 40]]);
    expect(result.setting).toEqual(expect.objectContaining({
      car_multi_city_mapped_enabled: false,
      car_threshold_daily_rates_enabled: false,
    }));
    expect(result.mutations.filter((call: any) => call.table === 'car_offer_daily_rate_tiers' && call.action === 'insert')).toHaveLength(3);
    expect(result.mutations.filter((call: any) => call.table === 'car_offers' && call.action === 'update')).toHaveLength(1);
    expect(result.mutations.some((call: any) => ['car_bookings', 'service_deposit_rules', 'service_deposit_overrides', 'partners', 'partner_resources'].includes(call.table))).toBe(false);
  });

  test('young-driver and insurance options save for the exact Paphos-independent offer only', async ({ page }) => {
    await openAction(page, 'pricing');
    await clearMutations(page);
    await page.locator('[data-draft-field="pricing.youngDriverFee"]').uncheck();
    await page.locator('[data-draft-field="pricing.youngDriverCost"]').fill('0');
    await page.locator('[data-draft-field="pricing.insurancePerDay"]').fill('0');
    await page.locator('[data-draft-field="pricing.insuranceMode"]').selectOption('not_offered');
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('young_driver_fee');
    await expect(page.locator('#carMulticityModalContent')).toContainText('insurance_mode');
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
    expect(result.offer).toEqual(expect.objectContaining({
      id: OFFER_ID,
      young_driver_fee: false,
      young_driver_cost: 0,
      insurance_mode: 'not_offered',
      insurance_per_day: 0,
      pricing_profile_id: PROFILE_LARNACA,
      location: 'larnaca',
    }));
    expect(result.availability).toHaveLength(1);
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toEqual(expect.objectContaining({ table: 'car_offers', action: 'update' }));
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
    await page.locator('[data-catalog-action="add-city"]').click();
    await expect(page.locator('#carMulticityCityEditorTitle')).toHaveText('Add city');
    await page.locator('[data-city-editor-field="code"]').fill('polis-test');
    await page.locator('[data-city-editor-field="name_en"]').fill('Polis Test');
    await page.locator('[data-city-editor-field="name_pl"]').fill('Polis Test');
    await page.locator('[data-city-editor-field="name_he"]').fill('פוליס');
    await page.locator('[data-catalog-action="city-editor-next"]').click();
    await expect(page.locator('[data-city-editor-place-type="city"]')).toBeChecked();
    await page.locator('[data-catalog-action="city-editor-next"]').click();
    await expect(page.locator('.car-multicity-city-editor__body')).toContainText('does not add a profile mapping');
    await page.locator('[data-catalog-action="city-editor-next"]').click();
    await expect(page.locator('.car-multicity-city-editor__body')).toContainText('New city status: Inactive');
    await page.locator('[data-catalog-action="city-editor-next"]').click();
    await expect(page.locator('.car-multicity-city-editor__body')).toContainText('Public activation');
    await page.locator('[data-catalog-action="save-city-editor"]').click();
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

  test('city management remains available after capability flags are deliberately enabled', async ({ page }) => {
    await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      stub.seedTable('site_settings', stub.getTableRows('site_settings').map((row: any) => ({
        ...row,
        car_multi_city_mapped_enabled: true,
        car_threshold_daily_rates_enabled: true,
      })));
      stub.clearMutationCalls();
    });
    await page.locator('#btnManageCarMulticity').click();
    await expect(page.locator('#carMulticityCatalogModal')).toBeVisible();
    await expect(page.locator('#carMulticityCatalogStatus')).toContainText('mapped ON, threshold pricing ON');
    await expect(page.locator(`[data-catalog-city-id="${CITY_LARNACA}"]`)).toBeVisible();
    expect(await page.evaluate(() => (window as any).__supabaseStub.getMutationCalls())).toEqual([]);
  });

  test('existing city i18n edit uses exact ID and does not create mappings or assignments', async ({ page }) => {
    await page.locator('#btnManageCarMulticity').click();
    const row = page.locator(`[data-catalog-city-id="${CITY_LARNACA}"]`);
    await row.locator('[data-catalog-action="edit-city"]').click();
    await page.locator('[data-city-editor-field="name_pl"]').fill('Larnaka testowa');
    await page.locator('[data-city-editor-field="name_he"]').fill('לרנקה בדיקה');
    await clearMutations(page);
    for (let step = 0; step < 4; step += 1) {
      await page.locator('[data-catalog-action="city-editor-next"]').click();
    }
    await page.locator('[data-catalog-action="save-city-editor"]').click();
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
    await row.locator('[data-mapping-field="paired_supported"]').uncheck();
    await row.locator('[data-mapping-field="is_active"]').uncheck();
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
    expect(result.mapping).toEqual(expect.objectContaining({ pickup_supported: false, return_supported: false, is_active: false }));
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
    await page.locator('#vehicle-carType-en').fill('Economy');
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityPricingProfile').selectOption(PROFILE_LARNACA);
    await page.locator('[data-draft-field="pricing.pricePerDay"]').fill('42');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Cars default rule');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Per day');
    await expect(page.locator('#carMulticitySecurityDepositMode')).toHaveValue('unspecified');
    await expect(page.locator('#carMulticitySecurityDepositAmount')).toBeDisabled();
    await page.locator('#carMulticityNext').click();
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="pickup_enabled"]`)).toBeChecked();
    await expect(page.locator(`[data-city-id="${CITY_LARNACA}"] [data-availability-field="return_enabled"]`)).toBeChecked();
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="pickup_enabled"]`)).not.toBeChecked();
    await expect(page.locator(`[data-city-id="${CITY_NICOSIA}"] [data-availability-field="return_enabled"]`)).not.toBeChecked();
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityNext').click();
    await page.locator('#carMulticityReview').click();
    await expect(page.locator('#carMulticityModalContent')).toContainText('availability_mode');
    await expect(page.locator('#carMulticityModalContent')).toContainText('legacy');
    await expect(page.locator('#carMulticityModalContent')).toContainText('Deposit rule changes');
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
    expect(result.created).toHaveProperty('deposit_amount', null);
    expect(result.availability).toHaveLength(1);
    expect(result.availability[0].city_id).toBe(CITY_LARNACA);
    expect(result.mutations.some((call: any) => ['car_bookings', 'service_deposit_overrides', 'partner_service_fulfillments', 'service_coupons', 'coupons'].includes(call.table))).toBe(false);
  });
});
