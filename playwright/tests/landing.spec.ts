import { test, expect, dismissWelcome } from '../fixtures/test';

test('agentgateway landing screenshot', async ({ page }) => {
  await page.goto('/ui/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page).toHaveScreenshot('agentgateway-ui-landing.png', { fullPage: true });
});
