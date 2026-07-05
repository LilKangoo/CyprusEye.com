import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const OFFER_ID = '4c38a187-8a68-4eb0-9b46-1cd923e06d31';
const ACTIVE_OFFER_ID = '5b2a50bd-3d34-4513-9288-9eb85ef24619';

async function prepareAdminSpecialOffersCrudStub(page: Page) {
  await page.addInitScript(({ adminId, offerId, activeOfferId }) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const adminProfile = {
          id: adminId,
          email: 'lilkangoomedia@gmail.com',
          name: 'CyprusEye Admin',
          username: 'cyadmin',
          is_admin: true,
          xp: 100,
          level: 5,
        };

        stub.seedUser({
          email: 'lilkangoomedia@gmail.com',
          password: 'super-secret',
          profile: adminProfile,
        });
        stub.setSession({ id: adminId, email: 'lilkangoomedia@gmail.com', user_metadata: { username: 'cyadmin' } });
        stub.seedTable('profiles', [adminProfile]);
        stub.seedTable('admin_users_overview', [{ ...adminProfile, created_at: '2026-07-01T12:00:00.000Z', updated_at: '2026-07-01T12:00:00.000Z', banned_until: null }]);
        stub.seedTable('admin_system_diagnostics', [{ metric: 'total_users', value: 1, description: 'Total users' }]);

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
            requires_login: true,
            requires_form: true,
            requires_manual_approval: true,
            allow_multiple_entries: false,
            max_entries_per_user: 1,
            allow_bonus_points: true,
            exclude_admins: true,
            exclude_partners: false,
            public_winner_display: false,
            response_deadline_days: 7,
            settings_json: { partner: '7 Kamares', organizers: ['LilKangooMedia LTD'] },
          },
          {
            id: activeOfferId,
            slug: 'published-sample-2026',
            type: 'giveaway',
            winner_selection_mode: 'none',
            status: 'active',
            visibility: 'public',
            timezone: 'Asia/Nicosia',
            settings_json: {},
          },
        ]);

        stub.seedTable('special_offer_translations', [
          {
            id: 'translation-pl',
            offer_id: offerId,
            lang: 'pl',
            title: 'Wygraj 3 dni w Lefkarze + auto na 3 dni',
            short_description: 'Konkurs z pobytem w 7 Kamares oraz autem na 3 dni.',
            full_description: 'Polski opis kampanii Lefkara.',
            prize_description: '3 dni / 2 noce w 7 Kamares.',
            rules_html: '<p>Regulamin konkursu Lefkara.</p>',
            faq_json: [{ question: 'Kto może wziąć udział?', answer: 'Zalogowani użytkownicy.' }],
            seo_title: 'Konkurs Lefkara 2026',
            seo_description: 'Wygraj pobyt w Lefkarze.',
          },
          {
            id: 'translation-en',
            offer_id: offerId,
            lang: 'en',
            title: 'Win 3 days in Lefkara + a car for 3 days',
            short_description: 'A giveaway with a stay at 7 Kamares and a car for 3 days.',
            full_description: 'Spend three days in Lefkara.',
            prize_description: '3 days / 2 nights at 7 Kamares.',
            rules_html: '<p>Read the campaign rules.</p>',
            faq_json: [{ question: 'Is the car included?', answer: 'Yes.' }],
            seo_title: 'Lefkara giveaway 2026',
            seo_description: 'Win a Lefkara stay.',
          },
          {
            id: 'translation-he',
            offer_id: offerId,
            lang: 'he',
            title: 'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים',
            short_description: 'הגרלה עם שהייה ורכב.',
            full_description: 'שהייה בלפקרה עם רכב.',
            prize_description: '3 ימים / 2 לילות.',
            rules_html: '<p>קראו את הכללים.</p>',
            faq_json: [{ question: 'האם הרכב כלול?', answer: 'כן.' }],
            seo_title: 'הגרלת לפקרה',
            seo_description: 'זכו בשהייה.',
          },
          {
            id: 'translation-active-pl',
            offer_id: activeOfferId,
            lang: 'pl',
            title: 'Published sample',
            faq_json: [],
          },
        ]);

        stub.seedTable('special_offer_prizes', [
          {
            id: 'prize-1',
            offer_id: offerId,
            name: '3 dni / 2 noce w 7 Kamares + auto na 3 dni',
            description: 'Dla 1 zwycięzcy.',
            sponsor_name: '7 Kamares',
            quantity: 1,
            currency: 'EUR',
            sort_order: 0,
          },
        ]);

        stub.seedTable('special_offer_links', [
          { id: 'link-cars', offer_id: offerId, link_type: 'cars', resource_id: null, url: '/car.html?lang=pl', label: 'Auta na Cyprze', is_primary: false, sort_order: 10 },
          { id: 'link-custom', offer_id: offerId, link_type: 'custom', resource_id: null, url: '/special-offers/lefkara-giveaway-2026?lang=pl', label: 'Kampania Lefkara 2026', is_primary: true, sort_order: 0 },
        ]);
        stub.seedTable('special_offer_audit_log', []);
      },
    };
  }, { adminId: ADMIN_ID, offerId: OFFER_ID, activeOfferId: ACTIVE_OFFER_ID });
}

async function openSpecialOffers(page: Page) {
  await prepareAdminSpecialOffersCrudStub(page);
  await page.goto('/admin/dashboard.html');
  await waitForSupabaseStub(page);
  await expect(page.locator('#adminContainer')).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 800) {
    await page.click('#adminMenuToggle');
  }
  await page.click('button.admin-nav-item[data-view="specialOffers"]');
  await expect(page.locator('#viewSpecialOffers')).toBeVisible();
}

async function openEditorForLefkara(page: Page) {
  const card = page.locator('.special-offer-campaign-card').filter({ hasText: 'Wygraj 3 dni w Lefkarze' });
  await card.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#specialOffersEditorModal')).toBeVisible();
}

test.describe('Admin Special Offers CRUD draft/private', () => {
  test('creates a draft/private campaign and writes audit log only through allowed Special Offers tables', async ({ page }) => {
    await openSpecialOffers(page);

    await page.getByRole('button', { name: 'Create campaign' }).first().click();
    const editor = page.locator('#specialOffersEditorModal');
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeDisabled();

    await editor.locator('[name="slug"]').fill('summer-family-giveaway-2026');
    await editor.getByRole('button', { name: 'Content PL / EN / HE' }).click();
    await editor.locator('[name="pl_title"]').fill('Wygraj rodzinny weekend na Cyprze');
    await editor.getByRole('button', { name: 'Prize' }).click();
    await editor.locator('[data-prize-field="name"]').fill('Rodzinny weekend');
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save draft' }).click();

    await expect(editor).toBeHidden();
    const card = page.locator('.special-offer-campaign-card').filter({ hasText: 'Wygraj rodzinny weekend na Cyprze' });
    await expect(card).toBeVisible();

    const rows = await page.evaluate(() => ({
      offers: (window as any).__supabaseStub.getTableRows('special_offers'),
      translations: (window as any).__supabaseStub.getTableRows('special_offer_translations'),
      prizes: (window as any).__supabaseStub.getTableRows('special_offer_prizes'),
      links: (window as any).__supabaseStub.getTableRows('special_offer_links'),
      audit: (window as any).__supabaseStub.getTableRows('special_offer_audit_log'),
      forbidden: [
        'special_offer_entries',
        'special_offer_tasks',
        'special_offer_entry_tasks',
        'special_offer_draws',
        'special_offer_draw_entries',
        'special_offer_winners',
      ].map((table) => [table, (window as any).__supabaseStub.getTableRows(table).length]),
    }));

    const created = rows.offers.find((row: any) => row.slug === 'summer-family-giveaway-2026');
    expect(created.status).toBe('draft');
    expect(created.visibility).toBe('private');
    expect(rows.translations.some((row: any) => row.offer_id === created.id && row.lang === 'pl')).toBe(true);
    expect(rows.prizes.some((row: any) => row.offer_id === created.id && row.name === 'Rodzinny weekend')).toBe(true);
    expect(rows.links.filter((row: any) => row.offer_id === created.id)).toHaveLength(0);
    expect(rows.audit.some((row: any) => row.action === 'special_offer.created' && row.offer_id === created.id)).toBe(true);
    expect(rows.forbidden.every((entry: any[]) => entry[1] === 0)).toBe(true);
  });

  test('edits PL/EN/HE content and keeps HE fields RTL', async ({ page }) => {
    await openSpecialOffers(page);
    await openEditorForLefkara(page);

    const editor = page.locator('#specialOffersEditorModal');
    await expect(editor.getByRole('button', { name: 'PL' })).toBeVisible();
    await expect(editor.getByRole('button', { name: 'EN' })).toBeVisible();
    await expect(editor.getByRole('button', { name: 'HE' })).toBeVisible();

    await editor.getByRole('button', { name: 'Content PL / EN / HE' }).click();
    await editor.getByRole('button', { name: 'EN', exact: true }).click();
    await editor.locator('[name="en_short_description"]').fill('Updated English short description.');
    await editor.getByRole('button', { name: 'HE', exact: true }).click();
    await expect(editor.locator('[name="he_title"]')).toHaveAttribute('dir', 'rtl');
    await editor.locator('[name="he_short_description"]').fill('תיאור עברי מעודכן.');
    await editor.getByRole('button', { name: 'Save draft' }).click();
    await expect(editor).toBeHidden();

    const rows = await page.evaluate(() => ({
      translations: (window as any).__supabaseStub.getTableRows('special_offer_translations'),
      audit: (window as any).__supabaseStub.getTableRows('special_offer_audit_log'),
    }));
    expect(rows.translations.find((row: any) => row.offer_id === OFFER_ID && row.lang === 'en').short_description).toBe('Updated English short description.');
    expect(rows.translations.find((row: any) => row.offer_id === OFFER_ID && row.lang === 'he').short_description).toBe('תיאור עברי מעודכן.');
    expect(rows.audit.some((row: any) => row.action === 'special_offer.updated' && row.offer_id === OFFER_ID)).toBe(true);
  });

  test('adds/removes prizes and URL-only linked services with validation', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openSpecialOffers(page);
    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');

    await editor.getByRole('button', { name: 'Prize' }).click();
    await editor.getByRole('button', { name: 'Add prize' }).click();
    const secondPrize = editor.locator('[data-special-offers-prize]').last();
    await secondPrize.locator('[data-prize-field="name"]').fill('Bonus voucher');
    await secondPrize.locator('[data-prize-field="quantity"]').fill('0');
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await secondPrize.locator('[data-prize-field="quantity"]').fill('2');
    await editor.locator('[data-special-offers-prize]').first().getByRole('button', { name: 'Remove' }).click();

    await editor.getByRole('button', { name: 'Linked services' }).click();
    await editor.getByRole('button', { name: 'Add URL-only link' }).click();
    const newLink = editor.locator('[data-special-offers-link]').last();
    await newLink.locator('[data-link-field="link_type"]').selectOption('cars');
    await newLink.locator('[data-link-field="label"]').fill('Cars offer');
    await newLink.locator('[data-link-field="url"]').fill('/car.html?lang=pl');
    await newLink.locator('[data-link-field="is_primary"]').check();
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await newLink.locator('[data-link-field="is_primary"]').uncheck();
    await editor.locator('[data-special-offers-link]').nth(1).getByRole('button', { name: 'Remove' }).click();
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save draft' }).click();
    await expect(editor).toBeHidden();

    const rows = await page.evaluate(() => ({
      prizes: (window as any).__supabaseStub.getTableRows('special_offer_prizes'),
      links: (window as any).__supabaseStub.getTableRows('special_offer_links'),
    }));
    const prizes = rows.prizes.filter((row: any) => row.offer_id === OFFER_ID);
    const links = rows.links.filter((row: any) => row.offer_id === OFFER_ID);
    expect(prizes.some((row: any) => row.name === 'Bonus voucher' && row.quantity === 2)).toBe(true);
    expect(prizes.some((row: any) => row.id === 'prize-1')).toBe(false);
    expect(links.some((row: any) => row.id === 'link-cars')).toBe(false);
    expect(links.some((row: any) => row.label === 'Cars offer' && row.resource_id === null)).toBe(true);
    expect(links.filter((row: any) => row.is_primary)).toHaveLength(1);
  });

  test('archives without hard delete and disables edit for non-draft/non-private campaigns', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openSpecialOffers(page);

    const activeCard = page.locator('.special-offer-campaign-card').filter({ hasText: 'Published sample' });
    await expect(activeCard.getByRole('button', { name: 'Edit' })).toBeDisabled();

    await openEditorForLefkara(page);
    await page.locator('#specialOffersEditorArchive').click();
    await expect(page.locator('#specialOffersEditorModal')).toBeHidden();

    const rows = await page.evaluate(() => ({
      offers: (window as any).__supabaseStub.getTableRows('special_offers'),
      audit: (window as any).__supabaseStub.getTableRows('special_offer_audit_log'),
    }));
    const archived = rows.offers.find((row: any) => row.id === OFFER_ID);
    expect(archived.status).toBe('archived');
    expect(archived.visibility).toBe('private');
    expect(archived.archived_at).toBeTruthy();
    expect(rows.offers.some((row: any) => row.id === OFFER_ID)).toBe(true);
    expect(rows.audit.some((row: any) => row.action === 'special_offer.archived' && row.offer_id === OFFER_ID)).toBe(true);
  });

  test('keeps editor usable on mobile without horizontal overflow and avoids forbidden module references', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSpecialOffers(page);
    await page.getByRole('button', { name: 'Create campaign' }).first().click();
    await expect(page.locator('#specialOffersEditorModal')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);

    const source = await page.evaluate(async () => (await fetch('/admin/special-offers.js')).text());
    expect(source).not.toContain('special_offer_entries');
    expect(source).not.toContain('special_offer_tasks');
    expect(source).not.toContain('special_offer_entry_tasks');
    expect(source).not.toContain('special_offer_draws');
    expect(source).not.toContain('special_offer_draw_entries');
    expect(source).not.toContain('special_offer_winners');
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/\.storage\b/);
  });
});
