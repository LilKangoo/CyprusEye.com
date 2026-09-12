import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ASSIGNMENT_ID = '33333333-3333-4333-8333-333333333333';
const SCOPE = `partner=${PARTNER_ID}&hotel=${HOTEL_ID}`;
const STATES = ['NOT_CONNECTED', 'ONBOARDING_INCOMPLETE', 'CONNECTED', 'RESTRICTED', 'ACTION_REQUIRED', 'DISABLED'] as const;
type StripeState = typeof STATES[number];
type Language = 'en' | 'pl' | 'he';
type Viewport = { width: number; height: number };
type ConnectCall = { action: string; partner_id: string; hotel_id: string; request_id?: string };
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };
const unexpectedRequests = new WeakMap<Page, string[]>();
const browserErrors = new WeakMap<Page, string[]>();

// Reuse the established Partner workspace data and real renderer. Importing its
// .spec.ts directly would register the unrelated suite, so compile ONLY its
// helper prefix in this test process. No production source or fixture is edited.
const partnerFixtureSource = readFileSync(path.join(process.cwd(), 'tests/e2e/partner-hotels-v2-h3-2b-workspace.spec.ts'), 'utf8');
const helperBoundary = partnerFixtureSource.indexOf("test.describe('Audited capability lifecycle: Partner separation'");
if (helperBoundary < 0) throw new Error('Partner fixture helper boundary changed; review test-only reuse');
const helperSource = partnerFixtureSource.slice(0, helperBoundary).replace(/^import .+;\r?\n/gm, '');
const helperCode = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fixtureExports: {
  installHarness?: (page: Page, viewport: Viewport, language: string, options: { commercialOwnerPreset: boolean }) => Promise<void>;
  navigatePartner?: (page: Page, section: string) => Promise<void>;
} = {};
new Function('exports', 'path', 'expect', helperCode)(fixtureExports, path, expect);
const installPartnerHarness = fixtureExports.installHarness!;
const navigatePartner = fixtureExports.navigatePartner!;

async function installOfflineRoutes(page: Page, baseURL: string) {
  const blocked: string[] = [];
  unexpectedRequests.set(page, blocked);
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  const origin = new URL(baseURL).origin;
  const files: Record<string, [string, string]> = {
    '/partners/stripe-connect': ['partners/stripe-connect.html', 'text/html'],
    '/partners/stripe-connect.html': ['partners/stripe-connect.html', 'text/html'],
    '/partners/hotels-v2-workspace.css': ['partners/hotels-v2-workspace.css', 'text/css'],
    '/js/hotels-stripe-connect-page.js': ['js/hotels-stripe-connect-page.js', 'application/javascript'],
    '/assets/stripe-wordmark.svg': ['assets/stripe-wordmark.svg', 'image/svg+xml'],
    '/assets/cyprus_logo-128.png': ['assets/cyprus_logo-128.png', 'image/png'],
  };
  // Nothing reaches a server: local documents/assets are fulfilled from this
  // checkout, and every unrecognized or external request is aborted.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const file = files[url.pathname];
    if (url.origin === origin && file) {
      return route.fulfill({ contentType: file[1], body: readFileSync(path.join(process.cwd(), file[0])) });
    }
    blocked.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.abort();
  });
}

async function mockConnect(page: Page, status: StripeState, baseURL: string, failRefresh = false) {
  await installOfflineRoutes(page, baseURL);
  const calls: ConnectCall[] = [];
  const authorizationUrl = new URL('https://connect.stripe.com/oauth/authorize');
  authorizationUrl.search = new URLSearchParams({
    response_type: 'code', client_id: 'ca_OfflineVisualFixture', scope: 'read_write', state: 'a'.repeat(64),
    redirect_uri: `${new URL(baseURL).origin}/partners/stripe-connect-return.html`,
  }).toString();
  await page.exposeFunction('recordStripeVisualCall', (name: string, body: ConnectCall) => {
    expect(name).toBe('hotels-stripe-connect');
    expect(['status', 'refresh', 'begin']).toContain(body.action);
    calls.push(body);
  });
  await page.route('**/js/supabaseClient.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'offline-visual-partner' } } }) },
      functions: { invoke: async (name, { body }) => {
        await window.recordStripeVisualCall(name, body);
        if (body.action === 'refresh' && ${failRefresh}) return { error: { message: 'synthetic_failure' } };
        if (body.action === 'begin') return { data: {
          contract_version: 'hotels_partner_stripe_connect_begin_v1', authorization_url: ${JSON.stringify(authorizationUrl.href)}
        } };
        return { data: { contract_version: 'hotels_partner_stripe_connect_v1', status: ${JSON.stringify(status)}, checked_at: null } };
      } }
    };`,
  }));
  return { calls, authorizationUrl: authorizationUrl.href };
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Page must fit the viewport').toBe(true);
}

test('failed refresh never presents an old CONNECTED state as a green success', async ({ page, baseURL }) => {
  const { calls } = await mockConnect(page, 'CONNECTED', baseURL!, true);
  await page.goto(`/partners/stripe-connect?${SCOPE}`);
  const status = page.locator('[data-stripe-status]');
  await expect(status).toHaveAttribute('data-state', 'CONNECTED');
  await page.locator('[data-stripe-refresh]').click();
  await expect(status).toContainText('Connection could not be verified');
  await expect(status).toHaveCSS('color', 'rgb(240, 243, 252)');
  await expect(status).toHaveCSS('background-color', 'rgb(21, 29, 48)');
  await expect(page.locator('[data-stripe-begin]')).toBeHidden();
  expect(calls.map(call => call.action)).toEqual(['status', 'refresh']);
});

test.afterEach(async ({ page }) => {
  expect(unexpectedRequests.get(page) || [], 'Unexpected requests are blocked; all fixtures must remain offline').toEqual([]);
  expect(browserErrors.get(page) || [], 'Refreshed UI must not introduce browser exceptions').toEqual([]);
});

for (const status of STATES) {
  test(`refreshed Stripe page preserves ${status} actions and server-only status`, async ({ page, baseURL }) => {
    const { calls } = await mockConnect(page, status, baseURL!);
    await page.goto(`/partners/stripe-connect.html?${SCOPE}&lang=en`);
    const statusRegion = page.locator('[data-stripe-status]');
    await expect(statusRegion).toHaveAttribute('data-state', status);
    await expect(statusRegion).toHaveAttribute('role', 'status');
    await expect(statusRegion).toBeVisible();
    await expect(page.locator('[data-stripe-begin]')).toHaveCount(1);
    await expect(page.locator('[data-stripe-refresh]')).toHaveCount(1);
    if (['NOT_CONNECTED', 'ONBOARDING_INCOMPLETE', 'ACTION_REQUIRED'].includes(status)) {
      await expect(page.locator('[data-stripe-begin]')).toBeVisible();
      await expect(page.locator('[data-stripe-begin]')).toBeEnabled();
    } else {
      await expect(page.locator('[data-stripe-begin]')).toBeHidden();
    }
    if (status === 'DISABLED') await expect(page.locator('[data-stripe-refresh]')).toBeHidden();
    else await expect(page.locator('[data-stripe-refresh]')).toBeVisible();
    await expect(page.locator('a[href="/partners/"]')).toBeVisible();
    expect(calls).toEqual([{ action: 'status', partner_id: PARTNER_ID, hotel_id: HOTEL_ID }]);
  });
}

const translated = {
  en: { heading: 'Stripe connection', begin: 'Connect Stripe', refresh: 'Refresh status', back: 'Back to Partner portal' },
  pl: { heading: 'Połączenie Stripe', begin: 'Połącz Stripe', refresh: 'Odśwież stan', back: 'Wróć do panelu Partnera' },
  he: { heading: 'חיבור Stripe', begin: 'חיבור Stripe', refresh: 'רענון מצב', back: 'חזרה לפורטל השותף' },
};

for (const [size, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
  for (const language of ['en', 'pl', 'he'] as Language[]) {
    test(`Stripe visual layout ${size} ${language} keeps localized controls and back link`, async ({ page, baseURL }, testInfo) => {
      await page.setViewportSize(viewport);
      const { calls } = await mockConnect(page, 'NOT_CONNECTED', baseURL!);
      const pathname = size === 'mobile' ? '/partners/stripe-connect' : '/partners/stripe-connect.html';
      await page.goto(`${pathname}?${SCOPE}&lang=${language}`);
      await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state', 'NOT_CONNECTED');
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'he' ? 'rtl' : 'ltr');
      await expect(page.locator('body')).toHaveClass(/\bpartner-stripe-page\b/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(translated[language].heading);
      await expect(page.locator('[data-stripe-begin]')).toHaveText(translated[language].begin);
      await expect(page.locator('[data-stripe-refresh]')).toHaveText(translated[language].refresh);
      await expect(page.getByRole('link', { name: translated[language].back })).toHaveAttribute('href', '/partners/');
      for (const copy of await page.locator('[data-copy]').allTextContents()) {
        expect(copy.trim(), 'All informational copy is supplied in the selected language').not.toBe('');
        expect(copy).not.toContain('undefined');
      }
      const logo = page.locator('img.partner-stripe-logo');
      await expect(logo).toBeVisible();
      await expect(logo).toHaveAttribute('src', '/assets/stripe-wordmark.svg');
      await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      for (const selector of ['[data-stripe-begin]', '[data-stripe-refresh]']) {
        const box = await page.locator(selector).boundingBox();
        expect(box!.height, 'Touch targets should be at least 44px high').toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
      await expectNoHorizontalOverflow(page);
      expect(calls.map(call => call.action)).toEqual(['status']);
      await page.screenshot({ path: testInfo.outputPath(`stripe-${size}-${language}.png`), fullPage: true });
    });
  }
}

test('refresh stays read-only and sends only the original scoped refresh action', async ({ page, baseURL }) => {
  const { calls } = await mockConnect(page, 'NOT_CONNECTED', baseURL!);
  await page.goto(`/partners/stripe-connect?${SCOPE}&lang=en`);
  await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state', 'NOT_CONNECTED');
  await page.locator('[data-stripe-refresh]').click();
  await expect(page.locator('[data-stripe-refresh]')).toBeEnabled();
  expect(calls).toEqual([
    { action: 'status', partner_id: PARTNER_ID, hotel_id: HOTEL_ID },
    { action: 'refresh', partner_id: PARTNER_ID, hotel_id: HOTEL_ID },
  ]);
  await expect(page).toHaveURL(new RegExp(`/partners/stripe-connect\\?${SCOPE}&lang=en$`));
});

test('begin navigates exactly once to an entirely mocked Stripe destination', async ({ page, baseURL }) => {
  const { calls, authorizationUrl } = await mockConnect(page, 'NOT_CONNECTED', baseURL!);
  const navigations: string[] = [];
  await page.route(authorizationUrl, route => {
    navigations.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline Stripe destination</title>' });
  });
  await page.goto(`/partners/stripe-connect.html?${SCOPE}`);
  await expect(page.locator('[data-stripe-begin]')).toBeVisible();
  // Two same-task clicks exercise the existing busy guard, not a real OAuth flow.
  await page.locator('[data-stripe-begin]').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page).toHaveURL(authorizationUrl);
  expect(calls.map(call => call.action)).toEqual(['status', 'begin']);
  expect(calls[1]).toEqual({ action: 'begin', partner_id: PARTNER_ID, hotel_id: HOTEL_ID, request_id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  expect(navigations).toEqual([authorizationUrl]);
});

type PartnerGate = { authorized: boolean; platform: boolean; ready: boolean; status?: StripeState };
async function setPartnerStripeGate(page: Page, gate: PartnerGate) {
  await page.evaluate(async ({ gate, partnerId, hotelId, assignmentId }) => {
    const root = window as any;
    const workspace = root.__h32b.workspace;
    workspace.feature_flags = { hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: true,
      hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: gate.platform };
    workspace.capability_lifecycle = { contract_version: 'hotels_v2_capability_lifecycle_v1', version: 3,
      feature_flags: { ...workspace.feature_flags }, public_booking_enabled: false, architecture: 'legacy',
      expected_public_change: false, audit_chain_exact: true };
    const status = gate.status || 'NOT_CONNECTED';
    workspace.stripe_connection = { contract_version: 'hotels_partner_stripe_capability_v1', partner_id: partnerId,
      hotel_id: hotelId, platform_enabled: gate.platform, onboarding_authorized: gate.authorized,
      account_status: status, checked_at: status === 'NOT_CONNECTED' ? null : '2026-09-07T10:00:00Z',
      platform_ready: gate.ready, attestation_status: gate.ready ? 'READY' : 'NOT_READY',
      can_connect: gate.platform && gate.authorized && ['NOT_CONNECTED', 'ONBOARDING_INCOMPLETE'].includes(status) };
    await root.HotelsV2PartnerWorkspace.open({ partnerId, assignment: { assignment_id: assignmentId, hotel_id: hotelId } });
  }, { gate, partnerId: PARTNER_ID, hotelId: HOTEL_ID, assignmentId: ASSIGNMENT_ID });
  await navigatePartner(page, 'payments');
}

for (const [size, viewport, language] of [['desktop', DESKTOP, 'en'], ['mobile', MOBILE, 'he']] as const) {
  test(`Partner purple Stripe tile preserves the original scoped URL ${size}`, async ({ page, baseURL }, testInfo) => {
    await installOfflineRoutes(page, baseURL!);
    await installPartnerHarness(page, viewport, language, { commercialOwnerPreset: true });
    await setPartnerStripeGate(page, { authorized: true, platform: true, ready: true });
    const link = page.locator('[data-phw-stripe-connection]');
    await expect(link).toBeVisible();
    await expect(link).toHaveClass(/\bpartner-stripe-tile\b/);
    await expect(link).toHaveAttribute('href', `/partners/stripe-connect.html?${SCOPE}&lang=${language}`);
    const styles = await link.evaluate(node => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, image: style.backgroundImage, height: node.getBoundingClientRect().height };
    });
    expect(styles.background !== 'rgba(0, 0, 0, 0)' || styles.image !== 'none', 'Stripe tile has a visible colored surface').toBe(true);
    expect(styles.height).toBeGreaterThanOrEqual(44);
    await link.focus();
    await expect(link).toBeFocused();
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(() => (window as any).__h32b.rpcCalls.some((call: any) => /preview|apply|submit|create_booking/.test(call.name)))).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`partner-stripe-tile-${size}.png`), fullPage: true });
  });
}

test('Partner Stripe tile stays absent for authorization, global, readiness and account gates', async ({ page, baseURL }) => {
  await installOfflineRoutes(page, baseURL!);
  await installPartnerHarness(page, DESKTOP, 'en', { commercialOwnerPreset: true });
  for (const gate of [
    { authorized: false, platform: true, ready: true },
    { authorized: true, platform: false, ready: true },
    { authorized: true, platform: true, ready: false },
    ...(['CONNECTED', 'RESTRICTED', 'ACTION_REQUIRED', 'DISABLED'] as StripeState[]).map(status => ({ authorized: true, platform: true, ready: true, status })),
  ]) {
    await setPartnerStripeGate(page, gate);
    await expect(page.locator('[data-phw-stripe-lifecycle]')).toBeVisible();
    await expect(page.locator('[data-phw-stripe-connection]')).toHaveCount(0);
    await expect(page.locator('.partner-stripe-tile')).toHaveCount(0);
  }
  await setPartnerStripeGate(page, { authorized: true, platform: true, ready: true, status: 'ONBOARDING_INCOMPLETE' });
  await expect(page.locator('[data-phw-stripe-connection]')).toBeVisible();
  await expect(page.locator('[data-phw-stripe-connection]')).toHaveAttribute('href', `/partners/stripe-connect.html?${SCOPE}&lang=en`);
  expect(await page.evaluate(() => (window as any).__h32b.rpcCalls.some((call: any) => /preview|apply|submit|create_booking/.test(call.name)))).toBe(false);
});
