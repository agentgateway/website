#!/usr/bin/env node
/**
 * Resolve the agentgateway container image (and chart version) for a docs version line,
 * from the docs' single source of truth: assets/agw-docs/versions/n-patch.md.
 *
 * This keeps screenshot capture in lockstep with the version the docs actually install:
 * when n-patch bumps 1.3.x from 1.3.1 to 1.3.2, captures follow automatically.
 *
 *   node resolve-image.mjs latest            -> ghcr.io/agentgateway/agentgateway:v1.3.1
 *   node resolve-image.mjs main              -> ghcr.io/agentgateway/agentgateway:latest-dev
 *   node resolve-image.mjs latest patch      -> 1.3.1
 *   node resolve-image.mjs main chart-version-> v0.0.0-latest-dev   (matches helm.md)
 *
 * Mapping rule (no hugo.yaml parse needed): n-patch keys each version line to a patch.
 * The line whose patch is a dev string (e.g. 0.0.0-latest-dev) is `main`; `latest` is the
 * highest real-semver line. Released lines publish image tag vX.Y.Z; main uses the floating
 * nightly tag `latest-dev`. Registry override via AGW_REGISTRY.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY = process.env.AGW_REGISTRY || 'ghcr.io/agentgateway/agentgateway';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const nPatchPath = resolve(repoRoot, 'assets/agw-docs/versions/n-patch.md');

const isDev = (v) => /latest-dev|alpha|-dev\b/i.test(v);

export function versionMap() {
  const txt = readFileSync(nPatchPath, 'utf8');
  const map = {};
  const re = /include-if="([^"]+)"\s*>\}\}\s*([^{<]+?)\s*\{\{</g;
  let m;
  while ((m = re.exec(txt))) map[m[1]] = m[2].trim();
  return map;
}

export function resolvePatch(docVersion) {
  const map = versionMap();
  if (map[docVersion]) return map[docVersion]; // explicit line, e.g. "1.3.x"
  const entries = Object.entries(map);
  if (docVersion === 'main') {
    const dev = entries.find(([, v]) => isDev(v));
    if (dev) return dev[1];
  }
  if (docVersion === 'latest') {
    const real = entries
      .filter(([, v]) => /^\d+\.\d+\.\d+$/.test(v))
      .sort((a, b) => cmpSemver(a[1], b[1]));
    if (real.length) return real[real.length - 1][1];
  }
  return null;
}

export function resolveImage(docVersion) {
  const patch = resolvePatch(docVersion);
  if (!patch) throw new Error(`cannot resolve a version for "${docVersion}" from ${nPatchPath}`);
  const tag = isDev(patch) ? 'latest-dev' : `v${patch}`;
  return `${REGISTRY}:${tag}`;
}

function cmpSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const v = process.argv[2] || process.env.DOC_VERSION || 'latest';
  const what = process.argv[3] || 'image';
  if (what === 'patch') console.log(resolvePatch(v));
  else if (what === 'chart-version') console.log(`v${resolvePatch(v)}`);
  else console.log(resolveImage(v));
}
