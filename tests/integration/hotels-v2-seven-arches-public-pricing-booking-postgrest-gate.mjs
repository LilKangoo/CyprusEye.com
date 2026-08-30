import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const BASE_URL = process.env.HOTELS_V2_PUBLIC_BOOKING_POSTGREST_URL
  || process.env.HOTELS_V2_REVIEWED_PRICING_POSTGREST_URL
  || 'http://127.0.0.1:53020';
const parsedUrl = new URL(BASE_URL);
assert.equal(parsedUrl.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname));

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PARTNER = '20000000-0000-4000-8000-000000000001';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_ROOM = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const QUOTE_REQUEST_CONTRACT = 'hotels_v2_seven_arches_public_quote_request_v1';
const QUOTE_RESULT_CONTRACT = 'hotels_v2_seven_arches_public_quote_v1';
const BOOKING_REQUEST_CONTRACT = 'hotels_v2_seven_arches_public_booking_request_v1';
const BOOKING_RESULT_CONTRACT = 'hotels_v2_seven_arches_public_booking_result_v1';

const requestCounts = {
  quote_positive: 0,
  booking_positive: 0,
  booking_replay: 0,
  quote_negative: 0,
  booking_negative: 0,
  raw_acl_negative: 0,
  partner_control: 0,
};
let requestCount = 0;

function isoDate(daysFromToday) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value.toISOString().slice(0, 10);
}

async function request(path, { token, method = 'GET', body } = {}) {
  requestCount += 1;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  return { status: response.status, ok: response.ok, payload };
}

function rpc(name, token, body = {}) {
  return request(`/rpc/${name}`, { token, method: 'POST', body });
}

function assertControlled(result, status, message, label) {
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.message, message,
    `${label}: ${JSON.stringify(result.payload)}`);
}

function assertExactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}

const arrivalDate = isoDate(45);
const departureDate = isoDate(47);
const quoteKeys = [
  'contract_version', 'hotel_id', 'room_required', 'room_type_id',
  'room_rate_id', 'arrival_date', 'departure_date', 'nights', 'guest_count',
  'currency', 'allocation', 'selected_extras', 'extras_total', 'room_total',
  'customer_total', 'authority_token',
  'quote_fingerprint', 'quoted_at', 'expires_at',
];
const allocationKeys = [
  'room_key', 'room_type_id', 'room_rate_id', 'pricing_schedule_id',
  'schedule_tier_id', 'pricing_guest_count', 'minimum_nights', 'tier_version',
  'nightly_price', 'nights', 'stay_total', 'currency',
];

const upperRequest = {
  contract_version: QUOTE_REQUEST_CONTRACT,
  hotel_id: HOTEL,
  room_type_id: UPPER_ROOM,
  room_rate_id: UPPER_RATE,
  arrival_date: arrivalDate,
  departure_date: departureDate,
  guest_count: 2,
  selected_extra_ids: [],
};
const upperQuoteResult = await rpc('hotel_v2_public_quote_seven_arches', TOKENS.anon, {
  p_request: upperRequest,
});
assert.equal(upperQuoteResult.status, 200, JSON.stringify(upperQuoteResult.payload));
const upperQuote = upperQuoteResult.payload;
assertExactKeys(upperQuote, quoteKeys, 'Upper quote keys drifted');
assert.equal(upperQuote.contract_version, QUOTE_RESULT_CONTRACT);
assert.equal(upperQuote.hotel_id, HOTEL);
assert.equal(upperQuote.room_required, true);
assert.equal(upperQuote.room_type_id, UPPER_ROOM);
assert.equal(upperQuote.room_rate_id, UPPER_RATE);
assert.equal(upperQuote.nights, 2);
assert.equal(upperQuote.guest_count, 2);
assert.equal(upperQuote.currency, 'EUR');
assert.equal(upperQuote.allocation.length, 1);
assertExactKeys(upperQuote.allocation[0], allocationKeys,
  'Upper allocation keys drifted');
assert.equal(upperQuote.allocation[0].room_key, 'upper');
assert.equal(upperQuote.allocation[0].room_type_id, UPPER_ROOM);
assert.equal(upperQuote.allocation[0].room_rate_id, UPPER_RATE);
assert.match(upperQuote.allocation[0].schedule_tier_id,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
assert.ok(Number(upperQuote.allocation[0].tier_version) > 0);
assert.equal(Number(upperQuote.room_total) + Number(upperQuote.extras_total),
  Number(upperQuote.customer_total));
assert.equal('commission_total' in upperQuote, false);
assert.equal('partner_net' in upperQuote, false);
assert.match(upperQuote.authority_token, /^[0-9a-f]{64}$/);
assert.match(upperQuote.quote_fingerprint, /^[0-9a-f]{64}$/);
requestCounts.quote_positive += 1;

const bundleResult = await rpc('hotel_v2_public_quote_seven_arches', TOKENS.anon, {
  p_request: {
    ...upperRequest,
    room_type_id: null,
    room_rate_id: null,
    guest_count: 5,
  },
});
assert.equal(bundleResult.status, 200, JSON.stringify(bundleResult.payload));
assertExactKeys(bundleResult.payload, quoteKeys, 'Bundle quote keys drifted');
assert.equal(bundleResult.payload.room_required, false);
assert.equal(bundleResult.payload.room_type_id, null);
assert.equal(bundleResult.payload.room_rate_id, null);
assert.deepEqual(bundleResult.payload.allocation.map((row) => row.room_type_id).sort(),
  [GROUND_ROOM, UPPER_ROOM].sort());
assert.deepEqual(bundleResult.payload.allocation.map((row) => row.room_rate_id).sort(),
  [GROUND_RATE, UPPER_RATE].sort());
assert.equal('commission_total' in bundleResult.payload, false);
assert.equal('partner_net' in bundleResult.payload, false);
requestCounts.quote_positive += 1;

for (const scenario of [
  { guest_count: 1, room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE,
    room_key: 'upper', pricing_guest_count: 2 },
  { guest_count: 2, room_type_id: GROUND_ROOM, room_rate_id: GROUND_RATE,
    room_key: 'ground', pricing_guest_count: 2 },
  { guest_count: 3, room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE,
    room_key: 'upper', pricing_guest_count: 3 },
  { guest_count: 4, room_type_id: GROUND_ROOM, room_rate_id: GROUND_RATE,
    room_key: 'ground', pricing_guest_count: 4 },
  { guest_count: 6, room_type_id: null, room_rate_id: null,
    room_key: null, pricing_guest_count: 3 },
  { guest_count: 7, room_type_id: null, room_rate_id: null,
    room_key: null, pricing_guest_count: 4 },
  { guest_count: 8, room_type_id: null, room_rate_id: null,
    room_key: null, pricing_guest_count: 4 },
]) {
  const result = await rpc('hotel_v2_public_quote_seven_arches', TOKENS.anon, {
    p_request: {
      ...upperRequest,
      guest_count: scenario.guest_count,
      room_type_id: scenario.room_type_id,
      room_rate_id: scenario.room_rate_id,
    },
  });
  assert.equal(result.status, 200,
    `guest ${scenario.guest_count}: ${JSON.stringify(result.payload)}`);
  assertExactKeys(result.payload, quoteKeys,
    `guest ${scenario.guest_count} quote keys drifted`);
  assert.equal(result.payload.room_required, scenario.guest_count <= 4);
  assert.equal(result.payload.room_type_id, scenario.room_type_id);
  assert.equal(result.payload.room_rate_id, scenario.room_rate_id);
  assert.equal(result.payload.allocation.length, scenario.guest_count <= 4 ? 1 : 2);
  assert.ok(result.payload.allocation.every((row) => (
    row.pricing_guest_count === scenario.pricing_guest_count
  )), `guest ${scenario.guest_count} pricing floor/allocation drifted`);
  assert.equal('commission_total' in result.payload, false);
  assert.equal('partner_net' in result.payload, false);
  if (scenario.room_key) {
    assert.equal(result.payload.allocation[0].room_key, scenario.room_key);
  } else {
    assert.deepEqual(result.payload.allocation.map((row) => row.room_key),
      ['upper', 'ground']);
  }
  requestCounts.quote_positive += 1;
}

for (const [label, requestBody] of [
  ['unknown key', { ...upperRequest, injected_total: 1 }],
  ['uppercase UUID', { ...upperRequest, room_type_id: UPPER_ROOM.toUpperCase() }],
  ['duplicate extra', { ...upperRequest, selected_extra_ids: ['x', 'x'] }],
  ['bundle with Room', { ...upperRequest, guest_count: 5 }],
  ['unsupported guests', { ...upperRequest, guest_count: 9 }],
]) {
  const result = await rpc('hotel_v2_public_quote_seven_arches', TOKENS.anon, {
    p_request: requestBody,
  });
  assert.equal(result.ok, false, `${label} quote unexpectedly succeeded`);
  assert.ok([400, 409].includes(result.status),
    `${label}: ${result.status} ${JSON.stringify(result.payload)}`);
  requestCounts.quote_negative += 1;
}

const bookingRequest = {
  contract_version: BOOKING_REQUEST_CONTRACT,
  quote: upperQuote,
  customer: {
    name: 'Focused Public Booking',
    email: 'public-booking-gate@example.invalid',
    phone: null,
    notes: 'Disposable PostgREST gate booking',
    language: 'en',
  },
  coupon_code: null,
  referral: null,
};
const bookingResult = await rpc(
  'hotel_v2_public_create_seven_arches_booking', TOKENS.anon,
  { p_request: bookingRequest },
);
assert.equal(bookingResult.status, 200, JSON.stringify(bookingResult.payload));
assertExactKeys(bookingResult.payload, [
  'contract_version', 'booking_id', 'status', 'currency', 'room_total',
  'extras_total', 'coupon_discount', 'customer_total', 'quote_fingerprint',
  'created_at', 'replayed',
], 'Booking result keys drifted');
assert.equal(bookingResult.payload.contract_version, BOOKING_RESULT_CONTRACT);
assert.equal(bookingResult.payload.status, 'pending');
assert.equal(bookingResult.payload.currency, 'EUR');
assert.equal(bookingResult.payload.quote_fingerprint, upperQuote.quote_fingerprint);
assert.equal(bookingResult.payload.replayed, false);
assert.equal(Number(bookingResult.payload.coupon_discount), 0);
assert.equal(Number(bookingResult.payload.customer_total),
  Number(upperQuote.customer_total));
assert.match(bookingResult.payload.booking_id,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
requestCounts.booking_positive += 1;

const bookingReplay = await rpc(
  'hotel_v2_public_create_seven_arches_booking', TOKENS.anon,
  { p_request: bookingRequest },
);
assert.equal(bookingReplay.status, 200, JSON.stringify(bookingReplay.payload));
assertExactKeys(bookingReplay.payload, [
  'contract_version', 'booking_id', 'status', 'currency', 'room_total',
  'extras_total', 'coupon_discount', 'customer_total', 'quote_fingerprint',
  'created_at', 'replayed',
], 'Booking replay result keys drifted');
assert.equal(bookingReplay.payload.booking_id, bookingResult.payload.booking_id);
assert.equal(bookingReplay.payload.quote_fingerprint, upperQuote.quote_fingerprint);
assert.equal(bookingReplay.payload.replayed, true);
requestCounts.booking_replay += 1;

const conflictingReplay = await rpc(
  'hotel_v2_public_create_seven_arches_booking', TOKENS.anon,
  { p_request: {
    ...bookingRequest,
    customer: { ...bookingRequest.customer, name: 'Conflicting Public Booking' },
  } },
);
assertControlled(conflictingReplay, 409,
  'hotels_v2_seven_arches_public_booking_quote_already_consumed',
  'conflicting booking replay');
requestCounts.booking_negative += 1;

const tamperedQuote = structuredClone(bundleResult.payload);
tamperedQuote.customer_total = Number(tamperedQuote.customer_total) + 1;
const tamperedResult = await rpc(
  'hotel_v2_public_create_seven_arches_booking', TOKENS.anon,
  { p_request: { ...bookingRequest, quote: tamperedQuote } },
);
assertControlled(tamperedResult, 409,
  'hotels_v2_seven_arches_public_booking_stale_quote', 'tampered quote');
requestCounts.booking_negative += 1;

const extendedQuote = structuredClone(bundleResult.payload);
const shiftOneHour = (value) => new Date(Date.parse(value) + 60 * 60 * 1000)
  .toISOString().replace(/Z$/, '000Z');
extendedQuote.quoted_at = shiftOneHour(extendedQuote.quoted_at);
extendedQuote.expires_at = shiftOneHour(extendedQuote.expires_at);
const extendedResult = await rpc(
  'hotel_v2_public_create_seven_arches_booking', TOKENS.anon,
  { p_request: { ...bookingRequest, quote: extendedQuote } },
);
assertControlled(extendedResult, 409,
  'hotels_v2_seven_arches_public_booking_stale_quote',
  'caller-extended quote issuance');
requestCounts.booking_negative += 1;

const invalidCoupon = await rpc(
  'hotel_v2_public_create_seven_arches_booking', TOKENS.anon,
  { p_request: { ...bookingRequest, quote: bundleResult.payload,
    coupon_code: 'NO_SUCH_COUPON_114420' } },
);
assertControlled(invalidCoupon, 400,
  'hotels_v2_seven_arches_public_booking_invalid_coupon', 'invalid coupon');
requestCounts.booking_negative += 1;

const directInsert = await request('/hotel_bookings', {
  token: TOKENS.anon,
  method: 'POST',
  body: {
    hotel_id: HOTEL,
    hotel_slug: 'seven-arches-hotel',
    customer_name: 'Direct bypass probe',
    customer_email: 'direct-bypass@example.invalid',
    arrival_date: isoDate(70),
    departure_date: isoDate(72),
    num_adults: 2,
    num_children: 0,
    nights: 2,
    total_price: 1,
    status: 'pending',
  },
});
assertControlled(directInsert, 401,
  'permission denied for table hotel_bookings', 'direct insert bypass');
assert.equal(directInsert.payload?.code, '42501');
requestCounts.raw_acl_negative += 1;

for (const relation of [
  'hotel_seven_arches_public_quote_issuances',
  'hotel_seven_arches_public_booking_transaction_context',
  'hotel_seven_arches_public_booking_receipts',
]) {
  const raw = await request(`/${relation}?select=*&limit=1`, { token: TOKENS.owner });
  assert.equal(raw.ok, false, `raw ${relation} unexpectedly readable`);
  assert.ok([401, 403, 404].includes(raw.status), JSON.stringify(raw.payload));
  requestCounts.raw_acl_negative += 1;
}

const anonPartner = await rpc(
  'hotel_v2_partner_get_seven_arches_reviewed_pricing', TOKENS.anon,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL },
);
assert.equal(anonPartner.ok, false, 'anon Partner control unexpectedly succeeded');
assert.ok([401, 403, 404].includes(anonPartner.status));
requestCounts.partner_control += 1;
const partnerControl = await rpc(
  'hotel_v2_partner_get_seven_arches_reviewed_pricing', TOKENS.owner,
  { p_partner_id: PARTNER, p_hotel_id: HOTEL },
);
assert.equal(partnerControl.status, 200, JSON.stringify(partnerControl.payload));
assert.equal(partnerControl.payload.hotel_id, HOTEL);
assert.equal(partnerControl.payload.partner_id, PARTNER);
assertExactKeys(partnerControl.payload, [
  'contract_version', 'partner_id', 'hotel_id', 'assignment_id',
  'assignment_version', 'access_snapshot_token', 'pricing_snapshot_token',
  'evolution_snapshot_token', 'commission_policy', 'current_items', 'proposals',
], 'Partner reviewed-pricing control keys drifted');
assert.equal(partnerControl.payload.contract_version,
  'hotels_v2_seven_arches_reviewed_pricing_partner_control_v1');
assert.match(partnerControl.payload.access_snapshot_token, /^[0-9a-f]{64}$/);
assert.match(partnerControl.payload.pricing_snapshot_token, /^[0-9a-f]{64}$/);
assert.match(partnerControl.payload.evolution_snapshot_token, /^[0-9a-f]{64}$/);
assert.equal(partnerControl.payload.commission_policy.amount, 10);
assert.equal(partnerControl.payload.commission_policy.currency, 'EUR');
assert.ok(Array.isArray(partnerControl.payload.proposals));
assert.equal(partnerControl.payload.current_items.length, 54);
requestCounts.partner_control += 1;

console.log(JSON.stringify({
  sentinel: 'HOTELS_V2_7A_PUBLIC_PRICING_BOOKING_POSTGREST_GATE_OK',
  request_count: requestCount,
  checks: requestCounts,
  booking_id: bookingResult.payload.booking_id,
  quote_fingerprint: upperQuote.quote_fingerprint,
}));
