"""Bounded, temporary per-account F1 processes. No shared-feed fallback."""
import atexit
import json
import os
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path

ACCOUNT = re.compile(r'^[a-zA-Z0-9-]{1,80}$')
ALLOWED = {'/snapshot', '/poll', '/stop', '/telemetry/laps', '/history/recover'}


class PersonalSessions:
    def __init__(self):
        self.sessions = {}
        self.attempts = {}
        self.lock = threading.RLock()
        self.limit = max(1, min(16, int(os.environ.get('PERSONAL_F1_MAX_SESSIONS', '2'))))
        atexit.register(self.close)
        threading.Thread(target=self.reaper, daemon=True).start()

    def reaper(self):
        while True:
            time.sleep(30)
            with self.lock:
                for account, session in list(self.sessions.items()):
                    if time.monotonic() >= session['expires'] or session['process'].poll() is not None:
                        self.remove(account)
                self.attempts = {k: v for k, v in self.attempts.items() if time.monotonic() - v[0] < 900}

    def remove(self, account):
        session = self.sessions.pop(account, None)
        if session:
            # Kill the entire private process group, including recorder children.
            try:
                os.killpg(session['process'].pid, signal.SIGTERM)
                session['process'].wait(timeout=5)
            except ProcessLookupError:
                pass
            except subprocess.TimeoutExpired:
                os.killpg(session['process'].pid, signal.SIGKILL)
                session['process'].wait(timeout=5)
            shutil.rmtree(session['directory'], ignore_errors=True)

    def close(self):
        with self.lock:
            for account in list(self.sessions):
                self.remove(account)

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
                return {'error': 'Personal collector capacity reached'}, 503
            directory = tempfile.mkdtemp(prefix='kongboda-personal-')
            key = secrets.token_urlsafe(48)
            # Only runtime necessities are inherited. Never inherit owner credentials,
            # callback settings, WEC login or shared storage/cache paths.
            child_env = {k: v for k, v in os.environ.items() if k in {
                'PATH', 'LANG', 'LC_ALL', 'SYSTEMROOT', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
                'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'REQUESTS_CA_BUNDLE'}}
            child_env.update({'HOME': directory, 'XDG_DATA_HOME': directory + '/auth',
                'XDG_CACHE_HOME': directory + '/cache', 'DATA_DIR': directory,
                'F1_USERNAME': username, 'F1_PASSWORD': password,
                'COLLECTOR_READ_KEY': key, 'PERSONAL_F1_CHILD': '1', 'AUTO_COLLECT': 'true'})
            command = [sys.executable, str(Path(__file__).with_name('cloud.py'))]
            try:
                result = subprocess.run(command + ['auth'], env=child_env, stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=12)
                if result.returncode:
                    shutil.rmtree(directory, ignore_errors=True)
                    return {'error': 'F1 authentication failed; check account and subscription'}, 401
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0))
                    port = sock.getsockname()[1]
                child_env['PORT'] = str(port)
                self.remove(account)
                process = subprocess.Popen(command + ['serve'], env=child_env, stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
                self.sessions[account] = {'process': process, 'directory': directory, 'port': port,
                    'key': key, 'expires': time.monotonic() + 8 * 3600}
                return {'state': 'authenticated', 'expires_in_seconds': 8 * 3600}, 200
            except (OSError, subprocess.TimeoutExpired):
                shutil.rmtree(directory, ignore_errors=True)
                return {'error': 'F1 login unavailable; retry later'}, 502

    def request(self, account, path, method, body=None):
        if not ACCOUNT.fullmatch(account):
            return {'error': 'Invalid account'}, 400
        if path == '/login' and method == 'POST':
            return self.login(account, body or {})
        with self.lock:
            if path == '/logout' and method == 'POST':
                self.remove(account)
                return {'ok': True, 'state': 'signed_out'}, 200
            session = self.sessions.get(account)
            if not session or time.monotonic() >= session['expires']:
                self.remove(account)
                return {'snapshot': None, 'collector': {'state': 'credentials_required',
                    'auth_state': 'credentials_required', 'collector_running': False}}, 200
            if path not in ALLOWED or (method == 'GET') != (path == '/snapshot'):
                return {'error': 'Not found'}, 404
            port, key = session['port'], session['key']
        request = urllib.request.Request(f'http://127.0.0.1:{port}{path}',
            data=json.dumps(body or {}).encode() if method == 'POST' else None,
            headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}, method=method)
        try:
            # Explicit loopback; never proxy private session tokens externally.
            with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=16) as response:
                data = response.read(4_100_001)
                if len(data) > 4_100_000:
                    raise ValueError('Oversize response')
                return json.loads(data), response.status
        except (OSError, ValueError, urllib.error.URLError):
            return {'error': 'Personal collector starting or unavailable'}, 503
