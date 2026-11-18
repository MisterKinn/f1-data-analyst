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
PIT = re.compile(r'\bpit(s|lane|_lane|stop|straat|strasse|straße|ten)?\b|\bbox(engasse)?\b|\bvoie des stands\b|\bcorsia box\b', re.I)   # "Pit Lane", service=pit; not Capital, Hospital, Pitts Avenue
# Circuits with two pit lanes (owner 2026-11-17): the first lane is the F1 one; `alt` is the other, with the series that use it
# ('alt': only the other lane, 'both': both lanes; a series not listed uses the main lane). A lane is picked by where its entry
# joins the lap (metres from the line). Input since 2026-11-17: probe/osm-pits-all plus probe/osm-pits-fe (Formula E, Jarama).
SERIES = {
    'spa-francorchamps': {'main': (6500, 6947), 'alt': {'name': 'Endurance pits', 'mainName': 'F1 pits', 'entry': (300, 600), 'use': {'gt3': 'both'},
                          'note': 'F1 and WEC: F1 pits (Bus Stop to La Source); Le Mans Cup and support series: Endurance pits; Spa 24 Hours: both'}},
    'silverstone': {'main': (4900, 5500), 'alt': {'name': 'National pits', 'mainName': 'Wing pits', 'entry': (2100, 2500), 'use': {'wec': 'alt', 'gt3': 'alt'},
                    'note': 'F1: Wing pits (Club to Abbey); most other series: National pits (Woodcote to Copse)'}},
}
# Circuits where OSM also maps other pit roads (Le Mans: the motorcycle pit exit to the Dunlop chicane, the Maison Blanche kart pits):
# only ways with these names; their pieces sit a few metres apart, so they are chained with a wider gap (m)
ONLY = {'le-mans': (re.compile(r'^(pit entry|pit lane|pit exit)$', re.I), 12)}
# Pit roads that meet in T-junctions (Le Mans: the entry road runs outside the Ford chicanes and joins the pit lane from the side):
# shortest path through all pit ways (points within 6 m joined) from the track point in the entry window to the one in the exit
# window (lap distances, m)
GRAPH = {'le-mans': ((12700, 13150), (380, 700))}
# Pit exits that OSM maps as a straight shortcut (owner 2026-11-17, Zolder: on the satellite image the exit road runs along the inside of
# T1 and merges before T2; OSM swings 75 m away and comes back on one 200 m chord): from where the path leaves its run beside the lap,
# it follows the lap at the run's distance, closing to the track at the OSM merge point (track metres stay as mapped)
HUG_EXIT = {'zolder'}
def hug_exit(P, M, trM, gap=12):
    d, _ = trM.query(P); d0 = float(np.median(d[:len(P) // 2])); n = len(M)
    k = next((i for i in range(len(P) // 3, len(P)) if d[i] > d0 + gap), None)
    if k is None: return P
    _, ia = trM.query(P[k - 1]); _, ib = trM.query(P[-1]); m = (ib - ia) % n
    tg = M[(ia + 2) % n] - M[(ia - 2) % n]; side = np.sign(tg[0] * (P[k - 1] - M[ia])[1] - tg[1] * (P[k - 1] - M[ia])[0])
    Q = []
    for j in range(1, m + 1):
        i = (ia + j) % n; t = M[(i + 2) % n] - M[(i - 2) % n]; t = t / (np.hypot(*t) or 1); off = d[k - 1] * (0.5 + 0.5 * np.cos(np.pi * j / m))
        Q.append(M[i] + side * off * np.array([-t[1], t[0]]))
    return np.vstack([P[:k], Q])
SEED_ID = {'valencia-ricardo-tormo': 'ricardo-tormo'}   # probe seeds named after the track request
FILES = {}
for f in sorted(os.listdir(D)):
    if f.endswith('.json'): FILES.setdefault(SEED_ID.get(f[:-5], f[:-5]), f)   # a track's own seed wins
ids = sorted(FILES)
ONLY_IDS = [x for x in os.environ.get('PIT_ONLY', '').split(',') if x]   # PIT_ONLY=zolder: rebuild only these, keep the rest as stored
if ONLY_IDS: ids = [i for i in ids if i in ONLY_IDS]
dump = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
const o = {}; for (const id of process.argv.slice(1)) { if (!T[id]) continue; const L = lineData(id), Lr = lineData(id, {shape: false}); if (L) o[id] = {mid: L.mid, raw: [0, 1].map(c => Lr.mid.reduce((s, p) => s + p[c], 0) / Lr.mid.length), len: T[id].length}; } console.log(JSON.stringify(o));''', *ids],
  capture_output=True, text=True, check=True).stdout
MID = json.loads(dump)
RAWC = {k: np.array(v['raw']) for k, v in MID.items()}
START = json.load(open('scripts/sim/data/tracks/osm-fit-start.json')) if os.path.exists('scripts/sim/data/tracks/osm-fit-start.json') else {}
# pose of our drawn line from iRacing GPS laps (laser-scanned tracks), where OSM maps only part of the lap as raceway (Le Mans, Bathurst):
# scripts/sim/data/tracks/gps-fit.json, fitted on lineData(id).mid minus its centroid (only derived pose numbers are stored)
GPS = json.load(open('scripts/sim/data/tracks/gps-fit.json')) if os.path.exists('scripts/sim/data/tracks/gps-fit.json') else {}

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
def chains(W, gap=3):
    segs = [list(map(tuple, g)) for g in W]; used = set(); out = []; dd = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])
    for s in range(len(segs)):
        if s in used: continue
        used.add(s); path = segs[s][:]; grown = True
        while grown:
            grown = False
            for t in range(len(segs)):
                if t in used: continue
                g = segs[t]
                if dd(path[-1], g[0]) < gap: path = path + g[1:]
                elif dd(path[-1], g[-1]) < gap: path = path + g[:-1][::-1]
                elif dd(path[0], g[-1]) < gap: path = g[:-1] + path
                elif dd(path[0], g[0]) < gap: path = g[1:][::-1] + path
                else: continue
                used.add(t); grown = True
        p = np.array(path); out.append((p, float(np.hypot(*np.diff(p, axis=0).T).sum())))
    return sorted(out, key=lambda x: -x[1])

out, report, POSES = {}, [], {}
for id in ids:
    if id not in MID: report.append(f'{id}: no map line'); continue
    o = json.load(open(f'{D}/{FILES[id]}')); seed = o['seed']
    only = ONLY.get(id)
    pitW = [local(seed, w['g']) for w in o['ways'] if is_pit(w) and len(w['g']) > 1 and (not only or only[0].match(w['tags'].get('name', '')))]
    race = [local(seed, w['g']) for w in o['ways'] if not is_pit(w) and w['tags'].get('highway') == 'raceway' and len(w['g']) > 1]
    if not pitW: report.append(f'{id}: no pit way in OpenStreetMap'); continue
    if not race and id not in GPS: report.append(f'{id}: no raceway ways to fit on'); continue
    if not race: race = pitW
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
    g = GPS.get(id)
    if g and med > 3:   # the whole-lap OSM fit is poor: take the GPS pose (a fit on the stretch around the line can slide along the straight)
        Rm = np.array([[math.cos(g['th']), -math.sin(g['th'])], [math.sin(g['th']), math.cos(g['th'])]]); t = np.array(g['T'], float); med = g['medianM']
        report.append(f'{id}: pose from iRacing GPS laps (median {med} m)')
    if med > 6:   # a warped map (map-warp-osm.py) no longer fits the pose stored for its raw line: search the whole area, as osm-fit-start.py
        lo, hi = T.min(0), T.max(0); step = max(250, float((hi - lo).max()) / 16); Sq = S[::6]; best = None
        for deg in range(0, 360, 10):
            th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
            for ox in np.arange(lo[0], hi[0] + 1, step):
                for oy in np.arange(lo[1], hi[1] + 1, step):
                    d2, Rm2, t2 = icp(Sq, T, tr, R0, np.array([ox, oy]), 6); q = np.quantile(d2, .5)
                    if best is None or q < best[0]: best = (q, Rm2, t2)
        d2, Rm2, t2 = icp(S, T, tr, best[1], best[2], 40, 0.9)
        if float(np.median(d2)) < med: d, Rm, t, med = d2, Rm2, t2, float(np.median(d2))
    if med > 6:   # street and part-public circuits: OSM maps only part of the lap as raceway; fit the stretch around the line (pits sit there)
        sl = np.arange(len(M)) / len(M) * MID[id]['len']; near = (sl < 1500) | (sl > MID[id]['len'] - 1500); Sn = M[near] - M[near].mean(0)
        lo, hi = T.min(0), T.max(0); step = max(150, float((hi - lo).max()) / 20); best = None
        for deg in range(0, 360, 10):
            th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
            for ox in np.arange(lo[0], hi[0] + 1, step):
                for oy in np.arange(lo[1], hi[1] + 1, step):
                    d2, Rm2, t2 = icp(Sn[::4], T, tr, R0, np.array([ox, oy]), 6); q = np.quantile(d2, .5)
                    if best is None or q < best[0]: best = (q, Rm2, t2)
        d2, Rm2, t2 = icp(Sn, T, tr, best[1], best[2], 40, 0.9)
        if float(np.median(d2)) < 6: Rm, t, med = Rm2, t2 + (cM - M[near].mean(0)) @ Rm2.T, float(np.median(d2)); report.append(f'{id}: fitted on the 3 km around the line')
    if med > 6:   # OSM maps only pieces of the lap (Madring 2026, Baku): fit those pieces onto our line instead (each OSM point to its nearest
        # point of our line; small turns and shifts around the area centre), then use the inverse pose
        Md = dens(np.r_[M, M[:1]]); trm = cKDTree(Md); best = None
        for deg in range(-30, 31, 3):
            th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
            for ox in range(-800, 801, 100):   # both frames start near the circuit centre (OSM: the probe seed; ours: the map origin)
                for oy in range(-800, 801, 100):
                    d2, Rm2, t2 = icp(T, Md, trm, R0, np.array([ox, oy], float), 30, 0.7)
                    if best is None or np.median(d2) < best[0]: best = (float(np.median(d2)), Rm2, t2)
        if best[0] < 3:   # OSM -> ours: Y = X Rm2' + t2, so X = (Y - cM) Rm2 + (cM - t2) Rm2
            Rm, t, med = best[1].T, (cM - best[2]) @ best[1], best[0]; report.append(f'{id}: OSM pieces fitted onto our line (median {med:.1f} m)')
    if med > 6: report.append(f'{id}: our line does not fit the OSM raceways (median {med:.1f} m)'); continue
    inv = lambda Q: (Q - t) @ Rm + cM          # cloud frame -> our map frame
    POSES[id] = {'seed': seed, 'Rm': Rm.tolist(), 't': t.tolist(), 'cM': cM.tolist(), 'medianM': round(med, 2)}   # walls-osm.py reuses the pose
    trM = cKDTree(M); n = len(M); L = MID[id]['len']; kept = None
    cands = []
    if id in GRAPH:
        from scipy.sparse import coo_matrix
        from scipy.sparse.csgraph import dijkstra
        Pg = np.vstack([inv(dens(g, 2.0)) for g in pitW]); kg = cKDTree(Pg); pr = kg.query_pairs(6.0, output_type='ndarray')
        wgt = np.hypot(*(Pg[pr[:, 0]] - Pg[pr[:, 1]]).T); Gm = coo_matrix((np.r_[wgt, wgt], (np.r_[pr[:, 0], pr[:, 1]], np.r_[pr[:, 1], pr[:, 0]])), shape=(len(Pg), len(Pg))).tocsr()
        sl = np.arange(n) / n * L; dg, jg = kg.query(M)
        def end(lo, hi, last):   # the entry leaves the track where the pit road first touches it, the exit joins where it last does
            w = np.flatnonzero((sl >= lo) & (sl <= hi) & (dg < 10)); return None if not len(w) else int(jg[w[-1] if last else w[0]])
        a, b = end(*GRAPH[id][0], False), end(*GRAPH[id][1], True)
        if a is not None and b is not None:
            dist, pred = dijkstra(Gm, indices=a, return_predecessors=True)
            if np.isfinite(dist[b]):
                path = [b]
                while path[-1] != a: path.append(pred[path[-1]])
                Pp = Pg[path[::-1]]
                gr = [(Pp, float(dist[b]))]
            else: gr = []
        else: gr = []
    for p, ln in (gr if id in GRAPH else chains(pitW, ONLY[id][1] if id in ONLY else 3))[:10 if id in SERIES else 4]:
        P = p if id in GRAPH else inv(dens(p, 4.0)); da, ia = trM.query(P[0]); db, ib = trM.query(P[-1])
        if da > END_MAX_M or db > END_MAX_M or ln < 150 or ln > 2500: continue
        sA, sB = ia / n * L, ib / n * L
        if (sB - sA) % L > L / 2: P = P[::-1]; sA, sB = sB, sA; ia, ib = ib, ia   # entry is reached first: before the line when the pits sit beside it
        # an end that dangles past the junction (owner 2026-11-17, Le Mans: the entry drew a hook): where the path first runs towards
        # the track, it starts at the point where it stops getting closer (within 150 m); the dangling piece is dropped
        dP = trM.query(P)[0]; cum = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
        def cut(d, c):   # walk in from the end while the path still comes closer to the track (a hook); stop at that local minimum
            i = 0
            while i + 1 < len(d) and c[i] < 150 and d[i + 1] < d[i] - 0.3: i += 1
            return i
        i0 = cut(dP, cum); i1 = len(P) - 1 - cut(dP[::-1], cum[-1] - cum[::-1])
        if i1 - i0 > 2 and (i0 or i1 < len(P) - 1):
            ln -= float(cum[i0] + cum[-1] - cum[i1]); P = P[i0:i1 + 1]; _, ia = trM.query(P[0]); _, ib = trM.query(P[-1]); sA, sB = ia / n * L, ib / n * L
        # both ends on the track (owner 2026-11-17: the Sebring entry stopped short): add the nearest line point when the end is off it
        if np.hypot(*(P[0] - M[ia])) > 1: ln += float(np.hypot(*(P[0] - M[ia]))); P = np.vstack([M[ia], P])
        if np.hypot(*(P[-1] - M[ib])) > 1: ln += float(np.hypot(*(P[-1] - M[ib]))); P = np.vstack([P, M[ib]])
        if id in HUG_EXIT: P = hug_exit(P, M, trM); ln = float(np.hypot(*np.diff(P, axis=0).T).sum())
        cands.append({'entryS': round(sA), 'exitS': round(sB), 'lengthM': round(ln), 'fitMedianM': round(med, 1), 'pts': [[round(x, 1), round(y, 1)] for x, y in P]})
        if id not in SERIES: break
    if id in SERIES:
        cf = SERIES[id]; pick = lambda w: next((c for c in cands if w[0] <= c['entryS'] <= w[1]), None)
        kept, alt = pick(cf['main']), pick(cf['alt']['entry'])
        if kept and alt: kept = {**kept, 'alt': {k: cf['alt'][k] for k in ('name', 'mainName', 'use', 'note')} | alt}
        else: report.append(f'{id}: the two pit lanes were not both found'); kept = kept or (cands[0] if cands else None)
    else: kept = cands[0] if cands else None
    if not kept: report.append(f'{id}: pit ways found, but none joins the lap at both ends'); continue
    out[id] = kept; report.append(f"{id}: pit lane {kept['lengthM']} m, entry {kept['entryS']} m, exit {kept['exitS']} m (fit median {kept['fitMedianM']} m)"
                                  + (f"; {kept['alt']['name']} {kept['alt']['lengthM']} m, entry {kept['alt']['entryS']} m, exit {kept['alt']['exitS']} m" if 'alt' in kept else ''))
# pit lanes drawn from official track maps where OpenStreetMap maps none (Macau 2026-11-18: TCR Macau map), never over an OSM lane
DRAWN = json.load(open('scripts/sim/data/tracks/pit-lanes-drawn.json'))['tracks'] if os.path.exists('scripts/sim/data/tracks/pit-lanes-drawn.json') else {}
for k, v in DRAWN.items():
    if k not in out and (not ONLY_IDS or k in ONLY_IDS): out[k] = v; report.append(f"{k}: pit lane drawn from {v.get('source', 'a track map')}")
if ONLY_IDS:
    old = open('worker/lapsim/pit-lane-data.js').read().split('lapsimPitLanes = ', 1)[1]; out = {**json.loads(old[:old.rindex('}') + 1])['tracks'], **out}
with open('worker/lapsim/pit-lane-data.js', 'w') as f:
    f.write('// Generated by scripts/sim/tracks/pit-lanes-osm.py from OpenStreetMap pit ways (© OpenStreetMap contributors, ODbL). Do not edit by hand.\n'
            '// Per track: pit lane path in the drawn map frame (m), entry and exit as lap distance (m), path length (m).\n'
            '// alt: a second pit lane (Spa, Silverstone) and the series that use it ({series: alt|both}); the main lane is the F1 one.\n'
            'export const lapsimPitLanes = ' + json.dumps({'tracks': out}, separators=(',', ':')) + ';\n')
print('\n'.join(report)); print(len(out), 'tracks with a pit lane')
if os.environ.get('POSE_OUT'): json.dump(POSES, open(os.environ['POSE_OUT'], 'w'))   # pose of our drawn line in each probe's OSM frame
