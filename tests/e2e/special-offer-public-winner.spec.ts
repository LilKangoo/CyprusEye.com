import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ENDED_OFFER_ID = 'public-winner-ended-offer';
const DRAFT_OFFER_ID = 'public-winner-draft-offer';

type WinnerMode = 'hidden' | 'published' | 'unpublished' | 'missing-rpc';

async function preparePublicWinnerStub(page: Page, winnerMode: WinnerMode = 'published') {
  await page.addInitScript(({ endedOfferId, draftOfferId, mode }) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        stub.setSession(null);

        stub.seedTable('special_offers', [
          {
            id: endedOfferId,
            slug: 'ended-public-winner-2026',
            type: 'contest',
            winner_selection_mode: 'manual_selection',
            status: 'ended',
            visibility: 'public',
            start_at: '2026-01-01T00:00:00.000Z',
            end_at: '2026-02-01T20:59:59.000Z',
            winner_announce_at: '2026-02-05T10:00:00.000Z',
            timezone: 'Asia/Nicosia',
            requires_form: true,
            allow_bonus_points: true,
          },
          {
            id: draftOfferId,
            slug: 'draft-winner-2026',
            type: 'contest',
            winner_selection_mode: 'manual_selection',
            status: 'draft',
            visibility: 'private',
            start_at: '2026-01-01T00:00:00.000Z',
            end_at: '2026-02-01T20:59:59.000Z',
            timezone: 'Asia/Nicosia',
            requires_form: true,
            allow_bonus_points: true,
          },
        ]);
        stub.seedTable('special_offer_translations', [
          {
            id: 'winner-ended-en',
            offer_id: endedOfferId,
            lang: 'en',
            title: 'Ended public winner campaign',
            short_description: 'Public ended campaign.',
            full_description: 'Campaign content remains public after closing.',
            rules_html: '<section><h3>Rules</h3><p>The winner is selected manually.</p></section>',
            faq_json: [],
          },
          {
            id: 'winner-ended-pl',
            offer_id: endedOfferId,
            lang: 'pl',
            title: 'Zakończona kampania publiczna',
            short_description: 'Publiczna kampania po zakończeniu.',
            full_description: 'Treść kampanii pozostaje publiczna po zamknięciu.',
            rules_html: '<section><h3>Zasady</h3><p>Zwycięzca jest wybierany ręcznie.</p></section>',
            faq_json: [],
          },
          {
            id: 'winner-ended-he',
            offer_id: endedOfferId,
            lang: 'he',
            title: 'קמפיין ציבורי שהסתיים',
            short_description: 'קמפיין ציבורי לאחר סיום.',
            full_description: 'תוכן הקמפיין נשאר ציבורי לאחר הסגירה.',
            rules_html: '<section><h3>כללים</h3><p>הזוכה נבחר ידנית.</p></section>',
            faq_json: [],
          },
        ]);
        stub.seedTable('special_offer_prizes', [
          {
            id: 'winner-prize',
            offer_id: endedOfferId,
            name: 'Manual winner prize',
            description: 'Prize description.',
            quantity: 1,
            sort_order: 0,
          },
        ]);
        stub.seedTable('special_offer_prize_translations', [
          { id: 'winner-prize-en', prize_id: 'winner-prize', lang: 'en', name: 'Manual winner prize', description: 'A safe public prize.' },
          { id: 'winner-prize-pl', prize_id: 'winner-prize', lang: 'pl', name: 'Nagroda ręcznego wyboru', description: 'Bezpieczny publiczny opis nagrody.' },
          { id: 'winner-prize-he', prize_id: 'winner-prize', lang: 'he', name: 'פרס בחירה ידנית', description: 'תיאור ציבורי בטוח.' },
        ]);
        stub.seedTable('special_offer_links', []);
        stub.seedTable('special_offer_link_translations', []);
        stub.seedTable('special_offer_form_fields', [
          {
            id: 'ended-field-name',
            offer_id: endedOfferId,
            field_key: 'first_name',
            field_type: 'text',
            required: true,
            active: true,
            sort_order: 10,
            validation_json: {},
          },
        ]);
        stub.seedTable('special_offer_form_field_translations', [
          { id: 'ended-field-name-en', field_id: 'ended-field-name', lang: 'en', label: 'First name', options_json: [] },
          { id: 'ended-field-name-pl', field_id: 'ended-field-name', lang: 'pl', label: 'Imię', options_json: [] },
          { id: 'ended-field-name-he', field_id: 'ended-field-name', lang: 'he', label: 'שם פרטי', options_json: [] },
        ]);
        stub.seedTable('special_offer_official_posts', [
          {
            id: 'ended-official-post',
            offer_id: endedOfferId,
            post_order: 1,
            week_number: 1,
            admin_title: 'Closed post',
            platform: 'facebook',
            official_url: 'https://facebook.com/cypruseye/posts/closed',
            published_at: '2026-01-05T10:00:00.000Z',
            comment_deadline_at: '2026-01-06T10:00:00.000Z',
            active: true,
          },
        ]);

        stub.setRpcHandler('get_public_special_offer_landing', async (params: any, helpers: any) => {
          const slug = String(params?.p_slug || '').trim();
          const now = new Date();
          const offers = helpers.getTableRows('special_offers') || [];
          const offer = offers.find((row: any) => {
            if (row.slug !== slug) return false;
            if (!['active', 'ended', 'locked'].includes(row.status) || row.visibility !== 'public') return false;
            if (!row.start_at || !row.end_at) return false;
            return now >= new Date(row.start_at);
          });
          if (!offer) return { data: null, error: null };
          const offerId = offer.id;
          const prizes = (helpers.getTableRows('special_offer_prizes') || []).filter((row: any) => row.offer_id === offerId);
          const prizeIds = new Set(prizes.map((row: any) => row.id));
          const formFields = (helpers.getTableRows('special_offer_form_fields') || []).filter((row: any) => row.offer_id === offerId && row.active === true);
          const fieldIds = new Set(formFields.map((row: any) => row.id));
          return {
            data: {
              campaign: offer,
              translations: (helpers.getTableRows('special_offer_translations') || []).filter((row: any) => row.offer_id === offerId),
              prizes,
              prizeTranslations: (helpers.getTableRows('special_offer_prize_translations') || []).filter((row: any) => prizeIds.has(row.prize_id)),
              links: [],
              linkTranslations: [],
              formFields,
              formFieldTranslations: (helpers.getTableRows('special_offer_form_field_translations') || []).filter((row: any) => fieldIds.has(row.field_id)),
            },
            error: null,
          };
        });

        if (mode !== 'missing-rpc') {
          stub.setRpcHandler('get_public_special_offer_winner', async () => {
            if (mode !== 'published') {
              return {
                data: {
                  winner_published: false,
                  public_name: null,
                  published_at: null,
                  campaign_slug: 'ended-public-winner-2026',
                },
                error: null,
              };
            }
            return {
              data: {
                winner_published: true,
                public_name: '<img src=x onerror=alert(1)>A. Tester',
                published_at: '2026-02-05T10:00:00.000Z',
                campaign_slug: 'ended-public-winner-2026',
              },
              error: null,
            };
          });
        }
      },
    };
  }, {
    endedOfferId: ENDED_OFFER_ID,
    draftOfferId: DRAFT_OFFER_ID,
    mode: winnerMode,
  });
}

test.describe('Special Offer public-safe winner result', () => {
  test('shows a published winner safely without public score, ranking or contact data', async ({ page }) => {
    await preparePublicWinnerStub(page, 'published');
    await page.goto('/special-offers/ended-public-winner-2026?lang=en');
    await waitForSupabaseStub(page);

    await expect(page.getByRole('heading', { name: 'Ended public winner campaign' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campaign winner' })).toBeVisible();
    await expect(page.locator('[data-special-offer-winner-result]')).toContainText('<img src=x onerror=alert(1)>A. Tester');
    await expect(page.locator('[data-special-offer-winner-result] img')).toHaveCount(0);
    await expect(page.locator('[data-special-offer-winner-result]')).toContainText('The winner was selected manually');
    await expect(page.getByText('Total points')).toHaveCount(0);
    await expect(page.getByText('Ranking')).toHaveCount(0);
    await expect(page.getByText('participant@example.com')).toHaveCount(0);
    await expect(page.getByText('SO-')).toHaveCount(0);

    const storageKeys = await page.evaluate(() => ({
      local: Object.keys(localStorage).filter((key) => key.toLowerCase().includes('winner')),
      session: Object.keys(sessionStorage).filter((key) => key.toLowerCase().includes('winner')),
      winnerRpcCalls: (window as any).__supabaseStub.getRpcCalls().filter((call: any) => call.name === 'get_public_special_offer_winner').length,
    }));
    expect(storageKeys.local).toEqual([]);
    expect(storageKeys.session).toEqual([]);
    expect(storageKeys.winnerRpcCalls).toBe(1);
  });

  test('keeps ended public campaign readable but closes entries and activity claims', async ({ page }) => {
    await preparePublicWinnerStub(page, 'hidden');
    await page.goto('/special-offer.html?slug=ended-public-winner-2026&lang=en');
    await waitForSupabaseStub(page);

    await expect(page.getByRole('heading', { name: 'Ended public winner campaign' })).toBeVisible();
    await expect(page.getByText('Campaign ended')).toBeVisible();
    await expect(page.getByText('Entries for this campaign are now closed.')).toBeVisible();
    await expect(page.locator('[data-special-offer-entry-form]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit entry' })).toHaveCount(0);
    await expect(page.locator('[data-special-offer-activity-placeholder]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add proof' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'The result will be announced after the campaign ends' })).toBeVisible();
  });

  test('hides unpublished or unavailable result and keeps clean and legacy routes consistent', async ({ page }) => {
    await preparePublicWinnerStub(page, 'unpublished');
    await page.goto('/special-offers/ended-public-winner-2026?lang=pl');
    await waitForSupabaseStub(page);
    await expect(page.getByRole('heading', { name: 'Zakończona kampania publiczna' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wynik zostanie ogłoszony po zakończeniu kampanii' })).toBeVisible();
    await expect(page.getByText('A. Tester')).toHaveCount(0);
    const cleanBody = await page.locator('body').innerText();

    await page.goto('/special-offer.html?slug=ended-public-winner-2026&lang=pl');
    await waitForSupabaseStub(page);
    await expect(page.getByRole('heading', { name: 'Zakończona kampania publiczna' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wynik zostanie ogłoszony po zakończeniu kampanii' })).toBeVisible();
    expect(await page.locator('body').innerText()).toContain('Zakończona kampania publiczna');
    expect(cleanBody).toContain('Zakończona kampania publiczna');
  });

  test('handles missing winner RPC as neutral no-result state and preserves HE RTL', async ({ page }) => {
    await preparePublicWinnerStub(page, 'missing-rpc');
    await page.goto('/special-offers/ended-public-winner-2026?lang=he');
    await waitForSupabaseStub(page);

    await expect(page.getByRole('heading', { name: 'קמפיין ציבורי שהסתיים' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'התוצאה תפורסם לאחר סיום הקמפיין' })).toBeVisible();
    await expect(page.getByText('A. Tester')).toHaveCount(0);
  });

  test('keeps draft private campaign unavailable', async ({ page }) => {
    await preparePublicWinnerStub(page, 'published');
    await page.goto('/special-offers/draft-winner-2026?lang=en');
    await waitForSupabaseStub(page);

    await expect(page.getByRole('heading', { name: 'Campaign is not available yet.' })).toBeVisible();
    await expect(page.locator('[data-special-offer-content]')).toBeHidden();
  });
});
