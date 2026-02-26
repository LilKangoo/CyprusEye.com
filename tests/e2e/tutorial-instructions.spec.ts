import { expect, test } from './fixtures';

test.describe('Home tutorial instructions', () => {
  test('opens from footer button and highlights first step target', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('body[data-seo-page="home"]');

    const trigger = page.locator('#tutorialHelpButton');
    await expect(trigger).toBeVisible();
    await trigger.click();

    await expect(page.locator('.tutorial-overlay.is-visible')).toBeVisible();
    await expect(page.locator('.tutorial-dialog')).toBeVisible();
    await expect(page.locator('.tutorial-step-meta')).toContainText('1/10');
    await expect(page.locator('[data-tour-target="top-actions"]')).toHaveClass(/tutorial-target-active/);
  });

  test('moves to next step and updates highlighted section', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('body[data-seo-page="home"]');
    await page.click('#tutorialHelpButton');

    const nextButton = page.locator('.tutorial-button-next');
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    await expect(page.locator('.tutorial-step-meta')).toContainText('2/10');
    await expect(page.locator('[data-tour-target="tabs-navigation"]')).toHaveClass(/tutorial-target-active/);
  });
});
