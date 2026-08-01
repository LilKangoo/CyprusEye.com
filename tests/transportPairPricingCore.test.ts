import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type CoreApi = {
  createTransportPairPricingDraft: (context: Record<string, unknown>) => any;
  hydrateTransportPairSharedValues: (draft: any, options?: Record<string, unknown>) => any;
  validateTransportPairPricingDraft: (draft: any) => any;
  buildTransportPairPricingDiff: (draft: any) => any[];
  buildTransportPairPricingReviewPlan: (draft: any, context?: Record<string, unknown>) => any;
  buildTransportPairPricingSavePlan: (reviewPlan: any, freshContext: any, options?: Record<string, unknown>) => any;
  abandonTransportPairPricingSavePlan: (savePlan: any, options?: Record<string, unknown>) => any;
  fingerprintTransportPairPricingDraft: (draft: any) => string;
  getTransportPairDepositAccess: (draft: any) => any;
  isTransportPairPricingReviewCurrent: (draft: any, fingerprint?: string) => boolean;
  isTransportPairPricingRetryAvailable: (savePlan: any, draft: any, reviewPlan: any) => boolean;
  preflightTransportPairPricingReview: (draft: any, reviewPlan: any, freshContext: any) => any;
  precheckTransportPairPricingRetry: (savePlan: any, draft: any, reviewPlan: any, freshContext: any) => any;
  verifyTransportPairPricingSaveResult: (savePlan: any, freshContext: any) => any;
};

function loadCore(): CoreApi {
  const filename = path.join(process.cwd(), 'admin/transport-pair-pricing-core.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.TransportPairPricingCore as CoreApi;
}

function loadBuilders(): Record<string, (...args: any[]) => any> {
  const filename = path.join(process.cwd(), 'admin/transport-admin-core.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.TransportAdminCore as Record<string, (...args: any[]) => any>;
}

const route = (overrides: Record<string, unknown> = {}) => ({
  id: 'route-a-b',
  origin_location_id: 'location-a',
  destination_location_id: 'location-b',
  day_price: 50,
  night_price: 70,
  currency: 'EUR',
  included_passengers: 2,
  included_bags: 2,
  included_large_bags: 1,
  max_passengers: 8,
  max_bags: 8,
  allows_round_trip: true,
  round_trip_multiplier: 1.8,
  sort_order: 3,
  is_active: true,
  owner_partner_id: 'partner-one',
  updated_at: '2026-08-01T08:00:00.000Z',
  ...overrides,
});

const reverseRoute = (overrides: Record<string, unknown> = {}) => route({
  id: 'route-b-a',
  origin_location_id: 'location-b',
  destination_location_id: 'location-a',
  updated_at: '2026-08-01T08:05:00.000Z',
  ...overrides,
});

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: 'rule-a-b',
  route_id: 'route-a-b',
  extra_passenger_fee: 5,
  extra_bag_fee: 3,
  oversize_bag_fee: 10,
  child_seat_fee: 4,
  booster_seat_fee: 4,
  waiting_included_minutes: 15,
  waiting_fee_per_hour: 20,
  waiting_fee_per_minute: 0.3333,
  night_start: '22:00:00',
  night_end: '06:00:00',
  deposit_enabled: true,
  deposit_mode: 'fixed_amount',
  deposit_value: 20,
  deposit_base_floor: 12,
  valid_from: '2026-08-01',
  valid_to: '2026-12-31',
  priority: 4,
  is_active: true,
  custom_preserved_column: 'keep-me',
  updated_at: '2026-08-01T09:00:00.000Z',
  ...overrides,
});

const reverseRule = (overrides: Record<string, unknown> = {}) => rule({
  id: 'rule-b-a',
  route_id: 'route-b-a',
  updated_at: '2026-08-01T09:05:00.000Z',
  ...overrides,
});

const depositDefault = {
  resource_type: 'transport',
  mode: 'flat',
  amount: 12,
  currency: 'EUR',
  include_children: true,
  enabled: true,
  updated_at: '2026-08-01T07:00:00.000Z',
};

function pairContext(overrides: Record<string, unknown> = {}) {
  return {
    loadedAt: '2026-08-01T10:00:00.000Z',
    outboundRoute: route(),
    reverseRoute: reverseRoute(),
    pricingRules: [rule(), reverseRule()],
    depositOverrides: [],
    serviceDepositDefault: depositDefault,
    ...overrides,
  };
}

function reviewableDraft(core: CoreApi, context: Record<string, unknown> = pairContext()) {
  return core.createTransportPairPricingDraft(context);
}

function reviewedDraft(core: CoreApi, context: Record<string, unknown> = pairContext()) {
  const draft = reviewableDraft(core, context);
  const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
  draft.review = { isCurrent: true, fingerprint: plan.fingerprint, plan };
  return { draft, plan };
}

function reviewAfterEdit(
  core: CoreApi,
  mutate: (draft: any) => void,
  context: Record<string, unknown> = pairContext(),
) {
  const draft = reviewableDraft(core, context);
  mutate(draft);
  const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
  draft.review = { isCurrent: true, fingerprint: plan.fingerprint, plan };
  return { draft, plan };
}

describe('Transport Admin Stage 2C pair pricing core', () => {
  const core = loadCore();
  const builders = loadBuilders();

  test('creates an isolated draft with shared values when both directions match', () => {
    const context = pairContext();
    const draft = reviewableDraft(core, context);

    expect(draft.version).toBe(1);
    expect(draft.scope).toEqual({ updateOutbound: true, updateReverse: true });
    expect(draft.selectedRules).toEqual({
      outboundRuleId: 'rule-a-b',
      reverseRuleId: 'rule-b-a',
    });
    expect(draft.shared).toMatchObject({
      dayPrice: 50,
      nightPrice: 70,
      currency: 'EUR',
      includedPassengers: 2,
      extraPassengerFee: 5,
      nightStart: '22:00',
      depositEnabled: true,
      depositMode: 'fixed_amount',
      depositValue: 20,
    });

    draft.snapshot.outboundRoute.day_price = 999;
    expect((context.outboundRoute as any).day_price).toBe(50);
  });

  test('uses explicit Mixed state and never silently copies outbound values', () => {
    const draft = reviewableDraft(core, pairContext({
      reverseRoute: reverseRoute({ day_price: 65, currency: 'USD' }),
      pricingRules: [rule(), reverseRule({ extra_passenger_fee: 9 })],
    }));

    expect(draft.shared.dayPrice).toBeNull();
    expect(draft.mixed.dayPrice).toMatchObject({ isMixed: true, outbound: 50, reverse: 65 });
    expect(draft.shared.currency).toBeNull();
    expect(draft.mixed.currency.isMixed).toBe(true);
    expect(draft.shared.extraPassengerFee).toBeNull();
    expect(draft.mixed.extraPassengerFee.isMixed).toBe(true);
  });

  test('uses outbound-only scope when reverse is missing', () => {
    const draft = reviewableDraft(core, pairContext({
      reverseRoute: null,
      pricingRules: [rule()],
    }));

    expect(draft.reverseRouteId).toBeNull();
    expect(draft.scope).toEqual({ updateOutbound: true, updateReverse: false });
    expect(draft.shared.dayPrice).toBe(50);
    expect(core.validateTransportPairPricingDraft(draft).errors).toHaveLength(0);
  });

  test('rehydrates values for a conscious one-direction scope', () => {
    let draft = reviewableDraft(core, pairContext({
      reverseRoute: reverseRoute({ day_price: 65 }),
    }));
    expect(draft.shared.dayPrice).toBeNull();

    draft.scope.updateReverse = false;
    draft = core.hydrateTransportPairSharedValues(draft);
    expect(draft.shared.dayPrice).toBe(50);
    expect(draft.mixed.dayPrice.isMixed).toBe(false);
  });

  test('requires exact selection for multiple rules but still permits route-only review', () => {
    const draft = reviewableDraft(core, pairContext({
      pricingRules: [
        rule({ id: 'rule-a-b-one' }),
        rule({ id: 'rule-a-b-two', priority: 8 }),
        reverseRule(),
      ],
    }));

    expect(draft.selectedRules.outboundRuleId).toBeNull();
    expect(draft.snapshot.ruleCounts.outbound).toBe(2);
    expect(core.getTransportPairDepositAccess(draft).editable).toBe(false);
    expect(core.validateTransportPairPricingDraft(draft).warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'pricing_rule_not_selected', direction: 'outbound' }),
      expect.objectContaining({ code: 'deposit_editing_blocked' }),
    ]));
  });

  test('keeps advanced fields unavailable when no rule exists', () => {
    const draft = reviewableDraft(core, pairContext({ pricingRules: [] }));
    const validation = core.validateTransportPairPricingDraft(draft);

    expect(draft.selectedRules).toEqual({ outboundRuleId: null, reverseRuleId: null });
    expect(validation.errors).toHaveLength(0);
    expect(validation.warnings.filter((entry: any) => entry.code === 'pricing_rule_not_selected')).toHaveLength(2);
    const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
    expect(plan.steps.filter((step: any) => step.type === 'pricing_rule'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ action: 'blocked' })]));
  });

  test('preserves validity, priority, active, base floor and unknown columns', () => {
    const draft = reviewableDraft(core);
    draft.shared.extraPassengerFee = '7';
    const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
    const pricing = plan.steps.find((step: any) => step.key === 'pricing_outbound');

    expect(pricing.after).toMatchObject({
      route_id: 'route-a-b',
      valid_from: '2026-08-01',
      valid_to: '2026-12-31',
      priority: 4,
      is_active: true,
      deposit_base_floor: 12,
      waiting_fee_per_minute: 0.3333,
      custom_preserved_column: 'keep-me',
    });
    expect(pricing.before).not.toBe(pricing.after);
  });

  test('normalizes numbers and HH:MM when calculating exact diff', () => {
    const draft = reviewableDraft(core);
    draft.shared.dayPrice = '50.00';
    draft.shared.nightStart = '22:00';
    draft.shared.waitingFeePerHour = '20.00';
    draft.shared.nightPrice = '75';

    const diff = core.buildTransportPairPricingDiff(draft);
    expect(diff.filter((entry) => entry.field === 'day_price')).toHaveLength(0);
    expect(diff.filter((entry) => entry.field === 'night_start')).toHaveLength(0);
    expect(diff.filter((entry) => entry.field === 'waiting_fee_per_hour')).toHaveLength(0);
    expect(diff.filter((entry) => entry.field === 'night_price')).toHaveLength(2);
    expect(diff.find((entry) => entry.field === 'night_price')).toMatchObject({ before: 70, after: 75 });
  });

  test('produces no diff entries for fully unchanged records', () => {
    const draft = reviewableDraft(core, pairContext({
      depositOverrides: [
        {
          id: 'override-a-b',
          resource_type: 'transport',
          resource_id: 'route-a-b',
          mode: 'flat',
          amount: 20,
          currency: 'EUR',
          include_children: true,
          enabled: true,
        },
        {
          id: 'override-b-a',
          resource_type: 'transport',
          resource_id: 'route-b-a',
          mode: 'flat',
          amount: 20,
          currency: 'EUR',
          include_children: true,
          enabled: true,
        },
      ],
    }));

    expect(core.buildTransportPairPricingDiff(draft)).toEqual([]);
  });

  test.each([
    ['insert', [], true, 25],
    ['update', [{
      id: 'override-a-b', resource_type: 'transport', resource_id: 'route-a-b', mode: 'flat', amount: 20,
      currency: 'EUR', include_children: true, enabled: true,
    }], true, 25],
    ['delete', [{
      id: 'override-a-b', resource_type: 'transport', resource_id: 'route-a-b', mode: 'flat', amount: 20,
      currency: 'EUR', include_children: true, enabled: true,
    }], false, 0],
    ['unchanged', [{
      id: 'override-a-b', resource_type: 'transport', resource_id: 'route-a-b', mode: 'flat', amount: 20,
      currency: 'EUR', include_children: true, enabled: true,
    }], true, 20],
  ])('plans deposit override %s without executing it', (expectedAction, overrides, enabled, value) => {
    const draft = reviewableDraft(core, pairContext({
      reverseRoute: null,
      pricingRules: [rule()],
      depositOverrides: overrides,
    }));
    draft.shared.depositEnabled = enabled;
    draft.shared.depositMode = 'fixed_amount';
    draft.shared.depositValue = value;

    const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
    expect(plan.steps.find((step: any) => step.key === 'deposit_outbound')).toMatchObject({
      action: expectedAction,
      resourceId: 'route-a-b',
    });
  });

  test('blocks deposit planning when a scoped direction has multiple rules', () => {
    const draft = reviewableDraft(core, pairContext({
      pricingRules: [
        rule({ id: 'rule-a-b-one' }),
        rule({ id: 'rule-a-b-two' }),
        reverseRule(),
      ],
      selectedRules: { outboundRuleId: 'rule-a-b-one', reverseRuleId: 'rule-b-a' },
    }));
    const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });

    expect(core.getTransportPairDepositAccess(draft).editable).toBe(false);
    expect(plan.steps.filter((step: any) => step.type === 'deposit_override'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ action: 'blocked' })]));
  });

  test('normalizes a consciously entered shared currency to uppercase', () => {
    const draft = reviewableDraft(core, pairContext({
      reverseRoute: reverseRoute({ currency: 'USD' }),
    }));
    expect(draft.shared.currency).toBeNull();
    draft.shared.currency = 'eur';

    const validation = core.validateTransportPairPricingDraft(draft);
    expect(validation.errors.find((entry: any) => entry.field === 'currency')).toBeUndefined();
    const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
    expect(plan.steps.filter((step: any) => step.type === 'transport_route'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ after: expect.objectContaining({ currency: 'EUR' }) })]));
  });

  test('rejects max passenger and luggage values below included capacity', () => {
    const draft = reviewableDraft(core);
    draft.shared.includedPassengers = 6;
    draft.shared.maxPassengers = 5;
    draft.shared.includedBags = 4;
    draft.shared.includedLargeBags = 3;
    draft.shared.maxBags = 6;

    const codes = core.validateTransportPairPricingDraft(draft).errors.map((entry: any) => entry.code);
    expect(codes).toContain('max_passengers_below_included');
    expect(codes).toContain('max_bags_below_included');
  });

  test('builds a plan with at most two exact route IDs and zero global changes', () => {
    const draft = reviewableDraft(core);
    draft.shared.dayPrice = 60;
    const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
    const routeIds = plan.steps
      .filter((step: any) => step.type === 'transport_route')
      .map((step: any) => step.entityId);

    expect(routeIds).toEqual(['route-a-b', 'route-b-a']);
    expect(new Set(routeIds).size).toBeLessThanOrEqual(2);
    expect(plan.globalChanges).toBe(0);
    expect(plan.summary.globalChanges).toBe(0);
    expect(plan.preflight.directions.outbound).toMatchObject({
      routeUpdatedAt: '2026-08-01T08:00:00.000Z',
      selectedRuleId: 'rule-a-b',
      selectedRuleUpdatedAt: '2026-08-01T09:00:00.000Z',
      ruleCount: 1,
    });
  });

  test('invalidates the review fingerprint after any draft field change', () => {
    const draft = reviewableDraft(core);
    const plan = core.buildTransportPairPricingReviewPlan(draft, { now: '2026-08-01T11:00:00.000Z' });
    draft.review = { isCurrent: true, fingerprint: plan.fingerprint, plan };
    expect(core.isTransportPairPricingReviewCurrent(draft, plan.fingerprint)).toBe(true);

    const before = core.fingerprintTransportPairPricingDraft(draft);
    draft.shared.dayPrice = 61;
    expect(core.fingerprintTransportPairPricingDraft(draft)).not.toBe(before);
    expect(core.isTransportPairPricingReviewCurrent(draft, plan.fingerprint)).toBe(false);
  });
});

describe('Transport Admin Stage 2D preflight and exact save plan', () => {
  const core = loadCore();
  const builders = loadBuilders();

  const override = (direction: 'outbound' | 'reverse', overrides: Record<string, unknown> = {}) => ({
    id: direction === 'reverse' ? 'override-b-a' : 'override-a-b',
    resource_type: 'transport',
    resource_id: direction === 'reverse' ? 'route-b-a' : 'route-a-b',
    mode: 'flat',
    amount: 20,
    currency: 'EUR',
    include_children: true,
    enabled: true,
    updated_at: direction === 'reverse' ? '2026-08-01T09:15:00.000Z' : '2026-08-01T09:10:00.000Z',
    ...overrides,
  });

  function cloneContext<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  test('builds exact route update payloads and preserves each reverse record independently', () => {
    const context = pairContext({ depositOverrides: [override('outbound'), override('reverse')] });
    const { draft, plan } = reviewAfterEdit(core, (next) => {
      next.shared.dayPrice = 60;
    }, context);
    const savePlan = core.buildTransportPairPricingSavePlan(plan, cloneContext(context), {
      draft,
      builders,
      now: '2026-08-01T11:05:00.000Z',
    });

    const outbound = savePlan.steps.find((step: any) => step.key === 'route_outbound');
    const reverse = savePlan.steps.find((step: any) => step.key === 'route_reverse');
    expect(outbound).toMatchObject({
      action: 'update', entityId: 'route-a-b', expectedUpdatedAt: '2026-08-01T08:00:00.000Z',
      payload: { day_price: 60 },
    });
    expect(reverse).toMatchObject({
      action: 'update', entityId: 'route-b-a', expectedUpdatedAt: '2026-08-01T08:05:00.000Z',
      payload: { day_price: 60 },
    });
    expect(reverse.before.origin_location_id).toBe('location-b');
    expect(reverse.before.owner_partner_id).toBe('partner-one');
    expect(reverse.payload).not.toHaveProperty('origin_location_id');
    expect(reverse.payload).not.toHaveProperty('sort_order');
    expect(savePlan.steps.filter((step: any) => step.type === 'transport_route')).toHaveLength(2);
    expect(savePlan.globalChanges).toBe(0);
  });

  test('updates only exact pricing IDs, preserves validity metadata, and derives waiting per minute', () => {
    const context = pairContext({ depositOverrides: [override('outbound'), override('reverse')] });
    const { draft, plan } = reviewAfterEdit(core, (next) => {
      next.shared.extraPassengerFee = 8;
      next.shared.waitingFeePerHour = 30;
    }, context);
    const savePlan = core.buildTransportPairPricingSavePlan(plan, cloneContext(context), { draft, builders });
    const pricing = savePlan.steps.filter((step: any) => step.type === 'pricing_rule');

    expect(pricing.map((step: any) => step.entityId)).toEqual(['rule-a-b', 'rule-b-a']);
    pricing.forEach((step: any) => {
      expect(step.action).toBe('update');
      expect(step.payload).toEqual({
        extra_passenger_fee: 8,
        waiting_fee_per_hour: 30,
        waiting_fee_per_minute: 0.5,
      });
      expect(step.payload).not.toHaveProperty('route_id');
      expect(step.payload).not.toHaveProperty('valid_from');
      expect(step.payload).not.toHaveProperty('valid_to');
      expect(step.payload).not.toHaveProperty('priority');
      expect(step.payload).not.toHaveProperty('is_active');
      expect(step.before).toMatchObject({
        valid_from: '2026-08-01', valid_to: '2026-12-31', priority: 4, is_active: true,
        deposit_base_floor: 12,
      });
    });
    expect(savePlan.steps.some((step: any) => step.type === 'pricing_rule' && step.action === 'insert')).toBe(false);
    expect(savePlan.steps.some((step: any) => step.type === 'transport_route' && step.action === 'insert')).toBe(false);
  });

  test.each([
    ['insert', [], true, 25, null],
    ['update', [override('outbound')], true, 25, 'override-a-b'],
    ['delete', [override('outbound')], false, 0, 'override-a-b'],
  ])('builds an exact deposit %s step using the existing builder', (action, overrides, enabled, value, entityId) => {
    const context = pairContext({
      reverseRoute: null,
      pricingRules: [rule()],
      depositOverrides: overrides,
    });
    const { draft, plan } = reviewAfterEdit(core, (next) => {
      next.shared.depositEnabled = enabled;
      next.shared.depositMode = 'fixed_amount';
      next.shared.depositValue = value;
    }, context);
    const savePlan = core.buildTransportPairPricingSavePlan(plan, cloneContext(context), { draft, builders });
    const deposit = savePlan.steps.find((step: any) => step.key === 'deposit_outbound');

    expect(deposit).toMatchObject({ action, entityId });
    if (action === 'insert') {
      expect(deposit.expectAbsent).toBe(true);
      expect(deposit.payload).toMatchObject({
        resource_type: 'transport', resource_id: 'route-a-b', mode: 'flat', amount: 25,
        currency: 'EUR', include_children: true, enabled: true,
      });
    }
    if (action === 'update') {
      expect(deposit.expectedUpdatedAt).toBe('2026-08-01T09:10:00.000Z');
      expect(deposit.payload).toEqual({ amount: 25 });
    }
    if (action === 'delete') {
      expect(deposit.payload).toBeNull();
      expect(deposit.expectedUpdatedAt).toBe('2026-08-01T09:10:00.000Z');
    }
  });

  test.each([
    ['fixed_amount', 'flat', 25],
    ['percent_total', 'percent_total', 35],
    ['per_person', 'per_person', 15],
  ])('maps %s through the existing deposit builder and preserves pricing base floor', (
    pricingMode,
    serviceMode,
    amount,
  ) => {
    const context = pairContext({
      reverseRoute: null,
      pricingRules: [rule()],
      depositOverrides: [],
    });
    const { draft, plan } = reviewAfterEdit(core, (next) => {
      next.shared.depositEnabled = true;
      next.shared.depositMode = pricingMode;
      next.shared.depositValue = amount;
    }, context);
    const savePlan = core.buildTransportPairPricingSavePlan(plan, cloneContext(context), { draft, builders });
    const pricing = savePlan.steps.find((step: any) => step.key === 'pricing_outbound');
    const deposit = savePlan.steps.find((step: any) => step.key === 'deposit_outbound');

    expect(pricing.after).toMatchObject({
      deposit_enabled: true,
      deposit_mode: pricingMode,
      deposit_value: amount,
    });
    expect(pricing.before.deposit_base_floor).toBe(12);
    expect(pricing.payload).not.toHaveProperty('deposit_base_floor');
    expect(deposit).toMatchObject({
      action: 'insert',
      expectAbsent: true,
      payload: expect.objectContaining({
        mode: serviceMode,
        amount,
        currency: 'EUR',
        include_children: true,
      }),
    });
  });

  test.each([
    ['route updated_at', (fresh: any) => { fresh.outboundRoute.updated_at = '2026-08-01T12:00:00.000Z'; }, 'route_updated_at_changed'],
    ['reverse relation', (fresh: any) => { fresh.reverseRoute.origin_location_id = 'location-c'; }, 'reverse_relation_changed'],
    ['rule updated_at', (fresh: any) => { fresh.pricingRules[0].updated_at = '2026-08-01T12:00:00.000Z'; }, 'pricing_rule_updated_at_changed'],
    ['rule ownership', (fresh: any) => { fresh.pricingRules[0].route_id = 'route-other'; }, 'pricing_rule_ownership_changed'],
    ['rule count', (fresh: any) => { fresh.pricingRules.push(rule({ id: 'rule-a-b-second' })); }, 'pricing_rule_count_changed'],
    ['override appeared', (fresh: any) => { fresh.depositOverrides.push(override('outbound')); }, 'deposit_override_count_changed'],
    ['global default', (fresh: any) => { fresh.serviceDepositDefault.include_children = false; }, 'global_deposit_default_changed'],
  ])('blocks all writes when preflight detects stale %s', (_label, mutate, expectedCode) => {
    const context = pairContext();
    const { draft, plan } = reviewAfterEdit(core, (next) => { next.shared.dayPrice = 60; }, context);
    const fresh = cloneContext(context);
    mutate(fresh);
    const preflight = core.preflightTransportPairPricingReview(draft, plan, fresh);

    expect(preflight.ok).toBe(false);
    expect(preflight.differences.map((entry: any) => entry.code)).toContain(expectedCode);
    expect(() => core.buildTransportPairPricingSavePlan(plan, fresh, { draft, builders }))
      .toThrow(expect.objectContaining({ code: 'transport_pair_stale_conflict' }));
  });

  test('detects an override disappearing after Review', () => {
    const context = pairContext({ depositOverrides: [override('outbound'), override('reverse')] });
    const { draft, plan } = reviewAfterEdit(core, (next) => { next.shared.dayPrice = 60; }, context);
    const fresh = cloneContext(context);
    fresh.depositOverrides = fresh.depositOverrides.filter((row: any) => row.id !== 'override-a-b');

    const codes = core.preflightTransportPairPricingReview(draft, plan, fresh)
      .differences.map((entry: any) => entry.code);
    expect(codes).toContain('deposit_override_count_changed');
    expect(codes).toContain('deposit_override_missing');
  });

  test('blocks a save when the reviewed draft fingerprint changes', () => {
    const context = pairContext();
    const { draft, plan } = reviewedDraft(core, context);
    draft.shared.dayPrice = 99;
    const result = core.preflightTransportPairPricingReview(draft, plan, cloneContext(context));

    expect(result.ok).toBe(false);
    expect(result.differences.map((entry: any) => entry.code)).toContain('draft_fingerprint_changed');
  });

  test('keeps at most two route IDs, excludes unchanged steps, and always has zero global changes', () => {
    const context = pairContext({ depositOverrides: [override('outbound'), override('reverse')] });
    const { draft, plan } = reviewAfterEdit(core, (next) => { next.shared.dayPrice = 60; }, context);
    const savePlan = core.buildTransportPairPricingSavePlan(plan, cloneContext(context), { draft, builders });

    expect(savePlan.steps.every((step: any) => step.action !== 'unchanged')).toBe(true);
    expect(new Set(savePlan.steps
      .filter((step: any) => step.type === 'transport_route')
      .map((step: any) => step.entityId)).size).toBeLessThanOrEqual(2);
    expect(savePlan.globalChanges).toBe(0);
    expect(savePlan.summary.globalChanges).toBe(0);
  });

  test.each([
    ['route ID', 'route_outbound', (step: any) => { step.entityId = 'route-unreviewed'; }, 'transport_pair_route_exact_id_mismatch'],
    ['rule ID', 'pricing_outbound', (step: any) => { step.entityId = 'rule-unreviewed'; }, 'transport_pair_pricing_exact_id_mismatch'],
    ['updated_at', 'route_outbound', (step: any) => { step.expectedUpdatedAt = '2026-08-01T07:00:00.000Z'; }, 'transport_pair_expected_updated_at_mismatch'],
  ])('rejects a Review whose exact %s was altered before executor construction', (
    _label,
    stepKey,
    mutate,
    expectedCode,
  ) => {
    const context = pairContext({ depositOverrides: [override('outbound'), override('reverse')] });
    const { draft, plan } = reviewAfterEdit(core, (next) => {
      next.shared.dayPrice = 60;
      next.shared.extraPassengerFee = 8;
    }, context);
    mutate(plan.steps.find((step: any) => step.key === stepKey));

    expect(() => core.buildTransportPairPricingSavePlan(plan, cloneContext(context), { draft, builders }))
      .toThrow(expect.objectContaining({ code: expectedCode }));
  });
});

describe('Transport Admin Stage 2E exact retry precheck and reconciliation', () => {
  const core = loadCore();
  const builders = loadBuilders();

  const override = (overrides: Record<string, unknown> = {}) => ({
    id: 'override-a-b',
    resource_type: 'transport',
    resource_id: 'route-a-b',
    mode: 'flat',
    amount: 20,
    currency: 'EUR',
    include_children: true,
    enabled: true,
    updated_at: '2026-08-01T09:10:00.000Z',
    ...overrides,
  });

  const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  function scenario(
    mutate: (draft: any) => void,
    context: Record<string, unknown> = pairContext(),
  ) {
    const reviewed = reviewAfterEdit(core, mutate, context);
    const savePlan = core.buildTransportPairPricingSavePlan(
      reviewed.plan,
      cloneJson(context),
      { draft: reviewed.draft, builders, now: '2026-08-01T11:05:00.000Z' },
    );
    return {
      context,
      draft: reviewed.draft,
      reviewPlan: reviewed.plan,
      savePlan,
      fresh: cloneJson(context) as any,
    };
  }

  function freshRecord(fresh: any, step: any) {
    const reverse = String(step.key).endsWith('reverse');
    const routeRow = reverse ? fresh.reverseRoute : fresh.outboundRoute;
    if (step.type === 'transport_route') return routeRow;
    if (step.type === 'pricing_rule') {
      return fresh.pricingRules.find((row: any) => row.id === step.entityId);
    }
    const id = step.result?.id || step.entityId;
    return fresh.depositOverrides.find((row: any) => row.id === id);
  }

  function applyPlannedWrite(fresh: any, step: any, insertedId?: string) {
    if (step.type === 'transport_route') {
      const key = String(step.key).endsWith('reverse') ? 'reverseRoute' : 'outboundRoute';
      fresh[key] = { ...fresh[key], ...step.payload };
      return fresh[key];
    }
    if (step.type === 'pricing_rule') {
      fresh.pricingRules = fresh.pricingRules.map((row: any) => (
        row.id === step.entityId ? { ...row, ...step.payload } : row
      ));
      return fresh.pricingRules.find((row: any) => row.id === step.entityId);
    }
    if (step.action === 'insert') {
      const row = {
        id: insertedId || `${step.key}-inserted`,
        ...step.payload,
        updated_at: '2026-08-01T11:06:00.000Z',
      };
      fresh.depositOverrides.push(row);
      return row;
    }
    if (step.action === 'delete') {
      fresh.depositOverrides = fresh.depositOverrides.filter((row: any) => row.id !== step.entityId);
      return null;
    }
    fresh.depositOverrides = fresh.depositOverrides.map((row: any) => (
      row.id === step.entityId ? { ...row, ...step.payload } : row
    ));
    return fresh.depositOverrides.find((row: any) => row.id === step.entityId);
  }

  function markSuccess(subject: any, key: string) {
    const step = subject.savePlan.steps.find((row: any) => row.key === key);
    const record = applyPlannedWrite(subject.fresh, step);
    step.status = 'success';
    step.attempts = 1;
    step.result = { id: record?.id || step.entityId, data: cloneJson(record || { id: step.entityId }), reconciled: false };
    subject.savePlan.results[step.key] = cloneJson(step.result);
    subject.savePlan.status = 'partial';
    return step;
  }

  function markError(subject: any, key: string) {
    const step = subject.savePlan.steps.find((row: any) => row.key === key);
    step.status = 'error';
    step.attempts = 1;
    step.error = { code: 'network_timeout', message: `${key} timed out` };
    subject.savePlan.status = 'partial';
    return step;
  }

  function markDependencySkipped(subject: any, key: string) {
    const step = subject.savePlan.steps.find((row: any) => row.key === key);
    step.status = 'skipped';
    step.attempts = 0;
    step.skipReason = 'dependency';
    step.error = { code: 'save_plan_dependency_failed', message: 'dependency failed' };
    subject.savePlan.status = 'partial';
    return step;
  }

  test('prepares only error and dependency-skipped steps while preserving successful result IDs', () => {
    const subject = scenario((draft) => {
      draft.shared.dayPrice = 60;
      draft.shared.extraPassengerFee = 8;
    });
    const successfulRoute = markSuccess(subject, 'route_outbound');
    markError(subject, 'route_reverse');
    markSuccess(subject, 'pricing_outbound');
    markDependencySkipped(subject, 'pricing_reverse');

    const precheck = core.precheckTransportPairPricingRetry(
      subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh,
    );
    const routeAfter = precheck.plan.steps.find((step: any) => step.key === 'route_outbound');
    const routeRetry = precheck.plan.steps.find((step: any) => step.key === 'route_reverse');

    expect(precheck.ok).toBe(true);
    expect(precheck.retryableKeys).toEqual(['route_reverse', 'pricing_reverse']);
    expect(routeAfter).toMatchObject({ status: 'success', attempts: 1, result: { id: 'route-a-b' } });
    expect(routeAfter.result.id).toBe(successfulRoute.result.id);
    expect(routeRetry).toMatchObject({ status: 'error', attempts: 1 });
    expect(routeRetry.previousErrors).toEqual([expect.objectContaining({ code: 'network_timeout' })]);
    expect(core.isTransportPairPricingRetryAvailable(precheck.plan, subject.draft, subject.reviewPlan)).toBe(true);
  });

  test('reconciles an exact route update after an ambiguous network error', () => {
    const subject = scenario((draft) => { draft.shared.dayPrice = 60; });
    markSuccess(subject, 'route_reverse');
    const failed = markError(subject, 'route_outbound');
    applyPlannedWrite(subject.fresh, failed);

    const precheck = core.precheckTransportPairPricingRetry(subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh);
    const reconciled = precheck.plan.steps.find((step: any) => step.key === 'route_outbound');
    expect(precheck.ok).toBe(true);
    expect(reconciled).toMatchObject({ status: 'success', reconciled: true, attempts: 1, result: { id: 'route-a-b' } });
    expect(precheck.retryableKeys).toEqual([]);
    expect(precheck.plan.status).toBe('success');
  });

  test('reconciles only the exact pricing rule and preserves validity, priority, active, and ownership', () => {
    const subject = scenario((draft) => { draft.shared.extraPassengerFee = 8; });
    markSuccess(subject, 'pricing_reverse');
    const failed = markError(subject, 'pricing_outbound');
    applyPlannedWrite(subject.fresh, failed);

    const precheck = core.precheckTransportPairPricingRetry(subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh);
    const reconciled = precheck.plan.steps.find((step: any) => step.key === 'pricing_outbound');
    expect(precheck.ok).toBe(true);
    expect(reconciled).toMatchObject({ status: 'success', reconciled: true, result: { id: 'rule-a-b' } });
    expect(reconciled.result.data).toMatchObject({
      route_id: 'route-a-b', valid_from: '2026-08-01', valid_to: '2026-12-31', priority: 4, is_active: true,
    });
  });

  test.each([
    ['insert', [], true, 25],
    ['update', [override()], true, 25],
    ['delete', [override()], false, 0],
  ])('reconciles exact deposit %s without sending it again', (action, overrides, enabled, value) => {
    const context = pairContext({ reverseRoute: null, pricingRules: [rule()], depositOverrides: overrides });
    const subject = scenario((draft) => {
      draft.shared.depositEnabled = enabled;
      draft.shared.depositMode = 'fixed_amount';
      draft.shared.depositValue = value;
    }, context);
    markSuccess(subject, 'pricing_outbound');
    const failed = markError(subject, 'deposit_outbound');
    applyPlannedWrite(subject.fresh, failed, 'override-reconciled');

    const precheck = core.precheckTransportPairPricingRetry(subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh);
    const reconciled = precheck.plan.steps.find((step: any) => step.key === 'deposit_outbound');
    expect(precheck.ok).toBe(true);
    expect(reconciled).toMatchObject({ status: 'success', reconciled: true });
    expect(reconciled.result.id).toBe(action === 'insert' ? 'override-reconciled' : 'override-a-b');
  });

  test('blocks Retry when a conflicting route-scoped override exists', () => {
    const context = pairContext({ reverseRoute: null, pricingRules: [rule()], depositOverrides: [] });
    const subject = scenario((draft) => {
      draft.shared.depositEnabled = true;
      draft.shared.depositMode = 'fixed_amount';
      draft.shared.depositValue = 25;
    }, context);
    markSuccess(subject, 'pricing_outbound');
    markError(subject, 'deposit_outbound');
    subject.fresh.depositOverrides.push(override({ id: 'override-conflict', amount: 99 }));

    const precheck = core.precheckTransportPairPricingRetry(subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh);
    expect(precheck.ok).toBe(false);
    expect(precheck.staleAfterPartial).toBe(true);
    expect(precheck.plan.status).toBe('stale_after_partial');
    expect(precheck.differences.map((entry: any) => entry.code)).toContain('retry_deposit_insert_conflict');
  });

  test.each([
    ['successful route', (subject: any) => { subject.fresh.outboundRoute.day_price = 99; }, 'successful_step_changed'],
    ['rule count', (subject: any) => { subject.fresh.pricingRules.push(rule({ id: 'rule-added-after-partial' })); }, 'retry_pricing_rule_count_changed'],
    ['global deposit default', (subject: any) => { subject.fresh.serviceDepositDefault.include_children = false; }, 'retry_global_deposit_default_changed'],
  ])('marks stale_after_partial when %s changes', (_label, mutate, expectedCode) => {
    const subject = scenario((draft) => { draft.shared.dayPrice = 60; });
    markSuccess(subject, 'route_outbound');
    markError(subject, 'route_reverse');
    mutate(subject);

    const precheck = core.precheckTransportPairPricingRetry(subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh);
    expect(precheck.ok).toBe(false);
    expect(precheck.staleAfterPartial).toBe(true);
    expect(precheck.plan.status).toBe('stale_after_partial');
    expect(precheck.differences.map((entry: any) => entry.code)).toContain(expectedCode);
    expect(core.isTransportPairPricingRetryAvailable(precheck.plan, subject.draft, subject.reviewPlan)).toBe(false);
  });

  test('blocks Retry when a successful exact rule changes after partial success', () => {
    const subject = scenario((draft) => { draft.shared.extraPassengerFee = 8; });
    markSuccess(subject, 'pricing_outbound');
    markError(subject, 'pricing_reverse');
    subject.fresh.pricingRules = subject.fresh.pricingRules.map((row: any) => (
      row.id === 'rule-a-b' ? { ...row, extra_passenger_fee: 99 } : row
    ));

    const precheck = core.precheckTransportPairPricingRetry(subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh);
    expect(precheck.ok).toBe(false);
    expect(precheck.differences).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'successful_step_changed', entityId: 'rule-a-b' }),
    ]));
  });

  test('invalidated draft fingerprint blocks Retry before reconciliation', () => {
    const subject = scenario((draft) => { draft.shared.dayPrice = 60; });
    markSuccess(subject, 'route_outbound');
    markError(subject, 'route_reverse');
    subject.draft.shared.dayPrice = 61;

    const precheck = core.precheckTransportPairPricingRetry(subject.savePlan, subject.draft, subject.reviewPlan, subject.fresh);
    expect(precheck.ok).toBe(false);
    expect(precheck.differences.map((entry: any) => entry.code)).toContain('retry_draft_fingerprint_changed');
  });

  test('manual refresh abandons the old plan without resetting successful receipts', () => {
    const subject = scenario((draft) => { draft.shared.dayPrice = 60; });
    markSuccess(subject, 'route_outbound');
    markError(subject, 'route_reverse');
    const resultId = subject.savePlan.steps.find((step: any) => step.key === 'route_outbound').result.id;

    const abandoned = core.abandonTransportPairPricingSavePlan(subject.savePlan, {
      abandonedAt: '2026-08-01T12:00:00.000Z',
      reason: 'manual_refresh',
    });
    expect(abandoned).toMatchObject({
      status: 'abandoned',
      execution: { abandonedAt: '2026-08-01T12:00:00.000Z', abandonedReason: 'manual_refresh', retryable: [] },
    });
    expect(abandoned.steps.find((step: any) => step.key === 'route_outbound').result.id).toBe(resultId);
    expect(core.isTransportPairPricingRetryAvailable(abandoned, subject.draft, subject.reviewPlan)).toBe(false);
  });
});
