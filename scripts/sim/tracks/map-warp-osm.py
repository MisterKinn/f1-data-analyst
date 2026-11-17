# Drawn track shape for maps that drift over the lap (owner 2026-11-17: "fix every wrong track shape").
#   python3 scripts/sim/tracks/map-warp-osm.py <id> [<id> ...]   -> adds {warp} entries to worker/lapsim/map-shape-data.js
# Tracks built from F1 car positions draw their map by integrating the measured curvature; small heading errors add up, so the
# outline bends away from the real circuit (Paul Ricard: up to 180 m). The sideways correction of map-shape-osm.mjs only fixes
# bends shorter than a few hundred metres. Here the drawn midline is moved point by point onto the OpenStreetMap raceway ways:
# rigid fit (trimmed ICP, whole-area start search), then the displacement to the nearest raceway point, kept only where the
# raceway is within GATE_M (elsewhere: another road or OSM has no way; the displacement there is interpolated from both sides),
# smoothed along the lap (normalised Gaussian) and applied; repeated with a shrinking sigma (coarse drift first, bends last).
# Drawing only: the simulator geometry is unchanged. Stored in 0.1 m per midline point; the track's sideways correction is dropped.
import json, math, subprocess, sys
import numpy as np
from scipy.spatial import cKDTree

GATE_M, SIGMAS_M, R = float(__import__("os").environ.get("GATE", 40)), [300, 200, 120, 80, 50, 30, 20], 6371008.8
ids = sys.argv[1:]
osm = json.load(open('scripts/sim/data/tracks/osm-raceways-all.json'))['tracks']
dump = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
const o = {}; for (const id of process.argv.slice(1)) { const L = lineData(id, {shape: false}); if (L) o[id] = {mid: L.mid, len: T[id].length}; } console.log(JSON.stringify(o));''', *ids],
                      capture_output=True, text=True, check=True).stdout
MID = json.loads(dump)

def local(seed, g):
    la, lo = seed; c = math.cos(math.radians(la)); g = np.array(g, float)
    return np.c_[(g[:, 1] - lo) * math.pi / 180 * R * c, (g[:, 0] - la) * math.pi / 180 * R]
def dens(g, st=2.0):
    P = [g[0]]
    for a, b in zip(g[:-1], g[1:]):
        k = max(1, int(np.ceil(np.hypot(*(b - a)) / st))); P += list(a + (b - a) * (np.arange(1, k + 1)[:, None] / k))
    return np.array(P)
def icp(S, tr, T, Rm, t, it, trim=0.8):
    for _ in range(it):
        X = S @ Rm.T + t; d, j = tr.query(X); w = d <= np.quantile(d, trim); A, B = X[w], T[j[w]]; ma, mb = A.mean(0), B.mean(0)
        U, _, Vt = np.linalg.svd((A - ma).T @ (B - mb)); Q = Vt.T @ U.T
        if np.linalg.det(Q) < 0: Vt[1] *= -1; Q = Vt.T @ U.T
        Rm = Q @ Rm; t = Q @ (t - ma) + mb
    return Rm, t
def smooth(v, w, sig, st):  # normalised Gaussian along the closed lap; w = 1 where the raceway is trusted
    s = sig / st; r = int(math.ceil(3 * s)); k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * s * s)); n = len(v)
    pad = lambda a: np.concatenate([a[-r:], a, a[:r]]) if r < n else np.tile(a, 3)[n - r:2 * n + r]
    num = np.stack([np.convolve(pad(v[:, c] * w), k, 'valid') for c in (0, 1)], 1); den = np.convolve(pad(w), k, 'valid')[:, None]
    return num / np.maximum(den, 1e-9)

out, report = {}, []
for id in ids:
    if id not in MID or id not in osm: report.append(f'{id}: no map line or no OSM ways'); continue
    o = osm[id]; T = np.vstack([dens(local(o['seed'], w['g'])) for w in o['ways'] if len(w['g']) > 1]); tr = cKDTree(T)
    M = np.array(MID[id]['mid'], float); c0 = M.mean(0); S = M - c0; n = len(S)
    st = float(np.hypot(*np.diff(np.vstack([S, S[:1]]), axis=0).T).sum() / n)
    lo, hi = T.min(0), T.max(0); step = max(100, float((hi - lo).max()) / 20); best = None
    for deg in range(0, 360, 10):
        th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
        for ox in np.arange(lo[0], hi[0] + 1, step):
            for oy in np.arange(lo[1], hi[1] + 1, step):
                Rm, t = icp(S[::6], tr, T, R0, np.array([ox, oy]), 6); e = np.quantile(tr.query(S[::6] @ Rm.T + t)[0], .5)
                if best is None or e < best[0]: best = (e, Rm, t)
    _, Rm, t = best; Rm, t = icp(S, tr, T, Rm, t, 30)
    X = S @ Rm.T + t; X0 = X.copy(); d0 = tr.query(X)[0]
    for sig in SIGMAS_M:
        for _ in range(4):
            d, j = tr.query(X); w = (d < GATE_M).astype(float)
            X = X + smooth(T[j] - X, w, sig, st)
            Rm2, t2 = icp(X, tr, T, np.eye(2), np.zeros(2), 3, 0.9); X = X @ Rm2.T + t2
    d1, _ = tr.query(X); gate = d0 < GATE_M
    # back into our map frame: undo the rigid pose of the first fit (the page draws in its own frame)
    W = (X - t) @ Rm + c0 - M  # Rm orthonormal: inverse = transpose
    out[id] = {'atlas': 'osm-warp', 'warp': {'x': [int(round(v * 10)) for v in W[:, 0]], 'y': [int(round(v * 10)) for v in W[:, 1]]},
               'medianBeforeM': round(float(np.median(d0)), 1), 'medianAfterM': round(float(np.median(d1)), 1),
               'p95AfterM': round(float(np.percentile(d1, 95)), 1), 'maxWarpM': round(float(np.hypot(*W.T).max()), 1)}
    report.append(f"{id}: OSM distance median {out[id]['medianBeforeM']} -> {out[id]['medianAfterM']} m, p95 after {out[id]['p95AfterM']} m, max move {out[id]['maxWarpM']} m")

f = 'worker/lapsim/map-shape-data.js'; src = open(f).read(); head, body = src.split('\nexport const lapsimMapShape = ')
data = json.loads(body.rstrip().rstrip(';'))
data['tracks'].update(out)
if 'map-warp-osm' not in head: head += '\n// Tracks marked atlas "osm-warp": scripts/sim/tracks/map-warp-osm.py, the whole midline moved onto the OpenStreetMap raceway ways.'
open(f, 'w').write(head + '\nexport const lapsimMapShape = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print('\n'.join(report))
