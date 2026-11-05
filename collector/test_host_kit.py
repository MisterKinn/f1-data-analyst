import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_host_kit', ROOT / 'scripts' / 'build-host-kit.py')
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)


class HostKit(unittest.TestCase):
    def test_zip_has_guide_launchers_and_bom(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / 'kit.zip'
            names = kit.build(out)
            self.assertIn('설치방법.txt', names)
            self.assertTrue({'1_설치하기.cmd', '2_예비_PC로_설치하기.cmd', '3_상태_확인.cmd', '4_제거하기.cmd', 'kit.ps1'} <= set(names))
            with zipfile.ZipFile(out) as archive:
                guide = archive.read('kongboda-collector-setup/설치방법.txt')
                script = archive.read('kongboda-collector-setup/kit.ps1')
                launcher = archive.read('kongboda-collector-setup/1_설치하기.cmd')
            self.assertTrue(guide.startswith(b'\xef\xbb\xbf') and script.startswith(b'\xef\xbb\xbf'))
            self.assertIn(b'\r\n', launcher)
            self.assertNotIn(b'\xef\xbb\xbf', launcher)
            self.assertIn(b'kit.ps1', launcher)

    def test_kit_uses_the_setup_from_main(self):
        script = (ROOT / 'collector' / 'host' / 'kit' / 'kit.ps1').read_text(encoding='utf-8')
        self.assertIn('main/collector/host/setup-windows.ps1', script)
        self.assertIn('-Role $Role', script)


if __name__ == '__main__':
    unittest.main()
