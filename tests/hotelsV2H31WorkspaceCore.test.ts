import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const SCHEDULE = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const RATE_PLAN = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const OWNER = '0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
const UPPER_RATE = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE = '3320590d-632d-423f-80d0-fd021cba7293';
const PAYMENT = '31000000-0000-4000-8000-000000000001';
const COMMISSION = '31000000-0000-4000-8000-000000000002';
const MANUAL_SOURCE = '31000000-0000-4000-8000-000000000003';
const CORRELATION = '31000000-0000-4000-8000-000000000004';

const ids = Array.from({ length: 15 }, (_, index) =>
  `32000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js');
  const context: Record<string, any> = {
    console,
    crypto: { randomUUID: () => ids[0] },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2WorkspaceCore;
}

function workspace(): any {
  return {
    property: {
      id: HOTEL,
      slug: '7-ukow',
      architecture_version: 'legacy',
      booking_mode: 'request_confirmation',
      check_in_from: null,
      check_out_until: null,
      children_policy: 'minimum_age',
      minimum_child_age: 15,
      owner_partner_id: OWNER,
      updated_at: '2026-08-15T08:00:00.000Z',
    },
    room_types: [{
      id: UPPER,
      hotel_id: HOTEL,
      code: 'upper-floor-apartment',
      name_i18n: { en: 'Upper Floor Apartment' },
      max_occupancy: 4,
      capacity_adults: null,
      capacity_children: null,
      base_inventory_count: 1,
      inventory_mode: 'pooled',
      status: 'active',
      version: 9,
    }, {
      id: GROUND,
      hotel_id: HOTEL,
      code: 'ground-floor-apartment',
      name_i18n: { en: 'Ground Floor Apartment' },
      max_occupancy: 4,
      capacity_adults: null,
      capacity_children: null,
      base_inventory_count: 1,
      inventory_mode: 'pooled',
      status: 'active',
      version: 10,
    }],
    units: [],
    rate_plans: [{
      id: RATE_PLAN,
      hotel_id: HOTEL,
      code: 'standard',
      name_i18n: { en: 'Standard' },
      cancellation_policy: { type: 'non_refundable' },
      is_active: false,
      version: 2,
    }],
    room_rates: [{
      id: UPPER_RATE, hotel_id: HOTEL, room_type_id: UPPER, rate_plan_id: RATE_PLAN,
      base_nightly_rate: 0, currency: 'EUR', is_active: false, version: 1,
    }, {
      id: GROUND_RATE, hotel_id: HOTEL, room_type_id: GROUND, rate_plan_id: RATE_PLAN,
      base_nightly_rate: 0, currency: 'EUR', is_active: false, version: 1,
    }],
    partners: [{ id: OWNER, name: '7 Kamares', status: 'active', can_manage_hotels: true }],
    operational_partners: [{
      partner_id: OWNER, name: '7 Kamares', status: 'active', can_manage_hotels: true,
      is_active: true,
    }],
  };
}

function currentConfiguration(): any {
  return {
    hotel_id: HOTEL,
    property: {
      id: HOTEL,
      architecture_version: 'legacy',
      minimum_stay_nights: null,
      updated_at: '2026-08-15T08:00:00.000Z',
    },
    pricing_schedules: [{
      id: SCHEDULE,
      hotel_id: HOTEL,
      maximum_party_size: 4,
      minimum_billable_occupancy: 1,
      version: 3,
    }],
    rate_plans: [{
      id: RATE_PLAN,
      hotel_id: HOTEL,
      price_inclusions: [],
      version: 2,
    }],
    allocation_rules: [],
    payment_policies: [],
    commission_policies: [],
    calendar_sources: [{
      id: MANUAL_SOURCE,
      hotel_id: HOTEL,
      code: 'manual',
      source_type: 'manual',
      is_enabled: false,
      review_status: 'requires_review',
      priority: 100,
      configuration: {},
      version: 1,
    }],
    flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
  };
}

function allocationRules(): any[] {
  const rule = (offset: number, min: number, max: number, mode: string, split?: number[]) => ({
    id: ids[offset],
    hotel_id: HOTEL,
    code: mode === 'customer_choice' ? 'customer-choice-1-4' : `required-bundle-${min}`,
    min_guest_count: min,
    max_guest_count: max,
    allocation_mode: mode,
    is_active: true,
    review_status: 'reviewed',
    sort_order: min * 10,
    version: 1,
    items: [UPPER, GROUND].map((roomId, itemIndex) => ({
      id: ids[5 + offset * 2 + itemIndex],
      room_type_id: roomId,
      units_required: 1,
      allocated_guest_count: split?.[itemIndex] ?? null,
      sort_order: (itemIndex + 1) * 10,
    })),
  });
  return [
    rule(0, 1, 4, 'customer_choice'),
    rule(1, 5, 5, 'required_bundle', [3, 2]),
    rule(2, 6, 6, 'required_bundle', [3, 3]),
    rule(3, 7, 7, 'required_bundle', [4, 3]),
    rule(4, 8, 8, 'required_bundle', [4, 4]),
  ];
}

function reviewedConfiguration(): any {
  const source = currentConfiguration();
  return {
    ...source,
    property: { ...source.property, minimum_stay_nights: 2 },
    pricing_schedules: source.pricing_schedules.map((schedule: any) => ({
      ...schedule,
      minimum_billable_occupancy: 2,
    })),
    rate_plans: source.rate_plans.map((plan: any) => ({
      ...plan,
      price_inclusions: ['taxes', 'cleaning'],
    })),
    allocation_rules: allocationRules(),
    payment_policies: [{
      id: PAYMENT,
      hotel_id: HOTEL,
      code: 'partner-50-after-acceptance',
      name_i18n: { en: '7 Kamares reviewed payment terms' },
      currency: 'EUR',
      is_active: true,
      review_status: 'reviewed',
      version: 1,
      terms: [{
        id: ids[13],
        due_event: 'after_partner_acceptance',
        amount_mode: 'percent_total',
        amount_value: 50,
        recipient: 'partner',
        payment_methods: ['bank_transfer'],
        instructions_i18n: {},
        sequence: 1,
      }, {
        id: ids[14],
        due_event: 'on_arrival',
        amount_mode: 'remaining_balance',
        amount_value: null,
        recipient: 'partner',
        payment_methods: ['cash', 'card'],
        instructions_i18n: {},
        sequence: 2,
      }],
    }],
    commission_policies: [{
      id: COMMISSION,
      hotel_id: HOTEL,
      code: 'cypruseye-7-kamares',
      commission_mode: 'per_allocated_room_per_night',
      amount: 10,
      currency: 'EUR',
      is_active: true,
      review_status: 'reviewed',
      version: 1,
    }],
    calendar_sources: source.calendar_sources.map((entry: any) => ({
      ...entry, is_enabled: true, review_status: 'reviewed',
    })),
  };
}

describe('Hotels V2 H3.1 workspace core', () => {
  const Core = loadCore();

  test('represents every approved 7 Kamares allocation without automatic choice for 1–4 guests', () => {
    const reviewed = Core.validateH3Configuration(reviewedConfiguration(), workspace());
    expect(reviewed.property.minimum_stay_nights).toBe(2);
    expect(reviewed.pricing_schedules[0].minimum_billable_occupancy).toBe(2);
    expect(reviewed.allocation_rules).toHaveLength(5);
    expect(reviewed.allocation_rules[0]).toMatchObject({
      min_guest_count: 1,
      max_guest_count: 4,
      allocation_mode: 'customer_choice',
    });
    expect(reviewed.allocation_rules[0].items.map((item: any) => item.room_type_id))
      .toEqual([UPPER, GROUND]);
    expect(reviewed.allocation_rules.slice(1).map((rule: any) => ({
      guests: rule.min_guest_count,
      split: rule.items.map((item: any) => item.allocated_guest_count),
    }))).toEqual([
      { guests: 5, split: [3, 2] },
      { guests: 6, split: [3, 3] },
      { guests: 7, split: [4, 3] },
      { guests: 8, split: [4, 4] },
    ]);
  });

  test('keeps payment, commission and inclusions separate while operational activation remains blocked', () => {
    const reviewed = Core.validateH3Configuration(reviewedConfiguration(), workspace());
    expect(reviewed.rate_plans[0].price_inclusions).toEqual(['cleaning', 'taxes']);
    expect(reviewed.payment_policies[0].terms).toEqual([
      expect.objectContaining({
        due_event: 'after_partner_acceptance',
        amount_mode: 'percent_total',
        amount_value: 50,
        recipient: 'partner',
        payment_methods: ['bank_transfer'],
      }),
      expect.objectContaining({
        due_event: 'on_arrival',
        amount_mode: 'remaining_balance',
        recipient: 'partner',
        payment_methods: ['card', 'cash'],
      }),
    ]);
    expect(reviewed.commission_policies[0]).toMatchObject({
      commission_mode: 'per_allocated_room_per_night',
      amount: 10,
      currency: 'EUR',
    });
    expect(Core.deriveH3Readiness(reviewed, workspace())).toMatchObject({
      state: 'BLOCKED',
      public_live: false,
      blockers: expect.arrayContaining([
        'Configure property check-in time in Overview.',
        'Configure property check-out time in Overview.',
        'Activate one reviewed Rate Plan before H3 activation.',
        'Activate the reviewed Room Rate products before H3 activation.',
      ]),
    });
    expect(Object.values(reviewed.flags).every((value) => value === false)).toBe(true);
  });

  test('represents a future full platform payment at booking without changing 7 Kamares terms', () => {
    const fullPlatform = reviewedConfiguration();
    fullPlatform.payment_policies[0].terms = [{
      id: ids[13], sequence: 1, due_event: 'at_booking', amount_mode: 'percent_total',
      amount_value: 100, recipient: 'platform', payment_methods: ['online'], instructions_i18n: {},
    }];
    const normalized = Core.validateH3Configuration(fullPlatform, workspace());
    expect(normalized.payment_policies[0].terms).toEqual([
      expect.objectContaining({
        due_event: 'at_booking', amount_mode: 'percent_total', amount_value: 100,
        recipient: 'platform', payment_methods: ['online'],
      }),
    ]);
    expect(reviewedConfiguration().payment_policies[0].terms.map((term: any) => term.due_event))
      .toEqual(['after_partner_acceptance', 'on_arrival']);
  });

  test('accepts complete payment schedules and rejects ambiguous remainder contracts', () => {
    const fullPayment = reviewedConfiguration();
    fullPayment.payment_policies[0].terms = [{
      id: ids[13], sequence: 1, due_event: 'at_booking', amount_mode: 'percent_total',
      amount_value: 100, recipient: 'platform', payment_methods: ['online'], instructions_i18n: {},
    }];
    expect(() => Core.validateH3Configuration(fullPayment, workspace())).not.toThrow();
    expect(() => Core.validateH3Configuration(reviewedConfiguration(), workspace())).not.toThrow();

    const fullPlusRemainder = reviewedConfiguration();
    fullPlusRemainder.payment_policies[0].terms[0].amount_value = 100;
    expect(() => Core.validateH3Configuration(fullPlusRemainder, workspace())).toThrow(
      'Reviewed payment terms must be either 100% scheduled with no remainder, or less than 100% followed by one final remaining balance step.',
    );

    const nonFinalRemainder = reviewedConfiguration();
    nonFinalRemainder.payment_policies[0].terms[0].sequence = 2;
    nonFinalRemainder.payment_policies[0].terms[1].sequence = 1;
    expect(() => Core.validateH3Configuration(nonFinalRemainder, workspace())).toThrow(
      'A remaining balance step must be unique, follow less than 100% scheduled payment, and be the final payment step.',
    );
  });

  test('preserves a normalized custom inclusion through review and exact rate-plan save payload', () => {
    const current = currentConfiguration();
    current.rate_plans[0].price_inclusions = ['private_transfer', 'taxes', 'private_transfer'];
    const target = reviewedConfiguration();
    target.rate_plans[0].price_inclusions = ['taxes', 'private_transfer', 'cleaning'];

    const normalized = Core.validateH3Configuration(target, workspace());
    expect(normalized.rate_plans[0].price_inclusions).toEqual([
      'cleaning', 'private_transfer', 'taxes',
    ]);
    const plan = Core.buildH3ConfigurationPlan(current, normalized, workspace());
    expect(plan.operations.find((operation: any) => operation.entity === 'rate_plan')).toMatchObject({
      id: RATE_PLAN,
      expected_version: 2,
      payload: { price_inclusions: ['cleaning', 'private_transfer', 'taxes'] },
    });
  });

  test('represents a future 10% booking-total commission while preserving the 7 Kamares flat rule', () => {
    const percentageCommission = reviewedConfiguration();
    percentageCommission.commission_policies[0] = {
      ...percentageCommission.commission_policies[0],
      code: 'future-ten-percent', commission_mode: 'percent_booking_total', amount: 10,
    };
    const normalized = Core.validateH3Configuration(percentageCommission, workspace());
    expect(normalized.commission_policies[0]).toMatchObject({
      commission_mode: 'percent_booking_total', amount: 10, currency: 'EUR',
      is_active: true, review_status: 'reviewed',
    });
    expect(reviewedConfiguration().commission_policies[0]).toMatchObject({
      commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR',
    });

    percentageCommission.commission_policies[0].amount = 101;
    expect(() => Core.validateH3Configuration(percentageCommission, workspace()))
      .toThrow('Percentage commission cannot exceed 100%.');
  });

  test('builds one exact-ID optimistic plan and never includes architecture or feature-flag mutations', () => {
    const plan = Core.buildH3ConfigurationPlan(
      currentConfiguration(),
      reviewedConfiguration(),
      workspace(),
      { reviewedAt: '2026-08-15T08:05:00.000Z' },
    );
    expect(plan).toMatchObject({
      hotel_id: HOTEL,
      expected_property_updated_at: '2026-08-15T08:00:00.000Z',
      reviewed_at: '2026-08-15T08:05:00.000Z',
    });
    expect(plan.operations.length).toBeGreaterThan(10);
    expect(plan.operations.every((operation: any) => operation.id)).toBe(true);
    expect(plan.operations.every((operation: any) => Number.isInteger(operation.expected_version) || operation.entity === 'property'))
      .toBe(true);
    expect(plan.operations.find((operation: any) => operation.entity === 'property_configuration'))
      .toMatchObject({ id: HOTEL, expected_version: 0, payload: { minimum_stay_nights: 2 } });
    const allocation = plan.operations.find((operation: any) => operation.entity === 'allocation_rule');
    expect(Object.keys(allocation.payload).sort()).toEqual([
      'allocation_mode', 'code', 'is_active', 'items', 'max_guest_count',
      'min_guest_count', 'review_status', 'sort_order',
    ]);
    expect(Object.keys(allocation.payload.items[0]).sort()).toEqual([
      'allocated_guest_count', 'id', 'room_type_id', 'sort_order', 'units_required',
    ]);
    const payment = plan.operations.find((operation: any) => operation.entity === 'payment_policy');
    expect(Object.keys(payment.payload).sort()).toEqual([
      'code', 'currency', 'is_active', 'name_i18n', 'review_status', 'terms',
    ]);
    expect(Object.keys(payment.payload.terms[0]).sort()).toEqual([
      'amount_mode', 'amount_value', 'due_event', 'id', 'instructions_i18n',
      'payment_methods', 'recipient', 'sequence',
    ]);
    const commission = plan.operations.find((operation: any) => operation.entity === 'commission_policy');
    expect(Object.keys(commission.payload).sort()).toEqual([
      'amount', 'code', 'commission_mode', 'currency', 'is_active', 'review_status',
    ]);
    const calendar = plan.operations.find((operation: any) => operation.entity === 'calendar_source');
    expect(Object.keys(calendar.payload).sort()).toEqual([
      'code', 'configuration', 'external_reference', 'is_enabled', 'priority',
      'review_status', 'room_type_id', 'source_type',
    ]);
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain('architecture_version');
    expect(serialized).not.toContain('hotel_rooms_v2_enabled');
    expect(serialized).not.toContain('is_published');
  });

  test('fails closed on overlapping allocations, impossible bundles and enabled external sources', () => {
    const overlapping = reviewedConfiguration();
    overlapping.allocation_rules[1].min_guest_count = 4;
    overlapping.allocation_rules[1].max_guest_count = 4;
    overlapping.allocation_rules[1].allocation_mode = 'customer_choice';
    overlapping.allocation_rules[1].items.forEach((item: any) => { item.allocated_guest_count = null; });
    expect(() => Core.validateH3Configuration(overlapping, workspace()))
      .toThrow('Active guest allocation ranges cannot overlap.');

    const impossible = reviewedConfiguration();
    impossible.allocation_rules[1].items[0].allocated_guest_count = 5;
    impossible.allocation_rules[1].items[1].allocated_guest_count = 1;
    expect(() => Core.validateH3Configuration(impossible, workspace()))
      .toThrow('Required bundle guest allocations must equal the exact rule guest count.');

    const external = reviewedConfiguration();
    external.calendar_sources.push({
      id: ids[12], hotel_id: HOTEL, code: 'booking-com', source_type: 'booking_com',
      is_enabled: true, review_status: 'reviewed', priority: 50, version: 1,
    });
    expect(() => Core.validateH3Configuration(external, workspace()))
      .toThrow('H3.1 permits at most one enabled manual Calendar source; external providers remain disabled.');

    const noSource = reviewedConfiguration();
    noSource.calendar_sources = noSource.calendar_sources.map((source: any) => ({ ...source, is_enabled: false }));
    expect(() => Core.validateH3Configuration(noSource, workspace())).not.toThrow();
    expect(Core.deriveH3Readiness(noSource, workspace()).blockers).toContain(
      'Enable the manual Calendar source for shadow request-confirmation testing.',
    );
  });

  test('matches DB boundary rules for complete reviewed aggregates and inert drafts', () => {
    const gap = reviewedConfiguration();
    gap.allocation_rules.splice(1, 1);
    expect(() => Core.validateH3Configuration(gap, workspace()))
      .toThrow('Active guest allocation ranges cannot contain an uncovered guest-count gap.');

    const noOneGuest = reviewedConfiguration();
    noOneGuest.allocation_rules.shift();
    expect(() => Core.validateH3Configuration(noOneGuest, workspace()))
      .toThrow('Active guest allocation must begin at one guest.');

    const overGuestCap = reviewedConfiguration();
    overGuestCap.allocation_rules.at(-1).min_guest_count = 51;
    overGuestCap.allocation_rules.at(-1).max_guest_count = 51;
    expect(() => Core.validateH3Configuration(overGuestCap, workspace()))
      .toThrow('Every allocation rule needs a valid guest range.');

    const unreviewedActiveRule = reviewedConfiguration();
    unreviewedActiveRule.allocation_rules[0].review_status = 'requires_review';
    expect(() => Core.validateH3Configuration(unreviewedActiveRule, workspace()))
      .toThrow('Every active allocation rule must be reviewed.');

    const reviewedInactiveRule = reviewedConfiguration();
    reviewedInactiveRule.allocation_rules.push({
      id: ids[12], hotel_id: HOTEL, code: 'reviewed-incomplete', min_guest_count: 9,
      max_guest_count: 9, allocation_mode: 'required_bundle', is_active: false,
      review_status: 'reviewed', sort_order: 900, version: 1, items: [],
    });
    expect(() => Core.validateH3Configuration(reviewedInactiveRule, workspace()))
      .toThrow('Every reviewed allocation rule needs at least one exact Room Type.');

    const inertDraftRule = reviewedConfiguration();
    inertDraftRule.allocation_rules.push({
      id: ids[12], hotel_id: HOTEL, code: 'future-draft', min_guest_count: 9,
      max_guest_count: 9, allocation_mode: 'required_bundle', is_active: false,
      review_status: 'requires_review', sort_order: 900, version: 1, items: [],
    });
    expect(() => Core.validateH3Configuration(inertDraftRule, workspace())).not.toThrow();

    const unreviewedActivePayment = reviewedConfiguration();
    unreviewedActivePayment.payment_policies[0].review_status = 'requires_review';
    expect(() => Core.validateH3Configuration(unreviewedActivePayment, workspace()))
      .toThrow('The active payment policy must be reviewed.');

    const reviewedIncompletePayment = reviewedConfiguration();
    reviewedIncompletePayment.payment_policies[0].is_active = false;
    reviewedIncompletePayment.payment_policies[0].terms = [];
    expect(() => Core.validateH3Configuration(reviewedIncompletePayment, workspace()))
      .toThrow('A reviewed payment policy needs at least one reviewed term.');

    const inertDraftPayment = reviewedConfiguration();
    inertDraftPayment.payment_policies[0].is_active = false;
    inertDraftPayment.payment_policies[0].review_status = 'requires_review';
    inertDraftPayment.payment_policies[0].terms = [];
    expect(() => Core.validateH3Configuration(inertDraftPayment, workspace())).not.toThrow();

    const duplicatePayment = reviewedConfiguration();
    duplicatePayment.payment_policies.push({
      ...JSON.parse(JSON.stringify(duplicatePayment.payment_policies[0])),
      id: ids[12], code: 'second-active-policy',
    });
    expect(() => Core.validateH3Configuration(duplicatePayment, workspace()))
      .toThrow('At most one reviewed payment policy may be active.');

    const duplicateCommission = reviewedConfiguration();
    duplicateCommission.commission_policies.push({
      ...duplicateCommission.commission_policies[0], id: ids[12], code: 'second-active-commission',
    });
    expect(() => Core.validateH3Configuration(duplicateCommission, workspace()))
      .toThrow('At most one reviewed commission policy may be active.');

    const unreviewedManual = reviewedConfiguration();
    unreviewedManual.calendar_sources[0].review_status = 'requires_review';
    expect(() => Core.validateH3Configuration(unreviewedManual, workspace()))
      .toThrow('The enabled Calendar source must be reviewed.');

    const missingActivityFlags = reviewedConfiguration();
    delete missingActivityFlags.allocation_rules[0].is_active;
    delete missingActivityFlags.payment_policies[0].is_active;
    delete missingActivityFlags.commission_policies[0].is_active;
    delete missingActivityFlags.calendar_sources[0].is_enabled;
    const normalized = Core.normalizeH3Configuration(missingActivityFlags);
    expect(normalized.allocation_rules[0].is_active).toBe(false);
    expect(normalized.payment_policies[0].is_active).toBe(false);
    expect(normalized.commission_policies[0].is_active).toBe(false);
    expect(normalized.calendar_sources[0].is_enabled).toBe(false);
  });

  test('uses three-way reconciliation: CURRENT==TARGET rebases, divergent edits conflict', () => {
    const original = currentConfiguration();
    const target = reviewedConfiguration();
    const alreadySatisfied = reviewedConfiguration();
    expect(Core.reconcileH3Configuration(original, alreadySatisfied, target)).toMatchObject({ safe: true, conflicts: [] });

    const divergent = reviewedConfiguration();
    divergent.property.minimum_stay_nights = 3;
    const conflict = Core.reconcileH3Configuration(original, divergent, target);
    expect(conflict.safe).toBe(false);
    expect(conflict.conflicts).toEqual([
      expect.objectContaining({ field: 'minimum_stay_nights', original: null, current: 3, target: 2 }),
    ]);
  });
});

describe('Hotels V2 H3.1 repository transport', () => {
  test('uses only the dedicated Admin RPCs and classifies a stale save without retry', async () => {
    const calls: any[] = [];
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_admin_get_h3_1_configuration') {
          return { data: currentConfiguration(), error: null };
        }
        return {
          data: null,
          error: { code: 'PT409', message: 'hotels_v2_h3_1_stale_allocation_rule' },
        };
      },
      from() { throw new Error('raw table fallback is forbidden'); },
    };
    const context: Record<string, any> = {
      console,
      crypto: { randomUUID: () => CORRELATION },
      window: { getSupabase: () => client },
    };
    for (const relative of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
      const filename = path.join(process.cwd(), relative);
      vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    }
    const repository = context.HotelsV2WorkspaceRepository;
    await expect(repository.getH3Configuration(HOTEL)).resolves.toMatchObject({ hotel_id: HOTEL });
    const plan = context.HotelsV2WorkspaceCore.buildH3ConfigurationPlan(
      currentConfiguration(), reviewedConfiguration(), workspace(),
    );
    await expect(repository.applyH3ConfigurationPlan(plan, CORRELATION)).rejects.toMatchObject({
      code: 'PT409',
      isStale: true,
      isDefinitiveFailure: true,
      isAmbiguousOutcome: false,
    });
    expect(calls.map((call) => call.name)).toEqual([
      'hotel_v2_admin_get_h3_1_configuration',
      'hotel_v2_admin_apply_h3_1_configuration',
    ]);
  });
});
