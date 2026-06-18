import { test, expect, dismissWelcome } from '../fixtures/test';

test('openapi screenshots', async ({ page }) => {
  await page.goto('/ui/playground/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  await expect(page).toHaveScreenshot('agentgateway-ui-tools-openapi.png', { fullPage: true });
  await expect(page).toHaveScreenshot('agentgateway-ui-tools-openapi-success.png', { fullPage: true });
});
