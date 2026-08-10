import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'admin/car-fleet-operations-core.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  .concat(`\nthis.FleetOperations = {
    buildDesiredFleetAvailabilityRows,
    buildFleetBulkPlan,
    evaluateConfiguredAvailabilityReadiness,
    filterFleetItems,
    groupFleetItemsByPartner,
    reconcileFleetSelection,
    setFleetSelectionScope
  };`);
const sandbox: Record<string, any> = {};
vm.runInNewContext(source, sandbox, { filename: 'admin/car-fleet-operations-core.js' });

const {
  buildDesiredFleetAvailabilityRows,
  buildFleetBulkPlan,
  evaluateConfiguredAvailabilityReadiness,
  filterFleetItems,
  groupFleetItemsByPartner,
  reconcileFleetSelection,
  setFleetSelectionScope,
} = sandbox.FleetOperations as any;

const CITY_LARNACA = 'ca200001-0000-4000-8000-000000000001';
const CITY_AYIA_NAPA = 'ca200001-0000-4000-8000-000000000003';
const PROFILE_LARNACA = 'ca210001-0000-4000-8000-000000000001';
const PARTNER = '583ee90b-d77c-47ff-97a4-76657a87809f';

function context() {
  return {
    cities: [
      { id: CITY_LARNACA, code: 'larnaca', is_active: true },
      { id: CITY_AYIA_NAPA, code: 'ayia-napa', is_active: true },
    ],
    profiles: [{
      id: PROFILE_LARNACA,
      code: 'larnaca',
      calculator_key: 'larnaca',
      legacy_booking_location: 'larnaca',
      is_active: true,
    }],
    partners: [{ id: PARTNER, name: 'Speed Bikes', status: 'active', can_manage_cars: true, cars_locations: ['larnaca'] }],
  };
}

function item(id: string, overrides: Record<string, any> = {}) {
  const offer = {
    id,
    updated_at: '2026-08-11T00:00:00.000Z',
    pricing_strategy: 'legacy_compat',
    pricing_profile_id: PROFILE_LARNACA,
    availability_mode: 'legacy',
    location: 'larnaca',
    owner_partner_id: PARTNER,
    is_available: true,
    stock_count: 1,
    deposit_amount: null,
    min_rental_days: 1,
    max_rental_days: 30,
    ...overrides,
  };
  return {
    offer,
    model: overrides.model || 'Mazda 2',
    commercialClass: 'Economy',
    partnerId: offer.owner_partner_id,
    partnerName: 'Speed Bikes',
    vehicleKindCode: overrides.vehicleKindCode || 'car',
    publicState: { status: overrides.publicStatus || 'LIVE' },
    dailyRateTiers: overrides.dailyRateTiers || [],
    availabilityRows: overrides.availabilityRows || [
      {
        offer_id: id,
        city_id: CITY_LARNACA,
        pickup_enabled: false,
        return_enabled: true,
        is_active: true,
        fee_mode: 'inherit',
        fee_per_direction: null,
        fee_note: null,
        updated_at: '2026-08-11T00:00:01.000Z',
      },
      {
        offer_id: id,
        city_id: CITY_AYIA_NAPA,
        pickup_enabled: true,
        return_enabled: true,
        is_active: true,
        fee_mode: 'inherit',
        fee_per_direction: null,
        fee_note: null,
        updated_at: '2026-08-11T00:00:02.000Z',
      },
    ],
    depositOverride: overrides.depositOverride || null,
  };
}

describe('Cars Fleet Operations core', () => {
  test('directional bulk edits preserve No change and derive is_active', () => {
    const rows = buildDesiredFleetAvailabilityRows(item('offer-a').availabilityRows, [
      { city_id: CITY_LARNACA, pickup: 'no_change', return: 'disable', fee_action: 'custom', fee_per_direction: 0 },
    ]);
    const larnaca = rows.find((row: any) => row.city_id === CITY_LARNACA)!;
    expect(larnaca).toMatchObject({
      pickup_enabled: false,
      return_enabled: false,
      is_active: false,
      fee_mode: 'override',
      fee_per_direction: 0,
    });
  });

  test('legacy pricing can be Ready for exact mapped directional availability', () => {
    const candidate = item('offer-a');
    expect(evaluateConfiguredAvailabilityReadiness({
      offer: candidate.offer,
      availabilityRows: candidate.availabilityRows,
      context: context(),
    })).toMatchObject({ ready: true, pickupCount: 1, returnCount: 2 });
  });

  test('mapped readiness fails closed when every pickup is disabled', () => {
    const candidate = item('offer-a');
    const rows = candidate.availabilityRows.map((row: any) => ({ ...row, pickup_enabled: false }));
    const readiness = evaluateConfiguredAvailabilityReadiness({ offer: candidate.offer, availabilityRows: rows, context: context() });
    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain('At least one active pickup city is required.');
  });

  test('threshold readiness includes tiers, synchronized min/max and exact active owner', () => {
    const validTiers = [{ threshold_days: 1, daily_rate: 50, is_active: true }];
    const candidate = item('offer-threshold', {
      pricing_strategy: 'threshold_daily_rate',
      availability_mode: 'legacy',
      dailyRateTiers: validTiers,
    });
    expect(evaluateConfiguredAvailabilityReadiness({
      offer: candidate.offer,
      availabilityRows: candidate.availabilityRows,
      dailyRateTiers: candidate.dailyRateTiers,
      context: context(),
    })).toMatchObject({ ready: true });

    const invalid = evaluateConfiguredAvailabilityReadiness({
      offer: { ...candidate.offer, owner_partner_id: null, min_rental_days: 2, max_rental_days: 0 },
      availabilityRows: candidate.availabilityRows,
      dailyRateTiers: candidate.dailyRateTiers,
      context: context(),
    });
    expect(invalid.ready).toBe(false);
    expect(invalid.reasons).toEqual(expect.arrayContaining([
      'Minimum rental days must match the lowest active daily-rate tier.',
      'Maximum rental days cannot be below the threshold minimum.',
      'An active exact Cars owner partner is required.',
    ]));
  });

  test('reviewed partner assignment participates in threshold mapped readiness', () => {
    const candidate = item('offer-threshold', {
      pricing_strategy: 'threshold_daily_rate',
      owner_partner_id: null,
      min_rental_days: 1,
      max_rental_days: null,
      dailyRateTiers: [{ threshold_days: 1, daily_rate: 50, is_active: true }],
    });
    const plan = buildFleetBulkPlan({
      selectedOfferIds: [candidate.offer.id],
      items: [candidate] as any,
      context: context(),
      operations: {
        availability_mode: 'mapped',
        partner: { action: 'assign', partner_id: PARTNER },
      },
    });
    expect(plan.valid).toBe(true);
    expect(plan.targets[0].readiness.ready).toBe(true);
  });

  test('combined filters and Partner grouping use derived presentation state only', () => {
    const items = [
      item('offer-a'),
      item('offer-b', { pricing_strategy: 'threshold_daily_rate', availability_mode: 'mapped', vehicleKindCode: 'buggy', model: 'Polaris', publicStatus: 'READY' }),
    ];
    expect(filterFleetItems(items as any, {
      search: 'Polaris',
      partnerId: PARTNER,
      vehicleKind: 'buggy',
      pricingStrategy: 'threshold_daily_rate',
      availabilityMode: 'mapped',
      publicStatus: 'READY',
      cityId: CITY_LARNACA,
    }).map((entry: any) => entry.offer.id)).toEqual(['offer-b']);
    const groups = groupFleetItemsByPartner(items as any, context().partners);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ count: 2, legacyAvailability: 1, configuredAvailability: 1 });
  });

  test('select-visible scope never selects hidden IDs and reconciliation removes deleted IDs', () => {
    let selected = setFleetSelectionScope(new Set<string>(), ['offer-a'], true);
    expect([...selected]).toEqual(['offer-a']);
    selected = setFleetSelectionScope(selected, ['offer-b'], true);
    expect([...selected].sort()).toEqual(['offer-a', 'offer-b']);
    selected = reconcileFleetSelection(selected, [item('offer-b')] as any);
    expect([...selected]).toEqual(['offer-b']);
  });

  test('one reviewed plan contains exact snapshots and all approved operations', () => {
    const first = item('offer-a');
    const second = item('offer-b', {
      depositOverride: {
        id: 'override-b',
        updated_at: '2026-08-11T00:00:03.000Z',
        mode: 'flat',
        amount: 20,
        currency: 'EUR',
        include_children: true,
        enabled: true,
      },
    });
    const plan = buildFleetBulkPlan({
      selectedOfferIds: ['offer-a', 'offer-b'],
      items: [first, second] as any,
      context: context(),
      operations: {
        availability_mode: 'mapped',
        cities: [{ city_id: CITY_LARNACA, pickup: 'disable', return: 'enable', fee_action: 'inherit' }],
        security_deposit: { action: 'none' },
        payment_due: { action: 'percent_total', amount: 15, currency: 'EUR' },
        partner: { action: 'assign', partner_id: PARTNER },
      },
    });
    expect(plan.valid).toBe(true);
    expect(plan.selectedCount).toBe(2);
    expect(plan.targets).toHaveLength(2);
    expect(plan.targets[0]).toHaveProperty('expected_availability');
    expect(plan.targets[1].expected_deposit_override).toMatchObject({ id: 'override-b', amount: 20 });
    expect(plan.operations.payment_due).toMatchObject({ action: 'percent_total', amount: 15 });
  });

  test('unrelated bulk actions never request an availability rowset write', () => {
    const plan = buildFleetBulkPlan({
      selectedOfferIds: ['offer-a'],
      items: [item('offer-a')] as any,
      context: context(),
      operations: { security_deposit: { action: 'none' } },
    });
    expect(plan.valid).toBe(true);
    expect(plan.targets[0].desired_availability).toBeNull();
  });

  test('legacy partner assignment fails Review when compatibility region is unsupported', () => {
    const incompatible = {
      ...context(),
      partners: [{ id: PARTNER, name: 'Speed Bikes', status: 'active', can_manage_cars: true, cars_locations: ['paphos'] }],
    };
    const plan = buildFleetBulkPlan({
      selectedOfferIds: ['offer-a'],
      items: [item('offer-a')] as any,
      context: incompatible,
      operations: { partner: { action: 'assign', partner_id: PARTNER } },
    });
    expect(plan.valid).toBe(false);
    expect(plan.errors.join(' ')).toContain('does not support the legacy compatibility region larnaca');
  });

  test('blocked mapped target and invalid custom fee abort the whole plan', () => {
    const plan = buildFleetBulkPlan({
      selectedOfferIds: ['offer-a', 'offer-b'],
      items: [item('offer-a'), item('offer-b')] as any,
      context: context(),
      operations: {
        availability_mode: 'mapped',
        cities: [
          { city_id: CITY_LARNACA, pickup: 'disable', return: 'disable', fee_action: 'custom', fee_per_direction: '' },
          { city_id: CITY_AYIA_NAPA, pickup: 'disable', return: 'no_change', fee_action: 'no_change' },
        ],
      },
    });
    expect(plan.valid).toBe(false);
    expect(plan.errors.join(' ')).toContain('Custom fee');
    expect(plan.errors.join(' ')).toContain('At least one active pickup city');
  });

  test('individual edit remains possible after a bulk plan by changing one exact row', () => {
    const bulkRows = buildDesiredFleetAvailabilityRows(item('offer-a').availabilityRows, [
      { city_id: CITY_LARNACA, pickup: 'enable', return: 'enable', fee_action: 'inherit' },
    ]);
    const individualRows = buildDesiredFleetAvailabilityRows(bulkRows, [
      { city_id: CITY_LARNACA, pickup: 'disable', return: 'no_change', fee_action: 'custom', fee_per_direction: 20 },
    ]);
    expect(individualRows.find((row: any) => row.city_id === CITY_LARNACA)).toMatchObject({
      pickup_enabled: false,
      return_enabled: true,
      fee_mode: 'override',
      fee_per_direction: 20,
    });
  });
});
