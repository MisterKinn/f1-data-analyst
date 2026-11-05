"""On-demand same-session timing recovery when the live connection has ended."""
import json
import threading
import time
from recovery import session_path


def fastf1_history(info):
    """Canonical parser fallback when raw clock history is not published."""
    import fastf1
    import pandas as pd
    from collector import State
    from telemetry import FASTF1_LOAD_LOCK
    with FASTF1_LOAD_LOCK, fastf1.Cache.disabled():
        session = fastf1.get_session(int(info['StartDate'][:4]), info['Meeting']['Name'], info['Name'])
        if session.api_path.strip('/') != ('static/' + session_path(info)).strip('/'):
            raise ValueError('FastF1 session identity mismatch')
        session.load(laps=True, telemetry=True, weather=False, messages=True)
        return history_from_session(session, info)


def history_from_session(session, info):
    """Best-lap archive from an already loaded FastF1 session (no extra download)."""
    import pandas as pd
    from collector import State
    if session.t0_date is None:
        raise ValueError('FastF1 UTC origin unavailable')
    origin = session.t0_date.tz_localize('UTC') if session.t0_date.tzinfo is None else session.t0_date
    state = State()
    state.apply('SessionInfo', info, initial=True)
    lines, drivers = {}, {}
    def fmt(ms):
        return f'{ms//60000}:{ms%60000/1000:06.3f}'
    quali = session.name in ('Qualifying', 'Sprint Qualifying', 'Sprint Shootout')
    parts = session.laps.split_qualifying_sessions() if quali else [session.laps]
    for index, laps in enumerate(parts):
        if laps is None:
            continue
        part = index + 1 if quali else 0
        for _, lap in laps.iterrows():
            if pd.isna(lap['IsAccurate']) or not lap['IsAccurate'] or (not pd.isna(lap['Deleted']) and lap['Deleted']) or not pd.isna(lap['PitInTime']) or not pd.isna(lap['PitOutTime']):
                continue
            fields = ['LapTime', 'Sector1Time', 'Sector2Time', 'Sector3Time', 'Sector1SessionTime', 'Sector2SessionTime', 'Sector3SessionTime']
            if any(pd.isna(lap[k]) for k in fields):
                continue
            total = round(lap['LapTime'].total_seconds() * 1000)
            sectors = [round(lap[k].total_seconds() * 1000) for k in fields[1:4]]
            if min(sectors) <= 0 or abs(sum(sectors) - total) > 3:
                continue
            driver = str(lap['DriverNumber'])
            times = [(origin + lap[k]).isoformat() for k in fields[4:]]
            record = {'id': f"{info['Key']}:{driver}:{part}:{pd.Timestamp(times[-1]).timestamp()}",
                'driver_number': driver, 'session_part': part, 'lap_time': fmt(total), 'lap_time_ms': total,
                'sectors': {k: f'{v/1000:.3f}' for k, v in zip(('S1','S2','S3'), sectors)},
                'sector_source_times': times, 'sector_sum_ms': sum(sectors), 'sector_sum_delta_ms': sum(sectors) - total,
                'completed_at': times[-1], 'timing_lap_reference': int(lap['LapNumber']), 'validation': 'complete',
                'in_pit_at_completion': False, 'history_source': 'FastF1 official archived Session.load',
                'tyre': {'compound': lap['Compound'], 'tyre_life': float(lap['TyreLife']) if not pd.isna(lap['TyreLife']) else None}}
            state.laps.records.append(record)
            line = lines.setdefault(driver, {})
            target = line.setdefault('BestLapTimes', {}) if quali else line
            key = str(part - 1) if quali else 'BestLapTime'
            prior = target.get(key)
            if prior is None or total < prior['ms']:
                target[key] = {'Value': fmt(total), 'Lap': int(lap['LapNumber']), 'ms': total}
            if 'BestLapTime' not in line or total < line['BestLapTime']['ms']:
                line['BestLapTime'] = {'Value': fmt(total), 'Lap': int(lap['LapNumber']), 'ms': total}
            drivers[driver] = {'Tla': lap['Driver'], 'TeamName': lap['Team']}
    state.apply('TimingData', {'Lines': lines}, initial=True)
    state.apply('DriverList', drivers, initial=True)
    if len(session.session_status):
        state.apply('SessionStatus', {'Status': str(session.session_status.iloc[-1]['Status'])}, initial=True)
    return state, {'source': 'FastF1 Session.load official archive', 'state': 'complete', 'recovered_laps': len(state.laps.records)}


class HistoryJobs:
    def __init__(self, directory):
        self.directory = directory
        self.lock = threading.Lock()
        self.running = None

    def request(self, topics):
        info = topics['SessionInfo']
        session_path(info)
        key = str(info['Key'])
        if not key.isdigit() or len(key) > 12:
            raise ValueError('Invalid session key')
        path = self.directory / (key + '.json')
        with self.lock:
            if path.exists():
                data = json.loads(path.read_text())
                # Failed or incomplete publication may become available later.
                if time.time() - path.stat().st_mtime < 60 or (data.get('recovery', {}).get('state') == 'complete' and data.get('topics', {}).get('SessionStatus', {}).get('Status') == 'Finalised'):
                    return data
            if self.running:
                return {'state': 'pending', 'retry_after_seconds': 10}
            self.running = key
            threading.Thread(target=self.run, args=(key, path, topics), daemon=True).start()
        return {'state': 'pending', 'retry_after_seconds': 10}

    def run(self, key, path, topics):
        try:
            from collector import State
            from recovery import replay_official
            try:
                state, detail = replay_official(topics['SessionInfo'])
            except Exception:
                state, detail = fastf1_history(topics['SessionInfo'])
            result = {'state': 'ready', 'session_key': topics['SessionInfo']['Key'],
                'topics': state.topics, 'lap_archive': state.laps.export(state.topics),
                'recovery': dict(detail, state='complete')}
            result['lap_archive']['recovery'] = result['recovery']
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix('.tmp')
            tmp.write_text(json.dumps(result))
            tmp.replace(path)
        except Exception as exc:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({'state': 'unavailable', 'recovery': {'state': 'unavailable', 'error_type': type(exc).__name__}}))
        finally:
            with self.lock:
                self.running = None
