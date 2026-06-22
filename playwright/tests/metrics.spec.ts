import { test, expect, dismissWelcome } from '../fixtures/test';

test('metrics screenshots', async ({ page }) => {
  await page.goto('/ui/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  await expect(page).toHaveScreenshot('agentgateway-ui-tools-jwt.png', { fullPage: true });
  await expect(page).toHaveScreenshot('agentgateway-ui-tool-echo-hello.png', { fullPage: true });
});
