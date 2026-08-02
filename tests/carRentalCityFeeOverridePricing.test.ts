import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadPricing(): any {
  const filename = path.join(process.cwd(), 'js/car-pricing.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, '');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(`${source}\n;globalThis.CarPricingV2 = { calculateCarRentalQuote };`, context, { filename });
  return context.CarPricingV2;
}

const pricing = loadPricing();

function quote(overrides: Record<string, unknown> = {}) {
  return pricing.calculateCarRentalQuote({
    pricingMatrix: [105, 35, 35, 35],
    offer: 'larnaca',
    carModel: 'Exact fixture',
    pickupDateStr: '2026-09-01',
    returnDateStr: '2026-09-04',
    pickupLocation: 'paphos',
    returnLocation: 'paphos',
    offerRow: { young_driver_fee: true, young_driver_cost: 10 },
    ...overrides,
  });
}

describe('per-offer city fee seam in the existing Cars calculator', () => {
  test('omitting both overrides preserves the exact legacy quote', () => {
    expect(quote()).toEqual({
      offer: 'larnaca',
      days: 3,
      basePrice: 105,
      dailyRate: 0,
      pickupFee: 40,
      returnFee: 40,
      insuranceCost: 0,
      youngDriverCost: 0,
      youngDriverAllowed: true,
      youngDriverApplied: false,
      youngDriverDailyRate: 10,
      total: 185,
      car: 'Exact fixture',
      pickupLoc: 'paphos',
      returnLoc: 'paphos',
    });
  });

  test.each([
    [0, 0, 105],
    [12.5, 0, 117.5],
    [0, 18, 123],
    [12.5, 18, 135.5],
  ])('applies pickup %s and return %s independently', (pickupFeeOverride, returnFeeOverride, total) => {
    expect(quote({ pickupFeeOverride, returnFeeOverride })).toEqual(expect.objectContaining({
      basePrice: 105,
      pickupFee: pickupFeeOverride,
      returnFee: returnFeeOverride,
      total,
    }));
  });

  test('override changes no insurance or young-driver calculation', () => {
    expect(quote({
      pickupFeeOverride: 0,
      returnFeeOverride: 0,
      fullInsurance: true,
      youngDriver: true,
    })).toEqual(expect.objectContaining({
      basePrice: 105,
      pickupFee: 0,
      returnFee: 0,
      insuranceCost: 51,
      youngDriverCost: 30,
      total: 186,
    }));
  });

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 1.234])('rejects invalid fee override %s', (invalid) => {
    expect(quote({ pickupFeeOverride: invalid })).toBeNull();
  });
});
