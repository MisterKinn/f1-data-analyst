"""Recover observed history from the same session's official F1 stream.

Replay into an isolated State: historical packets never refresh live timestamps.
No merged/rolling sector snapshot is used to reconstruct a completed lap.
"""
import ast
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from lap_archive import timestamp

BASE = 'https://livetiming.formula1.com/static/'
STREAMS = ('Heartbeat', 'ExtrapolatedClock', 'SessionData', 'TimingAppData', 'TimingData', 'RaceControlMessages', 'SessionStatus', 'TrackStatus')


def session_path(info):
    path = info.get('Path', '')
    if not re.fullmatch(r'20\d{2}/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/', path):
        raise ValueError('Unverified official session path')
    return path


def elapsed(value):
    if not re.fullmatch(r'\d{2,3}:\d{2}:\d{2}\.\d{3}', value):
        raise ValueError('Invalid stream clock')
    h, m, s = value.split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def stream(info, topic, limit=16_000_000):
    import requests
    if topic not in STREAMS + ('CarData.z',):
        raise ValueError('Unsupported recovery stream')
    url = BASE + session_path(info) + topic + '.jsonStream'
    with requests.get(url, timeout=(5, 20), stream=True, allow_redirects=False) as response:
        response.raise_for_status()
        if response.status_code != 200:
            raise ValueError('Official stream unavailable')
        size = 0
        for raw in response.iter_lines():
            size += len(raw) + 2
            if size > limit:
                raise ValueError('Official stream size limit')
            line = raw.decode('utf-8-sig')
            if not line:
                continue
            yield elapsed(line[:12]), line[12:]


def replay_raw(path, info):
    from collector import State
    state = State()
    state.apply('SessionInfo', info, initial=True)
    count = 0
    # SignalRClient writes Python list literals, never executable Python.
    if not Path(path).exists():
        return state, count
    with Path(path).open(encoding='utf-8') as handle:
        for raw in handle:
            try:
                if len(raw) > 8_000_000:
                    continue
                topic, payload, at = ast.literal_eval(raw)
                if not at or topic not in STREAMS:
                    continue
                state.apply(topic, payload, at)
                count += 1
            except (ValueError, TypeError, SyntaxError, KeyError):
                continue
    return state, count


def replay_official(info, reader=stream):
    from collector import State
    state = State()
    state.apply('SessionInfo', info, initial=True)
    anchors = []
    for clock in ('Heartbeat', 'ExtrapolatedClock'):
        try:
            beats = [(at, json.loads(body)) for at, body in reader(info, clock)]
            anchors = [timestamp(body.get('Utc')) - at for at, body in beats if timestamp(body.get('Utc')) is not None]
            if anchors:
                break
        except Exception:
            continue
    if not anchors or max(anchors) - min(anchors) > 2:
        raise ValueError('Official stream UTC alignment unavailable')
    origin = sorted(anchors)[len(anchors) // 2]
    events = []
    failures = []
    for topic in STREAMS[2:]:
        try:
            events.extend((at, topic, json.loads(body)) for at, body in reader(info, topic))
        except Exception:
            failures.append(topic)
    if 'TimingData' in failures:
        raise ValueError('Official timing stream unavailable')
    for at, topic, payload in sorted(events, key=lambda x: x[0]):
        utc = datetime.fromtimestamp(origin + at, timezone.utc).isoformat()
        state.apply(topic, payload, utc)
    return state, {'source': BASE + session_path(info), 'packets': len(events),
                   'missing_streams': failures, 'utc_anchor_spread_seconds': max(anchors) - min(anchors)}


def recover(state, info, raw_path, reader=stream):
    result = {'state': 'running', 'session_key': info['Key']}
    try:
        local, count = replay_raw(raw_path, info)
        with state.lock:
            state.laps.absorb(local.laps.records, 'local_raw_replay')
        result['local_packets'] = count
        official, detail = replay_official(info, reader)
        with state.lock:
            state.laps.absorb(official.laps.records, 'official_stream_replay')
        result.update(detail, state='complete', recovered_laps=len(official.laps.records))
    except Exception as exc:
        # Safe class only: no HTTP headers, credentials or provider exception body.
        result.update(state='partial_or_unavailable', error_type=type(exc).__name__)
    result['checked_at'] = datetime.now(timezone.utc).isoformat()
    with state.lock:
        state.laps.recovery = result
    return result
