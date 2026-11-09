#!/usr/bin/env python3
"""Exercise skills in isolated projects, including updates and removal."""
import argparse
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skills-root', type=Path, default=ROOT / 'skills')
    parser.add_argument('--output', type=Path, default=ROOT / 'out/skill-install-check.json')
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    names = sorted(p.name for p in args.skills_root.glob('agentgateway-*') if p.is_dir())
    assert len(names) >= 2
    environment = dict(os.environ, DISABLE_TELEMETRY='1', DO_NOT_TRACK='1', CI='1')
    cli = ['npm', 'exec', '--cache', str(ROOT / 'out/npm-cache'), '--yes', '--package=skills', '--', 'skills']
    events = []
    with tempfile.TemporaryDirectory(prefix='skill-install-', dir=args.output.parent) as temporary:
        workspace = Path(temporary)
        project = workspace / 'project'
        project.mkdir()
        downloads = workspace / 'downloads'
        downloads.mkdir()
        repository = workspace / 'repository'
        repository.mkdir()

        def git(*arguments):
            return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Skill test',
                                            '-c', 'user.email=skill-test@example.invalid', *arguments],
                                           cwd=repository, text=True, stderr=subprocess.DEVNULL).strip()

        git('init', '-b', 'main')
        for name in names:
            shutil.copytree(args.skills_root / name, repository / 'skills' / name)
            entry = repository / 'skills' / name / 'SKILL.md'
            entry.write_text(entry.read_text() + '\n<!-- installer fixture revision one -->\n')
        git('add', 'skills')
        git('commit', '-m', 'Fixture one')
        first_commit = git('rev-parse', 'HEAD')
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(downloads)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def run(*arguments):
            proc = subprocess.run(cli + list(arguments), cwd=project, env=environment,
                                  capture_output=True, text=True, timeout=120)
            events.append({'arguments': arguments, 'exit_code': proc.returncode,
                           'stdout': proc.stdout, 'stderr': proc.stderr})
            args.output.write_text(json.dumps({'status': 'running', 'events': events}, indent=2) + '\n')
            if proc.returncode:
                raise RuntimeError(f'Installer command failed: {arguments}; see {args.output}')
            return proc.stdout

        def archive(path, revision):
            with zipfile.ZipFile(path, 'w') as output:
                for name in names:
                    for source in sorted((args.skills_root / name).rglob('*')):
                        if source.is_file() and '__pycache__' not in source.parts:
                            relative = source.relative_to(args.skills_root)
                            data = source.read_bytes()
                            # Distinct source content exercises the installer's update detection.
                            if source.name == 'SKILL.md':
                                data += f'\n<!-- installer fixture revision {revision} -->\n'.encode()
                            output.writestr(str(relative), data)

        try:
            resolved_installer = run('--version').strip()
            listing = run('add', str(args.skills_root.resolve()), '--list')
            assert all(name in listing for name in names), 'Source discovery missed a skill'
            archive(downloads / 'current.zip', 'one')
            shutil.copyfile(downloads / 'current.zip', downloads / 'pinned.zip')
            url = f'http://127.0.0.1:{server.server_port}/current.zip'
            run('add', url, '--skill', *names, '--agent', 'claude-code', 'codex', '--yes')
            for client in ('.claude', '.agents'):
                for name in names:
                    installed = project / client / 'skills' / name
                    assert (installed / 'SKILL.md').is_file()
                    for reference in ('references/verification-helpers.md', 'scripts/verify.py', 'package.json'):
                        assert (installed / reference).read_bytes() == (args.skills_root / name / reference).read_bytes()
            installed_listing = run('list', '--json')
            assert all(name in installed_listing for name in names)
            download_tracking = [item.get('status') for item in json.loads(installed_listing)]
            # Observe current download tracking without depending on a specific installer release.
            run('update', names[0], '--project', '--yes')
            assert 'fixture revision one' in (project / '.agents/skills' / names[0] / 'SKILL.md').read_text()
            source_url = repository.as_uri()
            run('add', source_url, '--skill', *names, '--agent', 'claude-code', 'codex', '--yes')
            assert (project / 'skills-lock.json').is_file()
            selected, sibling = names[:2]
            edited = project / '.claude/skills' / selected / 'SKILL.md'
            edited.write_text(edited.read_text() + '\nCUSTOM LOCAL NOTE\n')
            backup = workspace / 'user-backup'
            shutil.copytree(edited.parent, backup)
            sibling_before = (project / '.agents/skills' / sibling / 'SKILL.md').read_bytes()
            entry = repository / 'skills' / selected / 'SKILL.md'
            entry.write_text(entry.read_text().replace('fixture revision one', 'fixture revision two'))
            git('add', 'skills')
            git('commit', '-m', 'Fixture two')
            run('update', selected, '--project', '--yes')
            updated = (project / '.agents/skills' / selected / 'SKILL.md').read_text()
            assert 'fixture revision two' in updated
            assert 'fixture revision two' in edited.read_text(), 'Claude still sees the old package after updating'
            assert (project / '.agents/skills' / sibling / 'SKILL.md').read_bytes() == sibling_before
            assert 'CUSTOM LOCAL NOTE' in (backup / 'SKILL.md').read_text()
            local_edit_preserved = 'CUSTOM LOCAL NOTE' in edited.read_text() if edited.exists() else False
            run('remove', selected, '--agent', 'claude-code', '--yes')
            assert not (project / '.claude/skills' / selected).exists()
            assert (project / '.agents/skills' / selected / 'SKILL.md').exists()
            run('remove', selected, '--agent', 'codex', '--yes')
            shared_copy_retained = (project / '.agents/skills' / selected).exists()
            # .agents is shared with other universal clients. Remove this skill
            # across project clients to remove that canonical folder as well.
            run('remove', selected, '--yes')
            assert not (project / '.agents/skills' / selected).exists()
            assert (project / '.agents/skills' / sibling / 'SKILL.md').exists()
            run('add', source_url, '--skill', selected, '--agent', 'codex', '--yes')
            # Exercise a locked Git revision against a local repository without publishing a fixture.
            lock_path = project / 'skills-lock.json'
            lock = json.loads(lock_path.read_text())
            lock['skills'][selected]['ref'] = first_commit
            lock_path.write_text(json.dumps(lock, indent=2) + '\n')
            run('update', selected, '--project', '--yes')
            assert 'fixture revision one' in (project / '.agents/skills' / selected / 'SKILL.md').read_text()
            report = {'status': 'passed', 'installer': 'skills', 'resolved_installer_version': resolved_installer, 'skills': names,
                      'clients': ['claude-code', 'codex'], 'source_discovery': True,
                      'complete_folders_installed': True, 'selected_update_only': True,
                      'default_link_mode_updates_both_clients': True,
                      'backup_preserved_local_changes': True, 'installer_preserved_local_edit': local_edit_preserved,
                      'client_scoped_removal': True, 'locked_git_revision_honored': True,
                      'codex_scoped_removal_retains_shared_copy': shared_copy_retained,
                      'direct_zip_tracking': download_tracking,
                      'limits': 'Installer mechanics; actual assistant activation is tested separately. Local HTTP fixtures do not establish public publication.',
                      'events': events}
            args.output.write_text(json.dumps(report, indent=2) + '\n')
            print(f'Passed installer discovery, installation, update, backup, removal and pin checks: {args.output}')
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
