# Offline: reads the owner's local iRacing extract (SRS env var, default ~/srs: sessions.jsonl + channels/*.parquet; personal use,
# never committed). Outputs only derived numbers. Run from the repo root.
# Kerb use learned from iRacing laps (laser-scanned tracks): how far beyond our drawn edge the car centre goes, per point and side,
# for closed-wheel cars (GT3, GT4, TCR, GTP, LMP, Cup, Club) and for formula cars. Our drawn midline (lineData, with shape) is fitted
# rigidly onto the GPS laps; every sample is projected onto the midline (lap point, signed offset, + = left of travel).
# allowance = 97th percentile of the offset on that side minus (half width - 1 m), clipped to 0..3 m, smoothed along the lap.
# python3 kerb-use.py out.json id ...
import sys, json, math, os, subprocess, numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter1d, maximum_filter1d
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from irmap import IR; from chfit import local, icp
try: import pyarrow.parquet as pq
except ImportError: pq = None
OSMS = json.load(open('scripts/sim/data/tracks/osm-raceways-all.json'))['tracks']
REPO = os.getcwd(); out_f = sys.argv[1]; ids = sys.argv[2:]
def icps(S, tr, T, A, t, it, trim=0.8):
    """trimmed ICP with one scale (Umeyama): A = scale x rotation; X = S @ A.T + t"""
    for _ in range(it):
        X = S @ A.T + t; d, j = tr.query(X); w = d <= np.quantile(d, trim); P, Q = S[w], T[j[w]]; mp, mq = P.mean(0), Q.mean(0)
        U, D, Vt = np.linalg.svd((Q - mq).T @ (P - mp)); E = np.diag([1, np.sign(np.linalg.det(U @ Vt))])
        Rr = U @ E @ Vt; sc = float((D * np.diag(E)).sum() / ((P - mp) ** 2).sum()); sc = min(1.03, max(0.97, sc)); A = sc * Rr; t = mq - A @ mp
    return A, t
res = json.load(open(out_f)) if os.path.exists(out_f) else {}
D = json.loads(subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; const o = {};
import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
for (const id of process.argv.slice(1)) { const L = lineData(id); if (L) o[id] = {mid: L.mid, nrm: L.nrm, len: T[id].length, corners: (T[id].corners || []).map(c => c.s), hw: L.left.map((p, i) => Math.hypot(p[0] - L.right[i][0], p[1] - L.right[i][1]) / 2)}; }
console.log(JSON.stringify(o));''', *ids], cwd=REPO, capture_output=True, text=True, check=True).stdout)
CLOSED = {'GT3', 'GT4', 'TCR', 'GTP', 'LMP', 'Cup', 'Club'}
for id in ids:
    if id not in D: print(id, 'no line'); continue
    PK = os.environ.get('PACKED')   # results/kerb_extract/packed from srs_kerb_pack.py (same rows as below, already filtered)
    src = []
    if PK:
        for t, our in IR.items():
            if our == id and os.path.exists(f"{PK}/{t.replace(' ', '_')}.npz"):
                z = np.load(f"{PK}/{t.replace(' ', '_')}.npz"); src += [(d['cls'], z[d['sid'] + '_Lat'], z[d['sid'] + '_Lon']) for d in json.load(open(f"{PK}/{t.replace(' ', '_')}.json"))]
    else:
        for l in open(os.path.expanduser(os.environ.get('SRS', '~/srs')) + '/sessions.jsonl'):
            d = json.loads(l)
            if IR.get(d.get('track')) != id: continue
            df = pq.read_table(os.path.expanduser(os.environ.get('SRS', '~/srs')) + f"/channels/{d['sid']}.parquet", columns=['Lat', 'Lon', 'OnPitRoad', 'Speed', 'PlayerTrackSurface']).to_pandas()
            df = df[(df.OnPitRoad == 0) & (df.Lat.abs() > 1) & (df.Speed > 15) & (df.PlayerTrackSurface == 3)]; src.append((d.get('cls'), df.Lat.values, df.Lon.values))
    if not src: print(id, 'no laps'); continue
    # local frame origin: the OSM seed (osm-raceways-all.json) or, where OSM has none (Bathurst, Brands Hatch), the laps' mean; the fit
    # below is a similarity fit from many start poses, so the origin only needs to be near the track
    seed = OSMS[id]['seed'] if id in OSMS else [float(np.mean(np.concatenate([a for _, a, _ in src]))), float(np.mean(np.concatenate([b for _, _, b in src])))]
    M = np.array(D[id]['mid'], float); Nn = np.array(D[id]['nrm'], float); hw = np.array(D[id]['hw'], float); n = len(M)
    groups = {'closed': [], 'formula': []}
    for cls, la, lo in src:
        g = 'formula' if cls == 'Formula' else 'closed' if cls in CLOSED else None
        if g and len(la): groups[g].append(local(seed, np.c_[la, lo])[::2])
    allP = [p for v in groups.values() for p in v]
    if not allP: print(id, 'no laps'); continue
    G = np.vstack(allP); trG = cKDTree(G[::5]); S = M - M.mean(0); best = None
    # start poses: every 5° and a 5 x 5 grid of centres over a quarter of the lap's extent (the laps may cover more or less than our
    # line, so their centroid is not our centre); a similarity fit (rotation, shift and one scale: our map metres may be stretched
    # to the official length) is refined from the best
    ext = (G.max(0) - G.min(0)) / 4
    for deg in range(0, 360, 5):
        th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
        for ox in (-1, -.5, 0, .5, 1):
            for oy in (-1, -.5, 0, .5, 1):
                Rm, t = icp(S[::8], trG, G[::5], R0, G.mean(0) + ext * (ox, oy), 4); e = float(np.median(trG.query(S[::8] @ Rm.T + t)[0]))
                if best is None or e < best[0]: best = (e, Rm, t)
    Rm, t = icp(S[::2], trG, G[::5], best[1], best[2], 20)
    Rm, t = icps(S, trG, G[::5], Rm, t, 40); best = (float(np.median(trG.query(S @ Rm.T + t)[0])), Rm, t)
    Ai = np.linalg.inv(Rm); toMap = lambda Q: (Q - t) @ Ai.T + M.mean(0); trM = cKDTree(M); out = {'fitMedianM': round(best[0], 2), 'scale': round(float(np.sqrt(abs(np.linalg.det(Rm)))), 4)}
    good = np.ones(n, bool)
    if os.environ.get('SEGMENTS'):
        # fit only the parts that match (2026-11-21): after the whole-lap fit, each ~400 m piece of our line gets its own small rigid
        # fit (from ±150 m around it) onto the laps; a piece is used only if it then lies within 2.2 m (median) of the laps and moved
        # at most 8 m and 3°. Laps are mapped with the transform of the piece they are nearest to. Elsewhere no kerb data (zero).
        X = S @ Rm.T + t; st = D[id]['len'] / n; seg = (np.arange(n) * st // 400).astype(int); nseg = seg.max() + 1
        if (n * st) % 400 < 200 and nseg > 1: seg[seg == nseg - 1] = nseg - 2; nseg -= 1
        Rk, tk, ek = [], [], []
        for k in range(nseg):
            I = np.flatnonzero(seg == k); W = np.unique(np.concatenate([(I + m) % n for m in range(-int(150 / st), int(150 / st) + 1)]))
            R1, t1 = icp(X[W], trG, G[::5], np.eye(2), np.zeros(2), 15)
            c = X[I].mean(0); mv = float(np.hypot(*(c @ R1.T + t1 - c))); rot = abs(math.degrees(math.atan2(R1[1, 0], R1[0, 0])))
            e = float(np.median(trG.query(X[I] @ R1.T + t1)[0])); Rk.append(R1); tk.append(t1); ek.append(e)
            good[I] = e <= 2.2 and mv <= 8 and rot <= 3
        jx = cKDTree(X)
        def toMap(Q, toMap0=toMap):
            _, jj = jx.query(Q); k = seg[jj]; out_ = np.empty_like(Q)
            for kk in np.unique(k):
                w = k == kk; out_[w] = toMap0((Q[w] - tk[kk]) @ np.linalg.inv(Rk[kk]).T)
            return out_
        ekp = np.array(ek)[seg]
        out.update({'segFitMedianM': round(float(np.median(ekp[good])), 2) if good.any() else None, 'segKeptShare': round(float(good.mean()), 3)})
        print(id, 'pieces', nseg, 'kept share', out['segKeptShare'], 'median fit of kept pieces', out['segFitMedianM'])
    for g, Ps in groups.items():
        if not Ps: continue
        Q = toMap(np.vstack(Ps)); _, j = trM.query(Q); lat = ((Q - M[j]) * Nn[j]).sum(1)
        if os.environ.get('DUMP'): np.save(f"{os.environ['DUMP']}/{id}-{g}.npy", Q[::20].astype('float32'))   # check plots only, not committed
        # pose and shape drift: the median offset over ±150 m of lap is taken as zero (racing lines swap sides within that distance)
        med = np.array([np.median(lat[j == i]) if (j == i).sum() > 20 else 0.0 for i in range(n)])
        bias = gaussian_filter1d(med, 150 / (D[id]['len'] / n), mode='wrap')
        if os.environ.get('SEGMENTS') and os.environ.get('PIECE_DRIFT'):
            # 2026-11-22: a piece is also dropped when the laps sit more than 8 m off our line there (p95 of the drift over the piece):
            # the piece fit then matched the wrong part of the laps (Montreal start piece: laps 11 m to one side, fit 0.4 m). Judged on
            # the closed-wheel group, used for both groups; the track then needs at least half of the lap kept.
            if g == 'closed':
                for k in range(seg.max() + 1):
                    w = seg == k
                    if np.percentile(np.abs(bias[w]), 95) > 8: good[w] = False
                out['segKeptShare'] = round(float(good.mean()), 3); print(id, 'kept share after piece drift', out['segKeptShare'])
        lat = lat - bias[j]; out.setdefault('biasM', {})[g] = round(float(np.percentile(np.abs(bias[good]) if good.any() else [99], 95)), 2)
        L = np.zeros(n); R = np.zeros(n); cnt = np.bincount(j, minlength=n)
        for i in np.flatnonzero(cnt > 20):
            v = lat[j == i]; L[i] = np.percentile(v, 97); R[i] = -np.percentile(v, 3)
        lim = hw - 1.0
        aL = np.clip(maximum_filter1d(L - lim, 3, mode='wrap'), 0, 3); aR = np.clip(maximum_filter1d(R - lim, 3, mode='wrap'), 0, 3)
        aL = gaussian_filter1d(aL, 1.5, mode='wrap'); aR = gaussian_filter1d(aR, 1.5, mode='wrap')
        # beyond the drawn edge near a corner (within 60 m before to 90 m after it) = kerb; elsewhere = the asphalt is wider than drawn
        near = np.zeros(n, bool); st = D[id]['len'] / n
        for cs in D[id]['corners']:
            i0 = int(cs / st); near[[(i0 + k) % n for k in range(-int(60 / st), int(90 / st) + 1)]] = True
        kL = np.where(near, np.minimum(aL, 1.5), 0); kR = np.where(near, np.minimum(aR, 1.5), 0)
        wL = np.where(near, aL - kL, aL); wR = np.where(near, aR - kR, aR)   # width added on each side (m)
        aL = np.where(good, aL, 0); aR = np.where(good, aR, 0); kL = np.where(good, kL, 0); kR = np.where(good, kR, 0); wL = np.where(good, wL, 0); wR = np.where(good, wR, 0)
        out[g] = {'samples': int(len(Q)), 'samplesKept': int(good[j].sum()), 'l': [int(round(v * 10)) for v in aL], 'r': [int(round(v * 10)) for v in aR],
                  'kl': [int(round(v * 10)) for v in kL], 'kr': [int(round(v * 10)) for v in kR], 'wl': [int(round(v * 10)) for v in wL], 'wr': [int(round(v * 10)) for v in wR]}
        print(f"{id} {g}: {len(Q)} samples, beyond the edge (m) left p90 {np.percentile(aL, 90):.2f} max {aL.max():.2f}, right p90 {np.percentile(aR, 90):.2f} max {aR.max():.2f}")
    res[id] = out; json.dump(res, open(out_f, 'w'))
