import { test, expect, dismissWelcome, mainOnly } from '../fixtures/test';

/**
 * "UI" tab capture for "Serve the UI on its own gateway"
 * (assets/agw-docs/standalone/setup/ui/gateway.md, reused by setup/ui/gateway-ui.md).
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-f-2.yaml, a config whose UI is still on the
 * default gateway and that already has the ui-gateway on 4001 from the guide's first step.
 *
 * The Public gateway dropdown is switched to ui-gateway but NEVER saved, so the fixture is
 * unchanged between runs. A separate fixture from ui-tabs-f.yaml because that one already has
 * the UI on ui-gateway, where the dropdown shows no pending change and no Save button.
 *
 * Produces (light + dark per project): ui-settings-public-gateway.png.
 */
test.describe('Settings > UI public gateway', () => {
  mainOnly();

  // setup/ui/gateway.md, "Serve the UI on its own gateway" > UI tab, step 3: select ui-gateway.
  test('public gateway', async ({ page }) => {
    await page.goto('/ui/settings/ui');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    const dropdown = page.getByRole('combobox').first();
    await expect(dropdown).toHaveText(/default/);
    await dropdown.click();
    await page.getByRole('option', { name: /^ui-gateway/ }).click();
    await expect(dropdown).toHaveText(/ui-gateway/);
    await expect(page.getByRole('button', { name: /save ui gateway/i })).toBeVisible();
    // No focus ring, and no hover shade: park the mouse on the empty settings column.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(330, 650);
    await expect(page).toHaveScreenshot('ui-settings-public-gateway.png');
  });
});
