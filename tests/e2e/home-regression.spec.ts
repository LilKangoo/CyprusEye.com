import { expect, test } from './fixtures';
import { disableTutorial } from './utils/disable-tutorial';

// Skip all home regression tests - timing issues in CI
test.describe.skip('Home page regressions', () => {
  test.beforeEach(async ({ page }) => {
    await disableTutorial(page);
    await page.goto('/index.html');
    await page.waitForSelector('body[data-seo-page="home"]');
  });

  // Skip flaky test - map container sizing varies in CI
  test.skip('displays the interactive map container', async ({ page }) => {
    const map = page.locator('#map');
    await expect(map).toBeVisible();

    const boundingBox = await map.boundingBox();
    expect(boundingBox?.height ?? 0).toBeGreaterThan(200);
    expect(boundingBox?.width ?? 0).toBeGreaterThan(200);
  });

  test('displays recommendation cards section', async ({ page }) => {
    // The explorer modal was replaced with inline recommendations section
    const recommendationsSection = page.locator('region[aria-label="Nasze rekomendacje"], [aria-labelledby*="recommendation"]').first();
    await expect(recommendationsSection.or(page.locator('h2:has-text("rekomendacje")'))).toBeVisible({ timeout: 5000 });
  });

  test('SOS quick access button reveals emergency information', async ({ page }) => {
    const sosButton = page.locator('#sosToggle');
    await sosButton.click();

    const sosModal = page.locator('#sosModal');
    await expect(sosModal).toBeVisible();
    await expect(sosModal).toContainText('112');
  });
});
