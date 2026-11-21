"""Road speed from engine sound with a gearbox (model / learned from video).
Engine order by a fine harmonic comb. The clean in-gear stretches are chained:
- upshift gap (rising before and after, f drops 3-20 %): road speed continuous across the gap;
- any other gap (downshifts while braking): speed falls across the gap at the deceleration measured just after it.
Lap closure (same place = same speed) removes what drift is left; the lap covers the circuit length (absolute scale)."""
import numpy as np
from scipy.io import wavfile
from scipy.signal import stft, medfilt
from scipy.ndimage import uniform_filter1d


from functools import lru_cache


@lru_cache(maxsize=8)
def comb(wav, lo=30, hi=110, h0=4, h1=30, fmax=2500):
    fs, x = wavfile.read(wav); x = x.astype(float)
    f, t, Z = stft(x, fs, nperseg=4096, noverlap=4096 - 200); df = f[1]; k = f < fmax
    S = np.abs(Z[k]); S = np.log1p(S / (np.median(S, 1, keepdims=True) + 1e-9)); S = np.maximum(S - uniform_filter1d(S, 9, axis=0), 0)
    cand = np.arange(lo, hi, 0.1); H = np.zeros((len(cand), S.shape[1]))
    for h in range(h0, h1):
        idx = cand * h / df; i0 = np.floor(idx).astype(int); a = idx - i0; ok = i0 + 1 < S.shape[0]
        H[ok] += (1 - a[ok, None]) * S[i0[ok]] + a[ok, None] * S[i0[ok] + 1]
    return t, cand[np.argmax(H, 0)], H.max(0) / (np.median(H, 0) + 1e-9)


def speed(wav, t0, lap_s, length, lo=30, hi=110):
    t, f0, q = comb(wav, lo, hi)
    m = (t >= t0 - 3) & (t <= t0 + lap_s + 3); t, f0, q = t[m] - t0, f0[m], q[m]; dt = t[1] - t[0]
    lf = np.log(f0)
    sl = np.abs(np.gradient(medfilt(lf, 5), dt))
    clean = (q > 3.5) & (sl < 1.0) & (np.abs(lf - medfilt(lf, 9)) < 0.01)
    segs, i = [], 0
    while i < len(t):
        if clean[i]:
            j = i
            while j + 1 < len(t) and clean[j + 1] and abs(lf[j + 1] - lf[j]) < 0.02: j += 1
            if t[j] - t[i] >= 0.4: segs.append((i, j))
            i = j + 1
        else: i += 1
    g = np.full(len(t), np.nan); level = 0.0; kinds = []
    for n, (a, b) in enumerate(segs):
        if n:
            pa, pb = segs[n - 1]; gap = t[a] - t[pb]
            sa = np.polyfit(t[max(pa, pb - 8):pb + 1], lf[max(pa, pb - 8):pb + 1], 1)[0] if pb > pa + 2 else 0.0
            sb = np.polyfit(t[a:min(b, a + 8) + 1], lf[a:min(b, a + 8) + 1], 1)[0] if b > a + 2 else 0.0
            ratio = np.exp(lf[a] - lf[pb])
            if sa > -0.05 and sb > -0.05 and 0.78 < ratio < 0.985 and gap < 0.6:
                kinds.append('up'); level = level + lf[pb] + sa * gap - lf[a]
            elif sb < -0.05:
                kinds.append('brake'); level = level + lf[pb] - lf[a] - np.log(max(0.3, 1 - sb * gap))
            else:
                kinds.append('other'); level = level + lf[pb] + sa * gap - lf[a]
        g[a:b + 1] = level
    lv = lf + g; ok = np.isfinite(lv); lv = np.interp(t, t[ok], lv[ok])
    drift = np.interp(lap_s, t, lv) - np.interp(0, t, lv); lv = lv - drift * np.clip(t / lap_s, 0, 1)
    v = np.exp(medfilt(lv, 9)); lap = (t >= 0) & (t <= lap_s); c = np.trapezoid(v[lap], t[lap]) / (3.6 * length)
    info = {'segments': len(segs), 'up': kinds.count('up'), 'brake': kinds.count('brake'), 'other': kinds.count('other'), 'closure_drift': round(float(drift), 3)}
    return t, v / c, f0, clean, info
