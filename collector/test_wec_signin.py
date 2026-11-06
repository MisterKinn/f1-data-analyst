import json
import os
import queue
import unittest
from unittest.mock import MagicMock

from wec_browser import DiscoveryError, FIAWECBrowser
from wec_runtime import PersonalWEC, child_env
from wec_signin import SignInManager, clean_command

STATE = {'cookies': [{'name': 'appSession', 'value': 'v', 'domain': 'plus.fiawec.com', 'path': '/'}], 'origins': []}


class FakeProcess:
    """Stands in for the browser child: answers each command line with the next scripted reply."""
    def __init__(self, replies):
        self.replies = queue.Queue()
        for r in replies:
            self.replies.put(json.dumps(r) + '\n')
        self.sent = []
        self.killed = False
        self.stdin = MagicMock(write=lambda line: self.sent.append(json.loads(line)))
        self.stdout = MagicMock(readline=lambda: self.replies.get(timeout=1))

    def poll(self):
        return 0 if self.killed else None

    def kill(self):
        self.killed = True

    def wait(self, timeout=None):
        return 0


class SignInTests(unittest.TestCase):
    def test_only_taps_short_text_and_named_keys_reach_the_browser(self):
        self.assertEqual(clean_command({'op': 'click', 'x': 10, 'y': 20})['op'], 'click')
        self.assertIsNone(clean_command({'op': 'click', 'x': 9999, 'y': 1}))
        self.assertIsNone(clean_command({'op': 'click', 'x': True, 'y': 1}))
        self.assertIsNone(clean_command({'op': 'type', 'text': 'a\nb'}))
        self.assertIsNone(clean_command({'op': 'type', 'text': 'x' * 300}))
        self.assertIsNone(clean_command({'op': 'key', 'key': 'Control+A'}))
        self.assertIsNone(clean_command({'op': 'eval', 'script': '1'}))
        self.assertEqual(clean_command({'op': 'key', 'key': 'Enter'}), {'op': 'key', 'key': 'Enter'})

    def test_session_flow_returns_frames_then_the_sign_in_and_closes(self):
        process = FakeProcess([{'state': 'signing_in', 'image': 'QQ=='},
                               {'state': 'signing_in', 'image': 'Qg=='},
                               {'state': 'signed_in', 'storage_state': STATE}])
        manager = SignInManager(limit=1, spawn=lambda: process)
        self.assertEqual(manager.request('../x', 'start')[1], 400)
        first, status = manager.request('acct-1', 'start')
        self.assertEqual((first['state'], status), ('signing_in', 200))
        self.assertEqual(manager.request('acct-1', 'input', {'op': 'eval'})[1], 400)
        self.assertEqual(manager.request('acct-1', 'input', {'op': 'type', 'text': 'me@example.invalid'})[0]['image'], 'Qg==')
        self.assertEqual(process.sent[-1], {'op': 'type', 'text': 'me@example.invalid'})
        # A second account waits while the only slot is busy.
        self.assertEqual(manager.request('acct-2', 'start')[1], 503)
        done, _ = manager.request('acct-1', 'frame')
        self.assertEqual(done['storage_state'], STATE)
        self.assertTrue(process.killed)
        self.assertEqual(manager.request('acct-1', 'frame')[0], {'state': 'closed'})

    def test_cancel_closes_the_browser(self):
        process = FakeProcess([{'state': 'signing_in', 'image': 'QQ=='}])
        manager = SignInManager(limit=1, spawn=lambda: process)
        manager.request('operator', 'start')
        self.assertEqual(manager.request('operator', 'cancel')[0]['state'], 'cancelled')
        self.assertTrue(process.killed)


class SavedSignInTests(unittest.TestCase):
    def test_restore_keeps_cookies_private_to_the_account(self):
        sessions = PersonalWEC(limit=1)
        try:
            self.assertEqual(sessions.request('a1', '/wec/restore', 'POST', {'storage_state': 'x'})[1], 400)
            self.assertEqual(sessions.request('a1', '/wec/restore', 'POST', {'storage_state': STATE})[1], 200)
            manager = sessions.sessions['a1']['manager']
            self.assertEqual(oct(os.stat(manager.state).st_mode & 0o777), '0o600')
            self.assertEqual(json.loads(manager.state.read_text()), STATE)
            self.assertEqual(sessions.request('b2', '/wec/restore', 'POST', {'storage_state': STATE})[1], 503)
        finally:
            sessions.close()

    def test_a_personal_job_never_sees_the_owner_account_or_owner_sign_in(self):
        os.environ.update(WEC_USERNAME='owner@example.invalid', WEC_PASSWORD='p', WEC_STORAGE_STATE='/owner.json')
        try:
            env = child_env(state='/tmp/me.json')
            self.assertNotIn('WEC_USERNAME', env)
            self.assertNotIn('WEC_PASSWORD', env)
            self.assertEqual(env['WEC_STORAGE_STATE'], '/tmp/me.json')
        finally:
            for k in ('WEC_USERNAME', 'WEC_PASSWORD', 'WEC_STORAGE_STATE'):
                os.environ.pop(k, None)

    def test_an_expired_saved_sign_in_asks_for_a_new_connection(self):
        browser = MagicMock()
        driver = FIAWECBrowser(browser, storage_state=STATE)
        browser.new_context.assert_called_once()
        self.assertEqual(browser.new_context.call_args.kwargs['storage_state'], STATE)
        page = driver.page
        page.url = 'https://plus.fiawec.com/en'
        page.locator.return_value.count.return_value = 1  # a login link is shown
        driver.check_gate = lambda strict=False: ''
        with self.assertRaises(DiscoveryError) as error:
            driver.authenticate()
        self.assertEqual(error.exception.code, 'sign_in_expired')


if __name__ == '__main__':
    unittest.main()
