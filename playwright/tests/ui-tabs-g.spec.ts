import { type Page } from '@playwright/test';
import { test, expect, dismissWelcome, uiTabsOnly, blurAll } from '../fixtures/test';

/**
 * Captures for the 1.7 UI features:
 *   - assets/agw-docs/standalone/setup/ui/launch.md (setup/ui/launch-ui.md): raw mode in a drawer,
 *     its Invalid configuration banner, the two Settings sub-pages in the tour, and the Continue
 *     recipe on Client Setup.
 *   - assets/agw-docs/standalone/virtual-keys.md (llm/cost-controls/virtual-keys.md), "Rotate a
 *     virtual key" UI tab: alice's custom key replaced in the Edit virtual key drawer.
 *
 * Runs under CAPTURE_MODE=fixture FIXTURE=ui-tabs-g.yaml. No drawer is saved, so the fixture is
 * unchanged between captures and runs. The keys match the guides: alice's vk-alice-4f9c2a is the
 * key that the rotation steps edit, and bob-key is the raw mode YAML example.
 *
 * Produces (light + dark): ui-llm-key-rotate.png, ui-llm-key-raw.png, ui-llm-key-raw-invalid.png,
 * ui-tour-settings-ui.png, ui-tour-settings-observability.png, ui-tour-client-setup-continue.png.
 */

// An empty spot in the drawer body, below the last section in every capture here. Parking the
// mouse there keeps the Raw button's tooltip and the last button's hover shade out of the image.
const DRAWER_PARK = { x: 900, y: 600 };
// The empty space under the settings sub-page list.
const PAGE_PARK = { x: 330, y: 650 };

async function editKey(page: Page, name: string) {
  await page.goto('/ui/llm/keys');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await page.getByRole('row', { name: new RegExp(`^${name}\\b`) }).getByRole('button', { name: 'Edit key' }).click();
  const drawer = page.getByRole('dialog', { name: 'Edit virtual key' });
  await expect(drawer.getByRole('heading', { name: 'Edit virtual key' })).toBeVisible();
  return drawer;
}

async function openRaw(drawer) {
  await drawer.getByRole('button', { name: 'Raw' }).click();
  await expect(drawer.getByRole('button', { name: 'Raw' })).toHaveAttribute('aria-pressed', 'true');
  await expect(drawer.locator('.view-lines')).toBeVisible();
}

async function openSettings(page: Page, path: string, heading: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

test.describe('UI tabs: 1.7 UI features', () => {
  uiTabsOnly();

  // virtual-keys.md, "Rotate a virtual key" > UI tab, step 2: Edit, then the new custom value.
  test('rotate a custom key', async ({ page }) => {
    const drawer = await editKey(page, 'alice');
    await drawer.getByRole('button', { name: 'Edit', exact: true }).click();
    // The key value input has no label, only the generated-key placeholder.
    const keyValue = drawer.getByPlaceholder('agw_sk_...');
    await keyValue.fill('vk-alice-7c2e5b');
    await expect(keyValue).toHaveValue('vk-alice-7c2e5b');
    await expect(drawer.getByRole('button', { name: 'Keep existing' })).toBeVisible();
    // Unchecked by default only in a secure context (HTTPS or localhost). Anywhere else the UI
    // cannot hash the key, so it forces Store raw key on, which is not what the guide describes.
    await expect(drawer.getByRole('checkbox', { name: /^Store raw key/ })).not.toBeChecked();
    await blurAll(page, DRAWER_PARK);
    await expect(page).toHaveScreenshot('ui-llm-key-rotate.png');
  });

  // launch.md, "Edit a resource as YAML", step 2: one key's YAML in raw mode.
  test('raw mode', async ({ page }) => {
    const drawer = await editKey(page, 'bob-key');
    await openRaw(drawer);
    // Monaco renders spaces as non-breaking spaces, which \s matches.
    await expect(drawer.locator('.view-lines')).toHaveText(/^key:\s+sk-custom-bob-0001[\s\S]*group:\s+sales$/);
    await blurAll(page, DRAWER_PARK);
    await expect(page).toHaveScreenshot('ui-llm-key-raw.png');
  });

  // launch.md, "Edit a resource as YAML", step 3: the banner after the key field is deleted.
  test('raw mode invalid', async ({ page }) => {
    const drawer = await editKey(page, 'bob-key');
    await openRaw(drawer);
    // Clear the first line (`key: ...`) and join the empty line away. Home and Shift+End rather
    // than select-all, for the Ctrl/Cmd reason in fillCel() in ui-tabs-b.spec.ts.
    await drawer.locator('.view-line').first().click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    await expect(drawer.getByText('Invalid configuration')).toBeVisible();
    await expect(drawer.getByText('key: Required')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Save key' })).toBeDisabled();
    await blurAll(page, DRAWER_PARK);
    await expect(page).toHaveScreenshot('ui-llm-key-raw-invalid.png');
  });

  // launch.md, "Settings" tour: the UI sub-page, which /ui/settings opens.
  test('settings ui', async ({ page }) => {
    await openSettings(page, '/ui/settings', 'UI');
    await expect(page).toHaveURL(/\/ui\/settings\/ui$/);
    await blurAll(page, PAGE_PARK);
    await expect(page).toHaveScreenshot('ui-tour-settings-ui.png');
  });

  // launch.md, "Settings" tour: the Observability sub-page with the Tracing and Access logs cards.
  test('settings observability', async ({ page }) => {
    await openSettings(page, '/ui/settings/observability', 'Observability');
    await expect(page.getByText('Tracing', { exact: true })).toBeVisible();
    await expect(page.getByText('Access logs', { exact: true })).toBeVisible();
    await blurAll(page, PAGE_PARK);
    await expect(page).toHaveScreenshot('ui-tour-settings-observability.png');
  });

  // launch.md, "Generate LLM client settings": the Continue recipe.
  test('client setup continue', async ({ page }) => {
    await page.goto('/ui/llm/client-setup');
    await page.waitForLoadState('networkidle');
    await dismissWelcome(page);
    await page.getByRole('combobox', { name: 'Integration' }).click();
    await page.getByRole('option', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Continue', level: 3 })).toBeVisible();
    await expect(page.getByText('~/.continue/config.yaml')).toBeVisible();
    await blurAll(page, PAGE_PARK);
    await expect(page).toHaveScreenshot('ui-tour-client-setup-continue.png');
  });
});
