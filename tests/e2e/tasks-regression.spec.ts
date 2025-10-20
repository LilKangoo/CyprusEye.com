import { expect, test } from '@playwright/test';

test('tasks page renders checklist entries with actions', async ({ page }) => {
  await page.goto('/tasks.html');
  await page.waitForSelector('#tasksView');

  const tasks = page.locator('#tasksList .task');
  await expect(tasks.first()).toBeVisible();
  await expect(tasks.first().locator('.task-action')).toBeVisible();
  await expect(tasks.first().locator('.task-xp')).toContainText('XP');
});
