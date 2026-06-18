import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Proof-of-concept config for capturing screenshots of the agentgateway product UI.
 *
 * One agentgateway instance serves the UI; light vs. dark is a browser-side color
 * scheme, so a single launched binary feeds BOTH the `standalone-light` and
 * `standalone-dark` projects. The binary is launched via Playwright's `webServer`
 * (which also waits for health, reuses an already-running instance, and tears down).
 *
 * Goals served by ONE capture:
 *   - regression: toHaveScreenshot() diffs against the committed baseline
 *   - docs assets: `npm run sync-docs` copies captures into the docs img/ tree
 *
 * Binary resolution (first hit wins):
 *   1. $AGENTGATEWAY_BIN
 *   2. the locally built debug binary in the sibling agentgateway checkout (e.g. the
 *      one built from PR #2232)
 *   3. `agentgateway` on PATH
 *
 * Ports/URL are env-configurable so a run never collides with a separate instance:
 *   ADMIN_ADDR=localhost:15099 STATS_ADDR=localhost:15098 READINESS_ADDR=localhost:15097 \
 *     UI_BASE_URL=http://localhost:15099 npm run test:standalone
 *
 * Kubernetes mode: bring up the cluster + sample app + traffic resources and start a
 * `kubectl port-forward` to the UI yourself (see provisioners/kubernetes.ts), point
 * UI_BASE_URL at it, and Playwright's reuseExistingServer attaches to it.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILT_BIN = resolve(__dirname, '../../agentgateway/agentgateway/target/debug/agentgateway');
const BIN = process.env.AGENTGATEWAY_BIN || (existsSync(BUILT_BIN) ? BUILT_BIN : 'agentgateway');
const CONFIG = resolve(__dirname, 'fixtures/standalone-config.yaml');

const ADMIN_ADDR = process.env.ADMIN_ADDR || 'localhost:15000';
const BASE_URL = process.env.UI_BASE_URL || `http://${ADMIN_ADDR}`;

export default defineConfig({
  testDir: './tests',
  snapshotDir: './__screenshots__',
  fullyParallel: false, // a single shared UI instance — keep captures deterministic
  forbidOnly: !!process.env.CI,
  reporter: [['html', { open: 'never' }], ['list']],

  // Launch (or reuse) the agentgateway binary that serves the UI.
  webServer: {
    command: `"${BIN}" -f "${CONFIG}"`,
    url: `${BASE_URL}/ui/`,
    reuseExistingServer: true, // attach to an already-running UI (dev server, port-forward)
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ADMIN_ADDR,
      STATS_ADDR: process.env.STATS_ADDR || 'localhost:15020',
      READINESS_ADDR: process.env.READINESS_ADDR || 'localhost:15021',
    },
  },

  use: {
    baseURL: BASE_URL,
    // Pin everything that affects pixels, so baselines stay stable across runs.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  // Light/dark are separate projects so each gets its own baseline set. The UI honors
  // prefers-color-scheme (verified via scripts/probe-theme.mjs), so `colorScheme` is all
  // that's needed — no theme-toggle clicking. fixtures/test.ts additionally clears the
  // persisted `agentgateway-theme` localStorage key so a stray explicit choice can't
  // override the requested scheme.
  projects: [
    {
      name: 'standalone-light',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'standalone-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
  ],
});
