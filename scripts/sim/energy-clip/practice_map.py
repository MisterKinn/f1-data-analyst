"""Pre-qualifying ERS clipping map of one event from its practice (W17 `presession_plan`).

Same steps as W17 scripts/w17_practice_forecast.py (early_rows, clean, sector_centres, build): dry practice and sprint
qualifying windows that ended before qualifying, practice laps weighted 0.25-1 by closeness to the driver's 10th-percentile
lap, sprint qualifying x2, straights found as peaks of full-throttle start positions, per team a weighted median of the
detected onset (or the window end when none), same team x7. W17: 88.83 m mean error on 8,023 qualifying runs, the site
kernel 204.18 m (gain 115.3 +/- 16.1 m, Gate G pass). One change: the fallback for a straight without a local map is the
field median of this event's practice (W17 used earlier rounds' qualifying), so one event folder is enough.

python scripts/sim/energy-clip/practice_map.py <telemetry root> <detect root> "<Event>" <out.json>
"""
import csv
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

TRAIN = ['session', 'driver', 'team', 'lap', 'straight_id', 'start_m', 'end_m', 'length_m', 'lap_length_m', 'open_left',
         'open_right', 'clip_m', 'entry_kmh']


def wmedian(a, w):
    order = np.argsort(a, kind='stable')
    return float(a[order][np.searchsorted(np.cumsum(w[order]), np.sum(w) * .5)])


def openf1_team(session_dir, drv):
    try:
        key = json.loads((session_dir / 'session_info.json').read_bytes())['session_info']['Key']
        with urllib.request.urlopen(f'https://api.openf1.org/v1/drivers?session_key={key}', timeout=20) as r:
            return next((d['team_name'] for d in json.load(r) if d.get('name_acronym') == drv and d.get('team_name')), None)
    except Exception:
        return None


def sessions_of(src, event):
    out = {}
    for folder in sorted((src / event).iterdir()):
        p = folder / 'session_info.json'
        if p.is_file():
            s = json.loads(p.read_bytes())['session_info']
            # local times; GmtOffset gives UTC (only needed to compare with now before qualifying exists)
            off = pd.Timedelta(s.get('GmtOffset') or '0:00:00')
            out[folder.name] = (pd.Timestamp(s['StartDate']) - off, pd.Timestamp(s['EndDate']) - off)
    return out


def allowed_sessions(sessions, now):
    # before qualifying: practice and sprint qualifying that ended before it; with no qualifying yet, those already ended
    q = sessions.get('Qualifying')
    cut = q[0] if q else now
    return sorted(s for s, (_, end) in sessions.items() if end <= cut and (s.startswith('Practice ') or s == 'Sprint Qualifying'))


def race_control_ok(laps, src, event, aero):
    """False for laps started in Low Grip Conditions or with Overtake disabled (race control, f1-aero-state.json): Straight Mode
    is partial (Alt zones, B7.1.2 b) or the power curve differs there, so those windows do not describe a normal qualifying lap."""
    ok = pd.Series(True, index=laps.index)
    for se, idx in laps.groupby('session').groups.items():
        p = src / event / se / 'session_info.json'
        if not p.is_file():
            continue
        info = json.loads(p.read_bytes())
        st = aero.get(str(info['session_info']['Key']))
        if not st:
            continue
        t = pd.Timestamp(info['t0_date']) + pd.to_timedelta(laps.loc[idx, 'start_time_s'].fillna(0), unit='s')
        for kind, bad, first in (('grip', 'low', (st.get('grip') or {}).get('start')), ('ot', 'off', (st.get('ot') or {}).get('start'))):
            ev = sorted((pd.Timestamp(e['t']).tz_localize(None), e['state']) for e in st['events'] if e['kind'] == kind)
            state = [next((v for u, v in reversed(ev) if u <= x), first) for x in t]
            ok.loc[idx] &= np.array([v != bad for v in state])
    return ok


def clean(frame, laps, allowed, ok=None):
    f = frame[frame.session.isin(allowed)].copy()
    ls = laps[laps.session.isin(allowed)].copy()
    if ls.empty or f.empty:
        return f.iloc[0:0]
    scale = float(ls.loc[ls.lap_length_m.gt(0), 'lap_length_m'].median())
    ident = ['session', 'driver', 'lap']
    ls = ls[ls.lap_length_m.between(scale * .90, scale * 1.10) & ls.lap_time_s.gt(0) & (True if ok is None else ok.reindex(ls.index, fill_value=True))].copy()
    ls['ref_time'] = ls.groupby(['session', 'driver']).lap_time_s.transform(lambda v: v.quantile(.10))
    ls['weight'] = .25 + .75 * np.exp(-np.maximum(0, ls.lap_time_s / ls.ref_time - 1) / .035)
    ordered = f.sort_values(ident + ['straight_id'])
    prev = ordered.groupby(ident, sort=False).end_m.shift()
    invalid = (ordered.start_m < prev - 25) | (ordered.end_m > ordered.lap_length_m + 25) | (ordered.start_m < -25)
    bad = invalid.groupby([ordered[k] for k in ident], sort=False).transform('any')
    f = ordered[~bad & ~ordered.open_left & ~ordered.open_right].merge(ls[ident + ['weight']], on=ident, validate='many_to_one')
    f = f[f.length_m.gt(0)].copy()
    f['ref_m'] = scale
    f['x'] = f.start_m * scale / f.lap_length_m
    f['y'] = f.clip_m.fillna(f.length_m)
    f['pos'] = f.clip_m.notna().astype(float)
    f['w'] = f.weight * np.where(f.session.eq('Sprint Qualifying'), 2., 1.)
    return f


def sector_centres(f):
    if len(f) < 35:
        return np.array([])
    ref = float(f.ref_m.iloc[0])
    edges = np.arange(0., ref + 20, 10)
    counts, _ = np.histogram(f.x, bins=edges)
    smooth = gaussian_filter1d(counts.astype(float), 1.75)
    idx = find_peaks(np.r_[0., smooth, 0.], distance=6, prominence=max(.75, len(f) * .0007))[0] - 1
    return edges[idx] + 5


def build(f, teams):
    centers = sector_centres(f)
    assign = np.argmin(abs(f.x.to_numpy()[:, None] - centers), axis=1) if len(centers) else None
    y_all = f.y.to_numpy()
    out = {}
    for team in teams:
        h = f[f.team == team] if (f.team == team).sum() >= 12 else f  # team '*': the whole field, no team weight
        rows = [dict(sector=-1, distance_m=round(float(np.median(h.y)), 1), fraction=round(float(np.median(h.y / h.length_m)), 3),
                     clip_probability=round(float(h.pos.mean()), 3))] if len(h) else []
        for sector, center in enumerate(centers):
            loc = f[(assign == sector) & (abs(f.x - center) <= 120)]
            if len(loc) < 5:
                continue
            x, y, length = loc.x.to_numpy(), loc.y.to_numpy(), loc.length_m.to_numpy()
            ist = loc.team.to_numpy() == team
            w = loc.w.to_numpy() * np.exp(-abs(x - center) / 60) * (1 + 6 * ist)
            rows.append(dict(sector=sector, center_m=round(float(center), 1), distance_m=round(wmedian(y, w), 1),
                             absolute_m=round(wmedian(x + y, w), 1), length_m=round(wmedian(length, w), 1),
                             clip_probability=round(float(np.average(loc.pos.to_numpy(), weights=w)), 3),
                             training_windows=int(len(loc)), team_windows=int(ist.sum())))
        out[team] = rows
    return out


def main():
    src, det, event, dest = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4])
    now = pd.Timestamp(sys.argv[5]) if len(sys.argv) > 5 else pd.Timestamp.now(tz='UTC').tz_localize(None)
    frame = pd.read_csv(det / event / 'straights.csv', usecols=TRAIN)
    laps = pd.read_csv(det / event / 'laps.csv', usecols=['session', 'driver', 'lap', 'lap_time_s', 'track_status', 'lap_length_m', 'start_time_s'])
    aero_file = Path(sys.argv[6]) if len(sys.argv) > 6 else Path('scripts/sim/data/learn/f1-aero-state.json')
    aero = json.loads(aero_file.read_text())['sessions'] if aero_file.is_file() else {}
    # empty team labels (Barcelona and Canada FP1 in the source): the driver's only team in this event's drivers.json files or laps
    # (W17 scripts/resolve_teams.py, same_event_unique)
    seen = {}
    for p in (src / event).rglob('drivers.json'):
        d = json.loads(p.read_bytes())
        for r in (d.get('drivers', []) if isinstance(d, dict) else []):
            if r.get('team') not in (None, 'None', 'nan', ''):
                seen.setdefault(r['driver'], set()).add(r['team'])
    for drv, team in frame.dropna(subset=['team'])[['driver', 'team']].drop_duplicates().itertuples(index=False):
        seen.setdefault(drv, set()).add(team)
    only = {d: next(iter(t)) for d, t in seen.items() if len(t) == 1}
    frame['team'] = frame.team.fillna(frame.driver.map(only))
    # drivers seen in one session only (FP1 rookies): W17's sourced list (formula1.com results), then OpenF1 by session key
    fix = {(r['session'], r['driver']): r['team'] for r in csv.DictReader(open(Path(__file__).with_name('team-overrides.csv'))) if r['event'] == event}
    for (se, drv), _ in frame[frame.team.isna()].groupby(['session', 'driver']):
        team = fix.get((se, drv)) or openf1_team(src / event / se, drv)
        if team:
            frame.loc[frame.session.eq(se) & frame.driver.eq(drv), 'team'] = team
    sessions = sessions_of(src, event)
    allowed = allowed_sessions(sessions, now)
    ok = race_control_ok(laps[laps.session.isin(allowed)], src, event, aero)
    f = clean(frame, laps, allowed, ok)
    teams = sorted(t for t in frame.team.dropna().unique()) + ['*']
    res = dict(event=event, sessions=allowed, windows=int(len(f)), lapsLowGripOrOtOff=int((~ok).sum()), ref_m=round(float(f.ref_m.iloc[0]), 1) if len(f) else None,
               qualifying_start=str(sessions['Qualifying'][0]) if 'Qualifying' in sessions else None,
               teams=build(f, teams) if len(f) >= 35 else {})
    dest.write_text(json.dumps(res))
    print(event, allowed, len(f), 'windows', sum(len(v) for v in res['teams'].values()), 'team rows')


if __name__ == '__main__':
    main()
