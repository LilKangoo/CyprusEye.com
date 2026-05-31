import { expect, test } from './fixtures';

const HIDDEN_HE_ROUTES = [
  '/index.html?ce_he_preview=1&lang=he',
  '/blog.html?ce_he_preview=1&lang=he',
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
