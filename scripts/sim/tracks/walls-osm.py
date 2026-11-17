"""Walls and barriers beside every track (owner 2026-11-18: "model the walls, above all street circuits and Bathurst").

  POSE_OUT=/tmp/poses.json python3 scripts/sim/tracks/pit-lanes-osm.py <probe-out/pits dir>   (pose of our drawn line in each OSM frame)
  python3 scripts/sim/tracks/walls-osm.py <walls dir> /tmp/poses.json [ids]                    -> worker/lapsim/walls-data.js

Input: OpenStreetMap barrier ways around each circuit (barrier=wall, guard_rail, jersey_barrier, concrete_barrier, retaining_wall,
fence, tyres, block, cable_barrier; fetched with Overpass from the circuit's probe seed; (c) OpenStreetMap contributors, ODbL).
Each way is moved into our map frame with the pose fitted on the OSM raceways (pit-lanes-osm.py). Where OSM maps no raceway (Macau),
the pose comes from the track's own map, which is a geo-referenced line (extra-tracks centre + map metres). Per lap point (every 2nd
point of the drawn line) the gap from the track edge to the nearest barrier beside it, left and right (m; null = none within 40 m of
the edge). Barriers that cross the track (a footbridge rail, a fence mapped over the road) and the far side of a dual road are left out.
Lines for the map: barrier pieces within 25 m of the edge, simplified to 0.7 m.
"""
import json, math, os, re, subprocess, sys
import numpy as np
from scipy.spatial import cKDTree

D, POSES = sys.argv[1], json.load(open(sys.argv[2])); ONLY = sys.argv[3:]
R = 6371008.8; NEAR_M = 40; DRAW_M = 25
# street circuits (temporary concrete blocks and fences along the kerb): where OSM maps no barrier within 15 m of the edge, the wall is
# taken at the road edge (gap 0.5 m, kind 'street'); escape roads are not known there. Labelled as a rule on the page, not a measurement.
STREET = {'monte-carlo', 'singapore', 'las-vegas', 'baku', 'jeddah', 'long-beach', 'detroit', 'macau', 'miami', 'melbourne', 'madring'}
KIND = {'wall': 'wall', 'retaining_wall': 'wall', 'jersey_barrier': 'wall', 'concrete_barrier': 'wall', 'block': 'wall',
        'guard_rail': 'armco', 'crash_barrier': 'armco', 'cable_barrier': 'armco', 'tyres': 'tyres', 'fence': 'fence'}
ids = [f[:-5] for f in sorted(os.listdir(D)) if f.endswith('.json') and f != 'seeds.json']
if ONLY: ids = [i for i in ids if i in ONLY]
dump = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
const o = {}; for (const id of process.argv.slice(1)) { if (!T[id]) continue; const L = lineData(id); if (!L) continue;
  o[id] = {mid: L.mid, left: L.left, right: L.right, len: T[id].length, map: T[id].map || null}; }
console.log(JSON.stringify(o));''', *ids], capture_output=True, text=True, check=True).stdout
LINES = json.loads(dump)

def local(seed, g):
    la, lo = seed; c = math.cos(math.radians(la)); g = np.array(g, float)
    return np.c_[(g[:, 1] - lo) * math.pi / 180 * R * c, (g[:, 0] - la) * math.pi / 180 * R]
def dens(g, st=1.0):
    P = [g[0]]
    for a, b in zip(g[:-1], g[1:]):
        k = max(1, int(np.ceil(np.hypot(*(b - a)) / st))); P += list(a + (b - a) * (np.arange(1, k + 1)[:, None] / k))
    return np.array(P)
def rdp(P, eps):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; ab = b - a; L = np.hypot(*ab) or 1e-9
    d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L; i = int(np.argmax(d))
    return np.vstack([rdp(P[:i + 1], eps)[:-1], rdp(P[i:], eps)]) if d[i] > eps else np.array([a, b])
def geo_pose(seed, Ln):
    """our map is a geo line (extra track: centre = first map point, metres east/north): fit the drawn line onto it in the seed frame"""
    la0, lo0 = Ln['centre']; mx, my = np.array(Ln['map']['x'], float), np.array(Ln['map']['y'], float)
    lat = la0 + my / R * 180 / math.pi; lon = lo0 + mx / (R * math.cos(math.radians(la0))) * 180 / math.pi
    G = dens(local(seed, np.c_[lat, lon]), 2.0); trG = cKDTree(G); M = np.array(Ln['mid']); cM = M.mean(0); S = M - cM
    Rm, t = np.eye(2), G.mean(0)
    for _ in range(40):
        X = S @ Rm.T + t; d, j = trG.query(X); A, B = X, G[j]; ma, mb = A.mean(0), B.mean(0)
        U, _, Vt = np.linalg.svd((A - ma).T @ (B - mb)); Q = Vt.T @ U.T
        if np.linalg.det(Q) < 0: Vt[1] *= -1; Q = Vt.T @ U.T
        Rm = Q @ Rm; t = Q @ (t - ma) + mb
    return {'Rm': Rm.tolist(), 't': t.tolist(), 'cM': cM.tolist(), 'medianM': round(float(np.median(trG.query(S @ Rm.T + t)[0])), 2), 'geo': True}

# extra tracks built from a geo line: the first map point is the candidate's centre (lat, lon)
TE = json.load(open('scripts/sim/data/track-extra.json'))['tracks']
def centre_of(id):
    e = TE.get(id)
    if not e: return None
    for f, c in [(e['file'], e['candidate'])] + ([(e['atlasFrom']['file'], e['atlasFrom']['candidate'])] if e.get('atlasFrom') else []):
        r = json.load(open('scripts/sim/data/tracks/' + f))['tracks'].get(c, {})
        if r.get('centre'): return r['centre']
    return None
def race_pose(seed, Ln, ways):
    """no stored pose (no pit way in OSM: Melbourne, Long Beach): fit our drawn line onto the OSM raceways, as pit-lanes-osm.py does"""
    W = [local(seed, w['g']) for w in ways if w['tags'].get('highway') == 'raceway' and len(w['g']) > 1]
    if not W: return None
    T = np.vstack([dens(g, 2.0) for g in W]); tr = cKDTree(T); M = np.array(Ln['mid']); cM = M.mean(0); S = M - cM; best = None
    def icp(S, Rm, t, it, trim):
        for _ in range(it):
            X = S @ Rm.T + t; d, j = tr.query(X); w = d <= np.quantile(d, trim); A, B = X[w], T[j[w]]; ma, mb = A.mean(0), B.mean(0)
            U, _, Vt = np.linalg.svd((A - ma).T @ (B - mb)); Q = Vt.T @ U.T
            if np.linalg.det(Q) < 0: Vt[1] *= -1; Q = Vt.T @ U.T
            Rm = Q @ Rm; t = Q @ (t - ma) + mb
        return float(np.median(tr.query(S @ Rm.T + t)[0])), Rm, t
    for deg in range(0, 360, 10):
        th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
        for ox in (-300, 0, 300):
            for oy in (-300, 0, 300):
                r = icp(S[::4], R0, np.array([ox, oy], float), 12, 0.8)
                if best is None or r[0] < best[0]: best = r
    med, Rm, t = icp(S, best[1], best[2], 40, 0.9)
    return {'Rm': Rm.tolist(), 't': t.tolist(), 'cM': cM.tolist(), 'medianM': round(med, 2)} if med < 3 else None

out, report = {}, []
for id in ids:
    Ln = LINES.get(id)
    if not Ln: report.append(f'{id}: no simulator track'); continue
    o = json.load(open(f'{D}/{id}.json')); seed = o['seed']; P = POSES.get(id)
    if not P: P = race_pose(seed, Ln, o['ways'])
    if not P and centre_of(id) and Ln.get('map'): P = geo_pose(seed, {**Ln, 'centre': centre_of(id)})
    if not P or P['medianM'] > 4: report.append(f'{id}: no pose of our line in the OSM frame'); continue
    Rm, t, cM = np.array(P['Rm']), np.array(P['t']), np.array(P['cM'])
    M = np.array(Ln['mid']); n = len(M); half = np.hypot(*(np.array(Ln['left']) - M).T)
    tang = np.roll(M, -1, 0) - np.roll(M, 1, 0); tang /= np.linalg.norm(tang, axis=1)[:, None]
    trM = cKDTree(M); pts, kinds, lines = [], [], []
    for w in o['ways']:
        k = KIND.get(w['tags'].get('barrier'))
        if not k or len(w['g']) < 2: continue
        Y = (local(seed, w['g']) - t) @ Rm + cM          # OSM frame -> our map frame
        Yd = dens(Y, 1.0); d, i = trM.query(Yd)
        lat = tang[i, 0] * (Yd[:, 1] - M[i, 1]) - tang[i, 1] * (Yd[:, 0] - M[i, 0])          # signed: + left of the driving direction
        gap = np.abs(lat) - half[i]
        keep = (gap > -0.3 * half[i]) & (gap < NEAR_M)     # on the road itself (crossing rails) or far away: out
        if not keep.any(): continue
        pts.append(np.c_[Yd[keep], lat[keep], i[keep]]); kinds += [k] * int(keep.sum())
        # map lines: runs of points near the edge
        near = keep & (gap < DRAW_M); run = []
        for j in range(len(Yd)):
            if near[j]: run.append(Yd[j])
            elif len(run) > 4: lines.append((k, rdp(np.array(run), 0.7))); run = []
            else: run = []
        if len(run) > 4: lines.append((k, rdp(np.array(run), 0.7)))
    if not pts and id not in STREET: report.append(f'{id}: no barrier within {NEAR_M} m of the edge'); continue
    A = np.vstack(pts) if pts else np.zeros((0, 4)); K = np.array(kinds)
    left, right, kl, kr = [None] * n, [None] * n, [None] * n, [None] * n
    for idx in range(len(A)):
        i = int(A[idx, 3]); g = abs(A[idx, 2]) - half[i]; side = left if A[idx, 2] > 0 else right; ks = kl if A[idx, 2] > 0 else kr
        if side[i] is None or g < side[i]: side[i] = g; ks[i] = K[idx]
    if id in STREET:
        for side, ks in ((left, kl), (right, kr)):
            for i in range(n):
                if side[i] is None or side[i] > 15: side[i] = 0.5; ks[i] = 'street'
    step = 2; r1 = lambda v: None if v is None else round(max(0.0, float(v)), 1)
    out[id] = {'step': step, 'poseM': P['medianM'], 'left': [r1(left[i]) for i in range(0, n, step)], 'right': [r1(right[i]) for i in range(0, n, step)],
               'kindLeft': [kl[i] for i in range(0, n, step)], 'kindRight': [kr[i] for i in range(0, n, step)],
               'lines': [{'k': k, 'pts': [[round(float(x) * 2) / 2, round(float(y) * 2) / 2] for x, y in L]} for k, L in lines]}
    cov = lambda a: sum(v is not None for v in a) / len(a)
    near5 = sum(1 for a, b in zip(out[id]['left'], out[id]['right']) if (a is not None and a < 3) or (b is not None and b < 3)) / len(out[id]['left'])
    report.append(f"{id}: pose {P['medianM']} m{' (geo)' if P.get('geo') else ''}, barrier beside the track left {cov(out[id]['left']):.0%} / right {cov(out[id]['right']):.0%}, "
                  f"within 3 m of the edge on {near5:.0%} of the lap, {len(lines)} map lines")
if ONLY and os.path.exists('worker/lapsim/walls-data.js'):
    old = open('worker/lapsim/walls-data.js').read().split('lapsimWalls = ', 1)[1]; out = {**json.loads(old[:old.rindex('}') + 1])['tracks'], **out}
with open('worker/lapsim/walls-data.js', 'w') as f:
    f.write('// Generated by scripts/sim/tracks/walls-osm.py from OpenStreetMap barrier ways (© OpenStreetMap contributors, ODbL). Do not edit by hand.\n'
            '// Per track: gap (m) from the track edge to the nearest barrier, left and right of the driving direction, every `step` points of the\n'
            '// drawn line (null: none within 40 m); barrier kind there (wall, armco, tyres, fence); barrier lines for the map (drawn map frame, m).\n'
            'export const lapsimWalls = ' + json.dumps({'tracks': dict(sorted(out.items()))}, separators=(',', ':')) + ';\n')
print('\n'.join(report)); print(len(out), 'tracks with barriers')
