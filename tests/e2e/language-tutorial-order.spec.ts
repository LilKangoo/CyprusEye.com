import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supabaseStubPath = path.resolve(__dirname, '../fixtures/supabase-stub.js');
const supabaseStubSource = readFileSync(supabaseStubPath, 'utf8');

test.describe('First visit language and tutorial order', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.route('https://esm.sh/**', async (route) => {
      const url = route.request().url();
      if (url.includes('supabase')) {
        await route.fulfill({
          status: 200,
          body: supabaseStubSource,
          headers: {
            'content-type': 'application/javascript; charset=utf-8',
            'access-control-allow-origin': '*',
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.addInitScript(() => {
      window.localStorage.removeItem('seenTutorial');
      window.localStorage.removeItem('ce_lang_selected');
      window.localStorage.removeItem('ce_lang');
      window.localStorage.removeItem('cypruseye-language');
      window.localStorage.removeItem('selectedLanguage');
    });
  });

  test('waits for Polish selection before starting the tutorial', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('body[data-seo-page="home"]');

    await expect(page.locator('.language-selector-overlay.is-visible')).toBeVisible();
    await expect(page.locator('.tutorial-overlay.is-visible')).toHaveCount(0);

    await page.locator('.language-selector-option[data-language="pl"]').click();

    await expect(page.locator('.language-selector-overlay.is-visible')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.locator('.tutorial-overlay.is-visible')).toBeVisible();
    await expect(page.locator('.tutorial-button-next')).toContainText(/Dalej|Zakończ/);
  });

  test('waits for English selection before starting the tutorial', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('body[data-seo-page="home"]');

    await expect(page.locator('.language-selector-overlay.is-visible')).toBeVisible();
    await expect(page.locator('.tutorial-overlay.is-visible')).toHaveCount(0);

    await page.locator('.language-selector-option[data-language="en"]').click();

    await expect(page.locator('.language-selector-overlay.is-visible')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.tutorial-overlay.is-visible')).toBeVisible();
    await expect(page.locator('.tutorial-button-next')).toContainText(/Next|Finish/);
  });
});
