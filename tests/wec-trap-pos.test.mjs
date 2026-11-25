import test from 'node:test';
import assert from 'node:assert/strict';
import {trapAt} from '../scripts/sim/wec-trap-pos.mjs';
import {trapSpeed} from '../scripts/sim/calibrate-lib.mjs';

test('trap positions from the Al Kamel timing-line table', () => {
  assert.deepEqual(trapAt('spa-francorchamps', 2025), {m: 2243.5, status: 'sourced'});
  assert.equal(trapAt('austin', 2026).m, 3568); // same printed distance in every published season → carried
  assert.equal(trapAt('sakhir', 2026), null); // 625 / 650 / 650: not identical → no carry-forward
  assert.equal(trapAt('catalunya', 2026), null);
});

test('trap speed = peak of the straight around the printed point, wraps the lap', () => {
  const v = Float64Array.from({length: 100}, (_, i) => i < 50 ? i : 100 - i); // ds 10 m: peak 50 at 500 m
  assert.equal(trapSpeed(v, 10, 450, 100), 50);
  assert.equal(trapSpeed(v, 10, 450, 20), 47);
  assert.equal(trapSpeed(v, 10, 980, 50), 7); // indices 93..103 → 93..99 and 0..3 (wrap)
});
