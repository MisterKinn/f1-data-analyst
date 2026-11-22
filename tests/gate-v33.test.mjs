import test from 'node:test';
import assert from 'node:assert/strict';
import {mde, minSignFlipP, clusterBootstrap, skill} from '../scripts/sim/gate.mjs';

test('v3.3 power check: MDE shrinks with √n; an exact sign-flip test on 5 units cannot go below 1/32', () => {
  assert.ok(Math.abs(mde(1, 4) - 0.92) < 1e-9);
  assert.equal(minSignFlipP(5), 1 / 32);
  assert.ok(minSignFlipP(9) * 10 < 0.05); // with one loss about 10 / 512 at n = 9
});
test('v3.3 cluster bootstrap: clear gain over 6 circuits passes, a gain from one circuit alone does not', () => {
  const good = []; for (let c = 0; c < 6; c++) for (let z = 0; z < 5; z++) good.push({circuit: c, gain: 1 + 0.1 * z});
  assert.equal(clusterBootstrap(good).pass, true);
  const one = []; for (let c = 0; c < 6; c++) for (let z = 0; z < 5; z++) one.push({circuit: c, gain: c === 0 ? 10 : -0.5});
  assert.equal(clusterBootstrap(one).pass, false);
  assert.equal(clusterBootstrap(good.filter(r => r.circuit < 4)).pass, false); // fewer than 5 circuits
});
test('v3.3 skill score', () => { assert.equal(skill([1, 1], [2, 2]), 0.5); assert.ok(Number.isNaN(skill([1], [0]))); });
