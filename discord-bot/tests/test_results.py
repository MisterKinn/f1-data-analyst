import unittest
from kongboda_bot import results


class ResultDisplayTests(unittest.TestCase):
    def test_large_championship_preserves_every_row_and_message_limit(self):
        data = {'series': 'wec', 'season': 2026, 'round': 6, 'classification': 'PROVISIONAL',
                'source': 'https://example.com/official.pdf', 'retrieved_at': '2026-11-03T09:00:00Z',
                'categories': [{'id': 'drivers', 'rows': [
                    {'position': i, 'name': f'Driver-{i:03}-' + 'X' * 70, 'points': 200-i} for i in range(1, 141)]}]}
        pages = results.standings_pages(data)
        self.assertGreater(len(pages), 1)
        self.assertTrue(all(len(page) <= 1900 for page in pages))
        for i in range(1, 141):
            self.assertIn(f'Driver-{i:03}-', '\n'.join(pages))
        self.assertTrue(all('PROVISIONAL' in page and 'official.pdf' in page for page in pages))

    def test_pending_and_unavailable_never_become_published_results(self):
        for state in ('pending', 'unavailable'):
            text = '\n'.join(results.session_pages({'state': state, 'rows': [{'position': 1, 'code': 'FAKE'}]}))
            self.assertNotIn('FAKE', text)

    def test_qualifying_missing_times_and_classification_are_visible(self):
        text = '\n'.join(results.session_pages({'state': 'ready', 'session': 'Q', 'season': 2026,
             'round': 1, 'event': 'Test GP', 'rows': [{'position': 11, 'code': 'AAA', 'q1': 89.5, 'q3': None, 'classified': 'N'}]}))
        self.assertIn('11. AAA', text)
        self.assertIn('Q1 1:29.500', text)
        self.assertIn('Q3 —', text)
        self.assertIn('분류 N', text)

    def test_mentions_and_stale_cache_are_not_hidden(self):
        text = '\n'.join(results.standings_pages({'stale': True, 'categories': [
            {'id': 'drivers', 'rows': [{'name': '@everyone\n```', 'position': 1, 'points': 10}]}]}))
        self.assertNotIn('@everyone', text)
        self.assertNotIn('```', text)
        self.assertIn('오래된 저장 기록', text)

    def test_millisecond_rounding_rolls_over_at_minute(self):
        self.assertEqual(results.seconds(59.9999), '1:00.000')
        self.assertEqual(results.seconds(float('nan')), '—')
