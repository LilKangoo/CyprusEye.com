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

async function waitForStub(page: Page) {
  await page.waitForFunction(() => typeof (window as any).__supabaseStub !== 'undefined');
}

test.beforeEach(async ({ page }) => {
  await enableSupabaseStub(page);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('guest mode toggles UI and persists across reloads', async ({ page }) => {
  await page.goto('/auth/');
  await waitForStub(page);
  await page.evaluate(() => (window as any).__supabaseStub.reset());

  await page.click('#btn-guest');
  await page.waitForURL('**/');

  const authState = page.locator('#auth-state');
  await expect(authState).toHaveText('Gość');
  await expect(page.locator('#loginBtn')).toBeHidden();
  await expect(page.locator('[data-auth-guest-note]')).toBeVisible();

  await page.reload();
  await expect(authState).toHaveText('Gość');
  await expect(page.locator('#loginBtn')).toBeHidden();
  const guestState = await page.evaluate(() => (window as any).CE_STATE?.guest?.active ?? false);
  expect(guestState).toBe(true);
});

test('registration uses Supabase client without leaking credentials in URL', async ({ page }) => {
  await page.goto('/auth/');
  await waitForStub(page);
  await page.evaluate(() => (window as any).__supabaseStub.reset());

  const email = `new-user-${Date.now()}@example.com`;
  await page.click('[data-auth-tab="register"]');
  await page.fill('#form-register input[name="firstName"]', 'Nowy');
  await page.fill('#form-register input[name="email"]', email);
  await page.fill('#form-register input[name="password"]', 'SekretneHaslo1');
  await page.fill('#form-register input[name="passwordConfirm"]', 'SekretneHaslo1');
  await page.click('#form-register button[type="submit"]');

  const toast = page.locator('#authMessage');
  await expect(toast).toContainText('Sprawdź e-mail i potwierdź konto.');
  expect(new URL(page.url()).search).toBe('');

  const stubState = await page.evaluate(() => {
    const stub = (window as any).__supabaseStub;
    return {
      users: stub.state.users,
      profiles: stub.state.profiles,
    };
  });
  const user = stubState.users[email];
  expect(user).toBeTruthy();
  const profile = user ? stubState.profiles[user.id] : null;
  expect(profile).toBeTruthy();
});

test('login updates UI, avoids 405 responses, and unlocks account dashboard', async ({ page }) => {
  const credentials = {
    email: 'qa@example.com',
    password: 'super-secret',
    profile: { name: 'QA Tester', xp: 420, level: 3 },
    xpEvents: [
      { xp_delta: 50, reason: 'check-in', created_at: '2024-05-01T12:00:00.000Z' },
      { xp_delta: 70, reason: 'quest-complete', created_at: '2024-05-02T15:30:00.000Z' },
    ],
  };

  await page.goto('/auth/');
  await waitForStub(page);
  await page.evaluate((data) => {
    const stub = (window as any).__supabaseStub;
    stub.reset();
    stub.seedUser(data);
  }, credentials);

  const disallowedResponses: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 405) {
      disallowedResponses.push(response.url());
    }
  });

  await page.fill('#form-login input[name="email"]', credentials.email);
  await page.fill('#form-login input[name="password"]', credentials.password);
  await Promise.all([
    page.waitForURL('**/'),
    page.click('#form-login button[type="submit"]'),
  ]);

  await expect(page.locator('#auth-state')).toHaveText('Zalogowany');
  await expect(page.locator('#loginBtn')).toBeHidden();
  await expect(page.locator('#logoutBtn')).toBeVisible();
  expect(disallowedResponses).toEqual([]);

  await page.goto('/account/');
  await page.waitForSelector('[data-account-content]:not([hidden])');
  await expect(page.locator('[data-account-email]')).toHaveText(credentials.email);
  await expect(page.locator('[data-account-xp]')).toHaveText(`${credentials.profile.xp}`);
  await expect(page.locator('[data-account-level]')).toHaveText(`${credentials.profile.level}`);
  await expect(page.locator('#xp-events li')).toHaveCount(credentials.xpEvents.length);
});

test('row level security returns only own profile/XP data and guests cannot add XP', async ({ page }) => {
  const player = {
    email: 'alice@example.com',
    password: 'top-secret',
    profile: { name: 'Alicja', xp: 150, level: 4 },
    xpEvents: [
      { xp_delta: 30, reason: 'daily-checkin', created_at: '2024-05-10T09:00:00.000Z' },
      { xp_delta: 45, reason: 'quest-bonus', created_at: '2024-05-11T10:15:00.000Z' },
    ],
  };
  const outsider = {
    email: 'mallory@example.com',
    password: 'bad-actor',
    profile: { name: 'Mallory', xp: 999, level: 9 },
    xpEvents: [
      { xp_delta: 500, reason: 'should-not-see', created_at: '2024-05-09T12:00:00.000Z' },
    ],
  };

  await page.goto('/auth/');
  await waitForStub(page);
  await page.evaluate(({ playerData, outsiderData }) => {
    const stub = (window as any).__supabaseStub;
    stub.reset();
    stub.seedUser(playerData);
    stub.seedUser(outsiderData);
  }, { playerData: player, outsiderData: outsider });

  await page.fill('#form-login input[name="email"]', player.email);
  await page.fill('#form-login input[name="password"]', player.password);
  await Promise.all([
    page.waitForURL('**/'),
    page.click('#form-login button[type="submit"]'),
  ]);

  await page.goto('/account/');
  await page.waitForSelector('#xp-events');
  await expect(page.locator('[data-account-email]')).toHaveText(player.email);
  await expect(page.locator('[data-account-xp]')).toHaveText(`${player.profile.xp}`);
  await expect(page.locator('#xp-events li')).toHaveCount(player.xpEvents.length);
  await expect(page.locator('#xp-events')).not.toContainText('should-not-see');

  await page.click('[data-auth="logout"]');
  await page.waitForURL('**/');
  await expect(page.locator('#auth-state')).toHaveText('Niezalogowany');

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const xpResult = await page.evaluate(async () => {
    const mod = await import('/js/xp.js');
    try {
      await mod.addXp(25, 'guest-test');
      return { success: true };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });
  expect(xpResult.success).toBe(false);
  expect(xpResult.message).toContain('Brak zalogowanego użytkownika');
});

test('logout clears session state and restores login controls', async ({ page }) => {
  const credentials = {
    email: 'logout@example.com',
    password: 'logout-secret',
    profile: { name: 'Wyloguj', xp: 10, level: 1 },
  };

  await page.goto('/auth/');
  await waitForStub(page);
  await page.evaluate((data) => {
    const stub = (window as any).__supabaseStub;
    stub.reset();
    stub.seedUser(data);
  }, credentials);

  await page.fill('#form-login input[name="email"]', credentials.email);
  await page.fill('#form-login input[name="password"]', credentials.password);
  await Promise.all([
    page.waitForURL('**/'),
    page.click('#form-login button[type="submit"]'),
  ]);

  await expect(page.locator('#auth-state')).toHaveText('Zalogowany');
  await page.click('#logoutBtn');
  await page.waitForURL('**/');

  await expect(page.locator('#auth-state')).toHaveText('Niezalogowany');
  await expect(page.locator('#loginBtn')).toBeVisible();
  const localState = await page.evaluate(() => ({
    guest: window.localStorage.getItem('ce_guest'),
    session: (window as any).CE_STATE?.session ?? null,
  }));
  expect(localState.guest).toBeNull();
  expect(localState.session).toBeFalsy();
});
