import { test, expect } from '../fixtures/test';

/**
 * First-run "Welcome to Agentgateway" wizard, as the standalone quickstarts describe it.
 *
 * This is the one spec that must NOT call dismissWelcome() — the overlay is the subject, not
 * an obstacle. The LLM and MCP quickstarts both send the reader through this screen ("On the
 * first run, the Welcome to Agentgateway wizard opens…"), so one capture serves both guides:
 * the wizard is identical until the reader clicks a capability.
 *
 * The capture is taken untouched, before any row is enabled, because that is the state the
 * reader lands on. serve-welcome-ui.sh guarantees it by wiping a private runtime dir and
 * starting the gateway with no -f, so the config bootstraps fresh every run.
 *
 * The heading assertion is load-bearing rather than decorative. The wizard only renders while
 * no capability is enabled, so a stale config makes it silently absent — and a fullPage
 * screenshot of the ordinary Gateway Overview would still pass the diff on a first capture,
 * committing the wrong baseline. Failing on the missing heading turns that into a red test.
 * fixtures/test.ts documents the same class of bug for the dismissal path.
 */
test('first-run welcome wizard', async ({ page }) => {
  await page.goto('/ui/');
  await page.waitForLoadState('networkidle');

  await expect(
    page.getByRole('heading', { name: /welcome to agentgateway/i }),
    'welcome wizard did not render — the gateway booted with a config that already enables a ' +
      'capability, so this run would capture the Gateway Overview instead of the wizard'
  ).toBeVisible();

  await expect(page).toHaveScreenshot('ui-welcome-wizard.png', { fullPage: true });
});
