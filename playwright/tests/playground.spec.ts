import { test, expect } from '../fixtures/test';

/**
 * Example screenshot spec for the agentgateway product UI playground.
 *
 * Mirrors the manual flow documented in content/docs/standalone/latest/mcp/connect/http.md:
 *   open /ui/ -> Playground -> Connect -> see tools -> run a tool.
 *
 * SELECTORS ARE ILLUSTRATIVE. They must be matched to the real UI's DOM before this
 * runs green. Prefer role/text selectors (getByRole/getByText) over CSS so the specs
 * survive styling changes — exactly the kind of churn visual regression should ignore.
 *
 * Each toHaveScreenshot() name maps to a doc image in docs-image-map.json, so `npm run
 * sync-docs` can refresh the committed doc images from the same captures.
 */

test.describe('MCP playground', () => {
  test('listener and backend overview', async ({ page }) => {
    await page.goto('/ui/');
    await expect(page.getByRole('heading', { name: /listener|overview/i })).toBeVisible();
    // -> docs-image-map.json maps "ui-overview.png" to the docs img/ destination.
    await expect(page).toHaveScreenshot('ui-overview.png', { fullPage: true });
  });

  test('playground connect shows tools', async ({ page }) => {
    await page.goto('/ui/playground/');

    // Connection settings: pick the listener + target, then Connect.
    await page.getByRole('button', { name: /connect/i }).click();
    await expect(page.getByText(/echo/i)).toBeVisible({ timeout: 15_000 });

    await expect(page).toHaveScreenshot('ui-playground-tools.png', {
      fullPage: true,
      // Mask anything dynamic so traffic-derived values don't cause false diffs.
      mask: [page.locator('[data-testid="session-id"], time, .timestamp')],
    });
  });

  test('run the echo tool', async ({ page }) => {
    await page.goto('/ui/playground/');
    await page.getByRole('button', { name: /connect/i }).click();
    await page.getByText(/echo/i).click();
    await page.getByLabel(/message/i).fill('hello from playwright');
    await page.getByRole('button', { name: /run tool/i }).click();
    await expect(page.getByText(/hello from playwright/i)).toBeVisible();

    await expect(page).toHaveScreenshot('ui-playground-tool-echo.png', { fullPage: true });
  });
});
