"""Read public Al Kamel files through the existing authenticated collector."""
import base64
import gzip
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, unquote, urljoin

import requests

MAX_BYTES = 12_000_000


def checked_url(value):
    u = urlsplit(value)
    path = unquote(u.path)
    if (u.scheme != 'https' or u.username or u.password or u.port not in (None, 443)
            or u.fragment or '\\' in path or '..' in path.split('/')):
        raise ValueError('Invalid Al Kamel URL')
    approved = (
        u.hostname == 'files.alkamelcloud.com'
        and re.fullmatch(r'/wec/(?:manifests/[^/]+\.json|results/.+\.(?:csv|pdf))', path, re.I)
    ) or (u.hostname == 'fiawec.alkamelsystems.com'
          and re.fullmatch(r'/Results/.+\.(?:csv|pdf)', path, re.I))
    if not approved:
        raise ValueError('Only public Al Kamel WEC files are supported')
    return value


def published_file(value):
    url = checked_url(value)
    for _ in range(5):
        with requests.get(url, stream=True, allow_redirects=False, timeout=(5, 10)) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                url = checked_url(urljoin(url, response.headers['Location']))
                continue
            response.raise_for_status()
            chunks, size = [], 0
            for part in response.iter_content(65536):
                size += len(part)
                if size > MAX_BYTES:
                    raise ValueError('Al Kamel file exceeds 12 MB')
                chunks.append(part)
            data = b''.join(chunks)
            if data.startswith(b'\x1f\x8b'):
                # Bound decompression of precompressed source objects too.
                import io
                with gzip.GzipFile(fileobj=io.BytesIO(data)) as compressed:
                    data = compressed.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise ValueError('Expanded Al Kamel file exceeds 12 MB')
            if re.match(br'\s*(?:<!doctype|<html)', data, re.I):
                raise ValueError('Al Kamel returned HTML instead of a published file')
            encoded = base64.b64encode(gzip.compress(data)).decode('ascii')
            if len(encoded) > 1_000_000:
                raise ValueError('Al Kamel file exceeds transport limit')
            return {'url': url, 'gzip_base64': encoded,
                    'retrieved_at': datetime.now(timezone.utc).isoformat(),
                    'last_modified': response.headers.get('Last-Modified'),
                    'etag': response.headers.get('ETag')}
    raise ValueError('Too many Al Kamel redirects')
