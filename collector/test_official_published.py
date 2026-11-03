import unittest
from official_published import checked_url

class OfficialSourceTests(unittest.TestCase):
    def test_allowlist(self):
        for url in ['https://elms.alkamelsystems.com/Results/a.pdf', 'https://imsa.results.alkamelcloud.com/?season=26_2026', 'https://files.alkamelcloud.com/alms/manifests/results.json', 'https://www.nuerburgring-langstrecken-serie.de/language/en/point-standings/']:
            self.assertEqual(checked_url(url), url)
        for url in ['http://elms.alkamelsystems.com/', 'https://user:secret@elms.alkamelsystems.com/', 'https://files.alkamelcloud.com/private/a.pdf', 'https://elms.alkamelsystems.com/Results/%2e%2e/private.pdf', 'https://elms.alkamelsystems.com/Results/a.pdf#x', 'https://www.nuerburgring-langstrecken-serie.de/wp-admin/']:
            with self.assertRaises(ValueError): checked_url(url)
