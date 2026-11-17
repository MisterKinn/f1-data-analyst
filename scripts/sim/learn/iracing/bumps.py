# Offline: reads the owner's local iRacing extract (SRS env var, default ~/srs: sessions.jsonl + channels/*.parquet; personal use,
# never committed). Outputs only derived numbers. Run from the repo root.
# Bump index along the lap from iRacing laser-scanned tracks: vertical acceleration high-passed above ~2 Hz (crests and compressions
# removed), RMS per lap-distance bin, divided by the lap median of that car (suspensions differ), median over laps. 1.0 = typical.
import os, sys, json, numpy as np
from scipy.signal import butter, sosfiltfilt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from irlaps import laps
ids = sys.argv[1:]; out = {}
sos = butter(2, 2.0, 'highpass', fs=60, output='sos')
for id in ids:
    Ls = laps(id, 16, ('VertAccel', 'LapDistPct', 'Speed'))
    if not Ls: print(id, 'no laps'); continue
    nb = 400; rows = []
    for q in Ls:
        va = np.asarray(q['VertAccel'], float)
        if np.isnan(va).mean() > 0.01 or np.nanstd(va) == 0: continue
        a = sosfiltfilt(sos, np.nan_to_num(va)); b = np.minimum((q['LapDistPct'] * nb).astype(int), nb - 1)
        r = np.sqrt(np.bincount(b, a * a, nb) / np.maximum(np.bincount(b, None, nb), 1)); m = np.median(r)
        if np.isfinite(m) and m > 0 and np.isfinite(r).all(): rows.append(r / m)
    if not rows: print(id, 'no vertical acceleration'); continue
    B = np.nanmedian(rows, axis=0); out[id] = {'bins': nb, 'laps': len(Ls), 'idx': [round(float(v), 2) for v in B]}
    print(id, len(Ls), 'laps; top bins (share of lap, index):', [(round(i / nb, 3), round(float(B[i]), 2)) for i in np.argsort(B)[::-1][:6]])
json.dump(out, open(os.environ.get('OUT', '/tmp/bumps.json'), 'w'))
