import { expect, test } from '@playwright/test';
import { enableSupabaseStub, resetSupabaseStub, waitForSupabaseStub } from './utils/supabase';
import { disableTutorial } from './utils/disable-tutorial';

test.beforeEach(async ({ page }) => {
  await enableSupabaseStub(page);
  await disableTutorial(page);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    // Re-set tutorial as seen after clearing storage
    window.localStorage.setItem('seenTutorial', 'true');
  });
});

test('guest mode toggles UI and persists across reloads', async ({ page }) => {
  await page.goto('/auth/');
  await waitForSupabaseStub(page);
  await resetSupabaseStub(page);

  await page.click('#btn-guest');
  await page.waitForURL('**/');

  const guestBadge = page.locator('[data-auth="guest-only"]').first();
  await expect(guestBadge).toBeVisible();
  await expect(guestBadge).toContainText('Grasz jako gość');
  await expect(page.locator('[data-auth="login"]').first()).toBeVisible();
  await expect(page.locator('[data-auth="guest"]').first()).toBeVisible();
  await expect(page.locator('[data-auth-guest-note]')).toBeVisible();

  await page.reload();
  await expect(guestBadge).toBeVisible();
  await expect(guestBadge).toContainText('Grasz jako gość');
  await expect(page.locator('[data-auth="login"]').first()).toBeVisible();
  const guestState = await page.evaluate(() => (window as any).CE_STATE?.guest?.active ?? false);
  expect(guestState).toBe(true);

  await page.goto('/packing.html');
  const packingPanel = page.locator('.packing-panel');
  await expect(packingPanel).toBeVisible();
  await expect(page.locator('#packingChecklist')).toBeVisible();

  await page.goto('/tasks.html');
  const tasksPanel = page.locator('.tasks-panel');
  await expect(tasksPanel).toBeVisible();
  await expect(page.locator('#tasksView')).toBeVisible();
});

test('registration uses Supabase client without leaking credentials in URL', async ({ page }) => {
  await page.goto('/auth/');
  await waitForSupabaseStub(page);
  await resetSupabaseStub(page);

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
  await waitForSupabaseStub(page);
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

  const userGreeting = page.locator('#userGreeting');
  await expect(userGreeting).toBeVisible();
  await expect(userGreeting).toContainText('Zalogowano');
  await expect(page.locator('[data-auth="login"]').first()).toBeHidden();
  await expect(page.locator('[data-auth="logout"]').first()).toBeVisible();
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
  await waitForSupabaseStub(page);
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
  await expect(page.locator('[data-auth="anon-only"]').first()).toBeVisible();
  await expect(page.locator('[data-auth="anon-only"]').first()).toContainText('Nie zalogowano');

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
  await waitForSupabaseStub(page);
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

  await expect(page.locator('[data-auth="user-only"]').first()).toBeVisible();
  await expect(page.locator('[data-auth="user-only"]').first()).toContainText('Zalogowany');
  await page.click('[data-auth="logout"]');
  await page.waitForURL('**/');

  await expect(page.locator('[data-auth="anon-only"]').first()).toBeVisible();
  await expect(page.locator('[data-auth="anon-only"]').first()).toContainText('Nie zalogowano');
  await expect(page.locator('[data-auth="login"]').first()).toBeVisible();
  const localState = await page.evaluate(() => ({
    guest: window.localStorage.getItem('ce_guest'),
    session: (window as any).CE_STATE?.session ?? null,
  }));
  expect(localState.guest).toBeNull();
  expect(localState.session).toBeFalsy();
});
