import { test, expect } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

function buildSeedScript(withAdminSession = false) {
  return ({ withAdminSessionFlag = false }) => {
    const now = Date.now();
    const isoDaysAgo = (days: number) => new Date(now - days * 86400000).toISOString();
    const isoDaysAhead = (days: number) => new Date(now + days * 86400000).toISOString();

    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const admin = stub.seedUser({
          email: 'lilkangoomedia@gmail.com',
          password: 'super-secret',
          profile: {
            id: 'profile-admin',
            name: 'CyprusEye Admin',
            username: 'cyadmin',
            is_admin: true,
          },
        });

        const author = stub.seedUser({
          email: 'author@example.com',
          password: 'super-secret',
          profile: {
            id: 'profile-author',
            name: 'Maria Guide',
            username: 'mariaguide',
            avatar_url: 'https://stub.local/avatar-author.png',
          },
        });

        stub.seedTable('partners', [
          {
            id: 'partner-1',
            name: 'Lefkara Partner',
            slug: 'lefkara-partner',
            status: 'active',
            can_manage_blog: true,
            can_auto_publish_blog: false,
            updated_at: isoDaysAgo(1),
          },
        ]);

        const blogPosts = Array.from({ length: 13 }).map((_, index) => ({
          id: `blog-${index + 1}`,
          status: 'published',
          submission_status: 'approved',
          published_at: isoDaysAgo(index + 1),
          cover_image_url: `https://stub.local/blog/cover-${index + 1}.webp`,
          cover_image_alt: { en: `Cover ${index + 1}`, pl: `Okładka ${index + 1}` },
          featured: index === 0,
          allow_comments: false,
          categories: [index % 2 === 0 ? 'Lefkara' : 'Cyprus'],
          tags: [index % 3 === 0 ? 'guide' : 'local-tip'],
          cta_services: [
            { type: 'trips', resource_id: 'trip-1' },
            { type: 'hotels', resource_id: 'hotel-1' },
            { type: 'recommendations', resource_id: 'rec-1' },
          ],
          author_profile_id: 'profile-author',
          owner_partner_id: null,
          reviewed_at: isoDaysAgo(index + 1),
          reviewed_by: 'profile-admin',
          rejection_reason: null,
          created_by: 'profile-admin',
          updated_by: 'profile-admin',
          created_at: isoDaysAgo(index + 2),
          updated_at: isoDaysAgo(index + 1),
        }));

        blogPosts.push({
          id: 'blog-pending',
          status: 'draft',
          submission_status: 'pending',
          published_at: null,
          cover_image_url: 'https://stub.local/blog/pending.webp',
          cover_image_alt: { en: 'Partner pending cover', pl: 'Okładka partnera' },
          featured: false,
          allow_comments: false,
          categories: ['Partner'],
          tags: ['partner-story'],
          cta_services: [{ type: 'cars', resource_id: 'car-1' }],
          author_profile_id: '',
          owner_partner_id: 'partner-1',
          reviewed_at: null,
          reviewed_by: null,
          rejection_reason: null,
          created_by: 'profile-admin',
          updated_by: 'profile-admin',
          created_at: isoDaysAgo(1),
          updated_at: isoDaysAgo(1),
        });

        stub.seedTable('blog_posts', blogPosts);

        const translations = Array.from({ length: 13 }).flatMap((_, index) => ([
          {
            id: `blog-${index + 1}-en`,
            blog_post_id: `blog-${index + 1}`,
            lang: 'en',
            slug: `cyprus-guide-${index + 1}`,
            title: `Cyprus Guide ${index + 1}`,
            meta_title: '',
            meta_description: `Meta EN ${index + 1}`,
            summary: `Summary EN ${index + 1}`,
            lead: `Lead EN ${index + 1}`,
            author_name: index === 0 ? '' : `Editor ${index + 1}`,
            author_url: index === 0 ? '' : `https://example.com/editor-${index + 1}`,
            content_json: { type: 'doc', content: [] },
            content_html: `<p>English content ${index + 1}</p>`,
            og_image_url: '',
            created_at: isoDaysAgo(index + 2),
            updated_at: isoDaysAgo(index + 1),
          },
          {
            id: `blog-${index + 1}-pl`,
            blog_post_id: `blog-${index + 1}`,
            lang: 'pl',
            slug: `przewodnik-cypr-${index + 1}`,
            title: `Przewodnik Cypr ${index + 1}`,
            meta_title: '',
            meta_description: `Meta PL ${index + 1}`,
            summary: `Podsumowanie PL ${index + 1}`,
            lead: `Lead PL ${index + 1}`,
            author_name: '',
            author_url: '',
            content_json: { type: 'doc', content: [] },
            content_html: `<p>Polska treść ${index + 1}</p>`,
            og_image_url: '',
            created_at: isoDaysAgo(index + 2),
            updated_at: isoDaysAgo(index + 1),
          },
        ]));

        translations.push(
          {
            id: 'blog-pending-en',
            blog_post_id: 'blog-pending',
            lang: 'en',
            slug: 'partner-pending-story',
            title: 'Partner Pending Story',
            meta_title: '',
            meta_description: 'Partner pending meta',
            summary: 'Partner pending summary',
            lead: 'Partner pending lead',
            author_name: 'Partner Lefkara',
            author_url: 'https://partner.example.com',
            content_json: { type: 'doc', content: [] },
            content_html: '<p>Pending partner article</p>',
            og_image_url: '',
            created_at: isoDaysAgo(1),
            updated_at: isoDaysAgo(1),
          },
          {
            id: 'blog-pending-pl',
            blog_post_id: 'blog-pending',
            lang: 'pl',
            slug: 'partnerska-opowiesc-oczekujaca',
            title: 'Partnerska opowieść oczekująca',
            meta_title: '',
            meta_description: 'Meta partner oczekujący',
            summary: 'Podsumowanie partnera',
            lead: 'Lead partnera',
            author_name: 'Partner Lefkara',
            author_url: 'https://partner.example.com',
            content_json: { type: 'doc', content: [] },
            content_html: '<p>Oczekujący artykuł partnera</p>',
            og_image_url: '',
            created_at: isoDaysAgo(1),
            updated_at: isoDaysAgo(1),
          }
        );

        stub.seedTable('blog_post_translations', translations);
        stub.seedTable('trips', [
          {
            id: 'trip-1',
            slug: 'lefkara-day-trip',
            title: { en: 'Lefkara Day Trip', pl: 'Wycieczka Lefkara' },
            description: { en: 'Trip EN', pl: 'Trip PL' },
            cover_image_url: 'https://stub.local/trip.webp',
            photos: [],
            pricing_model: 'per_person',
            start_city: 'Larnaca',
            updated_at: isoDaysAgo(1),
          },
        ]);
        stub.seedTable('hotels', [
          {
            id: 'hotel-1',
            slug: 'lefkara-stay',
            title: { en: 'Lefkara Stay', pl: 'Nocleg Lefkara' },
            description: { en: 'Stay EN', pl: 'Stay PL' },
            city: 'Lefkara',
            cover_image_url: 'https://stub.local/hotel.webp',
            photos: [],
            updated_at: isoDaysAgo(1),
          },
        ]);
        stub.seedTable('car_offers', [
          {
            id: 'car-1',
            car_model: 'Kia Picanto',
            car_type: 'Mini',
            location: 'Larnaca',
            image_url: 'https://stub.local/car.webp',
            price_per_day: 40,
            updated_at: isoDaysAgo(1),
          },
        ]);
        stub.seedTable('pois', [
          {
            id: 'poi-1',
            slug: 'lefkara-center',
            name_en: 'Lefkara Center',
            name_pl: 'Centrum Lefkary',
            description_en: 'POI EN',
            description_pl: 'POI PL',
            main_image_url: 'https://stub.local/poi.webp',
            photos: [],
            city: 'Lefkara',
            updated_at: isoDaysAgo(1),
          },
        ]);
        stub.seedTable('recommendations', [
          {
            id: 'rec-1',
            title_en: 'Local cafe',
            title_pl: 'Lokalna kawiarnia',
            description_en: 'Recommendation EN',
            description_pl: 'Rekomendacja PL',
            image_url: 'https://stub.local/rec.webp',
            photos: [],
            location_name: 'Lefkara',
            updated_at: isoDaysAgo(1),
          },
        ]);

        if (withAdminSessionFlag) {
          stub.setSession({ id: admin.id, email: admin.email, user_metadata: { name: 'CyprusEye Admin' } });
        } else {
          stub.setSession(null);
        }

        stub.__blogTestMeta = {
          adminId: admin.id,
          authorId: author.id,
          scheduledAt: isoDaysAhead(7),
        };
      },
    };
  };
}

async function prepareBlogStub(page: any, withAdminSession = false) {
  await page.addInitScript(buildSeedScript(withAdminSession), { withAdminSessionFlag: withAdminSession });
  await enableSupabaseStub(page);
}

test.describe('Blog smoke', () => {
  test('public blog list renders cards, filters and pagination', async ({ page }) => {
    await prepareBlogStub(page, false);
    await page.goto('/blog?lang=en');
    await waitForSupabaseStub(page);

    await page.waitForSelector('#blogGrid:not([hidden])');
    await expect(page.locator('.blog-card').first()).toBeVisible();
    await expect(page.locator('.blog-card__title').first()).toContainText('Cyprus Guide 1');
    await expect(page.locator('#blogPagination')).toBeVisible();

    await page.click('#blogPagination [data-blog-page="2"]');
    await expect(page).toHaveURL(/\/blog\?page=2/);
    await expect(page.locator('.blog-card__title').first()).toContainText('Cyprus Guide 13');

    await page.click('.blog-filter-chip:has-text("Lefkara")');
    await expect(page).toHaveURL(/category=Lefkara/);
  });

  test('public blog post renders author byline, CTA cards and language switch', async ({ page }) => {
    await prepareBlogStub(page, false);
    await page.goto('/blog/cyprus-guide-1?lang=en');
    await waitForSupabaseStub(page);

    await page.waitForSelector('#blogPostView:not([hidden])');
    await expect(page.locator('#blogPostTitle')).toContainText('Cyprus Guide 1');
    await expect(page.locator('#blogPostByline')).toBeVisible();
    await expect(page.locator('#blogPostAuthorName')).toContainText('Maria Guide');
    await expect(page.locator('#blogCtaGrid .blog-cta-card')).toHaveCount(3);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: 'pl' } }));
    });

    await expect(page.locator('#blogPostTitle')).toContainText('Przewodnik Cypr 1');
    await expect(page).toHaveURL(/lang=pl/);
  });

  test('admin blog view supports approve and create flow', async ({ page }) => {
    await prepareBlogStub(page, true);
    await page.route('https://esm.sh/@tiptap/**', async (route) => {
      await route.abort();
    });

    await page.goto('/admin/dashboard.html');
    await waitForSupabaseStub(page);

    await page.click('button.admin-nav-item[data-view="blog"]');
    await page.waitForSelector('#viewBlog.active');
    await expect(page.locator('#blogTableBody')).toContainText('Partner Pending Story');

    await page.locator('tr:has-text("Partner Pending Story") button:has-text("Approve")').click();
    await expect(page.locator('tr:has-text("Partner Pending Story")')).toContainText('approved');

    await page.click('#btnAddBlog');
    await page.waitForSelector('#blogFormModal:not([hidden])');

    const blogModal = page.locator('#blogFormModal');

    await blogModal.locator('#blogFormCategoriesInput').fill('Guides');
    await blogModal.locator('[data-blog-taxonomy-add="categories"]').click();
    await blogModal.locator('#blogFormCategoriesInput').fill('Testing');
    await blogModal.locator('[data-blog-taxonomy-add="categories"]').click();

    await blogModal.locator('#blogFormTagsInput').fill('blog');
    await blogModal.locator('[data-blog-taxonomy-add="tags"]').click();
    await blogModal.locator('#blogFormTagsInput').fill('smoke');
    await blogModal.locator('[data-blog-taxonomy-add="tags"]').click();

    await blogModal.locator('[name="title_pl"]').fill('Nowy wpis testowy');
    await blogModal.locator('[name="summary_pl"]').fill('Podsumowanie PL');
    await blogModal.locator('[name="lead_pl"]').fill('Lead PL. Dalsza część leadu.');
    await expect(blogModal.locator('[data-blog-editor-fallback="pl"]')).toBeVisible();
    await blogModal.locator('[data-blog-editor-fallback="pl"]').fill('<p>Treść PL</p>');

    await blogModal.locator('[data-blog-section-toggle="seo"]').click();
    await blogModal.locator('[name="meta_description_pl"]').fill('Meta opis PL');

    await blogModal.locator('#blogFormTranslationContent .lang-tab[data-field="blogTranslation"][data-lang="en"]').click();
    await blogModal.locator('[name="title_en"]').fill('New smoke post');
    await blogModal.locator('[name="summary_en"]').fill('Summary EN');
    await blogModal.locator('[name="lead_en"]').fill('Lead EN. More copy follows.');
    await expect(blogModal.locator('[data-blog-editor-fallback="en"]')).toBeVisible();
    await blogModal.locator('[data-blog-editor-fallback="en"]').fill('<p>Content EN</p>');
    await blogModal.locator('[name="meta_description_en"]').fill('Meta description EN');

    await page.click('#btnPublishBlog');
    await expect(blogModal).toBeHidden();
    await expect(page.locator('#blogTableBody')).toContainText('New smoke post');
  });
});
