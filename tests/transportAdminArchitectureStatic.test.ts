import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function functionSlice(source: string, name: string): string {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/);
  return source.slice(start, next === -1 ? source.length : start + marker.length + next);
}

function sha256(relativePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
}

describe('Transport Admin Stage 1A architecture guards', () => {
  const core = read('admin/transport-admin-core.js');
  const admin = read('admin/admin.js');
  const dashboard = read('admin/dashboard.html');

  test('core has no DOM, Supabase, request, toast, or admin-module dependency', () => {
    expect(core).not.toMatch(/\bdocument\b/);
    expect(core).not.toMatch(/\bwindow\b/);
    expect(core).not.toMatch(/querySelector|getElementById|addEventListener/);
    expect(core).not.toMatch(/supabase|\.from\s*\(|\bfetch\s*\(/i);
    expect(core).not.toMatch(/showToast|toast\s*\(/i);
    expect(core).not.toMatch(/admin\/admin\.js|from\s+['"].*admin\.js/);
  });

  test('core exposes the required frozen namespace functions', () => {
    [
      'buildTransportRoutePayload',
      'buildTransportPricingRulePayload',
      'buildTransportDepositOverridePayload',
      'buildReverseRoutePayload',
      'validateTransportRouteDraft',
      'buildTransportSavePlan',
      'executeTransportSavePlan',
    ].forEach((name) => {
      expect(core).toContain(name);
    });
    expect(core).toContain("Object.defineProperty(root, 'TransportAdminCore'");
    expect(core).toContain('const api = Object.freeze({');
  });

  test('dashboard loads core before the existing admin module', () => {
    const coreIndex = dashboard.indexOf('/admin/transport-admin-core.js');
    const adminIndex = dashboard.indexOf('/admin/admin.js');

    expect(coreIndex).toBeGreaterThanOrEqual(0);
    expect(adminIndex).toBeGreaterThan(coreIndex);
  });

  test('Legacy route handler calls shared validation, route, and reverse builders', () => {
    const handler = functionSlice(admin, 'saveTransportRouteForm');

    expect(handler).toContain('TransportAdminCore.validateTransportRouteDraft');
    expect(handler).toContain('TransportAdminCore.buildTransportRoutePayload');
    expect(handler).toContain('TransportAdminCore.buildReverseRoutePayload');
    expect(handler).not.toMatch(/\bday_price\s*:/);
    expect(handler).not.toMatch(/\bnight_price\s*:/);
    expect(handler).not.toMatch(/\bincluded_passengers\s*:/);
    expect(handler).not.toMatch(/\ballows_round_trip\s*:/);
  });

  test('Legacy pricing handler calls shared validation and pricing builder', () => {
    const handler = functionSlice(admin, 'saveTransportPricingForm');

    expect(handler).toContain('TransportAdminCore.validateTransportRouteDraft');
    expect(handler).toContain('TransportAdminCore.buildTransportPricingRulePayload');
    expect(handler).not.toMatch(/\bextra_passenger_fee\s*:/);
    expect(handler).not.toMatch(/\bwaiting_fee_per_hour\s*:/);
    expect(handler).not.toMatch(/\bwaiting_fee_per_minute\s*:/);
    expect(handler).not.toMatch(/\bdeposit_base_floor\s*:/);
  });

  test('Legacy deposit sync calls the shared override builder', () => {
    const handler = functionSlice(admin, 'syncTransportDepositOverridesForRoutes');

    expect(handler).toContain('TransportAdminCore.buildTransportDepositOverridePayload');
    expect(handler).not.toMatch(/\bresource_type\s*:\s*['"]transport['"]/);
    expect(handler).not.toMatch(/\binclude_children\s*:/);
  });

  test('Legacy route and pricing request phases retain their existing order', () => {
    const routeHandler = functionSlice(admin, 'saveTransportRouteForm');
    const routeMainUpdate = routeHandler.indexOf('.update(payload).eq(\'id\', id)');
    const routeSyncAfterUpdate = routeHandler.indexOf('await applyReverseRouteSync()', routeMainUpdate);
    const routeMainInsert = routeHandler.indexOf('.insert(payload)', routeSyncAfterUpdate);
    const routeSyncAfterInsert = routeHandler.indexOf('await applyReverseRouteSync()', routeMainInsert);
    const routeReload = routeHandler.indexOf('await loadTransportRoutesData', routeSyncAfterInsert);

    expect(routeMainUpdate).toBeGreaterThanOrEqual(0);
    expect(routeSyncAfterUpdate).toBeGreaterThan(routeMainUpdate);
    expect(routeMainInsert).toBeGreaterThan(routeSyncAfterUpdate);
    expect(routeSyncAfterInsert).toBeGreaterThan(routeMainInsert);
    expect(routeReload).toBeGreaterThan(routeSyncAfterInsert);

    const pricingHandler = functionSlice(admin, 'saveTransportPricingForm');
    const pricingMainWrite = pricingHandler.indexOf('.update(payload).eq(\'id\', id)');
    const pricingClone = pricingHandler.indexOf('let clonedRulesCount', pricingMainWrite);
    const depositSync = pricingHandler.indexOf('syncTransportDepositOverridesForRoutes', pricingClone);
    const pricingReload = pricingHandler.indexOf('await loadTransportPricingData', depositSync);

    expect(pricingMainWrite).toBeGreaterThanOrEqual(0);
    expect(pricingClone).toBeGreaterThan(pricingMainWrite);
    expect(depositSync).toBeGreaterThan(pricingClone);
    expect(pricingReload).toBeGreaterThan(depositSync);
  });

  test('public transport source files retain their accepted Stage 1A baselines', () => {
    expect(sha256('transport.html')).toBe('7df7fd271f07df066b9d0656ded8dea5da643bba28be82ae7424fa0622c782b2');
    expect(sha256('js/transport-booking.js')).toBe('d9a7ea64af0defe4f305b4c8e0b60ef9dc442e0f1914a2710b8c452e0adc11c5');
    expect(sha256('functions/transport/booking/index.js')).toBe('21a63f1ef9f64ad05bb6b8cb46bd3a5a3a09f5a3ab39848b62cc74f9a2db9e90');
  });
});
