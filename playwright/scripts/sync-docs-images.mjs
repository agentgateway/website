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
 * above Playwright's regression threshold). While identical, main keeps using the shared bare
 * image and no img/main/ file is created.
 *
 * No content edit is needed either way. `reuse-image` resolves assets/img/<version>/<file>
 * before the bare path (docs-theme-extras `utils/resolve-versioned-image.html`), so an
 * img/main/ override is picked up automatically wherever it exists and its removal falls back
 * to the shared image. Pages only ever reference the bare `img/<file>.png`.
 *
 * Scoping (CAPTURE_TARGET): baselines are named `<stem>-${TARGET}-${VERSION}-${variant}.png`
 * (playwright.config.ts snapshotPathTemplate + project names). This script walks the whole
 * image map, so it MUST match on the target too — otherwise a kube run republishes and prunes
 * every standalone image from stale baselines it never captured, and the standalone run does
 * the same to the kube images. That is how the two nightlies came to open byte-identical PRs
 * (#993 / #994, 2026-08-31). An image no baseline claims for this target is not this run's
 * business and is skipped silently.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const pwRoot = resolve(__dirname, '..');
const repoRoot = resolve(pwRoot, '..');
const dryRun = process.argv.includes('--dry-run');
const VERSION = process.env.DOC_VERSION || 'latest';
// Which capture target published these baselines: `standalone` (the default, every standalone
// spec) or `kube`. Must match the CAPTURE_TARGET the capture ran under, or this run will act on
// the other target's images. See the "Scoping" note above.
const TARGET = process.env.CAPTURE_TARGET || 'standalone';
const DIFF_RATIO = Number(process.env.SYNC_DIFF_RATIO || '0.01'); // matches playwright.config maxDiffPixelRatio

const map = JSON.parse(readFileSync(join(pwRoot, 'docs-image-map.json'), 'utf8')).images;
const snapDir = join(pwRoot, '__screenshots__');

// Every <spec>.spec.ts-snapshots directory under __screenshots__.
function specDirs() {
  if (!existsSync(snapDir)) return [];
  return readdirSync(snapDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(snapDir, e.name));
}

// Exact baseline path for this target/version/variant, or null. Matching the full filename
// rather than a substring keeps `ui-playground-tools` from ever resolving to a
// `ui-playground-tool-echo` baseline, and keeps a kube run off the standalone baselines.
function findBaseline(name, version, variant) {
  const stem = name.replace(/\.png$/, '');
  const wanted = `${stem}-${TARGET}-${version}-${variant}.png`;
  for (const specDir of specDirs()) {
    const candidate = join(specDir, wanted);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// True when this target captures the image at all (a baseline exists for SOME version). Images
// the other target owns are skipped without a warning; a missing baseline for an image this
// target DOES own is a real problem and still warns.
function ownedByTarget(name) {
  const prefix = `${name.replace(/\.png$/, '')}-${TARGET}-`;
  return specDirs().some((specDir) =>
    readdirSync(specDir).some((f) => f.startsWith(prefix) && f.endsWith('.png')),
  );
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
let skipped = 0;
const divergedImages = [];
const convergedImages = [];

for (const [name, dests] of Object.entries(map)) {
  // Not captured by this target — leave it to the run that owns it.
  if (!ownedByTarget(name)) {
    skipped++;
    continue;
  }
  for (const variant of ['light', 'dark']) {
    const dest = dests[variant];
    if (!dest) continue;

    const baseline = findBaseline(name, VERSION, variant);
    if (!baseline) {
      console.warn(`! missing ${variant} baseline for ${name} (${TARGET}-${VERSION}-${variant})`);
      missing++;
      continue;
    }

    if (VERSION === 'main') {
      // Publish to assets/img/main/<name> only when main visually differs from latest.
      const latestBaseline = findBaseline(name, 'latest', variant);
      if (!diverged(baseline, latestBaseline)) {
        shared++;
        // main has converged back to latest. If a previous run published a divergent
        // img/main/<name>.png, remove it so create-pull-request commits the removal —
        // otherwise reuse-image keeps resolving the stale override on main pages.
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

console.log(`\n${dryRun ? 'would copy' : 'copied'} ${copied} image(s) for ${TARGET}/${VERSION}` +
  (VERSION === 'main' ? `, ${shared} unchanged (shared with latest)` : '') +
  (missing ? `, ${missing} missing` : '') +
  (skipped ? `, ${skipped} not captured by ${TARGET}` : ''));

if (VERSION === 'main' && divergedImages.length) {
  console.log('\nmain diverged from latest for these images — reuse-image now resolves img/main/ for main pages automatically, no content edit needed:');
  for (const n of divergedImages) console.log(`  - ${n}`);
}

if (VERSION === 'main' && convergedImages.length) {
  console.log('\nmain converged back to latest for these images — removed the stale img/main/ copy; main pages fall back to the shared image automatically:');
  for (const n of convergedImages) console.log(`  - ${n}`);
}
