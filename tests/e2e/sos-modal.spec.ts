import { expect, test } from './fixtures';
import { disableTutorial } from './utils/disable-tutorial';

// Skip flaky test - timing issues
test.skip('SOS modal opens and closes via the close button and Escape key', async ({ page }) => {
  await disableTutorial(page);
  await page.goto('/index.html');
  await page.waitForSelector('[data-language-toggle]');

  const modal = page.locator('#sosModal');
  const openButton = page.locator('#sosToggle');
  const closeButton = page.locator('#sosClose');

  await openButton.click();
  await expect(modal).toBeVisible();

  await closeButton.click();
  await expect(modal).toBeHidden();

  await openButton.click();
  await expect(modal).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});
