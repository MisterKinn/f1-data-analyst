# One row per (session, setup field) from the CarSetup YAML of every core .ibt of the SRS 26S4 pack (header + YAML only, no telemetry).
# Runs on the owner's PC (raw files stay there):  python setup_table.py [root]  ->  <root>/results/tables/setup_by_session.csv
# Derived numbers only go into git (model (iRacing)).
import csv, glob, os, re, struct, sys
import yaml

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(os.path.join('~', 'Documents', 'iRacing_SRS'))
OUT = os.path.join(ROOT, 'results', 'tables', 'setup_by_session.csv')


def flat(d, p=''):
    out = {}
    if isinstance(d, dict):
        for k, v in d.items(): out.update(flat(v, f'{p}/{k}' if p else k))
    else: out[p] = d
    return out


def num(v):
    m = re.match(r'\s*([-+]?\d+(?:\.\d+)?)\s*(\S*)', str(v))
    return (float(m.group(1)), m.group(2)) if m and ',' not in str(v) else (None, '')


rows = []
files = sorted(glob.glob(os.path.join(ROOT, 'core', '*', '*', '*.ibt')))
for f in files:
    with open(f, 'rb') as h:
        silen, sioff = struct.unpack_from('<ii', h.read(144), 16)  # irsdk header: session-info length and offset
        h.seek(sioff); y = yaml.safe_load(h.read(silen).split(b'\0')[0].decode('latin-1').replace('\t', ' '))
    di = y['DriverInfo']; me = next(d for d in di['Drivers'] if d['CarIdx'] == di['DriverCarIdx']); wi = y['WeekendInfo']
    base = {'file': os.path.basename(f), 'cls': os.path.relpath(f, ROOT).split(os.sep)[1], 'car': me.get('CarScreenName'), 'track': wi.get('TrackName'),
            'config': wi.get('TrackConfigName'), 'sessions': '|'.join(str(s.get('SessionType')) for s in y.get('SessionInfo', {}).get('Sessions', [])),
            'fuel_max_l': di.get('DriverCarFuelMaxLtr'), 'track_temp': wi.get('TrackSurfaceTemp')}
    for k, v in flat(y.get('CarSetup') or {}).items():
        x, u = num(v); rows.append({**base, 'key': k, 'raw': str(v), 'num': x, 'unit': u})
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', newline='', encoding='utf-8') as o:
    w = csv.DictWriter(o, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
print('files', len(files), 'rows', len(rows), '->', OUT)
