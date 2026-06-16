#!/usr/bin/env node
/**
 * Copies captured Playwright screenshots into the docs' assets/img/ tree, using the
 * name -> path map in docs-image-map.json. This is the "docs assets" half of the goal:
 * the SAME PNGs that act as regression baselines become the published doc images.
 *
 * Source of truth: the committed baselines for the `standalone` Chromium project, i.e.
 *   __screenshots__/<spec>/<name>-standalone-<platform>.png
 *
 * Run after `npm run update` (which refreshes baselines from a fresh capture).
 *
 *   node scripts/sync-docs-images.mjs            # copy
 *   node scripts/sync-docs-images.mjs --dry-run  # show what would copy
 */
import { readFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pwRoot = resolve(__dirname, '..');
const repoRoot = resolve(pwRoot, '..');
const dryRun = process.argv.includes('--dry-run');

const map = JSON.parse(readFileSync(join(pwRoot, 'docs-image-map.json'), 'utf8')).images;
const snapDir = join(pwRoot, '__screenshots__');

/** Find a baseline whose filename starts with the screenshot name (minus .png). */
function findBaseline(name) {
  if (!existsSync(snapDir)) return null;
  const stem = name.replace(/\.png$/, '');
  // Playwright nests baselines under per-spec folders; walk one level.
  for (const entry of readdirSync(snapDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const specDir = join(snapDir, entry.name);
    const match = readdirSync(specDir).find(
      (f) => f.startsWith(`${stem}-`) && f.includes('standalone') && f.endsWith('.png'),
    );
    if (match) return join(specDir, match);
  }
  return null;
}

let copied = 0;
let missing = 0;
for (const [name, dest] of Object.entries(map)) {
  const src = findBaseline(name);
  const destAbs = resolve(repoRoot, dest);
  if (!src) {
    console.warn(`! no baseline found for ${name} (run \`npm run update\` first) — skipping`);
    missing++;
    continue;
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}${basename(src)} -> ${dest}`);
  if (!dryRun) copyFileSync(src, destAbs);
  copied++;
}

console.log(`\n${dryRun ? 'would copy' : 'copied'} ${copied} image(s)${missing ? `, ${missing} missing` : ''}`);
