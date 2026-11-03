"""Async client for the owner's collector. Read-only; never calls /poll or /stop."""
from __future__ import annotations

import aiohttp


class CollectorError(RuntimeError):
    pass


class Collector:
    def __init__(self, base_url: str, key: str, session: aiohttp.ClientSession | None = None):
        self.base = base_url.rstrip('/')
        self._headers = {'Authorization': f'Bearer {key}'}
        self._session = session

    async def _get(self, path: str) -> dict:
        session = self._session or aiohttp.ClientSession()
        try:
            async with session.get(self.base + path, headers=self._headers,
                                   timeout=aiohttp.ClientTimeout(total=20)) as r:
                if r.status == 401:
                    raise CollectorError('수집기 읽기 키가 거부되었습니다.')
                if r.status >= 400:
                    raise CollectorError(f'수집기 응답 오류 HTTP {r.status}')
                return await r.json()
        except aiohttp.ClientError as exc:
            raise CollectorError('수집기에 연결하지 못했습니다. 무료 호스트가 잠들어 있을 수 있습니다.') from exc
        finally:
            if self._session is None:
                await session.close()

    async def snapshot(self) -> dict:
        return await self._get('/snapshot')

    async def standings(self, kind: str) -> dict:
        if kind not in ('drivers', 'constructors'):
            raise ValueError('kind must be drivers or constructors')
        return await self._get(f'/championship/{kind}')

    async def wec_snapshot(self) -> dict:
        return await self._get('/wec/snapshot')
