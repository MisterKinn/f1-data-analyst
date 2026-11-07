import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanLaps, fitRace, raceLaps, strategies} from '../worker/lapsim/race-pace.js';

// synthetic race: 10 drivers, 50 laps, one stop M→H at lap 20–30, known factors
function synth() {
  const truth = {slope: -0.06, off: {MEDIUM: 0, HARD: 0.5}, wear: {MEDIUM: 0.08, HARD: 0.04}};
  const drivers = {}, pits = [];
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2;
  for (let d = 1; d <= 10; d++) {
    const stop = 18 + d, laps = [];
    for (let n = 1; n <= 50; n++) {
      const st = n <= stop ? 1 : 2, c = st === 1 ? 'MEDIUM' : 'HARD', age = st === 1 ? n - 1 : n - stop - 1;
      laps.push([n, 90 + d * 0.1 + truth.slope * (n - 1) + truth.off[c] + truth.wear[c] * age + rnd() + (n === stop ? 20 : 0), null, null, null, c, age, st, n === stop + 1 ? 1 : 0, null]);
    }
    drivers[d] = {team: 'T' + d, position: d, laps}; pits.push([d, stop, 22, 2.4]);
  }
  return {truth, race: {columns: ['lap', 'time', 's1', 's2', 's3', 'compound', 'tyreAge', 'stint', 'pitOut', 'date'], drivers, pits, control: [], weather: []}};
}

test('race fit recovers fuel slope, compound offset and wear', () => {
  const {truth, race} = synth();
  const {laps} = cleanLaps(race);
  const f = fitRace(laps, {lambdaWear: 0.01, lambdaOffset: 0.01});
  assert.ok(Math.abs(f.slope - truth.slope) < 0.01, 'slope ' + f.slope);
  assert.ok(Math.abs(f.wear.MEDIUM - truth.wear.MEDIUM) < 0.015, 'wear M ' + f.wear.MEDIUM);
  assert.ok(Math.abs(f.offset.HARD - truth.off.HARD) < 0.2, 'offset H ' + f.offset.HARD);
  assert.ok(Math.abs(f.ref - 90.1) < 0.15, 'ref ' + f.ref);
});

test('safety-car laps are removed and strategies need two compounds', () => {
  const {race} = synth();
  race.control = [['', 30, 'SafetyCar', null, 'SAFETY CAR DEPLOYED'], ['', 33, 'SafetyCar', null, 'SAFETY CAR IN THIS LAP']];
  assert.ok(!cleanLaps(race).laps.some(l => l.lap >= 30 && l.lap <= 34));
  const track = {raceRatio: 1.05, slope: -0.06, pitLoss: 21, laps: 40, offset: {SOFT: -0.6, MEDIUM: 0, HARD: 0.5}, wear: {SOFT: 0.15, MEDIUM: 0.08, HARD: 0.04}};
  const s = strategies(track, 85);
  assert.ok(s.every(x => new Set(x.stints.map(([c]) => c)).size >= 2));
  assert.equal(s[0].stints.reduce((n, [, l]) => n + l, 0), 40);
  const L = raceLaps(track, 85, s[0].stints.map(([compound, laps]) => ({compound, laps})));
  assert.equal(L.length, 40);
  assert.ok(Math.abs(L.reduce((a, l) => a + l.time, 0) - s[0].total) < 1e-6);
});
