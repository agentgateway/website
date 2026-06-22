import { test, expect, dismissWelcome, maskSession } from '../fixtures/test';

/**
 * Capture for the observability JWT walkthrough — content/docs/standalone/main/reference/
 * observability/metrics.md (and the commented JWT block in observability/traces.md). A
 * Bearer token carrying `sub: me` is supplied in the playground; the gateway maps the
 * `sub` claim to a `user` metrics tag.
 *
 * Run with the backend up (CAPTURE_MODE=jwt): `npm run test:jwt`. Same server-everything
 * backend as the MCP playground (see scripts/serve-jwt-ui.sh); the JWT angle is purely a
 * UI step — the playground's collapsible "Authorization header" → "Bearer token" field.
 *
 * Image (light + dark per project):
 *   agentgateway-ui-tools-jwt.png — Authorization header expanded with the token supplied,
 *                                   session initialized, tools discovered.
 *
 * The matching echo-result image (agentgateway-ui-tool-echo-hello.png) is captured by
 * virtual.spec.ts and shared by both guides.
 */

// The sample token from the guide: ES256, `sub: me`, `aud: me.com`, exp in 2030.
const JWT =
  'eyJhbGciOiJFUzI1NiIsImtpZCI6IlhoTzA2eDhKaldIMXd3a1dreWVFVXhzb29HRVdvRWRpZEVwd3lkX2htdUkiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJtZS5jb20iLCJleHAiOjE5MDA2NTAyOTQsImlhdCI6MTc0Mjg2OTUxNywiaXNzIjoibWUiLCJqdGkiOiI3MDViYjM4MTNjN2Q3NDhlYjAyNzc5MjViZGExMjJhZmY5ZDBmYzE1MDNiOGY3YzFmY2I1NDc3MmRiZThkM2ZhIiwibmJmIjoxNzQyODY5NTE3LCJzdWIiOiJtZSJ9.cLeIaiWWMNuNlY92RiCV3k7mScNEvcVCY0WbfNWIvRFMOn_I3v-oqFhRDKapooJZLWeiNldOb8-PL4DIrBqmIQ';

test('JWT supplied in the playground, tools discovered', async ({ page }) => {
  await page.goto('/ui/mcp/playground');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  const applyCors = page.getByRole('button', { name: /apply cors/i });
  if (await applyCors.count()) {
    await applyCors.click();
    await expect(applyCors).toBeHidden();
    await page.waitForTimeout(2_000); // gateway reload settle
  }

  // Expand the collapsible "Authorization header" section and supply the Bearer token.
  // The field is type=password (renders dots), so the literal token never shows — no mask
  // needed for it. Target by its stable name attribute rather than the password role.
  await page.getByText('Authorization header', { exact: true }).click();
  await page.locator('input[name="agw-mcp-playground-bearer-token"]').fill(JWT);

  await expect(async () => {
    await page.getByRole('button', { name: /initialize/i }).click();
    await expect(page.getByRole('button', { name: /^reset$/i })).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 30_000 });

  await expect(page.getByText(/tools discovered/i)).toBeVisible();
  await expect(page).toHaveScreenshot('agentgateway-ui-tools-jwt.png', {
    fullPage: true,
    ...maskSession(page),
  });
});
