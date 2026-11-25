# Step 33 scoreboard, report-only: repeatability of measured F1 apex (120-240 km/h) and straight-end speeds across the
# top-10 laps of one session, team-normalised as step 32 used them. Reads step 32's traces + normalisation; prints JSON.
# Between-driver spread after team normalisation, so it is an upper bound on repeat noise. Never reads 2022.
import json, sys, statistics as st, math

def floors(traces, norm):
    sess = {}
    for k, e in traces['events'].items():
        assert e['year'] != 2022, '2022 LOCKED must not be read'
        sess.setdefault(e['session'], []).append((k, e))
    apex, strt = [], []
    for s, laps in sess.items():
        used = norm.get(s, {}).get('used', {})
        L = [(k, e) for k, e in laps if k in used]
        if len(L) < 3: continue
        n = min(len(e['a']) for _, e in L)
        V = [[v * used[k] for v in e['a'][:n]] for k, e in L]
        pole = next((v for (k, e), v in zip(L, V) if e['rank'] == 1), V[0])
        w = 8  # ±40 m at 5 m spacing
        for i in range(w, n - w):
            seg = pole[i - w:i + w + 1]
            if pole[i] == min(seg) and max(seg) - pole[i] > 8 and 120 <= pole[i] < 240:
                m = [min(v[i - w:i + w + 1]) for v in V]; apex.append((s, st.stdev(m), len(m)))
            if pole[i] == max(seg) and pole[i] - min(pole[i + 1:min(n, i + 30)]) > 40:
                m = [max(v[i - w:i + w + 1]) for v in V]; strt.append((s, st.stdev(m), len(m)))
    def summ(rows):
        sd = sorted(r[1] for r in rows)
        rms = lambda x: math.sqrt(st.mean([v * v for v in x]))
        return {'points': len(rows), 'sessions': len({r[0] for r in rows}), 'sd_median_kph': round(st.median(sd), 2),
                'sd_p90_kph': round(sd[int(.9 * len(sd))], 2), 'mean_floor_kph': round(rms([r[1] / math.sqrt(r[2]) for r in rows]), 2),
                'single_lap_kph': round(rms([r[1] for r in rows]), 2)}
    return {'apex_120_240': summ(apex), 'straight_end': summ(strt), 'sessions_min_laps': 3}

def _selftest():
    lap = lambda d: {'year': 2024, 'session': 's', 'rank': 1 if d == 0 else 2, 'a': [260] * 10 + [300 + d] + [250] * 3 + [150 + d] + [250] * 40}
    t = {'events': {f's|{i}': lap(i) for i in range(3)}}; nm = {'s': {'used': {f's|{i}': 1.0 for i in range(3)}}}
    f = floors(t, nm); assert f['apex_120_240']['points'] == 1 and f['apex_120_240']['single_lap_kph'] == 1.0, f
    assert f['straight_end']['points'] == 1 and f['straight_end']['single_lap_kph'] == 1.0, f

if __name__ == '__main__':
    _selftest()
    print(json.dumps(floors(json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))), indent=1))
