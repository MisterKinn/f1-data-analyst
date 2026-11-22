import test from 'node:test';
import assert from 'node:assert/strict';
import {mbpSeries, zones} from '../worker/lapsim/brake-pressure.js';

// a straight 300 → 100 km/h stop at 4 g between flat-out stretches: one zone, friction force = m·a − drag − rolling − regen
test('M-BP: constant 4 g stop gives one zone with the expected friction force', () => {
  const x = [], v = []; let s = 0, u = 300 / 3.6;
  for (let i = 0; i < 200; i++) { x.push(s); v.push(300); s += u * 0.05; }
  while (u > 100 / 3.6) { x.push(s); v.push(u * 3.6); s += u * 0.05; u -= 4 * 9.81 * 0.05; }
  for (let i = 0; i < 200; i++) { x.push(s); v.push(100); s += 100 / 3.6 * 0.05; }
  for (const win of [5, 11]) {
    const S = mbpSeries(x, v, 2025, {}, {win}), Z = zones(S);
    assert.equal(Z.length, 1);
    const z = Z[0], vm = 200 / 3.6, mid = 800 * 4 * 9.81 - 0.5 * 1.2 * 1.3 * vm * vm - 0.015 * 800 * 9.81 - 120e3 / vm;
    assert.ok(Math.abs(z.p80F / mid - 1) < 0.25, `win ${win}: p80 ${z.p80F} vs ${mid}`);
    assert.ok(z.peakG > 3.6 && z.peakG < 4.4);
  }
});
