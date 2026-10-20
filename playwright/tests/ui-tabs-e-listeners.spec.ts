import { test, expect, dismissWelcome, uiTabsOnly } from '../fixtures/test';
import type { Locator, Page } from '@playwright/test';

/**
 * "UI" tab captures for configuration/listeners.md (batch e): the HTTP, HTTPS, hostname-based
 * HTTPS, TCP, and TLS listener sections. Runs under CAPTURE_MODE=fixture
 * FIXTURE=ui-tabs-e-listeners.yaml (docs 1.7 and later); the fixture has the web (443) and tls (8443)
 * gateways already switched to Multiple listeners.
 *
 * Every drawer is filled in but NEVER saved, so the certificate paths never need to exist and
 * the fixture is unchanged between runs. The values match each section's YAML example.
 *
 * Produces (light + dark per project): ui-listeners-http.png, ui-listeners-https.png,
 * ui-listeners-hostname.png, ui-listeners-tcp.png (also used by gateways.md, "Set the gateway
 * protocol", which adds the same tcp gateway), ui-listeners-tls.png.
 */

async function openGateways(page: Page) {
  await page.goto('/ui/traffic/gateways');
  await page.waitForLoadState('networkidle');
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: 'Traffic Gateways', exact: true })).toBeVisible();
}

async function openAddGateway(page: Page): Promise<Locator> {
  await openGateways(page);
  await page.getByRole('button', { name: 'Add gateway' }).first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Add gateway' })).toBeVisible();
  return drawer;
}

async function pickProtocol(page: Page, drawer: Locator, protocol: string) {
  await drawer.getByRole('combobox', { name: 'Protocol', exact: true }).click();
  await page.getByRole('option', { name: protocol, exact: true }).click();
  await expect(drawer.getByRole('combobox', { name: 'Protocol', exact: true })).toHaveText(protocol);
}

async function fillTls(drawer: Locator, cert: string, key: string) {
  // With the TLS protocol selected the Protocol combobox also reads "TLS"; the collapsible TLS
  // section toggle is the last match.
  await drawer.getByText('TLS', { exact: true }).last().click();
  await drawer.getByRole('textbox', { name: 'Certificate', exact: true }).fill(cert);
  const keyBox = drawer.getByRole('textbox', { name: 'Key', exact: true });
  await keyBox.fill(key);
  // Drop the focus ring so the published image shows a filled form, not a field mid-edit.
  await keyBox.blur();
}

async function fillNamePort(drawer: Locator, name: string, port: string) {
  await drawer.getByPlaceholder('public', { exact: true }).fill(name);
  const portBox = drawer.getByPlaceholder('443', { exact: true });
  await portBox.fill(port);
  await portBox.blur();
}

function gatewayCard(page: Page, name: string): Locator {
  return page.getByRole('heading', { name, exact: true }).locator('xpath=ancestor::*[.//table][1]');
}

test.describe('UI tabs: listeners', () => {
  uiTabsOnly();

  // configuration/listeners.md, "HTTP Listeners": the http gateway on port 3000, HTTP.
  test('http listener', async ({ page }) => {
    const drawer = await openAddGateway(page);
    await fillNamePort(drawer, 'http', '3000');
    await expect(drawer.getByRole('combobox', { name: 'Protocol', exact: true })).toHaveText('HTTP');
    await expect(page).toHaveScreenshot('ui-listeners-http.png');
  });

  // configuration/listeners.md, "HTTPS Listeners": the https gateway on port 443 with the
  // examples/tls/certs/ certificate and key.
  test('https listener', async ({ page }) => {
    const drawer = await openAddGateway(page);
    await fillNamePort(drawer, 'https', '443');
    await pickProtocol(page, drawer, 'HTTPS');
    await fillTls(drawer, 'examples/tls/certs/cert.pem', 'examples/tls/certs/key.pem');
    await expect(page).toHaveScreenshot('ui-listeners-https.png');
  });

  // configuration/listeners.md, "HTTPS Listeners" (multiple hostnames): listener1 of the web
  // gateway becomes the discrete HTTPS listener for a.example.com.
  test('hostname listener', async ({ page }) => {
    await openGateways(page);
    await gatewayCard(page, 'web').getByRole('button', { name: 'Edit listener' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { name: 'Edit listener' })).toBeVisible();
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('discrete');
    await pickProtocol(page, drawer, 'HTTPS');
    await drawer.getByRole('textbox', { name: 'Hostname', exact: true }).fill('a.example.com');
    await fillTls(drawer, 'examples/tls/certs/cert-a.pem', 'examples/tls/certs/key-a.pem');
    await expect(page).toHaveScreenshot('ui-listeners-hostname.png');
  });

  // configuration/listeners.md, "TCP Listeners": the tcp gateway on port 9000, TCP.
  // gateways.md, "Set the gateway protocol", reuses this image (same name, port, protocol).
  test('tcp listener', async ({ page }) => {
    const drawer = await openAddGateway(page);
    await fillNamePort(drawer, 'tcp', '9000');
    await pickProtocol(page, drawer, 'TCP');
    await expect(page).toHaveScreenshot('ui-listeners-tcp.png');
  });

  // configuration/listeners.md, "TLS Listeners": the termination listener that the Add
  // listener icon of the tls gateway adds. The passthrough listener is the same drawer with an
  // empty TLS section, so it gets no capture of its own.
  test('tls termination listener', async ({ page }) => {
    await openGateways(page);
    await gatewayCard(page, 'tls').getByRole('button', { name: 'Add listener' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('termination');
    await pickProtocol(page, drawer, 'TLS');
    await drawer.getByRole('textbox', { name: 'Hostname', exact: true }).fill('termination.example.com');
    await fillTls(drawer, 'examples/tls/certs/cert.pem', 'examples/tls/certs/key.pem');
    await expect(page).toHaveScreenshot('ui-listeners-tls.png');
  });
});
