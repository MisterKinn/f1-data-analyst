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
            self.assertTrue({'1_설치하기.cmd', '2_상태_확인.cmd', '3_제거하기.cmd', 'kit.ps1', 'Mac에서_설치하기.txt'} <= set(names))
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
        self.assertNotIn('-Role', script)
        self.assertIn("h.register()", script)

    def test_guides_match_the_kit(self):
        kit_dir = ROOT / 'collector' / 'host' / 'kit'
        windows = (kit_dir / '설치방법.txt').read_text(encoding='utf-8-sig')
        for name in ('1_설치하기', '2_상태_확인', '3_제거하기', 'Mac에서_설치하기'):
            self.assertIn(name, windows)
        self.assertNotIn('예비', windows)
        mac = (kit_dir / 'Mac에서_설치하기.txt').read_text(encoding='utf-8-sig')
        line = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/kit-mac.sh)" - '
        for action in ('install', 'check', 'uninstall'):
            self.assertIn(line + action + '\n', mac)
        self.assertTrue((ROOT / 'collector' / 'host' / 'kit-mac.sh').exists())


    def test_site_download_module_is_current(self):
        # Compare contents, not compressed bytes: zlib builds differ between machines.
        import base64, io, re
        def parts(text):
            zip_b64, ps1_b64 = re.findall(r'"([A-Za-z0-9+/=]+)"', text)
            with zipfile.ZipFile(io.BytesIO(base64.b64decode(zip_b64))) as archive:
                files = {n: archive.read(n) for n in archive.namelist()}
            return files, base64.b64decode(ps1_b64)
        current = (ROOT / 'worker' / 'collector-kit.js').read_text(encoding='utf-8')
        self.assertEqual(parts(current), parts(kit.site_module()), 'run: python scripts/build-host-kit.py --write-js')


if __name__ == '__main__':
    unittest.main()
