import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared test fixture for the agentgateway product UI.
 *
 * Theme: the new UI (PR #2232 / howardjohn/agentgateway:sl8) does NOT honor
 * prefers-color-scheme. It is driven by `<html data-theme>` persisted in
 * localStorage['theme'], toggled by `button[aria-label="Toggle theme"]`. Verified via
 * scripts/probe-theme.mjs + scripts/probe-setup.mjs. So we seed localStorage['theme']
 * before load, keyed on the project name (…-dark vs …-light), and the UI picks it up.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const theme = test.info().project.name.includes('dark') ? 'dark' : 'light';
    await page.addInitScript((t) => {
      try {
        window.localStorage.setItem('theme', t);
      } catch {
        /* storage unavailable pre-navigation; ignore */
      }
    }, theme);
    await use(page);
  },
});

export { expect };

/**
 * Dismiss the first-run "Welcome to Agentgateway" overlay (`.startup-shell`) if present.
 * It intercepts pointer events, so any interaction spec must call this after goto. (It
 * appears whenever the gateway has no config; a populated config skips it entirely.)
 */
export async function dismissWelcome(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: /skip setup/i });
  // The overlay renders shortly after load — wait briefly for it, then dismiss.
  await skip.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await skip.count()) {
    await skip.click();
    await page.locator('.startup-shell').waitFor({ state: 'detached' }).catch(() => {});
  }
}
