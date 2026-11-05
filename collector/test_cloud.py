import unittest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch
import cloud
from datetime import datetime, timezone
from cloud import practice_windows, session_windows, eligible, session_matches, renew_lease, clear_lease, lease_active, retry_delay, terminal_session_status


class CloudTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.data_patch = patch.object(cloud, 'DATA', Path(self.directory.name))
        self.data_patch.start()
        self.addCleanup(self.data_patch.stop)
        self.mode_patch = patch.dict(os.environ, {'AUTO_COLLECT': 'true'})
        self.mode_patch.start()
        self.addCleanup(self.mode_patch.stop)
        self.windows = practice_windows([{
            'RoundNumber': 9, 'EventName': 'Test Grand Prix',
            'Session1': 'Practice 1', 'Session1DateUtc': '2026-06-01T12:00:00',
            'Session2': 'Qualifying', 'Session2DateUtc': '2026-06-01T15:00:00',
        }])

    def test_utc_window_and_completed(self):
        self.assertEqual(len(self.windows), 2)
        self.assertEqual(self.windows[0]['start'], '2026-06-01T12:00:00+00:00')
        at = datetime(2026, 6, 1, 12, tzinfo=timezone.utc)
        self.assertIsNotNone(eligible(self.windows, at, []))
        self.assertIsNone(eligible(self.windows, at, [self.windows[0]['id']]))
        self.assertIsNone(eligible(self.windows, at.replace(hour=19), []))

    def test_qualifying_window_and_session_identity(self):
        at = datetime(2026, 6, 1, 15, tzinfo=timezone.utc)
        selected = eligible(self.windows, at, [])
        self.assertEqual(selected['name'], 'Qualifying')
        info = {'Name': 'Qualifying', 'Meeting': {'Name': 'Test Grand Prix'},
                'StartDate': '2026-06-01T15:00:00+00:00'}
        self.assertTrue(session_matches(info, selected))
        info['Name'] = 'Practice 1'
        self.assertFalse(session_matches(info, selected))

    def test_reject_previous_session(self):
        info = {'Name': 'Practice 1', 'Meeting': {'Name': 'Test Grand Prix'},
                'StartDate': '2026-06-01T14:00:00', 'GmtOffset': '+02:00:00'}
        self.assertTrue(session_matches(info, self.windows[0]))
        info['StartDate'] = '2026-05-25T14:00:00'
        self.assertFalse(session_matches(info, self.windows[0]))

    def test_collection_requires_active_page(self):
        clear_lease()
        self.assertFalse(lease_active())
        renew_lease()
        self.assertTrue(lease_active())
        clear_lease()
        self.assertFalse(lease_active())


    def test_race_window_boundaries_and_identity(self):
        windows = session_windows([{
            'RoundNumber': 18, 'EventName': 'United States Grand Prix',
            'Session4': 'Qualifying', 'Session4DateUtc': '2026-10-24T21:00:00',
            'Session5': 'Race', 'Session5DateUtc': '2026-10-25T19:00:00',
        }])
        race = windows[1]
        self.assertEqual(race['open'], '2026-10-25T18:55:00+00:00')
        self.assertEqual(race['close'], '2026-10-25T23:00:00+00:00')
        for stamp in ('2026-10-25T18:55:00+00:00', '2026-10-25T22:59:59+00:00'):
            self.assertEqual(eligible(windows, datetime.fromisoformat(stamp), []), race)
        self.assertIsNone(eligible(windows, datetime.fromisoformat(race['close']), []))
        self.assertIsNone(eligible(windows, datetime.fromisoformat(race['start']), [race['id']]))
        info = {'Name': 'Race', 'Meeting': {'Name': 'United States Grand Prix'},
                'StartDate': '2026-10-25T14:00:00', 'GmtOffset': '-05:00:00'}
        self.assertTrue(session_matches(info, race))
        info['Name'] = 'Qualifying'
        self.assertFalse(session_matches(info, race))

    def test_sprint_weekend_and_testing_exclusion(self):
        row = {'RoundNumber': 1, 'EventName': 'Test Grand Prix'}
        names = ['Practice 1', 'Sprint Qualifying', 'Sprint', 'Qualifying', 'Race']
        for index, name in enumerate(names, 1):
            row[f'Session{index}'] = name
            row[f'Session{index}DateUtc'] = f'2026-06-0{index}T12:00:00Z'
        self.assertEqual([w['name'] for w in session_windows([row])], names)
        row['Session2'] = 'Sprint Shootout'
        self.assertEqual(session_windows([row])[1]['name'], 'Sprint Shootout')
        row['RoundNumber'] = 0
        self.assertEqual(session_windows([row]), [])
        row['RoundNumber'] = 1
        row['Session5DateUtc'] = None
        self.assertEqual(len(session_windows([row])), 4)

    def test_automatic_schedule_without_page_and_manual_pause(self):
        clear_lease()
        self.assertFalse(lease_active())
        self.assertTrue(cloud.automatic_collection())
        self.assertTrue(cloud.collection_enabled())
        cloud.set_paused(True)
        self.assertFalse(cloud.collection_enabled())
        renew_lease()
        self.assertFalse(cloud.collection_enabled())
        cloud.set_paused(False)
        clear_lease()
        self.assertTrue(cloud.collection_enabled())
        with patch.dict(os.environ, {'AUTO_COLLECT': 'false'}):
            self.assertFalse(cloud.collection_enabled())
            renew_lease()
            self.assertTrue(cloud.collection_enabled())
        clear_lease()

    def test_all_supported_session_names(self):
        for name in cloud.SUPPORTED_SESSIONS:
            with self.subTest(name=name):
                windows = session_windows([{'RoundNumber': 1, 'EventName': 'Test Grand Prix',
                    'Session1': name, 'Session1DateUtc': '2026-06-01T12:00:00Z'}])
                self.assertEqual(windows[0]['name'], name)

    def test_terminal_statuses_and_bounded_transient_retry(self):
        for status in ('Finished', 'Finalised', 'Cancelled', 'Canceled', 'Aborted'):
            self.assertTrue(terminal_session_status(status))
        self.assertFalse(terminal_session_status('Started'))
        self.assertEqual(retry_delay(0, 0), 30)
        self.assertEqual(retry_delay(1, 30), 60)
        self.assertEqual(retry_delay(2, 90), 120)
        self.assertIsNone(retry_delay(3, 210))
        self.assertIsNone(retry_delay(0, 300))

    def test_supervisor_starts_race_without_page(self):
        clear_lease()
        at = datetime(2026, 6, 1, 12, tzinfo=timezone.utc)
        windows = session_windows([{'RoundNumber': 1, 'EventName': 'Test Grand Prix',
            'Session5': 'Race', 'Session5DateUtc': at.isoformat()}])
        cloud.atomic_json(cloud.DATA / 'schedule.json', {'windows': windows})
        from unittest.mock import Mock
        job = Mock(returncode=0)
        child_process = Mock(returncode=None)
        child_process.poll.return_value = None
        stop = Mock()
        stop.is_set.side_effect = [False, True]
        with patch.object(cloud, 'STOP', stop), patch.object(cloud, 'now', return_value=at), \
             patch.object(cloud, 'child', side_effect=[job, job, child_process]) as spawn, \
             patch.dict(os.environ, {'F1_USERNAME': 'test', 'F1_PASSWORD': 'test'}):
            cloud.supervisor()
        self.assertEqual(spawn.call_args_list[-1].args[0], 'record')
        status = cloud.read_json(cloud.DATA / 'status.json')
        self.assertEqual(status['active_window']['name'], 'Race')
        self.assertTrue(status['automatic_collection'])
        self.assertFalse(status['page_connected'])


class MeetingNames(unittest.TestCase):
    window = {'name': 'Practice 1', 'event': 'São Paulo Grand Prix', 'start': '2026-11-06T15:30:00+00:00'}

    def info(self, meeting, start='2026-11-06T12:30:00', name='Practice 1'):
        return {'Name': name, 'Meeting': {'Name': meeting}, 'StartDate': start, 'GmtOffset': '-03:00:00'}

    def test_accents_case_and_spaces(self):
        self.assertTrue(session_matches(self.info('Sao Paulo  grand prix'), self.window))
        self.assertTrue(session_matches(self.info('SÃO PAULO GRAND PRIX'), self.window))

    def test_renamed_meeting_needs_close_start(self):
        self.assertTrue(session_matches(self.info('Brazilian Grand Prix'), self.window))
        self.assertTrue(session_matches(self.info('Brazilian Grand Prix', '2026-11-06T12:55:00'), self.window))
        self.assertFalse(session_matches(self.info('Brazilian Grand Prix', '2026-11-06T13:31:00'), self.window))
        self.assertTrue(session_matches(self.info('São Paulo Grand Prix', '2026-11-06T14:00:00'), self.window))

    def test_session_name_still_required(self):
        self.assertFalse(session_matches(self.info('São Paulo Grand Prix', name='Practice 2'), self.window))


if __name__ == '__main__':
    unittest.main()

