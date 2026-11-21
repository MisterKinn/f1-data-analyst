# GT3 static rear weight share from the iRacing setups (rear corner weights / all four), per car, and Gate G against SetupSim's layout
# guess: leave one track out, one vote per car.  python setup_weight.py <setup_by_session.csv>  (from setup_table.py)
# Result 2026-11-21 (SRS 26S4, 407 sessions): 11 of 11 cars nearer, gain 0.0189, SE 0.0058 -> IR_REAR in worker/lapsim/setup-plan.js.
import sys
import numpy as np, pandas as pd

ASSUMED = {'Acura NSX GT3 EVO 22': .57, 'Aston Martin Vantage GT3 EVO': .52, 'Audi R8 LMS EVO II GT3': .57, 'BMW M4 GT3 EVO': .52, 'Chevrolet Corvette Z06 GT3.R': .57,
           'Ferrari 296 GT3': .57, 'Ford Mustang GT3': .52, 'Lamborghini Huracan GT3 EVO': .57, 'McLaren 720S GT3 EVO': .57, 'Mercedes-AMG GT3 2020': .52, 'Porsche 911 GT3 R (992)': .61}
V = pd.read_csv(sys.argv[1])
w = V[V.key.str.contains('CornerWeight') & (V.cls == 'GT3')].copy(); w['corner'] = w.key.str.extract(r'(LeftFront|RightFront|LeftRear|RightRear)')
p = w.pivot_table(index=['car', 'file', 'track'], columns='corner', values='num', aggfunc='first').dropna(); p = p[(p > 500).all(axis=1)]  # a few files store 0 N
p['rear'] = (p.LeftRear + p.RightRear) / p[['LeftFront', 'RightFront', 'LeftRear', 'RightRear']].sum(axis=1); p = p.reset_index()
rows = []
for car, g in p.groupby('car'):
    ea = [abs(ASSUMED[car] - r.rear) for r in g.itertuples()]; el = [abs(g[g.track != r.track].rear.median() - r.rear) for r in g.itertuples()]
    rows.append({'car': car, 'rear_median': round(g.rear.median(), 4), 'n': len(g), 'assumed': ASSUMED[car], 'assumed_mae': np.mean(ea), 'learned_mae': np.mean(el)})
d = pd.DataFrame(rows); d['gain'] = d.assumed_mae - d.learned_mae; se = d.gain.std(ddof=1) / np.sqrt(len(d))
print(d.round(4).to_string(index=False)); print('gain', round(d.gain.mean(), 4), 'SE', round(se, 4), 'PASS' if d.gain.mean() > se else 'REJECT', 'cars better', int((d.gain > 0).sum()), '/', len(d))
