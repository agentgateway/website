"""Regression checks for failures observed in the skill A/B evaluations."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(os.environ.get('AGW_SKILLS_ROOT', Path(__file__).resolve().parents[2] / 'skills'))
PACKAGE = ROOT / 'agentgateway-oss-standalone'
spec = importlib.util.spec_from_file_location('verify', PACKAGE / 'scripts/verify.py')
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class Versions(unittest.TestCase):
    def setUp(self):
        self.metadata = json.loads((PACKAGE / 'package.json').read_text())

    def test_observe_any_runtime_without_release_allowlist(self):
        for version, expected in [('v2.3.4', 'pass'), ('2.3.4', 'pass'), ('2.3.4-alpha.2', 'pass'),
                                  ('2.3.4+custom', 'pass'), ('latest', 'inconclusive'),
                                  ('9.8.7', 'pass'), ('8.1.2', 'pass')]:
            with self.subTest(version=version):
                self.assertEqual(verify.check_version(self.metadata, {'kind': 'native', 'version': version})['verdict'], expected)

    def test_task_selected_version_mismatch(self):
        evidence = {'kind': 'native', 'version': '2.3.4-alpha.2'}
        self.assertEqual(verify.check_version(self.metadata, evidence, expected_version='2.3.4')['verdict'], 'inconclusive')
        self.assertEqual(verify.check_version(self.metadata, evidence, expected_version='2.3.4-alpha.2')['verdict'], 'pass')

    def test_native_json_and_unrecognized_output(self):
        self.assertEqual(verify.version_text('{"version":"v9.8.7","git_revision":"abc"}'), '9.8.7')
        self.assertEqual(verify.version_text('agentgateway 2.3.4'), '2.3.4')
        self.assertIsNone(verify.version_text('Something failed: dependency 2.3.4'))
        self.assertIsNone(verify.image_version('registry:5000/image@sha256:abc'))

    def test_laptop_version_cannot_certify_controller(self):
        self.metadata['mode'] = 'kubernetes'
        self.assertEqual(verify.check_version(self.metadata, {'kind': 'native', 'version': '2.3.4'})['verdict'], 'fail')

    def test_empty_or_mutable_cluster_inventory_is_inconclusive(self):
        self.metadata['mode'] = 'kubernetes'
        for image in ('registry/image:latest', 'registry/image:v2.3.4', 'registry/image@sha256:abc'):
            evidence = {'kind': 'kubernetes', 'context': 'test', 'namespace': 'test',
                        'components': {'controller': [{'image': image, 'ready': True, 'image_id': 'sha256:abc'}],
                                       'proxy': []}, 'crds': []}
            answer = verify.check_version(self.metadata, evidence)
            self.assertEqual(answer['verdict'], 'inconclusive')
            self.assertIn('proxy inventory missing', answer['reasons'])
            self.assertIn('release-matched CRD baseline missing', answer['reasons'])

    def test_crd_drift_reported(self):
        self.metadata['mode'] = 'kubernetes'
        evidence = {'kind': 'kubernetes', 'crds': [{'name': 'models.example', 'spec_sha256': 'changed'}]}
        answer = verify.check_version(self.metadata, evidence, {'models.example': 'expected'})
        self.assertIn('CRD inventory differs from supplied release baseline', answer['reasons'])

    def test_collection_is_explicit_and_read_only(self):
        args = type('Args', (), {'context': 'test-context', 'namespace': 'test-namespace',
                                'proxy_namespace': 'separate-proxy-namespace',
                                'controller_selector': 'app=controller', 'proxy_selector': 'app=proxy', 'crd': ['models.example']})()
        pod = {'metadata': {'name': 'example'}, 'spec': {'containers': [{'name': 'proxy', 'image': 'registry/proxy:v2.3.4'}]},
               'status': {'containerStatuses': [{'name': 'proxy', 'imageID': 'sha256:abc', 'ready': True}]}}
        with patch.object(verify, 'command_json', side_effect=[{'items': [pod]}, {'items': [pod]},
                          {'spec': {'versions': [{'name': 'v1alpha1', 'served': True, 'storage': True}]}}]) as call:
            data = verify.observe_kubernetes(args)
            for entry in call.call_args_list:
                argv = entry.args[0]
                self.assertEqual(argv[:3], ['kubectl', '--context', 'test-context'])
                self.assertIn('get', argv)
                self.assertNotIn('secrets', argv)
            self.assertEqual(data['components']['proxy'][0]['declared_version'], '2.3.4')
            self.assertEqual(data['components']['proxy'][0]['namespace'], 'separate-proxy-namespace')
            self.assertEqual(call.call_args_list[0].args[0][4], 'test-namespace')
            self.assertEqual(call.call_args_list[1].args[0][4], 'separate-proxy-namespace')
            self.assertEqual(len(data['crds'][0]['spec_sha256']), 64)

    def test_all_package_manifests_and_shared_helpers(self):
        source = (PACKAGE / 'scripts/verify.py').read_bytes()
        for directory in ROOT.glob('agentgateway-*'):
            if not directory.is_dir():
                continue
            with self.subTest(package=directory.name):
                metadata = json.loads((directory / 'package.json').read_text())
                self.assertEqual(metadata['name'], directory.name)
                self.assertEqual(verify.integrity(directory, metadata), [])
                self.assertEqual((directory / 'scripts/verify.py').read_bytes(), source)

    def test_local_edits_are_detected(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / 'SKILL.md').write_text('original')
            metadata = {'files_sha256': {'SKILL.md': verify.hashlib.sha256(b'original').hexdigest()}}
            self.assertEqual(verify.integrity(root, metadata), [])
            (root / 'SKILL.md').write_text('custom')
            self.assertEqual(verify.integrity(root, metadata), ['SKILL.md'])


class MCP(unittest.TestCase):
    def setUp(self):
        self.response = {'http_status': 200, 'body': {'jsonrpc': '2.0', 'id': 1, 'result': {'content': []}}}

    def check(self, data, expectation='success', **kwargs):
        return verify.check_mcp(data, 1, expectation, **kwargs)['verdict']

    def test_success_and_tool_failure(self):
        self.assertEqual(self.check(self.response), 'pass')
        self.response['body']['result']['isError'] = True
        self.assertEqual(self.check(self.response), 'fail')

    def test_status_does_not_prove_denial(self):
        for status, expected in [(400, 'fail'), (401, 'inconclusive'), (403, 'inconclusive'), (500, 'fail')]:
            self.assertEqual(self.check({'http_status': status}, 'denial'), expected)

    def test_malformed_id_and_result(self):
        for identifier in ('1', True, None, 2):
            self.response['body']['id'] = identifier
            self.assertEqual(self.check(self.response), 'fail')
        self.response['body']['id'] = 1
        self.response['body']['result'] = {}
        self.assertEqual(self.check(self.response), 'fail')

    def test_rpc_error_and_denial_signature(self):
        data = {'http_status': 200, 'body': {'jsonrpc': '2.0', 'id': 1, 'error': {'code': -32003, 'message': 'Forbidden'}}}
        self.assertEqual(self.check(data, 'denial'), 'fail')
        self.assertEqual(self.check(data, 'denial', denial_code=-32003, denial_message='Forbidden'), 'inconclusive')
        data['body']['error'] = {'code': -32602, 'message': 'Invalid params'}
        self.assertEqual(self.check(data, 'denial', denial_code=-32602, denial_message='Invalid params'), 'fail')

    def test_success_is_not_denial(self):
        self.assertEqual(self.check(self.response, 'denial'), 'fail')

    def test_ambiguous_envelope_and_sse(self):
        self.response['body']['error'] = {'code': -32003, 'message': 'Forbidden'}
        self.assertEqual(self.check(self.response), 'fail')
        self.assertEqual(self.check({'http_status': 200, 'body': 'data: {}\n\n'}), 'fail')

    def test_malformed_content_is_not_success(self):
        for content in ('text', [1], [{}], [{'type': 'text'}]):
            self.response['body']['result']['content'] = content
            self.assertEqual(self.check(self.response), 'fail')


class Masking(unittest.TestCase):
    def setUp(self):
        self.data = {'sensitive_input': 'Email test@example.invalid.', 'sensitive_values': ['test@example.invalid'],
                     'replacement': '<EMAIL_ADDRESS>', 'observed_output': 'Email <EMAIL_ADDRESS>.',
                     'benign_input': 'Hello.', 'benign_output': 'Hello.'}

    def test_controlled_masking(self):
        self.assertEqual(verify.check_masking(self.data)['verdict'], 'pass')
        self.data.update(replacement='<masked>', observed_output='Email <masked>.')
        self.assertEqual(verify.check_masking(self.data)['verdict'], 'pass')

    def test_leak(self):
        self.data['observed_output'] = self.data['sensitive_input']
        answer = verify.check_masking(self.data)
        self.assertEqual(answer['verdict'], 'fail')
        self.assertNotIn('test@example.invalid', json.dumps(answer))

    def test_omission_and_wrong_marker(self):
        for value in ('No email.', '', 'Email <masked>.'):
            self.data['observed_output'] = value
            self.assertEqual(verify.check_masking(self.data)['verdict'], 'inconclusive')

    def test_missing_source_and_changed_benign(self):
        self.data['sensitive_input'] = 'No known email.'
        self.assertEqual(verify.check_masking(self.data)['verdict'], 'fail')
        self.setUp()
        self.data['benign_output'] = 'Modified.'
        self.assertEqual(verify.check_masking(self.data)['verdict'], 'fail')

    def test_cli_inconclusive_exit(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name) / 'response.json'
            path.write_text('{"http_status":403}')
            run = subprocess.run([sys.executable, str(PACKAGE / 'scripts/verify.py'), 'mcp', '--response', str(path),
                                  '--request-id', '1', '--expect', 'denial'], capture_output=True, text=True)
            self.assertEqual(run.returncode, 2)
            self.assertEqual(json.loads(run.stdout)['verdict'], 'inconclusive')


if __name__ == '__main__':
    unittest.main()
