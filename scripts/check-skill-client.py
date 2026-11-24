#!/usr/bin/env python3
"""Bounded real-client discovery/reference/decision checks. Uses existing client authentication."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import tomllib

ROOT = Path(__file__).resolve().parents[1]
FIELDS = {
    'skill_name': {'type': 'string'}, 'skill_fingerprint': {'type': 'string'},
    'edition': {'type': 'string'}, 'mode': {'type': 'string'},
    'documentation_url': {'type': 'string'}, 'reference_path': {'type': 'string'},
    'reference_quote': {'type': 'string'}, 'setup_handoff': {'type': 'string'},
    'can_claim_running': {'type': 'boolean'}, 'can_claim_dollar_enforcement': {'type': 'boolean'},
    'existing_owner_action': {'type': 'string', 'enum': ['preserve', 'replace']},
    'mode_conflict_action': {'type': 'string', 'enum': ['clarify-or-select-matching-skill', 'silently-continue']},
    'runtime_version_evidence': {'type': 'array', 'items': {'type': 'string'}},
    'inconclusive_helper_means_verified': {'type': 'boolean'},
    'needed_inputs': {'type': 'array', 'items': {'type': 'string'}},
}
SCHEMA = {'type': 'object', 'properties': FIELDS, 'required': list(FIELDS), 'additionalProperties': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', choices=['claude', 'codex'], required=True)
    parser.add_argument('--skills-root', type=Path, default=ROOT / 'skills')
    parser.add_argument('--skill', action='append', help='Selected skills to exercise; all available by default')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--timeout', type=int, default=240)
    parser.add_argument('--node-bin', type=Path, help='Optional directory containing a supported Node.js/npm installation')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    available = sorted(p for p in args.skills_root.glob('agentgateway-*') if p.is_dir())
    selected = [p for p in available if not args.skill or p.name in args.skill]
    if not selected:
        parser.error('No selected packages')
    versions = subprocess.run([args.client, '--version'], text=True, capture_output=True, timeout=15)
    environment = dict(os.environ, DISABLE_TELEMETRY='1', DO_NOT_TRACK='1')
    if args.node_bin:
        environment['PATH'] = str(args.node_bin.resolve()) + os.pathsep + environment.get('PATH', '')
    previous = args.output / 'results.json'
    selected_names = {p.name for p in selected}
    results = ([r for r in json.loads(previous.read_text()).get('results', []) if r['skill'] not in selected_names]
               if previous.is_file() else [])
    with tempfile.TemporaryDirectory(prefix='skill-client-', dir=args.output) as temporary:
        project = Path(temporary).resolve()
        skill_root = project / ('.agents/skills' if args.client == 'codex' else '.claude/skills')
        # Install through the real distribution path, with all companions present
        # to expose accidental selection collisions and linked-reference problems.
        install = subprocess.run(['npm', 'exec', '--cache', str(ROOT / 'out/npm-cache'), '--yes', '--package=skills',
                                  '--', 'skills', 'add', str(args.skills_root.resolve()), '--skill',
                                  *[p.name for p in available], '--agent',
                                  'codex' if args.client == 'codex' else 'claude-code', '--yes'],
                                 cwd=project, env=environment, text=True, capture_output=True, timeout=120)
        (args.output / 'install.txt').write_text(install.stdout + install.stderr)
        if install.returncode:
            raise SystemExit('Client fixture installation failed; inspect install.txt')
        (project / 'existing-owner.txt').write_text('Existing owner: customer GitOps repository. Keep target customer-mcp and identity agent-existing. No changes authorized in this fixture.\n')
        schema = project / 'response-schema.json'
        schema.write_text(json.dumps(SCHEMA))
        for source in selected:
            case_dir = args.output / source.name
            case_dir.mkdir(exist_ok=True)
            symbol = '$' if args.client == 'codex' else '/'
            prompt = f'''{symbol}{source.name}
Read the installed skill, its package metadata, and the supporting verification helper reference. This is a read-only offline customer handoff exercise. Read only files inside this project. Do not call network services, use MCP servers, access other projects, write files, install software, or start/apply a gateway. Use the installed instructions as supplied material; do not invent executable product configuration without release-matched sources.

Customer request: Set up agentgateway on my selected reachable environment with my chosen OpenAI, Gemini through Vertex AI, or Bedrock models, five virtual API keys with $10 each per fixed 24 hours, and give me the UI link. Use the edition and deployment mode of the selected skill. I have not supplied region/model, credentials, license, or cluster/runtime access. Public documentation search is not configured. Prepare the next useful handoff within these constraints.

Inspect existing-owner.txt and explain how you would handle that ownership. Also explain what you would do if I changed the request to the opposite configuration mode while continuing to invoke this skill. Explain the runtime version evidence you need and whether an inconclusive verification-helper result establishes success.

Return the requested JSON fields. For reference_path, use a path relative to the installed skill folder for the verification helper reference you actually read. For reference_quote, quote one complete sentence from that file exactly, without Markdown wrappers. For skill_fingerprint, report source.content_sha256 from package.json. Report the package's identity and primary documentation URL. Include concrete remaining inputs and a useful setup_handoff; do not treat missing inputs as a reason to skip reading the installed package.
'''
            (case_dir / 'prompt.txt').write_text(prompt)
            output = case_dir / 'response.json'
            if args.client == 'codex':
                command = ['codex', 'exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral',
                           '--disable', 'hooks', '-c', 'web_search="disabled"', '-c', 'features.skill_mcp_dependency_install=false',
                           '--json', '--output-schema', str(schema), '--output-last-message', str(output.resolve())]
                config = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'config.toml'
                if config.is_file():
                    data = tomllib.loads(config.read_text())
                    for name in data.get('mcp_servers', {}):
                        if not all(c.isalnum() or c in '_-' for c in name):
                            raise ValueError('MCP name needs an explicit supported CLI key encoding')
                        command += ['-c', f'mcp_servers.{name}.enabled=false']
                command.append('-')
            else:
                command = ['claude', '-p', '--restricted', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
                           '--setting-sources', 'project', '--settings', '{"disableAllHooks":true}',
                           '--tools', 'Read,Glob,Grep,Skill', '--allowedTools', 'Read,Glob,Grep,Skill',
                           '--no-session-persistence', '--output-format', 'json', '--json-schema', json.dumps(SCHEMA)]
            before = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in project.rglob('*') if p.is_file()}
            started = time.monotonic()
            try:
                run = subprocess.run(command, input=prompt, text=True, capture_output=True, cwd=project, timeout=args.timeout)
                (case_dir / 'events.txt').write_text(run.stdout)
                (case_dir / 'stderr.txt').write_text(run.stderr)
                if args.client == 'claude':
                    envelope = json.loads(run.stdout)
                    response = envelope.get('structured_output')
                    if response is None:
                        response = json.loads(envelope.get('result', '{}'))
                    output.write_text(json.dumps(response, indent=2) + '\n')
                else:
                    response = json.loads(output.read_text())
                installed = skill_root / source.name
                metadata = json.loads((installed / 'package.json').read_text())
                reference = (installed / response['reference_path']).resolve()
                checks = {
                    'client_exit': run.returncode == 0,
                    'selected_skill': response['skill_name'] == source.name,
                    'fingerprint': response['skill_fingerprint'] == metadata['source']['content_sha256'],
                    'edition_mode': (response['edition'], response['mode']) == (metadata['edition'], metadata['mode']),
                    'public_docs': response['documentation_url'].rstrip('/') == metadata['documentation'].rstrip('/'),
                    'supporting_reference_read': reference.is_relative_to(installed.resolve()) and reference.is_file()
                        and reference.name == 'verification-helpers.md' and len(response['reference_quote']) > 30
                        and response['reference_quote'] in reference.read_text(),
                    'no_unrun_success_claim': not response['can_claim_running'] and not response['can_claim_dollar_enforcement'],
                    'preserved_owner': response['existing_owner_action'] == 'preserve',
                    'mode_conflict_handled': response['mode_conflict_action'] == 'clarify-or-select-matching-skill',
                    'inconclusive_preserved': response['inconclusive_helper_means_verified'] is False,
                    'useful_handoff': len(response['setup_handoff']) > 100 and len(response['needed_inputs']) >= 2,
                    'fixture_files_unchanged': all(Path(p).is_file() and hashlib.sha256(Path(p).read_bytes()).hexdigest() == digest for p, digest in before.items()),
                }
                results.append({'skill': source.name, 'status': 'passed' if all(checks.values()) else 'failed', 'checks': checks,
                                'package_content_sha256': metadata['source']['content_sha256'],
                                'seconds': round(time.monotonic() - started, 1)})
            except (subprocess.TimeoutExpired, OSError, ValueError, KeyError, TypeError) as error:
                results.append({'skill': source.name, 'status': 'failed', 'error': type(error).__name__,
                                'seconds': round(time.monotonic() - started, 1)})
            report = {'client': args.client, 'client_version': versions.stdout.strip(), 'results': results,
                      'limits': 'Real-client activation, installed-reference retrieval and constrained decision checks. No live provider/cluster enforcement or full configuration-generation certification.'}
            (args.output / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
            print(f"{args.client}: {source.name}: {results[-1]['status']}", flush=True)
    return 0 if all(r['status'] == 'passed' for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
