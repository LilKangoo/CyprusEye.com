import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type Row = Record<string, any>;

function loadModules(): { core: any; repository: any } {
  const context: Record<string, unknown> = {};
  for (const relative of ['admin/car-rental-multicity-core.js', 'admin/car-rental-multicity-repository.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return { core: context.CarRentalMulticityCore, repository: context.CarRentalMulticityRepository };
}

function memoryClient(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([table, values]) => [table, values.map((row) => ({ ...row }))]));
  const mutations: Array<{ action: string; table: string; payload: Row }> = [];
  const rpcCalls: Array<{ name: string; params: Row }> = [];
  let counter = 0;
  const storageObjects = new Map<string, unknown>();
  const storageRemovals: string[] = [];
  const getRows = (table: string) => tables[table] ||= [];

  function builder(table: string, action: 'select' | 'update' | 'delete', payload: Row = {}) {
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<{ field: string; ascending: boolean }> = [];
    let max = Number.POSITIVE_INFINITY;
    let returnRows = action === 'select';
    const api: any = {
      eq(field: string, value: any) { filters.push((row) => row[field] === value); return api; },
      in(field: string, values: any[]) { filters.push((row) => values.includes(row[field])); return api; },
      order(field: string, options: any = {}) { orders.push({ field, ascending: options.ascending !== false }); return api; },
      limit(value: number) { max = value; return api; },
      select() { returnRows = true; return api; },
      then(resolve: any, reject: any) {
        let matching = getRows(table).map((row, index) => ({ row, index })).filter(({ row }) => filters.every((filter) => filter(row)));
        for (const order of orders.slice().reverse()) {
          matching = matching.slice().sort((left, right) => {
            const comparison = String(left.row[order.field] ?? '').localeCompare(String(right.row[order.field] ?? ''));
            return order.ascending ? comparison : -comparison;
          });
        }
        matching = matching.slice(0, max);
        let resultRows: Row[] = [];
        if (action === 'select') resultRows = matching.map(({ row }) => ({ ...row }));
        if (action === 'update') {
          matching.forEach(({ index }) => {
            const next = { ...getRows(table)[index], ...payload, updated_at: `updated-${++counter}` };
            getRows(table)[index] = next;
            resultRows.push({ ...next });
            mutations.push({ action, table, payload: { ...payload } });
          });
        }
        if (action === 'delete') {
          resultRows = matching.map(({ row }) => ({ ...row }));
          const indexes = new Set(matching.map(({ index }) => index));
          tables[table] = getRows(table).filter((_row, index) => !indexes.has(index));
          if (matching.length) mutations.push({ action, table, payload: {} });
        }
        return Promise.resolve({ data: returnRows ? resultRows : null, error: null }).then(resolve, reject);
      },
    };
    return api;
  }

  const client = {
    async rpc(name: string, params: Row = {}) {
      rpcCalls.push({ name, params: JSON.parse(JSON.stringify(params)) });
      if (name === 'admin_set_car_threshold_offer_activation_state') {
        const offers = getRows('car_offers');
        const index = offers.findIndex((row) => String(row.id) === String(params.p_offer_id));
        if (index < 0) return { data: null, error: { code: 'P0002', message: 'activation_offer_missing' } };
        const current = offers[index];
        if (String(current.updated_at) !== String(params.p_expected_updated_at)) {
          return { data: null, error: { code: '40001', message: 'activation_stale_offer' } };
        }
        if (current.pricing_strategy !== 'threshold_daily_rate') {
          return { data: null, error: { code: '23514', message: 'activation_requires_threshold_strategy' } };
        }
        const setting = getRows('site_settings')[0] || {};
        if (params.p_activate === true && (
          setting.car_multi_city_mapped_enabled !== true
          || setting.car_threshold_daily_rates_enabled !== true
        )) return { data: null, error: { code: '23514', message: 'activation_requires_both_capabilities' } };
        const next = {
          ...current,
          ...(params.p_activate === true ? {
            availability_mode: 'mapped',
            is_available: true,
            is_published: true,
            submission_status: 'approved',
          } : { is_published: false }),
          updated_at: `updated-${++counter}`,
        };
        offers[index] = next;
        return { data: { ...next }, error: null };
      }
      if (name !== 'admin_save_car_offer_city_availability_batch') {
        return { data: null, error: { message: `Unsupported RPC ${name}` } };
      }
      const offerId = String(params.p_offer_id || '');
      const current = getRows('car_offer_city_availability').filter((row) => String(row.offer_id) === offerId);
      const expected = (params.p_expected_rows || []).map((row: Row) => ({ city_id: row.city_id, updated_at: row.updated_at || null }))
        .sort((left: Row, right: Row) => String(left.city_id).localeCompare(String(right.city_id)));
      const actual = current.map((row) => ({ city_id: row.city_id, updated_at: row.updated_at || null }))
        .sort((left, right) => String(left.city_id).localeCompare(String(right.city_id)));
      if (JSON.stringify(expected) !== JSON.stringify(actual)) return { data: null, error: { message: 'availability_batch_stale' } };
      const desired = (params.p_desired_rows || []).map((row: Row) => {
        const existing = current.find((candidate) => candidate.city_id === row.city_id);
        return {
          ...existing,
          ...row,
          id: existing?.id || `availability-${++counter}`,
          offer_id: offerId,
          is_active: row.pickup_enabled === true || row.return_enabled === true,
          updated_at: `updated-${++counter}`,
        };
      });
      tables.car_offer_city_availability = [
        ...getRows('car_offer_city_availability').filter((row) => String(row.offer_id) !== offerId),
        ...desired,
      ];
      return { data: { offer_id: offerId, row_count: desired.length, rows: desired }, error: null };
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(objectPath: string, payload: unknown) {
            storageObjects.set(`${bucket}/${objectPath}`, payload);
            return { data: { path: objectPath }, error: null };
          },
          getPublicUrl(objectPath: string) {
            return { data: { publicUrl: `https://storage.test/${bucket}/${objectPath}` } };
          },
          async remove(paths: string[]) {
            paths.forEach((objectPath) => {
              storageObjects.delete(`${bucket}/${objectPath}`);
              storageRemovals.push(`${bucket}/${objectPath}`);
            });
            return { data: paths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
    from(table: string) {
      return {
        select() { return builder(table, 'select'); },
        update(payload: Row) { return builder(table, 'update', payload); },
        delete() { return builder(table, 'delete'); },
        insert(payload: Row | Row[]) {
          return {
            select() {
              const execute = () => {
                  const values = (Array.isArray(payload) ? payload : [payload]).map((row) => ({
                    ...row,
                    id: row.id || `${table}-${++counter}`,
                    created_at: row.created_at || `created-${counter}`,
                    updated_at: row.updated_at || `updated-${counter}`,
                  }));
                  getRows(table).push(...values);
                  values.forEach((row) => mutations.push({ action: 'insert', table, payload: { ...row } }));
                  return { data: values.map((row) => ({ ...row })), error: null };
              };
              return {
                async single() {
                  const result = execute();
                  return { data: result.data[0] || null, error: result.error };
                },
                then(resolve: any, reject: any) {
                  return Promise.resolve(execute()).then(resolve, reject);
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, tables, mutations, rpcCalls, storageObjects, storageRemovals };
}

const seed = () => ({
  car_offers: [{
    id: 'offer-one', updated_at: 'offer-v1', location: 'larnaca', pricing_profile_id: 'profile-larnaca', pricing_strategy: 'legacy_compat',
    min_rental_days: 1, max_rental_days: null, insurance_mode: 'legacy_optional_daily', vehicle_kind_id: 'kind-car', availability_mode: 'legacy',
    car_model: { en: 'Mazda' }, car_type: { en: 'Economy' }, description: { en: '' }, features: { en: [] }, transmission: 'automatic', fuel_type: 'petrol',
    max_passengers: 5, max_luggage: 2, stock_count: 1, sort_order: 10, is_available: true, north_allowed: true, image_url: null,
    price_per_day: 35, price_3days: 105, price_4_6days: 34, price_7_10days: 31, price_10plus_days: 29,
    owner_partner_id: 'partner-one', currency: 'EUR', deposit_amount: 200, insurance_per_day: 17,
  }],
  car_rental_cities: [
    { id: 'city-larnaca', code: 'larnaca', name_i18n: { pl: 'Larnaka', en: 'Larnaca', he: 'לרנקה' }, place_types: ['city'], is_active: true, sort_order: 10, updated_at: 'city-v1' },
    { id: 'city-paphos', code: 'paphos', name_i18n: { pl: 'Pafos', en: 'Paphos', he: 'פאפוס' }, place_types: ['city'], is_active: true, sort_order: 20, updated_at: 'city-v2' },
  ],
  car_pricing_profiles: [
    { id: 'profile-larnaca', code: 'larnaca', name: 'Larnaca', calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true, updated_at: 'profile-v1' },
    { id: 'profile-paphos', code: 'paphos', name: 'Paphos', calculator_key: 'paphos', legacy_booking_location: 'paphos', is_active: true, updated_at: 'profile-v2' },
  ],
  car_pricing_profile_cities: [
    { pricing_profile_id: 'profile-larnaca', city_id: 'city-larnaca', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'larnaca', is_active: true, updated_at: 'mapping-v1' },
    { pricing_profile_id: 'profile-larnaca', city_id: 'city-paphos', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true, updated_at: 'mapping-v2' },
    { pricing_profile_id: 'profile-paphos', city_id: 'city-paphos', pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true, updated_at: 'mapping-v3' },
  ],
  car_offer_city_availability: [{ offer_id: 'offer-one', city_id: 'city-larnaca', pickup_enabled: true, return_enabled: true, is_active: true, updated_at: 'availability-v1' }],
  car_vehicle_kinds: [{ id: 'kind-car', code: 'car', name_i18n: { en: 'Car' }, is_active: true, sort_order: 10 }],
  partners: [{ id: 'partner-one', name: 'Partner', status: 'active', can_manage_cars: true, cars_locations: ['larnaca'], updated_at: 'partner-v1' }],
  partner_resources: [{ id: 'resource-one', partner_id: 'partner-one', resource_type: 'cars', resource_id: 'offer-one', created_at: 'resource-v1' }],
  service_deposit_rules: [{ id: 'deposit-cars', resource_type: 'cars', mode: 'per_day', amount: 5, currency: 'EUR', include_children: true, enabled: true, updated_at: 'deposit-v1' }],
  service_deposit_overrides: [],
  car_offer_daily_rate_tiers: [],
  site_settings: [{ id: 1, car_multi_city_mapped_enabled: false, car_threshold_daily_rates_enabled: false, updated_at: 'settings-v1' }],
});

function thresholdSeed() {
  const fixture: Record<string, Row[]> = seed();
  fixture.car_offers[0] = {
    ...fixture.car_offers[0],
    pricing_strategy: 'threshold_daily_rate',
    pricing_profile_id: null,
    location: 'larnaca',
    min_rental_days: 1,
    max_rental_days: null,
    insurance_mode: 'included',
    insurance_per_day: 0,
    young_driver_fee: false,
    young_driver_cost: 0,
    deposit_amount: 0,
  };
  fixture.car_offer_daily_rate_tiers = [
    { id: 'tier-one', offer_id: 'offer-one', threshold_days: 1, daily_rate: 50, is_active: true, created_at: 'tier-c1', updated_at: 'tier-v1' },
    { id: 'tier-three', offer_id: 'offer-one', threshold_days: 3, daily_rate: 45, is_active: true, created_at: 'tier-c2', updated_at: 'tier-v2' },
  ];
  return fixture;
}

describe('Car Rental Multi-City Stage 2C repository', () => {
  const { core, repository: repositoryApi } = loadModules();

  test('fresh context is loaded by exact offer ID with independent catalog data', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    expect(context.offer.id).toBe('offer-one');
    expect(context.profiles).toHaveLength(2);
    expect(context.depositRule).toEqual(expect.objectContaining({ resource_type: 'cars', mode: 'per_day', amount: 5 }));
    expect(context.depositOverride).toBeNull();
    expect(context.availability).toHaveLength(1);
    expect(context.partnerResources[0].resource_id).toBe('offer-one');
  });

  test('vehicle update uses exact ID and expectedUpdatedAt and preserves prices, partner, availability and car_type', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const before = { ...memory.tables.car_offers[0] };
    await repository.updateVehicleDetails({ offerId: 'offer-one', expectedUpdatedAt: 'offer-v1', payload: { vehicle_kind_id: 'kind-car', stock_count: 2 } });
    const after = memory.tables.car_offers[0];
    expect(after.stock_count).toBe(2);
    expect(after.car_type).toEqual(before.car_type);
    expect(after.owner_partner_id).toBe(before.owner_partner_id);
    for (const column of core.PRICE_COLUMNS) expect(after[column]).toBe(before[column]);
    expect(memory.tables.car_offer_city_availability).toHaveLength(1);
  });

  test('zero-row exact update is a stale conflict', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.updateVehicleDetails({ offerId: 'offer-one', expectedUpdatedAt: 'wrong', payload: { stock_count: 2 } }))
      .rejects.toMatchObject({ code: 'car_multicity_stale_conflict' });
    expect(memory.mutations).toHaveLength(0);
  });

  test('pricing profile update writes only exact profile and compatibility location', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const beforePrices = core.PRICE_COLUMNS.map((column: string) => memory.tables.car_offers[0][column]);
    await repository.updatePricingProfile({
      offerId: 'offer-one', expectedUpdatedAt: 'offer-v1', payload: { pricing_profile_id: 'profile-paphos', location: 'paphos' },
    });
    expect(memory.tables.car_offers[0].pricing_profile_id).toBe('profile-paphos');
    expect(memory.tables.car_offers[0].location).toBe('paphos');
    expect(core.PRICE_COLUMNS.map((column: string) => memory.tables.car_offers[0][column])).toEqual(beforePrices);
  });

  test('pricing profile update rejects a mismatched location before mutation', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.updatePricingProfile({
      offerId: 'offer-one', expectedUpdatedAt: 'offer-v1', payload: { pricing_profile_id: 'profile-paphos', location: 'larnaca' },
    })).rejects.toMatchObject({ code: 'car_multicity_stale_conflict' });
    expect(memory.mutations).toHaveLength(0);
  });

  test.each([
    ['security deposit', (draft: any) => {
      draft.pricing.securityDepositMode = 'amount';
      draft.pricing.securityDepositAmount = 300;
    }, { deposit_amount: 300 }],
    ['insurance', (draft: any) => {
      draft.pricing.insuranceMode = 'optional_daily';
      draft.pricing.insurancePerDay = 12;
    }, { insurance_mode: 'optional_daily', insurance_per_day: 12 }],
    ['young driver', (draft: any) => {
      draft.pricing.youngDriverFee = true;
      draft.pricing.youngDriverCost = 9;
    }, { young_driver_fee: true, young_driver_cost: 9 }],
    ['maximum rental days', (draft: any) => {
      draft.pricing.maxRentalDays = 30;
    }, { max_rental_days: 30 }],
  ])('threshold %s save preserves every legacy compatibility field', async (_label, mutateDraft, expectedPatch) => {
    const memory = memoryClient(thresholdSeed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const before = JSON.parse(JSON.stringify({
      strategy: context.offer.pricing_strategy,
      profile: context.offer.pricing_profile_id,
      location: context.offer.location,
      prices: Object.fromEntries(core.PRICE_COLUMNS.map((column: string) => [column, context.offer[column]])),
      tiers: context.dailyRateTiers,
      availability: context.availability,
      partner: context.offer.owner_partner_id,
    }));
    const draft = core.createDraft(context, { mode: 'pricing' });
    mutateDraft(draft);
    const plan = core.buildPricingProfilePlan(draft, context);
    const offerStep = plan.steps.find((step: any) => step.type === 'car_offer');
    expect(offerStep.payload).toEqual(expect.objectContaining({
      pricing_strategy: 'threshold_daily_rate',
      ...expectedPatch,
    }));
    expect(offerStep.payload).not.toHaveProperty('pricing_profile_id');
    expect(offerStep.payload).not.toHaveProperty('location');
    for (const column of core.PRICE_COLUMNS) expect(offerStep.payload).not.toHaveProperty(column);

    const result = await repository.executePlan(plan);
    expect(result.status).toBe('success');
    const after = memory.tables.car_offers[0];
    expect(after).toEqual(expect.objectContaining({
      pricing_strategy: before.strategy,
      pricing_profile_id: before.profile,
      location: before.location,
      owner_partner_id: before.partner,
      ...expectedPatch,
    }));
    expect(Object.fromEntries(core.PRICE_COLUMNS.map((column: string) => [column, after[column]]))).toEqual(before.prices);
    expect(memory.tables.car_offer_daily_rate_tiers).toEqual(before.tiers);
    expect(memory.tables.car_offer_city_availability).toEqual(before.availability);
  });

  test('threshold repository partial patch without strategy resolves the fresh exact strategy', async () => {
    const memory = memoryClient(thresholdSeed());
    const repository = repositoryApi.create({ client: memory.client, core });
    await repository.updatePricingProfile({
      offerId: 'offer-one',
      expectedUpdatedAt: 'offer-v1',
      payload: { deposit_amount: 250 },
    });
    expect(memory.tables.car_offers[0]).toEqual(expect.objectContaining({
      pricing_strategy: 'threshold_daily_rate',
      pricing_profile_id: null,
      location: 'larnaca',
      deposit_amount: 250,
    }));
  });

  test('threshold tier edit preserves strategy, profile, location and unrelated exact-offer state', async () => {
    const memory = memoryClient(thresholdSeed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const draft = core.createDraft(context, { mode: 'pricing' });
    core.updateDailyRateTier(draft, 'tier-three', { daily_rate: 44.5 });
    const plan = core.buildPricingProfilePlan(draft, context);
    expect(plan.steps.map((step: any) => step.type)).toEqual(['car_offer_daily_rate_tier']);
    const result = await repository.executePlan(plan);
    expect(result.status).toBe('success');
    expect(memory.tables.car_offer_daily_rate_tiers.find((tier) => tier.id === 'tier-three')?.daily_rate).toBe(44.5);
    expect(memory.tables.car_offers[0]).toEqual(expect.objectContaining({
      pricing_strategy: 'threshold_daily_rate',
      pricing_profile_id: null,
      location: 'larnaca',
      deposit_amount: 0,
    }));
    expect(memory.tables.car_offer_city_availability).toHaveLength(1);
  });

  test('unexpected threshold-to-legacy downgrade is rejected before the first tier write', async () => {
    const memory = memoryClient(thresholdSeed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const draft = core.createDraft(context, { mode: 'pricing' });
    core.updateDailyRateTier(draft, 'tier-three', { daily_rate: 44 });
    draft.pricing.securityDepositMode = 'amount';
    draft.pricing.securityDepositAmount = 350;
    const plan = core.buildPricingProfilePlan(draft, context);
    const offerStep = plan.steps.find((step: any) => step.type === 'car_offer');
    offerStep.payload.pricing_strategy = 'legacy_compat';

    await expect(repository.executePlan(plan)).rejects.toMatchObject({
      code: 'car_multicity_internal_error',
      message: 'Pricing payload no longer matches the reviewed strategy.',
    });
    expect(memory.mutations).toHaveLength(0);
    expect(memory.tables.car_offer_daily_rate_tiers.find((tier) => tier.id === 'tier-three')?.daily_rate).toBe(45);
    expect(memory.tables.car_offers[0].deposit_amount).toBe(0);
  });

  test('direct strategy conversion without matching reviewed intent fails before mutation', async () => {
    const memory = memoryClient(thresholdSeed());
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.updatePricingProfile({
      offerId: 'offer-one',
      expectedUpdatedAt: 'offer-v1',
      payload: {
        pricing_strategy: 'legacy_compat',
        pricing_profile_id: 'profile-larnaca',
        location: 'larnaca',
      },
      explicitStrategyConversion: true,
    })).rejects.toMatchObject({
      code: 'car_multicity_internal_error',
      message: 'Unexpected pricing strategy conversion blocked before any write.',
    });
    expect(memory.mutations).toHaveLength(0);
    expect(memory.tables.car_offers[0].pricing_strategy).toBe('threshold_daily_rate');
  });

  test('stale tier snapshot rejects the complete pricing plan before its first write', async () => {
    const memory = memoryClient(thresholdSeed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const draft = core.createDraft(context, { mode: 'pricing' });
    core.updateDailyRateTier(draft, 'tier-one', { daily_rate: 49 });
    core.updateDailyRateTier(draft, 'tier-three', { daily_rate: 44 });
    const plan = core.buildPricingProfilePlan(draft, context);
    memory.tables.car_offer_daily_rate_tiers[1].updated_at = 'concurrent-tier-version';

    await expect(repository.executePlan(plan)).rejects.toMatchObject({
      code: 'car_multicity_stale_conflict',
      message: 'Daily-rate tiers changed since Review.',
    });
    expect(memory.mutations).toHaveLength(0);
    expect(memory.tables.car_offer_daily_rate_tiers[0].daily_rate).toBe(50);
    expect(memory.tables.car_offer_daily_rate_tiers[1].daily_rate).toBe(45);
  });

  test('daily-rate tiers use exact offer and tier IDs with optimistic concurrency', async () => {
    const fixture = seed();
    (fixture.car_offer_daily_rate_tiers as Row[]).push({
      id: 'tier-one', offer_id: 'offer-one', threshold_days: 1, daily_rate: 50,
      is_active: true, created_at: 'tier-created', updated_at: 'tier-v1',
    });
    const memory = memoryClient(fixture);
    const repository = repositoryApi.create({ client: memory.client, core });
    const inserted = await repository.insertDailyRateTier({ payload: {
      offer_id: 'offer-one', threshold_days: 3, daily_rate: 45, is_active: true,
    } });
    expect(inserted).toEqual(expect.objectContaining({ offer_id: 'offer-one', threshold_days: 3, daily_rate: 45 }));
    const updated = await repository.updateDailyRateTier({
      tierId: 'tier-one', offerId: 'offer-one', expectedUpdatedAt: 'tier-v1',
      payload: { offer_id: 'other-offer', threshold_days: 2, daily_rate: 48, is_active: true },
    });
    expect(updated).toEqual(expect.objectContaining({ id: 'tier-one', offer_id: 'offer-one', threshold_days: 2, daily_rate: 48 }));
    await expect(repository.updateDailyRateTier({
      tierId: 'tier-one', offerId: 'offer-one', expectedUpdatedAt: 'tier-v1',
      payload: { threshold_days: 4, daily_rate: 44, is_active: true },
    })).rejects.toMatchObject({ code: 'car_multicity_stale_conflict' });
    await repository.deleteDailyRateTier({
      tierId: inserted.id, offerId: 'offer-one', expectedUpdatedAt: inserted.updated_at,
    });
    expect(memory.tables.car_offer_daily_rate_tiers).toEqual([
      expect.objectContaining({ id: 'tier-one', offer_id: 'offer-one', threshold_days: 2 }),
    ]);
    expect(memory.mutations.map((mutation) => `${mutation.table}:${mutation.action}`)).toEqual([
      'car_offer_daily_rate_tiers:insert',
      'car_offer_daily_rate_tiers:update',
      'car_offer_daily_rate_tiers:delete',
    ]);
  });

  test('duplicate exact offer threshold is rejected before insert', async () => {
    const fixture = seed();
    (fixture.car_offer_daily_rate_tiers as Row[]).push({
      id: 'tier-three', offer_id: 'offer-one', threshold_days: 3, daily_rate: 45,
      is_active: true, updated_at: 'tier-v1',
    });
    const memory = memoryClient(fixture);
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.insertDailyRateTier({ payload: {
      offer_id: 'offer-one', threshold_days: 3, daily_rate: 44, is_active: true,
    } })).rejects.toMatchObject({ code: 'car_multicity_stale_conflict' });
    expect(memory.mutations).toHaveLength(0);
  });

  test('availability write touches only car_offer_city_availability', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const offerBefore = JSON.stringify(memory.tables.car_offers[0]);
    await repository.insertAvailability({ payload: { offer_id: 'offer-one', city_id: 'city-paphos', pickup_enabled: true, return_enabled: true, is_active: true } });
    expect(memory.mutations.map((mutation) => mutation.table)).toEqual(['car_offer_city_availability']);
    expect(JSON.stringify(memory.tables.car_offers[0])).toBe(offerBefore);
  });

  test('availability plan saves all directional rows through one optimistic batch RPC', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const draft = core.createDraft(context, { mode: 'availability' });
    core.setDirectionalAvailability(draft, 'city-larnaca', 'return', false);
    core.setDirectionalAvailability(draft, 'city-paphos', 'return', true);
    const plan = core.buildAvailabilityPlan(draft, context);
    const result = await repository.executePlan(plan);
    expect(result.status).toBe('success');
    expect(memory.rpcCalls).toHaveLength(1);
    expect(memory.rpcCalls[0]).toEqual(expect.objectContaining({
      name: 'admin_save_car_offer_city_availability_batch',
      params: expect.objectContaining({ p_offer_id: 'offer-one' }),
    }));
    expect(memory.tables.car_offer_city_availability).toEqual(expect.arrayContaining([
      expect.objectContaining({ city_id: 'city-larnaca', pickup_enabled: true, return_enabled: false, is_active: true }),
      expect.objectContaining({ city_id: 'city-paphos', pickup_enabled: false, return_enabled: true, is_active: true }),
    ]));
    expect(memory.mutations).toHaveLength(0);
  });

  test('one atomic batch swaps return-only to pickup-only without caller-supplied is_active', async () => {
    const memory = memoryClient(seed());
    memory.tables.car_offer_city_availability = memory.tables.car_offer_city_availability.map((row) => (
      row.city_id === 'city-larnaca'
        ? { ...row, pickup_enabled: false, return_enabled: true, is_active: true }
        : row
    ));
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const draft = core.createDraft(context, { mode: 'availability' });
    core.setDirectionalAvailability(draft, 'city-larnaca', 'pickup', true);
    core.setDirectionalAvailability(draft, 'city-larnaca', 'return', false);
    const plan = core.buildAvailabilityPlan(draft, context);
    expect(plan.desiredAvailabilityRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ city_id: 'city-larnaca', pickup_enabled: true, return_enabled: false }),
    ]));
    expect(plan.desiredAvailabilityRows.find((row: any) => row.city_id === 'city-larnaca')).not.toHaveProperty('is_active');

    const result = await repository.executePlan(plan);
    expect(result.status).toBe('success');
    expect(memory.rpcCalls).toHaveLength(1);
    expect(memory.tables.car_offer_city_availability).toEqual(expect.arrayContaining([
      expect.objectContaining({ city_id: 'city-larnaca', pickup_enabled: true, return_enabled: false, is_active: true }),
    ]));
  });

  test('partner write touches only owner_partner_id and no availability', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const availabilityBefore = JSON.stringify(memory.tables.car_offer_city_availability);
    await repository.updatePartnerAssignment({ offerId: 'offer-one', expectedUpdatedAt: 'offer-v1', payload: { owner_partner_id: null } });
    expect(memory.tables.car_offers[0].owner_partner_id).toBeNull();
    expect(JSON.stringify(memory.tables.car_offer_city_availability)).toBe(availabilityBefore);
  });

  test('new city is always inserted inactive', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const created = await repository.createCity(core.createCityDraft({
      code: 'test-city', name_i18n: { pl: 'Test', en: 'Test', he: 'בדיקה' }, place_types: ['city'], is_active: true,
    }));
    expect(created.is_active).toBe(false);
    expect(memory.tables.car_pricing_profile_cities.some((row) => row.city_id === created.id)).toBe(false);
    expect(memory.tables.car_offer_city_availability.some((row) => row.city_id === created.id)).toBe(false);
  });

  test('city catalog activation is independent from legacy pricing-profile support', async () => {
    const fixture = seed();
    fixture.car_rental_cities.push({
      id: 'city-custom', code: 'polis', name_i18n: { pl: 'Polis', en: 'Polis', he: 'פוליס' },
      place_types: ['city'], is_active: false, sort_order: 90, updated_at: 'city-custom-v1',
    });
    const memory = memoryClient(fixture);
    const repository = repositoryApi.create({ client: memory.client, core });
    const updated = await repository.updateCity({
      ...fixture.car_rental_cities.at(-1),
      expectedUpdatedAt: 'city-custom-v1',
      is_active: true,
    });
    expect(updated).toEqual(expect.objectContaining({ id: 'city-custom', is_active: true }));
    expect(memory.tables.car_pricing_profile_cities.some((row) => row.city_id === 'city-custom')).toBe(false);
    expect(memory.tables.car_offer_city_availability.some((row) => row.city_id === 'city-custom')).toBe(false);
  });

  test('catalog writes remain independent after capability flags are enabled and never change those flags', async () => {
    const fixture = seed();
    fixture.site_settings[0].car_multi_city_mapped_enabled = true;
    fixture.site_settings[0].car_threshold_daily_rates_enabled = true;
    const memory = memoryClient(fixture);
    const repository = repositoryApi.create({ client: memory.client, core });
    const created = await repository.createCity(core.createCityDraft({
      code: 'capability-city', name_i18n: { pl: 'Nowe', en: 'New', he: 'חדש' }, place_types: ['city'],
    }));
    expect(created).toEqual(expect.objectContaining({ code: 'capability-city', is_active: false }));
    expect(memory.tables.site_settings[0]).toEqual(expect.objectContaining({
      car_multi_city_mapped_enabled: true,
      car_threshold_daily_rates_enabled: true,
    }));
    expect(memory.mutations).toEqual([expect.objectContaining({ table: 'car_rental_cities', action: 'insert' })]);
  });

  test('profile-city impact reports exact offer IDs and readiness invalidation before write', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const impact = await repository.listMappingImpact('profile-larnaca', 'city-larnaca', {
      pricing_profile_id: 'profile-larnaca',
      city_id: 'city-larnaca',
      pickup_supported: true,
      return_supported: true,
      legacy_pricing_city_key: 'larnaca',
      is_active: false,
    });
    expect(impact.offerIds).toEqual(['offer-one']);
    expect(impact.readyOfferIds).toEqual(['offer-one']);
    expect(impact.readyAfterOfferIds).toEqual([]);
    expect(impact.readinessInvalidatedOfferIds).toEqual(['offer-one']);
    expect(memory.mutations).toHaveLength(0);
  });

  test('profile-city update uses exact composite key and expectedUpdatedAt', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    await repository.saveProfileCityMapping({
      pricing_profile_id: 'profile-larnaca',
      city_id: 'city-larnaca',
      pickup_supported: false,
      return_supported: false,
      legacy_pricing_city_key: 'larnaca',
      is_active: false,
      expectedUpdatedAt: 'mapping-v1',
    });
    const mapping = memory.tables.car_pricing_profile_cities.find((row) => row.pricing_profile_id === 'profile-larnaca' && row.city_id === 'city-larnaca');
    expect(mapping).toEqual(expect.objectContaining({ pickup_supported: false, return_supported: false, is_active: false }));
    expect(memory.mutations).toEqual([expect.objectContaining({ action: 'update', table: 'car_pricing_profile_cities' })]);
  });

  test('create plan inserts a legacy offer then exact availability without touching the global flag', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getCreateContext();
    const draft = core.createDraft(context, { mode: 'create' });
    core.setDraftProfile(draft, context, 'profile-larnaca', { resetAvailability: true });
    draft.vehicle.carModel = { pl: 'Nowe', en: 'New', he: 'חדש' };
    draft.vehicle.carType = { en: 'Economy' };
    draft.pricing.pricePerDay = 40;
    const plan = core.buildCreateVehiclePlan(draft, context);
    const result = await repository.executePlan(plan);
    expect(result.status).toBe('success');
    const created = memory.tables.car_offers.find((row) => row.id === result.exactOfferId);
    expect(created).toBeDefined();
    expect(created?.availability_mode).toBe('legacy');
    expect(created?.location).toBe('larnaca');
    expect(memory.tables.site_settings[0].car_multi_city_mapped_enabled).toBe(false);
    expect(memory.mutations.some((mutation) => ['car_bookings', 'service_deposit_overrides', 'partner_resources'].includes(mutation.table))).toBe(false);
    expect(created).toHaveProperty('deposit_amount', null);
  });

  test('threshold create executes exact offer, tiers, finalization, then availability without activating flags', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getCreateContext();
    const draft = core.createDraft(context, { mode: 'create' });
    core.setDraftProfile(draft, context, 'profile-larnaca', { resetAvailability: true });
    draft.vehicle.carModel = { pl: 'Progowe', en: 'Threshold', he: 'סף' };
    draft.vehicle.carType = { en: 'Economy' };
    draft.pricing.strategy = 'threshold_daily_rate';
    core.addDailyRateTier(draft, { threshold_days: 1, daily_rate: 50, is_active: true });
    core.addDailyRateTier(draft, { threshold_days: 3, daily_rate: 45, is_active: true });
    core.addDailyRateTier(draft, { threshold_days: 7, daily_rate: 40, is_active: true });

    const result = await repository.executePlan(core.buildCreateVehiclePlan(draft, context));
    expect(result.status).toBe('success');
    const created = memory.tables.car_offers.find((row) => row.id === result.exactOfferId);
    expect(created).toEqual(expect.objectContaining({
      pricing_strategy: 'threshold_daily_rate',
      availability_mode: 'legacy',
      min_rental_days: 1,
      max_rental_days: null,
      is_available: true,
    }));
    expect(memory.tables.car_offer_daily_rate_tiers
      .filter((row) => row.offer_id === result.exactOfferId)
      .map((row) => [row.threshold_days, row.daily_rate])).toEqual([[1, 50], [3, 45], [7, 40]]);
    expect(memory.tables.car_offer_city_availability
      .filter((row) => row.offer_id === result.exactOfferId)).toHaveLength(1);
    expect(memory.tables.site_settings[0]).toEqual(expect.objectContaining({
      car_multi_city_mapped_enabled: false,
      car_threshold_daily_rates_enabled: false,
    }));
    expect(memory.mutations.map((mutation) => mutation.table)).toEqual([
      'car_offers',
      'car_offer_daily_rate_tiers',
      'car_offer_daily_rate_tiers',
      'car_offer_daily_rate_tiers',
      'car_offers',
      'car_offer_city_availability',
    ]);
  });

  test('vehicle photo uses the existing bucket, exact offer ID and public URL without base64', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const file = { name: 'mazda.webp', type: 'image/webp', size: 2048, lastModified: 1 };
    const uploaded = await repository.uploadVehicleImage({ file, offerId: 'offer-one', nonce: 'fixed' });
    expect(uploaded.bucket).toBe('car-images');
    expect(uploaded.path).toBe('car-offer-one-fixed.webp');
    expect(uploaded.publicUrl).toBe('https://storage.test/car-images/car-offer-one-fixed.webp');
    expect(uploaded.publicUrl).not.toContain('base64');
    expect(memory.storageObjects.has('car-images/car-offer-one-fixed.webp')).toBe(true);
  });

  test('newly uploaded unused photo can be cleaned up by its exact path only', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const uploaded = await repository.uploadVehicleImage({
      file: { name: 'replacement.jpg', type: 'image/jpeg', size: 1024 },
      offerId: 'offer-one',
      nonce: 'cleanup',
    });
    await repository.removeVehicleImage(uploaded.path);
    expect(memory.storageObjects.has(`car-images/${uploaded.path}`)).toBe(false);
    expect(memory.storageRemovals).toEqual([`car-images/${uploaded.path}`]);
  });

  test('reviewed photo URL is injected only into the exact car offer write', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const draft = core.createDraft(context, { mode: 'vehicle' });
    core.setVehicleImageAction(draft, 'added', { name: 'new.png', type: 'image/png', size: 1000, extension: 'png' });
    const plan = core.buildReviewPlan(draft, context, 'vehicle');
    const result = await repository.executePlan(plan, { uploadedImageUrl: 'https://storage.test/car-images/new.png' });
    expect(result.status).toBe('success');
    expect(memory.tables.car_offers[0].image_url).toBe('https://storage.test/car-images/new.png');
    expect(memory.mutations).toEqual([expect.objectContaining({ table: 'car_offers', action: 'update' })]);
  });

  test('repository rejects forbidden columns before any write', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.updateVehicleDetails({ offerId: 'offer-one', expectedUpdatedAt: 'offer-v1', payload: { location: 'paphos' } }))
      .rejects.toMatchObject({ code: 'car_multicity_internal_error' });
    expect(memory.mutations).toHaveLength(0);
  });

  test('threshold activation and publication-only rollback use one exact transactional RPC', async () => {
    const fixture = seed();
    (fixture.car_offers as Row[])[0] = {
      ...fixture.car_offers[0],
      pricing_strategy: 'threshold_daily_rate',
      min_rental_days: 1,
      availability_mode: 'legacy',
      is_available: true,
      is_published: false,
      submission_status: 'draft',
    };
    fixture.site_settings[0] = {
      ...fixture.site_settings[0],
      car_multi_city_mapped_enabled: true,
      car_threshold_daily_rates_enabled: true,
    };
    const memory = memoryClient(fixture);
    const repository = repositoryApi.create({ client: memory.client, core });
    const activated = await repository.updateActivationState({
      offerId: 'offer-one',
      expectedUpdatedAt: 'offer-v1',
      payload: {
        availability_mode: 'mapped',
        is_available: true,
        is_published: true,
        submission_status: 'approved',
      },
    });
    expect(activated).toEqual(expect.objectContaining({
      id: 'offer-one', availability_mode: 'mapped', is_available: true,
      is_published: true, submission_status: 'approved',
    }));
    expect(memory.rpcCalls).toEqual([expect.objectContaining({
      name: 'admin_set_car_threshold_offer_activation_state',
      params: expect.objectContaining({ p_offer_id: 'offer-one', p_activate: true }),
    })]);
    expect(memory.mutations).toEqual([]);
    expect(memory.tables.site_settings[0]).toEqual(expect.objectContaining({
      car_multi_city_mapped_enabled: true,
      car_threshold_daily_rates_enabled: true,
    }));

    const unpublished = await repository.updateActivationState({
      offerId: 'offer-one',
      expectedUpdatedAt: activated.updated_at,
      payload: { is_published: false },
    });
    expect(unpublished).toEqual(expect.objectContaining({
      availability_mode: 'mapped', is_available: true,
      is_published: false, submission_status: 'approved',
    }));
    expect(memory.rpcCalls.at(-1)).toEqual(expect.objectContaining({
      name: 'admin_set_car_threshold_offer_activation_state',
      params: expect.objectContaining({ p_offer_id: 'offer-one', p_activate: false }),
    }));
  });

  test('transactional threshold activation maps a stale timestamp to the Admin concurrency error', async () => {
    const fixture = seed();
    (fixture.car_offers as Row[])[0] = { ...fixture.car_offers[0], pricing_strategy: 'threshold_daily_rate' };
    fixture.site_settings[0] = {
      ...fixture.site_settings[0],
      car_multi_city_mapped_enabled: true,
      car_threshold_daily_rates_enabled: true,
    };
    const memory = memoryClient(fixture);
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.updateActivationState({
      offerId: 'offer-one',
      expectedUpdatedAt: 'stale-offer-version',
      payload: {
        availability_mode: 'mapped', is_available: true,
        is_published: true, submission_status: 'approved',
      },
    })).rejects.toMatchObject({ code: 'car_multicity_stale_conflict' });
  });

  test('repository rejects any save plan that claims a threshold feature-flag change', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    const draft = core.createDraft(context, { mode: 'vehicle' });
    draft.vehicle.stockCount = 2;
    const plan = core.buildVehicleDetailsPlan(draft, context);
    plan.globalThresholdFlagChanges = 1;
    await expect(repository.executePlan(plan)).rejects.toMatchObject({ code: 'car_multicity_internal_error' });
    expect(memory.mutations).toHaveLength(0);
  });
});
