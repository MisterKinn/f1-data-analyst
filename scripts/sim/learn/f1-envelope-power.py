# Step 28 power check from the baseline run's own rows (no candidate is read).
# usage: python3 -I scripts/sim/learn/f1-envelope-power.py <envelope-baseline.json> <baseline-pooled-2026-11-24.csv> <out.json>
#        python3 -I scripts/sim/learn/f1-envelope-power.py <a2-baseline.json> - <out.json>   (A2: rows and DRS from the A2 file)
import json, sys, csv, math, statistics as st
from collections import defaultdict
from scipy.stats import binom, norm
env, drs, out = sys.argv[1:4]
Z = norm.ppf(1 - 0.05 / 3 / 2) + norm.ppf(0.8)  # α 0.05 split over 3 variants, two-sided, power 0.8
J = json.load(open(env)); rows = [r for r in J['rows'] if 'drop' not in r]
by = defaultdict(list)
for r in rows: by[r['track']].append(r)
trk = {}
for t, rs in sorted(by.items()):
    rb = [r['rms_bin_kph'] for r in rs if r['rms_bin_kph'] is not None]
    trk[t] = {'n_events': len(rs), 'rms_bin_kph': st.mean(rb) if rb else None, 'abs_lap_err_pct': st.mean(abs(r['lap_err_pct']) for r in rs),
              'season_rms': {r['year']: r['rms_bin_kph'] for r in rs}}
sp = [v['rms_bin_kph'] for v in trk.values() if v['rms_bin_kph'] is not None]
lp = [v['abs_lap_err_pct'] for v in trk.values()]
# within-track season-to-season change of the baseline RMS (noise + car change): a candidate gain varies at most about this much per track
dif = [b - a for v in trk.values() for a, b in zip(sorted(v['season_rms'].items()), sorted(v['season_rms'].items())[1:]) for a, b in [(a[1], b[1])] if a is not None and b is not None]
sd_within = st.stdev(dif) / math.sqrt(2) if len(dif) > 2 else None
difl = [abs(b['lap_err_pct']) - abs(a['lap_err_pct']) for rs in by.values() for a, b in zip(sorted(rs, key=lambda r: r['year']), sorted(rs, key=lambda r: r['year'])[1:])]
sd_lap_within = st.stdev(difl) / math.sqrt(2) if len(difl) > 2 else None
n = len(sp)
res = {'z_total': Z, 'speed': {'n_tracks': n, 'baseline_median_kph': st.median(sp), 'sd_between_tracks': st.stdev(sp), 'sd_within_track_season': sd_within,
                             'mde_conservative_kph': Z * st.stdev(sp) / math.sqrt(n), 'mde_within_kph': None if sd_within is None else Z * sd_within / math.sqrt(n),
                             'effect_of_interest_kph': 3.0},
       'lap_guard': {'n_tracks': len(lp), 'baseline_median_abs_pct': st.median(lp), 'sd': st.stdev(lp), 'mde_pct': Z * st.stdev(lp) / math.sqrt(len(lp)),
                     'delta_5pct_of_median': 0.05 * st.median(lp), 'sd_within_track_season': sd_lap_within,
                     'paired_mde_planning_pp': None if sd_lap_within is None else Z * sd_lap_within / math.sqrt(len(lp)), 'limit_pp': 0.10}}
c = [{'meas_delta_s': x['meas'], 'pred_delta_s': x['pred'], 'track': x['track']} for x in J['drs']] if drs == '-' else [r for r in csv.DictReader(open(drs))]
def ok(r):
    m, p = float(r['meas_delta_s']), float(r['pred_delta_s'])
    return abs(p - m) <= max(0.25 * abs(m), 0.05) and (m == 0 or p * m > 0)
p0 = sum(ok(r) for r in c) / len(c)
def mde_prop(nn, a=0.05 / 3):  # smallest pass rate a one-sided exact binomial test vs p0 detects with power 0.8
    k = int(binom.ppf(1 - a, nn, max(p0, 1e-9))) + 1
    return next(p / 1000 for p in range(1, 1000) if 1 - binom.cdf(k - 1, nn, p / 1000) >= 0.8)
res['drs'] = {'n_cases': len(c), 'n_tracks': len({r['track'] for r in c}), 'baseline_pass': p0, 'mde_pass_cases': mde_prop(len(c)),
              'mde_pass_tracks_worst': mde_prop(len({r['track'] for r in c})), 'effect_of_interest_pp': 20}
res['tracks'] = trk
json.dump(res, open(out, 'w'), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != 'tracks'}, indent=1))
