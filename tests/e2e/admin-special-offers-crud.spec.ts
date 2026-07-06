import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const OFFER_ID = '4c38a187-8a68-4eb0-9b46-1cd923e06d31';
const ACTIVE_OFFER_ID = '5b2a50bd-3d34-4513-9288-9eb85ef24619';

async function prepareAdminSpecialOffersCrudStub(page: Page, options: { selectErrorsByTable?: Record<string, string> } = {}) {
  await page.addInitScript(({ adminId, offerId, activeOfferId, selectErrorsByTable }) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        if (selectErrorsByTable) {
          stub.selectErrorsByTable = selectErrorsByTable;
        } else {
          delete stub.selectErrorsByTable;
        }

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
        stub.seedTable('special_offer_prize_translations', [
          { id: 'prize-translation-pl', prize_id: 'prize-1', lang: 'pl', name: '3 dni / 2 noce w 7 Kamares + auto na 3 dni', description: 'Polski opis nagrody.', restrictions: 'Dla osoby pełnoletniej.', fulfillment_notes: 'Sponsor: 7 Kamares.' },
          { id: 'prize-translation-en', prize_id: 'prize-1', lang: 'en', name: '3 days / 2 nights at 7 Kamares + a car for 3 days', description: 'English prize description.', restrictions: 'Adult winner only.', fulfillment_notes: 'Sponsor: 7 Kamares.' },
          { id: 'prize-translation-he', prize_id: 'prize-1', lang: 'he', name: '3 ימים / 2 לילות ב-7 Kamares + רכב ל-3 ימים', description: 'תיאור הפרס בעברית.', restrictions: 'לזוכה בגיר.', fulfillment_notes: 'נותן החסות: 7 Kamares.' },
        ]);

        stub.seedTable('special_offer_links', [
          { id: 'link-cars', offer_id: offerId, link_type: 'cars', resource_id: null, url: '/car.html?lang=pl', label: 'Auta na Cyprze', is_primary: false, sort_order: 10 },
          { id: 'link-custom', offer_id: offerId, link_type: 'custom', resource_id: null, url: '/special-offers/lefkara-giveaway-2026?lang=pl', label: 'Kampania Lefkara 2026', is_primary: true, sort_order: 0 },
        ]);
        stub.seedTable('special_offer_link_translations', [
          { id: 'link-cars-pl', link_id: 'link-cars', lang: 'pl', label: 'Auta na Cyprze', description: 'Wynajem auta na Cyprze.', url: '/car.html?lang=pl' },
          { id: 'link-cars-en', link_id: 'link-cars', lang: 'en', label: 'Cars in Cyprus', description: 'Car rental in Cyprus.', url: '/car.html?lang=en' },
          { id: 'link-cars-he', link_id: 'link-cars', lang: 'he', label: 'רכבים בקפריסין', description: 'השכרת רכב בקפריסין.', url: '/car.html?lang=he' },
          { id: 'link-custom-pl', link_id: 'link-custom', lang: 'pl', label: 'Kampania Lefkara 2026', description: 'Strona kampanii.', url: '/special-offers/lefkara-giveaway-2026?lang=pl' },
          { id: 'link-custom-en', link_id: 'link-custom', lang: 'en', label: 'Lefkara Campaign 2026', description: 'Campaign page.', url: '/special-offers/lefkara-giveaway-2026?lang=en' },
          { id: 'link-custom-he', link_id: 'link-custom', lang: 'he', label: 'קמפיין לפקרה 2026', description: 'עמוד הקמפיין.', url: '/special-offers/lefkara-giveaway-2026?lang=he' },
        ]);
        stub.seedTable('car_offers', [
          { id: 'car-offer-1', car_model: 'Toyota Yaris', car_type: 'compact', location: 'Larnaca', is_available: true },
        ]);
        stub.seedTable('trips', [
          { id: 'trip-1', slug: 'lefkara-private-trip', title: 'Lefkara private trip', start_city: 'Larnaca', status: 'published', is_published: true },
          { id: 'trip-no-slug', title: 'Trip without slug', start_city: 'Paphos', status: 'published', is_published: true },
        ]);
        stub.seedTable('hotels', [
          { id: 'hotel-1', slug: 'seven-kamares-lefkara', title: { pl: '7 Kamares', en: '7 Kamares', he: '7 Kamares' }, city: 'Lefkara', status: 'published', is_published: true },
        ]);
        stub.seedTable('transport_locations', [
          { id: 'loc-lca', name: 'Larnaca Airport', is_active: true },
          { id: 'loc-lefkara', name: 'Lefkara', is_active: true },
        ]);
        stub.seedTable('transport_routes', [
          { id: 'route-lca-lefkara', origin_location_id: 'loc-lca', destination_location_id: 'loc-lefkara', is_active: true },
        ]);
        stub.seedTable('special_offer_audit_log', []);
      },
    };
  }, { adminId: ADMIN_ID, offerId: OFFER_ID, activeOfferId: ACTIVE_OFFER_ID, selectErrorsByTable: options.selectErrorsByTable || null });
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
    await expect(editor.getByRole('button', { name: 'PL' }).first()).toBeVisible();
    await editor.locator('[data-prize-translation-field="name"][data-lang="pl"]').fill('Rodzinny weekend');
    await editor.locator('[data-prize-translation-field="description"][data-lang="pl"]').fill('Weekendowy pobyt dla rodziny.');
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save draft' }).click();

    await expect(editor).toBeHidden();
    const card = page.locator('.special-offer-campaign-card').filter({ hasText: 'Wygraj rodzinny weekend na Cyprze' });
    await expect(card).toBeVisible();

    const rows = await page.evaluate(() => ({
      offers: (window as any).__supabaseStub.getTableRows('special_offers'),
      translations: (window as any).__supabaseStub.getTableRows('special_offer_translations'),
      prizes: (window as any).__supabaseStub.getTableRows('special_offer_prizes'),
      prizeTranslations: (window as any).__supabaseStub.getTableRows('special_offer_prize_translations'),
      links: (window as any).__supabaseStub.getTableRows('special_offer_links'),
      linkTranslations: (window as any).__supabaseStub.getTableRows('special_offer_link_translations'),
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
    const createdPrize = rows.prizes.find((row: any) => row.offer_id === created.id && row.name === 'Rodzinny weekend');
    expect(rows.prizeTranslations.some((row: any) => row.prize_id === createdPrize.id && row.lang === 'pl' && row.name === 'Rodzinny weekend')).toBe(true);
    expect(rows.links.filter((row: any) => row.offer_id === created.id)).toHaveLength(0);
    expect(rows.linkTranslations.length).toBeGreaterThanOrEqual(6);
    expect(rows.audit.some((row: any) => row.action === 'special_offer.created' && row.offer_id === created.id)).toBe(true);
    expect(rows.forbidden.every((entry: any[]) => entry[1] === 0)).toBe(true);
  });

  test('edits PL/EN/HE content and keeps HE fields RTL', async ({ page }) => {
    await openSpecialOffers(page);
    await openEditorForLefkara(page);

    const editor = page.locator('#specialOffersEditorModal');
    await editor.getByRole('button', { name: 'Content PL / EN / HE' }).click();
    await expect(editor.getByRole('button', { name: 'PL', exact: true })).toBeVisible();
    await expect(editor.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
    await expect(editor.getByRole('button', { name: 'HE', exact: true })).toBeVisible();
    await expect(editor.locator('[data-faq-builder="pl"]')).toBeVisible();
    await expect(editor.locator('[name="pl_faq_json"]')).toHaveCount(0);
    await expect(editor.locator('[data-rules-builder="pl"]')).toBeVisible();
    await expect(editor.locator('[name="pl_rules_html"]')).toHaveCount(0);
    await editor.locator('[data-faq-item="pl"]').first().getByRole('button', { name: 'Remove' }).click();
    await expect(editor.locator('[data-faq-list="pl"]')).toContainText('No FAQ items yet');
    await editor.getByRole('button', { name: 'Add FAQ item' }).click();
    const faqItem = editor.locator('[data-faq-item="pl"]').last();
    await faqItem.locator('[data-faq-field="question"]').fill('Czy mogę wziąć udział?');
    await faqItem.locator('[data-faq-field="answer"]').fill('Tak, po zalogowaniu.');
    await editor.getByRole('button', { name: 'Add rule section' }).click();
    const ruleSection = editor.locator('[data-rule-section="pl"]').last();
    await ruleSection.locator('[data-rule-field="title"]').fill('Nowe zasady');
    await ruleSection.getByRole('button', { name: 'Add bullet' }).click();
    await ruleSection.locator('[data-rule-field="bullet"]').last().fill('Zgłoszenie musi być kompletne.');
    await editor.getByRole('button', { name: 'EN', exact: true }).click();
    await editor.locator('[name="en_short_description"]').fill('Updated English short description.');
    await editor.getByRole('button', { name: 'HE', exact: true }).click();
    await expect(editor.locator('[name="he_title"]')).toHaveAttribute('dir', 'rtl');
    await expect(editor.locator('[data-faq-builder="he"]')).toHaveAttribute('dir', 'rtl');
    await expect(editor.locator('[data-rules-builder="he"]')).toHaveAttribute('dir', 'rtl');
    await editor.locator('[name="he_short_description"]').fill('תיאור עברי מעודכן.');
    await editor.getByRole('button', { name: 'Save draft' }).click();
    await expect(editor).toBeHidden();

    const rows = await page.evaluate(() => ({
      translations: (window as any).__supabaseStub.getTableRows('special_offer_translations'),
      audit: (window as any).__supabaseStub.getTableRows('special_offer_audit_log'),
    }));
    expect(rows.translations.find((row: any) => row.offer_id === OFFER_ID && row.lang === 'en').short_description).toBe('Updated English short description.');
    expect(rows.translations.find((row: any) => row.offer_id === OFFER_ID && row.lang === 'he').short_description).toBe('תיאור עברי מעודכן.');
    const plTranslation = rows.translations.find((row: any) => row.offer_id === OFFER_ID && row.lang === 'pl');
    expect(plTranslation.faq_json).toEqual([{ question: 'Czy mogę wziąć udział?', answer: 'Tak, po zalogowaniu.' }]);
    expect(plTranslation.rules_html).toContain('<h3>Nowe zasady</h3>');
    expect(plTranslation.rules_html).toContain('<li>Zgłoszenie musi być kompletne.</li>');
    expect(rows.audit.some((row: any) => row.action === 'special_offer.updated' && row.offer_id === OFFER_ID)).toBe(true);
  });

  test('adds/removes prizes and URL-only linked services with validation', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openSpecialOffers(page);
    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');

    await editor.getByRole('button', { name: 'Prize' }).click();
    await expect(editor).toContainText('Prize operational details');
    await expect(editor).toContainText('Public prize text is edited below in PL/EN/HE');
    await expect(editor).toContainText('Prize translations PL / EN / HE');
    await expect(editor.locator('[data-prize-translation-field="name"][data-lang="he"]').first()).toHaveAttribute('dir', 'rtl');
    await editor.getByRole('button', { name: 'Add prize' }).click();
    const secondPrize = editor.locator('[data-special-offers-prize]').last();
    await secondPrize.locator('[data-prize-translation-field="name"][data-lang="pl"]').fill('Bonus voucher');
    await secondPrize.getByRole('button', { name: 'EN', exact: true }).click();
    await secondPrize.locator('[data-prize-translation-field="name"][data-lang="en"]').fill('Bonus voucher EN');
    await secondPrize.getByRole('button', { name: 'HE', exact: true }).click();
    await secondPrize.locator('[data-prize-translation-field="name"][data-lang="he"]').fill('שובר בונוס');
    await secondPrize.locator('[data-prize-field="quantity"]').fill('0');
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await secondPrize.locator('[data-prize-field="quantity"]').fill('2');
    await editor.locator('[data-special-offers-prize]').first().getByRole('button', { name: 'Remove' }).click();

    await editor.getByRole('button', { name: 'Linked services' }).click();
    await expect(editor).toContainText('Linked services');
    await expect(editor).toContainText('Main service page uses general service URLs');
    await expect(editor).toContainText('Link translations PL / EN / HE');
    await editor.getByRole('button', { name: 'Add link' }).click();
    const newLink = editor.locator('[data-special-offers-link]').last();
    await newLink.locator('[data-link-field="link_type"]').selectOption('cars');
    await newLink.locator('[data-link-field="mode"]').selectOption('main');
    await expect(newLink.locator('[data-link-translation-field="url"][data-lang="pl"]')).toHaveValue('/car.html?lang=pl');
    await expect(newLink.locator('[data-link-translation-field="url"][data-lang="en"]')).toHaveValue('/car.html?lang=en');
    await expect(newLink.locator('[data-link-translation-field="url"][data-lang="he"]')).toHaveValue('/car.html?lang=he');
    await expect(newLink.locator('[data-link-url-preview]')).toContainText('/car.html?lang=en');
    await expect(newLink.locator('[data-link-url-preview]')).toContainText('/car.html?lang=he');
    await newLink.locator('[data-link-field="is_primary"]').check();
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await newLink.locator('[data-link-field="is_primary"]').uncheck();
    await editor.locator('[data-special-offers-link]').nth(1).getByRole('button', { name: 'Remove' }).click();
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save draft' }).click();
    await expect(editor).toBeHidden();

    const rows = await page.evaluate(() => ({
      prizes: (window as any).__supabaseStub.getTableRows('special_offer_prizes'),
      prizeTranslations: (window as any).__supabaseStub.getTableRows('special_offer_prize_translations'),
      links: (window as any).__supabaseStub.getTableRows('special_offer_links'),
      linkTranslations: (window as any).__supabaseStub.getTableRows('special_offer_link_translations'),
    }));
    const prizes = rows.prizes.filter((row: any) => row.offer_id === OFFER_ID);
    const links = rows.links.filter((row: any) => row.offer_id === OFFER_ID);
    expect(prizes.some((row: any) => row.name === 'Bonus voucher' && row.quantity === 2)).toBe(true);
    const bonusPrize = prizes.find((row: any) => row.name === 'Bonus voucher');
    expect(rows.prizeTranslations.some((row: any) => row.prize_id === bonusPrize.id && row.lang === 'he' && row.name === 'שובר בונוס')).toBe(true);
    expect(prizes.some((row: any) => row.id === 'prize-1')).toBe(false);
    expect(links.some((row: any) => row.id === 'link-cars')).toBe(false);
    const carsLink = links.find((row: any) => row.link_type === 'cars' && row.url === '/car.html?lang=pl');
    expect(carsLink.resource_id).toBe(null);
    expect(rows.linkTranslations.some((row: any) => row.link_id === carsLink.id && row.lang === 'he' && row.url === '/car.html?lang=he')).toBe(true);
    expect(links.filter((row: any) => row.is_primary)).toHaveLength(1);
  });

  test('supports resource picker, custom URL translations, help popups and admin preview', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openSpecialOffers(page);
    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');

    await editor.getByRole('button', { name: 'Linked services' }).click();
    await editor.getByRole('button', { name: 'Add link' }).click();
    const resourceLink = editor.locator('[data-special-offers-link]').last();
    await resourceLink.locator('[data-link-field="link_type"]').selectOption('trips');
    await resourceLink.locator('[data-link-field="mode"]').selectOption('resource');
    await expect(resourceLink.locator('.special-offer-resource-picker')).toBeVisible();
    await resourceLink.locator('[data-link-field="resource_id"]').selectOption('trip-1');
    await expect(resourceLink.locator('[data-link-translation-field="url"][data-lang="pl"]')).toHaveValue('/trip.html?slug=lefkara-private-trip&lang=pl');
    await expect(resourceLink.locator('[data-link-translation-field="url"][data-lang="he"]')).toHaveValue('/trip.html?slug=lefkara-private-trip&lang=he');
    await expect(resourceLink.locator('[data-link-url-preview]')).toContainText('Generated from selected resource');

    await editor.getByRole('button', { name: 'Add link' }).click();
    const customLink = editor.locator('[data-special-offers-link]').last();
    await customLink.locator('[data-link-field="link_type"]').selectOption('custom');
    await customLink.locator('[data-link-field="mode"]').selectOption('custom');
    await customLink.locator('[data-link-translation-field="label"][data-lang="pl"]').fill('Manual PL');
    await customLink.locator('[data-link-translation-field="url"][data-lang="pl"]').fill('/manual-pl.html');
    await customLink.getByRole('button', { name: 'EN', exact: true }).click();
    await customLink.locator('[data-link-translation-field="label"][data-lang="en"]').fill('Manual EN');
    await customLink.locator('[data-link-translation-field="url"][data-lang="en"]').fill('/manual-en.html');
    await customLink.getByRole('button', { name: 'HE', exact: true }).click();
    await customLink.locator('[data-link-translation-field="label"][data-lang="he"]').fill('קישור ידני');
    await customLink.locator('[data-link-translation-field="url"][data-lang="he"]').fill('/manual-he.html');
    await expect(customLink.locator('[data-link-url-preview]')).toContainText('Manual URL');

    await editor.getByRole('button', { name: 'Add link' }).click();
    const shopLink = editor.locator('[data-special-offers-link]').last();
    await shopLink.locator('[data-link-field="link_type"]').selectOption('shop');
    await expect(shopLink.locator('[data-link-field="mode"] option[value="resource"]')).toHaveAttribute('disabled', '');
    await expect(shopLink).toContainText('Shop picker requires public product URL resolver');
    await shopLink.getByRole('button', { name: 'Remove' }).click();

    await editor.locator('[data-special-offers-help="links"]').click();
    const help = page.locator('#specialOffersHelpPopover');
    await expect(help).toBeVisible();
    await expect(help).toContainText('What this section does');
    await expect(help).toContainText('Main service page');
    await expect(help).toContainText('Existing offer/service');
    await expect(help).toContainText('Custom URL');
    await expect(help).toContainText('Resource ID is only saved when selected by admin');
    await help.locator('[data-special-offers-help-close]').last().click();
    await expect(help).toBeHidden();

    await page.locator('#specialOffersEditorPreview').click();
    const preview = page.locator('#specialOffersPreviewModal');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Preview campaign');
    await expect(preview).toContainText('Win 3 days in Lefkara + a car for 3 days');
    await preview.getByRole('button', { name: 'HE' }).click();
    await expect(preview.locator('[data-special-offers-preview-lang-panel="he"]')).toHaveAttribute('dir', 'rtl');
    await expect(preview).toContainText('3 ימים / 2 לילות');
    await preview.locator('[data-special-offers-preview-close]').last().click();

    await editor.getByRole('button', { name: 'Save draft' }).click();
    await expect(editor).toBeHidden();

    const rows = await page.evaluate(() => ({
      links: (window as any).__supabaseStub.getTableRows('special_offer_links'),
      linkTranslations: (window as any).__supabaseStub.getTableRows('special_offer_link_translations'),
    }));
    const tripLink = rows.links.find((row: any) => row.offer_id === OFFER_ID && row.link_type === 'trips');
    expect(tripLink.resource_id).toBe('trip-1');
    expect(rows.linkTranslations.some((row: any) => row.link_id === tripLink.id && row.lang === 'he' && row.url === '/trip.html?slug=lefkara-private-trip&lang=he')).toBe(true);
    const savedCustom = rows.links.find((row: any) => row.offer_id === OFFER_ID && row.link_type === 'custom' && row.url === '/manual-pl.html');
    expect(savedCustom.resource_id).toBe(null);
    expect(rows.linkTranslations.some((row: any) => row.link_id === savedCustom.id && row.lang === 'en' && row.url === '/manual-en.html')).toBe(true);
  });

  test('keeps cars picker schema-safe and shows friendly unavailable state on picker failure', async ({ page }) => {
    await prepareAdminSpecialOffersCrudStub(page, {
      selectErrorsByTable: {
        car_offers: 'column car_offers.title does not exist',
      },
    });
    await page.goto('/admin/dashboard.html');
    await waitForSupabaseStub(page);
    await expect(page.locator('#adminContainer')).toBeVisible();
    await page.click('button.admin-nav-item[data-view="specialOffers"]');
    await expect(page.locator('#viewSpecialOffers')).toBeVisible();

    const source = await page.evaluate(async () => (await fetch('/admin/special-offers.js')).text());
    expect(source).not.toContain("car_offers').select('id, title");
    expect(source).toContain('id, car_model, car_type, location, is_available');

    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');
    await editor.getByRole('button', { name: 'Linked services' }).click();
    await editor.getByRole('button', { name: 'Add link' }).click();
    const carsLink = editor.locator('[data-special-offers-link]').last();
    await carsLink.locator('[data-link-field="link_type"]').selectOption('cars');
    await expect(carsLink.locator('[data-link-field="mode"] option[value="resource"]')).toHaveAttribute('disabled', '');
    await expect(carsLink).toContainText('Cars picker is temporarily unavailable because the expected database fields do not match the current schema. Use Main service page for now.');

    await carsLink.locator('[data-link-field="mode"]').selectOption('main');
    await expect(carsLink.locator('[data-link-translation-field="url"][data-lang="pl"]')).toHaveValue('/car.html?lang=pl');
    await expect(editor.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });

  test('explains campaign type and winner mode options in help popups', async ({ page }) => {
    await openSpecialOffers(page);
    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');

    await editor.locator('[data-special-offers-help="type"]').click();
    const help = page.locator('#specialOffersHelpPopover');
    await expect(help).toBeVisible();
    await expect(help).toContainText('Contest');
    await expect(help).toContainText('Giveaway');
    await expect(help).toContainText('Weighted draw');
    await expect(help).toContainText('Partner promo');
    await expect(help).toContainText('Coupon promo');
    await expect(help).toContainText('Landing only');
    await help.locator('[data-special-offers-help-close]').last().click();

    await editor.locator('[data-special-offers-help="winnerMode"]').click();
    await expect(help).toBeVisible();
    await expect(help).toContainText('Manual selection');
    await expect(help).toContainText('Weighted draw');
    await expect(help).toContainText('None');
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
    await page.locator('#specialOffersEditorModal').getByRole('button', { name: 'Rules/settings' }).click();
    await expect(page.locator('#specialOffersEditorModal details').filter({ hasText: 'Advanced settings JSON' })).not.toHaveAttribute('open', '');

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
