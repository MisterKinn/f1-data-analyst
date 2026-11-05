"""Build the Windows collector-host setup kit (zip) from collector/host/kit.

Windows PowerShell 5.1 and older Notepad need a UTF-8 BOM to show Korean text, and
.cmd files need CRLF, so both are normalized here. Usage:
    python scripts/build-host-kit.py [output.zip]
"""
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / 'collector' / 'host' / 'kit'
FOLDER = 'kongboda-collector-setup'


def normalized(path):
    text = path.read_text(encoding='utf-8-sig').replace('\r\n', '\n').replace('\n', '\r\n')
    data = text.encode('utf-8')
    return data if path.suffix == '.cmd' else b'\xef\xbb\xbf' + data


def build(out):
    files = sorted(p for p in KIT.iterdir() if p.is_file())
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            entry = zipfile.ZipInfo(f'{FOLDER}/{path.name}', date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, normalized(path))
    return [p.name for p in files]


if __name__ == '__main__':
    target = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'dist' / 'kongboda-collector-setup.zip')
    target.parent.mkdir(parents=True, exist_ok=True)
    print('Built', target, build(target))
