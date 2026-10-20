import { test, expect, dismissWelcome, mainOnly } from '../fixtures/test';
import type { Locator, Page } from '@playwright/test';

/**
 * "UI" tab captures for the standalone observability guides and two UI setup guides:
 *   - documentation/observability/traces/setup.md (also reused by traces/configs/jaeger.md and
 *     integrations/llm/observability/phoenix.md, which fill the Tracing drawer with the same values)
 *   - integrations/llm/observability/langfuse.md and langsmith.md
 *   - documentation/observability/access-logs/view.md, export.md, and database.md
 *   - assets/agw-docs/standalone/setup/ui/secure.md (Settings > UI > OIDC)
 *   - assets/agw-docs/standalone/setup/ui/expose.md (Edit gateway > HTTPS + TLS)
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-f.yaml.
 *
 * Every drawer is filled in but NEVER saved, so the fixture is unchanged between runs, no OTLP
 * collector or OIDC issuer has to exist (the OIDC card fetches the discovery document only on
 * save), and the captures stay deterministic. Values match each section's YAML example.
 *
 * Produces (light + dark per project): ui-tracing-enable.png, ui-tracing-filter.png,
 * ui-tracing-attributes.png, ui-tracing-remove.png, ui-tracing-langfuse.png,
 * ui-tracing-langsmith.png, ui-access-logs-preset.png, ui-access-logs-add-fields.png,
 * ui-access-logs-guardrails.png, ui-access-logs-otlp.png, ui-access-logs-otlp-filter.png,
 * ui-access-logs-database-llm.png, ui-access-logs-database-fields.png, ui-settings-oidc.png,
 * ui-settings-oidc-client.png, ui-gateway-tls.png.
 */

async function openDrawer(page: Page, path: string, card: RegExp): Promise<Locator> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await page.getByRole('button', { name: card }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('button', { name: /save policy/i })).toBeVisible();
  return drawer;
}

const openTracing = (page: Page) => openDrawer(page, '/ui/settings/observability', /Tracing/);
const openAccessLogs = (page: Page) => openDrawer(page, '/ui/settings/observability', /Access logs/);

/** The input that follows a field label (the labels are not associated with their inputs). */
function field(drawer: Locator, label: string): Locator {
  return drawer
    .locator('label')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, 'i') })
    .locator('xpath=ancestor::*[.//input or .//textarea][1]')
    .locator('input, textarea')
    .first();
}

/** Fill a name/value row (found by its placeholders) and click that row's Add button. */
async function addPair(drawer: Locator, namePh: string, valuePh: string, name: string, value: string) {
  const nameInput = drawer.getByPlaceholder(namePh, { exact: true });
  await nameInput.fill(name);
  await drawer.getByPlaceholder(valuePh, { exact: true }).fill(value);
  await nameInput
    .locator('xpath=ancestor::*[.//button[normalize-space()="Add"]][1]')
    .getByRole('button', { name: 'Add', exact: true })
    .click();
  await expect(drawer.getByText(name, { exact: true }).first()).toBeVisible();
}

/** Fill a single-value list row (found by its placeholder) and click that row's Add button. */
async function addItem(drawer: Locator, ph: string, value: string) {
  const input = drawer.getByPlaceholder(ph, { exact: true });
  await input.fill(value);
  await input
    .locator('xpath=ancestor::*[.//button[normalize-space()="Add"]][1]')
    .getByRole('button', { name: 'Add', exact: true })
    .click();
  await expect(drawer.getByText(value, { exact: true }).first()).toBeVisible();
}

/**
 * Put text into one of the drawer's code editors (Backend policies, Filter, OTLP filter). They
 * are Monaco editors, not textareas: fill() cannot reach them, a click on the tiny edit-context
 * element never lands, and typed YAML gets Monaco's auto-indent on top of its own. So focus the
 * editor by clicking its surface and dispatch a paste, which Monaco inserts verbatim.
 */
async function editor(drawer: Locator, index: number, text: string) {
  const surface = drawer.locator('.monaco-editor').nth(index);
  await surface.click();
  await drawer.getByRole('textbox', { name: 'Editor content' }).nth(index).evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
  await expect(surface).toContainText(text.split('\n')[0]);
  // Blur the editor, which closes Monaco's "No suggestions." widget: left open, it shows in the
  // capture and sits on top of any option list opened next. (Escape would close the drawer.)
  await drawer.getByRole('textbox', { name: 'Editor content' }).nth(index).evaluate((el) => (el as HTMLElement).blur());
  await expect(drawer.getByText('No suggestions.')).toBeHidden();
}

async function select(page: Page, drawer: Locator, combobox: string, option: RegExp) {
  await drawer.getByRole('combobox', { name: combobox }).click();
  await page.getByRole('option', { name: option }).first().click();
}

/**
 * Pin a section heading to the top of the drawer body and wait until the body has actually
 * scrolled: a scroll issued while the drawer is still rendering is undone when it finishes.
 */
async function scrollTo(drawer: Locator, heading: string) {
  const body = drawer.locator('.drawer-body');
  await drawer.getByText(heading, { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
}

/**
 * Drop the focus ring so the published image shows a filled form, not a field mid-edit, and park
 * the mouse on the drawer's backdrop so the last clicked button does not keep its hover shade.
 */
async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(400, 650);
}

test.describe('Tracing drawer', () => {
  mainOnly();

  // traces/setup.md, "Enable tracing": localhost:4317 over gRPC with randomSampling: true.
  // Also used by traces/configs/jaeger.md and integrations/llm/observability/phoenix.md.
  test('enable tracing', async ({ page }) => {
    const drawer = await openTracing(page);
    await expect(field(drawer, 'Host')).toHaveValue('localhost:4317');
    await expect(drawer.getByRole('combobox', { name: 'Protocol' })).toHaveText(/gRPC/);
    await field(drawer, 'Random sampling').fill('true');
    await blur(page);
    await scrollTo(drawer, 'Export');
    await expect(page).toHaveScreenshot('ui-tracing-enable.png');
  });

  // traces/setup.md, "Filter spans": randomSampling: true and filter 'response.code >= 400'.
  test('filter spans', async ({ page }) => {
    const drawer = await openTracing(page);
    await field(drawer, 'Random sampling').fill('true');
    await editor(drawer, 1, 'response.code >= 400');
    await blur(page);
    await scrollTo(drawer, 'Sampling');
    await expect(page).toHaveScreenshot('ui-tracing-filter.png');
  });

  // traces/setup.md, "Add span and resource attributes": two resources and two span attributes.
  test('span and resource attributes', async ({ page }) => {
    const drawer = await openTracing(page);
    await field(drawer, 'Random sampling').fill('true');
    await drawer.getByRole('button', { name: 'service.name', exact: true }).click();
    await addPair(drawer, 'service.name', '"agentgateway"', 'service.name', '"my-agentgateway"');
    await drawer.getByRole('button', { name: 'deployment.environment', exact: true }).click();
    await addPair(drawer, 'service.name', '"agentgateway"', 'deployment.environment', '"production"');
    await addPair(drawer, 'http.route', 'request.path', 'user.id', 'request.headers["x-user-id"]');
    await addPair(drawer, 'http.route', 'request.path', 'request.path', 'request.path');
    await blur(page);
    await scrollTo(drawer, 'Attributes');
    await expect(page).toHaveScreenshot('ui-tracing-attributes.png');
  });

  // traces/setup.md, "Remove span attributes": client.address and network.protocol.version.
  test('remove attributes', async ({ page }) => {
    const drawer = await openTracing(page);
    await field(drawer, 'Random sampling').fill('true');
    await addItem(drawer, 'http.user_agent', 'client.address');
    await addItem(drawer, 'http.user_agent', 'network.protocol.version');
    await blur(page);
    await scrollTo(drawer, 'Attributes');
    await expect(page).toHaveScreenshot('ui-tracing-remove.png');
  });

  // Langfuse and LangSmith, "Configuration": an HTTPS OTLP endpoint with a path and auth header.
  for (const c of [
    {
      name: 'langfuse',
      host: 'cloud.langfuse.com:443',
      path: '/api/public/otel/v1/traces',
      header: 'Authorization: "Basic ${LANGFUSE_AUTH_HEADER}"',
    },
    {
      name: 'langsmith',
      host: 'api.smith.langchain.com:443',
      path: '/otel/v1/traces',
      header: 'x-api-key: "${LANGSMITH_API_KEY}"',
    },
  ]) {
    // integrations/llm/observability/<name>.md, "Configuration" > UI tab.
    test(`${c.name} tracing`, async ({ page }) => {
      const drawer = await openTracing(page);
      // The editor goes first so that the next fill moves focus, and its cursor, out of it.
      await editor(drawer, 0, `backendTLS: {}\nrequestHeaderModifier:\n  set:\n    ${c.header}`);
      await field(drawer, 'Host').fill(c.host);
      await select(page, drawer, 'Protocol', /^HTTP\b/);
      await field(drawer, 'Path').fill(c.path);
      await field(drawer, 'Random sampling').fill('true');
      await blur(page);
      // Start just below the Target heading so Host, Backend policies, and Protocol + Path fit.
      const body = drawer.locator('.drawer-body');
      await field(drawer, 'Host').evaluate((el) => {
        const scroller = el.closest('.drawer-body') as HTMLElement;
        scroller.scrollTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 40;
      });
      await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(page).toHaveScreenshot(`ui-tracing-${c.name}.png`);
    });
  }
});

test.describe('Access logs drawer', () => {
  mainOnly();

  // access-logs/view.md, "Use OpenTelemetry field names": preset: otel.
  test('otel preset', async ({ page }) => {
    const drawer = await openAccessLogs(page);
    await select(page, drawer, 'Stdout preset', /^OpenTelemetry/);
    await expect(drawer.getByRole('combobox', { name: 'Stdout preset' })).toHaveText(/OpenTelemetry/);
    await blur(page);
    await expect(page).toHaveScreenshot('ui-access-logs-preset.png');
  });

  // access-logs/view.md, "Add custom fields to logs": user_id, env, and cost.
  test('add fields', async ({ page }) => {
    const drawer = await openAccessLogs(page);
    await addPair(drawer, 'user', 'jwt.sub', 'user_id', 'request.headers["x-user-id"]');
    await addPair(drawer, 'user', 'jwt.sub', 'env', '"production"');
    await addPair(drawer, 'user', 'jwt.sub', 'cost', 'string(llm.cost)');
    await blur(page);
    await expect(page).toHaveScreenshot('ui-access-logs-add-fields.png');
  });

  // access-logs/view.md, "Log guardrail results": a filter plus two fields.
  test('guardrails', async ({ page }) => {
    const drawer = await openAccessLogs(page);
    await editor(drawer, 0, 'guardrails.size() > 0');
    await addPair(drawer, 'user', 'jwt.sub', 'guardrails', 'guardrails');
    await addPair(drawer, 'user', 'jwt.sub', 'guardrail_action', 'guardrails[0].action');
    await blur(page);
    await expect(page).toHaveScreenshot('ui-access-logs-guardrails.png');
  });

  // access-logs/export.md, the setup steps: OTLP export to localhost:4317 over gRPC.
  test('otlp export', async ({ page }) => {
    const drawer = await openAccessLogs(page);
    await drawer.getByText('Export logs over OTLP', { exact: true }).click();
    await expect(field(drawer, 'Collector host')).toHaveValue('localhost:4317');
    await blur(page);
    await scrollTo(drawer, 'OTLP export');
    await expect(page).toHaveScreenshot('ui-access-logs-otlp.png');
  });

  // access-logs/export.md, "Filter logs before export": otlp.filter 'response.code >= 400'.
  test('otlp filter', async ({ page }) => {
    const drawer = await openAccessLogs(page);
    await drawer.getByText('Export logs over OTLP', { exact: true }).click();
    await expect(field(drawer, 'Collector host')).toHaveValue('localhost:4317');
    await editor(drawer, 1, 'response.code >= 400');
    await blur(page);
    await scrollTo(drawer, 'OTLP export');
    await expect(page).toHaveScreenshot('ui-access-logs-otlp-filter.png');
  });

  // access-logs/database.md, the LLM content step: database.llm: full.
  test('database llm detail', async ({ page }) => {
    const drawer = await openAccessLogs(page);
    await select(page, drawer, 'LLM detail', /^Full/);
    await expect(drawer.getByRole('combobox', { name: 'LLM detail' })).toHaveText(/Full/);
    await blur(page);
    await scrollTo(drawer, 'Database');
    await expect(page).toHaveScreenshot('ui-access-logs-database-llm.png');
  });

  // access-logs/database.md, "Add custom fields to database logs": user_id.
  test('database fields', async ({ page }) => {
    const drawer = await openAccessLogs(page);
    await addPair(drawer, 'team', 'request.headers["x-team"]', 'user_id', 'request.headers["x-user-id"]');
    await blur(page);
    await scrollTo(drawer, 'Database');
    await expect(page).toHaveScreenshot('ui-access-logs-database-fields.png');
  });
});

test.describe('UI settings and gateway TLS', () => {
  mainOnly();

  // setup/ui/secure.md, "Binary and Docker" > UI tab, step 4: the OIDC card with env var
  // references. Two captures because the drawer is taller than the viewport: the issuer, then
  // the client and scopes. Never saved, so the issuer's discovery document is never fetched.
  test('oidc policy', async ({ page }) => {
    const drawer = await openDrawer(page, '/ui/settings/ui', /OIDC/);
    await drawer.getByPlaceholder('https://issuer.example.com', { exact: true }).fill('${ISSUER_URL}');
    await drawer.getByPlaceholder('agentgateway-browser', { exact: true }).fill('${UI_CLIENT_ID}');
    await drawer.getByPlaceholder('OAuth2 client secret', { exact: true }).fill('${UI_CLIENT_SECRET}');
    await drawer.getByPlaceholder('http://localhost:4000/oauth/callback', { exact: true }).fill('${REDIRECT_URI}');
    await drawer.getByRole('button', { name: 'profile', exact: true }).click();
    await drawer.getByRole('button', { name: 'email', exact: true }).click();
    await expect(drawer.getByText('No additional scopes configured.')).toHaveCount(0);
    await blur(page);
    // Clicking the scope suggestions scrolled the drawer down; the first capture is its top.
    const body = drawer.locator('.drawer-body');
    await body.evaluate((el) => el.scrollTo(0, 0));
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(page).toHaveScreenshot('ui-settings-oidc.png');

    await scrollTo(drawer, 'Client');
    await expect(drawer.getByPlaceholder('agentgateway-browser', { exact: true })).toHaveValue('${UI_CLIENT_ID}');
    await expect(page).toHaveScreenshot('ui-settings-oidc-client.png');
  });

  // setup/ui/expose.md, "Binary and Docker" > UI tab, step 4: ui-gateway switched to HTTPS with
  // the certificate and key paths.
  test('gateway tls', async ({ page }) => {
    await page.goto('/ui/traffic/gateways');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    // Rows are default, then ui-gateway; the name check below fails if that order changes.
    await page.getByRole('button', { name: /edit/i }).nth(1).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByPlaceholder('public', { exact: true })).toHaveValue('ui-gateway');
    await select(page, drawer, 'Protocol', /^HTTPS$/);
    const tls = drawer.getByText(/^TLS$/).first();
    const cert = drawer.getByPlaceholder('/etc/certs/tls.crt', { exact: true });
    if (!(await cert.isVisible())) await tls.click();
    await cert.fill('/etc/agentgateway/tls/tls.crt');
    await drawer.getByPlaceholder('/etc/certs/tls.key', { exact: true }).fill('/etc/agentgateway/tls/tls.key');
    await blur(page);
    await expect(drawer.getByRole('combobox', { name: 'Protocol' })).toHaveText(/HTTPS/);
    await expect(page).toHaveScreenshot('ui-gateway-tls.png');
  });
});
