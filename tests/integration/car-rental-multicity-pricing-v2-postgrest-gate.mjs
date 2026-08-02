import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { TOKENS } from './car-rental-multicity-postgrest-auth.mjs';
import { createCarRentalAvailabilityRepository } from '../../js/car-rental-availability-repository.js';
import { resolveMappedAvailabilityFromContext } from '../../js/car-rental-availability-adapter.js';

const URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const OFFER_ID = 'ca300001-0000-4000-8000-000000000001';
const PROFILE_ID = 'ca210001-0000-4000-8000-000000000001';
const CUSTOM_CITY_ID = 'ca2e0000-0000-4000-8000-000000000001';
const CUSTOM_CITY_CODE = 'polis-test';

function clientFor(token) {
  return createClient(URL, TOKENS.anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const clients = Object.freeze({
  anon: clientFor(TOKENS.anon),
  nonAdmin: clientFor(TOKENS.nonAdmin),
  admin: clientFor(TOKENS.admin),
  service: clientFor(TOKENS.service),
});

async function must(promise) {
  const result = await promise;
  assert.ifError(result.error);
  return result.data;
}

async function cleanup() {
  await clients.service.from('car_offers').update({ availability_mode: 'legacy' }).eq('id', OFFER_ID);
  await clients.service.from('car_offer_city_availability').delete().eq('offer_id', OFFER_ID).eq('city_id', CUSTOM_CITY_ID);
  await clients.service.from('car_pricing_profile_cities').delete().eq('pricing_profile_id', PROFILE_ID).eq('city_id', CUSTOM_CITY_ID);
  await clients.service.from('car_rental_cities').delete().eq('id', CUSTOM_CITY_ID);
  await clients.service.from('site_settings').update({ car_multi_city_mapped_enabled: false }).eq('id', 1);
}

function loadAdminRepository() {
  const context = {};
  for (const relative of [
    'admin/car-rental-multicity-core.js',
    'admin/car-rental-multicity-repository.js',
  ]) {
    vm.runInNewContext(fs.readFileSync(relative, 'utf8'), context, { filename: relative });
  }
  return {
    core: context.CarRentalMulticityCore,
    repository: context.CarRentalMulticityRepository.create({ client: clients.admin, core: context.CarRentalMulticityCore }),
  };
}

const protectedFields = [
  'id', 'location', 'pricing_profile_id', 'availability_mode', 'vehicle_kind_id',
  'price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days',
  'price_10plus_days', 'currency', 'owner_partner_id', 'deposit_amount',
  'insurance_per_day', 'young_driver_fee', 'young_driver_cost', 'stock_count',
  'north_allowed', 'is_available', 'is_published', 'submission_status',
];

await cleanup();
const baseline = (await must(clients.service.from('car_offers').select(protectedFields.join(',')).eq('id', OFFER_ID).single()));
const summary = {
  environment: { postgrestUrl: URL },
  migrationContract: {},
  rls: {},
  pricing: {},
  customCity: {},
  cleanup: {},
};

try {
  const columns = await must(clients.service.from('car_offer_city_availability').select('fee_mode,fee_per_direction,fee_note').limit(1));
  assert.ok(Array.isArray(columns));
  summary.migrationContract.columnsReadable = true;

  const denied = await clients.nonAdmin.from('car_rental_cities').insert({
    id: CUSTOM_CITY_ID,
    code: CUSTOM_CITY_CODE,
    name_i18n: { pl: 'Polis test', en: 'Polis test', he: 'פוליס בדיקה' },
    is_active: false,
    sort_order: 900,
    place_types: ['city'],
  }).select('*');
  assert.ok(denied.error || !denied.data?.length);
  summary.rls.nonAdminCityWriteDenied = true;

  const city = await must(clients.admin.from('car_rental_cities').insert({
    id: CUSTOM_CITY_ID,
    code: CUSTOM_CITY_CODE,
    name_i18n: { pl: 'Polis test', en: 'Polis test', he: 'פוליס בדיקה' },
    sort_order: 900,
    place_types: ['city'],
  }).select('*').single());
  assert.equal(city.is_active, false);

  const mapping = await must(clients.admin.from('car_pricing_profile_cities').insert({
    pricing_profile_id: PROFILE_ID,
    city_id: CUSTOM_CITY_ID,
    pickup_supported: true,
    return_supported: true,
    legacy_pricing_city_key: CUSTOM_CITY_CODE,
    is_active: false,
  }).select('*').single());
  assert.equal(mapping.legacy_pricing_city_key, CUSTOM_CITY_CODE);
  await must(clients.admin.from('car_rental_cities').update({ is_active: true }).eq('id', CUSTOM_CITY_ID).select('*').single());
  await must(clients.admin.from('car_pricing_profile_cities').update({ is_active: true })
    .eq('pricing_profile_id', PROFILE_ID).eq('city_id', CUSTOM_CITY_ID).select('*').single());

  const invalidFee = await clients.admin.from('car_offer_city_availability').insert({
    offer_id: OFFER_ID,
    city_id: CUSTOM_CITY_ID,
    pickup_enabled: true,
    return_enabled: true,
    is_active: true,
    fee_mode: 'override',
    fee_per_direction: null,
  }).select('*');
  assert.ok(invalidFee.error);
  assert.equal(invalidFee.error.code, '23514');

  const availability = await must(clients.admin.from('car_offer_city_availability').insert({
    offer_id: OFFER_ID,
    city_id: CUSTOM_CITY_ID,
    pickup_enabled: true,
    return_enabled: true,
    is_active: true,
    fee_mode: 'override',
    fee_per_direction: 0,
  }).select('*').single());
  assert.equal(availability.fee_mode, 'override');
  assert.equal(Number(availability.fee_per_direction), 0);

  const anonLegacyRows = await must(clients.anon.from('car_offer_city_availability')
    .select('offer_id,city_id,fee_mode,fee_per_direction').eq('offer_id', OFFER_ID).eq('city_id', CUSTOM_CITY_ID));
  assert.equal(anonLegacyRows.length, 0);

  const { repository } = loadAdminRepository();
  const offerBeforePricing = await repository.getOfferById(OFFER_ID);
  const pricingResult = await repository.updatePricingProfile({
    offerId: OFFER_ID,
    expectedUpdatedAt: offerBeforePricing.updated_at,
    payload: {
      pricing_profile_id: PROFILE_ID,
      location: 'larnaca',
      currency: 'EUR',
      price_per_day: Number(offerBeforePricing.price_per_day) + 1,
    },
  });
  assert.equal(pricingResult.id, OFFER_ID);
  assert.equal(Number(pricingResult.price_per_day), Number(offerBeforePricing.price_per_day) + 1);
  for (const column of ['price_3days', 'price_4_6days', 'price_7_10days', 'price_10plus_days']) {
    assert.equal(Number(pricingResult[column]), Number(offerBeforePricing[column]));
  }
  await assert.rejects(repository.updatePricingProfile({
    offerId: OFFER_ID,
    expectedUpdatedAt: offerBeforePricing.updated_at,
    payload: { pricing_profile_id: PROFILE_ID, location: 'larnaca', currency: 'EUR', price_per_day: offerBeforePricing.price_per_day },
  }), (error) => error?.code === 'car_multicity_stale_conflict');
  const pricingReadBack = await repository.getOfferById(OFFER_ID);
  await repository.updatePricingProfile({
    offerId: OFFER_ID,
    expectedUpdatedAt: pricingReadBack.updated_at,
    payload: { pricing_profile_id: PROFILE_ID, location: 'larnaca', currency: 'EUR', price_per_day: offerBeforePricing.price_per_day },
  });
  summary.pricing = {
    exactId: OFFER_ID,
    activePriceFieldOnly: true,
    hiddenTiersPreserved: true,
    optimisticConcurrency: true,
    freshReadBack: true,
  };

  const freshAvailability = (await repository.listAvailabilityByOfferId(OFFER_ID)).find((row) => row.city_id === CUSTOM_CITY_ID);
  const updatedFee = await repository.updateAvailability({
    offerId: OFFER_ID,
    cityId: CUSTOM_CITY_ID,
    expectedUpdatedAt: freshAvailability.updated_at,
    payload: {
      offer_id: OFFER_ID,
      city_id: CUSTOM_CITY_ID,
      pickup_enabled: true,
      return_enabled: true,
      is_active: true,
      fee_mode: 'override',
      fee_per_direction: 12.5,
      fee_note: null,
    },
  });
  assert.equal(Number(updatedFee.fee_per_direction), 12.5);

  await must(clients.service.from('car_offers').update({ availability_mode: 'mapped' }).eq('id', OFFER_ID).select('*').single());
  const inheritedWhileMapped = await clients.admin.from('car_offer_city_availability').update({
    fee_mode: 'inherit',
    fee_per_direction: null,
  }).eq('offer_id', OFFER_ID).eq('city_id', CUSTOM_CITY_ID).select('*');
  assert.ok(inheritedWhileMapped.error);
  assert.match(inheritedWhileMapped.error.message, /mapped_car_offer_city_fee_override_required/);

  const publicRepository = createCarRentalAvailabilityRepository({ supabase: clients.anon });
  const mappedContext = await publicRepository.readMappedContext({ pickupCityCode: CUSTOM_CITY_CODE, returnCityCode: CUSTOM_CITY_CODE });
  const resolved = resolveMappedAvailabilityFromContext({
    pickupCityCode: CUSTOM_CITY_CODE,
    returnCityCode: CUSTOM_CITY_CODE,
    pickupPlaceType: 'hotel',
    returnPlaceType: 'hotel',
    pickupDate: '2026-09-01',
    pickupTime: '10:00',
    returnDate: '2026-09-04',
    returnTime: '10:00',
    passengers: 2,
    fullInsurance: false,
    youngDriver: false,
    language: 'en',
    filters: { platform: 'homepage' },
  }, mappedContext);
  assert.equal(resolved.offers.length, 1);
  assert.equal(resolved.offers[0].id, OFFER_ID);
  assert.equal(resolved.offers[0].quote.pickupFee, 12.5);
  assert.equal(resolved.offers[0].quote.returnFee, 12.5);
  assert.equal(resolved.offers[0].quote.pickupLoc, CUSTOM_CITY_CODE);
  assert.equal(resolved.offers[0].quote.returnLoc, CUSTOM_CITY_CODE);
  assert.equal(publicRepository.getMetrics().requests, 5);
  summary.customCity = {
    exactCityCode: CUSTOM_CITY_CODE,
    defaultInactive: true,
    mappingSeparate: true,
    explicitOverrideRequired: true,
    zeroOverrideAccepted: true,
    updatedOverride: 12.5,
    publicDirectionalFees: [12.5, 12.5],
    exactOfferId: OFFER_ID,
    publicReadRequests: publicRepository.getMetrics().requests,
  };
  summary.rls.anonLegacyAvailabilityHidden = true;
} finally {
  await cleanup();
  const current = await must(clients.service.from('car_offers').select('*').eq('id', OFFER_ID).single());
  const restorePayload = {};
  for (const field of protectedFields) {
    if (field !== 'id' && field !== 'availability_mode') restorePayload[field] = baseline[field];
  }
  restorePayload.availability_mode = 'legacy';
  await must(clients.service.from('car_offers').update(restorePayload).eq('id', OFFER_ID).select('*').single());
}

const after = await must(clients.service.from('car_offers').select(protectedFields.join(',')).eq('id', OFFER_ID).single());
assert.deepEqual(after, baseline);
const remainingCity = await must(clients.service.from('car_rental_cities').select('id').eq('id', CUSTOM_CITY_ID));
const remainingAvailability = await must(clients.service.from('car_offer_city_availability').select('offer_id').eq('city_id', CUSTOM_CITY_ID));
assert.equal(remainingCity.length, 0);
assert.equal(remainingAvailability.length, 0);
const flag = await must(clients.service.from('site_settings').select('car_multi_city_mapped_enabled').eq('id', 1).single());
assert.equal(flag.car_multi_city_mapped_enabled, false);
summary.cleanup = {
  protectedOfferFingerprintEquivalent: true,
  customCityRows: 0,
  customAvailabilityRows: 0,
  globalMappedFlag: false,
  availabilityMode: after.availability_mode,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
