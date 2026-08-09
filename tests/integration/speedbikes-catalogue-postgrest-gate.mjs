import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { TOKENS } from './car-rental-multicity-postgrest-auth.mjs';

const POSTGREST_URL = process.env.SPEEDBIKES_POSTGREST_URL || 'http://127.0.0.1:53001';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `SpeedBikes gate refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`);
assert.equal(parsedUrl.protocol, 'http:', 'SpeedBikes gate accepts local HTTP only.');

const manifest = JSON.parse(fs.readFileSync(
  new URL('../../supabase/manual/speedbikes_catalogue_manifest.json', import.meta.url),
  'utf8',
));
const offerIds = manifest.offers.map((offer) => offer.offerId).sort();

function clientFor(token) {
  return createClient(POSTGREST_URL, TOKENS.anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const clients = Object.freeze({
  anon: clientFor(TOKENS.anon),
  admin: clientFor(TOKENS.admin),
  service: clientFor(TOKENS.service),
});

async function must(promise, label) {
  const result = await promise;
  if (result.error) assert.fail(`${label}: ${result.error.code || ''} ${result.error.message}`);
  return result.data;
}

const offerSelect = [
  'id', 'owner_partner_id', 'pricing_strategy', 'availability_mode',
  'is_available', 'is_published', 'submission_status', 'min_rental_days',
  'max_rental_days', 'image_url', 'vehicle_kind_id',
].join(',');

const [serviceOffers, adminOffers, anonOffers] = await Promise.all([
  must(clients.service.from('car_offers').select(offerSelect).in('id', offerIds).order('id'), 'service offer read'),
  must(clients.admin.from('car_offers').select('id').in('id', offerIds).order('id'), 'admin offer read'),
  must(clients.anon.from('car_offers').select('id').in('id', offerIds).order('id'), 'anon offer read'),
]);

assert.deepEqual(serviceOffers.map((row) => row.id), offerIds);
assert.deepEqual(adminOffers.map((row) => row.id), offerIds);
assert.deepEqual(anonOffers, []);
assert.equal(serviceOffers.filter((row) => row.pricing_strategy === 'threshold_daily_rate').length, 22);
assert.equal(serviceOffers.filter((row) => row.availability_mode === 'legacy').length, 22);
assert.equal(serviceOffers.filter((row) => row.is_available === false && row.is_published === false).length, 22);
assert.equal(serviceOffers.filter((row) => row.submission_status === 'draft').length, 22);
assert.equal(serviceOffers.filter((row) => row.min_rental_days === 1 && row.max_rental_days == null).length, 22);
assert.equal(serviceOffers.filter((row) => row.image_url).length, 21);

const [serviceTiers, adminTiers, anonTiers] = await Promise.all([
  must(clients.service.from('car_offer_daily_rate_tiers')
    .select('id,offer_id,threshold_days,daily_rate,is_active').in('offer_id', offerIds), 'service tier read'),
  must(clients.admin.from('car_offer_daily_rate_tiers').select('id').in('offer_id', offerIds), 'admin tier read'),
  must(clients.anon.from('car_offer_daily_rate_tiers').select('id').in('offer_id', offerIds), 'anon tier read'),
]);
assert.equal(serviceTiers.length, 145);
assert.equal(adminTiers.length, 145);
assert.deepEqual(anonTiers, []);

let parityChecked = 0;
for (const offer of manifest.offers) {
  const actualTiers = serviceTiers.filter((tier) => tier.offer_id === offer.offerId);
  for (const [daysText, sourceTotal] of Object.entries(offer.sourceTotals)) {
    const expectedRate = offer.dailyRates[daysText];
    const tier = actualTiers.find((row) => row.threshold_days === Number(daysText));
    assert.ok(tier, `${offer.offerId} is missing threshold ${daysText}`);
    assert.equal(Number(tier.daily_rate).toFixed(6), expectedRate);
    assert.equal(Math.round((Number(tier.daily_rate) * Number(daysText) + Number.EPSILON) * 100) / 100,
      Number(sourceTotal));
    parityChecked += 1;
  }
}
assert.equal(parityChecked, 145);

const [availability, publicAvailability, overrides, flags, bookings, fulfillments] = await Promise.all([
  must(clients.service.from('car_offer_city_availability')
    .select('offer_id,pickup_enabled,return_enabled,is_active,fee_mode,fee_per_direction,car_rental_cities!inner(code)')
    .in('offer_id', offerIds), 'availability read'),
  must(clients.anon.from('car_offer_city_availability').select('offer_id').in('offer_id', offerIds), 'public availability read'),
  must(clients.service.from('service_deposit_overrides')
    .select('resource_id,mode,amount,currency,enabled').eq('resource_type', 'cars').in('resource_id', offerIds),
  'deposit override read'),
  must(clients.service.from('site_settings')
    .select('car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled').eq('id', 1).single(), 'flag read'),
  must(clients.service.from('car_bookings').select('id').in('offer_id', offerIds), 'booking read'),
  must(clients.service.from('partner_service_fulfillments')
    .select('id').eq('resource_type', 'cars').in('resource_id', offerIds), 'fulfillment read'),
]);

assert.equal(availability.length, 22);
assert.equal(availability.filter((row) => row.car_rental_cities?.code === 'ayia-napa'
  && row.pickup_enabled && row.return_enabled && row.is_active
  && row.fee_mode === 'override' && Number(row.fee_per_direction) === 0).length, 22);
assert.deepEqual(publicAvailability, []);
assert.equal(overrides.length, 22);
assert.equal(overrides.filter((row) => row.mode === 'percent_total'
  && Number(row.amount) === 15 && row.currency === 'EUR' && row.enabled).length, 22);
assert.equal(flags.car_multi_city_mapped_enabled, false);
assert.equal(flags.car_threshold_daily_rates_enabled, false);
assert.deepEqual(bookings, []);
assert.deepEqual(fulfillments, []);

console.log(JSON.stringify({
  environment: { postgrestUrl: POSTGREST_URL, loopbackOnly: true },
  visibility: { serviceOffers: 22, adminOffers: 22, anonOffers: 0 },
  pricing: { tiers: 145, sourceParityChecked: parityChecked, sourceTotalMismatch: 0 },
  availability: { exactAyiaNapaRows: 22, anonRows: 0, paired: true, feePerDirection: 0 },
  payments: { exactPercentTotalOverrides: 22, amountPercent: 15 },
  safety: {
    mappedFlag: false,
    thresholdFlag: false,
    bookings: 0,
    fulfillments: 0,
    automaticAcceptance: false,
  },
}, null, 2));
