import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';

async function prepareAdminShellStub(page: Page) {
  await page.addInitScript(({ adminId }) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        stub.seedUser({
          email: 'lilkangoomedia@gmail.com',
          password: 'super-secret',
          profile: {
            id: adminId,
            email: 'lilkangoomedia@gmail.com',
            name: 'CyprusEye Admin',
            username: 'cyadmin',
            is_admin: true,
            xp: 100,
            level: 5,
          },
        });

        stub.setSession({
          id: adminId,
          email: 'lilkangoomedia@gmail.com',
          user_metadata: { username: 'cyadmin' },
        });

        stub.seedTable('profiles', [
          {
            id: adminId,
            email: 'lilkangoomedia@gmail.com',
            name: 'CyprusEye Admin',
            username: 'cyadmin',
            is_admin: true,
            xp: 100,
            level: 5,
          },
        ]);

        stub.seedTable('admin_users_overview', [
          {
            id: adminId,
            email: 'lilkangoomedia@gmail.com',
            name: 'CyprusEye Admin',
            username: 'cyadmin',
            created_at: '2026-07-01T12:00:00.000Z',
            updated_at: '2026-07-01T12:00:00.000Z',
            xp: 100,
            level: 5,
            is_admin: true,
            is_moderator: false,
            banned_until: null,
          },
        ]);

        stub.seedTable('admin_system_diagnostics', [
          { metric: 'total_users', value: 1, description: 'Total users' },
        ]);
      },
    };
  }, { adminId: ADMIN_ID });
}

async function openAdmin(page: Page) {
  await prepareAdminShellStub(page);
  await page.goto('/admin/dashboard.html');
  await waitForSupabaseStub(page);
  await expect(page.locator('#adminContainer')).toBeVisible();
}

test.describe('Admin Special Offers shell', () => {
  test('shows Special Offers shell, placeholders, and keeps existing admin sections reachable', async ({ page }) => {
    await openAdmin(page);

    const navItem = page.locator('button.admin-nav-item[data-view="specialOffers"]');
    await expect(navItem).toBeVisible();
    await expect(navItem).toContainText('Special Offers');

    await navItem.click();
    await expect(page.locator('#viewSpecialOffers')).toBeVisible();
    await expect(page.locator('#viewSpecialOffers')).toHaveClass(/active/);
    await expect(page.locator('#viewSpecialOffers h2')).toContainText('Special Offers');
    await expect(page.locator('#viewSpecialOffers')).toContainText('Manage contests, giveaways, campaigns, linked services and prize draws.');

    await expect(page.locator('.special-offer-stat-card')).toHaveCount(4);
    await expect(page.locator('.special-offer-stat-card:has-text("Active Campaigns")')).toContainText('0');
    await expect(page.locator('.special-offer-stat-card:has-text("Drafts")')).toContainText('0');
    await expect(page.locator('.special-offer-stat-card:has-text("Entries Pending Review")')).toContainText('0');
    await expect(page.locator('.special-offer-stat-card:has-text("Winners Selected")')).toContainText('0');

    await expect(page.locator('.special-offers-empty-state')).toContainText('No special offers yet');
    await expect(page.locator('.special-offers-empty-state')).toContainText('Draft/private creation is available in this stage.');
    await expect(page.locator('.special-offers-create-button')).toBeEnabled();
    await expect(page.locator('.special-offers-create-button')).toHaveText('Create campaign');

    for (const label of [
      'Campaigns',
      'Linked Services',
      'Entries',
      'Manual Verification',
      'Draw Machine',
      'Winners',
      'Audit Log',
    ]) {
      await expect(page.locator('.special-offers-workflow')).toContainText(label);
    }

    await page.click('button.admin-nav-item[data-view="dashboard"]');
    await expect(page.locator('#viewDashboard')).toHaveClass(/active/);

    await page.click('button.admin-nav-item[data-view="users"]');
    await expect(page.locator('#viewUsers')).toHaveClass(/active/);
    await expect(page.locator('#usersTable')).toContainText('lilkangoomedia@gmail.com');

    await page.click('button.admin-nav-item[data-view="coupons"]');
    await expect(page.locator('#viewCoupons')).toHaveClass(/active/);
  });

  test('keeps Special Offers shell usable on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdmin(page);

    await page.click('#adminMenuToggle');
    await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);
    await page.click('button.admin-nav-item[data-view="specialOffers"]');

    await expect(page.locator('#viewSpecialOffers')).toBeVisible();
    await expect(page.locator('.special-offers-stats')).toBeVisible();
    await expect(page.locator('.special-offers-workflow')).toBeVisible();
    await expect(page.locator('.special-offers-create-button')).toBeEnabled();

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });
});
