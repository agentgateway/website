import { test, expect, dismissWelcome, maskSession, selectTool } from '../fixtures/test';

/**
 * Capture for the MULTIPLEX (virtual MCP) guide — content/docs/standalone/main/mcp/connect/virtual.md.
 * Two targets (`time` + `everything`) are federated into one backend, so tools appear
 * prefixed: `time_get_current_time`, `everything_echo`, etc.
 *
 * Run with the backends up (CAPTURE_MODE=virtual): `npm run test:virtual`. See
 * scripts/serve-virtual-ui.sh — server-everything (:3005) + mock-mcp-time (:3006).
 *
 * New-UI flow: /ui/mcp/playground → Apply CORS → Initialize → the Result panel lists all
 * tools from both targets → select a tool, fill its argument, Call tool.
 *
 * Images (light + dark per project):
 *   ui-playground-multi-tools.png       — "N tools discovered" listing time_* and everything_*
 *   agentgateway-ui-tool-echo-hello.png — everything_echo result ("Echo: hello world")
 *   ui-tool-time-current.png            — time_get_current_time result
 */
test.describe('Virtual MCP (multiplex) playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui/mcp/playground');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);

    // Allow the playground's browser origin on the MCP CORS policy if prompted. This
    // rewrites the gateway config and hot-reloads it, so let it settle before initializing.
    const applyCors = page.getByRole('button', { name: /apply cors/i });
    if (await applyCors.count()) {
      await applyCors.click();
      await expect(applyCors).toBeHidden();
      await page.waitForTimeout(2_000); // gateway reload settle
    }

    // Open the MCP session; the button flips Initialize -> Reset when connected. Retry to
    // absorb a reload-induced upstream blip.
    await expect(async () => {
      await page.getByRole('button', { name: /initialize/i }).click();
      await expect(page.getByRole('button', { name: /^reset$/i })).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('multiplexed tools discovered from both targets', async ({ page }) => {
    await expect(page.getByText(/tools discovered/i)).toBeVisible();
    // Prefixed tool names prove the federation: one from each target.
    await expect(page.getByText('everything_echo')).toBeVisible();
    await expect(page.getByText('time_get_current_time')).toBeVisible();
    await expect(page).toHaveScreenshot('ui-playground-multi-tools.png', {
      fullPage: true,
      ...maskSession(page),
    });
  });

  test('run the everything_echo tool', async ({ page }) => {
    await selectTool(page, 'everything_echo');
    await page.locator('.tool-arguments-form input, .tool-arguments-form textarea').first().fill('hello world');
    await page.getByRole('button', { name: /call tool/i }).click();

    await expect(page.getByText(/HTTP 200/)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.mcp-text-output')).toContainText('hello world');
    await expect(page).toHaveScreenshot('agentgateway-ui-tool-echo-hello.png', {
      fullPage: true,
      ...maskSession(page),
    });
  });

  test('run the time_get_current_time tool', async ({ page }) => {
    await selectTool(page, 'time_get_current_time');
    await page.locator('.tool-arguments-form input, .tool-arguments-form textarea').first().fill('America/New_York');
    await page.getByRole('button', { name: /call tool/i }).click();

    await expect(page.getByText(/HTTP 200/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/tool output/i)).toBeVisible();
    await expect(page).toHaveScreenshot('ui-tool-time-current.png', {
      fullPage: true,
      ...maskSession(page),
    });
  });
});
