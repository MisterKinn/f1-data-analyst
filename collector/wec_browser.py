"""FIAWEC+ UI discovery. Never guess a timing endpoint or export auth state."""
import os
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit

HOME = 'https://plus.fiawec.com/en'
AUTH_HOST = 'auth.staylive.io'
TIMING_HOSTS = {'plus.fiawec.com', 'fiawec.alkamelsystems.com'}
SESSIONS = ('auto', 'FP1', 'FP2', 'FP3', 'Qualifying', 'Hyperpole', 'Race')


class DiscoveryError(Exception):
    def __init__(self, code, detail=None):
        self.code = code
        self.detail = detail  # gate phrase, host and page title only; never page body or URLs
        super().__init__(code)  # No provider errors, credentials or signed URLs.


def gate_detail(phrase, url, title):
    """Enough to tell a real bot check from a harmless 'protected by reCAPTCHA' notice."""
    host = urlsplit(url).hostname or ''
    title = re.sub(r'[^\w .:|-]', '', title or '')[:60]
    return '%s @ %s · %s' % (phrase.lower()[:30], host[:60], title)


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def checked_url(value, base=HOME, hosts=None):
    url = urljoin(base, value)
    u = urlsplit(url)
    if (u.scheme != 'https' or u.username or u.password or u.port not in (None, 443)
            or u.hostname not in (hosts or TIMING_HOSTS) or '\\' in value):
        raise DiscoveryError('unapproved_destination')
    return url


def public_url(value):
    """Do not reconstruct a signed URL without its query: withhold it entirely."""
    u = urlsplit(checked_url(value))
    if u.query or u.fragment or re.search(r'/(?:token|auth|callback)/', u.path, re.I):
        return None
    return value


def session_name(text):
    for number in (1, 2, 3):
        if re.search(rf'\b(?:free\s+practice|practice|fp)[\s_-]*{number}\b', text, re.I):
            return f'FP{number}'
    for name in ('Hyperpole', 'Qualifying', 'Race'):
        if re.search(rf'\b{name}\b', text, re.I):
            return name
    return None


def select_session(cards, year, session='auto', event=None, upcoming=False):
    """Current year + positive card-specific live badge; never a replay/duration.
    upcoming=True (a scheduled window for one named session) also accepts that session's
    card before its LIVE badge appears; the livestream page then shows a countdown."""
    candidates = {}
    for card in cards:
        text = card.get('text', '') + ' ' + card.get('url', '')
        years = set(re.findall(r'\b20\d{2}\b', text.replace('-', ' ')))
        if years and years != {str(year)}:
            continue
        if event and event not in re.sub(r'[^a-z0-9]', '', text.lower()):
            continue
        if re.search(r'replay|highlights|full\s+race|on\s*demand', text, re.I):
            continue
        name = session_name(text.replace('-', ' '))
        if not name or (session != 'auto' and name != session):
            continue
        # "Live Timing Pro" in marketing copy is not a session status.
        if not card.get('live') and not (upcoming and session != 'auto'):
            continue
        url = checked_url(card['url'], hosts={'plus.fiawec.com'})
        if not re.match(r'^/en/(?:video|live|livestream|session)/[^/]+/?$', urlsplit(url).path):
            continue
        # Prefer the English card; preserve distinct sessions as ambiguity.
        if name not in candidates or card.get('live') and not candidates[name].get('live') or re.search(r'\benglish\b', text, re.I):
            candidates[name] = {**card, 'url': url, 'session': name}
    if len(candidates) > 1:
        raise DiscoveryError('ambiguous_live_session')
    return next(iter(candidates.values()), None)


def request_target(raw):
    if not isinstance(raw, dict) or set(raw) - {'event', 'session', 'year'}:
        raise DiscoveryError('invalid_target')
    event = raw.get('event', '')
    session = raw.get('session', 'auto')
    year = raw.get('year', datetime.now(timezone.utc).year)
    if (not isinstance(event, str) or not 2 <= len(event.strip()) <= 100
            or any(c in event for c in '/\\?&#<>\n\r') or session not in SESSIONS
            or type(year) is not int or not 2020 <= year <= 2100):
        raise DiscoveryError('invalid_target')
    return {'event': event.strip(), 'session': session, 'year': year}


def normalize_table(headers, rows):
    if not headers or len(headers) > 40 or len(rows) > 150:
        return []
    labels = [re.sub(r'\s+', ' ', str(s)).strip()[:80] for s in headers]
    # Only a timing table, never an account/profile table.
    joined = ' '.join(labels).lower()
    if not re.search(r'lap|sector|gap|interval|time', joined) or not re.search(r'driver|car|team|no\.|number', joined):
        return []
    if re.search(r'password|email|token|cookie|secret', joined):
        return []
    if len(set(labels)) != len(labels) or any(not s for s in labels):
        return []
    return [dict(zip(labels, [str(v)[:200] for v in row])) for row in rows if len(row) == len(labels)][:100]


def owner_credentials():
    """The operator's FIAWEC+ account (crew collection). Never used for a personal login."""
    return (os.environ.get('WEC_USERNAME') or os.environ.get('WEC_EMAIL') or os.environ.get('FIAWEC_USERNAME'),
            os.environ.get('WEC_PASSWORD') or os.environ.get('FIAWEC_PASSWORD'))


class FIAWECBrowser:
    """Small explicit browser path, with an in-memory cookie jar only."""
    def __init__(self, browser, credentials=None):
        # A personal session passes its own (username, password); crew uses the owner's.
        self.credentials = credentials
        self.context = browser.new_context(accept_downloads=False)
        self.context.set_default_timeout(12000)
        self.page = self.context.new_page()
        self.context.route('**/*', self._guard)

    def _guard(self, route):
        req = route.request
        # No video download: timing only. Keep other resources for the normal UI.
        if req.resource_type == 'media' or re.search(r'\.(m3u8|mpd|ts|m4s)(?:\?|$)', req.url):
            return route.abort()
        if req.is_navigation_request():
            host = urlsplit(req.url).hostname
            # External ads/clock frames are unnecessary; auth stays on the provider.
            if host not in TIMING_HOSTS | {AUTH_HOST}:
                return route.abort()
        return route.continue_()

    def check_gate(self, strict=False):
        """Stop on a real bot wall. The FIAWEC login page itself mentions 'captcha' (a widget
        shown only when needed), so that word alone stops a run only after a step failed."""
        text = self.page.locator('body').inner_text(timeout=12000)[:30000]
        pattern = r'verify you are human|checking your browser|unusual traffic|access denied' + (r'|captcha' if strict else '')
        found = re.search(pattern, text, re.I)
        if found:
            raise DiscoveryError('human_verification_required', gate_detail(found.group(0), self.page.url, self.page.title()))
        if re.search(r'incorrect password|wrong email|invalid credentials', text, re.I):
            raise DiscoveryError('authentication_failed')
        return text

    def goto(self, url):
        checked_url(url, hosts=TIMING_HOSTS | {AUTH_HOST})
        self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
        self.page.locator('body').wait_for(state='visible')
        # Wait for app rendering, not a fixed sleep or network-idle video stream.
        self.page.locator('a,button,input').first.wait_for(state='visible')
        self.check_gate()

    def authenticate(self):
        self.goto(HOME)
        self.page.locator('[id^="headlessui-menu-button-"],a[href*="/login"]').first.wait_for(state='visible')
        login = self.page.locator('a[href*="/login"]')
        if not login.count():
            # Only an actual account menu is a positive login signal.
            if self.page.locator('[id^="headlessui-menu-button-"]').count():
                return
            raise DiscoveryError('authentication_unverified')
        username, password = self.credentials or owner_credentials()
        if not username or not password:
            raise DiscoveryError('credentials_required')
        login.first.click()
        self.page.get_by_role('button', name=re.compile(r'^Sign in\b')).click()
        self.page.wait_for_url('https://auth.staylive.io/**')
        self.check_gate()
        email = self.page.locator('input[name="username"][type="email"]')
        email.wait_for(state='visible')
        if urlsplit(self.page.url).hostname != AUTH_HOST:
            raise DiscoveryError('unapproved_destination')
        email.fill(username)
        self.page.get_by_role('button', name='Continue', exact=True).click()
        field = self.page.locator('input[name="password"][type="password"]')
        try:
            field.wait_for(state='visible')
        except Exception:
            self.check_gate(strict=True)
            raise DiscoveryError('authentication_action_required') from None
        if urlsplit(self.page.url).hostname != AUTH_HOST:
            raise DiscoveryError('unapproved_destination')
        field.fill(password)
        self.page.get_by_role('button', name='Continue', exact=True).click()
        try:
            self.page.wait_for_url('https://plus.fiawec.com/**', timeout=25000)
            self.page.locator('[id^="headlessui-menu-button-"]').wait_for(state='visible')
        except Exception:
            self.check_gate(strict=True)
            raise DiscoveryError('authentication_action_required') from None
        self.check_gate()

    def next_session_cards(self):
        """The FIA WEC home page's NEXT SESSIONS cards (recorded flow), each with its own
        LIVE badge. Other series (ELMS etc.) are filtered by the event name later."""
        self.goto(HOME)
        heading = self.page.get_by_text(re.compile(r'^\s*next\s+sessions\s*$', re.I)).first
        try:
            heading.wait_for(state='visible')
        except Exception:
            return []
        return heading.evaluate('''h => {
          let box = h; for (let i = 0; i < 6 && box && !box.querySelector('a[href]'); i++) box = box.parentElement;
          if (!box) return [];
          return [...box.querySelectorAll('a[href]')].map(a => ({url: a.href, text: a.innerText,
            live: [...a.querySelectorAll('*')].some(e => /^(live|live now)$/i.test(e.textContent.trim()))}));
        }''')

    def race_links(self):
        self.goto(HOME)
        self.page.locator('a[href*="/race/"]').first.wait_for(state='attached')
        return self.page.locator('a[href*="/race/"]').evaluate_all('els => els.map(a => ({url:a.href,text:a.innerText}))')

    def session_cards(self, race_url):
        self.goto(race_url)
        self.page.get_by_role('tab', name='ENGLISH', exact=True).wait_for(state='visible')
        cards = []
        for _ in range(5):
            # Race pages currently render English session cards, with historical
            # replays elsewhere. Badge text is taken from each card only.
            self.page.wait_for_function("() => document.querySelector('a[href*=\"/video/\"],a[href*=\"/live/\"]') || document.body.innerText.includes('Sorry! There is no content to show.')", timeout=12000)
            found = self.page.locator('a[href*="/video/"],a[href*="/live/"]').evaluate_all('''els => els.map(a => ({url:a.href,text:a.innerText,
              live:[...a.querySelectorAll('*')].some(e => /^(live|live now)$/i.test(e.textContent.trim()))}))''')
            cards.extend(found)
            nxt = self.page.get_by_role('button', name='Next page', exact=True)
            if not found or not nxt.count() or not nxt.is_enabled():
                break
            before = [x['url'] for x in found]
            nxt.click()
            try:
                self.page.wait_for_function("old => [...document.querySelectorAll('a[href*=\"/video/\"],a[href*=\"/live/\"]')].some(a=>!old.includes(a.href))", arg=before, timeout=5000)
            except Exception:
                break
        return cards

    def open_timing(self, watch_url):
        self.goto(watch_url)
        pattern = re.compile(r'^(?:live\s*timing(?:\s*(?:pro|only))?|timing\s*only)$', re.I)
        control = self.page.get_by_role('link', name=pattern).or_(self.page.get_by_role('button', name=pattern))
        try:
            control.first.wait_for(state='visible')
        except Exception:
            text = self.check_gate()
            if re.search(r'subscribe|buy.*pass|get access|log in|sign in', text, re.I):
                raise DiscoveryError('subscription_or_login_required') from None
            raise DiscoveryError('timing_link_unavailable') from None
        # Handles anchors, same-tab JS buttons, popups and embedded timing frames.
        href = control.first.get_attribute('href')
        if href:
            self.goto(checked_url(href, self.page.url))
        else:
            pages = set(self.context.pages)
            control.first.click()
            self.page.wait_for_timeout(700)
            new = [p for p in self.context.pages if p not in pages]
            if new:
                self.page = new[-1]
                self.page.wait_for_load_state('domcontentloaded', timeout=15000)
            checked_url(self.page.url)
            self.check_gate()
        # Only timing-labelled/URL frames; never an arbitrary advertising iframe.
        frames = self.page.locator('iframe').evaluate_all('els => els.map(e=>({url:e.src,title:e.title}))')
        for frame in frames:
            if re.search(r'timing', frame['title'] + ' ' + frame['url'], re.I):
                url = checked_url(frame['url'], self.page.url)
                self.goto(url)
                break
        return self.page.url

    def waiting_for_start(self):
        text = self.check_gate()
        return bool(re.search(r'\bto start\b|syncing live timeline', text, re.I))

    def read_rows(self):
        self.check_gate()
        for frame in self.page.frames:
            if frame.url == 'about:blank':
                continue
            try:
                checked_url(frame.url)
            except DiscoveryError:
                continue
            tables = frame.locator('table,[role="table"],[role="grid"]').evaluate_all('''els=>els.map(t=>({
              headers:[...t.querySelectorAll('thead th,[role="columnheader"]')].map(x=>x.innerText.trim()),
              rows:[...t.querySelectorAll('tbody tr,[role="row"]')].map(r=>[...r.querySelectorAll('td,[role="cell"],[role="gridcell"]')].map(c=>c.innerText.trim()))
            }))''')
            for table in tables:
                rows = normalize_table(table['headers'], table['rows'])
                if rows:
                    return rows
        return []

    def close(self):
        self.context.close()


def discover(driver, target, upcoming=False):
    target = request_target(target)
    driver.authenticate()
    event = re.sub(r'[^a-z0-9]', '', target['event'].lower())
    selected = select_session(driver.next_session_cards(), target['year'], target['session'], event, upcoming)
    if selected:
        result = {'schema_version': 1, 'producer': 'fiawec-browser', 'target': target,
                  'checked_at': utcnow(), 'auth_state': 'authenticated', 'race_url': None,
                  'live': False, 'records': [], 'state': 'waiting_for_session'}
        return open_session(driver, result, selected)
    choices = {}
    for item in driver.race_links():
        url = checked_url(item['url'], hosts={'plus.fiawec.com'})
        if not re.match(r'^/en/race/[^/]+/?$', urlsplit(url).path):
            continue
        label = re.sub(r'[^a-z0-9]', '', (urlsplit(url).path.rsplit('/', 1)[-1] + ' ' + item['text']).lower())
        if event and event in label:
            choices[url] = item
    if not choices:
        raise DiscoveryError('event_not_found')
    if len(choices) != 1:
        raise DiscoveryError('ambiguous_event')
    race_url = next(iter(choices))
    result = {'schema_version': 1, 'producer': 'fiawec-browser', 'target': target,
              'checked_at': utcnow(), 'auth_state': 'authenticated',
              'race_url': public_url(race_url), 'session_url': None, 'timing_url': None,
              'live': False, 'records': [], 'state': 'waiting_for_session'}
    selected = select_session(driver.session_cards(race_url), target['year'], target['session'], None, upcoming)
    if not selected:
        return result
    return open_session(driver, result, selected)


def open_session(driver, result, selected):
    result.update(session=selected['session'], session_url=public_url(selected['url']))
    timing = driver.open_timing(selected['url'])
    result.update(state='timing_opened', timing_url=public_url(timing),
                  private_timing_link=public_url(timing) is None,
                  timing_origin='https://' + urlsplit(checked_url(timing)).hostname)
    rows = driver.read_rows()
    waiting = not rows and driver.waiting_for_start()
    result.update(records=rows, state='snapshot_unverified' if rows else 'timing_waiting_start' if waiting else 'timing_layout_unverified')
    # A link, login or one table observation never proves a changing live feed.
    return result
