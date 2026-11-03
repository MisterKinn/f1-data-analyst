import base64
import gzip
import unittest
from unittest.mock import patch
from wec_published import checked_url, published_file, MAX_BYTES


class Reply:
    status_code = 200
    headers = {}
    def __init__(self, data=b'{"type":"seasons_index"}'):
        self.data = data
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def raise_for_status(self):
        pass
    def iter_content(self, size):
        yield self.data


class PublishedTests(unittest.TestCase):
    url = 'https://files.alkamelcloud.com/wec/manifests/results.json'

    def test_source_restrictions(self):
        self.assertEqual(checked_url(self.url), self.url)
        for value in ['http://files.alkamelcloud.com/wec/manifests/results.json',
                      'https://evil.test/wec/manifests/results.json',
                      'https://user:secret@files.alkamelcloud.com/wec/manifests/results.json',
                      'https://files.alkamelcloud.com/wec/results/%2e%2e/private.pdf']:
            with self.assertRaises(ValueError):
                checked_url(value)

    def test_transfer_and_source_provenance(self):
        with patch('wec_published.requests.get', return_value=Reply()):
            result = published_file(self.url)
        self.assertEqual(result['url'], self.url)
        self.assertEqual(gzip.decompress(base64.b64decode(result['gzip_base64'])), Reply().data)

    def test_reject_html_large_files_and_unapproved_redirect(self):
        for data in [b'<!doctype html><title>App</title>', b'x' * (MAX_BYTES + 1)]:
            with patch('wec_published.requests.get', return_value=Reply(data)):
                with self.assertRaises(ValueError):
                    published_file(self.url)
        redirect = Reply()
        redirect.status_code = 302
        redirect.headers = {'Location': 'https://evil.test/file.pdf'}
        with patch('wec_published.requests.get', return_value=redirect):
            with self.assertRaises(ValueError):
                published_file(self.url)
