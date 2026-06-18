import { defineConfig, devices } from '@playwright/test';

/**
 * Proof-of-concept config for capturing screenshots of the agentgateway product UI.
 *
 * Two "projects" model the two ways the UI gets stood up. The specs themselves are
 * mode-agnostic — they only assume http://localhost:15000/ui/ is live. Each project
 * points at a different provisioner (globalSetup) that guarantees that.
 *
 * Goals served by ONE capture:
 *   - regression: toHaveScreenshot() diffs against the committed baseline
 *   - docs assets: `npm run sync-docs` copies captures into the docs img/ tree
 */
export default defineConfig({
  testDir: './tests',
  // Screenshots/baselines live next to the specs, committed to the repo.
  snapshotDir: './__screenshots__',
  fullyParallel: false, // a single shared UI instance — keep captures deterministic
  forbidOnly: !!process.env.CI,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:15000',
    // Pin everything that affects pixels, so baselines stay stable across runs.
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    deviceScaleFactor: 1,
  },

  expect: {
    toHaveScreenshot: {
      // Small tolerance absorbs sub-pixel antialiasing without hiding real changes.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  projects: [
    // Light/dark are separate projects so each gets its own baseline set. The UI honors
    // prefers-color-scheme (verified via scripts/probe-theme.mjs), so `colorScheme` is
    // all that's needed — no theme-toggle clicking. fixtures/seed-theme.ts additionally
    // clears the persisted `agentgateway-theme` localStorage key so a stray explicit
    // choice can't override the requested scheme.
    {
      name: 'standalone-light',
      testMatch: /.*\.spec\.ts/,
      // Provisions the binary + config and tears it down. See provisioners/standalone.ts.
      globalSetup: './provisioners/standalone.ts',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'standalone-dark',
      testMatch: /.*\.spec\.ts/,
      // Reuse the standalone provisioner; the binary is already up from the light project
      // when both run, but globalSetup is idempotent (waits for an already-healthy UI).
      globalSetup: './provisioners/standalone.ts',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
    {
      name: 'kubernetes-light',
      testMatch: /.*\.spec\.ts/,
      // STUB. See provisioners/kubernetes.ts — reuses scripts/TEST_FRAMEWORK.md machinery.
      globalSetup: './provisioners/kubernetes.ts',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'kubernetes-dark',
      testMatch: /.*\.spec\.ts/,
      globalSetup: './provisioners/kubernetes.ts',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
  ],
});
