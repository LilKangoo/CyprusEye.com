import { expect, test } from '@playwright/test';

test('VIP tab button navigates to the VIP page', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForSelector('#languageSwitcherSelect');

  const vipButton = page.locator('#headerMediaTripsTab');
  await expect(vipButton).toBeVisible();

  await Promise.all([
    page.waitForNavigation(),
    vipButton.click(),
  ]);

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe('/vip.html');
});
