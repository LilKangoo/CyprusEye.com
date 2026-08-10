import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(
  path.join(root, 'supabase/manual/speedbikes_catalogue_manifest.json'),
  'utf8',
));

const SNIPPER_ID = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
const SPEED_BIKES_PARTNER_ID = '583ee90b-d77c-47ff-97a4-76657a87809f';
const AYIA_NAPA_CITY_ID = 'ca200001-0000-4000-8000-000000000003';
const snipper = manifest.offers.find((offer: any) => offer.offerId === SNIPPER_ID);

function moduleToScript(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, '');
}

function loadRuntime(): any {
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(moduleToScript('js/car-pricing.js'), context, { filename: 'js/car-pricing.js' });
  vm.runInContext(moduleToScript('js/car-rental-flow.js'), context, { filename: 'js/car-rental-flow.js' });
  vm.runInContext(moduleToScript('js/car-rental-duration-contract.js'), context, {
    filename: 'js/car-rental-duration-contract.js',
  });
  vm.runInContext(moduleToScript('js/car-rental-threshold-pricing.js'), context, {
    filename: 'js/car-rental-threshold-pricing.js',
  });
  vm.runInContext(moduleToScript('js/car-rental-public-eligibility.js'), context, {
    filename: 'js/car-rental-public-eligibility.js',
  });
  vm.runInContext(`${moduleToScript('js/car-rental-availability-adapter.js')}
    globalThis.SnipperRuntime = {
      resolveCarRentalAvailability,
      evaluateCarOfferPublicEligibility,
      validateCarThresholdTierConfiguration,
    };`, context, { filename: 'js/car-rental-availability-adapter.js' });
  return context.SnipperRuntime;
}

const runtime = loadRuntime();
const tiers = Object.entries(snipper.dailyRates).map(([days, dailyRate]) => ({
  id: snipper.tierIds[days],
  offer_id: SNIPPER_ID,
  threshold_days: Number(days),
  daily_rate: dailyRate,
  is_active: true,
}));
const city = {
  id: AYIA_NAPA_CITY_ID,
  code: 'ayia-napa',
  name_i18n: { en: 'Ayia Napa' },
  is_active: true,
  sort_order: 3,
};
const availability = {
  offer_id: SNIPPER_ID,
  city_id: AYIA_NAPA_CITY_ID,
  pickup_enabled: true,
  return_enabled: true,
  is_active: true,
  fee_mode: 'override',
  fee_per_direction: 0,
};

function snipperOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: SNIPPER_ID,
    car_model: { en: 'Snipper FX', pl: 'Snipper FX', he: 'Snipper FX' },
    car_type: { en: 'Buggy', pl: 'Buggy', he: 'באגי' },
    description: { en: 'Isolated exact offer fixture' },
    features: { en: ['Helmet included'] },
    location: 'larnaca',
    pricing_profile_id: null,
    pricing_strategy: 'threshold_daily_rate',
    availability_mode: 'mapped',
    is_available: true,
    is_published: true,
    submission_status: 'approved',
    stock_count: 1,
    sort_order: 5,
    owner_partner_id: SPEED_BIKES_PARTNER_ID,
    min_rental_days: 1,
    max_rental_days: null,
    max_passengers: 2,
    max_luggage: null,
    transmission: 'automatic',
    fuel_type: 'petrol',
    engine_capacity_cc: 400,
    required_licence_category: 'B',
    minimum_driver_age: 18,
    insurance_mode: 'included',
    insurance_per_day: 0,
    young_driver_fee: false,
    young_driver_cost: 0,
    currency: 'EUR',
    ...overrides,
  };
}

function mappedContext(offer = snipperOffer()) {
  return {
    cities: [city],
    availability: [{ ...availability }],
    offers: [offer],
    profiles: [],
    profileCities: [],
    dailyRateTiers: tiers.map((tier: any) => ({ ...tier })),
    publicEligibleThresholdOfferIds: [SNIPPER_ID],
    thresholdEligibilityAuthoritative: true,
    metrics: { requests: 6, responseBytes: 0, durationMs: 0, queries: [] },
  };
}

function repository(context = mappedContext()) {
  return {
    getFeatureFlags: async () => ({ mappedEnabled: true, thresholdDailyRatesEnabled: true }),
    readMappedContext: async () => context,
    getMetrics: () => context.metrics,
  };
}

function returnDateForDays(days: number) {
  return new Date(Date.UTC(2026, 9, 1 + days, 10, 0, 0)).toISOString().slice(0, 10);
}

async function resolveFor(days: number, platform: 'car-page' | 'homepage') {
  const context = mappedContext();
  return runtime.resolveCarRentalAvailability({
    mode: 'hybrid',
    repository: repository(context),
    legacyOffers: [],
    pickupCityCode: 'ayia-napa',
    returnCityCode: 'ayia-napa',
    pickupPlaceType: 'hotel',
    returnPlaceType: 'hotel',
    pickupDate: '2026-10-01',
    pickupTime: '10:00',
    returnDate: returnDateForDays(days),
    returnTime: '10:00',
    passengers: 2,
    fullInsurance: false,
    youngDriver: false,
    language: 'en',
    filters: { platform },
  });
}

describe('exact Snipper end-to-end Cars contract', () => {
  test.each([
    [1, 110], [2, 190], [3, 270], [4, 340], [5, 400],
    [6, 450], [7, 490], [8, 560], [10, 700], [14, 980],
  ])('%i day(s) resolves the confirmed Snipper total %i through the shared hybrid adapter', async (days, total) => {
    const result = await resolveFor(days, 'car-page');
    expect(result.renderedOffers).toHaveLength(1);
    expect(result.renderedOffers[0]).toEqual(expect.objectContaining({
      id: SNIPPER_ID,
      quote: expect.objectContaining({ days, basePrice: total, total }),
      pricingContext: expect.objectContaining({
        offerId: SNIPPER_ID,
        pricingStrategy: 'threshold_daily_rate',
        availabilityMode: 'mapped',
        pickupCityCode: 'ayia-napa',
        returnCityCode: 'ayia-napa',
      }),
    }));
    expect(result.comparison.priceMismatches).toEqual([]);
    expect(result.comparison.unexplainedDifferences).toEqual([]);
  });

  test('the same immutable exact-offer quote is returned for /car and homepage and final totals stay ascending', async () => {
    const [carPage, homepage] = await Promise.all([
      resolveFor(7, 'car-page'),
      resolveFor(7, 'homepage'),
    ]);
    const summarize = (result: any) => result.renderedOffers.map((offer: any) => ({
      id: offer.id,
      total: offer.quote.total,
      context: offer.pricingContext,
    }));
    expect(summarize(carPage)).toEqual(summarize(homepage));
    expect(summarize(carPage)).toEqual([expect.objectContaining({ id: SNIPPER_ID, total: 490 })]);
    for (const result of [carPage, homepage]) {
      const totals = result.renderedOffers.map((offer: any) => offer.quote.total);
      expect(totals).toEqual([...totals].sort((left, right) => left - right));
      expect(new Set(result.renderedOffers.map((offer: any) => offer.id)).size)
        .toBe(result.renderedOffers.length);
    }
  });

  test('hybrid customer order uses final quote.total rather than threshold or daily rate metadata', async () => {
    const competitorId = 'cae30000-0000-4000-8000-000000000002';
    const context = mappedContext();
    context.offers.push(snipperOffer({
      id: competitorId,
      car_model: { en: 'Higher total exact offer' },
      owner_partner_id: 'cae30000-0000-4000-8000-000000000003',
      sort_order: 1,
    }));
    context.availability.push({ ...availability, offer_id: competitorId });
    context.dailyRateTiers.push({
      id: 'cae30000-0000-4000-8000-000000000004',
      offer_id: competitorId,
      threshold_days: 1,
      daily_rate: 200,
      is_active: true,
    });
    context.publicEligibleThresholdOfferIds.push(competitorId);
    const result = await runtime.resolveCarRentalAvailability({
      mode: 'hybrid',
      repository: repository(context),
      legacyOffers: [],
      pickupCityCode: 'ayia-napa',
      returnCityCode: 'ayia-napa',
      pickupDate: '2026-10-01',
      pickupTime: '10:00',
      returnDate: '2026-10-08',
      returnTime: '10:00',
      passengers: 2,
      language: 'en',
      filters: { platform: 'homepage' },
    });
    expect(result.renderedOffers.map((offer: any) => [offer.id, offer.quote.total])).toEqual([
      [SNIPPER_ID, 490],
      [competitorId, 1400],
    ]);
  });

  test('validated exact activation changes only visibility; deactivation returns to READY without changing partner or payment rules', () => {
    const baseInput = {
      dailyRateTiers: tiers,
      availabilityRows: [availability],
      cities: [city],
      partners: [{
        id: SPEED_BIKES_PARTNER_ID,
        status: 'active',
        can_manage_cars: true,
      }],
      siteSetting: {
        car_multi_city_mapped_enabled: true,
        car_threshold_daily_rates_enabled: true,
      },
      pickupCityCode: 'ayia-napa',
      returnCityCode: 'ayia-napa',
    };
    const readyOffer = snipperOffer({ is_published: false });
    expect(runtime.validateCarThresholdTierConfiguration(readyOffer, tiers))
      .toEqual(expect.objectContaining({ valid: true, minimumDays: 1 }));
    const ready = runtime.evaluateCarOfferPublicEligibility({ ...baseInput, offer: readyOffer });
    const liveOffer = { ...readyOffer, is_published: true };
    const live = runtime.evaluateCarOfferPublicEligibility({ ...baseInput, offer: liveOffer });
    const rolledBack = runtime.evaluateCarOfferPublicEligibility({
      ...baseInput,
      offer: { ...liveOffer, is_published: false },
    });
    expect(ready.reasons.filter((reason: any) => [
      'ACTIVE_TIER_REQUIRED',
      'INVALID_TIER_CONFIGURATION',
      'MINIMUM_TIER_MISMATCH',
      'MAXIMUM_BELOW_MINIMUM',
      'ACTIVE_PICKUP_REQUIRED',
      'ACTIVE_RETURN_REQUIRED',
      'PICKUP_ROUTE_UNAVAILABLE',
      'RETURN_ROUTE_UNAVAILABLE',
      'CITY_FEE_INVALID',
      'EXACT_ACTIVE_PARTNER_REQUIRED',
    ].includes(reason.code))).toEqual([]);
    expect([ready.status, live.status, rolledBack.status]).toEqual(['READY', 'LIVE', 'READY']);
    expect([ready.publicEligible, live.publicEligible, rolledBack.publicEligible])
      .toEqual([false, true, false]);
    expect(liveOffer.owner_partner_id).toBe(SPEED_BIKES_PARTNER_ID);
    expect(manifest.importDefaults).toEqual(expect.objectContaining({
      depositMode: 'percent_total',
      depositAmount: 15,
    }));
  });

  test('the exact 15 percent part-payment is independent from manual partner acceptance', () => {
    const bookingTotal = 490;
    const paidNow = Number((bookingTotal * 0.15).toFixed(2));
    const workflow = {
      offerId: SNIPPER_ID,
      partnerId: SPEED_BIKES_PARTNER_ID,
      bookingStatus: 'pending',
      fulfillmentStatus: 'pending_acceptance',
      paymentStatus: paidNow < bookingTotal ? 'partial' : 'paid',
      paidNow,
      remaining: Number((bookingTotal - paidNow).toFixed(2)),
    };
    expect(workflow).toEqual({
      offerId: SNIPPER_ID,
      partnerId: SPEED_BIKES_PARTNER_ID,
      bookingStatus: 'pending',
      fulfillmentStatus: 'pending_acceptance',
      paymentStatus: 'partial',
      paidNow: 73.5,
      remaining: 416.5,
    });
    expect(workflow.bookingStatus).not.toBe('confirmed');
    expect(workflow.fulfillmentStatus).not.toBe('accepted');
  });

  test('the real isolated PostgREST gate exercises the exact Snipper partner/payment lifecycle and cleanup', () => {
    const gate = fs.readFileSync(
      path.join(root, 'tests/integration/speedbikes-catalogue-postgrest-gate.mjs'),
      'utf8',
    );
    expect(gate).toContain(`const EXACT_OWNER_GUARD_OFFER_ID = '${SNIPPER_ID}'`);
    expect(gate).toContain(`const SPEED_BIKES_PARTNER_ID = '${SPEED_BIKES_PARTNER_ID}'`);
    expect(gate).toContain('[6, 450], [7, 490], [8, 560], [10, 700], [14, 980]');
    expect(gate).toContain("status: 'pending_acceptance'");
    expect(gate).toContain("paymentStatus: 'partial'");
    expect(gate).toContain('remaining: 416.50');
    expect(gate).toContain("'cleanup exact Snipper booking'");
  });
});
