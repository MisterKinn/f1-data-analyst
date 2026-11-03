"""Small atomic JSON store used to suppress duplicate notifications across restarts."""
from __future__ import annotations

import json
import os
from pathlib import Path


class State:
    def __init__(self, path: Path):
        self.path = path
        try:
            self.data = json.loads(path.read_text(encoding='utf-8'))
        except (FileNotFoundError, ValueError):
            self.data = {}

    def seen(self, bucket: str, key: str) -> bool:
        return key in self.data.get(bucket, {})

    def initialized(self, bucket: str) -> bool:
        """Whether a watcher has already established its initial baseline."""
        return bool(self.data.get('_initialized', {}).get(bucket))

    def initialize(self, bucket: str) -> None:
        self.data.setdefault('_initialized', {})[bucket] = True
        self._save()

    def mark(self, bucket: str, key: str, value=True, keep: int = 500) -> None:
        items = self.data.setdefault(bucket, {})
        items[key] = value
        while len(items) > keep:
            items.pop(next(iter(items)))
        self._save()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.data, ensure_ascii=False), encoding='utf-8')
        os.replace(tmp, self.path)
