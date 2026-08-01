import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const openParenthesis = source.indexOf('(', start);
  let parenthesisDepth = 0;
  let brace = -1;
  for (let index = openParenthesis; index < source.length; index += 1) {
    if (source[index] === '(') parenthesisDepth += 1;
    if (source[index] === ')') {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        brace = source.indexOf('{', index);
        break;
      }
    }
  }
  expect(brace).toBeGreaterThanOrEqual(0);
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

describe('Transport Admin Stage 2B-2E pair pricing modal static guards', () => {
  const dashboard = read('admin/dashboard.html');
  const admin = read('admin/admin.js');
  const navigation = read('admin/transport-admin-navigation.js');
  const saveRepository = read('admin/transport-admin-repository.js');
  const core = read('admin/transport-pair-pricing-core.js');
  const modal = read('admin/transport-route-pricing-modal.js');
  const distDashboard = read('dist/admin/dashboard.html');
  const distCore = read('dist/admin/transport-pair-pricing-core.js');
  const distModal = read('dist/admin/transport-route-pricing-modal.js');

  test('mounts one accessible modal globally, after every hidden Transport panel', () => {
    const modalIndex = dashboard.indexOf('id="transportPairPricingModal"');
    expect(modalIndex).toBeGreaterThan(dashboard.lastIndexOf('</main>'));
    expect((dashboard.match(/id="transportPairPricingModal"/g) || [])).toHaveLength(1);
    expect(dashboard).toMatch(/id="transportPairPricingModal"[\s\S]{0,180}role="dialog"|role="dialog"[\s\S]{0,180}id="transportPairPricingModal"/);
    expect(dashboard).toContain('aria-modal="true"');
    expect(dashboard).toContain('aria-labelledby="transportPairPricingModalTitle"');
    expect(navigation).not.toContain('transportPairPricingModal');
    expect(modal).not.toMatch(/appendChild\s*\(/);
    expect(distDashboard.indexOf('id="transportPairPricingModal"')).toBeGreaterThan(
      distDashboard.lastIndexOf('</main>'),
    );
  });

  test('loads the read-only controller before the Admin module', () => {
    const repositoryIndex = dashboard.indexOf('/admin/transport-admin-repository.js');
    const coreIndex = dashboard.indexOf('/admin/transport-pair-pricing-core.js');
    const modalIndex = dashboard.indexOf('/admin/transport-route-pricing-modal.js');
    const adminIndex = dashboard.indexOf('/admin/admin.js');
    expect(repositoryIndex).toBeGreaterThanOrEqual(0);
    expect(coreIndex).toBeGreaterThan(repositoryIndex);
    expect(modalIndex).toBeGreaterThan(coreIndex);
    expect(adminIndex).toBeGreaterThan(modalIndex);
  });

  test('Routes Pricing opens the new modal and never auto-selects the legacy first rule', () => {
    const opener = functionBody(admin, 'openTransportRouteWorkspacePricing');
    expect(opener).toContain('TransportPairPricingModal.open(id, { returnFocus })');
    expect(opener).not.toMatch(/getTransportSelectedRuleForControl|editTransportPricingRule|activate\(['"]advancedPricing/);

    const action = functionBody(admin, 'handleTransportRouteWorkspaceAction');
    expect(action).toContain('openTransportRouteWorkspacePricing(id, returnFocus)');
  });

  test('read adapter exposes only fresh select operations and has no UI or state side effects', () => {
    const repository = functionBody(modal, 'createReadRepository');
    [
      'getRouteById',
      'findReverseRoute',
      'listPricingRulesByRouteIds',
      'listDepositOverridesByRouteIds',
      'getTransportDepositDefault',
    ].forEach((name) => expect(repository).toContain(name));
    expect(repository).toContain(".eq('origin_location_id', destinationId)");
    expect(repository).toContain(".eq('destination_location_id', originId)");
    expect(repository).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/);
    expect(repository).not.toMatch(/\bdocument\b|showToast|transportAdminState/);
  });

  test('pair modules cannot call persistence directly or invoke legacy, bulk, global, mirror, email, or notification handlers', () => {
    [core, modal, distCore, distModal].forEach((source) => {
      expect(source).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/);
      expect(source).not.toMatch(
        /(?:applyTransportRouteGlobalCapacityUpdate|applyTransportPricingGlobalDepositUpdate|applyTransportPricingGlobalLuggageUpdate|applyTransportPricingCityBulkUpdate|syncTransportPricingDepositsFromPartnerDefaults|syncTransportDepositOverridesForRoutes)\s*\(/,
      );
      expect(source).not.toMatch(
        /saveTransportRouteForm|saveTransportPricingForm|mirrorTransport|cloneTransportPricing|sendEmail\s*\(|sendNotification\s*\(|dispatchEmail\s*\(/,
      );
    });
  });

  test('pure Stage 2C core has no DOM, Supabase, state, or toast dependency', () => {
    expect(core).not.toMatch(/\bdocument\b|querySelector|getElementById|HTMLElement|supabase|showToast|transportAdminState/);
    expect(core).not.toContain('new Date(');
    expect(core).toContain('function createTransportPairPricingDraft(');
    expect(core).toContain('function validateTransportPairPricingDraft(');
    expect(core).toContain('function buildTransportPairPricingDiff(');
    expect(core).toContain('function buildTransportPairPricingReviewPlan(');
    expect(core).toContain('function preflightTransportPairPricingReview(');
    expect(core).toContain('function buildTransportPairPricingSavePlan(');
    expect(core).toContain('const globalChanges = 0;');
  });

  test('Stage 2D Save is guarded by current Review and a custom accessible confirmation dialog', () => {
    expect(dashboard).toMatch(
      /id="transportPairPricingSaveChanges"[^>]*disabled[^>]*hidden[^>]*>Save changes<\/button>/,
    );
    expect(dashboard).toContain('id="transportPairPricingSaveConfirmDialog"');
    expect(dashboard).toContain('role="alertdialog"');
    expect(modal).toContain("draftCore.isTransportPairPricingReviewCurrent(state.draft, plan?.fingerprint)");
    expect(modal).toContain("addEventListener?.('click', openSaveConfirmation)");
    expect(modal).toContain('saveCore.executeTransportSavePlan(');
    expect(modal).not.toMatch(/\bconfirm\s*\(/);
  });

  test('Stage 2E Retry and recovery dialogs are explicit, accessible, and share one execution Promise', () => {
    expect(dashboard).toMatch(
      /id="transportPairPricingRetryFailed"[^>]*disabled[^>]*hidden[^>]*>Retry failed steps<\/button>/,
    );
    expect(dashboard).toContain('id="transportPairPricingRecoveryDialog"');
    expect(dashboard).toContain('aria-labelledby="transportPairPricingRecoveryTitle"');
    expect(dashboard).toContain('aria-describedby="transportPairPricingRecoveryMessage"');
    expect(modal).toContain('function retryFailedSteps()');
    expect(modal).toContain('if (executionPromise) return executionPromise;');
    expect(modal).toContain('precheckTransportPairPricingRetry(');
    expect(modal).toContain('retry: true');
    expect(modal).toContain('Some changes were saved. Retry will only attempt the failed steps.');
    expect(modal).toContain('Successful steps will not be repeated.');
    expect(modal).toContain('Global changes: 0');
    expect(modal).toContain('Bookings changed: 0');
  });

  test('Stage 2E retry core uses exact IDs, preserves success, and has no rollback or fallback selection', () => {
    const retry = functionBody(core, 'precheckTransportPairPricingRetry');
    expect(retry).toContain("step.status === 'success'");
    expect(retry).toContain("step.status === 'error'");
    expect(retry).toContain("step.skipReason === 'dependency'");
    expect(retry).toContain('retryRecordForStep');
    expect(retry).toContain('stale_after_partial');
    expect(core).toContain('normalizeId(step.entityId)');
    expect(core).not.toMatch(/first active|pricingRules\s*\[\s*0\s*\]/i);
    expect(modal).not.toMatch(/\b(?:rollback|compensate|undoSavedSteps)\s*\(/i);
    expect(modal).not.toMatch(/console\.(?:log|debug|info)\s*\(/);
  });

  test('Stage 2E binds modal listeners only inside the guarded initialize path', () => {
    const initialize = functionBody(modal, 'initialize');
    expect(initialize).toContain('if (initialized) return api;');
    expect(initialize).toContain("'transportPairPricingRetryFailed'");
    expect(initialize).toContain("'transportPairPricingRecoveryStay'");
    expect(initialize).toContain("'transportPairPricingRecoveryConfirm'");
    expect(modal.match(/addEventListener\?\.\('click', \(\) => void retryFailedSteps\(\)\)/g)).toHaveLength(1);
  });

  test('pair save plan forbids route/pricing inserts and repository uses exact optimistic filters', () => {
    const builder = functionBody(core, 'buildTransportPairPricingSavePlan');
    expect(builder).toContain('transport_pair_route_insert_forbidden');
    expect(builder).toContain('transport_pair_pricing_insert_forbidden');
    expect(builder).toContain("action: 'update'");
    expect(builder).toContain('expectedUpdatedAt');
    expect(builder).toContain('globalChanges');
    expect(builder).not.toMatch(/type:\s*['"]pricing_rule['"][\s\S]{0,100}action:\s*['"]insert['"]/);
    expect(saveRepository).toContain(".eq('updated_at', expectedUpdatedAt)");
    expect(saveRepository).toContain(".eq('id', id)");
    expect(saveRepository).toContain('transport_pair_stale_conflict');
  });

  test('exact Advanced navigation passes only the explicitly selected route and rule IDs', () => {
    const advanced = functionBody(admin, 'openTransportAdvancedPricingExact');
    expect(advanced).toContain("String(context?.routeId || '').trim()");
    expect(advanced).toContain("String(context?.ruleId || '').trim()");
    expect(advanced).toContain("String(rule?.id || '').trim() === ruleId");
    expect(advanced).toContain("String(rule?.route_id || '').trim() === routeId");
    expect(advanced).not.toMatch(/getTransportSelectedRuleForControl|pricingRules\s*\[\s*0\s*\]/);
  });

  test('keeps protected public transport flow files byte-identical', () => {
    expect(sha256(read('transport.html'))).toBe(
      '7df7fd271f07df066b9d0656ded8dea5da643bba28be82ae7424fa0622c782b2',
    );
    expect(sha256(read('js/transport-booking.js'))).toBe(
      'd9a7ea64af0defe4f305b4c8e0b60ef9dc442e0f1914a2710b8c452e0adc11c5',
    );
    expect(sha256(read('functions/transport/booking/index.js'))).toBe(
      '21a63f1ef9f64ad05bb6b8cb46bd3a5a3a09f5a3ab39848b62cc74f9a2db9e90',
    );
  });
});
