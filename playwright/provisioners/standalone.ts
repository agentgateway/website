import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Standalone-mode provisioner.
 *
 * Launches the agentgateway binary against a fixture config, waits for the admin UI
 * on :15000 to answer, and registers teardown. Playwright calls this once before the
 * `standalone` project runs.
 *
 * Binary resolution: $AGENTGATEWAY_BIN, else `agentgateway` on PATH. In CI you would
 * download a pinned release here instead of assuming it is installed.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_HEALTH_URL = 'http://localhost:15000/ui/';
const CONFIG = resolve(__dirname, '../fixtures/standalone-config.yaml');
const BIN = process.env.AGENTGATEWAY_BIN || 'agentgateway';

let proc: ChildProcess | undefined;

async function waitForUI(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(UI_HEALTH_URL);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`agentgateway UI did not come up at ${UI_HEALTH_URL} within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  // eslint-disable-next-line no-console
  console.log(`[standalone] launching ${BIN} with ${CONFIG}`);
  proc = spawn(BIN, ['-f', CONFIG], { stdio: 'inherit' });
  proc.on('exit', (code) => {
    if (code && code !== 0) console.error(`[standalone] agentgateway exited with code ${code}`);
  });

  await waitForUI();
  // eslint-disable-next-line no-console
  console.log('[standalone] UI is up on :15000');

  // Returned function runs as globalTeardown.
  return async () => {
    if (proc && !proc.killed) {
      // eslint-disable-next-line no-console
      console.log('[standalone] stopping agentgateway');
      proc.kill('SIGTERM');
    }
  };
}
