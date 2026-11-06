"""Power saving for the AWS collector host: wake before every session, sleep after.

The weekend rehearsal uses the real 2026 Sao Paulo GP timetable (formula1.com: FP1 12:30,
FP2 16:00 Fri; FP3 11:30, Qualifying 15:00 Sat; Race 14:00 Sun, local UTC-3) and walks it
minute by minute: the instance boots when its EventBridge schedule fires, the host loop
decides every minute, and the recorder must find the server on whenever it has to connect.
"""
import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

os.environ.setdefault('DATA_DIR', tempfile.mkdtemp())
import cloud  # noqa: E402
import host_runner  # noqa: E402
import power  # noqa: E402

UTC = timezone.utc
LOOKAHEAD = timedelta(minutes=45)
BRAZIL = [  # (id, name, start UTC, real length)
    ('2026-20-1', 'Practice 1', datetime(2026, 11, 6, 15, 30, tzinfo=UTC), timedelta(minutes=60)),
    ('2026-20-2', 'Practice 2', datetime(2026, 11, 6, 19, 0, tzinfo=UTC), timedelta(minutes=60)),
    ('2026-20-3', 'Practice 3', datetime(2026, 11, 7, 14, 30, tzinfo=UTC), timedelta(minutes=60)),
    ('2026-20-4', 'Qualifying', datetime(2026, 11, 7, 18, 0, tzinfo=UTC), timedelta(minutes=70)),
    ('2026-20-5', 'Race', datetime(2026, 11, 8, 17, 0, tzinfo=UTC), timedelta(minutes=110)),
]


def windows(sessions=BRAZIL):
    rows = []
    for wid, name, start, _ in sessions:
        rows.append({'id': wid, 'event': 'São Paulo Grand Prix', 'name': name, 'start': start.isoformat(),
                     'open': (start - timedelta(minutes=5)).isoformat(),
                     'close': (start + timedelta(hours=4 if name == 'Race' else 3)).isoformat()})
    return rows


class DecideTest(unittest.TestCase):
    def decide(self, now, recording=False, is_lead=True, done=True, uptime=timedelta(hours=1), ws=None):
        return power.decide(now, ws or windows(), LOOKAHEAD, recording=recording, is_lead=is_lead,
                            is_done=lambda wid: done, uptime=uptime)

    def test_recording_never_sleeps(self):
        self.assertEqual(self.decide(datetime(2026, 11, 6, 15, 40, tzinfo=UTC), recording=True), ('stay', 'recording'))

    def test_sleeps_and_wakes_before_the_recorder_connects(self):
        now = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)  # Thursday: next is FP1
        decision, wake = self.decide(now)
        self.assertEqual(decision, 'sleep')
        # check-in at most 12 h later
        self.assertEqual(wake, now + timedelta(hours=12))
        now = datetime(2026, 11, 6, 10, 0, tzinfo=UTC)
        decision, wake = self.decide(now)
        connect = datetime(2026, 11, 6, 15, 25, tzinfo=UTC) - LOOKAHEAD  # open - lookahead = 14:40
        self.assertEqual(wake, connect - power.WAKE_MARGIN)  # 14:20

    def test_stays_when_a_session_is_close(self):
        self.assertEqual(self.decide(datetime(2026, 11, 6, 14, 0, tzinfo=UTC)), ('stay', 'session_soon'))

    def test_never_waits_for_post_session_uploads(self):
        # completed sessions come from OpenF1: a closed window keeps nobody on
        fp1_close = datetime(2026, 11, 6, 18, 30, tzinfo=UTC)
        ws = [w for w in windows() if w['id'] == '2026-20-1']
        self.assertEqual(self.decide(fp1_close + timedelta(minutes=10), done=False, ws=ws)[0], 'sleep')

    def test_just_booted_stays_a_little(self):
        self.assertEqual(self.decide(datetime(2026, 11, 5, 12, 0, tzinfo=UTC), uptime=timedelta(minutes=3)),
                         ('stay', 'just_started'))

    def test_no_calendar_checks_in_again(self):
        now = datetime(2026, 12, 20, tzinfo=UTC)
        self.assertEqual(self.decide(now, ws=[]), ('sleep', now + power.CHECK_IN))


class EndedTest(unittest.TestCase):
    def test_off_right_after_the_session_until_the_next_one(self):
        ws = windows()
        ws[0]['ended'] = True  # FP1 recorded to its end at 16:32 UTC; window closes 18:30
        now = datetime(2026, 11, 6, 16, 33, tzinfo=UTC)
        self.assertEqual(power.decide(now, ws, LOOKAHEAD, recording=False, is_lead=True, is_done=lambda w: False,
                                      uptime=timedelta(hours=2)),
                         ('sleep', datetime(2026, 11, 6, 17, 50, tzinfo=UTC)))  # FP2 recorder connects 18:10

    def test_race_end_does_not_come_back_at_window_close(self):
        ws = windows()
        for w in ws:
            w['ended'] = True
        race_end = datetime(2026, 11, 8, 18, 52, tzinfo=UTC)  # window closes 21:00
        decision, wake = power.decide(race_end, ws, LOOKAHEAD, recording=False, is_lead=True,
                                      is_done=lambda w: False, uptime=timedelta(hours=3))
        self.assertEqual((decision, wake), ('sleep', race_end + power.CHECK_IN))


class ScheduleRequestTest(unittest.TestCase):
    """Validate the request against the real EventBridge Scheduler API model (botocore)."""

    def test_request_matches_aws_api(self):
        try:
            import boto3
            from botocore.stub import Stubber
        except ImportError:
            self.skipTest('boto3 not installed')
        client = boto3.client('scheduler', region_name='ap-southeast-2', aws_access_key_id='x', aws_secret_access_key='y')
        inst = {'id': 'i-0a267709b0d7a6190', 'region': 'ap-southeast-2', 'account': '123456789012'}
        wake = datetime(2026, 11, 6, 14, 20, tzinfo=UTC)
        os.environ['HOST_NAME'] = 'kongboda-aws'
        request = power.schedule_request('kongboda-wake-kongboda-aws', wake, inst)
        self.assertEqual(request['ScheduleExpression'], 'at(2026-11-06T14:20:00)')
        self.assertEqual(json.loads(request['Target']['Input']), {'InstanceIds': ['i-0a267709b0d7a6190']})
        with Stubber(client) as stub:
            stub.add_client_error('update_schedule', 'ResourceNotFoundException', expected_params=request)
            stub.add_response('create_schedule', {'ScheduleArn': 'arn:aws:scheduler:ap-southeast-2:123456789012:schedule/default/kongboda-wake-kongboda-aws'}, request)
            stub.add_response('get_schedule', {'Name': request['Name'], 'ScheduleExpression': request['ScheduleExpression'], 'State': 'ENABLED'},
                              {'Name': request['Name'], 'GroupName': 'default'})
            self.assertTrue(power.book_wake(wake, client=client, inst=inst))
            stub.assert_no_pending_responses()


class TickTest(unittest.TestCase):
    def setUp(self):
        os.environ['POWER_SAVE'] = 'aws'

    def tearDown(self):
        os.environ.pop('POWER_SAVE', None)

    def test_no_wake_booked_means_stay_on(self):
        offs = []

        def refuse(_):
            raise PermissionError('AccessDenied')
        now = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)
        power.BOOT -= 3600
        got = power.tick(windows(), LOOKAHEAD, recording=False, is_lead=True, is_done=lambda w: True, now=now,
                         book=refuse, off=lambda: offs.append(1))
        self.assertEqual(got, ('stay', 'wake_not_booked'))
        self.assertEqual(offs, [])
        got = power.tick(windows(), LOOKAHEAD, recording=False, is_lead=True, is_done=lambda w: True, now=now,
                         book=lambda at: True, off=lambda: offs.append(1))
        self.assertEqual(got[0], 'sleep')
        self.assertEqual(offs, [1])

    def test_off_unless_enabled(self):
        os.environ.pop('POWER_SAVE')
        self.assertIsNone(power.tick(windows(), LOOKAHEAD, recording=False, is_lead=True, is_done=lambda w: True))


class WeekendRehearsal(unittest.TestCase):
    """Thursday noon KST to Tuesday: every recorder connect finds the server on; it goes off
    soon after each session ends and does not come back until the next one (or a check-in)."""

    def run_weekend(self, sessions=BRAZIL, history_after=timedelta(minutes=40), boot=timedelta(minutes=2),
                    delay=timedelta(0)):
        ws = windows(sessions)
        t = datetime(2026, 11, 5, 3, 0, tzinfo=UTC)
        end = datetime(2026, 11, 10, 0, 0, tzinfo=UTC)
        on, booted_at, wake_at, ended, log = True, t - timedelta(hours=1), None, set(), []
        on_minutes, misses, late_off = 0, [], []
        closes = {w['id']: datetime.fromisoformat(w['close']) for w in ws}
        published = {wid: closes[wid] + history_after for wid in closes}  # FastF1 data after the window closes
        while t < end:
            if on is False and wake_at and t >= wake_at:
                on, booted_at, wake_at = None, t, None  # booting
                log.append(('boot', t))
            if on is None and t >= booted_at + boot:
                on = True
            recording = False
            for wid, name, start, length in sessions:
                connect = start - timedelta(minutes=5) - LOOKAHEAD
                if t == connect and on is not True:
                    misses.append((name, t))
                if connect <= t < start + delay + length and on:
                    recording = True
                if on and t >= start + delay + length and t < closes[wid] and wid not in ended:
                    ended.add(wid)  # the recorder saw Finished
            if on:
                on_minutes += 1
                view = [dict(w, ended=w['id'] in ended) for w in ws]
                decision, detail = power.decide(t, view, LOOKAHEAD, recording=recording, is_lead=True,
                                                is_done=lambda wid: t >= published[wid], uptime=t - booted_at)
                if decision == 'sleep':
                    on, wake_at = False, detail
                    log.append(('sleep', t, detail))
            t += timedelta(minutes=1)
        boots_after_close = [e for e in log if e[0] == 'boot' and any(c <= e[1] < c + timedelta(minutes=30) for c in closes.values())]
        return on_minutes, misses, boots_after_close, log

    def test_brazil_weekend(self):
        on_minutes, misses, boots_after_close, log = self.run_weekend()
        self.assertEqual(misses, [], 'a recorder connect found the server off')
        self.assertEqual(boots_after_close, [], 'no wake just to upload after a session')
        sleeps = [e for e in log if e[0] == 'sleep']
        self.assertGreaterEqual(len(sleeps), 4)
        # ~ the sessions, their lead-in and uploads, plus short check-ins: far below 24/7
        self.assertLess(on_minutes / 60, 30)
        self.print_log(log, on_minutes)

    def test_late_start_and_slow_archive(self):
        # session 40 min late (red flag / delay) and FastF1 data 2.5 h after the end
        on_minutes, misses, boots_after_close, log = self.run_weekend(history_after=timedelta(minutes=150),
                                                                      delay=timedelta(minutes=40))
        self.assertEqual(misses, [])
        self.assertEqual(boots_after_close, [])
        self.print_log(log, on_minutes)

    def test_boot_takes_ten_minutes(self):
        on_minutes, misses, *_ = self.run_weekend(boot=timedelta(minutes=10))
        self.assertEqual(misses, [])

    def print_log(self, log, on_minutes):
        if os.environ.get('POWER_LOG'):
            kst = timezone(timedelta(hours=9))
            for e in log:
                print(e[0], e[1].astimezone(kst).strftime('%m-%d %H:%M KST'),
                      ('-> wake ' + e[2].astimezone(kst).strftime('%m-%d %H:%M KST')) if len(e) > 2 else '')
            print('on hours: %.1f of %.1f' % (on_minutes / 60, (datetime(2026, 11, 10, tzinfo=UTC) - datetime(2026, 11, 5, 3, tzinfo=UTC)).total_seconds() / 3600))


if __name__ == '__main__':
    unittest.main()
