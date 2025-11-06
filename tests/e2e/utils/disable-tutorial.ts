import { Page } from '@playwright/test';

/**
 * Disables the tutorial by setting the appropriate localStorage flag
 * This should be called in beforeEach or before navigating to pages
 */
export async function disableTutorial(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('seenTutorial', 'true');
  });
}

/**
 * Dismisses tutorial if it's currently shown
 */
export async function dismissTutorialIfShown(page: Page) {
  const tutorialOverlay = page.locator('.tutorial-overlay');
  const isVisible = await tutorialOverlay.isVisible().catch(() => false);
  
  if (isVisible) {
    // Try to click skip button
    const skipButton = page.locator('.tutorial-button-skip');
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click();
    }
  }
}
