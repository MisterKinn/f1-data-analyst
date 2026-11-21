"""Write one finished session from FastF1 (the F1 timing archive) in the TracingInsights/2026 layout that detect.py reads, when
TracingInsights has not published it yet (it often lags a session by many hours; owner 2026-11-21: update after every session).

python scripts/sim/energy-clip/fastf1_session.py <root> <year> "<Event name>" "<Session name>"
Writes <root>/<Event>/<Session>/{session_info,drivers,weather,session_laptimes}.json and <driver>/{laptimes.json,<lap>_tel.json}.
Exit 0 with nothing written when the session is already there or not available yet.
"""
import json
import math
import sys
from pathlib import Path

import fastf1
import pandas as pd


def sec(x):
    return None if x is None or pd.isna(x) else round(pd.Timedelta(x).total_seconds(), 3)


def val(x):
    if x is None or (isinstance(x, float) and math.isnan(x)) or x is pd.NaT:
        return None
    if isinstance(x, (bool,)):
        return x
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    return x.item() if hasattr(x, 'item') else x


def main():
    root, year, event, name = Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
    out = root / event / name
    if (out / 'session_laptimes.json').is_file():
        print(event, name, 'already there'); return
    if Path('.cache/fastf1').is_dir():
        fastf1.Cache.enable_cache('.cache/fastf1')
    try:
        s = fastf1.get_session(year, event, name)  # no such session at this event (e.g. Sprint Qualifying at a normal weekend)
    except Exception as e:
        print(event, name, 'no such session:', e); return
    if pd.Timestamp.now(tz='UTC') < pd.Timestamp(s.date).tz_localize('UTC') + pd.Timedelta(minutes=60):
        print(event, name, 'not finished yet'); return
    try:
        s.load(laps=True, telemetry=True, weather=True, messages=False)
    except Exception as e:  # not archived yet
        print(event, name, 'not available:', e); return
    try:
        laps = s.laps
    except Exception:  # loaded nothing: the archive is still being written ("Generating")
        laps = None
    if laps is None or laps.empty:
        print(event, name, 'no laps'); return
    info = s.session_info
    off = info.get('GmtOffset') or pd.Timedelta(0)
    t0 = s.t0_date
    meta = {'t0_date': t0.isoformat(), 'session_info': {'Key': info.get('Key'), 'Name': name, 'Type': info.get('Type'),
            'StartDate': pd.Timestamp(info['StartDate']).isoformat(), 'EndDate': pd.Timestamp(info['EndDate']).isoformat(),
            'GmtOffset': str(off).split(' days ')[-1] if not str(off).startswith('-') else '-' + str(-off).split(' days ')[-1],
            'Meeting': {'Name': event}}, 'source': 'FastF1 (F1 timing archive), written by scripts/sim/energy-clip/fastf1_session.py'}
    w = s.weather_data
    weather = {'wT': [sec(x) for x in w.Time], 'wAT': list(map(val, w.AirTemp)), 'wTT': list(map(val, w.TrackTemp)),
               'wH': list(map(val, w.Humidity)), 'wP': list(map(val, w.Pressure)), 'wR': [bool(x) for x in w.Rainfall],
               'wWS': list(map(val, w.WindSpeed)), 'wWD': list(map(val, w.WindDirection))}
    drivers = [{'driver': s.get_driver(n)['Abbreviation'], 'team': s.get_driver(n)['TeamName']} for n in s.drivers]
    out.mkdir(parents=True, exist_ok=True)
    (out / 'session_info.json').write_text(json.dumps(meta))
    (out / 'weather.json').write_text(json.dumps(weather))
    (out / 'drivers.json').write_text(json.dumps({'drivers': drivers}))
    allrec = {}
    for drv, g in laps.groupby('Driver'):
        rec = {k: [] for k in ('lap', 'time', 's1', 's2', 's3', 'pin', 'pout', 'ff1G', 'team', 'lST', 'sesT', 'compound', 'status', 'del', 'iacc', 'vst', 'drv')}
        (out / drv).mkdir(exist_ok=True)
        for _, l in g.iterrows():
            n = int(l.LapNumber)
            rec['lap'].append(n); rec['time'].append(sec(l.LapTime)); rec['s1'].append(sec(l.Sector1Time)); rec['s2'].append(sec(l.Sector2Time))
            rec['s3'].append(sec(l.Sector3Time)); rec['pin'].append(sec(l.PitInTime)); rec['pout'].append(sec(l.PitOutTime))
            rec['ff1G'].append(bool(l.FastF1Generated)); rec['team'].append(l.Team); rec['lST'].append(sec(l.LapStartTime))
            rec['sesT'].append(sec(l.Time)); rec['compound'].append(val(l.Compound)); rec['status'].append(val(l.TrackStatus))
            rec['del'].append(bool(l.Deleted) if not pd.isna(l.Deleted) else None); rec['iacc'].append(bool(l.IsAccurate)); rec['vst'].append(val(l.SpeedST))
            rec['drv'].append(drv)
            if pd.isna(l.LapTime) or l.FastF1Generated:
                continue
            try:
                t = l.get_telemetry()  # car + position data merged, as TracingInsights writes it (Monza FP3: same 3,742 windows, map rows within 4.5 m)
            except Exception:
                continue
            tel = {'time': [round(x.total_seconds(), 3) for x in t.Time], 'distance': [round(float(x), 2) for x in t.Distance],
                   'speed': [float(x) for x in t.Speed], 'throttle': [float(x) for x in t.Throttle], 'brake': [int(bool(x)) * 100 for x in t.Brake]}
            (out / drv / f'{n}_tel.json').write_text(json.dumps({'tel': tel}))
        (out / drv / 'laptimes.json').write_text(json.dumps(rec))
        allrec[drv] = rec
    flat = {k: [x for r in allrec.values() for x in r[k]] for k in next(iter(allrec.values()))}
    (out / 'session_laptimes.json').write_text(json.dumps(flat))
    print(event, name, len(laps), 'laps from FastF1')


if __name__ == '__main__':
    main()
