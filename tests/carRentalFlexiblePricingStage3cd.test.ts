import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function moduleToScript(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8')
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, '');
}

function loadPricingRuntime(): any {
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(moduleToScript('js/car-pricing.js'), context, { filename: 'js/car-pricing.js' });
  vm.runInContext(moduleToScript('js/car-rental-duration-contract.js'), context, { filename: 'js/car-rental-duration-contract.js' });
  vm.runInContext(`${moduleToScript('js/car-rental-threshold-pricing.js')}
    globalThis.Stage3cdPricing = {
      calculateThresholdCarRentalQuote,
      selectThresholdDailyRateTier,
      normalizeThresholdCityCode,
    };`, context, { filename: 'js/car-rental-threshold-pricing.js' });
  return context.Stage3cdPricing;
}

const runtime = loadPricingRuntime();
const tiers = [
  { id: 'tier-1', offer_id: 'offer-1', threshold_days: 1, daily_rate: 50, is_active: true },
  { id: 'tier-3', offer_id: 'offer-1', threshold_days: 3, daily_rate: 45, is_active: true },
  { id: 'tier-7', offer_id: 'offer-1', threshold_days: 7, daily_rate: 40, is_active: true },
];

function quote(overrides: Record<string, unknown> = {}) {
  return runtime.calculateThresholdCarRentalQuote({
    offer: {
      id: 'offer-1',
      location: 'larnaca',
      pricing_strategy: 'threshold_daily_rate',
      min_rental_days: 1,
      max_rental_days: null,
      currency: 'EUR',
      insurance_mode: 'optional_daily',
      insurance_per_day: 12,
      young_driver_fee: true,
      young_driver_cost: 8,
    },
    tiers,
    pickupDateStr: '2026-10-01',
    pickupTimeStr: '10:00',
    returnDateStr: '2026-10-11',
    returnTimeStr: '10:00',
    pickupCityCode: 'larnaca',
    returnCityCode: 'paphos',
    pickupAvailability: { fee_mode: 'inherit', fee_per_direction: null },
    returnAvailability: { fee_mode: 'override', fee_per_direction: 25 },
    fullInsurance: true,
    youngDriver: true,
    carModel: 'Exact threshold car',
    ...overrides,
  });
}

describe('Stage 3C/3D shared threshold runtime', () => {
  test.each([
    [1, 50, 50],
    [2, 50, 100],
    [3, 45, 135],
    [4, 45, 180],
    [6, 45, 270],
    [7, 40, 280],
    [10, 40, 400],
    [14, 40, 560],
  ])('%i day(s) use one selected daily rate for the complete period', (days, rate, base) => {
    const tier = runtime.selectThresholdDailyRateTier(tiers, days);
    expect(tier.dailyRate).toBe(rate);
    expect(tier.dailyRate * days).toBe(base);
  });

  test('the immutable quote contains exact tier, directional fees and exact-offer options', () => {
    const result = quote();
    expect(result).toEqual(expect.objectContaining({
      days: 10,
      tierId: 'tier-7',
      thresholdDays: 7,
      dailyRate: 40,
      basePrice: 400,
      pickupFee: 0,
      returnFee: 25,
      insuranceCost: 120,
      youngDriverCost: 80,
      total: 625,
    }));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.pricingSnapshot)).toBe(true);
  });

  test.each([
    [0, 0],
    [25, 25],
  ])('an exact offer-city override of %i is applied per direction', (amount, expected) => {
    const result = quote({
      pickupAvailability: { fee_mode: 'override', fee_per_direction: amount },
      returnAvailability: { fee_mode: 'override', fee_per_direction: amount },
    });
    expect(result.pickupFee).toBe(expected);
    expect(result.returnFee).toBe(expected);
  });

  test('a custom city without explicit fee fails closed and override zero is valid', () => {
    expect(quote({
      pickupCityCode: 'polis-custom',
      pickupAvailability: { fee_mode: 'inherit', fee_per_direction: null },
    })).toBeNull();
    expect(quote({
      pickupCityCode: 'polis-custom',
      pickupAvailability: { fee_mode: 'override', fee_per_direction: 0 },
    })?.pickupFee).toBe(0);
  });

  test('minimum and optional maximum are exact-offer contracts', () => {
    expect(quote({
      offer: {
        id: 'offer-1', pricing_strategy: 'threshold_daily_rate', location: 'larnaca',
        min_rental_days: 3, max_rental_days: null, currency: 'EUR',
        insurance_mode: 'not_offered', insurance_per_day: 0,
        young_driver_fee: false, young_driver_cost: 0,
      },
      tiers: tiers.filter((tier: any) => tier.threshold_days >= 3),
      returnDateStr: '2026-10-02',
      returnCityCode: 'larnaca',
      returnAvailability: { fee_mode: 'inherit' },
      fullInsurance: false,
      youngDriver: false,
    })).toBeNull();
    expect(quote({
      offer: {
        id: 'offer-1', pricing_strategy: 'threshold_daily_rate', location: 'larnaca',
        min_rental_days: 1, max_rental_days: 9, currency: 'EUR',
        insurance_mode: 'not_offered', insurance_per_day: 0,
        young_driver_fee: false, young_driver_cost: 0,
      },
      fullInsurance: false,
      youngDriver: false,
    })).toBeNull();
  });

  test('young-driver and insurance are exact-offer settings rather than profile settings', () => {
    expect(quote({
      offer: {
        id: 'offer-1', pricing_strategy: 'threshold_daily_rate', location: 'paphos',
        min_rental_days: 1, max_rental_days: null, currency: 'EUR',
        insurance_mode: 'optional_daily', insurance_per_day: 5,
        young_driver_fee: true, young_driver_cost: 3,
      },
    })).toEqual(expect.objectContaining({ insuranceCost: 50, youngDriverCost: 30 }));
  });

  test('exact Cyprus wall time uses ceil of elapsed 24-hour periods', () => {
    const exact = quote({
      returnDateStr: '2026-10-02',
      returnTimeStr: '10:00',
      returnCityCode: 'larnaca',
      returnAvailability: { fee_mode: 'inherit' },
      fullInsurance: false,
      youngDriver: false,
    });
    const over = quote({
      returnDateStr: '2026-10-02',
      returnTimeStr: '10:30',
      returnCityCode: 'larnaca',
      returnAvailability: { fee_mode: 'inherit' },
      fullInsurance: false,
      youngDriver: false,
    });
    expect(exact.days).toBe(1);
    expect(over.days).toBe(2);
  });

  test('Cyprus DST gap fails closed and the repeated hour selects standard time', () => {
    expect(() => runtime.calculateThresholdCarRentalQuote({
      offer: {
        id: 'offer-1', pricing_strategy: 'threshold_daily_rate', location: 'larnaca',
        min_rental_days: 1, max_rental_days: null, currency: 'EUR',
        insurance_mode: 'not_offered', insurance_per_day: 0,
        young_driver_fee: false, young_driver_cost: 0,
      },
      tiers,
      pickupDateStr: '2026-03-29',
      pickupTimeStr: '03:30',
      returnDateStr: '2026-03-30',
      returnTimeStr: '03:30',
      pickupCityCode: 'larnaca',
      returnCityCode: 'larnaca',
      pickupAvailability: { fee_mode: 'inherit' },
      returnAvailability: { fee_mode: 'inherit' },
      fullInsurance: false,
      youngDriver: false,
    })).not.toThrow();
    expect(runtime.calculateThresholdCarRentalQuote({
      offer: {
        id: 'offer-1', pricing_strategy: 'threshold_daily_rate', location: 'larnaca',
        min_rental_days: 1, max_rental_days: null, currency: 'EUR',
        insurance_mode: 'not_offered', insurance_per_day: 0,
        young_driver_fee: false, young_driver_cost: 0,
      },
      tiers,
      pickupDateStr: '2026-03-29',
      pickupTimeStr: '03:30',
      returnDateStr: '2026-03-30',
      returnTimeStr: '03:30',
      pickupCityCode: 'larnaca',
      returnCityCode: 'larnaca',
      pickupAvailability: { fee_mode: 'inherit' },
      returnAvailability: { fee_mode: 'inherit' },
      fullInsurance: false,
      youngDriver: false,
    })).toBeNull();
    expect(quote({
      pickupDateStr: '2026-10-25',
      pickupTimeStr: '03:30',
      returnDateStr: '2026-10-26',
      returnTimeStr: '03:30',
      returnCityCode: 'larnaca',
      returnAvailability: { fee_mode: 'inherit' },
      fullInsurance: false,
      youngDriver: false,
    })?.days).toBe(1);
  });
});
