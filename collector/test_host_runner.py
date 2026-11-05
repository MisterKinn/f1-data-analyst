import json
import os
os.environ.setdefault('KONGBODA_NO_PIP', '1')  # tests never pip-install
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import actions_runner
import cloud
import host_auth
import host_jobs
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


class SignedQuery(unittest.TestCase):
    def test_header_carries_the_signed_query(self):
        import base64
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        value = host_auth.header('GET', 'https://x.app/api/live/actions-push?window=2026-21-1', name='pc', private=Ed25519PrivateKey.generate())
        fields = dict(p.split('=', 1) for p in value.removeprefix('KongbodaHost ').split(','))
        self.assertEqual(base64.urlsafe_b64decode(fields['q'] + '=='), b'window=2026-21-1')


class EnvFile(unittest.TestCase):
    def test_fills_missing_settings_only(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'host.env'
            path.write_text('\ufeffF1_USERNAME=a@b.c\r\nF1_PASSWORD=x=y\r\nHOST_NAME=file-name\r\n', encoding='utf-8')
            with mock.patch.dict(os.environ, {'HOST_NAME': 'set'}, clear=True):
                self.assertTrue(host_runner.load_env_file(str(path)))
                self.assertEqual((os.environ['F1_USERNAME'], os.environ['F1_PASSWORD'], os.environ['HOST_NAME']), ('a@b.c', 'x=y', 'set'))
        self.assertFalse(host_runner.load_env_file('/nonexistent/host.env'))


class KeepAwake(unittest.TestCase):
    def test_sleep_block_wraps_recording(self):
        source = Path(host_runner.__file__).read_text(encoding='utf-8')
        self.assertIn('with keep_awake(), Baton(window, job) as baton:\n            result = job.record(window, baton.gate, baton.hold)', source)
        with mock.patch('cloud.run_log'):
            with host_runner.keep_awake() as guard:  # no-op off Windows
                self.assertIsInstance(guard.active, bool)


class HostRunner(unittest.TestCase):
    def test_post_session_retry_is_rate_limited(self):
        actions_runner.LAST_HISTORY_ATTEMPT['w'] = 100.0
        self.assertTrue(host_runner.recently_tried('w', now=200.0))
        self.assertFalse(host_runner.recently_tried('w', now=100.0 + host_runner.HISTORY_RETRY_SECONDS + 1))
        self.assertFalse(host_runner.recently_tried('other', now=200.0))

    def test_reports_missing_setup(self):
        with mock.patch.dict(os.environ, {'HOST_KEY_FILE': '/nonexistent/key.pem'}, clear=True):
            missing = host_runner.check_setup()
        self.assertIn('HOST_NAME', missing)
        self.assertNotIn('F1_USERNAME', missing)  # hosts may use the owner's shared F1 login
        self.assertTrue(any(m.startswith('host key') for m in missing))


class Rehearsal(unittest.TestCase):
    """Behaviour found in the end-to-end rehearsal: no busy loop after a session is done."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = Path(self.tmp.name)
        start = datetime(2026, 11, 6, 15, 30, tzinfo=UTC)
        self.window = {'id': '2026-20-1', 'event': 'São Paulo Grand Prix', 'name': 'Practice 1',
                       'start': start.isoformat(), 'open': (start - timedelta(minutes=5)).isoformat(),
                       'close': (start + timedelta(hours=3)).isoformat()}
        self.now = start + timedelta(minutes=70)
        actions_runner.LAST_RESULT.clear()
        actions_runner.HISTORY_DONE.clear()
        patches = [mock.patch('cloud.DATA', self.data), mock.patch('cloud.now', lambda: self.now),
                   mock.patch('cloud.read_json', lambda *a: {'windows': [self.window]}),
                   mock.patch('cloud.run_log'), mock.patch('cloud.fetch_schedule'),
                   mock.patch.object(actions_runner, 'host_call', return_value=(404, None))]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)

    def test_done_window_is_entered_once(self):
        calls = []

        def record(window, should_start=None, gate=None, hold=None):
            calls.append(window['id'])
            actions_runner.LAST_RESULT[window['id']] = 'finished'
        state = {}
        with mock.patch.object(actions_runner, 'record_window', record), \
                mock.patch.object(actions_runner, 'post_session') as post:
            for _ in range(5):
                host_runner.cycle(state, wait=True)
        self.assertEqual(calls, ['2026-20-1'])
        post.assert_not_called()  # window still open: no heavy FastF1 load yet
        self.assertFalse((self.data / 'active-window.json').exists())

    def test_login_failure_waits_before_retrying(self):
        calls = []

        def record(window, should_start=None, gate=None, hold=None):
            calls.append(1)
            actions_runner.LAST_RESULT[window['id']] = 'login_failed'
        state = {}
        with mock.patch.object(actions_runner, 'record_window', record), mock.patch.object(actions_runner, 'post_session'):
            host_runner.cycle(state, wait=True)
            host_runner.cycle(state, wait=True)
            self.assertEqual(len(calls), 1)
            state['jobs']['f1']['retry_at']['2026-20-1'] = 0
            host_runner.cycle(state, wait=True)
        self.assertEqual(len(calls), 2)

    def test_jobs_run_side_by_side_and_cycle_does_not_block(self):
        import threading
        release, seen = threading.Event(), []

        class SlowJob(host_jobs.Job):
            series, label = 'wec', 'WEC'

            def windows(self, state):
                return [dict(window_self.window, id='wec-1')]

            def record(self, window, gate, hold):
                seen.append(('wec', window['id']))
                release.wait(5)
                return 'finished'
        window_self = self

        def record(window, should_start=None, gate=None, hold=None):
            seen.append(('f1', window['id']))
            release.wait(5)
            actions_runner.LAST_RESULT[window['id']] = 'finished'
        state = {'assigned': ['f1', 'wec']}
        with mock.patch.dict(host_jobs.JOBS, {'wec': SlowJob()}), mock.patch.object(actions_runner, 'record_window', record):
            started = host_runner.cycle(state)
            time.sleep(0.2)
            self.assertEqual(sorted(seen), [('f1', '2026-20-1'), ('wec', 'wec-1')], 'both jobs record at once')
            self.assertTrue((self.data / 'active-window.json').exists(), 'code updates wait while recording')
            self.assertEqual(host_runner.cycle(state), [], 'no second thread for a running window')
            release.set()
            for t in started:
                t.join(5)
            host_runner.cycle(state)
        self.assertFalse((self.data / 'active-window.json').exists())
        self.assertEqual(state['jobs']['wec']['done'], {'wec-1'})

    def test_a_crashing_job_does_not_stop_the_host(self):
        def record(window, should_start=None, gate=None, hold=None):
            raise RuntimeError('boom')
        state = {}
        with mock.patch.object(actions_runner, 'record_window', record):
            host_runner.cycle(state, wait=True)
            host_runner.cycle(state, wait=True)
        self.assertIn('2026-20-1', state['jobs']['f1']['retry_at'])

    def test_update_request_after_start_restarts_when_idle(self):
        state = {}
        with mock.patch.object(actions_runner, 'host_call', return_value=(200, {'is_lead': True, 'update_at': '2000-01-01T00:00:00+00:00'})):
            host_runner.idle_beat(state)
        self.assertFalse(host_runner.update_requested(state), 'request older than this run')
        state['idle_beat_at'] = -10**9
        with mock.patch.object(actions_runner, 'host_call', return_value=(200, {'is_lead': True, 'update_at': '2999-01-01T00:00:00+00:00'})):
            host_runner.idle_beat(state)
        self.assertTrue(host_runner.update_requested(state))

    def test_owner_assigns_jobs(self):
        state = {}
        with mock.patch.object(actions_runner, 'host_call', return_value=(200, {'is_lead': True, 'jobs': ['f1', 'wec', 'x']})), \
                mock.patch.dict(host_jobs.JOBS, {'wec': host_jobs.Job()}):
            host_runner.idle_beat(state)
            self.assertEqual([j.series for j in host_runner.assigned_jobs(state)], ['f1', ''])
        self.assertEqual([j.series for j in host_runner.assigned_jobs({})], ['f1'], 'default: F1 only')

    def test_post_session_after_close(self):
        self.now = datetime.fromisoformat(self.window['close']) + timedelta(minutes=1)
        with mock.patch.object(actions_runner, 'record_window') as record, \
                mock.patch.object(actions_runner, 'post_session') as post:
            host_runner.cycle({}, wait=True)
        record.assert_not_called()
        post.assert_called_once()

    def test_history_done_is_cached(self):
        with mock.patch.object(actions_runner, 'history', return_value=(200, {'done': True})) as history:
            self.assertTrue(actions_runner.history_done('w1'))
            self.assertTrue(actions_runner.history_done('w1'))
        self.assertEqual(history.call_count, 1)
        with mock.patch.object(actions_runner, 'history', return_value=(200, {'done': False})):
            self.assertFalse(actions_runner.history_done('w2'))
        with mock.patch.object(actions_runner, 'history', return_value=(None, None)):
            self.assertTrue(actions_runner.history_done('w3'))  # site down: skip this round
        self.assertNotIn('w3', actions_runner.HISTORY_DONE)

    def test_idle_message_once(self):
        import io
        import contextlib
        out = io.StringIO()
        with contextlib.redirect_stdout(out), mock.patch('post_session.pending_window', return_value=None):
            actions_runner._IDLE[0] = False
            for _ in range(3):
                actions_runner.post_session([])
        self.assertEqual(out.getvalue().count('No F1 session window now.'), 1)

    def test_keep_awake_logs_changes_only(self):
        host_runner.keep_awake.last = None
        with mock.patch('cloud.run_log') as log:
            for _ in range(3):
                with host_runner.keep_awake():
                    pass
        self.assertEqual(log.call_count, 1)

    def test_site_url_from_host_env(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(actions_runner, 'SITE', 'https://old'):
            path = Path(tmp) / 'host.env'
            path.write_text('SITE_URL=https://example.test/\n', encoding='utf-8')
            with mock.patch.dict(os.environ, {'HOST_ENV_FILE': str(path), 'HOST_KEY_FILE': '/nonexistent'}, clear=True):
                self.assertEqual(host_runner.main(), 2)  # stops at setup check, after reading SITE_URL
                self.assertEqual(actions_runner.SITE, 'https://example.test')


class BatonClient(unittest.TestCase):
    window = {'id': '2026-20-1', 'event': 'São Paulo Grand Prix', 'name': 'Practice 1', 'start': '2026-11-06T15:30:00+00:00',
              'open': '2026-11-06T15:25:00+00:00', 'close': '2026-11-06T18:30:00+00:00'}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        for p in (mock.patch('cloud.DATA', Path(self.tmp.name)), mock.patch('cloud.run_log')):
            p.start()
            self.addCleanup(p.stop)

    def baton(self, status, data):
        baton = host_runner.Baton(self.window)
        with mock.patch.object(actions_runner, 'host_call', return_value=(status, data)) as call:
            baton.beat()
        return baton, call

    def test_gate_follows_the_site(self):
        self.assertTrue(self.baton(200, {'active': True, 'holder': 'me'})[0].gate())
        self.assertFalse(self.baton(200, {'active': False, 'holder': 'desktop'})[0].gate())
        self.assertFalse(self.baton(401, {'reason': 'unknown_host'})[0].gate())
        self.assertTrue(self.baton(404, None)[0].gate(), 'older site: publish as before')
        self.assertTrue(self.baton(None, None)[0].gate(), 'unknown yet: the site still gates pushes')
        _, call = self.baton(200, {'active': True})
        path, payload = call.call_args.args
        self.assertEqual((path, payload['window'], payload['recording']), ('/api/live/host-beat', '2026-20-1', True))
        self.assertIn('os', payload)
        self.assertNotIn('F1_PASSWORD', str(payload))

    def test_only_recording_hosts_connect_to_f1(self):
        self.assertTrue(self.baton(200, {'active': False, 'warm': False})[0].hold(), 'third in line: stay off F1')
        self.assertFalse(self.baton(200, {'active': False, 'warm': True})[0].hold(), 'spare: record along')
        self.assertFalse(self.baton(200, {'active': True, 'warm': True})[0].hold())
        self.assertFalse(self.baton(404, None)[0].hold())
        self.assertTrue(self.baton(401, {'reason': 'unknown_host'})[0].hold(), 'not registered: no F1 login')

    def test_ready_needs_fresh_connected_matching_snapshot(self):
        info = {'Name': 'Practice 1', 'Meeting': {'Name': 'São Paulo Grand Prix'}, 'StartDate': '2026-11-06T12:30:00', 'GmtOffset': '-03:00:00'}
        path = Path(self.tmp.name) / 'snapshot.json'
        self.assertFalse(host_runner.snapshot_ready(self.window))
        path.write_text(json.dumps({'connected': True, 'topics': {'SessionInfo': info}}), encoding='utf-8')
        self.assertFalse(host_runner.snapshot_ready(self.window), 'missed laps not refilled yet')
        done = {'lap_archive': {'recovery': {'state': 'complete'}}}
        path.write_text(json.dumps({'connected': True, 'topics': {'SessionInfo': info}, **done}), encoding='utf-8')
        self.assertTrue(host_runner.snapshot_ready(self.window))
        self.assertFalse(host_runner.snapshot_ready(self.window, now=time.time() + 120), 'stale')
        path.write_text(json.dumps({'connected': True, 'topics': {'SessionInfo': info}, 'lap_archive': {'recovery': {'state': 'partial_or_unavailable'}}}), encoding='utf-8')
        self.assertFalse(host_runner.snapshot_ready(self.window), 'refill failed: keep the current publisher')
        path.write_text(json.dumps({'connected': False, 'topics': {'SessionInfo': info}, **done}), encoding='utf-8')
        self.assertFalse(host_runner.snapshot_ready(self.window))
        info['Name'] = 'Practice 2'
        path.write_text(json.dumps({'connected': True, 'topics': {'SessionInfo': info}, **done}), encoding='utf-8')
        self.assertFalse(host_runner.snapshot_ready(self.window), 'other session')

    def test_standby_records_but_does_not_publish(self):
        start = datetime.now(UTC)
        window = dict(self.window, open=(start - timedelta(minutes=1)).isoformat(), close=(start + timedelta(seconds=3)).isoformat())
        pushes = []

        def record(w):
            (Path(self.tmp.name) / 'snapshot.json').write_text('{}', encoding='utf-8')
            time.sleep(1.5)
            return 0
        with mock.patch.object(actions_runner, 'PUSH_INTERVAL', 0.2), mock.patch('cloud.record', record), \
                mock.patch.object(actions_runner, 'site', return_value=(200, {'done': False})), \
                mock.patch.object(actions_runner, 'push', side_effect=lambda *a, **k: pushes.append(k) or 200):
            actions_runner.record_window(window, gate=lambda: False)
            self.assertEqual(pushes, [])
            actions_runner.record_window(window, gate=lambda: True)
        self.assertTrue(pushes and pushes[-1] == {'final': True, 'flush': True})

    def test_idle_beat_decides_post_session_lead(self):
        with mock.patch.object(actions_runner, 'host_call', return_value=(200, {'is_lead': False})):
            self.assertFalse(host_runner.idle_beat({}))
        with mock.patch.object(actions_runner, 'host_call', return_value=(404, None)):
            self.assertTrue(host_runner.idle_beat({}))
        state = {}
        with mock.patch.object(actions_runner, 'host_call', return_value=(200, {'is_lead': True})) as call:
            host_runner.idle_beat(state)
            host_runner.idle_beat(state)
        self.assertEqual(call.call_count, 1, 'idle heartbeat only every few minutes')

    def test_new_host_registers_itself(self):
        answers = [(401, {'reason': 'unknown_host'}), (202, {'status': 'pending', 'linked': False, 'link_url': 'https://site/account?host_link=ABCD-EFGH'})]
        with mock.patch.dict(os.environ, {'HOST_NAME': 'friend-mac'}), \
                mock.patch('host_auth.load_key'), mock.patch('host_auth.public_key', return_value='K' * 43), \
                mock.patch.object(actions_runner, 'host_call', side_effect=answers) as call:
            self.assertEqual(host_runner.register(), 'needs_link')
        self.assertEqual(host_runner.LAST_REGISTRATION['link_url'], 'https://site/account?host_link=ABCD-EFGH')
        self.assertEqual(call.call_args.args[0], '/api/live/host-register')
        linked = [(401, {'reason': 'unknown_host'}), (202, {'status': 'pending', 'linked': True})]
        with mock.patch.dict(os.environ, {'HOST_NAME': 'friend-mac'}), mock.patch('host_auth.load_key'), \
                mock.patch('host_auth.public_key', return_value='K' * 43), mock.patch.object(actions_runner, 'host_call', side_effect=linked):
            self.assertEqual(host_runner.register(), 'pending')
        self.assertEqual(call.call_args.args[1]['name'], 'friend-mac')
        with mock.patch.object(actions_runner, 'host_call', return_value=(200, {'enabled': True})):
            self.assertEqual(host_runner.register(), 'approved')
        with mock.patch.object(actions_runner, 'host_call', return_value=(404, None)):
            self.assertEqual(host_runner.register(), 'legacy_site')


class MacSupport(unittest.TestCase):
    def test_caffeinate_on_macos(self):
        process = mock.Mock()
        host_runner.keep_awake.last = None
        with mock.patch.object(host_runner.sys, 'platform', 'darwin'), mock.patch('cloud.run_log'), \
                mock.patch.object(host_runner.subprocess, 'Popen', return_value=process) as popen:
            with host_runner.keep_awake() as guard:
                self.assertTrue(guard.active)
        self.assertEqual(popen.call_args.args[0][:3], ['caffeinate', '-i', '-s'])
        process.terminate.assert_called_once()

    def test_settings_location_per_os(self):
        with mock.patch.object(host_runner.sys, 'platform', 'darwin'), mock.patch.dict(os.environ, {'HOME': '/Users/kim'}):
            self.assertEqual(host_runner.default_env_file(), '/Users/kim/Library/Application Support/Kongboda/host.env')
        with mock.patch.object(host_runner.sys, 'platform', 'linux'), mock.patch.dict(os.environ, {'HOME': '/home/kim'}, clear=True):
            self.assertEqual(host_runner.default_env_file(), '/home/kim/.config/kongboda/host.env')
        with mock.patch.object(host_runner.sys, 'platform', 'win32'), mock.patch.dict(os.environ, {'LOCALAPPDATA': 'C:\\Users\\j\\AppData\\Local'}):
            self.assertTrue(host_runner.default_env_file().endswith('Kongboda' + os.sep + 'host.env'))

    def test_os_label(self):
        with mock.patch.object(host_runner.sys, 'platform', 'darwin'), mock.patch.object(host_runner.platform, 'mac_ver', return_value=('15.1', '', '')):
            self.assertEqual(host_runner.os_label(), 'macOS 15.1')




class SharedLogin(unittest.TestCase):
    """Hosts without an F1 account use the owner's login token from the site."""

    def token(self, seconds):
        import base64
        claims = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time()) + seconds}).encode()).rstrip(b'=').decode()
        return 'eyJhbGciOiJub25lIn0.' + claims + '.sig'

    def setUp(self):
        from fastf1.internals.f1account import token_manager
        self.tm = token_manager
        self.tmp = tempfile.TemporaryDirectory()
        self.saved = (token_manager._token_path, token_manager._token)
        token_manager._token_path = Path(self.tmp.name) / 'tok.json'
        token_manager._token = None

    def tearDown(self):
        self.tm._token_path, self.tm._token = self.saved
        self.tmp.cleanup()

    def test_host_without_account_asks_and_stores_token(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(host_runner.token_fields({}), {'want_token': True})
            value = self.token(4 * 86400)
            host_runner.take_token({'f1_token': {'value': value, 'expires_at': 0}})
            self.assertEqual(self.tm.get_stored().value, value)
            self.assertEqual(host_runner.token_fields({}), {})  # plenty of time left: no request
            self.assertTrue(cloud.f1_login_ready())

    def test_expired_or_broken_tokens_are_ignored(self):
        self.assertFalse(host_runner.install_shared_token({'value': self.token(-10)}))
        self.assertFalse(host_runner.install_shared_token({'value': 'not-a-jwt'}))
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(cloud.f1_login_ready())

    def test_owner_shares_only_when_site_says_it_is_the_source(self):
        env = {'F1_USERNAME': 'owner@example.com', 'F1_PASSWORD': 'x'}
        with mock.patch.dict(os.environ, env, clear=True), \
                mock.patch.object(host_runner, 'owner_token', return_value='TOKEN'):
            self.assertEqual(host_runner.token_fields({}), {})
            self.assertEqual(host_runner.token_fields({'token_source': True}), {'f1_token': 'TOKEN'})

    def test_not_crew_is_told_to_use_its_own_account(self):
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(host_runner.runner, 'host_call', return_value=(200, {'shared_login': 'not_crew'})), \
                mock.patch.object(host_runner.cloud, 'run_log') as log:
            host_runner.TOKEN_NOTES.clear()
            self.assertEqual(host_runner.fetch_shared_token(), 'not_crew')
            self.assertEqual(host_runner.fetch_shared_token(), 'not_crew')
        self.assertEqual([c.args[0]['event'] for c in log.call_args_list], ['own_account_required'], 'noted once')
        self.assertFalse(cloud.f1_login_ready())

    def test_fetch_before_recording(self):
        calls = []
        def call(path, payload):
            calls.append(payload)
            return 200, {'f1_token': {'value': self.token(86400)}}
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(host_runner.runner, 'host_call', call), \
                mock.patch.object(host_runner.cloud, 'run_log'):
            host_runner.fetch_shared_token()
            host_runner.fetch_shared_token()  # now valid: no second request
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0]['want_token'])


if __name__ == '__main__':
    unittest.main()
