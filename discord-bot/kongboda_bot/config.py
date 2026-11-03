"""Environment configuration. Secrets come only from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Config:
    discord_token: str
    owner_id: int
    guild_id: int | None
    alert_channel_id: int | None
    collector_url: str
    collector_key: str
    anthropic_key: str | None
    anthropic_model: str
    state_path: Path
    schedule_path: Path

    @property
    def ask_enabled(self) -> bool:
        return bool(self.anthropic_key)


def _int(name: str, required: bool = False) -> int | None:
    raw = os.environ.get(name, '').strip()
    if not raw:
        if required:
            raise ConfigError(f'{name} is required.')
        return None
    try:
        value = int(raw)
        if value <= 0:
            raise ValueError
        return value
    except ValueError as exc:
        raise ConfigError(f'{name} must be a numeric Discord ID.') from exc


def load(env: dict | None = None) -> Config:
    if env is not None:  # tests
        os.environ.update(env)
    token = os.environ.get('DISCORD_TOKEN', '').strip()
    if not token:
        raise ConfigError('DISCORD_TOKEN is required.')
    key = os.environ.get('COLLECTOR_READ_KEY', '').strip()
    if len(key) < 32:
        raise ConfigError('COLLECTOR_READ_KEY must contain at least 32 characters.')
    url = os.environ.get('COLLECTOR_URL', '').strip().rstrip('/')
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or parsed.path not in ('', '/')):
        raise ConfigError('COLLECTOR_URL must be a bare HTTPS origin without credentials, path, query or fragment.')
    base = Path(__file__).resolve().parent.parent
    return Config(
        discord_token=token,
        owner_id=_int('DISCORD_OWNER_ID', required=True),
        guild_id=_int('DISCORD_GUILD_ID'),
        alert_channel_id=_int('DISCORD_ALERT_CHANNEL_ID'),
        collector_url=url,
        collector_key=key,
        anthropic_key=os.environ.get('ANTHROPIC_API_KEY', '').strip() or None,
        anthropic_model=os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-5-5').strip(),
        state_path=Path(os.environ.get('BOT_STATE_PATH', str(base / 'state.json'))),
        schedule_path=Path(os.environ.get('BOT_SCHEDULE_PATH', str(base / 'schedule.json'))),
    )
