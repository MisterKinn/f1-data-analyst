import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

import actions_runner
import post_session

UTC = timezone.utc
NOW = datetime(2026, 11, 7, 3, 0, tzinfo=UTC)


def window(wid, close_hours_ago):
    close = NOW - timedelta(hours=close_hours_ago)
    return {'id': wid, 'event': 'São Paulo Grand Prix', 'name': 'Practice 1', 'start': (close - timedelta(hours=3)).isoformat(),
            'open': (close - timedelta(hours=3, minutes=5)).isoformat(), 'close': close.isoformat()}


class PendingWindow(unittest.TestCase):
    def test_latest_closed_unpublished_window_first(self):
        windows = [window('2026-21-1', 10), window('2026-21-2', 2), window('2026-20-5', 80)]
        self.assertEqual(post_session.pending_window(windows, NOW, lambda w: False)['id'], '2026-21-2')
        self.assertEqual(post_session.pending_window(windows, NOW, lambda w: w == '2026-21-2')['id'], '2026-21-1')
        # 80 h ago: still filled in (a week of retries, e.g. every host was off after that race)
        self.assertEqual(post_session.pending_window(windows, NOW, lambda w: w != '2026-20-5')['id'], '2026-20-5')
        self.assertIsNone(post_session.pending_window([window('2026-19-5', 170)], NOW, lambda w: False))  # past a week

    def test_open_window_is_never_post_session(self):
        future = window('2026-21-3', -1)
        self.assertIsNone(post_session.pending_window([future], NOW, lambda w: False))


class RunnerPostSession(unittest.TestCase):
    def test_not_published_yet_is_logged_and_retried_later(self):
        with mock.patch.object(actions_runner.cloud, 'now', return_value=NOW), \
                mock.patch.object(actions_runner, 'history_done', return_value=False), \
                mock.patch.object(post_session, 'load', side_effect=ValueError('not published')), \
                mock.patch.object(actions_runner.cloud, 'run_log') as log, \
                mock.patch.object(actions_runner, 'history') as upload:
            self.assertEqual(actions_runner.post_session([window('2026-21-1', 1)]), 0)
        self.assertEqual(log.call_args_list[-1].args[0]['event'], 'history_not_ready')
        upload.assert_not_called()

    def test_uploads_archive_then_laps_then_done(self):
        calls = []
        def history(method, wid, query=None, body=None):
            calls.append((method, (query or {}).get('kind'), (query or {}).get('part'), (query or {}).get('driver')))
            return 200, {'ok': True}
        with mock.patch.object(actions_runner.cloud, 'now', return_value=NOW), \
                mock.patch.object(actions_runner, 'history_done', return_value=False), \
                mock.patch.object(post_session, 'load', return_value=(object(), {'Key': 11410, 'Path': '2026/x/y/'})), \
                mock.patch.object(post_session, 'build', return_value=({'lap_archive': {}}, [('Q1', '1', {'driver_number': '1'}), ('Q2', '1', {'driver_number': '1'})])), \
                mock.patch.object(actions_runner.cloud, 'run_log') as log, \
                mock.patch.object(actions_runner, 'history', side_effect=history):
            actions_runner.post_session([window('2026-21-1', 1)])
        self.assertEqual([c[1] for c in calls], ['archive', 'telemetry', 'telemetry', 'done'])
        self.assertEqual(calls[1][2:], ('Q1', '1'))
        end = log.call_args_list[-1].args[0]
        self.assertEqual((end['event'], end['telemetry_laps'], end['done']), ('history_end', 2, 200))


class HistoryJson(unittest.TestCase):
    def test_fastf1_session_info_is_sent_as_json(self):
        import json as _json
        import numpy as np
        import pandas as pd
        from datetime import datetime as _dt, timedelta as _td
        sent = {}

        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def read(self, *a):
                return b'{}'

        def urlopen(request, timeout=None):
            sent['body'] = request.data
            return Response()
        info = {'Key': np.int64(11404), 'StartDate': _dt(2026, 11, 1, 14, 0), 'EndDate': pd.Timestamp('2026-11-01T16:00:00'),
                'GmtOffset': _td(hours=-6), 'Path': '2026/x/'}
        with mock.patch.object(actions_runner.urllib.request, 'urlopen', urlopen), \
                mock.patch.object(actions_runner, 'auth_header', return_value='x'):
            status, _ = actions_runner.history('POST', '2026-19-5', {'kind': 'archive'}, {'session_info': info})
        self.assertEqual(status, 200)
        self.assertEqual(_json.loads(sent['body'])['session_info'],
                         {'Key': 11404, 'StartDate': '2026-11-01T14:00:00', 'EndDate': '2026-11-01T16:00:00',
                          'GmtOffset': '-06:00:00', 'Path': '2026/x/'})



if __name__ == '__main__':
    unittest.main()
