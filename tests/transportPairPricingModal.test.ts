import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type TransportPairPricingModalApi = {
  comparePairValues: (
    outbound: Record<string, unknown> | null,
    reverse: Record<string, unknown> | null,
    fields: string[],
  ) => { available: boolean; different: boolean; differences: string[] };
  createReadRepository: (options: Record<string, unknown>) => {
    findReverseRoute: (originId: string, destinationId: string) => Promise<Record<string, unknown> | null>;
  };
  findReverseRouteInRows: (
    routes: Array<Record<string, unknown>>,
    outbound: Record<string, unknown>,
  ) => Record<string, unknown> | null;
  hasCurrencyConflict: (
    outbound: Record<string, unknown> | null,
    reverse: Record<string, unknown> | null,
  ) => boolean;
  selectInitialPricingRuleId: (rules: Array<Record<string, unknown>>) => string;
};

function loadModalApi(): TransportPairPricingModalApi {
  const filename = path.join(process.cwd(), 'admin/transport-route-pricing-modal.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.TransportPairPricingModal as TransportPairPricingModalApi;
}

describe('Transport Admin Stage 2B pair pricing modal helpers', () => {
  const api = loadModalApi();

  test('finds only the reverse route by swapped location IDs', async () => {
    const outbound = {
      id: 'route-a-b',
      origin_location_id: 'location-a',
      destination_location_id: 'location-b',
    };
    const reverse = {
      id: 'route-b-a',
      origin_location_id: 'location-b',
      destination_location_id: 'location-a',
    };
    const unrelated = {
      id: 'route-a-c',
      origin_location_id: 'location-a',
      destination_location_id: 'location-c',
    };

    expect(api.findReverseRouteInRows([outbound, unrelated, reverse], outbound)?.id).toBe('route-b-a');

    const filters: Array<[string, unknown]> = [];
    let query: Record<string, jest.Mock>;
    query = {
      select: jest.fn(() => query),
      eq: jest.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      }),
      limit: jest.fn(async () => ({ data: [reverse], error: null })),
    };
    const repository = api.createReadRepository({
      runRead: (operation: (client: Record<string, unknown>) => unknown) => operation({
        from: jest.fn(() => query),
      }),
    });

    await expect(repository.findReverseRoute('location-a', 'location-b')).resolves.toMatchObject({
      id: 'route-b-a',
    });
    expect(filters).toEqual([
      ['origin_location_id', 'location-b'],
      ['destination_location_id', 'location-a'],
    ]);
  });

  test('preselects exactly one active pricing rule', () => {
    expect(api.selectInitialPricingRuleId([{ id: 'rule-active', is_active: true }])).toBe('rule-active');
  });

  test('does not preselect when there are multiple pricing rules', () => {
    expect(api.selectInitialPricingRuleId([
      { id: 'rule-one', is_active: true },
      { id: 'rule-two', is_active: true },
    ])).toBe('');
  });

  test('does not preselect a single inactive pricing rule', () => {
    expect(api.selectInitialPricingRuleId([{ id: 'rule-inactive', is_active: false }])).toBe('');
  });

  test('keeps the selection empty when a route has no pricing rules', () => {
    expect(api.selectInitialPricingRuleId([])).toBe('');
  });

  test('reports mixed values without preferring the outbound record', () => {
    const comparison = api.comparePairValues(
      { day_price: 70, night_price: 90, max_passengers: 8 },
      { day_price: 65, night_price: 90, max_passengers: 6 },
      ['day_price', 'night_price', 'max_passengers'],
    );

    expect(comparison.available).toBe(true);
    expect(comparison.different).toBe(true);
    expect(Array.from(comparison.differences)).toEqual(['day_price', 'max_passengers']);
  });

  test('detects a currency conflict only when both currencies exist and differ', () => {
    expect(api.hasCurrencyConflict({ currency: 'eur' }, { currency: 'USD' })).toBe(true);
    expect(api.hasCurrencyConflict({ currency: 'EUR' }, { currency: 'eur' })).toBe(false);
    expect(api.hasCurrencyConflict({ currency: 'EUR' }, null)).toBe(false);
  });
});
