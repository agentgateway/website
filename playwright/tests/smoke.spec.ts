import { test, expect } from '../fixtures/test';

/**
 * Minimal end-to-end proof: load the UI landing page and screenshot it. No interaction
 * selectors, so this captures successfully against any served build — used to prove the
 * built-binary -> provisioner -> browser -> screenshot loop works before investing in
 * per-screen specs with real selectors.
 *
 * Runs once per project, so it produces light and dark variants automatically.
 */
test('UI landing page', async ({ page }) => {
  await page.goto('/ui/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('ui-landing.png', { fullPage: true });
});
