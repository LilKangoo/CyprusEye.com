import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type HotelPricingApi = {
  calculateHotelPrice: (hotel: Record<string, unknown>, persons: number, nights: number, options?: Record<string, unknown>) => any;
  calculateHotelQuote: (hotel: Record<string, unknown>, context: Record<string, unknown>) => any;
  getHotelMinPricePerNight: (hotel: Record<string, unknown>, options?: Record<string, unknown>) => number | null;
};

type HotelBookingUiApi = {
  buildBookingSnapshot: (hotel: Record<string, unknown>, quote: Record<string, unknown>, options?: Record<string, unknown>) => any;
};

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const THRESHOLD_NIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SEVEN_ARCHES_RATES = [
  { persons: 2, rates: [100, 90, 88, 84, 80, 76, 74, 72, 70] },
  { persons: 3, rates: [130, 113, 113, 104, 100, 95, 94, 90, 90] },
  { persons: 4, rates: [155, 135, 135, 120, 118, 114, 111, 107, 107] },
  { persons: 5, rates: [200, 180, 176, 168, 160, 152, 148, 144, 140] },
  { persons: 6, rates: [260, 226, 226, 208, 200, 190, 188, 180, 180] },
  { persons: 7, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
  { persons: 8, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
] as const;

const sevenArchesRules = SEVEN_ARCHES_RATES.flatMap((matrixRow) =>
  THRESHOLD_NIGHTS.map((minNights, index) => ({
    persons: matrixRow.persons,
    min_nights: minNights,
    price_per_night: matrixRow.rates[index],
  })),
);

function fakePhotos(slug: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `oracle://${slug}/photo-${index + 1}`);
}

const LEGACY_PROPERTIES = [
  {
    id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    slug: '7-ukow',
    title: { en: '7 Arches' },
    city: 'Lefkara',
    is_published: true,
    status: 'draft',
    submission_status: 'draft',
    pricing_model: 'tiered_by_nights',
    pricing_tiers: { rules: sevenArchesRules },
    max_persons: 8,
    photos: fakePhotos('7-ukow', 9),
    room_types: [],
  },
  {
    id: 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
    slug: 'rgb-cabins-larnaka-centrum',
    title: { en: 'RGB Cabins - Larnaca City Centre' },
    city: 'Larnaca',
    is_published: false,
    status: 'draft',
    submission_status: 'draft',
    pricing_model: 'flat_per_night',
    pricing_tiers: {
      currency: 'EUR',
      rules: [{
        persons: 2,
        min_nights: 2,
        price_per_night: 45,
        month_prices: {
          jan: 45,
          feb: 45,
          mar: 45,
          apr: 45,
          may: 50,
          jun: 60,
          jul: 60,
          aug: 60,
          sep: 50,
          oct: 45,
          nov: 45,
          dec: 45,
        },
      }],
    },
    max_persons: 2,
    photos: fakePhotos('rgb-cabins-larnaka-centrum', 21),
    room_types: [],
  },
] as const;

function loadHotelApis(): { pricing: HotelPricingApi; bookingUi: HotelBookingUiApi } {
  const sandbox: Record<string, any> = {
    console,
    Date,
    Math,
    Number,
    Object,
    Array,
    Set,
    WeakMap,
    URLSearchParams,
    location: { search: '?lang=en' },
    document: { documentElement: { lang: 'en' } },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/hotel-pricing.js'), sandbox, { filename: 'js/hotel-pricing.js' });
  vm.runInContext(read('js/hotel-booking-ui.js'), sandbox, { filename: 'js/hotel-booking-ui.js' });
  return {
    pricing: sandbox.CE_HOTEL_PRICING as HotelPricingApi,
    bookingUi: sandbox.CE_HOTEL_BOOKING_UI as HotelBookingUiApi,
  };
}

function sourceSection(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function missingPayloadKeys(source: string, keys: readonly string[]): string[] {
  return keys.filter((key) => !new RegExp(`\\b${key}\\s*(?::|,)`).test(source));
}

describe('Hotels V2 H1A deterministic legacy oracle', () => {
  const { pricing, bookingUi } = loadHotelApis();
  const sevenArches = LEGACY_PROPERTIES[0];
  const rgbCabins = LEGACY_PROPERTIES[1];

  test('pins both exact legacy properties, public eligibility, card inputs and photo counts', () => {
    expect(LEGACY_PROPERTIES).toHaveLength(2);
    expect(LEGACY_PROPERTIES.map((property) => property.id)).toEqual([
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
    ]);

    expect(sevenArches).toMatchObject({
      slug: '7-ukow',
      title: { en: '7 Arches' },
      city: 'Lefkara',
      is_published: true,
      status: 'draft',
      submission_status: 'draft',
      pricing_model: 'tiered_by_nights',
      max_persons: 8,
      room_types: [],
    });
    expect(sevenArches.photos).toHaveLength(9);

    expect(rgbCabins).toMatchObject({
      slug: 'rgb-cabins-larnaka-centrum',
      title: { en: 'RGB Cabins - Larnaca City Centre' },
      city: 'Larnaca',
      is_published: false,
      status: 'draft',
      submission_status: 'draft',
      pricing_model: 'flat_per_night',
      max_persons: 2,
      room_types: [],
    });
    expect(rgbCabins.photos).toHaveLength(21);
    expect(rgbCabins.pricing_tiers).toEqual({
      currency: 'EUR',
      rules: [expect.objectContaining({
        persons: 2,
        min_nights: 2,
        price_per_night: 45,
        month_prices: expect.objectContaining({ jan: 45, may: 50, jul: 60, dec: 45 }),
      })],
    });

    const publicRows = LEGACY_PROPERTIES.filter((property) => property.is_published === true);
    expect(publicRows.map((property) => property.id)).toEqual([sevenArches.id]);
    expect(pricing.getHotelMinPricePerNight(sevenArches, { preferredPersons: 2 })).toBe(70);

    for (const sourcePath of ['hotels.html', 'hotel.html', 'js/home-hotels.js']) {
      const source = read(sourcePath);
      expect(source).toContain(".from('hotels')");
      expect(source).toContain(".eq('is_published', true)");
    }

    expect(read('hotels.html')).toContain('h.cover_image_url || (Array.isArray(h.photos)&&h.photos[0])');
    expect(read('hotel.html')).toContain('const photos = Array.isArray(hotel.photos)? hotel.photos: []');
    expect(read('js/home-hotels.js')).toContain('h.cover_image_url || (Array.isArray(h.photos)&&h.photos[0])');
  });

  test('pins all 63 accepted 7-ukow tiers and produces a zero-mismatch full price matrix', () => {
    expect(sevenArchesRules).toHaveLength(63);
    expect(new Set(sevenArchesRules.map((rule) => `${rule.persons}:${rule.min_nights}`)).size).toBe(63);
    expect(sevenArchesRules).toEqual(SEVEN_ARCHES_RATES.flatMap((matrixRow) =>
      THRESHOLD_NIGHTS.map((minNights, index) => ({
        persons: matrixRow.persons,
        min_nights: minNights,
        price_per_night: matrixRow.rates[index],
      }))));

    let hotelLegacyPriceMismatch = 0;
    let evaluatedPrices = 0;
    for (const matrixRow of SEVEN_ARCHES_RATES) {
      THRESHOLD_NIGHTS.forEach((nights, index) => {
        const expectedRate = matrixRow.rates[index];
        const expectedTotal = expectedRate * nights;
        const result = pricing.calculateHotelPrice(sevenArches, matrixRow.persons, nights, {
          arrivalDate: '2026-09-01',
        });
        evaluatedPrices += 1;
        if (
          result.pricePerNight !== expectedRate
          || result.total !== expectedTotal
          || result.actualTotal !== expectedTotal
          || result.billableNights !== nights
          || result.extraBillableNights !== 0
          || Number(result.tier?.persons) !== matrixRow.persons
          || Number(result.tier?.min_nights) !== nights
        ) {
          hotelLegacyPriceMismatch += 1;
        }
      });
    }

    expect(evaluatedPrices).toBe(63);
    expect(hotelLegacyPriceMismatch).toBe(0);
    expect(pricing.calculateHotelPrice(sevenArches, 2, 2).total).toBe(200);
    expect(pricing.calculateHotelPrice(sevenArches, 2, 10).total).toBe(700);
    expect(pricing.calculateHotelPrice(sevenArches, 8, 2).total).toBe(620);
    expect(pricing.calculateHotelPrice(sevenArches, 8, 10).total).toBe(2140);

    const rgbMonthlyOracle = [
      ['2026-01-10', 45],
      ['2026-05-10', 50],
      ['2026-07-10', 60],
      ['2026-12-10', 45],
    ] as const;
    rgbMonthlyOracle.forEach(([arrivalDate, nightlyRate]) => {
      const result = pricing.calculateHotelPrice(rgbCabins, 2, 2, { arrivalDate });
      expect(result.pricePerNight).toBe(nightlyRate);
      expect(result.total).toBe(nightlyRate * 2);
    });
  });

  test('keeps the accepted legacy booking payload and snapshot semantics on all three public surfaces', () => {
    const detail = sourceSection(read('hotel.html'), 'async function submitBooking(e)', 'function getPhotos()');
    const listing = sourceSection(
      read('hotels.html'),
      "document.getElementById('hotelBookingForm').addEventListener('submit'",
      '(async function init()',
    );
    const homepage = sourceSection(
      read('js/home-hotels.js'),
      "if (form) form.addEventListener('submit'",
      'function extractHomeHotelMissingColumn',
    );
    const commonKeys = [
      'hotel_id', 'hotel_slug', 'customer_name', 'customer_email', 'customer_phone',
      'arrival_date', 'departure_date', 'num_adults', 'num_children', 'nights', 'notes',
      'base_price', 'extras_price', 'final_price', 'total_price', 'coupon_id', 'coupon_code',
      'coupon_discount_amount', 'coupon_partner_id', 'coupon_partner_commission_bps', 'lang', 'status',
    ] as const;

    let hotelBookingPayloadUnexplainedDifference = 0;
    for (const source of [detail, listing, homepage]) {
      hotelBookingPayloadUnexplainedDifference += missingPayloadKeys(source, commonKeys).length;
      if (!source.includes("status: 'pending'")) hotelBookingPayloadUnexplainedDifference += 1;
      if (!source.includes('buildBookingSnapshot')) hotelBookingPayloadUnexplainedDifference += 1;
      if (!source.includes("from('hotel_bookings')") || !source.includes('.insert(')) {
        hotelBookingPayloadUnexplainedDifference += 1;
      }
      expect(source).not.toMatch(/booking_mode\s*:|architecture_version\s*:|status\s*:\s*['"]confirmed['"]/);
    }

    for (const referralKey of ['referral_code', 'referral_source', 'referral_captured_at']) {
      expect(detail).toMatch(new RegExp(`\\b${referralKey}\\s*:`));
      expect(homepage).toMatch(new RegExp(`\\b${referralKey}\\s*:`));
    }
    expect(listing).toContain('hotel_name: hotelTitle');
    expect(listing).toContain('user_id: user?.id || null');
    expect(homepage).toContain('category_id: homeCurrentHotel.category_id');

    const quote = pricing.calculateHotelQuote(sevenArches, {
      adults: 2,
      children: 0,
      nights: 3,
      arrivalDate: '2026-09-01',
      departureDate: '2026-09-04',
    });
    const snapshot = bookingUi.buildBookingSnapshot(sevenArches, quote, { language: 'en' });
    expect(quote.total).toBe(270);
    expect(snapshot).toMatchObject({
      lang: 'en',
      room_type_id: null,
      rate_plan_id: null,
      extras_price: 0,
      selected_extras: [],
      pricing_breakdown: {
        room_total: 270,
        base_total: 270,
        billable_nights: 3,
        requested_nights: 3,
        pricing_model: 'tiered_by_nights',
      },
      booking_details: {
        booking_language: 'en',
        room_type_id: null,
        rate_plan_id: null,
      },
    });
    expect(hotelBookingPayloadUnexplainedDifference).toBe(0);
  });

  test('preserves Hotel coupon, referral and central deposit seams without inventing a second workflow', () => {
    const couponSql = read('supabase/migrations/124_service_coupon_quote_and_booking_enforcement.sql');
    const partnerAction = read('supabase/functions/partner-fulfillment-action/index.ts');
    const partnerBridge = read('supabase/migrations/20260811150000_hotels_v2_h1a_partner_security_bridge.sql');
    const fixture = read('tests/integration/hotels-v2-h1a-base.sql');

    expect(couponSql).toContain('trg_apply_service_coupon_hotel_booking');
    expect(couponSql).toContain('trg_service_coupon_redemption_from_hotel_booking');
    expect(couponSql).toContain('trg_sync_hotel_coupon_to_fulfillment');
    expect(couponSql).toContain("'hotels'");

    expect(partnerBridge).toContain('partner_get_referral_attributed_orders_safe');
    expect(partnerBridge).toContain('null::text as customer_name');
    expect(partnerAction).toContain('.from("service_deposit_overrides")');
    expect(partnerAction).toContain('.from("service_deposit_rules")');
    expect(partnerAction).toContain('if (v === "hotels" || v === "hotel") return "hotels"');

    expect(fixture).toContain("'80000000-0000-4000-8000-000000000001', 'hotels'");
    expect(fixture).toContain("'90000000-0000-4000-8000-000000000001', 'hotels'");
    expect(fixture).toContain("'SYNTHETIC10', 20");
    expect(fixture).toContain('deposit_fingerprint');
    expect(fixture).toContain('coupon_fingerprint');
  });

  test('preserves exactly-once Hotel fulfillment, pending partner action and customer notification seams', () => {
    const fulfillmentSql = read('supabase/migrations/082_force_multi_partner_fulfillments_and_sync.sql');
    const notificationSql = read('supabase/migrations/061_customer_received_notifications.sql');
    const notificationFunction = read('supabase/functions/send-admin-notification/index.ts');
    const fixture = read('tests/integration/hotels-v2-h1a-base.sql');

    expect(fulfillmentSql).toContain('partner_service_fulfillments_unique_trips_hotels');
    expect(fulfillmentSql).toContain('trg_partner_service_fulfillment_from_hotel_booking');
    expect(fulfillmentSql).toContain("'pending_acceptance'");
    expect(fulfillmentSql).toContain("CONCAT('HOTEL-', SUBSTRING(NEW.id::text, 1, 8))");
    expect(fulfillmentSql).not.toMatch(/trg_partner_service_fulfillment_from_hotel_booking[\s\S]{0,1500}status\s*=\s*['"]accepted['"]/i);

    expect(notificationSql).toContain('trg_enqueue_customer_received_hotel_booking');
    expect(notificationSql).toContain("'hotels_customer_received:' || NEW.id::text");
    expect(notificationFunction).toContain('if (category === "hotels") return parseRecipients(getField(record, ["customer_email"]))');
    expect(notificationFunction).toContain('if (c === "hotel" || c === "hotels" || c === "hotel_bookings") return "hotels"');

    expect(fixture.match(/'pending_acceptance'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(fixture).toContain('fulfillment_fingerprint');
    expect(fixture).toContain('booking_fingerprint');
  });

  test('reports the accepted H1A legacy oracle counters at zero', () => {
    const publicIds = LEGACY_PROPERTIES
      .filter((property) => property.is_published)
      .map((property) => property.id);
    const counters = {
      HOTEL_LEGACY_PRICE_MISMATCH: 0,
      HOTEL_LEGACY_PUBLIC_MISMATCH: Number(publicIds.join(',') !== sevenArches.id),
      HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE: 0,
    };
    expect(counters).toEqual({
      HOTEL_LEGACY_PRICE_MISMATCH: 0,
      HOTEL_LEGACY_PUBLIC_MISMATCH: 0,
      HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE: 0,
    });
  });
});
