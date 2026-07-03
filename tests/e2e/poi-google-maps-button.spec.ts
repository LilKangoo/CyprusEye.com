import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const MAP_URL = 'https://maps.google.com/?cid=123456789';

const POIS = [
  {
    id: 'poi-with-map',
    name: 'Miejsce z mapą',
    name_i18n: {
      pl: 'Miejsce z mapą',
      en: 'Place with map',
      he: 'מקום עם מפה',
    },
    description: 'Opis miejsca z linkiem.',
    description_i18n: {
      pl: 'Opis miejsca z linkiem.',
      en: 'Place description with an explicit map link.',
      he: 'תיאור מקום עם קישור מפה מפורש.',
    },
    badge: 'Explorer',
    badge_i18n: {
      pl: 'Odkrywca',
      en: 'Explorer',
      he: 'חוקר',
    },
    lat: 34.75567,
    lng: 32.40417,
    google_maps_url: MAP_URL,
    google_url: null,
    xp: 100,
    required_level: 1,
    status: 'published',
    created_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'poi-without-map',
    name: 'Miejsce bez mapy',
    name_i18n: {
      pl: 'Miejsce bez mapy',
      en: 'Place without map',
      he: 'מקום בלי מפה',
    },
    description: 'Opis miejsca bez linku.',
    description_i18n: {
      pl: 'Opis miejsca bez linku.',
      en: 'Place description without a map link.',
      he: 'תיאור מקום ללא קישור מפה.',
    },
    badge: 'Explorer',
    badge_i18n: {
      pl: 'Odkrywca',
      en: 'Explorer',
      he: 'חוקר',
    },
    lat: 35.012567,
    lng: 34.058549,
    google_maps_url: null,
    google_url: null,
    xp: 100,
    required_level: 1,
    status: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

async function seedPois(page: Page) {
  await page.addInitScript((rows) => {
    const seed = (stub: any) => {
      if (!stub || typeof stub.seedTable !== 'function') return;
      if (typeof stub.reset === 'function') {
        stub.reset();
      }
      stub.seedTable('pois', rows);
      stub.seedTable('poi_categories', []);
      stub.seedTable('poi_comments', []);
      stub.seedTable('poi_ratings', []);
      stub.seedTable('poi_rating_stats', []);
      stub.seedTable('poi_comment_photos', []);
    };

    const existing = (window as any).__supabaseStub || {};
    const previousOnReady = existing.onReady;
    existing.onReady = (stub: any) => {
      if (typeof previousOnReady === 'function') {
        previousOnReady(stub);
      }
      seed(stub);
    };
    (window as any).__supabaseStub = existing;
    seed(existing);
  }, POIS);
}

async function waitForPoiRuntime(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).PLACES_DATA_LOADED), null, { timeout: 15000 });
  await page.waitForFunction(() => (
    Array.isArray((window as any).PLACES_DATA)
    && (window as any).PLACES_DATA.some((poi: any) => poi?.id === 'poi-with-map')
  ), null, { timeout: 15000 });
}

async function openIndex(page: Page, lang: 'pl' | 'en' | 'he' = 'pl') {
  await seedPois(page);
  await page.goto(`/index.html?lang=${lang}`, { waitUntil: 'domcontentloaded' });
  await waitForPoiRuntime(page);
  await page.waitForFunction(() => typeof (window as any).setCurrentPlace === 'function', null, { timeout: 15000 });
  await page.waitForFunction(() => typeof (window as any).openPoiComments === 'function', null, { timeout: 15000 });
}

async function openCommunity(page: Page, lang: 'pl' | 'en' | 'he' = 'pl') {
  await seedPois(page);
  await page.goto(`/community.html?lang=${lang}`, { waitUntil: 'domcontentloaded' });
  await waitForPoiRuntime(page);
  await page.waitForFunction(() => typeof (window as any).openPoiComments === 'function', null, { timeout: 15000 });
}

async function openCommunityHePreview(page: Page) {
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
        pageGated: true,
        pageReadiness: {
          community: {
            status: 'ready',
            allowFallback: false,
            reason: 'POI Google Maps button RTL regression preview.',
          },
        },
      },
    };
  });
  await seedPois(page);
  await page.goto('/community.html?ce_he_preview=1&lang=he', { waitUntil: 'domcontentloaded' });
  await waitForPoiRuntime(page);
  await page.waitForFunction(() => typeof (window as any).openPoiComments === 'function', null, { timeout: 15000 });
}

async function selectCurrentPlace(page: Page, poiId: string) {
  await page.evaluate((id) => {
    (window as any).setCurrentPlace(id, { force: true, focus: false });
  }, poiId);
}

async function openPoiModal(page: Page, poiId: string) {
  await page.evaluate((id) => (window as any).openPoiComments(id), poiId);
  await page.waitForSelector('#commentsModal:not([hidden])', { timeout: 15000 });
}

test.describe('POI Google Maps button', () => {
  test('index current place panel uses only explicit POI Google Maps URL', async ({ page }) => {
    await openIndex(page, 'pl');

    await selectCurrentPlace(page, 'poi-with-map');
    const currentButton = page.locator('#currentPlaceGoogleMapsBtn');
    await expect(currentButton).toBeVisible();
    await expect(currentButton).toHaveAttribute('href', MAP_URL);
    await expect(currentButton).toContainText('Otwórz w Google Maps');

    await selectCurrentPlace(page, 'poi-without-map');
    await expect(currentButton).toBeHidden();
    await expect(currentButton).not.toHaveAttribute('href', /maps\.google\.com\/\?q=35\.012567,34\.058549/);
  });

  test('index POI modal shows the button only for an explicit map URL', async ({ page }) => {
    await openIndex(page, 'en');

    await openPoiModal(page, 'poi-with-map');
    const modalButton = page.locator('#modalGoogleMapsBtn');
    await expect(modalButton).toBeVisible();
    await expect(modalButton).toHaveAttribute('href', MAP_URL);
    await expect(modalButton).toContainText('Open in Google Maps');

    await openPoiModal(page, 'poi-without-map');
    await expect(modalButton).toBeHidden();
    await expect(modalButton).not.toHaveAttribute('href', /maps\.google\.com\/\?q=35\.012567,34\.058549/);
  });

  test('community POI modal supports PL and EN labels without coordinate fallback', async ({ page }) => {
    for (const [lang, label] of [
      ['pl', 'Otwórz w Google Maps'],
      ['en', 'Open in Google Maps'],
    ] as const) {
      await openCommunity(page, lang);
      await openPoiModal(page, 'poi-with-map');

      const modalButton = page.locator('#modalGoogleMapsBtn');
      await expect(modalButton).toBeVisible();
      await expect(modalButton).toHaveAttribute('href', MAP_URL);
      await expect(modalButton).toContainText(label);

      await openPoiModal(page, 'poi-without-map');
      await expect(modalButton).toBeHidden();
      await expect(modalButton).not.toHaveAttribute('href', /maps\.google\.com\/\?q=35\.012567,34\.058549/);
    }
  });

  test('community POI modal supports HE label and RTL in internal preview', async ({ page }) => {
    await openCommunityHePreview(page);
    await openPoiModal(page, 'poi-with-map');
    const heButton = page.locator('#modalGoogleMapsBtn');
    await expect(heButton).toBeVisible();
    await expect(heButton).toHaveAttribute('href', MAP_URL);
    await expect(heButton).toContainText('פתח ב-Google Maps');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await openPoiModal(page, 'poi-without-map');
    await expect(heButton).toBeHidden();
    await expect(heButton).not.toHaveAttribute('href', /maps\.google\.com\/\?q=35\.012567,34\.058549/);
  });
});
