import { test, expect, dismissWelcome } from '../fixtures/test';

test('mcp playground screenshots', async ({ page }) => {
  await page.goto('/ui/playground/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  await expect(page).toHaveScreenshot('agentgateway-ui-playground.png', { fullPage: true });
  await expect(page).toHaveScreenshot('ui-playground-tools.png', {
    fullPage: true,
    mask: [page.locator('[data-testid="session-id"], .timestamp, time')]
  });
  await expect(page).toHaveScreenshot('ui-playground-tool-echo.png', { fullPage: true });
});

test('mcp virtual screenshots', async ({ page }) => {
  await page.goto('/ui/playground/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  await page.getByRole('button', { name: /connect/i }).click().catch(() => {});
  await expect(page).toHaveScreenshot('ui-playground-multi-tools.png', { fullPage: true });
  await expect(page).toHaveScreenshot('ui-tool-time-current.png', { fullPage: true });
});
