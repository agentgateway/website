#!/usr/bin/env node
// Run every standalone capture mode in sequence, for `npm run capture:all` and `update:all`.
//
// Each mode runs after `clean:ui`, so a leftover UI container never answers for the next mode.
// A failed mode does not stop the run: the remaining modes still capture, and the run exits 1
// at the end with a list of the modes that failed. (An `a && b && c` chain skipped every mode
// after the first failure, and in CI that also skipped the whole `main` pass.)
//
// Usage: node scripts/run-all.mjs [extra playwright args, such as --update-snapshots]
import { spawnSync } from 'node:child_process';

const MODES = [
  'test:standalone',
  'test:welcome',
  'test:mcp',
  'test:a2a',
  'test:llm',
  'test:virtual',
  'test:openapi',
  'test:jwt',
  'test:storage',
  'test:file',
  'test:costs',
  'test:logs',
  'test:tour',
  'test:traffic-add',
  'test:ui-tabs-a',
  'test:ui-tabs-b',
  'test:ui-tabs-c',
  'test:ui-tabs-d',
  'test:ui-tabs-e',
  'test:ui-tabs-e-listeners',
  'test:ui-tabs-e-binds',
  'test:ui-tabs-f',
  'test:ui-tabs-f-2',
];

const extra = process.argv.slice(2);
const npm = (args) => spawnSync('npm', args, { stdio: 'inherit' }).status ?? 1;

const failed = [];
const timings = [];
for (const mode of MODES) {
  npm(['run', 'clean:ui']);
  const start = Date.now();
  const status = npm(['run', mode, ...(extra.length ? ['--', ...extra] : [])]);
  const secs = Math.round((Date.now() - start) / 1000);
  timings.push(`${mode.padEnd(28)} ${String(secs).padStart(5)}s  ${status === 0 ? 'ok' : 'FAILED'}`);
  if (status !== 0) failed.push(mode);
}
npm(['run', 'clean:ui']);

console.log('\nCapture modes:\n' + timings.join('\n'));
if (failed.length) {
  console.error(`\n${failed.length} of ${MODES.length} modes failed: ${failed.join(', ')}`);
  process.exit(1);
}
