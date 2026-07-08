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
            full_description: 'Polski opis kampanii Lefkara z pobytem i autem.',
            prize_description: '3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni.',
            rules_html: '<p>Regulamin konkursu Lefkara.</p><ul><li>Zaakceptuj regulamin.</li></ul>',
            faq_json: [
              { question: 'Kto może wziąć udział?', answer: 'Zalogowani użytkownicy CyprusEye.' },
            ],
            seo_title: 'Konkurs Lefkara 2026',
            seo_description: 'Wygraj pobyt w Lefkarze i auto na Cyprze.',
          },
          {
            id: 'translation-en',
            offer_id: offerId,
            lang: 'en',
            title: 'Win 3 days in Lefkara + a car for 3 days',
            short_description: 'A giveaway with a stay at 7 Kamares and a car for 3 days.',
            full_description: 'Spend three days in Lefkara with a companion and explore Cyprus by car.',
            prize_description: '3 days / 2 nights at 7 Kamares in Lefkara plus a car for 3 days.',
            rules_html: '<p>Read the campaign rules before entering.</p><ol><li>Register or log in.</li><li>Answer the contest question.</li></ol><script>window.bad = true</script>',
            faq_json: [
              { question: 'Can I join from Cyprus?', answer: 'Yes, logged-in CyprusEye users can join.' },
              { question: 'Is the car included?', answer: 'Yes, the prize includes a car for 3 days.' },
            ],
            seo_title: 'Lefkara giveaway 2026',
            seo_description: 'Win a Lefkara stay and a car for your Cyprus trip.',
          },
          {
            id: 'translation-he',
            offer_id: offerId,
            lang: 'he',
            title: 'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים',
            short_description: 'הגרלה עם שהייה ב-7 Kamares ורכב ל-3 ימים.',
            full_description: 'שהייה בלפקרה עם רכב כדי לטייל בקפריסין בקצב שלכם.',
            prize_description: '3 ימים / 2 לילות ב-7 Kamares בלפקרה ורכב ל-3 ימים.',
            rules_html: '<p>קראו את כללי הקמפיין לפני ההשתתפות.</p><ul><li>התחברו או הירשמו.</li><li>ענו על שאלת התחרות.</li></ul>',
            faq_json: [
              { question: 'האם הרכב כלול?', answer: 'כן, הפרס כולל רכב ל-3 ימים.' },
              { question: 'מתי יוכרז הזוכה?', answer: 'הזוכה יוכרז לאחר סיום הקמפיין.' },
            ],
            seo_title: 'הגרלת לפקרה 2026',
            seo_description: 'זכו בשהייה בלפקרה וברכב לטיול בקפריסין.',
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
        stub.seedTable('special_offer_prize_translations', [
          { id: 'prize-translation-pl', prize_id: 'prize-1', lang: 'pl', name: '3 dni / 2 noce w 7 Kamares + auto na 3 dni', description: 'Polski opis nagrody.', restrictions: 'Dla osoby pełnoletniej.', fulfillment_notes: 'Sponsor: 7 Kamares.' },
          { id: 'prize-translation-en', prize_id: 'prize-1', lang: 'en', name: '3 days / 2 nights at 7 Kamares + a car for 3 days', description: 'English prize description.', restrictions: 'Adult winner only.', fulfillment_notes: 'Sponsor: 7 Kamares.' },
          { id: 'prize-translation-he', prize_id: 'prize-1', lang: 'he', name: '3 ימים / 2 לילות ב-7 Kamares + רכב ל-3 ימים', description: 'תיאור הפרס בעברית.', restrictions: 'לזוכה בגיר.', fulfillment_notes: 'נותן החסות: 7 Kamares.' },
        ]);

        stub.seedTable('special_offer_links', [
          { id: 'link-cars', offer_id: offerId, link_type: 'cars', resource_id: null, url: '/car.html?lang=pl', label: 'Auta na Cyprze', is_primary: false, sort_order: 10 },
          { id: 'link-transport', offer_id: offerId, link_type: 'transport', resource_id: null, url: '/transport.html?lang=pl', label: 'Transport na Cyprze', is_primary: false, sort_order: 20 },
          { id: 'link-trips', offer_id: offerId, link_type: 'trips', resource_id: null, url: '/trips.html?lang=pl', label: 'Wycieczki na Cyprze', is_primary: false, sort_order: 30 },
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

    await expect(page.locator('.special-offers-create-button')).toBeEnabled();
    await expect(page.locator('.special-offers-create-button')).toHaveText('Create campaign');
    await expect(card.getByRole('button', { name: 'Edit' })).toBeEnabled();

    await card.getByRole('button', { name: 'View details' }).click();
    const modal = page.locator('#specialOffersDetailsModal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'PL' })).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'EN' })).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'HE' })).toBeVisible();

    await expect(modal).toContainText('Wygraj 3 dni w Lefkarze + auto na 3 dni');
    await expect(modal).toContainText('3 dni / 2 noce w 7 Kamares + auto na 3 dni');
    await expect(modal).toContainText('7 Kamares');
    await expect(modal).toContainText('LilKangooMedia LTD, CyprusEye.com, WakacjeCypr.com');
    await expect(modal).toContainText('Manual social verification');
    await expect(modal).toContainText('No automatic social integrations');
    await expect(modal).toContainText('Cars');
    await expect(modal).toContainText('/car.html?lang=pl');
    await expect(modal).toContainText('No resource ID');
    await expect(modal.getByRole('button', { name: 'Edit campaign' })).toBeEnabled();
    await expect(modal.getByRole('button', { name: 'Entries' })).toBeEnabled();
    await expect(modal.getByRole('button', { name: 'Draw' })).toBeDisabled();

    await modal.getByRole('tab', { name: 'EN' }).click();
    await expect(modal.locator('[data-special-offers-lang-panel="en"]')).toBeVisible();
    await expect(modal).toContainText('Win 3 days in Lefkara + a car for 3 days');
    await expect(modal).toContainText('Can I join from Cyprus?');
    await expect(modal).toContainText('Is the car included?');
    await expect(modal).not.toContainText('window.bad');

    await modal.getByRole('tab', { name: 'HE' }).click();
    const hePanel = modal.locator('[data-special-offers-lang-panel="he"]');
    await expect(hePanel).toBeVisible();
    await expect(hePanel).toHaveAttribute('dir', 'rtl');
    await expect(hePanel).toContainText('זכו ב-3 ימים בלפקרה + רכב ל-3 ימים');
    await expect(hePanel).toContainText('האם הרכב כלול?');
    await expect(hePanel).toContainText('מתי יוכרז הזוכה?');
    await expect(hePanel).toHaveCSS('text-align', 'right');

    const modalText = await modal.evaluate((node) => node.textContent || '');
    expect(modalText).not.toMatch(/\bundefined\b/i);
    expect(modalText).not.toMatch(/\bnull\b/i);
  });

  test('keeps module inside Special Offers CRUD safety boundaries', async ({ page }) => {
    await openAdmin(page);

    const source = await page.evaluate(async () => {
      const response = await fetch('/admin/special-offers.js');
      return response.text();
    });

    expect(source).not.toContain('special_offer_tasks');
    expect(source).not.toContain('special_offer_entry_tasks');
    expect(source).not.toContain('special_offer_draws');
    expect(source).not.toContain('special_offer_draw_entries');
    expect(source).not.toContain('special_offer_winners');
    expect(source).not.toMatch(/from\(['"]special_offer_entries['"]\)\.update/);
    expect(source).not.toMatch(/from\(['"]special_offer_entry_answers['"]\)\.(insert|update|delete|upsert)/);
    expect(source).not.toMatch(/\.storage\b/);
  });

  test('keeps read-only campaign cards usable on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdmin(page);

    await page.click('#adminMenuToggle');
    await page.click('button.admin-nav-item[data-view="specialOffers"]');
    await expect(page.locator('.special-offer-campaign-card')).toContainText('Wygraj 3 dni w Lefkarze');

    await page.locator('.special-offer-campaign-card').getByRole('button', { name: 'View details' }).click();
    await expect(page.locator('#specialOffersDetailsModal')).toBeVisible();
    await page.locator('#specialOffersDetailsModal').getByRole('tab', { name: 'HE' }).click();

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });
});
