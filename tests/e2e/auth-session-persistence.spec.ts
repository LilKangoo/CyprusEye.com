import { expect, test } from '@playwright/test';
import { enableSupabaseStub, resetSupabaseStub, waitForSupabaseStub } from './utils/supabase';

type StubSnapshot = {
  user: { id: string; email: string; password: string };
  profile: Record<string, unknown> | null;
  xpEvents: Array<Record<string, unknown>>;
} | null;

test.beforeEach(async ({ page }) => {
  await enableSupabaseStub(page);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('registration and login persist session across navigation until logout', async ({ page }) => {
  const credentials = {
    firstName: 'Zosia',
    email: `persist-user-${Date.now()}@example.com`,
    password: 'TrudneHaslo123',
  };

  await page.goto('/auth/');
  await waitForSupabaseStub(page);
  await resetSupabaseStub(page);

  await page.click('[data-auth-tab="register"]');
  await page.fill('#form-register input[name="firstName"]', credentials.firstName);
  await page.fill('#form-register input[name="email"]', credentials.email);
  await page.fill('#form-register input[name="password"]', credentials.password);
  await page.fill('#form-register input[name="passwordConfirm"]', credentials.password);
  await page.click('#form-register button[type="submit"]');

  const registerToast = page.locator('#authMessage');
  await expect(registerToast).toContainText('Sprawdź e-mail i potwierdź konto.');

  const snapshot = await page.evaluate<StubSnapshot>((email) => {
    const stub = (window as any).__supabaseStub;
    if (!stub) {
      return null;
    }
    const user = stub.state.users[email];
    if (!user) {
      return null;
    }
    return {
      user,
      profile: stub.state.profiles[user.id] || null,
      xpEvents: stub.state.xpEvents[user.id] || [],
    };
  }, credentials.email);

  expect(snapshot).not.toBeNull();

  await page.goto('/auth/');
  await waitForSupabaseStub(page);
  if (snapshot) {
    await page.evaluate(({ email, password, profile, xpEvents }) => {
      const stub = (window as any).__supabaseStub;
      stub.reset();
      stub.seedUser({ email, password, profile: profile || {}, xpEvents });
    }, {
      email: snapshot.user.email,
      password: snapshot.user.password,
      profile: snapshot.profile,
      xpEvents: snapshot.xpEvents,
    });
  }

  await page.fill('#form-login input[name="email"]', credentials.email);
  await page.fill('#form-login input[name="password"]', credentials.password);
  await Promise.all([
    page.waitForURL('**/'),
    page.click('#form-login button[type="submit"]'),
  ]);

  const pagesToCheck = ['/', '/tasks.html', '/packing.html', '/achievements.html', '/vip.html'];

  for (const target of pagesToCheck) {
    if (target !== '/') {
      await page.goto(target);
    }
    const greeting = page.locator('#userGreeting');
    if (await greeting.count()) {
      await expect(greeting).toBeVisible();
      await expect(greeting).toContainText('Zalogowano');
    } else {
      const badge = page.locator('[data-auth="user-only"]').first();
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('Zalogowany');
    }
    await expect(page.locator('[data-auth="login"]').first()).toBeHidden();
    await expect(page.locator('[data-auth="logout"]').first()).toBeVisible();
  }

  await Promise.all([
    page.waitForURL('**/'),
    page.click('[data-auth="logout"]'),
  ]);

  await expect(page.locator('[data-auth="anon-only"]').first()).toBeVisible();
  await expect(page.locator('[data-auth="anon-only"]').first()).toContainText('Nie zalogowano');
  await expect(page.locator('[data-auth="login"]').first()).toBeVisible();
});
