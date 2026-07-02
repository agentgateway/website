import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Kubernetes (xds) cost-dashboard capture for kubernetes/llm/cost-controls/dashboard.md.
 *
 * Like kube-readonly.spec.ts, this does NOT launch its own server — point it at a live proxy's
 * Admin UI via kubectl port-forward, with webServer.reuseExistingServer attaching to it:
 *
 *   kubectl port-forward deployment/agentgateway-proxy -n agentgateway-system 15000:15000 &
 *   UI_BASE_URL=http://localhost:15000 npm run test:kube-costs
 *
 * The proxy must have the request-log database enabled (AgentgatewayParameters rawConfig
 * config.database) and be populated — the kube capture workflow seeds it with the deterministic
 * dataset from scripts/seed-costs-db.mjs (shipped as a ConfigMap and copied in by an init
 * container). The Analytics page then renders the same dashboard as standalone, in the K8s nav.
 *
 * The seeded totals/breakdown are deterministic; the "Traffic over time" buckets track
 * wall-clock, so a looser maxDiffPixelRatio tolerates that chart drift.
 */
const CHART_DRIFT = { maxDiffPixelRatio: 0.35, fullPage: true };

test('kube cost dashboard (analytics)', async ({ page }) => {
  await page.goto('/ui/llm/analytics');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText(/800 calls/)).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-kube-cost-dashboard.png', CHART_DRIFT);
});
