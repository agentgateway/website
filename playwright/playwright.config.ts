import { defineConfig, devices } from '@playwright/test';

const HOST_PORT = process.env.UI_HOST_PORT || '15100';
const IMAGE = process.env.AGW_IMAGE || 'howardjohn/agentgateway:sl8';
const BIN = process.env.AGENTGATEWAY_BIN;
const ADMIN_ADDR = process.env.ADMIN_ADDR || 'localhost:15000';

const BASE_URL =
  process.env.UI_BASE_URL || (BIN ? `http://${ADMIN_ADDR}` : `http://localhost:${HOST_PORT}`);

const command = BIN
  ? `"${BIN}" -f fixtures/standalone-config.yaml`
  : `sh -c "docker rm -f agw-ui-pw 2>/dev/null; mkdir -p .agw-runtime; exec docker run --rm --name agw-ui-pw --user $(id -u):$(id -g) -v \\"$(pwd)/.agw-runtime:/config\\" -p ${HOST_PORT}:15000 -p 4100:4000 -p 3100:3000 ${IMAGE}"`;

export default defineConfig({
  testDir: './tests',
  snapshotDir: './__screenshots__',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [['html', { open: 'never' }], ['list']],

  webServer: {
    command,
    url: `${BASE_URL}/ui/`,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: BIN
      ? {
          ADMIN_ADDR,
          STATS_ADDR: process.env.STATS_ADDR || 'localhost:15020',
          READINESS_ADDR: process.env.READINESS_ADDR || 'localhost:15021'
        }
      : {}
  },

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    }
  },

  projects: [
    { name: 'standalone-light', use: { ...devices['Desktop Chrome'] } },
    { name: 'standalone-dark', use: { ...devices['Desktop Chrome'] } }
  ]
});
