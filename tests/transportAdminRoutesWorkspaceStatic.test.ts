import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('Transport Admin Stage 1C Routes workspace guards', () => {
  const dashboard = read('admin/dashboard.html');
  const admin = read('admin/admin.js');
  const navigation = read('admin/transport-admin-navigation.js');
  const css = read('admin/admin.css');

  test('provides the complete local toolbar and CRM list workspace', () => {
    [
      'transportAdminV2RoutesSearch',
      'transportAdminV2RoutesOrigin',
      'transportAdminV2RoutesDestination',
      'transportAdminV2RoutesCurrency',
      'transportAdminV2RoutesCityGroup',
      'transportAdminV2RoutesStatus',
      'btnTransportAdminV2ClearFilters',
      'btnRefreshTransport',
      'btnTransportAdminV2AddRoute',
      'transportAdminV2RoutesCount',
      'transportAdminV2RoutesWorkspace',
      'transportAdminV2RoutesList',
    ].forEach((id) => expect((dashboard.match(new RegExp(`id="${id}"`, 'g')) || [])).toHaveLength(1));
    expect(dashboard).toMatch(/id="btnTransportAdminV2AddRoute"[\s\S]{0,180}aria-haspopup="dialog"/);
  });

  test('renders the required operational fields and reverse direction', () => {
    const renderer = functionBody(admin, 'renderTransportRoutesWorkspace');
    [
      'Day',
      'Night',
      'included_passengers',
      'max_passengers',
      'included_bags',
      'included_large_bags',
      'max_bags',
      'currency',
      'sort_order',
      'Pricing rules',
      'Reverse exists',
      'No reverse route',
      'Active',
      'Inactive',
    ].forEach((value) => expect(renderer).toContain(value));
    expect(renderer).toContain('getTransportRouteWorkspaceReverse(route)');
    expect(renderer).toContain('getTransportRouteWorkspacePricingRuleCount(id)');
  });

  test('filters only existing state, including currency and city group', () => {
    const filter = functionBody(admin, 'getTransportAdminV2FilteredRoutes');
    expect(filter).toContain('transportAdminState.routes');
    expect(filter).toContain('transportAdminV2RoutesCurrency');
    expect(filter).toContain('transportAdminV2RoutesCityGroup');
    expect(filter).toContain('origin?.city_group');
    expect(filter).toContain('destination?.city_group');
    expect(filter).not.toMatch(/queryTransportTable|runTransportMutation|ensureSupabase|\.from\s*\(|\brpc\s*\(|\bfetch\s*\(/);
  });

  test('workspace shortcuts perform no loads or requests', () => {
    [
      'selectTransportRouteWorkspaceContext',
      'openTransportRouteWorkspacePricing',
      'openTransportRouteWorkspaceQuoteTester',
      'openTransportRouteWorkspaceBookings',
      'clearTransportAdminV2RouteFilters',
    ].forEach((name) => {
      const helper = functionBody(admin, name);
      expect(helper).not.toMatch(/loadTransport|queryTransportTable|runTransportMutation|ensureSupabase|\.from\s*\(|\brpc\s*\(|\bfetch\s*\(/);
    });
  });

  test('actions reuse Legacy edit and delete while wizard actions remain placeholders', () => {
    const action = functionBody(admin, 'handleTransportRouteWorkspaceAction');
    expect(action).toContain('editTransportRoute(id)');
    expect(action).toContain('deleteTransportRoute(id)');
    expect(action).toContain("action === 'duplicate' || action === 'create-reverse'");
    expect(action).toContain("showTransportRouteWorkspaceNotice('Available in Route Wizard')");
    expect(action).not.toMatch(/insert|upsert|update\s*\(|buildTransport.*Payload|executeTransportSavePlan/);
  });

  test('keeps the accepted Legacy renderer and save handlers byte-identical', () => {
    expect(sha256(functionBody(admin, 'renderTransportRoutesTable'))).toBe(
      '5ff2c752a85d9fbd86b43862733f871ac680c92c235e967d39049614e35360bd',
    );
    expect(sha256(functionBody(admin, 'saveTransportRouteForm'))).toBe(
      'dd66a97394b3b4cd84aa7c6057db6f3b30f9831c10784343526e6f9ef807e636',
    );
    expect(sha256(functionBody(admin, 'saveTransportPricingForm'))).toBe(
      '4bf629fb1900c86b3108b8af02c37a97271b0136fc9db2e13014455ea057a93b',
    );
  });

  test('mounts the unchanged Legacy route table only in Legacy tools', () => {
    expect(navigation).toContain(
      "moveElement(documentRef, 'transportRoutesList', 'transportAdminV2PanelLegacyTools')",
    );
    expect(navigation).not.toContain(
      "moveElement(documentRef, 'transportRoutesList', 'transportAdminV2PanelRoutes')",
    );
  });

  test('defines desktop, tablet, and single-column mobile layouts without horizontal scrolling', () => {
    expect(css).toContain('.transport-admin-v2-route-record');
    expect(css).toMatch(/@media \(max-width: 1080px\)[\s\S]*?\.transport-admin-v2-route-record\s*\{[\s\S]*?grid-template-columns: repeat\(2/);
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.transport-admin-v2-route-record\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  });
});
