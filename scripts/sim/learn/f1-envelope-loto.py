# Step 28 verdict (pre-reg 6e944cd1… + A1) from the leave-one-track-out fold files. No 2022 data.
# usage: python3 -I scripts/sim/learn/f1-envelope-loto.py <folds dir> <out.json>
import json, sys, os, math, numpy as np
from scipy.stats import binom, t as tdist
d, out = sys.argv[1:3]
F = [json.load(open(os.path.join(d, f))) for f in sorted(os.listdir(d)) if f.endswith('.json')]
rng = np.random.default_rng(28); A = 0.05 / 3

def flip_p(x):  # paired sign-flip, two-sided (exact up to 2^16 patterns, else 100,000 draws seed 28)
    x = np.asarray(x); n = len(x); obs = abs(x.mean())
    S = np.array([[1 if (i >> j) & 1 else -1 for j in range(n)] for i in range(2 ** n)]) if n <= 16 else rng.choice([-1, 1], (100000, n))
    return float((np.abs((S * x).mean(1)) >= obs - 1e-12).mean())
def boot(x):
    x = np.asarray(x); m = x[rng.integers(0, len(x), (10000, len(x)))].mean(1); return [float(np.quantile(m, 0.025)), float(np.quantile(m, 0.975))]
def ok(meas, pred): return pred is not None and abs(pred - meas) <= max(0.25 * abs(meas), 0.05) and (meas == 0 or pred * meas > 0)

# (a) per track: mean over its held-out events of the event RMS in 120-240 km/h segments (events equal weight), baseline minus candidate
ga, lap_h, per = [], [], {}
for f in F:
    s = [h for h in f['heldScores']]
    cb = [h['cand']['bin'] for h in s if h['cand']['bin'] is not None]; bb = [h['base']['bin'] for h in s if h['base']['bin'] is not None]
    ch = float(np.mean([abs(h['cand']['lapErr']) for h in s])); bh = float(np.mean([abs(h['base']['lapErr']) for h in s]))
    per[f['held']] = {'gain_kph': (float(np.mean(bb)) - float(np.mean(cb))) if cb else None, 'harm_pp': ch - bh, 'offPrior': f['offPrior']}
    if cb: ga.append(per[f['held']]['gain_kph'])
    lap_h.append(ch - bh)
ga = np.array(ga); n = len(ga); half = float(tdist.ppf(0.975, n - 1) * ga.std(ddof=1) / math.sqrt(n))
pa = flip_p(ga)
a = {'n_tracks': n, 'mean_gain_kph': float(ga.mean()), 'ci95': boot(ga), 't_halfwidth': half, 'p_signflip': pa,
     'judgeable': half <= 3.0, 'pass': bool(half <= 3.0 and pa < A and ga.mean() >= 3.0)}
cases = [c for f in F for c in f['drs']]
pc = sum(ok(c['meas'], c['cand']) for c in cases); pb = sum(ok(c['meas'], c['base']) for c in cases); N = len(cases)
pb_rate = pb / N; p_binom = float(1 - binom.cdf(pc - 1, N, max(pb_rate, 1e-9)))
b = {'n_cases': N, 'pass_rate_cand': pc / N, 'pass_rate_base': pb_rate, 'gain_pp': 100 * (pc - pb) / N, 'p_binom_vs_base': p_binom,
     'sign_errors_cand': sum(1 for c in cases if c['cand'] is not None and c['meas'] != 0 and c['cand'] * c['meas'] < 0),
     'bias_cand_s': float(np.mean([c['cand'] - c['meas'] for c in cases if c['cand'] is not None]))}
b['pass'] = bool(p_binom < A and b['gain_pp'] >= 20)
lap_h = np.array(lap_h); ub = float(lap_h.mean() + tdist.ppf(0.95, len(lap_h) - 1) * lap_h.std(ddof=1) / math.sqrt(len(lap_h)))
g = {'n_tracks': len(lap_h), 'mean_harm_pp': float(lap_h.mean()), 'upper95_one_sided_pp': ub, 'boot_ci95': boot(lap_h), 'paired_sd_pp': float(lap_h.std(ddof=1)),
     'paired_mde_pp': float(3.236 * lap_h.std(ddof=1) / math.sqrt(len(lap_h))), 'pass': ub <= 0.10}
off = sorted({(o['season'], o['key']) for f in F for o in f['offPrior']})
res = {'variant': F[0]['variant'] if F else None, 'folds': len(F), 'a_speed': a, 'b_drs': b, 'guard_lap': g,
       'params_off_prior_2sigma': [list(x) for x in off], 'verdict': 'PASS' if (a['pass'] and b['pass'] and g['pass']) else 'FAIL', 'per_track': per,
       'params_by_fold': {f['held']: f['params'] for f in F}}
json.dump(res, open(out, 'w'), indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ('per_track', 'params_by_fold')}, indent=1))
