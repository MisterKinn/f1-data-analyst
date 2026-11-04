"""A frozen live feed must end the attempt (so the runner reconnects), not hang until the window closes."""
import json
import tempfile
import threading
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import cloud
from signalrcore.messages.completion_message import CompletionMessage

UTC = timezone.utc


class FrozenClient:
    """Sends the initial state once, then blocks forever like the upstream hang bug."""
    def __init__(self, filename, filemode='w', timeout=60):
        self.release = threading.Event()

    def start(self):
        self._on_connect()
        start = datetime.now(UTC)
        message = CompletionMessage('1', {'SessionInfo': {
            'Key': 1, 'Name': 'Practice 1', 'Meeting': {'Name': 'São Paulo Grand Prix'},
            'StartDate': start.replace(tzinfo=None).isoformat(timespec='seconds'), 'GmtOffset': '00:00:00'}}, None)
        self._on_message(message)
        self.release.wait()  # never returns on its own

    def _on_message(self, message):
        pass

    def _on_connect(self):
        pass

    def _on_close(self):
        pass

    def _exit(self):
        self.release.set()


class FeedWatchdog(unittest.TestCase):
    def test_frozen_feed_ends_attempt_with_reason(self):
        now = datetime.now(UTC)
        window = {'id': 'test-1', 'event': 'São Paulo Grand Prix', 'name': 'Practice 1', 'start': now.isoformat(),
                  'open': (now - timedelta(minutes=5)).isoformat(), 'close': (now + timedelta(hours=3)).isoformat()}
        with tempfile.TemporaryDirectory() as folder, \
                mock.patch.object(cloud, 'DATA', Path(folder)), \
                mock.patch.object(cloud, 'FEED_STALL_SECONDS', 3), \
                mock.patch.dict('os.environ', {'F1_USERNAME': 'u', 'F1_PASSWORD': 'p'}), \
                mock.patch('fastf1.internals.f1account.get_token', return_value=mock.Mock(value='t')), \
                mock.patch('fastf1.set_auth_method'), \
                mock.patch('fastf1.livetiming.client.SignalRClient', FrozenClient), \
                mock.patch('recovery.recover', lambda *a, **k: None):
            began = time.monotonic()
            code = cloud.record(window)
            took = time.monotonic() - began
            log = [json.loads(line) for line in (Path(folder) / 'run-log.jsonl').read_text(encoding='utf-8').splitlines()]
        self.assertEqual(code, 22)  # not finished, so the runner retries
        self.assertLess(took, 30)
        self.assertEqual(log[-1]['reason'], 'watchdog_no_data_3s')
        self.assertTrue(log[-1]['accepted'])
        self.assertNotIn('"p"', json.dumps(log))


if __name__ == '__main__':
    unittest.main()
