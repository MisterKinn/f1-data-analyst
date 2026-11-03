"""Bounded, asynchronous lap telemetry retrieval from official CarData history."""
import hashlib
import json
import sqlite3
import math
from pathlib import Path
import threading
import time
from datetime import datetime, timezone
from lap_archive import timestamp, milliseconds
from recovery import session_path, BASE
FASTF1_LOAD_LOCK = threading.Lock()


def build_lap(lap, samples):
    end = timestamp(lap['sector_source_times'][2])
    duration = milliseconds(lap['lap_time']) / 1000
    start = end - duration
    # Interpolate boundaries only inside two actually received neighbouring samples.
    # Brake/gear remain discrete; no extrapolation or filling dropped intervals.
    samples = [list(row) for row in samples]
    for boundary in (start, end):
        for left, right in zip(samples, samples[1:]):
            if left[0] < boundary < right[0] and right[0] - left[0] <= 1.5:
                f = (boundary - left[0]) / (right[0] - left[0])
                samples.append([boundary, left[1]+f*(right[1]-left[1]),
                    left[2]+f*(right[2]-left[2]), left[3], left[4], left[5]+f*(right[5]-left[5])])
                break
        samples.sort(key=lambda r: r[0])
    points = []
    distance = 0
    previous = None
    gaps = []
    for sample in samples:
        at, speed, throttle, brake, gear, rpm = sample
        if not start <= at <= end:
            continue
        if previous:
            dt = at - previous[0]
            if dt > 1.5:
                gaps.append([round(previous[0] - start, 3), round(at - start, 3)])
            distance += (previous[1] + speed) / 2 / 3.6 * dt
        points.append([round(at - start, 3), round(distance, 2), speed, throttle, brake, gear, rpm])
        previous = sample
    coverage = bool(points and points[0][0] <= 0.01 and duration - points[-1][0] <= 0.01 and not gaps)
    return {'driver_number': lap['driver_number'], 'lap_id': lap['id'], 'lap_time': lap['lap_time'],
            'timing_lap_reference': lap.get('timing_lap_reference'), 'tyre': lap.get('tyre'),
            'sectors': lap['sectors'], 'complete_coverage': coverage, 'gaps_seconds': gaps,
            'boundary_missing_seconds': [points[0][0], round(duration - points[-1][0], 3)] if points else None,
            'distance_m': round(distance, 2), 'samples': points,
            'columns': ['elapsed_s', 'integrated_distance_m', 'speed_kmh', 'throttle_percent', 'brake_on', 'gear', 'rpm'],
            'distance_note': 'Speed-integrated distance begins at first observed in-lap sample; boundary residuals are reported. Not GPS distance. Brake is binary, not pressure.'}


class LiveTelemetry:
    def __init__(self, directory, info, raw_path=None):
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        self.info = info
        self.path = directory / (str(info['Key']) + '.sqlite')
        self.meta_path = directory / (str(info['Key']) + '.meta.json')
        self.lock = threading.RLock()
        self.meta = json.loads(self.meta_path.read_text()) if self.meta_path.exists() else {
            'session_key': info['Key'], 'ended_at': None, 'raw_path': str(raw_path) if raw_path else None}
        self.db = None
        self.write_errors = 0
        if not self.meta.get('purged_at'):
            self.db = sqlite3.connect(self.path, check_same_thread=False)
            self.db.execute('CREATE TABLE IF NOT EXISTS samples (driver TEXT, utc REAL, speed REAL, throttle REAL, brake INTEGER, gear INTEGER, rpm REAL, PRIMARY KEY(driver,utc))')
            self.db.commit()
            self.save_meta()

    def save_meta(self):
        tmp = self.meta_path.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.meta))
        tmp.replace(self.meta_path)

    def append(self, topic, payload):
        with self.lock:
            if self.meta.get('ended_at') and time.time() >= self.meta['ended_at'] + 300:
                return
            if topic == 'SessionStatus' and payload.get('Status') in ('Finished', 'Finalised'):
                self.meta['ended_at'] = self.meta.get('ended_at') or time.time()
                self.save_meta()
            if topic != 'CarData.z' or self.db is None:
                return
            rows = []
            for entry in payload.get('Entries', []):
                at = timestamp(entry.get('Utc'))
                if at is None:
                    continue
                for driver, car in entry.get('Cars', {}).items():
                    c = car.get('Channels', {})
                    try:
                        vals = [float(c[str(k)]) for k in (2, 4, 5, 3, 0)]
                        if not all(math.isfinite(v) for v in vals):
                            continue
                        speed, throttle, brake, gear, rpm = vals
                        if not (0 <= speed <= 500 and 0 <= throttle <= 105 and 0 <= gear <= 10 and 0 <= rpm <= 25000):
                            continue
                        rows.append((driver, at, speed, throttle, int(brake > 0), gear, rpm))
                    except (KeyError, TypeError, ValueError):
                        continue
            self.db.executemany('INSERT OR REPLACE INTO samples VALUES (?,?,?,?,?,?,?)', rows)
            self.db.commit()

    def summary(self):
        if self.db is not None and self.meta.get('ended_at') and time.time() >= self.meta['ended_at'] + 300:
            self.db.close()
            self.db = None
        return {'mode': 'session_accumulation', 'session_key': self.info['Key'],
                'ended_at': self.meta.get('ended_at'),
                'sample_count': self.db.execute('SELECT COUNT(*) FROM samples').fetchone()[0] if self.db else 0,
                'delete_after_seconds': 300, 'write_errors': self.write_errors, 'purged': bool(self.meta.get('purged_at')) or bool(self.meta.get('ended_at') and time.time() >= self.meta['ended_at'] + 300),
                'post_session_source': 'FastF1 Session.load, official archived session data'}

    @staticmethod
    def laps(directory, info, laps):
        path = directory / (str(info['Key']) + '.sqlite')
        meta_path = directory / (str(info['Key']) + '.meta.json')
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        if not path.exists() or meta.get('purged_at') or (meta.get('ended_at') and time.time() >= meta['ended_at'] + 300):
            return None
        output = []
        with sqlite3.connect('file:' + str(path) + '?mode=ro', uri=True) as db:
            for lap in laps:
                end = timestamp(lap['sector_source_times'][2])
                start = end - milliseconds(lap['lap_time']) / 1000
                rows = db.execute('SELECT utc,speed,throttle,brake,gear,rpm FROM samples WHERE driver=? AND utc BETWEEN ? AND ? ORDER BY utc',
                                  (lap['driver_number'], start - 2, end + 2)).fetchall()
                output.append(build_lap(lap, rows))
        return output


def purge_expired(data, at=None):
    at = time.time() if at is None else at
    directory = data / 'telemetry'
    for meta_path in directory.glob('*.meta.json'):
        try:
            meta = json.loads(meta_path.read_text())
            if meta.get('purged_at') or not meta.get('ended_at') or at < meta['ended_at'] + 300:
                continue
            for suffix in ('.sqlite', '.sqlite-journal', '.sqlite-wal', '.sqlite-shm'):
                (directory / (str(meta['session_key']) + suffix)).unlink(missing_ok=True)
            raw = Path(meta['raw_path']) if meta.get('raw_path') else None
            if raw and raw.is_relative_to(data):
                raw.unlink(missing_ok=True)
            # Remove duplicated latest telemetry batches from saved snapshots too.
            paths = [data / 'snapshot.json', *data.glob('sessions/*/snapshot.json')]
            for path in paths:
                if not path.exists():
                    continue
                snapshot = json.loads(path.read_text())
                if snapshot.get('topics', {}).get('SessionInfo', {}).get('Key') != meta['session_key']:
                    continue
                for topic in ('CarData.z', 'Position.z'):
                    snapshot['topics'].pop(topic, None)
                    snapshot.get('topic_times', {}).pop(topic, None)
                snapshot['telemetry_capture'] = {'purged': True, 'delete_after_seconds': 300}
                tmp = path.with_suffix('.purge.tmp')
                tmp.write_text(json.dumps(snapshot))
                tmp.replace(path)
            meta['purged_at'] = at
            meta_path.write_text(json.dumps(meta))
        except (OSError, ValueError, KeyError):
            continue
    # Post-session FastF1 reloads are transient query caches, also kept for 5 min.
    for path in (data / 'telemetry-jobs').glob('*.json'):
        if at - path.stat().st_mtime >= 300:
            path.unlink(missing_ok=True)


def historical_laps(info, requested):
    import fastf1
    import pandas as pd
    session = fastf1.get_session(int(info['StartDate'][:4]), info['Meeting']['Name'], info['Name'])
    if session.api_path.strip('/') != ('static/' + session_path(info)).strip('/'):
        raise ValueError('FastF1 session identity mismatch')
    session.load(laps=True, telemetry=True, weather=False, messages=True)
    output = []
    for record in requested:
        laps = session.laps.pick_drivers(record['driver_number'])
        if record.get('timing_lap_reference') is not None:
            laps = laps[laps['LapNumber'] == record['timing_lap_reference']]
        laps = laps[abs(laps['LapTime'].dt.total_seconds() * 1000 - milliseconds(record['lap_time'])) <= 3]
        laps = laps[laps['IsAccurate'] & ~laps['Deleted'].fillna(False)]
        if len(laps) != 1:
            raise ValueError('No unique accurate historical lap')
        lap = laps.iloc[0]
        if not pd.isna(lap['PitInTime']) or not pd.isna(lap['PitOutTime']):
            raise ValueError('Pit lap is not a qualifying comparison')
        car = lap.get_car_data(pad=1)
        start = (session.t0_date + lap['LapStartTime']).timestamp()
        end = (session.t0_date + lap['Time']).timestamp()
        canonical = dict(record, sectors={k: f'{lap[field].total_seconds():.3f}' for k, field in [('S1','Sector1Time'),('S2','Sector2Time'),('S3','Sector3Time')]}, sector_source_times=[datetime.fromtimestamp(start + lap['Sector1Time'].total_seconds(), timezone.utc).isoformat(),
            datetime.fromtimestamp(start + lap['Sector1Time'].total_seconds() + lap['Sector2Time'].total_seconds(), timezone.utc).isoformat(),
            datetime.fromtimestamp(end, timezone.utc).isoformat()])
        rows = [[r.Date.timestamp(), float(r.Speed), float(r.Throttle), int(r.Brake), int(r.nGear), float(r.RPM)] for r in car.itertuples()]
        result = build_lap(canonical, rows)
        result['historical_lap_number'] = int(lap['LapNumber'])
        result['tyre'] = {'compound': lap['Compound'], 'tyre_life': float(lap['TyreLife'])}
        output.append(result)
    return output


class TelemetryJobs:
    def __init__(self, directory, live_directory=None):
        self.directory = directory
        self.live_directory = live_directory
        self.lock = threading.Lock()
        self.running = None
        self.retry_after = {}
        self.errors = {}

    def request(self, info, laps, historical=False):
        session_path(info)
        if not 1 <= len(laps) <= 2 or any(not str(r['id']).startswith(str(info['Key']) + ':') for r in laps):
            raise ValueError('Lap/session mismatch')
        switched = False
        if not historical and self.live_directory:
            meta_path = self.live_directory / (str(info['Key']) + '.meta.json')
            meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            if meta.get('purged_at') or (meta.get('ended_at') and time.time() >= meta['ended_at'] + 300):
                historical = True
                switched = True
        if not historical and self.live_directory:
            rows = LiveTelemetry.laps(self.live_directory, info, laps)
            if rows and all(r['complete_coverage'] for r in rows):
                return {'state': 'ready', 'session_key': info['Key'], 'laps': rows, 'source': 'Accumulated live CarData.z',
                        'retrieved_at': datetime.now(timezone.utc).isoformat()}
            return {'state': 'partial_or_unavailable', 'laps': rows or [], 'source': 'Accumulated live CarData.z',
                    'reason': 'No complete received lap; live requests never substitute historical telemetry.'}
        identity = json.dumps([info['Key'], [(r['id'], r['lap_time']) for r in laps]])
        key = hashlib.sha256(identity.encode()).hexdigest()
        path = self.directory / (key + '.json')
        with self.lock:
            if path.exists() and time.time() - path.stat().st_mtime < 300:
                return dict(json.loads(path.read_text()), source_switched_after_expiry=switched)
            if self.running:
                return {'state': 'pending' if self.running == key else 'busy', 'retry_after_seconds': 10, 'source_switched_after_expiry': switched}
            if time.monotonic() < self.retry_after.get(key, 0):
                return {'state': 'unavailable', 'retry_after_seconds': 60, 'error_type': self.errors.get(key),
                        'reason': 'FastF1 official session reload failed or is not published yet; no telemetry was invented.'}
            self.running = key
            threading.Thread(target=self.run, args=(key, path, info, laps), daemon=True).start()
        return {'state': 'pending', 'retry_after_seconds': 10, 'source_switched_after_expiry': switched}

    def run(self, key, path, info, laps):
        try:
            import fastf1
            # Single job at a time; don't leave telemetry in FastF1's disk cache.
            with FASTF1_LOAD_LOCK, fastf1.Cache.disabled():
                rows = historical_laps(info, laps)
            result = {'state': 'ready' if all(r['complete_coverage'] for r in rows) else 'partial',
                      'session_key': info['Key'], 'session': info, 'laps': rows,
                      'retrieved_at': datetime.now(timezone.utc).isoformat(),
                      'source': 'FastF1 Session.load / official F1 archived timing and telemetry',
                      'limitations': ['Historical reload, not a fresh live feed.',
                          'Do not draw across gaps. Speed-integrated distance and boundary residuals are approximate.',
                          'Delta needs two complete coverages and common observed distance only.']}
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix('.tmp')
            tmp.write_text(json.dumps(result))
            tmp.replace(path)
        except Exception as exc:
            with self.lock:
                self.retry_after[key] = time.monotonic() + 60
                self.errors[key] = type(exc).__name__
        finally:
            with self.lock:
                self.running = None
