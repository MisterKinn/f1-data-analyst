"""One onboard lap: engine sound + wheel-display gear -> speed trace; lap start found where the speed minima land on the
map's corners. Usage: python3 -I runlap.py wav gear.json track lap_s official_len out_prefix [lo hi] (model / learned from video)"""
import sys, json, numpy as np
sys.path.insert(0, __import__('os').path.dirname(__file__))
import gear_speed as G
from scipy.ndimage import uniform_filter1d
TRACKS = __import__('os').environ.get('LAPSIM_TRACK_JSON', '.cache/track-json')
wav, gj, trk, LAP, OFF, out = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), sys.argv[6]
lo, hi = (float(sys.argv[7]), float(sys.argv[8])) if len(sys.argv) > 8 else (35, 80)
T = json.load(open(f'{TRACKS}/{trk}.json')); Lm = T['length']; cs = np.array([c[1] for c in T['corners']], float)
dur = max(t for t, _ in json.load(open(gj)))


def lapfor(t0):
    t, v, f0, gt, info = G.speed(wav, t0, LAP, OFF, gj, t0, lo=lo, hi=hi)
    k = (t >= 0) & (t <= LAP); tt, vs = t[k], uniform_filter1d(v[k], 20)
    D = np.concatenate([[0], np.cumsum((vs[1:] + vs[:-1]) / 2 * np.diff(tt))]) / 3.6 * Lm / OFF
    mins = [i for i in range(80, len(tt) - 80) if vs[i] == vs[i - 80:i + 81].min() and vs[max(0, i - 240):i + 241].max() - vs[i] > 25]
    return tt, vs, D, mins, gt, t, info


best = None
for t0 in np.arange(0, max(0.2, dur - LAP), 0.2):
    tt, vs, D, mins, *_ = lapfor(t0)
    if not mins: continue
    e = np.array([np.min(np.abs(cs - D[i])) for i in mins]); score = float(np.mean(np.minimum(e, 150)))
    score += 40.0 * max(0, 6 - len(mins)) + 300.0 * abs(np.log(vs[0] / vs[-1]))     # enough corners; same speed at start and end of the lap
    if best is None or score < best[0]: best = (score, t0)
t0 = best[1]; tt, vs, D, mins, gt, t, info = lapfor(t0)
rows = [[round(float(D[i])), round(float(vs[i])), T['corners'][int(np.argmin(np.abs(cs - D[i])))][0], round(float(D[i] - cs[np.argmin(np.abs(cs - D[i]))]))] for i in mins]
res = {'track': trk, 'lap_s': LAP, 't0_video': round(float(t0), 2), 'mean_corner_miss_m': round(best[0], 1), 'top_kmh': round(float(np.percentile(vs, 99.5))),
       'corner_min': rows, 'info': info, 'trace_m_kmh': [[round(float(a)), round(float(b))] for a, b in zip(D[::40], vs[::40])]}
json.dump(res, open(out + '.json', 'w')); print(json.dumps({k: v for k, v in res.items() if k != 'trace_m_kmh'}))
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig, ax = plt.subplots(1, 1, figsize=(13, 4.5)); ax.plot(D, vs, 'tab:red'); ax.grid(alpha=.3)
for c in T['corners']: ax.axvline(c[1], color='k', ls=':', lw=.6); ax.text(c[1] + 10, np.min(vs), 'T' + str(c[0]), fontsize=7)
ax.set_ylabel('km/h (model / learned from video)'); ax.set_xlabel('m from start line (map)'); ax.set_title(out.split('/')[-1] + f'  lap {LAP}s')
plt.tight_layout(); plt.savefig(out + '.png', dpi=75)
