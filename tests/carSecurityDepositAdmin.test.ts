import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/car-rental-multicity-core.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.CarRentalMulticityCore;
}

const core = loadCore();

const profile = {
  id: 'profile-larnaca',
  code: 'larnaca',
  calculator_key: 'larnaca',
  legacy_booking_location: 'larnaca',
  is_active: true,
};

function offer(depositAmount: number | null) {
  return {
    id: 'offer-exact',
    updated_at: 'offer-v1',
    pricing_strategy: 'legacy_compat',
    pricing_profile_id: profile.id,
    location: 'larnaca',
    currency: 'EUR',
    price_per_day: 50,
    price_3days: 150,
    price_4_6days: 45,
    price_7_10days: 40,
    price_10plus_days: 35,
    min_rental_days: 3,
    max_rental_days: null,
    insurance_mode: 'included',
    insurance_per_day: 0,
    young_driver_fee: false,
    young_driver_cost: 0,
    deposit_amount: depositAmount,
    car_model: { en: 'Fixture' },
    car_type: { en: 'Fixture' },
    vehicle_kind_id: 'kind-car',
    transmission: 'automatic',
    fuel_type: 'petrol',
    max_passengers: 4,
    max_luggage: 1,
    stock_count: 1,
    sort_order: 1,
    is_available: true,
    north_allowed: false,
    features: { en: [] },
    description: { en: '' },
  };
}

function context(depositAmount: number | null) {
  return {
    offer: offer(depositAmount),
    profiles: [profile],
    cities: [],
    profileCities: [],
    availability: [],
    dailyRateTiers: [],
    vehicleKinds: [{ id: 'kind-car', code: 'car', is_active: true }],
    partners: [],
    partnerResources: [],
    depositRule: { mode: 'percent_total', amount: 15, currency: 'EUR', enabled: true },
    depositOverride: null,
  };
}

describe('exact-offer security deposit Admin contract', () => {
  test.each([
    [null, 'unspecified', null],
    [0, 'none', 0],
    [300, 'amount', 300],
  ])('preserves DB value %p as the distinct %s state', (stored, mode, expected) => {
    const draft = core.createDraft(context(stored), { mode: 'pricing' });
    expect(draft.pricing.securityDepositMode).toBe(mode);
    expect(draft.pricing.securityDepositAmount).toBe(expected);
    expect(core.pricingEditPayload(draft, context(stored)).deposit_amount).toBe(expected);
  });

  test('custom security deposit requires a positive two-decimal amount', () => {
    const draft = core.createDraft(context(null), { mode: 'pricing' });
    draft.pricing.securityDepositMode = 'amount';
    draft.pricing.securityDepositAmount = 0;
    expect(core.validateDraft(draft, context(null)).errors).toContainEqual(expect.objectContaining({ field: 'securityDepositAmount' }));

    draft.pricing.securityDepositAmount = 300;
    expect(core.validateDraft(draft, context(null)).errors).not.toContainEqual(expect.objectContaining({ field: 'securityDepositAmount' }));
    expect(core.pricingEditPayload(draft, context(null)).deposit_amount).toBe(300);
  });

  test('central 15 percent part-payment remains read-only and is formatted as percent, not EUR', () => {
    const ui = read('admin/car-rental-multicity-ui.js');
    expect(ui).toContain("if (core.normalizeCode(rule.mode) === 'percent_total') return `${formatted}%`");
    expect(ui).toContain("per_day: '/day'");
    expect(ui).toContain('This part-payment is separate from the refundable security deposit.');
    expect(ui).not.toMatch(/from\(['"]service_deposit_(?:rules|overrides)['"]\)\.(?:insert|update|upsert|delete)/);
  });

  test('legacy editor preserves explicit zero and nullable unspecified state', () => {
    const admin = read('admin/admin.js');
    const dashboard = read('admin/dashboard.html');
    expect(admin).toContain("carData.deposit_amount ?? ''");
    expect(admin).toContain("securityDepositRaw === '' ? null : Number(securityDepositRaw)");
    expect(dashboard).toContain('Security / Damage Deposit (€)');
    expect(dashboard).toContain('Payment due at booking is managed separately in Deposit settings.');
  });
});

describe('security-deposit SQL contract', () => {
  const migration = read('supabase/migrations/20260810160000_car_offer_security_deposit_semantics.sql');
  const verify = read('supabase/manual/car_offer_security_deposit_semantics_verify.sql');

  test('migration is additive, transactional and does not mutate payment-due tables or offer rows', () => {
    expect(migration).toMatch(/^begin;/i);
    expect(migration.trim()).toMatch(/commit;$/i);
    expect(migration).toContain('alter column deposit_amount drop default');
    expect(migration).toContain('alter column deposit_amount drop not null');
    expect(migration).toContain('deposit_amount is null or deposit_amount >= 0');
    expect(migration).toContain('Never used as payment due at booking');
    expect(migration).not.toMatch(/\b(?:insert|update|delete|merge|truncate)\s+(?:into\s+|from\s+)?public\.(?:car_offers|service_deposit_rules|service_deposit_overrides)\b/i);
  });

  test('verify is read-only and exposes one explicit safe result', () => {
    expect(verify).toContain('car_offer_security_deposit_semantics_safe');
    expect(verify).toContain('no_implicit_no_deposit_default');
    expect(verify).toContain('negative_values = 0');
    expect(verify).not.toMatch(/\b(?:insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i);
  });
});
