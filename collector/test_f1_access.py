import os
import tempfile
import unittest

os.environ.setdefault('DATA_DIR', tempfile.mkdtemp())
import host_runner  # noqa: E402


class F1AccessTest(unittest.TestCase):
    def setUp(self):
        host_runner.F1_ACCESS.update(blocked=None, at=None)

    def test_403_is_blocked_and_reported(self):
        self.assertTrue(host_runner.check_f1_access(force=True, fetch=lambda: (403, 'Error from cloudfront')))
        self.assertEqual(host_runner.access_fields(), {'f1_blocked': True})

    def test_401_is_reachable(self):
        self.assertFalse(host_runner.check_f1_access(force=True, fetch=lambda: (401, 'FunctionGeneratedResponse from cloudfront')))
        self.assertEqual(host_runner.access_fields(), {})

    def test_network_error_keeps_last_answer(self):
        host_runner.check_f1_access(force=True, fetch=lambda: (403, None))
        self.assertTrue(host_runner.check_f1_access(force=True, fetch=lambda: ('URLError', None)))

    def test_cached_between_checks(self):
        host_runner.check_f1_access(force=True, fetch=lambda: (401, None))
        self.assertFalse(host_runner.check_f1_access(fetch=lambda: (403, None)))


if __name__ == '__main__':
    unittest.main()
