"""Session start/end alert decisions. Pure functions so they are testable without Discord."""
from __future__ import annotations

from datetime import datetime, timedelta

from . import live, schedule
from .state import State

START_LEAD = timedelta(minutes=10)
START_GRACE = timedelta(minutes=20)


def due_start_alerts(sessions, now: datetime, state: State, series: set[str] | None = None):
    """Sessions whose start alert window is open and which have not been announced yet."""
    due = []
    for s in sessions:
        if series and s.series not in series:
            continue
        if s.start - START_LEAD <= now <= s.start + START_GRACE and not state.seen('start', s.uid):
            due.append(s)
    return due


def start_message(session) -> str:
    minutes = round((session.start - datetime.now(session.start.tzinfo)).total_seconds() / 60)
    when = f'{minutes}분 후 시작' if minutes > 0 else '시작했습니다'
    line = f'🏁 **{session.series_label} {session.name}** {when} ({schedule.format_kst(session.start)})'
    if session.source:
        line += f'\n일정 출처: {session.source}'
    return line


def due_end_alert(payload: dict, state: State):
    ended = live.detect_session_end(payload)
    if not ended:
        return None
    key, label = ended
    if state.seen('end', key):
        return None
    return key, label


def end_message(label: str) -> str:
    return f'🏁 **{label}** 세션이 종료되었습니다. 공식 결과는 확정 전일 수 있습니다.'
