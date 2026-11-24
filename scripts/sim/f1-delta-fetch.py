# Step 24 fetch stage (pre-reg sections 1-2): per lap and zone features from TracingInsights, 2023-2025 Grand Prix races.
# usage: python3 -I scripts/sim/f1-delta-fetch.py <dir>/zones.csv <dir>/feat   (zones.csv from f1-delta-bench.mjs zones)
import csv, json, sys, os, math, requests, numpy as np
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote

zones_csv, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
S = requests.Session()
RAW = 'https://raw.githubusercontent.com/TracingInsights/{y}/main/{p}'
def get(y, *parts):
    for _ in range(3):
        try:
            r = S.get(RAW.format(y=y, p='/'.join(quote(x) for x in parts)), timeout=30)
            if r.status_code == 404: return None
            if r.ok: return r.json()
        except Exception: pass
    return None

L = {}  # (year, event) -> {'id', 'L', zones:[{n, from, to}]}
import subprocess
lens = json.loads(subprocess.check_output(['node', '-e', "import('"+os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../worker/lapsim/tracks.js')+"').then(m=>{const o={};for(const[k,t] of Object.entries(m.lapsimAllTracks))o[k]=t.kappa.length*t.ds;console.log(JSON.stringify(o))})"]))
for r in csv.DictReader(open(zones_csv)):
    y = int(r['year'])
    if not (2023 <= y <= 2025): continue
    e = L.setdefault((y, r['event']), {'id': r['track'], 'zones': [], 'dropped': []})
    if r['sim_from_m']: e['zones'].append({'n': int(r['zone']), 'from': float(r['sim_from_m']), 'to': float(r['sim_to_m'])})
    else: e['dropped'].append(int(r['zone']))
for e in L.values(): e['L'] = lens[e['id']]

def num(v):
    try:
        v = float(v); return v if math.isfinite(v) else None
    except Exception: return None

def feats(tel, nxt, laptime, Ltr, zones):
    t = tel['tel']; tm = np.array([num(x) if num(x) is not None else np.nan for x in t['time']])
    s = np.array([num(x) if num(x) is not None else np.nan for x in t['rel_distance']]) * Ltr
    v = np.array([num(x) if num(x) is not None else np.nan for x in t['speed']])
    drs = np.array([num(x) if num(x) is not None else np.nan for x in t['drs']])
    dah = np.array([num(x) if num(x) is not None else np.nan for x in t.get('DistanceToDriverAhead', [None] * len(tm))])
    ok = np.isfinite(tm) & np.isfinite(s)
    tm, s, v, drs, dah = tm[ok], np.maximum.accumulate(s[ok]), v[ok], drs[ok], dah[ok]
    if len(tm) < 50: return None
    # continuation into the next lap (zones that cross the line)
    if nxt is not None:
        n2 = nxt['tel']; tm2 = np.array([num(x) if num(x) is not None else np.nan for x in n2['time']]); s2 = np.array([num(x) if num(x) is not None else np.nan for x in n2['rel_distance']]) * Ltr
        ok2 = np.isfinite(tm2) & np.isfinite(s2); tm2, s2 = tm2[ok2], np.maximum.accumulate(s2[ok2])
        d2 = np.array([num(x) if num(x) is not None else np.nan for x in n2['drs']])[ok2]
        tmA, sA, drsA = np.concatenate([tm, laptime + tm2]), np.concatenate([s, Ltr + s2]), np.concatenate([drs, d2])
    else: tmA, sA, drsA = tm, s, drs
    res = {}
    for z in zones:
        a, b = z['from'], z['to']
        if b < a: b += Ltr
        e = b + 150
        if e > sA[-1] or a < s[0]: res[z['n']] = None; continue
        win = (sA >= a - 50) & (sA <= b); W = (sA >= a) & (sA <= e)
        dw, dW = drsA[win], drsA[W]
        open_ = bool(np.any((dw == 1)))
        closed = bool(len(dW) and np.all(dW == 0))
        state = 'open' if open_ else 'closed' if closed else 'excl'
        va = float(np.interp(a, s, v)); ga = float(np.interp(a, s, dah)) if np.isfinite(dah).any() else float('nan')
        gap = ga / (va / 3.6) if va > 0 and math.isfinite(ga) else None
        tw = float(np.interp(e, sA, tmA) - np.interp(a, sA, tmA))
        # first open sample after s_act - 300 m (mapping error, laps with DRS open only)
        fo = None
        if open_:
            m = (sA >= a - 300) & (drsA == 1)
            if m.any(): fo = float(sA[np.argmax(m)])
        res[z['n']] = {'state': state, 'v_act': va, 'gap_s': gap, 't_w': tw, 'first_open_s': fo}
    return res

def driver_job(y, ev, info, lt, drv):
    idx = [i for i, d in enumerate(lt['drv']) if d == drv]
    laps = {int(lt['lap'][i]): i for i in idx}
    rows = []
    tels = {}
    for ln in sorted(laps):
        if ln >= 2: tels[ln] = get(y, ev, 'Race', drv, f'{ln}_tel.json')
    for ln, i in sorted(laps.items()):
        if ln < 3: continue
        lt_ = num(lt['time'][i])
        row = {'year': y, 'event': ev, 'track': info['id'], 'drv': drv, 'lap': ln, 'stint': num(lt['stint'][i]), 'compound': lt['compound'][i], 'status': str(lt['status'][i]),
               'pout': str(lt['pout'][i]) != 'None', 'pin': str(lt['pin'][i]) != 'None', 'del': lt['del'][i] is True, 'time': lt_}
        tel = tels.get(ln)
        row['tel'] = tel is not None
        if tel is not None and lt_:
            try: row['z'] = feats(tel, tels.get(ln + 1), lt_, info['L'], info['zones'])
            except Exception as ex: row['err'] = str(ex)[:80]
        rows.append(row)
    return rows

for (y, ev), info in sorted(L.items()):
    fn = os.path.join(out, f'{y}-{ev.replace(" ", "_")}.jsonl')
    if os.path.exists(fn): continue
    lt = get(y, ev, 'Race', 'session_laptimes.json')
    if not lt: open(fn + '.missing', 'w').write('no laptimes'); continue
    drivers = sorted(set(lt['drv']))
    with ThreadPoolExecutor(20) as ex:
        res = list(ex.map(lambda d: driver_job(y, ev, info, lt, d), drivers))
    with open(fn + '.tmp', 'w') as f:
        for rows in res:
            for r in rows: f.write(json.dumps(r) + '\n')
    os.rename(fn + '.tmp', fn)
    print(y, ev, sum(len(r) for r in res), flush=True)
