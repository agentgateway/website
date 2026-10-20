import { test, expect, dismissWelcome, uiTabsOnly } from '../fixtures/test';
import type { Locator, Page } from '@playwright/test';

/**
 * "UI" tab captures for the standalone traffic guides (batch e):
 *   - configuration/gateways.md: "Add listeners to a gateway" (Edit listener drawer) and
 *     "Attach policies to a gateway" (the gateway's CORS policy form).
 *   - configuration/routes.md: "TCP routes" (Add route drawer, TCP kind).
 *   - configuration/traffic-management/matching.md: path, header, method, and query matching,
 *     and TCP hostname matching and weighted backend routing.
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-e.yaml (docs 1.7 and later). The listeners guide is in
 * ui-tabs-e-listeners.spec.ts and the binds migration in ui-tabs-e-binds.spec.ts, because each
 * needs its own fixture.
 *
 * Every drawer is filled in but NEVER saved, so the fixture is unchanged between runs and the
 * captures stay deterministic. The values match each section's YAML example.
 *
 * Produces (light + dark per project): ui-gateways-listener.png, ui-gateways-cors.png,
 * ui-routes-tcp.png, ui-matching-path.png, ui-matching-headers.png, ui-matching-method.png,
 * ui-matching-query.png, ui-matching-tcp-hostname.png, ui-matching-tcp-weights.png.
 */

async function openGateways(page: Page) {
  await page.goto('/ui/traffic/gateways');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Traffic Gateways', exact: true })).toBeVisible();
}

async function openAddRoute(page: Page): Promise<Locator> {
  await page.goto('/ui/traffic/routes');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Traffic Routes', exact: true })).toBeVisible();
  // The empty state has a second Add route button in the page body.
  await page.getByRole('button', { name: /add route/i }).first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Add route' })).toBeVisible();
  return drawer;
}

async function pick(page: Page, drawer: Locator, combobox: string, option: string | RegExp) {
  await drawer.getByRole('combobox', { name: combobox, exact: true }).click();
  await page.getByRole('option', { name: option }).click();
}

/** Pin a drawer section heading to the top of the drawer body, and wait until it moved. */
async function scrollToSection(drawer: Locator, heading: string) {
  const body = drawer.locator('.drawer-body');
  await drawer.getByRole('heading', { name: heading, exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // The last click leaves the pointer over whatever scrolled under it (a hover state shows
  // the Weight spinner arrows), so park it outside the drawer.
  await drawer.page().mouse.move(0, 0);
}

/** Scroll the drawer body back to the top (adding a backend scrolls it down). */
async function scrollToTop(drawer: Locator) {
  const body = drawer.locator('.drawer-body');
  await body.evaluate((el) => { el.scrollTop = 0; });
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(0);
}

/** Add one condition row (header or query) and fill it. */
async function addCondition(drawer: Locator, kind: 'header' | 'query', index: number, name: string, value: string, regex: boolean) {
  const label = kind === 'header' ? 'Header' : 'Query';
  await drawer.getByRole('button', { name: `Add ${kind}` }).click();
  await drawer.getByRole('textbox', { name: `${label} name` }).nth(index).fill(name);
  const valueBox = drawer.getByRole('textbox', { name: `${label} value` }).nth(index);
  await valueBox.fill(value);
  if (regex) {
    // The Regex checkbox is styled inside its label, so click the label in the same row.
    const row = valueBox.locator('xpath=ancestor::div[contains(@class, "match-row")][1]');
    await row.locator('label.regex-toggle').click();
    await expect(row.getByRole('checkbox')).toBeChecked();
  }
}

async function addBackend(drawer: Locator, index: number, host: string) {
  await drawer.getByRole('button', { name: 'Add backend' }).click();
  const field = drawer.getByPlaceholder('localhost:8080', { exact: true }).nth(index);
  await field.fill(host);
  await field.blur();
}

test.describe('UI tabs: gateways', () => {
  uiTabsOnly();

  // configuration/gateways.md, "Add listeners to a gateway": listener1 of the web gateway
  // becomes the discrete HTTPS listener for a.example.com with the ./certs/ files.
  test('edit listener', async ({ page }) => {
    await openGateways(page);
    const card = page.getByRole('heading', { name: 'web', exact: true }).locator('xpath=ancestor::*[.//table][1]');
    await card.getByRole('button', { name: 'Edit listener' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { name: 'Edit listener' })).toBeVisible();
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('discrete');
    await pick(page, drawer, 'Protocol', 'HTTPS');
    await drawer.getByRole('textbox', { name: 'Hostname', exact: true }).fill('a.example.com');
    await drawer.getByText('TLS', { exact: true }).click();
    await drawer.getByRole('textbox', { name: 'Certificate', exact: true }).fill('./certs/cert-a.pem');
    const key = drawer.getByRole('textbox', { name: 'Key', exact: true });
    await key.fill('./certs/key-a.pem');
    await key.blur();
    await expect(page).toHaveScreenshot('ui-gateways-listener.png');
  });

  // configuration/gateways.md, "Attach policies to a gateway": the CORS form of the default
  // gateway, with https://app.example.com, GET and POST, and "Allow all request headers" off.
  test('gateway cors policy', async ({ page }) => {
    await openGateways(page);
    // default is the first gateway card in the fixture.
    await page.getByRole('button', { name: 'Edit gateway' }).first().click();
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('default');
    await page.getByRole('button', { name: /gateway policies/i }).click();
    await page.getByText('CORS', { exact: true }).first().click();
    const form = page.getByRole('dialog').getByRole('dialog');
    await expect(form.getByRole('heading', { name: 'CORS' })).toBeVisible();
    await form.getByRole('textbox', { name: 'http://localhost:19000' }).fill('https://app.example.com');
    await form.getByRole('button', { name: 'Add', exact: true }).first().click();
    await expect(form.getByRole('button', { name: 'Remove https://app.example.com' })).toBeVisible();
    await form.getByRole('checkbox', { name: /allow all request headers/i }).uncheck();
    // Move focus off the checkbox so no focus ring shows.
    await form.getByRole('heading', { name: 'CORS' }).click();
    await expect(page).toHaveScreenshot('ui-gateways-cors.png');
  });
});

test.describe('UI tabs: routes and matching', () => {
  uiTabsOnly();

  // configuration/routes.md, "TCP routes": the postgres-backend route on postgres-proxy.
  test('tcp route', async ({ page }) => {
    const drawer = await openAddRoute(page);
    await pick(page, drawer, 'Route kind', 'TCP');
    await pick(page, drawer, 'Gateway', /^postgres-proxy/);
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('postgres-backend');
    await addBackend(drawer, 0, 'postgres.example.com:5432');
    await expect(drawer.getByRole('spinbutton', { name: 'Weight' })).toHaveValue('1');
    await expect(page).toHaveScreenshot('ui-routes-tcp.png');
  });

  // traffic-management/matching.md, "Path matching": the api-exact route, an Exact match on
  // /api/v1/users. The backend is filled in but sits below the fold.
  test('path match', async ({ page }) => {
    const drawer = await openAddRoute(page);
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('api-exact');
    await pick(page, drawer, 'Path match', 'Exact');
    const path = drawer.getByRole('textbox', { name: 'Path', exact: true });
    await path.fill('/api/v1/users');
    await addBackend(drawer, 0, 'api.example.com:8080');
    await scrollToTop(drawer);
    await expect(page).toHaveScreenshot('ui-matching-path.png');
  });

  // traffic-management/matching.md, "Header matching": the multi-header route, a regex
  // Authorization condition and an exact Content-Type condition.
  test('header match', async ({ page }) => {
    const drawer = await openAddRoute(page);
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('multi-header');
    await drawer.getByRole('textbox', { name: 'Path', exact: true }).fill('/api');
    await addCondition(drawer, 'header', 0, 'Authorization', '^Bearer .*', true);
    await addCondition(drawer, 'header', 1, 'Content-Type', 'application/json', false);
    await addBackend(drawer, 0, 'api.example.com:8080');
    await scrollToSection(drawer, 'Headers');
    await expect(page).toHaveScreenshot('ui-matching-headers.png');
  });

  // traffic-management/matching.md, "Method matching": the get-only route.
  test('method match', async ({ page }) => {
    const drawer = await openAddRoute(page);
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('get-only');
    await drawer.getByRole('textbox', { name: 'Path', exact: true }).fill('/api');
    const method = drawer.getByRole('textbox', { name: 'Method', exact: true });
    await method.fill('GET');
    await addBackend(drawer, 0, 'api.example.com:8080');
    await scrollToTop(drawer);
    await expect(page).toHaveScreenshot('ui-matching-method.png');
  });

  // traffic-management/matching.md, "Query parameter matching": the multi-query route, an
  // exact version=v1 condition and a regex format condition.
  test('query match', async ({ page }) => {
    const drawer = await openAddRoute(page);
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('multi-query');
    await drawer.getByRole('textbox', { name: 'Path', exact: true }).fill('/api');
    await addCondition(drawer, 'query', 0, 'version', 'v1', false);
    await addCondition(drawer, 'query', 1, 'format', '^(json|xml)$', true);
    await addBackend(drawer, 0, 'api.example.com:8080');
    await scrollToSection(drawer, 'Query');
    await expect(page).toHaveScreenshot('ui-matching-query.png');
  });

  // traffic-management/matching.md, "Hostname matching" (TCP routes): database-backend on
  // database-proxy for db.example.com.
  test('tcp hostname match', async ({ page }) => {
    const drawer = await openAddRoute(page);
    await pick(page, drawer, 'Route kind', 'TCP');
    await pick(page, drawer, 'Gateway', /^database-proxy/);
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('database-backend');
    await drawer.getByRole('textbox', { name: 'Hostnames', exact: true }).fill('db.example.com');
    await addBackend(drawer, 0, 'postgres.example.com:5432');
    await expect(page).toHaveScreenshot('ui-matching-tcp-hostname.png');
  });

  // traffic-management/matching.md, "Backend routing" (TCP routes): redis-cluster with three
  // weighted backends (1:2:1). Three backend rows do not fit the 720px viewport, so this one
  // capture uses a taller page to show the whole list.
  test('tcp weighted backends', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    const drawer = await openAddRoute(page);
    await pick(page, drawer, 'Route kind', 'TCP');
    await pick(page, drawer, 'Gateway', /^redis-proxy/);
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('redis-cluster');
    const backends: Array<[string, string]> = [
      ['redis-1.example.com:6379', '1'],
      ['redis-2.example.com:6379', '2'],
      ['redis-3.example.com:6379', '1'],
    ];
    for (const [i, [host, weight]] of backends.entries()) {
      await addBackend(drawer, i, host);
      const w = drawer.getByRole('spinbutton', { name: 'Weight' }).nth(i);
      await w.fill(weight);
      await w.blur();
    }
    await scrollToTop(drawer);
    await expect(drawer.getByPlaceholder('localhost:8080', { exact: true }).nth(2)).toHaveValue('redis-3.example.com:6379');
    await expect(page).toHaveScreenshot('ui-matching-tcp-weights.png');
  });
});
