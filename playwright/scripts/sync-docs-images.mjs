#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pwRoot = resolve(__dirname, '..');
const repoRoot = resolve(pwRoot, '..');
const dryRun = process.argv.includes('--dry-run');

const map = JSON.parse(readFileSync(join(pwRoot, 'docs-image-map.json'), 'utf8')).images;
const snapDir = join(pwRoot, '__screenshots__');
const PROJECT_FOR = { light: 'standalone-light', dark: 'standalone-dark' };

function findBaseline(name, project) {
  if (!existsSync(snapDir)) return null;
  const stem = name.replace(/\.png$/, '');

  for (const entry of readdirSync(snapDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const specDir = join(snapDir, entry.name);
    for (const file of readdirSync(specDir)) {
      if (file.startsWith(`${stem}-`) && file.includes(project) && file.endsWith('.png')) {
        return join(specDir, file);
      }
    }
  }

  return null;
}

let copied = 0;
let missing = 0;

for (const [name, dests] of Object.entries(map)) {
  for (const [variant, project] of Object.entries(PROJECT_FOR)) {
    const dest = dests[variant];
    if (!dest) continue;

    const src = findBaseline(name, project);
    if (!src) {
      console.warn(`! missing ${variant} baseline for ${name} (${project})`);
      missing++;
      continue;
    }

    console.log(`${dryRun ? '[dry-run] ' : ''}${basename(src)} -> ${dest}`);
    if (!dryRun) copyFileSync(src, resolve(repoRoot, dest));
    copied++;
  }
}

console.log(`\n${dryRun ? 'would copy' : 'copied'} ${copied} image(s)${missing ? `, ${missing} missing` : ''}`);
