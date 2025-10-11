import { expect, test } from '@playwright/test';

test('SOS modal opens and closes via the close button and Escape key', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForSelector('#languageSwitcherSelect');

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
