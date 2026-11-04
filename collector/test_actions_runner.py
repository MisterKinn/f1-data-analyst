import unittest
from pathlib import Path
from datetime import datetime, timedelta, timezone
import actions_runner

UTC = timezone.utc


def window(start, name='Practice 1', hours=3):
    return {'id': '2026-21-1', 'event': 'São Paulo Grand Prix', 'name': name, 'start': start.isoformat(),
            'open': (start - timedelta(minutes=5)).isoformat(), 'close': (start + timedelta(hours=hours)).isoformat()}


class NextWindow(unittest.TestCase):
    start = datetime(2026, 11, 6, 15, 30, tzinfo=UTC)

    def test_opens_soon(self):
        self.assertEqual(actions_runner.next_window([window(self.start)], self.start - timedelta(minutes=30))['id'], '2026-21-1')

    def test_too_early(self):
        self.assertIsNone(actions_runner.next_window([window(self.start)], self.start - timedelta(hours=2)))

    def test_running_and_closed(self):
        self.assertIsNotNone(actions_runner.next_window([window(self.start)], self.start + timedelta(hours=2)))
        self.assertIsNone(actions_runner.next_window([window(self.start)], self.start + timedelta(hours=4)))

    def test_key_sessions_start_earlier(self):
        early = self.start - timedelta(minutes=70)
        self.assertIsNone(actions_runner.next_window([window(self.start)], early))
        for name in ('Qualifying', 'Sprint Qualifying', 'Sprint', 'Race'):
            self.assertIsNotNone(actions_runner.next_window([window(self.start, name)], early), name)
        self.assertIsNone(actions_runner.next_window([window(self.start, 'Race')], self.start - timedelta(minutes=90)))

    def test_race_wait_fits_job_timeout(self):
        workflow = open(Path(__file__).resolve().parent.parent / '.github/workflows/f1-live-collector.yml', encoding='utf-8').read()
        timeout = int(workflow.split('timeout-minutes:')[1].split()[0])
        worst = actions_runner.KEY_LOOKAHEAD + timedelta(minutes=5) + timedelta(hours=4)
        self.assertLessEqual(worst, timedelta(minutes=timeout - 10))


class RunLog(unittest.TestCase):
    def test_appends_safe_json_lines(self):
        import json, tempfile, cloud
        from unittest import mock
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(cloud, 'DATA', Path(folder)), \
                mock.patch.dict('os.environ', {'F1_PASSWORD': 'secret-value'}):
            cloud.run_log({'event': 'record_end', 'reason': 'socket_closed'})
            cloud.run_log({'event': 'job_end', 'finished': False})
            lines = (Path(folder) / 'run-log.jsonl').read_text(encoding='utf-8').splitlines()
        self.assertEqual([json.loads(line)['event'] for line in lines], ['record_end', 'job_end'])
        self.assertNotIn('secret-value', '\n'.join(lines))

    def test_workflow_keeps_logs_without_raw_timing(self):
        workflow = (Path(__file__).resolve().parent.parent / '.github/workflows/f1-live-collector.yml').read_text(encoding='utf-8')
        self.assertIn('run-log.jsonl', workflow)
        self.assertIn('if: always()', workflow)
        self.assertNotIn('timing-raw', workflow)


if __name__ == '__main__':
    unittest.main()
