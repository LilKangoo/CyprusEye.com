import { expect, Page, test } from '@playwright/test';
import { disableTutorial } from './utils/disable-tutorial';
import { enableSupabaseStub, resetSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const TEST_USER = {
  email: 'michael@example.com',
  password: 'super-secret-password',
  name: 'Michael',
};

async function seedAuthenticatedUser(page: Page) {
  await waitForSupabaseStub(page);
  await page.evaluate(({ email, password, name }) => {
    const stub = (window as any).__supabaseStub;
    stub.seedUser({
      email,
      password,
      profile: { id: 'test-user-id', name },
    });
  }, TEST_USER);

  await page.waitForFunction(() => (window as any).CE_AUTH?.supabase?.auth?.signInWithPassword);
  await page.evaluate(async ({ email, password }) => {
    await (window as any).CE_AUTH.supabase.auth.signInWithPassword({ email, password });
  }, TEST_USER);

  await page.waitForFunction(() => document.documentElement.dataset.authState === 'authenticated');
}

test.beforeEach(async ({ page }) => {
  await enableSupabaseStub(page);
  await disableTutorial(page);
});

test.afterEach(async ({ page }) => {
  await resetSupabaseStub(page);
});

test('continue adventure CTA redirects home and keeps the session across pages', async ({ page }) => {
  await page.goto('/auth/index.html');
  await seedAuthenticatedUser(page);

  await page.waitForSelector('[data-auth-confirmation] [data-auth-confirmation-link]', {
    state: 'visible',
  });

  await Promise.all([
    page.waitForNavigation(),
    page.click('[data-auth-confirmation] [data-auth-confirmation-link]'),
  ]);

  const currentUrl = new URL(page.url());
  expect(['/', '/index.html']).toContain(currentUrl.pathname);

  await waitForSupabaseStub(page);
  await page.waitForFunction(() => document.documentElement.dataset.authState === 'authenticated');
  await expect(page.locator('[data-auth=user-name]').first()).toContainText(TEST_USER.name);

  await page.goto('/tasks.html');
  await waitForSupabaseStub(page);
  await page.waitForFunction(() => document.documentElement.dataset.authState === 'authenticated');
  await expect(page.locator('[data-auth=user-name]').first()).toContainText(TEST_USER.name);
});
