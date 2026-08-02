import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import {
  resolveCarRentalAvailability,
  resolveMappedAvailabilityFromContext,
} from '../../js/car-rental-availability-adapter.js';
import {
  buildPricingMatrixForOfferRow,
  calculateCarRentalQuote,
} from '../../js/car-pricing.js';
import { TOKENS } from './car-rental-multicity-postgrest-auth.mjs';

const POSTGREST_URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(
  ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Stage 2D integration refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`,
);
assert.equal(parsedUrl.protocol, 'http:', 'Stage 2D integration accepts local HTTP only.');

const OFFER_LARNACA = 'ca300001-0000-4000-8000-000000000001';
const OFFER_PAPHOS = 'ca300001-0000-4000-8000-000000000002';
const PROFILE_LARNACA = 'ca210001-0000-4000-8000-000000000001';
const PROFILE_PAPHOS = 'ca210001-0000-4000-8000-000000000002';
const CITY_LARNACA = 'ca200001-0000-4000-8000-000000000001';
const CITY_PAPHOS = 'ca200001-0000-4000-8000-000000000006';
const KIND_CAR = 'ca220001-0000-4000-8000-000000000001';
const PARTNER_LARNACA = 'ca2f0000-0000-4000-8000-000000000001';
const HIDDEN_UNAVAILABLE = 'ca4d0000-0000-4000-8000-000000000001';
const HIDDEN_UNPUBLISHED = 'ca4d0000-0000-4000-8000-000000000002';
const HIDDEN_LEGACY = 'ca4d0000-0000-4000-8000-000000000003';
const TEMP_OFFERS = [HIDDEN_UNAVAILABLE, HIDDEN_UNPUBLISHED, HIDDEN_LEGACY];
const BASE_OFFERS = [OFFER_LARNACA, OFFER_PAPHOS];
const ALL_FIXTURE_OFFERS = [...BASE_OFFERS, ...TEMP_OFFERS];

const protectedColumns = [
  'id', 'price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days',
  'price_10plus_days', 'currency', 'location', 'owner_partner_id',
  'deposit_amount', 'insurance_per_day', 'young_driver_fee', 'young_driver_cost',
  'stock_count', 'north_allowed', 'is_available', 'is_published', 'submission_status',
].join(',');

function clientFor(token, requestLog = null) {
  const trackedFetch = requestLog
    ? async (input, init = {}) => {
      const requestUrl = typeof input === 'string' ? input : input.url;
      const method = String(init.method || (typeof input === 'string' ? 'GET' : input.method) || 'GET').toUpperCase();
      requestLog.push({ url: requestUrl, method });
      return fetch(input, init);
    }
    : fetch;
  return createClient(POSTGREST_URL, TOKENS.anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: trackedFetch,
    },
  });
}

const service = clientFor(TOKENS.service);
const anon = clientFor(TOKENS.anon);
const authenticated = clientFor(TOKENS.nonAdmin);

async function must(query, marker) {
  const result = await query;
  assert.ifError(result.error, marker);
  return result.data;
}

async function snapshotProtected() {
  return must(
    service.from('car_offers').select(protectedColumns).in('id', BASE_OFFERS).order('id'),
    'protected snapshot',
  );
}

async function exactOfferIds() {
  const rows = await must(service.from('car_offers').select('id').order('id'), 'exact offer IDs');
  return rows.map((row) => row.id);
}

async function setFlag(value) {
  await must(
    service.from('site_settings').update({ car_multi_city_mapped_enabled: value }).eq('id', 1).select('id'),
    `set feature flag ${value}`,
  );
}

function fixtureOffer(id, overrides = {}) {
  return {
    id,
    location: 'larnaca',
    pricing_profile_id: PROFILE_LARNACA,
    vehicle_kind_id: KIND_CAR,
    availability_mode: 'legacy',
    car_type: { pl: 'Test', en: 'Test', he: 'בדיקה' },
    car_model: { pl: id, en: id, he: id },
    description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
    features: { pl: ['AC'], en: ['AC'], he: ['AC'] },
    transmission: 'automatic', fuel_type: 'petrol', max_passengers: 5, max_luggage: 2,
    stock_count: 1, sort_order: 9000, price_per_day: 40, price_3days: 120,
    price_4_6days: 40, price_7_10days: 38, price_10plus_days: 35,
    currency: 'EUR', deposit_amount: 200, insurance_per_day: 17,
    young_driver_fee: true, young_driver_cost: 10, owner_partner_id: PARTNER_LARNACA,
    north_allowed: true, is_available: true, is_published: true, submission_status: 'approved',
    ...overrides,
  };
}

async function resetFixtures() {
  await must(
    service.from('car_offers').update({ availability_mode: 'legacy' }).in('id', ALL_FIXTURE_OFFERS).select('id'),
    'reset fixture modes',
  );
  await must(
    service.from('car_offer_city_availability').delete().in('offer_id', ALL_FIXTURE_OFFERS).select('offer_id'),
    'delete fixture availability',
  );
  await must(service.from('car_offers').delete().in('id', TEMP_OFFERS).select('id'), 'delete temporary offers');
  await must(
    service.from('car_offers').update({
      location: 'larnaca', pricing_profile_id: PROFILE_LARNACA, availability_mode: 'legacy',
      is_available: true, is_published: true, north_allowed: true,
    }).eq('id', OFFER_LARNACA).select('id'),
    'reset Larnaca base offer',
  );
  await must(
    service.from('car_offers').update({
      location: 'paphos', pricing_profile_id: PROFILE_PAPHOS, availability_mode: 'legacy',
      is_available: true, is_published: true, north_allowed: false,
    }).eq('id', OFFER_PAPHOS).select('id'),
    'reset Paphos base offer',
  );
  await setFlag(false);
}

async function seedMappedFixtures() {
  await must(service.from('car_offers').insert([
    fixtureOffer(HIDDEN_UNAVAILABLE, { is_available: false }),
    fixtureOffer(HIDDEN_UNPUBLISHED, { is_published: false }),
    fixtureOffer(HIDDEN_LEGACY),
  ]).select('id'), 'insert isolated offers');
  await must(service.from('car_offer_city_availability').insert([
    { offer_id: OFFER_LARNACA, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: OFFER_LARNACA, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: OFFER_PAPHOS, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    ...TEMP_OFFERS.map((offerId) => ({
      offer_id: offerId, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true,
    })),
  ]).select('offer_id'), 'insert isolated availability');
  await must(
    service.from('car_offers').update({ availability_mode: 'mapped' })
      .in('id', [OFFER_LARNACA, OFFER_PAPHOS, HIDDEN_UNAVAILABLE, HIDDEN_UNPUBLISHED]).select('id'),
    'activate isolated mapped fixtures',
  );
  await setFlag(true);
}

function input(legacyOffers) {
  return {
    pickupCityCode: 'paphos', returnCityCode: 'paphos',
    pickupPlaceType: 'airport', returnPlaceType: 'airport',
    pickupDate: '2026-09-10', pickupTime: '10:00',
    returnDate: '2026-09-13', returnTime: '10:00',
    passengers: 2, fullInsurance: false, youngDriver: false,
    language: 'en', filters: { platform: 'homepage' }, mode: 'shadow', legacyOffers,
  };
}

function performanceContext(count) {
  const cities = [
    { id: CITY_LARNACA, code: 'larnaca', is_active: true },
    { id: CITY_PAPHOS, code: 'paphos', is_active: true },
  ];
  const profiles = [{
    id: PROFILE_LARNACA, code: 'larnaca', calculator_key: 'larnaca',
    legacy_booking_location: 'larnaca', is_active: true,
  }];
  const profileCities = cities.map((city) => ({
    pricing_profile_id: PROFILE_LARNACA, city_id: city.id,
    pickup_supported: true, return_supported: true,
    legacy_pricing_city_key: city.code, is_active: true,
  }));
  const offers = Array.from({ length: count }, (_, index) => ({
    ...fixtureOffer(`perf-offer-${String(index + 1).padStart(4, '0')}`),
    pricing_profile_id: PROFILE_LARNACA, availability_mode: 'mapped',
    price_per_day: 25 + (index % 25), sort_order: index,
  }));
  const availability = offers.flatMap((offer) => cities.map((city) => ({
    offer_id: offer.id, city_id: city.id, pickup_enabled: true, return_enabled: true, is_active: true,
  })));
  return { cities, profiles, profileCities, offers, availability };
}

function benchmark(count) {
  const context = performanceContext(count);
  const durations = [];
  let result = null;
  for (let index = 0; index < 15; index += 1) {
    const startedAt = performance.now();
    result = resolveMappedAvailabilityFromContext(input([]), context);
    durations.push(performance.now() - startedAt);
  }
  durations.sort((left, right) => left - right);
  return {
    offers: count,
    resultOffers: result.offers.length,
    medianMs: Number(durations[Math.floor(durations.length / 2)].toFixed(3)),
    p95Ms: Number(durations[Math.floor(durations.length * 0.95)].toFixed(3)),
    contextBytes: Buffer.byteLength(JSON.stringify(context)),
    resultBytes: Buffer.byteLength(JSON.stringify(result)),
  };
}

const summary = {
  environment: { postgrestUrl: POSTGREST_URL, loopbackGuard: true },
  rls: {},
  adapter: {},
  performance: {},
  fingerprint: {},
  cleanup: {},
};

await resetFixtures();
const baselineProtected = await snapshotProtected();
const baselineOfferIds = await exactOfferIds();

try {
  await seedMappedFixtures();

  const anonAvailability = await must(
    anon.from('car_offer_city_availability').select('offer_id,city_id').order('offer_id'),
    'anon availability RLS',
  );
  const authenticatedAvailability = await must(
    authenticated.from('car_offer_city_availability').select('offer_id,city_id').order('offer_id'),
    'authenticated availability RLS',
  );
  const serviceAvailability = await must(
    service.from('car_offer_city_availability').select('offer_id,city_id').in('offer_id', ALL_FIXTURE_OFFERS),
    'service availability visibility',
  );
  const publicIds = [...new Set(anonAvailability.map((row) => row.offer_id))].sort();
  assert.deepEqual(publicIds, BASE_OFFERS);
  assert.deepEqual(authenticatedAvailability, anonAvailability);
  assert.equal(serviceAvailability.length, 6);
  assert.ok(!publicIds.some((id) => TEMP_OFFERS.includes(id)));
  summary.rls = {
    anonVisibleOfferIds: publicIds,
    authenticatedMatchesAnon: true,
    serviceFixtureRows: serviceAvailability.length,
    hiddenUnavailable: !publicIds.includes(HIDDEN_UNAVAILABLE),
    hiddenUnpublished: !publicIds.includes(HIDDEN_UNPUBLISHED),
    hiddenLegacy: !publicIds.includes(HIDDEN_LEGACY),
  };

  const legacyOffers = await must(
    service.from('car_offers').select('*').eq('id', OFFER_PAPHOS),
    'legacy Paphos comparison row',
  );
  const requestLog = [];
  const trackedAnon = clientFor(TOKENS.anon, requestLog);
  const result = await resolveCarRentalAvailability({
    ...input(legacyOffers),
    supabase: trackedAnon,
  });
  assert.strictEqual(result.renderedOffers, result.legacyOffers);
  assert.deepEqual(result.legacyOffers.map((row) => row.id), [OFFER_PAPHOS]);
  assert.deepEqual(result.mappedOffers.map((row) => row.id), [OFFER_LARNACA, OFFER_PAPHOS]);
  assert.deepEqual(result.comparison.addedOfferIds, [OFFER_LARNACA]);
  assert.deepEqual(result.comparison.commonOfferIds, [OFFER_PAPHOS]);
  assert.deepEqual(result.comparison.priceMismatches, []);
  assert.deepEqual(result.comparison.orderMismatches, []);
  assert.deepEqual(result.comparison.unexplainedDifferences, []);
  assert.equal(new Set(result.mappedOffers.map((row) => row.id)).size, result.mappedOffers.length);

  const paphosRow = legacyOffers[0];
  const matrix = buildPricingMatrixForOfferRow(paphosRow, 'paphos');
  const directQuote = calculateCarRentalQuote({
    pricingMatrix: matrix, offer: 'paphos', carModel: paphosRow.car_model.en,
    pickupDateStr: '2026-09-10', pickupTimeStr: '10:00',
    returnDateStr: '2026-09-13', returnTimeStr: '10:00',
    pickupLocation: 'airport_pfo', returnLocation: 'airport_pfo',
    fullInsurance: false, youngDriver: false, offerRow: paphosRow,
  });
  const mappedPaphos = result.mappedOffers.find((offer) => offer.id === OFFER_PAPHOS);
  assert.equal(mappedPaphos.quote.total, directQuote.total);
  assert.equal(mappedPaphos.quote.pickupFee, 10);
  assert.equal(mappedPaphos.quote.returnFee, 10);
  assert.ok(requestLog.length >= 6);
  assert.ok(requestLog.every((entry) => entry.method === 'GET'));
  assert.ok(requestLog.every((entry) => !/car_bookings|customer_|email|phone|payment|stripe|rpc\//i.test(entry.url)));
  summary.adapter = {
    renderedSource: 'legacy',
    exactLegacyIds: result.legacyOffers.map((row) => row.id),
    exactMappedIds: result.mappedOffers.map((row) => row.id),
    addedOfferIds: result.comparison.addedOfferIds,
    commonOfferIds: result.comparison.commonOfferIds,
    directQuoteTotal: directQuote.total,
    mappedQuoteTotal: mappedPaphos.quote.total,
    priceMismatches: 0,
    unexplainedDifferences: 0,
    requestMethods: [...new Set(requestLog.map((entry) => entry.method))],
    requestCount: requestLog.length,
    repositoryMetrics: result.metrics,
  };

  await setFlag(false);
  const flagOffLog = [];
  const flagOff = await resolveCarRentalAvailability({
    ...input(legacyOffers), supabase: clientFor(TOKENS.anon, flagOffLog),
  });
  assert.strictEqual(flagOff.renderedOffers, flagOff.legacyOffers);
  assert.deepEqual(flagOff.mappedOffers, []);
  assert.equal(flagOffLog.length, 1);
  assert.ok(flagOff.diagnostics.some((entry) => entry.code === 'SHADOW_FEATURE_FLAG_DISABLED'));
  summary.adapter.flagOff = { requestCount: flagOffLog.length, renderedSource: 'legacy', mappedOffers: 0 };

  summary.performance = {
    catalog27: benchmark(27),
    catalog250: benchmark(250),
  };
} finally {
  await resetFixtures();
}

const finalProtected = await snapshotProtected();
const finalOfferIds = await exactOfferIds();
const finalAvailability = await must(
  service.from('car_offer_city_availability').select('offer_id').in('offer_id', ALL_FIXTURE_OFFERS),
  'cleanup availability check',
);
const finalFlag = await must(
  service.from('site_settings').select('car_multi_city_mapped_enabled').eq('id', 1).single(),
  'cleanup feature flag',
);
assert.deepEqual(finalProtected, baselineProtected);
assert.deepEqual(finalOfferIds, baselineOfferIds);
assert.deepEqual(finalAvailability, []);
assert.equal(finalFlag.car_multi_city_mapped_enabled, false);
summary.fingerprint = {
  protectedBefore: baselineProtected,
  protectedAfter: finalProtected,
  identical: true,
  exactOfferIdsBefore: baselineOfferIds,
  exactOfferIdsAfter: finalOfferIds,
};
summary.cleanup = {
  temporaryOffersRemaining: finalOfferIds.filter((id) => TEMP_OFFERS.includes(id)).length,
  fixtureAvailabilityRemaining: finalAvailability.length,
  featureFlag: finalFlag.car_multi_city_mapped_enabled,
  baseOffersLegacy: true,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
