"""Run the F1 live collector inside a scheduled GitHub Actions job (no host computer).

Each scheduled run loads the FastF1 schedule. If a session window is open, or opens
within LOOKAHEAD_MINUTES, it records that session with the same recorder as the
cloud collector and pushes snapshots to the site, authenticated by the job's GitHub
OIDC token. Finished windows are marked on the site so later runs skip them.
"""
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

import cloud

SITE = os.environ.get('SITE_URL', 'https://kongboda-motorsports.vercel.app').rstrip('/')
AUDIENCE = 'kongboda-motorsports'
LOOKAHEAD = timedelta(minutes=int(os.environ.get('LOOKAHEAD_MINUTES', '45')))
# GitHub's scheduled runs can start 20+ minutes late or be skipped, so each session
# gets the longest lead time its job can afford: the job may wait, then record the
# whole window, within JOB_BUDGET (the workflow's 340-minute timeout minus a margin).
# Practice/qualifying/sprint windows (3h05) get 145 minutes; the race (4h05) gets 85.
JOB_BUDGET = timedelta(minutes=int(os.environ.get('JOB_BUDGET_MINUTES', '330')))
MAX_LOOKAHEAD = timedelta(minutes=150)
KEY_SESSIONS = frozenset(('Qualifying', 'Sprint Qualifying', 'Sprint Shootout', 'Sprint', 'Race'))
PUSH_INTERVAL = 10
LAST_HISTORY_ATTEMPT = {}
HISTORY_DONE = set()  # windows whose post-session upload the site confirmed
LAST_RESULT = {}  # window id -> finished | already_done | standby | login_failed | closed
_IDLE = [False]


def at(value):
    return datetime.fromisoformat(value)


def lookahead_for(window):
    try:
        length = at(window['close']) - at(window['open'])
    except (KeyError, TypeError, ValueError):
        return LOOKAHEAD
    return max(LOOKAHEAD, min(MAX_LOOKAHEAD, JOB_BUDGET - length))


def next_window(windows, now, lookahead=None):
    """The window that is open now or opens within its lookahead, earliest first."""
    return next((w for w in windows if now < at(w['close'])
                 and at(w['open']) - (lookahead or lookahead_for(w)) <= now), None)


def auth_header(method, url, body=None):
    """GitHub Actions uses its OIDC token; a home host signs with its registered key."""
    if os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL'):
        return 'Bearer ' + oidc_token()
    import host_auth
    return host_auth.header(method, url, body or b'')


def oidc_token():
    url = os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'] + '&audience=' + AUDIENCE
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)['value']


def site(method, window_id, body=None, final=False, flush=False):
    query = {'window': window_id, **({'final': '1'} if final else {}), **({'flush': '1'} if flush else {})}
    url = SITE + '/api/live/actions-push?' + urllib.parse.urlencode(query)
    try:
        request = urllib.request.Request(url, data=body, method=method,
                                         headers={'authorization': auth_header(method, url, body), 'content-type': 'application/json'})
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None
    except (OSError, ValueError):
        return None, None


def history(method, window_id, query=None, body=None):
    """Post-session FastF1 upload endpoint (same OIDC authentication as live pushes)."""
    params = {'window': window_id, **(query or {})}
    data = json.dumps(body).encode() if body is not None else None
    url = SITE + '/api/live/actions-history?' + urllib.parse.urlencode(params)
    try:
        request = urllib.request.Request(url, data=data, method=method,
                                         headers={'authorization': auth_header(method, url, data), 'content-type': 'application/json'})
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None
    except (OSError, ValueError):
        return None, None


def host_call(path, payload):
    """Signed JSON POST for home-host endpoints (heartbeat, registration).

    Returns (status, data); data carries the error body on HTTP errors and is None when
    the site cannot be reached."""
    body = json.dumps(payload).encode()
    url = SITE + path
    try:
        request = urllib.request.Request(url, data=body, method='POST',
                                         headers={'authorization': auth_header('POST', url, body), 'content-type': 'application/json'})
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.load(error)
        except (OSError, ValueError):
            return error.code, None
    except (OSError, ValueError):
        return None, None


def history_done(window_id):
    if window_id in HISTORY_DONE:
        return True
    status, data = history('GET', window_id)
    if status == 200 and data and data.get('done'):
        HISTORY_DONE.add(window_id)
        return True
    # If the site cannot answer, skip the heavy FastF1 load this run.
    return status != 200


def post_session(windows, skip=None):
    """No live window: publish FastF1 best laps and telemetry for the latest finished session."""
    import post_session as post
    window = post.pending_window(windows, cloud.now(), lambda wid: (skip and skip(wid)) or history_done(wid))
    if not window:
        if not _IDLE[0]:  # say it once, not every minute on a host
            print('No F1 session window now.')
            _IDLE[0] = True
        return 0
    _IDLE[0] = False
    LAST_HISTORY_ATTEMPT[window['id']] = time.monotonic()
    cloud.run_log({'event': 'history_start', 'window': window['id'], 'session': window['name']})
    try:
        session, info = post.load(window)
    except Exception as exc:
        # Not published yet (or a temporary FastF1 failure): the next scheduled run retries.
        cloud.run_log({'event': 'history_not_ready', 'window': window['id'], 'error': type(exc).__name__})
        return 0
    payload, laps = post.build(session, info)
    key = str(info['Key'])
    archive, _ = history('POST', window['id'], {'kind': 'archive', 'session_key': key}, payload)
    sent = 0
    for part, driver, lap in laps if archive == 200 else []:
        status, _ = history('POST', window['id'], {'kind': 'telemetry', 'session_key': key, 'part': part, 'driver': driver}, lap)
        sent += status == 200
    done = history('POST', window['id'], {'kind': 'done', 'session_key': key}, {'telemetry_laps': sent})[0] if archive == 200 else None
    cloud.run_log({'event': 'history_end', 'window': window['id'], 'session_key': key, 'archive': archive,
                   'telemetry_laps': sent, 'of': len(laps), 'done': done})
    return 0


def push(window_id, final=False, flush=False):
    path = cloud.DATA / 'snapshot.json'
    try:
        body = path.read_bytes()
    except OSError:
        return None
    return site('POST', window_id, body, final, flush)[0]


def main():
    if not os.environ.get('F1_USERNAME') or not os.environ.get('F1_PASSWORD'):
        print('F1_USERNAME / F1_PASSWORD repository secrets are missing; nothing recorded.')
        return 0
    cloud.DATA.mkdir(parents=True, exist_ok=True)
    if os.environ.get('PROBE') == '1':
        import probe
        return probe.main()
    cloud.fetch_schedule()
    windows = cloud.read_json(cloud.DATA / 'schedule.json', {}).get('windows', [])
    window = next_window(windows, cloud.now())
    if not window:
        return post_session(windows)
    return record_window(window)


def record_window(window, should_start=None, gate=None, hold=None):
    """Wait for the window to open, record it and push snapshots until it closes.

    gate() is False while another home host holds the baton: this host keeps recording
    (so it can take over at once) but does not publish. hold() is True for a cold-standby
    host that should not connect to F1 until it holds the baton."""
    status, data = site('GET', window['id'])
    if status == 200 and data and data.get('done'):
        print('Session already recorded:', window['event'], window['name'])
        LAST_RESULT[window['id']] = 'already_done'
        return 0
    _IDLE[0] = False
    if LAST_RESULT.get(window['id']) != 'standby':  # a standing-by backup re-checks every minute quietly
        print('Session:', window['event'], window['name'], 'start', window['start'])
        cloud.run_log({'event': 'job_start', 'window': window['id'], 'session': window['name'],
                       'session_start': window['start'], 'close': window['close']})
    while cloud.now() < at(window['open']):
        time.sleep(min(30, max(1, (at(window['open']) - cloud.now()).total_seconds())))
    if should_start and not should_start(window):
        LAST_RESULT[window['id']] = 'standby'
        return 0

    stop = threading.Event()

    def pusher():
        last, last_status, pushed_at, was_open = None, 'start', 0.0, True
        while not stop.wait(1):
            opened = gate() if gate else True
            took_over = opened and not was_open  # just got the baton: publish at once
            was_open = opened
            if not took_over and time.monotonic() - pushed_at < PUSH_INTERVAL:
                continue
            try:
                stamp = (cloud.DATA / 'snapshot.json').stat().st_mtime
            except OSError:
                continue
            if stamp == last and not took_over:
                continue
            pushed_at = time.monotonic()
            if not opened:
                status = 'standby'
                if status != last_status:
                    cloud.run_log({'event': 'push_status', 'window': window['id'], 'status': status})
                    last_status = status
                continue
            status = push(window['id'])
            if status in (200, 409):
                last = stamp
            if status != last_status:  # log only changes, not every 10 s push
                cloud.run_log({'event': 'push_status', 'window': window['id'], 'status': status})
                last_status = status

    threading.Thread(target=pusher, daemon=True).start()
    attempt, finished = 0, False
    while cloud.now() < at(window['close']):
        if hold and hold():
            time.sleep(max(0.1, min(10, (at(window['close']) - cloud.now()).total_seconds())))
            continue
        code = cloud.record(window)
        cloud.run_log({'event': 'record_exit', 'window': window['id'], 'code': code, 'attempt': attempt + 1})
        if code == 0:
            finished = True
            break
        if code in (20, 21):
            print('F1 login failed; check the F1_USERNAME / F1_PASSWORD secrets.')
            LAST_RESULT[window['id']] = 'login_failed'
            break
        delay = cloud.RETRY_DELAYS[min(attempt, len(cloud.RETRY_DELAYS) - 1)]
        attempt += 1
        time.sleep(delay)
    stop.set()
    if finished or LAST_RESULT.get(window['id']) != 'login_failed':
        LAST_RESULT[window['id']] = 'finished' if finished else 'closed'
    if gate and not gate():
        final = 'standby'  # the baton holder publishes and marks the session done
    else:
        final = push(window['id'], final=finished, flush=True)  # the last push must be saved
    print('Final push:', final, 'finished' if finished else 'window closed')
    cloud.run_log({'event': 'job_end', 'window': window['id'], 'finished': finished,
                   'attempts': attempt + (1 if finished else 0), 'final_push': final})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
