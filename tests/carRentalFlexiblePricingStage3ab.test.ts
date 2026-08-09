import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadGlobal(relative: string, globalName: string): any {
  const filename = path.join(process.cwd(), relative);
  const context: Record<string, unknown> = {};
  const source = fs.readFileSync(filename, 'utf8').replace(/\bexport\s+/g, '');
  vm.runInNewContext(source, context, { filename });
  return context[globalName];
}

const core = loadGlobal('admin/car-rental-multicity-core.js', 'CarRentalMulticityCore');
const duration = loadGlobal('js/car-rental-duration-contract.js', 'CarRentalDurationContract');

const baseTiers = [
  { id: 'tier-1', offer_id: 'offer-1', threshold_days: 1, daily_rate: 50, is_active: true },
  { id: 'tier-3', offer_id: 'offer-1', threshold_days: 3, daily_rate: 45, is_active: true },
  { id: 'tier-7', offer_id: 'offer-1', threshold_days: 7, daily_rate: 40, is_active: true },
];

function thresholdContext(overrides: Record<string, unknown> = {}) {
  const offer = {
    id: 'offer-1',
    updated_at: 'offer-v1',
    pricing_strategy: 'threshold_daily_rate',
    min_rental_days: 1,
    max_rental_days: null,
    pricing_profile_id: 'profile-paphos',
    location: 'paphos',
    availability_mode: 'legacy',
    vehicle_kind_id: 'kind-car',
    car_model: { en: 'Exact offer' },
    car_type: { en: 'Compact' },
    description: { en: '' },
    features: { en: [] },
    transmission: 'automatic',
    fuel_type: 'petrol',
    max_passengers: 4,
    max_luggage: 2,
    stock_count: 1,
    sort_order: 1,
    is_available: true,
    north_allowed: true,
    image_url: null,
    currency: 'EUR',
    price_per_day: 35,
    price_3days: 100,
    price_4_6days: 90,
    price_7_10days: 80,
    price_10plus_days: 70,
    insurance_mode: 'legacy_optional_daily',
    insurance_per_day: 17,
    young_driver_fee: false,
    young_driver_cost: 0,
    owner_partner_id: null,
  };
  return {
    offer,
    profiles: [{
      id: 'profile-paphos', code: 'paphos', calculator_key: 'paphos',
      legacy_booking_location: 'paphos', is_active: true, updated_at: 'profile-v1',
    }],
    profileCities: [],
    cities: [{ id: 'city-larnaca', code: 'larnaca', is_active: true, updated_at: 'city-v1' }],
    availability: [{
      offer_id: 'offer-1', city_id: 'city-larnaca', pickup_enabled: true,
      return_enabled: true, is_active: true, fee_mode: 'inherit',
      fee_per_direction: null, updated_at: 'availability-v1',
    }],
    dailyRateTiers: baseTiers,
    vehicleKinds: [
      { id: 'kind-car', code: 'car', is_active: true },
      { id: 'kind-buggy', code: 'buggy', is_active: true },
      { id: 'kind-quad', code: 'quad', is_active: true },
      { id: 'kind-scooter', code: 'scooter', is_active: true },
      { id: 'kind-bicycle', code: 'bicycle', is_active: true },
    ],
    partners: [],
    partnerResources: [],
    depositRule: null,
    depositOverride: null,
    siteSetting: {
      car_multi_city_mapped_enabled: false,
      car_threshold_daily_rates_enabled: false,
    },
    ...overrides,
  };
}

describe('Stage 3A/3B exact-offer threshold daily-rate contract', () => {
  test.each([
    [1, 50],
    [2, 100],
    [3, 135],
    [4, 180],
    [6, 270],
    [7, 280],
    [10, 400],
  ])('%i rental day(s) select one rate for the complete period', (rentalDays, expectedBase) => {
    expect(core.calculateThresholdBasePrice(baseTiers, rentalDays)).toEqual(expect.objectContaining({
      rentalDays,
      dailyRate: rentalDays >= 7 ? 40 : rentalDays >= 3 ? 45 : 50,
      baseRentalPrice: expectedBase,
    }));
  });

  test('a missing lower tier blocks every shorter rental', () => {
    const tiers = [{ threshold_days: 3, daily_rate: 50, is_active: true }];
    expect(core.effectiveThresholdMinimum(tiers)).toBe(3);
    expect(core.calculateThresholdBasePrice(tiers, 1)).toBeNull();
    expect(core.calculateThresholdBasePrice(tiers, 2)).toBeNull();
    expect(core.calculateThresholdBasePrice(tiers, 3)?.baseRentalPrice).toBe(150);
  });

  test.each([1, 3, 5])('first active threshold %i is the effective minimum', (threshold) => {
    expect(core.effectiveThresholdMinimum([
      { threshold_days: threshold, daily_rate: 40, is_active: true },
      { threshold_days: threshold + 5, daily_rate: 35, is_active: true },
    ])).toBe(threshold);
  });

  test('adding and deleting the lowest tier synchronizes structural min_rental_days', () => {
    const draft = core.createDraft(thresholdContext({
      dailyRateTiers: baseTiers.filter((tier) => tier.threshold_days >= 3),
      offer: { ...thresholdContext().offer, min_rental_days: 3 },
    }), { mode: 'pricing' });
    expect(draft.pricing.minRentalDays).toBe(3);
    const inserted = core.addDailyRateTier(draft, { threshold_days: 1, daily_rate: 50, is_active: true });
    expect(draft.pricing.minRentalDays).toBe(1);
    core.removeDailyRateTier(draft, inserted.clientKey);
    expect(draft.pricing.minRentalDays).toBe(3);
  });

  test('editing the lowest threshold synchronizes the minimum and keeps arbitrary thresholds sorted', () => {
    const ctx = thresholdContext();
    const draft = core.createDraft(ctx, { mode: 'pricing' });
    core.updateDailyRateTier(draft, 'tier-1', { threshold_days: 2, daily_rate: 48 });
    core.addDailyRateTier(draft, { threshold_days: 21, daily_rate: 30 });
    core.addDailyRateTier(draft, { threshold_days: 14, daily_rate: 32 });
    expect(draft.pricing.minRentalDays).toBe(2);
    expect(draft.pricing.dailyRateTiers.map((tier: any) => tier.threshold_days)).toEqual([2, 3, 7, 14, 21]);
  });

  test('highest threshold continues indefinitely and an explicit maximum rejects longer rentals', () => {
    expect(core.calculateThresholdBasePrice(baseTiers, 30)?.baseRentalPrice).toBe(1200);
    expect(core.calculateThresholdBasePrice(baseTiers, 10, null)?.baseRentalPrice).toBe(400);
    expect(core.calculateThresholdBasePrice(baseTiers, 11, 10)).toBeNull();
  });

  test('the selected threshold rate never blends with earlier rates', () => {
    const quote = core.calculateThresholdBasePrice(baseTiers, 7);
    expect(quote).toEqual(expect.objectContaining({ thresholdDays: 7, dailyRate: 40, baseRentalPrice: 280 }));
    expect(quote.baseRentalPrice).not.toBe(50 + (2 * 45) + (4 * 40));
  });

  test('converted source totals reproduce the source without storing total prices as daily_rate', () => {
    const sourceTotals = [110, 190, 270, 340, 400, 450, 490];
    const converted = sourceTotals.map((total, index) => ({
      threshold_days: index + 1,
      daily_rate: total / (index + 1),
      is_active: true,
    }));
    sourceTotals.forEach((total, index) => {
      expect(core.calculateThresholdBasePrice(converted, index + 1)?.baseRentalPrice).toBe(total);
    });
  });

  test('vehicle kind does not control strategy or minimum', () => {
    const context = thresholdContext();
    const draft = core.createDraft(context, { mode: 'pricing' });
    for (const kind of ['car', 'buggy', 'quad', 'scooter', 'bicycle']) {
      draft.vehicle.vehicleKindId = `kind-${kind}`;
      expect(core.validateDraft(draft, context).valid).toBe(true);
      expect(draft.pricing.minRentalDays).toBe(1);
      expect(draft.pricing.strategy).toBe('threshold_daily_rate');
    }
  });

  test('threshold availability is exact city configuration and does not require a profile-city mapping', () => {
    const context = thresholdContext();
    const draft = core.createDraft(context, { mode: 'availability' });
    expect(core.getMappedReadiness(draft, context)).toEqual(expect.objectContaining({ ready: true }));
    expect(core.validateDraft(draft, context).errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'pricingProfileId' }),
    ]));
  });

  test('young-driver and insurance configuration are exact-offer changes for any profile', () => {
    const context = thresholdContext();
    const draft = core.createDraft(context, { mode: 'pricing' });
    draft.pricing.youngDriverFee = true;
    draft.pricing.youngDriverCost = 12;
    draft.pricing.insuranceMode = 'not_offered';
    draft.pricing.insurancePerDay = 0;
    const plan = core.buildReviewPlan(draft, context, 'pricing');
    const offerStep = plan.steps.find((step: any) => step.type === 'car_offer');
    expect(offerStep.payload).toEqual(expect.objectContaining({
      young_driver_fee: true,
      young_driver_cost: 12,
      insurance_mode: 'not_offered',
      insurance_per_day: 0,
    }));
    expect(offerStep.payload).not.toHaveProperty('location');
    expect(offerStep.payload).not.toHaveProperty('pricing_profile_id');
  });
});

describe('shared exact 24-hour duration foundation', () => {
  test('exact 24 hours is one day and 24 hours 30 minutes is two days', () => {
    expect(duration.calculateRentalDaysFromInstants('2026-08-10T10:00:00+03:00', '2026-08-11T10:00:00+03:00')).toBe(1);
    expect(duration.calculateRentalDaysFromInstants('2026-08-10T10:00:00+03:00', '2026-08-11T10:30:00+03:00')).toBe(2);
  });

  test('explicit instants make the DST elapsed-time decision deterministic', () => {
    expect(duration.calculateRentalDaysFromInstants('2026-03-28T10:00:00+02:00', '2026-03-29T10:00:00+03:00')).toBe(1);
    expect(duration.calculateRentalDaysFromInstants('2026-10-24T10:00:00+03:00', '2026-10-25T10:00:00+02:00')).toBe(2);
    expect(duration.calculateRentalDaysFromLocalDateTimes({
      pickupDate: '2026-03-28', pickupTime: '10:00', returnDate: '2026-03-29', returnTime: '10:00',
    })).toBe(1);
    expect(duration.calculateRentalDaysFromLocalDateTimes({
      pickupDate: '2026-10-24', pickupTime: '10:00', returnDate: '2026-10-25', returnTime: '10:00',
    })).toBe(2);
  });

  test('timezone-less strings and non-positive durations are rejected safely', () => {
    expect(() => duration.calculateRentalDaysFromInstants('2026-08-10T10:00:00', '2026-08-11T10:00:00'))
      .toThrow('explicit timezone offset');
    expect(duration.calculateRentalDaysFromInstants('2026-08-11T10:00:00Z', '2026-08-10T10:00:00Z')).toBeNull();
  });
});
