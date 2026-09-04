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
 * Sort a table's rows by their first cell, in place, before a capture.
 *
 * The read-only Traffic views render rows in whatever order the gateway dump yields, and that
 * order is not stable between runs: the Routes table came back mcp/openai/httpbin one night and
 * httpbin/openai/mcp the next. Reordering three rows moves ~0.8% of the pixels — under
 * toHaveScreenshot's maxDiffPixelRatio (0.01), so the test still passed, but close enough to
 * sync-docs' SYNC_DIFF_RATIO that main looked "diverged" from latest on some nights and
 * "converged" on others. The img/main/ override was then added and removed on alternating
 * nightlies (added 2026-08-25, removed 08-27, re-added 08-28, removed 08-29).
 *
 * Sorting the DOM rather than masking the table keeps the docs image complete — the reader still
 * sees every route and its real values — while making the baseline deterministic. A table with
 * fewer than two rows is left alone, so this is a no-op on the single-row views and safe to call
 * on any page (it also no-ops when the view is not a table at all).
 */
export async function sortTableRows(page: Page, selector = 'table tbody'): Promise<void> {
  const rows = page.locator(`${selector} > tr`);
  await rows.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if ((await rows.count()) < 2) return;
  await page.evaluate((sel) => {
    document.querySelectorAll(sel).forEach((body) => {
      const keyOf = (tr: Element) => (tr.querySelector('td')?.textContent || '').trim();
      Array.from(body.children)
        .filter((el) => el.tagName === 'TR')
        .sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
        .forEach((tr) => body.appendChild(tr));
    });
  }, selector);
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
