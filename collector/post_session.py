"""After an F1 session, load it with FastF1 and publish best laps and best-lap telemetry.

F1 analysis uses FastF1 only. The official archive appears some time after a session,
so each scheduled run retries until it loads; the site serves what was published and
tells the AI to search the web for anything FastF1 does not provide.
"""
import os
from datetime import timedelta

import cloud
from history import history_from_session
from telemetry import laps_from_session

PARTS = ('session', 'Q1', 'Q2', 'Q3')
# Collector hosts keep retrying for a week, so a session whose data could not be loaded
# while every host was off (or asleep between sessions) is still filled in later.
# The manual workflow passes its own look-back (input history_hours).
RETRY_FOR = timedelta(hours=float(os.environ.get('HISTORY_RETRY_HOURS') or 168))


def pending_window(windows, now, is_done):
    """Most recent window that has closed (within RETRY_FOR) and has no published history."""
    closed = [w for w in windows if cloud.datetime.fromisoformat(w['close']) <= now
              and now - cloud.datetime.fromisoformat(w['close']) <= RETRY_FOR]
    for window in sorted(closed, key=lambda w: w['close'], reverse=True):
        if not is_done(window['id']):
            return window
    return None


def load(window):
    import fastf1
    from telemetry import FASTF1_LOAD_LOCK
    start = cloud.datetime.fromisoformat(window['start'])
    with FASTF1_LOAD_LOCK, fastf1.Cache.disabled():
        session = fastf1.get_session(start.year, window['event'], window['name'])
        session.load(laps=True, telemetry=True, weather=False, messages=True)
    info = dict(session.session_info)
    if not info.get('Key') or not info.get('Path') or len(session.laps) == 0:
        raise ValueError('FastF1 archive not published yet')
    return session, info


def build(session, info):
    """Archive payload plus one telemetry payload per (part, driver) best lap."""
    state, detail = history_from_session(session, info)
    archive = state.laps.export(state.topics)
    archive['recovery'] = dict(detail, state='complete')
    payload = {'session_info': info, 'topics': {k: state.topics[k] for k in ('SessionInfo', 'TimingData', 'DriverList', 'SessionStatus') if k in state.topics},
               'lap_archive': archive}
    laps = []
    for part in PARTS:
        for driver, row in (archive.get('best_laps', {}).get(part) or {}).items():
            if row.get('status') != 'complete':
                continue
            try:
                lap = laps_from_session(session, [row])[0]
            except Exception as exc:  # one bad lap must not block the rest
                cloud.run_log({'event': 'history_lap_skipped', 'part': part, 'driver': driver, 'error': type(exc).__name__})
                continue
            laps.append((part, driver, lap))
    return payload, laps
