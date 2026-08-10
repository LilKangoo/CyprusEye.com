import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function moduleToScript(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8')
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, '');
}

function loadAdapter(): any {
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(moduleToScript('js/car-pricing.js'), context, { filename: 'js/car-pricing.js' });
  vm.runInContext(moduleToScript('js/car-rental-flow.js'), context, { filename: 'js/car-rental-flow.js' });
  vm.runInContext(moduleToScript('js/car-rental-duration-contract.js'), context, { filename: 'js/car-rental-duration-contract.js' });
  vm.runInContext(moduleToScript('js/car-rental-threshold-pricing.js'), context, { filename: 'js/car-rental-threshold-pricing.js' });
  vm.runInContext(moduleToScript('js/car-rental-public-eligibility.js'), context, { filename: 'js/car-rental-public-eligibility.js' });
  vm.runInContext(`${moduleToScript('js/car-rental-availability-adapter.js')}
    globalThis.Stage2eAdapter = { resolveCarRentalAvailability };`, context, {
    filename: 'js/car-rental-availability-adapter.js',
  });
  return context.Stage2eAdapter;
}

const adapter = loadAdapter();
const CITY_CODES = ['larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'];
const cityId = (code: string) => `city-${code}`;
const profiles = [
  { id: 'profile-larnaca', code: 'larnaca', calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true },
  { id: 'profile-paphos', code: 'paphos', calculator_key: 'paphos', legacy_booking_location: 'paphos', is_active: true },
];
const cities = CITY_CODES.map((code, index) => ({ id: cityId(code), code, is_active: true, sort_order: index }));
const profileCities = [
  ...CITY_CODES.map((code) => ({
    pricing_profile_id: 'profile-larnaca', city_id: cityId(code),
    pickup_supported: true, return_supported: true,
    legacy_pricing_city_key: code, is_active: true,
  })),
  {
    pricing_profile_id: 'profile-paphos', city_id: cityId('paphos'),
    pickup_supported: true, return_supported: true,
    legacy_pricing_city_key: 'paphos', is_active: true,
  },
];

function offer(
  id: string,
  location: 'larnaca' | 'paphos',
  availabilityMode: 'legacy' | 'mapped',
  overrides: Record<string, unknown> = {},
) {
  const paphos = location === 'paphos';
  return {
    id,
    location,
    pricing_profile_id: paphos ? 'profile-paphos' : 'profile-larnaca',
    availability_mode: availabilityMode,
    car_model: { en: id, pl: id, he: id },
    car_type: { en: paphos ? 'Compact' : 'Economy' },
    description: { en: 'Fixture', pl: 'Fixture', he: 'Fixture' },
    features: { en: ['AC'], pl: ['AC'], he: ['AC'] },
    transmission: 'automatic', fuel_type: 'petrol',
    max_passengers: 5, stock_count: 1, sort_order: 10,
    is_available: true, is_published: true, submission_status: 'approved',
    north_allowed: !paphos,
    price_per_day: paphos ? 65 : 35,
    price_3days: paphos ? 210 : 105,
    price_4_6days: paphos ? 65 : 35,
    price_7_10days: paphos ? 60 : 35,
    price_10plus_days: paphos ? 55 : 35,
    insurance_per_day: 17,
    young_driver_fee: !paphos,
    young_driver_cost: paphos ? 0 : 10,
    owner_partner_id: `partner-${location}`,
    ...overrides,
  };
}

const legacyLarnaca = offer('legacy-larnaca', 'larnaca', 'legacy', { price_per_day: 39, sort_order: 20 });
const legacyPaphos = offer('legacy-paphos', 'paphos', 'legacy', { price_3days: 225, sort_order: 20 });
const mappedLarnaca = offer('mapped-larnaca', 'larnaca', 'mapped', { price_per_day: 25, sort_order: 30 });
const mappedPaphos = offer('mapped-paphos', 'paphos', 'mapped', { price_3days: 180, sort_order: 5 });

function availability(offerId: string, code: string, pickup = true, ret = true) {
  return {
    offer_id: offerId, city_id: cityId(code),
    pickup_enabled: pickup, return_enabled: ret, is_active: true,
  };
}

function mappedContext(overrides: Record<string, unknown> = {}) {
  return {
    cities,
    profiles,
    profileCities,
    offers: [mappedLarnaca, mappedPaphos],
    availability: [
      ...CITY_CODES.map((code) => availability(mappedLarnaca.id, code)),
      availability(mappedPaphos.id, 'paphos'),
    ],
    ...overrides,
  };
}

function legacyResultFor(pickupCityCode: string, returnCityCode: string) {
  return pickupCityCode === 'paphos' && returnCityCode === 'paphos'
    ? [legacyPaphos, mappedPaphos]
    : [legacyLarnaca, mappedLarnaca];
}

function repository(flag: boolean, context = mappedContext(), readError: Error | null = null) {
  return {
    getFeatureFlag: async () => flag,
    readMappedContext: async () => {
      if (readError) throw readError;
      return context;
    },
    getMetrics: () => ({ requests: flag ? 6 : 1, responseBytes: 2048, durationMs: 4, queries: [] }),
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    pickupCityCode: 'larnaca', returnCityCode: 'larnaca',
    pickupPlaceType: 'hotel', returnPlaceType: 'hotel',
    pickupDate: '2026-09-01', pickupTime: '10:00',
    returnDate: '2026-09-04', returnTime: '10:00',
    passengers: 2, fullInsurance: false, youngDriver: false,
    language: 'en', filters: { platform: 'homepage' }, mode: 'hybrid',
    ...overrides,
  };
}

async function resolveHybrid(overrides: Record<string, unknown> = {}, context = mappedContext()) {
  const pickup = String(overrides.pickupCityCode || 'larnaca');
  const ret = String(overrides.returnCityCode || 'larnaca');
  const legacyOffers = (overrides.legacyOffers as any[]) || legacyResultFor(pickup, ret);
  return adapter.resolveCarRentalAvailability({
    ...input(overrides), legacyOffers,
    repository: overrides.repository || repository(true, context),
  });
}

describe('Car Rental Multi-City Stage 2E controlled hybrid selection', () => {
  test('flag OFF returns the exact legacy result reference and performs no mapped read', async () => {
    const legacyOffers = [legacyLarnaca, mappedLarnaca];
    let mappedReads = 0;
    const repo = {
      getFeatureFlag: async () => false,
      readMappedContext: async () => { mappedReads += 1; return mappedContext(); },
      getMetrics: () => ({ requests: 1, responseBytes: 8, durationMs: 1, queries: [] }),
    };
    const result = await adapter.resolveCarRentalAvailability({ ...input(), legacyOffers, repository: repo });
    expect(result.renderedOffers).toBe(legacyOffers);
    expect(result.renderMode).toBe('legacy');
    expect(mappedReads).toBe(0);
  });

  test('flag ON removes mapped rows from legacy, adds eligible mapped rows, deduplicates exact IDs and sorts globally', async () => {
    const result = await resolveHybrid({ pickupCityCode: 'paphos', returnCityCode: 'paphos' });
    expect(result.renderMode).toBe('hybrid');
    expect(result.renderedOffers.map((row: any) => row.id)).toEqual([
      mappedLarnaca.id,
      mappedPaphos.id,
      legacyPaphos.id,
    ]);
    expect(new Set(result.renderedOffers.map((row: any) => row.id)).size).toBe(result.renderedOffers.length);
    expect(result.diagnostics.some((row: any) => row.code === 'LEGACY_MAPPED_DUPLICATE_REMOVED')).toBe(true);
    expect(result.diagnostics.some((row: any) => row.code === 'HYBRID_RESULT_READY')).toBe(true);
  });

  test('mapped reader failure keeps strict legacy-mode offers and never falls a mapped offer back to legacy', async () => {
    const result = await resolveHybrid({
      repository: repository(true, mappedContext(), new Error('isolated mapped read failure')),
    });
    expect(result.renderMode).toBe('hybrid-fallback');
    expect(result.renderedOffers.map((row: any) => row.id)).toEqual([legacyLarnaca.id]);
    expect(result.diagnostics.some((row: any) => row.code === 'MAPPED_READER_UNAVAILABLE')).toBe(true);
    expect(result.diagnostics.some((row: any) => row.code === 'MAPPED_OFFER_OMITTED' && row.offerId === mappedLarnaca.id)).toBe(true);
  });

  test('a configured custom city is threshold-mapped only and never falls back to the legacy resolver', async () => {
    const customCity = { id: 'city-polis', code: 'polis', is_active: true, sort_order: 99 };
    const thresholdOffer = offer('threshold-polis', 'larnaca', 'mapped', {
      pricing_strategy: 'threshold_daily_rate',
      min_rental_days: 1,
      max_rental_days: null,
      insurance_mode: 'not_offered',
      young_driver_fee: false,
      young_driver_cost: 0,
    });
    const customContext = mappedContext({
      cities: [...cities, customCity],
      offers: [thresholdOffer],
      profileCities: [],
      availability: [{
        offer_id: thresholdOffer.id,
        city_id: customCity.id,
        pickup_enabled: true,
        return_enabled: true,
        is_active: true,
        fee_mode: 'override',
        fee_per_direction: 0,
      }],
      dailyRateTiers: [{
        id: 'tier-polis-1', offer_id: thresholdOffer.id,
        threshold_days: 1, daily_rate: 50, is_active: true,
      }],
      publicEligibleThresholdOfferIds: [thresholdOffer.id],
      thresholdEligibilityAuthoritative: true,
    });
    const customRepository = {
      getFeatureFlags: async () => ({ mappedEnabled: true, thresholdDailyRatesEnabled: true }),
      readMappedContext: async () => customContext,
      getMetrics: () => ({ requests: 5, responseBytes: 1024, durationMs: 3, queries: [] }),
    };
    const result = await adapter.resolveCarRentalAvailability({
      ...input({ pickupCityCode: 'polis', returnCityCode: 'polis' }),
      legacyOffers: [legacyLarnaca],
      repository: customRepository,
    });
    expect(result.renderMode).toBe('hybrid');
    expect(result.renderedOffers.map((row: any) => row.id)).toEqual([thresholdOffer.id]);
    expect(result.renderedOffers[0].quote).toEqual(expect.objectContaining({
      days: 3,
      dailyRate: 50,
      basePrice: 150,
      pickupFee: 0,
      returnFee: 0,
      total: 150,
    }));
    expect(result.renderedOffers.some((row: any) => row.id === legacyLarnaca.id)).toBe(false);
  });

  test('pickup and return availability are independent', async () => {
    const asymmetric = mappedContext({
      offers: [mappedLarnaca],
      availability: [
        availability(mappedLarnaca.id, 'paphos', true, false),
        availability(mappedLarnaca.id, 'larnaca', false, true),
      ],
    });
    const valid = await resolveHybrid({ pickupCityCode: 'paphos', returnCityCode: 'larnaca' }, asymmetric);
    expect(valid.mappedOffers.map((row: any) => row.id)).toEqual([mappedLarnaca.id]);
    const invalid = await resolveHybrid({ pickupCityCode: 'paphos', returnCityCode: 'paphos' }, asymmetric);
    expect(invalid.mappedOffers).toEqual([]);
  });

  test('each mapped card carries exact per-offer pricing context and the exact quote object', async () => {
    const result = await resolveHybrid({
      pickupCityCode: 'paphos', returnCityCode: 'paphos',
      pickupPlaceType: 'airport', returnPlaceType: 'hotel',
    });
    const larnaca = result.renderedOffers.find((row: any) => row.id === mappedLarnaca.id);
    const paphos = result.renderedOffers.find((row: any) => row.id === mappedPaphos.id);
    expect(larnaca.pricingContext).toEqual(expect.objectContaining({
      offerId: mappedLarnaca.id,
      availabilityMode: 'mapped',
      pricingProfileId: 'profile-larnaca',
      calculatorKey: 'larnaca', legacyBookingLocation: 'larnaca',
      pickupCityCode: 'paphos', returnCityCode: 'paphos',
      pickupLegacyPricingKey: 'paphos', returnLegacyPricingKey: 'paphos',
      pickupLegacyPricingLocation: 'paphos', returnLegacyPricingLocation: 'paphos',
    }));
    expect(larnaca.pricingContext.quote).toBe(larnaca.quote);
    expect(larnaca.quote.pickupFee).toBe(40);
    expect(larnaca.quote.returnFee).toBe(40);
    expect(paphos.pricingContext.pickupLegacyPricingKey).toBe('paphos');
    expect(paphos.pricingContext.pickupLegacyPricingLocation).toBe('airport_pfo');
    expect(paphos.quote.pickupFee).toBe(10);
  });

  test.each([
    [3, '2026-09-04'],
    [4, '2026-09-05'],
    [7, '2026-09-08'],
    [11, '2026-09-12'],
  ])('uses the unchanged quote for %i days, insurance and young-driver compatibility', async (days, returnDate) => {
    const result = await resolveHybrid({
      returnDate, fullInsurance: true, youngDriver: true,
      legacyOffers: [legacyLarnaca, mappedLarnaca],
    });
    const mapped = result.renderedOffers.find((row: any) => row.id === mappedLarnaca.id);
    expect(mapped.quote.days).toBe(days);
    expect(mapped.quote.insuranceCost).toBe(17 * days);
    expect(mapped.quote.youngDriverCost).toBe(10 * days);
    expect(result.renderedOffers.some((row: any) => row.location === 'paphos')).toBe(false);
  });

  test('stock_count remains non-filtering and invalid mapped configurations are omitted', async () => {
    const zeroStock = { ...mappedLarnaca, stock_count: 0 };
    const accepted = await resolveHybrid({}, mappedContext({ offers: [zeroStock], availability: [availability(zeroStock.id, 'larnaca')] }));
    expect(accepted.mappedOffers.map((row: any) => row.id)).toContain(zeroStock.id);
    const invalid = await resolveHybrid({}, mappedContext({
      offers: [{ ...mappedLarnaca, pricing_profile_id: 'missing-profile' }],
      availability: [availability(mappedLarnaca.id, 'larnaca')],
    }));
    expect(invalid.mappedOffers).toEqual([]);
    expect(invalid.diagnostics.some((row: any) => row.code === 'INVALID_MAPPED_CONFIGURATION')).toBe(true);
  });
});

describe('Car Rental Multi-City Stage 2E 36-pair active matrix', () => {
  test('covers OFF and ON for 144 combinations with zero price, duplicate, payload or unexplained mismatch', async () => {
    let combinations = 0;
    for (const pickupCityCode of CITY_CODES) {
      for (const returnCityCode of CITY_CODES) {
        for (const days of [3, 4, 7, 11]) {
          const legacyOffers = legacyResultFor(pickupCityCode, returnCityCode);
          const common = {
            pickupCityCode,
            returnCityCode,
            returnDate: `2026-09-${String(days + 1).padStart(2, '0')}`,
            legacyOffers,
          };
          const off = await adapter.resolveCarRentalAvailability({
            ...input(common), repository: repository(false),
          });
          expect(off.renderedOffers).toBe(legacyOffers);

          const on = await adapter.resolveCarRentalAvailability({
            ...input(common), repository: repository(true),
          });
          combinations += 1;
          const ids = on.renderedOffers.map((row: any) => row.id);
          expect(ids).toContain(pickupCityCode === 'paphos' && returnCityCode === 'paphos'
            ? legacyPaphos.id
            : legacyLarnaca.id);
          expect(ids).toContain(mappedLarnaca.id);
          if (pickupCityCode === 'paphos' && returnCityCode === 'paphos') expect(ids).toContain(mappedPaphos.id);
          else expect(ids).not.toContain(mappedPaphos.id);
          expect(new Set(ids).size).toBe(ids.length);
          expect(on.comparison.priceMismatches).toEqual([]);
          expect(on.comparison.unexplainedDifferences).toEqual([]);
          expect(on.diagnostics.filter((row: any) => row.code === 'DUPLICATE_OFFER_ID')).toEqual([]);
          expect(on.renderedOffers.every((row: any) => Number.isFinite(Number(row.quote?.total)))).toBe(true);
          expect(on.renderedOffers.every((row: any) => row.pricingContext?.offerId === row.id)).toBe(true);
        }
      }
    }
    expect(combinations).toBe(144);
  });
});
