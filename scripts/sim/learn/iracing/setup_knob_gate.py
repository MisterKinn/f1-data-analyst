# Gate G for SetupSim knobs against the iRacing SRS pro setups (model (iRacing)), one vote per track: leave the track out, scale the
# SetupSim knob position to the setup unit on the other tracks (least squares on the centred knob), predict each session's value
# relative to that car's median; the knob passes only if it beats "no track effect" by more than one SE.
# python setup_knob_gate.py <setup_by_session.csv>  (from setup_table.py). Result 2026-11-21: no knob passes (docs/setup-sim-classes.md).
import json, subprocess, sys, os
import numpy as np, pandas as pd
from scipy.stats import spearmanr
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from irmap import IR
V = pd.read_csv(sys.argv[1]); V['tid'] = V.track.str.lower().map(IR.get); V = V[V.tid.notna()]
CARS = {'GT3': 'gt3:bmw-m4-gt3', 'GTP': 'wec-lmdh', 'LMP': 'lmp2:oreca-07'}
K = json.loads(subprocess.run(['node', '--input-type=module', '-e', '''import {setupPlan} from './worker/lapsim/setup-plan.js'; const o = {};
for (const id of process.argv.slice(2)) { o[id] = {}; for (const [c, car] of Object.entries(%s)) { const p = setupPlan(id, car); if (p) for (const [k, v] of Object.entries(p.knobs)) o[id][c + ':' + k] = v.p; } }
console.log(JSON.stringify(o));''' % json.dumps(CARS), *sorted(V.tid.unique())], capture_output=True, text=True, check=True).stdout)
pick = lambda d, pats, agg='mean': d[d.key.str.fullmatch('|'.join(pats))].groupby('file').num.agg(agg)
MEAS = {'rideHeight': ([r'Chassis/(Left|Right)Rear/RideHeight'], 'mean'), 'springs': ([r'Chassis/(Left|Right)(Front|Rear)/SpringRate', r'Chassis/Front/HeaveSpring(Rate)?'], 'mean'),
        'aero': ([r'TiresAero/AeroBalanceCalc\w*/RearWingAngle', r'Chassis/Rear/(Rear)?WingAngle', r'Chassis/Rear/WingSetting', r'TiresAero/AeroBalanceCalc/WingSetting'], 'first'),
        'camber': ([r'Chassis/(Left|Right)(Front|Rear)/Camber'], 'mean'), 'diff': ([r'Chassis/(GearsDifferential|Differential)/DiffPreload'], 'first'),
        'tc': ([r'Chassis/InCarAdjustments/TcSetting'], 'first'), 'dampers': ([r'Dampers/(Front|Rear)Dampers/\w+Damping'], 'mean')}
for cls in CARS:
    D = V[V.cls == cls]; S = D.drop_duplicates('file').set_index('file')[['car', 'tid']]
    for k, (pats, agg) in MEAS.items():
        m = pick(D, pats, agg) * (-1 if k == 'camber' else 1); d = S.join(m.rename('v')).dropna()
        d['vd'] = d.v - d.groupby('car').v.transform('median'); d['k'] = d.tid.map(lambda i: K.get(i, {}).get(f'{cls}:{k}')); d = d.dropna()
        tr = d.tid.unique()
        if len(tr) < 4: continue
        g = []
        for t in tr:
            a, b = d[d.tid != t], d[d.tid == t]; kc = a.k.mean(); x = a.k - kc; s = (x * a.vd).sum() / max((x * x).sum(), 1e-9)
            g.append(np.mean(np.abs(b.vd)) - np.mean(np.abs(b.vd - s * (b.k - kc))))
        g = np.array(g); se = g.std(ddof=1) / np.sqrt(len(g)); tm = d.groupby('tid').agg(m=('vd', 'mean'), k=('k', 'first')); r = spearmanr(tm.k, tm.m)
        print(f"{cls} {k}: {len(tr)} tracks, {len(d)} sessions, gain {g.mean():.3f} SE {se:.3f} {'PASS' if g.mean() > se else 'REJECT'}; rank agreement rho {r.correlation:.2f} (p {r.pvalue:.3f}); track spread {tm.m.std():.2f}")
