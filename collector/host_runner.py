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
import power

CHECK_SECONDS = int(os.environ.get('CHECK_SECONDS', '60'))
HISTORY_RETRY_SECONDS = host_jobs.HISTORY_RETRY_SECONDS
BEAT_SECONDS = int(os.environ.get('BEAT_SECONDS', '5'))
IDLE_BEAT_SECONDS = int(os.environ.get('IDLE_BEAT_SECONDS', '60'))  # also how fast an update request is seen
STARTED_AT = datetime.now(timezone.utc).isoformat(timespec='seconds')
COLLECTOR_VERSION = '2026.11.06.1'
# Exit while idle after this long so the launcher can pull new code and restart.
RESTART_AFTER_SECONDS = int(os.environ.get('RESTART_AFTER_SECONDS', str(6 * 3600)))
# After a failed F1 login, wait this long before trying the same session again.
LOGIN_RETRY_SECONDS = int(os.environ.get('LOGIN_RETRY_SECONDS', '600'))
# Shared F1 login: the owner's computer (built-in host with the F1 account) sends its F1
# login token with its heartbeat; other hosts receive it with theirs. Only the token
# travels, never the password, and it expires on its own after a few days.
TOKEN_RENEW_LEFT = int(os.environ.get('TOKEN_RENEW_LEFT', str(36 * 3600)))  # owner renews below this
TOKEN_WANT_LEFT = int(os.environ.get('TOKEN_WANT_LEFT', str(24 * 3600)))    # others ask below this
TOKEN_SHARE_EVERY = 600  # the owner re-reads its token at most this often (seconds)
# F1 refuses some networks (cloud servers) before sign-in with a CloudFront 403. Each host
# checks its own network now and then and tells the site, which then uses it only when no
# other host is left (FastF1 issue #988). No token is sent: 401 = reachable, 403 = refused.
ACCESS_CHECK_SECONDS = int(os.environ.get('ACCESS_CHECK_SECONDS', str(3 * 3600)))
F1_ACCESS = {'blocked': None, 'at': None}


def check_f1_access(force=False, fetch=None):
    """Returns True when F1 refuses this network, False when it answers, None if unknown."""
    if not force and F1_ACCESS['at'] is not None and time.monotonic() - F1_ACCESS['at'] < ACCESS_CHECK_SECONDS:
        return F1_ACCESS['blocked']
    if fetch is None:
        import probe
        fetch = lambda: probe.status('GET', 'static/2026/Index.json')
    try:
        code, cache = fetch()
    except Exception:
        code, cache = None, None
    blocked = True if code == 403 else False if code in (200, 401) else None
    if blocked is not None or F1_ACCESS['at'] is None:
        if blocked != F1_ACCESS['blocked']:
            cloud.run_log({'event': 'f1_access', 'status': code, 'cache': cache, 'blocked': blocked})
            if blocked:
                print('F1 refuses this network (403 before sign-in). Other hosts collect first; this one waits as a last resort.')
        F1_ACCESS.update(blocked=blocked, at=time.monotonic())
    return F1_ACCESS['blocked']


def access_fields():
    return {'f1_blocked': True} if F1_ACCESS['blocked'] else {}


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
                   'os': os_label(), 'version': COLLECTOR_VERSION, 'started_at': STARTED_AT, **access_fields()}
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
    secure_credentials(path, lines)
    return True


KEYRING_SERVICE = 'kongboda-collector'


def _keyring(install=True):
    """The OS password store (Windows Credential Manager / macOS Keychain), or None.
    Installs the keyring package once if an older setup does not have it yet."""
    try:
        import keyring
    except ImportError:
        if not install or os.environ.get('KONGBODA_NO_PIP') == '1':
            return None
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'keyring'], timeout=300,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        except Exception:
            return None
        return _keyring(install=False)
    try:
        from keyring.backends import fail
        backend = keyring.get_keyring()
        return None if isinstance(backend, fail.Keyring) or getattr(backend, 'priority', 1) <= 0 else keyring
    except Exception:
        return None


def secure_credentials(path, lines):
    """Keep the F1 password in the OS password store, not in host.env.

    A password still in host.env (older installs, fresh setup) is moved to the store and
    removed from the file; later starts read it from the store."""
    user = os.environ.get('F1_USERNAME')
    store = _keyring()
    if not user or store is None:
        return False
    in_file = [l for l in lines if l.startswith('F1_PASSWORD=')]
    try:
        if in_file:
            store.set_password(KEYRING_SERVICE, user, in_file[0].partition('=')[2])
            if store.get_password(KEYRING_SERVICE, user) != in_file[0].partition('=')[2]:
                return False  # store did not keep it: leave the file alone
            kept = [l for l in lines if not l.startswith('F1_PASSWORD=')]
            with open(path, 'w', encoding='utf-8', newline='\n') as handle:
                handle.write('\n'.join(kept) + '\n')
            print('F1 password moved to the system password store (' + type(store.get_keyring()).__name__ + ').')
        elif not os.environ.get('F1_PASSWORD'):
            secret = store.get_password(KEYRING_SERVICE, user)
            if secret:
                os.environ['F1_PASSWORD'] = secret
        return True
    except Exception as exc:
        print('Password store unavailable (' + type(exc).__name__ + '); using host.env.')
        return False


def forget_credentials():
    """Remove this computer's F1 password from the OS password store (uninstall)."""
    load_env_file()
    store, user = _keyring(), os.environ.get('F1_USERNAME')
    if store and user:
        try:
            store.delete_password(KEYRING_SERVICE, user)
        except Exception:
            pass
    return 0


def ensure_certificates():
    """Python from python.org on macOS ships without root certificates; use certifi's."""
    if sys.platform == 'darwin' and not os.environ.get('SSL_CERT_FILE'):
        try:
            import certifi
            os.environ['SSL_CERT_FILE'] = certifi.where()
        except ImportError:
            pass


def check_setup():
    # No F1 account here is fine: the owner's shared login token is used instead.
    missing = [name for name in ('HOST_NAME',) if not os.environ.get(name)]
    import host_auth
    if not host_auth.key_path().exists():
        missing.append('host key (' + str(host_auth.key_path()) + ')')
    return missing


def skipped(state, window_id):
    """Windows this host must not enter now: already recorded, or a login retry pause."""
    if window_id in state.setdefault('done', set()):
        return True
    return time.monotonic() < state.setdefault('retry_at', {}).get(window_id, 0)


def own_login():
    return bool(os.environ.get('F1_USERNAME') and os.environ.get('F1_PASSWORD'))


def stored_token_left():
    """Seconds until the F1 login token stored on this computer expires (0 if none)."""
    try:
        from fastf1.internals.f1account import token_manager
        token = token_manager.get_stored()
        return max(0, token.expires_at - time.time()) if token else 0
    except Exception:
        return 0


def owner_token(state):
    """The owner's computer: its current F1 login token to share, renewed with the
    password when less than TOKEN_RENEW_LEFT remains (checked at most every 10 minutes)."""
    if time.monotonic() - state.get('token_read_at', -TOKEN_SHARE_EVERY) < TOKEN_SHARE_EVERY:
        return state.get('token_value')
    state['token_read_at'] = time.monotonic()
    try:
        import logging
        import fastf1
        from fastf1.internals.f1account import get_token
        logging.getLogger('fastf1').setLevel(logging.CRITICAL)
        fastf1.set_auth_method('password')
        state['token_value'] = get_token(force_renew=stored_token_left() < TOKEN_RENEW_LEFT).value
    except Exception as exc:
        cloud.run_log({'event': 'token_share_error', 'error': type(exc).__name__})
        state['token_value'] = None
    return state['token_value']


def install_shared_token(shared):
    """Store the owner's login token where FastF1 looks for it."""
    try:
        from fastf1.internals.f1account import token_manager
        from fastf1.internals.f1account.tokens import SubscriptionToken
        token = SubscriptionToken.from_jwt(shared['value'])
        if not token.is_valid():
            return False
        token_manager._token = token  # the in-memory copy wins over the file
        token_manager.store(token)
        return True
    except Exception:
        return False


def token_fields(state):
    """Extra heartbeat fields for the shared F1 login."""
    if own_login():
        value = owner_token(state) if state.get('token_source') else None
        return {'f1_token': value} if value else {}
    return {'want_token': True} if stored_token_left() < TOKEN_WANT_LEFT else {}


NOT_CREW_NOTE = ('This computer is linked to a Kongboda account that is not crew, so it needs its own F1 account: '
                 'run the installer again and type the F1 email and password.')


def take_token(data):
    """Store a shared token from a heartbeat answer; returns the site's verdict
    ('crew', 'not_crew') or None."""
    if not isinstance(data, dict):
        return None
    if isinstance(data.get('f1_token'), dict) and install_shared_token(data['f1_token']):
        cloud.run_log({'event': 'shared_login', 'expires_at': int(data['f1_token'].get('expires_at') or 0)})
    mode = data.get('shared_login')
    if mode == 'not_crew' and not TOKEN_NOTES.get('not_crew'):
        TOKEN_NOTES['not_crew'] = True
        print(NOT_CREW_NOTE)
        cloud.run_log({'event': 'own_account_required'})
    return mode


TOKEN_NOTES = {}


def fetch_shared_token():
    """Before recording without an own F1 account: make sure a valid shared token is here.
    Returns the site's verdict ('crew', 'not_crew'), 'ready' or None (site unreachable /
    computer not linked yet)."""
    if own_login() or stored_token_left() > 3600:
        return 'ready'
    status, data = runner.host_call('/api/live/host-beat', {'window': None, 'os': os_label(), 'version': COLLECTOR_VERSION,
                                                            'started_at': STARTED_AT, 'want_token': True, 'own_login': False})
    return take_token(data) if status == 200 else None


def idle_beat(state):
    """Every few minutes outside sessions: show this host as online. Returns is_lead and
    remembers which series the owner assigned to this computer."""
    if time.monotonic() - state.get('idle_beat_at', -IDLE_BEAT_SECONDS) >= IDLE_BEAT_SECONDS:
        state['idle_beat_at'] = time.monotonic()
        check_f1_access()
        status, data = runner.host_call('/api/live/host-beat', {'window': None, 'os': os_label(), 'version': COLLECTOR_VERSION,
                                                                'started_at': STARTED_AT, 'jobs_available': sorted(host_jobs.JOBS),
                                                                'own_login': own_login(), **token_fields(state),
                                                                **access_fields()})
        if status == 200 and data:
            state['token_source'] = bool(data.get('token_source'))
            take_token(data)
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
        # Fresh network check for the site's baton choice, without delaying the recording.
        threading.Thread(target=check_f1_access, kwargs={'force': True}, daemon=True, name='f1-access').start()
        fetch_shared_token()
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
    started, power_windows = [], []
    for job in assigned_jobs(state):
        job_state = state.setdefault('jobs', {}).setdefault(job.series, {'done': set(), 'retry_at': {}, 'running': {}})
        running = job_state['running']
        for key in [k for k, t in running.items() if not t.is_alive()]:
            del running[key]
        try:
            windows = job.windows(job_state)
        except Exception as exc:
            cloud.run_log({'event': 'schedule_error', 'series': job.series, 'error': type(exc).__name__})
            power_windows = None  # calendar unknown: never sleep on a guess
            continue
        if power_windows is not None:
            power_windows += [dict(w, series=job.series, ended=w['id'] in job_state['done']) for w in windows]
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
    recording = update_active_marker(state)
    if power.enabled() and power_windows is not None and not wait:
        power.tick(power_windows, lookahead(), recording=bool(recording), is_lead=state.get('is_lead', True),
                   is_done=lambda wid: runner.history_done(wid))
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
    sys.exit(forget_credentials() if sys.argv[1:] == ['--forget-credentials'] else main())
