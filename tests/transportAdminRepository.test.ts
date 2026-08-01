import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type Row = Record<string, any>;

function loadRepository(): { create: (options: any) => any } {
  const filename = path.join(process.cwd(), 'admin/transport-admin-repository.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.TransportAdminRepository as { create: (options: any) => any };
}

function createMemoryStore(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
  );
  const failures: Array<{ action: string; table: string; error: any; afterWrite?: boolean }> = [];
  let idCounter = 0;
  const writes: string[] = [];

  function rows(table: string): Row[] {
    if (!tables[table]) tables[table] = [];
    return tables[table];
  }

  function failure(action: string, table: string) {
    const index = failures.findIndex((entry) => entry.action === action && entry.table === table);
    if (index < 0) return null;
    return failures.splice(index, 1)[0];
  }

  function withDefaults(table: string, payload: Row): Row {
    return {
      ...payload,
      id: payload.id || `${table}-${++idCounter}`,
      created_at: payload.created_at || '2026-07-27T10:00:01.000Z',
      updated_at: payload.updated_at || '2026-07-27T10:00:01.000Z',
    };
  }

  function selectBuilder(table: string) {
    const filters: Array<[string, any]> = [];
    let order: { key: string; ascending: boolean } | null = null;
    let max = Infinity;
    const result = () => {
      let selected = rows(table).filter((row) => filters.every(([key, value]) => row[key] === value));
      if (order) {
        const currentOrder = order;
        selected = selected.slice().sort((a, b) => {
          const compared = String(a[currentOrder.key] ?? '').localeCompare(String(b[currentOrder.key] ?? ''));
          return currentOrder.ascending ? compared : -compared;
        });
      }
      return { data: selected.slice(0, max).map((row) => ({ ...row })), error: null };
    };
    const builder: any = {
      eq(key: string, value: any) { filters.push([key, value]); return builder; },
      order(key: string, options: any = {}) { order = { key, ascending: options.ascending !== false }; return builder; },
      limit(value: number) { max = value; return builder; },
      then(resolve: any, reject: any) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return builder;
  }

  const db = {
    from(table: string) {
      return {
        select() { return selectBuilder(table); },
        insert(payload: Row) {
          return {
            select() {
              const query: any = {
                async single() {
                  const plannedFailure = failure('insert', table);
                  const row = withDefaults(table, payload);
                  if (!plannedFailure || plannedFailure.afterWrite) {
                    rows(table).push(row);
                    writes.push(`insert:${table}`);
                  }
                  if (plannedFailure) return { data: null, error: plannedFailure.error };
                  return { data: { ...row }, error: null };
                },
              };
              return query;
            },
          };
        },
        update(payload: Row) {
          const filters: Array<[string, any]> = [];
          const updateBuilder: any = {
            eq(key: string, value: any) { filters.push([key, value]); return updateBuilder; },
            select() {
              const execute = async () => {
                const plannedFailure = failure('update', table);
                const matches = rows(table)
                  .map((row, index) => ({ row, index }))
                  .filter(({ row }) => filters.every(([key, value]) => row[key] === value));
                if (!plannedFailure || plannedFailure.afterWrite) {
                  matches.forEach(({ index }) => {
                    rows(table)[index] = { ...rows(table)[index], ...payload };
                    writes.push(`update:${table}`);
                  });
                }
                if (plannedFailure) return { data: null, error: plannedFailure.error };
                return { data: matches.map(({ index }) => ({ ...rows(table)[index] })), error: null };
              };
              return {
                async single() {
                  const result = await execute();
                  return { data: result.data?.[0] || null, error: result.error };
                },
                then(resolve: any, reject: any) { return execute().then(resolve, reject); },
              };
            },
          };
          return updateBuilder;
        },
        upsert(payload: Row, options: any = {}) {
          const execute = () => {
            const plannedFailure = failure('upsert', table);
            const keys = String(options.onConflict || 'id').split(',').map((key) => key.trim());
            const index = rows(table).findIndex((row) => keys.every((key) => row[key] === payload[key]));
            if (!plannedFailure || plannedFailure.afterWrite) {
              if (index >= 0) rows(table)[index] = { ...rows(table)[index], ...payload };
              else rows(table).push(withDefaults(table, payload));
              writes.push(`upsert:${table}`);
            }
            if (plannedFailure) return { data: null, error: plannedFailure.error };
            return { data: null, error: null };
          };
          return { then(resolve: any, reject: any) { return Promise.resolve(execute()).then(resolve, reject); } };
        },
        delete() {
          const filters: Array<[string, any]> = [];
          let returnRows = false;
          const deleteBuilder: any = {
            eq(key: string, value: any) { filters.push([key, value]); return deleteBuilder; },
            select() { returnRows = true; return deleteBuilder; },
            then(resolve: any, reject: any) {
              const plannedFailure = failure('delete', table);
              const deleted = rows(table).filter((row) => filters.every(([key, value]) => row[key] === value));
              if (!plannedFailure || plannedFailure.afterWrite) {
                tables[table] = rows(table).filter((row) => !filters.every(([key, value]) => row[key] === value));
                writes.push(`delete:${table}`);
              }
              const result = plannedFailure
                ? { data: null, error: plannedFailure.error }
                : { data: returnRows ? deleted.map((row) => ({ ...row })) : null, error: null };
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return deleteBuilder;
        },
      };
    },
  };

  return {
    db,
    failNext(entry: { action: string; table: string; error: any; afterWrite?: boolean }) { failures.push(entry); },
    rows,
    runMutation: async (operation: (client: any) => Promise<any>) => operation(db),
    writes,
  };
}

const routePayload = {
  origin_location_id: 'location-a',
  destination_location_id: 'location-b',
  day_price: 70,
  night_price: 90,
  currency: 'EUR',
};

describe('TransportAdminRepository', () => {
  const module = loadRepository();

  test('provides insert, update, upsert, delete, and reuse over the injected mutation runner', async () => {
    const store = createMemoryStore();
    const repository = module.create({ runMutation: store.runMutation });
    const inserted = await repository.insert({ type: 'transport_route', payload: routePayload });
    expect(inserted.id).toMatch(/^transport_routes-/);
    const updated = await repository.update({
      type: 'transport_route', id: inserted.id, payload: { ...routePayload, day_price: 75 },
    });
    expect(updated.data.day_price).toBe(75);
    const reused = await repository.reuse({ type: 'transport_route', id: inserted.id });
    expect(reused).toMatchObject({ id: inserted.id, reused: true });
    await repository.delete({ type: 'transport_route', id: inserted.id });
    expect(store.rows('transport_routes')).toHaveLength(0);

    const deposit = await repository.upsert({
      type: 'deposit_override',
      payload: { resource_type: 'transport', resource_id: 'route-id', mode: 'flat', amount: 20, currency: 'EUR', include_children: false, enabled: true },
    });
    expect(deposit.id).toMatch(/^service_deposit_overrides-/);
    expect(store.rows('service_deposit_overrides')).toHaveLength(1);
  });

  test('reconciles a 23505 route insert and never performs a second insert', async () => {
    const store = createMemoryStore();
    store.failNext({
      action: 'insert', table: 'transport_routes', afterWrite: true,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const repository = module.create({ runMutation: store.runMutation });
    const result = await repository.insert({ type: 'transport_route', payload: routePayload });

    expect(result.reconciled).toBe(true);
    expect(result.id).toMatch(/^transport_routes-/);
    expect(store.rows('transport_routes')).toHaveLength(1);
    expect(store.writes.filter((entry) => entry === 'insert:transport_routes')).toHaveLength(1);
  });

  test('reconciles an ambiguous pricing timeout using route, payload fingerprint, and creation time', async () => {
    const store = createMemoryStore();
    const pricing = { route_id: 'route-id', extra_passenger_fee: 5, priority: 0, is_active: true };
    store.failNext({
      action: 'insert', table: 'transport_pricing_rules', afterWrite: true,
      error: Object.assign(new Error('network timeout after write'), { name: 'TimeoutError' }),
    });
    const repository = module.create({ runMutation: store.runMutation });
    const result = await repository.insert({
      type: 'pricing_rule', payload: pricing, createdAt: '2026-07-27T10:00:00.000Z',
    });

    expect(result.reconciled).toBe(true);
    expect(store.rows('transport_pricing_rules')).toHaveLength(1);
  });

  test('prevents a recent pricing retry duplicate but permits an older intentional matching rule', async () => {
    const recentStore = createMemoryStore({
      transport_pricing_rules: [{
        id: 'pricing-existing', route_id: 'route-id', extra_passenger_fee: 5, priority: 0,
        is_active: true, night_start: '22:00:00', created_at: '2026-07-27T10:00:01.000Z',
      }],
    });
    const recentRepository = module.create({ runMutation: recentStore.runMutation });
    const recent = await recentRepository.insert({
      type: 'pricing_rule',
      payload: { route_id: 'route-id', extra_passenger_fee: 5, priority: 0, is_active: true, night_start: '22:00' },
      createdAt: '2026-07-27T10:00:00.000Z',
    });
    expect(recent).toMatchObject({ id: 'pricing-existing', reconciled: true });
    expect(recentStore.writes).toHaveLength(0);

    const oldStore = createMemoryStore({
      transport_pricing_rules: [{
        id: 'pricing-old', route_id: 'route-id', extra_passenger_fee: 5, priority: 0,
        is_active: true, created_at: '2026-07-01T10:00:00.000Z',
      }],
    });
    const oldRepository = module.create({ runMutation: oldStore.runMutation });
    const inserted = await oldRepository.insert({
      type: 'pricing_rule',
      payload: { route_id: 'route-id', extra_passenger_fee: 5, priority: 0, is_active: true },
      createdAt: '2026-07-27T10:00:00.000Z',
    });
    expect(inserted.reconciled).not.toBe(true);
    expect(oldStore.rows('transport_pricing_rules')).toHaveLength(2);
  });

  test('reconciles an existing identical deposit override without another upsert', async () => {
    const payload = {
      resource_type: 'transport', resource_id: 'route-id', mode: 'percent_total', amount: 25,
      currency: 'EUR', include_children: false, enabled: true,
    };
    const store = createMemoryStore({
      service_deposit_overrides: [{ id: 'deposit-existing', ...payload }],
    });
    const repository = module.create({ runMutation: store.runMutation });
    const result = await repository.upsert({ type: 'deposit_override', payload });
    expect(result).toMatchObject({ id: 'deposit-existing', reconciled: true });
    expect(store.writes).toHaveLength(0);
  });

  test('filters exact updates by id and expectedUpdatedAt and treats zero rows as stale', async () => {
    const store = createMemoryStore({
      transport_routes: [{
        id: 'route-exact', day_price: 50, updated_at: '2026-08-01T10:00:00.000Z', hidden: 'keep',
      }],
    });
    const repository = module.create({ runMutation: store.runMutation });

    const updated = await repository.update({
      type: 'transport_route',
      id: 'route-exact',
      expectedUpdatedAt: '2026-08-01T10:00:00.000Z',
      payload: { day_price: 60 },
    });
    expect(updated).toMatchObject({ id: 'route-exact', data: { day_price: 60, hidden: 'keep' } });

    await expect(repository.update({
      type: 'transport_route',
      id: 'route-exact',
      expectedUpdatedAt: '2026-08-01T09:00:00.000Z',
      payload: { day_price: 70 },
    })).rejects.toMatchObject({ code: 'transport_pair_stale_conflict' });
    expect(store.rows('transport_routes')[0].day_price).toBe(60);
  });

  test('deletes an override only by exact id and expectedUpdatedAt', async () => {
    const store = createMemoryStore({
      service_deposit_overrides: [{
        id: 'override-exact', resource_type: 'transport', resource_id: 'route-exact',
        updated_at: '2026-08-01T10:00:00.000Z',
      }],
    });
    const repository = module.create({ runMutation: store.runMutation });

    await expect(repository.delete({
      type: 'deposit_override',
      id: 'override-exact',
      expectedUpdatedAt: '2026-08-01T09:00:00.000Z',
    })).rejects.toMatchObject({ code: 'transport_pair_stale_conflict' });
    expect(store.rows('service_deposit_overrides')).toHaveLength(1);

    await repository.delete({
      type: 'deposit_override',
      id: 'override-exact',
      expectedUpdatedAt: '2026-08-01T10:00:00.000Z',
    });
    expect(store.rows('service_deposit_overrides')).toHaveLength(0);
  });

  test('treats an appeared or unique-conflicting deposit insert as stale', async () => {
    const existingStore = createMemoryStore({
      service_deposit_overrides: [{
        id: 'override-existing', resource_type: 'transport', resource_id: 'route-exact',
      }],
    });
    const existingRepository = module.create({ runMutation: existingStore.runMutation });
    await expect(existingRepository.insert({
      type: 'deposit_override',
      expectAbsent: true,
      payload: { resource_type: 'transport', resource_id: 'route-exact', mode: 'flat', amount: 20 },
    })).rejects.toMatchObject({ code: 'transport_pair_stale_conflict' });
    expect(existingStore.writes).toHaveLength(0);

    const raceStore = createMemoryStore();
    raceStore.failNext({
      action: 'insert', table: 'service_deposit_overrides',
      error: { code: '23505', message: 'duplicate override' },
    });
    const raceRepository = module.create({ runMutation: raceStore.runMutation });
    await expect(raceRepository.insert({
      type: 'deposit_override',
      expectAbsent: true,
      payload: { resource_type: 'transport', resource_id: 'route-exact', mode: 'flat', amount: 20 },
    })).rejects.toMatchObject({ code: 'transport_pair_stale_conflict' });
  });
});
