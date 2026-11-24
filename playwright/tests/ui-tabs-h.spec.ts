import { type Locator, type Page } from '@playwright/test';
import { test, expect, dismissWelcome, uiTabsOnly, blurAll, scrollDrawerTo } from '../fixtures/test';
import { lineAtLeast } from '../scripts/resolve-image.mjs';

/**
 * "UI" tab captures for the standalone guardrail guides:
 *   - content/docs/standalone/main/documentation/mcp/guardrails/cel.md, "Set up CEL guardrails":
 *     the MCP > Policies > MCP guardrails drawer with the guide's Expression processors.
 *   - content/docs/standalone/main/documentation/llm/prompt-guards/regex.md, "PII detection" and
 *     "Mask PII in responses": the LLM > Guardrails guard drawers and the Action choices.
 *
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-h.yaml (scripts/serve-fixture-ui.sh): an LLM
 * "*" model and one placeholder MCP target. No backends run, and nothing is saved, so the
 * fixture is unchanged between runs. The values match each guide's steps. If a guide changes a
 * value, change it here too.
 *
 * Both forms are new in 1.8: the Expression processor type (MCP guardrails) and the three-way
 * regex Action list. So on top of uiTabsOnly(), the captures skip on any line before 1.8. Until
 * 1.8 ships only the `main` pass captures; at the release, `latest` captures too, with no edit.
 *
 * Produces (light + dark per project): ui-mcp-guardrails-cel-reject.png,
 * ui-mcp-guardrails-cel-response.png, ui-llm-guardrails-action.png,
 * ui-llm-guardrails-regex-ssn.png, ui-llm-guardrails-request.png,
 * ui-llm-guardrails-mask-phone.png.
 */

const GUARDRAILS_SINCE = '1.8';

// Park the pointer on the dimmed page, outside every drawer, so no control keeps a hover state.
const PARK = { x: 5, y: 700 };

const REJECT_CONDITION =
  "mcp.params.name == 'echo' && has(mcp.params.arguments) && has(mcp.params.arguments.message) && mcp.params.arguments.message.contains('DO_NOT_SEND')";
const MASK_CONDITION = "mcp.params.name == 'echo' && has(mcp.params.arguments) && has(mcp.params.arguments.message)";
const MASK_TRANSFORM = `mcp.params.with(p, p.merge({
  'arguments': p.arguments.merge({
    'message': p.arguments.message.regexReplaceAll(
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}',
      '[EMAIL]'
    )
  })
}))`;
const SECRET_TRANSFORM = `mcp.result.with(r, r.merge({
  'content': r.content.map(item,
    item.type == 'text'
      ? item.merge({'text': item.text.regexReplaceAll(
          'demo-secret-[A-Za-z0-9]+', '[SECRET]'
        )})
      : item
  )
}))`;

const SSN_BODY = `{
  "error": {
    "message": "Request rejected: Content contains sensitive information",
    "type": "invalid_request_error",
    "code": "content_policy_violation"
  }
}`;
const EMAIL_BODY = `{
  "error": {
    "message": "Request blocked: Contains email address",
    "type": "invalid_request_error",
    "code": "pii_detected"
  }
}`;

/**
 * Replace the contents of a Monaco editor. Monaco picks Cmd or Ctrl from the user agent, and the
 * projects use the Windows 'Desktop Chrome' user agent, so the shortcuts are Ctrl on every host.
 * The text is pasted, not typed: typing (even insertText) runs Monaco's auto-indent on every
 * newline, which compounds the indentation of the multi-line transforms.
 */
async function fillMonaco(page: Page, editor: Locator, text: string): Promise<void> {
  await editor.locator('.view-lines').click();
  await expect(editor).toHaveClass(/\bfocused\b/);
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.press('Delete');
  // A synthetic paste event on Monaco's input element. Headless Chromium has no system
  // clipboard for Ctrl+V to read from.
  await editor.locator('.native-edit-context, textarea.inputarea').first().evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
  // Compare without whitespace: Monaco renders spaces as non-breaking spaces, and word wrap
  // splits long lines.
  const flat = (value: string) => value.replace(/[\s\u00a0]+/g, '');
  await expect.poll(async () => flat(await editor.locator('.view-lines').innerText())).toBe(flat(text));
}

/** Pick an option from a combobox by the start of its accessible name. */
async function choose(page: Page, combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: new RegExp(`^${option}\\b`) }).click();
  // The combobox is the select's empty search input. The chosen label is a sibling of it.
  await expect(selectOf(combobox)).toContainText(option);
}

/** The whole select control around a combobox input, which holds the chosen label. */
function selectOf(combobox: Locator): Locator {
  return combobox.locator('xpath=ancestor::*[contains(concat(" ", @class, " "), " ant-select ")][1]');
}

// --- MCP guardrails (cel.md) ---------------------------------------------------------------

async function openMcpGuardrails(page: Page): Promise<Locator> {
  await page.goto('/ui/mcp/policies#mcpGuardrails');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  const drawer = page.getByRole('dialog', { name: 'MCP guardrails' });
  await expect(drawer.getByRole('heading', { name: 'MCP guardrails', exact: true })).toBeVisible();
  return drawer;
}

/** The card for processor n (1-based): the nearest ancestor of its title with a type list. */
function processorCard(drawer: Locator, n: number): Locator {
  return drawer
    .getByText(`Processor ${n}`, { exact: true })
    .locator(`xpath=ancestor::*[.//*[@aria-label="Processor ${n} type"]][1]`);
}

/** Click Add processor, then select the Expression type. Returns the new processor's card. */
async function addExpression(page: Page, drawer: Locator, n: number): Promise<Locator> {
  await drawer.getByRole('button', { name: 'Add processor' }).first().click();
  await choose(page, drawer.getByRole('combobox', { name: `Processor ${n} type` }), 'Expression');
  return processorCard(drawer, n);
}

/**
 * A processor card's Monaco editors: Condition is the first, and Transform (shown only for the
 * Transform action) is the second. Not by label: "Transform" is also the card's action badge.
 */
function editorFor(card: Locator, label: 'Condition' | 'Transform'): Locator {
  return card.locator('.monaco-editor').nth(label === 'Condition' ? 0 : 1);
}

// --- LLM guardrails (regex.md) -------------------------------------------------------------

async function openGuardrails(page: Page): Promise<void> {
  await page.goto('/ui/llm/guardrails');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'LLM Guardrails', exact: true })).toBeVisible();
}

/** Click Add guard in the Request guards (0) or Response guards (1) section. */
async function addGuard(page: Page, section: 0 | 1, type: string): Promise<Locator> {
  await page.getByRole('main').getByRole('button', { name: 'Add guard' }).nth(section).click();
  const title = section === 0 ? 'Add request guard' : 'Add response guard';
  const drawer = page.getByRole('dialog', { name: title });
  await expect(drawer.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await choose(page, drawer.getByRole('combobox', { name: 'Guard type' }), type);
  return drawer;
}

/** regex.md, "PII detection" step 4: the SSN keyword guard, up to (not including) Add guard. */
async function fillSsnGuard(page: Page): Promise<Locator> {
  const drawer = await addGuard(page, 0, 'Custom regex');
  await expect(selectOf(drawer.getByRole('combobox', { name: 'Action' }))).toContainText('Reject request');
  const patterns = drawer.getByPlaceholder('(?i)secret-[a-z0-9]+');
  await patterns.first().fill('SSN');
  await drawer.getByRole('button', { name: 'Add pattern' }).click();
  await patterns.nth(1).fill('Social Security');
  await drawer.getByRole('textbox', { name: 'Rejection status' }).fill('400');
  const body = drawer.getByRole('textbox', { name: 'Rejection body' });
  await body.fill(SSN_BODY);
  // Show the body from its first line. fill() leaves the textarea scrolled to the end.
  await body.evaluate((el) => (el.scrollTop = 0));
  return drawer;
}

test.describe('UI tabs: guardrails', () => {
  uiTabsOnly();
  test.skip(
    !lineAtLeast(process.env.DOC_VERSION || 'latest', GUARDRAILS_SINCE),
    `guardrail UI-tab capture: docs ${GUARDRAILS_SINCE} and later only`,
  );

  // cel.md, UI tab step 4: processor 1, the Expression processor that rejects DO_NOT_SEND.
  test('mcp cel reject', async ({ page }) => {
    const drawer = await openMcpGuardrails(page);
    const card = await addExpression(page, drawer, 1);
    await fillMonaco(page, editorFor(card, 'Condition'), REJECT_CONDITION);
    await card
      .getByRole('textbox', { name: 'Reject message' })
      .fill('Messages containing DO_NOT_SEND may not be sent upstream');
    await expect(selectOf(card.getByRole('combobox', { name: 'Processor 1 action' }))).toContainText('Reject');
    await blurAll(page, PARK);
    await expect(page).toHaveScreenshot('ui-mcp-guardrails-cel-reject.png');
  });

  // cel.md, UI tab steps 4-6: all three processors, scrolled to processor 3, the response-phase
  // Transform that masks demo secrets.
  test('mcp cel response', async ({ page }) => {
    const drawer = await openMcpGuardrails(page);

    const reject = await addExpression(page, drawer, 1);
    await fillMonaco(page, editorFor(reject, 'Condition'), REJECT_CONDITION);
    await reject
      .getByRole('textbox', { name: 'Reject message' })
      .fill('Messages containing DO_NOT_SEND may not be sent upstream');

    const mask = await addExpression(page, drawer, 2);
    await fillMonaco(page, editorFor(mask, 'Condition'), MASK_CONDITION);
    await choose(page, drawer.getByRole('combobox', { name: 'Processor 2 action' }), 'Transform');
    await fillMonaco(page, editorFor(mask, 'Transform'), MASK_TRANSFORM);

    const secret = await addExpression(page, drawer, 3);
    await fillMonaco(page, editorFor(secret, 'Condition'), 'has(mcp.result.content)');
    await choose(page, drawer.getByRole('combobox', { name: 'Processor 3 action' }), 'Transform');
    await fillMonaco(page, editorFor(secret, 'Transform'), SECRET_TRANSFORM);
    // Method phases: enter tools/call, select Response, and click Add. The new entry replaces the
    // default tools/call Request entry.
    await secret.getByPlaceholder('tools/call, prompts/*, or *').fill('tools/call');
    await choose(page, secret.getByRole('combobox', { name: 'Phase' }), 'Response');
    await secret.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(secret.getByText('Response', { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText('3 processors', { exact: true })).toBeVisible();

    await blurAll(page, PARK);
    // Start at processor 3's Action, so the Transform and the Method phases fit in the image.
    await scrollDrawerTo(drawer, secret.getByText('Action', { exact: true }));
    await expect(page).toHaveScreenshot('ui-mcp-guardrails-cel-response.png');
  });

  // regex.md, "PII detection" step 4: the Action list open on a Custom regex guard, which shows
  // the three choices that the step describes.
  test('llm guard action choices', async ({ page }) => {
    await openGuardrails(page);
    const drawer = await addGuard(page, 0, 'Custom regex');
    await drawer.getByRole('combobox', { name: 'Action' }).click();
    const listbox = page.getByRole('listbox');
    await expect(listbox.getByRole('option')).toHaveCount(3);
    await page.mouse.move(PARK.x, PARK.y);
    await expect(page).toHaveScreenshot('ui-llm-guardrails-action.png');
  });

  // regex.md, "PII detection" step 4: the SSN guard filled in, before Add guard.
  test('llm regex ssn guard', async ({ page }) => {
    await openGuardrails(page);
    await fillSsnGuard(page);
    await blurAll(page, PARK);
    await expect(page).toHaveScreenshot('ui-llm-guardrails-regex-ssn.png');
  });

  // regex.md, "PII detection" step 6: both request guards added, before Save guardrails.
  test('llm request guards', async ({ page }) => {
    await openGuardrails(page);
    const ssn = await fillSsnGuard(page);
    await ssn.getByRole('button', { name: 'Add guard' }).click();
    await expect(ssn).toBeHidden();

    const email = await addGuard(page, 0, 'Built-in detectors');
    await expect(selectOf(email.getByRole('combobox', { name: 'Action' }))).toContainText('Reject request');
    await expect(email.getByRole('button', { name: 'Email', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await email.getByRole('textbox', { name: 'Rejection status' }).fill('400');
    await email.getByRole('textbox', { name: 'Rejection body' }).fill(EMAIL_BODY);
    await email.getByRole('button', { name: 'Add guard' }).click();
    await expect(email).toBeHidden();

    await expect(page.getByRole('button', { name: 'Save guardrails' })).toBeEnabled();
    await blurAll(page, PARK);
    await expect(page).toHaveScreenshot('ui-llm-guardrails-request.png');
  });

  // regex.md, "Mask PII in responses" step 4: a response guard that masks phone numbers.
  test('llm mask phone guard', async ({ page }) => {
    await openGuardrails(page);
    const drawer = await addGuard(page, 1, 'Built-in detectors');
    await choose(page, drawer.getByRole('combobox', { name: 'Action' }), 'Mask matched text');
    // The built-in detectors are toggle buttons, and a new guard starts with Email on.
    const phone = drawer.getByRole('button', { name: 'Phone', exact: true });
    const email = drawer.getByRole('button', { name: 'Email', exact: true });
    await phone.click();
    await email.click();
    await expect(phone).toHaveAttribute('aria-pressed', 'true');
    await expect(email).toHaveAttribute('aria-pressed', 'false');
    await blurAll(page, PARK);
    await expect(page).toHaveScreenshot('ui-llm-guardrails-mask-phone.png');
  });
});
