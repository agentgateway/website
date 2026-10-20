import { type Locator, type Page } from '@playwright/test';
import { test, expect, dismissWelcome, uiTabsOnly } from '../fixtures/test';

/**
 * "UI" tab captures for the standalone security, transformation, and rate limit guides, all
 * under content/docs/standalone/main/documentation/configuration/:
 *   security/cors.md, security/jwt-authn.md, security/oidc.md, security/http-authz.md,
 *   security/external-authz.md, security/mcp-authn.md, security/mcp-authz.md,
 *   traffic-management/transformations.md, resiliency/rate-limits.md.
 *
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-a.yaml (scripts/serve-fixture-ui.sh): an LLM
 * "*" model, a gpt-4 model, and one MCP target. No backends run.
 *
 * Every drawer is filled in with the guide's values and NEVER saved, so the fixture is unchanged
 * between runs and nothing remote is validated: the JWKS URLs, the OIDC issuer, and the ext authz
 * host in these captures do not have to exist. The policy drawers open straight from the URL
 * hash (`/ui/llm/policies#cors`), the same deep link the Policies page writes when a tile is
 * clicked. The values match each section's YAML example, so the image and the YAML describe the
 * same policy. If a guide changes a value, change it here too.
 *
 * CEL rules and the resource metadata YAML live in Monaco editors. They are filled with
 * keyboard.insertText after a select-all, which replaces the example text without Monaco's
 * auto-closing quotes and brackets doubling anything up.
 *
 * Produces (light + dark per project): ui-llm-policy-cors.png, ui-llm-policy-cors-bottom.png,
 * ui-llm-policy-jwt-auth.png, ui-llm-policy-jwt-authorization.png, ui-llm-policy-oidc.png,
 * ui-llm-policy-authorization.png, ui-llm-model-authorization.png,
 * ui-llm-policy-ext-authz-grpc.png, ui-llm-policy-ext-authz-http.png,
 * ui-llm-policy-ext-authz-http-details.png, ui-mcp-policy-authn-keycloak.png,
 * ui-mcp-policy-authn-keycloak-metadata.png, ui-mcp-policy-authn-resource-server.png,
 * ui-mcp-policy-authn-resource-server-metadata.png, ui-mcp-policy-authorization.png,
 * ui-llm-policy-transformations.png, ui-llm-policy-transformations-response.png,
 * ui-llm-policy-transformations-listener.png, ui-llm-policy-local-rate-limit.png.
 *
 * Not captured: http-authz.md "Require rules" (its one rule is rule 3 of the authorization
 * capture), mcp-authz.md "Role-based access with JWT claims" (repeats the Resource Server Only
 * form and the MCP authorization rules), and rate-limits.md "Token-based rate limits" (only
 * switches Limit type to Tokens).
 */

/** Open a policy drawer from its deep link and wait for the drawer heading. */
async function openPolicy(page: Page, area: 'llm' | 'mcp', key: string, title: string): Promise<Locator> {
  await page.goto(`/ui/${area}/policies#${key}`);
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  const drawer = page.getByRole('dialog', { name: title });
  await expect(drawer.getByRole('heading', { name: title, exact: true })).toBeVisible();
  return drawer;
}

/**
 * Type a value into a list editor's input and click that editor's own Add button. Never press
 * Enter: the input sits inside the policy form, and submitting it would save the policy.
 */
async function addListValue(field: Locator, value: string): Promise<void> {
  await field.fill(value);
  await field
    .locator('xpath=ancestor::*[.//button[normalize-space()="Add"]][1]')
    .getByRole('button', { name: 'Add', exact: true })
    .click();
}

/** Replace the contents of a Monaco editor. */
async function fillMonaco(page: Page, editor: Locator, text: string): Promise<void> {
  await editor.locator('.view-lines').click();
  await expect(editor).toHaveClass(/\bfocused\b/);
  // Monaco picks Cmd or Ctrl from the user agent, not the host OS. The projects use the
  // 'Desktop Chrome' device, whose user agent is Windows, so select-all is Ctrl+A on every host.
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
}

/** The first Monaco editor that follows a field label, for fields with no accessible name. */
function monacoAfter(scope: Locator, label: string): Locator {
  return scope
    .getByText(label, { exact: true })
    .locator('xpath=ancestor::*[.//div[contains(@class,"monaco-editor")]][1]')
    .locator('.monaco-editor')
    .first();
}

/**
 * Drop focus so no field shows a focus ring or caret in the published image, and park the mouse
 * on the dimmed page so no button in the drawer keeps a hover state.
 */
async function blurAll(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(5, 700);
}

/**
 * Scroll the drawer body so `target` sits at the top (or as far as the body scrolls), and wait
 * for the scroll to land. Scrolling while the drawer is still rendering gets undone, so the
 * caller waits for the content it needs first.
 */
async function scrollDrawerTo(drawer: Locator, target: Locator): Promise<void> {
  const body = drawer.locator('.drawer-body');
  await target.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
}

/** Scroll the drawer body back to the top. */
async function scrollDrawerTop(drawer: Locator): Promise<void> {
  const body = drawer.locator('.drawer-body');
  await body.evaluate((el) => (el.scrollTop = 0));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(0);
}

/**
 * Add authorization rules: Add rule, pick the effect, replace the example expression, then
 * collapse the rule with Done so every rule shows as a one-line summary with its effect badge.
 */
async function addRules(
  page: Page,
  scope: Locator,
  rules: Array<{ effect: 'Allow' | 'Deny' | 'Require'; expression: string }>,
): Promise<void> {
  for (const [i, rule] of rules.entries()) {
    await scope.getByRole('button', { name: 'Add rule' }).first().click();
    const card = scope.locator('.authz-rule-card').nth(i);
    if (rule.effect !== 'Allow') {
      await card.getByRole('combobox', { name: `Rule ${i + 1} effect` }).click();
      await page.getByRole('option', { name: new RegExp(`^${rule.effect}\\b`) }).click();
    }
    await fillMonaco(page, card.locator('.monaco-editor'), rule.expression);
    await card.getByRole('button', { name: 'Done' }).click();
    await expect(card.locator('code')).toHaveText(rule.expression);
  }
}

test.describe('UI tabs: policies and security', () => {
  uiTabsOnly();

  // security/cors.md, "UI" tab: the Simplified (LLM) cors policy. Two captures, because the
  // drawer is taller than the viewport: origins, methods, and headers; then expose headers,
  // credentials, and max age.
  test('cors', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'cors', 'CORS');
    await addListValue(drawer.getByPlaceholder('http://localhost:19000', { exact: true }), 'https://chat.example.com');
    await drawer.getByRole('button', { name: 'OPTIONS', exact: true }).click();
    await drawer.getByRole('button', { name: 'GET', exact: true }).click();
    await drawer.getByRole('checkbox', { name: /allow all request headers/i }).click();
    await drawer.getByRole('button', { name: 'authorization', exact: true }).click();
    await drawer.getByRole('button', { name: 'content-type', exact: true }).click();
    await drawer.getByRole('button', { name: 'x-request-id', exact: true }).click();
    await drawer.getByRole('checkbox', { name: /allow credentials/i }).click();
    await drawer.getByRole('textbox', { name: 'Max age' }).fill('10m');
    await blurAll(page);
    await scrollDrawerTop(drawer);
    await expect(page).toHaveScreenshot('ui-llm-policy-cors.png');

    await scrollDrawerTo(drawer, drawer.getByText(/^credentials$/i));
    await expect(drawer.getByRole('textbox', { name: 'Max age' })).toHaveValue('10m');
    await expect(page).toHaveScreenshot('ui-llm-policy-cors-bottom.png');
  });

  // security/jwt-authn.md, first "UI" tab: the Simplified (LLM) jwtAuth policy.
  test('jwt auth', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'jwtAuth', 'JWT auth');
    await drawer.getByRole('button', { name: /^strict\b/i }).click();
    await drawer.getByRole('button', { name: /^local file\b/i }).click();
    await drawer.getByRole('textbox', { name: 'JWKS file' }).fill('./manifests/jwt/pub-key');
    await drawer.getByRole('textbox', { name: 'Issuer' }).fill('agentgateway.dev');
    await addListValue(drawer.getByPlaceholder('api://gateway', { exact: true }), 'test.agentgateway.dev');
    await blurAll(page);
    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'Signing keys' }));
    await expect(page).toHaveScreenshot('ui-llm-policy-jwt-auth.png');
  });

  // security/jwt-authn.md, second "UI" tab: the authorization policy that pairs with jwtAuth.
  test('jwt authorization rule', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'authorization', 'Authorization');
    await addRules(page, drawer, [
      { effect: 'Allow', expression: 'request.path == "/admin" && jwt.groups.contains("admins")' },
    ]);
    await blurAll(page);
    await expect(page).toHaveScreenshot('ui-llm-policy-jwt-authorization.png');
  });

  // security/oidc.md, "Configuration" UI tab: the Simplified (LLM) oidc policy.
  test('oidc', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'oidc', 'OIDC');
    await drawer.getByRole('button', { name: 'Keycloak', exact: true }).click();
    const issuer = drawer.getByRole('textbox', { name: 'Issuer' });
    await expect(issuer).toHaveValue(/\{realm\}/);
    await issuer.fill('http://localhost:7080/realms/agentgateway');
    await drawer.getByRole('textbox', { name: 'Client ID' }).fill('agentgateway-browser');
    await drawer.getByRole('textbox', { name: 'Client secret' }).fill('agentgateway-secret');
    await drawer.getByRole('textbox', { name: 'Redirect URI' }).fill('http://localhost:3000/oauth/callback');
    await drawer.getByRole('button', { name: 'profile', exact: true }).click();
    await drawer.getByRole('button', { name: 'email', exact: true }).click();
    await blurAll(page);
    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'Client', exact: true }));
    await expect(page).toHaveScreenshot('ui-llm-policy-oidc.png');
  });

  // security/http-authz.md, first "UI" tab: the Simplified (LLM) authorization policy, all four
  // rules. The "Require rules" tab is not captured: its one rule is the third rule here.
  test('authorization rules', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'authorization', 'Authorization');
    await addRules(page, drawer, [
      { effect: 'Allow', expression: 'request.path == "/authz/public"' },
      { effect: 'Deny', expression: 'request.path == "/authz/deny"' },
      { effect: 'Require', expression: 'jwt.aud == "my-service"' },
      { effect: 'Allow', expression: 'request.headers["x-allow"] == "true"' },
    ]);
    await blurAll(page);
    await expect(page).toHaveScreenshot('ui-llm-policy-authorization.png');
  });

  // security/http-authz.md, "LLM authorization" UI tab: model-level rules on the gpt-4 model,
  // in the Edit model drawer's Advanced > Model policies > Authorization section.
  test('model authorization', async ({ page }) => {
    await page.goto('/ui/llm/models#edit=gpt-4');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    const drawer = page.getByRole('dialog', { name: 'Edit model' });
    await expect(drawer.getByRole('textbox', { name: 'Incoming model match' })).toHaveValue('gpt-4');
    await drawer.getByRole('button', { name: /^advanced\b/i }).click();
    await drawer.getByRole('button', { name: /^model policies\b/i }).click();
    await drawer.getByRole('button', { name: /^authorization\b/i }).click();
    await addRules(page, drawer, [
      { effect: 'Require', expression: 'jwt.aud == "llm-api"' },
      { effect: 'Deny', expression: 'request.headers["x-org"] == "blocked"' },
      { effect: 'Allow', expression: 'request.headers["x-org"] == "engineering"' },
    ]);
    await blurAll(page);
    await scrollDrawerTo(drawer, drawer.getByRole('button', { name: /^authorization\b/i }));
    await expect(drawer.getByRole('button', { name: 'Apply authorization' })).toBeVisible();
    await expect(page).toHaveScreenshot('ui-llm-model-authorization.png');
  });

  // security/external-authz.md, "gRPC External Authorization" UI tab: host plus one metadata entry.
  test('ext authz grpc', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'extAuthz', 'External authz');
    await drawer.getByRole('textbox', { name: 'Host' }).fill('localhost:9000');
    await expect(drawer.getByRole('combobox', { name: 'Protocol' })).toHaveText(/gRPC/);
    await drawer.getByPlaceholder('key', { exact: true }).last().fill('dev.agentgateway.jwt');
    await addListValue(drawer.getByPlaceholder('CEL expression', { exact: true }), '{"claims": jwt}');
    await blurAll(page);
    await expect(drawer.getByText('dev.agentgateway.jwt', { exact: true })).toBeVisible();
    // The target and the default gRPC/Deny behavior need no input, so the capture opens on the
    // gRPC details section that holds the one value the guide adds.
    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'gRPC details' }));
    await expect(page).toHaveScreenshot('ui-llm-policy-ext-authz-grpc.png');
  });

  // security/external-authz.md, "HTTP External Authorization" UI tab. Two captures, because the
  // drawer is taller than the viewport: protocol and request headers, then the HTTP details.
  test('ext authz http', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'extAuthz', 'External authz');
    await drawer.getByRole('textbox', { name: 'Host' }).fill('localhost:9000');
    await drawer.getByRole('combobox', { name: 'Protocol' }).click();
    await page.getByRole('option', { name: /^HTTP\b/ }).click();
    await addListValue(drawer.getByPlaceholder('authorization', { exact: true }), 'cookie');
    await fillMonaco(page, monacoAfter(drawer, 'Path expression'), '"/auth" + request.path');
    await addListValue(drawer.getByPlaceholder('x-auth-request-user', { exact: true }), 'x-auth-request-user');
    await blurAll(page);
    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'Authorization behavior' }));
    await expect(page).toHaveScreenshot('ui-llm-policy-ext-authz-http.png');

    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'HTTP details' }));
    await expect(drawer.getByText('x-auth-request-user', { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('ui-llm-policy-ext-authz-http-details.png');
  });

  /** Fill the MCP authentication drawer with a remote JWKS, issuer, audience, and metadata. */
  async function fillMcpAuthn(page: Page, v: { jwks: string; issuer: string; metadata: string }) {
    const drawer = await openPolicy(page, 'mcp', 'mcpAuthentication', 'MCP authentication');
    await expect(drawer.getByRole('combobox', { name: 'Validation mode' })).toHaveText(/Strict/);
    await drawer.getByRole('button', { name: 'Remote URL', exact: true }).click();
    await drawer.getByRole('textbox', { name: 'JWKS URL' }).fill(v.jwks);
    await drawer.getByRole('textbox', { name: 'Issuer' }).fill(v.issuer);
    await addListValue(drawer.getByPlaceholder('mcp://gateway', { exact: true }), 'http://localhost:3000/mcp');
    await fillMonaco(page, monacoAfter(drawer, 'Resource metadata YAML'), v.metadata);
    await blurAll(page);
    return drawer;
  }

  /**
   * Two captures per MCP authentication tab, because the drawer is taller than the viewport:
   * signing keys and token validation, then the protected resource metadata.
   */
  async function captureMcpAuthn(page: Page, drawer: Locator, name: string) {
    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'Signing keys' }));
    await expect(page).toHaveScreenshot(`${name}.png`);
    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'Protected resource metadata' }));
    await expect(drawer.getByText('Resource metadata YAML', { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}-metadata.png`);
  }

  // security/mcp-authn.md, "Authorization Server Proxy" UI tab: the keycloak example, before
  // the Raw toggle step that adds `provider`.
  test('mcp authn keycloak', async ({ page }) => {
    const drawer = await fillMcpAuthn(page, {
      jwks: 'http://localhost:7080/realms/mcp/protocol/openid-connect/certs',
      issuer: 'http://localhost:7080/realms/mcp',
      metadata: [
        'resource: http://localhost:3000/mcp',
        'scopesSupported:',
        '- read:all',
        'bearerMethodsSupported:',
        '- header',
        '- body',
        '- query',
        'resourceDocumentation: http://localhost:3000/stdio/docs',
        'resourcePolicyUri: http://localhost:3000/stdio/policies',
      ].join('\n'),
    });
    await captureMcpAuthn(page, drawer, 'ui-mcp-policy-authn-keycloak');
  });

  // security/mcp-authn.md, "Resource Server Only" UI tab.
  test('mcp authn resource server', async ({ page }) => {
    const drawer = await fillMcpAuthn(page, {
      jwks: 'http://localhost:9000/.well-known/jwks.json',
      issuer: 'http://localhost:9000',
      metadata: [
        'resource: http://localhost:3000/mcp',
        'scopesSupported:',
        '- read:all',
        'bearerMethodsSupported:',
        '- header',
        '- body',
        '- query',
      ].join('\n'),
    });
    await captureMcpAuthn(page, drawer, 'ui-mcp-policy-authn-resource-server');
  });

  // security/mcp-authz.md, first "UI" tab: three allow rules. The "Role-based access with JWT
  // claims" tab repeats the Resource Server Only authentication form and these same rules, so it
  // is not captured.
  test('mcp authorization', async ({ page }) => {
    const drawer = await openPolicy(page, 'mcp', 'mcpAuthorization', 'MCP authorization');
    await addRules(page, drawer, [
      { effect: 'Allow', expression: 'mcp.tool.name == "echo"' },
      { effect: 'Allow', expression: 'jwt.sub == "test-user" && mcp.tool.name == "add"' },
      { effect: 'Allow', expression: 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"' },
    ]);
    await blurAll(page);
    await expect(page).toHaveScreenshot('ui-mcp-policy-authorization.png');
  });

  /**
   * The transformation sections render their fields only while expanded, and every editor in
   * them uses the same placeholders. With both sections open, the "header name" inputs are, in
   * order: request Add, Set, Remove, then response Add, Set, Remove. The "CEL expression" inputs
   * are request Add, Set, Metadata, then response Add, Set, Metadata.
   */
  async function addHeader(drawer: Locator, index: number, name: string, cel: string) {
    await drawer.getByPlaceholder('header name', { exact: true }).nth(index * 3).fill(name);
    await addListValue(drawer.getByPlaceholder('CEL expression', { exact: true }).nth(index * 3), cel);
  }

  // traffic-management/transformations.md, "Route-level header transformation" UI tab. Two
  // captures, because the drawer is taller than the viewport: request, then response.
  test('transformations', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'transformations', 'Transformations');
    await drawer.getByRole('button', { name: /^request transformations\b/i }).click();
    await drawer.getByRole('button', { name: /^response transformations\b/i }).click();
    await expect(drawer.getByPlaceholder('header name', { exact: true })).toHaveCount(6);
    await addHeader(drawer, 0, 'x-request-path', 'request.path');
    await addHeader(drawer, 0, 'x-client-ip', 'source.address');
    await addHeader(drawer, 1, 'x-response-code', 'string(response.code)');
    const remove = drawer.getByPlaceholder('header name', { exact: true }).nth(5);
    await addListValue(remove, 'server');
    await addListValue(remove, 'x-content-type-options');
    await blurAll(page);
    await scrollDrawerTop(drawer);
    await expect(page).toHaveScreenshot('ui-llm-policy-transformations.png');

    await scrollDrawerTo(drawer, drawer.getByRole('heading', { name: 'Response transformations' }));
    await expect(page).toHaveScreenshot('ui-llm-policy-transformations-response.png');
  });

  // traffic-management/transformations.md, "Listener-level header transformation" UI tab.
  test('transformations listener', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'transformations', 'Transformations');
    await drawer.getByRole('button', { name: /^request transformations\b/i }).click();
    await expect(drawer.getByPlaceholder('header name', { exact: true })).toHaveCount(3);
    await addHeader(drawer, 0, 'x-gateway', '"agentgateway"');
    await blurAll(page);
    await expect(page).toHaveScreenshot('ui-llm-policy-transformations-listener.png');
  });

  // resiliency/rate-limits.md, "Request-based rate limits" UI tab. The "Token-based rate limits"
  // tab only switches Limit type to Tokens, so it is not captured.
  test('local rate limit', async ({ page }) => {
    const drawer = await openPolicy(page, 'llm', 'localRateLimit', 'Local rate limit');
    await expect(drawer.getByRole('combobox', { name: 'Limit type' })).toHaveText(/Requests/);
    await drawer.getByRole('textbox', { name: 'Fill interval' }).fill('60s');
    await drawer.getByRole('spinbutton', { name: 'Max tokens' }).fill('10');
    await drawer.getByRole('spinbutton', { name: 'Tokens per fill' }).fill('1');
    await blurAll(page);
    await expect(page).toHaveScreenshot('ui-llm-policy-local-rate-limit.png');
  });
});
