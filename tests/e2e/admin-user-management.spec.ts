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

        stub.seedTable('admin_users_overview', [
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
        stub.seedTable('partners', []);
        stub.seedTable('affiliate_referrals', []);
      },
    };
  }, { adminId: ADMIN_ID });

  await enableSupabaseStub(page);
  return locationErrors;
}

test.describe('Admin User Management', () => {
  test('opens user details for empty and transport-booking users without location label crashes', async ({ page }) => {
    const locationErrors = await prepareUserManagementStub(page);

    await page.goto('/admin/dashboard.html');
    await waitForSupabaseStub(page);

    await page.click('button.admin-nav-item[data-view="users"]');
    await page.waitForSelector('#viewUsers.active');
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
});
