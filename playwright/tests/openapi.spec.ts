import { test, expect, dismissWelcome, maskSession, selectTool } from '../fixtures/test';

/**
 * Capture for the OPENAPI -> MCP guide — content/docs/standalone/main/mcp/connect/openapi.md.
 * The Swagger Petstore OpenAPI spec is exposed as MCP tools (getPetById, findPetsByStatus,
 * addPet, ...). Single target named `openapi`, so tool names are not prefixed.
 *
 * Run with the backend up (CAPTURE_MODE=openapi): `npm run test:openapi`. See
 * scripts/serve-openapi-ui.sh — the swaggerapi/petstore3 container + its openapi.json.
 *
 * New-UI flow: /ui/mcp/playground → Apply CORS → Initialize → the Result panel lists the
 * Petstore operations → select getPetById, supply petId, Call tool.
 *
 * Images (light + dark per project):
 *   agentgateway-ui-tools-openapi.png         — "N tools discovered" listing the Petstore APIs
 *   agentgateway-ui-tools-openapi-success.png — a successful getPetById call (HTTP 200)
 */
test.describe('OpenAPI playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui/mcp/playground');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);

    const applyCors = page.getByRole('button', { name: /apply cors/i });
    if (await applyCors.count()) {
      await applyCors.click();
      await expect(applyCors).toBeHidden();
      await page.waitForTimeout(2_000); // gateway reload settle
    }

    await expect(async () => {
      await page.getByRole('button', { name: /initialize/i }).click();
      await expect(page.getByRole('button', { name: /^reset$/i })).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('petstore APIs discovered as tools', async ({ page }) => {
    await expect(page.getByText(/tools discovered/i)).toBeVisible();
    // exact match → the tool-list chip, not the (collapsed) Raw JSON block.
    await expect(page.getByText('getPetById', { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('agentgateway-ui-tools-openapi.png', {
      fullPage: true,
      ...maskSession(page),
    });
  });

  test('call getInventory successfully', async ({ page }) => {
    // getInventory takes no parameters, so the success path needs no argument entry — a
    // clean, deterministic OpenAPI tool call straight to Call tool. (Parameterized tools
    // like getPetById expose their args as a Monaco "Arguments JSON" editor.)
    await selectTool(page, 'getInventory');
    await page.getByRole('button', { name: /call tool/i }).click();

    await expect(page.getByText(/HTTP 200/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/tool output/i)).toBeVisible();
    await expect(page).toHaveScreenshot('agentgateway-ui-tools-openapi-success.png', {
      fullPage: true,
      ...maskSession(page),
    });
  });
});
