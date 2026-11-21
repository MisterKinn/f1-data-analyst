"""Road speed from engine sound + the gear shown on the steering-wheel display (model / learned from video).
- f0(t): engine order (harmonic comb). Clean stretches are joined into runs by upshifts / same gear (as gears2).
- The wheel display gives the gear wherever it can be read; each run gets the gear that best fits those reads
  (gear rises by one at each upshift inside the run). Runs without reads: the gear that best joins the neighbours.
- Gear ratios: every upshift g->g+1 gives speed-per-f0 of g+1 over g (f_before/f_after); the ladder is their product.
- speed = f0 * ladder[gear]; the lap covers the circuit length (absolute scale)."""
import json, numpy as np
from scipy.signal import medfilt
from scipy.ndimage import uniform_filter1d, binary_closing
from engine_comb import comb


def speed(wav, t0, lap_s, length, gear_json, video_t0, lo=30, hi=110, qmin=2.2):
    t, f0, q = comb(wav, lo, hi)
    m = (t >= t0 - 3) & (t <= t0 + lap_s + 3); t, f0, q = t[m] - t0, f0[m], q[m]
    lf = medfilt(np.log(f0), 5); clean = binary_closing(uniform_filter1d(q, 9) > qmin, np.ones(5)) & (np.abs(np.r_[0, np.diff(lf)]) < 0.03)
    segs, i = [], 0
    while i < len(t):
        if clean[i]:
            j = i
            while j + 1 < len(t) and clean[j + 1] and abs(lf[j + 1] - lf[j]) < 0.03: j += 1
            if t[j] - t[i] >= 0.3: segs.append([i, j])
            i = j + 1
        else: i += 1
    link = [None]
    for n in range(1, len(segs)):
        pa, pb = segs[n - 1]; a, b = segs[n]; gap = t[a] - t[pb]
        sa = np.polyfit(t[max(pa, pb - 8):pb + 1], lf[max(pa, pb - 8):pb + 1], 1)[0]
        r = float(np.exp(lf[pb] + sa * min(gap, 0.3) - lf[a]))
        if gap < 0.35 and 1.04 < r < 1.35 and sa > -0.1: link.append(('up', r))
        elif (gap < 0.5 and abs(np.log(r)) < 0.03) or (gap < 0.2 and abs(np.log(r)) < 0.06): link.append(('same', 1.0))
        else: link.append(None)
    runs, cur = [], [0]
    for n in range(1, len(segs)):
        if link[n] is None: runs.append(cur); cur = [n]
        else: cur.append(n)
    runs.append(cur)
    reads = [(tt - video_t0, g) for tt, g in json.load(open(gear_json)) if g is not None]
    gear = {}
    for run in runs:
        off = {}; k = 0
        for idx, n in enumerate(run):
            if idx and link[n][0] == 'up': k += 1
            a, b = segs[n]
            for tt, g in reads:
                if t[a] - 0.1 <= tt <= t[b] + 0.1: off.setdefault(g - k, 0); off[g - k] += 1
        if off:
            base = max(off, key=off.get); k = 0
            for idx, n in enumerate(run):
                if idx and link[n][0] == 'up': k += 1
                gear[n] = base + k
    # pair ratios from labelled upshifts
    pr = {}
    for n in range(1, len(segs)):
        if link[n] and link[n][0] == 'up' and n in gear and n - 1 in gear and gear[n] == gear[n - 1] + 1:
            pr.setdefault(gear[n - 1], []).append(link[n][1])
    G = 8; pair = np.array([np.exp(np.median(np.log(pr[g]))) if g in pr else np.nan for g in range(1, G)])
    ok = np.isfinite(pair)
    if ok.sum() >= 2:                                             # missing pairs: straight line in log through known ones
        pp = np.polyfit(np.where(ok)[0], np.log(pair[ok]), 1); pair[~ok] = np.exp(np.polyval(pp, np.where(~ok)[0]))
    else: pair[~ok] = 1.13
    # speed per f0 for gear g (g = 1..7): grows with g; ladder[g] = prod(pair[:g-1])
    ladder = np.r_[1.0, np.cumprod(pair)]                         # index g-1
    lv = np.full(len(t), np.nan)
    def paint(n, g):
        a, b = segs[n]; lv[a:b + 1] = lf[a:b + 1] + np.log(ladder[int(np.clip(g, 1, G)) - 1])
    for n, g in gear.items(): paint(n, g)
    for _ in range(3):                                            # unlabelled runs: best join with neighbours
        for run in runs:
            if run[0] in gear: continue
            a0, b0 = segs[run[0]][0], segs[run[-1]][1]
            prev = lv[:a0][np.isfinite(lv[:a0])]; nxt = lv[b0 + 1:][np.isfinite(lv[b0 + 1:])]
            if not len(prev) and not len(nxt): continue
            best = None
            for g0 in range(1, G + 1):
                k = 0; s0 = lf[a0] + np.log(ladder[g0 - 1]); e = 0.0
                ups = sum(1 for n in run[1:] if link[n][0] == 'up')
                if g0 + ups > G: continue
                s1 = lf[b0] + np.log(ladder[g0 + ups - 1])
                if len(prev): e += max(0.0, s0 - prev[-1]) * 3 + max(0.0, prev[-1] - s0) * 0.5
                if len(nxt): e += abs(s1 - nxt[0])
                if best is None or e < best[0]: best = (e, g0)
            if best:
                k = 0
                for idx, n in enumerate(run):
                    if idx and link[n][0] == 'up': k += 1
                    gear[n] = best[1] + k; paint(n, gear[n])
    okv = np.isfinite(lv); lvi = np.interp(t, t[okv], lv[okv]); v = np.exp(medfilt(lvi, 9))
    lap = (t >= 0) & (t <= lap_s); c = np.trapezoid(v[lap], t[lap]) / (3.6 * length)
    gtrace = np.full(len(t), np.nan)
    for n, g in gear.items(): a, b = segs[n]; gtrace[a:b + 1] = g
    info = {'runs': len(runs), 'labelled_by_display': sum(1 for r in runs if any(n in gear for n in r)), 'pairs': [round(float(x), 3) for x in pair],
            'covered': round(float(okv[lap].mean()), 2)}
    return t, v / c, f0, gtrace, info
