import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

function buildPartnerSpecialOffersSeedScript() {
  return (config: { rpcError?: boolean } = {}) => {
    const now = Date.now();
    const isoDaysAgo = (days: number) => new Date(now - days * 86400000).toISOString();
    const isoDaysFromNow = (days: number) => new Date(now + days * 86400000).toISOString();

    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const partnerUser = stub.seedUser({
          email: 'partner.special.offers@example.com',
          password: 'super-secret',
          profile: {
            id: 'profile-partner-special-offers',
            name: 'Special Offers Partner',
            username: 'CYREF123',
            referral_code: 'CYREF123',
          },
        });

        stub.seedTable('partners', [
          {
            id: 'partner-special-offers-1',
            name: 'Special Offers Partner',
            slug: 'special-offers-partner',
            status: 'active',
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('partner_users', [
          {
            id: 'partner-user-special-offers-1',
            partner_id: 'partner-special-offers-1',
            user_id: partnerUser.id,
            role: 'owner',
            created_at: isoDaysAgo(30),
          },
        ]);

        stub.seedTable('trips', [
          {
            id: 'trip-special-offers-regression',
            slug: 'lefkara-escape',
            title: { en: 'Lefkara Escape', pl: 'Wypad do Lefkary' },
            start_city: 'Larnaca',
            is_published: true,
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.setRpcHandler('get_partner_active_special_offers', async (params: any) => {
          if (config.rpcError) {
            return { data: null, error: { code: '42501', message: 'partner_required' } };
          }
          const lang = String(params?.p_lang || 'en').trim().toLowerCase();
          const rowsByLang: Record<string, any[]> = {
            pl: [{
              slug: 'lefkara-giveaway-2026',
              requested_lang: 'pl',
              resolved_lang: 'pl',
              title: 'Konkurs Lefkara 2026',
              short_description: 'Wygraj ręcznie wybraną nagrodę z Lefkary.',
              cover_image_url: 'https://stub.local/special-offers/lefkara.webp',
              start_at: isoDaysAgo(1),
              end_at: isoDaysFromNow(30),
            }],
            en: [{
              slug: 'lefkara-giveaway-2026',
              requested_lang: 'en',
              resolved_lang: 'en',
              title: 'Lefkara Giveaway 2026',
              short_description: 'Share the active campaign with your referral code.',
              cover_image_url: 'https://stub.local/special-offers/lefkara.webp',
              start_at: isoDaysAgo(1),
              end_at: isoDaysFromNow(30),
            }],
            he: [{
              slug: 'lefkara-giveaway-2026',
              requested_lang: 'he',
              resolved_lang: 'he',
              title: 'מבצע לפקרה 2026',
              short_description: 'קישור קמפיין עם קוד שותף.',
              cover_image_url: 'https://stub.local/special-offers/lefkara.webp',
              start_at: isoDaysAgo(1),
              end_at: isoDaysFromNow(30),
            }],
          };
          return { data: rowsByLang[lang] || [], error: null };
        });

        stub.setSession({
          id: partnerUser.id,
          email: partnerUser.email,
          user_metadata: { name: 'Special Offers Partner' },
        });
        if (stub.state?.currentSession) {
          stub.state.currentSession.access_token = 'partner-special-offers-token';
          stub.state.currentSession.refresh_token = 'partner-special-offers-refresh-token';
        }
      },
    };
  };
}

async function openLinksDiscounts(page: any, options: { rpcError?: boolean } = {}) {
  await page.addInitScript(buildPartnerSpecialOffersSeedScript(), { rpcError: Boolean(options.rpcError) });
  await enableSupabaseStub(page);
  await page.goto('/partners/');
  await waitForSupabaseStub(page);
  await page.waitForSelector('#partnerPortalApp:not([hidden])');
  await expect(page.locator('#partnerNavLinksDiscounts')).toBeVisible();
  await page.click('#partnerNavLinksDiscounts');
  await page.waitForSelector('#partnerLinksDiscountsView:not([hidden])');
}

function assertPartnerUrl(value: string, lang: string) {
  const url = new URL(value);
  expect(url.pathname).toBe('/special-offers/lefkara-giveaway-2026');
  expect(url.searchParams.getAll('lang')).toEqual([lang]);
  expect(url.searchParams.getAll('ref')).toEqual(['CYREF123']);
}

test.describe('Partner Special Offers referral links', () => {
  test('shows active Special Offers cards with PL EN HE clean referral links', async ({ page }) => {
    await openLinksDiscounts(page);

    const allFilter = page.locator('[data-partner-links-filter="all"]');
    const specialFilter = page.locator('[data-partner-links-filter="special_offers"]');
    await expect(allFilter).toContainText('2');
    await expect(specialFilter).toContainText('1');

    await expect(page.locator('[data-partner-link-card="special_offers:lefkara-giveaway-2026"]')).toBeVisible();
    await expect(page.locator('#partnerLinksGrid')).toContainText('Special Offer');
    await expect(page.locator('#partnerLinksGrid')).toContainText('Lefkara Giveaway 2026');
    await expect(page.locator('#partnerLinksGrid')).toContainText('Ends');

    await specialFilter.click();
    await expect(page.locator('[data-partner-link-card="special_offers:lefkara-giveaway-2026"]')).toBeVisible();
    await expect(page.locator('#partnerLinksGrid .partner-links-card')).toHaveCount(1);

    const cardLinks = await page.locator('[data-partner-link-card="special_offers:lefkara-giveaway-2026"] [data-partner-link-copy-url]')
      .evaluateAll((buttons: Element[]) => buttons.map((button) => button.getAttribute('data-partner-link-copy-url') || ''));
    expect(cardLinks).toHaveLength(3);
    assertPartnerUrl(cardLinks[0], 'pl');
    assertPartnerUrl(cardLinks[1], 'en');
    assertPartnerUrl(cardLinks[2], 'he');

    await page.locator('[data-partner-link-card="special_offers:lefkara-giveaway-2026"]').click();
    const modal = page.locator('#partnerLinksPreviewModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#partnerLinksPreviewCategory')).toHaveText('Special Offer');

    const modalLinks = {
      pl: await modal.locator('#partnerLinksPreviewOfferLinkPl').inputValue(),
      en: await modal.locator('#partnerLinksPreviewOfferLinkEn').inputValue(),
      he: await modal.locator('#partnerLinksPreviewOfferLinkHe').inputValue(),
    };
    assertPartnerUrl(modalLinks.pl, 'pl');
    assertPartnerUrl(modalLinks.en, 'en');
    assertPartnerUrl(modalLinks.he, 'he');

    const openHe = await modal.locator('#btnPartnerLinksOpenOfferHe').evaluate((button: HTMLElement) => button.dataset.partnerLinkOpen || '');
    assertPartnerUrl(openHe, 'he');

    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    const listingCalls = rpcCalls.filter((call: any) => call.name === 'get_partner_active_special_offers');
    expect(listingCalls.map((call: any) => call.params.p_lang).sort()).toEqual(['en', 'he', 'pl']);
    expect(rpcCalls.some((call: any) => call.name === 'get_public_special_offer_landing')).toBe(false);
  });

  test('isolates Special Offers RPC failure and keeps existing service links usable', async ({ page }) => {
    await openLinksDiscounts(page, { rpcError: true });

    await expect(page.locator('[data-partner-links-filter="special_offers"]')).toContainText('0');
    await page.locator('[data-partner-links-filter="special_offers"]').click();
    await expect(page.locator('#partnerLinksGrid')).toContainText('No active Special Offers available for promotion right now.');

    await page.locator('[data-partner-links-filter="trips"]').click();
    await expect(page.locator('#partnerLinksGrid')).toContainText('Lefkara Escape');

    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    expect(rpcCalls.filter((call: any) => call.name === 'get_partner_active_special_offers')).toHaveLength(3);
  });
});
