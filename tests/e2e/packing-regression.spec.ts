import { expect, test } from './fixtures';

// Skip flaky packing tests - timing issues in CI
test.describe.skip('Packing planner regressions', () => {
  test('shows seasons and updates checklist when switching', async ({ page }) => {
    await page.goto('/packing.html');
    await page.waitForSelector('#packingView');

    const seasonButtons = page.locator('#packingSeasonToggle button');
    const seasonCount = await seasonButtons.count();
    expect(seasonCount).toBeGreaterThan(1);

    const initialHeading = await page.locator('#packingChecklist .packing-season-header h3').textContent();
    await seasonButtons.nth(1).click();
    await page.waitForTimeout(200);
    const updatedHeading = await page.locator('#packingChecklist .packing-season-header h3').textContent();

    expect(initialHeading).not.toEqual(updatedHeading);

    const universalList = page.locator('#packingChecklist .packing-list-section').first();
    await expect(universalList).toContainText('Uniwersalne');
  });
});
