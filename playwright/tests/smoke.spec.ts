import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Minimal end-to-end proof: load the UI, dismiss the first-run welcome overlay, and
 * screenshot the landing page. No deep interaction selectors, so it captures against any
 * served build — used to prove the UI-source -> browser -> screenshot loop and that the
 * light/dark theme seeding works. Runs once per project → light and dark variants.
 */
test('UI landing page', async ({ page }) => {
  await page.goto('/ui/');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page).toHaveScreenshot('ui-landing.png', { fullPage: true });
});
