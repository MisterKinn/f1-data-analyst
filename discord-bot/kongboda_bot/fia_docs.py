"""FIA document watcher: discovery, relevance selection (AGENTS.md scope), dedup and alert text.

Alerts are written only after the official PDF text was actually read. If the body cannot be read
(network error, scanned PDF) the alert says so instead of guessing its contents.
"""
from __future__ import annotations

import html
import io
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit

import aiohttp

ROOT = 'https://www.fia.com/documents/championships/fia-formula-one-world-championship-14'
ALLOWED_HOSTS = {'www.fia.com', 'fia.com', 'api.fia.com'}
MAX_BYTES = 12_000_000

# (reason shown to the owner, title regex, optional body regex that confirms the category)
CATEGORIES = [
    ('트랙 변경·노면·런오프', re.compile(r'resurfac|track (?:layout|change)|kerb|run-?off|circuit map', re.I), None),
    ('레이스 디렉터 지시', re.compile(r'race director|event notes|track limits|pit (?:entry|exit)', re.I), None),
    ('부품 교체·그리드 영향', re.compile(r'power unit|\bpu\b|gearbox|exhaust|component|grid penalt', re.I),
     re.compile(r'penalt|replace|new element|exceed|allocation|usage', re.I)),
    ('팀 업그레이드·기술 변경', re.compile(r'car presentation|presentation submissions|upgrade|technical directive', re.I),
     re.compile(r'upgrade|updated|new (?:floor|wing|front|rear)|modif', re.I)),
    ('스튜어드 결정', re.compile(r'decision|infringement|summons|penalty|disqualif|reprimand|hearing|appeal|right of review', re.I), None),
    ('피렐리 타이어·전략', re.compile(r'pirelli|tyre|strategy', re.I), None),
]
EXCLUDE = re.compile(r'timetable|schedule|visa|accreditation|scrutineering complete|media|parking', re.I)


@dataclass(frozen=True)
class Doc:
    title: str
    url: str
    published: str | None
    number: str | None
    recalled: bool

    @property
    def uid(self) -> str:
        return f'{self.url}|{self.published or ""}'


def official_url(value: str, base: str = 'https://www.fia.com') -> str:
    u = urlsplit(urljoin(base, value))
    if u.scheme != 'https' or u.hostname not in ALLOWED_HOSTS or u.username or u.password or (u.port not in (None, 443)):
        raise ValueError('Only official FIA HTTPS URLs are supported.')
    return u.geturl()


def _text(fragment: str) -> str:
    fragment = re.sub(r'<script\b[^>]*>[\s\S]*?</script>|<style\b[^>]*>[\s\S]*?</style>', '', fragment, flags=re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', fragment))).strip()


def _field(block: str, name: str) -> str:
    m = re.search(rf'<div[^>]+class=["\'][^"\']*\b{name}\b[^"\']*["\'][^>]*>([\s\S]*?)</div>', block, re.I)
    return _text(m.group(1)) if m else ''


def parse_documents(page_html: str, base: str) -> list[Doc]:
    docs = []
    for m in re.finditer(r'<li\b[^>]*class=["\'][^"\']*\bdocument-row\b[^"\']*["\'][^>]*>([\s\S]*?)</li>', page_html, re.I):
        body = m.group(1)
        title = _field(body, 'title') or _text(body)
        link = re.search(r'<a\b[^>]*href=["\']([^"\']+)["\']', body, re.I)
        if not link:
            continue
        try:
            url = official_url(html.unescape(link.group(1)), base)
        except ValueError:
            continue
        number = re.search(r'\bDoc\s*(\d+)', title, re.I)
        docs.append(Doc(title, url, _field(body, 'published') or None,
                        number.group(1) if number else None, bool(re.search('recall', title, re.I))))
    return docs


def select_reason(doc: Doc, body_text: str | None = None) -> str | None:
    """Return why this document is worth an alert, or None. Title alone never confirms PU/upgrade usage."""
    if doc.recalled or EXCLUDE.search(doc.title):
        return None
    for reason, title_re, body_re in CATEGORIES:
        if not title_re.search(doc.title):
            continue
        if body_re is not None:
            if body_text is None or not body_re.search(body_text):
                continue
        return reason
    return None


async def _fetch(session: aiohttp.ClientSession, url: str) -> tuple[bytes, str]:
    url = official_url(url)
    for _ in range(5):
        async with session.get(url, allow_redirects=False, timeout=aiohttp.ClientTimeout(total=25),
                               headers={'Accept': 'text/html, application/pdf'}) as r:
            if r.status in (301, 302, 303, 307, 308):
                url = official_url(r.headers.get('Location', ''), url)
                continue
            if r.status >= 400:
                raise RuntimeError(f'FIA HTTP {r.status}: 소스 접근 실패이며 문서가 없다는 뜻이 아닙니다.')
            data = await r.content.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise RuntimeError('FIA 문서가 12 MB를 넘습니다.')
            return data, r.headers.get('Content-Type', '')
    raise RuntimeError('FIA 리다이렉트가 너무 많습니다.')


def pdf_text(data: bytes, max_pages: int = 6) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return '\n'.join((reader.pages[i].extract_text() or '') for i in range(min(len(reader.pages), max_pages)))


async def latest_event_documents(session: aiohttp.ClientSession, year: int, event: str | None = None) -> tuple[str, list[Doc]]:
    data, _ = await _fetch(session, ROOT)
    root = data.decode('utf-8', 'replace')
    seasons = {m.group(2).strip(): official_url(html.unescape(m.group(1)), ROOT)
               for m in re.finditer(r'<option\b[^>]*value=["\']([^"\']+)["\'][^>]*>([^<]+)</option>', root, re.I)}
    season_url = seasons.get(f'SEASON {year}')
    if not season_url:
        raise RuntimeError('FIA 아카이브에 해당 시즌이 아직 없습니다.')
    season_html = (await _fetch(session, season_url))[0].decode('utf-8', 'replace')
    events = [(_text(m.group(2)), official_url(html.unescape(m.group(1)), season_url))
              for m in re.finditer(r'<option\b[^>]*value=["\']([^"\']+)["\'][^>]*>([^<]+)</option>', season_html, re.I)
              if re.search(r'Grand Prix', m.group(2), re.I)]
    if not events:
        raise RuntimeError('FIA 이벤트 목록을 해석하지 못했습니다. 마크업이 바뀌었을 수 있습니다.')
    if event:
        events = [e for e in events if e[0].lower() == event.lower()] or events
    name, url = events[0]
    page = (await _fetch(session, url))[0].decode('utf-8', 'replace')
    docs = parse_documents(page, url)
    if not docs:
        raise RuntimeError('FIA 문서 목록이 비어 있거나 마크업이 바뀌었습니다.')
    return name, docs


async def check_new(session: aiohttp.ClientSession, state, year: int, event: str | None = None):
    """Yield (doc, reason, body_read, excerpt, timing) for unseen relevant documents.

    FIA's listing timestamp has no reliable timezone marker, so it is retained as
    published_raw rather than converted with a guessed offset. All pipeline times
    measured by this service are UTC ISO-8601 values.
    """
    _, docs = await latest_event_documents(session, year, event)
    detected_at = datetime.now(timezone.utc).isoformat()
    if not state.initialized('fia'):
        # A first start must not dump an event's already-published documents as new alerts.
        # Establish the baseline only after the official list was read successfully.
        for doc in docs:
            state.mark('fia', doc.uid)
        state.initialize('fia')
        return
    for doc in docs:
        if state.seen('fia', doc.uid):
            continue
        if select_reason(doc) is None and not any(t.search(doc.title) and b for _, t, b in CATEGORIES):
            state.mark('fia', doc.uid)  # irrelevant by title: never alert, never re-check
            continue
        body = None
        try:
            data, ctype = await _fetch(session, doc.url)
            if data[:5] == b'%PDF-':
                body = pdf_text(data)
        except Exception:
            body = None
        reason = select_reason(doc, body)
        if reason is None:
            if body is not None:
                state.mark('fia', doc.uid)  # body read and not meaningful
            continue
        body_read = bool(body and body.strip())
        yield doc, reason, body_read, (body or '')[:3500], {
            'published_raw': doc.published,
            'published_timezone': 'unspecified_by_fia_listing',
            'detected_at': detected_at,
            'body_read_at': datetime.now(timezone.utc).isoformat() if body_read else None,
        }


def alert_text(doc: Doc, reason: str, body_read: bool, summary: str | None) -> str:
    head = f'📄 **FIA 문서** — {doc.title}'
    meta = f'선정 이유: {reason}' + (f' · 발행 {doc.published}' if doc.published else '')
    if not body_read:
        note = '본문을 읽지 못했습니다(스캔본이거나 접근 실패). 내용은 원문에서 직접 확인하세요.'
    elif summary:
        note = summary
    else:
        note = '본문은 읽었으나 요약 모델이 설정되지 않아 요약 없이 링크만 전달합니다.'
    return f'{head}\n{meta}\n{note}\n원문: {doc.url}'
