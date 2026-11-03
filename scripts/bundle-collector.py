"""Build the allowlisted download deterministically; never include auth/output."""
import base64
import io
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in ('collector.py', 'lap_archive.py', 'telemetry.py', 'recovery.py', 'diagnostics.py', 'requirements.txt', 'START_WINDOWS.cmd', 'README_KO.txt'):
        data = (root / 'collector' / name).read_bytes()
        if name.endswith('.cmd'):
            data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        entry = zipfile.ZipInfo('FastF1-Live/' + name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(entry, data)
encoded = base64.b64encode(buf.getvalue()).decode('ascii')
(root / 'worker' / 'collector_bundle.js').write_text(
    "export const COLLECTOR_ZIP = '" + encoded + "';\n", encoding='utf-8')
print(f'Bundled 8 collector files: {len(buf.getvalue())} bytes')
