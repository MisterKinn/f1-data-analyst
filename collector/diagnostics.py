"""Credential-free CPU/callback history. Never logs packet bodies or account data."""
import copy
import json
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path


def cgroup_cpu(root=Path('/sys/fs/cgroup')):
    """cgroup v2 counters; null on unsupported hosts rather than host-CPU guesses."""
    try:
        quota, period = (root / 'cpu.max').read_text().split()
        stats = dict(line.split() for line in (root / 'cpu.stat').read_text().splitlines())
        return (None if quota == 'max' else int(quota) / int(period),
                int(stats['usage_usec']) / 1e6, int(stats.get('throttled_usec', 0)) / 1e6)
    except (OSError, ValueError, KeyError, ZeroDivisionError):
        return None, None, None


def rss_bytes():
    try:
        for line in Path('/proc/self/status').read_text().splitlines():
            if line.startswith('VmRSS:'):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError):
        pass
    return None


class PerformanceRecorder:
    interval = 10

    def __init__(self, directory, session_key, run_id):
        self.session_key, self.run_id = session_key, run_id
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / f'{session_key}-{run_id}.jsonl'
        self.samples = deque(maxlen=720)  # Two hours per run in uploaded history.
        self.lock = threading.Lock()
        self.done = threading.Event()
        self.thread = None
        self.previous = (time.monotonic(), time.process_time(), cgroup_cpu())
        self.count = self.total_ms = self.max_ms = 0
        self.lags = {'TimingData': None, 'clock': None}
        self.out_of_order = self.write_errors = 0
        self.persistence_errors = 0
        self.sequence = 0

    def observe(self, topic, source_time, entered_wall, duration_ms):
        with self.lock:
            self.count += 1
            self.total_ms += duration_ms
            self.max_ms = max(self.max_ms, duration_ms)
            if topic not in ('TimingData', 'Heartbeat', 'ExtrapolatedClock'):
                return
            try:
                stamp = datetime.fromisoformat(source_time.replace('Z', '+00:00'))
                if stamp.tzinfo is None:
                    raise ValueError('Missing timezone')
                self.lags['TimingData' if topic == 'TimingData' else 'clock'] = entered_wall - stamp.timestamp()
            except (ValueError, TypeError, AttributeError):
                self.lags['TimingData' if topic == 'TimingData' else 'clock'] = None

    def sample(self):
        mono, cpu, group = time.monotonic(), time.process_time(), cgroup_cpu()
        before, prior_cpu, prior_group = self.previous
        elapsed = mono - before
        if elapsed <= 0:
            return None
        quota, usage, throttled = group
        _, old_usage, old_throttled = prior_group
        with self.lock:
            self.sequence += 1
            row = {'sequence': self.sequence, 'at': datetime.now(timezone.utc).isoformat(),
                   'process_cpu_percent_one_core': round(max(0, cpu - prior_cpu) / elapsed * 100, 3),
                   'cgroup_cpu_percent_of_quota': round(max(0, usage - old_usage) / elapsed / quota * 100, 3) if quota and usage is not None and old_usage is not None else None,
                   'cpu_quota_cores': quota,
                   'cgroup_throttled_seconds': max(0, throttled - old_throttled) if throttled is not None and old_throttled is not None else None,
                   'rss_bytes': rss_bytes(), 'callback_count': self.count,
                   'callback_mean_ms': round(self.total_ms / self.count, 3) if self.count else None,
                   'callback_max_ms': round(self.max_ms, 3) if self.count else None,
                   'timing_source_lag_seconds': self.lags['TimingData'],
                   'clock_source_lag_seconds': self.lags['clock'],
                   'out_of_order_packets': self.out_of_order, 'telemetry_write_errors': self.write_errors,
                   'diagnostics_write_errors': self.persistence_errors}
            self.samples.append(row)
            self.count = self.total_ms = self.max_ms = 0
        self.previous = (mono, cpu, group)
        try:
            with self.path.open('a', encoding='utf-8') as handle:
                handle.write(json.dumps(row, allow_nan=False) + '\n')
        except (OSError, ValueError):
            self.persistence_errors += 1
        return row

    def start(self):
        def run():
            while not self.done.wait(self.interval):
                self.sample()
        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def close(self):
        self.done.set()
        if self.thread:
            self.thread.join(timeout=2)
            if self.thread.is_alive():
                return
        self.sample()

    def snapshot(self):
        with self.lock:
            return {'version': 1, 'session_key': self.session_key, 'run_id': self.run_id,
                    'interval_seconds': self.interval, 'samples': copy.deepcopy(list(self.samples))}
