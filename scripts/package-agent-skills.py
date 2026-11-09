#!/usr/bin/env python3
"""Build or check current OSS skill downloads without installing any skills."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build():
    release = json.loads((ROOT / 'skills/catalog.json').read_text())
    version = release['channel']
    if version != 'current':
        raise ValueError('Only the current distribution channel is generated')
    outputs, packages = {}, {}
    for name in release['skills']:
        if name not in ('agentgateway-oss-standalone', 'agentgateway-oss-kubernetes'):
            raise ValueError(f'Unexpected OSS download: {name}')
        directory = ROOT / 'skills' / name
        files = {}
        for source in sorted(directory.rglob('*')):
            if source.is_symlink():
                raise ValueError(f'Skill symlinks are not distributable: {source}')
            if not source.is_file():
                continue
            relative = source.relative_to(directory).as_posix()
            if source.suffix not in ('.md', '.yaml', '.py', '.json') or relative.startswith('.'):
                raise ValueError(f'Unexpected instruction-package file: {source}')
            data = source.read_bytes()
            files[f'{name}/{relative}'] = data
            if source.suffix == '.md':
                for target in re.findall(r'\]\(([^)]+)\)', data.decode()):
                    if re.match(r'\w+://|mailto:|#', target):
                        continue
                    resolved = (source.parent / target.split('#')[0]).resolve()
                    if not resolved.is_relative_to(directory.resolve()) or not resolved.is_file():
                        raise ValueError(f'Broken or external relative reference: {source}: {target}')
        entry = files[f'{name}/SKILL.md'].decode()
        if not re.search(rf'^name: {re.escape(name)}\s*$', entry, re.M):
            raise ValueError(f'Skill name does not match folder: {name}')
        metadata = json.loads(files[f'{name}/package.json'])
        actual = {p.removeprefix(f'{name}/'): digest(data) for p, data in files.items()
                  if p != f'{name}/package.json'}
        if metadata['name'] != name or metadata['channel'] != version or metadata['files_sha256'] != actual:
            raise ValueError(f'Stale package identity or source hashes: {name}')
        snapshot = digest(json.dumps(actual, sort_keys=True, separators=(',', ':')).encode())
        if metadata['source']['content_sha256'] != snapshot:
            raise ValueError(f'Stale source snapshot: {name}')
        files[f'{name}/LICENSE'] = (ROOT / 'LICENSE').read_bytes()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path, data in sorted(files.items()):
                info = zipfile.ZipInfo(path, date_time=(2020, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, data, compresslevel=9)
        filename = f'{name}.zip'
        outputs[filename] = buffer.getvalue()
        with zipfile.ZipFile(io.BytesIO(outputs[filename])) as archive:
            assert archive.testzip() is None
            assert {p: archive.read(p) for p in archive.namelist()} == files
        packages[filename] = {'sha256': digest(outputs[filename]),
                              'files': {p: digest(data) for p, data in sorted(files.items())}}
    outputs['SHA256SUMS'] = ''.join(f"{item['sha256']}  {name}\n" for name, item in sorted(packages.items())).encode()
    outputs['manifest.json'] = (json.dumps({**release, 'packages': packages}, indent=2) + '\n').encode()
    return version, outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if generated current downloads differ from source')
    args = parser.parse_args()
    version, outputs = build()
    destination = ROOT / 'static/downloads/agent-skills' / version
    for name, data in outputs.items():
        path = destination / name
        if args.check:
            if not path.is_file() or path.read_bytes() != data:
                raise SystemExit(f'Download missing or stale: {path.relative_to(ROOT)}')
    if not args.check:
        destination.mkdir(parents=True, exist_ok=True)
        for name, data in outputs.items():
            (destination / name).write_bytes(data)
    print(f"{'Checked' if args.check else 'Built'} {len(outputs) - 2} OSS skill archives for {version}")


if __name__ == '__main__':
    main()
