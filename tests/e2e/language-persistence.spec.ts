import { expect, test } from '@playwright/test';

test('language selection persists between packing and achievements pages', async ({ page }) => {
  await page.goto('/packing.html');
  const switcher = page.locator('#languageSwitcherSelect');
  await switcher.waitFor();

  await expect(page.locator('html')).toHaveAttribute('lang', /en|pl/);

  const initialValue = await switcher.inputValue();
  const targetLanguage = initialValue === 'pl' ? 'en' : 'pl';

  await Promise.all([
    page.waitForNavigation(),
    switcher.selectOption(targetLanguage),
  ]);

  await switcher.waitFor();
  await expect(page.locator('html')).toHaveAttribute('lang', targetLanguage);
  await expect(switcher).toHaveValue(targetLanguage);

  const achievementsLink = page.locator('a[href*="achievements"]').first();
  await Promise.all([
    page.waitForNavigation(),
    achievementsLink.click(),
  ]);

  await switcher.waitFor();
  await expect(page).toHaveURL(/achievements\.html/);
  await expect(page.locator('html')).toHaveAttribute('lang', targetLanguage);
  await expect(page.locator('#languageSwitcherSelect')).toHaveValue(targetLanguage);

  await page.goto('/packing.html');
  await switcher.waitFor();
  await expect(page.locator('html')).toHaveAttribute('lang', targetLanguage);
  await expect(page.locator('#languageSwitcherSelect')).toHaveValue(targetLanguage);
});
