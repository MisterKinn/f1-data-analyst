import subprocess
import unittest
from unittest.mock import Mock, patch
from wec_install import BrowserSetupError, browser_environment, ensure_browser


class BrowserSetupTests(unittest.TestCase):
    @patch('wec_install.version', return_value='1.64.1')
    @patch('wec_install.probe', return_value='ready')
    @patch('wec_install.subprocess.run')
    def test_existing_browser_never_downloads(self, run, probe, version):
        self.assertEqual(ensure_browser(), 'ready')
        run.assert_not_called()

    @patch('wec_install.version', return_value='1.64.1')
    @patch('wec_install.probe', side_effect=['browser_missing', 'ready'])
    @patch('wec_install.subprocess.run', return_value=Mock(returncode=0))
    def test_missing_browser_installs_then_rechecks(self, run, probe, version):
        self.assertEqual(ensure_browser(), 'ready')
        self.assertEqual(probe.call_count, 2)
        self.assertEqual(run.call_args.args[0][-3:], ['install', '--only-shell', 'chromium'])
        self.assertEqual(run.call_args.kwargs['timeout'], 300)

    @patch('wec_install.version', return_value='1.64.1')
    @patch('wec_install.probe', return_value='system_dependencies_missing:libexample.so.1')
    @patch('wec_install.subprocess.run')
    def test_os_dependencies_block_rollout_without_download_loop(self, run, probe, version):
        with self.assertRaisesRegex(BrowserSetupError, 'system_dependencies_missing'):
            ensure_browser()
        run.assert_not_called()

    @patch('wec_install.version', return_value='1.64.1')
    @patch('wec_install.probe', return_value='browser_missing')
    @patch('wec_install.subprocess.run', side_effect=subprocess.TimeoutExpired('install', 300))
    def test_install_timeout_fails_closed(self, run, probe, version):
        with self.assertRaisesRegex(BrowserSetupError, 'browser_download_timeout'):
            ensure_browser()

    def test_setup_never_receives_account_secrets(self):
        with patch.dict('os.environ', {'WEC_PASSWORD':'private', 'F1_PASSWORD':'private',
                                      'COLLECTOR_READ_KEY':'private', 'HOME':'/tmp'}):
            env=browser_environment()
        self.assertFalse({'WEC_PASSWORD','F1_PASSWORD','COLLECTOR_READ_KEY'} & env.keys())
