import { expect, test } from './fixtures';

const HIDDEN_HE_ROUTES = [
  '/index.html?ce_he_preview=1&lang=he',
  '/car.html?ce_he_preview=1&lang=he',
  '/transport.html?ce_he_preview=1&lang=he',
  '/recommendations.html?ce_he_preview=1&lang=he',
];

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
  test('ignores public ?lang=he without hidden preview flag', async ({ page }) => {
    await page.goto('/index.html?lang=he', { waitUntil: 'domcontentloaded' });
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

  test('keeps PARTIAL pages internal-only during page-gated public rollout', async ({ page }) => {
    await page.goto('/car.html?lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-testid="language-option-he"]')).toHaveCount(0);
    const rollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(rollout?.pageReadiness?.key).toBe('car');
    expect(rollout?.pageReadiness?.status).toBe('partial');
    expect(rollout?.publicSurfaces?.switcher).toBe(false);
    expect(rollout?.publicSurfaces?.routes).toBe(false);

    await page.goto('/trip.html?slug=trasa-skaa-afrodyty&lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
    const tripRollout = await page.evaluate(() => (window as any).CELanguageRollout?.snapshot?.().he);
    expect(tripRollout?.pageReadiness?.key).toBe('trip');
    expect(tripRollout?.pageReadiness?.status).toBe('partial');
    expect(tripRollout?.publicSurfaces?.switcher).toBe(false);
    expect(tripRollout?.publicSurfaces?.routes).toBe(false);
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
    const readyDestinations = ['/transport.html', '/hotels.html', '/recommendations.html'];
    for (const pathname of readyDestinations) {
      expect(findInternal(pathname)?.lang).toBe('he');
    }

    const nonReadyDestinations = ['/index.html', '/car.html', '/trips.html', '/shop.html', '/community.html', '/tasks.html', '/partners/'];
    for (const pathname of nonReadyDestinations) {
      const link = findInternal(pathname);
      if (link) {
        expect(link.lang).not.toBe('he');
      }
    }

    const blogLinks = links.filter((link) => link.pathname === '/blog' || link.pathname === '/blog.html');
    expect(blogLinks.length).toBeGreaterThan(0);
    for (const link of blogLinks) {
      expect(link.lang).not.toBe('he');
    }

    const helperResult = await page.evaluate(() => ({
      shop: (window as any).CELanguage?.buildLocalizedUrl?.('/shop.html', 'he'),
      car: (window as any).CELanguage?.buildLocalizedUrl?.('/car.html', 'he'),
      hotels: (window as any).CELanguage?.buildLocalizedUrl?.('/hotels.html', 'he'),
      blog: (window as any).CELanguage?.buildLocalizedUrl?.('/blog', 'he'),
    }));
    expect(helperResult.shop).toBe('/shop.html?lang=en');
    expect(helperResult.car).toBe('/car.html?lang=en');
    expect(helperResult.hotels).toBe('/hotels.html?lang=he');
    expect(helperResult.blog).toBe('/blog?lang=en');
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

  test('keeps blocked Blog pages out of hidden HE preview', async ({ page }) => {
    await allowInternalHiddenPreview(page);

    await page.goto('/blog.html?ce_he_preview=1&lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');
    const readiness = await page.evaluate(() => (window as any).CELanguageRollout?.getHePageReadiness?.());
    expect(readiness?.key).toBe('blog');
    expect(readiness?.status).toBe('blocked');
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

    await page.goto('/index.html?ce_he_preview=1&lang=he', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).not.toHaveAttribute('dir', 'rtl');

    await page.evaluate(() => window.localStorage.setItem('ce_he_beta', 'true'));
    await page.goto('/index.html?lang=he', { waitUntil: 'domcontentloaded' });
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
