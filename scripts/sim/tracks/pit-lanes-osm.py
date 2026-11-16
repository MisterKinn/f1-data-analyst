# Pit lanes for the track maps (task A5, owner 2026-11-16: "add the pit lane on every track").
#   python3 scripts/sim/tracks/pit-lanes-osm.py <dir of OSM json per track>   -> worker/lapsim/pit-lane-data.js
# Input: OpenStreetMap ways near each circuit (highway=raceway, service=pit*, ways named pit/box), fetched in GitHub Actions
# (branch probe/osm-pits; © OpenStreetMap contributors, ODbL). Our drawn midline (lineData) is fitted (rigid, trimmed ICP, many starts)
# onto the raceway ways; the pit ways are moved into our map frame, chained into one path, and both ends are placed on our lap.
# Kept only when both ends meet the track within END_MAX_M and the length is plausible. Drawing and pit-lane length only.
import json, math, os, re, subprocess, sys
import numpy as np
from scipy.spatial import cKDTree

D = sys.argv[1]; R = 6371008.8; END_MAX_M = 35
PIT = re.compile(r'pit|box', re.I)
SEED_ID = {'valencia-ricardo-tormo': 'ricardo-tormo'}   # probe seeds named after the track request
FILES = {}
for f in sorted(os.listdir(D)):
    if f.endswith('.json'): FILES.setdefault(SEED_ID.get(f[:-5], f[:-5]), f)   # a track's own seed wins
ids = sorted(FILES)
dump = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
const o = {}; for (const id of process.argv.slice(1)) { if (!T[id]) continue; const L = lineData(id), Lr = lineData(id, {shape: false}); if (L) o[id] = {mid: L.mid, raw: [0, 1].map(c => Lr.mid.reduce((s, p) => s + p[c], 0) / Lr.mid.length), len: T[id].length}; } console.log(JSON.stringify(o));''', *ids],
  capture_output=True, text=True, check=True).stdout
MID = json.loads(dump)
RAWC = {k: np.array(v['raw']) for k, v in MID.items()}
START = json.load(open('scripts/sim/data/tracks/osm-fit-start.json')) if os.path.exists('scripts/sim/data/tracks/osm-fit-start.json') else {}

def is_pit(w):
    t = w['tags']; s = ' '.join(str(t.get(k, '')) for k in ('name', 'service', 'raceway', 'name:en'))
    return bool(PIT.search(s)) and not re.search(r'garage|paddock', t.get('name', ''), re.I)
def local(seed, g):
    la, lo = seed; c = math.cos(math.radians(la)); g = np.array(g, float)
    return np.c_[(g[:, 1] - lo) * math.pi / 180 * R * c, (g[:, 0] - la) * math.pi / 180 * R]
def dens(g, st=2.0):
    P = [g[0]]
    for a, b in zip(g[:-1], g[1:]):
        k = max(1, int(np.ceil(np.hypot(*(b - a)) / st))); P += list(a + (b - a) * (np.arange(1, k + 1)[:, None] / k))
    return np.array(P)
def icp(S, T, tr, Rm, t, it, trim=0.8):
    for _ in range(it):
        X = S @ Rm.T + t; d, j = tr.query(X); w = d <= np.quantile(d, trim); A, B = X[w], T[j[w]]; ma, mb = A.mean(0), B.mean(0)
        U, _, Vt = np.linalg.svd((A - ma).T @ (B - mb)); Q = Vt.T @ U.T
        if np.linalg.det(Q) < 0: Vt[1] *= -1; Q = Vt.T @ U.T
        Rm = Q @ Rm; t = Q @ (t - ma) + mb
    d, _ = tr.query(S @ Rm.T + t); return d, Rm, t
def chains(W):
    segs = [list(map(tuple, g)) for g in W]; used = set(); out = []; dd = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])
    for s in range(len(segs)):
        if s in used: continue
        used.add(s); path = segs[s][:]; grown = True
        while grown:
            grown = False
            for t in range(len(segs)):
                if t in used: continue
                g = segs[t]
                if dd(path[-1], g[0]) < 3: path = path + g[1:]
                elif dd(path[-1], g[-1]) < 3: path = path + g[:-1][::-1]
                elif dd(path[0], g[-1]) < 3: path = g[:-1] + path
                elif dd(path[0], g[0]) < 3: path = g[1:][::-1] + path
                else: continue
                used.add(t); grown = True
        p = np.array(path); out.append((p, float(np.hypot(*np.diff(p, axis=0).T).sum())))
    return sorted(out, key=lambda x: -x[1])

out, report = {}, []
for id in ids:
    if id not in MID: report.append(f'{id}: no map line'); continue
    o = json.load(open(f'{D}/{FILES[id]}')); seed = o['seed']
    pitW = [local(seed, w['g']) for w in o['ways'] if is_pit(w) and len(w['g']) > 1]
    race = [local(seed, w['g']) for w in o['ways'] if not is_pit(w) and w['tags'].get('highway') == 'raceway' and len(w['g']) > 1]
    if not pitW: report.append(f'{id}: no pit way in OpenStreetMap'); continue
    if not race: report.append(f'{id}: no raceway ways to fit on'); continue
    T = np.vstack([dens(g) for g in race]); tr = cKDTree(T)
    M = np.array(MID[id]['mid']); cM = M.mean(0); S = M - cM; Ss = S[::4]; best = None
    for deg in range(0, 360, 10):
        th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
        for ox in (-300, 0, 300):
            for oy in (-300, 0, 300):
                d, Rm, t = icp(Ss, T, tr, R0, np.array([ox, oy], float), 12); sc = np.quantile(d, 0.9)   # the seed is the circuit centre: start around it; sc = np.quantile(d, 0.9)
                if best is None or sc < best[0]: best = (sc, Rm, t)
    st0 = START.get(id)   # whole-area pose from osm-fit-start.py (fitted on the uncorrected line, same frame up to the centroid)
    if st0 and best[0] > 10:
        Rm0 = np.array([[math.cos(st0['th']), -math.sin(st0['th'])], [math.sin(st0['th']), math.cos(st0['th'])]])
        best = (0, Rm0, np.array(st0['T']) + (cM - RAWC[id]) @ Rm0.T)
    d, Rm, t = icp(S, T, tr, best[1], best[2], 40, 0.9); med = float(np.median(d))
    if med > 6: report.append(f'{id}: our line does not fit the OSM raceways (median {med:.1f} m)'); continue
    inv = lambda Q: (Q - t) @ Rm + cM          # cloud frame -> our map frame
    trM = cKDTree(M); n = len(M); L = MID[id]['len']; kept = None
    for p, ln in chains(pitW)[:4]:
        P = inv(dens(p, 4.0)); da, ia = trM.query(P[0]); db, ib = trM.query(P[-1])
        if da > END_MAX_M or db > END_MAX_M or ln < 150 or ln > 2500: continue
        sA, sB = ia / n * L, ib / n * L
        if (sB - sA) % L > L / 2: P = P[::-1]; sA, sB = sB, sA   # entry is reached first: before the line when the pits sit beside it
        kept = {'entryS': round(sA), 'exitS': round(sB), 'lengthM': round(ln), 'fitMedianM': round(med, 1), 'pts': [[round(x, 1), round(y, 1)] for x, y in P]}; break
    if not kept: report.append(f'{id}: pit ways found, but none joins the lap at both ends'); continue
    out[id] = kept; report.append(f"{id}: pit lane {kept['lengthM']} m, entry {kept['entryS']} m, exit {kept['exitS']} m (fit median {kept['fitMedianM']} m)")
with open('worker/lapsim/pit-lane-data.js', 'w') as f:
    f.write('// Generated by scripts/sim/tracks/pit-lanes-osm.py from OpenStreetMap pit ways (© OpenStreetMap contributors, ODbL). Do not edit by hand.\n'
            '// Per track: pit lane path in the drawn map frame (m), entry and exit as lap distance (m), path length (m).\n'
            'export const lapsimPitLanes = ' + json.dumps({'tracks': out}, separators=(',', ':')) + ';\n')
print('\n'.join(report)); print(len(out), 'tracks with a pit lane')
