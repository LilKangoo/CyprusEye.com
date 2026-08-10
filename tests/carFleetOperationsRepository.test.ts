import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadModules(): { core: any; repository: any } {
  const context: Record<string, unknown> = {};
  for (const relative of ['admin/car-rental-multicity-core.js', 'admin/car-rental-multicity-repository.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return { core: context.CarRentalMulticityCore, repository: context.CarRentalMulticityRepository };
}

const TARGET = {
  offer_id: 'offer-one',
  expected_updated_at: '2026-08-11T00:00:00Z',
  expected_availability: [],
  expected_deposit_override: null,
  desired_availability: null,
  target_availability_mode: 'legacy',
};

describe('Fleet transactional repository contract', () => {
  const { core, repository: repositoryApi } = loadModules();

  test('uses one exact transactional RPC and returns its deterministic receipt', async () => {
    const calls: any[] = [];
    const client = {
      from() { return {}; },
      async rpc(name: string, params: any) {
        calls.push({ name, params });
        return { data: { target_count: 1, offer_ids: ['offer-one'], operation: 'fleet_bulk' }, error: null };
      },
    };
    const repository = repositoryApi.create({ client, core });
    const receipt = await repository.applyFleetBulkOperation({
      valid: true,
      targets: [TARGET],
      operations: { availability_mode: 'no_change', cities: [], security_deposit: { action: 'none' } },
    });
    expect(receipt).toMatchObject({ target_count: 1, offer_ids: ['offer-one'] });
    expect(calls).toEqual([{
      name: 'admin_apply_car_fleet_bulk_operation',
      params: expect.objectContaining({
        p_targets: [expect.objectContaining({ offer_id: 'offer-one', expected_availability: [], desired_availability: null })],
        p_operations: expect.objectContaining({ availability_mode: 'no_change' }),
      }),
    }]);
  });

  test('maps stale RPC failure to one no-partial-result concurrency error', async () => {
    const client = {
      from() { return {}; },
      async rpc() { return { data: null, error: { code: '40001', message: 'fleet_bulk_stale' } }; },
    };
    const repository = repositoryApi.create({ client, core });
    await expect(repository.applyFleetBulkOperation({ valid: true, targets: [TARGET], operations: {} }))
      .rejects.toMatchObject({ code: 'car_multicity_stale_conflict' });
  });

  test('rejects invalid plan and unexpected exact IDs without a fallback write', async () => {
    let calls = 0;
    const client = {
      from() { return {}; },
      async rpc() {
        calls += 1;
        return { data: { target_count: 1, offer_ids: ['other-offer'] }, error: null };
      },
    };
    const repository = repositoryApi.create({ client, core });
    await expect(repository.applyFleetBulkOperation({ valid: false, targets: [], operations: {} }))
      .rejects.toMatchObject({ code: 'car_multicity_internal_error' });
    expect(calls).toBe(0);
    await expect(repository.applyFleetBulkOperation({ valid: true, targets: [TARGET], operations: {} }))
      .rejects.toMatchObject({ code: 'car_multicity_internal_error' });
    expect(calls).toBe(1);
  });
});
