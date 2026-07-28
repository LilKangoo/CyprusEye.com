import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type TransportAdminCoreApi = Record<string, (...args: any[]) => any>;

function loadTransportAdminCore(): TransportAdminCoreApi {
  const filename = path.join(process.cwd(), 'admin/transport-admin-core.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.TransportAdminCore as TransportAdminCoreApi;
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('Transport Admin save-plan builder', () => {
  const core = loadTransportAdminCore();
  const baseDraft = {
    route: {
      originLocationId: 'location-a',
      destinationLocationId: 'location-b',
      isActive: true,
      sortOrder: 0,
    },
    price: {
      dayPrice: 60,
      nightPrice: 80,
      currency: 'EUR',
      reverseDayPrice: null,
      reverseNightPrice: null,
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
      reverseSettings: 'shared',
      existingReverseAction: null,
    },
    pricing: {
      enabled: false,
      applyToReverse: true,
    },
  };

  test('builds a one-route plan without pricing or global changes', () => {
    const plan = plain(core.buildTransportSavePlan(baseDraft, {}, {
      runId: 'run-one',
      createdAt: '2026-07-27T10:00:00.000Z',
    }));

    expect(plan.id).toBe('run-one');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({
      key: 'route_outbound',
      type: 'transport_route',
      action: 'insert',
      dependsOn: [],
      status: 'pending',
    });
    expect(plan.summary).toEqual({
      routeCreates: 1,
      routeUpdates: 0,
      routeReuses: 0,
      pricingCreates: 0,
      depositUpserts: 0,
      globalChanges: 0,
    });
  });

  test('builds outbound and reverse route steps with shared prices', () => {
    const plan = plain(core.buildTransportSavePlan({
      ...baseDraft,
      direction: {
        mode: 'bidirectional',
        reverseSettings: 'shared',
      },
    }));

    expect(plan.steps.map((step: { key: string }) => step.key)).toEqual([
      'route_outbound',
      'route_reverse',
    ]);
    expect(plan.steps[1].dependsOn).toEqual(['route_outbound']);
    expect(plan.steps[1].payload).toMatchObject({
      origin_location_id: 'location-b',
      destination_location_id: 'location-a',
      day_price: 60,
      night_price: 80,
    });
    expect(plan.summary.routeCreates).toBe(2);
  });

  test('builds separate reverse prices without changing remaining fields', () => {
    const plan = plain(core.buildTransportSavePlan({
      ...baseDraft,
      price: {
        ...baseDraft.price,
        reverseDayPrice: 52,
        reverseNightPrice: 73,
      },
      direction: {
        mode: 'bidirectional',
        reverseSettings: 'separate_prices',
      },
    }));
    const outbound = plan.steps[0].payload;
    const reverse = plan.steps[1].payload;

    expect(reverse.day_price).toBe(52);
    expect(reverse.night_price).toBe(73);
    expect(reverse.currency).toBe(outbound.currency);
    expect(reverse.included_passengers).toBe(outbound.included_passengers);
    expect(reverse.max_bags).toBe(outbound.max_bags);
    expect(reverse.allows_round_trip).toBe(outbound.allows_round_trip);
  });

  test('adds pricing and deposit steps with explicit dependencies', () => {
    const plan = plain(core.buildTransportSavePlan({
      ...baseDraft,
      direction: {
        mode: 'bidirectional',
        reverseSettings: 'shared',
      },
      pricing: {
        enabled: true,
        applyToReverse: true,
        extraPassengerFee: 7,
        extraBagFee: 3,
        oversizeBagFee: 11,
        waitingFeePerHour: 30,
        deposit: {
          enabled: true,
          mode: 'fixed_amount',
          value: 20,
        },
      },
    }, {
      depositBaseFloor: 10,
      serviceDepositDefaults: { includeChildren: true },
    }));

    expect(plan.steps.map((step: { key: string }) => step.key)).toEqual([
      'route_outbound',
      'route_reverse',
      'pricing_outbound',
      'pricing_reverse',
      'deposit_outbound',
      'deposit_reverse',
    ]);
    expect(plan.steps.find((step: { key: string }) => step.key === 'pricing_outbound')).toMatchObject({
      dependsOn: ['route_outbound'],
      payloadRefs: { route_id: 'route_outbound.result.id' },
    });
    expect(plan.steps.find((step: { key: string }) => step.key === 'deposit_reverse')).toMatchObject({
      dependsOn: ['pricing_reverse'],
      payloadRefs: { resource_id: 'route_reverse.result.id' },
    });
    expect(plan.summary).toMatchObject({
      routeCreates: 2,
      pricingCreates: 2,
      depositUpserts: 2,
      globalChanges: 0,
    });
  });

  test.each([
    ['percent_total', true],
    ['percent_total', false],
    ['per_person', true],
    ['per_person', false],
    ['fixed_amount', true],
    ['fixed_amount', false],
  ])('keeps Wizard and Legacy deposit payload parity for %s with includeChildren=%s', (mode, includeChildren) => {
    const depositValue = mode === 'percent_total' ? 25 : 20;
    const legacyPayload = plain(core.buildTransportDepositOverridePayload({
      routeId: 'route-id',
      depositEnabled: true,
      depositMode: mode,
      depositValue,
      currency: 'EUR',
      includeChildren,
    }));
    const plan = plain(core.buildTransportSavePlan({
      ...baseDraft,
      pricing: {
        enabled: true,
        applyToReverse: false,
        deposit: {
          enabled: true,
          mode,
          value: depositValue,
        },
      },
    }, {
      serviceDepositDefaults: { includeChildren },
    }));
    const wizardPayload = plan.steps.find((step: { key: string }) => step.key === 'deposit_outbound').payload;

    expect({ ...wizardPayload, resource_id: 'route-id' }).toEqual(legacyPayload);
  });

  test('reuses an existing reverse route without mutating it or cloning pricing', () => {
    const plan = plain(core.buildTransportSavePlan({
      ...baseDraft,
      direction: {
        mode: 'bidirectional',
        reverseSettings: 'shared',
        existingReverseAction: 'reuse',
      },
      pricing: {
        enabled: true,
        applyToReverse: true,
      },
    }, {
      existingReverse: { id: 'existing-reverse-id' },
    }));
    const reverse = plan.steps.find((step: { key: string }) => step.key === 'route_reverse');

    expect(reverse).toMatchObject({
      action: 'reuse',
      existingId: 'existing-reverse-id',
      payload: null,
    });
    expect(plan.steps.some((step: { key: string }) => step.key === 'pricing_reverse')).toBe(false);
    expect(plan.summary.routeReuses).toBe(1);
  });

  test('does not mutate the source draft while building a plan', () => {
    const source = JSON.parse(JSON.stringify(baseDraft));
    const before = JSON.parse(JSON.stringify(source));

    core.buildTransportSavePlan(source);

    expect(source).toEqual(before);
  });
});
