"""Public website API client. Collector credentials are never sent here."""
import asyncio
import aiohttp

from .collector import CollectorError

SERIES = ('f1', 'wec', 'imsa', 'formula-e', 'nls', 'elms', 'alms')


class Published:
    def __init__(self, base, session):
        self.base = base.rstrip('/')
        self.session = session

    async def standings(self, kind='drivers', series='f1', category=None):
        if series not in SERIES or kind not in ('drivers', 'constructors'):
            raise ValueError('Invalid championship')
        params = {'series': series, 'kind': kind}
        if category:
            params['category'] = category
        try:
            for attempt in range(4):
                async with self.session.get(self.base + '/api/championship-standings', params=params,
                                            allow_redirects=False, timeout=aiohttp.ClientTimeout(total=20)) as response:
                    if response.status not in (200, 202):
                        raise CollectorError(f'공식 챔피언십 순위 응답 오류 HTTP {response.status}')
                    data = await response.json()
                    if response.status == 200 or attempt == 3:
                        return data
                await asyncio.sleep(3)
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            raise CollectorError('공식 챔피언십 순위를 불러오지 못했습니다.') from exc


