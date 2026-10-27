import type { Page } from '@playwright/test';

import { test, expect, dismissWelcome, uiTabsOnly } from '../fixtures/test';

/**
 * "UI" tab captures for the standalone MCP server guides:
 *   - integrations/mcp/servers/http.md     "Stateless sessions", "Configure the agentgateway"
 *   - integrations/mcp/servers/openapi.md  "Configure the agentgateway", "Schema URL",
 *                                          "Inline schema" ("Stateless sessions" reuses http's)
 *   - integrations/mcp/servers/stdio.md    "Configure the agentgateway"
 *   - integrations/mcp/servers/virtual.md  "Configure the agentgateway", "Tool name prefixing"
 *
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-d.yaml (scripts/serve-fixture-ui.sh, no
 * backends), docs 1.7 and later. The fixture holds one `openapi` target with an inline schema, which the
 * Schema URL and Inline schema tabs edit. Every drawer is filled in but NEVER saved, so the
 * fixture is unchanged between runs. Values match each section's YAML example.
 *
 * Produces (light + dark per project): ui-mcp-servers-add-http.png, ui-mcp-cors-session-id.png,
 * ui-mcp-settings-stateless.png, ui-mcp-servers-add-openapi-file.png,
 * ui-mcp-servers-edit-openapi-url.png, ui-mcp-servers-edit-openapi-inline.png,
 * ui-mcp-servers-add-stdio.png, ui-mcp-servers-add-time.png, ui-mcp-settings-prefix-never.png.
 */
test.describe('MCP server UI tabs', () => {
  uiTabsOnly();

  async function openServers(page: Page) {
    await page.goto('/ui/mcp/servers');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: /mcp servers/i })).toBeVisible();
    // The fixture's target must have loaded, so the list behind the drawer is not an empty or
    // error state.
    await expect(page.getByRole('row', { name: /openapi/ })).toContainText(/ready/i);
  }

  async function addServer(page: Page, name: string, transport: string) {
    await openServers(page);
    await page.getByRole('button', { name: /^add server$/i }).first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Add MCP server')).toBeVisible();
    await drawer.getByPlaceholder('weather', { exact: true }).fill(name);
    await drawer.getByRole('button', { name: transport, exact: true }).click();
    await expect(drawer.getByRole('button', { name: transport, exact: true })).toHaveClass(/active/);
    return drawer;
  }

  async function openEdit(page: Page) {
    await openServers(page);
    await page.getByRole('row', { name: /openapi/ }).getByRole('button').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Edit MCP server')).toBeVisible();
    await expect(drawer.getByPlaceholder('weather', { exact: true })).toHaveValue('openapi');
    return drawer;
  }

  async function openSettings(page: Page) {
    await openServers(page);
    await page.getByRole('button', { name: /^settings$/i }).first().click();
    const drawer = page.getByRole('dialog');
    // MCP behavior (State mode, Prefix mode, Failure mode, SSE keep-alive) starts collapsed, so
    // expand it, as the guides' steps tell the reader to.
    const behavior = drawer.getByRole('button', { name: /^MCP behavior\b/ });
    await expect(behavior).toHaveAttribute('aria-expanded', 'false');
    await behavior.click();
    await expect(behavior).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('combobox', { name: 'State mode', exact: true })).toBeVisible();
    return drawer;
  }

  // Park the pointer on the drawer title so no button the test clicked keeps a hover state.
  async function capture(page: Page, name: string) {
    await page.mouse.move(600, 36);
    await expect(page).toHaveScreenshot(name);
  }

  async function choose(page: Page, drawer, label: string, option: string) {
    const select = drawer.getByRole('combobox', { name: label, exact: true });
    await select.click();
    // Each option's accessible name is its label followed by a description.
    await page.getByRole('listbox', { name: label, exact: true })
      .getByRole('option', { name: new RegExp(`^${option}\\b`) }).click();
    await expect(page.getByRole('listbox', { name: label, exact: true })).toHaveCount(0);
    await expect(select).toHaveText(option);
  }

  // http.md, "Configure the agentgateway" UI tab, steps 3-4: the `mcp` target on streamable HTTP.
  test('add streamable HTTP server', async ({ page }) => {
    const drawer = await addServer(page, 'mcp', 'Streamable HTTP');
    const url = drawer.getByPlaceholder('http://localhost:3001/mcp', { exact: true });
    await url.fill('http://localhost:3005/mcp/');
    await url.blur();
    await capture(page, 'ui-mcp-servers-add-http.png');
  });

  // http.md, "Configure the agentgateway" UI tab, step 5: the MCP CORS policy that allows any
  // origin and exposes the Mcp-Session-Id header.
  test('CORS policy with Mcp-Session-Id', async ({ page }) => {
    await page.goto('/ui/mcp/policies#cors');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Allowed origins', { exact: true })).toBeVisible();
    await drawer.getByPlaceholder('http://localhost:19000', { exact: true }).fill('*');
    await drawer.getByRole('button', { name: 'Add', exact: true }).first().click();
    const expose = drawer.getByPlaceholder('mcp-session-id', { exact: true });
    await expose.fill('Mcp-Session-Id');
    await drawer.getByRole('button', { name: 'Add', exact: true }).nth(1).click();
    await expect(expose).toHaveValue('');
    await expect(drawer.getByText('Mcp-Session-Id', { exact: true })).toBeVisible();
    await expose.blur();
    await capture(page, 'ui-mcp-cors-session-id.png');
  });

  // http.md, "Stateless sessions" UI tab (reused by openapi.md, "Stateless sessions").
  test('settings: stateless', async ({ page }) => {
    const drawer = await openSettings(page);
    await choose(page, drawer, 'State mode', 'Stateless');
    await capture(page, 'ui-mcp-settings-stateless.png');
  });

  // openapi.md, "Configure the agentgateway" UI tab, steps 3-5: the `openapi` target with a
  // local schema file.
  test('add OpenAPI server, schema file', async ({ page }) => {
    const drawer = await addServer(page, 'openapi', 'OpenAPI');
    await drawer.getByPlaceholder('http://localhost:3001/mcp', { exact: true }).fill('localhost:8080');
    await drawer.getByRole('button', { name: 'File', exact: true }).click();
    const schema = drawer.getByPlaceholder('/etc/agentgateway/openapi.yaml', { exact: true });
    await schema.fill('openapi.json');
    await schema.blur();
    await capture(page, 'ui-mcp-servers-add-openapi-file.png');
  });

  // openapi.md, "Schema URL" UI tab: the openapi target's schema fetched from a URL.
  test('edit OpenAPI server, schema URL', async ({ page }) => {
    const drawer = await openEdit(page);
    await drawer.getByRole('button', { name: 'URL', exact: true }).click();
    const schema = drawer.getByPlaceholder('https://example.com/openapi.json', { exact: true });
    await schema.fill('http://localhost:8080/api/v3/openapi.json');
    await schema.blur();
    await capture(page, 'ui-mcp-servers-edit-openapi-url.png');
  });

  // openapi.md, "Inline schema" UI tab: the fixture's target already holds the page's inline
  // Petstore document, so the drawer opens on Inline with that schema; nothing is typed.
  test('edit OpenAPI server, inline schema', async ({ page }) => {
    const drawer = await openEdit(page);
    await expect(drawer.getByRole('button', { name: 'Inline', exact: true })).toHaveClass(/active/);
    await expect(drawer.getByText('"operationId": "getPetById"')).toBeVisible();
    await capture(page, 'ui-mcp-servers-edit-openapi-inline.png');
  });

  // stdio.md, "Configure the agentgateway" UI tab, steps 3-4: the `everything` target run with npx.
  test('add command line server', async ({ page }) => {
    const drawer = await addServer(page, 'everything', 'Command Line');
    await drawer.getByPlaceholder('npx', { exact: true }).fill('npx');
    const args = drawer.getByPlaceholder('-y @modelcontextprotocol/server-filesystem /tmp', { exact: true });
    await args.fill('@modelcontextprotocol/server-everything');
    await args.blur();
    await capture(page, 'ui-mcp-servers-add-stdio.png');
  });

  // virtual.md, "Configure the agentgateway" UI tab, step 2: the `time` target run with uvx.
  // Step 3 (the `everything` target) is the same drawer as stdio.md's capture, so it is skipped.
  test('add command line server, time', async ({ page }) => {
    const drawer = await addServer(page, 'time', 'Command Line');
    await drawer.getByPlaceholder('npx', { exact: true }).fill('uvx');
    const args = drawer.getByPlaceholder('-y @modelcontextprotocol/server-filesystem /tmp', { exact: true });
    await args.fill('--with mcp<2 mcp-server-time');
    await args.blur();
    await capture(page, 'ui-mcp-servers-add-time.png');
  });

  // virtual.md, "Tool name prefixing" UI tab: Prefix mode Never, State mode Stateful.
  test('settings: prefix never', async ({ page }) => {
    const drawer = await openSettings(page);
    await choose(page, drawer, 'Prefix mode', 'Never');
    await choose(page, drawer, 'State mode', 'Stateful');
    await capture(page, 'ui-mcp-settings-prefix-never.png');
  });
});
