import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

function buildSeedScript() {
  return () => {
    const now = Date.now();
    const isoDaysAgo = (days: number) => new Date(now - days * 86400000).toISOString();

    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const partnerUser = stub.seedUser({
          email: 'partner.blog@example.com',
          password: 'super-secret',
          profile: {
            id: 'profile-partner-blog',
            name: 'Lefkara Stories',
            username: 'lefkara-stories',
          },
        });

        stub.seedTable('partners', [
          {
            id: 'partner-blog-1',
            name: 'Lefkara Blog Partner',
            slug: 'lefkara-blog-partner',
            status: 'active',
            can_manage_blog: true,
            can_auto_publish_blog: true,
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('partner_users', [
          {
            id: 'partner-user-1',
            partner_id: 'partner-blog-1',
            user_id: partnerUser.id,
            role: 'owner',
            created_at: isoDaysAgo(30),
          },
        ]);

        stub.seedTable('blog_posts', [
          {
            id: 'partner-blog-seeded',
            status: 'draft',
            submission_status: 'pending',
            published_at: null,
            cover_image_url: 'https://stub.local/blog/partner-cover.webp',
            cover_image_alt: {},
            featured: false,
            allow_comments: false,
            categories: ['Local stories'],
            categories_pl: ['Lokalne historie'],
            categories_en: ['Local stories'],
            tags: ['village-life'],
            tags_pl: ['zycie-wioski'],
            tags_en: ['village-life'],
            cta_services: [{ type: 'trips', resource_id: 'trip-partner-1' }],
            author_profile_id: null,
            owner_partner_id: 'partner-blog-1',
            reviewed_at: null,
            reviewed_by: null,
            rejection_reason: null,
            created_by: partnerUser.id,
            updated_by: partnerUser.id,
            created_at: isoDaysAgo(3),
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('blog_post_translations', [
          {
            id: 'partner-blog-seeded-pl',
            blog_post_id: 'partner-blog-seeded',
            lang: 'pl',
            slug: 'partnerska-opowiesc-startowa',
            title: 'Partnerska opowieść startowa',
            meta_title: '',
            meta_description: 'Meta PL',
            summary: 'Podsumowanie PL',
            lead: 'Lead PL',
            author_name: '',
            author_url: '',
            content_json: { type: 'doc', content: [] },
            content_html: '<p>Treść PL</p>',
            og_image_url: '',
            created_at: isoDaysAgo(3),
            updated_at: isoDaysAgo(1),
          },
          {
            id: 'partner-blog-seeded-en',
            blog_post_id: 'partner-blog-seeded',
            lang: 'en',
            slug: 'partner-starter-story',
            title: 'Partner Starter Story',
            meta_title: '',
            meta_description: 'Meta EN',
            summary: 'Summary EN',
            lead: 'Lead EN',
            author_name: '',
            author_url: '',
            content_json: { type: 'doc', content: [] },
            content_html: '<p>Content EN</p>',
            og_image_url: '',
            created_at: isoDaysAgo(3),
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('trips', [
          {
            id: 'trip-partner-1',
            owner_partner_id: 'partner-blog-1',
            slug: 'lefkara-escape',
            title: { en: 'Lefkara Escape', pl: 'Wypad do Lefkary' },
            start_city: 'Larnaca',
            is_published: true,
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('hotels', [
          {
            id: 'hotel-partner-1',
            owner_partner_id: 'partner-blog-1',
            slug: 'lefkara-house',
            title: { en: 'Lefkara House', pl: 'Dom w Lefkarze' },
            city: 'Lefkara',
            is_published: true,
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('car_offers', [
          {
            id: 'car-partner-1',
            owner_partner_id: 'partner-blog-1',
            car_model: 'Suzuki Swift',
            car_type: 'Economy',
            location: 'Larnaca',
            is_published: true,
            is_available: true,
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('pois', [
          {
            id: 'poi-partner-1',
            slug: 'lefkara-square',
            name_en: 'Lefkara Square',
            name_pl: 'Plac Lefkara',
            city: 'Lefkara',
            status: 'published',
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.seedTable('recommendations', [
          {
            id: 'rec-partner-1',
            title_en: 'Local bakery',
            title_pl: 'Lokalna piekarnia',
            location_name: 'Lefkara',
            active: true,
            updated_at: isoDaysAgo(1),
          },
        ]);

        stub.setSession({
          id: partnerUser.id,
          email: partnerUser.email,
          user_metadata: { name: 'Lefkara Stories' },
        });
        if (stub.state?.currentSession) {
          stub.state.currentSession.access_token = 'partner-blog-token';
          stub.state.currentSession.refresh_token = 'partner-blog-refresh-token';
        }
      },
    };
  };
}

async function preparePartnerBlogStub(page: any) {
  await page.addInitScript(buildSeedScript());
  await enableSupabaseStub(page);
}

test.describe('Partner blog smoke', () => {
  test('partner with blog permission sees blog view and can submit a post for approval', async ({ page }) => {
    await preparePartnerBlogStub(page);
    await page.route('https://esm.sh/@tiptap/**', async (route) => {
      await route.abort();
    });

    await page.goto('/partners/');
    await waitForSupabaseStub(page);

    await page.waitForSelector('#partnerPortalApp:not([hidden])');
    await expect(page.locator('#partnerNavBlog')).toBeVisible();

    await page.click('#partnerNavBlog');
    await page.waitForSelector('#partnerBlogView:not([hidden])');
    await expect(page.locator('#partnerBlogTableBody')).toContainText('Partner Starter Story');

    await page.click('#btnPartnerBlogNew');
    const modal = page.locator('#partnerBlogModal');
    await expect(modal).toBeVisible();

    await modal.locator('#partnerBlogFormCategoriesPlInput').fill('Przewodniki');
    await modal.locator('[data-partner-blog-taxonomy-add="categories"][data-partner-blog-taxonomy-lang="pl"]').click();
    await modal.locator('#partnerBlogFormTagsEnInput').fill('smoke-test');
    await modal.locator('[data-partner-blog-taxonomy-add="tags"][data-partner-blog-taxonomy-lang="en"]').click();

    await modal.locator('#partnerBlogTitlePl').fill('Nowa historia partnera');
    await modal.locator('#partnerBlogLeadPl').fill('Lead PL. Dalsza część tekstu.');
    await expect(modal.locator('[data-partner-blog-editor-fallback="pl"]')).toBeVisible();
    await modal.locator('[data-partner-blog-editor-fallback="pl"]').fill('<p>Treść partnera PL</p>');

    await modal.locator('[data-partner-blog-lang-tab="en"]').click();
    await modal.locator('[data-partner-blog-copy="en"]').click();
    await modal.locator('#partnerBlogTitleEn').fill('New partner story');
    await modal.locator('#partnerBlogLeadEn').fill('Lead EN. More copy follows.');
    await expect(modal.locator('[data-partner-blog-editor-fallback="en"]')).toBeVisible();
    await modal.locator('[data-partner-blog-editor-fallback="en"]').fill('<p>Partner content EN</p>');

    await modal.locator('#btnPartnerBlogAddCta').click();
    const firstCtaRow = modal.locator('.partner-blog-cta-row').first();
    await firstCtaRow.locator('[data-partner-blog-cta-type]').selectOption('trips');
    await firstCtaRow.locator('[data-partner-blog-cta-resource]').selectOption('trip-partner-1');

    await modal.locator('#btnPartnerBlogSubmit').click();

    await expect(modal).toBeHidden();
    await expect(page.locator('#partnerBlogTableBody')).toContainText('New partner story');
    await expect(page.locator('#partnerBlogTableBody')).toContainText('pending');
  });
});
