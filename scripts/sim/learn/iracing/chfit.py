# Offline: reads the owner's local iRacing extract (SRS env var, default ~/srs: sessions.jsonl + channels/*.parquet; personal use,
# never committed). Outputs only derived numbers. Run from the repo root.
# shared: OSM frame, rigid fit of our drawn midline onto OSM raceways (pose cached), curvature helpers
import os, json, math, subprocess, os
import numpy as np
from scipy.spatial import cKDTree
REPO = os.getcwd(); R = 6371008.8; CACHE = '/tmp/chicane-poses.json'
OSM = json.load(open(f'{REPO}/scripts/sim/data/tracks/osm-raceways-all.json'))['tracks']
def mids(ids, shape=True):
    out = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
const sh = process.argv[1] === '1', o = {}; for (const id of process.argv.slice(2)) { if (!T[id]) continue; const L = lineData(id, {shape: sh}); if (L) o[id] = {mid: L.mid, left: L.left, right: L.right, len: T[id].length, corners: (T[id].corners||[]).map(c => ({n: String(c.number ?? c.n ?? c.name ?? "") + (c.letter || ""), s: c.s ?? null}))}; } console.log(JSON.stringify(o));''', '1' if shape else '0', *ids], cwd=REPO, capture_output=True, text=True, check=True).stdout
    return json.loads(out)
def local(seed, g):
    la, lo = seed; c = math.cos(math.radians(la)); g = np.array(g, float)
    return np.c_[(g[:, 1] - lo) * math.pi / 180 * R * c, (g[:, 0] - la) * math.pi / 180 * R]
def dens(g, st=1.0):
    P = [g[0]]
    for a, b in zip(g[:-1], g[1:]):
        k = max(1, int(np.ceil(np.hypot(*(b - a)) / st))); P += list(a + (b - a) * (np.arange(1, k + 1)[:, None] / k))
    return np.array(P)
def osm_ways(id):
    o = OSM[id]; return [local(o['seed'], w['g']) for w in o['ways'] if len(w['g']) > 1]
def icp(S, tr, T, Rm, t, it, trim=0.8):
    for _ in range(it):
        X = S @ Rm.T + t; d, j = tr.query(X); w = d <= np.quantile(d, trim); A, B = X[w], T[j[w]]; ma, mb = A.mean(0), B.mean(0)
        U, _, Vt = np.linalg.svd((A - ma).T @ (B - mb)); Q = Vt.T @ U.T
        if np.linalg.det(Q) < 0: Vt[1] *= -1; Q = Vt.T @ U.T
        Rm = Q @ Rm; t = Q @ (t - ma) + mb
    return Rm, t
def fit(id, M, T, tr, q=0.5):
    """pose of our midline M (map frame) in the OSM frame; criterion: quantile q of the distances (lower q for part-public circuits)"""
    C = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    S = M - M.mean(0)
    if id in C: Rm, t = np.array(C[id]['Rm']), np.array(C[id]['t'])
    else:
        lo, hi = T.min(0), T.max(0); step = max(150, float((hi - lo).max()) / 16); best = None
        for deg in range(0, 360, 10):
            th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
            for ox in np.arange(lo[0], hi[0] + 1, step):
                for oy in np.arange(lo[1], hi[1] + 1, step):
                    Rm, t = icp(S[::6], tr, T, R0, np.array([ox, oy]), 6, max(.8, q + .2)); e = np.quantile(tr.query(S[::6] @ Rm.T + t)[0], q)
                    if best is None or e < best[0]: best = (e, Rm, t)
        Rm, t = icp(S, tr, T, best[1], best[2], 40, max(.8, q + .2))
        C = json.load(open(CACHE)) if os.path.exists(CACHE) else {}; C[id] = {'Rm': Rm.tolist(), 't': t.tolist()}; json.dump(C, open(CACHE, 'w'))
    X = S @ Rm.T + t; return X, Rm, t, M.mean(0)
def resample(P, st=1.0, closed=False):
    if closed: P = np.vstack([P, P[:1]])
    seg = np.hypot(*np.diff(P, axis=0).T); s = np.r_[0, np.cumsum(seg)]; u = np.arange(0, s[-1], st)
    return np.c_[np.interp(u, s, P[:, 0]), np.interp(u, s, P[:, 1])]
def curv(Q, st=1.0, sm=5):
    h = np.unwrap(np.arctan2(*np.diff(Q, axis=0).T[::-1])); k = np.gradient(h) / st
    if sm > 1: k = np.convolve(k, np.ones(sm) / sm, 'same')
    return np.r_[k, k[-1]]
def min_radius(P, st=1.0, sm=5):
    """smallest radius on an open polyline (median-filtered curvature over sm metres)"""
    if len(P) < 4: return None
    Q = resample(P, st); k = curv(Q, st, sm); return float(1 / max(1e-6, np.abs(k[sm:-sm] if len(k) > 2 * sm + 2 else k).max()))
