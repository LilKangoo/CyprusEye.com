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

describe('Transport Admin Stage 1E architecture guards', () => {
  const core = read('admin/transport-admin-core.js');
  const repository = read('admin/transport-admin-repository.js');
  const wizard = read('admin/transport-route-wizard.js');
  const admin = read('admin/admin.js');
  const dashboard = read('admin/dashboard.html');

  test('executor remains persistence- and DOM-independent', () => {
    const executor = functionBody(core, 'executeTransportSavePlan');
    expect(executor).toContain('repository[step.action]');
    expect(executor).toContain('resolveStepPayload');
    expect(executor).not.toMatch(/document|querySelector|getElementById|showToast|\.from\s*\(|transport_routes|transport_pricing_rules|service_deposit_overrides/i);
  });

  test('repository is injected, Wizard-independent, and exposes only persistence actions', () => {
    expect(repository).toContain('const runMutation = options.runMutation');
    expect(repository).not.toMatch(/TransportRouteWizard|transportRouteWizard|document|querySelector|getElementById|showToast/i);
    const returnedApi = repository.slice(repository.indexOf('return Object.freeze({'), repository.indexOf("Object.defineProperty(root, 'TransportAdminRepository'"));
    ['delete: remove', 'insert', 'reuse', 'update', 'upsert'].forEach((name) => expect(returnedApi).toContain(name));
    expect(returnedApi).not.toMatch(/wizard|render|toast/i);
  });

  test('dashboard loads repository between core/navigation and Wizard/admin', () => {
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

  test('Legacy bridge is removed and Wizard delegates one execution path', () => {
    expect(admin).not.toMatch(/saveTransportRouteWizardWithLegacy|captureTransportLegacyFormState|restoreTransportLegacyFormState|populateTransportLegacy/);
    expect(wizard).toContain('options.onExecute');
    expect(wizard).not.toMatch(/options\.onSave\b|saveTransportRouteForm|saveTransportPricingForm|runTransportMutation|\.from\s*\(/);
    const binding = admin.slice(admin.indexOf('TransportRouteWizard.initialize({'), admin.indexOf("if (document.body?.dataset?.ceTransportAdminBound"));
    expect(binding).toContain('onExecute: (plan, options) => executeTransportRouteWizardPlan(plan, options)');
    expect(binding).not.toMatch(/saveTransportRouteForm|saveTransportPricingForm/);
  });

  test('Legacy editor can update existing routes but cannot create a blank route', () => {
    expect(dashboard).toContain('id="btnSaveTransportRoute" aria-describedby="transportLegacyRouteEditNotice" disabled');
    expect(admin).toContain('function syncTransportLegacyRouteEditState()');
    const binding = admin.slice(
      admin.indexOf("const routeForm = document.getElementById('transportRouteForm')"),
      admin.indexOf("const routeTripMode = document.getElementById('transportRouteTripMode')"),
    );
    expect(binding).toContain('if (!routeId)');
    expect(binding).toContain("showToast('Create new routes from Routes using Add route.', 'info')");
    expect(binding).toContain('void saveTransportRouteForm(event)');
  });

  test('receipt and partial retry controls exist exactly once', () => {
    [
      'transportRouteWizardReceipt',
      'transportRouteWizardReceiptSummary',
      'btnTransportRouteWizardRetry',
      'btnTransportRouteWizardCreateAnother',
      'btnTransportRouteWizardOpenCreated',
      'btnTransportRouteWizardReceiptClose',
    ].forEach((id) => expect((dashboard.match(new RegExp(`id="${id}"`, 'g')) || [])).toHaveLength(1));
    expect(core).toContain("step.status === 'error' || isDependencyRetryStep(step)");
  });

  test('accepted Legacy handlers remain byte-identical', () => {
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
});
