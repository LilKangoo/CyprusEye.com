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

  test('final step ends at top with highlighted login button', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('body[data-seo-page="home"]');
    await page.click('#tutorialHelpButton');

    const nextButton = page.locator('.tutorial-button-next');
    for (let i = 0; i < 9; i += 1) {
      await nextButton.click();
    }

    const loginTarget = page.locator('[data-tour-target="login-button"]');
    await expect(page.locator('.tutorial-step-meta')).toContainText('10/10');
    await expect(loginTarget).toHaveClass(/tutorial-target-active/);

    const top = await loginTarget.evaluate((node) => node.getBoundingClientRect().top);
    expect(top).toBeLessThan(220);
  });
});
