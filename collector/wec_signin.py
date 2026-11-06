"""FIAWEC+ 연결: a person signs in to FIAWEC+ through a remote view of a server browser.

The site shows screenshots of this browser and relays the person's taps and typing.
The person types the password and solves any CAPTCHA; nothing here fills a form or
solves a check. Once the account menu appears, the browser's cookies (storage state)
go back to the site, which keeps them encrypted for this account and hands them to the
timing reader. Each sign-in runs in its own child process (Playwright is not thread
safe) and ends after 10 idle minutes.
"""
import base64
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

HOME = 'https://plus.fiawec.com/en'
WIDTH, HEIGHT = 390, 740
IDLE_SECONDS = 600
KEY = re.compile(r'^(?:operator|[a-zA-Z0-9-]{1,80})$')
KEYS = {'Enter', 'Backspace', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'}
# Top-level pages the remote view may show. CAPTCHA widgets load in frames and are not limited.
PAGE_HOSTS = {'plus.fiawec.com', 'auth.staylive.io'}


def clean_command(raw):
    """Only a tap inside the view, short text or one named key. Returns None otherwise."""
    if not isinstance(raw, dict):
        return None
    op = raw.get('op')
    if op == 'frame':
        return {'op': 'frame'}
    if op == 'click':
        x, y = raw.get('x'), raw.get('y')
        if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (x, y)) and 0 <= x <= WIDTH and 0 <= y <= HEIGHT:
            return {'op': 'click', 'x': float(x), 'y': float(y)}
    if op == 'type':
        text = raw.get('text')
        if isinstance(text, str) and 1 <= len(text) <= 256 and '\n' not in text and '\r' not in text:
            return {'op': 'type', 'text': text}
    if op == 'key' and raw.get('key') in KEYS:
        return {'op': 'key', 'key': raw['key']}
    if op == 'scroll':
        dy = raw.get('dy')
        if isinstance(dy, (int, float)) and not isinstance(dy, bool) and -2000 <= dy <= 2000:
            return {'op': 'scroll', 'dy': float(dy)}
    return None


def signed_in(page):
    """Positive signal only: the FIAWEC+ account menu on plus.fiawec.com, no login link."""
    if urlsplit(page.url).hostname != 'plus.fiawec.com':
        return False
    try:
        return page.locator('[id^="headlessui-menu-button-"]').count() > 0 and page.locator('a[href*="/login"]').count() == 0
    except Exception:
        return False


def child():
    """The browser process: one JSON command per stdin line, one JSON reply per stdout line."""
    from playwright.sync_api import sync_playwright

    def say(data):
        sys.stdout.write(json.dumps(data) + '\n')
        sys.stdout.flush()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1,
                                      is_mobile=True, has_touch=True, accept_downloads=False, locale='en-GB')

        def guard(route):
            req = route.request
            if req.resource_type == 'media':
                return route.abort()
            try:
                top = req.is_navigation_request() and req.frame == page.main_frame
            except Exception:
                top = False
            if top and urlsplit(req.url).hostname not in PAGE_HOSTS:
                return route.abort()
            return route.continue_()

        context.route('**/*', guard)
        page = context.new_page()
        try:
            page.goto(HOME, wait_until='domcontentloaded', timeout=30000)
            page.locator('[id^="headlessui-menu-button-"],a[href*="/login"]').first.wait_for(state='visible', timeout=15000)
            login = page.locator('a[href*="/login"]')
            if login.count():
                login.first.click()
                button = page.get_by_role('button', name=re.compile(r'^Sign in\b'))
                button.wait_for(state='visible', timeout=10000)
                button.click()
                page.wait_for_url('https://auth.staylive.io/**', timeout=20000)
        except Exception:
            pass  # the person can still navigate from whatever page is showing

        def frame():
            if signed_in(page):
                return {'state': 'signed_in', 'storage_state': context.storage_state()}
            image = page.screenshot(type='jpeg', quality=60, timeout=10000)
            return {'state': 'signing_in', 'host': urlsplit(page.url).hostname or '',
                    'image': base64.b64encode(image).decode(), 'width': WIDTH, 'height': HEIGHT}

        say(frame())
        for line in sys.stdin:
            command = clean_command(json.loads(line or '{}'))
            try:
                if command is None:
                    say({'error': 'invalid_command'})
                    continue
                if command['op'] == 'click':
                    page.mouse.click(command['x'], command['y'])
                elif command['op'] == 'type':
                    page.keyboard.type(command['text'], delay=20)
                elif command['op'] == 'key':
                    page.keyboard.press(command['key'])
                elif command['op'] == 'scroll':
                    page.mouse.wheel(0, command['dy'])
                if command['op'] != 'frame':
                    page.wait_for_timeout(900)
                result = frame()
                say(result)
                if result['state'] == 'signed_in':
                    break
            except Exception:
                say({'state': 'signing_in', 'error': 'browser_busy'})
        context.close()
        browser.close()


class SignIn:
    def __init__(self, process):
        self.process = process
        self.lock = threading.Lock()
        self.touched = time.monotonic()

    def ask(self, command, timeout=40):
        with self.lock:
            self.touched = time.monotonic()
            if self.process.poll() is not None:
                return {'state': 'closed'}
            if command is not None:
                self.process.stdin.write(json.dumps(command) + '\n')
                self.process.stdin.flush()
            return read_line(self.process, timeout)

    def close(self):
        if self.process.poll() is None:
            self.process.kill()
            self.process.wait(timeout=5)


def read_line(process, timeout):
    result = {}

    def reader():
        line = process.stdout.readline()
        try:
            result['value'] = json.loads(line) if line else {'state': 'closed'}
        except ValueError:
            result['value'] = {'state': 'closed'}

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()
    thread.join(timeout)
    return result.get('value') or {'state': 'signing_in', 'error': 'browser_slow'}


class SignInManager:
    """At most `limit` sign-in browsers at once, keyed by account ('operator' for the owner)."""
    def __init__(self, limit=None, spawn=None):
        self.limit = limit or max(1, min(4, int(os.environ.get('WEC_SIGNIN_MAX', '2'))))
        self.spawn = spawn or spawn_child
        self.sessions = {}
        self.lock = threading.RLock()

    def sweep(self):
        for key, session in list(self.sessions.items()):
            if time.monotonic() - session.touched > IDLE_SECONDS or session.process.poll() is not None:
                session.close()
                self.sessions.pop(key, None)

    def request(self, key, op, body=None):
        if not KEY.fullmatch(key or ''):
            return {'error': 'Invalid account'}, 400
        with self.lock:
            self.sweep()
            session = self.sessions.get(key)
            if op == 'cancel':
                if session:
                    session.close()
                    self.sessions.pop(key, None)
                return {'state': 'cancelled'}, 200
            if op == 'start':
                if session:
                    session.close()
                    self.sessions.pop(key, None)
                if len(self.sessions) >= self.limit:
                    return {'error': 'Sign-in capacity reached; retry in a few minutes'}, 503
                session = SignIn(self.spawn())
                self.sessions[key] = session
                command = None  # the child sends its first frame by itself
            elif not session:
                return {'state': 'closed'}, 200
            elif op == 'frame':
                command = {'op': 'frame'}
            elif op == 'input':
                command = clean_command(body or {})
                if command is None:
                    return {'error': 'Invalid input'}, 400
            else:
                return {'error': 'Not found'}, 404
        result = session.ask(command, timeout=60 if op == 'start' else 40)
        if result.get('state') in ('signed_in', 'closed'):
            with self.lock:
                if self.sessions.get(key) is session:
                    self.sessions.pop(key, None)
            session.close()
        return result, 200

    def close(self):
        with self.lock:
            for session in self.sessions.values():
                session.close()
            self.sessions.clear()


def spawn_child():
    env = {k: v for k, v in os.environ.items() if not re.search(r'PASSWORD|USERNAME|EMAIL|KEY|TOKEN|SECRET', k)}
    env.setdefault('PLAYWRIGHT_BROWSERS_PATH', str(Path(__file__).resolve().parent / '.wec-browsers'))
    return subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--child'], env=env, text=True,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)


if __name__ == '__main__' and sys.argv[1:] == ['--child']:
    child()
