import test from 'node:test';
import assert from 'node:assert/strict';
import {medianKappa} from '../scripts/sim/kappa-median.mjs';

test('median removes a narrow spike and keeps a wide corner', () => {
  const k = Array(200).fill(0); for (let i = 50; i < 100; i++) k[i] = 800; k[150] = 2000;
  const m = medianKappa(k, 5, 35);
  assert.equal(m[150], 0); assert.equal(m[75], 800); assert.equal(m.length, 200);
});
test('wraps over the line', () => { const k = Array(50).fill(100); k[0] = 900; assert.equal(medianKappa(k, 5, 25)[0], 100); });
