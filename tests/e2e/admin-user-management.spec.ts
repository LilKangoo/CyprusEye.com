import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';

async function prepareUserManagementStub(page: Page) {
  const locationErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (String(error?.message || '').includes('locationLabelById')) {
      locationErrors.push(String(error.message));
    }
  });
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('locationLabelById')) {
      locationErrors.push(text);
    }
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('seenTutorial', 'true');
    window.localStorage.setItem('ce_lang_selected', 'true');
    window.localStorage.setItem('ce_lang', 'en');
  });

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

        stub.seedUser({
          email: 'fresh-user@example.com',
          password: 'super-secret',
          profile: {
            id: 'user-fresh',
            email: 'fresh-user@example.com',
            name: '',
            username: '',
            xp: 0,
            level: 1,
          },
        });

        stub.seedUser({
          email: 'transport-user@example.com',
          password: 'super-secret',
          profile: {
            id: 'user-transport',
            email: 'transport-user@example.com',
            name: 'Transport Customer',
            username: 'transportcustomer',
            xp: 25,
            level: 2,
          },
        });

        stub.setSession({
          id: adminId,
          email: 'lilkangoomedia@gmail.com',
          user_metadata: { username: 'cyadmin' },
        });

        const matchRows = Array.from({ length: 24 }, (_, index) => {
          const number = index + 1;
          return {
            id: `user-match-${number}`,
            email: `matchpage${String(number).padStart(2, '0')}@example.com`,
            name: `Match Page ${number}`,
            username: `matchpage${String(number).padStart(2, '0')}`,
            created_at: `2026-06-${String(28 - index).padStart(2, '0')}T09:00:00.000Z`,
            xp: number,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          };
        });

        stub.seedTable('admin_users_overview', [
          {
            id: adminId,
            email: 'lilkangoomedia@gmail.com',
            name: 'CyprusEye Admin',
            username: 'cyadmin',
            created_at: '2026-07-01T12:00:00.000Z',
            xp: 100,
            level: 5,
            is_admin: true,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-transport',
            email: 'transport-user@example.com',
            name: 'Transport Customer',
            username: 'transportcustomer',
            created_at: '2026-07-03T12:00:00.000Z',
            xp: 25,
            level: 2,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-fresh',
            email: 'fresh-user@example.com',
            name: '',
            username: '',
            created_at: '2026-07-04T12:00:00.000Z',
            xp: 0,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-banned',
            email: 'banned-user@example.com',
            name: 'Banned User',
            username: 'banneduser',
            created_at: '2026-07-02T12:00:00.000Z',
            xp: 3,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: '2099-01-01T00:00:00.000Z',
          },
          {
            id: 'user-partner',
            email: 'partner-user@example.com',
            name: 'Partner User',
            username: 'partneruser',
            created_at: '2026-07-02T11:00:00.000Z',
            xp: 12,
            level: 2,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-affiliate',
            email: 'affiliate-user@example.com',
            name: 'Affiliate User',
            username: 'affiliateuser',
            created_at: '2026-07-02T10:00:00.000Z',
            xp: 14,
            level: 2,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-newest-sort',
            email: 'newest-sort@example.com',
            name: 'Newest Sort',
            username: 'newestsort',
            created_at: '2026-07-05T12:00:00.000Z',
            xp: 8,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-oldest-sort',
            email: 'oldest-sort@example.com',
            name: 'Oldest Sort',
            username: 'oldestsort',
            created_at: '2026-01-01T12:00:00.000Z',
            xp: 7,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-score-high',
            email: 'score-high@example.com',
            name: 'Score Target High',
            username: 'scoretargethigh',
            created_at: '2026-06-01T12:00:00.000Z',
            xp: 999,
            level: 4,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-score-low',
            email: 'score-low@example.com',
            name: 'Score Target Low',
            username: 'scoretargetlow',
            created_at: '2026-06-02T12:00:00.000Z',
            xp: 1,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-rank-high',
            email: 'rank-high@example.com',
            name: 'Rank Target High',
            username: 'ranktargethigh',
            created_at: '2026-06-03T12:00:00.000Z',
            xp: 20,
            level: 12,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-rank-low',
            email: 'rank-low@example.com',
            name: 'Rank Target Low',
            username: 'ranktargetlow',
            created_at: '2026-06-04T12:00:00.000Z',
            xp: 20,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-asort',
            email: 'middle-sortname@example.com',
            name: 'Sort Name Alpha',
            username: 'asortname',
            created_at: '2026-06-05T12:00:00.000Z',
            xp: 5,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-zsort',
            email: 'middle-z-sortname@example.com',
            name: 'Sort Name Zulu',
            username: 'zsortname',
            created_at: '2026-06-06T12:00:00.000Z',
            xp: 5,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-email-a',
            email: 'a-emailsort@example.com',
            name: 'Email Sort A',
            username: 'emailsortz',
            created_at: '2026-06-07T12:00:00.000Z',
            xp: 6,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          {
            id: 'user-email-z',
            email: 'z-emailsort@example.com',
            name: 'Email Sort Z',
            username: 'emailsorta',
            created_at: '2026-06-08T12:00:00.000Z',
            xp: 6,
            level: 1,
            is_admin: false,
            is_moderator: false,
            banned_until: null,
          },
          ...matchRows,
        ]);

        stub.seedTable('transport_bookings', [
          {
            id: 'transport-booking-1',
            route_id: 'route-lca-aya',
            origin_location_id: 'loc-lca',
            destination_location_id: 'loc-aya',
            created_at: '2026-07-04T08:30:00.000Z',
            customer_name: 'Transport Customer',
            customer_email: 'transport-user@example.com',
            customer_phone: '+357 99000000',
            travel_date: '2026-07-12',
            travel_time: '10:15:00',
            status: 'confirmed',
            payment_status: 'paid',
            total_price: 65,
            currency: 'EUR',
          },
        ]);

        stub.seedTable('transport_routes', [
          {
            id: 'route-lca-aya',
            origin_location_id: 'loc-lca',
            destination_location_id: 'loc-aya',
          },
        ]);

        stub.seedTable('transport_locations', [
          { id: 'loc-lca', name: 'Larnaca Airport', name_local: 'Larnaca Airport', code: 'lca' },
          { id: 'loc-aya', name: 'Ayia Napa', name_local: 'Ayia Napa', code: 'aya' },
        ]);

        stub.seedTable('shop_addresses', []);
        stub.seedTable('shop_orders', []);
        stub.seedTable('shop_refunds', []);
        stub.seedTable('car_bookings', []);
        stub.seedTable('trip_bookings', []);
        stub.seedTable('hotel_bookings', []);
        stub.seedTable('service_deposit_requests', []);
        stub.seedTable('affiliate_commission_events', []);
        stub.seedTable('partners', [
          { id: 'partner-standard', name: 'Standard Partner', slug: 'standard-partner', affiliate_enabled: false },
          { id: 'partner-affiliate', name: 'Affiliate Partner', slug: 'affiliate-partner', affiliate_enabled: true },
        ]);
        stub.seedTable('partner_users', [
          { id: 'partner-user-membership', partner_id: 'partner-standard', user_id: 'user-partner', role: 'owner' },
          { id: 'affiliate-user-membership', partner_id: 'partner-affiliate', user_id: 'user-affiliate', role: 'owner' },
        ]);
        stub.seedTable('affiliate_referrals', []);
      },
    };
  }, { adminId: ADMIN_ID });

  await enableSupabaseStub(page);
  return locationErrors;
}

async function openUsersView(page: Page) {
  await page.goto('/admin/dashboard.html');
  await waitForSupabaseStub(page);
  await page.click('button.admin-nav-item[data-view="users"]');
  await page.waitForSelector('#viewUsers.active');
}

async function searchUsers(page: Page, query: string) {
  await page.fill('#userSearch', query);
  await page.click('#btnUserSearch');
}

async function firstUserRowText(page: Page) {
  return (await page.locator('#usersTable tr').first().innerText()).replace(/\s+/g, ' ').trim();
}

async function resetUserFilters(page: Page) {
  await page.click('#btnUsersResetFilters');
  await expect(page.locator('#userSearch')).toHaveValue('');
  await expect(page.locator('#userRoleFilter')).toHaveValue('all');
  await expect(page.locator('#userStatusFilter')).toHaveValue('all');
  await expect(page.locator('#userSortFilter')).toHaveValue('newest');
}

test.describe('Admin User Management', () => {
  test('opens user details for empty and transport-booking users without location label crashes', async ({ page }) => {
    const locationErrors = await prepareUserManagementStub(page);

    await openUsersView(page);
    await expect(page.locator('#usersTable')).toContainText('fresh-user@example.com');
    await expect(page.locator('#usersTable')).toContainText('transport-user@example.com');

    await page.locator('#usersTable tr:has-text("fresh-user@example.com") button:has-text("View")').click();
    await expect(page.locator('#userDetailModal')).toBeVisible();
    await expect(page.locator('#userDetailContent')).toContainText('fresh-user@example.com');
    await expect(page.locator('#userDetailContent')).toContainText('No bookings found.');

    await page.click('#btnCloseUserModal');
    await expect(page.locator('#userDetailModal')).toBeHidden();

    await page.locator('#usersTable tr:has-text("transport-user@example.com") button:has-text("View")').click();
    await expect(page.locator('#userDetailModal')).toBeVisible();
    await expect(page.locator('#userDetailContent')).toContainText('transport-user@example.com');
    await expect(page.locator('#userDetailContent')).toContainText('Larnaca Airport → Ayia Napa');
    await expect(page.locator('#userDetailContent')).toContainText('€65.00');
    expect(locationErrors).toEqual([]);
  });

  test('filters, sorts, paginates search results, resets, and keeps View working', async ({ page }) => {
    const locationErrors = await prepareUserManagementStub(page);
    await openUsersView(page);

    await searchUsers(page, 'matchpage');
    await expect(page.locator('#usersResultsSummary')).toContainText('Showing 1-20 of 24');
    await expect(page.locator('#usersPaginationInfo')).toContainText('Page 1 of 2');
    await page.click('#btnUsersNext');
    await expect(page.locator('#usersPaginationInfo')).toContainText('Page 2 of 2');

    await resetUserFilters(page);
    await page.selectOption('#userRoleFilter', 'admins');
    await expect(page.locator('#usersTable')).toContainText('lilkangoomedia@gmail.com');
    await expect(page.locator('#usersTable')).not.toContainText('fresh-user@example.com');

    await page.selectOption('#userRoleFilter', 'partners');
    await expect(page.locator('#usersTable')).toContainText('partner-user@example.com');
    await expect(page.locator('#usersTable')).toContainText('affiliate-user@example.com');

    await page.selectOption('#userRoleFilter', 'affiliates');
    await expect(page.locator('#usersTable')).toContainText('affiliate-user@example.com');
    await expect(page.locator('#usersTable')).not.toContainText('partner-user@example.com');

    await searchUsers(page, 'partner-user@example.com');
    await page.selectOption('#userRoleFilter', 'users');
    await expect(page.locator('#usersTable')).toContainText('No users found.');
    await expect(page.locator('#usersPaginationInfo')).toContainText('No results');

    await resetUserFilters(page);
    await page.selectOption('#userStatusFilter', 'banned');
    await expect(page.locator('#usersTable')).toContainText('banned-user@example.com');
    await expect(page.locator('#usersTable')).not.toContainText('fresh-user@example.com');
    await page.selectOption('#userStatusFilter', 'active');
    await expect(page.locator('#usersTable')).toContainText('fresh-user@example.com');
    await expect(page.locator('#usersTable')).not.toContainText('banned-user@example.com');

    await resetUserFilters(page);
    await searchUsers(page, '-sort@example.com');
    await page.selectOption('#userSortFilter', 'newest');
    await expect.poll(() => firstUserRowText(page)).toContain('newest-sort@example.com');
    await page.selectOption('#userSortFilter', 'oldest');
    await expect.poll(() => firstUserRowText(page)).toContain('oldest-sort@example.com');

    await searchUsers(page, 'scoretarget');
    await page.selectOption('#userSortFilter', 'xp_desc');
    await expect.poll(() => firstUserRowText(page)).toContain('score-high@example.com');
    await page.selectOption('#userSortFilter', 'xp_asc');
    await expect.poll(() => firstUserRowText(page)).toContain('score-low@example.com');

    await searchUsers(page, 'ranktarget');
    await page.selectOption('#userSortFilter', 'level_desc');
    await expect.poll(() => firstUserRowText(page)).toContain('rank-high@example.com');
    await page.selectOption('#userSortFilter', 'level_asc');
    await expect.poll(() => firstUserRowText(page)).toContain('rank-low@example.com');

    await searchUsers(page, 'sortname');
    await page.selectOption('#userSortFilter', 'username_asc');
    await expect.poll(() => firstUserRowText(page)).toContain('asortname');

    await searchUsers(page, 'emailsort');
    await page.selectOption('#userSortFilter', 'email_asc');
    await expect.poll(() => firstUserRowText(page)).toContain('a-emailsort@example.com');

    await searchUsers(page, 'definitely-no-user-here');
    await expect(page.locator('#usersTable')).toContainText('No users found.');
    await expect(page.locator('#usersResultsSummary')).toContainText('Results: 0');

    await resetUserFilters(page);
    await searchUsers(page, 'fresh-user@example.com');
    await page.locator('#usersTable tr:has-text("fresh-user@example.com") button:has-text("View")').click();
    await expect(page.locator('#userDetailModal')).toBeVisible();
    await expect(page.locator('#userDetailContent')).toContainText('fresh-user@example.com');
    await page.click('#btnCloseUserModal');

    await searchUsers(page, 'transport-user@example.com');
    await page.locator('#usersTable tr:has-text("transport-user@example.com") button:has-text("View")').click();
    await expect(page.locator('#userDetailModal')).toBeVisible();
    await expect(page.locator('#userDetailContent')).toContainText('Larnaca Airport → Ayia Napa');
    expect(locationErrors).toEqual([]);
  });

  test('keeps View usable in User Management on mobile viewport', async ({ page }) => {
    const locationErrors = await prepareUserManagementStub(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/admin/dashboard.html');
    await waitForSupabaseStub(page);

    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('button.admin-nav-item[data-view="users"]')?.click();
    });
    await page.waitForSelector('#viewUsers.active');
    await expect(page.locator('#usersTable')).toContainText('fresh-user@example.com');

    const viewButton = page.locator('#usersTable tr:has-text("fresh-user@example.com") button:has-text("View")');
    await viewButton.scrollIntoViewIfNeeded();
    await viewButton.click();
    await expect(page.locator('#userDetailModal')).toBeVisible();
    await expect(page.locator('#userDetailContent')).toContainText('fresh-user@example.com');
    await expect(page.locator('#userDetailContent')).toContainText('No bookings found.');
    expect(locationErrors).toEqual([]);
  });

  test('opens and closes mobile filters panel', async ({ page }) => {
    await prepareUserManagementStub(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/admin/dashboard.html');
    await waitForSupabaseStub(page);

    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('button.admin-nav-item[data-view="users"]')?.click();
    });
    await page.waitForSelector('#viewUsers.active');

    await expect(page.locator('#usersFilterPanel')).toBeHidden();
    await page.click('#btnUsersFiltersToggle');
    await expect(page.locator('#usersFilterPanel')).toBeVisible();
    await page.click('#btnUsersFiltersToggle');
    await expect(page.locator('#usersFilterPanel')).toBeHidden();
  });
});
