# Step 31 verdict (pre-reg docs/prereg/step31-decoupled-2026-11-25.md) from the leave-one-track-out fold files. No 2022 data.
# usage: python3 -I scripts/sim/learn/step31_verdict.py <folds dir> <traces.json> <out.json>
import json, sys, os, math
import numpy as np
from scipy.signal import savgol_filter
from scipy.stats import t as tdist
d, TRP, out = sys.argv[1:4]
F = [json.load(open(os.path.join(d, f))) for f in sorted(os.listdir(d)) if f.endswith('.json')]
if len(F) != 24 and not os.environ.get('STEP31_SMOKE'): sys.exit(f'INCOMPLETE: {len(F)} of 24 folds; no verdict (pre-reg §8)')
TR = json.load(open(TRP))['events']
rng = np.random.default_rng(31); M_VAR = 2; ALPHA = 0.05 / M_VAR; USEFUL = 3.0

def flip_p(x):  # one-sided paired sign-flip: P(mean ≥ observed); exact up to 2^16 patterns, else 200,000 draws (seed 31)
    x = np.asarray(x, float); n = len(x); obs = x.mean(); a = np.abs(x)
    S = np.array([[1 if (i >> j) & 1 else -1 for j in range(n)] for i in range(2 ** n)]) if n <= 16 else rng.choice([-1, 1], (200000, n))
    return float(((S * a).mean(1) >= obs - 1e-12).mean())
def boot(x, q=(0.025, 0.975)):
    x = np.asarray(x, float); m = x[rng.integers(0, len(x), (10000, len(x)))].mean(1); return [float(np.quantile(m, q[0])), float(np.quantile(m, q[1]))]
def tmean(f, key, which):
    v = [h[which][key] for h in f['heldScores'] if h[which][key] is not None]; return float(np.mean(v)) if v else None
def paired(key, sign=+1):  # per track: base − cand (sign +1, + = better) or cand − base (sign −1, + = harm)
    out_ = {}
    for f in F:
        b, c = tmean(f, key, 'base'), tmean(f, key, 'cand')
        if b is not None and c is not None: out_[f['held']] = sign * (b - c)
    return out_
def ok(meas, pred): return pred is not None and abs(pred - meas) <= max(0.25 * abs(meas), 0.05) and (meas == 0 or pred * meas > 0)

# primary: apex RMS 120–240 km/h
g = paired('apex120_240'); x = np.array(list(g.values())); p = flip_p(x)
primary = dict(n_tracks=len(x), mean_gain_kph=float(x.mean()), ci95=boot(x), ci90=boot(x, (0.05, 0.95)), p_signflip_one_sided=p, alpha=ALPHA,
               useful_kph=USEFUL, pass_=bool(len(x) >= 5 and p < ALPHA and x.mean() >= USEFUL))
g18 = paired('apex120_180'); x18 = np.array(list(g18.values()))
report_120_180 = dict(n_tracks=len(x18), mean_gain_kph=float(x18.mean()), ci95=boot(x18), p_signflip_one_sided=flip_p(x18))
# secondary guards: entry / exit no significant harm (one-sided α 0.05)
sec = {}
for k in ('entry', 'exit'):
    h = paired(k, -1); y = np.array(list(h.values())); ph = flip_p(y)
    sec[k] = dict(n_tracks=len(y), mean_harm_s=float(y.mean()), ci95=boot(y), p_harm_one_sided=ph, pass_=bool(ph >= 0.05))
# lap guard: one-sided 95 % UB of mean paired |lap err| harm ≤ 0.10 pp
lh = np.array([np.mean([abs(h['cand']['lapErr']) for h in f['heldScores']]) - np.mean([abs(h['base']['lapErr']) for h in f['heldScores']]) for f in F])
ub = float(lh.mean() + tdist.ppf(0.95, len(lh) - 1) * lh.std(ddof=1) / math.sqrt(len(lh)))
lap = dict(n_tracks=len(lh), mean_harm_pp=float(lh.mean()), upper95_one_sided_pp=ub, ci95=boot(lh), pass_=bool(ub <= 0.10))
# DRS guard: pooled pass rate not below the A2 baseline
cases = [c for f in F for c in f['drs']]; N = len(cases)
pc = sum(ok(c['meas'], c['cand']) for c in cases); pb = sum(ok(c['meas'], c['base']) for c in cases)
drs = dict(n_cases=N, pass_rate_cand=pc / N, pass_rate_base=pb / N, pass_=bool(pc >= pb),
           bias_cand_s=float(np.mean([c['cand'] - c['meas'] for c in cases if c['cand'] is not None])))
# braking guard: pooled held-out p95 −a_x per 20 km/h bin 80–280 km/h, candidate ≤ measured + 0.3 g (step 30c estimator)
def deriv(v_kph, ds):
    v = np.asarray(v_kph, float) / 3.6; m = np.isfinite(v); idx = np.arange(len(v))
    vf = np.interp(idx, idx[m], v[m], period=len(v)); w = int(round(45.0 / ds)) | 1
    return vf, savgol_filter(vf, w, 2, deriv=1, delta=ds, mode='wrap'), m
S = {'M': [], 'C': [], 'B': []}
for f in F:
    for h in f['heldScores']:
        e = TR[h['key']]; assert 2023 <= e['year'] <= 2025; n, ds, sh = e['n'], e['ds'], e['shift']
        for nm, v in (('M', [np.nan if a is None else a for a in e['a']]), ('C', np.roll(h['vCand'], sh)), ('B', np.roll(h['vBase'], sh))):
            vf, dv, okm = deriv(v, ds); ax = vf * dv / 9.81
            S[nm].append(np.c_[vf[okm] * 3.6, -ax[okm]])
S = {k: np.vstack(v) for k, v in S.items()}
brk = []
for lo in range(80, 280, 20):
    sel = {k: v[(v[:, 0] >= lo) & (v[:, 0] < lo + 20) & (v[:, 1] > 0), 1] for k, v in S.items()}
    if min(len(s) for s in sel.values()) < 200: continue
    r = {k: float(np.percentile(s, 95)) for k, s in sel.items()}
    brk.append(dict(bin=lo, meas=r['M'], cand=r['C'], base=r['B'], ok=bool(r['C'] <= r['M'] + 0.3)))
braking = dict(bins=brk, pass_=all(b['ok'] for b in brk))
# parameters, f_kerb, per track
off = [dict(held=f['held'], **o) for f in F for o in f['offPrior']]
fk = np.array([f['fk'] for f in F]); prof = []
for f in F:
    if f.get('fkProfile'):
        J = np.array([q['J'] for q in f['fkProfile']]); X = np.array([q['fk'] for q in f['fkProfile']]); inside = X[J - J.min() <= 2.71]
        prof.append(dict(held=f['held'], fk=f['fk'], profile90=[float(inside.min()), float(inside.max())]))
nf = len(fk); jk_se = float(math.sqrt((nf - 1) / nf * ((fk - fk.mean()) ** 2).sum())) if nf > 1 else None
fkerb = dict(median=float(np.median(fk)), min=float(fk.min()), max=float(fk.max()), jackknife_se=jk_se, profile90_by_fold=prof)
params = {}
for y in sorted({y for f in F for y in f['params']}):
    for k in sorted({k for f in F for k in f['params'][y]}):
        v = np.array([f['params'][y][k] for f in F]); z = np.array([f['priorZ'][y][k] for f in F])
        params[f'{y}.{k}'] = dict(median=float(np.median(v)), min=float(v.min()), max=float(v.max()), z_median=float(np.median(z)), z_maxabs=float(np.abs(z).max()))
per = {f['held']: dict(corridor=f['corridor'], apex120_240_gain=g.get(f['held']), apex120_180_gain=g18.get(f['held']),
                       entry_harm=paired('entry', -1).get(f['held']), exit_harm=paired('exit', -1).get(f['held']),
                       lap_harm_pp=float(np.mean([abs(h['cand']['lapErr']) for h in f['heldScores']]) - np.mean([abs(h['base']['lapErr']) for h in f['heldScores']])),
                       fk=f['fk'], u_mean=float(np.mean(list(f['u'].values())))) for f in F}
groups = {}
for grp in (True, False):
    v = [r['apex120_240_gain'] for r in per.values() if r['corridor'] == grp and r['apex120_240_gain'] is not None]
    groups['corridor' if grp else 'old_path'] = dict(n=len(v), mean_gain_kph=float(np.mean(v)) if v else None)
verdict = 'PASS' if (primary['pass_'] and all(s['pass_'] for s in sec.values()) and lap['pass_'] and drs['pass_'] and braking['pass_']) else 'FAIL'
res = dict(variant=F[0]['variant'], folds=len(F), primary_apex_120_240=primary, report_apex_120_180=report_120_180, secondary_guards=sec,
           guard_lap=lap, guard_drs=drs, guard_braking=braking, f_kerb=fkerb, apex_by_group=groups, params=params, params_off_prior_2sigma=off, per_track=per, verdict=verdict)
json.dump(res, open(out, 'w'), indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ('per_track', 'params')}, indent=1))
for k, v in params.items(): print('param', k, json.dumps({a: round(b, 5) for a, b in v.items()}))
print('per_track', json.dumps({t: {a: (round(b, 3) if isinstance(b, float) else b) for a, b in r.items()} for t, r in per.items()}))
