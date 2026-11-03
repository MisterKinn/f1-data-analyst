"""Turns a collector /snapshot payload into short Korean text. Never presents stale data as live."""
from __future__ import annotations

from datetime import datetime, timezone
import math

LIVE_MAX_AGE_SECONDS = 45
FINISHED = {'Finished', 'Finalised', 'Ends'}


def _topics(payload: dict) -> dict:
    return ((payload or {}).get('snapshot') or {}).get('topics') or {}


def session_label(payload: dict) -> str | None:
    info = _topics(payload).get('SessionInfo') or {}
    meeting = (info.get('Meeting') or {}).get('Name')
    name = info.get('Name')
    if not (meeting or name):
        return None
    return ' · '.join(x for x in (meeting, name) if x)


def freshness(payload: dict) -> tuple[bool, str]:
    snap = (payload or {}).get('snapshot')
    if not snap:
        return False, '수집된 스냅샷이 없습니다.'
    age = snap.get('feed_age_seconds')
    if not snap.get('connected'):
        return False, '수집기가 피드에 연결되어 있지 않습니다. 마지막 기록이며 라이브가 아닙니다.'
    valid = lambda value: isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and -10 <= value <= LIVE_MAX_AGE_SECONDS
    if not valid(age):
        shown = f'{int(age)}초' if isinstance(age, (int, float)) and math.isfinite(age) else '알 수 없음'
        return False, f'마지막 수신이 {shown} 전입니다. 라이브로 볼 수 없습니다.'
    if (_topics(payload).get('SessionStatus') or {}).get('Status') not in ('Started', 'Resumed'):
        return False, '진행 중인 세션으로 확인되지 않습니다.'
    def clock_age(value):
        try:
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return (datetime.now(timezone.utc) - parsed).total_seconds() if parsed.tzinfo else None
        except (ValueError, TypeError, AttributeError):
            return None
    if not all(valid(clock_age(snap.get(key))) for key in ('generated_at', 'last_message_at')):
        return False, '스냅샷 생성·수신 시각이 최신으로 확인되지 않습니다.'
    times = snap.get('topic_times') or {}
    def source_age(topic):
        row = times.get(topic) or {}
        return clock_age(row.get('source_time')) if topic in _topics(payload) and row.get('initial_snapshot') is False else None
    if not any(valid(source_age(topic)) for topic in ('Heartbeat', 'ExtrapolatedClock')) or not valid(source_age('TimingData')):
        return False, '원본 타이밍이 오래됐거나 원본 시각을 확인할 수 없습니다. 라이브가 아닙니다.'
    return True, f'피드 수신 {int(age)}초 전'


def _value(node):
    return node.get('Value') if isinstance(node, dict) else node


def _stints(app_line: dict) -> list:
    stints = (app_line or {}).get('Stints') or []
    if isinstance(stints, dict):
        stints = [stints[k] for k in sorted(stints, key=lambda k: int(k) if str(k).isdigit() else 0)]
    return stints


def standings_rows(payload: dict, limit: int = 10) -> list[dict]:
    topics = _topics(payload)
    drivers = topics.get('DriverList') or {}
    lines = (topics.get('TimingData') or {}).get('Lines') or {}
    app = (topics.get('TimingAppData') or {}).get('Lines') or {}
    rows = []
    for number, line in lines.items():
        if not isinstance(line, dict):
            continue
        try:
            position = int(line.get('Position') or 0)
        except ValueError:
            position = 0
        stints = _stints(app.get(number))
        last_stint = stints[-1] if stints else {}
        rows.append({
            'position': position,
            'tla': (drivers.get(number) or {}).get('Tla') or f'#{number}',
            'best': _value(line.get('BestLapTime')) or '-',
            'last': _value(line.get('LastLapTime')) or '-',
            'gap': _value(line.get('GapToLeader')) or _value(line.get('IntervalToPositionAhead')) or '',
            'tyre': last_stint.get('Compound') or '',
            'tyre_laps': last_stint.get('TotalLaps'),
            'in_pit': bool(line.get('InPit')),
        })
    rows = [r for r in rows if r['position'] > 0]
    return sorted(rows, key=lambda r: r['position'])[:limit]


def summarize(payload: dict, limit: int = 10) -> str:
    label = session_label(payload)
    is_live, note = freshness(payload)
    header = f'**{label or "세션 정보 없음"}** — {"🟢 라이브" if is_live else "⚪ 라이브 아님"} ({note})'
    rows = standings_rows(payload, limit)
    if not rows:
        return header + '\n표시할 타이밍 데이터가 없습니다.'
    lines = [header, '```']
    for r in rows:
        tyre = f'{r["tyre"][:1]}{r["tyre_laps"]}' if r['tyre'] and r['tyre_laps'] is not None else (r['tyre'][:1] or '-')
        pit = ' PIT' if r['in_pit'] else ''
        lines.append(f'{r["position"]:>2} {r["tla"]:<4} best {r["best"]:<9} last {r["last"]:<9} {r["gap"]:<8} {tyre}{pit}')
    lines.append('```')
    messages = (_topics(payload).get('RaceControlMessages') or {}).get('Messages')
    if messages:
        recent = list(messages.values() if isinstance(messages, dict) else messages)[-1]
        text = recent.get('Message') if isinstance(recent, dict) else None
        if text:
            lines.append(f'최근 레이스 컨트롤: {text}')
    return '\n'.join(lines)


def detect_session_end(payload: dict) -> tuple[str, str] | None:
    """Return (dedup key, label) when the current session has finished, else None."""
    topics = _topics(payload)
    status = (topics.get('SessionStatus') or {}).get('Status')
    if status not in FINISHED:
        return None
    info = topics.get('SessionInfo') or {}
    key = info.get('Key')
    label = session_label(payload)
    if key is None or not label:
        return None
    return f'{key}|{info.get("StartDate", "")}', label


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
