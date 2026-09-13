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

type Attestation = 'MISSING' | 'NOT_READY' | 'STALE' | 'READY';
type PartnerGate = { authorized: boolean; platform: boolean; ready: boolean; status?: StripeState; attestation?: Attestation };
const partnerStripeCopy = {
  en: { open: 'Open Stripe Connect', stale: 'Platform verification expired', commission: 'CyprusEye commission policy',
    perRoomNight: 'per allocated Room per rental night', readOnly: 'Commission is server-derived and read-only.',
    unavailable: 'Payment details are unavailable from the secure read contract.' },
  pl: { open: 'Otwórz Stripe Connect', stale: 'Weryfikacja platformy wygasła', commission: 'Zasada prowizji CyprusEye',
    perRoomNight: 'za przydzielony pokój za noc pobytu', readOnly: 'Prowizja jest wyliczana przez serwer i tylko do odczytu.',
    unavailable: 'Szczegóły płatności są niedostępne w bezpiecznym kontrakcie odczytu.' },
  he: { open: 'פתיחת Stripe Connect', stale: 'תוקף אימות הפלטפורמה פג', commission: 'מדיניות עמלת CyprusEye',
    perRoomNight: 'לכל חדר מוקצה לכל ליל שכירות', readOnly: 'העמלה מחושבת בשרת ומוצגת לקריאה בלבד.',
    unavailable: 'פרטי התשלום אינם זמינים מחוזה הקריאה המאובטח.' },
};

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
      platform_ready: gate.ready, attestation_status: gate.attestation || (gate.ready ? 'READY' : 'NOT_READY'),
      can_connect: gate.platform && gate.authorized && ['NOT_CONNECTED', 'ONBOARDING_INCOMPLETE'].includes(status) };
    await root.HotelsV2PartnerWorkspace.open({ partnerId, assignment: { assignment_id: assignmentId, hotel_id: hotelId } });
  }, { gate, partnerId: PARTNER_ID, hotelId: HOTEL_ID, assignmentId: ASSIGNMENT_ID });
  await navigatePartner(page, 'payments');
}

async function expectPartnerStripeReadOnly(page: Page) {
  expect(await page.evaluate(() => (window as any).__h32b.rpcCalls
    .filter((call: any) => /preview|apply|submit|create_booking/.test(call.name)))).toEqual([]);
  await expect(page.locator('[data-phw-existing-flow="payments"]')).toHaveCount(0);
  await expect(page.locator('a[href*="connect.stripe.com"], a[href*="oauth"]')).toHaveCount(0);
}

for (const [size, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
  for (const language of ['en', 'pl', 'he'] as Language[]) {
    for (const attestation of ['STALE', 'READY'] as const) {
      test(`Partner Payments Stripe card ${attestation} ${size} ${language} preserves evidence and action gates`, async ({ page, baseURL }, testInfo) => {
        await installOfflineRoutes(page, baseURL!);
        await installPartnerHarness(page, viewport, language, { commercialOwnerPreset: true });
        await page.evaluate(() => {
          // Match the existing EUR10 policy using only the local read fixture.
          (window as any).__h32b.workspace.pricing.commission_policy.commission_mode = 'per_allocated_room_per_night';
        });
        await setPartnerStripeGate(page, { authorized: true, platform: true, ready: attestation === 'READY', attestation });
        const payments = page.locator('[data-phw-panel="payments"]');
        await expect(payments.locator('.phw-module-empty')).toHaveCount(0);
        await expect(payments).not.toContainText(partnerStripeCopy[language].unavailable);
        await expect(payments.locator('.phw-module-main > article')).toHaveCount(1);
        await expect(payments.locator('[data-booking-id]')).toHaveCount(0);
        const policy = payments.locator('.phw-payment-policy');
        await expect(policy).toBeVisible();
        await expect(policy.getByRole('heading', { level: 3 })).toHaveText(partnerStripeCopy[language].commission);
        await expect(policy.locator('strong')).toContainText('10');
        await expect(policy.locator('strong')).toContainText('€');
        await expect(policy.locator('strong')).toContainText(partnerStripeCopy[language].perRoomNight);
        await expect(policy.locator('strong')).not.toContainText('%');
        await expect(policy).toContainText(partnerStripeCopy[language].readOnly);
        const card = page.locator('article[data-phw-stripe-lifecycle]');
        await expect(card).toBeVisible();
        await expect(card).toHaveClass(/\bpartner-stripe-tile\b/);
        await expect(card.getByRole('heading', { level: 3 })).toHaveText('Stripe Connect');
        await expect(card.locator('dl dd')).toHaveText(['Authorized', 'ON', 'NOT_CONNECTED', attestation]);
        await expect(card).toHaveAttribute('data-stripe-state', attestation === 'READY' ? 'READY_TO_CONNECT' : 'PLATFORM_NOT_READY');
        const logo = card.locator('img.partner-stripe-logo');
        await expect(logo).toBeVisible();
        await expect(logo).toHaveAttribute('src', '/assets/stripe-wordmark.svg');
        await expect(logo).toHaveAttribute('alt', 'Stripe');
        await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        const styles = await card.evaluate(node => {
          const style = getComputedStyle(node);
          return { image: style.backgroundImage, direction: style.direction, fits: node.scrollWidth <= node.clientWidth + 1 };
        });
        expect(styles.image).toContain('linear-gradient(');
        expect(styles.image).toContain('rgb(99, 91, 255)');
        expect(styles.direction).toBe(language === 'he' ? 'rtl' : 'ltr');
        expect(styles.fits, 'The entire lifecycle card fits without clipped evidence').toBe(true);
        const active = card.locator('a[data-phw-stripe-connection]');
        const disabled = card.locator('button[data-phw-stripe-connection-disabled]');
        const action = attestation === 'READY' ? active : disabled;
        await expect(action).toHaveClass(/\bpartner-stripe-tile__action\b/);
        await expect(action).toHaveAccessibleName(partnerStripeCopy[language].open);
        if (attestation === 'READY') {
          await expect(active).toHaveAttribute('href', `/partners/stripe-connect?${SCOPE}&lang=${language}`);
          await expect(disabled).toHaveCount(0);
          await active.focus();
          await expect(active).toBeFocused();
        } else {
          await expect(card).toContainText(partnerStripeCopy[language].stale);
          await expect(active).toHaveCount(0);
          await expect(disabled).toBeDisabled();
          await expect(disabled).not.toHaveAttribute('href');
          // Native disabled activation cannot navigate or dispatch the legacy flow.
          const beforeUrl = page.url();
          await disabled.evaluate((button: HTMLButtonElement) => button.click());
          expect(page.url()).toBe(beforeUrl);
          expect(await page.evaluate(() => (window as any).__h32b.bookingEvents)).toBe(0);
        }
        if (size === 'mobile') {
          // Locator screenshots can place the crop behind fixed navigation.
          // Scroll the real page, retaining the footer and all production CSS.
          await card.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
          const footerBox = await page.locator('.phw-mobile-nav:visible').boundingBox();
          const cardBox = await card.boundingBox();
          expect(cardBox!.y, 'The full card is in the visible viewport').toBeGreaterThanOrEqual(0);
          expect(cardBox!.y + cardBox!.height, 'The full card clears the fixed mobile navigation').toBeLessThanOrEqual(footerBox!.y);
          expect(await action.evaluate(node => {
            const rect = node.getBoundingClientRect();
            return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
          }), 'The mobile CTA is not covered by another element').toBe(true);
          if (attestation === 'READY') await active.click({ trial: true });
        }
        const box = await action.boundingBox();
        expect(box!.height, 'The single explicit CTA remains a usable touch target').toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        await expectNoHorizontalOverflow(page);
        await expectPartnerStripeReadOnly(page);
        await card.screenshot({ path: testInfo.outputPath(`partner-payments-stripe-${attestation.toLowerCase()}-${size}-${language}.png`) });
      });
    }
  }
}

test('Partner Stripe branding follows authorization and platform gates while readiness and account gates keep actions unavailable', async ({ page, baseURL }) => {
  await installOfflineRoutes(page, baseURL!);
  await installPartnerHarness(page, DESKTOP, 'en', { commercialOwnerPreset: true });
  for (const gate of [
    { authorized: false, platform: true, ready: true },
    { authorized: true, platform: false, ready: true },
    ...(['MISSING', 'NOT_READY', 'STALE'] as Attestation[]).map(attestation => ({ authorized: true, platform: true, ready: false, attestation })),
    ...(['CONNECTED', 'RESTRICTED', 'ACTION_REQUIRED', 'DISABLED'] as StripeState[]).map(status => ({ authorized: true, platform: true, ready: true, status })),
  ] satisfies PartnerGate[]) {
    await setPartnerStripeGate(page, gate);
    const card = page.locator('article[data-phw-stripe-lifecycle]');
    await expect(card).toBeVisible();
    await expect(page.locator('[data-phw-stripe-connection]')).toHaveCount(0);
    if (gate.authorized && gate.platform) {
      await expect(card).toHaveClass(/\bpartner-stripe-tile\b/);
      await expect(card.locator('img.partner-stripe-logo')).toBeVisible();
      await expect(card.locator('[data-phw-stripe-connection-disabled]')).toBeDisabled();
    } else {
      await expect(card).not.toHaveClass(/\bpartner-stripe-tile\b/);
      await expect(card.locator('[data-phw-stripe-connection-disabled]')).toHaveCount(0);
    }
    await expectPartnerStripeReadOnly(page);
  }
  await setPartnerStripeGate(page, { authorized: true, platform: true, ready: true, status: 'ONBOARDING_INCOMPLETE' });
  await expect(page.locator('[data-phw-stripe-connection]')).toBeVisible();
  await expect(page.locator('[data-phw-stripe-connection]')).toHaveAttribute('href', `/partners/stripe-connect?${SCOPE}&lang=en`);
  await expectPartnerStripeReadOnly(page);
});

test('READY Payments CTA opens the dark Stripe page with verified workspace scope and a mocked status read only', async ({ page, baseURL }) => {
  const { calls } = await mockConnect(page, 'NOT_CONNECTED', baseURL!);
  await installPartnerHarness(page, DESKTOP, 'en', { commercialOwnerPreset: true });
  // URL identifiers are untrusted: the CTA must use the validated workspace.
  await page.evaluate(() => history.replaceState(null, '', `${location.pathname}?partner=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&hotel=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`));
  await setPartnerStripeGate(page, { authorized: true, platform: true, ready: true, attestation: 'READY' });
  const link = page.locator('article.partner-stripe-tile a[data-phw-stripe-connection]');
  await expect(link).toHaveAttribute('href', `/partners/stripe-connect?${SCOPE}&lang=en`);
  expect(calls).toEqual([]);
  await expectPartnerStripeReadOnly(page);
  await link.click();
  await expect(page).toHaveURL(`${new URL(baseURL!).origin}/partners/stripe-connect?${SCOPE}&lang=en`);
  await expect(page.locator('body')).toHaveClass(/\bpartner-stripe-page\b/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(9, 13, 24)');
  await expect(page.locator('[data-stripe-status]')).toHaveAttribute('data-state', 'NOT_CONNECTED');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stripe connection');
  expect(calls).toEqual([{ action: 'status', partner_id: PARTNER_ID, hotel_id: HOTEL_ID }]);
});

for (const withPaymentRow of [false, true]) {
  test(`Payments never exposes the generic legacy placeholder when full management is advertised, rows=${withPaymentRow}`, async ({ page, baseURL }) => {
    await installOfflineRoutes(page, baseURL!);
    await installPartnerHarness(page, DESKTOP, 'en', { commercialOwnerPreset: true });
    await page.evaluate(({ withPaymentRow }) => {
      const root = window as any;
      const help = root.HotelsV2WorkspaceHelp;
      // Inject only the read-presentation boundary, retaining its real validator.
      // This covers a future payment-row response without enabling real payments.
      root.HotelsV2WorkspaceHelp = { ...help, presentationFromAvailability: (options: any) => {
        const presentation = help.validatePresentation({
          contract_version: help.PRESENTATION_CONTRACT, scope: 'partner', hotel_id: options.hotelId,
          generated_at: '2026-09-07T10:00:00Z',
          capabilities: { bookings_visible: true, payments_visible: true, full_booking_management: true, full_payment_management: true },
          summary: { total_bookings: withPaymentRow ? 1 : 0, upcoming_bookings: null, current_recent_bookings: null },
          bookings: withPaymentRow ? [{
            booking_id: '77777777-7777-4777-8777-777777777777', reference: 'OFFLINE-PAYMENT-1', status: 'confirmed',
            arrival_date: '2026-09-20', departure_date: '2026-09-22', guest_count: 2,
            allocation: [], customer_total: 240, currency: 'EUR',
            payment: { state: 'paid', paid: 240, remaining: 0, cypruseye_commission: 20, partner_net: 220, currency: 'EUR' },
          }] : [],
        }, { hotelId: options.hotelId, scope: 'partner' });
        root.__h32b.paymentPresentation = presentation;
        return presentation;
      } };
    }, { withPaymentRow });
    await setPartnerStripeGate(page, { authorized: true, platform: true, ready: false, attestation: 'STALE' });
    const payments = page.locator('[data-phw-panel="payments"]');
    await expect(payments).toBeVisible();
    await expect(payments.locator('[data-booking-id]')).toHaveCount(withPaymentRow ? 1 : 0);
    if (withPaymentRow) await expect(payments).toContainText('OFFLINE-PAYMENT-1');
    await expect(payments.locator('.phw-module-empty')).toHaveCount(0);
    await expect(payments).not.toContainText(partnerStripeCopy.en.unavailable);
    await expect(payments).not.toContainText('No authorized payment summaries are currently available.');
    await expect(payments.locator('.phw-module-main > article')).toHaveCount(withPaymentRow ? 2 : 1);
    await expect(payments.locator('.phw-payment-policy')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__h32b.paymentPresentation.capabilities.full_payment_management)).toBe(true);
    await expect(payments.locator('[data-phw-stripe-connection-disabled]')).toBeDisabled();
    await expectPartnerStripeReadOnly(page);
    // The unrelated legacy Bookings action remains intact.
    await navigatePartner(page, 'bookings');
    await page.locator('[data-phw-panel="bookings"] [data-phw-existing-flow="bookings"]').click();
    expect(await page.evaluate(() => (window as any).__h32b.bookingEvents)).toBe(1);
    await expectPartnerStripeReadOnly(page);
  });
}

test('optional reviewed-pricing RPC timeout 57014 does not prevent the STALE Stripe Payments card rendering', async ({ page, baseURL }) => {
  await installOfflineRoutes(page, baseURL!);
  await installPartnerHarness(page, DESKTOP, 'en', { commercialOwnerPreset: true });
  await page.evaluate(() => {
    const root = window as any;
    const workspace = root.__h32b.workspace;
    const room = workspace.rooms[0];
    const rate = workspace.pricing.room_rates[0];
    const schedule = workspace.pricing.schedules[0];
    const identities = [
      { room: 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94', rate: '7e420964-9cbf-4f1b-abd3-09840af5240f', schedule: 'aec20731-7a56-35f0-334e-92b363351f02' },
      { room: '825c01b7-9f82-492a-9c81-9b1d5cd7acd3', rate: '3320590d-632d-423f-80d0-fd021cba7293', schedule: '9d109336-64f3-3c57-4684-968b59c94c3b' },
    ];
    // A complete validated target is required to reach the real optional RPC;
    // no Core readiness or workspace validation is bypassed for this regression.
    workspace.rooms = identities.map((identity, index) => ({ ...room, id: identity.room, code: `reviewed-room-${index}` }));
    workspace.pricing.room_rates = identities.map(identity => ({ ...rate, id: identity.rate, room_type_id: identity.room,
      pricing_schedule_id: identity.schedule, pricing_source: 'schedule', base_nightly_rate_authoritative: false, is_active: true }));
    workspace.pricing.schedules = identities.map((identity, index) => ({ ...schedule, id: identity.schedule,
      code: `reviewed-schedule-${index}`, application_scope: 'room_occupancy', sharing_mode: 'independent',
      maximum_party_size: 4, minimum_billable_occupancy: 2, is_active: true, review_status: 'reviewed' }));
    let sequence = 1;
    workspace.pricing.schedule_tiers = identities.flatMap(identity => [2, 3, 4].flatMap(guestCount =>
      Array.from({ length: 9 }, (_, index) => ({
        id: `10000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`, schedule_id: identity.schedule,
        guest_count: guestCount, threshold_nights: index + 2, nightly_rate: 100 + guestCount + index,
        is_active: true, version: 1, updated_at: '2026-09-07T10:00:00Z',
      }))));
    workspace.pricing.commission_policy.commission_mode = 'per_allocated_room_per_night';
    const getClient = root.getSupabase;
    root.getSupabase = () => ({ ...getClient(), rpc: async (name: string, params: any) => {
      if (name === 'hotel_v2_partner_get_seven_arches_reviewed_pricing_114488') {
        root.__h32b.rpcCalls.push({ name, params });
        return { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout private-timeout-detail' } };
      }
      return getClient().rpc(name, params);
    } });
  });
  await setPartnerStripeGate(page, { authorized: true, platform: true, ready: false, attestation: 'STALE' });
  await expect(page.locator('[data-phw-panel="payments"]')).toBeVisible();
  const card = page.locator('article.partner-stripe-tile[data-phw-stripe-lifecycle]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Platform verification expired');
  await expect(card.locator('dl dd')).toHaveText(['Authorized', 'ON', 'NOT_CONNECTED', 'STALE']);
  await expect(card.locator('[data-phw-stripe-connection-disabled]')).toBeDisabled();
  await expect(card.locator('[data-phw-stripe-connection]')).toHaveCount(0);
  await expect(page.locator('#partnerHotelWorkspaceView')).not.toContainText('private-timeout-detail');
  await expect(page.locator('[data-phw-lifecycle]')).toContainText('Exact reviewed pricing control is unavailable');
  const pricingCalls = await page.evaluate(() => (window as any).__h32b.rpcCalls
    .filter((call: any) => call.name === 'hotel_v2_partner_get_seven_arches_reviewed_pricing_114488'));
  expect(pricingCalls).toEqual([{ name: 'hotel_v2_partner_get_seven_arches_reviewed_pricing_114488', params: { p_partner_id: PARTNER_ID, p_hotel_id: HOTEL_ID } }]);
  await expectPartnerStripeReadOnly(page);
});
