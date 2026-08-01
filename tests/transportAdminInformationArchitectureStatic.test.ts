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

function htmlElementRangeById(source: string, id: string): { start: number; end: number; html: string } {
  const idIndex = source.indexOf(`id="${id}"`);
  if (idIndex < 0) throw new Error(`Missing HTML element #${id}`);

  const start = source.lastIndexOf('<', idIndex);
  const openingTag = source.slice(start).match(/^<([A-Za-z][A-Za-z0-9:-]*)\b[^>]*>/);
  if (!openingTag) throw new Error(`Could not parse opening tag for #${id}`);

  const tagName = openingTag[1];
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(source))) {
    const token = match[0];
    if (token.startsWith('</')) {
      depth -= 1;
    } else if (!/\/\s*>$/.test(token)) {
      depth += 1;
    }

    if (depth === 0) {
      const end = tagPattern.lastIndex;
      return { start, end, html: source.slice(start, end) };
    }
  }

  throw new Error(`Could not find closing tag for #${id}`);
}

describe('Transport Admin Stage 1B information architecture guards', () => {
  const dashboard = read('admin/dashboard.html');
  const navigation = read('admin/transport-admin-navigation.js');
  const admin = read('admin/admin.js');

  const tabs = [
    ['transportAdminV2TabRoutes', 'transportAdminV2PanelRoutes'],
    ['transportAdminV2TabLocations', 'transportAdminV2PanelLocations'],
    ['transportAdminV2TabAdvancedPricing', 'transportAdminV2PanelAdvancedPricing'],
    ['transportAdminV2TabQuoteTester', 'transportAdminV2PanelQuoteTester'],
    ['transportAdminV2TabGlobalSettings', 'transportAdminV2PanelGlobalSettings'],
    ['transportAdminV2TabBookings', 'transportAdminV2PanelBookings'],
    ['transportAdminV2TabLegacyTools', 'transportAdminV2PanelLegacyTools'],
  ];

  test('every dashboard id occurs exactly once', () => {
    const ids = Array.from(dashboard.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
    const counts = ids.reduce<Record<string, number>>((result, id) => {
      result[id] = (result[id] || 0) + 1;
      return result;
    }, {});
    const duplicates = Object.entries(counts).filter(([, count]) => count !== 1);
    expect(duplicates).toEqual([]);
  });

  test('all tabs and panels have the required ARIA relationships', () => {
    expect(dashboard).toMatch(/id="transportAdminV2Tablist"[\s\S]*?role="tablist"/);
    tabs.forEach(([tabId, panelId]) => {
      expect(dashboard).toContain(`id="${tabId}"`);
      expect(dashboard).toMatch(new RegExp(`id="${tabId}"[\\s\\S]{0,240}role="tab"[\\s\\S]{0,240}aria-controls="${panelId}"`));
      expect(dashboard).toMatch(new RegExp(`id="${panelId}"[\\s\\S]{0,180}role="tabpanel"[\\s\\S]{0,180}aria-labelledby="${tabId}"`));
    });
  });

  test('Routes is the sole default panel and Add route opens the controlled wizard', () => {
    expect(dashboard).toMatch(/id="transportAdminV2TabRoutes"[\s\S]{0,220}aria-selected="true"/);
    expect(dashboard).toMatch(/id="btnTransportAdminV2AddRoute"[\s\S]{0,180}type="button"[\s\S]{0,180}aria-haspopup="dialog"/);
    expect(dashboard).toContain('aria-controls="transportRouteWizardModal"');
    expect(navigation).toContain("const DEFAULT_TAB = 'routes'");
  });

  test('Legacy ids remain singular and are mounted rather than cloned', () => {
    [
      'transportLocationForm',
      'transportLocationsTableBody',
      'transportRouteForm',
      'transportRoutesTableBody',
      'transportPricingForm',
      'transportPricingTableBody',
      'transportPreviewMatrixTable',
      'transportBookingsTableBody',
      'transportGuidedPanel',
    ].forEach((id) => {
      expect((dashboard.match(new RegExp(`id="${id}"`, 'g')) || [])).toHaveLength(1);
    });
    expect(navigation).not.toMatch(/cloneNode|innerHTML\s*=/);
    expect(navigation).toContain("moveChildren(documentRef, 'transportTabLocations', 'transportAdminV2PanelLocations')");
    expect(navigation).toContain("moveElement(documentRef, 'transportLegacyRouteEditor', 'transportAdminV2PanelLegacyTools')");
    expect(navigation).toContain("moveElement(documentRef, 'transportRoutesList', 'transportAdminV2PanelLegacyTools')");
    expect(navigation).toContain("moveElement(documentRef, 'transportPricingEditor', 'transportAdminV2PanelAdvancedPricing')");
    expect(navigation).toContain("moveElement(documentRef, 'transportLegacyControlCenter', 'transportAdminV2PanelQuoteTester')");
    expect(navigation).toContain("moveChildren(documentRef, 'transportTabBookings', 'transportAdminV2PanelBookings')");
  });

  test('transport booking details modal remains global and outside hidden Transport containers', () => {
    expect(navigation).not.toMatch(/moveElement\([^)]*transportBookingDetailsModal/);

    const modal = htmlElementRangeById(dashboard, 'transportBookingDetailsModal');
    const transportView = htmlElementRangeById(dashboard, 'viewTransport');
    const bookingsPanel = htmlElementRangeById(dashboard, 'transportAdminV2PanelBookings');

    expect(transportView.html).not.toContain('id="transportBookingDetailsModal"');
    expect(bookingsPanel.html).not.toContain('id="transportBookingDetailsModal"');
    expect(modal.start).toBeGreaterThanOrEqual(transportView.end);
  });

  test('advanced and global tools have one explicit destination', () => {
    [
      'transportAdvancedPricingMatrix',
      'transportPricingGlobalLuggagePanel',
      'transportPricingDepositGlobalControls',
      'transportRouteGlobalCapacityPanel',
      'transportRouteSetBuilderPanel',
      'transportRouteCityBulkPanel',
      'transportPricingCityBulkPanel',
    ].forEach((id) => expect((dashboard.match(new RegExp(`id="${id}"`, 'g')) || [])).toHaveLength(1));
    expect(navigation).toContain("moveElement(documentRef, 'transportAdvancedPricingMatrix', 'transportAdminV2PanelAdvancedPricing')");
    expect(navigation).toContain("moveElement(documentRef, 'transportRouteGlobalCapacityPanel', globalPanelId");
    expect(navigation).toContain("moveElement(documentRef, 'transportPricingGlobalLuggagePanel', globalPanelId");
    expect(navigation).toContain("moveElement(documentRef, 'transportPricingDepositGlobalControls', globalPanelId");
    expect(navigation).toContain("moveElement(documentRef, 'transportRouteCityBulkPanel', globalPanelId");
    expect(navigation).toContain("moveElement(documentRef, 'transportPricingCityBulkPanel', globalPanelId");
    expect(dashboard).toContain('Changes in this section may update multiple routes.');
  });

  test('navigation is DOM-only and loads before admin.js', () => {
    expect(navigation).not.toMatch(/supabase|\.from\s*\(|\brpc\s*\(|\bfetch\s*\(/i);
    expect(navigation).not.toMatch(/showToast|TransportAdminCore|buildTransport.*Payload/i);
    expect(navigation).toContain("Object.defineProperty(root, 'TransportAdminNavigation'");
    const coreIndex = dashboard.indexOf('/admin/transport-admin-core.js');
    const navigationIndex = dashboard.indexOf('/admin/transport-admin-navigation.js');
    const repositoryIndex = dashboard.indexOf('/admin/transport-admin-repository.js');
    const wizardIndex = dashboard.indexOf('/admin/transport-route-wizard.js');
    const adminIndex = dashboard.indexOf('/admin/admin.js');
    expect(coreIndex).toBeGreaterThanOrEqual(0);
    expect(navigationIndex).toBeGreaterThan(coreIndex);
    expect(repositoryIndex).toBeGreaterThan(navigationIndex);
    expect(wizardIndex).toBeGreaterThan(repositoryIndex);
    expect(adminIndex).toBeGreaterThan(wizardIndex);
  });

  test('admin initializes one navigation implementation and refresh does not switch panels', () => {
    expect(admin).toContain('TransportAdminNavigation.initialize({ document, storage: window.sessionStorage })');
    expect(admin).not.toContain("document.querySelectorAll('.transport-tab-button')");
    const refresh = functionSlice(admin, 'loadTransportAdminData');
    expect(refresh).not.toMatch(/TransportAdminNavigation\.activate|setTransportActiveTab/);
    expect(refresh).toContain('loadTransportLocationsData');
    expect(refresh).toContain('loadTransportRoutesData');
    expect(refresh).toContain('loadTransportPricingData');
    expect(refresh).toContain('loadTransportBookingsData');
  });

  test('route toolbar filters state through the existing and workspace renderers without a loader', () => {
    const filter = functionSlice(admin, 'getTransportAdminV2FilteredRoutes');
    const renderer = functionSlice(admin, 'renderTransportRoutesTable');
    expect(filter).toContain('transportAdminState.routes');
    expect(filter).not.toMatch(/queryTransportTable|ensureSupabase|runTransportMutation/);
    expect(renderer).toContain('getTransportAdminV2FilteredRoutes()');
    expect(admin).toContain("routeSearch.addEventListener('input', () => renderTransportRouteViews())");
  });

  test('Legacy save handlers still use Stage 1A builders', () => {
    const routeSave = functionSlice(admin, 'saveTransportRouteForm');
    const pricingSave = functionSlice(admin, 'saveTransportPricingForm');
    expect(routeSave).toContain('TransportAdminCore.buildTransportRoutePayload');
    expect(routeSave).toContain('TransportAdminCore.buildReverseRoutePayload');
    expect(pricingSave).toContain('TransportAdminCore.buildTransportPricingRulePayload');
  });
});
