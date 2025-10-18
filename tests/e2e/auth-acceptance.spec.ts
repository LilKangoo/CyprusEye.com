import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supabaseStub = readFileSync(path.resolve(__dirname, '../fixtures/supabase-stub.js'), 'utf8');

const SUPABASE_MODULE_URL = 'https://esm.sh/@supabase/supabase-js@2';

async function enableSupabaseStub(page: Page) {
  await page.route(`${SUPABASE_MODULE_URL}*`, async (route) => {
    await route.fulfill({
      status: 200,
      body: supabaseStub,
      headers: { 'content-type': 'application/javascript' },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await enableSupabaseStub(page);
});

test('homepage loads without console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');

  expect(consoleErrors).toEqual([]);
});

test('unauthenticated auth-required controls redirect to /auth', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => (window as any).CE_AUTH?.enabled === true);

  await Promise.all([
    page.waitForURL('**/auth'),
    page.click('#notificationsToggle'),
  ]);

  expect(new URL(page.url()).pathname).toBe('/auth');
});

const SERVICES = [
  '/vip.html',
  '/kupon.html',
  '/car-rental.html',
  '/attractions.html',
];

for (const servicePath of SERVICES) {
  test(`public service ${servicePath} is reachable without auth`, async ({ page }) => {
    await page.goto(servicePath);
    await page.waitForLoadState('domcontentloaded');
    expect(new URL(page.url()).pathname).toBe(servicePath);
  });
}

test('meta ce-auth="off" disables auth interception', async ({ page }) => {
  await page.route('**/index.html', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace('<meta name="ce-auth" content="on"', '<meta name="ce-auth" content="off"');
    const headers = { ...response.headers() };
    delete headers['content-length'];
    await route.fulfill({
      status: response.status(),
      headers,
      body,
    });
  });

  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#notificationsToggle');

  await page.click('#notificationsToggle');

  expect(new URL(page.url()).pathname).toBe('/index.html');
  const authEnabled = await page.evaluate(() => (window as any).CE_AUTH?.enabled);
  expect(authEnabled).toBe(false);
});

test('login enables access to /account and sign out returns home', async ({ page }) => {
  await page.goto('/auth');

  await page.fill('#login input[name="email"]', 'qa@example.com');
  await page.fill('#login input[name="password"]', 'super-secret');

  await Promise.all([
    page.waitForURL('**/account'),
    page.click('#login button[type="submit"]'),
  ]);

  await page.waitForSelector('#me');
  await expect(page.locator('#me')).toHaveText('Hello, qa@example.com');

  await Promise.all([
    page.waitForURL('**/'),
    page.click('#logout'),
  ]);

  expect(new URL(page.url()).pathname).toBe('/');
});
