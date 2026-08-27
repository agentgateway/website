import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Writable (database-backed) UI — the Helm "Store config in a database" guide.
 *
 * Run with the backend up (CAPTURE_MODE=storage): `npm run test:storage`. The launcher
 * (scripts/serve-storage-ui.sh) starts PostgreSQL and points agentgateway at it with
 * `storage.mode: hybrid`, so the UI can save. In the default file-backed modes the same
 * actions fail, which is the whole point of the guide these captures illustrate.
 *
 * The final assertion reads the resource back through the config-resource API rather than
 * trusting the list rendering: that API is the database, so a pass means the UI write
 * actually persisted rather than only updating local state.
 */

const SERVER_NAME = 'persisted-target';
const SERVER_URL = 'http://example.com/mcp';

test('add an MCP server in the UI and persist it to the database', async ({ page }) => {
  await page.goto('/ui/mcp/servers');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  await page.getByRole('button', { name: /^add server$/i }).first().click();

  const name = page.getByPlaceholder('weather');
  const url = page.getByPlaceholder('http://localhost:3001/mcp');
  await name.fill(SERVER_NAME);
  await url.fill(SERVER_URL);

  // The filled form, before saving: what the guide's UI tab asks the reader to enter.
  await expect(page).toHaveScreenshot('agentgateway-ui-storage-add-server.png', { fullPage: true });

  await page.getByRole('button', { name: /^save server$/i }).click();
  await page.waitForLoadState('networkidle');

  // The server now appears in the list, which is only possible because storage is writable.
  await expect(page.getByText(SERVER_NAME).first()).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-storage-server-saved.png', { fullPage: true });

  // Confirm it reached PostgreSQL, not just the rendered page.
  const stored = await page.request.get('/api/config/resources/mcp.target');
  expect(stored.status()).toBe(200);
  const body = await stored.json();
  expect(JSON.stringify(body)).toContain(SERVER_NAME);
});
