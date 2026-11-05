"""Collector jobs a home host can run side by side (one per data source).

A job knows its own schedule, how to record one session window, how to tell whether its
recorder is receiving data, and what to publish after a session. host_runner runs every
job assigned to this computer in its own thread, with its own heartbeat ("baton") per
series, so a long F1 session never blocks another series and vice versa.

Adding a series (for example WEC):
  1. Subclass Job with series = 'wec' and implement windows(), record(), ready() and,
     if needed, post_session(). Keep its files under its own data folder.
  2. Register it in JOBS below.
  3. Add the series to KNOWN_SERIES in worker/collector-fleet.js, gate its upload
     endpoint with the baton (hostBatonGate), and switch it on per computer in
     Account settings > Collector hosts.
"""
import os
import time
from datetime import timedelta

import actions_runner as runner
import cloud

SCHEDULE_REFRESH = timedelta(hours=1)
HISTORY_RETRY_SECONDS = int(os.environ.get('HISTORY_RETRY_SECONDS', '600'))
READY_SECONDS = 60  # a snapshot newer than this, from a connected recorder, means data is flowing


class Job:
    series = ''
    label = ''

    def windows(self, state):
        """All known session windows: dicts with at least id, open and close (ISO)."""
        return []

    def record(self, window, gate, hold):
        """Record one window. Publish only while gate() is True; stay off the source while
        hold() is True. Return 'finished', 'already_done', 'login_failed' or 'closed'."""
        raise NotImplementedError

    def ready(self, window):
        """True while this computer receives live data for the window."""
        return False

    def post_session(self, windows):
        """Publish data after a session (only the lead host calls this)."""


class F1Job(Job):
    series = 'f1'
    label = 'F1'

    def windows(self, state):
        if state.get('schedule_at') is None or cloud.now() - state['schedule_at'] >= SCHEDULE_REFRESH:
            cloud.fetch_schedule()
            state['schedule_at'] = cloud.now()
        return cloud.read_json(cloud.DATA / 'schedule.json', {}).get('windows', [])

    def record(self, window, gate, hold):
        runner.record_window(window, gate=gate, hold=hold)
        return runner.LAST_RESULT.get(window['id'])

    def ready(self, window, now=None):
        path = cloud.DATA / 'snapshot.json'
        try:
            age = (now if now is not None else time.time()) - path.stat().st_mtime
        except OSError:
            return False
        snapshot = cloud.read_json(path, {}) or {}
        info = (snapshot.get('topics') or {}).get('SessionInfo') or {}
        # A recorder that joined mid-session first refills the laps it missed from F1's
        # official session stream (recovery.py). Until that finished it is not "ready", so
        # the baton is handed back only once its lap history is whole again.
        recovery = ((snapshot.get('lap_archive') or {}).get('recovery') or {}).get('state')
        return (age < READY_SECONDS and bool(snapshot.get('connected')) and cloud.session_matches(info, window)
                and recovery == 'complete')

    def post_session(self, windows):
        runner.post_session(windows, skip=recently_tried)


def recently_tried(window_id, now=None):
    last = runner.LAST_HISTORY_ATTEMPT.get(window_id)
    return last is not None and (now if now is not None else time.monotonic()) - last < HISTORY_RETRY_SECONDS


JOBS = {job.series: job for job in (F1Job(),)}
