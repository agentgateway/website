import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Real capture of the MCP Tool Playground, matching the flow documented in
 * content/docs/standalone/latest/mcp/connect/{http,stdio}.md (open playground, connect to
 * the MCP target, list tools, run `echo`). Selectors verified against the new UI in
 * howardjohn/agentgateway:sl8.
 *
 * Requires the gateway to have a reachable MCP target whose listener the browser can hit
 * at the SAME port the playground derives from config (mcp.port). See README → "Populated
 * MCP playground" for the docker + server-everything setup.
 *
 * New-UI flow (differs from the old "Connect" button in current docs):
 *   /ui/mcp/playground → Apply CORS (allow the UI origin) → Initialize (opens session) →
 *   tool auto-selected (echo) → fill MESSAGE → Call tool → Result shows HTTP 200 output.
 *
 * Two doc images are produced (light + dark per project):
 *   ui-playground-tools.png      — session initialized, "N tools discovered"
 *   ui-playground-tool-echo.png  — echo response in the Result panel
 */

// The session id is regenerated every run — mask it so it never breaks pixel baselines.
const maskDynamic = (page: import('@playwright/test').Page) => ({
  mask: [page.getByText(/^eyJ/)],
});

test.describe('MCP Tool Playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui/mcp/playground');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);

    // Allow the playground's browser origin on the MCP CORS policy if prompted. This
    // rewrites the gateway config and triggers a hot reload, so let it settle before
    // initializing — otherwise the first upstream MCP call can hit a dropped connection.
    const applyCors = page.getByRole('button', { name: /apply cors/i });
    if (await applyCors.count()) {
      await applyCors.click();
      await expect(applyCors).toBeHidden();
      await page.waitForTimeout(2_000); // gateway reload settle
    }

    // Open the MCP session; the button flips Initialize -> Reset when connected. Retry
    // once to absorb a reload-induced upstream blip.
    await expect(async () => {
      await page.getByRole('button', { name: /initialize/i }).click();
      await expect(page.getByRole('button', { name: /^reset$/i })).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('tools discovered after initialize', async ({ page }) => {
    await expect(page.getByText(/tools discovered/i)).toBeVisible();
    await expect(page).toHaveScreenshot('ui-playground-tools.png', {
      fullPage: true,
      ...maskDynamic(page),
    });
  });

  test('run the echo tool', async ({ page }) => {
    // echo is auto-selected as the first tool.
    await expect(page.getByText(/echo - echoes/i)).toBeVisible();
    await page.getByRole('textbox').first().fill('This is my first agentgateway setup.');
    await page.getByRole('button', { name: /call tool/i }).click();

    // Result panel returns HTTP 200 with the echoed text (no validation error).
    // HTTP 200 in the Result panel confirms the tool call succeeded (vs. a validation error).
    await expect(page.getByText(/HTTP 200/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/tool output/i)).toBeVisible();
    await expect(page).toHaveScreenshot('ui-playground-tool-echo.png', {
      fullPage: true,
      ...maskDynamic(page),
    });
  });
});
