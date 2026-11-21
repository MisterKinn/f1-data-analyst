# Offline: python3 driver_gate.py <results dir> (reads driver_events_*.csv from driver_events.py; derived numbers only).
# Gate G (v2) for iRacing driver patterns. Pre-registered 2026-11-22 08:4x KST, before any result was looked at:
#  type accuracy; held-out unit = track (leave one track out, per class); per held-out track the error = median |pred - obs| over its
#  corners/shifts; gain = baseline error - candidate error; pass if mean gain - k * SE > 0 over held-out tracks, k = 1.45 (m = 2
#  candidates per quantity: M1 class median, M2 class x apex-speed bin median); report per class (>= 5 tracks), decide per class.
#  Baselines = what the page draws today:
#   throttle rise 10->90 %: 0.22 s (first-order squeeze tau 0.10 s, ln 9 x tau; physics demand ramp not included -> lower bound)
#   throttle pick-up start vs apex (tPick10): 0 s (the physics demand starts after the speed minimum)
#   brake off vs apex (tBrakeOff): 0 s (physics brake need ends at the speed minimum; tail tau is separate and already learned)
#   upshift rpm / redline: 1.0 (max-power gear rule with a rev cap; most iRacing engines peak near the redline)
#   downshift rpm after / redline: none on the page (no baseline) -> table only
import sys, json, numpy as np, pandas as pd
c = pd.read_csv(sys.argv[1] + '/driver_events_corners.csv')
s = pd.read_csv(sys.argv[1] + '/driver_events_shifts.csv')
c['vbin'] = pd.cut(c.vmin * 3.6, [0, 90, 160, 999], labels=['slow', 'medium', 'fast'])
K = 1.45
def gate(df, col, base, cls_col='cls', bin_col='vbin'):
    rows = []
    for cl, d in df.dropna(subset=[col]).groupby(cls_col):
        tr = d.track.unique()
        if len(tr) < 5: rows.append(dict(cls=cl, tracks=len(tr), n=len(d), verdict='too few tracks')); continue
        g1, g2 = [], []
        for t in tr:
            te, trn = d[d.track == t], d[d.track != t]
            m1 = trn[col].median(); m2 = trn.groupby(bin_col, observed=True)[col].median()
            p2 = te[bin_col].map(m2).astype(float).fillna(m1)
            eb = (te[col] - base).abs().median(); e1 = (te[col] - m1).abs().median(); e2 = (te[col] - p2).abs().median()
            g1.append(eb - e1); g2.append(eb - e2)
        r = dict(cls=cl, tracks=len(tr), n=len(d), median=round(d[col].median(), 3), p25=round(d[col].quantile(.25), 3), p75=round(d[col].quantile(.75), 3))
        for nm, g in (('M1', g1), ('M2', g2)):
            g = np.array(g); se = g.std(ddof=1) / np.sqrt(len(g)); r[nm] = f"{g.mean():+.3f} ± {se:.3f} {'✓' if g.mean() - K * se > 0 else '✗'}"
        rows.append(r)
    return pd.DataFrame(rows)
out = {}
pd.set_option('display.width', 250)
for col, base, nm in (('rise1090', 0.22, 'throttle rise 10-90 % (s)'), ('tPick10', 0.0, 'throttle pick-up start vs apex (s)'),
                      ('tBrakeOff', 0.0, 'brake off vs apex (s)')):
    df = c[c.brake == 1] if col == 'tBrakeOff' else c
    if col == 'rise1090': df = df[df.rise1090 < 4]   # partial-throttle exits (no 90 % within 4 s) are not a foot movement
    print('\n==', nm); print(gate(df, col, base).to_string(index=False))
    print(df.groupby(['cls', 'vbin'], observed=True)[col].agg(['median', 'size']).round(3).unstack().to_string())
u = s[(s.dir == 'up') & (s.thr > 0.9) & (s.redline > 0)].copy(); u['r'] = u.rpmBefore / u.redline; u['vbin'] = 'all'
print('\n== upshift rpm / redline (flat-out upshifts)'); print(gate(u, 'r', 1.0, bin_col='vbin').to_string(index=False))
dn = s[(s.dir == 'down') & (s.redline > 0)].copy(); dn['ra'] = dn.rpmAfter / dn.redline
print('\n== downshift rpm after / redline'); print(dn.groupby('cls').ra.describe(percentiles=[.25, .5, .75]).round(3).to_string())
u['sl'] = u.slShift / u.redline; print('\n shift light / redline per class'); print(u.groupby('cls')[['r', 'sl']].median().round(3).to_string())
