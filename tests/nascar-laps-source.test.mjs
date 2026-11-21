import test from 'node:test';
import assert from 'node:assert/strict';
import {raceRows, runRows, cautionLaps} from '../scripts/sim/learn/fetch-nascar.mjs';

// a few derived laps in the feed's shape (lap-times / weekend-feed / live-pit-data), not a stored raw file
const lapTimes = {laps: [{Number: '5', FullName: 'Kyle Larson (C)', Manufacturer: 'Chv', Laps: [
  {Lap: 0, LapTime: null}, {Lap: 1, LapTime: 36.0}, {Lap: 2, LapTime: 33.1}, {Lap: 3, LapTime: 45.0}, {Lap: 4, LapTime: 44.0},
  {Lap: 5, LapTime: 34.0}, {Lap: 6, LapTime: 32.9}, {Lap: 7, LapTime: 40.2}, {Lap: 8, LapTime: 38.0}, {Lap: 9, LapTime: 33.0}]}]};
const race = {caution_segments: [{start_lap: 3, end_lap: 4}], results: [{car_number: '5', car_make: 'Chevrolet', team_name: 'Hendrick', laps_completed: 9, starting_position: 10, finishing_position: 1, finishing_status: 'Running'}]};
const pits = [{vehicle_number: '5', lap_count: 7}];

test('NASCAR race rows: clean laps skip lap 1, cautions with their restart lap, pit-in and pit-out laps', () => {
  assert.deepEqual([...cautionLaps(race.caution_segments)], [3, 4, 5]);
  const [r] = raceRows(lapTimes, race, pits);
  assert.equal(r.laps, r.officialLaps);                 // 9 timed laps = laps_completed
  assert.equal(r.best, 32.9); assert.equal(r.cleanBest, 32.9);
  assert.equal(r.cleanLaps, 3); assert.equal(r.cleanMedian, 33.0);   // laps 2, 6, 9
  assert.equal(r.driver, 'Kyle Larson'); assert.equal(r.manufacturer, 'Chevrolet'); assert.equal(r.finish, 1);
});

test('NASCAR qualifying rows keep the listed best lap', () => {
  const [q] = runRows({results: [{car_number: '19', driver_name: 'Chase Briscoe', manufacturer: 'Toyota', best_lap_time: 51.466, best_lap_speed: 186.065, laps_completed: 1, finishing_position: 1}]});
  assert.deepEqual(q, {car: '19', driver: 'Chase Briscoe', manufacturer: 'Toyota', laps: 1, best: 51.466, bestSpeedMph: 186.065, position: 1});
});
