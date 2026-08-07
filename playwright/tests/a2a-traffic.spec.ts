import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * A2A capture for the new UI.
 *
 * NOTE: the new UI (sl8) has NO A2A playground — only /llm/playground and /mcp/playground
 * exist, and the `a2a` route policy is not surfaced as its own type. So the old
 * playground images (ui-a2a-skills.png / ui-a2a-success.png) cannot be regenerated; the
 * A2A guide's UI section needs rewriting around what the new UI actually shows: the A2A
 * config as a Traffic route/listener. These are static config views, so no ADK agent or
 * backend reachability is required — see fixtures/a2a-config.yaml (localhost:9999, port 3000).
 *
 * Produces (light + dark per project): ui-a2a-route.png, ui-a2a-listener.png.
 */
test.describe('A2A traffic config', () => {
  test('route list shows the A2A backend', async ({ page }) => {
    await page.goto('/ui/traffic/routes');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: /traffic routes/i })).toBeVisible();
    await expect(page.getByText('localhost:9999')).toBeVisible();
    await expect(page).toHaveScreenshot('ui-a2a-route.png', { fullPage: true });
  });

  test('listener list shows the bind on port 3000', async ({ page }) => {
    await page.goto('/ui/traffic/listeners');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: /traffic listeners/i })).toBeVisible();
    await expect(page.getByText(/port 3000/i)).toBeVisible();
    await expect(page).toHaveScreenshot('ui-a2a-listener.png', { fullPage: true });
  });
});
