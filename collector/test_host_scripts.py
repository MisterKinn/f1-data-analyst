import re
import unittest
from pathlib import Path

HOST = Path(__file__).resolve().parent / 'host'


class WindowsScripts(unittest.TestCase):
    def test_env_reader_accepts_names_with_digits(self):
        script = (HOST / 'run-windows.ps1').read_text(encoding='utf-8')
        pattern = re.search(r"-match '([^']+)'", script).group(1)
        for line in ('F1_USERNAME=a@b.c', 'F1_PASSWORD=x=y', 'HOST_NAME=pc'):
            self.assertRegex(line, pattern)

    def test_downloads_hide_the_slow_progress_bar(self):
        for name in ('setup-windows.ps1', 'update-windows.ps1'):
            self.assertIn("$ProgressPreference = 'SilentlyContinue'", (HOST / name).read_text(encoding='utf-8'))


    def test_task_has_a_watchdog_trigger(self):
        setup = (HOST / 'setup-windows.ps1').read_text(encoding='utf-8')
        run = (HOST / 'run-windows.ps1').read_text(encoding='utf-8')
        self.assertIn('-RepetitionInterval (New-TimeSpan -Minutes 5)', setup)
        self.assertIn('Set-ScheduledTask', run)  # added to older installs on start


if __name__ == '__main__':
    unittest.main()
