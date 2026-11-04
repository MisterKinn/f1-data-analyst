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
PUSH_INTERVAL = 10


def at(value):
    return datetime.fromisoformat(value)


def next_window(windows, now, lookahead=LOOKAHEAD):
    """The window that is open now or opens within the lookahead, earliest first."""
    return next((w for w in windows if now < at(w['close']) and at(w['open']) - lookahead <= now), None)


def oidc_token():
    url = os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'] + '&audience=' + AUDIENCE
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)['value']


def site(method, window_id, body=None, final=False):
    query = {'window': window_id, **({'final': '1'} if final else {})}
    request = urllib.request.Request(SITE + '/api/live/actions-push?' + urllib.parse.urlencode(query), data=body, method=method,
                                     headers={'authorization': 'Bearer ' + oidc_token(), 'content-type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None
    except (OSError, ValueError):
        return None, None


def push(window_id, final=False):
    path = cloud.DATA / 'snapshot.json'
    try:
        body = path.read_bytes()
    except OSError:
        return None
    return site('POST', window_id, body, final)[0]


def main():
    if not os.environ.get('F1_USERNAME') or not os.environ.get('F1_PASSWORD'):
        print('F1_USERNAME / F1_PASSWORD repository secrets are missing; nothing recorded.')
        return 0
    cloud.DATA.mkdir(parents=True, exist_ok=True)
    cloud.fetch_schedule()
    windows = cloud.read_json(cloud.DATA / 'schedule.json', {}).get('windows', [])
    window = next_window(windows, cloud.now())
    if not window:
        print('No F1 session window now.')
        return 0
    status, data = site('GET', window['id'])
    if status == 200 and data and data.get('done'):
        print('Session already recorded:', window['event'], window['name'])
        return 0
    print('Session:', window['event'], window['name'], 'start', window['start'])
    while cloud.now() < at(window['open']):
        time.sleep(min(30, max(1, (at(window['open']) - cloud.now()).total_seconds())))

    stop = threading.Event()

    def pusher():
        last = None
        while not stop.wait(PUSH_INTERVAL):
            try:
                stamp = (cloud.DATA / 'snapshot.json').stat().st_mtime
            except OSError:
                continue
            if stamp != last and push(window['id']) in (200, 409):
                last = stamp

    threading.Thread(target=pusher, daemon=True).start()
    attempt, finished = 0, False
    while cloud.now() < at(window['close']):
        code = cloud.record(window)
        if code == 0:
            finished = True
            break
        if code in (20, 21):
            print('F1 login failed; check the F1_USERNAME / F1_PASSWORD secrets.')
            break
        delay = cloud.RETRY_DELAYS[min(attempt, len(cloud.RETRY_DELAYS) - 1)]
        attempt += 1
        time.sleep(delay)
    stop.set()
    print('Final push:', push(window['id'], final=finished), 'finished' if finished else 'window closed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
