# Step 24 v2: baseline Δ report vs the target (claude/target-lapsim-2026-11-24.md).
# usage: python3 -I scripts/sim/f1-delta-report.py <dir>/baseline.csv <dir>/pooled.csv <out.json>
import csv, json, sys, statistics as st, numpy as np
base, pooled, out = sys.argv[1:4]
P = {r['case_id']: r for r in csv.DictReader(open(pooled))}
rows = []
for r in csv.DictReader(open(base)):
    m, p, s = float(r['meas_delta_s']), float(r['pred_delta_s']), float(r['sigma_meas_s'])
    e = p - m
    rows.append({'event': f"{r['year']}|{r['event']}", 'track': r['track'], 'meas': m, 'pred': p, 'err': e, 'sig': s,
                 'ok': abs(e) <= max(0.25 * abs(m), 0.05), 'sign_ok': np.sign(p) == np.sign(m), 'rel': abs(e) / abs(m) if m else float('inf'),
                 'tow01': float(P[r['case_id']]['tow_slope_s_per_s']) * 0.1})
rng = np.random.default_rng(24)
def summ(rs):
    if not rs: return None
    ev = sorted({r['event'] for r in rs}); by = {e: [r['err'] for r in rs if r['event'] == e] for e in ev}
    bs = [np.mean([x for e in rng.choice(ev, len(ev)) for x in by[e]]) for _ in range(2000)]
    nok = [r for r in rs if not r['ok']]
    return {'n': len(rs), 'pass_rate': round(sum(r['ok'] for r in rs) / len(rs), 3), 'target_met': sum(r['ok'] for r in rs) / len(rs) >= 0.8 and all(r['sign_ok'] for r in rs),
            'sign_errors': sum(not r['sign_ok'] for r in rs), 'median_rel_error': round(st.median(r['rel'] for r in rs), 3),
            'bias_s': round(float(np.mean([r['err'] for r in rs])), 4), 'bias_ci95_s': [round(float(np.percentile(bs, 2.5)), 4), round(float(np.percentile(bs, 97.5)), 4)],
            'median_meas_s': round(st.median(r['meas'] for r in rs), 4), 'median_pred_s': round(st.median(r['pred'] for r in rs), 4),
            'fails_within_2sigma': sum(abs(r['err']) < 2 * r['sig'] for r in nok),
            'tow_gain_per_0.1s_median_s': round(st.median(r['tow01'] for r in rs), 4), 'tow_iqr_s': [round(float(np.percentile([r['tow01'] for r in rs], q)), 4) for q in (25, 75)]}
res = {'pooled': summ(rows), 'per_track': {t: summ([r for r in rows if r['track'] == t]) for t in sorted({r['track'] for r in rows})}}
json.dump(res, open(out, 'w'), indent=1); print(json.dumps(res['pooled'], indent=1))
