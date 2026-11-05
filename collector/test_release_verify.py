import io
import json
import os
import sys
import tempfile
import types
import unittest
import zipfile
from pathlib import Path
from unittest import mock

import release_verify as rv


def repo_zip(path, files, prefix='f1-data-analyst-main/'):
    with zipfile.ZipFile(path, 'w') as archive:
        for name, data in files.items():
            archive.writestr(prefix + name, data)


class SignedRelease(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.files = {'collector/host_runner.py': b'print(1)\n', 'collector/host/run.ps1': b'a\r\nb\r\n',
                      'collector/__pycache__/x.pyc': b'junk', 'README.md': b'not hashed',
                      'collector/host/kit/설치방법.txt'.encode().decode(): b'kit text'}
        out = io.StringIO()
        with mock.patch('sys.stdout', out):
            rv.keygen(self.dir / 'key.pem')
        self.public = out.getvalue().strip()
        (self.dir / 'keys.txt').write_text('# owner\n' + self.public + '\n', encoding='utf-8')

    def extract(self, zip_path):
        target = self.dir / 'x'
        with zipfile.ZipFile(zip_path) as archive:
            archive.extractall(target)
        return target / 'f1-data-analyst-main' / 'collector'

    def test_signed_code_installs_and_changed_code_does_not(self):
        repo_zip(self.dir / 'git.zip', self.files, prefix='')          # what the owner signs (git archive)
        repo_zip(self.dir / 'codeload.zip', self.files)                 # what hosts download
        with mock.patch('sys.stdout', io.StringIO()):
            rv.sign(self.dir / 'git.zip', self.dir / 'key.pem', self.dir / 'manifest.json', version='v1')
        new = self.extract(self.dir / 'codeload.zip')
        self.assertEqual(rv.check(new, self.dir / 'manifest.json', self.dir / 'keys.txt'), 0)
        (new / 'host_runner.py').write_bytes(b'print("evil")\n')
        with mock.patch('sys.stdout', io.StringIO()):
            self.assertEqual(rv.check(new, self.dir / 'manifest.json', self.dir / 'keys.txt'), 1)

    def test_other_keys_and_missing_signatures_are_refused(self):
        repo_zip(self.dir / 'codeload.zip', self.files)
        new = self.extract(self.dir / 'codeload.zip')
        with mock.patch('sys.stdout', io.StringIO()):
            self.assertEqual(rv.check(new, self.dir / 'missing.json', self.dir / 'keys.txt'), 1)
            rv.keygen(self.dir / 'other.pem')
            rv.sign(self.dir / 'codeload.zip', self.dir / 'other.pem', self.dir / 'm.json', version='v1')
            self.assertEqual(rv.check(new, self.dir / 'm.json', self.dir / 'keys.txt'), 1, 'signed by someone else')
            manifest = json.loads((self.dir / 'm.json').read_text())
            manifest['version'] = 'v2'
            (self.dir / 'm.json').write_text(json.dumps(manifest))
            self.assertEqual(rv.check(new, self.dir / 'm.json', self.dir / 'keys.txt'), 1)

    def test_first_release_is_accepted_without_installed_keys(self):
        with mock.patch('sys.stdout', io.StringIO()):
            self.assertEqual(rv.check(self.dir, self.dir / 'none.json', self.dir / 'no-keys.txt'), 0)

    def test_zip_and_folder_hash_match_and_skip_caches(self):
        repo_zip(self.dir / 'codeload.zip', self.files)
        new = self.extract(self.dir / 'codeload.zip')
        self.assertEqual(rv.tree_hash_zip(self.dir / 'codeload.zip'), rv.tree_hash_dir(new))


class PasswordStore(unittest.TestCase):
    def fake_keyring(self):
        saved = {}
        fail = types.ModuleType('keyring.backends.fail')
        fail.Keyring = type('FailKeyring', (), {})
        backends = types.ModuleType('keyring.backends')
        backends.fail = fail
        module = types.ModuleType('keyring')
        module.backends = backends
        module.get_keyring = lambda: type('WinVaultKeyring', (), {'priority': 5})()
        module.set_password = lambda s, u, p: saved.__setitem__((s, u), p)
        module.get_password = lambda s, u: saved.get((s, u))
        module.delete_password = lambda s, u: saved.pop((s, u))
        return {'keyring': module, 'keyring.backends': backends, 'keyring.backends.fail': fail}, saved

    def test_password_moves_from_host_env_to_the_store(self):
        import host_runner
        modules, saved = self.fake_keyring()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(sys.modules, modules), \
                mock.patch.dict(os.environ, {}, clear=True), mock.patch('sys.stdout', io.StringIO()):
            env = Path(tmp) / 'host.env'
            env.write_text('F1_USERNAME=a@b.c\nF1_PASSWORD=x=y z\nHOST_NAME=pc\n', encoding='utf-8')
            host_runner.load_env_file(str(env))
            self.assertEqual(saved[('kongboda-collector', 'a@b.c')], 'x=y z')
            self.assertNotIn('F1_PASSWORD', env.read_text(encoding='utf-8'))
            self.assertIn('HOST_NAME=pc', env.read_text(encoding='utf-8'))
            os.environ.clear()
            host_runner.load_env_file(str(env))   # next start reads it back from the store
            self.assertEqual(os.environ['F1_PASSWORD'], 'x=y z')
            with mock.patch.object(host_runner, 'default_env_file', return_value=str(env)):
                host_runner.forget_credentials()
            self.assertEqual(saved, {})

    def test_without_a_store_the_file_is_left_alone(self):
        import host_runner
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(host_runner, '_keyring', return_value=None), \
                mock.patch.dict(os.environ, {}, clear=True):
            env = Path(tmp) / 'host.env'
            env.write_text('F1_USERNAME=a@b.c\nF1_PASSWORD=pw\n', encoding='utf-8')
            host_runner.load_env_file(str(env))
            self.assertIn('F1_PASSWORD=pw', env.read_text(encoding='utf-8'))
            self.assertEqual(os.environ['F1_PASSWORD'], 'pw')


if __name__ == '__main__':
    unittest.main()
