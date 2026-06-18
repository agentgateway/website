import { test, expect, dismissWelcome } from '../fixtures/test';

test('a2a screenshots', async ({ page }) => {
  await page.goto('/ui/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  await expect(page).toHaveScreenshot('ui-a2a-listener.png', { fullPage: true });
  await expect(page).toHaveScreenshot('ui-a2a-route.png', { fullPage: true });
  await expect(page).toHaveScreenshot('ui-a2a-skills.png', { fullPage: true });
  await expect(page).toHaveScreenshot('ui-a2a-success.png', { fullPage: true });
});
