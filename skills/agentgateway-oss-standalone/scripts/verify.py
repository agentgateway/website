#!/usr/bin/env python3
"""Read-only skill verification. Python 3.10+; no third-party dependencies."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


def read_json(path):
    return json.loads(Path(path).read_text())


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def result(verdict, observation, **details):
    return {'verdict': verdict, 'observation': observation, **details}


def version_text(text):
    try:
        value = json.loads(text)
        text = value.get('version', '') if isinstance(value, dict) else ''
    except json.JSONDecodeError:
        pass
    match = re.fullmatch(r'(?:agentgateway(?:-enterprise)?\s+)?v?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)', str(text).strip())
    return match.group(1) if match else None


def image_version(image):
    # Digests and floating tags cannot establish a release.
    if '@' in image or ':' not in image.rsplit('/', 1)[-1]:
        return None
    return version_text(image.rsplit(':', 1)[-1])


def command_json(argv):
    return json.loads(command_text(argv))


def command_text(argv):
    proc = subprocess.run(argv, text=True, capture_output=True, timeout=30, check=False)
    if proc.returncode:
        # Diagnostics can include endpoints or credentials; do not echo them.
        raise ValueError(f'{Path(argv[0]).name} failed (exit {proc.returncode}); inspect its diagnostics locally')
    return proc.stdout.strip()


def integrity(root, metadata):
    expected = metadata['files_sha256']
    actual = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in root.rglob('*') if p.is_file() and p.name != 'package.json'
              and '__pycache__' not in p.parts and p.suffix != '.pyc'
              and p.name != 'LICENSE'}
    return sorted(p for p in set(expected) | set(actual) if expected.get(p) != actual.get(p))


def observe_kubernetes(args):
    if not all((args.context, args.namespace, args.controller_selector, args.proxy_selector, args.crd)):
        raise ValueError('Kubernetes collection requires context, namespace, both selectors, and explicit CRD names')
    prefix = ['kubectl', '--context', args.context]
    inventory = {'kind': 'kubernetes', 'context': args.context, 'namespace': args.namespace,
                 'components': {}, 'crds': []}
    for role, selector in (('controller', args.controller_selector), ('proxy', args.proxy_selector)):
        namespace = (getattr(args, 'proxy_namespace', None) or args.namespace) if role == 'proxy' else args.namespace
        listing = command_json(prefix + ['-n', namespace, 'get', 'pods', '-l', selector, '-o', 'json'])
        inventory['components'][role] = []
        for pod in listing.get('items', []):
            statuses = {v['name']: v for v in pod.get('status', {}).get('containerStatuses', [])}
            for container in pod.get('spec', {}).get('containers', []):
                status = statuses.get(container['name'], {})
                inventory['components'][role].append({
                    'namespace': namespace, 'pod': pod['metadata']['name'], 'container': container['name'],
                    'image': container['image'], 'image_id': status.get('imageID'),
                    'ready': status.get('ready', False),
                    'declared_version': image_version(container['image'])})
    for name in args.crd:
        crd = command_json(prefix + ['get', 'crd', name, '-o', 'json'])
        inventory['crds'].append({'name': name, 'spec_sha256': canonical_hash(crd['spec']),
                                  'versions': [{'name': v['name'], 'served': v.get('served'),
                                                'storage': v.get('storage')} for v in crd['spec']['versions']]})
    return inventory


def check_version(metadata, evidence, expected_crds=None, expected_version=None):
    expected = version_text(expected_version) if expected_version else None
    if expected_version and not expected:
        return result('fail', 'expected version is not a recognizable runtime version')
    details = {'skill': metadata['name'], 'skill_content_sha256': metadata['source']['content_sha256'],
               'edition': metadata['edition'], 'mode': metadata['mode'],
               'expected_runtime_version': expected, 'observed': evidence,
               'limits': 'Release observations do not establish compatibility, entitlement, configuration delivery, or functional success.'}
    if metadata['mode'] == 'kubernetes':
        if evidence.get('kind') != 'kubernetes':
            return result('fail', 'controller mode requires deployed Kubernetes evidence, not a laptop CLI version', **details)
        reasons = []
        if not evidence.get('context') or not evidence.get('namespace'):
            reasons.append('cluster target missing')
        for role in ('controller', 'proxy'):
            components = evidence.get('components', {}).get(role, [])
            if not components:
                reasons.append(f'{role} inventory missing')
            for item in components:
                observed = image_version(item.get('image', ''))
                if not observed:
                    reasons.append(f'{role} release cannot be established from the image reference')
                elif expected and observed != expected:
                    reasons.append(f'{role} declared version differs from the task-selected expected version')
                if not item.get('image_id') or not item.get('ready'):
                    reasons.append(f'{role} runtime image/readiness evidence incomplete')
        crds = evidence.get('crds', [])
        if not crds or not expected_crds:
            reasons.append('release-matched CRD baseline missing')
        else:
            observed = {c['name']: c['spec_sha256'] for c in crds}
            if observed != expected_crds:
                reasons.append('CRD inventory differs from supplied release baseline')
        # Image tags are declared versions, even when image IDs and readiness exist.
        reasons.append('image tags require release/digest provenance verification; local CLI versions are insufficient')
        return result('inconclusive', 'Kubernetes inventory collected; compatibility review required', reasons=reasons, **details)
    if evidence.get('kind') not in ('native', 'container'):
        return result('fail', 'standalone requires the selected executable or container version', **details)
    observed = version_text(str(evidence.get('version', '')))
    if not observed:
        return result('inconclusive', 'version unrecognized', **details)
    if expected and observed != expected:
        return result('inconclusive', 'observed version differs from the task-selected expected version; investigate without automatic upgrade', **details)
    return result('pass', 'runtime version observed; select matching documentation and verify configuration and behavior separately', **details)


def check_mcp(envelope, expected_id, expectation, denial_code=None, denial_message=None):
    status = envelope.get('http_status')
    if type(status) is not int or status < 100 or status > 599:
        return result('fail', 'missing or invalid HTTP status')
    if status in (401, 403):
        return result('inconclusive' if expectation == 'denial' else 'fail',
                      'HTTP denial response; allowed control, gateway policy evidence, and upstream non-execution still required')
    if status < 200 or status >= 300:
        return result('fail', 'transport error is not proof of authorization denial')
    body = envelope.get('body')
    if not isinstance(body, dict) or body.get('jsonrpc') != '2.0':
        return result('fail', 'expected one parsed JSON-RPC 2.0 response; decode SSE before checking')
    if type(body.get('id')) is not type(expected_id) or body.get('id') != expected_id:
        return result('fail', 'response ID mismatch')
    if ('error' in body) == ('result' in body):
        return result('fail', 'expected exactly one result or error')
    if 'error' in body:
        error = body['error']
        if isinstance(error, dict) and error.get('code') in (-32700, -32600, -32601, -32602):
            return result('fail', 'JSON-RPC parse/method/argument errors are not authorization denial')
        if (expectation == 'denial' and denial_code is not None and denial_message
                and isinstance(error, dict) and type(error.get('code')) is int
                and error['code'] == denial_code and error.get('message') == denial_message):
            return result('inconclusive', 'matched supplied denial signature; policy attribution and upstream non-execution remain unverified')
        return result('fail', 'RPC error; no verified authorization-denial signature matched')
    payload = body['result']
    if not isinstance(payload, dict) or payload.get('isError', False) is not False:
        return result('fail', 'tool error or malformed result')
    content = payload.get('content')
    structured = payload.get('structuredContent')
    if 'content' in payload and (not isinstance(content, list) or any(
            not isinstance(block, dict) or not isinstance(block.get('type'), str)
            or (block['type'] == 'text' and not isinstance(block.get('text'), str)) for block in content)):
        return result('fail', 'malformed tool result content')
    if not isinstance(content, list) and not isinstance(structured, dict):
        return result('fail', 'missing tool-call result content')
    if expectation == 'denial':
        return result('fail', 'tool returned a success result for a denied-call expectation')
    return result('pass', 'successful tool-call response; no broader authorization claim')


def check_masking(data):
    required = ('sensitive_input', 'observed_output', 'replacement', 'benign_input', 'benign_output')
    if any(not isinstance(data.get(k), str) for k in required):
        return result('fail', 'missing controlled input/output or replacement evidence')
    values = data.get('sensitive_values')
    if not isinstance(values, list) or not values or any(not isinstance(v, str) or not v for v in values):
        return result('fail', 'nonempty synthetic sensitive values are required')
    if not data['replacement'] or data['replacement'] in data['sensitive_input']:
        return result('fail', 'replacement must be explicit and absent from the original input')
    if any(v not in data['sensitive_input'] for v in values):
        return result('fail', 'known original content does not contain every sensitive value')
    if any(v in data['observed_output'] for v in values):
        return result('fail', 'sensitive content remains in the observed output')
    if any(v in data['benign_input'] for v in values) or data['replacement'] in data['benign_input']:
        return result('fail', 'benign control contains a test value or replacement marker')
    if data['benign_input'] != data['benign_output']:
        return result('fail', 'benign control was modified')
    expected = data['sensitive_input']
    for value in sorted(set(values), key=len, reverse=True):
        expected = expected.replace(value, data['replacement'])
    if data['observed_output'] != expected:
        return result('inconclusive', 'output is not the controlled expected transformation; omission is not masking proof')
    return result('pass', 'controlled transformation and benign control match; other directions, detectors, and streaming are untested')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    version = commands.add_parser('version', help='Check installed package integrity and selected runtime version')
    version.add_argument('--package', type=Path, default=Path(__file__).resolve().parents[1] / 'package.json')
    source = version.add_mutually_exclusive_group(required=True)
    source.add_argument('--binary', help='Selected standalone executable; runs only --version')
    source.add_argument('--container', help='Existing Docker container; runs only the selected executable --version')
    source.add_argument('--evidence', type=Path, help='Saved standalone or Kubernetes version evidence')
    version.add_argument('--container-binary', default='agentgateway')
    version.add_argument('--expected-crds', type=Path, help='JSON name-to-spec-SHA256 map verified against the selected release')
    version.add_argument('--expected-version', help='Optional runtime version selected for this task; there is no built-in release allowlist')
    kube = commands.add_parser('collect-kubernetes', help='Collect explicit Pod image and CRD inventories with kubectl get')
    for option in ('context', 'namespace', 'controller-selector', 'proxy-selector'):
        kube.add_argument('--' + option, required=True)
    kube.add_argument('--crd', action='append', required=True)
    kube.add_argument('--proxy-namespace', help='Proxy namespace when different from the controller namespace')
    mcp = commands.add_parser('mcp', help='Classify a captured tools/call response without network access')
    mcp.add_argument('--response', type=Path, required=True)
    mcp.add_argument('--request-id', required=True, help='JSON ID, for example 1 or a quoted string')
    mcp.add_argument('--expect', choices=['success', 'denial'], required=True)
    mcp.add_argument('--denial-code', type=int)
    mcp.add_argument('--denial-message', help='Exact release-specific message; pair with denial-code')
    masking = commands.add_parser('masking', help='Check controlled synthetic masking evidence without network access')
    masking.add_argument('--evidence', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'collect-kubernetes':
            print(json.dumps(observe_kubernetes(args), indent=2))
            return 0
        if args.command == 'version':
            metadata = read_json(args.package)
            changes = integrity(args.package.parent, metadata)
            if changes:
                answer = result('fail', 'installed package differs from its manifest', changed_files=changes)
            else:
                if (args.binary or args.container) and metadata['mode'] == 'kubernetes':
                    raise ValueError('controller mode requires cluster evidence, not standalone --version')
                if args.binary:
                    evidence = {'kind': 'native', 'version': version_text(command_text([args.binary, '--version'])),
                                'scope': 'selected executable; association with a running process is not established'}
                elif args.container:
                    evidence = {'kind': 'container', 'version': version_text(command_text(
                        ['docker', 'exec', args.container, args.container_binary, '--version'])),
                        'scope': 'executable inside the named container; loaded config is not established'}
                else:
                    evidence = read_json(args.evidence)
                answer = check_version(metadata, evidence, read_json(args.expected_crds) if args.expected_crds else None, args.expected_version)
        elif args.command == 'mcp':
            expected_id = json.loads(args.request_id)
            if type(expected_id) not in (str, int):
                raise ValueError('request ID must be an integer or string')
            answer = check_mcp(read_json(args.response), expected_id, args.expect, args.denial_code, args.denial_message)
        else:
            answer = check_masking(read_json(args.evidence))
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired):
        answer = result('fail', 'invalid/incomplete evidence or collection failed; inspect inputs locally without exposing secrets')
    print(json.dumps(answer, indent=2))
    return {'pass': 0, 'fail': 1, 'inconclusive': 2}[answer['verdict']]


if __name__ == '__main__':
    sys.exit(main())
