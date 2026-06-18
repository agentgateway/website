#!/usr/bin/env node
/**
 * Copies captured Playwright screenshots into the docs' assets/img/ tree, using the
 * name -> {light, dark} map in docs-image-map.json. This is the "docs assets" half of
 * the goal: the SAME PNGs that act as regression baselines become the published doc
 * images. The light baseline (standalone-light project) feeds the `light` destination;
 * the dark baseline (standalone-dark project) feeds the `dark` destination.
 *
 * Baselines live under:
 *   __screenshots__/<spec>/<name>-<project>-<platform>.png
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

// Which project baseline feeds which destination key.
const PROJECT_FOR = { light: 'standalone-light', dark: 'standalone-dark' };

/** Find a baseline for screenshot `name` captured by `project`. */
function findBaseline(name, project) {
  if (!existsSync(snapDir)) return null;
  const stem = name.replace(/\.png$/, '');
  for (const entry of readdirSync(snapDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const specDir = join(snapDir, entry.name);
    const match = readdirSync(specDir).find(
      (f) => f.startsWith(`${stem}-`) && f.includes(project) && f.endsWith('.png'),
    );
    if (match) return join(specDir, match);
  }
  return null;
}

let copied = 0;
let missing = 0;
for (const [name, dests] of Object.entries(map)) {
  for (const [variant, project] of Object.entries(PROJECT_FOR)) {
    const dest = dests[variant];
    if (!dest) continue; // no dark variant for this shot, e.g.
    const src = findBaseline(name, project);
    if (!src) {
      console.warn(`! no ${variant} baseline for ${name} (project ${project}) — run \`npm run update\` first; skipping`);
      missing++;
      continue;
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}${basename(src)} -> ${dest}`);
    if (!dryRun) copyFileSync(src, resolve(repoRoot, dest));
    copied++;
  }
}

console.log(`\n${dryRun ? 'would copy' : 'copied'} ${copied} image(s)${missing ? `, ${missing} missing` : ''}`);
