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
          { id: 'link-cars', offer_id: offerId, link_type: 'cars', resource_id: null, url: '/car.html?lang=pl', label: 'Auta na Cyprze', image_url: null, is_primary: false, sort_order: 10 },
          { id: 'link-custom', offer_id: offerId, link_type: 'custom', resource_id: null, url: '/special-offers/lefkara-giveaway-2026?lang=pl', label: 'Kampania Lefkara 2026', image_url: 'https://cdn.example.com/lefkara-campaign.webp', is_primary: true, sort_order: 0 },
        ]);
        stub.seedTable('special_offer_link_translations', [
          { id: 'link-cars-pl', link_id: 'link-cars', lang: 'pl', label: 'Auta na Cyprze', description: 'Wynajem auta na Cyprze.', url: '/car.html?lang=pl' },
          { id: 'link-cars-en', link_id: 'link-cars', lang: 'en', label: 'Cars in Cyprus', description: 'Car rental in Cyprus.', url: '/car.html?lang=en' },
          { id: 'link-cars-he', link_id: 'link-cars', lang: 'he', label: 'רכבים בקפריסין', description: 'השכרת רכב בקפריסין.', url: '/car.html?lang=he' },
          { id: 'link-custom-pl', link_id: 'link-custom', lang: 'pl', label: 'Kampania Lefkara 2026', description: 'Strona kampanii.', url: '/special-offers/lefkara-giveaway-2026?lang=pl' },
          { id: 'link-custom-en', link_id: 'link-custom', lang: 'en', label: 'Lefkara Campaign 2026', description: 'Campaign page.', url: '/special-offers/lefkara-giveaway-2026?lang=en' },
          { id: 'link-custom-he', link_id: 'link-custom', lang: 'he', label: 'קמפיין לפקרה 2026', description: 'עמוד הקמפיין.', url: '/special-offers/lefkara-giveaway-2026?lang=he' },
        ]);
        const formFields = [
          ['field-first-name', 'first_name', 'text', true, true, 10, {}],
          ['field-last-name', 'last_name', 'text', true, true, 20, {}],
          ['field-email', 'email', 'email', true, true, 30, {}],
          ['field-phone', 'phone', 'phone', true, true, 40, {}],
          ['field-dob', 'date_of_birth', 'date_of_birth', true, true, 50, { min_age: 18 }],
          ['field-country', 'country', 'country', true, true, 60, {}],
          ['field-city', 'city', 'city', false, true, 70, {}],
          ['field-answer', 'contest_answer', 'contest_answer', true, true, 80, {}],
          ['field-facebook', 'facebook_profile_url', 'facebook_profile_url', true, true, 90, {}],
          ['field-shared-post', 'shared_post_url', 'shared_post_url', true, true, 100, {}],
          ['field-terms', 'terms_accepted', 'consent', true, true, 110, { must_be_true: true }],
        ].map(([id, field_key, field_type, required, active, sort_order, validation_json]) => ({
          id,
          offer_id: offerId,
          field_key,
          field_type,
          required,
          active,
          sort_order,
          validation_json,
          admin_note: null,
        }));
        stub.seedTable('special_offer_form_fields', formFields);
        const formLabels: Record<string, Record<string, string>> = {
          first_name: { pl: 'Imię', en: 'First name', he: 'שם פרטי' },
          last_name: { pl: 'Nazwisko', en: 'Last name', he: 'שם משפחה' },
          email: { pl: 'E-mail', en: 'Email', he: 'אימייל' },
          phone: { pl: 'Telefon', en: 'Phone', he: 'טלפון' },
          date_of_birth: { pl: 'Data urodzenia', en: 'Date of birth', he: 'תאריך לידה' },
          country: { pl: 'Kraj', en: 'Country', he: 'מדינה' },
          city: { pl: 'Miasto', en: 'City', he: 'עיר' },
          contest_answer: { pl: 'Odpowiedź konkursowa', en: 'Contest answer', he: 'תשובת תחרות' },
          facebook_profile_url: { pl: 'Link do profilu Facebook', en: 'Facebook profile URL', he: 'קישור לפרופיל פייסבוק' },
          shared_post_url: { pl: 'Link do udostępnionego posta', en: 'Shared post URL', he: 'קישור לפוסט ששיתפתם' },
          terms_accepted: { pl: 'Akceptuję regulamin kampanii', en: 'I accept the campaign rules', he: 'אני מאשר/ת את כללי הקמפיין' },
        };
        stub.seedTable('special_offer_form_field_translations', formFields.flatMap((field: any) => ['pl', 'en', 'he'].map((lang) => ({
          id: `${field.id}-${lang}`,
          field_id: field.id,
          lang,
          label: formLabels[field.field_key][lang],
          placeholder: field.field_key === 'email' ? 'name@example.com' : '',
          help_text: lang === 'pl' ? 'Wypełnij to pole formularza.' : lang === 'en' ? 'Fill in this form field.' : 'יש למלא שדה זה.',
          options_json: [],
        }))));
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
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeDisabled();

    await editor.locator('[name="slug"]').fill('summer-family-giveaway-2026');
    await editor.getByRole('button', { name: 'Content PL / EN / HE' }).click();
    await editor.locator('[name="pl_title"]').fill('Wygraj rodzinny weekend na Cyprze');
    await editor.getByRole('button', { name: 'Prize' }).click();
    await expect(editor.getByRole('button', { name: 'PL' }).first()).toBeVisible();
    await editor.locator('[data-prize-translation-field="name"][data-lang="pl"]').fill('Rodzinny weekend');
    await editor.locator('[data-prize-translation-field="description"][data-lang="pl"]').fill('Weekendowy pobyt dla rodziny.');
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save campaign' }).click();

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
    await editor.getByRole('button', { name: 'Save campaign' }).click();
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
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
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
    await expect(newLink.locator('[data-link-field="image_url"]')).toBeVisible();
    await newLink.locator('[data-link-field="image_url"]').fill('http://example.com/bad.jpg');
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    await expect(newLink.locator('[data-link-image-preview]')).toContainText('Image URL must be a full HTTPS image address');
    await newLink.locator('[data-link-field="image_url"]').fill(' https://cdn.example.com/cars.webp');
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    await newLink.locator('[data-link-field="image_url"]').fill('https://cdn.example.com/cars.webp');
    await expect(newLink.locator('[data-link-image-preview] img')).toHaveAttribute('src', 'https://cdn.example.com/cars.webp');
    await newLink.locator('[data-link-field="is_primary"]').check();
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    await newLink.locator('[data-link-field="is_primary"]').uncheck();
    await editor.locator('[data-special-offers-link]').nth(1).getByRole('button', { name: 'Remove' }).click();
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save campaign' }).click();
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
    expect(carsLink.image_url).toBe('https://cdn.example.com/cars.webp');
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
    await customLink.locator('[data-link-field="image_url"]').fill('/assets/images/manual-link.webp');
    await expect(customLink.locator('[data-link-image-preview] img')).toHaveAttribute('src', '/assets/images/manual-link.webp');
    await customLink.locator('[data-link-translation-field="label"][data-lang="pl"]').fill('Manual PL');
    await customLink.locator('[data-link-translation-field="url"][data-lang="pl"]').fill('/manual-pl.html');
    await customLink.locator('[data-special-offers-nested-lang-tab$=":en"]').click();
    await customLink.locator('[data-link-translation-field="label"][data-lang="en"]').fill('Manual EN');
    await customLink.locator('[data-link-translation-field="url"][data-lang="en"]').fill('/manual-en.html');
    await customLink.locator('[data-special-offers-nested-lang-tab$=":he"]').click();
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

    await editor.getByRole('button', { name: 'Save campaign' }).click();
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
    expect(savedCustom.image_url).toBe('/assets/images/manual-link.webp');
    expect(rows.linkTranslations.some((row: any) => row.link_id === savedCustom.id && row.lang === 'en' && row.url === '/manual-en.html')).toBe(true);
  });

  test('clears optional linked service image URL to null', async ({ page }) => {
    await openSpecialOffers(page);
    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');

    await editor.getByRole('button', { name: 'Linked services' }).click();
    const customLink = editor.locator('[data-special-offers-link]').first();
    await expect(customLink.locator('[data-link-field="image_url"]')).toHaveValue('https://cdn.example.com/lefkara-campaign.webp');
    await expect(customLink.locator('[data-link-image-preview] img')).toHaveAttribute('src', 'https://cdn.example.com/lefkara-campaign.webp');
    await customLink.getByRole('button', { name: 'Clear image URL' }).click();
    await expect(customLink.locator('[data-link-field="image_url"]')).toHaveValue('');
    await expect(customLink.locator('[data-link-image-preview]')).toContainText('No image URL set');

    await editor.getByRole('button', { name: 'Save campaign' }).click();
    await expect(editor).toBeHidden();

    const rows = await page.evaluate(() => (window as any).__supabaseStub.getTableRows('special_offer_links'));
    const custom = rows.find((row: any) => row.id === 'link-custom');
    expect(custom.image_url).toBe(null);
  });

  test('manages Special Offers form fields with PL/EN/HE translations, validation, options and preview', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openSpecialOffers(page);
    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');

    await editor.getByRole('button', { name: 'Form' }).click();
    await expect(editor).toContainText('Configure form fields only');
    await expect(editor.locator('[data-offer-setting="requires_form"]')).toBeChecked();
    await expect(editor.locator('[data-special-offers-form-field]')).toHaveCount(11);

    const firstName = editor.locator('[data-special-offers-form-field]').nth(0);
    await expect(firstName.locator('[data-form-translation-field="label"][data-lang="pl"]')).toHaveValue('Imię');
    await firstName.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(firstName.locator('[data-form-translation-field="label"][data-lang="en"]')).toHaveValue('First name');
    await firstName.getByRole('button', { name: 'HE', exact: true }).click();
    await expect(firstName.locator('[data-form-translation-field="label"][data-lang="he"]')).toHaveAttribute('dir', 'rtl');
    await firstName.locator('[data-form-translation-field="label"][data-lang="he"]').fill('שם פרטי מעודכן');
    await firstName.locator('summary').filter({ hasText: 'Advanced validation JSON preview' }).click();
    await firstName.locator('[data-form-validation-json]').fill('{bad json');
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    await firstName.locator('[data-form-validation-json]').fill('{}');

    const dob = editor.locator('[data-special-offers-form-field]').nth(4);
    await expect(dob.locator('[data-form-validation="min_age"]')).toHaveValue('18');
    await dob.locator('[data-form-validation="min_age"]').fill('21');

    const terms = editor.locator('[data-special-offers-form-field]').nth(10);
    await expect(terms.locator('[data-form-validation="must_be_true"]')).toBeChecked();

    const city = editor.locator('[data-special-offers-form-field]').nth(6);
    await city.getByRole('button', { name: 'Deactivate' }).click();
    await expect(city.locator('[data-form-field="active"]')).not.toBeChecked();

    await editor.getByRole('button', { name: 'Add field' }).click();
    const newField = editor.locator('[data-special-offers-form-field]').last();
    await newField.locator('[data-form-field="field_key"]').fill('favorite_activity');
    await newField.locator('[data-form-field="field_type"]').selectOption('select');
    await newField.locator('[data-form-translation-field="label"][data-lang="pl"]').fill('Ulubiona aktywność');
    await newField.locator('[data-form-translation-field="placeholder"][data-lang="pl"]').fill('Wybierz aktywność');
    await newField.getByRole('button', { name: 'Add option' }).first().click();
    const option = newField.locator('[data-form-option]').first();
    await option.locator('[data-form-option-field="value"]').fill('walking');
    await option.locator('[data-form-option-field="label"]').fill('Spacer');
    await expect(newField.locator('[data-form-options-json-preview]').first()).toContainText('walking');

    const beforePreviewRows = await page.evaluate(() => ({
      fields: (window as any).__supabaseStub.getTableRows('special_offer_form_fields').length,
      translations: (window as any).__supabaseStub.getTableRows('special_offer_form_field_translations').length,
      audit: (window as any).__supabaseStub.getTableRows('special_offer_audit_log').length,
    }));
    await editor.getByRole('button', { name: 'Preview form', exact: true }).click();
    const formPreview = page.locator('#specialOffersFormPreviewModal');
    await expect(formPreview).toBeVisible();
    await expect(formPreview).toContainText('Preview form');
    await expect(formPreview).toContainText('Imię');
    await expect(formPreview).toContainText('Preview only. Public submit is not available yet.');
    await expect(formPreview).toContainText('Ulubiona aktywność');
    await formPreview.getByRole('button', { name: 'HE' }).click();
    await expect(formPreview.locator('.special-offer-form-preview-fields')).toHaveAttribute('dir', 'rtl');
    await expect(formPreview.getByRole('button', { name: 'Preview only. Public submit is not available yet.' })).toBeDisabled();
    const afterPreviewRows = await page.evaluate(() => ({
      fields: (window as any).__supabaseStub.getTableRows('special_offer_form_fields').length,
      translations: (window as any).__supabaseStub.getTableRows('special_offer_form_field_translations').length,
      audit: (window as any).__supabaseStub.getTableRows('special_offer_audit_log').length,
    }));
    expect(afterPreviewRows).toEqual(beforePreviewRows);
    await formPreview.locator('[data-special-offers-form-preview-close]').last().click();

    await editor.locator('[data-special-offers-help="form"]').click();
    const help = page.locator('#specialOffersHelpPopover');
    await expect(help).toBeVisible();
    await expect(help).toContainText('Defines the campaign form fields');
    await expect(help).toContainText('public submit');
    await help.locator('[data-special-offers-help-close]').last().click();

    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save campaign' }).click();
    await expect(editor).toBeHidden();

    const rows = await page.evaluate(() => ({
      offers: (window as any).__supabaseStub.getTableRows('special_offers'),
      fields: (window as any).__supabaseStub.getTableRows('special_offer_form_fields'),
      translations: (window as any).__supabaseStub.getTableRows('special_offer_form_field_translations'),
      audit: (window as any).__supabaseStub.getTableRows('special_offer_audit_log'),
      forbidden: [
        'special_offer_entries',
        'special_offer_entry_answers',
        'special_offer_tasks',
        'special_offer_entry_tasks',
        'special_offer_draws',
        'special_offer_draw_entries',
        'special_offer_winners',
      ].map((table) => [table, (window as any).__supabaseStub.getTableRows(table).length]),
    }));
    expect(rows.offers.find((row: any) => row.id === OFFER_ID).requires_form).toBe(true);
    expect(rows.fields.find((row: any) => row.id === 'field-city').active).toBe(false);
    expect(rows.fields.find((row: any) => row.id === 'field-dob').validation_json.min_age).toBe(21);
    const newSavedField = rows.fields.find((row: any) => row.offer_id === OFFER_ID && row.field_key === 'favorite_activity');
    expect(newSavedField.field_type).toBe('select');
    expect(rows.translations.some((row: any) => row.field_id === 'field-first-name' && row.lang === 'he' && row.label === 'שם פרטי מעודכן')).toBe(true);
    expect(rows.translations.some((row: any) => row.field_id === newSavedField.id && row.lang === 'pl' && row.options_json[0].value === 'walking')).toBe(true);
    expect(rows.audit.some((row: any) => row.action === 'special_offer.updated' && row.metadata?.form_builder === true)).toBe(true);
    expect(rows.forbidden.every((entry: any[]) => entry[1] === 0)).toBe(true);
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
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeEnabled();
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

  test('shows safe public preview URLs and allows controlled active/public activation with confirmed dates', async ({ page }) => {
    page.on('dialog', (dialog) => {
      expect(dialog.message()).toContain('Publish this campaign as Active + Public?');
      expect(dialog.message()).toContain('immediately accept entries');
      dialog.accept();
    });
    await openSpecialOffers(page);
    const card = page.locator('.special-offer-campaign-card').filter({ hasText: 'Wygraj 3 dni w Lefkarze' });
    await expect(card.getByRole('link', { name: 'Preview public page' })).toHaveAttribute(
      'href',
      /\/special-offer\.html\?slug=lefkara-giveaway-2026&lang=pl&admin_preview=1$/
    );
    await expect(card.getByRole('button', { name: 'Copy preview URL' })).toBeVisible();

    await card.getByRole('button', { name: 'View details' }).click();
    const details = page.locator('#specialOffersDetailsModal');
    await expect(details).toBeVisible();
    await expect(details).toContainText('Public landing preview URLs');
    await expect(details).toContainText('/special-offer.html?slug=lefkara-giveaway-2026&lang=pl&admin_preview=1');
    await expect(details).toContainText('Clean: /special-offers/lefkara-giveaway-2026?lang=pl&admin_preview=1');
    await details.locator('.btn-modal-close[data-special-offers-close]').click();

    await openEditorForLefkara(page);
    const editor = page.locator('#specialOffersEditorModal');
    await expect(editor.locator('select[name="status"] option[value="active"]')).toBeEnabled();
    await expect(editor.locator('select[name="visibility"] option[value="public"]')).toBeEnabled();
    await expect(editor).toContainText('Before saving Active + Public, confirm Auth Redirect URLs');

    await editor.getByRole('button', { name: 'Dates & visibility' }).click();
    await editor.locator('input[name="start_at"]').fill('2025-07-15T00:00');
    await editor.locator('input[name="end_at"]').fill('2026-09-15T23:59:59');
    await editor.getByRole('button', { name: 'Basic settings' }).click();
    await editor.locator('select[name="status"]').selectOption('active');
    await editor.locator('select[name="visibility"]').selectOption('public');
    await editor.getByRole('button', { name: 'Review & save' }).click();
    await expect(editor.locator('#specialOfferEditorReview')).toContainText('Status');
    await expect(editor.locator('#specialOfferEditorReview')).toContainText('Active');
    await expect(editor.locator('#specialOfferEditorReview')).toContainText('Visibility');
    await expect(editor.locator('#specialOfferEditorReview')).toContainText('Public');
    await expect(editor.getByRole('button', { name: 'Save campaign' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Save campaign' }).click();
    await expect(editor).toBeHidden();

    const saved = await page.evaluate((offerId) => {
      const offer = (window as any).__supabaseStub.getTableRows('special_offers').find((row: any) => row.id === offerId);
      const audit = (window as any).__supabaseStub.getTableRows('special_offer_audit_log');
      return { offer, audit };
    }, OFFER_ID);
    expect(saved.offer.status).toBe('active');
    expect(saved.offer.visibility).toBe('public');
    expect(new Date(saved.offer.start_at).toISOString()).toBe('2025-07-14T21:00:00.000Z');
    expect(new Date(saved.offer.end_at).toISOString()).toBe('2026-09-15T20:59:59.000Z');
    expect(saved.audit.some((row: any) => row.action === 'special_offer.updated' && row.offer_id === OFFER_ID)).toBe(true);

    const updatedCard = page.locator('.special-offer-campaign-card').filter({ hasText: 'Wygraj 3 dni w Lefkarze' });
    await updatedCard.getByRole('button', { name: 'Edit' }).click();
    await expect(editor).toBeVisible();
    await expect(editor.locator('input[name="start_at"]')).toHaveValue('2025-07-15T00:00');
    await expect(editor.locator('input[name="end_at"]')).toHaveValue('2026-09-15T23:59:59');
  });

  test('archives without hard delete', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openSpecialOffers(page);

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
    await openEditorForLefkara(page);
    await expect(page.locator('#specialOffersEditorModal')).toBeVisible();
    await page.locator('#specialOffersEditorModal').getByRole('button', { name: 'Form' }).click();
    const lastFieldLabel = page
      .locator('#specialOfferEditorFormFields [data-special-offers-form-field]')
      .last()
      .locator('[data-form-translation-field="label"][data-lang="pl"]');
    await lastFieldLabel.scrollIntoViewIfNeeded();
    await expect(lastFieldLabel).toBeVisible();
    const formLayout = await page.evaluate(() => {
      const body = document.querySelector('#specialOffersEditorBody');
      const footer = document.querySelector('#specialOffersEditorModal .special-offer-editor-footer');
      const input = document.querySelector('#specialOfferEditorFormFields [data-special-offers-form-field]:last-child [data-form-translation-field="label"][data-lang="pl"]');
      if (!body || !footer || !input) return { bodyScrollable: false, bodyBeforeFooter: false, inputClearOfFooter: false };
      const bodyBox = body.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      const inputBox = input.getBoundingClientRect();
      return {
        bodyScrollable: body.scrollHeight > body.clientHeight,
        bodyBeforeFooter: bodyBox.bottom <= footerBox.top + 1,
        inputClearOfFooter: inputBox.bottom <= footerBox.top - 4,
      };
    });
    expect(formLayout.bodyScrollable).toBe(true);
    expect(formLayout.bodyBeforeFooter).toBe(true);
    expect(formLayout.inputClearOfFooter).toBe(true);
    await page.locator('#specialOffersEditorModal').getByRole('button', { name: 'Rules/settings' }).click();
    await expect(page.locator('#specialOffersEditorModal details').filter({ hasText: 'Advanced settings JSON' })).not.toHaveAttribute('open', '');

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);

    const source = await page.evaluate(async () => (await fetch('/admin/special-offers.js')).text());
    expect(source).not.toContain('special_offer_tasks');
    expect(source).not.toContain('special_offer_entry_tasks');
    expect(source).not.toContain('special_offer_draws');
    expect(source).not.toContain('special_offer_draw_entries');
    expect(source).not.toContain('special_offer_winners');
    expect(source).not.toMatch(/from\(['"]special_offer_entries['"]\)\.update/);
    expect(source).not.toMatch(/from\(['"]special_offer_entry_answers['"]\)\.(insert|update|delete|upsert)/);
    expect(source).not.toMatch(/\.storage\b/);
  });
});
