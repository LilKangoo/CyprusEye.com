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
  const adapter = `${moduleToScript('js/car-rental-availability-adapter.js')}
    globalThis.CarRentalAvailabilityAdapter = {
      resolveCarRentalAvailability,
      resolveMappedAvailabilityFromContext,
      compareCarRentalAvailability,
      buildCarRentalAvailabilityInputFingerprint,
    };`;
  vm.runInContext(adapter, context, { filename: 'js/car-rental-availability-adapter.js' });
  return context.CarRentalAvailabilityAdapter;
}

const adapter = loadAdapter();
const CITY_CODES = ['larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'];
const cityId = (code: string) => `city-${code}`;
const cities = CITY_CODES.map((code, index) => ({
  id: cityId(code), code, is_active: true, sort_order: index,
}));
const profiles = [
  { id: 'profile-larnaca', code: 'larnaca', calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true },
  { id: 'profile-paphos', code: 'paphos', calculator_key: 'paphos', legacy_booking_location: 'paphos', is_active: true },
];
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

function offer(id: string, location = 'larnaca', overrides: Record<string, unknown> = {}) {
  const paphos = location === 'paphos';
  return {
    id,
    location,
    pricing_profile_id: paphos ? 'profile-paphos' : 'profile-larnaca',
    availability_mode: 'mapped',
    car_model: { en: id, pl: id, he: id },
    car_type: { en: paphos ? 'Compact' : 'Economy' },
    description: { en: 'Fixture', pl: 'Fixture', he: 'Fixture' },
    features: { en: ['AC'], pl: ['AC'], he: ['AC'] },
    transmission: 'automatic', fuel_type: 'petrol',
    max_passengers: 5, stock_count: 1, sort_order: paphos ? 20 : 10,
    is_available: true, is_published: true, submission_status: 'approved',
    north_allowed: !paphos,
    price_per_day: paphos ? 65 : 35,
    price_3days: paphos ? 210 : 105,
    price_4_6days: paphos ? 65 : 35,
    price_7_10days: paphos ? 60 : 35,
    price_10plus_days: paphos ? 55 : 35,
    young_driver_fee: !paphos, young_driver_cost: paphos ? 0 : 10,
    ...overrides,
  };
}

function availability(offerId: string, code: string, pickup = true, ret = true, overrides: Record<string, unknown> = {}) {
  return {
    offer_id: offerId,
    city_id: cityId(code),
    pickup_enabled: pickup,
    return_enabled: ret,
    is_active: true,
    ...overrides,
  };
}

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    cities,
    profiles,
    profileCities,
    offers: [offer('offer-larnaca'), offer('offer-paphos', 'paphos')],
    availability: [
      ...CITY_CODES.map((code) => availability('offer-larnaca', code)),
      availability('offer-paphos', 'paphos'),
    ],
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    pickupCityCode: 'larnaca', returnCityCode: 'larnaca',
    pickupPlaceType: 'hotel', returnPlaceType: 'hotel',
    pickupDate: '2026-09-01', pickupTime: '10:00',
    returnDate: '2026-09-04', returnTime: '10:00',
    passengers: 2, fullInsurance: false, youngDriver: false,
    language: 'en', filters: { platform: 'homepage' },
    mode: 'mapped-test',
    ...overrides,
  };
}

async function resolve(overrides: Record<string, unknown> = {}, context = baseContext()) {
  const options: any = input({ mappedContext: context, ...overrides });
  return adapter.resolveCarRentalAvailability(options);
}

describe('Car Rental Multi-City Stage 2D availability adapter', () => {
  test('rejects a duplicated exact offer-city row instead of guessing which record to use', async () => {
    const context = baseContext({
      availability: [
        availability('offer-larnaca', 'paphos', true, false),
        availability('offer-larnaca', 'larnaca', false, true),
        availability('offer-larnaca', 'paphos', true, false),
      ],
      offers: [offer('offer-larnaca')],
    });
    const result = await resolve({ pickupCityCode: 'paphos', returnCityCode: 'larnaca' }, context);
    expect(result.mappedOffers.map((row: any) => row.id)).toEqual([]);
    expect(result.diagnostics.some((entry: any) => entry.code === 'DUPLICATE_OFFER_ID')).toBe(true);
  });

  test('supports all six exact Larnaca legacy pricing keys without copying fee values', async () => {
    for (const code of CITY_CODES) {
      const result = await resolve({ pickupCityCode: code, returnCityCode: code });
      const larnacaOffer = result.mappedOffers.find((row: any) => row.id === 'offer-larnaca');
      expect(larnacaOffer).toBeDefined();
      expect(larnacaOffer.availabilityContext.pickupPricingKey).toBe(code);
      expect(larnacaOffer.availabilityContext.returnPricingKey).toBe(code);
    }
  });

  test('offer-city fee override zero replaces only pickup and return fees', async () => {
    const context = baseContext({
      offers: [offer('offer-free-paphos')],
      availability: [{
        ...availability('offer-free-paphos', 'paphos'),
        fee_mode: 'override',
        fee_per_direction: 0,
      }],
    });
    const result = await resolve({ pickupCityCode: 'paphos', returnCityCode: 'paphos' }, context);
    expect(result.mappedOffers).toHaveLength(1);
    expect(result.mappedOffers[0].quote).toEqual(expect.objectContaining({
      basePrice: 105,
      pickupFee: 0,
      returnFee: 0,
      total: 105,
    }));
    expect(result.mappedOffers[0].pricingContext).toEqual(expect.objectContaining({
      pickupFeeMode: 'override',
      returnFeeMode: 'override',
      pickupFeePerDirection: 0,
      returnFeePerDirection: 0,
    }));
  });

  test('the same city can use different exact fees for two exact offers', async () => {
    const first = offer('offer-fee-zero', 'larnaca', { price_per_day: 35 });
    const second = offer('offer-fee-twelve', 'larnaca', { price_per_day: 35 });
    const context = baseContext({
      offers: [first, second],
      availability: [
        { ...availability(first.id, 'paphos'), fee_mode: 'override', fee_per_direction: 0 },
        { ...availability(second.id, 'paphos'), fee_mode: 'override', fee_per_direction: 12.5 },
      ],
    });
    const result = await resolve({ pickupCityCode: 'paphos', returnCityCode: 'paphos' }, context);
    expect(result.mappedOffers.map((row: any) => [row.id, row.quote.pickupFee, row.quote.returnFee, row.quote.total])).toEqual([
      ['offer-fee-zero', 0, 0, 105],
      ['offer-fee-twelve', 12.5, 12.5, 130],
    ]);
  });

  test('a custom city requires an exact offer override and never guesses a legacy fee', async () => {
    const customCity = { id: 'city-polis', code: 'polis', is_active: true, sort_order: 7 };
    const customMapping = {
      pricing_profile_id: 'profile-larnaca', city_id: customCity.id,
      pickup_supported: true, return_supported: true,
      legacy_pricing_city_key: 'polis', is_active: true,
    };
    const customOffer = offer('offer-polis');
    const inherited = baseContext({
      cities: [...cities, customCity],
      profileCities: [...profileCities, customMapping],
      offers: [customOffer],
      availability: [{ ...availability(customOffer.id, 'larnaca'), city_id: customCity.id, fee_mode: 'inherit', fee_per_direction: null }],
    });
    const blocked = await resolve({ pickupCityCode: 'polis', returnCityCode: 'polis' }, inherited);
    expect(blocked.mappedOffers).toEqual([]);
    expect(blocked.diagnostics.some((row: any) => row.code === 'FEE_REQUIRED_FOR_CITY')).toBe(true);

    const overridden = {
      ...inherited,
      availability: inherited.availability.map((row: any) => ({ ...row, fee_mode: 'override', fee_per_direction: 18 })),
    };
    const accepted = await resolve({ pickupCityCode: 'polis', returnCityCode: 'polis' }, overridden);
    expect(accepted.mappedOffers[0].quote).toEqual(expect.objectContaining({ pickupFee: 18, returnFee: 18, total: 141 }));
    expect(accepted.mappedOffers[0].quote.pickupLoc).toBe('polis');
    expect(accepted.mappedOffers[0].quote.returnLoc).toBe('polis');
  });

  test('Paphos profile is only eligible for Paphos to Paphos and never falls back to Larnaca', async () => {
    const valid = await resolve({ pickupCityCode: 'paphos', returnCityCode: 'paphos' });
    expect(valid.mappedOffers.map((row: any) => row.id)).toEqual(['offer-larnaca', 'offer-paphos']);

    const invalidContext = baseContext({
      profileCities: [...profileCities, {
        pricing_profile_id: 'profile-paphos', city_id: cityId('larnaca'),
        pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'larnaca', is_active: true,
      }],
      availability: [availability('offer-paphos', 'paphos'), availability('offer-paphos', 'larnaca')],
      offers: [offer('offer-paphos', 'paphos')],
    });
    const invalid = await resolve({ pickupCityCode: 'paphos', returnCityCode: 'larnaca' }, invalidContext);
    expect(invalid.mappedOffers).toEqual([]);
    expect(invalid.diagnostics.some((entry: any) => entry.code === 'PAPHOS_PROFILE_OUTSIDE_PAPHOS')).toBe(true);
  });

  test('preserves Paphos place types and airport fee below seven days only', async () => {
    const paphosOnly = baseContext({
      offers: [offer('offer-paphos', 'paphos')],
      availability: [availability('offer-paphos', 'paphos')],
    });
    const belowSeven = await resolve({
      pickupCityCode: 'paphos', returnCityCode: 'paphos',
      pickupPlaceType: 'airport', returnPlaceType: 'airport',
    }, paphosOnly);
    expect(belowSeven.mappedOffers[0].availabilityContext.pickupPricingKey).toBe('airport_pfo');
    expect(belowSeven.mappedOffers[0].quote.pickupFee).toBe(10);
    expect(belowSeven.mappedOffers[0].quote.returnFee).toBe(10);

    const sevenDays = await resolve({
      pickupCityCode: 'paphos', returnCityCode: 'paphos',
      pickupPlaceType: 'airport', returnPlaceType: 'airport',
      returnDate: '2026-09-08',
    }, paphosOnly);
    expect(sevenDays.mappedOffers[0].quote.pickupFee).toBe(0);
    expect(sevenDays.mappedOffers[0].quote.returnFee).toBe(0);
  });

  test.each([
    ['2026-09-04', 3],
    ['2026-09-05', 4],
    ['2026-09-08', 7],
    ['2026-09-12', 11],
  ])('uses the existing quote calculator for %s (%i days)', async (returnDate, days) => {
    const result = await resolve({ returnDate });
    expect(result.mappedOffers[0].quote.days).toBe(days);
    expect(result.mappedOffers[0].quote.total).toBe(35 * days);
  });

  test('omits inactive, missing-key, missing-mapping and incomplete-pricing configurations', async () => {
    const invalidContexts = [
      baseContext({ cities: cities.map((row) => row.code === 'larnaca' ? { ...row, is_active: false } : row) }),
      baseContext({ profileCities: profileCities.map((row) => row.city_id === cityId('larnaca') && row.pricing_profile_id === 'profile-larnaca'
        ? { ...row, legacy_pricing_city_key: null }
        : row) }),
      baseContext({ profileCities: profileCities.filter((row) => !(row.city_id === cityId('larnaca') && row.pricing_profile_id === 'profile-larnaca')) }),
      baseContext({ offers: [offer('offer-larnaca', 'larnaca', { price_per_day: null, price_3days: null, price_4_6days: null, price_7_10days: null, price_10plus_days: null })] }),
      baseContext({ profiles: profiles.map((row) => row.id === 'profile-larnaca' ? { ...row, is_active: false } : row) }),
    ];
    for (const context of invalidContexts) {
      const result = await resolve({}, context);
      expect(result.mappedOffers).toEqual([]);
      expect(result.diagnostics.some((entry: any) => entry.code === 'INVALID_MAPPED_CONFIGURATION')).toBe(true);
    }
  });

  test('preserves capacity, language, type, transmission, fuel and young-driver filters while ignoring stock', async () => {
    const filteredOffer = offer('offer-larnaca', 'larnaca', {
      max_passengers: 3, transmission: 'manual', fuel_type: 'hybrid', stock_count: 0,
    });
    const context = baseContext({ offers: [filteredOffer], availability: [availability('offer-larnaca', 'larnaca')] });
    const accepted = await resolve({
      passengers: 3,
      youngDriver: true,
      filters: {
        platform: 'homepage', carType: 'Economy', transmission: 'manual', fuel: 'hybrid',
        isLanguageEligible: () => true,
      },
    }, context);
    expect(accepted.mappedOffers.map((row: any) => row.id)).toEqual(['offer-larnaca']);
    const rejected = await resolve({ passengers: 4 }, context);
    expect(rejected.mappedOffers).toEqual([]);
  });

  test('sorts by quote.total and keeps the same-offer quote exactly equal to legacy', async () => {
    const cheap = offer('offer-cheap', 'larnaca', { price_per_day: 20, sort_order: 100 });
    const expensive = offer('offer-expensive', 'larnaca', { price_per_day: 40, sort_order: 1 });
    const context = baseContext({
      offers: [expensive, cheap],
      availability: [availability('offer-cheap', 'larnaca'), availability('offer-expensive', 'larnaca')],
    });
    const legacyOffers = [cheap, expensive];
    const result = await resolve({ legacyOffers }, context);
    expect(result.mappedOffers.map((row: any) => row.id)).toEqual(['offer-cheap', 'offer-expensive']);
    expect(result.comparison.priceMismatches).toEqual([]);
    expect(result.comparison.commonOfferIds).toEqual(['offer-cheap', 'offer-expensive']);
  });

  test('feature flag false performs no mapped read and renderedOffers remains the exact legacy array', async () => {
    const legacyOffers = [offer('legacy-one')];
    let mappedReads = 0;
    const repository = {
      getFeatureFlag: async () => false,
      readMappedContext: async () => { mappedReads += 1; return baseContext(); },
      getMetrics: () => ({ requests: 1, responseBytes: 8, durationMs: 1, queries: [] }),
    };
    const result = await adapter.resolveCarRentalAvailability({
      ...input({ mode: 'shadow' }), legacyOffers, repository,
    });
    expect(mappedReads).toBe(0);
    expect(result.legacyOffers).toBe(legacyOffers);
    expect(result.renderedOffers).toBe(legacyOffers);
    expect(result.mappedOffers).toEqual([]);
  });

  test('a shadow read failure is diagnostic-only and cannot replace the legacy result', async () => {
    const legacyOffers = [offer('legacy-one')];
    const repository = {
      getFeatureFlag: async () => { throw new Error('isolated read failure'); },
      getMetrics: () => ({ requests: 1, responseBytes: 0, durationMs: 1, queries: [] }),
    };
    const result = await adapter.resolveCarRentalAvailability({
      ...input({ mode: 'shadow' }), legacyOffers, repository,
    });
    expect(result.renderedOffers).toBe(legacyOffers);
    expect(result.mappedOffers).toEqual([]);
    expect(result.diagnostics.some((entry: any) => entry.code === 'SHADOW_READ_FAILED')).toBe(true);
  });

  test('homepage/car-page north difference is explicit and never silently unified', async () => {
    const northFalse = offer('north-false', 'larnaca', { north_allowed: false });
    const context = baseContext({ offers: [northFalse], availability: [availability('north-false', 'larnaca')] });
    const homepage = await resolve({ filters: { platform: 'homepage' } }, context);
    expect(homepage.mappedOffers).toHaveLength(1);
    expect(homepage.diagnostics.some((entry: any) => entry.code === 'HOMEPAGE_CAR_PAGE_NORTH_ALLOWED_DIFFERENCE')).toBe(true);
    const carPage = await resolve({ filters: { platform: 'car-page' } }, context);
    expect(carPage.mappedOffers).toEqual([]);
  });

  test('never returns mapped offers as rendered Stage 2D output', async () => {
    const legacyOffers = [offer('offer-larnaca')];
    const result = await resolve({ legacyOffers });
    expect(result.renderedOffers).toBe(legacyOffers);
    expect(result.renderedOffers).not.toBe(result.mappedOffers);
  });

  test('shadow fingerprint changes when a current public filter changes', () => {
    const base = input({
      legacyOffers: [offer('offer-larnaca')],
      filters: { platform: 'homepage', allowedOfferIds: [] },
    });
    const savedOnly = {
      ...base,
      filters: { ...base.filters, allowedOfferIds: ['offer-larnaca'] },
    };
    expect(adapter.buildCarRentalAvailabilityInputFingerprint(savedOnly))
      .not.toBe(adapter.buildCarRentalAvailabilityInputFingerprint(base));
  });
});

describe('Car Rental Multi-City Stage 2D 36-pair shadow matrix', () => {
  test('covers 144 route/duration combinations with classified differences and no price regression', async () => {
    let combinations = 0;
    const reasonCodes = new Set<string>();
    for (const pickupCityCode of CITY_CODES) {
      for (const returnCityCode of CITY_CODES) {
        for (const days of [3, 4, 7, 11]) {
          const legacyOffers = pickupCityCode === 'paphos' && returnCityCode === 'paphos'
            ? [offer('offer-paphos', 'paphos')]
            : [offer('offer-larnaca')];
          const result = await resolve({
            pickupCityCode,
            returnCityCode,
            returnDate: `2026-09-${String(1 + days).padStart(2, '0')}`,
            legacyOffers,
          });
          combinations += 1;
          for (const difference of result.comparison.differences) reasonCodes.add(difference.code);
          expect(result.comparison.priceMismatches).toEqual([]);
          expect(result.comparison.orderMismatches).toEqual([]);
          expect(result.comparison.unexplainedDifferences).toEqual([]);
          expect(new Set(result.mappedOffers.map((row: any) => row.id)).size).toBe(result.mappedOffers.length);
          expect(result.renderedOffers).toBe(legacyOffers);
          expect(result.comparison.differences.every((entry: any) => typeof entry.code === 'string' && entry.code.length > 0)).toBe(true);
        }
      }
    }
    expect(combinations).toBe(144);
    expect(reasonCodes).toEqual(new Set(['MAPPED_ONLY_OFFER', 'EXPECTED_MAPPED_ADDITION']));
  });
});
