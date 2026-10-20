import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { lineAtLeast } from '../scripts/resolve-image.mjs';

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
 * The first docs line whose standalone guides have the "UI" / "Config file" tabs. The tabs are
 * gated in the content with `exclude-if` on every older line; keep this value in step with
 * that gate.
 */
export const UI_TABS_SINCE = '1.7';

/** Whether DOC_VERSION is a docs line that has the "UI" tabs (see UI_TABS_SINCE). */
export function hasUiTabs(): boolean {
  return lineAtLeast(process.env.DOC_VERSION || 'latest', UI_TABS_SINCE);
}

/**
 * Skip a capture unless this run is for a docs line that has the "UI" tabs.
 *
 * The tabs are written against the nightly UI, so before UI_TABS_SINCE ships their drawers may not
 * exist, or may have other labels, in the released image that the `latest` run uses. Until then
 * only the `main` pass captures, and it writes assets/img/main/<file>, which is the only copy
 * those pages need (see "How images map to doc versions" in the README). Once the release rotates
 * n-patch.md, `latest` resolves to the new patch, the `latest` pass captures too, and sync-docs
 * publishes the bare assets/img/<file> that the released pages use. No spec edit is needed.
 */
export function uiTabsOnly(): void {
  test.skip(!hasUiTabs(), `UI-tab capture: docs ${UI_TABS_SINCE} and later only`);
}

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

/** Escape a string for use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Drop focus so no field shows a focus ring or caret in the published image. Pass `park` to also
 * move the mouse there, so the last clicked button does not keep its hover shade. Each spec parks
 * the pointer on a spot that is empty in its own captures, so the coordinates stay per spec.
 */
export async function blurAll(page: Page, park?: { x: number; y: number }): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if (park) await page.mouse.move(park.x, park.y);
}

/**
 * Scroll a drawer body so that `target` sits at its top (or as far as the body scrolls), and wait
 * until the body has moved. A scroll issued while the drawer is still rendering is undone when it
 * finishes, so wait for the content that you need before you call this.
 */
export async function scrollDrawerTo(drawer: Locator, target: Locator): Promise<void> {
  const body = drawer.locator('.drawer-body');
  await target.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
}

/** Scroll a drawer body back to the top, and wait until it is there. */
export async function scrollDrawerTop(drawer: Locator): Promise<void> {
  const body = drawer.locator('.drawer-body');
  await body.evaluate((el) => (el.scrollTop = 0));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(0);
}

/**
 * Scroll `target` into view with the least movement, like scrollIntoViewIfNeeded, and confirm
 * that it is still in the viewport afterward. Without the check, a scroll that a late render undid
 * still produced a passing capture of the wrong part of the drawer.
 */
export async function scrollIntoViewChecked(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
}

/** Open Traffic > Gateways and wait for the page heading. */
export async function openGateways(page: Page): Promise<void> {
  await page.goto('/ui/traffic/gateways');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Traffic Gateways', exact: true })).toBeVisible();
}

/** Open the Add model drawer and pick a provider from the searchable Provider dropdown. */
export async function openAddModel(page: Page, provider: string): Promise<Locator> {
  await page.goto('/ui/llm/models');
  await dismissWelcome(page);
  // The page header and the table both render an "Add model" button.
  const addModel = page.getByRole('button', { name: 'Add model', exact: true }).first();
  await expect(addModel).toBeVisible();
  await addModel.click();
  const drawer = page.getByRole('dialog', { name: 'Add model' });
  await expect(drawer.getByRole('heading', { name: 'Add model', exact: true })).toBeVisible();
  // Provider first: the editor rewrites the model match to the provider's default while it still
  // looks auto-filled, so the match is set after the provider (see llm-add-model.spec.ts).
  await drawer.getByRole('combobox', { name: 'Provider', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search Provider', exact: true }).fill(provider);
  await page.getByRole('option', { name: new RegExp(`(^|\\s)${escapeRegExp(provider)}$`) }).click();
  await expect(drawer.getByRole('combobox', { name: 'Provider', exact: true })).toHaveText(provider);
  return drawer;
}
