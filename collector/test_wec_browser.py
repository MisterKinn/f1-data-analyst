import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from wec_browser import (DiscoveryError, checked_url, public_url, session_name,
                         select_session, request_target, normalize_table, discover)
from wec_runtime import WECManager, save_result

RACE = 'https://plus.fiawec.com/en/race/6-hours-of-monza'
WATCH = 'https://plus.fiawec.com/en/video/test-monza-2026-free-practice-1'
TIMING = 'https://fiawec.alkamelsystems.com/timing'
TARGET = {'event': 'Monza', 'year': 2026, 'session': 'FP1'}


class Driver:
    def __init__(self, cards):
        self.cards = cards
        self.calls = []
        self.timing = TIMING
        self.home = []
        self.countdown = False
    def authenticate(self): self.calls.append('authenticate')
    def next_session_cards(self):
        self.calls.append('next_session_cards')
        return self.home
    def waiting_for_start(self): return self.countdown
    def race_links(self):
        self.calls.append('race_links')
        return [{'url': RACE, 'text': 'Monza'}]
    def session_cards(self, url):
        self.calls.append(('session_cards', url))
        return self.cards
    def open_timing(self, url):
        self.calls.append(('open_timing', url))
        return self.timing
    def read_rows(self):
        self.calls.append('read_rows')
        return [{'No.': '007', 'Lap': '1', 'Time': '1:40.000'}]


class WECTests(unittest.TestCase):
    def test_complete_discovery_order_and_no_false_live_claim(self):
        d = Driver([{'url': WATCH, 'text': 'Monza 2026 Free Practice 1 English LIVE', 'live': True}])
        result = discover(d, TARGET)
        self.assertEqual(d.calls, ['authenticate', 'next_session_cards', 'race_links', ('session_cards', RACE), ('open_timing', WATCH), 'read_rows'])
        self.assertEqual(result['timing_url'], TIMING)
        self.assertFalse(result['live'])
        self.assertEqual(result['state'], 'snapshot_unverified')
        self.assertEqual(result['records'][0]['No.'], '007')

    def test_replay_old_year_and_future_card_do_not_open_timing(self):
        cards = [
            {'url': WATCH, 'text': 'Monza 2023 Free Practice 1', 'live': True},
            {'url': WATCH, 'text': 'Monza 2026 FP1 Replay', 'live': True},
            {'url': WATCH, 'text': 'Monza 2026 FP1 Starts tomorrow', 'live': False}]
        # URL is also evidence; remove 2026 from the old-year fixture.
        cards[0]['url'] = WATCH.replace('2026', '2023')
        d = Driver(cards)
        result = discover(d, TARGET)
        self.assertEqual(result['state'], 'waiting_for_session')
        self.assertNotIn('read_rows', d.calls)
        self.assertFalse(any(isinstance(c, tuple) and c[0] == 'open_timing' for c in d.calls))

    def test_signed_timing_link_is_never_exported(self):
        d = Driver([{'url': WATCH, 'text': 'Monza 2026 FP1', 'live': True}])
        d.timing = TIMING + '?access_token=EXAMPLE_PRIVATE_VALUE'
        result = discover(d, TARGET)
        self.assertIsNone(result['timing_url'])
        self.assertTrue(result['private_timing_link'])
        self.assertNotIn('EXAMPLE_PRIVATE_VALUE', json.dumps(result))

    def test_authentication_failure_stops_before_discovery(self):
        d = Driver([])
        d.authenticate = Mock(side_effect=DiscoveryError('authentication_failed'))
        with self.assertRaisesRegex(DiscoveryError, 'authentication_failed'):
            discover(d, TARGET)
        self.assertEqual(d.calls, [])

    def test_recorded_flow_home_next_sessions_to_livestream(self):
        # Recorded: FIA WEC home -> NEXT SESSIONS LIVE card -> session page -> LIVE TIMING.
        live = 'https://plus.fiawec.com/en/livestream/s-6-hours-of-monza-free-practice-1-78gtpr'
        d = Driver([])
        d.home = [{'url': 'https://plus.fiawec.com/en/video/elms-portimao-free-practice-1', 'text': 'ELMS 4 HOURS OF PORTIMAO FREE PRACTICE 1 LIVE', 'live': True},
                  {'url': WATCH, 'text': '6 HOURS OF MONZA - FREE PRACTICE 1 TODAY 18:30 LIVE', 'live': True}]
        d.timing = live
        result = discover(d, TARGET)
        self.assertEqual(d.calls[:3], ['authenticate', 'next_session_cards', ('open_timing', WATCH)])
        self.assertNotIn('race_links', d.calls)
        self.assertEqual(result['timing_url'], live)
        self.assertEqual(result['session'], 'FP1')

    def test_scheduled_window_opens_upcoming_card_and_reports_countdown(self):
        d = Driver([])
        d.home = [{'url': WATCH, 'text': '6 HOURS OF MONZA - FREE PRACTICE 1 TODAY 18:30', 'live': False}]
        d.read_rows = lambda: []
        d.countdown = True
        self.assertEqual(discover(d, TARGET)['state'], 'waiting_for_session')  # on demand: LIVE badge needed
        result = discover(d, TARGET, upcoming=True)
        self.assertEqual(result['state'], 'timing_waiting_start')
        self.assertFalse(result['live'])

    def test_ssrf_and_credential_urls_rejected(self):
        for url in ['http://plus.fiawec.com/en', 'https://127.0.0.1/',
                    'https://plus.fiawec.com.evil.test/en', 'https://name:secret@plus.fiawec.com/en',
                    'https://plus.fiawec.com:8443/en', '//evil.test/path', 'file:///etc/passwd']:
            with self.subTest(url=url), self.assertRaises(DiscoveryError): checked_url(url)
        self.assertIsNone(public_url(TIMING + '#private'))
        self.assertEqual(checked_url('/en/race/monza'), 'https://plus.fiawec.com/en/race/monza')

    def test_exact_session_and_ambiguity(self):
        for text, expected in [('Free Practice 1', 'FP1'), ('FP2', 'FP2'), ('Practice 3', 'FP3'),
                               ('Hyperpole', 'Hyperpole'), ('Qualifying', 'Qualifying'), ('Race', 'Race')]:
            self.assertEqual(session_name(text), expected)
        cards = [{'url': WATCH, 'text': 'Monza 2026 FP1', 'live': True},
                 {'url': WATCH.replace('free-practice-1', 'race'), 'text': 'Monza 2026 Race', 'live': True}]
        with self.assertRaisesRegex(DiscoveryError, 'ambiguous_live_session'):
            select_session(cards, 2026)
        self.assertEqual(select_session(cards, 2026, 'FP1')['session'], 'FP1')

    def test_target_validation(self):
        for bad in [{'event': 'https://evil.test'}, {'event': 'Monza', 'year': True},
                    {'event': 'Monza', 'session': 'Sprint'}, {'event': 'Monza', 'url': TIMING}]:
            with self.subTest(bad=bad), self.assertRaises(DiscoveryError): request_target(bad)

    def test_only_timing_tables_are_returned(self):
        self.assertEqual(normalize_table(['Email', 'Password'], [['user', 'secret']]), [])
        self.assertEqual(normalize_table(['Driver', 'Lap', 'Lap'], [['A', '1', '2']]), [])
        self.assertEqual(normalize_table(['No.', 'Lap', 'Time'], [['007', '1', '1:40']])[0]['No.'], '007')

    def test_manager_deduplicates_active_job_and_latches_auth_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            manager = WECManager(temp)
            proc = Mock()
            proc.poll.return_value = None
            with patch('wec_runtime.subprocess.Popen', return_value=proc) as spawn:
                first = manager.request(TARGET)
                self.assertEqual(first['state'], 'discovering')
                self.assertTrue(manager.request(TARGET)['busy'])
                self.assertEqual(spawn.call_count, 1)
                proc.poll.return_value = 0
                save_result(manager.path, {'state': 'human_verification_required', 'live': False})
                self.assertTrue(manager.request(TARGET)['retry_requires_operator'])
                self.assertEqual(spawn.call_count, 1)

    def test_manager_returns_finished_result_without_restarting(self):
        with tempfile.TemporaryDirectory() as temp:
            manager = WECManager(temp)
            proc = Mock()
            proc.poll.return_value = 0
            with patch('wec_runtime.subprocess.Popen', return_value=proc) as spawn:
                manager.request(TARGET)
                save_result(manager.path, {'state': 'waiting_for_session', 'live': False})
                self.assertEqual(manager.request(TARGET)['state'], 'waiting_for_session')
                self.assertEqual(spawn.call_count, 1)


if __name__ == '__main__': unittest.main()

class WECTransportTests(unittest.TestCase):
    def test_collector_routes_remain_authenticated_and_validate_target(self):
        import threading
        import urllib.request
        import urllib.error
        import cloud
        manager = Mock()
        manager.request.return_value = {'state': 'discovering', 'live': False}
        manager.read.return_value = {'state': 'waiting_for_session', 'live': False}
        from http.server import ThreadingHTTPServer
        import os
        with patch.object(cloud, 'WEC', manager), patch.dict(os.environ, {'COLLECTOR_READ_KEY': 'x' * 32}):
            server = ThreadingHTTPServer(('127.0.0.1', 0), cloud.Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            root = 'http://127.0.0.1:' + str(server.server_port)
            try:
                with self.assertRaises(urllib.error.HTTPError) as e:
                    urllib.request.urlopen(root + '/wec/snapshot')
                self.assertEqual(e.exception.code, 401)
                headers = {'Authorization': 'Bearer ' + 'x' * 32, 'Content-Type': 'application/json'}
                req = urllib.request.Request(root + '/wec/discover', data=json.dumps(TARGET).encode(), headers=headers)
                with urllib.request.urlopen(req) as response:
                    self.assertEqual(response.status, 202)
                    self.assertEqual(json.load(response)['state'], 'discovering')
                manager.request.assert_called_once_with(TARGET)
                req = urllib.request.Request(root + '/wec/snapshot', headers=headers)
                with urllib.request.urlopen(req) as response:
                    self.assertEqual(json.load(response)['state'], 'waiting_for_session')
                manager.request.side_effect = DiscoveryError('invalid_target')
                with self.assertRaises(urllib.error.HTTPError) as e:
                    urllib.request.urlopen(urllib.request.Request(root + '/wec/discover', data=b'{"event":"https://evil.test"}', headers=headers))
                self.assertEqual(e.exception.code, 400)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)
