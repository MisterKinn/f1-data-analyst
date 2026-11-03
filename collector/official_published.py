"""Bounded, read-only transport for approved public championship sources."""
import base64
import gzip
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, unquote, urljoin, parse_qs
import requests
import threading
import time
_CACHE = {}
_LOCKS = {}
_LOCK = threading.Lock()

def checked_url(value):
    u = urlsplit(value)
    p = unquote(u.path)
    if u.scheme != 'https' or u.username or u.password or u.port not in (None, 443) or u.fragment or '\\' in p or '..' in p.split('/'):
        raise ValueError('Invalid official source')
    allowed = (
        u.hostname in ('lemanscup.alkamelsystems.com', 'elms.alkamelsystems.com', 'imsa.results.alkamelcloud.com') and
        (p in ('/', '/index.php') or re.fullmatch(r'/Results/.+\.(pdf|csv|json)', p, re.I))
    ) or (
        u.hostname == 'files.alkamelcloud.com' and re.fullmatch(r'/alms/(manifests/[^/]+\.json|results/.+\.(csv|pdf))', p, re.I)
    ) or (
        u.hostname == 'results.formulae.fia.com' and re.fullmatch(r'/api/getfile/formula-e/files/results/.+\.(csv|pdf)', p, re.I)
    ) or (
        u.hostname in ('d112sbqg9gqc2x.cloudfront.net', 'fia-formula-e-docs-620435595252.s3.eu-central-1.amazonaws.com') and re.fullmatch(r'/formula-e/files/results/.+\.(json|csv|pdf)', p, re.I)
    ) or (
        u.hostname == 'teilnehmer.vln.de' and (p in ('/', '/onb.php') or p == '/download.php' and re.fullmatch(r'onb/\d{4}-\d{2}-\d{2}/[^/]+\.(pdf|csv)', parse_qs(u.query).get('file', [''])[0], re.I))
    ) or (
        u.hostname == 'www.fia.com' and re.fullmatch(r'/events/abb-fia-formula-e-world-championship/season-\d{4}-\d{4}/standings', p)
    ) or (
        u.hostname == 'www.nuerburgring-langstrecken-serie.de' and
        (p == '/language/en/point-standings/' or re.fullmatch(r'/wp-content/uploads/\d{4}/\d{2}/[^/]+\.pdf', p, re.I))
    )
    if not allowed:
        raise ValueError('Unapproved official source')
    return value

def _fetch(value):
    url = checked_url(value)
    for _ in range(4):
        with requests.get(url, stream=True, allow_redirects=False, timeout=(5, 12)) as r:
            if r.status_code in (301, 302, 303, 307, 308):
                url = checked_url(urljoin(url, r.headers['Location']))
                continue
            r.raise_for_status()
            chunks, size = [], 0
            for part in r.iter_content(65536):
                size += len(part)
                if size > 12_000_000:
                    raise ValueError('Official source too large')
                chunks.append(part)
            data = b''.join(chunks)
            if data.startswith(b'\x1f\x8b'):
                import io
                with gzip.GzipFile(fileobj=io.BytesIO(data)) as f:
                    data = f.read(12_000_001)
                if len(data) > 12_000_000:
                    raise ValueError('Expanded official source too large')
            packed = base64.b64encode(gzip.compress(data)).decode('ascii')
            if len(packed) > 4_000_000:
                raise ValueError('Official source transport too large')
            return {'url': value, 'gzip_base64': packed, 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'last_modified': r.headers.get('Last-Modified'), 'etag': r.headers.get('ETag')}
    raise ValueError('Too many redirects')


def published_file(value):
    url = checked_url(value)
    with _LOCK:
        lock = _LOCKS.setdefault(url, threading.Lock())
    with lock:
        cached = _CACHE.get(url)
        if cached and time.monotonic() - cached[0] < 300:
            return cached[1]
        for attempt in range(2):
            try:
                result = _fetch(url)
                with _LOCK:
                    if len(_CACHE) > 128:
                        _CACHE.clear()
                    _CACHE[url] = (time.monotonic(), result)
                return result
            except requests.RequestException:
                if attempt:
                    raise
