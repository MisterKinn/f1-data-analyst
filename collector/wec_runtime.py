"""Bounded, on-demand WEC browser work isolated from the F1 supervisor."""
import argparse
import json
import os
import re
import shutil
import subprocess
import signal
import sys
import tempfile
import threading
import time
from pathlib import Path
from wec_browser import DiscoveryError, FIAWECBrowser, discover, request_target, utcnow

OWNER_KEYS = ('WEC_USERNAME', 'WEC_EMAIL', 'WEC_PASSWORD', 'FIAWEC_USERNAME', 'FIAWEC_PASSWORD')
ACCOUNT = re.compile(r'^[a-zA-Z0-9-]{1,80}$')

BLOCKING = {'credentials_required', 'authentication_failed', 'authentication_action_required',
            'human_verification_required', 'subscription_or_login_required'}


def save_result(path, result):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    temporary.replace(path)


def child_env(credentials=None):
    """A personal job never sees the owner's FIAWEC+ account, and vice versa."""
    env = {k: v for k, v in os.environ.items() if not credentials or k not in OWNER_KEYS}
    if credentials:
        env['WEC_USERNAME'], env['WEC_PASSWORD'] = credentials
    # Startup preflight or render-build.sh installs this pinned runtime.
    env.setdefault('PLAYWRIGHT_BROWSERS_PATH', str(Path(__file__).resolve().parent / '.wec-browsers'))
    return env


class WECManager:
    def __init__(self, directory, credentials=None):
        self.credentials = credentials
        self.path = Path(directory) / 'wec-status.json'
        self.lock = threading.Lock()
        self.process = None
        self.started = 0
        self.target = None
        self.blocked = False

    def read(self):
        try:
            result = json.loads(self.path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            result = {'state': 'not_started', 'live': False, 'records': []}
        return result

    def request(self, target):
        target = request_target(target)
        with self.lock:
            if self.process and self.process.poll() is None:
                if time.monotonic() - self.started > 120:
                    self.process.terminate()
                    self.process.wait(timeout=5)
                    save_result(self.path, {'state': 'discovery_timeout', 'live': False,
                                           'checked_at': utcnow(), 'target': self.target, 'records': []})
                else:
                    return {**self.read(), 'busy': True, 'requested_target': target}
            result = self.read()
            self.blocked = self.blocked or (self.target is not None and result.get('state') in BLOCKING)
            if self.blocked:
                return {**result, 'retry_requires_operator': True}
            if target == self.target and time.monotonic() - self.started < 60:
                return result
            self.target = target
            self.started = time.monotonic()
            save_result(self.path, {'state': 'discovering', 'live': False, 'checked_at': utcnow(),
                                   'target': target, 'records': []})
            self.process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                '--output', str(self.path), '--target', json.dumps(target)],
                env=child_env(self.credentials), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return self.read()

    def close(self):
        with self.lock:
            if self.process and self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=5)


class PersonalWEC:
    """Per-account FIAWEC+ logins, like personal.py for F1: credentials stay in this
    process's memory for at most 8 hours, each account has its own result folder, and
    nothing falls back to the owner's account."""
    def __init__(self, limit=None, login=None):
        self.sessions = {}
        self.attempts = {}
        self.lock = threading.RLock()
        self.limit = limit or max(1, min(8, int(os.environ.get('PERSONAL_WEC_MAX_SESSIONS', '2'))))
        self.check_login = login or verify_login

    def remove(self, account):
        session = self.sessions.pop(account, None)
        if session:
            session['manager'].close()
            shutil.rmtree(session['directory'], ignore_errors=True)

    def login(self, account, body):
        username, password = body.get('username'), body.get('password')
        if not isinstance(username, str) or not 1 <= len(username) <= 254 or not isinstance(password, str) or not 1 <= len(password) <= 1024:
            return {'error': 'Invalid credentials'}, 400
        with self.lock:
            started, count = self.attempts.get(account, (time.monotonic(), 0))
            if time.monotonic() - started >= 900:
                started, count = time.monotonic(), 0
            if count >= 5:
                return {'error': 'Too many login attempts; retry after 15 minutes'}, 429
            self.attempts[account] = (started, count + 1)
            if account not in self.sessions and len(self.sessions) >= self.limit:
                return {'error': 'Personal WEC capacity reached'}, 503
        state = self.check_login((username, password))
        if state != 'authenticated':
            return {'error': 'FIAWEC+ login failed', 'state': state}, 401
        with self.lock:
            self.remove(account)
            directory = tempfile.mkdtemp(prefix='kongboda-wec-')
            self.sessions[account] = {'manager': WECManager(directory, (username, password)),
                                      'directory': directory, 'expires': time.monotonic() + 8 * 3600}
        return {'state': 'authenticated', 'expires_in_seconds': 8 * 3600}, 200

    def request(self, account, path, method, body=None):
        if not ACCOUNT.fullmatch(account):
            return {'error': 'Invalid account'}, 400
        if path == '/wec/login' and method == 'POST':
            return self.login(account, body or {})
        with self.lock:
            if path == '/wec/logout' and method == 'POST':
                self.remove(account)
                return {'ok': True, 'state': 'signed_out'}, 200
            session = self.sessions.get(account)
            if session and time.monotonic() >= session['expires']:
                self.remove(account)
                session = None
            if not session:
                return {'state': 'credentials_required', 'live': False, 'records': []}, 200
            if path == '/wec/snapshot' and method == 'GET':
                return session['manager'].read(), 200
            if path == '/wec/discover' and method == 'POST':
                try:
                    return session['manager'].request(body or {}), 202
                except DiscoveryError:
                    return {'error': 'Invalid WEC target'}, 400
        return {'error': 'Not found'}, 404

    def close(self):
        with self.lock:
            for account in list(self.sessions):
                self.remove(account)


def verify_login(credentials, timeout=90):
    """Sign in once in a separate process; only the outcome comes back."""
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--login-only'],
                                env=child_env(credentials), stdin=subprocess.DEVNULL,
                                capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        return 'login_unavailable'
    state = (result.stdout.strip().splitlines() or ['discovery_failed'])[-1]
    return state if re.fullmatch(r'[a-z_]{3,40}', state) else 'discovery_failed'


def login_only():
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            driver = FIAWECBrowser(browser)
            try:
                driver.authenticate()
            finally:
                driver.close()
                browser.close()
        return 'authenticated'
    except DiscoveryError as exc:
        return exc.code
    except Exception:
        return 'browser_runtime_unavailable'


def run(target, output):
    driver = None
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(headless=True)
            except Exception:
                raise DiscoveryError('browser_runtime_unavailable') from None
            try:
                driver = FIAWECBrowser(browser)
                result = discover(driver, target)
                if result['records']:
                    # Two observations are required; still do not label live until
                    # a session-specific provider status adapter is verified.
                    first = result['records']
                    driver.page.wait_for_timeout(5000)
                    second = driver.read_rows()
                    result.update(records=second or first, rows_changed=bool(second and second != first),
                                  state='snapshot_unverified', checked_at=utcnow(),
                                  verification_required='provider_session_status')
                save_result(output, result)
            finally:
                if driver:
                    driver.close()
                browser.close()
    except ImportError:
        save_result(output, {'state': 'browser_runtime_unavailable', 'live': False,
                             'target': target, 'checked_at': utcnow(), 'records': []})
    except Exception as exc:
        save_result(output, {'state': exc.code if isinstance(exc, DiscoveryError) else 'discovery_failed',
                             'live': False, 'target': target, 'checked_at': utcnow(), 'records': []})


if __name__ == '__main__':
    if sys.argv[1:] == ['--login-only']:
        print(login_only())
        raise SystemExit(0)
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--target', required=True)
    args = parser.parse_args()
    if hasattr(signal, 'SIGALRM'):
        def deadline(*_):
            raise DiscoveryError('discovery_timeout')
        signal.signal(signal.SIGALRM, deadline)
        signal.alarm(110)
    run(request_target(json.loads(args.target)), args.output)
