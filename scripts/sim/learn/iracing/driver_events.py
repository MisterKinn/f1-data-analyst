"""Driver events from the owner's iRacing SRS .ibt files (personal analysis; raw files never leave the PC).
Per clean lap: every corner (speed minimum) with its brake release and throttle pick-up timing, every gear shift with the rpm,
and the steering at the apex. Writes results/driver_events_corners.csv and results/driver_events_shifts.csv (derived numbers only).
Usage: python srs_driver_events.py [ROOT] [--one FILE]"""
import csv, glob, hashlib, os, re, struct, sys
from multiprocessing import Pool
import numpy as np

ROOT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else r'C:\Users\jeong\Documents\iRacing_SRS'
KEEP = ['SessionTime', 'Lap', 'Speed', 'Throttle', 'Brake', 'Gear', 'RPM', 'OnPitRoad', 'PlayerCarMyIncidentCount',
        'SteeringWheelAngle', 'YawRate', 'LatAccel', 'LapDistPct']
NP = {0: 'S1', 1: '?', 2: '<i4', 3: '<u4', 4: '<f4', 5: '<f8'}
CF = ['sid', 'cls', 'car', 'track', 'lap', 'lapTime', 'pct', 'vin', 'vmin', 'vout', 'gearApex', 'rpmApex', 'latPeak', 'latApex', 'yawApex',
      'swaApex', 'swaPeak', 'brake', 'brakePeak', 'tBrakeOn', 'tBrakeOff', 'tRelease', 'thrApexMin', 'flat', 'tPick10', 'tPick90',
      'tFull', 'rise1090', 'lifts', 'latAtFull', 'redline', 'slShift']
SF = ['sid', 'cls', 'car', 'track', 'lap', 'dir', 'gFrom', 'gTo', 'v', 'rpmBefore', 'rpmAfter', 'thr', 'brk', 'redline', 'slShift']


def read(path):
    b = open(path, 'rb').read()
    ver, status, tick, siu, silen, sioff, nvars, vhoff, nbuf, buflen = struct.unpack_from('<10i', b, 0)
    bufoff = struct.unpack_from('<i', b, 52)[0]; nrec = struct.unpack_from('<qddii', b, 112)[4]
    names, formats, offsets = [], [], []
    for i in range(nvars):
        o = vhoff + 144 * i; t, off, cnt = struct.unpack_from('<iii', b, o); nm = b[o + 16:o + 48].split(b'\0')[0].decode('latin-1')
        if nm in KEEP and cnt == 1: names.append(nm); formats.append(NP[t]); offsets.append(off)
    n = min(nrec, (len(b) - bufoff) // buflen)
    rec = np.frombuffer(b, np.dtype({'names': names, 'formats': formats, 'offsets': offsets, 'itemsize': buflen}), count=n, offset=bufoff)
    y = b[sioff:sioff + silen].split(b'\0')[0].decode('latin-1')
    return tick, rec, y


def yv(y, key):
    m = re.search(r'\b' + key + r':\s*([-\d.]+)', y); return float(m.group(1)) if m else float('nan')


def one(f):
    p = os.path.normpath(f).split(os.sep); cls, car = p[-3], p[-2]; sid = hashlib.sha1(p[-1].encode()).hexdigest()[:12]
    try: hz, r, y = read(f)
    except Exception as e: return [], [], f'skip {f} {e}'
    m = re.search(r'TrackName:\s*(\S+)', y); track = m.group(1) if m else '?'
    red, sl = yv(y, 'DriverCarRedLine'), yv(y, 'DriverCarSLShiftRPM')
    need = {'SessionTime', 'Lap', 'Speed', 'Throttle', 'Brake', 'Gear', 'RPM'}
    if not need <= set(r.dtype.names): return [], [], f'{sid} missing channels'
    g = lambda k, d=0.0: r[k].astype(float) if k in r.dtype.names else np.full(len(r), d)
    t, lap, v, th, br, gear, rpm = g('SessionTime'), r['Lap'].astype(int), g('Speed'), g('Throttle'), g('Brake'), r['Gear'].astype(int), g('RPM')
    pit, inc, swa, yaw, lat, pct = g('OnPitRoad'), g('PlayerCarMyIncidentCount'), g('SteeringWheelAngle'), g('YawRate'), g('LatAccel'), g('LapDistPct')
    laps = []
    for L in np.unique(lap):
        I = np.flatnonzero(lap == L)
        if len(I) < hz * 20 or L == lap.min(): continue
        a, z = I[0], I[-1]
        if pit[a:z + 1].any() or inc[z] > inc[a] or v[a:z + 1].min() < 1: continue
        if np.diff(t[a:z + 1]).max() > 3 / hz or pct[a] > 0.02 or pct[z] < 0.98 or np.abs(np.diff(pct[a:z + 1])).max() > 0.01: continue   # recording gaps, partial laps
        laps.append((L, a, z, t[z] - t[a] + 1 / hz))
    if not laps: return [], [], f'{sid} no clean laps'
    med = float(np.median([x[3] for x in laps])); laps = [x for x in laps if x[3] >= 0.9 * med]   # resets/teleports give 10 s 'laps'
    if not laps: return [], [], f'{sid} no clean laps'
    best = min(x[3] for x in laps); laps = [x for x in laps if x[3] <= 1.02 * best]
    C, S = [], []
    W = int(2 * hz)
    for L, a, z, lt in laps:
        seg = slice(a, z + 1); vv = v[seg]; n = len(vv); T = t[seg]
        for i in range(W, n - W):
            if vv[i] != vv[i - W:i + W + 1].min(): continue
            if i > W and vv[i - 1] == vv[i]: continue
            p0 = max(0, i - int(8 * hz)); vin = vv[p0:i].max() if i > p0 else vv[i]
            if vin - vv[i] < 5: continue
            q1 = min(n, i + int(8 * hz)); vout = vv[i:q1].max()
            gi = a + i; row = dict(sid=sid, cls=cls, car=car, track=track, lap=int(L), lapTime=round(lt, 3), pct=round(float(pct[gi]), 4),
                                   vin=round(vin, 2), vmin=round(vv[i], 2), vout=round(vout, 2), gearApex=int(gear[gi]), rpmApex=round(rpm[gi]),
                                   latPeak=round(float(np.abs(lat[gi - hz:gi + hz]).max()), 2), latApex=round(float(lat[gi]), 2),
                                   yawApex=round(float(yaw[gi]), 4), swaApex=round(float(swa[gi]), 4),
                                   swaPeak=round(float(swa[gi - hz:gi + hz][np.argmax(np.abs(swa[gi - hz:gi + hz]))]), 4), redline=red, slShift=sl)
            B = br[a + p0:gi + 1]; on = np.flatnonzero(B > 0.05)
            if len(on):
                j = a + p0 + on[-1]; k = j
                while k > a and br[k - 1] > 0.02: k -= 1
                pk = k + int(np.argmax(br[k:j + 1])); P = br[pk]
                k9 = pk + int(np.flatnonzero(br[pk:j + 1] >= 0.9 * P)[-1])
                row.update(brake=1, brakePeak=round(P, 3), tBrakeOn=round(t[k] - t[gi], 3), tBrakeOff=round(t[j] - t[gi], 3), tRelease=round(t[j] - t[k9], 3))
            else: row.update(brake=0)
            w0, w1 = gi - int(3 * hz), min(a + n - 1, gi + hz)
            tm = th[w0:w1 + 1].min(); row['thrApexMin'] = round(tm, 3)
            if tm > 0.9: row['flat'] = 1; C.append(row); continue
            row['flat'] = 0
            km = w0 + int(np.flatnonzero(th[w0:w1 + 1] <= tm + 0.02)[-1]); end = min(a + n - 1, km + int(6 * hz)); X = th[km:end + 1]
            def first(level):
                h = np.flatnonzero(X >= level); return km + h[0] if len(h) else None
            k10, k90, kf = first(tm + 0.1 * (1 - tm)), first(tm + 0.9 * (1 - tm)), first(0.95)
            if k10 is not None: row['tPick10'] = round(t[k10] - t[gi], 3)
            if k90 is not None: row['tPick90'] = round(t[k90] - t[gi], 3)
            if k10 is not None and k90 is not None: row['rise1090'] = round(t[k90] - t[k10], 3)
            if kf is not None:
                row['tFull'] = round(t[kf] - t[gi], 3); row['latAtFull'] = round(float(lat[kf]), 2)
                Y = th[k10:kf + 1] if k10 is not None else th[km:kf + 1]; row['lifts'] = int(((np.maximum.accumulate(Y) - Y) > 0.1).any())
            C.append(row)
        G = gear[seg].copy(); nz = np.flatnonzero(G > 0)
        if len(nz) < 2: continue
        Gf = G[nz]; ch = np.flatnonzero(Gf[1:] != Gf[:-1])   # shifts pass through neutral (0) for a few samples
        for c in ch:
            e0, e1 = nz[c], nz[c + 1]                 # last sample in the old gear, first in the new one
            if e1 - e0 > 0.3 * hz: continue
            g0 = a + e0; g1 = a + e1; b0 = max(a, g0 - 5); up = Gf[c + 1] > Gf[c]
            S.append(dict(sid=sid, cls=cls, car=car, track=track, lap=int(L), dir='up' if up else 'down', gFrom=int(Gf[c]), gTo=int(Gf[c + 1]),
                          v=round(v[g0], 2), rpmBefore=round(rpm[b0:g0 + 1].max() if up else rpm[g0]), rpmAfter=round(rpm[min(a + n - 1, g1 + 6)]),
                          thr=round(th[g0], 3), brk=round(br[g0], 3), redline=red, slShift=sl))
    return C, S, f'{sid} {cls}/{car} {track}: {len(laps)} laps, {len(C)} corners, {len(S)} shifts'


if __name__ == '__main__':
    if '--one' in sys.argv: files = [sys.argv[sys.argv.index('--one') + 1]]; out = '.'
    else: files = sorted(glob.glob(os.path.join(ROOT, 'core', '*', '*', '*.ibt'))); out = os.path.join(ROOT, 'results')
    fc = open(os.path.join(out, 'driver_events_corners.csv'), 'w', newline=''); fs = open(os.path.join(out, 'driver_events_shifts.csv'), 'w', newline='')
    wc = csv.DictWriter(fc, CF); ws = csv.DictWriter(fs, SF); wc.writeheader(); ws.writeheader()
    with Pool(min(8, os.cpu_count() or 2)) as pool:
        for k, (C, S, msg) in enumerate(pool.imap_unordered(one, files)):
            wc.writerows(C); ws.writerows(S); print(k + 1, len(files), msg, flush=True)
    fc.close(); fs.close()
