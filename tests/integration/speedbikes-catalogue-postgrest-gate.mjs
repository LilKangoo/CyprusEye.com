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
const EXACT_OWNER_GUARD_OFFER_ID = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
const SPEED_BIKES_PARTNER_ID = '583ee90b-d77c-47ff-97a4-76657a87809f';
const SNIPPER_BOOKING_ID = 'cae30000-0000-4000-8000-000000000001';

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

async function exactSnipperQuote(rentalDays) {
  const returnDate = new Date(Date.UTC(2026, 9, 1 + rentalDays, 10, 0, 0))
    .toISOString().slice(0, 10);
  const data = await must(clients.anon.rpc('resolve_car_threshold_authoritative_quote', {
    p_offer_id: EXACT_OWNER_GUARD_OFFER_ID,
    p_pickup_date: '2026-10-01',
    p_pickup_time: '10:00',
    p_return_date: returnDate,
    p_return_time: '10:00',
    p_pickup_city_code: 'ayia-napa',
    p_return_city_code: 'ayia-napa',
    p_pickup_location: 'ayia-napa',
    p_return_location: 'ayia-napa',
    p_full_insurance: false,
    p_young_driver: false,
    p_coupon_code: null,
    p_user_id: null,
    p_user_email: 'snipper-isolated@example.test',
  }), `Snipper authoritative quote for ${rentalDays} day(s)`);
  return Array.isArray(data) ? data[0] || null : data;
}

function snipperBookingPayload(authoritative) {
  return {
    id: SNIPPER_BOOKING_ID,
    offer_id: EXACT_OWNER_GUARD_OFFER_ID,
    full_name: 'Snipper isolated request',
    email: 'snipper-isolated@example.test',
    phone: '+35700000000',
    car_model: 'Snipper FX',
    location: 'larnaca',
    pickup_date: '2026-10-01',
    pickup_time: '10:00',
    pickup_location: 'ayia-napa',
    pickup_city_code: 'ayia-napa',
    return_date: '2026-10-08',
    return_time: '10:00',
    return_location: 'ayia-napa',
    return_city_code: 'ayia-napa',
    status: 'pending',
    quoted_price: Number(authoritative.final_rental_price),
    total_price: Number(authoritative.final_rental_price),
    currency: authoritative.currency,
    base_rental_price: Number(authoritative.rental_base_price),
    final_rental_price: Number(authoritative.final_rental_price),
    pickup_location_fee: Number(authoritative.pickup_location_fee),
    return_location_fee: Number(authoritative.return_location_fee),
    full_insurance: false,
    insurance_added: false,
    insurance_cost: Number(authoritative.insurance_cost),
    young_driver_fee: false,
    young_driver: false,
    young_driver_cost: Number(authoritative.young_driver_cost),
    coupon_id: authoritative.coupon_id,
    coupon_code: authoritative.coupon_code,
    coupon_discount_amount: Number(authoritative.discount_amount),
    coupon_partner_id: authoritative.coupon_partner_id,
    coupon_partner_commission_bps: authoritative.coupon_partner_commission_bps,
    pricing_snapshot: authoritative.pricing_snapshot,
  };
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

// Exercise the final public route resolver through real PostgREST/RLS. The
// isolated offer is made requestable only for the duration of this check and
// is restored to its exact draft state in finally. A missing exact owner must
// return NULL even though the legacy Larnaca location fallback exists, and the
// same offer must disappear from the authoritative public route resolver.
const exactOwnerGuardBaseline = await must(clients.service.from('car_offers').select([
  'id', 'owner_partner_id', 'location', 'availability_mode', 'is_available',
  'is_published', 'submission_status', 'stock_count',
].join(',')).eq('id', EXACT_OWNER_GUARD_OFFER_ID).single(), 'exact-owner guard baseline');
assert.ok(exactOwnerGuardBaseline.owner_partner_id, 'exact-owner fixture partner is required');

let exactOwnerGuard = null;
let snipperLifecycle = null;
try {
  await must(clients.service.from('car_offers').update({
    availability_mode: 'mapped',
    is_available: true,
    is_published: true,
    submission_status: 'approved',
    stock_count: Math.max(1, Number(exactOwnerGuardBaseline.stock_count) || 0),
  }).eq('id', EXACT_OWNER_GUARD_OFFER_ID), 'activate isolated exact-owner guard offer');
  await must(clients.service.from('site_settings').update({
    car_multi_city_mapped_enabled: true,
    car_threshold_daily_rates_enabled: true,
  }).eq('id', 1), 'enable isolated exact-owner guard flags');

  const eligibleBefore = await must(clients.anon.rpc('resolve_public_threshold_offer_ids', {
    p_pickup_city_code: 'ayia-napa',
    p_return_city_code: 'ayia-napa',
  }), 'eligible route before owner removal');
  assert.ok(eligibleBefore.some((row) => row.offer_id === EXACT_OWNER_GUARD_OFFER_ID));
  const exactOwnerBefore = await must(clients.service.rpc(
    'partner_service_fulfillment_partner_id_for_car_booking',
    { p_offer_id: EXACT_OWNER_GUARD_OFFER_ID, p_location: exactOwnerGuardBaseline.location },
  ), 'exact owner before removal');
  assert.equal(exactOwnerBefore, exactOwnerGuardBaseline.owner_partner_id);

  const expectedTotals = new Map([
    [1, 110], [2, 190], [3, 270], [4, 340], [5, 400],
    [6, 450], [7, 490], [8, 560], [10, 700], [14, 980],
  ]);
  const quoteMatrix = [];
  for (const [rentalDays, expectedTotal] of expectedTotals) {
    const authoritative = await exactSnipperQuote(rentalDays);
    assert.equal(authoritative?.quote_valid, true, `Snipper ${rentalDays}-day quote is unavailable`);
    assert.equal(Number(authoritative.rental_days), rentalDays);
    assert.equal(Number(authoritative.rental_base_price), expectedTotal);
    assert.equal(Number(authoritative.final_rental_price), expectedTotal);
    quoteMatrix.push([rentalDays, Number(authoritative.final_rental_price)]);
  }

  const sevenDayQuote = await exactSnipperQuote(7);
  await must(clients.anon.from('car_bookings').insert(snipperBookingPayload(sevenDayQuote)),
    'insert exact Snipper request');
  const requestBeforePayment = await must(clients.service.from('car_bookings')
    .select('id,status,payment_status,total_price').eq('id', SNIPPER_BOOKING_ID).single(),
  'read exact Snipper request');
  assert.equal(requestBeforePayment.status, 'pending');
  assert.equal(requestBeforePayment.payment_status, 'unpaid');
  assert.equal(Number(requestBeforePayment.total_price), 490);
  const pendingFulfillment = await must(clients.service.from('partner_service_fulfillments')
    .select('partner_id,resource_id,status').eq('booking_id', SNIPPER_BOOKING_ID).single(),
  'read exact Snipper fulfillment');
  assert.deepEqual(pendingFulfillment, {
    partner_id: SPEED_BIKES_PARTNER_ID,
    resource_id: EXACT_OWNER_GUARD_OFFER_ID,
    status: 'pending_acceptance',
  });

  await must(clients.service.from('service_deposit_requests').insert({
    resource_type: 'cars',
    booking_id: SNIPPER_BOOKING_ID,
    amount: 73.50,
    status: 'paid',
    paid_at: '2026-10-01T08:00:00Z',
  }), 'record exact Snipper 15 percent payment');
  const requestAfterPayment = await must(clients.service.from('car_bookings')
    .select('status,payment_status,total_price').eq('id', SNIPPER_BOOKING_ID).single(),
  'read exact Snipper partial-payment state');
  const fulfillmentAfterPayment = await must(clients.service.from('partner_service_fulfillments')
    .select('status').eq('booking_id', SNIPPER_BOOKING_ID).single(),
  'read exact Snipper fulfillment after payment');
  assert.equal(requestAfterPayment.status, 'pending');
  assert.equal(requestAfterPayment.payment_status, 'partial');
  assert.equal(fulfillmentAfterPayment.status, 'pending_acceptance');
  assert.equal(Number(requestAfterPayment.total_price) - 73.50, 416.50);
  snipperLifecycle = {
    quoteMatrix,
    bookingTotal: 490,
    paidNow: 73.50,
    remaining: 416.50,
    paymentStatus: 'partial',
    bookingStatus: 'pending',
    fulfillmentStatus: 'pending_acceptance',
    exactPartnerId: pendingFulfillment.partner_id,
    autoAccepted: false,
  };

  await must(clients.service.from('car_offers').update({ owner_partner_id: null })
    .eq('id', EXACT_OWNER_GUARD_OFFER_ID), 'remove isolated exact owner');

  const exactOwnerAfter = await must(clients.service.rpc(
    'partner_service_fulfillment_partner_id_for_car_booking',
    { p_offer_id: EXACT_OWNER_GUARD_OFFER_ID, p_location: exactOwnerGuardBaseline.location },
  ), 'exact owner after removal');
  assert.equal(exactOwnerAfter, null, 'threshold exact-owner resolver must never use legacy location fallback');
  const eligibleAfter = await must(clients.anon.rpc('resolve_public_threshold_offer_ids', {
    p_pickup_city_code: 'ayia-napa',
    p_return_city_code: 'ayia-napa',
  }), 'eligible route after owner removal');
  assert.ok(!eligibleAfter.some((row) => row.offer_id === EXACT_OWNER_GUARD_OFFER_ID));
  exactOwnerGuard = {
    exactOwnerBefore,
    exactOwnerAfter,
    routeEligibleBefore: true,
    routeEligibleAfter: false,
    legacyLocationFallbackUsed: false,
  };
} finally {
  await must(clients.service.from('service_deposit_requests').delete().eq('booking_id', SNIPPER_BOOKING_ID),
    'cleanup exact Snipper deposit request');
  await must(clients.service.from('partner_service_fulfillments').delete().eq('booking_id', SNIPPER_BOOKING_ID),
    'cleanup exact Snipper fulfillment');
  await must(clients.service.from('car_bookings').delete().eq('id', SNIPPER_BOOKING_ID),
    'cleanup exact Snipper booking');
  await must(clients.service.from('site_settings').update({
    car_multi_city_mapped_enabled: false,
    car_threshold_daily_rates_enabled: false,
  }).eq('id', 1), 'restore exact-owner guard flags');
  await must(clients.service.from('car_offers').update({
    owner_partner_id: exactOwnerGuardBaseline.owner_partner_id,
    availability_mode: exactOwnerGuardBaseline.availability_mode,
    is_available: exactOwnerGuardBaseline.is_available,
    is_published: exactOwnerGuardBaseline.is_published,
    submission_status: exactOwnerGuardBaseline.submission_status,
    stock_count: exactOwnerGuardBaseline.stock_count,
  }).eq('id', EXACT_OWNER_GUARD_OFFER_ID), 'restore exact-owner guard offer');
}

const exactOwnerGuardRestored = await must(clients.service.from('car_offers').select([
  'owner_partner_id', 'availability_mode', 'is_available', 'is_published',
  'submission_status', 'stock_count',
].join(',')).eq('id', EXACT_OWNER_GUARD_OFFER_ID).single(), 'verify exact-owner guard cleanup');
assert.deepEqual(exactOwnerGuardRestored, {
  owner_partner_id: exactOwnerGuardBaseline.owner_partner_id,
  availability_mode: exactOwnerGuardBaseline.availability_mode,
  is_available: exactOwnerGuardBaseline.is_available,
  is_published: exactOwnerGuardBaseline.is_published,
  submission_status: exactOwnerGuardBaseline.submission_status,
  stock_count: exactOwnerGuardBaseline.stock_count,
});
assert.equal((await must(clients.service.from('car_bookings').select('id')
  .eq('id', SNIPPER_BOOKING_ID), 'verify exact Snipper booking cleanup')).length, 0);
assert.equal((await must(clients.service.from('partner_service_fulfillments').select('id')
  .eq('booking_id', SNIPPER_BOOKING_ID), 'verify exact Snipper fulfillment cleanup')).length, 0);

console.log(JSON.stringify({
  environment: { postgrestUrl: POSTGREST_URL, loopbackOnly: true },
  visibility: { serviceOffers: 22, adminOffers: 22, anonOffers: 0 },
  pricing: { tiers: 145, sourceParityChecked: parityChecked, sourceTotalMismatch: 0 },
  availability: { exactAyiaNapaRows: 22, anonRows: 0, paired: true, feePerDirection: 0 },
  payments: { exactPercentTotalOverrides: 22, amountPercent: 15 },
  snipperLifecycle,
  safety: {
    mappedFlag: false,
    thresholdFlag: false,
    bookings: 0,
    fulfillments: 0,
    automaticAcceptance: false,
    exactOwnerGuard,
  },
}, null, 2));
