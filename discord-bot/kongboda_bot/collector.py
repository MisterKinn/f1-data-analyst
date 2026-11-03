"""Async client for the owner's collector. Read-only; never calls /poll or /stop."""
from __future__ import annotations

import aiohttp
import asyncio
from urllib.parse import urlencode


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
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            raise CollectorError('수집기 연결이 지연되거나 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.') from exc
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

    async def session_results(self, year: int, event: int, session: str) -> dict:
        if session not in ('FP1', 'FP2', 'FP3', 'Q', 'SQ', 'R', 'S') or not 2018 <= year <= 2100 or not 1 <= event <= 30:
            raise ValueError('Invalid session selection')
        path = '/session-results?' + urlencode({'year': year, 'event': event, 'session': session})
        for attempt in range(9):
            data = await self._get(path)
            if data.get('state') != 'pending' or attempt == 8:
                return data
            await asyncio.sleep(5)
        raise AssertionError('unreachable')

