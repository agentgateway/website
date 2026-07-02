#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * Publish Playwright baselines into the docs img tree (assets/img), per docs version.
 *
 *   DOC_VERSION=latest node sync-docs-images.mjs   # -> assets/img/<name>.png  (the shared, default image)
 *   DOC_VERSION=main   node sync-docs-images.mjs   # -> assets/img/main/<name>.png, ONLY when it differs from latest
 *
 * Versioning model ("shared until it diverges"): latest publishes to the bare path that all
 * versions reference by default. `main` is captured against the nightly image; we only publish a
 * separate assets/img/main/<name>.png when it visually differs from the latest image (pixel diff
 * above PLaywright's regression threshold). When it diverges, the script logs the image so an
 * author can add a {{< version include-if="1.4.x" >}} split pointing main at img/main/<name>.png.
 * While identical, main keeps using the shared bare image and no img/main/ file is created — so a
 * version split would never reference a missing file.
 *
 * Baselines are matched by the active version's project name (`${VERSION}-{light,dark}`), which
 * substring-matches both `standalone-${VERSION}-*` and `kube-${VERSION}-*` baselines.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const pwRoot = resolve(__dirname, '..');
const repoRoot = resolve(pwRoot, '..');
const dryRun = process.argv.includes('--dry-run');
const VERSION = process.env.DOC_VERSION || 'latest';
const DIFF_RATIO = Number(process.env.SYNC_DIFF_RATIO || '0.01'); // matches playwright.config maxDiffPixelRatio

const map = JSON.parse(readFileSync(join(pwRoot, 'docs-image-map.json'), 'utf8')).images;
const snapDir = join(pwRoot, '__screenshots__');

function findBaseline(name, projectSuffix) {
  if (!existsSync(snapDir)) return null;
  const stem = name.replace(/\.png$/, '');
  for (const entry of readdirSync(snapDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const specDir = join(snapDir, entry.name);
    for (const file of readdirSync(specDir)) {
      if (file.startsWith(`${stem}-`) && file.includes(projectSuffix) && file.endsWith('.png')) {
        return join(specDir, file);
      }
    }
  }
  return null;
}

// True if the two PNGs differ beyond DIFF_RATIO (or differ in size). Used to decide whether
// `main` needs its own image or can keep sharing the latest one.
function diverged(aPath, bPath) {
  if (!aPath || !bPath) return true;
  const a = PNG.sync.read(readFileSync(aPath));
  const b = PNG.sync.read(readFileSync(bPath));
  if (a.width !== b.width || a.height !== b.height) return true;
  const total = a.width * a.height;
  const mismatched = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
  return mismatched / total > DIFF_RATIO;
}

function mainDest(dest) {
  return join(dirname(dest), 'main', basename(dest));
}

let copied = 0;
let shared = 0;
let missing = 0;
const divergedImages = [];
const convergedImages = [];

for (const [name, dests] of Object.entries(map)) {
  for (const variant of ['light', 'dark']) {
    const dest = dests[variant];
    if (!dest) continue;

    const baseline = findBaseline(name, `${VERSION}-${variant}`);
    if (!baseline) {
      console.warn(`! missing ${variant} baseline for ${name} (${VERSION}-${variant})`);
      missing++;
      continue;
    }

    if (VERSION === 'main') {
      // Publish to assets/img/main/<name> only when main visually differs from latest.
      const latestBaseline = findBaseline(name, `latest-${variant}`);
      if (!diverged(baseline, latestBaseline)) {
        shared++;
        // main has converged back to latest. If a previous run published a divergent
        // img/main/<name>.png, remove it so create-pull-request commits the removal —
        // otherwise a {{< version >}} split would keep showing a stale main screenshot.
        const target = mainDest(dest);
        const absTarget = resolve(repoRoot, target);
        if (existsSync(absTarget)) {
          console.log(`${dryRun ? '[dry-run] ' : ''}CONVERGED rm ${target} (main now matches latest)`);
          if (!dryRun) rmSync(absTarget);
          if (variant === 'light') convergedImages.push(name);
        }
        continue; // identical -> keep sharing the bare latest image
      }
      const target = mainDest(dest);
      console.log(`${dryRun ? '[dry-run] ' : ''}DIVERGED ${basename(baseline)} -> ${target}`);
      if (!dryRun) {
        mkdirSync(resolve(repoRoot, dirname(target)), { recursive: true });
        copyFileSync(baseline, resolve(repoRoot, target));
      }
      if (variant === 'light') divergedImages.push(name);
      copied++;
    } else {
      // latest (and any released line): publish to the bare, shared path.
      console.log(`${dryRun ? '[dry-run] ' : ''}${basename(baseline)} -> ${dest}`);
      if (!dryRun) copyFileSync(baseline, resolve(repoRoot, dest));
      copied++;
    }
  }
}

console.log(`\n${dryRun ? 'would copy' : 'copied'} ${copied} image(s) for ${VERSION}` +
  (VERSION === 'main' ? `, ${shared} unchanged (shared with latest)` : '') +
  (missing ? `, ${missing} missing` : ''));

if (VERSION === 'main' && divergedImages.length) {
  console.log('\nmain diverged from latest for these images — add a version split so main pages use img/main/:');
  for (const n of divergedImages) console.log(`  - ${n}`);
}

if (VERSION === 'main' && convergedImages.length) {
  console.log('\nmain converged back to latest for these images — removed the stale img/main/ copy; drop any {{< version >}} split that pointed main at img/main/:');
  for (const n of convergedImages) console.log(`  - ${n}`);
}
