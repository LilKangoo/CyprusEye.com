import { expect, test } from '@playwright/test';

test('coupon page highlights offer details and purchase CTA', async ({ page }) => {
  await page.goto('/kupon.html');
  await page.waitForSelector('#couponTitle');

  await expect(page.locator('#couponSubtitle')).toBeVisible();
  await expect(page.locator('.coupon-hero-button')).toContainText(/Kup kupon|Buy coupon/);
  await expect(page.locator('#couponOffersTitle')).toBeVisible();

  const offers = page.locator('.coupon-offers-grid .coupon-offer');
  await expect(offers.first()).toBeVisible();
  await expect(offers.first()).toContainText(/-/);
});
