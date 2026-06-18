import { test as base, expect } from '@playwright/test';

/**
 * Shared test fixture. Clears the UI's persisted theme choice before each test so the
 * project's `colorScheme` (prefers-color-scheme) fully controls light vs. dark. Without
 * this, a previously toggled `agentgateway-theme` value in localStorage would override
 * the requested scheme and corrupt a baseline. Verified key name via scripts/probe-theme.mjs.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('agentgateway-theme');
      } catch {
        /* storage may be unavailable pre-navigation; ignore */
      }
    });
    await use(page);
  },
});

export { expect };
