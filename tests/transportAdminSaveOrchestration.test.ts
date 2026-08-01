import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type CoreApi = Record<string, (...args: any[]) => any>;

function loadCore(): CoreApi {
  const filename = path.join(process.cwd(), 'admin/transport-admin-core.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.TransportAdminCore as CoreApi;
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const baseDraft = {
  route: {
    originLocationId: 'location-a',
    destinationLocationId: 'location-b',
    isActive: true,
    sortOrder: 1,
  },
  price: {
    dayPrice: 70,
    nightPrice: 90,
    currency: 'EUR',
  },
  capacity: {
    includedPassengers: 2,
    includedBags: 2,
    includedLargeBags: 0,
    maxPassengers: 8,
    maxBags: 8,
  },
  legacy: {
    allowsRoundTrip: false,
    roundTripMultiplier: 2,
  },
  direction: {
    mode: 'outbound_only',
  },
  pricing: {
    enabled: true,
    applyToReverse: true,
    extraPassengerFee: 5,
    deposit: {
      enabled: true,
      mode: 'fixed_amount',
      value: 20,
    },
  },
};

describe('executeTransportSavePlan', () => {
  const core = loadCore();

  test('executes dependencies sequentially and resolves payload references to saved IDs', async () => {
    const calls: Array<{ action: string; request: any }> = [];
    const repository = {
      async insert(request: any) {
        calls.push({ action: 'insert', request: plain(request) });
        return { data: { ...request.payload, id: `${request.stepKey}-id` } };
      },
      async upsert(request: any) {
        calls.push({ action: 'upsert', request: plain(request) });
        return { data: { ...request.payload, id: `${request.stepKey}-id` } };
      },
    };
    const plan = core.buildTransportSavePlan(baseDraft, {}, {
      runId: 'run-sequential',
      createdAt: '2026-07-27T10:00:00.000Z',
    });

    const result = plain(await core.executeTransportSavePlan(plan, repository, {
      now: (() => {
        const values = [1000, 1075];
        return () => values.shift() ?? 1075;
      })(),
    }));

    expect(calls.map((entry) => entry.request.stepKey)).toEqual([
      'route_outbound',
      'pricing_outbound',
      'deposit_outbound',
    ]);
    expect(calls[1].request.payload.route_id).toBe('route_outbound-id');
    expect(calls[2].request.payload.resource_id).toBe('route_outbound-id');
    expect(result.status).toBe('success');
    expect(result.steps.every((step: any) => step.status === 'success')).toBe(true);
    expect(result.steps[0].result.id).toBe('route_outbound-id');
    expect(result.steps[0].attempts).toBe(1);
    expect(result.execution).toMatchObject({ durationMs: 75, succeeded: 3, failed: 0, skipped: 0, runs: 1 });
  });

  test('retains successful steps and retries only errors plus dependency-skipped steps', async () => {
    const calls: string[] = [];
    let failReverse = true;
    const repository = {
      async insert(request: any) {
        calls.push(request.stepKey);
        if (request.stepKey === 'route_reverse' && failReverse) {
          const error: any = new Error('reverse failed');
          error.code = 'network_timeout';
          throw error;
        }
        return { data: { ...request.payload, id: `${request.stepKey}-id` } };
      },
      async upsert(request: any) {
        calls.push(request.stepKey);
        return { data: { ...request.payload, id: `${request.stepKey}-id` } };
      },
    };
    const plan = core.buildTransportSavePlan({
      ...baseDraft,
      direction: { mode: 'bidirectional', reverseSettings: 'shared_settings' },
    }, {}, { runId: 'run-retry', createdAt: '2026-07-27T10:00:00.000Z' });

    const first = plain(await core.executeTransportSavePlan(plan, repository));
    expect(first.status).toBe('partial');
    expect(first.steps.find((step: any) => step.key === 'route_outbound')).toMatchObject({
      status: 'success',
      attempts: 1,
    });
    expect(first.steps.find((step: any) => step.key === 'route_reverse')).toMatchObject({
      status: 'error',
      attempts: 1,
    });
    expect(first.steps.find((step: any) => step.key === 'pricing_reverse')).toMatchObject({
      status: 'skipped',
      skipReason: 'dependency',
      attempts: 0,
    });

    calls.length = 0;
    failReverse = false;
    const retried = plain(await core.executeTransportSavePlan(first, repository, { retry: true }));

    expect(calls).toEqual(['route_reverse', 'pricing_reverse', 'deposit_reverse']);
    expect(retried.status).toBe('success');
    expect(retried.steps.find((step: any) => step.key === 'route_outbound').attempts).toBe(1);
    expect(retried.steps.find((step: any) => step.key === 'pricing_outbound').attempts).toBe(1);
    expect(retried.steps.find((step: any) => step.key === 'route_reverse').attempts).toBe(2);
    expect(retried.execution.runs).toBe(2);
  });

  test('records reconciliation without issuing an executor-level second insert', async () => {
    let calls = 0;
    const plan = core.buildTransportSavePlan({ ...baseDraft, pricing: { enabled: false } }, {}, {
      runId: 'run-reconciled',
    });
    const result = plain(await core.executeTransportSavePlan(plan, {
      async insert(request: any) {
        calls += 1;
        return { data: { ...request.payload, id: 'existing-route-id' }, reconciled: true };
      },
    }));

    expect(calls).toBe(1);
    expect(result.steps[0]).toMatchObject({
      status: 'success',
      reconciled: true,
      result: { id: 'existing-route-id', reconciled: true },
    });
  });

  test('supports cancellation and does not call the repository after an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort('test cancellation');
    let calls = 0;
    const plan = core.buildTransportSavePlan({
      ...baseDraft,
      direction: { mode: 'bidirectional', reverseSettings: 'shared_settings' },
    }, {}, { runId: 'run-cancelled' });

    const result = plain(await core.executeTransportSavePlan(plan, {
      async insert() {
        calls += 1;
        return { data: { id: 'unexpected' } };
      },
      async upsert() {
        calls += 1;
        return { data: { id: 'unexpected' } };
      },
    }, { signal: controller.signal }));

    expect(calls).toBe(0);
    expect(result.status).toBe('cancelled');
    expect(result.steps.every((step: any) => step.status === 'skipped' && step.skipReason === 'cancelled')).toBe(true);
    expect(result.execution.retryable).toEqual([]);
  });

  test('topologically orders an out-of-order plan and rejects invalid dependency graphs', async () => {
    const calls: string[] = [];
    const routeStep = {
      key: 'route', type: 'transport_route', action: 'insert', payload: { day_price: 1 },
      payloadRefs: {}, dependsOn: [], existingId: null, status: 'pending', attempts: 0,
      reconciled: false, skipReason: null, resolvedPayload: null, result: null, error: null,
    };
    const pricingStep = {
      key: 'pricing', type: 'pricing_rule', action: 'insert', payload: { route_id: '$route.id' },
      payloadRefs: { route_id: 'route.result.id' }, dependsOn: ['route'], existingId: null,
      status: 'pending', attempts: 0, reconciled: false, skipReason: null, resolvedPayload: null,
      result: null, error: null,
    };
    const result = await core.executeTransportSavePlan({
      id: 'out-of-order', createdAt: '', status: 'pending', attempts: 0,
      steps: [pricingStep, routeStep], results: {}, summary: {}, execution: null,
    }, {
      async insert(request: any) {
        calls.push(request.stepKey);
        return { data: { id: `${request.stepKey}-id` } };
      },
    });
    expect(calls).toEqual(['route', 'pricing']);
    expect(result.steps[0].resolvedPayload.route_id).toBe('route-id');

    await expect(core.executeTransportSavePlan({
      id: 'cycle', steps: [
        { ...routeStep, key: 'a', dependsOn: ['b'] },
        { ...pricingStep, key: 'b', dependsOn: ['a'] },
      ],
    }, {})).rejects.toMatchObject({ code: 'save_plan_dependency_cycle' });
  });

  test('passes exact IDs, expected timestamps, and insert absence guards to the repository', async () => {
    const calls: Array<{ action: string; request: any }> = [];
    const steps = [
      {
        key: 'route_outbound', type: 'transport_route', action: 'update',
        entityId: 'route-exact', existingId: 'route-exact',
        expectedUpdatedAt: '2026-08-01T08:00:00.000Z', expectAbsent: false,
        payload: { day_price: 80 }, payloadRefs: {}, dependsOn: [], status: 'pending', attempts: 0,
      },
      {
        key: 'deposit_outbound', type: 'deposit_override', action: 'insert',
        entityId: null, existingId: null, expectedUpdatedAt: null, expectAbsent: true,
        payload: { resource_type: 'transport', resource_id: 'route-exact', mode: 'flat', amount: 20 },
        payloadRefs: {}, dependsOn: ['route_outbound'], status: 'pending', attempts: 0,
      },
      {
        key: 'deposit_reverse', type: 'deposit_override', action: 'delete',
        entityId: 'override-exact', existingId: 'override-exact',
        expectedUpdatedAt: '2026-08-01T08:05:00.000Z', expectAbsent: false,
        payload: null, payloadRefs: {}, dependsOn: [], status: 'pending', attempts: 0,
      },
    ];
    const repository = {
      async update(request: any) {
        calls.push({ action: 'update', request: plain(request) });
        return { data: { id: request.id, ...request.payload } };
      },
      async insert(request: any) {
        calls.push({ action: 'insert', request: plain(request) });
        return { data: { id: 'override-created', ...request.payload } };
      },
      async delete(request: any) {
        calls.push({ action: 'delete', request: plain(request) });
        return { data: { id: request.id } };
      },
    };

    const result = plain(await core.executeTransportSavePlan({
      id: 'pair-exact', createdAt: '2026-08-01T10:00:00.000Z', status: 'pending', attempts: 0,
      steps, results: {}, summary: { globalChanges: 0 }, execution: null,
    }, repository));

    expect(result.status).toBe('success');
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'update',
        request: expect.objectContaining({
          id: 'route-exact',
          entityId: 'route-exact',
          expectedUpdatedAt: '2026-08-01T08:00:00.000Z',
          expectAbsent: false,
        }),
      }),
      expect.objectContaining({
        action: 'insert',
        request: expect.objectContaining({
          id: null,
          entityId: null,
          expectAbsent: true,
        }),
      }),
      expect.objectContaining({
        action: 'delete',
        request: expect.objectContaining({
          id: 'override-exact',
          entityId: 'override-exact',
          expectedUpdatedAt: '2026-08-01T08:05:00.000Z',
        }),
      }),
    ]));
  });

  test('does not execute an already successful plan again', async () => {
    let calls = 0;
    const plan = core.buildTransportSavePlan({ ...baseDraft, pricing: { enabled: false } });
    const repository = {
      async insert() {
        calls += 1;
        return { data: { id: 'route-id' } };
      },
    };
    const first = await core.executeTransportSavePlan(plan, repository);
    const second = await core.executeTransportSavePlan(first, repository);
    expect(second.status).toBe('success');
    expect(calls).toBe(1);
  });
});
