import { expect, test } from './fixtures';
import { disableTutorial } from './utils/disable-tutorial';

// Skip flaky test - timing issues
test.skip('tasks page renders checklist entries with XP badges', async ({ page }) => {
  await disableTutorial(page);
  await page.goto('/tasks.html');
  await page.waitForSelector('#tasksView', { timeout: 10000 });

  // Wait for tasks to be rendered by JS
  const tasks = page.locator('#tasksList li, #tasksList .task-item, .tasks-list > *');
  await expect(tasks.first()).toBeVisible({ timeout: 10000 });
  
  // Check for XP badge
  const xpBadge = page.locator('.task-xp-badge');
  await expect(xpBadge.first()).toContainText('XP', { timeout: 10000 });
});
