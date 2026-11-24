# Step 24 v2 (a): offset of the telemetry lap frame (rel_distance × track length) against the simulator track frame.
# Per (year, event): median race speed trace (laps 10, 20, 30 of every driver) cross-correlated with the production 2025 car's simulated
# speed on the same track; lag searched over ±200 m, for the whole lap and for each third. Positive lag = telemetry runs ahead of the sim.
# No lap time is read. usage: python3 -I scripts/sim/f1-delta-offset.py <dir>/zones.csv <out.json>
import csv, json, sys, os, subprocess, requests, numpy as np
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
zones_csv, out = sys.argv[1:3]
here = os.path.dirname(os.path.abspath(__file__))
ys = os.environ.get('F1_DELTA_YEARS', '2023-2025').split('-'); Y0, Y1 = int(ys[0]), int(ys[-1])  # F1_DELTA_YEARS=2022: locked 2022 set
ev = sorted({(int(r['year']), r['event'], r['track']) for r in csv.DictReader(open(zones_csv)) if Y0 <= int(r['year']) <= Y1 and r['track']})
ids = sorted({t for _, _, t in ev})
js = "import('" + os.path.join(here, '../../worker/lapsim/kernel.js') + "').then(async K=>{const {lapsimAllTracks:T}=await import('" + os.path.join(here, '../../worker/lapsim/tracks.js') + "');const {carsFor}=await import('" + os.path.join(here, '../../worker/lapsim/scenario.js') + "');const k=K.lapsimKernel(),env=k.conditionsFromWeather({pressureHpa:1013.25,airTempC:25,humidityPct:50,trackTempC:35,windSpeed:0,windFromDeg:0}),o={};for(const id of " + json.dumps(ids) + "){const t=T[id];o[id]={ds:t.ds,v:k.simulateLap(k.trackFromData(t),carsFor(id)['2025'].car,env).v.map(x=>x*3.6)}}console.log(JSON.stringify(o))})"
SIM = json.loads(subprocess.check_output(['node', '-e', js]))
S = requests.Session()
def get(y, *p):
    try:
        r = S.get(f'https://raw.githubusercontent.com/TracingInsights/{y}/main/' + '/'.join(quote(x) for x in p), timeout=30)
        return r.json() if r.ok else None
    except Exception: return None
def lag_of(a, b, ds, lo, hi):  # a: telemetry on grid, b: sim on grid (same length, circular); best lag in metres over [lo, hi) indices
    n = len(b); best, bl = -1e9, 0
    for L in range(-int(200 / ds), int(200 / ds) + 1):
        idx = np.arange(lo, hi)
        x, y = a[idx], b[(idx - L) % n]
        m = np.isfinite(x)
        if m.sum() < 20: continue
        c = np.corrcoef(x[m], y[m])[0, 1]
        if c > best: best, bl = c, L
    return bl * ds, best
res = {}
for y, e, tid in ev:
    lt = get(y, e, 'Race', 'session_laptimes.json')
    if not lt: continue
    drv = sorted(set(lt['drv']))
    tels = [t for t in ThreadPoolExecutor(20).map(lambda a: get(y, e, 'Race', a[0], f'{a[1]}_tel.json'), [(d, l) for d in drv for l in (10, 20, 30)]) if t]
    sim = SIM[tid]; ds = sim['ds']; v = np.array(sim['v']); n = len(v); L = n * ds; grid = np.arange(n) * ds
    prof = []
    for t in tels:
        tt = t['tel']; f = lambda k: np.array([x if isinstance(x, (int, float)) else np.nan for x in tt[k]], float); s = f('rel_distance') * L; sp = f('speed')
        m = np.isfinite(s) & np.isfinite(sp)
        if m.sum() < 100: continue
        prof.append(np.interp(grid, np.maximum.accumulate(s[m]), sp[m], left=np.nan, right=np.nan))
    if len(prof) < 10: continue
    a = np.nanmedian(np.array(prof), axis=0)
    whole = lag_of(a, v, ds, 0, n)
    thirds = [lag_of(a, v, ds, k * n // 3, (k + 1) * n // 3)[0] for k in range(3)]
    res[f'{y}|{e}'] = {'track': tid, 'laps': len(prof), 'lag_m': whole[0], 'corr': round(float(whole[1]), 3), 'lag_thirds_m': thirds}
    print(y, e, res[f'{y}|{e}'], flush=True)
json.dump(res, open(out, 'w'), indent=1)
