import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const DRAFT_OFFER_ID = '4c38a187-8a68-4eb0-9b46-1cd923e06d31';
const PUBLIC_OFFER_ID = '5b2a50bd-3d34-4513-9288-9eb85ef24619';

async function prepareSpecialOfferLandingStub(page: Page, options: { adminSession?: boolean } = {}) {
  await page.addInitScript(({ adminId, draftOfferId, publicOfferId, adminSession }) => {
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
        };

        stub.seedUser({
          email: 'lilkangoomedia@gmail.com',
          password: 'super-secret',
          profile: adminProfile,
        });
        if (adminSession) {
          stub.setSession({ id: adminId, email: 'lilkangoomedia@gmail.com', user_metadata: { username: 'cyadmin' } });
        } else {
          stub.setSession(null);
        }

        stub.seedTable('special_offers', [
          {
            id: draftOfferId,
            slug: 'lefkara-giveaway-2026',
            type: 'contest',
            winner_selection_mode: 'manual_selection',
            status: 'draft',
            visibility: 'private',
            start_at: '2026-07-14T21:00:00.000Z',
            end_at: '2026-09-15T20:59:00.000Z',
            winner_announce_at: '2026-09-20T09:00:00.000Z',
            timezone: 'Asia/Nicosia',
          },
          {
            id: publicOfferId,
            slug: 'published-sample-2026',
            type: 'giveaway',
            winner_selection_mode: 'none',
            status: 'active',
            visibility: 'public',
            start_at: '2026-08-01T09:00:00.000Z',
            end_at: '2026-08-20T18:00:00.000Z',
            winner_announce_at: '2026-08-24T10:00:00.000Z',
            timezone: 'Asia/Nicosia',
          },
        ]);

        stub.seedTable('special_offer_translations', [
          {
            id: 'draft-pl',
            offer_id: draftOfferId,
            lang: 'pl',
            title: 'Wygraj 3 dni w Lefkarze + auto na 3 dni',
            short_description: 'Konkurs z pobytem w 7 Kamares oraz autem na 3 dni.',
            full_description: 'Polski opis kampanii Lefkara.',
            prize_description: '3 dni / 2 noce w 7 Kamares.',
            rules_html: '<section><h3>Zasady</h3><ul><li>Zaloguj się przed startem.</li></ul></section>',
            faq_json: [{ question: 'Kto może wziąć udział?', answer: 'Zalogowani użytkownicy.' }],
            seo_title: 'Konkurs Lefkara 2026',
            seo_description: 'Wygraj pobyt w Lefkarze.',
          },
          {
            id: 'draft-en',
            offer_id: draftOfferId,
            lang: 'en',
            title: 'Win 3 days in Lefkara + a car for 3 days',
            short_description: 'A giveaway with a stay at 7 Kamares and a car for 3 days.',
            full_description: 'Spend three days in Lefkara.',
            prize_description: '3 days / 2 nights at 7 Kamares.',
            rules_html: '<section><h3>Rules</h3><ul><li>Sign in before launch.</li></ul></section><script>alert("x")</script>',
            faq_json: [{ question: 'Is the car included?', answer: 'Yes.' }],
            seo_title: 'Lefkara giveaway 2026',
            seo_description: 'Win a Lefkara stay.',
          },
          {
            id: 'draft-he',
            offer_id: draftOfferId,
            lang: 'he',
            title: 'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים',
            short_description: 'הגרלה עם שהייה ורכב.',
            full_description: 'שהייה בלפקרה עם רכב.',
            prize_description: '3 ימים / 2 לילות.',
            rules_html: '<section><h3>כללים</h3><ul><li>יש להתחבר לפני ההשקה.</li></ul></section>',
            faq_json: [{ question: 'האם הרכב כלול?', answer: 'כן.' }],
            seo_title: 'הגרלת לפקרה',
            seo_description: 'זכו בשהייה.',
          },
          {
            id: 'public-pl',
            offer_id: publicOfferId,
            lang: 'pl',
            title: 'Publiczna kampania testowa',
            short_description: 'Publiczny opis kampanii.',
            full_description: 'Pełny publiczny opis kampanii.',
            rules_html: '<section><h3>Publiczne zasady</h3><ul><li>Bez formularza na tym etapie.</li></ul></section>',
            faq_json: [{ question: 'Czy formularz działa?', answer: 'Jeszcze nie.' }],
          },
          {
            id: 'public-en',
            offer_id: publicOfferId,
            lang: 'en',
            title: 'Published public campaign',
            short_description: 'A public read-only Special Offer.',
            full_description: 'This public landing page renders campaign copy without entries.',
            rules_html: '<section><h3>Public rules</h3><ul><li>No entry form in this stage.</li></ul></section>',
            faq_json: [{ question: 'Can I enter now?', answer: 'Not yet.' }],
          },
          {
            id: 'public-he',
            offer_id: publicOfferId,
            lang: 'he',
            title: 'קמפיין ציבורי לדוגמה',
            short_description: 'קמפיין ציבורי לקריאה בלבד.',
            full_description: 'עמוד הקמפיין מציג תוכן ללא טופס הרשמה.',
            rules_html: '<section><h3>כללים ציבוריים</h3><ul><li>אין טופס הרשמה בשלב זה.</li></ul></section>',
            faq_json: [{ question: 'האם אפשר להירשם עכשיו?', answer: 'עדיין לא.' }],
          },
        ]);

        stub.seedTable('special_offer_prizes', [
          {
            id: 'draft-prize-1',
            offer_id: draftOfferId,
            name: 'Global draft prize',
            description: 'Global prize fallback.',
            sponsor_name: '7 Kamares',
            quantity: 1,
            currency: 'EUR',
            sort_order: 0,
          },
          {
            id: 'public-prize-1',
            offer_id: publicOfferId,
            name: 'Global public prize',
            description: 'Global public fallback.',
            sponsor_name: 'CyprusEye',
            quantity: 1,
            currency: 'EUR',
            sort_order: 0,
          },
        ]);

        stub.seedTable('special_offer_prize_translations', [
          { id: 'draft-prize-pl', prize_id: 'draft-prize-1', lang: 'pl', name: '3 dni / 2 noce w 7 Kamares + auto na 3 dni', description: 'Polski opis nagrody.', restrictions: 'Dla osoby pełnoletniej.', fulfillment_notes: 'Sponsor: 7 Kamares.' },
          { id: 'draft-prize-en', prize_id: 'draft-prize-1', lang: 'en', name: '3 days / 2 nights at 7 Kamares + a car for 3 days', description: 'English prize description.', restrictions: 'Adult winner only.', fulfillment_notes: 'Sponsor: 7 Kamares.' },
          { id: 'draft-prize-he', prize_id: 'draft-prize-1', lang: 'he', name: '3 ימים / 2 לילות ב-7 Kamares + רכב ל-3 ימים', description: 'תיאור הפרס בעברית.', restrictions: 'לזוכה בגיר.', fulfillment_notes: 'נותן החסות: 7 Kamares.' },
          { id: 'public-prize-pl', prize_id: 'public-prize-1', lang: 'pl', name: 'Nagroda publiczna PL', description: 'Opis nagrody publicznej.', restrictions: 'Bez zapisów.', fulfillment_notes: 'Czytaj szczegóły.' },
          { id: 'public-prize-en', prize_id: 'public-prize-1', lang: 'en', name: 'Public prize EN', description: 'Public prize description.', restrictions: 'No entries yet.', fulfillment_notes: 'Read details.' },
          { id: 'public-prize-he', prize_id: 'public-prize-1', lang: 'he', name: 'פרס ציבורי בעברית', description: 'תיאור הפרס הציבורי.', restrictions: 'אין הרשמה עדיין.', fulfillment_notes: 'קראו את הפרטים.' },
        ]);

        stub.seedTable('special_offer_links', [
          { id: 'draft-link-custom', offer_id: draftOfferId, link_type: 'custom', resource_id: null, url: '/special-offers/lefkara-giveaway-2026?lang=pl', label: 'Kampania Lefkara 2026', is_primary: true, sort_order: 0 },
          { id: 'public-link-cars', offer_id: publicOfferId, link_type: 'cars', resource_id: null, url: '/car.html?lang=pl', label: 'Auta', is_primary: true, sort_order: 0 },
        ]);
        stub.seedTable('special_offer_link_translations', [
          { id: 'draft-link-pl', link_id: 'draft-link-custom', lang: 'pl', label: 'Kampania Lefkara 2026', description: 'Strona kampanii.', url: '/special-offers/lefkara-giveaway-2026?lang=pl' },
          { id: 'draft-link-en', link_id: 'draft-link-custom', lang: 'en', label: 'Lefkara Campaign 2026', description: 'Campaign page.', url: '/special-offers/lefkara-giveaway-2026?lang=en' },
          { id: 'draft-link-he', link_id: 'draft-link-custom', lang: 'he', label: 'קמפיין לפקרה 2026', description: 'עמוד הקמפיין.', url: '/special-offers/lefkara-giveaway-2026?lang=he' },
          { id: 'public-link-pl', link_id: 'public-link-cars', lang: 'pl', label: 'Auta na Cyprze', description: 'Wynajem auta na Cyprze.', url: '/car.html?lang=pl' },
          { id: 'public-link-en', link_id: 'public-link-cars', lang: 'en', label: 'Cars in Cyprus', description: 'Car rental in Cyprus.', url: '/car.html?lang=en' },
          { id: 'public-link-he', link_id: 'public-link-cars', lang: 'he', label: 'רכבים בקפריסין', description: 'השכרת רכב בקפריסין.', url: '/car.html?lang=he' },
        ]);

        stub.seedTable('special_offer_entries', []);
        stub.seedTable('special_offer_tasks', []);
        stub.seedTable('special_offer_entry_tasks', []);
        stub.seedTable('special_offer_draws', []);
        stub.seedTable('special_offer_draw_entries', []);
        stub.seedTable('special_offer_winners', []);
      },
    };
  }, { adminId: ADMIN_ID, draftOfferId: DRAFT_OFFER_ID, publicOfferId: PUBLIC_OFFER_ID, adminSession: Boolean(options.adminSession) });
}

async function bodyText(page: Page) {
  return page.locator('body').innerText();
}

test.describe('Special Offer public read-only landing', () => {
  test('blocks draft/private campaigns for public users with a safe unavailable message', async ({ page }) => {
    await prepareSpecialOfferLandingStub(page);
    await page.goto('/special-offer.html?slug=lefkara-giveaway-2026&lang=en');
    await waitForSupabaseStub(page);

    await expect(page.getByRole('heading', { name: 'Campaign is not available yet.' })).toBeVisible();
    await expect(page.getByText('Win 3 days in Lefkara')).toHaveCount(0);
    await expect(page.locator('[data-special-offer-content]')).toBeHidden();
    await expect(page.locator('[data-special-offer-entry-placeholder]')).toBeHidden();
  });

  test('renders public active campaigns with PL/EN/HE, prize translations, CTAs and no entry form', async ({ page }) => {
    await prepareSpecialOfferLandingStub(page);
    await page.goto('/special-offers/published-sample-2026?lang=en');
    await waitForSupabaseStub(page);

    await expect(page.getByRole('heading', { name: 'Published public campaign' })).toBeVisible();
    await expect(page.getByText('Public prize EN')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cars in Cyprus' })).toHaveAttribute('href', /\/car\.html\?lang=en$/);
    await expect(page.getByText('Entry form coming soon.')).toBeVisible();

    await page.getByRole('button', { name: 'PL' }).click();
    await expect(page.getByRole('heading', { name: 'Publiczna kampania testowa' })).toBeVisible();
    await expect(page.getByText('Nagroda publiczna PL')).toBeVisible();

    await page.getByRole('button', { name: 'HE' }).click();
    await expect(page.getByRole('heading', { name: 'קמפיין ציבורי לדוגמה' })).toBeVisible();
    await expect(page.getByText('פרס ציבורי בעברית')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('link', { name: 'רכבים בקפריסין' })).toHaveAttribute('href', /\/car\.html\?lang=he$/);

    const text = await bodyText(page);
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    await expect(page.locator('input[name*="entry"], textarea[name*="entry"]')).toHaveCount(0);
  });

  test('renders draft/private campaign through authenticated admin preview only', async ({ page }) => {
    await prepareSpecialOfferLandingStub(page, { adminSession: true });
    await page.goto('/special-offer.html?slug=lefkara-giveaway-2026&lang=he&admin_preview=1');
    await waitForSupabaseStub(page);

    await expect(page.getByText('תצוגה מקדימה למנהל')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים' })).toBeVisible();
    await expect(page.getByText('3 ימים / 2 לילות ב-7 Kamares + רכב ל-3 ימים')).toBeVisible();
    await expect(page.getByText('האם הרכב כלול?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'קמפיין לפקרה 2026' })).toHaveAttribute('href', /\/special-offers\/lefkara-giveaway-2026\?lang=he$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('alert("x")')).toHaveCount(0);

    const text = await bodyText(page);
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });

  test('does not expose admin preview for anonymous users', async ({ page }) => {
    await prepareSpecialOfferLandingStub(page);
    await page.goto('/special-offer.html?slug=lefkara-giveaway-2026&lang=en&admin_preview=1');
    await waitForSupabaseStub(page);

    await expect(page.getByRole('heading', { name: 'Campaign is not available yet.' })).toBeVisible();
    await expect(page.getByText('Admin preview')).toHaveCount(0);
  });

  test('keeps mobile landing within the viewport and performs no forbidden writes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareSpecialOfferLandingStub(page, { adminSession: true });
    await page.goto('/special-offer.html?slug=lefkara-giveaway-2026&lang=he&admin_preview=1');
    await waitForSupabaseStub(page);
    await expect(page.getByRole('heading', { name: 'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const forbiddenCounts = await page.evaluate(() => {
      const stub = (window as any).__supabaseStub;
      return [
        'special_offer_entries',
        'special_offer_tasks',
        'special_offer_entry_tasks',
        'special_offer_draws',
        'special_offer_draw_entries',
        'special_offer_winners',
      ].map((table) => [table, stub.getTableRows(table).length]);
    });
    expect(Object.fromEntries(forbiddenCounts)).toEqual({
      special_offer_entries: 0,
      special_offer_tasks: 0,
      special_offer_entry_tasks: 0,
      special_offer_draws: 0,
      special_offer_draw_entries: 0,
      special_offer_winners: 0,
    });

    const source = await page.request.get('/js/special-offer.js').then((response) => response.text());
    expect(source).not.toContain('.insert(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.delete(');
    expect(source).not.toContain('.upsert(');
    expect(source).not.toContain('.rpc(');
    expect(source).not.toContain('.storage');
  });
});
