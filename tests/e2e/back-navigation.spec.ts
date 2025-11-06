import { expect, test } from '@playwright/test';

const BACK_LINK_SELECTOR = '[data-back-home-link]';

async function navigateWithHistory(page, targetPath) {
  await page.evaluate((nextPath) => {
    window.location.href = nextPath;
  }, targetPath);
  await page.waitForURL(`**${targetPath}**`);
}

test.describe('Back home navigation safety', () => {
  test('prefers history back when a same-origin entry exists', async ({ page }) => {
    await page.goto('/index.html');
    await navigateWithHistory(page, '/tasks.html');

    const backLink = page.locator(BACK_LINK_SELECTOR).first();
    await expect(backLink).toBeVisible();

    await backLink.click();
    await page.waitForURL('**/index.html**', { waitUntil: 'load' });

    await page.waitForTimeout(100);
    await page.goForward();
    await expect(page).toHaveURL(/\/tasks\.html$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/index\.html/);
  });

  test('falls back to adventure when there is no history entry', async ({ page }) => {
    await page.goto('/packing.html');

    const backLink = page.locator(BACK_LINK_SELECTOR).first();
    await expect(backLink).toBeVisible();

    const initialUrl = page.url();
    await backLink.click();
    await page.waitForURL('**/index.html**', { waitUntil: 'load' });

    const resultingUrl = page.url();
    expect(resultingUrl).toContain('/index.html');
    expect(resultingUrl).toContain('lang=');

    await page.goBack();
    await expect(page).toHaveURL(initialUrl);
  });
});
