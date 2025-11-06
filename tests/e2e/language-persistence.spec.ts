import { expect, test } from '@playwright/test';

test('language selection persists between packing and achievements pages', async ({ page }) => {
  await page.goto('/packing.html');
  const toggle = page.locator('[data-testid="language-switcher-toggle"]');
  await toggle.waitFor();

  await expect(page.locator('html')).toHaveAttribute('lang', /en|pl/);

  const initialLanguage = (await toggle.getAttribute('data-language')) ?? 'pl';
  const targetLanguage = initialLanguage === 'pl' ? 'en' : 'pl';

  await toggle.click();
  const targetOption = page.locator(`[data-testid="language-option-${targetLanguage}"]`);
  await targetOption.waitFor();
  await targetOption.click();

  await page.waitForFunction(
    (lang) => document.documentElement.lang === lang,
    targetLanguage,
  );
  await expect(toggle).toHaveAttribute('data-language', targetLanguage);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  const achievementsLink = page.locator('a[href*="achievements"]').first();
  await Promise.all([
    page.waitForNavigation(),
    achievementsLink.click(),
  ]);

  const toggleAfterNav = page.locator('[data-testid="language-switcher-toggle"]');
  await toggleAfterNav.waitFor();
  await expect(page).toHaveURL(/achievements\.html/);
  await expect(page.locator('html')).toHaveAttribute('lang', targetLanguage);
  await expect(toggleAfterNav).toHaveAttribute('data-language', targetLanguage);

  await page.goto('/packing.html');
  const toggleAfterReturn = page.locator('[data-testid="language-switcher-toggle"]');
  await toggleAfterReturn.waitFor();
  await expect(page.locator('html')).toHaveAttribute('lang', targetLanguage);
  await expect(toggleAfterReturn).toHaveAttribute('data-language', targetLanguage);
});
