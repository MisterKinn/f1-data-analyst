import unittest
from collector import State


class LapArchiveTests(unittest.TestCase):
    def setUp(self):
        self.s = State()
        self.s.apply('SessionInfo', {'Key': 123, 'Name': 'Qualifying'}, initial=True)
        self.s.apply('TimingData', {'SessionPart': 2, 'Lines': {'16': {'InPit': False}}}, initial=True)

    def patch(self, body, second):
        self.s.apply('TimingData', {'Lines': {'16': body}}, f'2026-10-24T21:{second//60:02}:{second%60:02}.000Z')

    def lap(self, second=0, value='1:34.198', sectors=('25.000', '37.000', '32.198'), ref=8):
        self.patch({'Sectors': {'0': {'Value': sectors[0]}}}, second+25)
        self.patch({'Sectors': {'1': {'Value': sectors[1]}}}, second+62)
        self.patch({'Sectors': {'2': {'Value': sectors[2]}}, 'LastLapTime': {'Value': value},
                    'BestLapTimes': {'1': {'Value': value, 'Lap': ref}}}, second+94)

    def best(self):
        return self.s.snapshot()['lap_archive']['best_laps']['Q2']['16']

    def test_best_sectors_survive_inlap_and_part_change(self):
        self.lap()
        self.patch({'Sectors': {'0': {'Value': '35.095'}}}, 130)
        self.patch({'Sectors': {'1': {'Value': '46.851'}}}, 177)
        self.patch({'Sectors': {'2': {'Value': '43.023'}}, 'LastLapTime': {'Value': '2:04.969'}}, 220)
        self.s.apply('TimingData', {'SessionPart': 3}, '2026-10-24T21:05:00Z')
        self.assertEqual(self.best()['sectors'], {'S1': '25.000', 'S2': '37.000', 'S3': '32.198'})
        self.assertEqual(self.best()['sector_sum_ms'], 94198)

    def test_initial_snapshot_is_not_historical_lap_evidence(self):
        self.s.apply('TimingData', {'SessionPart': 2, 'Lines': {'16': {'Sectors': [{'Value': '25.000'}, {'Value': '37.000'}, {'Value': '32.198'}], 'LastLapTime': {'Value': '1:34.198'}, 'BestLapTimes': {'1': {'Value': '1:34.198', 'Lap': 8}}}}}, initial=True)
        self.assertEqual(self.best()['status'], 'unavailable')

    def test_missing_sector_rejected(self):
        self.patch({'Sectors': {'1': {'Value': '37.000'}}}, 62)
        self.patch({'Sectors': {'2': {'Value': '32.198'}}, 'LastLapTime': {'Value': '1:34.198'}, 'BestLapTimes': {'1': {'Value': '1:34.198', 'Lap': 8}}}, 94)
        self.assertEqual(self.best()['status'], 'unavailable')

    def test_sum_mismatch_rejected(self):
        self.lap(value='1:33.198')
        self.assertEqual(self.best()['status'], 'unavailable')

    def test_delayed_laptime_and_best_reference(self):
        self.patch({'Sectors': {'0': {'Value': '25.000'}}}, 25)
        self.patch({'Sectors': {'1': {'Value': '37.000'}}}, 62)
        self.patch({'Sectors': {'2': {'Value': '32.198'}}}, 94)
        self.patch({'LastLapTime': {'Value': '1:34.198'}}, 95)
        self.patch({'BestLapTimes': {'1': {'Value': '1:34.198', 'Lap': 8}}}, 96)
        self.assertEqual(self.best()['status'], 'complete')

    def test_laptime_before_final_sector(self):
        self.patch({'Sectors': {'0': {'Value': '25.000'}}}, 25)
        self.patch({'Sectors': {'1': {'Value': '37.000'}}}, 62)
        self.patch({'LastLapTime': {'Value': '1:34.198'}}, 94)
        self.patch({'Sectors': {'2': {'Value': '32.198'}}, 'BestLapTimes': {'1': {'Value': '1:34.198', 'Lap': 8}}}, 95)
        self.assertEqual(self.best()['status'], 'complete')

    def test_stale_laptime_not_reused(self):
        self.patch({'LastLapTime': {'Value': '1:34.198'}}, 0)
        self.patch({'Sectors': {'0': {'Value': '25.000'}}}, 25)
        self.patch({'Sectors': {'1': {'Value': '37.000'}}}, 62)
        self.patch({'Sectors': {'2': {'Value': '32.198'}}, 'BestLapTimes': {'1': {'Value': '1:34.198', 'Lap': 8}}}, 94)
        self.assertEqual(self.best()['status'], 'unavailable')

    def test_older_patch_invalidates_candidate(self):
        self.patch({'Sectors': {'0': {'Value': '25.000'}}}, 25)
        self.patch({'Sectors': {'1': {'Value': '37.000'}}}, 20)
        self.patch({'Sectors': {'2': {'Value': '32.198'}}, 'LastLapTime': {'Value': '1:34.198'}, 'BestLapTimes': {'1': {'Value': '1:34.198', 'Lap': 8}}}, 94)
        self.assertEqual(self.best()['status'], 'unavailable')

    def test_deleted_then_reinstated(self):
        self.lap()
        self.s.apply('RaceControlMessages', {'Messages': {'0': {'Message': 'CAR 16 (LEC) TIME 1:34.198 DELETED - TRACK LIMITS'}}})
        self.assertEqual(self.best()['status'], 'deleted')
        self.assertIsNone(self.best()['sectors'])
        self.s.apply('RaceControlMessages', {'Messages': {'1': {'Message': 'CAR 16 (LEC) TIME 1:34.198 REINSTATED'}}})
        self.assertEqual(self.best()['status'], 'complete')

    def test_best_replacement_does_not_use_previous_lap(self):
        self.lap()
        self.patch({'BestLapTimes': {'1': {'Value': '1:34.000', 'Lap': 11}}}, 200)
        self.assertEqual(self.best()['status'], 'unavailable')

    def test_checkpoint_and_reconnect_preserve_completed_only(self):
        self.lap()
        saved = self.s.laps.checkpoint()
        topics = self.s.snapshot()['topics']
        self.s = State(saved)
        for key, value in topics.items():
            self.s.apply(key, value, initial=True)
        self.assertEqual(self.best()['status'], 'complete')
        self.assertEqual(self.s.laps.candidates, {})
        self.s.apply('SessionInfo', {'Key': 124})
        self.assertEqual(self.s.snapshot()['lap_archive']['best_laps'], {})

    def test_tyre_matches_completed_lap_not_latest_stint(self):
        self.lap()
        self.s.apply('TimingAppData', {'Lines': {'16': {'Stints': {'0': {'LapTime': '1:34.198', 'Compound': 'SOFT', 'New': 'false', 'StartLaps': 3}, '1': {'LapTime': '2:04.969', 'Compound': 'MEDIUM', 'New': 'true'}}}}})
        self.assertEqual(self.best()['tyre']['compound'], 'SOFT')
        self.assertEqual(self.best()['tyre']['new_at_stint_start'], 'false')


if __name__ == '__main__':
    unittest.main()
