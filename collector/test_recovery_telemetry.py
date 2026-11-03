import json
import tempfile
import unittest
import threading
from pathlib import Path
from unittest.mock import patch
from collector import State
from recovery import replay_official, recover, session_path
from telemetry import LiveTelemetry, TelemetryJobs, build_lap, purge_expired
from history import HistoryJobs, fastf1_history
import cloud

INFO = {'Key': 123, 'Path': '2026/2026-11-01_Mexico_City_Grand_Prix/2026-10-30_Practice_2/'}
LAP = {'id': '123:63:0:100', 'driver_number': '63', 'lap_time': '1:00.000',
       'sectors': {'S1': '20.000', 'S2': '20.000', 'S3': '20.000'},
       'sector_source_times': ['2026-10-30T22:00:20Z', '2026-10-30T22:00:40Z', '2026-10-30T22:01:00Z']}
START = 1793397600.0


class RecoveryTelemetryTests(unittest.TestCase):
    def test_closed_live_session_can_recover_through_saved_official_path(self):
        state, _ = replay_official(INFO, self.reader)
        with tempfile.TemporaryDirectory() as directory:
            jobs = HistoryJobs(Path(directory))
            with patch('recovery.replay_official', return_value=(state, {'packets': 3})):
                jobs.run('123', Path(directory) / '123.json', {'SessionInfo': INFO})
            result = jobs.request({'SessionInfo': INFO})
            self.assertEqual(result['state'], 'ready')
            self.assertEqual(result['lap_archive']['best_laps']['session']['63']['status'], 'complete')

    def test_missing_clock_history_falls_back_to_canonical_fastf1_parser(self):
        state, _ = replay_official(INFO, self.reader)
        with tempfile.TemporaryDirectory() as directory:
            jobs = HistoryJobs(Path(directory))
            with patch('recovery.replay_official', side_effect=ValueError('clock unavailable')), patch('history.fastf1_history', return_value=(state, {'source': 'FastF1'})) as fallback:
                jobs.run('123', Path(directory) / '123.json', {'SessionInfo': INFO})
            self.assertEqual(jobs.request({'SessionInfo': INFO})['state'], 'ready')
            fallback.assert_called_once_with(INFO)

    def test_fastf1_historical_dataframe_produces_verified_utc_sector_record(self):
        import pandas as pd
        from types import SimpleNamespace
        from unittest.mock import Mock
        info = dict(INFO, StartDate='2026-10-30T16:00:00', Meeting={'Name': 'Mexico City Grand Prix'}, Name='Practice 2')
        row = {'DriverNumber': '63', 'Driver': 'RUS', 'Team': 'Mercedes', 'LapNumber': 15, 'IsAccurate': True, 'Deleted': False,
               'PitInTime': pd.NaT, 'PitOutTime': pd.NaT, 'LapTime': pd.Timedelta(seconds=60),
               'Sector1Time': pd.Timedelta(seconds=20), 'Sector2Time': pd.Timedelta(seconds=20), 'Sector3Time': pd.Timedelta(seconds=20),
               'Sector1SessionTime': pd.Timedelta(seconds=20), 'Sector2SessionTime': pd.Timedelta(seconds=40), 'Sector3SessionTime': pd.Timedelta(seconds=60),
               'Compound': 'SOFT', 'TyreLife': 3}
        session = SimpleNamespace(name='Practice 2', api_path='/static/' + INFO['Path'], load=Mock(),
            t0_date=pd.Timestamp('2026-10-30T22:00:00'), laps=pd.DataFrame([row]), session_status=pd.DataFrame([{'Status': 'Finalised'}]))
        with patch('fastf1.get_session', return_value=session):
            state, detail = fastf1_history(info)
        best = state.laps.export(state.topics)['best_laps']['session']['63']
        self.assertEqual(best['status'], 'complete')
        self.assertEqual(best['timing_lap_reference'], 15)
        self.assertEqual(best['tyre']['compound'], 'SOFT')
        self.assertTrue(best['sector_source_times'][0].endswith('+00:00'))

    def test_wec_setup_failure_cannot_pause_or_stop_f1(self):
        stop_before = cloud.STOP.is_set()
        with patch('wec_install.ensure_browser', side_effect=RuntimeError('WEC unavailable')):
            cloud.prepare_wec()
        self.assertEqual(cloud.WEC_RUNTIME, 'unavailable')
        self.assertEqual(cloud.STOP.is_set(), stop_before)
        state = State()
        state.apply('SessionInfo', INFO, initial=True)
        state.apply('Heartbeat', {'Utc': '2026-10-30T22:00:00Z'}, '2026-10-30T22:00:00Z')
        self.assertIsNotNone(state.last_message_at)

    def test_f1_receives_while_wec_setup_is_blocked(self):
        entered, release = threading.Event(), threading.Event()
        def setup():
            entered.set()
            release.wait(2)
            raise RuntimeError('optional WEC setup failed')
        with patch('wec_install.ensure_browser', side_effect=setup):
            job = threading.Thread(target=cloud.prepare_wec)
            job.start()
            try:
                self.assertTrue(entered.wait(1))
                state = State()
                state.apply('SessionInfo', INFO, initial=True)
                state.apply('TimingData', {'Lines': {'63': {'NumberOfLaps': 12}}}, '2026-10-30T22:00:00Z')
                self.assertEqual(state.topics['TimingData']['Lines']['63']['NumberOfLaps'], 12)
                self.assertTrue(job.is_alive())
            finally:
                release.set()
                job.join(2)

    def reader(self, info, topic):
        if topic == 'Heartbeat':
            return [(0, json.dumps({'Utc': '2026-10-30T22:00:00Z'}))]
        if topic == 'TimingData':
            return [(i * 20, json.dumps({'Lines': {'63': {'Sectors': {str(i-1): {'Value': '20.000'}},
                **({'LastLapTime': {'Value': '1:00.000'}, 'BestLapTime': {'Value': '1:00.000', 'Lap': 3}} if i == 3 else {})}}})) for i in (1, 2, 3)]
        return []

    def test_official_replay_recovers_best_lap_without_live_freshness(self):
        s, detail = replay_official(INFO, self.reader)
        self.assertEqual(s.laps.export(s.topics)['best_laps']['session']['63']['status'], 'complete')
        live = State()
        live.apply('SessionInfo', INFO, initial=True)
        with tempfile.TemporaryDirectory() as directory:
            result = recover(live, INFO, Path(directory) / 'missing.txt', self.reader)
        self.assertEqual(result['state'], 'complete')
        self.assertEqual(len(live.laps.records), 1)
        self.assertIsNone(live.last_message_at)
        self.assertFalse(live.snapshot()['feed_fresh'])

    def test_recovery_failure_does_not_discard_saved_records(self):
        state, _ = replay_official(INFO, self.reader)
        def fail(*args):
            raise ValueError('unavailable')
        with tempfile.TemporaryDirectory() as directory:
            recover(state, INFO, Path(directory) / 'missing.txt', fail)
        self.assertEqual(len(state.laps.records), 1)
        self.assertEqual(state.laps.recovery['state'], 'partial_or_unavailable')

    def test_reconnect_replaces_initial_topic_instead_of_stale_merge(self):
        s = State()
        s.apply('SessionInfo', INFO, initial=True)
        s.apply('TimingData', {'Lines': {'63': {'BestLapTime': {'Value': '1:00.000'}}}})
        s.apply('TimingData', {'Lines': {'63': {'NumberOfLaps': 4}}}, initial=True)
        self.assertNotIn('BestLapTime', s.topics['TimingData']['Lines']['63'])

    def test_explicit_different_best_lap_reference_is_not_aliased(self):
        s, _ = replay_official(INFO, self.reader)
        s.topics['TimingData']['Lines']['63']['BestLapTime']['Lap'] = 9
        self.assertEqual(s.laps.export(s.topics)['best_laps']['session']['63']['status'], 'unavailable')

    def test_session_path_rejects_external_urls_and_traversal(self):
        for path in ('https://example.com/', '../foo/', '2026/a/../../b/'):
            with self.assertRaises(ValueError):
                session_path({'Path': path})

    def test_accumulation_is_idempotent_and_time_sliced(self):
        with tempfile.TemporaryDirectory() as directory:
            d = Path(directory)
            store = LiveTelemetry(d, INFO)
            entries = [{'Utc': f'2026-10-30T22:00:{second:02}Z', 'Cars': {'63': {'Channels': {'0': 10000, '2': 180, '3': 5, '4': 100, '5': 0}}}} for second in range(60)]
            entries.append({'Utc': '2026-10-30T22:01:00Z', 'Cars': entries[0]['Cars']})
            store.append('CarData.z', {'Entries': entries})
            store.append('CarData.z', {'Entries': entries})
            store.flush(force=True)
            self.assertEqual(store.db.execute('SELECT COUNT(*) FROM samples').fetchone()[0], 61)
            result = LiveTelemetry.laps(d, INFO, [LAP])[0]
            self.assertTrue(result['complete_coverage'])
            self.assertEqual(result['distance_m'], 3000)
            self.assertTrue(all(row[4] == 0 for row in result['samples']))
            store.db.close()

    def test_gaps_and_unobserved_boundaries_are_not_full_coverage(self):
        samples = [[START + second, 180, 100, 0, 5, 10000] for second in range(61) if second != 30]
        result = build_lap(LAP, samples)
        self.assertFalse(result['complete_coverage'])
        self.assertEqual(result['gaps_seconds'], [[29, 31]])
        self.assertFalse(build_lap(LAP, samples[2:])['complete_coverage'])

    def test_five_minute_expiry_purges_all_collector_copies_and_keeps_timing(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory)
            raw = data / 'sessions' / 'window' / 'timing-raw.txt'
            raw.parent.mkdir(parents=True)
            raw.write_text('car telemetry')
            snapshot = {'topics': {'SessionInfo': INFO, 'CarData.z': {'Entries': []}, 'Position.z': {}, 'TimingData': {'keep': True}}, 'lap_archive': {'records': [LAP]}}
            (data / 'snapshot.json').write_text(json.dumps(snapshot))
            store = LiveTelemetry(data / 'telemetry', INFO, raw)
            with patch('telemetry.time.time', return_value=1000):
                store.append('SessionStatus', {'Status': 'Finished'})
            store.db.close()
            purge_expired(data, at=1299)
            self.assertTrue(store.path.exists())
            purge_expired(data, at=1300)
            self.assertFalse(store.path.exists())
            self.assertFalse(raw.exists())
            saved = json.loads((data / 'snapshot.json').read_text())
            self.assertNotIn('CarData.z', saved['topics'])
            self.assertNotIn('Position.z', saved['topics'])
            self.assertTrue(saved['topics']['TimingData']['keep'])
            self.assertEqual(saved['lap_archive']['records'], [LAP])

    def test_expired_live_query_automatically_starts_historical_load(self):
        with tempfile.TemporaryDirectory() as directory:
            d = Path(directory)
            live = d / 'telemetry'
            live.mkdir()
            (live / '123.meta.json').write_text(json.dumps({'ended_at': 1, 'purged_at': 301}))
            jobs = TelemetryJobs(d / 'jobs', live)
            with patch('telemetry.threading.Thread') as thread:
                result = jobs.request(INFO, [LAP])
            self.assertEqual(result['state'], 'pending')
            self.assertTrue(result['source_switched_after_expiry'])
            thread.return_value.start.assert_called_once()


if __name__ == '__main__':
    unittest.main()
