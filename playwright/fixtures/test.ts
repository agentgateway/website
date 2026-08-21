import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use, testInfo: TestInfo) => {
    const theme = testInfo.project.name.includes('dark') ? 'dark' : 'light';
    await page.addInitScript((value) => {
      try {
        window.localStorage.setItem('theme', value);
      } catch {
        // Ignore storage errors during startup.
      }
    }, theme);
    await use(page);
  }
});

export { expect };

/**
 * Clear the first-run "Welcome to Agentgateway" overlay.
 *
 * The overlay has two variants and which one renders depends on the config the gateway
 * booted with: an empty config offers "Skip setup", while a config that already enables a
 * capability (e.g. a gateway is defined) offers "Continue" instead. Handling only the first
 * made this a silent no-op on the second — the capture then showed the modal rather than the
 * page under test, which is a green test with the wrong image. Both are handled here.
 */
export async function dismissWelcome(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: /skip setup/i });
  await skip.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await skip.count()) {
    await skip.click();
    await page.locator('.startup-shell').waitFor({ state: 'detached' }).catch(() => {});
    return;
  }

  // "Continue" is a generic label that other pages use, so it is only safe to click while
  // the welcome heading is on screen. Gating on the heading keeps this from reaching into
  // an unrelated dialog on some future page.
  const welcome = page.getByRole('heading', { name: /welcome to agentgateway/i });
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^continue$/i }).first().click();
    await page.locator('.startup-shell').waitFor({ state: 'detached' }).catch(() => {});
  }
}

/**
 * Mask the dynamic MCP session id so it never breaks pixel baselines. The session bar
 * (`.mcp-session-bar .mono`) and the Result status (`.mcp-result-status .mono`) both render
 * the server-generated id, which changes every run. Spread into toHaveScreenshot():
 *   await expect(page).toHaveScreenshot('x.png', { fullPage: true, ...maskSession(page) });
 */
export function maskSession(page: Page) {
  return {
    mask: [
      page.locator('.mcp-session-bar .mono'),
      page.locator('.mcp-result-status .mono'),
    ],
  };
}

/**
 * Select a tool in the MCP Playground's searchable Tool dropdown. The custom `Dropdown`
 * primitive renders a `combobox` trigger labelled "Tool", a "Search Tool" combobox inside
 * the open listbox, and `option` rows labelled `${name} - ${description}`. Pass the exact
 * tool name, e.g. `everything_echo` or `time_get_current_time`.
 */
export async function selectTool(page: Page, toolName: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Tool', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search Tool', exact: true }).fill(toolName);
  await page.getByRole('option', { name: new RegExp(`^${toolName}\\b`) }).click();
}
