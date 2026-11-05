"""Power saving for a cloud collector host (AWS EC2): run only around sessions.

Switched on with POWER_SAVE=aws in host.env (setup-linux.sh --power-save). The host
then turns itself off when nothing is left to do and books its own next start:

  * Wake: an Amazon EventBridge Scheduler one-time schedule ("kongboda-wake-<host>")
    starts this instance WAKE_MARGIN before the recorder must connect (the window opens
    5 min before the session; the recorder connects LOOKAHEAD_MINUTES before that). The
    same schedule also wakes it every CHECK_IN_HOURS at most, so a changed calendar or a
    post-session upload that was not ready yet is picked up while it sleeps.
  * Sleep: right after a session is recorded to its end, unless another recording starts
    within MIN_SLEEP. FastF1 post-session data is published once the session window
    closes (as before), so the host books a wake for that moment, stays on until the
    data is on the site (or HISTORY_GRACE has passed; the next check-in retries) and
    sleeps again. It also stays on for MIN_UPTIME after starting and only sleeps once
    the wake schedule is saved. If AWS refuses the schedule the host
    stays on: an idle server costs a little, a server that never wakes misses a session.

Needs the instance role made by host/aws-power-setup.sh (EventBridge Scheduler create/
update on kongboda-wake-* only, and passing the scheduler role, which may only start
this instance). Uses boto3 with the instance role; no keys on disk.
"""
import json
import os
import subprocess
import time
import urllib.request
from datetime import datetime, timedelta, timezone

import cloud

WAKE_MARGIN = timedelta(minutes=int(os.environ.get('POWER_WAKE_MARGIN_MINUTES', '20')))
MIN_SLEEP = timedelta(minutes=int(os.environ.get('POWER_MIN_SLEEP_MINUTES', '40')))
MIN_UPTIME = timedelta(minutes=int(os.environ.get('POWER_MIN_UPTIME_MINUTES', '10')))
CHECK_IN = timedelta(hours=float(os.environ.get('POWER_CHECK_IN_HOURS', '12')))
HISTORY_GRACE = timedelta(hours=float(os.environ.get('POWER_HISTORY_GRACE_HOURS', '3')))
HISTORY_WAKE_DELAY = timedelta(minutes=5)
SCHEDULE_GROUP = 'default'
SCHEDULER_ROLE = os.environ.get('POWER_SCHEDULER_ROLE', 'kongboda-scheduler')
BOOT = time.monotonic()
LAST = {'decision': None, 'reason': None}


def enabled():
    return os.environ.get('POWER_SAVE', '').strip().lower() == 'aws'


def at(value):
    return datetime.fromisoformat(value) if isinstance(value, str) else value


def record_starts(window, lookahead):
    """When the recorder connects for this window (it starts LOOKAHEAD before open)."""
    return at(window['open']) - lookahead


def live(windows):
    """Windows still to record: a session recorded to its end (ended) needs no server."""
    return [w for w in windows if not w.get('ended')]


def next_record_start(windows, now, lookahead):
    future = [record_starts(w, lookahead) for w in live(windows) if at(w['close']) > now]
    future = [s for s in future if s > now]
    return min(future) if future else None


def recording_due(windows, now, lookahead):
    """A window is open now or its recorder connects within MIN_SLEEP + WAKE_MARGIN."""
    return any(at(w['close']) > now and record_starts(w, lookahead) - (MIN_SLEEP + WAKE_MARGIN) <= now
               for w in live(windows))


def publishes_after(window):
    return window.get('series', 'f1') == 'f1'  # only F1 publishes FastF1 data after a session


def history_pending(windows, now, is_done):
    """A session window closed within HISTORY_GRACE and its FastF1 data is not on the site.
    (The host publishes it once the window has closed, as it always did.)"""
    return [w for w in windows if publishes_after(w) and at(w['close']) <= now < at(w['close']) + HISTORY_GRACE
            and not is_done(w['id'])]


def history_wakes(windows, now):
    """A recorded session that ended before its window closes: come back at the close to
    publish its FastF1 data, instead of staying on until then."""
    return [at(w['close']) + HISTORY_WAKE_DELAY for w in windows
            if publishes_after(w) and w.get('ended') and at(w['close']) > now]


def decide(now, windows, lookahead, *, recording, is_lead, is_done, uptime):
    """('stay', reason) or ('sleep', wake_at). Pure: tests drive it with fake clocks."""
    if recording:
        return 'stay', 'recording'
    if recording_due(windows, now, lookahead):
        return 'stay', 'session_soon'
    if is_lead and history_pending(windows, now, is_done):
        return 'stay', 'post_session_upload'
    if uptime < MIN_UPTIME:
        return 'stay', 'just_started'
    wakes = [now + CHECK_IN] + (history_wakes(windows, now) if is_lead else [])
    start = next_record_start(windows, now, lookahead)
    if start is not None:
        wakes.append(start - WAKE_MARGIN)
    wake = min(wakes)
    if wake - now < MIN_SLEEP:
        return 'stay', 'wake_too_soon'
    return 'sleep', wake.replace(second=0, microsecond=0)


# --- AWS -------------------------------------------------------------------------------

def imds(path, token=None):
    """EC2 instance metadata (IMDSv2)."""
    if token is None:
        request = urllib.request.Request('http://169.254.169.254/latest/api/token', method='PUT',
                                         headers={'X-aws-ec2-metadata-token-ttl-seconds': '300'})
        with urllib.request.urlopen(request, timeout=3) as response:
            token = response.read().decode()
    request = urllib.request.Request('http://169.254.169.254/latest/' + path, headers={'X-aws-ec2-metadata-token': token})
    with urllib.request.urlopen(request, timeout=3) as response:
        return response.read().decode(), token


def instance():
    doc, _ = imds('dynamic/instance-identity/document')
    doc = json.loads(doc)
    return {'id': doc['instanceId'], 'region': doc['region'], 'account': doc['accountId']}


def schedule_request(name, wake_at, inst, role=SCHEDULER_ROLE):
    """EventBridge Scheduler request that starts this instance once at wake_at (UTC)."""
    return {'Name': name, 'GroupName': SCHEDULE_GROUP,
            'ScheduleExpression': 'at(%s)' % wake_at.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S'),
            'ScheduleExpressionTimezone': 'UTC', 'FlexibleTimeWindow': {'Mode': 'OFF'}, 'State': 'ENABLED',
            'ActionAfterCompletion': 'NONE',
            'Description': 'Kongboda collector: start before the next F1 session (set by the host itself)',
            'Target': {'Arn': 'arn:aws:scheduler:::aws-sdk:ec2:startInstances',
                       'RoleArn': 'arn:aws:iam::%s:role/%s' % (inst['account'], role),
                       'Input': json.dumps({'InstanceIds': [inst['id']]}),
                       'RetryPolicy': {'MaximumEventAgeInSeconds': 3600, 'MaximumRetryAttempts': 10}}}


def book_wake(wake_at, client=None, inst=None):
    """Create or move this host's wake schedule. Returns True when AWS saved it."""
    inst = inst or instance()
    if client is None:
        import boto3
        client = boto3.client('scheduler', region_name=inst['region'])
    name = 'kongboda-wake-' + os.environ.get('HOST_NAME', 'host')
    request = schedule_request(name, wake_at, inst)
    try:
        client.update_schedule(**request)
    except client.exceptions.ResourceNotFoundException:
        client.create_schedule(**request)
    saved = client.get_schedule(Name=name, GroupName=SCHEDULE_GROUP)
    return saved.get('ScheduleExpression') == request['ScheduleExpression'] and saved.get('State') == 'ENABLED'


def power_off():
    command = ['systemctl', 'poweroff'] if os.geteuid() == 0 else ['sudo', '-n', 'systemctl', 'poweroff']
    subprocess.run(command, check=False, timeout=60)


def tick(windows, lookahead, *, recording, is_lead, is_done, now=None, book=book_wake, off=power_off):
    """Called once per host cycle. Turns the server off when decide() says so."""
    if not enabled():
        return None
    now = now or cloud.now()
    decision, detail = decide(now, windows, lookahead, recording=recording, is_lead=is_lead, is_done=is_done,
                              uptime=timedelta(seconds=time.monotonic() - BOOT))
    if decision == 'stay':
        if (decision, detail) != (LAST['decision'], LAST['reason']):
            cloud.run_log({'event': 'power_stay', 'reason': detail})
        LAST.update(decision=decision, reason=detail)
        return decision, detail
    try:
        booked = book(detail)
    except Exception as exc:  # no permission, no network, no boto3: stay on
        cloud.run_log({'event': 'power_wake_failed', 'error': type(exc).__name__, 'detail': str(exc)[:200]})
        LAST.update(decision='stay', reason='wake_not_booked')
        return 'stay', 'wake_not_booked'
    if not booked:
        cloud.run_log({'event': 'power_wake_failed', 'error': 'not_saved'})
        LAST.update(decision='stay', reason='wake_not_booked')
        return 'stay', 'wake_not_booked'
    cloud.run_log({'event': 'power_sleep', 'wake_at': detail.isoformat()})
    print('Nothing to collect until %s UTC: turning this server off.' % detail.strftime('%Y-%m-%d %H:%M'), flush=True)
    off()
    LAST.update(decision='sleep', reason=detail.isoformat())
    return 'sleep', detail
