import { test, expect, dismissWelcome } from '../fixtures/test';

test('cel playground screenshot', async ({ page }) => {
  await page.goto('/ui/cel/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: /cel playground/i })).toBeVisible();
  await expect(page).toHaveScreenshot('cel-playground.png', { fullPage: true });
});
