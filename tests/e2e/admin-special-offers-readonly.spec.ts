import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const OFFER_ID = '4c38a187-8a68-4eb0-9b46-1cd923e06d31';

async function prepareAdminSpecialOffersStub(page: Page) {
  await page.addInitScript(({ adminId, offerId }) => {
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
            banned_until: null,
          },
        ]);

        stub.seedTable('admin_system_diagnostics', [
          { metric: 'total_users', value: 1, description: 'Total users' },
        ]);

        stub.seedTable('special_offers', [
          {
            id: offerId,
            slug: 'lefkara-giveaway-2026',
            type: 'contest',
            winner_selection_mode: 'manual_selection',
            status: 'draft',
            visibility: 'private',
            start_at: '2026-07-14T21:00:00.000Z',
            end_at: '2026-09-15T20:59:00.000Z',
            winner_announce_at: '2026-09-20T09:00:00.000Z',
            timezone: 'Asia/Nicosia',
            settings_json: {
              partner: '7 Kamares',
              organizers: ['LilKangooMedia LTD', 'CyprusEye.com', 'WakacjeCypr.com'],
              mandatory_conditions: [
                'Observe CyprusEye.com / WakacjeCypr.com Facebook profile',
                'Observe 7 Kamares profile',
                'Share the official contest post on Facebook',
                'Register or log in on CyprusEye',
                'Submit entry form',
                'Answer contest question',
                'Accept rules',
              ],
              extra_manual_activity: [
                'Sharing more official campaign posts can increase chance',
                'Valuable comments in first 24h can increase chance',
              ],
              social_verification: {
                mode: 'manual',
                automatic_integrations: false,
              },
            },
          },
        ]);

        stub.seedTable('special_offer_translations', [
          {
            id: 'translation-pl',
            offer_id: offerId,
            lang: 'pl',
            title: 'Wygraj 3 dni w Lefkarze + auto na 3 dni',
            short_description: 'Konkurs z pobytem w 7 Kamares oraz autem na 3 dni.',
            prize_description: '3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni.',
          },
        ]);

        stub.seedTable('special_offer_prizes', [
          {
            id: 'prize-1',
            offer_id: offerId,
            name: '3 dni / 2 noce w 7 Kamares + auto na 3 dni',
            description: 'Dla 1 zwycięzcy + osoby towarzyszącej.',
            sponsor_name: '7 Kamares',
            quantity: 1,
            sort_order: 0,
          },
        ]);

        stub.seedTable('special_offer_links', [
          { id: 'link-cars', offer_id: offerId, link_type: 'cars', resource_id: null, url: '/car.html?lang=pl', label: 'Auta na Cyprze', is_primary: false, sort_order: 10 },
          { id: 'link-transport', offer_id: offerId, link_type: 'transport', resource_id: null, url: '/transport.html?lang=pl', label: 'Transport na Cyprze', is_primary: false, sort_order: 20 },
          { id: 'link-trips', offer_id: offerId, link_type: 'trips', resource_id: null, url: '/trips.html?lang=pl', label: 'Wycieczki na Cyprze', is_primary: false, sort_order: 30 },
          { id: 'link-custom', offer_id: offerId, link_type: 'custom', resource_id: null, url: '/special-offers/lefkara-giveaway-2026?lang=pl', label: 'Kampania Lefkara 2026', is_primary: true, sort_order: 0 },
        ]);
      },
    };
  }, { adminId: ADMIN_ID, offerId: OFFER_ID });
}

async function openAdmin(page: Page) {
  await prepareAdminSpecialOffersStub(page);
  await page.goto('/admin/dashboard.html');
  await waitForSupabaseStub(page);
  await expect(page.locator('#adminContainer')).toBeVisible();
}

test.describe('Admin Special Offers read-only integration', () => {
  test('loads Lefkara campaign from read-only Special Offers tables', async ({ page }) => {
    await openAdmin(page);

    await page.click('button.admin-nav-item[data-view="specialOffers"]');
    await expect(page.locator('#viewSpecialOffers')).toBeVisible();

    await expect(page.locator('#specialOffersEmptyState')).toBeHidden();
    await expect(page.locator('[data-special-offers-stat="draft"]')).toHaveText('1');
    await expect(page.locator('[data-special-offers-stat="active"]')).toHaveText('0');
    await expect(page.locator('[data-special-offers-stat="entries"]')).toHaveText('0');
    await expect(page.locator('[data-special-offers-stat="winners"]')).toHaveText('0');

    const card = page.locator('.special-offer-campaign-card').filter({ hasText: 'Wygraj 3 dni w Lefkarze + auto na 3 dni' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('lefkara-giveaway-2026');
    await expect(card).toContainText('Draft');
    await expect(card).toContainText('Private');
    await expect(card).toContainText('Contest');
    await expect(card).toContainText('Manual selection');
    await expect(card).toContainText('15.07.2026 - 15.09.2026');
    await expect(card).toContainText('20.09.2026');
    await expect(card).toContainText('1 prize');
    await expect(card).toContainText('4 linked services');
    await expect(card).toContainText('1 primary CTA');

    await expect(page.locator('.special-offers-create-button')).toBeDisabled();

    await card.getByRole('button', { name: 'View details' }).click();
    await expect(page.locator('#specialOffersDetailsModal')).toBeVisible();
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('3 dni / 2 noce w 7 Kamares + auto na 3 dni');
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('7 Kamares');
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('LilKangooMedia LTD, CyprusEye.com, WakacjeCypr.com');
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('Manual social verification');
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('No automatic social integrations');
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('Cars');
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('/car.html?lang=pl');
    await expect(page.locator('#specialOffersDetailsModal')).toContainText('URL-only');
    await expect(page.locator('#specialOffersDetailsModal').getByRole('button', { name: 'Edit campaign' })).toBeDisabled();
    await expect(page.locator('#specialOffersDetailsModal').getByRole('button', { name: 'Entries' })).toBeDisabled();
    await expect(page.locator('#specialOffersDetailsModal').getByRole('button', { name: 'Draw' })).toBeDisabled();

    await expect(page.locator('#viewSpecialOffers')).not.toContainText('undefined');
    await expect(page.locator('#viewSpecialOffers')).not.toContainText('null');
  });

  test('keeps module read-only and avoids future-stage table names', async ({ page }) => {
    await openAdmin(page);

    const source = await page.evaluate(async () => {
      const response = await fetch('/admin/special-offers.js');
      return response.text();
    });

    expect(source).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
    expect(source).not.toContain('special_offer_entries');
    expect(source).not.toContain('special_offer_tasks');
    expect(source).not.toContain('special_offer_entry_tasks');
    expect(source).not.toContain('special_offer_draws');
    expect(source).not.toContain('special_offer_draw_entries');
    expect(source).not.toContain('special_offer_winners');
  });

  test('keeps read-only campaign cards usable on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdmin(page);

    await page.click('#adminMenuToggle');
    await page.click('button.admin-nav-item[data-view="specialOffers"]');
    await expect(page.locator('.special-offer-campaign-card')).toContainText('Wygraj 3 dni w Lefkarze');

    await page.locator('.special-offer-campaign-card').getByRole('button', { name: 'View details' }).click();
    await expect(page.locator('#specialOffersDetailsModal')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });
});
