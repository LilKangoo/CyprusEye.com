import { createSupabaseClients } from '../../_utils/supabaseAdmin.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const STATUS_VALUES = new Set(['pending', 'confirmed', 'awaiting_payment', 'completed', 'cancelled']);
const PAYMENT_STATUS_VALUES = new Set(['pending', 'paid', 'failed', 'refunded', 'not_required']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROUND_TRIP_CRITICAL_BOOKING_COLUMNS = new Set([
  'trip_type',
  'return_route_id',
  'return_origin_location_id',
  'return_destination_location_id',
  'return_travel_date',
  'return_travel_time',
  'return_pickup_address',
  'return_dropoff_address',
  'return_flight_number',
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function asTrimmedString(value, maxLength = 0) {
  const text = String(value ?? '').trim();
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

function nullableText(value, maxLength = 0) {
  const text = asTrimmedString(value, maxLength);
  return text || null;
}

function nullableUuid(value) {
  const text = asTrimmedString(value, 64);
  return text || null;
}

function normalizeEmail(value) {
  const text = nullableText(value, 160);
  return text ? text.toLowerCase() : null;
}

function normalizeReferralSource(value) {
  const normalized = asTrimmedString(value, 24).toLowerCase();
  return ['manual', 'url', 'stored'].includes(normalized) ? normalized : null;
}

function nonNegativeInt(value, fallback = 0, minValue = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Math.max(minValue, Math.trunc(fallback));
  return Math.max(minValue, Math.trunc(num));
}

function nonNegativeMoney(value, fallback = 0) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? Math.max(0, num) : Math.max(0, Number(fallback) || 0);
  return Math.round(safe * 100) / 100;
}

function normalizeStatus(value) {
  const normalized = asTrimmedString(value, 32).toLowerCase();
  return STATUS_VALUES.has(normalized) ? normalized : 'pending';
}

function normalizePaymentStatus(value, hasDeposit) {
  const normalized = asTrimmedString(value, 32).toLowerCase();
  if (PAYMENT_STATUS_VALUES.has(normalized)) return normalized;
  return hasDeposit ? 'pending' : 'not_required';
}

function normalizeTripType(value, hasReturnDetails) {
  const normalized = asTrimmedString(value, 32).toLowerCase();
  if (normalized === 'round_trip') return 'round_trip';
  return hasReturnDetails ? 'round_trip' : 'one_way';
}

function hasReturnDetails(body = {}) {
  return [
    body.return_route_id,
    body.return_origin_location_id,
    body.return_destination_location_id,
    body.return_travel_date,
    body.return_travel_time,
    body.return_pickup_address,
    body.return_dropoff_address,
    body.return_flight_number,
    body.return_base_price,
    body.return_extras_price,
    body.return_total_price,
  ].some((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function extractMissingColumnName(error) {
  const sources = [
    String(error?.message || ''),
    String(error?.details || ''),
    String(error?.hint || ''),
  ].filter(Boolean);

  const patterns = [
    /could not find the '([^']+)' column/i,
    /column ['"]([^'"]+)['"] does not exist/i,
    /column ([a-zA-Z0-9_]+) does not exist/i,
  ];

  for (const source of sources) {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) {
        return asTrimmedString(match[1], 128);
      }
    }
  }

  return '';
}

function buildInsertPayload(body = {}) {
  const returnPresent = hasReturnDetails(body);
  const tripType = normalizeTripType(body.trip_type, returnPresent);
  const depositAmount = body.deposit_amount == null ? null : nonNegativeMoney(body.deposit_amount, 0);
  const hasDeposit = depositAmount != null && depositAmount > 0;

  return {
    route_id: nullableUuid(body.route_id),
    origin_location_id: nullableUuid(body.origin_location_id),
    destination_location_id: nullableUuid(body.destination_location_id),
    travel_date: asTrimmedString(body.travel_date, 32),
    travel_time: asTrimmedString(body.travel_time, 16),
    num_passengers: nonNegativeInt(body.num_passengers, 1, 1),
    num_bags: nonNegativeInt(body.num_bags, 0, 0),
    num_oversize_bags: nonNegativeInt(body.num_oversize_bags, 0, 0),
    child_seats: nonNegativeInt(body.child_seats, 0, 0),
    booster_seats: nonNegativeInt(body.booster_seats, 0, 0),
    waiting_minutes: nonNegativeInt(body.waiting_minutes, 0, 0),
    pickup_address: nullableText(body.pickup_address, 500),
    dropoff_address: nullableText(body.dropoff_address, 500),
    flight_number: nullableText(body.flight_number, 120),
    notes: nullableText(body.notes, 4000),
    customer_name: asTrimmedString(body.customer_name, 160),
    customer_email: normalizeEmail(body.customer_email),
    customer_phone: asTrimmedString(body.customer_phone, 80),
    lang: nullableText(body.lang, 8),
    base_price: nonNegativeMoney(body.base_price, 0),
    extras_price: nonNegativeMoney(body.extras_price, 0),
    total_price: nonNegativeMoney(body.total_price, 0),
    currency: asTrimmedString(body.currency || 'EUR', 12).toUpperCase() || 'EUR',
    status: normalizeStatus(body.status),
    payment_status: normalizePaymentStatus(body.payment_status, hasDeposit),
    deposit_amount: hasDeposit ? depositAmount : null,
    deposit_currency: hasDeposit ? (asTrimmedString(body.deposit_currency || body.currency || 'EUR', 12).toUpperCase() || 'EUR') : null,
    trip_type: tripType,
    coupon_id: nullableUuid(body.coupon_id),
    coupon_code: nullableText(body.coupon_code, 64),
    coupon_discount_amount: nonNegativeMoney(body.coupon_discount_amount, 0),
    coupon_partner_id: nullableUuid(body.coupon_partner_id),
    coupon_partner_commission_bps: body.coupon_partner_commission_bps == null
      ? null
      : nonNegativeInt(body.coupon_partner_commission_bps, 0, 0),
    referral_code: nullableText(body.referral_code, 64),
    referral_source: normalizeReferralSource(body.referral_source),
    referral_captured_at: nullableText(body.referral_captured_at, 64),
    return_route_id: nullableUuid(body.return_route_id),
    return_origin_location_id: nullableUuid(body.return_origin_location_id),
    return_destination_location_id: nullableUuid(body.return_destination_location_id),
    return_travel_date: nullableText(body.return_travel_date, 32),
    return_travel_time: nullableText(body.return_travel_time, 16),
    return_pickup_address: nullableText(body.return_pickup_address, 500),
    return_dropoff_address: nullableText(body.return_dropoff_address, 500),
    return_flight_number: nullableText(body.return_flight_number, 120),
    return_base_price: body.return_base_price == null ? null : nonNegativeMoney(body.return_base_price, 0),
    return_extras_price: body.return_extras_price == null ? null : nonNegativeMoney(body.return_extras_price, 0),
    return_total_price: body.return_total_price == null ? null : nonNegativeMoney(body.return_total_price, 0),
  };
}

function validateInsertPayload(payload) {
  if (!payload.route_id) return 'Missing field: route_id';
  if (!payload.origin_location_id) return 'Missing field: origin_location_id';
  if (!payload.destination_location_id) return 'Missing field: destination_location_id';
  if (!payload.travel_date) return 'Missing field: travel_date';
  if (!payload.travel_time) return 'Missing field: travel_time';
  if (!payload.customer_name) return 'Missing field: customer_name';
  if (!payload.customer_email) return 'Missing field: customer_email';
  if (!EMAIL_PATTERN.test(payload.customer_email)) return 'Invalid field: customer_email';
  if (!payload.customer_phone) return 'Missing field: customer_phone';
  if (!(payload.total_price > 0)) return 'Missing or invalid field: total_price';

  if (payload.trip_type === 'round_trip') {
    if (!payload.return_route_id) return 'Missing field: return_route_id';
    if (!payload.return_origin_location_id) return 'Missing field: return_origin_location_id';
    if (!payload.return_destination_location_id) return 'Missing field: return_destination_location_id';
    if (!payload.return_travel_date) return 'Missing field: return_travel_date';
    if (!payload.return_travel_time) return 'Missing field: return_travel_time';
  }

  return '';
}

async function insertTransportBooking(adminClient, payload) {
  let data = null;
  let submitError = null;
  let insertPayload = { ...payload };
  const strippedColumns = [];
  const isRoundTrip = payload.trip_type === 'round_trip';
  let requiresLatestRoundTripSchema = false;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const insertResult = await adminClient
      .from('transport_bookings')
      .insert([insertPayload])
      .select('id, created_at');

    data = insertResult.data;
    submitError = insertResult.error;
    if (!submitError) break;

    const missingColumn = extractMissingColumnName(submitError);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(insertPayload, missingColumn)) {
      break;
    }

    if (isRoundTrip && ROUND_TRIP_CRITICAL_BOOKING_COLUMNS.has(missingColumn)) {
      requiresLatestRoundTripSchema = true;
      break;
    }

    delete insertPayload[missingColumn];
    strippedColumns.push(missingColumn);
  }

  if (requiresLatestRoundTripSchema) {
    return {
      ok: false,
      status: 409,
      error: 'Round-trip booking requires latest transport schema. Run migration "120_transport_round_trip_columns_schema_cache_fix.sql" and refresh this page.',
    };
  }

  if (submitError) {
    return {
      ok: false,
      status: 500,
      error: String(submitError?.message || 'Failed to insert transport booking'),
      details: submitError?.details || null,
      hint: submitError?.hint || null,
      code: submitError?.code || null,
    };
  }

  return {
    ok: true,
    status: 200,
    data: Array.isArray(data) ? data : [],
    strippedColumns,
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: 'Server configuration error. Missing environment variables.' }, 500);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Invalid JSON payload.' }, 400);
    }

    const payload = buildInsertPayload(body);
    const validationError = validateInsertPayload(payload);
    if (validationError) {
      return json({ ok: false, error: validationError }, 400);
    }

    const { adminClient } = createSupabaseClients(env);
    const result = await insertTransportBooking(adminClient, payload);
    if (!result.ok) {
      return json(
        {
          ok: false,
          error: result.error,
          details: result.details || null,
          hint: result.hint || null,
          code: result.code || null,
        },
        result.status || 500,
      );
    }

    return json({
      ok: true,
      data: result.data,
      stripped_columns: result.strippedColumns,
    });
  } catch (error) {
    console.error('Transport booking endpoint failed:', error);
    return json({ ok: false, error: String(error?.message || 'Unexpected server error') }, 500);
  }
}
