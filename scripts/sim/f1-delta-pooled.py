# Step 24 v2: pooled DRS Δ per (year, event, zone) across drivers, driver×stint fixed effects, tow term (pre-reg v2).
# usage: python3 -I scripts/sim/f1-delta-pooled.py <dir>/feat <dir>/offset.json <out.csv> [--power]
#   --power: noise check only (σ_meas, MDE); Δ estimates are neither printed nor written (blind until central approval).
import json, glob, sys, os, math, csv, statistics as st, numpy as np
feat, offset_json, out = sys.argv[1:4]
POWER = '--power' in sys.argv
rng = np.random.default_rng(24)
off = json.load(open(offset_json))
rows = [json.loads(l) for f in sorted(glob.glob(os.path.join(feat, '*.jsonl'))) for l in open(f)]
ok = lambda r: not r['pout'] and not r['pin'] and r['time'] and r['status'] == '1' and r['compound'] in ('SOFT', 'MEDIUM', 'HARD') and not r['del'] and r.get('z')
units = {}
for r in rows:
    if ok(r): units.setdefault((r['year'], r['event'], r['drv'], r['stint']), []).append(r)
elig = [l for laps in units.values() for med in [st.median(x['time'] for x in laps)] for l in laps if l['time'] <= 1.07 * med]
# events left out: wet / poor frame match (offset corr < 0.93)
bad = {k for k, v in off.items() if v['corr'] < 0.93}
cases = {}
TRACK = {(r['year'], r['event']): r['track'] for r in rows}
for l in elig:
    if f"{l['year']}|{l['event']}" in bad: continue
    for n, z in l['z'].items():
        if not z: continue
        g = z['gap_s']
        if z['state'] == 'open' and g is not None and 0.2 <= g <= 1.0: d = 1
        elif z['state'] == 'closed' and (g is None or g >= 1.5): d = 0
        else: continue
        cases.setdefault((l['year'], l['event'], n), {}).setdefault((l['drv'], l['stint']), []).append((z['t_w'], z['v_act'], l['lap'], d, (1.0 - g) * d if d else 0.0))
def fit(us):  # within-unit demeaned OLS; returns (Δ at gap 1.0 s, tow slope β)
    Y, X = [], []
    for laps in us:
        a = np.array(laps, float)
        if len(a) < 2: continue
        a = a - a.mean(axis=0)
        Y.append(a[:, 0]); X.append(a[:, 1:])
    if not Y: return None
    Y, X = np.concatenate(Y), np.vstack(X)
    if np.linalg.matrix_rank(X) < X.shape[1]: return None
    b, *_ = np.linalg.lstsq(X, Y, rcond=None)
    return float(b[2]), float(b[3])
res = []
for k, us in sorted(cases.items()):
    both = [u for u in us.values() if any(x[3] for x in u) and not all(x[3] for x in u)]
    if len(both) < 5 or sum(x[3] for u in both for x in u) < 15: continue
    full = list(us.values()); f0 = fit(full)
    if not f0: continue
    bs = [fit([full[i] for i in rng.integers(0, len(full), len(full))]) for _ in range(400)]
    bs = [b for b in bs if b]
    sd = float(np.std([b[0] for b in bs], ddof=1))
    res.append({'case_id': f'pooled-{len(res):03d}', 'use': 'drs_zone_pooled', 'year': k[0], 'event': k[1], 'track': TRACK[(k[0], k[1])], 'driver': 'pooled', 'stint': '', 'zone': k[2], 'units': len(full), 'units_both': len(both), 'drs_laps': sum(x[3] for u in full for x in u),
                'nodrs_laps': sum(1 - x[3] for u in full for x in u), 'sigma_meas_s': round(sd, 4),
                **({} if POWER else {'meas_delta_s': round(f0[0], 4), 'tow_slope_s_per_s': round(f0[1], 4), 'sigma_sys_tow_s': round(abs(f0[1]) * 0.5, 4)})})
sig = [r['sigma_meas_s'] for r in res]
rms = math.sqrt(sum(s * s for s in sig) / len(sig))
stop = st.median(sig) > 0.1 or 2.486 * rms / math.sqrt(len(res)) > 0.1  # pre-reg v2 (c): σ_meas or MDE > 0.1 s → stop
for r in res: r['kept'] = int(not stop and r['sigma_meas_s'] <= 0.1)
summary = {'n_cases': len(res), 'n_events': len({(r['year'], r['event']) for r in res}), 'sigma_meas_median_s': st.median(sig),
           'sigma_meas_p25_p75_p90': [float(np.percentile(sig, q)) for q in (25, 75, 90)], 'share_sigma_le_0.1': sum(s <= 0.1 for s in sig) / len(sig),
           'mde_s': 2.486 * rms / math.sqrt(len(res)), 'stop': stop, 'excluded_events': sorted(bad)}
with open(out, 'w', newline='') as f:
    w = csv.DictWriter(f, list(res[0])); w.writeheader(); w.writerows(res)
print(json.dumps(summary, indent=1))
