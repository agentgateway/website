import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Kubernetes (xds) read-only UI captures.
 *
 * Unlike the standalone specs, this one does NOT launch its own server — there is no
 * fixture/launcher that reproduces a control-plane + proxy. Point it at a live proxy's
 * Admin UI via kubectl port-forward, with webServer.reuseExistingServer attaching to it:
 *
 *   kubectl port-forward deployment/agentgateway-proxy -n agentgateway-system 15000:15000 &
 *   UI_BASE_URL=http://localhost:15000 npm run test:kube
 *
 * The cluster must be populated (Gateway + HTTPRoutes + backends + an AgentgatewayPolicy)
 * so the read-only Traffic views render content. In xds mode the UI nav is only
 * Home / Listeners / Routes / Policies / CEL Playground; there is no MCP/LLM playground.
 */

// Each capture is its own test (fresh page); reuse the standalone-light/dark projects so
// `npm run sync-docs` (PROJECT_FOR is hardcoded to standalone-*) publishes them unchanged.

test('kube gateway overview (landing)', async ({ page }) => {
  await page.goto('/ui/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Gateway Overview' })).toBeVisible();
  await expect(page.getByText(/Readonly mode/i)).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-kube-landing.png', { fullPage: true });
});

test('kube traffic listeners', async ({ page }) => {
  await page.goto('/ui/traffic/listeners');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Traffic Listeners' })).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-kube-listeners.png', { fullPage: true });
});

test('kube traffic routes', async ({ page }) => {
  await page.goto('/ui/traffic/routes');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Traffic Routes' })).toBeVisible();
  await expect(page.getByText('mcp', { exact: true })).toBeVisible();
  await expect(page.getByText('openai', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-kube-routes.png', { fullPage: true });
});

test('kube traffic policies', async ({ page }) => {
  await page.goto('/ui/traffic/policies');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Policies' })).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-kube-policies.png', { fullPage: true });
});

test('kube cel playground', async ({ page }) => {
  await page.goto('/ui/cel');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page).toHaveScreenshot('agentgateway-ui-kube-cel.png', { fullPage: true });
});

// Per-guide route detail drawers. The Routes view opens a read-only drawer (route + backend
// YAML) when you click a row's view icon. Each guide embeds the drawer for its own route, so
// the screenshot is unique per guide. Requires the mcp, openai, and httpbin routes to exist.
// `name` is the exact route name shown in the first column; the drawer is `aside.drawer`.
for (const { route, image } of [
  { route: 'mcp', image: 'agentgateway-ui-kube-route-mcp.png' },
  { route: 'openai', image: 'agentgateway-ui-kube-route-llm.png' },
  { route: 'httpbin', image: 'agentgateway-ui-kube-route-http.png' },
]) {
  test(`kube route detail: ${route}`, async ({ page }) => {
    await page.goto('/ui/traffic/routes');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    const row = page.locator('table tbody tr', { hasText: route }).first();
    await row.getByRole('button').last().click();
    const drawer = page.locator('aside.drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('ROUTE YAML')).toBeVisible();
    await expect(drawer).toHaveScreenshot(image);
  });
}
