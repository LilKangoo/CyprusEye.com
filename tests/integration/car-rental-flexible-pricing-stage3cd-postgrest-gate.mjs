import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  NON_ADMIN_USER_ID,
  TOKENS,
  createTestJwt,
} from './car-rental-multicity-postgrest-auth.mjs';

const POSTGREST_URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Stage 3C/3D integration refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`);
assert.equal(parsedUrl.protocol, 'http:', 'Stage 3C/3D integration accepts local HTTP only.');

const OFFER_ID = 'ca300001-0000-4000-8000-000000000001';
const PARTNER_ID = 'ca2f0000-0000-4000-8000-000000000001';
const BOOKING_IDS = Object.freeze({
  valid: 'ca3d0000-0000-4000-8000-000000000001',
  coupon: 'ca3d0000-0000-4000-8000-000000000002',
  partial: 'ca3d0000-0000-4000-8000-000000000003',
  full: 'ca3d0000-0000-4000-8000-000000000004',
  statusAttack: 'ca3d0000-0000-4000-8000-000000000005',
  paymentAttack: 'ca3d0000-0000-4000-8000-000000000006',
  identityAttack: 'ca3d0000-0000-4000-8000-000000000007',
  missingOfferAttack: 'ca3d0000-0000-4000-8000-000000000008',
});
const TAMPER_BOOKING_IDS = Array.from({ length: 10 }, (_unused, index) => (
  `ca3d1000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
));
const ALL_BOOKING_IDS = [...Object.values(BOOKING_IDS), ...TAMPER_BOOKING_IDS];

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
  authenticated: clientFor(createTestJwt({
    role: 'authenticated',
    sub: NON_ADMIN_USER_ID,
    email: 'threshold-authenticated@example.test',
    user_metadata: { is_admin: false },
  })),
});

async function must(promise, label = 'PostgREST operation') {
  const result = await promise;
  if (result.error) assert.fail(`${label}: ${result.error.code || ''} ${result.error.message}`);
  return result.data;
}

async function expectRejected(promise, label, expectedCode = '23514') {
  const result = await promise;
  assert.ok(result.error, `${label} unexpectedly succeeded`);
  assert.equal(result.error.code, expectedCode, `${label} returned ${result.error.code}: ${result.error.message}`);
  return result.error;
}

async function quote(overrides = {}, client = clients.anon) {
  const payload = {
    p_offer_id: OFFER_ID,
    p_pickup_date: '2026-10-01',
    p_pickup_time: '10:00',
    p_return_date: '2026-10-11',
    p_return_time: '10:00',
    p_pickup_city_code: 'larnaca',
    p_return_city_code: 'paphos',
    p_pickup_location: 'larnaca',
    p_return_location: 'paphos',
    p_full_insurance: true,
    p_young_driver: true,
    p_coupon_code: null,
    p_user_id: null,
    p_user_email: 'threshold-fixture@example.test',
    ...overrides,
  };
  const rows = await must(client.rpc('resolve_car_threshold_authoritative_quote', payload), 'authoritative quote');
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function bookingPayload(id, authoritative, overrides = {}) {
  return {
    id,
    offer_id: OFFER_ID,
    full_name: 'Synthetic threshold tester',
    email: 'threshold-fixture@example.test',
    phone: '+35700000000',
    car_model: 'Mazda 2 test',
    location: 'larnaca',
    pickup_date: '2026-10-01',
    pickup_time: '10:00',
    pickup_location: 'larnaca',
    pickup_city_code: 'larnaca',
    return_date: '2026-10-11',
    return_time: '10:00',
    return_location: 'paphos',
    return_city_code: 'paphos',
    status: 'pending',
    payment_status: 'unpaid',
    quoted_price: Number(authoritative.final_rental_price),
    total_price: Number(authoritative.final_rental_price),
    currency: authoritative.currency,
    base_rental_price: Number(authoritative.pre_discount_total),
    final_rental_price: Number(authoritative.final_rental_price),
    pickup_location_fee: Number(authoritative.pickup_location_fee),
    return_location_fee: Number(authoritative.return_location_fee),
    full_insurance: authoritative.insurance_selected === true,
    insurance_added: authoritative.insurance_selected === true,
    insurance_cost: Number(authoritative.insurance_cost),
    young_driver_fee: authoritative.young_driver_selected === true,
    young_driver: authoritative.young_driver_selected === true,
    young_driver_cost: Number(authoritative.young_driver_cost),
    coupon_id: authoritative.coupon_id,
    coupon_code: authoritative.coupon_code,
    coupon_discount_amount: Number(authoritative.discount_amount),
    coupon_partner_id: authoritative.coupon_partner_id,
    coupon_partner_commission_bps: authoritative.coupon_partner_commission_bps,
    pricing_snapshot: authoritative.pricing_snapshot,
    ...overrides,
  };
}

const baselineOffer = await must(clients.service.from('car_offers').select([
  'id', 'pricing_strategy', 'availability_mode', 'min_rental_days', 'max_rental_days',
  'insurance_mode', 'insurance_per_day', 'young_driver_fee', 'young_driver_cost',
].join(',')).eq('id', OFFER_ID).single(), 'read baseline offer');
const baselineFlags = await must(clients.service.from('site_settings')
  .select('car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled').eq('id', 1).single(), 'read baseline flags');
const cities = await must(clients.service.from('car_rental_cities').select('id,code').in('code', ['larnaca', 'paphos']), 'read exact cities');
const cityByCode = Object.fromEntries(cities.map((city) => [city.code, city.id]));
assert.ok(cityByCode.larnaca && cityByCode.paphos);

async function cleanup() {
  await clients.service.from('service_deposit_requests').delete().in('booking_id', ALL_BOOKING_IDS);
  await clients.service.from('partner_service_fulfillments').delete().in('booking_id', ALL_BOOKING_IDS);
  await clients.service.from('car_bookings').delete().in('id', ALL_BOOKING_IDS);
  await clients.service.from('site_settings').update({
    car_multi_city_mapped_enabled: false,
    car_threshold_daily_rates_enabled: false,
  }).eq('id', 1);
  await clients.service.from('car_offers').update({ availability_mode: 'legacy' }).eq('id', OFFER_ID);
  await clients.service.from('car_offers').update({
    pricing_strategy: baselineOffer.pricing_strategy,
    min_rental_days: baselineOffer.min_rental_days,
    max_rental_days: baselineOffer.max_rental_days,
    insurance_mode: baselineOffer.insurance_mode,
    insurance_per_day: baselineOffer.insurance_per_day,
    young_driver_fee: baselineOffer.young_driver_fee,
    young_driver_cost: baselineOffer.young_driver_cost,
  }).eq('id', OFFER_ID);
  await clients.service.from('car_offer_city_availability').delete().eq('offer_id', OFFER_ID);
  await clients.service.from('car_offer_daily_rate_tiers').delete().eq('offer_id', OFFER_ID);
  await clients.service.from('car_offers').update({
    min_rental_days: baselineOffer.min_rental_days,
    max_rental_days: baselineOffer.max_rental_days,
  }).eq('id', OFFER_ID);
}

const summary = {
  environment: { url: POSTGREST_URL, loopbackOnly: true },
  flags: {},
  quote: {},
  authoritativeWrite: {},
  tamper: {},
  duration: {},
  partnerWorkflow: {},
  partialPayment: {},
  cleanup: {},
};

await cleanup();

try {
  await must(clients.service.from('car_offer_daily_rate_tiers').insert([
    { offer_id: OFFER_ID, threshold_days: 1, daily_rate: 50 },
    { offer_id: OFFER_ID, threshold_days: 3, daily_rate: 45 },
    { offer_id: OFFER_ID, threshold_days: 7, daily_rate: 40 },
  ]), 'seed exact threshold tiers');
  await must(clients.service.from('car_offers').update({
    pricing_strategy: 'threshold_daily_rate',
    insurance_mode: 'optional_daily',
    insurance_per_day: 12,
    young_driver_fee: true,
    young_driver_cost: 8,
    max_rental_days: null,
  }).eq('id', OFFER_ID), 'configure threshold test offer');
  await must(clients.service.from('car_offer_city_availability').insert([
    {
      offer_id: OFFER_ID,
      city_id: cityByCode.larnaca,
      pickup_enabled: true,
      return_enabled: true,
      is_active: true,
      fee_mode: 'inherit',
      fee_per_direction: null,
    },
    {
      offer_id: OFFER_ID,
      city_id: cityByCode.paphos,
      pickup_enabled: true,
      return_enabled: true,
      is_active: true,
      fee_mode: 'override',
      fee_per_direction: 25,
    },
  ]), 'seed exact city availability and fees');
  await must(clients.service.from('car_offers').update({ availability_mode: 'mapped' }).eq('id', OFFER_ID), 'map isolated offer');

  assert.equal(await quote(), null, 'threshold quote must be unavailable while flags are OFF');
  await must(clients.service.from('site_settings').update({
    car_multi_city_mapped_enabled: true,
    car_threshold_daily_rates_enabled: true,
  }).eq('id', 1), 'enable isolated runtime flags');
  summary.flags = { defaultMapped: false, defaultThreshold: false, isolatedTestEnabled: true };

  const publicTiers = await must(clients.anon.from('car_offer_daily_rate_tiers')
    .select('threshold_days,daily_rate').eq('offer_id', OFFER_ID).order('threshold_days'),
  'fully-enabled public exact-offer tiers');
  assert.deepEqual(publicTiers.map((row) => [row.threshold_days, Number(row.daily_rate)]),
    [[1, 50], [3, 45], [7, 40]]);
  summary.flags.publicTierRows = publicTiers.length;

  const authoritative = await quote();
  assert.ok(authoritative?.quote_valid);
  assert.equal(authoritative.rental_days, 10);
  assert.equal(authoritative.threshold_days, 7);
  assert.equal(Number(authoritative.daily_rate), 40);
  assert.equal(Number(authoritative.rental_base_price), 400);
  assert.equal(Number(authoritative.pickup_location_fee), 0);
  assert.equal(Number(authoritative.return_location_fee), 25);
  assert.equal(Number(authoritative.insurance_cost), 120);
  assert.equal(Number(authoritative.young_driver_cost), 80);
  assert.equal(Number(authoritative.pre_discount_total), 625);
  assert.equal(Number(authoritative.final_rental_price), 625);
  summary.quote = {
    rentalDays: 10,
    selectedThreshold: 7,
    dailyRate: 40,
    completePeriodBase: 400,
    directionalFees: [0, 25],
    insurance: 120,
    youngDriver: 80,
    final: 625,
  };

  assert.equal(await quote({ p_user_id: NON_ADMIN_USER_ID }), null,
    'anonymous callers cannot quote as an authenticated user');
  assert.equal(await quote({
    p_user_id: NON_ADMIN_USER_ID,
    p_user_email: 'wrong@example.test',
  }, clients.authenticated), null, 'authenticated callers cannot quote with another email');
  assert.equal(await quote({
    p_user_id: 'ca2c0000-0000-4000-8000-000000000099',
    p_user_email: 'threshold-authenticated@example.test',
  }, clients.authenticated), null, 'authenticated callers cannot quote as another user ID');
  const authenticatedQuote = await quote({
    p_user_id: NON_ADMIN_USER_ID,
    p_user_email: 'threshold-authenticated@example.test',
  }, clients.authenticated);
  assert.equal(authenticatedQuote?.quote_valid, true, 'matching authenticated principal can quote');
  const authenticatedDerivedIdentityQuote = await quote({
    p_user_id: null,
    p_user_email: 'threshold-authenticated@example.test',
  }, clients.authenticated);
  assert.equal(authenticatedDerivedIdentityQuote?.quote_valid, true,
    'authenticated quote derives the exact JWT user when the optional input is null');

  await expectRejected(clients.anon.from('car_bookings').insert({
    ...bookingPayload(BOOKING_IDS.missingOfferAttack, authoritative),
    offer_id: null,
    pricing_snapshot: null,
  }), 'public booking without exact offer');
  summary.tamper['public booking without exact offer'] = 'rejected';

  const validRequestPayload = bookingPayload(BOOKING_IDS.valid, authoritative);
  delete validRequestPayload.payment_status;
  await must(clients.anon.from('car_bookings').insert(validRequestPayload), 'anonymous valid booking request');
  const validBooking = await must(clients.service.from('car_bookings')
    .select('id,status,payment_status,pricing_validated_at,pricing_snapshot').eq('id', BOOKING_IDS.valid).single(), 'read valid request');
  assert.equal(validBooking.status, 'pending');
  assert.equal(validBooking.payment_status, 'unpaid');
  assert.ok(validBooking.pricing_validated_at);
  assert.equal(validBooking.pricing_snapshot.pricing_strategy, 'threshold_daily_rate');
  const fulfillment = await must(clients.service.from('partner_service_fulfillments')
    .select('partner_id,resource_id,status').eq('booking_id', BOOKING_IDS.valid).single(), 'read pending partner fulfillment');
  assert.deepEqual(fulfillment, { partner_id: PARTNER_ID, resource_id: OFFER_ID, status: 'pending_acceptance' });
  summary.authoritativeWrite = { acceptedAsRequestOnly: true, pricingValidated: true };
  summary.partnerWorkflow = {
    bookingStatus: 'pending',
    fulfillmentStatus: 'pending_acceptance',
    autoAccepted: false,
    exactOfferPartner: true,
  };

  const tamperCases = [
    ['altered daily rate', (payload) => ({ pricing_snapshot: { ...payload.pricing_snapshot, daily_rate: 0.01 } })],
    ['altered base price', () => ({ base_rental_price: 1 })],
    ['altered rental days', (payload) => ({ pricing_snapshot: { ...payload.pricing_snapshot, rental_days: 1 } })],
    ['altered city fee', () => ({ return_location_fee: 0 })],
    ['altered insurance selection', () => ({ full_insurance: false })],
    ['altered final total', () => ({ quoted_price: 1, total_price: 1, final_rental_price: 1 })],
    ['threshold that does not exist', (payload) => ({ pricing_snapshot: { ...payload.pricing_snapshot, tier_id: 'ca3d0000-0000-4000-8000-00000000ffff' } })],
  ];
  for (let index = 0; index < tamperCases.length; index += 1) {
    const [label, mutate] = tamperCases[index];
    const base = bookingPayload(`ca3d1000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, authoritative);
    await expectRejected(clients.anon.from('car_bookings').insert({ ...base, ...mutate(base) }), label);
    summary.tamper[label] = 'rejected';
  }

  const couponQuote = await quote({ p_coupon_code: 'SAVE10' });
  assert.equal(Number(couponQuote.discount_amount), 62.5);
  assert.equal(Number(couponQuote.final_rental_price), 562.5);
  await must(clients.anon.from('car_bookings').insert(bookingPayload(BOOKING_IDS.coupon, couponQuote)), 'valid server coupon quote');
  const couponTamper = bookingPayload('ca3d1000-0000-4000-8000-000000000007', couponQuote, { coupon_discount_amount: 600 });
  await expectRejected(clients.anon.from('car_bookings').insert(couponTamper), 'altered discount');
  summary.tamper['altered discount'] = 'rejected';

  const tierOne = await must(clients.service.from('car_offer_daily_rate_tiers')
    .select('id').eq('offer_id', OFFER_ID).eq('threshold_days', 1).single(), 'read first tier');
  await must(clients.service.from('car_offer_daily_rate_tiers').update({ is_active: false }).eq('id', tierOne.id), 'raise effective minimum');
  assert.equal(await quote({ p_return_date: '2026-10-02' }), null);
  const belowMinimum = bookingPayload('ca3d1000-0000-4000-8000-000000000008', authoritative, {
    return_date: '2026-10-02',
    return_city_code: 'larnaca',
    return_location: 'larnaca',
  });
  await expectRejected(clients.anon.from('car_bookings').insert(belowMinimum), 'duration below minimum');
  summary.tamper['duration below minimum'] = 'rejected';
  await must(clients.service.from('car_offer_daily_rate_tiers').update({ is_active: true }).eq('id', tierOne.id), 'restore first tier');

  await must(clients.service.from('car_offers').update({ max_rental_days: 9 }).eq('id', OFFER_ID), 'set maximum');
  assert.equal(await quote(), null);
  await expectRejected(clients.anon.from('car_bookings').insert(bookingPayload(
    'ca3d1000-0000-4000-8000-000000000009', authoritative,
  )), 'duration above maximum');
  summary.tamper['duration above maximum'] = 'rejected';
  await must(clients.service.from('car_offers').update({ max_rental_days: null }).eq('id', OFFER_ID), 'restore no maximum');

  await expectRejected(clients.service.from('car_bookings').insert(bookingPayload(
    BOOKING_IDS.statusAttack,
    authoritative,
    { status: 'confirmed' },
  )), 'threshold direct confirmed status');
  summary.tamper['direct confirmed booking'] = 'rejected';

  await expectRejected(clients.anon.from('car_bookings').insert(bookingPayload(
    BOOKING_IDS.paymentAttack,
    authoritative,
    { payment_status: 'paid' },
  )), 'threshold forged paid status');
  summary.tamper['forged paid status'] = 'rejected';

  await expectRejected(clients.authenticated.from('car_bookings').insert(bookingPayload(
    BOOKING_IDS.identityAttack,
    authenticatedQuote,
    { email: 'wrong@example.test' },
  )), 'threshold authenticated email impersonation');
  summary.tamper['authenticated email impersonation'] = 'rejected';

  await must(clients.service.from('car_offers').update({
    insurance_mode: 'optional_daily',
    insurance_per_day: 30,
    young_driver_fee: false,
    young_driver_cost: 0,
  }).eq('id', OFFER_ID), 'configure exact 490 partial-payment fixture');
  await must(clients.service.from('car_offer_city_availability').update({
    fee_mode: 'inherit',
    fee_per_direction: null,
  }).eq('offer_id', OFFER_ID).eq('city_id', cityByCode.paphos), 'restore standard paphos fee');
  const paymentQuote = await quote({
    p_return_date: '2026-10-08',
    p_return_city_code: 'larnaca',
    p_return_location: 'larnaca',
    p_young_driver: false,
  });
  assert.equal(Number(paymentQuote.final_rental_price), 490);
  const paymentOverrides = {
    return_date: '2026-10-08',
    return_city_code: 'larnaca',
    return_location: 'larnaca',
    young_driver_fee: false,
    young_driver_cost: 0,
  };
  await must(clients.anon.from('car_bookings').insert(bookingPayload(BOOKING_IDS.partial, paymentQuote, paymentOverrides)), 'insert 490 partial fixture');
  await must(clients.anon.from('car_bookings').insert(bookingPayload(BOOKING_IDS.full, paymentQuote, paymentOverrides)), 'insert 490 full fixture');
  await must(clients.service.from('service_deposit_requests').insert([
    { resource_type: 'cars', booking_id: BOOKING_IDS.partial, amount: 73.50, status: 'paid', paid_at: '2026-10-01T08:00:00Z' },
    { resource_type: 'cars', booking_id: BOOKING_IDS.full, amount: 490, status: 'paid', paid_at: '2026-10-01T08:00:00Z' },
  ]), 'record isolated payment fixtures');
  const paymentStates = await must(clients.service.from('car_bookings')
    .select('id,status,payment_status').in('id', [BOOKING_IDS.partial, BOOKING_IDS.full]).order('id'), 'read payment and booking statuses');
  assert.deepEqual(paymentStates.map((row) => [row.status, row.payment_status]), [
    ['pending', 'partial'],
    ['pending', 'paid'],
  ]);
  const paymentFulfillments = await must(clients.service.from('partner_service_fulfillments')
    .select('booking_id,status').in('booking_id', [BOOKING_IDS.partial, BOOKING_IDS.full]).order('booking_id'), 'read payment partner statuses');
  assert.deepEqual(paymentFulfillments.map((row) => row.status), ['pending_acceptance', 'pending_acceptance']);
  summary.partialPayment = {
    bookingTotal: 490,
    paidNow: 73.5,
    remaining: 416.5,
    partialPaymentStatus: 'partial',
    fullPaymentStatus: 'paid',
    bookingStatusAfterEitherPayment: 'pending',
    partnerStatusAfterEitherPayment: 'pending_acceptance',
  };

  const exact24 = await must(clients.service.rpc('car_rental_local_duration_days_24h', {
    p_pickup_date: '2026-10-01', p_pickup_time: '10:00', p_return_date: '2026-10-02', p_return_time: '10:00',
  }), 'exact 24-hour local duration');
  const over24 = await must(clients.service.rpc('car_rental_local_duration_days_24h', {
    p_pickup_date: '2026-10-01', p_pickup_time: '10:00', p_return_date: '2026-10-02', p_return_time: '10:30',
  }), '24.5-hour local duration');
  const springDst = await must(clients.service.rpc('car_rental_local_duration_days_24h', {
    p_pickup_date: '2026-03-28', p_pickup_time: '10:00', p_return_date: '2026-03-29', p_return_time: '10:00',
  }), 'Europe/Nicosia spring DST duration');
  const autumnDst = await must(clients.service.rpc('car_rental_local_duration_days_24h', {
    p_pickup_date: '2026-10-24', p_pickup_time: '10:00', p_return_date: '2026-10-25', p_return_time: '10:00',
  }), 'Europe/Nicosia autumn DST duration');
  const springGap = await must(clients.service.rpc('car_rental_local_duration_days_24h', {
    p_pickup_date: '2026-03-29', p_pickup_time: '03:30', p_return_date: '2026-03-30', p_return_time: '03:30',
  }), 'Europe/Nicosia non-existent spring time');
  const repeatedAutumnHour = await must(clients.service.rpc('car_rental_local_duration_days_24h', {
    p_pickup_date: '2026-10-25', p_pickup_time: '03:30', p_return_date: '2026-10-26', p_return_time: '03:30',
  }), 'Europe/Nicosia repeated autumn time');
  assert.equal(exact24, 1);
  assert.equal(over24, 2);
  assert.equal(springDst, 1);
  assert.equal(autumnDst, 2);
  assert.equal(springGap, null);
  assert.equal(repeatedAutumnHour, 1);
  summary.duration = {
    exact24Hours: 1,
    twentyFourAndHalfHours: 2,
    springDstWallClockDay: 1,
    autumnDstWallClockDay: 2,
    nonexistentSpringTime: 'rejected',
    repeatedAutumnHourUsesStandardTime: 1,
    timezone: 'Europe/Nicosia',
  };
} finally {
  await cleanup();
}

const finalFlags = await must(clients.service.from('site_settings')
  .select('car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled').eq('id', 1).single(), 'read final flags');
assert.deepEqual(finalFlags, baselineFlags);
const finalOffer = await must(clients.service.from('car_offers')
  .select('pricing_strategy,availability_mode').eq('id', OFFER_ID).single(), 'read final offer state');
assert.deepEqual(finalOffer, {
  pricing_strategy: baselineOffer.pricing_strategy,
  availability_mode: baselineOffer.availability_mode,
});
assert.equal((await must(clients.service.from('car_offer_daily_rate_tiers').select('id').eq('offer_id', OFFER_ID), 'final tier rows')).length, 0);
assert.equal((await must(clients.service.from('car_bookings').select('id').in('id', ALL_BOOKING_IDS), 'final booking rows')).length, 0);
summary.cleanup = {
  mappedFlag: false,
  thresholdFlag: false,
  pricingStrategy: 'legacy_compat',
  availabilityMode: 'legacy',
  tierRows: 0,
  bookingRows: 0,
};

console.log(JSON.stringify(summary, null, 2));
