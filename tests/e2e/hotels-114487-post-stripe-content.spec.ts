import fs from 'node:fs';
import {test, expect, Page} from '@playwright/test';

// Every request is either a synthetic loopback document or aborted. No live SDK.
test.use({serviceWorkers: 'block'});
const hotel = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const partner = '0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
const assignment = 'a082c085-a6ea-46fd-8548-c8d9c6ee2c34';
const otherPartner = '87000000-0000-4000-8000-000000000099';

async function setup(page: Page, options: {empty?: boolean; invalidAssignment?: boolean; platformMismatch?: boolean; setFails?: boolean; permissionNull?: boolean; auditInvalid?: boolean} = {}) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' && url.pathname === '/114487-ui-test'
      ? route.fulfill({contentType: 'text/html', body: '<main id="test"></main>'}) : route.abort();
  });
  await page.goto('/114487-ui-test');
  for (const file of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js', 'admin/hotels-v2-workspace.js']) {
    let code = fs.readFileSync(file, 'utf8');
    if (file.endsWith('/hotels-v2-workspace.js')) {
      code = code.replace('  function renderPartnerPanel(panel) {', '  root.__114487RenderPartner = renderPartnerPanel;\n  function renderPartnerPanel(panel) {');
    }
    await page.addScriptTag({content: code});
  }
  await page.evaluate(async ({hotel, partner, assignment, otherPartner, options}) => {
    const w = window as any, Core = w.HotelsV2WorkspaceCore;
    const flags = {hotel_rooms_v2_enabled: true, hotel_external_sync_enabled: true, hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: true};
    const property = {id: hotel, updated_at: '2026-09-12T00:00:00Z', architecture_version: 'legacy', status: 'active', is_published: false};
    const entry = {assignment_id: assignment, hotel_id: hotel, partner_id: partner, assignment_active: true,
      partner: {id: partner, name: 'Synthetic operational Partner', status: 'active', can_manage_hotels: true},
      permission: {exists: true, version: 2, updated_at: '2026-09-12T00:00:00Z', has_mutation_capability: true,
        capabilities: Object.fromEntries(Core.HOTEL_PARTNER_CAPABILITIES.map((key: string) => [key, true]))},
      staff_scope_count: 0, staff_scope_ids: [], permission_exists: true, permission_will_cascade_on_remove: true};
    const snapshot = {contract_version: 'hotels_v2_h3_2a_partner_permissions_v1', property, feature_flags: {...flags},
      capability_catalog: [...Core.HOTEL_PARTNER_CAPABILITIES], snapshot_token: 'a'.repeat(32),
      assignment_fingerprint: 'b'.repeat(32), permissions_fingerprint: 'c'.repeat(32), assignments: options.empty ? [] : [entry]};
    const content = {contract_version: 'hotels_v2_admin_b_content_control_v1', hotel_id: hotel, property_updated_at: property.updated_at,
      architecture_version: 'legacy', feature_flags: {...flags}, commercial_owner: null,
      operational_profile: {exists: false, version: 0, updated_at: null, maximum_stay_nights: null,
        guest_instructions_i18n: {}, check_in_instructions_i18n: {}, check_out_instructions_i18n: {}, internal_operational_notes: null},
      assignment_snapshot: snapshot};
    if (options.invalidAssignment) snapshot.assignments[0].hotel_id = otherPartner;
    const mapping: any = {rooms: 'hotel_rooms_v2_enabled', external: 'hotel_external_sync_enabled', stripe: 'hotel_stripe_connect_enabled', instant: 'hotel_instant_booking_enabled', public_booking: null};
    const lifecycle = {contract_version: 'hotels_v2_capability_lifecycle_v1', version: 6, feature_flags: {...flags},
      public_booking_enabled: false, architecture: 'legacy', expected_public_change: false, audit_chain_exact: true,
      capabilities: Object.keys(mapping).map(key => ({key, enabled: mapping[key] ? (flags as any)[mapping[key]] : false,
        requires_confirmation: true, blocked_reasons: ['external', 'instant', 'public_booking'].includes(key) ? ['separate_contract_required'] : []}))};
    w.__calls = [];
    w.getSupabase = () => ({rpc: async (name: string, args: any) => {
      w.__calls.push({name, args});
      if (name === 'hotel_v2_admin_get_content_control_114487') return {data: content, error: null};
      if (name === 'hotel_v2_admin_get_partner_hotel_permissions') return {data: options.permissionNull ? null : snapshot, error: null};
      if (name === 'hotel_v2_admin_get_capability_lifecycle') return {data: lifecycle, error: null};
      if (name === 'hotel_v2_admin_get_partner_stripe_onboarding_authorization') return {data: {
        contract_version: 'hotels_v2_partner_stripe_authorization_control_v1', partner_id: partner, version: 0,
        enabled: false, platform_enabled: !options.platformMismatch, account_exists: false, account_status: 'NOT_CONNECTED'}, error: null};
      if (name === 'hotel_v2_admin_set_partner_stripe_onboarding_authorization') {
        if (options.setFails) throw Error('Synthetic response lost; must not retry');
        return {data: {contract_version: 'hotels_v2_partner_stripe_authorization_result_v1', partner_id: partner,
          version: 1, current_version: 1, enabled: true, current_enabled: true, replayed: false}, error: null};
      }
      throw Error('UNAPPROVED_RPC:' + name);
    }});
    const api = w.HotelsV2Workspace, repo = w.HotelsV2WorkspaceRepository;
    api.state.workspace = {property: {...property, owner_partner: {id: otherPartner, name: 'Never an assignment fallback'}}, partners: []};
    try { api.state.contentControl = await repo.getContentControl(hotel); }
    catch (error) { api.state.contentControlError = error; }
    try { api.state.partnerPermissions = await repo.getPartnerHotelPermissions(hotel); }
    catch (error) { api.state.partnerPermissionsError = error; }
    api.state.capabilityLifecycle = await repo.getCapabilityLifecycle();
    if (options.auditInvalid) api.state.capabilityLifecycle.audit_chain_exact = false;
    w.__114487RenderPartner(document.getElementById('test'));
  }, {hotel, partner, assignment, otherPartner, options});
}

for (const permissionNull of [false, true]) test(`114487 verified assignment survives legacy permissions ${permissionNull ? 'null' : 'Stripe-ON rejection'}`, async ({page}) => {
  await setup(page, {permissionNull});
  await expect(page.locator('[data-partner-permissions-locked]')).toContainText('Existing permissions remain unchanged');
  await expect(page.locator('[data-edit-partner-permission]')).toHaveCount(0);
  await expect(page.locator('[data-retry-partner-permissions]')).toHaveCount(0);
  await expect(page.locator(`[data-stripe-partner="${partner}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-stripe-partner="${otherPartner}"]`)).toHaveCount(0);
  await expect(page.locator('[data-stripe-authorization]')).not.toContainText('No verified Partner assignment');
  await page.getByRole('button', {name: 'Load current Stripe authorization'}).click();
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('NOT AUTHORIZED');
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('NOT_CONNECTED');
  const calls = await page.evaluate(() => (window as any).__calls);
  expect(calls.map((c: any) => c.name)).toEqual([
    'hotel_v2_admin_get_content_control_114487', 'hotel_v2_admin_get_partner_hotel_permissions', 'hotel_v2_admin_get_capability_lifecycle',
    'hotel_v2_admin_get_partner_stripe_onboarding_authorization', 'hotel_v2_admin_get_capability_lifecycle']);
  expect(calls[3].args.p_partner_id).toBe(partner);
  expect(calls.filter((c: any) => /_(apply|set|preview|submit)_/.test(c.name))).toEqual([]);
});

for (const options of [{empty: true}, {invalidAssignment: true}]) test(`114487 no unverified assignment fallback ${JSON.stringify(options)}`, async ({page}) => {
  await setup(page, options);
  await expect(page.locator('[data-stripe-partner]')).toHaveCount(0);
  await expect(page.locator('[data-stripe-authorization]')).toContainText('No verified Partner assignment');
  await expect(page.locator('[data-edit-partner-permission]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.some((c: any) => /_(apply|set|preview|submit)_/.test(c.name)))).toBe(false);
});

test('114487 missing audit evidence does not disguise a permissions error as an intentional lock', async ({page}) => {
  await setup(page, {auditInvalid: true});
  await expect(page.locator('[data-partner-permissions-locked]')).toHaveCount(0);
  await expect(page.locator('#test')).toContainText('Secure permission snapshot unavailable');
  await expect(page.locator('[data-edit-partner-permission]')).toHaveCount(0);
});

test('114487 separate Stripe authorization refuses platform/lifecycle disagreement', async ({page}) => {
  await setup(page, {platformMismatch: true});
  await page.getByRole('button', {name: 'Load current Stripe authorization'}).click();
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('unavailable or inconsistent');
  await expect(page.locator('[data-stripe-authorization-decision]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.some((c: any) => /_(apply|set)_/.test(c.name)))).toBe(false);
});

test('114487 separate explicit synthetic Stripe decision sends one Set and never retries a lost response', async ({page}) => {
  await setup(page, {setFails: true});
  await page.getByRole('button', {name: 'Load current Stripe authorization'}).click();
  await page.locator('textarea[name="reason"]').fill('Explicit local isolated authorization regression');
  expect(await page.evaluate(() => (window as any).__calls.some((c: any) => c.name.includes('_set_')))).toBe(false);
  await page.locator('input[name="confirmation"]').check();
  await page.getByRole('button', {name: 'Confirm authorization', exact: true}).click();
  await expect(page.locator('[data-stripe-authorization-state]')).toContainText('Do not retry');
  await expect(page.locator('[data-stripe-authorization-decision]')).toHaveCount(0);
  const calls = await page.evaluate(() => (window as any).__calls);
  expect(calls.filter((c: any) => c.name === 'hotel_v2_admin_set_partner_stripe_onboarding_authorization')).toHaveLength(1);
  expect(calls.at(-1).args).toMatchObject({p_partner_id: partner, p_expected_version: 0, p_enabled: true});
  expect(calls.some((c: any) => c.name === 'hotel_v2_admin_apply_partner_hotel_permissions')).toBe(false);
});
