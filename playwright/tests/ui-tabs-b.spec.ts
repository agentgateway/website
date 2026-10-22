import { type Page } from '@playwright/test';
import { test, expect, dismissWelcome, uiTabsOnly, escapeRegExp, openAddModel, scrollDrawerTo } from '../fixtures/test';

/**
 * "UI" tab captures for the standalone LLM core guides (docs 1.7 and later):
 *   - llm/about.md (the shared model-exposure-patterns.md snippet): Provider prefix, Exact model
 *     name, Catch-all, and Custom model name (the Add model drawer). The Provider prefix capture
 *     (ui-llm-model-prefixed.png) is reused by llm/api-keys.md. The Catch-all capture
 *     (ui-llm-model-passthrough.png) is reused by the OpenAI `*` steps in llm-clients/codex.md,
 *     web-uis/chatbot-ui.md, and agw-docs/standalone/llm/clients/ui-openai-port-3000.md.
 *   - llm/virtual-models.md: Weighted, Failover, and Conditional routing (Add virtual model).
 *   - llm/transformations.md: the request and the final transformation (Edit model).
 *   - llm/cost-controls/budget-limits/per-key.md: a key with a budget, and a key's model access.
 *   - assets/agw-docs/standalone/cost-catalog.md: Custom costs in edit mode.
 *
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-b.yaml. The fixture has the models that the
 * virtual model dropdowns list, the "*" model that the transformation steps edit, strict API key
 * auth with no keys, and a config.database so the Budgets section is available.
 *
 * Every drawer is filled in and NEVER saved, so the fixture is unchanged between captures and
 * runs. The values match each section's YAML example, so the image and the YAML on the page
 * describe the same thing.
 *
 * Produces (light + dark): ui-llm-model-passthrough.png, ui-llm-model-prefixed.png,
 * ui-llm-model-alias.png, ui-llm-model-exact.png, ui-llm-virtual-model-weighted.png,
 * ui-llm-virtual-model-failover.png, ui-llm-virtual-model-conditional.png,
 * ui-llm-virtual-model-conditional-rule-2.png, ui-llm-model-transformation.png,
 * ui-llm-model-final-transformation.png, ui-llm-key-budget.png, ui-llm-key-model-access.png,
 * ui-llm-costs-custom.png.
 */

async function openModels(page: Page): Promise<void> {
  await page.goto('/ui/llm/models');
  await dismissWelcome(page);
  await expect(page.getByRole('button', { name: 'Add model', exact: true })).toBeVisible();
}

async function envVar(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Env var', exact: true }).click();
  const input = page.getByPlaceholder('ENV_VAR_NAME');
  await input.fill(name);
  await input.blur();
  await expect(input).toHaveValue(name);
}

async function modelMatch(page: Page, value: string): Promise<void> {
  const input = page.getByRole('textbox', { name: /^Incoming model match/ });
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

async function pickOption(page: Page, combobox, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(combobox).toHaveText(new RegExp(escapeRegExp(option)));
}

async function openAddVirtualModel(page: Page, name: string) {
  await openModels(page);
  await page.getByRole('button', { name: 'Add virtual model', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Add virtual model' });
  await drawer.getByRole('textbox', { name: 'Virtual model name' }).fill(name);
  return drawer;
}

/**
 * Replace a CEL editor's content. The Condition fields are Monaco editors: their "Editor
 * content" textbox sits under Monaco's view layer, which intercepts the click, so click the
 * editor itself. insertText replaces the selection without Monaco's bracket auto-closing.
 */
async function fillCel(page: Page, editor, value: string): Promise<void> {
  await editor.click();
  // Select the (single-line) default condition with Home, Shift+End. Not Ctrl/Cmd+A: the
  // projects emulate Desktop Chrome's Windows user agent, so Monaco binds Ctrl while
  // ControlOrMeta sends Cmd on macOS, and the value is appended instead of replacing it.
  await expect(editor).toHaveClass(/\bfocused\b/);
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.keyboard.insertText(value);
  await expect(editor.locator('.view-lines')).toHaveText(value);
}

async function openTransformations(page: Page) {
  await openModels(page);
  await page.getByRole('row', { name: /^\* OpenAI/ }).getByRole('button', { name: 'Edit model' }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('button', { name: /^Advanced/ }).click();
  await drawer.getByRole('button', { name: /^Model policies/ }).click();
  return drawer;
}

async function addCelField(section, field: string, expr: string): Promise<void> {
  await section.getByRole('textbox', { name: 'field name' }).fill(field);
  await section.getByRole('textbox', { name: 'CEL expression' }).fill(expr);
  await section.getByRole('button', { name: 'Add', exact: true }).click();
}

async function openNewKey(page: Page) {
  await page.goto('/ui/llm/keys');
  await dismissWelcome(page);
  await page.getByRole('button', { name: 'New key' }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Create virtual key' });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function customKey(page: Page, drawer, name: string, value: string): Promise<void> {
  await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await drawer.getByRole('combobox', { name: 'Key value' }).click();
  await page.getByRole('option', { name: 'Use custom key' }).click();
  await drawer.getByRole('textbox', { name: 'Key value' }).fill(value);
}

test.describe('UI tabs: LLM core', () => {
  uiTabsOnly();

  // llm/about.md, "Catch-all" (also referenced from codex, chatbot-ui, and ui-openai-port-3000.md): OpenAI, "*", env var.
  test('model passthrough', async ({ page }) => {
    const drawer = await openAddModel(page, 'OpenAI');
    await modelMatch(page, '*');
    await envVar(page, 'OPENAI_API_KEY');
    await expect(drawer.getByRole('button', { name: 'Incoming model', exact: true })).toHaveClass(/active/);
    await expect(page).toHaveScreenshot('ui-llm-model-passthrough.png');
  });

  // llm/about.md, "Provider prefix" (also referenced from llm/api-keys.md): the default openai/* match and Strip openai/.
  test('model prefixed passthrough', async ({ page }) => {
    const drawer = await openAddModel(page, 'OpenAI');
    await expect(page.getByRole('textbox', { name: /^Incoming model match/ })).toHaveValue('openai/*');
    await envVar(page, 'OPENAI_API_KEY');
    await expect(drawer.getByRole('button', { name: 'Strip openai/', exact: true })).toHaveClass(/active/);
    await expect(page).toHaveScreenshot('ui-llm-model-prefixed.png');
  });

  // llm/about.md, "Custom model name": fast, with gpt-5-mini as the explicit model.
  test('model alias', async ({ page }) => {
    const drawer = await openAddModel(page, 'OpenAI');
    await modelMatch(page, 'fast');
    await envVar(page, 'OPENAI_API_KEY');
    await drawer.getByRole('button', { name: 'Explicit', exact: true }).click();
    const outgoing = drawer.getByRole('textbox', { name: 'Explicit outgoing model' });
    await outgoing.fill('gpt-5-mini');
    // The field is a combobox: picking the option is what closes its menu.
    const menu = page.getByRole('listbox', { name: 'Explicit outgoing model' });
    if (await menu.isVisible().catch(() => false)) {
      await menu.getByRole('option', { name: /(^|\s)gpt-5-mini$/ }).first().click();
    }
    await outgoing.blur();
    await expect(menu).toBeHidden();
    // The combobox keeps its focus ring after blur(); clicking the drawer title moves focus off it.
    await drawer.getByRole('heading', { name: 'Add model' }).click();
    await expect(outgoing).toHaveValue('gpt-5-mini');
    await expect(page).toHaveScreenshot('ui-llm-model-alias.png');
  });

  // llm/about.md, "Exact model name": OpenAI, gpt-5.6-luna, env var, Incoming model.
  test('model exact name', async ({ page }) => {
    const drawer = await openAddModel(page, 'OpenAI');
    await modelMatch(page, 'gpt-5.6-luna');
    await envVar(page, 'OPENAI_API_KEY');
    await expect(drawer.getByRole('button', { name: 'Incoming model', exact: true })).toHaveClass(/active/);
    await expect(page).toHaveScreenshot('ui-llm-model-exact.png');
  });

  // llm/about.md, "Provider prefix", step 6: Anthropic gets the anthropic/* match and
  // Strip anthropic/. Not a docs image; it checks the claim in the step.
  test('model provider prefix anthropic', async ({ page }) => {
    const drawer = await openAddModel(page, 'Anthropic');
    await expect(page.getByRole('textbox', { name: /^Incoming model match/ })).toHaveValue('anthropic/*');
    await expect(drawer.getByRole('button', { name: 'Strip anthropic/', exact: true })).toHaveClass(/active/);
  });

  // llm/virtual-models.md, "Weighted routing": smart, 90/10 between primary and fallback.
  test('virtual model weighted', async ({ page }) => {
    const drawer = await openAddVirtualModel(page, 'smart');
    const models = drawer.getByRole('combobox', { name: 'Model' });
    await pickOption(page, models.nth(0), 'gpt-4o-primary');
    const weights = drawer.getByRole('spinbutton', { name: 'Weight' });
    await weights.nth(0).fill('90');
    await drawer.getByRole('button', { name: 'Add target', exact: true }).click();
    await pickOption(page, models.nth(1), 'gpt-4o-fallback');
    await weights.nth(1).fill('10');
    await weights.nth(1).blur();
    await expect(page).toHaveScreenshot('ui-llm-virtual-model-weighted.png');
  });

  // llm/virtual-models.md, "Failover routing": resilient, primary then a two-target backup group.
  test('virtual model failover', async ({ page }) => {
    const drawer = await openAddVirtualModel(page, 'resilient');
    await drawer.getByRole('button', { name: 'Failover', exact: true }).click();
    const models = drawer.getByRole('combobox', { name: 'Model' });
    await pickOption(page, models.nth(0), 'claude-primary');
    await drawer.getByRole('button', { name: 'Add fallback group', exact: true }).click();
    await pickOption(page, models.nth(1), 'claude-backup-a');
    await drawer.getByRole('button', { name: 'Add target', exact: true }).last().click();
    await pickOption(page, models.nth(2), 'claude-backup-b');
    await scrollDrawerTo(drawer, drawer.getByText('Routing strategy', { exact: true }));
    await expect(page).toHaveScreenshot('ui-llm-virtual-model-failover.png');
  });

  // llm/virtual-models.md, "Conditional routing": adaptive, free -> openai-fast, pro ->
  // openai-smart. Two captures: each rule card is tall, so both do not fit in one view.
  test('virtual model conditional', async ({ page }) => {
    const drawer = await openAddVirtualModel(page, 'adaptive');
    await drawer.getByRole('button', { name: 'Conditional', exact: true }).click();
    // Pick the target models BEFORE typing a condition. With the fixture's "*" model as the
    // default target, typing in any Condition first crashes the drawer ("Something went
    // wrong!", TypeError reading 'trim' of undefined) in latest-dev 0.0.0-alpha.9a5a2a8b.
    const targets = drawer.getByRole('combobox', { name: 'Target model' });
    await pickOption(page, targets.nth(0), 'openai-fast');
    await pickOption(page, targets.nth(1), 'openai-smart');
    const editors = drawer.locator('.monaco-editor');
    await fillCel(page, editors.nth(0), 'request.headers["x-tier"] == "free"');
    await fillCel(page, editors.nth(1), 'request.headers["x-tier"] == "pro"');
    // Clicking the drawer title moves focus out of the editor, so no text cursor shows.
    await drawer.getByRole('heading', { name: 'Add virtual model' }).click();
    await expect(drawer.getByText('Rule 2', { exact: true })).toBeVisible();

    await scrollDrawerTo(drawer, drawer.getByText('Routing strategy', { exact: true }));
    await expect(page).toHaveScreenshot('ui-llm-virtual-model-conditional.png');

    await scrollDrawerTo(drawer, drawer.getByText('Rule 2', { exact: true }));
    await expect(page).toHaveScreenshot('ui-llm-virtual-model-conditional-rule-2.png');
  });

  // llm/transformations.md, "Configure LLM request transformations": max_tokens capped at 10.
  test('model transformation', async ({ page }) => {
    const drawer = await openTransformations(page);
    await drawer.getByRole('button', { name: /^Transformation/ }).click();
    const section = drawer.locator('section, div').filter({ has: page.getByText('LLM request fields') }).last();
    await addCelField(section, 'max_tokens', 'min(llmRequest.max_tokens, 10)');
    await expect(drawer.getByText('min(llmRequest.max_tokens, 10)')).toBeVisible();
    await scrollDrawerTo(drawer, drawer.getByRole('button', { name: /^Model policies/ }));
    await expect(page).toHaveScreenshot('ui-llm-model-transformation.png');
  });

  // llm/transformations.md, "Transform requests after provider conversion": finalTransformation fields.
  test('model final transformation', async ({ page }) => {
    const drawer = await openTransformations(page);
    await drawer.getByRole('button', { name: /^Final transformation/ }).click();
    const section = drawer.locator('section, div').filter({ has: page.getByText('Provider request fields') }).last();
    await addCelField(section, 'max_completion_tokens', 'min(llmRequest.max_completion_tokens, 10)');
    await addCelField(section, 'reasoning_effort', 'fail("remove")');
    await expect(drawer.getByText('fail("remove")')).toBeVisible();
    await scrollDrawerTo(drawer, drawer.getByRole('button', { name: /^Model policies/ }));
    await expect(page).toHaveScreenshot('ui-llm-model-final-transformation.png');
  });

  // llm/cost-controls/budget-limits/per-key.md, "Step 2", UI tab: the team-a key and its
  // daily-spend budget.
  test('key with budget', async ({ page }) => {
    const drawer = await openNewKey(page);
    await customKey(page, drawer, 'team-a', 'sk-team-a-abc123def456');
    await drawer.getByRole('button', { name: /^Budgets/ }).click();
    await drawer.getByRole('button', { name: 'Add budget', exact: true }).click();
    const budget = drawer.getByRole('article');
    await budget.getByRole('textbox', { name: 'Name', exact: true }).fill('daily-spend');
    await budget.getByRole('textbox', { name: 'Rolling window' }).fill('24h');
    const amount = budget.getByRole('spinbutton', { name: 'Budget 1 amount' });
    await amount.fill('0.008');
    await budget.getByRole('button', { name: 'USD', exact: true }).click();
    await budget.getByRole('button', { name: /^Block requests/ }).click();
    await amount.blur();
    await expect(budget.getByRole('button', { name: /^Block requests/ })).toHaveAttribute('aria-pressed', 'true');
    await scrollDrawerTo(drawer, drawer.getByRole('button', { name: /^Budgets/ }));
    await expect(page).toHaveScreenshot('ui-llm-key-budget.png');
  });

  // llm/cost-controls/budget-limits/per-key.md, "Limit model access per key": gpt-5* and
  // claude-sonnet-5. Uses New key (the step's alternative), since the fixture has no team-a key.
  test('key model access', async ({ page }) => {
    const drawer = await openNewKey(page);
    await customKey(page, drawer, 'team-a', 'sk-team-a-abc123def456');
    await drawer.getByRole('button', { name: /^Model access/ }).click();
    await drawer.getByRole('button', { name: 'Selected models', exact: true }).click();
    for (const pattern of ['gpt-5*', 'claude-sonnet-5']) {
      const input = drawer.getByRole('textbox').last();
      await input.fill(pattern);
      await drawer.getByRole('button', { name: 'Add', exact: true }).last().click();
      await expect(drawer.getByText(pattern, { exact: true })).toBeVisible();
    }
    await drawer.getByRole('textbox').last().blur();
    await expect(page).toHaveScreenshot('ui-llm-key-model-access.png');
  });

  // assets/agw-docs/standalone/cost-catalog.md, "Override catalog entries", UI tab: an
  // openai/gpt-4o-mini row in Custom costs, before Save.
  test('custom costs', async ({ page }) => {
    await page.goto('/ui/llm/costs');
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: 'Custom costs' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Add model cost' }).click();
    const row = page.getByRole('row', { name: 'Remove custom cost' }).last();
    const cells = row.getByRole('textbox');
    await cells.nth(0).fill('openai');
    await cells.nth(1).fill('gpt-4o-mini');
    await cells.nth(2).fill('0.15');
    await cells.nth(3).fill('0.60');
    await cells.nth(3).blur();
    await expect(cells.nth(1)).toHaveValue('gpt-4o-mini');
    await expect(page).toHaveScreenshot('ui-llm-costs-custom.png');
  });
});
