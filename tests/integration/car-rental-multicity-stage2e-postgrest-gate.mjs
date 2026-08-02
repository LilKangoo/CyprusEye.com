import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import { resolveCarRentalAvailability } from '../../js/car-rental-availability-adapter.js';
import { createCarRentalAvailabilityRepository } from '../../js/car-rental-availability-repository.js';
import { buildPricingMatrixForOfferRow, calculateCarRentalQuote } from '../../js/car-pricing.js';
import { TOKENS } from './car-rental-multicity-postgrest-auth.mjs';

const POSTGREST_URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(
  ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Stage 2E integration refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`,
);
assert.equal(parsedUrl.protocol, 'http:', 'Stage 2E integration accepts local HTTP only.');

const OFFER_LARNACA = 'ca300001-0000-4000-8000-000000000001';
const OFFER_PAPHOS = 'ca300001-0000-4000-8000-000000000002';
const LEGACY_LARNACA = 'ca5e0000-0000-4000-8000-000000000001';
const LEGACY_PAPHOS = 'ca5e0000-0000-4000-8000-000000000002';
const ASYMMETRIC_LARNACA = 'ca5e0000-0000-4000-8000-000000000003';
const TEMP_OFFERS = [LEGACY_LARNACA, LEGACY_PAPHOS, ASYMMETRIC_LARNACA];
const BASE_OFFERS = [OFFER_LARNACA, OFFER_PAPHOS];
const ALL_FIXTURE_OFFERS = [...BASE_OFFERS, ...TEMP_OFFERS];
const PROFILE_LARNACA = 'ca210001-0000-4000-8000-000000000001';
const PROFILE_PAPHOS = 'ca210001-0000-4000-8000-000000000002';
const CITY_LARNACA = 'ca200001-0000-4000-8000-000000000001';
const CITY_PAPHOS = 'ca200001-0000-4000-8000-000000000006';
const KIND_CAR = 'ca220001-0000-4000-8000-000000000001';
const PARTNER_LARNACA = 'ca2f0000-0000-4000-8000-000000000001';
const PARTNER_PAPHOS = 'ca2f0000-0000-4000-8000-000000000002';

const protectedColumns = [
  'id', 'price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days',
  'price_10plus_days', 'currency', 'location', 'owner_partner_id',
  'deposit_amount', 'insurance_per_day', 'young_driver_fee', 'young_driver_cost',
  'stock_count', 'north_allowed', 'is_available', 'is_published', 'submission_status',
].join(',');

function clientFor(token, requestLog = null) {
  const trackedFetch = requestLog
    ? async (request, init = {}) => {
      const url = typeof request === 'string' ? request : request.url;
      const method = String(init.method || (typeof request === 'string' ? 'GET' : request.method) || 'GET').toUpperCase();
      requestLog.push({ url, method });
      return fetch(request, init);
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

async function setFlag(value) {
  await must(
    service.from('site_settings').update({ car_multi_city_mapped_enabled: value }).eq('id', 1).select('id'),
    `set isolated feature flag ${value}`,
  );
}

async function snapshotProtected() {
  return must(service.from('car_offers').select(protectedColumns).in('id', BASE_OFFERS).order('id'), 'protected snapshot');
}

async function exactOfferIds() {
  const rows = await must(service.from('car_offers').select('id').order('id'), 'exact offer IDs');
  return rows.map((row) => row.id);
}

function fixtureOffer(id, location, overrides = {}) {
  const paphos = location === 'paphos';
  return {
    id,
    location,
    pricing_profile_id: paphos ? PROFILE_PAPHOS : PROFILE_LARNACA,
    vehicle_kind_id: KIND_CAR,
    availability_mode: 'legacy',
    car_type: { pl: 'Test', en: 'Test', he: 'בדיקה' },
    car_model: { pl: id, en: id, he: id },
    description: { pl: 'Fixture', en: 'Fixture', he: 'בדיקה' },
    features: { pl: ['AC'], en: ['AC'], he: ['AC'] },
    transmission: 'automatic', fuel_type: 'petrol', max_passengers: 5, max_luggage: 2,
    stock_count: 1, sort_order: 9000,
    price_per_day: paphos ? 90 : 42,
    price_3days: paphos ? 270 : 126,
    price_4_6days: paphos ? 90 : 42,
    price_7_10days: paphos ? 85 : 40,
    price_10plus_days: paphos ? 80 : 38,
    currency: 'EUR', deposit_amount: 200, insurance_per_day: 17,
    young_driver_fee: !paphos, young_driver_cost: paphos ? 0 : 10,
    owner_partner_id: paphos ? PARTNER_PAPHOS : PARTNER_LARNACA,
    north_allowed: !paphos, is_available: true, is_published: true, submission_status: 'approved',
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

async function seedFixtures() {
  await must(service.from('car_offers').insert([
    fixtureOffer(LEGACY_LARNACA, 'larnaca'),
    fixtureOffer(LEGACY_PAPHOS, 'paphos'),
    fixtureOffer(ASYMMETRIC_LARNACA, 'larnaca', { price_per_day: 28 }),
  ]).select('id'), 'insert isolated Stage 2E offers');
  await must(service.from('car_offer_city_availability').insert([
    { offer_id: OFFER_LARNACA, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: OFFER_LARNACA, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: OFFER_PAPHOS, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: true, is_active: true },
    { offer_id: ASYMMETRIC_LARNACA, city_id: CITY_PAPHOS, pickup_enabled: true, return_enabled: false, is_active: true },
    { offer_id: ASYMMETRIC_LARNACA, city_id: CITY_LARNACA, pickup_enabled: false, return_enabled: true, is_active: true },
  ]).select('offer_id'), 'insert isolated directional availability');
  await must(
    service.from('car_offers').update({ availability_mode: 'mapped' })
      .in('id', [OFFER_LARNACA, OFFER_PAPHOS, ASYMMETRIC_LARNACA]).select('id'),
    'activate isolated mapped fixtures',
  );
}

function input(legacyOffers, overrides = {}) {
  return {
    pickupCityCode: 'paphos', returnCityCode: 'paphos',
    pickupPlaceType: 'airport', returnPlaceType: 'airport',
    pickupDate: '2026-09-10', pickupTime: '10:00',
    returnDate: '2026-09-13', returnTime: '10:00',
    passengers: 2, fullInsurance: false, youngDriver: false,
    language: 'en', filters: { platform: 'homepage' },
    mode: 'hybrid', legacyOffers,
    ...overrides,
  };
}

function makePerformanceContext(count) {
  const contextCities = [
    { id: CITY_LARNACA, code: 'larnaca', is_active: true },
    { id: CITY_PAPHOS, code: 'paphos', is_active: true },
  ];
  const contextProfiles = [{
    id: PROFILE_LARNACA, code: 'larnaca', calculator_key: 'larnaca',
    legacy_booking_location: 'larnaca', is_active: true,
  }];
  const contextProfileCities = contextCities.map((city) => ({
    pricing_profile_id: PROFILE_LARNACA, city_id: city.id,
    pickup_supported: true, return_supported: true,
    legacy_pricing_city_key: city.code, is_active: true,
  }));
  const offers = Array.from({ length: count }, (_, index) => ({
    ...fixtureOffer(`stage2e-perf-${String(index + 1).padStart(4, '0')}`, 'larnaca'),
    availability_mode: 'mapped', price_per_day: 25 + (index % 25), sort_order: index,
  }));
  const availability = offers.flatMap((offer) => contextCities.map((city) => ({
    offer_id: offer.id, city_id: city.id, pickup_enabled: true, return_enabled: true, is_active: true,
  })));
  return { cities: contextCities, profiles: contextProfiles, profileCities: contextProfileCities, offers, availability };
}

async function benchmark(count) {
  const context = makePerformanceContext(count);
  const durations = [];
  let lastResult = null;
  const testRepository = {
    getFeatureFlag: async () => true,
    readMappedContext: async () => context,
    getMetrics: () => ({ requests: 0, responseBytes: 0, durationMs: 0, queries: [] }),
  };
  for (let index = 0; index < 15; index += 1) {
    const startedAt = performance.now();
    lastResult = await resolveCarRentalAvailability({ ...input([], { pickupPlaceType: 'hotel', returnPlaceType: 'hotel' }), repository: testRepository });
    durations.push(performance.now() - startedAt);
  }
  durations.sort((left, right) => left - right);
  return {
    offers: count,
    renderedOffers: lastResult.renderedOffers.length,
    medianMs: Number(durations[Math.floor(durations.length / 2)].toFixed(3)),
    p95Ms: Number(durations[Math.floor(durations.length * 0.95)].toFixed(3)),
    contextBytes: Buffer.byteLength(JSON.stringify(context)),
    resultBytes: Buffer.byteLength(JSON.stringify(lastResult)),
  };
}

const summary = {
  environment: { postgrestUrl: POSTGREST_URL, loopbackGuard: true },
  rls: {},
  hybrid: {},
  fallback: {},
  directional: {},
  performance: {},
  fingerprint: {},
  cleanup: {},
};

await resetFixtures();
const baselineProtected = await snapshotProtected();
const baselineOfferIds = await exactOfferIds();

try {
  await seedFixtures();

  const anonAvailability = await must(
    anon.from('car_offer_city_availability').select('offer_id,city_id,pickup_enabled,return_enabled').order('offer_id'),
    'anon mapped availability RLS',
  );
  const authenticatedAvailability = await must(
    authenticated.from('car_offer_city_availability').select('offer_id,city_id,pickup_enabled,return_enabled').order('offer_id'),
    'authenticated mapped availability RLS',
  );
  const publicIds = [...new Set(anonAvailability.map((row) => row.offer_id))].sort();
  assert.deepEqual(authenticatedAvailability, anonAvailability);
  assert.deepEqual(publicIds, [ASYMMETRIC_LARNACA, OFFER_LARNACA, OFFER_PAPHOS].sort());
  assert.ok(!publicIds.includes(LEGACY_LARNACA));
  assert.ok(!publicIds.includes(LEGACY_PAPHOS));
  summary.rls = { anonVisibleMappedIds: publicIds, authenticatedMatchesAnon: true, legacyAvailabilityHidden: true };

  const legacyPaphosRows = await must(
    service.from('car_offers').select('*').in('id', [OFFER_PAPHOS, LEGACY_PAPHOS]).order('sort_order'),
    'Paphos legacy resolver fixture',
  );
  const flagOffLog = [];
  const flagOff = await resolveCarRentalAvailability({
    ...input(legacyPaphosRows), supabase: clientFor(TOKENS.anon, flagOffLog),
  });
  assert.strictEqual(flagOff.renderedOffers, flagOff.legacyOffers);
  assert.deepEqual(flagOff.renderedOffers.map((row) => row.id), legacyPaphosRows.map((row) => row.id));
  assert.equal(flagOffLog.length, 1);

  await setFlag(true);
  const requestLog = [];
  const hybrid = await resolveCarRentalAvailability({
    ...input(legacyPaphosRows), supabase: clientFor(TOKENS.anon, requestLog),
  });
  const renderedIds = hybrid.renderedOffers.map((row) => row.id);
  assert.deepEqual(new Set(renderedIds), new Set([OFFER_LARNACA, OFFER_PAPHOS, LEGACY_PAPHOS]));
  assert.equal(new Set(renderedIds).size, renderedIds.length);
  assert.ok(!renderedIds.includes(ASYMMETRIC_LARNACA));
  assert.deepEqual(
    hybrid.renderedOffers.map((row) => row.quote.total),
    [...hybrid.renderedOffers].map((row) => row.quote.total).sort((left, right) => left - right),
  );
  assert.ok(hybrid.renderedOffers.every((row) => row.pricingContext.offerId === row.id));
  assert.ok(hybrid.renderedOffers.every((row) => row.pricingContext.quote === row.quote));
  assert.equal(hybrid.renderedOffers.find((row) => row.id === OFFER_LARNACA).pricingContext.legacyBookingLocation, 'larnaca');
  assert.equal(hybrid.renderedOffers.find((row) => row.id === OFFER_PAPHOS).pricingContext.legacyBookingLocation, 'paphos');
  assert.ok(requestLog.length >= 6);
  assert.ok(requestLog.every((entry) => entry.method === 'GET'));
  assert.ok(requestLog.every((entry) => !/car_bookings|customer_|email|phone|payment|stripe|rpc\//i.test(entry.url)));

  const mappedPaphos = hybrid.renderedOffers.find((row) => row.id === OFFER_PAPHOS);
  const matrix = buildPricingMatrixForOfferRow(mappedPaphos, 'paphos');
  const directQuote = calculateCarRentalQuote({
    pricingMatrix: matrix, offer: 'paphos', carModel: mappedPaphos.car_model.en,
    pickupDateStr: '2026-09-10', pickupTimeStr: '10:00',
    returnDateStr: '2026-09-13', returnTimeStr: '10:00',
    pickupLocation: 'airport_pfo', returnLocation: 'airport_pfo',
    fullInsurance: false, youngDriver: false, offerRow: mappedPaphos,
  });
  assert.equal(mappedPaphos.quote.total, directQuote.total);
  assert.deepEqual(hybrid.comparison.priceMismatches, []);
  assert.deepEqual(hybrid.comparison.unexplainedDifferences, []);
  summary.hybrid = {
    flagOffExactReference: true,
    flagOffRequestCount: flagOffLog.length,
    exactRenderedIds: renderedIds,
    quoteTotals: hybrid.renderedOffers.map((row) => ({ id: row.id, total: row.quote.total })),
    requestCount: requestLog.length,
    requestMethods: [...new Set(requestLog.map((entry) => entry.method))],
    responseBytes: hybrid.metrics.responseBytes,
    durationMs: hybrid.metrics.durationMs,
    priceMismatches: 0,
    duplicateIds: 0,
    unexplainedDifferences: 0,
  };

  const legacyLarnacaRows = await must(
    service.from('car_offers').select('*').in('id', [OFFER_LARNACA, LEGACY_LARNACA, ASYMMETRIC_LARNACA]).order('sort_order'),
    'Larnaca legacy resolver fixture',
  );
  const directional = await resolveCarRentalAvailability({
    ...input(legacyLarnacaRows, {
      pickupCityCode: 'paphos', returnCityCode: 'larnaca',
      pickupPlaceType: 'hotel', returnPlaceType: 'hotel',
    }),
    supabase: anon,
  });
  assert.ok(directional.renderedOffers.some((row) => row.id === ASYMMETRIC_LARNACA));
  assert.ok(directional.renderedOffers.some((row) => row.id === LEGACY_LARNACA));
  summary.directional = { exactRenderedIds: directional.renderedOffers.map((row) => row.id), asymmetricIncluded: true };

  const realRepository = createCarRentalAvailabilityRepository({ supabase: anon });
  const failureRepository = {
    getFeatureFlag: () => realRepository.getFeatureFlag(),
    readMappedContext: async () => { throw new Error('isolated mapped read failure'); },
    getMetrics: () => realRepository.getMetrics(),
  };
  const fallback = await resolveCarRentalAvailability({
    ...input(legacyPaphosRows), repository: failureRepository,
  });
  assert.deepEqual(fallback.renderedOffers.map((row) => row.id), [LEGACY_PAPHOS]);
  assert.ok(fallback.diagnostics.some((entry) => entry.code === 'MAPPED_READER_UNAVAILABLE'));
  assert.ok(fallback.diagnostics.some((entry) => entry.code === 'MAPPED_OFFER_OMITTED' && entry.offerId === OFFER_PAPHOS));
  summary.fallback = { exactRenderedIds: [LEGACY_PAPHOS], mappedOfferLegacyFallback: false, diagnostics: fallback.diagnostics.map((entry) => entry.code) };

  summary.performance = { catalog27: await benchmark(27), catalog250: await benchmark(250) };
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
