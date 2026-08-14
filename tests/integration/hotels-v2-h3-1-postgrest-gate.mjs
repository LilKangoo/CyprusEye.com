import assert from 'node:assert/strict';
import { TOKENS } from './hotels-v2-h2a-rpc-hotfix-postgrest-auth.mjs';

const POSTGREST_URL = process.env.HOTELS_H3_1_POSTGREST_URL || 'http://127.0.0.1:53010';
const parsedUrl = new URL(POSTGREST_URL);
assert.ok(
  ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname),
  `Hotels H3.1 gate refuses non-loopback PostgREST URL: ${parsedUrl.hostname}`,
);
assert.equal(parsedUrl.protocol, 'http:', 'Hotels H3.1 gate accepts local HTTP only.');

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const RGB_HOTEL = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';
const UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const SCHEDULE = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const RATE_PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const PAYMENT = '41000000-0000-4000-8000-000000000001';
const COMMISSION = '41000000-0000-4000-8000-000000000002';
const MANUAL_SOURCE = '41000000-0000-4000-8000-000000000003';
const FIRST_CORRELATION = '41000000-0000-4000-8000-000000000004';
const STALE_CORRELATION = '41000000-0000-4000-8000-000000000005';
const OVERLAP_CORRELATION = '41000000-0000-4000-8000-000000000006';
const FUTURE_PAYMENT = '41000000-0000-4000-8000-000000000008';
const FUTURE_PAYMENT_CORRELATION = '41000000-0000-4000-8000-000000000009';
const INVALID_FULL_REMAINDER_PAYMENT = '41000000-0000-4000-8000-000000000010';
const INVALID_NONFINAL_REMAINDER_PAYMENT = '41000000-0000-4000-8000-000000000011';
const INVALID_FULL_REMAINDER_CORRELATION = '41000000-0000-4000-8000-000000000012';
const INVALID_NONFINAL_REMAINDER_CORRELATION = '41000000-0000-4000-8000-000000000013';
const ids = Array.from({ length: 20 }, (_, index) =>
  `42000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${POSTGREST_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
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

function assertSuccess(result, label) {
  assert.equal(result.status, 200, `${label}: HTTP ${result.status} ${JSON.stringify(result.payload)}`);
}

function assertRpcDenied(result, label) {
  assert.equal(result.ok, false, `${label} unexpectedly succeeded.`);
  assert.ok([401, 403, 404].includes(result.status), `${label}: unexpected ${result.status}.`);
}

function assertFlagsOff(configuration, label) {
  assert.deepEqual(configuration.feature_flags, {
    hotel_rooms_v2_enabled: false,
    hotel_external_sync_enabled: false,
    hotel_instant_booking_enabled: false,
    hotel_stripe_connect_enabled: false,
  }, `${label}: Hotels V2 capability flags changed.`);
  assert.equal(configuration.property.architecture_version, 'legacy', `${label}: architecture changed.`);
}

function allocationOperation(ruleIndex, guestMin, guestMax, mode, split = null) {
  const rooms = [UPPER, GROUND];
  return {
    entity: 'allocation_rule',
    type: 'create',
    id: ids[ruleIndex],
    expected_version: 0,
    payload: {
      code: mode === 'customer_choice' ? 'customer-choice-1-4' : `required-bundle-${guestMin}`,
      allocation_mode: mode,
      min_guest_count: guestMin,
      max_guest_count: guestMax,
      is_active: true,
      review_status: 'reviewed',
      sort_order: guestMin * 10,
      items: rooms.map((roomTypeId, itemIndex) => ({
        id: ids[6 + ruleIndex * 2 + itemIndex],
        room_type_id: roomTypeId,
        units_required: 1,
        allocated_guest_count: split?.[itemIndex] ?? null,
        sort_order: (itemIndex + 1) * 10,
      })),
    },
  };
}

function reviewedPlan(configuration) {
  const schedule = configuration.pricing_schedules.find((row) => row.id === SCHEDULE);
  const ratePlan = configuration.rate_plans.find((row) => row.id === RATE_PLAN);
  return {
    hotel_id: HOTEL,
    expected_property_updated_at: configuration.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operations: [{
      entity: 'property_configuration', type: 'update', id: HOTEL, expected_version: 0,
      payload: { minimum_stay_nights: 2 },
    }, {
      entity: 'pricing_schedule', type: 'update', id: SCHEDULE,
      expected_version: Number(schedule.version),
      payload: { minimum_billable_occupancy: 2 },
    }, {
      entity: 'rate_plan', type: 'update', id: RATE_PLAN,
      expected_version: Number(ratePlan.version),
      payload: {
        price_inclusions: Array.from(new Set([
          ...ratePlan.price_inclusions, 'private_transfer', 'taxes', 'cleaning',
        ])).sort(),
      },
    },
    allocationOperation(0, 1, 4, 'customer_choice'),
    allocationOperation(1, 5, 5, 'required_bundle', [3, 2]),
    allocationOperation(2, 6, 6, 'required_bundle', [3, 3]),
    allocationOperation(3, 7, 7, 'required_bundle', [4, 3]),
    allocationOperation(4, 8, 8, 'required_bundle', [4, 4]),
    {
      entity: 'payment_policy', type: 'create', id: PAYMENT, expected_version: 0,
      payload: {
        code: 'partner-50-after-acceptance',
        name_i18n: { en: '7 Kamares reviewed payment terms' },
        currency: 'EUR', is_active: true, review_status: 'reviewed',
        terms: [{
          id: ids[16], sequence: 1, due_event: 'after_partner_acceptance',
          amount_mode: 'percent_total', amount_value: 50, recipient: 'partner',
          payment_methods: ['bank_transfer'], instructions_i18n: {},
        }, {
          id: ids[17], sequence: 2, due_event: 'on_arrival',
          amount_mode: 'remaining_balance', amount_value: null, recipient: 'partner',
          payment_methods: ['cash', 'card'], instructions_i18n: {},
        }],
      },
    }, {
      entity: 'commission_policy', type: 'create', id: COMMISSION, expected_version: 0,
      payload: {
        code: 'cypruseye-7-kamares',
        commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
        is_active: true, review_status: 'reviewed',
      },
    }, {
      entity: 'calendar_source', type: 'create', id: MANUAL_SOURCE, expected_version: 0,
      payload: {
        code: 'manual', source_type: 'manual', room_type_id: null,
        external_reference: null, configuration: {}, is_enabled: true,
        review_status: 'reviewed', priority: 100,
      },
    }],
  };
}

const initial = await rpc(
  'hotel_v2_admin_get_h3_1_configuration',
  TOKENS.admin,
  { p_hotel_id: HOTEL },
);
assertSuccess(initial, 'initial Admin H3.1 configuration');
assertFlagsOff(initial.payload, 'initial H3.1 configuration');
assert.equal(initial.payload.property.minimum_stay_nights, null);
assert.equal(initial.payload.pricing_schedules[0].minimum_billable_occupancy, 1);
assert.deepEqual(initial.payload.rate_plans[0].price_inclusions, []);
assert.equal(initial.payload.allocation_rules.length, 0);

const denied = {};
for (const [role, token] of [
  ['anon', TOKENS.anon],
  ['non-admin', TOKENS.nonAdmin],
  ['partner', TOKENS.partner],
]) {
  const reads = await rpc('hotel_v2_admin_get_h3_1_configuration', token, { p_hotel_id: HOTEL });
  const writes = await rpc('hotel_v2_admin_apply_h3_1_configuration', token, {
    p_plan: reviewedPlan(initial.payload), p_correlation_id: FIRST_CORRELATION,
  });
  assertRpcDenied(reads, `${role} H3.1 read`);
  assertRpcDenied(writes, `${role} H3.1 write`);
  denied[role] = { read: reads.status, write: writes.status };
}

for (const table of [
  'hotel_room_allocation_rules',
  'hotel_room_allocation_rule_items',
  'hotel_payment_policies',
  'hotel_payment_policy_terms',
  'hotel_commission_policies',
  'hotel_calendar_source_configs',
]) {
  for (const [role, token] of [['anon', TOKENS.anon], ['non-admin', TOKENS.nonAdmin], ['partner', TOKENS.partner]]) {
    const raw = await request(`/${table}?select=*&limit=1`, { token });
    if (raw.status === 200) assert.deepEqual(raw.payload, [], `${role} raw ${table} leaked rows.`);
    else assert.ok([401, 403, 404].includes(raw.status), `${role} raw ${table}: unexpected ${raw.status}.`);
  }
}

// The additive contract can represent a future Hotel that collects 100% on
// the platform at booking. Keep this policy inactive and on the second legacy
// fixture property; 7 Kamares retains its reviewed after-acceptance terms.
const rgbInitial = await rpc(
  'hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: RGB_HOTEL },
);
assertSuccess(rgbInitial, 'future full-payment fixture read');

const invalidPaymentPlan = (id, code, terms) => ({
  hotel_id: RGB_HOTEL,
  expected_property_updated_at: rgbInitial.payload.property.updated_at,
  reviewed_at: new Date().toISOString(),
  operations: [{
    entity: 'payment_policy', type: 'create', id, expected_version: 0,
    payload: {
      code, name_i18n: { en: code }, currency: 'EUR', is_active: false,
      review_status: 'reviewed', terms,
    },
  }],
});
const invalidFullPlusRemainder = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: invalidPaymentPlan(INVALID_FULL_REMAINDER_PAYMENT, 'invalid-full-plus-remainder', [{
    id: '43000000-0000-4000-8000-000000000001', sequence: 1, due_event: 'at_booking',
    amount_mode: 'percent_total', amount_value: 100, recipient: 'platform',
    payment_methods: ['online'], instructions_i18n: {},
  }, {
    id: '43000000-0000-4000-8000-000000000002', sequence: 2, due_event: 'on_arrival',
    amount_mode: 'remaining_balance', amount_value: null, recipient: 'partner',
    payment_methods: ['cash'], instructions_i18n: {},
  }]),
  p_correlation_id: INVALID_FULL_REMAINDER_CORRELATION,
});
assert.equal(invalidFullPlusRemainder.status, 400, JSON.stringify(invalidFullPlusRemainder.payload));
assert.equal(invalidFullPlusRemainder.payload?.code, '23514');
assert.equal(invalidFullPlusRemainder.payload?.message, 'hotels_v2_h3_1_invalid_payment_schedule_total');

const invalidNonfinalRemainder = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: invalidPaymentPlan(INVALID_NONFINAL_REMAINDER_PAYMENT, 'invalid-nonfinal-remainder', [{
    id: '43000000-0000-4000-8000-000000000003', sequence: 1, due_event: 'on_arrival',
    amount_mode: 'remaining_balance', amount_value: null, recipient: 'partner',
    payment_methods: ['cash'], instructions_i18n: {},
  }, {
    id: '43000000-0000-4000-8000-000000000004', sequence: 2,
    due_event: 'after_partner_acceptance', amount_mode: 'percent_total', amount_value: 50,
    recipient: 'partner', payment_methods: ['bank_transfer'], instructions_i18n: {},
  }]),
  p_correlation_id: INVALID_NONFINAL_REMAINDER_CORRELATION,
});
assert.equal(invalidNonfinalRemainder.status, 400, JSON.stringify(invalidNonfinalRemainder.payload));
assert.equal(invalidNonfinalRemainder.payload?.code, '23514');
assert.equal(invalidNonfinalRemainder.payload?.message, 'hotels_v2_h3_1_invalid_payment_schedule_total');
const afterInvalidPayments = await rpc(
  'hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: RGB_HOTEL },
);
assertSuccess(afterInvalidPayments, 'future fixture after invalid payment rollbacks');
assert.equal(afterInvalidPayments.payload.payment_policies.length, 0, 'Invalid payment left a partial policy.');

const futurePayment = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: {
    hotel_id: RGB_HOTEL,
    expected_property_updated_at: rgbInitial.payload.property.updated_at,
    reviewed_at: new Date().toISOString(),
    operations: [{
      entity: 'payment_policy', type: 'create', id: FUTURE_PAYMENT, expected_version: 0,
      payload: {
        code: 'future-platform-full-at-booking', name_i18n: { en: 'Full platform payment at booking' },
        currency: 'EUR', is_active: false, review_status: 'reviewed',
        terms: [{
          id: ids[19], sequence: 1, due_event: 'at_booking', amount_mode: 'percent_total',
          amount_value: 100, recipient: 'platform', payment_methods: ['online'], instructions_i18n: {},
        }],
      },
    }],
  },
  p_correlation_id: FUTURE_PAYMENT_CORRELATION,
});
assertSuccess(futurePayment, 'future full platform payment contract');
const futurePaymentPolicy = futurePayment.payload.configuration.payment_policies[0];
assert.equal(futurePaymentPolicy.is_active, false);
assert.equal(futurePaymentPolicy.terms.length, 1);
assert.equal(futurePaymentPolicy.terms[0].due_event, 'at_booking');
assert.equal(futurePaymentPolicy.terms[0].amount_mode, 'percent_total');
assert.equal(Number(futurePaymentPolicy.terms[0].amount_value), 100);
assert.equal(futurePaymentPolicy.terms[0].recipient, 'platform');
assert.deepEqual(futurePaymentPolicy.terms[0].payment_methods, ['online']);
assertFlagsOff(futurePayment.payload.configuration, 'future full-payment fixture');

const apply = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: reviewedPlan(initial.payload), p_correlation_id: FIRST_CORRELATION,
});
assertSuccess(apply, 'reviewed Admin H3.1 apply');
const saved = apply.payload.configuration;
assertFlagsOff(saved, 'saved H3.1 configuration');
assert.equal(saved.property.minimum_stay_nights, 2);
assert.equal(saved.pricing_schedules[0].minimum_billable_occupancy, 2);
assert.deepEqual(saved.rate_plans[0].price_inclusions, ['cleaning', 'private_transfer', 'taxes']);
assert.equal(saved.allocation_rules.length, 5);
assert.deepEqual(
  saved.allocation_rules.map((rule) => [rule.min_guest_count, rule.max_guest_count, rule.allocation_mode]),
  [[1, 4, 'customer_choice'], [5, 5, 'required_bundle'], [6, 6, 'required_bundle'], [7, 7, 'required_bundle'], [8, 8, 'required_bundle']],
);
assert.deepEqual(
  saved.allocation_rules.filter((rule) => rule.allocation_mode === 'required_bundle')
    .map((rule) => rule.items.map((item) => item.allocated_guest_count)),
  [[3, 2], [3, 3], [4, 3], [4, 4]],
);
assert.equal(saved.payment_policies.length, 1);
assert.equal(Number(saved.payment_policies[0].terms[0].amount_value), 50);
assert.deepEqual(saved.payment_policies[0].terms[1].payment_methods, ['card', 'cash']);
assert.equal(saved.commission_policies.length, 1);
assert.equal(Number(saved.commission_policies[0].amount), 10);
assert.equal(saved.calendar_sources.length, 1);
assert.equal(saved.calendar_sources[0].source_type, 'manual');
assert.equal(saved.calendar_sources[0].is_enabled, true);

// A stale row token must abort before an earlier property operation mutates.
const stalePlan = {
  hotel_id: HOTEL,
  expected_property_updated_at: saved.property.updated_at,
  reviewed_at: new Date().toISOString(),
  operations: [{
    entity: 'property_configuration', type: 'update', id: HOTEL, expected_version: 0,
    payload: { minimum_stay_nights: 3 },
  }, {
    entity: 'pricing_schedule', type: 'update', id: SCHEDULE,
    expected_version: 1,
    payload: { minimum_billable_occupancy: 1 },
  }],
};
const stale = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: stalePlan, p_correlation_id: STALE_CORRELATION,
});
assert.equal(stale.status, 409, JSON.stringify(stale.payload));
assert.equal(stale.payload?.code, 'PT409');
assert.equal(stale.payload?.message, 'hotels_v2_h3_1_stale_pricing_schedule');
const afterStale = await rpc('hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL });
assertSuccess(afterStale, 'configuration after stale abort');
assert.equal(afterStale.payload.property.minimum_stay_nights, 2, 'Stale plan partially changed property.');
assert.equal(afterStale.payload.pricing_schedules[0].minimum_billable_occupancy, 2);

// A global range ambiguity must also abort the complete reviewed plan.
const overlap = allocationOperation(5, 4, 4, 'customer_choice');
overlap.id = ids[18];
overlap.payload.code = 'overlapping-choice-4';
overlap.payload.items = overlap.payload.items.map((item, index) => ({ ...item, id: ids[18 + index] }));
const overlapPlan = {
  hotel_id: HOTEL,
  expected_property_updated_at: afterStale.payload.property.updated_at,
  reviewed_at: new Date().toISOString(),
  operations: [overlap],
};
const overlapResult = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: overlapPlan, p_correlation_id: OVERLAP_CORRELATION,
});
assert.equal(overlapResult.ok, false, 'Overlapping active allocation unexpectedly succeeded.');
assert.ok([400, 409, 422].includes(overlapResult.status), JSON.stringify(overlapResult.payload));
const afterOverlap = await rpc('hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL });
assertSuccess(afterOverlap, 'configuration after overlap abort');
assert.equal(afterOverlap.payload.allocation_rules.length, 5, 'Overlap abort left a partial allocation row.');

// Reusing exact create IDs with a new correlation fails closed and creates no duplicates.
const duplicate = await rpc('hotel_v2_admin_apply_h3_1_configuration', TOKENS.admin, {
  p_plan: reviewedPlan(afterOverlap.payload),
  p_correlation_id: '41000000-0000-4000-8000-000000000007',
});
assert.equal(duplicate.ok, false, 'Repeated exact create plan unexpectedly duplicated H3.1 rows.');
const final = await rpc('hotel_v2_admin_get_h3_1_configuration', TOKENS.admin, { p_hotel_id: HOTEL });
assertSuccess(final, 'final H3.1 configuration');
assert.equal(final.payload.allocation_rules.length, 5);
assert.equal(final.payload.payment_policies.length, 1);
assert.equal(final.payload.commission_policies.length, 1);
assert.equal(final.payload.calendar_sources.length, 1);
assertFlagsOff(final.payload, 'final H3.1 configuration');

console.log(JSON.stringify({
  environment: { postgrestUrl: POSTGREST_URL, loopbackOnly: true },
  authorization: denied,
  approvedConfiguration: {
    minimumStayNights: final.payload.property.minimum_stay_nights,
    minimumBillableOccupancy: final.payload.pricing_schedules[0].minimum_billable_occupancy,
    allocationRuleCount: final.payload.allocation_rules.length,
    paymentPolicyCount: final.payload.payment_policies.length,
    commissionPolicyCount: final.payload.commission_policies.length,
    manualSourceCount: final.payload.calendar_sources.length,
  },
  atomicity: {
    staleStatus: stale.status,
    staleMessage: stale.payload?.message,
    overlapStatus: overlapResult.status,
    duplicateStatus: duplicate.status,
    invalidFullPlusRemainderStatus: invalidFullPlusRemainder.status,
    invalidNonfinalRemainderStatus: invalidNonfinalRemainder.status,
  },
  legacy: { architectureVersion: final.payload.property.architecture_version, flagsOff: true },
  hotels_v2_h3_1_postgrest_safe: true,
}, null, 2));
