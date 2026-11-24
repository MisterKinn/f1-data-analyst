# Step 31 (report-only, before the pre-reg hash): power check from the A2 baseline rows, the drag-vs-tyre braking split, and the
# measured priors (lateral, braking, exit traction). No candidate, no fit. 2022 never read (asserted).
# Usage: python3 -I scripts/sim/learn/step31_power.py <repo root> <a2 baseline json from step31-baseline.mjs> <out json>
import sys, json, math, statistics as st
from collections import defaultdict
import numpy as np
from scipy.signal import savgol_filter
from scipy.stats import norm

ROOT, BASE, OUT = sys.argv[1:4]
LO_HI = tuple(map(float, sys.argv[4].split('-'))) if len(sys.argv) > 4 else (120, 180)  # alternative bands: report only
TR = json.load(open(f'{ROOT}/scripts/sim/data/f1-envelope/traces.json'))['events']
B = json.load(open(BASE))['events']
G0, SGW, SEARCH, BAND, M_VAR = 9.81, 45.0, 40.0, LO_HI, 2
Z_DEC = norm.ppf(1 - 0.05 / M_VAR) + norm.ppf(0.8)  # one-sided α 0.05/m (m = 2 variants), power 0.8 (pre-reg decision rule)
Z_G = 1.0 + 0.84                                     # AGENTS.md Gate G v3.3 MDE (one-sided 16 %, power 0.8), reported beside it
rng = np.random.default_rng(31)

def deriv(v_kph, ds):  # same estimator as step 30c (Savitzky–Golay, 45 m window, periodic)
    v = np.asarray(v_kph, float) / 3.6; m = np.isfinite(v); idx = np.arange(len(v))
    vf = np.interp(idx, idx[m], v[m], period=len(v)); w = int(round(SGW / ds)) | 1
    return vf, savgol_filter(vf, w, 2, deriv=1, delta=ds, mode='wrap'), m

rows, brk, trac = [], [], []
for key, e in TR.items():
    assert 2023 <= e['year'] <= 2025, '2022 is locked'
    b = B[key]; n, ds, sh = e['n'], e['ds'], e['shift']; assert len(b['v']) == n
    meas = np.array([np.nan if x is None else x for x in e['a']], float); vm = np.roll(np.array(b['v'], float), sh)
    w = int(SEARCH / ds); st_ = e['straights']; apex, ent, ext = [], [], []; EXIT_IDX = []
    for j, (i, _) in enumerate(e['corners']):
        idx = (i + np.arange(-w, w + 1)) % n; vmin_m = meas[i]; vmin_s = np.nanmin(vm[idx])
        if BAND[0] <= vmin_m < BAND[1]: apex.append(vmin_s - vmin_m)
        if len(st_) < 2: continue
        a0, a1 = st_[j], st_[(j + 1) % len(st_)]
        seg = np.arange(a0, a1 + (n if a1 <= a0 else 0) + 1) % n
        vv, mm = meas[seg], vm[seg]; ok = np.isfinite(vv)
        dt = np.where(ok, ds / (mm / 3.6) - ds / (np.where(ok, vv, 1) / 3.6), 0.0)
        k0 = int(np.where(seg == i)[0][0]); lo = hi = k0
        while lo > 0 and np.isfinite(vv[lo - 1]) and vv[lo - 1] <= 1.05 * vmin_m: lo -= 1
        while hi < len(seg) - 1 and np.isfinite(vv[hi + 1]) and vv[hi + 1] <= 1.05 * vmin_m: hi += 1
        ent.append(float(dt[:lo].sum())); ext.append(float(dt[hi + 1:].sum()))
        EXIT_IDX.append((e['track'], seg[hi + 1:]))
    rms = lambda x: math.sqrt(sum(y * y for y in x) / len(x)) if x else None
    rows.append(dict(key=key, track=e['track'], year=e['year'], apex_rms=rms(apex), n_apex=len(apex), entry_rms=rms(ent), exit_rms=rms(ext),
                     n_corner=len(ent), lap_err=100 * (b['lap'] - e['lap_meas_s']) / e['lap_meas_s']))
    # braking and exit-traction samples (track, v kph, −a_x g, drag g on the model car, a_x g)
    rho, cda, mass = b['rho'], b['cdA'], b['mass']
    for name, v in (('M', meas), ('K', vm)):
        vf, dv, ok = deriv(v, ds); ax = vf * dv / G0; drag = 0.5 * rho * cda * vf ** 2 / mass / G0
        for t_, vk, a, d in zip([e['track']] * ok.sum(), vf[ok] * 3.6, ax[ok], drag[ok]):
            if a < 0: brk.append((name, t_, vk, -a, d))
        for t_, ix in EXIT_IDX:  # exit-phase samples (apex end → next straight end), accelerating
            for j in ix:
                if ok[j] and ax[j] > 0: trac.append((name, t_, vf[j] * 3.6, ax[j]))

# --- per-track metrics and power ---------------------------------------------------------------------------------------------
by = defaultdict(list)
for r in rows: by[r['track']].append(r)
def per_track(f):
    out = {}
    for t, rs in by.items():
        x = [r[f] for r in rs if r[f] is not None]
        if x: out[t] = dict(mean=st.mean(x), season={r['year']: r[f] for r in rs if r[f] is not None})
    return out
def power(f, label, unit, useful):
    pt = per_track(f); lv = [v['mean'] for v in pt.values()]; n = len(lv)
    dif = [b - a for v in pt.values() for a, b in zip([v['season'][y] for y in sorted(v['season'])], [v['season'][y] for y in sorted(v['season'])][1:])]
    sdw = st.stdev(dif) / math.sqrt(2) if len(dif) > 2 else None
    return dict(metric=label, unit=unit, n_tracks=n, baseline_median=st.median(lv), sd_between=st.stdev(lv), sd_within_season=sdw, n_pairs=len(dif),
                mde_within=None if sdw is None else Z_DEC * sdw / math.sqrt(n), mde_between=Z_DEC * st.stdev(lv) / math.sqrt(n),
                mde_within_gateG=None if sdw is None else Z_G * sdw / math.sqrt(n), useful=useful,
                judgeable_within=None if sdw is None else bool(Z_DEC * sdw / math.sqrt(n) <= useful), judgeable_between=bool(Z_DEC * st.stdev(lv) / math.sqrt(n) <= useful))
lapabs = {t: st.mean(abs(r['lap_err']) for r in rs) for t, rs in by.items()}
difl = [abs(b['lap_err']) - abs(a['lap_err']) for rs in by.values() for a, b in zip(sorted(rs, key=lambda r: r['year']), sorted(rs, key=lambda r: r['year'])[1:])]
sdl = st.stdev(difl) / math.sqrt(2)
POW = {'apex_120_180': power('apex_rms', 'apex speed RMS, measured v_min 120–180 km/h', 'km/h', 3.0),
       'entry': power('entry_rms', 'entry-phase Δt RMS per corner', 's', 0.026),
       'exit': power('exit_rms', 'exit-phase Δt RMS per corner', 's', 0.026),
       'lap_guard': dict(n_tracks=len(lapabs), baseline_median_abs_pct=st.median(lapabs.values()), sd_within_season=sdl,
                         ub_halfwidth_planning_pp=norm.ppf(0.95) * sdl / math.sqrt(len(lapabs)), limit_pp=0.10)}

# --- braking: drag vs tyre, model vs measured (p95 per 20 km/h bin, 95 % CI over tracks) ------------------------------------
def boot_p95(arr, col):
    trk = sorted({a[1] for a in arr}); per = {t: np.array([a[col] for a in arr if a[1] == t]) for t in trk}
    full = float(np.percentile(np.concatenate(list(per.values())), 95)); bs = []
    for _ in range(600):
        pick = rng.choice(len(trk), len(trk)); bs.append(np.percentile(np.concatenate([per[trk[p]] for p in pick]), 95))
    return [round(full, 3), *[round(float(x), 3) for x in np.percentile(bs, [2.5, 97.5])]]
BRK = []
for lo in range(80, 300, 20):
    sel = {nm: [a for a in brk if a[0] == nm and lo <= a[2] < lo + 20] for nm in ('M', 'K')}
    if min(len(sel['M']), len(sel['K'])) < 200: continue
    K = sel['K']; Kt = sorted(K, key=lambda a: a[3])[int(0.95 * len(K)):]  # top-5 % model braking samples
    drag_top = float(np.mean([a[4] for a in Kt])); v_mid = (lo + 10) / 3.6
    BRK.append(dict(bin=lo, meas_p95=boot_p95(sel['M'], 3), model_p95=boot_p95(K, 3), model_drag_g_at_top=round(drag_top, 3),
                    drag_g_cda_shipped=round(0.5 * 1.2 * np.median([b['cdA'] for b in B.values()]) * v_mid ** 2 / 806 / G0, 3),
                    drag_g_cda_prior_1_35=round(0.5 * 1.2 * 1.35 * v_mid ** 2 / 806 / G0, 3)))
for r in BRK:
    ex = r['model_p95'][0] - r['meas_p95'][0]
    r['excess_g'] = round(ex, 3)
    r['drag_share_of_model'] = round(r['model_drag_g_at_top'] / r['model_p95'][0], 3)
    # how much of the excess could drag explain if the real car had the published-prior CdA: Δdrag = drag(1.35) − drag(shipped) (< 0 = real car drags more)
    r['excess_explained_by_cda_gap_g'] = round(r['drag_g_cda_shipped'] - r['drag_g_cda_prior_1_35'], 3)
    r['tyre_part_model_g'] = round(r['model_p95'][0] - r['model_drag_g_at_top'], 3)

# --- exit traction prior: p95 of a_x on straight-ish samples, 60–160 km/h ----------------------------------------------------
TRC = []
for lo in range(60, 240, 20):
    sel = {nm: [(a[0], a[1], a[2], a[3]) for a in trac if a[0] == nm and lo <= a[2] < lo + 20] for nm in ('M', 'K')}
    if min(len(sel['M']), len(sel['K'])) < 200: continue
    TRC.append(dict(bin=lo, meas_p95=boot_p95(sel['M'], 3), model_p95=boot_p95(sel['K'], 3)))

meta = dict(n_events=len(rows), n_tracks=len(by), lap_err_median_abs=st.median(abs(r['lap_err']) for r in rows),
            car_2025=dict(cdA=sorted({round(b['cdA'], 4) for b in B.values()}), clA=sorted({b['clA'] for b in B.values()})[:3],
                          muX=B[next(iter(B))]['muX'], muY=B[next(iter(B))]['muY'], muXTrac=B[next(iter(B))]['muXTrac'], pIce=B[next(iter(B))]['pIce']),
            z_decision=Z_DEC, z_gateG=Z_G, tracks=sorted(by))
json.dump(dict(meta=meta, power=POW, braking=BRK, traction=TRC, rows=rows), open(OUT, 'w'), indent=1)
print(json.dumps(dict(meta=meta, power=POW), indent=1))
for r in BRK: print('BRK', r)
for r in TRC: print('TRC', r)
