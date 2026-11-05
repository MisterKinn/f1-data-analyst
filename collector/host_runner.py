"""Always-on F1 collector for a home computer (F1 blocks datacenter networks).

Runs forever: every CHECK_SECONDS it refreshes the FastF1 schedule (hourly), records a
session whose window is open or opens within LOOKAHEAD_MINUTES, and otherwise publishes
FastF1 post-session data for the latest finished session. Uploads are signed with this
host's key (host_auth.py); several hosts may run at once.

HOST_ROLE=backup makes this host record only when no other host has pushed recently, so
a laptop can stand in for the main host without doubling uploads.

Environment: F1_USERNAME, F1_PASSWORD, HOST_NAME, DATA_DIR, optional HOST_KEY_FILE,
HOST_ROLE (primary|backup), LOOKAHEAD_MINUTES (default 45), SITE_URL.
"""
import os
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone

import actions_runner as runner
import cloud

CHECK_SECONDS = int(os.environ.get('CHECK_SECONDS', '60'))
SCHEDULE_REFRESH = timedelta(hours=1)
HISTORY_RETRY_SECONDS = int(os.environ.get('HISTORY_RETRY_SECONDS', '600'))
BACKUP_FRESH_SECONDS = 120
BACKUP_GRACE = timedelta(minutes=2)
# Exit while idle after this long so the launcher can pull new code and restart.
RESTART_AFTER_SECONDS = int(os.environ.get('RESTART_AFTER_SECONDS', str(6 * 3600)))


def lookahead():
    return timedelta(minutes=int(os.environ.get('LOOKAHEAD_MINUTES', '45')))


def recently_tried(window_id, now=None):
    last = runner.LAST_HISTORY_ATTEMPT.get(window_id)
    return last is not None and (now if now is not None else time.monotonic()) - last < HISTORY_RETRY_SECONDS


def other_host_active(latest_received_at, now):
    """True when another host pushed within BACKUP_FRESH_SECONDS."""
    if not latest_received_at:
        return False
    try:
        received = datetime.fromisoformat(str(latest_received_at).replace('Z', '+00:00'))
    except ValueError:
        return False
    return (now - received).total_seconds() < BACKUP_FRESH_SECONDS


def backup_should_start(window):
    """Backup hosts give the main host a short head start, then fill in only if it is silent."""
    while cloud.now() < runner.at(window['start']) + BACKUP_GRACE:
        time.sleep(15)
    status, data = runner.site('GET', window['id'])
    if status == 200 and data and other_host_active(data.get('latest_received_at'), cloud.now()):
        print('Backup host: another host is pushing; standing by.')
        return False
    return True


def default_env_file():
    local = os.environ.get('LOCALAPPDATA')
    return os.path.join(local, 'Kongboda', 'host.env') if local else '/etc/kongboda/host.env'


def load_env_file(path=None):
    """Fill missing settings from host.env (KEY=VALUE lines) so any launcher works."""
    path = path or os.environ.get('HOST_ENV_FILE') or default_env_file()
    try:
        lines = open(path, encoding='utf-8-sig').read().splitlines()
    except OSError:
        return False
    for line in lines:
        name, sep, value = line.partition('=')
        if sep and name.strip() and not name.lstrip().startswith('#') and not os.environ.get(name.strip()):
            os.environ[name.strip()] = value
    return True


def check_setup():
    missing = [name for name in ('F1_USERNAME', 'F1_PASSWORD', 'HOST_NAME') if not os.environ.get(name)]
    import host_auth
    if not host_auth.key_path().exists():
        missing.append('host key (' + str(host_auth.key_path()) + ')')
    return missing


def cycle(state):
    if state.get('schedule_at') is None or cloud.now() - state['schedule_at'] >= SCHEDULE_REFRESH:
        cloud.fetch_schedule()
        state['schedule_at'] = cloud.now()
    windows = cloud.read_json(cloud.DATA / 'schedule.json', {}).get('windows', [])
    window = runner.next_window(windows, cloud.now(), lookahead())
    if window:
        backup = os.environ.get('HOST_ROLE', 'primary').lower() == 'backup'
        cloud.atomic_json(cloud.DATA / 'active-window.json', {'window': window['id'], 'at': cloud.now().isoformat()})
        try:
            runner.record_window(window, backup_should_start if backup else None)
        finally:
            (cloud.DATA / 'active-window.json').unlink(missing_ok=True)
        return
    runner.post_session(windows, skip=recently_tried)


def main():
    load_env_file()
    if os.environ.get('DATA_DIR'):
        cloud.DATA = cloud.Path(os.environ['DATA_DIR'])
    missing = check_setup()
    if missing:
        print('Collector host is not set up; missing: ' + ', '.join(missing))
        return 2
    cloud.DATA.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault('XDG_DATA_HOME', str(cloud.DATA / 'auth'))
    if os.environ.get('PROBE') == '1':
        import probe
        return probe.main()
    print('Kongboda collector host', os.environ['HOST_NAME'], 'role', os.environ.get('HOST_ROLE', 'primary'))
    # Signed request with a dummy window: 200 means this host's key is registered and accepted.
    status, _ = runner.site('GET', '2000-1-1')
    cloud.run_log({'event': 'host_start', 'host': os.environ['HOST_NAME'], 'role': os.environ.get('HOST_ROLE', 'primary'),
                   'upload_auth': status})
    if status != 200:
        print('Upload check failed (HTTP %s). Is this host listed in worker/collector-hosts.js?' % status)
    state, started = {}, time.monotonic()
    while True:
        if time.monotonic() - started > RESTART_AFTER_SECONDS:
            return 0  # idle restart; recording happens inside cycle(), so never mid-session
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
