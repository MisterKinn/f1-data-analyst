import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from collector import State
from diagnostics import PerformanceRecorder, cgroup_cpu
from telemetry import LiveTelemetry


class DiagnosticsTests(unittest.TestCase):
    def test_cpu_quota_throttling_and_slow_callback_survive_without_snapshot_polling(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch('diagnostics.time.monotonic', return_value=10), patch('diagnostics.time.process_time', return_value=2), patch('diagnostics.cgroup_cpu', return_value=(0.5, 4, 1)):
                recorder = PerformanceRecorder(Path(directory), 123, 'r')
            recorder.observe('TimingData', '2026-11-06T15:05:00Z', datetime(2026, 11, 6, 15, 40, tzinfo=timezone.utc).timestamp(), 200)
            with patch('diagnostics.time.monotonic', return_value=20), patch('diagnostics.time.process_time', return_value=7), patch('diagnostics.cgroup_cpu', return_value=(0.5, 9, 3)):
                sample = recorder.sample()
            self.assertEqual(sample['process_cpu_percent_one_core'], 50)
            self.assertEqual(sample['cgroup_cpu_percent_of_quota'], 100)
            self.assertEqual(sample['cgroup_throttled_seconds'], 2)
            self.assertEqual(sample['timing_source_lag_seconds'], 2100)
            self.assertEqual(sample['callback_max_ms'], 200)
            self.assertEqual(json.loads(recorder.path.read_text())['sequence'], 1)
            self.assertEqual(recorder.snapshot()['samples'][0], sample)

    def test_missing_cgroup_is_unknown_and_v2_counters_use_microseconds(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(cgroup_cpu(root), (None, None, None))
            (root / 'cpu.max').write_text('50000 100000')
            (root / 'cpu.stat').write_text('usage_usec 1000000\nthrottled_usec 2000000\n')
            self.assertEqual(cgroup_cpu(root), (0.5, 1, 2))

    def test_old_packet_does_not_roll_state_backward_or_refresh_topic_clock(self):
        s = State()
        s.apply('SessionInfo', {'Key': 123}, initial=True)
        s.apply('TimingData', {'Lines': {'63': {'NumberOfLaps': 10}}}, '2026-11-06T15:40:00Z')
        before = s.last_message_at
        s.apply('TimingData', {'Lines': {'63': {'NumberOfLaps': 1}}}, '2026-11-06T15:05:00Z')
        self.assertEqual(s.topics['TimingData']['Lines']['63']['NumberOfLaps'], 10)
        self.assertEqual(s.last_message_at, before)
        self.assertEqual(s.out_of_order_packets, 1)

    def test_source_freshness_and_patch_ownership(self):
        s = State();s.connected = True
        now = datetime.now(timezone.utc)
        s.apply('Heartbeat', {}, now.isoformat())
        patch = {'Lines': {'63': {'NumberOfLaps': 1}}}
        s.apply('TimingData', patch, (now - timedelta(minutes=35)).isoformat())
        self.assertFalse(s.snapshot()['feed_fresh'])
        s.apply('TimingData', patch, now.isoformat())
        self.assertTrue(s.snapshot()['feed_fresh'])
        patch['Lines']['63']['NumberOfLaps'] = 999
        self.assertEqual(s.topics['TimingData']['Lines']['63']['NumberOfLaps'], 1)

    def test_batched_telemetry_is_visible_to_a_separate_reader_after_flush(self):
        with tempfile.TemporaryDirectory() as directory:
            store = LiveTelemetry(Path(directory), {'Key': 123})
            with patch('telemetry.time.monotonic', return_value=store.last_commit):
                store.append('CarData.z', {'Entries': [{'Utc': '2026-11-06T15:40:00Z', 'Cars': {'63': {'Channels': {'0': 10000, '2': 180, '3': 5, '4': 100, '5': 0}}}}]})
            self.assertTrue(store.db.in_transaction)
            store.flush(force=True)
            import sqlite3
            with sqlite3.connect(store.path) as reader:
                self.assertEqual(reader.execute('select count(*) from samples').fetchone()[0], 1)
            reader.close()
            store.db.close()

    def test_old_car_batch_fills_telemetry_without_replacing_latest_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            s = State();s.telemetry = LiveTelemetry(Path(directory), {'Key': 123})
            def batch(at):
                return {'Entries': [{'Utc': at, 'Cars': {'63': {'Channels': {'0': 10000, '2': 180, '3': 5, '4': 100, '5': 0}}}}]}
            s.apply('CarData.z', batch('2026-11-06T15:40:00Z'), '2026-11-06T15:40:00Z')
            s.apply('CarData.z', batch('2026-11-06T15:39:59Z'), '2026-11-06T15:39:59Z')
            self.assertEqual(s.topics['CarData.z']['Entries'][0]['Utc'], '2026-11-06T15:40:00Z')
            s.telemetry.flush(force=True)
            self.assertEqual(s.telemetry.db.execute('select count(*) from samples').fetchone()[0], 2)
            s.telemetry.db.close()


if __name__ == '__main__':
    unittest.main()
