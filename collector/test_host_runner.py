import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import actions_runner
import host_auth
import host_runner

UTC = timezone.utc


class HostAuth(unittest.TestCase):
    def test_header_signs_path_query_and_body(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        key = Ed25519PrivateKey.generate()
        value = host_auth.header('POST', 'https://x.app/api/live/actions-push?window=2026-21-1', b'{"a":1}', name='pc', private=key, now=1000)
        fields = dict(p.split('=', 1) for p in value.removeprefix('KongbodaHost ').split(','))
        self.assertEqual((fields['name'], fields['ts']), ('pc', '1000'))
        import base64
        sig = base64.urlsafe_b64decode(fields['sig'] + '==')
        key.public_key().verify(sig, host_auth.message('POST', '/api/live/actions-push?window=2026-21-1', '1000', b'{"a":1}'))

    def test_keygen_keeps_existing_key(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'k.pem'
            host_auth.keygen('pc', path)
            first = path.read_bytes()
            host_auth.keygen('pc', path)
            self.assertEqual(first, path.read_bytes())

    def test_runner_uses_host_signature_outside_actions(self):
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch('host_auth.header', return_value='KongbodaHost x') as signer:
            self.assertEqual(actions_runner.auth_header('GET', 'https://x/api'), 'KongbodaHost x')
            signer.assert_called_once()


class HostRunner(unittest.TestCase):
    def test_backup_stands_by_while_another_host_pushes(self):
        now = datetime(2026, 11, 6, 15, 40, tzinfo=UTC)
        self.assertTrue(host_runner.other_host_active((now - timedelta(seconds=30)).isoformat(), now))
        self.assertFalse(host_runner.other_host_active((now - timedelta(minutes=5)).isoformat(), now))
        self.assertFalse(host_runner.other_host_active(None, now))

    def test_post_session_retry_is_rate_limited(self):
        actions_runner.LAST_HISTORY_ATTEMPT['w'] = 100.0
        self.assertTrue(host_runner.recently_tried('w', now=200.0))
        self.assertFalse(host_runner.recently_tried('w', now=100.0 + host_runner.HISTORY_RETRY_SECONDS + 1))
        self.assertFalse(host_runner.recently_tried('other', now=200.0))

    def test_reports_missing_setup(self):
        with mock.patch.dict(os.environ, {'HOST_KEY_FILE': '/nonexistent/key.pem'}, clear=True):
            missing = host_runner.check_setup()
        self.assertIn('F1_USERNAME', missing)
        self.assertTrue(any(m.startswith('host key') for m in missing))


if __name__ == '__main__':
    unittest.main()
