import { test, expect, dismissWelcome } from '../fixtures/test';
import type { Page } from '@playwright/test';

/**
 * LLM > Logs captures for observability/access-logs/view.md.
 *
 * Reuses the `costs` capture mode rather than adding a launcher: serve-costs-ui.sh already
 * pre-seeds the request-log database (scripts/seed-costs-db.mjs), and the Logs page reads the
 * same `request_logs` table the Analytics page does. The seeder's three CONVERSATION rows
 * additionally carry a `request_log_payloads` entry holding a full agent-loop transcript, and
 * that is what makes the detail view render its Trajectory and Conversation sections — a row
 * with no payload shows neither.
 *
 *   CAPTURE_MODE=costs npm run test:logs
 *
 * Two things about this page that the other specs do not hit:
 *
 *  - **Never wait for `networkidle` here.** The Logs page holds an open `/api/logs/tail`
 *    stream, so the network never goes idle and the wait times out at 30s. Wait on the
 *    rendered table instead.
 *  - **The rendered clock is tolerated, not masked.** The seeded magnitudes are fixed, but the
 *    rows' timestamps track wall clock so they always land inside the page's default window.
 *    A mask would publish magenta rectangles into the docs image, so these captures keep the
 *    real timestamps and rely on the config's default diff tolerance.
 */

// The seeded magnitudes are fixed, so the only thing that moves between runs is the rendered
// clock: the list's time column ("4 minutes ago" / "Aug 26, 03:53:27 PM") and the detail grid's
// "Completed" field. Masking them would paint magenta rectangles into the published docs image,
// so these captures keep the real timestamps and lean on the config's default diff tolerance
// (maxDiffPixelRatio 0.01) instead. Measured drift across a deliberate three-hour clock shift is
// 0.0033, so there is 3x headroom and no need to loosen it further — a looser ratio here is
// actively harmful, because it is wide enough to hide a whole changed field.

// Runs for both versions as of the 1.5 release. The main-only guard that lived here
// existed because 1.4.x (`latest`) shipped a different Logs page — a card list
// (`.log-call-card`) rather than this table, and no Trajectory component at all, which
// landed in agentgateway/agentgateway#3149 after the 1.4.1 cut. `latest` is now 1.5,
// which ships this UI, and observability/access-logs/view.md exists under both versions.
// The `latest` baselines still need a first capture; see the release follow-ups.

async function openLogs(page: Page) {
  await page.goto('/ui/llm/logs', { waitUntil: 'domcontentloaded' });
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
  // Seeded rows have arrived once the table has rendered its body.
  await expect(page.locator('.log-table tbody tr').first()).toBeVisible();
}

// Step "View access logs in the UI": the Logs list, with the filter bar and recent LLM calls.
// Viewport-only rather than fullPage — the seeded table is 100 rows and ~5,900px tall.
test('logs list', async ({ page }) => {
  await openLogs(page);
  await expect(page).toHaveScreenshot('agentgateway-ui-logs.png');
});

// The richer-logging step: one call opened out, showing the Trajectory strip and the expanded
// Conversation. Captured as the detail element so the image is the panel, not the whole page.
test('log detail — trajectory and conversation', async ({ page }) => {
  await openLogs(page);
  // The newest seeded row is the `chat-support-escalation` conversation, which has a payload.
  await page.locator('.log-table tbody tr').first().click();
  await expect(page.locator('#log-trajectory-title')).toBeVisible();

  // The Conversation section is a <details> that renders collapsed; the guide describes what
  // is inside it, so open it before capturing.
  const conversation = page.locator('.log-row-detail details').first();
  await conversation.locator('summary').click();
  await expect(conversation).toHaveAttribute('open', '');

  await expect(page.locator('.log-row-detail')).toHaveScreenshot('agentgateway-ui-log-detail.png');
});
