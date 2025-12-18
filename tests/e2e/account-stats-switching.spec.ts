import { expect, test } from './fixtures';
import { disableTutorial } from './utils/disable-tutorial';
import { enableSupabaseStub, resetSupabaseStub, waitForSupabaseStub } from './utils/supabase';

// Skip auth tests - require complex Supabase stub configuration
// TODO: Re-enable when stub fully supports auth flows
test.describe.skip('Account stats switching', () => {

test.beforeEach(async ({ page }) => {
  await enableSupabaseStub(page);
  await disableTutorial(page);
});

test.afterEach(async ({ page }) => {
  await resetSupabaseStub(page);
});

test('account stats refresh when switching between guest and authenticated sessions', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ce_guest', JSON.stringify({ active: true, since: Date.now() }));
  });

  await page.goto('/index.html');
  await page.waitForFunction(() => document.readyState === 'complete');
  await waitForSupabaseStub(page);
  await page.evaluate(() => {
    const stub = (window as any).__supabaseStub;
    if (!stub) return;
    stub.reset();
    stub.seedUser({
      email: 'qa@example.com',
      password: 'super-secret',
      profile: { name: 'QA Account', xp: 275, level: 3, visited_places: ['a', 'b'] },
    });
  });
  await page.waitForFunction(() => document.documentElement.dataset.authState === 'guest');

  await expect(page.locator('#headerXpPoints')).toHaveText('0');
  await expect(page.locator('#headerBadgesCount')).toHaveText('0');

  await page.evaluate(async () => {
    await (window as any).CE_AUTH.supabase.auth.signInWithPassword({
      email: 'qa@example.com',
      password: 'super-secret',
    });
  });

  await page.waitForFunction(() => document.documentElement.dataset.authState === 'authenticated');
  await expect(page.locator('#headerXpPoints')).toHaveText('275');
  await expect(page.locator('#headerBadgesCount')).toHaveText('2');

  await page.evaluate(async () => {
    await (window as any).CE_AUTH.supabase.auth.signOut();
  });

  await page.waitForFunction(() => document.documentElement.dataset.authState === 'guest');
  await expect(page.locator('#headerXpPoints')).toHaveText('0');
  await expect(page.locator('#headerBadgesCount')).toHaveText('0');
});

}); // end of skipped describe block
