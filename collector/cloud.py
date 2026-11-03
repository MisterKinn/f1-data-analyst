"""Collect scheduled F1 sessions automatically; retain opt-in page-lease mode."""
import argparse
import zlib
import hmac
import json
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

UTC = timezone.utc
DATA = Path(os.environ.get('DATA_DIR', '/data'))
STOP = threading.Event()
LEASE_LOCK = threading.Lock()
LEASE_UNTIL = 0.0
WEC_RUNTIME = "not_checked"
WEC = None  # Initialized only by serve; F1 recording stays independent.
TELEMETRY = None
HISTORY = None
SUPPORTED_SESSIONS = ('Practice 1', 'Practice 2', 'Practice 3', 'Qualifying',
                      'Sprint Qualifying', 'Sprint Shootout', 'Sprint', 'Race')
TERMINAL_SESSION_STATUSES = frozenset(('Finished', 'Finalised', 'Cancelled', 'Canceled', 'Aborted'))
RETRY_DELAYS = (30, 60, 120, 240)
RETRY_BUDGET_SECONDS = 300


def renew_lease():
    global LEASE_UNTIL
    with LEASE_LOCK:
        LEASE_UNTIL = time.monotonic() + 90


def clear_lease():
    global LEASE_UNTIL
    with LEASE_LOCK:
        LEASE_UNTIL = 0.0


def lease_active():
    with LEASE_LOCK:
        return time.monotonic() < LEASE_UNTIL


def now():
    return datetime.now(UTC)


def read_json(path, default=None):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    temporary.replace(path)


def automatic_collection():
    return os.environ.get('AUTO_COLLECT', 'true').lower() in ('1', 'true', 'yes')


def collection_enabled():
    if read_json(DATA / 'control.json', {}).get('paused', False):
        return False
    return automatic_collection() or lease_active()


def set_paused(paused):
    with LEASE_LOCK:
        atomic_json(DATA / 'control.json', {'paused': bool(paused)})


def session_windows(rows):
    """FastF1 UTC columns are naive UTC; never use the server's local timezone."""
    windows = []
    for row in rows:
        if not row.get('RoundNumber'):
            continue
        for index in range(1, 6):
            name = row.get(f'Session{index}')
            value = row.get(f'Session{index}DateUtc')
            if name not in SUPPORTED_SESSIONS or not value:
                continue
            start = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
            if start.tzinfo is None:
                start = start.replace(tzinfo=UTC)
            start = start.astimezone(UTC)
            windows.append({
                'id': f"{start.year}-{int(row['RoundNumber'])}-{index}",
                'event': row['EventName'], 'name': name,
                'start': start.isoformat(),
                'open': (start - timedelta(minutes=5)).isoformat(),
                # Allow race start delays plus interruptions and final messages.
                # Finalised still stops recording early through record().
                'close': (start + timedelta(hours=4 if name == 'Race' else 3)).isoformat(),
            })
    return sorted(windows, key=lambda x: x['start'])


# Compatibility for callers using the original practice-only function name.
practice_windows = session_windows


def terminal_session_status(value):
    return str(value or '').strip().casefold() in {
        status.casefold() for status in TERMINAL_SESSION_STATUSES
    }


def retry_delay(attempt, elapsed):
    """Return the next in-session transient retry delay, or None after five minutes."""
    if elapsed >= RETRY_BUDGET_SECONDS or attempt < 0:
        return None
    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
    return delay if elapsed + delay <= RETRY_BUDGET_SECONDS else None


def eligible(windows, at, completed):
    return next((w for w in windows if w['id'] not in completed
                 and datetime.fromisoformat(w['open']) <= at
                 < datetime.fromisoformat(w['close'])), None)


def session_matches(info, window):
    if info.get('Name') != window['name']:
        return False
    if info.get('Meeting', {}).get('Name') != window['event']:
        return False
    # Never accept a previous weekend's cached SessionInfo.
    try:
        stamp = datetime.fromisoformat(info['StartDate'])
        if stamp.tzinfo is None:
            offset = info['GmtOffset']
            sign = -1 if offset.startswith('-') else 1
            hh, mm, *_ = map(int, offset.lstrip('+-').split(':'))
            stamp = stamp.replace(tzinfo=timezone(sign * timedelta(hours=hh, minutes=mm)))
        return abs((stamp.astimezone(UTC) - datetime.fromisoformat(window['start'])).total_seconds()) <= 3 * 3600
    except (KeyError, TypeError, ValueError):
        return False


def fetch_schedule():
    import fastf1
    import pandas as pd
    cache = DATA / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache))
    frames = [fastf1.get_event_schedule(now().year, include_testing=False, backend='fastf1')]
    if now().month == 12:
        try:
            frames.append(fastf1.get_event_schedule(now().year + 1, include_testing=False, backend='fastf1'))
        except Exception:
            pass
    rows = []
    for frame in frames:
        for row in frame.to_dict('records'):
            rows.append({k: (None if pd.isna(v) else v.isoformat() if hasattr(v, 'isoformat') else v)
                         for k, v in row.items()})
    checked = now().isoformat()
    atomic_json(DATA / 'schedule.json', {
        'fetched_at': checked,
        'checked_at': checked,
        'source': 'FastF1 official schedule backend',
        'timezone': 'UTC',
        'windows': session_windows(rows),
    })


def record(window):
    import logging
    from collector import State, TOPICS
    import fastf1
    from fastf1.internals.f1account import get_token
    from fastf1.livetiming.client import SignalRClient
    from signalrcore.messages.completion_message import CompletionMessage

    if not os.environ.get('F1_USERNAME') or not os.environ.get('F1_PASSWORD'):
        return 20
    # Keep library exception bodies and authentication payloads out of host logs.
    logging.disable(logging.CRITICAL)
    fastf1.set_auth_method('password')
    try:
        get_token()
    except Exception:
        return 21
    state = State(read_json(DATA / 'lap-archive.json'))
    previous = read_json(DATA / 'snapshot.json')
    if previous:
        previous['connected'] = False
        atomic_json(DATA / 'snapshot.json', previous)
    accepted = threading.Event()
    failed = threading.Event()
    session_dir = DATA / 'sessions' / window['id']
    session_dir.mkdir(parents=True, exist_ok=True)

    class Client(SignalRClient):
        def _access_token_factory(self):
            # The upstream default permits unauthenticated fallback; we don't.
            get_token()
            return lambda: get_token().value

        def _on_message(self, message):
            try:
                if isinstance(message, CompletionMessage):
                    payload = message.result
                    if not isinstance(payload, dict) or not session_matches(payload.get('SessionInfo', {}), window):
                        failed.set()
                        return
                    accepted.set()
                    if state.telemetry is None or state.telemetry.info['Key'] != payload['SessionInfo']['Key']:
                        from telemetry import LiveTelemetry
                        state.telemetry = LiveTelemetry(DATA / 'telemetry', payload['SessionInfo'], session_dir / 'timing-raw.txt')
                    for topic in sorted(payload, key=lambda k: k != 'SessionInfo'):
                        state.apply(topic, payload[topic], initial=True)
                elif isinstance(message, list) and len(message) >= 2 and accepted.is_set():
                    if message[0] == 'SessionInfo':
                        from collector import merge
                        info = merge(state.snapshot()['topics'].get('SessionInfo', {}), message[1])
                        if not session_matches(info, window):
                            failed.set()
                            return
                    state.apply(message[0], message[1], message[2] if len(message) > 2 else '')
                else:
                    return
                super()._on_message(message)
            except (ValueError, TypeError, KeyError, zlib.error):
                with state.lock:
                    state.errors += 1

        def _on_connect(self):
            super()._on_connect()
            with state.lock:
                state.connected = True

        def _on_close(self):
            super()._on_close()
            with state.lock:
                state.connected = False
            failed.set()

    client = Client(str(session_dir / 'timing-raw.txt'), filemode='a', timeout=90)
    client.topics = TOPICS

    def run_client():
        try:
            client.start()
        except Exception:
            pass
        finally:
            failed.set()

    threading.Thread(target=run_client, daemon=True).start()
    began = time.monotonic()
    recovery_job = None
    recover_at = 0
    finished = False
    try:
        while not STOP.wait(2) and not failed.is_set():
            snapshot = state.snapshot()
            if accepted.is_set():
                # Rebuild historical laps off-thread without holding up live reception.
                # Fixed official session path; replay never updates live freshness.
                if time.monotonic() >= recover_at and not (recovery_job and recovery_job.is_alive()):
                    from recovery import recover
                    recover_at = time.monotonic() + 120
                    recovery_job = threading.Thread(target=recover, args=(state,
                        snapshot['topics']['SessionInfo'], session_dir / 'timing-raw.txt'), daemon=True)
                    recovery_job.start()
                while len(json.dumps(snapshot).encode()) > 900_000 and snapshot['recent_events']:
                    snapshot['recent_events'] = snapshot['recent_events'][20:]
                atomic_json(DATA / 'snapshot.json', snapshot)
                with state.lock:
                    atomic_json(DATA / 'lap-archive.json', state.laps.checkpoint())
                atomic_json(DATA / 'sessions' / str(snapshot['topics']['SessionInfo']['Key']) / 'snapshot.json', snapshot)
                status = snapshot['topics'].get('SessionStatus', {}).get('Status')
                if terminal_session_status(status):
                    finished = True
                    break
            if time.monotonic() - began > 120 and not accepted.is_set():
                break
            if now() >= datetime.fromisoformat(window['close']):
                break
    finally:
        # Stop the producer before persisting its final state; no post-checkpoint packets.
        try:
            client._exit()
        except Exception:
            pass
        with state.lock:
            state.connected = False
        if accepted.is_set():
            snapshot = state.snapshot()
            atomic_json(DATA / 'snapshot.json', snapshot)
            atomic_json(session_dir / 'snapshot.json', snapshot)
            with state.lock:
                atomic_json(DATA / 'lap-archive.json', state.laps.checkpoint())
    return 0 if finished else 22


def child(*args, **kwargs):
    return subprocess.Popen([sys.executable, str(Path(__file__).resolve()), *args],
                            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, **kwargs)


def stop_child(process):
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def supervisor():
    process = None
    window = None
    retry_at = 0
    refresh_at = 0
    auth_state = 'not_checked'
    auth_checked = False
    record_started = None
    retry_attempt = 0
    retry_started = None
    completed = read_json(DATA / 'completed.json', [])
    try:
        while not STOP.is_set():
            from telemetry import purge_expired
            purge_expired(DATA)
            if time.monotonic() >= refresh_at:
                refresh_at = time.monotonic() + 3600
                job = child('schedule')
                try:
                    job.wait(timeout=90)
                except subprocess.TimeoutExpired:
                    stop_child(job)
                if job.returncode:
                    refresh_at = time.monotonic() + 300
            schedule = read_json(DATA / 'schedule.json', {})
            windows = schedule.get('windows', [])
            selected = eligible(windows, now(), completed) if collection_enabled() else None
            if process and process.poll() is not None:
                code = process.returncode
                if code == 0 and window:
                    completed = (completed + [window['id']])[-200:]
                    atomic_json(DATA / 'completed.json', completed)
                auth_state = {20: 'credentials_required', 21: 'authentication_failed'}.get(code, auth_state)
                # Missing/invalid credentials fail closed for this session. Transient
                # transport failures retry 30s, 60s, then back off within five minutes.
                if code in (20, 21):
                    if window:
                        completed = (completed + [window['id']])[-200:]
                        atomic_json(DATA / 'completed.json', completed)
                    retry_at = float('inf')
                elif code != 0:
                    retry_started = retry_started or time.monotonic()
                    delay = retry_delay(retry_attempt, time.monotonic() - retry_started)
                    retry_attempt += 1
                    if delay is None and window:
                        completed = (completed + [window['id']])[-200:]
                        atomic_json(DATA / 'completed.json', completed)
                        retry_at = float('inf')
                    elif delay is not None:
                        retry_at = time.monotonic() + delay
                    else:
                        retry_at = float('inf')
                else:
                    retry_attempt = 0
                    retry_started = None
                    retry_at = 0
                process = None
                selected = eligible(windows, now(), completed) if collection_enabled() else None
            if process and (not selected or selected['id'] != window['id']):
                stop_child(process)
                process = None
            credentials = bool(os.environ.get('F1_USERNAME') and os.environ.get('F1_PASSWORD'))
            if not credentials:
                auth_state = 'credentials_required'
            elif selected and not auth_checked:
                job = child('auth')
                try:
                    job.wait(timeout=45)
                except subprocess.TimeoutExpired:
                    stop_child(job)
                auth_state = 'authenticated' if job.returncode == 0 else 'authentication_failed'
                auth_checked = True
            if selected and process is None and credentials and time.monotonic() >= retry_at:
                if window is None or selected['id'] != window['id']:
                    retry_attempt = 0
                    retry_started = None
                    retry_at = 0
                window = selected
                previous = read_json(DATA / 'snapshot.json')
                if previous:
                    previous['connected'] = False
                    atomic_json(DATA / 'snapshot.json', previous)
                record_started = now().isoformat()
                process = child('record', '--window', json.dumps(window))
                auth_state = 'checking_or_connected'
            future = next((w for w in windows if datetime.fromisoformat(w['open']) > now()), None)
            snap = read_json(DATA / 'snapshot.json')
            active_match = bool(snap and window and session_matches(snap.get('topics', {}).get('SessionInfo', {}), window))
            state = ('recording' if process and active_match and snap.get('connected') else
                     'connecting' if process else 'credentials_required' if not credentials else
                     'schedule_unavailable' if not windows else
                     'waiting' if collection_enabled() else 'paused')
            atomic_json(DATA / 'status.json', {
                'state': state, 'checked_at': now().isoformat(), 'auth_state': auth_state,
                'schedule_fetched_at': schedule.get('fetched_at'),
                'active_window': window if process else None, 'next_session': future,
                'next_practice': future,  # legacy clients
                'supported_sessions': list(SUPPORTED_SESSIONS),
                'collector_running': process is not None,
                'record_started': record_started,
                'page_connected': lease_active(),
                'automatic_collection': automatic_collection(),
                'collection_enabled': collection_enabled(),
            })
            STOP.wait(5)
    finally:
        stop_child(process)


CHAMPIONSHIP_CACHE = {}
CHAMPIONSHIP_LOCK = threading.Lock()


def championship(kind):
    if kind not in ('drivers', 'constructors'):
        raise ValueError('Invalid standings category')
    year = now().year
    key = (year, kind)
    with CHAMPIONSHIP_LOCK:
        cached = CHAMPIONSHIP_CACHE.get(key)
        if cached and time.monotonic() - cached[0] < 300:
            return cached[1]
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('championship.py')),
                                 kind, str(year)], capture_output=True, text=True, timeout=16, check=True)
        payload = json.loads(result.stdout)
        CHAMPIONSHIP_CACHE[key] = (time.monotonic(), payload)
        return payload


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/healthz':
            status = read_json(DATA / 'status.json', {})
            try:
                age = (now() - datetime.fromisoformat(status['checked_at'])).total_seconds()
            except (KeyError, ValueError):
                age = 999
            return self.reply({'ok': age < 180, 'wec_browser': WEC_RUNTIME, 'commit_sha': os.environ.get('RENDER_GIT_COMMIT')}, 200 if age < 180 else 503)
        if not self.authorized():
            return self.reply({'error': 'Unauthorized'}, 401)
        if self.path.startswith('/official/published?'):
            from urllib.parse import urlsplit, parse_qs
            from official_published import published_file
            try:
                query = parse_qs(urlsplit(self.path).query, strict_parsing=True)
                if set(query) != {'url'} or len(query['url']) != 1:
                    raise ValueError('Invalid source URL')
                return self.reply(published_file(query['url'][0]))
            except Exception:
                return self.reply({'error': 'Official published source unavailable'}, 502)
        if self.path.startswith('/wec/published?'):
            from urllib.parse import urlsplit, parse_qs
            from wec_published import published_file
            try:
                query = parse_qs(urlsplit(self.path).query, strict_parsing=True)
                if set(query) != {'url'} or len(query['url']) != 1:
                    raise ValueError('Invalid source URL')
                return self.reply(published_file(query['url'][0]))
            except Exception:
                return self.reply({'error': 'Al Kamel published source unavailable'}, 502)
        if self.path.startswith('/championship/'):
            try:
                return self.reply(championship(self.path.removeprefix('/championship/')))
            except ValueError:
                return self.reply({'error': 'Invalid championship category'}, 400)
            except Exception:
                return self.reply({'error': 'FastF1 standings unavailable'}, 502)
        if self.path == '/wec/snapshot':
            return self.reply(WEC.read() if WEC else {'state': 'not_started', 'live': False, 'records': []})
        if self.path != '/snapshot':
            return self.reply({'error': 'Not found'}, 404)
        return self.current()

    def authorized(self):
        expected = os.environ.get('COLLECTOR_READ_KEY', '')
        supplied = self.headers.get('Authorization', '').removeprefix('Bearer ')
        return len(expected) >= 32 and hmac.compare_digest(supplied.encode(), expected.encode())

    def do_POST(self):
        if not self.authorized():
            return self.reply({'error': 'Unauthorized'}, 401)
        if self.path == '/telemetry/laps':
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 24000:
                    raise ValueError('Invalid body')
                args = json.loads(self.rfile.read(size))
                return self.reply(TELEMETRY.request(args['session_info'], args['laps'], args.get('historical') is True))
            except (ValueError, TypeError, KeyError):
                return self.reply({'error': 'Invalid lap telemetry request'}, 400)
        if self.path == '/history/recover':
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 200000:
                    raise ValueError('Invalid body')
                return self.reply(HISTORY.request(json.loads(self.rfile.read(size))['topics']))
            except (ValueError, TypeError, KeyError):
                return self.reply({'error': 'Invalid history request'}, 400)
        if self.path == '/wec/discover':
            if WEC is None:
                return self.reply({'error': 'WEC runtime not ready; F1 collection remains independent'}, 503)
            from wec_browser import DiscoveryError
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 2048 or not self.headers.get('Content-Type', '').startswith('application/json'):
                    return self.reply({'error': 'Invalid request body'}, 400)
                target = json.loads(self.rfile.read(size))
                return self.reply(WEC.request(target), 202)
            except (ValueError, DiscoveryError):
                return self.reply({'error': 'Invalid WEC target'}, 400)
        if self.path == '/poll':
            set_paused(False)
            renew_lease()
            return self.current()
        if self.path == '/stop':
            set_paused(True)
            clear_lease()
            return self.reply({'ok': True})
        return self.reply({'error': 'Not found'}, 404)

    def current(self):
        snapshot = read_json(DATA / 'snapshot.json')
        status = read_json(DATA / 'status.json', {})
        # A process restart must not turn its persisted connected flag into live data.
        if snapshot and (not status.get('collector_running') or not collection_enabled()):
            snapshot['connected'] = False
        if snapshot and status.get('record_started') and snapshot.get('generated_at', '') < status['record_started']:
            snapshot['connected'] = False
        return self.reply({'snapshot': snapshot, 'collector': status})

    def reply(self, data, code=200):
        payload = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def prepare_wec():
    global WEC, WEC_RUNTIME
    WEC_RUNTIME = 'preparing'
    try:
        from wec_install import ensure_browser
        from wec_runtime import WECManager
        WEC_RUNTIME = ensure_browser()
        WEC = WECManager(DATA)
    except Exception:
        WEC_RUNTIME = 'unavailable'
        print('WEC runtime unavailable; F1 collector continues independently.', flush=True)


def main():
    global WEC, WEC_RUNTIME, TELEMETRY, HISTORY
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['serve', 'schedule', 'record', 'auth'], default='serve', nargs='?')
    parser.add_argument('--window')
    args = parser.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault('XDG_DATA_HOME', str(DATA / 'auth'))
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    if args.mode == 'auth':
        import logging
        logging.disable(logging.CRITICAL)
        if not os.environ.get('F1_USERNAME') or not os.environ.get('F1_PASSWORD'):
            return 20
        try:
            import fastf1
            from fastf1.internals.f1account import get_token
            fastf1.set_auth_method('password')
            get_token()
            print('F1 authentication succeeded. Live stream reception remains unverified.')
            return 0
        except Exception:
            print('F1 authentication failed. Check credentials and subscription in the provider dashboard.')
            return 21
    elif args.mode == 'schedule':
        fetch_schedule()
    elif args.mode == 'record':
        return record(json.loads(args.window))
    else:
        if len(os.environ.get('COLLECTOR_READ_KEY', '')) < 32:
            print('COLLECTOR_READ_KEY must contain at least 32 characters.', flush=True)
            return 2
        from telemetry import TelemetryJobs
        TELEMETRY = TelemetryJobs(DATA / 'telemetry-jobs', DATA / 'telemetry')
        from history import HistoryJobs
        HISTORY = HistoryJobs(DATA / 'history-jobs')
        atomic_json(DATA / 'status.json', {'state': 'starting', 'checked_at': now().isoformat(), 'collector_running': False})
        threading.Thread(target=supervisor, daemon=True).start()
        # F1 scheduling and HTTP health start immediately, even when WEC needs
        # a browser download or its optional runtime cannot be prepared.
        threading.Thread(target=prepare_wec, daemon=True).start()
        server = ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), Handler)
        server.timeout = 1
        while not STOP.is_set():
            server.handle_request()
        server.server_close()
        if WEC:
            WEC.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
