import base64
import json
import os
import tempfile
import time
import unittest
import zlib
from pathlib import Path
from unittest import mock

os.environ.setdefault('DATA_DIR', tempfile.mkdtemp())
import cloud  # noqa: E402
from collector import State, bounded_snapshot_text, write_snapshot  # noqa: E402
from telemetry import LiveTelemetry  # noqa: E402


def packed(value):
    c = zlib.compressobj(wbits=-zlib.MAX_WBITS)
    return base64.b64encode(c.compress(json.dumps(value).encode()) + c.flush()).decode()


def old_rule(state, limit):
    data = state.snapshot()
    while len(json.dumps(data, ensure_ascii=False).encode()) > limit and data['recent_events']:
        data['recent_events'] = data['recent_events'][20:]
    return data


class CpuSavingsTest(unittest.TestCase):
    def state(self, events=0, size=10):
        s = State()
        s.apply('SessionInfo', {'Key': 5, 'Name': 'Race'}, initial=True)
        s.apply('SessionStatus', {'Status': 'Started'}, initial=True)
        for i in range(events):
            s.apply('TimingData', {'Lines': {'1': {'Sectors': {'0': {'Value': '가' * size + str(i)}}}}}, '2026-11-08T17:00:%02d.000Z' % (i % 60))
        return s

    def test_snapshot_is_an_independent_copy(self):
        s = self.state(3)
        snap = s.snapshot()
        snap['topics']['SessionInfo']['Key'] = 999
        snap['recent_events'][-1]['patch']['Lines'] = {}
        self.assertEqual(s.snapshot()['topics']['SessionInfo']['Key'], 5)
        self.assertNotEqual(s.snapshot()['recent_events'][-1]['patch']['Lines'], {})

    def test_caller_dicts_are_still_copied(self):
        s = self.state()
        patch = {'Lines': {'1': {'Position': '1'}}}
        s.apply('TimingData', patch, '2026-11-08T17:01:00.000Z')
        patch['Lines']['1']['Position'] = '9'
        self.assertEqual(s.snapshot()['recent_events'][-1]['patch']['Lines']['1']['Position'], '1')
        self.assertEqual(s.snapshot()['topics']['TimingData']['Lines']['1']['Position'], '1')

    def test_decoded_batches_are_kept_without_copy_and_match(self):
        s = self.state()
        batch = {'Entries': [{'Utc': '2026-11-08T17:00:00Z', 'Cars': {'1': {'Channels': {'0': 10000}}}}]}
        s.apply('CarData.z', packed(batch), '2026-11-08T17:00:00.100Z')
        self.assertEqual(s.snapshot()['topics']['CarData.z'], batch)

    def test_trimming_matches_the_original_rule(self):
        for events, size, limit in [(5, 10, 900_000), (400, 3000, 900_000), (400, 1500, 300_000), (230, 700, 120_000)]:
            s = self.state(events, size)
            new = json.loads(bounded_snapshot_text(s, limit))
            old = old_rule(s, limit)
            self.assertEqual(len(new['recent_events']), len(old['recent_events']), (events, size, limit))
            self.assertEqual(new['recent_events'], old['recent_events'])
            self.assertLessEqual(len(json.dumps(new, ensure_ascii=False).encode()), limit)

    def test_persist_writes_one_serialization_and_skips_unchanged_checkpoint(self):
        s = self.state(10)
        data = Path(tempfile.mkdtemp())
        self.assertEqual(cloud.persist_snapshot(s, data), 'Started')
        live = (data / 'snapshot.json').read_text(encoding='utf-8')
        self.assertEqual(live, (data / 'sessions' / '5' / 'snapshot.json').read_text(encoding='utf-8'))
        self.assertEqual(json.loads(live)['sequence'], s.sequence)
        checkpoint = data / 'lap-archive.json'
        self.assertTrue(checkpoint.exists())
        stamp = checkpoint.stat().st_mtime_ns
        time.sleep(0.01)
        with mock.patch.object(cloud, 'atomic_text', wraps=cloud.atomic_text) as writes:
            cloud.persist_snapshot(s, data)
        written = [call.args[0].name for call in writes.call_args_list]
        self.assertNotIn('lap-archive.json', written)
        self.assertEqual(checkpoint.stat().st_mtime_ns, stamp)
        final = Path(tempfile.mkdtemp())
        s.last_checkpoint_text = None
        cloud.persist_snapshot(s, data, session_dir=final)
        self.assertTrue((final / 'snapshot.json').exists())

    def test_pc_writer_still_writes_both_files(self):
        s = self.state(3)
        out = Path(tempfile.mkdtemp())
        write_snapshot(s, out / 'snapshot.json')
        self.assertEqual(json.loads((out / 'snapshot.json').read_text(encoding='utf-8'))['sequence'], s.sequence)
        self.assertTrue((out / 'lap-archive.json').exists())

    def test_sample_count_is_cached_between_snapshots(self):
        d = Path(tempfile.mkdtemp())
        t = LiveTelemetry(d, {'Key': 8}, d / 'raw.txt')
        row = {'Entries': [{'Utc': '2026-11-08T17:00:00Z', 'Cars': {'1': {'Channels': {'0': 10000, '2': 200, '3': 7, '4': 90, '5': 0}}}}]}
        t.append('CarData.z', row)
        self.assertEqual(t.summary()['sample_count'], 1)
        row['Entries'][0]['Utc'] = '2026-11-08T17:00:01Z'
        t.append('CarData.z', row)
        self.assertEqual(t.summary()['sample_count'], 1)  # cached for up to 30 s
        self.assertEqual(t.sample_count(max_age=0), 2)
        t.append('SessionStatus', {'Status': 'Finished'})
        self.assertEqual(t.summary()['sample_count'], 2)  # always exact once the session ends


if __name__ == '__main__':
    unittest.main()
