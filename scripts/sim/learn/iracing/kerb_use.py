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
import pyarrow.parquet as pq
REPO = os.getcwd(); out_f = sys.argv[1]; ids = sys.argv[2:]
res = json.load(open(out_f)) if os.path.exists(out_f) else {}
D = json.loads(subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; const o = {};
import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
for (const id of process.argv.slice(1)) { const L = lineData(id); if (L) o[id] = {mid: L.mid, nrm: L.nrm, len: T[id].length, corners: (T[id].corners || []).map(c => c.s), hw: L.left.map((p, i) => Math.hypot(p[0] - L.right[i][0], p[1] - L.right[i][1]) / 2)}; }
console.log(JSON.stringify(o));''', *ids], cwd=REPO, capture_output=True, text=True, check=True).stdout)
CLOSED = {'GT3', 'GT4', 'TCR', 'GTP', 'LMP', 'Cup', 'Club'}
for id in ids:
    if id not in D or not os.path.exists(os.environ.get('OSM_DIR', 'osm-pits') + f'/{id}.json'): print(id, 'no line or seed'); continue
    seed = json.load(open(os.environ.get('OSM_DIR', 'osm-pits') + f'/{id}.json'))['seed']
    M = np.array(D[id]['mid'], float); Nn = np.array(D[id]['nrm'], float); hw = np.array(D[id]['hw'], float); n = len(M)
    groups = {'closed': [], 'formula': []}
    for l in open(os.path.expanduser(os.environ.get('SRS', '~/srs')) + '/sessions.jsonl'):
        d = json.loads(l)
        if IR.get(d.get('track')) != id: continue
        g = 'formula' if d.get('cls') == 'Formula' else 'closed' if d.get('cls') in CLOSED else None
        if not g: continue
        df = pq.read_table(os.path.expanduser(os.environ.get('SRS', '~/srs')) + f"/channels/{d['sid']}.parquet", columns=['Lat', 'Lon', 'OnPitRoad', 'Speed', 'PlayerTrackSurface']).to_pandas()
        df = df[(df.OnPitRoad == 0) & (df.Lat.abs() > 1) & (df.Speed > 15) & (df.PlayerTrackSurface == 3)]
        if len(df): groups[g].append(local(seed, np.c_[df.Lat.values, df.Lon.values])[::2])
    allP = [p for v in groups.values() for p in v]
    if not allP: print(id, 'no laps'); continue
    G = np.vstack(allP); trG = cKDTree(G[::5]); S = M - M.mean(0); best = None
    for deg in range(0, 360, 5):
        th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
        Rm, t = icp(S[::4], trG, G[::5], R0, G.mean(0), 8); e = float(np.median(trG.query(S[::4] @ Rm.T + t)[0]))
        if best is None or e < best[0]: best = (e, Rm, t)
    Rm, t = icp(S, trG, G[::5], best[1], best[2], 40)
    toMap = lambda Q: (Q - t) @ Rm + M.mean(0); trM = cKDTree(M); out = {'fitMedianM': round(best[0], 2)}
    for g, Ps in groups.items():
        if not Ps: continue
        Q = toMap(np.vstack(Ps)); _, j = trM.query(Q); lat = ((Q - M[j]) * Nn[j]).sum(1)
        # pose and shape drift: the median offset over ±150 m of lap is taken as zero (racing lines swap sides within that distance)
        med = np.array([np.median(lat[j == i]) if (j == i).sum() > 20 else 0.0 for i in range(n)])
        bias = gaussian_filter1d(med, 150 / (D[id]['len'] / n), mode='wrap'); lat = lat - bias[j]; out.setdefault('biasM', {})[g] = round(float(np.percentile(np.abs(bias), 95)), 2)
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
        out[g] = {'samples': int(len(Q)), 'l': [int(round(v * 10)) for v in aL], 'r': [int(round(v * 10)) for v in aR],
                  'kl': [int(round(v * 10)) for v in kL], 'kr': [int(round(v * 10)) for v in kR], 'wl': [int(round(v * 10)) for v in wL], 'wr': [int(round(v * 10)) for v in wR]}
        print(f"{id} {g}: {len(Q)} samples, beyond the edge (m) left p90 {np.percentile(aL, 90):.2f} max {aL.max():.2f}, right p90 {np.percentile(aR, 90):.2f} max {aR.max():.2f}")
    res[id] = out; json.dump(res, open(out_f, 'w'))
