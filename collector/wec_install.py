"""Verify WEC's pinned browser before admitting a new collector release.

Supports the existing Render pip-install / cloud.py serve commands. Browser
installation is explicit startup preparation, never part of a timing request.
No provider login or credential read happens here.
"""
import os
import re
import subprocess
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

PINNED_PLAYWRIGHT = '1.64.1'


class BrowserSetupError(RuntimeError):
    pass


def browser_environment():
    # Installation/launch probes do not inherit provider credentials.
    allowed = ('PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'LD_LIBRARY_PATH',
               'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
               'VIRTUAL_ENV', 'PYTHONPATH')
    env = {k: os.environ[k] for k in allowed if k in os.environ}
    env['PLAYWRIGHT_BROWSERS_PATH'] = str(Path(__file__).resolve().parent / '.wec-browsers')
    return env


def probe(env):
    script = ('from playwright.sync_api import sync_playwright\n'
              'with sync_playwright() as p:\n'
              ' b=p.chromium.launch(headless=True)\n'
              ' b.close()\n')
    try:
        result = subprocess.run([sys.executable, '-c', script], env=env,
                                stdin=subprocess.DEVNULL, capture_output=True,
                                text=True, timeout=30, check=False)
    except subprocess.TimeoutExpired:
        return 'launch_timeout'
    if result.returncode == 0:
        return 'ready'
    error = result.stderr or ''
    if "Executable doesn't exist" in error:
        return 'browser_missing'
    libraries = sorted(set(re.findall(r'\blib[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*', error)))
    return 'system_dependencies_missing:' + ','.join(libraries) if libraries else 'launch_failed'


def ensure_browser():
    try:
        installed = version('playwright')
    except PackageNotFoundError:
        raise BrowserSetupError('playwright_package_missing') from None
    if installed != PINNED_PLAYWRIGHT:
        raise BrowserSetupError('playwright_version_mismatch')
    env = browser_environment()
    state = probe(env)
    if state == 'browser_missing':
        print('Preparing pinned WEC Chromium runtime (no provider login).', flush=True)
        try:
            result = subprocess.run([sys.executable, '-m', 'playwright', 'install',
                                     '--only-shell', 'chromium'], env=env,
                                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL, timeout=300, check=False)
        except subprocess.TimeoutExpired:
            raise BrowserSetupError('browser_download_timeout') from None
        if result.returncode:
            raise BrowserSetupError('browser_download_failed')
        state = probe(env)
    if state != 'ready':
        raise BrowserSetupError(state)
    os.environ['PLAYWRIGHT_BROWSERS_PATH'] = env['PLAYWRIGHT_BROWSERS_PATH']
    print('WEC browser runtime verified (no provider login attempted).', flush=True)
    return 'ready'
