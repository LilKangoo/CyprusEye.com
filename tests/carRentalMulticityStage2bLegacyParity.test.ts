import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type CarOffer = {
  id: string;
  location: 'larnaca' | 'paphos';
  car_model: Record<string, string>;
  price_per_day: number;
  price_3days: number;
  price_4_6days: number;
  price_7_10days: number;
  price_10plus_days: number;
  currency: string;
  insurance_per_day: number;
  young_driver_fee: boolean;
  young_driver_cost: number;
  deposit_amount: number;
  stock_count: number;
  north_allowed: boolean;
  is_available: boolean;
  is_published: boolean;
  submission_status: string;
  max_passengers: number;
  sort_order: number;
  owner_partner_id: string | null;
  [key: string]: unknown;
};

type RuntimeApi = {
  CAR_CITY_VALUES: string[];
  resolveCarFleet: (pickupCity: string, returnCity: string, youngDriver?: boolean) => {
    effectiveOffer: 'larnaca' | 'paphos';
    routeOffer: 'larnaca' | 'paphos';
    paphosEligible: boolean;
    forcedToLarnaca: boolean;
  };
  mapCityToLegacyLocationForPricing: (
    city: string,
    fleet: string,
    placeType?: string,
  ) => string;
  buildPricingMatrixForOfferRow: (offer: CarOffer, location: string) => number[] | null;
  calculateCarRentalQuote: (input: Record<string, unknown>) => Record<string, unknown> | null;
};

describe('Car Rental Multi-City Stage 2B legacy parity with feature flag OFF', () => {
  const root = process.cwd();
  const loadRuntime = (): RuntimeApi => {
    const flowSource = fs
      .readFileSync(path.join(root, 'js/car-rental-flow.js'), 'utf8')
      .replace(/\bexport\s+/g, '');
    const pricingSource = fs
      .readFileSync(path.join(root, 'js/car-pricing.js'), 'utf8')
      .replace(/\bexport\s+/g, '');
    const context = vm.createContext({ console, Date, Math, Number, Set, String });

    vm.runInContext(
      `${flowSource}\n${pricingSource}\nglobalThis.__stage2bApi = {\n`
        + 'CAR_CITY_VALUES, resolveCarFleet, mapCityToLegacyLocationForPricing, '
        + 'buildPricingMatrixForOfferRow, calculateCarRentalQuote\n};',
      context,
      { filename: 'car-stage2b-parity-runtime.js' },
    );
    return (context as unknown as { __stage2bApi: RuntimeApi }).__stage2bApi;
  };
  const api = loadRuntime();
  const offers: CarOffer[] = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      location: 'larnaca',
      car_model: { pl: 'Mazda 2', en: 'Mazda 2', he: 'מאזדה 2' },
      price_per_day: 31,
      price_3days: 93,
      price_4_6days: 31,
      price_7_10days: 30,
      price_10plus_days: 29,
      currency: 'EUR',
      insurance_per_day: 17,
      young_driver_fee: true,
      young_driver_cost: 10,
      deposit_amount: 300,
      stock_count: 2,
      north_allowed: true,
      is_available: true,
      is_published: true,
      submission_status: 'approved',
      max_passengers: 5,
      sort_order: 20,
      owner_partner_id: '20000000-0000-4000-8000-000000000001',
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      location: 'larnaca',
      car_model: { pl: 'Kia Stonic', en: 'Kia Stonic', he: 'קיה סטוניק' },
      price_per_day: 39,
      price_3days: 117,
      price_4_6days: 39,
      price_7_10days: 37,
      price_10plus_days: 35,
      currency: 'EUR',
      insurance_per_day: 17,
      young_driver_fee: false,
      young_driver_cost: 0,
      deposit_amount: 450,
      stock_count: 1,
      north_allowed: true,
      is_available: true,
      is_published: true,
      submission_status: 'approved',
      max_passengers: 4,
      sort_order: 10,
      owner_partner_id: '20000000-0000-4000-8000-000000000002',
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      location: 'paphos',
      car_model: { pl: 'Toyota Yaris', en: 'Toyota Yaris', he: 'טויוטה יאריס' },
      price_per_day: 0,
      price_3days: 120,
      price_4_6days: 33,
      price_7_10days: 31,
      price_10plus_days: 28,
      currency: 'EUR',
      insurance_per_day: 17,
      young_driver_fee: false,
      young_driver_cost: 0,
      deposit_amount: 350,
      stock_count: 3,
      north_allowed: false,
      is_available: true,
      is_published: true,
      submission_status: 'approved',
      max_passengers: 5,
      sort_order: 40,
      owner_partner_id: '20000000-0000-4000-8000-000000000003',
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      location: 'paphos',
      car_model: { pl: 'Nissan Juke', en: 'Nissan Juke', he: 'ניסאן ג׳וק' },
      price_per_day: 0,
      price_3days: 150,
      price_4_6days: 41,
      price_7_10days: 38,
      price_10plus_days: 34,
      currency: 'EUR',
      insurance_per_day: 17,
      young_driver_fee: false,
      young_driver_cost: 0,
      deposit_amount: 500,
      stock_count: 1,
      north_allowed: false,
      is_available: true,
      is_published: false,
      submission_status: 'pending',
      max_passengers: 5,
      sort_order: 30,
      owner_partner_id: null,
    },
  ];
  const profileIds = {
    larnaca: 'ca210001-0000-4000-8000-000000000001',
    paphos: 'ca210001-0000-4000-8000-000000000002',
  };
  const enrichedOffers = offers.map((offer) => ({
    ...offer,
    pricing_profile_id: profileIds[offer.location],
    availability_mode: 'legacy',
    vehicle_kind_id: 'ca220001-0000-4000-8000-000000000001',
  }));
  const addDays = (dateValue: string, days: number) => {
    const date = new Date(`${dateValue}T10:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const roundCurrency = (value: number) => Number(value.toFixed(2));

  const resolveScenario = (
    sourceOffers: CarOffer[],
    pickupCity: string,
    returnCity: string,
    days: number,
    options: {
      fullInsurance?: boolean;
      youngDriver?: boolean;
      passengers?: number;
      language?: 'pl' | 'en' | 'he';
      pickupPlaceType?: string;
      returnPlaceType?: string;
      couponPercent?: number;
    } = {},
  ) => {
    const globalMappedFlag = false;
    const fleet = api.resolveCarFleet(pickupCity, returnCity, !!options.youngDriver);
    const passengerCount = options.passengers || 2;
    const language = options.language || 'en';
    const pickupDate = '2026-09-01';
    const returnDate = addDays(pickupDate, days);
    const candidateRows = sourceOffers.filter((offer) => {
      const publicReaderLocation = globalMappedFlag && offer.availability_mode === 'mapped'
        ? 'not-used-in-stage2b'
        : offer.location;
      return publicReaderLocation === fleet.effectiveOffer
        && offer.is_available
        && offer.north_allowed === (fleet.effectiveOffer === 'larnaca')
        && (!Number.isFinite(Number(offer.max_passengers)) || Number(offer.max_passengers) <= 0
          || Number(offer.max_passengers) >= passengerCount)
        && (!options.youngDriver || offer.young_driver_fee);
    });
    const rows = candidateRows.map((offer) => {
      const pricingMatrix = api.buildPricingMatrixForOfferRow(offer, offer.location);
      const pickupKey = api.mapCityToLegacyLocationForPricing(
        pickupCity,
        offer.location,
        options.pickupPlaceType || 'hotel',
      );
      const returnKey = api.mapCityToLegacyLocationForPricing(
        returnCity,
        offer.location,
        options.returnPlaceType || 'hotel',
      );
      const quote = api.calculateCarRentalQuote({
        pricingMatrix,
        offer: offer.location,
        carModel: offer.car_model[language],
        pickupDateStr: pickupDate,
        returnDateStr: returnDate,
        pickupTimeStr: '10:00',
        returnTimeStr: '10:00',
        pickupLocation: pickupKey,
        returnLocation: returnKey,
        fullInsurance: !!options.fullInsurance,
        youngDriver: !!options.youngDriver,
        offerRow: offer,
      }) as Record<string, unknown>;
      const quoteTotal = Number(quote.total);
      const couponDiscount = roundCurrency(quoteTotal * ((options.couponPercent || 0) / 100));
      const finalTotal = roundCurrency(quoteTotal - couponDiscount);
      const depositOverride = {
        resource_type: 'car',
        resource_id: offer.id,
        mode: 'fixed',
        value: offer.deposit_amount,
        currency: offer.currency,
      };
      const bookingPayloadInvariant = {
        offer_id: offer.id,
        location: offer.location,
        pickup_location: pickupKey,
        return_location: returnKey,
        total_amount: finalTotal,
        quoted_total_before_discount: quoteTotal,
        coupon_code: options.couponPercent ? 'PARITY10' : null,
        coupon_discount_amount: couponDiscount,
        owner_partner_id: offer.owner_partner_id,
        stock_count: offer.stock_count,
      };

      return {
        id: offer.id,
        label: offer.car_model[language],
        pickupKey,
        returnKey,
        quote: JSON.parse(JSON.stringify(quote)),
        couponDiscount,
        finalTotal,
        depositOverride,
        partnerResourceLookup: { resource_type: 'car', resource_id: offer.id },
        bookingPayloadInvariant,
        sortOrder: offer.sort_order,
      };
    });

    rows.sort((left, right) => {
      const totalDelta = Number(left.quote.total) - Number(right.quote.total);
      return totalDelta || left.sortOrder - right.sortOrder;
    });

    return JSON.parse(JSON.stringify({
      fleet,
      eligibleOfferIds: rows.map((row) => row.id),
      rows,
    }));
  };

  test('all 36 current city pairs preserve eligibility, exact IDs, quote totals, and ordering', () => {
    const cities = Array.from(api.CAR_CITY_VALUES);
    const durations = [3, 4, 7, 11];
    let pairCount = 0;

    cities.forEach((pickupCity, pickupIndex) => {
      cities.forEach((returnCity, returnIndex) => {
        pairCount += 1;
        durations.forEach((days) => {
          const options = {
            fullInsurance: (pickupIndex + returnIndex + days) % 2 === 0,
            youngDriver: (pickupIndex + returnIndex + days) % 5 === 0,
            passengers: ((pickupIndex + returnIndex) % 4) + 1,
            language: (['pl', 'en', 'he'] as const)[(pickupIndex + returnIndex) % 3],
            couponPercent: (pickupIndex + returnIndex) % 3 === 0 ? 10 : 0,
          };
          const before = resolveScenario(offers, pickupCity, returnCity, days, options);
          const after = resolveScenario(enrichedOffers, pickupCity, returnCity, days, options);

          expect(after).toEqual(before);
          expect(new Set(after.eligibleOfferIds).size).toBe(after.eligibleOfferIds.length);
          const totals = after.rows.map((row: { quote: { total: number } }) => Number(row.quote.total));
          expect(totals).toEqual([...totals].sort((left, right) => left - right));
          after.rows.forEach((row: {
            id: string;
            bookingPayloadInvariant: Record<string, unknown> & { offer_id: string };
          }) => {
            expect(row.bookingPayloadInvariant.offer_id).toBe(row.id);
            expect(row.bookingPayloadInvariant).not.toHaveProperty('pricing_profile_id');
            expect(row.bookingPayloadInvariant).not.toHaveProperty('availability_mode');
            expect(row.bookingPayloadInvariant).not.toHaveProperty('vehicle_kind_id');
          });
        });
      });
    });

    expect(pairCount).toBe(36);
  });

  test('Paphos airport fee remains per end below seven days and zero from seven days', () => {
    const threeDaysBefore = resolveScenario(offers, 'paphos', 'paphos', 3, {
      pickupPlaceType: 'airport',
      returnPlaceType: 'airport',
    });
    const threeDaysAfter = resolveScenario(enrichedOffers, 'paphos', 'paphos', 3, {
      pickupPlaceType: 'airport',
      returnPlaceType: 'airport',
    });
    const sevenDaysBefore = resolveScenario(offers, 'paphos', 'paphos', 7, {
      pickupPlaceType: 'airport',
      returnPlaceType: 'airport',
    });
    const sevenDaysAfter = resolveScenario(enrichedOffers, 'paphos', 'paphos', 7, {
      pickupPlaceType: 'airport',
      returnPlaceType: 'airport',
    });

    expect(threeDaysAfter).toEqual(threeDaysBefore);
    expect(sevenDaysAfter).toEqual(sevenDaysBefore);
    threeDaysAfter.rows.forEach((row: { quote: { pickupFee: number; returnFee: number } }) => {
      expect(row.quote.pickupFee).toBe(10);
      expect(row.quote.returnFee).toBe(10);
    });
    sevenDaysAfter.rows.forEach((row: { quote: { pickupFee: number; returnFee: number } }) => {
      expect(row.quote.pickupFee).toBe(0);
      expect(row.quote.returnFee).toBe(0);
    });
  });

  test('insurance, young driver, coupon, deposit, stock, and partner contracts ignore foundation fields', () => {
    const cases = [
      { pickup: 'larnaca', returnCity: 'limassol', days: 4, fullInsurance: true, youngDriver: false },
      { pickup: 'nicosia', returnCity: 'paphos', days: 11, fullInsurance: false, youngDriver: true },
      { pickup: 'paphos', returnCity: 'paphos', days: 3, fullInsurance: true, youngDriver: false },
    ];

    cases.forEach((entry) => {
      const options = {
        fullInsurance: entry.fullInsurance,
        youngDriver: entry.youngDriver,
        couponPercent: 10,
        passengers: 4,
      };
      const before = resolveScenario(offers, entry.pickup, entry.returnCity, entry.days, options);
      const after = resolveScenario(enrichedOffers, entry.pickup, entry.returnCity, entry.days, options);

      expect(after).toEqual(before);
      after.rows.forEach((row: {
        id: string;
        depositOverride: { resource_id: string };
        partnerResourceLookup: { resource_id: string };
        bookingPayloadInvariant: { stock_count: number; owner_partner_id: string | null };
      }) => {
        const source = offers.find((offer) => offer.id === row.id) as CarOffer;
        expect(row.depositOverride.resource_id).toBe(row.id);
        expect(row.partnerResourceLookup.resource_id).toBe(row.id);
        expect(row.bookingPayloadInvariant.stock_count).toBe(source.stock_count);
        expect(row.bookingPayloadInvariant.owner_partner_id).toBe(source.owner_partner_id);
      });
    });
  });
});
