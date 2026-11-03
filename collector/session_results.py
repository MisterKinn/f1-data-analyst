"""Bounded, read-only FastF1 result jobs, separate from live collection."""
from collections import OrderedDict
from datetime import datetime, timezone
import math
import threading
import time

SESSIONS = {'FP1', 'FP2', 'FP3', 'Q', 'SQ', 'R', 'S'}


def selection(year, event, session):
    if isinstance(year, bool) or isinstance(event, bool):
        raise ValueError('Invalid selection')
    year, event = int(year), int(event)
    if not 2018 <= year <= datetime.now(timezone.utc).year or not 1 <= event <= 30 or session not in SESSIONS:
        raise ValueError('Invalid selection')
    return year, event, session


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def text(value):
    return value if isinstance(value, str) else ''


def duration(value):
    if value is None:
        return None
    try:
        seconds = value.total_seconds()
        return round(seconds, 3) if math.isfinite(seconds) and seconds >= 0 else None
    except (TypeError, ValueError, AttributeError):
        return None


def normalize(records, session):
    """Preserve published positions, including qualifying elimination order."""
    rows = []
    for record in records:
        position = number(record.get('Position'))
        position = int(position) if position is not None and position > 0 and position.is_integer() else None
        rows.append({
            'position': position, 'number': text(record.get('DriverNumber')),
            'name': text(record.get('FullName')) or text(record.get('Abbreviation')),
            'code': text(record.get('Abbreviation')), 'team': text(record.get('TeamName')),
            'status': text(record.get('Status')), 'classified': text(record.get('ClassifiedPosition')),
            'laps': number(record.get('Laps')), 'points': number(record.get('Points')),
            'time_seconds': duration(record.get('Time')),
            **{part.lower(): duration(record.get(part)) for part in ('Q1', 'Q2', 'Q3')},
        })
    if not rows or any(not r['number'] or not r['name'] for r in rows) or len({r['number'] for r in rows}) != len(rows):
        raise ValueError('Incomplete result identities')
    if not any(r['position'] is not None for r in rows):
        raise ValueError('Published positions unavailable')
    return sorted(rows, key=lambda r: r['position'] if r['position'] is not None else 999)


def load_results(year, event, code):
    import fastf1
    import pandas as pd
    from telemetry import FASTF1_LOAD_LOCK
    # Do not queue behind telemetry recovery and occupy the only result worker.
    if not FASTF1_LOAD_LOCK.acquire(blocking=False):
        raise RuntimeError('FastF1 loader busy')
    try:
        with fastf1.Cache.disabled():
            session = fastf1.get_session(year, event, code)
            start = pd.Timestamp(session.date)
            if pd.isna(start):
                raise ValueError('Session start unavailable')
            start = start.tz_localize('UTC') if start.tzinfo is None else start.tz_convert('UTC')
            if start > pd.Timestamp.now(tz='UTC'):
                raise ValueError('Session not started')
            session.load(laps=True, telemetry=False, weather=False, messages=False)
            records = session.results.to_dict('records')
            derived = False
            # Older FastF1 versions do not publish practice positions in results.
            if code.startswith('FP') and not any((number(r.get('Position')) or 0) > 0 for r in records):
                derived = True
                best = {}
                for lap in session.laps.to_dict('records'):
                    value = duration(lap.get('LapTime'))
                    deleted = lap.get('Deleted')
                    if value is None or value <= 0 or pd.isna(deleted) or bool(deleted):
                        continue
                    driver = text(lap.get('DriverNumber'))
                    if driver not in best or value < duration(best[driver]):
                        best[driver] = lap['LapTime']
                ordered = sorted(best, key=lambda driver: duration(best[driver]))
                ranks = {driver: i + 1 for i, driver in enumerate(ordered)}
                for record in records:
                    record['Position'] = ranks.get(record.get('DriverNumber'))
                    record['Time'] = best.get(record.get('DriverNumber'))
            rows = normalize(records, code)
            return {'state': 'ready', 'series': 'f1', 'season': year, 'round': event,
                    'session': code, 'event': str(session.event['EventName']), 'rows': rows,
                    'classification': 'BEST_LAP_ORDER' if derived else 'PUBLISHED',
                    'provider': 'FastF1 Session.load · official session records',
                    'source': 'https://livetiming.formula1.com/' + session.api_path.lstrip('/'),
                    'retrieved_at': datetime.now(timezone.utc).isoformat(),
                    'note': '게시된 기록 기준이며, 사후 판정으로 수정될 수 있습니다.'}
    finally:
        FASTF1_LOAD_LOCK.release()


class ResultJobs:
    def __init__(self, loader=load_results):
        self.loader = loader
        self.lock = threading.Lock()
        self.running = None
        self.cache = OrderedDict()

    def request(self, year, event, session):
        key = selection(year, event, session)
        with self.lock:
            hit = self.cache.get(key)
            if hit and time.monotonic() - hit[0] < (300 if hit[1]['state'] == 'ready' else 15):
                return hit[1]
            if self.running is not None:
                return {'state': 'pending', 'retry_after_seconds': 5}
            self.running = key
            threading.Thread(target=self._run, args=(key,), daemon=True).start()
        return {'state': 'pending', 'retry_after_seconds': 5}

    def _run(self, key):
        try:
            result = self.loader(*key)
        except Exception:
            result = {'state': 'unavailable', 'message': '공식 세션 기록이 아직 없거나 로더가 사용 중입니다. 잠시 후 다시 조회해 주세요.'}
        with self.lock:
            self.cache[key] = (time.monotonic(), result)
            self.cache.move_to_end(key)
            while len(self.cache) > 16:
                self.cache.popitem(last=False)
            self.running = None


RESULTS = ResultJobs()
