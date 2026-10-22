import { type Locator, type Page } from '@playwright/test';
import { test, expect, dismissWelcome, uiTabsOnly, blurAll, escapeRegExp, openAddModel, scrollIntoViewChecked } from '../fixtures/test';

/**
 * "UI" tab captures for the standalone LLM provider, LLM client, and web UI guides:
 *   content/docs/standalone/main/integrations/llm/providers/ (azure, bedrock, custom, vertex,
 *   multiple-llms), the LLM client guides that reuse
 *   assets/agw-docs/standalone/llm/clients/ui-openai-port-3000.md, the Ollama guide
 *   (assets/agw-docs/pages/agentgateway/llm/providers/ollama-standalone.md), and the web UI
 *   guides under content/docs/standalone/main/integrations/web-uis/.
 *
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-c.yaml (scripts/serve-fixture-ui.sh): one
 * OpenAI "*" model, no gateways, no LLM port, no shared providers. No backends run.
 *
 * Every drawer is filled in with the guide's values and NEVER saved, so the fixture is unchanged
 * between runs and no provider, key, or cloud credential is contacted. The values match each
 * guide's YAML example, so the image and the YAML describe the same thing. If a guide changes a
 * value, change it here too.
 *
 * Most provider guides reuse the per-provider Add model images from llm-add-model.spec.ts. This
 * spec only captures the drawers that those images do not show: a different credential mode or
 * resource type (Azure Foundry), a field the quickstart leaves at its default (the Bedrock
 * endpoint), different values (Vertex, the Perplexity custom provider), the Add provider drawer,
 * and the LLM Settings drawer with a port.
 *
 * Produces (light + dark per project): ui-llm-add-provider.png, ui-llm-settings-port.png,
 * ui-llm-add-model-azure-foundry.png, ui-llm-add-model-bedrock-runtime.png,
 * ui-llm-add-model-vertex-explicit.png, ui-llm-add-model-custom-perplexity.png.
 */

/**
 * Fill one of the freeform comboboxes (regions, explicit outgoing model) and close its menu by
 * picking the typed value when the menu offers it. Never press Escape: the combobox only swallows
 * it while its menu is open, so the key can reach the drawer and raise "Discard unsaved changes?".
 */
async function fillCombo(drawer: Locator, label: string, value: string): Promise<void> {
  const page = drawer.page();
  const box = drawer.getByRole('textbox', { name: label, exact: true });
  await box.fill(value);
  const menu = page.getByRole('listbox', { name: label });
  const option = menu.getByRole('option', { name: new RegExp(`(^|\\s)${escapeRegExp(value)}$`) });
  if (await option.count()) {
    await option.first().click();
  } else {
    // A value that is not in the catalog leaves a "No catalog matches" menu open, and neither
    // blur nor Tab closes it. A click outside the combobox does, as it would for a reader; the
    // drawer heading is inert.
    await drawer.getByRole('heading', { level: 3 }).first().click();
  }
  await blurAll(page);
  await expect(menu).toBeHidden();
  await expect(box).toHaveValue(value);
}

/** Choose the Explicit outgoing model and enter its name. */
async function explicitModel(drawer: Locator, model: string): Promise<void> {
  await drawer.getByRole('button', { name: 'Explicit', exact: true }).click();
  await fillCombo(drawer, 'Explicit outgoing model', model);
}

test.describe('LLM provider, client, and web UI tabs', () => {
  uiTabsOnly();

  // providers/multiple-llms.md, "Reusable provider configuration" UI tab, step 2: the shared
  // openai-prod provider with OPENAI_API_KEY from the environment.
  test('add provider', async ({ page }) => {
    await page.goto('/ui/llm/providers');
    await dismissWelcome(page);
    const add = page.getByRole('button', { name: 'Add provider' }).first();
    await expect(add).toBeVisible();
    await add.click();
    const drawer = page.getByRole('dialog', { name: 'Add provider' });
    await expect(drawer.getByRole('heading', { name: 'Add provider', exact: true })).toBeVisible();
    await drawer.getByRole('textbox', { name: /^Provider name/ }).fill('openai-prod');
    await expect(drawer.getByRole('combobox', { name: /^Provider/ }).last()).toHaveText(/OpenAI/);
    await drawer.getByRole('button', { name: 'Env var', exact: true }).click();
    const env = drawer.getByPlaceholder('ENV_VAR_NAME');
    await env.fill('OPENAI_API_KEY');
    await blurAll(page);
    await expect(env).toHaveValue('OPENAI_API_KEY');
    await expect(page).toHaveScreenshot('ui-llm-add-provider.png', { animations: 'disabled' });
  });

  // agw-docs/standalone/llm/clients/ui-openai-port-3000.md, step 3 (reused by the continue,
  // curl, cursor, devin, github-copilot, and openai-sdk client guides and the goose, librechat,
  // and open-webui guides), and ollama-standalone.md step 3: Gateway Overview > LLM > Settings,
  // Port 3000.
  test('LLM settings port', async ({ page }) => {
    await page.goto('/ui/');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: 'Gateway Overview' })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Settings' });
    const port = drawer.getByRole('spinbutton', { name: /^Port/ }).or(drawer.getByRole('textbox', { name: /^Port/ }));
    await expect(port).toBeVisible();
    await port.fill('3000');
    await blurAll(page);
    await expect(port).toHaveValue('3000');
    await expect(page).toHaveScreenshot('ui-llm-settings-port.png', { animations: 'disabled' });
  });

  // providers/azure.md, "Configuration" UI tab, matching the Foundry (implicit auth) example: Default
  // credentials, resource name, Foundry resource type, project name.
  test('add model azure foundry', async ({ page }) => {
    const drawer = await openAddModel(page, 'Azure');
    await drawer.getByRole('textbox', { name: 'Incoming model match', exact: true }).fill('*');
    await drawer.getByRole('button', { name: 'Default', exact: true }).click();
    await drawer.getByRole('textbox', { name: 'Azure resource name', exact: true }).fill('your-resource-name');
    await drawer.getByRole('combobox', { name: 'Azure resource type', exact: true }).click();
    await page.getByRole('option', { name: /Foundry/ }).click();
    const project = drawer.getByRole('textbox', { name: 'Azure project name', exact: true });
    await project.fill('your-project-name');
    await blurAll(page);
    await expect(drawer.getByRole('combobox', { name: 'Azure resource type', exact: true })).toHaveText(/Foundry/);
    await expect(project).toHaveValue('your-project-name');
    await expect(page).toHaveScreenshot('ui-llm-add-model-azure-foundry.png', { animations: 'disabled' });
  });

  // providers/bedrock.md, "Configuration" UI tab (and the "Bedrock Mantle" UI tab): Ambient
  // credentials, us-west-2, Prefer Runtime.
  test('add model bedrock runtime', async ({ page }) => {
    const drawer = await openAddModel(page, 'Amazon Bedrock');
    // The guide keeps the default match, which the UI fills in when the provider is selected.
    await expect(drawer.getByRole('textbox', { name: 'Incoming model match', exact: true })).toHaveValue('bedrock/*');
    await expect(drawer.getByRole('button', { name: 'Ambient', exact: true })).toHaveClass(/active/);
    await fillCombo(drawer, 'AWS region', 'us-west-2');
    const endpoint = drawer.getByRole('combobox', { name: 'Bedrock endpoint', exact: true });
    await endpoint.click();
    await page.getByRole('option', { name: /Prefer Runtime/ }).click();
    await blurAll(page);
    await expect(endpoint).toHaveText(/Prefer Runtime/);
    await expect(page).toHaveScreenshot('ui-llm-add-model-bedrock-runtime.png', { animations: 'disabled' });
  });

  // providers/vertex.md, "Configuration" UI tab: ADC, my-project-id, us-west2, and the
  // explicit outgoing model.
  test('add model vertex explicit', async ({ page }) => {
    const drawer = await openAddModel(page, 'Gemini Enterprise (GCP Vertex)');
    await drawer.getByRole('textbox', { name: 'Incoming model match', exact: true }).fill('gemini-2.5-flash');
    await expect(drawer.getByRole('button', { name: 'ADC', exact: true })).toHaveClass(/active/);
    await drawer.getByRole('textbox', { name: 'Vertex project', exact: true }).fill('my-project-id');
    await fillCombo(drawer, 'Vertex region', 'us-west2');
    await explicitModel(drawer, 'google/gemini-2.5-flash-lite-preview-06-17');
    await scrollIntoViewChecked(drawer.getByText('Outgoing model', { exact: true }));
    await expect(page).toHaveScreenshot('ui-llm-add-model-vertex-explicit.png', { animations: 'disabled' });
  });

  // providers/custom.md, "Configuring a custom provider" UI tab: Perplexity through the Custom
  // provider. The drawer is taller than the viewport; the capture shows the top of the form
  // (model match, credential, base URL, and the default Chat completions format). The explicit
  // outgoing model is filled in too, so the form matches the YAML, but sits below the fold.
  test('add model custom perplexity', async ({ page }) => {
    const drawer = await openAddModel(page, 'Custom');
    // The guide keeps the default match, which the UI fills in when the provider is selected.
    await expect(drawer.getByRole('textbox', { name: 'Incoming model match', exact: true })).toHaveValue('custom/*');
    await drawer.getByRole('button', { name: 'Env var', exact: true }).click();
    await drawer.getByPlaceholder('ENV_VAR_NAME').fill('PERPLEXITY_API_KEY');
    await drawer.getByRole('textbox', { name: 'Base URL', exact: true }).fill('https://api.perplexity.ai');
    await expect(drawer.getByRole('checkbox', { name: 'Chat completions (/chat/completions)' })).toBeChecked();
    await explicitModel(drawer, 'llama-3.1-sonar-large-128k-online');
    // Filling the explicit model scrolled the drawer down; return to the top.
    const body = drawer.locator('.drawer-body');
    await body.evaluate((el) => el.scrollTo(0, 0));
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(drawer.getByPlaceholder('ENV_VAR_NAME')).toHaveValue('PERPLEXITY_API_KEY');
    await expect(page).toHaveScreenshot('ui-llm-add-model-custom-perplexity.png', { animations: 'disabled' });
  });
});
