"""Record a WEC session from the FIAWEC+ live-timing page inside a scheduled GitHub Actions job.

Like the F1 actions_runner, but no AWS or home host: a headless browser signs in with the
operator's FIAWEC+ account, opens the live session's timing page and reads the timing table
every few seconds. Changed tables are pushed to the site (GitHub OIDC). Session windows come
from the site's official session schedule; a window is marked done once it closes, so later
scheduled runs skip it. A run that hits its time budget leaves the window open for the next run.
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from wec_browser import DiscoveryError, FIAWECBrowser, discover, owner_credentials, utcnow

SITE = os.environ.get('SITE_URL', 'https://kongboda-motorsports.vercel.app').rstrip('/')
AUDIENCE = 'kongboda-motorsports'
BEFORE = timedelta(minutes=10)   # open the page before the published start
AFTER = timedelta(minutes=15)    # keep reading after the published end (chequered flag, final lap)
LOOKAHEAD = timedelta(minutes=int(os.environ.get('LOOKAHEAD_MINUTES', '40')))
BUDGET = timedelta(minutes=int(os.environ.get('JOB_BUDGET_MINUTES', '330')))
READ_SECONDS = int(os.environ.get('WEC_READ_SECONDS', '5'))
PUSH_SECONDS = int(os.environ.get('WEC_PUSH_SECONDS', '10'))
RETRY_SECONDS = (30, 60, 120, 300)
# Login, CAPTCHA and subscription problems need the owner; retrying only risks a lock-out.
STOP = {'credentials_required', 'authentication_failed', 'authentication_action_required',
        'human_verification_required', 'subscription_or_login_required'}


def now():
    return datetime.now(timezone.utc)


def at(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def windows_from_calendar(calendar, year=None):
    """WEC session windows from /api/race-calendar. Back-to-back sessions (the
    qualifying/hyperpole block) merge into one window, so one page stays open."""
    found = []
    for event in calendar.get('events', []):
        if event.get('series') != 'wec':
            continue
        for session in event.get('sessions') or []:
            try:
                start = at(session['start'])
                end = at(session['end']) if session.get('end') else start + timedelta(hours=2)
            except (KeyError, TypeError, ValueError):
                continue
            if year and start.year != year:
                continue
            found.append({'event_id': event['id'], 'event': event.get('nameEn') or event.get('name') or '',
                          'names': [session.get('nameEn') or session.get('name') or ''],
                          'open': start - BEFORE, 'close': end + AFTER, 'start': start})
    found.sort(key=lambda w: w['open'])
    merged = []
    for w in found:
        last = merged[-1] if merged else None
        if last and last['event_id'] == w['event_id'] and w['open'] <= last['close']:
            last['close'] = max(last['close'], w['close'])
            last['names'] += w['names']
        else:
            merged.append(w)
    for w in merged:
        w['id'] = '%s-%s' % (w['event_id'], w['start'].astimezone(timezone.utc).strftime('%m%d%H%M'))
        w['session'] = target_session(w['names'])
    return merged


def target_session(names):
    """The FIAWEC+ session filter: exact for one practice/race, auto for merged blocks."""
    if len(names) == 1:
        for value in ('FP1', 'FP2', 'FP3', 'Race'):
            if re.search(r'\b%s\b' % value, names[0], re.I):
                return value
    return 'auto'


def event_fragment(name):
    """'6 Hours of Monza' -> 'Monza'; FIAWEC+ race slugs use the circuit name."""
    words = re.sub(r'^\s*\d+\s*hours?\s+of\s+', '', name, flags=re.I).strip()
    return words[:100] or name[:100]


def next_window(windows, current):
    return next((w for w in windows if current < w['close'] and w['open'] - LOOKAHEAD <= current), None)


def oidc_token():
    url = os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'] + '&audience=' + AUDIENCE
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)['value']


def site(method, window_id, body=None, final=False):
    query = {'window': window_id, **({'final': '1'} if final else {})}
    url = SITE + '/api/wec/actions-push?' + urllib.parse.urlencode(query)
    data = json.dumps(body).encode() if body is not None else None
    try:
        request = urllib.request.Request(url, data=data, method=method, headers={
            'authorization': 'Bearer ' + oidc_token(), 'content-type': 'application/json'})
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None
    except (OSError, ValueError, KeyError):
        return None, None


def fetch_calendar():
    request = urllib.request.Request(SITE + '/api/race-calendar', headers={'accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def snapshot(window, result, rows, changed_at, state=None):
    return {'schema_version': 1, 'producer': 'fiawec-actions', 'window': window['id'],
            'event': window['event'], 'sessions': window['names'][:8], 'target': result.get('target'),
            'state': state or result.get('state'), 'session': result.get('session'),
            'race_url': result.get('race_url'), 'session_url': result.get('session_url'),
            'timing_url': result.get('timing_url'), 'timing_origin': result.get('timing_origin'),
            'checked_at': utcnow(), 'rows_changed_at': changed_at, 'records': rows[:100],
            'window_open': window['open'].isoformat(), 'window_close': window['close'].isoformat()}


def watch(driver, window, deadline, push=site, clock=now, sleep=time.sleep):
    """Find the session, keep its timing page open and push the table whenever it changes."""
    target = {'event': event_fragment(window['event']), 'session': window['session'], 'year': window['start'].year}
    result = discover(driver, target, upcoming=window['session'] != 'auto')
    if result['state'] == 'waiting_for_session':
        push('POST', window['id'], snapshot(window, result, [], None))
        return 'waiting_for_session'
    rows, last_rows, changed_at, pushed = result['records'], None, None, 0.0
    while clock() < min(window['close'], deadline):
        if rows and rows != last_rows:
            changed_at = utcnow() if last_rows is not None else changed_at
            last_rows = rows
        if time.monotonic() - pushed >= PUSH_SECONDS:
            state = 'reading' if rows else 'timing_waiting_start' if driver.waiting_for_start() else 'timing_layout_unverified'
            push('POST', window['id'], snapshot(window, result, rows, changed_at, state))
            pushed = time.monotonic()
        sleep(READ_SECONDS)
        rows = driver.read_rows()
    return 'closed'


def record(window, launch=None, push=site, clock=now, sleep=time.sleep):
    deadline = clock() + BUDGET
    attempt = 0
    while clock() < min(window['close'], deadline):
        try:
            outcome = run_browser(window, deadline, launch, push, clock, sleep)
        except DiscoveryError as error:
            outcome, detail = error.code, error.detail
        else:
            detail = None
        print('WEC', window['id'], outcome, detail or '', flush=True)
        if outcome in STOP:
            push('POST', window['id'], {'schema_version': 1, 'producer': 'fiawec-actions', 'window': window['id'],
                                        'event': window['event'], 'state': outcome, 'diagnostic': detail,
                                        'checked_at': utcnow(), 'records': []})
            return outcome
        if outcome == 'closed':
            break
        sleep(RETRY_SECONDS[min(attempt, len(RETRY_SECONDS) - 1)])
        attempt += 1
    if clock() >= window['close']:
        push('POST', window['id'], {'schema_version': 1, 'producer': 'fiawec-actions', 'window': window['id'],
                                    'event': window['event'], 'state': 'session_window_closed',
                                    'checked_at': utcnow(), 'records': []}, final=True)
        return 'finished'
    return 'budget_reached'  # the next scheduled run continues this window


def run_browser(window, deadline, launch, push, clock, sleep):
    if launch:
        return watch(launch(), window, deadline, push, clock, sleep)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        driver = FIAWECBrowser(browser)
        try:
            return watch(driver, window, deadline, push, clock, sleep)
        finally:
            driver.close()
            browser.close()


def main():
    if not all(owner_credentials()):
        print('WEC_USERNAME / WEC_PASSWORD repository secrets are missing; nothing recorded.')
        return 0
    window = next_window(windows_from_calendar(fetch_calendar()), now())
    if not window:
        print('No WEC session window now.')
        return 0
    status, data = site('GET', window['id'])
    if status == 200 and data and data.get('done'):
        print('WEC window already recorded:', window['id'])
        return 0
    print('WEC window', window['id'], window['names'], 'opens', window['open'].isoformat(), flush=True)
    while now() < window['open']:
        time.sleep(min(30, max(1, (window['open'] - now()).total_seconds())))
    print('Result:', record(window))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
