# Step 24 cases stage (pre-reg sections 2a, 2b, noise; amendment 1). usage: python3 -I cases.py feat zones.csv outdir
import json, glob, sys, os, math, csv, statistics as st, numpy as np
feat, zones_csv, out = sys.argv[1:4]
rng = np.random.default_rng(24)
Z = {}
for r in csv.DictReader(open(zones_csv)):
    y = int(r['year'])
    if 2023 <= y <= 2025:
        e = Z.setdefault((y, r['event']), {'zones': {}, 'dropped': 0, 'track': r['track']})
        if r['sim_from_m']: e['zones'][r['zone']] = (float(r['sim_from_m']), float(r['sim_to_m']))
        else: e['dropped'] += 1
lens = {}
rows = []
for f in sorted(glob.glob(os.path.join(feat, '*.jsonl'))):
    rows += [json.loads(l) for l in open(f)]
print('laps read', len(rows), 'with telemetry', sum(r['tel'] for r in rows), 'feature errors', sum('err' in r for r in rows))

# eligibility
def base_ok(r): return (not r['pout'] and not r['pin'] and r['time'] and r['status'] == '1' and r['compound'] in ('SOFT', 'MEDIUM', 'HARD') and not r['del'] and r.get('z'))
units = {}
for r in rows:
    if base_ok(r): units.setdefault((r['year'], r['event'], r['drv'], r['stint']), []).append(r)
elig = []
for k, laps in units.items():
    med = st.median(l['time'] for l in laps)
    elig += [l for l in laps if l['time'] <= 1.07 * med]
print('eligible laps', len(elig))

def ols_delta(y, X):
    X = np.column_stack([np.ones(len(y))] + X)
    if np.linalg.matrix_rank(X) < X.shape[1]: return None
    b, *_ = np.linalg.lstsq(X, y, rcond=None); return float(b[-1])

def fit(gd, gn, cov):  # gd/gn: lists of dict(t, covs...); returns Δ
    allr = gd + gn
    y = np.array([r['t'] for r in allr]); X = []
    for c in cov:
        x = np.array([r[c] for r in allr], float); X.append(x - x.mean())
    X.append(np.array([1.0] * len(gd) + [0.0] * len(gn)))
    return ols_delta(y, X)

def boot(gd, gn, cov, B=400):
    v = []
    for _ in range(B):
        a = [gd[i] for i in rng.integers(0, len(gd), len(gd))]; b = [gn[i] for i in rng.integers(0, len(gn), len(gn))]
        d = fit(a, b, cov)
        if d is not None: v.append(d)
    return float(np.std(v, ddof=1)) if len(v) > 20 else None

def grp(z):
    if z is None: return None
    g = z['gap_s']
    if z['state'] == 'open' and g is not None and 0.2 <= g <= 1.2: return 'drs'
    if z['state'] == 'closed' and (g is None or g >= 1.5): return 'no'
    return None

cases = []
# 2a per zone
byunit = {}
for l in elig:
    for n, z in l['z'].items():
        g = grp(z)
        if g: byunit.setdefault((l['year'], l['event'], l['drv'], l['stint'], n), {'drs': [], 'no': []})[g].append({'t': z['t_w'], 'v': z['v_act'], 'lap': l['lap']})
for k, g in sorted(byunit.items()):
    if len(g['drs']) >= 3 and len(g['no']) >= 3:
        d = fit(g['drs'], g['no'], ['v', 'lap'])
        if d is None: continue
        s = boot(g['drs'], g['no'], ['v', 'lap'])
        y, ev, drv, stint, n = k; zf, zt = Z[(y, ev)]['zones'][n]
        cases.append({'use': 'drs_zone', 'year': y, 'event': ev, 'track': Z[(y, ev)]['track'], 'driver': drv, 'stint': int(stint), 'zone': int(n), 'zone_from_m': zf, 'zone_to_m': zt,
                      'n_drs': len(g['drs']), 'n_nodrs': len(g['no']), 'meas_delta_s': d, 'sigma_meas_s': s})
# 2b per lap (events with every zone mapped)
lapu = {}
for l in elig:
    e = Z[(l['year'], l['event'])]
    if e['dropped'] or set(l['z']) != set(e['zones']): continue
    gs = [grp(l['z'][n]) for n in e['zones']]
    g = 'drs' if all(x == 'drs' for x in gs) else 'no' if all(x == 'no' for x in gs) else None
    if g: lapu.setdefault((l['year'], l['event'], l['drv'], l['stint']), {'drs': [], 'no': []})[g].append({'t': l['time'], 'lap': l['lap']})
for k, g in sorted(lapu.items()):
    if len(g['drs']) >= 3 and len(g['no']) >= 3:
        d = fit(g['drs'], g['no'], ['lap'])
        if d is None: continue
        s = boot(g['drs'], g['no'], ['lap'])
        y, ev, drv, stint = k
        cases.append({'use': 'drs_lap', 'year': y, 'event': ev, 'track': Z[(y, ev)]['track'], 'driver': drv, 'stint': int(stint), 'zone': '', 'zone_from_m': '', 'zone_to_m': '',
                      'n_drs': len(g['drs']), 'n_nodrs': len(g['no']), 'meas_delta_s': d, 'sigma_meas_s': s})

for i, c in enumerate(cases): c['case_id'] = f"{c['use']}-{i:04d}"
summ = {}
for use in ('drs_zone', 'drs_lap'):
    cs = [c for c in cases if c['use'] == use and c['sigma_meas_s'] is not None]
    if not cs: summ[use] = {'n_cases': 0}; continue
    sig = [c['sigma_meas_s'] for c in cs]; use_sig = st.median(sig)
    kept = [c for c in cs if c['sigma_meas_s'] <= 0.1]
    for c in cases:
        if c['use'] == use: c['kept'] = int(c['sigma_meas_s'] is not None and c['sigma_meas_s'] <= 0.1 and use_sig <= 0.1)
    rms = math.sqrt(sum(c['sigma_meas_s'] ** 2 for c in kept) / len(kept)) if kept else None
    md = st.median(c['meas_delta_s'] for c in (kept or cs))
    summ[use] = {'n_cases': len(cs), 'sigma_meas_median_s': use_sig, 'sigma_meas_p25_p75': [float(np.percentile(sig, 25)), float(np.percentile(sig, 75))],
                 'stop': use_sig > 0.1, 'n_kept': len(kept) if use_sig <= 0.1 else 0, 'median_meas_delta_s': md, 'effect_of_interest_s': abs(0.1 * md),
                 'mde_meas_s': 2.486 * rms / math.sqrt(len(kept)) if kept and use_sig <= 0.1 else None,
                 'n_events': len({(c['year'], c['event']) for c in cs}), 'share_cases_sigma_le_0.1': len(kept) / len(cs)}
cols = ['case_id', 'use', 'year', 'event', 'track', 'driver', 'stint', 'zone', 'zone_from_m', 'zone_to_m', 'n_drs', 'n_nodrs', 'meas_delta_s', 'sigma_meas_s', 'kept']
with open(os.path.join(out, 'f1-delta-cases-2026-11-24.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, cols); w.writeheader()
    for c in cases: w.writerow({k: (round(c[k], 4) if isinstance(c[k], float) else c[k]) for k in cols})

# mapping error (all eligible laps with DRS open in the zone)
mp = {}
for l in elig:
    e = Z[(l['year'], l['event'])]
    for n, z in l['z'].items():
        if z and z['state'] == 'open' and z['first_open_s'] is not None: mp.setdefault((l['year'], l['event'], n), []).append(z['first_open_s'] - e['zones'][n][0])
mapping = {f'{y}|{ev}|{n}': {'median_m': round(st.median(v), 1), 'n_laps': len(v)} for (y, ev, n), v in sorted(mp.items())}
# tow diagnostic (report-only): closed laps gap 1.5-2.5 s vs >= 3 s
tow = []
tu = {}
for l in elig:
    for n, z in l['z'].items():
        if z and z['state'] == 'closed' and z['gap_s'] is not None:
            g = 'near' if 1.5 <= z['gap_s'] <= 2.5 else 'far' if z['gap_s'] >= 3 else None
            if g: tu.setdefault((l['year'], l['event'], l['drv'], l['stint'], n), {'near': [], 'far': []})[g].append({'t': z['t_w'], 'v': z['v_act'], 'lap': l['lap']})
for k, g in tu.items():
    if len(g['near']) >= 3 and len(g['far']) >= 3:
        d = fit(g['near'], g['far'], ['v', 'lap'])
        if d is not None: tow.append(d)
summ['tow_diag'] = {'n_units': len(tow), 'median_s': st.median(tow) if tow else None, 'iqr': [float(np.percentile(tow, 25)), float(np.percentile(tow, 75))] if tow else None}
json.dump({'summary': summ, 'mapping': mapping}, open(os.path.join(out, 'cases-summary.json'), 'w'), indent=1)
print(json.dumps(summ, indent=1))
