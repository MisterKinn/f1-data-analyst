# Step 31 close (report only): summarise step31-v1-check.mjs output per track; checks the replay against the run's verdict per-track gains.
# Usage: python3 scripts/sim/learn/step31_v1_check.py <check json> <verdict per-track json or -> <out json>
import json, sys
import numpy as np
from collections import defaultdict
D = json.load(open(sys.argv[1])); VER = json.load(open(sys.argv[2])) if sys.argv[2] != '-' else None
rng = np.random.default_rng(31)
by = defaultdict(list)
for r in D['rows']: by[r['track']].append(r)
m = lambda xs: float(np.mean(xs)) if xs else None
T = {}
for t, rs in sorted(by.items()):
    ab = [r['base']['apex120_240'] for r in rs if r['base']['apex120_240'] is not None]; ac = [r['cand']['apex120_240'] for r in rs if r['cand']['apex120_240'] is not None]
    T[t] = dict(corridor=rs[0]['corridor'], lap_base_pct=m([r['base']['lapErrPct'] for r in rs]), lap_cand_pct=m([r['cand']['lapErrPct'] for r in rs]),
                abs_harm_pp=m([abs(r['cand']['lapErrPct']) for r in rs]) - m([abs(r['base']['lapErrPct']) for r in rs]),
                st_base_kph=m([r['base']['straightRes'] for r in rs if r['base']['straightRes'] is not None]),
                st_cand_kph=m([r['cand']['straightRes'] for r in rs if r['cand']['straightRes'] is not None]),
                apex_gain=(m(ab) - m(ac)) if ab else None,
                **{f'{w}_{k}_s': m([r[w]['phases'][k] for r in rs]) for w in ('base', 'cand') for k in ('entry', 'apex', 'exit')})
def boot(x):
    x = np.asarray(x, float); b = x[rng.integers(0, len(x), (10000, len(x)))].mean(1); return [float(np.quantile(b, .025)), float(np.quantile(b, .975))]
col = lambda k: np.array([v[k] for v in T.values() if v[k] is not None])
summ = {k: dict(mean=float(col(k).mean()), ci95=boot(col(k)), n=len(col(k))) for k in ('lap_base_pct', 'lap_cand_pct', 'abs_harm_pp', 'st_base_kph', 'st_cand_kph')}
dl = np.array([v['lap_cand_pct'] - v['lap_base_pct'] for v in T.values()]); ds = np.array([v['st_cand_kph'] - v['st_base_kph'] for v in T.values()])
summ['lap_shift_pct'] = dict(mean=float(dl.mean()), ci95=boot(dl)); summ['straight_shift_kph'] = dict(mean=float(ds.mean()), ci95=boot(ds))
for k in ('entry', 'apex', 'exit'):
    d = np.array([v[f'cand_{k}_s'] - v[f'base_{k}_s'] for v in T.values()]); summ[f'lap_{k}_shift_s'] = dict(mean=float(d.mean()), ci95=boot(d))
summ['too_fast_tracks'] = dict(base=int((col('lap_base_pct') < 0).sum()), cand=int((col('lap_cand_pct') < 0).sum()), n=len(T))
summ['corr_lapshift_vs_straightshift'] = float(np.corrcoef(dl, ds)[0, 1])
if VER:  # replay check against the run's verdict per-track apex gain
    d = [abs(T[t]['apex_gain'] - VER[t]['apex120_240_gain']) for t in T if T[t]['apex_gain'] is not None and VER[t]['apex120_240_gain'] is not None]
    summ['replay_max_abs_diff_apex_gain_kph'] = float(max(d))
json.dump(dict(summary=summ, per_track=T), open(sys.argv[3], 'w'), indent=1)
print(json.dumps(summ, indent=1))
for t, v in T.items(): print(t, {k: (round(x, 3) if isinstance(x, float) else x) for k, x in v.items()})
