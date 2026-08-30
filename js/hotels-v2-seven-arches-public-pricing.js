(function attachSevenArchesPublicPricing(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2SevenArchesPublicPricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createSevenArchesPublicPricing() {
  'use strict';

  const HOTEL_ID = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  const ROOMS = Object.freeze({
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94': Object.freeze({
      key: 'upper',
      label: 'Upper Floor Apartment',
      roomRateId: '7e420964-9cbf-4f1b-abd3-09840af5240f',
      scheduleId: 'aec20731-7a56-35f0-334e-92b363351f02',
    }),
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3': Object.freeze({
      key: 'ground',
      label: 'Ground Floor Apartment',
      roomRateId: '3320590d-632d-423f-80d0-fd021cba7293',
      scheduleId: '9d109336-64f3-3c57-4684-968b59c94c3b',
    }),
  });
  const CONTRACTS = Object.freeze({
    quoteRequest: 'hotels_v2_seven_arches_public_quote_request_v1',
    quote: 'hotels_v2_seven_arches_public_quote_v1',
    bookingRequest: 'hotels_v2_seven_arches_public_booking_request_v1',
    booking: 'hotels_v2_seven_arches_public_booking_result_v1',
  });
  const RPC = Object.freeze({
    quote: 'hotel_v2_public_quote_seven_arches',
    booking: 'hotel_v2_public_create_seven_arches_booking',
  });
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const POSTGRES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const HASH = /^[0-9a-f]{64}$/;
  const EXTRA_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
  const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
  const MAX_GUESTS = 8;

  function fail(message) {
    throw new Error(message);
  }

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
    return value;
  }

  function exactKeys(value, keys, label) {
    const row = object(value, label);
    const actual = Object.keys(row).sort();
    const expected = keys.slice().sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
      fail(`${label} contains unsupported or missing fields.`);
    }
    return row;
  }

  function uuid(value, label, postgres = false) {
    const text = String(value || '');
    if (!(postgres ? POSTGRES_UUID : UUID).test(text)) fail(`${label} is invalid.`);
    return text;
  }

  function nullableUuid(value, label, postgres = false) {
    return value == null ? null : uuid(value, label, postgres);
  }

  function integer(value, label, minimum, maximum) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) fail(`${label} is invalid.`);
    return value;
  }

  function money(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
        || Number(value.toFixed(2)) !== value) {
      fail(`${label} is invalid.`);
    }
    return value;
  }

  function roundedMoney(value) {
    return Number(Number(value).toFixed(2));
  }

  function sameMoney(left, right) {
    return roundedMoney(left) === roundedMoney(right);
  }

  function date(value, label) {
    if (typeof value !== 'string' || !ISO_DATE.test(value)) fail(`${label} is invalid.`);
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${label} is invalid.`);
    return value;
  }

  function stayNights(arrival, departure) {
    return Math.round((Date.parse(`${departure}T00:00:00.000Z`) - Date.parse(`${arrival}T00:00:00.000Z`)) / 86_400_000);
  }

  function timestamp(value, label) {
    if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label} is invalid.`);
    return value;
  }

  function isSevenArches(hotel) {
    return String(hotel?.id || '') === HOTEL_ID;
  }

  function roomFor(roomTypeId) {
    return ROOMS[String(roomTypeId || '')] || null;
  }

  function getGuestCapacity(hotel) {
    return isSevenArches(hotel) ? MAX_GUESTS : null;
  }

  function syncRoomSelectionUi(hotel, form, guestCount) {
    if (!isSevenArches(hotel) || !form) return false;
    const guests = Number.isInteger(guestCount) ? guestCount : Number(new FormData(form).get('adults') || 0)
      + Number(new FormData(form).get('children') || 0);
    const room = form.querySelector('[name="hotel_room_type_id"]');
    const rate = form.querySelector('[name="hotel_rate_plan_id"]');
    if (room) {
      if (!room.querySelector('option[value=""]')) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Choose an exact apartment';
        room.prepend(option);
        if (!roomFor(room.value)) room.value = '';
      }
      room.disabled = guests >= 5;
      room.required = guests <= 4;
      if (guests >= 5) room.value = '';
      if (room.dataset.sevenArchesBound !== 'true') {
        room.dataset.sevenArchesBound = 'true';
        room.addEventListener('change', () => { room.dataset.sevenArchesChosen = 'true'; });
      }
      const label = room.closest('label');
      if (label) label.hidden = guests >= 5;
    }
    if (rate) {
      rate.disabled = true;
      const label = rate.closest('label');
      if (label) label.hidden = true;
    }
    const adults = form.querySelector('[name="adults"]');
    const children = form.querySelector('[name="children"]');
    if (adults && children) {
      const adultCount = Math.max(0, Number(adults.value || 0));
      const childCount = Math.max(0, Number(children.value || 0));
      adults.max = String(Math.max(1, MAX_GUESTS - childCount));
      children.max = String(Math.max(0, MAX_GUESTS - adultCount));
    }
    const host = room?.closest('[style*="display:grid"]') || room?.parentElement?.parentElement;
    if (host) {
      let note = host.querySelector('[data-seven-arches-room-mode]');
      if (!note) {
        note = document.createElement('p');
        note.dataset.sevenArchesRoomMode = '';
        note.style.cssText = 'grid-column:1/-1;margin:0;color:#475569;font-size:13px;';
        host.append(note);
      }
      note.textContent = guests >= 5
        ? 'Your quote uses the exact Upper + Ground apartment allocation.'
        : 'Select Upper Floor Apartment or Ground Floor Apartment for an authoritative quote.';
    }
    return true;
  }

  function validateExtraIds(value) {
    if (!Array.isArray(value) || value.length > 100) fail('selected_extra_ids is invalid.');
    const result = value.map((entry) => {
      const text = String(entry || '').trim();
      if (!EXTRA_ID.test(text)) fail('selected_extra_ids is invalid.');
      return text;
    });
    if (new Set(result).size !== result.length) fail('selected_extra_ids contains duplicates.');
    return result;
  }

  function validateQuoteRequest(value) {
    const row = exactKeys(value, [
      'contract_version', 'hotel_id', 'room_type_id', 'room_rate_id',
      'arrival_date', 'departure_date', 'guest_count', 'selected_extra_ids',
    ], 'Public quote request');
    if (row.contract_version !== CONTRACTS.quoteRequest || uuid(row.hotel_id, 'hotel_id') !== HOTEL_ID) {
      fail('Public quote request is invalid.');
    }
    const arrival = date(row.arrival_date, 'arrival_date');
    const departure = date(row.departure_date, 'departure_date');
    const nights = stayNights(arrival, departure);
    if (nights < 2 || nights > 365) fail('Public quote request stay is invalid.');
    const guests = integer(row.guest_count, 'guest_count', 1, MAX_GUESTS);
    const requiresRoom = guests <= 4;
    const roomTypeId = nullableUuid(row.room_type_id, 'room_type_id');
    const roomRateId = nullableUuid(row.room_rate_id, 'room_rate_id');
    if (requiresRoom) {
      const room = roomFor(roomTypeId);
      if (!room || room.roomRateId !== roomRateId) fail('Exact Room selection is required.');
    } else if (roomTypeId !== null || roomRateId !== null) {
      fail('Bundle quotes must not contain a single-Room selection.');
    }
    return Object.freeze({ ...row, selected_extra_ids: Object.freeze(validateExtraIds(row.selected_extra_ids)) });
  }

  function buildQuoteRequest(hotel, form) {
    const isElement = typeof Element !== 'undefined' && form instanceof Element;
    if (!isSevenArches(hotel) || !(isElement || (form && typeof form === 'object'))) {
      fail('The Room-aware quote is restricted to the exact Hotel booking form.');
    }
    const data = new FormData(form);
    const guests = Number(data.get('adults') || 0) + Number(data.get('children') || 0);
    const roomTypeId = String(data.get('hotel_room_type_id') || '').trim() || null;
    const room = roomFor(roomTypeId);
    const selectedExtraIds = Array.from(form.querySelectorAll('input[name="hotel_extra_ids"]:checked'))
      .map((input) => String(input.value || '').trim()).filter(Boolean);
    return validateQuoteRequest({
      contract_version: CONTRACTS.quoteRequest,
      hotel_id: HOTEL_ID,
      room_type_id: guests <= 4 ? roomTypeId : null,
      room_rate_id: guests <= 4 ? room?.roomRateId || null : null,
      arrival_date: String(data.get('arrival_date') || ''),
      departure_date: String(data.get('departure_date') || ''),
      guest_count: guests,
      selected_extra_ids: selectedExtraIds,
    });
  }

  function validateAllocation(value, index) {
    const row = exactKeys(value, [
      'room_key', 'room_type_id', 'room_rate_id', 'pricing_schedule_id',
      'schedule_tier_id', 'pricing_guest_count', 'minimum_nights', 'tier_version',
      'nightly_price', 'nights', 'stay_total', 'currency',
    ], `Quote allocation ${index + 1}`);
    const roomTypeId = uuid(row.room_type_id, 'allocation.room_type_id');
    const room = roomFor(roomTypeId);
    if (!room || row.room_key !== room.key
        || uuid(row.room_rate_id, 'allocation.room_rate_id') !== room.roomRateId
        || uuid(row.pricing_schedule_id, 'allocation.pricing_schedule_id', true) !== room.scheduleId) {
      fail('Quote allocation identity is invalid.');
    }
    uuid(row.schedule_tier_id, 'allocation.schedule_tier_id', true);
    integer(row.pricing_guest_count, 'allocation.pricing_guest_count', 2, 4);
    integer(row.minimum_nights, 'allocation.minimum_nights', 2, 10);
    integer(row.tier_version, 'allocation.tier_version', 1, Number.MAX_SAFE_INTEGER);
    const nightlyPrice = money(row.nightly_price, 'allocation.nightly_price');
    const nights = integer(row.nights, 'allocation.nights', 1, 3650);
    const stayTotal = money(row.stay_total, 'allocation.stay_total');
    if (!sameMoney(stayTotal, nightlyPrice * nights)) fail('Quote allocation total is inconsistent.');
    if (row.currency !== 'EUR') fail('Quote allocation currency is invalid.');
    return row;
  }

  function validateSelectedExtra(value, index) {
    const row = exactKeys(value, ['id', 'label', 'amount', 'charge_type', 'is_mandatory', 'total'], `Selected extra ${index + 1}`);
    if (typeof row.id !== 'string' || !EXTRA_ID.test(row.id)
        || typeof row.label !== 'object' || row.label === null || Array.isArray(row.label)
        || !['per_stay', 'per_night', 'per_person_per_stay', 'per_person_per_night'].includes(row.charge_type)
        || typeof row.is_mandatory !== 'boolean') fail('Selected extra is invalid.');
    money(row.amount, 'selected_extra.amount');
    money(row.total, 'selected_extra.total');
    return row;
  }

  function validateQuote(value, request, options = {}) {
    const expected = validateQuoteRequest(request);
    const row = exactKeys(value, [
      'contract_version', 'hotel_id', 'room_required', 'room_type_id', 'room_rate_id',
      'arrival_date', 'departure_date', 'nights', 'guest_count', 'currency',
      'allocation', 'selected_extras', 'extras_total', 'room_total', 'customer_total',
      'authority_token', 'quote_fingerprint',
      'quoted_at', 'expires_at',
    ], 'Public quote');
    if (row.contract_version !== CONTRACTS.quote || row.hotel_id !== HOTEL_ID
        || row.arrival_date !== expected.arrival_date || row.departure_date !== expected.departure_date
        || row.guest_count !== expected.guest_count || row.room_type_id !== expected.room_type_id
        || row.room_rate_id !== expected.room_rate_id || row.room_required !== (expected.guest_count <= 4)
        || row.currency !== 'EUR' || !HASH.test(String(row.authority_token || ''))
        || !HASH.test(String(row.quote_fingerprint || ''))) fail('Public quote binding is invalid.');
    const nights = integer(row.nights, 'nights', 2, 365);
    if (nights !== stayNights(expected.arrival_date, expected.departure_date)) fail('Quote nights are inconsistent.');
    const expectedAllocationCount = expected.guest_count <= 4 ? 1 : 2;
    const expectedPricingGuests = expected.guest_count === 1 ? 2
      : expected.guest_count <= 4 ? expected.guest_count
        : expected.guest_count === 5 ? 2 : expected.guest_count === 6 ? 3 : 4;
    if (!Array.isArray(row.allocation) || row.allocation.length !== expectedAllocationCount) fail('Quote allocation is invalid.');
    const allocation = row.allocation.map(validateAllocation);
    if (new Set(allocation.map((entry) => entry.room_key)).size !== allocation.length
        || new Set(allocation.map((entry) => entry.room_type_id)).size !== allocation.length
        || new Set(allocation.map((entry) => entry.schedule_tier_id)).size !== allocation.length) {
      fail('Quote allocation contains duplicate identities.');
    }
    allocation.forEach((entry) => {
      if (entry.pricing_guest_count !== expectedPricingGuests || entry.nights !== nights
          || entry.minimum_nights !== Math.min(nights, 10)) {
        fail('Quote allocation resolution is inconsistent.');
      }
    });
    if (expectedAllocationCount === 1) {
      if (allocation[0].room_type_id !== expected.room_type_id
          || allocation[0].room_rate_id !== expected.room_rate_id) {
        fail('Quote allocation does not match the selected Room.');
      }
    } else if (allocation[0].room_key !== 'upper' || allocation[1].room_key !== 'ground') {
      fail('Quote bundle allocation is invalid.');
    }
    if (!Array.isArray(row.selected_extras) || row.selected_extras.length > 100) fail('Selected extras are invalid.');
    const selectedExtras = row.selected_extras.map(validateSelectedExtra);
    if (new Set(selectedExtras.map((entry) => entry.id)).size !== selectedExtras.length) fail('Selected extras contain duplicates.');
    const requestedExtraIds = new Set(expected.selected_extra_ids);
    if (expected.selected_extra_ids.some((id) => !selectedExtras.some((entry) => entry.id === id))
        || selectedExtras.some((entry) => !entry.is_mandatory && !requestedExtraIds.has(entry.id))) {
      fail('Selected extras do not match the request.');
    }
    selectedExtras.forEach((entry) => {
      const multiplier = entry.charge_type === 'per_night' ? nights
        : entry.charge_type === 'per_person_per_stay' ? expected.guest_count
          : entry.charge_type === 'per_person_per_night' ? expected.guest_count * nights : 1;
      if (!sameMoney(entry.total, entry.amount * multiplier)) fail('Selected extra total is inconsistent.');
    });
    ['extras_total', 'room_total', 'customer_total'].forEach((field) => money(row[field], field));
    if (!sameMoney(row.room_total, allocation.reduce((sum, entry) => sum + entry.stay_total, 0))
        || !sameMoney(row.extras_total, selectedExtras.reduce((sum, entry) => sum + entry.total, 0))
        || !sameMoney(row.customer_total, row.room_total + row.extras_total)) fail('Quote total is inconsistent.');
    timestamp(row.quoted_at, 'quoted_at');
    timestamp(row.expires_at, 'expires_at');
    if (Date.parse(row.expires_at) - Date.parse(row.quoted_at) !== 15 * 60 * 1000
        || (options.requireFresh !== false && Date.parse(row.expires_at) <= Date.now())) {
      fail('Quote expiry is invalid.');
    }
    return Object.freeze(row);
  }

  function quoteRequestFromQuote(value) {
    const row = object(value, 'Booking quote');
    const selectedExtras = Array.isArray(row.selected_extras) ? row.selected_extras : [];
    return {
      contract_version: CONTRACTS.quoteRequest,
      hotel_id: row.hotel_id,
      room_type_id: row.room_type_id,
      room_rate_id: row.room_rate_id,
      arrival_date: row.arrival_date,
      departure_date: row.departure_date,
      guest_count: row.guest_count,
      selected_extra_ids: selectedExtras
        .filter((entry) => entry && entry.is_mandatory === false)
        .map((entry) => entry.id),
    };
  }

  function validateBookingRequest(value, options = {}) {
    const row = exactKeys(value, ['contract_version', 'quote', 'customer', 'coupon_code', 'referral'], 'Booking request');
    if (row.contract_version !== CONTRACTS.bookingRequest) fail('Booking request contract is invalid.');
    const quoteValue = validateQuote(
      row.quote,
      quoteRequestFromQuote(row.quote),
      { requireFresh: options.requireFresh !== false },
    );
    exactKeys(row.customer, ['name', 'email', 'phone', 'notes', 'language'], 'Booking customer');
    if (row.referral !== null) exactKeys(row.referral, ['code', 'source', 'captured_at'], 'Booking referral');
    if (typeof row.customer.name !== 'string' || row.customer.name.trim() !== row.customer.name || row.customer.name.length < 2 || row.customer.name.length > 200
        || /[\u0000-\u001f\u007f]/.test(row.customer.name)
        || typeof row.customer.email !== 'string' || row.customer.email !== row.customer.email.trim().toLowerCase()
        || row.customer.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.customer.email)
        || !['pl', 'en', 'he'].includes(row.customer.language)
        || (row.customer.phone !== null && (typeof row.customer.phone !== 'string' || row.customer.phone.length > 80 || /[\u0000-\u001f\u007f]/.test(row.customer.phone)))
        || (row.customer.notes !== null && (typeof row.customer.notes !== 'string' || row.customer.notes.length > 2000 || /[\u0000-\u001f\u007f]/.test(row.customer.notes)))
        || (row.coupon_code !== null && (typeof row.coupon_code !== 'string' || row.coupon_code !== row.coupon_code.trim().toUpperCase()
          || row.coupon_code.length < 1 || row.coupon_code.length > 80 || /[\u0000-\u001f\u007f]/.test(row.coupon_code)))) {
      fail('Booking customer or coupon data is invalid.');
    }
    if (row.referral !== null) {
      for (const key of ['code', 'source']) {
        const entry = row.referral[key];
        if (entry !== null && (typeof entry !== 'string' || entry !== entry.trim()
            || !entry || entry.length > 160 || /[\u0000-\u001f\u007f]/.test(entry))) fail('Booking referral data is invalid.');
      }
      if (row.referral.captured_at !== null) timestamp(row.referral.captured_at, 'referral.captured_at');
    }
    return Object.freeze({ ...row, quote: quoteValue });
  }

  function buildBookingRequest(form, quote, options = {}) {
    const data = new FormData(form);
    return validateBookingRequest({
      contract_version: CONTRACTS.bookingRequest,
      quote,
      customer: {
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim().toLowerCase(),
        phone: String(data.get('phone') || '').trim() || null,
        notes: String(data.get('notes') || data.get('note') || '').trim() || null,
        language: ['pl', 'en', 'he'].includes(options.language) ? options.language : 'en',
      },
      coupon_code: String(data.get('coupon_code') || '').trim().toUpperCase() || null,
      referral: options.referral ? {
        code: options.referral?.referral_code || null,
        source: options.referral?.referral_source || null,
        captured_at: options.referral?.referral_captured_at || null,
      } : null,
    });
  }

  function validateBookingResult(value, request) {
    // The request was checked for freshness before the RPC.  A successful
    // server commit remains valid if the quote expires during network transit.
    const expected = validateBookingRequest(request, { requireFresh: false });
    const row = exactKeys(value, [
      'contract_version', 'booking_id', 'status', 'currency', 'room_total',
      'extras_total', 'coupon_discount', 'customer_total', 'quote_fingerprint', 'created_at', 'replayed',
    ], 'Booking result');
    if (row.contract_version !== CONTRACTS.booking || row.status !== 'pending' || row.currency !== 'EUR'
        || row.quote_fingerprint !== expected.quote.quote_fingerprint || typeof row.replayed !== 'boolean') fail('Booking result binding is invalid.');
    uuid(row.booking_id, 'booking_id');
    ['room_total', 'extras_total', 'coupon_discount', 'customer_total'].forEach((field) => money(row[field], field));
    if (!sameMoney(row.room_total, expected.quote.room_total)
        || !sameMoney(row.extras_total, expected.quote.extras_total)
        || row.coupon_discount > expected.quote.customer_total
        || !sameMoney(row.customer_total, row.room_total + row.extras_total - row.coupon_discount)) {
      fail('Booking result total is inconsistent.');
    }
    timestamp(row.created_at, 'created_at');
    return Object.freeze(row);
  }

  function client(value) {
    const candidate = value || (typeof window !== 'undefined' && typeof window.getSupabase === 'function' ? window.getSupabase() : null)
      || (typeof window !== 'undefined' ? window.sb || window.__SB__ : null);
    if (!candidate || typeof candidate.rpc !== 'function') fail('Public Hotel pricing connection is unavailable.');
    return candidate;
  }

  async function quote(request, suppliedClient) {
    const clean = validateQuoteRequest(request);
    const { data, error } = await client(suppliedClient).rpc(RPC.quote, { p_request: clean });
    if (error) throw Object.assign(new Error(error.message || 'Authoritative quote failed.'), { code: error.code || null });
    return validateQuote(Array.isArray(data) && data.length === 1 ? data[0] : data, clean);
  }

  async function createBooking(request, suppliedClient) {
    const clean = validateBookingRequest(request);
    const { data, error } = await client(suppliedClient).rpc(RPC.booking, { p_request: clean });
    if (error) throw Object.assign(new Error(error.message || 'Authoritative booking failed.'), { code: error.code || null });
    return validateBookingResult(Array.isArray(data) && data.length === 1 ? data[0] : data, clean);
  }

  function createQuoteSession(suppliedClient) {
    let key = '';
    let pending = null;
    let current = null;
    let bookingKey = '';
    let bookingPending = null;
    return Object.freeze({
      get current() { return current; },
      clear() { key = ''; pending = null; current = null; bookingKey = ''; bookingPending = null; },
      async refresh(hotel, form) {
        const request = buildQuoteRequest(hotel, form);
        const nextKey = JSON.stringify(request);
        if (nextKey === key && current && Date.parse(current.expires_at) > Date.now()) return current;
        if (nextKey === key && pending) return pending;
        key = nextKey;
        current = null;
        pending = quote(request, suppliedClient).then((value) => {
          if (key === nextKey) current = value;
          return value;
        }).finally(() => { if (key === nextKey) pending = null; });
        return pending;
      },
      async submit(hotel, form, options) {
        const fresh = await this.refresh(hotel, form);
        const request = buildBookingRequest(form, fresh, options);
        const nextBookingKey = JSON.stringify(request);
        if (bookingPending && bookingKey === nextBookingKey) return bookingPending;
        bookingKey = nextBookingKey;
        bookingPending = createBooking(request, suppliedClient)
          .finally(() => { if (bookingKey === nextBookingKey) bookingPending = null; });
        return bookingPending;
      },
    });
  }

  function quoteSummary(value, language = 'en') {
    const quoteValue = object(value, 'Public quote');
    const roomNames = quoteValue.allocation.map((row) => ROOMS[row.room_type_id]?.label || row.room_key).join(' + ');
    const messages = {
      pl: `${roomNames} · ${quoteValue.guest_count} gości · ${quoteValue.nights} nocy`,
      en: `${roomNames} · ${quoteValue.guest_count} guests · ${quoteValue.nights} nights`,
      he: `${roomNames} · ${quoteValue.guest_count} אורחים · ${quoteValue.nights} לילות`,
    };
    return messages[language] || messages.en;
  }

  return Object.freeze({
    HOTEL_ID, ROOMS, CONTRACTS, RPC, MAX_GUESTS, isSevenArches, roomFor, getGuestCapacity, syncRoomSelectionUi,
    validateQuoteRequest, buildQuoteRequest, validateQuote,
    validateBookingRequest, buildBookingRequest, validateBookingResult,
    quote, createBooking, createQuoteSession, quoteSummary,
  });
});
