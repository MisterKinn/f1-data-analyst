"""Official turn numbers from OpenStreetMap (task A2 part 2, owner 2026-11-16: official corner numbers on every map).

  node scripts/sim/tracks/corner-candidates.mjs > /tmp/cand.json
  python3 scripts/sim/tracks/corner-numbers-osm.py <probe-out/pits dir> /tmp/cand.json [ids]  -> worker/lapsim/corner-numbers-data.js

A raceway way near the circuit (A5 probe, © OpenStreetMap contributors, ODbL) gives a turn number when
  - its ref is a turn number (Zolder: ref=T7), or
  - its name is in scripts/sim/data/tracks/corner-names.json, a hand-made table of the circuit's official numbering with a source
    for every track (the circuit's own map or the series' event documents).
The way is moved into our map frame (rigid fit of our midline onto the raceway ways, start pose from osm-fit-start.json), its middle
goes to the nearest point of our lap, and that snaps to our own bend peak (corner-candidates.mjs) within SNAP_M, each peak once.
Kept only when every number of the official list is placed and the numbers run once round the lap in order. Existing entries in
corner-numbers-data.js (Commons maps) are kept.
"""
import json, math, os, re, subprocess, sys
import numpy as np
from scipy.spatial import cKDTree

D, CAND = sys.argv[1], json.load(open(sys.argv[2])); ONLY = sys.argv[3:]
R = 6371008.8; SNAP_M = 70; FIT_MAX_M = 6
COUNTS = (lambda c: c.get('tracks', c))(json.load(open('scripts/sim/data/tracks/corner-counts.json')))
NAMES = json.load(open('scripts/sim/data/tracks/corner-names.json'))
START = json.load(open('scripts/sim/data/tracks/osm-fit-start.json'))
SEED_ID = {'valencia-ricardo-tormo': 'ricardo-tormo'}
FILES = {}
for f in sorted(os.listdir(D)):
    if f.endswith('.json'): FILES.setdefault(SEED_ID.get(f[:-5], f[:-5]), f)
ids = [i for i in (ONLY or sorted(FILES)) if i in FILES and i in CAND and CAND[i]]
dump = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js';
const o = {}; for (const id of process.argv.slice(1)) { const L = lineData(id, {shape: false}); if (L) o[id] = L.mid; } console.log(JSON.stringify(o));''', *ids],
  capture_output=True, text=True, check=True).stdout
RAW = json.loads(dump)
ON_LAP_M, SECTION_M = 15, 600
NOT_CORNER = re.compile(r'pit|box|circuit|circuito|course|kart|paddock|raceway|\\bring\\b|ring$|straight|gerade|recta|rettilineo|drag|oval|speedway|track|layout|long lap|anbindung|shortcut|rallycross|skid|traguardo|start|finish|meta|variante 24h|strecke|e-prix|descida|subida|^fe$|^\\d+$|コース|サーキット|オートポリス|코스|레인|피트|เซอร์กิต|دبي|حلبة', re.I)
NAMES_OUT = {}
REF = re.compile(r'^T(?:urn)?\s*(\d{1,2})([a-z]?)$', re.I)

def local(seed, g):
    la, lo = seed; c = math.cos(math.radians(la)); g = np.array(g, float)
    return np.c_[(g[:, 1] - lo) * math.pi / 180 * R * c, (g[:, 0] - la) * math.pi / 180 * R]
def dens(g, st=2.0):
    P = [g[0]]
    for a, b in zip(g[:-1], g[1:]):
        k = max(1, int(np.ceil(np.hypot(*(b - a)) / st))); P += list(a + (b - a) * (np.arange(1, k + 1)[:, None] / k))
    return np.array(P)
def icp(S, T, tr, Rm, t, it):
    for _ in range(it):
        X = S @ Rm.T + t; d, j = tr.query(X); w = d <= np.quantile(d, 0.9); A, B = S[w], T[j[w]]; ma, mb = A.mean(0), B.mean(0)
        U, _, Vt = np.linalg.svd((A - ma).T @ (B - mb)); Dg = np.eye(2); Dg[1, 1] = np.sign(np.linalg.det(Vt.T @ U.T)); Rm = Vt.T @ Dg @ U.T
        t = mb - ma @ Rm.T
    return tr.query(S @ Rm.T + t)[0], Rm, t

src = open('worker/lapsim/corner-numbers-data.js').read()
data = json.loads(src[src.index('= ') + 2:].rstrip().rstrip(';'))
report = []
for id in ids:
    o = json.load(open(f'{D}/{FILES[id]}')); table = NAMES.get(id, {}); names = table.get('turns', {})
    race = [w for w in o['ways'] if w['tags'].get('highway') == 'raceway' and len(w['g']) > 1]
    lab = []
    for w in race:
        t = w['tags']; m = REF.match(str(t.get('ref', '')).strip())
        num = (int(m.group(1)), m.group(2).lower()) if m else None
        if not num and t.get('name') in names: v = str(names[t['name']]); mm = re.match(r'(\d+)([a-z]?)$', v); num = (int(mm.group(1)), mm.group(2))
        if num: lab.append((num, local(o['seed'], w['g'])))
    named = [w for w in race if w['tags'].get('name') and not NOT_CORNER.search(w['tags']['name'])]
    if not lab and not named: continue
    if id not in START: report.append(f'{id}: no start pose'); continue
    T = np.vstack([dens(local(o['seed'], w['g'])) for w in race]); tr = cKDTree(T)
    M = np.array(RAW[id]); cM = M.mean(0); S = M - cM; th = START[id]['th']
    d, Rm, t = icp(S, T, tr, np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]]), np.array(START[id]['T']), 30)
    med = float(np.median(d))
    if med > FIT_MAX_M: report.append(f'{id}: our line does not fit OSM (median {med:.1f} m)'); continue
    X = S @ Rm.T + t; trX = cKDTree(X); n = len(M); L = CAND[id]['length']; cand = CAND[id]['candidates']; used = set(); out = []
    # official corner names (owner 2026-11-17: names where the circuit has no official numbering): a named way on our lap (every
    # point within ON_LAP_M), shorter than SECTION_M along the lap, placed at our tightest bend inside it (else its middle)
    nm = {}
    for w in named:
        P = dens(local(o['seed'], w['g'])); gaps, ii = trX.query(P)
        if gaps.max() > ON_LAP_M: continue
        ss = np.sort(ii / n * L); span = ss[-1] - ss[0]
        if span > L / 2: ss = np.sort((ss + L / 2) % L); span = ss[-1] - ss[0]; ss = (ss - L / 2) % L
        if span > SECTION_M: continue
        a, b = float(ss.min()), float(ss.max()); inside = [c for c in cand if (a - 20) <= c['s'] <= (b + 20)]
        sx = max(inside, key=lambda c: c['turnDeg'])['s'] if inside else int(round(float(np.median(ss))))
        nm.setdefault(w['tags']['name'], []).append((int(sx), abs(float(np.median(ss)) - sx)))
    if nm: NAMES_OUT[id] = {'source': 'OpenStreetMap corner names on the raceway ways (© OpenStreetMap contributors, ODbL)', 'osmFitM': round(med, 1),
                            'names': sorted(({'name': k, 's': min(v)[0]} for k, v in nm.items() if min(v)[1] == min(q[1] for kk, vv in nm.items() for q in vv if min(vv)[0] == min(v)[0])), key=lambda x: x['s'])}   # two names on one bend: the way centred on it
    if not lab: report.append(f"{id}: names {len(nm)}: " + ', '.join(f"{x['name']}@{x['s']}" for x in NAMES_OUT.get(id, {}).get('names', []))); continue
    for (num, let), g in sorted(lab, key=lambda x: x[0]):
        if any(c['number'] == num and c['letter'] == let for c in out): continue   # a turn split over several ways: first one
        P = dens(g); mid = P[len(P) // 2]; gap, i = trX.query(mid); s = i / n * L
        near = min((c for c in cand if c['s'] not in used), key=lambda c: min(abs(c['s'] - s), L - abs(c['s'] - s)), default=None)
        snap = near is not None and min(abs(near['s'] - s), L - abs(near['s'] - s)) <= SNAP_M
        if snap: used.add(near['s'])
        out.append({'number': num, 'letter': let, 's': int(near['s'] if snap else round(s)), 'snap': bool(snap), 'wayGapM': round(float(gap), 1)})
    want = table.get('count') or COUNTS.get(id, {}).get('turns')   # the official count (corner-counts.json) must match, else names only nums = sorted({c['number'] for c in out})
    full = (want is None and nums == list(range(1, max(nums) + 1))) or (want is not None and len(nums) == want and nums == list(range(1, want + 1)))
    ss = [c['s'] for c in sorted(out, key=lambda c: (c['number'], c['letter']))]; k0 = ss.index(min(ss)); order = ss[k0:] + ss[:k0]
    inorder = all(order[j] < order[j + 1] for j in range(len(order) - 1))
    line = f"{id}: fit {med:.1f} m, {len(nums)} turns, complete {full}, lap order {inorder}, snapped {sum(c['snap'] for c in out)}/{len(out)} | " + ' '.join(f"T{c['number']}{c['letter']}:{c['s']}" for c in sorted(out, key=lambda c: (c['number'], c['letter'])))
    report.append(line)
    if full and inorder:
        data[id] = {'source': table.get('source') or 'OpenStreetMap ref tags on the raceway ways (© OpenStreetMap contributors, ODbL)', 'osmFitM': round(med, 1),
                    'corners': [{'number': c['number'], 'letter': c['letter'], 's': c['s']} for c in sorted(out, key=lambda c: (c['number'], c['letter']))]}
head = src[:src.index('export const lapsimCornerNumbers')]
open('worker/lapsim/corner-numbers-data.js', 'w').write(head + 'export const lapsimCornerNumbers = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
open('worker/lapsim/corner-names-data.js', 'w').write('// Generated by scripts/sim/tracks/corner-numbers-osm.py. Official corner names for tracks without an official numbering:\n'
    '// OpenStreetMap raceway ways named after a corner, placed on our lap (© OpenStreetMap contributors, ODbL). Do not edit by hand.\n'
    'export const lapsimCornerNames = ' + json.dumps(NAMES_OUT, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('\n'.join(report))
