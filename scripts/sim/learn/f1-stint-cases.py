# Step 29a: F1 race stint cases (tyre wear w_c and fuel + track trend phi) with per-case noise, from TracingInsights race laps.
# Rules: claude/rules-step29a-stint-2026-11-25.md (sha256 4e024f79...) + amendment 1 (fit with one intercept per driver). Report-only; no model input.
# usage: python3 -I scripts/sim/learn/f1-stint-cases.py <out.csv> <out.json> <ti-2023 dir> <ti-2024 dir> <ti-2025 dir>
import csv, json, math, os, subprocess, sys
import numpy as np

REF_LAPS, B, SEED, GAP, F0 = 20, 2000, 29, 2.0, 0.030
COMP = ('SOFT', 'MEDIUM', 'HARD')
empty = lambda v: v is None or v == '' or v == 'None' or (isinstance(v, float) and not math.isfinite(v))
def num(v):
    try: v = float(v); return v if math.isfinite(v) else None
    except Exception: return None
true = lambda v: v is True or v == 'True'

def clean(d):
    """Laps of one race after rules 3.1-3.7 and the stint rule; (None, reason) if the event is dropped."""
    n = len(d['lap'])
    if any(true(x) for x in d.get('wR', [])): return None, 'rain'
    if any(c in ('INTERMEDIATE', 'WET') for c in d['compound']): return None, 'inter/wet'
    L = [dict(drv=d['drv'][i], num=d['dNum'][i], lap=int(d['lap'][i]), t=num(d['time'][i]), sesT=num(d['sesT'][i]), comp=d['compound'][i],
              stint=d['stint'][i], age=num(d['life'][i]), fresh=true(d['fresh'][i]), st=str(d['status'][i]), pin=d['pin'][i], pout=d['pout'][i],
              dl=true(d['del'][i]), acc=true(d['iacc'][i])) for i in range(n) if num(d['lap'][i]) is not None]
    N = max(l['lap'] for l in L)
    # traffic: gap to the previous line crossing of any other car, at this lap's end
    cross = sorted((l['sesT'], l['drv']) for l in L if l['sesT'] is not None)
    T = np.array([c[0] for c in cross])
    def gap_at(s, drv):
        k = np.searchsorted(T, s) - 1
        while k >= 0 and cross[k][1] == drv: k -= 1
        return s - T[k] if k >= 0 else math.inf
    by = {}
    for l in L: by.setdefault(l['drv'], {})[l['lap']] = l
    for l in L: l['gapEnd'] = gap_at(l['sesT'], l['drv']) if l['sesT'] is not None else None
    keep = []
    for l in L:
        p = by[l['drv']].get(l['lap'] - 1)
        ok = (l['comp'] in COMP and l['t'] is not None and not l['dl'] and l['acc'] and l['age'] is not None
              and 3 <= l['lap'] <= N - 2 and empty(l['pin']) and empty(l['pout']) and set(l['st']) == {'1'}
              and p is not None and set(p['st']) == {'1'} and empty(p['pout'])                       # rules 4, 5
              and l['gapEnd'] is not None and l['gapEnd'] >= GAP and p['gapEnd'] is not None and p['gapEnd'] >= GAP)  # rule 6
        if ok: keep.append(l)
    med = {}
    for l in keep: med.setdefault(l['drv'], []).append(l['t'])
    med = {k: float(np.median(v)) for k, v in med.items()}
    keep = [l for l in keep if l['t'] < 1.07 * med[l['drv']]]                                     # rule 7
    st = {}
    for l in keep: st.setdefault((l['drv'], l['stint']), []).append(l)
    keep = [l for s in st.values() if len(s) >= 8 and max(x['age'] for x in s) - min(x['age'] for x in s) >= 8 for l in s]
    return dict(laps=keep, N=N), None

def fit(laps):
    """Amendment 1: alpha[driver] + o_c (vs reference compound) + w_c * age + phi * (lap - 1). None if not identified."""
    keys = sorted({l['key'] for l in laps}, key=str); ki = {k: i for i, k in enumerate(keys)}
    comps = [c for c in COMP if any(l['comp'] == c for l in laps)]
    ref = 'MEDIUM' if 'MEDIUM' in comps else comps[0]; offs = [c for c in comps if c != ref]
    nk, no, nc = len(keys), len(offs), len(comps)
    X = np.zeros((len(laps), nk + no + nc + 1)); y = np.array([l['t'] for l in laps])
    for r, l in enumerate(laps):
        X[r, ki[l['key']]] = 1
        if l['comp'] in offs: X[r, nk + offs.index(l['comp'])] = 1
        X[r, nk + no + comps.index(l['comp'])] = l['age']; X[r, -1] = l['lap'] - 1
    if np.linalg.matrix_rank(X) < X.shape[1]: return None
    b = np.linalg.lstsq(X, y, rcond=None)[0]
    return dict(w={c: b[nk + no + i] for i, c in enumerate(comps)}, phi=b[-1], res=y - X @ b)

def multi(laps): return sum(1 for v in {}.fromkeys(l['drv'] for l in laps) if len({l['stint'] for l in laps if l['drv'] == v}) >= 2)

def values(f, N):
    out = {('fuel', None): -f['phi'] * REF_LAPS}
    for c, w in f['w'].items(): out[('wear', c)] = w * REF_LAPS
    return out

def event(d):
    e, why = clean(d)
    if e is None: return None, why
    laps, N = e['laps'], e['N']
    for l in laps: l['key'] = l['drv']  # amendment 1: one intercept per driver
    if multi(laps) < 6: return None, f'not separable ({multi(laps)} drivers with 2+ stints)'
    f = fit(laps)
    if f is None: return None, 'rank'
    r = f['res']; mad = 1.4826 * np.median(np.abs(r - np.median(r)))
    laps = [l for l, x in zip(laps, r) if abs(x - np.median(r)) <= 3 * mad]                     # rule 8, one pass
    f = fit(laps)
    if f is None or multi(laps) < 6: return None, 'not separable after MAD pass'
    base = values(f, N)
    drvs = sorted({l['drv'] for l in laps}, key=lambda v: int(next(l['num'] for l in laps if l['drv'] == v)))
    rng = np.random.default_rng(SEED); boot = {k: [] for k in base}; fail = 0
    byd = {v: [l for l in laps if l['drv'] == v] for v in drvs}
    for _ in range(B):
        pick = rng.integers(0, len(drvs), len(drvs)); bl = []
        for j, p in enumerate(pick): bl += [dict(l, key=j) for l in byd[drvs[p]]]
        g = fit(bl)
        if g is None: fail += 1; continue
        for k, v in values(g, N).items():
            if k in boot: boot[k].append(v)
    halves = [[l for l in laps if drvs.index(l['drv']) % 2 == h] for h in (0, 1)]
    hf = [fit(h) for h in halves]
    hv = [values(g, N) if g else {} for g in hf]
    stints = {}
    for l in laps: stints.setdefault((l['drv'], l['stint']), []).append(l)
    rows = []
    b = 100.0 / N
    for (q, c), v in base.items():
        ss = [s for s in stints.values() if c is None or s[0]['comp'] == c]
        if q == 'wear' and len(ss) < 4: continue
        sb = float(np.std(boot[(q, c)], ddof=1)) if len(boot[(q, c)]) > 10 else math.nan
        sp = abs(hv[0][(q, c)] - hv[1][(q, c)]) / 2 if all((q, c) in h for h in hv) else math.nan
        prior = None
        if q == 'wear':  # cross-check: per-stint age slope + fixed fuel prior f0 * b, mean over stints
            sl = [np.polyfit([x['age'] for x in s], [x['t'] for x in s], 1)[0] for s in ss]
            prior = (float(np.mean(sl)) + F0 * b) * REF_LAPS
        rows.append(dict(quantity=q, compound=c or '', delta_s=v, per_unit=(v / REF_LAPS if q == 'wear' else v / REF_LAPS / b),
                         unit='s/lap' if q == 'wear' else 's/kg', sigma_boot=sb, sigma_split=sp,
                         sigma_meas=max(x for x in (sb, sp) if math.isfinite(x)) if math.isfinite(sb) or math.isfinite(sp) else math.nan,
                         split_ok=math.isfinite(sp), prior_check_s=prior, n_laps=sum(len(s) for s in ss), n_stints=len(ss),
                         n_drivers=len({s[0]['drv'] for s in ss}), n_multi=multi(laps), boot_fail=fail, race_laps=N))
    return rows, None

def main():
    out_csv, out_json, dirs = sys.argv[1], sys.argv[2], sys.argv[3:6]
    rows, drops, refs = [], [], {}
    for y, root in zip((2023, 2024, 2025), dirs):
        refs[y] = subprocess.check_output(['git', '-C', root, 'rev-parse', 'HEAD'], text=True).strip()
        for ev in sorted(os.listdir(root)):
            p = os.path.join(root, ev, 'Race', 'session_laptimes.json')
            if not os.path.isfile(p): continue
            r, why = event(json.load(open(p)))
            if r is None: drops.append(dict(season=y, event=ev, reason=why)); print(y, ev, 'dropped:', why, flush=True); continue
            for x in r: rows.append(dict(season=y, event=ev, **x))
            print(y, ev, len(r), 'cases', flush=True)
    cols = ['season', 'event', 'quantity', 'compound', 'delta_s', 'per_unit', 'unit', 'sigma_boot', 'sigma_split', 'sigma_meas', 'split_ok',
            'prior_check_s', 'n_laps', 'n_stints', 'n_drivers', 'n_multi', 'boot_fail', 'race_laps']
    with open(out_csv, 'w', newline='') as fh:
        w = csv.DictWriter(fh, cols, lineterminator='\n'); w.writeheader()
        for r in rows: w.writerow({k: (f'{r[k]:.5f}' if isinstance(r[k], float) else r[k]) for k in cols})
    json.dump(dict(rules_sha256='4e024f79525f7cac766308204893ba7537cdd5c3bae779960eb225bd0d60a5bd', ti_commits=refs,
                   ref_laps=REF_LAPS, bootstrap=B, seed=SEED, gap_s=GAP, dropped=drops), open(out_json, 'w'), indent=1)

if __name__ == '__main__':
    main()
