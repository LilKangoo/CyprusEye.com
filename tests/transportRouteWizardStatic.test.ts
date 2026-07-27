import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const brace = source.indexOf('{', source.indexOf(')', start));
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

describe('Transport Admin Stage 1E route wizard guards', () => {
  const dashboard = read('admin/dashboard.html');
  const admin = read('admin/admin.js');
  const wizard = read('admin/transport-route-wizard.js');
  const css = read('admin/admin.css');

  test('loads the wizard before admin.js and exposes one modal', () => {
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
    expect((dashboard.match(/id="transportRouteWizardModal"/g) || [])).toHaveLength(1);
  });

  test('contains all five progress steps and required controls once', () => {
    for (let step = 1; step <= 5; step += 1) {
      expect((dashboard.match(new RegExp(`data-transport-route-wizard-step="${step}"`, 'g')) || [])).toHaveLength(1);
      expect((dashboard.match(new RegExp(`data-transport-route-wizard-progress="${step}"`, 'g')) || [])).toHaveLength(1);
    }
    [
      'transportRouteWizardOrigin',
      'transportRouteWizardDestination',
      'transportRouteWizardActive',
      'transportRouteWizardSortOrder',
      'transportRouteWizardDirectionOutbound',
      'transportRouteWizardDirectionBidirectional',
      'transportRouteWizardExistingReverseReuse',
      'transportRouteWizardExistingReverseUpdate',
      'transportRouteWizardAllowsRoundTrip',
      'transportRouteWizardRoundTripMultiplier',
      'transportRouteWizardDayPrice',
      'transportRouteWizardNightPrice',
      'transportRouteWizardCurrency',
      'transportRouteWizardReverseDayPrice',
      'transportRouteWizardReverseNightPrice',
      'transportRouteWizardPricingEnabled',
      'transportRouteWizardIncludedPassengers',
      'transportRouteWizardIncludedBags',
      'transportRouteWizardIncludedLargeBags',
      'transportRouteWizardMaxPassengers',
      'transportRouteWizardMaxBags',
      'transportRouteWizardReview',
      'transportRouteWizardReceipt',
      'btnTransportRouteWizardBack',
      'btnTransportRouteWizardNext',
      'btnTransportRouteWizardRetry',
      'btnTransportRouteWizardSave',
      'btnTransportRouteWizardCreateAnother',
      'btnTransportRouteWizardOpenCreated',
      'btnTransportRouteWizardReceiptClose',
    ].forEach((id) => expect((dashboard.match(new RegExp(`id="${id}"`, 'g')) || [])).toHaveLength(1));
  });

  test('wizard module is local-only and never accesses persistence', () => {
    expect(wizard).not.toMatch(/supabase|queryTransportTable|runTransportMutation|ensureSupabase|\.from\s*\(|\brpc\s*\(|\bfetch\s*\(/i);
    expect(wizard).not.toMatch(/showToast|admin\/admin\.js|executeTransportSavePlan/);
    expect(wizard).toContain("{ profile: 'wizard' }");
    expect(wizard).toContain('core.validateTransportRouteDraft');
    expect(wizard).toContain('core.buildTransportSavePlan');
    expect(wizard).toContain('documentRef.body.append(modal)');
    expect(wizard).toContain("Object.defineProperty(root, 'TransportRouteWizard'");
  });

  test('review uses the Stage 1A save plan and displays exact scope', () => {
    const review = functionBody(wizard, 'renderReview');
    const preview = functionBody(wizard, 'previewPlan');
    const status = functionBody(wizard, 'stepStatusMarkup');
    expect(preview).toContain('core.buildTransportSavePlan');
    expect(review).toContain("step.type === 'transport_route'");
    expect(review).toContain("step.type === 'pricing_rule'");
    expect(review).toContain("step.type === 'deposit_override'");
    expect(review).toContain('No global settings will change.');
    expect(status).toContain('data-transport-route-wizard-status');
    expect(review).not.toMatch(/onSave|executeTransportSavePlan/);
  });

  test('Save uses the executor and repository without the Legacy form bridge', () => {
    const execution = functionBody(admin, 'executeTransportRouteWizardPlan');
    const repository = functionBody(admin, 'getTransportSaveRepository');
    expect(execution).toContain('TransportAdminCore.executeTransportSavePlan');
    expect(execution).toContain('getTransportSaveRepository()');
    expect(execution).toContain('await loadTransportAdminData()');
    expect(repository).toContain('TransportAdminRepository.create');
    expect(repository).toContain('runMutation: runTransportMutation');
    expect(admin).not.toMatch(/saveTransportRouteWizardWithLegacy|captureTransportLegacyFormState|restoreTransportLegacyFormState|populateTransportLegacyRouteForm|populateTransportLegacyPricingForm/);
  });

  test('accepted renderer and Legacy save handlers remain byte-identical', () => {
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

  test('Add route opens the wizard and does not call a loader', () => {
    expect(admin).toContain('TransportRouteWizard.initialize({');
    expect(admin).toContain('TransportRouteWizard.open();');
    const binding = admin.slice(
      admin.indexOf("const btnAddRoute = document.getElementById('btnTransportAdminV2AddRoute')"),
      admin.indexOf("const routeWorkspace = document.getElementById('transportAdminV2RoutesWorkspace')"),
    );
    expect(binding).not.toMatch(/loadTransport|saveTransport|queryTransport|runTransportMutation/);
  });

  test('defines a wide desktop dialog and a full-screen mobile dialog', () => {
    expect(css).toMatch(/\.transport-route-wizard__dialog\s*\{[\s\S]*?width: min\(1120px/);
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.transport-route-wizard__dialog\s*\{[\s\S]*?width: 100vw;[\s\S]*?height: 100dvh/);
  });
});
