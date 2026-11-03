import json
import threading
import unittest
from datetime import datetime, timedelta, timezone
from session_results import ResultJobs, normalize, selection


def record(number, position, q1=90, q3=None):
    return {'DriverNumber': str(number), 'FullName': 'Driver ' + str(number),
            'Position': position, 'Q1': timedelta(seconds=q1),
            'Q3': timedelta(seconds=q3) if q3 else None, 'Points': float('nan')}


class ResultTests(unittest.TestCase):
    def test_qualifying_uses_classification_not_overall_best_lap(self):
        rows = normalize([record(1, 11, q1=89), record(2, 1, q1=91, q3=90)], 'Q')
        self.assertEqual([r['number'] for r in rows], ['2', '1'])
        self.assertEqual(rows[1]['q1'], 89)
        self.assertIsNone(rows[1]['q3'])
        json.dumps(rows, allow_nan=False)

    def test_unclassified_driver_is_preserved_without_fake_rank(self):
        rows = normalize([record(1, float('nan')), record(2, 1)], 'R')
        self.assertEqual(len(rows), 2)
        self.assertIsNone(rows[-1]['position'])

    def test_missing_and_duplicate_identity_or_all_missing_ranks_rejected(self):
        for records in ([], [record(1, 1), record(1, 2)], [record(1, None)]):
            with self.assertRaises(ValueError):
                normalize(records, 'Q')

    def test_selection_rejects_future_invalid_year_round_and_session(self):
        for args in ((2017, 1, 'R'), (datetime.now(timezone.utc).year + 1, 1, 'Q'),
                     (2025, 0, 'Q'), (2025, 31, 'R'), (2025, 1, '../poll'), (True, 1, 'R')):
            with self.assertRaises(ValueError):
                selection(*args)

    def test_jobs_deduplicate_and_pending_never_contains_old_results(self):
        entered, release, done = threading.Event(), threading.Event(), threading.Event()
        calls = []
        def loader(*args):
            calls.append(args)
            entered.set()
            release.wait(2)
            return {'state': 'ready', 'rows': [{'number': '1'}]}
        jobs = ResultJobs(loader)
        run = jobs._run
        def tracked_run(key):
            try:
                run(key)
            finally:
                done.set()
        jobs._run = tracked_run
        try:
            self.assertEqual(jobs.request(2025, 1, 'Q')['state'], 'pending')
            self.assertTrue(entered.wait(1))
            self.assertNotIn('rows', jobs.request(2025, 2, 'R'))
            self.assertEqual(len(calls), 1)
        finally:
            release.set()
            self.assertTrue(done.wait(2))
        self.assertEqual(jobs.request(2025, 1, 'Q')['state'], 'ready')
        self.assertEqual(len(calls), 1)

    def test_provider_error_does_not_leak_details(self):
        jobs = ResultJobs(lambda *_: (_ for _ in ()).throw(RuntimeError('secret-test-token')))
        jobs._run((2025, 1, 'Q'))
        data = jobs.request(2025, 1, 'Q')
        self.assertEqual(data['state'], 'unavailable')
        self.assertNotIn('secret-test-token', str(data))
