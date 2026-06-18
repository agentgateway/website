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

export async function dismissWelcome(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: /skip setup/i });
  await skip.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await skip.count()) {
    await skip.click();
    await page.locator('.startup-shell').waitFor({ state: 'detached' }).catch(() => {});
  }
}
