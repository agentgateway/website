import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Cost dashboard captures for llm/cost-controls/dashboard.md.
 *
 * The dashboard is the LLM > Analytics page (`/ui/llm/analytics`) — "Analyze LLM traffic by
 * model, user, and provider". serve-costs-ui.sh pre-seeds the request-log database with
 * deterministic traffic (scripts/seed-costs-db.mjs), so the chart, group-by controls, and
 * breakdown are all populated without sending live traffic.
 *
 *   CAPTURE_MODE=costs npm run test:costs
 *
 * The seeded row MAGNITUDES are deterministic (fixed-seed generator) — the summary totals and
 * per-group breakdown are identical every run — but the rows' distribution across the 24h
 * "Traffic over time" buckets tracks wall-clock, so the bars shift run-to-run. A looser
 * maxDiffPixelRatio tolerates that chart drift while still catching real layout regressions.
 */
const CHART_DRIFT = { maxDiffPixelRatio: 0.35, fullPage: true };

async function openAnalytics(page) {
  await page.goto('/ui/llm/analytics');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  // The seeded dataset (800 calls) has loaded once the summary line renders.
  await expect(page.getByText(/800 calls/)).toBeVisible();
}

async function setMeasure(page, value: string) {
  await page.getByRole('combobox', { name: 'Measure' }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}

// Default view: token volume and traffic over time, with the group-by and measure controls.
test('cost dashboard — tokens', async ({ page }) => {
  await openAnalytics(page);
  await expect(page).toHaveScreenshot('ui-cost-dashboard-tokens.png', CHART_DRIFT);
});

// Same dashboard measured in dollars — realized spend over time and per breakdown.
test('cost dashboard — cost', async ({ page }) => {
  await openAnalytics(page);
  await setMeasure(page, 'Cost');
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('ui-cost-dashboard-cost.png', CHART_DRIFT);
});
