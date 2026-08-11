import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type RateResolutionApi = {
  CALENDAR_PRECEDENCE: readonly string[];
  enumerateStayDates: (checkIn: string, checkOut: string) => any;
  isoWeekday: (date: string) => number | null;
  selectOccupancyLosTier: (tiers: any[], guests: number, nights: number) => any;
  analyzeOccupancyLosTiers: (tiers: any[], options?: Record<string, unknown>) => any;
  resolveCalendarDate: (options: Record<string, unknown>) => any;
  detectEqualPriorityAmbiguities: (options: Record<string, unknown>) => any[];
  resolveDailyInventory: (options: Record<string, unknown>) => any;
  resolveStayInventory: (options: Record<string, unknown>) => any;
  resolveStayQuote: (options: Record<string, unknown>) => any;
};

type LegacyPricingApi = {
  calculateHotelPrice: (
    hotel: Record<string, unknown>,
    persons: number,
    nights: number,
    options?: Record<string, unknown>,
  ) => any;
};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function loadApis(): { resolver: RateResolutionApi; legacy: LegacyPricingApi } {
  const sandbox: Record<string, any> = {
    console,
    Date,
    Math,
    Number,
    Object,
    Array,
    Set,
    Map,
    WeakMap,
    URLSearchParams,
    location: { search: '' },
    document: { documentElement: { lang: 'en' } },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/hotel-v2-rate-resolution.js'), sandbox, {
    filename: 'js/hotel-v2-rate-resolution.js',
  });
  vm.runInContext(read('js/hotel-pricing.js'), sandbox, {
    filename: 'js/hotel-pricing.js',
  });
  return {
    resolver: sandbox.CE_HOTEL_V2_RATE_RESOLUTION as RateResolutionApi,
    legacy: sandbox.CE_HOTEL_PRICING as LegacyPricingApi,
  };
}

function addUtcDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const THRESHOLD_NIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SEVEN_ARCHES_MATRIX = [
  { guests: 2, rates: [100, 90, 88, 84, 80, 76, 74, 72, 70] },
  { guests: 3, rates: [130, 113, 113, 104, 100, 95, 94, 90, 90] },
  { guests: 4, rates: [155, 135, 135, 120, 118, 114, 111, 107, 107] },
  { guests: 5, rates: [200, 180, 176, 168, 160, 152, 148, 144, 140] },
  { guests: 6, rates: [260, 226, 226, 208, 200, 190, 188, 180, 180] },
  { guests: 7, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
  { guests: 8, rates: [310, 270, 270, 240, 236, 228, 222, 214, 214] },
] as const;

const SEVEN_ARCHES_TIERS = SEVEN_ARCHES_MATRIX.flatMap((row) => (
  THRESHOLD_NIGHTS.map((threshold, index) => ({
    id: `7-arches-${row.guests}-${threshold}`,
    guest_count: row.guests,
    threshold_nights: threshold,
    nightly_rate: row.rates[index],
    is_active: true,
  }))
));

const SEVEN_ARCHES_LEGACY = {
  pricing_model: 'tiered_by_nights',
  pricing_tiers: {
    currency: 'EUR',
    rules: SEVEN_ARCHES_TIERS.map((tier) => ({
      persons: tier.guest_count,
      min_nights: tier.threshold_nights,
      price_per_night: tier.nightly_rate,
    })),
  },
  pricing_extras: { currency: 'EUR', items: [] },
  room_types: [],
  max_persons: 8,
};

describe('Hotels V2 H2B deterministic rate-resolution core', () => {
  const { resolver, legacy } = loadApis();
  const activeRoomRate = {
    id: '10000000-0000-4000-8000-000000000001',
    is_active: true,
    base_nightly_rate: 100,
    currency: 'EUR',
  };

  test('uses UTC calendar dates so Cyprus DST does not change the number of hotel nights', () => {
    expect(resolver.enumerateStayDates('2026-03-28', '2026-03-31')).toEqual({
      ok: true,
      reason: null,
      check_in: '2026-03-28',
      check_out: '2026-03-31',
      nights: 3,
      stay_dates: ['2026-03-28', '2026-03-29', '2026-03-30'],
    });
    expect(resolver.enumerateStayDates('2026-10-24', '2026-10-27').nights).toBe(3);
    expect(resolver.enumerateStayDates('2026-02-30', '2026-03-02')).toMatchObject({
      ok: false,
      reason: 'invalid_stay_dates',
    });
    expect(resolver.isoWeekday('2026-08-03')).toBe(1);
  });

  test('applies base < weekday < range < exact-date pricing with field provenance', () => {
    const common = {
      base_nightly_rate: 100,
      base_source: { layer: 'room_rate_base', source_id: activeRoomRate.id },
      weekday_rules: [{
        id: 'monday-rate',
        weekdays: [1],
        valid_from: '2026-08-01',
        valid_to: '2026-09-30',
        nightly_rate: 95,
        minimum_stay: 2,
        priority: 1,
        is_active: true,
      }],
      range_rules: [{
        id: 'august-season',
        valid_from: '2026-08-01',
        valid_to: '2026-08-31',
        nightly_rate: 90,
        maximum_stay: 8,
        priority: 10,
        is_active: true,
      }],
      exact_date_overrides: [{
        id: 'august-3-admin',
        stay_date: '2026-08-03',
        nightly_rate: 80,
        closed_to_arrival: true,
        priority: 0,
        is_active: true,
      }],
    };

    const exact = resolver.resolveCalendarDate({ ...common, date: '2026-08-03' });
    expect(exact).toMatchObject({
      ok: true,
      nightly_rate: 80,
      minimum_stay: 2,
      maximum_stay: 8,
      closed_to_arrival: true,
      provenance: {
        nightly_rate: { layer: 'exact_date_override', source_id: 'august-3-admin' },
        minimum_stay: { layer: 'weekday_rule', source_id: 'monday-rate' },
        maximum_stay: { layer: 'range_rule', source_id: 'august-season' },
      },
    });
    expect(resolver.resolveCalendarDate({ ...common, date: '2026-08-04' })).toMatchObject({
      nightly_rate: 90,
      provenance: { nightly_rate: { layer: 'range_rule', source_id: 'august-season' } },
    });
    expect(resolver.resolveCalendarDate({ ...common, date: '2026-09-07' })).toMatchObject({
      nightly_rate: 95,
      provenance: { nightly_rate: { layer: 'weekday_rule', source_id: 'monday-rate' } },
    });
    expect(resolver.resolveCalendarDate({ ...common, date: '2026-09-08' })).toMatchObject({
      nightly_rate: 100,
      provenance: { nightly_rate: { layer: 'room_rate_base', source_id: activeRoomRate.id } },
    });
  });

  test('treats exact override CLEAR/INHERIT as field fall-through, never as a resolved NULL', () => {
    const result = resolver.resolveCalendarDate({
      date: '2026-08-03',
      base_nightly_rate: 100,
      weekday_rules: [{
        id: 'monday-rate',
        weekdays: [1],
        nightly_rate: 95,
        minimum_stay: 2,
        closed: true,
        priority: 1,
        is_active: true,
      }],
      exact_date_overrides: [{
        id: 'admin-clear-fields',
        stay_date: '2026-08-03',
        nightly_rate: 40,
        nightly_rate_action: 'clear',
        minimum_stay: 9,
        minimum_stay_mode: 'inherit',
        closed: false,
        closed_action: 'set',
        is_active: true,
      }],
    });
    expect(result).toMatchObject({
      ok: true,
      nightly_rate: 95,
      minimum_stay: 2,
      closed: false,
      provenance: {
        nightly_rate: { layer: 'weekday_rule', source_id: 'monday-rate' },
        minimum_stay: { layer: 'weekday_rule', source_id: 'monday-rate' },
        closed: { layer: 'exact_date_override', source_id: 'admin-clear-fields' },
      },
    });

    expect(resolver.resolveCalendarDate({
      date: '2026-08-03',
      base_nightly_rate: 100,
      exact_date_overrides: [{
        id: 'nullable-fields-fall-through',
        stay_date: '2026-08-03',
        nightly_rate: null,
        minimum_stay: null,
        is_active: true,
      }],
    })).toMatchObject({ ok: true, nightly_rate: 100, minimum_stay: null });
  });

  test('ignores expired exact overrides and inventory using a deterministic supplied instant', () => {
    const now = '2026-08-11T12:00:00.000Z';
    const calendar = resolver.resolveCalendarDate({
      date: '2026-08-12',
      as_of: now,
      base_nightly_rate: 100,
      exact_date_overrides: [
        { id: 'expired-rate', stay_date: '2026-08-12', nightly_rate: 10, is_active: true, expires_at: '2026-08-11T11:59:59.000Z' },
        { id: 'future-rate', stay_date: '2026-08-12', nightly_rate: 120, is_active: true, expires_at: '2026-08-11T12:00:01.000Z' },
      ],
    });
    expect(calendar).toMatchObject({
      ok: true,
      as_of: now,
      nightly_rate: 120,
      provenance: { nightly_rate: { source_id: 'future-rate' } },
    });

    expect(resolver.resolveDailyInventory({
      date: '2026-08-12',
      now,
      base_inventory_count: 4,
      daily_inventory: [{ id: 'expired-inventory', stay_date: '2026-08-12', sellable_units: 0, closed: true, expires_at: '2026-08-11T12:00:00.000Z' }],
    })).toMatchObject({ ok: true, sellable_units: 4, available_units: 4, closed: false, provenance: { inventory: 'room_type_base_inventory' } });

    expect(resolver.resolveDailyInventory({
      date: '2026-08-12',
      now,
      base_inventory_count: 4,
      daily_inventory: [{
        id: 'closure-with-inherited-stock', stay_date: '2026-08-12',
        sellable_units: null, sellable_units_mode: 'clear',
        closed: true, closed_mode: 'set', expires_at: '2026-08-11T12:00:01.000Z',
      }],
    })).toMatchObject({ ok: true, sellable_units: 4, available_units: 0, closed: true });

    expect(resolver.resolveStayQuote({
      room_rate: activeRoomRate,
      guest_count: 2,
      check_in: '2026-08-12',
      check_out: '2026-08-13',
      as_of: now,
      exact_date_overrides: [{
        id: 'expired-quote-rate',
        stay_date: '2026-08-12',
        nightly_rate: 1,
        is_active: true,
        expires_at: now,
      }],
      inventory: {
        base_inventory_count: 2,
        daily_inventory: [{
          id: 'expired-quote-inventory',
          stay_date: '2026-08-12',
          sellable_units: 0,
          closed: true,
          expires_at: now,
        }],
      },
    })).toMatchObject({
      ok: true,
      requestable: true,
      as_of: now,
      total: 100,
      inventory: { minimum_available_units: 2 },
    });

    expect(resolver.resolveCalendarDate({
      date: '2026-08-12',
      as_of: 'not-an-instant',
      base_nightly_rate: 100,
    })).toMatchObject({ ok: false, reason: 'invalid_resolution_instant' });
  });

  test('fails closed for SET without a valid override value or an unknown field action', () => {
    expect(resolver.resolveCalendarDate({
      date: '2026-08-03',
      base_nightly_rate: 100,
      exact_date_overrides: [{
        id: 'missing-set-value',
        stay_date: '2026-08-03',
        nightly_rate: null,
        nightly_rate_action: 'set',
        is_active: true,
      }],
    })).toMatchObject({
      ok: false,
      reason: 'invalid_calendar_rule_patch',
      ambiguities: [{
        source_id: 'missing-set-value',
        fields: ['nightly_rate'],
      }],
    });
    expect(resolver.resolveCalendarDate({
      date: '2026-08-03',
      base_nightly_rate: 100,
      exact_date_overrides: [{
        id: 'unknown-action',
        stay_date: '2026-08-03',
        nightly_rate: 80,
        nightly_rate_action: 'silently_guess',
        is_active: true,
      }],
    })).toMatchObject({ ok: false, reason: 'invalid_calendar_rule_patch' });
  });

  test('safety closure is final and cannot be reopened by a calendar override', () => {
    const result = resolver.resolveCalendarDate({
      date: '2026-08-03',
      base_nightly_rate: 100,
      exact_date_overrides: [{
        id: 'admin-open',
        stay_date: '2026-08-03',
        nightly_rate: 80,
        closed: false,
        is_active: true,
      }],
      safety_closures: [{
        id: 'fire-safety',
        stay_date: '2026-08-03',
        is_active: true,
      }],
    });
    expect(result).toMatchObject({
      ok: true,
      nightly_rate: 80,
      closed: true,
      provenance: { closed: { layer: 'safety_closure', source_id: 'fire-safety' } },
    });
    expect(resolver.CALENDAR_PRECEDENCE.slice(0, 4)).toEqual([
      'safety_closure',
      'exact_date_override',
      'range_rule',
      'weekday_rule',
    ]);
  });

  test('fails closed when two matching rules have the same top priority', () => {
    const rangeRules = [
      {
        id: 'summer-a', valid_from: '2026-08-01', valid_to: '2026-08-31',
        nightly_rate: 120, priority: 20, is_active: true,
      },
      {
        id: 'summer-b', valid_from: '2026-08-15', valid_to: '2026-09-15',
        nightly_rate: 130, priority: 20, is_active: true,
      },
      {
        id: 'lower-priority', valid_from: '2026-08-01', valid_to: '2026-08-31',
        nightly_rate: 90, priority: 5, is_active: true,
      },
    ];
    const result = resolver.resolveCalendarDate({
      date: '2026-08-20',
      base_nightly_rate: 100,
      range_rules: rangeRules,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: 'ambiguous_calendar_rules',
      ambiguities: [{
        code: 'equal_priority_calendar_rules',
        layer: 'range_rule',
        priority: 20,
        source_ids: ['summer-a', 'summer-b'],
      }],
    });
    expect(resolver.detectEqualPriorityAmbiguities({
      dates: ['2026-08-14', '2026-08-20'],
      range_rules: rangeRules,
    })).toEqual([expect.objectContaining({ date: '2026-08-20', layer: 'range_rule' })]);
  });

  test('selects one exact-occupancy LOS tier for every night without blending', () => {
    const tiers = [
      { id: '2p-1', guest_count: 2, threshold_nights: 1, nightly_rate: 50, is_active: true },
      { id: '2p-3', guest_count: 2, threshold_nights: 3, nightly_rate: 45, is_active: true },
      { id: '2p-7', guest_count: 2, threshold_nights: 7, nightly_rate: 40, is_active: true },
      { id: '3p-1', guest_count: 3, threshold_nights: 1, nightly_rate: 75, is_active: true },
    ];
    expect(resolver.selectOccupancyLosTier(tiers, 2, 6)).toMatchObject({
      ok: true,
      tier: { id: '2p-3', guest_count: 2, threshold_nights: 3, nightly_rate: 45 },
    });
    const quote = resolver.resolveStayQuote({
      room_rate: activeRoomRate,
      pricing_strategy: 'occupancy_los',
      occupancy_los_tiers: tiers,
      guest_count: 2,
      check_in: '2026-09-01',
      check_out: '2026-09-07',
    });
    expect(quote).toMatchObject({
      ok: true,
      requestable: true,
      total: 270,
      selected_occupancy_los_tier: { id: '2p-3', nightly_rate: 45 },
    });
    expect(quote.nightly_breakdown).toHaveLength(6);
    expect(new Set(quote.nightly_breakdown.map((row: any) => row.nightly_rate))).toEqual(new Set([45]));
  });

  test('rejects missing guests, below-first thresholds and duplicate occupancy thresholds', () => {
    const tiers = [
      { id: '2p-2', guest_count: 2, threshold_nights: 2, nightly_rate: 100, is_active: true },
      { id: '2p-2-duplicate', guest_count: 2, threshold_nights: 2, nightly_rate: 99, is_active: true },
    ];
    expect(resolver.selectOccupancyLosTier(tiers.slice(0, 1), 1, 2)).toMatchObject({
      ok: false,
      reason: 'missing_occupancy_los_guest',
    });
    expect(resolver.selectOccupancyLosTier(tiers.slice(0, 1), 2, 1)).toMatchObject({
      ok: false,
      reason: 'missing_occupancy_los_tier',
    });
    expect(resolver.selectOccupancyLosTier(tiers, 2, 2)).toMatchObject({
      ok: false,
      reason: 'ambiguous_occupancy_los_tiers',
      ambiguities: [{
        code: 'duplicate_occupancy_los_threshold',
        guest_count: 2,
        threshold_nights: 2,
        source_ids: ['2p-2', '2p-2-duplicate'],
      }],
    });
  });

  test('only ACTIVE occupancy tiers enable inferred occupancy/LOS pricing', () => {
    const inactiveOnly = [{
      id: 'inactive-2p-1',
      guest_count: 2,
      threshold_nights: 1,
      nightly_rate: 1,
      is_active: false,
    }];
    const quote = resolver.resolveStayQuote({
      room_rate: activeRoomRate,
      occupancy_los_tiers: inactiveOnly,
      guest_count: 2,
      check_in: '2026-09-01',
      check_out: '2026-09-03',
    });
    expect(quote).toMatchObject({
      ok: true,
      requestable: true,
      pricing_strategy: 'base_nightly_rate',
      selected_occupancy_los_tier: null,
      total: 200,
    });
    expect(resolver.selectOccupancyLosTier(inactiveOnly, 2, 2)).toMatchObject({
      ok: false,
      reason: 'missing_occupancy_los_guest',
    });
  });

  test('returns auditable nightly restrictions and evaluates arrival/departure independently', () => {
    const quote = resolver.resolveStayQuote({
      room_rate: activeRoomRate,
      guest_count: 2,
      check_in: '2026-08-03',
      check_out: '2026-08-06',
      exact_date_overrides: [
        {
          id: 'arrival-policy', stay_date: '2026-08-03', nightly_rate: 110,
          minimum_stay: 2, maximum_stay: 5, is_active: true,
        },
        {
          id: 'departure-policy', stay_date: '2026-08-06',
          closed_to_departure: true, is_active: true,
        },
      ],
    });
    expect(quote).toMatchObject({
      ok: true,
      requestable: false,
      total: 310,
      blocking_reasons: ['closed_to_departure'],
      departure_restrictions: {
        date: '2026-08-06',
        closed_to_departure: true,
        provenance: {
          closed_to_departure: { layer: 'exact_date_override', source_id: 'departure-policy' },
        },
      },
    });
    expect(quote.nightly_breakdown[0]).toMatchObject({
      date: '2026-08-03',
      nightly_rate: 110,
      minimum_stay: 2,
      maximum_stay: 5,
      provenance: {
        nightly_rate: { layer: 'exact_date_override', source_id: 'arrival-policy' },
      },
    });
  });

  test('fails closed when only the non-charged departure date has ambiguous CTD rules', () => {
    const quote = resolver.resolveStayQuote({
      room_rate: activeRoomRate,
      guest_count: 2,
      check_in: '2026-08-02',
      check_out: '2026-08-03',
      as_of: '2026-08-01T00:00:00.000Z',
      weekday_rules: [
        {
          id: 'monday-ctd-a',
          valid_from: '2026-08-01',
          valid_to: '2026-08-31',
          weekdays: [1],
          nightly_rate: 100,
          closed_to_departure: true,
          priority: 5,
          is_active: true,
        },
        {
          id: 'monday-ctd-b',
          valid_from: '2026-08-01',
          valid_to: '2026-08-31',
          weekdays: [1],
          nightly_rate: 100,
          closed_to_departure: false,
          priority: 5,
          is_active: true,
        },
      ],
    });
    expect(quote).toMatchObject({
      ok: false,
      requestable: false,
      reason: 'ambiguous_calendar_rules',
      nightly_breakdown: [{ date: '2026-08-02', ok: true }],
      departure_restrictions: {
        date: '2026-08-03',
        ok: false,
        ambiguities: [{
          code: 'equal_priority_calendar_rules',
          layer: 'weekday_rule',
          source_ids: ['monday-ctd-a', 'monday-ctd-b'],
        }],
      },
    });
  });

  test('resolves base/daily inventory, holds and safety closures without oversell', () => {
    const options = {
      dates: ['2026-08-03', '2026-08-04'],
      requested_units: 2,
      base_inventory_count: 4,
      daily_inventory: [{
        id: 'inventory-3', stay_date: '2026-08-03', sellable_units: 3, closed: false,
      }],
      reserved_units: { '2026-08-03': 1 },
      held_units: { '2026-08-03': 1 },
      safety_closures: [{ id: 'closure-4', stay_date: '2026-08-04', is_active: true }],
    };
    const inventory = resolver.resolveStayInventory(options);
    expect(inventory).toMatchObject({
      ok: true,
      requestable: false,
      reason: 'insufficient_or_closed_inventory',
      requested_units: 2,
      minimum_available_units: 0,
      daily: [
        {
          date: '2026-08-03', sellable_units: 3, reserved_units: 1,
          held_units: 1, available_units: 1, closed: false,
          provenance: { inventory: 'daily_inventory', source_id: 'inventory-3' },
        },
        {
          date: '2026-08-04', sellable_units: 4, available_units: 0, closed: true,
          provenance: { inventory: 'room_type_base_inventory', safety_closure_ids: ['closure-4'] },
        },
      ],
    });
    expect(resolver.resolveDailyInventory({
      date: '2026-08-03',
      base_inventory_count: 4,
      daily_inventory: [
        { id: 'duplicate-a', stay_date: '2026-08-03', sellable_units: 3 },
        { id: 'duplicate-b', stay_date: '2026-08-03', sellable_units: 2 },
      ],
    })).toMatchObject({ ok: false, reason: 'ambiguous_daily_inventory' });
  });

  test('reproduces all 63 unambiguous 7 Arches guest/LOS rates in isolation', () => {
    expect(SEVEN_ARCHES_TIERS).toHaveLength(63);
    let hotel7ArchesRoom1PriceMismatch = 0;
    let evaluated = 0;
    for (const matrixRow of SEVEN_ARCHES_MATRIX) {
      THRESHOLD_NIGHTS.forEach((nights, index) => {
        const checkIn = '2026-09-01';
        const expectedRate = matrixRow.rates[index];
        const quote = resolver.resolveStayQuote({
          room_rate: activeRoomRate,
          pricing_strategy: 'occupancy_los',
          occupancy_los_tiers: SEVEN_ARCHES_TIERS,
          guest_count: matrixRow.guests,
          check_in: checkIn,
          check_out: addUtcDays(checkIn, nights),
        });
        evaluated += 1;
        if (
          !quote.ok
          || !quote.requestable
          || quote.selected_occupancy_los_tier?.nightly_rate !== expectedRate
          || quote.total !== expectedRate * nights
          || quote.nightly_breakdown.some((night: any) => night.nightly_rate !== expectedRate)
        ) hotel7ArchesRoom1PriceMismatch += 1;
      });
    }
    expect(evaluated).toBe(63);
    expect(hotel7ArchesRoom1PriceMismatch).toBe(0);

    for (const nights of [11, 14]) {
      const quote = resolver.resolveStayQuote({
        room_rate: activeRoomRate,
        pricing_strategy: 'occupancy_los',
        occupancy_los_tiers: SEVEN_ARCHES_TIERS,
        guest_count: 2,
        check_in: '2026-09-01',
        check_out: addUtcDays('2026-09-01', nights),
      });
      expect(quote.selected_occupancy_los_tier).toMatchObject({
        threshold_nights: 10,
        nightly_rate: 70,
      });
      expect(quote.total).toBe(70 * nights);
    }
  });

  test('marks 7 Arches one-night and one-person legacy behavior as explicit migration ambiguities', () => {
    const analysis = resolver.analyzeOccupancyLosTiers(SEVEN_ARCHES_TIERS, {
      expected_guest_counts: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    expect(analysis).toMatchObject({
      active_tier_count: 63,
      unsupported_guest_counts: [1],
      one_night_gap_guest_counts: [2, 3, 4, 5, 6, 7, 8],
      duplicate_thresholds: [],
      invalid_tier_ids: [],
      unambiguous: false,
    });
    expect(analysis.minimum_threshold_by_guest).toMatchObject({
      2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2,
    });

    const oneNightV2 = resolver.resolveStayQuote({
      room_rate: activeRoomRate,
      pricing_strategy: 'occupancy_los',
      occupancy_los_tiers: SEVEN_ARCHES_TIERS,
      guest_count: 2,
      check_in: '2026-09-01',
      check_out: '2026-09-02',
    });
    expect(oneNightV2).toMatchObject({
      ok: false,
      requestable: false,
      reason: 'missing_occupancy_los_tier',
    });
    const onePersonV2 = resolver.resolveStayQuote({
      room_rate: activeRoomRate,
      pricing_strategy: 'occupancy_los',
      occupancy_los_tiers: SEVEN_ARCHES_TIERS,
      guest_count: 1,
      check_in: '2026-09-01',
      check_out: '2026-09-03',
    });
    expect(onePersonV2).toMatchObject({
      ok: false,
      requestable: false,
      reason: 'missing_occupancy_los_guest',
    });

    // These are current legacy outcomes, not V2 defaults. They prove why migration
    // must stop for an explicit business decision instead of silently normalizing.
    expect(legacy.calculateHotelPrice(SEVEN_ARCHES_LEGACY, 2, 1)).toMatchObject({
      pricePerNight: 100,
      billableNights: 2,
      total: 200,
    });
    expect(legacy.calculateHotelPrice(SEVEN_ARCHES_LEGACY, 1, 1)).toMatchObject({
      pricePerNight: 70,
      billableNights: 10,
      total: 700,
    });
  });
});
