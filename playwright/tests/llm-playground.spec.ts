import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * LLM Playground capture (new UI route /ui/llm/playground), using a local MOCK OpenAI
 * provider so the model reply is fixed and the screenshot is deterministic — no real API
 * key, no cost, CI-safe. See fixtures/llm-config.yaml + scripts/mock-openai.mjs, brought
 * up by scripts/serve-llm-ui.sh (CAPTURE_MODE=llm).
 *
 * Flow: Apply CORS (if prompted) → specify a concrete model (the config model is "*") →
 * type a user message → Send → assistant reply renders in the chat panel.
 *
 * Produces ui-llm-playground.png (light + dark). The mock returns a fixed reply and fixed
 * token usage; only the latency badge (e.g. "28ms") varies, so it is masked.
 */
test('LLM playground returns a chat completion', async ({ page }) => {
  await page.goto('/ui/llm/playground');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);

  // Allow the playground origin on the LLM CORS policy if prompted (hot-reloads the
  // gateway), then let it settle so the first completion request isn't dropped.
  const applyCors = page.getByRole('button', { name: /apply cors/i });
  if (await applyCors.count()) {
    await applyCors.click();
    await expect(applyCors).toBeHidden();
    await page.waitForTimeout(2_000);
  }

  // The configured model is a wildcard, so specify a concrete model name.
  await page.getByPlaceholder(/select or type a model/i).fill('gpt-4o-mini');
  await page.getByPlaceholder(/ask a test question/i).fill('Say hello to agentgateway');

  await page.getByRole('button', { name: /^send$/i }).click();

  // The reply streams in token-by-token (split across spans), so assert on the assembled
  // visible text via innerText rather than a single element.
  await expect
    .poll(async () => page.locator('body').innerText(), { timeout: 25_000 })
    .toContain('routed this request to the mock LLM provider');

  // Wait for the completion to fully settle (the latency badge appears when done) so the
  // screenshot is stable.
  await expect(page.getByText(/^\d+\s*ms$/).first()).toBeVisible();

  await expect(page).toHaveScreenshot('ui-llm-playground.png', {
    fullPage: true,
    // The latency badge (e.g. "28ms") is the only non-deterministic element.
    mask: [page.getByText(/^\d+\s*ms$/)],
  });
});
