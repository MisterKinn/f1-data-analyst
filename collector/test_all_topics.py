import base64
import json
import unittest
import zlib
from collector import State, TOPICS


def compressed(data):
    z = zlib.compressobj(wbits=-15)
    return base64.b64encode(z.compress(json.dumps(data).encode()) + z.flush()).decode()


class ExpandedFeedTests(unittest.TestCase):
    def test_radio_links_and_optional_commentary_keep_timestamps(self):
        s = State()
        s.apply('TeamRadio', {'Captures': {'0': {'RacingNumber': '16', 'Path': 'radio/16.mp3'}}}, '2026-10-30T22:00:00Z')
        snap = s.snapshot()
        self.assertEqual(snap['topics']['TeamRadio']['Captures']['0']['RacingNumber'], '16')
        self.assertFalse(snap['topic_times']['TeamRadio']['initial_snapshot'])
        self.assertIn('TeamRadio', [e['topic'] for e in snap['recent_events']])

    def test_compressed_car_and_position_replace_ephemeral_batches(self):
        s = State()
        for topic in ['CarData.z', 'Position.z']:
            s.apply(topic, compressed({'Entries': [{'Utc': 'first', 'Cars': {'16': {'Channels': {'2': 280}}}}]}))
            s.apply(topic, json.dumps(compressed({'Entries': [{'Utc': 'second'}]})))
            self.assertEqual(s.snapshot()['topics'][topic]['Entries'], [{'Utc': 'second'}])
        self.assertEqual(len(TOPICS), len(set(TOPICS)))
        self.assertEqual(len(TOPICS), 20)

    def test_bad_compressed_input_does_not_replace_good_state(self):
        s = State()
        s.apply('CarData.z', compressed({'Entries': []}))
        for bad in ['not-base64', base64.b64encode(b'bad').decode(), compressed('wrong-shape')]:
            with self.assertRaises((ValueError, zlib.error)):
                s.apply('CarData.z', bad)
        self.assertEqual(s.snapshot()['topics']['CarData.z'], {'Entries': []})
