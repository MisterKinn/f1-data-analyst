import asyncio
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from kongboda_bot import ask, config, fia_docs, live, notifier, schedule
from kongboda_bot.state import State


def payload(connected=True, age=5, status='Started'):
    return {'snapshot': {
        'connected': connected, 'feed_age_seconds': age,
        'topics': {
            'SessionInfo': {'Key': 9, 'StartDate': '2026-10-31T15:00:00', 'Meeting': {'Name': 'Mexico City GP'}, 'Name': 'Qualifying'},
            'SessionStatus': {'Status': status},
            'DriverList': {'1': {'Tla': 'VER'}, '4': {'Tla': 'NOR'}},
            'TimingData': {'Lines': {
                '4': {'Position': '2', 'BestLapTime': {'Value': '1:15.900'}, 'LastLapTime': {'Value': '1:16.100'}, 'IntervalToPositionAhead': {'Value': '+0.123'}},
                '1': {'Position': '1', 'BestLapTime': {'Value': '1:15.777'}, 'LastLapTime': {'Value': '1:15.900'}}}},
            'TimingAppData': {'Lines': {'1': {'Stints': {'0': {'Compound': 'SOFT', 'TotalLaps': 3}}}}},
        }}}


class LiveTests(unittest.TestCase):
    def test_orders_by_position_and_labels_live(self):
        text = live.summarize(payload())
        self.assertIn('🟢 라이브', text)
        self.assertLess(text.index('VER'), text.index('NOR'))
        self.assertIn('S3', text)

    def test_stale_or_disconnected_is_never_live(self):
        self.assertFalse(live.freshness(payload(age=300))[0])
        self.assertFalse(live.freshness(payload(connected=False))[0])
        self.assertIn('라이브 아님', live.summarize(payload(connected=False)))
        self.assertFalse(live.freshness({})[0])

    def test_session_end_detection(self):
        self.assertIsNone(live.detect_session_end(payload()))
        self.assertIsNotNone(live.detect_session_end(payload(status='Finalised')))


class NotifierTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.state = State(Path(self.dir.name) / 's.json')
        start = datetime(2026, 11, 6, 12, 30, tzinfo=timezone(timedelta(hours=-3)))
        self.session = schedule.Session('f1-2026-11-06-interlagos', 'f1', 'FP1', start, '')

    def tearDown(self):
        self.dir.cleanup()

    def test_start_window_and_dedup(self):
        s = self.session
        self.assertEqual(notifier.due_start_alerts([s], s.start - timedelta(minutes=30), self.state), [])
        self.assertEqual(notifier.due_start_alerts([s], s.start - timedelta(minutes=9), self.state), [s])
        self.state.mark('start', s.uid)
        self.assertEqual(notifier.due_start_alerts([s], s.start, self.state), [])
        self.assertEqual(notifier.due_start_alerts([s], s.start + timedelta(minutes=45), State(Path(self.dir.name) / 'x.json')), [])

    def test_dedup_survives_restart(self):
        self.state.mark('end', 'k')
        self.assertTrue(State(Path(self.dir.name) / 's.json').seen('end', 'k'))

    def test_state_creates_parent_and_persists_watcher_baseline(self):
        nested = State(Path(self.dir.name) / 'nested' / 's.json')
        self.assertFalse(nested.initialized('fia'))
        nested.initialize('fia')
        self.assertTrue(State(nested.path).initialized('fia'))

    def test_end_alert_once(self):
        p = payload(status='Finalised')
        first = notifier.due_end_alert(p, self.state)
        self.assertIsNotNone(first)
        self.state.mark('end', first[0])
        self.assertIsNone(notifier.due_end_alert(p, self.state))


class ScheduleTests(unittest.TestCase):
    def test_load_and_series(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'schedule.json'
            path.write_text(json.dumps({'gtwc-asia-2026-10-30-shanghai': [
                {'name': '레이스 1', 'start': '2026-10-31T12:50:00+08:00', 'source': 'x'}]}))
            sessions = schedule.load(path)
            self.assertEqual(sessions[0].series, 'gtwc-asia')
            self.assertIn('KST', schedule.format_kst(sessions[0].start))

    def test_missing_file_explains_fix(self):
        with self.assertRaises(FileNotFoundError):
            schedule.load(Path('/nonexistent/schedule.json'))


DOC_HTML = '''
<li class="document-row"><a href="/sites/default/files/doc1.pdf"><div class="title">Doc 31 - Power Unit Elements Used</div></a><div class="published">31-10-26 10:00</div></li>
<li class="document-row"><a href="https://evil.example/x.pdf"><div class="title">Doc 32 - Decision</div></a></li>
<li class="document-row"><a href="/f/doc3.pdf"><div class="title">Doc 33 - Event Timetable</div></a></li>
<li class="document-row"><a href="/f/doc4.pdf"><div class="title">Doc 34 - Decision - Car 4 Infringement</div></a></li>
<li class="document-row"><a href="/f/doc5.pdf"><div class="title">Doc 35 - Recalled Decision</div></a></li>
'''


class FiaTests(unittest.TestCase):
    def test_parse_rejects_non_fia_hosts(self):
        docs = fia_docs.parse_documents(DOC_HTML, 'https://www.fia.com/documents/x')
        self.assertEqual([d.number for d in docs], ['31', '33', '34', '35'])
        self.assertTrue(docs[-1].recalled)

    def test_pu_title_alone_is_not_confirmed(self):
        pu = fia_docs.parse_documents(DOC_HTML, 'https://www.fia.com/')[0]
        self.assertIsNone(fia_docs.select_reason(pu))
        self.assertEqual(fia_docs.select_reason(pu, 'Driver 4 exceeded allocation; grid penalty applies'), '부품 교체·그리드 영향')
        self.assertEqual(fia_docs.select_reason(pu, 'Element usage listing per driver'), '부품 교체·그리드 영향')
        self.assertIsNone(fia_docs.select_reason(pu, 'Administrative notice with no component content'))

    def test_steward_decision_selected_timetable_and_recalled_excluded(self):
        docs = {d.number: d for d in fia_docs.parse_documents(DOC_HTML, 'https://www.fia.com/')}
        self.assertEqual(fia_docs.select_reason(docs['34']), '스튜어드 결정')
        self.assertIsNone(fia_docs.select_reason(docs['33']))
        self.assertIsNone(fia_docs.select_reason(docs['35']))

    def test_official_url_guard(self):
        for bad in ('http://www.fia.com/a', 'https://fia.com.evil.io/a', 'https://user@www.fia.com/a'):
            with self.assertRaises(ValueError):
                fia_docs.official_url(bad)

    def test_alert_text_never_claims_unread_body(self):
        doc = fia_docs.parse_documents(DOC_HTML, 'https://www.fia.com/')[2]
        self.assertIn('본문을 읽지 못했습니다', fia_docs.alert_text(doc, '스튜어드 결정', False, 'invented'))
        self.assertNotIn('invented', fia_docs.alert_text(doc, '스튜어드 결정', False, 'invented'))

    def test_first_successful_document_list_becomes_baseline(self):
        class StubState:
            def __init__(self): self.keys = set(); self.ready = False
            def initialized(self, bucket): return self.ready
            def initialize(self, bucket): self.ready = True
            def seen(self, bucket, key): return key in self.keys
            def mark(self, bucket, key): self.keys.add(key)
        async def fake_latest(*_):
            return 'Mexico City GP', fia_docs.parse_documents(DOC_HTML, 'https://www.fia.com/')
        original = fia_docs.latest_event_documents
        state = StubState()
        try:
            fia_docs.latest_event_documents = fake_latest
            async def collect(): return [item async for item in fia_docs.check_new(None, state, 2026)]
            self.assertEqual(asyncio.run(collect()), [])
            self.assertTrue(state.ready)
            self.assertEqual(len(state.keys), 4)
        finally:
            fia_docs.latest_event_documents = original

    def test_document_pipeline_records_utc_stages_without_guessing_fia_timezone(self):
        decision = fia_docs.parse_documents(DOC_HTML, 'https://www.fia.com/')[2]
        class StubState:
            def initialized(self, _): return True
            def seen(self, *_): return False
            def mark(self, *_): pass
        async def fake_latest(*_): return 'Mexico City GP', [decision]
        async def fake_fetch(*_): return b'%PDF-body', 'application/pdf'
        original_latest, original_fetch, original_pdf = fia_docs.latest_event_documents, fia_docs._fetch, fia_docs.pdf_text
        try:
            fia_docs.latest_event_documents, fia_docs._fetch = fake_latest, fake_fetch
            fia_docs.pdf_text = lambda _: 'Decision infringement penalty'
            async def collect(): return [item async for item in fia_docs.check_new(None, StubState(), 2026)]
            item = asyncio.run(collect())[0]
            timing = item[4]
            self.assertEqual(timing['published_raw'], decision.published)
            self.assertEqual(timing['published_timezone'], 'unspecified_by_fia_listing')
            self.assertTrue(timing['detected_at'].endswith('+00:00'))
            self.assertTrue(timing['body_read_at'].endswith('+00:00'))
        finally:
            fia_docs.latest_event_documents, fia_docs._fetch, fia_docs.pdf_text = original_latest, original_fetch, original_pdf


class FakeCollector:
    async def snapshot(self):
        return payload()

    async def standings(self, kind):
        return {'categories': [{'rows': [{'position': 1, 'name': 'X', 'points': 10}]}]}


class AskToolTests(unittest.TestCase):
    def test_tools_dispatch(self):
        sessions = []
        out = asyncio.run(ask.run_tool('live_snapshot', {}, FakeCollector(), sessions))
        self.assertIn('VER', out)
        self.assertIn('등록된 세션이 없습니다', asyncio.run(ask.run_tool('upcoming_sessions', {'days': 3}, FakeCollector(), sessions)))
        self.assertIn('알 수 없는', asyncio.run(ask.run_tool('nope', {}, FakeCollector(), sessions)))


class ConfigTests(unittest.TestCase):
    def test_requires_https_and_long_key(self):
        import os
        base = {'DISCORD_TOKEN': 't', 'DISCORD_OWNER_ID': '1', 'COLLECTOR_URL': 'https://c.example', 'COLLECTOR_READ_KEY': 'k' * 32}
        saved = dict(os.environ)
        try:
            self.assertEqual(config.load(base).owner_id, 1)
            for patch in ({'COLLECTOR_URL': 'http://c.example'}, {'COLLECTOR_URL': 'https://c.example/path'},
                          {'COLLECTOR_URL': 'https://user@c.example'}, {'COLLECTOR_READ_KEY': 'short'},
                          {'DISCORD_OWNER_ID': 'abc'}, {'DISCORD_OWNER_ID': '0'}):
                with self.assertRaises(config.ConfigError):
                    config.load({**base, **patch})
        finally:
            os.environ.clear()
            os.environ.update(saved)


if __name__ == '__main__':
    unittest.main()
