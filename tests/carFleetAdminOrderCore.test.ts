import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'admin/car-fleet-admin-order-core.js'), 'utf8')
  .replace(/export function /g, 'function ')
  .concat(`\nthis.FleetAdminOrder = {
    buildAdminOrderMove,
    buildAdminOrderSnapshot,
    getAdminOrderControlState,
    hasCompleteAdminOrder,
    sortFleetItemsByAdminOrder
  };`);
const sandbox: Record<string, any> = {};
vm.runInNewContext(source, sandbox, { filename: 'admin/car-fleet-admin-order-core.js' });
const {
  buildAdminOrderMove,
  buildAdminOrderSnapshot,
  getAdminOrderControlState,
  hasCompleteAdminOrder,
  sortFleetItemsByAdminOrder,
} = sandbox.FleetAdminOrder as any;

const item = (id: string, publicSort: number, location = 'larnaca') => ({
  offer: { id, sort_order: publicSort, location, created_at: `2026-08-11T00:00:0${publicSort}Z` },
});
const row = (offerId: string, order: number, suffix = order) => ({
  offer_id: offerId,
  admin_sort_order: order,
  updated_at: `2026-08-11T00:01:0${suffix}Z`,
});

describe('Cars Admin-only Fleet order', () => {
  test('sorts Admin rows independently from public sort_order', () => {
    const items = [item('vehicle-a', 1), item('vehicle-b', 2), item('vehicle-c', 3)];
    const sorted = sortFleetItemsByAdminOrder(items, [row('vehicle-c', 1), row('vehicle-a', 2), row('vehicle-b', 3)]);
    expect(sorted.map((entry: any) => entry.offer.id)).toEqual(['vehicle-c', 'vehicle-a', 'vehicle-b']);
    expect(sorted.map((entry: any) => entry.offer.sort_order)).toEqual([3, 1, 2]);
  });

  test('moves the last exact offer up using a complete optimistic snapshot', () => {
    const items = [item('vehicle-c', 3), item('vehicle-a', 1), item('vehicle-b', 2)];
    const rows = [row('vehicle-c', 1), row('vehicle-a', 2), row('vehicle-b', 3)];
    const move = buildAdminOrderMove(items, rows, 'vehicle-b', 'up');
    expect(move.moved).toBe(true);
    expect(move.targetOfferId).toBe('vehicle-a');
    expect(move.orderedOfferIds).toEqual(['vehicle-c', 'vehicle-b', 'vehicle-a']);
    expect(move.expectedRows).toEqual(buildAdminOrderSnapshot(items, rows));
  });

  test('reports boundaries without inventing an index move', () => {
    const items = [item('vehicle-a', 1), item('vehicle-b', 2)];
    const rows = [row('vehicle-a', 1), row('vehicle-b', 2)];
    expect(buildAdminOrderMove(items, rows, 'vehicle-a', 'up').moved).toBe(false);
    expect(buildAdminOrderMove(items, rows, 'vehicle-b', 'down').moved).toBe(false);
    expect(getAdminOrderControlState(0, 2)).toEqual({ upDisabled: true, downDisabled: false });
    expect(getAdminOrderControlState(1, 2)).toEqual({ upDisabled: false, downDisabled: true });
  });

  test('fails closed when any persisted Admin order row is missing', () => {
    const items = [item('vehicle-a', 1), item('vehicle-b', 2)];
    expect(hasCompleteAdminOrder(items, [row('vehicle-a', 1)])).toBe(false);
    expect(() => buildAdminOrderSnapshot(items, [row('vehicle-a', 1)])).toThrow(/vehicle-b/);
  });

  test('disables every arrow while filters, grouping, or a write lock make ordering ambiguous', () => {
    expect(getAdminOrderControlState(1, 3, false, false)).toEqual({ upDisabled: true, downDisabled: true });
    expect(getAdminOrderControlState(1, 3, true, true)).toEqual({ upDisabled: true, downDisabled: true });
  });
});
