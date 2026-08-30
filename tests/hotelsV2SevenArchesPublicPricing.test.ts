/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('node:fs');
const path = require('node:path');

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const UPPER_SCHEDULE = 'aec20731-7a56-35f0-334e-92b363351f02';
const GROUND_ROOM = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const GROUND_SCHEDULE = '9d109336-64f3-3c57-4684-968b59c94c3b';
const TIER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const GROUND_TIER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BOOKING = '11111111-1111-4111-8111-111111111111';
const HASH = 'a'.repeat(64);

function api(): any {
  jest.resetModules();
  return require(path.join(process.cwd(), 'js/hotels-v2-seven-arches-public-pricing.js'));
}

function request(overrides: Record<string, unknown> = {}): any {
  return {
    contract_version: 'hotels_v2_seven_arches_public_quote_request_v1',
    hotel_id: HOTEL,
    room_type_id: UPPER_ROOM,
    room_rate_id: UPPER_RATE,
    arrival_date: '2099-09-10',
    departure_date: '2099-09-13',
    guest_count: 2,
    selected_extra_ids: [],
    ...overrides,
  };
}

function quote(overrides: Record<string, unknown> = {}): any {
  return {
    contract_version: 'hotels_v2_seven_arches_public_quote_v1',
    hotel_id: HOTEL,
    room_required: true,
    room_type_id: UPPER_ROOM,
    room_rate_id: UPPER_RATE,
    arrival_date: '2099-09-10',
    departure_date: '2099-09-13',
    nights: 3,
    guest_count: 2,
    currency: 'EUR',
    allocation: [{
      room_key: 'upper', room_type_id: UPPER_ROOM, room_rate_id: UPPER_RATE,
      pricing_schedule_id: UPPER_SCHEDULE, schedule_tier_id: TIER,
      pricing_guest_count: 2, minimum_nights: 3, tier_version: 1,
      nightly_price: 100, nights: 3, stay_total: 300, currency: 'EUR',
    }],
    selected_extras: [], extras_total: 0, room_total: 300, customer_total: 300,
    authority_token: HASH,
    quote_fingerprint: HASH, quoted_at: '2099-09-01T10:00:00.000000Z',
    expires_at: '2099-09-01T10:15:00.000000Z',
    ...overrides,
  };
}

describe('7 Arches public Room-aware pricing bridge', () => {
  test('requires exact Room identity for one-to-four guests and exposes total capacity eight for bundles', () => {
    const bridge = api();
    expect(bridge.getGuestCapacity({ id: HOTEL })).toBe(8);
    expect(bridge.getGuestCapacity({ id: '11111111-1111-4111-8111-111111111111' })).toBeNull();
    expect(bridge.validateQuoteRequest(request()).room_rate_id).toBe(UPPER_RATE);
    expect(() => bridge.validateQuoteRequest(request({ room_type_id: null, room_rate_id: null }))).toThrow('Room selection');
    expect(bridge.validateQuoteRequest(request({ guest_count: 5, room_type_id: null, room_rate_id: null })).guest_count).toBe(5);
    expect(() => bridge.validateQuoteRequest(request({ guest_count: 5 }))).toThrow('Bundle quotes');
    expect(() => bridge.validateQuoteRequest(request({ guest_count: 9 }))).toThrow('guest_count');

    const room = {
      value: UPPER_ROOM, disabled: false, required: false, dataset: {},
      querySelector: () => ({}), addEventListener: jest.fn(), closest: () => null,
    };
    const adults: any = { value: '5', max: '' };
    const children: any = { value: '3', max: '' };
    const form = {
      querySelector: (selector: string) => ({
        '[name="hotel_room_type_id"]': room,
        '[name="hotel_rate_plan_id"]': null,
        '[name="adults"]': adults,
        '[name="children"]': children,
      } as Record<string, any>)[selector],
    };
    expect(bridge.syncRoomSelectionUi({ id: HOTEL }, form, 8)).toBe(true);
    expect(room.disabled).toBe(true);
    expect(room.value).toBe('');
    expect(adults.max).toBe('5');
    expect(children.max).toBe('3');
  });

  test('validates exact Room/bundle allocation, arithmetic, extras and expiry', () => {
    const bridge = api();
    expect(bridge.validateQuote(quote(), request()).customer_total).toBe(300);
    expect(() => bridge.validateQuote({ ...quote(), browser_price: 1 }, request())).toThrow('unsupported');
    expect(() => bridge.validateQuote(quote({ allocation: [{ ...quote().allocation[0], room_rate_id: '22222222-2222-4222-8222-222222222222' }] }), request())).toThrow('identity');
    expect(() => bridge.validateQuote(quote({
      allocation: [{ ...quote().allocation[0], room_type_id: GROUND_ROOM, room_rate_id: GROUND_RATE,
        pricing_schedule_id: GROUND_SCHEDULE, room_key: 'ground' }],
    }), request())).toThrow('selected Room');
    expect(() => bridge.validateQuote(quote({ allocation: [{ ...quote().allocation[0], stay_total: 299 }] }), request())).toThrow('allocation total');
    expect(() => bridge.validateQuote({ ...quote(), partner_net: 280 }, request())).toThrow('unsupported');
    expect(() => bridge.validateQuote(quote({ expires_at: '2099-09-01T10:14:59.000000Z' }), request())).toThrow('expiry');

    const fractionalRequest = request({ selected_extra_ids: ['welcome'] });
    const fractionalQuote = quote({
      selected_extras: [{
        id: 'welcome', label: { en: 'Welcome' }, amount: 0.29,
        charge_type: 'per_stay', is_mandatory: false, total: 0.29,
      }],
      extras_total: 0.29, customer_total: 300.29,
    });
    expect(bridge.validateQuote(fractionalQuote, fractionalRequest).extras_total).toBe(0.29);

    const bundleRequest = request({ guest_count: 5, room_type_id: null, room_rate_id: null });
    const bundleQuote = quote({
      room_required: false, room_type_id: null, room_rate_id: null, guest_count: 5,
      allocation: [
        { ...quote().allocation[0], pricing_guest_count: 2 },
        { ...quote().allocation[0], room_key: 'ground', room_type_id: GROUND_ROOM,
          room_rate_id: GROUND_RATE, pricing_schedule_id: GROUND_SCHEDULE,
          schedule_tier_id: GROUND_TIER, pricing_guest_count: 2 },
      ],
      room_total: 600, customer_total: 600,
    });
    expect(bridge.validateQuote(bundleQuote, bundleRequest).allocation).toHaveLength(2);
    expect(() => bridge.validateQuote({ ...bundleQuote, allocation: bundleQuote.allocation.slice(0, 1) }, bundleRequest)).toThrow('allocation');
  });

  test('validates every guest count, the one-person floor, both exact Rooms and every bundle allocation band', () => {
    const bridge = api();
    const allocationFor = (roomKey: 'upper' | 'ground', pricingGuestCount: number) => {
      const ground = roomKey === 'ground';
      return {
        ...quote().allocation[0],
        room_key: roomKey,
        room_type_id: ground ? GROUND_ROOM : UPPER_ROOM,
        room_rate_id: ground ? GROUND_RATE : UPPER_RATE,
        pricing_schedule_id: ground ? GROUND_SCHEDULE : UPPER_SCHEDULE,
        schedule_tier_id: ground ? GROUND_TIER : TIER,
        pricing_guest_count: pricingGuestCount,
      };
    };

    for (let guestCount = 1; guestCount <= 8; guestCount += 1) {
      const pricingGuestCount = guestCount === 1 ? 2
        : guestCount <= 4 ? guestCount : guestCount === 5 ? 2 : guestCount === 6 ? 3 : 4;
      const bundle = guestCount >= 5;
      const roomKey = guestCount === 3 ? 'ground' : 'upper';
      const roomTypeId = bundle ? null : roomKey === 'ground' ? GROUND_ROOM : UPPER_ROOM;
      const roomRateId = bundle ? null : roomKey === 'ground' ? GROUND_RATE : UPPER_RATE;
      const quoteRequest = request({
        guest_count: guestCount,
        room_type_id: roomTypeId,
        room_rate_id: roomRateId,
      });
      const allocation = bundle
        ? [allocationFor('upper', pricingGuestCount), allocationFor('ground', pricingGuestCount)]
        : [allocationFor(roomKey, pricingGuestCount)];
      const roomTotal = allocation.length * 300;
      const result = bridge.validateQuote(quote({
        room_required: !bundle,
        room_type_id: roomTypeId,
        room_rate_id: roomRateId,
        guest_count: guestCount,
        allocation,
        room_total: roomTotal,
        customer_total: roomTotal,
      }), quoteRequest);
      expect(result.allocation.map((entry: any) => entry.pricing_guest_count))
        .toEqual(Array(allocation.length).fill(pricingGuestCount));
      expect(result.allocation.map((entry: any) => entry.room_key))
        .toEqual(bundle ? ['upper', 'ground'] : [roomKey]);
    }
  });

  test('pins the Room-aware bridge and authoritative quote/booking wiring on all three public entry surfaces', () => {
    const detail = fs.readFileSync('hotel.html', 'utf8');
    const listing = fs.readFileSync('hotels.html', 'utf8');
    const home = fs.readFileSync('index.html', 'utf8');
    const homeController = fs.readFileSync('js/home-hotels.js', 'utf8');
    const bookingUi = fs.readFileSync('js/hotel-booking-ui.js', 'utf8');
    const bridgeScript = 'hotels-v2-seven-arches-public-pricing.js?v=20260830_1';

    for (const markup of [detail, listing, home]) expect(markup).toContain(bridgeScript);
    expect(detail).toContain('updateSevenArchesAuthoritativeQuote');
    expect(detail).toContain('sevenArchesQuoteSession.submit(hotel, f');
    expect(listing).toContain('updateSevenArchesAuthoritativeQuote');
    expect(listing).toContain('sevenArchesQuoteSession.submit(currentHotel, e.target');
    expect(homeController).toContain('updateHomeSevenArchesAuthoritativeQuote');
    expect(homeController).toContain('homeSevenArchesQuoteSession.submit(homeCurrentHotel, form');
    expect(bookingUi).toContain('HotelsV2SevenArchesPublicPricing?.getGuestCapacity?.(hotel)');
    expect(bookingUi).toContain('exactRoomRequired');
  });

  test('validates the nested booking quote and binds first/replayed results to exact totals', async () => {
    const bridge = api();
    const calls: Array<{ name: string; payload: any }> = [];
    const bookingRequest = {
      contract_version: bridge.CONTRACTS.bookingRequest,
      quote: quote(),
      customer: { name: 'Ada Lovelace', email: 'ada@example.com', phone: null, notes: null, language: 'en' },
      coupon_code: null,
      referral: null,
    };
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === bridge.RPC.quote) return { data: quote(), error: null };
        return {
          data: {
            contract_version: bridge.CONTRACTS.booking, booking_id: BOOKING,
            status: 'pending', currency: 'EUR', room_total: 300, extras_total: 0,
            coupon_discount: 0, customer_total: 300, quote_fingerprint: HASH,
            created_at: '2099-09-01T10:01:00.000000Z', replayed: calls.length > 2,
          },
          error: null,
        };
      },
    };
    await expect(bridge.quote(request(), client)).resolves.toMatchObject({ room_type_id: UPPER_ROOM });
    await expect(bridge.createBooking(bookingRequest, client)).resolves.toMatchObject({ booking_id: BOOKING, replayed: false });
    await expect(bridge.createBooking(bookingRequest, client)).resolves.toMatchObject({ booking_id: BOOKING, replayed: true });
    expect(calls.map((entry) => entry.name)).toEqual([bridge.RPC.quote, bridge.RPC.booking, bridge.RPC.booking]);
    expect(() => bridge.validateBookingRequest({ ...bookingRequest, total_price: 1 })).toThrow('unsupported');
    expect(() => bridge.validateBookingRequest({ ...bookingRequest, quote: {} })).toThrow();
    expect(() => bridge.validateBookingRequest({
      ...bookingRequest,
      quote: quote({ allocation: [{ ...quote().allocation[0], stay_total: 299 }] }),
    })).toThrow('allocation total');
    expect(() => bridge.validateBookingResult({
      contract_version: bridge.CONTRACTS.booking, booking_id: BOOKING,
      status: 'pending', currency: 'EUR', room_total: 300, extras_total: 0,
      coupon_discount: 1, customer_total: 300, quote_fingerprint: HASH,
      created_at: '2099-09-01T10:01:00.000000Z', replayed: false,
    }, bookingRequest)).toThrow('total');

    const committedAtExpiry = {
      ...bookingRequest,
      quote: quote({
        quoted_at: '2026-08-30T10:00:00.000000Z',
        expires_at: '2026-08-30T10:15:00.000000Z',
      }),
    };
    expect(() => bridge.validateBookingRequest(committedAtExpiry)).toThrow('expiry');
    expect(bridge.validateBookingResult({
      contract_version: bridge.CONTRACTS.booking, booking_id: BOOKING,
      status: 'pending', currency: 'EUR', room_total: 300, extras_total: 0,
      coupon_discount: 0, customer_total: 300, quote_fingerprint: HASH,
      created_at: '2026-08-30T10:15:00.000000Z', replayed: false,
    }, committedAtExpiry).booking_id).toBe(BOOKING);
  });
});
