# Formula E lap lines from OpenStreetMap raceway ways, for layouts whose official circuit-map PDF has no usable lap line
# (the blue track is a fill, so lineOf traces the outline of one piece: Mexico 2023-26, found 2026-11-17).
#   python3 scripts/sim/tracks/fe-osm-lines.py
# In:  scripts/sim/data/tracks/osm-raceways-all.json (OSM raceway ways near the venue, (c) OpenStreetMap contributors, ODbL),
#      scripts/sim/data/learn/fe-maps.json (official FIA Formula E circuit maps: blue fill points and the FINISH label).
# Out: scripts/sim/data/tracks/fe-osm-lines.json, read by scripts/sim/learn/build-fe.mjs in place of the map line and by
#      scripts/sim/fe-zones.mjs for the Attack Zone label position.
# Method: the official map's blue fill is fitted to the OSM ways (similarity ICP from a grid of start rotations); ROUTES lists the
# ways the official map covers, in driving direction (chosen from the fit: every listed way is covered by the map, the bypasses
# are not). The lap starts at the finish line (FINISH label, projected onto the chain). build-fe scales it to the printed length.
import json, numpy as np
from scipy.spatial import cKDTree

D = 'scripts/sim/data/'
# id: (OSM track key, season of the map that fixes the start, ways in driving direction, map events whose blue fill the ways must match)
ROUTES = {
    'fe-mexico': ('fe-mexico', 'Season 12', [8, 4, 7, 2, 6, 19, 17, 10, 15, 13, 9],
                  'Mexico 2026 (16 turns): stadium loop, infield T10-T15 on way 10/15/13, no T7-T8 jog on the back straight'),
    'fe-mexico-2023': ('fe-mexico', 'Season 11', [8, 4, 7, 2, 6, 18, 17, 10, 15, 13, 9],
                       'Mexico 2023-25 (19 turns): as 2026 with the back-straight jog (way 18)'),
}

osm = json.load(open(D + 'tracks/osm-raceways-all.json'))
maps = json.load(open(D + 'learn/fe-maps.json'))['events']

def dense(a, step):
    out = []
    for p, q in zip(a[:-1], a[1:]):
        n = max(1, int(np.linalg.norm(q - p) / step)); out += [p + (q - p) * t for t in np.arange(n) / n]
    out.append(a[-1]); return np.array(out)

out = {'source': osm['source'] + '; official FIA Formula E circuit maps (Al Kamel Systems)', 'tracks': {}}
for tid, (key, season, route, note) in ROUTES.items():
    T = osm['tracks'][key]; lat0, lon0 = T['seed']
    W = [np.c_[(np.array(w['g'])[:, 1] - lon0) * 111320 * np.cos(np.radians(lat0)), (np.array(w['g'])[:, 0] - lat0) * 110540] for w in T['ways']]
    chain = [W[route[0]]]
    for k in route[1:]:  # each way must start where the chain ends (checked, so a changed OSM file fails loudly)
        w = W[k]; gap = np.linalg.norm(w[0] - chain[-1][-1])
        if gap > 3: raise SystemExit(f'{tid}: way {k} starts {gap:.0f} m from the chain end')
        chain.append(w[1:])
    C = np.vstack(chain)
    if np.linalg.norm(C[0] - C[-1]) > 3: raise SystemExit(f'{tid}: chain not closed')
    C = C[:-1]
    # fit the official map's blue fill to the chain (map coverage check + finish position)
    m = [e for e in maps if 'Mexico' in e['event'] and e['season'].startswith(season)][0]
    P = np.vstack([dense(np.array(p['points'], float), 1.0) for p in m['paths'] if p.get('fill') == 'rgb(0%, 0%, 100%)']); P[:, 1] *= -1
    X = P - P.mean(0); O = dense(np.vstack([C, C[:1]]), 2.0); KD = cKDTree(O); best = None
    for rot in np.radians(np.arange(-60, 61, 3)):
        R = np.array([[np.cos(rot), -np.sin(rot)], [np.sin(rot), np.cos(rot)]])
        for s0 in (0.5, 1, 2):
            sR = s0 * np.ptp(O[:, 0]) / np.ptp(X[:, 0]) * R; tt = O.mean(0)
            for _ in range(80):
                A = X @ sR.T + tt; Y = O[KD.query(A)[1]]
                mx, my = X.mean(0), Y.mean(0); U, S, Vt = np.linalg.svd((Y - my).T @ (X - mx)); Rr = U @ Vt
                if np.linalg.det(Rr) < 0: U[:, -1] *= -1; Rr = U @ Vt
                sR = S.sum() / ((X - mx) ** 2).sum() * Rr; tt = my - mx @ sR.T
            e = np.median(KD.query(X @ sR.T + tt)[0])
            if best is None or e < best[0]: best = (e, sR, tt)
    e, sR, tt = best
    dmap = cKDTree(X @ sR.T + tt).query(O)[0]
    fin = [w for w in m['words'] if w['t'] == 'FINISH'][0]
    F = (np.array([fin['x'], -fin['y']]) - P.mean(0)) @ sR.T + tt
    i0 = int(np.argmin(np.linalg.norm(C - F, axis=1))); C = np.vstack([C[i0:], C[:i0]])
    cum = np.r_[0, np.cumsum(np.linalg.norm(np.diff(np.vstack([C, C[:1]]), axis=0), axis=1))]; L = float(cum[-1])
    # Attack Zone label (scripts/sim/fe-zones.mjs): lap fraction of the nearest chain point, and its distance in metres
    attack = []
    for w in m['words']:
        if w['t'].lower() != 'attack': continue
        A = (np.array([w['x'], -(w['y'] - w['h'] / 2)]) - P.mean(0)) @ sR.T + tt; d = np.linalg.norm(C - A, axis=1); k = int(np.argmin(d))
        attack.append({'frac': round(float(cum[k] / L), 4), 'gapM': round(float(d[k]), 1)})
    out['tracks'][tid] = {'note': note, 'osmKey': key, 'ways': route, 'map': f"{m['season']} {m['event']}",
                          'fitMedianM': round(float(e), 1), 'chainCoveredByMap': round(float((dmap < 15).mean()), 3),
                          'finishOffsetM': round(float(np.linalg.norm(C[0] - F)), 1), 'osmLengthM': round(L), 'attack': attack,
                          'x': [round(float(v), 1) for v in C[:, 0]], 'y': [round(float(v), 1) for v in C[:, 1]]}
    print(tid, 'fit', round(float(e), 1), 'm; covered', round(float((dmap < 15).mean()), 3), '; OSM length', round(L), 'm')
json.dump(out, open(D + 'tracks/fe-osm-lines.json', 'w'), separators=(',', ':'))
