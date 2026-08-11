import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'admin/car-fleet-action-menu.js'), 'utf8');
const sandbox: Record<string, any> = {};
vm.runInNewContext(source, sandbox, { filename: 'admin/car-fleet-action-menu.js' });
const menuApi = sandbox.CarFleetActionMenu as any;

describe('Cars Fleet action menu collision positioning', () => {
  test('opens below a normal row when the complete menu fits', () => {
    const position = menuApi.calculateCollisionPosition({
      anchorRect: { left: 700, right: 736, top: 100, bottom: 136, width: 36, height: 36 },
      menuRect: { width: 184, height: 240 },
      viewportWidth: 1000,
      viewportHeight: 800,
    });
    expect(position.placement).toBe('bottom');
    expect(position.top).toBe(142);
    expect(position.left).toBe(552);
  });

  test('flips above the bottom row and remains completely in the viewport', () => {
    const position = menuApi.calculateCollisionPosition({
      anchorRect: { left: 700, right: 736, top: 740, bottom: 776, width: 36, height: 36 },
      menuRect: { width: 184, height: 240 },
      viewportWidth: 1000,
      viewportHeight: 800,
    });
    expect(position.placement).toBe('top');
    expect(position.top).toBe(494);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.top + 240).toBeLessThanOrEqual(792);
  });

  test('clamps the menu at both horizontal viewport edges', () => {
    const left = menuApi.calculateCollisionPosition({
      anchorRect: { left: 2, right: 38, top: 100, bottom: 136, width: 36, height: 36 },
      menuRect: { width: 184, height: 200 },
      viewportWidth: 390,
      viewportHeight: 844,
      align: 'end',
    });
    const right = menuApi.calculateCollisionPosition({
      anchorRect: { left: 370, right: 406, top: 100, bottom: 136, width: 36, height: 36 },
      menuRect: { width: 184, height: 200 },
      viewportWidth: 390,
      viewportHeight: 844,
      align: 'start',
    });
    expect(left.left).toBe(8);
    expect(right.left).toBe(198);
  });

  test('constrains an unusually tall menu rather than placing it outside the viewport', () => {
    const position = menuApi.calculateCollisionPosition({
      anchorRect: { left: 200, right: 236, top: 390, bottom: 426, width: 36, height: 36 },
      menuRect: { width: 240, height: 1000 },
      viewportWidth: 430,
      viewportHeight: 932,
    });
    expect(position.maxHeight).toBeLessThan(1000);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.clippedVertically).toBe(true);
  });
});
