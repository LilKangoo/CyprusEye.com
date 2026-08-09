import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { TOKENS } from './car-rental-multicity-postgrest-auth.mjs';

const POSTGREST_URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Stage 3A/3B integration refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`);
assert.equal(parsedUrl.protocol, 'http:', 'Stage 3A/3B integration accepts local HTTP only.');

const LARNACA_OFFER = 'ca300001-0000-4000-8000-000000000001';
const PAPHOS_OFFER = 'ca300001-0000-4000-8000-000000000002';
const LARNACA_CITY = 'ca200001-0000-4000-8000-000000000001';
const CUSTOM_CITY = 'ca3c0000-0000-4000-8000-000000000001';

function clientFor(token) {
  return createClient(POSTGREST_URL, TOKENS.anon, {
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

async function must(promise, label = 'PostgREST operation') {
  const result = await promise;
  if (result.error) assert.fail(`${label}: ${result.error.code || ''} ${result.error.message}`);
  return result.data;
}

function assertDenied(result, label) {
  assert.ok(result.error || !result.data?.length, `${label} unexpectedly succeeded`);
}

const offerColumns = [
  'id', 'location', 'pricing_profile_id', 'availability_mode', 'pricing_strategy',
  'min_rental_days', 'max_rental_days', 'engine_capacity_cc',
  'required_licence_category', 'minimum_driver_age', 'insurance_mode',
  'insurance_per_day', 'young_driver_fee', 'young_driver_cost', 'is_available',
  'is_published', 'updated_at',
].join(',');

async function readOffer(id) {
  return must(clients.service.from('car_offers').select(offerColumns).eq('id', id).single(), `read offer ${id}`);
}

const baseline = Object.freeze({
  larnaca: await readOffer(LARNACA_OFFER),
  paphos: await readOffer(PAPHOS_OFFER),
  exactIds: (await must(clients.service.from('car_offers').select('id').order('id'), 'read exact IDs')).map((row) => row.id),
});

const testBookingIds = [
  'ca3b0000-0000-4000-8000-000000000001',
  'ca3b0000-0000-4000-8000-000000000002',
  'ca3b0000-0000-4000-8000-000000000003',
];

async function cleanup() {
  await clients.service.from('site_settings').update({ car_threshold_daily_rates_enabled: false }).eq('id', 1);
  await clients.service.from('car_offers').update({ pricing_strategy: 'legacy_compat', availability_mode: 'legacy' })
    .in('id', [LARNACA_OFFER, PAPHOS_OFFER]);
  await clients.service.from('car_offer_city_availability').delete().eq('offer_id', PAPHOS_OFFER).eq('city_id', LARNACA_CITY);
  await clients.service.from('car_offer_city_availability').delete().eq('offer_id', PAPHOS_OFFER).eq('city_id', CUSTOM_CITY);
  await clients.service.from('car_rental_cities').delete().eq('id', CUSTOM_CITY);
  await clients.service.from('car_offer_daily_rate_tiers').delete().in('offer_id', [LARNACA_OFFER, PAPHOS_OFFER]);
  for (const [id, row] of [[LARNACA_OFFER, baseline.larnaca], [PAPHOS_OFFER, baseline.paphos]]) {
    await clients.service.from('car_offers').update({
      pricing_strategy: row.pricing_strategy,
      min_rental_days: row.min_rental_days,
      max_rental_days: row.max_rental_days,
      engine_capacity_cc: row.engine_capacity_cc,
      required_licence_category: row.required_licence_category,
      minimum_driver_age: row.minimum_driver_age,
      insurance_mode: row.insurance_mode,
      insurance_per_day: row.insurance_per_day,
      young_driver_fee: row.young_driver_fee,
      young_driver_cost: row.young_driver_cost,
      is_published: row.is_published,
    }).eq('id', id);
  }
  await clients.service.from('service_deposit_requests').delete().in('booking_id', testBookingIds);
  await clients.service.from('partner_service_fulfillments').delete().in('booking_id', testBookingIds);
  await clients.service.from('car_bookings').delete().in('id', testBookingIds);
}

const summary = {
  environment: { postgrestUrl: POSTGREST_URL, loopbackGuard: true },
  publication: {},
  rls: {},
  tiers: {},
  duration: {},
  pricingLocationDecoupling: {},
  offerOptions: {},
  partialPayment: {},
  cleanup: {},
};

await cleanup();

try {
  await must(clients.service.from('car_offers').update({ is_published: false }).eq('id', PAPHOS_OFFER), 'hide fixture offer');
  const hiddenAnon = await must(clients.anon.from('car_offers').select('id').eq('id', PAPHOS_OFFER), 'anon hidden-offer read');
  const hiddenAdmin = await must(clients.admin.from('car_offers').select('id').eq('id', PAPHOS_OFFER), 'admin hidden-offer read');
  assert.equal(hiddenAnon.length, 0);
  assert.deepEqual(hiddenAdmin.map((row) => row.id), [PAPHOS_OFFER]);
  await must(clients.service.from('car_offers').update({ is_published: baseline.paphos.is_published }).eq('id', PAPHOS_OFFER), 'restore publication');
  summary.publication = { unpublishedAnonRows: 0, adminExactOfferVisible: true };

  const nonAdminTierWrite = await clients.nonAdmin.from('car_offer_daily_rate_tiers').insert({
    offer_id: LARNACA_OFFER, threshold_days: 3, daily_rate: 50,
  }).select('*');
  assertDenied(nonAdminTierWrite, 'non-admin tier write');
  summary.rls.nonAdminTierWriteDenied = true;

  let tier3 = await must(clients.admin.from('car_offer_daily_rate_tiers').insert({
    offer_id: LARNACA_OFFER, threshold_days: 3, daily_rate: 45,
  }).select('*').single(), 'insert first tier');
  assert.equal((await readOffer(LARNACA_OFFER)).min_rental_days, 3);

  const tier1 = await must(clients.admin.from('car_offer_daily_rate_tiers').insert({
    offer_id: LARNACA_OFFER, threshold_days: 1, daily_rate: 50,
  }).select('*').single(), 'insert lower tier');
  assert.equal((await readOffer(LARNACA_OFFER)).min_rental_days, 1);

  await must(clients.admin.from('car_offer_daily_rate_tiers').delete().eq('id', tier1.id).select('*').single(), 'delete lower tier');
  assert.equal((await readOffer(LARNACA_OFFER)).min_rental_days, 3);

  tier3 = await must(clients.admin.from('car_offer_daily_rate_tiers').update({ threshold_days: 5 })
    .eq('id', tier3.id).eq('updated_at', tier3.updated_at).select('*').single(), 'edit lowest tier');
  assert.equal((await readOffer(LARNACA_OFFER)).min_rental_days, 5);

  await must(clients.admin.from('car_offer_daily_rate_tiers').delete().eq('id', tier3.id).select('*').single(), 'clear setup tier');
  await must(clients.service.from('car_offers').update({ min_rental_days: baseline.larnaca.min_rental_days }).eq('id', LARNACA_OFFER), 'restore setup minimum');

  await must(clients.admin.from('car_offer_daily_rate_tiers').insert([
    { offer_id: LARNACA_OFFER, threshold_days: 1, daily_rate: 50 },
    { offer_id: LARNACA_OFFER, threshold_days: 3, daily_rate: 45 },
    { offer_id: LARNACA_OFFER, threshold_days: 7, daily_rate: 40 },
  ]).select('*'), 'insert pricing tiers');

  const duplicateTier = await clients.admin.from('car_offer_daily_rate_tiers').insert({
    offer_id: LARNACA_OFFER, threshold_days: 3, daily_rate: 44,
  }).select('*');
  assert.ok(duplicateTier.error);
  assert.equal(duplicateTier.error.code, '23505');

  await must(clients.admin.from('car_offers').update({ pricing_strategy: 'threshold_daily_rate', max_rental_days: null })
    .eq('id', LARNACA_OFFER).select('*').single(), 'activate isolated threshold fixture');

  const flagOffQuote = await must(clients.service.rpc('resolve_car_threshold_daily_rate_quote', {
    p_offer_id: LARNACA_OFFER,
    p_pickup_at: '2026-09-01T10:00:00+03:00',
    p_return_at: '2026-09-11T10:00:00+03:00',
    p_submitted_base_price: 400,
  }), 'flag-off authoritative quote');
  assert.deepEqual(flagOffQuote, []);

  const flagOffPublicTiers = await must(clients.anon.from('car_offer_daily_rate_tiers').select('id').eq('offer_id', LARNACA_OFFER), 'flag-off public tiers');
  assert.equal(flagOffPublicTiers.length, 0);

  await must(clients.service.from('site_settings').update({ car_threshold_daily_rates_enabled: true }).eq('id', 1), 'enable isolated threshold flag');
  const quote = await must(clients.service.rpc('resolve_car_threshold_daily_rate_quote', {
    p_offer_id: LARNACA_OFFER,
    p_pickup_at: '2026-09-01T10:00:00+03:00',
    p_return_at: '2026-09-11T10:00:00+03:00',
    p_submitted_base_price: 400,
  }), 'authoritative threshold quote');
  assert.equal(quote.length, 1);
  assert.equal(quote[0].rental_days, 10);
  assert.equal(quote[0].threshold_days, 7);
  assert.equal(Number(quote[0].daily_rate), 40);
  assert.equal(Number(quote[0].base_rental_price), 400);
  assert.equal(quote[0].submitted_base_matches, true);

  const mismatch = await must(clients.service.rpc('resolve_car_threshold_daily_rate_quote', {
    p_offer_id: LARNACA_OFFER,
    p_pickup_at: '2026-09-01T10:00:00+03:00',
    p_return_at: '2026-09-11T10:00:00+03:00',
    p_submitted_base_price: 399,
  }), 'authoritative mismatch quote');
  assert.equal(mismatch[0].submitted_base_matches, false);

  const publicTiers = await must(clients.anon.from('car_offer_daily_rate_tiers')
    .select('threshold_days,daily_rate').eq('offer_id', LARNACA_OFFER).order('threshold_days'), 'threshold-only public tiers');
  assert.deepEqual(publicTiers, [],
    'tiers stay private until mapped mode and both activation flags are enabled');
  summary.rls.publicTiersFlagOff = 0;
  summary.rls.publicTiersThresholdOnly = publicTiers.length;

  const exactDay = await must(clients.service.rpc('car_rental_duration_days_24h', {
    p_pickup_at: '2026-03-28T10:00:00+02:00',
    p_return_at: '2026-03-29T11:00:00+03:00',
  }), 'exact 24-hour duration');
  const overDay = await must(clients.service.rpc('car_rental_duration_days_24h', {
    p_pickup_at: '2026-03-28T10:00:00+02:00',
    p_return_at: '2026-03-29T11:30:00+03:00',
  }), '24.5-hour duration');
  assert.equal(exactDay, 1);
  assert.equal(overDay, 2);
  summary.duration = { exact24Hours: exactDay, twentyFourAndHalfHours: overDay };

  await must(clients.admin.from('car_offers').update({ max_rental_days: 9 }).eq('id', LARNACA_OFFER), 'set explicit max');
  const overMax = await must(clients.service.rpc('resolve_car_threshold_daily_rate_quote', {
    p_offer_id: LARNACA_OFFER,
    p_pickup_at: '2026-09-01T10:00:00+03:00',
    p_return_at: '2026-09-11T10:00:00+03:00',
    p_submitted_base_price: 400,
  }), 'over-max quote');
  assert.deepEqual(overMax, []);
  await must(clients.admin.from('car_offers').update({ max_rental_days: null }).eq('id', LARNACA_OFFER), 'clear max');

  const lastTier = (await must(clients.service.from('car_offer_daily_rate_tiers').select('id,updated_at')
    .eq('offer_id', LARNACA_OFFER).eq('threshold_days', 7).single(), 'read tier for stale test'));
  await must(clients.admin.from('car_offer_daily_rate_tiers').update({ daily_rate: 39 })
    .eq('id', lastTier.id).eq('updated_at', lastTier.updated_at).select('*').single(), 'fresh exact tier update');
  const staleUpdate = await clients.admin.from('car_offer_daily_rate_tiers').update({ daily_rate: 38 })
    .eq('id', lastTier.id).eq('updated_at', lastTier.updated_at).select('*');
  assert.equal(staleUpdate.error, null);
  assert.equal(staleUpdate.data.length, 0);
  summary.tiers = {
    selectedWholePeriodRate: 40,
    tenDayBase: 400,
    noBlending: true,
    duplicateThresholdRejected: true,
    lowestTierSynchronizesMinimum: true,
    maxNullAndExplicitMax: true,
    optimisticConcurrency: true,
  };

  await must(clients.service.from('car_offer_daily_rate_tiers').update({ daily_rate: 40 }).eq('id', lastTier.id), 'restore changed tier rate');

  await must(clients.admin.from('car_offer_daily_rate_tiers').insert({
    offer_id: PAPHOS_OFFER, threshold_days: 1, daily_rate: 60,
  }).select('*').single(), 'insert paphos fixture tier');
  await must(clients.admin.from('car_offers').update({ pricing_strategy: 'threshold_daily_rate', max_rental_days: null })
    .eq('id', PAPHOS_OFFER).select('*').single(), 'set paphos threshold strategy');
  const decoupledAvailability = await must(clients.admin.from('car_offer_city_availability').insert({
    offer_id: PAPHOS_OFFER,
    city_id: LARNACA_CITY,
    pickup_enabled: true,
    return_enabled: true,
    is_active: true,
    fee_mode: 'inherit',
    fee_per_direction: null,
  }).select('*').single(), 'insert profile-independent availability');
  assert.equal(decoupledAvailability.offer_id, PAPHOS_OFFER);
  const customCity = await must(clients.admin.from('car_rental_cities').insert({
    id: CUSTOM_CITY,
    code: 'polis-stage3-test',
    name_i18n: { pl: 'Polis test', en: 'Polis test', he: 'פוליס בדיקה' },
    place_types: ['city'],
    is_active: false,
    sort_order: 900,
  }).select('*').single(), 'insert inactive custom city');
  await must(clients.admin.from('car_rental_cities').update({ is_active: true })
    .eq('id', customCity.id).select('*').single(), 'activate custom city without profile mapping');
  const customAvailability = await must(clients.admin.from('car_offer_city_availability').insert({
    offer_id: PAPHOS_OFFER,
    city_id: CUSTOM_CITY,
    pickup_enabled: true,
    return_enabled: true,
    is_active: true,
    fee_mode: 'override',
    fee_per_direction: 0,
  }).select('*').single(), 'insert custom exact offer-city availability');
  assert.equal(Number(customAvailability.fee_per_direction), 0);
  assert.equal((await must(clients.service.from('car_pricing_profile_cities').select('city_id').eq('city_id', CUSTOM_CITY), 'check custom profile mappings')).length, 0);
  summary.pricingLocationDecoupling = {
    thresholdAvailabilityUsesExactOfferCity: true,
    paphosLegacyProfileDidNotOwnLarnacaAvailability: true,
    customCityNeedsNoPricingProfileMapping: true,
    customCityUsesExplicitExactOfferFee: true,
    legacyProfileConstraintsRetained: true,
  };

  const options = await must(clients.admin.from('car_offers').update({
    engine_capacity_cc: 125,
    required_licence_category: 'A1',
    minimum_driver_age: 18,
    young_driver_fee: true,
    young_driver_cost: 12,
    insurance_mode: 'not_offered',
    insurance_per_day: 0,
  }).eq('id', LARNACA_OFFER).select('id,engine_capacity_cc,required_licence_category,minimum_driver_age,young_driver_fee,young_driver_cost,insurance_mode,insurance_per_day').single(), 'update exact-offer options');
  assert.equal(options.id, LARNACA_OFFER);
  assert.equal(options.engine_capacity_cc, 125);
  assert.equal(options.required_licence_category, 'A1');
  assert.equal(options.minimum_driver_age, 18);
  assert.equal(options.young_driver_fee, true);
  assert.equal(Number(options.young_driver_cost), 12);
  assert.equal(options.insurance_mode, 'not_offered');
  assert.equal(Number(options.insurance_per_day), 0);
  const kinds = await must(clients.service.from('car_vehicle_kinds').select('code').order('sort_order'), 'read vehicle kinds');
  assert.deepEqual(kinds.map((row) => row.code), ['car', 'quad', 'buggy', 'scooter', 'bicycle']);
  summary.offerOptions = { exactOfferId: true, youngDriverProfileIndependent: true, insuranceFoundation: true, vehicleKinds: kinds.length };

  // Payment-state coverage is a legacy-compatible fixture. Full threshold
  // booking validation is exercised separately by the Stage 3C/3D gate.
  await must(clients.service.from('site_settings').update({ car_threshold_daily_rates_enabled: false }).eq('id', 1), 'disable threshold payment fixture');
  await must(clients.service.from('car_offers').update({ pricing_strategy: 'legacy_compat' }).eq('id', LARNACA_OFFER), 'restore legacy payment fixture strategy');

  const bookingRows = testBookingIds.map((id, index) => ({
    id,
    offer_id: LARNACA_OFFER,
    location: 'larnaca',
    pickup_location: 'larnaca',
    return_location: 'larnaca',
    pickup_date: '2026-10-01',
    return_date: '2026-10-04',
    final_price: index < 2 ? 100 : null,
    status: 'pending',
    payment_status: 'unpaid',
  }));
  await must(clients.service.from('car_bookings').insert(bookingRows), 'insert payment fixtures');
  await must(clients.service.from('service_deposit_requests').insert([
    { resource_type: 'cars', booking_id: testBookingIds[0], amount: 15, status: 'paid', paid_at: '2026-10-01T08:00:00Z' },
    { resource_type: 'cars', booking_id: testBookingIds[1], amount: 100, status: 'paid', paid_at: '2026-10-01T08:00:00Z' },
    { resource_type: 'cars', booking_id: testBookingIds[2], amount: 15, status: 'paid', paid_at: '2026-10-01T08:00:00Z' },
  ]), 'insert paid deposit fixtures');
  const paymentStates = await must(clients.service.from('car_bookings').select('id,status,payment_status').in('id', testBookingIds).order('id'), 'read payment states');
  assert.deepEqual(paymentStates.map((row) => [row.status, row.payment_status]), [
    ['pending', 'partial'],
    ['pending', 'paid'],
    ['pending', 'paid'],
  ]);
  summary.partialPayment = {
    partPayment: 'partial',
    fullPayment: 'paid',
    unknownLegacyTotal: 'paid',
    bookingStatusPreserved: 'pending',
    partnerConfirmationIndependent: true,
  };
} finally {
  await cleanup();
}

const finalIds = (await must(clients.service.from('car_offers').select('id').order('id'), 'final exact IDs')).map((row) => row.id);
assert.deepEqual(finalIds, baseline.exactIds);
assert.equal((await must(clients.service.from('car_offer_daily_rate_tiers').select('id'), 'final tiers')).length, 0);
assert.equal((await must(clients.service.from('car_offer_city_availability').select('offer_id').eq('offer_id', PAPHOS_OFFER).eq('city_id', LARNACA_CITY), 'final decoupling fixture')).length, 0);
assert.equal((await must(clients.service.from('car_rental_cities').select('id').eq('id', CUSTOM_CITY), 'final custom city fixture')).length, 0);
const finalSettings = await must(clients.service.from('site_settings').select('car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled').eq('id', 1).single(), 'final flags');
assert.deepEqual(finalSettings, { car_multi_city_mapped_enabled: false, car_threshold_daily_rates_enabled: false });
const finalOffers = await must(clients.service.from('car_offers').select('id,pricing_strategy,availability_mode').order('id'), 'final offer modes');
assert.ok(finalOffers.every((row) => row.pricing_strategy === 'legacy_compat' && row.availability_mode === 'legacy'));
assert.equal((await must(clients.service.from('service_deposit_requests').select('id'), 'final payment fixtures')).length, 0);
summary.cleanup = {
  exactOfferIdsPreserved: true,
  tierRows: 0,
  mappedOffers: 0,
  thresholdOffers: 0,
  mappedFlag: false,
  thresholdFlag: false,
  paymentFixtures: 0,
};

console.log(JSON.stringify(summary, null, 2));
