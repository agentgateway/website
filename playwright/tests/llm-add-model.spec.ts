import { type Page } from '@playwright/test';
import { test, expect, dismissWelcome } from '../fixtures/test';

/**
 * "Add model" form captures, one per provider, for the standalone LLM quickstart
 * (assets/agw-docs/standalone/quickstart/llm-ui-providers.md, Step 4).
 *
 * The guide has a tab per provider and each tab embeds a filled-in screenshot of this
 * drawer. Twenty of the twenty-one were captured by hand, which produced three different
 * image geometries in one tab group and no dark variants at all. This spec replaces every
 * one of them: the harness pins the viewport, so all twenty-one come out identical in size,
 * and the light/dark projects give the dark set for free.
 *
 * Reuses CAPTURE_MODE=llm rather than adding a launcher, the same way logs.spec.ts reuses
 * CAPTURE_MODE=costs. serve-llm-ui.sh already boots a gateway with an LLM config, which is
 * all this needs: the Add model drawer is a client-side form, so nothing here talks to a
 * provider, needs an API key, or costs anything. The form is never saved — every test opens
 * the drawer, fills it, captures, and navigates away — so the gateway config is untouched
 * and the captures cannot influence each other.
 *
 * The values below are the ones the guide tells the reader to type. Keep them in sync with
 * llm-ui-providers.md: if a tab changes its model name or env var, change it here too, or
 * the screenshot stops matching the numbered steps printed directly above it.
 *
 * Provider list and display names come from ui/src/config.ts (`providerNames` and
 * `providerDisplayName`) in the agentgateway repo, in the order the Provider dropdown
 * renders them: the eight core providers in declaration order, then the rest alphabetized.
 * That is also the tab order in the guide.
 */

type Credential =
  | { kind: 'envVar'; name: string }
  | { kind: 'awsAmbient'; region: string }
  | { kind: 'gcpAdc'; project: string; region: string }
  | { kind: 'azureApiKey'; name: string; resourceName: string }
  | { kind: 'none' };

interface Provider {
  /** Exactly the label in the UI's Provider dropdown, and the guide's tab name. */
  label: string;
  /** Value for "Incoming model match", as the guide's numbered step says to type it. */
  modelMatch: string;
  credential: Credential;
  /** Only the providers whose form exposes a Base URL field. */
  baseUrl?: string;
  /**
   * Baseline name, which docs-image-map.json maps into assets/img/. OpenAI deliberately
   * keeps the bare, pre-existing name so the guide's OpenAI tab and its already-published
   * dark asset keep working.
   */
  image: string;
}

const PROVIDERS: Provider[] = [
  // The eight core providers, in dropdown order.
  {
    label: 'OpenAI',
    modelMatch: 'gpt-3.5-turbo',
    credential: { kind: 'envVar', name: 'OPENAI_API_KEY' },
    image: 'ui-llm-add-model.png',
  },
  {
    label: 'Anthropic',
    modelMatch: 'claude-haiku-4-5',
    credential: { kind: 'envVar', name: 'ANTHROPIC_API_KEY' },
    image: 'ui-llm-add-model-anthropic.png',
  },
  {
    label: 'Gemini',
    modelMatch: 'gemini-2.5-flash',
    credential: { kind: 'envVar', name: 'GEMINI_API_KEY' },
    image: 'ui-llm-add-model-gemini.png',
  },
  {
    label: 'Vertex AI',
    modelMatch: 'gemini-2.5-flash',
    credential: { kind: 'gcpAdc', project: 'my-project', region: 'us-central1' },
    image: 'ui-llm-add-model-vertex.png',
  },
  {
    label: 'Amazon Bedrock',
    modelMatch: 'amazon.nova-lite-v1:0',
    credential: { kind: 'awsAmbient', region: 'us-west-2' },
    image: 'ui-llm-add-model-bedrock.png',
  },
  {
    label: 'Azure',
    modelMatch: 'gpt-4.1',
    credential: { kind: 'azureApiKey', name: 'AZURE_API_KEY', resourceName: 'my-azure-resource' },
    image: 'ui-llm-add-model-azure.png',
  },
  {
    label: 'GitHub Copilot',
    modelMatch: 'gpt-4.1',
    credential: { kind: 'envVar', name: 'GH_COPILOT_TOKEN' },
    image: 'ui-llm-add-model-copilot.png',
  },
  {
    label: 'Custom',
    modelMatch: 'my-model',
    credential: { kind: 'envVar', name: 'CUSTOM_PROVIDER_API_KEY' },
    baseUrl: 'https://llm.example.com/v1',
    image: 'ui-llm-add-model-custom.png',
  },

  // The remaining providers, alphabetized by display name, as the dropdown renders them.
  {
    label: 'Baseten',
    modelMatch: 'openai/gpt-oss-120b',
    credential: { kind: 'envVar', name: 'BASETEN_API_KEY' },
    image: 'ui-llm-add-model-baseten.png',
  },
  {
    label: 'Cerebras',
    modelMatch: 'gpt-oss-120b',
    credential: { kind: 'envVar', name: 'CEREBRAS_API_KEY' },
    image: 'ui-llm-add-model-cerebras.png',
  },
  {
    label: 'Cohere',
    modelMatch: 'command-a-03-2025',
    credential: { kind: 'envVar', name: 'COHERE_API_KEY' },
    image: 'ui-llm-add-model-cohere.png',
  },
  {
    label: 'DeepInfra',
    modelMatch: 'Qwen/Qwen3-32B',
    credential: { kind: 'envVar', name: 'DEEPINFRA_API_KEY' },
    image: 'ui-llm-add-model-deepinfra.png',
  },
  {
    label: 'DeepSeek',
    modelMatch: 'deepseek-v4-flash',
    credential: { kind: 'envVar', name: 'DEEPSEEK_API_KEY' },
    image: 'ui-llm-add-model-deepseek.png',
  },
  {
    label: 'Fireworks AI',
    modelMatch: 'accounts/fireworks/models/gpt-oss-120b',
    credential: { kind: 'envVar', name: 'FIREWORKS_API_KEY' },
    image: 'ui-llm-add-model-fireworks.png',
  },
  {
    label: 'Groq',
    modelMatch: 'llama-3.1-8b-instant',
    credential: { kind: 'envVar', name: 'GROQ_API_KEY' },
    image: 'ui-llm-add-model-groq.png',
  },
  {
    label: 'Hugging Face',
    modelMatch: 'Qwen/Qwen3-32B',
    credential: { kind: 'envVar', name: 'HUGGINGFACE_API_KEY' },
    image: 'ui-llm-add-model-huggingface.png',
  },
  {
    label: 'Mistral AI',
    modelMatch: 'mistral-small-latest',
    credential: { kind: 'envVar', name: 'MISTRAL_API_KEY' },
    image: 'ui-llm-add-model-mistral.png',
  },
  {
    // Ollama needs no credential: the guide tells the reader to leave "Provider API key"
    // on Unset, which is already the default for a new model, so nothing is clicked here.
    label: 'Ollama',
    modelMatch: 'llama3.2',
    credential: { kind: 'none' },
    baseUrl: 'http://localhost:11434/v1',
    image: 'ui-llm-add-model-ollama.png',
  },
  {
    label: 'OpenRouter',
    modelMatch: 'anthropic/claude-haiku-4.5',
    credential: { kind: 'envVar', name: 'OPENROUTER_API_KEY' },
    image: 'ui-llm-add-model-openrouter.png',
  },
  {
    label: 'Together AI',
    modelMatch: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    credential: { kind: 'envVar', name: 'TOGETHER_API_KEY' },
    image: 'ui-llm-add-model-togetherai.png',
  },
  {
    label: 'xAI',
    modelMatch: 'grok-4.3',
    credential: { kind: 'envVar', name: 'XAI_API_KEY' },
    image: 'ui-llm-add-model-xai.png',
  },
];

/**
 * Open the Add model drawer on a clean Models page.
 *
 * Deliberately does not wait for `networkidle`: the wait buys nothing here (the page makes
 * one config fetch) and a page that holds a stream open makes it a guaranteed 30 s timeout,
 * which is how logs.spec.ts lost an afternoon. Waiting for the button is both the readiness
 * signal and the thing we are about to click.
 */
async function openAddModel(page: Page): Promise<void> {
  await page.goto('/ui/llm/models');
  await dismissWelcome(page);
  const addModel = page.getByRole('button', { name: 'Add model', exact: true });
  await expect(addModel).toBeVisible();
  await addModel.click();
  await expect(page.getByRole('heading', { name: 'Add model', exact: true })).toBeVisible();
}

/**
 * Pick a provider from the searchable Provider dropdown.
 *
 * The Dropdown primitive renders a `combobox` trigger named "Provider", a "Search Provider"
 * combobox inside the open listbox, and `option` rows. Searching rather than scrolling keeps
 * this independent of where the provider sits in a list of twenty-one.
 *
 * The option name is matched on a trailing-word boundary rather than exactly, because a
 * provider with no brand icon falls back to a text badge that lands inside the option's
 * accessible name: xAI's row reads "xA xAI", not "xAI". Anchoring the end still keeps
 * "OpenAI" from matching "OpenRouter".
 */
async function selectProvider(page: Page, label: string): Promise<void> {
  const escaped = escapeRegExp(label);
  await page.getByRole('combobox', { name: 'Provider', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search Provider', exact: true }).fill(label);
  await page.getByRole('option', { name: new RegExp(`(^|\\s)${escaped}$`) }).click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A text input in the drawer, addressed by the label printed above it.
 *
 * Not `getByLabel`: a Field renders its tooltip as a sibling `help-icon` span whose own
 * aria-label starts with the field's words ("Base URL for the upstream provider…"), so the
 * label text matches two elements. Restricting to the textbox role drops the span, and
 * anchoring the name at the start tolerates the tooltip text that Field appends to it —
 * which is present on some fields and absent on others depending on what the schema
 * supplied.
 */
function field(page: Page, label: string) {
  return page.getByRole('textbox', { name: new RegExp(`^${escapeRegExp(label)}`) });
}

/**
 * Set one of the region comboboxes by typing and then picking the match from its menu.
 *
 * FreeformCombobox opens its listbox on every keystroke, so the menu is left hanging over
 * the form unless something closes it — a green test and a screenshot of the wrong thing.
 * Choosing the option is what closes it, and it is what a reader does.
 *
 * Do NOT close the menu with Escape instead. The combobox only swallows Escape while its
 * menu is open, so the key reaches the drawer underneath and raises "Discard unsaved
 * changes?" — which then sits in the middle of the capture.
 *
 * Target the textbox by role: the input and the menu it opens carry the *same* aria-label,
 * so a bare getByLabel matches both once the menu is up.
 */
async function fillRegion(page: Page, label: string, value: string): Promise<void> {
  const region = page.getByRole('textbox', { name: label });
  await region.fill(value);
  const menu = page.getByRole('listbox', { name: label });
  await menu.getByRole('option', { name: new RegExp(`(^|\\s)${escapeRegExp(value)}$`) }).click();
  await expect(menu).toBeHidden();
  await expect(region).toHaveValue(value);
}

async function applyCredential(page: Page, credential: Credential): Promise<void> {
  switch (credential.kind) {
    case 'envVar':
      await page.getByRole('button', { name: 'Env var', exact: true }).click();
      await page.getByPlaceholder('ENV_VAR_NAME').fill(credential.name);
      break;

    case 'awsAmbient':
      // "Ambient" is already the default mode for a new model, matching the guide's
      // "Keep AWS credentials set to Ambient", so only the region is entered.
      await expect(page.getByRole('button', { name: 'Ambient', exact: true })).toHaveClass(/active/);
      await fillRegion(page, 'AWS region', credential.region);
      break;

    case 'gcpAdc':
      await expect(page.getByRole('button', { name: 'ADC', exact: true })).toHaveClass(/active/);
      await field(page, 'Vertex project').fill(credential.project);
      await fillRegion(page, 'Vertex region', credential.region);
      break;

    case 'azureApiKey':
      // Azure has its own credential control, and choosing "API key" there reveals the
      // usual Unset/Env var/API key/File row. Click them in that order: "API key" is
      // ambiguous once the nested control renders, but not before.
      await page.getByRole('button', { name: 'API key', exact: true }).click();
      await page.getByRole('button', { name: 'Env var', exact: true }).click();
      await page.getByPlaceholder('ENV_VAR_NAME').fill(credential.name);
      await field(page, 'Azure resource name').fill(credential.resourceName);
      break;

    case 'none':
      // Assert the Unset *state*, not the Unset button. The credential control sits inside
      // the "Provider API key" label, so the first segmented button inherits that label as
      // its accessible name and is not reachable as a button named "Unset" at all. The copy
      // below is what the Unset branch renders, which is the thing the guide is claiming.
      await expect(page.getByText('No provider credential configured.')).toBeVisible();
      break;
  }
}

for (const provider of PROVIDERS) {
  test(`Add model form for ${provider.label}`, async ({ page }) => {
    await openAddModel(page);

    // Provider first, then the model match. The guide numbers them the other way round, and
    // the end state is the same either way, but the editor rewrites the name field to the
    // provider's default whenever it still looks auto-filled — so setting the name last is
    // the order that cannot silently capture the wrong value.
    await selectProvider(page, provider.label);

    const modelMatch = field(page, 'Incoming model match');
    await modelMatch.fill(provider.modelMatch);

    await applyCredential(page, provider.credential);

    if (provider.baseUrl) {
      await field(page, 'Base URL').fill(provider.baseUrl);
    }

    // Assert the form actually holds what the guide's numbered steps say to type. Without
    // this a selector that silently matched nothing would still produce a green test and a
    // published screenshot of a half-empty form.
    await expect(modelMatch).toHaveValue(provider.modelMatch);
    if (provider.credential.kind === 'envVar' || provider.credential.kind === 'azureApiKey') {
      await expect(page.getByPlaceholder('ENV_VAR_NAME')).toHaveValue(provider.credential.name);
    }

    // Viewport capture, not fullPage: it pins every image to the project's 1280x720 so the
    // twenty-one tabs no longer jump size as the reader clicks across them. No masks — the
    // form is static, and a mask paints magenta into the published docs image.
    await expect(page).toHaveScreenshot(provider.image, { animations: 'disabled' });
  });
}
