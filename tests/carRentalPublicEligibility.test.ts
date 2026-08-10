import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function moduleToScript(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8')
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, '');
}

function loadContract(): any {
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(moduleToScript('js/car-pricing.js'), context);
  vm.runInContext(moduleToScript('js/car-rental-duration-contract.js'), context);
  vm.runInContext(moduleToScript('js/car-rental-threshold-pricing.js'), context);
  vm.runInContext(`${moduleToScript('js/car-rental-public-eligibility.js')}
    globalThis.PublicEligibility = {
      evaluateCarOfferPublicEligibility,
      validateCarThresholdTierConfiguration,
    };`, context);
  return context.PublicEligibility;
}

const contract = loadContract();

const cities = [
  { id: 'city-ayia-napa', code: 'ayia-napa', is_active: true },
  { id: 'city-larnaca', code: 'larnaca', is_active: true },
];

const tiers = [
  { id: 'tier-1', offer_id: 'snipper', threshold_days: 1, daily_rate: 110, is_active: true },
  { id: 'tier-3', offer_id: 'snipper', threshold_days: 3, daily_rate: 90, is_active: true },
  { id: 'tier-7', offer_id: 'snipper', threshold_days: 7, daily_rate: 70, is_active: true },
];

const directions = [
  {
    offer_id: 'snipper', city_id: 'city-ayia-napa', is_active: true,
    pickup_enabled: true, return_enabled: false, fee_mode: 'override', fee_per_direction: 0,
  },
  {
    offer_id: 'snipper', city_id: 'city-larnaca', is_active: true,
    pickup_enabled: false, return_enabled: true, fee_mode: 'override', fee_per_direction: 25,
  },
];

function thresholdOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snipper', pricing_strategy: 'threshold_daily_rate', availability_mode: 'mapped',
    is_available: true, is_published: true, submission_status: 'approved', stock_count: 1,
    owner_partner_id: 'speed-bikes', min_rental_days: 1, max_rental_days: null,
    ...overrides,
  };
}

function evaluate(overrides: Record<string, unknown> = {}) {
  return contract.evaluateCarOfferPublicEligibility({
    offer: thresholdOffer(), dailyRateTiers: tiers, availabilityRows: directions, cities,
    partners: [{ id: 'speed-bikes', status: 'active', can_manage_cars: true }],
    siteSetting: {
      car_multi_city_mapped_enabled: true,
      car_threshold_daily_rates_enabled: true,
    },
    pickupCityCode: 'ayia-napa', returnCityCode: 'larnaca',
    ...overrides,
  });
}

describe('shared exact-offer public eligibility contract', () => {
  test('accepts independent pickup-only and return-only cities with custom directional fees', () => {
    const result = evaluate();
    expect(result).toEqual(expect.objectContaining({
      status: 'LIVE', publicEligible: true, configurationReady: true,
      pickupCount: 1, returnCount: 1,
    }));
  });

  test('rejects the reverse route without silently treating directions as paired', () => {
    const result = evaluate({ pickupCityCode: 'larnaca', returnCityCode: 'ayia-napa' });
    expect(result.publicEligible).toBe(false);
    expect(result.reasons.map((reason: any) => reason.code)).toEqual(expect.arrayContaining([
      'PICKUP_ROUTE_UNAVAILABLE',
      'RETURN_ROUTE_UNAVAILABLE',
    ]));
  });

  test.each([
    [{ is_published: false }, 'OFFER_NOT_PUBLISHED'],
    [{ is_available: false }, 'OFFER_NOT_AVAILABLE'],
    [{ stock_count: 0 }, 'OFFER_STOCK_EMPTY'],
    [{ submission_status: 'draft' }, 'OFFER_SUBMISSION_NOT_APPROVED'],
    [{ availability_mode: 'legacy' }, 'OFFER_NOT_MAPPED'],
  ])('fails public eligibility for activation field %p', (offerPatch, reasonCode) => {
    const result = evaluate({ offer: thresholdOffer(offerPatch) });
    expect(result.publicEligible).toBe(false);
    expect(result.reasons.some((reason: any) => reason.code === reasonCode)).toBe(true);
  });

  test('capability flags are authoritative and cannot be replaced by browser state', () => {
    const result = evaluate({
      siteSetting: {
        car_multi_city_mapped_enabled: false,
        car_threshold_daily_rates_enabled: false,
      },
    });
    expect(result).toEqual(expect.objectContaining({ publicEligible: false, capabilityEnabled: false }));
    expect(result.reasons.map((reason: any) => reason.code)).toEqual(expect.arrayContaining([
      'MAPPED_CAPABILITY_DISABLED',
      'THRESHOLD_CAPABILITY_DISABLED',
    ]));
  });

  test('inactive exact partner blocks the modern offer', () => {
    const result = evaluate({
      partners: [{ id: 'speed-bikes', status: 'suspended', can_manage_cars: true }],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons.some((reason: any) => reason.code === 'EXACT_ACTIVE_PARTNER_REQUIRED')).toBe(true);
  });

  test('draft configuration is labelled DRAFT while retaining structural readiness', () => {
    const result = evaluate({
      offer: thresholdOffer({
        availability_mode: 'legacy', is_available: false, is_published: false,
        submission_status: 'draft', stock_count: 1,
      }),
      siteSetting: {
        car_multi_city_mapped_enabled: false,
        car_threshold_daily_rates_enabled: false,
      },
    });
    expect(result).toEqual(expect.objectContaining({
      status: 'DRAFT', configurationReady: true, publicEligible: false,
    }));
  });

  test('a fully configured operational draft is READY even while publication and capability gates remain closed', () => {
    const result = evaluate({
      offer: thresholdOffer({
        availability_mode: 'legacy', is_available: true, is_published: false,
        submission_status: 'draft', stock_count: 1,
      }),
      siteSetting: {
        car_multi_city_mapped_enabled: false,
        car_threshold_daily_rates_enabled: false,
      },
    });
    expect(result).toEqual(expect.objectContaining({
      status: 'READY', configurationReady: true, capabilityEnabled: false, publicEligible: false,
    }));
    expect(result.reasons.map((reason: any) => reason.code)).toEqual(expect.arrayContaining([
      'OFFER_NOT_PUBLISHED',
      'OFFER_SUBMISSION_NOT_APPROVED',
      'OFFER_NOT_MAPPED',
      'MAPPED_CAPABILITY_DISABLED',
      'THRESHOLD_CAPABILITY_DISABLED',
    ]));
  });

  test('legacy compatibility path preserves publication/availability semantics and ignores modern flags', () => {
    const result = contract.evaluateCarOfferPublicEligibility({
      offer: {
        id: 'legacy', pricing_strategy: 'legacy_compat', availability_mode: 'legacy',
        is_available: true, is_published: true, stock_count: 0,
      },
      siteSetting: {
        car_multi_city_mapped_enabled: false,
        car_threshold_daily_rates_enabled: false,
      },
    });
    expect(result).toEqual(expect.objectContaining({ status: 'LIVE', publicEligible: true, path: 'legacy' }));
  });

  test('tier validation enforces lowest active threshold as exact minimum', () => {
    const invalid = contract.validateCarThresholdTierConfiguration(
      thresholdOffer({ min_rental_days: 3 }),
      tiers,
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.reasons.some((reason: any) => reason.code === 'MINIMUM_TIER_MISMATCH')).toBe(true);
  });
});
