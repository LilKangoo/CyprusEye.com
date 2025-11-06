import { expect, test } from '@playwright/test';
import { disableTutorial } from './utils/disable-tutorial';

test.describe('Home page regressions', () => {
  test.beforeEach(async ({ page }) => {
    await disableTutorial(page);
    await page.goto('/index.html');
    await page.waitForSelector('body[data-seo-page="home"]');
  });

  test('displays the interactive map container', async ({ page }) => {
    const map = page.locator('#map');
    await expect(map).toBeVisible();

    const boundingBox = await map.boundingBox();
    expect(boundingBox?.height ?? 0).toBeGreaterThan(200);
    expect(boundingBox?.width ?? 0).toBeGreaterThan(200);
  });

  test('opens the explorer modal with attraction cards', async ({ page }) => {
    const explorerToggle = page.locator('#explorerToggle');
    await explorerToggle.click();

    const explorerModal = page.locator('#explorerModal');
    await expect(explorerModal).toBeVisible();

    const explorerCards = page.locator('#explorerGrid .explorer-card');
    await expect(explorerCards.first()).toBeVisible();
  });

  test('SOS quick access button reveals emergency information', async ({ page }) => {
    const sosButton = page.locator('#sosToggle');
    await sosButton.click();

    const sosModal = page.locator('#sosModal');
    await expect(sosModal).toBeVisible();
    await expect(sosModal).toContainText('112');
  });
});
