"""Bounded, on-demand WEC browser work isolated from the F1 supervisor."""
import argparse
import json
import os
import subprocess
import signal
import sys
import threading
import time
from pathlib import Path
from wec_browser import DiscoveryError, FIAWECBrowser, discover, request_target, utcnow

BLOCKING = {'credentials_required', 'authentication_failed', 'authentication_action_required',
            'human_verification_required', 'subscription_or_login_required'}


def save_result(path, result):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    temporary.replace(path)


class WECManager:
    def __init__(self, directory):
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
            env = dict(os.environ)
            # Startup preflight or render-build.sh installs this pinned runtime.
            env.setdefault('PLAYWRIGHT_BROWSERS_PATH', str(Path(__file__).resolve().parent / '.wec-browsers'))
            self.process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                '--output', str(self.path), '--target', json.dumps(target)],
                env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
