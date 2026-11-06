import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import wec_live_runner as r
from wec_runtime import PersonalWEC, child_env

CALENDAR = {'events': [
    {'id': 'f1-2026-11-06-interlagos', 'series': 'f1', 'sessions': [{'name': 'FP1', 'start': '2026-11-06T12:30:00-03:00'}]},
    {'id': 'wec-2026-11-06-monza', 'series': 'wec', 'nameEn': '6 Hours of Monza', 'sessions': [
        {'nameEn': 'FP1', 'start': '2026-11-06T10:30:00+01:00', 'end': '2026-11-06T12:00:00+01:00'},
        {'nameEn': 'LMGT3 Qualifying', 'start': '2026-11-07T14:20:00+01:00', 'end': '2026-11-07T14:32:00+01:00'},
        {'nameEn': 'LMGT3 Hyperpole', 'start': '2026-11-07T14:40:00+01:00', 'end': '2026-11-07T14:50:00+01:00'},
        {'nameEn': 'Hypercar Qualifying', 'start': '2026-11-07T15:00:00+01:00', 'end': '2026-11-07T15:12:00+01:00'},
        {'nameEn': 'Hypercar Hyperpole', 'start': '2026-11-07T15:20:00+01:00', 'end': '2026-11-07T15:30:00+01:00'},
        {'nameEn': 'Race', 'start': '2026-11-08T11:00:00+01:00', 'end': '2026-11-08T17:00:00+01:00'}]}]}


class Clock:
    def __init__(self, start): self.value = start
    def __call__(self): return self.value
    def sleep(self, seconds): self.value += timedelta(seconds=seconds)


class Reader:
    def __init__(self, tables): self.tables = list(tables)
    def read_rows(self): return self.tables.pop(0) if self.tables else []
    def waiting_for_start(self): return False


class RunnerTests(unittest.TestCase):
    def test_windows_are_wec_only_padded_and_merge_back_to_back_sessions(self):
        windows = r.windows_from_calendar(CALENDAR)
        self.assertEqual([w['session'] for w in windows], ['FP1', 'auto', 'Race'])
        fp1 = windows[0]
        self.assertEqual(fp1['id'], 'wec-2026-11-06-monza-11060930')
        self.assertEqual(fp1['open'], datetime(2026, 11, 6, 9, 20, tzinfo=timezone.utc))
        self.assertEqual(fp1['close'], datetime(2026, 11, 6, 11, 15, tzinfo=timezone.utc))
        self.assertEqual(windows[1]['names'], ['LMGT3 Qualifying', 'LMGT3 Hyperpole', 'Hypercar Qualifying', 'Hypercar Hyperpole'])
        self.assertEqual(r.event_fragment('6 Hours of Monza'), 'Monza')
        self.assertRegex(fp1['id'], r'^wec-[a-z0-9-]{3,80}-\d{8}$')  # matches the site's window check

    def test_next_window_uses_lookahead(self):
        windows = r.windows_from_calendar(CALENDAR)
        self.assertIsNone(r.next_window(windows, datetime(2026, 11, 6, 8, 30, tzinfo=timezone.utc)))
        self.assertEqual(r.next_window(windows, datetime(2026, 11, 6, 8, 45, tzinfo=timezone.utc))['session'], 'FP1')

    def test_watch_pushes_changing_table_and_stops_at_window_close(self):
        window = r.windows_from_calendar(CALENDAR)[0]
        clock = Clock(window['open'])
        first, second = [{'No.': '007', 'Lap': '3'}], [{'No.': '007', 'Lap': '4'}]
        reader = Reader([first, second] + [second] * 4000)
        pushes = []
        found = {'state': 'snapshot_unverified', 'records': first, 'target': {}, 'session': 'FP1'}
        with patch.object(r, 'discover', return_value=found), patch.object(r, 'PUSH_SECONDS', 0):
            outcome = r.watch(reader, window, window['close'] + timedelta(hours=1),
                              push=lambda *a, **k: pushes.append(a[2]), clock=clock, sleep=clock.sleep)
        self.assertEqual(outcome, 'closed')
        self.assertEqual(pushes[0]['state'], 'reading')
        self.assertTrue(any(p['rows_changed_at'] for p in pushes))
        self.assertEqual(pushes[-1]['records'], second)

    def test_login_problem_stops_without_retrying(self):
        window = r.windows_from_calendar(CALENDAR)[0]
        clock = Clock(window['open'])
        pushes = []
        with patch.object(r, 'run_browser', side_effect=r.DiscoveryError('authentication_action_required')) as run:
            outcome = r.record(window, push=lambda *a, **k: pushes.append(a[2]), clock=clock, sleep=clock.sleep)
        self.assertEqual(outcome, 'authentication_action_required')
        self.assertEqual(run.call_count, 1)
        self.assertEqual(pushes[-1]['state'], 'authentication_action_required')

    def test_wrong_password_stops_and_login_page_text_alone_does_not(self):
        from unittest.mock import MagicMock
        from wec_browser import FIAWECBrowser, DiscoveryError
        b = FIAWECBrowser.__new__(FIAWECBrowser)
        b.page = MagicMock(url='https://auth.staylive.io/u/login')
        b.page.locator.return_value.inner_text.return_value = 'Email address Continue'
        self.assertIn('Continue', b.page_text())
        b.page.locator.return_value.inner_text.return_value = 'Incorrect password'
        with self.assertRaises(DiscoveryError) as error:
            b.page_text()
        self.assertEqual(error.exception.code, 'authentication_failed')



class PersonalWECTests(unittest.TestCase):
    def test_personal_job_never_sees_owner_account(self):
        with patch.dict('os.environ', {'WEC_USERNAME': 'owner@example.test', 'WEC_PASSWORD': 'OWNER', 'FIAWEC_PASSWORD': 'OWNER2'}):
            env = child_env(('me@example.test', 'mine'))
            owner = child_env()
        self.assertEqual((env['WEC_USERNAME'], env['WEC_PASSWORD']), ('me@example.test', 'mine'))
        self.assertNotIn('FIAWEC_PASSWORD', env)
        self.assertEqual(owner['WEC_PASSWORD'], 'OWNER')

    def test_login_logout_and_isolation(self):
        sessions = PersonalWEC(limit=1, login=lambda creds: 'authenticated' if creds[1] == 'good' else 'authentication_failed')
        try:
            self.assertEqual(sessions.request('a1', '/wec/snapshot', 'GET')[0]['state'], 'credentials_required')
            self.assertEqual(sessions.request('a1', '/wec/login', 'POST', {'username': 'x@y.z', 'password': 'bad'})[1], 401)
            self.assertEqual(sessions.request('a1', '/wec/login', 'POST', {'username': 'x@y.z', 'password': 'good'})[1], 200)
            self.assertEqual(sessions.request('b2', '/wec/login', 'POST', {'username': 'q@y.z', 'password': 'good'})[1], 503)
            self.assertEqual(sessions.request('b2', '/wec/snapshot', 'GET')[0]['state'], 'credentials_required')
            self.assertEqual(sessions.request('a1', '/wec/snapshot', 'GET')[0]['state'], 'not_started')
            self.assertEqual(sessions.request('../x', '/wec/snapshot', 'GET')[1], 400)
            sessions.request('a1', '/wec/logout', 'POST')
            self.assertEqual(sessions.request('a1', '/wec/snapshot', 'GET')[0]['state'], 'credentials_required')
        finally:
            sessions.close()


if __name__ == '__main__':
    unittest.main()
