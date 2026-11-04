import unittest
from datetime import datetime, timedelta, timezone
import actions_runner

UTC = timezone.utc


def window(start):
    return {'id': '2026-21-1', 'event': 'São Paulo Grand Prix', 'name': 'Practice 1', 'start': start.isoformat(),
            'open': (start - timedelta(minutes=5)).isoformat(), 'close': (start + timedelta(hours=3)).isoformat()}


class NextWindow(unittest.TestCase):
    start = datetime(2026, 11, 6, 15, 30, tzinfo=UTC)

    def test_opens_soon(self):
        self.assertEqual(actions_runner.next_window([window(self.start)], self.start - timedelta(minutes=30))['id'], '2026-21-1')

    def test_too_early(self):
        self.assertIsNone(actions_runner.next_window([window(self.start)], self.start - timedelta(hours=2)))

    def test_running_and_closed(self):
        self.assertIsNotNone(actions_runner.next_window([window(self.start)], self.start + timedelta(hours=2)))
        self.assertIsNone(actions_runner.next_window([window(self.start)], self.start + timedelta(hours=4)))


if __name__ == '__main__':
    unittest.main()
