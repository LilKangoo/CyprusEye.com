import { expect, test } from './fixtures';

const HIDDEN_HE_ROUTES = [
  '/index.html?ce_he_preview=1&lang=he',
  '/car.html?ce_he_preview=1&lang=he',
  '/transport.html?ce_he_preview=1&lang=he',
  '/recommendations.html?ce_he_preview=1&lang=he',
];

const STAGE33_TRIP_FIXTURE_ROWS = [
  {
    id: '2d937b4f-3da7-4fed-bc06-bdc66eb25612',
    slug: 'trasa-skaa-afrodyty',
    is_published: true,
    title: {
      pl: 'Trasa Skała Afrodyty',
      en: "Aphrodite's Rock route",
      he: 'מסלול סלע אפרודיטה',
    },
    description: {
      pl: 'Krótki opis trasy do Skały Afrodyty.',
      en: "Short route overview for Aphrodite's Rock.",
      he: 'סקירה קצרה של המסלול לסלע אפרודיטה.',
    },
    start_city: 'Paphos',
    pricing_model: 'per_person',
    price_per_person: 45,
  },
  {
    id: 'not-ready-trip',
    slug: 'wyjazd-indywidualny-8h',
    is_published: true,
    title: {
      pl: 'Wyjazd indywidualny 8h',
      en: 'Private 8h trip',
    },
    description: {
      pl: 'Ten rekord nie ma jeszcze treści HE.',
      en: 'This record does not have HE content yet.',
    },
    start_city: 'Larnaca',
    pricing_model: 'per_hour',
    price_base: 60,
  },
];

async function seedStage33TripFixtures(page) {
  await page.addInitScript((rows) => {
    const seedTrips = (stub) => {
      if (stub && typeof stub.seedTable === 'function') {
        stub.seedTable('trips', rows);
      }
    };
    const existing = (window as any).__supabaseStub || {};
    const previousOnReady = existing.onReady;
    existing.onReady = (stub) => {
      if (typeof previousOnReady === 'function') {
        previousOnReady(stub);
      }
      seedTrips(stub);
    };
    (window as any).__supabaseStub = existing;
    seedTrips(existing);
  }, STAGE33_TRIP_FIXTURE_ROWS);
}

async function seedBlogRecordGatingFixtures(page) {
  await page.addInitScript(() => {
    const notReadyPost = {
      id: 'blog-record-gated-not-ready',
      status: 'published',
      submission_status: 'approved',
      published_at: new Date(Date.now() - 86400000).toISOString(),
      cover_image_url: 'https://stub.local/blog/record-gated.webp',
      cover_image_alt: { en: 'Record gated blog cover', pl: 'Okładka wpisu' },
      featured: true,
      allow_comments: false,
      categories: ['Guides'],
      categories_pl: ['Poradniki'],
      categories_en: ['Guides'],
      categories_he: ['מדריכים'],
      tags: ['cyprus'],
      tags_pl: ['cypr'],
      tags_en: ['cyprus'],
      tags_he: ['קפריסין'],
      cta_services: [],
      author_profile_id: '',
      owner_partner_id: null,
      reviewed_at: new Date(Date.now() - 86400000).toISOString(),
      reviewed_by: 'admin',
      rejection_reason: null,
      created_at: new Date(Date.now() - 172800000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    };
    const readyPost = {
      ...notReadyPost,
      id: 'blog-record-gated-ready',
      cover_image_url: 'https://stub.local/blog/ready-he.webp',
      cover_image_alt: { en: 'Ready Hebrew blog cover', he: 'תמונת כתבה בעברית' },
      featured: false,
      categories_he: ['מדריכים'],
      tags_he: ['קפריסין'],
    };
    const translations = [
      {
        id: 'blog-record-gated-1-en',
        blog_post_id: notReadyPost.id,
        lang: 'en',
        slug: 'english-only-guide',
        title: 'English only guide',
        meta_title: '',
        meta_description: 'English meta description',
        summary: 'English summary',
        lead: 'English lead',
        author_name: 'CyprusEye',
        author_url: '',
        content_json: { type: 'doc', content: [] },
        content_html: '<p>English article body.</p>',
        og_image_url: '',
        created_at: notReadyPost.created_at,
        updated_at: notReadyPost.updated_at,
      },
      {
        id: 'blog-record-gated-1-he-draft',
        blog_post_id: notReadyPost.id,
        lang: 'he',
        slug: 'hebrew-draft-guide',
        title: 'טיוטה בעברית',
        meta_title: '',
        meta_description: '',
        summary: 'תקציר טיוטה',
        lead: 'פתיח טיוטה',
        author_name: 'CyprusEye',
        author_url: '',
        content_json: { type: 'doc', content: [] },
        content_html: '<p>טיוטה שאינה public_ready.</p>',
        og_image_url: '',
        review_status: 'needs_review',
        created_at: notReadyPost.created_at,
        updated_at: notReadyPost.updated_at,
      },
      {
        id: 'blog-record-gated-2-en',
        blog_post_id: readyPost.id,
        lang: 'en',
        slug: 'ready-hebrew-guide',
        title: 'Ready Hebrew guide source',
        meta_title: 'Ready Hebrew guide source',
        meta_description: 'English fallback meta for a manually reviewed Hebrew article.',
        summary: 'English fallback summary.',
        lead: 'English fallback lead.',
        author_name: 'CyprusEye',
        author_url: '',
        content_json: { type: 'doc', content: [] },
        content_html: '<p>English fallback article body.</p>',
        og_image_url: '',
        created_at: readyPost.created_at,
        updated_at: readyPost.updated_at,
      },
      {
        id: 'blog-record-gated-2-he-ready',
        blog_post_id: readyPost.id,
        lang: 'he',
        slug: 'hebrew-ready-guide',
        title: 'מדריך עברי מוכן',
        meta_title: '',
        meta_description: '',
        summary: '',
        lead: 'פתיח עברי שנבדק ידנית.',
        author_name: 'CyprusEye',
        author_url: '',
        content_json: { type: 'doc', content: [] },
        content_html: '<p>גוף כתבה עברי שאושר ידנית.</p>',
        og_image_url: '',
        review_status: 'public_ready',
        created_at: readyPost.created_at,
        updated_at: readyPost.updated_at,
      },
    ];

    const seedBlog = (stub) => {
      if (stub && typeof stub.seedTable === 'function') {
        stub.seedTable('blog_posts', [notReadyPost, readyPost]);
        stub.seedTable('blog_post_translations', translations);
      }
    };
    const existing = (window as any).__supabaseStub || {};
    const previousOnReady = existing.onReady;
    existing.onReady = (stub) => {
      if (typeof previousOnReady === 'function') {
        previousOnReady(stub);
      }
      seedBlog(stub);
    };
    (window as any).__supabaseStub = existing;
    seedBlog(existing);
  });
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(4);
}

async function waitForHtmlLanguage(page, language: string) {
  await page.waitForFunction((expected) => document.documentElement.lang === expected, language, {
    timeout: 5000,
  });
}

async function expectHeSwitcherVisible(page) {
  await page.waitForFunction(() => (
    document.querySelectorAll('[data-testid="language-option-he"], [data-testid="language-pill-he"], [data-language-pill="he"], [data-language="he"]').length > 0
  ), null, { timeout: 5000 });
}

async function expectVisibleTextToExclude(page, forbiddenSnippets: string[]) {
  const text = await page.locator('body').evaluate((body) => (body.textContent || '').replace(/\s+/g, ' ').trim());
  for (const snippet of forbiddenSnippets) {
    expect(text).not.toContain(snippet);
  }
  expect(text).not.toMatch(/\bundefined\b|\bnull\b/i);
}

async function allowInternalHiddenPreview(page) {
  await page.addInitScript(() => {
    (window as any).CE_LANGUAGE_ROLLOUT_CONFIG = {
      he: {
        mode: 'internal_only',
        switcher: false,
        routes: false,
        publicApi: false,
        seo: false,
        sitemap: false,
        hreflang: false,
        canonical: false,
        indexing: false,
        hiddenPreview: true,
      },
    };
  });
}

test.describe('hidden Hebrew rollout guard', () => {
  test.describe.configure({ timeout: 60000 });

  test('offers HE in first-visit language selector and starts Home in HE/RTL', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('ce_lang_selected');
      window.localStorage.removeItem('ce_lang');
      window.localStorage.removeItem('ce_language');
      window.localStorage.removeItem('ce_selected_language');
    });

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const heOption = page.locator('.language-selector-option[data-language="he"]');
    await expect(heOption).toHaveCount(1);
    await heOption.click();
    await waitForHtmlLanguage(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectHeSwitcherVisible(page);
    await page.waitForFunction(() => window.localStorage.getItem('ce_lang_selected') === 'true');
  });

  test('blocks public ?lang=he on pages that are not HE-ready', async ({ page }) => {
    await page.goto('/plan.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-testid="language-option-he"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(0);
  });

  test('enables public page-gated HE only on READY pages', async ({ page }) => {
    await page.goto('/transport.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectHeSwitcherVisible(page);
    let rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.mode).toBe('partial_public');
    expect(rollout?.pageReadiness?.key).toBe('transport');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);
    expect(rollout?.publicSurfaces?.seo).toBe(false);

    await page.goto('/hotels.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('hotels');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);

    await page.goto('/hotel.html?slug=rgb-cabins-larnaka-centrum&lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('hotel');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);

    await page.goto('/recommendations.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('recommendations');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);
  });

  test('enables controlled Home HE while keeping all other partial pages gated', async ({ page }) => {
    await seedStage33TripFixtures(page);

    await page.goto('/index.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectHeSwitcherVisible(page);
    const rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('home');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);
    expect(rollout?.publicSurfaces?.seo).toBe(false);
    const heConfig = await page.evaluate(() => (window as any).CE_LANGUAGE_ROLLOUT_CONFIG?.he);
    expect(heConfig?.allowPartialPagesPublic).toBe(false);

    await page.goto('/car.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    const carRollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(carRollout?.pageReadiness?.key).toBe('car');
    expect(carRollout?.pageReadiness?.status).toBe('record-gated');
    expect(carRollout?.publicSurfaces?.switcher).toBe(true);
    expect(carRollout?.publicSurfaces?.routes).toBe(true);

    await page.goto('/trips.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    const tripsRollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(tripsRollout?.pageReadiness?.key).toBe('trips');
    expect(tripsRollout?.pageReadiness?.status).toBe('record-gated');
    expect(tripsRollout?.publicSurfaces?.switcher).toBe(true);
    expect(tripsRollout?.publicSurfaces?.routes).toBe(true);

  });

  test('applies Home HE aggregation without enabling all partial pages', async ({ page }) => {
    await seedStage33TripFixtures(page);

    await page.goto('/index.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await page.waitForFunction(() => document.documentElement.dataset.heHomeAggregation === 'prepared', null, {
      timeout: 5000,
    });

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.home-blog-section')).toHaveAttribute('hidden', '');
    await expect(page.locator('#openPackingFromAdventure')).toHaveAttribute('hidden', '');
    await expect(page.locator('#openTasksFromAdventure')).toHaveAttribute('hidden', '');
    await expect(page.locator('[data-tour-target="plan-card"]')).toHaveAttribute('hidden', '');
    await expect(page.locator('[data-tour-target="blog-card"]')).toHaveAttribute('hidden', '');
    await expectNoHorizontalOverflow(page);

    const rolloutConfig = await page.evaluate(() => (window as any).CE_LANGUAGE_ROLLOUT_CONFIG?.he);
    expect(rolloutConfig?.allowPartialPagesPublic).toBe(false);
    expect(rolloutConfig?.pageReadiness?.home?.status).toBe('ready');

    const helperResult = await page.evaluate(() => ({
      transport: (window as any).CELanguage?.buildLocalizedUrl?.('/transport.html', 'he'),
      hotels: (window as any).CELanguage?.buildLocalizedUrl?.('/hotels.html', 'he'),
      recommendations: (window as any).CELanguage?.buildLocalizedUrl?.('/recommendations.html', 'he'),
      car: (window as any).CELanguage?.buildLocalizedUrl?.('/car.html', 'he'),
      trips: (window as any).CELanguage?.buildLocalizedUrl?.('/trips.html', 'he'),
      blog: (window as any).CELanguage?.buildLocalizedUrl?.('/blog', 'he'),
      shop: (window as any).CELanguage?.buildLocalizedUrl?.('/shop.html', 'he'),
      plan: (window as any).CELanguage?.buildLocalizedUrl?.('/plan.html', 'he'),
      community: (window as any).CELanguage?.buildLocalizedUrl?.('/community.html', 'he'),
      tasks: (window as any).CELanguage?.buildLocalizedUrl?.('/tasks.html', 'he'),
    }));

    expect(helperResult.transport).toBe('/transport.html?lang=he');
    expect(helperResult.hotels).toBe('/hotels.html?lang=he');
    expect(helperResult.recommendations).toBe('/recommendations.html?lang=he');
    expect(helperResult.car).toBe('/car.html?lang=he');
    expect(helperResult.trips).toBe('/trips.html?lang=he');
    expect(helperResult.blog).toBe('/blog?lang=he');
    expect(helperResult.shop).toBe('/shop.html?lang=en');
    expect(helperResult.plan).toBe('/plan.html?lang=en');
    expect(helperResult.community).toBe('/community.html?lang=en');
    expect(helperResult.tasks).toBe('/tasks.html?lang=en');

    const mobileLinks = await page.locator('.mobile-nav-link').evaluateAll((links) => (
      links.map((link) => {
        const url = new URL((link as HTMLAnchorElement).href, window.location.origin);
        return { pathname: url.pathname, lang: url.searchParams.get('lang') || '' };
      })
    ));
    const byPath = (pathname: string) => mobileLinks.find((link) => link.pathname === pathname);
    expect(byPath('/transport.html')?.lang).toBe('he');
    expect(byPath('/car.html')?.lang).toBe('he');
    expect(byPath('/trips.html')?.lang).toBe('he');
    expect(byPath('/community.html')?.lang).toBe('en');
    expect(byPath('/packing.html')?.lang).toBe('en');
    expect(byPath('/tasks.html')?.lang).toBe('en');
  });

  test('keeps visible HE UI free of known PL/EN fallback leftovers', async ({ page }) => {
    await seedStage33TripFixtures(page);

    await page.goto('/index.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await page.waitForTimeout(1000);
    await expectVisibleTextToExclude(page, [
      'Udostępnij lokalizację',
      'Włącz lokalizację',
      'Find your car in 15 seconds',
      'Choose route and timing first',
      'Passengers',
      'Pickup date',
      'Pickup time',
      'Return date',
      'Return time',
      'Pickup location',
      'Return location',
      'Reset finder',
      'Choose route to unlock cars',
      'Complete the route and dates to unlock matching cars and final prices',
      'Car rental in Cyprus',
      'Explore the fleet, compare prices, and book a car on the dedicated page',
      'GO TO RENTAL',
      'Recommended',
      'Wybierz lokalizację',
      'Oferta Larnaka',
      'Strefa Pafos',
    ]);

    await page.goto('/car.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await page.waitForTimeout(1000);
    await expectVisibleTextToExclude(page, [
      'Wybierz daty i trasę',
      'Oferta: Larnaka',
      'Wybierz lokalizację',
      'Young driver / licence',
      'Young driver / license',
      'Full AC insurance',
      'Full insurance',
      'Choose dates and route',
      'Pickup location',
      'Return location',
    ]);

    await page.goto('/recommendations.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await page.waitForTimeout(1000);
    await expectVisibleTextToExclude(page, [
      'Recommended',
      'Show code',
      'Open in maps',
      'Visit website',
      'View details',
      'Zapisz',
      'Polecane',
    ]);
  });

  test('blocks direct HE for unready trip records', async ({ page }) => {
    await seedStage33TripFixtures(page);

    await page.goto('/trip.html?slug=wyjazd-indywidualny-8h&lang=he', {
      waitUntil: 'commit',
      timeout: 15000,
    });
    await page.waitForFunction(() => (
      new URL(window.location.href).searchParams.get('lang') === 'en'
        && document.documentElement.lang === 'en'
        && document.documentElement.dir === 'ltr'
    ), null, { timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
  });

  test('strips HE from links to non-ready destinations on READY HE pages', async ({ page }) => {
    await page.goto('/transport.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await page.waitForTimeout(500);

    const links = await page.evaluate(() => (
      Array.from(document.querySelectorAll('a[href]')).map((anchor) => {
        const href = anchor.getAttribute('href') || '';
        try {
          const url = new URL(href, window.location.origin);
          return {
            href,
            pathname: url.pathname,
            lang: url.searchParams.get('lang') || '',
          };
        } catch (_error) {
          return { href, pathname: '', lang: '' };
        }
      })
    ));

    const findInternal = (pathname: string) => links.find((link) => link.pathname === pathname);
    const readyDestinations = ['/index.html', '/transport.html', '/hotels.html', '/recommendations.html', '/car.html', '/trips.html'];
    for (const pathname of readyDestinations) {
      expect(findInternal(pathname)?.lang).toBe('he');
    }

    const nonReadyDestinations = ['/shop.html', '/community.html', '/tasks.html', '/partners/'];
    for (const pathname of nonReadyDestinations) {
      const link = findInternal(pathname);
      if (link) {
        expect(link.lang).not.toBe('he');
      }
    }

    const blogLinks = links.filter((link) => link.pathname === '/blog' || link.pathname === '/blog.html');
    expect(blogLinks.length).toBeGreaterThan(0);
    for (const link of blogLinks) {
      expect(link.lang).toBe('he');
    }

    const helperResult = await page.evaluate(() => ({
      shop: (window as any).CELanguage?.buildLocalizedUrl?.('/shop.html', 'he'),
      car: (window as any).CELanguage?.buildLocalizedUrl?.('/car.html', 'he'),
      trips: (window as any).CELanguage?.buildLocalizedUrl?.('/trips.html', 'he'),
      hotels: (window as any).CELanguage?.buildLocalizedUrl?.('/hotels.html', 'he'),
      blog: (window as any).CELanguage?.buildLocalizedUrl?.('/blog', 'he'),
    }));
    expect(helperResult.shop).toBe('/shop.html?lang=en');
    expect(helperResult.car).toBe('/car.html?lang=he');
    expect(helperResult.trips).toBe('/trips.html?lang=he');
    expect(helperResult.hotels).toBe('/hotels.html?lang=he');
    expect(helperResult.blog).toBe('/blog?lang=he');
  });

  test('gates dynamic records for HE by record readiness', async ({ page }) => {
    await page.goto('/transport.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');

    const result = await page.evaluate(() => {
      const api = (window as any).CELanguage;
      const tripReady = {
        id: 'trip-ready',
        title: { he: 'טיול מוכן', en: 'Ready trip' },
        description: { he: 'תיאור מוכן', en: 'Ready description' },
      };
      const tripFallback = {
        id: 'trip-fallback',
        title: { en: 'Fallback trip' },
        description: { en: 'Fallback description' },
      };
      const tripPlainFallback = {
        id: 'trip-plain-fallback',
        title: 'Plain source trip',
        description: 'Plain source description',
      };
      const carReady = {
        id: 'car-ready',
        car_model: 'Mazda CX5',
        features: { he: ['מיזוג אוויר', '5 מקומות'], en: ['AC', '5 seats'] },
      };
      const carFallback = {
        id: 'car-fallback',
        car_model: 'Nissan Note',
        features: { en: ['AC', 'Automatic'] },
      };
      const poiReady = {
        id: 'poi-ready',
        name_i18n: { he: 'נקודה מוכנה', en: 'Ready POI' },
        description_i18n: { he: 'תיאור', en: 'Description' },
        badge_i18n: { he: 'תג', en: 'Badge' },
      };
      const poiFallback = {
        id: 'poi-fallback',
        name_i18n: { en: 'Fallback POI' },
        description_i18n: { en: 'Description' },
        badge_i18n: { en: 'Badge' },
      };

      return {
        tripReady: api?.isRecordReadyForLanguage?.(tripReady, 'trip', 'he'),
        tripFallback: api?.isRecordReadyForLanguage?.(tripFallback, 'trip', 'he'),
        tripPlainFallback: api?.isRecordReadyForLanguage?.(tripPlainFallback, 'trip', 'he'),
        carReady: api?.isRecordReadyForLanguage?.(carReady, 'car', 'he'),
        carFallback: api?.isRecordReadyForLanguage?.(carFallback, 'car', 'he'),
        poiReady: api?.isRecordReadyForLanguage?.(poiReady, 'poi', 'he'),
        poiFallback: api?.isRecordReadyForLanguage?.(poiFallback, 'poi', 'he'),
        filteredTrips: api?.filterRecordsReadyForLanguage?.([tripReady, tripFallback, tripPlainFallback], 'trip', 'he').map((item: any) => item.id),
        filteredPoi: api?.filterRecordsReadyForLanguage?.([poiReady, poiFallback], 'poi', 'he').map((item: any) => item.id),
        englishTrips: api?.filterRecordsReadyForLanguage?.([tripReady, tripFallback, tripPlainFallback], 'trip', 'en').map((item: any) => item.id),
      };
    });

    expect(result.tripReady).toBe(true);
    expect(result.tripFallback).toBe(false);
    expect(result.tripPlainFallback).toBe(false);
    expect(result.carReady).toBe(true);
    expect(result.carFallback).toBe(false);
    expect(result.poiReady).toBe(true);
    expect(result.poiFallback).toBe(false);
    expect(result.filteredTrips).toEqual(['trip-ready']);
    expect(result.filteredPoi).toEqual(['poi-ready']);
    expect(result.englishTrips).toEqual(['trip-ready', 'trip-fallback', 'trip-plain-fallback']);
  });

  test('renders hidden HE preview on key desktop routes without exposing switcher option', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await allowInternalHiddenPreview(page);

    for (const route of HIDDEN_HE_ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await waitForHtmlLanguage(page, 'he');

      await expect(page.locator('html')).toHaveAttribute('lang', 'he');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('[data-testid="language-option-he"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('renders hidden HE preview on mobile width without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await allowInternalHiddenPreview(page);

    await page.goto('/index.html?ce_he_preview=1&lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-testid="language-option-he"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('keeps PL and EN public languages stable', async ({ page }) => {
    await page.goto('/index.html?lang=en', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.goto('/index.html?lang=pl', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'pl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('keeps Shop out of hidden HE beta scope', async ({ page }) => {
    await page.goto('/shop.html?ce_he_preview=1&lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
  });

  test('falls back Blog list to EN when no public_ready HE posts exist', async ({ page }) => {
    await page.goto('/blog.html?lang=en', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'en');
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(0);

    await page.goto('/blog.html?lang=pl', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'pl');
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(0);

    await page.goto('/blog.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'en');

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(0);
    await expect(page.locator('#blogHeroEyebrow')).toContainText('CyprusEye Journal');
    const readiness = await page.evaluate(() => (window as any).CELanguageRollout?.getHePageReadiness?.());
    expect(readiness?.key).toBe('blog');
    expect(readiness?.status).toBe('record-gated');
  });

  test('renders manually public_ready Blog HE records without enabling Blog HE SEO', async ({ page }) => {
    await seedBlogRecordGatingFixtures(page);

    await page.goto('/blog.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');

    await expect(page.locator('#blogGrid')).toBeVisible();
    await expect(page.locator('#blogGrid')).toContainText('מדריך עברי מוכן');
    await expect(page.locator('#blogGrid')).not.toContainText('טיוטה בעברית');
    await expect(page.locator('link[rel="alternate"][hreflang="he"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog$/);

    await page.goto('/blog/hebrew-ready-guide?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');

    await expect(page.locator('#blogPostView')).toBeVisible();
    await expect(page.locator('#blogPostTitle')).toContainText('מדריך עברי מוכן');
    await expect(page.locator('#blogPostContent')).toContainText('גוף כתבה עברי');
    await expect(page.locator('link[rel="alternate"][hreflang="he"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/ready-hebrew-guide$/);
  });

  test('falls back Blog detail to EN for HE posts that are not public_ready', async ({ page }) => {
    await seedBlogRecordGatingFixtures(page);

    await page.goto('/blog/english-only-guide?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (
      document.documentElement.lang === 'en'
      && document.documentElement.dir === 'ltr'
      && new URL(window.location.href).searchParams.get('lang') !== 'he'
    ), null, { timeout: 15000 });

    await expect(page.locator('#blogPostView')).toBeVisible();
    await expect(page.locator('#blogPostTitle')).toContainText('English only guide');
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(0);
  });

  test('keeps Shop out of configured beta HE scope', async ({ page }) => {
    await page.addInitScript(() => {
      const user = {
        id: '15f3d442-092d-4eb8-9627-db90da0283eb',
        email: 'lilkangoomedia@gmail.com',
      };
      (window as any).CE_STATE = { session: { user }, user };
      (window as any).CE_CURRENT_USER = user;
    });

    await page.goto('/shop.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-testid="language-option-he"]')).toHaveCount(0);
    const readiness = await page.evaluate(() => (window as any).CELanguageRollout?.getHePageReadiness?.());
    expect(readiness?.key).toBe('shop');
    expect(readiness?.status).toBe('excluded');
  });

  test('keeps Shop cart and checkout DOM in LTR when ?lang=he is requested', async ({ page }) => {
    await page.goto('/shop.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');

    const directions = await page.evaluate(() => {
      const directionFor = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? window.getComputedStyle(element).direction : '';
      };
      (window as any).shopOpenCart?.();
      return {
        html: document.documentElement.dir,
        body: window.getComputedStyle(document.body).direction,
        cart: directionFor('#cartSidebar'),
        checkout: directionFor('#checkoutModal'),
        checkoutHidden: document.getElementById('checkoutModal')?.hidden ?? null,
      };
    });

    expect(directions.html).toBe('ltr');
    expect(directions.body).toBe('ltr');
    expect(directions.cart).toBe('ltr');
    expect(directions.checkout).toBe('ltr');
    expect(directions.checkoutHidden).toBe(true);
  });

  test('can disable hidden preview while keeping beta-user HE access', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).CE_LANGUAGE_ROLLOUT_CONFIG = {
        he: {
          mode: 'beta',
          switcher: true,
          routes: true,
          publicApi: true,
          seo: false,
          sitemap: false,
          hreflang: false,
          canonical: false,
          indexing: false,
          hiddenPreview: false,
        },
      };
    });

    await page.goto('/blog.html?ce_he_preview=1&lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');

    await page.evaluate(() => window.localStorage.setItem('ce_he_beta', 'true'));
    await page.goto('/transport.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(1);
  });

  test('applies page-gated readiness to HE switcher and route access', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).CE_LANGUAGE_ROLLOUT_CONFIG = {
        he: {
          mode: 'beta',
          switcher: true,
          routes: true,
          publicApi: true,
          seo: false,
          sitemap: false,
          hreflang: false,
          canonical: false,
          indexing: false,
          hiddenPreview: false,
          pageGated: true,
          stage25SqlApplied: false,
        },
      };
      window.localStorage.setItem('ce_he_beta', 'true');
    });

    await page.goto('/transport.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    let rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('transport');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);
    expect(rollout?.publicSurfaces?.seo).toBe(false);

    await page.goto('/plan.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('plan');
    expect(rollout?.pageReadiness?.status).toBe('blocked');
    expect(rollout?.publicSurfaces?.switcher).toBe(false);
    expect(rollout?.publicSurfaces?.routes).toBe(false);
  });

  test('marks Stage25-dependent pages ready only after the verified SQL flag', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).CE_LANGUAGE_ROLLOUT_CONFIG = {
        he: {
          mode: 'beta',
          switcher: true,
          routes: true,
          publicApi: true,
          seo: false,
          sitemap: false,
          hreflang: false,
          canonical: false,
          indexing: false,
          hiddenPreview: false,
          pageGated: true,
          stage25SqlApplied: true,
        },
      };
      window.localStorage.setItem('ce_he_beta', 'true');
    });

    await page.goto('/hotels.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    let rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('hotels');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.pageReadiness?.stage25SqlApplied).toBe(true);
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);
    expect(rollout?.publicSurfaces?.seo).toBe(false);

    await page.goto('/recommendations.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('recommendations');
    expect(rollout?.pageReadiness?.status).toBe('ready');
    expect(rollout?.pageReadiness?.stage25SqlApplied).toBe(true);
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.routes).toBe(true);
    expect(rollout?.publicSurfaces?.seo).toBe(false);
  });

  test('allows PARTIAL pages only when public fallback is explicitly enabled', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).CE_LANGUAGE_ROLLOUT_CONFIG = {
        he: {
          mode: 'beta',
          switcher: true,
          routes: true,
          publicApi: true,
          seo: false,
          sitemap: false,
          hreflang: false,
          canonical: false,
          indexing: false,
          hiddenPreview: false,
          pageGated: true,
          stage25SqlApplied: true,
          stage33SqlApplied: false,
          allowPartialPagesPublic: true,
        },
      };
      window.localStorage.setItem('ce_he_beta', 'true');
    });

    await page.goto('/car.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    let rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('car');
    expect(rollout?.pageReadiness?.status).toBe('partial');
    expect(rollout?.publicSurfaces?.routes).toBe(true);
    expect(rollout?.publicSurfaces?.switcher).toBe(true);
    expect(rollout?.publicSurfaces?.seo).toBe(false);

    await page.goto('/trips.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('trips');
    expect(rollout?.pageReadiness?.status).toBe('partial');
    expect(rollout?.publicSurfaces?.routes).toBe(true);
    expect(rollout?.publicSurfaces?.switcher).toBe(true);

    await page.goto('/blog.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('blog');
    expect(rollout?.pageReadiness?.status).toBe('record-gated');
    expect(rollout?.publicSurfaces?.routes).toBe(false);
    expect(rollout?.publicSurfaces?.switcher).toBe(false);
    expect(rollout?.publicSurfaces?.seo).toBe(false);

    await page.goto('/shop.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('shop');
    expect(rollout?.pageReadiness?.status).toBe('excluded');
    expect(rollout?.publicSurfaces?.routes).toBe(false);
    expect(rollout?.publicSurfaces?.seo).toBe(false);
  });

  test('does not serve /he/ as a broken SPA route', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    const response = await page.goto('/he/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    expect(response?.status()).toBeLessThan(400);
    expect(new URL(page.url()).pathname).not.toMatch(/^\/he(?:\/|$)/);
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    expect(errors.filter((message) => message.includes('/he/js/') || message.includes('/he/assets/'))).toHaveLength(0);
  });

  test('does not request legacy root app.js on car page', async ({ page }) => {
    const appJsResponses: number[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/app.js') {
        appJsResponses.push(response.status());
      }
    });

    await page.goto('/car.html?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    expect(appJsResponses).toHaveLength(0);
  });

  test('keeps HE canonical and OpenGraph URL on the car SEO-ready page', async ({ page }) => {
    await page.goto('/car.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await page.waitForTimeout(500);

    const seo = await page.evaluate(() => ({
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
      heAlternate: document.querySelector('link[rel="alternate"][hreflang="he"]')?.getAttribute('href'),
    }));

    expect(seo.canonical).toBe('https://www.cypruseye.com/car.html?lang=he');
    expect(seo.ogUrl).toBe('https://www.cypruseye.com/car.html?lang=he');
    expect(seo.heAlternate).toBe('https://www.cypruseye.com/car.html?lang=he');
  });

  test('keeps HE canonical and OpenGraph URL on HE-ready trip detail', async ({ page }) => {
    await seedStage33TripFixtures(page);
    await page.goto('/trip.html?slug=trasa-skaa-afrodyty&lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');
    await page.waitForTimeout(1000);

    const seo = await page.evaluate(() => {
      const expected = new URL('/trip.html', window.location.origin);
      expected.searchParams.set('slug', 'trasa-skaa-afrodyty');
      expected.searchParams.set('lang', 'he');
      return {
        expected: expected.toString(),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
        heAlternate: document.querySelector('link[rel="alternate"][hreflang="he"]')?.getAttribute('href'),
      };
    });

    expect(seo.canonical).toBe(seo.expected);
    expect(seo.ogUrl).toBe(seo.expected);
    expect(seo.heAlternate).toBe(seo.expected);
  });

  test('allows HE only for configured beta users without enabling SEO surfaces', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).CE_LANGUAGE_ROLLOUT_CONFIG = {
        he: {
          mode: 'beta',
          switcher: true,
          routes: true,
          publicApi: true,
          seo: false,
          sitemap: false,
          hreflang: false,
          canonical: false,
          indexing: false,
          hiddenPreview: false,
        },
      };
      window.localStorage.setItem('ce_he_beta', 'true');
    });

    await page.goto('/index.html?lang=he', { waitUntil: 'domcontentloaded' });
    await waitForHtmlLanguage(page, 'he');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-testid="language-pill-he"]')).toHaveCount(1);
    const rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.publicSurfaces?.seo).toBe(false);
    expect(rollout?.publicSurfaces?.sitemap).toBe(false);
    expect(rollout?.publicSurfaces?.hreflang).toBe(false);
    expect(rollout?.publicSurfaces?.canonical).toBe(false);
    expect(rollout?.publicSurfaces?.indexing).toBe(false);
  });

  test('applies configured beta HE after allowlisted auth state arrives', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).CE_LANGUAGE_ROLLOUT_CONFIG = {
        he: {
          mode: 'beta_users',
          switcher: true,
          routes: true,
          publicApi: true,
          seo: false,
          sitemap: false,
          hreflang: false,
          canonical: false,
          indexing: false,
          hiddenPreview: false,
          pageGated: true,
          stage25SqlApplied: true,
        },
      };
    });

    await page.goto('/index.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');

    await page.evaluate(() => {
      (window as any).CE_STATE = {
        session: {
          user: {
            id: '15f3d442-092d-4eb8-9627-db90da0283eb',
            email: 'lilkangoomedia@gmail.com',
          },
        },
      };
      document.dispatchEvent(new CustomEvent('ce-auth:state', { detail: (window as any).CE_STATE }));
    });

    await waitForHtmlLanguage(page, 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
