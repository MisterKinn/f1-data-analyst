"""Session schedule loaded from schedule.json (generated from worker/session-schedule.js)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))

SERIES_LABELS = {
    'f1': 'F1', 'gtwc-asia': 'GTWC Asia', 'nascar': 'NASCAR', '24h-series': '24H Series',
    'super-taikyu': 'Super Taikyu', 'wrc': 'WRC', 'wec': 'WEC', 'imsa': 'IMSA',
}


@dataclass(frozen=True)
class Session:
    event_key: str
    series: str
    name: str
    start: datetime
    source: str

    @property
    def uid(self) -> str:
        return f'{self.event_key}|{self.name}|{self.start.isoformat()}'

    @property
    def series_label(self) -> str:
        return SERIES_LABELS.get(self.series, self.series)


def series_of(event_key: str) -> str:
    for prefix in sorted(SERIES_LABELS, key=len, reverse=True):
        if event_key.startswith(prefix + '-'):
            return prefix
    return event_key.split('-')[0]


def load(path: Path) -> list[Session]:
    if not path.exists():
        raise FileNotFoundError(
            f'{path} not found. Run `node discord-bot/export_schedule.mjs` first.')
    data = json.loads(path.read_text(encoding='utf-8'))
    sessions = []
    for key, rows in data.items():
        for row in rows:
            sessions.append(Session(key, series_of(key), row['name'],
                                    datetime.fromisoformat(row['start']), row.get('source', '')))
    return sorted(sessions, key=lambda s: s.start)


def upcoming(sessions, now: datetime, within: timedelta, series: str | None = None):
    end = now + within
    return [s for s in sessions if now <= s.start <= end and (not series or s.series == series)]


def format_kst(moment: datetime) -> str:
    local = moment.astimezone(KST)
    return local.strftime('%m/%d(%a) %H:%M KST')
