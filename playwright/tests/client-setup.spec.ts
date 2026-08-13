import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * Captures for LLM > Client Setup (`/ui/llm/client-setup`) — the page that generates
 * connection settings and snippets for each supported LLM client.
 *
 * Documented in operations/ui.md ("Generate LLM client settings") and referenced from every
 * guide under integrations/llm-clients/ via the llm-client-setup-callout.md snippet.
 *
 *   CAPTURE_MODE=client-setup npm run test:client-setup
 *
 * serve-client-setup-ui.sh runs the gateway with fixtures/client-setup-config.yaml — two named
 * models and two virtual API keys. The page only READS that config, so there is no backend and
 * no live traffic. Everything rendered is derived from fixed fixture values:
 *
 *   - the Model dropdown defaults to the first configured model (gpt-4o-mini)
 *   - the Virtual API key dropdown auto-selects the first key (agw_sk_docs_example_key)
 *   - the generated snippet embeds that base URL + key verbatim
 *
 * so the captures are byte-stable and need no masking. The one thing to keep an eye on: the
 * fixture keys are what appear in the published doc images, so they must stay obvious
 * throwaways.
 */

async function openClientSetup(page) {
  await page.goto('/ui/llm/client-setup');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Client Setup' })).toBeVisible();
  // The config API has answered once the model dropdown holds a real model rather than the
  // "No models" placeholder — otherwise the capture can race the fetch and show an empty page.
  await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toContainText('gpt-4o-mini');
}

async function selectIntegration(page, name: string) {
  await page.getByRole('combobox', { name: 'Integration', exact: true }).click();
  await page.getByRole('option', { name: new RegExp(`^${name}\\b`) }).click();
}

// The default view: the curl recipe, which is the integration the page opens on. This is the
// image operations/ui.md uses to show what Client Setup produces.
test('client setup — default curl recipe', async ({ page }) => {
  await openClientSetup(page);
  await expect(page.getByRole('combobox', { name: 'Integration', exact: true })).toContainText('curl');
  await expect(page).toHaveScreenshot('ui-client-setup.png', { fullPage: true });
});

// The Claude Desktop recipe, for the #client-setup section of the Claude Desktop guides. Claude
// Desktop takes only a gateway URL and an API key — no model — so this capture is what the
// guide's "outputs the gateway URL and API key" sentence refers to. The anthropic model is
// selected so the page state matches a reader following the Claude Desktop guide.
test('client setup — Claude Desktop recipe', async ({ page }) => {
  await openClientSetup(page);
  await page.getByRole('combobox', { name: 'Model', exact: true }).click();
  await page.getByRole('option', { name: /^claude-sonnet-4-5\b/ }).click();
  await selectIntegration(page, 'Claude Desktop');
  await expect(page.getByText('Gateway URL:')).toBeVisible();
  await expect(page).toHaveScreenshot('ui-client-setup-claude-desktop.png', { fullPage: true });
});

// The open Integration dropdown, listing every recipe the page ships. This is the capture that
// keeps the recipe list in operations/ui.md honest — the prose enumerates the clients, and this
// image is the evidence. Captured at viewport rather than fullPage: the listbox is a floating
// overlay, and a fullPage capture scrolls the page under it.
test('client setup — integration list', async ({ page }) => {
  await openClientSetup(page);
  await page.getByRole('combobox', { name: 'Integration', exact: true }).click();
  await expect(page.getByRole('option', { name: /^Claude Desktop\b/ })).toBeVisible();
  await expect(page).toHaveScreenshot('ui-client-setup-integrations.png');
});
