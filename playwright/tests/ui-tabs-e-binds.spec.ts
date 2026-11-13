import { test, expect, dismissWelcome, uiTabsOnly } from '../fixtures/test';

/**
 * "UI" tab capture for configuration/gateways.md, "Migrate from binds" (batch e). Runs under
 * CAPTURE_MODE=fixture FIXTURE=ui-tabs-e-binds.yaml (docs 1.7 and later): the guide's binds example,
 * with no gateways, which is what makes Traffic > Gateways show the "Detected legacy binds
 * config" banner.
 *
 * The capture opens Review migration and shows the "Migrate binds to gateways" diff. It is
 * NEVER saved, so the fixture keeps its binds between runs.
 *
 * Produces (light + dark per project): ui-gateways-migrate-binds.png.
 */
test.describe('UI tabs: migrate from binds', () => {
  uiTabsOnly();

  // configuration/gateways.md, "Migrate from binds": the migration review drawer.
  test('review binds migration', async ({ page }) => {
    await page.goto('/ui/traffic/gateways');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await expect(page.getByText('Detected legacy binds config')).toBeVisible();
    await page.getByRole('button', { name: 'Review migration' }).click();
    const drawer = page.getByRole('dialog', { name: 'Migrate binds to gateways' });
    await expect(drawer).toBeVisible();
    // Wait for both sides of the diff editor to render their text.
    await expect(drawer.getByText('binds:', { exact: false }).first()).toBeVisible();
    await expect(drawer.getByText('gateways:', { exact: false }).first()).toBeVisible();
    await expect(drawer.getByText(/hidden lines/).first()).toBeVisible();
    await expect(page).toHaveScreenshot('ui-gateways-migrate-binds.png');
  });
});
