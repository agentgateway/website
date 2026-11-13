import { test, expect, dismissWelcome, scrollIntoViewChecked } from '../fixtures/test';

/**
 * "Do it in the UI" captures for the Add gateway and Add route drawers in the standalone
 * configuration guides (configuration/gateways and configuration/routes). Runs under
 * CAPTURE_MODE=fixture FIXTURE=traffic-add.yaml, a config with only the http-proxy gateway.
 *
 * A separate fixture from tour-config.yaml because the tour config already has a default
 * gateway, which disables the Default gateway option that gateways.md selects, and it has no
 * http-proxy gateway for the routes.md route to attach to.
 *
 * The drawers are filled in but NEVER saved, so the fixture is unchanged between runs. The
 * values match each guide's YAML example, so the screenshot and the YAML on the page describe
 * the same thing.
 *
 * Produces (light + dark per project): ui-add-gateway.png, ui-add-route.png,
 * ui-add-route-backend.png.
 */
test.describe('Traffic add drawers', () => {
  // configuration/gateways.md, "Define a gateway": the default gateway on port 3000.
  test('add gateway', async ({ page }) => {
    await page.goto('/ui/traffic/gateways');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await page.getByRole('button', { name: /add gateway/i }).click();
    const drawer = page.getByRole('dialog');
    const defaultGateway = drawer.getByRole('checkbox', { name: /default gateway/i });
    await defaultGateway.check();
    // Selecting Default gateway sets the name to `default`.
    await expect(drawer.getByPlaceholder('public', { exact: true })).toHaveValue('default');
    const port = drawer.getByPlaceholder('443', { exact: true });
    await port.fill('3000');
    // Drop the focus ring so the published image shows a filled form, not a field mid-edit.
    await port.blur();
    await expect(drawer.getByRole('combobox', { name: 'Protocol' })).toHaveText(/HTTP/);
    await expect(page).toHaveScreenshot('ui-add-gateway.png');
  });

  // configuration/routes.md, "HTTP routes": the http-backend route on the http-proxy gateway.
  // Two captures because the drawer is taller than the viewport: the match fields, then the
  // backend.
  test('add route', async ({ page }) => {
    await page.goto('/ui/traffic/routes');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: /traffic routes/i })).toBeVisible();
    await page.getByRole('button', { name: /add route/i }).click();
    const drawer = page.getByRole('dialog');
    // http-proxy is the only gateway, so the drawer selects it by default.
    await expect(drawer.getByRole('combobox', { name: 'Gateway' })).toHaveText(/http-proxy/);
    await drawer.getByPlaceholder('api', { exact: true }).fill('http-backend');
    await drawer.getByPlaceholder('example.com, *.example.com', { exact: true }).fill('example.com');
    await expect(drawer.getByPlaceholder('/', { exact: true })).toHaveValue('/');
    await drawer.getByRole('button', { name: /add backend/i }).click();
    const host = drawer.getByPlaceholder('localhost:8080', { exact: true });
    await host.fill('http.example.com:8080');
    await host.blur();

    await scrollIntoViewChecked(drawer.getByText(/^name$/i).first());
    await expect(page).toHaveScreenshot('ui-add-route.png');

    await scrollIntoViewChecked(drawer.getByText('Backends', { exact: true }));
    await expect(drawer.getByPlaceholder('localhost:8080', { exact: true })).toHaveValue('http.example.com:8080');
    await expect(page).toHaveScreenshot('ui-add-route-backend.png');
  });
});
