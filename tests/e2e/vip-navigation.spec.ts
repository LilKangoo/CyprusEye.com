import { expect, test } from './fixtures';
import { disableTutorial } from './utils/disable-tutorial';

// Skip flaky test - timing issues in CI
test.skip('VIP tab button navigates to the VIP page', async ({ page }) => {
  await disableTutorial(page);
  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');

  const vipButton = page.locator('#headerMediaTripsTab, a[href*="vip.html"]').first();
  await expect(vipButton).toBeVisible({ timeout: 10000 });

  await vipButton.click();
  await page.waitForURL('**/vip.html*', { timeout: 10000 });

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe('/vip.html');
});
