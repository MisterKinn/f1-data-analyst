import test from 'node:test';
import assert from 'node:assert/strict';
import {signFlip, coverage} from '../scripts/sim/gate.mjs';

test('signFlip: exact one-sided p, outlier-robust decision, CI', () => {
  const all = signFlip([1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(all.p, 1 / 256); assert.ok(all.accept);
  const outlier = signFlip([10, -1, -1, -1, -1, -1, -1, -1]);   // mean > 0 only because of one track
  assert.ok(outlier.gain > 0 && !outlier.accept);
  assert.ok(!signFlip([1, 1, 1, 1]).accept);                     // n < 5
  assert.ok(signFlip([1, 1, 1, 1, 1, 1, 1, 1], {m: 3}).accept);  // 1/256 < 0.053
  const big = signFlip(Array.from({length: 30}, (_, i) => (i % 3 ? 0.2 : -0.1)));
  assert.ok(big.ci90[0] <= big.gain && big.gain <= big.ci90[1]);
});

test('coverage of a shown ±', () => {
  const c = coverage([{err: 0.5, sigma: 1}, {err: 1.5, sigma: 1}, {err: -0.2, sigma: 1}, {err: 3, sigma: 1}]);
  assert.equal(c.n, 4); assert.equal(c.c1, 0.5); assert.equal(c.c2, 0.75);
});
