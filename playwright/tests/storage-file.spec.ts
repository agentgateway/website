import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Writable (file-backed) UI — the default storage mode that the binary and Docker
 * installations run, and the "file mode" section of the setup/storage guide.
 *
 * Run with the backend up (CAPTURE_MODE=file): `npm run test:file`. The launcher
 * (scripts/serve-file-ui.sh) mounts fixtures/file-storage-config.yaml WRITABLE with
 * `storage.mode: file`, so a UI save rewrites that YAML in place.
 *
 * This is the counterpart to storage.spec.ts, which captures the same two UI states against a
 * PostgreSQL-backed (hybrid) gateway. Capturing both is deliberate: each guide section shows
 * the target name its own steps use, so a reader following the file-mode steps never sees a
 * server called `persisted-target`.
 *
 * The flow starts on MCP > Get started rather than jumping straight to /ui/mcp/servers, because
 * clicking **Enable** there is the write that only a writable file allows — it adds the `mcp`
 * section to config.yaml. Under the Helm chart's read-only ConfigMap the same click fails with
 * "File configuration is read-only in hybrid mode", which is the contrast the guide draws.
 *
 * Both assertions read the config FILE from the host side of the launcher's mount rather than
 * trusting the list rendering: in this mode the file IS the store, so a pass means the UI write
 * actually reached the YAML.
 *
 * Known cosmetic difference, shared with storage.spec.ts: the light and dark projects run against
 * one gateway (workers: 1) and this spec mutates its config, so whichever project runs second sees
 * the server list and nav that the first one left behind. The guide renders one theme at a time,
 * so a reader never sees both — do not "fix" this by adding a settle loop, because agentgateway's
 * file reload is asynchronous and the UI can re-render either state mid-test.
 */

const SERVER_NAME = 'my-target';
const SERVER_URL = 'http://example.com/mcp';

const CONFIG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.agw-file-runtime',
  'config.yaml',
);

function configFile(): string {
  return readFileSync(CONFIG_PATH, 'utf8');
}

test('enable MCP and add a server in the UI, persisted to the config file', async ({ page }) => {
  // The fixture defines no `mcp` key at all, so the nav offers "Get started", not "Servers".
  await page.goto('/ui/mcp/get-started');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  // Enabling MCP is a one-time write, so it is only there for whichever project runs first.
  const enable = page.getByRole('button', { name: /^enable$/i });
  if (await enable.isVisible().catch(() => false)) {
    await enable.click();
    await page.waitForURL(/\/ui\/mcp\/servers/);
  }

  // Enabling the capability wrote the section into the file — impossible on a read-only mount.
  await expect(async () => expect(configFile()).toContain('mcp:')).toPass({ timeout: 15_000 });

  await page.getByRole('button', { name: /^add server$/i }).first().click();

  const name = page.getByPlaceholder('weather');
  const url = page.getByPlaceholder('http://localhost:3001/mcp');
  await name.fill(SERVER_NAME);
  await url.fill(SERVER_URL);

  // The filled form, before saving: what the guide's UI tab asks the reader to enter.
  await expect(page).toHaveScreenshot('agentgateway-ui-storage-file-add-server.png', { fullPage: true });

  await page.getByRole('button', { name: /^save server$/i }).click();
  await page.waitForLoadState('networkidle');

  // The server now appears in the list, which is only possible because the mount is writable.
  await expect(page.getByText(SERVER_NAME).first()).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-storage-file-saved.png', { fullPage: true });

  // Confirm it reached the YAML on disk, not just the rendered page.
  await expect(async () => {
    const written = configFile();
    expect(written).toContain(SERVER_NAME);
    expect(written).toContain(SERVER_URL);
  }).toPass({ timeout: 15_000 });

  // Leave the gateway roughly as this test found it — MCP enabled, no servers — so a rerun of
  // this spec against a still-running launcher starts from the same place.
  const deleted = await page.request.delete(`/api/config/resources/mcp.target/${SERVER_NAME}`);
  expect(deleted.ok()).toBeTruthy();
});
