"""Start poses for map-shape-osm.mjs (rigid fit of our map line onto the OSM raceway ways).

OSM often maps other circuits (kart, moto, oval) next to the main one, so the fit must search the whole area; that search is
far too slow in the JS script (one track > 9 min). This does it with a k-d tree and writes the best pose per track:
  node scripts/sim/tracks/raw-lines.mjs > /tmp/raw-lines.json
  python3 scripts/sim/tracks/osm-fit-start.py /tmp/raw-lines.json [ids]   -> scripts/sim/data/tracks/osm-fit-start.json
map-shape-osm.mjs refines from that pose (40 ICP rounds) and applies its own quality gate.
"""
import json, math, sys
import numpy as np
from scipy.spatial import cKDTree

R = 6371008.8
raw = json.load(open(sys.argv[1]))
osm = json.load(open('scripts/sim/data/tracks/osm-raceways-all.json'))['tracks']


def cloud(o):  # same local metres as the JS script (east, north around the seed), 2 m spacing
    la, lo = o['seed']; c = math.cos(math.radians(la)); P = []
    for w in o['ways']:
        g = np.array(w['g'], float); g = np.c_[(g[:, 1] - lo) * math.pi / 180 * R * c, (g[:, 0] - la) * math.pi / 180 * R]
        for a, b in zip(g[:-1], g[1:]):
            k = max(1, int(np.ceil(np.hypot(*(b - a)) / 2))); P += list(a + (b - a) * (np.arange(k)[:, None] / k))
    return np.array(P)


def icp(S, tree, T, Rm, t, it, trim=0.8):
    for _ in range(it):
        X = S @ Rm.T + t; d, j = tree.query(X); w = d <= np.quantile(d, trim); A, B = S[w], T[j[w]]; ma, mb = A.mean(0), B.mean(0)
        U, _, Vt = np.linalg.svd((A - ma).T @ (B - mb)); D = np.eye(2); D[1, 1] = np.sign(np.linalg.det(Vt.T @ U.T)); Rm = Vt.T @ D @ U.T
        t = mb - ma @ Rm.T
    return tree.query(S @ Rm.T + t)[0], Rm, t


F = 'scripts/sim/data/tracks/osm-fit-start.json'
try: out = json.load(open(F))
except FileNotFoundError: out = {}
ONLY = sys.argv[2:]  # optional track ids; others keep their pose
for id, o in sorted(osm.items()):
    if id not in raw or (ONLY and id not in ONLY): continue
    T = cloud(o); tree = cKDTree(T); M = np.array(raw[id]); cM = M.mean(0); S = M - cM; Ss = S[::6]
    lo, hi = T.min(0), T.max(0); best = None; step = float(__import__("os").environ.get("STEP", 0)) or max(250, float((hi - lo).max()) / 16)  # STEP: finer retry; big areas (Nordschleife): coarser starts
    for deg in range(0, 360, 10):
        th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
        for ox in np.arange(lo[0], hi[0] + 1, step):
            for oy in np.arange(lo[1], hi[1] + 1, step):
                d, Rm, t = icp(Ss, tree, T, R0, np.array([ox, oy]), 6); q = np.quantile(d, .9)
                if best is None or q < best[0]: best = (q, Rm, t)
    d, Rm, t = icp(S, tree, T, best[1], best[2], 30, 0.9)
    out[id] = {'th': round(math.atan2(Rm[1, 0], Rm[0, 0]), 6), 'T': [round(float(t[0]), 2), round(float(t[1]), 2)], 'medianM': round(float(np.median(d)), 2)}
    print(id, out[id]['medianM'], flush=True)
    json.dump(out, open(F, 'w'), indent=0)
