"""Always-on F1 collector for a home computer (F1 blocks datacenter networks).

Runs forever: every CHECK_SECONDS it refreshes the FastF1 schedule (hourly), records a
session whose window is open or opens within LOOKAHEAD_MINUTES, and otherwise publishes
FastF1 post-session data for the latest finished session. Uploads are signed with this
host's key (host_auth.py).

Several computers can run this at once (Windows, macOS or Linux). During a session each
one records and sends a heartbeat every BEAT_SECONDS; the site hands the "baton" to the
highest-priority computer that is receiving F1 data, and only that one publishes. If it
goes quiet, the next one takes over; when it comes back it takes the baton back. The
owner sets the order in Account settings on the site. A new computer registers itself
and waits there for approval.

Environment: F1_USERNAME, F1_PASSWORD, HOST_NAME, DATA_DIR, optional HOST_KEY_FILE,
LOOKAHEAD_MINUTES (default 45), SITE_URL.
"""
import os
import platform
import subprocess
import sys
import threading
import time
import traceback
from datetime import datetime, timedelta, timezone

import actions_runner as runner
import cloud
import host_jobs

CHECK_SECONDS = int(os.environ.get('CHECK_SECONDS', '60'))
HISTORY_RETRY_SECONDS = host_jobs.HISTORY_RETRY_SECONDS
BEAT_SECONDS = int(os.environ.get('BEAT_SECONDS', '5'))
IDLE_BEAT_SECONDS = int(os.environ.get('IDLE_BEAT_SECONDS', '60'))  # also how fast an update request is seen
STARTED_AT = datetime.now(timezone.utc).isoformat(timespec='seconds')
COLLECTOR_VERSION = '2026.11.05'
# Exit while idle after this long so the launcher can pull new code and restart.
RESTART_AFTER_SECONDS = int(os.environ.get('RESTART_AFTER_SECONDS', str(6 * 3600)))
# After a failed F1 login, wait this long before trying the same session again.
LOGIN_RETRY_SECONDS = int(os.environ.get('LOGIN_RETRY_SECONDS', '600'))


# Windows SetThreadExecutionState flags: keep the system (not the display) awake.
ES_CONTINUOUS, ES_SYSTEM_REQUIRED, ES_AWAYMODE_REQUIRED = 0x80000000, 0x00000001, 0x00000040


class keep_awake:
    """Block idle sleep from 45 minutes before a session until it ends (also on battery).

    Windows: SetThreadExecutionState. macOS: caffeinate (on battery a Mac may still sleep
    when the lid is closed; that is Apple's rule). Closing a laptop lid or pressing the
    power button otherwise follows the system settings."""
    last = None  # log only when the state changes

    def __enter__(self):
        self.active, self.process = False, None
        if sys.platform == 'win32':
            try:
                import ctypes
                self.active = bool(ctypes.windll.kernel32.SetThreadExecutionState(
                    ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED))
            except (AttributeError, OSError):
                pass
        elif sys.platform == 'darwin':
            try:  # -i: no idle sleep, -s: no system sleep on AC; ends with this process
                self.process = subprocess.Popen(['caffeinate', '-i', '-s', '-w', str(os.getpid())],
                                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                self.active = True
            except OSError:
                pass
        if keep_awake.last != self.active:
            cloud.run_log({'event': 'keep_awake', 'on': self.active})
            keep_awake.last = self.active
        return self

    def __exit__(self, *exc):
        if self.process:
            self.process.terminate()
        elif self.active:
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
        return False


def os_label():
    if sys.platform == 'darwin':
        return ('macOS ' + platform.mac_ver()[0]).strip()
    if sys.platform == 'win32':
        return 'Windows ' + platform.release()
    return platform.system() + ' ' + platform.release()


def snapshot_ready(window, now=None):
    """True when this computer's F1 recorder is receiving data for this window."""
    return host_jobs.JOBS['f1'].ready(window, now)


class Baton:
    """Heartbeat during a session window; tells the recorder whether to publish."""

    def __init__(self, window, job=None):
        self.job = job or host_jobs.JOBS['f1']
        self.window, self.active, self.holder, self.cold = window, None, None, False
        self.warm = True  # the site says whether this host should be on F1 now (top two record)
        self.blocked = False  # not approved (or removed) on the site: never connect to F1
        self.legacy = False  # the site predates heartbeats: publish as before
        self.stop = threading.Event()
        self.thread = None

    def beat(self):
        payload = {'series': self.job.series, 'window': self.window['id'], 'ready': bool(self.job.ready(self.window)), 'recording': True,
                   'os': os_label(), 'version': COLLECTOR_VERSION, 'started_at': STARTED_AT}
        status, data = runner.host_call('/api/live/host-beat', payload)
        if status in (404, 405):
            self.legacy = True
        elif status == 200 and data:
            self.legacy, self.blocked = False, False
            self.cold = bool(data.get('cold'))
            self.warm = bool(data.get('warm', True))
            self.update(bool(data.get('active')), data.get('holder'), data.get('enabled', True))
        elif status == 401:
            self.blocked = True
            self.update(False, None, False)
        return status

    def update(self, active, holder, enabled=True):
        if (active, holder) != (self.active, self.holder):
            cloud.run_log({'event': 'baton', 'series': self.job.series, 'window': self.window['id'], 'active': active, 'holder': holder, 'enabled': enabled})
            print(self.job.label + ': ' + ('publishing this session.' if active else 'standing by (recording; %s publishes).' % (holder or 'no host')))
        self.active, self.holder = active, holder

    def gate(self):
        # Unknown (site unreachable before the first answer): publish; the site refuses
        # a push from a host that is not the baton holder anyway.
        return self.legacy or self.active is not False

    def hold(self):
        """Stay off F1 while this host is neither publishing nor one of the recording spares
        (or is not registered yet). It joins within seconds once the site needs it."""
        return (self.blocked or not self.warm) and not self.legacy and self.active is not True

    def __enter__(self):
        self.beat()

        def loop():
            while not self.stop.wait(BEAT_SECONDS):
                try:
                    self.beat()
                except Exception as exc:  # never let the heartbeat kill recording
                    cloud.run_log({'event': 'beat_error', 'error': type(exc).__name__})
        self.thread = threading.Thread(target=loop, daemon=True)
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.stop.set()
        return False


def lookahead():
    return timedelta(minutes=int(os.environ.get('LOOKAHEAD_MINUTES', '45')))


def recently_tried(window_id, now=None):
    return host_jobs.recently_tried(window_id, now)


def home_dir():
    """Where setup puts host.env, the key and data on each OS."""
    if sys.platform == 'win32' and os.environ.get('LOCALAPPDATA'):
        return os.path.join(os.environ['LOCALAPPDATA'], 'Kongboda')
    if sys.platform == 'darwin':
        return os.path.expanduser('~/Library/Application Support/Kongboda')
    return os.path.join(os.environ.get('XDG_CONFIG_HOME') or os.path.expanduser('~/.config'), 'kongboda')


def default_env_file():
    return os.path.join(home_dir(), 'host.env')


def load_env_file(path=None):
    """Fill missing settings from host.env (KEY=VALUE lines) so any launcher works."""
    path = path or os.environ.get('HOST_ENV_FILE') or default_env_file()
    try:
        with open(path, encoding='utf-8-sig') as handle:
            lines = handle.read().splitlines()
    except OSError:
        ensure_certificates()
        return False
    for line in lines:
        name, sep, value = line.partition('=')
        if sep and name.strip() and not name.lstrip().startswith('#') and not os.environ.get(name.strip()):
            os.environ[name.strip()] = value
    ensure_certificates()
    return True


def ensure_certificates():
    """Python from python.org on macOS ships without root certificates; use certifi's."""
    if sys.platform == 'darwin' and not os.environ.get('SSL_CERT_FILE'):
        try:
            import certifi
            os.environ['SSL_CERT_FILE'] = certifi.where()
        except ImportError:
            pass


def check_setup():
    missing = [name for name in ('F1_USERNAME', 'F1_PASSWORD', 'HOST_NAME') if not os.environ.get(name)]
    import host_auth
    if not host_auth.key_path().exists():
        missing.append('host key (' + str(host_auth.key_path()) + ')')
    return missing


def skipped(state, window_id):
    """Windows this host must not enter now: already recorded, or a login retry pause."""
    if window_id in state.setdefault('done', set()):
        return True
    return time.monotonic() < state.setdefault('retry_at', {}).get(window_id, 0)


def idle_beat(state):
    """Every few minutes outside sessions: show this host as online. Returns is_lead and
    remembers which series the owner assigned to this computer."""
    if time.monotonic() - state.get('idle_beat_at', -IDLE_BEAT_SECONDS) >= IDLE_BEAT_SECONDS:
        state['idle_beat_at'] = time.monotonic()
        status, data = runner.host_call('/api/live/host-beat', {'window': None, 'os': os_label(), 'version': COLLECTOR_VERSION,
                                                                'started_at': STARTED_AT, 'jobs_available': sorted(host_jobs.JOBS)})
        # Older site or no answer: behave as before (any host may publish post-session data).
        state['is_lead'] = bool(data.get('is_lead')) if status == 200 and data else status not in (401,)
        if status == 200 and data and isinstance(data.get('jobs'), list):
            state['assigned'] = [j for j in data['jobs'] if isinstance(j, str)]
        if status == 200 and data:
            state['update_at'] = data.get('update_at')
    return state.get('is_lead', True)


def update_requested(state):
    """The owner pressed "update now" after this collector started."""
    return bool(state.get('update_at')) and str(state['update_at']) > STARTED_AT


def assigned_jobs(state):
    """Jobs to run here: what the owner switched on for this computer (default F1)."""
    names = state.get('assigned') or [j.strip() for j in os.environ.get('HOST_JOBS', 'f1').split(',') if j.strip()]
    return [host_jobs.JOBS[n] for n in names if n in host_jobs.JOBS]


def run_window(job, window, job_state):
    """One session window of one job, in its own thread."""
    try:
        with keep_awake(), Baton(window, job) as baton:
            result = job.record(window, baton.gate, baton.hold)
    except Exception as exc:  # a failed job must not stop the host
        cloud.run_log({'event': 'job_error', 'series': job.series, 'window': window['id'], 'error': type(exc).__name__})
        result = 'error'
        job_state['retry_at'][window['id']] = time.monotonic() + LOGIN_RETRY_SECONDS
    if result in ('finished', 'already_done'):
        job_state['done'].add(window['id'])
    elif result == 'login_failed':
        job_state['retry_at'][window['id']] = time.monotonic() + LOGIN_RETRY_SECONDS


def update_active_marker(state):
    """data/active-window.json exists while any job records, so code updates wait."""
    running = [k for job_state in state.get('jobs', {}).values() for k, t in job_state.get('running', {}).items() if t.is_alive()]
    marker = cloud.DATA / 'active-window.json'
    if running:
        cloud.atomic_json(marker, {'windows': running, 'at': cloud.now().isoformat()})
    else:
        marker.unlink(missing_ok=True)
    return running


def cycle(state, wait=False):
    """Start a recording thread for each job whose window is open (or opens soon); when a
    job has no window coming, the lead host publishes its post-session data. wait=True
    joins the threads (tests and one-shot runs)."""
    started = []
    for job in assigned_jobs(state):
        job_state = state.setdefault('jobs', {}).setdefault(job.series, {'done': set(), 'retry_at': {}, 'running': {}})
        running = job_state['running']
        for key in [k for k, t in running.items() if not t.is_alive()]:
            del running[key]
        try:
            windows = job.windows(job_state)
        except Exception as exc:
            cloud.run_log({'event': 'schedule_error', 'series': job.series, 'error': type(exc).__name__})
            continue
        live = [w for w in windows if not skipped(job_state, w['id'])]
        window = runner.next_window(live, cloud.now(), lookahead())
        if window:
            if window['id'] not in running:
                thread = threading.Thread(target=run_window, args=(job, window, job_state), daemon=True,
                                          name='%s-%s' % (job.series, window['id']))
                running[window['id']] = thread
                thread.start()
                started.append(thread)
            continue
        if running or any(runner.next_window([w], cloud.now(), lookahead()) for w in windows):
            continue  # a recorded session's window is still open; post-session data comes later
        if idle_beat(state):
            job.post_session(windows)
    idle_beat(state)  # cheap: at most once a minute; carries job assignments and update requests
    update_active_marker(state)
    if wait:
        for thread in started:
            thread.join()
        update_active_marker(state)
    return started


LAST_REGISTRATION = {}


def register(state=None):
    """Make sure the site knows this host. A new one asks to be added; its installer then
    links it to their Kongboda account (link_url), which registers it."""
    import host_auth
    status, data = runner.host_call('/api/live/host-beat', {'window': None, 'os': os_label(), 'version': COLLECTOR_VERSION})
    if status == 401 and data and data.get('reason') == 'unknown_host':
        key = host_auth.public_key(host_auth.load_key())
        status, data = runner.host_call('/api/live/host-register', {'name': os.environ['HOST_NAME'], 'key': key, 'os': os_label()})
        data = data or {}
        if status == 409:
            state_name = 'name_taken'
        elif data.get('status') == 'pending':
            state_name = 'pending' if data.get('linked') else 'needs_link'
        elif data.get('status') == 'approved':
            state_name = 'approved' if data.get('enabled', True) else 'paused'
        else:
            state_name = 'error'
    elif status == 200:
        state_name = 'approved' if (data or {}).get('enabled', True) else 'paused'
    elif status in (404, 405):
        state_name = 'legacy_site'
    else:
        state_name = 'unreachable' if status is None else 'error'
    LAST_REGISTRATION.clear()
    LAST_REGISTRATION.update({'state': state_name, 'link_url': (data or {}).get('link_url', '')})
    cloud.run_log({'event': 'host_register', 'status': status, 'state': state_name})
    messages = {'needs_link': '이 컴퓨터를 내 꽁보다 계정에 연결해 주세요: ' + LAST_REGISTRATION['link_url'],
                'pending': '꽁보다 계정 연결 완료. 세션 시간이 되면 자동으로 수집합니다.',
                'name_taken': '같은 이름의 다른 컴퓨터가 이미 있습니다. 정민이한테 알려 주세요.',
                'paused': '이 컴퓨터는 사이트에서 일시정지돼 있습니다.'}
    if state_name in messages:
        print(messages[state_name])
    return state_name


def main():
    load_env_file()
    if os.environ.get('DATA_DIR'):
        cloud.DATA = cloud.Path(os.environ['DATA_DIR'])
    runner.SITE = os.environ.get('SITE_URL', runner.SITE).rstrip('/')
    missing = check_setup()
    if missing:
        print('Collector host is not set up; missing: ' + ', '.join(missing))
        return 2
    cloud.DATA.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault('XDG_DATA_HOME', str(cloud.DATA / 'auth'))
    if os.environ.get('PROBE') == '1':
        import probe
        return probe.main()
    print('Kongboda collector host', os.environ['HOST_NAME'], os_label(), COLLECTOR_VERSION)
    # Signed request with a dummy window: 200 means this host's key is registered and accepted.
    status, _ = runner.site('GET', '2000-1-1')
    cloud.run_log({'event': 'host_start', 'host': os.environ['HOST_NAME'], 'os': os_label(), 'version': COLLECTOR_VERSION,
                   'upload_auth': status})
    register()
    state, started = {}, time.monotonic()
    while True:
        if not update_active_marker(state):
            if update_requested(state):
                cloud.run_log({'event': 'update_restart', 'requested': state['update_at']})
                print('Update requested from the site: restarting to pull the new code.')
                return 0  # the launcher downloads the new code, then starts it again
            if time.monotonic() - started > RESTART_AFTER_SECONDS:
                return 0  # idle restart (never while a job is recording) to pick up new code
        try:
            cycle(state)
        except KeyboardInterrupt:
            return 0
        except Exception as exc:  # keep running; the next cycle retries
            cloud.run_log({'event': 'host_cycle_error', 'error': type(exc).__name__})
            traceback.print_exc()
        time.sleep(CHECK_SECONDS)


if __name__ == '__main__':
    sys.exit(main())
