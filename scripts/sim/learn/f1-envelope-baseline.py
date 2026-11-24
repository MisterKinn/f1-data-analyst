# Step 28 baseline (no model change): speed-trace error of the shipped F1 car vs 2023-2025 qualifying fastest laps, per corner segment,
# plus lap error, per event and per track. Feeds the power check of the step-28 pre-registration. 2022 is never read (assert).
# Data: TracingInsights (FastF1 car data) at one pinned commit per season (TI_REFS). Distance = speed integrated over time, scaled to
# the simulator track length. Frame lag vs the sim: step 24 v2 method (lag_of from f1-delta-offset.py, +-200 m); drop corr < 0.93.
# usage: python3 -I scripts/sim/learn/f1-envelope-baseline.py <zone-mapping-table.csv> <out.json>
import csv, json, sys, os, subprocess, requests, numpy as np
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
TI_REFS = {2023: '737c84d3ae14b9883a671ca248d015b69cf1cb58', 2024: 'd1543a71370d9b617b627319f8ad80b2f85dfd5e',
           2025: 'dfb3ea3f50b69857fe8e40cabe5e899743c59f6a'}
SLICK = {'SOFT', 'MEDIUM', 'HARD'}
SEG_M, PROM_KPH, BIN = 150.0, 10.0, (120.0, 240.0)
zcsv, out = sys.argv[1:3]
here = os.path.dirname(os.path.abspath(__file__))
ev = sorted({(int(r['year']), r['event'], r['track']) for r in csv.DictReader(open(zcsv)) if 2023 <= int(r['year']) <= 2025 and r['track']})
assert ev and all(y in TI_REFS for y, _, _ in ev)  # 2022 LOCKED: never requested
# production path as scripts/sim/f1-delta-bench.mjs model stage: 2025 car, its grip and timeScale, production weather, and the
# event's own DRS zones open (qualifying, 2023-2025 rules)
Z = {}
for r in csv.DictReader(open(zcsv)):
    if 2023 <= int(r['year']) <= 2025 and r['track'] and r['sim_from_m']: Z.setdefault(f"{r['year']}|{r['event']}", []).append([float(r['sim_from_m']), float(r['sim_to_m'])])
jobs = [[f'{y}|{e}', t, Z.get(f'{y}|{e}', [])] for y, e, t in ev]
P = lambda f: os.path.join(here, '../../../worker/lapsim/' + f)
js = ("Promise.all([import('" + P('kernel.js') + "'),import('" + P('tracks.js') + "'),import('" + P('scenario.js') + "')]).then(([Km,{lapsimAllTracks:T},{carsFor,realConditions}])=>{"
      "const K=Km.lapsimKernel(),o={};for(const [key,id,zs] of " + json.dumps(jobs) + "){const d=T[id],c=carsFor(id)['2025'],cs=realConditions(id),real=cs['2025']||cs['2026']||Object.values(cs)[0]||{};"
      "const p=(k,f)=>Number.isFinite(real[k])?real[k]:f;const env=K.conditionsFromWeather({airTempC:p('airTempC',25),trackTempC:p('trackTempC',35),humidityPct:p('humidityPct',50),pressureHpa:p('pressureHpa',1013.25),windSpeed:p('windSpeed',0),windFromDeg:p('windFromDeg',0)});"
      "let tr=K.trackFromData(d);tr={...tr,aeroLow:zs.length?K.trackFromData({...d,aeroZones:zs},{aero:'fia'}).aeroLow:new Uint8Array(d.kappa.length)};const g=c.grip||1;tr={...tr,mu:Float64Array.from(tr.mu,m=>m*g)};"
      "const r=K.simulateLap(tr,c.car,env);o[key]={ds:d.ds,v:Array.from(r.v,x=>x*3.6),lap:r.lapTime*(c.timeScale||1)}}console.log(JSON.stringify(o))})")
SIM = json.loads(subprocess.check_output(['node', '-e', js]))
S = requests.Session()
def get(y, *p):
    for _ in range(3):
        try:
            r = S.get(f'https://raw.githubusercontent.com/TracingInsights/{y}/{TI_REFS[y]}/' + '/'.join(quote(x) for x in p), timeout=30)
            if r.status_code == 404: return None
            if r.ok: return r.json()
        except Exception: pass
    return None
def lag_of(a, b, ds, lo, hi):  # copied from scripts/sim/f1-delta-offset.py (step 24 v2): best lag in metres, positive = telemetry ahead
    n = len(b); best, bl = -1e9, 0
    for L in range(-int(200 / ds), int(200 / ds) + 1):
        idx = np.arange(lo, hi); x, y = a[idx], b[(idx - L) % n]; m = np.isfinite(x)
        if m.sum() < 20: continue
        c = np.corrcoef(x[m], y[m])[0, 1]
        if c > best: best, bl = c, L
    return bl * ds, best
def num(v): return float(v) if isinstance(v, (int, float)) else np.nan
def one(e):
    y, name, tid = e
    base = {'year': y, 'event': name, 'track': tid}
    lt = get(y, name, 'Qualifying', 'session_laptimes.json')
    if not lt: return {**base, 'drop': 'no laptimes'}
    t = np.array([num(x) for x in lt['time']]); i = int(np.nanargmin(t))
    comp = (lt.get('compound') or [None] * len(t))[i]
    if comp not in SLICK: return {**base, 'drop': f'compound {comp}'}
    if any(c in ('INTERMEDIATE', 'WET') for c in lt.get('compound') or []): return {**base, 'drop': 'mixed session (inter/wet laps)'}
    tel = get(y, name, 'Qualifying', lt['drv'][i], f"{lt['lap'][i]}_tel.json")
    if not tel: return {**base, 'drop': 'no tel'}
    tt = tel['tel']; tm = np.array([num(x) for x in tt['time']]); sp = np.array([num(x) for x in tt['speed']])
    m = np.isfinite(tm) & np.isfinite(sp); tm, sp = tm[m], sp[m]
    if len(sp) < 300 or np.any(np.diff(tm) <= 0) or np.max(np.diff(tm)) > 1.0: return {**base, 'drop': 'telemetry gap'}
    s = np.concatenate([[0], np.cumsum(np.diff(tm) * (sp[1:] + sp[:-1]) / 2 / 3.6)])
    sim = SIM[f'{y}|{name}']; ds = sim['ds']; vs = np.array(sim['v']); n = len(vs); L = n * ds; grid = np.arange(n) * ds
    a = np.interp(grid, s * L / s[-1], sp, left=np.nan, right=np.nan)
    lag, corr = lag_of(a, vs, ds, 0, n)
    if corr < 0.93: return {**base, 'drop': f'corr {corr:.3f}'}
    vm = np.roll(vs, int(round(lag / ds)))  # sim on the telemetry frame
    w = int(SEG_M / ds); segs = []
    for k in range(n):
        if not np.isfinite(a[k]): continue
        win = a[np.arange(k - w, k + w + 1) % n]
        if a[k] == np.nanmin(win) and np.nanmax(win) - a[k] >= PROM_KPH and not (segs and k - segs[-1]['i'] < w):
            idx = np.arange(k - w, k + w + 1) % n; d = (vm[idx] - a[idx])[np.isfinite(a[idx])]
            segs.append({'i': k, 'apex_meas': round(float(a[k]), 1), 'apex_model': round(float(vm[k]), 1),
                         'rms': round(float(np.sqrt(np.mean(d ** 2))), 2), 'bias': round(float(np.mean(d)), 2), 'pts': int(len(d))})
    inb = [g for g in segs if BIN[0] <= g['apex_meas'] < BIN[1]]
    rms_b = float(np.sqrt(sum(g['rms'] ** 2 * g['pts'] for g in inb) / sum(g['pts'] for g in inb))) if inb else None
    return {**base, 'drv': lt['drv'][i], 'lap_no': lt['lap'][i], 'compound': comp, 'lag_m': lag, 'corr': round(float(corr), 3),
            'lap_meas_s': float(t[i]), 'lap_model_s': sim['lap'], 'lap_err_pct': round(100 * (sim['lap'] - t[i]) / t[i], 3),
            'n_seg': len(segs), 'n_seg_bin': len(inb), 'rms_bin_kph': None if rms_b is None else round(rms_b, 2),
            'bias_bin_kph': None if not inb else round(float(np.mean([g['bias'] for g in inb])), 2), 'segments': segs}
rows = list(ThreadPoolExecutor(12).map(one, ev))
json.dump({'ti_refs': {str(k): v for k, v in TI_REFS.items()}, 'seg_m': SEG_M, 'prom_kph': PROM_KPH, 'bin_kph': BIN, 'rows': rows}, open(out, 'w'), indent=1)
ok = [r for r in rows if 'drop' not in r]
print('events', len(rows), 'kept', len(ok), 'tracks', len({r['track'] for r in ok}))
for r in rows:
    if 'drop' in r: print('  drop', r['year'], r['event'], r['drop'])
