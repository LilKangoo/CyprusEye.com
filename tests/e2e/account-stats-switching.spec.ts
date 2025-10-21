import { expect, test } from '@playwright/test';
import { enableSupabaseStub, resetSupabaseStub, waitForSupabaseStub } from './utils/supabase';

test.beforeEach(async ({ page }) => {
  await enableSupabaseStub(page);
});

test.afterEach(async ({ page }) => {
  await resetSupabaseStub(page);
});

test('account stats refresh when switching between guest and authenticated sessions', async ({ page }) => {
  const guestProgress = {
    xp: 15,
    badges: [],
    visited: [],
    tasksCompleted: [],
    reviewRewards: {},
    dailyStreak: { current: 1, best: 2, lastCompletedDate: null },
    dailyChallenge: { placeId: null, assignedAt: null, completedAt: null, completedOn: null },
  };

  const accountProgress = {
    xp: 275,
    badges: [
      {
        id: 'tester-badge',
        name: 'Tester badge',
        description: 'Generated for automated test validation.',
      },
    ],
    visited: ['kato-pafos-archaeological-park', 'aphrodite-rock'],
    tasksCompleted: ['automated-check'],
    reviewRewards: {},
    dailyStreak: { current: 4, best: 7, lastCompletedDate: '2024-06-01' },
    dailyChallenge: { placeId: null, assignedAt: null, completedAt: null, completedOn: null },
  };

  const accountsStorage = {
    'supabase:mock-user-id': {
      username: 'QA Account',
      passwordHash: '',
      progress: accountProgress,
    },
  };

  await page.addInitScript((guest, accounts) => {
    window.localStorage.setItem('wakacjecypr-progress', JSON.stringify(guest));
    window.localStorage.setItem('wakacjecypr-accounts', JSON.stringify(accounts));
  }, guestProgress, accountsStorage);

  await page.goto('/index.html');
  await page.waitForFunction(() => document.readyState === 'complete');
  await waitForSupabaseStub(page);
  await page.waitForFunction(() => document.documentElement.dataset.authState === 'guest');

  await expect(page.locator('#accountStatXp')).toHaveText('15 XP');
  await expect(page.locator('#accountStatVisited')).toHaveText('0');
  await expect(page.evaluate(() => document.documentElement.dataset.accountStatsSource)).resolves.toBe('guest');

  await page.evaluate(async () => {
    await (window as any).CE_AUTH.supabase.auth.signInWithPassword({
      email: 'qa@example.com',
      password: 'super-secret',
    });
  });

  await page.waitForFunction(() => document.documentElement.dataset.authState === 'authenticated');
  await expect(page.locator('#accountStatXp')).toHaveText('275 XP');
  await expect(page.locator('#accountStatVisited')).toHaveText('2');
  await expect(page.evaluate(() => document.documentElement.dataset.accountStatsSource)).resolves.toBe('account');

  await page.evaluate(async () => {
    await (window as any).CE_AUTH.supabase.auth.signOut();
  });

  await page.waitForFunction(() => document.documentElement.dataset.authState === 'guest');
  await expect(page.locator('#accountStatXp')).toHaveText('15 XP');
  await expect(page.locator('#accountStatVisited')).toHaveText('0');
  await expect(page.evaluate(() => document.documentElement.dataset.accountStatsSource)).resolves.toBe('guest');
});
