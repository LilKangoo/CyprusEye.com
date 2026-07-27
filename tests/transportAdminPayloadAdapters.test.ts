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

describe('Transport Admin payload adapters', () => {
  const core = loadTransportAdminCore();
  const baseRoute = {
    originLocationId: 'origin-id',
    destinationLocationId: 'destination-id',
    dayPrice: 55.5,
    nightPrice: 70,
    currency: ' eur ',
    includedPassengers: 3,
    includedBags: 2,
    includedLargeBags: 1,
    maxPassengers: 7,
    maxBags: 6,
    tripMode: 'round_trip',
    roundTripMultiplier: 1.75,
    sortOrder: 4,
    isActive: false,
  };

  test('builds the standard Legacy route payload with exact columns', () => {
    expect(plain(core.buildTransportRoutePayload(baseRoute))).toEqual({
      origin_location_id: 'origin-id',
      destination_location_id: 'destination-id',
      day_price: 55.5,
      night_price: 70,
      currency: 'EUR',
      included_passengers: 3,
      included_bags: 2,
      included_large_bags: 1,
      max_passengers: 7,
      max_bags: 6,
      allows_round_trip: true,
      round_trip_multiplier: 1.75,
      sort_order: 4,
      is_active: false,
    });
  });

  test('forces the Legacy one-way multiplier to 2', () => {
    const payload = plain(core.buildTransportRoutePayload({
      ...baseRoute,
      tripMode: 'one_way',
      roundTripMultiplier: 4.5,
    }));

    expect(payload.allows_round_trip).toBe(false);
    expect(payload.round_trip_multiplier).toBe(2);
  });

  test('preserves capacity, zero prices, currency defaults, and active state', () => {
    const payload = plain(core.buildTransportRoutePayload({
      ...baseRoute,
      dayPrice: 0,
      nightPrice: 0,
      currency: '',
      includedPassengers: 1,
      includedBags: 0,
      includedLargeBags: 0,
      maxPassengers: 1,
      maxBags: 0,
      isActive: true,
    }));

    expect(payload).toMatchObject({
      day_price: 0,
      night_price: 0,
      currency: 'EUR',
      included_passengers: 1,
      included_bags: 0,
      included_large_bags: 0,
      max_passengers: 1,
      max_bags: 0,
      is_active: true,
    });
  });

  test('builds a reverse payload with swapped endpoints and shared prices', () => {
    const outbound = plain(core.buildTransportRoutePayload(baseRoute));
    const reverse = plain(core.buildReverseRoutePayload(outbound));

    expect(reverse.origin_location_id).toBe(outbound.destination_location_id);
    expect(reverse.destination_location_id).toBe(outbound.origin_location_id);
    expect(reverse.day_price).toBe(outbound.day_price);
    expect(reverse.night_price).toBe(outbound.night_price);
  });

  test('changes only reverse day and night prices when supplied', () => {
    const outbound = plain(core.buildTransportRoutePayload(baseRoute));
    const reverse = plain(core.buildReverseRoutePayload(outbound, {
      dayPrice: 61,
      nightPrice: 79,
    }));
    const expected = {
      ...outbound,
      origin_location_id: outbound.destination_location_id,
      destination_location_id: outbound.origin_location_id,
      day_price: 61,
      night_price: 79,
    };

    expect(reverse).toEqual(expected);
  });

  test('builds all pricing fields including hourly and per-minute waiting', () => {
    const payload = plain(core.buildTransportPricingRulePayload({
      routeId: 'route-id',
      extraPassengerFee: 8,
      extraBagFee: 4,
      oversizeBagFee: 12,
      childSeatFee: 6,
      boosterSeatFee: 5,
      waitingIncludedMinutes: 30,
      waitingFeePerHour: 90,
      nightStart: '21:30',
      nightEnd: '05:45',
      validFrom: '2026-08-01',
      validTo: '2026-08-31',
      priority: 3,
      isActive: false,
      depositEnabled: true,
      depositMode: 'percent_total',
      depositValue: 25,
    }, { depositBaseFloor: 15 }));

    expect(payload).toEqual({
      route_id: 'route-id',
      extra_passenger_fee: 8,
      extra_bag_fee: 4,
      oversize_bag_fee: 12,
      child_seat_fee: 6,
      booster_seat_fee: 5,
      waiting_included_minutes: 30,
      waiting_fee_per_hour: 90,
      waiting_fee_per_minute: 1.5,
      deposit_enabled: true,
      deposit_mode: 'percent_total',
      deposit_value: 25,
      deposit_base_floor: 15,
      night_start: '21:30',
      night_end: '05:45',
      valid_from: '2026-08-01',
      valid_to: '2026-08-31',
      priority: 3,
      is_active: false,
    });
  });

  test('rounds the legacy waiting per-minute conversion to four decimals', () => {
    const payload = plain(core.buildTransportPricingRulePayload({
      routeId: 'route-id',
      waitingFeePerHour: 25,
    }));

    expect(payload.waiting_fee_per_minute).toBe(0.4167);
  });

  test('sets deposit value to zero when the pricing deposit is disabled', () => {
    const payload = plain(core.buildTransportPricingRulePayload({
      routeId: 'route-id',
      depositEnabled: false,
      depositMode: 'fixed_amount',
      depositValue: 45,
    }, { depositBaseFloor: 10 }));

    expect(payload.deposit_enabled).toBe(false);
    expect(payload.deposit_mode).toBe('fixed_amount');
    expect(payload.deposit_value).toBe(0);
    expect(payload.deposit_base_floor).toBe(10);
  });

  test.each([
    ['fixed_amount', 'flat'],
    ['percent_total', 'percent_total'],
    ['per_person', 'per_person'],
  ])('maps %s pricing deposit to %s service override', (depositMode, expectedMode) => {
    const payload = plain(core.buildTransportDepositOverridePayload({
      routeId: 'route-id',
      depositEnabled: true,
      depositMode,
      depositValue: 20,
      currency: ' eur ',
      includeChildren: true,
    }));

    expect(payload).toEqual({
      resource_type: 'transport',
      resource_id: 'route-id',
      mode: expectedMode,
      amount: 20,
      currency: 'EUR',
      include_children: true,
      enabled: true,
    });
  });

  test('returns no override payload for a disabled deposit', () => {
    expect(core.buildTransportDepositOverridePayload({
      routeId: 'route-id',
      depositEnabled: false,
      depositMode: 'fixed_amount',
      depositValue: 20,
    })).toBeNull();
  });
});

describe('Transport Admin draft validation', () => {
  const core = loadTransportAdminCore();
  const validRoute = {
    originLocationId: 'origin-id',
    destinationLocationId: 'destination-id',
    dayPrice: 50,
    nightPrice: 70,
    currency: 'EUR',
    includedPassengers: 2,
    includedBags: 2,
    includedLargeBags: 0,
    maxPassengers: 8,
    maxBags: 8,
    tripMode: 'one_way',
    roundTripMultiplier: 2,
    sortOrder: 0,
    isActive: true,
  };

  test('legacy profile allows zero route prices', () => {
    const result = plain(core.validateTransportRouteDraft({
      route: { ...validRoute, dayPrice: 0, nightPrice: 0 },
    }, {}, { profile: 'legacy' }));

    expect(result.valid).toBe(true);
  });

  test('wizard profile blocks zero route prices', () => {
    const result = plain(core.validateTransportRouteDraft({
      route: { ...validRoute, dayPrice: 0, nightPrice: 0 },
    }, {}, { profile: 'wizard' }));

    expect(result.valid).toBe(false);
    expect(result.errors.map((error: { code: string }) => error.code)).toContain('route_prices_positive');
  });

  test('blocks equal route endpoints', () => {
    const result = plain(core.validateTransportRouteDraft({
      route: { ...validRoute, destinationLocationId: validRoute.originLocationId },
    }, {}, { profile: 'legacy' }));

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('route_endpoints_equal');
  });

  test('blocks invalid capacity', () => {
    const result = plain(core.validateTransportRouteDraft({
      route: {
        ...validRoute,
        includedPassengers: 5,
        maxPassengers: 4,
        includedBags: 3,
        includedLargeBags: 2,
        maxBags: 4,
      },
    }, {}, { profile: 'legacy' }));

    const codes = result.errors.map((error: { code: string }) => error.code);
    expect(codes).toContain('max_passengers_invalid');
    expect(codes).toContain('max_bags_invalid');
  });

  test('blocks an invalid round-trip multiplier', () => {
    const result = plain(core.validateTransportRouteDraft({
      route: { ...validRoute, tripMode: 'round_trip', roundTripMultiplier: 6 },
    }, {}, { profile: 'legacy' }));

    expect(result.errors.map((error: { code: string }) => error.code)).toContain('round_trip_multiplier_invalid');
  });

  test('blocks invalid enabled deposit settings', () => {
    const result = plain(core.validateTransportRouteDraft({
      pricing: {
        routeId: 'route-id',
        depositEnabled: true,
        depositMode: 'percent_total',
        depositValue: 0,
      },
    }, {}, { profile: 'legacy' }));

    expect(result.valid).toBe(false);
    expect(result.errors.map((error: { code: string }) => error.code)).toContain('deposit_enabled_value_invalid');
  });

  test('blocks invalid pricing validity dates', () => {
    const result = plain(core.validateTransportRouteDraft({
      pricing: {
        routeId: 'route-id',
        validFrom: '2026-09-10',
        validTo: '2026-09-01',
      },
    }, {}, { profile: 'legacy' }));

    expect(result.valid).toBe(false);
    expect(result.errors.map((error: { code: string }) => error.code)).toContain('pricing_validity_invalid');
  });

  test('blocks inactive locations only in wizard profile', () => {
    const context = {
      locations: [
        { id: 'origin-id', is_active: false },
        { id: 'destination-id', is_active: true },
      ],
    };
    const legacy = plain(core.validateTransportRouteDraft(
      { route: validRoute },
      context,
      { profile: 'legacy' },
    ));
    const wizard = plain(core.validateTransportRouteDraft(
      { route: validRoute },
      context,
      { profile: 'wizard' },
    ));

    expect(legacy.valid).toBe(true);
    expect(wizard.valid).toBe(false);
    expect(wizard.errors.map((error: { code: string }) => error.code)).toContain('origin_location_inactive');
  });
});
