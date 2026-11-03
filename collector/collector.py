"""FastF1 recorder + explicitly separate live patch-state adapter.

F1 authentication stays on this computer. Only allowlisted timing topics are
written to snapshot.json for the owner's authenticated upload page.
"""
import argparse
import base64
import zlib
import sqlite3
import copy
import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from lap_archive import LapArchive

# All 20 FastF1 SignalRClient default topics. Commentary is not an upstream topic.
TOPICS = ['Heartbeat', 'AudioStreams', 'DriverList', 'ExtrapolatedClock',
          'RaceControlMessages', 'SessionInfo', 'SessionStatus', 'TeamRadio',
          'TimingAppData', 'TimingStats', 'TrackStatus', 'WeatherData',
          'Position.z', 'CarData.z', 'ContentStreams', 'SessionData',
          'TimingData', 'TopThree', 'RcmSeries', 'LapCount']


def decode_payload(topic, payload):
    if topic.endswith('.z') and isinstance(payload, str):
        # Initial subscriptions may JSON-wrap the base64 string.
        if payload.startswith('"'):
            payload = json.loads(payload)
        packed = base64.b64decode(payload, validate=True)
        decoder = zlib.decompressobj(-zlib.MAX_WBITS)
        unpacked = decoder.decompress(packed, 8_000_001)
        if len(unpacked) > 8_000_000 or decoder.unconsumed_tail or not decoder.eof:
            raise ValueError('Compressed feed exceeds decode limit or is incomplete')
        payload = json.loads(unpacked)
    elif isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, (dict, list)):
        raise ValueError('Unexpected timing payload')
    return payload



def utcnow():
    return datetime.now(timezone.utc).isoformat()


def merge(old, patch):
    if isinstance(patch, list):
        patch = {str(i): value for i, value in enumerate(patch)}
    if not isinstance(patch, dict):
        return copy.deepcopy(patch)
    result = copy.deepcopy(old) if isinstance(old, dict) else {}
    for key, value in patch.items():
        if key in ('__proto__', 'constructor', 'prototype'):
            continue
        result[key] = merge(result.get(key), value)
    return result


class State:
    def __init__(self, saved_archive=None):
        self.lock = threading.RLock()
        self.run_id = str(uuid.uuid4())
        self.sequence = 0
        self.connected = False
        self.last_message_at = None
        self.last_feed_monotonic = None
        self.topics = {}
        self.topic_times = {}
        self.events = []
        self.errors = 0
        self.laps = LapArchive(saved_archive)
        self.telemetry = None

    def apply(self, topic, payload, source_time='', initial=False):
        if topic not in TOPICS:
            return
        payload = decode_payload(topic, payload)
        with self.lock:
            if topic == 'SessionInfo' and isinstance(payload, dict):
                old = self.topics.get(topic, {}).get('Key')
                new = payload.get('Key')
                if old is not None and new is not None and old != new:
                    self.topics = {}
                    self.topic_times = {}
                    self.events = []
                    self.last_message_at = None
                    self.last_feed_monotonic = None
                    self.run_id = str(uuid.uuid4())
            self.sequence += 1
            received = utcnow()
            if self.telemetry:
                try:
                    self.telemetry.append(topic, payload)
                except (OSError, ValueError, sqlite3.Error):
                    self.telemetry.write_errors += 1
            # High-frequency batches have ephemeral indexes: never merge across batches.
            # The SignalR raw recording retains the complete received history.
            self.topics[topic] = (merge({}, payload) if initial else copy.deepcopy(payload) if topic.endswith('.z')
                                  else merge(self.topics.get(topic), payload))
            self.laps.apply(topic, merge({}, payload), self.topics, source_time, self.sequence, initial)
            # An initial snapshot is not evidence that the feed is currently live.
            self.topic_times[topic] = {'received_at': received,
                                       'source_time': source_time,
                                       'initial_snapshot': initial}
            if not initial:
                self.last_message_at = received
                self.last_feed_monotonic = time.monotonic()
            if topic in ['TimingData', 'TimingAppData', 'RaceControlMessages',
                         'SessionStatus', 'TrackStatus', 'TeamRadio', 'Commentary']:
                self.events.append({'sequence': self.sequence, 'topic': topic,
                                    'source_time': source_time, 'received_at': received,
                                    'initial_snapshot': initial, 'patch': copy.deepcopy(payload)})
                self.events = self.events[-400:]

    def snapshot(self):
        with self.lock:
            capture = self.telemetry.summary() if self.telemetry else None
            if capture and capture['purged']:
                for topic in ('CarData.z', 'Position.z'):
                    self.topics.pop(topic, None)
                    self.topic_times.pop(topic, None)
            age = None if self.last_feed_monotonic is None else time.monotonic() - self.last_feed_monotonic
            status = self.topics.get('SessionStatus', {}).get('Status')
            active = status in ('Started', 'Resumed')
            return copy.deepcopy({
                'schema_version': 1, 'producer': 'fastf1-live-bridge',
                'run_id': self.run_id, 'sequence': self.sequence,
                'generated_at': utcnow(), 'last_message_at': self.last_message_at,
                'connected': self.connected, 'feed_age_seconds': age,
                'feed_fresh': self.connected and age is not None and age <= 30,
                'session_active': active, 'parse_errors': self.errors,
                'topics': self.topics, 'topic_times': self.topic_times,
                'subscription': {'requested_topics': TOPICS, 'received_topics': list(self.topics),
                                 'missing_topics': [t for t in TOPICS if t not in self.topics]},
                'recent_events': self.events,
                'lap_archive': self.laps.export(self.topics),
                'telemetry_capture': capture,
                'limitations': [
                    'Incremental raw timing state, not FastF1 finalized Session.laps.',
                    'Lap/sector/tyre updates may arrive separately; verify event sequence.',
                    'Initial snapshots and reconnects may omit earlier lap history.',
                    'Fuel load, battery SOC and tyre temperatures are unavailable. CarData.z/Position.z contain only the latest decoded batch; full received history is in the raw recording. TeamRadio/AudioStreams are metadata and links, not audio transcription.',
                    'A fresh heartbeat does not mean every driver field was updated recently.',
                    'Race-control deletion messages must be checked before ranking laps.'
                ]})


def write_snapshot(state, path):
    from telemetry import purge_expired
    purge_expired(path.parent)
    data = state.snapshot()
    # Bound uploads without silently discarding the latest state.
    while len(json.dumps(data, ensure_ascii=False).encode()) > 900_000 and data['recent_events']:
        data['recent_events'] = data['recent_events'][20:]
    # Keep the same file identity for the browser's FileSystemFileHandle.
    # The uploader retries if it reads during this short write.
    path.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    with state.lock:
        saved = copy.deepcopy(state.laps.checkpoint())
    checkpoint = path.parent / 'lap-archive.json'
    temporary = checkpoint.with_suffix('.tmp')
    temporary.write_text(json.dumps(saved, ensure_ascii=False), encoding='utf-8')
    temporary.replace(checkpoint)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--auth-method', choices=['password', 'browser'], default='password')
    parser.add_argument('--output', default='output')
    args = parser.parse_args()
    import fastf1
    from fastf1.internals.f1account import get_token
    from fastf1.livetiming.client import SignalRClient
    from signalrcore.messages.completion_message import CompletionMessage
    fastf1.set_auth_method(args.auth_method)
    print('Sign in to Formula 1 locally. Never paste passwords or tokens into ChatGPT.')
    get_token()  # Fail here instead of silently falling back to partial unauthenticated data.
    directory = Path(args.output).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    try:
        saved_archive = json.loads((directory / 'lap-archive.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        saved_archive = None
    state = State(saved_archive)

    class Client(SignalRClient):
        def _on_message(self, msg):
            super()._on_message(msg)
            try:
                if isinstance(msg, CompletionMessage):
                    result = msg.result if isinstance(msg.result, dict) else {}
                    # Session metadata first so a session reset cannot clear newer fields.
                    info = result.get('SessionInfo', {})
                    if info.get('Key') is not None and (state.telemetry is None or state.telemetry.info['Key'] != info['Key']):
                        from telemetry import LiveTelemetry
                        state.telemetry = LiveTelemetry(directory / 'telemetry', info, directory / 'timing-raw.txt')
                    for topic in sorted(result, key=lambda k: k != 'SessionInfo'):
                        state.apply(topic, result[topic], initial=True)
                elif isinstance(msg, list) and len(msg) >= 2:
                    state.apply(msg[0], msg[1], msg[2] if len(msg) > 2 else '')
            except (ValueError, TypeError, KeyError, zlib.error):
                with state.lock:
                    state.errors += 1

        def _on_connect(self):
            super()._on_connect()
            with state.lock:
                state.connected = True

        def _on_close(self):
            super()._on_close()
            with state.lock:
                state.connected = False

    client = Client(str(directory / 'timing-raw.txt'), filemode='a', timeout=60)
    client.topics = TOPICS
    done = threading.Event()

    def record():
        try:
            client.start()
        except Exception as exc:
            print('Collector stopped:', type(exc).__name__, '(check network/login, then restart)')
        finally:
            with state.lock:
                state.connected = False
            done.set()

    threading.Thread(target=record, daemon=True).start()
    print('Share only this file on the private connection page:', directory / 'snapshot.json')
    try:
        while not done.wait(2):
            write_snapshot(state, directory / 'snapshot.json')
    except KeyboardInterrupt:
        try:
            client._exit()
        except Exception:
            pass
    finally:
        with state.lock:
            state.connected = False
        write_snapshot(state, directory / 'snapshot.json')
        print('Stopped. Snapshot is marked disconnected.')


if __name__ == '__main__':
    main()
