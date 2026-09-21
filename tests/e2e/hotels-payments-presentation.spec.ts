import fs from 'node:fs';
import {test, expect, type Page} from '@playwright/test';

test.use({serviceWorkers: 'block'});
const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const PARTNER = '0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
const ASSIGNMENT = 'a082c085-a6ea-46fd-8548-c8d9c6ee2c34';
type Options = {stale?: boolean; capability?: boolean; authorized?: boolean; badAccount?: boolean; accountFieldsMissing?: boolean; platformMismatch?: boolean; noAssignment?: boolean; foreignAssignment?: boolean; missingLifecycle?: boolean; language?: 'en'|'pl'|'he'; mobile?: boolean};

async function setup(page: Page, options: Options = {}) {
  await page.setViewportSize(options.mobile ? {width: 390, height: 844} : {width: 1440, height: 1000});
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' && url.pathname === '/payments-ui-test'
      ? route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body data-admin-panel="true"><main id="test"></main></body></html>'})
      : route.abort();
  });
  await page.goto('/payments-ui-test');
  for (const file of ['assets/css/tokens.css', 'assets/css/base.css', 'admin/admin.css']) {
    await page.addStyleTag({content: fs.readFileSync(file, 'utf8')});
  }
  for (const file of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js', 'admin/hotels-v2-workspace.js']) {
    let code = fs.readFileSync(file, 'utf8');
    if (file.endsWith('/hotels-v2-workspace.js')) code = code.replace('  function renderPaymentsPanel(panel) {', '  root.__renderPayments = renderPaymentsPanel;\n  function renderPaymentsPanel(panel) {');
    await page.addScriptTag({content: code});
  }
  await page.evaluate(async ({hotel, partner, assignment, options}) => {
    const w = window as any, Core = w.HotelsV2WorkspaceCore;
    document.documentElement.lang = options.language || 'en';
    document.documentElement.dir = options.language === 'he' ? 'rtl' : 'ltr';
    const flags = {hotel_rooms_v2_enabled: true, hotel_external_sync_enabled: true, hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: options.capability !== false};
    const property = {id: hotel, updated_at: '2026-09-13T00:00:00Z', architecture_version: 'legacy', status: 'active', is_published: false};
    const entry = {assignment_id: assignment, hotel_id: options.foreignAssignment ? partner : hotel, partner_id: partner, assignment_active: true,
      partner: {id: partner, name: 'Synthetic Partner', status: 'active', can_manage_hotels: true},
      permission: {exists: true, version: 2, updated_at: property.updated_at, has_mutation_capability: false,
        capabilities: Object.fromEntries(Core.HOTEL_PARTNER_CAPABILITIES.map((key: string) => [key, false]))},
      staff_scope_count: 0, staff_scope_ids: [], permission_exists: true, permission_will_cascade_on_remove: true};
    const content = {contract_version: 'hotels_v2_admin_b_content_control_v1', hotel_id: hotel, property_updated_at: property.updated_at,
      architecture_version: 'legacy', feature_flags: {...flags}, commercial_owner: null,
      operational_profile: {exists: false, version: 0, updated_at: null, maximum_stay_nights: null,
        guest_instructions_i18n: {}, check_in_instructions_i18n: {}, check_out_instructions_i18n: {}, internal_operational_notes: null},
      assignment_snapshot: {contract_version: 'hotels_v2_h3_2a_partner_permissions_v1', property, feature_flags: {...flags},
        capability_catalog: [...Core.HOTEL_PARTNER_CAPABILITIES], snapshot_token: 'a'.repeat(32), assignment_fingerprint: 'b'.repeat(32), permissions_fingerprint: 'c'.repeat(32), assignments: options.noAssignment ? [] : [entry]}};
    const mapping: any = {rooms: 'hotel_rooms_v2_enabled', external: 'hotel_external_sync_enabled', stripe: 'hotel_stripe_connect_enabled', instant: 'hotel_instant_booking_enabled', public_booking: null};
    const lifecycle = {contract_version: 'hotels_v2_capability_lifecycle_v1', version: 6, feature_flags: {...flags},
      public_booking_enabled: false, architecture: 'legacy', expected_public_change: false, audit_chain_exact: true,
      capabilities: Object.keys(mapping).map(key => ({key, enabled: mapping[key] ? (flags as any)[mapping[key]] : false, requires_confirmation: true,
        blocked_reasons: ['external', 'instant', 'public_booking'].includes(key) ? ['separate_contract_required'] : key === 'stripe' && options.stale ? ['verified_server_configuration_required'] : []}))};
    const account = {contract_version: 'hotels_v2_partner_stripe_authorization_control_v1', partner_id: partner, version: 1,
      enabled: options.authorized !== false, platform_enabled: options.platformMismatch ? !flags.hotel_stripe_connect_enabled : flags.hotel_stripe_connect_enabled,
      ...options.accountFieldsMissing ? {} : {account_exists: false, account_status: options.badAccount ? 'CONNECTED' : 'NOT_CONNECTED'}};
    w.__calls = [];
    w.getSupabase = () => ({rpc: async (name: string, args: any) => {
      w.__calls.push({name, args});
      if (name === 'hotel_v2_admin_get_content_control_114490') return {data: content, error: null};
      if (name === 'hotel_v2_admin_get_capability_lifecycle_114490') return {data: lifecycle, error: null};
      if (name === 'hotel_v2_admin_get_partner_stripe_onboarding_authorization') return {data: account, error: null};
      if (name === 'hotel_v2_admin_get_stripe_platform_readiness_114486') return {data: {
        contract_version: 'hotels_stripe_platform_readiness_admin_v1', state: options.stale ? 'STALE' : 'READY', ready: !options.stale,
        blocked_reason: options.stale ? 'attestation_expired' : null, checked_at: '2026-09-13T00:00:00.000Z', expires_at: '2026-09-13T00:15:00.000Z',
        observed_at: options.stale ? '2026-09-13T00:16:00.000Z' : '2026-09-13T00:01:00.000Z', request_id: '86000000-0000-4000-8000-000000000010'}, error: null};
      throw Error('Unapproved request: ' + name);
    }});
    const state = w.HotelsV2Workspace.state, repo = w.HotelsV2WorkspaceRepository;
    state.workspace = {property: {...property, currency: 'EUR'}, payment_due: {exact_override: {enabled: true, mode: 'per_day', amount: 10, currency: 'EUR'}}};
    state.h3Configuration = {property: {...property, currency: 'EUR'}, payment_policies: [{is_active: true, terms: [{sequence: 1}, {sequence: 2}]}],
      commission_policies: [{is_active: true, commission_mode: 'per_allocated_room_per_night', amount: 10, currency: 'EUR', review_status: 'reviewed'}]};
    try {state.contentControl = await repo.getContentControl(hotel);} catch (error) {state.contentControlError = error;}
    state.capabilityLifecycle = options.missingLifecycle ? null : await repo.getCapabilityLifecycle();
    w.__before = JSON.stringify({content, lifecycle, account, payment: state.workspace.payment_due, h3: state.h3Configuration});
    w.__business = {content, lifecycle, account, payment: state.workspace.payment_due, h3: state.h3Configuration};
    w.__renderPayments(document.getElementById('test'));
  }, {hotel: HOTEL, partner: PARTNER, assignment: ASSIGNMENT, options});
  await expect(page.locator('[data-stripe-platform-state]')).toContainText(options.stale ? 'STALE' : 'READY');
}

async function noMutations(page: Page) {
  const calls = await page.evaluate(() => (window as any).__calls);
  expect(calls.every((c: any) => c.name.startsWith('hotel_v2_admin_get_'))).toBe(true);
  expect(calls.filter((c: any) => /_(set|apply|preview|submit)_/.test(c.name))).toEqual([]);
  await expect(page.locator('[data-payments-stripe] form, [data-payments-stripe] button, [data-payments-stripe] a')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify((window as any).__business) === (window as any).__before)).toBe(true);
}

for (const stale of [false, true]) test(`Admin Payments separates enabled capability, authorization v1 and NOT_CONNECTED with readiness ${stale ? 'STALE' : 'READY'}`, async ({page}) => {
  await setup(page, {stale});
  await expect(page.locator('[data-payments-stripe-capability]')).toHaveText('Capability enabled');
  await expect(page.locator('[data-payments-stripe-authorization]')).toHaveText('Authorized');
  await expect(page.locator('[data-payments-stripe-state]')).toContainText('Authorization version1');
  await expect(page.locator('[data-payments-stripe-account]')).toHaveText('Not connected');
  await expect(page.locator('[data-payments-public-booking]')).toHaveText('OFF');
  await expect(page.locator('#test')).not.toContainText('Capability disabled');
  await expect(page.locator('[data-payments-stripe]')).toContainText('does not by itself enable payment routing, payouts, settlement or public booking');
  await expect(page.locator('#test')).toContainText('€10.00 per day');
  await expect(page.locator('#test')).toContainText('2 reviewed steps');
  await expect(page.locator('#test')).toContainText('€10.00 / allocated room / night');
  const calls = await page.evaluate(() => (window as any).__calls.filter((c: any) => c.name === 'hotel_v2_admin_get_partner_stripe_onboarding_authorization'));
  expect(calls).toEqual([{name: 'hotel_v2_admin_get_partner_stripe_onboarding_authorization', args: {p_partner_id: PARTNER}}]);
  await noMutations(page);
});

test('Admin Payments actual capability OFF stays truthful when the post-Stripe content contract rejects that boundary', async ({page}) => {
  await setup(page, {capability: false});
  await expect(page.locator('[data-payments-stripe-capability]')).toHaveText('Capability disabled');
  // The successor retains the post-Stripe content contract. Do not invent Partner evidence after it rejects OFF.
  expect(await page.evaluate(() => Boolean((window as any).HotelsV2Workspace.state.contentControlError))).toBe(true);
  await expect(page.locator('[data-payments-stripe]')).toContainText('No verified operational Partner assignment');
  await expect(page.locator('[data-payments-stripe-authorization], [data-payments-stripe-account]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.name.includes('stripe_onboarding_authorization')))).toEqual([]);
  await noMutations(page);
});

for (const options of [{badAccount: true}, {platformMismatch: true}]) test(`Admin Payments rejects inconsistent account evidence ${JSON.stringify(options)}`, async ({page}) => {
  await setup(page, options);
  await expect(page.locator('[data-payments-stripe-capability]')).toHaveText('Capability enabled');
  await expect(page.locator('[data-payments-stripe-state]')).toContainText('unavailable or inconsistent');
  await expect(page.locator('[data-payments-stripe-authorization]')).toHaveCount(0);
  await expect(page.locator('[data-payments-stripe-account]')).toHaveCount(0);
  await noMutations(page);
});

test('Admin Payments absent account DTO fields remain unknown, not fabricated NOT_CONNECTED', async ({page}) => {
  await setup(page, {accountFieldsMissing: true, authorized: false});
  await expect(page.locator('[data-payments-stripe-authorization]')).toHaveText('Not authorized');
  await expect(page.locator('[data-payments-stripe-account]')).toHaveText('Unavailable');
  await expect(page.locator('[data-payments-stripe-capability]')).toHaveText('Capability enabled');
  await noMutations(page);
});

for (const options of [{noAssignment: true}, {foreignAssignment: true}, {missingLifecycle: true}]) test(`Admin Payments never infers missing verified scope ${JSON.stringify(options)}`, async ({page}) => {
  await setup(page, options);
  if (options.missingLifecycle) await expect(page.locator('[data-payments-stripe-capability]')).toHaveText('Capability state unavailable');
  else await expect(page.locator('[data-payments-stripe]')).toContainText('No verified operational Partner assignment');
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.name.includes('stripe_onboarding_authorization')))).toEqual([]);
  await noMutations(page);
});

for (const language of ['en', 'pl', 'he'] as const) test(`Admin Payments localized mobile presentation ${language}`, async ({page}, testInfo) => {
  await setup(page, {language, mobile: true, stale: true});
  const expected = {en: ['Capability enabled', 'Authorized', 'Not connected', 'OFF'], pl: ['Funkcja włączona', 'Autoryzowany', 'Niepołączone', 'WYŁ.'], he: ['היכולת מופעלת', 'מורשה', 'לא מחובר', 'כבוי']}[language];
  for (const [index, selector] of Array.from(['capability', 'authorization', 'account'].entries())) await expect(page.locator(`[data-payments-stripe-${selector}]`)).toHaveText(expected[index]);
  await expect(page.locator('[data-payments-public-booking]')).toHaveText(expected[3]);
  const card = page.locator('[data-payments-stripe]');
  expect(await card.evaluate(el => getComputedStyle(el).direction)).toBe(language === 'he' ? 'rtl' : 'ltr');
  expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const box = (await card.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x + box.width).toBeLessThanOrEqual(390);
  await card.screenshot({path: testInfo.outputPath(`admin-payments-${language}.png`)});
  await noMutations(page);
});
