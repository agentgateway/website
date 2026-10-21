import { test, expect, dismissWelcome, scrollDrawerTo } from '../fixtures/test';

/**
 * "Do it in the UI" captures for the standalone configuration guides: backends. Runs under CAPTURE_MODE=tour against fixtures/tour-config.yaml.
 *
 * The add drawers are filled in but NEVER saved, so the fixture is unchanged between runs and
 * the captures stay deterministic (the same approach as llm-add-model.spec.ts). The values match
 * each guide's YAML example, so the screenshot and the YAML on the page describe the same thing.
 *
 * The fields have no labels that Playwright can address, so they are found by placeholder. If a
 * UI release renames a placeholder, the fill times out here rather than capturing an empty form.
 *
 * Produces (light + dark per project): ui-route-weighted-backends.png. The Add gateway and Add
 * route captures need a config with no default gateway, so they live in traffic-add.spec.ts.
 */
test.describe('Traffic drawers', () => {
  async function openRoutes(page) {
    await page.goto('/ui/traffic/routes');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: /traffic routes/i })).toBeVisible();
  }

  // configuration/backends.md, "Static Hosts" — a route that splits traffic between two hosts
  // by weight. Uses the fixture's saved api-v2 route (80/20), so nothing is filled in.
  test('weighted backends', async ({ page }) => {
    await openRoutes(page);
    await page.getByRole('row', { name: /api-v2/ }).getByRole('button').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText(/edit route/i)).toBeVisible();
    // Wait for both backend rows first: scrolling while the drawer is still rendering is undone
    // when it finishes, and the capture then shows the top of the form.
    const hosts = drawer.getByPlaceholder('localhost:8080', { exact: true });
    await expect(hosts).toHaveCount(2);
    await expect(hosts.nth(1)).toHaveValue('api-v1.example.com:8080');
    // scrollIntoViewIfNeeded is a no-op here: the Backends heading already sits at the bottom
    // edge of the drawer. Pin it to the top so both backend rows and their weights fit, and
    // confirm the drawer body actually moved before capturing.
    await scrollDrawerTo(drawer, drawer.getByText('Backends', { exact: true }));
    await expect(page).toHaveScreenshot('ui-route-weighted-backends.png');
  });
});
