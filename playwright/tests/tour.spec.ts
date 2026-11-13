import { test, expect, dismissWelcome, sortTableRows, scrollIntoViewChecked } from '../fixtures/test';

/**
 * UI tour captures for the standalone "Launch the UI" guide (setup/ui/launch-ui, "Tour the UI").
 * One populated gateway (fixtures/tour-config.yaml, CAPTURE_MODE=tour) feeds every page, so
 * each shot shows real rows instead of an empty state.
 *
 * Two pages are deliberately NOT captured:
 *   - Traffic > Listeners renders a "No legacy binds configured" empty state when the config
 *     uses `gateways`, which is the shape the standalone docs teach.
 *   - Traffic > Policies is the read-only xDS dump view. In standalone mode it shows only a
 *     "Readonly policies unavailable" notice. Route policies are edited in the route drawer
 *     instead, which is what ui-tour-route-policies.png shows.
 *
 * Produces (light + dark per project): ui-tour-traffic-gateways.png, ui-tour-traffic-routes.png,
 * ui-tour-route-policies.png, ui-tour-llm-models.png, ui-tour-llm-policies.png,
 * ui-tour-mcp-servers.png, ui-tour-mcp-policies.png, ui-tour-client-setup.png.
 */
test.describe('UI tour', () => {
  async function open(page, route: string, heading: RegExp) {
    await page.goto(`/ui/${route}`);
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  test('traffic gateways', async ({ page }) => {
    await open(page, 'traffic/gateways', /traffic gateways/i);
    await expect(page.getByText(/port 3000/i)).toBeVisible();
    await expect(page).toHaveScreenshot('ui-tour-traffic-gateways.png', { fullPage: true });
  });

  test('traffic routes', async ({ page }) => {
    await open(page, 'traffic/routes', /traffic routes/i);
    await expect(page.getByText('httpbin.example.com:80')).toBeVisible();
    await sortTableRows(page);
    await expect(page).toHaveScreenshot('ui-tour-traffic-routes.png', { fullPage: true });
  });

  test('route drawer shows backends and route policies', async ({ page }) => {
    await open(page, 'traffic/routes', /traffic routes/i);
    await page.getByRole('row', { name: /httpbin/ }).getByRole('button').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText(/edit route/i)).toBeVisible();
    // Route policies sit below the fold of the drawer. Wait for the policy summary first: a
    // scroll issued while the drawer is still rendering is undone when it finishes. Then scroll
    // the Backends section and the policies into view, so one capture shows where traffic goes
    // and which policies apply to it.
    await expect(drawer.getByText(/local rate limit/i)).toBeVisible();
    await scrollIntoViewChecked(drawer.getByText('Backends', { exact: true }));
    await scrollIntoViewChecked(drawer.getByText(/^route policies$/i));
    await expect(page).toHaveScreenshot('ui-tour-route-policies.png');
  });

  test('llm models', async ({ page }) => {
    await open(page, 'llm/models', /llm models/i);
    await expect(page.getByRole('cell', { name: 'gpt-4o-mini' }).first()).toBeVisible();
    await expect(page).toHaveScreenshot('ui-tour-llm-models.png', { fullPage: true });
  });

  test('llm policies', async ({ page }) => {
    await open(page, 'llm/policies', /llm policies/i);
    await expect(page.getByText('enabled', { exact: true }).first()).toBeVisible();
    // The page is a long grid of policy cards. Capture the viewport only: the first rows show
    // enabled and disabled cards side by side, which is the point of the shot.
    await expect(page).toHaveScreenshot('ui-tour-llm-policies.png');
  });

  test('mcp servers', async ({ page }) => {
    await open(page, 'mcp/servers', /mcp servers/i);
    // The state badge comes from a live connection to mock-mcp-time. Wait for it so the
    // capture never catches a transient "connecting" state.
    await expect(page.getByText('ready', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot('ui-tour-mcp-servers.png', { fullPage: true });
  });

  test('mcp policies', async ({ page }) => {
    await open(page, 'mcp/policies', /mcp policies/i);
    await expect(page.getByText('enabled', { exact: true }).first()).toBeVisible();
    await expect(page).toHaveScreenshot('ui-tour-mcp-policies.png');
  });

  test('client setup', async ({ page }) => {
    await open(page, 'llm/client-setup', /client setup/i);
    await expect(page.getByText('http://localhost:3030/v1').first()).toBeVisible();
    await expect(page).toHaveScreenshot('ui-tour-client-setup.png', { fullPage: true });
  });
});
