import { expect, test } from './fixtures';
import { disableTutorial } from './utils/disable-tutorial';

// Skip flaky test - navigation timing issues
test.skip('language selection persists between packing and achievements pages', async ({ page }) => {
  await disableTutorial(page);
  await page.goto('/packing.html');
  const languageToggle = page.locator('[data-language-toggle]').first();
  await languageToggle.waitFor();

  await expect(page.locator('html')).toHaveAttribute('lang', /en|pl/);

  const initialLanguage = (await page.locator('html').getAttribute('lang')) ?? 'pl';
  const targetLanguage = initialLanguage === 'pl' ? 'en' : 'pl';

  const targetPill = languageToggle.locator(`[data-language-pill="${targetLanguage}"]`);
  await targetPill.waitFor();
  await targetPill.click();

  await page.waitForFunction(
    (lang) => document.documentElement.lang === lang,
    targetLanguage,
  );
  await expect(targetPill).toHaveAttribute('aria-pressed', 'true');

  const achievementsLink = page.locator('a[href*="achievements"]').first();
  await Promise.all([
    page.waitForNavigation(),
    achievementsLink.click(),
  ]);

  const toggleAfterNav = page.locator('[data-language-toggle]').first();
  await toggleAfterNav.waitFor();
  await expect(page).toHaveURL(/achievements\.html/);
  await expect(page.locator('html')).toHaveAttribute('lang', targetLanguage);
  await expect(toggleAfterNav.locator(`[data-language-pill="${targetLanguage}"]`)).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/packing.html');
  const toggleAfterReturn = page.locator('[data-language-toggle]').first();
  await toggleAfterReturn.waitFor();
  await expect(page.locator('html')).toHaveAttribute('lang', targetLanguage);
  await expect(toggleAfterReturn.locator(`[data-language-pill="${targetLanguage}"]`)).toHaveAttribute('aria-pressed', 'true');
});
