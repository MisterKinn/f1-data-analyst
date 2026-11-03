"""Conservative completed-lap archive built from observed timing patches.

Never assemble a lap from the rolling merged Sectors object. A complete lap
requires fresh, ordered S1/S2/S3 events and a matching LastLapTime event.
"""
import copy
import re
from datetime import datetime, timezone


def milliseconds(value):
    if not isinstance(value, str) or not re.fullmatch(r'(?:\d+:)?\d{1,3}\.\d{3}', value):
        return None
    parts = value.split(':')
    seconds = parts[-1].split('.')
    return (int(parts[0]) * 60000 if len(parts) == 2 else 0) + int(seconds[0]) * 1000 + int(seconds[1])


def timestamp(value):
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, AttributeError):
        return None


def indexed(value):
    return {str(i): v for i, v in enumerate(value)} if isinstance(value, list) else value if isinstance(value, dict) else {}


class LapArchive:
    def __init__(self, saved=None):
        self.session_key = None
        self.records = []
        self.candidates = {}
        self.last_laps = {}
        self.last_times = {}
        self.part = None
        self.rejected = 0
        self.recovery = {}
        if isinstance(saved, dict) and saved.get('version') == 1:
            self.session_key = saved.get('session_key')
            self.records = copy.deepcopy(saved.get('records', []))[-6000:]
            self.recovery = copy.deepcopy(saved.get('recovery', {}))

    def checkpoint(self):
        return {'version': 1, 'session_key': self.session_key, 'records': self.records, 'recovery': self.recovery}

    def absorb(self, records, source):
        existing = {r['id']: r for r in self.records}
        for record in records:
            if str(record.get('id', '')).startswith(str(self.session_key) + ':'):
                # Feed/official clocks may differ by milliseconds. Do not turn
                # a replay of the same physical lap into an ambiguous duplicate.
                duplicate = next((r for r in existing.values()
                    if r['driver_number'] == record['driver_number'] and r['session_part'] == record['session_part']
                    and r['lap_time'] == record['lap_time']
                    and abs(timestamp(r['completed_at']) - timestamp(record['completed_at'])) <= 2), None)
                if duplicate:
                    if duplicate.get('timing_lap_reference') is None:
                        duplicate['timing_lap_reference'] = record.get('timing_lap_reference')
                else:
                    existing.setdefault(record['id'], dict(record, history_source=source))
        self.records = sorted(existing.values(), key=lambda r: r['completed_at'])[-6000:]

    def reset_pending(self):
        self.candidates.clear()
        self.last_laps.clear()
        self.last_times.clear()

    def apply(self, topic, patch, topics, source_time, sequence, initial=False):
        key = topics.get('SessionInfo', {}).get('Key')
        if key is not None and key != self.session_key:
            self.__init__()
            self.session_key = key
        if initial:
            if topic == 'TimingData':
                self.reset_pending()
            return
        part = topics.get('TimingData', {}).get('SessionPart', 0) or 0
        if part != self.part:
            self.reset_pending()
            self.part = part
        if topic != 'TimingData' or key is None:
            return
        at = timestamp(source_time)
        if at is None:
            return
        for driver, line in indexed(patch.get('Lines')).items():
            if not isinstance(line, dict):
                continue
            if at < self.last_times.get(driver, float('-inf')):
                self.candidates.pop(driver, None)
                self.last_laps.pop(driver, None)
                self.rejected += 1
                continue
            self.last_times[driver] = at
            for i, sector in sorted(indexed(line.get('Sectors')).items()):
                if i not in ('0', '1', '2') or not isinstance(sector, dict):
                    continue
                value = sector.get('Value')
                ms = milliseconds(value)
                if ms is None or ms <= 0:
                    continue
                if i == '0':
                    self.candidates[driver] = {'part': part, 'values': [], 'times': [], 'sequences': []}
                candidate = self.candidates.get(driver)
                if not candidate or len(candidate['values']) != int(i):
                    continue
                if candidate['times'] and at <= candidate['times'][-1]:
                    # Distinct sector completions cannot share a timestamp.
                    self.candidates.pop(driver, None)
                    self.rejected += 1
                    continue
                if candidate['times'] and abs((at - candidate['times'][-1]) * 1000 - ms) > 2500:
                    self.candidates.pop(driver, None)
                    self.rejected += 1
                    continue
                candidate['values'].append(value)
                candidate['times'].append(at)
                candidate['sequences'].append(sequence)
            lap = line.get('LastLapTime', {}).get('Value')
            if milliseconds(lap):
                self.last_laps[driver] = {'value': lap, 'at': at, 'source_time': source_time, 'sequence': sequence}
            self._complete(driver, topics)

    def _complete(self, driver, topics):
        candidate = self.candidates.get(driver)
        lap = self.last_laps.get(driver)
        if not candidate or len(candidate['values']) != 3 or not lap:
            return
        if abs(lap['at'] - candidate['times'][2]) > 5:
            return
        total = sum(milliseconds(v) for v in candidate['values'])
        if abs(total - milliseconds(lap['value'])) > 3:
            self.rejected += 1
            return
        row = topics.get('TimingData', {}).get('Lines', {}).get(driver, {})
        refs = indexed(row.get('BestLapTimes'))
        best = refs.get(str(candidate['part'] - 1), {}) if candidate['part'] else row.get('BestLapTime', {})
        record = {
            'id': f"{self.session_key}:{driver}:{candidate['part']}:{candidate['times'][2]}",
            'driver_number': driver, 'session_part': candidate['part'],
            'lap_time': lap['value'], 'lap_time_ms': milliseconds(lap['value']),
            'sectors': dict(zip(('S1', 'S2', 'S3'), candidate['values'])),
            'sector_sum_ms': total, 'sector_sum_delta_ms': total - milliseconds(lap['value']),
            'completed_at': datetime.fromtimestamp(candidate['times'][2], timezone.utc).isoformat(),
            'lap_number': row.get('NumberOfLaps'),
            'track_status_at_completion': topics.get('TrackStatus', {}).get('Status'),
            'sector_source_times': [datetime.fromtimestamp(t, timezone.utc).isoformat() for t in candidate['times']],
            'sector_sequences': candidate['sequences'], 'lap_sequence': lap['sequence'],
            'timing_lap_reference': best.get('Lap') if best.get('Value') == lap['value'] else None,
            'in_pit_at_completion': row.get('InPit') is True,
            'validation': 'complete',
        }
        if not any(r['id'] == record['id'] for r in self.records):
            self.records.append(record)
            self.records = self.records[-6000:]
        self.candidates.pop(driver, None)
        self.last_laps.pop(driver, None)

    def export(self, topics):
        messages = indexed(topics.get('RaceControlMessages', {}).get('Messages'))
        deleted = {}
        unresolved = set()
        for message in messages.values():
            text = message.get('Message', '') if isinstance(message, dict) else ''
            car = re.search(r'CAR (\d+)\b', text)
            if not car or not re.search(r'DELETED|REINSTATED', text):
                continue
            time = re.search(r'\bTIME\s+((?:\d+:)?\d+\.\d{3})', text)
            if time:
                deleted[(car[1], time[1])] = 'DELETED' in text
            elif 'DELETED' in text and '(PIT)' not in text:
                unresolved.add(car[1])
        best_laps = {}
        retained = {}
        for driver, row in topics.get('TimingData', {}).get('Lines', {}).items():
            if not isinstance(row, dict):
                continue
            refs = indexed(row.get('BestLapTimes'))
            if not refs:
                refs = {'session': row.get('BestLapTime', {})}
            for part, best in refs.items():
                value = best.get('Value') if isinstance(best, dict) else None
                if not milliseconds(value):
                    continue
                part_number = int(part) + 1 if part.isdigit() else 0
                label = f'Q{part_number}' if part_number else 'session'
                candidates = [r for r in self.records if r['driver_number'] == driver
                              and r['session_part'] == part_number and r['lap_time'] == value
                              and not r.get('in_pit_at_completion')]
                # Equal lap times are not sufficient to pick a different best lap.
                exact = [r for r in candidates if r.get('timing_lap_reference') == best.get('Lap') and best.get('Lap') is not None]
                compatible = [r for r in candidates if r.get('timing_lap_reference') in (None, best.get('Lap'))]
                record = exact[0] if len(exact) == 1 else compatible[0] if len(compatible) == 1 else None
                status = 'deleted' if deleted.get((driver, value)) else 'deletion_unresolved' if driver in unresolved else 'complete' if record else 'unavailable'
                info = topics.get('DriverList', {}).get(driver, {})
                result = {'driver_number': driver, 'driver': info.get('Tla'), 'team': info.get('TeamName'),
                          'session_part': part_number, 'lap_time': value, 'timing_lap_reference': best.get('Lap'),
                          'status': status, 'sectors': None, 'reason': None}
                if status == 'complete':
                    result.update(copy.deepcopy(record))
                    result['timing_lap_reference'] = best.get('Lap')
                    stints = indexed(topics.get('TimingAppData', {}).get('Lines', {}).get(driver, {}).get('Stints'))
                    matching = [(k, v) for k, v in stints.items() if isinstance(v, dict) and v.get('LapTime') == value]
                    result['tyre'] = ({'stint': matching[0][0], 'compound': matching[0][1].get('Compound'),
                                       'new_at_stint_start': matching[0][1].get('New'),
                                       'start_laps': matching[0][1].get('StartLaps')}
                                      if len(matching) == 1 else record.get('tyre'))
                    retained[record['id']] = record
                else:
                    result['reason'] = {'deleted': 'Race control deleted this time.',
                                        'deletion_unresolved': 'A deletion without a time cannot be safely associated with a lap.',
                                        'unavailable': 'No unique, complete observed sector sequence for the published best lap; collection may have started late or reconnected.'}[status]
                best_laps.setdefault(label, {})[driver] = result
        # Retain best laps plus a small recent tail per driver for reconnect recovery.
        for driver in {r['driver_number'] for r in self.records}:
            for record in [r for r in self.records if r['driver_number'] == driver][-12:]:
                retained[record['id']] = record
        return {'version': 1, 'session_key': self.session_key, 'best_laps': best_laps,
                'records': list(retained.values()), 'completed_laps_count': len(self.records),
                'rejected_sequences': self.rejected, 'recovery': self.recovery,
                'best_lap_coverage': {'complete': sum(r['status'] == 'complete' for rows in best_laps.values() for r in rows.values()),
                                      'total': sum(len(rows) for rows in best_laps.values())},
                'method': 'Observed ordered sector events matched to LastLapTime, sum tolerance 3 ms; not finalized FastF1 Session.laps.',
                'coverage': 'Only fully observed laps. Historical missing sectors are never backfilled from rolling state.'}
