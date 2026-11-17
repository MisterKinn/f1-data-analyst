# Audit (not run in CI): our drawn midline vs OSM raceway ways after a rigid fit. python3 scripts/sim/tracks/map-shape-audit.py <out.json> [ids]; PLOT=1 writes /tmp/sa-<id>.png
# Shape audit: our drawn midline vs OSM raceway ways (rigid trimmed ICP, many starts). Reports how far our line leaves every raceway.
#   python3 shape-audit.py <out.json> [ids...]
import json, math, subprocess, sys, os
import numpy as np
from scipy.spatial import cKDTree
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
OSM = json.load(open('scripts/sim/data/tracks/osm-raceways-all.json'))['tracks']
ids = sys.argv[2:] or sorted(OSM)
dump = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
const o = {}; for (const id of process.argv.slice(1)) { if (!T[id]) continue; const L = lineData(id); if (L) o[id] = {mid: L.mid, len: T[id].length}; } console.log(JSON.stringify(o));''', *ids],
  capture_output=True, text=True, check=True).stdout
MID = json.loads(dump); R = 6371008.8
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
res = json.load(open(sys.argv[1])) if os.path.exists(sys.argv[1]) else {}
for id in ids:
    if id not in MID or id in res: continue
    o = OSM[id]; seed = o['seed']; T = np.vstack([dens(local(seed, w['g'])) for w in o['ways'] if len(w['g']) > 1]); tr = cKDTree(T)
    M = np.array(MID[id]['mid'], float); S = M - M.mean(0); Ss = S[::3]; best = None
    lo, hi = T.min(0), T.max(0); step = max(150, float((hi - lo).max()) / 16); Sq = S[::6]
    for deg in range(0, 360, 10):
        th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
        for ox in np.arange(lo[0], hi[0] + 1, step):
            for oy in np.arange(lo[1], hi[1] + 1, step):
                Rm, t = icp(Sq, tr, T, R0, np.array([ox, oy]), 6)
                e = np.quantile(tr.query(Sq @ Rm.T + t)[0], .9)
                if best is None or e < best[0]: best = (e, Rm, t)
    _, Rm, t = best; Rm, t = icp(S, tr, T, Rm, t, 40)
    d = tr.query(S @ Rm.T + t)[0]
    seg = np.hypot(*np.diff(np.vstack([S, S[:1]]), axis=0).T); s = np.r_[0, np.cumsum(seg)][:-1]
    off = d > 12; runs = []; i = 0; n = len(d)
    while i < n:
        if off[i]:
            j = i
            while j + 1 < n and off[j + 1]: j += 1
            runs.append((float(s[i]), float(s[j] - s[i] + seg[j]), float(d[i:j + 1].max()))); i = j + 1
        else: i += 1
    runs.sort(key=lambda r: -r[1])
    res[id] = {'median': round(float(np.median(d)), 1), 'p95': round(float(np.percentile(d, 95)), 1), 'max': round(float(d.max()), 1),
               'offM': round(float(seg[off].sum())), 'runs': [[round(a), round(b), round(c)] for a, b, c in runs[:4]]}
    if os.environ.get('PLOT'):
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        X = S @ Rm.T + t; plt.figure(figsize=(9, 9)); plt.plot(T[:, 0], T[:, 1], '.', ms=1, color='#bbb')
        plt.scatter(X[:, 0], X[:, 1], c=np.minimum(d, 40), s=3, cmap='jet'); plt.plot(X[0, 0], X[0, 1], 'k^', ms=10)
        for q in range(0, len(X), max(1, len(X) // 25)): plt.text(X[q, 0], X[q, 1], str(int(s[q])), fontsize=6)
        m = 150; plt.xlim(X[:, 0].min() - m, X[:, 0].max() + m); plt.ylim(X[:, 1].min() - m, X[:, 1].max() + m)
        plt.gca().set_aspect('equal'); plt.title(f"{id} median {res[id]['median']} p95 {res[id]['p95']}"); plt.savefig(f'/tmp/sa-{id}.png', dpi=70); plt.close()
    print(id, res[id], flush=True)
    json.dump(res, open(sys.argv[1], 'w'))
