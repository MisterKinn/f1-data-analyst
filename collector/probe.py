"""Check whether this runner can reach F1 live timing (manual workflow input probe=yes).

F1 blocks some datacenter networks before authentication (FastF1 issue #988), which
looks exactly like "not published yet". This prints only status codes, never secrets.
"""
import json
import urllib.error
import urllib.request

import cloud

CHECKS = (
    ('negotiate', 'POST', 'signalrcore/negotiate?negotiateVersion=1'),
    ('session_info', 'GET', 'static/SessionInfo.json'),
    ('archive_index', 'GET', 'static/2026/Index.json'),
)


def status(method, path, auth=None):
    from fastf1.internals.f1account import LIVETIMING_URL
    request = urllib.request.Request(LIVETIMING_URL + path, method=method, data=b'' if method == 'POST' else None,
                                     headers={'User-Agent': 'kongboda-collector-probe', **({'Authorization': auth} if auth else {})})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.headers.get('X-Cache')
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get('X-Cache')
    except OSError as error:
        return type(error).__name__, None


def main():
    import fastf1
    from fastf1.internals.f1account import get_token
    result = {'event': 'probe'}
    try:
        with urllib.request.urlopen('https://ipinfo.io/org', timeout=10) as response:
            result['network'] = response.read().decode()[:80].strip()
    except OSError:
        result['network'] = None
    fastf1.set_auth_method('password')
    shared = not cloud.f1_login_ready()
    if shared:  # no F1 account on this computer: use the owner's shared login token
        try:
            import host_runner
            host_runner.fetch_shared_token()
        except Exception:
            pass
    if not cloud.f1_login_ready():
        auth, result['sign_in'] = None, 'shared_pending'
    else:
        try:
            auth = get_token().authorization_header
            result['sign_in'] = 'shared' if shared else 'ok'
        except Exception as exc:
            auth, result['sign_in'] = None, type(exc).__name__
    for name, method, path in CHECKS:
        result[name] = {'no_token': status(method, path), 'token': status(method, path, auth) if auth else None}
    print(json.dumps(result))
    cloud.run_log(result)
    return 0
