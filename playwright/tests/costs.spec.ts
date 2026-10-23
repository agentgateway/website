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

// LLM > Virtual API Keys — the keys list (assets/agw-docs/standalone/virtual-keys.md, Step 1,
// UI tab, after both keys exist). The fixture's alice and bob keys carry the name and user
// metadata that the UI steps create. Static content, so the default (tight) threshold applies.
test('virtual keys list', async ({ page }) => {
  await page.goto('/ui/llm/keys');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Virtual API Keys' })).toBeVisible();
  await expect(page.getByText('user: alice')).toBeVisible();
  await expect(page.getByRole('row', { name: /^alice\b/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /^bob\b/ })).toBeVisible();
  await expect(page).toHaveScreenshot('ui-virtual-keys-list.png', { fullPage: true });
});

// The "Create virtual key" drawer filled in for Alice, just before Save (virtual-keys.md, Step 1,
// UI tab, step 5): name alice, a custom key value, and the user: alice metadata. Never saved, so
// the fixture is unchanged and the list capture above still shows exactly two keys.
test('virtual keys — create drawer', async ({ page }) => {
  await page.goto('/ui/llm/keys');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await page.getByRole('button', { name: 'New key' }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Create virtual key' });
  await expect(drawer.getByRole('heading', { name: 'Create virtual key' })).toBeVisible();
  await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('alice');
  await drawer.getByRole('combobox', { name: 'Key value' }).click();
  await page.getByRole('option', { name: 'Use custom key' }).click();
  const keyValue = drawer.getByRole('textbox', { name: 'Key value' });
  await keyValue.fill('vk-alice-4f9c2a');
  await expect(keyValue).toHaveValue('vk-alice-4f9c2a');
  // Metadata: the two inputs are addressed by their placeholders (owner / platform).
  await drawer.getByRole('button', { name: /^Metadata/ }).click();
  await drawer.getByRole('textbox', { name: 'owner' }).fill('user');
  const metaValue = drawer.getByRole('textbox', { name: 'platform' });
  await metaValue.fill('alice');
  await drawer.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(drawer.getByText('alice', { exact: true }).last()).toBeVisible();
  // Move focus off the inputs so no focus ring shows in the published image.
  await drawer.getByRole('heading', { name: 'Create virtual key' }).click();
  // The drawer is taller than the viewport, and Name plus the metadata entry do not fit in one
  // view. Pin the Key value dropdown to the top so the image shows "Use custom key", the key,
  // and the user: alice entry; Add otherwise leaves the scroll mid-field.
  const body = drawer.locator('.drawer-body');
  await drawer.getByRole('combobox', { name: 'Key value' }).evaluate((el) => {
    const field = el.closest('.field') || el.parentElement;
    (field || el).scrollIntoView({ block: 'start' });
  });
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(page).toHaveScreenshot('ui-virtual-keys-new.png', { fullPage: true });
});

// LLM > Costs — the model cost catalog management page (llm/cost-controls/costs.md).
test('cost catalog page', async ({ page }) => {
  await page.goto('/ui/llm/costs');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'LLM Costs' })).toBeVisible();
  await expect(page.getByText('Catalog sources')).toBeVisible();
  await expect(page).toHaveScreenshot('ui-cost-catalog.png', { fullPage: true });
});
