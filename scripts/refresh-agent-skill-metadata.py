#!/usr/bin/env python3
"""Refresh installed package identity from the website's canonical OSS skill files."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-commit', help='Full reviewed input commit; every instruction/helper must match it')
    parser.add_argument('--check', action='store_true', help='Fail on stale metadata without writing')
    args = parser.parse_args()
    if args.source_commit and not re.fullmatch('[0-9a-f]{40}', args.source_commit):
        parser.error('Use a full Git commit SHA')
    release = json.loads((ROOT / 'skills/catalog.json').read_text())
    pending = []
    for name in release['skills']:
        folder = ROOT / 'skills' / name
        path = folder / 'package.json'
        current = json.loads(path.read_text())
        metadata = json.loads(path.read_text())
        files = {p.relative_to(folder).as_posix(): digest(p.read_bytes()) for p in sorted(folder.rglob('*'))
                 if p.is_file() and p.name != 'package.json' and '__pycache__' not in p.parts}
        commit = args.source_commit or metadata['source'].get('commit')
        if commit:
            for relative, expected in files.items():
                proc = subprocess.run(['git', 'show', f'{commit}:skills/{name}/{relative}'],
                                      cwd=ROOT, capture_output=True, check=False)
                if proc.returncode or digest(proc.stdout) != expected:
                    raise SystemExit(f'Input commit does not match {name}/{relative}; commit reviewed inputs first')
        metadata.update(channel=release['channel'], files_sha256=files)
        metadata['source'].update(commit=commit, state='reviewed-input-commit' if commit else 'content-addressed',
                                  content_sha256=digest(json.dumps(files, sort_keys=True, separators=(',', ':')).encode()))
        if args.check and current != metadata:
            raise SystemExit(f'Stale metadata: {path.relative_to(ROOT)}')
        pending.append((path, metadata))
    if not args.check:
        for path, metadata in pending:
            path.write_text(json.dumps(metadata, indent=2) + '\n')
    print(f"{'Checked' if args.check else 'Refreshed'} {len(pending)} OSS package identities")


if __name__ == '__main__':
    main()
