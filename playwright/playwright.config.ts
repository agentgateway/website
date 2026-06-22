import { defineConfig, devices } from '@playwright/test';

/**
 * Proof-of-concept config for capturing screenshots of the agentgateway product UI.
 *
 * UI source: by default Playwright's `webServer` launches the prebuilt image that ships
 * the new UI (PR #2232) — howardjohn/agentgateway:sl8 — and waits for the UI to be
 * healthy. One instance serves every project; light vs. dark is seeded per-project in
 * fixtures/test.ts (the new UI ignores prefers-color-scheme), so the `standalone-light`
 * and `standalone-dark` projects share it.
 *
 * Goals served by ONE capture:
 *   - regression: toHaveScreenshot() diffs against the committed baseline
 *   - docs assets: `npm run sync-docs` copies captures into the docs img/ tree
 *
 * Env knobs:
 *   AGW_IMAGE        docker image to run (default howardjohn/agentgateway:sl8)
 *   UI_HOST_PORT     host port mapped to the container's 15000 (default 15100, so it
 *                    never collides with a local agentgateway on 15000)
 *   UI_BASE_URL      full base URL; defaults to http://localhost:${UI_HOST_PORT}
 *   AGENTGATEWAY_BIN if set, launch this local binary instead of docker (e.g. a build
 *                    from a different branch). Serves on ADMIN_ADDR (default :15000).
 *   CAPTURE_MODE     which environment webServer brings up:
 *                      ''      (default) — empty-config UI (smoke / landing / cel captures)
 *                      mcp     — server-everything + MCP config (playground.spec.ts)
 *                      a2a     — A2A guide config as a Traffic route (a2a-traffic.spec.ts)
 *                      llm     — mock OpenAI provider + LLM config (llm-playground.spec.ts)
 *                      virtual — server-everything + mock-mcp-time, multiplexed (virtual.spec.ts)
 *                      openapi — Swagger Petstore + openapi target (openapi.spec.ts)
 *                      jwt     — server-everything + metrics tags (jwt.spec.ts)
 *                    The scripts under scripts/ are self-contained: they start any backing
 *                    servers, run the container, and clean up on exit.
 *   REUSE: webServer.reuseExistingServer attaches to anything already serving the URL,
 *          so you can run a `scripts/serve-*.sh` (or `docker run …`) yourself and point here.
 */

const HOST_PORT = process.env.UI_HOST_PORT || '15100';
const IMAGE = process.env.AGW_IMAGE || 'howardjohn/agentgateway:sl8';
const BIN = process.env.AGENTGATEWAY_BIN;
const ADMIN_ADDR = process.env.ADMIN_ADDR || 'localhost:15000';
const MODE = process.env.CAPTURE_MODE || '';

const BASE_URL =
  process.env.UI_BASE_URL || (BIN ? `http://${ADMIN_ADDR}` : `http://localhost:${HOST_PORT}`);

// Pick the launcher. A local binary, a mode-specific setup script (which starts its own
// backends + the container and cleans up on teardown), or the default empty-config image.
const SCRIPT_FOR = {
  mcp: 'serve-populated-ui.sh',
  a2a: 'serve-a2a-ui.sh',
  llm: 'serve-llm-ui.sh',
  virtual: 'serve-virtual-ui.sh',
  openapi: 'serve-openapi-ui.sh',
  jwt: 'serve-jwt-ui.sh',
};
const command = BIN
  ? `"${BIN}" -f fixtures/standalone-config.yaml`
  : MODE && SCRIPT_FOR[MODE]
    ? `bash ./scripts/${SCRIPT_FOR[MODE]}`
    : `sh -c "docker rm -f agw-ui-pw 2>/dev/null; mkdir -p .agw-runtime; ` +
      `exec docker run --rm --name agw-ui-pw --user $(id -u):$(id -g) ` +
      `-v \\"$(pwd)/.agw-runtime:/config\\" ` +
      `-p ${HOST_PORT}:15000 -p 4100:4000 -p 3100:3000 ${IMAGE}"`;

export default defineConfig({
  testDir: './tests',
  snapshotDir: './__screenshots__',
  fullyParallel: false,
  // One worker: all projects/specs share a single UI instance, and some captures mutate
  // its config (e.g. the playground's "Apply CORS" hot-reloads the gateway). Serializing
  // avoids concurrent config rewrites racing in-flight requests, and keeps captures stable.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['html', { open: 'never' }], ['list']],

  webServer: {
    command,
    url: `${BASE_URL}/ui/`,
    reuseExistingServer: true, // attach to an already-running UI (container, dev server, port-forward)
    timeout: 120_000, // the sl8 image is amd64 (emulated on arm64) and boots slowly
    stdout: 'pipe',
    stderr: 'pipe',
    env: BIN
      ? {
          ADMIN_ADDR,
          STATS_ADDR: process.env.STATS_ADDR || 'localhost:15020',
          READINESS_ADDR: process.env.READINESS_ADDR || 'localhost:15021',
        }
      : {},
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

  // Light/dark are separate projects so each gets its own baseline set. Theme is seeded
  // per-project in fixtures/test.ts via localStorage['theme'] (the new UI ignores
  // prefers-color-scheme, so colorScheme is not used).
  projects: [
    { name: 'standalone-light', use: { ...devices['Desktop Chrome'] } },
    { name: 'standalone-dark', use: { ...devices['Desktop Chrome'] } },
  ],
});
