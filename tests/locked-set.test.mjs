import test from 'node:test';
import assert from 'node:assert/strict';
import {isLockedF1, isLockedSeason, isLockedDate} from '../scripts/sim/locked-set.mjs';
import {heldOut} from '../scripts/sim/exp-compare.mjs';

test('events from 2026-11-23 00:00 KST and every 2027+ season are locked', () => {
  assert.equal(isLockedF1('las-vegas', 2026), false);
  assert.equal(isLockedF1('lusail', 2026), true);
  assert.equal(isLockedF1('yas-marina-circuit', 2026), true);
  assert.equal(isLockedF1('monza', 2027), true);
  assert.equal(isLockedSeason(2026), false); assert.equal(isLockedSeason(2027), true);
  assert.equal(isLockedDate('2026-11-22T14:59:00Z'), false); assert.equal(isLockedDate('2026-11-22T15:00:00Z'), true);
});
test('a locked event never becomes a held-out row of exp-compare', () => {
  const s = {tracks: {monza: {realLap: 80}, lusail: {realLap: 82}}, holdout: {tracks: [{track: 'monza', errorSec: 0.4}, {track: 'lusail', errorSec: 0.5}]}};
  assert.deepEqual(Object.keys(heldOut({seasons: {2026: s}})), ['f1/2026|monza']);
});
test('LAPSIM_OPEN_LOCKED=1 opens the set for the milestone run', () => {
  process.env.LAPSIM_OPEN_LOCKED = '1';
  try { assert.equal(isLockedF1('lusail', 2026), false); assert.equal(isLockedSeason(2027), false); } finally { delete process.env.LAPSIM_OPEN_LOCKED; }
});
