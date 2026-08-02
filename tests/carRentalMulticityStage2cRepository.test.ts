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
  let counter = 0;
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
  return { client, tables, mutations };
}

const seed = () => ({
  car_offers: [{
    id: 'offer-one', updated_at: 'offer-v1', location: 'larnaca', pricing_profile_id: 'profile-larnaca', vehicle_kind_id: 'kind-car', availability_mode: 'legacy',
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
  site_settings: [{ id: 1, car_multi_city_mapped_enabled: false, updated_at: 'settings-v1' }],
});

describe('Car Rental Multi-City Stage 2C repository', () => {
  const { core, repository: repositoryApi } = loadModules();

  test('fresh context is loaded by exact offer ID with independent catalog data', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const context = await repository.getOfferContext('offer-one');
    expect(context.offer.id).toBe('offer-one');
    expect(context.profiles).toHaveLength(2);
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

  test('availability write touches only car_offer_city_availability', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const offerBefore = JSON.stringify(memory.tables.car_offers[0]);
    await repository.insertAvailability({ payload: { offer_id: 'offer-one', city_id: 'city-paphos', pickup_enabled: true, return_enabled: false, is_active: true } });
    expect(memory.mutations.map((mutation) => mutation.table)).toEqual(['car_offer_city_availability']);
    expect(JSON.stringify(memory.tables.car_offers[0])).toBe(offerBefore);
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

  test('catalog writes stop before mutation if the global mapped flag is no longer false', async () => {
    const fixture = seed();
    fixture.site_settings[0].car_multi_city_mapped_enabled = true;
    const memory = memoryClient(fixture);
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.createCity(core.createCityDraft({
      code: 'blocked-city', name_i18n: { pl: 'Blokada', en: 'Blocked', he: 'חסום' }, place_types: ['city'],
    }))).rejects.toMatchObject({ code: 'car_multicity_stale_conflict' });
    expect(memory.mutations).toHaveLength(0);
  });

  test('profile-city impact reports exact offer IDs and readiness invalidation before write', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    const impact = await repository.listMappingImpact('profile-larnaca', 'city-larnaca', {
      pricing_profile_id: 'profile-larnaca',
      city_id: 'city-larnaca',
      pickup_supported: true,
      return_supported: false,
      legacy_pricing_city_key: 'larnaca',
      is_active: true,
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
      pickup_supported: true,
      return_supported: false,
      legacy_pricing_city_key: 'larnaca',
      is_active: true,
      expectedUpdatedAt: 'mapping-v1',
    });
    const mapping = memory.tables.car_pricing_profile_cities.find((row) => row.pricing_profile_id === 'profile-larnaca' && row.city_id === 'city-larnaca');
    expect(mapping?.return_supported).toBe(false);
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
  });

  test('repository rejects forbidden columns before any write', async () => {
    const memory = memoryClient(seed());
    const repository = repositoryApi.create({ client: memory.client, core });
    await expect(repository.updateVehicleDetails({ offerId: 'offer-one', expectedUpdatedAt: 'offer-v1', payload: { location: 'paphos' } }))
      .rejects.toMatchObject({ code: 'car_multicity_internal_error' });
    expect(memory.mutations).toHaveLength(0);
  });
});
