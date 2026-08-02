import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/car-rental-multicity-core.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.CarRentalMulticityCore;
}

const core = loadCore();

const profiles = [
  { id: 'profile-larnaca', code: 'larnaca', name: 'Larnaca', calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true, updated_at: 'p1' },
  { id: 'profile-paphos', code: 'paphos', name: 'Paphos', calculator_key: 'paphos', legacy_booking_location: 'paphos', is_active: true, updated_at: 'p2' },
];

const cities = [
  { id: 'city-larnaca', code: 'larnaca', name_i18n: { en: 'Larnaca' }, is_active: true, updated_at: 'c1' },
  { id: 'city-nicosia', code: 'nicosia', name_i18n: { en: 'Nicosia' }, is_active: true, updated_at: 'c2' },
  { id: 'city-paphos', code: 'paphos', name_i18n: { en: 'Paphos' }, is_active: true, updated_at: 'c3' },
];

const profileCities = [
  { pricing_profile_id: 'profile-larnaca', city_id: 'city-larnaca', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'larnaca', is_active: true, updated_at: 'm1' },
  { pricing_profile_id: 'profile-larnaca', city_id: 'city-nicosia', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'nicosia', is_active: true, updated_at: 'm2' },
  { pricing_profile_id: 'profile-larnaca', city_id: 'city-paphos', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true, updated_at: 'm3' },
  { pricing_profile_id: 'profile-paphos', city_id: 'city-paphos', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true, updated_at: 'm4' },
];

const offer = (overrides: Record<string, unknown> = {}) => ({
  id: 'offer-exact',
  updated_at: '2026-08-02T08:00:00.000Z',
  location: 'larnaca',
  pricing_profile_id: 'profile-larnaca',
  vehicle_kind_id: 'kind-car',
  availability_mode: 'legacy',
  car_model: { pl: 'Mazda 2', en: 'Mazda 2', he: 'מאזדה 2' },
  car_type: { en: 'Economy' },
  description: { pl: '', en: '', he: '' },
  features: { pl: [], en: [], he: [] },
  transmission: 'automatic',
  fuel_type: 'petrol',
  max_passengers: 5,
  max_luggage: 2,
  stock_count: 2,
  sort_order: 10,
  is_available: true,
  north_allowed: true,
  image_url: '/mazda.jpg',
  price_per_day: 35,
  price_3days: 105,
  price_4_6days: 34,
  price_7_10days: 31,
  price_10plus_days: 29,
  currency: 'EUR',
  deposit_amount: 200,
  insurance_per_day: 17,
  young_driver_fee: true,
  young_driver_cost: 10,
  owner_partner_id: 'partner-one',
  ...overrides,
});

function context(overrides: Record<string, unknown> = {}) {
  return {
    offer: offer(),
    profiles,
    cities,
    profileCities,
    vehicleKinds: [
      { id: 'kind-car', code: 'car', name_i18n: { en: 'Car' }, is_active: true },
      { id: 'kind-quad', code: 'quad', name_i18n: { en: 'Quad' }, is_active: true },
    ],
    availability: [
      { offer_id: 'offer-exact', city_id: 'city-larnaca', pickup_enabled: true, return_enabled: true, is_active: true, updated_at: 'a1' },
    ],
    partners: [{ id: 'partner-one', name: 'Partner', status: 'active', can_manage_cars: true }],
    partnerResources: [],
    siteSetting: { car_multi_city_mapped_enabled: false },
    ...overrides,
  };
}

describe('Car Rental Multi-City Stage 2C core', () => {
  test('Larnaca and Paphos profiles resolve only to their compatibility locations', () => {
    expect(core.profileLocation(profiles[0])).toBe('larnaca');
    expect(core.profileLocation(profiles[1])).toBe('paphos');
  });

  test('Paphos cross-city mapping is blocked', () => {
    const result = core.validateProfileCityDraft({
      pricing_profile_id: 'profile-paphos',
      city_id: 'city-nicosia',
      pickup_supported: true,
      return_supported: true,
      legacy_pricing_city_key: 'nicosia',
      is_active: true,
    }, context());
    expect(result.valid).toBe(false);
    expect(result.errors.some((entry: any) => entry.message.includes('Paphos'))).toBe(true);
  });

  test('pickup and return flags remain independent', () => {
    const draft = core.createDraft(context(), { mode: 'availability' });
    draft.availability[0].pickup_enabled = true;
    draft.availability[0].return_enabled = false;
    const diff = core.availabilityDiff(draft, context());
    expect(diff[0].payload.pickup_enabled).toBe(true);
    expect(diff[0].payload.return_enabled).toBe(false);
  });

  test('new Larnaca vehicle defaults only to Larnaca, never all cities', () => {
    const draft = core.createDraft({ ...context(), offer: null, availability: [] }, { mode: 'create' });
    core.setDraftProfile(draft, context(), 'profile-larnaca', { resetAvailability: true });
    expect(draft.availability.map((row: any) => row.city_id)).toEqual(['city-larnaca']);
  });

  test('availability plan cannot contain prices or partner fields', () => {
    const draft = core.createDraft(context(), { mode: 'availability' });
    draft.availability.push({ offer_id: 'offer-exact', city_id: 'city-nicosia', pickup_enabled: true, return_enabled: false, is_active: true, updated_at: null });
    const plan = core.buildAvailabilityPlan(draft, context());
    const fields = plan.steps.flatMap((step: any) => step.changes.map((change: any) => change.field));
    expect(fields.some((field: string) => core.PRICE_COLUMNS.includes(field))).toBe(false);
    expect(fields).not.toContain('owner_partner_id');
    expect(plan.existingPriceColumnChanges).toBe(0);
  });

  test('partner plan does not contain availability fields', () => {
    const draft = core.createDraft(context(), { mode: 'partner' });
    draft.partner.ownerPartnerId = null;
    const plan = core.buildPartnerAssignmentPlan(draft, context());
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].payload).toEqual({ owner_partner_id: null });
    expect(Object.keys(plan.steps[0].payload)).not.toContain('city_id');
  });

  test('owner assignment cannot conflict with the existing fulfillment resource mapping', () => {
    const ctx = context({
      partners: [
        { id: 'partner-one', name: 'Partner 1', status: 'active', can_manage_cars: true },
        { id: 'partner-two', name: 'Partner 2', status: 'active', can_manage_cars: true },
      ],
      partnerResources: [{ id: 'resource-one', partner_id: 'partner-one', resource_type: 'cars', resource_id: 'offer-exact' }],
    });
    const draft = core.createDraft(ctx, { mode: 'partner' });
    draft.partner.ownerPartnerId = 'partner-two';
    const validation = core.validateDraft(draft, ctx);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((entry: any) => entry.message.includes('partner_resources'))).toBe(true);
  });

  test('clearing owner keeps the existing resource mapping as an explicit warning', () => {
    const ctx = context({
      partnerResources: [{ id: 'resource-one', partner_id: 'partner-one', resource_type: 'cars', resource_id: 'offer-exact' }],
    });
    const draft = core.createDraft(ctx, { mode: 'partner' });
    draft.partner.ownerPartnerId = null;
    const validation = core.validateDraft(draft, ctx);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.some((entry: any) => entry.message.includes('fulfillment fallback'))).toBe(true);
  });

  test('vehicle kind update never changes car_type', () => {
    const draft = core.createDraft(context(), { mode: 'vehicle' });
    draft.vehicle.vehicleKindId = 'kind-quad';
    const plan = core.buildVehicleDetailsPlan(draft, context());
    const kindChange = plan.steps[0].changes.find((change: any) => change.field === 'vehicle_kind_id');
    const typeChange = plan.steps[0].changes.find((change: any) => change.field === 'car_type');
    expect(kindChange.after).toBe('kind-quad');
    expect(typeChange).toBeUndefined();
  });

  test('every existing save plan carries the exact offer ID and updated_at', () => {
    const draft = core.createDraft(context(), { mode: 'vehicle' });
    draft.vehicle.stockCount = 3;
    const plan = core.buildVehicleDetailsPlan(draft, context());
    expect(plan.exactOfferId).toBe('offer-exact');
    expect(plan.steps[0].entityId).toBe('offer-exact');
    expect(plan.steps[0].expectedUpdatedAt).toBe('2026-08-02T08:00:00.000Z');
  });

  test('stale updated_at blocks preflight', () => {
    const draft = core.createDraft(context(), { mode: 'vehicle' });
    draft.vehicle.stockCount = 3;
    const plan = core.buildVehicleDetailsPlan(draft, context());
    const fresh = context({ offer: offer({ updated_at: 'changed' }) });
    expect(core.validateFreshContext(plan, fresh)).toEqual(expect.objectContaining({ valid: false }));
  });

  test('an unchanged fresh catalog passes the deterministic preflight snapshot', () => {
    const draft = core.createDraft(context(), { mode: 'availability' });
    draft.availability.push({ offer_id: 'offer-exact', city_id: 'city-nicosia', pickup_enabled: true, return_enabled: false, is_active: true, updated_at: null });
    const plan = core.buildAvailabilityPlan(draft, context());
    expect(core.validateFreshContext(plan, context())).toEqual({ valid: true, errors: [] });
  });

  test.each([
    ['profile-city mapping', { profileCities: profileCities.map((row) => row.city_id === 'city-nicosia' ? { ...row, pickup_supported: false, updated_at: 'm2-new' } : row) }],
    ['selected city state', { cities: cities.map((row) => row.id === 'city-nicosia' ? { ...row, is_active: false, updated_at: 'c2-new' } : row) }],
    ['offer availability row', { availability: [{ offer_id: 'offer-exact', city_id: 'city-larnaca', pickup_enabled: true, return_enabled: false, is_active: true, updated_at: 'a1-new' }] }],
  ])('changed %s blocks preflight before mutation', (_label, overrides) => {
    const draft = core.createDraft(context(), { mode: 'availability' });
    draft.availability.push({ offer_id: 'offer-exact', city_id: 'city-nicosia', pickup_enabled: true, return_enabled: false, is_active: true, updated_at: null });
    const plan = core.buildAvailabilityPlan(draft, context());
    expect(core.validateFreshContext(plan, context(overrides)).valid).toBe(false);
  });

  test('owner change blocks preflight even when a broken backend failed to advance updated_at', () => {
    const draft = core.createDraft(context(), { mode: 'vehicle' });
    draft.vehicle.stockCount = 3;
    const plan = core.buildVehicleDetailsPlan(draft, context());
    const fresh = context({ offer: offer({ owner_partner_id: null }) });
    expect(core.validateFreshContext(plan, fresh).valid).toBe(false);
  });

  test('selected partner catalog change blocks partner save preflight', () => {
    const ctx = context({ partners: [
      { id: 'partner-one', name: 'Partner', status: 'active', can_manage_cars: true, updated_at: 'partner-1' },
      { id: 'partner-two', name: 'Partner 2', status: 'active', can_manage_cars: true, updated_at: 'partner-2' },
    ] });
    const draft = core.createDraft(ctx, { mode: 'partner' });
    draft.partner.ownerPartnerId = 'partner-two';
    const plan = core.buildPartnerAssignmentPlan(draft, ctx);
    const fresh = context({
      partners: [
        { id: 'partner-one', name: 'Partner', status: 'active', can_manage_cars: true, updated_at: 'partner-1' },
        { id: 'partner-two', name: 'Partner 2', status: 'inactive', can_manage_cars: true, updated_at: 'partner-2-new' },
      ],
    });
    expect(core.validateFreshContext(plan, fresh).valid).toBe(false);
  });

  test('a newly created city is inactive by default', () => {
    const draft = core.createCityDraft({ code: 'new-city', name_i18n: { pl: 'Nowe', en: 'New', he: 'חדש' } });
    expect(draft.is_active).toBe(false);
  });

  test('inactive pricing profiles and vehicle kinds cannot be used by a save draft', () => {
    const inactiveContext = context({
      profiles: profiles.map((row) => row.id === 'profile-larnaca' ? { ...row, is_active: false } : row),
      vehicleKinds: [{ id: 'kind-car', code: 'car', name_i18n: { en: 'Car' }, is_active: false }],
    });
    const draft = core.createDraft(inactiveContext, { mode: 'vehicle' });
    const validation = core.validateDraft(draft, inactiveContext);
    expect(validation.valid).toBe(false);
    expect(validation.errors.map((entry: any) => entry.field)).toEqual(expect.arrayContaining(['pricingProfileId', 'vehicleKindId']));
  });

  test('unsupported place types are rejected before repository write', () => {
    const draft = core.createCityDraft({
      code: 'safe-city',
      name_i18n: { pl: 'Miasto', en: 'City', he: 'עיר' },
      place_types: ['city', 'unknown-type'],
    });
    expect(core.validateCityDraft(draft, []).valid).toBe(false);
  });

  test('active profile-city mapping requires both active profile and active city', () => {
    const inactiveCityContext = context({ cities: cities.map((row) => row.id === 'city-nicosia' ? { ...row, is_active: false } : row) });
    const validation = core.validateProfileCityDraft({
      pricing_profile_id: 'profile-larnaca',
      city_id: 'city-nicosia',
      pickup_supported: true,
      return_supported: true,
      legacy_pricing_city_key: 'nicosia',
      is_active: true,
    }, inactiveCityContext);
    expect(validation.valid).toBe(false);
  });

  test('missing legacy pricing key blocks active availability', () => {
    const badContext = context({ profileCities: profileCities.filter((row) => row.city_id !== 'city-nicosia') });
    const draft = core.createDraft(badContext, { mode: 'availability' });
    draft.availability.push({ city_id: 'city-nicosia', pickup_enabled: true, return_enabled: true, is_active: true });
    const validation = core.validateDraft(draft, badContext);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((entry: any) => entry.message.includes('mapping'))).toBe(true);
  });

  test('mapped readiness requires active pickup and return', () => {
    const draft = core.createDraft(context(), { mode: 'availability' });
    expect(core.getMappedReadiness(draft, context()).ready).toBe(true);
    draft.availability[0].return_enabled = false;
    expect(core.getMappedReadiness(draft, context()).ready).toBe(false);
  });

  test('draft and create plan remain legacy with global flag false', () => {
    const createContext = { ...context(), offer: null, availability: [] };
    const draft = core.createDraft(createContext, { mode: 'create' });
    core.setDraftProfile(draft, createContext, 'profile-larnaca', { resetAvailability: true });
    draft.pricing.pricePerDay = 40;
    const plan = core.buildCreateVehiclePlan(draft, createContext);
    expect(draft.publicMode).toBe('legacy');
    expect(draft.globalMappedFlag).toBe(false);
    expect(plan.steps[0].payload.availability_mode).toBe('legacy');
    expect(plan.globalMappedFlagChanges).toBe(0);
  });

  test('profile change preserves every existing price column', () => {
    const ctx = context();
    const draft = core.createDraft(ctx, { mode: 'pricing' });
    core.setDraftProfile(draft, ctx, 'profile-paphos');
    const plan = core.buildPricingProfilePlan(draft, ctx);
    expect(plan.steps[0].payload).toEqual({ pricing_profile_id: 'profile-paphos', location: 'paphos' });
    expect(plan.existingPriceColumnChanges).toBe(0);
    for (const column of core.PRICE_COLUMNS) {
      expect(plan.preservedPriceColumns[column]).toBe((ctx.offer as any)[column]);
    }
  });

  test('profile change never emits default or null price values', () => {
    const ctx = context();
    const draft = core.createDraft(ctx, { mode: 'pricing' });
    core.setDraftProfile(draft, ctx, 'profile-paphos');
    const payload = core.buildPricingProfilePlan(draft, ctx).steps[0].payload;
    expect(Object.keys(payload).filter((key) => core.PRICE_COLUMNS.includes(key))).toHaveLength(0);
  });

  test('review fingerprint becomes stale after a draft change', () => {
    const draft = core.createDraft(context(), { mode: 'vehicle' });
    draft.vehicle.stockCount = 3;
    const plan = core.buildReviewPlan(draft, context(), 'vehicle');
    expect(core.isReviewCurrent(draft, plan)).toBe(true);
    draft.vehicle.stockCount = 4;
    expect(core.isReviewCurrent(draft, plan)).toBe(false);
  });

  test('global mapped flag ON is a hard preflight stop', () => {
    const draft = core.createDraft(context(), { mode: 'vehicle' });
    draft.vehicle.stockCount = 3;
    const plan = core.buildVehicleDetailsPlan(draft, context());
    const fresh = context({ siteSetting: { car_multi_city_mapped_enabled: true } });
    expect(core.validateFreshContext(plan, fresh).valid).toBe(false);
  });
});
